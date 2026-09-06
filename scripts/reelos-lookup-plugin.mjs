import { readFileSync, existsSync, appendFileSync, writeFileSync, openSync, mkdirSync } from "node:fs";
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

function tailnetName() {
  const bin = tailscaleBin();
  if (!bin) return null;
  const r = spawnSync(bin, ["status", "--json"], { encoding: "utf8", timeout: 4000 });
  if (r.status !== 0) return null;
  try {
    const j = JSON.parse(r.stdout || "{}");
    return j.CurrentTailnet?.Name || j.Self?.DNSName || null;
  } catch {
    return null;
  }
}

function tailscaleRunning() {
  const bin = tailscaleBin();
  if (!bin) return false;
  const r = spawnSync(bin, ["status"], { encoding: "utf8", timeout: 4000 });
  return r.status === 0;
}

function ipv4() {
  const skip = /^(docker|br-|veth|cni|flannel|virbr|lxc|lo)/;
  const prefer = [];
  const rest = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    if (skip.test(name)) continue;
    for (const a of list || []) {
      if (!a || a.internal) continue;
      if (!(a.family === "IPv4" || a.family === 4)) continue;
      if (a.address.startsWith("172.17.") || a.address.startsWith("172.18.") || a.address.startsWith("172.19.")) continue;
      if (/^(wl|en|eth|wlan)/.test(name)) prefer.push(a.address);
      else rest.push(a.address);
    }
  }
  return prefer[0] || rest[0] || "";
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
  const poster =
    String(h.remotePoster || "") ||
    String((h.images || []).find((i) => i?.coverType === "poster")?.remoteUrl || "");
  return {
    id: `tmdb-${tmdb}`,
    kind: "movie",
    title: String(h.title || "Untitled"),
    year: Number(h.year) || 0,
    overview: String(h.overview || ""),
    poster,
    rating: Number(h.ratings?.tmdb?.value || h.ratings?.imdb?.value || 0),
    genres,
    maxQuality: "4k",
    popularity: 50,
  };
}

function seriesHit(h) {
  const tvdb = h.tvdbId;
  if (!tvdb) return null;
  const poster =
    String(h.remotePoster || "") ||
    String((h.images || []).find((i) => i?.coverType === "poster")?.remoteUrl || "");
  return {
    id: `tvdb-${tvdb}`,
    kind: "tv",
    title: String(h.title || "Untitled"),
    year: Number(h.year) || 0,
    overview: String(h.overview || ""),
    poster,
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
    if (q.length >= 2 && !rk && !sk) {
      error = "Movies/TV engines have no API key yet";
    }
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

async function probeJson(url, ms = 3000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, json };
  } catch {
    return { ok: false, json: null };
  } finally {
    clearTimeout(t);
  }
}

