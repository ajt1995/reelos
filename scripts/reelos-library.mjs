import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const HOME_SHELF_LIMIT = 24;
export const LIBRARY_CACHE_TTL_MS = 120_000;
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

export function jellyfinPosterUrl(_host, jellyfinId, { maxWidth = 240 } = {}) {
  if (!jellyfinId) return "";
  const id = encodeURIComponent(String(jellyfinId));
  const w = Number(maxWidth) > 0 ? Math.min(Math.floor(Number(maxWidth)), 720) : 240;
  return `/api/jf/Items/${id}/Images/Primary?maxWidth=${w}&quality=70`;
}

export function stripMatchingYear(name, year) {
  const raw = String(name || "").trim();
  const y = Number(year) || 0;
  if (!y) return raw;
  const stripped = raw.replace(new RegExp(`\\s+\\(${y}\\)\\s*$`), "").trim();
  return stripped || raw;
}

export function mapJellyfinItem(it, host) {
  const tmdb = it.ProviderIds?.Tmdb;
  const tvdb = it.ProviderIds?.Tvdb;
  const kind = it.Type === "Series" ? "tv" : "movie";
  const ids = [
    tmdb ? `tmdb-${tmdb}` : "",
    tmdb && kind === "tv" ? `tmdb-tv-${tmdb}` : "",
    tvdb ? `tvdb-${tvdb}` : "",
    it.Id ? `jf-${it.Id}` : "",
  ].filter(Boolean);
  const id =
    kind === "tv" ? (tvdb ? `tvdb-${tvdb}` : ids[0]) : tmdb ? `tmdb-${tmdb}` : ids[0];
  const year = Number(it.ProductionYear) || 0;
  return {
    id,
    ids,
    kind,
    title: stripMatchingYear(it.Name || "Untitled", year),
    year,
    overview: "",
    poster: jellyfinPosterUrl(host, it.Id),
    jellyfinId: it.Id,
    maxQuality: "4k",
    popularity: 50,
    genres: [],
  };
}

/** JF season-folder names are the same show: "B99 S01", "TWD - Season 1". */
export function stripSeasonFolderSuffix(title) {
  const raw = String(title || "").trim();
  // "- Season 1" is a bare season folder, not a suffix: stripping it to "" would
  // give every such dump the same shelf key and collapse unrelated shows.
  // Quality after S01 (`Season 1 S01 (1080p AMZN…)`) is still a season dump.
  const stripped = raw
    .replace(
      /[\s._:-]+(?:(?:season|series)[\s._:-]*\d{1,2}(?:[\s._:-]+s\d{1,2})?|s\d{1,2}(?!\d)(?![eE]\d))(?![eE]\d).*$/i,
      "",
    )
    .trim();
  if (!stripped || stripped === raw) return raw;
  return stripped.replace(/\s+\((?:19|20)\d{2}\)\s*$/, "").trim() || stripped;
}

export function looksLikeSeasonFolderTitle(title) {
  const raw = String(title || "").trim();
  return Boolean(raw) && stripSeasonFolderSuffix(raw) !== raw;
}

function normalizeTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function shelfTitleKey(t) {
  return `${t?.kind || "movie"}:${normalizeTitle(stripSeasonFolderSuffix(t?.title))}`;
}

/** The name as Jellyfin has it, season suffix intact. */
export function shelfLiteralKey(t) {
  return `${t?.kind || "movie"}:${normalizeTitle(t?.title)}`;
}

export function titleProviderId(t) {
  const ids = Array.isArray(t?.ids) ? t.ids : [];
  return String(ids.find((i) => /^tmdb-|^tvdb-/.test(String(i))) || "");
}

export function titleYear(t) {
  return Number(t?.year) || 0;
}

/** Season-folder PremiereDate (TWD S01 → 2011) is not a remake of the series (2010). */
export function isSeasonFolderAlias(a, b) {
  if (!a || !b) return false;
  if (shelfLiteralKey(a) === shelfLiteralKey(b)) return false;
  return looksLikeSeasonFolderTitle(a.title) || looksLikeSeasonFolderTitle(b.title);
}

export function yearsCompatible(slotYear, year, best, incoming) {
  if (!slotYear || !year || slotYear === year) return true;
  return isSeasonFolderAlias(best, incoming);
}

