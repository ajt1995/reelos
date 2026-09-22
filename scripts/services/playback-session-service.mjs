import fs from "node:fs";
import path from "node:path";
import { featureCollisionArbiter } from "./feature-collision-arbiter.mjs";
import { getRequestActiveProfile, getProfile, listProfiles } from "./profile-service.mjs";
import { getAuthorizedDevice } from "./reelos-gate-service.mjs";
import { isSameOriginProfileMutation } from "./profile-session-service.mjs";
import { updatePreparationBlockingSession, endPreparationBlockingSession } from "./preparation-activity.mjs";
import { recordIntelligenceEvent, scheduleIntelligenceWork } from "./intelligence-event-recorder.mjs";
import { loadFamilyTreatmentManifest, localEditionFingerprint, remoteEditionFingerprint } from "./family-treatment-service.mjs";

const DEFAULT_STATE_DIR =
  process.env.REELOS_STATE ||
  (process.platform === "win32"
    ? path.join(process.cwd(), ".reelos-state")
    : "/var/lib/reelos");

function readJellyfinToken(stateDir = DEFAULT_STATE_DIR) {
  try {
    const p = path.join(stateDir, "jellyfin.token");
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8").trim();
  } catch {}
  return "";
}

const BLOCKED_RATINGS = new Set(["R", "NC-17", "TV-MA", "MA", "18+", "X"]);
const MATURITY_LIMITS = {
  little: new Set(["PG-13", "TV-14", ...BLOCKED_RATINGS]),
  big: BLOCKED_RATINGS,
  teen: new Set(["NC-17", "TV-MA", "MA", "18+", "X"]),
  mature: new Set(["NC-17", "18+", "X"]),
};
const SEVERITY = { off: 0, strong: 1, moderate: 2, mild: 3 };
const KNOWN_RATINGS = new Set(["G", "PG", "PG-13", "R", "NC-17", "TV-Y", "TV-Y7", "TV-Y7-FV", "TV-G", "TV-PG", "TV-14", "TV-MA", "MA", "18+", "X"]);
const playbackSessions = new Map();
const SESSION_IDLE_MS = 12 * 60 * 60 * 1000;

export function playbackPresenceKey(deviceId, playSessionId) {
  return `playback:${deviceId}:${playSessionId}`;
}

function validMediaId(value) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(value);
}

function playbackFailure(status, code, error) {
  return { ok: false, status, code, error };
}

export function resolveFamilyPlaybackPolicy({
  activeProfile,
  presentProfiles = [],
  item = {},
} = {}) {
  const participants = new Map();
  if (activeProfile?.isKids) participants.set(activeProfile.id, activeProfile);
  for (const profile of presentProfiles) {
    if (profile?.isKids && profile.id) participants.set(profile.id, profile);
  }
  const children = [...participants.values()];
  if (children.length === 0) return { required: false, children: [] };

  const itemId = String(item.Id || item.id || "");
  const itemTitle = String(item.Name || item.name || item.title || "").trim().toLowerCase();
  const exceptions = children.every((profile) =>
    (profile.familyPlayback?.exceptions || []).some((entry) => {
      const normalized = String(entry).trim().toLowerCase();
      return normalized && (normalized === itemId.toLowerCase() || normalized === itemTitle);
    }),
  );
  const policies = children.map((profile) => profile.familyPlayback).filter(Boolean);
  const severity = policies.reduce(
    (level, policy) => Math.max(level, SEVERITY[policy.languageSeverity] ?? 0),
    0,
  );
  const languageSeverity = Object.entries(SEVERITY).find(([, value]) => value === severity)?.[0] || "off";

  return {
    required: !exceptions,
    exceptionApplied: exceptions,
    children: children.map((profile) => ({ id: profile.id, name: profile.name })),
    maturity: children.map((profile) => profile.maturity || "big"),
    languageSeverity,
    religiousLanguage: policies.some((policy) => policy.religiousLanguage),
    audioTreatment: policies.some((policy) => policy.audioTreatment === "mute") ? "mute" : "soften",
    subtitleTreatment: policies.some((policy) => policy.subtitleTreatment === "hide") ? "hide" : "replace",
  };
}

