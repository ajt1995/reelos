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
    Fields: "Path,ProviderIds,ImageTags",
    ImageTypeLimit: "1",
    EnableImages: "true",
    EnableUserData: "false",
    EnableTotalRecordCount: "false",
    SortBy: "DateCreated",
    SortOrder: "Descending",
  });
  if (limit) q.set("Limit", String(limit));
  return `http://127.0.0.1:8096/Items?${q}`;
}

export function jellyfinResumeUrl(userId, { limit = 24 } = {}) {
  const id = String(userId || "").trim();
  if (!id) return "";
  const q = new URLSearchParams({
    IncludeItemTypes: "Movie,Episode",
    Fields: "ProviderIds,ImageTags",
    EnableUserData: "true",
    EnableImages: "true",
    ImageTypeLimit: "1",
    Limit: String(limit || 24),
  });
  return `http://127.0.0.1:8096/Users/${encodeURIComponent(id)}/Items/Resume?${q}`;
}

/** PlaybackPositionTicks / RunTimeTicks. 0 when Jellyfin has no runtime. */
export function resumeProgress(it) {
  const pos = Number(it?.UserData?.PlaybackPositionTicks) || 0;
  const runtime = Number(it?.RunTimeTicks) || 0;
  if (!(pos > 0) || !(runtime > 0)) return 0;
  return pos / runtime;
}

function libraryTitleForJellyfinId(titles, jellyfinId) {
  const id = String(jellyfinId || "").trim();
  if (!id) return null;
  return (titles || []).find((t) => String(t?.jellyfinId || "") === id) || null;
}

/** Map JF Resume movies/episodes onto Home titles. Episodes become the series. */
export function mapResumeItems(items, { host, libraryTitles = [] } = {}) {
  const out = [];
  const seen = new Set();
  for (const it of items || []) {
    const progress = resumeProgress(it);
    if (progress <= 0.03 || progress >= 0.96) continue;
    const episode = String(it?.Type || "") === "Episode";
    const seriesId = episode ? it.SeriesId || it.ParentId : "";
    const jfId = episode ? seriesId || it.Id : it.Id;
    let title = libraryTitleForJellyfinId(libraryTitles, jfId);
    if (!title) {
      const imageTag = episode ? it.SeriesPrimaryImageTag : it.ImageTags?.Primary;
      title = mapJellyfinItem(
        {
          Id: jfId || it.Id,
          Name: episode ? it.SeriesName || it.Name : it.Name,
          Type: episode ? "Series" : it.Type || "Movie",
          ProductionYear: it.ProductionYear,
          ProviderIds: (episode ? it.SeriesProviderIds : null) || it.ProviderIds || {},
          ImageTags: imageTag ? { Primary: imageTag } : it.ImageTags || {},
          Path: it.Path,
        },
        host,
      );
    }
    if (!title?.id || seen.has(title.id)) continue;
    seen.add(title.id);
    out.push({ ...title, progress });
    if (out.length >= 24) break;
  }
  return out;
}

export function jellyfinHasPrimaryImage(it) {
  const tags = it?.ImageTags;
  if (tags && typeof tags === "object") return Boolean(tags.Primary);
  if (it?.ImageTag) return true;
  return false;
}

