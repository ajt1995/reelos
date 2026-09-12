#!/usr/bin/env node
/**
 * Appliance production door on :8080.
 *
 * Highest-leverage speedup that still is this product: serve the shipped
 * nitro static UI (hashed /assets/...) plus the existing /api Vite plugins.
 * Not a Go rewrite. Not vite --host on the house when prebuilt exists.
 * Leftover Vite is `vite preview` only if nitro+api cannot bind.
 */
import { spawn, spawnSync } from "node:child_process";
import {
  createReadStream,
  existsSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  statSync,
} from "node:fs";
import { parseListenerInodes } from "./preview.mjs";
import http from "node:http";
import { extname, join, normalize, relative, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mergeAppEnv, readAppEnv } from "./with-app-env.mjs";
import {
  anythingPlaying,
  readHostLoad1,
  shouldSkipIdleWork,
} from "./reelos-box-scale.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

export function findClientRoot(root = ROOT) {
  for (const rel of ["prebuilt/client", "dist/client", "dist", ".output/public"]) {
    const dir = join(root, rel);
    if (existsSync(join(dir, "index.html"))) return dir;
  }
  return null;
}

export function findNitroOutput(root = ROOT) {
  for (const rel of ["prebuilt/vercel-output", ".vercel/output"]) {
    const dir = join(root, rel);
    const entry = join(dir, "functions/__server.func/index.mjs");
    if (existsSync(join(dir, "nitro.json")) || existsSync(entry)) return dir;
  }
  return null;
}

export function findPreviewBuild(root = ROOT) {
  return findNitroOutput(root);
}

function viteBin(root = ROOT) {
  const local = join(root, "node_modules/.bin/vite");
  return existsSync(local) ? local : "vite";
}

export function safeJoin(root, urlPath) {
  const raw = String(urlPath || "/").split("?")[0] || "/";
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const rel = decoded.replace(/^\/+/, "");
  const abs = normalize(join(root, rel || "."));
  const relTo = relative(root, abs);
  if (!relTo || relTo.startsWith("..") || relTo.startsWith("/")) {
    if (normalize(abs) === normalize(root)) return abs;
    return null;
  }
  return abs;
}

function sendFile(res, file, code = 200) {
  const type = MIME[extname(file).toLowerCase()] || "application/octet-stream";
  res.statusCode = code;
  res.setHeader("content-type", type);
  res.setHeader("cache-control", extname(file) === ".html" ? "no-store" : "public, max-age=60");
  createReadStream(file).pipe(res);
}

function wantsHtml(req) {
  const accept = String(req.headers.accept || "");
  return accept.includes("text/html") || accept === "" || accept === "*/*";
}

export async function dispatchBoxApi(req, res) {
  const { dispatchRequestGet } = await import("./reelos-request-progress-plugin.mjs");
  const { dispatchReelOsApi } = await import("./reelos-lookup-plugin.mjs");
  if (await dispatchRequestGet(req, res)) return true;
  if (await dispatchReelOsApi(req, res)) return true;
  return false;
}

function staticRoots(root, clientRoot) {
  const dirs = [];
  if (clientRoot) dirs.push(clientRoot);
  const pub = join(root, "public");
  if (existsSync(pub)) dirs.push(pub);
  return dirs;
}

function tryStatic(res, roots, urlPath) {
  for (const dir of roots) {
    const file = safeJoin(dir, urlPath);
    if (file && existsSync(file) && statSync(file).isFile()) {
      sendFile(res, file);
      return true;
    }
  }
  return false;
}

function nodeHeaders(req) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, String(value));
    }
  }
  return headers;
}

async function nodeToFetch(req) {
  const host = String(req.headers.host || `${HOST}:${PORT}`);
  const url = `http://${host}${req.url || "/"}`;
  const method = (req.method || "GET").toUpperCase();
  const headers = nodeHeaders(req);
  if (method === "GET" || method === "HEAD") {
    return new Request(url, { method, headers });
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  return new Request(url, { method, headers, body: body.length ? body : undefined });
}

async function sendFetch(res, response) {
  res.statusCode = response.status;
  const cookies =
    typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return;
    res.setHeader(key, value);
  });
  for (const cookie of cookies) {
    res.appendHeader("set-cookie", cookie);
  }
  const buf = Buffer.from(await response.arrayBuffer());
  res.end(buf);
}

