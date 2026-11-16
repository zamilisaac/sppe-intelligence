"""Validate newly downloaded DOSM CSV files against the copies already in the repo.

For every changed dataset it checks:
  1. required columns present                      FAIL if missing
  2. every `date` parses as YYYY-MM-DD             FAIL if not
  3. newest date >= old newest date                FAIL if older
  4. row count not down more than 5%               FAIL if > 5% fewer rows (WARN if any fewer)
  5. no state / sector / category vanished         FAIL if a value present before is gone
  6. numeric columns parse                         FAIL if a non-blank value is not a number
  7. no more than 1% new blanks                    FAIL if blanks grew by > 1% of numeric cells (WARN if any)
  8. no duplicate keys                             FAIL if a key appears twice
and writes a Markdown report with PASS / WARN / FAIL per dataset plus a diff summary
(rows added/removed, latest period, biggest value changes).

Usage
  python3 scripts/validate_dosm.py --old-dir OLD --new-dir dosm --datasets a,b --out report.md
Exit code 0 = PASS or WARN, 2 = at least one FAIL. Writes status=PASS|WARN|FAIL to $GITHUB_OUTPUT.
Standard library only.
"""
import argparse
import csv
import datetime
import os
import sys

# required columns, key columns (unique per row), category columns (must not lose values), numeric columns
SCHEMA = {
    'gdp_state_real_supply': (['series', 'date', 'state', 'sector', 'value'], ['series', 'date', 'state', 'sector'], ['series', 'state', 'sector'], ['value']),
    'productivity_annual': (['series', 'date', 'sector', 'gdp', 'hours', 'employment', 'output_hour', 'output_employment'], ['series', 'date', 'sector'], ['series', 'sector'], ['gdp', 'hours', 'employment', 'output_hour', 'output_employment']),
    'wages_state': (['state', 'date', 'sex', 'recipients', 'wages_median', 'wages_mean'], ['state', 'date', 'sex'], ['state', 'sex'], ['recipients', 'wages_median', 'wages_mean']),
    'wages_sector': (['date', 'sex', 'sector', 'recipients', 'wages_median', 'wages_mean'], ['date', 'sex', 'sector'], ['sex', 'sector'], ['recipients', 'wages_median', 'wages_mean']),
    'wages_industry': (['date', 'sex', 'section', 'recipients', 'wages_median', 'wages_mean'], ['date', 'sex', 'section'], ['sex', 'section'], ['recipients', 'wages_median', 'wages_mean']),
    'wages_education': (['date', 'sex', 'education', 'recipients', 'wages_median', 'wages_mean'], ['date', 'sex', 'education'], ['sex', 'education'], ['recipients', 'wages_median', 'wages_mean']),
    'wages_skill': (['date', 'sex', 'skill', 'recipients', 'wages_median', 'wages_mean'], ['date', 'sex', 'skill'], ['sex', 'skill'], ['recipients', 'wages_median', 'wages_mean']),
    'formal_wages_state': (['state', 'date', 'employees', 'wages_median'], ['state', 'date'], ['state'], ['employees', 'wages_median']),
    'formal_wages_msic': (['date', 'sector', 'industry', 'employees', 'wages_median'], ['date', 'sector', 'industry'], ['sector', 'industry'], ['employees', 'wages_median']),
    'formal_wages_band': (['date', 'band', 'employees'], ['date', 'band'], ['band'], ['employees']),
    'lfs_state_sex': (['state', 'sex', 'date', 'lf', 'lf_employed', 'lf_unemployed', 'lf_outside', 'p_rate', 'u_rate', 'ep_ratio'], ['state', 'sex', 'date'], ['state', 'sex'], ['lf', 'lf_employed', 'lf_unemployed', 'lf_outside', 'p_rate', 'u_rate', 'ep_ratio']),
    'cpi_2d_state': (['state', 'date', 'division', 'index'], ['state', 'date', 'division'], ['state', 'division'], ['index']),
    'cpi_2d_state_inflation': (['state', 'date', 'division', 'inflation_yoy', 'inflation_mom'], ['state', 'date', 'division'], ['state', 'division'], ['inflation_yoy', 'inflation_mom']),
    'hies_state': (['date', 'state', 'income_mean', 'income_median', 'expenditure_mean', 'gini', 'poverty'], ['date', 'state'], ['state'], ['income_mean', 'income_median', 'expenditure_mean', 'gini', 'poverty']),
    'hies_state_percentile': (['date', 'state', 'percentile', 'variable', 'income'], ['date', 'state', 'percentile', 'variable'], ['state', 'percentile', 'variable'], ['income']),
}
RANK = {'PASS': 0, 'WARN': 1, 'FAIL': 2}


