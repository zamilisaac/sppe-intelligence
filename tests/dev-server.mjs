// Local test server: serves website/ and answers /api/radar with the real functions/api/radar.js
// (live DOSM calendar, OpenDOSM files and GitHub records, so it needs network access).
// Run: NODE_USE_ENV_PROXY=1 node tests/dev-server.mjs 8822     (RADAR_ADMIN=1 simulates an admin viewer)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { build } = await import(path.join(REPO, 'functions/api/radar.js'));
const ROOT = path.join(REPO, 'website'), PORT = +process.argv[2] || 8822;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.pdf': 'application/pdf', '.svg': 'image/svg+xml' };
let cache = null;
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/radar') {
    try {
      if (!cache || u.searchParams.get('refresh') || Date.now() - cache.t > 3e5) cache = { t: Date.now(), d: await build({ request: new Request('http://localhost' + req.url), env: { ASSETS: { fetch: async x => new Response(fs.readFileSync(path.join(ROOT, new URL(x).pathname))) } }, data: {} }) };
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ...cache.d, viewer: { admin: process.env.RADAR_ADMIN === '1', configuredAdmins: true } }));
    } catch (e) { res.writeHead(500); res.end(String(e)); }
    return;
  }
  let f = path.join(ROOT, decodeURIComponent(u.pathname)); if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) f = path.join(ROOT, 'index.html');
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log('dev server on', PORT));
