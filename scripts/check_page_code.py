"""Prove that website/index.html changed only inside its data packs.

Compares the page with the two JSON data packs blanked out (#k3-data and #m6-data) against the
same file at a git ref, and prints a unified diff of anything else. Exit 1 if the page code differs.

  python3 scripts/check_page_code.py --base origin/main
Standard library only.
"""
import argparse
import difflib
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_site_data import strip_packs  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILE = 'website/index.html'


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='origin/main', help='git ref to compare with')
    a = ap.parse_args(argv)
    before = subprocess.run(['git', 'show', '%s:%s' % (a.base, FILE)], cwd=ROOT, capture_output=True, check=True).stdout.decode('utf-8')
    after = open(os.path.join(ROOT, FILE), encoding='utf-8').read()
    b, c = strip_packs(before).splitlines(True), strip_packs(after).splitlines(True)
    diff = list(difflib.unified_diff(b, c, '%s (%s, packs blanked)' % (FILE, a.base), '%s (working tree, packs blanked)' % FILE))
    print('page code lines compared: %d before, %d after' % (len(b), len(c)))
    print('page code outside data packs: %s' % ('IDENTICAL (diff is empty)' if not diff else 'CHANGED'))
    sys.stdout.writelines(d[:300] + ('\n' if len(d) > 300 else '') for d in diff[:200])
    return 1 if diff else 0


if __name__ == '__main__':
    sys.exit(main())