async function jellyfinToken(user, password) {
  try {
    const r = await fetch("http://127.0.0.1:8096/Users/AuthenticateByName", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Emby-Authorization":
          'MediaBrowser Client="ReelOS", Device="ReelOS", DeviceId="reelos", Version="1.2.15"',
      },
      body: JSON.stringify({ Username: user, Pw: password }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return { token: j.AccessToken, id: j.User?.Id };
  } catch {
    return null;
  }
}

async function jellyfinState(ip) {
  const a = answers();
  const intent = a.intent || {};
  const lanUrl = ip ? `http://${ip}:8096/System/Info/Public` : null;
  const lan = lanUrl ? await probeJson(lanUrl) : { ok: false, json: null };
  if (!lan.ok) {
    const loop = await probeJson("http://127.0.0.1:8096/System/Info/Public");
    if (loop.ok) {
      return { state: "red", detail: "Jellyfin is only on localhost, not the LAN", libraries: [] };
    }
    return { state: "red", detail: "Jellyfin not on :8096", libraries: [] };
  }
  const auth = await jellyfinToken(a.adminName || "reelos", a.adminPassword || "reelos");
  if (!auth?.token) {
    return { state: "red", detail: "Jellyfin has no matching user/PIN", libraries: [] };
  }
  let names = [];
  try {
    const r = await fetch("http://127.0.0.1:8096/Library/VirtualFolders", {
      headers: { "X-Emby-Token": auth.token },
    });
    const folders = r.ok ? await r.json() : [];
    names = (Array.isArray(folders) ? folders : []).map((x) => String(x.Name || ""));
  } catch {
    names = [];
  }
  const need = [];
  if (intent.movies !== false) need.push("Movies");
  if (intent.tv || intent.anime) need.push("Shows");
  const missing = need.filter((n) => !names.includes(n));
  if (missing.length) {
    return { state: "red", detail: `Missing library ${missing.join(", ")}`, libraries: names };
  }
  return { state: "green", detail: `Jellyfin on http://${ip}:8096`, libraries: names };
}

function tailscaleAuthUrl() {
  try {
    if (existsSync("/var/lib/reelos/tailscale-auth.url")) {
      const t = readFileSync("/var/lib/reelos/tailscale-auth.url", "utf8").trim();
      if (t) return t;
    }
  } catch {
    /* */
  }
  try {
    if (existsSync("/var/lib/reelos/tailscale-install.log")) {
      const log = readFileSync("/var/lib/reelos/tailscale-install.log", "utf8");
      const m = log.match(/https:\/\/login\.tailscale\.com\/[^\s]+/);
      if (m) return m[0];
    }
  } catch {
    /* */
  }
  return null;
}

async function handleBox(_req, res) {
  const a = answers();
  const ip = ipv4();
  const jellyfin = await jellyfinState(ip);
  send(res, 200, {
    provisioned: existsSync("/var/lib/reelos/provisioned"),
    ipv4: ip,
    watch: ip ? `http://${ip}:8096` : "",
    ui: ip ? `http://${ip}` : "",
    jellyfin,
    frontend: a.frontend || "jellyfin",
    access: a.access || "lan",
    adminName: a.adminName || "reelos",
    adminPassword: a.adminPassword || "reelos",
    answers: a,
    tailscaleAuth: tailscaleAuthUrl(),
    tailscaleInstalled: Boolean(tailscaleBin()),
    tailscaleUp: tailscaleRunning(),
    tailnet: tailnetName(),
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
    spawnSync("systemctl", ["enable", "--now", "tailscaled"], { timeout: 8000 });
    try {
      const { unlinkSync } = await import("node:fs");
      if (existsSync("/var/lib/reelos/tailscale-auth.url")) unlinkSync("/var/lib/reelos/tailscale-auth.url");
    } catch {
      /* */
    }
  }
  send(res, 200, { ok: true, up, installed: Boolean(tailscaleBin()), tailnet: tailnetName() });
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
    send(res, 503, { ok: false, error: "Prowlarr has no API key" });
    return;
  }
  try {
    const ping = await fetch("http://127.0.0.1:9696/api/v1/system/status", {
      headers: { "X-Api-Key": prow },
    });
    if (!ping.ok) {
      send(res, 503, { ok: false, error: `Prowlarr not answering (${ping.status})` });
      return;
    }
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
    const text = await r.text();
    if (!r.ok) {
      send(res, 502, { ok: false, error: `Prowlarr ${r.status}: ${text.slice(0, 200)}` });
      return;
    }
    send(res, 200, { ok: true, engine: "prowlarr" });
  } catch (e) {
    send(res, 502, { ok: false, error: `Prowlarr ${e}` });
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

async function fetchGh(url) {
  const r = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "ReelOS-update", Accept: "application/vnd.github+json" },
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.text();
}

async function loadChannel() {
  const urls = [
    "https://raw.githubusercontent.com/ajt1995/reelos/main/channel.json",
    "https://github.com/ajt1995/reelos/raw/refs/heads/main/channel.json",
    "https://api.github.com/repos/ajt1995/reelos/contents/channel.json?ref=main",
  ];
  for (const u of urls) {
    try {
      const text = await fetchGh(u);
      if (u.includes("api.github.com")) {
        const meta = JSON.parse(text);
        if (!meta.content) continue;
        const decoded = Buffer.from(meta.content.replace(/\n/g, ""), "base64").toString("utf8");
        const ch = JSON.parse(decoded);
        otaNote(`channel ${ch.version} via api.github.com`);
        return ch;
      }
      const ch = JSON.parse(text);
      otaNote(`channel ${ch.version} via ${u}`);
      return ch;
    } catch (e) {
      otaNote(`miss ${u} ${e}`);
    }
  }
  return null;
}

function otaNote(msg) {
  try {
    appendFileSync("/var/lib/reelos/ota.log", `${new Date().toISOString()} ${msg}\n`);
  } catch {
    /* */
  }
}

async function handleUpdateCheck(_req, res) {
  const local = localVersion();
  const best = await loadChannel();
  if (!best) {
    send(res, 200, { ok: false, local, remote: local, available: false, notes: [], error: "channel unreachable" });
    return;
  }
  const newer = cmpVer(versionKey(best.version), versionKey(local)) > 0;
  send(res, 200, {
    ok: true,
    local,
    remote: best.version,
    notes: best.notes || [],
    available: newer,
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
      "https://github.com/ajt1995/reelos/raw/refs/heads/main/daemon/reelos-update.sh",
    ];
    let body = "";
    for (const u of urls) {
      try {
        const r = await fetch(u, { cache: "no-store", headers: { "User-Agent": "ReelOS-update" } });
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

async function arrGet(url, key) {
  return pull(url, key);
}

async function arrPost(url, key, body) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 45000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "X-Api-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok && res.status !== 400) throw new Error(`${res.status} ${text.slice(0, 240)}`);
    return { ok: res.ok || res.status === 400, status: res.status, json, text };
  } finally {
    clearTimeout(t);
  }
}

async function firstRoot(base, key, prefer) {
  const roots = await arrGet(`${base}/rootfolder`, key);
  const list = Array.isArray(roots) ? roots : [];
  const hit =
    list.find((r) => r.path === prefer) ||
    list.find((r) => r.path === "/mnt/symlinks") ||
    list.find((r) => r.path === "/symlinks") ||
    list[0];
  return hit?.path || prefer;
}

async function namedProfile(base, key) {
  const want =
    { "1080p": "HD-1080p", hybrid: "Ultra-HD", "4k": "Ultra-HD", custom: "Any" }[
      answers().quality || "hybrid"
    ] || "Ultra-HD";
  const qs = await arrGet(`${base}/qualityprofile`, key);
  const list = Array.isArray(qs) ? qs : [];
  return list.find((p) => p.name === want)?.id || list[0]?.id || 1;
}

function queueStatus(item) {
  const s = String(item?.status || "").toLowerCase();
  if (s.includes("fail") || s === "warning") return "failed";
  if (s.includes("download") || s === "downloading" || s === "paused") return "grabbing";
  return "queued";
}

async function handleRequestStatus(req, res) {
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
      const tmdbId = id.slice(5);
      const movies = await arrGet(`http://127.0.0.1:7878/api/v3/movie?tmdbId=${encodeURIComponent(tmdbId)}`, rk);
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
      send(res, 200, { status, engine: "radarr", title: movie.title, hasFile: Boolean(movie.hasFile) });
      return;
    }
    if (id.startsWith("tvdb-")) {
      const sk = xmlKey("/opt/reelos/compose/configs/sonarr/config.xml");
      if (!sk) {
        send(res, 200, { status: "unknown", engine: "sonarr", error: "TV engine has no API key" });
        return;
      }
      const tvdbId = id.slice(5);
      const series = await arrGet(
        `http://127.0.0.1:8989/api/v3/series?tvdbId=${encodeURIComponent(tvdbId)}`,
        sk,
      );
      const show = Array.isArray(series) ? series[0] : null;
      if (!show) {
        send(res, 200, { status: "unknown", engine: "sonarr", error: "Not in Sonarr" });
        return;
      }
      const queue = await arrGet("http://127.0.0.1:8989/api/v3/queue", sk);
      const records = Array.isArray(queue) ? queue : queue?.records || [];
      const q = records.find((x) => x.seriesId === show.id);
      let status = "queued";
      if (show.statistics?.percentOfEpisodes === 100) status = "downloaded";
      else if (q) status = queueStatus(q);
      send(res, 200, { status, engine: "sonarr", title: show.title });
      return;
    }
    send(res, 400, { status: "unknown", error: "Need tmdb or tvdb id" });
  } catch (e) {
    send(res, 200, { status: "unknown", error: String(e) });
  }
}

async function handleRequest(req, res) {
  if ((req.method || "GET").toUpperCase() === "GET") {
    return handleRequestStatus(req, res);
  }
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false, error: "POST only" });
    return;
  }
  const body = await readBody(req);
  const tmdb = String(body.tmdb || body.tmdbId || "").trim();
  const tvdb = String(body.tvdb || body.tvdbId || "").trim();
  let titleId = String(body.titleId || body.data?.titleId || body.id || "").trim();
  if (!titleId && tmdb) titleId = `tmdb-${tmdb}`;
  if (!titleId && tvdb) titleId = `tvdb-${tvdb}`;
  const season = body.season ?? body.data?.season;
  note(`request ${titleId} title=${body.title || ""}`);
  if (!titleId) {
    send(res, 400, { ok: false, error: "No title" });
    return;
  }
  try {
    if (titleId.startsWith("tmdb-")) {
      const rk = xmlKey("/opt/reelos/compose/configs/radarr/config.xml");
      if (!rk) {
        send(res, 503, { ok: false, error: "Movies engine has no API key" });
        return;
      }
      const tmdb = titleId.slice(5);
      const hits = await arrGet(
        `http://127.0.0.1:7878/api/v3/movie/lookup?term=${encodeURIComponent(`tmdb:${tmdb}`)}`,
        rk,
      );
      const movie = Array.isArray(hits) ? hits[0] : null;
      if (!movie) {
        send(res, 404, { ok: false, error: "Radarr did not find that TMDB id" });
        return;
      }
      const root = await firstRoot("http://127.0.0.1:7878/api/v3", rk, "/symlinks");
      const profileId = await namedProfile("http://127.0.0.1:7878/api/v3", rk);
      const added = await arrPost("http://127.0.0.1:7878/api/v3/movie", rk, {
        ...movie,
        qualityProfileId: movie.qualityProfileId || profileId,
        rootFolderPath: root,
        monitored: true,
        addOptions: { searchForMovie: true },
      });
      note(`radarr add ${added.status} root=${root}`);
      send(res, 200, { ok: true, engine: "radarr", added: added.ok, title: movie.title || titleId });
      return;
    }
    if (titleId.startsWith("tvdb-")) {
      const sk = xmlKey("/opt/reelos/compose/configs/sonarr/config.xml");
      if (!sk) {
        send(res, 503, { ok: false, error: "TV engine has no API key" });
        return;
      }
      const tvdb = titleId.slice(5);
      const hits = await arrGet(
        `http://127.0.0.1:8989/api/v3/series/lookup?term=${encodeURIComponent(`tvdb:${tvdb}`)}`,
        sk,
      );
      const series = Array.isArray(hits) ? hits[0] : null;
      if (!series) {
        send(res, 404, { ok: false, error: "Sonarr did not find that TVDB id" });
        return;
      }
      const root = await firstRoot("http://127.0.0.1:8989/api/v3", sk, "/symlinks");
      const profileId = await namedProfile("http://127.0.0.1:8989/api/v3", sk);
      const added = await arrPost("http://127.0.0.1:8989/api/v3/series", sk, {
        ...series,
        qualityProfileId: series.qualityProfileId || profileId,
        rootFolderPath: root,
        monitored: true,
        seasonFolder: true,
        addOptions: { searchForMissingEpisodes: true },
      });
      note(`sonarr add ${added.status} root=${root} season=${season ?? ""}`);
      send(res, 200, { ok: true, engine: "sonarr", added: added.ok, title: series.title || titleId });
      return;
    }
    send(res, 400, { ok: false, error: "That title is not from the movie/TV engines. Search again, then request." });
  } catch (e) {
    const error = String(e?.name === "AbortError" ? "Engine timed out" : e);
    note(`request err ${error}`);
    send(res, 500, { ok: false, error });
  }
}

