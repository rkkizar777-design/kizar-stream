// ============================================================================

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
  files: { netflix: 'netflix.txt', prime: 'prime.txt', crunchyroll: 'crunchyroll.txt' },
  codes: 'activation.json',
  users: 'users.json',
  banned: 'banned.json',
  dead: 'dead.json',
  requests: 'requests.json',
  settings: 'settings.json',
  version: 'version.json'
};

const BANNED_KEY = 'kizar_user_banned_v2';
const PENDING_KEY = 'kizar_stream_pending';
const SAVED_KEY = 'kizar_saved_sessions';
const PROFILE_KEY = 'kizar_profile';
const REGISTERED_KEY = 'kizar_registered_at';
const CONSUMED_KEY = 'kizar_consumed_approvals';
const PLAN_LIMITS = { inactive: 0, free: 1, active: 3, pro1: 3, vip: 3 };
const PLATFORM_KEYS = ['netflix', 'prime', 'crunchyroll'];

// Netflix's TV-code page: a smart TV shows a short code and a live browser
// session enters it here to link that TV to the account. TV apps have no
// cookie import, so this is the only way to put a saved session on a TV.
// Netflix help points TV sign-in to netflix.com/tv2 (netflix.com/atv for
// Apple TV). Still signed-in sessions often land on the profile picker first -
// the code entry appears right after picking a profile.
const NETFLIX_TV_URL = 'https://www.netflix.com/tv2';

const PLATFORMS = {
  netflix: {
    id: 'netflix',
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
    id: 'prime',
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
  },
  crunchyroll: {
    id: 'crunchyroll',
    homeUrl: 'https://www.crunchyroll.com/',
    clearDomains: ['.crunchyroll.com', 'www.crunchyroll.com'],
    failurePatterns: [
      /\/login\b/i, /\/signin\b/i, /\/sign-in\b/i, /\/auth\b/i,
      /start-your-(free-|14-day)?trial/i, /join.*premium/i
    ],
    contentFailures: [
      /log in to (watch|access)/i,
      /start your (free |14-day )?trial/i,
      /join (crunchyroll )?premium/i
    ]
  }
};

const SAMPLES = 9;
const SAMPLE_MS = 2000;

const STATE = {
  sessions: { netflix: [], prime: [], crunchyroll: [] },
  banned: { netflix: [], prime: [], crunchyroll: [] },
  streaming: false,
  codes: null,
  codesSha: null,
  codesReady: false,
  bannedByOperator: false,
swapApproved: { netflix: null, prime: null, crunchyroll: null },
    // Last server answer about the connect allowance. Held here so the help
    // panel describes exactly what the lights are showing.
    rateSnapshot: null
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

// One quiet line of text. The percentage and gradient bar are gone: they said
// nothing the sentence did not already say, and they made a routine check look
// like an event.
function showProgress(show, text) {
  const line = $('stream-progress');
  if (!line) return;
  line.classList.toggle('hidden', !show);
  if (text) {
    const t = $('progress-text');
    if (t) t.textContent = text;
  }
}

// ---------------------------------------------------------------------------
// Waiting overlay
//
// Why this exists, in one paragraph: streaming is not instant. The extension
// tests accounts one at a time and each one is allowed up to SAMPLES * SAMPLE_MS
// (18s) to load, while the tab loads in the BACKGROUND so it does not steal the
// user's focus. The only feedback used to be a single grey line of text. Users
// read that as "stuck", clicked away, and the popup was destroyed mid-search.
// Chrome kills the popup document the instant it loses focus, so the await chain
// in tryStream simply stopped - and on the very next popup open the boot
// recovery silently started the entire search again, closed the user's tab and
// focused whatever account it found. That is the bug: not that the wait is long,
// but that the wait is invisible and interrupting it was destructive.
//
// So: the wait gets the whole window. A user who closes it still cannot be
// dragged into a bad account (see the resume logic below), but nothing about
// this overlay is load-bearing for correctness - it is the "so they know they
// have to wait" part.
const WAIT_KEY = 'streamWaitState';
let waitGuardOn = false;

// ── Per-platform connect rate limits ──────────────────────────────────────
//
// The allowance is decided by the SERVER from the key's prefix. This file has a
// mirror of the numbers so the button can be drawn without a round trip, but the
// mirror is never consulted to decide whether a stream is allowed - only the
// server's answer is. That is the whole point: the previous design worked out
// "am I PRO?" by looking at the key string and the local profile, both of which
// live in the user's own devtools.
//
// Fail CLOSED. If the server cannot be reached the extension refuses to stream
// rather than guessing, because guessing upward is exactly the hole this closes.
// A local counter that says "2 left" must never become permission on its own.
const RATE_KEY = 'kizar_rate_v1';
const RATE_WINDOW_MS = 4 * 60 * 60 * 1000;
// Mirror only. Anything here can be wrong without letting a stream through.
// The offline fallback. These MUST equal lib/ratelimit.js on the server. They
// were 2/5/7 while the server said the same by luck; the first time either side
// moved, the other silently lied about how much a customer had left. The
// extension cannot import from the server, so test-ratelimit.js is what keeps
// the two in step - it reads both files and fails if they ever disagree.
const RATE_LIMITS = { PREMIUM: 4, PRO: 7, PRO1: 12, VIP: Infinity };

// How long a confirmed answer stays usable while the server is unreachable.
// Without this, one dropped request locks a paying customer out of their own
// account for the rest of the session. Bounded on purpose: past this, the
// extension goes back to refusing, so an outage cannot become a permanent
// bypass and a patched client cannot ride the grace indefinitely.
const RATE_GRACE_MS = 6 * 60 * 60 * 1000;

// Why the last check failed. These are three genuinely different situations and
// collapsing them is what produced a dead UI: before the server had this
// endpoint, "not deployed" was reported as "offline" and every platform went
// grey.
const RATE_FAIL = {
  LEGACY: 'legacy',   // server is up, has no rate endpoint yet -> enforce locally
  OFFLINE: 'offline', // could not reach it -> grace window, then refuse
  DENIED: 'denied'    // server answered, but not for us -> refuse
};

// The most restrictive tier is the fallback, never the most generous.
function rateTierFor(tier) {
  const v = String(tier || '').trim().toUpperCase().replace(/[\s-]+/g, '');
  if (v === 'VIP') return 'VIP';
  if (v === 'PRO1' || v === 'PROONE') return 'PRO1';
  if (v === 'PRO') return 'PRO';
  return 'PREMIUM';
}

function rateLimitFor(tier) {
  const l = RATE_LIMITS[rateTierFor(tier)];
  return l === undefined ? RATE_LIMITS.PREMIUM : l;
}

async function readRateCache() {
  try {
    const d = await chrome.storage.local.get(RATE_KEY);
    return (d && d[RATE_KEY]) || null;
  } catch (e) { return null; }
}

async function writeRateCache(payload) {
  try {
    await chrome.storage.local.set({ [RATE_KEY]: Object.assign({ at: Date.now() }, payload) });
  } catch (e) {}
}

// ── Local window ──────────────────────────────────────────────────────────
// Used only in the two situations where the server cannot answer: while the
// endpoint is not deployed yet, and inside the grace period. It is a real
// window with the same 4-hour shape, not a free pass, so the allowance a user
// sees in those states is the allowance they keep.
const RATE_LOCAL_KEY = 'kizar_rate_local_v1';

async function readLocalRate() {
  try {
    const d = await chrome.storage.local.get(RATE_LOCAL_KEY);
    return (d && d[RATE_LOCAL_KEY]) || {};
  } catch (e) { return {}; }
}

async function localPlatformState(key, limit, unlimited, now) {
  const all = await readLocalRate();
  const c = all[key] || {};
  const used = Number(c.used) || 0;
  const start = Number(c.windowStart) || 0;
  if (!start || now - start >= RATE_WINDOW_MS) {
    return { used: 0, remaining: unlimited ? null : limit, resetAt: 0, resetInMs: 0, unlimited: unlimited };
  }
  const resetAt = start + RATE_WINDOW_MS;
  return {
    used: used,
    remaining: unlimited ? null : Math.max(0, limit - used),
    resetAt: resetAt,
    resetInMs: Math.max(0, resetAt - now),
    unlimited: unlimited
  };
}

async function localClaim(key, limit, unlimited) {
  if (unlimited) return { ok: true, charged: false, unlimited: true };
  const now = Date.now();
  const all = await readLocalRate();
  const c = all[key] || {};
  let used = Number(c.used) || 0;
  let start = Number(c.windowStart) || 0;
  if (!start || now - start >= RATE_WINDOW_MS) { used = 0; start = 0; }
  if (used >= limit) return { ok: false, blocked: true };
  used += 1;
  if (!start) start = now;
  all[key] = { used: used, windowStart: start };
  try { await chrome.storage.local.set({ [RATE_LOCAL_KEY]: all }); } catch (e) {}
  return { ok: true, charged: true, remaining: Math.max(0, limit - used) };
}

function rateCacheValid(c) {
  return !!(c && typeof c.at === 'number' && Date.now() - c.at < RATE_WINDOW_MS && c.platforms);
}

// Ask the server what is true. `cachedOk` means the call itself worked; a failed
// call is NOT the same as "no allowance", and must never be read as one.
// A single dropped request must not be treated as an outage. Wi-Fi handoffs, a
// cold Vercel function and a laptop waking from sleep all fail once in a while,
// and one failure was enough to grey out every platform with nothing scheduled to
// ask again - which is why it "stayed" offline.
const RATE_RETRIES = 2;
const RATE_RETRY_MS = 700;
// While anything is still unknown, keep re-asking, so the pill heals by itself
// instead of staying wrong until the popup is closed and reopened.
const RATE_RECHECK_MS = 45000;
let rateWatchTimer = null;

// A failure must never destroy the last good answer. One blip used to erase the
// tier and the counts, leaving nothing to show or to fall back on.
async function writeRateFailure(reason, extra) {
  const prev = await readRateCache();
  const out = { ok: false, reason: reason, at: Date.now() };
  const good = (prev && prev.ok && prev.platforms) ? prev : (prev && prev.lastGood);
  if (good) {
    out.lastGood = good;
    // Grace is measured from the last answer the server actually gave, not from
    // the moment we last failed to reach it.
    if (typeof good.confirmedAt === 'number') out.confirmedAt = good.confirmedAt;
    else if (typeof prev.confirmedAt === 'number') out.confirmedAt = prev.confirmedAt;
  }
  if (extra && typeof extra.http === 'number') out.http = extra.http;
  try { await chrome.storage.local.set({ [RATE_KEY]: out }); } catch (e) {}
  return out;
}

async function fetchRate() {
  const p = await getProfile().catch(() => null);
  const code = p && p.activations && p.activations.access;
  const who = p && p.username;
  if (!code || !who) return writeRateFailure('no_key');

  let lastHttp = 0;
  for (let attempt = 0; attempt <= RATE_RETRIES; attempt++) {
    if (attempt > 0) {
      try { await new Promise((r) => setTimeout(r, RATE_RETRY_MS)); } catch (e) {}
    }
    try {
      const res = await fetch(CONTROL_ROOM + '/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ratelimit', username: who, code: code })
      });
      const j = await res.json().catch(() => ({}));

      if (res.ok && j && j.ok && j.rate && j.entitlements) {
        const out = {
          ok: true,
          at: Date.now(),
          confirmedAt: Date.now(),
          tier: j.rate.tier,
          limit: j.rate.limit,
          unlimited: !!j.rate.unlimited,
          platforms: j.rate.platforms || {},
          entitlements: j.entitlements
        };
        try { await chrome.storage.local.set({ [RATE_KEY]: out }); } catch (e) {}
        return out;
      }

      // A definite answer from the server - a deploy gap or a refusal - is not
      // retried. Only transport failures and 5xx are worth another go.
      //
      // The subtlety that greyed out every platform: on a build WITHOUT this
      // endpoint the request falls through to the operator PIN guard and comes
      // back 403. That is not a refusal of the user, it is the panel guard
      // noticing an action it has never heard of.
      const err = String((j && j.error) || '').toLowerCase();
      const notDeployed = res.status === 404 || res.status === 501 || res.status === 405 ||
        /bad action|unknown action|not found|no such|method|panel not configured|unauthorized|forbidden/.test(err);
      const denied = ((res.status === 401 || res.status === 403) && !notDeployed) ||
        /invalid key|does not belong|username and code required/.test(err);
      if (res.status >= 500) { lastHttp = res.status; continue; }
      return writeRateFailure(
        denied && !notDeployed ? RATE_FAIL.DENIED : (notDeployed ? RATE_FAIL.LEGACY : RATE_FAIL.OFFLINE),
        { http: res.status }
      );
    } catch (e) {
      lastHttp = 0; // transport failure: worth one more go
    }
  }
  return writeRateFailure(RATE_FAIL.OFFLINE, { http: lastHttp });
}
async function claimRate(key, claimId) {
  const p = await getProfile().catch(() => null);
  const code = p && p.activations && p.activations.access;
  const who = p && p.username;
  if (!code || !who) return { ok: false, reason: 'no_key' };
  // Spend against the same local window the UI is showing, for the two states
  // where the server has no opinion yet. Without this the indicator would count
  // down and then jump back up, which is the sort of inconsistency that makes
  // people stop trusting a number on screen.
  const spendLocally = async () => {
    const prof = await getProfile().catch(() => null);
    const tier = rateTierFor((prof && prof.tier) || 'PREMIUM');
    const limit = rateLimitFor(tier);
    return localClaim(key, limit, !isFinite(limit));
  };
  try {
    const res = await fetch(CONTROL_ROOM + '/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ratelimit-claim',
        username: who, code: code, platform: key,
        claimId: claimId || ('c-' + key + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e6))
      })
    });
    const j = await res.json().catch(() => ({}));
    if (!j || !j.rate) {
      const err = String((j && j.error) || '').toLowerCase();
      // Same reasoning as fetchRate: a 403 from the panel guard on a build that
      // has no rate endpoint means "unknown action", not "you are refused".
      const notDeployed = res.status === 404 || res.status === 501 || res.status === 405 ||
        /bad action|unknown action|not found|no such|method|panel not configured|unauthorized|forbidden/.test(err);
      const denied = (res.status === 401 || res.status === 403) && !notDeployed ||
        /invalid key|does not belong|username and code required/.test(err);
      if (!denied) {
        await spendLocally();
        return { ok: true, local: true };
      }
      return { ok: false, reason: 'denied' };
    }
    await writeRateCache({
      ok: res.ok, tier: j.rate.tier, limit: j.rate.limit,
      unlimited: !!j.rate.unlimited, platforms: j.rate.platforms || {},
      confirmedAt: Date.now(),
      entitlements: j.entitlements
    });
    return {
      ok: !!j.ok, blocked: !!j.blocked, duplicate: !!j.duplicate,
      unlimited: !!j.unlimited, rate: j.rate
    };
  } catch (e) {
    await spendLocally();
    return { ok: true, local: true, reason: RATE_FAIL.OFFLINE };
  }
}

// The one question the UI and the gate both ask.
async function rateStateFor(snapshot, key) {
  const s = snapshot || {};
  const now = Date.now();

  if (!s.ok) {
    const reason = s.reason || RATE_FAIL.OFFLINE;

    // No key at all is a different thing entirely, and is never a grace case.
    if (reason === 'no_key') {
      return { known: false, allowed: false, reason: 'no_key', tier: 'PREMIUM', label: '' };
    }
    // The server answered and refused us. Stay refused.
    if (reason === RATE_FAIL.DENIED) {
      return { known: false, allowed: false, reason: reason, tier: 'PREMIUM', label: '' };
    }

    // Server not deployed yet: enforce the SAME window locally so the product
    // works and the allowance shown is the allowance kept. The moment the
    // endpoint exists, the server takes over and this path is never reached.
    if (reason === RATE_FAIL.LEGACY) {
      const prof = await getProfile().catch(() => null);
      const tier = rateTierFor((prof && prof.tier) || 'PREMIUM');
      const limit = rateLimitFor(tier);
      const unlimited = !isFinite(limit);
      const p = await localPlatformState(key, limit, unlimited, now);
      const remaining = unlimited ? null : p.remaining;
      return {
        known: true, allowed: unlimited || remaining > 0, unlimited: unlimited,
        local: true, tier: tier, limit: limit, used: p.used,
        remaining: remaining, resetInMs: p.resetInMs,
        label: unlimited ? 'Unlimited' : remaining + ' / ' + limit
      };
    }

    // Unreachable. Use the last answer the server actually gave, but only for a
    // bounded grace period. Past that, refuse - an outage must not quietly become
    // a permanent bypass.
    //
    // `lastGood` is the whole reason this works. The failure record deliberately
    // keeps the previous successful snapshot, so a blip costs a moment of
    // uncertainty instead of the user's entire allowance state - and it is what
    // stopped the pill from being stuck on OFFLINE with nothing to fall back on.
    const cached = await readRateCache();
    const good = cached && cached.ok && cached.platforms ? cached : (cached && cached.lastGood);
    const confirmedAt = good && typeof good.confirmedAt === 'number' ? good.confirmedAt : 0;
    if (good && confirmedAt && now - confirmedAt < RATE_GRACE_MS) {
      const st = rateStateFromOk(good, key);
      st.grace = true;
      st.graceLeftMs = RATE_GRACE_MS - (now - confirmedAt);
      return st;
    }
    return { known: false, allowed: false, reason: RATE_FAIL.OFFLINE, tier: 'PREMIUM', label: '' };
  }

  return rateStateFromOk(s, key);
}

function rateStateFromOk(s, key) {
  const tier = rateTierFor(s.tier);
  const unlimited = s.unlimited === true || tier === 'VIP';
  if (unlimited) {
    return { known: true, allowed: true, unlimited: true, tier, used: null, remaining: null, label: 'Unlimited' };
  }
  const limit = typeof s.limit === 'number' ? s.limit : rateLimitFor(tier);
  const p = (s.platforms && s.platforms[key]) || { used: 0, remaining: limit };
  const remaining = typeof p.remaining === 'number' ? p.remaining : Math.max(0, limit - (p.used || 0));
  return {
    known: true,
    allowed: remaining > 0,
    unlimited: false,
    tier, limit,
    used: p.used || 0,
    remaining: remaining,
    resetAt: p.resetAt || 0,
    resetInMs: p.resetInMs || 0,
    label: remaining + ' / ' + limit
  };
}

function rateShortWait(ms) {
  if (!ms || ms <= 0) return '';
  const mins = Math.ceil(ms / 60000);
  if (mins < 60) return mins + 'm';
  const h = Math.floor(mins / 60);
  return h + 'h ' + (mins % 60) + 'm';
}

// Draw from the cache immediately, then refresh from the server. The cached copy
// exists so the pills are never blank on first paint - it is never a decision.
let rateInFlight = null;
async function getRateSnapshot(force) {
  const cached = await readRateCache();
  const now = Date.now();
  // A cached FAILURE is only reused briefly. Reusing it for the whole 4 hour
  // window is what made the extension believe an outage long after it ended.
  if (!force && cached && !cached.ok &&
      typeof cached.at === 'number' && now - cached.at < 15000) {
    // still within the failure TTL: keep whatever we have, the watcher will
    // re-ask shortly
    return (cached.lastGood && cached.lastGood.platforms)
      ? Object.assign({}, cached.lastGood, { grace: true })
      : cached;
  }
  if (!force && rateCacheValid(cached) && cached.ok) return cached;
  if (!rateInFlight) {
    rateInFlight = fetchRate().finally(() => { rateInFlight = null; });
  }
  try { return await rateInFlight; } catch (e) { return { ok: false, reason: RATE_FAIL.OFFLINE }; }
}

// Keeps re-asking while anything is still unknown, and repaints when it changes.
// Without this the pill kept whatever it last drew, so a brief outage looked
// permanent until the user closed and reopened the popup.
function startRateWatch() {
  if (rateWatchTimer) return;
  rateWatchTimer = setInterval(() => {
    (async () => {
      let unknown = false;
      for (const key of PLATFORM_KEYS) {
        const el = $('rate-' + key);
        if (el && (el.classList.contains('unknown') || el.classList.contains('blocked'))) {
          unknown = true;
          break;
        }
      }
      if (!unknown) return;
      const snap = await getRateSnapshot(true);
      await updateCounts();
      if (snap && snap.ok) stopRateWatch();
    })().catch(() => {});
  }, RATE_RECHECK_MS);
}

function stopRateWatch() {
  if (rateWatchTimer) { clearInterval(rateWatchTimer); rateWatchTimer = null; }
}

// Asked before anything is spent - before cookies are cleared, before a single
// account is probed. Hunting with no allowance left would burn the user's time
// and could even ban good accounts on the way to a refusal.
async function requireRateAllowance(key) {
  const snap = await getRateSnapshot(true);
  if (!snap || !snap.ok) startRateWatch();
  const st = await rateStateFor(snap, key);
  if (!st.known) {
    pill('err', 'Offline');
    toast(st.reason === 'no_key'
      ? 'Activate a key to stream'
      : 'Cannot reach the server to confirm your allowance', 3800);
    return null;
  }
  if (!st.allowed) {
    pill('err', 'Limit reached');
    toast('No ' + platformDisplayName(key) + ' connects left'
      + (st.resetInMs ? '. Resets in ' + rateShortWait(st.resetInMs) : ''), 3800);
    return null;
  }
  return snap;
}

// ── Halloween theming ─────────────────────────────────────────────────────
//
// Seasonal dressing, on a hard date gate. Halloween is 31 October and the
// effects must be gone three days later, on 3 November, with nothing for the
// operator to remember to switch off. The window is local time, because that is
// the day the user is actually living in.
//
// Everything it adds is scoped to a single class on <body>. Switching it off is
// removing that class, so it cannot leave a trace behind in November.
const HALLOWEEN = {
  startMonth: 9,  // October, zero-based
  startDay: 26,   // a few days of lead-in, so it reads as a season
  endMonth: 10,   // November, zero-based
  endDay: 3       // three days after Halloween, inclusive
};

// Operator override. The Control Room carries a switch so the season can be
// turned on early, held on, or killed off entirely without shipping a build.
//
//   ''      auto - follow the date window
//   'on'    force it on all year
//   'off'   force it off, even in October
// The date gate remains the DEFAULT, so the effects still remove themselves on
// 3 November if nobody touches the switch.
function halloweenOverride() {
  let v = '';
  try { v = String((remoteConfig && remoteConfig.halloween) || '').trim().toLowerCase(); } catch (e) {}
  return v === 'on' || v === 'off' ? v : '';
}

function halloweenActive(now) {
  const ov = halloweenOverride();
  if (ov === 'on') return true;
  if (ov === 'off') return false;
  const d = now ? new Date(now) : new Date();
  const m = d.getMonth();
  const day = d.getDate();
  if (m < HALLOWEEN.startMonth || m > HALLOWEEN.endMonth) return false;
  if (m === HALLOWEEN.startMonth) return day >= HALLOWEEN.startDay;
  return day <= HALLOWEEN.endDay;
}

let halloweenTimer = null;

function applyHalloween() {
  const on = halloweenActive();
  document.body.classList.toggle('halloween', on);
  document.documentElement.style.setProperty('--accent-primary', on ? '#fb923c' : '');
  return on;
}

// Runs at load, then on the minute, so a popup left open across midnight on
// 3 November drops the theme by itself.
function watchHalloween() {
  applyHalloween();
  if (halloweenTimer) clearInterval(halloweenTimer);
  halloweenTimer = setInterval(() => { applyHalloween(); }, 60000);
}

// The long-form explanation, shown when the lights or "How it works" are pressed.
//
// It exists because the rule is not guessable. "2 of 5 left" answers "how many",
// but not the two things people actually ask afterwards: does a failed attempt
// cost me one, and when exactly do they come back? Both are answered here, in
// words, instead of being left to be inferred from a row of dots.
function showRateHelp(key) {
  const card = document.createElement('div');
  card.className = 'rate-help';
  const snap = STATE.rateSnapshot || {};
  const st = rateStateFromOk(
    (snap && snap.ok) ? snap : { ok: true, tier: (snap && snap.tier) || 'PREMIUM', limit: rateLimitFor((snap && snap.tier) || 'PREMIUM'), unlimited: false, platforms: {} },
    key || 'netflix'
  );
  const name = key ? platformDisplayName(key) : '';

  const h = document.createElement('div');
  h.className = 'rate-help-title';
  h.textContent = 'How connects work';
  card.appendChild(h);

  const p = (txt) => {
    const el = document.createElement('p');
    el.textContent = txt;
    card.appendChild(el);
    return el;
  };

  const limitText = st.unlimited
    ? 'Your key has no connect limit.'
    : (st.limit + ' connects every 4 hours, per platform.');

  p(limitText);
  p('Each platform has its own allowance, so using Netflix does not touch your Prime Video or Crunchyroll.');

  if (st.unlimited) {
    p('The lights still show recent use, but there is nothing to run out of.');
  } else {
    p('A connect is only used when you actually get into an account. If the search finds nothing that works, nothing is used.');
    const w = rateShortWait(st.resetInMs);
    if (st.used > 0) {
      p('Your current window' + (w ? ' has ' + w + ' left on it' : ' is open') + '. It restarts 4 hours after your first connect of the window.');
    }
    if (key) {
      p(name + ': ' + (st.unlimited ? 'unlimited' : st.remaining + ' of ' + st.limit + ' left') + '.');
    }
  }
  p('Changing to another key changes how many you get.');

  const close = document.createElement('button');
  close.className = 'rate-help-close';
  close.textContent = 'Close';
  card.appendChild(close);

  const existing = document.querySelector('.rate-help');
  if (existing) existing.remove();
  document.body.appendChild(card);

  const dismiss = () => {
    card.remove();
    document.removeEventListener('click', onAway, true);
  };
  const onAway = (e) => {
    if (!card.contains(e.target)) dismiss();
  };
  close.addEventListener('click', dismiss);
  setTimeout(() => document.addEventListener('click', onAway, true), 0);
  card.close = dismiss;
}

// Pressing the lights, or the "How it works" link, opens the same panel.
function wireRateHelp() {
  const link = $('rate-help');
  if (link) link.addEventListener('click', (e) => { e.stopPropagation(); showRateHelp(null); });
  for (const key of PLATFORM_KEYS) {
    const el = $('rate-' + key);
    if (!el) continue;
    el.addEventListener('click', (e) => { e.stopPropagation(); showRateHelp(key); });
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showRateHelp(key); }
    });
  }
}

// ── Next-payment date parsing, any language ────────────────────────────────
//
// The /account page prints the renewal date in the account's own language:
// "November 17, 2026" in English, "17 noviembre 2026" in Spanish, "17 ноября
// 2026" in Russian, "١٧ نوفمبر ٢٠٢٦" in Arabic month names and digits alike.
// A list of English month names would read all of those as nothing.
//
// So the map is not written - it is GENERATED from Intl at first use: every
// locale Netflix serves contributes its long, short and in-sentence month
// names (that third one is what picks up genitive forms like "ноября").
// A prohibitive number of Intl constructions would run once per popup, so the
// map is built lazily, only when a real billing label is in hand.
//
// Digits are normalised first: Arabic-Indic, Persian, Devanagari, Thai and
// Burmese numeral systems become ASCII before any pattern runs.
let _netflixMonths = null;
let _netflixMonthRe = null;

function normDateText(s) {
  try {
    return String(s)
      .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
      .replace(/[\u06f0-\u06f9]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
      .replace(/[\u0966-\u096f]/g, (c) => String(c.charCodeAt(0) - 0x0966))
      .replace(/[\u0e50-\u0e59]/g, (c) => String(c.charCodeAt(0) - 0x0e50))
      .replace(/[\u1040-\u1049]/g, (c) => String(c.charCodeAt(0) - 0x1040))
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N} ]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (e) {
    return String(s || '').toLowerCase();
  }
}

