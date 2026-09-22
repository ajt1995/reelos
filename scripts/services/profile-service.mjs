import fs from "node:fs";
import path from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  isSameOriginProfileMutation, isSecureRequest, readCookie,
  readProfileSession, replaceProfileSession,
} from "./profile-session-service.mjs";
import {
  getAuthorizedDevice, registerAuthorizedDevice, signDeviceToken, getGateSecret,
  deviceTokenCookie, setAuthorizedDeviceActiveProfile, isPrivateOrLanIp,
} from "./reelos-gate-service.mjs";
import {
  deleteIntelligenceProfile, recordIntelligenceEvent, scheduleIntelligenceWork,
} from "./intelligence-event-recorder.mjs";

const DEFAULT_PROFILES_DIR =
  process.env.REELOS_PROFILES_DIR ||
  (process.env.REELOS_STATE ? path.join(process.env.REELOS_STATE, "profiles") : null) ||
  (process.platform === "win32"
    ? path.join(process.cwd(), ".reelos-state", "profiles")
    : "/var/lib/reelos/profiles");

const PIN_KEY_BYTES = 32;
const PIN_FAILURE_LIMIT = 5;
const PIN_FAILURE_WINDOW_MS = 5 * 60 * 1000;
const PIN_LOCK_MS = 60 * 1000;
const pinAttempts = new Map();
const CHILD_EXIT_COOKIE = "reelos_profile_pin";
const CHILD_EXIT_AUTH_MS = 2 * 60 * 1000;
const childExitAuthorizations = new Map();

function requestAddress(req) {
  return req.socket?.remoteAddress || "local";
}

function issueChildExitAuthorization(profileId, req, profilesDir, now = Date.now()) {
  for (const [key, saved] of childExitAuthorizations) {
    if (saved.expiresAt <= now) childExitAuthorizations.delete(key);
  }
  const token = randomBytes(24).toString("base64url");
  childExitAuthorizations.set(token, {
    profileId,
    profilesDir: path.resolve(profilesDir),
    deviceId: getAuthorizedDevice(req, path.dirname(profilesDir))?.id || null,
    sessionToken: readProfileSession(req, profilesDir)?.token || null,
    address: requestAddress(req),
    expiresAt: now + CHILD_EXIT_AUTH_MS,
  });
  return token;
}

function consumeChildExitAuthorization(req, profileId, profilesDir, now = Date.now()) {
  const token = readCookie(req, CHILD_EXIT_COOKIE);
  const authorization = token ? childExitAuthorizations.get(token) : null;
  if (token) childExitAuthorizations.delete(token);
  return Boolean(
    authorization &&
      authorization.profileId === profileId &&
      authorization.profilesDir === path.resolve(profilesDir) &&
      authorization.deviceId === (getAuthorizedDevice(req, path.dirname(profilesDir))?.id || null) &&
      authorization.sessionToken === (readProfileSession(req, profilesDir)?.token || null) &&
      authorization.address === requestAddress(req) &&
      authorization.expiresAt >= now,
  );
}

export function profilePinAttemptState(key, now = Date.now()) {
  const saved = pinAttempts.get(key);
  if (!saved || now - saved.windowStartedAt > PIN_FAILURE_WINDOW_MS) {
    return { locked: false, failures: 0, retryAfterMs: 0 };
  }
  const retryAfterMs = Math.max(0, (saved.lockedUntil || 0) - now);
  return { locked: retryAfterMs > 0, failures: saved.failures, retryAfterMs };
}

export function recordProfilePinAttempt(key, verified, now = Date.now()) {
  if (verified) {
    pinAttempts.delete(key);
    return profilePinAttemptState(key, now);
  }
  const current = profilePinAttemptState(key, now);
  const failures = current.failures + 1;
  pinAttempts.set(key, {
    windowStartedAt: current.failures
      ? pinAttempts.get(key).windowStartedAt
      : now,
    failures,
    lockedUntil: failures >= PIN_FAILURE_LIMIT ? now + PIN_LOCK_MS : 0,
  });
  return profilePinAttemptState(key, now);
}

export function clearProfilePinAttempts() {
  pinAttempts.clear();
  childExitAuthorizations.clear();
}

export function hashProfilePin(pin) {
  const normalized = String(pin || "").trim();
  if (!/^\d{4,8}$/.test(normalized)) {
    throw new Error("PIN must contain 4 to 8 digits");
  }
  const salt = randomBytes(16);
  const digest = scryptSync(normalized, salt, PIN_KEY_BYTES);
  return `scrypt:${salt.toString("base64")}:${digest.toString("base64")}`;
}