export function hashDumpIds(name, path) {
  const ids = [];
  const add = (raw) => {
    const s = String(raw || "").trim();
    if (looksLikeHashTitle(s)) ids.push(s.toLowerCase());
  };
  add(name);
  const base = String(path || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .pop();
  add(base);
  return [...new Set(ids)];
}

export function seasonsFromDumpNames(files = []) {
  const out = new Set();
  for (const f of files || []) {
    const s = String(f);
    const ep = /(?:^|[^a-z0-9])[Ss](\d{1,2})[Ee]\d{1,3}(?:[^a-z0-9]|$)/.exec(s);
    if (ep) out.add(Number(ep[1]));
    const folder = /(?:^|\/)(?:Season[\s._-]*|S)(\d{1,2})(?:\/|$)/i.exec(s);
    if (folder) out.add(Number(folder[1]));
  }
  return [...out].filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
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

const INDEXER_HOST =
  /(?:uindex|torrenting|torrentcouch|eztvx?|1337x|bitsearch|rarbg|yts|tpb|limetorrents|nyaa)/i;

const TLD = "org|com|net|to|tv|cc|me|info|xyz";

/** "www.UIndex.org - The Rookie" / "org - Silo" / "[TorrentCouch.com] Show" → the show name. */
export function stripIndexerPrefix(raw) {
  let s = String(raw || "").trim();
  while (true) {
    const stripped = s.replace(/^\[+[^\]]+\]+\s*/, "").trim();
    if (stripped === s) break;
    s = stripped;
  }
  s = s.replace(/\s*\[+\s*[^\]]+\]+\s*$/g, "").trim();
  if (INDEXER_HOST.test(s)) {
    s = s.replace(new RegExp(`^(?:www\\.)?[a-z0-9.-]+\\.(?:${TLD})\\s*[-–—:.]+\\s*`, "i"), "").trim();
  }
  s = s.replace(/^www\.[a-z0-9.-]+\s*[-–—:]+\s*/i, "").trim();
  s = s.replace(new RegExp(`^www[\\s._-]+[a-z0-9]+[\\s._-]+(?:${TLD})\\b[\\s._:-]*`, "i"), "").trim();
  s = s.replace(new RegExp(`^(?:${TLD})\\s*[-–—:]+\\s+`, "i"), "").trim();
  // Truncated Home paint: "org-Silo" / "org - Silo"
  s = s.replace(new RegExp(`^(?:${TLD})[-–—:]+(?=[A-Za-z0-9])`, "i"), "").trim();
  s = s.replace(/^[-_\s]+/, "").trim();
  return s || String(raw || "").trim();
}

export function looksLikeIndexerDump(name) {
  const s = String(name || "").trim();
  if (!s) return false;
  if (/^www[\s._-]/i.test(s) || /^www\./i.test(s)) return true;
  if (new RegExp(`^(?:${TLD})\\s*[-–—:]+\\s*\\S`, "i").test(s)) return true;
  if (INDEXER_HOST.test(s) && (/[-.]/.test(s) || /^\[[^\]]+\]/.test(s) || /\[[^\]]+\]\s*$/.test(s))) return true;
  const stripped = stripIndexerPrefix(s);
  return Boolean(stripped) && stripped !== s;
}

const QUALITY_CUT = /[\s._-]+(?:\d{3,4}p|2160p|1080p|720p|480p|4k|uhd|web-?dl|webrip|bluray|b[dr]rip|hdtv|hdrip|hdr10|dolby|vision|ddp?5\.?1|atmos|truehd|dts|x26[45]|h\.?26[45]|hevc|avc|aac|proper|repack|internal|multi|complete|h264|h265)\b/i;

/** "Rick And Morty S04E01 … 720p BluRay.mp4" → Rick And Morty. Never ffprobe. */
export function humanTitleFromSceneName(raw) {
  let s = String(raw || "").trim();
  s = s.replace(/\.[a-z0-9]{2,4}$/i, "");
  s = stripIndexerPrefix(s);
  s = s.replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
  s = stripIndexerPrefix(s);
  if (!s || looksLikeHashTitle(s)) return { title: "", year: 0 };
  const yearHit = s.match(/\b((?:19|20)\d{2})\b/);
  const year = yearHit ? Number(yearHit[1]) : 0;
  s = s.split(QUALITY_CUT)[0].trim();
  s = s.replace(/^(?:[Ss]\d{1,2}\s*[Ee]\d{1,3})\s+/, "").trim();
  s = s.replace(/\s*[Ss]\d{1,2}\s*[.\-_ ]?\s*[Ee]\d{1,3}\b.*$/, "").trim();
  s = s.replace(/\s+season\s+\d{1,2}\b.*$/i, "").trim();
  s = s.replace(/\s+[Ss]\d{1,2}(?!\d)(?![eE]\d).*$/, "").trim();
  s = s.replace(/\s+\(?((?:19|20)\d{2})\)?\s*$/, "").trim();
  // "Reacher II Ponte" is S02 + scene group, not a second named title.
  s = s.replace(/\s+(?:II|III|IV|VI|VII|VIII|IX)\s+[A-Za-z][A-Za-z0-9]{1,14}$/i, "").trim();
  s = s.replace(/\s+-[A-Z][A-Za-z0-9]{2,14}$/g, "").trim();
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
    if (!t || !(looksLikeHashTitle(t.title) || looksLikeIndexerDump(t.title))) return t;
    const files = list(t) || [];
    const ided = identifyLibraryTitle({ name: t.title, path: t.path, files });
    const hashes = hashDumpIds(t.title, t.path);
    const disk = seasonsFromDumpNames(files);
    return {
      ...t,
      title: ided.title,
      year: t.year || ided.year || 0,
      fromHashDump: true,
      fromDump: namedCatalogTitle(t) ? false : true,
      ids: [...new Set([...(t.ids || []), ...hashes])],
      importingSeasons: [...new Set([...(t.importingSeasons || []), ...disk])].sort((a, b) => a - b),
    };
  });
}