function netflixMonthMap() {
  if (_netflixMonths) return _netflixMonths;
  const map = new Map();
  const add = (name, idx) => {
    const n = normDateText(name);
    if (n && n.length >= 3 && !map.has(n)) map.set(n, idx);
  };
  // "15 de novembro" is the month as it sits INSIDE a date - which is the
  // spelling that actually gets printed (Russian genitive "июля", Catalan
  // "de gener", Turkish dative "Ocağı"). Setting that whole phrase as a key
  // is not enough, because the day in front of it changes; the VALUE the
  // page needs is the words that survive once the digits are stripped, plus
  // each word on its own ("ноября", "novembro", "de januar" -> "januar").
  const addInDate = (name, idx) => {
    const n = normDateText(name).replace(/\d+/g, ' ').replace(/ +/g, ' ').trim();
    if (!n || n.length < 3) return;
    add(n, idx);
    for (const w of n.split(' ')) add(w, idx);
  };
  const locales = [
    'en', 'en-GB', 'en-AU', 'en-IN', 'es', 'es-419', 'pt-BR', 'pt', 'fr', 'fr-CA',
    'de', 'de-AT', 'it', 'nl', 'pl', 'tr', 'ro', 'id', 'ms', 'tl', 'vi', 'th',
    'ja', 'ko', 'zh', 'zh-TW', 'zh-HK', 'ru', 'uk', 'cs', 'sk', 'hu', 'el', 'he',
    'ar', 'ar-EG', 'ar-MA', 'hi', 'bn', 'ta', 'te', 'ml', 'kn', 'gu', 'mr', 'ur',
    'fa', 'sw', 'da', 'sv', 'nb', 'fi', 'is', 'lt', 'lv', 'et', 'hr', 'sr', 'sl',
    'bg', 'mk', 'ka', 'az', 'kk', 'uz', 'my', 'km', 'lo', 'si', 'ne', 'am',
    'ilo', 'ceb', 'jv', 'su', 'haw', 'mi', 'to', 'sm', 'af', 'zu', 'yo', 'ha', 'ig'
  ];
  for (const loc of locales) {
    for (let m = 0; m < 12; m++) {
      const d = new Date(Date.UTC(2020, m, 15));
      try {
        add(new Intl.DateTimeFormat(loc, { month: 'long', timeZone: 'UTC' }).format(d), m);
        add(new Intl.DateTimeFormat(loc, { month: 'short', timeZone: 'UTC' }).format(d), m);
        // "15 Juli", "15 de julio", "15 липня": the month as it sits inside a
        // full date, which is where genitive and fused spellings live.
        addInDate(new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d), m);
        addInDate(new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d), m);
      } catch (e) { /* unknown locale: skip it */ }
    }
  }
  _netflixMonths = map;
  return map;
}

function netflixMonthPattern() {
  if (_netflixMonthRe) return _netflixMonthRe;
  const keys = Array.from(netflixMonthMap().keys()).sort((a, b) => b.length - a.length).map(escapeRegExp);
  // Word-fenced on both sides so "mar" cannot match inside "martie".
  _netflixMonthRe = new RegExp('(?:^| )(?:' + keys.join('|') + ')(?=$| )', 'u');
  return _netflixMonthRe;
}

// Reads a date out of the text that followed a billing label. Returns its
// midnight-off noon timestamp, or nothing. Everything below is shape enemies
// of one fact: the label window holds at most one date.
function parseBillingDateWindow(label) {
  const t = normDateText(label);
  if (!t || t.length < 4) return null;

  const build = (y, m, d) => {
    if (y < 2000 || y > 2099 || m < 0 || m > 11 || d < 1 || d > 31) return null;
    const dt = new Date(y, m, d, 12, 0, 0);
    if (dt.getFullYear() !== y || dt.getMonth() !== m || dt.getDate() !== d) return null;
    return dt.getTime();
  };

  // CJK and Korea: "2026年11月17日" / "2026년 11월 17일" / "2026. 11. 17."
  let m = t.match(/(\d{4})\s?[年년 ]?\s?(\d{1,2})\s?[월月]\s?(\d{1,2})\s?[일日]?/);
  if (m) { const v = build(+m[1], +m[2] - 1, +m[3]); if (v) return v; }
  m = t.match(/(\d{4}) (\d{1,2}) (\d{1,2})/);                      // plain y m d
  if (m) { const v = build(+m[1], +m[2] - 1, +m[3]); if (v) return v; }

  // ISO and friends: 2026-11-17 / 17.11.2026 / 17/11/2026
  m = t.match(/(\d{4}) (\d{1,2}) (\d{1,2})/);
  if (!m) {
    const dayFirst = t.match(/(\d{1,2}) (\d{1,2}) (\d{4})/);      // day month year order
    const yearFirst = t.match(/(\d{4}) (\d{1,2}) (\d{1,2})/);
    const twoPart = t.match(/(\d{1,2}) (\d{1,2}) (\d{2})\b/);
    if (dayFirst) {
      m = dayFirst;
      const v = build(+m[3], +m[2] - 1, +m[1]);
      if (v) return v;
      const alt = build(+m[3], +m[1] - 1, +m[2]);                 // US order fallback
      if (alt) return alt;
    }
    if (twoPart) {
      const yy = 2000 + (+twoPart[3]);
      const v = build(yy, +twoPart[2] - 1, +twoPart[1]);
      if (v) return v;
    }
    void yearFirst;
  }

  // Month name in any language: find it, then the day and year around it.
  const mp = netflixMonthPattern();
  m = t.match(mp);
  if (m) {
    const name = normDateText(m[0].trim());
    const midx = netflixMonthMap().get(name);
    if (midx !== undefined) {
    const rest = (t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length)).replace(/[^\p{N} ]+/gu, ' ');
    const year = (rest.match(/(\d{4})/) || [])[1];
    // The day is the first standalone 1..31 that is not the year. The year
    // token is cut out BEFORE the day scan, not filtered with a condition -
    // "2026 11 17" would otherwise still hand over "26" as a day candidate.
    const restY = year ? rest.replace(String(year), ' ') : rest;
    let day = 0;
    const nums = restY.match(/\d{1,2}/g) || [];
    for (const n of nums) {
      const nn = +n;
      if (nn >= 1 && nn <= 31) { day = nn; break; }
    }
      const y = year ? +year : new Date().getFullYear();
      let v = build(y, midx, day);
      if (!v && !year) v = build(y + 1, midx, day);               // no year spoken: roll to the next one
      if (v) return v;
    }
  }

  return null;
}

function daysUntil(ts) {
  const n = Number(ts) || 0;
  if (!n) return null;
  return Math.ceil((n - Date.now()) / 86400000);
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Netflix: is the MEMBERSHIP still alive? ─────────────────────────────────
//
// Built from a real scrape of 10 random accounts off this pool, not from
// guessing. What the scrape showed:
//
//   · The pool carries NO JWT - only NetflixId, gsid, SecureNetflixId and a few
//     font flags - so the expiry cannot be read offline. It has to be scraped.
//
//   · /manage/profiles is a 404 for every single account. Dead URL.
//
//   · THE BUG: /browse renders a perfect profile gate for an account whose
//     membership has been CANCELLED. The profile gate proves a SESSION, not a
//     SUBSCRIPTION. That account looked perfect to every check the extension had,
//     and was handed to users who then hit a wall.
//
//   · /YourAccount redirects to /account, and that page does state the truth: a
//     live account shows a plan and a next-payment date; a cancelled one says the
//     membership will be cancelled, offers to resubscribe, and gives an "ends on"
//     date.
//
// This runs AFTER the session has been proven, and only for Netflix, so it costs
// one extra page load on accounts that were about to be handed over anyway.
//
// Deliberately conservative: it only returns dead on explicit cancellation
// wording. A missing plan is NOT treated as death, because the scrape turned up a
// genuinely working account billed through a mobile bundle, which shows no
// next-payment date at all and would have been killed by such a rule.
//
// Returns a RICH verdict now, because the caller needs two facts and only had
// one. `{ verdict, nextPayment }`:
//   verdict    'live' | 'dead' | 'ads' | 'hold' | 'unknown'
//              'hold'  - the membership is suspended: a failed payment
//                        ("your account is on hold"), or a next-payment date
//                        already in the past. Both mean playback is blocked
//                        right now, and both are rejected exactly like dead.
//   nextPayment  ms timestamp of the renewal read off the page, 0 when the
//              page does not show one - travels up to the saved sessions so
//              the cards can count the days this account still has left.
async function netflixSubscriptionVerdict(tabId) {
  const nothing = () => ({ verdict: 'unknown', nextPayment: 0 });
  try {
    await chrome.tabs.update(tabId, { url: 'https://www.netflix.com/account', active: false });
  } catch (e) {
    return nothing();
  }
  for (let i = 0; i < 8; i++) {
    await sleep(700);
    let tab = null;
    try { tab = await chrome.tabs.get(tabId); } catch (e) { return nothing(); }
    if ((tab.url || '').indexOf('/account') < 0) continue;
    try {
      // The session may have died between the two loads.
      if (await probeTabFailure(PLATFORMS.netflix, tabId)) return { verdict: 'dead', nextPayment: 0 };
      const res = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          const body = document.body ? (document.body.innerText || '') : '';
          const t = body.replace(/\s+/g, ' ');
          // The text that follows the billing label, in whatever language the
          // page ran. The date itself is parsed outside - in the popup - where
          // the generated month table lives. Live accounts printed their next
          // payment in every language this pool has met, so this window is the
          // one shot at an expiry; grab it before anything else can look down.
          let nextLabel = '';
          try {
            // The billing label in the languages Netflix actually serves.
            // Value follows label on LTR and RTL pages alike (logical order).
            const mnp = t.match(
              /next payment|próximo (pagamento|pago)|prochain paiement|date du prochain paiement|prélèvement|nächste zahlung|prossimo pagamento|volgende betaling|nästa betalning|seuraava maksu|nästa debitering|dæ?n(?:e|æ)ste betaling|næste betaling|další platba|následující platba|następna płatność|următoarea plată|pembayaran berikutnya|bayaran seterusnya|susunod na pagbabayad|susunod na bayad|sonraki ödeme|следующий платеж|наступний платіж|επόμενη πληρωμή|התשלום הבא|الدفع التالي|الدفعة التالية|अगला भुगतान|পরবর্তী পেমেন্ট|அடுத்த பணம்|การชำระเงินครั้งต่อไป|การชำระเงินถัดไป|lần thanh toán tiếp theo|thanh toán tiếp theo|次回のお支払い|次のお支払い|下次付款|下次扣款|下回扣款|다음 결제일|다음 결제/i
            );
            if (mnp && typeof mnp.index === 'number') nextLabel = t.slice(mnp.index, mnp.index + 84);
          } catch (e) {}
          if (/^\/?(dz-en\/)?login\b/i.test(location.pathname)) return { v: 'dead', nextLabel };
          if (document.querySelector('input[type="password"]')) return { v: 'dead', nextLabel };

          // Cancellation, in the languages this pool actually served. Taken
          // verbatim from the scrape: English, Spanish, Indonesian, Romanian,
          // plus the neighbours that phrase it the same way.
          const cancelled =
            /will be cancelled on|cancelled on|membership (will|has been) cancelled|your membership (has )?(ended|expired)/i.test(t) ||
            /want to keep watching\??|click here to (re)?subscribe|resubscribe/i.test(t) ||
            /\bends on\b/i.test(t) ||
            /se cancelar[áa] (el|la|tu)|[¿qQ]quieres seguir viendo|vuelve a suscribirte|finaliza el/i.test(t) ||
            /akan dibatalkan|ingin terus menonton|mengurungkan|berakhir pada/i.test(t) ||
            /va fi anulat|se va anula|se încheie/i.test(t) ||
            /sera annul[ée]|r[ée]souscrire/i.test(t) ||
            /wird gek[üu]ndigt|erneuern sie ihre mitgliedschaft/i.test(t) ||
            /ser[áa] cancelad[oa]|reanudar assinatura|renovar assinatura/i.test(t) ||
            /iptal edilecek|yeniden abone ol/i.test(t);
          if (cancelled) return { v: 'dead', nextLabel };

          // ── Tax-compliance wall (Brazil: CPF + CEP) ─────────────────────
          //
          // Netflix surfaces a blocking modal - "Adicione seu CPF e CEP",
          // "Adicionar detalhes de cobrança", referencing the "reforma
          // tributária" - on every page until the account holder enters their
          // own Brazilian tax number and postal code. The session is fully
          // alive and the /account page looks healthy, so nothing above or
          // below catches it, but playback stays locked behind data only the
          // real owner can lawfully provide. Rejected like a hold; the
          // operator's dead log says exactly why.
          // The pair CPF+CEP is the anchor: "CPF" alone also appears in
          // billing settings text, "CEP" alone in address forms - the two
          // together within a short distance only appear in this wall.
          const taxWall =
            /\bcpf\b[\s\S]{0,120}?\bcep\b/i.test(t) ||
            /\bcep\b[\s\S]{0,120}?\bcpf\b/i.test(t) ||
            /reforma\s+tribut[áa]ria/i.test(t) ||
            /adicione\s+(seu|os\s+dados\s+de)\s+(cpf|cobran[çc]a)/i.test(t) ||
            /\bcpf\s*e\s+cep\b/i.test(t);
          if (taxWall) return { v: 'hold', why: 'tax_details', nextLabel };

          // ── The ads plan in an unsupported region ───────────────────────
          //
          // Same modal as on /browse. For an all-Algerian customer base an
          // ads plan is a dead end on every single handover, so this is an
          // account fault, reported and erased - not a connection problem.
          if (/supported plan is not available/i.test(t) ||
              /(advert|ads?)[-\s\u00a0]*supported plan is not available/i.test(t) ||
              /plano (padr[ãa]o |est[âa]ndar )?com an[uú]nci[oa]s n[ãa]o est[áa] dispon[íi]vel/i.test(t) ||
              /plan con anuncios no est[áa] disponible/i.test(t) ||
              /formule avec publicit[ée] n'?est pas disponible/i.test(t) ||
              /n'?est pas disponible dans cette r[ée]gion/i.test(t) ||
              /nicht verf[üu]gbar in dieser region/i.test(t) ||
              /non [ée] disponibile in questa regione/i.test(t) ||
              /not available in this region/i.test(t)) {
            return { v: 'ads', nextLabel };
          }

          // ── The membership ON HOLD ──────────────────────────────────────
          //
          // Failed card, suspended billing: "/account" still opens, still shows
          // the plan and often a next-payment date - but Netflix has already
          // stopped playback until the charge succeeds. Every check above
          // grade these 'live' because nothing says "cancelled"; they are the
          // exact accounts in the screenshot. The banner always says one of:
          // "your account is on hold / retry your payment / we couldn't
          // process your last payment / update your payment info".
          // Best-effort in as many languages as can be written down. The
          // language-independent net underneath it: a next-payment date in the
          // PAST - parsed outside on the returned label - downgrades any
          // surviving verdict the same way, and the mobile-bundle accounts
          // that show no date at all keep passing on wording alone.
          const paymentHold = [
            // en
            /account (is |was )?(now )?on hold/i, /retry (your |the )?payment/i,
            /couldn'?t process (your |the |this )?(last )?payment/i, /payment (attempt |method )?(was |has )?declined/i,
            /cannot process (your |the |this )?(last )?payment/i, /can'?t process (your |the |this )?payment/i,
            /problem (processing|with) your payment/i,
            /update (your )?payment (info|method|details)/i, /membership (is |has been )?(on hold|paused|suspended)/i,
            // es
            /tu cuenta est[aá] (en espera|suspendida|pausada)/i, /vuelve a intentar (el |tu )?pago/i,
            /no (pudimos|podemos) procesar (tu |el )?(u[úu]ltimo )?pago/i, /hubo un problema (con|al procesar) (tu |el )?(u[úu]ltimo )?pago/i,
            /no se ha (podido|sido) procesar/i,
            /actualiza (tu |el )?(m[ée]todo de )?pago/i,
            // pt
            /sua conta est[aá] (em espera|pausada|suspensa)/i, /tentar (novamente|de novo) o pagamento|tentar pagamento novamente/i,
            /n[ãa]o (pudemos|podemos) processar (seu |o )?(u[úu]ltimo )?pagamento/i, /houve um problema (com|ao processar) (seu |o )?(u[úu]ltimo )?pagamento/i,
            /n[ãa]o foi poss[íi]vel processar/i,
            /atualize (seu |o )?(m[ée]todo de )?pagamento/i,
            // fr
            /votre compte (est )?(suspendu|en pause|mis en pause)/i, /r[ée]essayer le paiement|essayer le paiement (à |a )?nouveau/i,
            /votre paiement (a )?[ée]chou[ée]|le paiement (a )?[ée]chou[ée]/i, /impossible (de traiter|d'[\u2019 ]?effectuer|de r[ée]aliser) (votre |le |la )?paiement/i,
            /mettre [àa] jour (votre )?(moyen|mode) de paiement/i, /probl[èe]me (avec|lors) (du |de votre |de la )?paiement/i,
            // de
            /konto (ist |wurde )?(ausgesetzt|gehalten|pausiert)|auf hold/i, /zahlung (erneut versuchen|nochmals versuchen|fehlgeschlagen|konnte nicht|wurde abgelehnt)/i,
            /deine (letzte )?zahlung (konnte|k[öo]nnen wir) nicht/i, /aktualisiere (deine )?zahlungsinformationen|zahlungsmethode (zu )?aktualisieren/i,
            /mitgliedschaft (wurde )?(pausiert|angehalten)/i,
            // it
            /account (è |e )?(in pausa|sospeso)|account in attesa/i, /riprova (il |con il |il tuo )?pagamento/i,
            /non (è stato possibile|riusciamo|siamo riusciti) (a |di )?elaborare (il |il tuo |il pagamento)/i, /aggiorna (il tuo |il )?metodo di pagamento|aggiorna i dati di pagamento/i,
            /problema (con |nell'[\u2019 ]?elaborazione del )(il |tuo )?pagamento/i,
            // nl
            /account (is |werd )?(gepauzeerd|in de wacht|opgeschort)/i, /probeer je betaling (opnieuw|weer)/i,
            /betaling (is )?(mislukt|kon niet worden verwerkt)/i, /werk (je |uw )?betaalmethode bij/i, /probleem met je betaling/i,
            // pl
            /konto (jest )?wstrzymane/i, /pon[óo]w pr[óo]b[ęe] p[łl]atno[śs]ci|ponowienie p[łl]atno[śs]ci/i,
            /p[łl]atno[śs][ćc] nie (powiod[łl]a si[ęe]|udana|zosta[łl]a przetworzona)/i, /nie uda[łl]o si[ęe] przetworzy[ćc] p[łl]atno[śs][ćc]/i,
            /zaktualizuj (metod[ęe] )?p[łl]atno[śs]ci/i,
            // ro
            /contul (t[ăa]u )?(este |a fost )?(suspendat|[iî]n pauz[ăa]|pe hold)/i, /re[sîi]ncearc[ăa] plata|reia plata/i,
            /plata (a e[șs]uat|nu a putut fi procesat[ăa])/i, /[ée]e[șs]uat[ăa] [ăa]?(ncercarea de )?plat/i, /actualizeaz[ăa] (metoda de )?plat[ăa]/i,
            // ru
            /(учетная запись|аккаунт) (приостановлен[ао]?|на паузе)/i, /повторите (платеж|платёж|попытку оплаты)|повторить (платеж|платёж)/i,
            /не удалось (обработать|Совершить) (ваш |последний |) ?(платеж|платёж)/i, /обновить (способ|метод) (оплаты|платежа)/i,
            // uk
            /обліковий запис (призупинено|заблоковано|на пауз[іі])/i, /повтор[іі]ть платіж/i,
            /не (вдалося|вдалося) обробити (ваш |останній )?платіж/i, /оновити (спосіб )?оплати/i,
            // tr
            /hesabınız (askıda|durduruldu|gecici olarak durduruldu)/i,             /[öo]demeyi (yeniden |tekrar )?deneyin/i,
            /[öo]deme (al[ıi]namad[ıi]|ba[şs]ar[ıi]s[ıi]z)/i, /[öo]deme yöntemini güncelle/i,
            // id
            /akun (anda )?(ditangguhkan|ditahan|dijeda)/i, /coba lagi (pembayaran|bayaran)/i,
            /pembayaran (anda )?(tidak bisa diproses|gagal)/i, /perbarui (metode )?(pembayaran|cara bayar)/i,
            // sv / da / no
            /ditt konto har (pausats|stängts av)/i, /f[öo]rs[öo]k betala igen|försök igen med betalningen/i,
            /betalningen (kunde inte genomf[öo]ras|misslyckades)/i, /uppdatera din betalningsmetod/i,
            /din konto er p[åa] hold/i, /pr[øo]v din betaling igen/i, /opdater din betalingsmetode/i,
            // fi
            /tilisi on pidossa|tilisi on keskeytetty/i, /yrit[äa] maksua uudelleen/i, /maksua ei voitu k[äa]sitell[äa]/i,
            // el
            /ο λογαριασμ[οό]ς σας (είναι |βρίσκεται )?σε αναμονή/i, /δοκιμ[άα]στε ξαν[άα] (την |τη )?πληρωμ[ήή]/i,
            /η πληρωμ[ήή] απ[έe]τυχε/i, /ενημ[έe]ρ[ωω]σ[ηe] (τ[οο]υ |της )?τρόπου πληρωμ[ήή]ς/i,
            // he
            /החשבון שלך בהמתנה|החשבון מושהה/i, /[ננ]ס{0,2}ה שוב את התשלום/i, /עדכון אמצעי התשלום/i,
            // ar
            /حسابك (معلق|في وضع الانتظار|موقوف مؤقتا|تم تعليق حسابك)/i, /أعد محاولة الدفع|إعادة محاولة الدفع|أعد الدفع/i,
            /لم نتمكن من معالجة (دفعتك|الدفعة|الدفع|مدفوعتك)/i, /تحديث وسيلة الدفع|تحديث طريقة الدفع/i,
            // hi
            /आपका खाता (रोक दिया गया|स्थगित कर दिया|रुक गया है)/i, /भुगतान (फिर से|दोबारा) करें/i,
            /(हम|हमारे द्वारा) भुगतान संसाधित नहीं कर सके|भुगतान संसाधित नहीं हो सका/i, /अपना भुगतान (तरीका|विधि) अपडेट करें/i,
            // th
            /บัญชีของคุณ(ถูก)?(ระงับ|พักไว้|หยุดชั่วคราว)/i, /ลองชำระเงินอีกครั้ง/i, /อัปเดตวิธีการชำระเงิน/i,
            // vi
            /tài khoản của bạn (bị )?(tạm dừng|đình chỉ|tạm ngừng)/i, /thanh toán (lại|thất bại)/i, /thử thanh toán lại|thu tiền lại/i,
            /cập nhật (phương thức )?thanh toán/i,
            // ja
            /アカウントが(一時)?停止(中)?|お支払いを再試行/i, /(最後|前回)のお支払いを処理できませんでした/i,
            /お支払い方法(を更新|の更新)/i,
            // zh
            /(账户|帐户|帳戶)(已)?(暂停|暫停|被暂停)/i, /(重新付款|重试付款|再次尝试付款|重新嘗試付款)/i,
            /无法处理(您|你的|您的)?(上次)?(的)?付款/i, /(更新|更新您的)(付款方式|支付方式)/i,
            // ko
            /계정이 (일시 )?중지(되었|됐)/i, /결제를 (다시|재시도) ?(하세요|해 보세요|시도)/i, /(마지막 )?결제(를)? (처리하지 못했|실패)/i,
            /결제 수단을 업데이트/i,
            // tl
            /naka-hold ang (iyong |ang )?account|account (is )?on hold/i, /subukang muli ang (iyong )?pagbabayad|subukan muli ang bayad/i,
            /hindi naiproseso ang (iyong |huling )?pagbabayad/i, /i-update ang (paraan ng )?pagbabayad/i,
            // ms
            /akaun anda (ditangguhkan|ditahan)/i, /cuba semula pembayaran/i, /kemas kini (kaedah )?pembayaran/i
          ].some((re) => re.test(t));
          if (paymentHold) return { v: 'hold', nextLabel };

          // ── STRUCTURAL: a cancelled membership offers a way back ──
          //
          // The wording check below needs thirteen languages and will still miss
          // the fourteenth. This needs none. A cancelled account offers a route
          // to re-subscribe, and that route is a link - to /signup, /checkout or
          // /plans. A live account's account page only offers account management.
          const resubscribeLink = document.querySelector(
            'a[href*="/signup" i], a[href*="/checkout" i], a[href*="/plans" i], a[href*="/subscribe" i], a[href*="/rejoin" i]'
          );
          const manageLink = document.querySelector(
            'a[href*="/membership" i], a[href*="/cancelplan" i], a[href*="/payment" i]'
          );
          // Only fatal when there is nothing that says the membership is managed.
          // Both present is genuinely ambiguous, so unknown is the honest answer.
          if (resubscribeLink && !manageLink) return { v: 'dead', nextLabel };

          /* ── The ad-supported plan ───────────────────────────────────────
           *
           * An ad plan is a real, paid, working subscription - it passes every
           * check above. It is also the thing customers most often land in and
           * cannot use: Netflix serves this error instead of playing anything,
           *
           *     "Seu plano com anúncios não está disponível nesta região"
           *
           * because the ad tier is only sold in a subset of countries. The user
           * is signed in, on the right plan, and gets a dead end.
           *
           * Graded as dead rather than regional because it is not this customer's
           * region at fault and not this account's fault either - the pair simply
           * does not work together, and the pool is sold as a working account.
           * A regional miss would be judged against the person streaming it.
           *
           * The wording is the only signal here; Netflix renders the plan name as
           * text and exposes nothing structural for it. "Ads" alone is too loose -
           * it appears in footer and legal copy on pages that have nothing to do
           * with the tier - so it is anchored to a plan name.
           */
// "Netflix Estándar con anuncios" has an ACCENTED tier name in the middle, and
             // \w does not match "á" in JavaScript - so a \w-based gap silently
             // missed Spanish while catching German. The plan name is matched as
             // TWO language lists - the tier word and the ads word - that must
             // land within a short run of the same line, in either order, because
             // some languages put the ads word first ("Reklamlı Standart"). The
             // Arabic page in the wild adversary ("الخطة القياسية مع إعلانات")
             // is the case that motivated this: the plan card carries no
             // "netflix" word to anchor the old regexes, so the extension graded
             // a with-ads plan live and handed it over.
             //
             // \p{L} runs instead of \w for the same reason: those classes work
             // for Arabic, Cyrillic, Greek and CJK too.
             const adsWord = [
               'ads', 'adverts', 'advertenties',
               'an[uú]nci[oa]s', 'publicit[ée][\\p{L}]*', 'werbung', 'pubblicit[àa]',
               'reklam[\\p{L}]*', 'реклам[\\p{L}]{0,4}', 'iklan', 'qu[ảáâa]ng\\s?c[ảáâa]o', 'โฆษณา[\\p{L}]*',
               '広告', '廣告', '广告', '광고', 'إعلانات', 'إعلان', 'פרסומות', 'διαφημίσεις'
             ].join('|');
             const tierWord = [
               // standard everywhere (incl. pl standardowy, tr standart, nl standaard)
               'stand[\\p{L}]{0,8}', 'est[aá]nd[\\p{L}]{0,3}', 'padr[ãa]o',
               // basic
               'b[aá]sic[\\p{L}]{0,2}', 'c[ơo]\\s?b[aả]n', 'βασικ[\\p{L}]{0,3}',
               // premium
               'pr[ée]mium', 'プレミアム', '프리미엄', 'премиум',
               // ru/uk variants, ar, he, el, ja, zh, ko, th, vi
               'стандарт[\\p{L}]{0,4}', 'базов[\\p{L}]{0,4}',
               'قياس[\\p{L}]{0,4}', 'أساس[\\p{L}]{0,3}', 'بريميوم',
               'סטנדרט', 'בסיסי', 'פרימיום',
               'σταντ[\\p{L}]{0,3}', 'スタンダード', '標準', '标准', '기초',
               '스탠다드', 'มาตรฐาน', 'พื้นฐาน', 'ti[eê]u\\s?chu[\\p{L}]{0,2}n'
             ].join('|');
             // No word boundaries on purpose. Letters in Arabic and Hebrew fuse
             // into single words ("القياسية مع إعلانات" - the definite article
             // is glued to the tier word), Japanese compounds its markers
             // ("広告つきスタンダード"), and any \b-style boundary is defined
             // against ASCII \w, so it REJECTS those positions. The gap limit
             // of 40 characters on one line is what keeps this tight, not a
             // boundary. Compact-script plan names are additionally anchored
             // as full phrases below, which cannot be tripped by scattered words.
             const TIER = '(?:' + tierWord + ')';
             const ADS = '(?:' + adsWord + ')';
             const adPlan = /\bstandard\s+with\s+ads\b|\bwith\s+ads\b|\badvert-?supported\b|\bad-?supported\b/i.test(t)
             || new RegExp(TIER + '[^\\n]{0,40}?' + ADS, 'iu').test(t)
             || new RegExp(ADS + '[^\\n]{0,40}?' + TIER, 'iu').test(t)
             || /広告つき|広告付き|含广告|含廣告|광고 포함|광고형|有广告|有廣告|مع إعلانات/i.test(t);
          if (adPlan) return { v: 'ads', nextLabel };

          // Evidence of a live plan. Reported for the log, and deliberately NOT
          // required: the bundled account in the scrape has no payment date, so
          // making a date mandatory would have thrown away a working account.
          // The tier word sits on either side of "plan" depending on language -
          // "Premium plan" in English, "Plan Estándar" in Spanish - so both
          // orders are accepted instead of assuming the English one.
          if (/next payment|pr[óo]ximo (pago|pagamento)|prochain paiement|n[äa]chste zahlung|su[cs]unod na pag+bayad|urm[ăa]toarea plat|volgende betaling|nexta betalning/i.test(t)) return { v: 'live', nextLabel };
          // Tagalog: "Susunod na pagbabayad" (next payment) and "I-manage ang
          // membership". The page doubles the b in "pagbabayad" and prefixes the
          // noun with a linker, so the patterns missed it and a working Tagalog
          // account was graded unknown - i.e. skipped.
          if (/manage (your |ang |the )?membership|manage (your |ang |the )?plan|manage plan|gestionar (la |ang )?(membres[íi]a|suscripci[óo]n)|kelola keanggotaan|administrar membres[íi]a/i.test(t)) return { v: 'live', nextLabel: nextLabel || '' };
          return { v: 'unknown', nextLabel, len: t.length };
        }
      });
      const raw = (res && res[0] && res[0].result) || null;
      const v = (raw && raw.v) || 'unknown';
      // A /account URL is REACHED before the SPA has hydrated: body text is
      // then a stub, every wording check reads nothing, and the stub used to
      // grade 'unknown' straight to ok - which is exactly how a suspended
      // account with a late-rendering banner got accepted, with no dates
      // stored either. Never trust an unknown that came from a nearly empty
      // page; wait for the next sample instead.
      if (v === 'unknown' && ((raw && raw.len) || 0) < 80) continue;
      let verdict = v === 'dead' ? 'dead' : (v === 'ads' ? 'ads' : (v === 'hold' ? 'hold' : (v === 'live' ? 'live' : 'unknown')));
      // The date half. Parsed from the window the page handed back, using the
      // generated month table - so a next-payment line in ANY language either
      // lands here as a timestamp or as nothing at all. A date already behind
      // us is the language-free override: a live account never shows a due
      // date that has passed, while a suspended one does (the "retry payment"
      // banner prints the same future-or-past date, so wording stays the
      // primary signal and the date is the second net under it).
      let nextPayment = 0;
      if (raw && raw.nextLabel) {
        const ms = parseBillingDateWindow(raw.nextLabel);
        if (ms) {
          nextPayment = ms;
          if (ms < Date.now() - 36 * 3600000 && verdict !== 'dead' && verdict !== 'ads') verdict = 'hold';
        }
      }
      try { console.debug('[kizar:netflix] account page said ' + verdict + (nextPayment ? ' · renews ' + new Date(nextPayment).toISOString().slice(0, 10) : '')); } catch (e) {}
      return { verdict, nextPayment, why: (raw && raw.why) || '' };
    } catch (e) {
      // The tab was mid-navigation or the scripting bridge hiccuped - neither
      // is a verdict. Samples remain in the loop; only their exhaustion
      // returns the final unknown below.
      continue;
    }
  }
  return { verdict: 'unknown', nextPayment: 0 };
}

