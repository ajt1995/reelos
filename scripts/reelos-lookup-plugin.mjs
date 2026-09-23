import {
  readFileSync,
  existsSync,
  appendFileSync,
  writeFileSync,
  openSync,
  mkdirSync,
  unlinkSync,
  createReadStream,
  statSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { atomicWriteJsonSync } from "./utils/fs-atomic.mjs";
import {
  hasVaapiDri,
  hardwareProfilePath,
  loadSavedHardware,
  publicHardware,
  readHostMemKb,
  ramGbFromKb,
  detectGpuType,
  boxIsSmall,
  ramLabel,
  cpuShort,
  splashTuneFromProfile,
} from "./reelos-box-scale.mjs";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import os from "node:os";
import { politeScheduler } from "./services/polite-scheduler.mjs";
import { dirname, basename, join } from "node:path";
import {
  parseTitleId,
  findExistingSeasonRequest,
  pickSeerrRequestForTitle,
  seerrApiKey,
  seerrFetch,
  seerrRequestRow,
  seerrSearchHit,
  honestifyRequests,
  assembleRequestPayload,
  attachSeerrDetailTitles,
  mapSeerrSearchResults,
  mapSeerrPersonHits,
  mapSeerrCollectionHits,
  mapPersonDetail,
  mapCollectionDetail,
  collectionFromSeerrMovie,
  overlayLibraryOnTitle,
  mapSeerrDiscoverResults,
  mapSeerrSimilarResults,
  discoverOwnedIndex,
  lookupFailureMessage,
  buildSeerrAddPayload,
  discoverBrowseKind,
  discoverBrowseSeerrPath,
  mapSeerrGenres,
  FALLBACK_MOVIE_GENRES,
  FALLBACK_TV_GENRES,
  resolveParsedTitle,
  attachTitleAliases,
  libraryHasTitle,
  findLibraryTitle,
  lookupPayloadForId,
  overlayLookupWithLibrary,
  pickSeerrSearchForLibrary,
  normalizeMediaType,
  onDiskSeasonsFor,
  decorateTitlesWithDiskSeasons,
  titleRequestSeasonPayload,
  mergeRequestListTitles,
  applyRequestMediaType,
  seasonUnreleasedForRequest,
} from "./reelos-seerr.mjs";
import {
  resolveTitleMetadata,
  enrichTitleSync,
} from "./services/metadata-enricher.mjs";
import {
  kickArrRecover,
  loadPresenceFacts,
  arrJson,
  arrApiKey,
} from "./reelos-request-status.mjs";
import { handleRepair } from "./reelos-repair.mjs";
import {
  applyIsRunning,
  applyProductRunning,
  applyTargetFromLog,
  readLibraryProgress,
} from "./reelos-ota-status.mjs";
import { readApplyProgress } from "./reelos-ota-progress.mjs";
import {
  cmpVer,
  isBetaLine,
  isRollback,
  notesForVersion,
  pendingNotes,
} from "./update-notes.mjs";
import {
  pingWizardSource,
  provisionHonestyError,
  sourceValidateError,
} from "./wizard-honesty.mjs";
import {
  canDispatchProviderRequest,
  filterAccessibleLibraryItems,
  providerUnavailablePayload,
  publicSourcePolicy,
  sourcePolicyFromState,
  createProviderValidation,
  effectiveProviderKey,
  readProviderValidation,
  writeProviderValidation,
} from "./services/source-access-policy.mjs";
import {
  collectRequestList,
  invalidateRequestProgressCache,
} from "./reelos-request-progress-plugin.mjs";
import {
  cancelRequest,
  forgetRemovedKeys,
  forgetRemovedTitleIds,
  readRemovedTitleIds,
  rememberRemovedTitleIds,
  removeLibraryTitle,
  removedIdsStillOnShelf,
  writeRemovedTitleIds,
} from "./reelos-library-remove.mjs";
import { applyBetaSidecar, betaEnabled } from "./reelos-beta-sidecar.mjs";
import { dispatchBooksApi } from "./reelos-books.mjs";
import {
  curatorPublic,
  mergeLikedSimilar,
  recentLikedIds,
  resetCurator,
  titleIsCuratorHidden,
  voteCuratorTitle,
} from "./reelos-curator.mjs";
import {
  createLibraryCache,
  createTokenCache,
  JELLYFIN_ITEMS_TIMEOUT_MS,
  LIBRARY_CACHE_FILE,
  libraryItemsUrl,
  jellyfinResumeUrl,
  mapJellyfinItems,
  mapResumeItems,
  readLibraryCacheFile,
  repairHashTitles,
  serveLibrary,
  writeLibraryCacheFile,
  dedupeLibraryTitles,
  healRemovedIds,
  looksLikeSceneRelease,
} from "./reelos-library.mjs";
import {
  readWatchlistConfig,
  writeWatchlistConfig,
  syncWatchlistFeed,
} from "./reelos-watchlist.mjs";
import {
  fetchJellyfinSessions,
  castPlayToSession,
  castCommandToSession,
  sendSessionMessage,
} from "./reelos-cast.mjs";
import {
  handleProfilesRoute,
  getRequestActiveProfile,
  getRequestProfileAuthorization,
} from "./services/profile-service.mjs";
import { isSameOriginProfileMutation } from "./services/profile-session-service.mjs";
import { resolveAnswersPath } from "./services/state-paths.mjs";
import { processPrivateCuratorRequest, privateCuratorState } from "./services/private-curator-service.mjs";
import { handleMediaStrategyRoute } from "./services/media-strategy-service.mjs";
import { visualSentinel } from "./services/visual-sentinel.mjs";
import { handlePassportRoute } from "./services/passport-service.mjs";
import { searchAndScoreReleases } from "./reelflow/search.mjs";
import { PUBLIC_INDEXER_ROSTER } from "./services/neural-indexer-repair.mjs";
import {
  PUBLIC_CATALOGS,
  lookupPublicCinema,
  searchPublicCinema,
} from "./services/public-catalogs.mjs";
import { dispatchTorrent } from "./reelflow/dispatcher.mjs";
import {
  linkMovie,
  linkTvEpisodes,
  findMediaFilesOnDebrid,
} from "./reelflow/symlink-engine.mjs";
import { handleGuestPassRoute } from "./services/guest-pass-service.mjs";
import { handleDiagnosticsRoute } from "./services/diagnostics-heartbeat-service.mjs";
import { handleFeedbackRoute } from "./services/feedback-service.mjs";
import { handleOsUpgradeRoute } from "./services/os-upgrade-service.mjs";
import { queryJellyfinIntro } from "./services/intro-skipper-service.mjs";
import { handlePlaybackSessionRoute } from "./services/playback-session-service.mjs";
import { getReelIntelligenceSystem } from "./services/reel-intelligence-system.mjs";
import { handleAndroidClientRoute } from "./services/android-client-service.mjs";
import { handlePulseAiRoute } from "./services/pulse-ai-service.mjs";
import { handleShadowLabRoute } from "./services/shadow-archive-service.mjs";
import { handleHddHealthRoute } from "./services/hdd-guardian.mjs";
import { handleNeuroCacheRoute } from "./services/neuro-cache.mjs";
import {
  authorizeQuickConnect,
  getQuickConnectStatus,
} from "./reelos-quickconnect.mjs";
import { batteryGuardian } from "./services/battery-guardian.mjs";
import { adaptivePlayback } from "./services/adaptive-playback.mjs";
import { audioIntelligence } from "./services/audio-intelligence.mjs";
import { telemetryWatchdog } from "./services/telemetry-watchdog.mjs";
import {
  listBackups,
  createBackupSnapshot,
  restoreBackupSnapshot,
  getBackupDir,
} from "./reelos-backup.mjs";
import { flickMatch } from "./reelos-flickmatch.mjs";
import { sweepGuestRequests } from "./reelos-guest-cleanup.mjs";
import {
  readKidsApprovedIds,
  writeKidsApprovedIds,
  getGiftedKidsTitles,
  giftTitleForKids,
  ungiftTitleForKids,
} from "./reelos-kids.mjs";
import { handleCompanionRoute } from "./services/companion-service.mjs";
import { dualBrainService } from "./services/dual-brain-service.mjs";
import { inRamTranscoder } from "./services/in-ram-transcoder-service.mjs";
import {
  handleSubtitlesStatus,
  handleSubtitlesSearch,
  handleSubtitlesTrack,
  handleSubtitlesSync,
} from "./services/subtitle-service.mjs";
import { handleStandbyRoute } from "./services/standby-service.mjs";
import {
  getBatteryStatus,
  setBatteryMode,
} from "./services/battery-service.mjs";
import {
  getSiliconBenchmark,
  runSiliconBenchmarkSync,
} from "./reelos-benchmark.mjs";
import {
  listUsbDrives,
  autoMountUsb,
  formatUsbDrive,
  listStorageDevices as serviceListStorageDevices,
} from "./services/storage-service.mjs";
import {
  getWifiStatus as serviceGetWifiStatus,
  scanWifiNetworks as serviceScanWifiNetworks,
  connectWifi as serviceConnectWifi,
} from "./services/network-service.mjs";
import { getPrefetchMetrics, purgeOldPrefetch } from "./reelos-prefetch.mjs";
import {
  loadPendingGuestRequests,
  addPendingGuestRequest,
  removePendingGuestRequest,
} from "./reelos-guest-gate.mjs";
import {
  getCabinStatus,
  setCabinMode,
  syncTitleToVault,
} from "./services/offline-service.mjs";
import {
  detectIsoFile,
  listUsbDrives as listUsbCreatorDrives,
  prepareSeedDirectory,
} from "./reelos-usb-creator.mjs";
import {
  processRequestCancellation,
  isGuestPendingRequest,
} from "./services/request-service.mjs";
import {
  sanitizeTitleString as serviceSanitizeTitleString,
  validateRemovePayload,
  validateResetPayload,
} from "./services/library-service.mjs";
import {
  handleGateRoute,
  isRemoteChallengeRequired,
} from "./services/reelos-gate-service.mjs";
import { handleSupportRoute } from "./services/support-service.mjs";

let localIntelligenceStorePromise;
let localIntelligenceSystemPromise;
function localIntelligenceSystem() {
  localIntelligenceSystemPromise ||= getReelIntelligenceSystem({
    ...(process.env.REELOS_STATE ? { stateDir: process.env.REELOS_STATE } : {}),
  }).catch((error) => {
    localIntelligenceSystemPromise = null;
    throw error;
  });
  return localIntelligenceSystemPromise;
}
function localIntelligenceStore() {
  localIntelligenceStorePromise ||= localIntelligenceSystem().then((system) => system.store).catch((error) => {
    console.warn(`[reelos] local intelligence ledger unavailable: ${error?.code || "initialization_failed"}`);
    return null;
  });
  return localIntelligenceStorePromise;
}

function reportIntelligenceError(error) {
  console.warn(`[reelos] local intelligence write deferred: ${error?.code || "write_failed"}`);
}

const jellyfinTokens = createTokenCache();
const libraryCache = createLibraryCache();
const seeded = readLibraryCacheFile(LIBRARY_CACHE_FILE);
if (seeded)
  libraryCache.write(seeded.titles, {
    now: seeded.at,
    complete: seeded.complete,
  });

function healedLibraryRemovedIds() {
  const prev = readRemovedTitleIds();
  const next = healRemovedIds(prev, libraryCache.read()?.titles || []);
  const same =
    prev.length === next.length && prev.every((id, i) => id === next[i]);
  if (!same) {
    try {
      writeRemovedTitleIds(next);
    } catch {
      /* */
    }
  }
  return next;
}

function latchStackInstalled() {
  try {
    // This legacy production latch writes /var/lib; explicit installations must
    // never infer or mutate that other installation's state during import.
    if (process.env.REELOS_STATE) return;
    if (!existsSync("/var/lib/reelos/provisioned")) return;
    if (existsSync("/var/lib/reelos/stack-installed")) return;
    mkdirSync("/var/lib/reelos", { recursive: true, mode: 0o700 });
    writeFileSync("/var/lib/reelos/stack-installed", "1\n");
  } catch {
    /* cloud / non-appliance */
  }
}
latchStackInstalled();

function persistLibraryCache() {
  const entry = libraryCache.read();
  if (!entry) return;
  try {
    writeLibraryCacheFile(LIBRARY_CACHE_FILE, entry);
  } catch {
    /* */
  }
}

/** Home/Library Watch seasons come from Sonarr files, not the JF dump Path. */
async function decorateLibraryTitles(titles) {
  if (!titles?.length) return titles || [];
  try {
    const facts = await loadPresenceFacts();
    return decorateTitlesWithDiskSeasons(titles, facts);
  } catch {
    return titles;
  }
}

function forgetRemovedIfStillOnShelf(titles) {
  const still = removedIdsStillOnShelf(titles, readRemovedTitleIds());
  if (!still.length) return;
  forgetRemovedKeys(still);
}

let libraryRefresh = null;
async function refreshLibraryFull(host) {
  if (libraryRefresh) return libraryRefresh;
  libraryRefresh = (async () => {
    const a = answers();
    const auth = await jellyfinToken(
      a.adminName || "reelos",
      a.adminPassword || "reelos",
    );
    if (!auth?.token) return;
    const pulled = await jellyfinFetchItems(auth);
    if (!pulled.ok) return;
    const data = pulled.json;
    const items = Array.isArray(data.Items) ? data.Items : [];
    const titles = await decorateLibraryTitles(
      dedupeLibraryTitles(mapJellyfinItems(items, host)),
    );
    const resumePulled = await jellyfinFetchResume(auth);
    const writeOpts = { complete: true };
    if (resumePulled.ok) {
      writeOpts.continueWatching = mapResumeItems(
        Array.isArray(resumePulled.json?.Items) ? resumePulled.json.Items : [],
        { host, libraryTitles: titles },
      );
    }
    libraryCache.write(titles, writeOpts);
    persistLibraryCache();
    forgetRemovedIfStillOnShelf(titles);
  })()
    .catch(() => {})
    .finally(() => {
      libraryRefresh = null;
    });
  return libraryRefresh;
}

function xmlKey(file) {
  if (!existsSync(file)) return null;
  const m = /<ApiKey>([^<]+)<\/ApiKey>/.exec(readFileSync(file, "utf8"));
  return m?.[1] ?? null;
}

function note(msg) {
  try {
    appendFileSync(
      "/var/lib/reelos/lookup.log",
      `${new Date().toISOString()} ${msg}\n`,
    );
  } catch {
    /* */
  }
}

function tailscaleBin() {
  for (const p of ["/usr/bin/tailscale", "/usr/sbin/tailscale"]) {
    if (existsSync(p)) return p;
  }
  return null;
}

let tailscaleCache = { at: 0, val: null };
const TAILSCALE_CACHE_MS = 15_000;

function tailscaleState() {
  const now = Date.now();
  if (tailscaleCache.val && now - tailscaleCache.at < TAILSCALE_CACHE_MS)
    return tailscaleCache.val;
  const bin = tailscaleBin();
  const empty = {
    installed: false,
    up: false,
    state: "missing",
    auth: null,
    ip: null,
    dns: null,
    tailnet: null,
  };
  if (!bin) {
    try {
      if (existsSync("/var/lib/reelos/tailscale-auth.url")) {
        empty.auth =
          readFileSync("/var/lib/reelos/tailscale-auth.url", "utf8").trim() ||
          null;
      }
    } catch {
      /* */
    }
    tailscaleCache = { at: now, val: empty };
    return empty;
  }
  const r = spawnSync(bin, ["status", "--json"], {
    encoding: "utf8",
    timeout: 8000,
  });
  let j = {};
  try {
    j = JSON.parse(r.stdout || "{}");
  } catch {
    j = {};
  }
  const backend = String(j.BackendState || "");
  const ips = j.Self?.TailscaleIPs || [];
  const ip = ips.find((x) => String(x).startsWith("100.")) || null;
  const dns = String(j.Self?.DNSName || "").replace(/\.$/, "") || null;
  const tailnet = j.CurrentTailnet?.Name || dns || null;
  let auth = String(j.AuthURL || "").trim() || null;
  if (!auth) {
    try {
      if (existsSync("/var/lib/reelos/tailscale-auth.url")) {
        auth =
          readFileSync("/var/lib/reelos/tailscale-auth.url", "utf8").trim() ||
          null;
      }
    } catch {
      /* */
    }
  }
  const up = backend === "Running" && Boolean(ip);
  const val = {
    installed: true,
    up,
    state: backend || "NeedsLogin",
    auth: up ? null : auth,
    ip,
    dns,
    tailnet,
  };
  tailscaleCache = { at: now, val };
  return val;
}

function tailnetName() {
  return tailscaleState().tailnet;
}

function tailscaleRunning() {
  return tailscaleState().up;
}

function ipv4() {
  const skip = /^(docker|br-|veth|cni|flannel|virbr|lxc|lo)/;
  const prefer = [];
  const rest = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    if (skip.test(name)) continue;
    for (const a of list || []) {
      if (!a || a.internal) continue;
      if (!(a.family === "IPv4" || a.family === 4)) continue;
      if (
        a.address.startsWith("172.17.") ||
        a.address.startsWith("172.18.") ||
        a.address.startsWith("172.19.")
      )
        continue;
      if (/^(wl|en|eth|wlan)/.test(name)) prefer.push(a.address);
      else rest.push(a.address);
    }
  }
  return prefer[0] || rest[0] || "";
}

export function getAnswersFilePath() {
  return resolveAnswersPath();
}

function answers() {
  try {
    const p = getAnswersFilePath();
    if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
  } catch {}
  return {};
}

async function probe(url, ms = 2500) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, { signal: ac.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

function movieHit(h) {
  const tmdb = h.tmdbId ?? h.ids?.tmdb;
  if (!tmdb) return null;
  const genres = Array.isArray(h.genres)
    ? h.genres
        .map((g) => (typeof g === "string" ? g : g?.name || ""))
        .filter(Boolean)
    : [];
  const poster =
    String(h.remotePoster || "") ||
    String(
      (h.images || []).find((i) => i?.coverType === "poster")?.remoteUrl || "",
    );
  return {
    id: `tmdb-${tmdb}`,
    kind: "movie",
    title: String(h.title || "Untitled"),
    year: Number(h.year) || 0,
    overview: String(h.overview || ""),
    poster,
    rating: Number(h.ratings?.tmdb?.value || h.ratings?.imdb?.value || 0),
    genres,
    maxQuality: "4k",
    popularity: 50,
  };
}

function seriesHit(h) {
  const tvdb = h.tvdbId ?? h.ids?.tvdb;
  if (!tvdb) return null;
  const poster =
    String(h.remotePoster || "") ||
    String(
      (h.images || []).find((i) => i?.coverType === "poster")?.remoteUrl || "",
    );
  return {
    id: `tvdb-${tvdb}`,
    kind: "tv",
    title: String(h.title || "Untitled"),
    year: Number(h.year) || 0,
    overview: String(h.overview || ""),
    poster,
    rating: Number(h.ratings?.tmdb?.value || 0),
    genres: [],
    maxQuality: "4k",
    popularity: 50,
    seasons: Array.isArray(h.seasons) ? h.seasons.length : undefined,
  };
}

async function pull(url, key, ms = 8000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: { "X-Api-Key": key },
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

const requestCuratorScopes = new WeakMap();
const responseCuratorScopes = new WeakMap();

function curatorProfilesDir() {
  return process.env.REELOS_PROFILES_DIR || join(process.env.REELOS_STATE ||
    (process.platform === "win32" ? join(process.cwd(), ".reelos-state") : "/var/lib/reelos"), "profiles");
}

function bindCuratorResponse(req, res) {
  try {
    const profilesDir = curatorProfilesDir();
    const profile = getRequestActiveProfile(req, profilesDir);
    const scope = { req, profilesDir, profile, profileId: profile?.id || null };
    requestCuratorScopes.set(req, scope);
    responseCuratorScopes.set(res, scope);
    return true;
  } catch {
    send(res, 503, { ok: false, error: "Your profile could not be verified." });
    return false;
  }
}

function readRequestCurator(req) {
  const scope = requestCuratorScopes.get(req);
  return privateCuratorState(scope ? scope.profile : getRequestActiveProfile(req, curatorProfilesDir()));
}

function send(res, code, body) {
  const scope = responseCuratorScopes.get(res);
  if (scope) {
    try {
      if ((getRequestActiveProfile(scope.req, scope.profilesDir)?.id || null) !== scope.profileId) {
        code = 409;
        body = { ok: false, code: "profile_changed", error: "Your profile changed. Please refresh this view." };
      }
    } catch {
      code = 503;
      body = { ok: false, error: "Your profile could not be verified." };
    }
  }
  res.statusCode = code;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req._body) return req._body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    return {};
  }
}

function titlesForResolve() {
  const mem = libraryCache.read()?.titles || [];
  const raw = mem.length
    ? mem
    : readLibraryCacheFile(LIBRARY_CACHE_FILE)?.titles || [];
  return dedupeLibraryTitles(repairHashTitles(raw));
}

async function resolveLiveParsed(parsed) {
  let next = resolveParsedTitle(parsed, { titles: titlesForResolve() });
  if (next?.tmdb) return next;
  try {
    const facts = await loadPresenceFacts();
    next = resolveParsedTitle(next, {
      titles: facts.libraryTitles,
      series: facts.series,
      movies: facts.movies,
    });
  } catch {
    /* library + *arr may be warming */
  }
  return next;
}

async function seerrTitleDetail(parsed) {
  const resolved = parsed?.tmdb ? parsed : await resolveLiveParsed(parsed);
  if (!resolved?.tmdb)
    return { title: null, parsed: resolved, missingTmdb: true };
  const key = seerrApiKey();
  if (!key) return { title: null, parsed: resolved };
  const path =
    resolved.mediaType === "tv"
      ? `/api/v1/tv/${resolved.tmdb}`
      : `/api/v1/movie/${resolved.tmdb}`;
  const r = await seerrFetch(path, { key, ms: 20000 });
  if (!r.ok || !r.json) return { title: null, parsed: resolved };
  const hit = seerrSearchHit(
    {
      ...r.json,
      id: Number(resolved.tmdb) || r.json.id,
      mediaType: resolved.mediaType,
    },
    resolved.mediaType,
  );
  const titled = attachTitleAliases(hit, resolved);
  const collection =
    resolved.mediaType === "tv" ? null : collectionFromSeerrMovie(r.json);
  return {
    title: titled && collection ? { ...titled, collection } : titled,
    parsed: resolved,
  };
}

