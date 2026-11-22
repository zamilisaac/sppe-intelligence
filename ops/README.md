# Syarikat Ejen AI: SPPE Intelligence

Ejen AI yang menjaga, menguji dan melaporkan projek ini secara berjadual. Manusia hanya **meluluskan**.

**Pelulus:** @zamilisaac. Hanya Pelulus boleh merge PR, meluluskan keputusan, deploy dan menghantar mesej keluar.

## Fasa

| Fasa | Ejen | Status |
|---|---|---|
| 1 | 🧪 QA (mingguan, Isnin 2:13 pagi) + 🧭 Chief of Staff (mingguan, Isnin 7:45 pagi) | sedang dibina |
| 2 | 📋 PM + 🛠 Jurutera | belum |
| 3 | 📊 Penganalisis Data | belum |
| 4 | 🛡 Keselamatan + mesej keluar | belum (perlu kelulusan IT) |

## Di mana semuanya

Repo ini **awam**, dan push ke `main` terus dideploy ke laman. Sebab itu fail yang ditulis ejen secara berkala disimpan di cawangan berasingan, iaitu **`agents/ops`**:
- cawangan itu tidak pernah di-merge dan tidak dideploy;
- setiap commit ke cawangan itu memakai `[skip ci]`.

| Fail (cawangan `agents/ops`) | Isi | Ditulis oleh |
|---|---|---|
| `ops/STATE.md` | keutamaan minggu ini, risiko terbuka, keputusan menunggu | Chief of Staff |
| `ops/DECISIONS.md` | keputusan Pelulus (tarikh, keputusan, sebab) | Pelulus, atau ejen yang menyalin keputusan bertulis Pelulus |
| `ops/LOG.md` | log setiap tindakan ejen (tambah sahaja) | semua ejen |
| `ops/qa/latest.md`, `ops/qa/history/` | hasil QA terkini dan arkib setiap larian | QA |
| `ops/reports/YYYY-Www.md` | laporan mingguan | Chief of Staff |
| `ops/PAUSE` | jika wujud, semua ejen berhenti | Pelulus |

Dalam cawangan `main` (fail ini) pula ada:
- piagam ini;
- prompt penuh setiap ejen, dalam `ops/prompts/`;
- arahan ujian `bash tests/run-all.sh`.

Laporan mingguan juga dibuka sebagai GitHub Issue berlabel `laporan-mingguan`.

## Suis henti

Ada dua cara menghentikan semua ejen serta-merta:
- buka mana-mana issue dan letak label **`agents:pause`**;
- atau cipta fail `ops/PAUSE` di cawangan `agents/ops`.

Ejen akan hanya mencatat dalam log bahawa ia dihentikan, kemudian berhenti.

## Peraturan semua ejen

1. Tiada push ke `main`. Semua perubahan kod melalui branch dan PR, dan hanya Pelulus yang merge.
2. Tiada perubahan pada data produksi atau tetapan live (Cloudflare, rahsia, workflow deploy) tanpa kelulusan bertulis Pelulus.
3. Tiada mesej keluar kepada sesiapa selain Pelulus. Ejen hanya mendraf.
4. Tiada rahsia, e-mel atau nama pengguna dalam kod, issue, PR atau laporan. Repo ini awam.
5. Setiap tindakan direkod dalam `ops/LOG.md`.
6. Suis henti dipatuhi serta-merta.
7. Jika tidak pasti, buka issue `perlu-keputusan`. Jangan teka.
8. Lapor dengan jujur: ujian gagal ditulis sebagai gagal, beserta output.
9. Maksimum 3 percubaan bagi satu tugas. Selepas itu, eskalasi kepada Chief of Staff.

Peraturan khusus projek ini:
- Jangan sekali-kali mereka data. Jika data tiada, tulis bahawa ia tiada.
- Paparan BM hanya dalam BM, paparan EN hanya dalam EN.
- Analisis gaji dalam laporan masih KIV.

## Ujian

```bash
bash tests/run-all.sh
```

Arahan ini menjalankan semua suite Playwright, ujian saluran DOSM dan semakan laman live, kemudian menulis ringkasan ke `ops/qa/run-latest.md`.

- **Laman live:** dikunci log masuk Microsoft. Ujian hanya memastikan semua halaman dan data memang terkunci, dan halaman log masuk dipaparkan.
- **Ujian penuh:** dijalankan pada salinan kod `main`.
- **Kegagalan yang diterima:** disenaraikan dalam `tests/known-failures.txt`, dan hanya boleh diubah melalui PR.
