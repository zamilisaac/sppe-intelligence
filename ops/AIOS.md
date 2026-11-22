# Sambungan ke AIOS (projek SPPE-I)

Semua laporan, notis dan permohonan kelulusan ejen dihantar ke **AIOS** milik Pelulus, di bawah **Projek → SPPE-I**. Pelulus membuat keputusan di situ sahaja.

GitHub kekal sebagai tempat kerja (PR, issue tugas, cawangan `agents/ops`), tetapi bukan tempat Pelulus perlu memeriksa.

- **AIOS:** https://claude.ai/artifact/PUkL8j8ThYk1rL95Kx49vi
- **Projek:** dokumen `projects/sppe-i` (nama paparan `SPPE-I`)
- **Suapan:** koleksi `projects/sppe-i/feed`
- **Alat:** `ArtifactData`. Jika ia tertangguh, muatkan dahulu dengan `ToolSearch` → `select:ArtifactData`. Semua panggilan memakai `url` AIOS di atas.

## Format satu item suapan

| Medan | Nilai |
|---|---|
| `type` | `laporan` · `notis` · `kelulusan` |
| `status` | laporan/notis: `baru`; kelulusan: `menunggu`. Pelulus menukarnya kepada `dibaca`, `lulus` atau `tolak` |
| `level` | `""`, `amaran` atau `kritikal` (untuk notis atau kelulusan yang mendesak) |
| `title` | ringkas, maksimum ~80 aksara |
| `summary` | 1–2 ayat |
| `body` | teks penuh (laporan lengkap, butiran, apa berlaku jika diluluskan) |
| `links` | `[{label, url}]`: PR, issue, fail di GitHub |
| `source` | nama ejen: `Chief of Staff`, `Pengurus Program`, `QA (Penguji)`, `Pelaksana Kelulusan` |
| `ref` | rujukan pendek: `PR #12`, `T-13-1`, `K1`, `2026-W48`, `Deploy` |
| `createdAt` | masa ISO UTC, contoh `2026-11-23T00:00:00Z` |

**`doc_id`:** `YYYY-MM-DD-<jenis>-<ringkas>`, huruf kecil, nombor dan `-`. Contoh: `2026-11-30-laporan-2026-W49`, `2026-11-30-lulus-pr21`, `2026-11-30-K1`.
- Cipta dengan `set`, tanpa `if_version`, hanya jika doc_id itu belum wujud.
- Jangan sesekali menimpa item yang Pelulus sudah buka atau putuskan.

Medan yang ditulis Pelulus melalui AIOS (jangan diubah oleh ejen):
- `status`
- `decisionNote`
- `decidedAt`
- `readAt`

Medan yang ditulis ejen selepas melaksanakan keputusan, dengan `update` dan `if_version`:
- `executedAt`: masa ISO
- `executedBy`: nama ejen
- `executionNote`: apa dibuat, beserta pautan

## Apa dihantar, dan oleh siapa

| Peristiwa | Jenis | Oleh |
|---|---|---|
| Laporan mingguan + Kaizen Review (badan penuh) | `laporan` | Chief of Staff, Isnin |
| Setiap cadangan Kaizen K1–K3 | `kelulusan` (satu item setiap cadangan) | Chief of Staff |
| Keputusan yang diperlukan (bahagian 4 laporan) | `kelulusan` | Chief of Staff |
| BRIEF baharu (cadangan CoS) | `kelulusan`, ref `BRIEF #n` | Chief of Staff |
| PR lulus QA dan semakan, minta merge | `kelulusan`, ref `PR #n` | Pengurus Program |
| Tugas mencapai LOOP CAP | `kelulusan` level `amaran` (pilihan A/B) | Pengurus Program |
| Laporan gelung (LAPORAN PM) | `laporan` | Pengurus Program |
| Hasil QA mingguan | `notis` (`kritikal` jika main gagal atau laman tidak terkunci) | QA |
| Keputusan sudah dilaksanakan | `notis`, ref sama dengan item kelulusan | Pelaksana Kelulusan / ejen yang melaksana |

## Melaksanakan keputusan Pelulus

Setiap ejen berjadual (dan Pelaksana Kelulusan) mula dengan menyemak:

```
ArtifactData query  collection=projects/sppe-i/feed
  where: [["type","==","kelulusan"],["status","in",["lulus","tolak"]]]
```

Kemudian abaikan item yang sudah ada `executedAt`.

**Status `lulus`:**
- Laksanakan tepat seperti yang ditulis dalam `body`. Patuhi `decisionNote` jika ada; contoh "lulus tetapi tunggu Jumaat".
- Merge PR:
  gh api -X PUT repos/zamilisaac/sppe-intelligence/pulls/<n>/merge -f merge_method=merge
  Lakukan hanya selepas `bash tests/run-all.sh` pada kepala PR berkod keluar 0.
- Deploy: hanya selepas ujian lulus.
- Kaizen: buka PR yang mengubah baris tepat yang dicadangkan.
- BRIEF: letak label `lulus` pada issue.

**Status `tolak`:**
- Jangan buat apa-apa perubahan.
- Rekod sebab (`decisionNote`) dalam `ops/DECISIONS.md`.

**Selepas itu, bagi setiap keputusan:**
1. Kemas kini item asal dengan `executedAt`, `executedBy` dan `executionNote`.
2. Cipta satu item `notis` baharu, dengan tajuk `Dilaksanakan: <tajuk asal>` atau `Ditolak, tiada tindakan: <tajuk asal>`.
3. Salin keputusan ke `ops/DECISIONS.md` dan `ops/LOG.md` (cawangan `agents/ops`).

**Jika pelaksanaan gagal**, contohnya ujian gagal sebelum merge:
- Jangan cuba memaksa.
- Cipta `notis` level `amaran` dengan output kegagalan.
- Biarkan `executedAt` kosong. Satu item hanya dicuba sekali dalam setiap sesi.

**Jika alat `ArtifactData` tidak tersedia** dalam sesi:
- Buka GitHub issue berlabel `perlu-keputusan` dengan kandungan yang sama.
- Catat "AIOS tidak dapat dicapai" dalam LOG. Chief of Staff akan melaporkannya.

## Peraturan

- Item dalam AIOS boleh dilihat oleh sesiapa yang Pelulus kongsikan AIOS kepadanya. Jangan tulis rahsia, token, e-mel atau data peribadi.
- Kelulusan dalam AIOS ialah kelulusan bertulis Pelulus. Ejen hanya boleh merge, deploy, menutup PR atau mengubah sesuatu yang memerlukan kelulusan selepas item `kelulusan` yang tepat berstatus `lulus`.
- Jangan padam item suapan. Pelulus sahaja yang memadam.