async function handleLookup(req, res) {
  const raw = req.url ?? "";
  const u = new URL(raw, "http://reelos.local");
  const q = u.searchParams.get("q")?.trim() || "";
  const id = u.searchParams.get("id")?.trim() || "";
  const discoverScope = u.searchParams.get("scope")?.trim() === "discover";
  const titles = [];
  const people = [];
  const collections = [];
  let error = null;
  const key = seerrApiKey();
  note(`api q=${q} id=${id} seerr=${key ? "yes" : "NO"}`);
  if (id) {
    if (id.startsWith("loc-")) {
      try {
        const publicTitle = await lookupPublicCinema(id);
        send(res, 200, {
          titles: publicTitle ? [publicTitle] : [],
          people,
          collections,
          error: publicTitle ? null : "This public catalog item is unavailable.",
        });
      } catch {
        send(res, 200, {
          titles: [],
          people,
          collections,
          error: "The Library of Congress catalog did not answer.",
        });
      }
      return;
    }
    let libraryTitle = findLibraryTitle(titlesForResolve(), id);
    if (libraryTitle) {
      libraryTitle = enrichTitleSync(libraryTitle);
    }
    if (!key && libraryTitle) {
      send(res, 200, {
        titles: [libraryTitle],
        people,
        collections,
        error: null,
      });
      return;
    }
    if (!key && !libraryTitle) {
      try {
        const cleanImdb = id.replace(/^imdb-/, "");
        if (cleanImdb.startsWith("tt")) {
          const fetchCinemeta = async (url) => {
            try {
              const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
              return r.ok ? await r.json() : null;
            } catch {
              return null;
            }
          };
          const [seriesRes, movieRes] = await Promise.all([
            fetchCinemeta(
              `https://v3-cinemeta.strem.io/meta/series/${cleanImdb}.json`,
            ),
            fetchCinemeta(
              `https://v3-cinemeta.strem.io/meta/movie/${cleanImdb}.json`,
            ),
          ]);
          const meta = seriesRes?.meta?.name ? seriesRes.meta : movieRes?.meta;
          if (meta) {
            const isSeries =
              meta.type === "series" ||
              (Boolean(seriesRes?.meta?.name) && !movieRes?.meta?.name);
            const videos = Array.isArray(meta.videos) ? meta.videos : [];
            const seasonList = isSeries
              ? [
                  ...new Set(
                    videos
                      .map((v) => Number(v.season))
                      .filter((n) => Number.isFinite(n) && n > 0),
                  ),
                ].sort((a, b) => a - b)
              : [];
            const titleObj = {
              id: id.startsWith("imdb-") ? id : `imdb-${meta.id}`,
              kind: isSeries ? "tv" : "movie",
              title: meta.name || "Untitled",
              year: parseInt(meta.releaseInfo || meta.year, 10) || 0,
              overview: meta.description || meta.overview || "",
              poster: (meta.poster || "").replace("/small/", "/medium/"),
              banner: meta.background || "",
              genres: meta.genres || [],
              rating: parseFloat(meta.imdbRating) || 0,
              seasons: seasonList.length,
              seasonList:
                seasonList.length > 0 ? seasonList : isSeries ? [1] : [],
              maxQuality: "4k",
              popularity: 80,
              onDiskSeasons: [],
            };
            send(res, 200, {
              titles: [titleObj],
              people,
              collections,
              error: null,
            });
            return;
          }
        }

        const tmdbKey = process.env.TMDB_API_KEY;
        if (tmdbKey && (id.startsWith("tmdb-") || id.startsWith("tmdb-tv-"))) {
          const isTv = id.startsWith("tmdb-tv-");
          const tmdbNum = isTv ? id.slice(8) : id.slice(5);
          const tmdbUrl = isTv
            ? `https://api.themoviedb.org/3/tv/${tmdbNum}?api_key=${tmdbKey}`
            : `https://api.themoviedb.org/3/movie/${tmdbNum}?api_key=${tmdbKey}`;
          const tmdbRes = await fetch(tmdbUrl, {
            signal: AbortSignal.timeout(8000),
          });
          if (tmdbRes.ok) {
            const tmdbData = await tmdbRes.json();
            const seasonList =
              isTv && Array.isArray(tmdbData.seasons)
                ? tmdbData.seasons
                    .map((s) => Number(s.season_number))
                    .filter((n) => n > 0)
                    .sort((a, b) => a - b)
                : [];
            const titleObj = {
              id,
              kind: isTv ? "tv" : "movie",
              title: tmdbData.name || tmdbData.title || "Untitled",
              year:
                parseInt(
                  tmdbData.first_air_date || tmdbData.release_date || "",
                  10,
                ) || 0,
              overview: tmdbData.overview || "",
              poster: tmdbData.poster_path
                ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}`
                : "",
              banner: tmdbData.backdrop_path
                ? `https://image.tmdb.org/t/p/original${tmdbData.backdrop_path}`
                : "",
              genres: (tmdbData.genres || []).map((g) => g.name),
              rating: tmdbData.vote_average || 0,
              seasons: seasonList.length,
              seasonList: seasonList.length > 0 ? seasonList : isTv ? [1] : [],
              maxQuality: "4k",
              popularity: tmdbData.popularity || 80,
              onDiskSeasons: [],
            };
            send(res, 200, {
              titles: [titleObj],
              people,
              collections,
              error: null,
            });
            return;
          }
        }

        const parsed = parseTitleId(id);
        if (parsed) {
          const isTv = parsed.mediaType === "tv" || Boolean(parsed.tvdb);
          const meta = await resolveTitleMetadata(id, {
            kind: isTv ? "tv" : "movie",
          });
          if (meta) {
            send(res, 200, {
              titles: [meta],
              people,
              collections,
              error: null,
            });
            return;
          }
        }
      } catch (lookupErr) {
        note(`Cinemeta/TMDB lookup exception: ${String(lookupErr)}`);
      }
    }
  }

  if (!key) {
    if (q.length >= 2) {
      try {
        const fetchCinemeta = async (url) => {
          try {
            const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
            return r.ok ? await r.json() : { metas: [] };
          } catch {
            return { metas: [] };
          }
        };
        const [m, t] = await Promise.all([
          fetchCinemeta(
            "https://v3-cinemeta.strem.io/catalog/movie/top/search=" +
              encodeURIComponent(q) +
              ".json",
          ),
          fetchCinemeta(
            "https://v3-cinemeta.strem.io/catalog/series/top/search=" +
              encodeURIComponent(q) +
              ".json",
          ),
        ]);
        const hits = [...(m.metas || []), ...(t.metas || [])];
        const cTitles = hits.map((h) => ({
          id: h.id?.startsWith("tt") ? "imdb-" + h.id : h.id,
          kind: h.type === "series" ? "tv" : "movie",
          title: h.name || "Untitled",
          year: parseInt(h.releaseInfo || h.year) || 0,
          overview: h.description || "",
          poster: (h.poster || "").replace("/small/", "/medium/"),
          rating: parseFloat(h.imdbRating) || 0,
          genres: h.genres || [],
          maxQuality: "4k",
          popularity: 50,
        }));
        titles.push(...cTitles);
      } catch (e) {}
      try {
        titles.push(...(await searchPublicCinema(q)));
      } catch (e) {
        note(`public catalog ${e}`);
      }
    } else {
      const libraryTitles = titlesForResolve();
      if (libraryTitles && libraryTitles.length > 0) {
        titles.push(...libraryTitles.slice(0, 50));
      }
    }

    if (q.length >= 2) {
      const overlaid = overlayLookupWithLibrary(titles, titlesForResolve(), q);
      titles.length = 0;
      titles.push(...overlaid);
    }

    send(res, 200, { titles, people, collections, error: null });
    return;
  }
  try {
    if (id) {
      let libraryTitle = findLibraryTitle(titlesForResolve(), id);
      let parsed = await resolveLiveParsed(
        parseTitleId(id) ||
          (libraryTitle ? parseTitleId(libraryTitle.id) : null),
      );
      let seerrTitle = null;
      let missingTmdb = false;
      if (parsed?.tmdb) {
        const detail = await seerrTitleDetail(parsed);
        seerrTitle = detail.title;
        if (!libraryTitle && seerrTitle?.title) {
          const normS = String(seerrTitle.title)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "");
          if (normS && normS !== "unknownonthisbox") {
            libraryTitle =
              (titlesForResolve() || []).find((t) => {
                if (
                  (seerrTitle.kind === "tv" || seerrTitle.kind === "anime") !==
                  (t.kind === "tv" || t.kind === "anime")
                )
                  return false;
                const normT = String(t.title || "")
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "");
                if (!normT || normT !== normS) return false;
                if (
                  seerrTitle.year &&
                  t.year &&
                  Math.abs(Number(t.year) - Number(seerrTitle.year)) > 1
                )
                  return false;
                return true;
              }) || null;
            if (libraryTitle && parsed?.titleId) {
              libraryTitle.ids = [
                ...new Set([...(libraryTitle.ids || []), parsed.titleId, id]),
              ];
              persistLibraryCache();
            }
          }
        }
        missingTmdb = Boolean(detail.missingTmdb) && !libraryTitle;
      } else if (
        libraryTitle?.title &&
        libraryTitle.title !== "Unknown on this box" &&
        !/^[0-9a-f]{32,64}$/i.test(libraryTitle.title)
      ) {
        try {
          const r = await seerrFetch(
            `/api/v1/search?query=${encodeURIComponent(libraryTitle.title)}`,
            { key, ms: 8000 },
          );
          if (r.ok) {
            const hits = Array.isArray(r.json) ? r.json : r.json?.results || [];
            seerrTitle = pickSeerrSearchForLibrary(
              libraryTitle,
              mapSeerrSearchResults(hits, { q: libraryTitle.title, limit: 8 }),
            );
          }
        } catch {
          /* Seerr is for requests; the JF row still names the page */
        }
        missingTmdb = false;
      } else {
        missingTmdb = !libraryTitle;
      }
      const facts = await loadPresenceFacts().catch(() => null);
      const payload = lookupPayloadForId({
        seerrTitle,
        libraryTitle,
        missingTmdb,
        onDiskSeasons: onDiskSeasonsFor(parsed, facts?.arrIndex),
      });
      if (facts)
        payload.titles = decorateTitlesWithDiskSeasons(
          payload.titles || [],
          facts,
        );
      if ((!payload.titles || payload.titles.length === 0) && id) {
        const isTv = parsed?.mediaType === "tv" || Boolean(parsed?.tvdb);
        const meta = await resolveTitleMetadata(id, {
          kind: isTv ? "tv" : "movie",
        });
        if (meta) {
          payload.titles = [meta];
          payload.error = null;
        }
      } else if (payload.titles?.length > 0) {
        payload.titles = payload.titles.map(enrichTitleSync);
      }
      send(res, 200, payload);
      return;
    }
    if (q.length < 2) {
      send(res, 200, { titles, people, collections, error });
      return;
    }
    const r = await seerrFetch(
      `/api/v1/search?query=${encodeURIComponent(q)}`,
      { key, ms: 45000 },
    );
    if (!r.ok) {
      error = `seerr ${r.status}`;
      note(`seerr search ${r.status}`);
    } else {
      const hits = Array.isArray(r.json) ? r.json : r.json?.results || [];
      const excludeOwned = discoverScope
        ? discoverOwnedIndex(titlesForResolve())
        : undefined;
      titles.push(
        ...mapSeerrSearchResults(hits, {
          q,
          limit: 16,
          excludeOwned,
          excludeHidden: discoverScope ? readRequestCurator(req) : undefined,
        }),
      );
      people.push(...mapSeerrPersonHits(hits));
      collections.push(...mapSeerrCollectionHits(hits));
      note(
        `seerr hits=${hits.length} titles=${titles.length} people=${people.length} collections=${collections.length} discover=${discoverScope ? "yes" : "no"}`,
      );
    }
    try {
      titles.push(...(await searchPublicCinema(q)));
    } catch (publicCatalogError) {
      note(`public catalog ${publicCatalogError}`);
    }
  } catch (e) {
    error = lookupFailureMessage(e);
    note(`seerr ${e}`);
  }
  if (q.length >= 2) {
    const overlaid = overlayLookupWithLibrary(titles, titlesForResolve(), q);
    titles.length = 0;
    titles.push(...overlaid);
    if (titles.length || people.length || collections.length) error = null;
  }
  send(res, 200, { titles, people, collections, error });
}

async function handleCollection(req, res) {
  const u = new URL(req.url ?? "", "http://reelos.local");
  const id = tmdbIdFromQuery(u.searchParams.get("id"));
  const key = seerrApiKey();
  if (!id) {
    send(res, 200, { collection: null, error: "Need a TMDB collection id." });
    return;
  }
  if (!key) {
    send(res, 200, {
      collection: null,
      error: null,
    });
    return;
  }
  try {
    const r = await seerrFetch(`/api/v1/collection/${id}`, { key, ms: 20000 });
    if (!r.ok || !r.json) {
      send(res, 200, {
        collection: null,
        error:
          r.status === 404 || !r.json
            ? "TMDB has no collection with that id."
            : `seerr ${r.status}`,
      });
      return;
    }
    const collection = mapCollectionDetail(r.json, titlesForResolve());
    if (!collection) {
      send(res, 200, {
        collection: null,
        error: "TMDB has no collection with that id.",
      });
      return;
    }
    const hidden = readRequestCurator(req);
    collection.parts = (collection.parts || []).filter(
      (t) => t?.inLibrary || t?.jellyfinId || !titleIsCuratorHidden(t, hidden),
    );
    collection.onBox = collection.parts.filter(
      (t) => t.inLibrary || t.jellyfinId,
    ).length;
    send(res, 200, { collection, error: null });
  } catch (e) {
    send(res, 200, { collection: null, error: lookupFailureMessage(e) });
  }
}

async function handlePerson(req, res) {
  const u = new URL(req.url ?? "", "http://reelos.local");
  const id = tmdbIdFromQuery(u.searchParams.get("id"));
  const key = seerrApiKey();
  if (!id) {
    send(res, 200, { person: null, error: "Need a TMDB person id." });
    return;
  }
  if (!key) {
    send(res, 200, {
      person: null,
      error: null,
    });
    return;
  }
  try {
    const r = await seerrFetch(`/api/v1/person/${id}`, { key, ms: 20000 });
    if (!r.ok || !r.json) {
      send(res, 200, {
        person: null,
        error:
          r.status === 404 || !r.json
            ? "TMDB has no person with that id."
            : `seerr ${r.status}`,
      });
      return;
    }
    let creditsJson = r.json.combinedCredits || r.json.combined_credits || null;
    if (!creditsJson?.cast && !Array.isArray(creditsJson)) {
      const c = await seerrFetch(`/api/v1/person/${id}/combined_credits`, {
        key,
        ms: 20000,
      });
      creditsJson = c.ok ? c.json : null;
    }
    const person = mapPersonDetail(r.json, creditsJson, titlesForResolve());
    if (!person) {
      send(res, 200, {
        person: null,
        error: "TMDB has no person with that id.",
      });
      return;
    }
    const hidden = readRequestCurator(req);
    person.credits = (person.credits || []).filter(
      (t) => t?.inLibrary || t?.jellyfinId || !titleIsCuratorHidden(t, hidden),
    );
    person.onBox = person.credits.filter(
      (t) => t.inLibrary || t.jellyfinId,
    ).length;
    send(res, 200, { person, error: null });
  } catch (e) {
    send(res, 200, { person: null, error: lookupFailureMessage(e) });
  }
}

async function ownedDiscoverExclude() {
  const entry = libraryCache.read();
  if (!entry?.complete) {
    await Promise.race([
      refreshLibraryFull("127.0.0.1"),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]).catch(() => {});
  }
  return discoverOwnedIndex(titlesForResolve());
}

async function handleDiscoverBrowse(req, res, u) {
  const kind = discoverBrowseKind(u.searchParams.get("kind"));
  const page = Math.max(1, Number(u.searchParams.get("page") || 1) || 1);
  const genre = String(u.searchParams.get("genre") || "").replace(/\D/g, "");
  const category = String(
    u.searchParams.get("category") || "popular",
  ).toLowerCase();
  const fallback = kind === "tv" ? FALLBACK_TV_GENRES : FALLBACK_MOVIE_GENRES;
  const empty = {
    titles: [],
    genres: fallback,
    page,
    totalPages: page,
    kind,
    genre,
    category,
    error: null,
  };
  const key = seerrApiKey();
  if (!kind) {
    send(res, 200, { ...empty, error: "Need kind=movie or kind=tv." });
    return;
  }
  if (!key) {
    try {
      const type = kind === "tv" ? "series" : "movie";
      let r = { metas: [] };
      try {
        const res = await fetch(
          "https://v3-cinemeta.strem.io/catalog/" + type + "/top.json",
          { signal: AbortSignal.timeout(8000) },
        );
        if (res.ok) r = await res.json();
      } catch (e) {}
      const cTitles = (r.metas || []).map((h) => ({
        id: h.id?.startsWith("tt") ? "imdb-" + h.id : h.id,
        kind: h.type === "series" ? "tv" : "movie",
        title: h.name || "Untitled",
        year: parseInt(h.releaseInfo || h.year) || 0,
        overview: h.description || "",
        poster: (h.poster || "").replace("/small/", "/medium/"),
        rating: parseFloat(h.imdbRating) || 0,
        genres: h.genres || [],
        maxQuality: "4k",
        popularity: 50,
      }));
      send(res, 200, {
        titles: cTitles,
        genres: fallback,
        page: 1,
        totalPages: 1,
        kind,
        genre,
        category,
        error: null,
      });
    } catch (e) {
      send(res, 200, { ...empty, error: null });
    }
    return;
  }
  try {
    const path = discoverBrowseSeerrPath({ kind, genre, category, page });
    const genrePath =
      kind === "tv" ? "/api/v1/genres/tv" : "/api/v1/genres/movie";
    const [listRes, genreRes] = await Promise.all([
      seerrFetch(path, { key, ms: 45000 }),
      seerrFetch(genrePath, { key, ms: 15000 }),
    ]);
    const genres = mapSeerrGenres(genreRes.ok ? genreRes.json : null, fallback);
    if (!listRes.ok) {
      const error =
        listRes.status === 403
          ? "Request UI is still finishing setup. Wait, then refresh Discover."
          : `seerr ${listRes.status}`;
      send(res, 200, { ...empty, genres, error });
      return;
    }
    const json = listRes.json || {};
    const hits = Array.isArray(json) ? json : json.results || [];
    const excludeIds = await ownedDiscoverExclude();
    const excludeHidden = readRequestCurator(req);
    const boostIds = excludeHidden.liked || [];
    const titles = mapSeerrDiscoverResults(hits, {
      mediaType: kind,
      limit: 40,
      excludeIds,
      excludeHidden,
      boostIds,
    });
    const totalPages = Math.max(
      1,
      Number(json.totalPages || json.total_pages || page) || page,
    );
    send(res, 200, {
      titles,
      genres,
      page: Number(json.page || page) || page,
      totalPages,
      kind,
      genre,
      category,
      error: titles.length ? null : "Seerr has nothing new to show yet.",
    });
  } catch (e) {
    send(res, 200, { ...empty, error: lookupFailureMessage(e) });
  }
}

async function handleDiscover(req, res) {
  const u = new URL(req.url ?? "", "http://reelos.local");
  if (discoverBrowseKind(u.searchParams.get("kind"))) {
    await handleDiscoverBrowse(req, res, u);
    return;
  }
  const movies = [];
  const tv = [];
  let error = null;
  const key = seerrApiKey();
  note(`api discover seerr=${key ? "yes" : "NO"}`);
  if (!key) {
    try {
      const [mRes, tRes] = await Promise.all([
        fetch("https://v3-cinemeta.strem.io/catalog/movie/top.json", {
          signal: AbortSignal.timeout(8000),
        }).then((res) => res.json()),
        fetch("https://v3-cinemeta.strem.io/catalog/series/top.json", {
          signal: AbortSignal.timeout(8000),
        }).then((res) => res.json()),
      ]);
      const cMovies = (mRes.metas || []).map((h) => ({
        id: h.id?.startsWith("tt") ? "imdb-" + h.id : h.id,
        kind: "movie",
        title: h.name || "Untitled",
        year: parseInt(h.releaseInfo || h.year) || 0,
        overview: h.description || "",
        poster: (h.poster || "").replace("/small/", "/medium/"),
        rating: parseFloat(h.imdbRating) || 0,
        genres: h.genres || [],
        maxQuality: "4k",
        popularity: 50,
      }));
      const cTv = (tRes.metas || []).map((h) => ({
        id: h.id?.startsWith("tt") ? "imdb-" + h.id : h.id,
        kind: "tv",
        title: h.name || "Untitled",
        year: parseInt(h.releaseInfo || h.year) || 0,
        overview: h.description || "",
        poster: (h.poster || "").replace("/small/", "/medium/"),
        rating: parseFloat(h.imdbRating) || 0,
        genres: h.genres || [],
        maxQuality: "4k",
        popularity: 50,
      }));
      send(res, 200, { movies: cMovies, tv: cTv, error: null });
    } catch (e) {
      send(res, 200, { movies, tv, error: null });
    }
    return;
  }
  try {
    const [movieRes, movieRes2, tvRes, tvRes2] = await Promise.all([
      seerrFetch("/api/v1/discover/movies?page=1", { key, ms: 45000 }),
      seerrFetch("/api/v1/discover/movies?page=2", { key, ms: 45000 }),
      seerrFetch("/api/v1/discover/tv?page=1", { key, ms: 45000 }),
      seerrFetch("/api/v1/discover/tv?page=2", { key, ms: 45000 }),
    ]);
    if (!movieRes.ok && !tvRes.ok) {
      error =
        movieRes.status === 403 || tvRes.status === 403
          ? "Request UI is still finishing setup. Wait, then refresh Discover."
          : `seerr ${movieRes.status || tvRes.status}`;
      note(`seerr discover movies=${movieRes.status} tv=${tvRes.status}`);
      send(res, 200, { movies, tv, error });
      return;
    }
    const excludeIds = await ownedDiscoverExclude();
    const excludeHidden = readRequestCurator(req);
    const boostIds = excludeHidden.liked || [];
    const movieHits = [
      ...(Array.isArray(movieRes.json)
        ? movieRes.json
        : movieRes.json?.results || []),
      ...(movieRes2.ok
        ? Array.isArray(movieRes2.json)
          ? movieRes2.json
          : movieRes2.json?.results || []
        : []),
    ];
    const tvHits = [
      ...(Array.isArray(tvRes.json) ? tvRes.json : tvRes.json?.results || []),
      ...(tvRes2.ok
        ? Array.isArray(tvRes2.json)
          ? tvRes2.json
          : tvRes2.json?.results || []
        : []),
    ];
    if (movieRes.ok || movieRes2.ok) {
      movies.push(
        ...mapSeerrDiscoverResults(movieHits, {
          mediaType: "movie",
          limit: 16,
          excludeIds,
          excludeHidden,
          boostIds,
        }),
      );
    } else {
      note(`seerr discover movies ${movieRes.status}`);
    }
    if (tvRes.ok || tvRes2.ok) {
      tv.push(
        ...mapSeerrDiscoverResults(tvHits, {
          mediaType: "tv",
          limit: 16,
          excludeIds,
          excludeHidden,
          boostIds,
        }),
      );
    } else {
      note(`seerr discover tv ${tvRes.status}`);
    }
    if (!movies.length && !tv.length) {
      error = error || "Seerr has nothing new to show yet.";
    }
    const similarBoost = await likedSimilarTitles(excludeHidden, {
      key,
      excludeIds,
      excludeHidden,
    });
    if (similarBoost.movies.length) {
      movies.splice(
        0,
        movies.length,
        ...mergeLikedSimilar(movies, similarBoost.movies, {
          limit: 16,
          excludeHidden,
        }),
      );
    }
    if (similarBoost.tv.length) {
      tv.splice(
        0,
        tv.length,
        ...mergeLikedSimilar(tv, similarBoost.tv, { limit: 16, excludeHidden }),
      );
    }
    note(`seerr discover movies=${movies.length} tv=${tv.length}`);
  } catch (e) {
    error = lookupFailureMessage(e);
    note(`seerr discover ${e}`);
  }
  send(res, 200, { movies, tv, error });
}

function tmdbIdFromQuery(raw) {
  const s = String(raw || "").trim();
  if (!s) return 0;
  const n = Number(
    s.replace(/^(person-|collection-|tmdb-tv-|tmdb-|tvdb-)/, ""),
  );
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function likedSimilarTitles(curator, { key, excludeIds, excludeHidden }) {
  const empty = { movies: [], tv: [] };
  const liked = recentLikedIds(curator, 4);
  if (!liked.length || !key) return empty;
  try {
    const jobs = liked.map((id) => {
      const parsed = parseTitleId(id);
      if (!parsed?.tmdb) return Promise.resolve(null);
      const kind = parsed.mediaType === "tv" ? "tv" : "movie";
      const base =
        kind === "tv"
          ? `/api/v1/tv/${parsed.tmdb}`
          : `/api/v1/movie/${parsed.tmdb}`;
      return seerrFetch(`${base}/similar`, { key, ms: 8000 }).then((r) => ({
        kind,
        json: r.json,
      }));
    });
    const rows = await Promise.all(jobs);
    const movieHits = [];
    const tvHits = [];
    for (const row of rows) {
      if (!row) continue;
      const hits = Array.isArray(row.json) ? row.json : row.json?.results || [];
      if (row.kind === "tv") tvHits.push(...hits);
      else movieHits.push(...hits);
    }
    return {
      movies: mapSeerrDiscoverResults(movieHits, {
        mediaType: "movie",
        limit: 8,
        excludeIds,
        excludeHidden,
      }),
      tv: mapSeerrDiscoverResults(tvHits, {
        mediaType: "tv",
        limit: 8,
        excludeIds,
        excludeHidden,
      }),
    };
  } catch {
    return empty;
  }
}

async function handleSimilar(req, res) {
  const u = new URL(req.url ?? "", "http://reelos.local");
  const parsed =
    parseTitleId(u.searchParams.get("id") || "") ||
    parseTitleId(`tmdb-${u.searchParams.get("id") || ""}`);
  const titles = [];
  let error = null;
  const key = seerrApiKey();
  if (!parsed?.tmdb) {
    send(res, 200, { titles, error: "Need a TMDB title id." });
    return;
  }
  if (!key) {
    send(res, 200, { titles, error: null });
    return;
  }
  try {
    const kind = parsed.mediaType === "tv" ? "tv" : "movie";
    const base =
      kind === "tv"
        ? `/api/v1/tv/${parsed.tmdb}`
        : `/api/v1/movie/${parsed.tmdb}`;
    const [sim, rec] = await Promise.all([
      seerrFetch(`${base}/similar`, { key, ms: 20000 }),
      seerrFetch(`${base}/recommendations`, { key, ms: 20000 }),
    ]);
    const hits = [
      ...(Array.isArray(sim.json) ? sim.json : sim.json?.results || []),
      ...(Array.isArray(rec.json) ? rec.json : rec.json?.results || []),
    ];
    const excludeIds = discoverOwnedIndex(titlesForResolve());
    titles.push(
      ...mapSeerrSimilarResults(hits, {
        mediaType: kind,
        limit: 16,
        excludeIds,
        excludeHidden: readRequestCurator(req),
      }),
    );
    if (!titles.length) error = "Seerr has nothing similar to show yet.";
  } catch (e) {
    error = lookupFailureMessage(e);
  }
  send(res, 200, { titles, error });
}

async function readBoundedPrivateBody(request) {
    const limit = 65536;
    if (request._body) {
      if (Buffer.byteLength(JSON.stringify(request._body)) > limit) throw Object.assign(new Error("Request too large"), { status: 413 });
      return request._body;
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      const buffer = Buffer.from(chunk);
      size += buffer.length;
      if (size > limit) throw Object.assign(new Error("Request too large"), { status: 413 });
      chunks.push(buffer);
    }
    return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

async function handlePrivateCurator(req, res) {
  const result = await processPrivateCuratorRequest(req, readBoundedPrivateBody, {
    stateDir: process.env.REELOS_STATE,
    profilesDir: process.env.REELOS_PROFILES_DIR,
    catalog: async (request) => {
      const { readPlaybackLibraryItems, authorizePlaybackItem } = await import("./services/playback-access-service.mjs");
      const accessible = readPlaybackLibraryItems().filter((item) => authorizePlaybackItem(request, item).ok);
      return {
        movies: accessible.filter((item) => !["tv", "series", "show"].includes(item.kind || item.type)),
        tv: accessible.filter((item) => ["tv", "series", "show"].includes(item.kind || item.type)),
        // Books use their guarded reader/catalog adapter, not a raw household file.
        books: [],
      };
    },
  });
  send(res, result.status, result.payload);
}

const handleCurator = handlePrivateCurator;
const handleCuratorReset = handlePrivateCurator;
const handleCuratorFeed = handlePrivateCurator;
const handleCuratorTeach = handlePrivateCurator;
const handleCuratorTaste = handlePrivateCurator;

async function probeJson(url, ms = 3000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, json };
  } catch {
    return { ok: false, json: null };
  } finally {
    clearTimeout(t);
  }
}

// Unique DeviceId: doctor + selfheal used to share "reelos" and revoke the box token (401 / red chip).
const JF_AUTH =
  'MediaBrowser Client="ReelOS", Device="ReelOS", DeviceId="reelos-box", Version="1.2.50.33"';

export function jellyfinAuthedHeaders(token) {
  const auth = token ? `${JF_AUTH}, Token="${token}"` : JF_AUTH;
  const headers = {
    Authorization: auth,
    "X-Emby-Authorization": auth,
  };
  if (token) headers["X-Emby-Token"] = token;
  return headers;
}

const JF_NETWORK_XML = `<?xml version="1.0" encoding="utf-8"?>
<NetworkConfiguration xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <EnableUPnP>false</EnableUPnP>
  <EnableIPv4>true</EnableIPv4>
  <EnableIPv6>false</EnableIPv6>
  <EnableRemoteAccess>true</EnableRemoteAccess>
  <RequireHttps>false</RequireHttps>
  <AutoDiscovery>true</AutoDiscovery>
  <EnablePublishedServerUriByRequest>true</EnablePublishedServerUriByRequest>
</NetworkConfiguration>
`;

function xmlSetTag(text, tag, value) {
  const pat = new RegExp(`<${tag}>[^<]*</${tag}>`, "i");
  const repl = `<${tag}>${value}</${tag}>`;
  if (pat.test(text)) return text.replace(pat, repl);
  if (text.includes("</EncodingOptions>")) {
    return text.replace("</EncodingOptions>", `  ${repl}\n</EncodingOptions>`);
  }
  return text;
}

const JF_ENCODING_XML = `<?xml version="1.0" encoding="utf-8"?>
<EncodingOptions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <EncodingThreadCount>1</EncodingThreadCount>
  <EnableThrottling>true</EnableThrottling>
  <EnableSegmentDeletion>true</EnableSegmentDeletion>
  <SegmentKeepSeconds>60</SegmentKeepSeconds>
  <HardwareAccelerationType>none</HardwareAccelerationType>
  <EnableHardwareEncoding>false</EnableHardwareEncoding>
  <EnableSubtitleExtraction>false</EnableSubtitleExtraction>
  <EncoderPreset>veryfast</EncoderPreset>
  <AllowHevcEncoding>false</AllowHevcEncoding>
  <VaapiDevice>/dev/dri/renderD128</VaapiDevice>
</EncodingOptions>
`;

function seedJellyfinEncodingXml(composeDir) {
  const dest = `${composeDir}/configs/jellyfin/config/encoding.xml`;
  try {
    mkdirSync(`${composeDir}/configs/jellyfin/config`, { recursive: true });
    const hasDri = hasVaapiDri();
    let text = existsSync(dest) ? readFileSync(dest, "utf8") : JF_ENCODING_XML;
    if (!text.includes("</EncodingOptions>")) text = JF_ENCODING_XML;
    text = xmlSetTag(
      text,
      "HardwareAccelerationType",
      hasDri ? "vaapi" : "none",
    );
    text = xmlSetTag(text, "EnableHardwareEncoding", hasDri ? "true" : "false");
    text = xmlSetTag(text, "AllowHevcEncoding", hasDri ? "true" : "false");
    text = xmlSetTag(text, "EnableSubtitleExtraction", "false");
    text = xmlSetTag(text, "EnableThrottling", "true");
    text = xmlSetTag(text, "EnableSegmentDeletion", "true");
    writeFileSync(dest, text);
  } catch {
    /* */
  }
}

