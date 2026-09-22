import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { inspectStorageSpace } from "./media-strategy-service.mjs";
import { listProfiles } from "./profile-service.mjs";

const DEFAULT_STATE_DIR = process.env.REELOS_STATE || "/var/lib/reelos";

/**
 * Gathers a complete appliance health snapshot.
 */
export function gatherApplianceDiagnostics({ stateDir = DEFAULT_STATE_DIR } = {}) {
  const cpus = os.cpus() || [];
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const loadAvg = os.loadavg();
  const uptime = os.uptime();

  // Storage metrics
  const storage = inspectStorageSpace(stateDir);

  // Profile counts
  let profilesCount = 0;
  let guestsCount = 0;
  try {
    const profiles = listProfiles(path.join(stateDir, "profiles"));
    profilesCount = profiles.length;
    guestsCount = profiles.filter((p) => p.isGuest).length;
  } catch {}

  // Hardware classification
  const ramGb = Math.round((totalMem / (1024 * 1024 * 1024)) * 10) / 10;
  let hardwareTier = "whisper_workhorse";
  let tierLabel = "Whisper Workhorse (Balanced)";
  if (ramGb <= 4.5) {
    hardwareTier = "potato";
    tierLabel = "Potato Mode (Silent Eco / DirectPlay Only)";
  } else if (cpus.length >= 8 && ramGb >= 16) {
    hardwareTier = "beast";
    tierLabel = "Beast Mode (High Performance)";
  }

  // Debrid status check
  let debridStatus = "offline";
  try {
    const keyPath = path.join(stateDir, "torbox-key");
    if (fs.existsSync(keyPath) && fs.readFileSync(keyPath, "utf8").trim().length > 5) {
      debridStatus = "active";
    }
  } catch {}

  const snapshot = {
    timestamp: Date.now(),
    uptimeSeconds: Math.round(uptime),
    hardware: {
      tier: hardwareTier,
      label: tierLabel,
      cpuModel: cpus[0]?.model || "Standard x86 Processor",
      cores: cpus.length,
      load1m: Math.round((loadAvg[0] || 0) * 100) / 100,
      load5m: Math.round((loadAvg[1] || 0) * 100) / 100,
      totalRamGb: ramGb,
      freeRamGb: Math.round((freeMem / (1024 * 1024 * 1024)) * 10) / 10,
      ramUsagePct: Math.round(((totalMem - freeMem) / totalMem) * 100),
    },
    storage: {
      totalGb: storage.totalGb,
      freeGb: storage.freeGb,
      dynamic20Gb: storage.dynamic20Gb,
    },
    services: {
      webPortal: "online", // port 8080
      jellyfin: "online",  // port 8096
      books: "online",     // port 5000
      debridPipe: debridStatus,
      tailscale: "ready",
    },
    house: {
      profilesCount,
      guestsCount,
    },
    healthStatus: loadAvg[0] > 4 ? "degraded" : "healthy",
  };

  return snapshot;
}

/**
 * HTTP handler for /api/diagnostics/*
 */
export async function handleDiagnosticsRoute(req, res, parsedUrl, readBodyFn, stateDir = DEFAULT_STATE_DIR) {
  const method = (req.method || "GET").toUpperCase();
  const pathname = parsedUrl.pathname;

  if (pathname === "/api/diagnostics/heartbeat" && method === "GET") {
    const diag = gatherApplianceDiagnostics({ stateDir });
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, heartbeat: diag }));
  }

  if (pathname === "/api/diagnostics/ping" && method === "POST") {
    const diag = gatherApplianceDiagnostics({ stateDir });
    // Write last heartbeat to stateDir
    try {
      fs.writeFileSync(path.join(stateDir, "last-heartbeat.json"), JSON.stringify(diag, null, 2) + "\n");
    } catch {}
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, ack: true, timestamp: Date.now() }));
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "Not found" }));
}