export function verifyFamilyTitle(policy, item = {}) {
  if (!policy?.required) return { allowed: true };
  const rating = String(item.OfficialRating || item.officialRating || item.rating || "").toUpperCase().trim();
  if (!KNOWN_RATINGS.has(rating)) {
    return { allowed: false, reason: "This title has no verified maturity rating." };
  }
  for (const maturity of policy.maturity || ["big"]) {
    const blocked = MATURITY_LIMITS[maturity] || MATURITY_LIMITS.big;
    if (blocked.has(rating)) {
      return { allowed: false, reason: `Rating ${rating} exceeds a participating child's boundary.` };
    }
  }
  return { allowed: true, rating };
}

/**
 * Registers authenticated local-file sessions, or forwards remote playback
 * keepalives to Jellyfin so its transcode watchdog does not stop active playback.
 */
export async function forwardPlaybackSession(
  action,
  body = {},
  {
    jellyfinUrl = "http://127.0.0.1:8096",
    stateDir = DEFAULT_STATE_DIR,
    token = "",
    request,
    profilesDir = process.env.REELOS_PROFILES_DIR || path.join(stateDir, "profiles"),
    presenceService,
  } = {}
) {
  if (!["start", "progress", "stop"].includes(action)) return playbackFailure(400, "invalid_action", "Unknown playback action.");
  if (!request) return playbackFailure(401, "profile_auth_required", "Open an authorized profile before controlling playback.");
  let activeProfile, device;
  try {
    activeProfile = getRequestActiveProfile(request, profilesDir);
    device = getAuthorizedDevice(request, path.dirname(profilesDir));
  } catch { return playbackFailure(503, "profile_unavailable", "Profile authorization could not be verified."); }
  if (!activeProfile || !device) return playbackFailure(401, "profile_auth_required", "Open an authorized profile before controlling playback.");
  if (!body || typeof body !== "object" || Array.isArray(body) || !validMediaId(body.itemId) || !validMediaId(body.playSessionId)
    || (body.mediaSourceId !== undefined && !validMediaId(body.mediaSourceId))) {
    return playbackFailure(400, "invalid_playback_session", "A valid title and playback session are required.");
  }
  if (body.positionTicks !== undefined && (!Number.isSafeInteger(body.positionTicks) || body.positionTicks < 0)) {
    return playbackFailure(400, "invalid_position", "Playback position must be a non-negative integer.");
  }
  if (body.durationTicks !== undefined && (!Number.isSafeInteger(body.durationTicks) || body.durationTicks < 0)) {
    return playbackFailure(400, "invalid_duration", "Playback duration must be a non-negative integer.");
  }
  const now = Date.now();
  for (const [key, session] of playbackSessions) {
    if (now - session.lastSeenAt > SESSION_IDLE_MS) {
      playbackSessions.delete(key);
      endPreparationBlockingSession(key);
    }
  }
  const sessionKey = `${path.resolve(profilesDir)}:${body.playSessionId}`;
  const previous = playbackSessions.get(sessionKey);
  if (previous && (previous.profileId !== activeProfile.id || previous.deviceId !== device.id
    || previous.itemId !== body.itemId || previous.mediaSourceId !== (body.mediaSourceId || body.itemId))) {
    return playbackFailure(403, "playback_session_forbidden", "This playback session belongs to another person or device.");
  }
  if (action !== "start" && !previous) return playbackFailure(409, "playback_session_not_started", "Start this playback session again before sending progress.");
  if (previous?.pending) return playbackFailure(409, "playback_session_pending", "This playback session is still starting.");
  if (!previous && playbackSessions.size >= 1024) return playbackFailure(503, "playback_sessions_full", "Too many playback sessions are active. Try again shortly.");
  const ownedSession = previous || {
    deviceId: device.id, profileId: activeProfile.id, itemId: body.itemId,
    mediaSourceId: body.mediaSourceId || body.itemId, lastSeenAt: now, pending: true,
  };
  if (!previous) playbackSessions.set(sessionKey, ownedSession);
  const failSession = (result) => {
    if (!previous && playbackSessions.get(sessionKey) === ownedSession) playbackSessions.delete(sessionKey);
    return result;
  };
  try {
    // The server library, never a client engine/path flag, selects local playback.
    // Import lazily because playback access shares the family policy helpers above.
    const access = await import("./playback-access-service.mjs");
    const accessOptions = { stateDir, profilesDir, presenceService };
    const candidates = access.readPlaybackLibraryItems(accessOptions)
      .filter((item) => access.playbackItemId(item) === body.itemId);
    const local = previous?.engine === "local-file" || (!previous && candidates.some((item) => item.path || item.Path));
    if (local) {
      let authorization;
      if (action !== "stop") {
        const item = access.resolvePlaybackItem({ kind: "id", value: body.itemId }, accessOptions);
        authorization = access.authorizePlaybackItem(request, item, accessOptions);
        if (!authorization.ok) return failSession(authorization);
        const file = access.verifiedPlaybackFile(item);
        if (!file) return failSession(playbackFailure(404, "playback_file_unavailable", "This title's local media file is not available."));
        if (ownedSession.mediaSourceId !== body.itemId) {
          return failSession(playbackFailure(400, "invalid_media_source", "The local media source must match this title."));
        }
        if (previous && (previous.engine !== "local-file" || previous.file !== file)) {
          return failSession(playbackFailure(409, "playback_source_changed", "This title's media source changed. Start playback again."));
        }
        ownedSession.file = file;
        if (authorization.familyPolicy?.required) {
          const expected = {
            itemId: body.itemId,
            mediaSourceId: ownedSession.mediaSourceId,
            editionFingerprint: localEditionFingerprint(file),
            durationTicks: body.durationTicks,
          };
          const treatment = loadFamilyTreatmentManifest(expected, { stateDir });
          if (!treatment.ok) return failSession({
            ...playbackFailure(503, treatment.code, treatment.error),
            familyPolicy: authorization.familyPolicy,
          });
          ownedSession.familyTreatment = treatment.manifest;
        } else {
          ownedSession.familyTreatment = null;
        }
      }
      const stillActive = getRequestActiveProfile(request, profilesDir);
      if (stillActive?.id !== activeProfile.id) return failSession(playbackFailure(403, "playback_identity_changed", "The active person changed before playback could be acknowledged."));
      ownedSession.engine = "local-file";
      ownedSession.pending = false;
      ownedSession.lastSeenAt = Date.now();
      if (body.positionTicks !== undefined) ownedSession.positionTicks = body.positionTicks;
      if (body.durationTicks !== undefined) ownedSession.durationTicks = body.durationTicks;
      ownedSession.isPaused = Boolean(body.isPaused);
      if (action === "stop") {
        playbackSessions.delete(sessionKey);
        endPreparationBlockingSession(sessionKey);
      } else if (playbackSessions.get(sessionKey) === ownedSession) {
        updatePreparationBlockingSession(sessionKey, ownedSession.lastSeenAt + SESSION_IDLE_MS);
      }
      return {
        ok: true, status: 200, engine: "local-file", mode: "direct-play",
        profileId: activeProfile.id, playSessionId: body.playSessionId,
        presenceKey: playbackPresenceKey(device.id, body.playSessionId),
        ...(ownedSession.positionTicks !== undefined ? { positionTicks: ownedSession.positionTicks } : {}),
        ...(authorization?.familyPolicy?.required ? {
          familyPolicy: { ...authorization.familyPolicy, enforcement: "verified-treatment-manifest" },
          familyTreatment: ownedSession.familyTreatment,
        } : {}),
      };
    }
  } catch {
    return failSession(playbackFailure(503, "playback_source_unavailable", "This title's local media source could not be verified."));
  }
  const tok = token || readJellyfinToken(stateDir);
  const endpoint =
    action === "start"
      ? "/Sessions/Playing"
      : action === "progress"
        ? "/Sessions/Playing/Progress"
        : "/Sessions/Playing/Stopped";

  const headers = {
    "Content-Type": "application/json",
  };
  if (tok) {
    headers["X-Emby-Token"] = tok;
    headers["Authorization"] =
      `MediaBrowser Client="ReelOS", Device="ReelOS", DeviceId="${device.id}", Version="2.5.0", Token="${tok}"`;
  }

  const payload = {
    ItemId: body.itemId,
    MediaSourceId: body.mediaSourceId || body.itemId,
    PlaySessionId: body.playSessionId,
    CanSeek: true,
  };

  if (action === "progress" || action === "stop") {
    if (body.positionTicks !== undefined && body.positionTicks !== null) {
      payload.PositionTicks = Number(body.positionTicks) || 0;
    } else if (action === "progress") {
      payload.PositionTicks = 0;
    }
    if (action === "progress") {
      payload.IsPaused = Boolean(body.isPaused);
    }
  }
  let familyPolicy;
  let familyTreatment = null;
  if (action !== "stop") {
    try {
      const childProfileService = presenceService || (await import("./child-profile-service.mjs")).childProfileService;
      const presence = childProfileService.getRoomPresence(playbackPresenceKey(device.id, body.playSessionId)).state;
      const presentProfiles = presence.kidsPresent
        ? (presence.childProfileIds?.length
            ? presence.childProfileIds.map((id) => getProfile(id, profilesDir))
            : listProfiles(profilesDir).filter((profile) => profile.isKids))
        : [];
      if (presence.kidsPresent && (presentProfiles.length === 0 || presentProfiles.some((profile) => !profile?.isKids))) {
        return failSession(playbackFailure(503, "family_presence_unavailable", "The children watching could not be verified."));
      }
      const needsFamilyCheck = activeProfile?.isKids || presentProfiles.length > 0;
      if (needsFamilyCheck) {
        if (!ownedSession.item) {
          const itemRes = await fetch(`${jellyfinUrl}/Items/${encodeURIComponent(body.itemId)}`, { headers, signal: AbortSignal.timeout(4000) });
          if (!itemRes.ok) return failSession(playbackFailure(503, "family_title_unavailable", "ReelOS could not verify this title for the children watching."));
          const verifiedItem = await itemRes.json();
          if (String(verifiedItem.Id || verifiedItem.id || "") !== body.itemId) {
            return failSession(playbackFailure(503, "family_title_mismatch", "The title's maturity information could not be verified."));
          }
          ownedSession.item = verifiedItem;
        }
        const item = ownedSession.item;
        familyPolicy = resolveFamilyPlaybackPolicy({ activeProfile, presentProfiles, item });
        const access = verifyFamilyTitle(familyPolicy, item);
        if (!access.allowed) return failSession({ ...playbackFailure(403, "family_title_denied", access.reason), familyPolicy });
        if (familyPolicy.required) {
          const editionFingerprint = remoteEditionFingerprint(item, ownedSession.mediaSourceId);
          if (!editionFingerprint) return failSession({
            ...playbackFailure(503, "family_edition_unverified", "This exact edition could not be verified for family treatment."),
            familyPolicy,
          });
          const treatment = loadFamilyTreatmentManifest({
            itemId: body.itemId,
            mediaSourceId: ownedSession.mediaSourceId,
            editionFingerprint,
            durationTicks: body.durationTicks || item.RunTimeTicks,
          }, { stateDir });
          if (!treatment.ok) return failSession({ ...playbackFailure(503, treatment.code, treatment.error), familyPolicy });
          familyTreatment = treatment.manifest;
          ownedSession.familyTreatment = familyTreatment;
        }
      }
    } catch (err) {
      return failSession(playbackFailure(503, "family_policy_unavailable", "ReelOS could not verify the family playback boundary."));
    }
  }

  try {
    const stillActive = getRequestActiveProfile(request, profilesDir);
    if (stillActive?.id !== activeProfile.id) return failSession(playbackFailure(403, "playback_identity_changed", "The active person changed before playback could be acknowledged."));
    const res = await fetch(`${jellyfinUrl}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return failSession(playbackFailure(res.status, "playback_service_rejected", "The media service could not acknowledge this playback session."));
    ownedSession.pending = false;
    ownedSession.lastSeenAt = Date.now();
    if (action === "stop") {
      playbackSessions.delete(sessionKey);
      endPreparationBlockingSession(sessionKey);
    } else if (playbackSessions.get(sessionKey) === ownedSession) {
      updatePreparationBlockingSession(sessionKey, ownedSession.lastSeenAt + SESSION_IDLE_MS);
    }
    return {
      ok: res.ok,
      status: res.status,
      profileId: activeProfile.id,
      playSessionId: body.playSessionId,
      presenceKey: playbackPresenceKey(device.id, body.playSessionId),
      ...(familyPolicy
        ? {
            familyPolicy: {
              ...familyPolicy,
              enforcement: "verified-treatment-manifest",
            },
            familyTreatment: familyTreatment || ownedSession.familyTreatment,
          }
        : {}),
    };
  } catch (err) {
    return failSession(playbackFailure(503, "playback_service_unavailable", "The media service could not acknowledge this playback session."));
  }
}

/**
 * Route handler for /api/playback/start, /api/playback/progress, /api/playback/stop
 */
export async function handlePlaybackSessionRoute(req, res, opts = {}) {
  const url = new URL(req.url, "http://127.0.0.1");
  const pathname = url.pathname;

  if (req.method !== "POST") return false;

  let action = null;
  if (pathname === "/api/playback/start") action = "start";
  else if (pathname === "/api/playback/progress") action = "progress";
  else if (pathname === "/api/playback/stop") action = "stop";
  else return false;

  const send = (result) => {
    res.writeHead(result.ok ? 200 : result.status || 500, {
      "Content-Type": "application/json", "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(result));
    return true;
  };
  if (!isSameOriginProfileMutation(req, url)) return send(playbackFailure(403, "cross_origin_denied", "Use your ReelOS home connection to control playback."));

  let body = {};
  try {
    const chunks = [];
    let bytes = 0;
    for await (const chunk of req) {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += data.length;
      if (bytes > 65536) return send(playbackFailure(413, "payload_too_large", "The playback update is too large."));
      chunks.push(data);
    }
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return send(playbackFailure(400, "invalid_json", "The playback update could not be read.")); }

  const result = await forwardPlaybackSession(action, body, { ...opts, request: req });
  const sessId = result.presenceKey;
  const arbiter = opts.arbiter || featureCollisionArbiter;
  if (action === "start" && result.ok) {
    arbiter.notifyPlaybackStart(sessId, { itemId: body.itemId });
  } else if (action === "progress" && result.ok) {
    const posMs = body.positionTicks ? Math.round(Number(body.positionTicks) / 10000) : 0;
    const durationMs = body.durationTicks ? Math.round(body.durationTicks / 10000) : undefined;
    arbiter.notifyPlaybackProgress(sessId, { positionMs: posMs, durationMs });
  } else if (action === "stop" && result.ok) {
    arbiter.notifyPlaybackStop(sessId);
  }
  let eventProfileId = result.profileId || null;
  if (!eventProfileId && opts.intelligenceStore) {
    try {
      const profileDir = opts.profilesDir || process.env.REELOS_PROFILES_DIR
        || path.join(opts.stateDir || DEFAULT_STATE_DIR, "profiles");
      eventProfileId = getRequestActiveProfile(req, profileDir)?.id || null;
    } catch (error) {
      opts.onIntelligenceError?.(error, { type: "playback.failed" });
    }
  }
  if (eventProfileId && (opts.intelligenceStore || opts.intelligenceCoordinator)) {
    const completion = action === "stop" && Number.isSafeInteger(body.positionTicks)
      && Number.isSafeInteger(body.durationTicks) && body.durationTicks > 0
      && body.positionTicks / body.durationTicks >= 0.9;
    const eventType = result.ok
      ? (action === "start" ? "playback.started"
        : action === "stop" ? (completion ? "playback.completed" : "playback.stopped")
          : body.isPaused ? "playback.paused" : "playback.progress")
      : "playback.failed";
    const intelligenceEvent = {
      type: eventType,
      source: "playback-session-service",
      profileId: eventProfileId,
      deviceId: result.deviceId || null,
      sessionId: body.playSessionId,
      privacyClass: "local-sensitive",
      payload: {
        titleId: body.itemId,
        action,
        ok: Boolean(result.ok),
        ...(Number.isSafeInteger(body.positionTicks) ? { positionTicks: body.positionTicks } : {}),
        ...(Number.isSafeInteger(body.durationTicks) ? { durationTicks: body.durationTicks } : {}),
        ...(action === "progress" ? { paused: Boolean(body.isPaused) } : {}),
        ...(!result.ok && result.code ? { failureCode: result.code } : {}),
      },
    };
    if (opts.intelligenceCoordinator?.process) {
      scheduleIntelligenceWork(opts.intelligenceCoordinator.process(intelligenceEvent, {
        capabilityId: "taste-ranking",
        stage: "shadow",
      }), { onError: (error) => opts.onIntelligenceError?.(error, intelligenceEvent) });
    } else {
      await recordIntelligenceEvent(opts.intelligenceStore, intelligenceEvent, { onError: opts.onIntelligenceError });
    }
  }
  return send(result);
}