// ── Structural-first checking ─────────────────────────────────────────────
//
// Every check here used to lean on wording, and wording is the one thing that
// cannot be made complete: a list covering ten languages still misses the
// eleventh, and a wrong verdict either hands a user a dead account or throws
// away a good one.
//
// So the PRIMARY signals are structural - URLs, link targets and element
// presence. Those are identical in every locale, which means a language nobody
// tested still works. The word lists stay, but only as a second layer for the
// cases that have no structural marker at all. Established from a real scrape of
// ten random Crunchyroll accounts; the same approach applies to Netflix and Prime.

// ── Crunchyroll: session from the footer, entitlement from /account ────────
// Two things a real scrape of 10 random accounts settled.
//
// 1. The homepage advertises "7-Day Free Trial / Premium access includes
//    unlimited anime" to EVERYONE - live members included. Three of the good
//    accounts in the sample rendered it. So that banner is worthless as a signal
//    on its own, and treating it as one would have thrown away good accounts.
//
// 2. What DOES separate them is the footer. A signed-in account shows
//    "History  My Account  Redeem Gift Card  Log Out". A signed-out one shows
//    "Create Account  Log In  Redeem Gift Card" and has no Log Out at all, in
//    any language. That is structural and survives a language change.
//
// Entitlement is a separate question again, answered on /account/membership: a
// member shows "Membership Information / Manage Payment Methods / Billing
// History", while a free account shows "Go Premium". One account in the sample
// was signed in AND free - it would have passed every session check and then
// hit a paywall.
async function crunchyrollMembershipVerdict(tabId) {
  try {
    await chrome.tabs.update(tabId, { url: 'https://www.crunchyroll.com/account/membership', active: false });
  } catch (e) {
    return 'unknown';
  }
  for (let i = 0; i < 7; i++) {
    await sleep(800);
    let tab = null;
    try { tab = await chrome.tabs.get(tabId); } catch (e) { return 'unknown'; }
    const u = tab.url || '';
    // The scrape showed /account bounces to sso.crunchyroll.com/authorize with an
    // empty document when the session is not good enough for that page. That is
    // not proof of a paid membership, but it is proof the account cannot be used.
    if (/sso\.crunchyroll\.com|\/login\b/i.test(u)) return 'dead';
    if (u.indexOf('/account/membership') < 0) continue;
    try {
      const res = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          const t = ((document.body ? document.body.innerText : '') || '').replace(/\s+/g, ' ');
          // STRUCTURAL first. A signed-out page offers a login/signup link and has no
          // logout control; that pair of facts is identical in every locale, and
          // it is what decided this rather than any list of words. The earlier
          // version also demanded "Create Account", which the Spanish and
          // Portuguese captures had already lost to truncation - a rule that
          // quietly fails in exactly the locales it was meant to cover.
          const hasLoginLink = !!document.querySelector(
            'a[href*="/login" i], a[href*="/signin" i], a[href*="/signup" i], a[href*="/register" i], a[href*="/auth" i]'
          );
          const hasLogOutLink = !!document.querySelector('a[href*="/logout" i], a[href*="/signout" i], [class*="logout" i]');
          if (hasLoginLink && !hasLogOutLink) return 'dead';
          if (/\blog ?out\b|cerrar sesi[oó]n|sair da conta/i.test(t) &&
              /\b(log ?in|sign ?in|acceder|entrar|login)\b/i.test(t)) return 'dead';
          if (/membership information|informaci[oó]n de (la )?(membres[íi]a|suscripci[oó]n)|manage payment methods|gestionar (los )?m[ée]todos de pago|facturaci[oó]n|billing history/i.test(t)) return 'live';
          if (/\bgo premium\b|\bstart (a )?free trial\b|\bupgrade\b|\bhazte premium\b|\bmejora a premium\b/i.test(t)) return 'dead';
          return 'unknown';
        }
      });
      const v = (res && res[0] && res[0].result) || 'unknown';
      try { console.debug('[kizar:cr] membership page said ' + v); } catch (e) {}
      // 'ads' has to survive this mapping. It used to fall through to 'unknown',
  // which reads as "not proven dead, hand it over anyway" - the exact bug.
  return v === 'dead' ? 'dead' : (v === 'ads' ? 'ads' : (v === 'live' ? 'live' : 'unknown'));
    } catch (e) {
      return 'unknown';
    }
  }
  return 'unknown';
}

// ── Prime: Account & Settings ──────────────────────────────────────────────
//
// Being able to sign in is not the same as having Prime. Amazon hands a signed
// OUT or Prime-less account a perfectly normal-looking video homepage, so every
// check that stops there has to guess from copy - and guesses wrong.
//
// Account & Settings is the page that only a real account reaches. It carries
// the subscription-management tabs (Your account / Subscriptions / Orders /
// Player / Devices / Watch History) and the "Edit on Amazon" control. If that page
// loads, the session is real and the account is worth handing over. If it bounces
// to a sign-in form, it is not - regardless of what the homepage looked like.
//
// Structure only: the tab labels are rendered as links and buttons, and the URL
// itself changes, so none of this depends on wording.
// A LIST of routes, tried in order.
//
// The first version went straight to /ap/settings, and that page answers "Page
// Not Found" for these accounts - so the gate could never reach a verdict and
// every Prime account fell through unverified. Amazon has moved this page around
// more than once, so a single URL is not something to rely on: whichever of them
// actually renders is the one that answers.
//
// Order matters, and it was backwards. /ap/settings is the most-tempting name and
// the least reliable door: it answers "Sorry, we couldn't find that page" for any
// account whose marketplace is not amazon.com, and trying it first meant the
// probe opened a 404 for the customer to look at and then stalled there. The
// pages below are the ones that render for a signed-in account, so they go first
// and /ap/settings is only reached if all of them fail.
const PRIME_ACCOUNT_ROUTES = [
  'https://www.amazon.com/gp/css/homepage.html',
  'https://www.amazon.com/ap/orders',
  'https://www.amazon.com/hz/your-memberships-and-orders',
  'https://www.amazon.com/ap/settings'
];
const PRIME_ACCOUNT_PAGE = /\/(ap\/settings|ap\/orders|ap\/your-orders|gp\/css\/homepage|hz\/your-memberships)/i;

// ── The Subscriptions page ──
//
// Hardcoding an account URL was the wrong shape. Amazon 404s /ap/settings for any
// account whose marketplace is not amazon.com, which is why the probe used to park
// the customer on a dog picture. The page that actually settles the question is
// reachable the same way a person reaches it: the account menu -> "Account &
// Settings" -> "Subscriptions".
//
// That also solves the language problem. Menu labels change per locale, so they
// are matched by their stable href wherever Amazon gives one and by an explicit
// word list otherwise. The verdict itself needs no translation at all: the rows
// are named products, and the product we care about is called "Prime" in every
// Amazon locale. A row with no Prime in it is the answer.
// The menu labels Amazon renders, per locale. These are only needed for the
// clicking fallback - the pages are reached by URL first - but a locale missing
// from these lists means the fallback silently does nothing there.
const PRIME_MENU_WORDS = 'account|cuenta|compte|konto|conto|reken|contas|conta|hesap|account|уч[её]тн|アカウント|계정|账户|حساب';
const PRIME_SETTINGS_WORDS = 'settings|configuraci|param[eè]tres|einstellungen|instellingen|configura|ajustes|r[eé]glages|ayarlar|设置|paramètres|設定|설정|설정|إعدادات';
const PRIME_SUBS_WORDS = 'suscripciones|subscriptions|memberships|abonnements|mitgliedschaften|abbonamenti|abonnementen|assinaturas|assinei|membership|подписк|購読|구독|订阅|اشتراك';

// One step of the walk: run a snippet in the page, wait, and let it report.
async function primeMenuStep(tabId, func, arg) {
  const out = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: func,
    args: arg === undefined ? [] : [arg]
  });
  return !!(out && out[0] && out[0].result);
}

// A signed-out session is the one failure that is proof on its own: Amazon sends
// it to a sign-in page, and no working account is ever sent there. This is
// checked separately from "the click did not work", because a menu that moved or
// renamed is no evidence either way and must not delete anything.
const PRIME_SIGNIN_URL = /\/(ap\/signin|gp\/sign-in|signin|sign-in|ap\/sign-in)\b/i;

async function primeHitSignin(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    return PRIME_SIGNIN_URL.test(tab.url || '');
  } catch (e) {
    return false;
  }
}

// Read the membership page once. Every language, no translation needed.
//
// The Prime Video settings page states the membership outright, which is much
// stronger than scraping a list: a member sees the plan with its price
// ("Prime Video (NGN 2,300.00/month)"), the next charge date, an "End
// membership" button and the payment method. A signed-in account without Prime
// sees none of that - it gets a subscribe/join call to action instead.
//
// "Prime Video" is the product name in every Amazon locale, and the price and
// renewal date are numbers, so none of this needs translating.
async function readPrimeSubs(tabId) {
  const read = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: () => {
      // A password field on an account route means the session lapsed between
      // navigation and reading. A real signed-in member is never shown one.
      if (document.querySelector('input[type="password"]')) return 'dead';
      const title = document.title || '';
      const whole = ((document.body && document.body.innerText) || '').trim();
      // This door does not exist for this account. That is not evidence about
      // the account, so it is passed up as "notfound" and another door is tried.
      if (/page not found|couldn'?t find that (page|thing)|dogsofamazon|meet the dogs/i.test(title + ' ' + whole.slice(0, 900))) return 'notfound';

      // "terminada en 0512" / "ending in 9247" is the card's last four digits.
      // It reads like an expiry and is not one - treating it as one deleted
      // healthy accounts. Both phrasings are removed before anything is judged.
      const text = whole.replace(/terminad[ao]\s+en\s+\d+/gi, ' ')
        .replace(/ending\s+in\s+\d+/gi, ' ')
        .replace(/terminant\s+par\s+\d+/gi, ' ')
        .replace(/endend\s+auf\s+\d+/gi, ' ');

      // ── The strong read: the settings page showing a live membership ──
      //
      // This page states membership in plain words, and the wording differs
      // between the two layouts Amazon serves. One account shows
      // "Prime Video (NGN 2,300.00/month)" with an "End membership" button; an
      // ad-free account shows a "Prime membership" heading with "Manage or
      // cancel", an "AD FREE" badge and "Auto-renews: Monthly, Oct 22, 2026".
      // Both are members, and reading only the first layout meant the second was
      // never recognised.
      //
      // "Prime membership" is the heading in every locale, so it needs no
      // translating - only the word "membership" does. Amazon sells Prime well
      // beyond the Latin scripts, so that word covers Japanese, Korean, Chinese,
      // Russian, Arabic and Turkish as well, not just Western Europe and the US.
      const MEMBERSHIP_WORD = '(membership|memberships|member|membre|membres[ií]a|mitgliedschaft|abonnement|abbonamento|lidmaatschap|assinatura|suscripci[oó]n|[üi]yelik|членств|会員|멤버십|会员|عضوية)';
      const primeSection = new RegExp('prime\\s*(video)?\\s*' + MEMBERSHIP_WORD, 'i').test(text)
        || new RegExp(MEMBERSHIP_WORD + '\\s*(de\\s+|of\\s+|for\\s+)?prime', 'i').test(text);
      const hasPlan = /\bprime\s*(video)?\s*\([^)]*\/(month|mes|m[eê]s|monat|mese|jaar|ano|месяц|мес|か月|개월|달)/i.test(text);
      // Only a member is offered the controls to change or stop their plan.
      const canEnd = /(end\s+membership|end\s+your\s+membership|cancel\s+membership|manage\s+or\s+cancel|manage\s+your\s+membership|manage\s+membership|cancel\s+ad\s*free|edit\s+payment|set\s+payment\s+method|manage\s+payment\s+method|manage\s+wallet|end\s+prime|change\s+plan|terminar\s+membres[ií]a|administrar\s+o\s+cancelar|cancelar\s+membres[ií]a|gestionar\s+o\s+cancelar|g[eé]rer\s+ou\s+annuler|verwalten\s+oder\s+k[uü]ndigen|abonnement\s+k[uü]ndigen|mitgliedschaft\s+beenden|gestisci\s+o\s+annulla|abbonamento\s+(annulla|gestisci)|beheren\s+of\s+opzeggen|abmelden|[iı]ptali\s+et|[öü]yelik|[зв]ык[аa]ть|会員を終了|退会|해지|취소|取消|إلغاء)/i.test(text);
      // The ad-free tier says so in words, and again as a badge.
      const adFree = /(ad[\s-]?free|sin\s+anuncios|sans\s+publicit[eé]|ohne\s+werbung|senza\s+pubblicit[a-z]|zonder\s+advertenties|sem\s+an[uú]ncios|без\s+реклам|広告なし|광고\s*없는|무광고|无广告|بدون\s+إعلانات)/i.test(text)
        || /watching\s+prime\s+(movies|shows).*without\s+ads|ver\s+pel[ií]culas.*sin\s+anuncios/i.test(text);
      // An active plan states when it renews.
      const autoRenew = /(auto[\s-]?renew|auto[\s-]?renuev|renews?\s+(monthly|annually|on)|next\s+(charge|payment|renewal)|pr[oó]xima\s+(cobranza|carga|renovaci[oó]n)|renouvellement\s+(automatique|le)|automatische\s+verl[aä]ngerung|rinnovo\s+automatico|volgende\s+betaling|renova[cç][aã]o\s+autom[aá]tica|otomatik\s+yenileme|автопродление|自動更新|自动续订|자동\s*갱신)/i.test(text);

      // ── The strong read: the page saying it is over ──
      const ended = /(your\s+(prime\s+)?membership\s+has\s+(ended|expired|lapsed|been\s+cancelled)|membership\s+(has\s+)?(expired|ended|cancelled|lapsed)|your\s+plan\s+has\s+ended|plan\s+expired|renewal\s+failed|no\s+active\s+membership|not\s+subscribed|membres[ií]a\s+(caducada|expirada|terminada)|abonnement\s+(expir[ée]|r[ée]sili[ée]e)|mitgliedschaft\s+abgelaufen|abbonamento\s+(scaduto|annullato)|lidmaatschap\s+verlopen|üyelik\s+(sona\s+erd[iı]|bitti)|подписк[аи]\s+(законч|отменен|истек)|会員[がは]\?.*(終了|期限切れ)|만료|已过期|انتهت)/i.test(text);
      // ── And the call to action that only a non-member is shown ──
      const joinCta = /(join\s+prime|start\s+(your\s+)?(free\s+)?trial|start\s+prime|subscribe\s+to\s+prime|get\s+prime|activate\s+prime|upgrade\s+to\s+prime|sign\s*up\s+for\s+prime|[úu]nete\s+a\s+prime|prueba\s+gratis|aprovecha|ab[oó]nate|abbonnieren|start\s+je\s+gratis|abbonnati|assine|come[çc]ar|essai\s+gratuit|prime\s+(bir)?\s*al|начать\s+проб|心来|開始|已开始|ابدأ|اشترك)/i.test(text);

      if (ended) return 'dead';
      // A member, decided by what the page offers them. The controls to change or
      // stop a plan, and the membership heading, are only ever shown to somebody
      // who has one - a signed-in account without Prime gets the subscribe call
      // to action instead. Two weaker signals together also count, because
      // "AD FREE" and an auto-renew date only appear on a real plan.
      if (primeSection || hasPlan || canEnd) return 'live';
      if (adFree && autoRenew) return 'live';
      if (joinCta) return 'dead';

      // ── Fallback for the retail memberships page: read the actual list ──
      const cancelRe = /\b(cancelar|cancel|annuler|k[uü]ndigen|annulla|annuleren|afmelden|cancelamento)\b/i;
      const expireRe = /\b(expired|expiration|expirada|expirado|vencida|vencido|abgelaufen|scaduta|scaduto|verlopen|renewal\s+failed|gek[uü]ndigt|annullata|geannuleerd|resili[eé]e|cancelada|cancelado|cancelled|canceled)\b/i;
      // The product name, in every script Amazon sells it in. "Prime" is Latin
      // nearly everywhere, but Japan, Korea and China spell it out.
      const primeRe = /prime|プライム|프라임|برايم|պրայմ/i;
      const dateRe = /\b(\d{1,2}\s*(de\s+)?(ene|jan|feb|mar|abr|apr|may|mai|mag|jun|jul|ago|aug|set|sep|oct|nov|dic|dec)|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|20\d{2})\b/i;
      const moneyRe = /([A-Z]{3}\s?\d|\d+[.,]\d{2}\s*(\/|per\s)?\s*(month|mes|m[eê]s|monat|mese|jaar|ano))/i;

      const climb = (el) => {
        let n = el;
        for (let i = 0; i < 7 && n.parentElement; i++) {
          n = n.parentElement;
          const t = (n.innerText || '').trim();
          if (t.length > 15 && t.length < 400) return t;
        }
        return '';
      };
      const cancels = Array.from(document.querySelectorAll('a[href*="cancel" i],button,a')).filter((el) => {
        const t = (el.innerText || el.textContent || '').trim();
        return t && t.length < 30 && cancelRe.test(t);
      });
      let rows = cancels.map(climb).filter(Boolean);

      // Rows were only ever found by their Cancel button, so a paying Prime
      // account whose row exposes no Cancel control looked identical to an
      // account with no Prime in it - and was deleted. Plenty of rows show a
      // renewal date and a price and nothing to click, so those are read too.
      if (!rows.length) {
        rows = Array.from(document.querySelectorAll('div,li,tr'))
          .map((n) => (n.innerText || '').trim())
          .filter((t) => t && t.length > 15 && t.length < 300 && dateRe.test(t) && moneyRe.test(t));
      }
      if (!rows.length) return 'unknown';

      // Prime counts only when it sits in a row that is really a subscription.
      // "Join Prime" is marketing on the same page, and reading it as membership
      // is how a non-member gets called a member.
      const primeRows = rows.filter((t) => primeRe.test(t) && (cancelRe.test(t) || dateRe.test(t)));
      if (primeRows.length) {
        const cleaned = primeRows.map((t) => t.replace(/terminad[ao]\s+en\s+\d+/gi, ' ').replace(/ending\s+in\s+\d+/gi, ' '));
        if (cleaned.some((t) => expireRe.test(t))) return 'dead';
        return 'live';
      }
      // The list rendered, it holds real subscriptions, and Prime is not among
      // them. That account is not a member.
      return 'dead';
    }
  });
  return (read && read[0] && read[0].result) || 'unknown';
}

// Wait for the page to stop changing instead of guessing how long it takes.
//
// A fixed sleep was the other half of the false-positive problem: read too early
// and the list is half-painted, so a real Prime row is missing and a paying
// customer gets deleted. Polling until the text stops growing costs only as long
// as the page actually needs.
async function primeSettle(tabId) {
  let last = -1;
  let stable = 0;
  for (let i = 0; i < 16; i++) {
    await sleep(500);
    let n = 0;
    try {
      const r = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => (document.body ? document.body.innerText.length : 0)
      });
      n = (r && r[0] && r[0].result) || 0;
    } catch (e) {
      return false;
    }
    if (n === last && n > 200) {
      if (++stable >= 2) return true;
    } else {
      stable = 0;
    }
    last = n;
  }
  return false;
}

// Prime has to be right, because getting it wrong deletes a paid account.
//
// The subscriptions list is a rendered page and can be caught mid-load: the Prime
// row not having painted yet looks exactly like Prime not being there. So a "not
// a member" reading is never acted on once. It is put aside, the page is given
// time to finish, and the list is read again. Only two agreeing reads - from the
// same fully-settled page - call it dead. A reading that changes to "live", or
// stops making sense, is discarded as unknown and the account is left alone.
async function primeSubscriptionsConfirmed(tabId) {
  const first = await readPrimeSubs(tabId);
  if (first !== 'dead') return first;
  await sleep(1600);
  const second = await readPrimeSubs(tabId);
  try { console.debug('[kizar:prime] re-read said ' + second); } catch (e) {}
  if (second === 'dead') return 'dead';
  try { console.debug('[kizar:prime] not confirmed - not deleting'); } catch (e) {}
  return 'unknown';
}

// Go straight to the page that answers it.
//
// The pages that answer it, best first.
//
// The probe used to open the account menu and click through it - avatar, then
// "Account & Settings", then "Subscriptions". Three synthetic clicks in a header
// Amazon reshapes per locale and per A/B bucket, and a single miss gave up
// without trying anything else, which is what left good accounts unverified.
//
// The Prime Video settings page is the one that states the membership outright:
// plan, renewal and payment together, in whatever language the account is set
// to, and with no account-menu markup to miss. The retail memberships page is
// kept as the second try because it is the door the menu points at, and clicking
// is kept last for the accounts where neither URL renders.
const PRIME_SUBS_URLS = [
  'https://www.primevideo.com/settings?ref_=atv_sv_atv_6',
  'https://www.amazon.com/hz/your-memberships-and-orders'
];

