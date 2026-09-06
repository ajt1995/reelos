import { readFileSync, existsSync, appendFileSync, writeFileSync, openSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";

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

function tailscaleBin() {
  for (const p of ["/usr/bin/tailscale", "/usr/sbin/tailscale"]) {
    if (existsSync(p)) return p;
  }
  return null;
}

function tailscaleRunning() {
  const bin = tailscaleBin();
  if (!bin) return false;
  const r = spawnSync(bin, ["status"], { encoding: "utf8", timeout: 4000 });
  return r.status === 0;
}

function ipv4() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (!a || a.internal) continue;
      if (a.family === "IPv4" || a.family === 4) return a.address;
    }
  }
  return "";
}

function answers() {
  try {
    return JSON.parse(readFileSync("/var/lib/reelos/answers.json", "utf8"));
  } catch {
    return {};
  }
}

async function probe(url, ms = 2500) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, { signal: ac.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
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

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    return {};
  }
}

async function handleLookup(req, res) {
  const raw = req.url ?? "";
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
  send(res, 200, { titles, error });
}

async function handleBox(_req, res) {
  const a = answers();
  const ip = ipv4();
  const jfOk = await probe("http://127.0.0.1:8096/System/Info/Public");
  let tailscaleAuth = null;
  try {
    if (existsSync("/var/lib/reelos/tailscale-auth.url")) {
      tailscaleAuth = readFileSync("/var/lib/reelos/tailscale-auth.url", "utf8").trim() || null;
    }
  } catch {
    /* */
  }
  send(res, 200, {
    provisioned: existsSync("/var/lib/reelos/provisioned"),
    ipv4: ip,
    watch: ip ? `http://${ip}:8096` : "",
    jellyfin: jfOk
      ? { state: "green", detail: "Jellyfin is up" }
      : { state: "red", detail: "Can't start" },
    frontend: a.frontend || "jellyfin",
    access: a.access || "lan",
    adminName: a.adminName || "reelos",
    adminPassword: a.adminPassword || "reelos",
    tailscaleAuth,
    tailscaleInstalled: Boolean(tailscaleBin()),
    tailscaleUp: tailscaleRunning(),
  });
}

async function handleTailscaleInstall(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false, error: "POST only" });
    return;
  }
  const a = answers();
  a.access = "tailscale";
  try {
    writeFileSync("/var/lib/reelos/answers.json", JSON.stringify(a, null, 2) + "\n", { mode: 0o600 });
  } catch (e) {
    send(res, 500, { ok: false, error: String(e) });
    return;
  }
  const script = existsSync("/opt/reelos/bin/reelos-access.sh")
    ? "/opt/reelos/bin/reelos-access.sh"
    : "/opt/reelos/bin/reelos-access.sh";
  const log = "/var/lib/reelos/tailscale-install.log";
  const out = openSync(log, "a");
  spawn("bash", [script], { detached: true, stdio: ["ignore", out, out] }).unref();
  send(res, 200, { ok: true, started: true });
}

async function handleTailscaleCheck(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const up = tailscaleRunning();
  if (up) {
    try {
      const { unlinkSync } = await import("node:fs");
      if (existsSync("/var/lib/reelos/tailscale-auth.url")) unlinkSync("/var/lib/reelos/tailscale-auth.url");
    } catch {
      /* */
    }
  }
  send(res, 200, { ok: true, up, installed: Boolean(tailscaleBin()) });
}

async function handleIndexer(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false, error: "POST only" });
    return;
  }
  const body = await readBody(req);
  const name = String(body.name || "Indexer").trim();
  const url = String(body.url || "").trim();
  const key = String(body.key || "").trim();
  if (!url || !key) {
    send(res, 400, { ok: false, error: "Need URL and API key" });
    return;
  }
  const prow = xmlKey("/opt/reelos/compose/configs/prowlarr/config.xml");
  if (!prow) {
    send(res, 503, { ok: false, error: "Indexers engine not ready" });
    return;
  }
  try {
    const r = await fetch("http://127.0.0.1:9696/api/v1/indexer", {
      method: "POST",
      headers: { "X-Api-Key": prow, "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        enable: true,
        appProfileId: 1,
        protocol: "torrent",
        implementation: "Torznab",
        implementationName: "Torznab",
        configContract: "TorznabSettings",
        fields: [
          { name: "baseUrl", value: url },
          { name: "apiPath", value: "/api" },
          { name: "apiKey", value: key },
        ],
      }),
    });
    if (!r.ok) throw new Error(`prowlarr ${r.status}`);
    send(res, 200, { ok: true });
  } catch (e) {
    send(res, 500, { ok: false, error: String(e) });
  }
}

