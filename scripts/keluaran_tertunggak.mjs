// Which DOSM releases relevant to SPPE Intelligence have come out but are not yet on the site?
// Used by the "Pengurus Data DOSM" agent as its first, cheap step: if the list is empty the agent stops at once.
// It reuses the Radar Data logic (functions/api/radar.js): the DOSM release calendar, OpenDOSM file dates,
// the radar-log check records and the site's data manifest. Needs network access (DOSM, OpenDOSM, GitHub).
//
//   NODE_USE_ENV_PROXY=1 node scripts/keluaran_tertunggak.mjs [--days 21] [--now 2026-11-24T08:00:00Z]
//
// Prints JSON: { now, items: [ { id, title, date, type, group, state, datasets: [...] } ] }
// state:
//   menunggu_opendosm  released by DOSM, but none of the site's OpenDOSM files for it changed since the release
//   dikesan            an OpenDOSM file changed and the site has not taken it yet (pipeline should run / PR pending)
//   pr_terbuka         a data pull request is open, waiting for the approver
//   tidak_digunakan    the release has no dataset the site reads (nothing to do; listed so the agent can close it)
//   tidak_mengubah     the site reads this topic, but at another frequency (e.g. a quarterly release while the
//                      site uses the annual state series), so this release cannot change the site
// Releases whose files are all current on the site are left out (they are done).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DAYS = +arg('--days', 21), NOW = new Date(arg('--now', new Date().toISOString()));
const { build } = await import(path.join(REPO, 'functions/api/radar.js'));
const ROOT = path.join(REPO, 'website');
const env = { ASSETS: { fetch: async u => new Response(fs.readFileSync(path.join(ROOT, new URL(u).pathname))) } };
if (process.env.GITHUB_TOKEN) env.GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const res = await build({ request: new Request('http://localhost/api/radar'), env, data: {} });
const d = res instanceof Response ? await res.json() : res;

// Same group mapping as the Radar page: which publication types feed which datasets
const ARC_GROUP = { gdp: ['gdp', 'socioecon_state'], prod: ['productivity'], lab: ['lfs', 'employment', 'jobs', 'lmr'], wage: ['wages', 'formal_wages'], cpi: ['cpi'], hies: ['poverty', 'hh_lq', 'mywi'] };
// Frequency of each OpenDOSM file the site reads. A release only updates a file of the same frequency.
const FREQ = { gdp_state_real_supply: 'YEARLY', productivity_annual: 'YEARLY', productivity_qtr: 'QUARTERLY', productivity_state: 'YEARLY', productivity_annual_p14: 'YEARLY',
  lfs_qtr_state: 'QUARTERLY', lfs_month: 'MONTHLY', lfs_state_sex: 'YEARLY',
  wages_state: 'YEARLY', wages_sector: 'YEARLY', wages_industry: 'YEARLY', wages_skill: 'YEARLY', wages_education: 'YEARLY',
  formal_wages_state: 'QUARTERLY', formal_wages_msic: 'QUARTERLY', formal_wages_band: 'QUARTERLY',
  cpi_2d_state: 'MONTHLY', cpi_2d_state_inflation: 'MONTHLY', hies_state: 'YEARLY', hies_state_percentile: 'YEARLY' };
const groupOf = t => Object.keys(ARC_GROUP).find(g => ARC_GROUP[g].includes(t)) || null;
const since = new Date(NOW.getTime() - DAYS * 864e5);
const openData = (d.prs || []).filter(p => p.state === 'open' && !p.test && /dosm|data/i.test((p.branch || '') + ' ' + (p.title || '')));

const items = [];
for (const a of d.arc || []) {
  if (!a.sppe || a.portal) continue;
  const at = new Date(a.date.replace(' ', 'T') + '+08:00');
  if (!(at <= NOW && at >= since)) continue;
  const group = groupOf(a.type);
  const inGroup = (d.datasets || []).filter(x => !x.manual && x.group === group);
  const ds = inGroup.filter(x => !a.freq || !FREQ[x.name] || FREQ[x.name] === a.freq);
  const base = { id: a.id, title: a.title_bm, date: a.date, type: a.type, freq: a.freq, group, url: a.url_bm };
  if (!inGroup.length) { items.push({ ...base, state: 'tidak_digunakan', datasets: [] }); continue; }
  if (!ds.length) { items.push({ ...base, state: 'tidak_mengubah', datasets: inGroup.map(x => ({ name: x.name, freq: FREQ[x.name] })) }); continue; }
  const view = ds.map(x => ({ name: x.name, status: x.status, used: x.used, opendosm_last_modified: x.lastModified,
    updated_after_release: !!(x.lastModified && new Date(x.lastModified) >= at) }));
  const fresh = view.filter(v => v.updated_after_release);
  if (!fresh.length) { items.push({ ...base, state: 'menunggu_opendosm', datasets: view }); continue; }
  const waiting = fresh.filter(v => ['new', 'changed', 'pending'].includes(v.status));
  if (!waiting.length) continue; // every changed file is already on the site: done
  items.push({ ...base, state: openData.length ? 'pr_terbuka' : 'dikesan', datasets: view, prs: openData.map(p => ({ number: p.number, title: p.title, url: p.url })) });
}
const ACT = ['menunggu_opendosm', 'dikesan', 'pr_terbuka'];
const kerja = items.filter(i => ACT.includes(i.state)).length;
const sumberGagal = Object.entries(d.sources || {}).filter(([, v]) => v && v.ok === false).map(([k]) => k);
console.log(JSON.stringify({ now: NOW.toISOString(), days: DAYS, kerja, sumber_gagal: sumberGagal, items }, null, 2));