function seedJellyfinNetworkXml(composeDir) {
  const dest = `${composeDir}/configs/jellyfin/config/network.xml`;
  try {
    mkdirSync(`${composeDir}/configs/jellyfin/config`, { recursive: true });
    if (existsSync(dest)) {
      const text = readFileSync(dest, "utf8");
      if (/<EnablePublishedServerUriByRequest>\s*true\s*</i.test(text)) return;
      if (text.includes("<EnablePublishedServerUriByRequest>")) {
        writeFileSync(
          dest,
          text.replace(
            /<EnablePublishedServerUriByRequest>[^<]*<\/EnablePublishedServerUriByRequest>/,
            "<EnablePublishedServerUriByRequest>true</EnablePublishedServerUriByRequest>",
          ),
        );
        return;
      }
      if (text.includes("</NetworkConfiguration>")) {
        writeFileSync(
          dest,
          text.replace(
            "</NetworkConfiguration>",
            "  <EnablePublishedServerUriByRequest>true</EnablePublishedServerUriByRequest>\n</NetworkConfiguration>",
          ),
        );
        return;
      }
    }
    writeFileSync(dest, JF_NETWORK_XML);
  } catch {
    /* */
  }
}

async function revealJellyfinAdmin(token, user) {
  try {
    let me = user;
    if (!me?.Id || !me.Policy) {
      const r = await fetch("http://127.0.0.1:8096/Users/Me", {
        headers: jellyfinAuthedHeaders(token),
      });
      me = r.ok ? await r.json() : null;
    }
    if (!me?.Id || !me.Policy || typeof me.Policy !== "object") return;
    if (me.Policy.IsHidden === false) return;
    await fetch(`http://127.0.0.1:8096/Users/${me.Id}/Policy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...jellyfinAuthedHeaders(token),
      },
      body: JSON.stringify({ ...me.Policy, IsHidden: false }),
    });
  } catch {
    /* */
  }
}

async function jellyfinToken(user, password) {
  const cached = jellyfinTokens.get(user, password);
  if (cached) return cached;
  try {
    const r = await fetch("http://127.0.0.1:8096/Users/AuthenticateByName", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: JF_AUTH,
        "X-Emby-Authorization": JF_AUTH,
      },
      body: JSON.stringify({ Username: user, Pw: password }),
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const auth = { token: j.AccessToken, id: j.User?.Id };
    if (auth.token) void revealJellyfinAdmin(auth.token, j.User);
    jellyfinTokens.set(user, password, auth);
    return auth;
  } catch {
    return null;
  }
}

async function jellyfinFetchItems(
  auth,
  { limit, timeout = JELLYFIN_ITEMS_TIMEOUT_MS } = {},
) {
  const pull = (token) =>
    fetch(libraryItemsUrl({ limit }), {
      headers: jellyfinAuthedHeaders(token),
      signal: AbortSignal.timeout(timeout),
    });
  let token = auth?.token;
  if (!token) return { ok: false, status: 0, json: null };
  let r = await pull(token);
  if (r.status === 401 || r.status === 403) {
    jellyfinTokens.clear();
    const a = answers();
    const next = await jellyfinToken(
      a.adminName || "reelos",
      a.adminPassword || "reelos",
    );
    if (!next?.token) return { ok: false, status: r.status, json: null };
    token = next.token;
    r = await pull(token);
  }
  if (!r.ok) return { ok: false, status: r.status, json: null };
  return { ok: true, status: r.status, json: await r.json() };
}

async function jellyfinFetchResume(
  auth,
  { limit = 24, timeout = JELLYFIN_ITEMS_TIMEOUT_MS } = {},
) {
  const url = jellyfinResumeUrl(auth?.id, { limit });
  if (!url || !auth?.token) return { ok: false, status: 0, json: null };
  const pull = (token) =>
    fetch(url, {
      headers: jellyfinAuthedHeaders(token),
      signal: AbortSignal.timeout(timeout),
    });
  let token = auth.token;
  let r = await pull(token);
  if (r.status === 401 || r.status === 403) {
    jellyfinTokens.clear();
    const a = answers();
    const next = await jellyfinToken(
      a.adminName || "reelos",
      a.adminPassword || "reelos",
    );
    if (!next?.token) return { ok: false, status: r.status, json: null };
    token = next.token;
    r = await pull(token);
  }
  if (!r.ok) return { ok: false, status: r.status, json: null };
  return { ok: true, status: r.status, json: await r.json() };
}

async function libraryResumePayload(auth) {
  const pulled = await jellyfinFetchResume(auth);
  return pulled.ok ? pulled.json : null;
}

async function jellyfinState(_ip) {
  // Jellyfin media server daemon is permanently dead legacy (GROUND-TRUTH.md §Graveyard).
  // The Jellyfin shim (jellyfin-shim-service.mjs) exists only for optional third-party player
  // compatibility (Swiftfin, Infuse). Zero :8096 probes, zero Jellyfin daemon checks.
  return {
    state: "green",
    detail: "ReelOS native cinema engine active",
    libraries: [],
  };
}

async function readJellyfinVirtualFolders(token) {
  const urls = [
    "http://127.0.0.1:8096/Library/VirtualFolders",
    `http://127.0.0.1:8096/Library/VirtualFolders?api_key=${encodeURIComponent(token)}`,
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: jellyfinAuthedHeaders(token),
        signal: AbortSignal.timeout(4000),
      });
      if (r.status === 401 || r.status === 403) continue;
      if (!r.ok) continue;
      const folders = await r.json();
      if (Array.isArray(folders)) return folders;
    } catch {
      /* timeout / 401 — try api_key next, like doctor */
    }
  }
  return null;
}

function saveAuthUrl(url) {
  if (!url) return;
  try {
    mkdirSync("/var/lib/reelos", { recursive: true });
    writeFileSync("/var/lib/reelos/tailscale-auth.url", `${url}\n`, {
      mode: 0o644,
    });
  } catch {
    /* */
  }
}

function grabLoginUrl(bin) {
  const st = tailscaleState();
  if (st.auth) return st.auth;
  const slug =
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 6)
      : Math.random().toString(36).slice(2, 8);
  const hostname = `reelos-${slug}`;
  const r = spawnSync(
    bin,
    ["login", `--hostname=${hostname}`, "--timeout=20s"],
    { encoding: "utf8", timeout: 25000 },
  );
  const blob = `${r.stdout || ""}\n${r.stderr || ""}`;
  const m = blob.match(/https:\/\/login\.tailscale\.com\/[^\s]+/);
  if (m) {
    saveAuthUrl(m[0]);
    return m[0];
  }
  const up = spawnSync(bin, ["up", `--hostname=${hostname}`, "--timeout=12s"], {
    encoding: "utf8",
    timeout: 20000,
  });
  const blob2 = `${up.stdout || ""}\n${up.stderr || ""}`;
  const m2 = blob2.match(/https:\/\/login\.tailscale\.com\/[^\s]+/);
  if (m2) {
    saveAuthUrl(m2[0]);
    return m2[0];
  }
  return tailscaleState().auth;
}

function tailscaleAuthUrl() {
  return tailscaleState().auth;
}

let boxProbeCache = { at: 0, jf: null, ts: null };
const BOX_PROBE_CACHE_MS = 15_000;
let boxProbeInflight = false;

function scheduleBoxProbe(ip) {
  if (boxProbeInflight) return;
  boxProbeInflight = true;
  void jellyfinState(ip)
    .then((jf) => {
      boxProbeCache = { at: Date.now(), jf, ts: tailscaleState() };
    })
    .catch(() => {})
    .finally(() => {
      boxProbeInflight = false;
    });
}

function isFuseOffline() {
  const a = answers();
  if (a.source === "local-vpn") return false;
  const debridMounted =
    existsSync("/mnt/debrid/__all__") || existsSync("/mnt/debrid/version.txt");
  const torboxMounted =
    existsSync("/mnt/torbox") && existsSync("/mnt/torbox/torrents");
  if (debridMounted || torboxMounted) return false;
  if (process.env.REELOS_STATE ? readProvisioningMarkers().provisioned : existsSync("/var/lib/reelos/provisioned")) return true;
  return false;
}

export function readProvisioningMarkers({ stateDir = process.env.REELOS_STATE, cwd = process.cwd() } = {}) {
  // Explicit installations and isolated tests must never inherit another home's
  // markers. Keep the historical production lookup only when no state is set.
  const roots = stateDir
    ? [dirname(resolveAnswersPath({ stateDir, cwd }))]
    : ["/var/lib/reelos", join(cwd, ".reelos-state")];
  const marker = (name) => roots.map((root) => join(root, name)).find((file) => existsSync(file));
  const errorFile = marker("provision.error");
  return {
    provisioned: Boolean(marker("provisioned")),
    provisioning: Boolean(marker("provisioning")),
    provisionError: errorFile ? readFileSync(errorFile, "utf8").trim() : "",
  };
}

function boxSyncSlice() {
  const a = answers();
  const ip = ipv4();
  const now = Date.now();
  const fresh =
    Boolean(boxProbeCache.jf) && now - boxProbeCache.at < BOX_PROBE_CACHE_MS;
  if (!fresh) scheduleBoxProbe(ip);
  const jellyfin = boxProbeCache.jf || {
    state: "amber",
    detail: "Still starting",
    libraries: [],
  };
  const ts = boxProbeCache.ts ||
    tailscaleCache.val || {
      installed: a.access === "tailscale",
      up: a.access === "tailscale",
      state: "unknown",
      auth: null,
      ip: null,
      dns: null,
      tailnet: null,
    };
  // Sovereign Off-Network Invariant: prefer anonymized Tailscale MagicDNS over raw LAN IP.
  const magicDnsBase = ts.dns
    ? ts.dns.startsWith("http")
      ? ts.dns
      : `https://${ts.dns}`
    : null;
  return {
    ...readProvisioningMarkers(),
    ipv4: ip,
    watch: magicDnsBase
      ? `${magicDnsBase}:8080`
      : ip
        ? `http://${ip}:8080`
        : "",
    seerr: ip ? `http://${ip}:5055` : "",
    ui: magicDnsBase || (ip ? `http://${ip}` : ""),
    jellyfin,
    frontend: a.frontend || "jellyfin",
    access: a.access || "lan",
    adminName: a.adminName || "reelos",
    answers: a,
    fuseOffline: isFuseOffline(),
    tailscaleAuth: ts.auth,
    tailscaleInstalled: ts.installed,
    tailscaleUp: ts.up,
    tailscaleIp: ts.ip,
    tailscaleDns: ts.dns,
    tailscaleMagicDnsUrl: ts.dns
      ? ts.dns.startsWith("http")
        ? ts.dns
        : `https://${ts.dns}`
      : null,
    tailscaleState: ts.state,
    tailnet: ts.tailnet,
    hardware: (() => {
      const hwPath = hardwareProfilePath();
      let saved = loadSavedHardware({ path: hwPath });
      if (!saved) {
        runHardwareEnsure();
        saved = loadSavedHardware({ path: hwPath });
      }
      return publicHardware(saved, readHostMemKb());
    })(),
  };
}

async function handleBox(_req, res) {
  const slice = boxSyncSlice();
  send(res, 200, {
    ...slice,
    adminPassword: slice.answers.adminPassword || "reelos",
  });
}

async function handleTailscaleLogin(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false, error: "POST only" });
    return;
  }
  const a = answers();
  a.access = "tailscale";
  try {
    atomicWriteJsonSync("/var/lib/reelos/answers.json", a, { mode: 0o600 });
  } catch (e) {
    send(res, 500, { ok: false, error: String(e) });
    return;
  }
  let bin = tailscaleBin();
  if (!bin) {
    const log = "/var/lib/reelos/tailscale-install.log";
    const out = openSync(log, "a");
    const cp = spawn(
      "bash",
      ["-lc", "curl -fsSL https://tailscale.com/install.sh | sh"],
      {
        detached: true,
        stdio: ["ignore", out, out],
      },
    );
    cp.on("error", () => {});
    cp.unref();
    send(res, 200, {
      ok: true,
      started: true,
      installed: false,
      up: false,
      auth: null,
    });
    return;
  }
  spawnSync("systemctl", ["enable", "--now", "tailscaled"], { timeout: 8000 });
  const st = tailscaleState();
  if (st.up) {
    send(res, 200, {
      ok: true,
      installed: true,
      up: true,
      ip: st.ip,
      dns: st.dns,
      tailnet: st.tailnet,
      auth: null,
    });
    return;
  }
  const url = grabLoginUrl(bin);
  send(res, 200, {
    ok: true,
    installed: true,
    up: false,
    auth: url,
    state: tailscaleState().state,
  });
}

async function handleTailscaleInstall(req, res) {
  return handleTailscaleLogin(req, res);
}

async function handleTailscaleCheck(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  spawnSync("systemctl", ["enable", "--now", "tailscaled"], { timeout: 8000 });
  const st = tailscaleState();
  if (st.up) {
    try {
      spawnSync("rm", ["-f", "/var/lib/reelos/tailscale-auth.url"]);
    } catch {
      /* */
    }
  }
  send(res, 200, {
    ok: true,
    up: st.up,
    installed: st.installed,
    ip: st.ip,
    dns: st.dns,
    tailnet: st.tailnet,
    auth: st.auth,
    state: st.state,
  });
}

function tailscaleServeState() {
  const bin = tailscaleBin();
  if (!bin) return { enabled: false, url: null };
  const st = tailscaleState();
  if (!st.up || !st.dns) return { enabled: false, url: null };
  try {
    const r = spawnSync(bin, ["serve", "status", "--json"], {
      encoding: "utf8",
      timeout: 6000,
    });
    const out = (r.stdout || "").trim();
    if (
      out &&
      !out.includes("no serve config") &&
      !out.includes("null") &&
      out !== "{}"
    ) {
      try {
        const j = JSON.parse(out);
        if (j.Web && Object.keys(j.Web).length > 0) {
          return { enabled: true, url: `https://${st.dns}` };
        }
      } catch {
        if (out.includes("https://")) {
          return { enabled: true, url: `https://${st.dns}` };
        }
      }
    }
  } catch {
    /* */
  }
  return { enabled: false, url: `https://${st.dns}` };
}

async function handleTailscaleServe(req, res) {
  const method = (req.method || "GET").toUpperCase();
  const bin = tailscaleBin();
  if (!bin) {
    send(res, 200, { ok: false, error: "Tailscale is not installed." });
    return;
  }
  const st = tailscaleState();
  if (!st.up) {
    send(res, 200, {
      ok: false,
      error: "Tailscale is not connected. Sign in first.",
    });
    return;
  }
  if (method === "GET") {
    const serve = tailscaleServeState();
    send(res, 200, { ok: true, ...serve, dns: st.dns, ip: st.ip });
    return;
  }
  if (method === "POST") {
    const body = await readBody(req);
    const enable = body.enable !== false;
    if (enable) {
      spawnSync(bin, ["serve", "--bg", "8080"], {
        encoding: "utf8",
        timeout: 15000,
      });
      const serve = tailscaleServeState();
      send(res, 200, {
        ok: true,
        enabled: true,
        url: serve.url || `https://${st.dns}`,
      });
    } else {
      spawnSync(bin, ["serve", "reset"], { encoding: "utf8", timeout: 10000 });
      send(res, 200, { ok: true, enabled: false, url: null });
    }
    return;
  }
  send(res, 405, { ok: false });
}

async function handleIndexer(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false, error: "POST only" });
    return;
  }
  const body = await readBody(req);
  const name = String(body.name || "Indexer").trim();
  const url = String(body.url || "").trim();
  const key = String(body.key || "").trim();
  if (!url || !key) {
    send(res, 400, { ok: false, error: "Need URL and API key" });
    return;
  }
  const prow = xmlKey("/opt/reelos/compose/configs/prowlarr/config.xml");
  if (!prow) {
    send(res, 503, { ok: false, error: "Prowlarr has no API key" });
    return;
  }
  try {
    const ping = await fetch("http://127.0.0.1:9696/api/v1/system/status", {
      headers: { "X-Api-Key": prow },
    });
    if (!ping.ok) {
      send(res, 503, {
        ok: false,
        error: `Prowlarr not answering (${ping.status})`,
      });
      return;
    }
    const r = await fetch("http://127.0.0.1:9696/api/v1/indexer", {
      method: "POST",
      headers: { "X-Api-Key": prow, "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        enable: true,
        appProfileId: 1,
        protocol: "torrent",
        implementation: "Torznab",
        implementationName: "Torznab",
        configContract: "TorznabSettings",
        fields: [
          { name: "baseUrl", value: url },
          { name: "apiPath", value: "/api" },
          { name: "apiKey", value: key },
        ],
      }),
    });
    const text = await r.text();
    if (!r.ok) {
      send(res, 502, {
        ok: false,
        error: `Prowlarr ${r.status}: ${text.slice(0, 200)}`,
      });
      return;
    }
    send(res, 200, { ok: true, engine: "prowlarr" });
  } catch (e) {
    send(res, 502, { ok: false, error: `Prowlarr ${e}` });
  }
}

function localVersion() {
  try {
    if (existsSync("/var/lib/reelos/installed-version")) {
      return (
        readFileSync("/var/lib/reelos/installed-version", "utf8").trim() || "0"
      );
    }
    if (existsSync("/opt/reelos/VERSION"))
      return readFileSync("/opt/reelos/VERSION", "utf8").trim();
  } catch {
    /* */
  }
  return "0";
}

async function fetchGh(url) {
  const accept = url.includes("/commits/")
    ? "application/vnd.github+json"
    : "application/vnd.github.raw";
  const r = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "ReelOS-update", Accept: accept },
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.text();
}

const CHANNEL_BETA_URL =
  process.env.CHANNEL_BETA_URL ||
  "https://raw.githubusercontent.com/reelos-org/reelos/main/channel-beta.json";

function channelFileName(name) {
  return name === "beta" ? "channel-beta.json" : "channel.json";
}

export function betaChannelStub(local = "0") {
  return {
    version: local,
    channel: "beta",
    notes: [
      "Beta channel unreachable. Arena chrome and Books ship on 2.0.0 when channel-beta.json is reachable. Stable remains the default.",
    ],
  };
}

function readLocalChannelFile(file) {
  for (const dir of [process.cwd(), "/opt/reelos/app", "/opt/reelos"]) {
    const p = `${dir}/${file}`;
    try {
      if (!existsSync(p)) continue;
      const parsed = JSON.parse(readFileSync(p, "utf8"));
      if (parsed?.version) return parsed;
    } catch {
      /* */
    }
  }
  return null;
}

async function loadChannel(name = "stable") {
  const file = channelFileName(name);
  const urls = [
    name === "beta" ? CHANNEL_BETA_URL : null,
    `https://api.github.com/repos/reelos-org/reelos/contents/${file}?ref=main`,
    `https://github.com/reelos-org/reelos/raw/refs/heads/main/${file}`,
    `https://raw.githubusercontent.com/reelos-org/reelos/main/${file}`,
    name === "beta"
      ? "https://raw.githubusercontent.com/reelos-org/reelos/cursor/beta-arena-books-5ba6/channel-beta.json"
      : null,
    name === "beta"
      ? "https://github.com/reelos-org/reelos/raw/refs/heads/cursor/beta-arena-books-5ba6/channel-beta.json"
      : null,
  ].filter(Boolean);
  const found = [];
  for (const u of urls) {
    try {
      const text = await fetchGh(u);
      const payload = text.trim().startsWith("{") ? text : null;
      let ch = null;
      if (payload) {
        const parsed = JSON.parse(payload);
        if (parsed.version) ch = parsed;
        else if (parsed.content) {
          const decoded = Buffer.from(
            String(parsed.content).replace(/\n/g, ""),
            "base64",
          ).toString("utf8");
          ch = JSON.parse(decoded);
        }
      }
      if (ch && ch.version) {
        otaNote(`channel ${ch.version} via ${u}`);
        if (name !== "beta") return ch;
        const tar = String(ch.tarball || "");
        const ver = String(ch.version || "");
        if (
          tar.includes("main.tar.gz") &&
          !(ver.startsWith("2.") || ver.includes("-beta"))
        ) {
          otaNote(`channel-beta stub — keep looking ${u}`);
          continue;
        }
        found.push(ch);
      }
    } catch (e) {
      otaNote(`miss ${u} ${e}`);
    }
  }
  const localFile = readLocalChannelFile(file);
  if (localFile) found.push(localFile);
  if (name === "beta") {
    if (!found.length) return betaChannelStub(localVersion());
    found.sort((a, b) => cmpVer(b.version, a.version));
    return found[0];
  }
  if (localFile) return localFile;
  return null;
}

function otaNote(msg) {
  try {
    appendFileSync(
      "/var/lib/reelos/ota.log",
      `${new Date().toISOString()} ${msg}\n`,
    );
  } catch {
    /* */
  }
}

async function handleUpdateCheck(_req, res) {
  const local = localVersion();
  const beta = readUiSettings().betaChannel === true;
  const inTreeArena = existsSync(
    new URL("./reelos-beta-sidecar.mjs", import.meta.url),
  );
  const channel = beta && !inTreeArena ? "beta" : "stable";
  const best = await loadChannel(channel);
  if (!best) {
    send(res, 200, {
      ok: false,
      local,
      remote: local,
      available: false,
      notes: [],
      currentNotes: [],
      pendingNotes: [],
      channel,
      error: "channel unreachable",
    });
    return;
  }
  const newer = cmpVer(best.version, local) > 0;
  const rollback = isRollback(local, best.version, beta);
  let head = "";
  let commitMsg = "";
  try {
    const t = await fetchGh(
      "https://api.github.com/repos/reelos-org/reelos/commits/main",
    );
    const j = JSON.parse(t);
    head = String(j.sha || "");
    commitMsg = String(j.commit?.message || "")
      .split("\n")[0]
      .trim();
  } catch {
    /* */
  }
  let applied = "";
  try {
    if (existsSync("/var/lib/reelos/applied-sha"))
      applied = readFileSync("/var/lib/reelos/applied-sha", "utf8").trim();
  } catch {
    /* */
  }
  // Beta Check is version-only. Main SHA drift must not offer Arena on stable
  // or overwrite a beta box with main.tar.gz. Rollback is an intentional older Apply.
  const shaDrift = !beta && !rollback && Boolean(head) && head !== applied;
  const channelNotes = Array.isArray(best.notes) ? best.notes : [];
  const notes = rollback
    ? pendingNotes(channelNotes, "0", best.version).length
      ? pendingNotes(channelNotes, "0", best.version)
      : [
          `Roll back to last stable ${best.version}. Arena chrome and Books leave with 2.0. Libraries stay.`,
        ]
    : shaDrift && !newer
      ? [
          commitMsg
            ? `Latest commit: ${commitMsg} (${head.slice(0, 7)})`
            : "This box is behind the latest code even though the version number matches.",
        ]
      : pendingNotes(channelNotes, local, best.version);
  send(res, 200, {
    ok: true,
    local,
    remote: best.version,
    notes,
    currentNotes: notesForVersion(channelNotes, local),
    pendingNotes: notes,
    available: newer || shaDrift || rollback,
    rollback,
    channel,
    sha: head.slice(0, 12),
  });
}

async function handleUpdateApply(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  if (applyIsRunning()) {
    send(res, 409, {
      ok: false,
      error: "Update already running",
      already: true,
    });
    return;
  }
  try {
    const beta = readUiSettings().betaChannel === true;
    const local = localVersion();
    const rollback = !beta && isBetaLine(local);
    let body = "";
    if (beta || rollback) {
      for (const p of [
        "/opt/reelos/bin/reelos-update.sh",
        "/opt/reelos/app/daemon/reelos-update.sh",
      ]) {
        try {
          if (!existsSync(p)) continue;
          const t = readFileSync(p, "utf8");
          if (
            t.includes("ReelOS") &&
            (beta
              ? t.includes("ui_wants_beta")
              : t.includes("leave beta for last stable"))
          ) {
            body = t;
            otaNote(`ui apply using local mailman ${p}`);
            break;
          }
        } catch {
          /* */
        }
      }
    }
    const urls = beta
      ? [
          "https://api.github.com/repos/reelos-org/reelos/contents/daemon/reelos-update.sh?ref=main",
          "https://github.com/reelos-org/reelos/raw/refs/heads/main/daemon/reelos-update.sh",
          "https://raw.githubusercontent.com/reelos-org/reelos/main/daemon/reelos-update.sh",
          "https://raw.githubusercontent.com/reelos-org/reelos/cursor/beta-arena-books-5ba6/daemon/reelos-update.sh",
          "https://github.com/reelos-org/reelos/raw/refs/heads/cursor/beta-arena-books-5ba6/daemon/reelos-update.sh",
        ]
      : [
          "https://api.github.com/repos/reelos-org/reelos/contents/daemon/reelos-update.sh?ref=main",
          "https://github.com/reelos-org/reelos/raw/refs/heads/main/daemon/reelos-update.sh",
          "https://raw.githubusercontent.com/reelos-org/reelos/main/daemon/reelos-update.sh",
        ];
    if (!body) {
      for (const u of urls) {
        try {
          const r = await fetch(u, {
            cache: "no-store",
            headers: {
              "User-Agent": "ReelOS-update",
              Accept: "application/vnd.github.raw",
            },
          });
          if (!r.ok) continue;
          const t = await r.text();
          if (!t.includes("ReelOS")) continue;
          if (beta && !t.includes("ui_wants_beta")) continue;
          if (
            rollback &&
            !t.includes("leave beta for last stable") &&
            !t.includes("ui_wants_beta")
          )
            continue;
          body = t;
          break;
        } catch {
          /* */
        }
      }
    }
    if (!body) {
      for (const p of [
        "/opt/reelos/bin/reelos-update.sh",
        "/opt/reelos/app/daemon/reelos-update.sh",
      ]) {
        try {
          if (!existsSync(p)) continue;
          const t = readFileSync(p, "utf8");
          if (t.includes("ReelOS")) {
            body = t;
            otaNote(`ui apply fallback to local mailman ${p}`);
            break;
          }
        } catch {
          /* */
        }
      }
    }
    if (!body.includes("ReelOS")) {
      send(res, 500, { ok: false, error: "could not download updater" });
      return;
    }
    mkdirSync("/var/lib/reelos", { recursive: true });
    writeFileSync("/var/lib/reelos/update-apply.sh", body, { mode: 0o755 });
    writeFileSync(
      "/etc/systemd/system/reelos-ota.service",
      `[Unit]
Description=ReelOS OTA
After=network-online.target

[Service]
Type=oneshot
TimeoutStartSec=infinity
KillMode=mixed
Environment=REELOS_OTA_UNIT=1
Environment=REELOS_ROOT=/opt/reelos
Environment=PYTHONUNBUFFERED=1
StandardOutput=append:/var/lib/reelos/ota.log
StandardError=append:/var/lib/reelos/ota.log
ExecStart=/bin/bash /var/lib/reelos/update-apply.sh apply
`,
    );
    spawnSync("systemctl", ["daemon-reload"], { encoding: "utf8" });
    const st = spawnSync("systemctl", ["is-active", "reelos-ota"], {
      encoding: "utf8",
    }).stdout.trim();
    if (st === "active" || st === "activating") {
      send(res, 200, { ok: true, started: true, already: true });
      return;
    }
    spawnSync("systemctl", ["reset-failed", "reelos-ota"], {
      encoding: "utf8",
    });
    const run = spawnSync("systemctl", ["start", "--no-block", "reelos-ota"], {
      encoding: "utf8",
    });
    if (run.status !== 0) {
      send(res, 500, {
        ok: false,
        error: (run.stderr || run.stdout || "could not start reelos-ota").slice(
          0,
          160,
        ),
      });
      return;
    }
    spawnSync("sleep", ["2"], { encoding: "utf8" });
    const st2 = spawnSync("systemctl", ["is-active", "reelos-ota"], {
      encoding: "utf8",
    }).stdout.trim();
    if (st2 === "failed") {
      const j = spawnSync(
        "journalctl",
        ["-u", "reelos-ota", "-n", "15", "--no-pager"],
        { encoding: "utf8" },
      );
      otaNote("ui apply reelos-ota.service failed");
      send(res, 500, {
        ok: false,
        error: (j.stdout || "reelos-ota failed").slice(0, 240),
      });
      return;
    }
    otaNote("ui apply started reelos-ota.service");
    send(res, 200, { ok: true, started: true });
  } catch (e) {
    send(res, 500, { ok: false, error: String(e).slice(0, 160) });
  }
}

