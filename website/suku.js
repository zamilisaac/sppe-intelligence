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

  function mount(page, el) {
    if (!el || !['prod', 'lab'].includes(page)) return;
    let box = el.querySelector(':scope > .sq-root');
    if (!box) { box = document.createElement('div'); box.className = 'sq-root'; const after = page === 'prod' ? el.querySelector(':scope > section.kpis') : el.querySelector(':scope > .kpis, :scope > section'); if (after) after.after(box); else el.appendChild(box); }
    box.innerHTML = page === 'prod' ? prod() : lab();
  }
  return { mount };
})();
