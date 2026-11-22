# Syarikat ejen SPPE Intelligence: Gelung Kaizen

Struktur tiga peringkat:

**Anda (Pelulus) → 🧭 Chief of Staff → 📋 Pengurus Program → 6 pekerja, dalam satu gelung.**

- Satu-satunya blok yang berubah mengikut projek ialah [`ops/BRIEF.md`](BRIEF.md).
- Setiap ejen membaca BRIEF itu dan `LESSONS.md` sebelum mula.

```
                    👤 PELULUS (@zamilisaac)
                       │  memberi matlamat · merge · deploy · lulus cadangan Kaizen
                    🧭 CHIEF OF STAFF ── laporan mingguan + Kaizen (Isnin 7:45 pagi)
                       │  matlamat → BRIEF (issue berlabel "brief")
                    📋 PENGURUS PROGRAM ── memecah, mengagih, menjalankan gelung
                       │  satu tugas = satu pemilik = satu artifak (issue berlabel "tugas")
   ┌──────────┬───────┴────┬──────────┬──────────────┬───────────────┐
 🔎 Penyelidik  🛠 Pembina  🧪 Penguji  🔍 Penyemak  📐 Ahli Ekonomi  🔧 Penambah Baik
   Data
```

## Siapa buat apa

Setiap peranan memiliki satu kata kerja dan satu artifak. Tiada dua pekerja menghasilkan artifak yang sama.

| Peranan | Kata kerja | Menerima | Menghasilkan | Tidak boleh |
|---|---|---|---|---|
| 🧭 **Chief of Staff** (prompt sesi: [`prompts/chief-of-staff.md`](prompts/chief-of-staff.md)) | menyelaras | matlamat Pelulus, laporan PM, QA | BRIEF untuk PM; laporan mingguan; Kaizen Review | membuat kerja sendiri; merge |
| 📋 **Pengurus Program** (prompt sesi: [`prompts/pm.md`](prompts/pm.md)) | mengurus | issue `brief` yang diluluskan | issue `tugas`; menjalankan gelung; laporan kepada CoS | menulis kod; mencipta pekerja di luar ROSTER |
| 🔎 **Penyelidik Data** ([`.claude/agents/penyelidik-data.md`](../.claude/agents/penyelidik-data.md)) | menyiasat | tugas + sumber | **Nota Fakta**: jadual DOSM, medan, tarikh, URL, apa yang TIADA | memberi pendapat; menulis kod |
| 🛠 **Pembina** ([`.claude/agents/pembina.md`](../.claude/agents/pembina.md)) | membina | tugas + Nota Fakta | **cawangan + PR draf** | menilai kerja sendiri; merge |
| 🧪 **Penguji** ([`.claude/agents/penguji.md`](../.claude/agents/penguji.md)) | memecahkan | PR draf | **Laporan Ujian**: run-all, BM/EN, 360px, langkah ulang | membaiki |
| 🔍 **Penyemak** ([`.claude/agents/penyemak.md`](../.claude/agents/penyemak.md)) | menilai | PR + Laporan Ujian + BRIEF | **Keputusan SEMAKAN**: PASS/FAIL Q1–Q5, skor, 3 pembetulan | menulis semula kerja |
| 📐 **Ahli Ekonomi** ([`.claude/agents/ahli-ekonomi.md`](../.claude/agents/ahli-ekonomi.md)) | mengesahkan | PR yang menyentuh angka, formula atau tafsiran | **Keputusan EKONOMI**: PASS/FAIL ketepatan + 3 pembetulan | menilai gaya atau kod |
| 🔧 **Penambah Baik** ([`.claude/agents/penambah-baik.md`](../.claude/agents/penambah-baik.md)) | membaiki & mencatat | PR + pembetulan + kegagalan | **PR yang dibaiki + 1 pengajaran** dalam LESSONS | menulis pengajaran untuk satu tugas sahaja |

Kenapa enam pekerja, bukan tiga:
- **Penyelidik Data:** projek ini dibina atas data rasmi, dan larangan mereka data ialah peraturan nombor satu. Mesti ada satu pekerja yang hanya mengumpul fakta sumber.
- **Penguji:** dipisahkan daripada Penyemak kerana kerjanya berbeza: dia menjalankan dan cuba memecahkan, bukan menilai.
- **Ahli Ekonomi:** mewakili piawai penilaian yang berbeza (ketepatan statistik dan tafsiran ekonomi). Penyemak kod tidak dapat menilainya dengan adil.

## Gelung

1. **Pelulus → CoS:** anda beri matlamat, dalam sesi CoS atau sebagai issue.
2. **CoS → BRIEF:** CoS menulis issue berlabel `brief` (format di bawah).
   - Ia boleh bergerak jika matlamat datang daripada anda, atau anda letak label `lulus`.
   - CoS tidak mencipta matlamat sendiri. Cadangannya menunggu label `lulus`.
3. **PM → TUGAS:** PM memecah BRIEF kepada issue `tugas`. Setiap tugas boleh disiapkan dalam satu laluan, dengan satu pemilik daripada ROSTER.
4. **Gelung bagi setiap tugas:**
   - **Penyelidik Data:** hanya jika tugas menyentuh angka atau data.
   - **Pembina** → **Penguji**.
   - **Penyemak:** sentiasa, ditambah **Ahli Ekonomi** jika tugas menyentuh angka.
   - Jika ada FAIL: **Penambah Baik** → Penguji → Penyemak (dan Ahli Ekonomi). Maksimum **3 pusingan semakan**.
   - Jika masih FAIL selepas pusingan 3: berhenti, dan eskalasi kepada CoS dengan sebabnya.