export function mapJellyfinItems(items, host, { listFiles } = {}) {
  return (items || []).map((it) => {
    const t = mapJellyfinItem(it, host);
    const files =
      typeof listFiles === "function"
        ? listFiles(it) || []
        : dumpSearchPaths(it?.Path, it?.Name).flatMap((p) => {
            const names = listDumpNames(p);
            if (t.kind !== "tv" && t.kind !== "anime") return names;
            const nested = [];
            for (const n of names.slice(0, 24)) {
              if (!/^(?:Season[\s._-]*\d{1,2}|S\d{1,2})$/i.test(String(n).trim())) continue;
              nested.push(
                ...listDumpNames(`${p.replace(/\/$/, "")}/${n}`).map((f) => `${n}/${f}`),
              );
            }
            return [...names, ...nested];
          });
    const hashes = hashDumpIds(it?.Name, it?.Path);
    const disk = seasonsFromDumpNames([...files, it?.Path, it?.Name]);
    const hashish = looksLikeHashTitle(it?.Name) || looksLikeHashTitle(t.title) || hashes.length;
    const indexerDump =
      looksLikeIndexerDump(it?.Name) || looksLikeIndexerDump(t.title) || looksLikeIndexerDump(it?.Path);
    const named = namedCatalogTitle(t);
    const leftover =
      !named &&
      (!(Number(t.year) > 0) || !t.poster || /\b[Ss]\d{1,2}/.test(String(it?.Name || t.title || "")));
    const dumpish = Boolean(hashish || indexerDump || leftover);
    if (!dumpish) {
      return disk.length ? { ...t, onDiskSeasons: disk } : t;
    }
    const ided = identifyLibraryTitle({ name: it?.Name, path: it?.Path, files });
    // Named Rookie with a UIndex dump Path is the show — dump seasons are Importing, never Watch.
    if (named) {
      return {
        ...t,
        path: it?.Path || t.path,
        fromDump: false,
        importingSeasons: disk,
      };
    }
    return {
      ...t,
      title: ided.title || t.title,
      year: indexerDump ? 0 : t.year || ided.year || 0,
      fromHashDump: Boolean(hashish),
      fromDump: true,
      ids: [...new Set([...(t.ids || []), ...hashes])],
      path: it?.Path || t.path,
      importingSeasons: disk,
      onDiskSeasons: [],
    };
  });
}

