// SPPE Intelligence — Microsoft (MPC Outlook) login for Cloudflare Pages.
//
// Runs before every request. Anyone without a valid login cookie sees the
// login page. Sign-in happens on Microsoft's own page (the site never sees
// passwords). Only accounts in MPC's Microsoft directory are accepted.
//
// Settings (Cloudflare Pages → Settings → Variables and Secrets):
//   AZURE_CLIENT_ID      Application (client) ID of the app registration
//   AZURE_CLIENT_SECRET  Client secret value of the app registration
//   SESSION_SECRET       Any long random string (signs the login cookie)
//   AZURE_TENANT_ID      Optional. Defaults to MPC's directory (mpc.gov.my)
//   SESSION_HOURS        Optional. How long a login lasts. Default 8

const MPC_TENANT_ID = "704bb254-aa81-4863-9455-39c9fbc01cac"; // mpc.gov.my (public)
const SESSION_COOKIE = "sppe_session";
const FLOW_COOKIE = "sppe_login";
const PUBLIC_PATHS = new Set(["/assets/mpc-logo.png", "/favicon.ico"]);

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const cfg = config(env);

  if (PUBLIC_PATHS.has(url.pathname)) return next();

  if (!cfg.ok) {
    return page(setupPage(cfg.missing), 503);
  }

  switch (url.pathname) {
    case "/auth/login":
      return startLogin(url, cfg);
    case "/auth/callback":
      return finishLogin(request, url, cfg);
    case "/auth/logout":
      return page(loggedOutPage(), 200, { "Set-Cookie": clearCookie(SESSION_COOKIE) });
  }

  const user = await readSigned(getCookie(request, SESSION_COOKIE), cfg.sessionSecret);
  if (!user) {
    const wantsHtml = (request.headers.get("Accept") || "").includes("text/html");
    if (request.method === "GET" && wantsHtml) {
      return page(loginPage(url.pathname + url.search), 401);
    }
    return new Response("Login required", { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const res = await next();
  const type = res.headers.get("Content-Type") || "";
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", "private, no-store");
  const out = new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  if (!type.includes("text/html")) return out;
  return new HTMLRewriter()
    .on("body", { element: (el) => el.append(userBadge(user), { html: true }) })
    .transform(out);
}

// ---------- login flow (OpenID Connect, authorization code + PKCE) ----------

async function startLogin(url, cfg) {
  const state = randomString(24);
  const nonce = randomString(24);
  const verifier = randomString(48);
  const challenge = b64url(await crypto.subtle.digest("SHA-256", enc(verifier)));
  const returnTo = safeReturn(url.searchParams.get("r"));

  const flow = await sign({ s: state, n: nonce, v: verifier, r: returnTo, exp: now() + 600 }, cfg.sessionSecret);

  const auth = new URL(cfg.authority + "/oauth2/v2.0/authorize");
  auth.search = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    response_mode: "query",
    redirect_uri: url.origin + "/auth/callback",
    scope: "openid profile email",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  return new Response(null, {
    status: 302,
    headers: {
      Location: auth.toString(),
      "Set-Cookie": cookie(FLOW_COOKIE, flow, 600, "/auth"),
      "Cache-Control": "no-store",
    },
  });
}

async function finishLogin(request, url, cfg) {
  const fail = (msg) =>
    page(errorPage(msg), 400, { "Set-Cookie": clearCookie(FLOW_COOKIE, "/auth") });

  const flow = await readSigned(getCookie(request, FLOW_COOKIE), cfg.sessionSecret);
  if (!flow) return fail("Your login attempt expired. Please try again.");

  const p = url.searchParams;
  if (p.get("error")) return fail(p.get("error_description") || p.get("error"));
  if (!p.get("code") || p.get("state") !== flow.s) return fail("The login response was not valid. Please try again.");

  const tokenRes = await fetch(cfg.authority + "/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: "authorization_code",
      code: p.get("code"),
      redirect_uri: url.origin + "/auth/callback",
      code_verifier: flow.v,
    }),
  });
  const tokens = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokens.id_token) {
    return fail(tokens.error_description || "Microsoft did not complete the login.");
  }

  // The token came straight from Microsoft over HTTPS using the client secret,
  // so its contents can be trusted; we still check every claim that matters.
  const claims = decodeJwt(tokens.id_token);
  if (!claims) return fail("The login response could not be read.");
  if (claims.aud !== cfg.clientId) return fail("The login was issued for a different app.");
  if (claims.tid !== cfg.tenantId || claims.iss !== cfg.authority) {
    return fail("Only Malaysia Productivity Corporation (MPC) accounts can sign in.");
  }
  if (claims.nonce !== flow.n) return fail("The login response was not valid. Please try again.");
  if (!claims.exp || claims.exp < now() - 300) return fail("The login response expired. Please try again.");

  const user = {
    name: claims.name || claims.preferred_username || "MPC user",
    email: claims.preferred_username || claims.email || "",
    exp: now() + cfg.sessionHours * 3600,
  };
  const session = await sign(user, cfg.sessionSecret);

  const headers = new Headers({ Location: flow.r, "Cache-Control": "no-store" });
  headers.append("Set-Cookie", cookie(SESSION_COOKIE, session, cfg.sessionHours * 3600, "/"));
  headers.append("Set-Cookie", clearCookie(FLOW_COOKIE, "/auth"));
  return new Response(null, { status: 302, headers });
}

// ---------- helpers ----------

