"""Convert the DOSM quarterly labour productivity tables (Excel) into the OpenDOSM productivity_qtr.csv format.

DOSM publishes "Jadual Produktiviti Buruh Suku ..." on www.dosm.gov.my on release day, often days before the
OpenDOSM file (storage.dosm.gov.my/labour/productivity_qtr.csv) is refreshed. This script reads the official tables
and writes the same columns, sector codes and units as OpenDOSM, so the existing validation and site build work
unchanged:

  series      abs | growth_yoy
  sector      p0 (Malaysia), p1..p5, p3.1..p3.8, p5.1..p5.8
  date        YYYY-MM-01 (first month of the quarter)
  gdp         RM million, constant 2015 prices       Jadual 8a / 8b
  hours       million hours                          Jadual 10a / 10b
  employment  '000 persons                           Jadual 12a / 12b
  output_hour       RM per hour                      Jadual 5a / 5b
  output_employment RM per employed person (quarter) Jadual 6a / 6b

Values are copied, never computed or estimated. A cell that is blank in the Excel file is written blank.

Usage
  python3 scripts/dosm_jadual_produktiviti.py TABLES.xlsx OUT.csv [--compare dosm/productivity_qtr.csv]
Needs openpyxl.
"""
import argparse
import csv
import re
import sys

import openpyxl

COLS = [('gdp', '8'), ('hours', '10'), ('employment', '12'), ('output_hour', '5'), ('output_employment', '6')]
TOTAL = re.compile(r'^(Produktiviti buruh|KDNK pada harga pembeli|Jumlah jam bekerja|Penduduk (be|pe)kerja)', re.I)  # 12b says 'pekerja'
QUARTER = {'I': '01', 'L': '01', 'II': '04', 'III': '07', 'IV': '10'}


def sheet(wb, table):
    for n in wb.sheetnames:
        if re.fullmatch(r'Jadual\s*' + re.escape(table) + r'\s*', n, re.I):
            return wb[n]
    raise SystemExit(f'Sheet "Jadual {table}" not found. Sheets: {wb.sheetnames}')


def read(ws):
    """Return {sector_code: {date: value}} from one quarterly table."""
    rows = list(ws.iter_rows(values_only=True))
    hdr = next(i for i, r in enumerate(rows) if any(isinstance(c, int) and 2000 < c < 2100 for c in r))
    years, quarters = rows[hdr], rows[hdr + 1]
    dates, year = {}, None
    for j in range(len(years)):
        if isinstance(years[j], int) and 2000 < years[j] < 2100:
            year = years[j]
        q = str(quarters[j]).strip().upper() if j < len(quarters) and quarters[j] is not None else ''
        if year and q in QUARTER:
            dates[j] = f'{year}-{QUARTER[q]}-01'
    out = {}
    for r in rows[hdr + 2:]:
        code = None
        for c in r[1:3]:
            if isinstance(c, str) and re.fullmatch(r'\d+(\.\d+)?\.?', c.strip()):
                code = 'p' + c.strip().rstrip('.')
                break
        if code is None and any(isinstance(c, str) and TOTAL.match(c.strip()) for c in r[1:4]):
            code = 'p0'
        if code is None:
            continue
        vals = {d: r[j] for j, d in dates.items() if j < len(r) and isinstance(r[j], (int, float))}
        if vals:
            out[code] = vals
    return out


def convert(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    data = {}
    for series, suffix in (('abs', 'a'), ('growth_yoy', 'b')):
        for col, t in COLS:
            for sec, vals in read(sheet(wb, t + suffix)).items():
                for d, v in vals.items():
                    data.setdefault((series, sec, d), {})[col] = round(float(v), 4)
    out = []
    order = lambda s: [int(x) for x in s[1:].split('.')]
    for (series, sec, d) in sorted(data, key=lambda k: (k[0] != 'abs', k[2], order(k[1]))):
        row = {'series': series, 'sector': sec, 'date': d}
        row.update({c: data[(series, sec, d)].get(c, '') for c, _ in COLS})
        out.append(row)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('xlsx'); ap.add_argument('out'); ap.add_argument('--compare')
    a = ap.parse_args()
    rows = convert(a.xlsx)
    with open(a.out, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=['series', 'sector', 'date'] + [c for c, _ in COLS])
        w.writeheader(); w.writerows(rows)
    sectors = sorted({r['sector'] for r in rows}); dates = sorted({r['date'] for r in rows})
    print(f'{len(rows)} rows, {len(sectors)} sectors, {dates[0]} to {dates[-1]}')
    if a.compare:
        old = {(r['series'], r['sector'], r['date']): r for r in csv.DictReader(open(a.compare, encoding='utf-8'))}
        new = {(r['series'], r['sector'], r['date']): r for r in rows}
        missing = sorted(set(old) - set(new))
        diffs = []
        for k in set(old) & set(new):
            for c, _ in COLS:
                o, n = old[k][c], new[k][c]
                if o not in ('', None) and n not in ('', None) and abs(float(o) - float(n)) > max(0.6, abs(float(o)) * 0.001):
                    diffs.append((k, c, float(o), float(n)))
        print(f'compared with {a.compare}: {len(set(new) - set(old))} new rows, {len(missing)} rows missing, {len(diffs)} values revised')
        for k, c, o, n in sorted(diffs, key=lambda x: -abs(x[3] - x[2]) / max(abs(x[2]), 1))[:10]:
            print('  revised', k, c, o, '->', n)
        if missing:
            print('  missing (first 10):', missing[:10])
            sys.exit(2)


if __name__ == '__main__':
    main()
