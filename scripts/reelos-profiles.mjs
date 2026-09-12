/**
 * Household profiles v1 + local curator (like/dislike) + optional free Trakt.
 *
 * Google TV has no supported taste API — copy only, never Sign in with Google,
 * never scrape Google. Local thumbs work with Trakt disconnected. Votes and
 * continue-watching are per profile so two people on one box do not share
 * downvotes. Kids: hide adult + lock Request/Settings. Existing admin stays.
 * A single admin profile does not show a picker.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const PROFILE_COOKIE = "reelos_profile";
export const PROFILE_HEADER = "x-reelos-profile";

export const GOOGLE_TV_COPY =
  "Google TV has no supported taste or watch-history API. ReelOS will not Sign in with Google and will not scrape Google. Use thumbs on Discover, or optional free Trakt.";

export const TRAKT_FREE_COPY =
  "Trakt is free. VIP is optional paid extras we do not need. Local like/dislike works with Trakt disconnected. Connect only if you want ratings synced.";

export const KIDS_PARENTAL = Object.freeze({
  hideAdult: true,
  lockRequest: true,
  lockSettings: true,
});

export const ADULT_PARENTAL = Object.freeze({
  hideAdult: false,
  lockRequest: false,
  lockSettings: false,
});

const ADULT_GENRE = /\b(adult|erotica|erotic|nc-17|porn)\b/i;
const ADULT_CERT = /^(nc-17|r|tv-ma|18|18\+|x)$/i;

export function emptyCurator() {
  return {
    votes: {},
    continueWatching: {},
    trakt: { connected: false, username: "", accessToken: "", refreshToken: "", pending: null },
  };
}

export function defaultHouse({ adminName = "Admin" } = {}) {
  const name = String(adminName || "Admin").trim() || "Admin";
  return {
    version: 1,
    activeId: "p-admin",
    profiles: [
      {
        id: "p-admin",
        name,
        role: "admin",
        kind: "adult",
        parental: { ...ADULT_PARENTAL },
      },
    ],
  };
}

export function needsProfilePicker(house) {
  return (house?.profiles || []).length > 1;
}

export function publicProfile(p) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    role: p.role,
    kind: p.kind === "kids" ? "kids" : "adult",
    parental: {
      hideAdult: Boolean(p.parental?.hideAdult),
      lockRequest: Boolean(p.parental?.lockRequest),
      lockSettings: Boolean(p.parental?.lockSettings),
    },
  };
}

export function publicTrakt(curator) {
  const t = curator?.trakt || {};
  return {
    connected: Boolean(t.connected && t.accessToken),
    username: t.username || "",
    pending: t.pending
      ? {
          userCode: t.pending.userCode,
          verificationUrl: t.pending.verificationUrl,
          expiresAt: t.pending.expiresAt,
        }
      : null,
  };
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

export function profileIdFromRequest(req) {
  const headers = req?.headers || {};
  const named = headers[PROFILE_HEADER] || headers["X-ReelOS-Profile"];
  if (named) return String(named).trim();
  const cookies = parseCookies(headers.cookie || headers.Cookie);
  return String(cookies[PROFILE_COOKIE] || "").trim();
}

export function profileCookieHeader(id) {
  return `${PROFILE_COOKIE}=${encodeURIComponent(id)}; Path=/; SameSite=Lax; Max-Age=31536000`;
}

export function titleKeys(title) {
  const keys = [];
  const id = title?.id || title;
  if (typeof id === "string" && id) keys.push(id);
  for (const extra of title?.ids || []) {
    if (extra) keys.push(String(extra));
  }
  return [...new Set(keys)];
}

export function isAdultTitle(title) {
  if (!title) return false;
  if (title.adult === true) return true;
  const cert = String(title.certification || title.ratingLabel || "").trim();
  if (cert && ADULT_CERT.test(cert)) return true;
  const genres = Array.isArray(title.genres) ? title.genres.join(" ") : String(title.genres || "");
  if (ADULT_GENRE.test(genres)) return true;
  return false;
}

export function voteOnTitle(curator, titleId, vote) {
  const id = String(titleId || "").trim();
  if (!id) return curator;
  const next = { ...(curator || emptyCurator()), votes: { ...(curator?.votes || {}) } };
  const want = vote === "up" || vote === "down" ? vote : null;
  if (!want || next.votes[id] === want) delete next.votes[id];
  else next.votes[id] = want;
  return next;
}

export function voteForKeys(curator, title) {
  const votes = curator?.votes || {};
  for (const key of titleKeys(title)) {
    if (votes[key] === "up" || votes[key] === "down") return votes[key];
  }
  return null;
}

export function filterDiscoverForProfile(titles, { curator, profile } = {}) {
  const hideAdult = Boolean(profile?.parental?.hideAdult);
  const votes = curator?.votes || {};
  const down = new Set(Object.entries(votes).filter(([, v]) => v === "down").map(([id]) => id));
  return (titles || []).filter((t) => {
    if (hideAdult && isAdultTitle(t)) return false;
    if (titleKeys(t).some((k) => down.has(k))) return false;
    return true;
  });
}

export function filterLibraryForProfile(titles, { profile } = {}) {
  if (!profile?.parental?.hideAdult) return titles || [];
  return (titles || []).filter((t) => !isAdultTitle(t));
}

export function kidsLocks(profile) {
  return {
    lockRequest: Boolean(profile?.parental?.lockRequest),
    lockSettings: Boolean(profile?.parental?.lockSettings),
    hideAdult: Boolean(profile?.parental?.hideAdult),
  };
}

export function continueEntries(curator) {
  const rows = [];
  for (const [titleId, v] of Object.entries(curator?.continueWatching || {})) {
    const n = Number(v);
    if (n > 0.03 && n < 0.96) rows.push({ titleId, progress: n });
  }
  return rows;
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
}

function slugId(prefix, name) {
  const s = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 18);
  return `${prefix}-${s || Math.random().toString(36).slice(2, 8)}`;
}

export function createProfileStore({ dir, now = () => Date.now(), fetchImpl } = {}) {
  const root = dir || "/var/lib/reelos";
  const housePath = join(root, "profiles.json");
  const curatorDir = join(root, "curator");
  const traktAppPath = join(root, "trakt-app.json");
  const answersPath = join(root, "answers.json");
  const fetchFn = fetchImpl || globalThis.fetch;

  function adminNameFromAnswers() {
    const a = readJson(answersPath, {});
    return String(a.adminName || a.admin_name || "").trim() || "Admin";
  }

  function readHouse() {
    const raw = readJson(housePath, null);
    if (raw?.profiles?.length) {
      return {
        version: 1,
        activeId: raw.activeId || raw.profiles[0].id,
        profiles: raw.profiles.map((p) => ({
          id: p.id,
          name: String(p.name || "Person").trim() || "Person",
          role: p.role === "admin" ? "admin" : "member",
          kind: p.kind === "kids" ? "kids" : "adult",
          parental: {
            ...(p.kind === "kids" ? KIDS_PARENTAL : ADULT_PARENTAL),
            ...(p.parental || {}),
          },
        })),
      };
    }
    const house = defaultHouse({ adminName: adminNameFromAnswers() });
    writeJson(housePath, house);
    return house;
  }

  function writeHouse(house) {
    writeJson(housePath, house);
    return house;
  }

  function curatorPath(profileId) {
    return join(curatorDir, `${profileId}.json`);
  }

  function readCurator(profileId) {
    const raw = readJson(curatorPath(profileId), null);
    if (!raw || typeof raw !== "object") return emptyCurator();
    return {
      votes: raw.votes && typeof raw.votes === "object" ? { ...raw.votes } : {},
      continueWatching:
        raw.continueWatching && typeof raw.continueWatching === "object" ? { ...raw.continueWatching } : {},
      trakt: {
        connected: Boolean(raw.trakt?.connected && raw.trakt?.accessToken),
        username: raw.trakt?.username || "",
        accessToken: raw.trakt?.accessToken || "",
        refreshToken: raw.trakt?.refreshToken || "",
        pending: raw.trakt?.pending || null,
      },
    };
  }

  function writeCurator(profileId, curator) {
    writeJson(curatorPath(profileId), curator);
    return curator;
  }

  function findProfile(house, id) {
    return (house.profiles || []).find((p) => p.id === id) || null;
  }

  function resolveProfile(req) {
    const house = readHouse();
    const wanted = profileIdFromRequest(req);
    const hit = findProfile(house, wanted) || findProfile(house, house.activeId) || house.profiles[0];
    return { house, profile: hit };
  }

  function addProfile({ name, kind = "adult" }) {
    const house = readHouse();
    const n = String(name || "").trim();
    if (!n) return { ok: false, error: "Name required" };
    const kids = kind === "kids";
    const id = slugId(kids ? "p-kids" : "p", n);
    if (findProfile(house, id)) return { ok: false, error: "That profile already exists" };
    house.profiles.push({
      id,
      name: n,
      role: "member",
      kind: kids ? "kids" : "adult",
      parental: { ...(kids ? KIDS_PARENTAL : ADULT_PARENTAL) },
    });
    writeHouse(house);
    writeCurator(id, emptyCurator());
    return { ok: true, house, profile: findProfile(house, id) };
  }

  function removeProfile(id) {
    const house = readHouse();
    const p = findProfile(house, id);
    if (!p) return { ok: false, error: "No such profile" };
    if (p.role === "admin") return { ok: false, error: "Cannot remove the household admin" };
    house.profiles = house.profiles.filter((x) => x.id !== id);
    if (house.activeId === id) house.activeId = house.profiles[0]?.id || "p-admin";
    writeHouse(house);
    return { ok: true, house };
  }

  function selectProfile(id) {
    const house = readHouse();
    const p = findProfile(house, id);
    if (!p) return { ok: false, error: "No such profile" };
    house.activeId = id;
    writeHouse(house);
    return { ok: true, house, profile: p };
  }

  function setContinue(profileId, titleId, progress) {
    const curator = readCurator(profileId);
    const n = Number(progress);
    if (!titleId) return curator;
    if (!Number.isFinite(n) || n <= 0.03 || n >= 0.96) delete curator.continueWatching[titleId];
    else curator.continueWatching[titleId] = n;
    return writeCurator(profileId, curator);
  }

  function resetCurator(profileId) {
    const curator = readCurator(profileId);
    const keepTrakt = curator.trakt?.connected
      ? { ...curator.trakt, pending: null }
      : emptyCurator().trakt;
    return writeCurator(profileId, { ...emptyCurator(), trakt: keepTrakt });
  }

  function readTraktApp() {
    const envId = String(process.env.TRAKT_CLIENT_ID || "").trim();
    const envSecret = String(process.env.TRAKT_CLIENT_SECRET || "").trim();
    const file = readJson(traktAppPath, {});
    return {
      clientId: String(file.clientId || envId || "").trim(),
      clientSecret: String(file.clientSecret || envSecret || "").trim(),
    };
  }

  function writeTraktApp({ clientId, clientSecret }) {
    const next = {
      clientId: String(clientId || "").trim(),
      clientSecret: String(clientSecret || "").trim(),
    };
    writeJson(traktAppPath, next);
    return next;
  }

  async function traktJson(path, { method = "GET", body, token, clientId } = {}) {
    if (typeof fetchFn !== "function") {
      return { ok: false, status: 0, json: null, error: "No fetch" };
    }
    const headers = {
      "Content-Type": "application/json",
      "trakt-api-version": "2",
      "trakt-api-key": clientId,
      "User-Agent": "ReelOS",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetchFn(`https://api.trakt.tv${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
  }

  async function startTraktDevice(profileId) {
    const app = readTraktApp();
    if (!app.clientId) {
      return { ok: false, error: "Paste a free Trakt app Client ID in Settings. Local thumbs still work." };
    }
    const r = await traktJson("/oauth/device/code", {
      method: "POST",
      clientId: app.clientId,
      body: { client_id: app.clientId },
    });
    if (!r.ok || !r.json?.device_code) {
      return { ok: false, error: r.json?.error || `trakt ${r.status || "unreachable"}` };
    }
    const curator = readCurator(profileId);
    curator.trakt.pending = {
      deviceCode: r.json.device_code,
      userCode: r.json.user_code,
      verificationUrl: r.json.verification_url || "https://trakt.tv/activate",
      interval: Number(r.json.interval) || 5,
      expiresAt: now() + (Number(r.json.expires_in) || 600) * 1000,
    };
    writeCurator(profileId, curator);
    return { ok: true, pending: publicTrakt(curator).pending };
  }

  async function pollTraktDevice(profileId) {
    const app = readTraktApp();
    const curator = readCurator(profileId);
    const pending = curator.trakt?.pending;
    if (!pending?.deviceCode) return { ok: false, error: "No Trakt login in progress" };
    if (pending.expiresAt && now() > pending.expiresAt) {
      curator.trakt.pending = null;
      writeCurator(profileId, curator);
      return { ok: false, error: "Trakt code expired. Start again." };
    }
    const r = await traktJson("/oauth/device/token", {
      method: "POST",
      clientId: app.clientId,
      body: {
        code: pending.deviceCode,
        client_id: app.clientId,
        client_secret: app.clientSecret,
      },
    });
    if (r.status === 400 || r.json?.error === "authorization_pending") {
      return { ok: true, pending: publicTrakt(curator).pending, waiting: true };
    }
    if (!r.ok || !r.json?.access_token) {
      return { ok: false, error: r.json?.error || `trakt ${r.status}` };
    }
    curator.trakt = {
      connected: true,
      username: r.json.user?.username || "",
      accessToken: r.json.access_token,
      refreshToken: r.json.refresh_token || "",
      pending: null,
    };
    writeCurator(profileId, curator);
    return { ok: true, trakt: publicTrakt(curator) };
  }

  function disconnectTrakt(profileId) {
    const curator = readCurator(profileId);
    curator.trakt = emptyCurator().trakt;
    writeCurator(profileId, curator);
    return { ok: true, trakt: publicTrakt(curator) };
  }

  async function syncTraktVote(profileId, title, vote) {
    const curator = readCurator(profileId);
    const token = curator.trakt?.accessToken;
    if (!token) return { skipped: true };
    const app = readTraktApp();
    if (!app.clientId) return { skipped: true };
    const parsed = String(title?.id || title || "");
    const tv = parsed.startsWith("tmdb-tv-");
    const tmdb = Number(tv ? parsed.slice(8) : parsed.replace(/^tmdb-/, ""));
    if (!Number.isFinite(tmdb) || tmdb <= 0) return { skipped: true };
    const rating = vote === "up" ? 10 : vote === "down" ? 1 : 0;
    const row = { ids: { tmdb }, rating };
    const body = tv ? { shows: [row] } : { movies: [row] };
    if (!rating) {
      await traktJson("/sync/ratings/remove", { method: "POST", clientId: app.clientId, token, body });
      return { skipped: false };
    }
    await traktJson("/sync/ratings", { method: "POST", clientId: app.clientId, token, body });
    return { skipped: false };
  }

  return {
    root,
    readHouse,
    writeHouse,
    readCurator,
    writeCurator,
    resolveProfile,
    findProfile,
    addProfile,
    removeProfile,
    selectProfile,
    setContinue,
    resetCurator,
    vote(profileId, titleId, vote) {
      const curator = voteOnTitle(readCurator(profileId), titleId, vote);
      writeCurator(profileId, curator);
      return curator;
    },
    readTraktApp,
    writeTraktApp,
    startTraktDevice,
    pollTraktDevice,
    disconnectTrakt,
    syncTraktVote,
  };
}

let defaultStore = null;

export function profilesStore(opts) {
  if (opts) return createProfileStore(opts);
  if (!defaultStore) defaultStore = createProfileStore();
  return defaultStore;
}

export function setProfilesStoreForTests(store) {
  defaultStore = store;
}

export async function dispatchProfilesApi(req, res, { send, readBody, store } = {}) {
  const box = store || profilesStore();
  const pathOnly = (req.url ?? "").split("?", 1)[0] ?? "";
  const method = (req.method || "GET").toUpperCase();

  if (pathOnly === "/api/profiles" && method === "GET") {
    const { house, profile } = box.resolveProfile(req);
    const curator = box.readCurator(profile.id);
    send(res, 200, {
      ok: true,
      picker: needsProfilePicker(house),
      activeId: profile.id,
      profile: publicProfile(profile),
      profiles: house.profiles.map(publicProfile),
      curator: {
        votes: curator.votes,
        continueWatching: curator.continueWatching,
        trakt: publicTrakt(curator),
      },
      googleTv: { supported: false, copy: GOOGLE_TV_COPY },
      trakt: { free: true, copy: TRAKT_FREE_COPY, app: { configured: Boolean(box.readTraktApp().clientId) } },
    });
    return true;
  }

  if (pathOnly === "/api/profiles" && method === "POST") {
    const { profile: actor } = box.resolveProfile(req);
    if (kidsLocks(actor).lockSettings) {
      send(res, 403, { ok: false, error: "Kids profile cannot change household settings." });
      return true;
    }
    const body = await readBody(req);
    const action = String(body.action || "add").toLowerCase();
    if (action === "select") {
      const out = box.selectProfile(String(body.id || ""));
      if (!out.ok) {
        send(res, 404, out);
        return true;
      }
      res.setHeader("set-cookie", profileCookieHeader(out.profile.id));
      send(res, 200, {
        ok: true,
        picker: needsProfilePicker(out.house),
        activeId: out.profile.id,
        profile: publicProfile(out.profile),
        profiles: out.house.profiles.map(publicProfile),
      });
      return true;
    }
    if (action === "remove") {
      const out = box.removeProfile(String(body.id || ""));
      send(res, out.ok ? 200 : 400, {
        ...out,
        picker: out.house ? needsProfilePicker(out.house) : false,
        profiles: out.house ? out.house.profiles.map(publicProfile) : undefined,
      });
      return true;
    }
    const out = box.addProfile({ name: body.name, kind: body.kind === "kids" ? "kids" : "adult" });
    send(res, out.ok ? 200 : 400, {
      ...out,
      picker: out.house ? needsProfilePicker(out.house) : false,
      profiles: out.house ? out.house.profiles.map(publicProfile) : undefined,
      profile: out.profile ? publicProfile(out.profile) : undefined,
    });
    return true;
  }

  if (pathOnly === "/api/curator" && method === "GET") {
    const { profile } = box.resolveProfile(req);
    const curator = box.readCurator(profile.id);
    send(res, 200, {
      ok: true,
      profileId: profile.id,
      votes: curator.votes,
      continueWatching: curator.continueWatching,
      trakt: publicTrakt(curator),
    });
    return true;
  }

  if (pathOnly === "/api/curator" && method === "POST") {
    const { profile } = box.resolveProfile(req);
    const body = await readBody(req);
    if (body.reset) {
      const curator = box.resetCurator(profile.id);
      send(res, 200, { ok: true, votes: curator.votes, trakt: publicTrakt(curator) });
      return true;
    }
    const titleId = String(body.titleId || body.id || "").trim();
    const curator = box.vote(profile.id, titleId, body.vote);
    void box.syncTraktVote(profile.id, { id: titleId }, curator.votes[titleId] || null).catch(() => {});
    send(res, 200, { ok: true, titleId, vote: curator.votes[titleId] || null, votes: curator.votes });
    return true;
  }

  if (pathOnly === "/api/continue" && method === "GET") {
    const { profile } = box.resolveProfile(req);
    send(res, 200, { ok: true, profileId: profile.id, items: continueEntries(box.readCurator(profile.id)) });
    return true;
  }

  if (pathOnly === "/api/continue" && method === "POST") {
    const { profile } = box.resolveProfile(req);
    const body = await readBody(req);
    const curator = box.setContinue(profile.id, String(body.titleId || ""), body.progress);
    send(res, 200, { ok: true, items: continueEntries(curator) });
    return true;
  }

  if (pathOnly === "/api/trakt" && method === "GET") {
    const { profile } = box.resolveProfile(req);
    const app = box.readTraktApp();
    send(res, 200, {
      ok: true,
      free: true,
      copy: TRAKT_FREE_COPY,
      googleTv: { supported: false, copy: GOOGLE_TV_COPY },
      configured: Boolean(app.clientId),
      trakt: publicTrakt(box.readCurator(profile.id)),
    });
    return true;
  }

  if (pathOnly === "/api/trakt" && method === "POST") {
    const { profile: actor } = box.resolveProfile(req);
    if (kidsLocks(actor).lockSettings) {
      send(res, 403, { ok: false, error: "Kids profile cannot change household settings." });
      return true;
    }
    const body = await readBody(req);
    const action = String(body.action || "").toLowerCase();
    if (action === "app") {
      const app = box.writeTraktApp({ clientId: body.clientId, clientSecret: body.clientSecret });
      send(res, 200, { ok: true, configured: Boolean(app.clientId) });
      return true;
    }
    if (action === "start") {
      const out = await box.startTraktDevice(actor.id);
      send(res, out.ok ? 200 : 400, out);
      return true;
    }
    if (action === "poll") {
      const out = await box.pollTraktDevice(actor.id);
      send(res, out.ok || out.waiting ? 200 : 400, out);
      return true;
    }
    if (action === "disconnect") {
      send(res, 200, box.disconnectTrakt(actor.id));
      return true;
    }
    send(res, 400, { ok: false, error: "Unknown Trakt action" });
    return true;
  }

  return false;
}

export function refuseIfKidsLocked(req, res, send, { settings = false, request = false } = {}) {
  const box = profilesStore();
  const { profile } = box.resolveProfile(req);
  const locks = kidsLocks(profile);
  if (settings && locks.lockSettings) {
    send(res, 403, { ok: false, error: "Kids profile cannot open Settings." });
    return true;
  }
  if (request && locks.lockRequest) {
    send(res, 403, { ok: false, error: "Kids profile cannot Request. Switch to an adult profile." });
    return true;
  }
  return false;
}
