import { readFileSync, existsSync, appendFileSync, writeFileSync, openSync, mkdirSync, unlinkSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import {
  parseTitleId,
  seerrApiKey,
  seerrFetch,
  seerrListHits,
  seerrRequestRow,
  seerrSearchHit,
} from "./reelos-seerr.mjs";
import { downloadLegalBook, searchLegalBooks } from "./reelos-books.mjs";
import {
  createLibraryCache,
  createTokenCache,
  JELLYFIN_ITEMS_TIMEOUT_MS,
  LIBRARY_CACHE_FILE,
  libraryItemsUrl,
  mapJellyfinItem,
  readLibraryCacheFile,
  serveLibrary,
  writeLibraryCacheFile,
} from "./reelos-library.mjs";

const jellyfinTokens = createTokenCache();
const libraryCache = createLibraryCache();
const seeded = readLibraryCacheFile(LIBRARY_CACHE_FILE);
if (seeded) libraryCache.write(seeded.titles, { now: seeded.at, complete: seeded.complete });

function persistLibraryCache() {
  const entry = libraryCache.read();
  if (!entry) return;
  try {
    writeLibraryCacheFile(LIBRARY_CACHE_FILE, entry);
  } catch {
    /* */
  }
}

let libraryRefresh = null;
async function refreshLibraryFull(host) {
  if (libraryRefresh) return libraryRefresh;
  libraryRefresh = (async () => {
    const a = answers();
    const auth = await jellyfinToken(a.adminName || "reelos", a.adminPassword || "reelos");
    if (!auth?.token) return;
    const r = await fetch(libraryItemsUrl(), {
      headers: { "X-Emby-Token": auth.token },
      signal: AbortSignal.timeout(JELLYFIN_ITEMS_TIMEOUT_MS),
    });
    if (!r.ok) return;
    const data = await r.json();
    const items = Array.isArray(data.Items) ? data.Items : [];
    libraryCache.write(
      items.map((it) => mapJellyfinItem(it, host)),
      { complete: true },
    );
    persistLibraryCache();
  })()
    .catch(() => {})
    .finally(() => {
      libraryRefresh = null;
    });
  return libraryRefresh;
}

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

function tailscaleState() {
  const bin = tailscaleBin();
  const empty = {
    installed: false,
    up: false,
    state: "missing",
    auth: null,
    ip: null,
    dns: null,
    tailnet: null,
  };
  if (!bin) {
    try {
      if (existsSync("/var/lib/reelos/tailscale-auth.url")) {
        empty.auth = readFileSync("/var/lib/reelos/tailscale-auth.url", "utf8").trim() || null;
      }
    } catch {
      /* */
    }
    return empty;
  }
  const r = spawnSync(bin, ["status", "--json"], { encoding: "utf8", timeout: 8000 });
  let j = {};
  try {
    j = JSON.parse(r.stdout || "{}");
  } catch {
    j = {};
  }
  const backend = String(j.BackendState || "");
  const ips = j.Self?.TailscaleIPs || [];
  const ip = ips.find((x) => String(x).startsWith("100.")) || null;
  const dns = String(j.Self?.DNSName || "").replace(/\.$/, "") || null;
  const tailnet = j.CurrentTailnet?.Name || dns || null;
  let auth = String(j.AuthURL || "").trim() || null;
  if (!auth) {
    try {
      if (existsSync("/var/lib/reelos/tailscale-auth.url")) {
        auth = readFileSync("/var/lib/reelos/tailscale-auth.url", "utf8").trim() || null;
      }
    } catch {
      /* */
    }
  }
  const up = backend === "Running" && Boolean(ip);
  return { installed: true, up, state: backend || "NeedsLogin", auth: up ? null : auth, ip, dns, tailnet };
}

function tailnetName() {
  return tailscaleState().tailnet;
}

function tailscaleRunning() {
  return tailscaleState().up;
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
  const tvdb = h.tvdbId ?? h.ids?.tvdb;
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

async function pull(url, key, ms = 8000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
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

async function seerrTitleDetail(parsed) {
  if (!parsed?.tmdb) return null;
  const key = seerrApiKey();
  if (!key) return null;
  const path = parsed.mediaType === "tv" ? `/api/v1/tv/${parsed.tmdb}` : `/api/v1/movie/${parsed.tmdb}`;
  const r = await seerrFetch(path, { key, ms: 20000 });
  if (!r.ok || !r.json) return null;
  return seerrSearchHit({ ...r.json, id: Number(parsed.tmdb) || r.json.id, mediaType: parsed.mediaType }, parsed.mediaType);
}

async function handleLookup(req, res) {
  const raw = req.url ?? "";
  const u = new URL(raw, "http://reelos.local");
  const q = u.searchParams.get("q")?.trim() || "";
  const id = u.searchParams.get("id")?.trim() || "";
  const titles = [];
  let error = null;
  const key = seerrApiKey();
  note(`api q=${q} id=${id} seerr=${key ? "yes" : "NO"}`);
  if (!key) {
    error = "Request UI (Seerr) has no API key yet. Apply, then finish Seerr → Radarr/Sonarr/Jellyfin.";
    send(res, 200, { titles, error });
    return;
  }
  try {
    if (id) {
      const parsed = parseTitleId(id);
      const t = parsed ? await seerrTitleDetail(parsed) : null;
      if (t) titles.push(t);
      else error = "Seerr did not find that title";
      send(res, 200, { titles, error });
      return;
    }
    if (q.length < 2) {
      send(res, 200, { titles, error });
      return;
    }
    const r = await seerrFetch(`/api/v1/search?query=${encodeURIComponent(q)}`, { key, ms: 30000 });
    if (!r.ok) {
      error = `seerr ${r.status}`;
      note(`seerr search ${r.status}`);
      send(res, 200, { titles, error });
      return;
    }
    const kind = u.searchParams.get("kind")?.trim() || "";
    const hits = Array.isArray(r.json) ? r.json : r.json?.results || [];
    for (const h of hits) {
      if (h?.mediaType !== "movie" && h?.mediaType !== "tv") continue;
      if (kind === "movie" && h.mediaType !== "movie") continue;
      if (kind === "tv" && h.mediaType !== "tv") continue;
      const t = seerrSearchHit(h);
      if (t) titles.push(t);
      if (titles.length >= 16) break;
    }
    note(`seerr hits=${hits.length} titles=${titles.length}`);
  } catch (e) {
    error = `seerr ${e}`;
    note(`seerr ${e}`);
  }
  const qn = q.toLowerCase();
  titles.sort((a, b) => {
    const as = String(a?.title || "").toLowerCase();
    const bs = String(b?.title || "").toLowerCase();
    const ar = as === qn ? 0 : as.startsWith(qn) ? 1 : as.includes(qn) ? 2 : 3;
    const br = bs === qn ? 0 : bs.startsWith(qn) ? 1 : bs.includes(qn) ? 2 : 3;
    if (ar !== br) return ar - br;
    if (ar === 0 && a.kind !== b.kind) return a.kind === "movie" ? -1 : 1;
    return (Number(b?.year) || 0) - (Number(a?.year) || 0);
  });
  send(res, 200, { titles, error });
}

async function handleDiscover(req, res) {
  const raw = req.url ?? "";
  const u = new URL(raw, "http://reelos.local");
  const kind = u.searchParams.get("kind")?.trim() || "all";
  const key = seerrApiKey();
  const empty = { trending: [], movies: [], tv: [], error: null };
  if (!key) {
    send(res, 200, {
      ...empty,
      error: "Request UI (Seerr) has no API key yet. Apply, then finish Seerr → Radarr/Sonarr/Jellyfin.",
    });
    return;
  }
  try {
    const [trendingR, moviesR, tvR] = await Promise.all([
      seerrFetch("/api/v1/discover/trending", { key, ms: 25000 }),
      seerrFetch("/api/v1/discover/movies", { key, ms: 25000 }),
      seerrFetch("/api/v1/discover/tv", { key, ms: 25000 }),
    ]);
    const unavailable = [];
    if (!trendingR.ok) unavailable.push("trending");
    if (!moviesR.ok) unavailable.push("movies");
    if (!tvR.ok) unavailable.push("tv");
    const trending = trendingR.ok ? seerrListHits(trendingR.json) : [];
    const movies = moviesR.ok ? seerrListHits(moviesR.json, "movie") : [];
    const tv = tvR.ok ? seerrListHits(tvR.json, "tv") : [];
    const wantMovies = kind !== "tv";
    const wantTv = kind !== "movie";
    send(res, 200, {
      trending: kind === "all" ? trending : trending.filter((t) => t.kind === kind),
      movies: wantMovies ? movies : [],
      tv: wantTv ? tv : [],
      error: unavailable.length
        ? `Seerr discover missed ${unavailable.join(", ")} (${trendingR.status || moviesR.status || tvR.status})`
        : null,
    });
  } catch (e) {
    send(res, 200, { ...empty, error: `seerr ${e}` });
  }
}

async function handleBooks(req, res) {
  const method = (req.method || "GET").toUpperCase();
  if (method === "GET") {
    const raw = req.url ?? "";
    const u = new URL(raw, "http://reelos.local");
    const q = u.searchParams.get("q")?.trim() || "";
    try {
      const data = await searchLegalBooks(q);
      send(res, 200, data);
    } catch (e) {
      send(res, 200, { results: [], unavailable: [], error: String(e) });
    }
    return;
  }
  if (method !== "POST") {
    send(res, 405, { ok: false, error: "GET search or POST download" });
    return;
  }
  const body = await readBody(req);
  const book = body.book || body;
  const result = await downloadLegalBook(book);
  send(res, result.ok ? 200 : 400, result);
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

const JF_AUTH =
  'MediaBrowser Client="ReelOS", Device="ReelOS", DeviceId="reelos", Version="1.2.15"';

const JF_NETWORK_XML = `<?xml version="1.0" encoding="utf-8"?>
<NetworkConfiguration xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <EnableUPnP>false</EnableUPnP>
  <EnableIPv4>true</EnableIPv4>
  <EnableIPv6>false</EnableIPv6>
  <EnableRemoteAccess>true</EnableRemoteAccess>
  <RequireHttps>false</RequireHttps>
  <AutoDiscovery>true</AutoDiscovery>
  <EnablePublishedServerUriByRequest>true</EnablePublishedServerUriByRequest>
</NetworkConfiguration>
`;

function seedJellyfinNetworkXml(composeDir) {
  const dest = `${composeDir}/configs/jellyfin/config/network.xml`;
  try {
    mkdirSync(`${composeDir}/configs/jellyfin/config`, { recursive: true });
    if (existsSync(dest)) {
      const text = readFileSync(dest, "utf8");
      if (/<EnablePublishedServerUriByRequest>\s*true\s*</i.test(text)) return;
      if (text.includes("<EnablePublishedServerUriByRequest>")) {
        writeFileSync(
          dest,
          text.replace(
            /<EnablePublishedServerUriByRequest>[^<]*<\/EnablePublishedServerUriByRequest>/,
            "<EnablePublishedServerUriByRequest>true</EnablePublishedServerUriByRequest>",
          ),
        );
        return;
      }
      if (text.includes("</NetworkConfiguration>")) {
        writeFileSync(
          dest,
          text.replace(
            "</NetworkConfiguration>",
            "  <EnablePublishedServerUriByRequest>true</EnablePublishedServerUriByRequest>\n</NetworkConfiguration>",
          ),
        );
        return;
      }
    }
    writeFileSync(dest, JF_NETWORK_XML);
  } catch {
    /* */
  }
}

async function revealJellyfinAdmin(token, user) {
  try {
    let me = user;
    if (!me?.Id || !me.Policy) {
      const r = await fetch("http://127.0.0.1:8096/Users/Me", {
        headers: { "X-Emby-Token": token },
      });
      me = r.ok ? await r.json() : null;
    }
    if (!me?.Id || !me.Policy || typeof me.Policy !== "object") return;
    if (me.Policy.IsHidden === false) return;
    await fetch(`http://127.0.0.1:8096/Users/${me.Id}/Policy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Emby-Token": token },
      body: JSON.stringify({ ...me.Policy, IsHidden: false }),
    });
  } catch {
    /* */
  }
}

async function jellyfinToken(user, password) {
  const cached = jellyfinTokens.get(user, password);
  if (cached) return cached;
  try {
    const r = await fetch("http://127.0.0.1:8096/Users/AuthenticateByName", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: JF_AUTH,
        "X-Emby-Authorization": JF_AUTH,
      },
      body: JSON.stringify({ Username: user, Pw: password }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const auth = { token: j.AccessToken, id: j.User?.Id };
    if (auth.token) void revealJellyfinAdmin(auth.token, j.User);
    jellyfinTokens.set(user, password, auth);
    return auth;
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
  if (intent.tv !== false || intent.anime) need.push("Shows");
  const missing = need.filter((n) => !names.includes(n));
  if (missing.length) {
    return { state: "red", detail: `Missing library ${missing.join(", ")}`, libraries: names };
  }
  return { state: "green", detail: `Jellyfin on http://${ip}:8096`, libraries: names };
}

function saveAuthUrl(url) {
  if (!url) return;
  try {
    mkdirSync("/var/lib/reelos", { recursive: true });
    writeFileSync("/var/lib/reelos/tailscale-auth.url", `${url}\n`, { mode: 0o644 });
  } catch {
    /* */
  }
}

function grabLoginUrl(bin) {
  const st = tailscaleState();
  if (st.auth) return st.auth;
  const r = spawnSync(bin, ["login", "--timeout=20s"], { encoding: "utf8", timeout: 25000 });
  const blob = `${r.stdout || ""}\n${r.stderr || ""}`;
  const m = blob.match(/https:\/\/login\.tailscale\.com\/[^\s]+/);
  if (m) {
    saveAuthUrl(m[0]);
    return m[0];
  }
  const up = spawnSync(bin, ["up", "--timeout=12s"], { encoding: "utf8", timeout: 20000 });
  const blob2 = `${up.stdout || ""}\n${up.stderr || ""}`;
  const m2 = blob2.match(/https:\/\/login\.tailscale\.com\/[^\s]+/);
  if (m2) {
    saveAuthUrl(m2[0]);
    return m2[0];
  }
  return tailscaleState().auth;
}

function tailscaleAuthUrl() {
  return tailscaleState().auth;
}

async function handleBox(_req, res) {
  const a = answers();
  const ip = ipv4();
  const jellyfin = await jellyfinState(ip);
  const ts = tailscaleState();
  send(res, 200, {
    provisioned: existsSync("/var/lib/reelos/provisioned"),
    provisioning: existsSync("/var/lib/reelos/provisioning"),
    provisionError: existsSync("/var/lib/reelos/provision.error")
      ? readFileSync("/var/lib/reelos/provision.error", "utf8").trim()
      : "",
    ipv4: ip,
    watch: ip ? `http://${ip}:8096` : "",
    seerr: ip ? `http://${ip}:5055` : "",
    ui: ip ? `http://${ip}` : "",
    jellyfin,
    frontend: a.frontend || "jellyfin",
    access: a.access || "lan",
    adminName: a.adminName || "reelos",
    adminPassword: a.adminPassword || "reelos",
    answers: a,
    tailscaleAuth: ts.auth,
    tailscaleInstalled: ts.installed,
    tailscaleUp: ts.up,
    tailscaleIp: ts.ip,
    tailscaleDns: ts.dns,
    tailscaleState: ts.state,
    tailnet: ts.tailnet,
  });
}

async function handleTailscaleLogin(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false, error: "POST only" });
    return;
  }
  const a = answers();
  a.access = "tailscale";
  try {
    mkdirSync("/var/lib/reelos", { recursive: true });
    writeFileSync("/var/lib/reelos/answers.json", JSON.stringify(a, null, 2) + "\n", { mode: 0o600 });
  } catch (e) {
    send(res, 500, { ok: false, error: String(e) });
    return;
  }
  let bin = tailscaleBin();
  if (!bin) {
    const log = "/var/lib/reelos/tailscale-install.log";
    const out = openSync(log, "a");
    spawn("bash", ["-lc", "curl -fsSL https://tailscale.com/install.sh | sh"], {
      detached: true,
      stdio: ["ignore", out, out],
    }).unref();
    send(res, 200, { ok: true, started: true, installed: false, up: false, auth: null });
    return;
  }
  spawnSync("systemctl", ["enable", "--now", "tailscaled"], { timeout: 8000 });
  const st = tailscaleState();
  if (st.up) {
    send(res, 200, { ok: true, installed: true, up: true, ip: st.ip, dns: st.dns, tailnet: st.tailnet, auth: null });
    return;
  }
  const url = grabLoginUrl(bin);
  send(res, 200, { ok: true, installed: true, up: false, auth: url, state: tailscaleState().state });
}

async function handleTailscaleInstall(req, res) {
  return handleTailscaleLogin(req, res);
}

async function handleTailscaleCheck(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  spawnSync("systemctl", ["enable", "--now", "tailscaled"], { timeout: 8000 });
  const st = tailscaleState();
  if (st.up) {
    try {
      spawnSync("rm", ["-f", "/var/lib/reelos/tailscale-auth.url"]);
    } catch {
      /* */
    }
  }
  send(res, 200, {
    ok: true,
    up: st.up,
    installed: st.installed,
    ip: st.ip,
    dns: st.dns,
    tailnet: st.tailnet,
    auth: st.auth,
    state: st.state,
  });
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
    if (existsSync("/var/lib/reelos/installed-version")) {
      return readFileSync("/var/lib/reelos/installed-version", "utf8").trim() || "0";
    }
    if (existsSync("/opt/reelos/VERSION")) return readFileSync("/opt/reelos/VERSION", "utf8").trim();
  } catch {
    /* */
  }
  return "0";
}

async function fetchGh(url) {
  const accept = url.includes("/commits/") ? "application/vnd.github+json" : "application/vnd.github.raw";
  const r = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "ReelOS-update", Accept: accept },
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.text();
}

async function loadChannel() {
  const urls = [
    "https://api.github.com/repos/ajt1995/reelos/contents/channel.json?ref=main",
    "https://github.com/ajt1995/reelos/raw/refs/heads/main/channel.json",
    "https://raw.githubusercontent.com/ajt1995/reelos/main/channel.json",
  ];
  for (const u of urls) {
    try {
      const text = await fetchGh(u);
      const payload = text.trim().startsWith("{") ? text : null;
      let ch = null;
      if (payload) {
        const parsed = JSON.parse(payload);
        if (parsed.version) ch = parsed;
        else if (parsed.content) {
          const decoded = Buffer.from(String(parsed.content).replace(/\n/g, ""), "base64").toString("utf8");
          ch = JSON.parse(decoded);
        }
      }
      if (ch && ch.version) {
        otaNote(`channel ${ch.version} via ${u}`);
        return ch;
      }
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
  let head = "";
  try {
    const t = await fetchGh("https://api.github.com/repos/ajt1995/reelos/commits/main");
    const j = JSON.parse(t);
    head = String(j.sha || "");
  } catch {
    /* */
  }
  let applied = "";
  try {
    if (existsSync("/var/lib/reelos/applied-sha")) applied = readFileSync("/var/lib/reelos/applied-sha", "utf8").trim();
  } catch {
    /* */
  }
  const shaDrift = Boolean(head) && head !== applied;
  const notes = shaDrift && !newer
    ? [`Code update on ${best.version} (${head.slice(0, 12)})`]
    : best.notes || [];
  send(res, 200, {
    ok: true,
    local,
    remote: best.version,
    notes,
    available: newer || shaDrift,
    sha: head.slice(0, 12),
  });
}

async function handleUpdateApply(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const st0 = spawnSync("systemctl", ["is-active", "reelos-ota"], { encoding: "utf8" }).stdout.trim();
  if (st0 === "active" || st0 === "activating") {
    send(res, 409, { ok: false, error: "Update already running", already: true });
    return;
  }
  try {
    const urls = [
      "https://api.github.com/repos/ajt1995/reelos/contents/daemon/reelos-update.sh?ref=main",
      "https://github.com/ajt1995/reelos/raw/refs/heads/main/daemon/reelos-update.sh",
      "https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh",
    ];
    let body = "";
    for (const u of urls) {
      try {
        const r = await fetch(u, {
          cache: "no-store",
          headers: { "User-Agent": "ReelOS-update", Accept: "application/vnd.github.raw" },
        });
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
    mkdirSync("/var/lib/reelos", { recursive: true });
    writeFileSync("/var/lib/reelos/update-apply.sh", body, { mode: 0o755 });
    writeFileSync(
      "/etc/systemd/system/reelos-ota.service",
      `[Unit]
Description=ReelOS OTA
After=network-online.target

[Service]
Type=oneshot
TimeoutStartSec=infinity
KillMode=mixed
Environment=REELOS_OTA_UNIT=1
Environment=REELOS_ROOT=/opt/reelos
Environment=PYTHONUNBUFFERED=1
StandardOutput=append:/var/lib/reelos/ota.log
StandardError=append:/var/lib/reelos/ota.log
ExecStart=/bin/bash /var/lib/reelos/update-apply.sh apply
`,
    );
    spawnSync("systemctl", ["daemon-reload"], { encoding: "utf8" });
    const st = spawnSync("systemctl", ["is-active", "reelos-ota"], { encoding: "utf8" }).stdout.trim();
    if (st === "active" || st === "activating") {
      send(res, 200, { ok: true, started: true, already: true });
      return;
    }
    spawnSync("systemctl", ["reset-failed", "reelos-ota"], { encoding: "utf8" });
    const run = spawnSync("systemctl", ["start", "--no-block", "reelos-ota"], { encoding: "utf8" });
    if (run.status !== 0) {
      send(res, 500, { ok: false, error: (run.stderr || run.stdout || "could not start reelos-ota").slice(0, 160) });
      return;
    }
    spawnSync("sleep", ["2"], { encoding: "utf8" });
    const st2 = spawnSync("systemctl", ["is-active", "reelos-ota"], { encoding: "utf8" }).stdout.trim();
    if (st2 === "failed") {
      const j = spawnSync("journalctl", ["-u", "reelos-ota", "-n", "15", "--no-pager"], { encoding: "utf8" });
      otaNote("ui apply reelos-ota.service failed");
      send(res, 500, { ok: false, error: (j.stdout || "reelos-ota failed").slice(0, 240) });
      return;
    }
    otaNote("ui apply started reelos-ota.service");
    send(res, 200, { ok: true, started: true });
  } catch (e) {
    send(res, 500, { ok: false, error: String(e).slice(0, 160) });
  }
}

function lastOtaLines(n = 3) {
  try {
    if (!existsSync("/var/lib/reelos/ota.log")) return "";
    const lines = readFileSync("/var/lib/reelos/ota.log", "utf8")
      .trim()
      .split("\n")
      .filter((l) => l && !l.includes("channel ") && !l.startsWith("----"));
    return lines.slice(-n).join("\n");
  } catch {
    return "";
  }
}

async function handleUpdateStatus(_req, res) {
  const st = spawnSync("systemctl", ["is-active", "reelos-ota"], { encoding: "utf8" }).stdout.trim();
  const running = st === "active" || st === "activating";
  send(res, 200, { ok: true, local: localVersion(), running, log: lastOtaLines(3) });
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

const jellyfinRefreshed = new Set();

async function jellyfinRefresh(id) {
  if (!id || jellyfinRefreshed.has(id)) return;
  jellyfinRefreshed.add(id);
  try {
    await fetch("http://127.0.0.1:8096/Library/Refresh", { method: "POST", signal: AbortSignal.timeout(8000) });
  } catch {
    /* */
  }
}

function requestIdFromQuery(u) {
  const tmdb = String(u.searchParams.get("tmdb") || "").trim();
  const type = String(u.searchParams.get("type") || "").trim();
  let id = String(u.searchParams.get("id") || "").trim();
  if (!id && tmdb) id = type === "tv" ? `tmdb-tv-${tmdb}` : `tmdb-${tmdb}`;
  return id;
}

async function handleRequestList(res) {
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
      if (parsed) need.push(parsed);
    }
    const details = await Promise.all(need.map((p) => seerrTitleDetail(p).catch(() => null)));
    const titles = details.filter(Boolean);
    send(res, 200, { requests, titles, engine: "seerr" });
  } catch (e) {
    send(res, 200, { requests: [], titles: [], error: String(e) });
  }
}

async function handleRequestStatus(req, res) {
  const u = new URL(req.url || "/", "http://reelos.local");
  const id = requestIdFromQuery(u);
  if (!id) {
    return handleRequestList(res);
  }
  const key = seerrApiKey();
  if (!key) {
    send(res, 200, { status: "unknown", engine: "seerr", error: "Seerr has no API key yet" });
    return;
  }
  try {
    const parsed = parseTitleId(id);
    if (!parsed?.tmdb) {
      send(res, 400, { status: "unknown", error: "Need a TMDB id from Discover" });
      return;
    }
    const path = parsed.mediaType === "tv" ? `/api/v1/tv/${parsed.tmdb}` : `/api/v1/movie/${parsed.tmdb}`;
    const r = await seerrFetch(path, { key, ms: 15000 });
    const media = r.json?.mediaInfo || r.json?.media || {};
    const reqs = Array.isArray(media.requests) ? media.requests : [];
    const last = reqs[0] || {};
    const status = (() => {
      const mapped = seerrRequestRow({ ...last, media: { ...media, tmdbId: parsed.tmdb }, type: parsed.mediaType });
      return mapped.engine || "unknown";
    })();
    if (status === "downloaded") await jellyfinRefresh(id);
    const title = seerrSearchHit({ ...r.json, id: Number(parsed.tmdb), mediaType: parsed.mediaType }, parsed.mediaType);
    send(res, 200, {
      status,
      engine: "seerr",
      title: title?.title,
      seasons: title?.seasons,
      seasonList: title?.seasonList,
      progress: status === "downloaded" ? 100 : undefined,
    });
  } catch (e) {
    send(res, 200, { status: "unknown", engine: "seerr", error: String(e) });
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
  if (!titleId && tmdb) titleId = String(body.mediaType || "").toLowerCase() === "tv" ? `tmdb-tv-${tmdb}` : `tmdb-${tmdb}`;
  if (!titleId && tvdb) titleId = `tvdb-${tvdb}`;
  const season = body.season ?? body.data?.season;
  const parsed = parseTitleId(titleId);
  note(`request ${titleId} title=${body.title || ""} season=${season ?? ""}`);
  if (!titleId) {
    send(res, 400, { ok: false, error: "No title" });
    return;
  }
  const key = seerrApiKey();
  if (!key) {
    send(res, 503, { ok: false, error: "Seerr has no API key yet" });
    return;
  }
  if (!parsed?.tmdb) {
    send(res, 400, { ok: false, error: "Search again, then request. Titles now use Seerr/TMDB ids." });
    return;
  }
  try {
    const payload = {
      mediaType: parsed.mediaType,
      mediaId: Number(parsed.tmdb),
    };
    if (parsed.mediaType === "tv") {
      const n = Number(season);
      payload.seasons = Number.isFinite(n) && n > 0 ? [n] : "all";
    }
    const added = await seerrFetch("/api/v1/request", { key, method: "POST", body: payload, ms: 30000 });
    if (!added.ok && added.status !== 409) {
      const msg = added.json?.message || added.json?.error || `seerr ${added.status}`;
      note(`seerr request ${added.status} ${msg}`);
      send(res, added.status >= 400 ? added.status : 500, { ok: false, error: String(msg) });
      return;
    }
    note(`seerr add ${added.status} type=${parsed.mediaType} season=${season ?? ""}`);
    send(res, 200, { ok: true, engine: "seerr", added: added.ok || added.status === 409, title: body.title || titleId });
  } catch (e) {
    const error = String(e?.name === "AbortError" ? "Request UI timed out" : e);
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
  const r = spawnSync("python3", [script], { encoding: "utf8", timeout: 60000 });
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

function redactLogs(s) {
  let t = String(s || "");
  t = t.replace(/(<ApiKey>)[^<]+/gi, "$1***");
  t = t.replace(/(Authorization:\s*)\S+/gi, "$1***");
  t = t.replace(/Bearer\s+\S+/gi, "Bearer ***");
  t = t.replace(/("?(?:apiKey|api_key|adminPassword|password|token)"?\s*[:=]\s*"?)([^"\s,}\\]+)/gi, "$1***");
  return t;
}

function tailFile(p, n) {
  try {
    if (!existsSync(p)) return `(missing ${p})\n`;
    const lines = readFileSync(p, "utf8").split(/\r?\n/);
    return `${lines.slice(-n).join("\n")}\n`;
  } catch (e) {
    return `(unreadable ${p}: ${e})\n`;
  }
}

function shOut(args, timeout = 8000) {
  try {
    const r = spawnSync(args[0], args.slice(1), { encoding: "utf8", timeout, maxBuffer: 512 * 1024 });
    const out = `${r.stdout || ""}${r.stderr || ""}`.trim();
    if (out) return `${out}\n`;
    return `(empty status=${r.status} error=${r.error ? r.error.code || r.error : "none"})\n`;
  } catch (e) {
    return `${e}\n`;
  }
}

async function tvHop() {
  const fuse = existsSync("/mnt/debrid/__all__") || existsSync("/mnt/debrid/version.txt");
  const dumps = shOut(
    ["bash", "-lc", "ls -la /mnt/symlinks/sonarr 2>&1 | head -25; echo '---'; find /mnt/symlinks/sonarr -maxdepth 2 \\( -type f -o -type l \\) 2>/dev/null | head -20"],
    2000,
  ).trim();
  let sonarr = "sonarr: no key";
  const sk = xmlKey("/opt/reelos/compose/configs/sonarr/config.xml");
  if (sk) {
    try {
      const series = await arrGet("http://127.0.0.1:8989/api/v3/series", sk);
      const list = Array.isArray(series) ? series : [];
      sonarr = list.length
        ? list
            .slice(0, 20)
            .map((s) => `${s.title} files=${s.statistics?.episodeFileCount || 0} pct=${s.statistics?.percentOfEpisodes || 0}`)
            .join("\n")
        : "sonarr: zero series";
    } catch (e) {
      sonarr = `sonarr: ${e}`;
    }
  }
  let jf = "jellyfin: no token";
  const a = answers();
  const auth = await jellyfinToken(a.adminName || "reelos", a.adminPassword || "reelos");
  if (auth?.token) {
    try {
      const r = await fetch(
        "http://127.0.0.1:8096/Items?Recursive=true&IncludeItemTypes=Movie,Series&Limit=1",
        { headers: { "X-Emby-Token": auth.token }, signal: AbortSignal.timeout(5000) },
      );
      const data = await r.json();
      const movies = await fetch(
        "http://127.0.0.1:8096/Items?Recursive=true&IncludeItemTypes=Movie&Limit=1",
        { headers: { "X-Emby-Token": auth.token }, signal: AbortSignal.timeout(5000) },
      ).then((x) => x.json());
      const shows = await fetch(
        "http://127.0.0.1:8096/Items?Recursive=true&IncludeItemTypes=Series&Limit=1",
        { headers: { "X-Emby-Token": auth.token }, signal: AbortSignal.timeout(5000) },
      ).then((x) => x.json());
      jf = `jellyfin movies=${movies.TotalRecordCount ?? "?"} series=${shows.TotalRecordCount ?? "?"} total=${data.TotalRecordCount ?? "?"}`;
    } catch (e) {
      jf = `jellyfin: ${e}`;
    }
  }
  return [`fuse ${fuse ? "on host" : "MISSING"}`, "=== sonarr dumps ===", dumps, "=== sonarr series ===", sonarr, "=== jellyfin counts ===", jf].join("\n");
}

async function handleLogs(_req, res) {
  const ver = existsSync("/var/lib/reelos/installed-version")
    ? readFileSync("/var/lib/reelos/installed-version", "utf8").trim()
    : existsSync("/opt/reelos/VERSION")
      ? readFileSync("/opt/reelos/VERSION", "utf8").trim()
      : localVersion();
  const sha = existsSync("/var/lib/reelos/applied-sha")
    ? readFileSync("/var/lib/reelos/applied-sha", "utf8").trim()
    : "";
  const blob = [
    `ReelOS ${ver}`,
    `applied-sha ${sha}`,
    `time ${new Date().toISOString()}`,
    "=== bugs ===",
    shOut(["bash", "-lc", "ls -1t /var/lib/reelos/bugs 2>/dev/null | head -8; echo '--- latest ---'; cat $(ls -1t /var/lib/reelos/bugs/*.txt 2>/dev/null | head -1) 2>/dev/null | head -80"], 4000).trim(),
    "=== tv hop ===",
    await tvHop(),
    "=== mount ===",
    shOut(["bash", "-lc", "ls -la /mnt /mnt/debrid /mnt/debrid/__all__ /mnt/symlinks /mnt/symlinks/radarr 2>&1 | head -40"], 1500).trim(),
    "=== files ===",
    shOut(["bash", "-lc", "find /mnt/symlinks -maxdepth 3 \\( -type f -o -type l \\) 2>/dev/null | head -30"], 2500).trim(),
    "=== decypharr ===",
    shOut(["docker", "logs", "decypharr", "--tail", "25"], 2500).trim(),
    "=== jellyfin ===",
    shOut(["docker", "logs", "reelos-jellyfin-1", "--tail", "25"], 2500).trim(),
    "=== reelos.service ===",
    shOut(["journalctl", "-u", "reelos.service", "-n", "20", "--no-pager", "--output=short-iso"], 8000).trim(),
    "=== caddy.service ===",
    shOut(["journalctl", "-u", "caddy.service", "-n", "20", "--no-pager", "--output=short-iso"], 8000).trim(),
    "=== ota.log ===",
    tailFile("/var/lib/reelos/ota.log", 40).trim(),
    "=== wire.log ===",
    tailFile("/var/lib/reelos/wire.log", 30).trim(),
    "=== docker ps ===",
    shOut(["docker", "ps", "--format", "table {{.Names}}\\t{{.Status}}"], 2500).trim(),
    "",
  ].join("\n");
  send(res, 200, { ok: true, text: redactLogs(blob) });
}

async function handleBugsGithub(req, res) {
  const tokFile = "/var/lib/reelos/github-token";
  if ((req.method || "GET").toUpperCase() === "GET") {
    send(res, 200, { ok: true, set: existsSync(tokFile) });
    return;
  }
  if ((req.method || "").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const tok = String(body.token || "").trim();
  mkdirSync("/var/lib/reelos", { recursive: true });
  if (!tok) {
    try {
      spawnSync("rm", ["-f", tokFile], { encoding: "utf8" });
    } catch {
      /* */
    }
    send(res, 200, { ok: true, set: false });
    return;
  }
  writeFileSync(tokFile, `${tok}\n`, { mode: 0o600 });
  send(res, 200, { ok: true, set: true });
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
  jellyfinTokens.clear();
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

async function handleQuality(req, res) {
  const wantMap = { "1080p": "HD-1080p", hybrid: "Ultra-HD", "4k": "Ultra-HD", custom: "Any" };
  if ((req.method || "GET").toUpperCase() === "POST") {
    const body = await readBody(req);
    const q = String(body.quality || "");
    if (!["1080p", "hybrid", "4k", "custom"].includes(q)) {
      send(res, 400, { ok: false, error: "quality must be 1080p, hybrid, or 4k" });
      return;
    }
    const a = answers();
    a.quality = q;
    try {
      mkdirSync("/var/lib/reelos", { recursive: true });
      writeFileSync("/var/lib/reelos/answers.json", JSON.stringify(a, null, 2) + "\n", { mode: 0o600 });
    } catch (e) {
      send(res, 500, { ok: false, error: String(e) });
      return;
    }
  }
  const want = answers().quality || "hybrid";
  const profile = wantMap[want] || "Ultra-HD";
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
    send(res, 200, { ok: true, wanted: want, profile, radarr, sonarr, error: String(e) });
    return;
  }
  send(res, 200, {
    ok: true,
    wanted: want,
    profile,
    radarr,
    sonarr,
    error: rk || sk ? null : "no engine keys",
  });
}

async function handleIntent(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 200, { ok: true, intent: answers().intent || {} });
    return;
  }
  const body = await readBody(req);
  const a = answers();
  a.intent = { ...(a.intent || {}), ...(body.intent || body) };
  try {
    mkdirSync("/var/lib/reelos", { recursive: true });
    writeFileSync("/var/lib/reelos/answers.json", JSON.stringify(a, null, 2) + "\n", { mode: 0o600 });
  } catch (e) {
    send(res, 500, { ok: false, error: String(e) });
    return;
  }
  const compose = "/opt/reelos/compose";
  if (a.intent?.music) {
    spawnSync("docker", ["compose", "--profile", "music", "up", "-d", "lidarr"], {
      cwd: compose,
      encoding: "utf8",
      timeout: 60000,
    });
  } else {
    spawnSync("docker", ["compose", "stop", "lidarr"], { cwd: compose, encoding: "utf8", timeout: 20000 });
  }
  if (a.intent?.books) {
    spawnSync("docker", ["compose", "--profile", "books", "up", "-d", "kavita"], {
      cwd: compose,
      encoding: "utf8",
      timeout: 60000,
    });
  } else {
    spawnSync("docker", ["compose", "stop", "kavita"], { cwd: compose, encoding: "utf8", timeout: 20000 });
  }
  send(res, 200, { ok: true, intent: a.intent });
}

async function handleActivity(_req, res) {
  const events = [];
  const push = (src, line) => {
    const t = String(line || "").trim();
    if (!t || t.startsWith("----")) return;
    events.push({ id: `${src}-${events.length}`, at: Date.now(), message: t.slice(0, 240), src });
  };
  for (const line of tailFile("/var/lib/reelos/wire.log", 20).split("\n")) push("wire", line);
  for (const line of tailFile("/var/lib/reelos/stuck-downloads.log", 12).split("\n")) push("stuck", line);
  for (const line of tailFile("/var/lib/reelos/ota.log", 15).split("\n")) push("ota", line);
  for (const line of shOut(["journalctl", "-u", "reelos", "-n", "12", "--no-pager", "-o", "cat"], 2500).split("\n")) {
    push("shell", line);
  }
  send(res, 200, { events: events.slice(-40) });
}

function uiSettingsPath() {
  return "/var/lib/reelos/ui-settings.json";
}

function readUiSettings() {
  try {
    return JSON.parse(readFileSync(uiSettingsPath(), "utf8"));
  } catch {
    return { autoUpdate: true, stackImages: false, notifyAvailable: true, notifyFailed: true, autoApprove: true };
  }
}

function setAutoUpdateTimer(on) {
  mkdirSync("/etc/systemd/system", { recursive: true });
  writeFileSync(
    "/etc/systemd/system/reelos-autoupdate.service",
    `[Unit]
Description=ReelOS daily Apply
[Service]
Type=oneshot
ExecStart=/bin/bash /opt/reelos/bin/reelos-update.sh apply
`,
  );
  writeFileSync(
    "/etc/systemd/system/reelos-autoupdate.timer",
    `[Unit]
Description=ReelOS daily Apply timer
[Timer]
OnCalendar=daily
Persistent=true
[Install]
WantedBy=timers.target
`,
  );
  spawnSync("systemctl", ["daemon-reload"], { encoding: "utf8" });
  if (on) {
    spawnSync("systemctl", ["enable", "--now", "reelos-autoupdate.timer"], { encoding: "utf8" });
  } else {
    spawnSync("systemctl", ["disable", "--now", "reelos-autoupdate.timer"], { encoding: "utf8" });
  }
}

async function handleSettings(req, res) {
  if ((req.method || "GET").toUpperCase() === "GET") {
    send(res, 200, { ok: true, ...readUiSettings() });
    return;
  }
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const cur = readUiSettings();
  const next = { ...cur, ...body };
  mkdirSync("/var/lib/reelos", { recursive: true });
  writeFileSync(uiSettingsPath(), JSON.stringify(next, null, 2) + "\n");
  if ("autoUpdate" in body) setAutoUpdateTimer(Boolean(next.autoUpdate));
  if ("stackImages" in body) {
    const flag = "/var/lib/reelos/stack-images";
    if (next.stackImages) writeFileSync(flag, "1\n");
    else spawnSync("rm", ["-f", flag], { encoding: "utf8" });
  }
  send(res, 200, { ok: true, ...next });
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
    seerr: 5055,
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
mkdir -p "\$ROOT/compose/configs/jellyfin/config"
printf '%s\\n' '<?xml version="1.0" encoding="utf-8"?>' '<NetworkConfiguration>' '  <EnableRemoteAccess>true</EnableRemoteAccess>' '  <EnablePublishedServerUriByRequest>true</EnablePublishedServerUriByRequest>' '</NetworkConfiguration>' > "\$ROOT/compose/configs/jellyfin/config/network.xml"
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

function otaRunning() {
  if (process.env.REELOS_OTA === "1") return true;
  const ota = spawnSync("pgrep", ["-f", "reelos-update.sh"], { encoding: "utf8" });
  return ota.status === 0;
}

async function handleWire(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  if (otaRunning()) {
    send(res, 409, { ok: false, error: "Wire does not run during OTA" });
    return;
  }
  const wire = existsSync("/opt/reelos/bin/wire-engines.py")
    ? "/opt/reelos/bin/wire-engines.py"
    : "/workspace/daemon/wire-engines.py";
  if (!existsSync(wire)) {
    send(res, 500, { ok: false, error: "wire-engines.py missing" });
    return;
  }
  mkdirSync("/var/lib/reelos", { recursive: true });
  const log = openSync("/var/lib/reelos/wire.log", "a");
  spawn("python3", [wire], { detached: true, stdio: ["ignore", log, log] }).unref();
  send(res, 200, { ok: true, started: true });
}

async function handleLibrary(req, res) {
  const host =
    String(req.headers.host || "")
      .split(":")[0]
      .replace(/[^a-zA-Z0-9.-]/g, "") ||
    ipv4() ||
    "127.0.0.1";
  const result = await serveLibrary({
    url: req.url || "/api/library",
    host,
    cache: libraryCache,
    getAuth: async () => {
      const a = answers();
      return jellyfinToken(a.adminName || "reelos", a.adminPassword || "reelos");
    },
    fetchItems: async (auth, limit) => {
      const r = await fetch(libraryItemsUrl({ limit }), {
        headers: { "X-Emby-Token": auth.token },
        signal: AbortSignal.timeout(JELLYFIN_ITEMS_TIMEOUT_MS),
      });
      if (!r.ok) throw new Error(`Jellyfin ${r.status}`);
      return r.json();
    },
    refresh: () => refreshLibraryFull(host),
  });
  persistLibraryCache();
  send(res, 200, { titles: result.titles, error: result.error });
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
  if (intent.books !== false) p.push("books");
  if (intent.movies || intent.tv || intent.anime) p.push("subtitles");
  if (a.frontend === "jellyfin" || a.frontend === "both") {
    p.push("jellyfin");
    p.push("seerr");
  }
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
    mkdirSync("/srv/media/books", { recursive: true });
    seedJellyfinNetworkXml(composeDir);
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
        default_download_action: "symlink",
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
  const profiles = composeProfiles(a).join(",");
  const wire = existsSync(`${root}/bin/wire-engines.py`)
    ? `${root}/bin/wire-engines.py`
    : "/workspace/daemon/wire-engines.py";
  try {
    unlinkSync("/var/lib/reelos/provision.error");
  } catch {
    /* */
  }
  if (!existsSync("/var/lib/reelos/provisioning")) {
    writeFileSync("/var/lib/reelos/provisioning", "1\n");
    const log = openSync("/var/lib/reelos/provision.log", "a");
    const env = { ...process.env, COMPOSE_PROFILES: profiles };
    const cmd = [
      `cd ${JSON.stringify(composeDir)}`,
      `export COMPOSE_PROFILES=${JSON.stringify(profiles)}`,
      // `up -d` pulls missing images. Do not spawnSync `compose pull` here —
      // a 15-minute pull wedges the Vite event loop (phone TypeError: Failed to fetch).
      "if docker compose up -d; then",
      "  printf '1\\n' > /var/lib/reelos/provisioned",
      existsSync(wire) ? `  python3 ${JSON.stringify(wire)} || true` : "  true",
      "else",
      "  printf 'compose up failed\\n' > /var/lib/reelos/provision.error",
      "fi",
      "rm -f /var/lib/reelos/provisioning",
    ].join("\n");
    spawn("bash", ["-lc", cmd], { detached: true, stdio: ["ignore", log, log], env }).unref();
  }
  send(res, 200, { ok: true, simulated: false, started: true });
}

async function handlePing(req, res) {
  if ((req.method || "GET").toUpperCase() === "GET") {
    const t0 = Date.now();
    const ok = await probe("http://127.0.0.1:8282/", 3000);
    send(res, 200, { ok, pingMs: Date.now() - t0, target: "decypharr" });
    return;
  }
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

function performancePath() {
  return "/var/lib/reelos/performance.json";
}

function readPerformance() {
  try {
    if (existsSync(performancePath())) {
      return JSON.parse(readFileSync(performancePath(), "utf8"));
    }
  } catch {
    /* */
  }
  return { low: true };
}

function applyPerformance() {
  const root = process.env.REELOS_ROOT || "/opt/reelos";
  const wire = existsSync(`${root}/bin/wire-engines.py`)
    ? `${root}/bin/wire-engines.py`
    : "/workspace/daemon/wire-engines.py";
  if (!existsSync(wire)) return;
  spawn("python3", [wire, "--performance"], { detached: true, stdio: "ignore" }).unref();
}

async function handlePerformance(req, res) {
  mkdirSync("/var/lib/reelos", { recursive: true, mode: 0o700 });
  const method = (req.method || "GET").toUpperCase();
  if (method === "GET") {
    const cur = readPerformance();
    if (!existsSync(performancePath())) {
      writeFileSync(performancePath(), JSON.stringify({ low: true }) + "\n");
    }
    send(res, 200, { low: cur.low !== false });
    return;
  }
  if (method !== "POST") {
    send(res, 405, { ok: false });
    return;
  }
  const body = await readBody(req);
  const low = body.low !== false;
  writeFileSync(performancePath(), JSON.stringify({ low }) + "\n");
  applyPerformance();
  send(res, 200, { ok: true, low });
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
          if (pathOnly === "/api/discover") return void (await handleDiscover(req, res));
          if (pathOnly === "/api/books") return void (await handleBooks(req, res));
          if (pathOnly === "/api/box") return void (await handleBox(req, res));
          if (pathOnly === "/api/indexer") return void (await handleIndexer(req, res));
          if (pathOnly === "/api/tailscale/login") return void (await handleTailscaleLogin(req, res));
          if (pathOnly === "/api/tailscale/install") return void (await handleTailscaleInstall(req, res));
          if (pathOnly === "/api/tailscale/check") return void (await handleTailscaleCheck(req, res));
          if (pathOnly === "/api/update/check") return void (await handleUpdateCheck(req, res));
          if (pathOnly === "/api/update/apply") return void (await handleUpdateApply(req, res));
          if (pathOnly === "/api/update/run") {
            req.method = "POST";
            return void (await handleUpdateApply(req, res));
          }
          if (pathOnly === "/api/update/status") return void (await handleUpdateStatus(req, res));
          if (pathOnly === "/api/request") return void (await handleRequest(req, res));
          if (pathOnly === "/api/password") return void (await handlePassword(req, res));
          if (pathOnly === "/api/quality") return void (await handleQuality(req, res));
          if (pathOnly === "/api/intent") return void (await handleIntent(req, res));
          if (pathOnly === "/api/activity") return void (await handleActivity(req, res));
          if (pathOnly === "/api/settings") return void (await handleSettings(req, res));
          if (pathOnly === "/api/ports") return void (await handlePorts(req, res));
          if (pathOnly === "/api/doctor") return void (await handleDoctor(req, res));
          if (pathOnly === "/api/reset") return void (await handleReset(req, res));
          if (pathOnly === "/api/wire") return void (await handleWire(req, res));
          if (pathOnly === "/api/library") return void (await handleLibrary(req, res));
          if (pathOnly === "/api/disks") return void (await handleDisks(req, res));
          if (pathOnly === "/api/storage") return void (await handleStorage(req, res));
          if (pathOnly === "/api/transcode") return void (await handleTranscode(req, res));
          if (pathOnly === "/api/provision") return void (await handleProvision(req, res));
          if (pathOnly === "/api/ping") return void (await handlePing(req, res));
          if (pathOnly === "/api/performance") return void (await handlePerformance(req, res));
          if (pathOnly === "/api/terminal") return void (await handleTerminal(req, res));
          if (pathOnly === "/api/logs") return void (await handleLogs(req, res));
          if (pathOnly === "/api/bugs/github") return void (await handleBugsGithub(req, res));
        } catch (e) {
          send(res, 500, { error: String(e) });
          return;
        }
        next();
      });
    },
  };
}
