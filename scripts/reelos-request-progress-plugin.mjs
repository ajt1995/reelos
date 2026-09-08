/** GET /api/request with real Radarr/Sonarr queue progress (sizeleft). Registered before lookup. */
import { readFileSync } from "node:fs";

function xmlKey(file) {
  try {
    const xml = readFileSync(file, "utf8");
    const m = /<ApiKey>([^<]+)<\/ApiKey>/.exec(xml);
    return m?.[1] || "";
  } catch {
    return "";
  }
}

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

async function arrGet(url, key) {
  const res = await fetch(url, { headers: { "X-Api-Key": key }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

function queueProgress(item) {
  const size = Number(item?.size || 0);
  const left = Number(item?.sizeleft ?? item?.sizeLeft ?? NaN);
  if (size > 0 && Number.isFinite(left) && left >= 0) {
    return Math.max(0, Math.min(99, Math.round(((size - left) / size) * 100)));
  }
  return undefined;
}

function queueStatus(item) {
  const s = String(item?.status || "").toLowerCase();
  if (s.includes("fail") || s === "warning") return "failed";
  if (s.includes("download") || s === "downloading" || s === "paused") return "grabbing";
  return "queued";
}

async function handleGet(req, res) {
  const u = new URL(req.url || "/", "http://reelos.local");
  const tmdb = String(u.searchParams.get("tmdb") || "").trim();
  const tvdb = String(u.searchParams.get("tvdb") || "").trim();
  let id = String(u.searchParams.get("id") || "").trim();
  if (!id && tmdb) id = `tmdb-${tmdb}`;
  if (!id && tvdb) id = `tvdb-${tvdb}`;
  if (!id) {
    send(res, 400, { status: "unknown", error: "Need tmdb, tvdb, or id" });
    return;
  }
  try {
    if (id.startsWith("tmdb-")) {
      const rk = xmlKey("/opt/reelos/compose/configs/radarr/config.xml");
      if (!rk) {
        send(res, 200, { status: "unknown", engine: "radarr", error: "Movies engine has no API key" });
        return;
      }
      const movies = await arrGet(`http://127.0.0.1:7878/api/v3/movie?tmdbId=${encodeURIComponent(id.slice(5))}`, rk);
      const movie = Array.isArray(movies) ? movies[0] : null;
      if (!movie) {
        send(res, 200, { status: "unknown", engine: "radarr", error: "Not in Radarr" });
        return;
      }
      const queue = await arrGet("http://127.0.0.1:7878/api/v3/queue", rk);
      const records = Array.isArray(queue) ? queue : queue?.records || [];
      const q = records.find((x) => x.movieId === movie.id);
      let status = "queued";
      if (movie.hasFile) status = "downloaded";
      else if (q) status = queueStatus(q);
      const progress = status === "downloaded" ? 100 : q ? queueProgress(q) : undefined;
      send(res, 200, { status, engine: "radarr", title: movie.title, hasFile: Boolean(movie.hasFile), progress });
      return;
    }
    if (id.startsWith("tvdb-")) {
      const sk = xmlKey("/opt/reelos/compose/configs/sonarr/config.xml");
      if (!sk) {
        send(res, 200, { status: "unknown", engine: "sonarr", error: "TV engine has no API key" });
        return;
      }
      const series = await arrGet(`http://127.0.0.1:8989/api/v3/series?tvdbId=${encodeURIComponent(id.slice(5))}`, sk);
      const show = Array.isArray(series) ? series[0] : null;
      if (!show) {
        send(res, 200, { status: "unknown", engine: "sonarr", error: "Not in Sonarr" });
        return;
      }
      const queue = await arrGet("http://127.0.0.1:8989/api/v3/queue", sk);
      const records = Array.isArray(queue) ? queue : queue?.records || [];
      const q = records.find((x) => x.seriesId === show.id);
      let status = "queued";
      const files = Number(show.statistics?.episodeFileCount || 0);
      const pct = Number(show.statistics?.percentOfEpisodes || 0);
      if (files > 0 || pct === 100) status = "downloaded";
      else if (q) status = queueStatus(q);
      const progress =
        status === "downloaded"
          ? 100
          : q
            ? queueProgress(q)
            : Number.isFinite(pct)
              ? Math.max(0, Math.min(100, Math.round(pct)))
              : undefined;
      send(res, 200, {
        status,
        engine: "sonarr",
        title: show.title,
        episodeFileCount: files,
        percent: pct,
        progress,
      });
      return;
    }
    send(res, 400, { status: "unknown", error: "Need tmdb or tvdb id" });
  } catch (e) {
    send(res, 200, { status: "unknown", error: String(e) });
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
