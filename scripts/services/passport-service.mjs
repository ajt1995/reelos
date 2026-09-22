import fs from "node:fs";
import path from "node:path";
import {
  getRequestActiveProfile,
  getRequestProfileAuthorization,
  isValidProfileId,
  safeWriteFileSync,
  saveProfile,
} from "./profile-service.mjs";
import { isSameOriginProfileMutation } from "./profile-session-service.mjs";
import { getMediaStrategy, saveMediaStrategy } from "./media-strategy-service.mjs";

const DEFAULT_STATE_DIR = process.env.REELOS_STATE || (process.platform === "win32" ? path.join(process.cwd(), ".reelos-state") : "/var/lib/reelos");
const PASSPORT_VERSION = 1;
const MAX_PASSPORT_BYTES = 1024 * 1024;
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const isText = (value) => typeof value === "string" && value.length <= 4096;
const isBoolean = (value) => typeof value === "boolean";
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const isProgress = (value) => isNumber(value) && value >= 0 && value <= 1;
const isTextList = (value) => Array.isArray(value) && value.length <= 10000 && value.every(isText);
const isSafeKey = (key) => !/^(?:__proto__|prototype|constructor)$/i.test(key)
  && !/(?:password|secret|token|credential|api.?key|pin(?:hash)?$)/i.test(key);
const isMapOf = (check) => (value) => isRecord(value) && Object.keys(value).length <= 10000
  && Object.entries(value).every(([key, item]) => isText(key) && isSafeKey(key) && check(item));
const oneOf = (...values) => (value) => values.includes(value);
const isFields = (fields) => (value) => isRecord(value)
  && Object.entries(value).every(([key, item]) => Object.hasOwn(fields, key) && fields[key](item));

// An explicit data schema keeps current and future account, credential, and
// child-protection fields outside the portable personalization format.
const PERSONAL_FIELDS = {
  name: isText, avatar: isText, color: isText, hideKidsContent: isBoolean,
  watchlist: isTextList, watchProgress: isMapOf(isProgress),
  mediaPriorities: isFields({ movies: (n) => isNumber(n) && n >= 0 && n <= 100,
    tv: (n) => isNumber(n) && n >= 0 && n <= 100, books: (n) => isNumber(n) && n >= 0 && n <= 100 }),
  tasteVibe: isText, themeDesign: isText, accentColor: isText, motionStyle: isText,
  curationWeights: isMapOf(isNumber), guestVibeChoice: isText,
  favorites: isTextList, likes: isTextList, cozy: isTextList,
  experienceVersion: (n) => Number.isInteger(n) && n >= 0 && n <= 2,
  atmosphere: isBoolean, transparency: isBoolean,
  motion: oneOf("still", "subtle", "expressive"), density: oneOf("comfortable", "compact"),
  exploration: oneOf("familiar", "balanced", "adventurous"),
  reactions: isMapOf(oneOf("like", "love", "cozy")), dismissedTasteIds: isTextList,
  lessLikeIds: isTextList, savedIds: isTextList, progress: isMapOf(isProgress),
  bookProgress: isMapOf(isProgress), bookLocations: isMapOf(isText), bookBookmarks: isMapOf(isTextList),
  readingAppearance: isFields({ theme: oneOf("dark", "sepia", "light", "slate"),
    fontSizeIndex: (n) => Number.isInteger(n) && n >= 0 && n <= 4 }),
  audioPreference: oneOf("original", "dub", "sub"), subtitleLanguage: isText,
  pinnedTitleIds: isTextList, hasCompletedMarqueePinning: isBoolean,
};
const ANSWER_FIELDS = { houseName: (value) => isText(value) && value.length <= 160 };
const STRATEGY_FIELDS = {
  mode: oneOf("smart_hybrid", "cloud_stream", "offline_download"),
  storageAllocation: oneOf("dynamic_20", "fixed"),
  allocatedGb: (n) => isNumber(n) && n >= 0 && n <= 1000000,
  autoDownloadFavorites: isBoolean, autoDownloadWatchlist: isBoolean, autoDownloadCabinVault: isBoolean,
};

function fail(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}

