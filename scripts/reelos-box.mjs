#!/usr/bin/env node
/**
 * Appliance production door on :8080.
 *
 * Highest-leverage speedup that still is this product: serve the shipped
 * nitro static UI (hashed /assets/...) plus the existing /api Vite plugins.
 * Not a Go rewrite. Not vite --host on the house when prebuilt exists.
 * Leftover Vite is `vite preview` only if nitro+api cannot bind.
 */
import { execSync, spawn, spawnSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, readlinkSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { parseListenerInodes } from "./preview.mjs";
import http from "node:http";
import os from "node:os";
import { extname, join, normalize, relative, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mergeAppEnv, readAppEnv } from "./with-app-env.mjs";
import {
  anythingPlaying,
  readHostLoad1,
  shouldSkipIdleWork,
  detectGpuType,
} from "./reelos-box-scale.mjs";
import { parseRangeHeader } from "./services/neural-stream-server.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";
const APP_VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;

// Autonomous 4-Day Sentry: Prevent unattended crashes from transient unhandled errors (Law 7)
if (!globalThis.__reelosSentryAttached) {
  globalThis.__reelosSentryAttached = true;
  process.on("unhandledRejection", (reason) => {
    console.error("[reelos-sentry] Caught unhandledRejection:", reason?.message || String(reason));
  });
  process.on("uncaughtException", (err) => {
    console.error("[reelos-sentry] Caught uncaughtException:", err?.message || String(err));
  });
}

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
  ".apk": "application/vnd.android.package-archive",
};

export function findClientRoot(root = ROOT) {
  for (const rel of ["prebuilt/client", "dist/client", "dist", ".output/public"]) {
    const dir = join(root, rel);
    if (existsSync(join(dir, "index.html"))) return dir;
  }
  return null;
}

export function findNitroOutput(root = ROOT) {
  for (const rel of [".vercel/output", "prebuilt/vercel-output"]) {
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
  if (process.platform === "win32") {
    const localCmd = join(root, "node_modules/.bin/vite.cmd");
    if (existsSync(localCmd)) return localCmd;
  }
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

const staticMemoryCache = new Map();
const MAX_CACHE_FILE_SIZE = 2 * 1024 * 1024; // 2MB per file max (larger files stream)
const MAX_TOTAL_CACHE_BYTES = 32 * 1024 * 1024; // 32MB total aggregate cache cap
let totalCacheBytes = 0;

function setCachedFile(file, data, mtime) {
  if (!data || data.length > MAX_CACHE_FILE_SIZE) return;
  if (staticMemoryCache.has(file)) {
    totalCacheBytes -= staticMemoryCache.get(file).data.length;
    staticMemoryCache.delete(file);
  }
  while (totalCacheBytes + data.length > MAX_TOTAL_CACHE_BYTES && staticMemoryCache.size > 0) {
    const oldestKey = staticMemoryCache.keys().next().value;
    totalCacheBytes -= staticMemoryCache.get(oldestKey).data.length;
    staticMemoryCache.delete(oldestKey);
  }
  if (totalCacheBytes + data.length <= MAX_TOTAL_CACHE_BYTES) {
    staticMemoryCache.set(file, { data, mtime });
    totalCacheBytes += data.length;
  }
}

export function prewarmStaticCache(roots) {
  for (const dir of roots) {
    if (!dir || !existsSync(dir)) continue;
    try {
      const walk = (d) => {
        for (const entry of readdirSync(d, { withFileTypes: true })) {
          const full = join(d, entry.name);
          if (entry.isDirectory()) {
            walk(full);
          } else if (entry.isFile()) {
            try {
              const stat = statSync(full);
              if (stat.size <= MAX_CACHE_FILE_SIZE) {
                setCachedFile(full, readFileSync(full), stat.mtimeMs);
              }
            } catch {}
          }
        }
      };
      walk(dir);
    } catch {}
  }
}

function sendFile(res, file, code = 200, req = null) {
  const type = MIME[extname(file).toLowerCase()] || "application/octet-stream";
  const range = req?.headers?.range;

  let stat = null;
  try {
    stat = statSync(file);
  } catch {}

  const totalSize = stat ? stat.size : 0;

  if (range && totalSize > 0 && (req?.method || "GET").toUpperCase() === "GET") {
    const rangeSpec = parseRangeHeader(range, totalSize);
    if (rangeSpec === "unsatisfiable") {
      res.statusCode = 416;
      res.setHeader("Content-Range", `bytes */${totalSize}`);
      res.end();
      return;
    }
    if (rangeSpec) {
      const { start: rStart, end: rEnd, chunkSize } = rangeSpec;
      res.statusCode = 206;
      res.setHeader("Content-Range", `bytes ${rStart}-${rEnd}/${totalSize}`);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Length", chunkSize);
      res.setHeader("Content-Type", type);
      res.setHeader("Cache-Control", "public, max-age=60");
      const stream = createReadStream(file, { start: rStart, end: rEnd });
      stream.on("error", (err) => {
        try {
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end();
          } else {
            res.destroy(err);
          }
        } catch {}
      });
      stream.pipe(res);
      return;
    }
    // If rangeSpec === null (e.g. multipart or non-byte unit), RFC 7233 §3.1 fallback to 200 OK
  }

  res.statusCode = code;
  res.setHeader("Content-Type", type);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", extname(file) === ".html" ? "no-store" : "public, max-age=60");

  let cached = staticMemoryCache.get(file);
  if (!cached && stat && stat.size <= MAX_CACHE_FILE_SIZE) {
    try {
      const data = readFileSync(file);
      setCachedFile(file, data, stat.mtimeMs);
      cached = staticMemoryCache.get(file);
    } catch {
      // Fall back to stream on error
    }
  }

  if (cached) {
    res.setHeader("Content-Length", cached.data.length);
    res.end(cached.data);
    return;
  }
  if (totalSize > 0) {
    res.setHeader("Content-Length", totalSize);
  }
  const stream = createReadStream(file);
  stream.on("error", (err) => {
    try {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end();
      } else {
        res.destroy(err);
      }
    } catch {}
  });
  stream.pipe(res);
}

