/* =====================================================================
   Sorotan Produktiviti Bulanan (Monthly Productivity Highlights) — email newsletter generator.
   Builds a self-contained HTML e-mail (inline styles, table layout for Outlook) from the same
   engines the website uses: K3 calculate(), the State Strategic Profile model (SP), the monthly
   inflation pack and the DOSM release calendar (/api/radar). Nothing is invented; every figure
   carries its period and source.
   ===================================================================== */
const NEWS = (() => {
  const RED = '#C8102E', INK = '#1c1917', MUTE = '#6b6460', LINE = '#e7e2dd', SOFT = '#f6f3f0';
  const MONTHS = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
  const SHORT = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
  const e = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pc = (v, d = 1) => v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d) + '%';
  const ym = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
  const SUBS = ['p3.1', 'p3.2', 'p3.3', 'p3.4', 'p3.5', 'p3.6', 'p3.7', 'p3.8', 'p5.1', 'p5.2', 'p5.3', 'p5.4', 'p5.5', 'p5.6', 'p5.7', 'p5.8'];
  const ROT = ['johor', 'kedah', 'kelantan', 'melaka', 'nsembilan', 'pahang', 'ppinang', 'perak', 'perlis', 'selangor', 'terengganu', 'sabah', 'sarawak', 'kl'];

  async function build(o = {}) {
    const now = new Date(), y = o.y || now.getFullYear(), m = o.m || now.getMonth() + 1, prevLang = S.lang;
    S.lang = 'bm';
    try {
      const radar = await fetch('/api/radar', { credentials: 'same-origin' }).then(r => r.json()).catch(() => null);
      const pack = JSON.parse(document.getElementById('k3-data').textContent);
      const c = (id, ctx) => K3.calculate(id, ctx || {});
      // 1. headline numbers
      const lp = c(1, { geo: 'national' }), lpg = c(3, { geo: 'national', sec: 'p0' }), lph = c(110, { sec: 'p0' }), lphg = c(112, { sec: 'p0' });
      const inf = pack.infl, lastD = inf.dates[inf.dates.length - 1], li = inf.dates.length - 1;
      const infRows = Object.entries(inf.states).map(([s, v]) => ({ s, v: v[li], p: v[li - 1] })).filter(x => x.v != null).sort((a, b) => b.v - a.v);
      const infMed = infRows.length ? infRows[Math.floor(infRows.length / 2)].v : null;
      const lastMonthLabel = d => { const [yy, mm] = d.split('-').map(Number); return `${MONTHS[mm - 1]} ${yy}`; };
      // 2. DOSM releases this month (published) and next month (scheduled), SPPE-related
      const arc = (radar && radar.arc) || [], thisYm = ym(y, m), nextYm = m === 12 ? ym(y + 1, 1) : ym(y, m + 1);
      const pub = arc.filter(a => a.sppe && a.released && a.date.startsWith(thisYm));
      const next = arc.filter(a => a.sppe && !a.released && (a.date.startsWith(thisYm) || a.date.startsWith(nextYm))).slice(0, 8);
      // 3. rotating spotlights: one state and one subsector per month
      const stId = o.state || ROT[(y * 12 + m) % ROT.length], sub = o.sub || SUBS[(y * 12 + m) % SUBS.length];
      const sp = SP.model(stId), stName = STATE_BY_ID[stId].bm;
      const s114 = c(114, { sub }), s117 = c(117, { sub }), s116 = c(116, { sub }), s115 = c(115, { sub });
      const subName = s114.inputs && s114.inputs[0] ? s114.inputs[0].label.replace(/^VA benar /, '') : sub;
      // 4. data refreshed on the site
      const asOf = (radar && radar.manifest && radar.manifest.asOf) || {};
      const perLabel = v => !v ? '–' : v.length === 7 ? `${SHORT[+v.slice(5) - 1]} ${v.slice(0, 4)}` : v;
      const newest = [['cpi_2d_state', 'IHP negeri'], ['formal_wages_state', 'gaji sektor formal'], ['lfs_state_sex', 'Survei Tenaga Buruh'], ['productivity_annual', 'produktiviti buruh']].filter(([k]) => asOf[k]).sort((a, b) => (asOf[b[0]].padEnd(7, '-12') > asOf[a[0]].padEnd(7, '-12') ? 1 : -1));
      const issue = `${MONTHS[m - 1]} ${y}`, subject = `Sorotan Produktiviti Bulanan · ${issue} · SPPE Intelligence`;
      const site = o.site || location.origin;

      const card = (big, label, sub2, accent) => `<td width="25%" valign="top" style="padding:6px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid ${LINE};border-top:3px solid ${accent || RED};border-radius:10px"><tr><td style="padding:12px 12px 14px;font-family:Arial,Helvetica,sans-serif"><div style="font-size:22px;font-weight:bold;color:${INK};line-height:1.15">${e(big)}</div><div style="font-size:12px;font-weight:bold;color:${INK};margin-top:4px">${e(label)}</div><div style="font-size:11px;color:${MUTE};margin-top:3px;line-height:1.35">${e(sub2)}</div></td></tr></table></td>`;
      const h2 = (n, t) => `<tr><td style="padding:22px 24px 6px;font-family:Arial,Helvetica,sans-serif"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="background:${RED};color:#fff;font-weight:bold;font-size:12px;width:22px;height:22px;text-align:center;border-radius:4px">${n}</td><td style="padding-left:10px;font-size:16px;font-weight:bold;color:${INK}">${e(t)}</td></tr></table></td></tr>`;
      const p = t => `<tr><td style="padding:4px 24px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:${INK}">${t}</td></tr>`;
      const src = t => `<tr><td style="padding:6px 24px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${MUTE}">Sumber: ${e(t)}</td></tr>`;
      const relRow = a => { const d = new Date(a.date.replace(' ', 'T') + '+08:00'); return `<tr><td width="58" valign="top" style="padding:7px 0;border-bottom:1px solid ${LINE}"><div style="background:${SOFT};border-radius:8px;text-align:center;padding:4px 0;font-family:Arial,Helvetica,sans-serif"><div style="font-size:17px;font-weight:bold;color:${INK}">${d.getDate()}</div><div style="font-size:10px;font-weight:bold;color:${MUTE}">${SHORT[d.getMonth()].toUpperCase()}</div></div></td><td valign="middle" style="padding:7px 0 7px 12px;border-bottom:1px solid ${LINE};font-family:Arial,Helvetica,sans-serif"><a href="${e(a.url_bm)}" style="font-size:14px;font-weight:bold;color:${INK};text-decoration:none">${e(a.title_bm)}</a><div style="font-size:12px;color:${MUTE}">${e(a.type_bm)}${a.period_bm ? ' · tempoh rujukan ' + e(a.period_bm) : ''}</div></td></tr>`; };
      const find = (sp.text && sp.text.kpi) ? [sp.text.kpi] : [];
      const one = t => t.split(/(?<=\.)\s(?=[A-Z])/)[0]; const stFind = [sp.text.bg[1], sp.text.kpi, sp.text.sec].filter(Boolean).map(one);
      const stRec = (SP.plan(sp)[0] || null);

      const html = `<!doctype html><html lang="ms"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(subject)}</title></head>
<body style="margin:0;padding:0;background:#efebe7">
<div style="display:none;max-height:0;overflow:hidden">Produktiviti buruh ${e(lp.display)} setiap pekerja; produktiviti sejam ${e(lph.display)}; inflasi negeri ${e(lastMonthLabel(lastD))}; sorotan ${e(stName)}.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#efebe7"><tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden">
  <tr><td style="background:${INK};padding:22px 24px;font-family:Arial,Helvetica,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
      <td><div style="font-size:11px;letter-spacing:2px;font-weight:bold;color:#ff9aa5">SPPE INTELLIGENCE · MPC</div><div style="font-size:24px;font-weight:bold;color:#ffffff;margin-top:6px">Sorotan Produktiviti Bulanan</div><div style="font-size:14px;color:#d6d0cb;margin-top:4px">${e(issue)} · Bil. ${(y - 2026) * 12 + m - 10}</div></td>
      <td align="right" valign="top"><div style="background:#ffffff;border-radius:8px;padding:6px 10px;font-size:13px;font-weight:bold;color:${RED}">MPC</div></td>
    </tr></table></td></tr>
  <tr><td style="padding:18px 24px 4px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:${INK}">Assalamualaikum dan salam sejahtera. Ini ringkasan bulanan prestasi produktiviti dan data ekonomi terkini daripada SPPE Intelligence, berdasarkan data rasmi Jabatan Perangkaan Malaysia (DOSM).</td></tr>
  ${h2(1, 'Angka utama bulan ini')}
  <tr><td style="padding:2px 18px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
    ${card(lp.display, 'Produktiviti buruh', `setiap pekerja, ${lp.context.year} · ${pc(lpg.value, 2)} setahun`)}
    ${card(lph.display, 'Produktiviti sejam', `setiap jam bekerja, ${lph.context.year} · ${pc(lphg.value, 2)}`, '#1d4ed8')}
    ${card(infMed == null ? '–' : infMed.toFixed(1) + '%', 'Inflasi negeri (penengah)', `${lastMonthLabel(lastD)}, tahun ke tahun`, '#d97706')}
    ${card(newest.length ? perLabel(asOf[newest[0][0]]) : '–', 'Data terkini dalam laman', newest.slice(0, 2).map(([k, l]) => `${l}: ${perLabel(asOf[k])}`).join(' · '), '#059669')}
  </tr></table></td></tr>
  ${p(`Seorang pekerja di Malaysia menghasilkan purata <b>${e(lp.display)}</b> nilai ekonomi setahun pada ${lp.context.year} (harga malar 2015), ${lpg.value >= 0 ? 'naik' : 'turun'} ${e(pc(Math.abs(lpg.value), 2).replace('+', ''))}. Bagi setiap jam bekerja, nilainya <b>${e(lph.display)}</b>.`)}
  ${src('DOSM, Produktiviti Buruh Tahunan (OpenDOSM productivity_annual); IHP negeri (cpi_2d_state_inflation). Pengiraan: SPPE Intelligence.')}
  ${h2(2, 'Keluaran DOSM bulan ini')}
  <tr><td style="padding:4px 24px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${pub.length ? pub.map(relRow).join('') : `<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTE};padding:6px 0">Tiada keluaran berkaitan produktiviti diterbitkan setakat ini bulan ini.</td></tr>`}</table></td></tr>
  ${h2(3, `Negeri bulan ini: ${stName}`)}
  ${p(stFind.map(t => `• ${e(t)}`).join('<br>'))}
  ${stRec ? `<tr><td style="padding:10px 24px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${SOFT};border-left:4px solid ${RED};border-radius:0 8px 8px 0"><tr><td style="padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${INK}"><b>Cadangan awal (${e(stRec.sec)}):</b> ${e(stRec.int)}. <span style="color:${MUTE}">Agensi berpotensi: ${e(stRec.ag)}. Untuk semakan penganalisis; bukan dasar rasmi.</span></td></tr></table></td></tr>` : ''}
  ${src(`DOSM, Produktiviti Buruh Negeri; KDNK Negeri (harga malar 2015); Survei Tenaga Buruh. Profil penuh: Profil Strategik Negeri di laman.`)}
  ${h2(4, `Subsektor bulan ini: ${subName}`)}
  ${p(`Seorang pekerja dalam subsektor <b>${e(subName.toLowerCase())}</b> menghasilkan purata <b>${e(s114.display)}</b> setahun pada ${s114.context.year}. Subsektor ini menyumbang ${e(s116.display)} daripada nilai sektornya dan berada di kedudukan ${e(s115.display)} ${e(s115.unit)}. Sejak ${s117.context.y0}, produktivitinya ${s117.value >= 0 ? 'naik' : 'turun'} purata ${e(pc(Math.abs(s117.value)).replace('+', ''))} setahun.`)}
  ${src('DOSM, Produktiviti Buruh Tahunan mengikut subsektor (productivity_annual). Lihat Makmal Produktiviti, pengiraan 114–117.')}
  ${h2(5, `Harga dan kos sara hidup: ${lastMonthLabel(lastD)}`)}
  ${p(`Inflasi tahun ke tahun paling tinggi di <b>${e(infRows[0].s)}</b> (${infRows[0].v.toFixed(1)}%) dan paling rendah di <b>${e(infRows[infRows.length - 1].s)}</b> (${infRows[infRows.length - 1].v.toFixed(1)}%). Penengah 16 negeri: ${infMed.toFixed(1)}%.`)}
  <tr><td style="padding:8px 24px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${infRows.slice(0, 3).concat([null], infRows.slice(-3)).map((r, j) => { if (!r) return `<tr><td colspan="3" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${MUTE};padding:2px 0">… ${infRows.length - 6} negeri lain …</td></tr>`; const i = j > 3 ? j - 1 : j; return `<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${INK};padding:3px 0;width:150px">${e(r.s)}</td><td style="padding:3px 0"><div style="background:${i < 3 ? RED : '#9aa3ad'};height:10px;width:${Math.max(4, Math.round(r.v / infRows[0].v * 300))}px;border-radius:3px"></div></td><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:${INK};padding:3px 0 3px 8px;width:60px;text-align:right">${r.v.toFixed(1)}%</td></tr>`; }).join('')}</table></td></tr>
  ${src('DOSM, Indeks Harga Pengguna negeri (OpenDOSM cpi_2d_state_inflation), keseluruhan.')}
  ${h2(6, 'Akan datang')}
  <tr><td style="padding:4px 24px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${next.length ? next.map(relRow).join('') : `<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTE}">Tiada keluaran dijadualkan.</td></tr>`}</table></td></tr>
  ${src('Kalendar Keluaran Awal DOSM. Jadual penuh: Radar Data di laman.')}
  <tr><td align="center" style="padding:26px 24px 8px"><a href="${e(site)}/#home" style="display:inline-block;background:${RED};color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:12px 22px;border-radius:999px">Baca penuh di SPPE Intelligence →</a></td></tr>
  <tr><td style="padding:18px 24px 22px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:${MUTE};border-top:1px solid ${LINE}">Analisis oleh Perbadanan Produktiviti Malaysia (MPC). Sumber data: Jabatan Perangkaan Malaysia (DOSM). Angka ialah data rasmi atau dikira daripadanya; cadangan ialah cadangan awal untuk semakan dan bukan dasar rasmi kerajaan. Anda menerima e-mel ini kerana tersenarai sebagai penerima Sorotan Produktiviti Bulanan. Untuk berhenti melanggan, balas e-mel ini.</td></tr>
</table></td></tr></table></body></html>`;
      return { subject, html, issue, state: stId, sub };
    } finally { S.lang = prevLang; }
  }
  return { build };
})();