export function verifyProfilePin(pin, encoded) {
  const normalized = String(pin || "").trim();
  const parts = String(encoded || "").split(":");
  const [scheme, salt64, digest64] = parts;
  if (
    parts.length !== 3 ||
    scheme !== "scrypt" ||
    !salt64 ||
    !digest64 ||
    !/^\d{4,8}$/.test(normalized)
  )
    return false;
  try {
    const expected = Buffer.from(digest64, "base64");
    const salt = Buffer.from(salt64, "base64");
    if (expected.length !== PIN_KEY_BYTES || salt.length !== 16) return false;
    const actual = scryptSync(
      normalized,
      salt,
      PIN_KEY_BYTES,
    );
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
}

export function publicProfile(profile) {
  if (!profile || typeof profile !== "object") return profile;
  // summaryOnly is a response projection marker, never durable profile state.
  // Strip stale copies written by older builds so an authenticated full profile
  // cannot be mistaken for an unauthenticated household roster entry.
  const { pin: _legacyPin, pinHash: _pinHash, summaryOnly: _summaryOnly, ...safe } = profile;
  return { ...safe, experienceVersion: 2, pinEnabled: Boolean(profile.pinHash || profile.pin) };
}

export function isValidProfileId(id) {
  return typeof id === "string" && /^[a-z0-9][a-z0-9_-]{0,95}$/.test(id)
    && !/^(active|con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(id);
}

function requireProfileId(id) {
  if (!isValidProfileId(id)) throw new Error("Invalid profile ID");
  return id;
}

function profileSummary(profile) {
  return {
    id: profile.id, name: profile.name, avatar: profile.avatar, color: profile.color,
    isKids: Boolean(profile.isKids), isGuest: Boolean(profile.isGuest),
    pinEnabled: Boolean(profile.pinHash || profile.pin),
    experienceVersion: 2, summaryOnly: true,
  };
}

export const DEFAULT_PROFILES = [
  {
    id: "res-primary",
    name: "Primary",
    avatar: "clapperboard",
    isGuest: false,
    isKids: false,
    hideKidsContent: false,
    watchlist: ["tmdb-335984", "tmdb-tv-106379", "tmdb-872585"],
    watchProgress: {
      "tmdb-693134": 0.42,
      "tmdb-tv-95396": 0.68,
      "tvdb-371980": 0.68,
    },
    assignedTitleIds: [
      "tmdb-693134",
      "tmdb-335984",
      "tmdb-157336",
      "tmdb-414906",
      "tmdb-872585",
      "tmdb-603",
      "tmdb-tv-95396",
      "tmdb-tv-106379",
      "tmdb-tv-126308",
      "tvdb-371980",
      "tvdb-384469",
      "tvdb-410091",
    ],
    mediaPriorities: { movies: 50, tv: 50, books: 25 },
    tasteVibe: "balanced",
    themeDesign: "oled_cinema",
    accentColor: "gold-hashed",
    motionStyle: "cinematic",
    curationWeights: {},
    createdAt: 1000,
    updatedAt: 1000,
  },
  {
    id: "res-sarah",
    name: "Sarah",
    avatar: "sparkles",
    isGuest: false,
    isKids: false,
    hideKidsContent: false,
    watchlist: ["tmdb-329865", "tmdb-tv-97546", "tmdb-tv-125927"],
    watchProgress: {
      "tmdb-tv-136283": 0.54,
      "tvdb-403294": 0.54,
      "tmdb-346698": 0.28,
    },
    assignedTitleIds: [
      "tmdb-346698",
      "tmdb-329865",
      "tmdb-530915",
      "tmdb-64688",
      "tmdb-tv-136283",
      "tmdb-tv-97546",
      "tmdb-tv-125927",
      "tmdb-tv-94605",
      "tvdb-403294",
      "tvdb-383203",
      "tvdb-403487",
      "tvdb-370163",
    ],
    mediaPriorities: { movies: 70, tv: 30, books: 60 },
    tasteVibe: "comfort",
    themeDesign: "warm_velvet",
    accentColor: "cinematic-velvet",
    motionStyle: "cinematic",
    curationWeights: {},
    createdAt: 2000,
    updatedAt: 2000,
  },
  {
    id: "res-kids",
    name: "Kids",
    avatar: "sparkles",
    isGuest: false,
    isKids: true,
    hideKidsContent: false,
    watchlist: [],
    watchProgress: {},
    mediaPriorities: { movies: 80, tv: 80, books: 10 },
    tasteVibe: "comfort",
    themeDesign: "futuristic_hud",
    accentColor: "midnight-slate",
    motionStyle: "flashy",
    curationWeights: {},
    createdAt: 3000,
    updatedAt: 3000,
  },
  {
    id: "res-guest",
    name: "Guest",
    avatar: "popcorn",
    isGuest: true,
    isKids: false,
    hideKidsContent: false,
    watchlist: [],
    watchProgress: {},
    mediaPriorities: { movies: 50, tv: 50, books: 0 },
    tasteVibe: "balanced",
    themeDesign: "oled_cinema",
    accentColor: "oled-obsidian",
    motionStyle: "cinematic",
    curationWeights: {},
    createdAt: 4000,
    updatedAt: 4000,
  },
];

const LEGACY_DEMO_PROFILE_IDS = new Set(DEFAULT_PROFILES.map((profile) => profile.id));

export function visibleProfilesForHome(profiles, setup) {
  if (setup?.status !== "complete") return profiles;
  const personal = profiles.filter((profile) => !LEGACY_DEMO_PROFILE_IDS.has(profile.id));
  return personal.length ? personal : profiles;
}

/**
 * Ensures the profiles directory exists.
 */
export function ensureProfilesDir(dir = DEFAULT_PROFILES_DIR) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  } catch (err) {
    throw err;
  }
  return dir;
}

/**
 * Synchronous atomic file writer guarded against ENOSPC and disk exhaustion errors.
 * Writes to a temporary file in the same directory and renames atomically via renameSync.
 * If disk space is exhausted (ENOSPC), the existing destination file on disk is NEVER truncated.
 * Logs a warning and returns false gracefully if storage is full.
 */
