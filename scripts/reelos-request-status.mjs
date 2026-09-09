/** Load Jellyfin shelf + *arr hasFile facts for honest GET /api/request. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { LIBRARY_CACHE_FILE, readLibraryCacheFile } from "./reelos-library.mjs";
import { arrHasFile, buildArrIndex } from "./reelos-seerr.mjs";

export function xmlApiKey(file) {
  if (!existsSync(file)) return null;
  const m = /<ApiKey>([^<]+)<\/ApiKey>/.exec(readFileSync(file, "utf8"));
  return m?.[1] ?? null;
}

export function arrApiKey(name) {
  for (const p of [
    `/opt/reelos/compose/configs/${name}/config.xml`,
    `/workspace/install/compose/configs/${name}/config.xml`,
    `/workspace/compose/configs/${name}/config.xml`,
  ]) {
    const key = xmlApiKey(p);
    if (key) return key;
  }
  return null;
}

async function arrJson(url, key, ms = 10000, { method = "GET", body } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const headers = { Accept: "application/json" };
    if (key) headers["X-Api-Key"] = key;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ac.signal,
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return { ok: true };
    try {
      return JSON.parse(text);
    } catch {
      return { ok: true };
    }
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** After a TV POST: search if the season has no files. Always relink+ManualImport (dump may appear). */
export function planTvPostRecover({ mediaType, season, arrHasSeasonFile = false } = {}) {
  if (mediaType !== "tv") return { search: false, import: false };
  return { search: !arrHasSeasonFile && season != null, import: true };
}

/** Movie POST/reuse must MoviesSearch. TV stays SeasonSearch. Seerr add is async. */
export function planArrPostRecover({ mediaType, season, arrHasFile = false } = {}) {
  if (mediaType === "movie") return { search: !arrHasFile, import: true };
  return planTvPostRecover({ mediaType, season, arrHasSeasonFile: arrHasFile });
}

/** House: Seerr 200 then *arr still empty for a few seconds. Poll, do not skip search. */
export async function waitForArrRow({
  fetchArr = arrJson,
  url,
  key,
  match,
  tries = 6,
  delayMs = 400,
} = {}) {
  if (!url || !key || typeof match !== "function") return null;
  for (let i = 0; i < tries; i++) {
    const rows = await fetchArr(url, key);
    const list = Array.isArray(rows) ? rows : [];
    const hit = list.find(match);
    if (hit) return hit;
    if (i < tries - 1 && delayMs > 0) await sleep(delayMs);
  }
  return null;
}

export function listMissingRecoverTargets({ series = [], movies = [] } = {}) {
  const out = [];
  for (const s of series || []) {
    const tmdb = s?.tmdbId;
    if (tmdb == null) continue;
    for (const season of s.seasons || []) {
      const n = Number(season?.seasonNumber);
      const files = Number(season?.statistics?.episodeFileCount || 0);
      if (!Number.isFinite(n) || n <= 0 || files > 0) continue;
      if (season?.monitored === false || s.monitored === false) continue;
      out.push({ mediaType: "tv", tmdb, season: n });
      break;
    }
  }
  for (const m of movies || []) {
    if (!m || m.tmdbId == null || m.monitored === false) continue;
    const files = Number(m.statistics?.movieFileCount || 0);
    if (m.hasFile === true || files > 0) continue;
    out.push({ mediaType: "movie", tmdb: m.tmdbId });
  }
  return out;
}