async function primeMenuWalk(tabId) {
  try {
    // 1. Open the account menu. Amazon marks it by id on Prime Video, and by a
    //    locale-specific aria-label on the retail header, so both are tried.
    const opened = await primeMenuStep(tabId, (words) => {
      const re = new RegExp(words, 'i');
      const trig = document.querySelector('#nav-link-accountList')
        || document.querySelector('a.nav-a[href*="yourmemberships" i]')
        || document.querySelector('[data-testid*="account" i]')
        || Array.from(document.querySelectorAll('a[aria-label],button[aria-label]'))
          .find((el) => re.test(el.getAttribute('aria-label') || ''));
      if (!trig) return false;
      trig.click();
      return true;
    }, PRIME_MENU_WORDS);
    if (!opened) return 'unknown';
    await sleep(900);
    if (await primeHitSignin(tabId)) return 'dead';

    // 2. "Account & Settings". Href first - it is locale-independent - and the
    //    word list only as a fallback.
    const wentSettings = await primeMenuStep(tabId, (words) => {
      const re = new RegExp(words, 'i');
      const byHref = document.querySelector('a[href*="/ap/settings"], a[href*="/gp/css/homepage"]');
      const item = byHref || Array.from(document.querySelectorAll('a,button,li,div[role="menuitem"]'))
        .find((el) => re.test((el.innerText || '').trim()) && (el.innerText || '').trim().length < 60);
      if (!item) return false;
      item.click();
      return true;
    }, PRIME_SETTINGS_WORDS);
    if (!wentSettings) return 'unknown';
    await sleep(1400);
    if (await primeHitSignin(tabId)) return 'dead';

    // 3. The "Subscriptions" tab.
    const wentSubs = await primeMenuStep(tabId, (words) => {
      const re = new RegExp(words, 'i');
      const item = Array.from(document.querySelectorAll('a[href],button[role="tab"],li a'))
        .find((el) => {
          const href = el.getAttribute('href') || '';
          const t = (el.innerText || '').trim();
          return t && t.length < 60 && (re.test(t) || /membership|subscription/i.test(href));
        });
      if (!item) return false;
      item.click();
      return true;
    }, PRIME_SUBS_WORDS);
    if (!wentSubs) return 'unknown';
    await sleep(1600);
    if (await primeHitSignin(tabId)) return 'dead';
    return 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

// Go by URL first, clicking only if no URL renders.
async function primeSubscriptionsVerdict(tabId) {
  try {
    if (await primeHitSignin(tabId)) return 'dead';

    // Each page is allowed to finish loading before it is read, and a "not a
    // member" answer still has to survive a second read.
    for (const url of PRIME_SUBS_URLS) {
      try {
        await chrome.tabs.update(tabId, { url: url, active: false });
      } catch (e) {
        continue;
      }
      await sleep(600);
      if (await primeHitSignin(tabId)) return 'dead';
      await primeSettle(tabId);
      if (await primeHitSignin(tabId)) return 'dead';

      const v = await primeSubscriptionsConfirmed(tabId);
      try { console.debug('[kizar:prime] ' + url + ' said ' + v); } catch (e) {}
      // 'notfound' means this account has no such page and 'unknown' means nothing
      // could be read from it. Neither says anything about the account, so the
      // next door is tried rather than a verdict being guessed.
      if (v === 'live' || v === 'dead') return v;
    }

    await primeMenuWalk(tabId);
    if (await primeHitSignin(tabId)) return 'dead';
    await primeSettle(tabId);
    const viaMenu = await primeSubscriptionsConfirmed(tabId);
    try { console.debug('[kizar:prime] via menu said ' + viaMenu); } catch (e) {}
    return viaMenu === 'notfound' ? 'unknown' : viaMenu;
  } catch (e) {
    return 'unknown';
  }
}

async function primeSettingsVerdict(tabId) {
  for (const url of PRIME_ACCOUNT_ROUTES) {
    try {
      await chrome.tabs.update(tabId, { url: url, active: false });
    } catch (e) {
      continue;
    }
    for (let i = 0; i < 5; i++) {
      await sleep(700);
      let tab = null;
      try { tab = await chrome.tabs.get(tabId); } catch (e) { break; }
      const href = tab.url || '';
      // Bounced to a sign-in form. That IS the answer, and it reads the same from
      // every route - a real account is never sent there.
      if (/\/ap\/signin|\/gp\/sign-in|\/signin\b/i.test(href)) return 'dead';
      if (!PRIME_ACCOUNT_PAGE.test(href)) continue;
      let v = 'unknown';
      try {
        const res = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: () => {
            // A password field on an account route means the session lapsed
            // between navigation and reading.
            if (document.querySelector('input[type="password"]')) return 'dead';
            // Say so out loud when the route itself is the wrong door. Without
            // this the probe sat re-reading Amazon's 404 five times over three
            // seconds per route, which is what left the customer staring at a
            // dog picture while the popup said "Finding an account".
            const t = document.title || '';
            const b = (document.body && document.body.innerText || '').slice(0, 600);
            if (/page not found|sorry,? we couldn'?t find/i.test(t) ||
                /couldn'?t find that (page|thing)|page not found|dogsofamazon|meet the dogs/i.test(b)) return 'notfound';
            const hit = (re) => !!document.querySelector('a[href*="' + re + '"], button[aria-controls*="' + re + '"]');
            const tabs = hit('/ap/settings') || hit('/ap/orders') || hit('/ap/your-orders')
              || hit('/gp/css/homepage') || hit('/ap/mwp') || hit('/hz/your-memberships');
            const edit = !!document.querySelector('a[href*="/ap/profile" i], a[href*="/ap/edit" i], [id*="profileEdit" i]');
            if (tabs || edit) return 'live';
            // Nothing conclusive on a page that did render. "Page Not Found" is
            // NOT evidence of a bad account, so this stays unknown and the next
            // route is tried. Reporting it as dead is how a working account gets
            // deleted over a bad URL.
            return 'unknown';
          }
        });
        v = (res && res[0] && res[0].result) || 'unknown';
      } catch (e) {
        break;
      }
      try { console.debug('[kizar:prime] ' + url + ' said ' + v); } catch (e) {}
      // live or dead is decisive; unknown means try the next route.
      if (v === 'live' || v === 'dead') return v;
      // This door does not exist for this account. Move on now instead of
      // re-reading the same 404 four more times.
      if (v === 'notfound') break;
    }
  }
  return 'unknown';
}

// Render the indicator beside each platform.
//
// Not a number. A row of lights, one per allowed connect, that go out as they are
// spent. A number has to be read and mentally subtracted from a limit the user
// never saw; lights are read in one glance, they work when the limit is 2 or 7,
// and they never turn into "0 / 5" which reads like an error.
// One meter instead of one LED per connect.
//
// A row of dots is fine at 2 and 4 and unbearable at 12: PRO1 drew twelve 5px
// circles, which is wider than the card, noisy, and impossible to read at a
// glance - the eye cannot count twelve things. A filled track scales to any
// allowance without changing its size, and it still answers the only two
// questions that matter: is anything left, and roughly how much.
function paintRate(key, st) {
  const el = $('rate-' + key);
  if (!el) return;
  el.innerHTML = '';

  if (!st.known) {
    const offline = st.reason === RATE_FAIL.OFFLINE;
    // Dashed track: reads as "unknown" without inventing a value.
    const track = document.createElement('i');
    track.className = 'rate-meter' + (offline ? ' dashed' : '');
    el.appendChild(track);
    el.title = st.reason === 'no_key' ? 'Activate a key to stream'
      : (offline ? 'Cannot reach the server - streaming paused' : 'The server would not confirm this key');
    return;
  }

  if (st.unlimited) {
    // An infinity sign, not a dot of the same size as the LEDs: a ring here read
    // as "1 of 1", which is the worst possible thing to tell a customer with
    // unlimited connects. A symbol cannot be miscounted as a quantity.
    const inf = document.createElement('span');
    inf.className = 'rate-unlimited';
    inf.textContent = '\u221E';
    inf.setAttribute('aria-label', 'Unlimited connects');
    el.appendChild(inf);
    el.title = 'Unlimited connects on ' + platformDisplayName(key);
    return;
  }

  const total = st.limit || 0;
  const pct = total > 0 ? Math.max(0, Math.min(100, (st.remaining / total) * 100)) : 0;
  const track = document.createElement('i');
  track.className = 'rate-meter';
  const fill = document.createElement('i');
  fill.className = 'rate-fill' + (st.allowed ? '' : ' spent');
  // Never a bare 0 for "empty": an invisible bar and an absent bar look identical,
  // and one of them is a real state. A 2px nub keeps the two apart.
  fill.style.width = pct > 0 ? pct + '%' : '2px';
  track.appendChild(fill);
  el.appendChild(track);

  const w = rateShortWait(st.resetInMs);
  el.title = st.allowed
    ? (st.remaining + ' of ' + total + ' connects left for ' + platformDisplayName(key))
    : ('No connects left for ' + platformDisplayName(key) + (w ? ' - resets in ' + w : ''));
  el.classList.toggle('spent', !st.allowed);
}

// beforeunload is the only thing the platform gives us against "they can't close
// it until it enters them". It cannot be made to block - a user who really wants
// out clicks Leave - but it is enough to turn a reflexive click-away into a
// conscious decision.
function installWaitGuard() {
  if (waitGuardOn) return;
  waitGuardOn = true;
  window.addEventListener('beforeunload', (e) => {
    if (!STATE.streaming) return;
    // Chrome requires returnValue to be set; the text itself is ignored.
    e.preventDefault();
    e.returnValue = '';
    return '';
  });
}

// state: { key, title, sub, step, index, total, pct, busy, done }
function showStreamWait(show, state) {
  const el = $('stream-wait');
  if (!el) return;
  const s = state || {};

  if (!show) {
    el.classList.add('hidden');
    el.classList.remove('done', 'fading', 't-netflix', 't-prime', 't-crunchyroll');
    return;
  }

  el.classList.remove('hidden', 'fading');
  el.classList.toggle('done', !!s.done);
  if (s.key) {
    el.classList.remove('t-netflix', 't-prime', 't-crunchyroll');
    el.classList.add('t-' + s.key);
  }

  // The screen says "Loading" and the platform name. Nothing else.
  //
  // It used to print which session was being tried, how many were left, and how
  // long it had been running. None of that is useful to someone waiting - it
  // reads like the app is doing something complicated, and it made a 10 second
  // wait feel like a long one. The detail now goes to the console, so a bad
  // account stays diagnosable without being on screen.
  // A permanent "Loading" said nothing and looked frozen. The headline now names what
  // is happening, and the platform sits under it as a small accent label.
  const waitKey = s.key || (document.querySelector('.stream-wait') || {}).className || '';
  const platName = s.key ? platformDisplayName(s.key) : '';
  const tEl = $('stream-wait-title');
  if (tEl) tEl.textContent = s.title != null ? s.title : ('Opening ' + (platName || 'stream'));
  const sEl = $('stream-wait-sub');
  if (sEl) sEl.textContent = s.sub != null ? s.sub : (platName || '');
  void waitKey;
  if (s.step) { try { console.debug('[kizar:stream] ' + (s.key || '') + ' ' + s.step); } catch (e) {} }

  const track = document.querySelector('.stream-wait-track');
  const pct = Math.max(0, Math.min(100, Math.round(s.pct || 0)));
  if (track) {
    track.setAttribute('aria-valuenow', String(pct));
    // The sweep is hidden while there is nothing filled to sweep, and again on
    // the success screen - it belongs to the progress, so it must not outlive it.
    track.setAttribute('data-pct', String(pct));
  }
  const fill = $('stream-wait-fill');
  if (fill) fill.style.width = pct + '%';

  // The hunt state is mirrored into session storage so an interrupted search is
  // RECOGNISED next time instead of being mistaken for a fresh one.
  try {
    chrome.storage.session.set({
      [WAIT_KEY]: {
        key: s.key || null,
        index: s.index || 0,
        total: s.total || 0,
        pct: Math.round(s.pct || 0),
        step: s.step || '',
        startedAt: s.startedAt || Date.now()
      }
    });
  } catch (e) {}
}

function getWaitState() {
  try { return chrome.storage.session.get(WAIT_KEY).then((r) => r[WAIT_KEY] || null).catch(() => null); }
  catch (e) { return Promise.resolve(null); }
}

function clearWaitState() {
  try { chrome.storage.session.remove(WAIT_KEY).catch(() => {}); } catch (e) {}
}

// Let the success register before the overlay is torn down.
function finishStreamWait(key, ms) {
  const el = $('stream-wait');
  if (!el) return;
  showStreamWait(true, {
    key, done: true, pct: 100, title: 'You are in', sub: 'Opening ' + platformDisplayName(key) + '…',
    step: 'Signed in successfully'
  });
  setTimeout(() => {
    el.classList.add('fading');
    setTimeout(() => {
      showStreamWait(false);
      clearWaitState();
    }, 300);
  }, ms || 700);
}

// ---------------------------------------------------------------------------
// GitHub fetch
// ---------------------------------------------------------------------------
function getOwnerToken() {
  // The embedded GitHub credential is retired: reads and writes go through the
  // Control Room proxy using the user's own activation key instead. Legacy
  // guards only ever probe this for truthiness, so a stable sentinel keeps
  // them working without shipping any secret in the build.
  return 'kizar-proxy';
}

// Fisher-Yates. Every account order in this file goes through here.
//
// Sessions are shuffled so repeated presses do not work down the same list in
// the same order, which made the pool's own ordering visible to users: whoever
// happened to be first in the source file was always tried first, every time,
// across every user on the same build.
function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ghProxyCall(payload) {
  const p = await getProfile();
  const key = (p.activations && p.activations.access) || '';
  let res;
  try {
    res = await fetch(CONTROL_ROOM + '/api/ops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-kizar-key': key },
      body: JSON.stringify(Object.assign({ action: 'gh' }, payload))
    });
  } catch (e) {
    const err = new Error('offline');
    err.status = 0;
    throw err;
  }
  let j = null;
  try { j = await res.json(); } catch (e) {}
  if (!res.ok || !j || j.ok === false) {
    const base = (j && j.error) || ('HTTP ' + res.status);
    const msg = String(base).indexOf(String(res.status)) >= 0 ? base : (res.status + ' ' + base);
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return j;
}

function proxyErrorReason(e) {
  const m = String((e && e.message) || e);
  if (m.indexOf('404') >= 0 || m.indexOf('notfound') >= 0) return 'notfound';
  if (m.indexOf('401') >= 0 || m.indexOf('403') >= 0 || m.indexOf('bad or expired key') >= 0) return 'auth';
  if (m.indexOf('409') >= 0 || m.indexOf('conflict') >= 0) return 'conflict';
  return m;
}

async function githubJson(path) {
  let lastErr = 'offline';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(400 * attempt);
    try {
      const j = await ghProxyCall({ op: 'read', file: path });
      return { sha: j.sha || '', content: j.content || '' };
    } catch (e) {
      const reason = proxyErrorReason(e);
      if (reason === 'notfound' || reason === 'auth') throw new Error(reason);
      lastErr = reason;
    }
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
  let lastErr = 'offline';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(400 * attempt);
    try {
      const j = await ghProxyCall({ op: 'read', file: filePath });
      return b64utf8(j.content || '');
    } catch (e) {
      const reason = proxyErrorReason(e);
      if (reason === 'notfound' || reason === 'auth') throw new Error(reason);
      lastErr = reason;
    }
  }
  throw new Error(lastErr);
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

function stripQuotes(v) {
  const t = String(v == null ? '' : v).trim();
  // Seller dumps often wrap values in literal double quotes (Amazon
  // session-token and x-main-av almost always). Browsers never store those
  // quotes: sending them verbatim corrupts the token and a working session
  // dies on sign-in. Strip one surrounding pair; interior quotes untouched.
  if (t.length > 1 && t.charAt(0) === '"' && t.charAt(t.length - 1) === '"') return t.slice(1, -1);
  return t;
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
    return [{ name, value: stripQuotes(t.slice(eq + 1)), domain: '', path: '/' }];
  }
  const f = t.split('\t');
  if (f.length >= 6) {
    return [{
      name: f[5] || '',
      value: stripQuotes(f.length > 6 ? f.slice(6).join('\t') : ''),
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
      func: (platformId) => {
        const body = document.body ? document.body.innerText : '';
        const title = document.title || '';
        const html = document.documentElement ? document.documentElement.innerText : '';
        const raw = document.documentElement ? document.documentElement.innerHTML.slice(0, 200000) : '';
        const allText = (body + ' ' + title + ' ' + html).slice(0, 20000);
        const isPrime = platformId === 'prime' || platformId === 'primevideo';

        // ── NETFLIX: the two walls about the CONNECTION, not the account ──
        //
        // · VPN/proxy dialog - "You seem to be using a VPN or proxy. Please
        //   turn off any of these services and try again." Netflix flags the
        //   IP, not the account: the same account streams fine for any user
        //   whose exit point is not flagged. 
        // · Region walls - "Netflix hasn't come to this region yet" / "not
        //   available in your country" for the IP's country, or an account
        //   bound to a country that does not serve this IP.
        //
        // Both are therefore marked 'region' - skipped for THIS user only and
        // NEVER reported to the shared pool - exactly like Prime's
        // "Travelling?" case. Reporting an account dead because one proxy got
        // flagged would erase a working account for every other user.
        //
        // The lite MYSTERY net: these dialogs also surface on /account, where
        // netflixSubscriptionVerdict re-runs the same checks.
        if (platformId === 'netflix') {
          const visible = body + ' ' + title;

          // ── The ads plan in an unsupported region ──
          //
          // "Your advert-supported plan is not available in this region."
          // The pool's customers are ALL in Algeria, and ads plans are not
          // sold there - so for every single user this account is a dead end:
          // it must be reported and erased from the shared pool, exactly like
          // the plain ads verdict on the account page. Checked BEFORE the
          // plain region walls, because this sentence also contains "not
          // available in this region" and would otherwise be mistaken for the
          // connection problem, which is skipped without a report.
          if (/(advert|ads?|publicit[ée]|werbung|an[uú]nci|pubblicit)[-\s\u00a0]*(supported|avec|mit|con)[-\s\u00a0]*plan is not available/i.test(visible) ||
              /supported plan is not available/i.test(visible) ||
              /plano (com|padr[ãa]o com|est[âa]ndar com|padrão com) an[uú]nci[oa]s n[ãa]o est[áa] dispon[íi]vel/i.test(visible) ||
              /plan (con|avec) (anuncios|publicit[ée]) n'??(est[aá]?|pas disponible)/i.test(visible) ||
              /n[ão]o est[áa] dispon[íi]vel nesta regi[ãa]o|no est[áa] disponible en esta regi[óo]n/i.test(visible) ||
              /n'?est pas disponible dans cette r[ée]gion/i.test(visible) ||
              /nicht verf[üu]gbar in dieser region/i.test(visible) ||
              /non [ée] disponibile in questa regione/i.test(visible)) {
            return '__NF_ADS_REGION__';
          }

          // ── VPN/proxy dialog ──
          //
          // "You seem to be using a VPN or proxy. Please turn off any of
          // these services and try again." Netflix flags the IP, not the
          // account: the same account streams fine for any user whose exit
          // point is not flagged, so it is skipped for THIS user only and
          // never reported - like the Prime "abroad" case. Reporting would
          // erase a working account for everyone else.
          if (/netflix\.com\/proxy/i.test(visible) ||
              /you seem to be using (a|an) (vpn|proxy|unblocker)/i.test(visible) ||
              (/\bvpn\b/i.test(visible) && /unblocker|\bproxy\b|代理|프록시|プロキシ/i.test(visible)) ||
              /turn off (any of )?(these|all) services/i.test(visible)) {
            return '__NF_VPN__';
          }
          if (/netflix (hasn'?t|has not|hasn t) come to this (region|country) yet/i.test(visible) ||
              /netflix isn'?t available in (your|this) (country|region)( just)? yet/i.test(visible) ||
              /not available in (your|this) (country|region)\b/i.test(visible) ||
              /different country than (the one )?(on|registered to|where) your account/i.test(visible) ||
              /account (is|was) (created|registered|set up) in (a )?(different|another) country/i.test(visible) ||
              /todav[íi]a no ha llegado a esta regi[óo]n/i.test(visible) ||
              /ainda n[ãa]o chegou a esta regi[ãa]o/i.test(visible) ||
              /n'?est pas encore disponible dans (cette|votre) r[ée]gion/i.test(visible) ||
              /ist (in )?deinem land (noch )?nicht verf[üu]gbar/i.test(visible) ||
              /non [ée] ancora disponibile in (questa|tuo) (regione|paese)/i.test(visible) ||
              /netflix[\s\S]{0,60}(尚未|未在此|推出|地区)/i.test(visible) ||
              /netflix[\s\S]{0,60}(この地域|地域ではまだ| 利用でき)/i.test(visible) ||
              /netflix[\s\S]{0,60}(아직|지역)/i.test(visible) ||
              /^(service unavailable|not available in your country)/i.test(title)) {
            return '__NF_REGION__';
          }
        }

        // ── CRUNCHYROLL ──
        if (platformId === 'crunchyroll') {
          // A dead account used to survive because every content check below was
          // English-only, so a login wall in any other language matched nothing and
          // the account was handed to the user as working. These are structure,
          // not wording: the page's own session flag, the URL, and a password
          // field look the same in every locale.
          const signedOutJson = /"issignedin"\s*:\s*false|"signinstatus"\s*:\s*"?(signed_?out|logged_?out|anonymous|unauthenticated)/i.test(raw);
          // "active" is NOT evidence of a session - it was accepted here as one,
          // and that is precisely how a login page got graded as working. The
          // /login route renders `"signinstatus":"active"` (an active form, not
          // an active user), so `signedInJson` came back true, every logout check
          // below was gated behind `!signedInJson` and therefore skipped, and the
          // probe returned "healthy" on a page whose only content is a password
          // box. The value has to name a real session.
          const signedInJson = /"issignedin"\s*:\s*true|"signinstatus"\s*:\s*"?(signed_?in|authenticated|logged_?in)/i.test(raw);
          const urlNow = (location.pathname || '').toLowerCase();

          // STRUCTURAL logout proof, checked on its own and in every language.
          //
          // A visible password field or a login form means this page IS the login
          // page, whatever any embedded state claims. This is deliberately not
          // gated on signedInJson, because that gate is what let a Portuguese
          // login page ("Login", "Endereço de E-mail", "Senha") through as a
          // working account. Structure does not change with the interface
          // language, which is the entire reason it is preferred over matching
          // the word "login" in prose.
          const passwordField = !!document.querySelector('input[type="password"]');
          const loginForm = !!document.querySelector(
            'form[action*="login" i], form[action*="signin" i], form[action*="sign-in" i], form[action*="auth" i]'
          );
          if (passwordField || loginForm) return '__CR_EXPIRED__';

          // Secondary net for a login screen with no password field (magic-link
          // or social-only sign-in): the heading is checked across the locales
          // Crunchyroll actually serves.
          const heading = ((document.querySelector('h1, [role="heading"], h2') || {}).innerText || '').trim();
          const looksLikeLoginPage =
            /^(login|sign\s?in|log\s?in|iniciar\s+sesi[oó]n|iniciar\s+sess[ãa]o|entrar|se\s+connecter|connexion|anmelden|inloggen|acced[ae]r)/i.test(heading);
          if (!signedInJson && (looksLikeLoginPage || signedOutJson ||
              /^\/(login|signin|sign-in|register|signup|auth)\b/.test(urlNow))) {
            return '__CR_EXPIRED__';
          }

          // ── Entitlement, read from the ACCOUNT CHROME and any open dialog ──
          //
          // This block used to read `raw` (200KB of homepage markup) looking for
          // "premium". Crunchyroll's homepage ships premium promos, tier cards
          // and "Go Premium" buttons to EVERY visitor, signed in or not, so that
          // test was true for a lapsed account too - which meant this line never
          // fired and every expired subscription was reported as working:
          //
          //     const premiumBadge = /class="[^"]*(premium|mega-?fan)["]*"/.test(raw)
          //     if (upsell && !premiumBadge) return '__CR_EXPIRED__';   // dead code
          //
          // Header-scoped alone was also not enough. A lapsed account is not
          // always upsold in the header: Crunchyroll opens a full-screen dialog
          // offering a fresh "7-Day Free Trial" on top of the header, and a
          // check that only read the header saw a clean, ordinary header and
          // graded the account as working. The pitch is the proof, so the
          // dialog counts as much as the header.
          const visible = (n) => !!n && !!(n.offsetWidth || n.offsetHeight || n.getClientRects().length);
          const headerEl = document.querySelector(
            'header, [class*="header" i], [class*="Header"]'
          );
          // A subscription offer is usually a dialog. Take every open one, and
          // only if it is genuinely on screen - hidden templates are in the DOM
          // for all users and would fire this for paying accounts too.
          const dialogs = Array.prototype.slice.call(document.querySelectorAll(
            '[role="dialog"], dialog, [class*="modal" i], [class*="Modal"], [class*="dialog" i], [class*="Dialog"], [class*="sheet" i], [class*="drawer" i]'
          )).filter(visible);
          const dialogText = dialogs.map((d) => d.innerText || '').join(' ');
          const headerText = headerEl ? (headerEl.innerText || '') : '';
          const headerHtml = headerEl ? (headerEl.innerHTML || '') : '';
          // Everything shown to THIS visitor in the places that matter. Sitewide
          // promo carousels are deliberately excluded - they are identical for
          // every account and cannot tell a paying one from a lapsed one.
          const chrome = headerText + ' ' + dialogText;

          // Positive entitlement, in the header, on the account's own chip.
          const headerBadge =
            /\b(mega\s*fan|premium\s*plus|premium\s*(member|plan|tier)|plan\s*:\s*(premium|mega))/i.test(headerText) ||
            /class="[^"]*(mega-?fan|premium)[^"]*(badge|tier|chip|tag|label)/i.test(headerHtml);

          // THE decisive signal: being pitched a subscription you do not have.
          // A paying account is never offered a free trial - so a live trial
          // offer means the subscription has ended, whatever the header says.
          // That covers the "7-Day Free Trial" dialog, "Premium access
          // includes...", "upgrade your plan", in the languages CR serves.
          const trialPitch =
            /(\d+\s*-?\s*day\s+free\s+trial|free\s+trial|prueba\s+gratuita|essai\s+gratuit|kostenlos\w*\s+test|gratis\w*\s+test)/i.test(chrome) ||
            /(start|get|try|join|upgrade|go)\s+(your\s+|a\s+|to\s+)?(free\s+)?(premium|trial|mega\s*fan)/i.test(chrome) ||
            /(mejora|hazte|obt[ée]n|consigue|pasa)\s+(a\s+)?(premium|mega)/i.test(chrome) ||
            /(premium\s+access\s+includes|unlimited\s+anime|no\s+ads|ad[- ]free\s+streaming)/i.test(chrome) ||
            !!headerEl && !!headerEl.querySelector('a[href*="/checkout"], a[href*="/subscribe"], a[href*="/upgrade"], a[href*="/premium"]');

          // An account whose subscription ENDED says so explicitly, in the page
          // body rather than the header - so this one is read sitewide.
          const lapsed =
            /(your\s+)?subscription\s+(has\s+)?(ended|expired|has expired|lapsed|inactive)/i.test(allText) ||
            /(subscription|payment)\s+(is\s+)?(expired|canceled|cancelled|failed|incomplete)/i.test(allText) ||
            /(renew|reactivat|update\s+your\s+payment)\s+(your\s+)?subscription/i.test(allText) ||
            /(tu|su)\s+suscripci[oó]n\s+(ha\s+)?(terminado|expirado|caducado)/i.test(allText) ||
            /(votre|your)\s+abonnement\s+(a\s+)?(expir[ée]|termin[ée])/i.test(allText) ||
            /abonnement\s+(ist\s+)?abgelaufen|abo\s+ist\s+abgelaufen/i.test(allText) ||
            /assinatura\s+(expirada|encerrada|encerrado)/i.test(allText);

          if (lapsed) return '__CR_EXPIRED__';
          if (trialPitch && !headerBadge) return '__CR_EXPIRED__';

          // Fallback, if the offer is not inside a recognised dialog element.
          // Crunchyroll ships that modal as a hashed div often enough that
          // selector-matching it is not dependable. These strings are used ONLY
          // here and only sitewide - "7-Day Free Trial" is the offer dialog's own
          // title, and "your subscription has ended" is a state no subscriber is
          // ever shown. Generic "free trial" text is deliberately NOT in this
          // list: it also appears in sitewide promo carousels, so trusting it
          // outside the dialog would reject working accounts.
          const trialTitleAnywhere =
            /(\b7\s*-?\s*day\s+free\s+trial|\b14\s*-?\s*day\s+free\s+trial)/i.test(allText) ||
            /your\s+(free\s+)?trial\s+(has\s+)?(ended|expired)/i.test(allText) ||
            /renew\s+your\s+(subscription|plan|trial)/i.test(allText);
          if (trialTitleAnywhere && !headerBadge) return '__CR_EXPIRED__';

          // A live session must show one of the account surfaces. Same-origin
          // links only: a social button pointing at twitter.com/Profile must not
          // count as proof.
          const accountish = !!document.querySelector(
            'a[href^="/profile"], a[href^="/account"], a[href^="/my-lists"], a[href^="/watchlist"], a[href^="/videos"]'
          );
          const avatarish = !!document.querySelector(
            '[class*="header"] [class*="avatar"], [class*="Avatar"][class*="menu"], img[alt*="avatar" i], [data-testid*="user-avatar"], [class*="profileAvatar"]'
          );
          const anonymousish = !!document.querySelector(
            '[class*="anonymous"], [class*="logged-out"], [data-t*="login"], a[href^="/login"], button[class*="login"]'
          );
          // The footer, read as text. A real scrape settled this: a signed-in account
          // ends with "History  My Account  Redeem Gift Card  Log Out"; a
          // signed-out one offers "Create Account  Log In  Redeem Gift Card" and
          // has no Log Out anywhere. Three of the ten sampled accounts were
          // signed out while still rendering the full homepage and the Premium
          // trial banner, so this is the signal that actually separates them -
          // and it is structural, so it survives the interface language.
          // Signed in and signed out differ by ONE thing: whether the footer offers
          // Log Out. A signed-in account ends with "History  My Account  Redeem
          // Gift Card  Log Out"; a signed-out one offers Log In instead and has
          // no Log Out anywhere.
          //
          // The absence of Log Out is the whole test. Requiring "Create Account"
          // as well looked tidier and was wrong: the Spanish and Portuguese pages
          // in the sample had their footers cut off before that phrase, so the
          // rule would have missed real signed-out accounts in those locales.
          // STRUCTURAL first, wording second. A link target says the same thing in every
// language; "Log Out" only says it in the ones somebody remembered to type.
const hasLogOut = /\blog ?out\b|cerrar sesi[oó]n|sair da conta|abmelden/i.test(allText);
          const hasLogIn = /\b(log ?in|sign ?in|iniciar sesi[oó]n|acceder|connexion|anmelden|entrar|login)\b/i.test(allText);
          const hasLogOutLink = !!document.querySelector('a[href*="/logout" i], a[href*="/signout" i], [data-e2e*="logout" i], [class*="logout" i]');
          const hasLoginLink = !!document.querySelector('a[href*="/login" i], a[href*="/signin" i], a[href*="/signup" i], a[href*="/register" i]');
          // Signed out: a login/signup target exists and no logout control does.
          if (hasLoginLink && !hasLogOutLink) return '__CR_EXPIRED__';
          if (hasLogIn && !hasLogOut && !hasLogOutLink) return '__CR_EXPIRED__';
          // Signed in but free: the header still pitches Premium. /account settles
          // it properly, so this only catches the obvious case.
          if ((hasLogOut || hasLogOutLink) && /\bgo premium\b/i.test(allText)) return '__CR_EXPIRED__';

          if (!signedInJson && !accountish && !avatarish) return '__CR_EXPIRED__';
          if (anonymousish && !signedInJson && !accountish) return '__CR_EXPIRED__';
          return false;
        }

        if (isPrime) {
          // ── ENTITLEMENT, decided before any copy is read ──
          // Prime's own JSON state flag. It does not change with the interface
          // language, which is what made this unreliable before: the check below
          // only ever matched English ("join prime", "start your free trial"), so
          // an account in any other locale was graded on wording alone. A
          // signed-in account with no Prime subscription then sailed through and
          // stayed selected, and the user got nothing.
const primeNo = /"isprime"\s*:\s*false|"isentitled"\s*:\s*false|"isprimesubscriber"\s*:\s*false|"hasprime"\s*:\s*false/i.test(raw);
          // "active" was accepted here as a stand-in for Prime, and that is what
          // let non-members straight through: Prime's embedded state carries
          // `"membershipStatus":"active"` (and a sign-in status of "active") for
          // accounts with no Prime at all, so this matched, `if (primeYes) return
          // false` fired, and every check below it - the whole entitlement test -
          // was unreachable. The value now has to actually mention Prime.
          const primeYes = /"isprime"\s*:\s*true|"isentitled"\s*:\s*true|"isprimesubscriber"\s*:\s*true|"hasprime"\s*:\s*true|"membershipstatus"\s*:\s*"[^"]*prime[^"]*"/i.test(raw);

          // ── Entitlement from the account chrome ──
          //
          // The JSON flags above are unreliable in both directions, and the
          // homepage copy is unreliable too: "Join Prime", "start your free
          // trial" and "Watch with Prime" all appear in promos for subscribers.
          // The one unambiguous signal is the ACCOUNT CHROME: a Prime member's
          // header never carries a "Join Prime" button. A non-member's always
          // does. So the header and any open dialog are read directly.
          const visible = (n) => !!n && !!(n.offsetWidth || n.offsetHeight || n.getClientRects().length);
          const headerEl = document.querySelector('header, [class*="header" i], [class*="Header"]');
          const dialogs = Array.prototype.slice.call(document.querySelectorAll(
            '[role="dialog"], dialog, [class*="modal" i], [class*="Modal"], [class*="dialog" i], [class*="Dialog"], [class*="sheet" i], [class*="drawer" i]'
          )).filter(visible);
          const chrome = (headerEl ? (headerEl.innerText || '') : '') + ' ' +
            dialogs.map((d) => d.innerText || '').join(' ');
          const headerHtml = headerEl ? (headerEl.innerHTML || '') : '';

          // STRUCTURAL first. The scrape showed the join-prime link is present for every
          // non-member and absent for every member, so a link target alone settles
          // it without reading a word. The wording is kept only for the case
          // where the button is rendered as a plain <button> with no href.
          const joinPrimeLink = !!document.querySelector(
            'a[href*="/joinprime" i], a[href*="offers/nonprime" i], a[href*="/signup" i], a[href*="/register" i], [data-testid*="join-prime" i]'
          );
          const joinPrimeInChrome = joinPrimeLink || /(join|try|get|start|sign\s*up\s*for|upgrade\s*to|become)\s+prime/i.test(chrome);

          // "Watch with Prime" is the non-member call to action, including the
          // "Start your 7-day free trial" line under it. The old wording list
          // missed it because it only knew "start your free trial" - the actual
          // string has "7-day" in the middle.
          const freeTrialCta =
            /(start|begin)\s+(your\s+)?(\d+\s*-?\s*day\s+)?free\s+trial/i.test(chrome) ||
            /watch\s+with\s+prime/i.test(chrome) ||
            /(prueba|essai|test)\s+gratuite?|kostenlose.*test|test\s+gratis/i.test(chrome);

          // An expired or cancelled membership states it outright.
          const lapsed =
            /your\s+(prime\s+)?(membership|subscription)\s+(has\s+)?(ended|expired|lapsed|cancel(l)?ed)/i.test(allText) ||
            /(membership|subscription|payment)\s+(is\s+)?(expired|cancel(l)?ed|ended|inactive|incomplete|failed)/i.test(allText) ||
            /renew\s+your\s+(prime\s+)?(membership|subscription)/i.test(allText) ||
            /(tu|su)\s+(membres[ií]a|suscripci[oó]n)\s+(ha\s+)?(terminado|expirado|caducado)/i.test(allText) ||
            /(votre|your)\s+abonnement\s+(a\s+)?(expir[ée]|termin[ée])/i.test(allText) ||
            /abo(nnement)?\s+(ist\s+)?abgelaufen/i.test(allText);

          // ── Decisive, and checked FIRST ──
//
// A member never gets a "Join Prime" control. A non-member always does.
//
// This used to be scoped to `headerEl`, found with
// querySelector('header, [class*="header"]'). Prime Video's bar is NOT a
// <header> element, and on a page that happens to have no element whose class
// contains "header", headerEl came back null - headerText was '', the gate
// never fired, and the account went straight through. Three customers reported
// the same Join Prime wall before that was noticed.
//
// So it is not scoped to a container any more. What keeps a subscriber's
// promotional carousel from tripping it is the shape of the match: a real CONTROL
// whose label BEGINS with "Join Prime". Amazon writes promos as "Watch with
// Prime" and "Try Prime"; the sign-up call to action is "Join Prime", and it is
// always a button or a link.
const joinControl = Array.prototype.some.call(
  document.querySelectorAll('a, button, input[type="submit"], input[type="button"], [role="button"]'),
  (el) => {
    if (el.offsetParent === null && el.getClientRects().length === 0) return false;  // hidden
    const label = String(el.innerText || el.value || el.getAttribute('aria-label') || el.title || '').trim();
    return /^(join|subscribe\s+to|sign\s*up\s+for|upgrade\s+to|get|try)\s+prime\b/i.test(label);
  }
);
if (joinControl) return '__PRIME_EXPIRED__';

// A non-member's account state says so, and the sign-up link is unambiguous.
if (document.querySelector('a[href*="/joinprime" i], a[href*="offers/nonprime" i], [data-testid*="join-prime" i]')) {
  return '__PRIME_EXPIRED__';
}

if (primeNo) return '__PRIME_EXPIRED__';
          if (lapsed) return '__PRIME_EXPIRED__';
          if ((joinPrimeInChrome || freeTrialCta) && !primeYes) return '__PRIME_EXPIRED__';

          // ── Pending signup: never actually activated ──
          //
          // Found in a real scrape of 10 random accounts. One of them rendered a
          // fully normal Prime Video homepage - carousel, "Play", Originals, the
          // lot - under a banner that said the payment was never verified. It has
          // no Prime entitlement, nothing on the page says "expired", and every
          // check above passed it, so it would have been handed to a user who then
          // found nothing playable.
          //
          // Distinct from a lapsed membership: this one was never active. The
          // wording comes from the scrape, with the neighbouring languages that
          // phrase it the same way.
          const pendingSignup =
            /pending\s+signup/i.test(allText) ||
            /payment\s+verification\s+(is\s+)?required/i.test(allText) ||
            /complete your payment (details|method)/i.test(allText) ||
            /(verify|confirm|update)\s+(your\s+)?payment\s+(details|method|information)/i.test(allText) ||
            /to activate and receive your subscription benefits/i.test(allText) ||
            /registro\s+pendiente/i.test(allText) ||
            /verificaci[oó]n\s+de\s+pago/i.test(allText) ||
            /(registro|inscri[çc][ãa]o)\s+pendente/i.test(allText) ||
            /verifizierung der zahlung/i.test(allText) ||
            /v[ée]rification\s+du\s+paiement/i.test(allText);
          if (pendingSignup) return '__PRIME_EXPIRED__';

          // ── Regional catalog restriction ("Travelling?") ──
          //
          // A genuinely valid Prime member, on a perfectly ordinary homepage,
          // that will still make the user pay for most things. Amazon serves a
          // reduced catalog to an account whose home country differs from the
          // current IP, and announces it with this banner. Prime Originals keep
          // their crown badges and play; everything else asks to be bought.
          //
          // It gets its OWN verdict rather than being called expired. The account
          // is not broken - it is excellent in its own region - so it must not be
          // reported as dead to the operator, whose list is shared by every user
          // and would throw away a good account worldwide. It is skipped locally
          // for this user only.
          const abroad =
            /travelling\?|traveling\?|on\s+the\s+move|while\s+you(?:'re|\s+are)\s+abroad|while\s+you(?:'re|\s+are)\s+overseas/i.test(allText) ||
            /(your\s+)?access\s+to\s+(movies\s+and\s+tv|tv\s+and\s+movies|this\s+title)\b[\s\S]{0,120}?will\s+vary/i.test(allText) ||
            /(some\s+)?titles?\s+(might|may)\s+be\s+unavailable\s+until\s+your\s+return/i.test(allText) ||
            /indispon[ií]veis?\s+at[ée]\s+o\s+(seu\s+)?retorno|você\s+está\s+(de\s+)?viagem|enquanto\s+você\s+está\s+(fora|fora\s+do)/i.test(allText) ||
            /(mientras|est[áa]s)\s+(de\s+)?(viaje|fuera)|algunas\s+(t[íi]tulos|pel[íi]culas)\s+no\s+estar[áa]n\s+disponibles/i.test(allText) ||
            /(solange|wen[n]?)\s+Sie\s+im\s+Ausland\s+sind|einige\s+titel\s+sind\s+(m[öo]glicherweise\s+)?erst\s+nach\s+ihrer\s+r[üu]ckkehr/i.test(allText) ||
            /(tant\s+que\s+vous\s+[êe]tes\s+[àa]\s+l'[ée]tranger|en\s+voyage\?|vos\s+acc[èe]s\s+varieront)/i.test(allText);
          if (abroad) return '__PRIME_ABROAD__';

          const hasPrimeContent = /continue watching|my list|watch now|start watching|seguir viendo|ma liste|weiterschauen|continuar assistindo/i.test(allText);
          // Upsell copy in the languages Prime actually serves. An account with
          // no subscription is being asked to buy one; that is the strongest
          // plain-language proof there is.
          const hasPrimeSignup = /join prime|subscribe now|start your (free|\d+-day free) trial|upgrade to prime|not eligible|prime membership required|subscription required|prime video is not available|access denied|prueba|mejora|obt[ée]n|consigue|atualize|subscribe|abonner|abonnieren|prova|assine/i.test(allText);
          const hasNonprimePage = /nonprimehomepage|offers\/nonprime|dv_web_force_root|join.*prime.*button/i.test(raw + ' ' + allText);
          const joinPrimeElements = document.querySelectorAll('[class*="JoinPrime"], [class*="join-prime"], [class*="SubscribeButton"], [class*="offer-page"], [class*="OfferPage"], [data-testid*="join-prime"], a[href*="offers/nonprime"], #nav-prime-btn-txt');
          const hasJoinPrimeDom = joinPrimeElements.length > 0;
          // A positive entitlement flag settles it in either direction, so a
          // working account is never killed by a stray marketing string.
          if (primeYes) return false;
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
      args: [String(plat.id || '')]
    });
    const text = (res && res[0] && res[0].result) || '';
    // Returns a REASON, not just a boolean, because not every failure is the
    // same kind of failure:
    //   false      - healthy
    //   'dead'     - expired, revoked, or signed out
    //   'region'   - a valid Prime member stuck on a reduced catalogue because
    //                their account country differs from this IP ("Travelling?").
    //                Locally skipped, but never reported as dead - the operator's
    //                list is shared, and that account works fine at home.
    // Callers only ever test truthiness, so the extra precision is free.
    // Crunchyroll's homepage read is decisive and needs no second opinion.
    if (text === '__CR_EXPIRED__') return 'dead';
    if (text === '__PRIME_ABROAD__') return 'region';
    // Netflix walls: ads-in-region is an ACCOUNT property (ads plan) and gets
    // reported + erased from the shared pool; VPN/proxy and region walls are
    // IP problems and are only skipped for this user, never reported.
    if (text === '__NF_ADS_REGION__') return 'ads';
    if (text === '__NF_VPN__') return 'region';
    if (text === '__NF_REGION__') return 'region';

    // ── Prime: the settings page decides, never the homepage ──
    //
    // This is why good accounts were being thrown away. The homepage returned
    // '__PRIME_EXPIRED__' for anything that looked like a non-member - and a
    // member's page is full of things that look like that: a "Try Prime" promo
    // in the header, a "Watch with Prime" trailer, a free-trial line. That
    // marker was turned into 'dead' immediately, on the line above, so the
    // settings page was never opened and no member was ever actually checked.
    //
    // The homepage is now a hint, never a verdict. Prime membership is read from
    // the account's own settings page, where the plan, the renewal date and the
    // payment method are stated outright. Only if no account page can be read at
    // all does the homepage's opinion get used at all.
    let primeVerdict = null;
    if (plat.id === 'prime') {
      const subs = await primeSubscriptionsVerdict(tabId);
      if (subs === 'live') primeVerdict = false;
      else if (subs === 'dead') primeVerdict = 'dead';
      else {
        // The settings page did not render. The retail account URLs get a turn.
        const settings = await primeSettingsVerdict(tabId);
        if (settings === 'live') primeVerdict = false;
        else if (settings === 'dead') primeVerdict = 'dead';
        // Nothing on any account page could be read. Falling back to the
        // homepage here is the last resort, not the first one.
        else if (text === '__PRIME_EXPIRED__') primeVerdict = 'dead';
      }
    } else if (text === '__PRIME_EXPIRED__') {
      primeVerdict = 'dead';
    }

    // Put the customer's tab back. Checking a subscription means walking through
    // the account pages, and leaving the tab there - on the settings page, or on
    // Amazon's 404 - meant the customer was stranded looking at an account page
    // instead of the show they opened. This runs before returning so it happens
    // whichever way the verdict went.
    try {
      const t = await chrome.tabs.get(tabId);
      if (/amazon\.com|primevideo\.com/i.test(t.url || '') && (t.url || '') !== plat.homeUrl) {
        await chrome.tabs.update(tabId, { url: plat.homeUrl, active: false });
      }
    } catch (e) {}

    if (primeVerdict !== null) return primeVerdict;

    return plat.contentFailures.some((re) => re.test(text)) ? 'dead' : false;
  } catch (e) {
    return false;
  }
}

// ── Confirm before claiming ok ──
//
// Reading the URL and then returning is not enough. Crunchyroll (like Prime) is
// an SPA: the homepage reaches 'complete' or sits stable for several samples and
// THEN kicks the session out, bouncing to /login. The check above read the URL
// before the DOM probe ran, so a redirect that happened in between still came
// back as a healthy account - and the user was handed a login screen.
//
// So every 'ok' is re-confirmed against a FRESH read of the tab and a second DOM
// probe. The cost is one extra sample on a passing account; the benefit is that
// 'ok' means the page still looked right at the moment we handed it over.
async function confirmTabOk(plat, tabId, fallbackUrl) {
  try { await sleep(700); } catch (e) {}
  let tab = null;
  try { tab = await chrome.tabs.get(tabId); } catch (e) {}
  if (!tab) return { status: 'dead', url: fallbackUrl, tabId };
  const url = tab.url || fallbackUrl || '';
  // Redirected to a sign-in page in the gap: that is a dead account, not an ok.
  if (urlIsFailure(plat, url)) return { status: 'dead', url, tabId };
  const region2 = await probeTabFailure(plat, tabId);
  if (region2) return { status: region2, url, tabId };
  return { status: 'ok', url, tabId };
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
      const contentProblem = await probeTabFailure(plat, tabId);
      if (contentProblem) return { status: contentProblem, url, tabId };
      // Confirm ok only if tab is complete OR URL has been rock-solid for 3+ samples
      if (tab.status === 'complete' || stableCount >= 3) {
        // A live session is not a live membership: /browse renders the profile gate
        // for an account whose subscription was cancelled. Check /account first.
        // 'hold' (payment suspended / failed card) is rejected exactly like
        // dead - the user would land on a "retry your payment" wall. The
        // renewal date, when the page showed one, rides on the ok result so it
        // can be stored with the saved session.
        let renewMeta = 0;
        if (plat.id === 'netflix') {
          const sub = await netflixSubscriptionVerdict(tabId);
          // 'ads' MUST be acted on here. It used to fall through to "ok" -
          // the /account page proved the plan was ad-supported while the
          // handover continued, which is exactly how ads accounts kept being
          // handed out while the checks "looked" like they were working.
          if (sub.verdict === 'region') return { status: 'region', url: url, tabId: tabId };
          if (sub.verdict === 'ads') return { status: 'ads', url: url, tabId: tabId };
          // Unverifiable: /account never rendered anything readable. Not ok -
          // 'unknown' is what an unreadable suspended page looked like - and
          // not reported either, because there is no evidence. 'skip' only
          // rejects this attempt; the caller moves to the next candidate and
          // nothing is banned or erased.
          if (sub.verdict === 'unknown') return { status: 'skip', url: url, tabId: tabId };
          if (sub.verdict === 'dead' || sub.verdict === 'hold') {
            return { status: 'dead', url: url, tabId: tabId, reason: sub.verdict === 'hold' ? (sub.why || 'payment_hold') : 'membership' };
          }
          renewMeta = sub.nextPayment || 0;
        }
        const confirmed = await confirmTabOk(plat, tabId, url);
        if (confirmed && confirmed.status === 'ok' && renewMeta) confirmed.nextPayment = renewMeta;
        return confirmed;
      }
    }
  }

  // Timeout fallback: run one final DOM probe before assuming ok
  // Catches expired accounts where the SPA settled but never hit 'complete'
  try {
    const finalProblem = await probeTabFailure(plat, tabId);
    if (finalProblem) return { status: finalProblem, url: lastUrl || plat.homeUrl, tabId };
  } catch (e) {}

  // Same reasoning on the timeout path, which is the branch that hands an
  // account over when the page never reached 'complete'.
  let renewMetaTail = 0;
  if (plat.id === 'netflix') {
    const sub = await netflixSubscriptionVerdict(tabId);
    if (sub.verdict === 'region') return { status: 'region', url: lastUrl || plat.homeUrl, tabId };
    if (sub.verdict === 'ads') return { status: 'ads', url: lastUrl || plat.homeUrl, tabId };
    // Same rule as the main path: undefined is not a membership.
    if (sub.verdict === 'unknown') return { status: 'skip', url: lastUrl || plat.homeUrl, tabId };
    if (sub.verdict === 'dead' || sub.verdict === 'hold') {
      return { status: 'dead', url: lastUrl || plat.homeUrl, tabId, reason: sub.verdict === 'hold' ? (sub.why || 'payment_hold') : 'membership' };
    }
    renewMetaTail = sub.nextPayment || 0;
  }
  if (plat.id === 'crunchyroll') {
    const sub = await crunchyrollMembershipVerdict(tabId);
    if (sub === 'dead') return { status: 'dead', url: lastUrl || plat.homeUrl, tabId, reason: 'membership' };
  }

  const confirmedTail = await confirmTabOk(plat, tabId, lastUrl || plat.homeUrl);
  if (confirmedTail && confirmedTail.status === 'ok' && renewMetaTail) confirmedTail.nextPayment = renewMetaTail;
  return confirmedTail;
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
    // 'skip' = the /account check could not verify this session (page never
    // rendered, or nothing in a known language). Not banned, not reported -
    // just passed over this attempt, so the hunt offers the next candidate.
    if (nav.status === 'dead' || nav.status === 'region' || nav.status === 'ads' || nav.status === 'skip') {
      return { ok: false, reason: nav.status, subReason: nav.reason || '', url: nav.url, tabId: nav.tabId };
    }
    // nextPayment (when Netflix showed a renewal date) rides up to the caller
    // so it can be stored with the saved session and shown as days left.
    return { ok: true, tabId: nav.tabId, nextPayment: nav.nextPayment || 0 };
  } catch (e) {
    return { ok: false, reason: 'error', error: e.message };
  }
}

