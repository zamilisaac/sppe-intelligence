"""Rebuild the website's baked-in data from the DOSM CSV files in dosm/.

What it rewrites (nothing else):
  website/index.html        only the two JSON data packs:
                              <!--K3DATA--> ... <!--/K3DATA-->       (Productivity Lab / Insights Studio)
                              <script ... id="m6-data"> ... </script>  (GDP, wages, labour, CPI; Smart Report Builder)
  website/data/snapshot.json  only the "national" row of the 12 state-productivity tables
                              (state rows come from DOSM's state productivity workbook, an Excel
                              release that is notify-only and is never auto-ingested)
  website/data/data-manifest.json  "data as of" per dataset, file hashes, pack versions, warnings
                              (the "deployments" list in it is kept and only appended by dosm-deploy.yml)

Usage
  python3 scripts/build_site_data.py              rebuild in place
  python3 scripts/build_site_data.py --verify     rebuild in memory and compare with the committed files;
                                                  exit 1 if anything differs (nothing is written)
  --root DIR                                      work on another checkout (tests)

Standard library only. Output is deterministic: running it twice gives identical files.
"""
import argparse
import csv
import hashlib
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import m6_pack  # noqa: E402
import build_k3_data  # noqa: E402

DATASETS = [
    'gdp_state_real_supply', 'productivity_annual', 'wages_state', 'wages_sector', 'wages_industry',
    'wages_education', 'wages_skill', 'formal_wages_state', 'formal_wages_msic', 'formal_wages_band',
    'lfs_state_sex', 'cpi_2d_state', 'cpi_2d_state_inflation', 'hies_state', 'hies_state_percentile',
]
K3_RE = re.compile(r'<!--K3DATA-->.*?<!--/K3DATA-->', re.S)
M6_OPEN = '<script type="application/json" id="m6-data">'
M6_RE = re.compile(re.escape(M6_OPEN) + r'.*?</script>', re.S)
SNAP_TABLES = {'1': ('p0', 'abs'), '2': ('p0', 'growth_yoy')}
for _n in range(1, 6):
    SNAP_TABLES['3.%d' % _n] = ('p%d' % _n, 'abs')
    SNAP_TABLES['4.%d' % _n] = ('p%d' % _n, 'growth_yoy')


def paths(root):
    return {
        'dosm': os.path.join(root, 'dosm'),
        'html': os.path.join(root, 'website', 'index.html'),
        'snap': os.path.join(root, 'website', 'data', 'snapshot.json'),
        'manifest': os.path.join(root, 'website', 'data', 'data-manifest.json'),
    }


def strip_packs(html):
    """Page code with the two data packs blanked out. Used to prove that only data changed."""
    html = K3_RE.sub('<!--K3DATA--><!--data pack--><!--/K3DATA-->', html)
    return M6_RE.sub(M6_OPEN + '/*data pack*/</script>', html)


def dumps(o):
    return json.dumps(o, separators=(',', ':'))


def latest_period(d, name):
    """Latest period in a dataset: 'YYYY' for annual files, 'YYYY-MM' for monthly ones."""
    with open(os.path.join(d, name + '.csv'), encoding='utf-8', newline='') as f:
        dates = [r['date'] for r in csv.DictReader(f) if r.get('date')]
    if not dates:
        return None
    monthly = any(x[5:7] != '01' for x in dates)
    top = max(dates)
    return top[:7] if monthly else top[:4]


def file_info(d, name):
    p = os.path.join(d, name + '.csv')
    with open(p, 'rb') as f:
        raw = f.read()
    return {'latest': latest_period(d, name), 'rows': raw.count(b'\n') - 1 if raw.endswith(b'\n') else raw.count(b'\n'),
            'sha256': hashlib.sha256(raw).hexdigest()}


def as_of(d, snap):
    out = {name: latest_period(d, name) for name in DATASETS if os.path.exists(os.path.join(d, name + '.csv'))}
    if snap:
        out['state_productivity_workbook'] = str(max(snap['years']))
    return out


