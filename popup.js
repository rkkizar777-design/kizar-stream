// ============================================================================
//  KIZAR STREAM - MINIMAL & CUTE USER EDITION
// ============================================================================

// Browser Fallback Shim
if (typeof window.chrome === 'undefined' || !window.chrome.storage) {
  window.chrome = {
    storage: {
      local: {
        async get(keys) {
          const store = JSON.parse(localStorage.getItem('kizar_store') || '{}');
          if (typeof keys === 'string') return { [keys]: store[keys] };
          if (Array.isArray(keys)) {
            const res = {};
            keys.forEach(k => res[k] = store[k]);
            return res;
          }
          return store;
        },
        async set(obj) {
          const store = JSON.parse(localStorage.getItem('kizar_store') || '{}');
          Object.assign(store, obj);
          localStorage.setItem('kizar_store', JSON.stringify(store));
        },
        async remove(key) {
          const store = JSON.parse(localStorage.getItem('kizar_store') || '{}');
          delete store[key];
          localStorage.setItem('kizar_store', JSON.stringify(store));
        }
      },
      session: {
        async get() { return {}; },
        async set() {},
        async remove() {}
      }
    },
    tabs: {
      async query() { return []; },
      async create(opts) { window.open(opts.url, '_blank'); return { id: 1 }; },
      async update() {},
      async remove() {}
    },
    cookies: {
      async getAll() { return []; },
      async set() {},
      async remove() {}
    },
    windows: {
      async update() {}
    }
  };
}

const GITHUB_CONFIG = {
  owner: 'rkkizar777-design',
  repo: 'kizar-stream-cookies',
  branch: 'main',
  files: { netflix: 'netflix.txt', prime: 'prime.txt' },
  codes: 'activation.json',
  users: 'users.json',
  banned: 'banned.json',
  dead: 'dead.json',
  requests: 'requests.json',
  settings: 'settings.json',
  messages: 'messages.json',
  cards: 'user-cards.json',
  version: 'version.json',
  token: '==QRKJHW4EzYwkDVoVTaCZVVkpHZNV3MuNXbjl2QxVmWw00a2M2Xvh2Z'
};

const BANNED_KEY = 'kizar_user_banned_v2';
const PENDING_KEY = 'kizar_stream_pending';
const SAVED_KEY = 'kizar_saved_sessions';
const PROFILE_KEY = 'kizar_profile';
const REGISTERED_KEY = 'kizar_registered_at';
const CONSUMED_KEY = 'kizar_consumed_approvals';
const NOTIFY_SEEN_KEY = 'kizar_notify_seen_at';
let INBOX = [];
const PLAN_LIMITS = { inactive: 0, free: 1, active: 3 };
const PLATFORM_KEYS = ['netflix', 'prime'];

const PLATFORMS = {
  netflix: {
    homeUrl: 'https://www.netflix.com/',
    clearDomains: ['.netflix.com'],
    failurePatterns: [
      /\/login\b/i, /\/signup\b/i, /\/registration\b/i, /\/hd\/\w*register/i,
      /\/youraccountexpired\b/i, /\/account.?expired\b/i, /\/leave.?netflix/i,
      /\/membership\b.*\/?(ended|expired|cancelled)/i
    ],
    contentFailures: [
      /sign ?in/i, /sign ?up/i,
      /your account (has )?expired/i, /you.?ve left netflix/i,
      /membership (has )?(been )?(ended|cancelled|suspended)/i,
      /your membership.{0,30}(ended|expired|cancelled|inactive)/i,
      /account (has been )?(closed|suspended|locked)/i,
      /select a plan/i, /start your free month/i
    ]
  },
prime: {
    homeUrl: 'https://www.primevideo.com/',
    clearDomains: ['.primevideo.com', '.amazon.com', 'www.amazon.com', '.amazon.co.uk'],
    failurePatterns: [
      /ap\/signin/i, /\/signin\b/i, /nonprimehomepage/i, /offers\/nonprime/i,
      /dv_web_force_root/i, /amzn\.to\/signin/i,
      /\/expired\b/i, /\/membership\/?(expired|ended|cancelled)/i, /\/yourmembership/i,
      /\/region\/.+\/offers/i, /\/prime\/offers/i, /\/gp\/primecentral/i,
      /\/ap\/register/i, /ap\/cvf/i, /\/gateway/i
    ],
    contentFailures: [
      /not eligible for prime/i,
      /not eligible/i,
      /prime (video )?(subscription|membership).{0,30}(expired|ended|cancelled)/i,
      /your (\w+ )?membership.{0,40}(expired|ended|cancelled)/i,
      /you no longer have amazon prime/i,
      /you no longer (have|have access to) prime/i,
      /your (amazon )?prime (has |has been )?(expired|ended|cancelled|suspended)/i,
      /account (has been )?(locked|closed|suspended)/i,
      /(please )?(upgrade|join|renew) (your )?(amazon )?(prime|membership)/i,
      /join (to )?(watch|see|stream)/i,
      /start your free (30-day |7-day )?trial/i,
      /start your (free )?trial/i,
      /try prime/i,
      /included with prime/i,
      /prime video is not available/i,
      /prime membership required/i,
      /subscription required/i,
      /access denied/i
    ]
  }
};

const SAMPLES = 9;
const SAMPLE_MS = 2000;

const STATE = {
  sessions: { netflix: [], prime: [] },
  banned: { netflix: [], prime: [] },
  streaming: false,
  codes: null,
  codesSha: null,
  codesReady: false,
  bannedByOperator: false,
  swapApproved: { netflix: null, prime: null }
};

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
function toast(text, ms) {
  const node = $('toast-msg');
  if (!node) return;
  const txt = node.querySelector('.toast-text');
  if (txt) txt.textContent = text;
  node.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => node.classList.remove('show'), ms || 2600);
}

function pill(state, text) {
  const el = $('status-pill');
  if (!el) return;
  el.className = 'status-pill';
  if (state) el.classList.add(state);
  const stText = $('status-text');
  if (stText) stText.textContent = text;
}

function countUp(el, target) {
  if (!el) return;
  const from = parseInt(el.textContent, 10) || 0;
  if (from === target) { el.textContent = target; return; }
  const steps = 15;
  const delta = target - from;
  let i = 0;
  const tick = () => {
    i++;
    el.textContent = Math.round(from + delta * (i / steps));
    if (i < steps) requestAnimationFrame(tick);
    else el.textContent = target;
  };
  tick();
}

function showProgress(show, text, pct) {
  const prog = $('stream-progress');
  if (!prog) return;
  prog.classList.toggle('hidden', !show);
  if (text) {
    const t = $('progress-text');
    if (t) t.textContent = text;
  }
  const p = pct || 0;
  const fill = $('progress-fill');
  if (fill) fill.style.width = p + '%';
  const pctEl = $('progress-pct');
  if (pctEl) pctEl.textContent = p > 0 ? p + '%' : '0%';
}

// ---------------------------------------------------------------------------
// GitHub fetch
// ---------------------------------------------------------------------------
function getOwnerToken() {
  try {
    return atob(String(GITHUB_CONFIG.token).split('').reverse().join('')) || '';
  } catch (e) {
    return '';
  }
}

function ghError(res, path) {
  const status = res.status;
  if (status === 401 || status === 403) {
    const rl = res.headers && res.headers.get ? res.headers.get('x-ratelimit-remaining') : null;
    if (rl === '0') return 'ratelimit';
    return 'auth';
  }
  if (status === 404) return 'notfound';
  if (status === 409) return 'conflict';
  return 'http' + status;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function githubJson(path) {
  const token = await getOwnerToken();
  if (!token) throw new Error('Key needed');
  const { owner, repo, branch } = GITHUB_CONFIG;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;

  let lastErr = 'offline';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(400 * attempt);
    let res;
    try {
      res = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `token ${token}`,
          'User-Agent': 'kizar-stream'
        }
      });
    } catch (e) {
      // Socket hang-ups and dropped connections are common and recover.
      lastErr = 'offline';
      continue;
    }
    if (res.ok) return await res.json();
    const reason = ghError(res, path);
    if (reason === 'ratelimit' || reason === 'auth' || reason === 'notfound') throw new Error(reason);
    lastErr = reason;
  }
  throw new Error(lastErr);
}

function b64utf8(b64) {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function utf8ToB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

async function fetchFromGithub(filePath) {
  const { owner, repo, branch } = GITHUB_CONFIG;
  const token = await getOwnerToken();
  if (token) {
    const api = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`;
    const res = await fetch(api, {
      headers: {
        Accept: 'application/vnd.github.raw',
        Authorization: `token ${token}`,
        'User-Agent': 'kizar-stream'
      }
    });
    if (res.ok) return await res.text();
  }
  const raw = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${filePath}`;
  const res = await fetch(raw);
  if (res.ok) return await res.text();
  throw new Error(token ? 'HTTP ' + res.status : 'Key needed');
}

// ---------------------------------------------------------------------------
// Cookie parsing
// ---------------------------------------------------------------------------
function hashStr(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function sessionFingerprint(cookies) {
  const parts = cookies
    .filter((c) => c && c.name)
    .map((c) => (c.domain || '') + '|' + c.name + '=' + c.value)
    .sort();
  return hashStr(parts.join('&'));
}

function parseCookieObject(raw) {
  if (Array.isArray(raw)) return raw.slice();
  if (raw && Array.isArray(raw.cookies)) return raw.cookies.slice();
  if (raw && typeof raw === 'object' && raw.name) return [raw];
  return [];
}

function parseCookieLine(line) {
  const t = line.trim();
  if (!t) return null;
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      return parseCookieObject(JSON.parse(t));
    } catch (e) {
      return null;
    }
  }
  if (!t.includes('\t')) {
    const eq = t.indexOf('=');
    if (eq < 1) return null;
    const name = t.slice(0, eq).trim();
    if (!name) return null;
    return [{ name, value: t.slice(eq + 1).trim(), domain: '', path: '/' }];
  }
  const f = t.split('\t');
  if (f.length >= 6) {
    return [{
      name: f[5] || '',
      value: f.length > 6 ? f.slice(6).join('\t') : '',
      domain: f[0] || '',
      path: f[2] || '/',
      secure: (f[3] || '').toUpperCase() === 'TRUE',
      expirationDate: parseFloat(f[4]) || undefined
    }];
  }
  return null;
}

function parseCookieFile(text) {
  if (!text) return [];
  const blockLines = [];
  const blocks = [];
  const pushBlock = (list) => {
    const cookies = [];
    for (const line of list) {
      const parsed = parseCookieLine(line);
      if (parsed === null) continue;
      if (Array.isArray(parsed)) cookies.push(...parsed);
    }
    if (cookies.length) blocks.push(cookies);
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const looksLikeMarker =
      (/^#/.test(line) && /\b(account|session)\b/i.test(line)) ||
      /^#?\s*(---|===)/.test(line) ||
      /^#{0,2}\s*-{3,}\s*$/.test(line) ||
      /^#{0,2}\s*=+\s*$/.test(line);
    if (looksLikeMarker) {
      pushBlock(blockLines);
      blockLines.length = 0;
    } else {
      blockLines.push(line);
    }
  }
  pushBlock(blockLines);
  return blocks;
}

// ---------------------------------------------------------------------------
// Browser / tabs / cookies interaction
// ---------------------------------------------------------------------------
function decodeCookieValue(v) {
  if (typeof v !== 'string' || v.indexOf('%') === -1) return v;
  try {
    return decodeURIComponent(v);
  } catch (e) {
    return v;
  }
}

function normalizeSameSite(value) {
  const v = String(value || '').toLowerCase();
  if (['no_restriction', 'lax', 'strict', 'unspecified'].includes(v)) return v;
  return undefined;
}

function urlIsLoaded(url) {
  return url && !url.startsWith('about:') && !url.startsWith('chrome://') && url !== 'about:blank';
}

function urlIsFailure(plat, url) {
  for (const re of plat.failurePatterns) {
    if (re.test(url)) return true;
  }
  return false;
}

async function clearDomainCookies(plat) {
  for (const domain of plat.clearDomains) {
    const store = await chrome.cookies.getAll({ domain });
    for (const c of store) {
      const prefix = c.secure ? 'https://' : 'http://';
      const cleanDomain = (c.domain || '').replace(/^\./, '');
      const url = prefix + cleanDomain + (c.path || '/');
      try {
        await chrome.cookies.remove({ url, name: c.name, storeId: c.storeId });
      } catch (e) {}
    }
  }
}

async function injectSessionCookies(plat, cookies) {
  const defaultDomain = plat.clearDomains[0];
  let injected = 0;
  for (const c of cookies) {
    if (!c || !c.name) continue;
    let domain = c.domain || defaultDomain;
    let url = (c.secure ? 'https://' : 'https://') + domain.replace(/^\./, '') + (c.path || '/');
    const details = {
      url,
      name: c.name,
      value: decodeCookieValue(c.value || ''),
      path: c.path || '/'
    };
    if (domain && domain.startsWith('.')) details.domain = domain;
    if (typeof c.secure === 'boolean') details.secure = c.secure;
    if (typeof c.httpOnly === 'boolean') details.httpOnly = c.httpOnly;
    const sameSite = normalizeSameSite(c.sameSite);
    if (sameSite) details.sameSite = sameSite;
    if (typeof c.expirationDate === 'number') details.expirationDate = c.expirationDate;

    try {
      await chrome.cookies.set(details);
      injected++;
    } catch (e) {
      try {
        delete details.domain;
        await chrome.cookies.set(details);
        injected++;
      } catch (e2) {}
    }
  }
  return injected;
}

async function findPlatformTab(plat) {
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    if (t.url && plat.clearDomains.some((d) => t.url.includes(d.replace(/^\./, '')))) {
      return t;
    }
  }
  return null;
}

async function probeTabFailure(plat, tabId) {
  if (!chrome.scripting || !plat.contentFailures || !plat.contentFailures.length) return false;
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId },
      func: (isPrime) => {
        const body = document.body ? document.body.innerText : '';
        const title = document.title || '';
        const html = document.documentElement ? document.documentElement.innerText : '';
        const allText = (body + ' ' + title + ' ' + html).slice(0, 20000);
        if (isPrime) {
          const hasPrimeContent = /continue watching|my list|watch now|start watching/i.test(allText);
          const hasPrimeSignup = /join prime|subscribe now|start your free trial|upgrade to prime|not eligible|not eligible for prime|prime membership required|subscription required|prime video is not available|access denied/i.test(allText);
          const hasNonprimePage = /nonprimehomepage|offers\/nonprime|dv_web_force_root|join.*prime.*button/i.test(allText);
          const joinPrimeElements = document.querySelectorAll('[class*="JoinPrime"], [class*="join-prime"], [class*="SubscribeButton"], [class*="offer-page"], [class*="OfferPage"], [data-testid*="join-prime"], a[href*="offers/nonprime"], #nav-prime-btn-txt');
          const hasJoinPrimeDom = joinPrimeElements.length > 0;
          if (hasPrimeContent && !hasPrimeSignup && !hasNonprimePage && !hasJoinPrimeDom) return false;
          return '__PRIME_EXPIRED__';
        }
        const primeExpiredSelectors = [
          '#nav-prime-btn-txt', '[class*="JoinPrimeButton"]', '[data-testid="join-prime-button"]',
          'a[href*="offers/nonprime"]', '[class*="WatchWithPrime"]', '[data-feature-id="JoinPrime"]',
          'button[class*="subscribeButton"]', '[class*="OfferPage"]',
        ];
        if (primeExpiredSelectors.some(sel => document.querySelector(sel))) return '__PRIME_EXPIRED__';
        return allText;
      },
      args: [plat.id === 'prime' || plat.id === 'primevideo']
    });
    const text = (res && res[0] && res[0].result) || '';
    if (text === '__PRIME_EXPIRED__') return true;
    return plat.contentFailures.some((re) => re.test(text));
  } catch (e) {
    return false;
  }
}

