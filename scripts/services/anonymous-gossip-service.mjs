import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import EventEmitter from "node:events";
import { featureCollisionArbiter } from "./feature-collision-arbiter.mjs";
import { fleetLearningService } from "./fleet-learning-service.mjs";
import { torBoxRateLimiter } from "./debrid-service.mjs";

const DEFAULT_STATE_DIR = process.env.REELOS_STATE || (
  process.platform === "win32"
    ? path.join(process.cwd(), ".reelos-state")
    : "/var/lib/reelos"
);

export const GOSSIP_MESSAGE_TYPES = {
  TORBOX_CACHE: "TORBOX_CACHE",
  SWARM_429_BACKOFF: "SWARM_429_BACKOFF",
  CANARY_ROLLBACK_ALERT: "CANARY_ROLLBACK_ALERT",
  SUBTITLE_SYNC: "SUBTITLE_SYNC",
  MANIFOLD_ANCHORS: "MANIFOLD_ANCHORS",
  HEARTBEAT: "HEARTBEAT",
};

/**
 * AnonymousGossipService
 *
 * Implements a decentralized, zero-tracking gossip mesh across friends' houses
 * over Tailscale MagicDNS and LAN grids:
 *
 * 1. TorBox Debrid Cache Mesh: Shares resolved cached magnet hashes so friends
 *    stream instantly without redundant indexer scrapes.
 * 2. Swarm 429 Rate-Limit Backoff: When one house hits a TorBox 429, the entire
 *    fleet backs off proactively to protect API quotas.
 * 3. OTA Canary Auto-Rollback: Monitors crash rates per build. If crash rate exceeds
 *    2%, triggers autonomous rollback and alerts the fleet.
 * 4. Audio/Subtitle Desync Immunization: One box corrects an offset (+350ms),
 *    the entire fleet inherits the fix.
 */
