"""Unit and round-trip tests for the DOSM pipeline. Standard library only.

  python3 scripts/test_dosm_pipeline.py -v

Round trip: the builders must reproduce the committed data packs from the committed dosm/ files.
Validation: synthetic good and bad files must give PASS / FAIL as specified.
Simulation: check_dosm.py --simulate must flow through validation and the rebuild with no page-code change.
Every test works on a temporary copy; the repository is never modified.
"""
import csv
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import build_k3_data  # noqa: E402
import build_site_data as B  # noqa: E402
import m6_pack  # noqa: E402
import validate_dosm as V  # noqa: E402

HTML = os.path.join(ROOT, 'website', 'index.html')
M6_RE = re.compile(r'<script type="application/json" id="m6-data">(.*?)</script>', re.S)
K3_RE = re.compile(r'<!--K3DATA-->.*?<!--/K3DATA-->', re.S)


def git_show(ref, path):
    r = subprocess.run(['git', 'show', '%s:%s' % (ref, path)], cwd=ROOT, capture_output=True)
    return r.stdout.decode('utf-8') if r.returncode == 0 else None


def copy_repo():
    t = tempfile.mkdtemp(prefix='dosm-test-')
    for d in ('scripts', 'dosm'):
        shutil.copytree(os.path.join(ROOT, d), os.path.join(t, d))
    os.makedirs(os.path.join(t, 'website'))
    shutil.copy(HTML, os.path.join(t, 'website', 'index.html'))
    shutil.copytree(os.path.join(ROOT, 'website', 'data'), os.path.join(t, 'website', 'data'))
    return t


def read_csv(p):
    with open(p, encoding='utf-8', newline='') as f:
        rd = csv.DictReader(f)
        return list(rd.fieldnames), list(rd)


