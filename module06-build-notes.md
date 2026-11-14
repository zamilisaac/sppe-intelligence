# Module 06: Smart Report Builder — build notes (14 Nov 2026)

Published into the dashboard artifact as version `1794599171-021d` (previous: `1793946426-bccf`, version 4). Everything from version 4 is unchanged; Module 06 is additive.

## What was added to the page
- `<section id="m6">` at the end of `main#dash`, CSS block `.m6*`, a data pack `<script type="application/json" id="m6-data">` (45 KB), and three script blocks inserted before `boot()`:
  - `M6E` (engine): topics, indicators, analysis, composer, validation.
  - `M6R` (renderer): canvas charts + a dependency-free .docx writer (own zip, no external library).
  - `M6` (UI): the 5-step builder. `renderAll()` now ends with `M6.render()`.
- No new capability and no new CDN library. Download uses the existing `downloads` capability; on static hosting (no `window.claude`) it falls back to a normal browser download.

## Report model
- Same block model as `buildPdf`: h1, h3, p, bullets, callout, chart, table, quadtable. New: `h0` (chapter, Word Heading 1), chart kinds `stack`, `xy`, `tiles`; charts carry `src` (source) and `ins` (insight).
- By Topic + Labour Productivity + Malaysia or one state reuses `nationalReport()` / `stateReport()` unchanged, so the original report is preserved as a Word document.
- Other topics use `metricSec()` (level sentence, state ranking chart, trend chart, state table) so wording and visuals stay consistent.
- Word design copies the PDF: A4, 18 mm margins, Arial, ink/red/stone palette, cover band with 3 KPI tiles, logo header, footer with PAGE / NUMPAGES fields, red-bar headings (real Heading styles), native tables, charts as PNG at about 234 dpi.
- Length: Brief / Standard / Detailed via block tags (`_lv`). Detailed + tables adds a data annex with the numbers behind each chart.
- Validation before download: 8 checks (topics in/out, no broken values, charts have data, sources present, table columns, methodology, file parts). A failed check blocks the download.

## Data decisions
- Data pack is baked into the page (built by `build_data.py` from the project CSVs). No Drive auto-update for the new topics yet. Productivity still comes from the Drive snapshot.
- GDP: RM million, constant 2015 prices. National total and main sectors from `productivity_annual` (state sum differs by 0.2% in 2022 for services); state values from `gdp_state_real_supply`. Putrajaya exists only from 2023. Supra kept out of rankings.
- Wages: survey median/mean by state; sector, industry, skill, education are national only. Formal wages: June of each year (same-month comparison), latest June 2026.
- Real wages: median wage / annual average state CPI. No national real wage (no national CPI in the file).
- Labour force: national = sum of 16 states; national rates recalculated from the sums. 2010 is incomplete, so trends start 2011.
- Integrated: latest common year (2025); scorecard ranks 7 indicators, top 5 = strength, bottom 5 = challenge; sector opportunity = specialisation index x productivity vs national.
- Left out: `productivity_annual_p14` (sub-sector codes have no names), household income (HIES), wage bands.
- DOSM Labour Market Review Q3 2025 (PDF) used only as a cross-check and for definitions.

## Testing done
- 12 configurations generated in headless Chromium (all modes, BM/EN, national/state/compare, brief/standard/detailed, period, sector subset, visuals off), all 8 checks passed, files opened with python-docx and LibreOffice, pages reviewed as images. Figures re-derived independently in Python from the CSVs matched.
- Not tested: opening in Microsoft Word itself, and the download prompt inside claude.ai.

## Not done yet
- Drive-fed updates for GDP, wages, labour data.
- Cloudflare static zip has not been rebuilt with Module 06.
- Editable native Word chart objects (charts are images; data annex gives the numbers).