async function handleDoctor(_req, res) {
  const script = [
    "/opt/reelos/bin/reelos-doctor.py",
    "/workspace/daemon/reelos-doctor.py",
  ].find((p) => existsSync(p));
  if (!script) {
    send(res, 200, { ok: true, live: false, version: localVersion(), checks: [] });
    return;
  }
  const r = spawnSync("python3", [script], { encoding: "utf8", timeout: 25000 });
  try {
    const parsed = JSON.parse(r.stdout || "{}");
    send(res, 200, {
      ok: true,
      live: true,
      version: parsed.version || localVersion(),
      checks: parsed.checks || [],
    });
  } catch {
    send(res, 200, { ok: false, live: false, version: localVersion(), checks: [], error: r.stderr || "doctor parse" });
  }
}

let termCwd = "/home/reelos";
let termOut = "";

async function handleTerminal(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  if (body.kill) {
    send(res, 200, { output: termOut, running: false, cwd: termCwd });
    return;
  }
  const command = String(body.command || "").trim();
  if (!command) {
    send(res, 200, { output: termOut, running: false, cwd: termCwd });
    return;
  }
  if (command === "cd" || command.startsWith("cd ")) {
    const dest = command === "cd" ? "/home/reelos" : command.slice(3).trim() || "/home/reelos";
    const r = spawnSync("bash", ["-lc", `cd ${JSON.stringify(termCwd)} && cd ${dest} && pwd`], {
      encoding: "utf8",
      timeout: 5000,
    });
    const next = (r.stdout || "").trim().split("\n").pop();
    if (r.status === 0 && next) termCwd = next;
    termOut += `$ ${command}\n${r.status === 0 ? next : r.stderr || "cd failed"}\n`;
    send(res, 200, { output: termOut, running: false, cwd: termCwd });
    return;
  }
  const r = spawnSync("bash", ["-lc", command], {
    cwd: existsSync(termCwd) ? termCwd : "/home/reelos",
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 1024 * 512,
    env: { ...process.env, HOME: "/home/reelos" },
  });
  termOut += `$ ${command}\n${r.stdout || ""}${r.stderr || ""}`;
  if (termOut.length > 200000) termOut = termOut.slice(-160000);
  send(res, 200, { output: termOut, running: false, cwd: termCwd });
}