function versionKey(v) {
  return String(v || "0")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
}

function cmpVer(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d) return d;
  }
  return 0;
}

function localVersion() {
  try {
    if (existsSync("/opt/reelos/VERSION")) return readFileSync("/opt/reelos/VERSION", "utf8").trim();
  } catch {
    /* */
  }
  return "0";
}

async function handleUpdateCheck(_req, res) {
  const local = localVersion();
  const urls = [
    "https://raw.githubusercontent.com/ajt1995/reelos/main/channel.json",
    "https://raw.githubusercontent.com/ajt1995/reelos/v1.2.6/channel.json",
    "https://github.com/ajt1995/reelos/raw/main/channel.json",
    "https://cdn.jsdelivr.net/gh/ajt1995/reelos@main/channel.json",
  ];
  let best = null;
  let bestK = [];
  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: "no-store" });
      if (!r.ok) continue;
      const ch = await r.json();
      const k = versionKey(ch.version);
      if (!best || cmpVer(k, bestK) > 0) {
        best = ch;
        bestK = k;
      }
    } catch {
      /* */
    }
  }
  if (!best) {
    send(res, 200, { ok: false, local, remote: local, available: false, notes: [], error: "channel unreachable" });
    return;
  }
  send(res, 200, {
    ok: true,
    local,
    remote: best.version,
    notes: best.notes || [],
    available: best.version !== local,
  });
}

async function handleUpdateApply(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  try {
    const urls = [
      "https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh",
      "https://raw.githubusercontent.com/ajt1995/reelos/v1.2.6/daemon/reelos-update.sh",
    ];
    let body = "";
    for (const u of urls) {
      try {
        const r = await fetch(u, { cache: "no-store" });
        if (r.ok) {
          body = await r.text();
          break;
        }
      } catch {
        /* */
      }
    }
    if (!body.includes("ReelOS")) {
      send(res, 500, { ok: false, error: "could not download updater" });
      return;
    }
    writeFileSync("/tmp/reelos-update.sh", body, { mode: 0o755 });
    const log = openSync("/var/lib/reelos/ota.log", "a");
    spawn("bash", ["/tmp/reelos-update.sh", "apply"], { detached: true, stdio: ["ignore", log, log] }).unref();
    send(res, 200, { ok: true, started: true });
  } catch (e) {
    send(res, 500, { ok: false, error: String(e) });
  }
}

async function handleUpdateStatus(_req, res) {
  const running = spawnSync("pgrep", ["-f", "reelos-update.sh"], { encoding: "utf8" }).status === 0;
  let log = "";
  try {
    if (existsSync("/var/lib/reelos/ota.log")) {
      const t = readFileSync("/var/lib/reelos/ota.log", "utf8");
      log = t.trim().split("\n").slice(-8).join("\n");
    }
  } catch {
    /* */
  }
  send(res, 200, { ok: true, local: localVersion(), running, log });
}

export function reelosLookupPlugin() {
  return {
    name: "reelos-lookup",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathOnly = (req.url ?? "").split("?", 1)[0] ?? "";
        try {
          if (pathOnly === "/api/lookup") return void (await handleLookup(req, res));
          if (pathOnly === "/api/box") return void (await handleBox(req, res));
          if (pathOnly === "/api/indexer") return void (await handleIndexer(req, res));
          if (pathOnly === "/api/tailscale/install") return void (await handleTailscaleInstall(req, res));
          if (pathOnly === "/api/tailscale/check") return void (await handleTailscaleCheck(req, res));
          if (pathOnly === "/api/update/check") return void (await handleUpdateCheck(req, res));
          if (pathOnly === "/api/update/apply") return void (await handleUpdateApply(req, res));
          if (pathOnly === "/api/update/status") return void (await handleUpdateStatus(req, res));
        } catch (e) {
          send(res, 500, { error: String(e) });
          return;
        }
        next();
      });
    },
  };
}
