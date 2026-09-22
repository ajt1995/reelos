import fs from "node:fs";
import path from "node:path";
import { getRequestActiveProfile, getProfile, listProfiles } from "./profile-service.mjs";
import { getAuthorizedDevice } from "./reelos-gate-service.mjs";
import { childProfileService } from "./child-profile-service.mjs";
import { resolveFamilyPlaybackPolicy, verifyFamilyTitle } from "./playback-session-service.mjs";
import { libraryItemIsAccessible, libraryItemSourceKind, sourcePolicyFromState } from "./source-access-policy.mjs";
import { NativeMediaRegistry } from "./native-media-registry.mjs";

export function playbackStateDir(options = {}) {
  return options.stateDir || process.env.REELOS_STATE || (process.platform === "win32"
    ? path.join(process.cwd(), ".reelos-state") : "/var/lib/reelos");
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

// Read current authority on every byte request: a removed library entry or a
// disabled provider must not survive in a catalog, path, or playback cache.
export function readPlaybackLibraryItems(options = {}) {
  if (Array.isArray(options.libraryItems)) return options.libraryItems;
  const stateDir = playbackStateDir(options);
  const registryFile = path.join(stateDir, "native-media-registry.json");
  let nativeItems = [];
  if (fs.existsSync(registryFile)) {
    const policy = readPlaybackSourcePolicy(options);
    const registry = new NativeMediaRegistry({ stateDir });
    const registryState = registry.read();
    nativeItems = Object.values(registryState.items).flatMap((item) => {
      const active = item.sources.filter((source) => source.accessState === "active");
      const local = active.find((source) => ["public_domain", "personal_import", "retained_local", "prepared_rendition"].includes(source.kind));
      const provider = active.find((source) => source.kind === "provider_stream" && policy.connected && source.provider === policy.provider);
      const source = local || provider;
      if (!source) return [];
      const binding = source.binding && typeof source.binding === "object" ? source.binding : {};
      const filePath = source.path || source.fileReceipt?.path || null;
      return [{
        id: item.itemId,
        title: item.title,
        year: item.year,
        mediaType: item.mediaType,
        aliases: item.aliases,
        sourceKind: source.kind,
        source: {
          id: source.id,
          kind: source.kind,
          provider: source.provider,
          infohash: binding.infohash,
          torrentId: binding.torrentId,
          fileId: binding.fileId,
        },
        infohash: binding.infohash,
        providerFileId: binding.fileId,
        path: filePath,
        publicUrl: source.kind === "public_domain" && /^https:\/\//i.test(String(source.uri || "")) ? source.uri : null,
        fileReceipt: source.fileReceipt || null,
        _nativeRegistryRevision: registryState.revision,
      }];
    });
  }
  const shelf = readJson(path.join(playbackStateDir(options), "library-shelf.json"), {});
  const shelfItems = Array.isArray(shelf.titles) ? shelf.titles : [];
  // The native registry is authoritative for identities it owns, but its
  // presence must not make separately verified personal imports disappear.
  // This merge is also the migration seam while legacy shelf records are
  // progressively registered natively.
  const owned = new Set(nativeItems.flatMap((item) => [item.id, ...(item.aliases || [])].filter(Boolean).map(String)));
  return [...nativeItems, ...shelfItems.filter((item) => {
    const ids = [item.id, item.jellyfinId, item.Id, ...(Array.isArray(item.ids) ? item.ids : [])].filter(Boolean).map(String);
    return !ids.some((id) => owned.has(id));
  })];
}

export function readPlaybackSourcePolicy(options = {}) {
  const stateDir = playbackStateDir(options);
  return sourcePolicyFromState({
    answers: readJson(path.join(stateDir, "answers.json"), {}),
    uiSettings: readJson(path.join(stateDir, "ui-settings.json"), {}),
    env: process.env,
  });
}

export function playbackItemId(item = {}) {
  if (item.jellyfinId || item.Id) return String(item.jellyfinId || item.Id);
  return String(item.id || "").replace(/^(tmdb-tv-|tmdb-|jf-)/, "");
}

export function resolvePlaybackItem(selector, options = {}) {
  const matches = readPlaybackLibraryItems(options).filter((item) => selector.kind === "hash"
    ? String(item.infohash || item.source?.infohash || "").toLowerCase() === selector.value.toLowerCase()
    : playbackItemId(item) === selector.value);
  return matches.length === 1 ? matches[0] : null;
}

const failure = (status, code, error) => ({ ok: false, status, code, error, available: false, directPlayReady: false });

export function playbackIdentity(req, options = {}) {
  const profilesDir = options.profilesDir || process.env.REELOS_PROFILES_DIR || path.join(playbackStateDir(options), "profiles");
  try {
    const device = getAuthorizedDevice(req, path.dirname(profilesDir));
    const profile = getRequestActiveProfile(req, profilesDir);
    if (!device || !profile) return failure(401, "profile_auth_required", "Open an authorized profile before playing this title.");
    return { ok: true, device, profile, profilesDir };
  } catch { return failure(503, "profile_unavailable", "Playback authorization could not be verified."); }
}

export function authorizePlaybackItem(req, item, options = {}) {
  const identity = playbackIdentity(req, options);
  if (!identity.ok) return identity;
  if (!item || !playbackItemId(item)) return failure(404, "playback_source_unmapped", "No verified media source is mapped to this title.");
  const sourcePolicy = readPlaybackSourcePolicy(options);
  const sourceKind = libraryItemSourceKind(item);
  // A cache filename alone cannot establish public/personal ownership.
  const mediaPath = String(item.path || item.Path || "");
  if (!item.sourceKind && !item.source?.kind && /[\\/](?:cache|downloads)[\\/]/i.test(mediaPath)) {
    return failure(403, "playback_source_unverified", "The source of this cached title could not be verified.");
  }
  if (!libraryItemIsAccessible(item, sourcePolicy)) return failure(403, "source_unavailable", "This title's source is not currently available.");
  if (sourceKind === "debrid" && item.source?.provider && item.source.provider !== sourcePolicy.provider) {
    return failure(403, "source_unavailable", "This title's provider is not currently connected.");
  }
  try {
    const presenceService = options.presenceService || childProfileService;
    if (!(presenceService.roomPresence instanceof Map)) throw new Error("Presence unavailable");
    // The client may omit or change a playback-session query. Merge all current
    // presence on the authorized device, plus the legacy household room.
    const present = [...presenceService.roomPresence.entries()].filter(([key, state]) => state?.kidsPresent
      && (key.startsWith(`playback:${identity.device.id}:`) || key === "living_room_tv"));
    const children = present.flatMap(([, state]) => state.childProfileIds?.length
      ? state.childProfileIds.map((id) => getProfile(id, identity.profilesDir))
      : listProfiles(identity.profilesDir).filter((profile) => profile.isKids));
    if (present.length && (!children.length || children.some((profile) => !profile?.isKids))) {
      return failure(503, "family_presence_unavailable", "The children watching could not be verified.");
    }
    const familyPolicy = resolveFamilyPlaybackPolicy({ activeProfile: identity.profile, presentProfiles: children, item });
    const family = verifyFamilyTitle(familyPolicy, item);
    if (!family.allowed) return failure(403, "family_title_denied", family.reason);
    return { ...identity, item, sourceKind, sourcePolicy, familyPolicy };
  } catch { return failure(503, "family_policy_unavailable", "The family playback boundary could not be verified."); }
}

export function sendPlaybackFailure(res, result) {
  res.statusCode = result.status || 503;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(JSON.stringify(result));
  return true;
}

export function verifiedPlaybackFile(item) {
  const file = item?.path || item?.Path;
  if (typeof file !== "string" || !path.isAbsolute(file) || !/\.(mp4|mkv|webm|mov|avi|ts|m4v)$/i.test(file)) return null;
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile()) return null;
    const expectedSize = item?.fileReceipt?.sizeBytes;
    if (Number.isSafeInteger(expectedSize) && expectedSize !== stat.size) return null;
    return file;
  } catch { return null; }
}