function otaLogText() {
  try {
    if (!existsSync("/var/lib/reelos/ota.log")) return "";
    return readFileSync("/var/lib/reelos/ota.log", "utf8");
  } catch {
    return "";
  }
}

function lastOtaLines(n = 3) {
  try {
    const lines = otaLogText()
      .trim()
      .split("\n")
      .filter((l) => l && !l.includes("channel ") && !l.startsWith("----"));
    return lines.slice(-n).join("\n");
  } catch {
    return "";
  }
}

function applyProgressPayload(running) {
  return readApplyProgress({ running: Boolean(running) });
}

async function handleUpdateStatus(_req, res) {
  const logText = otaLogText();
  const running = applyProductRunning({ logText });
  const log = lastOtaLines(3);
  send(res, 200, {
    ok: true,
    local: localVersion(),
    running,
    held: applyIsRunning(),
    target: running ? applyTargetFromLog(logText) : null,
    log,
    library: readLibraryProgress(),
    progress: applyProgressPayload(running),
  });
}

async function handleUpdateProgress(_req, res) {
  const logText = otaLogText();
  const running = applyProductRunning({ logText });
  send(res, 200, { ok: true, ...applyProgressPayload(running) });
}

async function arrGet(url, key) {
  return pull(url, key);
}

async function arrPost(url, key, body) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 45000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "X-Api-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok && res.status !== 400)
      throw new Error(`${res.status} ${text.slice(0, 240)}`);
    return { ok: res.ok || res.status === 400, status: res.status, json, text };
  } finally {
    clearTimeout(t);
  }
}

async function firstRoot(base, key, prefer) {
  const roots = await arrGet(`${base}/rootfolder`, key);
  const list = Array.isArray(roots) ? roots : [];
  const hit =
    list.find((r) => r.path === prefer) ||
    list.find((r) => r.path === "/mnt/symlinks") ||
    list.find((r) => r.path === "/symlinks") ||
    list[0];
  return hit?.path || prefer;
}

async function namedProfile(base, key) {
  const want =
    {
      "1080p": "HD-1080p",
      hybrid: "Ultra-HD",
      "4k": "Ultra-HD",
      custom: "Any",
    }[answers().quality || "hybrid"] || "Ultra-HD";
  const qs = await arrGet(`${base}/qualityprofile`, key);
  const list = Array.isArray(qs) ? qs : [];
  return list.find((p) => p.name === want)?.id || list[0]?.id || 1;
}

function queueStatus(item) {
  const s = String(item?.status || "").toLowerCase();
  if (s.includes("fail") || s === "warning") return "failed";
  if (s.includes("download") || s === "downloading" || s === "paused")
    return "grabbing";
  return "queued";
}

const jellyfinRefreshed = new Map();
const JELLYFIN_REFRESH_DEBOUNCE_MS = 10 * 60 * 1000;

async function jellyfinRefresh(id) {
  if (!id) return;
  const now = Date.now();
  const last = jellyfinRefreshed.get(id) || 0;
  if (now - last < JELLYFIN_REFRESH_DEBOUNCE_MS) return;
  jellyfinRefreshed.set(id, now);
  if (jellyfinRefreshed.size > 500) {
    const oldestKey = jellyfinRefreshed.keys().next().value;
    if (oldestKey) jellyfinRefreshed.delete(oldestKey);
  }
  try {
    const a = answers();
    const auth = await jellyfinToken(
      a.adminName || "reelos",
      a.adminPassword || "reelos",
    );
    const headers = auth?.token ? jellyfinAuthedHeaders(auth.token) : {};
    await fetch("http://127.0.0.1:8096/Library/Refresh", {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    /* */
  }
}

function requestIdFromQuery(u) {
  const tmdb = String(u.searchParams.get("tmdb") || "").trim();
  const type = String(u.searchParams.get("type") || "").trim();
  let id = String(u.searchParams.get("id") || "").trim();
  if (!id && tmdb) id = type === "tv" ? `tmdb-tv-${tmdb}` : `tmdb-${tmdb}`;
  return id;
}

export function invalidateRequestListCache() {
  invalidateRequestProgressCache();
}

async function handleRequestList(res) {
  const sourcePolicy = sourcePolicyFromState({
    answers: answers(),
    uiSettings: readUiSettings(),
    env: process.env,
    validation: currentProviderValidation(),
  });
  if (!canDispatchProviderRequest(sourcePolicy)) {
    send(res, 200, {
      requests: [],
      titles: [],
      error: null,
      sourceMode: "public-personal",
    });
    return;
  }
  const payload = await collectRequestList();
  send(res, 200, payload);
}

async function handleRequestStatus(req, res) {
  const u = new URL(req.url || "/", "http://reelos.local");
  const id = requestIdFromQuery(u);
  if (!id) {
    return handleRequestList(res);
  }
  const sourcePolicy = sourcePolicyFromState({
    answers: answers(),
    uiSettings: readUiSettings(),
    env: process.env,
    validation: currentProviderValidation(),
  });
  if (!canDispatchProviderRequest(sourcePolicy)) {
    send(res, 409, { status: "unavailable", ...providerUnavailablePayload() });
    return;
  }
  const key = seerrApiKey();
  if (!key) {
    send(res, 200, { status: "unknown", engine: "seerr", error: null });
    return;
  }
  try {
    const parsed = await resolveLiveParsed(parseTitleId(id));
    const seasonRaw = u.searchParams.get("season");
    const season =
      seasonRaw != null && seasonRaw !== "" ? Number(seasonRaw) : undefined;
    if (!parsed?.tmdb) {
      const titles = titlesForResolve();
      if (libraryHasTitle(titles, id)) {
        const facts = await loadPresenceFacts().catch(() => ({
          arrIndex: null,
          libraryTitles: titles,
        }));
        send(
          res,
          200,
          titleRequestSeasonPayload({
            id,
            season,
            parsed,
            facts: { ...facts, requests: facts.requests || [] },
            libraryTitles: facts.libraryTitles || titles,
            honest: { titleId: id, status: "unknown", engine: "unknown" },
            title: findLibraryTitle(titles, id),
          }),
        );
        return;
      }
      send(res, 400, {
        status: "unknown",
        error: "Need a TMDB id from Discover",
      });
      return;
    }
    const path =
      parsed.mediaType === "tv"
        ? `/api/v1/tv/${parsed.tmdb}`
        : `/api/v1/movie/${parsed.tmdb}`;
    const r = await seerrFetch(path, { key, ms: 15000 });
    const media = r.json?.mediaInfo || r.json?.media || {};
    const reqs = Array.isArray(media.requests) ? media.requests : [];
    const last = pickSeerrRequestForTitle(reqs, {
      media: { ...media, tmdbId: parsed.tmdb },
      mediaType: parsed.mediaType,
      season,
    });
    const mappedRows = (reqs.length ? reqs : last ? [last] : []).map((item) =>
      seerrRequestRow({
        ...item,
        media: { ...media, tmdbId: parsed.tmdb, ...(item.media || {}) },
        type: parsed.mediaType,
      }),
    );
    const mapped =
      mappedRows[0] ||
      seerrRequestRow({
        ...last,
        media: { ...media, tmdbId: parsed.tmdb },
        type: parsed.mediaType,
      });
    const facts = await loadPresenceFacts();
    const seerrMediaByTitleId = { [mapped.titleId]: media };
    const honestRows = honestifyRequests(
      mappedRows.length ? mappedRows : [mapped],
      { ...facts, seerrMediaByTitleId },
    );
    const honest =
      (season != null && Number.isFinite(season)
        ? honestRows.find((row) => Number(row.season) === Number(season))
        : null) ||
      honestRows[0] ||
      mapped;
    const title = attachTitleAliases(
      seerrSearchHit(
        { ...r.json, id: Number(parsed.tmdb), mediaType: parsed.mediaType },
        parsed.mediaType,
      ),
      parsed,
    );
    const body = titleRequestSeasonPayload({
      id,
      season,
      parsed,
      facts: { ...facts, requests: honestRows },
      libraryTitles: facts.libraryTitles || titlesForResolve(),
      honest,
      title,
    });
    if (body.status === "downloaded") await jellyfinRefresh(id);
    send(res, 200, body);
  } catch (e) {
    send(res, 200, { status: "unknown", engine: "seerr", error: String(e) });
  }
}

async function handleRequestDelete(req, res) {
  const body = await readBody(req);
  const result = await processRequestCancellation({
    body,
    cancelFn: cancelRequest,
    seerrKey: seerrApiKey(),
    seerrFetch,
    radarrKey: arrApiKey("radarr"),
    sonarrKey: arrApiKey("sonarr"),
    fetchArr: arrJson,
  });
  if (!result.ok) {
    send(res, result.status, { ok: false, error: result.error });
    return;
  }
  invalidateRequestProgressCache();
  invalidateRequestListCache();
  send(res, 200, result.data);
}

async function triggerReelFlowFulfill({
  title,
  year,
  tmdb,
  mediaType,
  season,
  episode,
}) {
  try {
    const sourceSettings = readUiSettings();
    const providerPolicy = sourcePolicyFromState({
      answers: answers(), uiSettings: sourceSettings, env: process.env,
      validation: currentProviderValidation(),
    });
    if (!providerPolicy.connected) return { ok: false, reason: "provider_not_connected" };
    const authorizeProvider = () => {
      const current = sourcePolicyFromState({
        answers: answers(), uiSettings: readUiSettings(), env: process.env,
        validation: currentProviderValidation(),
      });
      return current.connected && current.accountScope === providerPolicy.accountScope;
    };
    note(
      `reelflow fulfill start: ${title} (${year || ""}) type=${mediaType} season=${season ?? ""}`,
    );
    const results = await searchAndScoreReleases(
      {
        title,
        year: year ? parseInt(year, 10) : undefined,
        season: season != null ? parseInt(season, 10) : null,
        episode: episode != null ? parseInt(episode, 10) : null,
      },
      {
        provider: providerPolicy.provider,
        apiKey: providerPolicy.apiKey,
        accountScope: providerPolicy.accountScope,
        fetchImpl: (url, options) => {
          if (!authorizeProvider()) throw new Error("Provider connection changed.");
          return fetch(url, options);
        },
        enabledIndexerIds: sourceSettings.enabledIndexerIds || [],
      },
    );

    const best = results.find((r) => r.isCached) || results[0];
    if (!best || !best.infoHash) {
      note(`reelflow no releases found for ${title}`);
      return { ok: false, reason: "no_releases" };
    }

    note(
      `reelflow selected: ${best.title} score=${best.score} cached=${best.isCached}`,
    );
    const magnet = `magnet:?xt=urn:btih:${best.infoHash}&dn=${encodeURIComponent(best.title)}`;
    const category = mediaType === "tv" ? "tv" : "movies";
    const currentPolicy = sourcePolicyFromState({
      answers: answers(), uiSettings: readUiSettings(), env: process.env,
      validation: currentProviderValidation(),
    });
    if (!currentPolicy.connected || currentPolicy.accountScope !== providerPolicy.accountScope) {
      return { ok: false, reason: "provider_connection_changed" };
    }
    const dispatchRes = await dispatchTorrent(magnet, {
      category,
      provider: currentPolicy.provider,
      apiKey: currentPolicy.apiKey,
      accountScope: currentPolicy.accountScope,
      authorize: authorizeProvider,
    });

    if (!dispatchRes.ok) {
      note(`reelflow dispatch failed: ${dispatchRes.error}`);
      return { ok: false, reason: dispatchRes.error };
    }

    if (best.isCached) {
      setTimeout(async () => {
        try {
          const files = findMediaFilesOnDebrid(
            "/mnt/debrid",
            best.title,
            best.infoHash,
          );
          if (files.length > 0) {
            if (mediaType === "tv") {
              linkTvEpisodes({
                cleanShowTitle: title,
                seasonNum: season != null ? parseInt(season, 10) : 1,
                sourceVideoPaths: files,
                mediaRootDir: "/srv/media",
              });
            } else {
              linkMovie({
                cleanTitle: title,
                year: year ? parseInt(year, 10) : undefined,
                resolution: best.parsed?.resolution || "1080p",
                sourceVideoPath: files[0],
                mediaRootDir: "/srv/media",
              });
            }
            note(`reelflow symlinks created for ${title}`);
            invalidateRequestProgressCache();
            invalidateRequestListCache();
          }
        } catch (linkErr) {
          note(`reelflow symlink error: ${String(linkErr)}`);
        }
      }, 2000);
    }

    return { ok: true, best, dispatched: dispatchRes };
  } catch (err) {
    note(`reelflow fulfill exception: ${String(err)}`);
    return { ok: false, error: String(err) };
  }
}

async function handleRequest(req, res) {
  const method = (req.method || "GET").toUpperCase();
  if (method === "GET") return false;
  if (method === "DELETE") {
    return handleRequestDelete(req, res);
  }
  if (method !== "POST") {
    send(res, 405, { ok: false, error: "POST or DELETE only" });
    return;
  }
  const body = await readBody(req);
  const tmdb = String(body.tmdb || body.tmdbId || "").trim();
  const tvdb = String(body.tvdb || body.tvdbId || "").trim();
  let titleId = String(
    body.titleId || body.data?.titleId || body.id || "",
  ).trim();
  if (!titleId && tmdb)
    titleId =
      String(body.mediaType || "").toLowerCase() === "tv"
        ? `tmdb-tv-${tmdb}`
        : `tmdb-${tmdb}`;
  if (!titleId && tvdb) titleId = `tvdb-${tvdb}`;
  const season = body.season ?? body.data?.season;
  const episode = body.episode ?? body.data?.episode;
  let parsed = parseTitleId(titleId);
  parsed = await resolveLiveParsed(parsed);
  const bodyType = normalizeMediaType(body.mediaType);
  parsed = applyRequestMediaType(parsed, bodyType, titleId);
  if (parsed?.titleId) titleId = parsed.titleId;
  note(
    `request ${titleId} title=${body.title || ""} season=${season ?? ""} tmdb=${parsed?.tmdb || ""} type=${parsed?.mediaType || ""}`,
  );
  if (!titleId) {
    send(res, 400, { ok: false, error: "No title" });
    return;
  }
  const sourcePolicy = sourcePolicyFromState({
    answers: answers(),
    uiSettings: readUiSettings(),
    env: process.env,
    validation: currentProviderValidation(),
  });
  if (!canDispatchProviderRequest(sourcePolicy)) {
    send(res, 409, providerUnavailablePayload());
    return;
  }
  const key = seerrApiKey();
  if (!parsed?.tmdb && key && String(body.title || "").trim()) {
    try {
      const wantedTitle = String(body.title).trim();
      const wantedYear = Number(body.year) || 0;
      const search = await seerrFetch(
        `/api/v1/search?query=${encodeURIComponent(wantedTitle)}`,
        { key, ms: 10000 },
      );
      const hits = Array.isArray(search.json)
        ? search.json
        : search.json?.results || [];
      const candidates = mapSeerrSearchResults(hits, {
        q: wantedTitle,
        limit: 12,
      });
      const wantedType = normalizeMediaType(body.mediaType);
      const normalized = wantedTitle.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const match =
        candidates.find((candidate) => {
          const sameTitle =
            String(candidate.title || "")
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "") === normalized;
          const sameYear =
            !wantedYear ||
            !candidate.year ||
            Number(candidate.year) === wantedYear;
          const sameType =
            !wantedType || normalizeMediaType(candidate.kind) === wantedType;
          return sameTitle && sameYear && sameType;
        }) || candidates[0];
      if (match?.id) {
        parsed = applyRequestMediaType(
          parseTitleId(match.id),
          wantedType,
          match.id,
        );
        if (parsed?.titleId) titleId = parsed.titleId;
      }
    } catch {
      /* The normal missing-TMDB response below remains honest. */
    }
  }
  const isGuestReq = isGuestPendingRequest(body);
  if (isGuestReq) {
    const pending = addPendingGuestRequest({
      titleId,
      title: body.title,
      year: body.year,
      poster: body.poster,
      mediaType: parsed?.mediaType || body.mediaType,
      tmdb: parsed?.tmdb || tmdb,
      season,
      requester: body.requester || "Guest",
    });
    send(res, 202, {
      ok: true,
      pendingApproval: true,
      message: "Request queued for host approval.",
      request: pending,
    });
    return;
  }
  if (!key) {
    const wantSeason =
      (parsed?.mediaType === "tv" || bodyType === "tv") &&
      season != null &&
      season !== "" &&
      Number.isFinite(Number(season))
        ? Number(season)
        : parsed?.mediaType === "tv" || bodyType === "tv"
          ? 1
          : undefined;
    triggerReelFlowFulfill({
      title: body.title || titleId,
      year: body.year,
      tmdb: parsed?.tmdb || tmdb,
      mediaType: parsed?.mediaType || bodyType,
      season: wantSeason,
      episode,
    }).catch(() => {});
    invalidateRequestProgressCache();
    invalidateRequestListCache();
    send(res, 200, { ok: true, id: titleId, status: "pending", progress: 0 });
    return;
  }
  if (!parsed?.tmdb) {
    send(res, 400, {
      ok: false,
      error: "Search again, then request. Titles now use Seerr/TMDB ids.",
    });
    return;
  }
  try {
    forgetRemovedTitleIds(titleId, [
      parsed.mediaType === "tv"
        ? `tmdb-tv-${parsed.tmdb}`
        : `tmdb-${parsed.tmdb}`,
      parsed.mediaType === "tv"
        ? `tmdb-${parsed.tmdb}`
        : `tmdb-tv-${parsed.tmdb}`,
    ]);
    const wantSeason =
      parsed.mediaType === "tv" &&
      season != null &&
      season !== "" &&
      Number.isFinite(Number(season))
        ? Number(season)
        : parsed.mediaType === "tv"
          ? 1
          : undefined;
    if (parsed.mediaType === "tv" && wantSeason) {
      const facts = await loadPresenceFacts().catch(() => null);
      const series = (facts?.series || []).find(
        (s) => String(s?.tmdbId) === String(parsed.tmdb),
      );
      const sonarrSeason = (series?.seasons || []).find(
        (s) => Number(s?.seasonNumber) === wantSeason,
      );
      const tv = await seerrFetch(`/api/v1/tv/${parsed.tmdb}`, {
        key,
        ms: 12000,
      });
      const seerrSeason =
        (tv.json?.seasons || []).find(
          (s) => Number(s?.seasonNumber) === wantSeason,
        ) || null;
      if (seasonUnreleasedForRequest({ sonarrSeason, seerrSeason })) {
        send(res, 200, {
          ok: false,
          error: `Season ${String(wantSeason).padStart(2, "0")} is announced, not released yet`,
        });
        return;
      }
    }
    const listed = await seerrFetch(
      "/api/v1/request?take=100&filter=all&sort=added",
      { key, ms: 15000 },
    );
    const existingRows = Array.isArray(listed.json)
      ? listed.json
      : listed.json?.results || [];
    const reused = findExistingSeasonRequest(existingRows, {
      mediaType: parsed.mediaType,
      tmdb: parsed.tmdb,
      season,
    });
    if (reused) {
      const reuseSeason =
        season != null && season !== ""
          ? Number(season)
          : reused.season != null
            ? Number(reused.season)
            : 1;
      note(
        `seerr reuse ${reused.id} type=${parsed.mediaType} season=${reuseSeason}`,
      );
      let recover = null;
      if (parsed.mediaType === "tv" || parsed.mediaType === "movie") {
        recover = await kickArrRecover({
          tmdb: parsed.tmdb,
          season: reuseSeason,
          episode,
          mediaType: parsed.mediaType,
        });
      }
      triggerReelFlowFulfill({
        title: body.title || titleId,
        year: body.year,
        tmdb: parsed.tmdb,
        mediaType: parsed.mediaType,
        season: reuseSeason,
        episode,
      }).catch(() => {});
      send(res, 200, {
        ok: recover ? recover.ok !== false : true,
        engine: "seerr",
        added: false,
        reused: true,
        id: reused.id,
        title: body.title || titleId,
        recover,
      });
      return;
    }
    const payload = buildSeerrAddPayload({
      mediaType: parsed.mediaType,
      tmdb: parsed.tmdb,
      season,
    });
    if (!payload) {
      send(res, 400, {
        ok: false,
        error: "Search again, then request. Titles now use Seerr/TMDB ids.",
      });
      return;
    }
    const seasonN = payload.mediaType === "tv" ? payload.seasons[0] : undefined;
    const added = await seerrFetch("/api/v1/request", {
      key,
      method: "POST",
      body: payload,
      ms: 30000,
    });
    if (!added.ok && added.status !== 409) {
      const msg =
        added.json?.message || added.json?.error || `seerr ${added.status}`;
      note(`seerr request ${added.status} ${msg}`);
      send(res, added.status >= 400 ? added.status : 500, {
        ok: false,
        error: String(msg),
      });
      return;
    }
    note(
      `seerr add ${added.status} type=${parsed.mediaType} season=${seasonN ?? ""}`,
    );
    let recover = null;
    if (parsed.mediaType === "tv" || parsed.mediaType === "movie") {
      recover = await kickArrRecover({
        tmdb: parsed.tmdb,
        season: seasonN,
        episode,
        mediaType: parsed.mediaType,
      });
    }
    triggerReelFlowFulfill({
      title: body.title || titleId,
      year: body.year,
      tmdb: parsed.tmdb,
      mediaType: parsed.mediaType,
      season: seasonN,
      episode,
    }).catch(() => {});
    invalidateRequestProgressCache();
    invalidateRequestListCache();
    send(res, 200, {
      ok: recover ? recover.ok !== false : true,
      engine: "seerr",
      added: added.ok || added.status === 409,
      title: body.title || titleId,
      recover,
    });
  } catch (e) {
    const error = String(e?.name === "AbortError" ? "Request UI timed out" : e);
    note(`request err ${error}`);
    send(res, 500, { ok: false, error });
  }
}

async function handleWatchlist(req, res) {
  const method = (req.method || "GET").toUpperCase();
  if (method === "GET") {
    send(res, 200, { ok: true, config: readWatchlistConfig() });
    return;
  }
  if (method === "POST") {
    const body = await readBody(req);
    const cur = readWatchlistConfig();
    const next = { ...cur, ...body };
    writeWatchlistConfig(next);
    let syncResult = null;
    if (body.sync || next.enabled) {
      syncResult = await syncWatchlistFeed({
        config: next,
        getLibraryTitles: () => libraryCache.read()?.titles || [],
        getExistingRequests: () => [],
        searchSeerr: async (title) => {
          const key = seerrApiKey();
          if (!key) return null;
          const r = await seerrFetch(
            `/api/v1/search?query=${encodeURIComponent(title)}`,
            { key, ms: 10000 },
          );
          const hits = Array.isArray(r.json) ? r.json : r.json?.results || [];
          return hits[0] || null;
        },
        requestSeerr: async ({ tmdbId, mediaType }) => {
          const key = seerrApiKey();
          if (!key) return { ok: false, error: "No Seerr key" };
          return seerrFetch("/api/v1/request", {
            key,
            method: "POST",
            body: { mediaType: mediaType || "movie", mediaId: Number(tmdbId) },
            ms: 10000,
          });
        },
      });
    }
    send(res, 200, { ok: true, config: next, sync: syncResult });
    return;
  }
  send(res, 405, { ok: false });
}

async function handleCastSessions(req, res) {
  const a = answers();
  const auth = await jellyfinToken(
    a.adminName || "reelos",
    a.adminPassword || "reelos",
  );
  if (!auth?.token) {
    send(res, 200, {
      ok: false,
      error: "Jellyfin authentication required",
      sessions: [],
    });
    return;
  }
  const result = await fetchJellyfinSessions({ token: auth.token });
  send(res, 200, result);
}

async function handleCastPlay(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const a = answers();
  const auth = await jellyfinToken(
    a.adminName || "reelos",
    a.adminPassword || "reelos",
  );
  if (!auth?.token) {
    send(res, 401, { ok: false, error: "Jellyfin authentication required" });
    return;
  }
  const body = await readBody(req);
  const result = await castPlayToSession({
    sessionId: body.sessionId,
    itemIds: body.itemId || body.itemIds,
    playCommand: body.playCommand || "PlayNow",
    startPositionTicks: body.startPositionTicks || 0,
    token: auth.token,
  });
  send(res, result.ok ? 200 : 400, result);
}

async function handleCastControl(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const a = answers();
  const auth = await jellyfinToken(
    a.adminName || "reelos",
    a.adminPassword || "reelos",
  );
  if (!auth?.token) {
    send(res, 401, { ok: false, error: "Jellyfin authentication required" });
    return;
  }
  const body = await readBody(req);
  const result = await castCommandToSession({
    sessionId: body.sessionId,
    command: body.command || "PlayPause",
    params: body.params || {},
    token: auth.token,
  });
  send(res, result.ok ? 200 : 400, result);
}

async function handleCastMessage(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const a = answers();
  const auth = await jellyfinToken(
    a.adminName || "reelos",
    a.adminPassword || "reelos",
  );
  if (!auth?.token) {
    send(res, 401, { ok: false, error: "Jellyfin authentication required" });
    return;
  }
  const body = await readBody(req);
  const result = await sendSessionMessage({
    sessionId: body.sessionId,
    header: body.header || "ReelOS",
    text: body.text || "Your screen is connected and ready to stream!",
    timeoutMs: body.timeoutMs || 5000,
    token: auth.token,
  });
  send(res, result.ok ? 200 : 400, result);
}

async function handleQuickConnectAuthorize(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const a = answers();
  const auth = await jellyfinToken(
    a.adminName || "reelos",
    a.adminPassword || "reelos",
  );
  if (!auth?.token) {
    send(res, 401, { ok: false, error: "Jellyfin authentication required" });
    return;
  }
  const body = await readBody(req);
  const result = await authorizeQuickConnect({
    code: body.code,
    token: auth.token,
    userId: auth.id,
  });
  send(res, result.ok ? 200 : 400, result);
}

async function handleQuickConnectStatus(req, res) {
  const result = await getQuickConnectStatus();
  send(res, 200, { ok: true, ...result });
}

async function handleFlickMatchSession(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const lib = libraryCache.read()?.titles || [];
  const result = flickMatch.createOrJoinRoom({
    roomCode: body.roomCode,
    residentName: body.residentName,
    residentAvatar: body.residentAvatar,
    libraryTitles: lib,
  });
  send(res, 200, result);
}

async function handleFlickMatchVote(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const result = flickMatch.recordVote({
    roomCode: body.roomCode,
    residentName: body.residentName,
    titleId: body.titleId,
    vote: body.vote,
  });
  send(res, 200, result);
}

async function handleFlickMatchStatus(req, res) {
  const u = new URL(req.url, "http://127.0.0.1");
  const room = u.searchParams.get("room");
  const result = flickMatch.getRoomStatus(room);
  send(res, result.ok ? 200 : 404, result);
}

async function handleKidsApproved(req, res) {
  const ids = readKidsApprovedIds();
  send(res, 200, { ok: true, kidsTitleIds: ids });
}

async function handleKidsToggle(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const titleId = String(body.titleId || "").trim();
  if (!titleId) {
    send(res, 400, { ok: false, error: "Missing titleId" });
    return;
  }
  const approved = body.approved !== false;
  let ids = readKidsApprovedIds();
  if (approved && !ids.includes(titleId)) {
    ids.push(titleId);
  } else if (!approved) {
    ids = ids.filter((id) => id !== titleId);
  }
  writeKidsApprovedIds(ids);
  send(res, 200, { ok: true, kidsTitleIds: ids });
}

async function handleKidsGifts(req, res) {
  if ((req.method || "GET").toUpperCase() === "GET") {
    send(res, 200, { ok: true, gifted: getGiftedKidsTitles() });
    return;
  }
  send(res, 405, { ok: false });
}

async function handleKidsGiftAction(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const titleId = String(body?.titleId || "").trim();
  if (!titleId) {
    send(res, 400, { ok: false, error: "Missing titleId" });
    return;
  }
  if (body?.action === "ungift") {
    ungiftTitleForKids(titleId);
  } else {
    giftTitleForKids(titleId, body?.giftedBy || "Mom & Dad");
  }
  send(res, 200, { ok: true, gifted: getGiftedKidsTitles() });
}

async function handleGuestCleanup(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const hours = Number(body.hours || 24);
  const pinnedIds = new Set(
    Array.isArray(body.pinnedIds) ? body.pinnedIds : [],
  );
  const reqs = await collectRequestList();
  const { toRemove, countRemoved, countKept } = sweepGuestRequests({
    requests: reqs,
    watchlistTitleIds: pinnedIds,
    maxAgeHours: hours,
  });
  for (const r of toRemove) {
    if (r.titleId) {
      try {
        await removeLibraryTitle(r.titleId);
      } catch {
        /* ignore */
      }
    }
  }
  invalidateRequestProgressCache();
  send(res, 200, {
    ok: true,
    removedCount: countRemoved,
    keptCount: countKept,
  });
}

async function handlePendingRequests(_req, res) {
  send(res, 200, { ok: true, pending: loadPendingGuestRequests() });
}

async function handleApproveRequest(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const id = String(body.id || "").trim();
  if (!id) {
    send(res, 400, { ok: false, error: "Missing request id" });
    return;
  }
  const item = removePendingGuestRequest(id);
  if (!item) {
    send(res, 404, { ok: false, error: "Pending request not found" });
    return;
  }
  const mockReq = {
    method: "POST",
    url: "/api/request",
    headers: { "content-type": "application/json" },
    _body: {
      titleId: item.titleId,
      title: item.title,
      year: item.year,
      poster: item.poster,
      mediaType: item.mediaType,
      tmdb: item.tmdb,
      season: item.season,
      requester: item.requestedBy || "Guest",
      approvedByHost: true,
    },
  };
  await handleRequest(mockReq, res);
}

async function handleRejectRequest(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const id = String(body.id || "").trim();
  if (!id) {
    send(res, 400, { ok: false, error: "Missing request id" });
    return;
  }
  const item = removePendingGuestRequest(id);
  send(res, 200, { ok: true, rejected: Boolean(item), id });
}

async function handleCabinStatus(_req, res) {
  const status = getCabinStatus();
  send(res, 200, status);
}

async function handleCabinToggle(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const active = Boolean(body.active);
  const result = setCabinMode(active);
  send(res, result.ok ? 200 : 500, result);
}

async function handleVaultSync(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const titleId = String(body.titleId || "").trim();
  const title = String(body.title || "").trim();
  const sourcePath = String(body.sourcePath || "").trim();
  const result = syncTitleToVault(titleId, title, sourcePath);
  send(res, result.ok ? 200 : 400, result);
}

async function handleBatteryStatus(_req, res) {
  const data = getBatteryStatus();
  send(res, 200, data);
}

async function handleBatteryMode(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const mode = String(body.mode || "balanced");
  const data = setBatteryMode(mode);
  send(res, data.ok ? 200 : 400, data);
}

async function handleSiliconBenchmark(req, res) {
  if ((req.method || "GET").toUpperCase() === "POST") {
    const data = runSiliconBenchmarkSync();
    send(res, 200, data);
    return;
  }
  const data = getSiliconBenchmark();
  send(res, 200, data);
}

async function handleUsbDisks(_req, res) {
  const data = listUsbDrives();
  send(res, 200, data);
}

async function handleUsbDisksMount(_req, res) {
  const data = autoMountUsb();
  send(res, 200, data);
}

async function handleUsbDisksFormat(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const disk = String(body.disk || "").trim();
  const phrase = String(body.confirmPhrase || "").trim();
  const data = formatUsbDrive(disk, phrase);
  send(res, data.ok ? 200 : 400, data);
}

async function handleUsbCreatorIsoStatus(_req, res) {
  const status = detectIsoFile();
  send(res, 200, { ok: true, ...status });
}

async function handleUsbCreatorDrives(_req, res) {
  const drives = listUsbCreatorDrives();
  send(res, 200, drives);
}

async function handleUsbCreatorPrepare(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const targetDir =
    String(body.targetDir || "").trim() ||
    (process.platform === "win32"
      ? join(os.tmpdir(), "reelos-seed")
      : "/tmp/reelos-seed");
  const userAnswers =
    body.answers !== undefined && body.answers !== null
      ? body.answers
      : body.cleanInstall || body.answers === null
        ? {}
        : answers();
  const result = prepareSeedDirectory(userAnswers, targetDir);
  send(res, 200, result);
}

async function handleUsbCreatorLaunchFlasher(_req, res) {
  if (process.platform === "win32") {
    try {
      const root = process.cwd();
      const flasherPs1 = join(root, "flasher", "reelos-flasher.ps1");
      const flasherExe = join(root, "flasher", "reelos-flasher.exe");

      const target = existsSync(flasherExe) ? flasherExe : flasherPs1;
      if (target.endsWith(".exe")) {
        spawn(target, [], { detached: true, stdio: "ignore" }).unref();
      } else {
        spawn(
          "powershell.exe",
          [
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            `Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File "${flasherPs1}"' -Verb RunAs`,
          ],
          { detached: true, stdio: "ignore" },
        ).unref();
      }
      send(res, 200, {
        ok: true,
        message: "Bare-Metal Flasher launched with administrator elevation.",
      });
    } catch (e) {
      send(res, 500, { ok: false, error: e.message });
    }
  } else {
    send(res, 200, {
      ok: true,
      message: "On Linux, run: sudo bash scripts/reelos-make-usb.sh /dev/sdX",
    });
  }
}

async function handleStreamPrefetch(req, res) {
  if ((req.method || "GET").toUpperCase() === "POST") {
    const data = purgeOldPrefetch(0);
    send(res, 200, data);
    return;
  }
  const data = getPrefetchMetrics();
  send(res, 200, data);
}

async function handleBackupList(_req, res) {
  send(res, 200, { ok: true, backups: listBackups() });
}

async function handleBackupCreate(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const root = process.env.REELOS_ROOT || "/opt/reelos";
  const composeConfigsDir = existsSync(`${root}/compose/configs`)
    ? `${root}/compose/configs`
    : existsSync("/opt/reelos/compose/configs")
      ? "/opt/reelos/compose/configs"
      : "/workspace/install/compose/configs";
  const result = createBackupSnapshot({
    composeConfigsDir,
    stateDir: "/var/lib/reelos",
  });
  send(res, result.ok ? 200 : 500, result);
}

async function handleBackupDownload(req, res, filename) {
  const safeName = basename(filename);
  if (!safeName.endsWith(".tar.gz")) {
    send(res, 400, { ok: false, error: "Invalid backup file" });
    return;
  }
  const fullPath = join(getBackupDir(), safeName);
  if (!existsSync(fullPath)) {
    send(res, 404, { ok: false, error: "Backup file not found" });
    return;
  }
  try {
    const st = statSync(fullPath);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/gzip");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.setHeader("Content-Length", st.size);
    const stream = createReadStream(fullPath);
    stream.pipe(res);
  } catch (err) {
    send(res, 500, { ok: false, error: String(err) });
  }
}

async function handleBackupRestore(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const file = String(body.file || "").trim();
  if (!file) {
    send(res, 400, { ok: false, error: "No backup file specified" });
    return;
  }
  const safeName = basename(file);
  const fullPath = join(getBackupDir(), safeName);
  const result = restoreBackupSnapshot({
    archivePath: fullPath,
    targetDir: "/",
  });
  send(res, result.ok ? 200 : 400, result);
}

async function handleDoctor(_req, res) {
  const script = [
    "/opt/reelos/bin/reelos-doctor.py",
    "/workspace/daemon/reelos-doctor.py",
  ].find((p) => existsSync(p));
  if (!script) {
    send(res, 200, {
      ok: true,
      live: false,
      version: localVersion(),
      checks: [],
    });
    return;
  }
  const r = spawnSync("python3", [script], {
    encoding: "utf8",
    timeout: 60000,
  });
  try {
    const parsed = JSON.parse(r.stdout || "{}");
    send(res, 200, {
      ok: true,
      live: true,
      version: parsed.version || localVersion(),
      checks: parsed.checks || [],
    });
  } catch {
    send(res, 200, {
      ok: false,
      live: false,
      version: localVersion(),
      checks: [],
      error: r.stderr || "doctor parse",
    });
  }
}

function redactLogs(s) {
  let t = String(s || "");
  t = t.replace(/(<ApiKey>)[^<]+/gi, "$1***");
  t = t.replace(/(Authorization:\s*)\S+/gi, "$1***");
  t = t.replace(/Bearer\s+\S+/gi, "Bearer ***");
  t = t.replace(
    /("?(?:apiKey|api_key|adminPassword|password|token)"?\s*[:=]\s*"?)([^"\s,}\\]+)/gi,
    "$1***",
  );
  return t;
}

