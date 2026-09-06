import { readFileSync, existsSync, appendFileSync } from "node:fs";

function xmlKey(file) {
  if (!existsSync(file)) return null;
  const m = /<ApiKey>([^<]+)<\/ApiKey>/.exec(readFileSync(file, "utf8"));
  return m?.[1] ?? null;
}

function note(msg) {
  try {
    appendFileSync("/var/lib/reelos/lookup.log", `${new Date().toISOString()} ${msg}\n`);
  } catch {
    /* */
  }
}

function movieHit(h) {
  const tmdb = h.tmdbId ?? h.ids?.tmdb;
  if (!tmdb) return null;
  const genres = Array.isArray(h.genres)
    ? h.genres.map((g) => (typeof g === "string" ? g : g?.name || "")).filter(Boolean)
    : [];
  return {
    id: `tmdb-${tmdb}`,
    kind: "movie",
    title: String(h.title || "Untitled"),
    year: Number(h.year) || 0,
    overview: String(h.overview || ""),
    poster: String(h.remotePoster || ""),
    rating: Number(h.ratings?.tmdb?.value || 0),
    genres,
    maxQuality: "4k",
    popularity: 50,
  };
}

function seriesHit(h) {
  const tvdb = h.tvdbId;
  if (!tvdb) return null;
  return {
    id: `tvdb-${tvdb}`,
    kind: "tv",
    title: String(h.title || "Untitled"),
    year: Number(h.year) || 0,
    overview: String(h.overview || ""),
    poster: String(h.remotePoster || ""),
    rating: Number(h.ratings?.tmdb?.value || 0),
    genres: [],
    maxQuality: "4k",
    popularity: 50,
    seasons: Array.isArray(h.seasons) ? h.seasons.length : undefined,
  };
}

async function pull(url, key) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 45000);
  try {
    const res = await fetch(url, { headers: { "X-Api-Key": key }, signal: ac.signal });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export function reelosLookupPlugin() {
  return {
    name: "reelos-lookup",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const raw = req.url ?? "";
        const pathOnly = raw.split("?", 1)[0] ?? "";
        if (pathOnly !== "/api/lookup") {
          next();
          return;
        }
        const q = new URL(raw, "http://reelos.local").searchParams.get("q")?.trim() || "";
        const titles = [];
        let error = null;
        try {
          const rk = xmlKey("/opt/reelos/compose/configs/radarr/config.xml");
          const sk = xmlKey("/opt/reelos/compose/configs/sonarr/config.xml");
          note(`api q=${q} radarr=${rk ? "yes" : "NO"} sonarr=${sk ? "yes" : "NO"}`);
          if (q.length >= 2 && rk) {
            const hits = await pull(
              `http://127.0.0.1:7878/api/v3/movie/lookup?term=${encodeURIComponent(q)}`,
              rk,
            );
            for (const h of (hits || []).slice(0, 8)) {
              const t = movieHit(h);
              if (t) titles.push(t);
            }
            note(`radarr hits=${(hits || []).length} mapped=${titles.length}`);
          }
          if (q.length >= 2 && sk) {
            const hits = await pull(
              `http://127.0.0.1:8989/api/v3/series/lookup?term=${encodeURIComponent(q)}`,
              sk,
            );
            for (const h of (hits || []).slice(0, 6)) {
              const t = seriesHit(h);
              if (t) titles.push(t);
            }
          }
        } catch (e) {
          error = String(e?.name === "AbortError" || String(e).includes("abort") ? "Radarr timed out (45s)" : e);
          note(`err ${error}`);
        }
        res.statusCode = 200;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.setHeader("cache-control", "no-store");
        res.end(JSON.stringify({ titles, error }));
      });
    },
  };
}
