=== PROJECT BRIEF ===
PROJECT: SPPE Intelligence. Laman analitik ekonomi dan produktiviti 14 negeri milik Perbadanan Produktiviti Malaysia (MPC), berasaskan data rasmi DOSM.
  Repo zamilisaac/sppe-intelligence (AWAM) · cawangan utama main · laman live https://sppeintelligence.pages.dev (dikunci log masuk Microsoft)

GOAL: Mulai 1 Disember 2026, setiap minggu:
  - semua ujian `bash tests/run-all.sh` lulus pada main;
  - setiap keluaran DOSM yang berkaitan SPPE sedia sebagai PR data dalam 3 hari bekerja selepas diterbitkan;
  - tiada issue keutamaan:P1 terbuka lebih 7 hari.

DONE MEANS (bagi satu tugas):
  - Satu PR dari cawangan agent/<tugas>-<ringkas> ke main, berstatus "Lulus QA, menunggu semakan Pelulus".
  - Ujian lulus, bukti dilampirkan, issue tugas dipautkan.
  - Atau, bagi tugas analisis: satu fail Markdown di cawangan agents/ops.

CONSTRAINTS:
  - Teknologi:
    - HTML/JS statik tanpa langkah build: website/index.html satu fail, profil.js, radar.js, newsletter.js.
    - Cloudflare Pages Functions: functions/_middleware.js (log masuk) dan functions/api/radar.js.
    - Python scripts/ untuk data.
    - Ujian: Playwright (Node) + unittest.
  - Jangan tambah kebergantungan, perpustakaan CDN atau langkah build baharu tanpa kelulusan.
  - Deploy = push ke main, dan hanya dibuat oleh Pelulus selepas dia menulis "deploy".
  - Jangan ubah tanpa kelulusan bertulis Pelulus:
    - log masuk Microsoft;
    - rahsia dan tetapan Cloudflare;
    - workflow .github/;
    - fail data yang diterbitkan.
  - Bajet: maksimum 10 sesi ejen seminggu. Satu tugas: maksimum 3 pusingan semakan.
  - Bahasa: BM ikut DBP. Mod BM paparkan BM sahaja, mod EN paparkan EN sahaja.
  - Repo awam: tiada e-mel, nama pengguna, token atau rahsia dalam kod, issue, PR atau laporan.

OUT OF SCOPE:
  - Analisis gaji dalam laporan (KIV).
  - Buletin bulanan dan penghantaran e-mel (KIV).
  - Reka bentuk semula yang tidak diminta.
  - Sumber data selain DOSM/OpenDOSM atau jadual rasmi kerajaan.
  - Menganggar, mengisi atau "melicinkan" data yang tiada.
  - Mengubah angka atau metodologi yang sudah diterbitkan tanpa keputusan Pelulus.
  - Kerja pada projek lain (contoh: SPPE-PRISMA).

OUTPUT FORMAT (satu tugas siap):
  1) Cawangan agent/<id>-<ringkas>, dengan diff minimum.
  2) PR mengikut .github/pull_request_template.md, dengan seksyen:
     - Ringkasan
     - Issue
     - Perubahan
     - Bukti ujian (jadual run-all)
     - Gambar skrin
     - Sumber data
     - Andaian
  3) Gambar skrin bagi perubahan UI: BM dan EN, desktop 1440px dan telefon 360px.
  4) Rekod pusingan dalam issue tugas (format SEMAKAN, lihat ops/SYARIKAT.md).

QUALITY BAR (setiap satu PASS/FAIL):
  Q1 Ujian:
     - `bash tests/run-all.sh` kod keluar 0, tanpa kegagalan baharu;
     - tingkah laku baharu atau yang dibaiki mempunyai sekurang-kurangnya satu ujian.
  Q2 Data jujur:
     - setiap angka yang dipaparkan boleh dijejak ke fail atau jadual DOSM dan tarikhnya;
     - data yang tiada dinyatakan tiada;
     - sifar angka rekaan.
  Q3 Bahasa:
     - mod BM hanya BM, mod EN hanya EN;
     - istilah ekonomi diterangkan dalam kurungan pada kali pertama;
     - ejaan DBP.
  Q4 Paparan:
     - tiada tatal mendatar pada 360px;
     - tiada teks bertindih atau terpotong;
     - tiada ralat konsol (dibuktikan dengan gambar skrin).
  Q5 Skop:
     - diff hanya menyentuh fail yang perlu;
     - tiada rahsia atau e-mel;
     - tiada perubahan pada main, deploy, workflow atau log masuk.

ROSTER:
  * Penyelidik Data | menyiasat | fakta data berpautan: jadual DOSM, tarikh, ketersediaan; tanpa pendapat
  * Pembina         | membina   | cawangan + PR draf
  * Penguji         | memecahkan | laporan ujian: apa gagal + langkah ulang
  * Penyemak        | menilai    | PASS/FAIL ikut Q1–Q5 + 3 pembetulan
  * Ahli Ekonomi    | mengesahkan | PASS/FAIL ketepatan ekonomi dan statistik + 3 pembetulan
  * Penambah Baik   | membaiki & mencatat | PR yang dibaiki + 1 pengajaran dalam LESSONS

LESSONS FILE: ops/LESSONS.md di cawangan agents/ops
  - Baca dengan: git show origin/agents/ops:ops/LESSONS.md
  - Hanya Penambah Baik menulis. Satu fail untuk projek ini sahaja.

LOOP CAP: 3 pusingan semakan setiap tugas. Selepas itu, eskalasi kepada Chief of Staff.

ESCALATE TO ME WHEN:
  1) Apa-apa yang perlu merge, deploy, atau mengubah tetapan live atau rahsia.
  2) Angka atau metodologi yang sudah diterbitkan perlu diubah, atau sumber data baharu dicadangkan.
  3) Satu tugas mencapai LOOP CAP, atau bajet mingguan akan terlebih.
=== END BRIEF ===