function startHttpApi(handler) {
  const server = http.createServer(async (req, res) => {
    try {
      if (await dispatchBoxApi(req, res)) return;
      await handler(req, res);
    } catch (e) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: String(e) }));
      }
    }
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(PORT, HOST, () => resolve(server));
  });
}

function startStatic(clientRoot, root = ROOT) {
  const roots = staticRoots(root, clientRoot);
  return startHttpApi(async (req, res) => {
    const urlPath = (req.url || "/").split("?")[0] || "/";
    if (urlPath !== "/" && tryStatic(res, roots, urlPath)) return;
    const index = join(clientRoot, "index.html");
    if (wantsHtml(req) && existsSync(index) && (req.method || "GET").toUpperCase() === "GET") {
      sendFile(res, index);
      return;
    }
    if (urlPath === "/" && tryStatic(res, roots, "/index.html")) return;
    res.statusCode = 404;
    res.end("not found");
  }).then((server) => {
    console.log(`[reelos-box] serving built UI ${clientRoot} on http://${HOST}:${PORT}/`);
    return server;
  });
}

export async function startNitroPlusApi(outputDir, root = ROOT) {
  const staticDir = join(outputDir, "static");
  const entry = join(outputDir, "functions/__server.func/index.mjs");
  if (!existsSync(entry)) {
    throw new Error("nitro server entry missing");
  }
  const mod = await import(pathToFileURL(entry).href);
  const fetchHandler = mod?.default?.fetch;
  if (typeof fetchHandler !== "function") {
    throw new Error("nitro fetch handler missing");
  }
  const roots = staticRoots(root, existsSync(staticDir) ? staticDir : null);
  const server = await startHttpApi(async (req, res) => {
    const urlPath = (req.url || "/").split("?")[0] || "/";
    if (urlPath !== "/" && tryStatic(res, roots, urlPath)) return;
    const request = await nodeToFetch(req);
    const response = await fetchHandler(request);
    await sendFetch(res, response);
  });
  console.log(`[reelos-box] nitro+api ${outputDir} on http://${HOST}:${PORT}/`);
  return server;
}

function startVite(mode = "dev") {
  const env = mergeAppEnv(readAppEnv(ROOT), process.env);
  const args =
    mode === "preview"
      ? [viteBin(ROOT), "preview", "--host", HOST, "--port", String(PORT)]
      : [viteBin(ROOT), "--host", HOST, "--port", String(PORT)];
  const child = spawn("node", [join(ROOT, "scripts/with-app-env.mjs"), ...args], {
    cwd: ROOT,
    env,
    stdio: "inherit",
  });
  child.on("exit", (code, signal) => {
    if (signal) process.exit(128);
    process.exit(code ?? 1);
  });
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => child.kill(signal));
  }
  return child;
}

async function readPsArgs() {
  return await new Promise((resolve) => {
    try {
      const child = spawn("ps", ["-eo", "args"], { encoding: "utf8" });
      let out = "";
      child.stdout?.on("data", (d) => {
        out += d;
      });
      child.on("close", () => resolve(out));
      child.on("error", () => resolve(""));
    } catch {
      resolve("");
    }
  });
}

async function kickSelfHeal() {
  const playing = anythingPlaying({ psArgs: await readPsArgs() });
  const idle = shouldSkipIdleWork({
    playing,
    load1: readHostLoad1(),
    ffprobeD: 0,
  });
  if (idle.skip) {
    console.log(`[reelos-box] skip engines — ${idle.reason} (nothing playing)`);
    return;
  }
  try {
    const { runSelfHeal } = await import("./reelos-selfheal.mjs");
    await runSelfHeal();
  } catch {
    /* next tick */
  }
}