function passportIdentity(req, stateDir, ownerOnly = false) {
  const profilesDir = path.join(stateDir, "profiles");
  const authorization = getRequestProfileAuthorization(req || {}, profilesDir);
  if (!authorization.authenticated || !authorization.deviceAuthorized) {
    fail(401, "profile_auth_required", "Open an authorized profile before using a passport.");
  }
  if (ownerOnly && authorization.role !== "owner") {
    fail(403, "owner_required", "The household owner must manage home settings and USB exports.");
  }
  const profile = getRequestActiveProfile(req, profilesDir);
  if (!profile) fail(401, "profile_auth_required", "Open an authorized profile before using a passport.");
  return { profile, profilesDir, isOwner: authorization.role === "owner" };
}

function fieldsFrom(value, schema, strict = false) {
  if (!isRecord(value)) fail(400, "invalid_passport", "Invalid passport data.");
  if (strict && Object.keys(value).some((key) => !Object.hasOwn(schema, key))) {
    fail(400, "unsupported_passport_fields", "Passports cannot change account access, family protection, credentials, or shared history. Export a new personal passport.");
  }
  const result = {};
  for (const [key, check] of Object.entries(schema)) {
    if (!Object.hasOwn(value, key)) continue;
    if (check(value[key])) result[key] = value[key];
    else if (strict) fail(400, "invalid_passport", `Invalid passport field: ${key}.`);
  }
  return result;
}

function readAnswers(stateDir) {
  try {
    const answers = JSON.parse(fs.readFileSync(path.join(stateDir, "answers.json"), "utf8"));
    if (!isRecord(answers)) throw new Error("Home settings need recovery before using a passport.");
    return answers;
  } catch (error) {
    if (error.code === "ENOENT") return {};
    fail(503, "home_settings_unavailable", "Home settings need recovery before using a passport.");
  }
}

function passportFailure(error) {
  return { ok: false, status: error.status || 400, code: error.code || "passport_request_failed",
    error: error.status ? error.message : "Passport request could not be completed." };
}

// Export only portable preferences from older strategy files, which sometimes
// also contained credentials or device paths. This read never authorizes disk
// work: imports still pass through the strict current policy and budget gate.
function portableStrategy(stateDir) {
  try {
    const file = path.join(stateDir, "media-strategy.json");
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536) throw new Error("Invalid strategy file");
    return fieldsFrom(JSON.parse(fs.readFileSync(file, "utf8")), STRATEGY_FIELDS);
  } catch (error) {
    if (error.code === "ENOENT") return fieldsFrom(getMediaStrategy(stateDir), STRATEGY_FIELDS);
    fail(503, "strategy_unavailable", "Storage preferences need recovery before passport export.");
  }
}

/**
 * Builds a passport for the authenticated person only. includeSecrets from old
 * callers is deliberately ignored: passports never transport credentials.
 */
export function generatePassportEnvelope({ stateDir = DEFAULT_STATE_DIR, req } = {}) {
  const { profile, isOwner } = passportIdentity(req, stateDir);
  const answers = isOwner ? fieldsFrom(readAnswers(stateDir), ANSWER_FIELDS) : {};
  return {
    reelosPassportVersion: PASSPORT_VERSION,
    scope: "profile",
    exportedAt: Date.now(),
    applianceName: answers.houseName || "Living Room",
    profiles: [{ id: profile.id, ...fieldsFrom(profile, PERSONAL_FIELDS) }],
    activeProfileId: profile.id,
    ...(isOwner ? { mediaStrategy: portableStrategy(stateDir), answers } : {}),
  };
}

/**
 * Restores personalization into the authenticated profile. Source identifiers
 * are metadata, never a destination path or a request to switch identity.
 */
