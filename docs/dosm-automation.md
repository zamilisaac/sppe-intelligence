# Automasi data DOSM / DOSM data automation

This guide is for the site owner. No programming is needed to use it.

## Ringkasan / Overview

Every day at 09:17 (Malaysia time), GitHub checks whether DOSM has published newer data. If it has, GitHub:

1. **tells you** with a GitHub issue labelled `dosm-update` (plus Teams / e-mail if those are set up) (Stage 1);
2. **downloads and checks** the new files, rebuilds the site's numbers, and opens a **pull request** for you to review (Stage 2);
3. **after you merge it**, waits for Cloudflare to publish the site and reports back on the pull request (Stage 3).

Nothing reaches the live site until **you** approve and merge the pull request.

```
  Daily 09:17 ──► Stage 1: check OpenDOSM + watchlist ──► issue "Data DOSM baharu / New DOSM data"
                        │ newer CSV data?
                        ▼
                  Stage 2: download → validate ──FAIL──► issue with the report, no pull request
                        │ PASS / WARN
                        ▼
                  rebuild site data → branch dosm-update/YYYY-MM-DD → pull request "New DOSM data YYYY-MM-DD"
                        │ you review, approve, merge   (human step)
                        ▼
                  Stage 3: Cloudflare Pages deploys main → workflow waits for the Cloudflare check
                           → comment on the pull request → closes the dosm-update issue
                        │
                        ▼
                  You confirm "data as of" on the live site (checklist below)
```

## Apa yang dipantau / What is monitored

**Auto-ingested (15 OpenDOSM CSV files).** These are downloaded, validated and put into a pull request automatically:
`gdp_state_real_supply`, `productivity_annual`, `wages_state`, `wages_sector`, `wages_industry`, `wages_education`, `wages_skill`, `formal_wages_state`, `formal_wages_msic`, `formal_wages_band`, `lfs_state_sex`, `cpi_2d_state`, `cpi_2d_state_inflation`, `hies_state`, `hies_state_percentile`.
A dataset counts as "new" when its latest `date` is later than the copy in `dosm/`.

**Watchlist, notify only (`scripts/watchlist.json`).** These are releases you download by hand (Excel/PDF, for example the state productivity workbook, labour force statistics, the GDP flash estimate, the salaries and wages report). The check only **tells you** when they change. They are never downloaded or ingested automatically.

To add or fix a watchlist entry, edit `scripts/watchlist.json` on GitHub:
- `url`: the direct link to the file (or page) on the DOSM site. Leave `null` until you know it; the report then says "not set up".
- `local`: the file name of your copy in `dosm/` (optional).
- `known`: the fingerprint of the version you already have. The weekly report prints the current fingerprint; paste it here after you download. If the server's fingerprint is an MD5 (as on storage.dosm.gov.my), leave it `null`: the check then compares the file against your copy in `dosm/` by itself.

## Semakan data / Validation (Stage 2)

Each changed file is checked against the copy already in the repository:

| Check | Fails when |
|---|---|
| Required columns | a column the site needs is missing |
| Dates | a `date` is not in the form YYYY-MM-DD |
| Newest date | the new file's newest date is older than before |
| Row count | more than 5% fewer rows (any drop is a warning) |
| Categories | a state, sector or other category has vanished |
| Numbers | a value in a number column is not a number |
| Blanks | blank cells grow by more than 1% (any growth is a warning) |
| Duplicates | the same key (e.g. state + date) appears twice |

The report shows **PASS / WARN / FAIL** per dataset, plus rows added, the latest period and the biggest value changes (DOSM revisions to earlier figures).
- **FAIL**: no pull request. The issue shows the report; the downloaded files are attached to the workflow run as an artifact.
- **PASS / WARN**: the site data is rebuilt and a pull request is opened.

## Apa yang dibina semula / What is rebuilt

`scripts/build_site_data.py` rewrites only the site's data, never its look, pages or menus:
- the two data packs inside `website/index.html` (`#k3-data` and `#m6-data`);
- the national rows of `website/data/snapshot.json` (from `productivity_annual`);
- `website/data/data-manifest.json`, which records **"data as of"**: the latest period of every dataset.