function config(env) {
  const tenantId = env.AZURE_TENANT_ID || MPC_TENANT_ID;
  const cfg = {
    tenantId,
    clientId: env.AZURE_CLIENT_ID,
    clientSecret: env.AZURE_CLIENT_SECRET,
    sessionSecret: env.SESSION_SECRET,
    sessionHours: Number(env.SESSION_HOURS) > 0 ? Number(env.SESSION_HOURS) : 8,
    // AUTH_AUTHORITY is only for local testing against a mock server.
    authority: env.AUTH_AUTHORITY || `https://login.microsoftonline.com/${tenantId}/v2.0`,
  };
  cfg.missing = ["AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET", "SESSION_SECRET"].filter((k) => !env[k]);
  if (env.SESSION_SECRET && env.SESSION_SECRET.length < 32) cfg.missing.push("SESSION_SECRET (at least 32 characters)");
  cfg.ok = cfg.missing.length === 0;
  return cfg;
}

const enc = (s) => new TextEncoder().encode(s);
const now = () => Math.floor(Date.now() / 1000);

function b64url(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

function randomString(n) {
  return b64url(crypto.getRandomValues(new Uint8Array(n)));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", enc(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function sign(obj, secret) {
  const body = b64url(enc(JSON.stringify(obj)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc(body));
  return body + "." + b64url(sig);
}

async function readSigned(value, secret) {
  if (!value || !value.includes(".")) return null;
  const [body, sig] = value.split(".");
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), fromB64url(sig), enc(body));
    if (!ok) return null;
    const obj = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    return obj.exp && obj.exp > now() ? obj : null;
  } catch {
    return null;
  }
}

function decodeJwt(jwt) {
  try {
    return JSON.parse(new TextDecoder().decode(fromB64url(jwt.split(".")[1])));
  } catch {
    return null;
  }
}

function safeReturn(r) {
  return r && r.startsWith("/") && !r.startsWith("//") && !r.startsWith("/auth/") ? r : "/";
}

function getCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

function cookie(name, value, maxAge, path) {
  return `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function clearCookie(name, path = "/") {
  return `${name}=; Path=${path}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// ---------- pages ----------

function page(html, status, extra = {}) {
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}

function shell(title, inner) {
  return `<!doctype html><html lang="ms"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · SPPE Intelligence</title>
<style>
:root{--ink:#1c1917;--muted:#57534e;--line:#e7e5e4;--bg:#f5f5f4;--card:#fff;--red:#b91c1c;--red-d:#991b1b}
@media (prefers-color-scheme:dark){:root{--ink:#f5f5f4;--muted:#a8a29e;--line:#44403c;--bg:#1c1917;--card:#292524;--red:#dc2626;--red-d:#b91c1c}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;
background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
.card{width:100%;max-width:420px;background:var(--card);border:1px solid var(--line);border-top:4px solid var(--red);
border-radius:12px;padding:32px 28px;text-align:center}
.logo{height:56px;margin-bottom:16px}
h1{font-size:22px;margin:0 0 4px}
.tag{color:var(--muted);font-size:14px;margin:0 0 24px}
p{margin:0 0 20px;color:var(--muted)}
.btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:12px 16px;border-radius:8px;
background:var(--red);color:#fff;text-decoration:none;font-weight:600;font-size:15px}
.btn:hover{background:var(--red-d)}
.btn svg{flex:none}
.note{margin:20px 0 0;font-size:13px;color:var(--muted)}
.err{background:rgba(185,28,28,.08);border:1px solid rgba(185,28,28,.3);border-radius:8px;padding:12px;color:var(--ink);text-align:left;font-size:14px}
code{font-size:13px}
</style></head><body><main class="card">
<img class="logo" src="/assets/mpc-logo.png" alt="Perbadanan Produktiviti Malaysia">
<h1>SPPE Intelligence</h1>
<p class="tag">Analitik Ekonomi &amp; Produktiviti Negeri<br>State Economic &amp; Productivity Analytics</p>
${inner}
</main></body></html>`;
}

const MS_ICON = `<svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>`;

function loginButton(returnTo = "/") {
  return `<a class="btn" href="/auth/login?r=${encodeURIComponent(returnTo)}">${MS_ICON}
<span>Log masuk dengan akaun Microsoft MPC<br><small style="font-weight:400">Sign in with your MPC Microsoft account</small></span></a>`;
}

function loginPage(returnTo) {
  return shell("Log masuk", `<p>Untuk kakitangan MPC sahaja.<br>For MPC staff only.</p>
${loginButton(returnTo)}
<p class="note">Gunakan e-mel dan kata laluan Outlook MPC anda.<br>Use your MPC Outlook email and password.</p>`);
}

function loggedOutPage() {
  return shell("Log keluar", `<p><strong style="color:var(--ink)">Anda telah log keluar.</strong><br>You have been logged out.</p>
${loginButton("/")}`);
}

function errorPage(msg) {
  return shell("Ralat log masuk", `<p class="err"><strong>Log masuk tidak berjaya · Login failed</strong><br>${esc(msg)}</p>
${loginButton("/")}`);
}

function setupPage(missing) {
  return shell("Setup needed", `<p class="err"><strong>Login is not set up yet.</strong><br>
Add these in Cloudflare Pages → Settings → Variables and Secrets, then redeploy:<br>
<code>${missing.map(esc).join("</code>, <code>")}</code></p>`);
}

function userBadge(user) {
  return `<div id="sppe-user" style="position:fixed;right:16px;bottom:16px;z-index:2147483647;display:flex;align-items:center;gap:10px;
background:#1c1917;color:#fff;border-radius:999px;padding:6px 6px 6px 14px;font:13px/1.2 system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;
box-shadow:0 2px 10px rgba(0,0,0,.25);max-width:calc(100vw - 32px)">
<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(user.email)}">${esc(user.name)}</span>
<a href="/auth/logout" style="background:#b91c1c;color:#fff;text-decoration:none;border-radius:999px;padding:6px 12px;font-weight:600;white-space:nowrap">Log keluar · Log out</a>
</div>`;
}