function armSelfHeal() {
  setTimeout(() => void kickSelfHeal(), 8000);
  setInterval(() => void kickSelfHeal(), 120_000).unref();
}

function orphanPidsOnPort(port, { selfPid = process.pid } = {}) {
  const inodes = new Set();
  for (const file of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    if (!existsSync(file)) continue;
    for (const inode of parseListenerInodes(readFileSync(file, "utf8"), port)) inodes.add(inode);
  }
  if (inodes.size === 0) return [];
  const targets = new Set([...inodes].map((inode) => `socket:[${inode}]`));
  const pids = [];
  for (const entry of readdirSync("/proc")) {
    const pid = Number.parseInt(String(entry), 10);
    if (!Number.isInteger(pid) || pid <= 1 || pid === selfPid) continue;
    let fds;
    try { fds = readdirSync(`/proc/${pid}/fd`); } catch { continue; }
    for (const fd of fds) {
      try {
        if (targets.has(readlinkSync(`/proc/${pid}/fd/${fd}`))) { pids.push(pid); break; }
      } catch { /* fd closed mid-scan */ }
    }
  }
  return pids;
}

export function killOrphanPortPids(pids, { kill = process.kill, selfPid = process.pid } = {}) {
  const seen = new Set();
  const killed = [];
  for (const raw of pids) {
    const pid = Number(raw);
    if (!Number.isInteger(pid) || pid <= 1 || pid === selfPid || seen.has(pid)) continue;
    seen.add(pid);
    try { kill(pid, "SIGTERM"); killed.push(pid); } catch { /* already gone */ }
  }
  return killed;
}

export function killOrphan8080() {
  return killOrphanPortPids(orphanPidsOnPort(PORT));
}

export function ensureHardwareProfile(root = ROOT) {
  const py = existsSync(join(root, "bin/reelos_hardware.py"))
    ? join(root, "bin/reelos_hardware.py")
    : existsSync("/opt/reelos/bin/reelos_hardware.py")
      ? "/opt/reelos/bin/reelos_hardware.py"
      : join(root, "daemon/reelos_hardware.py");
  if (!existsSync(py)) return { ran: false };
  const state = process.env.REELOS_STATE || "/var/lib/reelos";
  const saved = join(state, "hardware-profile.json");
  if (existsSync(saved)) {
    spawn("python3", [py, "--ensure"], { detached: true, stdio: "ignore" }).unref();
    return { ran: true, skippedSync: true };
  }
  const r = spawnSync("python3", [py, "--ensure"], { encoding: "utf8", timeout: 8000 });
  return { ran: true, skippedSync: false, status: r.status };
}

export async function startBox({ root = ROOT } = {}) {
  ensureHardwareProfile(root);
  killOrphan8080();
  const client = findClientRoot(root);
  if (client) {
    const server = await startStatic(client, root);
    armSelfHeal();
    return { mode: "static", client, server };
  }
  const nitro = findNitroOutput(root);
  if (nitro && existsSync(join(nitro, "functions/__server.func/index.mjs"))) {
    try {
      const server = await startNitroPlusApi(nitro, root);
      armSelfHeal();
      return { mode: "nitro+api", client: nitro, server };
    } catch (e) {
      console.log(`[reelos-box] nitro+api failed (${e}) — production preview`);
      console.log(`[reelos-box] production preview ${nitro} on http://${HOST}:${PORT}/`);
      startVite("preview");
      return { mode: "preview", client: nitro };
    }
  }
  const preview = findPreviewBuild(root);
  if (preview) {
    console.log(`[reelos-box] production preview ${preview} on http://${HOST}:${PORT}/`);
    startVite("preview");
    return { mode: "preview", client: preview };
  }
  console.log("[reelos-box] no dist — vite --host :8080 (door still binds)");
  startVite("dev");
  return { mode: "vite", client: null };
}

function isMainModule(moduleUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === fileURLToPath(moduleUrl);
  } catch {
    return false;
  }
}

if (isMainModule(import.meta.url)) {
  await startBox();
}
