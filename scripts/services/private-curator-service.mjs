import path from "node:path";
import { getRequestActiveProfile, isValidProfileId, publicProfile, safeWriteFileSync } from "./profile-service.mjs";
import { isSameOriginProfileMutation } from "./profile-session-service.mjs";
import { curateFeed } from "./curation-engine.mjs";

const IDENTITY_FIELDS = ["profileId", "residentId", "expectedProfileId"];
const TASTE_FIELDS = ["tasteVibe", "curationWeights", "mediaPriorities", "themeDesign", "weights", "preset"];
const REACTIONS = new Map([
  ["like", "like"], ["likes", "like"], ["love", "love"], ["cozy", "cozy"],
  ["comfort", "cozy"], ["more_like_this", "like"], ["comfort_classic", "cozy"],
  ["dislike", "less"], ["less", "less"], ["not_interested", "less"],
  ["hidden", "less"], ["hide", "less"], ["dismiss", "dismiss"],
  ["reset", null], ["none", null], ["clear", null],
]);
const VALID_POSITIVE = new Set(["like", "love", "cozy"]);
const plainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const validTitleId = (value) => typeof value === "string"
  && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(value)
  && !["constructor", "prototype"].includes(value);
const own = (value, key) => Object.hasOwn(value, key);
const fail = (status, code, message) => { throw Object.assign(new Error(message), { status, code }); };

// Artwork is display metadata, never a transport for local paths, provider
// credentials, or arbitrary upstream URLs. Keep only known public image URLs
// and the narrow same-origin Jellyfin image route with numeric display options.
function publicArtwork(value) {
  if (typeof value !== "string" || value.length > 2048 || /[\\\s]/.test(value)) return undefined;
  if (value.startsWith("/api/jf/Items/")) {
    const url = new URL(value, "http://reelos.local");
    if (url.hash || !/^\/api\/jf\/Items\/[A-Za-z0-9][A-Za-z0-9._:-]{0,255}\/Images\/(Primary|Backdrop)$/.test(url.pathname)) return undefined;
    const seen = new Set();
    for (const [key, number] of url.searchParams) {
      if (seen.has(key) || !["maxWidth", "quality"].includes(key) || !/^[1-9][0-9]{0,3}$/.test(number)
        || Number(number) > (key === "quality" ? 100 : 1920)) return undefined;
      seen.add(key);
    }
    // Reject normalization tricks, including encoded route components.
    if (value.split("?")[0] !== url.pathname) return undefined;
    return `${url.pathname}${url.search}`;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) return undefined;
    const tmdb = url.hostname === "image.tmdb.org"
      && /^\/t\/p\/(w[0-9]{2,4}|original)\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(url.pathname);
    const archive = url.hostname === "archive.org"
      && /^\/services\/img\/[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/.test(url.pathname);
    return tmdb || archive ? url.href : undefined;
  } catch { return undefined; }
}

/** Explicit public projection: trusted adapters may still hold server secrets. */
function publicCatalogItem(item) {
  const result = { id: item.id };
  for (const [key, limit] of Object.entries({ title: 512, name: 512, overview: 10000, description: 10000,
    tagline: 1024, director: 512, author: 512 })) {
    if (typeof item[key] === "string") result[key] = item[key].slice(0, limit);
  }
  for (const key of ["year", "runtime", "seasons", "tracks", "rating", "voteAverage", "voteCount", "popularity", "tmdbId"]) {
    if (typeof item[key] === "number" && Number.isFinite(item[key]) && item[key] >= 0) result[key] = item[key];
  }
  for (const key of ["kind", "type"]) {
    if (["movie", "movies", "tv", "series", "show", "book", "books"].includes(item[key])) result[key] = item[key];
  }
  for (const key of ["releaseDate", "dateAdded"]) {
    if (typeof item[key] === "string" && /^\d{4}-\d{2}-\d{2}(?:T[0-9:.+-]+Z?)?$/.test(item[key])) result[key] = item[key];
  }
  if (validTitleId(item.jellyfinId)) result.jellyfinId = item.jellyfinId;
  if (Array.isArray(item.ids)) result.ids = item.ids.filter(validTitleId).slice(0, 32);
  if (Array.isArray(item.genres)) result.genres = item.genres.filter((genre) => typeof genre === "string" && genre.length <= 64).slice(0, 32);
  for (const key of ["seasonList", "onDiskSeasons", "importingSeasons", "unreleasedSeasons"]) {
    if (Array.isArray(item[key])) result[key] = item[key].filter((number) => Number.isInteger(number) && number >= 0 && number <= 10000).slice(0, 256);
  }
  for (const key of ["inLibrary", "fromDump", "fromHashDump", "hasAdaptation"]) {
    if (typeof item[key] === "boolean") result[key] = item[key];
  }
  if (["1080p", "4k"].includes(item.maxQuality)) result.maxQuality = item.maxQuality;
  for (const key of ["poster", "backdrop"]) {
    const artwork = publicArtwork(item[key]);
    if (artwork) result[key] = artwork;
  }
  if (plainObject(item.collection) && Number.isInteger(item.collection.id) && item.collection.id > 0
    && typeof item.collection.name === "string") {
    result.collection = { id: item.collection.id, name: item.collection.name.slice(0, 512) };
    const artwork = publicArtwork(item.collection.poster);
    if (artwork) result.collection.poster = artwork;
  }
  return result;
}