def read(path):
    with open(path, encoding='utf-8', newline='') as f:
        rd = csv.DictReader(f)
        return list(rd.fieldnames or []), list(rd)


def isnum(v):
    try:
        float(v)
        return True
    except (TypeError, ValueError):
        return False


def okdate(v):
    try:
        datetime.date.fromisoformat(v or '')
        return len(v) == 10
    except ValueError:
        return False


def period(d):
    return d[:4] if d and d[5:10] == '01-01' else (d or '')[:7]


def validate(name, old_path, new_path):
    """Return dict(status, checks=[(check, status, detail)], diff=[lines])."""
    req, keys, cats, nums = SCHEMA.get(name, ([], [], [], []))
    checks, diff = [], []

    def add(check, st, detail=''):
        checks.append((check, st, detail))

    try:
        cols, new = read(new_path)
    except (OSError, UnicodeDecodeError, csv.Error) as e:
        add('file readable', 'FAIL', '%s: %s' % (e.__class__.__name__, e))
        return {'status': 'FAIL', 'checks': checks, 'diff': diff}
    ocols, old = read(old_path) if old_path and os.path.exists(old_path) else ([], [])
    if not req:  # unknown dataset: use the old file's header as the contract
        req = ocols
    missing = [c for c in req if c not in cols]
    add('required columns', 'FAIL' if missing else 'PASS', ('missing: ' + ', '.join(missing)) if missing else '%d columns' % len(cols))
    extra = [c for c in cols if ocols and c not in ocols]
    if extra:
        add('new columns', 'WARN', ', '.join(extra))
    if missing:  # later checks would only repeat the same failure
        return {'status': 'FAIL', 'checks': checks, 'diff': diff}

    if 'date' in cols:
        bad = [r.get('date') for r in new if not okdate(r.get('date'))]
        add('dates parse', 'FAIL' if bad else 'PASS', ('%d bad, e.g. %r' % (len(bad), bad[0])) if bad else '')
        nd = max((r['date'] for r in new if okdate(r.get('date'))), default=None)
        od = max((r['date'] for r in old if okdate(r.get('date'))), default=None)
        if od and (nd is None or nd < od):
            add('newest date not older', 'FAIL', 'new %s < old %s' % (nd, od))
        else:
            add('newest date not older', 'PASS', '%s -> %s' % (od or '-', nd or '-'))
        diff.append('Latest period: %s -> **%s**' % (period(od) if od else '-', period(nd) if nd else '-'))

    if old:
        drop = (len(old) - len(new)) / len(old)
        st = 'FAIL' if drop > 0.05 else 'WARN' if drop > 0 else 'PASS'
        add('row count', st, '%d -> %d (%+d)' % (len(old), len(new), len(new) - len(old)))
    else:
        add('row count', 'PASS', '%d rows (no previous copy)' % len(new))

    gone = []
    for c in cats:
        lost = sorted({r[c] for r in old} - {r[c] for r in new})
        if lost:
            gone.append('%s: %s' % (c, ', '.join(lost[:8])))
    add('no category vanished', 'FAIL' if gone else 'PASS', '; '.join(gone))

    badn = [(c, r[c]) for r in new for c in nums if r.get(c, '') != '' and not isnum(r[c])]
    add('numeric columns parse', 'FAIL' if badn else 'PASS', ('%d bad, e.g. %s=%r' % (len(badn), badn[0][0], badn[0][1])) if badn else '')

    def blanks(rr):
        return sum(1 for r in rr for c in nums if (r.get(c) or '') == '')
    cells = max(1, len(new) * len(nums))
    nb, ob = blanks(new), blanks(old)
    share = (nb / cells) - (ob / max(1, len(old) * len(nums)) if old else 0)
    st = 'FAIL' if share > 0.01 else 'WARN' if nb > ob and old else 'PASS'
    add('new blanks <= 1%', st, 'blank cells %d -> %d (%.2f%% of numeric cells, %+.2f pts)' % (ob, nb, 100 * nb / cells, 100 * share))

    seen, dups = set(), []
    for r in new:
        k = tuple(r.get(c) for c in keys)
        if k in seen:
            dups.append(k)
        seen.add(k)
    add('no duplicate keys', 'FAIL' if dups else 'PASS', ('%d duplicates, e.g. %s' % (len(dups), '|'.join(dups[0]))) if dups else '')

    # diff summary
    if old and keys:
        oi = {tuple(r.get(c) for c in keys): r for r in old}
        ni = {tuple(r.get(c) for c in keys): r for r in new}
        added, removed = len(ni.keys() - oi.keys()), len(oi.keys() - ni.keys())
        diff.insert(0, 'Rows: %d added, %d removed, %d total' % (added, removed, len(new)))
        ch = []
        for k in ni.keys() & oi.keys():
            for c in nums:
                a, b = oi[k].get(c, ''), ni[k].get(c, '')
                if a != b and isnum(a) and isnum(b) and float(a) != float(b):
                    fa, fb = float(a), float(b)
                    pct = (fb - fa) / abs(fa) * 100 if fa else float('inf')
                    ch.append((abs(pct), '|'.join(k), c, a, b, pct))
        if ch:
            ch.sort(reverse=True)
            diff.append('Revised values in existing rows: %d' % len(ch))
            for _, k, c, a, b, pct in ch[:5]:
                diff.append('  - `%s` %s: %s -> %s (%+.1f%%)' % (k, c, a, b, pct))
        else:
            diff.append('Revised values in existing rows: none')
    status = max((s for _, s, _ in checks), key=RANK.get, default='PASS')
    return {'status': status, 'checks': checks, 'diff': diff}


