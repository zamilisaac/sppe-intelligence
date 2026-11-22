# LESSONS · SPPE Intelligence

Dibaca oleh SEMUA ejen sebelum mula. Ditulis oleh **Penambah Baik sahaja**.
- Satu baris bagi setiap pengajaran.
- Perkukuhkan baris sedia ada, jangan pendua.
- Fail ini untuk projek ini sahaja.

Baris 1–15 disemai oleh Arkitek pada 2026-11-22, daripada kesilapan sebenar sepanjang pembinaan laman.

| # | Tarikh | Jenis tugas | Kesilapan | Peraturan untuk mengelaknya |
|---|---|---|---|---|
| 1 | 2026-11 | UI / JS | Butang tidak berfungsi selepas halaman dipapar semula, kerana pendengar dipasang pada elemen yang digantikan. | Pasang pendengar pada `document` (delegasi `data-*`). Uji: keluar dari halaman, masuk semula, klik lagi. |
| 2 | 2026-11 | UI / navigasi | `<a href="#x">` dalam halaman membawa pengguna ke halaman Utama (penghala SPA membaca hash). | Untuk tatal dalam halaman, guna `<button>` + `scrollIntoView`. Jangan guna pautan `#`. |
| 3 | 2026-11 | Sunting index.html | Membuang blok kod menghilangkan satu `}`, dan koma berganda mencipta lubang dalam tatasusunan, menyebabkan SyntaxError seluruh laman. | Selepas menyunting index.html: muat halaman dengan Playwright dan pastikan tiada `pageerror`, sebelum ujian lain. |
| 4 | 2026-11 | Data pack | `build_k3_data.py` diubah tanpa membina semula manifest, menyebabkan hash pek tidak sepadan. | Selepas mengubah mana-mana pembina data: jalankan `python3 scripts/build_site_data.py` dan commit manifest bersama. |
| 5 | 2026-11 | Data / tarikh | Tergoda untuk mengisi jadual DOSM tahun depan yang belum diterbitkan. | Jangan reka tarikh atau nilai. Baca sumber rasmi; jika tiada, paparkan "belum diterbitkan". |
| 6 | 2026-11 | Radar / paparan | PR ujian dan larian simulasi muncul kepada pengguna sebagai data sebenar. | Tapis rekod ujian atau simulasi daripada semua senarai yang dilihat pengguna, dan tambah ujian yang memastikannya. |
| 7 | 2026-11 | Automasi GitHub | Semakan harian membuka PR data pendua (#8, #10, #11). | PR automatik guna cawangan tetap dan kemas kini PR sedia ada. Jangan buka PR baharu setiap kali. |
| 8 | 2026-11 | Bahasa | Perkataan EN terlepas dalam mod BM (dan sebaliknya). | Setiap teks baharu mesti pasangan BM/EN. Ujian: paparan EN tiada kata kunci BM, dan sebaliknya. |
| 9 | 2026-11 | Laporan / istilah | Istilah ekonomi tanpa penerangan; pengguna awam tidak faham. | Terangkan istilah dalam kurungan pada kali pertama, contoh: "produktiviti buruh (nilai ditambah setiap pekerja)". |
| 10 | 2026-11 | Kedudukan negeri | Penunjuk "lebih rendah lebih baik" (contoh: pengangguran) tersusun terbalik. | Semak senarai `LOWB` bagi setiap penunjuk baharu. Ahli Ekonomi sahkan arah kedudukan. |
| 11 | 2026-11 | Reka letak | Kad tanpa jarak kelihatan bertindih; susun atur tidak simetri. | Sebelum PR: gambar skrin 1440px dan 360px, semak jarak dan simetri. Tiada tatal mendatar. |
| 12 | 2026-11 | Fungsi / API | API GitHub tanpa token di Cloudflare kena had kadar, menyebabkan cip status merah kepada pengguna. | Jangan bergantung pada API luar tanpa token dalam UI pengguna. Sediakan laluan gagal yang senyap atau berguna. |
| 13 | 2026-11 | Aset luar | Wikimedia menolak muat turun pukal (429); bendera Putrajaya hilang. | Muat turun aset satu per satu dengan jeda; rekod kredit; kod mesti selamat jika aset tiada. |
| 14 | 2026-11 | Bahan promosi | Angka dalam bahan rujukan (video) berbeza daripada enjin laman. | Setiap angka dalam promosi atau laporan dikira semula daripada enjin Makmal atau data repo. Jangan salin daripada bahan rujukan. |
| 15 | 2026-11 | Ujian | Ujian mega-menu membaca penanda `aria-current` yang salah, menyebabkan FAIL palsu yang berulang. | Kegagalan ujian palsu dibaiki di ujian, bukan diabaikan. `known-failures.txt` hanya sementara, dengan issue. |