async function navigateAndWait(plat) {
  const existing = await findPlatformTab(plat);
  let tabId;
  if (existing) {
    tabId = existing.id;
    await chrome.tabs.update(tabId, { url: plat.homeUrl, active: false });
  } else {
    const created = await chrome.tabs.create({ url: plat.homeUrl, active: false });
    tabId = created.id;
  }

  let lastUrl = '';
  let stableCount = 0;

  for (let i = 0; i < SAMPLES; i++) {
    await sleep(SAMPLE_MS);
    let tab;
    try { tab = await chrome.tabs.get(tabId); } catch (e) { return { status: 'dead', error: 'tab_closed' }; }
    const url = tab.url || '';
    if (!urlIsLoaded(url)) continue;
    if (urlIsFailure(plat, url)) return { status: 'dead', url, tabId };

    // Track URL stability: Prime Video SPA stays in 'loading' forever
    // because React keeps firing XHR requests. We can't wait for 'complete'.
    // NOTE: Do NOT skip homeUrl - expired accounts stay on primevideo.com/ home
    if (url === lastUrl) {
      stableCount++;
    } else {
      stableCount = 1;
      lastUrl = url;
    }

    // Run DOM check when: tab is truly 'complete' OR URL stable for 2+ samples
    // This is the key fix â€” previously probeTabFailure was NEVER called for Prime
    if (tab.status === 'complete' || stableCount >= 2) {
      const contentDead = await probeTabFailure(plat, tabId);
      if (contentDead) return { status: 'dead', url, tabId };
      // Confirm ok only if tab is complete OR URL has been rock-solid for 3+ samples
      if (tab.status === 'complete' || stableCount >= 3) {
        return { status: 'ok', url, tabId };
      }
    }
  }

  // Timeout fallback: run one final DOM probe before assuming ok
  // Catches expired accounts where the SPA settled but never hit 'complete'
  try {
    const finalDead = await probeTabFailure(plat, tabId);
    if (finalDead) return { status: 'dead', url: lastUrl || plat.homeUrl, tabId };
  } catch (e) {}

  return { status: 'ok', url: lastUrl || plat.homeUrl, tabId };
}

async function activateTab(tabId) {
  if (!tabId) return;
  try { await chrome.tabs.update(tabId, { active: true }); } catch (e) {}
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab && tab.windowId) await chrome.windows.update(tab.windowId, { focused: true });
  } catch (e) {}
}

async function runSession(key, cookies) {
  const plat = PLATFORMS[key];
  try {
    await clearDomainCookies(plat);
    const count = await injectSessionCookies(plat, cookies);
    if (count === 0) return { ok: false, reason: 'inject_error' };
    const nav = await navigateAndWait(plat);
    if (nav.status === 'dead') return { ok: false, reason: 'dead', url: nav.url, tabId: nav.tabId };
    return { ok: true, tabId: nav.tabId };
  } catch (e) {
    return { ok: false, reason: 'error', error: e.message };
  }
}

// ---------------------------------------------------------------------------
// Profile & membership logic
// ---------------------------------------------------------------------------
async function getProfile() {
  const data = await chrome.storage.local.get(PROFILE_KEY);
  const p = data[PROFILE_KEY] || {};
  const obj = {
    username: p.username || '',
    activations: p.activations || {},
    tier: p.tier || '',
    memberSince: p.memberSince || '',
    plan: derivePlan(p.activations, p.tier)
  };
  if (forcePlanOverride === 'PRO' && obj.activations && obj.activations.access) obj.plan = 'active';
  else if (forcePlanOverride === 'FREE') obj.plan = obj.activations && obj.activations.access ? 'free' : 'inactive';
  return obj;
}

let forcePlanOverride = null;

async function readForcePlan() {
  try {
    const data = JSON.parse((await fetchFromGithub(GITHUB_CONFIG.users)) || '{}');
    const p = await getProfile();
    const row = data && (data[p.username] || (Array.isArray(data) ? data.find((r) => r && r.username === p.username) : null));
    const next = row && (row.forcePlan === 'PRO' || row.forcePlan === 'FREE') ? row.forcePlan : null;
    if (next !== forcePlanOverride) {
      forcePlanOverride = next;
      renderPlanPill();
    }
  } catch (e) {}
}

function renderPlanPill() {
  const pp = $('p-plan');
  if (pp) {
    getProfile().then((p) => { pp.textContent = p.plan === 'active' ? 'PRO' : 'FREE'; }).catch(() => {});
  }
}

function onBanCheck(banList) {
  readForcePlan().catch(() => {});
}

function tierOfCode(code) {
  const c = String(code || '').trim().toUpperCase();
  if (c.startsWith('KZR-FREE-')) return 'FREE';
  if (c.startsWith('KZR-VIP-')) return 'PRO';
  if (c.startsWith('KZR-PRO-')) return 'PRO';
  return 'PRO';
}

function tierOfEntry(entry) {
  if (!entry) return '';
  const t = String(entry.tier || '').trim().toUpperCase();
  if (t === 'FREE') return 'FREE';
  if (t === 'PRO' || t === 'VIP') return 'PRO';
  return tierOfCode(entry.code);
}

function derivePlan(activations, tier) {
  const a = activations || {};
  if (!a.access) return 'inactive';
  const t = String(tier || '').trim().toUpperCase();
  if (t === 'FREE') return 'free';
  if (t === 'PRO' || t === 'VIP') return 'active';
  return tierOfCode(a.access) === 'FREE' ? 'free' : 'active';
}

async function setProfile(username, activations, memberSince, tier) {
  const prev = await getProfile();
  const obj = {
    username: username !== undefined ? username : prev.username,
    activations: activations !== undefined ? activations : prev.activations,
    memberSince: memberSince !== undefined ? memberSince : (prev.memberSince || new Date().toISOString())
  };
  const t = tier !== undefined ? tier : prev.tier;
  if (t) obj.tier = t;
  else if (!obj.activations || !obj.activations.access) delete obj.tier;
  await chrome.storage.local.set({ [PROFILE_KEY]: obj });
}

async function savedLimit() {
  const p = await getProfile();
  return PLAN_LIMITS[p.plan] || 0;
}

// ---------------------------------------------------------------------------
// Activation codes handling
// ---------------------------------------------------------------------------
function normalizeCode(v) {
  return String(v || '').toUpperCase().replace(/\s+/g, '');
}

function parseCodes(payload) {
  const out = {};
  for (const k of Object.keys(payload || {})) {
    const list = payload[k];
    if (!Array.isArray(list)) continue;
    out[k] = list.map((it) => (typeof it === 'string' ? { code: it, used: false, usedBy: '', usedAt: '' } : it));
  }
  return out;
}

let lastCodesError = '';

async function fetchCodes(force) {
  if (!force && STATE.codesReady) return STATE.codes;
  try {
    const meta = await githubJson(GITHUB_CONFIG.codes);
    STATE.codesSha = meta.sha;
    STATE.codes = parseCodes(JSON.parse(b64utf8(meta.content)));
    STATE.codesReady = true;
    lastCodesError = '';
    return STATE.codes;
  } catch (e) {
    lastCodesError = String((e && e.message) || e) || 'unknown';
    return null;
  }
}

