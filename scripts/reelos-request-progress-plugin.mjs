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
  seerrMediaGhostRows,
} from "./reelos-seerr.mjs";
import {
  kickArrRecover,
  listRecoverTargets,
  loadPresenceFacts,
} from "./reelos-request-status.mjs";

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

async function maybeRecover(u, facts) {
  const flag = String(u.searchParams.get("recover") || "");
  if (flag !== "1" && flag !== "true") return null;
  let seerrRows = [];
  const key = seerrApiKey();
  if (key) {
    try {
      const r = await seerrFetch("/api/v1/request?take=50&filter=all&sort=added", { key, ms: 15000 });
      const rows = Array.isArray(r.json) ? r.json : r.json?.results || [];
      seerrRows = rows.map((row) => seerrRequestRow(row)).filter((rec) => rec?.titleId);
    } catch {
      seerrRows = [];
    }
    try {
      const media = await seerrFetch("/api/v1/media?take=50&filter=all&sort=added", { key, ms: 12000 });
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
  if (!missing.length) return { recover: true, targets: 0, kicks: [] };
  const now = Date.now();
  if (recoverInFlight) return { recover: true, targets: missing.length, deferred: true, started: false };
  if (now - lastRecoverAt < RECOVER_COOLDOWN_MS) {
    return { recover: true, targets: missing.length, skipped: "cooldown" };
  }
  lastRecoverAt = now;
  recoverInFlight = true;
  void (async () => {
    try {
      for (const m of missing) {
        await kickArrRecover({ mediaType: m.mediaType, tmdb: m.tmdb, season: m.season });
      }
    } catch {
      /* next Home poll retries */
    } finally {
      recoverInFlight = false;
    }
  })();
  return { recover: true, targets: missing.length, deferred: true, started: true };
}

async function handleList(res, recoverNote = null) {
  const key = seerrApiKey();
  if (!key) {
    send(res, 200, { requests: [], titles: [], error: "Seerr has no API key yet" });
    return;
  }
  try {
    const r = await seerrFetch("/api/v1/request?take=50&filter=all&sort=added", { key, ms: 20000 });
    const rows = Array.isArray(r.json) ? r.json : r.json?.results || [];
    const requests = [];
    const need = [];
    for (const row of rows) {
      const rec = seerrRequestRow(row);
      if (!rec.titleId) continue;
      requests.push(rec);
      const parsed = parseTitleId(rec.titleId);
      if (parsed?.tmdb) need.push(parsed);
    }
    const details = await Promise.all(
      need.map(async (parsed) => {
        const path = parsed.mediaType === "tv" ? `/api/v1/tv/${parsed.tmdb}` : `/api/v1/movie/${parsed.tmdb}`;
        const d = await seerrFetch(path, { key, ms: 12000 });
        if (!d.ok || !d.json) return null;
        return {
          parsed,
          json: d.json,
          hit: seerrSearchHit({ ...d.json, id: Number(parsed.tmdb), mediaType: parsed.mediaType }, parsed.mediaType),
        };
      }),
    );
    const seerrMediaByTitleId = new Map();
    for (const d of details) {
      if (!d?.parsed?.tmdb) continue;
      const media = mediaFromDetail(d.json);
      if (media) {
        const titleId = d.parsed.mediaType === "tv" ? `tmdb-tv-${d.parsed.tmdb}` : `tmdb-${d.parsed.tmdb}`;
        seerrMediaByTitleId.set(titleId, media);
      }
    }
    const facts = await loadPresenceFacts();
    let mediaItems = [];
    try {
      const media = await seerrFetch("/api/v1/media?take=50&filter=all&sort=added", { key, ms: 12000 });
      mediaItems = Array.isArray(media.json) ? media.json : media.json?.results || [];
    } catch {
      mediaItems = [];
    }
    const titleById = new Map(
      details.map((d) => d?.hit).filter((h) => h?.id && h?.title).map((h) => [h.id, h.title]),
    );
    const assembled = assembleRequestPayload(requests, { ...facts, seerrMediaByTitleId, titleById }, mediaItems);
    send(res, 200, {
      requests: assembled.requests,
      titles: details.map((d) => d?.hit).filter(Boolean),
      engine: "seerr",
      pipeline: assembled.pipeline,
      ...(recoverNote ? { recover: recoverNote } : {}),
    });
  } catch (e) {
    send(res, 200, { requests: [], titles: [], error: String(e) });
  }
}

async function handleGet(req, res) {
  const u = new URL(req.url || "/", "http://reelos.local");
  const id = requestIdFromQuery(u);
  if (!id) {
    const facts = await loadPresenceFacts();
    const recoverNote = await maybeRecover(u, facts);
    if (recoverNote) await loadPresenceFacts({ force: true });
    return handleList(res, recoverNote);
  }
  const key = seerrApiKey();
  if (!key) {
    send(res, 200, { status: "unknown", engine: "seerr", error: "Seerr has no API key yet" });
    return;
  }
  const parsed = parseTitleId(id);
  if (!parsed?.tmdb) {
    send(res, 400, { status: "unknown", error: "Need a TMDB id from Discover" });
    return;
  }
  try {
    const path = parsed.mediaType === "tv" ? `/api/v1/tv/${parsed.tmdb}` : `/api/v1/movie/${parsed.tmdb}`;
    const r = await seerrFetch(path, { key, ms: 15000 });
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
    const facts = await loadPresenceFacts();
    const seerrMediaByTitleId = new Map([[mapped.titleId, media]]);
    const honest = honestifyRequests([mapped], { ...facts, seerrMediaByTitleId })[0] || mapped;
    const title = seerrSearchHit({ ...r.json, id: Number(parsed.tmdb), mediaType: parsed.mediaType }, parsed.mediaType);
    send(res, 200, {
      status: honest.engine || "unknown",
      engine: "seerr",
      title: title?.title,
      seasons: title?.seasons,
      seasonList: title?.seasonList,
      progress: honest.status === "available" ? 100 : honest.progress,
      reason: honest.reason,
      requestStatus: honest.status,
    });
  } catch (e) {
    send(res, 200, { status: "unknown", engine: "seerr", error: String(e) });
  }
}

export function reelosRequestProgressPlugin() {
  return {
    name: "reelos-request-progress",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathOnly = (req.url || "").split("?", 1)[0] || "";
        if (pathOnly !== "/api/request") return next();
        if ((req.method || "GET").toUpperCase() !== "GET") return next();
        try {
          await handleGet(req, res);
        } catch (e) {
          send(res, 500, { status: "unknown", error: String(e) });
        }
      });
    },
  };
}
