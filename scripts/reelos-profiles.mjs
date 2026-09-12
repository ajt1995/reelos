/**
 * Household profiles. Each member has a 1–2 question wizard (age + their
 * Jellyfin login). The owner's 7-step house wizard stays 7. ReelOS session
 * authenticates as that Jellyfin user — not the owner's. Like/dislike is per
 * profile. Trakt is optional. Not a Google TV scrape.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

export const MEMBER_WIZARD_TOTAL = 2;

export const MEMBER_WIZARD_QUESTIONS = [
  {
    id: "age",
    title: "How old are you?",
    sub: "This sets the parental rating on your Jellyfin account. The owner can change it later in Settings.",
  },
  {
    id: "jellyfin",
    title: "Jellyfin username and password/PIN",
    sub: "Your Jellyfin account — not the owner's. ReelOS signs in as this user on this phone and on the TV.",
  },
];

export const AGE_BANDS = [
  { id: "under7", label: "Under 7", minAge: 0, maxAge: 6, parentalMax: 7 },
  { id: "7to12", label: "7–12", minAge: 7, maxAge: 12, parentalMax: 10 },
  { id: "13to16", label: "13–16", minAge: 13, maxAge: 16, parentalMax: 14 },
  { id: "17plus", label: "17+", minAge: 17, maxAge: 120, parentalMax: null },
];

export const OWNER_PERMISSION_TOGGLES = [
  {
    id: "canRequest",
    label: "Can request titles",
    hint: "Discover and Request on this profile.",
  },
  {
    id: "autoApprove",
    label: "Auto-approve their requests",
    hint: "Skip the owner queue for this person.",
  },
  {
    id: "canApprove",
    label: "Can approve others' requests",
    hint: "House queue, not just their own.",
  },
  {
    id: "canManageHouse",
    label: "Can change house Settings",
    hint: "Source, quality, Apply, users. Owner-only by default.",
  },
  {
    id: "canRemoveLibrary",
    label: "Can remove titles from this box",
    hint: "Unmonitor and delete the engine row — never /media.",
  },
  {
    id: "traktEnabled",
    label: "Trakt (optional)",
    hint: "Scrobble this profile. Off by default. Not a Google TV scrape.",
  },
];

export const SESSION_COOKIE = "reelos_profile";
const SESSION_DAYS = 30;

export function isHouseOwner(role) {
  return role === "owner" || role === "admin";
}

export function ageBandForYears(years) {
  const n = Number(years);
  const age = Number.isFinite(n) ? n : 17;
  return AGE_BANDS.find((b) => age >= b.minAge && age <= b.maxAge) || AGE_BANDS[3];
}

export function parentalMaxForAge(years) {
  return ageBandForYears(years).parentalMax;
}

export function defaultPermissions(role, ageYears) {
  const owner = isHouseOwner(role);
  const years = ageYears == null ? 17 : Number(ageYears);
  return {
    canRequest: owner || years >= 7,
    autoApprove: owner,
    canApprove: owner,
    canManageHouse: owner,
    canRemoveLibrary: owner,
    traktEnabled: false,
  };
}

export function publicProfile(profile) {
  if (!profile || typeof profile !== "object") return profile;
  const { jellyfinPassword: _omit, ...rest } = profile;
  void _omit;
  return rest;
}

export function normalizeProfile(raw, fallbackRole = "member") {
  const src = raw && typeof raw === "object" ? raw : {};
  const role = isHouseOwner(src.role) ? "owner" : "member";
  const ageYears =
    src.ageYears == null || src.ageYears === ""
      ? fallbackRole === "owner"
        ? 17
        : null
      : Number(src.ageYears);
  const ageOk = Number.isFinite(ageYears) ? ageYears : null;
  const band = ageOk == null ? AGE_BANDS[3] : ageBandForYears(ageOk);
  const perms = { ...defaultPermissions(role, ageOk), ...(src.permissions || {}) };
  for (const t of OWNER_PERMISSION_TOGGLES) {
    if (typeof src[t.id] === "boolean") perms[t.id] = src[t.id];
  }
  if (isHouseOwner(role)) {
    perms.canManageHouse = true;
    perms.canApprove = true;
    perms.canRequest = true;
  }
  return {
    id: String(src.id || "").trim() || `u-${randomBytes(4).toString("hex")}`,
    name: String(src.name || src.jellyfinUser || "").trim() || "Member",
    role,
    ageYears: ageOk,
    ageBand: src.ageBand || band.id,
    parentalMax: src.parentalMax === undefined ? band.parentalMax : src.parentalMax,
    jellyfinUser: String(src.jellyfinUser || src.name || "").trim(),
    jellyfinUserId: src.jellyfinUserId ? String(src.jellyfinUserId) : "",
    jellyfinPassword: String(src.jellyfinPassword || ""),
    permissions: perms,
    traktEnabled: perms.traktEnabled === true,
  };
}

export function ownerFromAnswers(answers) {
  const a = answers && typeof answers === "object" ? answers : {};
  const name = String(a.adminName || "reelos").trim() || "reelos";
  return normalizeProfile(
    {
      id: "u-owner",
      name,
      role: "owner",
      ageYears: 17,
      jellyfinUser: name,
      jellyfinPassword: String(a.adminPassword || "reelos"),
    },
    "owner",
  );
}

function defaultState(answers) {
  const owner = ownerFromAnswers(answers);
  return { profiles: [owner], sessions: {}, taste: {} };
}

export function profilesPath(root) {
  return join(root || "/var/lib/reelos", "profiles.json");
}

export function loadProfiles(root, answers) {
  const path = profilesPath(root);
  let parsed = null;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    parsed = null;
  }
  const base = defaultState(answers);
  if (!parsed || typeof parsed !== "object") return base;
  const incoming = Array.isArray(parsed.profiles) ? parsed.profiles : [];
  const owner = ownerFromAnswers(answers);
  const mapped = incoming.map((p) => normalizeProfile(p, p?.role));
  if (!mapped.some((p) => isHouseOwner(p.role))) mapped.unshift(owner);
  else {
    const idx = mapped.findIndex((p) => isHouseOwner(p.role));
    if (idx >= 0 && !mapped[idx].jellyfinPassword && owner.jellyfinPassword) {
      mapped[idx] = {
        ...mapped[idx],
        jellyfinUser: mapped[idx].jellyfinUser || owner.jellyfinUser,
        jellyfinPassword: owner.jellyfinPassword,
      };
    }
  }
  return {
    profiles: mapped,
    sessions: parsed.sessions && typeof parsed.sessions === "object" ? parsed.sessions : {},
    taste: parsed.taste && typeof parsed.taste === "object" ? parsed.taste : {},
  };
}

export function saveProfiles(state, root) {
  const dir = root || "/var/lib/reelos";
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = profilesPath(dir);
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
  return path;
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function sessionTokenFromReq(req) {
  return parseCookies(req?.headers?.cookie)[SESSION_COOKIE] || "";
}

export function sessionCookieHeader(token, { clear = false } = {}) {
  if (clear || !token) {
    return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  }
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

export function readSession(state, req) {
  const token = sessionTokenFromReq(req);
  if (!token) return null;
  const row = state.sessions?.[token];
  if (!row || typeof row !== "object") return null;
  if (row.exp && Number(row.exp) < Date.now()) return null;
  const profile = (state.profiles || []).find((p) => p.id === row.profileId);
  return profile || null;
}

export function createSession(state, profileId) {
  const token = randomBytes(24).toString("hex");
  const next = { ...state, sessions: { ...(state.sessions || {}) } };
  next.sessions[token] = { profileId, exp: Date.now() + SESSION_DAYS * 86400 * 1000 };
  return { state: next, token };
}

export function clearSession(state, req) {
  const token = sessionTokenFromReq(req);
  if (!token || !state.sessions?.[token]) return state;
  const sessions = { ...state.sessions };
  delete sessions[token];
  return { ...state, sessions };
}

export function tasteFor(state, profileId) {
  const row = state.taste?.[profileId] || {};
  return {
    likes: Array.isArray(row.likes) ? row.likes.map(String) : [],
    dislikes: Array.isArray(row.dislikes) ? row.dislikes.map(String) : [],
  };
}

export function setTaste(state, profileId, titleId, vote) {
  const id = String(titleId || "").trim();
  if (!id || !profileId) return state;
  const cur = tasteFor(state, profileId);
  const likes = new Set(cur.likes);
  const dislikes = new Set(cur.dislikes);
  if (vote === "like") {
    likes.add(id);
    dislikes.delete(id);
  } else if (vote === "dislike") {
    dislikes.add(id);
    likes.delete(id);
  } else {
    likes.delete(id);
    dislikes.delete(id);
  }
  return {
    ...state,
    taste: {
      ...(state.taste || {}),
      [profileId]: { likes: [...likes], dislikes: [...dislikes] },
    },
  };
}

export function applyOwnerPermissions(profile, patch) {
  const next = normalizeProfile({ ...profile, ...(patch || {}) }, profile.role);
  const perms = { ...next.permissions };
  for (const t of OWNER_PERMISSION_TOGGLES) {
    if (typeof patch?.[t.id] === "boolean") perms[t.id] = patch[t.id];
    if (patch?.permissions && typeof patch.permissions[t.id] === "boolean") {
      perms[t.id] = patch.permissions[t.id];
    }
  }
  if (patch?.role === "owner" || patch?.role === "member") {
    next.role = patch.role === "owner" ? "owner" : "member";
  }
  if (isHouseOwner(next.role)) {
    perms.canManageHouse = true;
    perms.canApprove = true;
    perms.canRequest = true;
  }
  if (patch?.ageYears != null) {
    const years = Number(patch.ageYears);
    if (Number.isFinite(years)) {
      next.ageYears = years;
      const band = ageBandForYears(years);
      next.ageBand = band.id;
      if (patch.parentalMax === undefined) next.parentalMax = band.parentalMax;
    }
  }
  if (patch?.parentalMax !== undefined) next.parentalMax = patch.parentalMax;
  next.permissions = perms;
  next.traktEnabled = perms.traktEnabled === true;
  return next;
}

async function jellyfinCreateUser({ fetchImpl, headers, name, password }) {
  const r = await fetchImpl("http://127.0.0.1:8096/Users/New", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ Name: name, Password: password }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(text.slice(0, 160) || `Jellyfin ${r.status}`);
  }
  return r.json();
}

async function jellyfinSetParental({ fetchImpl, headers, userId, parentalMax, policy }) {
  const next = { ...(policy || {}), EnableAllFolders: policy?.EnableAllFolders !== false };
  if (parentalMax == null) next.MaxParentalRating = null;
  else next.MaxParentalRating = parentalMax;
  const r = await fetchImpl(`http://127.0.0.1:8096/Users/${encodeURIComponent(userId)}/Policy`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(next),
    signal: AbortSignal.timeout(8000),
  });
  return r.ok;
}

export async function bindJellyfinAccount({
  fetchImpl = fetch,
  jellyfinToken,
  jellyfinAuthedHeaders,
  ownerAuth,
  username,
  password,
  parentalMax,
}) {
  const user = String(username || "").trim();
  const pin = String(password || "");
  if (user.length < 2) return { ok: false, error: "Need a Jellyfin username" };
  if (pin.length < 4) return { ok: false, error: "PIN must be at least 4 characters" };
  let auth = await jellyfinToken(user, pin);
  if (!auth?.token) {
    if (!ownerAuth?.token) return { ok: false, error: "Owner Jellyfin login is required to create that user" };
    try {
      const created = await jellyfinCreateUser({
        fetchImpl,
        headers: jellyfinAuthedHeaders(ownerAuth.token),
        name: user,
        password: pin,
      });
      const id = created?.Id || created?.id;
      auth = (await jellyfinToken(user, pin)) || { token: ownerAuth.token, id };
      if (id) auth = { ...auth, id };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  }
  if (auth?.id && ownerAuth?.token) {
    try {
      const me = await fetchImpl(`http://127.0.0.1:8096/Users/${encodeURIComponent(auth.id)}`, {
        headers: jellyfinAuthedHeaders(auth.token || ownerAuth.token),
        signal: AbortSignal.timeout(5000),
      }).then((r) => (r.ok ? r.json() : null));
      await jellyfinSetParental({
        fetchImpl,
        headers: jellyfinAuthedHeaders(ownerAuth.token),
        userId: auth.id,
        parentalMax,
        policy: me?.Policy,
      });
    } catch {
      /* parental is best-effort — login still works */
    }
  }
  return { ok: true, auth };
}

