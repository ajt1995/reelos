import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  AnonymousGossipService,
  GOSSIP_MESSAGE_TYPES,
} from "./anonymous-gossip-service.mjs";

test("AnonymousGossipService registers and retrieves cached TorBox magnets across friends mesh", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gossip-test-"));
  const service = new AnonymousGossipService({ stateDir: tempDir });

  const magnetHash = "4a5b6c7d8e9f0123456789abcdef0123456789ab";
  service.registerCachedMagnet(magnetHash, {
    mediaId: "dune-part-two-2024",
    title: "Dune: Part Two",
    quality: "4K REMUX HDR",
  });

  const foundByHash = service.lookupCachedMagnet(magnetHash);
  assert.ok(foundByHash, "Should find magnet by exact hash");
  assert.equal(foundByHash.title, "Dune: Part Two");
  assert.equal(foundByHash.quality, "4K REMUX HDR");

  const foundById = service.lookupCachedMagnet("dune-part-two-2024");
  assert.ok(foundById, "Should find magnet by mediaId");
  assert.equal(foundById.hash, magnetHash);
});

test("AnonymousGossipService broadcasts and handles swarm 429 rate-limit backoff", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gossip-test-"));
  const mockLimiter = { backoffUntil: 0 };
  const mockLearner = {
    incidents: 0,
    recordTelemetry(t) { this.incidents += (t.incidents429 || 0); },
  };

  const service = new AnonymousGossipService({
    stateDir: tempDir,
    rateLimiter: mockLimiter,
    fleetLearner: mockLearner,
  });

  // Friend node hits a 429
  const now = Date.now();
  service.broadcastRateLimitBackoff("torbox", 30000);

  assert.ok(mockLimiter.backoffUntil >= now + 29000, "Local rate limiter should adopt backoff");
  assert.equal(mockLearner.incidents, 1, "Should record telemetry incident in fleet learner");

  // Receiving incoming backoff packet from a friend's house
  const incomingBackoffTime = Date.now() + 60000;
  service.handleIncomingPacket({
    type: GOSSIP_MESSAGE_TYPES.SWARM_429_BACKOFF,
    provider: "torbox",
    backoffUntil: incomingBackoffTime,
  });

  assert.equal(mockLimiter.backoffUntil, incomingBackoffTime, "Peer backoff should synchronize across mesh");
  assert.equal(mockLearner.incidents, 2);
});

test("AnonymousGossipService triggers autonomous OTA canary rollback when crash rate exceeds 2%", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gossip-test-"));
  const service = new AnonymousGossipService({ stateDir: tempDir });

  let rollbackEventFired = false;
  service.on("OTA_ROLLBACK_TRIGGERED", () => {
    rollbackEventFired = true;
  });

  // Record 10 healthy sessions on version 2.1.0-canary
  for (let i = 0; i < 9; i++) {
    service.recordBuildSession("2.1.0-canary", { crashed: false });
  }
  assert.equal(service.isRollbackActive("2.1.0-canary"), false);

  // 1 crash out of 10 sessions = 10% crash rate (>2% threshold with >=5 sessions)
  service.recordBuildSession("2.1.0-canary", { crashed: true });

  assert.equal(rollbackEventFired, true, "OTA Canary rollback event should fire");
  assert.equal(service.isRollbackActive("2.1.0-canary"), true, "Rollback state should be active");

  // Verify rollback persisted to state file
  const rollbackFile = path.join(tempDir, "ota-rollback.json");
  assert.ok(fs.existsSync(rollbackFile), "Rollback state file must exist");
  const parsed = JSON.parse(fs.readFileSync(rollbackFile, "utf8"));
  assert.equal(parsed.version, "2.1.0-canary");
  assert.equal(parsed.status, "ROLLBACK_ACTIVE");
});

test("AnonymousGossipService immunizes fleet against audio and subtitle desync", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gossip-test-"));
  const service = new AnonymousGossipService({ stateDir: tempDir });

  // Friend node calculates +350ms offset for an anime episode
  service.registerSubtitleOffset("shingeki-s04e01", 350, { audioTrack: "japanese" });

  assert.equal(service.getSubtitleOffset("shingeki-s04e01"), 350);
  assert.equal(service.getSubtitleOffset("unknown-title"), 0);

  // Peer node receives gossip packet
  const peerService = new AnonymousGossipService({
    stateDir: fs.mkdtempSync(path.join(os.tmpdir(), "gossip-peer-")),
  });

  peerService.handleIncomingPacket({
    type: GOSSIP_MESSAGE_TYPES.SUBTITLE_SYNC,
    entry: {
      mediaId: "blade-runner-2049",
      offsetMs: -200,
      updatedAt: Date.now(),
    },
  });

  assert.equal(peerService.getSubtitleOffset("blade-runner-2049"), -200, "Peer node should inherit subtitle calibration");
});

test("AnonymousGossipService respects Feature Collision Arbiter during gaming yield", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gossip-test-"));
  const mockArbiter = {
    requestPermission(perm) {
      if (perm === "canRunGossipMesh") return false; // Gaming active
      return true;
    },
  };

  const service = new AnonymousGossipService({
    stateDir: tempDir,
    arbiter: mockArbiter,
  });

  assert.equal(service.canGossip(), false, "Should yield gossip during gaming or playback per Arbiter");
});
