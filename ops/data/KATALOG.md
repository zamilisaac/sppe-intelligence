# Katalog data DOSM: SPPE Intelligence

Ini senarai **semua** data yang laman perlukan: dari mana ia datang, bila ia keluar, bagaimana ia masuk ke laman, dan di mana ia dipaparkan. Pengurus Data DOSM dan Chief of Staff wajib membaca fail ini.

**Prinsip:** setiap keluaran DOSM yang mengubah data laman mesti dipaparkan di laman tanpa Pelulus perlu mengarahkannya. Jika ia tidak dapat masuk secara automatik, ejen mesti tahu sebabnya dan melaporkannya ke AIOS.

## Cara data masuk (automatik)

1. **Semakan GitHub** `dosm-check.yml` berjalan setiap hari pada 09:17 MYT, dan setiap jam dari 12:17 hingga 18:17 MYT pada hari bekerja. DOSM menerbitkan pada 12:00.
2. Untuk setiap fail di bawah, semakan membandingkan tarikh terkini di OpenDOSM dengan salinan dalam `dosm/`. Fail yang lebih baharu dimuat turun.
3. **Fallback portal DOSM.** Untuk produktiviti suku tahunan, jika OpenDOSM belum dikemas kini, semakan mencari Excel "Jadual Produktiviti Buruh Suku" di `www.dosm.gov.my/portal-main/release-content/labour-productivity-q<suku><tahun>`, kemudian menukarnya dengan `scripts/dosm_jadual_produktiviti.py`. Nilai disalin; tiada yang dianggar.
4. **Pengesahan** `validate_dosm.py` membuat 8 semakan: lajur, tarikh, bilangan baris, kategori hilang, nombor, nilai kosong, pendua dan tarikh tidak mundur. Pek data dibina semula, dan kod laman disemak tidak berubah.
5. **Terbit automatik.** Jika pengesahan **PASS** dan ujian laman lulus (`engine-lab`, `suku`, `profil`) serta ujian saluran lulus, PR di-merge ke `main` dan Cloudflare mendeploy. Ini keputusan Pelulus, 24 Nov 2026.
6. **WARN, FAIL atau ujian gagal:** PR ditahan untuk semakan. Pengurus Data DOSM menyiasat dan melapor.

## Data produktiviti (semua jenis)

