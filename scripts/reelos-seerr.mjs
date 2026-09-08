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
export function mapSeerrStatus(mediaStatus, requestStatus) {
  const m = Number(mediaStatus || 0);
  const r = Number(requestStatus || 0);
  if (r === 4 || r === 3) return "failed";
  if (m === 5) return "downloaded";
  if (m === 3 || m === 4) return "grabbing";
  if (m === 2 || r === 1 || r === 2) return "queued";
  return "unknown";
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

export function seerrRequestRow(r) {
  const media = r?.media || {};
  const mediaType = r?.type === "tv" || media.mediaType === "tv" ? "tv" : "movie";
  const tmdb = media.tmdbId || r?.mediaId;
  const titleId = titleIdFor(mediaType, tmdb);
  const seasons = realSeasonNumbers(r?.seasons);
  const engine = mapSeerrStatus(media.status, r?.status);
  const status =
    engine === "downloaded"
      ? "available"
      : engine === "grabbing"
        ? "downloading"
        : engine === "failed"
          ? "failed"
          : "waiting";
  return {
    id: `seerr-${r?.id}`,
    titleId,
    status,
    progress: status === "available" ? 100 : 0,
    season: seasons.length === 1 ? seasons[0] : undefined,
    createdAt: Date.parse(r?.createdAt) || Date.now(),
    updatedAt: Date.parse(r?.updatedAt) || Date.now(),
    requester: r?.requestedBy?.displayName || r?.requestedBy?.username || "house",
    tmdb,
    mediaType,
    engine,
  };
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