async function handlePassword(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const current = String(body.current || "");
  const next = String(body.next || "");
  if (next.length < 4) {
    send(res, 400, { ok: false, error: "New PIN must be at least 4 characters" });
    return;
  }
  const a = answers();
  const have = String(a.adminPassword || "reelos");
  if (current !== have) {
    send(res, 403, { ok: false, error: "Current PIN does not match" });
    return;
  }
  a.adminPassword = next;
  try {
    mkdirSync("/var/lib/reelos", { recursive: true });
    writeFileSync("/var/lib/reelos/answers.json", JSON.stringify(a, null, 2) + "\n", { mode: 0o600 });
  } catch (e) {
    send(res, 500, { ok: false, error: String(e) });
    return;
  }
  let jellyfin = false;
  const auth = await jellyfinToken(a.adminName || "reelos", current);
  if (auth?.token && auth.id) {
    try {
      const r = await fetch(`http://127.0.0.1:8096/Users/${auth.id}/Password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Emby-Token": auth.token },
        body: JSON.stringify({ CurrentPw: current, NewPw: next }),
      });
      jellyfin = r.ok;
    } catch {
      jellyfin = false;
    }
  }
  const box = spawnSync("chpasswd", { input: `reelos:${next}\n`, encoding: "utf8", timeout: 5000 });
  send(res, 200, { ok: true, jellyfin, boxUser: box.status === 0 });
}

async function handleQuality(_req, res) {
  const want = answers().quality || "hybrid";
  const profile =
    { "1080p": "HD-1080p", hybrid: "Ultra-HD", "4k": "Ultra-HD", custom: "Any" }[want] || "Ultra-HD";
  const rk = xmlKey("/opt/reelos/compose/configs/radarr/config.xml");
  const sk = xmlKey("/opt/reelos/compose/configs/sonarr/config.xml");
  let radarr = null;
  let sonarr = null;
  try {
    if (rk) {
      const qs = await arrGet("http://127.0.0.1:7878/api/v3/qualityprofile", rk);
      const list = Array.isArray(qs) ? qs : [];
      radarr = list.find((p) => p.name === profile)?.name || null;
    }
    if (sk) {
      const qs = await arrGet("http://127.0.0.1:8989/api/v3/qualityprofile", sk);
      const list = Array.isArray(qs) ? qs : [];
      sonarr = list.find((p) => p.name === profile)?.name || null;
    }
  } catch (e) {
    send(res, 200, { wanted: want, profile, radarr, sonarr, error: String(e) });
    return;
  }
  send(res, 200, {
    wanted: want,
    profile,
    radarr,
    sonarr,
    error: rk || sk ? null : "no engine keys",
  });
}

async function handlePorts(_req, res) {
  let caddy = "";
  for (const p of ["/opt/reelos/compose/Caddyfile", "/workspace/install/compose/Caddyfile"]) {
    if (existsSync(p)) {
      caddy = readFileSync(p, "utf8");
      break;
    }
  }
  send(res, 200, {
    ui: 80,
    shell: 8080,
    jellyfin: 8096,
    caddyHas80: caddy.includes(":80"),
    caddyTo8080: caddy.includes("reverse_proxy 127.0.0.1:8080"),
  });
}

async function handleReset(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  if (process.env.REELOS_OTA === "1") {
    send(res, 409, { ok: false, error: "Reset does not run during OTA" });
    return;
  }
  const ota = spawnSync("pgrep", ["-f", "reelos-update.sh"], { encoding: "utf8" });
  if (ota.status === 0) {
    send(res, 409, { ok: false, error: "Reset does not run during OTA" });
    return;
  }
  const script = existsSync("/opt/reelos/bin/reelos-reset.sh")
    ? "/opt/reelos/bin/reelos-reset.sh"
    : existsSync("/workspace/daemon/reelos-reset.sh")
      ? "/workspace/daemon/reelos-reset.sh"
      : "/tmp/reelos-reset.sh";
  if (script === "/tmp/reelos-reset.sh") {
    writeFileSync(
      script,
      `#!/bin/bash
set -euo pipefail
if [ "\${REELOS_OTA:-}" = "1" ] || pgrep -f reelos-update.sh >/dev/null 2>&1; then exit 1; fi
ROOT=/opt/reelos; STATE=/var/lib/reelos
sleep 2
(cd "\$ROOT/compose" && docker compose down --remove-orphans) || true
rm -f "\$STATE/provisioned" "\$STATE/answers.json" "\$STATE/engine.json"
rm -rf "\$ROOT/compose/configs"
mkdir -p "\$ROOT/compose/configs"
systemctl restart reelos || true
`,
      { mode: 0o755 },
    );
  }
  mkdirSync("/var/lib/reelos", { recursive: true });
  const log = openSync("/var/lib/reelos/reset.log", "a");
  spawn("bash", [script], { detached: true, stdio: ["ignore", log, log] }).unref();
  send(res, 200, { ok: true, started: true });
}

async function handleLibrary(_req, res) {
  const a = answers();
  const auth = await jellyfinToken(a.adminName || "reelos", a.adminPassword || "reelos");
  if (!auth?.token) {
    send(res, 200, { titles: [], error: "Jellyfin has no matching user/PIN" });
    return;
  }
  try {
    const r = await fetch(
      "http://127.0.0.1:8096/Items?Recursive=true&IncludeItemTypes=Movie,Series&Fields=Overview,ProviderIds&ImageTypeLimit=1",
      { headers: { "X-Emby-Token": auth.token } },
    );
    if (!r.ok) {
      send(res, 200, { titles: [], error: `Jellyfin ${r.status}` });
      return;
    }
    const data = await r.json();
    const items = Array.isArray(data.Items) ? data.Items : [];
    const ip = ipv4();
    const titles = items.map((it) => {
      const tmdb = it.ProviderIds?.Tmdb;
      const tvdb = it.ProviderIds?.Tvdb;
      const kind = it.Type === "Series" ? "tv" : "movie";
      const id = tmdb ? `tmdb-${tmdb}` : tvdb ? `tvdb-${tvdb}` : `jf-${it.Id}`;
      const poster = ip && it.Id ? `http://${ip}:8096/Items/${it.Id}/Images/Primary` : "";
      return {
        id,
        kind,
        title: String(it.Name || "Untitled"),
        year: Number(it.ProductionYear) || 0,
        overview: String(it.Overview || ""),
        poster,
        jellyfinId: it.Id,
        maxQuality: "4k",
        popularity: 50,
        genres: [],
      };
    });
    send(res, 200, { titles, error: null });
  } catch (e) {
    send(res, 200, { titles: [], error: String(e) });
  }
}