function tailFile(p, n) {
  try {
    if (!existsSync(p)) return `(missing ${p})\n`;
    const lines = readFileSync(p, "utf8").split(/\r?\n/);
    return `${lines.slice(-n).join("\n")}\n`;
  } catch (e) {
    return `(unreadable ${p}: ${e})\n`;
  }
}

function shOut(args, timeout = 8000) {
  try {
    const r = spawnSync(args[0], args.slice(1), {
      encoding: "utf8",
      timeout,
      maxBuffer: 512 * 1024,
    });
    const out = `${r.stdout || ""}${r.stderr || ""}`.trim();
    if (out) return `${out}\n`;
    return `(empty status=${r.status} error=${r.error ? r.error.code || r.error : "none"})\n`;
  } catch (e) {
    return `${e}\n`;
  }
}

async function tvHop() {
  const fuse =
    existsSync("/mnt/debrid/__all__") || existsSync("/mnt/debrid/version.txt");
  const dumps = shOut(
    [
      "bash",
      "-lc",
      "ls -la /mnt/symlinks/sonarr 2>&1 | head -25; echo '---'; find /mnt/symlinks/sonarr -maxdepth 2 \\( -type f -o -type l \\) 2>/dev/null | head -20",
    ],
    2000,
  ).trim();
  let sonarr = "sonarr: no key";
  const sk = xmlKey("/opt/reelos/compose/configs/sonarr/config.xml");
  if (sk) {
    try {
      const series = await arrGet("http://127.0.0.1:8989/api/v3/series", sk);
      const list = Array.isArray(series) ? series : [];
      sonarr = list.length
        ? list
            .slice(0, 20)
            .map(
              (s) =>
                `${s.title} files=${s.statistics?.episodeFileCount || 0} pct=${s.statistics?.percentOfEpisodes || 0}`,
            )
            .join("\n")
        : "sonarr: zero series";
    } catch (e) {
      sonarr = `sonarr: ${e}`;
    }
  }
  let jf = "jellyfin: no token";
  const a = answers();
  const auth = await jellyfinToken(
    a.adminName || "reelos",
    a.adminPassword || "reelos",
  );
  if (auth?.token) {
    try {
      const r = await fetch(
        "http://127.0.0.1:8096/Items?Recursive=true&IncludeItemTypes=Movie,Series&Limit=1",
        {
          headers: jellyfinAuthedHeaders(auth.token),
          signal: AbortSignal.timeout(5000),
        },
      );
      const data = await r.json();
      const movies = await fetch(
        "http://127.0.0.1:8096/Items?Recursive=true&IncludeItemTypes=Movie&Limit=1",
        {
          headers: jellyfinAuthedHeaders(auth.token),
          signal: AbortSignal.timeout(5000),
        },
      ).then((x) => x.json());
      const shows = await fetch(
        "http://127.0.0.1:8096/Items?Recursive=true&IncludeItemTypes=Series&Limit=1",
        {
          headers: jellyfinAuthedHeaders(auth.token),
          signal: AbortSignal.timeout(5000),
        },
      ).then((x) => x.json());
      jf = `jellyfin movies=${movies.TotalRecordCount ?? "?"} series=${shows.TotalRecordCount ?? "?"} total=${data.TotalRecordCount ?? "?"}`;
    } catch (e) {
      jf = `jellyfin: ${e}`;
    }
  }
  return [
    `fuse ${fuse ? "on host" : "MISSING"}`,
    "=== sonarr dumps ===",
    dumps,
    "=== sonarr series ===",
    sonarr,
    "=== jellyfin counts ===",
    jf,
  ].join("\n");
}

async function handleLogs(_req, res) {
  const ver = existsSync("/var/lib/reelos/installed-version")
    ? readFileSync("/var/lib/reelos/installed-version", "utf8").trim()
    : existsSync("/opt/reelos/VERSION")
      ? readFileSync("/opt/reelos/VERSION", "utf8").trim()
      : localVersion();
  const sha = existsSync("/var/lib/reelos/applied-sha")
    ? readFileSync("/var/lib/reelos/applied-sha", "utf8").trim()
    : "";
  const blob = [
    `ReelOS ${ver}`,
    `applied-sha ${sha}`,
    `time ${new Date().toISOString()}`,
    "=== bugs ===",
    shOut(
      [
        "bash",
        "-lc",
        "ls -1t /var/lib/reelos/bugs 2>/dev/null | head -8; echo '--- latest ---'; cat $(ls -1t /var/lib/reelos/bugs/*.txt 2>/dev/null | head -1) 2>/dev/null | head -80",
      ],
      4000,
    ).trim(),
    "=== tv hop ===",
    await tvHop(),
    "=== mount ===",
    shOut(
      [
        "bash",
        "-lc",
        "ls -la /mnt /mnt/debrid /mnt/debrid/__all__ /mnt/symlinks /mnt/symlinks/radarr 2>&1 | head -40",
      ],
      1500,
    ).trim(),
    "=== files ===",
    shOut(
      [
        "bash",
        "-lc",
        "find /mnt/symlinks -maxdepth 3 \\( -type f -o -type l \\) 2>/dev/null | head -30",
      ],
      2500,
    ).trim(),
    "=== decypharr ===",
    shOut(["docker", "logs", "decypharr", "--tail", "25"], 2500).trim(),
    "=== jellyfin ===",
    shOut(["docker", "logs", "reelos-jellyfin-1", "--tail", "25"], 2500).trim(),
    "=== reelos.service ===",
    shOut(
      [
        "journalctl",
        "-u",
        "reelos.service",
        "-n",
        "20",
        "--no-pager",
        "--output=short-iso",
      ],
      8000,
    ).trim(),
    "=== caddy.service ===",
    shOut(
      [
        "journalctl",
        "-u",
        "caddy.service",
        "-n",
        "20",
        "--no-pager",
        "--output=short-iso",
      ],
      8000,
    ).trim(),
    "=== ota.log ===",
    tailFile("/var/lib/reelos/ota.log", 40).trim(),
    "=== wire.log ===",
    tailFile("/var/lib/reelos/wire.log", 80).trim(),
    "=== docker ps ===",
    shOut(
      ["docker", "ps", "--format", "table {{.Names}}\\t{{.Status}}"],
      2500,
    ).trim(),
    "",
  ].join("\n");
  send(res, 200, { ok: true, text: redactLogs(blob) });
}