def write_csv(p, cols, rows):
    with open(p, 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore', lineterminator='\n')
        w.writeheader()
        w.writerows(rows)


class RoundTrip(unittest.TestCase):
    """build_site_data.py is faithful to the pack committed before this automation existed."""

    def test_m6_pack_byte_identical_to_original(self):
        built = B.dumps(m6_pack.build(os.path.join(ROOT, 'dosm')))
        # the pack as committed by the session-only builder (before asOf was added)
        ref = None
        for r in ('d215533', 'origin/main'):
            h = git_show(r, 'website/index.html')
            if h and M6_RE.search(h) and '"asOf"' not in M6_RE.search(h).group(1):
                ref = M6_RE.search(h).group(1)
                break
        if ref is None:  # fall back to the current pack without asOf
            cur = json.loads(M6_RE.search(open(HTML, encoding='utf-8').read()).group(1))
            cur.pop('asOf', None)
            ref = B.dumps(cur)
        self.assertEqual(len(built), len(ref))
        self.assertEqual(built, ref)

    def test_m6_current_pack_equals_build_plus_asof(self):
        cur = M6_RE.search(open(HTML, encoding='utf-8').read()).group(1)
        snap = json.load(open(os.path.join(ROOT, 'website', 'data', 'snapshot.json'), encoding='utf-8'))
        built = m6_pack.build(os.path.join(ROOT, 'dosm'))
        built['asOf'] = B.as_of(os.path.join(ROOT, 'dosm'), snap)
        self.assertEqual(B.dumps(built), cur)

    def test_k3_pack_byte_identical(self):
        cur = K3_RE.search(open(HTML, encoding='utf-8').read()).group(0)
        self.assertEqual(build_k3_data.blob_of(build_k3_data.build_pack(os.path.join(ROOT, 'dosm'))), cur)

    def test_snapshot_byte_identical(self):
        txt = open(os.path.join(ROOT, 'website', 'data', 'snapshot.json'), encoding='utf-8').read()
        snap = json.loads(txt)
        warn = B.update_snapshot(os.path.join(ROOT, 'dosm'), snap)
        self.assertEqual(warn, [])
        self.assertEqual(B.dumps(snap), txt)

    def test_verify_mode_clean_on_committed_files(self):
        r = subprocess.run([sys.executable, os.path.join(HERE, 'build_site_data.py'), '--verify'], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_rebuild_is_idempotent_and_touches_only_data(self):
        t = copy_repo()
        try:
            before = open(os.path.join(t, 'website', 'index.html'), encoding='utf-8').read()
            self.assertEqual(B.main(['--root', t]), 0)
            self.assertEqual(B.main(['--root', t, '--verify']), 0)
            after = open(os.path.join(t, 'website', 'index.html'), encoding='utf-8').read()
            self.assertEqual(B.strip_packs(before), B.strip_packs(after))
        finally:
            shutil.rmtree(t)

    def test_strip_packs_detects_code_change(self):
        h = open(HTML, encoding='utf-8').read()
        self.assertNotEqual(B.strip_packs(h), B.strip_packs(h.replace('boot();', 'boot(); ', 1)))


class Validation(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.mkdtemp(prefix='dosm-val-')
        self.old = os.path.join(ROOT, 'dosm', 'formal_wages_state.csv')
        self.cols, self.rows = read_csv(self.old)
        self.new = os.path.join(self.t, 'formal_wages_state.csv')

    def tearDown(self):
        shutil.rmtree(self.t)

    def run_v(self, cols, rows, name='formal_wages_state'):
        write_csv(self.new, cols, rows)
        return V.validate(name, self.old, self.new)

    def appended(self):
        top = max(r['date'] for r in self.rows)
        return self.rows + [dict(r, date='2026-07-01') for r in self.rows if r['date'] == top]

    def failed(self, res):
        return [c for c, s, _ in res['checks'] if s == 'FAIL']

    def test_new_month_passes(self):
        res = self.run_v(self.cols, self.appended())
        self.assertEqual(res['status'], 'PASS', res)
        self.assertIn('Rows: 17 added, 0 removed, 935 total', res['diff'][0])
        self.assertTrue(any('2026-07' in d for d in res['diff']))

    def test_dropped_column_fails(self):
        res = self.run_v([c for c in self.cols if c != 'wages_median'], self.appended())
        self.assertEqual(res['status'], 'FAIL')
        self.assertEqual(self.failed(res), ['required columns'])

    def test_bad_date_fails(self):
        rows = self.appended(); rows[-1] = dict(rows[-1], date='July 2026')
        self.assertIn('dates parse', self.failed(self.run_v(self.cols, rows)))

    def test_older_newest_date_fails(self):
        rows = [r for r in self.rows if r['date'] < '2026-06-01']
        self.assertIn('newest date not older', self.failed(self.run_v(self.cols, rows)))

    def test_rows_down_more_than_5pct_fails(self):
        rows = self.rows[: int(len(self.rows) * 0.9)] + [r for r in self.rows if r['date'] == '2026-06-01']
        self.assertIn('row count', self.failed(self.run_v(self.cols, rows)))

    def test_vanished_state_fails(self):
        rows = [r for r in self.appended() if r['state'] != 'Perlis']
        self.assertIn('no category vanished', self.failed(self.run_v(self.cols, rows)))

    def test_non_numeric_fails(self):
        rows = self.appended(); rows[-1] = dict(rows[-1], wages_median='n/a')
        self.assertIn('numeric columns parse', self.failed(self.run_v(self.cols, rows)))

    def test_new_blanks_over_1pct_fails(self):
        rows = [dict(r, employees='') if i % 30 == 0 else r for i, r in enumerate(self.appended())]
        self.assertIn('new blanks <= 1%', self.failed(self.run_v(self.cols, rows)))

    def test_few_new_blanks_warns(self):
        rows = self.appended(); rows[-1] = dict(rows[-1], employees='')
        res = self.run_v(self.cols, rows)
        self.assertEqual(res['status'], 'WARN')

    def test_duplicate_key_fails(self):
        rows = self.appended() + [self.rows[0]]
        self.assertIn('no duplicate keys', self.failed(self.run_v(self.cols, rows)))

    def test_revisions_listed_biggest_first(self):
        rows = [dict(r) for r in self.appended()]
        rows[0]['wages_median'] = str(float(rows[0]['wages_median']) * 1.5)
        rows[1]['employees'] = str(int(rows[1]['employees']) + 1)
        res = self.run_v(self.cols, rows)
        self.assertEqual(res['status'], 'PASS')
        self.assertIn('Revised values in existing rows: 2', res['diff'])
        self.assertIn('+50.0%', [d for d in res['diff'] if d.startswith('  - ')][0])

    def test_report_markdown(self):
        good = self.run_v(self.cols, self.appended())
        overall, md = V.report({'formal_wages_state': good, 'x': {'status': 'FAIL', 'checks': [('required columns', 'FAIL', 'missing: a')], 'diff': []}})
        self.assertEqual(overall, 'FAIL')
        self.assertIn('| `formal_wages_state` | PASS | 2026-06 -> **2026-07** |', md)

    def test_cli_exit_codes(self):
        write_csv(self.new, [c for c in self.cols if c != 'employees'], self.appended())
        r = subprocess.run([sys.executable, os.path.join(HERE, 'validate_dosm.py'), '--old-dir', os.path.join(ROOT, 'dosm'),
                            '--new-dir', self.t, '--datasets', 'formal_wages_state'], capture_output=True, text=True)
        self.assertEqual(r.returncode, 2)


class EndToEndOffline(unittest.TestCase):
    """Stage 1 simulate -> Stage 2 validate + rebuild, on a temporary copy, without network."""

    def pipeline(self, flag):
        t = copy_repo()
        old = os.path.join(t, 'dosm-old')
        shutil.copytree(os.path.join(t, 'dosm'), old)
        env = dict(os.environ, DOSM_OUT=t)
        env.pop('GITHUB_OUTPUT', None)
        r = subprocess.run([sys.executable, os.path.join(t, 'scripts', 'check_dosm.py'), flag, '--skip-download'], capture_output=True, text=True, env=env)
        self.assertEqual(r.returncode, 0, r.stderr)
        res = json.load(open(os.path.join(t, 'dosm_check.json')))
        return t, old, res

    def test_simulate_good_flows_to_rebuild(self):
        t, old, res = self.pipeline('--simulate')
        try:
            self.assertEqual(res['changed'], ['formal_wages_state'])
            v = V.validate('formal_wages_state', os.path.join(old, 'formal_wages_state.csv'), os.path.join(t, 'dosm', 'formal_wages_state.csv'))
            self.assertEqual(v['status'], 'PASS')
            html0 = open(os.path.join(t, 'website', 'index.html'), encoding='utf-8').read()
            self.assertEqual(B.main(['--root', t]), 0)
            html1 = open(os.path.join(t, 'website', 'index.html'), encoding='utf-8').read()
            self.assertNotEqual(html0, html1)
            self.assertEqual(B.strip_packs(html0), B.strip_packs(html1))
            man = json.load(open(os.path.join(t, 'website', 'data', 'data-manifest.json')))
            self.assertEqual(man['asOf']['formal_wages_state'], '2026-07')
            k3 = json.loads(re.search(r'id="k3-data">(.*?)</script>', html1, re.S).group(1))
            self.assertEqual(k3['formal']['dates'][-1], '2026-07')
        finally:
            shutil.rmtree(t)

    def test_simulate_bad_fails_validation(self):
        t, old, res = self.pipeline('--simulate-bad')
        try:
            v = V.validate('formal_wages_state', os.path.join(old, 'formal_wages_state.csv'), os.path.join(t, 'dosm', 'formal_wages_state.csv'))
            self.assertEqual(v['status'], 'FAIL')
            self.assertIn('wages_median', v['checks'][0][2])
        finally:
            shutil.rmtree(t)

    def test_national_productivity_revision_updates_snapshot(self):
        t = copy_repo()
        try:
            p = os.path.join(t, 'dosm', 'productivity_annual.csv')
            cols, rows = read_csv(p)
            for r in rows:
                if r['series'] == 'abs' and r['date'] == '2025-01-01' and r['sector'] == 'p0':
                    r['output_employment'] = '104600.0'
            rows.append(dict(rows[-1], date='2026-01-01'))
            write_csv(p, cols, rows)
            self.assertEqual(B.main(['--root', t]), 0)
            snap = json.load(open(os.path.join(t, 'website', 'data', 'snapshot.json')))
            self.assertEqual(snap['tables']['1']['national'][-1], 104600)
            self.assertEqual(snap['tables']['1']['rows']['johor'][-1], 86568)  # state rows untouched
            warn = json.load(open(os.path.join(t, 'website', 'data', 'data-manifest.json')))['warnings']
            self.assertTrue(any('2026' in w and 'workbook' in w for w in warn))
            self.assertTrue(any('1 2025: 104556 -> 104600' in w for w in warn))
        finally:
            shutil.rmtree(t)


if __name__ == '__main__':
    unittest.main()
