/** GET /api/episodes — own plugin so lookup-plugin siblings do not wipe the accordion. */
import { loadSeasonEpisodeList } from "./reelos-episodes.mjs";

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

export async function dispatchEpisodes(req, res) {
  const pathOnly = (req.url || "").split("?", 1)[0] || "";
  if (pathOnly !== "/api/episodes") return false;
  if ((req.method || "GET").toUpperCase() !== "GET") {
    send(res, 405, { ok: false, error: "GET only" });
    return true;
  }
  const u = new URL(req.url || "/", "http://reelos.local");
  const payload = await loadSeasonEpisodeList({
    titleId: String(u.searchParams.get("id") || "").trim(),
    season: u.searchParams.get("season"),
  });
  send(res, payload.ok === false ? 400 : 200, payload);
  return true;
}

function attach(server) {
  server.middlewares.use(async (req, res, next) => {
    try {
      if (await dispatchEpisodes(req, res)) return;
    } catch (e) {
      send(res, 500, { ok: false, error: String(e) });
      return;
    }
    next();
  });
}

export function reelosEpisodesPlugin() {
  return {
    name: "reelos-episodes",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