def update_snapshot(d, snap):
    """Refresh the national rows of the productivity tables from productivity_annual. Returns warnings."""
    warn = []
    with open(os.path.join(d, 'productivity_annual.csv'), encoding='utf-8', newline='') as f:
        pa = {(r['series'], int(r['date'][:4]), r['sector']): r for r in csv.DictReader(f)}
    years = snap['years']
    csv_years = sorted({k[1] for k in pa})
    if csv_years and csv_years[-1] > max(years):
        warn.append('productivity_annual has %d but the state productivity tables end in %d: download the new DOSM '
                    'state productivity workbook (notify-only); national rows were not extended.' % (csv_years[-1], max(years)))
    revised = []
    for tid, (sector, series) in SNAP_TABLES.items():
        t = snap['tables'].get(tid)
        if not t:
            continue
        new = list(t['national'])
        for i, y in enumerate(years):
            r = pa.get((series, y, sector))
            if r is None or r.get('output_employment', '') == '':
                continue
            v = m6_pack.clean(r['output_employment'])
            if v != new[i]:
                revised.append('%s %d: %s -> %s' % (tid, y, new[i], v))
            new[i] = v
        t['national'] = new
    if revised:
        warn.append('National productivity revised in productivity_annual (state rows unchanged until the workbook is '
                    'updated): ' + '; '.join(revised[:12]) + (' ...' if len(revised) > 12 else ''))
    return warn


def build(root):
    p = paths(root)
    html = open(p['html'], encoding='utf-8').read()
    snap_txt = open(p['snap'], encoding='utf-8').read()
    snap = json.loads(snap_txt)
    warnings = update_snapshot(p['dosm'], snap)
    m6 = m6_pack.build(p['dosm'])
    m6['asOf'] = as_of(p['dosm'], snap)
    k3 = build_k3_data.build_pack(p['dosm'])
    new_html = K3_RE.sub(lambda m: build_k3_data.blob_of(k3), html, count=1)
    new_html = M6_RE.sub(lambda m: M6_OPEN + dumps(m6) + '</script>', new_html, count=1)
    new_snap = dumps(snap)
    old_manifest = {}
    if os.path.exists(p['manifest']):
        old_manifest = json.load(open(p['manifest'], encoding='utf-8'))
    manifest = {
        'schema': 1,
        'about': 'Data as of (latest period per dataset) for the SPPE Intelligence site. Written by '
                 'scripts/build_site_data.py; deployments are appended by .github/workflows/dosm-deploy.yml.',
        'asOf': m6['asOf'],
        'datasets': {n: file_info(p['dosm'], n) for n in DATASETS if os.path.exists(os.path.join(p['dosm'], n + '.csv'))},
        'packs': {
            'k3-data': k3['version'],
            'm6-data': hashlib.sha256(dumps(m6).encode()).hexdigest()[:12],
            'snapshot.json': hashlib.sha256(new_snap.encode()).hexdigest()[:12],
        },
        'stateProductivity': {'source': snap.get('source', {}).get('name'), 'years': [min(snap['years']), max(snap['years'])],
                              'nationalRowsFrom': 'dosm/productivity_annual.csv'},
        'warnings': warnings,
        'deployments': old_manifest.get('deployments', []),
    }
    new_manifest = json.dumps(manifest, indent=2, ensure_ascii=False) + '\n'
    return {
        'html': (html, new_html), 'snap': (snap_txt, new_snap),
        'manifest': (json.dumps(old_manifest, indent=2, ensure_ascii=False) + '\n' if old_manifest else '', new_manifest),
        'warnings': warnings, 'asOf': m6['asOf'], 'paths': p,
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--root', default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ap.add_argument('--verify', action='store_true', help='compare with committed files, write nothing')
    a = ap.parse_args(argv)
    r = build(a.root)
    old_html, new_html = r['html']
    if strip_packs(old_html) != strip_packs(new_html):
        print('ERROR: page code outside the data packs would change. Nothing written.')
        return 2
    changed = [k for k in ('html', 'snap', 'manifest') if r[k][0] != r[k][1]]
    if a.verify:
        for k in ('html', 'snap', 'manifest'):
            print('%-9s %s' % (k, 'identical' if k not in changed else 'DIFFERS'))
        print('data as of:', json.dumps(r['asOf']))
        return 1 if changed else 0
    for k in changed:
        with open(r['paths'][k], 'w', encoding='utf-8', newline='') as f:
            f.write(r[k][1])
    print('rewritten:', ', '.join(changed) or 'nothing (already up to date)')
    print('data as of:', json.dumps(r['asOf']))
    for w in r['warnings']:
        print('WARNING:', w)
    return 0


if __name__ == '__main__':
    sys.exit(main())
