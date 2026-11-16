/* =====================================================================
   Profil Strategik Produktiviti Negeri (State Productivity Strategic Profile)
   - model():    one reusable data model per state, built only from the datasets already in the site
                 (official DOSM state labour productivity, state GDP at constant 2015 prices, Labour Force Survey)
   - validate(): quality checks that must pass before a PDF can be downloaded
   - pdf():      A4 portrait, vector text/charts/infographics drawn with jsPDF (no screenshots)
   - render():   the "Jana Profil Strategik Negeri" page
   Rules: never invent statistics; every figure carries its reference year and source;
   projections are scenarios, not targets; recommendations are proposals.
   ===================================================================== */
const SP = (() => {
  const GK = { agri: 'p1', mining: 'p2', mfg: 'p3', cons: 'p4', serv: 'p5' };
  const SHORT = { agri: 'Pertanian', mining: 'Perlombongan & pengkuarian', mfg: 'Pembuatan', cons: 'Pembinaan', serv: 'Perkhidmatan' };
  const nm = id => id === 'national' ? 'Malaysia' : STATE_BY_ID[id].bm;
  const cg = (a, b, n) => a > 0 && b > 0 && n > 0 ? (Math.pow(b / a, 1 / n) - 1) * 100 : null;
  const n0 = v => v == null ? '-' : Math.round(v).toLocaleString('en-US');
  const n1 = v => v == null ? '-' : v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const n2 = v => v == null ? '-' : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pc = (v, d = 1) => v == null ? '-' : v.toFixed(d) + '%';
  const ps = (v, d = 1) => v == null ? '-' : (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(d) + '%';
  const rmBil = v => v == null ? '-' : 'RM' + n1(v / 1000) + ' bil.';
  const rmRibu = v => v == null ? '-' : 'RM' + n1(v / 1000) + ' ribu';
  const lsj = a => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' dan ' + a[a.length - 1];
  const SRC = {
    lp: 'DOSM, Produktiviti Buruh Negeri 2015-2025 (Jadual 1 dan 3)',
    gdp: 'DOSM, KDNK mengikut Negeri, harga malar 2015 (OpenDOSM gdp_state_real_supply)',
    lfs: 'DOSM, Survei Tenaga Buruh (OpenDOSM lfs_state_sex)',
    calc: 'Analisis dan pengiraan Perbadanan Produktiviti Malaysia (MPC)',
  };

  /* ---------------- data model ---------------- */
  function model(id, o = {}) {
    const opt = { uplift: 1, end: 2035, ...o };
    const a = A(S.snap), ec = M6E.econ(), G = ec.gdp, L = ec.lfs;
    const at = (obj, ys, w, y) => { const i = ys.indexOf(y); return obj && obj[w] && i >= 0 && obj[w][i] != null ? obj[w][i] : null; };
    const gdp = (w, y, p = 'p0') => at(G.v[p], G.years, w, y), emp = (w, y) => at(L.emp, L.years, w, y), lp = (w, y) => a.level(w, y);
    const lpYears = S.snap.years.filter(y => lp('national', y) != null), Y = Math.min(opt.year || a.latest, a.latest), Y0 = lpYears[0];
    const gY = Math.min(Y, G.years[G.years.length - 1]), eY = Math.min(Y, L.years[L.years.length - 1]);
    const special = SPECIAL_FT.includes(id);
    // KPI cards
    const gdpV = gdp(id, gY), gdpN = gdp('national', gY), gdpG = gdp(id, gY - 1) ? (gdpV / gdp(id, gY - 1) - 1) * 100 : null, gdpGN = gdp('national', gY - 1) ? (gdpN / gdp('national', gY - 1) - 1) * 100 : null;
    const empV = emp(id, eY), empN = emp('national', eY), lpV = lp(id, Y), lpN = lp('national', Y);
    const per = [[Y0, 2019], [2019, 2021], [2021, Y]].filter(([p, q]) => q > p && q <= Y && p >= Y0).map(([p, q]) => ({ p, q, v: cg(lp(id, p), lp(id, q), q - p), n: cg(lp('national', p), lp('national', q), q - p) }));
    const lpC = cg(lp(id, Y0), lpV, Y - Y0), lpCN = cg(lp('national', Y0), lpN, Y - Y0);
    const rk = a.ranking(Y), rank = rk.findIndex(r => r.id === id) + 1, rk0 = a.ranking(Y0).findIndex(r => r.id === id) + 1;
    const quad = a.quadrant(id), mom = a.momentum(id), momN = a.momentum('national');
    const kpi = {
      gdp: { v: gdpV, y: gY, share: gdpV / gdpN * 100, nat: gdpN, src: SRC.gdp },
      gdpg: { v: gdpG, y: gY, nat: gdpGN, src: SRC.gdp },
      emp: { v: empV, y: eY, share: empV / empN * 100, nat: empN, src: SRC.lfs },
      lp: { v: lpV, y: Y, nat: lpN, gap: (lpV / lpN - 1) * 100, rank, n: rk.length, src: SRC.lp },
      lpg: { v: lpC, y0: Y0, y: Y, nat: lpCN, per, src: SRC.lp },
    };
    // history (Chart A)
    const hy = lpYears.filter(y => y <= Y);
    const hist = { years: hy, gdp: hy.map(y => gdp(id, y) == null ? null : gdp(id, y) / 1000), lp: hy.map(y => lp(id, y) == null ? null : lp(id, y) / 1000), emp: hy.map(y => emp(id, y)) };
    // state comparison quadrant (substitute for the district chart: no district data in the site)
    const sd = STATES.filter(s => !SPECIAL_FT.includes(s.id)).map(s => ({ id: s.id, n: s.bm, x: lp(s.id, Y0) / 1000, y: lp(s.id, Y) / 1000, sh: gdp(s.id, gY) / gdpN * 100 })).filter(p => p.x && p.y);
    const qd = { x: lp('national', Y0) / 1000, y: lpN / 1000 };
    // sectors: VA (constant 2015 prices) and official sector productivity; workers estimated as VA / productivity
    const sec = SECTORS.map(s => {
      const va = gdp(id, gY, GK[s.id]), sp = a.sectorVal(s.id, id, Y), nd = a.sectorND(s.id, id, Y) || sp == null || !(sp > 0), spN = a.sectorVal(s.id, 'national', Y);
      const g = a.cagr(id, Y0, Y, '3.' + s.n), g3 = a.cagr(id, Y - 3, Y, '3.' + s.n), gN = a.cagr('national', Y0, Y, '3.' + s.n);
      return { id: s.id, name: s.bm, short: SHORT[s.id], va, lp: nd ? null : sp, lpN: spN, emp: !nd && va > 0 ? va * 1000 / sp : null, g, g3, gN, relN: !nd && spN ? sp / spN * 100 : null };
    });
    const vaT = sec.reduce((t, r) => t + (r.va || 0), 0), empT = sec.reduce((t, r) => t + (r.emp || 0), 0), lpAgg = empT ? vaT * 1000 / empT : null;
    sec.forEach(r => { r.vaSh = r.va != null && vaT ? r.va / vaT * 100 : null; r.empSh = r.emp != null && empT ? r.emp / empT * 100 : null; r.rel = r.lp != null && lpAgg ? r.lp / lpAgg * 100 : null; });
    // priority classification: transparent scoring, evidence only (qualitative criteria flagged for validation)
    const ok = sec.filter(r => r.lp != null && r.va > 0);
    // A (lonjakan): sizeable VA share and productivity at or above the state and national sector level, or fast growth
    // B (pengupayaan): large share of workers with productivity below the state average or the national sector level
    ok.forEach(r => {
      r.isB = r.id !== 'mining' && r.empSh >= 8 && (r.rel < 100 || (r.relN != null && r.relN < 95));
      r.isA = r.vaSh >= 5 && ((r.rel >= 100 && (r.relN == null || r.relN >= 95)) || (r.g != null && lpC != null && r.g >= lpC + 0.5 && r.rel >= 90));
      if (r.isA && r.isB) { if (r.empSh >= 20 && r.relN != null && r.relN < 100) r.isA = false; else r.isB = false; }
      r.sL = (r.rel || 0) / 100 + (r.relN || 0) / 100 + (r.g != null && lpC ? r.g / Math.max(lpC, 0.5) : 0); r.sE = (r.empSh || 0) / 10 + (100 - Math.min(r.rel || 100, r.relN || 100)) / 20;
    });
    let lon = ok.filter(r => r.isA).sort((x, y) => y.sL - x.sL), pen = ok.filter(r => r.isB).sort((x, y) => y.sE - x.sE);
    if (!lon.length) { const c = ok.filter(r => r.vaSh >= 5 && (!pen.includes(r) || pen.length > 1)).sort((x, y) => y.sL - x.sL)[0]; if (c) { lon = [c]; pen = pen.filter(r => r !== c); } }
    if (!pen.length) pen = ok.filter(r => !lon.includes(r) && r.id !== 'mining').sort((x, y) => y.sE - x.sE).slice(0, 1);
    lon.forEach(r => r.cat = 'A'); pen.forEach(r => r.cat = 'B');
    // simulation (transparent, reproducible): baseline 2026-2030 = mean of 3-year momentum and long-run CAGR, 2031-end = long-run CAGR; improvement = baseline + uplift
    const gF = G.years.find(y => gdp(id, y) != null), eC = cg(emp(id, Y0), emp(id, eY), eY - Y0), gC = cg(gdp(id, gF), gdp(id, gY), gY - gF);
    const b1 = mom != null && lpC != null ? (mom + lpC) / 2 : lpC, b2 = lpC, u = +opt.uplift || 0, end = +opt.end || 2035, mid = Math.min(2030, end);
    const path = (v0, y0, r1, r2) => { const out = [], ys = []; let v = v0; for (let y = y0 + 1; y <= end; y++) { v *= 1 + (y <= mid ? r1 : r2) / 100; out.push(v); ys.push(y); } return { ys, v: out }; };
    const eR = eC ?? 0, gR = r => ((1 + r / 100) * (1 + eR / 100) - 1) * 100;
    const sim = { y0: Y, end, mid, u, b1, b2, i1: b1 + u, i2: b2 + u, eR, gC,
      lpBase: path(lpV, Y, b1, b2), lpImp: path(lpV, Y, b1 + u, b2 + u),
      gdpBase: path(gdp(id, gY), gY, gR(b1), gR(b2)), gdpImp: path(gdp(id, gY), gY, gR(b1 + u), gR(b2 + u)), gY,
      g1: gR(b1), g2: gR(b2), gi1: gR(b1 + u), gi2: gR(b2 + u),
      sec: [...lon, ...pen].map(r => { const sb1 = r.g3 != null && r.g != null ? (r.g3 + r.g) / 2 : r.g, sb2 = r.g; return { id: r.id, cat: r.cat, name: r.short, h: r.g, b1: sb1, b2: sb2, i1: sb1 == null ? null : sb1 + u, i2: sb2 == null ? null : sb2 + u }; }),
    };
    const avg = (r1, r2) => { const n1y = mid - Y, n2y = end - mid; return n1y + n2y > 0 ? (Math.pow(Math.pow(1 + r1 / 100, n1y) * Math.pow(1 + r2 / 100, n2y), 1 / (n1y + n2y)) - 1) * 100 : r1; };
    sim.bAll = avg(b1, b2); sim.iAll = avg(b1 + u, b2 + u); sim.gAll = avg(sim.g1, sim.g2); sim.giAll = avg(sim.gi1, sim.gi2);
    sim.lpEndB = sim.lpBase.v[sim.lpBase.v.length - 1]; sim.lpEndI = sim.lpImp.v[sim.lpImp.v.length - 1];
    // labour market context
    const ur = at(L.urate, L.years, id, eY), urN = at(L.urate, L.years, 'national', eY), pr = at(L.prate, L.years, id, eY), prN = at(L.prate, L.years, 'national', eY), fpr = at(L.fprate, L.years, id, eY);
    const m = { id, name: nm(id), special, opt, Y, Y0, gY, eY, kpi, hist, sd, qd, quad, mom, momN, rk0, sec, vaT, empT, lpAgg, lon, pen, sim, lab: { ur, urN, pr, prN, fpr }, src: SRC };
    m.text = narrative(m); m.qc = validate(m);
    return m;
  }

  /* ---------------- narrative (facts / calculations / hypotheses / proposals kept apart) ---------------- */
  function narrative(m) {
    const K = m.kpi, S0 = m.name, big = [...m.sec].filter(r => r.vaSh != null).sort((x, y) => y.vaSh - x.vaSh), top2 = big.slice(0, 2).map(r => r.short.toLowerCase());
    const above = K.lp.gap >= 0, gq = { lead: 'Peneraju', catch: 'Pengejar', slow: 'Tinggi tetapi perlahan', attn: 'Perlu perhatian' }[m.quad];
    const gapTxt = above ? `${pc(K.lp.gap)} lebih tinggi` : `${pc(Math.abs(K.lp.gap))} lebih rendah`;
    const t = {};
    t.bg = [
      `Produktiviti negeri menentukan sejauh mana pertumbuhan ekonomi dipacu oleh nilai yang lebih tinggi bagi setiap pekerja, bukan semata-mata oleh pertambahan tenaga kerja. Prestasi dan cabaran produktiviti tidak seragam antara negeri kerana perbezaan struktur sektor, keupayaan firma, kemahiran, teknologi, akses pasaran dan ekosistem ekonomi setempat. Oleh itu, negeri merupakan unit penting untuk menterjemahkan agenda produktiviti nasional kepada intervensi yang lebih bersasar.`,
      `Ekonomi ${S0} bernilai ${rmBil(K.gdp.v)} pada ${K.gdp.y} (harga malar 2015), iaitu ${pc(K.gdp.share)} daripada KDNK Malaysia, dan didominasi oleh sektor ${lsj(top2)} (${big.slice(0, 2).map(r => pc(r.vaSh, 0)).join(' dan ')} daripada nilai ditambah sektor). Produktiviti buruh ${S0} ialah ${rmRibu(K.lp.v)} setiap pekerja pada ${K.lp.y}, ${gapTxt} berbanding purata nasional, dan berada di kedudukan ${K.lp.rank} daripada ${K.lp.n} negeri dan wilayah persekutuan.`,
      above ? `Cabaran utama ialah mengekalkan kelebihan produktiviti sambil memperluas manfaatnya kepada sektor yang menggaji ramai pekerja. Peluang terletak pada pengukuhan sektor bernilai tinggi dan rantaian nilainya.` : `Cabaran utama ialah merapatkan jurang produktiviti dengan purata nasional, terutamanya dalam sektor yang menggaji ramai pekerja. Peluang terletak pada peningkatan kecekapan sektor sedia ada dan peralihan kepada aktiviti bernilai tambah lebih tinggi.`,
    ];
    t.purpose = `Profil ini menyediakan asas bukti yang konsisten untuk merancang hala tuju produktiviti ${S0}: kedudukan prestasi semasa, sektor yang berpotensi menjadi pemacu, simulasi kesan peningkatan produktiviti hingga ${m.sim.end}, serta kerangka dan cadangan tindakan untuk disahkan bersama Kerajaan Negeri dan agensi berkaitan.`;
    const pTxt = K.lpg.per.map(p => `${p.p}-${p.q}: ${ps(p.v)} setahun`).join('; ');
    t.kpi = `${S0} mencatat pertumbuhan KDNK ${ps(K.gdpg.v)} pada ${K.gdpg.y} (Malaysia ${ps(K.gdpg.nat)}). Produktiviti meningkat purata ${ps(K.lpg.v)} setahun dalam tempoh ${K.lpg.y0}-${K.lpg.y} berbanding ${ps(K.lpg.nat)} bagi Malaysia (${pTxt}). Dengan ${n1(K.emp.v)} ribu pekerja (${pc(K.emp.share)} daripada guna tenaga Malaysia), ${K.gdp.share > K.emp.share ? 'sumbangan KDNK negeri melebihi bahagian pekerjanya, petanda produktiviti di atas purata' : 'bahagian pekerja negeri melebihi sumbangan KDNKnya, petanda produktiviti di bawah purata'}.`;
    const h = m.hist, iL = h.years.length - 1, i0 = Math.max(0, h.gdp.findIndex(v => v != null)), e0 = Math.max(0, h.emp.findIndex(v => v != null)), gG = cg(h.gdp[i0], h.gdp[iL], h.years[iL] - h.years[i0]), eG = cg(h.emp[e0], h.emp[iL], h.years[iL] - h.years[e0]);
    const covid = h.years.includes(2020) && h.years.includes(2019) ? (h.lp[h.years.indexOf(2020)] / h.lp[h.years.indexOf(2019)] - 1) * 100 : null;
    t.histA = `${h.years[i0] > h.years[0] ? `KDNK ${S0} diterbitkan secara berasingan sejak ${h.years[i0]}. ` : ''}KDNK ${S0} meningkat daripada ${rmBil(h.gdp[i0] * 1000)} pada ${h.years[i0]} kepada ${rmBil(h.gdp[iL] * 1000)} pada ${h.years[iL]} (${ps(gG)} setahun), manakala guna tenaga ${eG >= 0 ? 'meningkat' : 'berubah'} ${ps(eG)} setahun kepada ${n1(h.emp[iL])} ribu pekerja.${covid != null ? ` Produktiviti ${covid < 0 ? 'jatuh ' + pc(Math.abs(covid)) : 'kekal ' + ps(covid)} pada 2020 ketika pandemik dan kini berada pada ${rmRibu(m.kpi.lp.v)}.` : ''} ${gG != null && eG != null ? (gG - eG >= eG ? 'Sebahagian besar pertumbuhan datang daripada peningkatan nilai bagi setiap pekerja.' : 'Pertumbuhan masih banyak bergantung pada pertambahan pekerja; ruang besar wujud untuk pertumbuhan yang lebih dipacu produktiviti.') : ''}`;
    const me = m.sd.find(p => p.id === m.id), qname = p => p.y >= m.qd.y ? (p.x >= m.qd.x ? 'Peneraju' : 'Melonjak') : (p.x >= m.qd.x ? 'Hilang momentum' : 'Pengukuhan');
    t.histB = me ? `Dalam perbandingan antara negeri, ${S0} berada dalam kuadran "${qname(me)}" (produktiviti ${m.Y0}: ${rmRibu(me.x * 1000)}; ${m.Y}: ${rmRibu(me.y * 1000)}). Kumpulan prestasi berdasarkan paras dan momentum 3 tahun: ${gq}. Data produktiviti peringkat daerah tidak terdapat dalam set data laman ini, jadi perbandingan negeri digunakan sebagai pengganti.` : `${S0} tidak dimasukkan dalam carta kuadran kerana tenaga kerjanya kecil dan ekonominya khusus. Data produktiviti peringkat daerah tidak terdapat dalam set data laman ini.`;
    const L0 = m.lon.map(r => r.short.toLowerCase()), P0 = m.pen.map(r => r.short.toLowerCase());
    t.sec = `Berdasarkan bukti kuantitatif, sektor ${lsj(L0)} dicadangkan sebagai Sektor Lonjakan Produktiviti kerana gabungan produktiviti, sumbangan nilai ditambah dan momentum pertumbuhan. Sektor ${lsj(P0)} dicadangkan sebagai Sektor Pengupayaan Produktiviti kerana menggaji bahagian pekerja yang besar dengan produktiviti di bawah purata negeri. Klasifikasi ini perlu disahkan dengan keutamaan pembangunan negeri dan kekuatan rantaian nilai, yang memerlukan penilaian kualitatif.`;
    const s = m.sim;
    t.sim = `Dalam senario garis dasar, produktiviti ${S0} mencapai ${rmRibu(s.lpEndB)} pada ${s.end}. Peningkatan ${n1(s.u)} mata peratus setahun di atas garis dasar menaikkannya kepada ${rmRibu(s.lpEndI)}, iaitu ${pc((s.lpEndI / s.lpEndB - 1) * 100)} lebih tinggi. Unjuran ini ialah senario ilustratif berdasarkan andaian yang dinyatakan, bukan sasaran rasmi kerajaan.`;
    const weak = [...m.sec].filter(r => r.relN != null && r.id !== 'mining').sort((x, y) => x.relN - y.relN)[0], strong = [...m.sec].filter(r => r.relN != null && r.id !== 'mining').sort((x, y) => y.relN - x.relN)[0];
    t.fw = `Bagi ${S0}, sektor ${strong ? strong.short.toLowerCase() : '-'} paling kukuh berbanding sektor yang sama di peringkat nasional (${strong ? pc(strong.relN, 0) : '-'}), manakala ${weak ? weak.short.toLowerCase() : '-'} paling ketinggalan (${weak ? pc(weak.relN, 0) : '-'}). Jurang ini menunjukkan di mana keupayaan produktif perlu dinilai dahulu. ${m.lab.ur != null && m.lab.urN != null ? `Kadar pengangguran ${pc(m.lab.ur)} (Malaysia ${pc(m.lab.urN)}) dan penyertaan tenaga buruh ${pc(m.lab.pr)} (Malaysia ${pc(m.lab.prN)}) memberi gambaran persekitaran pasaran buruh.` : ''}`;
    t.q = {
      market: [`Pasaran domestik dan eksport manakah yang boleh meluaskan skala sektor ${lsj(L0)}?`, `Adakah firma tempatan cukup terhubung dengan rantaian nilai syarikat besar dan pelabur di ${S0}?`],
      cap: [`Apakah punca produktiviti sektor ${weak ? weak.short.toLowerCase() : 'utama'} di ${S0} berada pada ${weak ? pc(weak.relN, 0) : '-'} daripada paras nasional sektor yang sama?`, `Sejauh mana automasi, pendigitalan dan kemahiran pekerja telah diguna pakai dalam sektor ${lsj(P0)}?`],
      env: [`Adakah akses pembiayaan, infrastruktur dan kelulusan peraturan menghalang pelaburan untuk menaik taraf teknologi?`, `${m.lab.ur != null && m.lab.ur > m.lab.urN ? `Bagaimana menyerap tenaga kerja yang belum digunakan sepenuhnya (pengangguran ${pc(m.lab.ur)})?` : `Bagaimana menangani kekangan tenaga kerja ketika pengangguran rendah (${pc(m.lab.ur)})?`}`],
    };
    return t;
  }

  // proposals library (sector-specific; agencies are potential implementers, not commitments)
  const LIB = {
    agri: { k: 'Mekanisasi rendah dan skala ladang kecil', i: 'Pertanian pintar dan mekanisasi; penyatuan pengeluar; pemprosesan hiliran', ag: 'KPKM, MARDI, FAMA, MPC' },
    mining: { k: 'Pergantungan pada komoditi dan rantaian nilai pendek', i: 'Pembangunan industri hiliran dan perkhidmatan sokongan bernilai tinggi', ag: 'Kerajaan Negeri, MIDA, Petronas/industri' },
    mfg: { k: 'Penggunaan automasi dan teknologi Industri 4.0 yang tidak sekata', i: 'Penilaian kesediaan Industri4WRD, geran automasi, latihan kemahiran teknikal', ag: 'MITI, MIDA, MPC, HRD Corp' },
    cons: { k: 'Bergantung pada buruh dan kaedah konvensional', i: 'Sistem Binaan Berindustri (IBS) dan BIM; pensijilan kemahiran pekerja binaan', ag: 'KKR, CIDB, MPC' },
    serv: { k: 'Ramai PMKS berproduktiviti rendah dan pendigitalan terhad', i: 'Pendigitalan PMKS, e-dagang, latihan kemahiran digital dan pengurusan', ag: 'MDEC, SME Corp, MPC, Kerajaan Negeri' },
  };
  function plan(m) {
    return [...m.lon, ...m.pen].map(r => ({ sec: r.short, cat: r.cat, fact: r.relN != null ? `Produktiviti ${pc(r.relN, 0)} daripada paras nasional sektor; ${pc(r.empSh, 0)} pekerja (anggaran)` : '-', con: LIB[r.id].k, int: LIB[r.id].i, ag: LIB[r.id].ag,
      time: r.cat === 'A' ? 'Sederhana (2028-2030)' : 'Pendek (2026-2027)', kpi: `Produktiviti sektor: RM${n0(r.lp)} (${m.Y}); senario ${ps((m.sim.sec.find(x => x.id === r.id) || {}).i1)} setahun` }));
  }

  /* ---------------- quality control ---------------- */
  function validate(m) {
    const c = [], add = (k, ok, d) => c.push({ k, ok: !!ok, d });
    add('Negeri dipilih', STATE_BY_ID[m.id] && m.name === STATE_BY_ID[m.id].bm, m.name);
    add('Pemetaan set data (KDNK, guna tenaga, produktiviti)', m.kpi.gdp.v > 0 && m.kpi.emp.v > 0 && m.kpi.lp.v > 0, `KDNK ${m.gY}, LFS ${m.eY}, produktiviti ${m.Y}`);
    add('Unit: KDNK RM juta, pekerja ribu, produktiviti RM', m.kpi.gdp.v > 1000 && m.kpi.emp.v > 5 && m.kpi.emp.v < 10000 && m.kpi.lp.v > 10000, '');
    const agg = m.lpAgg, off = m.kpi.lp.v; add('Formula produktiviti agregat = jumlah VA / jumlah pekerja (bukan jumlah produktiviti sektor)', agg > 0 && Math.abs(m.vaT * 1000 / m.empT - agg) < 1e-6, `${n0(agg)} berbanding rasmi ${n0(off)}`);
    add('Perbandingan nasional menggunakan siri yang sama', m.kpi.lp.nat > 0 && Math.abs(m.kpi.lp.gap - (m.kpi.lp.v / m.kpi.lp.nat - 1) * 100) < 1e-9, '');
    add('Sejarah dan unjuran diasingkan', m.sim.lpBase.ys[0] === m.Y + 1 && m.hist.years[m.hist.years.length - 1] <= m.Y, `unjuran bermula ${m.Y + 1}`);
    add('Rujukan sumber tersedia', Object.values(m.src).every(Boolean), '');
    add('Tiada angka Johor disalin ke negeri lain', m.id === 'johor' || Math.abs(m.kpi.gdp.v - (M6E.econ().gdp.v.p0.johor[M6E.econ().gdp.years.indexOf(m.gY)])) > 1, '');
    add('Klasifikasi sektor tersedia', m.lon.length > 0 && m.pen.length > 0, `A: ${m.lon.map(r => r.short).join(', ')}; B: ${m.pen.map(r => r.short).join(', ')}`);
    add('Tiada nilai NaN dalam model', !/NaN|Infinity|undefined/.test(JSON.stringify(m.kpi) + JSON.stringify(m.text)), '');
    return c;
  }

  /* ---------------- PDF (A4 portrait, mm) ---------------- */
  const C = { navy: [27, 54, 93], navy2: [16, 37, 66], blue: [41, 98, 168], sky: [222, 233, 245], red: [200, 16, 46], ink: [33, 37, 41], mute: [105, 112, 122], line: [214, 220, 228], soft: [244, 247, 251], green: [46, 125, 50], purple: [94, 72, 160], gold: [214, 158, 46], white: [255, 255, 255] };
  const W = 210, H = 297, M = 14;
  const T = s => String(s ?? '').replace(/[−–—]/g, '-').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[^\x00-\xFF]/g, '');
  async function img(url) { const r = await fetch(url); if (!r.ok) throw new Error('img ' + url); const b = await r.blob(); return await new Promise(res => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b); }); }
  const mapPolys = (() => { let cache = null; return () => cache || (cache = Object.fromEntries(Object.entries(MAPGEO.states).map(([k, v]) => [k, v.d.split(/(?=M)/).map(sp => sp.replace(/[MZ]/g, ' ').trim().split('L').map(pt => pt.trim().split(',').map(Number)).filter(p => p.length === 2 && !isNaN(p[0])))]))); })();

  async function pdf(m) {
    const jsPDF = await loadLib('jspdf'), d = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const flag = await img(`assets/flags/${m.id}.png`).catch(() => null), logo = await img('assets/mpc-logo.png').catch(() => null);
    const fill = c => d.setFillColor(...c), draw = c => d.setDrawColor(...c), tc = c => d.setTextColor(...c);
    const font = (sz, b = false, it = false) => { d.setFont('helvetica', b ? (it ? 'bolditalic' : 'bold') : it ? 'italic' : 'normal'); d.setFontSize(sz); };
    const LAY = [];
    const text = (s, x, y, o = {}) => { const t = T(s), w = d.getTextWidth(t), x0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x; if (!o.angle && (x0 < 3 || x0 + w > W - 3 || y > H - 4 || y < 4)) LAY.push(`hlm ${page}: "${t.slice(0, 40)}"`); return d.text(t, x, y, o); };
    const para = (s, x, y, w, sz = 8.6, lh = 1.42, col = C.ink, b = false) => { font(sz, b); tc(col); const ls = d.splitTextToSize(T(s), w); ls.forEach((l, i) => d.text(l, x, y + i * sz * 0.3528 * lh)); return y + ls.length * sz * 0.3528 * lh; };
    const opa = v => d.setGState(new d.GState({ opacity: v }));
    let page = 0;
    const map = (x, y, w, hi, base, hiC, alpha = 1) => { const P = mapPolys(), s = w / MAPGEO.w; opa(alpha); Object.entries(P).forEach(([k, polys]) => { polys.forEach(poly => { if (poly.length < 3) return; fill(k === hi ? hiC : base); draw(k === hi ? hiC : base); d.setLineWidth(0.05); const pts = poly.map(p => [x + p[0] * s, y + p[1] * s]), dl = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]); d.lines(dl, pts[0][0], pts[0][1], [1, 1], 'FD', true); }); }); opa(1); };
    const header = () => {
      for (let i = 0; i < 24; i++) { const t = i / 23; fill([Math.round(232 + (255 - 232) * t), Math.round(240 + (255 - 240) * t), Math.round(248 + (255 - 248) * t)]); d.rect(0, i * 1.6, W, 1.7, 'F'); }
      map(108, 6, 86, m.id, [205, 217, 233], [200, 16, 46], 0.85);
      if (flag) { draw(C.line); d.setLineWidth(0.2); d.addImage(flag, 'PNG', M, 7, m.id === 'putrajaya' ? 18 : 30, m.id === 'putrajaya' ? 18 : 15); }
      font(10.5, true); tc(C.navy); text(m.name.toUpperCase(), M, 30);
    };
    const footer = () => { const ft = T('Profil Strategik Produktiviti Negeri · ' + m.name); font(7.5); const fw = d.getTextWidth(ft); draw(C.navy); d.setLineWidth(0.3); d.line(M, H - 12, W - M - 16 - fw - 3, H - 12); tc(C.mute); text(ft, W - M - 13, H - 11, { align: 'right' }); draw(C.red); d.setLineWidth(0.5); d.roundedRect(W - M - 9, H - 15.2, 9, 6.4, 1.2, 1.2, 'S'); font(8.5, true); tc(C.ink); text(String(page), W - M - 4.5, H - 10.8, { align: 'center' }); };
    const newPage = (hdr = true) => { if (page) d.addPage(); page++; if (hdr) header(); };
    const secBar = (num, title, y, sub) => { fill(C.navy); d.roundedRect(M, y, W - 2 * M, 10, 1.5, 1.5, 'F'); fill(C.red); d.roundedRect(M + 2, y + 1.5, 7, 7, 1, 1, 'F'); font(11, true); tc(C.white); text(String(num), M + 5.5, y + 6.6, { align: 'center' }); font(10.5, true); text(title.toUpperCase(), M + 13, y + 6.6); if (sub) { font(7.6); tc(C.mute); text(sub, M, y + 14.5); } return y + (sub ? 18 : 14); };
    const box = (x, y, w, h, c = C.soft, r = 2) => { fill(c); d.roundedRect(x, y, w, h, r, r, 'F'); };
    const tag = (s, x, y, c) => { font(6.4, true); const tw = d.getTextWidth(T(s)) + 3; fill(c); d.roundedRect(x, y - 3, tw, 4.2, 1, 1, 'F'); tc(C.white); text(s, x + 1.5, y); return x + tw + 1.5; };
    const src = (s, y) => { font(6.4, false, true); tc(C.mute); const ls = d.splitTextToSize(T('Sumber: ' + s), W - 2 * M); ls.forEach((l, i) => d.text(l, M, y + i * 2.8)); return y + ls.length * 2.8; };
    // generic vector line chart
    function lineChart(x, y, w, h, o) {
      const { years, series, fmt = v => n1(v), min, max, split } = o, all = series.flatMap(s => s.v).filter(v => v != null);
      let lo = min ?? Math.min(...all), hi = max ?? Math.max(...all); const pad = (hi - lo) * 0.08 || 1; lo = min ?? lo - pad; hi = max ?? hi + pad;
      const step = nice((hi - lo) / 5); lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
      const X0 = x + 12, Wd = w - 16, Y0 = y + h - 8, Hd = h - 12, px = i => X0 + (years.length === 1 ? 0 : i / (years.length - 1) * Wd), py = v => Y0 - (v - lo) / (hi - lo) * Hd;
      font(6.2); tc(C.mute); draw(C.line); d.setLineWidth(0.15);
      for (let v = lo; v <= hi + 1e-9; v += step) { d.line(X0, py(v), X0 + Wd, py(v)); text(fmt(v), X0 - 1.5, py(v) + 0.9, { align: 'right' }); }
      years.forEach((yy, i) => { if (years.length <= 12 || i % 2 === 0 || i === years.length - 1) text(String(yy), px(i), Y0 + 3.6, { align: 'center' }); });
      if (split != null) { const i = years.indexOf(split); if (i >= 0) { fill([235, 242, 250]); d.rect(px(i), y + 2, X0 + Wd - px(i), Hd + (Y0 - y - 2 - Hd), 'F'); font(6.6, true); tc(C.navy); text(o.splitLabel || '', X0 + Wd - 1, y + 5, { align: 'right' }); draw(C.line); for (let v = lo; v <= hi + 1e-9; v += step) d.line(px(i), py(v), X0 + Wd, py(v)); } }
      series.forEach(s => { d.setLineWidth(s.w || 0.7); draw(s.c); if (s.dash) d.setLineDashPattern(s.dash, 0); let prev = null; s.v.forEach((v, i) => { const xi = px(i + (s.off || 0)); if (v == null) { prev = null; return; } if (prev) d.line(prev[0], prev[1], xi, py(v)); prev = [xi, py(v)]; if (s.dots) { fill(s.c); d.circle(xi, py(v), 0.75, 'F'); } if (s.labels && (i % (s.labelEvery || 1) === 0 || i === s.v.length - 1)) { font(5.8, true); tc(s.c); text(fmt(v), xi, py(v) - 1.6, { align: 'center' }); } }); d.setLineDashPattern([], 0); });
      return { px, py, X0, Y0, Wd };
    }
    function nice(r) { const p = Math.pow(10, Math.floor(Math.log10(r || 1))), f = r / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
    function legend(items, x, y) { font(6.8); items.forEach(([l, c, dash]) => { draw(c); d.setLineWidth(0.8); if (dash) d.setLineDashPattern(dash, 0); d.line(x, y - 1, x + 6, y - 1); d.setLineDashPattern([], 0); tc(C.ink); text(l, x + 7.5, y); x += d.getTextWidth(T(l)) + 13; }); }

    /* ---- page 1: cover + contents ---- */
    newPage(false);
    for (let i = 0; i < 60; i++) { const t = i / 59; fill([Math.round(16 + 20 * t), Math.round(37 + 30 * t), Math.round(66 + 50 * t)]); d.rect(0, i * 5, W, 5.1, 'F'); }
    map(30, 128, 175, m.id, [64, 96, 140], [214, 60, 76], 0.7);
    if (logo) { fill(C.white); d.roundedRect(W - M - 44, 12, 44, 22, 2, 2, 'F'); d.addImage(logo, 'PNG', W - M - 42, 13.5, 40, 18.3); }
    font(9, true); tc([255, 205, 210]); text('PERBADANAN PRODUKTIVITI MALAYSIA', M, 20);
    font(29, true); tc(C.white); text('PROFIL STRATEGIK', M, 52); text('PRODUKTIVITI NEGERI', M, 64);
    font(10.5, false, true); tc([200, 214, 235]); text('State Productivity Strategic Profile', M, 72);
    fill(C.red); d.rect(M, 78, 26, 1.2, 'F');
    if (flag) d.addImage(flag, 'PNG', M, 88, m.id === 'putrajaya' ? 26 : 44, 22);
    font(24, true); tc(C.white); text(m.name, flag ? M + (m.id === 'putrajaya' ? 30 : 49) : M, 103);
    font(9.5); tc([200, 214, 235]); text(`Data rasmi DOSM sehingga ${m.Y} · Unjuran hingga ${m.sim.end}`, M, 120);
    font(14, true); tc(C.white); text('Isi Kandungan', M, 196); fill(C.white); d.rect(M, 199, 18, 0.6, 'F');
    const parts = [['01.', 'Latar belakang dan pencapaian semasa', 'Konteks dan tujuan profil serta prestasi produktiviti semasa negeri.', 2], ['02.', 'Prestasi, sektor keutamaan dan simulasi', 'Trend prestasi, klasifikasi sektor dan unjuran senario produktiviti.', 3], ['03.', 'Kerangka strategik dan pelaksanaan', 'Kerangka penilaian, cadangan intervensi dan hala tuju pelaksanaan.', 6]];
    parts.forEach(([n, t, s, p], i) => { const x = M + i * 62, y = 206; fill(C.white); d.roundedRect(x, y, 58, 66, 2, 2, 'F'); font(20, true); tc(C.navy); text(n, x + 4, y + 12); font(9, true); tc(C.ink); d.text(d.splitTextToSize(T(t), 50), x + 4, y + 20); font(7.6, false, true); tc(C.blue); d.text(d.splitTextToSize(T(s), 50), x + 4, y + 33); fill(C.navy); d.triangle(x + 4, y + 59, x + 10, y + 59, x + 7, y + 62, 'F'); font(9, true); tc(C.navy); text(String(p), x + 53, y + 61, { align: 'right' }); });
    font(6.6); tc([170, 185, 210]); text('Bendera: Wikimedia Commons (lihat lampiran). Peta: sempadan negeri ilustratif.', M, H - 8);

    /* ---- page 2: background, purpose, KPI cards ---- */
    newPage();
    let y = 40;
    const iconBox = (yy, c) => { fill(c); d.roundedRect(M, yy, 11, 11, 2, 2, 'F'); fill(C.white); d.rect(M + 3, yy + 3, 5, 0.9, 'F'); d.rect(M + 3, yy + 5, 5, 0.9, 'F'); d.rect(M + 3, yy + 7, 3.5, 0.9, 'F'); };
    iconBox(y, C.navy); font(10, true); tc(C.navy); text('LATAR BELAKANG', M + 15, y + 4.5); y = para(m.text.bg.join('\n\n'), M + 15, y + 9, W - 2 * M - 15, 8.2);
    y += 3; iconBox(y, C.red); font(10, true); tc(C.navy); text('TUJUAN PROFIL', M + 15, y + 4.5); y = para(m.text.purpose, M + 15, y + 9, W - 2 * M - 15, 8.2) + 4;
    y = secBar(1, 'Pencapaian semasa produktiviti negeri', y);
    const K = m.kpi, cw = (W - 2 * M - 4 * 3) / 5;
    const cards = [[rmBil(K.gdp.v), `Nilai ditambah (${K.gdp.y})`, pc(K.gdp.share), 'sumbangan kepada KDNK Malaysia'], [ps(K.gdpg.v), `Pertumbuhan tahunan KDNK (${K.gdpg.y})`, ps(K.gdpg.nat), 'purata nasional'], [n1(K.emp.v / 1000) + ' juta', `Jumlah pekerja (${K.emp.y})`, pc(K.emp.share), 'daripada jumlah pekerja Malaysia'], [rmRibu(K.lp.v), `Produktiviti buruh seorang pekerja (${K.lp.y})`, rmRibu(K.lp.nat), 'purata nasional'], [ps(K.lpg.v), `Pertumbuhan produktiviti (${K.lpg.y0}-${K.lpg.y})`, K.lpg.per.map(p => `${p.p}-${p.q}: ${ps(p.v)}`).join('\n'), '']];
    cards.forEach(([v, l, v2, l2], i) => { const x = M + i * (cw + 3); box(x, y, cw, 62, C.soft); fill(C.navy); d.circle(x + cw / 2, y + 8, 4.6, 'F'); fill(C.white); d.rect(x + cw / 2 - 2, y + 7, 4, 0.8, 'F'); d.rect(x + cw / 2 - 2, y + 8.6, 4, 0.8, 'F'); font(11.5, true); tc(C.navy); text(v, x + cw / 2, y + 20, { align: 'center' }); font(6.8); tc(C.ink); d.text(d.splitTextToSize(T(l), cw - 4), x + cw / 2, y + 25, { align: 'center' }); draw(C.line); d.line(x + 3, y + 36, x + cw - 3, y + 36); font(i === 4 ? 6.6 : 10, true); tc(C.red); d.text(T(v2).split('\n'), x + cw / 2, y + (i === 4 ? 41 : 43), { align: 'center' }); font(6.4); tc(C.mute); if (l2) d.text(d.splitTextToSize(T(l2), cw - 4), x + cw / 2, y + 48, { align: 'center' }); });
    y += 66; y = src(`${SRC.gdp}; ${SRC.lfs}; ${SRC.lp}.`, y) + 2;
    y = para(m.text.kpi, M, y + 2, W - 2 * M, 8.2);
    footer();

    /* ---- page 3: performance charts ---- */
    newPage(); y = secBar(2, 'Prestasi produktiviti negeri', 38);
    const h = m.hist; font(7.6, true); tc(C.navy); text(`KDNK (RM bilion), produktiviti (RM ribu) dan pekerja (ribu), ${h.years[0]}-${h.years[h.years.length - 1]}`, M, y + 2);
    const ch = lineChart(M, y + 4, W - 2 * M - 14, 74, { years: h.years, series: [{ v: h.gdp, c: C.navy, dots: true, labels: true }, { v: h.lp, c: C.green, dots: true, labels: true }], min: 0 });
    { // employment on the right axis
      const ev = h.emp.filter(v => v != null), lo = Math.floor(Math.min(...ev) * 0.9 / 100) * 100, hi = Math.ceil(Math.max(...ev) * 1.05 / 100) * 100, py2 = v => ch.Y0 - (v - lo) / (hi - lo) * (74 - 12);
      font(6.2); tc(C.mute); for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4; text(n0(v), ch.X0 + ch.Wd + 2, py2(v) + 0.9); }
      d.setLineWidth(0.7); draw(C.red); let pr = null; h.emp.forEach((v, i) => { if (v == null) { pr = null; return; } const xx = ch.px(i), yy = py2(v); if (pr) d.line(pr[0], pr[1], xx, yy); pr = [xx, yy]; fill(C.red); d.circle(xx, yy, 0.75, 'F'); if (i % 2 === 0 || i === h.emp.length - 1) { font(5.8, true); tc(C.red); text(n1(v), xx, yy + 3, { align: 'center' }); } });
    }
    legend([['KDNK (RM bilion)', C.navy], ['Produktiviti (RM ribu)', C.green], ['Pekerja (ribu, paksi kanan)', C.red]], M + 14, y + 82);
    y = src(`${SRC.gdp}; ${SRC.lfs}; ${SRC.lp}.`, y + 86); box(M, y + 1, W - 2 * M, 1, C.soft);
    y = para(m.text.histA, M + 2, y + 6, W - 2 * M - 4, 8) + 4;
    font(7.6, true); tc(C.navy); text(`Kuadran produktiviti antara negeri: ${m.Y0} berbanding ${m.Y} (RM ribu setiap pekerja)`, M, y);
    { // bubble quadrant (substitute for district chart)
      const pts = m.sd, xs = pts.map(p => p.x), ys2 = pts.map(p => p.y), x0 = M + 12, w0 = W - 2 * M - 16, y0 = y + 4, h0 = 78;
      const lx = Math.floor(Math.min(...xs) * 0.9 / 10) * 10, hx = Math.ceil(Math.max(...xs) * 1.05 / 10) * 10, ly = Math.floor(Math.min(...ys2) * 0.9 / 10) * 10, hy2 = Math.ceil(Math.max(...ys2) * 1.05 / 10) * 10;
      const PX = v => x0 + (v - lx) / (hx - lx) * w0, PY = v => y0 + h0 - (v - ly) / (hy2 - ly) * h0;
      fill([250, 251, 253]); d.rect(x0, y0, w0, h0, 'F'); draw(C.line); d.setLineWidth(0.15);
      font(6.2); tc(C.mute); for (let v = lx; v <= hx; v += 20) { d.line(PX(v), y0, PX(v), y0 + h0); text(String(v), PX(v), y0 + h0 + 3.4, { align: 'center' }); } for (let v = ly; v <= hy2; v += 20) { d.line(x0, PY(v), x0 + w0, PY(v)); text(String(v), x0 - 1.5, PY(v) + 0.9, { align: 'right' }); }
      draw(C.navy); d.setLineWidth(0.35); d.setLineDashPattern([1.2, 1], 0); d.line(PX(m.qd.x), y0, PX(m.qd.x), y0 + h0); d.line(x0, PY(m.qd.y), x0 + w0, PY(m.qd.y)); d.setLineDashPattern([], 0);
      const ql = (s, xx, yy, al) => { font(6.6, true); fill(C.navy); const tw = d.getTextWidth(s) + 3; d.rect(al === 'right' ? xx - tw : xx, yy - 3, tw, 4, 'F'); tc(C.white); text(s, al === 'right' ? xx - tw + 1.5 : xx + 1.5, yy); };
      ql('Melonjak', x0 + 1, y0 + 4); ql('Peneraju', x0 + w0 - 1, y0 + 4, 'right'); ql('Pengukuhan', x0 + 1, y0 + h0 - 1.5); ql('Hilang momentum', x0 + w0 - 1, y0 + h0 - 1.5, 'right');
      pts.forEach(p => { const r = 1.4 + Math.sqrt(p.sh) * 1.1, hi = p.id === m.id; opa(hi ? 0.95 : 0.55); fill(hi ? C.red : [120, 150, 190]); d.circle(PX(p.x), PY(p.y), r, 'F'); opa(1); font(hi ? 7.2 : 6, hi); tc(hi ? C.red : C.ink); text(p.n, PX(p.x) + r + 0.8, PY(p.y) + 1); });
      font(6.4); tc(C.mute); text(`Produktiviti ${m.Y0} (RM ribu)`, x0 + w0 / 2, y0 + h0 + 7, { align: 'center' }); d.text(T(`Produktiviti ${m.Y} (RM ribu)`), x0 - 9, y0 + h0 / 2 + 12, { angle: 90 });
      y = src(`${SRC.lp}. Garisan putus-putus = purata nasional. Saiz gelembung = sumbangan kepada KDNK Malaysia (${m.gY}). W.P. Putrajaya dan W.P. Labuan dikecualikan (tenaga kerja kecil, ekonomi khusus).`, y0 + h0 + 10);
    }
    y = para(m.text.histB, M + 2, y + 3, W - 2 * M - 4, 8);
    footer();

    /* ---- page 4: priority sectors ---- */
    newPage(); y = secBar(3, 'Keutamaan sektor negeri', 38, 'Berdasarkan sumbangan ekonomi, tahap produktiviti, momentum pertumbuhan dan sumbangan guna tenaga');
    const block = (cat, rows, yy, col) => {
      box(M, yy, W - 2 * M, 12 + rows.length * 11 + 12, cat === 'A' ? [236, 242, 251] : [241, 238, 250]);
      fill(col); d.roundedRect(M + 3, yy + 3, 14, 14, 2, 2, 'F'); font(16, true); tc(C.white); text(cat, M + 10, yy + 13, { align: 'center' });
      font(10.5, true); tc(col); text(cat === 'A' ? 'SEKTOR LONJAKAN PRODUKTIVITI' : 'SEKTOR PENGUPAYAAN PRODUKTIVITI', M + 21, yy + 8.5);
      font(7.2, false, true); tc(C.ink); text(cat === 'A' ? 'Memacu penciptaan nilai, pertumbuhan dan limpahan ekonomi bernilai tinggi' : 'Memperluas manfaat produktiviti melalui sektor berintensifkan pekerja dan ruang peningkatan kecekapan', M + 21, yy + 14);
      const hx = [M + 3, M + 70, M + 108, M + 146], hw = [64, 36, 36, 36], hdr = ['Sektor', 'Produktiviti (RM ribu / pekerja)', 'Sumbangan nilai ditambah (%)', 'Sumbangan pekerja (%, anggaran)'];
      font(6.8, true); tc(C.navy); hdr.forEach((s, i) => d.text(d.splitTextToSize(T(s), hw[i]), hx[i], yy + 21));
      const mx = { lp: Math.max(...m.sec.filter(r => r.lp && r.id !== 'mining').map(r => r.lp / 1000), ...rows.map(r => r.lp / 1000)), va: 100, emp: 100 };
      rows.forEach((r, k) => { const ry = yy + 29 + k * 11; fill(C.white); d.roundedRect(M + 3, ry - 4.5, W - 2 * M - 6, 9.5, 1.5, 1.5, 'F'); fill(col); d.roundedRect(M + 5, ry - 3, 8, 6.5, 1, 1, 'F'); font(7.6, true); tc(C.white); text(cat + (k + 1), M + 9, ry + 1.4, { align: 'center' }); font(8, true); tc(C.ink); text(r.name, M + 15, ry + 1.4);
        [[r.lp / 1000, mx.lp, n1(r.lp / 1000)], [r.vaSh, 60, pc(r.vaSh)], [r.empSh, 60, pc(r.empSh)]].forEach(([v, mxv, lab], i) => { const bx = hx[i + 1], bw = 26 * Math.min(1, (v || 0) / mxv); fill(col); d.rect(bx, ry - 2.2, Math.max(bw, 0.6), 4.4, 'F'); font(7, true); tc(C.ink); text(lab, bx + Math.max(bw, 0.6) + 1.2, ry + 1.2); }); });
      return yy + 12 + rows.length * 11 + 16;
    };
    y = block('A', m.lon, y, C.blue); y = block('B', m.pen, y + 2, C.purple);
    src(`${SRC.lp}; ${SRC.gdp}. Bilangan pekerja sektor dianggarkan = nilai ditambah sektor / produktiviti sektor. Perlombongan dibandingkan secara berasingan kerana nilai bagi setiap pekerja amat tinggi.`, y - 1);
    y += 8; font(9.5, true); tc(C.navy); text('Bagaimana sektor ini ditentukan?', M, y); text('Apa maksud setiap kategori?', W / 2 + 4, y);
    const crit = [['1', 'Prestasi produktiviti sektor', 'Data'], ['2', 'Sumbangan nilai ditambah dan guna tenaga', 'Data'], ['3', 'Momentum pertumbuhan sektor', 'Data'], ['4', 'Keutamaan negeri dan rantaian nilai', 'Perlu pengesahan']];
    crit.forEach(([n, t2, ty], i) => { const cx = M + 10 + i * 22, cy = y + 11; fill(C.navy); d.circle(cx, cy, 4, 'F'); font(9, true); tc(C.white); text(n, cx, cy + 1.2, { align: 'center' }); font(6.4); tc(C.ink); d.text(d.splitTextToSize(T(t2), 20), cx, cy + 7.5, { align: 'center' }); font(5.8, true); tc(ty === 'Data' ? C.green : C.red); text(ty, cx, cy + 19.5, { align: 'center' }); });
    [['A', 'SEKTOR LONJAKAN PRODUKTIVITI', 'Produktiviti dan momentum tinggi atau sumbangan nilai ditambah besar; berpotensi mempercepat penciptaan nilai negeri.', C.blue], ['B', 'SEKTOR PENGUPAYAAN PRODUKTIVITI', 'Menggaji ramai pekerja dengan produktiviti di bawah purata negeri; ruang besar untuk meningkatkan output setiap pekerja.', C.purple]].forEach(([k, t2, s2, col], i) => { const by = y + 3 + i * 17; box(W / 2 + 4, by, W / 2 - M - 4, 15, C.soft); fill(col); d.roundedRect(W / 2 + 6, by + 2.5, 9, 9, 1.5, 1.5, 'F'); font(11, true); tc(C.white); text(k, W / 2 + 10.5, by + 9, { align: 'center' }); font(7.4, true); tc(col); text(t2, W / 2 + 18, by + 5); para(s2, W / 2 + 18, by + 8.6, W / 2 - M - 20, 6.6); });
    y += 40; y = para(m.text.sec, M, y, W - 2 * M, 8);
    para('Kaedah: Sektor Lonjakan = sumbangan nilai ditambah sekurang-kurangnya 5% dan produktiviti pada atau melebihi purata negeri serta sekurang-kurangnya 95% daripada sektor yang sama di peringkat nasional, atau pertumbuhan produktiviti sekurang-kurangnya 0.5 mata peratus melebihi purata negeri. Sektor Pengupayaan = sekurang-kurangnya 8% pekerja dengan produktiviti di bawah purata negeri atau di bawah 95% daripada sektor nasional. Perlombongan tidak dikira sebagai Sektor Pengupayaan kerana bilangan pekerjanya kecil. Kriteria 4 (keutamaan negeri dan rantaian nilai) memerlukan penilaian kualitatif bersama Kerajaan Negeri.', M, y + 2, W - 2 * M, 6.6, 1.35, C.mute);
    footer();

    /* ---- page 5: simulation ---- */
    newPage(); const s = m.sim; y = secBar(4, `Simulasi produktiviti ${m.name}`, 38);
    y = para(`Gabungan Sektor Lonjakan dan Sektor Pengupayaan Produktiviti boleh mempercepat pertumbuhan ${m.name} melalui peningkatan nilai bagi setiap pekerja. Data sejarah (rasmi) dan unjuran (senario) dipisahkan dengan jelas.`, M, y + 1, W - 2 * M, 8) + 3;
    const simChart = (title, hist, base, imp, yy, unit, div) => {
      font(8, true); tc(C.navy); text(title, M, yy);
      const yrs = [...m.hist.years.filter(v => v <= s.y0), ...base.ys], nH = m.hist.years.filter(v => v <= s.y0).length;
      const hv = hist.slice(0, nH).map(v => v == null ? null : v / div), pad = Array(nH - 1).fill(null);
      lineChart(M, yy + 2, 128, 62, { years: yrs, split: s.y0 + 1, splitLabel: `Unjuran ${s.y0 + 1}-${s.end}`, fmt: v => n0(v), series: [{ v: hv.concat(Array(base.ys.length).fill(null)), c: C.navy, w: 0.9 }, { v: pad.concat([hv[nH - 1]], base.v.map(v => v / div)), c: C.green, dash: [1.4, 1], w: 0.8 }, { v: pad.concat([hv[nH - 1]], imp.v.map(v => v / div)), c: C.red, w: 0.9 }] });
      legend([['Data sejarah', C.navy], ['Garis dasar', C.green, [1.4, 1]], ['Simulasi', C.red]], M + 14, yy + 69);
      return yy + 72;
    };
    const rateBox = (yy, rows, label) => { const x = M + 132; box(x, yy, W - M - x, 50, C.soft); font(7.4, true); tc(C.navy); text(label, x + 3, yy + 6); const cols = [`${s.y0 + 1}-${s.mid}`, `${s.mid + 1}-${s.end}`, `${s.y0 + 1}-${s.end}`]; font(6.4, true); tc(C.mute); cols.forEach((c2, i) => text(c2, x + 22 + i * 13.5, yy + 13, { align: 'center' })); rows.forEach(([l, vals, col], k) => { const ry = yy + 22 + k * 12; font(6.8, true); tc(col); text(l, x + 3, ry + 1); vals.forEach((v, i) => { fill(col); d.roundedRect(x + 16 + i * 13.5, ry - 3.2, 12, 6, 1, 1, 'F'); font(7, true); tc(C.white); text(pc(v), x + 22 + i * 13.5, ry + 1, { align: 'center' }); }); }); };
    const y5 = y; y = simChart(`UNJURAN PRODUKTIVITI ${m.name.toUpperCase()}, RM (RIBU)`, m.hist.lp.map(v => v == null ? null : v * 1000), s.lpBase, s.lpImp, y, 'RM ribu', 1000);
    rateBox(y5 + 6, [['Simulasi', [s.i1, s.i2, s.iAll], C.red], ['Garis dasar', [s.b1, s.b2, s.bAll], C.green]], 'Purata pertumbuhan setahun');
    const y6 = y + 2; y = simChart(`UNJURAN KDNK ${m.name.toUpperCase()}, RM (BILION)`, m.hist.gdp.map(v => v == null ? null : v * 1000), s.gdpBase, s.gdpImp, y6, 'RM bilion', 1000);
    rateBox(y6 + 6, [['Simulasi', [s.gi1, s.gi2, s.giAll], C.red], ['Garis dasar', [s.g1, s.g2, s.gAll], C.green]], 'Purata pertumbuhan setahun');
    // sector tables
    y += 1; const tbl = (rows, x, w, title, col) => { font(7.4, true); tc(col); text(title, x, y); const cx = [x, x + w * 0.34, x + w * 0.5, x + w * 0.67, x + w * 0.84]; fill(col); d.rect(x, y + 1.5, w, 6, 'F'); font(6, true); tc(C.white); ['Sektor', `${m.Y0}-${m.Y}`, `${s.y0 + 1}-${s.mid}`, `${s.mid + 1}-${s.end}`, 'Simulasi'].forEach((h2, i) => text(h2, cx[i] + 1, y + 5.6)); rows.forEach((r, k) => { const ry = y + 11.5 + k * 6; if (k % 2) { fill(C.soft); d.rect(x, ry - 4, w, 6, 'F'); } font(6.6, r.cat === 'A' || r.cat === 'B'); tc(C.ink); text(r.name, cx[0] + 1, ry); font(6.6); [ps(r.h), ps(r.b1), ps(r.b2), ps(r.i1) + ' / ' + ps(r.i2)].forEach((v, i) => text(v, cx[i + 1] + 1, ry)); }); return y + 11 + rows.length * 6; };
    const yA = tbl(s.sec.filter(r => r.cat === 'A'), M, (W - 2 * M) / 2 - 2, 'Sektor Lonjakan Produktiviti: pertumbuhan produktiviti setahun', C.blue);
    const yB = tbl(s.sec.filter(r => r.cat === 'B'), W / 2 + 1, (W - 2 * M) / 2 - 1, 'Sektor Pengupayaan Produktiviti: pertumbuhan produktiviti setahun', C.purple);
    y = Math.max(yA, yB) + 1;
    y = src(`${SRC.lp}; ${SRC.gdp}; ${SRC.calc}. Andaian: garis dasar ${s.y0 + 1}-${s.mid} = purata momentum 3 tahun dan purata ${m.Y0}-${m.Y}; ${s.mid + 1}-${s.end} = purata ${m.Y0}-${m.Y}. Simulasi = garis dasar + ${n1(s.u)} mata peratus. KDNK = produktiviti x pekerja (pertumbuhan pekerja ${ps(s.eR)} setahun, purata ${m.Y0}-${m.eY}). Unjuran bermula ${s.y0 + 1}; bukan sasaran rasmi.`, y);
    y = para(m.text.sim, M, y + 2, W - 2 * M, 7.8);
    footer();

    /* ---- page 6: framework ---- */
    newPage(); y = secBar(5, 'Kerangka strategik produktiviti', 38);
    y = para('Setiap sektor dinilai melalui tiga dimensi yang saling berkait untuk mengenal pasti kekangan sebenar sebelum intervensi bersasar ditentukan. Kekangan pada satu dimensi boleh mengehadkan keberkesanan dimensi yang lain.', M, y + 1, W - 2 * M, 8.2) + 4;
    const fwB = (x, yy, w, hh, col, title, sub, items) => { draw(col); d.setLineWidth(0.6); fill(C.white); d.roundedRect(x, yy, w, hh, 2.5, 2.5, 'FD'); fill(col); d.circle(x + 9, yy + 9, 6, 'F'); fill(C.white); d.circle(x + 9, yy + 9, 2.4, 'F'); font(10, true); tc(col); text(title, x + 18, yy + 8); font(6.8, false, true); tc(C.ink); text(sub, x + 18, yy + 12.5); font(7.2); tc(C.ink); items.forEach((it, i) => { fill(col); d.circle(x + 6, yy + 20 + i * 5.2, 0.8, 'F'); text(it, x + 9, yy + 21 + i * 5.2); }); };
    fwB(M, y, 78, 46, C.green, 'PELUANG PASARAN', 'Permintaan dan jangkauan pasaran', ['Permintaan domestik', 'Peluang eksport', 'Akses pasaran', 'Peluang rantaian nilai']);
    fwB(W - M - 78, y, 78, 46, C.blue, 'KEUPAYAAN PRODUKTIF', 'Keupayaan pengeluaran dan daya saing', ['Kecekapan operasi', 'Kemahiran tenaga kerja', 'Teknologi dan pendigitalan', 'Keupayaan inovasi']);
    fill(C.navy); d.circle(W / 2, y + 23, 11, 'F'); font(7, true); tc(C.white); text('OPERASI', W / 2, y + 22, { align: 'center' }); text('PERNIAGAAN', W / 2, y + 25.5, { align: 'center' });
    draw(C.navy); fill(C.navy); d.setLineWidth(0.6); d.line(M + 80, y + 9.5, W - M - 81, y + 9.5); d.triangle(W - M - 79.5, y + 9.5, W - M - 82.5, y + 7.9, W - M - 82.5, y + 11.1, 'F'); d.line(W - M - 80, y + 36.5, M + 81, y + 36.5); d.triangle(M + 79.5, y + 36.5, M + 82.5, y + 34.9, M + 82.5, y + 38.1, 'F');
    font(5.8, false, true); tc(C.navy); d.text(['Permintaan mendorong', 'pelaburan'], W / 2, y + 3.2, { align: 'center' }); d.text(['Keupayaan meluaskan', 'pasaran'], W / 2, y + 40.8, { align: 'center' });
    const ey = y + 52; draw(C.gold); d.setLineWidth(0.6); fill([255, 251, 240]); d.roundedRect(M, ey, W - 2 * M, 40, 2.5, 2.5, 'FD'); fill(C.gold); d.circle(M + 9, ey + 9, 6, 'F'); fill(C.white); d.circle(M + 9, ey + 9, 2.4, 'F'); font(10, true); tc([150, 100, 10]); text('PERSEKITARAN PERNIAGAAN', M + 18, ey + 8); font(6.8, false, true); tc(C.ink); text('Pemangkin yang membentuk interaksi antara pasaran dan keupayaan', M + 18, ey + 12.5);
    [['A. Pembiayaan', 'Akses kepada modal dan sokongan kewangan'], ['B. Infrastruktur', 'Logistik, utiliti dan kesalinghubungan'], ['C. Institusi', 'Peraturan, tadbir urus dan kelulusan'], ['D. Pasaran buruh', 'Ketersediaan dan padanan kemahiran'], ['E. Ekosistem inovasi', 'Penyelidikan dan pemindahan teknologi']].forEach(([t2, s2], i) => { const bw5 = (W - 2 * M - 6 - 4 * 2) / 5, bx = M + 3 + i * (bw5 + 2); box(bx, ey + 17, bw5, 20, C.white); font(7, true); tc([150, 100, 10]); text(t2, bx + 2, ey + 22); font(6.3); tc(C.ink); d.text(d.splitTextToSize(T(s2), bw5 - 4), bx + 2, ey + 26.5); });
    y = ey + 46;
    font(9, true); tc(C.navy); text(`Soalan diagnostik bagi ${m.name}`, M, y); tag('HIPOTESIS UNTUK PENGESAHAN', M + 72, y, C.red); y += 5;
    [['Peluang pasaran', m.text.q.market, C.green], ['Keupayaan produktif', m.text.q.cap, C.blue], ['Persekitaran perniagaan', m.text.q.env, [150, 100, 10]]].forEach(([l, qs, col]) => { font(7.6, true); tc(col); text(l, M, y + 3); qs.forEach(q => { y = para('- ' + q, M + 40, y + 3, W - 2 * M - 40, 7.6) - 1; }); y += 3; });
    y += 1; tag('FAKTA DAN PENGIRAAN', M, y + 2, C.navy); y = para(m.text.fw, M, y + 7, W - 2 * M, 8);
    footer();

    /* ---- pages 7-8: strategic priorities + implementation ---- */
    {
      newPage(); y = secBar(6, 'Keutamaan strategik dan cadangan intervensi', 38);
      y = para(`Jadual berikut menghubungkan setiap sektor keutamaan ${m.name} dengan kekangan yang dikenal pasti, cadangan intervensi, agensi pelaksana yang berpotensi, tempoh dan petunjuk hasil. Semua cadangan ialah cadangan awal untuk dibincangkan, bukan program kerajaan yang telah diluluskan.`, M, y + 1, W - 2 * M, 8) + 3;
      const P = plan(m), cols = [['Sektor', 20], ['Bukti (fakta)', 30], ['Kekangan utama (hipotesis)', 28], ['Cadangan intervensi', 34], ['Agensi berpotensi', 22], ['Tempoh', 18], ['Petunjuk hasil', 30]];
      const cw2 = cols.map(c2 => c2[1]), tot = cw2.reduce((a2, b2) => a2 + b2, 0), sc = (W - 2 * M) / tot;
      fill(C.navy); d.rect(M, y, W - 2 * M, 8, 'F'); font(6.6, true); tc(C.white); let cx = M; cols.forEach(([l, w2]) => { d.text(d.splitTextToSize(T(l), w2 * sc - 2), cx + 1, y + 3.4); cx += w2 * sc; }); y += 8;
      P.forEach((r, k) => { const vals = [`${r.cat}. ${r.sec}`, r.fact, r.con, r.int, r.ag, r.time, r.kpi]; font(6.6); const lines = vals.map((v, i) => d.splitTextToSize(T(v), cw2[i] * sc - 2)), rh = Math.max(...lines.map(l => l.length)) * 2.7 + 3; fill(k % 2 ? C.soft : C.white); d.rect(M, y, W - 2 * M, rh, 'F'); cx = M; lines.forEach((l, i) => { font(6.6, i === 0); tc(i === 0 ? (r.cat === 'A' ? C.blue : C.purple) : C.ink); d.text(l, cx + 1, y + 3.4); cx += cw2[i] * sc; }); y += rh; });
      draw(C.line); d.line(M, y, W - M, y); y += 5;
      font(9, true); tc(C.navy); text('Garis masa cadangan', M, y); y += 4;
      const ph = [['Pendek', '2026-2027', 'Mulakan intervensi Sektor Pengupayaan: pendigitalan, latihan dan amalan terbaik.', C.purple], ['Sederhana', '2028-2030', 'Perluas pelaburan teknologi dan rantaian nilai dalam Sektor Lonjakan.', C.blue], ['Panjang', `2031-${m.sim.end}`, 'Kukuhkan ekosistem inovasi dan pantau pencapaian senario simulasi.', C.navy]];
      ph.forEach(([l, p2, s2, col], i) => { const bx = M + i * 61; fill(col); d.roundedRect(bx, y, 58, 26, 2, 2, 'F'); if (i < 2) { fill(col); d.triangle(bx + 58, y + 10, bx + 58, y + 16, bx + 61.5, y + 13, 'F'); } font(9, true); tc(C.white); text(l.toUpperCase() + ' · ' + p2, bx + 3, y + 6); font(7); d.text(d.splitTextToSize(T(s2), 52), bx + 3, y + 11.5); });
      y += 31; src(`${SRC.lp}; ${SRC.gdp}; ${SRC.calc}. Kekangan dan intervensi ialah hipotesis dan cadangan berdasarkan profil sektor, perlu disahkan melalui libat urus dengan pihak berkepentingan.`, y);
      footer();
      newPage(); y = secBar(7, 'Kerangka pelaksanaan dan hasil dijangka', 38);
      font(9, true); tc(C.navy); text('Peranan pihak berkepentingan', M, y + 2); y += 5;
      const roles = [['Kerajaan Negeri / UPEN', 'Menetapkan keutamaan negeri, menyelaras agensi negeri dan memantau pelaksanaan.'], ['Kementerian Ekonomi', 'Menyelaras hala tuju produktiviti nasional dan keselarasan dengan rancangan pembangunan.'], ['Perbadanan Produktiviti Malaysia', 'Menyediakan analisis, intervensi produktiviti dan pemantauan petunjuk.'], ['Kementerian dan agensi sektor', 'Melaksanakan program sektoral (contohnya MITI, KPKM, KKR, MDEC, CIDB).'], ['Industri dan persatuan', 'Mengguna pakai teknologi dan amalan baharu serta berkongsi data dan maklum balas.']];
      roles.forEach(([r, s2], i) => { const bx = M + (i % 3) * 61, by = y + Math.floor(i / 3) * 24; box(bx, by, 58, 21, C.soft); fill(C.navy); d.rect(bx, by, 1.4, 21, 'F'); font(7.6, true); tc(C.navy); text(r, bx + 4, by + 5.5); font(6.8); tc(C.ink); d.text(d.splitTextToSize(T(s2), 51), bx + 4, by + 10); });
      y += 52; font(9, true); tc(C.navy); text('Koordinasi', M, y); y = para('Persekutuan menetapkan hala tuju dan sumber; negeri menentukan keutamaan dan penyelarasan setempat; agensi sektor melaksanakan program; MPC menyokong analisis dan pemantauan. Mesyuarat penyelarasan berkala disyorkan bagi setiap sektor keutamaan.', M, y + 4, W - 2 * M, 8) + 4;
      font(9, true); tc(C.navy); text('Petunjuk pemantauan yang dicadangkan (nilai asas daripada data rasmi)', M, y); y += 3;
      const mon = [['Produktiviti buruh negeri (RM/pekerja)', n0(m.kpi.lp.v), String(m.Y), `${rmRibu(m.sim.lpEndI)} pada ${m.sim.end} (senario simulasi)`], ['Pertumbuhan produktiviti setahun', ps(m.kpi.lpg.v), `${m.Y0}-${m.Y}`, ps(m.sim.iAll) + ' (senario simulasi)'], ['Jurang dengan purata nasional', ps(m.kpi.lp.gap), String(m.Y), m.kpi.lp.gap < 0 ? 'Mengecil' : 'Dikekalkan atau diperluas'], ...[...m.lon, ...m.pen].map(r => [`Produktiviti ${r.short.toLowerCase()} (RM/pekerja)`, n0(r.lp), String(m.Y), 'Meningkat setiap tahun']), ['Kadar pengangguran', pc(m.lab.ur), String(m.eY), 'Kekal rendah']];
      fill(C.navy); d.rect(M, y, W - 2 * M, 6.5, 'F'); font(6.8, true); tc(C.white); ['Petunjuk', 'Nilai asas', 'Tahun', 'Hala tuju / senario'].forEach((h2, i) => text(h2, M + [1, 82, 112, 128][i], y + 4.4)); y += 6.5;
      mon.forEach((r, k) => { if (k % 2) { fill(C.soft); d.rect(M, y, W - 2 * M, 6, 'F'); } font(6.9); tc(C.ink); r.forEach((v, i) => text(v, M + [1, 82, 112, 128][i], y + 4.1)); y += 6; }); y += 5;
      font(9, true); tc(C.navy); text('Hasil dijangka', M, y); y += 3;
      [['Jangka pendek', 'Sektor keutamaan disahkan; garis asas petunjuk dan pelan tindakan sektor dimuktamadkan.', C.purple], ['Jangka sederhana', 'Penggunaan teknologi dan kemahiran meningkat; produktiviti sektor keutamaan melepasi garis dasar.', C.blue], ['Jangka panjang', `Produktiviti ${m.name} menghampiri laluan senario simulasi dan jurang dengan nasional ${m.kpi.lp.gap < 0 ? 'mengecil' : 'dikekalkan'}.`, C.navy]].forEach(([l, s2, col], i) => { const bx = M + i * 61; fill(col); d.roundedRect(bx, y, 58, 24, 2, 2, 'F'); font(8.4, true); tc(C.white); text(l.toUpperCase(), bx + 3, y + 6); font(6.9); d.text(d.splitTextToSize(T(s2), 52), bx + 3, y + 11); });
      y += 29; font(9, true); tc(C.navy); text('Tindakan susulan penting', M, y);
      ['Sahkan klasifikasi sektor bersama Kerajaan Negeri dan pemain industri.', 'Lengkapkan data peringkat subsektor dan daerah (contohnya Banci Ekonomi) untuk analisis lebih terperinci.', 'Tetapkan pemilik bagi setiap intervensi dan jadual pemantauan suku tahunan.'].forEach((t2, i) => { para(`${i + 1}. ${t2}`, M, y + 5 + i * 4.6, W - 2 * M, 7.8); });
      footer();
    }

    /* ---- page 9: sector annex ---- */
    newPage(false);
    fill(C.blue); d.rect(M, 14, 30, 8, 'F'); font(11, true); tc(C.white); text('LAMPIRAN', M + 3, 19.8);
    font(11, true); tc(C.navy); text(`Sektor ekonomi negeri ${m.name}, ${m.Y}`, M, 30); font(7.6, false, true); tc(C.blue); text('Penentuan sektor ekonomi keutamaan dilaksanakan berdasarkan klasifikasi sektor ekonomi dalam jadual di bawah.', M, 35);
    y = 40; const ac = [M, M + 10, M + 96, M + 130, M + 158]; fill(C.navy); d.rect(M, y, W - 2 * M, 9, 'F'); font(7.2, true); tc(C.white); ['Bil.', 'Sektor ekonomi', 'Nilai ditambah (RM juta)', 'Bilangan pekerja (ribu, anggaran)', 'Produktiviti buruh (RM / pekerja)'].forEach((h2, i) => d.text(d.splitTextToSize(T(h2), i === 1 ? 80 : 28), ac[i] + 1.5, y + 3.8)); y += 9;
    m.sec.forEach((r, k) => { if (k % 2) { fill(C.soft); d.rect(M, y, W - 2 * M, 7, 'F'); } font(7.6); tc(C.ink); text(String(k + 1), ac[0] + 1.5, y + 4.7); text(r.name, ac[1] + 1.5, y + 4.7); text(n0(r.va), ac[3] - 3, y + 4.7, { align: 'right' }); text(r.emp == null ? 'Tiada data' : n1(r.emp), ac[4] - 3, y + 4.7, { align: 'right' }); text(r.lp == null ? 'Tiada data' : n2(r.lp), W - M - 2, y + 4.7, { align: 'right' }); y += 7; });
    fill([220, 232, 247]); d.rect(M, y, W - 2 * M, 7.5, 'F'); font(7.6, true); tc(C.navy); text('Jumlah 5 sektor (produktiviti agregat = jumlah nilai ditambah / jumlah pekerja)', ac[1] + 1.5, y + 4.9); text(n0(m.vaT), ac[3] - 3, y + 4.9, { align: 'right' }); text(n1(m.empT), ac[4] - 3, y + 4.9, { align: 'right' }); text(n2(m.lpAgg), W - M - 2, y + 4.9, { align: 'right' }); y += 7.5;
    font(7.4); tc(C.ink); text(`Produktiviti buruh negeri rasmi DOSM, ${m.Y}: RM${n2(m.kpi.lp.v)}. Pekerja (Survei Tenaga Buruh, ${m.eY}): ${n1(m.kpi.emp.v)} ribu.`, M, y + 5); y += 9;
    y = para(`Nota kaedah: Nilai ditambah ialah KDNK sektor negeri pada harga malar 2015 bagi ${m.gY} (duti import tidak termasuk). Produktiviti sektor ialah siri rasmi DOSM bagi ${m.Y}. Bilangan pekerja sektor dianggarkan = nilai ditambah (RM juta x 1,000) / produktiviti sektor (RM setiap pekerja), dalam ribu orang. Produktiviti agregat dikira semula daripada jumlah nilai ditambah dan jumlah pekerja, bukan dengan menjumlahkan produktiviti sektor. Jumlah anggaran pekerja mungkin berbeza daripada angka Survei Tenaga Buruh kerana perbezaan sumber dan liputan. Klasifikasi 5 sektor utama digunakan kerana data subsektor peringkat negeri (contohnya Banci Ekonomi) belum dimuatkan ke dalam laman; jadual ini akan diperluas secara automatik apabila data tersebut tersedia.`, M, y, W - 2 * M, 7.4) + 3;
    y = src(`${SRC.gdp}; ${SRC.lp}; ${SRC.lfs}; ${SRC.calc}.`, y) + 4;
    font(7.6, true); tc(C.navy); text('Kredit imej', M, y); y += 3.5;
    let cred = []; try { cred = await (await fetch('assets/flags/CREDITS.json')).json(); } catch (e) { }
    const fc = flag ? cred.find(c2 => c2.id === m.id) : null; y = para(fc ? `Bendera ${m.name}: ${fc.file.replace('File:', '')}, Wikimedia Commons, lesen ${fc.license}${fc.artist ? ', ' + fc.artist : ''}. ${fc.url}` : 'Bendera negeri tidak dipaparkan kerana fail imej belum tersedia.', M, y, W - 2 * M, 6.8, 1.35, C.mute);
    para('Logo MPC: aset korporat Perbadanan Produktiviti Malaysia. Peta negeri: sempadan ilustratif daripada geometri peta laman.', M, y + 1, W - 2 * M, 6.8, 1.35, C.mute);
    footer();
    d.__layout = LAY;
    return d;

  }

  /* ---------------- page UI ---------------- */
  const U = { id: null, uplift: 1, end: 2035, url: null, busy: false, msg: '', m: null };
  function render(el) {
    if (!U.id) U.id = (S.sel && STATE_BY_ID[S.sel]) ? S.sel : 'johor';
    const opts = STATES.map(s => `<option value="${s.id}"${s.id === U.id ? ' selected' : ''}>${esc(s.bm)}</option>`).join('');
    const yrs = S.snap ? S.snap.years.slice().reverse() : [];
    let m = null, err = ''; try { m = model(U.id, { uplift: U.uplift, end: U.end }); U.m = m; } catch (e) { err = e.message; console.error(e); }
    const okAll = m && m.qc.every(c => c.ok);
    el.innerHTML = `<article class="card sp-card"><div class="card-h"><div><h2>Jana Profil Strategik Negeri</h2><p class="sub">Laporan PDF A4 bertaraf penerbitan bagi mana-mana negeri: pencapaian semasa, prestasi, sektor keutamaan, simulasi, kerangka strategik, cadangan pelaksanaan dan lampiran sektor. Semua angka daripada data rasmi DOSM dalam laman ini.</p></div></div>
      <div class="sp-form">
        <label>Negeri<select data-sp="id">${opts}</select></label>
        <label>Tahun rujukan<select data-sp="year"><option>Terkini (${yrs[0] || '-'})</option></select></label>
        <label>Peningkatan simulasi (mata peratus setahun)<input type="number" step="0.1" min="0" max="5" data-sp="uplift" value="${U.uplift}"></label>
        <label>Unjuran hingga<select data-sp="end">${[2030, 2035, 2040].map(y => `<option${y === U.end ? ' selected' : ''}>${y}</option>`).join('')}</select></label>
      </div>
      <div class="sp-act"><button type="button" class="btn" data-spact="prev"${U.busy || !okAll ? ' disabled' : ''}>Pratonton</button><button type="button" class="btn dark" data-spact="dl"${U.busy || !okAll ? ' disabled' : ''}>Muat turun PDF</button>${U.msg ? `<span class="k2-msg">${esc(U.msg)}</span>` : ''}</div>
      ${err ? `<p class="k2-warn k2-review">${esc(err)}</p>` : ''}
      ${m ? `<details class="sp-qc"${okAll ? '' : ' open'}><summary>Semakan kualiti: ${m.qc.filter(c => c.ok).length}/${m.qc.length} lulus${okAll ? '' : ' (muat turun disekat)'}</summary><ul>${m.qc.map(c => `<li class="${c.ok ? 'ok' : 'no'}">${c.ok ? '✓' : '✗'} ${esc(c.k)}${c.d ? ` <small>${esc(c.d)}</small>` : ''}</li>`).join('')}</ul></details>` : ''}
      </article>
      <article class="card sp-prev"${U.url ? '' : ' hidden'}><iframe title="Pratonton profil strategik" src="${U.url || 'about:blank'}"></iframe></article>`;
  }
  let root = null, wired = false;
  const fileName = m => `Profil_Strategik_Produktiviti_${m.name.replace(/[^A-Za-z]/g, '')}_${m.Y}.pdf`;
  async function act(kind) {
    if (U.busy || !U.m) return; U.busy = true; U.msg = 'Menjana PDF...'; render(root);
    try { const d = await pdf(U.m), blob = d.output('blob'); if (kind === 'prev') { if (U.url) URL.revokeObjectURL(U.url); U.url = URL.createObjectURL(blob); U.msg = `Pratonton sedia (${d.getNumberOfPages()} halaman).`; } else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName(U.m); document.body.appendChild(a); a.click(); a.remove(); U.msg = `Sedia: ${fileName(U.m)}`; } }
    catch (e) { console.error(e); U.msg = 'Gagal menjana PDF: ' + (e.message || e); }
    U.busy = false; render(root);
  }
  function mount(el) {
    root = el; render(el);
    if (wired) return; wired = true;
    document.addEventListener('change', e => { const t = e.target.closest('[data-sp]'); if (!t || !root || !root.contains(t)) return; const k = t.dataset.sp; if (k === 'id') U.id = t.value; else if (k === 'uplift') U.uplift = Math.max(0, Math.min(5, +t.value || 0)); else if (k === 'end') U.end = +t.value; else return; if (U.url) { URL.revokeObjectURL(U.url); U.url = null; } U.msg = ''; render(root); });
    document.addEventListener('click', e => { const b = e.target.closest('[data-spact]'); if (!b || !root || !root.contains(b)) return; act(b.dataset.spact); });
  }
  return { model, validate, pdf, mount, plan, fileName };
})();
// the page may have rendered before this file loaded
(() => { const r = document.querySelector('#pg-sprof .sp-root'); if (r && !r.querySelector('.sp-card')) SP.mount(r); })();
