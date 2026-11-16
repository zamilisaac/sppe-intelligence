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

# household income survey by state (HIES): income, expenditure, Gini, poverty
hs = rows('hies_state'); hy = sorted({int(r['date'][:4]) for r in hs}); hst = {}
for r in hs:
    s = hst.setdefault(r['state'], {c: [None] * len(hy) for c in ('income_median', 'income_mean', 'expenditure_mean', 'gini', 'poverty')})
    i = hy.index(int(r['date'][:4]))
    for c in s: s[c][i] = num(r[c])
pack['hies'] = {'years': hy, 'states': hst}
pack['files']['hies_state'] = sha('hies_state')

# HIES income percentiles by state: thresholds (maximum of a percentile group) and group means
hp = rows('hies_state_percentile'); hpy = sorted({int(r['date'][:4]) for r in hp}); hpd = {}
for r in hp:
    st = hpd.setdefault(r['state'], {}); yr = st.setdefault(str(int(r['date'][:4])), {'max': {}, 'mean': {}})
    if r['variable'] in ('maximum', 'mean') and num(r['income']) is not None:
        yr['max' if r['variable'] == 'maximum' else 'mean'][int(r['percentile'])] = num(r['income'])
hpo = {}
for st, ys in hpd.items():
    o = hpo.setdefault(st, {k: [None] * len(hpy) for k in ('p10', 'p40', 'p50', 'p80', 'p90', 'b40', 't20')})
    for y, v in ys.items():
        i = hpy.index(int(y)); mx, mn = v['max'], v['mean']
        for q in (10, 40, 50, 80, 90):
            o['p%d' % q][i] = mx.get(q)
        if all(k in mn for k in range(1, 41)): o['b40'][i] = sum(mn[k] for k in range(1, 41)) / 40
        if all(k in mn for k in range(81, 101)): o['t20'][i] = sum(mn[k] for k in range(81, 101)) / 20
pack['hiesp'] = {'years': hpy, 'states': hpo}
pack['files']['hies_state_percentile'] = sha('hies_state_percentile')

# state CPI: annual average index by division, complete calendar years only
cp = rows('cpi_2d_state'); acc = {}
for r in cp:
    v = num(r['index'])
    if v is None: continue
    k = (r['state'], r['division'], int(r['date'][:4])); a0 = acc.setdefault(k, []); a0.append(v)
cyears = sorted({k[2] for k, v in acc.items() if len(v) == 12}); cst = {}
for (st, dv, y), v in acc.items():
    if len(v) != 12 or y not in cyears: continue
    cst.setdefault(st, {}).setdefault(dv, [None] * len(cyears))[cyears.index(y)] = round(sum(v) / 12, 4)
pack['cpi'] = {'years': cyears, 'states': cst}
pack['files']['cpi_2d_state'] = sha('cpi_2d_state')

# survey wages (national): median by education, skill and sector, by sex
ws_ = {}
for name, col in (('wages_education', 'education'), ('wages_skill', 'skill'), ('wages_sector', 'sector')):
    rr = rows(name); yy = sorted({int(r['date'][:4]) for r in rr}); o = {}
    for r in rr:
        o.setdefault(r[col], {}).setdefault(r['sex'], [None] * len(yy))[yy.index(int(r['date'][:4]))] = num(r['wages_median'])
    ws_[col] = {'years': yy, 'v': o}; pack['files'][name] = sha(name)
pack['wsurv'] = ws_

pack['version'] = hashlib.sha256(json.dumps(pack['files'], sort_keys=True).encode()).hexdigest()[:12]
blob = '<!--K3DATA--><script type="application/json" id="k3-data">' + json.dumps(pack, separators=(',', ':')) + '</script><!--/K3DATA-->'
html = open(HTML, encoding='utf-8').read()
if '<!--K3DATA-->' in html:
    html = re.sub(r'<!--K3DATA-->.*?<!--/K3DATA-->', lambda m: blob, html, flags=re.S)
else:
    html = html.replace('<script type="application/json" id="m6-data">', blob + '\n<script type="application/json" id="m6-data">', 1)
open(HTML, 'w', encoding='utf-8').write(html)
print('data pack version', pack['version'], 'size', len(blob) // 1024, 'KB')