/** Compatibility data comes exclusively from the supplied canonical profile. */
export function privateCuratorState(profile) {
  const reactions = plainObject(profile?.reactions) ? profile.reactions : {};
  const liked = Object.entries(reactions).filter(([id, value]) => validTitleId(id) && VALID_POSITIVE.has(value)).map(([id]) => id);
  const hidden = [...new Set((Array.isArray(profile?.lessLikeIds) ? profile.lessLikeIds : []).filter(validTitleId))];
  const dismissed = [...new Set((Array.isArray(profile?.dismissedTasteIds) ? profile.dismissedTasteIds : []).filter(validTitleId))];
  return {
    ok: true, profileId: profile?.id || null, liked, hidden, dismissed,
    count: hidden.length, likedCount: liked.length, hiddenCount: hidden.length,
    tasteVibe: profile?.tasteVibe || "balanced",
    curationWeights: { ...(profile?.curationWeights || {}) },
    mediaPriorities: { ...(profile?.mediaPriorities || {}) },
    ...(profile?.themeDesign !== undefined ? { themeDesign: profile.themeDesign } : {}),
    ...(profile?.weights !== undefined ? { weights: profile.weights } : {}),
    ...(profile?.preset !== undefined ? { preset: profile.preset } : {}),
  };
}

function assertIdentity(value, current, depth = 0) {
  if (depth > 8) fail(400, "invalid_payload", "The request is too deeply nested.");
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (IDENTITY_FIELDS.includes(key)) {
      if (!isValidProfileId(entry)) fail(400, "invalid_profile_id", "Invalid expected profile ID.");
      if (entry !== current.id) fail(403, "profile_changed", "Open this profile again before changing its taste.");
    } else if (entry && typeof entry === "object") assertIdentity(entry, current, depth + 1);
  }
}

function validateFields(body, allowed) {
  if (Object.keys(body).some((key) => ![...IDENTITY_FIELDS, ...allowed].includes(key))) {
    fail(400, "invalid_payload", "The request contains unsupported fields.");
  }
}

function boundedWeights(value) {
  if (!plainObject(value) || Object.keys(value).length > 128
    || Object.entries(value).some(([key, number]) => !/^[a-zA-Z0-9][a-zA-Z0-9 _-]{0,63}$/.test(key)
      || ["constructor", "prototype"].includes(key)
      || typeof number !== "number" || !Number.isFinite(number) || number < -2 || number > 3)) {
    fail(400, "invalid_taste", "Taste weights must contain at most 128 named values between -2 and 3.");
  }
  return { ...value };
}

