/** Seerr/Jellyseerr helpers for /api/lookup and /api/request. */
import { existsSync, readFileSync } from "node:fs";
import { titleIsCuratorHidden } from "./reelos-curator.mjs";

export const SEERR_ORIGIN = "http://127.0.0.1:5055";

export function seerrSettingsPaths() {
  return [
    "/opt/reelos/compose/configs/seerr/settings.json",
    "/workspace/install/compose/configs/seerr/settings.json",
    "/workspace/compose/configs/seerr/settings.json",
  ];
}

export function seerrApiKey() {
  try {
    if (existsSync("/var/lib/reelos/seerr.key")) {
      const key = readFileSync("/var/lib/reelos/seerr.key", "utf8").trim();
      if (key) return key;
    }
  } catch {
    /* */
  }
  for (const p of seerrSettingsPaths()) {
    if (!existsSync(p)) continue;
    try {
      const j = JSON.parse(readFileSync(p, "utf8"));
      const key = j?.main?.apiKey || j?.apiKey;
      if (key) return String(key);
    } catch {
      /* */
    }
  }
  return null;
}

export function parseTitleId(id) {
  const s = String(id || "").trim();
  if (s.startsWith("tmdb-tv-")) return { mediaType: "tv", tmdb: s.slice(8), titleId: s };
  if (s.startsWith("tmdb-")) return { mediaType: "movie", tmdb: s.slice(5), titleId: s };
  if (s.startsWith("tvdb-")) return { mediaType: "tv", tvdb: s.slice(5), titleId: s };
  if (s.startsWith("jf-") && s.length > 3) return { jellyfinId: s.slice(3), titleId: s };
  if (/^[0-9a-f]{32,64}$/i.test(s)) return { hash: s.toLowerCase(), titleId: s.toLowerCase() };
  return null;
}

export function titleIdFor(mediaType, tmdb) {
  if (tmdb == null || tmdb === "") return null;
  return mediaType === "tv" ? `tmdb-tv-${tmdb}` : `tmdb-${tmdb}`;
}

function collectTitleIds(t) {
  return [t?.id, ...(Array.isArray(t?.ids) ? t.ids : []), t?.jellyfinId, t?.jellyfinId ? `jf-${t.jellyfinId}` : ""]
    .map((x) => String(x || "").trim())
    .filter(Boolean);
}

/** Library/Sonarr often store TV as tvdb-* while Seerr/TMDB use tmdb-tv-*. */
export function tmdbFromTitleIds(ids) {
  const list = (ids || []).map(String);
  const tv = list.find((i) => i.startsWith("tmdb-tv-"));
  if (tv) return { mediaType: "tv", tmdb: tv.slice(8) };
  const movie = list.find((i) => /^tmdb-\d/.test(i));
  if (movie) return { mediaType: "movie", tmdb: movie.slice(5) };
  return null;
}

export function resolveParsedTitle(parsed, { titles = [], series = [], movies = [] } = {}) {
  if (!parsed) return parsed;
  if (parsed.tmdb) return parsed;
  const tvdbKey = parsed.tvdb ? `tvdb-${parsed.tvdb}` : "";
  const pageId = String(parsed.titleId || "");
  for (const t of titles || []) {
    const ids = collectTitleIds(t);
    const hit = (tvdbKey && ids.includes(tvdbKey)) || (pageId && ids.includes(pageId));
    if (!hit) continue;
    const mapped = tmdbFromTitleIds(ids);
    if (!mapped?.tmdb) continue;
    const mediaType = parsed.mediaType || mapped.mediaType || (t.kind === "tv" || t.kind === "anime" ? "tv" : "movie");
    const tvdb =
      parsed.tvdb ||
      (ids.find((i) => i.startsWith("tvdb-")) || "").replace(/^tvdb-/, "") ||
      undefined;
    return {
      mediaType,
      tmdb: String(mapped.tmdb),
      tvdb: tvdb || undefined,
      titleId: titleIdFor(mediaType, mapped.tmdb),
    };
  }
  if (parsed.tvdb) {
    const s = (series || []).find((x) => String(x?.tvdbId) === String(parsed.tvdb));
    if (s?.tmdbId) {
      return {
        mediaType: "tv",
        tmdb: String(s.tmdbId),
        tvdb: String(parsed.tvdb),
        titleId: titleIdFor("tv", s.tmdbId),
      };
    }
  }
  if (parsed.titleId && !parsed.tvdb) {
    const m = (movies || []).find((x) => String(x?.tmdbId) === String(parsed.titleId.replace(/^tmdb-/, "")));
    if (m?.tmdbId) {
      return { mediaType: "movie", tmdb: String(m.tmdbId), titleId: titleIdFor("movie", m.tmdbId) };
    }
  }
  return parsed;
}

export function attachTitleAliases(title, parsed) {
  if (!title) return title;
  const ids = new Set([...(title.ids || []), title.id].filter(Boolean));
  if (parsed?.tmdb) {
    ids.add(`tmdb-${parsed.tmdb}`);
    if ((parsed.mediaType || title.kind) === "tv") ids.add(`tmdb-tv-${parsed.tmdb}`);
  }
  if (parsed?.tvdb) ids.add(`tvdb-${parsed.tvdb}`);
  return { ...title, ids: [...ids] };
}

export function libraryHasTitle(titles, id) {
  return Boolean(findLibraryTitle(titles, id));
}

export function findLibraryTitle(titles, id) {
  const parsed = parseTitleId(id);
  const hash = parsed?.hash || (/^[0-9a-f]{32,64}$/i.test(String(id || "")) ? String(id).toLowerCase() : "");
  const keys = new Set(
    [
      id,
      parsed?.titleId,
      parsed?.tvdb ? `tvdb-${parsed.tvdb}` : "",
      parsed?.tmdb ? `tmdb-${parsed.tmdb}` : "",
      parsed?.mediaType === "tv" && parsed?.tmdb ? `tmdb-tv-${parsed.tmdb}` : "",
      parsed?.jellyfinId,
      parsed?.jellyfinId ? `jf-${parsed.jellyfinId}` : "",
      hash,
    ].filter(Boolean),
  );
  return (
    (titles || []).find((t) => {
      const ids = collectTitleIds(t);
      if (ids.some((x) => keys.has(x) || (hash && String(x).toLowerCase() === hash))) return true;
      if (hash && String(t?.path || "").toLowerCase().includes(hash)) return true;
      return false;
    }) || null
  );
}

