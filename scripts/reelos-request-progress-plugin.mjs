/** GET /api/request — Seerr + library + *arr hasFile. Registered before lookup. */
import { parseTitleId, seerrApiKey, seerrFetch, seerrRequestRow, seerrSearchHit, honestifyRequests } from "./reelos-seerr.mjs";
import { loadPresenceFacts } from "./reelos-request-status.mjs";

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

async function handleList(res) {
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
    const honest = honestifyRequests(requests, { ...facts, seerrMediaByTitleId });
    send(res, 200, {
      requests: honest,
      titles: details.map((d) => d?.hit).filter(Boolean),
      engine: "seerr",
    });
  } catch (e) {
    send(res, 200, { requests: [], titles: [], error: String(e) });
  }
}

async function handleGet(req, res) {
  const u = new URL(req.url || "/", "http://reelos.local");
  const id = requestIdFromQuery(u);
  if (!id) {
    return handleList(res);
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
    const last = reqs[0] || { media, type: parsed.mediaType };
    const mapped = seerrRequestRow({
      ...last,
      type: parsed.mediaType,
      media: { ...media, tmdbId: Number(parsed.tmdb) },
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
