/** Load Jellyfin shelf + *arr hasFile facts for honest GET /api/request. */
import { existsSync, readFileSync } from "node:fs";
import { LIBRARY_CACHE_FILE, readLibraryCacheFile } from "./reelos-library.mjs";
import { buildArrIndex } from "./reelos-seerr.mjs";

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

async function arrJson(url, key, ms = 10000) {
  if (!key) return null;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: { "X-Api-Key": key, Accept: "application/json" },
      signal: ac.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
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
  const [movies, series] = await Promise.all([
    fetchArr("http://127.0.0.1:7878/api/v3/movie", arrApiKey("radarr")),
    fetchArr("http://127.0.0.1:8989/api/v3/series", arrApiKey("sonarr")),
  ]);
  const facts = {
    libraryTitles,
    arrIndex: buildArrIndex({
      movies: Array.isArray(movies) ? movies : [],
      series: Array.isArray(series) ? series : [],
    }),
  };
  cache = { at: now, facts };
  return facts;
}
