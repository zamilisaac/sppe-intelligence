# Cloudflare static export

## Latest: 14 Nov 2026 (v4) — renamed to "SPPE Intelligence"

Delivered `sppe-intelligence-cloudflare.zip` (1.6 MB, 39 files), built from artifact version `1794619103-b398` (artifact also renamed "SPPE Intelligence").

Name change (user chose option 1 of four suggestions):
- Site name "SPPE Intelligence" in BM and EN: `<title>`, header h1, `I18N.title` (so `document.title` = "<page> · SPPE Intelligence").
- Tagline on every page except Labour Productivity: "Analitik Ekonomi & Produktiviti Negeri" / "State Economic & Productivity Analytics". Productivity page keeps its own tagline (value added per employed person...).
- Word report footer: "SPPE Intelligence · Perbadanan Produktiviti Malaysia · Sumber data: DOSM" (EN: "... Malaysia Productivity Corporation · Data source: DOSM"); fits one line. Same text in the jsPDF footer for newly generated PDFs. Infographic source note: "DOSM; pengiraan SPPE Intelligence".
- Messages that said "papan pemuka"/"dashboard" now say "laman"/"site".
- Topic name "Risikan Ekonomi Bersepadu / Integrated Economic Intelligence" kept as is (user can change later).
- The 34 ready-made productivity PDFs in `reports/` are unchanged (generated 6 Nov, old footer).

Rebuilt from scratch this time (earlier build scripts were session-only, and the v3 zip was not reachable):
- `data/snapshot.json` written from the artifact database document `app/snapshot` (same source file and modifiedTime as Drive), Drive/asset/folder ids removed, `reports[key] = {file, path}`. Checked: all 1,020 growth figures match their level tables.
- `reports/<id>-bm.pdf` / `<id>-en.pdf`: the 34 current assets (read_asset), matched by sha256.
- `lib/`: SheetJS 0.18.5 and jsPDF 2.5.1 from npm.
- Same 5 static patches as before (LIBS to `lib/`, boot fetches `data/snapshot.json` with new `emptyStatic` message, browser download fallback in `saveFile`, `downloadReport` uses `r.path`).
- Tested on the unzipped zip, external hosts blocked: 7 pages x BM/EN x 1360/390 px, no script errors, no overflow, no NaN/undefined, no "Papan Pemuka"/"Dashboard" text; state PDF, data .xlsx and Word report downloads all produce real files; Word report validation 8/8.

## Limits
- No Google Drive auto-update on Cloudflare. A new DOSM file needs a fresh `snapshot.json` and `reports/`, then a redeploy.
- Home "data coverage" table still says productivity updates automatically from Google Drive (only true inside Claude).
- Owner panel never shows on the static site. Opening `index.html` by double-click (file://) will not load the data.

## Earlier versions (superseded)
- v3 `laman-web-produktiviti-negeri-cloudflare-v3.zip` (artifact `1794618456-88a6`): wording "KDNK"/"GDP" instead of "KDNK benar"/"Real GDP".
- v2 (`1794617910-bb50`): 10-year timeline. v1 (`1794616060-d60f`): 7-page website.
- 13 Nov `papan-pemuka-produktiviti-negeri-cloudflare.zip`: single dashboard.
