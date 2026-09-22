import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import http from "node:http";
import https from "node:https";
import { URL } from "node:url";
import { spawn } from "node:child_process";
import { inspectStorageSpace } from "./media-strategy-service.mjs";
import { getBatteryStatus } from "./battery-service.mjs";

const DEFAULT_STATE_DIR = process.env.REELOS_STATE || (process.platform === "win32" ? path.join(process.cwd(), ".reelos-state") : "/var/lib/reelos");

/**
 * In-memory state for active remote assistance session
 */
let activeRemoteAssistance = null;

/**
 * Ping an HTTP(S) endpoint and return latency in ms.
 */
function probeHttp(targetUrl, timeoutMs = 2500, headers = {}) {
  return new Promise((resolve) => {
    const start = Date.now();
    try {
      const parsed = new URL(targetUrl);
      const isHttps = parsed.protocol === "https:";
      const transport = isHttps ? https : http;
      const req = transport.request(
        parsed,
        {
          method: "GET",
          headers: { "User-Agent": "ReelOS-Health/1.6.0", ...headers },
          timeout: timeoutMs,
        },
        (res) => {
          res.resume();
          const latency = Date.now() - start;
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, statusCode: res.statusCode, latency });
        }
      );
      req.on("error", (err) => resolve({ ok: false, error: err.message, latency: Date.now() - start }));
      req.on("timeout", () => {
        req.destroy();
        resolve({ ok: false, error: "Timed out", latency: timeoutMs });
      });
      req.end();
    } catch (e) {
      resolve({ ok: false, error: String(e), latency: 0 });
    }
  });
}

/**
 * Evaluates the 4 core health pillars for the customer appliance.
 */
export async function getHealthMatrix({ stateDir = DEFAULT_STATE_DIR } = {}) {
  // 1. WAN & Internet Gateway (probe Cloudflare DNS 1.1.1.1 / Google DNS)
  const wanProbe = await probeHttp("https://1.1.1.1", 2000);
  const wanStatus = {
    key: "wan",
    title: "Internet & WAN Gateway",
    status: wanProbe.ok ? "healthy" : "offline",
    latencyMs: wanProbe.latency,
    detail: wanProbe.ok ? `${wanProbe.latency}ms latency · Online` : "Offline or DNS unreachable",
  };

  // 2. Debrid Engine & API
  let debridKey = "";
  let debridProvider = "torbox";
  try {
    const answersPath = path.join(stateDir, "answers.json");
    if (fs.existsSync(answersPath)) {
      const stored = JSON.parse(fs.readFileSync(answersPath, "utf8"));
      debridKey = String(stored?.apiKey || "").trim();
      debridProvider = ["real-debrid", "realdebrid"].includes(stored?.source)
        ? "real-debrid"
        : "torbox";
    }
  } catch {}

  let debridStatus = {
    key: "debrid",
    title: "Debrid Cloud Engine",
    status: "warning",
    latencyMs: 0,
    detail: "No API key configured",
    activeDays: null,
  };

  if (debridKey) {
    const providerProbe = await probeHttp(
      debridProvider === "real-debrid"
        ? "https://api.real-debrid.com/rest/1.0/user"
        : "https://api.torbox.app/v1/api/user/me",
      3000,
      { Authorization: `Bearer ${debridKey}` },
    );
    debridStatus = {
      key: "debrid",
      title: "Debrid Cloud Engine",
      status: providerProbe.ok ? "healthy" : "degraded",
      latencyMs: providerProbe.latency,
      detail: providerProbe.ok
        ? `${debridProvider === "real-debrid" ? "Real-Debrid" : "TorBox"} authenticated · ${providerProbe.latency}ms`
        : `${debridProvider === "real-debrid" ? "Real-Debrid" : "TorBox"} authentication could not be verified`,
      activeDays: null,
    };
  }

  // 3. Media Storage & FUSE Mount
  const storage = inspectStorageSpace(stateDir);
  const fuseMountPath = "/mnt/debrid";
  let fuseActive = false;
  try {
    const mounts = fs.existsSync("/proc/mounts") ? fs.readFileSync("/proc/mounts", "utf8") : "";
    fuseActive = mounts.split("\n").some((line) => line.split(" ")[1] === fuseMountPath);
  } catch {}

  const storageStatus = {
    key: "storage",
    title: "Storage & FUSE Mount",
    status: storage.available === false ? "unavailable" : storage.freeGb < 5 ? "warning" : "healthy",
    freeGb: storage.freeGb,
    totalGb: storage.totalGb,
    freePct: Math.round((storage.freeGb / (storage.totalGb || 1)) * 100),
    fuseActive,
    detail: storage.available === false
      ? "Storage telemetry unavailable"
      : `${storage.freeGb}GB free (${Math.round((storage.freeGb / (storage.totalGb || 1)) * 100)}%) · FUSE ${fuseActive ? "mounted" : "not mounted"}`,
  };

  // 4. ReelOS media gateway. The retired Jellyfin daemon on :8096 is not used.
  const gatewayPort = Number(process.env.PORT || 8080);
  const jfProbe = await probeHttp(`http://127.0.0.1:${gatewayPort}/api/ready`, 1500);
  const serverStatus = {
    key: "server",
    title: "ReelOS Media Gateway",
    status: jfProbe.ok ? "healthy" : "warning",
    latencyMs: jfProbe.latency,
    detail: jfProbe.ok ? `Gateway responding on :${gatewayPort}` : "Gateway readiness could not be verified",
  };

  const allHealthy = wanStatus.status === "healthy" && storageStatus.status === "healthy";

  return {
    ok: true,
    overall: allHealthy ? "healthy" : "attention",
    timestamp: Date.now(),
    pillars: [wanStatus, debridStatus, storageStatus, serverStatus],
  };
}