function wantsHtml(req) {
  const accept = String(req.headers.accept || "");
  return accept.includes("text/html") || accept === "" || accept === "*/*";
}

export async function dispatchBoxApi(req, res) {
  const urlPath = (req.url || "/").split("?")[0] || "/";
  if (urlPath === "/api/health" || urlPath === "/healthz") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, service: "reelos-box", version: APP_VERSION, uptime: Math.round(process.uptime()) }));
    return true;
  }
  if (urlPath === "/api/playback/prewarm" && (req.method || "GET").toUpperCase() === "POST") {
    try {
      const { neuroCache } = await import("./services/neuro-cache.mjs");
      let body = "";
      for await (const chunk of req) body += chunk;
      let data = {};
      try { data = JSON.parse(body || "{}"); } catch {}
      const result = await neuroCache.prewarmStream(data.showId, data.nextEpisodeNumber, data.nextMediaId);
      const { buffer, ...safeResult } = result;
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, prewarmed: safeResult }));
      return true;
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: String(err) }));
      return true;
    }
  }

  // Native HTTP Range Stream Server: /api/stream/* (sample & torrent streams)
  if (urlPath === "/api/stream" || urlPath.startsWith("/api/stream/")) {
    const { handleStreamRequest } = await import("./services/neural-stream-server.mjs");
    const stateDir = process.env.REELOS_STATE || (process.platform === "win32" ? join(process.cwd(), ".reelos-state") : "/var/lib/reelos");
    if (await handleStreamRequest(req, res, { stateDir })) return true;
  }

  // Legal external availability is looked up server-side so metadata credentials
  // never enter the browser. Destinations are returned only when supplied by TMDB.
  if (urlPath === "/api/availability") {
    const { handleStreamingAvailabilityRoute } = await import("./services/streaming-availability-service.mjs");
    if (await handleStreamingAvailabilityRoute(req, res)) return true;
  }

  // Native ReelOS authority: acquisitions, registry, capabilities, resources,
  // and explicit retirement of unsafe prototype intelligence endpoints.
  {
    const { handleNativeControlPlaneRoute } = await import("./services/native-control-plane-routes.mjs");
    if (await handleNativeControlPlaneRoute(req, res)) return true;
  }

  // Dynamic Neural Taste Bubbles: /api/cinema/taste-bubbles
  if (urlPath === "/api/cinema/taste-bubbles" || urlPath.startsWith("/api/cinema/taste-bubbles/")) {
    const { handleTasteBubblesRoute } = await import("./services/neural-taste-bubbles-service.mjs");
    if (await handleTasteBubblesRoute(req, res)) return true;
  }
  // Synchronized WatchParty REST & Sync: /api/watchparty/*
  if (urlPath === "/api/watchparty" || urlPath.startsWith("/api/watchparty/")) {
    const { watchPartyService } = await import("./services/watchparty-service.mjs");
    if (await watchPartyService.handleHttp(req, res)) return true;
  }

  // Living Room Console Gaming Sentinel: /api/network/console-sentinel/*
  if (urlPath === "/api/network/console-sentinel" || urlPath.startsWith("/api/network/console-sentinel/")) {
    const { handleConsoleSentinelRoute } = await import("./services/console-sentinel.mjs");
    if (await handleConsoleSentinelRoute(req, res)) return true;
  }

  // Adversarial Chaos Monkey Control Plane: /api/chaos/*
  if (urlPath === "/api/chaos" || urlPath.startsWith("/api/chaos/")) {
    const { handleChaosRoute } = await import("./services/chaos-monkey-service.mjs");
    if (await handleChaosRoute(req, res)) return true;
  }

  // Autonomous Subtitles Engine & VAD Alignment: /api/subtitles/*
  if (urlPath === "/api/subtitles" || urlPath.startsWith("/api/subtitles/")) {
    const { handleSubtitlesStatus, handleSubtitlesSearch, handleSubtitlesTrack, handleSubtitlesSync } = await import("./services/subtitle-service.mjs");
    if (urlPath === "/api/subtitles/status") { await handleSubtitlesStatus(req, res); return true; }
    if (urlPath === "/api/subtitles/search") { await handleSubtitlesSearch(req, res); return true; }
    if (urlPath.startsWith("/api/subtitles/track/")) { await handleSubtitlesTrack(req, res); return true; }
    if (urlPath === "/api/subtitles/sync") { await handleSubtitlesSync(req, res); return true; }
    await handleSubtitlesStatus(req, res);
    return true;
  }

  // Thoughtful Living Room Standby Ambiance: /api/standby/*
  if (urlPath === "/api/standby" || urlPath.startsWith("/api/standby/")) {
    const { handleStandbyRoute } = await import("./services/standby-service.mjs");
    await handleStandbyRoute(req, res);
    return true;
  }

  // Dual-Personality Appliance & Household Grid Mesh: /api/system/remote-compute & /api/grid/*
  if (urlPath === "/api/system/remote-compute" || urlPath.startsWith("/api/grid/")) {
    const { HouseholdGridService } = await import("./services/household-grid-service.mjs");
    if (!globalThis.__householdGridService) {
      globalThis.__householdGridService = new HouseholdGridService();
      globalThis.__householdGridService.startBeacon();
    }
    const gridService = globalThis.__householdGridService;

    if (urlPath === "/api/system/remote-compute") {
      if ((req.method || "GET").toUpperCase() === "POST") {
        let body = "";
        for await (const chunk of req) body += chunk;
        let data = {};
        try { data = JSON.parse(body || "{}"); } catch {}
        const status = await gridService.setRemoteCompute(data.enabled);
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(status));
        return true;
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(gridService.getStatus()));
      return true;
    }

    if (urlPath.startsWith("/api/grid/")) {
      const { handleGridRoute } = await import("./services/household-grid-service.mjs");
      if (await handleGridRoute(req, res, gridService)) return true;
    }
  }

  // 100% In-RAM Neural Transcoder & Zero-Disk Buffer: /api/transcode/*
  if (urlPath === "/api/transcode" || urlPath.startsWith("/api/transcode/")) {
    const { inRamTranscoder } = await import("./services/in-ram-transcoder-service.mjs");
    globalThis.__inRamTranscoderModule = { inRamTranscoder };
    if (urlPath === "/api/transcode/stats" || urlPath === "/api/transcode") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, ...inRamTranscoder.getStats() }));
      return true;
    }
  }

  // TorBox Courtesy & Rate-Limit Shield Telemetry: /api/torbox/*
  if (urlPath === "/api/torbox" || urlPath.startsWith("/api/torbox/")) {
    const { torBoxShield } = await import("./services/torbox-shield-service.mjs");
    if (urlPath === "/api/torbox/stats" || urlPath === "/api/torbox") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, ...torBoxShield.getStats() }));
      return true;
    }
  }

  // Dual-Brain Co-Processor & Reflex Engine: /api/dual-brain/*, /api/ambient/*, /api/companion/*
  if (urlPath.startsWith("/api/dual-brain/") || urlPath.startsWith("/api/ambient/") || urlPath.startsWith("/api/companion/") || urlPath.startsWith("/api/scenes/")) {
    const { dualBrainService } = await import("./services/dual-brain-service.mjs");
    const { microTrailerService } = await import("./services/micro-trailer-service.mjs");

    if (urlPath === "/api/dual-brain/stats") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, ...dualBrainService.getStats() }));
      return true;
    }

    if (urlPath === "/api/ambient/palette") {
      const palette = dualBrainService.extractAmbientPalette();
      res.statusCode = palette.ok ? 200 : 422;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(palette));
      return true;
    }

    if (urlPath === "/api/companion/context") {
      const url = new URL(req.url, "http://127.0.0.1");
      const titleId = url.searchParams.get("titleId") || "default";
      const ts = Number(url.searchParams.get("ts") || 0);
      const ctx = dualBrainService.getCompanionContext(titleId, ts);
      res.statusCode = ctx.ok ? 200 : 422;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, ...ctx }));
      return true;
    }

    if (urlPath === "/api/scenes/search") {
      const url = new URL(req.url, "http://127.0.0.1");
      const titleId = url.searchParams.get("titleId") || "default";
      const q = url.searchParams.get("q") || "";
      const result = microTrailerService.findSceneTimestamp(titleId, q);
      res.statusCode = result.ok ? 200 : 422;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
      return true;
    }
  }

  // Next-Gen Sensory Intelligence: Commentary, Recaps, Acoustic Tuning, Mood Manifold, Soundtrack, Cinemagraph, Profanity Shield, Debrid Pre-warm, Dramaturg, Ambient Lighting, Child Profile, Companion Presence
  if (urlPath.startsWith("/api/commentary/") || urlPath.startsWith("/api/recap/") || urlPath.startsWith("/api/acoustic/") || urlPath.startsWith("/api/mood/") || urlPath.startsWith("/api/soundtrack/") || urlPath.startsWith("/api/cinemagraph/") || urlPath.startsWith("/api/audio/profanity-shield") || urlPath.startsWith("/api/stream/pre-warm") || urlPath.startsWith("/api/dramaturg/") || urlPath.startsWith("/api/lighting/") || urlPath.startsWith("/api/child-profile/") || urlPath.startsWith("/api/companion/presence-filter")) {
    const { dualBrainService } = await import("./services/dual-brain-service.mjs");
    const { inRamTranscoder } = await import("./services/in-ram-transcoder-service.mjs");

    if (urlPath === "/api/commentary/scene" || urlPath === "/api/commentary/stream") {
      const url = new URL(req.url, "http://127.0.0.1");
      const titleId = url.searchParams.get("titleId") || "default";
      const ts = Number(url.searchParams.get("ts") || 0);
      const perspective = url.searchParams.get("perspective") || "director";
      const commentary = dualBrainService.generateCommentary(titleId, ts, perspective);
      res.statusCode = commentary.ok ? 200 : 422;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(commentary));
      return true;
    }

    if (urlPath === "/api/recap/catchmeup") {
      const url = new URL(req.url, "http://127.0.0.1");
      const titleId = url.searchParams.get("titleId") || "default";
      const progress = Number(url.searchParams.get("progress") || 0);
      const ep = Number(url.searchParams.get("ep") || 1);
      const recap = dualBrainService.generateCatchMeUp(titleId, progress, ep);
      res.statusCode = recap.ok ? 200 : 422;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(recap));
      return true;
    }

    if (urlPath === "/api/acoustic/tune") {
      let body = "";
      for await (const chunk of req) body += chunk;
      let data = {};
      try { data = JSON.parse(body || "{}"); } catch {}
      const tuning = dualBrainService.tuneAcousticRoom(data);
      res.statusCode = tuning.ok ? 200 : 422;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(tuning));
      return true;
    }

    if (urlPath === "/api/acoustic/impulse-profile") {
      let data = {};
      if (req.method === "POST") {
        let body = "";
        for await (const chunk of req) body += chunk;
        try { data = JSON.parse(body || "{}"); } catch {}
      } else {
        const url = new URL(req.url, "http://127.0.0.1");
        data.rt60 = url.searchParams.has("rt60") ? Number(url.searchParams.get("rt60")) : NaN;
        data.measured = url.searchParams.get("measured") === "true";
      }
      if (data.measured !== true || !Number.isFinite(Number(data.rt60))) {
        res.statusCode = 422;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: false, available: false, error: "A real microphone measurement is required before an impulse profile can be applied." }));
        return true;
      }
      const profile = inRamTranscoder.applyRoomImpulseProfile(data.rt60, data.nodes);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(profile));
      return true;
    }

    if (urlPath === "/api/mood/manifold") {
      const url = new URL(req.url, "http://127.0.0.1");
      const hour = url.searchParams.has("hour") ? Number(url.searchParams.get("hour")) : undefined;
      const mood = dualBrainService.predictMoodManifold({ hour });
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(mood));
      return true;
    }

    if (urlPath === "/api/soundtrack/current") {
      const url = new URL(req.url, "http://127.0.0.1");
      const titleId = url.searchParams.get("titleId") || "default";
      const ts = Number(url.searchParams.get("ts") || 0);
      const soundtrack = dualBrainService.getNeedleDrop(titleId, ts);
      res.statusCode = soundtrack.ok ? 200 : 422;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(soundtrack));
      return true;
    }

    if (urlPath === "/api/subtitles/kinesthetic") {
      const url = new URL(req.url, "http://127.0.0.1");
      const text = url.searchParams.get("text") || "";
      const energy = Number(url.searchParams.get("energy") || 0.5);
      const whisper = url.searchParams.get("whisper") === "true";
      const formatted = dualBrainService.formatKinestheticSubtitle(text, energy, whisper);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(formatted));
      return true;
    }

    if (urlPath.startsWith("/api/cinemagraph/")) {
      const parts = urlPath.split("/").filter(Boolean);
      const titleId = parts[2] || "default";
      const loop = dualBrainService.getCinemagraphLoop(titleId);
      res.statusCode = loop.ok ? 200 : 422;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(loop));
      return true;
    }

    // SECTION 69: Family Cinema Shield
    if (urlPath === "/api/audio/profanity-shield/levels") {
      const levels = dualBrainService.getProfanitySeverityTiers();
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(levels));
      return true;
    }

    if (urlPath === "/api/audio/profanity-shield") {
      let payload = {};
      if (req.method === "POST") {
        let body = "";
        for await (const chunk of req) body += chunk;
        try { payload = JSON.parse(body || "{}"); } catch {}
      } else {
        const url = new URL(req.url, "http://127.0.0.1");
        payload.input = url.searchParams.get("text") || url.searchParams.get("q") || "";
        payload.severityLevel = url.searchParams.has("level") ? Number(url.searchParams.get("level")) : 2;
        payload.filterBlasphemy = url.searchParams.get("blasphemy") === "true";
        payload.redactionMode = url.searchParams.get("redaction") || "mask";
        payload.audioSilencingMode = url.searchParams.get("silence") || "mute";
      }
      const result = dualBrainService.processProfanityShield(payload.input, payload);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
      return true;
    }

    // SECTION 69: Predictive Debrid Warming
    if (urlPath === "/api/stream/pre-warm") {
      let data = {};
      if (req.method === "POST") {
        let body = "";
        for await (const chunk of req) body += chunk;
        try { data = JSON.parse(body || "{}"); } catch {}
      } else {
        const url = new URL(req.url, "http://127.0.0.1");
        data.titleId = url.searchParams.get("titleId") || "default";
        data.progress = Number(url.searchParams.get("progress") || 0);
      }
      const preWarm = dualBrainService.predictNextDebridTarget(data.titleId, data.progress);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(preWarm));
      return true;
    }

    // SECTION 69: The Cinema Dramaturg Character Graph
    if (urlPath === "/api/dramaturg/character-graph") {
      const url = new URL(req.url, "http://127.0.0.1");
      const titleId = url.searchParams.get("titleId") || "dune";
      const ts = Number(url.searchParams.get("ts") || 0);
      const graph = dualBrainService.getDramaturgGraph(titleId, ts);
      res.statusCode = graph.ok ? 200 : 422;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(graph));
      return true;
    }

    // SECTION 69: 16-Color Dynamic Ambient Light Choreography
    if (urlPath === "/api/lighting/ambient-palette") {
      const url = new URL(req.url, "http://127.0.0.1");
      const titleId = url.searchParams.get("titleId") || "default";
      const ts = Number(url.searchParams.get("ts") || 0);
      const palette = dualBrainService.getAmbientSpectralPalette(titleId, ts);
      res.statusCode = palette.ok ? 200 : 422;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(palette));
      return true;
    }

    // SECTION 70: Child Profile Training & Governance
    if (urlPath === "/api/child-profile/deck") {
      const { childProfileService } = await import("./services/child-profile-service.mjs");
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(childProfileService.getChildDeck()));
      return true;
    }

    if (urlPath === "/api/child-profile/calibrate") {
      const { childProfileService } = await import("./services/child-profile-service.mjs");
      let body = "";
      for await (const chunk of req) body += chunk;
      let data = {};
      try { data = JSON.parse(body || "{}"); } catch {}
      const profileId = data.profileId || "child_default";
      const result = childProfileService.calibrateChildProfile(profileId, data);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
      return true;
    }

    if (urlPath === "/api/child-profile/catalog") {
      const { childProfileService } = await import("./services/child-profile-service.mjs");
      const url = new URL(req.url, "http://127.0.0.1");
      const profileId = url.searchParams.get("profileId") || "";
      let body = "";
      for await (const chunk of req) body += chunk;
      let data = {};
      try { data = JSON.parse(body || "{}"); } catch {}
      if (req.method !== "POST" || !Array.isArray(data.catalog)) {
        res.statusCode = 409;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: false, profileId, error: "A real catalog snapshot is required; ReelOS will not invent child titles." }));
        return true;
      }
      const curated = childProfileService.filterCatalogForChild(profileId || data.profileId, data.catalog);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, profileId, count: curated.length, titles: curated }));
      return true;
    }

    if (urlPath === "/api/child-profile/pin/verify") {
      res.statusCode = 410;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, verified: false, error: "Use the secure /api/profiles/:id/verify-pin route." }));
      return true;
    }

    if (urlPath === "/api/child-profile/pin/set") {
      res.statusCode = 410;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "Save the child profile through /api/profiles so the PIN is hashed once." }));
      return true;
    }

    // SECTION 70.5: Mobile Companion "Who's in the Room?" Presence Slider
    if (urlPath === "/api/companion/presence-filter") {
      const { childProfileService } = await import("./services/child-profile-service.mjs");
      if (req.method === "POST") {
        let body = "";
        for await (const chunk of req) body += chunk;
        let data = {};
        try { data = JSON.parse(body || "{}"); } catch {}
        const result = childProfileService.setRoomPresence(data.sessionId || "living_room_tv", data);
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result));
        return true;
      } else {
        const url = new URL(req.url, "http://127.0.0.1");
        const sessionId = url.searchParams.get("sessionId") || "living_room_tv";
        const current = childProfileService.getRoomPresence(sessionId);
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(current));
        return true;
      }
    }
  }

  const { dispatchRequestGet } = await import("./reelos-request-progress-plugin.mjs");
  const { dispatchEpisodes } = await import("./reelos-episodes-plugin.mjs");
  const { dispatchReelOsApi } = await import("./reelos-lookup-plugin.mjs");
  if (await dispatchRequestGet(req, res)) return true;
  if (await dispatchEpisodes(req, res)) return true;
  if (await dispatchReelOsApi(req, res)) return true;

  // Stateless JIT Jellyfin Shim for Swiftfin, Infuse, and Android TV
  try {
    const { createJellyfinShimHandler } = await import("./services/jellyfin-shim-service.mjs");
    if (!globalThis.__jfShimHandler) {
      globalThis.__jfShimHandler = createJellyfinShimHandler();
    }
    if (await globalThis.__jfShimHandler(req, res)) return true;
  } catch {}

  return false;
}