export function restorePassportEnvelope(envelope = {}, { stateDir = DEFAULT_STATE_DIR, req } = {}) {
  try {
    const { profile, profilesDir, isOwner } = passportIdentity(req, stateDir);
    if (!isRecord(envelope) || envelope.reelosPassportVersion !== PASSPORT_VERSION) {
      fail(400, "invalid_passport", "Invalid ReelOS Passport format or unsupported version");
    }
    if (Buffer.byteLength(JSON.stringify(envelope)) > MAX_PASSPORT_BYTES) {
      fail(413, "payload_too_large", "Passport is too large.");
    }
    const allowed = ["reelosPassportVersion", "scope", "exportedAt", "applianceName", "profiles", "activeProfileId", "answers", "mediaStrategy"];
    if (Object.keys(envelope).some((key) => !allowed.includes(key)) || (envelope.scope && envelope.scope !== "profile")) {
      fail(400, "unsupported_passport_fields", "Import a personal passport without shared household history.");
    }
    if (!Array.isArray(envelope.profiles) || envelope.profiles.length !== 1) {
      fail(400, "single_profile_required", "Import one person's passport into their open profile.");
    }
    const imported = fieldsFrom(envelope.profiles[0], { id: isValidProfileId, ...PERSONAL_FIELDS }, true);
    if (!imported.id || (envelope.activeProfileId !== undefined && envelope.activeProfileId !== imported.id)) {
      fail(400, "invalid_passport", "Passport profile identifiers do not match.");
    }
    const hasAnswers = Object.hasOwn(envelope, "answers");
    const hasStrategy = Object.hasOwn(envelope, "mediaStrategy");
    if (!isOwner && (hasAnswers || hasStrategy)) {
      fail(403, "owner_required", "The household owner must import home settings.");
    }
    // Validate the entire envelope before saving any profile or home changes.
    const answers = hasAnswers ? fieldsFrom(envelope.answers, ANSWER_FIELDS, true) : null;
    const strategy = hasStrategy ? fieldsFrom(envelope.mediaStrategy, STRATEGY_FIELDS, true) : null;
    const nextAnswers = answers ? { ...readAnswers(stateDir), ...answers } : null;
    if (strategy) {
      const result = saveMediaStrategy(strategy, stateDir, { authorize: () => {
        const current = passportIdentity(req, stateDir, true);
        if (current.profile.id !== profile.id) fail(403, "profile_changed", "The active profile changed before importing home preferences.");
      } });
      if (!result.ok) throw new Error(result.error || "Media preferences could not be saved.");
    }
    saveProfile({ ...imported, id: profile.id }, profilesDir);
    if (nextAnswers && !safeWriteFileSync(path.join(stateDir, "answers.json"), JSON.stringify(nextAnswers, null, 2) + "\n")) {
      fail(507, "storage_full", "Home settings could not be saved because storage is full.");
    }
    return { ok: true, restored: {
      profilesCount: 1, activeProfileId: profile.id,
      applianceName: fieldsFrom(nextAnswers || {}, ANSWER_FIELDS).houseName || "Living Room",
      hasAnswers: Boolean(answers && Object.keys(answers).length),
    } };
  } catch (error) {
    return passportFailure(error);
  }
}

/**
 * Copies a personal passport and available setup launchers onto a USB drive.
 */
export function exportToUsbThumbStick({ usbMountPath, stateDir = DEFAULT_STATE_DIR, repoRoot = process.cwd(), req } = {}) {
  try {
    passportIdentity(req, stateDir, true);
    if (!usbMountPath || !fs.existsSync(usbMountPath) || !fs.statSync(usbMountPath).isDirectory()) {
      return { ok: false, status: 400, error: "USB mount path does not exist" };
    }
    // 1. Generate passport
    const envelope = generatePassportEnvelope({ stateDir, req });
    const passportDest = path.join(usbMountPath, "reelos-passport.json");
    fs.writeFileSync(passportDest, JSON.stringify(envelope, null, 2) + "\n");

    // 2. Copy launcher scripts if available
    const batSrc = path.join(repoRoot, "reelos-setup.bat");
    const ps1Src = path.join(repoRoot, "scripts", "reelos-windows-launcher.ps1");

    let launchersCopied = false;
    if (fs.existsSync(batSrc)) {
      fs.copyFileSync(batSrc, path.join(usbMountPath, "reelos-setup.bat"));
      launchersCopied = true;
    }
    if (fs.existsSync(ps1Src)) {
      const scriptsDir = path.join(usbMountPath, "scripts");
      if (!fs.existsSync(scriptsDir)) fs.mkdirSync(scriptsDir, { recursive: true });
      fs.copyFileSync(ps1Src, path.join(scriptsDir, "reelos-windows-launcher.ps1"));
    }

    // 3. Write friendly readme
    const readmeDest = path.join(usbMountPath, "PORTABLE_REELOS_STICK.txt");
    const readme = [
      "================================================================================",
      "                    ReelOS Portable Media Server Thumb Stick                    ",
      "================================================================================",
      "",
      "This USB drive carries your own ReelOS Passport (taste, history,",
      "and non-secret media preferences). Credentials and other profiles are excluded.",
      "",
      "HOW TO PLAY AT A FRIEND'S HOUSE:",
      "  1. Plug this USB drive into any Windows PC.",
      "  2. Double-click 'reelos-setup.bat'.",
      "  3. Finish setup, open your profile, and import reelos-passport.json.",
      "",
      "HOW TO USE ON BARE METAL (MINI PC / N100):",
      "  Install ReelOS on the target PC, then import the passport into your profile.",
      "  This export copies a passport and available launchers; it is not bootable media.",
      "",
      `Passport generated: ${new Date(envelope.exportedAt).toISOString()}`,
      `Appliance: ${envelope.applianceName}`,
      `Profiles: ${envelope.profiles.map((p) => p.name).join(", ")}`,
      "================================================================================",
    ].join("\r\n");
    fs.writeFileSync(readmeDest, readme);

    return {
      ok: true,
      passportPath: passportDest,
      launchersCopied,
      profilesCount: envelope.profiles.length,
    };
  } catch (err) {
    return passportFailure(err);
  }
}

