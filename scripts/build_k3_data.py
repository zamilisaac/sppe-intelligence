"""Build the data pack used by the shared calculation engine (Makmal Produktiviti / reports).

Reads the DOSM (OpenDOSM) CSV files in dosm/ and writes a compact JSON block into
website/index.html between the markers <!--K3DATA--> ... <!--/K3DATA-->.
Raw files are never modified. Run again after new DOSM files are added:

    python3 scripts/build_k3_data.py

build_site_data.py imports build_pack() and rebuilds this pack together with #m6-data.
"""
import csv, hashlib, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'dosm')
HTML = os.path.join(ROOT, 'website', 'index.html')


def rows(name, d=None):
    with open(os.path.join(d or D, name + '.csv'), encoding='utf-8') as f:
        return list(csv.DictReader(f))


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def sha(name, d=None):
    with open(os.path.join(d or D, name + '.csv'), 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()[:12]


def build_pack(d=None):
    """Return the k3 pack dict built from the CSV files in d (default dosm/)."""
    d = d or D
    pack = {'files': {}}
    # national GDP (constant 2015 prices), employment, hours by sector: productivity_annual
    pa = [r for r in rows('productivity_annual', d) if r['series'] == 'abs']
    years = sorted({int(r['date'][:4]) for r in pa})
    sec = {}
    for r in pa:
        s = sec.setdefault(r['sector'], {'gdp': [None] * len(years), 'emp': [None] * len(years), 'hours': [None] * len(years)})
        i = years.index(int(r['date'][:4]))
        s['gdp'][i], s['emp'][i], s['hours'][i] = num(r['gdp']), num(r['employment']), num(r['hours'])
    pack['nat'] = {'years': years, 'sectors': sec}
    pack['files']['productivity_annual'] = sha('productivity_annual', d)

    # national quarterly productivity (constant 2015 prices): productivity_qtr. Levels are per quarter
    # (RM per employed person in the quarter, RM per hour); growth is year on year in %, as published by DOSM.
    if os.path.exists(os.path.join(d, 'productivity_qtr.csv')):
        pq = rows('productivity_qtr', d)
        qd = sorted({r['date'][:7] for r in pq})
        q = {}
        for r in pq:
            s = q.setdefault(r['sector'], {'lp': [None] * len(qd), 'lph': [None] * len(qd), 'g': [None] * len(qd), 'gh': [None] * len(qd)})
            i = qd.index(r['date'][:7])
            if r['series'] == 'abs':
                s['lp'][i], s['lph'][i] = num(r['output_employment']), num(r['output_hour'])
            elif r['series'] == 'growth_yoy':
                s['g'][i], s['gh'][i] = num(r['output_employment']), num(r['output_hour'])
        pack['natq'] = {'dates': qd, 'sectors': q}
        pack['files']['productivity_qtr'] = sha('productivity_qtr', d)

    # 14 priority sub-sectors (annual). OpenDOSM codes special.01-14 carry no names; the names come from DOSM
    # "Jadual Produktiviti Buruh" tables 3a/4a, matched by value (every code matched exactly one row).
    P14 = {'special.01': ('Agro-makanan', 'Agro-food'), 'special.02': ('Kimia dan produk kimia', 'Chemicals and chemical products'),
           'special.03': ('Farmaseutikal', 'Pharmaceutical'), 'special.04': ('Elektrik dan elektronik', 'Electrical and electronics'),
           'special.05': ('Mesin dan peralatan', 'Machinery and equipment'), 'special.06': ('Automotif', 'Automotive'),
           'special.07': ('Aeroangkasa', 'Aerospace'), 'special.08': ('Pembinaan & alam bina', 'Construction & built environment'),
           'special.09': ('Peruncitan dan makanan & minuman', 'Retail and food & beverages'), 'special.10': ('Logistik', 'Logistics'),
           'special.11': ('Pelancongan', 'Tourism'), 'special.12': ('Teknologi, maklumat dan komunikasi (ICT)', 'Information, communication and technology (ICT)'),
           'special.13': ('Perkhidmatan profesional', 'Professional services'), 'special.14': ('Penjagaan kesihatan swasta', 'Private healthcare')}
    if os.path.exists(os.path.join(d, 'productivity_annual_p14.csv')):
        pp = [r for r in rows('productivity_annual_p14', d) if r['series'] == 'abs']
        py = sorted({int(r['date'][:4]) for r in pp}); sub = {}
        for r in pp:
            if r['subsector'] not in P14:
                continue
            x = sub.setdefault(r['subsector'], {'bm': P14[r['subsector']][0], 'en': P14[r['subsector']][1], 'lp': [None] * len(py), 'lph': [None] * len(py)})
            i = py.index(int(r['date'][:4])); x['lp'][i], x['lph'][i] = num(r['output_employment']), num(r['output_hour'])
        pack['p14'] = {'years': py, 'subs': sub}
        pack['files']['productivity_annual_p14'] = sha('productivity_annual_p14', d)

    # labour force by state, quarterly (latest 12 quarters) and national monthly (latest 25 months)
    if os.path.exists(os.path.join(d, 'lfs_qtr_state.csv')):
        lq = rows('lfs_qtr_state', d); ld = sorted({r['date'][:7] for r in lq})[-12:]; ls = {}
        for r in lq:
            if r['date'][:7] in ld:
                x = ls.setdefault(r['state'], {k: [None] * len(ld) for k in ('lf', 'emp', 'unemp', 'prate', 'urate')})
                i = ld.index(r['date'][:7])
                x['lf'][i], x['emp'][i], x['unemp'][i] = num(r['lf']), num(r['lf_employed']), num(r['lf_unemployed'])
                x['prate'][i], x['urate'][i] = num(r['p_rate']), num(r['u_rate'])
        pack['lfsq'] = {'dates': ld, 'states': ls}
        pack['files']['lfs_qtr_state'] = sha('lfs_qtr_state', d)
    if os.path.exists(os.path.join(d, 'lfs_month.csv')):
        lm = sorted(rows('lfs_month', d), key=lambda r: r['date'])[-25:]
        pack['lfsm'] = {'dates': [r['date'][:7] for r in lm], 'lf': [num(r['lf']) for r in lm], 'emp': [num(r['lf_employed']) for r in lm],
                        'unemp': [num(r['lf_unemployed']) for r in lm], 'prate': [num(r['p_rate']) for r in lm], 'urate': [num(r['u_rate']) for r in lm]}
        pack['files']['lfs_month'] = sha('lfs_month', d)

    # formal sector wages (monthly): by state, by wage band, by sector
    fs = rows('formal_wages_state', d)
    dates = sorted({r['date'][:7] for r in fs})
    st = {}
    for r in fs:
        s = st.setdefault(r['state'], {'med': [None] * len(dates), 'emp': [None] * len(dates)})
        i = dates.index(r['date'][:7]); s['med'][i], s['emp'][i] = num(r['wages_median']), num(r['employees'])
    pack['formal'] = {'dates': dates, 'states': st}
    fb = rows('formal_wages_band', d); bd = sorted({r['date'][:7] for r in fb}); bands = {}
    for r in fb:
        b = bands.setdefault(r['band'], [None] * len(bd)); b[bd.index(r['date'][:7])] = num(r['employees'])
    pack['band'] = {'dates': bd, 'bands': bands}
    fm = [r for r in rows('formal_wages_msic', d) if r['industry'] in ('overall', '')]
    md = sorted({r['date'][:7] for r in fm}); ms = {}
    for r in fm:
        s = ms.setdefault(r['sector'], {'med': [None] * len(md), 'emp': [None] * len(md)})
        i = md.index(r['date'][:7]); s['med'][i], s['emp'][i] = num(r['wages_median']), num(r['employees'])
    pack['msic'] = {'dates': md, 'sectors': ms}
    for n in ('formal_wages_state', 'formal_wages_band', 'formal_wages_msic'):
        pack['files'][n] = sha(n, d)

    # labour force by state and sex (annual)
    lf = rows('lfs_state_sex', d); ly = sorted({int(r['date'][:4]) for r in lf}); lfs = {}
    for r in lf:
        k = r['state'] + '|' + r['sex']
        s = lfs.setdefault(k, {c: [None] * len(ly) for c in ('lf', 'emp', 'unemp', 'out', 'prate', 'urate', 'ep')})
        i = ly.index(int(r['date'][:4]))
        for c, src in (('lf', 'lf'), ('emp', 'lf_employed'), ('unemp', 'lf_unemployed'), ('out', 'lf_outside'), ('prate', 'p_rate'), ('urate', 'u_rate'), ('ep', 'ep_ratio')):
            s[c][i] = num(r[src])
    pack['lfs'] = {'years': ly, 'series': lfs}
    pack['files']['lfs_state_sex'] = sha('lfs_state_sex', d)

    # survey wages by state and sex (annual)
    ws = rows('wages_state', d); wy = sorted({int(r['date'][:4]) for r in ws}); wst = {}
    for r in ws:
        s = wst.setdefault(r['state'] + '|' + r['sex'], [None] * len(wy)); s[wy.index(int(r['date'][:4]))] = num(r['wages_median'])
    pack['wsex'] = {'years': wy, 'series': wst}
    pack['files']['wages_state'] = sha('wages_state', d)

    # state real GDP by sector
    gs = [r for r in rows('gdp_state_real_supply', d) if r['series'] == 'abs']; gy = sorted({int(r['date'][:4]) for r in gs}); gst = {}
    for r in gs:
        s = gst.setdefault(r['state'] + '|' + r['sector'], [None] * len(gy)); s[gy.index(int(r['date'][:4]))] = num(r['value'])
    pack['sgdp'] = {'years': gy, 'series': gst}
    pack['files']['gdp_state_real_supply'] = sha('gdp_state_real_supply', d)

    # household income survey by state (HIES): income, expenditure, Gini, poverty
    hs = rows('hies_state', d); hy = sorted({int(r['date'][:4]) for r in hs}); hst = {}
    for r in hs:
        s = hst.setdefault(r['state'], {c: [None] * len(hy) for c in ('income_median', 'income_mean', 'expenditure_mean', 'gini', 'poverty')})
        i = hy.index(int(r['date'][:4]))
        for c in s: s[c][i] = num(r[c])
    pack['hies'] = {'years': hy, 'states': hst}
    pack['files']['hies_state'] = sha('hies_state', d)

    # HIES income percentiles by state: thresholds (maximum of a percentile group) and group means
    hp = rows('hies_state_percentile', d); hpy = sorted({int(r['date'][:4]) for r in hp}); hpd = {}
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
    pack['files']['hies_state_percentile'] = sha('hies_state_percentile', d)

    # state CPI: annual average index by division, complete calendar years only
    cp = rows('cpi_2d_state', d); acc = {}
    for r in cp:
        v = num(r['index'])
        if v is None: continue
        k = (r['state'], r['division'], int(r['date'][:4])); a0 = acc.setdefault(k, []); a0.append(v)
    cyears = sorted({k[2] for k, v in acc.items() if len(v) == 12}); cst = {}
    for (st, dv, y), v in acc.items():
        if len(v) != 12 or y not in cyears: continue
        cst.setdefault(st, {}).setdefault(dv, [None] * len(cyears))[cyears.index(y)] = round(sum(v) / 12, 4)
    pack['cpi'] = {'years': cyears, 'states': cst}
    pack['files']['cpi_2d_state'] = sha('cpi_2d_state', d)

    # monthly state inflation (overall CPI, year on year), last 13 months; used by the monthly highlights newsletter
    inf = [r for r in rows('cpi_2d_state_inflation', d) if r['division'] == 'overall']
    idates = sorted({r['date'][:7] for r in inf if num(r['inflation_yoy']) is not None})[-13:]; ist = {}
    for r in inf:
        if r['date'][:7] in idates:
            ist.setdefault(r['state'], [None] * len(idates))[idates.index(r['date'][:7])] = num(r['inflation_yoy'])
    pack['infl'] = {'dates': idates, 'states': ist}
    pack['files']['cpi_2d_state_inflation'] = sha('cpi_2d_state_inflation', d)

    # survey wages (national): median by education, skill and sector, by sex
    ws_ = {}
    for name, col in (('wages_education', 'education'), ('wages_skill', 'skill'), ('wages_sector', 'sector')):
        rr = rows(name, d); yy = sorted({int(r['date'][:4]) for r in rr}); o = {}
        for r in rr:
            o.setdefault(r[col], {}).setdefault(r['sex'], [None] * len(yy))[yy.index(int(r['date'][:4]))] = num(r['wages_median'])
        ws_[col] = {'years': yy, 'v': o}; pack['files'][name] = sha(name, d)
    pack['wsurv'] = ws_

    pack['version'] = hashlib.sha256(json.dumps(pack['files'], sort_keys=True).encode()).hexdigest()[:12]
    return pack


def blob_of(pack):
    return '<!--K3DATA--><script type="application/json" id="k3-data">' + json.dumps(pack, separators=(',', ':')) + '</script><!--/K3DATA-->'


def main():
    pack = build_pack()
    blob = blob_of(pack)
    html = open(HTML, encoding='utf-8').read()
    if '<!--K3DATA-->' in html:
        html = re.sub(r'<!--K3DATA-->.*?<!--/K3DATA-->', lambda m: blob, html, flags=re.S)
    else:
        html = html.replace('<script type="application/json" id="m6-data">', blob + '\n<script type="application/json" id="m6-data">', 1)
    open(HTML, 'w', encoding='utf-8').write(html)
    print('data pack version', pack['version'], 'size', len(blob) // 1024, 'KB')


if __name__ == '__main__':
    main()
