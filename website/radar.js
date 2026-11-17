/* =====================================================================
   Radar Data — DOSM release calendar, new-data detection, website data freshness,
   automated GitHub update progress and Cloudflare deployment status.
   All content comes from /api/radar (functions/api/radar.js), which reads real records:
   the DOSM Advance Release Calendar, the monitoring log written by the GitHub Actions
   (radar-log branch), GitHub issues / pull requests / workflow runs, and the data manifest.
   ===================================================================== */
const RADAR = (() => {
  const L = () => S.lang === 'en';
  const X = (bm, en) => L() ? en : bm;
  const RK = 'sppe-radar-read', CK = 'sppe-radar-cache';
  const st = { data: null, err: '', loading: false, view: 'list', scope: 'sppe', month: null, feed: 'all', open: {}, focus: null };
  const get = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const readIds = () => new Set(get(RK) || []);
  const fmtD = (iso, time) => { if (!iso) return '–'; const d = new Date(iso.length <= 19 && !/Z|\+/.test(iso) ? iso.replace(' ', 'T') + '+08:00' : iso); return d.toLocaleDateString(L() ? 'en-GB' : 'ms-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' }) + (time ? ' ' + d.toLocaleTimeString(L() ? 'en-GB' : 'ms-MY', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' }) : ''); };
  const ago = iso => { if (!iso) return ''; const s = (Date.now() - new Date(iso)) / 1000; if (s < 0) return X('akan datang', 'upcoming'); if (s < 3600) return X(`${Math.max(1, Math.round(s / 60))} min lalu`, `${Math.max(1, Math.round(s / 60))} min ago`); if (s < 86400) return X(`${Math.round(s / 3600)} jam lalu`, `${Math.round(s / 3600)} h ago`); return X(`${Math.round(s / 86400)} hari lalu`, `${Math.round(s / 86400)} days ago`); };
  const countdown = date => { const t = new Date(date.replace(' ', 'T') + '+08:00') - Date.now(); if (t <= 0) return X('Diterbitkan', 'Published'); const d = Math.floor(t / 864e5), h = Math.floor(t % 864e5 / 36e5); return d ? X(`${d} hari ${h} jam`, `${d}d ${h}h`) : X(`${h} jam`, `${h}h`); };
  const GROUPS = () => ({ gdp: [X('KDNK Benar', 'Real GDP'), [['gdp', X('KDNK & Struktur Ekonomi', 'GDP & Economic Structure')], ['negeri', X('Negeri', 'States')], ['makmal', X('Makmal Produktiviti', 'Productivity Lab')], ['bina-laporan', X('Studio Analitik', 'Insights Studio')], ['profil-strategik', X('Profil Strategik Negeri', 'State Strategic Profile')]]],
    prod: [X('Produktiviti Buruh', 'Labour Productivity'), [['productivity', X('Produktiviti Buruh', 'Labour Productivity')], ['negeri', X('Negeri', 'States')], ['integrated', X('Kecerdasan Ekonomi Bersepadu', 'Integrated Economic Intelligence')], ['makmal', X('Makmal Produktiviti', 'Productivity Lab')], ['bina-laporan', X('Studio Analitik', 'Insights Studio')], ['profil-strategik', X('Profil Strategik Negeri', 'State Strategic Profile')], ['reports', X('Koleksi Wawasan', 'Insights Collection')]]],
    wage: [X('Gaji & Upah', 'Wages & Salaries'), [['wages', X('Gaji & Upah', 'Wages & Salaries')], ['integrated', X('Kecerdasan Ekonomi Bersepadu', 'Integrated Economic Intelligence')], ['makmal', X('Makmal Produktiviti', 'Productivity Lab')]]],
    lab: [X('Pasaran Buruh', 'Labour Market'), [['labour', X('Pasaran Buruh', 'Labour Market')], ['negeri', X('Negeri', 'States')], ['makmal', X('Makmal Produktiviti', 'Productivity Lab')], ['bina-laporan', X('Studio Analitik', 'Insights Studio')], ['profil-strategik', X('Profil Strategik Negeri', 'State Strategic Profile')]]],
    cpi: [X('Harga Pengguna (IHP)', 'Consumer Prices (CPI)'), [['wages', X('Gaji & Upah (gaji benar)', 'Wages & Salaries (real wages)')], ['makmal', X('Makmal Produktiviti', 'Productivity Lab')]]],
    hies: [X('Pendapatan Isi Rumah (HIES)', 'Household Income (HIES)'), [['makmal', X('Makmal Produktiviti', 'Productivity Lab')], ['bina-laporan', X('Studio Analitik', 'Insights Studio')]]] });
  const DSN = n => ({ gdp_state_real_supply: X('KDNK negeri mengikut sektor, harga malar 2015', 'State GDP by sector, constant 2015 prices'), productivity_annual: X('Produktiviti buruh tahunan (nasional & sektor)', 'Annual labour productivity (national & sector)'), state_productivity_workbook: X('Produktiviti Buruh Negeri (buku kerja Excel, manual)', 'State Labour Productivity (Excel workbook, manual)'), lfs_state_sex: X('Survei Tenaga Buruh mengikut negeri & jantina', 'Labour Force Survey by state & sex'), wages_state: X('Gaji penengah/purata mengikut negeri', 'Median/mean wages by state'), wages_sector: X('Gaji mengikut sektor', 'Wages by sector'), wages_industry: X('Gaji mengikut industri', 'Wages by industry'), wages_education: X('Gaji mengikut pendidikan', 'Wages by education'), wages_skill: X('Gaji mengikut kemahiran', 'Wages by skill'), formal_wages_state: X('Gaji sektor formal mengikut negeri (bulanan)', 'Formal-sector wages by state (monthly)'), formal_wages_msic: X('Gaji sektor formal mengikut MSIC', 'Formal-sector wages by MSIC'), formal_wages_band: X('Pekerja formal mengikut julat gaji', 'Formal employees by wage band'), cpi_2d_state: X('IHP negeri (bulanan)', 'State CPI (monthly)'), cpi_2d_state_inflation: X('Inflasi negeri (bulanan)', 'State inflation (monthly)'), hies_state: X('Pendapatan & perbelanjaan isi rumah', 'Household income & expenditure'), hies_state_percentile: X('Taburan pendapatan mengikut persentil', 'Income distribution by percentile') })[n] || n;
  const STATUS = s => ({ current: [X('Terkini', 'Up to date'), 'ok'], updated: [X('Dikemas kini', 'Updated'), 'ok'], new: [X('Data baharu dikesan', 'New data detected'), 'new'], changed: [X('Fail DOSM berubah (menunggu semakan)', 'DOSM file changed (awaiting check)'), 'new'], pending: [X('Menunggu kelulusan', 'Awaiting approval'), 'pend'], error: [X('Ralat semakan', 'Check error'), 'err'], unchecked: [X('Belum disemak', 'Not checked yet'), 'mute'], manual: [X('Kemas kini manual', 'Manual update'), 'mute'] })[s] || [s, 'mute'];
  const LVL = { new: '●', pending: '◔', ok: '✓', error: '!', info: 'i', test: 'T' };

  async function load(force) {
    const c = get(CK);
    if (!force && c && Date.now() - c.t < 3e5) { st.data = c.d; return st.data; }
    st.loading = true;
    try { const r = await fetch('/api/radar' + (force ? '?refresh=1' : ''), { headers: { Accept: 'application/json' }, credentials: 'same-origin' }); if (!r.ok) throw new Error('HTTP ' + r.status); st.data = await r.json(); st.err = ''; set(CK, { t: Date.now(), d: st.data }); }
    catch (e) { st.err = String(e.message || e); if (c) st.data = c.d; }
    st.loading = false; bell(); return st.data;
  }
  const notes = () => (st.data && st.data.notes || []).filter(n => !n.at || (Date.now() - new Date(n.at)) < 60 * 864e5);
  const unread = () => { const r = readIds(); return notes().filter(n => !r.has(n.id)); };
  function markRead(ids) { const r = readIds(); ids.forEach(i => r.add(i)); set(RK, [...r].slice(-800)); bell(); }

  /* ---------------- notification bell (header) ---------------- */
  function bell() {
    let b = document.getElementById('rd-bell');
    const host = document.querySelector('.top-right');
    if (!host) return;
    if (!b) { b = document.createElement('div'); b.id = 'rd-bell'; b.className = 'rd-bell'; host.insertBefore(b, host.querySelector('.lang')); }
    const u = unread(), n = u.length, list = notes().slice(0, 8), r = readIds(), open = b.dataset.open === '1';
    b.innerHTML = `<button type="button" class="rd-bell-btn" aria-label="${esc(X('Notifikasi Radar Data', 'Radar Data notifications'))}" aria-expanded="${open}" aria-controls="rd-bell-panel"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>${n ? `<span class="rd-badge">${n > 99 ? '99+' : n}</span>` : ''}</button>
      <div class="rd-bell-panel" id="rd-bell-panel"${open ? '' : ' hidden'}><div class="rd-bp-h"><b>${esc(X('Notifikasi', 'Notifications'))}</b>${n ? `<button type="button" data-rdb="all">${esc(X('Tanda semua dibaca', 'Mark all read'))}</button>` : ''}</div>
      ${list.length ? list.map(x => `<a href="#radar-data" data-rdn="${esc(x.id)}" class="rd-bp-i${r.has(x.id) ? '' : ' un'}"><i class="lv-${x.level}">${LVL[x.level] || 'i'}</i><span>${esc(L() ? x.en : x.bm)}<small>${esc(ago(x.at))}</small></span></a>`).join('') : `<p class="rd-bp-e">${esc(st.err ? X('Notifikasi tidak dapat dimuatkan.', 'Notifications could not be loaded.') : X('Tiada notifikasi.', 'No notifications.'))}</p>`}
      <a class="rd-bp-all" href="#radar-data">${esc(X('Buka Radar Data →', 'Open Radar Data →'))}</a></div>`;
  }
  document.addEventListener('click', e => {
    const b = document.getElementById('rd-bell'); if (!b) return;
    if (e.target.closest('.rd-bell-btn')) { b.dataset.open = b.dataset.open === '1' ? '0' : '1'; bell(); return; }
    if (e.target.closest('[data-rdb="all"]')) { markRead(notes().map(n => n.id)); if (root) render(root); return; }
    const a = e.target.closest('#rd-bell a'); if (a) { const id = a.dataset.rdn; if (id) { markRead([id]); st.focus = id; st.feed = 'all'; } b.dataset.open = '0'; bell(); if (location.hash === '#radar-data' && root) { render(root); scrollFocus(); } return; }
    if (b.dataset.open === '1' && !e.target.closest('#rd-bell')) { b.dataset.open = '0'; bell(); }
  });

  /* ---------------- page ---------------- */
  let root = null, wired = false;
  function scrollFocus() { if (!st.focus || !root) return; setTimeout(() => { const el = root.querySelector(`[data-nid="${CSS.escape(st.focus)}"]`); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('rd-flash'); } }, 60); }
  async function mount(el) {
    root = el; render(el);
    if (!wired) { wired = true; document.addEventListener('click', e => { if (root && root.isConnected && root.contains(e.target)) onClick(e); }); }
    await load(false); render(el); scrollFocus();
  }
  function onClick(e) {
    const t = e.target.closest('[data-rd]'); if (!t) return;
    const k = t.dataset.rd, v = t.dataset.v;
    if (k === 'view') st.view = v; else if (k === 'scope') st.scope = v; else if (k === 'feed') st.feed = v; else if (k === 'row') st.open[v] = !st.open[v];
    else if (k === 'mon') { const m = st.month || new Date(); st.month = new Date(m.getFullYear(), m.getMonth() + (+v), 1); }
    else if (k === 'read') { markRead(notes().map(n => n.id)); }
    else if (k === 'refresh') { load(true).then(() => render(root)); }
    render(root);
  }
  function render(el) {
    const d = st.data;
    if (!d) { el.innerHTML = `<article class="card"><p>${esc(st.err ? X('Radar Data tidak dapat dimuatkan: ', 'Radar Data could not be loaded: ') + st.err : X('Memuatkan rekod pemantauan…', 'Loading monitoring records…'))}</p></article>`; return; }
    const src = d.sources || {}, okS = k => src[k] && src[k].ok;
    const srcChip = (k, l) => `<span class="rd-src ${okS(k) ? 'ok' : 'err'}" title="${esc(src[k] && src[k].error || '')}">${okS(k) ? '●' : '○'} ${esc(l)}</span>`;
    const K = d.kpi || {}, lc = d.lastCheck;
    const kc = (v, l, s, cls, href) => `<a class="rd-kpi ${cls}" href="${href}"><b>${v}</b><span>${esc(l)}</span><small>${esc(s)}</small></a>`;
    el.innerHTML = `
    <div class="rd-bar"><div class="rd-srcs">${srcChip('arc', X('Kalendar DOSM', 'DOSM calendar'))}${srcChip('log', X('Log pemantauan', 'Monitoring log'))}${srcChip('pulls', 'GitHub')}${srcChip('live', 'OpenDOSM')}${srcChip('manifest', X('Manifest laman', 'Site manifest'))}</div>
      <span class="rd-upd">${esc(X('Data radar: ', 'Radar data: ') + fmtD(d.generatedAt, true))}${lc ? ' · ' + esc(X('Semakan DOSM terakhir: ', 'Last DOSM check: ') + fmtD(lc.at, true)) : ''}</span>
      ${d.viewer && d.viewer.admin ? `<button type="button" class="btn k2-mini" data-rd="refresh">↻ ${esc(X('Muat semula sekarang', 'Refresh now'))}</button>` : ''}</div>
    ${st.err ? `<p class="k2-warn k2-review">${esc(X('Sambungan terakhir gagal; memaparkan salinan tersimpan. ', 'Last connection failed; showing the saved copy. ') + st.err)}</p>` : ''}
    <section class="rd-kpis">
      ${kc(K.upcomingSppe ?? 0, X('Keluaran Akan Datang', 'Upcoming Releases'), X(`${K.upcoming || 0} semua penerbitan DOSM hingga hujung kalendar`, `${K.upcoming || 0} DOSM publications to the end of the calendar`), '', '#rd-up')}
      ${kc(K.detected ?? 0, X('Data Baharu Dikesan', 'New Data Detected'), X('set data yang lebih baharu di DOSM', 'datasets newer at DOSM'), K.detected ? 'new' : '', '#rd-ds')}
      ${kc(K.pending ?? 0, X('Menunggu Kemas Kini', 'Awaiting Update'), X('PR atau data menunggu kelulusan', 'PRs or data awaiting approval'), K.pending ? 'pend' : '', '#rd-ds')}
      ${kc(K.updated ?? 0, X('Data Telah Dikemas Kini', 'Data Updated'), X('kemas kini yang digabung & diterbitkan', 'updates merged & deployed'), K.updated ? 'ok' : '', '#rd-ds')}
    </section>
    ${upcoming(d)}
    ${datasets(d)}
    ${(d.watch || []).length ? `<article class="card"><div class="card-h"><div><h2>${esc(X('Senarai pantau (makluman sahaja)', 'Watchlist (notify only)'))}</h2><p class="sub">${esc(X('Keluaran Excel/PDF yang dipantau tetapi dimuat turun secara manual.', 'Excel/PDF releases that are monitored but downloaded by hand.'))}</p></div></div><div class="tbl-w"><table class="tbl rd-t"><thead><tr><th>${esc(X('Sumber', 'Source'))}</th><th>Status</th><th>${esc(X('Butiran', 'Detail'))}</th></tr></thead><tbody>${d.watch.map(w => `<tr><td>${esc(w.name)}</td><td><span class="rd-pill ${w.status === 'NEW' ? 'new' : w.status === 'ok' ? 'ok' : 'mute'}">${esc(w.status === 'NEW' ? X('Berubah', 'Changed') : w.status === 'ok' ? X('Tiada perubahan', 'No change') : X('Belum ditetapkan', 'Not set up'))}</span></td><td>${esc(w.detail || '')}</td></tr>`).join('')}</tbody></table></div></article>` : ''}
    <p class="rd-foot">${esc(X('Sumber: Kalendar Keluaran Awal DOSM (storage.dosm.gov.my/meta/arc.csv), OpenDOSM, rekod GitHub Actions dan Cloudflare Pages. Pemantauan automatik berjalan setiap hari jam 9:17 pagi; ujian yang disimulasikan ditanda [UJIAN].', 'Sources: DOSM Advance Release Calendar (storage.dosm.gov.my/meta/arc.csv), OpenDOSM, GitHub Actions and Cloudflare Pages records. Automatic monitoring runs every day at 9:17 a.m.; simulated tests are marked [TEST].'))} <a href="https://www.dosm.gov.my/portal-main/arc" target="_blank" rel="noopener">DOSM ARC</a> · <a href="https://open.dosm.gov.my/data-catalogue/arc_dosm" target="_blank" rel="noopener">OpenDOSM ARC</a></p>`;
  }
  function upcoming(d) {
    const all = (d.arc || []).filter(a => st.scope === 'all' || a.sppe), up = all.filter(a => !a.released), rec = all.filter(a => a.released).slice(-5).reverse();
    const chips = `<div class="rd-chips"><span class="seg">${[['sppe', X('Berkaitan SPPE', 'SPPE-related')], ['all', X('Semua DOSM', 'All DOSM')]].map(([k, l]) => `<button type="button" data-rd="scope" data-v="${k}" aria-pressed="${st.scope === k}">${esc(l)}</button>`).join('')}</span><span class="seg">${[['list', X('Senarai', 'List')], ['cal', X('Kalendar', 'Calendar')]].map(([k, l]) => `<button type="button" data-rd="view" data-v="${k}" aria-pressed="${st.view === k}">${esc(l)}</button>`).join('')}</span></div>`;
    const row = a => `<tr><td><b>${esc(L() ? a.title_en : a.title_bm)}</b></td><td>${esc(fmtD(a.date, true))}</td><td>${esc(L() ? a.period_en : a.period_bm)}</td><td class="rd-cd">${esc(countdown(a.date))}</td><td>${esc(L() ? a.type_en : a.type_bm)}</td><td><span class="rd-pill ${a.released ? 'ok' : a.date.slice(0, 10) === new Date().toISOString().slice(0, 10) ? 'new' : 'pend'}">${esc(a.released ? X('Diterbitkan', 'Published') : a.date.slice(0, 10) === new Date().toISOString().slice(0, 10) ? X('Hari ini', 'Today') : X('Dijadualkan', 'Scheduled'))}</span></td><td><a href="${esc(L() ? a.url_en : a.url_bm)}" target="_blank" rel="noopener">${esc(X('Sumber rasmi', 'Official source'))} ↗</a></td></tr>`;
    let body;
    if (st.view === 'cal') {
      const m = st.month || new Date(), y = m.getFullYear(), mo = m.getMonth(), first = new Date(y, mo, 1), days = new Date(y, mo + 1, 0).getDate(), pad = (first.getDay() + 6) % 7;
      const by = {}; all.forEach(a => { const k = a.date.slice(0, 10); (by[k] = by[k] || []).push(a); });
      const cells = []; for (let i = 0; i < pad; i++) cells.push('<div class="rd-cal-c e"></div>');
      for (let dd = 1; dd <= days; dd++) { const k = `${y}-${String(mo + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`, it = by[k] || [], today = k === new Date().toISOString().slice(0, 10); cells.push(`<div class="rd-cal-c${today ? ' today' : ''}"><span>${dd}</span>${it.slice(0, 3).map(a => `<a href="${esc(L() ? a.url_en : a.url_bm)}" target="_blank" rel="noopener" class="${a.released ? 'r' : ''}" title="${esc(L() ? a.title_en : a.title_bm)}">${esc(L() ? a.title_en : a.title_bm)}</a>`).join('')}${it.length > 3 ? `<small>+${it.length - 3}</small>` : ''}</div>`); }
      body = `<div class="rd-cal-h"><button type="button" class="btn k2-mini" data-rd="mon" data-v="-1">‹</button><b>${esc(first.toLocaleDateString(L() ? 'en-GB' : 'ms-MY', { month: 'long', year: 'numeric' }))}</b><button type="button" class="btn k2-mini" data-rd="mon" data-v="1">›</button></div><div class="rd-cal">${(L() ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab', 'Ahd']).map(w => `<div class="rd-cal-w">${w}</div>`).join('')}${cells.join('')}</div>`;
    } else {
      body = `<div class="tbl-w"><table class="tbl rd-t"><thead><tr><th>${esc(X('Penerbitan', 'Publication'))}</th><th>${esc(X('Tarikh keluaran', 'Release date'))}</th><th>${esc(X('Tempoh rujukan', 'Reference period'))}</th><th>${esc(X('Kiraan detik', 'Countdown'))}</th><th>${esc(X('Kategori', 'Category'))}</th><th>Status</th><th>${esc(X('Pautan', 'Link'))}</th></tr></thead><tbody>${up.map(row).join('') || `<tr><td colspan="7">${esc(X('Tiada keluaran dijadualkan dalam kalendar semasa.', 'No releases scheduled in the current calendar.'))}</td></tr>`}</tbody></table></div>
      ${rec.length ? `<details class="rd-more"><summary>${esc(X('Baru diterbitkan', 'Recently published'))} (${rec.length})</summary><div class="tbl-w"><table class="tbl rd-t"><tbody>${rec.map(row).join('')}</tbody></table></div></details>` : ''}`;
    }
    return `<article class="card" id="rd-up"><div class="card-h"><div><h2>${esc(X('Keluaran Data Akan Datang', 'Upcoming Data Releases'))}</h2><p class="sub">${esc(X(`Jadual rasmi DOSM (${up.length} akan datang). Kalendar dibaca terus daripada DOSM, jadi tempoh baharu muncul secara automatik apabila DOSM menerbitkannya.`, `Official DOSM schedule (${up.length} upcoming). The calendar is read directly from DOSM, so new periods appear automatically when DOSM publishes them.`))}</p></div></div>${chips}${body}</article>`;
  }
  function feed(d) {
    const r = readIds(), all = notes(), map = { all: () => true, data: n => ['detected', 'validated', 'watch', 'released', 'upcoming'].includes(n.kind), gh: n => ['pr', 'merged', 'closed', 'deployed', 'error'].includes(n.kind), test: n => n.test };
    const list = all.filter(map[st.feed] || map.all).slice(0, 40), n = all.filter(x => !r.has(x.id)).length;
    return `<article class="card rd-feed" id="rd-nt"><div class="card-h"><div><h2>${esc(X('Notifikasi Data Baharu', 'New Data Notifications'))} ${n ? `<span class="rd-pill new">${n} ${esc(X('baharu', 'new'))}</span>` : ''}</h2><p class="sub">${esc(X('Daripada rekod pemantauan sebenar: kalendar DOSM, semakan harian, isu dan Pull Request GitHub.', 'From real monitoring records: DOSM calendar, daily checks, GitHub issues and pull requests.'))}</p></div>${n ? `<button type="button" class="btn k2-mini" data-rd="read">${esc(X('Tanda semua dibaca', 'Mark all read'))}</button>` : ''}</div>
      <div class="rd-chips"><span class="seg">${[['all', X('Semua', 'All')], ['data', X('Data', 'Data')], ['gh', 'GitHub'], ['test', X('Ujian', 'Tests')]].map(([k, l]) => `<button type="button" data-rd="feed" data-v="${k}" aria-pressed="${st.feed === k}">${esc(l)}</button>`).join('')}</span></div>
      <ul class="rd-list">${list.map(x => `<li data-nid="${esc(x.id)}" class="${r.has(x.id) ? '' : 'un'}"><i class="lv-${x.level}">${LVL[x.level] || 'i'}</i><div><p>${esc(L() ? x.en : x.bm)}</p><small>${esc(fmtD(x.at, true))} · ${esc({ log: X('Pemantauan', 'Monitoring'), github: 'GitHub', arc: X('Kalendar DOSM', 'DOSM calendar') }[x.src] || '')}${x.url ? ` · <a href="${esc(L() && x.url_en ? x.url_en : x.url)}" target="_blank" rel="noopener">${esc(X('Lihat', 'View'))} ↗</a>` : ''}</small></div></li>`).join('') || `<li class="rd-e">${esc(X('Tiada notifikasi.', 'No notifications.'))}</li>`}</ul></article>`;
  }
  function pipeline(d) {
    const p = d.latest, admin = d.viewer && d.viewer.admin, names = { detected: X('Data dikesan', 'Data detected'), download: X('Muat turun selesai', 'Download completed'), validated: X('Pengesahan selesai', 'Validation completed'), pr: X('Pull Request GitHub dijana', 'GitHub pull request created'), approval: X('Menunggu kelulusan', 'Awaiting approval'), merged: X('Digabungkan', 'Merged'), deployed: X('Penerbitan Cloudflare selesai', 'Cloudflare deployment completed') };
    const sl = s => ({ done: ['✓', X('Selesai', 'Done')], current: ['◔', X('Sedang berjalan', 'In progress')], pending: ['○', X('Belum', 'Not yet')], error: ['!', X('Gagal', 'Failed')], closed: ['–', X('Ditutup tanpa gabung', 'Closed without merge')] })[s] || ['○', s];
    const steps = (d.steps || []).map((s, i) => `<li class="rd-step ${s.state}"><i>${sl(s.state)[0]}</i><div><b>${i + 1}. ${esc(names[s.k] || s.k)}</b><small>${esc(sl(s.state)[1])}${s.at ? ' · ' + esc(fmtD(s.at, true)) : ''}${s.detail ? ' · ' + esc(s.detail) : ''}${s.url ? ` · <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(X('Lihat', 'View'))} ↗</a>` : ''}</small></div></li>`).join('');
    const runs = (d.runs || []).filter(r => r.branch === 'main').slice(0, 6), deps = ((d.manifest && d.manifest.deployments) || []).slice(-4).reverse();
    return `<article class="card" id="rd-gh"><div class="card-h"><div><h2>${esc(X('Status Kemas Kini GitHub', 'GitHub Update Status'))}</h2><p class="sub">${esc(p ? X(`Kitaran terkini: Pull Request #${p.number}`, `Latest cycle: pull request #${p.number}`) : X('Belum ada Pull Request kemas kini data.', 'No data-update pull request yet.'))}</p></div></div>
      ${p ? `<p class="rd-prt"><a href="${esc(p.url)}" target="_blank" rel="noopener">#${p.number} ${esc(p.title)} ↗</a></p><ol class="rd-steps">${steps}</ol>` : `<p class="rd-e">${esc(X('Apabila semakan harian mengesan data baharu, langkah 1 hingga 7 akan dipaparkan di sini.', 'When the daily check finds new data, steps 1 to 7 appear here.'))}</p>`}
      ${admin ? `<div class="rd-admin"><b>${esc(X('Kawalan pentadbir', 'Administrator controls'))}</b>${p && p.state === 'open' ? `<a class="btn dark k2-mini" href="${esc(p.url)}/files" target="_blank" rel="noopener">${esc(X('Semak & luluskan PR', 'Review & approve PR'))}</a>` : ''}<a class="btn k2-mini" href="https://github.com/${esc(d.repo)}/actions/workflows/dosm-check.yml" target="_blank" rel="noopener">${esc(X('Jalankan semakan sekarang', 'Run a check now'))}</a><a class="btn k2-mini" href="https://github.com/${esc(d.repo)}/pulls?q=is%3Apr+head%3Adosm-update" target="_blank" rel="noopener">${esc(X('Semua PR data', 'All data PRs'))}</a><a class="btn k2-mini" href="https://github.com/${esc(d.repo)}/commits/radar-log" target="_blank" rel="noopener">${esc(X('Jejak audit', 'Audit trail'))}</a></div>` : `<p class="rd-note">${esc(X('Kawalan kelulusan dan repositori hanya dipaparkan kepada pentadbir yang dibenarkan.', 'Approval and repository controls are shown to authorised administrators only.'))}</p>`}
      <h3 class="rd-h3">${esc(X('Aliran kerja automasi terkini', 'Recent automation runs'))}</h3>
      <ul class="rd-runs">${runs.map(r => `<li><span class="rd-pill ${r.status !== 'completed' ? 'pend' : r.conclusion === 'success' ? 'ok' : 'err'}">${esc(r.status !== 'completed' ? X('Berjalan', 'Running') : r.conclusion === 'success' ? X('Berjaya', 'Success') : X('Gagal', 'Failed'))}</span><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.name)}</a><small>${esc(r.branch)} · ${esc(fmtD(r.at, true))}</small></li>`).join('') || `<li class="rd-e">–</li>`}</ul>
      <h3 class="rd-h3">${esc(X('Penerbitan Cloudflare yang direkodkan', 'Recorded Cloudflare deployments'))}</h3>
      ${deps.length ? `<ul class="rd-runs">${deps.map(x => `<li><span class="rd-pill ${x.cloudflare === 'success' ? 'ok' : 'err'}">${esc(x.cloudflare)}</span><code>${esc((x.sha || '').slice(0, 7))}</code><small>${esc(x.ref || '')} · ${esc(fmtD(x.at, true))}${x.pr ? ' · PR #' + x.pr : ''}</small></li>`).join('')}</ul>` : `<p class="rd-e">${esc(X('Belum ada penerbitan kemas kini data direkodkan. Kejayaan hanya dipaparkan selepas semakan Cloudflare berjaya.', 'No data-update deployment recorded yet. Success is only shown after the Cloudflare check passes.'))}</p>`}</article>`;
  }
  function datasets(d) {
    const G = GROUPS(), rows = d.datasets || [];
    return `<article class="card" id="rd-ds"><div class="card-h"><div><h2>${esc(X('Status Data Website', 'Website Data Status'))}</h2><p class="sub">${esc(X('Data yang digunakan oleh laman berbanding data terkini di DOSM, mengikut semakan pemantauan sebenar. Klik "Lihat" untuk butiran dan modul yang terjejas.', 'Data used by the site against the latest DOSM data, from real monitoring checks. Click "View" for details and affected modules.'))}</p></div></div>
      <div class="tbl-w"><table class="tbl rd-t rd-ds"><thead><tr><th>Dataset</th><th>${esc(X('Data Digunakan', 'Data Used'))}</th><th>${esc(X('Data Terkini DOSM', 'Latest DOSM Data'))}</th><th>Status</th><th>${esc(X('Tindakan', 'Action'))}</th></tr></thead><tbody>
      ${Object.keys(G).map(g => { const rs = rows.filter(r => r.group === g); if (!rs.length) return ''; return `<tr class="rd-grp"><td colspan="5">${esc(G[g][0])}</td></tr>` + rs.map(r => { const [sl, sc] = STATUS(r.status), o = st.open[r.name];
        return `<tr><td>${esc(DSN(r.name))}<small>${esc(r.name)}</small></td><td>${esc(r.used || '–')}</td><td>${esc(r.manual ? X('Semak di DOSM', 'Check at DOSM') : r.dosm || '–')}</td><td><span class="rd-pill ${sc}">${esc(sl)}</span></td><td><button type="button" class="btn k2-mini" data-rd="row" data-v="${esc(r.name)}" aria-expanded="${!!o}">${esc(o ? X('Tutup', 'Close') : X('Lihat', 'View'))}</button></td></tr>` + (o ? `<tr class="rd-det"><td colspan="5"><div class="rd-detg">
          <div><b>${esc(X('Semakan terakhir', 'Last check'))}</b>${esc(r.checkedAt ? fmtD(r.checkedAt, true) : X('Belum disemak', 'Not checked yet'))}</div>
          <div><b>${esc(X('Fail DOSM diubah', 'DOSM file modified'))}</b>${esc(r.lastModified ? fmtD(new Date(r.lastModified).toISOString(), true) : '–')}</div>
          <div><b>${esc(X('Keluaran berkaitan seterusnya', 'Next related release'))}</b>${esc(r.next ? `${L() ? r.next.title_en : r.next.title_bm} · ${fmtD(r.next.date)}` : '–')}</div>
          <div><b>${esc(X('Modul yang menggunakan data ini', 'Modules using this data'))}</b>${G[g][1].map(([h, l]) => `<a href="#${h}">${esc(l)}</a>`).join(' · ')}</div></div>
          ${r.manual ? `<p class="rd-note">${esc(X('Buku kerja produktiviti negeri dikemas kini secara manual (lihat docs/dosm-automation.md).', 'The state productivity workbook is updated by hand (see docs/dosm-automation.md).'))}</p>` : ''}${r.simulated ? `<p class="rd-note">${esc(X('Ujian terkawal terakhir menggunakan set data ini (data sebenar tidak diubah).', 'The last controlled test used this dataset (real data was not changed).'))}</p>` : ''}</td></tr>` : ''); }).join(''); }).join('')}
      </tbody></table></div></article>`;
  }
  // first load for the bell on every page
  setTimeout(() => load(false), 1200);
  setInterval(() => load(false), 6e5);
  return { mount, load, bell };
})();
(() => { const r = document.querySelector('#pg-radar .rd-root'); if (r && !r.querySelector('.rd-kpis')) RADAR.mount(r); })();
