# Status semasa: SPPE Intelligence

Dikemas kini: 2026-11-22 oleh Arkitek Operasi AI (persediaan Fasa 1). Chief of Staff akan mengambil alih setiap Isnin.

## Keutamaan minggu ini
1. Aktifkan Fasa 1 (QA mingguan + Chief of Staff mingguan) dan hasilkan laporan mingguan pertama.
2. Selesaikan PR data DOSM yang bertindih.
3. Deploy 4 commit yang menunggu di cawangan `add-microsoft-login`, bila Pelulus berkata "deploy".

## Risiko terbuka
| Perkara | Keterukan | Bukti |
|---|---|---|
| Tiga PR data DOSM bertindih terbuka serentak (#8, #10, #11). Kandungan #11 sudah di-merge ke cawangan kerja tetapi belum ke `main`. | Sederhana | https://github.com/zamilisaac/sppe-intelligence/pulls |
| 4 commit belum dideploy di `add-microsoft-login`: data IHP Okt 2026, senarai keluaran Radar (bulan ini dan depan), kalendar tahun depan, draf buletin. | Sederhana | `git log origin/main..origin/add-microsoft-login` |
| Bendera Putrajaya tiada dalam Profil Strategik (Wikimedia menolak muat turun). | Rendah | website/assets/flags/CREDITS.json |
| 61 pengiraan katalog disembunyikan kerana fail Excel DOSM (S2–S19) tiada dalam repo. | Rendah | Makmal Produktiviti |

## Keputusan menunggu Pelulus
- Tutup PR pendua #8 dan #10. Gabungkan atau tutup #11 selepas deploy.
- Tetapkan `RADAR_ADMINS` dalam Cloudflare (belum disahkan sama ada sudah dibuat).
- Buletin "Sorotan Produktiviti Bulanan": KIV. Belum ditentukan pengirim, penerima atau jadual.