| # | Data | Fail dalam `dosm/` | Sumber automatik | Kekerapan | Di laman | Keluaran DOSM yang mengemas kininya |
|---|---|---|---|---|---|---|
| P1 | Produktiviti nasional, 22 sektor (setiap pekerja, setiap jam, KDNK, jam, pekerja) | `productivity_annual.csv` | OpenDOSM `labour/productivity_annual` | Tahunan | Produktiviti Buruh (KPI, trend), Makmal, laporan | Produktiviti Tenaga Buruh tahunan, dan ST4 yang membawa angka tahunan |
| P2 | **Produktiviti nasional suku tahunan, 22 sektor** | `productivity_qtr.csv` | OpenDOSM `labour/productivity_qtr`, **atau** Excel portal DOSM (Jadual 5–6, 8, 10, 12) melalui penukar | Suku tahunan | Produktiviti Buruh → "Produktiviti suku tahunan terkini" | Produktiviti Tenaga Buruh ST1–ST4 |
| P3 | Produktiviti negeri × 5 sektor | `productivity_state.csv` | OpenDOSM `labour/productivity_state` | Tahunan | Negeri, peta, kedudukan (sekarang melalui buku kerja manual; nilai sepadan 100%) | Produktiviti Buruh Negeri tahunan |
| P4 | **14 subsektor keutamaan (Nexus)** | `productivity_annual_p14.csv` | OpenDOSM `labour/productivity_annual_p14`. Nama subsektor dari DOSM Jadual 3a/4a; kod `special.01`–`special.14` dalam `scripts/build_k3_data.py` | Tahunan | Produktiviti Buruh → "14 subsektor keutamaan" | Produktiviti Tenaga Buruh tahunan |
| P5 | Produktiviti PMKS | `dosm/makmal/S2_S4_S5_S6_pmks_2025.xlsx` | Manual (Excel DOSM, PR #17) | Tahunan | Makmal (belum disambung) | Prestasi PMKS |
| P6 | Buku kerja produktiviti negeri (jadual laman) | `Produktiviti Buruh Negeri 2015-2025.xlsx` | Manual | Tahunan | Semua halaman negeri | Produktiviti Buruh Negeri |

## Data pasaran buruh

| # | Data | Fail | Sumber automatik | Kekerapan | Di laman |
|---|---|---|---|---|---|
| L1 | Tenaga buruh negeri × jantina | `lfs_state_sex.csv` | OpenDOSM `labour/lfs_state_sex` | Tahunan | Pasaran Buruh, Negeri |
| L2 | **Tenaga buruh suku tahunan mengikut negeri** | `lfs_qtr_state.csv` | OpenDOSM `labour/lfs_qtr_state` | Suku tahunan | Pasaran Buruh → "Tenaga buruh suku terkini mengikut negeri" |
| L3 | **Tenaga buruh bulanan nasional** | `lfs_month.csv` | OpenDOSM `labour/lfs_month` | Bulanan | Pasaran Buruh → "Tenaga buruh bulanan" |

## Data lain yang dibaca laman

| Data | Fail | Kekerapan |
|---|---|---|
| KDNK negeri × sektor (harga malar) | `gdp_state_real_supply.csv` | Tahunan |
| Gaji & upah (survei): negeri, sektor, industri, kemahiran, pendidikan | `wages_*.csv` | Tahunan |
| Gaji sektor formal: negeri, MSIC, julat | `formal_wages_*.csv` | Suku tahunan (data bulanan) |
| IHP negeri dan inflasi | `cpi_2d_state*.csv` | Bulanan |
| HIES pendapatan isi rumah | `hies_state*.csv` | Setiap 2 tahun |

## Bila sesuatu keluaran TIDAK mengubah laman

`scripts/keluaran_tertunggak.mjs` memadankan kekerapan keluaran dengan kekerapan fail. Contohnya, keluaran KDNK ST3 ialah suku tahunan, sedangkan laman membaca KDNK negeri tahunan, jadi ia `tidak_mengubah`. Ini betul, dan bukan kegagalan.

Jika Pelulus mahukan data suku atau bulanan baharu bagi sesuatu topik:
1. Tambah fail OpenDOSM itu ke `DATASETS` dalam `scripts/check_dosm.py`.
2. Tambah skemanya ke `SCHEMA` dalam `scripts/validate_dosm.py`.
3. Tambahnya ke `DATASETS` dalam `scripts/build_site_data.py`, ke `functions/api/radar.js`, dan ke `FREQ` dalam `scripts/keluaran_tertunggak.mjs`.
4. Tambah paparan dan ujian.

Lakukannya melalui PR.

## Masalah biasa dan tindakan

| Gejala | Punca biasa | Tindakan |
|---|---|---|
| DOSM dah terbit, OpenDOSM belum (lebih 3 hari bekerja) | OpenDOSM lambat | Produktiviti suku: fallback portal mengendalikannya. Data lain: notis `amaran` ke AIOS |
| Fallback portal: "could not be converted" | DOSM mengubah susun atur Excel | Kemas kini `dosm_jadual_produktiviti.py` melalui PR. Bandingkan dengan OpenDOSM menggunakan `--compare`; mesti 0 baris hilang |
| Pengesahan WARN (contohnya nilai kosong baharu) | Lajur atau baris berubah nama | Siasat. Jangan paksa terbit. Laporkan butirannya |
| Ujian laman gagal selepas data baharu | Data mempunyai nilai yang kod tidak jangka | Laporkan dengan output ujian. Pembaikan kod melalui gelung PM |
