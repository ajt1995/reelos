import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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
    Fields: "Path,ProviderIds",
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

/** Infohash / dump-folder names Jellyfin copies when a pack has no title. */
export const UNKNOWN_ON_BOX = "Unknown on this box";

export function looksLikeHashTitle(name) {
  return /^[0-9a-f]{32,64}$/i.test(String(name || "").trim());
}

const QUALITY_CUT = /[\s._-]+(?:\d{3,4}p|2160p|1080p|720p|480p|4k|uhd|web-?dl|webrip|bluray|b[dr]rip|hdtv|hdrip|hdr10|dolby|vision|ddp?5\.?1|atmos|truehd|dts|x26[45]|h\.?26[45]|hevc|avc|aac|proper|repack|internal|multi|complete|h264|h265)\b/i;

/** "Rick And Morty S04E01 … 720p BluRay.mp4" → Rick And Morty. Never ffprobe. */
export function humanTitleFromSceneName(raw) {
  let s = String(raw || "").trim();
  s = s.replace(/\.[a-z0-9]{2,4}$/i, "");
  while (true) {
    const stripped = s.replace(/^\[+[^\]]+\]+\s*/, "").trim();
    if (stripped === s) break;
    s = stripped;
  }
  s = s.replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s || looksLikeHashTitle(s)) return { title: "", year: 0 };
  const yearHit = s.match(/\b((?:19|20)\d{2})\b/);
  const year = yearHit ? Number(yearHit[1]) : 0;
  s = s.split(QUALITY_CUT)[0].trim();
  s = s.replace(/\s*[Ss]\d{1,2}\s*[.\-_ ]?\s*[Ee]\d{1,3}\b.*$/, "").trim();
  s = s.replace(/\s+season\s+\d{1,2}\b.*$/i, "").trim();
  s = s.replace(/\s+[Ss]\d{1,2}(?!\d)(?![eE]\d).*$/, "").trim();
  s = s.replace(/\s+\(?((?:19|20)\d{2})\)?\s*$/, "").trim();
  s = s.replace(/^[-_\s]+|[-_\s]+$/g, "").trim();
  if (!s || looksLikeHashTitle(s) || /^s\d{1,2}e\d{1,3}$/i.test(s)) return { title: "", year: 0 };
  return { title: s, year };
}