export function attachLibraryPresence(title, libraryTitle) {
  if (!title) return libraryTitle || title;
  if (!libraryTitle) return title;
  const ids = [
    ...new Set(
      [
        ...(title.ids || []),
        ...(libraryTitle.ids || []),
        title.id,
        libraryTitle.id,
        libraryTitle.jellyfinId,
        libraryTitle.jellyfinId ? `jf-${libraryTitle.jellyfinId}` : "",
      ]
        .filter(Boolean)
        .map(String),
    ),
  ];
  const disk = [
    ...new Set(
      [...(title.onDiskSeasons || []), ...(libraryTitle.onDiskSeasons || [])]
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  ].sort((a, b) => a - b);
  const listed = [
    ...new Set(
      [...(title.seasonList || []), ...(libraryTitle.seasonList || [])]
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  ].sort((a, b) => a - b);
  return {
    ...title,
    ids,
    jellyfinId: title.jellyfinId || libraryTitle.jellyfinId,
    poster: title.poster || libraryTitle.poster,
    inLibrary: Boolean(title.jellyfinId || libraryTitle.jellyfinId),
    year: title.year || libraryTitle.year || 0,
    onDiskSeasons: disk.length ? disk : title.onDiskSeasons || libraryTitle.onDiskSeasons,
    seasonList: listed.length ? listed : title.seasonList || libraryTitle.seasonList,
  };
}

/** Seerr is for requests. A JF row already on the box is the title page. */
export function lookupPayloadForId({ seerrTitle, libraryTitle, missingTmdb, onDiskSeasons, seasonList } = {}) {
  const decorate = (title) => {
    if (!title) return title;
    const disk = [
      ...new Set(
        [...(title.onDiskSeasons || []), ...(onDiskSeasons || [])]
          .map(Number)
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    ].sort((a, b) => a - b);
    const listed = [
      ...new Set(
        [...(title.seasonList || []), ...(seasonList || [])]
          .map(Number)
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    ].sort((a, b) => a - b);
    return {
      ...title,
      onDiskSeasons: disk.length ? disk : title.onDiskSeasons,
      seasonList: listed.length ? listed : title.seasonList,
    };
  };
  if (seerrTitle) {
    return { titles: [decorate(attachLibraryPresence(seerrTitle, libraryTitle))], error: null };
  }
  if (libraryTitle) {
    return { titles: [decorate(libraryTitle)], error: null };
  }
  if (missingTmdb) {
    return { titles: [], error: "Could not map that title to TMDB. Retry, or open it from Library." };
  }
  return { titles: [], error: "Seerr did not find that title" };
}

export function pickSeerrSearchForLibrary(title, hits) {
  const want = String(title?.title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  if (!want || want === "unknownonthisbox" || /^[0-9a-f]{32,64}$/.test(want)) return null;
  const kind = title?.kind;
  return (
    (hits || []).find((h) => {
      const got = String(h?.title || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
      if (got !== want) return false;
      if (kind && h.kind && h.kind !== kind && !(kind === "tv" && h.kind === "anime") && !(kind === "anime" && h.kind === "tv")) {
        return false;
      }
      return true;
    }) || null
  );
}

/** Seerr/TMDB type strings vary; person/collection must not become movie. */
export function normalizeMediaType(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (s === "tv" || s === "tvshow" || s === "tvshows" || s === "series" || s === "show") return "tv";
  if (s === "movie" || s === "movies") return "movie";
  return null;
}

/** Never request every season. Missing/invalid season → S01, not "all". */
export function tvSeasonsForRequest(season) {
  const n = Number(season);
  return Number.isFinite(n) && n > 0 ? [n] : [1];
}

/** POST /api/v1/request body. TV is always one season. */
export function buildSeerrAddPayload({ mediaType, tmdb, season } = {}) {
  const type = normalizeMediaType(mediaType);
  const id = Number(tmdb);
  if (!type || !Number.isFinite(id) || id <= 0) return null;
  const payload = { mediaType: type, mediaId: id };
  if (type === "tv") payload.seasons = tvSeasonsForRequest(season);
  return payload;
}

export function lookupFailureMessage(err) {
  const name = err?.name || "";
  const text = String(err?.message || err || "");
  if (name === "AbortError" || /abort/i.test(name) || /aborted|timeout/i.test(text)) {
    return "Seerr lookup timed out. Try the search again.";
  }
  return `seerr ${text}`;
}

export function rankLookupTitles(titles, q) {
  const qn = String(q || "")
    .trim()
    .toLowerCase();
  return [...(titles || [])].sort((a, b) => {
    const as = String(a?.title || "").toLowerCase();
    const bs = String(b?.title || "").toLowerCase();
    const ar = as === qn ? 0 : as.startsWith(qn) ? 1 : as.includes(qn) ? 2 : 3;
    const br = bs === qn ? 0 : bs.startsWith(qn) ? 1 : bs.includes(qn) ? 2 : 3;
    if (ar !== br) return ar - br;
    if (ar === 0 && a.kind !== b.kind) return a.kind === "movie" ? -1 : 1;
    return (Number(b?.year) || 0) - (Number(a?.year) || 0);
  });
}

/** Search hits must carry the JF row when the title is already on the box. JF-only names still appear. */
export function overlayLookupWithLibrary(seerrTitles, libraryTitles, q) {
  const mapped = (seerrTitles || []).map((t) => {
    const hit =
      findLibraryTitle(libraryTitles, t?.id) ||
      (t?.ids || []).map((id) => findLibraryTitle(libraryTitles, id)).find(Boolean) ||
      null;
    const attached = attachLibraryPresence(t, hit && hit.jellyfinId ? hit : null);
    return { ...attached, inLibrary: Boolean(attached.jellyfinId) };
  });
  const have = new Set();
  for (const t of mapped) {
    for (const id of [t?.id, ...(t?.ids || [])]) {
      if (id) have.add(String(id));
    }
  }
  const qn = String(q || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const extras = [];
  for (const lib of libraryTitles || []) {
    if (!lib?.jellyfinId) continue;
    const ids = [lib.id, ...(lib.ids || [])].map(String);
    if (ids.some((id) => have.has(id))) continue;
    const name = String(lib.title || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    if (!qn || !name.includes(qn)) continue;
    extras.push(lib);
    for (const id of ids) have.add(id);
  }
  return rankLookupTitles([...extras, ...mapped], q);
}

/** Map Seerr/TMDB search hits. No year filter — 2012–2016 titles stay in the list. */
export function mapSeerrSearchResults(hits, { q = "", limit = 16, excludeOwned, excludeHidden } = {}) {
  const owned = excludeOwned ? asDiscoverOwned(excludeOwned) : null;
  const titles = [];
  for (const h of hits || []) {
    const mediaType = normalizeMediaType(h?.mediaType || h?.media_type);
    if (!mediaType) continue;
    if (owned && seerrAlreadyHave(h)) continue;
    const t = seerrSearchHit(h, mediaType);
    if (!t) continue;
    if (owned && discoverTitleIsOwned(t, owned)) continue;
    if (excludeHidden && titleIsCuratorHidden(t, excludeHidden)) continue;
    titles.push(t);
    if (titles.length >= limit) break;
  }
  return rankLookupTitles(titles, q);
}

function creditHits(json) {
  const combined = json?.combinedCredits?.cast || json?.combined_credits?.cast || [];
  const movies = json?.movieCredits?.cast || json?.movie_credits?.cast || [];
  const shows = json?.tvCredits?.cast || json?.tv_credits?.cast || [];
  return [...combined, ...movies, ...shows];
}

export function mapSeerrPersonDetail(json, { libraryTitles = [], excludeHidden } = {}) {
  const id = Number(json?.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  const credits = [];
  const seen = new Set();
  for (const h of creditHits(json)) {
    const mediaType = normalizeMediaType(h?.mediaType || (h?.firstAirDate || h?.name ? "tv" : "movie"));
    if (!mediaType) continue;
    const t = seerrSearchHit({ ...h, mediaType }, mediaType);
    if (!t || seen.has(t.id)) continue;
    const libraryTitle = findLibraryTitle(libraryTitles, t.id);
    if (excludeHidden && titleIsCuratorHidden(t, excludeHidden) && !libraryTitle) continue;
    seen.add(t.id);
    credits.push(libraryTitle ? attachLibraryPresence(t, libraryTitle) : t);
    if (credits.length >= 40) break;
  }
  return {
    id,
    name: String(json.name || "Unknown"),
    biography: String(json.biography || ""),
    poster: tmdbPoster(json.profilePath || json.posterPath),
    knownForDepartment: String(json.knownForDepartment || "Acting"),
    credits,
    onBox: credits.filter((t) => t.inLibrary || t.jellyfinId).length,
  };
}

export function mapSeerrCollectionDetail(json, { libraryTitles = [], excludeHidden } = {}) {
  const id = Number(json?.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  const parts = [];
  const seen = new Set();
  for (const h of json?.parts || []) {
    const t = seerrSearchHit({ ...h, mediaType: "movie" }, "movie");
    if (!t || seen.has(t.id)) continue;
    const libraryTitle = findLibraryTitle(libraryTitles, t.id);
    if (excludeHidden && titleIsCuratorHidden(t, excludeHidden) && !libraryTitle) continue;
    seen.add(t.id);
    parts.push(libraryTitle ? attachLibraryPresence(t, libraryTitle) : t);
  }
  return {
    id,
    name: String(json.name || json.title || "Collection"),
    overview: String(json.overview || ""),
    poster: tmdbPoster(json.posterPath || json.backdropPath),
    parts,
    onBox: parts.filter((t) => t.inLibrary || t.jellyfinId).length,
  };
}

export function mapSeerrSimilarResults(hits, { mediaType, limit = 16, excludeIds, excludeHidden } = {}) {
  return mapSeerrDiscoverResults(hits, { mediaType, limit, excludeIds, excludeHidden });
}

/** Seerr/Jellyseerr: 4 = partially available, 5 = available. Those are already on the box. */
export function seerrAlreadyHave(hit) {
  const status = Number(hit?.mediaInfo?.status || 0);
  return status === 4 || status === 5;
}

function titleIdSet(titles) {
  const ids = new Set();
  for (const t of titles || []) {
    if (t?.id) ids.add(String(t.id));
    for (const extra of t?.ids || []) {
      if (extra) ids.add(String(extra));
    }
  }
  return ids;
}

export function discoverOwnedNameKey(t) {
  const kind = t?.kind === "tv" || t?.kind === "anime" || t?.mediaType === "tv" ? "tv" : "movie";
  const title = String(t?.title || t?.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const year = Number(t?.year) || Number(String(t?.releaseDate || t?.firstAirDate || "").slice(0, 4)) || 0;
  if (!title) return "";
  return `${kind}:${title}:${year || ""}`;
}

export function discoverOwnedIndex(titles = []) {
  const ids = titleIdSet(titles);
  const names = new Set();
  for (const t of titles || []) {
    if (t?.jellyfinId) {
      ids.add(String(t.jellyfinId));
      ids.add(`jf-${t.jellyfinId}`);
    }
    const key = discoverOwnedNameKey(t);
    if (key) names.add(key);
  }
  return { ids, names };
}

export function asDiscoverOwned(excludeIds) {
  if (!excludeIds) return { ids: new Set(), names: new Set() };
  if (excludeIds instanceof Set) return { ids: excludeIds, names: new Set() };
  if (excludeIds.ids instanceof Set || excludeIds.names instanceof Set) {
    return {
      ids: excludeIds.ids instanceof Set ? excludeIds.ids : new Set(),
      names: excludeIds.names instanceof Set ? excludeIds.names : new Set(),
    };
  }
  return discoverOwnedIndex(excludeIds);
}

/** JF-available / in-library. In-progress Requests are not owned yet. */
export function discoverTitleIsOwned(title, owned) {
  if (!title) return false;
  if (title.jellyfinId) return true;
  const index = asDiscoverOwned(owned);
  if (title.id && index.ids.has(String(title.id))) return true;
  for (const extra of title.ids || []) {
    if (index.ids.has(String(extra))) return true;
  }
  const key = discoverOwnedNameKey(title);
  return Boolean(key && index.names.has(key));
}

/** Upcoming TMDB junk (Mutiny, live-action Moana, Paradise Hotel) is not "pick tonight". */
export function discoverHitReleased(h, now = Date.now()) {
  const date = String(h?.releaseDate || h?.firstAirDate || "");
  if (date) {
    const ts = Date.parse(date);
    if (Number.isFinite(ts)) return ts <= now + 24 * 60 * 60 * 1000;
  }
  const year = Number((date.match(/^(\d{4})/) || [])[1] || h?.year || 0);
  const yNow = new Date(now).getUTCFullYear();
  return Number.isFinite(year) && year > 1970 && year < yNow;
}

/** Popular/trending rows this box does not already have. Search stays on /api/lookup. */
export function mapSeerrDiscoverResults(hits, { mediaType, limit = 16, excludeIds, excludeHidden, now = Date.now() } = {}) {
  const owned = asDiscoverOwned(excludeIds);
  const titles = [];
  for (const h of hits || []) {
    if (seerrAlreadyHave(h)) continue;
    if (!discoverHitReleased(h, now)) continue;
    const type = normalizeMediaType(h?.mediaType || mediaType);
    if (!type) continue;
    const t = seerrSearchHit(h, type);
    if (!t || discoverTitleIsOwned(t, owned)) continue;
    if (excludeHidden && titleIsCuratorHidden(t, excludeHidden)) continue;
    titles.push(t);
    if (titles.length >= limit) break;
  }
  return titles;
}

/**
 * Unit-sandbox: search hits → pick title → Seerr POST body → honest status.
 * Mock Seerr/*arr only. No house keys.
 */
export function simulateLookupAndRequest(
  { searchHits = [], movieHasFile = false, seasonFileCount = 0, seerrMediaStatus = 3 } = {},
  { q = "", pickId, season } = {},
) {
  const titles = mapSeerrSearchResults(searchHits, { q });
  const picked = pickId ? titles.find((t) => t.id === pickId) : titles[0];
  if (!picked) {
    return { titles, picked: null, payload: null, request: null, error: "Seerr returned no titles" };
  }
  const parsed = parseTitleId(picked.id);
  const payload = buildSeerrAddPayload({
    mediaType: parsed?.mediaType,
    tmdb: parsed?.tmdb,
    season: parsed?.mediaType === "tv" ? season : undefined,
  });
  const seasons = payload?.seasons?.map((n) => ({ seasonNumber: n }));
  const row = seerrRequestRow(
    {
      id: 1,
      type: parsed.mediaType,
      status: 2,
      createdAt: "2014-11-07T00:00:00.000Z",
      updatedAt: "2014-11-07T00:00:00.000Z",
      seasons,
      media: {
        tmdbId: Number(parsed.tmdb),
        mediaType: parsed.mediaType,
        status: seerrMediaStatus,
        seasons: seasons?.map((s) => ({ ...s, status: seerrMediaStatus })),
      },
    },
    {},
  );
  const series =
    parsed.mediaType === "tv" && payload?.seasons?.[0]
      ? [
          {
            tmdbId: Number(parsed.tmdb),
            seasons: [{ seasonNumber: payload.seasons[0], statistics: { episodeFileCount: seasonFileCount } }],
          },
        ]
      : [];
  const movies =
    parsed.mediaType === "movie"
      ? [{ tmdbId: Number(parsed.tmdb), hasFile: movieHasFile, statistics: { movieFileCount: movieHasFile ? 1 : 0 } }]
      : [];
  const honest = honestifyRequests([row], {
    arrReady: true,
    arrIndex: buildArrIndex({ movies, series }),
  });
  return { titles, picked, payload, request: honest[0] || row, parsed };
}

/** Austin DoD 2026-09-08: two 2012–2016 movies + two TV seasons. */
export const ERA_QA_TITLES = [
  {
    q: "interstellar",
    id: 157336,
    mediaType: "movie",
    title: "Interstellar",
    year: 2014,
    releaseDate: "2014-11-07",
  },
  {
    q: "the martian",
    id: 286217,
    mediaType: "movie",
    title: "The Martian",
    year: 2015,
    releaseDate: "2015-09-30",
  },
  {
    q: "brooklyn nine-nine",
    id: 48891,
    mediaType: "tv",
    title: "Brooklyn Nine-Nine",
    year: 2013,
    firstAirDate: "2013-09-17",
    season: 1,
  },
  {
    q: "mr robot",
    id: 62560,
    mediaType: "tv",
    title: "Mr. Robot",
    year: 2015,
    firstAirDate: "2015-06-24",
    season: 2,
  },
];

export function eraSearchHit(spec) {
  if (spec.mediaType === "tv") {
    return {
      id: spec.id,
      mediaType: "tv",
      name: spec.title,
      firstAirDate: spec.firstAirDate,
      seasons: [{ seasonNumber: 0 }, { seasonNumber: 1 }, { seasonNumber: 2 }],
    };
  }
  return {
    id: spec.id,
    mediaType: "movie",
    title: spec.title,
    releaseDate: spec.releaseDate,
  };
}

/** Search → Seerr POST → honest 0% (no file) or AVAILABLE (hasFile). */
export function proveEraLookupRequest(spec, { hasFile = false } = {}) {
  return simulateLookupAndRequest(
    {
      searchHits: [eraSearchHit(spec)],
      movieHasFile: spec.mediaType === "movie" && hasFile,
      seasonFileCount: spec.mediaType === "tv" && hasFile ? 10 : 0,
      seerrMediaStatus: hasFile ? 5 : 3,
    },
    {
      q: spec.q,
      pickId: titleIdFor(spec.mediaType, spec.id),
      season: spec.season,
    },
  );
}

export function tmdbPoster(path) {
  const p = String(path || "");
  if (!p) return "";
  if (p.startsWith("http")) return p;
  return `https://image.tmdb.org/t/p/w500${p.startsWith("/") ? p : `/${p}`}`;
}

export function realSeasonNumbers(seasons) {
  if (!Array.isArray(seasons)) return [];
  return seasons
    .map((s) => Number(s?.seasonNumber ?? s))
    .filter((n) => Number.isFinite(n) && n > 0)
    .filter((n, i, all) => all.indexOf(n) === i)
    .sort((a, b) => a - b);
}

export function seasonCount(seasons) {
  const n = Number(seasons);
  if (Number.isFinite(n) && !Array.isArray(seasons)) return Math.max(0, Math.trunc(n));
  return realSeasonNumbers(seasons).length;
}

/** Seerr media: 1 unknown, 2 pending, 3 processing, 4 partial, 5 available. Request: 1 pending, 2 approved, 3 declined, 4 failed. */
export function seerrSeasonStatus(media, seasonNumber) {
  if (seasonNumber == null) return 0;
  const seasons = Array.isArray(media?.seasons) ? media.seasons : [];
  const hit = seasons.find((s) => Number(s?.seasonNumber) === Number(seasonNumber));
  return Number(hit?.status || 0);
}

export function mapSeerrStatus(mediaStatus, requestStatus, seasonStatus) {
  const r = Number(requestStatus || 0);
  if (r === 4 || r === 3) return "failed";
  const season = Number(seasonStatus || 0);
  if (season === 5) return "downloaded";
  // A requested season still processing/partial/pending is not closed by series AVAILABLE.
  if (season === 3 || season === 4) return "grabbing";
  if (season === 1 || season === 2) return "queued";
  const m = Number(mediaStatus || 0);
  if (m === 5) return "downloaded";
  const effective = season || m;
  if (effective === 3 || effective === 4) return "grabbing";
  if (effective === 2 || r === 1 || r === 2) return "queued";
  return "unknown";
}

export function markAvailable(row) {
  if (!row) return row;
  return {
    ...row,
    status: "available",
    engine: "downloaded",
    progress: 100,
    reason: undefined,
  };
}

export function requestMatchKey(row) {
  if (!row?.titleId) return "";
  return row.season == null ? String(row.titleId) : `${row.titleId}#${row.season}`;
}

export function libraryHit(row, libraryTitles) {
  if (!row?.titleId || !Array.isArray(libraryTitles)) return false;
  const parsed = parseTitleId(row.titleId);
  const wantMovie = parsed?.mediaType === "movie";
  const wantTv = parsed?.mediaType === "tv";
  const tmdb = parsed?.tmdb;
  for (const t of libraryTitles) {
    const kind = t?.kind === "tv" || t?.kind === "anime" ? "tv" : t?.kind === "movie" ? "movie" : null;
    if (wantMovie && kind === "tv") continue;
    if (wantTv && kind === "movie") continue;
    const ids = [t?.id, ...(Array.isArray(t?.ids) ? t.ids : [])].filter(Boolean);
    const hit = ids.some((id) => {
      if (id === row.titleId) return true;
      if (tmdb && (id === `tmdb-${tmdb}` || id === `tmdb-tv-${tmdb}`)) return true;
      return false;
    });
    if (!hit) continue;
    if (wantMovie) return true;
    if (wantTv) {
      const disk = Array.isArray(t?.onDiskSeasons) ? t.onDiskSeasons.map(Number) : [];
      if (row.season == null) return false;
      return disk.includes(Number(row.season));
    }
    return false;
  }
  return false;
}

export function buildArrIndex({ movies = [], series = [] } = {}) {
  const movieHasFile = new Set();
  for (const m of movies) {
    const tmdb = m?.tmdbId;
    if (tmdb == null) continue;
    const files = Number(m?.statistics?.movieFileCount || 0);
    if (m?.hasFile === true || files > 0) movieHasFile.add(String(tmdb));
  }
  const seasonHasFile = new Set();
  for (const s of series) {
    const tmdb = s?.tmdbId != null ? String(s.tmdbId) : "";
    const tvdb = s?.tvdbId != null ? String(s.tvdbId) : "";
    for (const season of s?.seasons || []) {
      const n = Number(season?.seasonNumber);
      if (!Number.isFinite(n) || n <= 0) continue;
      const files = Number(season?.statistics?.episodeFileCount || 0);
      if (files <= 0) continue;
      if (tmdb) seasonHasFile.add(`tmdb:${tmdb}:${n}`);
      if (tvdb) seasonHasFile.add(`tvdb:${tvdb}:${n}`);
    }
  }
  return { movieHasFile, seasonHasFile };
}

export function arrHasFile(row, index) {
  if (!row?.titleId || !index) return false;
  const parsed = parseTitleId(row.titleId);
  if (!parsed) return false;
  if (parsed.mediaType === "movie") return Boolean(index.movieHasFile?.has(String(parsed.tmdb)));
  const season = row.season;
  if (season == null) {
    const tmdbPrefix = parsed.tmdb ? `tmdb:${parsed.tmdb}:` : "";
    const tvdbPrefix = parsed.tvdb ? `tvdb:${parsed.tvdb}:` : "";
    for (const key of index.seasonHasFile || []) {
      const k = String(key);
      if (tmdbPrefix && k.startsWith(tmdbPrefix)) return true;
      if (tvdbPrefix && k.startsWith(tvdbPrefix)) return true;
    }
    return false;
  }
  if (parsed.tmdb && index.seasonHasFile?.has(`tmdb:${parsed.tmdb}:${season}`)) return true;
  if (parsed.tvdb && index.seasonHasFile?.has(`tvdb:${parsed.tvdb}:${season}`)) return true;
  return false;
}

/** Seasons *arr already has files for — Request Sxx must hide these. */
export function onDiskSeasonsFor(parsed, index) {
  if (!parsed || parsed.mediaType === "movie" || !index?.seasonHasFile) return [];
  const out = [];
  const tmdbPrefix = parsed.tmdb ? `tmdb:${parsed.tmdb}:` : "";
  const tvdbPrefix = parsed.tvdb ? `tvdb:${parsed.tvdb}:` : "";
  for (const key of index.seasonHasFile) {
    const k = String(key);
    let n = 0;
    if (tmdbPrefix && k.startsWith(tmdbPrefix)) n = Number(k.slice(tmdbPrefix.length));
    else if (tvdbPrefix && k.startsWith(tvdbPrefix)) n = Number(k.slice(tvdbPrefix.length));
    if (Number.isFinite(n) && n > 0) out.push(n);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

export function decorateTitlesWithDiskSeasons(titles, facts = {}) {
  const index = facts.arrIndex || buildArrIndex({ series: facts.series, movies: facts.movies });
  return (titles || []).map((t) => {
    if (!t) return t;
    const parsed = resolveParsedTitle(parseTitleId(t.id) || parseTitleId((t.ids || [])[0]), {
      titles: [t, ...(facts.libraryTitles || [])],
      series: facts.series,
      movies: facts.movies,
    });
    const disk = [
      ...new Set(
        [...(t.onDiskSeasons || []), ...onDiskSeasonsFor(parsed, index)]
          .map(Number)
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    ].sort((a, b) => a - b);
    const listed = realSeasonNumbers(
      (facts.series || []).find(
        (s) =>
          (parsed?.tmdb && String(s?.tmdbId) === String(parsed.tmdb)) ||
          (parsed?.tvdb && String(s?.tvdbId) === String(parsed.tvdb)),
      )?.seasons,
    );
    const seasonList = [
      ...new Set([...(t.seasonList || []), ...listed].map(Number).filter((n) => Number.isFinite(n) && n > 0)),
    ].sort((a, b) => a - b);
    return {
      ...t,
      onDiskSeasons: disk,
      seasonList: seasonList.length ? seasonList : t.seasonList,
    };
  });
}

/** Whole-show Seerr rows with several seasons stay mixed — S01 on disk is not S05 in. */
export function expandTvSeasonRows(rows, facts = {}) {
  const out = [];
  for (const row of rows || []) {
    if (!row) continue;
    const parsed = parseTitleId(row.titleId);
    if (parsed?.mediaType !== "tv" || row.season != null) {
      out.push(row);
      continue;
    }
    const requested = [...new Set((row.requestedSeasons || []).map(Number).filter((n) => Number.isFinite(n) && n > 0))];
    if (requested.length <= 1) {
      out.push(row);
      continue;
    }
    const disk = new Set(onDiskSeasonsFor(parsed, facts.arrIndex));
    if (requested.every((n) => disk.has(n))) {
      out.push({ ...row, status: "available", engine: "downloaded", progress: 100 });
      continue;
    }
    for (const n of requested) {
      out.push({
        ...row,
        id: `${row.id}-s${String(n).padStart(2, "0")}`,
        season: n,
        requestedSeasons: undefined,
      });
    }
  }
  return out;
}

/** GET /api/request body: season chips from *arr files, never series-in-JF as every season in. */
export function titleRequestSeasonPayload({
  id,
  season,
  parsed,
  facts,
  libraryTitles = [],
  honest,
  title,
} = {}) {
  const index = facts?.arrIndex;
  const lib = findLibraryTitle(libraryTitles, id);
  const disk = [
    ...new Set(
      [...onDiskSeasonsFor(parsed, index), ...(lib?.onDiskSeasons || []), ...(title?.onDiskSeasons || [])]
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  ].sort((a, b) => a - b);
  const listed = [
    ...new Set(
      [...(title?.seasonList || []), ...(lib?.seasonList || []), ...disk]
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  ].sort((a, b) => a - b);
  const seasonN = season != null && season !== "" && Number.isFinite(Number(season)) ? Number(season) : undefined;
  const seasonOnDisk = seasonN != null && disk.includes(seasonN);
  const honestEngine = honest?.engine || honest?.status || "unknown";
  const seriesAvailable = honest?.status === "available" || honestEngine === "downloaded";
  const status = seasonN != null ? (seasonOnDisk ? "downloaded" : seriesAvailable ? "unknown" : honestEngine) : honestEngine;
  return {
    status,
    engine: "seerr",
    title: title?.title,
    titleId: honest?.titleId || parsed?.titleId || id,
    seasons: title?.seasons,
    seasonList: listed.length ? listed : title?.seasonList,
    onDiskSeasons: disk,
    progress: seasonOnDisk ? 100 : seasonN != null && seriesAvailable ? 0 : honest?.progress,
    reason: seasonOnDisk ? undefined : honest?.reason,
    requestStatus: seasonOnDisk ? "available" : seasonN != null && seriesAvailable ? undefined : honest?.status,
  };
}

export function isTvSeasonRow(row) {
  if (!row?.titleId) return false;
  const parsed = parseTitleId(row.titleId);
  return parsed?.mediaType === "tv" && row.season != null;
}

/** Seerr AVAILABLE is a ghost when *arr is up and this movie/season has no file. */
export function seerrAvailableIsGhost(row, { arrIndex = null, arrReady = false, libraryTitles = [] } = {}) {
  if (!row) return false;
  if (libraryHit(row, libraryTitles)) return false;
  if (arrHasFile(row, arrIndex)) return false;
  if (!arrReady || !arrIndex) return false;
  const parsed = parseTitleId(row.titleId);
  if (!parsed) return false;
  if (parsed.mediaType === "movie") return true;
  if (parsed.mediaType === "tv" && row.season != null) return true;
  return false;
}

function demoteGhost(row, facts = {}) {
  const demoted = {
    ...row,
    status: "downloading",
    engine: "grabbing",
    progress: 0,
  };
  const reason = movieRequestReason(demoted, facts) || "Seerr says available — no file on disk";
  return { ...demoted, reason };
}

export function radarrDecypharrMissing(clients) {
  if (!Array.isArray(clients)) return false;
  return !clients.some((c) => {
    if (!c || c.implementation !== "QBittorrent") return false;
    if (c.enable === false) return false;
    const host = String((c.fields || []).find((f) => f && f.name === "host")?.value || "");
    const port = Number((c.fields || []).find((f) => f && f.name === "port")?.value);
    return host === "decypharr" && port === 8282;
  });
}

export function qualityFloorRejectsHd(profiles, profileId) {
  const profile = (profiles || []).find((p) => p?.id === profileId);
  if (!profile) return false;
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
  return !walk(profile.items);
}

export function movieInRadarrQueue(queue, hit, tmdb) {
  const rows = Array.isArray(queue) ? queue : [];
  return rows.some((q) => {
    if (!q) return false;
    if (hit?.id != null && String(q.movieId ?? q.movie?.id) === String(hit.id)) return true;
    if (tmdb != null && String(q.movie?.tmdbId ?? q.remoteMovie?.tmdbId) === String(tmdb)) return true;
    return false;
  });
}

function seriesSeasonFiles(hit, season) {
  if (!hit) return 0;
  if (season == null) return Number(hit.statistics?.episodeFileCount || 0);
  const row = (hit.seasons || []).find((s) => Number(s?.seasonNumber) === Number(season));
  if (row) return Number(row.statistics?.episodeFileCount || 0);
  return Number(hit.statistics?.episodeFileCount || 0);
}

function linkedNameList(dumps, torrents) {
  const fromDumps = [...(dumps?.sonarr || []), ...(dumps?.radarr || [])];
  const fromTorrents = (torrents || []).map((t) => t?.name || t?.title).filter(Boolean);
  return [...fromDumps, ...fromTorrents];
}

function dumpSeasonNumber(name) {
  const s = String(name || "");
  const m =
    s.match(/(?:^|[\s._-])S(\d{1,2})(?:E\d{2}|[\s._-]|$)/i) ||
    s.match(/Season[\s._-]*(\d{1,2})\b/i);
  return m ? Number(m[1]) : null;
}

function dumpNameMatchesTitle(name, title) {
  const want = String(title || "").toLowerCase().trim();
  const got = String(name || "").toLowerCase().trim();
  if (!want || !got) return false;
  if (got === want) return true;
  const stem = want.replace(/[^a-z0-9]+/g, " ").trim();
  const gotStem = got.replace(/\.[0-9]{4}.*$/, "").replace(/[^a-z0-9]+/g, " ").trim();
  if (stem && gotStem === stem) return true;
  const gotCompact = got.replace(/[^a-z0-9]+/g, "");
  const wantCompact = want.replace(/[^a-z0-9]+/g, "");
  return Boolean(wantCompact) && gotCompact.startsWith(wantCompact);
}

function sonarrDumpNamed(dumps, title, torrents = [], season, seriesFileCount = 0) {
  const matching = linkedNameList(dumps, torrents).filter((n) => dumpNameMatchesTitle(n, title));
  if (!matching.length) return false;
  const seasonNum = season == null ? null : Number(season);
  const seasonPack = matching.some((n) => dumpSeasonNumber(n) === seasonNum);
  if (seasonNum != null && seasonPack) return true;
  const otherSeasonPack = matching.some((n) => {
    const ds = dumpSeasonNumber(n);
    return ds != null && seasonNum != null && ds !== seasonNum;
  });
  if (otherSeasonPack && !seasonPack) return false;
  const generic = matching.some((n) => dumpSeasonNumber(n) == null);
  // Series folder after another season imported is the library root, not a pending pack.
  if (generic && Number(seriesFileCount) > 0) return false;
  return generic || matching.length > 0;
}

/** Seerr requested a show, Sonarr has 0 files. Keep downloading@0, say why. */
export function tvRequestReason(row, { series, arrSeriesReady, dumps, torrents } = {}) {
  if (!row?.titleId) return undefined;
  const parsed = parseTitleId(row.titleId);
  if (parsed?.mediaType !== "tv") return undefined;
  if (row.status === "available" || row.engine === "downloaded") return undefined;
  if (arrSeriesReady === false || !Array.isArray(series)) return undefined;
  const hit = series.find(
    (s) =>
      String(s?.tmdbId) === String(parsed.tmdb) ||
      (parsed.tvdb != null && String(s?.tvdbId) === String(parsed.tvdb)),
  );
  if (!hit) return "Requested — Sonarr has no series yet";
  if (seriesSeasonFiles(hit, row.season) > 0) return undefined;
  if (hit.monitored === false) return "Unmonitored in Sonarr — search will not run";
  const seasonRow = (hit.seasons || []).find((s) => Number(s?.seasonNumber) === Number(row.season));
  if (seasonRow && seasonRow.monitored === false) return "Season unmonitored in Sonarr — search will not run";
  if (sonarrDumpNamed(dumps, hit.title, torrents, row.season, hit.statistics?.episodeFileCount)) {
    return "Files linked — waiting for Sonarr import";
  }
  return "Searching — no file yet";
}

/** Seerr requested but Radarr never searched / has no grab client. Keep downloading@0, say why. */
export function movieRequestReason(
  row,
  { movies, radarrClients, arrMoviesReady, radarrQueue, radarrProfiles } = {},
) {
  if (!row?.titleId) return undefined;
  const parsed = parseTitleId(row.titleId);
  if (parsed?.mediaType !== "movie") return undefined;
  if (row.status === "available" || row.engine === "downloaded") return undefined;
  if (arrMoviesReady === false || !Array.isArray(movies)) return undefined;
  const hit = movies.find((m) => String(m?.tmdbId) === String(parsed.tmdb));
  if (!hit) return "Requested — Radarr has no movie yet";
  const files = Number(hit.statistics?.movieFileCount || 0);
  if (hit.hasFile === true || files > 0) return undefined;
  if (radarrClients != null && radarrDecypharrMissing(radarrClients)) {
    return "No grab client — search cannot land";
  }
  if (hit.monitored === false) return "Unmonitored in Radarr — search will not run";
  if (qualityFloorRejectsHd(radarrProfiles, hit.qualityProfileId)) {
    return "Quality floor is rejecting HD releases";
  }
  if (movieInRadarrQueue(radarrQueue, hit, parsed.tmdb)) {
    return "Grabbed — waiting on Decypharr";
  }
  return "Searching — no file yet";
}

/**
 * Honest request status, no fake %:
 * 1. Seerr declined/failed → failed
 * 2. Seerr media or requested-season AVAILABLE (5) → available *if* JF/*arr agree (or *arr is down)
 * 3. Jellyfin library hit (movie TMDB) → available
 * 4. Radarr hasFile / Sonarr season episodeFileCount > 0 → available
 * 5. Else processing/partial → downloading at progress 0
 * 6. Else pending/approved → waiting
 * Same titleId+season collapses to one row; a done sibling upgrades the rest.
 * Ghost: Seerr AVAILABLE + Sonarr season files=0 stays downloading (TWD after empty symlink).
 */
export function overlayPresence(
  rows,
  facts = {},
) {
  const { libraryTitles = [], arrIndex = null, seerrMediaByTitleId = null, arrReady = false } = facts;
  const mediaOf = (row) => {
    if (!seerrMediaByTitleId) return null;
    if (typeof seerrMediaByTitleId.get === "function") return seerrMediaByTitleId.get(row.titleId) || null;
    return seerrMediaByTitleId[row.titleId] || null;
  };
  const presence = { arrIndex, arrReady, libraryTitles };
  return (rows || []).map((row) => {
    if (!row) return row;
    if (row.status === "available" || row.engine === "downloaded") {
      if (seerrAvailableIsGhost(row, presence)) return demoteGhost(row, facts);
      return markAvailable(row);
    }
    const media = mediaOf(row);
    if (media) {
      const seasonSt = seerrSeasonStatus(media, row.season);
      // Series AVAILABLE is not S05 in. Per-season chips / rows need that season's status or files.
      const engine =
        row.season != null && seasonSt !== 5 && seasonSt !== 3 && seasonSt !== 4 && seasonSt !== 1 && seasonSt !== 2
          ? mapSeerrStatus(0, null, 0)
          : mapSeerrStatus(media.status, null, seasonSt);
      if (engine === "downloaded") {
        const promoted = markAvailable(row);
        if (seerrAvailableIsGhost(promoted, presence)) return demoteGhost(row, facts);
        return promoted;
      }
    }
    if (libraryHit(row, libraryTitles)) return markAvailable(row);
    if (arrHasFile(row, arrIndex)) return markAvailable(row);
    const reason = movieRequestReason(row, facts) || tvRequestReason(row, facts);
    return reason ? { ...row, reason } : row;
  });
}

const STATUS_RANK = { available: 4, downloading: 3, waiting: 2, failed: 1 };

export function reconcileRequestRows(rows) {
  const groups = new Map();
  for (const row of rows || []) {
    if (!row?.titleId) continue;
    const key = requestMatchKey(row);
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  const out = [];
  for (const list of groups.values()) {
    const anyAvailable = list.some((r) => r.status === "available" || r.engine === "downloaded");
    const picked = list.reduce((best, row) => {
      const br = STATUS_RANK[best.status] || 0;
      const rr = STATUS_RANK[row.status] || 0;
      if (rr !== br) return rr > br ? row : best;
      return (row.updatedAt || 0) >= (best.updatedAt || 0) ? row : best;
    });
    out.push(anyAvailable ? markAvailable(picked) : picked);
  }
  return out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function mergeRequestListTitles(seerrTitles = [], facts = {}) {
  const fromSeries = (facts.series || [])
    .filter((s) => s?.tmdbId != null)
    .map((s) => {
      const parsed = {
        mediaType: "tv",
        tmdb: String(s.tmdbId),
        tvdb: s.tvdbId != null ? String(s.tvdbId) : undefined,
        titleId: titleIdFor("tv", s.tmdbId),
      };
      const disk = onDiskSeasonsFor(
        parsed,
        facts.arrIndex || buildArrIndex({ series: facts.series, movies: facts.movies }),
      );
      return {
        id: parsed.titleId,
        kind: "tv",
        title: s.title || parsed.titleId,
        ids: [parsed.titleId, `tmdb-${parsed.tmdb}`, parsed.tvdb ? `tvdb-${parsed.tvdb}` : ""].filter(Boolean),
        onDiskSeasons: disk,
      };
    })
    .filter((t) => t.onDiskSeasons.length);
  const merged = new Map();
  for (const t of [
    ...fromSeries,
    ...decorateTitlesWithDiskSeasons(facts.libraryTitles || [], facts),
    ...decorateTitlesWithDiskSeasons(seerrTitles || [], facts),
  ]) {
    if (!t?.id) continue;
    const prev = merged.get(t.id);
    if (!prev) {
      merged.set(t.id, t);
      continue;
    }
    merged.set(t.id, {
      ...prev,
      ...t,
      ids: [...new Set([...(prev.ids || []), ...(t.ids || [])])],
      onDiskSeasons: [...new Set([...(prev.onDiskSeasons || []), ...(t.onDiskSeasons || [])])].sort((a, b) => a - b),
    });
  }
  return [...merged.values()];
}

export function honestifyRequests(rows, facts = {}) {
  return reconcileRequestRows(overlayPresence(expandTvSeasonRows(rows, facts), facts));
}

export function looksLikeTvName(name) {
  return /(?:[Ss]\d{1,2}|[Ss]eason[\s._-]*\d)/.test(String(name || ""));
}

export function missingArrRequests(series = [], movies = []) {
  const rows = [];
  for (const s of series || []) {
    const tmdb = s?.tmdbId;
    if (tmdb == null) continue;
    const added = Date.parse(s.added) || 0;
    const candidates = [];
    for (const season of s.seasons || []) {
      const n = Number(season?.seasonNumber);
      if (!Number.isFinite(n) || n <= 0) continue;
      const files = Number(season?.statistics?.episodeFileCount || 0);
      const monitored = season?.monitored !== false && s.monitored !== false;
      if (files > 0 || !monitored) continue;
      candidates.push(n);
    }
    const totalFiles = Number(s.statistics?.episodeFileCount || 0);
    // Whole show empty (TWD after wipe): only the first missing season — do not invent S02–S11.
    const emit = totalFiles > 0 ? candidates : candidates.slice(0, 1);
    for (const n of emit) {
      rows.push({
        id: `sonarr-${s.id}-s${n}`,
        titleId: titleIdFor("tv", tmdb),
        status: "downloading",
        progress: 0,
        season: n,
        createdAt: added,
        updatedAt: added || Date.now(),
        requester: "house",
        tmdb,
        mediaType: "tv",
        engine: "grabbing",
        source: "sonarr-missing",
      });
    }
  }
  for (const m of movies || []) {
    if (!m || m.tmdbId == null) continue;
    if (m.monitored === false) continue;
    const files = Number(m.statistics?.movieFileCount || 0);
    if (m.hasFile === true || files > 0) continue;
    const added = Date.parse(m.added) || 0;
    rows.push({
      id: `radarr-${m.id}`,
      titleId: titleIdFor("movie", m.tmdbId),
      status: "downloading",
      progress: 0,
      createdAt: added,
      updatedAt: added || Date.now(),
      requester: "house",
      tmdb: m.tmdbId,
      mediaType: "movie",
      engine: "grabbing",
      source: "radarr-missing",
    });
  }
  return rows;
}

export function seerrMediaGhostRows(mediaItems = []) {
  const rows = [];
  for (const media of mediaItems || []) {
    const mediaType = media?.mediaType === "tv" ? "tv" : media?.mediaType === "movie" ? "movie" : null;
    const tmdb = media?.tmdbId;
    if (!mediaType || tmdb == null) continue;
    const titleId = titleIdFor(mediaType, tmdb);
    if (mediaType === "tv") {
      const seasons = Array.isArray(media.seasons) ? media.seasons : [];
      const unfinished = seasons.filter((s) => {
        const n = Number(s?.seasonNumber);
        const st = Number(s?.status || 0);
        return Number.isFinite(n) && n > 0 && st !== 5 && st !== 0;
      });
      const targets = unfinished.length
        ? unfinished
        : Number(media.status) === 3 || Number(media.status) === 4
          ? [{ seasonNumber: undefined, status: media.status }]
          : [];
      for (const s of targets) {
        const season = s.seasonNumber == null ? undefined : Number(s.seasonNumber);
        const engine = mapSeerrStatus(media.status, null, seerrSeasonStatus(media, season));
        if (engine === "downloaded") continue;
        rows.push({
          id: `seerr-media-${media.id || tmdb}${season != null ? `-s${season}` : ""}`,
          titleId,
          status: engine === "failed" ? "failed" : engine === "queued" ? "waiting" : "downloading",
          progress: 0,
          season,
          createdAt: Date.parse(media.createdAt) || Date.now(),
          updatedAt: Date.parse(media.updatedAt) || Date.now(),
          requester: "house",
          tmdb,
          mediaType,
          engine: engine === "unknown" ? "grabbing" : engine,
          source: "seerr-media",
        });
      }
      continue;
    }
    const engine = mapSeerrStatus(media.status, null, 0);
    if (engine === "downloaded") continue;
    if (engine === "unknown") continue;
    rows.push({
      id: `seerr-media-${media.id || tmdb}`,
      titleId,
      status: engine === "failed" ? "failed" : engine === "queued" ? "waiting" : "downloading",
      progress: 0,
      createdAt: Date.parse(media.createdAt) || Date.now(),
      updatedAt: Date.parse(media.updatedAt) || Date.now(),
      requester: "house",
      tmdb,
      mediaType,
      engine,
      source: "seerr-media",
    });
  }
  return rows;
}

export function torrentRequests(torrents = [], { series = [], movies = [] } = {}) {
  const rows = [];
  const byStem = new Map();
  for (const s of series || []) {
    const stem = String(s?.title || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    if (stem.length >= 8 && s.tmdbId != null) byStem.set(stem, { mediaType: "tv", tmdb: s.tmdbId, title: s.title, id: s.id });
  }
  for (const m of movies || []) {
    const stem = String(m?.title || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    if (stem.length >= 8 && m.tmdbId != null) byStem.set(stem, { mediaType: "movie", tmdb: m.tmdbId, title: m.title, id: m.id });
  }
  for (const t of torrents || []) {
    const name = String(t?.name || t?.title || "");
    if (!name) continue;
    const stem = name.toLowerCase().replace(/[^a-z0-9]+/g, "").split(/(?:19|20)\d{2}|2160p|1080p|720p|webdl/)[0];
    let hit = null;
    if (stem.length >= 8) {
      for (const [k, v] of byStem) {
        if (k === stem || (stem.startsWith(k) && k.length >= 8) || (k.startsWith(stem) && stem.length >= 8)) {
          hit = v;
          break;
        }
      }
    }
    const cat = String(t?.category || "").toLowerCase();
    const tv = cat === "sonarr" || looksLikeTvName(name) || hit?.mediaType === "tv";
    if (!hit) continue;
    const hash = String(t.hash || t.infohash || t.infoHash || "").toLowerCase() || name;
    rows.push({
      id: `debrid-${hash.slice(0, 16)}`,
      titleId: titleIdFor(hit.mediaType, hit.tmdb),
      status: "downloading",
      progress: 0,
      season: tv && looksLikeTvName(name) ? Number((name.match(/[Ss](\d{1,2})/) || [])[1] || 0) || undefined : undefined,
      createdAt: Number(t.added_on || t.completion_on || 0) * (Number(t.added_on) > 1e12 ? 1 : 1000) || Date.now(),
      updatedAt: Date.now(),
      requester: "house",
      tmdb: hit.tmdb,
      mediaType: hit.mediaType,
      engine: "grabbing",
      source: "decypharr",
    });
  }
  return rows;
}

export function pipelineMovieGaps({ seerrRows = [], movies = [] } = {}) {
  const have = new Map(
    (movies || []).filter((m) => m && m.tmdbId != null).map((m) => [String(m.tmdbId), m]),
  );
  const missing = [];
  const orphans = [];
  const unmonitored = [];
  const seen = new Set();
  const take = (list, titleId) => {
    if (seen.has(titleId)) return;
    seen.add(titleId);
    list.push(titleId);
  };
  for (const row of seerrRows || []) {
    if (!row || row.status === "available" || row.engine === "downloaded") continue;
    const mediaType =
      row.mediaType === "tv" || String(row.titleId || "").startsWith("tmdb-tv-") ? "tv" : "movie";
    const tmdb = row.tmdb ?? row.tmdbId;
    if (mediaType !== "movie" || tmdb == null) continue;
    const titleId = `tmdb-${tmdb}`;
    const hit = have.get(String(tmdb));
    const files = Number(hit?.statistics?.movieFileCount || 0);
    const hasFile = hit?.hasFile === true || files > 0;
    if (!hit) take(orphans, titleId);
    else if (hasFile) continue;
    else if (hit.monitored === false) take(unmonitored, titleId);
    else take(missing, titleId);
  }
  return {
    radarrMissing: [...missing, ...orphans, ...unmonitored],
    radarrOrphans: orphans,
    radarrUnmonitored: unmonitored,
  };
}

export function buildPipeline({
  seerrRows = [],
  series = [],
  movies = [],
  torrents = [],
  dumps = {},
  catalog = [],
} = {}) {
  const missing = missingArrRequests(series, movies);
  const movieGaps = pipelineMovieGaps({ seerrRows, movies });
  const fuseTv = (catalog || []).filter(looksLikeTvName);
  return {
    seerr: (seerrRows || []).length,
    sonarrMissing: missing
      .filter((r) => r.mediaType === "tv")
      .map((r) => ({ titleId: r.titleId, season: r.season })),
    radarrMissing: movieGaps.radarrMissing.length ? movieGaps.radarrMissing : missing.filter((r) => r.mediaType === "movie").map((r) => r.titleId),
    radarrOrphans: movieGaps.radarrOrphans,
    radarrUnmonitored: movieGaps.radarrUnmonitored,
    dumps: {
      sonarr: Array.isArray(dumps.sonarr) ? dumps.sonarr.length : dumps.sonarr ?? -1,
      radarr: Array.isArray(dumps.radarr) ? dumps.radarr.length : dumps.radarr ?? -1,
    },
    fuse: Array.isArray(catalog) ? catalog.length : -1,
    fuseTv: fuseTv.length,
    decypharr: (torrents || []).length,
  };
}

export function mergeUnfinishedRows(seerrRows, extras, facts = {}) {
  const seerrKeys = new Set((seerrRows || []).map((r) => requestMatchKey(r)).filter(Boolean));
  const seerrPresent = seerrKeys.size > 0;
  const honest = honestifyRequests([...(seerrRows || []), ...(extras || [])], facts);
  // Do not invent a Requests row for a title that is already on the shelf when Seerr dropped it.
  // When Seerr has rows, do not invent a grabbing row for every 0-file *arr title.
  const kept = honest.filter((r) => {
    if (seerrKeys.has(requestMatchKey(r))) return true;
    if (seerrPresent && (r.source === "radarr-missing" || r.source === "sonarr-missing")) return false;
    return r.status !== "available" && r.engine !== "downloaded";
  });
  const tvWithSeason = new Set(
    kept
      .filter((r) => String(r.titleId || "").startsWith("tmdb-tv-") && r.season != null)
      .map((r) => r.titleId),
  );
  // Seerr media ghosts with no season duplicate S01/S03 cards (Expanse ×2).
  return kept.filter((r) => !tvWithSeason.has(r.titleId) || r.season != null);
}

/** True when the row would paint as tmdb-2059 instead of National Treasure. */
export function needsRequestTitle(row) {
  const name = String(row?.title || "").trim();
  const id = String(row?.titleId || "").trim();
  if (!name) return true;
  if (id && name === id) return true;
  return /^tmdb(-tv)?-\d+$/i.test(name);
}

const requestTitleCache = new Map();

export function clearRequestTitleCache() {
  requestTitleCache.clear();
}

/** Name inflight rows from Seerr movie/TV detail. Cached so Home polls do not fan out. */
export async function attachSeerrDetailTitles(rows, { seerrFetch, key, now = Date.now(), ttlMs = 10 * 60 * 1000, limit = 8 } = {}) {
  const out = (rows || []).map((row) => ({ ...row }));
  const titles = [];
  const jobs = [];
  const seen = new Set();
  for (const row of out) {
    if (row.status !== "waiting" && row.status !== "downloading") continue;
    if (!needsRequestTitle(row)) continue;
    const cached = requestTitleCache.get(row.titleId);
    if (cached && now - cached.at < ttlMs) {
      row.title = cached.title;
      if (cached.hit) titles.push(cached.hit);
      continue;
    }
    if (!row.titleId || seen.has(row.titleId) || jobs.length >= limit) continue;
    seen.add(row.titleId);
    jobs.push(row);
  }
  if (typeof seerrFetch === "function") {
    await Promise.all(
      jobs.map(async (row) => {
        const parsed = parseTitleId(row.titleId);
        if (!parsed?.tmdb) return;
        const path = parsed.mediaType === "tv" ? `/api/v1/tv/${parsed.tmdb}` : `/api/v1/movie/${parsed.tmdb}`;
        try {
          const r = await seerrFetch(path, { key, ms: 4000 });
          const hit = seerrSearchHit({ ...(r.json || {}), id: Number(parsed.tmdb), mediaType: parsed.mediaType }, parsed.mediaType);
          if (!hit?.title) return;
          requestTitleCache.set(row.titleId, { at: now, title: hit.title, hit });
        } catch {
          /* next poll */
        }
      }),
    );
  }
  for (const row of out) {
    const cached = requestTitleCache.get(row.titleId);
    if (cached?.title && needsRequestTitle(row)) {
      row.title = cached.title;
      if (cached.hit && !titles.some((t) => t.id === cached.hit.id)) titles.push(cached.hit);
    }
  }
  return { rows: out, titles };
}

/** Requests rows often have no Seerr title. Name them from *arr or a title map. */
export function attachRequestTitles(rows, facts = {}) {
  const extra = facts.titleById;
  return (rows || []).map((row) => {
    if (!row || !needsRequestTitle(row)) return row;
    const fromMap =
      extra && typeof extra.get === "function"
        ? extra.get(row.titleId)
        : extra && typeof extra === "object"
          ? extra[row.titleId]
          : "";
    if (fromMap) return { ...row, title: fromMap };
    const parsed = parseTitleId(row.titleId);
    if (!parsed?.tmdb) return row;
    const list = parsed.mediaType === "tv" ? facts.series : facts.movies;
    const hit = (list || []).find((x) => String(x?.tmdbId) === String(parsed.tmdb));
    return hit?.title ? { ...row, title: hit.title } : row;
  });
}

export function assembleRequestPayload(seerrRows, facts = {}, mediaItems = []) {
  const extras = [
    ...missingArrRequests(facts.series, facts.movies),
    ...seerrMediaGhostRows(mediaItems),
    ...torrentRequests(facts.torrents, { series: facts.series, movies: facts.movies }),
  ];
  return {
    requests: attachRequestTitles(mergeUnfinishedRows(seerrRows, extras, facts), facts),
    titles: mergeRequestListTitles([], facts),
    pipeline: buildPipeline({
      seerrRows,
      series: facts.series,
      movies: facts.movies,
      torrents: facts.torrents,
      dumps: facts.dumps,
      catalog: facts.catalog,
    }),
  };
}

export function seerrSearchHit(h, mediaTypeHint) {
  const mediaType = normalizeMediaType(h?.mediaType || h?.media_type || mediaTypeHint);
  if (!mediaType) return null;
  const tmdb = h?.id ?? h?.tmdbId ?? h?.mediaInfo?.tmdbId;
  if (!tmdb) return null;
  const title = String(h.title || h.name || "Untitled");
  const date = String(h.releaseDate || h.release_date || h.firstAirDate || h.first_air_date || "");
  const year = Number((date.match(/^(\d{4})/) || [])[1] || h.year || 0);
  const listed = realSeasonNumbers(h.mediaInfo?.seasons || h.seasons);
  const fromCount = Number(h.numberOfSeasons || 0);
  const seasons = mediaType === "tv" ? listed.length || (Number.isFinite(fromCount) && fromCount > 0 ? fromCount : undefined) : undefined;
  const id = titleIdFor(mediaType, tmdb);
  const tvdb = h.tvdbId ?? h.externalIds?.tvdbId ?? h.mediaInfo?.tvdbId;
  const ids = [id, mediaType === "tv" ? `tmdb-${tmdb}` : null, tvdb ? `tvdb-${tvdb}` : null].filter(Boolean);
  return {
    id,
    ids,
    kind: mediaType === "tv" ? "tv" : "movie",
    title,
    year,
    overview: String(h.overview || ""),
    poster: tmdbPoster(h.posterPath || h.poster_path || h.remotePoster),
    rating: Number(h.voteAverage || h.vote_average || 0),
    genres: Array.isArray(h.genres)
      ? h.genres.map((g) => (typeof g === "string" ? g : g?.name || "")).filter(Boolean)
      : [],
    maxQuality: "4k",
    popularity: Number(h.popularity || 50),
    seasons,
    seasonList: mediaType === "tv" && listed.length ? listed : undefined,
  };
}

/** TMDB collection/person ids are digits. tmdb-<n> is a movie namespace — do not reuse it here. */
export function tmdbNumericId(raw) {
  const s = String(raw ?? "").trim();
  if (!/^\d+$/.test(s)) return 0;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Real TMDB franchise on a movie detail. Missing/empty → no collection chip. Never invent from similar titles. */
export function collectionFromSeerrMovie(json) {
  const raw = json?.collection || json?.belongsToCollection || json?.belongs_to_collection || null;
  if (!raw || typeof raw !== "object") return null;
  const id = tmdbNumericId(raw.id);
  const name = String(raw.name || "").trim();
  if (!id || !name) return null;
  const poster = tmdbPoster(raw.posterPath || raw.poster_path);
  return { id, name, poster: poster || undefined };
}

export function seerrPersonHit(h) {
  const type = String(h?.mediaType || h?.media_type || "").toLowerCase();
  if (type !== "person") return null;
  const id = tmdbNumericId(h?.id);
  const name = String(h?.name || "").trim();
  if (!id || !name) return null;
  const poster = tmdbPoster(h.profilePath || h.profile_path);
  return {
    id,
    tmdbId: id,
    name,
    poster: poster || undefined,
    knownForDepartment: String(h.knownForDepartment || h.known_for_department || "Acting"),
  };
}

export function seerrCollectionHit(h) {
  const type = String(h?.mediaType || h?.media_type || "").toLowerCase();
  if (type !== "collection") return null;
  const id = tmdbNumericId(h?.id);
  const name = String(h?.name || h?.title || "").trim();
  if (!id || !name) return null;
  const poster = tmdbPoster(h.posterPath || h.poster_path);
  return { id, tmdbId: id, name, poster: poster || undefined };
}

export function mapSeerrPersonHits(json, { limit = 8 } = {}) {
  const hits = Array.isArray(json) ? json : json?.results || [];
  const out = [];
  for (const h of hits) {
    const p = seerrPersonHit(h);
    if (!p) continue;
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

export function mapSeerrCollectionHits(json, { limit = 8 } = {}) {
  const hits = Array.isArray(json) ? json : json?.results || [];
  const out = [];
  for (const h of hits) {
    const c = seerrCollectionHit(h);
    if (!c) continue;
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}

export function overlayLibraryOnTitle(title, libraryTitles) {
  if (!title) return title;
  const hit =
    findLibraryTitle(libraryTitles, title.id) ||
    (title.ids || []).map((id) => findLibraryTitle(libraryTitles, id)).find(Boolean) ||
    null;
  const attached = attachLibraryPresence(title, hit);
  return { ...attached, inLibrary: Boolean(hit) };
}

export function mapCollectionParts(parts, libraryTitles) {
  const out = [];
  for (const p of parts || []) {
    const hit = seerrSearchHit({ ...p, mediaType: p?.mediaType || p?.media_type || "movie" }, "movie");
    if (!hit) continue;
    out.push(overlayLibraryOnTitle(hit, libraryTitles));
  }
  return out;
}

export function mapCollectionDetail(json, libraryTitles) {
  const id = tmdbNumericId(json?.id);
  const name = String(json?.name || "").trim();
  if (!id || !name) return null;
  const parts = mapCollectionParts(json?.parts, libraryTitles);
  return {
    id,
    name,
    overview: String(json?.overview || ""),
    poster: tmdbPoster(json?.posterPath || json?.poster_path) || undefined,
    source: "tmdb",
    parts,
    onBox: parts.filter((p) => p.inLibrary).length,
  };
}

export function mapPersonCredits(creditsJson, libraryTitles, { limit = 48 } = {}) {
  const cast = Array.isArray(creditsJson?.cast)
    ? creditsJson.cast
    : Array.isArray(creditsJson)
      ? creditsJson
      : [];
  const mapped = [];
  const seen = new Set();
  for (const c of cast) {
    const hit = seerrSearchHit(c, c?.mediaType || c?.media_type);
    if (!hit || seen.has(hit.id)) continue;
    seen.add(hit.id);
    mapped.push(overlayLibraryOnTitle(hit, libraryTitles));
  }
  mapped.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
  return mapped.slice(0, limit);
}

export function mapPersonDetail(json, creditsJson, libraryTitles) {
  const id = tmdbNumericId(json?.id);
  const name = String(json?.name || "").trim();
  if (!id || !name) return null;
  const embedded = json?.combinedCredits || json?.combined_credits;
  const credits = mapPersonCredits(creditsJson || embedded, libraryTitles);
  return {
    id,
    name,
    biography: String(json?.biography || ""),
    poster: tmdbPoster(json?.profilePath || json?.profile_path) || undefined,
    knownForDepartment: String(json?.knownForDepartment || json?.known_for_department || "Acting"),
    credits,
    onBox: credits.filter((t) => t.inLibrary).length,
  };
}

/** POST /api/request body for a collection/filmography row. Person and collection ids never go here. */
export function requestBodyForTitle(title, season) {
  const id = String(title?.id || "");
  if (!id || id.startsWith("person-") || id.startsWith("collection-")) return null;
  const mediaType =
    title?.kind === "tv" || title?.kind === "anime" ? "tv" : id.startsWith("tmdb-tv-") ? "tv" : "movie";
  const tmdb =
    mediaType === "tv"
      ? id.startsWith("tmdb-tv-")
        ? tmdbNumericId(id.slice(8))
        : 0
      : id.startsWith("tmdb-") && !id.startsWith("tmdb-tv-")
        ? tmdbNumericId(id.slice(5))
        : 0;
  const payload = buildSeerrAddPayload({
    mediaType,
    tmdb,
    season: mediaType === "tv" ? season || 1 : undefined,
  });
  if (!payload) return null;
  return {
    titleId: id,
    title: title.title,
    mediaType,
    tmdb,
    season: mediaType === "tv" ? (Number(season) > 0 ? Number(season) : 1) : undefined,
  };
}

export function readStuckNotes() {
  try {
    if (existsSync("/var/lib/reelos/stuck-notes.json")) {
      const j = JSON.parse(readFileSync("/var/lib/reelos/stuck-notes.json", "utf8"));
      return j && typeof j === "object" ? j : {};
    }
  } catch {
    /* */
  }
  return {};
}

export function applyStuckNotes(row, notes) {
  if (!row?.titleId || !notes) return row;
  if (row.status === "available" || row.engine === "downloaded") return row;
  const note = notes[row.titleId];
  if (!note || note.status !== "failed") return row;
  return {
    ...row,
    status: "failed",
    engine: "failed",
    reason: note.reason || "Download stuck — cleared so TorBox is not re-added",
    progress: 0,
  };
}

export function requestIdentity(row) {
  const season = row?.season == null ? "" : String(row.season);
  return `${row?.titleId || ""}#${season}`;
}

const REQUEST_RANK = { available: 4, downloading: 3, waiting: 2, failed: 1 };

export function preferRequest(a, b) {
  const ra = REQUEST_RANK[a?.status] || 0;
  const rb = REQUEST_RANK[b?.status] || 0;
  if (rb !== ra) return rb > ra ? b : a;
  const ta = Number(a?.createdAt) || 0;
  const tb = Number(b?.createdAt) || 0;
  if (tb && ta && tb !== ta) return tb < ta ? b : a;
  return a;
}

/** One phone row per title+season. Keeps the furthest-along (or oldest) Seerr request. */
export function collapseDuplicateRequests(rows) {
  if (!Array.isArray(rows)) return [];
  const byKey = new Map();
  const order = [];
  for (const r of rows) {
    if (!r?.titleId) continue;
    const key = requestIdentity(r);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, r);
      order.push(key);
      continue;
    }
    byKey.set(key, preferRequest(prev, r));
  }
  return order.map((k) => byKey.get(k)).filter(Boolean);
}

/** Pick the Seerr request for this title/season. Never use reqs[0] for another season. */
export function pickSeerrRequestForTitle(reqs, { media, mediaType, season } = {}) {
  const list = Array.isArray(reqs) ? reqs : [];
  const type = mediaType === "tv" ? "tv" : "movie";
  const n = season == null || season === "" ? NaN : Number(season);
  const withMedia = (row) => ({
    ...row,
    type,
    media: { ...(media || {}), ...(row?.media || {}) },
  });
  if (type === "tv" && Number.isFinite(n) && n > 0) {
    const exact = list.find((r) => {
      const seasons = realSeasonNumbers(r?.seasons);
      return seasons.length === 1 && seasons[0] === n;
    });
    if (exact) return withMedia(exact);
    const any = list.find((r) => realSeasonNumbers(r?.seasons).includes(n));
    if (any) return withMedia(any);
    return { type, media: media || {}, seasons: [{ seasonNumber: n }] };
  }
  if (list[0]) return withMedia(list[0]);
  return { type, media: media || {} };
}

export function findExistingSeasonRequest(rows, { mediaType, tmdb, season } = {}) {
  const wantType = mediaType === "tv" ? "tv" : "movie";
  const wantTmdb = String(tmdb ?? "");
  const wantSeason = wantType === "tv" && season != null && season !== "" ? Number(season) : undefined;
  for (const raw of rows || []) {
    const rec = raw?.titleId ? raw : seerrRequestRow(raw, {});
    if (!rec?.titleId || String(rec.tmdb) !== wantTmdb) continue;
    if ((rec.mediaType || (String(rec.titleId).startsWith("tmdb-tv-") ? "tv" : "movie")) !== wantType) continue;
    if (wantType === "tv" && Number.isFinite(wantSeason)) {
      if (rec.season == null || Number(rec.season) !== wantSeason) continue;
    }
    if (rec.status === "failed") continue;
    return rec;
  }
  return null;
}

export function seerrRequestRow(r, notes) {
  const media = r?.media || {};
  const mediaType = r?.type === "tv" || media.mediaType === "tv" ? "tv" : "movie";
  const tmdb = media.tmdbId || r?.mediaId;
  const titleId = titleIdFor(mediaType, tmdb);
  const seasons = realSeasonNumbers(r?.seasons);
  const season = seasons.length === 1 ? seasons[0] : undefined;
  const engine = mapSeerrStatus(media.status, r?.status, seerrSeasonStatus(media, season));
  const status =
    engine === "downloaded"
      ? "available"
      : engine === "grabbing"
        ? "downloading"
        : engine === "failed"
          ? "failed"
          : "waiting";
  const info = media.mediaInfo || r?.mediaInfo || {};
  const title = String(info.title || info.originalTitle || r?.title || "").trim() || undefined;
  const row = {
    id: `seerr-${r?.id}`,
    titleId,
    title,
    status,
    progress: status === "available" ? 100 : 0,
    season,
    requestedSeasons: seasons.length > 1 ? seasons : undefined,
    createdAt: Date.parse(r?.createdAt) || Date.now(),
    updatedAt: Date.parse(r?.updatedAt) || Date.now(),
    requester: r?.requestedBy?.displayName || r?.requestedBy?.username || "house",
    tmdb,
    mediaType,
    engine,
  };
  return applyStuckNotes(row, notes === undefined ? readStuckNotes() : notes);
}

export async function seerrFetch(path, { key, method = "GET", body, ms = 20000 } = {}) {
  const headers = { Accept: "application/json" };
  if (key) headers["X-Api-Key"] = key;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(`${SEERR_ORIGIN}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ac.signal,
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(t);
  }
}
