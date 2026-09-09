/** Seerr/Jellyseerr helpers for /api/lookup and /api/request. */
import { existsSync, readFileSync } from "node:fs";

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
  return null;
}

export function titleIdFor(mediaType, tmdb) {
  if (tmdb == null || tmdb === "") return null;
  return mediaType === "tv" ? `tmdb-tv-${tmdb}` : `tmdb-${tmdb}`;
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

/** Map Seerr/TMDB search hits. No year filter — 2012–2016 titles stay in the list. */
export function mapSeerrSearchResults(hits, { q = "", limit = 16 } = {}) {
  const titles = [];
  for (const h of hits || []) {
    const mediaType = normalizeMediaType(h?.mediaType);
    if (!mediaType) continue;
    const t = seerrSearchHit(h, mediaType);
    if (!t) continue;
    titles.push(t);
    if (titles.length >= limit) break;
  }
  return rankLookupTitles(titles, q);
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

/** Popular/trending rows this box does not already have. Search stays on /api/lookup. */
export function mapSeerrDiscoverResults(hits, { mediaType, limit = 16, excludeIds } = {}) {
  const owned = excludeIds instanceof Set ? excludeIds : titleIdSet(excludeIds);
  const titles = [];
  for (const h of hits || []) {
    if (seerrAlreadyHave(h)) continue;
    const type = normalizeMediaType(h?.mediaType || mediaType);
    if (!type) continue;
    const t = seerrSearchHit(h, type);
    if (!t || owned.has(t.id)) continue;
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
    // Movies: JF item is watchable. TV: series-in-library is not season proof.
    return Boolean(wantMovie || (!wantTv && kind !== "tv"));
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

function sonarrDumpNamed(dumps, title) {
  const want = String(title || "").toLowerCase();
  if (!want) return false;
  return (dumps?.sonarr || []).some((n) => String(n || "").toLowerCase() === want);
}

/** Seerr requested a show, Sonarr has 0 files. Keep downloading@0, say why. */
export function tvRequestReason(row, { series, arrSeriesReady, dumps } = {}) {
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
  if (sonarrDumpNamed(dumps, hit.title)) return "Files linked — waiting for Sonarr import";
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
      const engine = mapSeerrStatus(media.status, null, seerrSeasonStatus(media, row.season));
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

export function honestifyRequests(rows, facts = {}) {
  return reconcileRequestRows(overlayPresence(rows, facts));
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
  return honest.filter((r) => {
    if (seerrKeys.has(requestMatchKey(r))) return true;
    if (seerrPresent && (r.source === "radarr-missing" || r.source === "sonarr-missing")) return false;
    return r.status !== "available" && r.engine !== "downloaded";
  });
}

export function assembleRequestPayload(seerrRows, facts = {}, mediaItems = []) {
  const extras = [
    ...missingArrRequests(facts.series, facts.movies),
    ...seerrMediaGhostRows(mediaItems),
    ...torrentRequests(facts.torrents, { series: facts.series, movies: facts.movies }),
  ];
  return {
    requests: mergeUnfinishedRows(seerrRows, extras, facts),
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
  const mediaType = normalizeMediaType(h?.mediaType || mediaTypeHint);
  if (!mediaType) return null;
  const tmdb = h?.id ?? h?.tmdbId ?? h?.mediaInfo?.tmdbId;
  if (!tmdb) return null;
  const title = String(h.title || h.name || "Untitled");
  const date = String(h.releaseDate || h.firstAirDate || "");
  const year = Number((date.match(/^(\d{4})/) || [])[1] || h.year || 0);
  const listed = realSeasonNumbers(h.mediaInfo?.seasons || h.seasons);
  const fromCount = Number(h.numberOfSeasons || 0);
  const seasons = mediaType === "tv" ? listed.length || (Number.isFinite(fromCount) && fromCount > 0 ? fromCount : undefined) : undefined;
  return {
    id: titleIdFor(mediaType, tmdb),
    kind: mediaType === "tv" ? "tv" : "movie",
    title,
    year,
    overview: String(h.overview || ""),
    poster: tmdbPoster(h.posterPath || h.remotePoster),
    rating: Number(h.voteAverage || 0),
    genres: Array.isArray(h.genres)
      ? h.genres.map((g) => (typeof g === "string" ? g : g?.name || "")).filter(Boolean)
      : [],
    maxQuality: "4k",
    popularity: Number(h.popularity || 50),
    seasons,
    seasonList: mediaType === "tv" && listed.length ? listed : undefined,
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
    if (wantType === "tv" && wantSeason && rec.season != null && Number(rec.season) !== wantSeason) continue;
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
  const row = {
    id: `seerr-${r?.id}`,
    titleId,
    status,
    progress: status === "available" ? 100 : 0,
    season,
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
