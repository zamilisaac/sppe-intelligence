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
  // key findings and the RMK-13 target card (review items 3 and 5)
  await p.click('#lang-bm').catch(() => {});
  for (const [h, re] of [['productivity', /Produktiviti Malaysia \d{4}: RM[\d,]+ setiap pekerja/], ['gdp', /KDNK Malaysia \d{4}: RM[\d.]+ trilion/], ['wages', /Gaji penengah Malaysia \d{4}: RM[\d,]+ sebulan/], ['labour', /Kadar pengangguran Malaysia \d{4}: [\d.]+%/]]) {
    await p.goto(B + '/#' + h); await p.waitForTimeout(1500);
    const f = await p.evaluate(() => { const pg = document.querySelector('.pg:not([hidden])'), e = pg.querySelector('.sq-find'), t = pg.querySelector('.ph-t'); return e ? { text: e.innerText, below: e.getBoundingClientRect().top > t.getBoundingClientRect().top, items: e.querySelectorAll('li').length, mean: !!e.querySelector('.sq-mean') } : null; });
    ok(`${h}: key findings box below the title with 3 findings and a plain explanation`, f && f.below && f.items === 3 && f.mean, f && f.items);
    ok(`${h}: first finding states the national figure`, f && re.test(f.text), f && f.text.slice(0, 80));
  }
  ok('gdp: national GDP in the findings equals the data pack', await p.goto(B + '/#gdp').then(() => p.waitForTimeout(1200)).then(() => p.$eval('.pg:not([hidden]) .sq-find', e => e.innerText)).then(t => t.includes('RM' + (k.nat.sectors.p0.gdp[k.nat.sectors.p0.gdp.length - 1] / 1e6).toFixed(2) + ' trilion')));
  await p.goto(B + '/#home'); await p.waitForTimeout(1800);
  const g26 = k.natq.dates.map((d, i) => d >= '2026' ? k.natq.sectors.p0.g[i] : null).filter(v => v != null), avg = g26.reduce((a, c) => a + c, 0) / g26.length;
  const rt = await p.$eval('#sq-rmk', e => e.innerText).catch(() => '');
  ok('home: RMK-13 card shows the 3.6% target with its source', /3\.6% setahun, 2026–2030/.test(rt) && /Buku Utama RMK13/.test(rt));
  ok('home: 2026 average growth equals the data', rt.includes('+' + avg.toFixed(1) + '%'), avg.toFixed(2));
  ok('home: status matches the numbers', avg >= 3.6 ? /MELEBIHI SASARAN/i.test(rt) : /DI BAWAH SASARAN/i.test(rt));
  await p.click('#lang-en'); await p.waitForTimeout(600);
  const re = await p.$eval('#sq-rmk', e => e.innerText).catch(() => '');
  ok('home: RMK-13 card in English only in EN mode', /13MP target/.test(re) && !/sasaran|setahun|Maksudnya/.test(re));
  await p.click('#lang-bm');
  // Makmal: formulas in math notation, search-first (review item 10)
  await p.goto(B + '/#makmal'); await p.waitForTimeout(1800);
  const f4 = await p.evaluate(() => { const tr = [...document.querySelectorAll('.lab-t tbody tr')].find(r => r.cells[0].innerText.trim() === '4'); return tr ? tr.querySelector('.fx') && tr.querySelector('.fx').innerHTML : null; });
  ok('Makmal: CAGR formula shown with a power and subscripts, no raw ^ or _', f4 && /<sup>1\/n<\/sup>/.test(f4) && /<sub>akhir<\/sub>/.test(f4) && !/[\^_]/.test(f4.replace(/<[^>]+>/g, '')), f4);
  ok('Makmal: no formula left as plain code', !(await p.$('.lab-t code')));
  const total = await p.$$eval('.lab-t tbody tr', l => l.length);
  await p.click('.lab-chips .lab-chip'); await p.waitForTimeout(400);
  const one = await p.$$eval('.lab-t tbody tr', l => l.length); ok('Makmal: a category chip filters the list', one > 0 && one < total, `${one}/${total}`);
  await p.click('[data-k3chip^="clear"]'); await p.waitForTimeout(300);
  await p.fill('input[data-k3f="q"]', 'menganggur'); await p.waitForTimeout(800);
  ok('Makmal: plain-language words find calculations (searches the explanations too)', /pengangguran/i.test(await p.$eval('.lab-t', e => e.innerText).catch(() => '')));
  ok('no page errors', !errs.length, errs.join(' | ')); await b.close();
})();
