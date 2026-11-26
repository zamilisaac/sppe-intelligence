/* =====================================================================
   Data terkini (suku tahunan, bulanan dan 14 subsektor)
   Adds the newest DOSM figures to two pages:
     Produktiviti Buruh: national quarterly productivity (22 sectors) and the 14 priority sub-sectors
     Pasaran Buruh:      labour force by state for the latest quarter, and the national monthly series
   Every number comes from the k3-data pack (built by scripts/build_k3_data.py from dosm/*.csv):
     natq  <- productivity_qtr.csv        (DOSM Jadual Produktiviti Buruh suku / OpenDOSM)
     p14   <- productivity_annual_p14.csv (OpenDOSM; names from DOSM Jadual 3a/4a)
     lfsq  <- lfs_qtr_state.csv            lfsm <- lfs_month.csv
   Nothing is estimated: a missing value is shown as "–".
   ===================================================================== */
const SUKU = (() => {
  const L = () => (typeof S !== 'undefined' && S.lang === 'en');
  const X = (bm, en) => L() ? en : bm;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let pack = null;
  const P = () => { if (!pack) { const el = document.getElementById('k3-data'); pack = el ? JSON.parse(el.textContent) : {}; } return pack; };
  const nf = (v, d = 0) => v == null ? '–' : v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const rm = (v, d = 0) => v == null ? '–' : 'RM' + nf(v, d);
  const pc = (v, d = 1) => v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + nf(Math.abs(v), d) + '%';
  const pp = v => v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + nf(Math.abs(v), 1) + X(' mata %', ' pp');
  const cls = v => v == null ? '' : v >= 0 ? 'sq-up' : 'sq-dn';
  const qName = ym => { const [y, m] = ym.split('-'); const q = { '01': 1, '04': 2, '07': 3, '10': 4 }[m]; return X(`ST${q} ${y}`, `Q${q} ${y}`); };
  const mName = ym => { const [y, m] = ym.split('-'); return new Date(+y, +m - 1, 1).toLocaleDateString(L() ? 'en-GB' : 'ms-MY', { month: 'short', year: 'numeric' }); };
  const SEC = { p1: ['Pertanian', 'Agriculture'], p2: ['Perlombongan & pengkuarian', 'Mining & quarrying'], p3: ['Pembuatan', 'Manufacturing'], p4: ['Pembinaan', 'Construction'], p5: ['Perkhidmatan', 'Services'] };

  // simple bar chart of year-on-year growth (SVG), negative bars below zero
  function bars(vals, labels, hi) {
    const narrow = window.innerWidth < 600, W = narrow ? 420 : 1000, H = narrow ? 200 : 210, pad = 26, n = vals.length, bw = (W - pad * 2) / n, vs = vals.filter(v => v != null);
    const top = Math.max(0, ...vs), bot = Math.min(0, ...vs), range = (top - bot) || 1, sc = (H - pad * 2) / range, y0 = pad + top * sc;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="sq-bars" role="img" aria-label="${esc(X('Pertumbuhan tahun ke tahun setiap suku', 'Year-on-year growth each quarter'))}"><line x1="${pad}" x2="${W - pad}" y1="${y0}" y2="${y0}" stroke="currentColor" stroke-opacity=".25"/>`;
    vals.forEach((v, i) => {
      if (v == null) return; const h = Math.abs(v) * sc, x = pad + i * bw + bw * .18, w = bw * .64, y = v >= 0 ? y0 - h : y0;
      s += `<rect x="${x}" y="${y}" width="${w}" height="${Math.max(h, 1)}" rx="3" class="${i === hi ? 'sq-b-hi' : v >= 0 ? 'sq-b' : 'sq-b-neg'}"><title>${esc(labels[i])}: ${pc(v)}</title></rect>`;
      s += `<text x="${x + w / 2}" y="${v >= 0 ? y - 5 : y + h + 13}" text-anchor="middle" class="sq-bl">${nf(v, 1)}</text>`;
      s += `<text x="${x + w / 2}" y="${H - 4}" text-anchor="middle" class="sq-bx">${esc(labels[i])}</text>`;
    });
    return s + '</svg>';
  }

  function prod(root) {
    const q = P().natq, p14 = P().p14; if (!q || !q.sectors || !q.sectors.p0) return '';
    const d = q.dates, n = d.length - 1, m = q.sectors.p0, last = qName(d[n]);
    const k = Math.max(0, n - (window.innerWidth < 600 ? 5 : 11)), lab = d.slice(k).map(qName);
    const sec = Object.keys(SEC).map(c => { const s = q.sectors[c] || {}; return `<tr><td>${esc(X(...SEC[c]))}</td><td class="num">${rm(s.lp && s.lp[n])}</td><td class="num ${cls(s.g && s.g[n])}">${pc(s.g && s.g[n])}</td><td class="num">${rm(s.lph && s.lph[n], 1)}</td><td class="num ${cls(s.gh && s.gh[n])}">${pc(s.gh && s.gh[n])}</td></tr>`; }).join('');
    let h = `<section class="card sq-card" id="sq-prod"><div class="card-h"><div><h2>${esc(X('Produktiviti suku tahunan terkini', 'Latest quarterly productivity'))} · ${esc(last)}</h2>
      <p class="sub">${esc(X('Malaysia dan 5 sektor utama, harga malar 2015. Nilai suku ialah output bagi tiga bulan, jadi lebih kecil daripada angka tahunan; bandingkan dengan suku yang sama tahun lepas (tahun ke tahun).', 'Malaysia and the 5 main sectors, constant 2015 prices. A quarterly value is output for three months, so it is smaller than the annual figure; compare it with the same quarter last year (year on year).'))}</p></div>
      <span class="pill q-lead">${esc(X('Suku', 'Quarterly'))} · ${esc(last)}</span></div>
      <div class="sq-kpis">
        <div class="chip"><span class="chip-k">${esc(X('Setiap pekerja, suku ini', 'Per worker, this quarter'))}</span><span class="chip-v">${rm(m.lp[n])}</span><span class="sq-s ${cls(m.g[n])}">${pc(m.g[n])} ${esc(X('tahun ke tahun', 'year on year'))}</span></div>
        <div class="chip"><span class="chip-k">${esc(X('Setiap jam bekerja', 'Per hour worked'))}</span><span class="chip-v">${rm(m.lph[n], 1)}</span><span class="sq-s ${cls(m.gh[n])}">${pc(m.gh[n])} ${esc(X('tahun ke tahun', 'year on year'))}</span></div>
        <div class="chip"><span class="chip-k">${esc(X('Suku sebelumnya', 'Previous quarter'))} (${esc(qName(d[n - 1]))})</span><span class="chip-v">${rm(m.lp[n - 1])}</span><span class="sq-s ${cls(m.g[n - 1])}">${pc(m.g[n - 1])}</span></div>
      </div>
      <h3 class="sq-h3">${esc(X('Pertumbuhan produktiviti setiap pekerja, tahun ke tahun (%)', 'Productivity growth per worker, year on year (%)'))}</h3>
      ${bars(m.g.slice(k), lab, lab.length - 1)}
      <div class="tbl-w"><table class="tbl tight"><thead><tr><th>${esc(X('Sektor', 'Sector'))}</th><th class="num">${esc(X('Setiap pekerja', 'Per worker'))}</th><th class="num">${esc(X('Tahun ke tahun', 'Year on year'))}</th><th class="num">${esc(X('Setiap jam', 'Per hour'))}</th><th class="num">${esc(X('Tahun ke tahun', 'Year on year'))}</th></tr></thead><tbody>${sec}</tbody></table></div>
      <p class="sq-src">${esc(X('Sumber: DOSM, Jadual Produktiviti Buruh Suku Tahunan (Jadual 5–6) / OpenDOSM productivity_qtr.', 'Source: DOSM, Quarterly Labour Productivity tables (Tables 5–6) / OpenDOSM productivity_qtr.'))}</p></section>`;
    if (p14 && p14.subs) {
      const y = p14.years, j = y.length - 1, rows = Object.values(p14.subs).map(s => ({ n: X(s.bm, s.en), v: s.lp[j], g: s.lp[j] != null && s.lp[j - 1] ? (s.lp[j] / s.lp[j - 1] - 1) * 100 : null, h: s.lph[j] })).sort((a, b) => (b.v || 0) - (a.v || 0));
      h += `<section class="card sq-card" id="sq-p14"><div class="card-h"><div><h2>${esc(X('14 subsektor keutamaan', '14 priority sub-sectors'))} · ${y[j]}</h2>
        <p class="sub">${esc(X('Produktiviti buruh subsektor keutamaan negara (Nexus), nilai ditambah setiap pekerja setahun, harga malar 2015. Disusun dari tertinggi.', 'Labour productivity of the national priority sub-sectors (Nexus), value added per worker per year, constant 2015 prices. Highest first.'))}</p></div>
        <span class="pill q-lead">${esc(X('Tahunan', 'Annual'))} · ${y[j]}</span></div>
        <div class="tbl-w"><table class="tbl tight"><thead><tr><th>#</th><th class="sq-l">${esc(X('Subsektor', 'Sub-sector'))}</th><th class="num">${esc(X('Setiap pekerja', 'Per worker'))}</th><th class="num">${esc(X(`Berbanding ${y[j - 1]}`, `vs ${y[j - 1]}`))}</th><th class="num">${esc(X('Setiap jam', 'Per hour'))}</th></tr></thead><tbody>
        ${rows.map((r, i) => `<tr><td>${i + 1}</td><td class="sq-l">${esc(r.n)}</td><td class="num">${rm(r.v)}</td><td class="num ${cls(r.g)}">${pc(r.g)}</td><td class="num">${rm(r.h, 1)}</td></tr>`).join('')}</tbody></table></div>
        <p class="sq-src">${esc(X('Sumber: OpenDOSM productivity_annual_p14; nama subsektor daripada DOSM Jadual Produktiviti Buruh (Jadual 3a/4a).', 'Source: OpenDOSM productivity_annual_p14; sub-sector names from DOSM Labour Productivity tables (Tables 3a/4a).'))}</p></section>`;
    }
    return h;
  }

  function lab() {
    const q = P().lfsq, mo = P().lfsm; let h = '';
    if (q && q.states) {
      const d = q.dates, n = d.length - 1, b = n - 4 >= 0 ? n - 4 : null, last = qName(d[n]);
      const names = Object.keys(q.states).filter(s => s !== 'Malaysia').sort((a, c) => (q.states[c].urate[n] || 0) - (q.states[a].urate[n] || 0));
      const row = (s, strong) => { const x = q.states[s]; const du = b != null && x.urate[n] != null && x.urate[b] != null ? x.urate[n] - x.urate[b] : null; const dp = b != null && x.prate[n] != null && x.prate[b] != null ? x.prate[n] - x.prate[b] : null;
        return `<tr${strong ? ' class="sq-tot"' : ''}><td>${esc(s)}</td><td class="num">${nf(x.urate[n], 1)}%</td><td class="num ${du == null ? '' : du <= 0 ? 'sq-up' : 'sq-dn'}">${pp(du)}</td><td class="num">${nf(x.prate[n], 1)}%</td><td class="num ${cls(dp)}">${pp(dp)}</td><td class="num">${nf(x.emp[n], 1)}</td></tr>`; };
      h += `<section class="card sq-card" id="sq-lab"><div class="card-h"><div><h2>${esc(X('Tenaga buruh suku terkini mengikut negeri', 'Latest quarter labour force by state'))} · ${esc(last)}</h2>
        <p class="sub">${esc(X(`Kadar pengangguran dan kadar penyertaan tenaga buruh bagi ${last}, berbanding suku yang sama tahun lepas (${b != null ? qName(d[b]) : '–'}). Disusun dari kadar pengangguran tertinggi. Guna tenaga dalam ribu orang.`, `Unemployment and labour force participation rates for ${last}, compared with the same quarter last year (${b != null ? qName(d[b]) : '–'}). Sorted by highest unemployment. Employment in thousands.`))}</p></div>
        <span class="pill q-lead">${esc(X('Suku', 'Quarterly'))} · ${esc(last)}</span></div>
        <div class="tbl-w"><table class="tbl tight"><thead><tr><th>${esc(X('Negeri', 'State'))}</th><th class="num">${esc(X('Pengangguran', 'Unemployment'))}</th><th class="num">${esc(X('Perubahan', 'Change'))}</th><th class="num">${esc(X('Penyertaan', 'Participation'))}</th><th class="num">${esc(X('Perubahan', 'Change'))}</th><th class="num">${esc(X("Bekerja ('000)", "Employed ('000)"))}</th></tr></thead><tbody>
        ${q.states.Malaysia ? row('Malaysia', true) : ''}${names.map(s => row(s)).join('')}</tbody></table></div>
        <p class="sq-src">${esc(X('Sumber: OpenDOSM lfs_qtr_state (Survei Tenaga Buruh suku tahunan).', 'Source: OpenDOSM lfs_qtr_state (quarterly Labour Force Survey).'))}</p></section>`;
    }
    if (mo && mo.dates && mo.dates.length) {
      const n = mo.dates.length - 1, last = mName(mo.dates[n]), b = n - 12 >= 0 ? n - 12 : null, k = Math.max(0, n - (window.innerWidth < 600 ? 5 : 11));
      h += `<section class="card sq-card" id="sq-month"><div class="card-h"><div><h2>${esc(X('Tenaga buruh bulanan, Malaysia', 'Monthly labour force, Malaysia'))} · ${esc(last)}</h2>
        <p class="sub">${esc(X('Angka nasional terkini setiap bulan (tidak dilaraskan musim), berbanding bulan yang sama tahun lepas.', 'Latest national figures each month (not seasonally adjusted), compared with the same month last year.'))}</p></div>
        <span class="pill q-lead">${esc(X('Bulanan', 'Monthly'))} · ${esc(last)}</span></div>
        <div class="sq-kpis">
          <div class="chip"><span class="chip-k">${esc(X('Kadar pengangguran', 'Unemployment rate'))}</span><span class="chip-v">${nf(mo.urate[n], 1)}%</span><span class="sq-s">${b != null ? pp(mo.urate[n] - mo.urate[b]) : ''}</span></div>
          <div class="chip"><span class="chip-k">${esc(X('Kadar penyertaan', 'Participation rate'))}</span><span class="chip-v">${nf(mo.prate[n], 1)}%</span><span class="sq-s">${b != null ? pp(mo.prate[n] - mo.prate[b]) : ''}</span></div>
          <div class="chip"><span class="chip-k">${esc(X('Penduduk bekerja', 'Employed persons'))}</span><span class="chip-v">${nf(mo.emp[n] / 1000, 2)} ${esc(X('juta', 'million'))}</span><span class="sq-s">${b != null && mo.emp[b] ? pc((mo.emp[n] / mo.emp[b] - 1) * 100) : ''}</span></div>
        </div>
        <h3 class="sq-h3">${esc(X(`Kadar pengangguran, ${n - k + 1} bulan terkini (%)`, `Unemployment rate, latest ${n - k + 1} months (%)`))}</h3>
        ${bars(mo.urate.slice(k), mo.dates.slice(k).map(mName), n - k)}
        <p class="sq-src">${esc(X('Sumber: OpenDOSM lfs_month (Survei Tenaga Buruh bulanan).', 'Source: OpenDOSM lfs_month (monthly Labour Force Survey).'))}</p></section>`;
    }
    return h;
  }

  // ---------- key findings ("3 dapatan utama" + "Apa maksudnya"), computed from the data on every render ----------
  const ST = { johor: 'Johor', kedah: 'Kedah', kelantan: 'Kelantan', melaka: 'Melaka', nsembilan: 'Negeri Sembilan', pahang: 'Pahang', perak: 'Perak', perlis: 'Perlis', ppinang: 'Pulau Pinang', sabah: 'Sabah', sarawak: 'Sarawak', selangor: 'Selangor', terengganu: 'Terengganu', kl: 'W.P. Kuala Lumpur', labuan: 'W.P. Labuan', putrajaya: 'W.P. Putrajaya' };
  const FT = ['W.P. Putrajaya', 'W.P. Labuan'];
  const at = (ys, arr, y) => { const i = ys.indexOf(y); return i < 0 || !arr ? null : arr[i]; };
  const gr = (a, b) => a != null && b ? (a / b - 1) * 100 : null;
  const ext = list => { const v = list.filter(x => x[1] != null).sort((a, b) => b[1] - a[1]); return [v[0], v[v.length - 1]]; };
  function natLfs(y) {
    const L = P().lfs; if (!L) return null; const ks = Object.keys(L.series).filter(k => k.endsWith('|both'));
    const s = f => ks.reduce((t, k) => t + (at(L.years, L.series[k][f], y) || 0), 0), lf = s('lf'), un = s('unemp'), out = s('out');
    return lf ? { urate: un / lf * 100, prate: lf / (lf + out) * 100 } : null;
  }
  function findings(page) {
    const k = P(); let items = [], mean = '', snap = (typeof S !== 'undefined' && S.snap) || null;
    if (page === 'prod' && snap && snap.tables && snap.tables['1']) {
      const t = snap.tables['1'], ys = t.years, Y = ys[ys.length - 1], N = at(ys, t.national, Y), g = gr(N, at(ys, t.national, Y - 1));
      const [hi, lo] = ext(Object.entries(t.rows).map(([id, v]) => [ST[id] || id, at(ys, v, Y)]).filter(x => !FT.includes(x[0])));
      items.push(X(`Produktiviti Malaysia ${Y}: ${rm(N)} setiap pekerja, ${pc(g)} berbanding ${Y - 1}.`, `Malaysia's productivity in ${Y}: ${rm(N)} per worker, ${pc(g)} on ${Y - 1}.`));
      items.push(X(`Jurang antara negeri besar: ${hi[0]} (${rm(hi[1])}) menghasilkan ${nf(hi[1] / lo[1], 1)} kali ganda ${lo[0]} (${rm(lo[1])}), tanpa W.P. Putrajaya dan Labuan.`, `The gap between states is wide: ${hi[0]} (${rm(hi[1])}) produces ${nf(hi[1] / lo[1], 1)} times ${lo[0]} (${rm(lo[1])}), excluding Putrajaya and Labuan.`));
      const q = k.natq; if (q && q.sectors && q.sectors.p0) { const n = q.dates.length - 1; items.push(X(`Data terkini ${qName(q.dates[n])}: produktiviti setiap pekerja ${pc(q.sectors.p0.g[n])} berbanding suku yang sama tahun lepas.`, `Latest data, ${qName(q.dates[n])}: productivity per worker ${pc(q.sectors.p0.g[n])} on the same quarter last year.`)); }
      mean = X(`Produktiviti ialah nilai yang dihasilkan oleh seorang pekerja (bukan gajinya). ${rm(N)} setahun bersamaan kira-kira ${rm(N / 12)} sebulan bagi setiap pekerja. Apabila ia naik, setiap pekerja menghasilkan lebih banyak untuk masa dan tenaga yang sama, yang membuka ruang untuk gaji lebih tinggi.`,
        `Productivity is the value one worker produces (not their pay). ${rm(N)} a year is about ${rm(N / 12)} a month per worker. When it rises, each worker produces more for the same time and effort, which makes room for higher pay.`);
    }
    if (page === 'gdp' && k.nat && k.sgdp) {
      const ny = k.nat.years, Y = ny[ny.length - 1], G = at(ny, k.nat.sectors.p0.gdp, Y), g = gr(G, at(ny, k.nat.sectors.p0.gdp, Y - 1)), sy = k.sgdp.years;
      const st = Object.entries(k.sgdp.series).filter(([key]) => key.endsWith('|p0') && !key.startsWith('Supra')).map(([key, v]) => [key.split('|')[0], at(sy, v, Y), gr(at(sy, v, Y), at(sy, v, Y - 1))]);
      const big = st.slice().sort((a, b) => b[1] - a[1])[0], fast = st.filter(x => x[2] != null).sort((a, b) => b[2] - a[2])[0];
      items.push(X(`KDNK Malaysia ${Y}: RM${nf(G / 1e6, 2)} trilion, ${pc(g)} berbanding ${Y - 1} (harga malar 2015).`, `Malaysia's GDP in ${Y}: RM${nf(G / 1e6, 2)} trillion, ${pc(g)} on ${Y - 1} (constant 2015 prices).`));
      items.push(X(`${big[0]} ekonomi terbesar: ${nf(big[1] / G * 100, 1)}% daripada KDNK negara.`, `${big[0]} is the largest economy: ${nf(big[1] / G * 100, 1)}% of national GDP.`));
      items.push(X(`Paling pantas berkembang pada ${Y}: ${fast[0]} (${pc(fast[2])}).`, `Fastest growing in ${Y}: ${fast[0]} (${pc(fast[2])}).`));
      mean = X('KDNK (Keluaran Dalam Negeri Kasar) ialah jumlah nilai semua barang dan perkhidmatan yang dihasilkan dalam setahun. "Harga malar 2015" bermaksud kesan kenaikan harga telah dibuang, jadi pertumbuhan ini ialah pertambahan pengeluaran sebenar, bukan kerana barang lebih mahal.',
        'GDP (Gross Domestic Product) is the total value of all goods and services produced in a year. "Constant 2015 prices" means price rises have been taken out, so this growth is a real increase in output, not things getting more expensive.');
    }
    if (page === 'wage' && k.wsex) {
      const w = k.wsex, ys = w.years, Y = ys[ys.length - 1], M = at(ys, w.series['Malaysia|both'], Y), g = gr(M, at(ys, w.series['Malaysia|both'], Y - 1));
      const [hi, lo] = ext(Object.entries(w.series).filter(([key]) => key.endsWith('|both') && !key.startsWith('Malaysia') && !FT.includes(key.split('|')[0])).map(([key, v]) => [key.split('|')[0], at(ys, v, Y)]));
      const m = at(ys, w.series['Malaysia|male'], Y), f = at(ys, w.series['Malaysia|female'], Y);
      items.push(X(`Gaji penengah Malaysia ${Y}: ${rm(M)} sebulan, ${pc(g)} berbanding ${Y - 1}.`, `Malaysia's median wage in ${Y}: ${rm(M)} a month, ${pc(g)} on ${Y - 1}.`));
      items.push(X(`Tertinggi ${hi[0]} (${rm(hi[1])}), terendah ${lo[0]} (${rm(lo[1])}), tanpa W.P. Putrajaya dan Labuan.`, `Highest ${hi[0]} (${rm(hi[1])}), lowest ${lo[0]} (${rm(lo[1])}), excluding Putrajaya and Labuan.`));
      if (m && f) items.push(X(`Gaji penengah lelaki ${rm(m)}, wanita ${rm(f)}: beza ${rm(Math.abs(m - f))}.`, `Median wage for men ${rm(m)}, women ${rm(f)}: a gap of ${rm(Math.abs(m - f))}.`));
      mean = X(`Gaji penengah ialah gaji orang yang berada di tengah-tengah: separuh pekerja bergaji kurang daripada ${rm(M)} dan separuh lagi lebih. Ia lebih tepat daripada purata kerana tidak ditarik naik oleh segelintir yang bergaji sangat tinggi.`,
        `The median wage is the pay of the person in the middle: half of workers earn less than ${rm(M)} and half earn more. It is fairer than the average because a few very high earners do not pull it up.`);
    }
    if (page === 'lab' && k.lfs) {
      const ys = k.lfs.years, Y = ys[ys.length - 1], n = natLfs(Y), p = natLfs(Y - 1);
      const [hi] = ext(Object.entries(k.lfs.series).filter(([key]) => key.endsWith('|both')).map(([key, v]) => [key.split('|')[0], at(ys, v.urate, Y)]));
      if (n) items.push(X(`Kadar pengangguran Malaysia ${Y}: ${nf(n.urate, 1)}%${p ? ` (${pp(n.urate - p.urate)} berbanding ${Y - 1})` : ''}; kadar penyertaan ${nf(n.prate, 1)}%.`, `Malaysia's unemployment rate in ${Y}: ${nf(n.urate, 1)}%${p ? ` (${pp(n.urate - p.urate)} on ${Y - 1})` : ''}; participation rate ${nf(n.prate, 1)}%.`));
      if (hi) items.push(X(`Pengangguran tertinggi ${Y}: ${hi[0]} (${nf(hi[1], 1)}%).`, `Highest unemployment in ${Y}: ${hi[0]} (${nf(hi[1], 1)}%).`));
      const mo = k.lfsm; if (mo && mo.dates && mo.dates.length) { const j = mo.dates.length - 1; items.push(X(`Data terkini ${mName(mo.dates[j])}: kadar pengangguran ${nf(mo.urate[j], 1)}%.`, `Latest data, ${mName(mo.dates[j])}: unemployment rate ${nf(mo.urate[j], 1)}%.`)); }
      mean = n ? X(`Kadar pengangguran ${nf(n.urate, 1)}% bermaksud: daripada setiap 100 orang yang bekerja atau sedang mencari kerja, kira-kira ${nf(n.urate, 0)} orang belum mendapat kerja. Kadar penyertaan ialah peratus penduduk umur bekerja (15–64 tahun) yang bekerja atau mencari kerja.`,
        `An unemployment rate of ${nf(n.urate, 1)}% means: of every 100 people working or looking for work, about ${nf(n.urate, 0)} have no job yet. The participation rate is the share of working-age people (15–64) who are working or looking for work.`) : '';
    }
    if (!items.length) return '';
    return `<section class="card sq-find" aria-label="${esc(X('Dapatan utama', 'Key findings'))}"><div class="sq-find-g"><div><h2>${esc(X('Dapatan utama', 'Key findings'))}</h2><ol>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ol></div>
      ${mean ? `<div class="sq-mean"><h3>${esc(X('Apa maksudnya?', 'What does it mean?'))}</h3><p>${esc(mean)}</p></div>` : ''}</div>
      <p class="sq-src">${esc(X('Dikira automatik daripada data DOSM di laman ini; dikemas kini setiap kali data baharu diterbitkan.', 'Calculated automatically from the DOSM data on this site; updated whenever new data is published.'))}</p></section>`;
  }

  // ---------- performance against the RMK-13 productivity target (home) ----------
  // Source: Buku Utama RMK13 (Kementerian Ekonomi, 2025), Bab 2: labour productivity growth target 3.6% a year for
  // 2026-2030; achievement 2.7% a year for 2021-2024. Actual figures below come from the DOSM data on the site.
  const RMK13 = { target: 3.6, from: 2026, to: 2030, past: 2.7, pastFrom: 2021, pastTo: 2024 };
  function rmk() {
    const q = P().natq, snap = (typeof S !== 'undefined' && S.snap) || null; if (!q || !q.sectors || !q.sectors.p0) return '';
    const d = q.dates, g = q.sectors.p0.g, ix = d.map((x, i) => [x, i]).filter(([x]) => +x.slice(0, 4) >= RMK13.from && g[d.indexOf(x)] != null).map(([, i]) => i);
    if (!ix.length) return '';
    const avg = ix.reduce((t, i) => t + g[i], 0) / ix.length, last = ix[ix.length - 1], ok = avg >= RMK13.target;
    const t1 = snap && snap.tables && snap.tables['1'], ys = t1 ? t1.years : [], Y = ys[ys.length - 1], gY = t1 ? gr(at(ys, t1.national, Y), at(ys, t1.national, Y - 1)) : null;
    const W = 100, bar = v => Math.max(2, Math.min(100, v / 6 * W));
    const row = (lab, v, cl) => `<div class="sq-r"><span>${esc(lab)}</span><div class="sq-rb"><i class="${cl}" style="width:${bar(v)}%"></i><b style="left:${bar(RMK13.target)}%"></b></div><strong>${pc(v)}</strong></div>`;
    return `<section class="card sq-rmk" id="sq-rmk"><div class="card-h"><div><h2>${esc(X('Prestasi berbanding sasaran RMK-13', 'Performance against the 13MP target'))}</h2>
      <p class="sub">${esc(X(`Sasaran pertumbuhan produktiviti buruh: ${nf(RMK13.target, 1)}% setahun, ${RMK13.from}–${RMK13.to}. Garis merah ialah sasaran.`, `Labour productivity growth target: ${nf(RMK13.target, 1)}% a year, ${RMK13.from}–${RMK13.to}. The red line is the target.`))}</p></div>
      <span class="pill ${ok ? 'q-lead' : 'q-catch'}">${esc(ok ? X('Melebihi sasaran', 'Above target') : X('Di bawah sasaran', 'Below target'))}</span></div>
      <div class="sq-rows">
        ${row(X(`${RMK13.from} setakat ${qName(d[last])} (purata ${ix.length} suku)`, `${RMK13.from} to ${qName(d[last])} (average of ${ix.length} quarters)`), avg, ok ? 'ok' : 'lo')}
        ${row(X(`Suku terkini, ${qName(d[last])}`, `Latest quarter, ${qName(d[last])}`), g[last], g[last] >= RMK13.target ? 'ok' : 'lo')}
        ${gY != null ? row(X(`Tahun asas ${Y} (sebelum RMK-13)`, `Base year ${Y} (before the 13MP)`), gY, 'base') : ''}
        ${row(X(`Pencapaian ${RMK13.pastFrom}–${RMK13.pastTo} (RMK-13)`, `Achieved ${RMK13.pastFrom}–${RMK13.pastTo} (13MP)`), RMK13.past, 'base')}
      </div>
      <p class="sub">${esc(X(`Maksudnya: ${ok ? `setakat ini produktiviti tumbuh ${pc(avg)} setahun, melebihi sasaran ${nf(RMK13.target, 1)}%. Ia perlu dikekalkan sepanjang ${RMK13.from}–${RMK13.to}.` : `setakat ini produktiviti tumbuh ${pc(avg)} setahun, di bawah sasaran ${nf(RMK13.target, 1)}%. Pertumbuhan perlu dipercepat.`}`,
        `What it means: ${ok ? `so far productivity is growing ${pc(avg)} a year, above the ${nf(RMK13.target, 1)}% target. It has to be sustained through ${RMK13.from}–${RMK13.to}.` : `so far productivity is growing ${pc(avg)} a year, below the ${nf(RMK13.target, 1)}% target. Growth needs to speed up.`}`))}</p>
      <p class="sq-src">${esc(X('Sasaran dan pencapaian 2021–2024: Buku Utama RMK13, Bab 2 (Kementerian Ekonomi). Pertumbuhan sebenar: DOSM, produktiviti buruh setiap pekerja, tahun ke tahun (suku tahunan) dan tahunan, harga malar 2015.', 'Target and 2021–2024 achievement: 13MP main document, Chapter 2 (Ministry of Economy). Actual growth: DOSM, labour productivity per worker, year on year (quarterly) and annual, constant 2015 prices.'))}</p></section>`;
  }

  function place(el, cls, html, anchor) {
    let box = el.querySelector(':scope > .' + cls);
    if (!html) { if (box) box.remove(); return null; }
    if (!box) { box = document.createElement('div'); box.className = cls; if (anchor) anchor.after(box); else el.prepend(box); }
    box.innerHTML = html; return box;
  }
  function mount(page, el) {
    if (!el) return;
    const ph = el.querySelector('.ph'), top = el.querySelector(':scope > #ph-' + page) || (ph && [...el.children].find(c => c === ph || c.contains(ph))) || null;
    if (['prod', 'gdp', 'wage', 'lab'].includes(page)) place(el, 'sq-find-box', findings(page), top);
    if (page === 'home') {
      const so = [...el.querySelectorAll('h2, h3')].find(h => /Sorotan utama|Key highlights/i.test(h.textContent));
      const anchor = so ? [...el.children].find(c => c.contains(so)) : top;
      const block = anchor && anchor.nextElementSibling && anchor.nextElementSibling.querySelector('.hl, article, .kpi') ? anchor.nextElementSibling : anchor;
      place(el, 'sq-rmk-box', rmk(), block);
    }
    if (['prod', 'lab'].includes(page)) {
      let box = el.querySelector(':scope > .sq-root');
      if (!box) { box = document.createElement('div'); box.className = 'sq-root'; const after = page === 'prod' ? el.querySelector(':scope > section.kpis') : el.querySelector(':scope > .kpis, :scope > section'); if (after) after.after(box); else el.appendChild(box); }
      box.innerHTML = page === 'prod' ? prod() : lab();
    }
  }
  return { mount };
})();
