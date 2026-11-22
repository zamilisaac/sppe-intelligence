"""Check the agent company configuration is consistent.

- every ROSTER worker in ops/BRIEF.md has a .claude/agents/<slug>.md file and every agent file is on the ROSTER
- each agent file has frontmatter with a matching name and a description
- each agent and session prompt tells the agent to read ops/BRIEF.md and the LESSONS file first
- only the Improver (penambah-baik) is allowed to write ops/LESSONS.md
- no e-mail addresses in any agent or ops file (public repository)

Prints PASS/FAIL lines (same style as the Playwright tests). Run: python3 scripts/check_agents.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
fails = 0


def ok(name, cond, extra=''):
    global fails
    print(('PASS ' if cond else 'FAIL ') + name + (f'  ({extra})' if extra and not cond else ''))
    fails += 0 if cond else 1


def slug(name):
    return re.sub(r'[^a-z]+', '-', name.lower()).strip('-')


brief = (ROOT / 'ops/BRIEF.md').read_text(encoding='utf-8')
roster = re.search(r'ROSTER:\n(.*?)\n\n', brief, re.S)
ok('BRIEF has a ROSTER block', bool(roster))
workers = [l.split('|')[0].strip(' *').strip() for l in roster.group(1).splitlines() if l.strip().startswith('*')] if roster else []
ok('ROSTER lists 3 to 7 workers', 3 <= len(workers) <= 7, len(workers))
for key in ('GOAL:', 'DONE MEANS', 'CONSTRAINTS:', 'OUT OF SCOPE:', 'OUTPUT FORMAT', 'QUALITY BAR', 'LESSONS FILE:', 'LOOP CAP:', 'ESCALATE TO ME WHEN:'):
    ok(f'BRIEF has {key.rstrip(":")}', key in brief)

agents = {p.stem: p for p in (ROOT / '.claude/agents').glob('*.md')}
ok('every ROSTER worker has an agent file', all(slug(w) in agents for w in workers), [w for w in workers if slug(w) not in agents])
ok('every agent file is on the ROSTER', all(a in {slug(w) for w in workers} for a in agents), [a for a in agents if a not in {slug(w) for w in workers}])

for a, p in sorted(agents.items()):
    t = p.read_text(encoding='utf-8')
    fm = re.match(r'---\n(.*?)\n---\n', t, re.S)
    ok(f'{a}: frontmatter name matches file', bool(fm) and re.search(rf'^name:\s*{re.escape(a)}\s*$', fm.group(1), re.M) is not None)
    ok(f'{a}: has a description', bool(fm) and re.search(r'^description:\s*\S', fm.group(1), re.M) is not None)
    ok(f'{a}: reads ops/BRIEF.md first', 'ops/BRIEF.md' in t)
    ok(f'{a}: reads the LESSONS file', 'ops/LESSONS.md' in t)
    writes = re.search(r'(Edit|Tulis|tulis) [^\n]*ops/LESSONS\.md|LESSONS: <ringkas>', t)
    ok(f'{a}: LESSONS write rule respected', bool(writes) == (a == 'penambah-baik'))

for p in sorted((ROOT / 'ops/prompts').glob('*.md')):
    t = p.read_text(encoding='utf-8')
    if p.stem in ('chief-of-staff', 'pm'):
        ok(f'prompt {p.stem}: reads BRIEF and LESSONS', 'ops/BRIEF.md' in t and 'LESSONS' in t)
    ok(f'prompt {p.stem}: has the kill switch', 'agents:pause' in t and ('PAUSE' in t or p.stem == 'pelaksana-kelulusan'))
    ok(f'prompt {p.stem}: reports to AIOS project SPPE-I', 'PUkL8j8ThYk1rL95Kx49vi' in t and 'projects/sppe-i/feed' in t)

email = re.compile(r'[A-Za-z0-9._%+-]+@(?!anthropic\.com)[A-Za-z0-9-]+\.[A-Za-z.]{2,}')
files = list((ROOT / 'ops').rglob('*.md')) + list(agents.values())
bad = [str(f.relative_to(ROOT)) for f in files if email.search(f.read_text(encoding='utf-8'))]
ok('no e-mail addresses in agent or ops files', not bad, bad)

sys.exit(1 if fails else 0)
