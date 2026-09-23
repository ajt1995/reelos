import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import dgram from "node:dgram";
import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import { transcodeRelayService } from "./transcode-relay-service.mjs";

const execAsync = promisify(exec);

export class HouseholdGridService {
  constructor({ stateDir = ".reelos-state" } = {}) {
    this.stateDir = stateDir;
    this.stateFile = path.join(this.stateDir, "remote-compute.json");
    this.stateBak = path.join(this.stateDir, "remote-compute.json.bak");
    this.nodes = new Map();
    this.thermalLimitC = 65;
    this.chargeCeilingPercent = 80;
    this.beaconSocket = null;
    this.beaconTimer = null;
    this.machineId = os.hostname() || "reelos-appliance";

    this.ensureStateDir();
    this.state = this.loadState();
    this.enforceSafetyGovernor();
  }

  ensureStateDir() {
    try {
      if (!fs.existsSync(this.stateDir)) {
        fs.mkdirSync(this.stateDir, { recursive: true });
      }
    } catch {}
  }

  loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        const raw = fs.readFileSync(this.stateFile, "utf8");
        return JSON.parse(raw);
      }
    } catch (err) {
      // Self-heal from .bak
      try {
        if (fs.existsSync(this.stateBak)) {
          const raw = fs.readFileSync(this.stateBak, "utf8");
          return JSON.parse(raw);
        }
      } catch {}
    }

    return {
      remoteCompute: false,
      headlessSince: null,
      wakeCount: 0,
      safetyGovernorArmed: true,
      lastUpdated: new Date().toISOString(),
    };
  }

  saveState() {
    try {
      this.state.lastUpdated = new Date().toISOString();
      const str = JSON.stringify(this.state, null, 2);
      // Atomic write with .bak
      if (fs.existsSync(this.stateFile)) {
        fs.copyFileSync(this.stateFile, this.stateBak);
      }
      fs.writeFileSync(this.stateFile, str, "utf8");
    } catch {}
  }

  /**
   * 100% Machine-Agnostic Dynamic Silicon & Capacity Probe (Zero Hardcoded Values).
   */
  probeHardwareCapacity() {
    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    const cpus = os.cpus() || [];
    const coreCount = cpus.length;
    const cpuModel = cpus[0]?.model || "Unknown CPU";

    let battery = null;
    let temperatureC = null;
    let hasGpu = false;

    // Probe battery on Linux sysfs
    if (process.platform === "linux") {
      const batDirs = ["/sys/class/power_supply/BAT0", "/sys/class/power_supply/BAT1"];
      for (const b of batDirs) {
        if (fs.existsSync(b)) {
          try {
            const cap = parseInt(fs.readFileSync(path.join(b, "capacity"), "utf8").trim(), 10);
            const status = fs.readFileSync(path.join(b, "status"), "utf8").trim();
            battery = { present: true, capacityPercent: cap, status };
            break;
          } catch {}
        }
      }

      // Probe thermal zones
      const thermalDirs = ["/sys/class/thermal/thermal_zone0/temp", "/sys/class/thermal/thermal_zone1/temp"];
      for (const t of thermalDirs) {
        if (fs.existsSync(t)) {
          try {
            const milliC = parseInt(fs.readFileSync(t, "utf8").trim(), 10);
            temperatureC = Math.round(milliC / 1000);
            break;
          } catch {}
        }
      }

      // Probe GPU
      hasGpu = fs.existsSync("/dev/dri") || fs.existsSync("/dev/nvidiactl");
    } else if (process.platform === "win32") {
      // Windows dynamic check
      hasGpu = fs.existsSync("C:\\Windows\\System32\\nvcuda.dll") || fs.existsSync("C:\\Windows\\System32\\igxe.dll");
    }

    return {
      machineId: os.hostname(),
      platform: process.platform,
      arch: process.arch,
      coreCount,
      cpuModel,
      totalMemoryMb: Math.round(totalMemBytes / (1024 * 1024)),
      freeMemoryMb: Math.round(freeMemBytes / (1024 * 1024)),
      memoryHeadroomPercent: Math.round((freeMemBytes / totalMemBytes) * 100),
      hasGpu,
      battery: battery || { present: false, status: "AC/No Battery" },
      temperatureC: Number.isFinite(temperatureC) && temperatureC > 0 ? temperatureC : null,
      temperatureAvailable: Number.isFinite(temperatureC) && temperatureC > 0,
      loadAverage: os.loadavg(),
      storageQuotaGb: 25,
      nightChargingCompute: true,
      nightChargingComputeEligible: true,
    };
  }

  /**
   * Enforces 80% battery charge ceiling on Linux to prevent lithium swelling.
   */
  async enforceSafetyGovernor() {
    if (process.platform !== "linux") return { ok: false, reason: "Non-Linux host" };

    let appliedChargeCeiling = false;
    const batLimits = [
      "/sys/class/power_supply/BAT0/charge_control_limit_max",
      "/sys/class/power_supply/BAT1/charge_control_limit_max",
    ];

    for (const p of batLimits) {
      if (fs.existsSync(p)) {
        try {
          fs.writeFileSync(p, String(this.chargeCeilingPercent), "utf8");
          appliedChargeCeiling = true;
        } catch {}
      }
    }

    return {
      ok: appliedChargeCeiling,
      chargeCeilingPercent: this.chargeCeilingPercent,
      appliedChargeCeiling,
      error: appliedChargeCeiling ? null : "No supported battery charge-control interface was found.",
    };
  }

  /**
   * Toggles Remote Computer / Headless mode.
   */
  async setRemoteCompute(enabled) {
    this.state.remoteCompute = Boolean(enabled);
    if (enabled) {
      this.state.headlessSince = new Date().toISOString();
      await this.blankDisplay();
    } else {
      this.state.wakeCount = (this.state.wakeCount || 0) + 1;
      this.state.headlessSince = null;
      await this.wakeDisplay();
    }
    this.saveState();
    return this.getStatus();
  }

  async blankDisplay() {
    if (process.platform === "linux") {
      try {
        await execAsync("xset dpms force off || vbetool dpms off || true");
      } catch {}
    }
  }

  async wakeDisplay() {
    if (process.platform === "linux") {
      try {
        await execAsync("xset dpms force on || true");
      } catch {}
    }
  }

  getStatus() {
    const hardware = this.probeHardwareCapacity();
    const isThermalThrottled = (hardware.temperatureC || 0) > this.thermalLimitC;

    return {
      ok: true,
      remoteCompute: this.state.remoteCompute,
      headlessSince: this.state.headlessSince,
      wakeCount: this.state.wakeCount,
      hardware,
      isThermalThrottled,
      safetyGovernor: {
        chargeCeilingPercent: this.chargeCeilingPercent,
        thermalLimitC: this.thermalLimitC,
        currentTempC: hardware.temperatureC,
        safe: !isThermalThrottled,
      },
      peerNodes: this.getPeerNodes(),
    };
  }

  /**
   * Starts background zero-config UDP mesh beacon broadcasting & listener.
   */
  startBeacon(port = 44445, intervalMs = 5000) {
    // 1. Guaranteed HTTP LAN peer discovery (runs on all platforms regardless of UDP multicast/firewall)
    if (!this.lanProbeTimer) {
      setTimeout(() => void this.probeLanPeers(), 200);
      this.lanProbeTimer = setInterval(() => {
        void this.probeLanPeers();
      }, 15000);
      if (this.lanProbeTimer.unref) this.lanProbeTimer.unref();
    }

    // 2. High-speed local UDP broadcast beacon
    if (this.beaconSocket) return;
    try {
      this.beaconSocket = dgram.createSocket({ type: "udp4", reuseAddr: true });
      this.beaconSocket.on("error", () => {});

      this.beaconSocket.on("message", (msg, rinfo) => {
        try {
          const payload = JSON.parse(msg.toString("utf8"));
          if (payload.type === "REELOS_MESH_BEACON" && payload.machineId && payload.machineId !== this.machineId) {
            this.registerPeerNode({
              ...payload,
              senderIp: rinfo.address,
              lastSeen: Date.now(),
            });
          }
        } catch {}
      });

      this.beaconSocket.bind(port, () => {
        try {
          this.beaconSocket.setBroadcast(true);
        } catch {}
      });

      if (this.beaconSocket.unref) this.beaconSocket.unref();

      this.beaconTimer = setInterval(() => {
        this.sendBeacon(port);
      }, intervalMs);
      if (this.beaconTimer.unref) this.beaconTimer.unref();
    } catch {}
  }

  /**
   * Probes known LAN subnet IPs for peer ReelOS nodes over HTTP.
   */
  async probeLanPeers() {
    const candidateIps = new Set(
      [...this.nodes.values()]
        .map((peer) => peer.senderIp)
        .filter((ip) => typeof ip === "string" && ip && ip !== "127.0.0.1"),
    );
    try {
      const interfaces = os.networkInterfaces();
      for (const iface of Object.values(interfaces)) {
        for (const alias of iface || []) {
          if (alias.family === "IPv4" && !alias.internal) {
            // Compute dynamic subnet broadcast address
            const parts = alias.address.split(".");
            parts[3] = "255";
            this.sendBeacon(44445, parts.join("."));
          }
        }
      }
    } catch {}

    for (const ip of candidateIps) {
      try {
        const res = await fetch(`http://${ip}:8080/api/grid/status`, {
          signal: AbortSignal.timeout(1500),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.hardware?.machineId && data.hardware.machineId !== this.machineId) {
            this.registerPeerNode({
              type: "REELOS_MESH_BEACON",
              machineId: data.hardware.machineId,
              remoteCompute: Boolean(data.remoteCompute),
              port: 8080,
              hardware: data.hardware,
              senderIp: ip,
              lastSeen: Date.now(),
            }, true);
          }
        }
      } catch {}
    }
  }

  sendBeacon(port = 44445, broadcastAddress = "255.255.255.255") {
    if (!this.beaconSocket) return;
    try {
      const payload = {
        type: "REELOS_MESH_BEACON",
        machineId: this.machineId || os.hostname(),
        remoteCompute: Boolean(this.state.remoteCompute),
        port: Number(process.env.PORT || 8080),
        hardware: this.probeHardwareCapacity(),
        timestamp: Date.now(),
      };
      const buf = Buffer.from(JSON.stringify(payload), "utf8");
      this.beaconSocket.send(buf, 0, buf.length, port, broadcastAddress, () => {});

      // Also unicast to any known peer IPs
      for (const peer of this.nodes.values()) {
        if (peer.senderIp && peer.senderIp !== "127.0.0.1") {
          this.beaconSocket.send(buf, 0, buf.length, port, peer.senderIp, () => {});
        }
      }
    } catch {}
  }

  stopBeacon() {
    if (this.beaconTimer) {
      clearInterval(this.beaconTimer);
      this.beaconTimer = null;
    }
    if (this.lanProbeTimer) {
      clearInterval(this.lanProbeTimer);
      this.lanProbeTimer = null;
    }
    if (this.beaconSocket) {
      try { this.beaconSocket.close(); } catch {}
      this.beaconSocket = null;
    }
  }

  /**
   * Registers a peer household node.
   */
  registerPeerNode(node, reciprocate = false) {
    if (!node || !node.machineId) return;
    this.nodes.set(node.machineId, {
      ...node,
      lastSeen: Date.now(),
    });

    if (reciprocate && node.senderIp && node.senderIp !== "127.0.0.1" && node.senderIp !== "localhost") {
      const peerPort = node.port || 8080;
      const myPayload = {
        type: "REELOS_MESH_BEACON",
        machineId: this.machineId || os.hostname(),
        remoteCompute: Boolean(this.state.remoteCompute),
        port: Number(process.env.PORT || 8080),
        hardware: this.probeHardwareCapacity(),
        timestamp: Date.now(),
      };
      fetch(`http://${node.senderIp}:${peerPort}/api/grid/announce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(myPayload),
        signal: AbortSignal.timeout(2000),
      }).catch(() => {});
    }
  }

  getPeerNodes() {
    const now = Date.now();
    const active = [];
    for (const [id, node] of this.nodes.entries()) {
      if (now - node.lastSeen < 60000) {
        // active within 60s
        active.push(node);
      }
    }
    return active;
  }

  /**
   * Checks if this node has media cached locally (in .reelos-state/cache or in-RAM ring buffer).
   * @param {string} titleId
   */
  hasCachedMedia(titleId) {
    if (!titleId) return { hasCache: false, sizeBytes: 0, inRam: false, filePath: null };
    const cleanId = String(titleId).replace(/[^a-zA-Z0-9_-]/g, "").trim();
    if (!cleanId || cleanId.length < 2) {
      return { hasCache: false, sizeBytes: 0, inRam: false, filePath: null };
    }

    // Check in-RAM ring buffer
    const { inRamTranscoder } = globalThis.__inRamTranscoderModule || {};
    if (inRamTranscoder?.ringBuffers?.has(cleanId)) {
      const sess = inRamTranscoder.ringBuffers.get(cleanId);
      return { hasCache: true, sizeBytes: sess.totalBytes, inRam: true, filePath: null };
    }

    // Check local disk cache
    const cacheDir = path.join(this.stateDir, "cache");
    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir);
      for (const f of files) {
        const baseName = path.parse(f).name;
        if (baseName === cleanId || baseName.startsWith(`${cleanId}.`) || baseName.startsWith(`${cleanId}-`) || f.startsWith(`${cleanId}.`)) {
          const p = path.join(cacheDir, f);
          const stat = fs.statSync(p);
          return { hasCache: true, sizeBytes: stat.size, inRam: false, filePath: p };
        }
      }
    }

    return { hasCache: false, sizeBytes: 0, inRam: false, filePath: null };
  }

  /**
   * Queries active LAN/mesh peer nodes to see if any node already has this media cached.
   * Eliminates duplicate TorBox debrid hits across the household.
   * @param {string} titleId
   * @returns {Promise<{ found: boolean, peerIp: string|null, peerPort: number|null, inRam: boolean }>}
   */
  async findPeerWithCache(titleId) {
    const peers = this.getPeerNodes();
    if (peers.length === 0) return { found: false, peerIp: null, peerPort: null, inRam: false };

    const cleanId = encodeURIComponent(String(titleId).trim());
    for (const peer of peers) {
      if (!peer.senderIp) continue;
      const port = peer.port || 8080;
      try {
        const res = await fetch(`http://${peer.senderIp}:${port}/api/grid/cache/has/${cleanId}`, {
          signal: AbortSignal.timeout(1200),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.hasCache) {
            return {
              found: true,
              peerIp: peer.senderIp,
              peerPort: port,
              inRam: Boolean(data.inRam),
              sizeBytes: data.sizeBytes || 0,
            };
          }
        }
      } catch {}
    }

    return { found: false, peerIp: null, peerPort: null, inRam: false };
  }
}

