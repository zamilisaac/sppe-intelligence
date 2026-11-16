// Profil Strategik Produktiviti Negeri: calculations, quality checks and PDF rendering for every state.
// Run: python3 -m http.server 8811 -d website   then: node tests/profil.js
const { chromium } = require('playwright'); const B = 'http://127.0.0.1:8811';
const ok = (n, c, x = '') => console.log((c ? 'PASS' : 'FAIL') + ' ' + n + (x !== '' ? '  (' + x + ')' : ''));
(async () => {
  const br = await chromium.launch(); const ctx = await br.newContext({ acceptDownloads: true }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(B + '/#profil-strategik'); await p.waitForTimeout(2000);
  const r = await p.evaluate(() => {
    const j = SP.model('johor'), s = SP.model('selangor'), e = M6E.econ(), gi = e.gdp.years.indexOf(j.gY);
    return {
      lp: j.kpi.lp.v, lpOff: A(S.snap).level('johor', j.Y), gdp: j.kpi.gdp.v, gdpRaw: e.gdp.v.p0.johor[gi], emp: j.kpi.emp.v,
      agg: j.lpAgg, aggCalc: j.vaT * 1000 / j.empT, sumSec: j.sec.reduce((t, r) => t + (r.lp || 0), 0),
      gap: j.kpi.lp.gap, gapCalc: (j.kpi.lp.v / j.kpi.lp.nat - 1) * 100, sim0: j.sim.lpBase.ys[0], Y: j.Y,
      diff: s.kpi.gdp.v !== j.kpi.gdp.v, simUp: j.sim.lpEndI > j.sim.lpEndB, file: SP.fileName(j),
    };
  });
  ok('productivity = official DOSM state series', r.lp === r.lpOff, r.lp);
  ok('GDP comes straight from the dataset', r.gdp === r.gdpRaw, r.gdp);
  ok('aggregate productivity = total VA / total workers (never a sum of sector values)', Math.abs(r.agg - r.aggCalc) < 1e-6 && Math.abs(r.agg - r.sumSec) > 1000, Math.round(r.agg));
  ok('gap to Malaysia uses the same series', Math.abs(r.gap - r.gapCalc) < 1e-9, r.gap.toFixed(2));
  ok('projection starts the year after the last actual year', r.sim0 === r.Y + 1);
  ok('improvement scenario above baseline', r.simUp);
  ok('other states get their own figures', r.diff);
  ok('file name format', /^Profil_Strategik_Produktiviti_Johor_\d{4}\.pdf$/.test(r.file), r.file);
  const all = await p.evaluate(async () => { const out = []; for (const s of STATES) for (const mode of ['umum', 'bengkel']) { const m = SP.model(s.id, { mode }), d = await SP.pdf(m); out.push({ id: s.id, mode, pages: d.getNumberOfPages(), qc: m.qc.every(c => c.ok), lay: d.__layout.length, bad: /NaN|undefined|Infinity/.test(JSON.stringify(m.text)) }); } return out; });
  ok('all 16 states x 2 modes pass quality checks', all.every(x => x.qc), all.filter(x => !x.qc).map(x => x.id + '/' + x.mode).join(','));
  ok('all reports are 9 pages', all.every(x => x.pages === 9), [...new Set(all.map(x => x.pages))].join(','));
  ok('no text outside the printable area', all.every(x => !x.lay), all.filter(x => x.lay).map(x => x.id).join(','));
  ok('no NaN/undefined in the narrative', all.every(x => !x.bad));
  await p.selectOption('#pg-sprof select[data-sp="id"]', 'sabah'); await p.waitForTimeout(500);
  const [d] = await Promise.all([p.waitForEvent('download', { timeout: 120000 }), p.click('#pg-sprof [data-spact="dl"]')]);
  ok('download from the page', /Profil_Strategik_Produktiviti_Sabah_\d{4}\.pdf/.test(d.suggestedFilename()), d.suggestedFilename());
  await p.click('#pg-sprof [data-spact="prev"]'); await p.waitForTimeout(4000); ok('preview shown', await p.isVisible('#pg-sprof .sp-prev iframe'));
  ok('no page errors', !errs.length, errs.join(' | ')); await br.close();
})();
