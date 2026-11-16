"""Build the data pack used by the shared calculation engine (Makmal Produktiviti / reports).

Reads the DOSM (OpenDOSM) CSV files in dosm/ and writes a compact JSON block into
website/index.html between the markers <!--K3DATA--> ... <!--/K3DATA-->.
Raw files are never modified. Run again after new DOSM files are added:

    python3 scripts/build_k3_data.py
"""
import csv, hashlib, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'dosm')
HTML = os.path.join(ROOT, 'website', 'index.html')


def rows(name):
    with open(os.path.join(D, name + '.csv'), encoding='utf-8') as f:
        return list(csv.DictReader(f))


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def sha(name):
    with open(os.path.join(D, name + '.csv'), 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()[:12]


pack = {'files': {}}
# national GDP (constant 2015 prices), employment, hours by sector: productivity_annual
pa = [r for r in rows('productivity_annual') if r['series'] == 'abs']
years = sorted({int(r['date'][:4]) for r in pa})
sec = {}
for r in pa:
    s = sec.setdefault(r['sector'], {'gdp': [None] * len(years), 'emp': [None] * len(years), 'hours': [None] * len(years)})
    i = years.index(int(r['date'][:4]))
    s['gdp'][i], s['emp'][i], s['hours'][i] = num(r['gdp']), num(r['employment']), num(r['hours'])
pack['nat'] = {'years': years, 'sectors': sec}
pack['files']['productivity_annual'] = sha('productivity_annual')

# formal sector wages (monthly): by state, by wage band, by sector
fs = rows('formal_wages_state')
dates = sorted({r['date'][:7] for r in fs})
st = {}
for r in fs:
    s = st.setdefault(r['state'], {'med': [None] * len(dates), 'emp': [None] * len(dates)})
    i = dates.index(r['date'][:7]); s['med'][i], s['emp'][i] = num(r['wages_median']), num(r['employees'])
pack['formal'] = {'dates': dates, 'states': st}
fb = rows('formal_wages_band'); bd = sorted({r['date'][:7] for r in fb}); bands = {}
for r in fb:
    b = bands.setdefault(r['band'], [None] * len(bd)); b[bd.index(r['date'][:7])] = num(r['employees'])
pack['band'] = {'dates': bd, 'bands': bands}
fm = [r for r in rows('formal_wages_msic') if r['industry'] in ('overall', '')]
md = sorted({r['date'][:7] for r in fm}); ms = {}
for r in fm:
    s = ms.setdefault(r['sector'], {'med': [None] * len(md), 'emp': [None] * len(md)})
    i = md.index(r['date'][:7]); s['med'][i], s['emp'][i] = num(r['wages_median']), num(r['employees'])
pack['msic'] = {'dates': md, 'sectors': ms}
for n in ('formal_wages_state', 'formal_wages_band', 'formal_wages_msic'):
    pack['files'][n] = sha(n)

# labour force by state and sex (annual)
lf = rows('lfs_state_sex'); ly = sorted({int(r['date'][:4]) for r in lf}); lfs = {}
for r in lf:
    k = r['state'] + '|' + r['sex']
    s = lfs.setdefault(k, {c: [None] * len(ly) for c in ('lf', 'emp', 'unemp', 'out', 'prate', 'urate', 'ep')})
    i = ly.index(int(r['date'][:4]))
    for c, src in (('lf', 'lf'), ('emp', 'lf_employed'), ('unemp', 'lf_unemployed'), ('out', 'lf_outside'), ('prate', 'p_rate'), ('urate', 'u_rate'), ('ep', 'ep_ratio')):
        s[c][i] = num(r[src])
pack['lfs'] = {'years': ly, 'series': lfs}
pack['files']['lfs_state_sex'] = sha('lfs_state_sex')

# survey wages by state and sex (annual)
ws = rows('wages_state'); wy = sorted({int(r['date'][:4]) for r in ws}); wst = {}
for r in ws:
    s = wst.setdefault(r['state'] + '|' + r['sex'], [None] * len(wy)); s[wy.index(int(r['date'][:4]))] = num(r['wages_median'])
pack['wsex'] = {'years': wy, 'series': wst}
pack['files']['wages_state'] = sha('wages_state')

# state real GDP by sector
gs = [r for r in rows('gdp_state_real_supply') if r['series'] == 'abs']; gy = sorted({int(r['date'][:4]) for r in gs}); gst = {}
for r in gs:
    s = gst.setdefault(r['state'] + '|' + r['sector'], [None] * len(gy)); s[gy.index(int(r['date'][:4]))] = num(r['value'])
pack['sgdp'] = {'years': gy, 'series': gst}
pack['files']['gdp_state_real_supply'] = sha('gdp_state_real_supply')

pack['version'] = hashlib.sha256(json.dumps(pack['files'], sort_keys=True).encode()).hexdigest()[:12]
blob = '<!--K3DATA--><script type="application/json" id="k3-data">' + json.dumps(pack, separators=(',', ':')) + '</script><!--/K3DATA-->'
html = open(HTML, encoding='utf-8').read()
if '<!--K3DATA-->' in html:
    html = re.sub(r'<!--K3DATA-->.*?<!--/K3DATA-->', lambda m: blob, html, flags=re.S)
else:
    html = html.replace('<script type="application/json" id="m6-data">', blob + '\n<script type="application/json" id="m6-data">', 1)
open(HTML, 'w', encoding='utf-8').write(html)
print('data pack version', pack['version'], 'size', len(blob) // 1024, 'KB')