// Netflix TV Connect: open the TV-code page with a saved session injected, so
// the code shown on a smart TV can be entered there. Unlimited for active
// plans (operator decision). The cookies stay in the browser - the TV links
// to the account server-side. Netflix-only; Prime's own flow is separate.
async function connectTv(key, entry) {
  if (key !== 'netflix' || !entry || !Array.isArray(entry.cookies) || !entry.cookies.length) return false;
  const plat = PLATFORMS.netflix;
  let tabId = null;
  try {
    await clearDomainCookies(plat);
    const count = await injectSessionCookies(plat, entry.cookies);
    if (!count) {
      toast('Could not inject this session - try a different saved account', 3200);
      return false;
    }
    const existing = await findPlatformTab(plat);
    if (existing) {
      tabId = existing.id;
      await chrome.tabs.update(tabId, { url: NETFLIX_TV_URL, active: true });
    } else {
      const created = await chrome.tabs.create({ url: NETFLIX_TV_URL, active: true });
      tabId = created.id;
    }
    for (let i = 0; i < SAMPLES; i++) {
      await sleep(SAMPLE_MS);
      let tab;
      try { tab = await chrome.tabs.get(tabId); } catch (e) { return false; }
      const url = tab.url || '';
      if (!urlIsLoaded(url)) continue;
      if (urlIsFailure(plat, url)) {
        toast('Those cookies are dead - the account got signed out. Try another one.', 3600);
        return false;
      }
      if (/\/tv\d?(\/|$|\?)/i.test(url)) break;
    }
    toast('Netflix is open on the TV-code page. If you see the profile list, pick a profile - the code from your TV appears after that. Enter it and confirm', 6000);
    return true;
  } catch (e) {
    toast('TV connect failed: ' + String((e && e.message) || e), 3200);
    return false;
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
  // Operator rows written before the rename still say FREE; it is the same
  // basic tier, so both spellings unlock the same plan.
  else if (forcePlanOverride === 'PREMIUM' || forcePlanOverride === 'FREE') obj.plan = obj.activations && obj.activations.access ? 'free' : 'inactive';
  return obj;
}

let forcePlanOverride = null;

// Which platforms this user may actually use. It is filled from the user's row
// in users.json so an operator setplatforms override is honoured within a
// minute, and an empty array means "both" - the same default the server uses
// when a row has no platforms field at all.
let platformScope = [];

// Whether platformScope is a real answer or just "we could not find out".
//
// It used not to exist, and every read that failed set the scope to empty - which
// platformBlocked reads as "no restriction". So one failed fetch (an expired key,
// a proxy 401, a dropped connection) silently unlocked every platform, and a
// PREMIUM customer could stream Crunchyroll. The scope is now only believed when
// it came from an answer, and unknown means blocked.
let platformScopeKnown = false;

// Unknown is NOT "everything".
//
// An empty list used to mean "no restriction", which is the single most expensive
// way to be wrong here: it turns any transient failure into free access to the
// platforms a key does not include. Fail closed instead, and say why, because a
// customer told "not in your plan" when the truth is "we could not check" will
// go and buy a bigger key.
async function platformBlocked(key) {
  if (!platformScopeKnown || !platformScope.length) return true;
  return platformScope.indexOf(key) < 0;
}

async function syncPlatformScope() {
  const p0 = await getProfile().catch(() => null);
  const code = ((p0 && p0.activations) || {}).access || '';

  // 1. The server. It already answers this on every rate read, from the KEY, and
  //    it is the only thing that knows a tier's default scope.
  try {
    const snap = await getRateSnapshot(true);
    const list = snap && snap.ok && snap.entitlements && snap.entitlements.platforms;
    if (Array.isArray(list) && list.length) {
      platformScope = list.filter((x) => x === 'netflix' || x === 'prime' || x === 'crunchyroll');
      platformScopeKnown = true;
      await rememberPlatformScope(platformScope);
      return;
    }
  } catch (e) { /* try the next source */ }

  // 2. What the server said last time. This is the fix for "it worked, then I
  //    reopened and Prime was allowed": the scope used to live only in memory, so
  //    every reopen re-derived it, and the fallback below is the operator's
  //    platform list rather than the key's.
  const remembered = Array.isArray(p0 && p0.platforms)
    ? p0.platforms.filter((x) => x === 'netflix' || x === 'prime' || x === 'crunchyroll')
    : [];
  if (remembered.length) {
    platformScope = remembered;
    platformScopeKnown = true;
    return;
  }

  // 3. The holder's row. Only accepted when it actually carries a list, and only
  //    as a last resort - see step 2 for why it is not the first answer.
  try {
    const p = await getProfile();
    if (!p.username) return;
    const data = JSON.parse((await fetchFromGithub(GITHUB_CONFIG.users)) || '{}') || {};
    const row = data[p.username] || (Array.isArray(data) ? data.find((r) => r && r.username === p.username) : null);
    const arr = Array.isArray(row && row.platforms) ? row.platforms.map((x) => String(x).toLowerCase()) : [];
    const f = arr.filter((x) => x === 'netflix' || x === 'prime' || x === 'crunchyroll');
    if (f.length) {
      platformScope = f;
      platformScopeKnown = true;
      return;
    }
  } catch (e) { /* keep whatever we last knew */ }

  // 4. Nothing answered. Deliberately NOT cleared: a previous good answer is
  //    better evidence than no answer, and dropping it would be the bug above.
  if (!platformScope.length) platformScopeKnown = false;
  void code;
}

async function readForcePlan() {
  try {
    const data = JSON.parse((await fetchFromGithub(GITHUB_CONFIG.users)) || '{}');
    const p = await getProfile();
    const row = data && (data[p.username] || (Array.isArray(data) ? data.find((r) => r && r.username === p.username) : null));
    const next = row && (row.forcePlan === 'PRO' || row.forcePlan === 'PREMIUM' || row.forcePlan === 'FREE') ? (row.forcePlan === 'FREE' ? 'PREMIUM' : row.forcePlan) : null;
    if (next !== forcePlanOverride) {
      forcePlanOverride = next;
      renderPlanPill();
      // The member card and the profile pill read the same override: refreshing
      // only the pill left the plan view showing the previous tier.
      try {
        if (document.querySelector('#view-plan:not(.hidden)')) await renderPlanView();
        if (document.querySelector('#view-profile:not(.hidden)')) await renderProfileView();
      } catch (e) {}
    }
  } catch (e) {}
}

function renderPlanPill() {
  const pp = $('p-plan');
  if (pp) {
    getProfile().then((p) => { pp.textContent = PLAN_LABEL[p.plan] || 'PREMIUM'; }).catch(() => {});
  }
}

// Every surface that shows the plan, refreshed together from a fresh profile
// read. Activation used to refresh only some of them, so the member card kept
// showing the previous tier until the popup was closed and reopened.
async function syncPlanViews() {
  renderPlanPill();
  try { await renderPlanView(); } catch (e) {}
  try { await renderProfileView(); } catch (e) {}
}

function onBanCheck(banList) {
  readForcePlan().catch(() => {});
}

// "What tier does this key grant", as a table rather than a chain of ifs.
//
// This is only ever the FALLBACK, for a profile stored before the tier was known
// - the server is the authority. It used to know two tiers, and it had the same
// bug the server had: VIP was folded into PRO.
//
// Note KZR-VIP- is NOT the VIP tier. It is the prefix "permanent" keys have
// always been minted with, and reading it as VIP would hand every permanent
// customer in existence unlimited connects. The minted VIP tier is KZR-VIPX-.
const TIER_BY_PREFIX = [
  ['KZR-VIPX-', 'VIP'],
  ['KZR-PRO1-', 'PRO1'],
  ['KZR-PRO-1-', 'PRO1'],
  ['KZR-P1-', 'PRO1'],
  ['KZR-PREMIUM-', 'PREMIUM'],
  ['KZR-FREE-', 'PREMIUM'], // old spelling of the renamed basic tier
  ['KZR-VIP-', 'PRO'],      // permanent, not unlimited
  ['KZR-PRO-', 'PRO']
];

// Is this key one whose tier can be read off its prefix?
//
// Anything else - the operator's own KIZAR444 above all, which is typed rather
// than minted - used to fall through tierOfCode and be reported as PRO. That is
// a guess, and it is what put a PRO card under a VIP key while the server was
// answering unlimited a few lines away. An empty answer is the honest one, and
// it is what makes the popup go and ask the server instead.
function knownTierOfCode(code) {
  const c = String(code || '').trim().toUpperCase();
  for (const [prefix, tier] of TIER_BY_PREFIX) if (c.startsWith(prefix)) return tier;
  return '';
}

function tierOfCode(code) {
  const c = String(code || '').trim().toUpperCase();
  for (const [prefix, tier] of TIER_BY_PREFIX) if (c.startsWith(prefix)) return tier;
  return 'PRO';
}

function tierOfEntry(entry) {
  if (!entry) return '';
  const t = String(entry.tier || '').trim().toUpperCase();
  // FREE is the old name for PREMIUM and still turns up in stored records.
  if (t === 'FREE') return 'PREMIUM';
  if (t === 'VIP' || t === 'PRO1' || t === 'PRO' || t === 'PREMIUM') return t;
  return tierOfCode(entry.code);
}

// Server tier -> the internal plan key the card, limits and benefits are keyed on.
//
// This returned 'active' for VIP, which is the PRO card: right shape, wrong name,
// and above all the wrong allowance - 7 connects instead of unlimited. Every
// paid tier now keeps its own key, which is what PLAN_META and benefitsFor were
// already written for.
function planKeyForTier(tier) {
  const t = String(tier || '').trim().toUpperCase();
  if (t === 'VIP') return 'vip';
  if (t === 'PRO1' || t === 'PROONE' || t === 'PRO 1') return 'pro1';
  if (t === 'PREMIUM' || t === 'FREE') return 'free';
  if (t === 'PRO') return 'active';
  return '';
}

function derivePlan(activations, tier) {
  const a = activations || {};
  if (!a.access) return 'inactive';
  const known = planKeyForTier(tier);
  if (known) return known;
  return planKeyForTier(tierOfCode(a.access)) || 'free';
}

// Everything paid, for the checks that only care whether the user pays at all.
function isPaidPlan(plan) {
  return plan === 'active' || plan === 'pro1' || plan === 'vip';
}

// The name to SHOW for a plan key. Written out rather than derived, because the
// places that display it were reading 'active' as PRO and nothing else, so a VIP
// holder was told they had PRO in the pill, the profile line and the diagnostics
// while the card above them said VIP.
const PLAN_LABEL = {
  inactive: 'PREMIUM',
  free: 'PREMIUM',
  active: 'PRO',
  pro1: 'PRO1',
  vip: 'VIP'
};

// `platforms` is stored here on purpose.
//
// The scope used to live only in memory, so it was re-derived from scratch every
// time the popup opened. That made a Netflix + Crunchyroll key block Prime on the
// first open and quietly allow it on the next one, because the re-derivation
// leaned on users.json - which is the OPERATOR's platform list, not the key's,
// and holds all three by default. Persisting what the server actually answered
// means a restart cannot change what a key unlocks.
async function setProfile(username, activations, memberSince, tier, platforms) {
  const prev = await getProfile();
  const obj = {
    username: username !== undefined ? username : prev.username,
    activations: activations !== undefined ? activations : prev.activations,
    memberSince: memberSince !== undefined ? memberSince : (prev.memberSince || new Date().toISOString())
  };
  const t = tier !== undefined ? tier : prev.tier;
  if (t) obj.tier = t;
  else if (!obj.activations || !obj.activations.access) delete obj.tier;
  if (platforms !== undefined) obj.platforms = platforms;
  await chrome.storage.local.set({ [PROFILE_KEY]: obj });
}

// Record the scope the server just told us, without disturbing anything else.
async function rememberPlatformScope(list) {
  const f = (list || []).filter((x) => x === 'netflix' || x === 'prime' || x === 'crunchyroll');
  if (!f.length) return;
  const p = await getProfile();
  const prev = Array.isArray(p.platforms) ? p.platforms : [];
  if (prev.length === f.length && prev.every((x, i) => x === f[i])) return;
  await setProfile(p.username, p.activations, p.memberSince, p.tier, f);
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

// Redeeming a key changes whose allowance this is, and several caches on the way
// are keyed on nothing at all - they were written for "the key stays the same for
// the life of the profile", which is not true the moment someone swaps keys
// without signing out.
//
// The rate snapshot was the visible one: it survives the swap, so a VIP who
// pasted over a PRO key kept seeing PRO's allowance on the lights and on the
// Plan card until the cache happened to expire. Everything derived from the old
// key has to go, or the popup shows two different answers at once.
async function resetKeyScopedState() {
  STATE.rateSnapshot = null;
  try { await chrome.storage.local.remove(RATE_KEY); } catch (e) {}
  // The "already bound?" marker is per key, so a new key must not inherit it.
  try { await chrome.storage.local.remove(KEY_CHECK_KEY); } catch (e) {}
  // Platforms, sessions and the profile's own mirror all came from the old key.
  platformInfoCache = { t: 0, plats: null, code: '', scopeKey: '' };
  STATE.codesReady = false;
  STATE.sessions = { netflix: [], prime: [], crunchyroll: [] };
}

async function activateCode(raw, username) {
  const code = normalizeCode(raw);
  if (!code) return { ok: false, reason: 'empty' };
  // The name is passed in by whoever is asking. On the welcome screen there is
  // no profile yet, so reading one would fail every first sign-up.
  const profile = await getProfile();
  const who = String(username || profile.username || '').trim();
  if (!who) return { ok: false, reason: 'noname' };

  // The server binds the key. The browser used to do it by writing
  // activation.json with an embedded repo token, and GitHub kept refusing
  // that write, so keys were never really bound to anybody. Everything
  // downstream that checks a key therefore had nothing to match.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(700 * attempt);
    try {
      const res = await fetch(CONTROL_ROOM + '/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'redeem',
          code,
          username: who,
          ip: profile.ip || ''
        })
      });
      const j = await res.json().catch(() => ({}));

      if (res.ok && j && j.ok) {
        // The server is authoritative for the tier. Falling back to the code
        // prefix (not to PRO) keeps the card honest when the reply omits it.
        const tier = j.tier || tierOfCode(code);
        const activations = Object.assign({}, profile.activations || {});
        activations.access = code;
        // The platform, the owner and the "already checked" marker all belong to
        // the PREVIOUS key. The remembered scope especially: carrying a Netflix +
        // Crunchyroll scope onto a new all-platforms key would wrongly restrict it,
        // and carrying it the other way would wrongly widen the new key. Hence the
        // empty list rather than leaving the old one in place.
        await setProfile(who, activations, profile.memberSince, tier, []);
        await resetKeyScopedState();
// Which internal plan key the key actually earned.
      //
      // This compared against the literal 'PRO', so PRO1 and VIP both fell through
      // to 'free' - and a VIP holder was shown PREMIUM. The 'pro1' and 'vip' keys
      // and their copy already existed further down and were simply unreachable.
      // The server now reports the true tier, so the tier decides.
      const paid = (v) => /^(PRO|PRO1|VIP)$/i.test(String(v || '').trim());
      const which = paid(tier) ? String(tier).trim().toUpperCase()
        : (paid(j.plan) ? String(j.plan).trim().toUpperCase() : '');
      return {
        ok: true,
        code,
        tier,
        // Internal plan keys, not server tier names: the card and the limits
        // below are keyed on these.
        plan: which === 'VIP' ? 'vip' : which === 'PRO1' ? 'pro1' : which ? 'active' : 'free',
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
  const status = { checkedAt: Date.now(), user: false, key: false, plan: 'PREMIUM', keyLabel: '', expiresAt: '', timeLeft: '', reason: '', online: false, registered: false };
  const profile = await getProfile();
  status.plan = PLAN_LABEL[profile.plan] || 'PREMIUM';
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
  const out = {};
  for (const k of PLATFORM_KEYS) {
    out[k] = [];
    const v = raw[k];
    if (Array.isArray(v)) out[k] = v.filter((s) => s && s.cookies);
    else if (v && v.cookies) out[k] = [v];
  }
  return out;
}

// meta: optional `{ nextPayment, nextPaymentCheckedAt }` recorded at stream
// time. nextPayment is the ms timestamp of the renewal date the Netflix
// account page printed while the session was being handed over - stored so the
// saved cards can count down the days left, and can flag old sessions whose
// remaining days ran out without a live check.
async function addSaved(key, cookies, fingerprint, meta) {
  const limit = await savedLimit();
  const saved = await getSaved();
  const list = saved[key];
  const idx = list.findIndex((s) => s.fingerprint === fingerprint);
  if (idx >= 0) list.splice(idx, 1);
  const entry = { cookies, fingerprint, savedAt: Date.now() };
  if (meta && typeof meta === 'object') {
    if (meta.nextPayment) entry.nextPaymentAt = meta.nextPayment;
    if (meta.nextPaymentAt) entry.nextPaymentAt = meta.nextPaymentAt;
    if (meta.nextPaymentCheckedAt) entry.nextPaymentCheckedAt = meta.nextPaymentCheckedAt;
  }
  list.push(entry);
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
  const out = {};
  for (const k of PLATFORM_KEYS) out[k] = raw[k] || [];
  // ONE-TIME REPAIR. A previous build banned accounts that came back 'unknown',
  // and 'unknown' is usually the tool's own failure rather than the account. The
  // list is cleared once, so the good accounts come back.
  if (raw.__banRulesFixed !== 1) {
    out.netflix = [];
    const repaired = {};
    for (const k of PLATFORM_KEYS) repaired[k] = out[k];
    repaired.__banRulesFixed = 1;
    try { await chrome.storage.local.set({ [BANNED_KEY]: repaired }); } catch (e) {}
    try { console.warn('[kizar] local Netflix block list cleared once, to undo entries written by a previous build'); } catch (e) {}
  }
  return out;
}

// Shared dead-account list (dead.json on GitHub): every user learns which
// accounts are expired / logged out, so the whole pool stops offering them.
const DEAD_MAX = 300;
// Auto-filtering, governed from the control room's settings.json. The operator
// can turn the whole pipeline off: dead marks and local bans stop hiding
// accounts, and the pool is served as stored (still de-duplicated, never a
// wall of the same cookie). Fails ON - a broken or absent flag never widens
// the pool to everything.
let autoFilter = { enabled: true };
let deadRemote = { netflix: [], prime: [], crunchyroll: [] };
let deadRemoteFetched = false;
let deadFetchAt = 0;
// Which dead accounts this install has already reported, and when. Keyed by
// platform and fingerprint, so one dud cannot mask another found in the same run.
const deadReportedAt = Object.create(null);

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
      prime: normalizeDeadEntries(data.prime),
      crunchyroll: normalizeDeadEntries(data.crunchyroll)
    };
    deadFetchAt = Date.now();
    deadRemoteFetched = true;
  } catch (e) {}
  return deadRemote;
}

