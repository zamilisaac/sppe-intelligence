# State Productivity Dashboard: build notes

Original single-page dashboard (version 4, 6 Nov 2026). Shared with the organization.

## How it works
- Owner check: `user.isOwner()`. Only the owner gets the Google Drive connector (`mcp`) and file storage (`assets`).
- On owner open: find folder "State Productivity Data" (id cached in snapshot), list xlsx files with "produktiviti/productivity" in the title, pick highest year in name then latest modifiedTime. Run the update if fileId or modifiedTime differs from `snapshot.source`, or if `snapshot.schema` is older than the page's `SCHEMA` (currently 2).
- Update steps: download → parse all sheets (tables found by "Table/Jadual N:" title, header = row with ≥3 years) → validate layout (fatal issues block the update and are stored as `snapshot.rejected`) → compare with the previous snapshot (`snapshot.revisions`) → build 34 reports (national + 16 states, in BM and EN) with jsPDF → upload PDFs to artifact assets → save to Drive `State Productivity Data/Laporan/<year>` (same-name files moved to an `Arkib` subfolder) → write `app/snapshot`.
- Report keys in `snapshot.reports`: `<id>` = BM, `<id>__en` = EN.
- Drive upload: PDFs are sent inline as base64. The platform file route only accepts docx/pptx/xlsx, so it is used only for PDFs over 700 KB.
- Viewers: read `app/snapshot` (db, owner-only write). PDFs come from `/_blob/<assetId>`. Excel (incl. a "Semakan" revisions sheet) is built in the browser. Both use the `downloads` capability.
- Lock: `app/lock` lease prevents two tabs from updating at once.
- Libraries: SheetJS 0.18.5 and jsPDF 2.5.1 from cdnjs, loaded on demand.

## Dashboard sections
KPIs → clickable Malaysia map (Natural Earth admin-1, public domain; Borneo shifted 3.2° west; KL/PJY/LBN as bubbles) + state profile → ranking race with year slider → animated performance matrix + "What changed" (revisions) → trend + sector view. `#<stateid>` in the URL opens a state.

## Data notes found in the 2015-2025 file
- 11 sheets, one table per sheet (not stacked); the parser handles both layouts.
- No constant/current price note in the file, so reports say "not stated in the source file".
- Labuan and Putrajaya mining are "-" (shown as Tiada data).

## Report logic
- Performance groups (2x2): level vs national × average annual growth over the last 3 years vs national → Peneraju / Pengejar / Tinggi tetapi perlahan / Perlu perhatian.
- Putrajaya and Labuan are excluded from the scatter chart (off scale) but are still listed in the group table and matrix note.
- EN reports are translations of the same BM analysis (engine `kit(lang)`).

## Decided not to do
- Productivity Nexus view: the DOSM file has only 5 broad sectors; the user dropped the request.