def report(results, title='DOSM validation report'):
    overall = max((r['status'] for r in results.values()), key=RANK.get, default='PASS')
    icon = {'PASS': 'PASS', 'WARN': 'WARN', 'FAIL': '**FAIL**'}
    out = ['## %s' % title, '', 'Overall: %s' % icon[overall], '', '| Dataset | Result | Latest period | Rows |', '|---|---|---|---|']
    for n, r in results.items():
        lp = next((d.split(': ', 1)[1] for d in r['diff'] if d.startswith('Latest period')), '-')
        rows = next((c[2] for c in r['checks'] if c[0] == 'row count'), '-')
        out.append('| `%s` | %s | %s | %s |' % (n, icon[r['status']], lp, rows))
    for n, r in results.items():
        out += ['', '### `%s` — %s' % (n, r['status']), '', '| Check | Result | Detail |', '|---|---|---|']
        out += ['| %s | %s | %s |' % (c, icon[s], d.replace('|', '/')) for c, s, d in r['checks']]
        if r['diff']:
            out += [''] + ['- ' + d if not d.startswith('  ') else d for d in r['diff']]
    return overall, '\n'.join(out) + '\n'


def main(argv=None):
    ap = argparse.ArgumentParser(description='Validate changed DOSM CSV files.')
    ap.add_argument('--old-dir', required=True)
    ap.add_argument('--new-dir', required=True)
    ap.add_argument('--datasets', required=True, help='comma-separated dataset names (without .csv)')
    ap.add_argument('--out', help='write the Markdown report here')
    a = ap.parse_args(argv)
    names = [n.strip() for n in a.datasets.split(',') if n.strip()]
    results = {n: validate(n, os.path.join(a.old_dir, n + '.csv'), os.path.join(a.new_dir, n + '.csv')) for n in names}
    overall, md = report(results)
    if a.out:
        with open(a.out, 'w', encoding='utf-8') as f:
            f.write(md)
    print(md)
    gh = os.environ.get('GITHUB_OUTPUT')
    if gh:
        with open(gh, 'a') as f:
            f.write('status=%s\n' % overall)
    return 2 if overall == 'FAIL' else 0


if __name__ == '__main__':
    sys.exit(main())