async function handleDisks(_req, res) {
  const r = spawnSync("lsblk", ["-J", "-o", "NAME,SIZE,TYPE,MOUNTPOINT,MODEL,FSTYPE"], {
    encoding: "utf8",
    timeout: 8000,
  });
  let disks = [];
  try {
    const parsed = JSON.parse(r.stdout || "{}");
    disks = (parsed.blockdevices || [])
      .filter((d) => d.type === "disk")
      .map((d) => ({
        name: d.name,
        size: d.size,
        model: d.model || "",
        mount: d.mountpoint || (d.children || []).map((c) => c.mountpoint).find(Boolean) || "",
        os: Boolean(
          d.mountpoint === "/" || (d.children || []).some((c) => c.mountpoint === "/" || c.mountpoint === "/boot"),
        ),
      }));
  } catch {
    disks = [];
  }
  send(res, 200, { disks, error: r.status === 0 ? null : r.stderr || "lsblk failed" });
}

async function handleStorage(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const disk = String(body.disk || "").replace(/[^a-z0-9]/gi, "");
  if (!disk || disk === "nvme0n1") {
    send(res, 400, { ok: false, error: "Pick a data disk, not the OS disk" });
    return;
  }
  const dest = `/srv/media/${disk}`;
  if (dest === "/srv/media" || dest === "/") {
    send(res, 400, { ok: false, error: "Will not eat /srv/media" });
    return;
  }
  mkdirSync(dest, { recursive: true });
  const dev = existsSync(`/dev/${disk}1`) ? `/dev/${disk}1` : `/dev/${disk}`;
  const m = spawnSync("mount", [dev, dest], { encoding: "utf8", timeout: 15000 });
  send(res, 200, {
    ok: m.status === 0,
    dest,
    error: m.status === 0 ? null : (m.stderr || m.stdout || "mount failed").slice(0, 300),
  });
}

