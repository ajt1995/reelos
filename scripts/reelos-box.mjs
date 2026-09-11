#!/usr/bin/env node
/**
 * Appliance production door on :8080.
 *
 * Highest-leverage speedup that still is this product: `vite build` then
 * `vite preview` (this app's nitro output has no dist/index.html) plus the
 * existing /api Vite plugins. A static file server is used when a classic
 * dist/index.html exists. No Go rewrite. If no build is present, fall back
 * to `vite --host :8080` so the door still binds.
 */
import { spawn } from "node:child_process";
import { createReadStream, existsSync, realpathSync, statSync } from "node:fs";
import http from "node:http";
import { extname, join, normalize, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeAppEnv, readAppEnv } from "./with-app-env.mjs";

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
  for (const rel of ["dist/client", "dist", ".output/public"]) {
    const dir = join(root, rel);
    if (existsSync(join(dir, "index.html"))) return dir;
  }
  return null;
}

export function findPreviewBuild(root = ROOT) {
  const nitro = join(root, ".vercel/output/nitro.json");
  const staticDir = join(root, ".vercel/output/static");
  if (existsSync(nitro) || existsSync(staticDir)) return join(root, ".vercel/output");
  return null;
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

function startStatic(clientRoot) {
  const server = http.createServer(async (req, res) => {
    try {
      if (await dispatchBoxApi(req, res)) return;
    } catch (e) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: String(e) }));
      }
      return;
    }
    const urlPath = (req.url || "/").split("?")[0] || "/";
    let file = safeJoin(clientRoot, urlPath === "/" ? "/index.html" : urlPath);
    if (file && existsSync(file) && statSync(file).isFile()) {
      sendFile(res, file);
      return;
    }
    const index = join(clientRoot, "index.html");
    if (wantsHtml(req) && existsSync(index) && (req.method || "GET").toUpperCase() === "GET") {
      sendFile(res, index);
      return;
    }
    res.statusCode = 404;
    res.end("not found");
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(PORT, HOST, () => {
      console.log(`[reelos-box] serving built UI ${clientRoot} on http://${HOST}:${PORT}/`);
      resolve(server);
    });
  });
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

async function kickSelfHeal() {
  try {
    const { runSelfHeal } = await import("./reelos-selfheal.mjs");
    await runSelfHeal();
  } catch {
    /* next tick */
  }
}

export async function startBox({ root = ROOT } = {}) {
  const client = findClientRoot(root);
  if (client) {
    const server = await startStatic(client);
    setTimeout(() => void kickSelfHeal(), 8000);
    setInterval(() => void kickSelfHeal(), 120_000).unref();
    return { mode: "static", client, server };
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