export function safeWriteFileSync(filePath, data, options = "utf8") {
  const dir = path.dirname(filePath);
  const tmpFile = path.join(
    dir,
    `.${path.basename(filePath)}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`,
  );

  try {
    fs.writeFileSync(tmpFile, data, typeof options === "string"
      ? { encoding: options, mode: 0o600, flag: "wx" }
      : { ...options, mode: 0o600, flag: "wx" });
    fs.renameSync(tmpFile, filePath);
    return true;
  } catch (err) {
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {}

    if (
      err &&
      (err.code === "ENOSPC" ||
        String(err).includes("ENOSPC") ||
        err.message?.includes("ENOSPC"))
    ) {
      console.warn(
        `[storage-guard] Storage headroom exhausted (ENOSPC). Skipping write to ${filePath}.`,
      );
      return false;
    }
    throw err;
  }
}

/**
 * Lists all registered household and guest profiles.
 */
export function listProfiles(dir = DEFAULT_PROFILES_DIR) {
  const targetDir = ensureProfilesDir(dir);
  const files = fs.readdirSync(targetDir)
    .filter((file) => file.endsWith(".json") && file !== "active.json");
  const profiles = files.map((file) => {
    const id = requireProfileId(file.slice(0, -5));
    const profile = JSON.parse(fs.readFileSync(path.join(targetDir, file), "utf8"));
    if (profile?.id !== id) throw new Error("Profile storage needs recovery");
    return profile;
  });
  return profiles.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

/**
 * Gets a single profile by ID.
 */
export function getProfile(id, dir = DEFAULT_PROFILES_DIR) {
  if (!id) return null;
  requireProfileId(id);
  const targetDir = ensureProfilesDir(dir);
  const filePath = path.join(targetDir, `${id}.json`);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  return null;
}

/**
 * Creates or updates a profile.
 */
export function saveProfile(profile, dir = DEFAULT_PROFILES_DIR) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    throw new Error("Invalid profile payload");
  }
  const id = requireProfileId(profile.id || `res-${randomBytes(12).toString("hex")}`);
  const targetDir = ensureProfilesDir(dir);
  const existing = getProfile(id, dir);

  const requestedPin = Object.prototype.hasOwnProperty.call(profile, "pin")
    ? String(profile.pin ?? "").trim()
    : null;
  const isKids = Boolean(profile.isKids ?? existing?.isKids);
  let pinHash =
    existing?.pinHash || (existing?.pin ? hashProfilePin(existing.pin) : null);
  if (requestedPin !== null) {
    if (requestedPin) pinHash = hashProfilePin(requestedPin);
    else if (!isKids) pinHash = null;
  }
  if (isKids && !pinHash) throw new Error("A child profile requires a family PIN");

  const merged = {
    id,
    role: existing?.role || (profile.role === "owner" && !isKids ? "owner" : "member"),
    name: profile.name?.trim() || existing?.name || "Resident",
    avatar: profile.avatar || existing?.avatar || "clapperboard",
    pinHash,
    isGuest: Boolean(profile.isGuest ?? existing?.isGuest),
    isKids: Boolean(profile.isKids ?? existing?.isKids),
    hideKidsContent: Boolean(
      profile.hideKidsContent ?? existing?.hideKidsContent,
    ),
    watchlist: Array.isArray(profile.watchlist)
      ? profile.watchlist
      : existing?.watchlist || [],
    watchProgress:
      profile.watchProgress && typeof profile.watchProgress === "object"
        ? profile.watchProgress
        : existing?.watchProgress || {},
    mediaPriorities:
      profile.mediaPriorities && typeof profile.mediaPriorities === "object"
        ? {
            movies: Math.min(
              100,
              Math.max(0, Number(profile.mediaPriorities.movies ?? 50)),
            ),
            tv: Math.min(
              100,
              Math.max(0, Number(profile.mediaPriorities.tv ?? 50)),
            ),
            books: Math.min(
              100,
              Math.max(0, Number(profile.mediaPriorities.books ?? 25)),
            ),
          }
        : existing?.mediaPriorities || { movies: 50, tv: 50, books: 25 },
    tasteVibe: profile.tasteVibe || existing?.tasteVibe || "balanced",
    themeDesign: profile.themeDesign || existing?.themeDesign || "oled_cinema",
    accentColor: profile.accentColor || existing?.accentColor || "gold-hashed",
    motionStyle: profile.motionStyle || existing?.motionStyle || "cinematic",
    curationWeights: profile.curationWeights || existing?.curationWeights || {},
    expiresAt: profile.expiresAt ?? existing?.expiresAt ?? null,
    guestVibeChoice:
      profile.guestVibeChoice || existing?.guestVibeChoice || null,
    favorites: Array.isArray(profile.favorites)
      ? profile.favorites
      : existing?.favorites || [],
    likes: Array.isArray(profile.likes) ? profile.likes : existing?.likes || [],
    cozy: Array.isArray(profile.cozy) ? profile.cozy : existing?.cozy || [],
    experienceVersion: Number(
      profile.experienceVersion ?? existing?.experienceVersion ?? 0,
    ),
    color: profile.color || existing?.color || null,
    atmosphere: profile.atmosphere ?? existing?.atmosphere ?? true,
    transparency: profile.transparency ?? existing?.transparency ?? true,
    motion: profile.motion || existing?.motion || null,
    density: profile.density || existing?.density || null,
    exploration: profile.exploration || existing?.exploration || null,
    reactions:
      profile.reactions && typeof profile.reactions === "object"
        ? profile.reactions
        : existing?.reactions || {},
    dismissedTasteIds: Array.isArray(profile.dismissedTasteIds)
      ? profile.dismissedTasteIds
      : existing?.dismissedTasteIds || [],
    lessLikeIds: Array.isArray(profile.lessLikeIds)
      ? profile.lessLikeIds
      : existing?.lessLikeIds || [],
    savedIds: Array.isArray(profile.savedIds)
      ? profile.savedIds
      : existing?.savedIds || [],
    progress:
      profile.progress && typeof profile.progress === "object"
        ? profile.progress
        : existing?.progress || {},
    bookProgress:
      profile.bookProgress && typeof profile.bookProgress === "object"
        ? profile.bookProgress
        : existing?.bookProgress || {},
    bookLocations:
      profile.bookLocations && typeof profile.bookLocations === "object"
        ? profile.bookLocations
        : existing?.bookLocations || {},
    bookBookmarks:
      profile.bookBookmarks && typeof profile.bookBookmarks === "object"
        ? profile.bookBookmarks
        : existing?.bookBookmarks || {},
    readingAppearance:
      profile.readingAppearance && typeof profile.readingAppearance === "object"
        ? {
            theme: ["dark", "sepia", "light", "slate"].includes(
              profile.readingAppearance.theme,
            )
              ? profile.readingAppearance.theme
              : "dark",
            fontSizeIndex: Math.min(
              4,
              Math.max(0, Number(profile.readingAppearance.fontSizeIndex ?? 1)),
            ),
          }
        : existing?.readingAppearance || { theme: "dark", fontSizeIndex: 1 },
    audioPreference:
      profile.audioPreference || existing?.audioPreference || "original",
    subtitleLanguage:
      profile.subtitleLanguage || existing?.subtitleLanguage || "English",
    maturity: profile.maturity || existing?.maturity || null,
    bedtime: profile.bedtime || existing?.bedtime || null,
    boundaries:
      profile.boundaries && typeof profile.boundaries === "object"
        ? profile.boundaries
        : existing?.boundaries || {},
    familyPlayback:
      profile.familyPlayback && typeof profile.familyPlayback === "object"
        ? {
            languageSeverity: ["off", "strong", "moderate", "mild"].includes(
              profile.familyPlayback.languageSeverity,
            )
              ? profile.familyPlayback.languageSeverity
              : "moderate",
            religiousLanguage: Boolean(
              profile.familyPlayback.religiousLanguage,
            ),
            audioTreatment:
              profile.familyPlayback.audioTreatment === "soften"
                ? "soften"
                : "mute",
            subtitleTreatment:
              profile.familyPlayback.subtitleTreatment === "replace"
                ? "replace"
                : "hide",
            exceptions: Array.isArray(profile.familyPlayback.exceptions)
              ? profile.familyPlayback.exceptions
                  .filter((item) => typeof item === "string")
                  .map((item) => item.trim())
                  .filter(Boolean)
                  .slice(0, 50)
              : [],
          }
        : existing?.familyPlayback || null,
    pinnedTitleIds: Array.isArray(profile.pinnedTitleIds)
      ? profile.pinnedTitleIds
      : existing?.pinnedTitleIds || [],
    hasCompletedMarqueePinning: Boolean(
      profile.hasCompletedMarqueePinning ??
      existing?.hasCompletedMarqueePinning ??
      false,
    ),
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  const filePath = path.join(targetDir, `${id}.json`);
  const persisted = safeWriteFileSync(
    filePath,
    JSON.stringify(merged, null, 2),
    "utf8",
  );
  if (!persisted) {
    throw new Error("Profile could not be saved because storage is full");
  }
  return merged;
}