async function handleTranscode(_req, res) {
  const dri = existsSync("/dev/dri");
  const override = existsSync("/opt/reelos/compose/compose.override.yml");
  send(res, 200, {
    dri,
    override,
    hint: dri ? "VAAPI/QSV node present" : "No /dev/dri — CPU encode",
  });
}

function composeProfiles(a) {
  const p = ["indexers"];
  const intent = a.intent || {};
  if (intent.movies) p.push("movies");
  if (intent.tv || intent.anime) p.push("tv");
  if (intent.music) p.push("music");
  if (intent.movies || intent.tv || intent.anime) p.push("subtitles");
  if (a.frontend === "jellyfin" || a.frontend === "both") p.push("jellyfin");
  if (a.frontend === "plex" || a.frontend === "both") p.push("plex");
  if (a.source === "local-vpn") p.push("localvpn");
  else p.push("debrid");
  return p;
}

async function handleProvision(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false, simulated: false });
    return;
  }
  const answers = await readBody(req);
  const a = answers.answers || answers;
  const root = process.env.REELOS_ROOT || "/opt/reelos";
  const composeDir = existsSync(`${root}/compose/docker-compose.yml`)
    ? `${root}/compose`
    : "/workspace/install/compose";
  try {
    mkdirSync("/var/lib/reelos", { recursive: true, mode: 0o700 });
    mkdirSync(`${composeDir}/configs/decypharr`, { recursive: true });
    writeFileSync("/var/lib/reelos/answers.json", JSON.stringify(a, null, 2) + "\n", { mode: 0o600 });
    const profiles = composeProfiles(a).join(",");
    const envLines = [
      "PUID=1000",
      "PGID=1000",
      "TZ=UTC",
      `RD_API_KEY=${a.source === "local-vpn" ? "" : String(a.apiKey || "").trim()}`,
      `SOURCE=${a.source || "torbox"}`,
      `COMPOSE_PROFILES=${profiles}`,
      `PLEX_CLAIM=${String(a.plexClaim || "").trim()}`,
      `VPN_SERVICE_PROVIDER=${a.vpnProvider || "custom"}`,
    ];
    writeFileSync(`${composeDir}/.env`, envLines.join("\n") + "\n", { mode: 0o600 });
    if (a.source !== "local-vpn") {
      const provider =
        a.source === "torbox"
          ? "torbox"
          : a.source === "alldebrid"
            ? "alldebrid"
            : a.source === "premiumize"
              ? "premiumize"
              : "realdebrid";
      const cfg = {
        debrids: [
          {
            provider,
            name: provider,
            api_key: String(a.apiKey || "").trim(),
            folder: "/mnt/debrid",
            use_webdav: false,
          },
        ],
        qbittorrent: { download_folder: "/mnt/symlinks", categories: ["sonarr", "radarr", "lidarr"] },
        use_auth: false,
        log_level: "info",
        port: "8282",
      };
      writeFileSync(`${composeDir}/configs/decypharr/config.json`, JSON.stringify(cfg, null, 2) + "\n", {
        mode: 0o600,
      });
    }
  } catch (e) {
    send(res, 200, { ok: false, simulated: false, error: String(e) });
    return;
  }
  const up = spawnSync("docker", ["compose", "up", "-d"], {
    cwd: composeDir,
    env: { ...process.env, COMPOSE_PROFILES: composeProfiles(a).join(",") },
    encoding: "utf8",
    timeout: 180000,
  });
  if (up.status !== 0) {
    send(res, 200, {
      ok: false,
      simulated: false,
      error: (up.stderr || up.stdout || `compose ${up.status}`).slice(0, 400),
    });
    return;
  }
  const wire = existsSync(`${root}/bin/wire-engines.py`)
    ? `${root}/bin/wire-engines.py`
    : "/workspace/daemon/wire-engines.py";
  if (existsSync(wire)) {
    spawn("python3", [wire], { detached: true, stdio: "ignore" }).unref();
  }
  writeFileSync("/var/lib/reelos/provisioned", "1\n");
  send(res, 200, { ok: true, simulated: false });
}

