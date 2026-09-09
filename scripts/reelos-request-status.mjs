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

/** After a TV POST: search if the season has no files. Always relink+ManualImport (dump may appear). */
export function planTvPostRecover({ mediaType, season, arrHasSeasonFile = false } = {}) {
  if (mediaType !== "tv") return { search: false, import: false };
  return { search: !arrHasSeasonFile && season != null, import: true };
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

export async function kickTvSeasonRecover({
  tmdb,
  season,
  fetchArr = arrJson,
  spawnImport = spawnWireImport,
  sonarrKey = arrApiKey("sonarr"),
} = {}) {
  const key = sonarrKey;
  const n = Number(season);
  const wantSeason = Number.isFinite(n) && n > 0 ? n : null;
  let seriesId = null;
  let searched = false;
  if (key && tmdb) {
    const series = await fetchArr("http://127.0.0.1:8989/api/v3/series", key);
    const rows = Array.isArray(series) ? series : [];
    const hit = rows.find((s) => String(s?.tmdbId) === String(tmdb));
    if (hit?.id) {
      seriesId = hit.id;
      const titleId = `tmdb-tv-${tmdb}`;
      const hasFile = arrHasFile(
        { titleId, season: wantSeason },
        buildArrIndex({ series: rows }),
      );
      const plan = planTvPostRecover({
        mediaType: "tv",
        season: wantSeason,
        arrHasSeasonFile: hasFile,
      });
      if (plan.search) {
        await fetchArr("http://127.0.0.1:8989/api/v3/command", key, 12000, {
          method: "POST",
          body: { name: "SeasonSearch", seriesId: hit.id, seasonNumber: wantSeason },
        });
        searched = true;
      }
    }
  }
  const importSpawned = spawnImport();
  return { ok: true, seriesId, searched, importSpawned };
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
