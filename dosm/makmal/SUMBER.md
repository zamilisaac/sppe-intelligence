# Sumber data Makmal Produktiviti (dimuat turun 23 Nov 2026)

Semua fail dalam folder ini dimuat turun terus daripada laman rasmi DOSM, iaitu `www.dosm.gov.my` (jadual penerbitan) dan `storage.dosm.gov.my` (OpenDOSM). Kandungannya tidak diubah.

- **Halaman penerbitan:** `https://www.dosm.gov.my/portal-main/release-content/<slug>`
- **Pautan muat turun jadual:** `https://www.dosm.gov.my/portal-main/release-document-log?release_document_id=<id>`

| Kod | Fail | Penerbitan DOSM (slug) · id | Tahun | Liputan | Status |
|---|---|---|---|---|---|
| S9 | `S9_stok_modal_2025.xlsx` | `capital-stock-statistics-` · 21295 | 2023, 2024e, 2025p | Nasional, sektor & subsektor; aset: struktur, mesin & peralatan, lain-lain | ⚠ Tiada siri 2015–2025; harta intelek tidak diasingkan (dalam "aset lain") |
| S16, S17 | `S16_S17_kdnk_tahunan_2015-2025.xlsx` + `gdp_annual_{real,nominal}_{supply,demand}.csv` | `gross-domestic-product-2025` · 19446 | 2015–2025p | Nasional; jadual 2–7 (aktiviti, semasa & malar), 8–13 (perbelanjaan) | ✅ |
| S7 | `S7_akaun_satelit_tmk_2025.xlsx` | `information-and-communication-technology-satellite-account-2025` · 21456 | 2015–2025p | Nasional, subindustri TMK; VA, pekerjaan, dagangan TMK, e-dagang | ✅ |
| S2, S4, S5, S6 | `S2_S4_S5_S6_pmks_2025.xlsx` | `micro-small--medium-enterprises-msmes-performance-2025` · 20391 | 2015–2025p | Nasional, sektor; jadual 6, 13A–C, 14C–D, 14G–H | ✅ |
| S12 | `S12_statistik_guna_tenaga_st3_2026.xlsx` | `employment-statistics-q32026` · 21795 | 2018S1–2026S3 | Nasional; jawatan, diisi, kekosongan, diwujudkan ikut kemahiran & sektor | ✅ |
| S8 | `S8_akaun_satelit_pelancongan_2025.xlsx` | `tourism-satellite-account-2025` · 21005 | 2015–2025 | Nasional, industri pelancongan; VA (Jad 5–6), pekerjaan (Jad 7) | ✅ |
| S10 | `S10_kdnk_pendapatan_2025.xlsx` + `gdp_annual_nominal_income.csv` | `gross-domestic-product-income-approach-2025` · 20331 | 2015–2025p | Nasional, sektor; pampasan pekerja (Tab 3), lebihan kendalian (Tab 4) | ✅ |
| S18 | `S18_borong_runcit_sep2026.xlsx` | `performance-of-wholesale--retail-trade-sep2026` · 21745 | 2018–Sep 2026p | Nasional, subsektor | ✅ (baris Okt–Dis 2026 ialah nilai kosong templat DOSM) |
| S19 | `S19_indeks_volum_perdagangan_q3_2026.xlsx` + `iowrt*.csv` | `volume-index-of-wholesale--retail-trade-q32026` · 21781 | 2021S1–2026S3 (CSV bulanan 2018–Sep 2026) | Nasional, subsektor & kumpulan | ✅ |
| S14 | `S14_laporan_stb_st3_2026.xlsx` + `lfs_*.csv` | `labour-force-survey-report-q32026` · 21746 | 2020S1–2026S3 (status pekerjaan dari 2018S1) | Status pekerjaan, pekerjaan; guna tenaga tidak penuh masa dan kemahiran | ⚠ Guna tenaga tidak penuh: nasional sahaja, bukan negeri |
| S11 | `formal_wages_percentile.csv` | OpenDOSM `formal_wages_percentile` | Jan 2022–Jun 2026 | Persentil P10–P90, **nasional sahaja** | ⚠ Persentil gaji mengikut negeri tidak diterbitkan DOSM; perlu permohonan data (`www.dosm.gov.my/portal-main/article/data-request`) |

Laporan PDF tidak disimpan di sini kerana saiznya (sehingga 16 MB). Ia boleh dimuat turun daripada halaman penerbitan yang sama:
- S9: 21296
- S2–S6: 20411
- S12: 21801, 21802
- S8: 21032
- S10: 20363
- S14: 21752
- S11: 21604, 21605

Fail-fail ini belum dibaca oleh laman. Pengiraan Makmal disambungkan satu demi satu dalam PR berasingan, dan setiap angka disemak dengan fail asal.