function tasteUpdate(body) {
  validateFields(body, TASTE_FIELDS);
  const update = {};
  for (const key of TASTE_FIELDS) {
    if (!own(body, key)) continue;
    const value = body[key];
    if (key === "curationWeights" || key === "weights") update[key] = boundedWeights(value);
    else if (key === "mediaPriorities") {
      if (!plainObject(value) || Object.keys(value).some((name) => !["movies", "tv", "books"].includes(name))
        || Object.values(value).some((number) => typeof number !== "number" || !Number.isFinite(number) || number < 0 || number > 100)) {
        fail(400, "invalid_taste", "Media priorities must be movie, TV, or book values between 0 and 100.");
      }
      update[key] = { ...value };
    } else if (key === "tasteVibe") {
      if (!["balanced", "bleeding_edge", "comfort", "hidden_gems"].includes(value)) fail(400, "invalid_taste", "Unknown taste vibe.");
      update[key] = value;
    } else {
      if (typeof value !== "string" || !/^[a-z][a-z0-9_-]{0,63}$/.test(value)) fail(400, "invalid_taste", "Invalid theme or preset.");
      update[key] = value;
    }
  }
  if (!Object.keys(update).length) fail(400, "invalid_taste", "Choose a taste preference to save.");
  return update;
}

function titleChoice(body, teach) {
  validateFields(body, teach ? ["id", "titleId", "rating", "action", "genres"] : ["id", "titleId", "vote", "taste", "ids", "jellyfinId", "title"]);
  const titleId = body.titleId ?? body.id;
  if (!validTitleId(titleId) || (own(body, "id") && own(body, "titleId") && body.id !== body.titleId)) {
    fail(400, "invalid_title_id", "Supply one valid title ID.");
  }
  if (own(body, "ids") && (!Array.isArray(body.ids) || body.ids.length > 32 || body.ids.some((id) => !validTitleId(id)))) {
    fail(400, "invalid_title_id", "Invalid title aliases.");
  }
  if (own(body, "jellyfinId") && !validTitleId(body.jellyfinId)) fail(400, "invalid_title_id", "Invalid media ID.");
  if (own(body, "title") && (typeof body.title !== "string" || body.title.length > 512)) fail(400, "invalid_title_id", "Invalid title.");
  if (own(body, "genres") && (!Array.isArray(body.genres) || body.genres.length > 32
    || body.genres.some((genre) => typeof genre !== "string" || !genre.trim() || genre.length > 64))) {
    fail(400, "invalid_genres", "Supply at most 32 named genres.");
  }
  const choices = (teach ? ["rating", "action"] : ["vote", "taste"]).filter((key) => own(body, key)).map((key) => {
    if (body[key] === null) return null;
    if (typeof body[key] !== "string" || !REACTIONS.has(body[key])) fail(400, "invalid_vote", "Choose a supported title reaction.");
    return REACTIONS.get(body[key]);
  });
  if (!choices.length || choices.some((choice) => choice !== choices[0])) fail(400, "invalid_vote", "Supply one unambiguous title reaction.");
  // Aliases are validated compatibility metadata, never additional write targets.
  return { titleId, reaction: choices[0] };
}

function applyChoice(profile, titleId, reaction) {
  const reactions = { ...profile.reactions };
  delete reactions[titleId];
  const dismissedTasteIds = (profile.dismissedTasteIds || []).filter((id) => id !== titleId);
  const lessLikeIds = (profile.lessLikeIds || []).filter((id) => id !== titleId);
  if (reaction === "dismiss") dismissedTasteIds.push(titleId);
  else if (reaction === "less") lessLikeIds.push(titleId);
  else if (reaction !== null) reactions[titleId] = reaction;
  return { reactions, dismissedTasteIds, lessLikeIds };
}

/**
 * Private compatibility boundary for legacy curator URLs.
 * catalog must be a trusted request/profile-authorized async adapter. This
 * service cannot establish source or family eligibility from a raw catalog.
 */
