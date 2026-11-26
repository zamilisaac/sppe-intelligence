// Radar Data: menu, page sections, bell, language and mobile. Needs a server for website/ that also answers
// /api/radar with functions/api/radar.js (real DOSM + GitHub records), e.g. the local dev server on port 8822.
// Run: node tests/radar.js   (RADAR_BASE=http://host:port to point elsewhere)
const { chromium } = require('playwright'); const B = process.env.RADAR_BASE || 'http://127.0.0.1:8822';
const ok = (n, c, x = '') => console.log((c ? 'PASS' : 'FAIL') + ' ' + n + (x !== '' ? '  (' + x + ')' : ''));
(async () => {
  const br = await chromium.launch(); const errs = []; const p = await (await br.newContext({ viewport: { width: 1440, height: 1000 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(B + '/#home'); await p.waitForTimeout(2500);
  const nav = await p.$$eval('#nav a .nl', l => l.map(a => a.textContent.trim()));
  ok('Radar Data is right of Kecerdasan in the main menu', nav.indexOf('Radar Data') === nav.indexOf('Kecerdasan Ekonomi Bersepadu') + 1, nav.join('|'));
  ok('notification bell in the header', await p.isVisible('#rd-bell .rd-bell-btn'));
  await p.click('#nav a[href="#radar-data"]'); await p.waitForTimeout(2500);
  const d = await p.evaluate(() => fetch('/api/radar').then(r => r.json()));
  const ym = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).slice(0, 7), [yy, mm] = ym.split('-').map(Number), nx = mm === 12 ? `${yy + 1}-01` : `${yy}-${String(mm + 1).padStart(2, '0')}`, win = a => !a.released && [ym, nx].includes(a.date.slice(0, 7));
  ok('API reads every real source', ['arc', 'log', 'live', 'manifest'].every(k => d.sources[k] && d.sources[k].ok), JSON.stringify(d.sources));
  { const h0 = await p.evaluate(() => location.hash); await p.click('.rd-kpi:nth-child(2)'); await p.waitForTimeout(600); ok('A. clicking a KPI card stays on Radar Data', (await p.evaluate(() => location.hash)) === '#radar-data' && h0 === '#radar-data'); }
  ok('A. four KPI cards from monitoring records', (await p.$$('.rd-kpi')).length === 4 && (await p.$eval('.rd-kpi b', e => e.textContent)) === String(d.arc.filter(a => a.sppe && win(a)).length));
  ok('B. upcoming list = this month and next only', (await p.$$('#rd-up .rd-tl-i')).length === d.arc.filter(a => a.sppe && win(a)).length && d.arc.length > 100);
  await p.click('[data-rd="view"][data-v="cal"]'); await p.waitForTimeout(300); ok('B. calendar view', (await p.$$('.rd-cal-c')).length >= 28); for (let i = 0; i < 3; i++) { await p.click('[data-rd="mon"][data-v="1"]'); await p.waitForTimeout(150); } ok('B. calendar reaches next year and explains a schedule not yet published', d.calendarYears[d.nextYear] ? (await p.$$('.rd-cal-c a')).length > 0 : /belum menerbitkan jadual/.test(await p.$eval('#rd-up', e => e.innerText))); await p.click('[data-rd="view"][data-v="list"]');
  ok('no notification feed on the page (bell only)', !(await p.$('.rd-feed')) && d.notes.every(n => ['log', 'github', 'arc'].includes(n.src)));
  ok('D. dataset status table lists every monitored dataset (incl. quarterly productivity and the manual workbook)', (await p.$$('#rd-ds tbody tr:not(.rd-grp)')).length === d.datasets.length && d.datasets.length >= 16 && d.datasets.some(x => x.name === 'productivity_qtr') && d.datasets.some(x => x.manual), d.datasets.length);
  await p.click('[data-rd="row"][data-v="lfs_state_sex"]'); await p.waitForTimeout(200); ok('D. View shows details and affected modules', /Pasaran Buruh/.test(await p.$eval('.rd-det', e => e.innerText)));
  ok('GitHub update status card removed', !(await p.$('#rd-gh')) && !(await p.$('.rd-step')));
  await p.click('[data-rd="scope"][data-v="all"]'); await p.waitForTimeout(200); const nAll = (await p.$$('#rd-up .rd-tl-i')).length; ok('B. SPPE / all DOSM toggle works', nAll === d.arc.filter(win).length, nAll);
  await p.goto(B + '/#home'); await p.waitForTimeout(800); await p.goto(B + '/#radar-data'); await p.waitForTimeout(1500); await p.click('[data-rd="view"][data-v="cal"]'); await p.waitForTimeout(300); ok('B. toggles still work after leaving and returning to the page', (await p.$$('.rd-cal-c')).length >= 28); await p.click('[data-rd="view"][data-v="list"]');
  await p.click('.rd-bell-btn'); await p.waitForTimeout(200); ok('bell panel lists notifications', (await p.$$('#rd-bell a[data-rdn]')).length > 0);
  await p.click('#rd-bell [data-rdb="all"]').catch(() => { }); await p.waitForTimeout(200); ok('mark all read clears the badge', !(await p.$('.rd-badge')));
  await p.click('#lang-en'); await p.waitForTimeout(600); const t = await p.evaluate(() => document.querySelector('#pg-radar').innerText); ok('EN shows English only', !/Keluaran Data Akan|Notifikasi Data|Status Data Website/.test(t) && /Upcoming Data Releases/.test(t)); await p.click('#lang-bm');
  const m = await (await br.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true })).newPage();
  await m.goto(B + '/radar-data'); await m.waitForTimeout(3000); ok('/radar-data path opens the page', (await m.evaluate(() => location.hash)) === '#radar-data');
  ok('mobile: Radar in the bottom menu, no sideways scroll', (await m.$$eval('#nav a', l => l.some(a => a.offsetParent && /Radar/.test(a.textContent)))) && !(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  ok('no page errors', !errs.length, errs.join(' | ')); await br.close();
})();