function staticRoots(root, clientRoot) {
  const dirs = [];
  if (clientRoot) dirs.push(clientRoot);
  const pub = join(root, "public");
  if (existsSync(pub)) dirs.push(pub);
  return dirs;
}

function tryStatic(res, roots, urlPath, req = null) {
  for (const dir of roots) {
    const file = safeJoin(dir, urlPath);
    if (file && existsSync(file) && statSync(file).isFile()) {
      sendFile(res, file, 200, req);
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

  // Wire WebSocket upgrade for True Synchronized WatchParty
  server.on("upgrade", async (req, socket, head) => {
    // Safe TCP upgrade error listener attached synchronously BEFORE any await or socket write
    if (!socket._hasUpgradeErrorHandler) {
      socket._hasUpgradeErrorHandler = true;
      socket.on("error", () => {
        try { socket.destroy(); } catch {}
      });
    }
    try {
      const urlPath = (req.url || "/").split("?")[0] || "/";
      if (urlPath.startsWith("/ws/watchparty") || urlPath.startsWith("/api/watchparty")) {
        const { watchPartyService } = await import("./services/watchparty-service.mjs");
        if (watchPartyService.handleUpgrade(req, socket, head)) return;
      }
    } catch {}
    socket.destroy();
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(PORT, HOST, () => resolve(server));
  });
}


function startStatic(clientRoot, root = ROOT) {
  const roots = staticRoots(root, clientRoot);
  prewarmStaticCache(roots);
  return startHttpApi(async (req, res) => {
    const urlPath = (req.url || "/").split("?")[0] || "/";
    if (urlPath === "/setup" || urlPath === "/setup/") {
      res.writeHead(302, { Location: "/" });
      res.end();
      return;
    }
    if (urlPath !== "/" && tryStatic(res, roots, urlPath, req)) return;
    const index = join(clientRoot, "index.html");
    if (wantsHtml(req) && existsSync(index) && (req.method || "GET").toUpperCase() === "GET") {
      sendFile(res, index, 200, req);
      return;
    }
    if (urlPath === "/" && tryStatic(res, roots, "/index.html", req)) return;
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
  prewarmStaticCache(roots);
  const server = await startHttpApi(async (req, res) => {
    const urlPath = (req.url || "/").split("?")[0] || "/";
    if (urlPath === "/setup" || urlPath === "/setup/") {
      res.writeHead(302, { Location: "/" });
      res.end();
      return;
    }
    if (urlPath !== "/" && tryStatic(res, roots, urlPath, req)) return;
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
  if (process.platform === "win32") {
    return globalThis.__reelosActiveStreams > 0 ? "jellyfin ffmpeg active-stream" : "";
  }
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

export function killOrphanPortPids(pids, { kill = process.kill, selfPid = process.pid } = {}) {
  const targets = [...new Set((pids || []).map(Number).filter((n) => n > 1 && n !== selfPid))];
  for (const pid of targets) {
    try {
      if (process.platform === "win32" && kill === process.kill) {
        execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
      } else {
        kill(pid, "SIGTERM");
      }
    } catch {
      /* already gone */
    }
  }
  return targets;
}

export function orphanPidsOnPort(port = PORT, { selfPid = process.pid } = {}) {
  const pids = [];
  try {
    if (process.platform === "win32") {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
      for (const line of out.split("\n")) {
        if (line.includes("LISTENING")) {
          const parts = line.trim().split(/\s+/);
          const pid = Number(parts[parts.length - 1]);
          if (pid && pid !== selfPid && pid > 4) pids.push(pid);
        }
      }
    } else {
      const inodes = new Set();
      for (const file of ["/proc/net/tcp", "/proc/net/tcp6"]) {
        try {
          const dump = readFileSync(file, "utf8");
          for (const inode of parseListenerInodes(dump, Number(port))) inodes.add(inode);
        } catch {}
      }
      if (!inodes.size) return [];
      const targets = new Set([...inodes].map((inode) => `socket:[${inode}]`));
      let entries = [];
      try { entries = readdirSync("/proc"); } catch { return []; }
      for (const entry of entries) {
        const pid = Number(entry);
        if (!Number.isInteger(pid) || pid <= 1 || pid === selfPid) continue;
        try {
          const fds = readdirSync(`/proc/${pid}/fd`);
          for (const fd of fds) {
            try {
              if (targets.has(readlinkSync(`/proc/${pid}/fd/${fd}`))) {
                pids.push(pid);
                break;
              }
            } catch {}
          }
        } catch {}
      }
    }
  } catch {}
  return pids;
}

/** One Node on :8080. Kill leftover vite/nitro from a previous start, plus port 8096 shim. */
export function killOrphan8080({ port = PORT, kill = process.kill, selfPid = process.pid, ...scan } = {}) {
  const pids = [
    ...orphanPidsOnPort(port, { ...scan, selfPid }),
    ...(Number(port) === 8080 ? orphanPidsOnPort(8096, { ...scan, selfPid }) : []),
  ];
  return killOrphanPortPids(pids, { kill, selfPid });
}

export function ensureHardwareProfile(root = ROOT) {
  const homeState = process.platform === "win32" ? join(process.env.USERPROFILE || "", "reelos", ".reelos-state") : "/var/lib/reelos";
  const localState = join(root, ".reelos-state");
  const state = process.env.REELOS_STATE || (existsSync(localState) ? localState : homeState);
  mkdirSync(state, { recursive: true });

  const saved = join(state, "hardware-profile.json");
  if (os.platform() === "win32") {
    if (existsSync(saved)) return { ran: true, skippedSync: true };
    try {
      const cpusInfo = os.cpus() || [];
      const cpus = cpusInfo.length || 1;
      const cpuModel = cpusInfo[0]?.model || "";
      const memKb = Math.round(os.totalmem() / 1024);
      const ramGb = Math.round(((memKb / 1024 / 1024)) * 100) / 100;
      const gpuType = detectGpuType({ cpuModel });
      const hasHwGpu = ["qsv", "nvenc", "vaapi"].includes(gpuType);
      const tiny = memKb > 0 && memKb <= 4_718_592;
      const potatoMode = tiny || !hasHwGpu;
      const summary = `${ramGb}Gi RAM · ${cpuModel} · SSD · root-on-internal`;
      const profile = {
        probe_version: 2,
        probed_at: new Date().toISOString(),
        ram_kb: memKb,
        ram_gb: ramGb,
        cpus,
        cpu_model: cpuModel,
        gpu_type: gpuType,
        disk_kind: "ssd",
        disk_type_label: "SSD",
        disk_size_gb: 500,
        disk_free_gb: 100,
        product: "Windows Host",
        root_on_usb: false,
        tiny,
        box_is_small: tiny,
        summary,
        knobs: {
          low_perf: tiny,
          gpu_type: gpuType,
          potato_mode: potatoMode,
          fuse_count: tiny ? 1 : 4,
          skip_dump_ffprobe: tiny,
          zram: false,
          disable_kdump: tiny,
          search_parallelism: cpus > 1 ? Math.min(4, cpus) : 1,
          indexer_parallelism: cpus > 1 ? Math.min(4, cpus) : 1,
        },
      };
      writeFileSync(saved, JSON.stringify(profile, null, 2) + "\n", "utf8");
      return { ran: true, skippedSync: false };
    } catch (e) {
      return { ran: false, error: e.message };
    }
  }

  const py = existsSync(join(root, "bin/reelos_hardware.py"))
    ? join(root, "bin/reelos_hardware.py")
    : join(root, "daemon/reelos_hardware.py");
  if (!existsSync(py)) return { ran: false };

  if (existsSync(saved)) {
    spawn("python3", [py, "--ensure"], { detached: true, stdio: "ignore" }).unref();
    return { ran: true, skippedSync: true };
  }
  const r = spawnSync("python3", [py, "--ensure"], { encoding: "utf8", timeout: 8000 });
  return { ran: true, skippedSync: false, status: r.status };
}

function idleOffBooks() {
  void import("./reelos-beta-sidecar.mjs")
    .then((m) => m.idleOffBooksIfNeeded())
    .catch(() => {});
}

export async function startBox({ root = ROOT } = {}) {
  // Co-operatively demote process priority so ReelOS never competes with host games/apps
  try {
    const { politeScheduler } = await import("./services/polite-scheduler.mjs");
    politeScheduler.start();
  } catch {}

  // Start Living Room Console Gaming Sentinel (ping loop & ARP watcher)
  try {
    const { consoleSentinel } = await import("./services/console-sentinel.mjs");
    const { attachConsoleSentinelQoS } = await import("./services/neural-stream-server.mjs");
    attachConsoleSentinelQoS(consoleSentinel);
    consoleSentinel.startPingLoop(5000);
  } catch {}


  // One local intelligence system owns event truth, capability lifecycle,
  // resource admission, model validation and deterministic fallbacks. Legacy
  // fleet/gossip learners are deliberately not started by the appliance: no
  // household learning leaves this machine unless a future reviewed feature
  // explicitly earns that boundary.
  try {
    const { getReelIntelligenceSystem } = await import("./services/reel-intelligence-system.mjs");
    globalThis.__reelIntelligenceSystem = await getReelIntelligenceSystem({
      stateDir: process.env.REELOS_STATE || (process.platform === "win32" ? join(root, ".reelos-state") : "/var/lib/reelos"),
    });
    console.log("[reelos-box] Local intelligence coordinator ready");
  } catch (err) {
    globalThis.__reelIntelligenceSystem = null;
    console.log(`[reelos-box] Local intelligence unavailable; safe fallbacks remain active (${err.message})`);
  }

  // Start Multi-Tier Storage Pools & LRU Watchdog (<10% Free)
  try {
    const { storageWatchdog } = await import("./services/storage-service.mjs");
    storageWatchdog.startWatchdog(60000);
  } catch {}

  // Start Zero-Config Household Mesh Beacon
  try {
    const { HouseholdGridService } = await import("./services/household-grid-service.mjs");
    if (!globalThis.__householdGridService) {
      globalThis.__householdGridService = new HouseholdGridService();
      globalThis.__householdGridService.startBeacon();
    }
  } catch {}

  ensureHardwareProfile(root);
  killOrphan8080();

  // Launch standalone Jellyfin Shim on :8096 for Swiftfin/Infuse/Android TV clients
  let shimServer = null;
  if (PORT === 8080) {
    try {
      const { startJellyfinShimServer } = await import("./services/jellyfin-shim-service.mjs");
      shimServer = await startJellyfinShimServer({ port: 8096, host: "0.0.0.0" }).catch((err) => {
        console.log(`[reelos-box] Port 8096 unavailable or shim startup skipped (${err.message})`);
        return null;
      });
    } catch {}
  }

  // Launch Machine Overseer (Hierarchical Machine Sentry - Section 53)
  try {
    const { getMachineOverseer } = await import("./services/machine-overseer-service.mjs");
    const isDedicated = existsSync("/var/lib/reelos") || process.platform === "linux" || process.env.REELOS_DEDICATED === "1";
    const overseer = getMachineOverseer({
      stateDir: process.env.REELOS_STATE || (process.platform === "win32" ? join(root, ".reelos-state") : "/var/lib/reelos"),
      isDedicated,
    });
    overseer.start(60000);
    console.log(`[reelos-box] Machine Overseer active (Sentry tier: ${overseer.resolveAllocation().tier})`);
  } catch (err) {
    console.log(`[reelos-box] Machine Overseer startup notice: ${err.message}`);
  }

  const client = findClientRoot(root);
  if (client) {
    const server = await startStatic(client, root);
    armSelfHeal();
    idleOffBooks();
    return { mode: "static", client, server };
  }
  const nitro = findNitroOutput(root);
  if (nitro && existsSync(join(nitro, "functions/__server.func/index.mjs"))) {
    try {
      const server = await startNitroPlusApi(nitro, root);
      armSelfHeal();
      idleOffBooks();
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
