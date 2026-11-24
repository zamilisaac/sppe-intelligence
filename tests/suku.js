// Latest quarterly / monthly / 14 sub-sector data (website/suku.js). Every figure shown must equal the data pack.
// Run: python3 -m http.server 8811 -d website   then: node tests/suku.js
const { chromium } = require('playwright'); const B = process.env.SUKU_BASE || 'http://127.0.0.1:8811';
const ok = (n, c, x = '') => console.log((c ? 'PASS' : 'FAIL') + ' ' + n + (x !== '' ? '  (' + x + ')' : ''));
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(B + '/#productivity'); await p.waitForTimeout(1800); await p.click('#lang-bm').catch(() => {}); await p.waitForTimeout(600);
  const k = await p.evaluate(() => JSON.parse(document.getElementById('k3-data').textContent));
  const q = k.natq, n = q.dates.length - 1, [y, m] = q.dates[n].split('-'), qn = { '01': 1, '04': 2, '07': 3, '10': 4 }[m];
  const t = await p.$eval('#sq-prod', e => e.innerText).catch(() => '');
  ok('quarterly productivity card on the Produktiviti Buruh page', t.length > 0);
  ok('card names the latest quarter from the data', t.includes(`ST${qn} ${y}`), `ST${qn} ${y}`);
  ok('per-worker value equals the data pack', t.includes('RM' + Math.round(q.sectors.p0.lp[n]).toLocaleString('en-US')), q.sectors.p0.lp[n]);
  ok('year-on-year growth equals the data pack', t.includes('+' + q.sectors.p0.g[n].toFixed(1) + '%'), q.sectors.p0.g[n]);
  ok('five main sectors listed', ['Pertanian', 'Perlombongan', 'Pembuatan', 'Pembinaan', 'Perkhidmatan'].every(s => t.includes(s)));
  const t14 = await p.$eval('#sq-p14', e => e.innerText).catch(() => '');
  ok('14 priority sub-sectors listed with names', Object.values(k.p14.subs).length === 14 && Object.values(k.p14.subs).every(s => t14.includes(s.bm)));
  await p.click('#lang-en'); await p.waitForTimeout(600);
  const te = await p.$eval('#sq-prod', e => e.innerText).catch(() => '');
  ok('EN mode shows English only in the new cards', /Latest quarterly productivity/.test(te) && !/Pertanian|tahun ke tahun|Setiap pekerja/.test(te));
  await p.click('#lang-bm'); await p.waitForTimeout(400);
  await p.goto(B + '/#labour'); await p.waitForTimeout(1800);
  const L = k.lfsq, ln = L.dates.length - 1, [ly, lm] = L.dates[ln].split('-'), lq = { '01': 1, '04': 2, '07': 3, '10': 4 }[lm];
  const tl = await p.$eval('#sq-lab', e => e.innerText).catch(() => '');
  ok('labour force by state for the latest quarter on Pasaran Buruh', tl.includes(`ST${lq} ${ly}`) && (tl.match(/\n/g) || []).length > 16);
  const s0 = Object.keys(L.states)[0]; ok('state unemployment rate equals the data pack', tl.includes(L.states[s0].urate[ln].toFixed(1) + '%'), s0);
  const tm = await p.$eval('#sq-month', e => e.innerText).catch(() => '');
  ok('monthly national labour force shown with its latest rate', tm.includes(k.lfsm.urate[k.lfsm.urate.length - 1].toFixed(1) + '%'));
  const ph = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
  for (const h of ['productivity', 'labour']) { await ph.goto(B + '/#' + h); await ph.waitForTimeout(1500); ok(`phone: no sideways scroll on ${h}`, !(await ph.evaluate(() => document.documentElement.scrollWidth > innerWidth))); }
  ok('no page errors', !errs.length, errs.join(' | ')); await b.close();
})();