export async function processPrivateCuratorRequest(req, readBodyFn, options = {}) {
  try {
    const stateDir = options.stateDir || process.env.REELOS_STATE
      || (process.platform === "win32" ? path.join(process.cwd(), ".reelos-state") : "/var/lib/reelos");
    const profilesDir = options.profilesDir || process.env.REELOS_PROFILES_DIR || path.join(stateDir, "profiles");
    const url = new URL(req.originalUrl || req.url || "/api/curator", "http://localhost");
    const route = url.pathname === "/api/curator/recommendations" ? "/api/curator/feed" : url.pathname;
    const method = (req.method || "GET").toUpperCase();
    const routes = ["/api/curator", "/api/curator/reset", "/api/curator/teach", "/api/curator/taste", "/api/curator/feed"];
    if (!routes.includes(route)) fail(404, "not_found", "Unknown curator route.");
    if (!["GET", "POST"].includes(method) || (["/api/curator/reset", "/api/curator/teach"].includes(route) && method !== "POST")
      || (route === "/api/curator/feed" && method !== "GET")) fail(405, "method_not_allowed", "Method not allowed.");
    if (!isSameOriginProfileMutation(req, url)) fail(403, "cross_origin_denied", "Use the ReelOS home connection.");
    let current = getRequestActiveProfile(req, profilesDir);
    if (!current) fail(401, "profile_auth_required", "Open an authorized profile first.");
    for (const [key, value] of url.searchParams) {
      if (IDENTITY_FIELDS.includes(key)) assertIdentity({ [key]: value }, current);
    }
    if (method === "GET") {
      if (route === "/api/curator/feed") {
        if (typeof options.catalog !== "function") fail(503, "catalog_unavailable", "A profile-authorized catalog is not connected.");
        const boundId = current.id;
        const catalog = await options.catalog(req, current);
        current = getRequestActiveProfile(req, profilesDir);
        if (!current) fail(401, "profile_auth_required", "The authorized profile session ended.");
        if (current.id !== boundId) fail(403, "profile_changed", "The active profile changed.");
        if (!plainObject(catalog) || ["movies", "tv", "books"].some((key) => own(catalog, key) && !Array.isArray(catalog[key]))) {
          fail(503, "catalog_unavailable", "The authorized catalog is unavailable.");
        }
        const view = privateCuratorState(current);
        const hidden = new Set(view.hidden);
        const eligible = Object.fromEntries(["movies", "tv", "books"].map((key) => [key, (catalog[key] || [])
          .filter((item) => plainObject(item) && validTitleId(item.id) && !hidden.has(item.id))
          .map(publicCatalogItem)]));
        const feed = curateFeed(eligible, { ...current, likedIds: view.liked, dislikedIds: view.hidden });
        return { status: 200, payload: { ok: true, profile: current.name, profileId: current.id, feed } };
      }
      return { status: 200, payload: { ...privateCuratorState(current), ...(route.endsWith("/taste") ? { profile: publicProfile(current) } : {}) } };
    }
    const boundId = current.id;
    let body;
    try { body = typeof readBodyFn === "function" ? await readBodyFn(req) : req.body ?? {}; }
    catch (error) {
      if (error?.status === 413) fail(413, "payload_too_large", "The curator request is too large.");
      fail(400, "invalid_payload", "The request body could not be read.");
    }
    // Body reads yield: revalidate both authorization and the profile snapshot
    // before inspecting input or persisting, even if no assertion was supplied.
    current = getRequestActiveProfile(req, profilesDir);
    if (!current) fail(401, "profile_auth_required", "The authorized profile session ended.");
    if (current.id !== boundId) fail(403, "profile_changed", "The active profile changed.");
    if (!plainObject(body)) fail(400, "invalid_payload", "Expected a JSON object.");
    assertIdentity(body, current);
    let update;
    if (route === "/api/curator/reset") {
      validateFields(body, []);
      update = { reactions: {}, dismissedTasteIds: [], lessLikeIds: [] };
    } else if (route === "/api/curator/taste") update = tasteUpdate(body);
    else {
      const { titleId, reaction } = titleChoice(body, route === "/api/curator/teach");
      update = applyChoice(current, titleId, reaction);
    }
    const saved = { ...current, ...update, updatedAt: Date.now() };
    let persisted;
    try { persisted = safeWriteFileSync(path.join(profilesDir, `${current.id}.json`), JSON.stringify(saved, null, 2)); }
    catch { fail(503, "curator_save_failed", "Your private taste could not be saved. Try again."); }
    if (!persisted) fail(507, "storage_full", "Your private taste could not be saved because storage is full.");
    return { status: 200, payload: { ...privateCuratorState(saved), persisted: true,
      ...(route.endsWith("/teach") || route.endsWith("/taste") ? { profile: publicProfile(saved) } : {}) } };
  } catch (error) {
    return { status: error.status || 503, payload: { ok: false, code: error.code || "curator_unavailable", error: error.status ? error.message : "Private taste is temporarily unavailable." } };
  }
}