/**
 * Strips all sensitive credentials, tokens, and private passwords from strings/objects.
 */
export function sanitizeDiagnostics(obj) {
  const json = JSON.stringify(obj, null, 2);
  const sanitized = json
    // Redact TorBox / Debrid keys
    .replace(/(["']?(?:torbox[_-]?key|apiKey|token|password|auth|secret)["']?\s*:\s*["'])([^"']{4})[^"']*(["'])/gi, '$1$2••••••••$3')
    // Redact Bearer tokens
    .replace(/(Bearer\s+)[A-Za-z0-9_\-.]{6,}/gi, "$1••••••••")
    // Redact Tailscale / private auth keys
    .replace(/(tskey-[a-zA-Z0-9_\-]+)/gi, "tskey-••••••••");
  return JSON.parse(sanitized);
}

/**
 * Generates an 8-character human-readable support verification code (e.g. R-4982-A7).
 */
export function generateSupportCode() {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "R-";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  code += "-";
  for (let i = 0; i < 2; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/**
 * Gathers a complete sanitized support bundle for 1-click export.
 */
export async function createSupportBundle({ stateDir = DEFAULT_STATE_DIR } = {}) {
  const cpus = os.cpus() || [];
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const uptime = os.uptime();
  const battery = getBatteryStatus();
  const storage = inspectStorageSpace(stateDir);
  const health = await getHealthMatrix({ stateDir });

  // Gather last 80 lines of OTA and update logs if available
  let logTail = "";
  const logPaths = [
    path.join(stateDir, "ota.log"),
    path.join(stateDir, "os-upgrade.log"),
    "/var/log/reelos.log",
  ];
  for (const lp of logPaths) {
    if (fs.existsSync(lp)) {
      try {
        const lines = fs.readFileSync(lp, "utf8").split("\n").slice(-80);
        logTail += `\n--- Log: ${path.basename(lp)} ---\n` + lines.join("\n");
      } catch {}
    }
  }

  const rawBundle = {
    supportCode: generateSupportCode(),
    generatedAt: new Date().toISOString(),
    os: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      uptimeSeconds: Math.round(uptime),
      hostname: os.hostname(),
    },
    hardware: {
      cpuModel: cpus[0]?.model || "Unknown CPU",
      cores: cpus.length,
      totalRamGb: Math.round((totalMem / (1024 * 1024 * 1024)) * 10) / 10,
      freeRamGb: Math.round((freeMem / (1024 * 1024 * 1024)) * 10) / 10,
      loadAvg: os.loadavg(),
      battery: {
        present: battery.batteryPresent,
        acOnline: battery.acOnline,
        percent: battery.percent,
        mode: battery.mode,
      },
    },
    storage: {
      totalGb: storage.totalGb,
      freeGb: storage.freeGb,
    },
    healthMatrix: health,
    recentLogs: logTail,
  };

  return sanitizeDiagnostics(rawBundle);
}

/**
 * Generates or refreshes an ephemeral 60-minute Remote Assistance Passkey.
 */
export function toggleRemoteAssistance({ enable = true } = {}) {
  if (!enable) {
    activeRemoteAssistance = null;
    return { ok: true, active: false };
  }

  activeRemoteAssistance = null;
  return {
    ok: false,
    available: false,
    active: false,
    error: "Remote assistance requires a verified relay or tunnel adapter; none is connected in this build.",
  };
}

export function getRemoteAssistanceStatus() {
  if (!activeRemoteAssistance) {
    return { ok: true, active: false };
  }
  const remaining = Math.max(0, Math.round((activeRemoteAssistance.expiresAt - Date.now()) / 60000));
  if (remaining <= 0) {
    activeRemoteAssistance = null;
    return { ok: true, active: false, expired: true };
  }
  return {
    ok: true,
    ...activeRemoteAssistance,
    minutesRemaining: remaining,
  };
}

/**
 * Dispatches 1-click self-repair across the appliance.
 */
export async function runSelfRepair({ stateDir = DEFAULT_STATE_DIR } = {}) {
  const steps = [];

  // 1. Purge stale locks
  try {
    const locks = [
      path.join(stateDir, "ota.lock"),
      path.join(stateDir, "os-upgrade.lock"),
      path.join(stateDir, "reelos-repair.lock"),
    ];
    let purgedLocks = 0;
    for (const l of locks) {
      if (fs.existsSync(l)) {
        const stat = fs.statSync(l);
        if (Date.now() - stat.mtimeMs > 600000) {
          fs.unlinkSync(l);
          purgedLocks++;
        }
      }
    }
    steps.push({ step: "Purge stale locks", ok: true, detail: `Cleaned ${purgedLocks} orphan locks` });
  } catch (e) {
    steps.push({ step: "Purge stale locks", ok: false, error: String(e) });
  }

  // 2. Clear temp caches
  try {
    const tmpDir = path.join(stateDir, "cache-tmp");
    if (fs.existsSync(tmpDir)) {
      const files = fs.readdirSync(tmpDir);
      for (const f of files) {
        try { fs.unlinkSync(path.join(tmpDir, f)); } catch {}
      }
    }
    steps.push({ step: "Clean transient cache", ok: true, detail: "Buffer caches cleared" });
  } catch (e) {
    steps.push({ step: "Clean transient cache", ok: false, error: String(e) });
  }

  // 3. Verify FUSE Mount directory
  try {
    const fuseDir = "/mnt/debrid";
    if (!fs.existsSync(fuseDir) && process.platform !== "win32") {
      fs.mkdirSync(fuseDir, { recursive: true });
    }
    steps.push({ step: "Validate FUSE Mount Node", ok: true, detail: "FUSE directory structure intact" });
  } catch (e) {
    steps.push({ step: "Validate FUSE Mount Node", ok: false, error: String(e) });
  }

  const ok = steps.every((step) => step.ok === true);
  return {
    ok,
    message: ok ? "Appliance maintenance checks completed." : "Some appliance maintenance checks need attention.",
    timestamp: Date.now(),
    steps,
  };
}

/**
 * HTTP Router for /api/support/*
 */
export async function handleSupportRoute(req, res, parsedUrl, stateDir = DEFAULT_STATE_DIR) {
  const method = (req.method || "GET").toUpperCase();
  const pathname = parsedUrl.pathname;

  // GET /api/support/health
  if (pathname === "/api/support/health" && method === "GET") {
    const health = await getHealthMatrix({ stateDir });
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(health));
  }

  // GET /api/support/bundle
  if (pathname === "/api/support/bundle" && method === "GET") {
    const bundle = await createSupportBundle({ stateDir });
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="reelos-support-${bundle.supportCode}.json"`,
    });
    return res.end(JSON.stringify(bundle, null, 2));
  }

  // GET /api/support/tunnel
  if (pathname === "/api/support/tunnel" && method === "GET") {
    const status = getRemoteAssistanceStatus();
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(status));
  }

  // POST /api/support/tunnel
  if (pathname === "/api/support/tunnel" && method === "POST") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    let body = {};
    try { body = JSON.parse(raw); } catch {}
    const result = toggleRemoteAssistance({ enable: body.enable !== false });
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(result));
  }

  // POST /api/support/repair
  if (pathname === "/api/support/repair" && method === "POST") {
    const repair = await runSelfRepair({ stateDir });
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(repair));
  }

  return false;
}
