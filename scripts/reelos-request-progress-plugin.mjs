/** GET /api/request — Seerr + library + *arr hasFile. Registered before lookup. */
import {
  parseTitleId,
  seerrApiKey,
  seerrFetch,
  seerrRequestRow,
  seerrSearchHit,
  honestifyRequests,
  pickSeerrRequestForTitle,
  assembleRequestPayload,
  attachSeerrDetailTitles,
  seerrMediaGhostRows,
  resolveParsedTitle,
  attachTitleAliases,
  libraryHasTitle,
  onDiskSeasonsFor,
  titleIdFor,
  titleRequestSeasonPayload,
  findLibraryTitle,
  mergeRequestListTitles,
} from "./reelos-seerr.mjs";
import { LIBRARY_CACHE_FILE, readLibraryCacheFile } from "./reelos-library.mjs";
import {
  kickArrRecover,
  listRecoverTargets,
  loadPresenceFacts,
  spawnWireImport,
} from "./reelos-request-status.mjs";

const importedOnce = new Set();
function maybeImportAvailable(data) {
  const status = String(data?.status || "");
  const engine = String(data?.engine || "");
  const titleId = String(data?.titleId || "");
  if (!titleId || importedOnce.has(titleId)) return;
  if (status !== "available" && status !== "downloaded" && engine !== "downloaded") return;
  importedOnce.add(titleId);
  spawnWireImport();
}

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

function requestIdFromQuery(u) {
  const tmdb = String(u.searchParams.get("tmdb") || "").trim();
  const type = String(u.searchParams.get("type") || "").trim();
  let id = String(u.searchParams.get("id") || "").trim();
  if (!id && tmdb) id = type === "tv" ? `tmdb-tv-${tmdb}` : `tmdb-${tmdb}`;
  return id;
}

function mediaFromDetail(json) {
  return json?.mediaInfo || json?.media || null;
}

let recoverInFlight = false;
let lastRecoverAt = 0;
const RECOVER_COOLDOWN_MS = 120_000;

function maybeRecover(u) {
  const flag = String(u.searchParams.get("recover") || "");
  if (flag !== "1" && flag !== "true") return null;
  const now = Date.now();
  if (recoverInFlight) return { recover: true, deferred: true, started: false };
  if (now - lastRecoverAt < RECOVER_COOLDOWN_MS) {
    return { recover: true, skipped: "cooldown" };
  }
  lastRecoverAt = now;
  recoverInFlight = true;
  void (async () => {
    try {
      const facts = await loadPresenceFacts();
      let seerrRows = [];
      const key = seerrApiKey();
      if (key) {
        try {
          const r = await seerrFetch("/api/v1/request?take=100&filter=all&sort=added", { key, ms: 4000 });
          const rows = Array.isArray(r.json) ? r.json : r.json?.results || [];
          seerrRows = rows.map((row) => seerrRequestRow(row)).filter((rec) => rec?.titleId);
        } catch {
          seerrRows = [];
        }
        try {
          const media = await seerrFetch("/api/v1/media?take=100&filter=all&sort=added", { key, ms: 3000 });
          const mediaItems = Array.isArray(media.json) ? media.json : media.json?.results || [];
          seerrRows = [...seerrRows, ...seerrMediaGhostRows(mediaItems)];
        } catch {
          /* request rows still recover movie orphans */
        }
      }
      const missing = listRecoverTargets({
        series: facts?.series,
        movies: facts?.movies,
        seerrRows,
      });
      for (const m of missing) {
        await kickArrRecover({ mediaType: m.mediaType, tmdb: m.tmdb, season: m.season });
      }
    } catch {
      /* next Home poll retries */
    } finally {
      recoverInFlight = false;
    }
  })();
  return { recover: true, deferred: true, started: true };
}

export async function collectRequestList() {
  const key = seerrApiKey();
  if (!key) {
    return { requests: [], titles: [], error: "Seerr has no API key yet" };
  }
  try {
    const listedP = seerrFetch("/api/v1/request?take=100&filter=all&sort=added", { key, ms: 4000 });
    const factsP = loadPresenceFacts();
    const mediaP = seerrFetch("/api/v1/media?take=100&filter=all&sort=added", { key, ms: 3000 }).catch(() => ({ json: null }));
    const [listed, facts, media] = await Promise.all([listedP, factsP, mediaP]);
    const rows = Array.isArray(listed.json) ? listed.json : listed.json?.results || [];
    const requests = [];
    for (const row of rows) {
      const rec = seerrRequestRow(row);
      if (!rec.titleId) continue;
      requests.push(rec);
    }
    const mediaItems = Array.isArray(media.json) ? media.json : media.json?.results || [];
    const assembled = assembleRequestPayload(requests, facts, mediaItems);
    const filled = await attachSeerrDetailTitles(assembled.requests, { seerrFetch, key });
    return {
      requests: filled.rows,
      titles: mergeRequestListTitles(filled.titles, facts),
      engine: "seerr",
      pipeline: assembled.pipeline,
    };
  } catch (e) {
    return { requests: [], titles: [], error: String(e) };
  }
}

