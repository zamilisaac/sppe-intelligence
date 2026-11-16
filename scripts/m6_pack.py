"""Build the #m6-data pack (GDP, wages, labour force, CPI, national productivity)
from the DOSM CSV files in dosm/. Standard library only.

The pack layout and number formatting reproduce the pack that was baked into
website/index.html on 14 Nov 2026 by a session-only script. build_site_data.py
--verify proves the round trip on the committed files.

Number formatting rules (found by round-tripping the committed pack):
- a value read from a CSV is rounded to 1 decimal and written as an integer when
  it is whole (e.g. "82.0" -> 82, "131243.04" -> 131243);
- a value the builder computes (sums, rates, averages) keeps its float form
  (e.g. 435.0, 100.0);
- national GDP for p0-p5 is copied from productivity_annual as written there.
"""
import csv
import os

STATE_ID = {
    'Johor': 'johor', 'Kedah': 'kedah', 'Kelantan': 'kelantan', 'Melaka': 'melaka',
    'Negeri Sembilan': 'nsembilan', 'Pahang': 'pahang', 'Perak': 'perak', 'Perlis': 'perlis',
    'Pulau Pinang': 'ppinang', 'Sabah': 'sabah', 'Sarawak': 'sarawak', 'Selangor': 'selangor',
    'Terengganu': 'terengganu', 'W.P. Kuala Lumpur': 'kl', 'W.P. Labuan': 'labuan',
    'W.P. Putrajaya': 'putrajaya', 'Supra': 'supra', 'Malaysia': 'national',
}


def rows(d, name):
    with open(os.path.join(d, name + '.csv'), encoding='utf-8', newline='') as f:
        return list(csv.DictReader(f))