export class AnonymousGossipService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.stateDir = options.stateDir || DEFAULT_STATE_DIR;
    this.arbiter = options.arbiter || featureCollisionArbiter;
    this.fleetLearner = options.fleetLearner || fleetLearningService;
    this.rateLimiter = options.rateLimiter || torBoxRateLimiter;
    this.nodeId = options.nodeId || `reelos-${os.hostname() || "node"}`;
    this.enabled = options.enabled ?? process.env.REELOS_ENABLE_PRIVATE_FLEET === "1";

    this.peersFile = path.join(this.stateDir, "fleet-peers.json");
    this.cacheMeshFile = path.join(this.stateDir, "torbox-cache-mesh.json");
    this.canaryFile = path.join(this.stateDir, "ota-canary-stats.json");
    this.rollbackFile = path.join(this.stateDir, "ota-rollback.json");
    this.subtitlesFile = path.join(this.stateDir, "subtitle-calibrations.json");

    this.peers = new Map(); // peerUrl -> { lastSeen, status, name }
    this.cachedMagnets = new Map(); // hash -> { mediaId, title, quality, cachedAt }
    this.canaryStats = { version: "2.2.0", sessions: 0, crashes: 0, crashRate: 0, rolledBack: false };
    this.subtitleCalibrations = new Map(); // mediaId -> { offsetMs, updatedBy, updatedAt }

    this.gossipIntervalTimer = null;
    this.ensureStateDir();
    this.loadState();
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
      if (fs.existsSync(this.peersFile)) {
        const raw = JSON.parse(fs.readFileSync(this.peersFile, "utf8"));
        if (Array.isArray(raw)) {
          for (const p of raw) this.peers.set(p.url, p);
        }
      }
    } catch {}

    try {
      if (fs.existsSync(this.cacheMeshFile)) {
        const raw = JSON.parse(fs.readFileSync(this.cacheMeshFile, "utf8"));
        for (const [k, v] of Object.entries(raw)) this.cachedMagnets.set(k.toLowerCase(), v);
      }
    } catch {}

    try {
      if (fs.existsSync(this.canaryFile)) {
        this.canaryStats = { ...this.canaryStats, ...JSON.parse(fs.readFileSync(this.canaryFile, "utf8")) };
      }
    } catch {}

    try {
      if (fs.existsSync(this.subtitlesFile)) {
        const raw = JSON.parse(fs.readFileSync(this.subtitlesFile, "utf8"));
        for (const [k, v] of Object.entries(raw)) this.subtitleCalibrations.set(k, v);
      }
    } catch {}
  }

  saveState() {
    try {
      this.ensureStateDir();
      fs.writeFileSync(this.peersFile, JSON.stringify(Array.from(this.peers.values()), null, 2), "utf8");
      
      const meshObj = {};
      for (const [k, v] of this.cachedMagnets.entries()) meshObj[k] = v;
      fs.writeFileSync(this.cacheMeshFile, JSON.stringify(meshObj, null, 2), "utf8");

      fs.writeFileSync(this.canaryFile, JSON.stringify(this.canaryStats, null, 2), "utf8");

      const subObj = {};
      for (const [k, v] of this.subtitleCalibrations.entries()) subObj[k] = v;
      fs.writeFileSync(this.subtitlesFile, JSON.stringify(subObj, null, 2), "utf8");
    } catch {}
  }

  // --- Peer Management ---

  registerPeer(peerUrl, metadata = {}) {
    if (!peerUrl) return false;
    const normalized = peerUrl.replace(/\/+$/, "");
    this.peers.set(normalized, {
      url: normalized,
      name: metadata.name || `Friend Node (${normalized})`,
      lastSeen: Date.now(),
      status: "active",
      ...metadata,
    });
    this.saveState();
    return true;
  }

  removePeer(peerUrl) {
    const normalized = (peerUrl || "").replace(/\/+$/, "");
    const removed = this.peers.delete(normalized);
    if (removed) this.saveState();
    return removed;
  }

  getPeers() {
    return Array.from(this.peers.values());
  }

  // --- TorBox Debrid Cache Mesh ---

  registerCachedMagnet(hash, { mediaId = null, title = "", quality = "4K" } = {}) {
    if (!hash) return null;
    const key = String(hash).toLowerCase().trim();
    const entry = {
      hash: key,
      mediaId,
      title,
      quality,
      cachedAt: Date.now(),
      originNode: this.nodeId,
    };
    this.cachedMagnets.set(key, entry);
    this.saveState();

    // Gossip to mesh if allowed by Arbiter
    if (this.canGossip()) {
      this.broadcastGossipPacket({
        type: GOSSIP_MESSAGE_TYPES.TORBOX_CACHE,
        entry,
      });
    }

    return entry;
  }

  lookupCachedMagnet(hashOrMediaId) {
    if (!hashOrMediaId) return null;
    const key = String(hashOrMediaId).toLowerCase().trim();

    // Check exact hash match
    if (this.cachedMagnets.has(key)) {
      return this.cachedMagnets.get(key);
    }

    // Check by mediaId
    for (const item of this.cachedMagnets.values()) {
      if (item.mediaId && String(item.mediaId).toLowerCase() === key) {
        return item;
      }
    }

    return null;
  }

  // --- Swarm 429 Rate-Limit Backoff ---

  broadcastRateLimitBackoff(provider = "torbox", durationMs = 60000) {
    const backoffUntil = Date.now() + durationMs;

    // Apply locally
    if (this.rateLimiter) {
      this.rateLimiter.backoffUntil = Math.max(this.rateLimiter.backoffUntil || 0, backoffUntil);
    }

    // Record telemetry observation to FleetLearningService
    if (this.fleetLearner) {
      this.fleetLearner.recordTelemetry({ incidents429: 1 });
    }

    // Gossip to peers
    if (this.canGossip()) {
      this.broadcastGossipPacket({
        type: GOSSIP_MESSAGE_TYPES.SWARM_429_BACKOFF,
        provider,
        backoffUntil,
        originNode: this.nodeId,
      });
    }

    this.emit("SWARM_429_BACKOFF_ACTIVE", { provider, backoffUntil });
    return { provider, backoffUntil };
  }

  handleIncomingBackoff({ backoffUntil, provider = "torbox" } = {}) {
    if (!backoffUntil || backoffUntil <= Date.now()) return;

    if (this.rateLimiter) {
      this.rateLimiter.backoffUntil = Math.max(this.rateLimiter.backoffUntil || 0, backoffUntil);
    }

    if (this.fleetLearner) {
      this.fleetLearner.recordTelemetry({ incidents429: 1 });
    }

    this.emit("SWARM_429_BACKOFF_APPLIED", { provider, backoffUntil });
  }

  // --- OTA Canary Health & Autonomous Rollback (>2% Crash Rate) ---

  recordBuildSession(version, { crashed = false } = {}) {
    if (version && version !== this.canaryStats.version) {
      // New version deployed; reset canary tracking
      this.canaryStats = {
        version,
        sessions: 0,
        crashes: 0,
        crashRate: 0,
        rolledBack: false,
      };
    }

    this.canaryStats.sessions++;
    if (crashed) {
      this.canaryStats.crashes++;
    }

    this.canaryStats.crashRate = this.canaryStats.sessions > 0
      ? Math.round((this.canaryStats.crashes / this.canaryStats.sessions) * 1000) / 1000
      : 0;

    // Austin's Invariant: >2% crash rate triggers autonomous canary rollback
    if (
      this.canaryStats.sessions >= 5 &&
      this.canaryStats.crashRate > 0.02 &&
      !this.canaryStats.rolledBack
    ) {
      this.triggerCanaryRollback(`Canary crash rate exceeded 2% threshold (${(this.canaryStats.crashRate * 100).toFixed(1)}%)`);
    }

    this.saveState();
    return this.canaryStats;
  }

  triggerCanaryRollback(reason = "High crash rate") {
    this.canaryStats.rolledBack = true;
    const rollbackRecord = {
      version: this.canaryStats.version,
      crashRate: this.canaryStats.crashRate,
      sessions: this.canaryStats.sessions,
      crashes: this.canaryStats.crashes,
      triggeredAt: new Date().toISOString(),
      reason,
      status: "ROLLBACK_ACTIVE",
    };

    try {
      fs.writeFileSync(this.rollbackFile, JSON.stringify(rollbackRecord, null, 2), "utf8");
    } catch {}

    // Gossip rollback warning to all friends' houses
    if (this.canGossip()) {
      this.broadcastGossipPacket({
        type: GOSSIP_MESSAGE_TYPES.CANARY_ROLLBACK_ALERT,
        rollbackRecord,
        originNode: this.nodeId,
      });
    }

    this.emit("OTA_ROLLBACK_TRIGGERED", rollbackRecord);
    return rollbackRecord;
  }

  isRollbackActive(version = null) {
    if (fs.existsSync(this.rollbackFile)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(this.rollbackFile, "utf8"));
        if (!version || parsed.version === version) {
          return true;
        }
      } catch {}
    }
    return Boolean(this.canaryStats.rolledBack && (!version || this.canaryStats.version === version));
  }

  // --- Subtitle & Audio Desync Immunization ---

  registerSubtitleOffset(mediaId, offsetMs, metadata = {}) {
    if (!mediaId) return null;
    const entry = {
      mediaId,
      offsetMs: Number(offsetMs) || 0,
      updatedAt: Date.now(),
      originNode: this.nodeId,
      ...metadata,
    };
    this.subtitleCalibrations.set(mediaId, entry);
    this.saveState();

    if (this.canGossip()) {
      this.broadcastGossipPacket({
        type: GOSSIP_MESSAGE_TYPES.SUBTITLE_SYNC,
        entry,
      });
    }

    this.emit("SUBTITLE_CALIBRATION_SAVED", entry);
    return entry;
  }

  getSubtitleOffset(mediaId) {
    if (!mediaId) return 0;
    const entry = this.subtitleCalibrations.get(mediaId);
    return entry ? entry.offsetMs : 0;
  }

  // --- Arbiter Compliance & Gossip Delivery ---

  canGossip() {
    if (!this.enabled) return false;
    if (!this.arbiter || typeof this.arbiter.requestPermission !== "function") return true;
    return this.arbiter.requestPermission("canRunGossipMesh");
  }

  async broadcastGossipPacket(payload) {
    if (!this.canGossip()) return false;
    const packet = {
      ...payload,
      sentAt: Date.now(),
      senderNode: this.nodeId,
    };

    const promises = [];
    for (const peer of this.peers.values()) {
      if (peer.status === "disabled") continue;
      promises.push(
        fetch(`${peer.url}/api/gossip/packet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(packet),
          signal: AbortSignal.timeout(3000),
        }).then((res) => {
          if (res.ok) {
            peer.lastSeen = Date.now();
            peer.status = "active";
          }
        }).catch(() => {
          peer.status = "unreachable";
        })
      );
    }

    await Promise.allSettled(promises);
    return true;
  }

  /**
   * Processes incoming gossip packets received over HTTP from friends' houses.
   */
  handleIncomingPacket(packet) {
    if (!packet || typeof packet !== "object" || !packet.type) {
      return { ok: false, error: "invalid_packet" };
    }

    switch (packet.type) {
      case GOSSIP_MESSAGE_TYPES.TORBOX_CACHE: {
        if (packet.entry && packet.entry.hash) {
          const key = packet.entry.hash.toLowerCase();
          this.cachedMagnets.set(key, { ...packet.entry, receivedAt: Date.now() });
          this.saveState();
          this.emit("MAGNET_INGESTED", packet.entry);
        }
        break;
      }
      case GOSSIP_MESSAGE_TYPES.SWARM_429_BACKOFF: {
        this.handleIncomingBackoff(packet);
        break;
      }
      case GOSSIP_MESSAGE_TYPES.CANARY_ROLLBACK_ALERT: {
        if (packet.rollbackRecord) {
          this.canaryStats.rolledBack = true;
          try {
            fs.writeFileSync(this.rollbackFile, JSON.stringify(packet.rollbackRecord, null, 2), "utf8");
          } catch {}
          this.emit("OTA_ROLLBACK_TRIGGERED", packet.rollbackRecord);
        }
        break;
      }
      case GOSSIP_MESSAGE_TYPES.SUBTITLE_SYNC: {
        if (packet.entry && packet.entry.mediaId) {
          this.subtitleCalibrations.set(packet.entry.mediaId, { ...packet.entry, receivedAt: Date.now() });
          this.saveState();
          this.emit("SUBTITLE_CALIBRATION_INGESTED", packet.entry);
        }
        break;
      }
      case GOSSIP_MESSAGE_TYPES.MANIFOLD_ANCHORS: {
        if (packet.manifold && this.fleetLearner) {
          this.fleetLearner.ingestDistilledManifold(packet.manifold);
        }
        break;
      }
      case GOSSIP_MESSAGE_TYPES.HEARTBEAT: {
        // Heartbeat acknowledged
        break;
      }
      default:
        return { ok: false, error: "unknown_type" };
    }

    return { ok: true, type: packet.type };
  }

  startMeshHeartbeat(intervalMs = 60000) {
    if (this.gossipIntervalTimer) return;
    this.gossipIntervalTimer = setInterval(() => {
      if (this.canGossip() && this.peers.size > 0) {
        this.broadcastGossipPacket({ type: GOSSIP_MESSAGE_TYPES.HEARTBEAT }).catch(() => {});
      }
    }, intervalMs);
    if (this.gossipIntervalTimer.unref) this.gossipIntervalTimer.unref();
  }

  stopMeshHeartbeat() {
    if (this.gossipIntervalTimer) {
      clearInterval(this.gossipIntervalTimer);
      this.gossipIntervalTimer = null;
    }
  }
}

export const anonymousGossipService = new AnonymousGossipService();

export async function handleGossipRoute(req, res) {
  const url = new URL(req.url, "http://127.0.0.1");
  const path = url.pathname;
  const method = (req.method || "GET").toUpperCase();

  // Private fleet administration is parked. The prototype service remains
  // testable internally, but its unauthenticated network routes must not ship.
  if (!anonymousGossipService.enabled) {
    res.statusCode = 501;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      ok: false,
      available: false,
      error: "Private fleet gossip is parked until authenticated peer enrollment and signed packets are implemented.",
    }));
    return true;
  }

  // GET /api/gossip/peers
  if (path === "/api/gossip/peers" && method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, peers: anonymousGossipService.getPeers() }));
    return true;
  }

  // POST /api/gossip/peers
  if (path === "/api/gossip/peers" && method === "POST") {
    try {
      let body = "";
      for await (const chunk of req) body += chunk;
      const data = JSON.parse(body || "{}");
      const added = anonymousGossipService.registerPeer(data.url, data);
      res.statusCode = added ? 200 : 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: added }));
      return true;
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: String(err) }));
      return true;
    }
  }

  // POST /api/gossip/packet
  if (path === "/api/gossip/packet" && method === "POST") {
    try {
      let body = "";
      for await (const chunk of req) body += chunk;
      const packet = JSON.parse(body || "{}");
      const result = anonymousGossipService.handleIncomingPacket(packet);
      res.statusCode = result.ok ? 200 : 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
      return true;
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: String(err) }));
      return true;
    }
  }

  // GET /api/gossip/cache
  if (path === "/api/gossip/cache" && method === "GET") {
    const query = url.searchParams.get("query") || url.searchParams.get("hash");
    const result = anonymousGossipService.lookupCachedMagnet(query);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, found: Boolean(result), item: result }));
    return true;
  }

  // POST /api/gossip/magnet
  if (path === "/api/gossip/magnet" && method === "POST") {
    try {
      let body = "";
      for await (const chunk of req) body += chunk;
      const data = JSON.parse(body || "{}");
      const entry = anonymousGossipService.registerCachedMagnet(data.hash, data);
      res.statusCode = entry ? 200 : 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: Boolean(entry), entry }));
      return true;
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: String(err) }));
      return true;
    }
  }

  // GET /api/gossip/canary
  if (path === "/api/gossip/canary" && method === "GET") {
    const isRollback = anonymousGossipService.isRollbackActive();
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      ok: true,
      stats: anonymousGossipService.canaryStats,
      rollbackActive: isRollback,
    }));
    return true;
  }

  // GET /api/gossip/subtitles
  if (path === "/api/gossip/subtitles" && method === "GET") {
    const mediaId = url.searchParams.get("mediaId");
    const offsetMs = anonymousGossipService.getSubtitleOffset(mediaId);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, mediaId, offsetMs }));
    return true;
  }

  return false;
}