// ---------------------------------------------------------------------------
// Saved-account swap requests (user -> operator approval)
// ---------------------------------------------------------------------------
async function reportDeadAccount(key, fingerprint, why) {
  if (!fingerprint || PLATFORM_KEYS.indexOf(key) < 0) return;
  const p = await getProfile().catch(() => null);
  const by = (p && p.username) || '';

  // The debounce is PER ACCOUNT, not per session.
  //
  // It used to be one timer for the whole popup, so a single run that met two
  // dead accounts reported the first and silently dropped the second. That dud
  // stayed in the pool and the next customer walked straight into it - which is
  // the exact thing this is meant to prevent. The only thing the pause needs to
  // stop is the SAME account being reported over and over, so that is what it is
  // keyed on.
  const tag = key + ':' + fingerprint;
  const now = Date.now();
  const seenAt = deadReportedAt[tag] || 0;
  if (now - seenAt < 5000) return;
  deadReportedAt[tag] = now;

  // The server first, because it is the only place that can remove the account
  // from the POOL FILE as well as marking it dead.
  //
  // Writing dead.json from the browser - which is what this did - left the lines
  // in netflix.txt, so the "deleted" account was still handed to the next
  // customer. It also needed a repository token shipped inside the extension and
  // raced with anyone else reporting at the same time.
  const access = (p && p.activations && p.activations.access) || '';
  if (access) {
    try {
      const res = await fetch(CONTROL_ROOM + '/api/dead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-kizar-key': access },
        body: JSON.stringify({
          action: 'block', platform: key, fp: fingerprint, by: by,
          reason: why || 'dead at use',
          // Every report reaching here is a hard verdict: this function is only
          // called for 'dead' and 'ads', and an inconclusive read settles as
          // 'unknown' and never reports. Saying so lets the server remove the
          // account now instead of parking it as a suspect that - because the
          // pool hands out a different account each run - could never confirm.
          proof: 'definitive'
        })
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j && j.ok && j.dead) {
        deadRemote = {
          netflix: normalizeDeadEntries(j.dead.netflix),
          prime: normalizeDeadEntries(j.dead.prime),
          crunchyroll: normalizeDeadEntries(j.dead.crunchyroll)
        };
        deadRemoteFetched = true;
        deadFetchAt = Date.now();
        // Do not announce a deletion that did not happen. If the server only
        // marked a suspect, say that instead - claiming "removed" when the line
        // is still in the pool is how an operator loses trust in the counter.
        if (j.confirmed === false) {
          toast('Noted a possible dead ' + platformDisplayName(key) + ' account - kept in the pool until it is seen dead twice', 3600);
        } else {
          const purged = j.purged && (j.purged.removedLines || j.purged.removedAccounts);
          if (purged) toast('Removed ' + purged + ' dead ' + platformDisplayName(key) + ' account' + (purged > 1 ? 's' : ''), 2600);
        }
        return;
      }
    } catch (e) { /* fall through to the old path */ }
  }

  // Only reached when the server could not be reached. Marking the fingerprint
  // dead locally is still worth doing, because it stops THIS install handing the
  // same dud out again.
  let tk = null;
  try { tk = await getOwnerToken(); } catch (e) { return; }
  if (!tk) return;
  try {
    const data = JSON.parse((await fetchFromGithub(GITHUB_CONFIG.dead)) || '{}') || {};
    const raw = {
      netflix: Array.isArray(data.netflix) ? data.netflix : [],
      prime: Array.isArray(data.prime) ? data.prime : [],
      crunchyroll: Array.isArray(data.crunchyroll) ? data.crunchyroll : []
    };
    const list = raw[key];
    if (list.some((e) => (typeof e === 'string' ? e : e && e.fp) === fingerprint)) return;
    list.push({ fp: fingerprint, by, at: new Date().toISOString() });
    if (list.length > DEAD_MAX) list.splice(0, list.length - DEAD_MAX);
    raw.updatedAt = new Date().toISOString();
    const meta = await githubJson(GITHUB_CONFIG.dead).catch(() => null);
    await putGithubJson(GITHUB_CONFIG.dead, JSON.stringify(raw, null, 2), meta ? meta.sha : undefined);
    deadRemote = {
      netflix: normalizeDeadEntries(raw.netflix),
      prime: normalizeDeadEntries(raw.prime),
      crunchyroll: normalizeDeadEntries(raw.crunchyroll)
    };
    deadRemoteFetched = true;
    deadFetchAt = Date.now();
    } catch (e) {}
}

async function requestSwap(key, fingerprint, reason) {
  const p = await getProfile();
  if (!p.username) { toast('Save your name first', 3000); return { ok: false, reason: 'Save your name first' }; }
  if (!fingerprint) return { ok: false, reason: 'Nothing to swap' };
  const platformName = platformDisplayName(key);

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
    const names = keys.map((k) => platformDisplayName(k)).join(' + ');
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
          names.push(platformDisplayName(key));
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
  STATE.banned = { netflix: [], prime: [], crunchyroll: [] };
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
  // One server round trip for all three platforms, not three. The cache is only
  // used to draw instantly when it is fresh; it never grants permission.
  const snap = (await getRateSnapshot()) || { ok: false, reason: RATE_FAIL.OFFLINE };
  // Kept on STATE so the help panel can describe the same numbers the lights are
  // showing, rather than recomputing them from a second, possibly different, read.
  STATE.rateSnapshot = snap;
  for (const key of PLATFORM_KEYS) {
    const all = STATE.sessions[key] || [];
    // Auto-filtering OFF: the operator has chosen to serve the pool as stored,
    // so only the de-duplication that stops the same cookie being counted
    // twice remains. The still-fetched lists just stop excluding anything.
    const filterOn = autoFilter.enabled !== false;
    const seen = new Set();
    const usable = all.filter((s) => {
      const fp = sessionFingerprint(s);
      if (seen.has(fp)) return false;
      seen.add(fp);
      if (!filterOn) return true;
      return !banned[key].includes(fp) && !deadList[key].includes(fp);
    });
    const countEl = $(key + '-count');
    if (countEl) countUp(countEl, usable.length);
    const st = await rateStateFor(snap, key);
    paintRate(key, st);
const btn = $('btn-stream-' + key);
    if (btn) {
      const blocked = await platformBlocked(key);
      const maint = platformMaintenance(key);
      // A platform with no allowance left, or one whose allowance could not be
      // confirmed, is not streamable. Failing closed here is what makes the
      // server-side number mean anything.
      btn.disabled = usable.length === 0 || STATE.streaming || blocked || !!maint || !st.allowed;
      // Say why a dead button is dead. An unexplained grey button is
      // indistinguishable from a broken extension, which is exactly what an
      // empty pool or a refused key used to look like.
      btn.title = blocked
        ? 'Not included in your plan'
        : (maint
          ? (maint.message || (platformDisplayName(key) + ' is down for maintenance'))
          : (!st.known
            ? (st.reason === 'no_key' ? 'Activate a key to stream' : 'Could not reach the server to confirm your allowance')
            : (!st.allowed
              ? 'No connects left for ' + platformDisplayName(key)
                  + (st.resetInMs ? ' \u00b7 resets in ' + rateShortWait(st.resetInMs) : '')
              : (usable.length === 0
                ? (STATE.streaming ? 'One stream at a time' : 'No accounts available for ' + platformDisplayName(key))
                : (STATE.streaming ? 'One stream at a time' : st.unlimited
                  ? 'Unlimited connects'
                  : st.remaining + ' of ' + st.limit + ' connects left')))));
      // A platform in maintenance keeps its card and says so on the button. It is
      // hidden entirely if the key does not include it, but maintenance is
      // temporary and the customer should SEE that Netflix is down rather than
      // find the card missing and think their account is broken.
      if (!blocked) {
        btn.textContent = maint ? (platformDisplayName(key) + ' \u00b7 maintenance') : btn.dataset.label || btn.textContent;
        if (!maint && btn.dataset.label) btn.textContent = btn.dataset.label;
        if (!btn.dataset.label && !maint) btn.dataset.label = btn.textContent;
      }
      const card = btn.closest('.stream-card');
      if (card) {
        card.classList.toggle('hidden', blocked);
        card.classList.toggle('maint', !!maint);
      }
    }
  }
}