/**
 * Google Drive remains unavailable until a real OAuth-backed adapter is wired.
 * These functions intentionally fail closed instead of storing an email and
 * presenting a fabricated synchronization result.
 */
export function getGoogleDriveStatus() {
  return {
    ok: false,
    available: false,
    linked: false,
    accountEmail: null,
    lastSyncTime: null,
    syncStatus: "unavailable",
    error: "Google Drive synchronization is not connected in this build.",
  };
}

export function setGoogleDriveLink() {
  return getGoogleDriveStatus();
}

/**
 * HTTP Router for /api/passport/*
 */
export async function handlePassportRoute(req, res, parsedUrl, readBodyFn, stateDir = DEFAULT_STATE_DIR) {
  const method = (req.method || "GET").toUpperCase();
  const pathname = parsedUrl.pathname;
  const routes = {
    "/api/passport/export": "GET", "/api/passport/import": "POST", "/api/passport/usb-export": "POST",
    "/api/passport/google-status": "GET", "/api/passport/google-sync": "POST",
    "/api/passport/google/auth-url": "GET", "/api/passport/google/callback": "POST", "/api/passport/google/auto-sync": "POST",
  };
  if (!Object.hasOwn(routes, pathname)) return false;
  const send = (status, payload, headers = {}) => {
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers });
    res.end(JSON.stringify(payload, null, 2));
  };
  try {
    if (routes[pathname] !== method) fail(405, "method_not_allowed", "Method not allowed");
    passportIdentity(req, stateDir, pathname === "/api/passport/usb-export"
      || (pathname.includes("google") && pathname !== "/api/passport/google-status"));
    if (method !== "GET" && !isSameOriginProfileMutation(req, parsedUrl)) {
      fail(403, "cross_origin_denied", "Use the ReelOS home connection to import or export a passport.");
    }
    if (pathname === "/api/passport/export") {
      send(200, generatePassportEnvelope({ stateDir, req }), {
        "Content-Disposition": 'attachment; filename="reelos-passport.json"',
      });
      return true;
    }
    const body = method === "POST" ? (typeof readBodyFn === "function" ? await readBodyFn(req) : req.body || {}) : {};
    if (!isRecord(body)) fail(400, "invalid_payload", "Invalid passport request.");
    if (pathname === "/api/passport/import") {
      const result = restorePassportEnvelope(body, { stateDir, req });
      send(result.ok ? 200 : result.status || 400, result);
    } else if (pathname === "/api/passport/usb-export") {
      const result = exportToUsbThumbStick({ usbMountPath: body.usbMountPath, stateDir, repoRoot: process.cwd(), req });
      send(result.ok ? 200 : result.status || 400, result);
    } else if (pathname === "/api/passport/google/auth-url") {
      send(501, { ok: false, available: false, error: "Google Drive OAuth is not connected in this build." });
    } else {
      send(501, getGoogleDriveStatus());
    }
  } catch (error) {
    const result = passportFailure(error);
    send(result.status, result);
  }
  return true;
}

export function getGoogleAuthUrl({ redirectUri = "http://localhost:8080/settings" } = {}) {
  void redirectUri;
  return null;
}

export function exchangeGoogleAuthCode() {
  return getGoogleDriveStatus();
}

export function smartAutoSyncCheck() {
  return { ...getGoogleDriveStatus(), synced: false };
}