/** One dump scanned twice repeats the year; a remake does not. Dune 1984 is not Dune 2021. */
export function dedupeLibraryTitles(titles) {
  const score = (x) => {
    const ids = Array.isArray(x?.ids) ? x.ids : [];
    const hasId = ids.some((i) => /^tmdb-|^tvdb-/.test(String(i)));
    return (x?.poster ? 2 : 0) + (hasId ? 4 : 0) + (x?.jellyfinId ? 1 : 0);
  };
  const groups = new Map();
  for (const t of titles || []) {
    if (!t) continue;
    const key = shelfTitleKey(t);
    const year = titleYear(t);
    const bucket = groups.get(key);
    if (!bucket) {
      groups.set(key, [{ best: t, year }]);
      continue;
    }
    // A season folder Jellyfin never matched carries no tmdb/tvdb id. Two rows that
    // differ by a season suffix and both carry a *different* id are two real series
    // (anime split seasons), so they must not share a row.
    const aliasSafe = (s) => {
      if (shelfLiteralKey(s.best) === shelfLiteralKey(t)) return true;
      const a = titleProviderId(s.best);
      const b = titleProviderId(t);
      return !a || !b || a === b;
    };
    // An exact-year slot wins first: with two remakes on the shelf, a season folder must
    // land on the one it shares a year with, not on whichever remake was scanned first.
    const slot =
      bucket.find((s) => (!s.year || !year || s.year === year) && aliasSafe(s)) ||
      bucket.find((s) => yearsCompatible(s.year, year, s.best, t) && aliasSafe(s));
    if (!slot) {
      bucket.push({ best: t, year });
      continue;
    }
    // A copy Jellyfin never matched has year 0. Keep the resolved year so the
    // next unmatched copy still collapses and a real remake still does not.
    // Prefer the id'd / series-named row's year when a season folder disagrees.
    const betterScore = score(t) > score(slot.best);
    const preferSeriesName =
      score(t) === score(slot.best) &&
      looksLikeSeasonFolderTitle(slot.best?.title) &&
      !looksLikeSeasonFolderTitle(t?.title);
    if (betterScore || preferSeriesName) {
      slot.best = t;
      if (year) slot.year = year;
    } else {
      slot.year = slot.year || year;
    }
  }
  return [...groups.values()]
    .flat()
    .map((s) => (s.year && !titleYear(s.best) ? { ...s.best, year: s.year } : s.best));
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
  return dedupeLibraryTitles([...next, ...prev.filter((t) => !have.has(t.id))]);
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
    drop(keys, { now = Date.now() } = {}) {
      if (!mem?.titles) return mem;
      const hide = keys instanceof Set ? keys : new Set(keys || []);
      mem = {
        at: now,
        complete: mem.complete,
        titles: mem.titles.filter((t) => {
          const ids = [t?.id, ...(Array.isArray(t?.ids) ? t.ids : []), t?.jellyfinId, t?.jellyfinId ? `jf-${t.jellyfinId}` : ""];
          return !ids.some((id) => id && hide.has(String(id)));
        }),
      };
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
  removedIds = [],
}) {
  const u = new URL(url, "http://reelos.local");
  const limit = parseLibraryLimit(u.searchParams.get("limit"));
  const wantFresh = u.searchParams.get("fresh") === "1";
  const stale = cache.read();
  const hide = new Set((removedIds || []).map((id) => String(id)).filter(Boolean));
  const withoutRemoved = (titles) => {
    if (!hide.size) return titles || [];
    return (titles || []).filter((t) => {
      const ids = [t?.id, ...(Array.isArray(t?.ids) ? t.ids : []), t?.jellyfinId, t?.jellyfinId ? `jf-${t.jellyfinId}` : ""];
      return !ids.some((id) => id && hide.has(String(id)));
    });
  };

  const serve = (titles, extra = {}) => ({
    titles: withPosterHost(applyLibraryLimit(dedupeLibraryTitles(withoutRemoved(titles)), limit), host),
    error: extra.error ?? null,
    fromCache: Boolean(extra.fromCache),
  });

  const staleCoversRequest = canServeStale(stale);
  if (!wantFresh && staleCoversRequest) {
    if ((!stale.complete || !cacheIsFresh(stale, now, ttlMs)) && typeof refresh === "function") {
      void refresh();
    }
    return serve(stale.titles, { fromCache: true });
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
    const titles = dedupeLibraryTitles(items.map((it) => mapJellyfinItem(it, host)));
    cache.write(titles, { now, complete: !limit });
    if (limit && typeof refresh === "function") void refresh();
    return serve(titles);
  } catch (e) {
    if (canServeStale(stale)) return serve(stale.titles, { fromCache: true, error: String(e) });
    return { titles: [], error: String(e), fromCache: false };
  }
}
