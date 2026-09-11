/** Load Jellyfin shelf + *arr hasFile facts for honest GET /api/request. */
import { existsSync, readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
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
    if (!text) return { ok: true, empty: true };
    try {
      return JSON.parse(text);
    } catch {
      return { ok: true, empty: true };
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
export function commandPosted(posted) {
  if (!posted || typeof posted !== "object") return false;
  if (posted.empty) return false;
  if (posted.ok === false) return false;
  return posted.id != null || Boolean(posted.name);
}

export function recoverKickOk({ wantedSearch = false, searched = false, command = null, grabPath = null } = {}) {
  if (grabPath?.missing) return false;
  if (grabPath?.profileFallback === "failed") return false;
  if (wantedSearch) return Boolean(searched && command);
  return true;
}

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

/** When Seerr rows are supplied, recover only those titles — not the whole *arr backlog. */
export function seerrRecoverScope(seerrRows) {
  if (seerrRows == null) return null;
  const movies = new Set();
  const tv = new Set();
  for (const row of seerrRows || []) {
    if (row?.status === "available" || row?.engine === "downloaded") continue;
    const mediaType =
      row?.mediaType === "tv" || String(row?.titleId || "").startsWith("tmdb-tv-") ? "tv" : "movie";
    const tmdb = row?.tmdb ?? row?.tmdbId;
    if (tmdb == null) continue;
    if (mediaType === "movie") movies.add(String(tmdb));
    else tv.add(String(tmdb));
  }
  return { movies, tv };
}

export function listMissingRecoverTargets({ series = [], movies = [], seerrRows } = {}) {
  const scope = seerrRecoverScope(seerrRows);
  const out = [];
  for (const s of series || []) {
    const tmdb = s?.tmdbId;
    if (tmdb == null) continue;
    if (scope && !scope.tv.has(String(tmdb))) continue;
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
    if (scope && !scope.movies.has(String(m.tmdbId))) continue;
    const files = Number(m.statistics?.movieFileCount || 0);
    if (m.hasFile === true || files > 0) continue;
    out.push({ mediaType: "movie", tmdb: m.tmdbId });
  }
  return out;
}

/** Seerr requested National Treasure, Radarr never grew a row — recover must still add+search. */
export function listSeerrOrphanMovieTargets({ seerrRows = [], movies = [] } = {}) {
  const have = new Set(
    (movies || []).map((m) => (m?.tmdbId == null ? "" : String(m.tmdbId))).filter(Boolean),
  );
  const out = [];
  const seen = new Set();
  for (const row of seerrRows || []) {
    // Only stuck rows. A row Seerr already calls available is in the library; re-adding
    // it to Radarr and searching would re-grab the whole back catalogue on one recover.
    if (row?.status === "available" || row?.engine === "downloaded") continue;
    const mediaType =
      row?.mediaType === "tv" || String(row?.titleId || "").startsWith("tmdb-tv-") ? "tv" : "movie";
    const tmdb = row?.tmdb ?? row?.tmdbId;
    if (mediaType !== "movie" || tmdb == null) continue;
    const id = String(tmdb);
    if (have.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ mediaType: "movie", tmdb });
  }
  return out;
}

/** Seerr is still grabbing, Radarr has the row, but it is unmonitored — search never fires. */
export function listUnmonitoredMovieRecoverTargets({ seerrRows = [], movies = [] } = {}) {
  const requested = new Set();
  for (const row of seerrRows || []) {
    if (row?.status === "available" || row?.engine === "downloaded") continue;
    const mediaType =
      row?.mediaType === "tv" || String(row?.titleId || "").startsWith("tmdb-tv-") ? "tv" : "movie";
    const tmdb = row?.tmdb ?? row?.tmdbId;
    if (mediaType !== "movie" || tmdb == null) continue;
    requested.add(String(tmdb));
  }
  const out = [];
  for (const m of movies || []) {
    if (!m || m.tmdbId == null) continue;
    if (m.monitored !== false) continue;
    const files = Number(m.statistics?.movieFileCount || 0);
    if (m.hasFile === true || files > 0) continue;
    if (!requested.has(String(m.tmdbId))) continue;
    out.push({ mediaType: "movie", tmdb: m.tmdbId });
  }
  return out;
}

/** Seerr requested TWD S02, Sonarr has the series, that season is unmonitored — search never fires. */
export function listUnmonitoredSeasonRecoverTargets({ seerrRows = [], series = [] } = {}) {
  const byTmdb = new Map(
    (series || []).filter((s) => s && s.tmdbId != null).map((s) => [String(s.tmdbId), s]),
  );
  const out = [];
  const seen = new Set();
  for (const row of seerrRows || []) {
    if (row?.status === "available" || row?.engine === "downloaded") continue;
    const mediaType =
      row?.mediaType === "tv" || String(row?.titleId || "").startsWith("tmdb-tv-") ? "tv" : "movie";
    const tmdb = row?.tmdb ?? row?.tmdbId;
    if (mediaType !== "tv" || tmdb == null) continue;
    const n = Number(row.season);
    if (!Number.isFinite(n) || n <= 0) continue;
    const hit = byTmdb.get(String(tmdb));
    if (!hit) continue;
    const seasonRow = (hit.seasons || []).find((s) => Number(s?.seasonNumber) === n);
    const files = Number(seasonRow?.statistics?.episodeFileCount || 0);
    if (files > 0) continue;
    if (hit.monitored !== false && seasonRow && seasonRow.monitored !== false) continue;
    const key = `${tmdb}:${n}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ mediaType: "tv", tmdb, season: n });
  }
  return out;
}

/** Seerr requested Rick and Morty S03, Sonarr never grew a row — recover must still add+search. */
export function listSeerrOrphanSeriesTargets({ seerrRows = [], series = [] } = {}) {
  const have = new Set(
    (series || []).map((s) => (s?.tmdbId == null ? "" : String(s.tmdbId))).filter(Boolean),
  );
  const out = [];
  const seen = new Set();
  for (const row of seerrRows || []) {
    if (row?.status === "available" || row?.engine === "downloaded") continue;
    const mediaType =
      row?.mediaType === "tv" || String(row?.titleId || "").startsWith("tmdb-tv-") ? "tv" : "movie";
    const tmdb = row?.tmdb ?? row?.tmdbId;
    if (mediaType !== "tv" || tmdb == null) continue;
    if (have.has(String(tmdb))) continue;
    const n = Number(row.season);
    const season = Number.isFinite(n) && n > 0 ? n : 1;
    const key = `${tmdb}:${season}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ mediaType: "tv", tmdb, season });
  }
  return out;
}