def fnum(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def clean(v, nd=1):
    """CSV value -> rounded number, integer when whole."""
    v = fnum(v) if not isinstance(v, (int, float)) else v
    if v is None:
        return None
    v = round(v, nd)
    return int(v) if v == int(v) else v


def yr(r):
    return int(r['date'][:4])


def ordered(seq):
    out = []
    for x in seq:
        if x not in out:
            out.append(x)
    return out


def build_gdp(d):
    gs = [r for r in rows(d, 'gdp_state_real_supply') if r['series'] == 'abs']
    years = sorted({yr(r) for r in gs})
    secs = ordered(r['sector'] for r in gs)
    states = ordered(STATE_ID[r['state']] for r in gs)
    v = {s: {st: [None] * len(years) for st in states} for s in secs}
    for r in gs:
        v[r['sector']][STATE_ID[r['state']]][years.index(yr(r))] = clean(r['value'])
    pa = [r for r in rows(d, 'productivity_annual') if r['series'] == 'abs']
    for s in secs:
        nat = [None] * len(years)
        src = {yr(r): r for r in pa if r['sector'] == s}
        for i, y in enumerate(years):
            if s in ('p0', 'p1', 'p2', 'p3', 'p4', 'p5'):
                nat[i] = fnum(src[y]['gdp']) if y in src else None
            else:  # no national figure in productivity_annual: sum of the rounded state values (incl. supra)
                vals = [v[s][st][i] for st in states if v[s][st][i] is not None]
                nat[i] = round(float(sum(vals)), 1) if vals else None
        v[s]['national'] = nat
    return {'years': years, 'v': v}


def wage_block(rr, key, keys, years, sexcol='sex'):
    out = {}
    for k in keys:
        out[k] = {'median': [None] * len(years), 'mean': [None] * len(years), 'rec': [None] * len(years)}
    for r in rr:
        if r[sexcol] != 'both' or r[key] not in out:
            continue
        i = years.index(yr(r))
        o = out[r[key]]
        o['median'][i], o['mean'][i], o['rec'][i] = clean(r['wages_median']), clean(r['wages_mean']), clean(r['recipients'])
    return out


def build_wages(d):
    ws = rows(d, 'wages_state')
    years = sorted({yr(r) for r in ws})
    states = ordered(STATE_ID[r['state']] for r in ws)
    w = {'years': years}
    for col, src in (('median', 'wages_median'), ('mean', 'wages_mean'), ('rec', 'recipients')):
        w[col] = {st: [None] * len(years) for st in states}
        for r in ws:
            if r['sex'] == 'both':
                w[col][STATE_ID[r['state']]][years.index(yr(r))] = clean(r[src])
    w['sex'] = {s: [None] * len(years) for s in ('male', 'female')}
    for r in ws:
        if r['state'] == 'Malaysia' and r['sex'] in w['sex']:
            w['sex'][r['sex']][years.index(yr(r))] = clean(r['wages_median'])
    out = {'wage': w}
    for pk, name, col in (('wsec', 'wages_sector', 'sector'), ('wind', 'wages_industry', 'section'),
                          ('wedu', 'wages_education', 'education'), ('wskill', 'wages_skill', 'skill')):
        rr = rows(d, name)
        keys = ordered(r[col] for r in rr)
        if pk != 'wsec':
            keys = [k for k in keys if k != 'overall']
        out[pk] = wage_block(rr, col, keys, sorted({yr(r) for r in rr}))
    return out


def build_formal(d, month=6):
    fs = rows(d, 'formal_wages_state')
    years = sorted({yr(r) for r in fs if int(r['date'][5:7]) == month})
    states = ordered(STATE_ID[r['state']] for r in fs)
    f = {'years': years, 'month': month,
         'median': {st: [None] * len(years) for st in states},
         'emp': {st: [None] * len(years) for st in states}}
    for r in fs:
        if int(r['date'][5:7]) != month:
            continue
        i = years.index(yr(r)); st = STATE_ID[r['state']]
        f['median'][st][i], f['emp'][st][i] = clean(r['wages_median']), clean(r['employees'])
    fm = rows(d, 'formal_wages_msic')
    secs = [s for s in ordered(r['sector'] for r in fm) if s != 'unclassified']
    f['sector'] = {s: {'median': [None] * len(years), 'emp': [None] * len(years)} for s in secs}
    for r in fm:
        if int(r['date'][5:7]) != month or r['industry'] != 'overall' or r['sector'] not in f['sector'] or yr(r) not in years:
            continue
        i = years.index(yr(r))
        f['sector'][r['sector']]['median'][i], f['sector'][r['sector']]['emp'][i] = clean(r['wages_median']), clean(r['employees'])
    fb = rows(d, 'formal_wages_band')
    bands = ordered(r['band'] for r in fb)
    f['band'] = {b: [None] * len(years) for b in bands}
    for r in fb:
        if int(r['date'][5:7]) == month and yr(r) in years:
            f['band'][r['band']][years.index(yr(r))] = clean(r['employees'])
    return f


def build_lfs(d, first_year=2010):
    lf = [r for r in rows(d, 'lfs_state_sex') if yr(r) >= first_year]
    years = sorted({yr(r) for r in lf})
    states = ordered(STATE_ID[r['state']] for r in lf)
    cols = (('lf', 'lf', 'both'), ('emp', 'lf_employed', 'both'), ('unemp', 'lf_unemployed', 'both'),
            ('out', 'lf_outside', 'both'), ('prate', 'p_rate', 'both'), ('urate', 'u_rate', 'both'),
            ('fprate', 'p_rate', 'female'), ('femp', 'lf_employed', 'female'))
    o = {'years': years}
    for k, src, sex in cols:
        o[k] = {st: [None] * len(years) for st in states}
        for r in lf:
            if r['sex'] == sex:
                o[k][STATE_ID[r['state']]][years.index(yr(r))] = clean(r[src])
    raw = {}
    for r in lf:
        raw[(STATE_ID[r['state']], r['sex'], yr(r))] = r

    def tot(sex, src, y):
        vals = [fnum(raw[(st, sex, y)][src]) if (st, sex, y) in raw else None for st in states]
        return None if any(v is None for v in vals) else sum(vals)

    for k in ('lf', 'emp', 'unemp', 'out', 'prate', 'urate', 'fprate', 'femp'):
        o[k]['national'] = [None] * len(years)
    for i, y in enumerate(years):
        L, E, U, O = (tot('both', c, y) for c in ('lf', 'lf_employed', 'lf_unemployed', 'lf_outside'))
        FL, FE, FO = (tot('female', c, y) for c in ('lf', 'lf_employed', 'lf_outside'))
        if None in (L, E, U, O):
            continue
        o['lf']['national'][i] = round(L, 1)
        o['emp']['national'][i] = round(E, 1)
        o['unemp']['national'][i] = round(U, 1)
        o['out']['national'][i] = round(O, 1)
        o['prate']['national'][i] = round(L / (L + O) * 100, 1)
        o['urate']['national'][i] = round(U / L * 100, 1)
        if None not in (FL, FE, FO):
            o['fprate']['national'][i] = round(FL / (FL + FO) * 100, 1)
            o['femp']['national'][i] = round(FE, 1)
    return o


def build_cpi(d):
    acc = {}
    for r in rows(d, 'cpi_2d_state'):
        v = fnum(r['index'])
        if r['division'] != 'overall' or v is None:
            continue
        acc.setdefault((STATE_ID[r['state']], yr(r)), []).append(v)
    years = sorted({y for (st, y), v in acc.items() if len(v) == 12})
    states = sorted({st for st, y in acc})
    out = {st: [None] * len(years) for st in states}
    for (st, y), v in acc.items():
        if y in years and len(v) == 12:
            out[st][years.index(y)] = round(sum(v) / 12, 2)
    return {'years': years, 'v': out}


def build_natprod(d):
    pa = [r for r in rows(d, 'productivity_annual') if r['series'] == 'abs']
    years = sorted({yr(r) for r in pa})
    v = {}
    for s in ('p0', 'p1', 'p2', 'p3', 'p4', 'p5'):
        v[s] = {k: [None] * len(years) for k in ('gdp', 'emp', 'hours', 'ph')}
        for r in pa:
            if r['sector'] == s:
                i = years.index(yr(r))
                for k, src in (('gdp', 'gdp'), ('emp', 'employment'), ('hours', 'hours'), ('ph', 'output_hour')):
                    v[s][k][i] = clean(r[src])
    return {'years': years, 'v': v}


def build(d):
    pack = {'gdp': build_gdp(d)}
    pack.update(build_wages(d))
    pack['formal'] = build_formal(d)
    pack['lfs'] = build_lfs(d)
    pack['cpi'] = build_cpi(d)
    pack['natprod'] = build_natprod(d)
    return pack
