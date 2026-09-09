import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const HOME_SHELF_LIMIT = 24;
export const LIBRARY_CACHE_TTL_MS = 30_000;
export const JELLYFIN_TOKEN_TTL_MS = 10 * 60_000;
export const JELLYFIN_ITEMS_TIMEOUT_MS = 12_000;
export const LIBRARY_CACHE_FILE = "/var/lib/reelos/library-shelf.json";

export function parseLibraryLimit(raw) {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.floor(n), 2000);
}

export function libraryItemsUrl({ limit } = {}) {
  const q = new URLSearchParams({
    Recursive: "true",
    IncludeItemTypes: "Movie,Series",
    Fields: "ProviderIds",
    ImageTypeLimit: "1",
    EnableImages: "false",
    EnableUserData: "false",
    EnableTotalRecordCount: "false",
    SortBy: "DateCreated",
    SortOrder: "Descending",
  });
  if (limit) q.set("Limit", String(limit));
  return `http://127.0.0.1:8096/Items?${q}`;
}

export function jellyfinPosterUrl(host, jellyfinId) {
  if (!jellyfinId) return "";
  return `http://${host}:8096/Items/${jellyfinId}/Images/Primary`;
}

export function mapJellyfinItem(it, host) {
  const tmdb = it.ProviderIds?.Tmdb;
  const tvdb = it.ProviderIds?.Tvdb;
  const kind = it.Type === "Series" ? "tv" : "movie";
  const ids = [
    tmdb ? `tmdb-${tmdb}` : "",
    tvdb ? `tvdb-${tvdb}` : "",
    it.Id ? `jf-${it.Id}` : "",
  ].filter(Boolean);
  const id =
    kind === "tv" ? (tvdb ? `tvdb-${tvdb}` : ids[0]) : tmdb ? `tmdb-${tmdb}` : ids[0];
  return {
    id,
    ids,
    kind,
    title: String(it.Name || "Untitled"),
    year: Number(it.ProductionYear) || 0,
    overview: "",
    poster: jellyfinPosterUrl(host, it.Id),
    jellyfinId: it.Id,
    maxQuality: "4k",
    popularity: 50,
    genres: [],
  };
}

export function withPosterHost(titles, host) {
  return (titles || []).map((t) => ({
    ...t,
    poster: t.jellyfinId ? jellyfinPosterUrl(host, t.jellyfinId) : t.poster,
  }));
}

export function applyLibraryLimit(titles, limit) {
  if (!limit) return titles;
  return titles.slice(0, limit);
}

export function mergeShelf(prev, next, limited) {
  if (!limited) return next;
  if (!prev?.length) return next;
  const have = new Set(next.map((t) => t.id));
  return [...next, ...prev.filter((t) => !have.has(t.id))];
}

export function cacheIsFresh(entry, now, ttlMs = LIBRARY_CACHE_TTL_MS) {
  return Boolean(entry?.titles) && now - Number(entry.at || 0) < ttlMs;
}

export function canServeStale(entry) {
  return Array.isArray(entry?.titles) && entry.titles.length > 0;
}

export function createTokenCache({ ttlMs = JELLYFIN_TOKEN_TTL_MS, now = () => Date.now() } = {}) {
  let hit = null;
  return {
    get(user, password) {
      if (!hit) return null;
      if (hit.user !== user || hit.password !== password) return null;
      if (now() - hit.at >= ttlMs) {
        hit = null;
        return null;
      }
      return { token: hit.token, id: hit.id };
    },
    set(user, password, auth) {
      if (!auth?.token) return;
      hit = { user, password, token: auth.token, id: auth.id, at: now() };
    },
    clear() {
      hit = null;
    },
  };
}

export function createLibraryCache({ ttlMs = LIBRARY_CACHE_TTL_MS } = {}) {
  let mem = null;
  return {
    read() {
      return mem;
    },
    write(titles, { now = Date.now(), complete = true } = {}) {
      mem = { at: now, complete, titles };
      return mem;
    },
    isFresh(now = Date.now()) {
      return cacheIsFresh(mem, now, ttlMs);
    },
  };
}

export function readLibraryCacheFile(file, { readFileSync: read = readFileSync } = {}) {
  try {
    const j = JSON.parse(read(file, "utf8"));
    if (!Array.isArray(j?.titles)) return null;
    return { at: Number(j.at) || 0, complete: j.complete !== false, titles: j.titles };
  } catch {
    return null;
  }
}

export function writeLibraryCacheFile(
  file,
  entry,
  { mkdirSync: mkdir = mkdirSync, writeFileSync: write = writeFileSync } = {},
) {
  mkdir(dirname(file), { recursive: true });
  write(file, JSON.stringify(entry) + "\n");
}

export async function serveLibrary({
  url,
  host,
  now = Date.now(),
  ttlMs = LIBRARY_CACHE_TTL_MS,
  cache,
  getAuth,
  fetchItems,
  refresh,
}) {
  const u = new URL(url, "http://reelos.local");
  const limit = parseLibraryLimit(u.searchParams.get("limit"));
  const wantFresh = u.searchParams.get("fresh") === "1";
  const stale = cache.read();

  const serve = (titles, extra = {}) => ({
    titles: withPosterHost(applyLibraryLimit(titles, limit), host),
    error: extra.error ?? null,
    fromCache: Boolean(extra.fromCache),
  });

  const staleCoversRequest = canServeStale(stale) && (stale.complete || limit);
  if (!wantFresh && staleCoversRequest) {
    if ((!stale.complete || !cacheIsFresh(stale, now, ttlMs)) && typeof refresh === "function") {
      void refresh();
    }
    return serve(stale.titles, { fromCache: true });
  }

  // Home may have cached a Limit=24 slice; Library waits on the in-flight full refresh.
  if (!wantFresh && canServeStale(stale) && !stale.complete && !limit && typeof refresh === "function") {
    await refresh();
    const next = cache.read();
    if (canServeStale(next) && next.complete) return serve(next.titles, { fromCache: true });
  }

  const auth = await getAuth();
  if (!auth?.token) {
    if (canServeStale(stale)) {
      return serve(stale.titles, { fromCache: true, error: "Jellyfin has no matching user/PIN" });
    }
    return { titles: [], error: "Jellyfin has no matching user/PIN", fromCache: false };
  }

  try {
    const data = await fetchItems(auth, limit);
    const items = Array.isArray(data?.Items) ? data.Items : [];
    const titles = items.map((it) => mapJellyfinItem(it, host));
    cache.write(titles, { now, complete: !limit });
    if (limit && typeof refresh === "function") void refresh();
    return serve(titles);
  } catch (e) {
    if (canServeStale(stale)) return serve(stale.titles, { fromCache: true, error: String(e) });
    return { titles: [], error: String(e), fromCache: false };
  }
}