Every run also proves that nothing outside the data packs changed (`scripts/check_page_code.py`). If anything else would change, the run stops.

**The state productivity tables are an exception.** The state rows of `snapshot.json` come from DOSM's state productivity workbook (Excel), which is notify-only. When `productivity_annual` has a newer year than the workbook, the manifest and the pull request show a warning: download the new workbook. Turning that workbook into `snapshot.json` is still a manual step.

## Laporan PDF / PDF reports

- **Generated in the browser (always up to date after a merge):** the Smart Report Builder, Insights Studio / Productivity Lab reports (Word/PDF/Excel) and the State Strategic Profile. They read the data packs and `snapshot.json` when you click download.
- **Static files (not regenerated automatically):** the 34 PDFs in `website/reports/` (national + 16 states, BM and EN, "Laporan Produktiviti Buruh 2025"). They were made by the page's own `buildPdf()` from the state productivity workbook, during the old claude.ai "update from Google Drive" step, which does not exist on Cloudflare. They change only when the state productivity workbook changes. To regenerate them: run the site in a browser with the new `snapshot.json` and call the page's `nationalReport` / `stateReport` + `buildPdf` for each state and language (in the claude.ai artifact, or with a headless-browser script), then replace the files in `website/reports/` through a normal pull request. The pull request checklist reminds you when `snapshot.json` changed.

## Menyemak dan menggabung / Reviewing and merging (your step)

1. Open the pull request "New DOSM data YYYY-MM-DD" (link in the issue and in your GitHub e-mail).
2. Read the validation report. Check the biggest value changes against the DOSM release.
3. Tick the "Reviewer approval" boxes, click **Review changes → Approve**, then **Merge pull request**.
4. Do not merge pull requests titled **[TEST]**. Those come from test runs; close them.

## Selepas gabung / After merging: confirm the live site

The live site is behind the MPC Microsoft login, so GitHub cannot read it. GitHub checks Cloudflare's own deployment check and comments on the pull request. Then confirm by hand:

1. Sign in at https://sppeintelligence.pages.dev with your MPC Microsoft account.
2. Open https://sppeintelligence.pages.dev/data/data-manifest.json (press Ctrl+F5 to skip the cache). Check that `asOf` shows the new periods listed in the pull request comment.
3. Open the page that uses the updated data (Salaries & Wages, Labour Market, GDP, Productivity Lab) and check that the newest year or month appears.
4. If something is wrong, roll back (next section).

Note: the "Data coverage" table on the Home page and the "Dataset inventory" table use fixed period labels written into the page. They do not change with new data; use `data-manifest.json` for the "data as of" dates.

## Rollback / Batal perubahan

Revert the merge commit; Cloudflare then publishes the previous data again.
- On GitHub: open the merged pull request → **Revert** button → this opens a new pull request → merge it.
- Or on a computer:

```bash
git checkout main && git pull
```

```bash
git revert -m 1 <merge-commit-sha>
```

```bash
git push origin main
```

(If main is protected, push the revert to a new branch and open a pull request instead.) The next weekly check will then find the newer DOSM data again and open a new pull request, which you can close until the problem is fixed.

## Ujian / Testing the pipeline

Actions → **Weekly DOSM data check** → **Run workflow**:
- `simulate_new_data` ticked: pretends `formal_wages_state` has one more month. The pull request and issue are marked **[TEST]**; close them, do not merge into main.
- `simulate_bad_data` ticked: the same, but with a column removed. Validation must FAIL and no pull request is opened.
- `base_branch`: leave `main`, or use a throwaway branch such as `stage3-test/base` to try the merge step safely (the deploy workflow also runs on `stage3-test/**` branches).

The scripts have their own tests: `python3 scripts/test_dosm_pipeline.py -v`.

## Tetapan yang perlu anda buat / Settings you must make