async function writeCodesToGithub() {
  const token = await getOwnerToken();
  if (!token) throw new Error('Key needed');
  const { owner, repo } = GITHUB_CONFIG;
  const payload = {};
  for (const k of Object.keys(STATE.codes)) payload[k] = STATE.codes[k];
  const body = {
    message: 'mark activation code used',
    content: utf8ToB64(JSON.stringify(payload, null, 2)),
    sha: STATE.codesSha
  };
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_CONFIG.codes}`, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `token ${token}`,
      'User-Agent': 'kizar-stream',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.json();
}

async function activateCode(raw) {
  const code = normalizeCode(raw);
  if (!code) return { ok: false, reason: 'empty' };
  const profile = await getProfile();
  if (!profile.username) return { ok: false, reason: 'noname' };

  // The server binds the key. The browser used to do it by writing
  // activation.json with an embedded repo token, and GitHub kept refusing
  // that write, so keys were never really bound to anybody. Everything
  // downstream that checks a key therefore had nothing to match.
  const p2 = await getProfile();
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(700 * attempt);
    try {
      const res = await fetch(CONTROL_ROOM + '/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'redeem',
          code,
          username: profile.username,
          ip: (await getProfile()).ip || (p2.ip || '')
        })
      });
      const j = await res.json().catch(() => ({}));

      if (res.ok && j && j.ok) {
        const tier = j.tier || 'PRO';
        const activations = Object.assign({}, profile.activations || {});
        activations.access = code;
        await setProfile(profile.username, activations, profile.memberSince, tier);
        STATE.codesReady = false;
        return {
          ok: true,
          tier,
          plan: j.plan || (tier === 'FREE' ? 'free' : 'active'),
          expiresAt: j.expiresAt || ''
        };
      }

      const reason = String((j && j.error) || ('HTTP ' + res.status));
      if (res.status >= 500 && attempt < 2) continue;   // the server will retry its own write
      return { ok: false, reason: mapRedeemError(reason) };
    } catch (e) {
      await sleep(800);
      if (attempt === 2) return { ok: false, reason: 'offline', detail: String((e && e.message) || e) };
    }
  }
  return { ok: false, reason: 'offline' };
}

/** Turns the server's wording into the short reason the popup already uses. */
function mapRedeemError(reason) {
  const r = String(reason || '').toLowerCase();
  if (r.indexOf('expired') >= 0) return 'expired';
  if (r.indexOf('used') >= 0) return 'used';
  if (r.indexOf('invalid') >= 0) return 'invalid';
  if (r.indexOf('429') >= 0 || r.indexOf('rate') >= 0) return 'ratelimit';
  if (r.indexOf('name') >= 0) return 'noname';
  return 'write_failed';
}

async function validateStoredCode() {
  const profile = await getProfile();
  const features = Object.keys(profile.activations || {});
  if (!features.length) return profile;
  const codes = await fetchCodes(true);
  if (!codes) return profile;
  const activations = Object.assign({}, profile.activations);
  const all = Object.values(codes).reduce((a, list) => a.concat(list || []), []);
  let changed = false;
  const now = new Date();
  for (const f of features) {
    const codeVal = activations[f];
    if (!codeVal) {
      delete activations[f];
      changed = true;
      continue;
    }
    // Check if code has expired
    const codeEntry = all.find((c) => c.code === codeVal);
    if (codeEntry && codeEntry.expiresAt) {
      const expires = new Date(codeEntry.expiresAt);
      if (now > expires) {
        // Code has expired, remove activation
        delete activations[f];
        changed = true;
        continue;
      }
    }
    if (!codeEntry || !codeEntry.code) {
      delete activations[f];
      changed = true;
      continue;
    }
    if (!all.some((c) => c.code === codeVal)) {
      delete activations[f];
      changed = true;
    } else if (f !== 'access') {
      delete activations[f];
      activations.access = codeVal;
      changed = true;
    }
  }
  if (changed) await setProfile(profile.username, activations, profile.memberSince);
  return getProfile();
}

const DUR_UNITS = {
  m: 60000, min: 60000, mins: 60000, minute: 60000, minutes: 60000,
  h: 3600000, hr: 3600000, hrs: 3600000, hour: 3600000, hours: 3600000,
  d: 86400000, day: 86400000, days: 86400000,
  w: 604800000, week: 604800000, weeks: 604800000,
  mo: 2592000000, mon: 2592000000, month: 2592000000, months: 2592000000,
  y: 31536000000, yr: 31536000000, year: 31536000000, years: 31536000000,
  lifetime: 0, forever: 0, never: 0, permanent: 0
};

function parseDuration(input) {
  const raw = String(input == null ? '' : input).trim().toLowerCase();
  if (!raw) return null;
  if (DUR_UNITS[raw] === 0) return 0;
  const m = raw.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = DUR_UNITS[m[2]];
  if (unit === undefined || !isFinite(n)) return null;
  return Math.round(n * unit);
}

function resolveExpiry(durationInput, fromMs) {
  const base = typeof fromMs === 'number' ? fromMs : Date.now();
  const dur = parseDuration(durationInput);
  if (dur === null) return null;
  if (dur === 0) return null;
  return new Date(base + dur).toISOString();
}

function isExpired(entry) {
  if (!entry) return false;
  if (entry.permanent) return false;
  const raw = entry.expiresAt || entry.expires || entry.expiry || '';
  if (!raw) return false;
  const t = new Date(raw).getTime();
  if (!isFinite(t)) return false;
  return Date.now() > t;
}

function timeLeftLabel(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!isFinite(t)) return '';
  let ms = t - Date.now();
  if (ms <= 0) return 'expired';
  const d = Math.floor(ms / 86400000); ms -= d * 86400000;
  const h = Math.floor(ms / 3600000); ms -= h * 3600000;
  const m = Math.floor(ms / 60000);
  if (d > 0) return d + 'd ' + h + 'h left';
  if (h > 0) return h + 'h ' + m + 'm left';
  return m + 'm left';
}

async function verifyUserAndKey() {
  const status = { checkedAt: Date.now(), user: false, key: false, plan: 'FREE', keyLabel: '', expiresAt: '', timeLeft: '', reason: '', online: false, registered: false };
  const profile = await getProfile();
  status.plan = profile.plan === 'active' ? 'PRO' : 'FREE';
  if (!profile.username) { status.reason = 'no_username'; return status; }
  status.user = true;

  try {
    const reg = await chrome.storage.local.get(REGISTERED_KEY);
    status.registered = !!reg[REGISTERED_KEY];
  } catch (e) {}

  const codes = await fetchCodes(true);
  status.online = !!codes;
  const all = codes ? Object.values(codes).reduce((a, l) => a.concat(l || []), []) : [];
  const activations = profile.activations || {};
  const keys = Object.keys(activations);
  if (!keys.length) { status.reason = codes ? 'no_key' : 'offline'; return status; }

  let found = null;
  for (const k of keys) {
    const hit = all.find((c) => c.code === activations[k]);
    if (hit) { found = hit; status.keyLabel = k; break; }
  }
  if (!found) {
    status.reason = status.online ? 'key_missing' : 'offline';
    return status;
  }
  status.expiresAt = found.expiresAt || found.expires || found.expiry || '';
  status.timeLeft = timeLeftLabel(status.expiresAt);
  if (isExpired(found)) { status.reason = 'key_expired'; return status; }
  status.key = true;
  status.reason = 'ok';
  return status;
}

function renderVerifyStatus(s) {
  const box = $('verify-box');
  if (!box) return;
  const dot = $('verify-dot');
  const text = $('verify-text');
  const sub = $('verify-sub');
  let cls = 'warn';
  let label = 'Checking';
  if (s.reason === 'ok') { cls = 'ok'; label = s.registered ? 'Verified' : 'Key OK'; }
  else if (s.reason === 'no_username') { cls = 'warn'; label = 'No name'; }
  else if (s.reason === 'no_key') { cls = 'warn'; label = 'No key'; }
  else if (s.reason === 'key_expired') { cls = 'bad'; label = 'Expired'; }
  else if (s.reason === 'key_missing') { cls = 'bad'; label = 'Bad key'; }
  else if (s.reason === 'offline') { cls = 'warn'; label = 'Offline'; }
  if (dot) dot.className = 'vdot ' + cls;
  if (text) { text.textContent = label; text.style.color = cls === 'ok' ? '#4ade80' : cls === 'bad' ? '#f87171' : '#fbbf24'; }
  if (sub) {
    const bits = [];
    if (s.keyLabel) bits.push(s.keyLabel);
    if (s.timeLeft) bits.push(s.timeLeft);
    if (s.user && !s.registered) bits.push('not synced');
    sub.textContent = bits.join('  ·  ') || (s.user ? '' : 'set a username');
  }
}

// ---------------------------------------------------------------------------
// Saved sessions
// ---------------------------------------------------------------------------
async function getSaved() {
  const data = await chrome.storage.local.get(SAVED_KEY);
  const raw = data[SAVED_KEY] || {};
  const out = { netflix: [], prime: [] };
  for (const k of PLATFORM_KEYS) {
    const v = raw[k];
    if (Array.isArray(v)) out[k] = v.filter((s) => s && s.cookies);
    else if (v && v.cookies) out[k] = [v];
  }
  return out;
}

async function addSaved(key, cookies, fingerprint) {
  const limit = await savedLimit();
  const saved = await getSaved();
  const list = saved[key];
  const idx = list.findIndex((s) => s.fingerprint === fingerprint);
  if (idx >= 0) list.splice(idx, 1);
  list.push({ cookies, fingerprint, savedAt: Date.now() });
  while (list.length > limit) list.shift();
  await chrome.storage.local.set({ [SAVED_KEY]: saved });
}

async function removeSaved(key, fingerprint) {
  const saved = await getSaved();
  const before = (saved[key] || []).length;
  saved[key] = saved[key].filter((s) => s.fingerprint !== fingerprint);
  await chrome.storage.local.set({ [SAVED_KEY]: saved });
  return before - saved[key].length;
}

async function clearSavedSessions() {
  await chrome.storage.local.remove(SAVED_KEY);
}

async function trimSavedForPlan(plan) {
  const saved = await getSaved();
  let changed = false;
  for (const k of PLATFORM_KEYS) {
    while (saved[k].length > PLAN_LIMITS[plan]) { saved[k].shift(); changed = true; }
  }
  if (changed) await chrome.storage.local.set({ [SAVED_KEY]: saved });
}

async function loadBanned() {
  const data = await chrome.storage.local.get(BANNED_KEY);
  const raw = data[BANNED_KEY] || {};
  return { netflix: raw.netflix || [], prime: raw.prime || [] };
}

// Shared dead-account list (dead.json on GitHub): every user learns which
// accounts are expired / logged out, so the whole pool stops offering them.
const DEAD_MAX = 300;
let deadRemote = { netflix: [], prime: [] };
let deadRemoteFetched = false;
let deadFetchAt = 0;
let lastDeadReport = 0;

function normalizeDeadEntries(list) {
  if (!Array.isArray(list)) return [];
  return list.map((e) => (typeof e === 'string' ? e : e && e.fp)).filter(Boolean);
}

async function loadDeadRemote(force) {
  if (!force && deadRemoteFetched && Date.now() - deadFetchAt < 60000) return deadRemote;
  try {
    const data = JSON.parse((await fetchFromGithub(GITHUB_CONFIG.dead)) || '{}') || {};
    deadRemote = {
      netflix: normalizeDeadEntries(data.netflix),
      prime: normalizeDeadEntries(data.prime)
    };
    deadFetchAt = Date.now();
    deadRemoteFetched = true;
  } catch (e) {}
  return deadRemote;
}

// ---------------------------------------------------------------------------
// Saved-account swap requests (user -> operator approval)
// ---------------------------------------------------------------------------
async function reportDeadAccount(key, fingerprint) {
  if (!fingerprint || (key !== 'netflix' && key !== 'prime')) return;
  const p = await getProfile().catch(() => null);
  const by = (p && p.username) || '';
  let tk = null;
  try { tk = await getOwnerToken(); } catch (e) { return; }
  if (!tk) return;
  if (Date.now() - lastDeadReport < 5000) return;
  try {
    const data = JSON.parse((await fetchFromGithub(GITHUB_CONFIG.dead)) || '{}') || {};
    const raw = {
      netflix: Array.isArray(data.netflix) ? data.netflix : [],
      prime: Array.isArray(data.prime) ? data.prime : []
    };
    const list = raw[key];
    if (list.some((e) => (typeof e === 'string' ? e : e && e.fp) === fingerprint)) return;
    list.push({ fp: fingerprint, by, at: new Date().toISOString() });
    if (list.length > DEAD_MAX) list.splice(0, list.length - DEAD_MAX);
    raw.updatedAt = new Date().toISOString();
    const meta = await githubJson(GITHUB_CONFIG.dead).catch(() => null);
    await putGithubJson(GITHUB_CONFIG.dead, JSON.stringify(raw, null, 2), meta ? meta.sha : undefined);
    deadRemote = { netflix: normalizeDeadEntries(raw.netflix), prime: normalizeDeadEntries(raw.prime) };
    deadRemoteFetched = true;
    deadFetchAt = Date.now();
    lastDeadReport = Date.now();
  } catch (e) {}
}

async function requestSwap(key, fingerprint, reason) {
  const p = await getProfile();
  if (!p.username) { toast('Save your name first', 3000); return { ok: false, reason: 'Save your name first' }; }
  if (!fingerprint) return { ok: false, reason: 'Nothing to swap' };
  const platformName = key === 'netflix' ? 'Netflix' : 'Prime';

  // The swap goes through the Control Room, not straight to GitHub.
  //
  // The browser was writing to requests.json itself, which meant every swap
  // depended on a repo token shipping inside the extension and on GitHub
  // accepting an update without a matching sha - it frequently did not, and the
  // user just saw "could not send". The server owns the credential, retries the
  // write properly, and the extension only proves who it is with the key the
  // user already signed in with.
  const accessKey = (p.activations && p.activations.access) || '';
  if (!accessKey) {
    const why = 'Activate a key before requesting a swap';
    toast(why, 3400);
    return { ok: false, reason: why };
  }

  let lastErr = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(700 * attempt);
    try {
      const res = await fetch(CONTROL_ROOM + '/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-kizar-key': accessKey },
        body: JSON.stringify({
          action: 'request',
          username: p.username,
          platform: key,
          fingerprint,
          reason: String(reason || '').slice(0, 200),
          ip: p.ip || ''
        })
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j && j.ok) {
        toast(platformName + ' swap request sent. Waiting for operator approval...', 3200);
        return { ok: true, id: (j.request || {}).id };
      }
      lastErr = (j && j.error) || ('HTTP ' + res.status);
      if (res.status === 429) { await sleep(2200); continue; }
      if (res.status >= 500) continue; // the server will retry its own write
      break; // 400/401/403 are answers, not hiccups
    } catch (e) {
      lastErr = String((e && e.message) || e);
      await sleep(900);
    }
  }

  console.warn('swap request failed:', lastErr);
  const why = /rate|too many/i.test(lastErr)
    ? 'Too many requests in a row. Wait a moment and press again.'
    : /key/i.test(lastErr)
      ? 'Your key was not accepted (' + lastErr.slice(0, 60) + ').'
      : 'Could not send the request (' + String(lastErr).slice(0, 90) + ')';
  toast(why, 4200);
  return { ok: false, reason: why, detail: lastErr };
}

async function pollSwapApprovals() {
  try {
    const data = JSON.parse((await fetchFromGithub(GITHUB_CONFIG.requests)) || '{}') || {};
    const list = Array.isArray(data.requests) ? data.requests : [];
    const p = await getProfile();
    if (!p.username) return;
    const consumed = await getConsumedApprovals();
    for (const key of PLATFORM_KEYS) {
      // An approval we already acted on is finished, even if the server-side
      // "consumed" write failed. Without this the banner comes back every poll
      // and the user can tap accept forever with nothing happening.
      const approved = list.find(
        (r) => r && r.username === p.username && r.platform === key
          && r.status === 'approved' && !consumed[r.id]
      );
      if (approved && !STATE.swapApproved[key]) {
        STATE.swapApproved[key] = approved;
      }
      if (!approved) STATE.swapApproved[key] = null;
    }
    renderSwapBanner();
  } catch (e) {}
}

async function autoApplyApprovedSwaps() {
  const keys = PLATFORM_KEYS.filter((k) => STATE.swapApproved[k]);
  if (!keys.length) return;
  let done = 0;
  for (const key of keys) {
    try {
      const r = await applySwapApproval(key, STATE.swapApproved[key]);
      if (r.removed) done++;
      await renderChips(key);
    } catch (e) {}
  }
  await updateCounts();
  renderSwapBanner();
  if (done) toast('Swap approved - old account removed, new one ready', 3200);
}

function renderSwapBanner() {
  try {
    const banner = $('swap-banner');
    if (!banner) return;
    const approved = (STATE && STATE.swapApproved) || {};
    const keys = PLATFORM_KEYS.filter((k) => approved[k]);
    if (!keys.length) {
      banner.classList.add('hidden');
      return;
    }
    const names = keys.map((k) => (k === 'netflix' ? 'Netflix' : 'Prime')).join(' + ');
    const label = $('swap-banner-text');
    if (label) label.textContent = 'Operator approved a new ' + names + ' account for you. Tap to replace your saved one.';
    banner.classList.remove('hidden');
  } catch (e) {}
}

async function consumeSwapApproval(appr) {
  if (!appr || !appr.id) return;
  // Record it locally first. That is what makes accepting idempotent: even if
  // the GitHub write below is rate limited or loses a sha race, this device
  // will never offer the same approval again.
  await markConsumedApproval(appr.id);
  try {
    const meta = await githubJson(GITHUB_CONFIG.requests);
    let data = { requests: [] };
    let sha;
    if (meta && meta.content) {
      try { data = JSON.parse(b64utf8(meta.content)); } catch (e) { data = { requests: [] }; }
      sha = meta.sha;
    }
    const list = Array.isArray(data.requests) ? data.requests : [];
    const item = list.find((r) => r && r.id === appr.id);
    if (item && item.status !== 'consumed') {
      item.status = 'consumed';
      item.consumedAt = new Date().toISOString();
      await putGithubJson(GITHUB_CONFIG.requests, JSON.stringify(data, null, 2), sha);
    }
  } catch (e) {
    // Not fatal. The local ledger already stops the loop, so the worst case is
    // that the operator sees a still-approved row.
    console.warn('swap: server consume failed', e && e.message);
  }
}

async function banLocal(key, fingerprint) {
  if (!fingerprint) return;
  const banned = await loadBanned();
  if (!banned[key].includes(fingerprint)) banned[key].push(fingerprint);
  await chrome.storage.local.set({ [BANNED_KEY]: banned });
  STATE.banned = banned;
}

async function getConsumedApprovals() {
  try {
    const d = await chrome.storage.local.get(CONSUMED_KEY);
    const v = d[CONSUMED_KEY];
    return v && typeof v === 'object' ? v : {};
  } catch (e) {
    return {};
  }
}

async function markConsumedApproval(id) {
  if (!id) return;
  try {
    const map = await getConsumedApprovals();
    map[id] = new Date().toISOString();
    // Keep the ledger small: only the recent history is ever useful.
    const ids = Object.keys(map).sort((a, b) => String(map[a]).localeCompare(String(map[b])));
    while (ids.length > 40) delete map[ids.shift()];
    await chrome.storage.local.set({ [CONSUMED_KEY]: map });
  } catch (e) {}
}

async function applySwapApproval(key, appr) {
  if (!appr) return { removed: 0 };
  const broken = appr.savedFp || appr.fingerprint || '';
  let removed = 0;
  if (broken) {
    await banLocal(key, broken);
    removed = await removeSaved(key, broken);
    if (!removed) {
      // The stored fingerprint did not match what the request recorded. Fall
      // back to clearing this platform so the dead account cannot stay stuck.
      const saved = await getSaved();
      if ((saved[key] || []).length) {
        await chrome.storage.local.set({ [SAVED_KEY]: Object.assign({}, saved, { [key]: [] }) });
        removed = saved[key].length;
      }
    }
  }
  if (appr.blockedAll) {
    await reportDeadAccount(key, broken);
  }
  await consumeSwapApproval(appr);
  STATE.swapApproved[key] = null;
  return { removed };
}

async function initSwapFlow() {
  pollSwapApprovals().catch(() => {});
  setInterval(() => pollSwapApprovals().catch(() => {}), 20000);
  const btn = $('btn-swap-accept');
  if (btn && !btn.dataset.wired) {
    btn.dataset.wired = '1';
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const keys = PLATFORM_KEYS.filter((k) => STATE.swapApproved[k]);
      if (!keys.length) { toast('No approved swap waiting'); return; }
      btn.disabled = true;
      const names = [];
      let anyRemoved = false;
      try {
        for (const key of keys) {
          const res = await applySwapApproval(key, STATE.swapApproved[key]);
          if (res.removed) anyRemoved = true;
          names.push(key === 'netflix' ? 'Netflix' : 'Prime');
          await renderChips(key);
        }
      } finally {
        btn.disabled = false;
      }
      await updateCounts();
      await refresh();
      renderSwapBanner();
      if (anyRemoved) {
        // The point of an approval is a working account, so pull the fresh one
        // instead of leaving the user with an empty slot.
        toast(names.join(' + ') + ' replaced - fetching a new account...', 3200);
        for (const key of keys) {
          try { await tryStream(key); } catch (e2) {}
          await new Promise((r) => setTimeout(r, 400));
        }
      } else {
        toast('Approval noted - stream a new account now', 3000);
      }
    });
  }
  const banner = $('swap-banner');
  if (banner && !banner.dataset.wired) {
    banner.dataset.wired = '1';
    banner.addEventListener('click', async (e) => {
      if (e.target && e.target.id === 'btn-swap-accept') return;
      const btn2 = $('btn-swap-accept');
      if (btn2) btn2.click();
    });
  }
}

async function clearBanned() {
  await chrome.storage.local.remove(BANNED_KEY);
  STATE.banned = { netflix: [], prime: [] };
}

async function getPending() {
  try {
    const data = await chrome.storage.session.get(PENDING_KEY);
    return data[PENDING_KEY] || null;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Counts & Refresh
// ---------------------------------------------------------------------------
async function updateCounts() {
  const banned = await loadBanned();
  STATE.banned = banned;
  const deadList = await loadDeadRemote(false);
  const saved = await getSaved();
  const p = await getProfile();
  const limit = PLAN_LIMITS[p.plan] || 0;
  const capGuards = p.plan === 'active';
  for (const key of PLATFORM_KEYS) {
    const all = STATE.sessions[key] || [];
    const usable = all.filter((s) => {
      const fp = sessionFingerprint(s);
      return !banned[key].includes(fp) && !deadList[key].includes(fp);
    });
    const countEl = $(key + '-count');
    if (countEl) countUp(countEl, usable.length);
    const btn = $('btn-stream-' + key);
    if (btn) {
      const atCap = capGuards && saved[key].length >= limit;
      btn.disabled = usable.length === 0 || STATE.streaming || atCap;
      btn.title = atCap ? 'Remove one saved account to stream again' : '';
    }
  }
}

async function refresh() {
  const btn = $('btn-refresh');
  if (btn) btn.classList.add('spinning');
  pill('sync', 'Syncing...');
  try {
    await Promise.all([loadVersionGate(), loadServiceFlags()]);
    if (isStreamingBlocked()) {
      STATE.sessions.netflix = [];
      STATE.sessions.prime = [];
      await updateCounts();
      renderServiceState();
      return;
    }
    const [netText, primeText] = await Promise.all([
      fetchFromGithub(GITHUB_CONFIG.files.netflix).catch(() => ''),
      fetchFromGithub(GITHUB_CONFIG.files.prime).catch(() => '')
    ]);
    STATE.sessions.netflix = parseCookieFile(netText);
    STATE.sessions.prime = parseCookieFile(primeText);
    await loadDeadRemote(true);
    await updateCounts();
    pill('ok', 'Ready');
    const noteEl = $('footer-note');
    if (noteEl) noteEl.textContent = 'Live cloud sync';
  } catch (e) {
    pill('err', 'Offline');
    const noteEl = $('footer-note');
    if (noteEl) noteEl.textContent = 'Connection error';
  } finally {
    if (btn) btn.classList.remove('spinning');
    flushUsage().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Streaming execution flow
// ---------------------------------------------------------------------------
async function tryStream(key) {
  if (STATE.streaming) return;
  // Key first. Nothing below this line may run without a live one.
  if (!(await requireLiveKey())) { renderServiceState(); return; }
  await updateCounts();

  if (isStreamingBlocked()) {
    renderServiceState();
    if (keyState.expired) toast(RENEW_TEXT[keyState.reason] || RENEW_TEXT.expired, 4000);
    else if (versionState.blocked) toast('This build is paused by the operator', 3000);
    else if (STATE.tampered) toast('This build is not allowed', 3500);
    else if (userDisabled) toast('Your access is turned off', 3000);
    else toast(serviceState.message || 'Streaming is paused right now', 3000);
    return;
  }

  const platformName = key === 'netflix' ? 'Netflix' : 'Prime';
  const saved = await getSaved();
  const savedList = saved[key] || [];
  const p = await getProfile();
  const isActive = p.plan === 'active';
  const limit = PLAN_LIMITS[p.plan] || 0;
  const atCapacity = isActive && savedList.length >= limit;

  if (atCapacity) {
    pill('ok', platformName + ' Full');
    toast(`Already saved ${savedList.length} accounts - remove one to stream again`, 3200);
    await updateCounts();
    return;
  }

  if (!isActive && savedList.length) {
    const top = savedList[0];
    showProgress(true, `Checking saved session...`, 20);
    const check = await runSession(key, top.cookies);
    if (check.ok) {
      try { await chrome.storage.session.remove(PENDING_KEY); } catch (e) {}
      showProgress(false);
      STATE.streaming = false;
      pill('ok', platformName + ' Active');
      toast(`${platformName} connected`);
      await updateCounts();
      bumpUsage(key === 'netflix' ? { netflixSessions: 1 } : { primeSessions: 1 });
      await activateTab(check.tabId);
      return;
    }
    if (check.reason === 'dead') {
      await removeSaved(key, top.fingerprint);
      const banned = await loadBanned();
      if (!banned[key].includes(top.fingerprint)) banned[key].push(top.fingerprint);
      await chrome.storage.local.set({ [BANNED_KEY]: banned });
      STATE.banned = banned;
      reportDeadAccount(key, top.fingerprint).catch(() => {});
      showProgress(true, `Finding fresh session...`, 25);
    }
  }

  const savedFps = new Set(savedList.map((s) => s.fingerprint));
  const deadRemote = await loadDeadRemote(false);
  const candidates = (STATE.sessions[key] || []).filter((s) => {
    const fp = sessionFingerprint(s);
    return !STATE.banned[key].includes(fp) && !savedFps.has(fp) && !deadRemote[key].includes(fp);
  });
  if (!candidates.length) {
    showProgress(false);
    STATE.streaming = false;
    toast('No new sessions available');
    return;
  }

  STATE.streaming = true;
  await updateCounts();
  showProgress(true, 'Connecting...', 10);

  const pool = candidates.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  let deadCount = 0;
  let errors = 0;

  for (let i = 0; i < pool.length; i++) {
    const cookies = pool[i];
    const fp = sessionFingerprint(cookies);
    const pct = 10 + Math.round((i / pool.length) * 80);
    showProgress(true, `Testing session ${i + 1}/${pool.length}...`, pct);

    try { await chrome.storage.session.set({ [PENDING_KEY]: { platformKey: key, fingerprint: fp } }); } catch (e) {}

    const result = await runSession(key, cookies);

    if (result.ok) {
      try { await chrome.storage.session.remove(PENDING_KEY); } catch (e) {}
      await addSaved(key, cookies, fp);
      showProgress(false);
      STATE.streaming = false;
      pill('ok', platformName + ' Active');
      toast(`${platformName} connected & saved!`);
      await updateCounts();
      bumpUsage(key === 'netflix' ? { netflixSessions: 1 } : { primeSessions: 1 });
      await activateTab(result.tabId);
      return;
    }

    const reason = result.reason;
    if (reason === 'dead') {
      deadCount++;
      if (!STATE.banned[key].includes(fp)) STATE.banned[key].push(fp);
      await chrome.storage.local.set({ [BANNED_KEY]: STATE.banned });
      reportDeadAccount(key, fp).catch(() => {});
    } else {
      errors++;
    }
  }

  try { await chrome.storage.session.remove(PENDING_KEY); } catch (e) {}
  showProgress(false);
  STATE.streaming = false;

  if (deadCount) {
    pill('err', 'Dead sessions');
    toast(`All sessions tested failed. Clear blocked to retry.`, 3500);
  } else {
    pill('err', 'Unavailable');
    toast(`${platformName} unavailable right now`, 3500);
  }
  await updateCounts();
}

/**
 * Expired key = blocked, not signed out.
 *
 * The user keeps their name, their saved sessions and their place in the app.
 * What they lose is the ability to stream: no new session from the pool, and no
 * replaying a saved one either. Until they enter a working key they are told
 * exactly that, in the popup, on Home.
 *
 * A key that cannot be read is never treated as expired. Blocking somebody
 * because their connection dropped would be far worse than letting a stale key
 * sit there until the next successful read.
 */
let keyState = { expired: false, reason: '', at: '' };

const RENEW_TEXT = {
  expired: 'Your key has expired. Renew it to keep streaming.',
  removed: 'Your key was removed. Enter a working key to keep streaming.'
};

async function checkKeyExpiry() {
  const p = await getProfile();
  const acts = p.activations || {};
  const myCodes = Object.keys(acts).filter((k) => acts[k]);

  if (!myCodes.length) {
    keyState = { expired: false, reason: '', at: '' };
    renderKeyBlock();
    return false;
  }

  let all = null;
  try {
    const c = await fetchCodes(true);
    if (c) all = Object.values(c).reduce((a, l) => a.concat(l || []), []);
  } catch (e) { /* offline */ }
  if (!all || !all.length) {
    renderKeyBlock();
    return keyState.expired; // no new answer, keep whatever we already knew
  }

  let reason = '';
  for (const k of myCodes) {
    const hit = all.find((c) => c && c.code === acts[k]);
    if (!hit) { reason = 'removed'; break; }
    if (isExpired(hit)) { reason = 'expired'; break; }
  }

  const was = keyState.expired;
  keyState = { expired: !!reason, reason, at: reason ? (keyState.at || new Date().toISOString()) : '' };
  if (reason && !was) toast(RENEW_TEXT[reason], 4500);
  renderKeyBlock();
  return keyState.expired;
}

function renderKeyBlock() {
  const box = $('key-expired-box');
  if (!box) return;
  const on = !!keyState.expired;
  box.classList.toggle('hidden', !on);
  if (!on) return;
  const t = $('key-expired-text');
  if (t) t.textContent = RENEW_TEXT[keyState.reason] || RENEW_TEXT.expired;
  const strip = $('plan-expiry-strip');
  if (strip) {
    strip.classList.remove('hidden');
    strip.classList.add('warn');
    const lbl = $('plan-expiry-label');
    if (lbl) lbl.textContent = 'expired - renew to continue';
  }
  renderServiceState();
}

/**
 * The single gate every streaming path goes through.
 *
 * There is no keyless mode: no key stored means no session, and an expired or
 * revoked key means no session either. Saved sessions are covered too, because
 * a dead key must not be a way to keep watching what was already downloaded.
 */
async function requireLiveKey(quiet) {
  const p = await getProfile();
  const acts = p.activations || {};
  if (!acts.access) {
    if (!quiet) toast('Activate a key to stream', 3200);
    return false;
  }
  if (keyState.expired) {
    if (!quiet) toast(RENEW_TEXT[keyState.reason] || RENEW_TEXT.expired, 4200);
    return false;
  }
  return true;
}

/**
 * The operator's space at the bottom of Home.
 *
 * Everything shown here comes from the Control Room. The extension supplies no
 * wording of its own: if the operator set a picture or a line, that is exactly
 * what appears, and if they set nothing the whole block stays hidden so Home
 * looks untouched.
 */
async function renderHomeSpace() {
  const box = $('home-space');
  if (!box) return;
  const p = await getProfile();
  if (!p.username) { box.hidden = true; return; }

  let card = null;
  try {
    const inbox = await fetchOperatorInbox();
    card = inbox.card || null;
  } catch (e) { card = null; }

  const img = $('home-space-img');
  const text = $('home-space-text');
  const text2 = (card && card.text) || '';

  if (img) {
    if (card && card.image) {
      img.src = card.image;
      img.hidden = false;
    } else {
      img.removeAttribute('src');
      img.hidden = true;
    }
  }
  if (text) {
    // textContent, never innerHTML: this string comes from a remote file.
    text.textContent = text2;
    text.hidden = !text2;
  }

  const hasImage = !!(card && card.image);
  box.hidden = !(hasImage || text2);
  if (!box.hidden && card) box.dataset.updatedAt = card.updatedAt || '';
}

function notifyWhen(iso) {
  const t = new Date(iso || 0).getTime();
  if (!isFinite(t) || !t) return '';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  if (days < 7) return days + 'd ago';
  return new Date(t).toLocaleDateString();
}

function formatTimeAgo(ts) {
  if (!ts) return 'Active session';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Saved just now';
  if (mins < 60) return 'Saved ' + mins + 'm ago';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return 'Saved ' + hours + 'h ago';
  const days = Math.floor(hours / 24);
  return 'Saved ' + days + 'd ago';
}

async function renderChips(key) {
  const row = $('saved-' + key);
  if (!row) return;
  row.innerHTML = '';
  const saved = await getSaved();
  const list = saved[key] || [];
  const p = await getProfile();
  // Re-enter needs a live key, not a particular plan: FREE users re-enter
  // through tryStream, PRO users through tryStreamSaved. Swap needs PRO.
  const hasKey = !!(p.activations && p.activations.access);
  const canManage = p.plan === 'active';
  const platformName = key === 'netflix' ? 'Netflix' : 'Prime';

  list.forEach((s, idx) => {
    const card = document.createElement('div');
    card.className = 'saved-account-card';
    const accNum = idx + 1;
    const fpShort = String(s.fingerprint || '').slice(0, 4).toUpperCase();
    const timeText = formatTimeAgo(s.savedAt);

    card.innerHTML = `
      <div class="saved-acc-left">
        <div class="acc-avatar">
          <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
        </div>
        <div class="acc-info">
          <div class="acc-title">Account #${accNum} <span class="acc-code">#${fpShort}</span></div>
          <div class="acc-meta">${timeText}</div>
        </div>
      </div>
      <div class="saved-acc-right">
        ${hasKey ? `<button class="acc-reenter-btn" title="Re-enter ${platformName}">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          <span>Re-enter</span>
        </button>` : ''}
        ${canManage ? `<button class="acc-del-btn" title="Remove account">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>` : ''}
      </div>
    `;

    const reenterBtn = card.querySelector('.acc-reenter-btn');
    if (reenterBtn) {
      reenterBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (canManage) await tryStreamSaved(key, s.fingerprint);
        else await tryStream(key); // FREE re-enters by re-checking the top slot
      });
    }

    const delBtn = card.querySelector('.acc-del-btn');
    if (delBtn) {
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await removeSaved(key, s.fingerprint);
        await renderChips(key);
        await updateCounts();
        renderSwapDesk().catch(() => {});
        toast('Account removed from Saved');
      });
    }

    row.appendChild(card);
  });

  const hint = $('empty-' + key);
  if (hint) hint.classList.toggle('hidden', list.length > 0);
}

/**
 * The swap desk: one deliberate place to ask for a replacement, instead of a
 * button competing with Re-enter on every account card.
 *
 * The picker is built by hand rather than using a native <select>. Chrome
 * extension popups are a cramped, overflow-managed surface and a native
 * dropdown there is unreliable, so the list is ordinary DOM that always shows.
 */
let SWAP_OPTIONS = [];
let SWAP_PICKED = '';

async function renderSwapDesk() {
  const label = $('swap-target-label');
  const list = $('swap-target-list');
  const desk = $('swap-desk');
  const btn = $('btn-swap-request');
  if (!label || !list || !desk) return;

  const p = await getProfile();
  const saved = await getSaved();
  const options = [];
  for (const key of PLATFORM_KEYS) {
    (saved[key] || []).forEach((s, i) => {
      const fpShort = String(s.fingerprint || '').slice(0, 4).toUpperCase();
      options.push({
        value: key + '|' + s.fingerprint,
        platform: key,
        fingerprint: s.fingerprint,
        label: (key === 'netflix' ? 'Netflix' : 'Prime') + ' #' + (i + 1),
        code: '#' + fpShort
      });
    });
  }

  SWAP_OPTIONS = options;
  if (!options.some((o) => o.value === SWAP_PICKED)) SWAP_PICKED = options.length ? options[0].value : '';

  // The list is open by default. Requiring a press to even see which accounts
  // can be swapped made the whole desk look broken.
  list.classList.remove('hidden');
  $('swap-target-btn').setAttribute('aria-expanded', 'true');

  const chosen = options.find((o) => o.value === SWAP_PICKED);
  label.textContent = chosen ? chosen.label + '  ' + chosen.code : 'No accounts saved';

  list.innerHTML = '';
  for (const o of options) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'swap-picker-row' + (o.value === SWAP_PICKED ? ' on' : '');
    row.setAttribute('role', 'option');
    const nm = document.createElement('span');
    nm.className = 'swap-picker-name';
    nm.textContent = o.label;
    const cd = document.createElement('span');
    cd.className = 'swap-picker-code';
    cd.textContent = o.code;
    row.appendChild(nm);
    row.appendChild(cd);
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      SWAP_PICKED = o.value;
      closeSwapPicker();
      renderSwapDesk().catch(() => {});
    });
    list.appendChild(row);
  }

  if (p.plan !== 'active') {
    desk.classList.add('locked');
    const note = $('swap-desk-note');
    if (note) {
      note.textContent = (p.activations && p.activations.access)
        ? 'Swap is a PRO feature. Your key is FREE right now.'
        : 'Activate a PRO key to use swap.';
    }
    if (btn) btn.disabled = true;
    if (!$('swap-target-btn').disabled) $('swap-target-btn').disabled = true;
    return;
  }

  desk.classList.remove('locked');
  if (btn) btn.disabled = options.length === 0;
  $('swap-target-btn').disabled = options.length === 0;
  const note = $('swap-desk-note');
  if (note) {
    note.textContent = options.length
      ? 'Pick the account that stopped working, then request the swap.'
      : 'Nothing saved yet, so there is nothing to swap.';
  }
}

function closeSwapPicker() {
  const list = $('swap-target-list');
  const btn = $('swap-target-btn');
  if (list) list.classList.add('hidden');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

$('swap-target-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  const list = $('swap-target-list');
  const btn = $('swap-target-btn');
  if (!list) return;
  const open = list.classList.contains('hidden');
  if (open) {
    renderSwapDesk().catch(() => {});
    list.classList.remove('hidden');
    btn.setAttribute('aria-expanded', 'true');
  } else {
    closeSwapPicker();
  }
});

// any click elsewhere in the popup closes the list
document.addEventListener('click', () => closeSwapPicker());

// The swap desk stays out of the way until the user actually has a problem.
// Nothing about swapping is advertised until they ask for it.
$('btn-swap-open').addEventListener('click', async (e) => {
  e.stopPropagation();
  const desk = $('swap-desk');
  const open = desk.hasAttribute('hidden');
  if (open) {
    desk.removeAttribute('hidden');
    $('btn-swap-open').setAttribute('aria-expanded', 'true');
    await renderSwapDesk().catch(() => {});
  } else {
    closeSwapDesk();
  }
});

function closeSwapDesk() {
  const desk = $('swap-desk');
  if (desk) desk.setAttribute('hidden', '');
  $('btn-swap-open').setAttribute('aria-expanded', 'false');
}

$('btn-swap-request').addEventListener('click', async (e) => {
  e.stopPropagation();
  const note = $('swap-desk-note');
  if (!SWAP_PICKED) { toast('Nothing to swap yet', 2500); return; }
  const btn = $('btn-swap-request');
  btn.disabled = true;
  const [key, fingerprint] = SWAP_PICKED.split('|');
  try {
    const res = await requestSwap(key, fingerprint, 'Account broke or locked - need fresh session');
    if (res && res.ok) {
      if (note) note.textContent = 'Request sent. The operator will approve it and a fresh account is applied automatically.';
      note.classList.remove('bad');
      setTimeout(closeSwapDesk, 1600);
    } else {
      if (note) {
        note.textContent = (res && res.reason) || 'Could not send the request.';
        note.classList.add('bad');
      }
    }
  } catch (e) {
    if (note) { note.textContent = 'Could not send the request (' + String((e && e.message) || e).slice(0, 70) + ')'; note.classList.add('bad'); }
  } finally {
    btn.disabled = false;
  }
});

async function renderSavedChips() {
  for (const key of PLATFORM_KEYS) await renderChips(key);
  await renderSwapDesk().catch(() => {});
}

async function tryStreamSaved(key, fingerprint) {
  if (STATE.streaming) return;
  // A saved session is worthless without a live key, so an expired key blocks
  // replaying one exactly as it blocks getting a new one.
  if (!(await requireLiveKey())) { renderServiceState(); return; }
  await updateCounts();
  const platformName = key === 'netflix' ? 'Netflix' : 'Prime';
  const saved = await getSaved();
  const entry = saved[key].find((s) => s.fingerprint === fingerprint);
  if (!entry) {
    toast('Session expired');
    await updateCounts();
    return;
  }
  STATE.streaming = true;
  showProgress(true, `Starting saved session...`, 20);
  const result = await runSession(key, entry.cookies);
  if (result.ok) {
    await chrome.storage.session.remove(PENDING_KEY);
    showProgress(false);
    STATE.streaming = false;
    pill('ok', platformName + ' Active');
    toast(`${platformName} launched!`);
    await activateTab(result.tabId);
  } else if (result.reason === 'dead') {
    await removeSaved(key, fingerprint);
    const banned = await loadBanned();
    if (!banned[key].includes(fingerprint)) banned[key].push(fingerprint);
    await chrome.storage.local.set({ [BANNED_KEY]: banned });
    STATE.banned = banned;
    reportDeadAccount(key, fingerprint).catch(() => {});
    showProgress(false);
    STATE.streaming = false;
    pill('err', 'Expired');
    toast('Session was expired and removed', 3000);
  } else {
    showProgress(false);
    STATE.streaming = false;
    pill('err', 'Failed');
    toast('Could not launch session', 3000);
  }
  await updateCounts();
}

// ---------------------------------------------------------------------------
// Views & Navigation Wiring
// ---------------------------------------------------------------------------
function showView(name) {
  for (const el of document.querySelectorAll('.view')) {
    el.classList.toggle('hidden', el.id !== 'view-' + name);
  }
  for (const b of document.querySelectorAll('.nav-btn')) {
    b.classList.toggle('active', b.dataset.view === name);
  }
  document.body.classList.toggle('onboarding', name === 'welcome');
  if (name === 'home') renderNotifications().catch(() => {});
}

function setCodeStatus(text, ok) {
  const st = $('code-status');
  if (!st) return;
  st.textContent = text;
  st.classList.toggle('ok', !!ok);
}

async function renderProfileView() {
  const p = await getProfile();
  const av = $('avatar');
  if (av) av.textContent = String(p.username || 'K').charAt(0).toUpperCase();
  const pn = $('p-name');
  if (pn) pn.textContent = p.username || '-';
  const ps = $('p-since');
  if (ps) {
    if (p.memberSince) {
      const d = new Date(p.memberSince);
      const options = { year: 'numeric', month: 'short', day: 'numeric' };
      const dateStr = isNaN(d.getTime()) ? 'Recently' : d.toLocaleDateString(undefined, options);
      ps.textContent = 'Member since ' + dateStr;
      ps.title = 'First entered: ' + (isNaN(d.getTime()) ? '' : d.toLocaleString());
    } else {
      ps.textContent = 'Member since today';
    }
  }
  const pp = $('p-plan');
  if (pp) pp.textContent = p.plan === 'active' ? 'PRO' : 'FREE';
}

const PLAN_BENEFITS = {
  inactive: ['Stream Netflix & Prime', '1 auto-managed session', 'No PRO memory', 'Enter a code to upgrade'],
  free: ['Stream Netflix & Prime', '1 saved session', 'Time-limited access', 'Upgrade to PRO any time'],
  active: ['Unlimited Netflix & Prime streaming', '3 saved sessions', 'Priority session pool', 'Re-enter and delete saved accounts', 'Swap a broken account instantly']
};

const PLAN_META = {
  inactive: { label: 'FREE', desc: 'No key yet', flag: 'FREE' },
  free: { label: 'FREE', desc: 'Key active - time limited', flag: 'FREE' },
  active: { label: 'PRO', desc: 'Everything unlocked', flag: 'PRO' }
};

/**
 * Keys the operator has sent but that have not been claimed yet.
 *
 * A granted key is already bound to this username in activation.json, so it is
 * found by filtering the codes the extension already downloads. No extra
 * request and no new endpoint needed.
 */
async function getWaitingKeys() {
  const p = await getProfile();
  if (!p.username) return [];
  let codes;
  try { codes = await fetchCodes(false); } catch (e) { return []; }
  if (!codes) return [];
  const all = Object.values(codes).reduce((a, l) => a.concat(l || []), []);
  return all.filter((c) => c && c.usedBy === p.username && !c.used
    && !(c.expiresAt && isExpired(c)));
}

async function renderWaitingKeys() {
  const box = $('waiting-keys');
  if (!box) return;
  let list = [];
  try { list = await getWaitingKeys(); } catch (e) { list = []; }
  if (!list.length) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }
  box.classList.remove('hidden');
  box.innerHTML = '';
  const head = document.createElement('p');
  head.className = 'waiting-head';
  head.textContent = list.length === 1
    ? 'The operator sent you a key:'
    : 'The operator sent you ' + list.length + ' keys:';
  box.appendChild(head);
  for (const c of list) {
    const row = document.createElement('div');
    row.className = 'waiting-row';
    const tier = tierOfEntry(c) || 'PRO';
    const when = c.permanent ? 'never expires' : timeLeftLabel(c.expiresAt);
    row.innerHTML = '<code></code><span class="waiting-tier"></span><span class="waiting-when"></span>'
      + '<button class="cute-btn xs"></button>';
    row.querySelector('code').textContent = c.code;
    row.querySelector('.waiting-tier').textContent = tier;
    row.querySelector('.waiting-when').textContent = when;
    const btn = row.querySelector('button');
    btn.textContent = 'Claim';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const input = $('code-input');
      if (input) input.value = c.code;
      try {
        await handleActivate();
      } catch (e) {
        btn.disabled = false;
      }
    });
    box.appendChild(row);
  }
}

/**
 * Home notifications.
 *
 * Two sources are merged into one list: keys the operator granted, and plain
 * messages they sent. Both are read from the data repo the extension already
 * talks to, and both are filtered to this username plus broadcasts, so a
 * personal message never shows up on somebody else's screen.
 */
/**
 * The operator's space and messages, fetched from the Control Room.
 *
 * This used to read user-cards.json and messages.json straight off GitHub,
 * which meant the browser needed a working repo token for something as passive
 * as showing a note. The server already holds that credential and is already
 * reachable, so it does the reading. Falls back to the direct file read if the
 * server is unreachable, so a Control Room outage does not blank the Home.
 */
async function fetchOperatorInbox() {
  const p = await getProfile();
  if (!p.username) return { card: null, messages: [] };

  const accessKey = (p.activations && p.activations.access) || '';
  if (accessKey) {
    try {
      const res = await fetch(CONTROL_ROOM + '/api/ops?action=inbox', {
        headers: { 'x-kizar-key': accessKey }
      });
      if (res.ok) {
        const j = await res.json();
        if (j && j.ok) return { card: j.card || null, messages: j.messages || [], via: 'server' };
      }
    } catch (e) { /* fall through to the file read */ }
  }

  // fallback: read the two files directly
  let card = null;
  try {
    const raw = await fetchFromGithub(GITHUB_CONFIG.cards);
    const data = JSON.parse(raw || '{}') || {};
    const cards = data.cards || {};
    const me = p.username.toLowerCase();
    const key = Object.keys(cards).find((u) => u.toLowerCase() === me);
    card = key ? cards[key] : null;
  } catch (e) { card = null; }

  let messages = [];
  try {
    const raw = await fetchFromGithub(GITHUB_CONFIG.messages);
    const data = JSON.parse(raw || '{}') || {};
    const me = p.username.toLowerCase();
    messages = (Array.isArray(data.messages) ? data.messages : [])
      .filter((m) => m && (m.username === '*' || String(m.username || '').toLowerCase() === me));
  } catch (e) { messages = []; }

  return { card, messages, via: 'file' };
}

async function getInbox() {
  const p = await getProfile();
  if (!p.username) return { notes: [], unread: 0 };
  const me = p.username.toLowerCase();

  let inbox = { card: null, messages: [] };
  try { inbox = await fetchOperatorInbox(); } catch (e) { inbox = { card: null, messages: [] }; }

  const notes = [];

  // key gifts
  let gifts = [];
  try { gifts = await getWaitingKeys(); } catch (e) { gifts = []; }
  for (const c of gifts) {
    const tier = tierOfEntry(c) || 'PRO';
    notes.push({
      id: 'gift:' + c.code,
      kind: 'gift',
      title: 'Key gift: ' + tier,
      body: c.permanent ? 'Never expires' : timeLeftLabel(c.expiresAt),
      code: c.code,
      at: c.grantedAt || c.createdAt || '',
      ts: new Date(c.grantedAt || c.createdAt || 0).getTime() || 0
    });
  }

  for (const m of inbox.messages || []) {
    notes.push({
      id: 'msg:' + m.id,
      kind: m.kind === 'alert' ? 'alert' : (m.kind === 'reward' ? 'gift' : 'notice'),
      title: m.username === '*' ? 'From the operator' : 'A message for you',
      body: String(m.text || ''),
      at: m.at || '',
      ts: new Date(m.at || 0).getTime() || 0
    });
  }

  notes.sort((a, b) => b.ts - a.ts);

  const store = await chrome.storage.local.get(NOTIFY_SEEN_KEY).catch(() => ({}));
  const seenAt = Number(store[NOTIFY_SEEN_KEY]) || 0;
  const unread = notes.filter((n) => n.ts > seenAt).length;
  void me;
  return { notes, unread, seenAt };
}

async function markNotificationsSeen() {
  const box = await getInbox().catch(() => ({ notes: [] }));
  const newest = box.notes.reduce((m, n) => Math.max(m, n.ts || 0), 0);
  await chrome.storage.local.set({ [NOTIFY_SEEN_KEY]: newest || Date.now() });
  await renderNotifications();
}

async function renderNotifications() {
  const bar = $('notify-bar');
  if (!bar) return;
  let box = { notes: [], unread: 0 };
  try { box = await getInbox(); } catch (e) { box = { notes: [], unread: 0 }; }
  INBOX = box.notes;

  const count = $('notify-count');
  const label = $('notify-label');
  // The bell is always there. Hiding it meant a user could not tell whether
  // they had simply missed something.
  bar.classList.remove('hidden');
  if (count) {
    if (box.unread > 0) { count.textContent = box.unread > 9 ? '9+' : String(box.unread); count.classList.remove('hidden'); }
    else count.classList.add('hidden');
  }
  if (label) label.textContent = box.unread > 0 ? box.unread + ' unread notifications' : 'No unread notifications';

  const list = $('notify-list');
  if (!list) return;
  if (list.classList.contains('hidden')) return; // collapsed, leave it alone

  list.innerHTML = '';
  if (!box.notes.length) {
    const empty = document.createElement('p');
    empty.className = 'notify-empty';
    empty.textContent = 'Nothing yet.';
    list.appendChild(empty);
    return;
  }
  for (const n of box.notes.slice(0, 20)) {
    const row = document.createElement('div');
    row.className = 'notify-row ' + n.kind;
    const head = document.createElement('div');
    head.className = 'notify-head';
    const t = document.createElement('span');
    t.className = 'notify-title';
    t.textContent = n.title;
    head.appendChild(t);
    if (n.at) {
      const when = document.createElement('span');
      when.className = 'notify-when';
      when.textContent = notifyWhen(n.at);
      head.appendChild(when);
    }
    row.appendChild(head);
    const b = document.createElement('div');
    b.className = 'notify-body';
    b.textContent = n.body;
    row.appendChild(b);
    if (n.code) {
      const btn = document.createElement('button');
      btn.className = 'cute-btn xs';
      btn.textContent = 'Claim key';
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const input = $('code-input');
        if (input) input.value = n.code;
        try { await handleActivate(); } catch (e) { btn.disabled = false; }
      });
      row.appendChild(btn);
    }
    list.appendChild(row);
  }
}

function wireNotifications() {
  const btn = $('btn-notify');
  const list = $('notify-list');
  if (btn && !btn.dataset.wired) {
    btn.dataset.wired = '1';
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!list) return;
      const open = list.classList.contains('hidden');
      if (open) {
        list.classList.remove('hidden');
        btn.setAttribute('aria-expanded', 'true');
        await markNotificationsSeen();
        await renderNotifications();
      } else {
        list.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }
}

async function renderPlanView() {
  const p = await getProfile();
  const isActive = p.plan === 'active';
  const meta = PLAN_META[p.plan] || PLAN_META.inactive;
  const items = PLAN_BENEFITS[p.plan] || PLAN_BENEFITS.inactive;

  const mp = $('m-plan');
  if (mp) mp.textContent = meta.label;

  const md = $('m-desc');
  if (md) md.textContent = meta.desc;

  const flag = document.querySelector('.member-flag');
  if (flag) flag.textContent = meta.flag;

  const card = $('member-card');
  if (card) {
    card.classList.remove('active', 'inactive', 'free');
    card.classList.add(p.plan === 'active' ? 'active' : p.plan === 'free' ? 'free' : 'inactive');
  }

  const mb = $('m-benefits');
  if (mb) {
    mb.innerHTML = '';
    for (const item of items) {
      const li = document.createElement('li');
      li.textContent = item;
      mb.appendChild(li);
    }
  }

  const strip = $('plan-expiry-strip');
  if (strip) {
    const acts = p.activations || {};
    const code = acts.access || '';
    if (code && isActive !== null) {
      let expiresAt = '';
      let left = '';
      try {
        const codes = await fetchCodes(false);
        if (codes) {
          const all = Object.values(codes).reduce((a, l) => a.concat(l || []), []);
          const hit = all.find((c) => c.code === code);
          if (hit) {
            expiresAt = hit.expiresAt || '';
            left = hit.permanent ? 'never expires' : timeLeftLabel(expiresAt);
          }
        }
      } catch (e) {}
      strip.classList.remove('hidden');
      const lbl = $('plan-expiry-label');
      if (lbl) lbl.textContent = left ? left : 'active';
      strip.classList.toggle('warn', !!expiresAt && !left.includes('never'));
    } else {
      strip.classList.add('hidden');
    }
  }

  // Keys the operator sent that have not been claimed yet.
  try { await renderWaitingKeys(); } catch (e) {}
}

async function finishSignup(uname, activations, tier) {
  await setProfile(uname, activations || {}, new Date().toISOString(), tier || '');
  await refresh();
  showView('home');
  await renderProfileView();
  await renderPlanView();
  await updateCounts();
  const ok = await ensureRegistered();
  if (!ok) toast('Registered locally - server sync will retry', 3000);
}

function activationMessage(reason, detail) {
  const map = {
    empty: ['Enter your activation key'],
    key: ['Server key missing - reinstall the extension'],
    auth: ['Server rejected the request (token)'],
    ratelimit: ['GitHub rate limit hit - try again in a minute'],
    notfound: ['activation.json not found on the server'],
    invalid: ['Key not recognised'],
    used: ['Key already used'],
    expired: ['Key has expired'],
    offline: ['Network error' + (detail ? ' (' + detail + ')' : '')],
    write_failed: ['Could not save - try again']
  };
  return (map[reason] || ['Could not activate'])[0];
}

async function saveWelcome() {
  const uname = ($('wel-username').value || '').trim();
  const raw = ($('wel-code').value || '').trim();
  const err = $('wel-err');
  const fail = (msg) => { if (err) err.textContent = msg || ''; };

  if (uname.length < 2) { fail('Enter a username'); try { $('wel-username').focus(); } catch (e) {} return; }
  if (!raw) { fail('Enter your activation key'); try { $('wel-code').focus(); } catch (e) {} return; }
  fail('');

  const btn = $('btn-welcome');
  if (btn) btn.disabled = true;
  try {
    const res = await activateCode(raw);
    if (!res.ok) {
      fail(activationMessage(res.reason, res.detail));
      return;
    }
    $('wel-code').value = '';
    await finishSignup(uname, { access: res.code || normalizeCode(raw) }, res.tier);
    const left = res.expiresAt ? timeLeftLabel(res.expiresAt) : '';
    toast(
      (res.tier === 'FREE' ? 'FREE access active' : 'PRO active')
      + (left && left !== 'expired' ? ' · ' + left : ''),
      4000
    );
  } finally {
    if (btn) btn.disabled = false;
  }
}

function openNameEdit() {
  const pn = $('p-name');
  const pe = $('p-name-edit');
  const ni = $('name-input');
  if (!pn || !pe || !ni) return;
  ni.value = pn.textContent;
  pn.classList.add('hidden');
  pe.classList.remove('hidden');
  try { ni.focus(); } catch (e) {}
}

async function saveName() {
  const ni = $('name-input');
  const uname = (ni ? ni.value : '').trim();
  if (uname.length < 2) {
    toast('Min 2 characters', 2000);
    return;
  }
  const cur = await getProfile();
  await setProfile(uname, cur.activations, cur.memberSince);
  const pn = $('p-name');
  const pe = $('p-name-edit');
  if (pn) pn.classList.remove('hidden');
  if (pe) pe.classList.add('hidden');
  await renderProfileView();
  toast('Updated!');
  ensureRegistered().catch(() => {});
}

async function handleActivate() {
  const btn = $('btn-activate');
  if (btn) btn.disabled = true;
  try {
    const code = ($('code-input').value || '').trim();
    const res = await activateCode(code);
    const msgs = {
      empty: ['Enter code', false],
      key: ['Unavailable', false],
      auth: ['Server rejected the request', false],
      ratelimit: ['Rate limited - try in a minute', false],
      notfound: ['Server file missing', false],
      invalid: ['Invalid code', false],
      used: ['Code already used', false],
      expired: ['This code has expired', false],
      offline: ['Network error' + (res.detail ? ' (' + res.detail + ')' : ''), false],
      write_failed: ['Failed to save', false]
    };
    if (res.ok) {
      $('code-input').value = '';
      const tier = res.tier || 'PRO';
      const left = res.expiresAt ? timeLeftLabel(res.expiresAt) : '';
      setCodeStatus(
        (tier === 'FREE' ? 'FREE access activated' : 'PRO activated') + (left && left !== 'expired' ? ' - ' + left : ''),
        true
      );
      await renderPlanView();
      await renderProfileView();
      await updateCounts();
      await refresh();
      toast(tier === 'FREE' ? 'FREE access unlocked' : 'PRO unlocked');
    } else {
      const msg = msgs[res.reason] || ['Could not activate', false];
      setCodeStatus(msg[0], msg[1]);
      toast(msg[0]);
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Operator dashboard reporting & IP ban enforcement
// ---------------------------------------------------------------------------
const IP_SERVICES = ['https://api.ipify.org?format=json', 'https://icanhazip.com'];
const IP_TTL = 5 * 60 * 1000;
const USAGE_WRITE_MIN = 30000;

let banTimer = null;
let usageDeltas = { opens: 0, netflixSessions: 0, primeSessions: 0 };
let lastUsageWrite = 0;
let usageFlushTimer = null;

function getSavedIp() {
  try {
    const raw = localStorage.getItem('kz_ip');
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (j && j.ip && typeof j.at === 'number' && Date.now() - j.at < IP_TTL) return j.ip;
  } catch (e) {}
  return null;
}

function saveIp(ip) {
  try {
    localStorage.setItem('kz_ip', JSON.stringify({ ip, at: Date.now() }));
  } catch (e) {}
}

async function detectIp() {
  const cached = getSavedIp();
  for (const svc of IP_SERVICES) {
    try {
      const res = await fetch(svc);
      if (!res.ok) continue;
      const text = (await res.text()).trim();
      let ip = text;
      if (text.charAt(0) === '{') {
        try { ip = (JSON.parse(text).ip || '').trim(); } catch (e2) { ip = ''; }
      }
      if (/^[\d.:a-fA-F]+$/.test(ip) && /\d/.test(ip)) {
        saveIp(ip);
        return ip;
      }
    } catch (e) {}
  }
  return cached || null;
}

async function readBanList() {
  try {
    return JSON.parse((await fetchFromGithub(GITHUB_CONFIG.banned)) || '{}') || {};
  } catch (e) {
    return {};
  }
}

function ipIsBanned(banList, ip) {
  if (!ip) return false;
  if (banList[ip]) return true;
  if (Array.isArray(banList.list)) {
    return banList.list.some((b) => {
      if (typeof b === 'string') return b === ip;
      return b && b.ip === ip;
    });
  }
  return false;
}

function collectBanRecords(banList, ip, usernameValue) {
  const out = [];
  const push = (key, target) => {
    const rec = banList[key];
    if (!rec) return;
    const kind = key.indexOf('user:') === 0 ? 'user' : 'ip';
    out.push({
      kind,
      target: target || key,
      reason: (rec && typeof rec === 'object' && rec.reason) || '',
      bannedAt: (rec && typeof rec === 'object' && rec.bannedAt) || ''
    });
  };
  if (ip) push(ip, ip);
  if (usernameValue) push('user:' + usernameValue, usernameValue);
  if (Array.isArray(banList.list)) {
    banList.list.forEach((b) => {
      if (typeof b === 'string') push(b, b);
      else if (b && b.ip) push(b.ip, b.ip);
      else if (b && b.username) push('user:' + b.username, b.username);
    });
  }
  return out;
}

function showBanOverlay(rec) {
  const ov = $('ban-overlay');
  if (ov) ov.classList.remove('hidden');
  const r = $('ban-reason');
  if (r) {
    r.textContent = rec.reason
      ? 'Reason: ' + rec.reason
      : (rec.kind === 'user' ? 'This username is blocked by the operator.' : 'Your access was removed by the operator.');
  }
  const s = $('ban-since');
  if (s) s.textContent = rec.bannedAt
    ? 'Banned since ' + new Date(rec.bannedAt).toLocaleString()
    : (rec.kind === 'user' ? 'Blocked by username' : 'Banned by the operator');
  STATE.bannedByOperator = true;
}

function hideBanOverlay() {
  const ov = $('ban-overlay');
  if (ov) ov.classList.add('hidden');
  STATE.bannedByOperator = false;
}

async function ensureDashboardFiles() {
  const tk = await getOwnerToken();
  if (!tk) return;
  for (const f of [GITHUB_CONFIG.users, GITHUB_CONFIG.banned, GITHUB_CONFIG.dead, GITHUB_CONFIG.requests]) {
    try {
      const meta = await githubJson(f);
      if (!meta || !meta.content) continue;
    } catch (e) {
      if (String(e.message || '').indexOf('404') < 0) continue;
      try {
        const init = f === GITHUB_CONFIG.banned ? '{ }' : f === GITHUB_CONFIG.dead ? '{"netflix":[],"prime":[]}' : '{}';
        const body = {
          message: 'create ' + f,
          content: utf8ToB64(init)
        };
        await fetch('https://api.github.com/repos/' + GITHUB_CONFIG.owner + '/' + GITHUB_CONFIG.repo + '/contents/' + f, {
          method: 'PUT',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: 'token ' + tk,
            'User-Agent': 'kizar-stream',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });
      } catch (e2) {}
    }
  }
}

async function putGithubJson(path, content, sha) {
  const tk = await getOwnerToken();
  if (!tk) throw new Error('Key needed');
  const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: 'token ' + tk,
    'User-Agent': 'kizar-stream',
    'Content-Type': 'application/json'
  };
  const put = (useSha) => {
    const body = { message: 'usage report', content: utf8ToB64(content) };
    if (useSha) body.sha = useSha;
    return fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
  };

  let res = await put(sha);

  // 422 "sha wasn't supplied" means the file exists but the caller had no sha,
  // which happens whenever the read before the write came back empty. That is
  // the most common way a write from here fails, and it looks identical to a
  // real error unless the response body is read.
  if (res.status === 422) {
    const text = await res.text().catch(() => '');
    if (/sha/i.test(text)) {
      const fresh = await githubJson(path).catch(() => null);
      if (fresh && fresh.sha) res = await put(fresh.sha);
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text.slice(0, 180);
    try { const j = JSON.parse(text); if (j && j.message) detail = j.message; } catch (e) {}
    throw new Error('HTTP ' + res.status + (detail ? ' - ' + detail : ''));
  }
  return await res.json();
}

async function mergeUserRow(delta) {
  const tk = await getOwnerToken();
  if (!tk) return false;
  const path = GITHUB_CONFIG.users;
  for (let attempt = 0; attempt < 4; attempt++) {
    let meta = null;
    try {
      meta = await githubJson(path);
    } catch (e) {
      meta = null;
    }
    let data = {};
    if (meta && meta.content) {
      try { data = JSON.parse(b64utf8(meta.content)); } catch (e) { data = {}; }
    }
    const prev = (data[delta.username] && typeof data[delta.username] === 'object') ? data[delta.username] : {};
    const now = new Date().toISOString();
    const row = {
      username: delta.username,
      ip: delta.ip || prev.ip || '',
      device: prev.device || '',
      plan: delta.plan || prev.plan || 'FREE',
      opens: (prev.opens || 0) + (delta.opens || 0),
      netflixSessions: (prev.netflixSessions || 0) + (delta.netflixSessions || 0),
      primeSessions: (prev.primeSessions || 0) + (delta.primeSessions || 0),
      firstSeen: prev.firstSeen || now,
      lastSeen: now
    };
    data[delta.username] = row;
    try {
      await putGithubJson(path, JSON.stringify(data, null, 2), meta ? meta.sha : undefined);
      return true;
    } catch (e) {
      if (String(e.message || '').indexOf('409') < 0) return false;
    }
  }
  return false;
}

function bumpUsage(delta) {
  if (STATE.bannedByOperator) return;
  for (const k of Object.keys(delta)) {
    if (usageDeltas[k] === undefined) usageDeltas[k] = 0;
    usageDeltas[k] += delta[k];
  }
  clearTimeout(usageFlushTimer);
  usageFlushTimer = setTimeout(() => flushUsage().catch(() => {}), 1500);
}

let serviceState = { cookiesEnabled: true, message: '' };
let userDisabled = false;

async function loadServiceFlags() {
  const p = await getProfile();
  let svc = { cookiesEnabled: true, message: '' };
  try {
    const raw = await fetchFromGithub(GITHUB_CONFIG.settings);
    const j = JSON.parse(raw || '{}') || {};
    const s = j.service || {};
    svc = {
      cookiesEnabled: s.cookiesEnabled === undefined ? true : !!s.cookiesEnabled,
      message: typeof s.message === 'string' ? s.message : ''
    };
  } catch (e) {}

  let disabled = false;
  let tampered = false;
  try {
    const data = JSON.parse((await fetchFromGithub(GITHUB_CONFIG.users)) || '{}') || {};
    const row = data[p.username] || (Array.isArray(data) ? data.find((r) => r && r.username === p.username) : null);
    disabled = !!(row && row.disabled);
    tampered = !!(row && row.tampered);
  } catch (e) {}

  serviceState = svc;
  userDisabled = disabled;
  STATE.tampered = tampered;
  renderServiceState();
  return { blocked: !svc.cookiesEnabled || disabled, svc, disabled, tampered };
}

function renderServiceState() {
  const off = !serviceState.cookiesEnabled;
  const pill = $('status-pill');
  const txt = $('status-text');
  if (versionState.blocked) {
    if (pill) pill.className = 'status-pill err';
    if (txt) txt.textContent = 'Update needed';
  } else if (STATE.tampered) {
    if (pill) pill.className = 'status-pill err';
    if (txt) txt.textContent = 'Blocked';
  } else if (off) {
    if (pill) pill.className = 'status-pill err';
    if (txt) txt.textContent = 'Paused';
  } else if (userDisabled) {
    if (pill) pill.className = 'status-pill err';
    if (txt) txt.textContent = 'Disabled';
  }

  const box = $('service-box');
  if (box) {
    if (off || userDisabled || STATE.tampered) {
      box.classList.remove('hidden');
      const t = $('service-text');
      if (t) {
        t.textContent = STATE.tampered
          ? 'This build is not allowed. Reinstall the original extension.'
          : userDisabled
            ? 'Your access is turned off. Contact support.'
            : (serviceState.message || 'Streaming is paused by the operator right now.');
      }
    } else {
      box.classList.add('hidden');
    }
  }

  const hardBlocked = off || userDisabled || STATE.tampered || versionState.blocked;
  if (hardBlocked) {
    const b = $('btn-stream-netflix');
    const b2 = $('btn-stream-prime');
    if (b) b.disabled = true;
    if (b2) b2.disabled = true;
  }
}

function isStreamingBlocked() {
  return !serviceState.cookiesEnabled || userDisabled || !!STATE.tampered || versionState.blocked || !!keyState.expired;
}

const APP_VERSION = (chrome.runtime && chrome.runtime.getManifest && chrome.runtime.getManifest().version) || '0.0.0';

let versionState = { blocked: false, latest: APP_VERSION, minVersion: '0.0.0', url: '', notes: '' };

function cmpVersion(a, b) {
  const pa = String(a || '0').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '0').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

// The operator controls this from the Control Room (Security tab). It is a
// switch, not an updater: raising minVersion freezes every older build, and
// lowering it lets them back in. There is no download path on purpose.
async function loadVersionGate() {
  let cfg = {};
  try {
    const res = await fetch(CONTROL_ROOM + '/api/ops?action=version');
    if (res.ok) {
      const j = await res.json();
      cfg = (j && j.version) || {};
    }
  } catch (e) {
    cfg = {};
  }
  const min = String(cfg.minVersion || '0.0.0');
  const notes = String(cfg.notes || '');
  const blocked = cmpVersion(APP_VERSION, min) < 0;
  versionState = { blocked, latest: APP_VERSION, minVersion: min, url: '', notes };

  const box = $('version-box');
  if (box) {
    if (blocked) {
      box.classList.remove('hidden');
      const t = $('version-text');
      if (t) {
        t.textContent = 'Paused by the operator - this build (v' + APP_VERSION + ') is held back'
          + (notes ? '. ' + notes : '');
      }
    } else {
      box.classList.add('hidden');
    }
  }
  renderServiceState();
  return versionState;
}

// No update channel by design. The installed build is the only build: the
// Control Room is the single source of truth for service state, so there is
// nothing to poll, download or auto-install from.
let remoteConfig = {};

async function loadRemoteConfig() {
  try {
    const res = await fetch(CONTROL_ROOM + '/api/ops?action=config');
    if (!res.ok) return;
    const data = await res.json();
    remoteConfig = (data && data.config) || {};
    if (remoteConfig.maintenance) {
      pill('err', 'Maintenance');
    }
  } catch (e) {}
}

function renderBuildFingerprint() {
  const el = $('build-fp');
  if (!el) return;
  computeIntegrityFingerprint().then((fp) => {
    el.textContent = fp ? 'v' + APP_VERSION + ' · ' + fp.slice(0, 16) : 'unavailable';
  }).catch(() => {
    el.textContent = 'v' + APP_VERSION + ' · unavailable';
  });
}

$('btn-copy-fp').addEventListener('click', async (e) => {
  e.stopPropagation();
  const fp = await computeIntegrityFingerprint().catch(() => '');
  if (!fp) { toast('Fingerprint unavailable', 2500); return; }
  try {
    await navigator.clipboard.writeText(fp);
    toast('Build fingerprint copied', 2500);
  } catch (err) {
    toast('Copy failed - select the text manually', 3000);
  }
});

let loyaltyState = null;

async function loadLoyalty() {
  const p = await getProfile();
  if (!p.username) return;
  try {
    const res = await fetch(CONTROL_ROOM + '/api/loyalty?mine=1&username=' + encodeURIComponent(p.username));
    if (!res.ok) return;
    const data = await res.json();
    loyaltyState = data.loyalty || null;
    renderLoyalty();
  } catch (e) {
    const n = $('loyalty-next');
    if (n) n.textContent = 'Loyalty needs a connection';
  }
}

async function checkLoyaltyReward() {
  const btn = $('btn-loyalty-check');
  const p = await getProfile();
  if (!p.username) { toast('Save your name first', 2500); return; }
  // The claim mints a real activation key, so the server authorises it with
  // the user's own key rather than the operator's panel password.
  const key = (p.activations && (p.activations.access || '')) || '';
  if (!key) { toast('Activate with a key first', 2800); return; }
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(CONTROL_ROOM + '/api/loyalty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-kizar-key': key },
      body: JSON.stringify({ username: p.username, key })
    });
    if (!res.ok) {
      let msg = 'Could not reach the server';
      try {
        const j = await res.json();
        if (j && j.error) msg = j.error;
      } catch (e) {}
      toast(msg, 3000);
      return;
    }
    const data = await res.json();
    loyaltyState = data.loyalty || loyaltyState;
    renderLoyalty();
    if (data.reward && data.reward.code) {
      const codeEl = $('loyalty-reward');
      if (codeEl) {
        codeEl.classList.remove('hidden');
        codeEl.classList.add('won');
        const t = $('loyalty-reward-text');
        if (t) t.textContent = 'Reward! ' + data.reward.code + ' - free for ' + data.reward.minutes + ' min';
        const b = $('btn-loyalty-check');
        if (b) { b.textContent = 'Copy'; b.disabled = false; b.dataset.reward = data.reward.code; }
      }
      toast('You won a ' + data.reward.minutes + ' minute code!', 4000);
    } else {
      toast('No reward this time - keep going', 2500);
    }
  } catch (e) {
    toast('Could not reach the server', 3000);
  } finally {
    if (btn && !btn.dataset.reward) btn.disabled = false;
  }
}

function renderLoyalty() {
  const l = loyaltyState;
  if (!l) return;
  const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
  set('loyalty-coin', l.coin || '🌱');
  set('loyalty-tier', l.tier || 'Newcomer');
  set('loyalty-rank', l.next ? 'Rank ' + ((l.tierIndex || 0) + 1) + ' of 5' : 'Top rank');
  set('loyalty-xp', (l.xp || 0) + ' XP');
  set('loyalty-streak', l.streak || 0);
  set('loyalty-sessions', l.sessions || 0);
  set('loyalty-days', l.daysInstalled || 0);

  const fill = $('loyalty-fill');
  if (fill) {
    fill.style.width = Math.max(2, Math.min(100, l.progress || 0)) + '%';
    const idx = l.tierIndex || 0;
    fill.className = 'loyalty-fill t' + Math.min(idx, 4);
  }
  const next = $('loyalty-next');
  if (next) {
    next.textContent = l.next
      ? (l.toNext || 0) + ' XP to ' + l.next
      : 'Top rank reached. Thank you for sticking with us.';
  }
}

$('btn-loyalty-check').addEventListener('click', async (e) => {
  e.stopPropagation();
  const btn = $('btn-loyalty-check');
  if (btn && btn.dataset.reward) {
    try {
      await navigator.clipboard.writeText(btn.dataset.reward);
      toast('Reward code copied', 2500);
    } catch (err) {
      toast('Copy failed', 2500);
    }
    return;
  }
  await checkLoyaltyReward();
});

let registerAttempts = 0;

const CONTROL_ROOM = 'https://kizar-control-room.vercel.app';

// Build integrity. Hashes the source of the functions that decide access, plus
// the config they depend on. Editing any of them changes the hash, and the
// backend refuses to trust a build that does not match the registered one.
// Names are referenced directly (lexical scope) so this works whether a guarded
// function is declared with `function` or with `const`.
let _integrityFp = '';

async function computeIntegrityFingerprint() {
  if (_integrityFp) return _integrityFp;
  const src = (fn) => {
    try { return String(fn); } catch (e) { return 'unreadable'; }
  };
  const guarded = [
    'derivePlan=' + src(derivePlan),
    'tierOfCode=' + src(tierOfCode),
    'tierOfEntry=' + src(tierOfEntry),
    'isExpired=' + src(isExpired),
    'parseDuration=' + src(parseDuration),
    'activateCode=' + src(activateCode),
    'writeCodesToGithub=' + src(writeCodesToGithub),
    'validateStoredCode=' + src(validateStoredCode),
    'mergeUserRow=' + src(mergeUserRow),
    'registerSelf=' + src(registerSelf),
    'ensureRegistered=' + src(ensureRegistered),
    'loadServiceFlags=' + src(loadServiceFlags),
    'isStreamingBlocked=' + src(isStreamingBlocked),
    'loadVersionGate=' + src(loadVersionGate),
    'tryStream=' + src(tryStream),
    'runSession=' + src(runSession)
  ];
  guarded.push('version=' + APP_VERSION);
  guarded.push('repo=' + GITHUB_CONFIG.owner + '/' + GITHUB_CONFIG.repo);
  guarded.push('room=' + CONTROL_ROOM);
  guarded.push('limits=' + JSON.stringify(PLAN_LIMITS));

  let hex = '';
  try {
    const buf = new TextEncoder().encode(guarded.join('\n'));
    const dig = await crypto.subtle.digest('SHA-256', buf);
    hex = Array.from(new Uint8Array(dig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    hex = '';
  }
  _integrityFp = hex;
  return hex;
}

async function registerViaControlRoom() {
  const p = await getProfile();
  if (!p || !p.username) return false;
  try {
    const ip = (await detectIp().catch(() => '')) || '';
    const fp = await computeIntegrityFingerprint().catch(() => '');
    const res = await fetch(CONTROL_ROOM + '/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'register',
        username: p.username,
        ip,
        opens: 1,
        netflixSessions: 0,
        primeSessions: 0,
        fp
      })
    });
    if (!res.ok) return false;
    let out = null;
    try { out = await res.json(); } catch (e) { out = null; }
    if (out && out.integrity && out.integrity.banned) {
      STATE.tampered = true;
      toast('This build is not allowed', 4000);
      return true;
    }
    try { await chrome.storage.local.set({ [REGISTERED_KEY]: Date.now() }); } catch (e) {}
    return true;
  } catch (e) {
    return false;
  }
}

async function registerSelf() {
  const p = await getProfile();
  if (!p || !p.username) return false;
  if (STATE.bannedByOperator) return false;
  registerAttempts++;
  let ip = '';
  try { ip = (await detectIp()) || ''; } catch (e) { ip = ''; }
  try {
    const ok = await mergeUserRow({
      username: p.username,
      ip,
      plan: p.plan === 'active' ? 'PRO' : 'FREE',
      opens: 1,
      netflixSessions: 0,
      primeSessions: 0
    });
    if (ok) {
      registerAttempts = 0;
      try { await chrome.storage.local.set({ [REGISTERED_KEY]: Date.now() }); } catch (e) {}
    }
    return ok;
  } catch (e) {
    console.error('[kizar] registerSelf failed', e);
    return false;
  }
}

async function ensureRegistered() {
  for (let i = 0; i < 3; i++) {
    let ok = false;
    try { ok = await registerSelf(); } catch (e) { ok = false; }
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  try { if (await registerViaControlRoom()) return true; } catch (e) {}
  console.error('[kizar] user registration failed after all attempts');
  return false;
}

async function flushUsage() {
  if (STATE.bannedByOperator) return;
  const p = await getProfile();
  if (!p || !p.username) return;
  const hasAny = Object.keys(usageDeltas).some((k) => usageDeltas[k] > 0);
  if (!hasAny || Date.now() - lastUsageWrite < USAGE_WRITE_MIN) return;
  const deltas = Object.assign({}, usageDeltas);
  usageDeltas = { opens: 0, netflixSessions: 0, primeSessions: 0 };
  try {
    const ip = await detectIp();
    const ok = await mergeUserRow({
      username: p.username,
      ip: ip || '',
      plan: p.plan === 'active' ? 'PRO' : 'FREE',
      opens: deltas.opens || 0,
      netflixSessions: deltas.netflixSessions || 0,
      primeSessions: deltas.primeSessions || 0
    });
    if (ok) lastUsageWrite = Date.now();
  } catch (e) {
    usageDeltas.opens += deltas.opens || 0;
    usageDeltas.netflixSessions += deltas.netflixSessions || 0;
    usageDeltas.primeSessions += deltas.primeSessions || 0;
  }
}

async function checkAndEnforceBan() {
  if (banTimer) { clearTimeout(banTimer); banTimer = null; }
  try {
    const [banList, ip] = await Promise.all([readBanList(), detectIp()]);
    const p = await getProfile();
    const records = collectBanRecords(banList, ip, p.username);
    if (records.length) {
      showBanOverlay(records[0]);
    } else {
      hideBanOverlay();
      if (ip && !STATE.bannedByOperator) {
        ensureDashboardFiles().catch(() => {});
      }
    }
    onBanCheck(banList);
  } catch (e) {}
  banTimer = setTimeout(() => { checkAndEnforceBan().catch(() => {}); }, 60000);
}

// ---------------------------------------------------------------------------
// Event Listeners
// ---------------------------------------------------------------------------
$('btn-refresh').addEventListener('click', () => refresh());
$('btn-unban').addEventListener('click', async function () {
  const btn = this;
  if (!btn._armed) {
    btn._armed = true;
    btn.textContent = 'Tap again to confirm';
    btn.classList.add('danger-arm');
    toast('Your account is deleted and your key is released - this cannot be undone', 3600);
    setTimeout(() => {
      btn._armed = false;
      btn.textContent = 'Reset app';
      btn.classList.remove('danger-arm');
    }, 4000);
    return;
  }
  btn._armed = false;
  btn.textContent = 'Reset app';
  btn.classList.remove('danger-arm');

  // Delete the account on the server first, while the key is still in hand.
  // Otherwise the row stays in the Control Room and the username is never free.
  const p = await getProfile();
  const accessKey = (p.activations && p.activations.access) || '';
  let released = false;
  if (accessKey && p.username) {
    try {
      const res = await fetch(CONTROL_ROOM + '/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-kizar-key': accessKey },
        body: JSON.stringify({ action: 'release', username: p.username, key: accessKey })
      });
      released = res.ok;
    } catch (e) { released = false; }
  }

  await clearBanned();
  await clearSavedSessions();
  await chrome.storage.local.remove(PROFILE_KEY);
  try { await chrome.storage.session.remove(PENDING_KEY); } catch (e) {}
  STATE.codes = null;
  STATE.codesReady = false;
  STATE.sessions = { netflix: [], prime: [] };
  STATE.streaming = false;
  toast(released
    ? 'Account deleted - your name is free again'
    : 'Reset done - the server could not be reached, ask the operator to remove it', 4000);
  await refresh();
  showView('welcome');
  document.body.classList.add('onboarding');
  try { $('wel-username').focus(); } catch (e) {}
});
$('btn-stream-netflix').addEventListener('click', () => tryStream('netflix'));
$('btn-stream-prime').addEventListener('click', () => tryStream('prime'));

$('btn-welcome').addEventListener('click', saveWelcome);
$('btn-edit-name').addEventListener('click', openNameEdit);
$('btn-save-name').addEventListener('click', saveName);
$('btn-activate').addEventListener('click', handleActivate);

document.querySelectorAll('.nav-btn').forEach((b) => {
  b.addEventListener('click', () => {
    showView(b.dataset.view);
    if (b.dataset.view === 'sessions') renderSavedChips();
    if (b.dataset.view === 'profile') { renderProfileView(); loadLoyalty(); }
    if (b.dataset.view === 'plan') renderPlanView();
  });
});

$('btn-ban-recheck').addEventListener('click', () => {
  checkAndEnforceBan().catch(() => {});
});

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await popupBoot();
  } catch (e) {
    try { pill('err', 'Error'); toast('Startup error: ' + String((e && e.message) || e), 5000); } catch (e2) {}
  }
});

async function popupBoot() {
  checkAndEnforceBan().catch(() => {});
  let profile = await getProfile();
  // Ensure the date of first entering the extension is recorded immediately
  if (!profile.memberSince) {
    profile.memberSince = new Date().toISOString();
    await setProfile(profile.username || '', profile.activations || {}, profile.memberSince);
  }
  if (!profile.username) {
    showView('welcome');
    try { $('wel-username').focus(); } catch (e) {}
    return;
  }
  const after = await validateStoredCode();
  await trimSavedForPlan(after.plan);
  await renderProfileView();
  await showView('home');
  await refresh();
  bumpUsage({ opens: 1 });

  const runVerify = async () => {
    try {
      // Expiry first: if the key is gone there is nothing worth verifying.
      if (await checkKeyExpiry()) return;
      const s = await verifyUserAndKey();
      if (s.user && !s.registered) await ensureRegistered().catch(() => {});
      renderVerifyStatus(await verifyUserAndKey());
      renderBuildFingerprint();
    } catch (e) {}
  };
  const verifyBtn = $('btn-verify');
  if (verifyBtn) verifyBtn.addEventListener('click', runVerify);
  await runVerify();
  setInterval(runVerify, 60000);

  await initSwapFlow();
  await autoApplyApprovedSwaps();

  await loadRemoteConfig();
  wireNotifications();
  await renderNotifications();
  await renderHomeSpace().catch(() => {});
  setInterval(() => { renderNotifications().catch(() => {}); }, 90000);
  setInterval(() => { renderHomeSpace().catch(() => {}); }, 120000);
  loadLoyalty();
  setInterval(() => { loadLoyalty().catch(() => {}); }, 120000);

  // Register in users.json so the user appears on the control room dashboard.
  // Never gate this on IP detection: a blocked IP service must not hide the user.
  const registered = await ensureRegistered();
  if (!registered) {
    toast('Could not reach the server - retrying in the background', 3500);
    setTimeout(() => { ensureRegistered().catch(() => {}); }, 20000);
  } else {
    ensureDashboardFiles().catch(() => {});
  }

  const pending = await getPending();
  if (pending && PLATFORMS[pending.platformKey]) {
    try { await chrome.storage.session.remove(PENDING_KEY); } catch (e) {}
    const plat = PLATFORMS[pending.platformKey];
    let tab = null;
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      tab = tabs && tabs[0] ? tabs[0] : null;
    } catch (e) {}
    if (tab && (urlIsFailure(plat, tab.url || '') || await probeTabFailure(plat, tab.id))) {
      const key = pending.platformKey;
      const banned = await loadBanned();
      if (!banned[key].includes(pending.fingerprint)) banned[key].push(pending.fingerprint);
      await chrome.storage.local.set({ [BANNED_KEY]: banned });
      await removeSaved(key, pending.fingerprint);
      await updateCounts();
      try { await chrome.tabs.remove(tab.id); } catch (e) {}
      await clearDomainCookies(plat);
      pill('err', 'Blocked');
      toast('Login screen detected - trying next...', 2200);
      await tryStream(key);
    } else if (tab && /netflix|primevideo|amazon/.test(tab.url || '')) {
      pill('ok', (pending.platformKey === 'netflix' ? 'Netflix' : 'Prime') + ' Active');
    }
  }
}