export function mapJellyfinItem(it, host) {
  const tmdb = it.ProviderIds?.Tmdb;
  const tvdb = it.ProviderIds?.Tvdb;
  const kind = it.Type === "Series" ? "tv" : "movie";
  const hashes = hashDumpIds(it.Name, it.Path);
  const ids = [
    tmdb ? `tmdb-${tmdb}` : "",
    tmdb && kind === "tv" ? `tmdb-tv-${tmdb}` : "",
    tvdb ? `tvdb-${tvdb}` : "",
    it.Id ? `jf-${it.Id}` : "",
    ...hashes,
  ].filter(Boolean);
  const id =
    kind === "tv" ? (tvdb ? `tvdb-${tvdb}` : ids[0]) : tmdb ? `tmdb-${tmdb}` : ids[0];
  const year = Number(it.ProductionYear) || 0;
  const poster = jellyfinHasPrimaryImage(it) ? jellyfinPosterUrl(host, it.Id) : "";
  const rawName = stripIndexerPrefix(it.Name || "Untitled");
  return {
    id,
    ids,
    kind,
    title: stripMatchingYear(rawName, year),
    year,
    overview: "",
    poster,
    path: it.Path || "",
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
  const ids = [t?.id, ...(Array.isArray(t?.ids) ? t.ids : [])].map(String);
  return ids.find((i) => /^(tmdb-|tvdb-)/.test(i)) || "";
}

/** TMDB/TVDB card with a human name — not a dump leftover, even if Path is a UIndex folder. */
export function namedCatalogTitle(t) {
  return Boolean(
    titleProviderId(t) && t?.title && !looksLikeHashTitle(t.title) && !looksLikeIndexerDump(t.title),
  );
}

function seasonNums(list) {
  return [...new Set((list || []).map(Number).filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b);
}

function dumpSeasonBucket(t) {
  if (namedCatalogTitle(t)) {
    const onDisk = seasonNums(t.onDiskSeasons);
    return { onDisk, importing: seasonNums(t.importingSeasons).filter((n) => !onDisk.includes(n)) };
  }
  const dumped = Boolean(t?.fromDump || isDumpTwinCard(t) || looksLikeIndexerDump(t?.title) || looksLikeHashTitle(t?.title));
  if (dumped) {
    return { onDisk: [], importing: seasonNums([...(t.onDiskSeasons || []), ...(t.importingSeasons || [])]) };
  }
  const onDisk = seasonNums(t.onDiskSeasons);
  return { onDisk, importing: seasonNums(t.importingSeasons).filter((n) => !onDisk.includes(n)) };
}

export function catalogIdsOf(t) {
  return [t?.id, ...(Array.isArray(t?.ids) ? t.ids : [])].map(String).filter((id) => /^(tmdb-|tvdb-)/.test(id));
}

export function isHashDumpId(id) {
  const s = String(id || "").trim();
  if (!s) return false;
  if (looksLikeHashTitle(s)) return true;
  if (s.startsWith("jf-") && looksLikeHashTitle(s.slice(3))) return true;
  return false;
}

/** Hash leftover ids in library-removed.json must not tombstone the named show. */
export function hideIdsForLibrary(removedIds) {
  const ids = [...(removedIds || [])].map(String).filter(Boolean);
  const set = new Set(ids);
  if (![...set].some((id) => isHashDumpId(id))) return set;
  for (const id of [...set]) {
    if (/^(tmdb-|tvdb-)/.test(id)) set.delete(id);
  }
  return set;
}

/** Drop catalog ids a hash-card Remove used to expand, and stale leftover hashes once the dump is gone. */
export function healRemovedIds(removedIds, titles = []) {
  const set = hideIdsForLibrary(removedIds);
  const leftoverOnDisk = (titles || []).some((t) => isHashDumpCard(t));
  if (!leftoverOnDisk) {
    for (const id of [...set]) {
      if (isHashDumpId(id)) set.delete(id);
    }
  }
  return [...set];
}

export function isHashDumpCard(t) {
  if (!t) return false;
  if (looksLikeHashTitle(t.title) || looksLikeHashTitle(t.id)) return true;
  if (t.fromHashDump && !(Number(t.year) > 0 && t.poster)) return true;
  return false;
}

function titleWords(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function dumpTitleWords(t) {
  const cleaned = stripIndexerPrefix(
    stripCompletePackSuffix(stripSeasonFolderSuffix(humanTitleFromSceneName(t?.title || "").title || t?.title || "")),
  );
  return titleWords(cleaned);
}

/** Unmatched indexer / scene / hash leftover — not a TMDB/TVDB card. */
export function isDumpTwinCard(t) {
  if (!t) return false;
  if (namedCatalogTitle(t)) return false;
  if (isHashDumpCard(t)) return true;
  if (t.fromDump) return true;
  if (looksLikeIndexerDump(t.title) || looksLikeIndexerDump(t.path)) return true;
  if (titleProviderId(t)) return false;
  if (!(Number(t.year) > 0) || !t.poster) return true;
  if (/\b[Ss]\d{1,2}\s*[Ee]\d{1,3}\b/.test(String(t.title || ""))) return true;
  return true;
}

export function dumpMatchesNamed(dump, named) {
  if (!dump || !named) return false;
  const dumpClean = stripIndexerPrefix(
    stripCompletePackSuffix(stripSeasonFolderSuffix(humanTitleFromSceneName(dump.title).title || dump.title || "")),
  );
  const namedClean = stripCompletePackSuffix(stripSeasonFolderSuffix(named.title || ""));
  const dn = normalizeTitle(dumpClean);
  const nn = normalizeTitle(namedClean);
  if (!dn || !nn || dn === "unknownonthisbox") return false;
  if (dn === nn) return true;
  const dumpWords = titleWords(dumpClean);
  const namedWords = titleWords(namedClean);
  if (!namedWords.length || dumpWords.length < namedWords.length) return false;
  const namedCore = nn.replace(/^(the|a|an)/, "");
  const namedSig = namedWords.filter((w) => w !== "the" && w !== "a" && w !== "an");
  if (namedCore.length < 4 && namedSig.length < 2) return false;
  for (let i = 0; i <= dumpWords.length - namedWords.length; i++) {
    if (namedWords.every((w, j) => dumpWords[i + j] === w)) return true;
  }
  return false;
}

/** Dump files waiting for Sonarr import are Importing — they do not become Watch. */
export function foldDumpSeasons(keep, drop) {
  const watch = new Set(seasonNums(keep?.onDiskSeasons));
  const importing = seasonNums([
    ...(keep?.importingSeasons || []),
    ...(drop?.importingSeasons || []),
    ...(drop?.onDiskSeasons || []).filter((n) => !watch.has(Number(n))),
  ]).filter((n) => !watch.has(n));
  return { onDiskSeasons: [...watch].sort((a, b) => a - b), importingSeasons: importing };
}

function shouldAliasDumpId(t) {
  if (!t) return false;
  if (looksLikeCompletePackTitle(t.title) || looksLikeSeasonFolderTitle(t.title)) return false;
  if (t.fromHashDump || looksLikeHashTitle(t.title) || looksLikeHashTitle(t.id)) return true;
  if (t.fromDump) return true;
  return looksLikeIndexerDump(t.title) || looksLikeIndexerDump(t.path);
}

function dumpAliasIds(t) {
  if (!shouldAliasDumpId(t)) {
    return [...(t?.ids || [])].filter((id) => /^(tmdb-|tvdb-)/.test(String(id)));
  }
  return [
    ...(t.ids || []),
    t.id,
    t.jellyfinId,
    t.jellyfinId ? `jf-${t.jellyfinId}` : "",
  ];
}

/** Named Watch seasons stay; dump/hash seasons become Importing. */
export function mergeTitleRows(keep, drop) {
  if (!keep) return drop;
  if (!drop) return keep;
  const k = dumpSeasonBucket(keep);
  const d = dumpSeasonBucket(drop);
  const onDiskSeasons = seasonNums([...k.onDisk, ...d.onDisk]);
  const importingSeasons = seasonNums([...k.importing, ...d.importing]).filter((n) => !onDiskSeasons.includes(n));
  const namedKeep = namedCatalogTitle(keep) || !namedCatalogTitle(drop) ? keep : drop;
  const other = namedKeep === keep ? drop : keep;
  const ids = [
    ...new Set(
      [
        ...(namedKeep.ids || []),
        namedKeep.id,
        namedKeep.jellyfinId,
        namedKeep.jellyfinId ? `jf-${namedKeep.jellyfinId}` : "",
        ...dumpAliasIds(other),
      ]
        .filter(Boolean)
        .map(String),
    ),
  ];
  return {
    ...namedKeep,
    ids,
    onDiskSeasons,
    importingSeasons,
    unreleasedSeasons: seasonNums([...(keep.unreleasedSeasons || []), ...(drop.unreleasedSeasons || [])]),
    poster: keep.poster || drop.poster,
    year: Number(keep.year) > 0 ? keep.year : drop.year,
    fromDump: namedCatalogTitle(namedKeep) ? false : Boolean(keep.fromDump || drop.fromDump),
    fromHashDump: namedCatalogTitle(namedKeep)
      ? Boolean(keep.fromHashDump && !namedCatalogTitle(keep))
      : Boolean(keep.fromHashDump || drop.fromHashDump),
  };
}

function mergeDumpIntoNamed(keep, drop) {
  return mergeTitleRows(keep, drop);
}

/** Named JF/TMDB/TVDB card wins; UIndex / Torrenting / episode-dump twins fold into it. */
export function collapseDumpTwins(titles) {
  const list = (titles || []).filter(Boolean).map((t) => ({ ...t }));
  const namedIdx = [];
  for (let i = 0; i < list.length; i++) {
    if (titleProviderId(list[i]) && !isDumpTwinCard(list[i])) namedIdx.push(i);
  }
  const drop = new Set();
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (!isDumpTwinCard(t) && titleProviderId(t)) continue;
    if (!isDumpTwinCard(t) && !looksLikeIndexerDump(t.title)) continue;
    let best = -1;
    let bestScore = -1;
    for (const j of namedIdx) {
      if (j === i) continue;
      if (!dumpMatchesNamed(t, list[j])) continue;
      const exact = normalizeTitle(t.title) === normalizeTitle(list[j].title) ? 2 : 0;
      const score = exact + String(list[j].title || "").length;
      if (score > bestScore) {
        bestScore = score;
        best = j;
      }
    }
    if (best < 0) continue;
    list[best] = mergeDumpIntoNamed(list[best], t);
    drop.add(i);
  }
  return list.filter((_, i) => !drop.has(i));
}

function titleAliasIds(t) {
  return [t?.id, ...(Array.isArray(t?.ids) ? t.ids : []), t?.jellyfinId, t?.jellyfinId ? `jf-${t.jellyfinId}` : ""]
    .filter(Boolean)
    .map(String);
}

/** Home: never paint a 40-char hash / year-0 empty poster when the named show is on the shelf. */
export function homeShelfRows(titles) {
  const list = collapseDumpTwins((titles || []).filter(Boolean));
  const named = list.filter(
    (t) => !isDumpTwinCard(t) && t.title && t.title !== UNKNOWN_ON_BOX && !looksLikeHashTitle(t.title),
  );
  const namedIds = new Set(named.flatMap(titleAliasIds));
  const namedNames = new Set(named.map((t) => normalizeTitle(t.title)));
  return list.filter((t) => {
    if (looksLikeHashTitle(t.title) || looksLikeHashTitle(t.id)) {
      return false;
    }
    if (isDumpTwinCard(t)) {
      if (titleAliasIds(t).some((id) => namedIds.has(id))) return false;
      const name = normalizeTitle(t.title);
      if (name && namedNames.has(name)) return false;
      if (named.some((n) => dumpMatchesNamed(t, n))) return false;
      if (isHashDumpCard(t) && !(Number(t.year) > 0) && !t.poster) return false;
    }
    return true;
  });
}

/** Leftover dump jf-* in the removed list must not hide the real titled series. */
export function libraryRowHidden(t, hide) {
  const set = hide instanceof Set ? hideIdsForLibrary(hide) : hideIdsForLibrary(hide || []);
  if (!set.size) return false;
  if (!isHashDumpCard(t) && catalogIdsOf(t).length && ![...set].some((id) => isHashDumpId(id))) {
    return catalogIdsOf(t).some((id) => set.has(id));
  }
  if (!isHashDumpCard(t) && catalogIdsOf(t).length) {
    return false;
  }
  const ids = titleAliasIds(t);
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
    if (betterScore || preferSeriesName) {
      slot.best = mergeTitleRows(t, slot.best);
      if (year) slot.year = year;
    } else {
      slot.best = mergeTitleRows(slot.best, t);
      slot.year = slot.year || year;
    }
  }
  return collapseDumpTwins(
    [...groups.values()].flat().map((s) => (s.year && !titleYear(s.best) ? { ...s.best, year: s.year } : s.best)),
  );
}

export function withPosterHost(titles, host) {
  return (titles || []).map((t) => ({
    ...t,
    poster: t.poster && t.jellyfinId ? jellyfinPosterUrl(host, t.jellyfinId) : t.poster || "",
  }));
}

export function applyLibraryLimit(titles, limit) {
  if (!limit) return titles;
  return titles.slice(0, limit);
}

export function mergeShelf(prev, next, limited) {
  const incoming = homeShelfRows(next || []);
  if (!limited) return incoming;
  if (!prev?.length) return incoming;
  const have = new Set(incoming.flatMap(titleAliasIds));
  const extra = homeShelfRows(prev).filter((t) => !titleAliasIds(t).some((k) => have.has(k)));
  return homeShelfRows([...incoming, ...extra]);
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
    write(titles, { now = Date.now(), complete = true, continueWatching } = {}) {
      mem = {
        at: now,
        complete,
        titles,
        continueWatching:
          continueWatching !== undefined ? continueWatching : mem?.continueWatching || [],
      };
      return mem;
    },
    drop(keys, { now = Date.now() } = {}) {
      if (!mem?.titles) return mem;
      const hide = keys instanceof Set ? keys : new Set(keys || []);
      mem = {
        at: now,
        complete: mem.complete,
        titles: mem.titles.filter((t) => !libraryRowHidden(t, hide)),
        continueWatching: (mem.continueWatching || []).filter((t) => !libraryRowHidden(t, hide)),
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
    return {
      at: Number(j.at) || 0,
      complete: j.complete !== false,
      titles: j.titles,
      continueWatching: Array.isArray(j.continueWatching) ? j.continueWatching : [],
    };
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
  fetchResume,
  refresh,
  onLiveTitles,
  removedIds = [],
}) {
  const u = new URL(url, "http://reelos.local");
  const limit = parseLibraryLimit(u.searchParams.get("limit"));
  const wantFresh = u.searchParams.get("fresh") === "1";
  const stale = cache.read();
  const hide = new Set((removedIds || []).map((id) => String(id)).filter(Boolean));
  const withoutRemoved = (titles) => {
    if (!hide.size) return titles || [];
    return homeShelfRows((titles || []).filter((t) => !libraryRowHidden(t, hide)));
  };

  const serve = (titles, extra = {}) => {
    const rows = extra.fromCache ? withoutRemoved(titles) : titles || [];
    const resume = extra.continueWatching !== undefined
      ? extra.continueWatching
      : extra.fromCache
        ? stale?.continueWatching || []
        : [];
    return {
      titles: withPosterHost(
        applyLibraryLimit(dedupeLibraryTitles(repairHashTitles(rows)), limit),
        host,
      ),
      continueWatching: withPosterHost(resume || [], host),
      error: extra.error ?? null,
      fromCache: Boolean(extra.fromCache),
    };
  };

  const staleCoversRequest = canServeStale(stale);
  if (!wantFresh && staleCoversRequest) {
    if ((!stale.complete || !cacheIsFresh(stale, now, ttlMs)) && typeof refresh === "function") {
      void refresh();
    }
    return serve(stale.titles, { fromCache: true, continueWatching: stale.continueWatching || [] });
  }

  const auth = await getAuth();
  if (!auth?.token) {
    if (canServeStale(stale)) {
      return serve(stale.titles, {
        fromCache: true,
        continueWatching: stale.continueWatching || [],
        error: "Jellyfin has no matching user/PIN",
      });
    }
    return { titles: [], continueWatching: [], error: "Jellyfin has no matching user/PIN", fromCache: false };
  }

  try {
    const resumeP =
      typeof fetchResume === "function"
        ? fetchResume(auth).catch(() => null)
        : Promise.resolve(undefined);
    const [data, resumeJson] = await Promise.all([fetchItems(auth, limit), resumeP]);
    const items = Array.isArray(data?.Items) ? data.Items : [];
    const titles = dedupeLibraryTitles(mapJellyfinItems(items, host));
    const writeOpts = { now, complete: !limit };
    let continueWatching = stale?.continueWatching || [];
    if (resumeJson && typeof resumeJson === "object") {
      continueWatching = mapResumeItems(Array.isArray(resumeJson.Items) ? resumeJson.Items : [], {
        host,
        libraryTitles: titles,
      });
      writeOpts.continueWatching = continueWatching;
    }
    cache.write(titles, writeOpts);
    if (!limit && typeof onLiveTitles === "function") onLiveTitles(titles);
    if (limit && typeof refresh === "function") void refresh();
    return serve(titles, { continueWatching });
  } catch (e) {
    if (canServeStale(stale)) {
      return serve(stale.titles, {
        fromCache: true,
        continueWatching: stale.continueWatching || [],
        error: String(e),
      });
    }
    return { titles: [], continueWatching: [], error: String(e), fromCache: false };
  }
}
