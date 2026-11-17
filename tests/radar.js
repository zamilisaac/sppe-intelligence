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
  ok('API reads every real source', ['arc', 'log', 'pulls', 'issues', 'runs', 'live', 'manifest'].every(k => d.sources[k] && d.sources[k].ok), JSON.stringify(d.sources));
  ok('A. four KPI cards from monitoring records', (await p.$$('.rd-kpi')).length === 4 && (await p.$eval('.rd-kpi b', e => e.textContent)) === String(d.kpi.upcomingSppe));
  ok('B. upcoming DOSM releases from the ARC calendar', (await p.$$('#rd-up > .tbl-w tbody tr')).length === d.arc.filter(a => a.sppe && !a.released).length && d.arc.length > 100);
  await p.click('[data-rd="view"][data-v="cal"]'); await p.waitForTimeout(300); ok('B. calendar view', (await p.$$('.rd-cal-c')).length >= 28); await p.click('[data-rd="view"][data-v="list"]');
  ok('C. notification feed from real records', (await p.$$('.rd-list li[data-nid]')).length > 0 && d.notes.every(n => ['log', 'github', 'arc'].includes(n.src)));
  ok('D. dataset status table (16 datasets incl. manual workbook)', (await p.$$('#rd-ds tbody tr:not(.rd-grp)')).length === d.datasets.length && d.datasets.length === 16);
  await p.click('[data-rd="row"][data-v="lfs_state_sex"]'); await p.waitForTimeout(200); ok('D. View shows details and affected modules', /Pasaran Buruh/.test(await p.$eval('.rd-det', e => e.innerText)));
  ok('E. GitHub pipeline shows 7 steps linked to the real PR', (await p.$$('.rd-step')).length === 7 && (await p.$eval('.rd-prt a', e => e.href)).includes('/pull/'));
  ok('E. test pull requests are labelled as tests', !d.latest || !d.latest.test || /UJIAN|TEST/.test(await p.$eval('#rd-gh .sub', e => e.textContent)));
  await p.click('.rd-bell-btn'); await p.waitForTimeout(200); ok('bell panel lists notifications', (await p.$$('#rd-bell a[data-rdn]')).length > 0);
  await p.click('#rd-bell [data-rdb="all"]').catch(() => { }); await p.waitForTimeout(200); ok('mark all read clears the badge', !(await p.$('.rd-badge')));
  await p.click('#lang-en'); await p.waitForTimeout(600); const t = await p.evaluate(() => document.querySelector('#pg-radar').innerText); ok('EN shows English only', !/Keluaran Data Akan|Notifikasi Data|Status Data Website/.test(t) && /Upcoming Data Releases/.test(t)); await p.click('#lang-bm');
  const m = await (await br.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true })).newPage();
  await m.goto(B + '/radar-data'); await m.waitForTimeout(3000); ok('/radar-data path opens the page', (await m.evaluate(() => location.hash)) === '#radar-data');
  ok('mobile: Radar in the bottom menu, no sideways scroll', (await m.$$eval('#nav a', l => l.some(a => a.offsetParent && /Radar/.test(a.textContent)))) && !(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  ok('no page errors', !errs.length, errs.join(' | ')); await br.close();
})();