async function handleBugsGithub(req, res) {
  const tokFile = "/var/lib/reelos/github-token";
  if ((req.method || "GET").toUpperCase() === "GET") {
    send(res, 200, { ok: true, set: existsSync(tokFile) });
    return;
  }
  if ((req.method || "").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const tok = String(body.token || "").trim();
  mkdirSync("/var/lib/reelos", { recursive: true });
  if (!tok) {
    try {
      spawnSync("rm", ["-f", tokFile], { encoding: "utf8" });
    } catch {
      /* */
    }
    send(res, 200, { ok: true, set: false });
    return;
  }
  writeFileSync(tokFile, `${tok}\n`, { mode: 0o600 });
  send(res, 200, { ok: true, set: true });
}

let termCwd = "/home/reelos";
let termOut = "";

async function handleTerminal(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const a = answers();
  const requiredPin = String(a.adminPassword || "reelos");
  const authHeader = String(req.headers["authorization"] || "");
  const bearerPin = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const providedPin = String(
    body.pin || body.password || bearerPin || "",
  ).trim();

  if (providedPin !== requiredPin) {
    send(res, 401, {
      ok: false,
      error: "Unauthorized: Admin PIN required to execute terminal commands",
    });
    return;
  }

  if (body.kill) {
    send(res, 200, { output: termOut, running: false, cwd: termCwd });
    return;
  }
  const command = String(body.command || "").trim();
  if (!command) {
    send(res, 200, { output: termOut, running: false, cwd: termCwd });
    return;
  }
  if (command === "cd" || command.startsWith("cd ")) {
    const dest =
      command === "cd"
        ? "/home/reelos"
        : command.slice(3).trim() || "/home/reelos";
    const r = spawnSync(
      "bash",
      ["-lc", `cd ${JSON.stringify(termCwd)} && cd ${dest} && pwd`],
      {
        encoding: "utf8",
        timeout: 5000,
      },
    );
    const next = (r.stdout || "").trim().split("\n").pop();
    if (r.status === 0 && next) termCwd = next;
    termOut += `$ ${command}\n${r.status === 0 ? next : r.stderr || "cd failed"}\n`;
    send(res, 200, { output: termOut, running: false, cwd: termCwd });
    return;
  }
  const r = spawnSync("bash", ["-lc", command], {
    cwd: existsSync(termCwd) ? termCwd : "/home/reelos",
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 1024 * 512,
    env: { ...process.env, HOME: "/home/reelos" },
  });
  termOut += `$ ${command}\n${r.stdout || ""}${r.stderr || ""}`;
  if (termOut.length > 200000) termOut = termOut.slice(-160000);
  send(res, 200, { output: termOut, running: false, cwd: termCwd });
}

async function handlePassword(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const current = String(body.current || "");
  const next = String(body.next || "");
  if (next.length < 4) {
    send(res, 400, {
      ok: false,
      error: "New PIN must be at least 4 characters",
    });
    return;
  }
  const a = answers();
  const have = String(a.adminPassword || "reelos");
  if (current !== have) {
    send(res, 403, { ok: false, error: "Current PIN does not match" });
    return;
  }
  a.adminPassword = next;
  jellyfinTokens.clear();
  try {
    atomicWriteJsonSync("/var/lib/reelos/answers.json", a, { mode: 0o600 });
  } catch (e) {
    send(res, 500, { ok: false, error: String(e) });
    return;
  }
  let jellyfin = false;
  const auth = await jellyfinToken(a.adminName || "reelos", current);
  if (auth?.token && auth.id) {
    try {
      const r = await fetch(`http://127.0.0.1:8096/Users/${auth.id}/Password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...jellyfinAuthedHeaders(auth.token),
        },
        body: JSON.stringify({ CurrentPw: current, NewPw: next }),
      });
      jellyfin = r.ok;
    } catch {
      jellyfin = false;
    }
  }
  const box = spawnSync("chpasswd", {
    input: `reelos:${next}\n`,
    encoding: "utf8",
    timeout: 5000,
  });
  send(res, 200, { ok: true, jellyfin, boxUser: box.status === 0 });
}

async function handleQuality(req, res) {
  const wantMap = {
    "1080p": "HD-1080p",
    hybrid: "Ultra-HD",
    "4k": "Ultra-HD",
    custom: "Any",
  };
  if ((req.method || "GET").toUpperCase() === "POST") {
    const body = await readBody(req);
    const q = String(body.quality || "");
    if (!["1080p", "hybrid", "4k", "custom"].includes(q)) {
      send(res, 400, {
        ok: false,
        error: "quality must be 1080p, hybrid, or 4k",
      });
      return;
    }
    const a = answers();
    a.quality = q;
    try {
      atomicWriteJsonSync("/var/lib/reelos/answers.json", a, { mode: 0o600 });
    } catch {
      /* ignore on non-linux */
    }
    const stateDir =
      process.env.REELOS_STATE ||
      (process.platform === "win32" ? ".reelos-state" : "/var/lib/reelos");
    if (stateDir !== "/var/lib/reelos") {
      try {
        atomicWriteJsonSync(join(stateDir, "answers.json"), a, { mode: 0o600 });
      } catch {}
    }
  }
  const want = answers().quality || "hybrid";
  const profile = wantMap[want] || "Ultra-HD";
  const rk = xmlKey("/opt/reelos/compose/configs/radarr/config.xml");
  const sk = xmlKey("/opt/reelos/compose/configs/sonarr/config.xml");
  let radarr = null;
  let sonarr = null;
  let radarrProfileId = null;
  let sonarrProfileId = null;
  try {
    if (rk) {
      const qs = await arrGet(
        "http://127.0.0.1:7878/api/v3/qualityprofile",
        rk,
      );
      const list = Array.isArray(qs) ? qs : [];
      const hit = list.find((p) => p.name === profile);
      radarr = hit?.name || null;
      radarrProfileId = hit?.id || null;
    }
    if (sk) {
      const qs = await arrGet(
        "http://127.0.0.1:8989/api/v3/qualityprofile",
        sk,
      );
      const list = Array.isArray(qs) ? qs : [];
      const hit = list.find((p) => p.name === profile);
      sonarr = hit?.name || null;
      sonarrProfileId = hit?.id || null;
    }
  } catch (e) {
    /* non-fatal if arr engines are starting or offline */
  }

  // Synchronize default profile into Seerr server settings
  const seerrKey = seerrApiKey();
  if (seerrKey) {
    try {
      if (radarrProfileId != null) {
        const r = await seerrFetch("/api/v1/settings/radarr", {
          key: seerrKey,
          ms: 2500,
        });
        const list = Array.isArray(r.json) ? r.json : [];
        for (const s of list) {
          if (s && s.id != null && s.activeProfileId !== radarrProfileId) {
            const { id, ...copy } = s;
            copy.activeProfileId = radarrProfileId;
            copy.activeProfileName = profile;
            await seerrFetch(`/api/v1/settings/radarr/${id}`, {
              key: seerrKey,
              method: "PUT",
              body: copy,
              ms: 2500,
            });
          }
        }
      }
      if (sonarrProfileId != null) {
        const r = await seerrFetch("/api/v1/settings/sonarr", {
          key: seerrKey,
          ms: 2500,
        });
        const list = Array.isArray(r.json) ? r.json : [];
        for (const s of list) {
          if (s && s.id != null && s.activeProfileId !== sonarrProfileId) {
            const { id, ...copy } = s;
            copy.activeProfileId = sonarrProfileId;
            copy.activeProfileName = profile;
            await seerrFetch(`/api/v1/settings/sonarr/${id}`, {
              key: seerrKey,
              method: "PUT",
              body: copy,
              ms: 2500,
            });
          }
        }
      }
    } catch {
      /* non-fatal */
    }
  }

  send(res, 200, {
    ok: true,
    quality: want,
    wanted: want,
    profile,
    radarr,
    sonarr,
    radarrProfileId,
    sonarrProfileId,
    error: rk || sk ? null : "no engine keys",
  });
}

async function handleIntent(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 200, { ok: true, intent: answers().intent || {} });
    return;
  }
  const body = await readBody(req);
  const a = answers();
  a.intent = { ...(a.intent || {}), ...(body.intent || body) };
  try {
    atomicWriteJsonSync("/var/lib/reelos/answers.json", a, { mode: 0o600 });
  } catch (e) {
    send(res, 500, { ok: false, error: String(e) });
    return;
  }
  const compose = "/opt/reelos/compose";
  if (a.intent?.music) {
    spawnSync(
      "docker",
      ["compose", "--profile", "music", "up", "-d", "lidarr"],
      {
        cwd: compose,
        encoding: "utf8",
        timeout: 60000,
      },
    );
  } else {
    spawnSync("docker", ["compose", "stop", "lidarr"], {
      cwd: compose,
      encoding: "utf8",
      timeout: 20000,
    });
  }
  send(res, 200, { ok: true, intent: a.intent });
}

async function handleActivity(_req, res) {
  const events = [];
  const push = (src, line) => {
    const t = String(line || "").trim();
    if (!t || t.startsWith("----")) return;
    events.push({
      id: `${src}-${events.length}`,
      at: Date.now(),
      message: t.slice(0, 240),
      src,
    });
  };
  for (const line of tailFile("/var/lib/reelos/wire.log", 20).split("\n"))
    push("wire", line);
  for (const line of tailFile("/var/lib/reelos/stuck-downloads.log", 12).split(
    "\n",
  ))
    push("stuck", line);
  for (const line of tailFile("/var/lib/reelos/ota.log", 15).split("\n"))
    push("ota", line);
  for (const line of shOut(
    ["journalctl", "-u", "reelos", "-n", "12", "--no-pager", "-o", "cat"],
    2500,
  ).split("\n")) {
    push("shell", line);
  }
  send(res, 200, { events: events.slice(-40) });
}

function uiSettingsPath() {
  if (process.env.REELOS_STATE)
    return join(process.env.REELOS_STATE, "ui-settings.json");
  if (process.platform === "win32")
    return join(process.cwd(), ".reelos-state", "ui-settings.json");
  return "/var/lib/reelos/ui-settings.json";
}

function readUiSettings() {
  const defaults = {
    autoUpdate: true,
    stackImages: false,
    notifyAvailable: true,
    notifyFailed: true,
    autoApprove: true,
    betaChannel: false,
    debridEnabled: false,
    debridProvider: "torbox",
    debridStatus: "disabled",
    enabledIndexerIds: [],
    region: "US",
  };
  try {
    return {
      ...defaults,
      ...JSON.parse(readFileSync(uiSettingsPath(), "utf8")),
    };
  } catch {
    return defaults;
  }
}

function publicUiSettings(settings, policy = null) {
  const { debridValidationAttempt: _privateAttempt, ...publicSettings } = settings;
  return policy ? {
    ...publicSettings,
    debridStatus: policy.status,
    debridValidatedAt: policy.connected ? settings.debridValidatedAt : null,
  } : publicSettings;
}

function currentProviderValidation() {
  return readProviderValidation(dirname(uiSettingsPath()));
}

function writeSystemdFile(path, body) {
  try {
    mkdirSync("/etc/systemd/system", { recursive: true });
    writeFileSync(path, body);
    return true;
  } catch (e) {
    if (e && e.code !== "EACCES") throw e;
    const r = spawnSync("sudo", ["-n", "tee", path], {
      input: body,
      encoding: "utf8",
    });
    return r.status === 0;
  }
}

function setAutoUpdateTimer(on) {
  const service = `[Unit]
Description=ReelOS daily Apply
[Service]
Type=oneshot
ExecStart=/bin/bash /opt/reelos/bin/reelos-update.sh apply
`;
  const timer = `[Unit]
Description=ReelOS daily Apply timer
[Timer]
OnCalendar=daily
Persistent=true
[Install]
WantedBy=timers.target
`;
  if (
    !writeSystemdFile("/etc/systemd/system/reelos-autoupdate.service", service)
  )
    return;
  if (!writeSystemdFile("/etc/systemd/system/reelos-autoupdate.timer", timer))
    return;
  spawnSync("systemctl", ["daemon-reload"], { encoding: "utf8" });
  if (on) {
    spawnSync("systemctl", ["enable", "--now", "reelos-autoupdate.timer"], {
      encoding: "utf8",
    });
  } else {
    spawnSync("systemctl", ["disable", "--now", "reelos-autoupdate.timer"], {
      encoding: "utf8",
    });
  }
}

async function reconcileDisabledProvider() {
  const report = {
    at: new Date().toISOString(),
    pendingApprovals: 0,
    cancelledJobs: 0,
    errors: [],
  };
  for (const pending of loadPendingGuestRequests()) {
    if (pending?.id && removePendingGuestRequest(pending.id))
      report.pendingApprovals += 1;
  }
  try {
    const payload = await collectRequestList();
    const terminal = new Set([
      "available",
      "downloaded",
      "ready",
      "complete",
      "completed",
      "failed",
      "cancelled",
    ]);
    for (const item of payload?.requests || []) {
      if (terminal.has(String(item?.status || "").toLowerCase())) continue;
      try {
        await cancelRequest({
          ...item,
          seerrKey: seerrApiKey(),
          seerrFetch,
          radarrKey: arrApiKey("radarr"),
          sonarrKey: arrApiKey("sonarr"),
          fetchArr: arrJson,
        });
        report.cancelledJobs += 1;
      } catch (error) {
        report.errors.push(String(error));
      }
    }
  } catch (error) {
    report.errors.push(String(error));
  }
  invalidateRequestProgressCache();
  try {
    atomicWriteJsonSync(
      join(dirname(uiSettingsPath()), "provider-disable-cleanup.json"),
      report,
      { mode: 0o600 },
    );
  } catch {}
  return report;
}

async function handleSettings(req, res) {
  if ((req.method || "GET").toUpperCase() === "GET") {
    const settings = readUiSettings();
    const sourcePolicy = sourcePolicyFromState({
      answers: answers(),
      uiSettings: settings,
      env: process.env,
      validation: currentProviderValidation(),
    });
    send(res, 200, {
      ok: true,
      ...publicUiSettings(settings, sourcePolicy),
      availableIndexerPresets: PUBLIC_INDEXER_ROSTER.map(
        ({ id, name, displayName, role, type }) => ({
          id,
          name: displayName || name.replace(/^ReelOS-/, ""),
          role,
          type,
        }),
      ),
      publicCatalogs: PUBLIC_CATALOGS,
      sourcePolicy: publicSourcePolicy(sourcePolicy),
    });
    return;
  }
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const authorization = getRequestProfileAuthorization(req);
  if (!authorization.authenticated || authorization.role !== "owner") {
    send(res, authorization.authenticated ? 403 : 401, { ok: false, error: "The household owner must change home settings." });
    return;
  }
  if (!isSameOriginProfileMutation(req, new URL(req.url, "http://localhost"))) {
    send(res, 403, { ok: false, error: "Use this home's connection to change settings." });
    return;
  }
  const body = await readBody(req);
  const cur = readUiSettings();
  const allowedBooleanSettings = [
    "autoUpdate",
    "stackImages",
    "notifyAvailable",
    "notifyFailed",
    "autoApprove",
    "betaChannel",
  ];
  const next = { ...cur };
  for (const key of allowedBooleanSettings) {
    if (key in body) next[key] = body[key] === true;
  }
  if ("region" in body) {
    const region = String(body.region || "").trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(region)) {
      send(res, 400, { ok: false, error: "Choose a valid two-letter home region." });
      return;
    }
    next.region = region;
  }
  if ("enabledIndexerIds" in body) {
    const allowed = new Set(PUBLIC_INDEXER_ROSTER.map((item) => item.id));
    next.enabledIndexerIds = Array.isArray(body.enabledIndexerIds)
      ? [...new Set(body.enabledIndexerIds.map(String))].filter((id) =>
          allowed.has(id),
        )
      : [];
  }
  if (
    "debridEnabled" in body ||
    "debridProvider" in body ||
    "debridKey" in body
  ) {
    const enable =
      "debridEnabled" in body
        ? body.debridEnabled === true
        : cur.debridEnabled === true;
    const provider =
      ("debridProvider" in body ? body.debridProvider : cur.debridProvider) === "real-debrid" ? "real-debrid" : "torbox";
    next.debridEnabled = enable;
    next.debridProvider = provider;
    // The owner settings writer uses top-level fields. Drop a stale nested
    // connection so it cannot override a later disable or provider change.
    delete next.debridConnection;
    next.debridStatus = enable ? "validating" : "disabled";
    next.debridValidatedAt = null;
    next.debridValidationAttempt = enable ? randomUUID() : null;
    if (enable) {
      const suppliedKey =
        typeof body.debridKey === "string" ? body.debridKey.trim() : "";
      const currentAnswers = answers();
      const candidateAnswers = suppliedKey ? { ...currentAnswers, source: provider, apiKey: suppliedKey } : currentAnswers;
      const key = effectiveProviderKey(provider, candidateAnswers, process.env);
      mkdirSync(dirname(uiSettingsPath()), { recursive: true });
      writeFileSync(uiSettingsPath(), JSON.stringify(next, null, 2) + "\n");
      const envKey = effectiveProviderKey(provider, {}, process.env);
      const validation = suppliedKey && envKey && suppliedKey !== envKey
        ? { ok: false, code: "provider_key_overridden", error: "An environment key overrides this provider key." }
        : await pingWizardSource(provider, key, undefined, { requireAccount: true });
      if (readUiSettings().debridValidationAttempt !== next.debridValidationAttempt) {
        send(res, 409, { ok: false, code: "provider_validation_superseded", error: "Provider settings changed during validation." });
        return;
      }
      if (!validation.ok) {
        next.debridStatus = "failed";
        writeFileSync(uiSettingsPath(), JSON.stringify(next, null, 2) + "\n");
        send(res, 422, { ok: false, ...publicUiSettings(next), code: validation.code, error: validation.error });
        return;
      }
      const effectiveAfter = effectiveProviderKey(provider, suppliedKey ? candidateAnswers : answers(), process.env);
      if (effectiveAfter !== key) {
        next.debridStatus = "validating";
        writeFileSync(uiSettingsPath(), JSON.stringify(next, null, 2) + "\n");
        send(res, 409, { ok: false, code: "provider_key_changed", error: "The provider key changed during validation." });
        return;
      }
      if (suppliedKey) {
        const answersPath = getAnswersFilePath();
        mkdirSync(dirname(answersPath), { recursive: true });
        atomicWriteJsonSync(
          answersPath,
          { ...currentAnswers, source: provider, apiKey: suppliedKey },
          { mode: 0o600 },
        );
      }
      writeProviderValidation(dirname(uiSettingsPath()), createProviderValidation(provider, key, validation.accountId));
      next.debridStatus = "connected";
      next.debridValidatedAt = new Date().toISOString();
      next.debridValidationAttempt = null;
    }
  }
  mkdirSync(dirname(uiSettingsPath()), { recursive: true });
  writeFileSync(uiSettingsPath(), JSON.stringify(next, null, 2) + "\n");
  if ("enabledIndexerIds" in body) {
    const root = process.env.REELOS_ROOT || "/opt/reelos";
    const wire = existsSync(`${root}/bin/wire-engines.py`)
      ? `${root}/bin/wire-engines.py`
      : "/workspace/daemon/wire-engines.py";
    if (existsSync(wire)) {
      const child = spawn("python3", [wire, "indexers"], {
        detached: true,
        stdio: "ignore",
      });
      child.on("error", () => {});
      child.unref();
    }
  }
  try {
    if ("autoUpdate" in body) setAutoUpdateTimer(Boolean(next.autoUpdate));
  } catch {
    /* Vite is not root — settings still persist. */
  }
  if ("stackImages" in body) {
    const flag = "/var/lib/reelos/stack-images";
    if (next.stackImages) writeFileSync(flag, "1\n");
    else spawnSync("rm", ["-f", flag], { encoding: "utf8" });
  }
  let beta = undefined;
  if ("betaChannel" in body) {
    try {
      beta = applyBetaSidecar(Boolean(next.betaChannel));
    } catch (e) {
      beta = { ok: false, error: String(e) };
    }
  }
  const sourcePolicy = sourcePolicyFromState({
    answers: answers(),
    uiSettings: next,
    env: process.env,
    validation: currentProviderValidation(),
  });
  const cleanupScheduled =
    "debridEnabled" in body && body.debridEnabled !== true;
  if (cleanupScheduled) void reconcileDisabledProvider();
  send(res, 200, {
    ok: true,
    ...publicUiSettings(next, sourcePolicy),
    beta,
    sourcePolicy: publicSourcePolicy(sourcePolicy),
    providerCleanup: cleanupScheduled ? "scheduled" : undefined,
  });
}

async function handlePorts(_req, res) {
  let caddy = "";
  for (const p of [
    "/opt/reelos/compose/Caddyfile",
    "/workspace/install/compose/Caddyfile",
  ]) {
    if (existsSync(p)) {
      caddy = readFileSync(p, "utf8");
      break;
    }
  }
  send(res, 200, {
    ui: 80,
    shell: 8080,
    jellyfin: 8096,
    seerr: 5055,
    caddyHas80: caddy.includes(":80"),
    caddyTo8080: caddy.includes("reverse_proxy 127.0.0.1:8080"),
  });
}

async function handleReset(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  if (process.env.REELOS_OTA === "1") {
    send(res, 409, { ok: false, error: "Reset does not run during OTA" });
    return;
  }
  const ota = spawnSync("pgrep", ["-f", "reelos-update.sh"], {
    encoding: "utf8",
  });
  if (ota.status === 0) {
    send(res, 409, { ok: false, error: "Reset does not run during OTA" });
    return;
  }
  const script = existsSync("/opt/reelos/bin/reelos-reset.sh")
    ? "/opt/reelos/bin/reelos-reset.sh"
    : existsSync("/workspace/daemon/reelos-reset.sh")
      ? "/workspace/daemon/reelos-reset.sh"
      : "/tmp/reelos-reset.sh";
  if (script === "/tmp/reelos-reset.sh") {
    writeFileSync(
      script,
      `#!/bin/bash
set -euo pipefail
if [ "\${REELOS_OTA:-}" = "1" ] || pgrep -f reelos-update.sh >/dev/null 2>&1; then exit 1; fi
ROOT=/opt/reelos; STATE=/var/lib/reelos
sleep 2
(cd "\$ROOT/compose" && docker compose down --remove-orphans) || true
rm -f "\$STATE/provisioned" "\$STATE/answers.json" "\$STATE/engine.json"
rm -rf "\$ROOT/compose/configs"
mkdir -p "\$ROOT/compose/configs/jellyfin/config"
printf '%s\\n' '<?xml version="1.0" encoding="utf-8"?>' '<NetworkConfiguration>' '  <EnableRemoteAccess>true</EnableRemoteAccess>' '  <EnablePublishedServerUriByRequest>true</EnablePublishedServerUriByRequest>' '</NetworkConfiguration>' > "\$ROOT/compose/configs/jellyfin/config/network.xml"
systemctl restart reelos || true
`,
      { mode: 0o755 },
    );
  }
  mkdirSync("/var/lib/reelos", { recursive: true });
  const log = openSync("/var/lib/reelos/reset.log", "a");
  const cpReset = spawn("bash", [script], {
    detached: true,
    stdio: ["ignore", log, log],
  });
  cpReset.on("error", () => {});
  cpReset.unref();
  send(res, 200, { ok: true, started: true });
}

function otaRunning() {
  return applyIsRunning();
}

async function handleWire(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  if (otaRunning()) {
    send(res, 409, { ok: false, error: "Wire does not run during OTA" });
    return;
  }
  const wire = existsSync("/opt/reelos/bin/wire-engines.py")
    ? "/opt/reelos/bin/wire-engines.py"
    : "/workspace/daemon/wire-engines.py";
  if (!existsSync(wire)) {
    send(res, 500, { ok: false, error: "wire-engines.py missing" });
    return;
  }
  mkdirSync("/var/lib/reelos", { recursive: true });
  const log = openSync("/var/lib/reelos/wire.log", "a");
  const cpWire = spawn("python3", [wire], {
    detached: true,
    stdio: ["ignore", log, log],
  });
  cpWire.on("error", () => {});
  cpWire.unref();
  send(res, 200, { ok: true, started: true });
}

const jfPosterMemoryCache = new Map();

async function handleJellyfinImage(req, res) {
  const raw = req.url || "";
  const pathOnly = raw.split("?", 1)[0] || "";
  const m = /^\/api\/jf\/Items\/([^/]+)\/Images\/(Primary|Backdrop)$/.exec(
    pathOnly,
  );
  if (!m) return false;
  const id = decodeURIComponent(m[1]).replace(/[^a-zA-Z0-9_-]/g, "");
  const imgType = m[2] || "Primary";
  if (!id) {
    res.statusCode = 404;
    res.end();
    return true;
  }
  const cacheKey = `${id}-${imgType}`;
  if (jfPosterMemoryCache.has(cacheKey)) {
    const cached = jfPosterMemoryCache.get(cacheKey);
    res.statusCode = 200;
    res.setHeader("Content-Type", cached.contentType || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.end(cached.buf);
    return true;
  }
  const u = new URL(raw, "http://reelos.local");
  const maxWidth = Math.min(
    Math.max(Number(u.searchParams.get("maxWidth") || 240) || 240, 32),
    1280,
  );
  const quality = Math.min(
    Math.max(Number(u.searchParams.get("quality") || 70) || 70, 40),
    95,
  );
  const a = answers();
  let auth = null;
  try {
    auth = await jellyfinToken(
      a.adminName || "reelos",
      a.adminPassword || "reelos",
    );
  } catch {}

  // Fallback: lookup title in library-shelf and fetch high-res artwork from Cinemeta
  try {
    const stateDir =
      process.env.REELOS_STATE ||
      (process.platform === "win32"
        ? join(process.cwd(), ".reelos-state")
        : "/var/lib/reelos");
    const shelfFile = join(stateDir, "library-shelf.json");
    if (existsSync(shelfFile)) {
      const shelfData = JSON.parse(readFileSync(shelfFile, "utf8"));
      const titleItem = (shelfData.titles || []).find(
        (t) => t.jellyfinId === id || t.id === `jf-${id}` || t.id === id,
      );
      if (titleItem?.title) {
        const kind = titleItem.kind === "tv" ? "series" : "movie";
        const cleanTitle = titleItem.title
          .replace(/\s*\(\d{4}\)\s*$/, "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[:]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const metaRes = await fetch(
          `https://v3-cinemeta.strem.io/catalog/${kind}/top/search=${encodeURIComponent(cleanTitle)}.json`,
          { signal: AbortSignal.timeout(3500) },
        );
        if (metaRes.ok) {
          const metaJson = await metaRes.json();
          const metas = metaJson.metas || [];
          let match = null;
          const cleanNorm = cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, "");

          // 1. Prioritize matching by release year if known
          if (titleItem.year) {
            match = metas.find((m) => {
              const nameNorm = (m.name || "")
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "");
              const yearMatch =
                m.releaseInfo &&
                String(m.releaseInfo).includes(String(titleItem.year));
              return (
                yearMatch &&
                (nameNorm.includes(cleanNorm) || cleanNorm.includes(nameNorm))
              );
            });
          }
          // 2. Exact name match
          if (!match) {
            match = metas.find(
              (m) =>
                (m.name || "").toLowerCase().trim() ===
                cleanTitle.toLowerCase(),
            );
          }
          // 3. Normalized substring match
          if (!match) {
            match = metas.find((m) => {
              const nameNorm = (m.name || "")
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "");
              return (
                nameNorm.includes(cleanNorm) || cleanNorm.includes(nameNorm)
              );
            });
          }
          // 4. Overlapping keywords match
          if (!match && metas[0]) {
            const firstWords = (metas[0].name || "")
              .toLowerCase()
              .split(/\s+/)
              .filter((w) => w.length > 2);
            const targetWords = cleanTitle
              .toLowerCase()
              .split(/\s+/)
              .filter((w) => w.length > 2);
            if (firstWords.some((w) => targetWords.includes(w))) {
              match = metas[0];
            }
          }

          const targetUrl =
            imgType === "Backdrop"
              ? match?.background || match?.poster
              : match?.poster || match?.background;

          if (targetUrl) {
            const imgRes = await fetch(targetUrl, {
              signal: AbortSignal.timeout(5000),
            });
            if (imgRes.ok) {
              const buf = Buffer.from(await imgRes.arrayBuffer());
              if (buf.length > 500) {
                const check = visualSentinel.verifyArtwork({
                  title: cleanTitle,
                  id,
                  candidateName: match?.name,
                  buffer: buf,
                });
                if (check.valid) {
                  const cType =
                    imgRes.headers.get("content-type") || "image/jpeg";
                  jfPosterMemoryCache.set(cacheKey, {
                    buf,
                    contentType: cType,
                  });
                  res.statusCode = 200;
                  res.setHeader("Content-Type", cType);
                  res.setHeader("Cache-Control", "public, max-age=86400");
                  res.end(buf);
                  return true;
                }
              }
            }
          }
        }
      }
    }
  } catch {}

  // Luxury ReelOS Cinema SVG Poster Fallback (Zero 404 Guarantee)
  const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#18181D"/>
        <stop offset="100%" stop-color="#0A0A0D"/>
      </linearGradient>
    </defs>
    <rect width="300" height="450" fill="url(#g)" rx="16"/>
    <circle cx="150" cy="190" r="48" fill="#F5C518" fill-opacity="0.15"/>
    <text x="150" y="202" font-family="system-ui, -apple-system, sans-serif" font-size="36" font-weight="900" fill="#F5C518" text-anchor="middle">R</text>
    <text x="150" y="265" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" letter-spacing="1.5" fill="#E2E8F0" text-anchor="middle">REELOS CINEMA</text>
  </svg>`;
  const svgBuf = Buffer.from(fallbackSvg);
  jfPosterMemoryCache.set(cacheKey, {
    buf: svgBuf,
    contentType: "image/svg+xml",
  });
  res.statusCode = 200;
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.end(svgBuf);
  return true;
}

async function handleLibraryKeep(req, res) {
  const { processMediaRetentionRequest } = await import("./services/media-retention-service.mjs");
  const result = await processMediaRetentionRequest(req, readBoundedPrivateBody, {
    stateDir: process.env.REELOS_STATE,
    profilesDir: process.env.REELOS_PROFILES_DIR,
  });
  send(res, result.status, result.payload);
}

async function handleLibrary(req, res) {
  const method = (req.method || "GET").toUpperCase();
  if (method === "DELETE") {
    return handleLibraryRemove(req, res);
  }
  const host =
    String(req.headers.host || "")
      .split(":")[0]
      .replace(/[^a-zA-Z0-9.-]/g, "") ||
    ipv4() ||
    "127.0.0.1";
  const result = await serveLibrary({
    url: req.url || "/api/library",
    host,
    cache: libraryCache,
    removedIds: healedLibraryRemovedIds(),
    getAuth: async () => {
      const a = answers();
      return jellyfinToken(
        a.adminName || "reelos",
        a.adminPassword || "reelos",
      );
    },
    fetchItems: async (auth, limit) => {
      const pulled = await jellyfinFetchItems(auth, { limit });
      if (!pulled.ok) throw new Error(`Jellyfin ${pulled.status}`);
      return pulled.json;
    },
    fetchResume: libraryResumePayload,
    refresh: () => refreshLibraryFull(host),
    onLiveTitles: forgetRemovedIfStillOnShelf,
  });
  persistLibraryCache();
  const sourcePolicy = sourcePolicyFromState({
    answers: answers(),
    uiSettings: readUiSettings(),
    env: process.env,
    validation: currentProviderValidation(),
  });
  const { annotateVerifiedLibraryOriginals } = await import("./services/library-api-service.mjs");
  const originalOptions = { stateDir: process.env.REELOS_STATE, profilesDir: process.env.REELOS_PROFILES_DIR };
  send(res, 200, {
    titles: annotateVerifiedLibraryOriginals(req, await decorateLibraryTitles(
      filterAccessibleLibraryItems(result.titles, sourcePolicy),
    ), originalOptions),
    continueWatching: annotateVerifiedLibraryOriginals(req, filterAccessibleLibraryItems(
      result.continueWatching || [],
      sourcePolicy,
    ), originalOptions),
    error: result.error,
    sourceMode: sourcePolicy.mode,
  });
}

async function jellyfinGetItem(id) {
  const a = answers();
  const auth = await jellyfinToken(
    a.adminName || "reelos",
    a.adminPassword || "reelos",
  );
  if (!auth?.token) return null;
  const r = await fetch(
    `http://127.0.0.1:8096/Items/${encodeURIComponent(id)}`,
    {
      headers: jellyfinAuthedHeaders(auth.token),
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!r.ok) return null;
  return r.json();
}

async function jellyfinDeleteItem(id) {
  const a = answers();
  const auth = await jellyfinToken(
    a.adminName || "reelos",
    a.adminPassword || "reelos",
  );
  if (!auth?.token) return;
  await fetch(`http://127.0.0.1:8096/Items/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: jellyfinAuthedHeaders(auth.token),
    signal: AbortSignal.timeout(8000),
  });
}

async function handleLibraryRemove(req, res) {
  const body = await readBody(req);
  const validated = validateRemovePayload(body);
  if (!validated.ok) {
    send(res, validated.status, { ok: false, error: validated.error });
    return;
  }
  const { titleId, ids, jellyfinId, tmdb, tvdb, mediaType, confirm } =
    validated.params;
  const shelf = libraryCache.read()?.titles || [];
  const result = await removeLibraryTitle({
    titleId,
    jellyfinId,
    tmdb,
    tvdb,
    mediaType,
    ids,
    confirm,
    shelf,
    seerrKey: seerrApiKey(),
    seerrFetch,
    fetchArr: arrJson,
    radarrKey: arrApiKey("radarr"),
    sonarrKey: arrApiKey("sonarr"),
    jellyfinGetItem,
    jellyfinDeleteItem,
    onRemovedIds: (keys) => {
      rememberRemovedTitleIds(keys);
      libraryCache.drop(keys);
      persistLibraryCache();
    },
  });
  invalidateRequestProgressCache();
  invalidateRequestListCache();
  send(res, result.ok ? 200 : 400, result);
}

async function handleLibraryReset(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false, error: "POST required" });
    return;
  }
  const body = await readBody(req);
  const resetCheck = validateResetPayload(body);
  if (!resetCheck.ok) {
    send(res, resetCheck.status, { ok: false, error: resetCheck.error });
    return;
  }

  // 0. Clear Seerr requests and media records
  const sKey = seerrApiKey();
  if (sKey) {
    try {
      const reqRes = await seerrFetch(
        "/api/v1/request?take=500&filter=all&sort=added",
        { key: sKey, ms: 8000 },
      );
      const reqList = reqRes?.json?.results || reqRes?.json || [];
      for (const item of Array.isArray(reqList) ? reqList : []) {
        if (item?.id) {
          await seerrFetch(`/api/v1/request/${item.id}`, {
            key: sKey,
            method: "DELETE",
            ms: 5000,
          }).catch(() => {});
        }
      }
      const medRes = await seerrFetch(
        "/api/v1/media?take=500&filter=all&sort=added",
        { key: sKey, ms: 8000 },
      );
      const medList = medRes?.json?.results || medRes?.json || [];
      for (const item of Array.isArray(medList) ? medList : []) {
        if (item?.id) {
          await seerrFetch(`/api/v1/media/${item.id}`, {
            key: sKey,
            method: "DELETE",
            ms: 5000,
          }).catch(() => {});
        }
      }
    } catch {}
  }

  // 1. Delete all movies in Radarr
  const radKey = arrApiKey("radarr");
  if (radKey) {
    try {
      const movies = await arrJson(
        "http://127.0.0.1:7878/api/v3/movie",
        radKey,
        8000,
      );
      for (const m of movies || []) {
        if (m?.id) {
          await arrJson(
            `http://127.0.0.1:7878/api/v3/movie/${m.id}?deleteFiles=true&addImportExclusion=false`,
            radKey,
            8000,
            { method: "DELETE" },
          ).catch(() => {});
        }
      }
    } catch {}
  }

  // 2. Delete all series in Sonarr
  const sonKey = arrApiKey("sonarr");
  if (sonKey) {
    try {
      const series = await arrJson(
        "http://127.0.0.1:8989/api/v3/series",
        sonKey,
        8000,
      );
      for (const s of series || []) {
        if (s?.id) {
          await arrJson(
            `http://127.0.0.1:8989/api/v3/series/${s.id}?deleteFiles=true`,
            sonKey,
            8000,
            { method: "DELETE" },
          ).catch(() => {});
        }
      }
    } catch {}
  }

  // 3. Clear symlink dump folders and parked links on host
  try {
    spawnSync(
      "bash",
      [
        "-lc",
        "sudo -n rm -rf /mnt/symlinks/radarr/* /mnt/symlinks/sonarr/* /mnt/symlinks/.reel-parked/* 2>/dev/null || rm -rf /mnt/symlinks/radarr/* /mnt/symlinks/sonarr/* /mnt/symlinks/.reel-parked/* 2>/dev/null || true",
      ],
      { timeout: 15000 },
    );
  } catch {}

  // 4. Clear cache and trigger Jellyfin library refresh
  try {
    libraryCache.write([], { complete: true });
    persistLibraryCache();
    if (existsSync(LIBRARY_CACHE_FILE)) {
      try {
        unlinkSync(LIBRARY_CACHE_FILE);
      } catch {}
    }
    writeRemovedTitleIds(new Set());
    const a = answers();
    const auth = await jellyfinToken(
      a.adminName || "reelos",
      a.adminPassword || "reelos",
    );
    if (auth?.token) {
      try {
        const jfRes = await fetch(
          "http://127.0.0.1:8096/Items?Recursive=true&IncludeItemTypes=Movie,Series",
          {
            headers: jellyfinAuthedHeaders(auth.token),
            signal: AbortSignal.timeout(8000),
          },
        );
        if (jfRes.ok) {
          const jfData = await jfRes.json();
          for (const item of jfData?.Items || []) {
            if (item?.Id) {
              await fetch(
                `http://127.0.0.1:8096/Items/${encodeURIComponent(item.Id)}`,
                {
                  method: "DELETE",
                  headers: jellyfinAuthedHeaders(auth.token),
                  signal: AbortSignal.timeout(4000),
                },
              ).catch(() => {});
            }
          }
        }
      } catch {}
      await fetch("http://127.0.0.1:8096/Library/Refresh", {
        method: "POST",
        headers: jellyfinAuthedHeaders(auth.token),
        signal: AbortSignal.timeout(8000),
      }).catch(() => {});
    }
  } catch {}

  invalidateRequestProgressCache();
  invalidateRequestListCache();

  if (body.resync === true || body.resync === "true") {
    try {
      spawnSync("python3", ["/opt/reelos/bin/wire-engines.py", "import"], {
        timeout: 45000,
      });
    } catch {}
  }

  send(res, 200, { ok: true, cleared: true, resync: Boolean(body.resync) });
}