export function spawnWireImport() {
  const script = [
    "/opt/reelos/bin/wire-engines.py",
    "/workspace/daemon/wire-engines.py",
    "/workspace/install/bin/wire-engines.py",
  ].find((p) => existsSync(p));
  if (!script) return false;
  try {
    const child = spawn("python3", [script, "import"], { detached: true, stdio: "ignore" });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

export function spawnLockClients() {
  const script = [
    "/opt/reelos/bin/lock-download-clients.py",
    "/workspace/daemon/lock-download-clients.py",
    "/workspace/install/bin/lock-download-clients.py",
  ].find((p) => existsSync(p));
  if (!script) return false;
  try {
    const child = spawn("python3", [script, "--quick"], { detached: true, stdio: "ignore" });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

export function fieldValue(fields, name) {
  const hit = (fields || []).find((f) => f && f.name === name);
  return hit?.value;
}

export function decypharrClientMissing(clients) {
  const rows = Array.isArray(clients) ? clients : [];
  return !rows.some((c) => {
    if (!c || c.implementation !== "QBittorrent") return false;
    const host = String(fieldValue(c.fields, "host") || "");
    const port = Number(fieldValue(c.fields, "port"));
    return host === "decypharr" && port === 8282;
  });
}

export function sonarrDecypharrPayload() {
  return {
    enable: true,
    protocol: "torrent",
    priority: 1,
    removeCompletedDownloads: false,
    removeFailedDownloads: true,
    name: "ReelOS-Decypharr",
    implementation: "QBittorrent",
    implementationName: "qBittorrent",
    configContract: "QBittorrentSettings",
    fields: [
      { name: "host", value: "decypharr" },
      { name: "port", value: 8282 },
      { name: "useSsl", value: false },
      { name: "urlBase", value: "" },
      { name: "username", value: "" },
      { name: "password", value: "" },
      { name: "tvCategory", value: "sonarr" },
    ],
  };
}

export function hybridQualityShouldAllow(name) {
  const n = String(name || "")
    .toLowerCase()
    .replace(/[\s_-]/g, "");
  return ["720p", "1080p", "2160p", "4k"].some((tag) => n.includes(tag));
}

export function profileAllowsHd(profile) {
  const walk = (items) => {
    if (!Array.isArray(items)) return false;
    for (const item of items) {
      if (item?.items && walk(item.items)) return true;
      const qname = String(item?.quality?.name || item?.name || "")
        .toLowerCase()
        .replace(/[\s_-]/g, "");
      if (item?.allowed === true && (qname.includes("720p") || qname.includes("1080p"))) return true;
    }
    return false;
  };
  return walk(profile?.items);
}

export function pickFallbackProfile(profiles, currentId) {
  const rows = Array.isArray(profiles) ? profiles : [];
  const current = rows.find((p) => p?.id === currentId);
  if (profileAllowsHd(current)) return { id: currentId, reason: "ok", name: current?.name };
  for (const name of ["Any", "HD-1080p", "HD-720p"]) {
    const hit = rows.find((p) => p?.name === name && p?.id != null);
    if (hit) return { id: hit.id, reason: name.toLowerCase().replace(/-/g, ""), name };
  }
  const hd = rows.find((p) => profileAllowsHd(p) && p?.id != null);
  if (hd) return { id: hd.id, reason: "hd-profile", name: hd.name };
  return { id: currentId, reason: "none", name: current?.name };
}

export function widenHybridProfileItems(items) {
  if (!Array.isArray(items)) return false;
  let changed = false;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    if (Array.isArray(item.items) && item.items.length) {
      if (widenHybridProfileItems(item.items)) {
        if (item.allowed !== true) {
          item.allowed = true;
          changed = true;
        }
      }
      continue;
    }
    const qname = item.quality?.name || item.name || "";
    if (hybridQualityShouldAllow(qname) && item.allowed !== true) {
      item.allowed = true;
      changed = true;
    }
  }
  return changed;
}

/** SeasonSearch success + 0 files: no Decypharr client and/or Ultra-HD rejecting EZTV 720p. */
export async function ensureTvGrabPath({ fetchArr = arrJson, sonarrKey, series } = {}) {
  const out = { clientAdded: false, profileFallback: "ok", profileWidened: false };
  if (!sonarrKey || !series?.id) return out;
  spawnLockClients();
  const clients = await fetchArr("http://127.0.0.1:8989/api/v3/downloadclient", sonarrKey);
  if (decypharrClientMissing(clients)) {
    const added = await fetchArr("http://127.0.0.1:8989/api/v3/downloadclient", sonarrKey, 12000, {
      method: "POST",
      body: sonarrDecypharrPayload(),
    });
    out.clientAdded = Boolean(added);
  }
  const profiles = await fetchArr("http://127.0.0.1:8989/api/v3/qualityprofile", sonarrKey);
  const rows = Array.isArray(profiles) ? profiles : [];
  const ultra = rows.find((p) => p?.name === "Ultra-HD");
  if (ultra && !profileAllowsHd(ultra)) {
    const items = ultra.items || [];
    if (widenHybridProfileItems(items)) {
      const widened = await fetchArr(
        `http://127.0.0.1:8989/api/v3/qualityprofile/${ultra.id}`,
        sonarrKey,
        12000,
        {
          method: "PUT",
          body: { ...ultra, items, upgradeAllowed: true },
        },
      );
      out.profileWidened = Boolean(widened);
    }
  }
  const refreshed = out.profileWidened
    ? await fetchArr("http://127.0.0.1:8989/api/v3/qualityprofile", sonarrKey)
    : rows;
  const fb = pickFallbackProfile(Array.isArray(refreshed) ? refreshed : rows, series.qualityProfileId);
  out.profileFallback = fb.reason;
  if (fb.reason !== "ok" && fb.id != null && fb.id !== series.qualityProfileId) {
    const changed = await fetchArr(`http://127.0.0.1:8989/api/v3/series/${series.id}`, sonarrKey, 12000, {
      method: "PUT",
      body: { ...series, qualityProfileId: fb.id },
    });
    if (!changed) out.profileFallback = "failed";
  }
  return out;
}

export async function kickArrRecover({
  mediaType,
  tmdb,
  season,
  fetchArr = arrJson,
  spawnImport = spawnWireImport,
  sonarrKey = arrApiKey("sonarr"),
  radarrKey = arrApiKey("radarr"),
  waitTries = 6,
  waitMs = 400,
} = {}) {
  const type = mediaType === "tv" ? "tv" : mediaType === "movie" ? "movie" : null;
  let seriesId = null;
  let movieId = null;
  let searched = false;
  let command = null;
  let grabPath = null;
  if (type === "tv" && sonarrKey && tmdb) {
    const n = Number(season);
    const wantSeason = Number.isFinite(n) && n > 0 ? n : null;
    const hit = await waitForArrRow({
      fetchArr,
      url: "http://127.0.0.1:8989/api/v3/series",
      key: sonarrKey,
      match: (s) => String(s?.tmdbId) === String(tmdb),
      tries: waitTries,
      delayMs: waitMs,
    });
    if (hit?.id) {
      seriesId = hit.id;
      const hasFile = arrHasFile(
        { titleId: `tmdb-tv-${tmdb}`, season: wantSeason },
        buildArrIndex({ series: [hit] }),
      );
      const plan = planArrPostRecover({
        mediaType: "tv",
        season: wantSeason,
        arrHasFile: hasFile,
      });
      if (plan.search) {
        grabPath = await ensureTvGrabPath({ fetchArr, sonarrKey, series: hit });
        const posted = await fetchArr("http://127.0.0.1:8989/api/v3/command", sonarrKey, 12000, {
          method: "POST",
          body: { name: "SeasonSearch", seriesId: hit.id, seasonNumber: wantSeason },
        });
        searched = Boolean(posted);
        command = searched ? "SeasonSearch" : null;
      }
    }
  } else if (type === "movie" && radarrKey && tmdb) {
    const hit = await waitForArrRow({
      fetchArr,
      url: "http://127.0.0.1:7878/api/v3/movie",
      key: radarrKey,
      match: (m) => String(m?.tmdbId) === String(tmdb),
      tries: waitTries,
      delayMs: waitMs,
    });
    if (hit?.id) {
      movieId = hit.id;
      const hasFile = arrHasFile({ titleId: `tmdb-${tmdb}` }, buildArrIndex({ movies: [hit] }));
      const plan = planArrPostRecover({ mediaType: "movie", arrHasFile: hasFile });
      if (plan.search) {
        const posted = await fetchArr("http://127.0.0.1:7878/api/v3/command", radarrKey, 12000, {
          method: "POST",
          body: { name: "MoviesSearch", movieIds: [hit.id] },
        });
        searched = Boolean(posted);
        command = searched ? "MoviesSearch" : null;
      }
    }
  }
  const importSpawned = spawnImport();
  return { ok: true, seriesId, movieId, searched, command, importSpawned, grabPath };
}

export async function kickTvSeasonRecover(opts = {}) {
  return kickArrRecover({ ...opts, mediaType: "tv" });
}

let cache = { at: 0, facts: null };

export function resetPresenceFactsCache() {
  cache = { at: 0, facts: null };
}

export async function loadPresenceFacts({
  now = Date.now(),
  ttlMs = 5000,
  force = false,
  libraryFile = LIBRARY_CACHE_FILE,
  fetchArr = arrJson,
} = {}) {
  if (!force && cache.facts && now - cache.at < ttlMs) return cache.facts;
  const entry = readLibraryCacheFile(libraryFile);
  const libraryTitles = entry?.titles || [];
  const [movies, series, torrents] = await Promise.all([
    fetchArr("http://127.0.0.1:7878/api/v3/movie", arrApiKey("radarr")),
    fetchArr("http://127.0.0.1:8989/api/v3/series", arrApiKey("sonarr")),
    fetchArr("http://127.0.0.1:8282/api/v2/torrents/info", null),
  ]);
  const movieRows = Array.isArray(movies) ? movies : [];
  const seriesRows = Array.isArray(series) ? series : [];
  const torrentRows = Array.isArray(torrents) ? torrents : [];
  const facts = {
    libraryTitles,
    movies: movieRows,
    series: seriesRows,
    torrents: torrentRows,
    arrReady: Array.isArray(movies) || Array.isArray(series),
    arrIndex: buildArrIndex({
      movies: movieRows,
      series: seriesRows,
    }),
    dumps: {
      sonarr: listDirNames("/mnt/symlinks/sonarr"),
      radarr: listDirNames("/mnt/symlinks/radarr"),
    },
    catalog: listDirNames("/mnt/debrid/__all__"),
  };
  cache = { at: now, facts };
  return facts;
}

export function listDirNames(dir) {
  try {
    return readdirSync(dir).filter((n) => n && !n.startsWith("."));
  } catch {
    return [];
  }
}