/**
 * Deletes a non-primary profile.
 */
export function deleteProfile(id, dir = DEFAULT_PROFILES_DIR) {
  requireProfileId(id);
  const existing = getProfile(id, dir);
  if (id === "res-primary" || existing?.role === "owner") {
    return { ok: false, error: "Cannot delete primary household profile" };
  }
  const targetDir = ensureProfilesDir(dir);
  const filePath = path.join(targetDir, `${id}.json`);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { ok: true, deleted: id };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
  return { ok: false, error: "Profile not found" };
}

/**
 * Gets the current active profile ID.
 */
export function getActiveProfileId(dir = DEFAULT_PROFILES_DIR) {
  const targetDir = ensureProfilesDir(dir);
  const activeFile = path.join(targetDir, "active.json");
  try {
    if (fs.existsSync(activeFile)) {
      const data = JSON.parse(fs.readFileSync(activeFile, "utf8"));
      if (isValidProfileId(data?.activeId) && getProfile(data.activeId, dir)) return data.activeId;
    }
  } catch {}
  return null;
}

/**
 * Gets the current active profile object.
 */
export function getActiveProfile(dir = DEFAULT_PROFILES_DIR) {
  const activeId = getActiveProfileId(dir);
  return getProfile(activeId, dir);
}

export const getProfileById = getProfile;

/**
 * Sets the active profile ID.
 */
