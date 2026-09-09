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
  if (season == null) return false;
  if (parsed.tmdb && index.seasonHasFile?.has(`tmdb:${parsed.tmdb}:${season}`)) return true;
  if (parsed.tvdb && index.seasonHasFile?.has(`tvdb:${parsed.tvdb}:${season}`)) return true;
  return false;
}

/**
 * Honest request status, no fake %:
 * 1. Seerr declined/failed → failed
 * 2. Seerr media or requested-season AVAILABLE (5) → available
 * 3. Jellyfin library hit (movie TMDB) → available
 * 4. Radarr hasFile / Sonarr season episodeFileCount > 0 → available
 * 5. Else processing/partial → downloading at progress 0
 * 6. Else pending/approved → waiting
 * Same titleId+season collapses to one row; a done sibling upgrades the rest.
 */
export function overlayPresence(rows, { libraryTitles = [], arrIndex = null, seerrMediaByTitleId = null } = {}) {
  const mediaOf = (row) => {
    if (!seerrMediaByTitleId) return null;
    if (typeof seerrMediaByTitleId.get === "function") return seerrMediaByTitleId.get(row.titleId) || null;
    return seerrMediaByTitleId[row.titleId] || null;
  };
  return (rows || []).map((row) => {
    if (!row) return row;
    if (row.status === "available" || row.engine === "downloaded") return markAvailable(row);
    const media = mediaOf(row);
    if (media) {
      const engine = mapSeerrStatus(media.status, null, seerrSeasonStatus(media, row.season));
      if (engine === "downloaded") return markAvailable(row);
    }
    if (libraryHit(row, libraryTitles)) return markAvailable(row);
    if (arrHasFile(row, arrIndex)) return markAvailable(row);
    return row;
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

export function seerrSearchHit(h, mediaTypeHint) {
  const rawType = h?.mediaType || mediaTypeHint;
  const mediaType = rawType === "tv" ? "tv" : rawType === "movie" ? "movie" : null;
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