async function refresh() {
  const btn = $('btn-refresh');
  if (btn) btn.classList.add('spinning');
  pill('sync', 'Syncing...');
  try {
    await Promise.all([loadVersionGate(), loadServiceFlags()]);
    await syncPlatformScope();
    if (isStreamingBlocked()) {
      STATE.sessions.netflix = [];
      STATE.sessions.prime = [];
      STATE.sessions.crunchyroll = [];
      await updateCounts();
      renderServiceState();
      return;
    }
    // Each pool read keeps its own failure. They used to be caught into '' one by
// one, so an expired key (401) or a missing file (404) quietly became "zero
// sessions" and the popup still said "Ready" with every button greyed out and
// no explanation anywhere. Now a failure is reported as itself.
const reads = await Promise.all([
      fetchFromGithub(GITHUB_CONFIG.files.netflix).then((t) => ({ text: t, err: '' }), (e) => ({ text: '', err: String((e && e.message) || e) })),
      fetchFromGithub(GITHUB_CONFIG.files.prime).then((t) => ({ text: t, err: '' }), (e) => ({ text: '', err: String((e && e.message) || e) })),
      fetchFromGithub(GITHUB_CONFIG.files.crunchyroll).then((t) => ({ text: t, err: '' }), (e) => ({ text: '', err: String((e && e.message) || e) }))
    ]);
    STATE.sessions.netflix = parseCookieFile(reads[0].text);
    STATE.sessions.prime = parseCookieFile(reads[1].text);
    STATE.sessions.crunchyroll = parseCookieFile(reads[2].text);
    await loadDeadRemote(true);
    await updateCounts();

    // Work out what to actually tell the user, because "Ready" over three dead
    // buttons was the whole problem.
    const failed = reads.filter((r) => r.err);
    const authProblem = failed.some((r) => /auth|401|403|expired|locked/i.test(r.err));
    const total = STATE.sessions.netflix.length + STATE.sessions.prime.length + STATE.sessions.crunchyroll.length;
    const noteEl = $('footer-note');

// "auth" here means the READ of the account pool was refused, not that the key is
      // bad. The old wording told the customer their key was refused - and they had
      // just watched it redeem successfully - so they went looking for a problem
      // that was not in their key. It says what actually failed instead.
      if (authProblem) {
        pill('err', 'Pool unreachable');
      if (noteEl) noteEl.textContent = 'Your key was refused, so no accounts could be loaded';
      toast('Your key was refused - sign in again', 4000);
    } else if (failed.length && !total) {
      pill('err', 'No accounts');
      if (noteEl) noteEl.textContent = 'Could not reach the account pool: ' + failed[0].err.slice(0, 40);
    } else if (!total) {
      // Every file read cleanly and every one of them is empty. That is a real
      // answer, not a failure: the pool itself has nothing in it.
      pill('err', 'Pool empty');
      if (noteEl) noteEl.textContent = 'The account pool is empty right now';
      toast('No accounts available right now', 3500);
    } else {
      pill('ok', 'Ready');
      if (noteEl) noteEl.textContent = total + ' accounts live';
    }
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
  // Platform scope: a Netflix-only plan must stay off Prime, and vice versa.
  if (await platformBlocked(key)) {
    toast(platformDisplayName(key) + ' is not included in your plan', 3500);
    pill('err', 'Not in your plan');
    await updateCounts();
    return;
  }
  // Maintenance is per platform, and it is checked here rather than only in the
  // card so a button pressed while the flag was still live cannot start a stream.
  const maint = platformMaintenance(key);
  if (maint) {
    toast(maint.message || (platformDisplayName(key) + ' is down for maintenance. Try another platform.'), 4200);
    pill('err', 'Maintenance');
    await updateCounts();
    return;
  }
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

  // Allowance, confirmed by the server, before anything is spent. Placed after
  // the operator gates (a paused build should say so, not "no connects left")
  // and before the first cookie is touched.
  if (!(await requireRateAllowance(key))) { await updateCounts(); return; }

  // One id per attempt, reused across the retry inside claimRate, so the same
  // session can never be charged twice.
  const claimId = 's-' + key + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e9);

  const platformName = platformDisplayName(key);
  const saved = await getSaved();
  const savedList = saved[key] || [];
  const p = await getProfile();
  const isActive = isPaidPlan(p.plan);

  if (!isActive && savedList.length) {
    // Pick a SAVED session at random rather than always the first one.
    //
    // addSaved() pushes to the END of the list, so savedList[0] was always the
    // OLDEST session the account had ever saved - and it was probed first on
    // every single press. That was the visible "it goes by order" behaviour: the
    // same account was always tried first, and if it happened to work, the user
    // always got that same one and never reached the rest of the pool.
    const savedOrder = shuffle(savedList);
    const top = savedOrder[0];
    STATE.streaming = true;
    installWaitGuard();
    showStreamWait(true, {
      key, index: 0, total: 0, pct: 8,
      title: 'Finding an account',
      sub: platformName
    });
    const check = await runSession(key, top.cookies);
    if (check.ok) {
      try { await chrome.storage.session.remove(PENDING_KEY); } catch (e) {}
      STATE.streaming = false;
      showProgress(false);
      finishStreamWait(key, 650);
      pill('ok', platformName + ' Active');
      toast(`${platformName} connected`);
      // The saved entry is rewritten so its renewal date is whatever the
      // account page showed THIS time - the days-left badge on the card reads
      // this field, so this is what keeps it honest.
      addSaved(key, top.cookies, top.fingerprint, {
        nextPayment: check.nextPayment || 0,
        nextPaymentAt: check.nextPayment || 0,
        nextPaymentCheckedAt: Date.now()
      }).catch(() => {});
      await updateCounts();
      bumpUsage(key === 'netflix' ? { netflixSessions: 1 } : key === 'prime' ? { primeSessions: 1 } : { crunchyrollSessions: 1 });
      // A connect only counts once it actually WORKED. Every failure path above
      // returns before this line, so a hunt across ten dead accounts costs nothing.
      claimRate(key, claimId).catch(() => {});
      await activateTab(check.tabId);
      return;
    }
    if (check.reason === 'region') {
      // Valid member, wrong region for this IP. Blocked for this user only; not
      // reported, because the operator's list is shared and this account is
      // perfectly good where it belongs.
      const rb = await loadBanned();
      if (!rb[key].includes(top.fingerprint)) rb[key].push(top.fingerprint);
      await chrome.storage.local.set({ [BANNED_KEY]: rb });
      STATE.banned = rb;
      try { console.debug('[kizar:stream] saved session region-limited, skipping'); } catch (e) {}
    } else if (check.reason === 'dead' || check.reason === 'ads') {
      // Reported like a dead account so it is erased from the shared pool rather
      // than merely skipped here - otherwise the next customer walks into the
      // same "plan not available in this region" wall. A payment-hold account
      // surfaces as reason 'dead' with subReason 'payment_hold'; both invalidate
      // the saved session the same way, and the operator sees the real cause.
      await removeSaved(key, top.fingerprint);
      const banned = await loadBanned();
      if (!banned[key].includes(top.fingerprint)) banned[key].push(top.fingerprint);
      await chrome.storage.local.set({ [BANNED_KEY]: banned });
      STATE.banned = banned;
      const deadWhy = check.subReason === 'payment_hold' ? 'payment on hold' : (check.reason === 'ads' ? 'ad-supported plan' : 'dead at use');
      reportDeadAccount(key, top.fingerprint, deadWhy).catch(() => {});
    }
  }

  const savedFps = new Set(savedList.map((s) => s.fingerprint));
  const deadRemote = await loadDeadRemote(false);
  // Deduped as well as filtered. The pool is a flat list of cookie sets, and the
  // same account can legitimately appear twice in the source file - which put
  // the identical account next to itself in the hunt, twice, wasting a full
  // 18s test on each. To the user that reads as "it is not shuffling".
  const seenFp = new Set();
  const candidates = [];
  const filterOn = autoFilter.enabled !== false;
  for (const s of (STATE.sessions[key] || [])) {
    const fp = sessionFingerprint(s);
    if (seenFp.has(fp)) continue;
    seenFp.add(fp);
    // Auto-filtering OFF: dead marks and local bans stop excluding sessions.
    // Only already-saved ones stay out otherwise, and only while the filter is
    // on - with the filter off the operator wants every account the pool can
    // offer, saved or not, and the shuffle keeps the order random either way.
    if (filterOn && (STATE.banned[key].includes(fp) || savedFps.has(fp) || deadRemote[key].includes(fp))) continue;
    candidates.push(s);
  }
  if (!candidates.length) {
    showProgress(false);
    STATE.streaming = false;
    toast('No new sessions available');
    return;
  }

  STATE.streaming = true;
  installWaitGuard();
  await updateCounts();

  const pool = shuffle(candidates);

  let deadCount = 0;
  let regionCount = 0;
  let errors = 0;

  for (let i = 0; i < pool.length; i++) {
    const cookies = pool[i];
    const fp = sessionFingerprint(cookies);
    // Reserve the last 18% for the "opening it now" beat, so the bar never sits
    // at 100% while we are still searching.
    const pct = 10 + Math.round((i / pool.length) * 80);
    // A candidate can take up to 18s and the percentage will not move during it.
// Nothing fakes motion to cover that gap: the arc only advances when the search
// really has advanced, and the elapsed counter is the honest liveness signal.
    showStreamWait(true, {
      key, index: i + 1, total: pool.length, pct,
      title: 'Finding an account',
      sub: platformName,
      step: 'session ' + (i + 1) + '/' + pool.length
    });

    try { await chrome.storage.session.set({ [PENDING_KEY]: { platformKey: key, fingerprint: fp } }); } catch (e) {}

    const result = await runSession(key, cookies);

    if (result.ok) {
      try { await chrome.storage.session.remove(PENDING_KEY); } catch (e) {}
      await addSaved(key, cookies, fp, {
        nextPayment: result.nextPayment || 0,
        nextPaymentAt: result.nextPayment || 0,
        nextPaymentCheckedAt: Date.now()
      });
      STATE.streaming = false;
      showProgress(false);
      finishStreamWait(key, 700);
      pill('ok', platformName + ' Active');
      toast(`${platformName} connected & saved!`);
      await updateCounts();
      bumpUsage(key === 'netflix' ? { netflixSessions: 1 } : key === 'prime' ? { primeSessions: 1 } : { crunchyrollSessions: 1 });
      // A connect only counts once it actually WORKED. Every failure path above
      // returns before this line, so a hunt across ten dead accounts costs nothing.
      claimRate(key, claimId).catch(() => {});
      await activateTab(result.tabId);
      return;
    }

    const reason = result.reason;
    if (reason === 'region') {
      // A valid Prime member being served a reduced catalogue because the account
      // country does not match this IP. Not broken, just unusable HERE: the user
      // would get a homepage that plays Originals and asks to buy everything
      // else. Skipped locally so this account stops being offered to this user,
      // and deliberately NOT reported - the operator's dead list is shared by
      // every user, and throwing this account away would cost a good one in its
      // own region.
      regionCount++;
      if (!STATE.banned[key].includes(fp)) STATE.banned[key].push(fp);
      await chrome.storage.local.set({ [BANNED_KEY]: STATE.banned });
    } else if (reason === 'dead' || reason === 'ads') {
      // An ad-supported plan is treated exactly like a dead one: it is reported so
      // it is erased from the shared pool, because the next customer will hit the
      // same "plan not available in this region" wall. A subscription on hold
      // (failed payment / suspended billing) arrives here as reason 'dead' with
      // subReason 'payment_hold' - indistinguishable to the user, but the
      // operator sees the real reason in the dead log.
      deadCount++;
      if (!STATE.banned[key].includes(fp)) STATE.banned[key].push(fp);
      await chrome.storage.local.set({ [BANNED_KEY]: STATE.banned });
      const why = result.subReason === 'payment_hold'
        ? 'payment on hold'
        : (reason === 'ads' ? 'ad-supported plan' : 'dead at use');
      reportDeadAccount(key, fp, why).catch(() => {});
    } else {
      errors++;
    }
  }

  try { await chrome.storage.session.remove(PENDING_KEY); } catch (e) {}
  STATE.streaming = false;
  // All exhausted: say so plainly on the overlay before tearing it down, so the
  // user gets an answer instead of a silent return to the home screen.
  showStreamWait(true, {
    key, done: true, pct: 100,
    title: 'No account available',
    sub: platformName,
    step: 'tested ' + (deadCount + regionCount + errors)
  });
  await sleep(1800);
  showStreamWait(false);
  clearWaitState();

  if (regionCount && !deadCount) {
    // Distinct from "dead": these accounts work, just not from here. Saying
    // "all sessions failed" would be a lie the user can see through.
    pill('err', 'Region limited');
    toast('Those accounts only work from their own country. Try again later.', 3800);
  } else if (deadCount) {
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
  if (reason && !was) {
    toast(RENEW_TEXT[reason], 4500);
    // The subscription just ended: everything it unlocked goes with it, before
    // the user reads the message. Waiting would leave a window where the old
    // sessions still play.
    wipeExpiredAccess().catch(() => {});
  }
  renderKeyBlock();
  return keyState.expired;
}

// Subscription end wipes the slate: saved sessions, the pending handoff, and
// the actual browser cookies the user streamed with. Nothing keeps working
// afterwards — streaming already refuses without a live key, and there is
// nothing left to replay with. A fresh key starts it all over.
async function wipeExpiredAccess() {
  try { await chrome.storage.session.remove(PENDING_KEY); } catch (e) {}
  try { await clearSavedSessions(); } catch (e) {}
  STATE.sessions = { netflix: [], prime: [], crunchyroll: [] };
  STATE.streaming = false;
  for (const key of PLATFORM_KEYS) {
    const plat = PLATFORMS[key];
    if (!plat) continue;
    try { await clearDomainCookies(plat); } catch (e) {}
  }
  try { await updateCounts(); } catch (e) {}
  try { await renderSavedChips(); } catch (e) {}
}

function renderKeyBlock() {
  const box = $('key-expired-box');
  if (!box) return;
  const on = !!keyState.expired;
  box.classList.toggle('hidden', !on);
  if (!on) return;
  const t = $('key-expired-text');
  if (t) t.textContent = RENEW_TEXT[keyState.reason] || RENEW_TEXT.expired;
  // The lifetime now lives in the plan header rather than its own strip, so an
  // expired key marks that instead of reaching for an element that no longer
  // exists - which is how an expired key could stop saying so at all.
  const life = $('m-lifetime');
  if (life) {
    life.textContent = 'expired - renew to continue';
    life.classList.add('warn');
    life.classList.remove('hidden');
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
  // Re-enter needs a live key, not a particular plan: PREMIUM users re-enter
  // through tryStream, PRO users through tryStreamSaved. Swap needs PRO.
  const hasKey = !!(p.activations && p.activations.access);
  const canManage = isPaidPlan(p.plan);
  const platformName = platformDisplayName(key);
  const blocked = await platformBlocked(key);

  // The header count has to be written even when nothing renders, otherwise a
  // row that was just cleared would keep claiming the old number. At zero the
  // slot goes empty, because "0 saved" next to an empty state reads badly.
  const counter = $('count-' + key);
  if (counter) {
    counter.textContent = list.length === 0 ? '' : list.length === 1 ? '1 saved' : list.length + ' saved';
  }

  list.forEach((s, idx) => {
    const card = document.createElement('div');
    card.className = 'acc-card is-' + key;

    // Plain card: just the platform name and an Enter button. No badge, no
    // code, no timestamp - the count header already carries that context.
    const title = document.createElement('span');
    title.className = 'acc-title';
    title.textContent = platformName;

    // Days left, read off the renewal date the account page printed at stream
    // time. Computed at render, from the stored ms timestamp - so every render
    // (popup open, tab shown, stream, delete) recounts it from the same stored
    // date without touching the network.
    // 0 or fewer  -> the renewal has passed: the session is suspect, badge red.
    // 1-3 days    -> amber warning: watch this one.
    // more        -> plain "N days left".
    // An entry with no stored date (streamed before this existed, or a
    // platform other than Netflix) shows no badge - absence beats a lie.
    if (key === 'netflix' && s.nextPaymentAt) {
      const days = Math.floor((s.nextPaymentAt - Date.now()) / 86400000);
      const badge = document.createElement('span');
      badge.className = 'acc-days ' + (days <= 0 ? 'expired' : days <= 3 ? 'soon' : 'fine');
      badge.textContent = days > 0 ? days + (days === 1 ? ' day left' : ' days left') : days === 0 ? 'expires today' : 'expired';
      title.appendChild(badge);
    }

    const actions = document.createElement('div');
    actions.className = 'acc-actions';
    if (hasKey && !blocked) {
      const go = document.createElement('button');
      go.className = 'acc-go';
      go.type = 'button';
      go.title = 'Enter ' + platformName;
      const label = document.createElement('span');
      label.textContent = 'Enter';
      go.appendChild(label);
      actions.appendChild(go);
    }
    if (canManage) {
      // Netflix-only: link a saved session to a smart TV via the code page.
      if (key === 'netflix') {
        const tv = document.createElement('button');
        tv.className = 'acc-tv';
        tv.type = 'button';
        tv.title = 'Connect this account to your TV';
        const tlabel = document.createElement('span');
        tlabel.textContent = 'TV';
        tv.appendChild(tlabel);
        actions.appendChild(tv);
      }
    }
    // Removing your own saved account is not a paid feature. It used to sit
    // behind the PRO check, which left PREMIUM users unable to discard a
    // session they did not want - and since PREMIUM may only hold one, they
    // were stuck with it. The handler never needed a plan, so neither does the
    // button. Anything they drop frees the slot for a different account.
    {
      const del = document.createElement('button');
      del.className = 'acc-del';
      del.type = 'button';
      del.title = 'Remove this account';
      del.setAttribute('aria-label', 'Remove ' + platformName + ' account');
      const dicon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      dicon.setAttribute('viewBox', '0 0 24 24');
      dicon.setAttribute('aria-hidden', 'true');
      const dpath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      dpath.setAttribute('d', 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z');
      dicon.appendChild(dpath);
      del.appendChild(dicon);
      actions.appendChild(del);
    }

    card.appendChild(title);
    card.appendChild(actions);

    const goBtn = card.querySelector('.acc-go');
    if (goBtn) {
      goBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (canManage) await tryStreamSaved(key, s.fingerprint);
        else await tryStream(key); // FREE re-enters by re-checking the top slot
      });
    }

    const tvBtn = card.querySelector('.acc-tv');
    if (tvBtn) {
      tvBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await connectTv(key, s);
      });
    }

    const delBtn = card.querySelector('.acc-del');
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
  if (hint) hint.classList.toggle('hidden', list.length > 0 || blocked);
  // A platform outside the key's access vanishes entirely — card, count and
  // empty state — as if it was never there. Disabling the button is not
  // enough: the user asked that the others not show at all.
  const wrap = row ? row.closest('.session-card') : null;
  if (wrap) wrap.classList.toggle('hidden', blocked);
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
        label: platformDisplayName(key) + ' #' + (i + 1),
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
        ? 'Swap is a PRO feature. Your key is PREMIUM right now.'
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
  // Saved sessions follow the same platform scope as a fresh one.
  if (await platformBlocked(key)) {
    toast(platformDisplayName(key) + ' is not included in your plan', 3500);
    pill('err', 'Not in your plan');
    await updateCounts();
    return;
  }
  await updateCounts();
  // Replaying a saved session is still a connect, so it needs an allowance too -
  // otherwise the saved-session button would be a way around the limit entirely.
  if (!(await requireRateAllowance(key))) { await updateCounts(); return; }
  const savedClaimId = 'v-' + key + '-' + fingerprint + '-' + Date.now();
  const platformName = platformDisplayName(key);
  const saved = await getSaved();
  const entry = saved[key].find((s) => s.fingerprint === fingerprint);
  if (!entry) {
    toast('Session expired');
    await updateCounts();
    return;
  }
  STATE.streaming = true;
  installWaitGuard();
  showStreamWait(true, {
    key, index: 0, total: 0, pct: 25,
    title: 'Finding an account',
    sub: platformName,
    step: 'saved session'
  });
  const result = await runSession(key, entry.cookies);
  if (result.ok) {
    await chrome.storage.session.remove(PENDING_KEY);
    STATE.streaming = false;
    // Same refresh as the fresh-stream path: the entry is rewritten with
    // whatever renewal date the account page showed now, so the days-left
    // badge on the card tracks reality every time the account is used.
    addSaved(key, entry.cookies, entry.fingerprint, {
      nextPayment: result.nextPayment || 0,
      nextPaymentAt: result.nextPayment || 0,
      nextPaymentCheckedAt: Date.now()
    }).catch(() => {});
    renderChips(key).catch(() => {});
    showProgress(false);
    finishStreamWait(key, 650);
    pill('ok', platformName + ' Active');
    toast(`${platformName} launched!`);
    // Relaunching a saved session is still a session used, so it counts. This
    // path had no bump at all, which is why a user who only ever reused their
    // saved session showed nothing at all in the Control Room.
    bumpUsage(key === 'netflix' ? { netflixSessions: 1 } : key === 'prime' ? { primeSessions: 1 } : { crunchyrollSessions: 1 });
    claimRate(key, savedClaimId).catch(() => {});
    await activateTab(result.tabId);
  } else if (result.reason === 'dead' || result.reason === 'ads') {
    await removeSaved(key, fingerprint);
    const banned = await loadBanned();
    if (!banned[key].includes(fingerprint)) banned[key].push(fingerprint);
    await chrome.storage.local.set({ [BANNED_KEY]: banned });
    STATE.banned = banned;
    reportDeadAccount(key, fingerprint, result.subReason === 'payment_hold'
      ? 'payment on hold'
      : (result.reason === 'ads' ? 'ad-supported plan' : 'dead at use')).catch(() => {});
    STATE.streaming = false;
    showProgress(false);
    showStreamWait(true, {
      key, done: true, pct: 100,
      title: 'Session expired',
      sub: platformName,
      step: 'saved session expired'
    });
    await sleep(1700);
    showStreamWait(false);
    clearWaitState();
    pill('err', 'Expired');
    toast('Session was expired and removed', 3000);
  } else {
    STATE.streaming = false;
    showProgress(false);
    showStreamWait(true, {
      key, done: true, pct: 100,
      title: 'Could not start',
      sub: platformName,
      step: 'saved session failed'
    });
    await sleep(1700);
    showStreamWait(false);
    clearWaitState();
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
  const btns = document.querySelectorAll('.nav-btn');
  let activeIndex = 0;
  for (let i = 0; i < btns.length; i++) {
    const on = btns[i].dataset.view === name;
    btns[i].classList.toggle('active', on);
    // The slider is positioned from this index, so the moving pill and the
    // highlighted tab are always the same thing. Deriving it from the button's
    // own position in the DOM means a tab can be added or removed without the
    // two falling out of step.
    if (on) activeIndex = i;
    btns[i].setAttribute('aria-current', on ? 'page' : 'false');
  }
  const bar = document.querySelector('.bottom-bar');
  if (bar) {
    bar.style.setProperty('--nav-n', String(btns.length || 4));
    bar.style.setProperty('--nav-i', String(activeIndex));
  }
  document.body.classList.toggle('onboarding', name === 'welcome');
}

function setCodeStatus(text, ok) {
  const st = $('code-status');
  if (!st) return;
  st.textContent = text;
  st.classList.toggle('ok', !!ok);
}

const AVATARS = ['🐱', '🦊', '🐻', '🐼', '🐯', '🦁', '🐸', '🐙', '🦄', '🐬', '🦋', '🐝', '🐳', '🦉', '🌵', '🌈', '🍩', '🚀', '⚡', '🌟'];

const AVATAR_COLORS = ['#fde68a', '#fbcfe8', '#a5b4fc', '#99f6e4', '#fca5a5', '#c4b5fd', '#fcd34d', '#86efac', '#93c5fd', '#f9a8d4', '#fed7aa', '#a7f3d0', '#e9d5ff', '#fde047', '#f0abfc', '#7dd3fc', '#fecaca', '#d9f99d', '#fef08a', '#bae6fd'];

const AVATAR_STORAGE_KEY = 'kizar_avatar';

async function getAvatarIndex() {
  try {
    const d = await chrome.storage.local.get(AVATAR_STORAGE_KEY);
    const i = Number(d[AVATAR_STORAGE_KEY]);
    return Number.isInteger(i) && i >= 0 && i < AVATARS.length ? i : null;
  } catch (e) { return null; }
}

async function ensureAvatarIndex() {
  const existing = await getAvatarIndex();
  if (existing !== null) return existing;
  const i = Math.floor(Math.random() * AVATARS.length);
  try { await chrome.storage.local.set({ [AVATAR_STORAGE_KEY]: i }); } catch (e) {}
  return i;
}

async function renderProfileView() {
  const p = await getProfile();
  const av = $('avatar');
  let ai = 0;
  if (av) {
    ai = await ensureAvatarIndex();
    av.textContent = AVATARS[ai];
  }
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
  const isPro = isPaidPlan(p.plan);
  const pp = $('p-plan');
  if (pp) {
    pp.textContent = isPro ? 'PRO' : 'PREMIUM';
    pp.classList.remove('pro', 'free', 'none');
    pp.classList.add(isPro ? 'pro' : (p.plan === 'free' ? 'free' : 'none'));
  }
  const pd = $('p-plan-desc');
  if (pd) {
    const plats = await resolvePlatforms();
    pd.textContent = planDescFor(p.plan, plats);
  }
  const wrap = $('avatar-wrap');
  if (wrap) {
    wrap.classList.toggle('pro', isPro);
    wrap.style.setProperty('--avatar-color', AVATAR_COLORS[ai % AVATAR_COLORS.length]);
  }
  const star = $('p-star');
  if (star) star.style.display = isPro ? 'grid' : 'none';
}

const PLAN_BENEFITS = {
  inactive: ['Stream Netflix, Prime & Crunchyroll', '1 auto-managed session', 'No PRO memory', 'Enter a code to upgrade'],
  free: ['Stream Netflix, Prime & Crunchyroll', '1 saved session', 'Time-limited access', 'Upgrade to PRO any time'],
  // "Unlimited" used to sit on PRO, which is the same wrong claim as showing a
  // VIP holder as PRO - PRO is capped, and only VIP is unlimited.
  active: ['Stream Netflix, Prime & Crunchyroll', '3 saved sessions', 'Priority session pool', 'Re-enter and delete saved accounts', 'Swap a broken account instantly'],
  pro1: ['Stream Netflix, Prime & Crunchyroll', '3 saved sessions', 'Higher connect allowance', 'Priority session pool', 'Swap a broken account instantly'],
  vip: ['Unlimited connects on every platform', '3 saved sessions', 'Priority session pool', 'Re-enter and delete saved accounts', 'Swap a broken account instantly']
};

const PLAN_META = {
  inactive: { label: 'PREMIUM', desc: 'No key yet', flag: 'PREMIUM' },
  free: { label: 'PREMIUM', desc: 'Key active - time limited', flag: 'PREMIUM' },
  active: { label: 'PRO', desc: 'Everything unlocked', flag: 'PRO' },
  pro1: { label: 'PRO1', desc: 'Higher allowance', flag: 'PRO1' },
  vip: { label: 'VIP', desc: 'Unlimited connects', flag: 'VIP' }
};

// The platforms a key actually unlocks (netflix / prime / both). Read from the
// code entry first, then from the operator-enforced scope, defaulting to both.
// The cache is keyed on the current activation code + scope so entering a new
// key instantly recomputes instead of showing the old key's platforms.
let platformInfoCache = { t: 0, plats: null, code: '', scopeKey: '' };

async function resolvePlatforms() {
  let p = null;
  try { p = await getProfile(); } catch (e) {}
  const code = (p && p.activations && p.activations.access) || '';
  const scopeKey = platformScope.join(',');
  const now = Date.now();
  const fresh = platformInfoCache.plats && now - platformInfoCache.t < 15000
    && platformInfoCache.code === code && platformInfoCache.scopeKey === scopeKey;
  if (fresh) return platformInfoCache.plats;
  // Platform, cached and code-scoped.
  //
  // This used to read the scope out of a browser-fetched copy of activation.json
  // and fall back to ALL THREE platforms when it could not. So the plan card could
  // promise something the streamer then refused - or the reverse. The scope is now
  // the one the server answered with, stored on the profile.
  if (platformScopeKnown && platformScope.length) return platformScope.slice();
  try {
    const p = await getProfile();
    if (Array.isArray(p.platforms) && p.platforms.length) {
      const f = p.platforms.filter((x) => x === 'netflix' || x === 'prime' || x === 'crunchyroll');
      if (f.length) return f;
    }
  } catch (e) {}
  const stale = platformInfoCache.plats;
  if (Array.isArray(stale) && stale.length && platformInfoCache.code === code) return stale.slice();
  // No answer at all: return nothing rather than everything. The card then says
  // the plan is unknown instead of claiming three platforms it may not have.
  return [];
}

function platformDisplayName(key) {
  if (key === 'prime') return 'Prime';
  if (key === 'crunchyroll') return 'Crunchyroll';
  return 'Netflix';
}

function mediaLabel(plats) {
  const names = plats.map(platformDisplayName);
  return names.length > 1 ? names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1] : (names[0] || 'Netflix');
}

// The allowance as one short phrase for the plan header. Same source of truth as
// benefitsFor, which used to be the only place it was stated - which is how the
// header and the list could say two different things.
function planAllowanceFor(plan) {
  if (plan === 'vip') return 'Unlimited connects';
  if (plan === 'pro1') return '12 connects / 4h';
  if (plan === 'active') return '7 connects / 4h';
  if (plan === 'free') return '4 connects / 4h';
  return 'No key';
}

function planDescFor(plan, plats) {
const media = mediaLabel(plats);
  const only = plats.length === 1 ? ' · ' + media + ' only' : '';
  const dash = ' · ';
  if (plan === 'vip') return 'Unlimited connects' + (only || dash + 'every platform');
  if (plan === 'pro1') return '12 connects per 4 hours' + (only || '');
  if (plan === 'active') return only ? 'PRO' + only : 'Everything unlocked';
  if (plan === 'free') return 'Key active' + (only || dash + 'time limited');
  return 'No key yet' + dash + 'enter a code to upgrade';
}

// Fill the Plan view's Connects block. This is where the allowance is spelled
// out; the lights on the home cards only answer "can I right now".
async function paintPlanRate() {
  const rows = $('plan-rate-rows');
  if (!rows) return;
  const snap = await getRateSnapshot(false);
  const tierEl = $('plan-rate-tier');
  const noteEl = $('plan-rate-note');
  rows.innerHTML = '';

  if (!snap || !snap.ok) {
    if (tierEl) tierEl.textContent = '';
    if (noteEl) {
      noteEl.textContent = snap && snap.reason === 'no_key'
        ? 'Enter a key to see your connects.'
        : 'Could not reach the server, so your connects cannot be shown right now.';
    }
    return;
  }

  const tier = rateTierFor(snap.tier);
  const unlimited = snap.unlimited === true || tier === 'VIP';
  if (tierEl) tierEl.textContent = unlimited ? tier + ' - unlimited' : tier + ' - ' + (snap.limit || rateLimitFor(tier)) + ' every 4 hours';

  for (const key of PLATFORM_KEYS) {
    const st = rateStateFromOk(snap, key);
    const row = document.createElement('div');
    row.className = 'plan-rate-row';

    const name = document.createElement('span');
    name.className = 'plan-rate-name';
    name.textContent = platformDisplayName(key);
    row.appendChild(name);

    const val = document.createElement('span');
    val.className = 'plan-rate-val';
    if (st.unlimited) {
      val.classList.add('none');
      val.textContent = 'Unlimited';
    } else if (!st.allowed) {
      val.classList.add('off');
      const w = rateShortWait(st.resetInMs);
      val.textContent = '0 left' + (w ? ' - back in ' + w : '');
    } else if (st.remaining <= 1) {
      val.classList.add('warn');
      val.textContent = st.remaining + ' of ' + st.limit + ' left';
    } else {
      val.textContent = st.remaining + ' of ' + st.limit + ' left';
    }
    row.appendChild(val);
    rows.appendChild(row);
  }

  if (noteEl) {
    noteEl.textContent = unlimited
      ? 'Unlimited on every platform. The window refreshes anyway, so the lights still show recent use.'
      : 'Each platform has its own allowance, and the window starts at your first connect.';
  }
}

function benefitsFor(plan, plats) {
  // What each plan DOES, as opposed to how much of it you are allowed.
  //
  // The allowance used to lead this list and now sits in the plan header, so the
  // card opened by saying "Unlimited connects" twice - once up top, again as the
  // first tick. Session counts follow PLAN_LIMITS: inactive 0, free 1, paid 3.
  if (plan === 'inactive') return ['Enter a code to unlock streaming'];
  if (plan === 'free') return ['1 saved session', 'Time-limited access', 'Upgrade to PRO any time'];
  if (plan === 'pro1') return ['3 saved sessions', 'Priority session pool', 'Swap a broken account instantly'];
  if (plan === 'vip') return ['3 saved sessions', 'Priority session pool', 'Re-enter and delete saved accounts', 'Swap a broken account instantly'];
  return ['3 saved sessions', 'Priority session pool', 'Re-enter and delete saved accounts', 'Swap a broken account instantly'];
  }

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
 * Makes sure the key this device is holding is actually registered on the
 * server, and quietly fixes it if it is not.
 *
 * Before the server took over activation, the browser tried to bind the key
 * itself and GitHub refused the write, so plenty of installs ended up with a
 * key stored locally that the server had never heard of. Every feature that
 * checks a key then answered "bad or expired key" and nothing worked, with no
 * obvious way out - the user was staring at a key they had definitely entered.
 *
 * Redeeming is idempotent for a key that is already yours, so this repairs those
 * installs on their own. The check is remembered for a few hours so opening the
 * popup does not hammer the endpoint.
 */
const KEY_CHECK_KEY = 'kizar_key_checked_at';
const KEY_CHECK_MS = 6 * 60 * 60 * 1000;

async function ensureKeyBound() {
  const p = await getProfile();
  const code = (p.activations && p.activations.access) || '';
  if (!code || !p.username) return { ok: true, skipped: true };

  try {
    const seen = await chrome.storage.local.get(KEY_CHECK_KEY);
    // The 6 hour cache is an optimisation, so it must never be the reason a
    // wrong tier is believed. Two cases skip it:
    //
    //   - no tier stored at all, so the plan card would be drawing a guess;
    //   - a key whose tier cannot be read off its prefix, which is exactly the
    //     operator's KIZAR444. Without this it kept showing the PRO card for
    //     hours after the server had answered VIP, every time.
    const guessed = !p.tier || !knownTierOfCode(code);
    if (!guessed && Date.now() - (Number(seen[KEY_CHECK_KEY]) || 0) < KEY_CHECK_MS) {
      return { ok: true, skipped: true };
    }
  } catch (e) { /* carry on */ }

  try {
    const res = await fetch(CONTROL_ROOM + '/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'redeem', code, username: p.username, ip: p.ip || '' })
    });
    const j = await res.json().catch(() => ({}));

    if (res.ok && j && j.ok) {
      await chrome.storage.local.set({ [KEY_CHECK_KEY]: Date.now() });
      // keep the plan honest if the server upgraded it
      const tier = j.tier || '';
      if (tier && tier !== p.tier) {
        await setProfile(p.username, p.activations, p.memberSince, tier);
      }
      return { ok: true, tier, repaired: true };
    }

    const reason = String((j && j.error) || ('HTTP ' + res.status));
    // 429 just means we asked a moment ago, not that anything is wrong
    if (res.status === 429) return { ok: true, skipped: true };

    // The server will not accept this key. Forget it rather than leaving a dead
    // one in storage, so the popup asks for a working key instead of failing
    // every feature with a message nobody can act on.
    if (res.status === 404 || res.status === 409 || res.status === 410) {
      await setProfile(p.username, {}, p.memberSince, '');
      await chrome.storage.local.remove(KEY_CHECK_KEY);
      return {
        ok: false,
        reason: res.status === 410 ? 'expired' : (res.status === 409 ? 'stolen' : 'unknown'),
        detail: reason
      };
    }
    return { ok: true, skipped: true, detail: reason };
  } catch (e) {
    return { ok: true, skipped: true, offline: true };
  }
}

// ── Community ──────────────────────────────────────────────────────────────
// Who else is here, and how they rank.
//
// The points come from the SERVER and are the same numbers the Control Room
// leaderboard uses. That matters: two boards scoring people differently would be
// worse than either one, and a customer comparing them would conclude one of us
// is lying.
//
// The server sends a narrowed row on purpose - a name, points, rank, plan and a
// coarse activity band. It does not send IPs, exact session counts, streaks,
// first/last seen or who invited whom, so this screen cannot leak any of that
// even by accident.

// createElement's SECOND argument is an options object, not a className. Passing
// a string there is silently ignored, so every row came out unclassed: the name,
// plan and XP were in the DOM but carried no styling at all, which is why the
// board rendered a column of ranks and nothing else.
//
// This is the same trap the Control Room's el() helper fell into. mk() makes the
// mistake impossible to make by accident.
function mk(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = String(text);
  return n;
}

const COMM_KEY = 'kizar_community_v1';
const COMM_TTL_MS = 15 * 60 * 1000;
let commCache = null;
let commSort = 'best';

const COMM_BANDS = {
  heavy: { label: 'Heavy user', cls: 'heavy' },
  regular: { label: 'Regular', cls: 'regular' },
  light: { label: 'Light', cls: 'light' },
  new: { label: 'New', cls: 'new' }
};

async function fetchCommunity(force) {
  if (!force && commCache && Date.now() - commCache.at < COMM_TTL_MS) return commCache.data;
  const p = await getProfile().catch(() => null);
  const key = (p && p.activations && p.activations.access) || '';
  if (!key) return null;
  const res = await fetch(CONTROL_ROOM + '/api/ops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-kizar-key': key },
    body: JSON.stringify({ action: 'community' })
  });
  if (!res.ok) return null;
  const j = await res.json().catch(() => null);
  if (!j || !j.ok) return null;
  commCache = { at: Date.now(), data: j };
  return j;
}

function renderCommunityView() {
  const list = $('comm-list');
  if (!list) return;
  list.innerHTML = '';
  const note = $('comm-note');
  if (note) note.textContent = 'Loading the board...';

  fetchCommunity(false).then((data) => {
    list.innerHTML = '';
    if (!data) {
      const empty = document.createElement('li');
      empty.className = 'comm-empty';
      empty.textContent = 'Could not reach the server. Check your connection and try again.';
      list.appendChild(empty);
      if (note) note.textContent = '';
      return;
    }
    const people = $('comm-people');
    if (people) people.textContent = String(data.people || (data.rows || []).length);
    const sub = $('comm-sub');
    if (sub) {
      // One thin line instead of a legend and a sentence: how many are on the
      // board, how many came in today, and what the ordering means.
      const here = (data.rows || []).filter((r) => Number(r.today) > 0).length;
      sub.textContent = here + ' of ' + (data.people || 0) + ' in today · ranked by XP';
    }

    const rows = (data.rows || []).slice();
    // "Worst to best" and "best to worst" are both asked for over time, so it is a
    // toggle rather than a guess. Ranks shown are the real ones from the server,
    // NOT the position after re-sorting - otherwise "rank 1" would appear last.
    rows.sort((a, b) => commSort === 'best'
      ? (b.xp - a.xp)
      : (a.xp - b.xp));

    // The leader's points, for the progress bar. Without it the numbers sit there
    // as bare figures and there is nothing to compare yourself against, which is
    // the whole reason to open a leaderboard.
    const topXp = rows.reduce((m, r) => Math.max(m, Number(r.xp) || 0), 0);

    rows.forEach((r) => {
      const rank = r.rank != null ? Number(r.rank) : 0;
      const li = document.createElement('li');
      // A medal only means something when the list is showing the top. In
      // least-points order the same rows would be decorated upside down.
      const medal = commSort === 'best' && rank > 0 && rank <= 3 ? ' medal-' + rank : '';
      li.className = 'comm-row' + medal + (r.you ? ' me' : '');

      const pos = mk('span', 'comm-pos');
      pos.textContent = rank > 0 ? '#' + rank : '-';
      li.appendChild(pos);

      const main = mk('span', 'comm-main');
      const top = mk('span', 'comm-nameline');
      const who = mk('span', 'comm-who', r.name || 'Someone');
      top.appendChild(who);
      const tag = mk('span', 'comm-plan t-' + String(r.plan || '').toLowerCase(), r.plan || '');
      top.appendChild(tag);
      // A dot rather than a worded badge. Four worded badges in a row is how a
      // leaderboard turns into noise; one 5px dot says "active" and stays quiet.
      const band = mk('span', 'comm-dot ' + (COMM_BANDS[r.activity] || COMM_BANDS.new).cls);
      band.title = (COMM_BANDS[r.activity] || COMM_BANDS.new).label;
      top.appendChild(band);
      if (r.you) top.appendChild(mk('span', 'comm-you', 'you'));
      main.appendChild(top);

      // A hairline that fills toward the leader. It is the only decoration here,
      // and it carries the one comparison the bare XP number cannot.
      const bar = mk('span', 'comm-bar');
      const fill = mk('span', 'comm-fill');
      const pct = topXp > 0 ? Math.max(2, Math.min(100, ((Number(r.xp) || 0) / topXp) * 100)) : 2;
      fill.style.width = pct + '%';
      bar.appendChild(fill);
      main.appendChild(bar);
      li.appendChild(main);

      const right = mk('span', 'comm-right');
      // How many times they opened the extension TODAY. The single least
      // revealing activity number there is, and the one people look for.
      const todayN = Number(r.today) || 0;
      right.appendChild(mk('span', 'comm-today' + (todayN > 0 ? ' on' : ''),
        todayN > 0 ? todayN + ' today' : '—'));
      right.appendChild(mk('span', 'comm-xp', (r.xp != null ? r.xp : 0).toLocaleString()));
      right.appendChild(mk('span', 'comm-xpl', 'XP'));
      li.appendChild(right);

      list.appendChild(li);
    });

    if (!rows.length) {
      const empty = document.createElement('li');
      empty.className = 'comm-empty';
      empty.textContent = 'Nobody is on the board yet.';
      list.appendChild(empty);
    }
    if (note) {
      note.textContent = 'XP is earned by streaming and by inviting people who join. '
        + 'It never costs you anything to be on this list.';
    }
  }).catch(() => {
    list.innerHTML = '';
    const empty = document.createElement('li');
    empty.className = 'comm-empty';
    empty.textContent = 'Could not reach the server.';
    list.appendChild(empty);
  });
}

document.querySelectorAll('.comm-sortbtn').forEach((b) => {
  b.addEventListener('click', () => {
    commSort = b.dataset.sort || 'best';
    document.querySelectorAll('.comm-sortbtn').forEach((x) => x.classList.toggle('on', x === b));
    renderCommunityView();
  });
});

// ── Community sub-pages ──
//
// Four pages share the Community tab rather than taking four dock slots. The
// dock is already five wide and every label on it is a place, not a subject.
//
// Only the leaderboard needs the server, so only it is rendered on entry. The
// other three are local and are filled once, at first use.
const COMM_PAGE = { board: 'comm-page', store: 'store-page', updates: 'updates-page', contact: 'contact-page' };

// Prices are deliberately blank. A made-up price on a store page is worse than
// no price at all, because a customer will act on it.
const STORE_PRICES = {
  PREMIUM: '',
  PRO: '',
  PRO1: '',
  VIP: ''
};