export function setActiveProfileId(id, dir = DEFAULT_PROFILES_DIR) {
  requireProfileId(id);
  if (!getProfile(id, dir)) throw new Error("Profile not found");
  const targetDir = ensureProfilesDir(dir);
  const activeFile = path.join(targetDir, "active.json");
  const persisted = safeWriteFileSync(
    activeFile,
    JSON.stringify({ activeId: id, updatedAt: Date.now() }, null, 2),
    "utf8",
  );
  if (!persisted) {
    console.warn(
      `[profile-service] Storage headroom exhausted (ENOSPC). Skipping active profile persistence for ${id}.`,
    );
    return {
      ok: false,
      activeId: id,
      persisted: false,
      warning: "Storage exhausted (ENOSPC)",
    };
  }
  return { ok: true, activeId: id, persisted: true };
}

/**
 * Blends multiple profile tastes for a shared party or guest session.
 * Does NOT overwrite or permanently change any individual user profile!
 */
export function blendProfiles(profileIds = [], dir = DEFAULT_PROFILES_DIR) {
  const allProfiles = listProfiles(dir);
  const selected =
    profileIds.length > 0
      ? allProfiles.filter((p) => profileIds.includes(p.id))
      : allProfiles.slice(0, 2);

  if (selected.length === 0) {
    return {
      name: "Group Session",
      mediaPriorities: { movies: 60, tv: 40, books: 0 },
      tasteVibe: "balanced",
      themeDesign: "oled_cinema",
      blendedFrom: [],
    };
  }

  const count = selected.length;
  const avgMovies = Math.round(
    selected.reduce((acc, p) => acc + (p.mediaPriorities?.movies ?? 50), 0) /
      count,
  );
  const avgTv = Math.round(
    selected.reduce((acc, p) => acc + (p.mediaPriorities?.tv ?? 50), 0) / count,
  );
  const avgBooks = Math.round(
    selected.reduce((acc, p) => acc + (p.mediaPriorities?.books ?? 25), 0) /
      count,
  );

  const vibes = selected.map((p) => p.tasteVibe || "balanced");
  const dominantVibe = vibes.includes("comfort")
    ? "comfort"
    : vibes[0] || "balanced";

  return {
    name: selected.map((p) => p.name).join(" & "),
    mediaPriorities: { movies: avgMovies, tv: avgTv, books: avgBooks },
    tasteVibe: dominantVibe,
    themeDesign: selected[0]?.themeDesign || "oled_cinema",
    blendedFrom: selected.map((p) => ({ id: p.id, name: p.name })),
  };
}

/**
 * Express / Node HTTP request router for /api/profiles
 */
export function getRequestActiveProfile(req, profilesDir = DEFAULT_PROFILES_DIR) {
  const session = readProfileSession(req, profilesDir);
  const device = getAuthorizedDevice(req, path.dirname(profilesDir));
  if (!device || session?.deviceId !== device.id || device.activeProfileId !== session.profileId) return null;
  return session?.profileId ? getProfile(session.profileId, profilesDir) : null;
}

export function getRequestProfileAuthorization(req, profilesDir = DEFAULT_PROFILES_DIR) {
  const profile = getRequestActiveProfile(req, profilesDir);
  const device = getAuthorizedDevice(req, path.dirname(profilesDir));
  return {
    authenticated: Boolean(profile),
    profileId: profile?.id || null,
    role: profile?.isKids ? "child" : profile?.role || (profile ? "member" : null),
    deviceAuthorized: Boolean(device),
  };
}

function pinAccepted(req, profile, pin, profilesDir) {
  const key = `${path.resolve(profilesDir)}:${profile.id}:${requestAddress(req)}`;
  const before = profilePinAttemptState(key);
  if (before.locked) {
    const error = new Error("Too many attempts. Try again shortly.");
    error.status = 429;
    error.code = "pin_locked";
    error.retryAfter = Math.max(1, Math.ceil(before.retryAfterMs / 1000));
    throw error;
  }
  const encoded = profile.pinHash || (profile.pin ? hashProfilePin(profile.pin) : "");
  const verified = verifyProfilePin(pin, encoded);
  recordProfilePinAttempt(key, verified);
  return verified;
}

const POLICY_FIELDS = ["pin", "isKids", "isGuest", "role", "maturity", "bedtime", "boundaries", "familyPlayback"];
const MANAGED_FIELDS = ["id", "name", "avatar", "color", ...POLICY_FIELDS];

export function getProfileSetupStatus(profilesDir = DEFAULT_PROFILES_DIR) {
  const stateFile = path.join(profilesDir, ".setup-state");
  try {
    const stored = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    if (stored.status === "complete" && Number.isFinite(stored.completedAt)) {
      return { status: "complete", completedAt: stored.completedAt };
    }
    throw new Error("Setup state needs recovery");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { status: listProfiles(profilesDir).length ? "in_progress" : "not_started", completedAt: null };
  }
}