async function handlePing(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const source = String(body.source || "");
  const key = String(body.key || "").trim();
  if (source === "local-vpn") {
    send(res, 200, { ok: true, message: "VPN path. No debrid key." });
    return;
  }
  if (key.length < 10) {
    send(res, 200, { ok: false, error: "Provider rejected this key." });
    return;
  }
  try {
    if (source === "real-debrid") {
      const r = await fetch("https://api.real-debrid.com/rest/1.0/user", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) {
        send(res, 200, { ok: false, error: `Real-Debrid ${r.status}` });
        return;
      }
      const j = await r.json();
      send(res, 200, { ok: true, message: `Real-Debrid ${j.username || "ok"}` });
      return;
    }
    if (source === "torbox") {
      const r = await fetch("https://api.torbox.app/v1/api/user/me", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) {
        send(res, 200, { ok: false, error: `TorBox ${r.status}` });
        return;
      }
      send(res, 200, { ok: true, message: "TorBox key accepted" });
      return;
    }
    if (source === "alldebrid") {
      const url = new URL("https://api.alldebrid.com/v4/user");
      url.searchParams.set("agent", "ReelOS");
      url.searchParams.set("apikey", key);
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const j = await r.json();
      if (j.status !== "success") {
        send(res, 200, { ok: false, error: "AllDebrid rejected this key." });
        return;
      }
      send(res, 200, { ok: true, message: `AllDebrid ${j.data?.user?.username || "ok"}` });
      return;
    }
    if (source === "premiumize") {
      const url = new URL("https://www.premiumize.me/api/account/info");
      url.searchParams.set("apikey", key);
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const j = await r.json();
      if (j.status !== "success") {
        send(res, 200, { ok: false, error: "Premiumize rejected this key." });
        return;
      }
      send(res, 200, { ok: true, message: "Premiumize key accepted" });
      return;
    }
    send(res, 200, { ok: false, error: "Unknown source." });
  } catch (e) {
    send(res, 200, { ok: false, error: String(e) });
  }
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
          if (pathOnly === "/api/request") return void (await handleRequest(req, res));
          if (pathOnly === "/api/password") return void (await handlePassword(req, res));
          if (pathOnly === "/api/quality") return void (await handleQuality(req, res));
          if (pathOnly === "/api/ports") return void (await handlePorts(req, res));
          if (pathOnly === "/api/doctor") return void (await handleDoctor(req, res));
          if (pathOnly === "/api/reset") return void (await handleReset(req, res));
          if (pathOnly === "/api/library") return void (await handleLibrary(req, res));
          if (pathOnly === "/api/disks") return void (await handleDisks(req, res));
          if (pathOnly === "/api/storage") return void (await handleStorage(req, res));
          if (pathOnly === "/api/transcode") return void (await handleTranscode(req, res));
          if (pathOnly === "/api/provision") return void (await handleProvision(req, res));
          if (pathOnly === "/api/ping") return void (await handlePing(req, res));
          if (pathOnly === "/api/terminal") return void (await handleTerminal(req, res));
        } catch (e) {
          send(res, 500, { error: String(e) });
          return;
        }
        next();
      });
    },
  };
}
