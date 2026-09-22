import {
  seerrRequestRow,
  honestifyRequests,
  titleRequestSeasonPayload,
  pickSeerrRequestForTitle,
  findExistingSeasonRequest,
  buildSeerrAddPayload,
  seasonUnreleasedForRequest,
  parseTitleId,
  normalizeMediaType,
} from "../reelos-seerr.mjs";

/**
 * Request Service
 * Encapsulates media request status collection, validation, deletion/cancellation,
 * and dispatching to upstream Seerr and *arr engines.
 */

export function requestIdFromQuery(u) {
  return String(u.searchParams.get("id") || u.searchParams.get("titleId") || "").trim();
}

export function buildRequestStatusError(error, engine = "seerr") {
  return { status: "unknown", engine, error: String(error) };
}

export function validateIncomingRequest(body) {
  const tmdb = String(body.tmdb || body.tmdbId || "").trim();
  const tvdb = String(body.tvdb || body.tvdbId || "").trim();
  let titleId = String(body.titleId || body.data?.titleId || body.id || "").trim();
  if (!titleId && tmdb) {
    titleId = String(body.mediaType || "").toLowerCase() === "tv" ? `tmdb-tv-${tmdb}` : `tmdb-${tmdb}`;
  }
  if (!titleId && tvdb) {
    titleId = `tvdb-${tvdb}`;
  }
  const season = body.season ?? body.data?.season;
  const episode = body.episode ?? body.data?.episode;
  const mediaType = normalizeMediaType(body.mediaType);
  return { tmdb, tvdb, titleId, season, episode, mediaType, title: body.title, year: body.year, poster: body.poster };
}

export function isGuestPendingRequest(body) {
  const isGuest = Boolean(body.isGuest || String(body.requester || "").toLowerCase() === "guest");
  return isGuest && !body.approvedByHost;
}

export async function processRequestCancellation({
  body,
  cancelFn,
  seerrKey,
  seerrFetch,
  radarrKey,
  sonarrKey,
  fetchArr,
}) {
  const id = body.id || body.requestId || body.titleId;
  if (!id) {
    return { ok: false, error: "Request id or titleId is required", status: 400 };
  }
  const result = await cancelFn({
    id: body.id,
    titleId: body.titleId,
    tmdb: body.tmdb,
    tvdb: body.tvdb,
    mediaType: body.mediaType,
    season: body.season,
    seerrKey,
    seerrFetch,
    radarrKey,
    sonarrKey,
    fetchArr,
  });
  return { ok: result.ok !== false, status: 200, data: result };
}