5. **PM → CoS:** laporan dalam issue BRIEF. **CoS → Anda:** laporan mingguan, Isnin.
6. **Kaizen setiap Isnin:**
   - CoS mencadangkan maksimum 3 perubahan pada BRIEF atau prompt.
   - Anda lulus atau tolak dalam issue laporan.
   - Ejen tidak mengubah dirinya sendiri.

## Format serahan

Output setiap ejen ialah input ejen seterusnya. Semua dalam GitHub.

**BRIEF** (issue, label `brief`, ditulis CoS):
```
Matlamat: <1 ayat>
Kenapa penting: <1–2 ayat>
Definisi siap: <maks 5 butir boleh diuji, selaras QUALITY BAR>
Kekangan: <daripada BRIEF projek>
Andaian: <apa yang CoS andaikan>
Soalan untuk Pelulus: <hanya jika benar-benar menyekat, atau "tiada">
```

**TUGAS** (issue, label `tugas` + `pekerja:<nama>` + `keutamaan:P1/P2/P3`, ditulis PM):
```
ID tugas: T-<brief#>-<n>
Pemilik: <nama daripada ROSTER>
Input: <tepat apa yang diterima: fail, issue, Nota Fakta>
Output: <format tepat, daripada OUTPUT FORMAT>
Kriteria terima: <daripada DONE MEANS + Q1–Q5 yang berkaitan>
```

**SEMAKAN** (komen pada PR, ditulis Penyemak atau Ahli Ekonomi):
```
SEMAKAN pusingan <n>/3 · <Penyemak|Ahli Ekonomi> · Keputusan: PASS | FAIL
| Kriteria | Skor 1–5 | Sebab satu baris |
Pembetulan teratas:
1. <apa> · <di mana: fail:baris> · <kenapa>
2. ...
3. ...
```

**PENGAJARAN** (satu baris dalam ops/LESSONS.md, ditulis Penambah Baik):
```
| YYYY-MM-DD | <jenis tugas> | <kesilapan> | <peraturan untuk mengelaknya> |
```

**LAPORAN PM** (komen pada issue BRIEF):
```
Tugas siap/terbuka: <n>/<n> · Pusingan setiap tugas: T-1: 1, T-2: 3 ...
Mencapai LOOP CAP: <tugas + sebab berulang gagal | tiada>
PR menunggu Pelulus: <pautan>
```

Metrik setiap tugas direkod oleh PM dalam `ops/kaizen/metrik.md` di cawangan `agents/ops`:
- pusingan yang digunakan;
- lulus kali pertama (ya/tidak);
- eskalasi.

## Jadual (Asia/Kuala_Lumpur)

| Bila | Siapa | Apa |
|---|---|---|
| Isnin 2:13 pagi | 🧪 Penguji (sapuan QA mingguan) | `bash tests/run-all.sh` pada main + PR minggu ini · [`prompts/qa-mingguan.md`](prompts/qa-mingguan.md) |
| Isnin 7:45 pagi | 🧭 Chief of Staff | laporan mingguan + Kaizen Review |
| Isnin 10:20 pagi | 📋 Pengurus Program | jalankan gelung bagi BRIEF yang diluluskan (maksimum 3 tugas seminggu) |
| bila-bila | Anda | beri matlamat; merge; tulis "deploy"; lulus Kaizen |

Bajet: QA 1 + CoS 1 + PM 1–3 = maksimum 5 sesi seminggu, jauh di bawah had 10.

## Menambah pekerja

Pilih pekerja mengikut kata kerja, bukan bilangan:
- Tambah hanya apabila satu jenis tugas terus gagal, atau memerlukan piawai penilaian yang berbeza.
- Calon seterusnya ialah 🛡 **Pemeriksa Keselamatan** (Fasa 4: kebergantungan, pengepala, akses ikut peranan). Ia hanya ditambah selepas kelulusan IT.
- Lebih daripada 6–7 pekerja, PM menjadi kesesakan. Pada tahap itu, kumpulkan tugas mengikut peringkat, bukan menambah pekerja.

Cara menambah:
1. Tulis barisnya dalam ROSTER di BRIEF.
2. Cipta `.claude/agents/<nama>.md` daripada templat pekerja generik dalam fail ini.
3. Jalankan `python3 scripts/check_agents.py`.

Templat pekerja generik:
```
Anda ialah <nama>. Anda memiliki satu kata kerja: <kata kerja>. Anda menerima satu tugas daripada Pengurus Program.
- Baca ops/BRIEF.md dan LESSONS FILE dahulu; gunakan setiap pengajaran yang berkaitan.
- Hasilkan tepat satu perkara: <artifak>, dalam format Output tugas.
- Jangan buat kata kerja pekerja lain walaupun anda nampak ia perlu. Maklumkan kepada PM.
- Akhiri dengan "Andaian saya:" (butir).
```

## Perbezaan daripada pek asal (dan sebabnya)

- **BRIEF tidak ditampal ke setiap prompt.** Setiap ejen diwajibkan membaca `ops/BRIEF.md` penuh sebagai langkah pertama. Satu sumber tidak boleh bercanggah, dan `scripts/check_agents.py` memastikan setiap ejen merujuknya.
- **Kaizen pada hari Isnin, bukan Jumaat.** Ia digabungkan dengan laporan mingguan CoS yang anda pilih, supaya jimat sesi.
- **Pekerja ialah sub-ejen Claude Code (`.claude/agents/`).** CoS dan PM ialah sesi utama yang memanggil mereka, kerana sub-ejen tidak boleh memanggil sub-ejen lain.