export function listRecoverTargets({ series = [], movies = [], seerrRows = [] } = {}) {
  const missing = listMissingRecoverTargets({ series, movies, seerrRows });
  const movieOrphans = listSeerrOrphanMovieTargets({ seerrRows, movies });
  const movieUnmonitored = listUnmonitoredMovieRecoverTargets({ seerrRows, movies });
  const seasonUnmonitored = listUnmonitoredSeasonRecoverTargets({ seerrRows, series });
  const seriesOrphans = listSeerrOrphanSeriesTargets({ seerrRows, series });
  const seen = new Set(missing.map((t) => `${t.mediaType}:${t.tmdb}:${t.season ?? ""}`));
  const out = [...missing];
  for (const t of [...movieOrphans, ...movieUnmonitored, ...seasonUnmonitored, ...seriesOrphans]) {
    const key = `${t.mediaType}:${t.tmdb}:${t.season ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
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
    if (c.enable === false) return false;
    const host = String(fieldValue(c.fields, "host") || "");
    const port = Number(fieldValue(c.fields, "port"));
    return host === "decypharr" && port === 8282;
  });
}

export function sonarrDecypharrPayload() {
  return decypharrPayload("tv");
}

export function radarrDecypharrPayload() {
  return decypharrPayload("movie");
}

export function arrGrabService(kind) {
  if (kind === "movie") {
    return {
      origin: "http://127.0.0.1:7878/api/v3",
      itemPath: "movie",
      categoryField: "movieCategory",
      category: "radarr",
    };
  }
  return {
    origin: "http://127.0.0.1:8989/api/v3",
    itemPath: "series",
    categoryField: "tvCategory",
    category: "sonarr",
  };
}

export function decypharrPayload(kind) {
  const svc = arrGrabService(kind);
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
      { name: svc.categoryField, value: svc.category },
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

/** SeasonSearch/MoviesSearch success + 0 files: no Decypharr client and/or Ultra-HD rejecting 720p. */
export async function ensureArrGrabPath({ fetchArr = arrJson, key, item, kind = "tv" } = {}) {
  const out = { clientAdded: false, profileFallback: "ok", profileWidened: false };
  const svc = arrGrabService(kind);
  if (!key || !item?.id) return out;
  spawnLockClients();
  const clients = await fetchArr(`${svc.origin}/downloadclient`, key);
  if (decypharrClientMissing(clients)) {
    const added = await fetchArr(`${svc.origin}/downloadclient`, key, 12000, {
      method: "POST",
      body: decypharrPayload(kind),
    });
    out.clientAdded = Boolean(added);
  }
  const profiles = await fetchArr(`${svc.origin}/qualityprofile`, key);
  const rows = Array.isArray(profiles) ? profiles : [];
  const ultra = rows.find((p) => p?.name === "Ultra-HD");
  if (ultra && !profileAllowsHd(ultra)) {
    const items = structuredClone(ultra.items || []);
    if (widenHybridProfileItems(items)) {
      const widened = await fetchArr(
        `${svc.origin}/qualityprofile/${ultra.id}`,
        key,
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
    ? await fetchArr(`${svc.origin}/qualityprofile`, key)
    : rows;
  const fb = pickFallbackProfile(Array.isArray(refreshed) ? refreshed : rows, item.qualityProfileId);
  out.profileFallback = fb.reason;
  if (fb.reason !== "ok" && fb.id != null && fb.id !== item.qualityProfileId) {
    const changed = await fetchArr(`${svc.origin}/${svc.itemPath}/${item.id}`, key, 12000, {
      method: "PUT",
      body: { ...item, qualityProfileId: fb.id },
    });
    if (!changed) out.profileFallback = "failed";
  }
  return out;
}

export async function ensureTvGrabPath({ fetchArr = arrJson, sonarrKey, series } = {}) {
  return ensureArrGrabPath({ fetchArr, key: sonarrKey, item: series, kind: "tv" });
}

export async function ensureMovieGrabPath({ fetchArr = arrJson, radarrKey, movie } = {}) {
  return ensureArrGrabPath({ fetchArr, key: radarrKey, item: movie, kind: "movie" });
}

export function pickRadarrRootPath(roots) {
  const rows = Array.isArray(roots) ? roots : [];
  const prefer = rows.find((r) => String(r?.path || "").replace(/\/+$/, "") === "/symlinks/radarr");
  return String(prefer?.path || rows[0]?.path || "/symlinks/radarr");
}

export function pickSonarrRootPath(roots) {
  const rows = Array.isArray(roots) ? roots : [];
  const prefer = rows.find((r) => String(r?.path || "").replace(/\/+$/, "") === "/symlinks/sonarr");
  return String(prefer?.path || rows[0]?.path || "/symlinks/sonarr");
}

export function sonarrLookupUrls(tmdb) {
  return [`http://127.0.0.1:8989/api/v3/series/lookup?term=${encodeURIComponent(`tmdb:${tmdb}`)}`];
}

/** Sonarr lookup can answer with a different show. Adding it under the requested
 *  tmdbId monitors and SeasonSearchs the wrong title, so an unmatched hit is no hit. */
export function pickSonarrLookupSeries(hits, tmdb) {
  const want = String(tmdb);
  const rows = Array.isArray(hits) ? hits : hits && typeof hits === "object" && !hits.empty ? [hits] : [];
  return rows.find((s) => s && typeof s === "object" && String(s.tmdbId) === want) || null;
}

export function seasonNeedsMonitor(series, season) {
  if (!series) return false;
  if (series.monitored === false) return true;
  const n = Number(season);
  if (!Number.isFinite(n) || n <= 0) return false;
  const row = (series.seasons || []).find((s) => Number(s?.seasonNumber) === n);
  return !row || row.monitored === false;
}

export function seriesWithMonitoredSeason(series, season) {
  const n = Number(season);
  const seasons = (Array.isArray(series?.seasons) ? series.seasons : []).map((s) => ({
    ...s,
    monitored: Number(s.seasonNumber) === n && n > 0 ? true : s.monitored,
  }));
  if (Number.isFinite(n) && n > 0 && !seasons.some((s) => Number(s.seasonNumber) === n)) {
    seasons.push({ seasonNumber: n, monitored: true });
  }
  return { ...series, monitored: true, seasons };
}

/** Seerr 200 but Sonarr never got the series (Rick and Morty). Lookup + add, then SeasonSearch. */
export async function addSonarrSeries({ fetchArr = arrJson, sonarrKey, tmdb } = {}) {
  if (!sonarrKey || tmdb == null) return null;
  let series = null;
  for (const url of sonarrLookupUrls(tmdb)) {
    const hits = await fetchArr(url, sonarrKey);
    series = pickSonarrLookupSeries(hits, tmdb);
    if (series) break;
  }
  if (!series || typeof series !== "object") return null;
  const roots = await fetchArr("http://127.0.0.1:8989/api/v3/rootfolder", sonarrKey);
  const profiles = await fetchArr("http://127.0.0.1:8989/api/v3/qualityprofile", sonarrKey);
  const rows = Array.isArray(profiles) ? profiles : [];
  const fb = pickFallbackProfile(rows, series.qualityProfileId);
  const profileId = fb.id != null ? fb.id : rows[0]?.id;
  if (profileId == null) return null;
  const { id: _dropId, ...rest } = series;
  const body = {
    ...rest,
    tmdbId: Number(tmdb),
    qualityProfileId: profileId,
    rootFolderPath: pickSonarrRootPath(roots),
    monitored: true,
    seasonFolder: true,
    addOptions: { searchForMissingEpisodes: false, monitor: "none" },
  };
  const created = await fetchArr("http://127.0.0.1:8989/api/v3/series", sonarrKey, 15000, {
    method: "POST",
    body,
  });
  if (created?.id) return created;
  const again = await fetchArr("http://127.0.0.1:8989/api/v3/series", sonarrKey);
  const hit = (Array.isArray(again) ? again : []).find((s) => String(s?.tmdbId) === String(tmdb));
  return hit || created;
}

export function radarrLookupUrls(tmdb) {
  const id = encodeURIComponent(String(tmdb));
  return [
    `http://127.0.0.1:7878/api/v3/movie/lookup/tmdb?tmdbId=${id}`,
    `http://127.0.0.1:7878/api/v3/movie/lookup?term=${encodeURIComponent(`tmdb:${tmdb}`)}`,
  ];
}

/** Radarr text search can answer with a different film. Adding it under the requested
 *  tmdbId monitors and MoviesSearches the wrong title, so an unmatched hit is no hit. */
export function pickRadarrLookupMovie(hits, tmdb) {
  const want = String(tmdb);
  const rows = Array.isArray(hits) ? hits : hits && typeof hits === "object" && !hits.empty ? [hits] : [];
  return rows.find((m) => m && typeof m === "object" && String(m.tmdbId) === want) || null;
}

/** Seerr 200 but Radarr never got the movie (National Treasure). Lookup/tmdb + add, then MoviesSearch. */
export async function addRadarrMovie({ fetchArr = arrJson, radarrKey, tmdb } = {}) {
  if (!radarrKey || tmdb == null) return null;
  let movie = null;
  for (const url of radarrLookupUrls(tmdb)) {
    const hits = await fetchArr(url, radarrKey);
    movie = pickRadarrLookupMovie(hits, tmdb);
    if (movie) break;
  }
  if (!movie || typeof movie !== "object") return null;
  const roots = await fetchArr("http://127.0.0.1:7878/api/v3/rootfolder", radarrKey);
  const profiles = await fetchArr("http://127.0.0.1:7878/api/v3/qualityprofile", radarrKey);
  const rows = Array.isArray(profiles) ? profiles : [];
  const fb = pickFallbackProfile(rows, movie.qualityProfileId);
  const profileId = fb.id != null ? fb.id : rows[0]?.id;
  if (profileId == null) return null;
  const { id: _dropId, ...rest } = movie;
  const body = {
    ...rest,
    tmdbId: Number(tmdb),
    qualityProfileId: profileId,
    rootFolderPath: pickRadarrRootPath(roots),
    monitored: true,
    minimumAvailability: movie.minimumAvailability || "released",
    addOptions: { searchForMovie: false, monitor: "movieOnly" },
  };
  const created = await fetchArr("http://127.0.0.1:7878/api/v3/movie", radarrKey, 15000, {
    method: "POST",
    body,
  });
  if (created?.id) return created;
  const again = await fetchArr("http://127.0.0.1:7878/api/v3/movie", radarrKey);
  const hit = (Array.isArray(again) ? again : []).find((m) => String(m?.tmdbId) === String(tmdb));
  return hit || created;
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
  let wantedSearch = false;
  if (type === "tv" && sonarrKey && tmdb) {
    const n = Number(season);
    const wantSeason = Number.isFinite(n) && n > 0 ? n : null;
    const matchSeries = (s) => String(s?.tmdbId) === String(tmdb);
    let hit = await waitForArrRow({
      fetchArr,
      url: "http://127.0.0.1:8989/api/v3/series",
      key: sonarrKey,
      match: matchSeries,
      tries: waitTries,
      delayMs: waitMs,
    });
    let added = false;
    if (!hit?.id) {
      const created = await addSonarrSeries({ fetchArr, sonarrKey, tmdb });
      added = Boolean(created);
      hit =
        created?.id && matchSeries(created)
          ? created
          : await waitForArrRow({
              fetchArr,
              url: "http://127.0.0.1:8989/api/v3/series",
              key: sonarrKey,
              match: matchSeries,
              tries: waitTries,
              delayMs: waitMs,
            });
    }
    if (hit?.id) {
      seriesId = hit.id;
      if (seasonNeedsMonitor(hit, wantSeason)) {
        const body = seriesWithMonitoredSeason(hit, wantSeason);
        const saved = await fetchArr(`http://127.0.0.1:8989/api/v3/series/${hit.id}`, sonarrKey, 12000, {
          method: "PUT",
          body,
        });
        if (saved) hit = { ...body, ...(saved.id ? saved : {}) };
        else hit = body;
      }
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
        wantedSearch = true;
        grabPath = await ensureTvGrabPath({ fetchArr, sonarrKey, series: hit });
        grabPath.added = added;
        const posted = await fetchArr("http://127.0.0.1:8989/api/v3/command", sonarrKey, 12000, {
          method: "POST",
          body: { name: "SeasonSearch", seriesId: hit.id, seasonNumber: wantSeason },
        });
        searched = commandPosted(posted);
        command = searched ? "SeasonSearch" : null;
      } else if (added) {
        grabPath = { added, clientAdded: false, profileFallback: "ok", profileWidened: false };
      }
    } else {
      grabPath = { added, clientAdded: false, profileFallback: "none", missing: true };
    }
  } else if (type === "movie" && radarrKey && tmdb) {
    const matchMovie = (m) => String(m?.tmdbId) === String(tmdb);
    let hit = await waitForArrRow({
      fetchArr,
      url: "http://127.0.0.1:7878/api/v3/movie",
      key: radarrKey,
      match: matchMovie,
      tries: waitTries,
      delayMs: waitMs,
    });
    let added = false;
    if (!hit?.id) {
      const created = await addRadarrMovie({ fetchArr, radarrKey, tmdb });
      added = Boolean(created);
      hit =
        created?.id && matchMovie(created)
          ? created
          : await waitForArrRow({
              fetchArr,
              url: "http://127.0.0.1:7878/api/v3/movie",
              key: radarrKey,
              match: matchMovie,
              tries: waitTries,
              delayMs: waitMs,
            });
    }
    if (hit?.id) {
      movieId = hit.id;
      if (hit.monitored === false) {
        const saved = await fetchArr(`http://127.0.0.1:7878/api/v3/movie/${hit.id}`, radarrKey, 12000, {
          method: "PUT",
          body: { ...hit, monitored: true },
        });
        if (saved) hit = { ...hit, monitored: true };
      }
      const hasFile = arrHasFile({ titleId: `tmdb-${tmdb}` }, buildArrIndex({ movies: [hit] }));
      const plan = planArrPostRecover({ mediaType: "movie", arrHasFile: hasFile });
      if (plan.search) {
        wantedSearch = true;
        grabPath = await ensureMovieGrabPath({ fetchArr, radarrKey, movie: hit });
        grabPath.added = added;
        const posted = await fetchArr("http://127.0.0.1:7878/api/v3/command", radarrKey, 12000, {
          method: "POST",
          body: { name: "MoviesSearch", movieIds: [hit.id] },
        });
        searched = commandPosted(posted);
        command = searched ? "MoviesSearch" : null;
      } else if (added) {
        grabPath = { added, clientAdded: false, profileFallback: "ok", profileWidened: false };
      }
    } else {
      grabPath = { added, clientAdded: false, profileFallback: "none", missing: true };
    }
  }
  const importSpawned = spawnImport();
  const ok = recoverKickOk({ wantedSearch, searched, command, grabPath });
  return { ok, wantedSearch, seriesId, movieId, searched, command, importSpawned, grabPath };
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
  ttlMs = 30_000,
  force = false,
  libraryFile = LIBRARY_CACHE_FILE,
  fetchArr = arrJson,
} = {}) {
  if (!force && cache.facts && now - cache.at < ttlMs) return cache.facts;
  const entry = readLibraryCacheFile(libraryFile);
  const libraryTitles = entry?.titles || [];
  const radarrKey = arrApiKey("radarr");
  const [movies, series, torrents, radarrClients, radarrQueue, radarrProfiles] = await Promise.all([
    fetchArr("http://127.0.0.1:7878/api/v3/movie", radarrKey, 2500),
    fetchArr("http://127.0.0.1:8989/api/v3/series", arrApiKey("sonarr"), 2500),
    fetchArr("http://127.0.0.1:8282/api/v2/torrents/info", null, 2500),
    radarrKey ? fetchArr("http://127.0.0.1:7878/api/v3/downloadclient", radarrKey, 2500) : Promise.resolve(null),
    radarrKey ? fetchArr("http://127.0.0.1:7878/api/v3/queue", radarrKey, 2500) : Promise.resolve(null),
    radarrKey ? fetchArr("http://127.0.0.1:7878/api/v3/qualityprofile", radarrKey, 2500) : Promise.resolve(null),
  ]);
  const movieRows = Array.isArray(movies) ? movies : [];
  const seriesRows = Array.isArray(series) ? series : [];
  const torrentRows = Array.isArray(torrents) ? torrents : [];
  const queueRows = Array.isArray(radarrQueue)
    ? radarrQueue
    : Array.isArray(radarrQueue?.records)
      ? radarrQueue.records
      : [];
  const facts = {
    libraryTitles,
    movies: movieRows,
    series: seriesRows,
    torrents: torrentRows,
    radarrQueue: queueRows,
    radarrProfiles: Array.isArray(radarrProfiles) ? radarrProfiles : [],
    radarrClients: Array.isArray(radarrClients) ? radarrClients : radarrClients == null ? null : [],
    arrReady: Array.isArray(movies) || Array.isArray(series),
    arrMoviesReady: Array.isArray(movies),
    arrSeriesReady: Array.isArray(series),
    arrIndex: buildArrIndex({
      movies: movieRows,
      series: seriesRows,
    }),
    dumps: {
      sonarr: listDirNames("/mnt/symlinks/sonarr"),
      radarr: listDirNames("/mnt/symlinks/radarr"),
    },
    catalog: [],
  };
  cache = { at: now, facts };
  return facts;
}

export function listDirNames(dir) {
  try {
    const out = spawnSync("ls", ["-1", dir], { encoding: "utf8", timeout: 800 });
    if (out.status !== 0) return [];
    return String(out.stdout || "")
      .split("\n")
      .map((line) => line.trim())
      .filter((n) => n && !n.startsWith("."));
  } catch {
    return [];
  }
}