/**
 * Project one already-authorized library item into the source contract used by
 * the ReelOS player. Availability means that the server has a current,
 * verified route to the bytes; it deliberately does not claim browser codec
 * compatibility until the media has been probed or prepared.
 */
export function projectPlaybackSources(item, access) {
  if (!item || !access?.ok) return [];
  const canonicalId = playbackItemId(item);
  if (!canonicalId) return [];
  const file = verifiedPlaybackFile(item);
  const sourceKind = access.sourceKind || libraryItemSourceKind(item);
  const remoteVerified = sourceKind === "public_domain"
    ? /^https:\/\//i.test(String(item.publicUrl || ""))
    : sourceKind === "debrid"
      ? access.sourcePolicy?.connected === true
        && String(item.source?.provider || "") === String(access.sourcePolicy?.provider || "")
        && Boolean(item.source?.infohash || item.infohash)
        && (item.source?.fileId != null || item.providerFileId != null)
      : false;
  if (!file && !remoteVerified) return [];
  const streamUrl = `/api/stream/item/${encodeURIComponent(canonicalId)}`;
  const container = file ? path.extname(file).slice(1).toLowerCase() || null : null;
  const name = sourceKind === "public_domain" ? "Public-domain source"
    : sourceKind === "debrid" ? "Connected provider"
      : sourceKind === "retained_local" ? "Prepared copy"
        : "Original file";
  return [{
    id: String(item.source?.id || canonicalId),
    name,
    sourceKind,
    container,
    videoCodec: "unknown",
    audioCodec: "unknown",
    compatibility: "unverified",
    available: true,
    directPlayReady: false,
    subtitles: [],
    streamUrl,
    staticStreamUrl: streamUrl,
  }];
}