export async function handleProfilesRoute(
  req,
  res,
  parsedUrl,
  profilesDir = DEFAULT_PROFILES_DIR,
  { intelligenceStore = null, onIntelligenceError } = {},
) {
  const pathname = parsedUrl.pathname;
  const method = (req.method || "GET").toUpperCase();
  const verifyPinMatch = pathname.match(/^\/api\/profiles\/([^/]+)\/verify-pin$/);
  const deleteMatch = pathname.match(/^\/api\/profiles\/([^/]+)$/);
  const known = pathname === "/api/profiles" || pathname === "/api/profiles/active"
    || pathname === "/api/profiles/progress"
    || pathname === "/api/profiles/reaction"
    || pathname === "/api/profiles/setup/complete"
    || pathname === "/api/profiles/blend" || verifyPinMatch || (deleteMatch && method === "DELETE");
  if (!known) return false;

  const send = (status, payload, headers = {}) => {
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers });
    res.end(JSON.stringify(payload));
  };
  const fail = (status, code, message) => { const error = new Error(message); error.status = status; error.code = code; throw error; };
  const authFor = (profile, bootstrapRequired = false, deviceAuthorized = false) => ({
    bootstrapRequired, authenticated: Boolean(profile), profileId: profile?.id || null,
    role: profile?.isKids ? "child" : profile?.role || (profile ? "member" : null),
    deviceAuthorized,
  });
  const processPayload = async (payload = {}) => {
    try {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) fail(400, "invalid_payload", "Invalid profile payload");
      const profiles = listProfiles(profilesDir);
      const stateDir = path.dirname(profilesDir);
      const device = getAuthorizedDevice(req, stateDir);
      const current = getRequestActiveProfile(req, profilesDir);
      const isOwner = current?.role === "owner" && !current.isKids;
      if (pathname === "/api/profiles" && method === "GET") {
        const setup = getProfileSetupStatus(profilesDir);
        const visibleProfiles = visibleProfilesForHome(profiles, setup);
        const visibleCurrent = visibleProfiles.find((profile) => profile.id === current?.id) || null;
        send(200, { ok: true, profiles: visibleProfiles.map((profile) => profile.id === visibleCurrent?.id ? publicProfile(profile) : profileSummary(profile)),
          activeId: visibleCurrent?.id || null, auth: authFor(visibleCurrent, visibleProfiles.length === 0, Boolean(device)), setup });
        return;
      }
      if (!isSameOriginProfileMutation(req, parsedUrl)) fail(403, "cross_origin_denied", "Use the ReelOS home connection to change profiles.");
      if (pathname === "/api/profiles/reaction") {
        if (method !== "POST") fail(405, "method_not_allowed", "Method not allowed");
        if (!current) fail(401, "profile_auth_required", "Open an authorized profile before saving a title reaction.");
        const fields = ["expectedProfileId", "titleId", "reaction"];
        if (Object.keys(payload).length !== fields.length || Object.keys(payload).some((key) => !fields.includes(key))) {
          fail(400, "invalid_payload", "A title reaction requires only expectedProfileId, titleId, and reaction.");
        }
        if (!isValidProfileId(payload.expectedProfileId)) fail(400, "invalid_payload", "Invalid expected profile ID.");
        // Assert the still-active identity; the caller cannot choose a write target.
        if (payload.expectedProfileId !== current.id) fail(403, "profile_changed", "The active profile changed. Open the title again before saving your reaction.");
        const { titleId, reaction } = payload;
        if (typeof titleId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(titleId)
          || ["constructor", "prototype"].includes(titleId)) {
          fail(400, "invalid_title_id", "Invalid reaction title ID.");
        }
        if (reaction !== null && !["like", "love", "cozy", "dismiss", "less"].includes(reaction)) {
          fail(400, "invalid_reaction", "Choose like, love, cozy, dismiss, less, or null to reset.");
        }
        const reactions = { ...current.reactions };
        delete reactions[titleId];
        const dismissedTasteIds = (Array.isArray(current.dismissedTasteIds) ? current.dismissedTasteIds : []).filter((id) => id !== titleId);
        const lessLikeIds = (Array.isArray(current.lessLikeIds) ? current.lessLikeIds : []).filter((id) => id !== titleId);
        // Match the private experience taste model: negative choices live in
        // their own lists, and each explicit choice replaces conflicting state.
        if (reaction === "dismiss") dismissedTasteIds.push(titleId);
        else if (reaction === "less") lessLikeIds.push(titleId);
        else if (reaction !== null) reactions[titleId] = reaction;
        const saved = { ...current, reactions, dismissedTasteIds, lessLikeIds, updatedAt: Date.now() };
        let persisted;
        try {
          persisted = safeWriteFileSync(path.join(profilesDir, `${current.id}.json`), JSON.stringify(saved, null, 2));
        } catch {
          fail(503, "reaction_save_failed", "Your title reaction could not be saved. Try again.");
        }
        if (!persisted) fail(507, "storage_full", "Your title reaction could not be saved because storage is full.");
        send(200, { ok: true, profileId: current.id, titleId, reaction, persisted: true });
        scheduleIntelligenceWork(recordIntelligenceEvent(intelligenceStore, {
          type: reaction === null ? "taste.reset" : "taste.set",
          source: "profile-service",
          profileId: current.id,
          privacyClass: "local-sensitive",
          occurredAt: saved.updatedAt,
          payload: { titleId, reaction },
        }, { onError: onIntelligenceError }), { onError: onIntelligenceError });
        return;
      }
      if (pathname === "/api/profiles/progress") {
        if (method !== "POST") fail(405, "method_not_allowed", "Method not allowed");
        if (!current) fail(401, "profile_auth_required", "Open an authorized profile before saving playback progress.");
        const fields = ["expectedProfileId", "titleId", "progress"];
        if (Object.keys(payload).length !== fields.length || Object.keys(payload).some((key) => !fields.includes(key))) {
          fail(400, "invalid_payload", "Playback progress requires only expectedProfileId, titleId, and progress.");
        }
        if (!isValidProfileId(payload.expectedProfileId)) fail(400, "invalid_payload", "Invalid expected profile ID.");
        // This assertion prevents a delayed save crossing a profile switch; it never selects the write target.
        if (payload.expectedProfileId !== current.id) fail(403, "profile_changed", "The active profile changed. Open playback again before saving progress.");
        const { titleId, progress } = payload;
        if (typeof titleId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(titleId)
          || ["constructor", "prototype"].includes(titleId)) {
          fail(400, "invalid_title_id", "Invalid playback title ID.");
        }
        if (typeof progress !== "number" || !Number.isFinite(progress) || progress < 0 || progress > 1) {
          fail(400, "invalid_progress", "Playback progress must be a number between 0 and 1.");
        }
        const saved = {
          ...current,
          progress: { ...current.progress, [titleId]: progress },
          watchProgress: { ...current.watchProgress, [titleId]: progress },
          updatedAt: Date.now(),
        };
        let persisted;
        try {
          persisted = safeWriteFileSync(path.join(profilesDir, `${current.id}.json`), JSON.stringify(saved, null, 2));
        } catch {
          fail(503, "progress_save_failed", "Playback progress could not be saved. Try again.");
        }
        if (!persisted) fail(507, "storage_full", "Playback progress could not be saved because storage is full.");
        send(200, { ok: true, profileId: current.id, titleId, progress, persisted: true });
        scheduleIntelligenceWork(recordIntelligenceEvent(intelligenceStore, {
          type: progress >= 0.9 ? "playback.completed" : "playback.progress",
          source: "profile-service",
          profileId: current.id,
          privacyClass: "local-sensitive",
          occurredAt: saved.updatedAt,
          payload: { titleId, progress },
        }, { onError: onIntelligenceError }), { onError: onIntelligenceError });
        return;
      }
      if (pathname === "/api/profiles" && method === "POST") {
        const bootstrap = profiles.length === 0;
        if (bootstrap) {
          const peer = req.socket?.remoteAddress || req.connection?.remoteAddress;
          const forwardedHeader = req.headers?.["x-forwarded-for"] || req.headers?.["x-real-ip"];
          const forwarded = Array.isArray(forwardedHeader) ? forwardedHeader[0] : String(forwardedHeader || "").split(",")[0].trim();
          const loopback = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(peer);
          const trustedHouseholdConnection = (!forwarded && isPrivateOrLanIp(peer)) ||
            (loopback && Boolean(forwarded) && isPrivateOrLanIp(forwarded));
          if (!device && !trustedHouseholdConnection) {
            fail(403, "local_bootstrap_required", "Start household setup from this home network.");
          }
        }
        if (!bootstrap && !current) fail(401, "profile_auth_required", "Open an authorized profile before making changes.");
        const existing = payload.id ? getProfile(payload.id, profilesDir) : null;
        if (bootstrap && (payload.isKids || payload.isGuest)) fail(409, "owner_required", "Create the adult household owner first.");
        if (!bootstrap && !isOwner) {
          if (!existing || existing.id !== current.id) fail(403, "owner_required", "The household owner must manage other profiles.");
          for (const key of POLICY_FIELDS) {
            if (Object.hasOwn(payload, key) && !isDeepStrictEqual(payload[key], existing[key])) {
              fail(403, "owner_required", "The household owner must change family protection.");
            }
          }
        }
        let update = { ...payload, role: bootstrap ? "owner" : existing?.role || "member" };
        if (existing && existing.id !== current?.id && !bootstrap) {
          update = Object.fromEntries(Object.entries(update).filter(([key]) => MANAGED_FIELDS.includes(key)));
        }
        if (existing?.role === "owner" && (payload.isKids || payload.isGuest)) fail(409, "owner_required", "The household owner must remain an adult profile.");
        const saved = saveProfile(update, profilesDir);
        const active = bootstrap ? saved : current;
        const headers = {};
        if (bootstrap) {
          const bootDevice = device || registerAuthorizedDevice({
            name: "Household setup device", ip: requestAddress(req), userAgent: req.headers?.["user-agent"], activeProfileId: saved.id,
          }, stateDir);
          setAuthorizedDeviceActiveProfile(bootDevice.id, saved.id, stateDir);
          const token = signDeviceToken(bootDevice, getGateSecret(stateDir));
          headers["Set-Cookie"] = [deviceTokenCookie(token, req), replaceProfileSession(req, profilesDir, saved.id, bootDevice.id).cookie];
        }
        send(200, { ok: true, profile: publicProfile(saved), activeId: active?.id || null,
          auth: authFor(active, false, true), setup: getProfileSetupStatus(profilesDir) }, headers);
        return;
      }
      if (pathname === "/api/profiles/setup/complete" && method === "POST") {
        if (!current) fail(401, "profile_auth_required", "Open the household owner profile to finish setup.");
        if (!isOwner) fail(403, "owner_required", "The household owner must finish setup.");
        const expected = payload.expectedProfileIds;
        if (!Array.isArray(expected) || !expected.length || new Set(expected).size !== expected.length
          || !expected.includes(current.id) || expected.some((id) => !isValidProfileId(id))) {
          fail(400, "invalid_setup_profiles", "Select the household profiles to finish setup.");
        }
        if (expected.some((id) => !profiles.some((profile) => profile.id === id))) fail(409, "setup_profiles_missing", "Save every household profile before finishing setup.");
        if (profiles.some((profile) => !profile.isGuest && !expected.includes(profile.id))) fail(409, "setup_roster_mismatch", "Review or remove every saved household member before finishing setup.");
        if (profiles.some((profile) => profile.isKids && !(profile.pinHash || profile.pin))) fail(409, "child_pin_required", "Protect every child profile with a family PIN before finishing setup.");
        const existingSetup = getProfileSetupStatus(profilesDir);
        const setup = existingSetup.status === "complete" ? existingSetup : { status: "complete", completedAt: Date.now() };
        if (!safeWriteFileSync(path.join(profilesDir, ".setup-state"), JSON.stringify(setup))) fail(507, "storage_full", "Setup could not be saved because storage is full.");
        send(200, { ok: true, setup, auth: authFor(current, false, true), activeId: current.id });
        return;
      }
      if (verifyPinMatch && method === "POST") {
        if (!device) fail(401, "device_auth_required", "Connect an authorized household device before entering a profile PIN.");
        const profile = getProfile(decodeURIComponent(verifyPinMatch[1]), profilesDir);
        if (!profile) fail(404, "profile_not_found", "Profile not found");
        const verified = pinAccepted(req, profile, payload.pin, profilesDir);
        const headers = {};
        if (verified) {
          const token = issueChildExitAuthorization(profile.id, req, profilesDir);
          headers["Set-Cookie"] = `${CHILD_EXIT_COOKIE}=${token}; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(CHILD_EXIT_AUTH_MS / 1000)}; Path=/api/profiles${isSecureRequest(req) ? "; Secure" : ""}`;
        }
        send(verified ? 200 : 401, { ok: verified, verified, ...(!verified ? { code: "pin_incorrect", error: "PIN was not accepted." } : {}) }, headers);
        return;
      }
      if (pathname === "/api/profiles/active" && method === "POST") {
        if (!device) fail(401, "device_auth_required", "Connect an authorized household device before opening a profile.");
        const target = getProfile(payload.id, profilesDir);
        if (!target) fail(404, "profile_not_found", "Profile not found");
        if (target.isKids && !(target.pinHash || target.pin)) fail(409, "child_pin_required", "Protect this child profile with a family PIN before opening it.");
        if (current?.id !== target.id) {
          const lockedProfile = current || (device.activeProfileId ? getProfile(device.activeProfileId, profilesDir) : null);
          if (lockedProfile?.isKids && (lockedProfile.pinHash || lockedProfile.pin) && target.id !== lockedProfile.id) {
            const exitAllowed = payload.exitPin !== undefined
              ? pinAccepted(req, lockedProfile, payload.exitPin, profilesDir)
              : consumeChildExitAuthorization(req, lockedProfile.id, profilesDir);
            if (!exitAllowed) fail(403, "child_exit_pin_required", "A family PIN is required to leave this child profile.");
          }
          if (!target.isKids && (target.pinHash || target.pin)) {
            const entryAllowed = payload.pin !== undefined
              ? pinAccepted(req, target, payload.pin, profilesDir)
              : consumeChildExitAuthorization(req, target.id, profilesDir);
            if (!entryAllowed) fail(403, "profile_pin_required", "Enter this person's PIN before opening the profile.");
          }
        }
        setAuthorizedDeviceActiveProfile(device.id, target.id, stateDir);
        const session = replaceProfileSession(req, profilesDir, target.id, device.id);
        send(200, { ok: true, profile: publicProfile(target), activeId: target.id,
          auth: authFor(target, false, true), setup: getProfileSetupStatus(profilesDir) }, { "Set-Cookie": session.cookie });
        return;
      }
      if (pathname === "/api/profiles/blend" && method === "POST") {
        if (!current) fail(401, "profile_auth_required", "Open an authorized profile first.");
        if (!Array.isArray(payload.profileIds) || payload.profileIds.some((id) => id !== current.id)) {
          fail(403, "participant_consent_required", "Other people must join before sharing their taste.");
        }
        send(200, { ok: true, blended: blendProfiles([current.id], profilesDir) });
        return;
      }
      if (deleteMatch && method === "DELETE") {
        if (!current) fail(401, "profile_auth_required", "Open an authorized profile first.");
        if (!isOwner) fail(403, "owner_required", "The household owner must delete profiles.");
        const result = deleteProfile(decodeURIComponent(deleteMatch[1]), profilesDir);
        if (result.ok) {
          await deleteIntelligenceProfile(intelligenceStore, result.deleted, {
            onError: onIntelligenceError,
          });
        }
        send(result.ok ? 200 : 400, result);
        return;
      }
      send(405, { ok: false, code: "method_not_allowed", error: "Method not allowed" });
    } catch (error) {
      send(error.status || (method === "GET" ? 503 : 400), {
        ok: false, code: error.code || "profile_request_failed", error: error.message,
      }, error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {});
    }
  };
  if (method !== "POST") { await processPayload(); return true; }
  let body = "";
  let tooLarge = false;
  req.on("data", (chunk) => {
    if (tooLarge) return;
    body += chunk;
    if (Buffer.byteLength(body) > 1024 * 1024) { tooLarge = true; body = ""; }
  });
  req.on("end", async () => {
    if (tooLarge) { send(413, { ok: false, code: "payload_too_large", error: "Profile update is too large" }); return; }
    try { await processPayload(JSON.parse(body || "{}")); }
    catch { send(400, { ok: false, code: "invalid_json", error: "Invalid profile payload" }); }
  });
  return true;
}