async function handleList(res, recoverNote = null) {
  const listed = await collectRequestList();
  send(res, 200, {
    ...listed,
    ...(recoverNote ? { recover: recoverNote } : {}),
  });
}

async function handleGet(req, res) {
  const u = new URL(req.url || "/", "http://reelos.local");
  const id = requestIdFromQuery(u);
  if (!id) {
    const recoverNote = maybeRecover(u);
    return handleList(res, recoverNote);
  }
  const key = seerrApiKey();
  if (!key) {
    send(res, 200, { status: "unknown", engine: "seerr", error: "Seerr has no API key yet" });
    return;
  }
  const fileTitles = readLibraryCacheFile(LIBRARY_CACHE_FILE)?.titles || [];
  let parsed = resolveParsedTitle(parseTitleId(id), { titles: fileTitles });
  let facts = null;
  if (!parsed?.tmdb) {
    facts = await loadPresenceFacts();
    parsed = resolveParsedTitle(parsed, { titles: facts.libraryTitles, series: facts.series, movies: facts.movies });
  }
  if (!parsed?.tmdb) {
    const titles = facts?.libraryTitles || fileTitles;
    const lib = findLibraryTitle(titles, id);
    const seasonRaw = u.searchParams.get("season");
    const season = seasonRaw != null && seasonRaw !== "" ? Number(seasonRaw) : undefined;
    if (lib || libraryHasTitle(titles, id)) {
      send(
        res,
        200,
        titleRequestSeasonPayload({
          id,
          season,
          parsed,
          facts: facts || { arrIndex: null },
          libraryTitles: titles,
          honest: { titleId: id, status: "unknown", engine: "unknown" },
          title: lib,
        }),
      );
      return;
    }
    send(res, 400, { status: "unknown", error: "Need a TMDB id from Discover" });
    return;
  }
  try {
    const path = parsed.mediaType === "tv" ? `/api/v1/tv/${parsed.tmdb}` : `/api/v1/movie/${parsed.tmdb}`;
    const r = await seerrFetch(path, { key, ms: 8000 });
    const media = mediaFromDetail(r.json) || {};
    const reqs = Array.isArray(media.requests) ? media.requests : [];
    const seasonRaw = u.searchParams.get("season");
    const season = seasonRaw != null && seasonRaw !== "" ? Number(seasonRaw) : undefined;
    const last = pickSeerrRequestForTitle(reqs, {
      media: { ...media, tmdbId: Number(parsed.tmdb) },
      mediaType: parsed.mediaType,
      season,
    });
    const mapped = seerrRequestRow({
      ...last,
      type: parsed.mediaType,
      media: { ...media, tmdbId: Number(parsed.tmdb), ...(last.media || {}) },
    });
    mapped.titleId = mapped.titleId || titleIdFor(parsed.mediaType, parsed.tmdb);
    if (season != null && Number.isFinite(season)) mapped.season = season;
    facts = facts || (await loadPresenceFacts());
    const seerrMediaByTitleId = new Map([[mapped.titleId, media]]);
    const honest = honestifyRequests([mapped], { ...facts, seerrMediaByTitleId })[0] || mapped;
    const diskSeasons = onDiskSeasonsFor(parsed, facts.arrIndex);
    const seasonOnDisk = season != null && diskSeasons.includes(Number(season));
    const title = attachTitleAliases(
      seerrSearchHit({ ...r.json, id: Number(parsed.tmdb), mediaType: parsed.mediaType }, parsed.mediaType),
      parsed,
    );
    maybeImportAvailable({
      status: seasonOnDisk ? "available" : honest.status,
      engine: seasonOnDisk ? "downloaded" : honest.engine,
      titleId: mapped.titleId,
    });
    send(
      res,
      200,
      titleRequestSeasonPayload({
        id,
        season,
        parsed,
        facts,
        libraryTitles: facts.libraryTitles || fileTitles,
        honest,
        title,
      }),
    );
  } catch (e) {
    send(res, 200, { status: "unknown", engine: "seerr", error: String(e) });
  }
}

export async function dispatchRequestGet(req, res) {
  const pathOnly = (req.url || "").split("?", 1)[0] || "";
  if (pathOnly !== "/api/request") return false;
  if ((req.method || "GET").toUpperCase() !== "GET") return false;
  await handleGet(req, res);
  return true;
}

function attachRequestGet(server) {
  server.middlewares.use(async (req, res, next) => {
    try {
      if (await dispatchRequestGet(req, res)) return;
    } catch (e) {
      send(res, 500, { status: "unknown", error: String(e) });
      return;
    }
    next();
  });
}

export function reelosRequestProgressPlugin() {
  return {
    name: "reelos-request-progress",
    configureServer: attachRequestGet,
    configurePreviewServer: attachRequestGet,
  };
}
