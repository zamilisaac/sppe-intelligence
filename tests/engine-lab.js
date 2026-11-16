// Shared engine + Productivity Lab tests. Fixtures are the catalogue's sample values (PDF section 2);
// they are only compared against, never used by the runtime.
// Run: python3 -m http.server 8811 -d website   then: node tests/engine-lab.js
const { chromium } = require('playwright'); const B = 'http://127.0.0.1:8811';
const ok = (n, c, x = '') => console.log((c ? 'PASS' : 'FAIL') + ' ' + n + (x !== '' ? '  (' + x + ')' : ''));
(async () => {
  const br = await chromium.launch(); const errs = [];
  const ctx = await br.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(B + '/#home'); await p.waitForTimeout(1800);
  const r = await p.evaluate(() => {
    const c = (id, x) => K3.calculate(id, x);
    return {
      lpMy: c(1, { geo: 'national', year: 2025 }), lpMfg: c(2, { sec: 'p3', year: 2025 }), g25: c(3, { geo: 'national', sec: 'p0', year: 2025 }),
      rel: c(6, { sec: 'p3', year: 2025 }), sim: c(105, { sec: 'p0', year: 2025, uplift: 10 }), lpSel: c(1, { geo: 'selangor', year: 2025 }), hhi: c(48, { year: 2025 }),
      msme: c(8, {}), gap: c(10, {}), cap: c(13, {}), p90: c(29, {}), sh: c(62, { y0: 2015, year: 2025 }), id11: c(11, { sec: 'p0', year: 2025 }),
      again: c(1, { geo: 'national', year: 2025 }), count: K3.CAT.length, run: K3.CAT.filter(x => K3.runnable(x[0])).length, ids: K3.CAT.map(x => x[0]).join(','),
    };
  });
  ok('registry has IDs 1..109', r.count === 109 && r.ids === Array.from({ length: 109 }, (_, i) => i + 1).join(','));
  ok('fixture: Malaysia LP 2025 ≈ RM104,554 (derived)', Math.abs(r.lpMy.value - 104554) < 1 && r.lpMy.provenance === 'derived_from_official', r.lpMy.value);
  ok('fixture: manufacturing LP 2025 ≈ RM140,720', Math.abs(r.lpMfg.value - 140720) < 1, r.lpMfg.value);
  ok('fixture: LP growth 2025 ≈ +3.96%', Math.abs(r.g25.value - 3.96) < 0.01, r.g25.value);
  ok('fixture: manufacturing relative index ≈ 134.6', Math.abs(r.rel.value - 134.6) < 0.05, r.rel.value);
  ok('fixture: +10% LP, L fixed ≈ RM173.70 billion (scenario)', Math.abs(r.sim.value / 1000 - 173.70) < 0.01 && r.sim.provenance === 'scenario', r.sim.value);
  ok('published state LP labelled published_official', r.lpSel.provenance === 'published_official' && r.lpSel.value > 0);
  ok('HHI labelled proxy', r.hhi.provenance === 'proxy');
  ok('MSME LP (S2/S4/S5 missing) = unavailable with missing inputs', r.msme.status === 'unavailable' && r.msme.missing.length > 0);
  ok('MSME gap / capital intensity / P90-P10 unavailable, not guessed', [r.gap, r.cap, r.p90].every(x => x.status === 'unavailable' && x.value == null));
  ok('shift-share components add up exactly', r.sh.identityHolds === true);
  ok('GDP growth identity holds exactly', r.id11.identityHolds === true);
  ok('same metric/context gives identical result + hash', r.again.value === r.lpMy.value && r.again.auditHash === r.lpMy.auditHash);
  console.log('INFO runnable metrics:', r.run, 'of 109');
  // Lab UI
  await p.goto(B + '/#makmal'); await p.waitForTimeout(1200);
  await p.fill('input[data-k3f="q"]', 'CAGR'); await p.waitForTimeout(500);
  ok('BM search finds CAGR', (await p.$$eval('.lab-t tbody tr', l => l.map(t => t.cells[0].textContent))).includes('4'));
  await p.click('#lang-en'); await p.waitForTimeout(700); await p.goto(B + '/#makmal'); await p.waitForTimeout(800); await p.fill('input[data-k3f="q"]', 'employment share'); await p.waitForTimeout(500);
  ok('EN search finds sector employment share', (await p.$$eval('.lab-t tbody tr', l => l.map(t => t.cells[0].textContent))).includes('37'));
  const enText = await p.evaluate(() => document.querySelector('#pg-labx').innerText);
  ok('EN Lab shows no BM labels', !/Cari pengiraan|Kategori|Boleh dikira/.test(enText));
  await p.click('#lang-bm'); await p.waitForTimeout(700); await p.goto(B + '/#makmal'); await p.waitForTimeout(800); await p.fill('input[data-k3f="q"]', ''); await p.waitForTimeout(600); await p.selectOption('select[data-k3f="g"]', '1'); await p.waitForTimeout(400);
  await p.click('button[data-k3open="2"]'); await p.waitForTimeout(800);
  ok('detail shows formula, inputs and source', await p.$eval('#lab-d', e => /VA benar_s/.test(e.innerText) && /productivity_annual/.test(e.innerText)));
  await p.selectOption('#lab-d select[data-k3c="sec"]', 'p3'); await p.waitForTimeout(500);
  const labDisp = await p.$eval('#lab-d .lab-res b', e => e.textContent); ok('Lab manufacturing LP shown', labDisp === 'RM140,720', labDisp);
  await p.screenshot({ path: 'lab-detail.png' });
  await p.click('#lab-d [data-k3add]'); await p.waitForTimeout(1200);
  ok('Add to report opens Studio', (await p.evaluate(() => location.hash)) === '#bina-laporan');
  ok('Studio shows sticky generate button', await p.isVisible('.k2-cfg-foot [data-k2act="gen"]'));
  await p.click('.k2-cfg-foot [data-k2act="gen"]'); await p.waitForTimeout(2500);
  const prev = await p.evaluate(() => document.querySelector('#pg-build .pv-body').innerText);
  ok('report shows the same Lab value', prev.includes('RM140,720'));
  const ev = await p.evaluate(() => { const b = K2 && null; return null; });
  for (const k of ['docx', 'pdf', 'xlsx']) { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 120000 }), p.click(`#pg-build [data-k2dl="${k}"]`)]); await d.saveAs('lab.' + k); console.log('INFO download', d.suggestedFilename()); await p.waitForTimeout(600); }
  // recipe
  await p.selectOption('#pg-build select[data-k2="recipe"]', 'msme'); await p.waitForTimeout(300); await p.click('.k2-cfg-foot [data-k2act="gen"]'); await p.waitForTimeout(2000);
  const rp = await p.evaluate(() => document.querySelector('#pg-build .pv-body').innerText);
  ok('MSME recipe explains exclusions (no data)', /PMKS/.test(rp) && /tidak dimasukkan/.test(rp));
  // library
  await p.click('#pg-build [data-k2act="save"]'); await p.waitForTimeout(800); console.log('INFO save msg:', await p.$eval('#pg-build .k2-msg', e => e.textContent).catch(() => 'none'), await p.evaluate(() => (localStorage.getItem('sppe-k2-templates') || '').length)); await p.goto(B + '/#tersimpan'); await p.waitForTimeout(1000);
  ok('My Library card saved', (await p.$$('.lib-c')).length >= 1);
  await p.screenshot({ path: 'library.png' });
  await p.click('.lib-c [data-k2t="snap"]'); await p.waitForTimeout(1500); ok('Open copy shows frozen report', (await p.evaluate(() => location.hash)) === '#bina-laporan' && await p.isVisible('#pg-build .pv-body'));
  // state strategic outlook guide, menu names, labour page
  await p.goto(B + '/#laporan-negeri'); await p.waitForTimeout(1200); ok('Tinjauan guide shown', await p.isVisible('.k2-guide')); await p.screenshot({ path: 'tinjauan.png' });
  await p.hover('#nav a[data-mega]'); await p.waitForTimeout(350);
  const mm = await p.evaluate(() => [[...document.querySelectorAll('#mega .mm-gl')].map(x => x.textContent).join('|'), [...document.querySelectorAll('#mega .mm-col:last-child .mm-a span')].map(x => x.textContent).join('|')]);
  ok('menu group names', mm[0] === 'ANALITIK & PERMODELAN|WAWASAN & PENERBITAN', mm[0]); ok('menu report items renamed', mm[1] === 'Studio Analitik|Koleksi Wawasan|Tinjauan Strategik Negeri|Pustaka Saya', mm[1]);
  await p.screenshot({ path: 'mega.png', clip: { x: 0, y: 0, width: 1440, height: 520 } });
  await p.goto(B + '/#labour'); await p.waitForTimeout(1200); ok('Pasaran Buruh page renders', await p.evaluate(() => document.querySelector('#pg-lab').innerText.length > 500));
  console.log('errors', errs); await br.close();
})();