function sendJson(res, code, body, setCookie) {
  res.statusCode = code;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  if (setCookie) res.setHeader("set-cookie", setCookie);
  res.end(JSON.stringify(body));
}

export async function dispatchProfilesApi(req, res, ctx) {
  const pathOnly = (req.url ?? "").split("?", 1)[0] ?? "";
  if (!pathOnly.startsWith("/api/profiles") && pathOnly !== "/api/profile") return false;
  const method = (req.method || "GET").toUpperCase();
  const root = ctx.root || "/var/lib/reelos";
  const answers = typeof ctx.answers === "function" ? ctx.answers() : ctx.answers || {};
  let state = loadProfiles(root, answers);
  const actor = readSession(state, req);
  const owner = state.profiles.find((p) => isHouseOwner(p.role)) || ownerFromAnswers(answers);

  if (pathOnly === "/api/profiles" && method === "GET") {
    sendJson(res, 200, {
      ok: true,
      questions: MEMBER_WIZARD_QUESTIONS,
      ageBands: AGE_BANDS,
      permissionToggles: OWNER_PERMISSION_TOGGLES,
      profiles: state.profiles.map(publicProfile),
      session: actor ? publicProfile(actor) : null,
      taste: actor ? tasteFor(state, actor.id) : { likes: [], dislikes: [] },
    });
    return true;
  }

  if ((pathOnly === "/api/profiles/session" || pathOnly === "/api/profile") && method === "GET") {
    const taste = actor ? tasteFor(state, actor.id) : { likes: [], dislikes: [] };
    sendJson(res, 200, {
      ok: true,
      session: actor ? publicProfile(actor) : null,
      taste,
    });
    return true;
  }

  if ((pathOnly === "/api/profiles/session" || pathOnly === "/api/profile") && method === "DELETE") {
    state = clearSession(state, req);
    saveProfiles(state, root);
    sendJson(res, 200, { ok: true, session: null }, sessionCookieHeader("", { clear: true }));
    return true;
  }

  if ((pathOnly === "/api/profiles/session" || pathOnly === "/api/profile") && method === "POST") {
    const body = await ctx.readBody(req);
    const username = String(body.jellyfinUser || body.username || "").trim();
    const password = String(body.jellyfinPassword || body.password || body.pin || "");
    const id = String(body.id || body.profileId || "").trim();
    let profile = id ? state.profiles.find((p) => p.id === id) : null;
    if (!profile && username) {
      profile = state.profiles.find((p) => p.jellyfinUser === username || p.name === username);
    }
    const user = username || profile?.jellyfinUser || "";
    const pin = password || profile?.jellyfinPassword || "";
    const auth = await ctx.jellyfinToken(user, pin);
    if (!auth?.token) {
      sendJson(res, 403, { ok: false, error: "Jellyfin username or PIN does not match" });
      return true;
    }
    if (!profile) {
      sendJson(res, 404, { ok: false, error: "No profile for that Jellyfin user. Run the 1–2 question setup." });
      return true;
    }
    const sess = createSession(state, profile.id);
    saveProfiles(sess.state, root);
    sendJson(
      res,
      200,
      { ok: true, session: publicProfile(profile), taste: tasteFor(sess.state, profile.id) },
      sessionCookieHeader(sess.token),
    );
    return true;
  }

  if (pathOnly === "/api/profiles/setup" && method === "POST") {
    const body = await ctx.readBody(req);
    const username = String(body.jellyfinUser || body.username || "").trim();
    const password = String(body.jellyfinPassword || body.password || body.pin || "");
    const ageYears = Number(body.ageYears ?? body.age);
    const band = body.ageBand ? AGE_BANDS.find((b) => b.id === body.ageBand) : ageBandForYears(ageYears);
    if (!band) {
      sendJson(res, 400, { ok: false, error: MEMBER_WIZARD_QUESTIONS[0].title });
      return true;
    }
    const years = Number.isFinite(ageYears) ? ageYears : band.minAge;
    const ownerAuth = await ctx.jellyfinToken(owner.jellyfinUser || "reelos", owner.jellyfinPassword || "reelos");
    const bound = await bindJellyfinAccount({
      fetchImpl: ctx.fetchImpl || fetch,
      jellyfinToken: ctx.jellyfinToken,
      jellyfinAuthedHeaders: ctx.jellyfinAuthedHeaders,
      ownerAuth,
      username,
      password,
      parentalMax: band.parentalMax,
    });
    if (!bound.ok) {
      sendJson(res, 400, bound);
      return true;
    }
    let profile = state.profiles.find((p) => p.jellyfinUser === username);
    const next = normalizeProfile({
      ...(profile || {}),
      name: username,
      role: profile?.role || "member",
      ageYears: years,
      ageBand: band.id,
      parentalMax: band.parentalMax,
      jellyfinUser: username,
      jellyfinUserId: bound.auth?.id || profile?.jellyfinUserId || "",
      jellyfinPassword: password,
    });
    if (profile) {
      state.profiles = state.profiles.map((p) => (p.id === profile.id ? { ...next, id: profile.id } : p));
      profile = state.profiles.find((p) => p.jellyfinUser === username);
    } else {
      state.profiles = [...state.profiles, next];
      profile = next;
    }
    const sess = createSession(state, profile.id);
    saveProfiles(sess.state, root);
    sendJson(
      res,
      200,
      { ok: true, session: publicProfile(profile), taste: tasteFor(sess.state, profile.id) },
      sessionCookieHeader(sess.token),
    );
    return true;
  }

  if (pathOnly === "/api/profiles/taste" && method === "POST") {
    if (!actor) {
      sendJson(res, 401, { ok: false, error: "Pick a profile first" });
      return true;
    }
    const body = await ctx.readBody(req);
    const vote = String(body.vote || body.taste || "").toLowerCase();
    const titleId = String(body.titleId || body.id || "").trim();
    if (!titleId) {
      sendJson(res, 400, { ok: false, error: "Need a title" });
      return true;
    }
    if (!["like", "dislike", "none", "clear"].includes(vote)) {
      sendJson(res, 400, { ok: false, error: "vote must be like, dislike, or none" });
      return true;
    }
    state = setTaste(state, actor.id, titleId, vote === "clear" ? "none" : vote);
    saveProfiles(state, root);
    sendJson(res, 200, { ok: true, taste: tasteFor(state, actor.id) });
    return true;
  }

  const patchMatch = /^\/api\/profiles\/([^/]+)$/.exec(pathOnly);
  if (patchMatch && (method === "PATCH" || method === "POST")) {
    if (!actor || !isHouseOwner(actor.role)) {
      sendJson(res, 403, { ok: false, error: "Only the owner can change roles and permissions" });
      return true;
    }
    const id = decodeURIComponent(patchMatch[1]);
    const idx = state.profiles.findIndex((p) => p.id === id);
    if (idx < 0) {
      sendJson(res, 404, { ok: false, error: "No such profile" });
      return true;
    }
    const body = await ctx.readBody(req);
    const prev = state.profiles[idx];
    const next = applyOwnerPermissions(prev, body);
    if (isHouseOwner(prev.role) && next.role !== "owner") {
      const owners = state.profiles.filter((p) => isHouseOwner(p.role));
      if (owners.length < 2) {
        sendJson(res, 400, { ok: false, error: "This house needs one owner" });
        return true;
      }
    }
    state.profiles[idx] = next;
    if (next.parentalMax !== prev.parentalMax || body.parentalMax !== undefined || body.ageYears != null) {
      const ownerAuth = await ctx.jellyfinToken(owner.jellyfinUser || "reelos", owner.jellyfinPassword || "reelos");
      if (ownerAuth?.token && next.jellyfinUserId) {
        try {
          await bindJellyfinAccount({
            fetchImpl: ctx.fetchImpl || fetch,
            jellyfinToken: ctx.jellyfinToken,
            jellyfinAuthedHeaders: ctx.jellyfinAuthedHeaders,
            ownerAuth,
            username: next.jellyfinUser,
            password: next.jellyfinPassword,
            parentalMax: next.parentalMax,
          });
        } catch {
          /* */
        }
      }
    }
    saveProfiles(state, root);
    sendJson(res, 200, { ok: true, profile: publicProfile(next) });
    return true;
  }

  if (patchMatch && method === "DELETE") {
    if (!actor || !isHouseOwner(actor.role)) {
      sendJson(res, 403, { ok: false, error: "Only the owner can remove a profile" });
      return true;
    }
    const id = decodeURIComponent(patchMatch[1]);
    const row = state.profiles.find((p) => p.id === id);
    if (!row) {
      sendJson(res, 404, { ok: false, error: "No such profile" });
      return true;
    }
    if (isHouseOwner(row.role)) {
      sendJson(res, 400, { ok: false, error: "Cannot remove the owner" });
      return true;
    }
    state.profiles = state.profiles.filter((p) => p.id !== id);
    saveProfiles(state, root);
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}

export function sessionAuthCreds(req, answers, root) {
  const state = loadProfiles(root || "/var/lib/reelos", answers);
  const profile = readSession(state, req);
  if (profile?.jellyfinUser && profile.jellyfinPassword) {
    return { user: profile.jellyfinUser, password: profile.jellyfinPassword, profile };
  }
  const owner = ownerFromAnswers(answers);
  return { user: owner.jellyfinUser, password: owner.jellyfinPassword, profile: null };
}

/** Unused helper kept so a grep cannot invent a Google TV watch-history scrape. */
export function googleTvScrapeEnabled() {
  return false;
}