1. **Settings → Actions → General → Workflow permissions**: "Read and write permissions" and tick "Allow GitHub Actions to create and approve pull requests". Without the tick, Stage 2 cannot open the pull request (it then pushes the branch and says so in the issue).
2. **Settings → Branches → Add rule for `main`**: "Require a pull request before merging" and "Require approvals" (1). With this rule, the deployment-entry commit from Stage 3 is refused; that is expected and is reported in the run summary and the pull-request comment.
3. **Optional secrets** (Settings → Secrets and variables → Actions): `TEAMS_WEBHOOK_URL` (a Teams incoming webhook / Workflows URL), and `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `MAIL_TO` (optional `SMTP_PORT`, default 587; use 465 for SSL). If they are missing, the run skips them and says so in its summary.
4. **GitHub notifications**: github.com → Settings → Notifications → Email on for "Participating, @mentions" and "Actions" (failed workflows). The issue mentions @zamilisaac and the pull request requests your review.

## Radar Data (halaman laman web / website page)

The **Radar Data** menu (right of "Kecerdasan Ekonomi Bersepadu", also at `/radar-data`) shows this automation inside the website, together with a notification bell in the header. Everything on it comes from real records:

| Section | Source |
|---|---|
| Upcoming DOSM releases (list + calendar) | DOSM Advance Release Calendar `https://storage.dosm.gov.my/meta/arc.csv`, read live |
| New-data notifications | the monitoring log (below), GitHub issues and pull requests labelled `dosm-update`, failed workflow runs, and DOSM releases from the last / next 7 days |
| Website data status | `website/data/data-manifest.json` ("data used") against the latest period found by the daily check ("latest DOSM"), plus each OpenDOSM file's Last-Modified |
| GitHub update status (7 steps) | the newest `dosm-update/*` pull request, the monitoring log, and the Cloudflare Pages check on the merged commit |

**Monitoring log.** `scripts/radar_record.py` runs at the end of every check (Stage 1/2) and every deploy report (Stage 3) and appends what happened to `radar/log.json` on the **`radar-log`** branch (commits carry `[skip ci]`; the branch history is the audit trail). Test runs are recorded as **[UJIAN] / [TEST]** and never mark real data as new.

**API.** `functions/api/radar.js` (Cloudflare Pages Function, behind the Microsoft login) combines these sources into `/api/radar`, cached for 5 minutes.

Optional Cloudflare settings (Pages → Settings → Variables and Secrets):
- `RADAR_ADMINS`: comma-separated MPC e-mail addresses that see the administrator controls (review/approve the pull request, run a check, audit trail). Without it, nobody sees those controls; approval itself always happens on GitHub.
- `GITHUB_TOKEN`: a read-only GitHub token, only if the page reports a GitHub rate limit.

## Had / Limits

- Excel/PDF releases are notify-only. They are never ingested automatically.
- The state productivity workbook (state rows of `snapshot.json`) and the 34 static PDF reports are manual.
- The live site cannot be checked from GitHub Actions. Stage 3 relies on Cloudflare's check plus the committed manifest; you confirm the live "data as of" by hand.
- If Cloudflare Pages posts no check on a commit (for example, preview builds are turned off for a branch), Stage 3 reports "not-found" after 20 minutes.

## Fail / Files

| File | Purpose |
|---|---|
| `.github/workflows/dosm-check.yml` | Stages 1 and 2 (weekly + manual run) |
| `.github/workflows/dosm-deploy.yml` | Stage 3 (after merge) |
| `scripts/check_dosm.py` | download and compare, watchlist, simulation |
| `scripts/watchlist.json` | notify-only sources |
| `scripts/validate_dosm.py` | validation report |
| `scripts/build_site_data.py`, `scripts/m6_pack.py`, `scripts/build_k3_data.py` | rebuild the site data |
| `scripts/check_page_code.py` | proves only the data changed |
| `scripts/dosm_github.py` | issues, pull requests, Teams / e-mail, Cloudflare check |
| `scripts/test_dosm_pipeline.py` | tests |
| `website/data/data-manifest.json` | data as of, file fingerprints, deployments |
| `scripts/radar_record.py` | monitoring log for the Radar Data page (branch `radar-log`) |
| `functions/api/radar.js` | `/api/radar` for the Radar Data page and the notification bell |
| `website/radar.js` | the Radar Data page and the notification bell |