const CHANGELOG = [
  {
    ver: '1.24.1',
    when: 'current',
    fixes: [
      'Prime is now verified from the account\'s own settings page instead of the video homepage, so a "Try Prime" banner can no longer get a working account deleted.',
      'Prime membership is read in all 13 Amazon locales, including Japanese, Korean, Chinese, Russian, Arabic and Turkish.',
      'A card "ending in 9247" is no longer mistaken for an expired membership.',
      'Dead, signed-out, expired and ad-only accounts are removed from the pool automatically on every platform, with no waiting period.',
      'A session that finds more than one dead account now reports all of them.',
      'Pausing a platform is shown on that platform\'s button instead of a banner across the top.',
      'Community now has four pages: leaderboard, store, updates and contact.'
    ]
  },
  {
    ver: '1.24.0',
    when: 'earlier',
    fixes: [
      'Dead-account removal is matched by exact cookie fingerprint and archived before the pool is rewritten.',
      'Community shows everyone, not just the top of the list, and counts who opened the app today.'
    ]
  }
];

function showCommPage(page) {
  const want = COMM_PAGE[page] ? page : 'board';
  document.querySelectorAll('#comm-tabs .comm-tab').forEach((t) => {
    t.classList.toggle('on', t.dataset.page === want);
  });
  document.querySelectorAll('#view-community .comm-page').forEach((p) => {
    p.classList.toggle('hidden', p.dataset.page !== want);
  });
  if (want === 'store') renderStorePage();
  if (want === 'updates') renderUpdatesPage();
}

function renderStorePage() {
  // Filled from STORE_PRICES. An empty price shows a dash rather than a guess.
  document.querySelectorAll('#store-list [data-price-for]').forEach((el) => {
    const v = STORE_PRICES[el.dataset.priceFor];
    el.textContent = v || '';
  });
  const n = document.querySelectorAll('#store-list .store-card').length;
  const c = $('store-count');
  if (c) c.textContent = n + ' plans';
}

function renderUpdatesPage() {
  const list = $('upd-list');
  if (!list) return;
  list.innerHTML = '';
  CHANGELOG.forEach((rel) => {
    const li = document.createElement('li');
    li.className = 'upd-item';

    const top = document.createElement('div');
    top.className = 'upd-top';
    const ver = document.createElement('span');
    ver.className = 'upd-ver';
    ver.textContent = rel.ver;
    const when = document.createElement('span');
    when.className = 'upd-when';
    when.textContent = rel.when;
    top.appendChild(ver);
    top.appendChild(when);
    li.appendChild(top);

    const ul = document.createElement('ul');
    ul.className = 'upd-list-changes';
    rel.fixes.forEach((f) => {
      const item = document.createElement('li');
      item.className = 'upd-change';
      item.textContent = f;
      ul.appendChild(item);
    });
    li.appendChild(ul);
    list.appendChild(li);
  });
  const c = $('upd-count');
  if (c) c.textContent = String(CHANGELOG.length);
}

document.querySelectorAll('#comm-tabs .comm-tab').forEach((t) => {
  t.addEventListener('click', () => showCommPage(t.dataset.page || 'board'));
});

async function renderPlanView() {
  const p = await getProfile();
  const isActive = isPaidPlan(p.plan);
  const meta = PLAN_META[p.plan] || PLAN_META.inactive;
  const plats = await resolvePlatforms();
  const items = benefitsFor(p.plan, plats);

  const mp = $('m-plan');
  if (mp) mp.textContent = meta.label;

  // Allowance and lifetime live in the header band now, instead of a sentence
  // under the name plus a separate KEY strip further down.
  const allow = $('m-allowance');
  if (allow) allow.textContent = planAllowanceFor(p.plan);

  const flag = $('m-flag');
  if (flag) flag.textContent = meta.flag;

  const lifetime = $('m-lifetime');
  if (lifetime) {
    const acts = p.activations || {};
    const code = acts.access || '';
    let left = '';
    let expiresAt = '';
    if (code) {
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
    }
    lifetime.textContent = code ? (left || 'active') : 'no key';
    lifetime.classList.toggle('warn', !!expiresAt && left && left !== 'never expires');
    lifetime.classList.toggle('hidden', !code);
  }

  const card = $('member-card');
  if (card) {
    card.classList.remove('active', 'inactive', 'free');
    card.classList.add(isPaidPlan(p.plan) ? 'active' : p.plan === 'free' ? 'free' : 'inactive');
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

  // Which platforms the key unlocks: netflix-only, prime-only, or both.
  const platBox = $('m-platforms');
  if (platBox) {
    platBox.innerHTML = '';
    if (plats.length) {
      platBox.classList.remove('hidden');
      plats.forEach((s) => {
        const chip = document.createElement('span');
        chip.className = 'plat-chip ' + s;
        chip.textContent = platformDisplayName(s);
        platBox.appendChild(chip);
      });
    } else {
      platBox.classList.add('hidden');
    }
  }



  // Keys the operator sent that have not been claimed yet.
  try { await renderWaitingKeys(); } catch (e) {}
}

async function finishSignup(uname, activations, tier) {
  await setProfile(uname, activations || {}, new Date().toISOString(), tier || '');
  await refresh();
  showView('home');
  await syncPlanViews();
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
    const res = await activateCode(raw, uname);
    if (!res.ok) {
      fail(activationMessage(res.reason, res.detail));
      return;
    }
    $('wel-code').value = '';
    await finishSignup(uname, { access: res.code || normalizeCode(raw) }, res.tier);
    const left = res.expiresAt ? timeLeftLabel(res.expiresAt) : '';
    toast(
      (res.tier === 'PRO' ? 'PRO active' : 'PREMIUM active')
      + (left && left !== 'expired' ? ' · ' + left : ''),
      4000
    );
  } finally {
    if (btn) btn.disabled = false;
  }
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
      noname: ['Enter your name first', false],
      offline: ['Network error' + (res.detail ? ' (' + res.detail + ')' : ''), false],
      write_failed: ['Failed to save', false]
    };
    if (res.ok) {
      $('code-input').value = '';
      const tier = res.tier || 'PREMIUM';
      // This read the plan as PRO or nothing, so a VIP key announced itself as
      // "PREMIUM activated" the moment it was accepted.
      const said = { vip: 'VIP', pro1: 'PRO1', active: 'PRO', free: 'PREMIUM' }[res.plan] || tier;
      const left = res.expiresAt ? timeLeftLabel(res.expiresAt) : '';
      setCodeStatus(
        said + ' activated' + (left && left !== 'expired' ? ' - ' + left : ''),
        true
      );
      await syncPlanViews();
      await updateCounts();
      await refresh();
      toast(said + ' unlocked');
    } else {
      const msg = msgs[res.reason] || ['Could not activate', false];
      setCodeStatus(msg[0], msg[1]);
      toast(msg[0]);
      // A reset clears the name, so activating without one is the normal next
      // step rather than a mistake. Send them where the field actually is.
      if (res.reason === 'noname') {
        const wel = $('wel-username');
        showView('welcome');
        document.body.classList.add('onboarding');
        setTimeout(() => { if (wel) { wel.value = ''; try { wel.focus(); } catch (e) {} } }, 60);
      }
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
let usageDeltas = { opens: 0, netflixSessions: 0, primeSessions: 0, crunchyrollSessions: 0 };
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
  // The operational files are created and maintained by the Control Room, which
  // is the only component that writes the repository now. There is nothing for
  // the extension to build here anymore, so this is just a reachability probe.
  const p = await getProfile();
  if (!(p.activations && p.activations.access)) return;
  await Promise.all(
    [GITHUB_CONFIG.users, GITHUB_CONFIG.banned, GITHUB_CONFIG.dead, GITHUB_CONFIG.requests]
      .map((f) => fetchFromGithub(f).then(() => true).catch(() => false))
  );
}

async function putGithubJson(path, content, sha) {
  // Conflicts are handed back to the caller (mergeUserRow re-reads and re-merges
  // them), so only transient network blips are retried here.
  let lastErr = 'offline';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(400 * attempt);
    try {
      const j = await ghProxyCall({ op: 'write', file: path, content: String(content || ''), sha: String(sha || '') });
      return { sha: j.sha || '' };
    } catch (e) {
      const reason = proxyErrorReason(e);
      if (reason === 'notfound' || reason === 'auth' || reason === 'conflict') throw e;
      lastErr = reason;
    }
  }
  throw new Error(lastErr);
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
    // Keep everything the row already carried, then overwrite only what this
    // function owns.
//
// It used to build a fresh object from scratch. Every field it did not name -
    // the operator's platform scope, the worker tag, a disable flag - was erased
    // the next time the customer streamed, silently and irreversibly. Anything
    // another system wrote to this row is preserved by spreading prev first.
    const todayStr = new Date().toISOString().slice(0, 10);
    const carriedToday = prev.openedOn === todayStr ? (Number(prev.opensToday) || 0) : 0;
    const row = Object.assign({}, prev, {
      username: delta.username,
      ip: delta.ip || prev.ip || '',
      device: prev.device || '',
      plan: delta.plan || prev.plan || 'PREMIUM',
      opens: (Number(prev.opens) || 0) + (Number(delta.opens) || 0),
      netflixSessions: (Number(prev.netflixSessions) || 0) + (Number(delta.netflixSessions) || 0),
      primeSessions: (Number(prev.primeSessions) || 0) + (Number(delta.primeSessions) || 0),
      crunchyrollSessions: (Number(prev.crunchyrollSessions) || 0) + (Number(delta.crunchyrollSessions) || 0),
      // Opens for TODAY. Carried from the previous row and reset when the day
      // changes, so the Community board can say who actually turned up. Without
      // this the count read 0 for everyone, forever.
      openedOn: todayStr,
      opensToday: carriedToday + (Number(delta.opensToday != null ? delta.opensToday : delta.opens) || 0),
      firstSeen: prev.firstSeen || now,
      lastSeen: now
    });
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

let serviceState = { cookiesEnabled: true, message: '', platforms: {} };

// Is THIS platform in maintenance?
//
// The switch used to be one boolean for all three, so putting Netflix into
// maintenance meant Prime and Crunchyroll stopped too. Absent platform keys mean
// "live": an old settings file with no platforms field must not pause anything.
function platformMaintenance(key) {
  const p = serviceState && serviceState.platforms && serviceState.platforms[key];
  if (!p || p.enabled === undefined || p.enabled === null) return null;
  if (p.enabled) return null;
  return { message: String(p.message || '').trim() };
}

function isPlatformBlocked(key) {
  if (isStreamingBlocked()) return true;
  return platformMaintenance(key) !== null;
}
let userDisabled = false;

async function loadServiceFlags() {
  const p = await getProfile();
  let svc = { cookiesEnabled: true, message: '', platforms: {} };
  try {
    const raw = await fetchFromGithub(GITHUB_CONFIG.settings);
    const j = JSON.parse(raw || '{}') || {};
    const s = j.service || {};
    // Absent platform keys mean LIVE, not paused - otherwise reading an older
    // settings file would silently stop all three platforms for every customer.
    const plats = {};
    for (const k of ['netflix', 'prime', 'crunchyroll']) {
      const v = (s.platforms && s.platforms[k]) || {};
      plats[k] = { enabled: v.enabled === undefined ? true : !!v.enabled, message: typeof v.message === 'string' ? v.message : '' };
    }
    svc = {
      cookiesEnabled: s.cookiesEnabled === undefined ? true : !!s.cookiesEnabled,
      message: typeof s.message === 'string' ? s.message : '',
      platforms: plats
    };
    // The auto-filtering switch rides in settings.json next to the service
    // flags, so it arrives on the same read. Enables only when the field is
    // explicitly true-or-absent-with-default; anything else stays ON (the
    // default) - only an explicit false turns it off.
    const af = (j && j.autoFilter) || {};
    autoFilter.enabled = af.enabled !== false;
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
    // A platform being paused is stated ONCE, on that platform's own button.
    //
    // It used to raise the full-screen notice as well, so pausing Crunchyroll
    // printed "Crunchyroll are down for maintenance. The other platforms still
    // work" across the top of a Stream tab where both other buttons were plainly
    // working and already labelled "maintenance". The banner told the customer
    // something their own screen contradicted, and buried the buttons it was
    // talking about. The notice is now reserved for "nothing works".
    const down = PLATFORM_KEYS.filter((k) => platformMaintenance(k));
    const partial = !off && !userDisabled && !STATE.tampered && down.length > 0;
    if (partial) {
      box.classList.add('hidden');
    } else if (off || userDisabled || STATE.tampered) {
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
    for (const key of PLATFORM_KEYS) {
      const b = $('btn-stream-' + key);
      if (b) b.disabled = true;
    }
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
  const cfg = await readVersionFeed();
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
// Checked on every gate load, but it only ever opens for a genuinely newer
// build - never for a held-back one, which the version box above already
// reports on its own.
checkForUpdate().catch(() => {});
  renderAnnouncement();
  return versionState;
}

// The update centre.
//
// What Chrome allows, plainly: an extension cannot install its own code. MV3
// blocks remote scripts (the CSP above is script-src 'self'), there is no API to
// write into the extension's own folder, and chrome.downloads can only put a file
// somewhere on disk - it cannot make the browser load it. So the most this can do
// is notice a newer build, fetch it, and reload once the files are in place.
//
// If the extension is ever published on the Chrome Web Store, Chrome updates it
// on its own and sw.js applies the update with no user step at all. That is the
// only genuinely zero-touch route, and it needs nothing from this file.
const UPDATE_STATE_KEY = 'kizar_update_state';

// The gate and the update check want the same document. Fetching it twice meant
// two identical round trips on every popup open, so the result is kept briefly
// and the second caller reuses it.
let versionFeedCache = { cfg: null, at: 0 };
const VERSION_FEED_TTL_MS = 60000;

async function readVersionFeed() {
  const now = Date.now();
  if (versionFeedCache.cfg && now - versionFeedCache.at < VERSION_FEED_TTL_MS) {
    return versionFeedCache.cfg;
  }
  let cfg = {};
  try {
    const res = await fetch(CONTROL_ROOM + '/api/ops?action=version');
    if (res.ok) {
      const j = await res.json();
      cfg = (j && j.version) || {};
    }
  } catch (e) {
    // Keep whatever we last managed to read rather than blanking the gate.
    return versionFeedCache.cfg || {};
  }
  versionFeedCache = { cfg, at: now };
  return cfg;
}

async function checkForUpdate() {
  const cfg = await readVersionFeed();

  const latest = String(cfg.latest || '').trim();
  const notes = String(cfg.notes || '').trim();
  const min = String(cfg.minVersion || '0.0.0');
  const url = String(cfg.url || '').trim();
  // No fallback to /api/download on purpose. That endpoint needs the panel key
  // as a header, which chrome.downloads cannot send, so pointing an update at it
  // guaranteed a failed transfer. With no url configured, the service worker
  // fetches the build through the authenticated proxy instead, which works.
  const known = /^\d+(\.\d+){0,3}$/.test(latest);
  // The operator can stage a build without offering it. `popup: false` keeps the
  // row hidden for everyone while leaving the lockout gate working.
  const popupOn = cfg.popup !== false;
  // Strictly a real update: the published build has to be genuinely newer than
  // the one running. Anything else - equal, older, blank or nonsense - leaves
  // the row hidden, so nobody is shown an "update" that is not one.
  const outdated = popupOn && known && cmpVersion(APP_VERSION, latest) < 0;
  const held = /^\d+(\.\d+){0,3}$/.test(min) && cmpVersion(APP_VERSION, min) < 0;

  const box = $('update-box');
  const text = $('update-text');
  const noteEl = $('update-notes');
  if (box && text) {
    if (outdated) {
      box.classList.remove('hidden');
      text.textContent = 'Update ' + APP_VERSION + ' to ' + latest;
      if (noteEl) noteEl.textContent = notes || '';
      const dl = $('btn-update-download');
      if (dl) dl.classList.remove('hidden');
    } else {
      box.classList.add('hidden');
    }
  }

  // The banner reads the same state and must not duplicate the update row's notes.
  renderAnnouncement();
  return { outdated, held, latest, notes, url };
}
// Fetches the new build and hands it to the browser's downloader.
//
// A plain https URL and nothing else. Two earlier shapes were dead ends: a blob
// URL made in the popup dies with the popup and Chrome cancels the transfer as
// "interrupted", and moving the blob into the service worker fails outright
// because URL.createObjectURL does not exist in a worker. The server mints a
// signed link for the release, which is an ordinary GET that Chrome fetches
// natively - no blob, no lifetime to keep alive, nothing running in the popup.
async function downloadUpdate(info) {
  const status = $('update-status');
  const btn = $('btn-update-download');
  const setStatus = (t) => { if (status) status.textContent = t; };
  const url = String((info && info.url) || '').trim();

  if (!url) {
    setStatus('no download link was published for this release');
    return;
  }

  const bar = $('update-bar');
  const fill = $('update-fill');
  const pct = $('update-pct');
  const showBar = (p) => {
    if (!bar || !fill || !pct) return;
    bar.classList.remove('hidden');
    fill.style.width = Math.max(0, Math.min(100, p)) + '%';
    pct.textContent = Math.round(p) + '%';
  };
  const hideBar = () => { if (bar) bar.classList.add('hidden'); };

  // Real progress, straight from the download engine.
  let watching = true;
  const watch = (id) => {
    const onChanged = async (delta) => {
      if (!watching || delta.id !== id) return;
      const found = await chrome.downloads.search({ id });
      const item = found && found[0];
      if (!item) return;
      if (item.state === 'complete') {
        showBar(100);
        if (bar) bar.classList.add('done');
        watching = false;
        chrome.downloads.onChanged.removeListener(onChanged);
        return;
      }
      if (item.state === 'interrupted') {
        watching = false;
        chrome.downloads.onChanged.removeListener(onChanged);
        hideBar();
      }
      const total = item.totalBytes || item.bytesTotal || 0;
      if (total) showBar((item.bytesReceived / total) * 100);
    };
    chrome.downloads.onChanged.addListener(onChanged);
  };

  try {
    setStatus('downloading...');
    if (btn) btn.disabled = true;
    showBar(0);
    const id = await chrome.downloads.download({
      url,
      filename: 'KIZAR Stream Update ' + String(info.latest || '').trim() + '.zip',
      conflictAction: 'uniquify',
      saveAs: false
    });
    watch(id);
    const done = await waitForDownload(id);
    watching = false;
    if (!done.ok) { hideBar(); throw new Error(done.error || 'the transfer did not finish'); }
    finishDownload(setStatus, done, showBar, hideBar);
  } catch (e) {
    hideBar();
    setStatus('failed: ' + ((e && e.message) || e));
    toast('Update failed: ' + ((e && e.message) || e), 4000);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function waitForDownload(id) {
  return new Promise((resolve) => {
    let tries = 0;
    const tick = async () => {
      const found = await chrome.downloads.search({ id });
      const item = found && found[0];
      if (item && item.state && item.state !== 'in_progress') {
        resolve({
          ok: item.state === 'complete',
          path: item.filename || '',
          error: item.state === 'complete' ? '' : ('transfer ' + item.state)
        });
        return;
      }
      if (++tries > 240) { resolve({ ok: false, error: 'the transfer timed out' }); return; }
      setTimeout(tick, 250);
    };
    tick();
  });
}

function finishDownload(setStatus, done, showBar, hideBar) {
  setStatus('Extract it over your extension folder, then press Reload');
  const path = String((done && done.path) || '').trim();
  const row = $('update-where');
  const acts = $('update-where-acts');
  const code = $('update-path');
  if (row && code && path) {
    code.textContent = path;
    code.title = path;
    row.classList.remove('hidden');
    if (acts) acts.classList.remove('hidden');
    const copy = $('btn-update-copy');
    const show = $('btn-update-show');
    if (copy) {
      copy.onclick = async () => {
        try { await navigator.clipboard.writeText(path); toast('Path copied', 2200); }
        catch (e) { toast('Copy failed - select the path instead', 3000); }
      };
    }
    if (show) show.onclick = () => { try { chrome.downloads.show(done.id); } catch (e) { toast('Could not open the folder', 2500); } };
  }
  const rl = $('btn-update-reload');
  if (rl) rl.classList.remove('hidden');
}
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
      // The operator can override the season, so the theme has to be re-evaluated
      // every time fresh config lands - not only on load and on the minute.
      if (typeof applyHalloween === 'function') applyHalloween();
      renderAnnouncement();
  } catch (e) {}
}

// The banner is gated on this build being OUTDATED, so it disappears on its own
// the moment someone updates. It used to be one global string shown to everyone,
// which meant the operator had to remember to clear it - and until they did,
// every up-to-date user kept being told to download a version they already had.
// Two different things now share the strip:
//
//   version.notes             release notes, shown only while this build is behind
//   remote-config.announcement a real service notice, shown to everyone
//
// A stale banner is worse than none, so release text is never stored globally.
function renderAnnouncement() {
  const box = $('announce-box');
  if (!box) return;
  const notice = String(remoteConfig.announcement || '').trim();
  const v = versionState || {};
  const published = String(v.latest || '');
  const behind = !!published && cmpVersion(APP_VERSION, published) < 0;
  const release = behind ? String(v.notes || '').trim() : '';

  // No double text: if the update row is already on screen it carries the same
  // notes with a button attached, so the strip stays out of the way.
  const text = release && !isUpdateRowVisible() ? release : notice;
  if (!text) {
    box.classList.add('hidden');
    box.textContent = '';
    return;
  }
  box.textContent = text;
  box.classList.remove('hidden');
}

function isUpdateRowVisible() {
  const b = $('update-box');
  return !!(b && !b.classList.contains('hidden'));
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

// Update centre actions.
$('btn-update-download').addEventListener('click', async () => {
  const info = await checkForUpdate();
  downloadUpdate(info);
});
$('btn-update-reload').addEventListener('click', () => {
  // Re-reads the extension from disk. For an unpacked install that means the new
  // files must already be in place - this button cannot move them there itself,
  // because an extension has no write access to its own folder.
  chrome.runtime.reload();
});

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
      plan: PLAN_LABEL[p.plan] || 'PREMIUM',
      opens: 1,
      netflixSessions: 0,
      primeSessions: 0,
      crunchyrollSessions: 0
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
  usageDeltas = { opens: 0, netflixSessions: 0, primeSessions: 0, crunchyrollSessions: 0 };
  try {
    const ip = await detectIp();
    const ok = await mergeUserRow({
      username: p.username,
      ip: ip || '',
      plan: PLAN_LABEL[p.plan] || 'PREMIUM',
      opens: deltas.opens || 0,
      netflixSessions: deltas.netflixSessions || 0,
      primeSessions: deltas.primeSessions || 0,
      crunchyrollSessions: deltas.crunchyrollSessions || 0
    });
    if (ok) lastUsageWrite = Date.now();
  } catch (e) {
    usageDeltas.opens += deltas.opens || 0;
    usageDeltas.netflixSessions += deltas.netflixSessions || 0;
    usageDeltas.primeSessions += deltas.primeSessions || 0;
    usageDeltas.crunchyrollSessions += deltas.crunchyrollSessions || 0;
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
  // How many of the released keys had unused Telegram time on them. The server
  // records a sign-out for each one, and the bot answers there with the
  // replacement or the warning — it cannot reach the user any other way, so the
  // toast below has to say where the message went.
  let logoutOffered = 0;
  if (accessKey && p.username) {
    try {
      const res = await fetch(CONTROL_ROOM + '/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-kizar-key': accessKey },
        body: JSON.stringify({ action: 'release', username: p.username, key: accessKey })
      });
      released = res.ok;
      try {
        const data = await res.json();
        if (data && Number(data.logoutOffered) > 0) logoutOffered = Number(data.logoutOffered);
      } catch (e) { /* a non-JSON answer still means the release itself worked */ }
    } catch (e) { released = false; }
  }

  await clearBanned();
  await clearSavedSessions();
  await chrome.storage.local.remove(PROFILE_KEY);
  try { await chrome.storage.local.remove(AVATAR_STORAGE_KEY); } catch (e) {}
  try { await chrome.storage.session.remove(PENDING_KEY); } catch (e) {}
  STATE.codes = null;
  STATE.codesReady = false;
  STATE.sessions = { netflix: [], prime: [], crunchyroll: [] };
  STATE.streaming = false;
  toast(!released
    ? 'Reset done - the server could not be reached, ask the operator to remove it'
    : (logoutOffered > 0
      ? 'Account deleted - open Telegram, the bot has a message about your unused time'
      : 'Account deleted - your name is free again'), 4000);
  await refresh();
  showView('welcome');
  document.body.classList.add('onboarding');
  try { $('wel-username').focus(); } catch (e) {}
});

// Seasonal theme. Runs at startup; the date gate and the operator override both
// feed it, and it re-applies whenever fresh remote config lands.
watchHalloween();
// The lights are an affordance, so they need wiring once at startup - and they
// can only be wired here, not inside updateCounts, which runs on every count
// change and would pile up a new listener each time.
wireRateHelp();
$('btn-stream-netflix').addEventListener('click', () => tryStream('netflix'));
$('btn-stream-prime').addEventListener('click', () => tryStream('prime'));
$('btn-stream-crunchyroll').addEventListener('click', () => tryStream('crunchyroll'));

$('btn-welcome').addEventListener('click', saveWelcome);
$('btn-activate').addEventListener('click', handleActivate);

document.querySelectorAll('.nav-btn').forEach((b) => {
  b.addEventListener('click', () => {
    showView(b.dataset.view);
    if (b.dataset.view === 'sessions') renderSavedChips();
    if (b.dataset.view === 'profile') { renderProfileView(); loadLoyalty(); }
    if (b.dataset.view === 'plan') renderPlanView();
    if (b.dataset.view === 'community') renderCommunityView();
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
  // Repair the key binding first: swap and the sessions both authenticate
  // with it, so nothing else works until this passes.
  const bound = await ensureKeyBound().catch(() => ({ ok: true }));
  if (bound && bound.ok === false) {
    keyState = {
      expired: true,
      reason: bound.reason === 'stolen' ? 'removed' : 'expired',
      at: keyState.at || new Date().toISOString()
    };
    // A key that is not theirs (or not valid at all) unlocks nothing: wipe
    // before the message, same as a natural expiry.
    wipeExpiredAccess().catch(() => {});
    renderKeyBlock();
    toast(bound.reason === 'stolen'
      ? 'That key belongs to another account. Enter your own key.'
: 'That key is no longer valid. Enter a working key.', 4500);
  }
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

  // ── Interrupted search recovery ──────────────────────────────────────────
  //
  // This used to silently re-run the ENTIRE account search on popup open:
  //
  //   3719:  await tryStream(key);        // full hunt, no UI, steals focus
  //   3715:  await chrome.tabs.remove(tab.id);   // closes the user's tab
  //
  // The trigger was the user clicking away from the popup mid-search, which
  // Chrome treats as "destroy the document" - the await chain stopped, PENDING
  // was left behind, and reopening the popup ran a brand new search with no
  // indication anything was happening. The visible result was the user being
  // dropped into an account they never picked, from a closed tab, with no
  // warning. That was the reported bug.
  //
  // Now: an interrupted search is announced, not sprung. The overlay comes up
  // first, and only a genuine login-screen failure still resumes the search -
  // visibly, with the account that failed named.
  const pending = await getPending();
  const waitSt = await getWaitState();
  if (pending && PLATFORMS[pending.platformKey]) {
    try { await chrome.storage.session.remove(PENDING_KEY); } catch (e) {}
    const plat = PLATFORMS[pending.platformKey];
    const key = pending.platformKey;
    let tab = null;
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      tab = tabs && tabs[0] ? tabs[0] : null;
    } catch (e) {}

    const onPlatform = tab && /netflix|primevideo|amazon|crunchyroll/.test(tab.url || '');
    if (tab && (urlIsFailure(plat, tab.url || '') || await probeTabFailure(plat, tab.id))) {
      // The account we were testing when the popup died is genuinely broken.
      const banned = await loadBanned();
      if (!banned[key].includes(pending.fingerprint)) banned[key].push(pending.fingerprint);
      await chrome.storage.local.set({ [BANNED_KEY]: banned });
      await removeSaved(key, pending.fingerprint);
      await updateCounts();
      try { await chrome.tabs.remove(tab.id); } catch (e) {}
      await clearDomainCookies(plat);

      const name = platformDisplayName(key);
      showStreamWait(true, {
        key, index: 0, total: 0, pct: 6,
        title: 'Finding an account',
        sub: platformDisplayName(key),
        step: 'resuming after an interrupted search'
      });
      pill('err', 'Blocked');
      toast('That account did not work — finding another', 2600);
      // Yield one frame so the overlay is painted before the search begins.
      await sleep(80);
      await tryStream(key);
    } else if (onPlatform) {
      // The search actually finished before the popup closed. Do not search
      // again, and do not touch the tab: the user is already signed in.
      clearWaitState();
      showStreamWait(false);
      pill('ok', platformDisplayName(key) + ' Active');
    } else if (waitSt && waitSt.key === key) {
      // Interrupted, but no login screen: the popup was just closed early.
      // Show the fact and let them start again rather than doing it for them.
      showStreamWait(false);
      clearWaitState();
      pill('err', 'Search stopped');
      toast('Your search was stopped. Press Stream to try again.', 3400);
    }
  }
}