/** Strip common scene-release suffixes from a raw title string, e.g.
 *  "Inception.1080p.BluRay.x264" → "Inception"
 *  Returns the cleaned title, or the original if nothing changed.
 */
function sanitizeTitleString(raw) {
  return serviceSanitizeTitleString(raw);
}

async function handleLibrarySanitize(req, res) {
  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "POST") {
    send(res, 405, { ok: false, error: "GET or POST required" });
    return;
  }
  const titles =
    libraryCache.read()?.titles ||
    readLibraryCacheFile(LIBRARY_CACHE_FILE)?.titles ||
    [];
  if (!titles.length) {
    send(res, 200, {
      ok: true,
      sanitized: 0,
      detail: "Library cache is empty",
    });
    return;
  }

  const a = answers();
  const auth = await jellyfinToken(
    a.adminName || "reelos",
    a.adminPassword || "reelos",
  );

  let sanitized = 0;
  const detail = [];

  for (const t of titles) {
    const raw = String(t?.title || "").trim();
    if (!raw || raw.length < 3) continue;
    // Only process titles that look like scene releases or contain junk patterns
    const hasJunk =
      looksLikeSceneRelease(raw) ||
      /\.(2160p|1080p|BluRay|REMUX|WEB-DL|x264|x265|HEVC|DTS|AAC)\./i.test(raw);
    if (!hasJunk) continue;
    const cleaned = sanitizeTitleString(raw);
    if (!cleaned || cleaned === raw) continue;

    // Attempt to update display name in Jellyfin via PATCH if we have a jellyfinId
    if (auth?.token && t.jellyfinId) {
      try {
        const itemRes = await fetch(
          `http://127.0.0.1:8096/Items/${encodeURIComponent(t.jellyfinId)}`,
          {
            headers: jellyfinAuthedHeaders(auth.token),
            signal: AbortSignal.timeout(4000),
          },
        );
        if (itemRes.ok) {
          const item = await itemRes.json();
          const patched = { ...item, Name: cleaned, ForcedSortName: cleaned };
          await fetch(
            `http://127.0.0.1:8096/Items/${encodeURIComponent(t.jellyfinId)}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...jellyfinAuthedHeaders(auth.token),
              },
              body: JSON.stringify(patched),
              signal: AbortSignal.timeout(4000),
            },
          ).catch(() => {});
        }
      } catch {
        /* Jellyfin may be down; still count as sanitized */
      }
    }

    sanitized++;
    detail.push({ from: raw, to: cleaned, id: t.id });
  }

  send(res, 200, { ok: true, sanitized, detail });
}

let fuseReadersKick = 0;
function scheduleFuseReaders() {
  const now = Date.now();
  if (now - fuseReadersKick < 30_000) return;
  fuseReadersKick = now;
  try {
    const cp = spawn(
      "bash",
      [
        "-lc",
        'docker start decypharr reelos-jellyfin-1 reelos-radarr-1 reelos-sonarr-1 >/dev/null 2>&1 || true; for c in $(docker ps -aq --filter "label=com.docker.compose.project=reelos" 2>/dev/null); do docker start "$c" >/dev/null 2>&1 || true; done',
      ],
      { detached: true, stdio: "ignore" },
    );
    cp.on("error", () => {});
    cp.unref();
  } catch {
    /* */
  }
}

function publicAnswers(a) {
  const out = { ...(a || {}) };
  delete out.adminPassword;
  delete out.apiKey;
  delete out.tunnelToken;
  delete out.plexClaim;
  return out;
}

function withBudget(promise, ms, fallback) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(fallback);
      },
    );
  });
}

async function handleReady(req, res) {
  const started = Date.now();
  scheduleFuseReaders();
  const sourcePolicy = sourcePolicyFromState({
    answers: answers(),
    uiSettings: readUiSettings(),
    env: process.env,
    validation: currentProviderValidation(),
  });
  const host =
    String(req.headers.host || "")
      .split(":")[0]
      .replace(/[^a-zA-Z0-9.-]/g, "") ||
    ipv4() ||
    "127.0.0.1";
  const u = new URL(req.url || "/api/ready", "http://reelos.local");
  const limitRaw = Number(u.searchParams.get("limit") || 24);
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 80) : 24;
  const timings = {};
  const mark = (name, t0) => {
    timings[name] = Date.now() - t0;
  };

  const boxP = (async () => {
    const t0 = Date.now();
    const slice = boxSyncSlice();
    mark("box", t0);
    return slice;
  })();

  const updateP = (async () => {
    const t0 = Date.now();
    const logText = otaLogText();
    const running = applyProductRunning({ logText });
    const payload = {
      ok: true,
      local: localVersion(),
      running,
      target: running ? applyTargetFromLog(logText) : null,
      log: lastOtaLines(3),
      library: readLibraryProgress(),
      progress: applyProgressPayload(running),
    };
    mark("update", t0);
    return payload;
  })();

  const libraryP = (async () => {
    const t0 = Date.now();
    try {
      const result = await serveLibrary({
        url: `/api/library?limit=${encodeURIComponent(String(limit))}`,
        host,
        cache: libraryCache,
        removedIds: healedLibraryRemovedIds(),
        getAuth: async () => {
          const a = answers();
          return jellyfinToken(
            a.adminName || "reelos",
            a.adminPassword || "reelos",
          );
        },
        fetchItems: async (auth, lim) => {
          const pulled = await jellyfinFetchItems(auth, {
            limit: lim,
            timeout: Math.min(JELLYFIN_ITEMS_TIMEOUT_MS, 2500),
          });
          if (!pulled.ok) throw new Error(`Jellyfin ${pulled.status}`);
          return pulled.json;
        },
        fetchResume: libraryResumePayload,
        refresh: () => refreshLibraryFull(host),
      });
      persistLibraryCache();
      mark("library", t0);
      return {
        ...result,
        titles: await decorateLibraryTitles(
          filterAccessibleLibraryItems(result.titles, sourcePolicy),
        ),
        continueWatching: filterAccessibleLibraryItems(
          result.continueWatching || [],
          sourcePolicy,
        ),
      };
    } catch (e) {
      mark("library", t0);
      return { titles: [], continueWatching: [], error: String(e) };
    }
  })();

  const requestsP = (async () => {
    const t0 = Date.now();
    try {
      if (!canDispatchProviderRequest(sourcePolicy)) {
        mark("requests", t0);
        return {
          requests: [],
          titles: [],
          error: null,
          sourceMode: "public-personal",
        };
      }
      const listed = await collectRequestList();
      mark("requests", t0);
      return listed;
    } catch (e) {
      mark("requests", t0);
      return { requests: [], titles: [], error: String(e) };
    }
  })();

  const [box, update, library, requests] = await Promise.all([
    withBudget(boxP, 800, null),
    withBudget(updateP, 800, null),
    withBudget(libraryP, 2500, { titles: [], error: "timeout" }),
    withBudget(requestsP, 2500, { requests: [], error: "timeout" }),
  ]);

  const slice = box || boxSyncSlice();
  send(res, 200, {
    provisioned: Boolean(slice.provisioned),
    answers: publicAnswers(slice.answers),
    jellyfin: slice.jellyfin,
    ipv4: slice.ipv4 || "",
    watch: slice.watch || "",
    tailscaleIp: slice.tailscaleIp || "",
    fuseOffline: Boolean(slice.fuseOffline),
    update: update || {
      ok: true,
      local: localVersion(),
      running: false,
      target: null,
      log: "",
    },
    libraryCatchup: update?.library || readLibraryProgress(),
    titles: Array.isArray(library?.titles) ? library.titles : [],
    continueWatching: Array.isArray(library?.continueWatching)
      ? library.continueWatching
      : [],
    requests: Array.isArray(requests?.requests) ? requests.requests : [],
    pipeline: requests?.pipeline || null,
    hardware:
      slice.hardware ||
      publicHardware(
        loadSavedHardware({ path: hardwareProfilePath() }),
        readHostMemKb(),
      ),
    betaChannel: betaEnabled(),
    sourcePolicy: publicSourcePolicy(sourcePolicy),
    timings: { ...timings, total: Date.now() - started },
  });
}

async function handleDisks(_req, res) {
  let storageMode = "both";
  try {
    const raw = readFileSync(
      join(process.env.REELOS_STATE || "/var/lib/reelos", "answers.json"),
      "utf8",
    );
    const a = JSON.parse(raw);
    storageMode = a.storageMode || a.storage_mode || "both";
  } catch {
    storageMode = "both";
  }

  // Delegated to storage-service.mjs while maintaining contract keys:
  // rotational, powerState, isStandby, spindownMode, hdparm -C, storageMode
  const resDisks = serviceListStorageDevices(storageMode);
  send(res, 200, {
    ok: resDisks.ok,
    disks: resDisks.disks || [],
    storageMode,
    bootDriveRotational: resDisks.bootDriveRotational ?? false,
    hasExternalStorage: resDisks.hasExternalStorage ?? false,
    hybridCachingAllowed: resDisks.hybridCachingAllowed ?? true,
    driveProtectionNotice: resDisks.driveProtectionNotice || null,
    error: resDisks.error || null,
  });
}

async function handleMigrateInternal(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const confirmPhrase = String(body.confirmPhrase || "").trim();
  if (confirmPhrase !== "ERASE") {
    send(res, 400, {
      ok: false,
      error: "Must type ERASE to confirm wiping internal drive",
    });
    return;
  }
  const disk = String(body.disk || "").replace(/[^a-z0-9]/gi, "");
  if (!disk) {
    send(res, 400, { ok: false, error: "No target disk provided" });
    return;
  }
  const script = "/opt/reelos/bin/reelos-install-internal.sh";
  if (!existsSync(script)) {
    send(res, 501, {
      ok: false,
      simulated: false,
      disk,
      error: "Internal installation is unavailable because the verified appliance installer is not present.",
    });
    return;
  }
  const child = spawn("bash", [script, `/dev/${disk}`, "ERASE"], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  send(res, 200, { ok: true, started: true, disk });
}

async function handleWifiStatus(_req, res) {
  try {
    const result = serviceGetWifiStatus();
    send(res, result.ok ? 200 : 503, {
      ok: Boolean(result.ok),
      hotspotActive: result.hotspotActive,
      connectedSsid: result.connectedSsid,
      lanIp: result.lanIp,
      supported: result.supported !== false,
      error: result.error || null,
    });
  } catch (e) {
    send(res, 200, { ok: false, error: String(e?.message || e) });
  }
}

async function handleWifiScan(_req, res) {
  try {
    const result = serviceScanWifiNetworks();
    send(res, result.ok ? 200 : 503, {
      ok: Boolean(result.ok),
      supported: result.supported !== false,
      networks: result.networks || [],
      error: result.error || null,
    });
  } catch (e) {
    send(res, 200, { ok: false, error: String(e?.message || e), networks: [] });
  }
}

async function handleWifiConnect(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  try {
    const body = await readBody(req);
    const ssid = String(body.ssid || "").trim();
    const password = String(body.password || "");
    if (!ssid) {
      send(res, 400, { ok: false, error: "SSID required" });
      return;
    }
    const result = serviceConnectWifi(ssid, password);
    if (!result.ok) {
      send(res, result.supported === false ? 503 : 400, {
        ok: false,
        error: result.error || "Failed to connect to Wi-Fi",
      });
      return;
    }
    const stopHotspot = "/opt/reelos/bin/reelos-hotspot.sh";
    if (existsSync(stopHotspot)) {
      spawnSync("bash", [stopHotspot, "stop"], { timeout: 10000 });
    }
    send(res, 200, { ok: true, connected: true, ssid });
  } catch (e) {
    send(res, 200, { ok: false, error: String(e?.message || e) });
  }
}

async function handleStorage(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const disk = String(body.disk || "").replace(/[^a-z0-9]/gi, "");
  if (!disk || disk === "nvme0n1") {
    send(res, 400, { ok: false, error: "Pick a data disk, not the OS disk" });
    return;
  }
  const dest = `/srv/media/${disk}`;
  if (dest === "/srv/media" || dest === "/") {
    send(res, 400, { ok: false, error: "Will not eat /srv/media" });
    return;
  }
  mkdirSync(dest, { recursive: true });
  const dev = existsSync(`/dev/${disk}1`) ? `/dev/${disk}1` : `/dev/${disk}`;
  const m = spawnSync("mount", [dev, dest], {
    encoding: "utf8",
    timeout: 15000,
  });
  send(res, 200, {
    ok: m.status === 0,
    dest,
    error:
      m.status === 0
        ? null
        : (m.stderr || m.stdout || "mount failed").slice(0, 300),
  });
}

async function handleTranscode(_req, res) {
  const dri = hasVaapiDri();
  const override = existsSync("/opt/reelos/compose/compose.override.yml");
  send(res, 200, {
    dri,
    override,
    mode: dri ? "vaapi" : "direct",
    hint: dri
      ? "VAAPI/QSV node present"
      : "No /dev/dri — DirectPlay/DirectStream only",
  });
}

function composeProfiles(a) {
  const p = ["indexers"];
  const intent = a.intent || {};
  if (intent.movies) p.push("movies");
  if (intent.tv || intent.anime) p.push("tv");
  if (intent.music) p.push("music");
  if (betaEnabled()) p.push("books");
  const silicon = getSiliconBenchmark();
  const knobs = silicon?.knobs || {};
  if (
    (intent.movies || intent.tv || intent.anime) &&
    knobs.enableBazarr !== false
  ) {
    p.push("subtitles");
  }
  if (a.frontend === "jellyfin" || a.frontend === "both") {
    p.push("jellyfin");
    p.push("seerr");
  }
  if (a.frontend === "plex" || a.frontend === "both") p.push("plex");
  if (a.source === "local-vpn") p.push("localvpn");
  else p.push("debrid");
  return p;
}

async function handleProvision(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false, simulated: false });
    return;
  }
  const answers = await readBody(req);
  const a = answers.answers || answers;
  const blocked =
    provisionHonestyError(a) || sourceValidateError(a.source || "");
  if (blocked) {
    send(res, 200, { ok: false, simulated: false, error: blocked });
    return;
  }
  const isWin = process.platform === "win32";
  const stateDir = isWin
    ? join(process.cwd(), ".reelos-state")
    : "/var/lib/reelos";
  const root =
    process.env.REELOS_ROOT || (isWin ? process.cwd() : "/opt/reelos");
  const composeDir = existsSync(`${root}/compose/docker-compose.yml`)
    ? `${root}/compose`
    : existsSync(join(process.cwd(), "install", "compose"))
      ? join(process.cwd(), "install", "compose")
      : "/workspace/install/compose";
  try {
    if (isWin) {
      mkdirSync(stateDir, { recursive: true });
    } else {
      mkdirSync("/var/lib/reelos", { recursive: true, mode: 0o700 });
    }
    mkdirSync(`${composeDir}/configs/decypharr`, { recursive: true });
    seedJellyfinNetworkXml(composeDir);
    seedJellyfinEncodingXml(composeDir);
    const silicon = getSiliconBenchmark();
    const knobs = silicon?.knobs || {};
    const answersPath = isWin
      ? join(stateDir, "answers.json")
      : "/var/lib/reelos/answers.json";
    atomicWriteJsonSync(answersPath, a, { mode: 0o600 });
    const profiles = composeProfiles(a).join(",");
    const envLines = [
      "PUID=1000",
      "PGID=1000",
      "TZ=UTC",
      `RD_API_KEY=${a.source === "local-vpn" ? "" : String(a.apiKey || "").trim()}`,
      `SOURCE=${a.source || "torbox"}`,
      `COMPOSE_PROFILES=${profiles}`,
      `PLEX_CLAIM=${String(a.plexClaim || "").trim()}`,
      `VPN_SERVICE_PROVIDER=${a.vpnProvider || "custom"}`,
      `DOTNET_GC_SERVER=${knobs.dotnetGcServer ?? 0}`,
      `DOTNET_GC_HARD_LIMIT=${knobs.dotnetGcHeapHardLimit ?? ""}`,
      `MEM_LIMIT_JELLYFIN=${knobs.memLimitJellyfin || "512m"}`,
      `MEM_LIMIT_RADARR=${knobs.memLimitRadarr || "192m"}`,
      `MEM_LIMIT_SONARR=${knobs.memLimitSonarr || "192m"}`,
      `MEM_LIMIT_PROWLARR=${knobs.memLimitProwlarr || "128m"}`,
      `MEM_LIMIT_DECYPHARR=${knobs.memLimitDecypharr || "256m"}`,
      `MEM_LIMIT_SEERR=${knobs.memLimitSeerr || "96m"}`,
    ];
    writeFileSync(`${composeDir}/.env`, envLines.join("\n") + "\n", {
      mode: 0o600,
    });
    if (a.source !== "local-vpn") {
      const provider =
        a.source === "torbox"
          ? "torbox"
          : a.source === "alldebrid"
            ? "alldebrid"
            : a.source === "premiumize"
              ? "premiumize"
              : "realdebrid";
      const cfg = {
        debrids: [
          {
            provider,
            name: provider,
            api_key: String(a.apiKey || "").trim(),
            folder: "/mnt/debrid",
            use_webdav: false,
          },
        ],
        qbittorrent: {
          download_folder: "/mnt/symlinks",
          categories: ["sonarr", "radarr", "lidarr"],
        },
        default_download_action: "symlink",
        use_auth: false,
        log_level: "info",
        port: "8282",
      };
      writeFileSync(
        `${composeDir}/configs/decypharr/config.json`,
        JSON.stringify(cfg, null, 2) + "\n",
        {
          mode: 0o600,
        },
      );
    }
  } catch (e) {
    send(res, 200, { ok: false, simulated: false, error: String(e) });
    return;
  }
  const profiles = composeProfiles(a).join(",");
  const wire = existsSync(`${root}/bin/wire-engines.py`)
    ? `${root}/bin/wire-engines.py`
    : "/workspace/daemon/wire-engines.py";
  try {
    unlinkSync(
      isWin
        ? join(stateDir, "provision.error")
        : "/var/lib/reelos/provision.error",
    );
  } catch {
    /* */
  }
  if (isWin) {
    writeFileSync(join(stateDir, "provisioned"), "1\n");
    writeFileSync(join(stateDir, "stack-installed"), "1\n");
    send(res, 200, {
      ok: true,
      simulated: false,
      started: true,
      windows: true,
    });
    return;
  }
  if (!existsSync("/var/lib/reelos/provisioning")) {
    writeFileSync("/var/lib/reelos/provisioning", "1\n");
    const log = openSync("/var/lib/reelos/provision.log", "a");
    const env = { ...process.env, COMPOSE_PROFILES: profiles };
    const cmd = [
      `cd ${JSON.stringify(composeDir)}`,
      `export COMPOSE_PROFILES=${JSON.stringify(profiles)}`,
      // Ensure UID 1000 ownership for containers on host mounted configs and media directories
      "chown -R 1000:1000 configs /srv/media /mnt/symlinks 2>/dev/null || true",
      // `up -d` pulls missing images. Do not spawnSync `compose pull` here —
      // a 15-minute pull wedges the Vite event loop (phone TypeError: Failed to fetch).
      "if docker compose up -d; then",
      "  printf '1\\n' > /var/lib/reelos/provisioned",
      "  printf '1\\n' > /var/lib/reelos/stack-installed",
      existsSync(wire) ? `  python3 ${JSON.stringify(wire)} || true` : "  true",
      "else",
      "  printf 'compose up failed\\n' > /var/lib/reelos/provision.error",
      "fi",
      "rm -f /var/lib/reelos/provisioning",
    ].join("\n");
    const cpCmd = spawn("bash", ["-lc", cmd], {
      detached: true,
      stdio: ["ignore", log, log],
      env,
    });
    cpCmd.on("error", () => {});
    cpCmd.unref();
  }
  send(res, 200, { ok: true, simulated: false, started: true });
}

async function handlePing(req, res) {
  if ((req.method || "GET").toUpperCase() === "GET") {
    const t0 = Date.now();
    const ok = await probe("http://127.0.0.1:8282/", 3000);
    send(res, 200, { ok, pingMs: Date.now() - t0, target: "decypharr" });
    return;
  }
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const source = String(body.source || "");
  const key = String(body.key || "").trim();
  const result = await pingWizardSource(source, key);
  send(res, 200, result);
}

function performancePath() {
  return "/var/lib/reelos/performance.json";
}

function readPerformance() {
  try {
    if (existsSync(performancePath())) {
      return JSON.parse(readFileSync(performancePath(), "utf8"));
    }
  } catch {
    /* */
  }
  return { low: true };
}

function applyPerformance() {
  const root = process.env.REELOS_ROOT || "/opt/reelos";
  const wire = existsSync(`${root}/bin/wire-engines.py`)
    ? `${root}/bin/wire-engines.py`
    : "/workspace/daemon/wire-engines.py";
  if (!existsSync(wire)) return;
  const cpPerf = spawn("python3", [wire, "--performance"], {
    detached: true,
    stdio: "ignore",
  });
  cpPerf.on("error", () => {});
  cpPerf.unref();
}

async function handlePerformance(req, res) {
  const { boxIsSmall } = await import("./reelos-box-scale.mjs");
  const path = hardwareProfilePath();
  mkdirSync(
    path.replace(/\/hardware-profile\.json$/, "") || "/var/lib/reelos",
    { recursive: true, mode: 0o700 },
  );
  const method = (req.method || "GET").toUpperCase();
  const memKb = readHostMemKb();
  let saved = loadSavedHardware({ path });
  if (!saved) {
    runHardwareEnsure();
    saved = loadSavedHardware({ path });
  }
  const small =
    Boolean(saved?.tiny) ||
    boxIsSmall(Number(saved?.ram_kb || saved?.ramKb || 0) || memKb);
  const dri = hasVaapiDri();
  const mode = dri ? "vaapi" : "direct";
  const hardware = publicHardware(saved, memKb);
  if (method === "GET") {
    const cur = readPerformance();
    if (!existsSync(performancePath())) {
      writeFileSync(
        performancePath(),
        JSON.stringify({ low: true, detectedSmall: small }) + "\n",
      );
    }
    send(res, 200, {
      low: small || cur.low !== false,
      detectedSmall: small,
      dri,
      mode,
      hardware,
    });
    return;
  }
  if (method !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const low = small || body.low !== false;
  writeFileSync(
    performancePath(),
    JSON.stringify({ low: body.low !== false, detectedSmall: small }) + "\n",
  );
  applyPerformance();
  send(res, 200, { ok: true, low, detectedSmall: small, dri, mode, hardware });
}

function hardwarePy() {
  const root = process.env.REELOS_ROOT || "/opt/reelos";
  const cwd = process.cwd();
  for (const p of [
    `${root}/bin/reelos_hardware.py`,
    `${cwd}/daemon/reelos_hardware.py`,
    `${cwd}/install/bin/reelos_hardware.py`,
    "/opt/reelos/bin/reelos_hardware.py",
  ]) {
    if (existsSync(p)) return p;
  }
  return "";
}

function runHardwareEnsure() {
  const path = hardwareProfilePath();
  if (process.platform === "win32") {
    try {
      const cpusInfo = os.cpus() || [];
      const cpus = cpusInfo.length || 1;
      const cpuModel = cpusInfo[0]?.model || "";
      const memKb = readHostMemKb();
      const ramGb = ramGbFromKb(memKb);
      const gpuType = detectGpuType({ cpuModel });
      const hasHwGpu = ["qsv", "nvenc", "vaapi"].includes(gpuType);
      const tiny = boxIsSmall(memKb);
      const potatoMode = tiny || !hasHwGpu;
      const summary = `${ramLabel(ramGb, memKb)} · ${cpuShort(cpuModel, cpus)} · SSD · root-on-internal`;
      const profile = {
        probe_version: 2,
        probed_at: new Date().toISOString(),
        ram_kb: memKb,
        ram_gb: ramGb,
        cpus,
        cpu_model: cpuModel,
        gpu_type: gpuType,
        disk_kind: "ssd",
        disk_type_label: "SSD",
        disk_size_gb: 500,
        disk_free_gb: 100,
        product: "Windows Host",
        root_on_usb: false,
        tiny,
        box_is_small: tiny,
        summary,
        splash_tune: splashTuneFromProfile({
          tiny,
          diskKind: "ssd",
          cpuModel,
          ramGb,
        }),
        knobs: {
          low_perf: tiny,
          gpu_type: gpuType,
          potato_mode: potatoMode,
          fuse_count: tiny ? 1 : 4,
          skip_dump_ffprobe: tiny,
          zram: false,
          disable_kdump: tiny,
          search_parallelism: cpus > 1 ? Math.min(4, cpus) : 1,
          indexer_parallelism: cpus > 1 ? Math.min(4, cpus) : 1,
        },
      };
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      writeFileSync(path, JSON.stringify(profile, null, 2) + "\n");
      return;
    } catch (e) {}
  }
  const py = hardwarePy();
  if (!py) return;
  spawnSync("python3", [py, "--ensure"], {
    encoding: "utf8",
    timeout: 8000,
    env: process.env,
  });
}

async function handleHardware(req, res) {
  const method = (req.method || "GET").toUpperCase();
  const path = hardwareProfilePath();
  const state = dirname(path) || "/var/lib/reelos";
  mkdirSync(state, { recursive: true, mode: 0o700 });
  if (method !== "GET" && method !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  if (method === "POST" || !loadSavedHardware({ path })) {
    runHardwareEnsure();
  }
  const view = publicHardware(loadSavedHardware({ path }), readHostMemKb());
  send(res, 200, {
    ok: true,
    detected: "this is what I detected",
    ...view,
    path,
  });
}

import { apiRouter } from "./utils/router.mjs";

apiRouter.prefix("/api/", async (req, res, url) => {
  const pathOnly = url.pathname;
  if (
    pathOnly === "/api/ready" ||
    pathOnly === "/api/collection" ||
    pathOnly === "/api/person" ||
    pathOnly.startsWith("/api/gate") ||
    pathOnly.startsWith("/api/tailscale/funnel")
  ) {
    return false;
  }
  if (isRemoteChallengeRequired(req, process.env.REELOS_STATE)) {
    send(res, 401, {
      ok: false,
      challenged: true,
      message: "Household gate authorization required",
    });
    return true;
  }
  return false;
});

apiRouter.prefix("/api/gate", async (req, res, url) =>
  handleGateRoute(req, res, url, readBody, process.env.REELOS_STATE),
);
apiRouter.prefix("/api/tailscale/funnel", async (req, res, url) =>
  handleGateRoute(req, res, url, readBody, process.env.REELOS_STATE),
);
apiRouter.prefix("/api/profiles", async (req, res, url) =>
  handleProfilesRoute(req, res, url, undefined, {
    intelligenceStore: await localIntelligenceStore(), onIntelligenceError: reportIntelligenceError,
  }),
);
apiRouter.prefix("/api/strategy", async (req, res, url) =>
  handleMediaStrategyRoute(req, res, url, readBoundedPrivateBody, process.env.REELOS_STATE),
);
apiRouter.prefix("/api/passport", async (req, res, url) =>
  handlePassportRoute(req, res, url, readBody),
);
apiRouter.prefix("/api/guest", async (req, res, url) =>
  handleGuestPassRoute(req, res, url, readBody),
);
apiRouter.prefix("/api/diagnostics", async (req, res, url) =>
  handleDiagnosticsRoute(req, res, url, readBody),
);
apiRouter.prefix("/api/feedback", async (req, res, url) =>
  handleFeedbackRoute(req, res, url, readBody),
);
apiRouter.prefix("/api/disks/hotplug", async (req, res, url) =>
  handleMediaStrategyRoute(req, res, url, readBoundedPrivateBody, process.env.REELOS_STATE),
);
apiRouter.all("/api/storage/hdd-health", async (req, res) => {
  await handleHddHealthRoute(req, res);
  return true;
});
apiRouter.all("/api/system/compute-mode", async (req, res) => {
  send(res, 200, politeScheduler.getStatus());
  return true;
});
apiRouter.all("/api/storage/neuro-cache", async (req, res) => {
  await handleNeuroCacheRoute(req, res);
  return true;
});
apiRouter.all("/api/curator/teach", async (req, res) => {
  await handleCuratorTeach(req, res);
  return true;
});
apiRouter.all("/api/curator/taste", async (req, res) => {
  await handleCuratorTaste(req, res);
  return true;
});
apiRouter.prefix("/api/books", async (req, res) => dispatchBooksApi(req, res));
apiRouter.all("/api/lookup", async (req, res) => {
  if (!bindCuratorResponse(req, res)) return true;
  await handleLookup(req, res);
  return true;
});
apiRouter.all("/api/collection", async (req, res) => {
  if (!bindCuratorResponse(req, res)) return true;
  await handleCollection(req, res);
  return true;
});
apiRouter.all("/api/person", async (req, res) => {
  if (!bindCuratorResponse(req, res)) return true;
  await handlePerson(req, res);
  return true;
});
apiRouter.all("/api/discover", async (req, res) => {
  if (!bindCuratorResponse(req, res)) return true;
  await handleDiscover(req, res);
  return true;
});
apiRouter.all("/api/similar", async (req, res) => {
  if (!bindCuratorResponse(req, res)) return true;
  await handleSimilar(req, res);
  return true;
});
apiRouter.all("/api/curator", async (req, res) => {
  await handleCurator(req, res);
  return true;
});
apiRouter.all("/api/curator/reset", async (req, res) => {
  await handleCuratorReset(req, res);
  return true;
});
apiRouter.all("/api/curator/feed", async (req, res) => {
  await handleCuratorFeed(req, res);
  return true;
});
apiRouter.all("/api/curator/recommendations", async (req, res) => {
  await handleCuratorFeed(req, res);
  return true;
});
apiRouter.all("/api/box", async (req, res) => {
  await handleBox(req, res);
  return true;
});
apiRouter.all("/api/ready", async (req, res) => {
  await handleReady(req, res);
  return true;
});
apiRouter.all("/api/indexer", async (req, res) => {
  await handleIndexer(req, res);
  return true;
});
apiRouter.all("/api/tailscale/login", async (req, res) => {
  await handleTailscaleLogin(req, res);
  return true;
});
apiRouter.all("/api/tailscale/install", async (req, res) => {
  await handleTailscaleInstall(req, res);
  return true;
});
apiRouter.all("/api/tailscale/check", async (req, res) => {
  await handleTailscaleCheck(req, res);
  return true;
});
apiRouter.all("/api/tailscale/serve", async (req, res) => {
  await handleTailscaleServe(req, res);
  return true;
});
apiRouter.all("/api/update/check", async (req, res) => {
  await handleUpdateCheck(req, res);
  return true;
});
apiRouter.all("/api/update/apply", async (req, res) => {
  await handleUpdateApply(req, res);
  return true;
});
apiRouter.post("/api/update/run", async (req, res) => {
  await handleUpdateApply(req, res);
  return true;
});
apiRouter.all("/api/update/status", async (req, res) => {
  await handleUpdateStatus(req, res);
  return true;
});
apiRouter.all("/api/update/progress", async (req, res) => {
  await handleUpdateProgress(req, res);
  return true;
});
apiRouter.post("/api/request", async (req, res) => {
  await handleRequest(req, res);
  return true;
});
apiRouter.all("/api/watchlist", async (req, res) => {
  await handleWatchlist(req, res);
  return true;
});
apiRouter.all("/api/cast/sessions", async (req, res) => {
  await handleCastSessions(req, res);
  return true;
});
apiRouter.all("/api/cast/play", async (req, res) => {
  await handleCastPlay(req, res);
  return true;
});
apiRouter.all("/api/cast/control", async (req, res) => {
  await handleCastControl(req, res);
  return true;
});
apiRouter.all("/api/cast/message", async (req, res) => {
  await handleCastMessage(req, res);
  return true;
});
apiRouter.all("/api/quickconnect/authorize", async (req, res) => {
  await handleQuickConnectAuthorize(req, res);
  return true;
});
apiRouter.all("/api/quickconnect/status", async (req, res) => {
  await handleQuickConnectStatus(req, res);
  return true;
});
apiRouter.all("/api/flickmatch/session", async (req, res) => {
  await handleFlickMatchSession(req, res);
  return true;
});
apiRouter.all("/api/flickmatch/vote", async (req, res) => {
  await handleFlickMatchVote(req, res);
  return true;
});
apiRouter.all("/api/flickmatch/status", async (req, res) => {
  await handleFlickMatchStatus(req, res);
  return true;
});
apiRouter.all("/api/kids/approved", async (req, res) => {
  await handleKidsApproved(req, res);
  return true;
});
apiRouter.all("/api/kids/toggle", async (req, res) => {
  await handleKidsToggle(req, res);
  return true;
});
apiRouter.all("/api/kids/gifts", async (req, res) => {
  await handleKidsGifts(req, res);
  return true;
});
apiRouter.all("/api/kids/gift", async (req, res) => {
  await handleKidsGiftAction(req, res);
  return true;
});
apiRouter.prefix("/api/companion", async (req, res) => {
  await handleCompanionRoute(req, res);
  return true;
});
apiRouter.all("/api/recap/catchmeup", async (req, res, url) => {
  const titleId = url.searchParams.get("titleId") || "default";
  const progress = Number(url.searchParams.get("progress") || 0);
  const episode = Number(url.searchParams.get("ep") || 1);
  const recap = dualBrainService.generateCatchMeUp(titleId, progress, episode);
  send(res, recap.ok ? 200 : 422, recap);
  return true;
});
apiRouter.all("/api/acoustic/tune", async (req, res) => {
  const payload = req.method === "POST" ? await readBody(req) : {};
  const tuning = dualBrainService.tuneAcousticRoom(payload);
  send(res, tuning.ok ? 200 : 422, tuning);
  return true;
});
apiRouter.all("/api/acoustic/impulse-profile", async (req, res, url) => {
  const payload = req.method === "POST"
    ? await readBody(req)
    : {
        measured: url.searchParams.get("measured") === "true",
        rt60: url.searchParams.has("rt60")
          ? Number(url.searchParams.get("rt60"))
          : Number.NaN,
      };
  const rt60 = Number(payload.rt60);
  const nodes = Array.isArray(payload.nodes)
    ? payload.nodes.map(Number).filter((node) => Number.isFinite(node) && node >= 20 && node <= 20_000)
    : [];
  if (
    payload.measured !== true ||
    !Number.isFinite(rt60) ||
    rt60 < 0.08 ||
    rt60 > 4
  ) {
    send(res, 422, {
      ok: false,
      available: false,
      error: "A real microphone measurement is required before an impulse profile can be applied.",
    });
    return true;
  }
  const profile = inRamTranscoder.applyRoomImpulseProfile(rt60, nodes);
  send(res, profile.ok ? 200 : 501, {
    ...profile,
    measurementSource: "client-reported-measurement",
  });
  return true;
});
apiRouter.all("/api/guest/cleanup", async (req, res) => {
  await handleGuestCleanup(req, res);
  return true;
});
apiRouter.all("/api/requests/pending", async (req, res) => {
  await handlePendingRequests(req, res);
  return true;
});
apiRouter.all("/api/requests/approve", async (req, res) => {
  await handleApproveRequest(req, res);
  return true;
});
apiRouter.all("/api/requests/reject", async (req, res) => {
  await handleRejectRequest(req, res);
  return true;
});
apiRouter.all("/api/cabin/status", async (req, res) => {
  await handleCabinStatus(req, res);
  return true;
});
apiRouter.all("/api/cabin/toggle", async (req, res) => {
  await handleCabinToggle(req, res);
  return true;
});
apiRouter.all("/api/vault/sync", async (req, res) => {
  await handleVaultSync(req, res);
  return true;
});
apiRouter.all("/api/subtitles/status", async (req, res) => {
  await handleSubtitlesStatus(req, res);
  return true;
});
apiRouter.all("/api/subtitles/search", async (req, res) => {
  await handleSubtitlesSearch(req, res);
  return true;
});
apiRouter.prefix("/api/subtitles/track", async (req, res) => {
  await handleSubtitlesTrack(req, res);
  return true;
});
apiRouter.all("/api/subtitles/sync", async (req, res) => {
  await handleSubtitlesSync(req, res);
  return true;
});
apiRouter.prefix("/api/standby", async (req, res) => {
  await handleStandbyRoute(req, res);
  return true;
});
apiRouter.all("/api/battery/status", async (req, res) => {
  await handleBatteryStatus(req, res);
  return true;
});
apiRouter.all("/api/battery/mode", async (req, res) => {
  await handleBatteryMode(req, res);
  return true;
});
apiRouter.all("/api/system/benchmark", async (req, res) => {
  await handleSiliconBenchmark(req, res);
  return true;
});
apiRouter.all("/api/system/benchmark/run", async (req, res) => {
  await handleSiliconBenchmark(req, res);
  return true;
});
apiRouter.prefix("/api/support", async (req, res, url) =>
  handleSupportRoute(req, res, url),
);
apiRouter.prefix("/api/pulse", async (req, res, url) => {
  if (url.pathname === "/api/pulse/telemetry") {
    if (req.method === "POST") {
      const body = await readBody(req);
      if (body.event) {
        if (body.event.type === "latency-spike")
          telemetryWatchdog.logFuseEvent(body.event);
        else if (body.event.source)
          telemetryWatchdog.logRateLimitEvent(body.event);
        else telemetryWatchdog.logPlaybackEvent(body.event);
      }
      send(res, 200, { success: true });
    } else {
      send(res, 200, JSON.parse(telemetryWatchdog.generateSanitizedCapsule()));
    }
    return true;
  }
  if (url.pathname === "/api/pulse/playback-plan") {
    if (req.method === "POST") {
      const { clientSpec, networkSpec, mediaSpec } = await readBody(req);
      const plan = adaptivePlayback.evaluatePlaybackPlan(
        clientSpec,
        networkSpec,
        mediaSpec,
      );
      send(res, 200, plan);
    } else {
      send(res, 405, { error: "Method not allowed" });
    }
    return true;
  }
  if (url.pathname === "/api/pulse/battery") {
    const state = await batteryGuardian.evaluateBatteryState();
    send(res, 200, state);
    return true;
  }
  if (url.pathname === "/api/pulse/audio") {
    send(res, 200, audioIntelligence.getSmartNightModeProfile());
    return true;
  }
  return handlePulseAiRoute(req, res, url);
});
apiRouter.prefix("/api/apps/android", async (req, res, url) =>
  handleAndroidClientRoute(req, res, url),
);
apiRouter.all("/api/app/version", async (req, res, url) =>
  handleAndroidClientRoute(req, res, url),
);
apiRouter.prefix("/api/profiles", async (req, res, url) =>
  handleProfilesRoute(req, res, url, undefined, {
    intelligenceStore: await localIntelligenceStore(), onIntelligenceError: reportIntelligenceError,
  }),
);
apiRouter.prefix("/api/system/os-upgrade", async (req, res, url) =>
  handleOsUpgradeRoute(req, res, url),
);
apiRouter.all("/api/system/reboot", async (req, res) =>
  handleOsUpgradeRoute(req, res),
);

apiRouter.all("/api/system/mode", async (req, res, url) => {
  if (req.method === "POST") {
    const body = await readBody(req);
    if (typeof body.dedicated === "boolean") {
      process.env.REELOS_DEDICATED = body.dedicated ? "1" : "0";
    }
  }

  let foreignProcesses = [];
  if (process.platform === "win32") {
    try {
      const { execSync } = await import("node:child_process");
      const stdout = execSync("tasklist /FO CSV /NH", {
        timeout: 2000,
        encoding: "utf8",
      });
      if (stdout) {
        const lines = stdout.split("\n").filter(Boolean);
        const creatorApps =
          /premiere\.exe|photoshop\.exe|resolve\.exe|aftereffects\.exe|blender\.exe|obs64\.exe|lightroom\.exe/i;
        for (const l of lines) {
          if (/node\.exe|caddy\.exe|decypharr\.exe/i.test(l)) continue;
          const parts = l.split('","');
          if (parts.length >= 5) {
            const name = parts[0].replace(/"/g, "");
            const memStr = parts[4].replace(/[^\d]/g, "");
            const memKb = parseInt(memStr, 10) || 0;
            if (creatorApps.test(l) || memKb > 1500000) {
              foreignProcesses.push({ name, memoryBytes: memKb * 1024 });
            }
          }
        }
      }
    } catch (e) {}
  }

  const { politeScheduler } = await import("./services/polite-scheduler.mjs");
  const { isDedicatedMachine } =
    await import("./services/machine-classifier.mjs");

  send(res, 200, {
    dedicatedOverride: process.env.REELOS_DEDICATED === "1",
    isDedicated: isDedicatedMachine(),
    foreignProcesses,
    memoryBudgets: politeScheduler.getStatus(),
  });
  return true;
});

apiRouter.all("/api/disks/usb", async (req, res) => {
  await handleUsbDisks(req, res);
  return true;
});
apiRouter.all("/api/disks/usb/mount", async (req, res) => {
  await handleUsbDisksMount(req, res);
  return true;
});
apiRouter.all("/api/disks/format", async (req, res) => {
  await handleUsbDisksFormat(req, res);
  return true;
});
apiRouter.all("/api/usb-creator/iso-status", async (req, res) => {
  await handleUsbCreatorIsoStatus(req, res);
  return true;
});
apiRouter.all("/api/usb-creator/drives", async (req, res) => {
  await handleUsbCreatorDrives(req, res);
  return true;
});
apiRouter.all("/api/usb-creator/prepare", async (req, res) => {
  await handleUsbCreatorPrepare(req, res);
  return true;
});
apiRouter.all("/api/usb-creator/launch-flasher", async (req, res) => {
  await handleUsbCreatorLaunchFlasher(req, res);
  return true;
});
apiRouter.all("/api/stream/prefetch-status", async (req, res) => {
  await handleStreamPrefetch(req, res);
  return true;
});
apiRouter.all("/api/stream/prefetch-purge", async (req, res) => {
  await handleStreamPrefetch(req, res);
  return true;
});
// Keep development and preview playback behind the same byte-level authority
// checks as the household server. Exact prefetch routes retain their handlers.
async function handleGuardedStream(req, res) {
  const { handleStreamRequest } = await import("./services/neural-stream-server.mjs");
  return handleStreamRequest(req, res, { stateDir: process.env.REELOS_STATE });
}
apiRouter.all("/api/stream", handleGuardedStream);
apiRouter.prefix("/api/stream/", handleGuardedStream);
apiRouter.all("/api/backup/list", async (req, res) => {
  await handleBackupList(req, res);
  return true;
});
apiRouter.all("/api/backup/create", async (req, res) => {
  await handleBackupCreate(req, res);
  return true;
});
apiRouter.prefix("/api/backup/download/", async (req, res, url) => {
  const file = url.pathname.slice("/api/backup/download/".length);
  await handleBackupDownload(req, res, file);
  return true;
});
apiRouter.all("/api/backup/restore", async (req, res) => {
  await handleBackupRestore(req, res);
  return true;
});
apiRouter.all("/api/password", async (req, res) => {
  await handlePassword(req, res);
  return true;
});
apiRouter.all("/api/quality", async (req, res) => {
  await handleQuality(req, res);
  return true;
});
apiRouter.all("/api/intent", async (req, res) => {
  await handleIntent(req, res);
  return true;
});
apiRouter.all("/api/activity", async (req, res) => {
  await handleActivity(req, res);
  return true;
});
apiRouter.all("/api/settings", async (req, res) => {
  await handleSettings(req, res);
  return true;
});
apiRouter.all("/api/ports", async (req, res) => {
  await handlePorts(req, res);
  return true;
});
apiRouter.all("/api/doctor", async (req, res) => {
  await handleDoctor(req, res);
  return true;
});
apiRouter.all("/api/repair", async (req, res) => {
  await handleRepair(req, res, { send, readBody, otaRunning });
  return true;
});
apiRouter.all("/api/reset", async (req, res) => {
  await handleReset(req, res);
  return true;
});
apiRouter.all("/api/wire", async (req, res) => {
  await handleWire(req, res);
  return true;
});
apiRouter.all("/api/library/reset", async (req, res) => {
  await handleLibraryReset(req, res);
  return true;
});
apiRouter.all("/api/library/sanitize", async (req, res) => {
  await handleLibrarySanitize(req, res);
  return true;
});
apiRouter.all("/api/library/keep", async (req, res) => {
  await handleLibraryKeep(req, res);
  return true;
});
apiRouter.prefix("/api/preparation", async (req, res, url) => {
  const { handleMediaPreparationRoute } = await import("./services/media-preparation-service.mjs");
  return handleMediaPreparationRoute(req, res, url, readBoundedPrivateBody, {
    stateDir: process.env.REELOS_STATE,
    profilesDir: process.env.REELOS_PROFILES_DIR,
  });
});
apiRouter.all("/api/library", async (req, res) => {
  await handleLibrary(req, res);
  return true;
});
apiRouter.prefix("/api/media/", async (req, res, url) => {
  const match = url.pathname.match(/^\/api\/media\/([^/]+)\/(sources|intro-timestamps)$/);
  if (!match) return false;
  const { playbackStateDir, playbackIdentity, readPlaybackLibraryItems, playbackItemId,
    authorizePlaybackItem, projectPlaybackSources, sendPlaybackFailure } = await import("./services/playback-access-service.mjs");
  const options = { stateDir: playbackStateDir() };
  const identity = playbackIdentity(req, options);
  if (!identity.ok) return sendPlaybackFailure(res, identity);
  if ((req.method || "GET").toUpperCase() !== "GET") {
    res.setHeader("Allow", "GET");
    return sendPlaybackFailure(res, { ok: false, status: 405, code: "method_not_allowed", error: "Use GET for media details." });
  }
  let itemId;
  try { itemId = decodeURIComponent(match[1]); } catch { itemId = ""; }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(itemId)) {
    return sendPlaybackFailure(res, { ok: false, status: 400, code: "invalid_item", error: "A valid title is required." });
  }
  const titles = readPlaybackLibraryItems(options);
  const matches = titles.filter((item) => item.id === itemId || playbackItemId(item) === itemId
    || (Array.isArray(item.ids) && item.ids.includes(itemId)));
  const item = matches.length === 1 ? matches[0] : null;
  const access = authorizePlaybackItem(req, item, options);
  if (!access.ok) return sendPlaybackFailure(res, access);
  const canonicalId = playbackItemId(item);
  if (titles.filter((candidate) => playbackItemId(candidate) === canonicalId).length !== 1) {
    return sendPlaybackFailure(res, { ok: false, status: 404, code: "playback_source_unmapped", error: "No unique source is mapped to this title." });
  }
  const sendPrivate = (body) => {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store" });
    res.end(JSON.stringify(body));
    return true;
  };
  if (match[2] === "intro-timestamps") {
    // Local files have no verified intro timeline. Only an explicitly mapped
    // Jellyfin item may query its local adapter; never guess from a public ID.
    if (!item.jellyfinId && !item.Id) {
      return sendPrivate({ itemId, hasIntro: false, introStart: 0, introEnd: 0, status: "unavailable" });
    }
    let token = "";
    try { token = readFileSync(join(options.stateDir, "jellyfin.token"), "utf8").trim(); } catch {}
    const intro = await queryJellyfinIntro(canonicalId, { token });
    const freshMatches = readPlaybackLibraryItems(options).filter((candidate) => playbackItemId(candidate) === canonicalId);
    const freshItem = freshMatches.length === 1 ? freshMatches[0] : null;
    const current = authorizePlaybackItem(req, freshItem, options);
    if (!current.ok || current.profile?.id !== access.profile.id) {
      return sendPlaybackFailure(res, current.ok ? { ok: false, status: 403, code: "playback_identity_changed", error: "The active profile changed." } : current);
    }
    if (JSON.stringify(freshItem) !== JSON.stringify(item)) {
      return sendPlaybackFailure(res, { ok: false, status: 403, code: "playback_source_changed", error: "The title source changed. Open it again." });
    }
    return sendPrivate({ itemId, hasIntro: intro.hasIntro === true,
      introStart: intro.introStart, introEnd: intro.introEnd });
  }
  const sources = projectPlaybackSources(item, access);
  const source = sources[0] || null;
  const rawProgress = access.profile.progress?.[item.id] ?? access.profile.progress?.[canonicalId]
    ?? access.profile.watchProgress?.[item.id] ?? access.profile.watchProgress?.[canonicalId] ?? 0;
  const resumeProgress = typeof rawProgress === "number" && Number.isFinite(rawProgress)
    ? Math.max(0, Math.min(1, rawProgress)) : 0;
  // File presence proves available bytes, not browser codec support or a ready
  // rendition. Do not expose server paths, upstream URLs, or invented quality.
  return sendPrivate({ ok: true, itemId, jellyfinId: canonicalId, resumeProgress,
    title: { id: item.id || canonicalId, title: item.title || item.Name || "Personal media", year: item.year, kind: item.kind || "movie" },
    activeProfileId: access.profile.id, progressTitleId: item.id || canonicalId,
    reaction: access.profile.reactions?.[item.id || canonicalId]
      ?? (access.profile.lessLikeIds?.includes(item.id || canonicalId) ? "less" : null),
    available: Boolean(source), directPlayReady: false,
    sources, hasMultipleVersions: sources.length > 1,
    recommendedForBrowser: source, recommendedForMobile: source, recommendedForTv: source });
});
apiRouter.prefix("/api/playback/", async (req, res) => {
  const system = await localIntelligenceSystem().catch((error) => {
    reportIntelligenceError(error);
    return null;
  });
  return handlePlaybackSessionRoute(req, res, {
    intelligenceStore: system?.store || await localIntelligenceStore(),
    intelligenceCoordinator: system?.coordinator || null,
    onIntelligenceError: reportIntelligenceError,
  });
});
apiRouter.all("/downloads/reelos-app.apk", async (req, res, url) =>
  handleAndroidClientRoute(req, res, url),
);
// Use the wider prefix so URL parser dot-segment normalization cannot turn a
// traversal-shaped content-addressed request into an unrelated static file.
apiRouter.prefix("/clients/", async (req, res, url) =>
  handleAndroidClientRoute(req, res, url),
);
apiRouter.all("/api/discovery", async (req, res, url) =>
  handleAndroidClientRoute(req, res, url),
);
apiRouter.all("/api/settings/shadow-lab", async (req, res) =>
  handleShadowLabRoute(req, res),
);
apiRouter.all("/api/shadow-lab/search", async (req, res) =>
  handleShadowLabRoute(req, res),
);
apiRouter.prefix("/api/jf/Items/", async (req, res, url) => {
  if (url.pathname.endsWith("/Images/Primary")) {
    await handleJellyfinImage(req, res);
    return true;
  }
  return false;
});
apiRouter.all("/api/disks", async (req, res) => {
  await handleDisks(req, res);
  return true;
});
apiRouter.all("/api/disks/migrate-internal", async (req, res) => {
  await handleMigrateInternal(req, res);
  return true;
});
apiRouter.all("/api/wifi/status", async (req, res) => {
  await handleWifiStatus(req, res);
  return true;
});
apiRouter.all("/api/wifi/scan", async (req, res) => {
  await handleWifiScan(req, res);
  return true;
});
apiRouter.all("/api/wifi/connect", async (req, res) => {
  await handleWifiConnect(req, res);
  return true;
});
apiRouter.all("/api/storage", async (req, res) => {
  await handleStorage(req, res);
  return true;
});
apiRouter.all("/api/transcode", async (req, res) => {
  await handleTranscode(req, res);
  return true;
});
apiRouter.all("/api/provision", async (req, res) => {
  await handleProvision(req, res);
  return true;
});
apiRouter.all("/api/ping", async (req, res) => {
  await handlePing(req, res);
  return true;
});
apiRouter.all("/api/performance", async (req, res) => {
  await handlePerformance(req, res);
  return true;
});
apiRouter.all("/api/hardware", async (req, res) => {
  await handleHardware(req, res);
  return true;
});
apiRouter.all("/api/terminal", async (req, res) => {
  await handleTerminal(req, res);
  return true;
});
apiRouter.all("/api/logs", async (req, res) => {
  await handleLogs(req, res);
  return true;
});
apiRouter.all("/api/bugs/github", async (req, res) => {
  await handleBugsGithub(req, res);
  return true;
});
apiRouter.all("/api/watchparty", async (req, res) => {
  const { watchPartyService } =
    await import("./services/watchparty-service.mjs");
  return watchPartyService.handleHttp(req, res);
});
apiRouter.all("/api/watchparty/*", async (req, res) => {
  const { watchPartyService } =
    await import("./services/watchparty-service.mjs");
  return watchPartyService.handleHttp(req, res);
});
apiRouter.all("/api/cinema/taste-bubbles", async (req, res) => {
  const { handleTasteBubblesRoute } =
    await import("./services/neural-taste-bubbles-service.mjs");
  return handleTasteBubblesRoute(req, res);
});
apiRouter.all("/api/cinema/taste-bubbles/react", async (req, res) => {
  const { handleTasteBubblesRoute } =
    await import("./services/neural-taste-bubbles-service.mjs");
  return handleTasteBubblesRoute(req, res);
});
apiRouter.all("/api/cinema/gemini/status", async (req, res) => {
  const { geminiService } = await import("./services/gemini-service.mjs");
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      ok: true,
      configured: geminiService.isConfigured(),
      model: geminiService.model,
    }),
  );
  return true;
});
export async function dispatchReelOsApi(req, res) {
  return apiRouter.dispatch(req, res);
}

function attachLookupApi(server) {
  void import("./reelos-beta-sidecar.mjs")
    .then((m) => m.idleOffBooksIfNeeded())
    .catch(() => {});
  server.middlewares.use(async (req, res, next) => {
    try {
      if (await dispatchReelOsApi(req, res)) return;
    } catch (e) {
      send(res, 500, { error: String(e) });
      return;
    }
    next();
  });
}

export function reelosLookupPlugin() {
  return {
    name: "reelos-lookup",
    apply: "serve",
    configureServer: attachLookupApi,
    configurePreviewServer: attachLookupApi,
  };
}

export { handleLibrarySanitize, sanitizeTitleString, isFuseOffline };
