// Radar Data API for SPPE Intelligence (Cloudflare Pages Function, behind the Microsoft login middleware).
//
// GET /api/radar            one JSON payload for the Radar Data page and the notification bell
// GET /api/radar?refresh=1  bypass the 5-minute cache (administrators only)
//
// Everything comes from real records; nothing is invented:
//   - DOSM Advance Release Calendar     https://storage.dosm.gov.my/meta/arc.csv
//   - monitoring log (GitHub Actions)   radar/log.json on the `radar-log` branch (scripts/radar_record.py)
//   - GitHub issues, pull requests, workflow runs and the Cloudflare Pages check of merged commits
//   - the site's own data manifest      /data/data-manifest.json ("data as of")
//   - live HEAD of each OpenDOSM CSV    Last-Modified, to flag files changed since the last check
//
// Optional settings (Cloudflare Pages → Settings → Variables and Secrets):
//   RADAR_ADMINS   comma-separated e-mail addresses that may see approval / repository controls
//   GITHUB_TOKEN   read-only token to lift the GitHub API rate limit (public repo works without it)
//   RADAR_REPO     owner/repo (default zamilisaac/sppe-intelligence)

const ARC_URL = 'https://storage.dosm.gov.my/meta/arc.csv';
const OPENDOSM = 'https://storage.dosm.gov.my';
const TTL = 300;
const DATASETS = {
  gdp_state_real_supply: ['gdp', 'gdp'], productivity_annual: ['labour', 'prod'], lfs_state_sex: ['labour', 'lab'],
  wages_state: ['labour', 'wage'], wages_sector: ['labour', 'wage'], wages_industry: ['labour', 'wage'], wages_skill: ['labour', 'wage'], wages_education: ['labour', 'wage'],
  formal_wages_state: ['labour', 'wage'], formal_wages_msic: ['labour', 'wage'], formal_wages_band: ['labour', 'wage'],
  cpi_2d_state: ['cpi', 'cpi'], cpi_2d_state_inflation: ['cpi', 'cpi'], hies_state: ['hies', 'hies'], hies_state_percentile: ['hies', 'hies'],
};
// ARC publication types that feed the site, per dataset group
const ARC_GROUP = { gdp: ['gdp', 'socioecon_state'], prod: ['productivity'], lab: ['lfs', 'employment', 'jobs', 'lmr'], wage: ['wages', 'formal_wages'], cpi: ['cpi'], hies: ['poverty', 'hh_lq', 'mywi'] };
const SPPE_TYPES = new Set(Object.values(ARC_GROUP).flat().concat(['hdi', 'review_annual', 'review_quarterly']));

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const user = (context.data && context.data.user) || null;
  const admins = String(env.RADAR_ADMINS || '').toLowerCase().split(/[\s,;]+/).filter(Boolean);
  const admin = !!(user && user.email && admins.includes(String(user.email).toLowerCase()));
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request(url.origin + '/__radar-cache/v1');
  let payload = null;
  if (cache && !(admin && url.searchParams.get('refresh'))) {
    const hit = await cache.match(key);
    if (hit) payload = await hit.json();
  }
  if (!payload) {
    payload = await build(context);
    if (cache) context.waitUntil(cache.put(key, new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=' + TTL } })));
  }
  payload.viewer = { admin, configuredAdmins: admins.length > 0 };
  return new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' } });
}

export async function build(context) {
  const { request, env } = context;
  const repo = env.RADAR_REPO || 'zamilisaac/sppe-intelligence';
  const now = new Date();
  const sources = {};
  const safe = async (name, fn) => { try { const v = await fn(); sources[name] = { ok: true }; return v; } catch (e) { sources[name] = { ok: false, error: String(e && e.message || e).slice(0, 200) }; return null; } };
  const gh = path => ghFetch(repo, path, env.GITHUB_TOKEN);
  const [arcText, log, manifest, issues, pulls, runs] = await Promise.all([
    safe('arc', () => text(ARC_URL)),
    safe('log', async () => { const r = await fetch(`https://raw.githubusercontent.com/${repo}/radar-log/radar/log.json`, { cf: { cacheTtl: 60 } }); if (r.status === 404) return null; if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }),
    safe('manifest', async () => { const u = new URL('/data/data-manifest.json', request.url); const r = env.ASSETS ? await env.ASSETS.fetch(u) : await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }),
    safe('issues', () => gh('/issues?labels=dosm-update&state=all&per_page=20')),
    safe('pulls', () => gh('/pulls?state=all&per_page=30&sort=created&direction=desc')),
    safe('runs', () => gh('/actions/runs?per_page=20')),
  ]);
  if (log === null && sources.log.ok) sources.log = { ok: true, empty: true };
  // live: Last-Modified of each OpenDOSM CSV
  const live = await safe('live', async () => {
    const out = {};
    await Promise.all(Object.entries(DATASETS).map(async ([name, [dir]]) => {
      try { const r = await fetch(`${OPENDOSM}/${dir}/${name}.csv`, { method: 'HEAD' }); out[name] = { status: r.status, lastModified: r.headers.get('last-modified'), etag: r.headers.get('etag') }; } catch (e) { out[name] = { error: String(e.message || e) }; }
    }));
    return out;
  });

  // ---- release calendar ----
  const arc = (arcText ? parseCsv(arcText) : []).map(r => {
    const date = (r.release_date || '').replace(' ', 'T') + '+08:00';
    const released = new Date(date) <= now;
    return { id: r.publication_id, date: r.release_date, released, type: r.publication_type, type_bm: r.publication_type_bm, type_en: r.publication_type_en,
      title_bm: r.title_bm, title_en: r.title_en, period_bm: r.release_series_bm, period_en: r.release_series_en, freq: r.frequency, sppe: SPPE_TYPES.has(r.publication_type),
      url_bm: released ? `https://open.dosm.gov.my/ms-MY/publications/${r.publication_id}` : 'https://open.dosm.gov.my/ms-MY/publications/upcoming',
      url_en: released ? `https://open.dosm.gov.my/en-GB/publications/${r.publication_id}` : 'https://open.dosm.gov.my/en-GB/publications/upcoming' };
  }).sort((a, b) => a.date < b.date ? -1 : 1);
  // next year's releases: the DOSM portal publishes them (iCal) before arc.csv carries them
  const nextYear = new Date(now.getTime() + 8 * 3600e3).getUTCFullYear() + 1;
  let portalNext = [];
  if (!arc.some(a => a.date.startsWith(String(nextYear)))) {
    portalNext = await safe('arcNext', async () => parseIcs(await text(`https://www.dosm.gov.my/site/downloadarc?search_year=${nextYear}&search_month=All&action=download`))) || [];
    portalNext.forEach(e => arc.push({ id: 'portal-' + e.uid, date: e.date, released: new Date(e.date.replace(' ', 'T') + '+08:00') <= now, type: 'portal', type_bm: 'Kalendar DOSM', type_en: 'DOSM calendar',
      title_bm: e.title, title_en: e.title, period_bm: '', period_en: '', freq: '', sppe: SPPE_RE.test(e.title), url_bm: 'https://www.dosm.gov.my/portal-main/arc?search_year=' + nextYear, url_en: 'https://www.dosm.gov.my/portal-main/arc?search_year=' + nextYear, portal: true }));
    arc.sort((a, b) => a.date < b.date ? -1 : 1);
  }
  const calendarYears = { [nextYear]: arc.some(a => a.date.startsWith(String(nextYear))) };

  // ---- dataset freshness ----
  const asOf = (manifest && manifest.asOf) || {}, logDs = (log && log.datasets) || {};
  const datasets = Object.entries(DATASETS).map(([name, [, group]]) => {
    const L = logDs[name] || {}, lv = (live || {})[name] || {};
    const changedSinceCheck = !!(lv.lastModified && L.checkedAt && new Date(lv.lastModified) > new Date(L.checkedAt));
    let status = L.status || (log ? 'current' : 'unchecked');
    if (status === 'current' && changedSinceCheck) status = 'changed';
    const next = arc.find(a => !a.released && (ARC_GROUP[group] || []).includes(a.type));
    return { name, group, used: asOf[name] || L.used || null, dosm: L.dosm || null, status, checkedAt: L.checkedAt || null, updatedAt: L.updatedAt || null,
      lastModified: lv.lastModified || null, simulated: !!L.simulated, next: next ? { date: next.date, title_bm: next.title_bm, title_en: next.title_en } : null };
  });
  datasets.push({ name: 'state_productivity_workbook', group: 'prod', used: asOf.state_productivity_workbook || null, dosm: null, status: 'manual', manual: true,
    next: (() => { const n = arc.find(a => !a.released && a.id.startsWith('productivity_state')); return n ? { date: n.date, title_bm: n.title_bm, title_en: n.title_en } : null; })() });

  // ---- GitHub pipeline ----
  const prs = (pulls || []).filter(p => (p.head && p.head.ref || '').startsWith('dosm-update/')).map(p => ({ number: p.number, title: p.title, url: p.html_url, state: p.state,
    merged: !!p.merged_at, mergedAt: p.merged_at, createdAt: p.created_at, closedAt: p.closed_at, branch: p.head.ref, base: p.base && p.base.ref, sha: p.merge_commit_sha,
    test: /\[TEST/i.test(p.title) || /simulated/.test(p.head.ref), draft: !!p.draft }));
  const latest = prs.find(p => !p.test) || null;   // controlled test runs ([TEST] / *-simulated) are never shown as the update status
  let cf = null;
  if (latest && latest.merged && latest.sha) cf = await safe('cloudflare', () => cloudflareState(gh, latest.sha));
  const runList = (runs && runs.workflow_runs || []).filter(r => /DOSM/i.test(r.name)).map(r => ({ id: r.id, name: r.name, event: r.event, status: r.status, conclusion: r.conclusion,
    branch: r.head_branch, at: r.created_at, url: r.html_url }));
  const evs = (log && log.events) || [];
  const evFor = (types, after) => evs.filter(e => types.includes(e.type) && (!after || e.at >= after)).slice(-1)[0] || null;
  const since = latest ? new Date(new Date(latest.createdAt).getTime() - 3 * 3600e3).toISOString() : null;
  const steps = latest ? (() => {
    const det = evFor(['detected'], since), val = evFor(['validated'], since), dep = evFor(['deployed', 'error'], latest.mergedAt || '9');
    const s = [
      { k: 'detected', state: 'done', at: det ? det.at : latest.createdAt, url: det && det.run },
      { k: 'download', state: 'done', at: val ? val.at : latest.createdAt, url: val && val.run },
      { k: 'validated', state: val ? (val.status === 'FAIL' ? 'error' : 'done') : 'done', at: val ? val.at : latest.createdAt, detail: val ? val.status : 'PASS/WARN (PR dibuka)' },
      { k: 'pr', state: 'done', at: latest.createdAt, url: latest.url },
      { k: 'approval', state: latest.merged ? 'done' : latest.state === 'open' ? 'current' : 'closed', at: latest.mergedAt || latest.closedAt, url: latest.url },
      { k: 'merged', state: latest.merged ? 'done' : latest.state === 'open' ? 'pending' : 'closed', at: latest.mergedAt, url: latest.url },
      { k: 'deployed', state: !latest.merged ? (latest.state === 'open' ? 'pending' : 'closed') : cf && cf.state === 'success' ? 'done' : cf && cf.state === 'failure' ? 'error' : dep && dep.type === 'deployed' ? 'done' : 'current',
        at: dep ? dep.at : null, url: (cf && cf.url) || (dep && dep.url), detail: cf ? cf.detail : null },
    ];
    return s;
  })() : null;

  // ---- notifications (newest first) ----
  const notes = [];
  evs.filter(e => !e.simulated && (e.type !== 'check' || e.level === 'error')).forEach(e => notes.push({ id: 'log-' + e.id, at: e.at, kind: e.type, level: e.level, bm: e.bm, en: e.en, url: e.url || e.run || null, src: 'log', test: !!e.simulated }));
  const seenUrl = new Set(notes.map(n => n.url).filter(Boolean));
  prs.filter(p => !p.test).forEach(p => {
    if (!seenUrl.has(p.url)) notes.push({ id: 'pr-' + p.number, at: p.createdAt, kind: 'pr', level: p.test ? 'test' : 'pending', bm: `${p.test ? '[UJIAN] ' : ''}Pull Request #${p.number} dijana: ${p.title}`, en: `${p.test ? '[TEST] ' : ''}Pull request #${p.number} opened: ${p.title}`, url: p.url, src: 'github', test: p.test });
    if (p.merged) notes.push({ id: 'pm-' + p.number, at: p.mergedAt, kind: 'merged', level: p.test ? 'test' : 'ok', bm: `${p.test ? '[UJIAN] ' : ''}Pull Request #${p.number} telah digabungkan (${p.base}).`, en: `${p.test ? '[TEST] ' : ''}Pull request #${p.number} merged (${p.base}).`, url: p.url, src: 'github', test: p.test });
    else if (p.state === 'closed') notes.push({ id: 'pc-' + p.number, at: p.closedAt, kind: 'closed', level: 'info', bm: `${p.test ? '[UJIAN] ' : ''}Pull Request #${p.number} ditutup tanpa digabungkan.`, en: `${p.test ? '[TEST] ' : ''}Pull request #${p.number} closed without merging.`, url: p.url, src: 'github', test: p.test });
  });
  (issues || []).filter(i => !i.pull_request && !/\[TEST/i.test(i.title)).forEach(i => { const t = false; notes.push({ id: 'is-' + i.number, at: i.created_at, kind: 'detected', level: t ? 'test' : i.state === 'open' ? 'new' : 'info', bm: `${t ? '[UJIAN] ' : ''}Data DOSM baharu dikesan (isu #${i.number}${i.state === 'closed' ? ', ditutup' : ''}).`, en: `${t ? '[TEST] ' : ''}New DOSM data detected (issue #${i.number}${i.state === 'closed' ? ', closed' : ''}).`, url: i.html_url, src: 'github', test: t }); });
  runList.filter(r => r.conclusion === 'failure' && r.branch === 'main').forEach(r => notes.push({ id: 'run-' + r.id, at: r.at, kind: 'error', level: 'error', bm: `Aliran kerja "${r.name}" gagal (${r.branch}).`, en: `Workflow "${r.name}" failed (${r.branch}).`, url: r.url, src: 'github' }));
  const today = now.toISOString().slice(0, 10), in7 = new Date(now.getTime() + 7 * 864e5).toISOString().slice(0, 10), ago7 = new Date(now.getTime() - 7 * 864e5).toISOString().slice(0, 10);
  arc.filter(a => a.sppe && a.date.slice(0, 10) >= ago7 && a.date.slice(0, 10) <= in7).forEach(a => notes.push({ id: 'arc-' + a.id, at: a.released ? a.date.replace(' ', 'T') + '+08:00' : now.toISOString(), kind: a.released ? 'released' : 'upcoming', level: a.released ? 'new' : 'info',
    bm: a.released ? `${a.title_bm} telah diterbitkan oleh DOSM.` : `Keluaran DOSM akan datang: ${a.title_bm} pada ${a.date.slice(0, 10)}.`, en: a.released ? `${a.title_en} has been published by DOSM.` : `Upcoming DOSM release: ${a.title_en} on ${a.date.slice(0, 10)}.`, url: a.url_bm, url_en: a.url_en, src: 'arc' }));
  notes.sort((a, b) => (b.at || '') < (a.at || '') ? -1 : 1);

  const upcoming = arc.filter(a => !a.released);
  const kpi = {
    upcoming: upcoming.length, upcomingSppe: upcoming.filter(a => a.sppe).length,
    detected: datasets.filter(d => ['new', 'changed', 'pending'].includes(d.status)).length,
    pending: prs.filter(p => p.state === 'open' && !p.test).length + datasets.filter(d => d.status === 'new').length,
    updated: datasets.filter(d => d.status === 'updated').length + ((manifest && manifest.deployments) || []).filter(d => d.cloudflare === 'success' && d.ref === 'main').length,
  };
  return { generatedAt: now.toISOString(), repo, sources, kpi, arc, calendarYears, nextYear, datasets, prs, latest, steps, runs: runList, notes: notes.slice(0, 120),
    lastCheck: (log && log.lastCheck) || null, watch: (log && log.watch) || [], manifest: manifest ? { asOf: manifest.asOf, deployments: (manifest.deployments || []).slice(-10), warnings: manifest.warnings || [] } : null };
}

async function text(u) { const r = await fetch(u, { cf: { cacheTtl: 3600 } }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }
async function ghFetch(repo, path, token) {
  const h = { Accept: 'application/vnd.github+json', 'User-Agent': 'sppe-intelligence-radar', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(`https://api.github.com/repos/${repo}${path}`, { headers: h });
  if (!r.ok) throw new Error('GitHub ' + r.status + (r.status === 403 ? ' (had kadar; tetapkan GITHUB_TOKEN)' : ''));
  return r.json();
}
async function cloudflareState(gh, sha) {
  const cr = ((await gh(`/commits/${sha}/check-runs?per_page=50`)) || {}).check_runs || [];
  const c = cr.find(r => /cloudflare/i.test(((r.app || {}).slug || '') + ' ' + r.name));
  if (c) return c.status !== 'completed' ? { state: 'pending', detail: `${c.name}: ${c.status}`, url: c.details_url || c.html_url } : { state: ['success', 'neutral', 'skipped'].includes(c.conclusion) ? 'success' : 'failure', detail: `${c.name}: ${c.conclusion}`, url: c.details_url || c.html_url };
  const st = ((await gh(`/commits/${sha}/status`)) || {}).statuses || [];
  const s = st.find(x => /cloudflare/i.test(x.context || ''));
  if (s) return { state: s.state === 'success' ? 'success' : ['failure', 'error'].includes(s.state) ? 'failure' : 'pending', detail: `${s.context}: ${s.state}`, url: s.target_url };
  return { state: 'none', detail: 'Tiada semakan Cloudflare pada commit ini', url: null };
}
const SPPE_RE = /gross domestic product|gdp|productivity|labour force|labour market|employment|wages|salaries|consumer price|household income|poverty|socioeconomic|jobs/i;
function parseIcs(t) {
  return t.split('BEGIN:VEVENT').slice(1).map(b => {
    const g = k => { const m = b.match(new RegExp('^' + k + '[^:]*:(.*)$', 'm')); return m ? m[1].trim() : ''; };
    const d = g('DTSTART').match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
    return d ? { uid: g('UID').slice(0, 16), date: `${d[1]}-${d[2]}-${d[3]} ${d[4] || '12'}:${d[5] || '00'}:00`, title: g('SUMMARY').replace(/\\,/g, ',') } : null;
  }).filter(e => e && e.title);
}
function parseCsv(t) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  const head = rows.shift() || [];
  return rows.filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