export function identifyLibraryTitle({ name, path, files = [] } = {}) {
  const jfName = String(name || "").trim();
  const tryParse = (raw) => {
    const parsed = humanTitleFromSceneName(raw);
    if (parsed.title && !looksLikeHashTitle(parsed.title)) return parsed;
    return null;
  };
  if (!looksLikeHashTitle(jfName)) {
    const fromName = tryParse(jfName);
    if (fromName) return fromName;
    if (jfName && jfName !== "Untitled") return { title: stripMatchingYear(jfName, 0), year: 0 };
  }
  const base = String(path || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .pop() || "";
  const fromPath = tryParse(base);
  if (fromPath) return fromPath;
  for (const f of files || []) {
    const fromFile = tryParse(f);
    if (fromFile) return fromFile;
  }
  if (looksLikeHashTitle(jfName) || looksLikeHashTitle(base) || !jfName) {
    return { title: UNKNOWN_ON_BOX, year: 0 };
  }
  return { title: jfName, year: 0 };
}

/** Container `/symlinks/…` is host `/mnt/symlinks/…`. Never list FUSE `/mnt/debrid`. */
export function hostPathFromJellyfin(path) {
  const p = String(path || "")
    .replace(/\\/g, "/")
    .trim();
  if (!p) return "";
  if (p === "/mnt/debrid" || p.startsWith("/mnt/debrid/")) return "";
  if (p.startsWith("/symlinks/")) return `/mnt${p}`;
  return p;
}

export function dumpSearchPaths(jfPath, name) {
  const out = [];
  const host = hostPathFromJellyfin(jfPath);
  if (host) out.push(host);
  if (looksLikeHashTitle(name)) {
    out.push(`/mnt/symlinks/sonarr/${name}`, `/mnt/symlinks/radarr/${name}`);
  }
  return [...new Set(out)];
}

export function listDumpNames(hostPath, { readdirSync: readDir = readdirSync } = {}) {
  const p = String(hostPath || "");
  if (!p || p === "/mnt/debrid" || p.startsWith("/mnt/debrid/")) return [];
  try {
    const names = readDir(p);
    return Array.isArray(names) ? names.map(String).slice(0, 48) : [];
  } catch {
    return [];
  }
}

export function repairHashTitles(titles, { listFiles } = {}) {
  const list =
    listFiles ||
    ((t) => {
      for (const p of dumpSearchPaths(t?.path, t?.title)) {
        const names = listDumpNames(p);
        if (names.length) return names;
      }
      return [];
    });
  return (titles || []).map((t) => {
    if (!t || !looksLikeHashTitle(t.title)) return t;
    const files = list(t) || [];
    const ided = identifyLibraryTitle({ name: t.title, path: t.path, files });
    return { ...t, title: ided.title, year: t.year || ided.year || 0, fromHashDump: true };
  });
}

export function mapJellyfinItems(items, host, { listFiles } = {}) {
  return (items || []).map((it) => {
    const t = mapJellyfinItem(it, host);
    if (!looksLikeHashTitle(it?.Name) && !looksLikeHashTitle(t.title)) return t;
    const files =
      typeof listFiles === "function"
        ? listFiles(it) || []
        : dumpSearchPaths(it?.Path, it?.Name).flatMap((p) => listDumpNames(p));
    const ided = identifyLibraryTitle({ name: it?.Name, path: it?.Path, files });
    return { ...t, title: ided.title, year: t.year || ided.year || 0, fromHashDump: true };
  });
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

/** Hash dumps named "The EXPANSE Complete" / "Complete 2020" are the series, not a remake. */
export function stripCompletePackSuffix(title) {
  const raw = String(title || "").trim();
  const stripped = raw
    .replace(/[\s._:-]+complete(?:[\s._:-]+(?:series|collection|pack|set))?(?:[\s._:-]+\(?\d{4}\)?)?$/i, "")
    .trim();
  return stripped || raw;
}

export function looksLikeSeasonFolderTitle(title) {
  const raw = String(title || "").trim();
  return Boolean(raw) && stripSeasonFolderSuffix(raw) !== raw;
}

export function looksLikeCompletePackTitle(title) {
  const raw = String(title || "").trim();
  return Boolean(raw) && stripCompletePackSuffix(raw) !== raw;
}

function normalizeTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function shelfTitleKey(t) {
  const name =
    t?.kind === "tv" || t?.kind === "anime"
      ? stripCompletePackSuffix(stripSeasonFolderSuffix(t?.title))
      : stripSeasonFolderSuffix(t?.title);
  return `${t?.kind || "movie"}:${normalizeTitle(name)}`;
}

/** The name as Jellyfin has it, season suffix intact. */
export function shelfLiteralKey(t) {
  return `${t?.kind || "movie"}:${normalizeTitle(t?.title)}`;
}

export function titleProviderId(t) {
  const ids = Array.isArray(t?.ids) ? t.ids : [];
  return String(ids.find((i) => /^tmdb-|^tvdb-/.test(String(i))) || "");
}

export function catalogIdsOf(t) {
  return [t?.id, ...(Array.isArray(t?.ids) ? t.ids : [])].map(String).filter((id) => /^(tmdb-|tvdb-)/.test(id));
}

/** Leftover dump jf-* in the removed list must not hide the real titled series. */
export function libraryRowHidden(t, hide) {
  const set = hide instanceof Set ? hide : new Set(hide || []);
  if (!set.size) return false;
  const catalog = catalogIdsOf(t);
  if (catalog.length) return catalog.some((id) => set.has(id));
  const ids = [t?.id, ...(Array.isArray(t?.ids) ? t.ids : []), t?.jellyfinId, t?.jellyfinId ? `jf-${t.jellyfinId}` : ""];
  return ids.some((id) => id && set.has(String(id)));
}

export function titleYear(t) {
  return Number(t?.year) || 0;
}

/** Season-folder PremiereDate (TWD S01 → 2011) is not a remake of the series (2010). */
export function isSeasonFolderAlias(a, b) {
  if (!a || !b) return false;
  if (shelfLiteralKey(a) === shelfLiteralKey(b)) return false;
  return (
    looksLikeSeasonFolderTitle(a.title) ||
    looksLikeSeasonFolderTitle(b.title) ||
    looksLikeCompletePackTitle(a.title) ||
    looksLikeCompletePackTitle(b.title)
  );
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
      (looksLikeSeasonFolderTitle(slot.best?.title) || looksLikeCompletePackTitle(slot.best?.title)) &&
      !looksLikeSeasonFolderTitle(t?.title) &&
      !looksLikeCompletePackTitle(t?.title);
    const mergeRow = (keep, drop) => {
      const ids = [
        ...new Set(
          [
            ...(keep.ids || []),
            ...(drop.ids || []),
            keep.id,
            drop.id,
            keep.jellyfinId,
            drop.jellyfinId,
            keep.jellyfinId ? `jf-${keep.jellyfinId}` : "",
            drop.jellyfinId ? `jf-${drop.jellyfinId}` : "",
          ]
            .filter(Boolean)
            .map(String),
        ),
      ];
      return { ...keep, ids };
    };
    const mergeAliases = Boolean(t.fromHashDump || slot.best.fromHashDump);
    if (betterScore || preferSeriesName) {
      slot.best = mergeAliases ? mergeRow(t, slot.best) : t;
      if (year) slot.year = year;
    } else {
      slot.best = mergeAliases ? mergeRow(slot.best, t) : slot.best;
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
        titles: mem.titles.filter((t) => !libraryRowHidden(t, hide)),
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
      return !libraryRowHidden(t, hide);
    });
  };

  const serve = (titles, extra = {}) => ({
    titles: withPosterHost(
      applyLibraryLimit(dedupeLibraryTitles(repairHashTitles(withoutRemoved(titles))), limit),
      host,
    ),
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
    const titles = dedupeLibraryTitles(mapJellyfinItems(items, host));
    cache.write(titles, { now, complete: !limit });
    if (limit && typeof refresh === "function") void refresh();
    return serve(titles);
  } catch (e) {
    if (canServeStale(stale)) return serve(stale.titles, { fromCache: true, error: String(e) });
    return { titles: [], error: String(e), fromCache: false };
  }
}
