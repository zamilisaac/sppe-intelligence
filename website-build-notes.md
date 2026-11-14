# Website (multi-page) build notes — 14 Nov 2026

The dashboard artifact is now a website. Latest version `1794617910-bb50` (10-year timeline added). Before that: `1794616060-d60f` (website), `1794599171-021d` (Module 06). The user asked to "build first, adjust later"; design calls below were mine and are open to change.

## Pages (top menu, plain hash routes)
| Page | Hash | Content |
|---|---|---|
| Home | `#home` (default) | 4 headline tiles; metric switch (productivity, real GDP, median wage, participation, unemployment); **timeline row**: map with play button + year slider + big year label, beside a sliding state-ranking race; **second row**: trend line for the selected state vs Malaysia over all years, beside the state snapshot (6 indicators with rank); 6 topic cards; data coverage table |
| Labour Productivity | `#productivity` | The original dashboard plus a page heading. Map card now has its own play button, year slider and big year label (added 14 Nov after the user missed the v1 timeline). `#<stateid>` still opens this page with that state |
| GDP & Economic Structure | `#gdp` | Metrics: real GDP, GDP growth. Extra: sector share over time (stacked), sector share vs Malaysia with specialisation index |
| Salaries & Wages | `#wages` | Metrics: median, mean, median growth, formal sector (June). Extra: nominal vs real wage; national wage by sector / industry / skill / education |
| Labour Market | `#labour` | Metrics: participation, unemployment, female participation, employed. Extra: participation all vs women; profile table vs Malaysia |
| Integrated Economic Intelligence | `#integrated` | Productivity-wage quadrant, state scorecard, GDP vs employment growth, sector opportunity screen, all-states scorecard heat table |
| Reports | `#reports` | Smart Report Builder (Module 06), unchanged |

Artifact rule: only a plain `#name` survives in the URL, so no `#/path` routes.

## 10-year timeline (added 14 Nov, `patch_timeline.py`)
- User asked why the v1 "10 year progress" timeline (map + graph) was gone. It was never removed: it sat on the Productivity page under the map, in the ranking card, so the map and the race could not be seen together while playing.
- Productivity page: second player (`#btn-play-map`, `#map-slider`, `#map-ticks`) and `#map-yr` on the map card. Both players share `S.year` / `S.playing`; `playIcons()` keeps both buttons in step. Map tooltip now measured from `.card` because the map sits in `.map-wrap`.
- Home: `tlPlayer`, `fillMap` (recolours in place so fills animate), `drawRace` (same `.race/.rrow` classes as the productivity race, class `hrace`), `raceCard`, `homeYear`, `toggleHome`/`stopHome`. Year stored in `U.home.y`. Play stops when the metric changes or the page is left. Full `drawMap` runs after play stops or 0.9 s after a manual change, so tooltips show the right year. Years follow each metric (productivity/GDP 2015–2025, median wage 2010–2025, labour 2011–2025).
- `mapCard(m, Y, ctl, tl)` takes an optional player; other topic pages unchanged.
- Tested (headless Chromium, desktop + mobile, BM + EN): play/pause, slider, ticks, both buttons in sync, map colours change, race order matches the data for the year shown, play finishes at the last year, leaving the page stops play, all 5 home metrics render without NaN or overflow.

## How it is built
- One file, same artifact. Additions: `<nav id="nav">`, page wrappers `div.pg#pg-<id>` inside `main#dash` (original sections wrapped in `#pg-prod`, builder in `#pg-reports`), a CSS block ("Site") and one script module `SITE` inserted before `boot()`.
- Hooks into existing code: `renderAll()` calls `SITE.chrome()` first and `SITE.render()` last; `boot()` calls `SITE.init()`; `document.title` set by `SITE.chrome()`; `M6E` also exports `IND`.
- `SITE.MET(id)` is the single definition of each indicator (label, unit, years, getter, format, map colour scale). Map, ranking, race, trend and profile all read from it. `SITE.INTG()` repeats the report engine's integrated rules.
- Map colour: `ratio`/`diff` = diverging around Malaysia; `seq` = light to red for size measures (GDP level, employed).
- Data: GDP, wages, labour, CPI from the baked-in `#m6-data` pack; productivity from the Drive snapshot.
- Build files are session only (patch scripts applied to the previous artifact HTML).

## Cloudflare
See `cloudflare-static-export.md`. Latest zip `laman-web-produktiviti-negeri-cloudflare-v2.zip` includes the timeline.

## Not done yet
- Drive-fed updates for GDP, wages, labour data (still fixed data).
- Header title is still "Papan Pemuka Produktiviti Negeri"; only the tagline changes off the productivity page.
- Home "data coverage" table says productivity updates from Google Drive, which is not true on Cloudflare.
- Household income (HIES), wage bands and the 14 sub-sector productivity file are still unused.
- Not tested inside claude.ai itself (owner Drive update flow, download prompt).