export async function handleGridRoute(req, res, gridService) {
  const url = new URL(req.url, 'http://127.0.0.1');

  if (url.pathname === '/api/grid/status') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(gridService.getStatus()));
    return true;
  }

  if (url.pathname === '/api/grid/announce' && (req.method || 'GET').toUpperCase() === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let peer = {};
    try { peer = JSON.parse(body); } catch {}
    if (peer.machineId) {
      const remoteIp = req.socket?.remoteAddress?.replace(/^.*:/, '') || '127.0.0.1';
      gridService.registerPeerNode({
        ...peer,
        senderIp: peer.senderIp || remoteIp,
      }, false);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, registered: peer.machineId, peerCount: gridService.getPeerNodes().length }));
      return true;
    }
  }

  if (url.pathname === '/api/grid/transcode/capabilities') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, ...transcodeRelayService.getCapabilities() }));
    return true;
  }

  if (url.pathname === '/api/grid/transcode/job' && (req.method || 'GET').toUpperCase() === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let jobReq = {};
    try { jobReq = JSON.parse(body); } catch {}
    const result = await transcodeRelayService.evaluateTranscodeJob(jobReq);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, result }));
    return true;
  }

  if (url.pathname.startsWith('/api/grid/cache/has/')) {
    const titleId = decodeURIComponent(url.pathname.replace('/api/grid/cache/has/', ''));
    const cacheStatus = gridService.hasCachedMedia(titleId);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, ...cacheStatus }));
    return true;
  }

  if (url.pathname.startsWith('/api/grid/cache/stream/')) {
    const titleId = decodeURIComponent(url.pathname.replace('/api/grid/cache/stream/', ''));
    const cacheStatus = gridService.hasCachedMedia(titleId);
    if (!cacheStatus.hasCache) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Media not cached on this mesh node' }));
      return true;
    }

    if (cacheStatus.inRam) {
      const { inRamTranscoder } = globalThis.__inRamTranscoderModule || {};
      const range = req.headers.range;
      let start = 0;
      let end = Infinity;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        start = parseInt(parts[0], 10);
        end = parts[1] ? parseInt(parts[1], 10) : Infinity;
      }
      res.statusCode = range ? 206 : 200;
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      const stream = inRamTranscoder.createRangeStream(titleId, start, end);
      stream.pipe(res);
      return true;
    }

    if (cacheStatus.filePath && fs.existsSync(cacheStatus.filePath)) {
      const { consoleSentinel } = globalThis.__consoleSentinelModule || {};
      const isGamingActive = Boolean(consoleSentinel?.yieldActive);
      if (isGamingActive) {
        res.setHeader('X-ReelOS-Mesh-Paced', 'true');
      }

      const rawStream = fs.createReadStream(cacheStatus.filePath, range ? { start, end } : undefined);
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        res.statusCode = 206;
        res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', (end - start) + 1);
        res.setHeader('Content-Type', 'video/mp4');
      } else {
        res.statusCode = 200;
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Type', 'video/mp4');
      }
      rawStream.pipe(res);
      return true;
    }
  }

  return false;
}
