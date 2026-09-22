import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createPlaybackFixture } from "../test-harness/playback-fixtures.mjs";
import {
  STRATEGY_MODES,
  DEFAULT_STRATEGY,
  getMediaStrategy,
  saveMediaStrategy,
  resolveAcquisitionStrategy,
  inspectStorageSpace,
  handleMediaStrategyRoute,
} from "./media-strategy-service.mjs";

describe("Media Strategy Service", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-strategy-test-"));
  });

  it("exposes the three plain English strategy modes", () => {
    assert.equal(STRATEGY_MODES.length, 3);
    const ids = STRATEGY_MODES.map((m) => m.id);
    assert.ok(ids.includes("smart_hybrid"));
    assert.ok(ids.includes("cloud_stream"));
    assert.ok(ids.includes("offline_download"));

    const hybrid = STRATEGY_MODES.find((m) => m.id === "smart_hybrid");
    assert.equal(hybrid.recommended, true);
    assert.match(hybrid.tagline, /subject to source, network, and storage availability/i);
  });

  it("returns default strategy on initial read", () => {
    const s = getMediaStrategy(tempDir);
    assert.equal(s.mode, "smart_hybrid");
    assert.equal(s.storageAllocation, "dynamic_20");
    assert.equal(s.allocatedGb, 50);
  });

  it("saves and updates strategy preferences", () => {
    const saved = saveMediaStrategy({ mode: "cloud_stream", allocatedGb: 0 }, tempDir);
    assert.equal(saved.ok, true);
    assert.equal(saved.strategy.mode, "cloud_stream");

    const reloaded = getMediaStrategy(tempDir);
    assert.equal(reloaded.mode, "cloud_stream");
    assert.equal(reloaded.allocatedGb, 0);
  });

  it("resolves cloud_stream as a provider preference without promising readiness", () => {
    const decision = resolveAcquisitionStrategy(
      { id: "movie-1", title: "Inception" },
      { tasteVibe: "balanced" },
      { mode: "cloud_stream" }
    );
    assert.equal(decision.action, "stream");
    assert.equal(decision.method, "symlink");
    assert.match(decision.reason, /verified at playback time/i);
  });

  it("resolves offline_download mode directly to download", () => {
    const decision = resolveAcquisitionStrategy(
      { id: "movie-1", title: "Inception" },
      { tasteVibe: "balanced" },
      { mode: "offline_download" }
    );
    assert.equal(decision.action, "download");
    assert.equal(decision.method, "download");
    assert.match(decision.reason, /permanent storage/i);
  });

  it("intelligently downloads comfort series and cabin vaults in smart_hybrid mode", () => {
    // 1. Cabin Vault -> Download
    const vaultDecision = resolveAcquisitionStrategy(
      { id: "vault-1", title: "Road Trip Movie", isVault: true },
      { tasteVibe: "balanced" },
      { mode: "smart_hybrid", autoDownloadCabinVault: true }
    );
    assert.equal(vaultDecision.action, "download");
    assert.match(vaultDecision.badge, /Travel Vault/);

    // 2. Comfort sitcom for comfort profile -> Download
    const comfortDecision = resolveAcquisitionStrategy(
      { id: "tv-1", title: "The Office", type: "tv", genres: ["comedy"] },
      { tasteVibe: "comfort" },
      { mode: "smart_hybrid", autoDownloadFavorites: true }
    );
    assert.equal(comfortDecision.action, "download");
    assert.match(comfortDecision.badge, /Comfort Cache/);

    // 3. Brand new movie discovery -> Instant Stream
    const discoveryDecision = resolveAcquisitionStrategy(
      { id: "movie-2", title: "New Sci-Fi 2026", type: "movie", genres: ["sci-fi"] },
      { tasteVibe: "balanced" },
      { mode: "smart_hybrid" }
    );
    assert.equal(discoveryDecision.action, "stream");
    assert.match(discoveryDecision.badge, /Instant Stream/);
  });

  it("inspects storage space with dynamic 20 percent calculation", () => {
    const space = inspectStorageSpace(tempDir);
    assert.ok(space.totalGb > 0);
    assert.ok(space.freeGb > 0);
    assert.equal(space.dynamic20Gb, Math.floor(Math.max(0, space.freeBytes - Math.max(2 * 1024 ** 3, Math.ceil(space.totalBytes * 0.1))) * 0.2) / 1024 ** 3);
  });

  it("handles HTTP GET and POST /api/strategy", async () => {
    const home = createPlaybackFixture({ profile: { id: "owner", name: "Owner", role: "owner" } });
    const req = { headers: { host: "127.0.0.1", cookie: home.cookie }, socket: { remoteAddress: "127.0.0.1" } };
    // GET
    let status = 0;
    let output = "";
    const fakeRes = {
      writeHead(s) { status = s; },
      end(data) { output = data; },
    };

    const handledGet = await handleMediaStrategyRoute(
      { ...req, method: "GET" },
      fakeRes,
      new URL("http://127.0.0.1/api/strategy"),
      null,
      home.stateDir
    );
    assert.equal(handledGet, true);
    assert.equal(status, 200);
    const parsedGet = JSON.parse(output);
    assert.equal(parsedGet.ok, true);
    assert.equal(parsedGet.strategy.mode, "smart_hybrid");
    assert.equal(parsedGet.modes.length, 3);

    // POST
    const handledPost = await handleMediaStrategyRoute(
      { ...req, method: "POST" },
      fakeRes,
      new URL("http://127.0.0.1/api/strategy"),
      async () => ({ expectedProfileId: "owner", expectedRevision: parsedGet.revision, mode: "offline_download", allocatedGb: 1 }),
      home.stateDir
    );
    assert.equal(handledPost, true);
    assert.equal(status, 200);
    const parsedPost = JSON.parse(output);
    assert.equal(parsedPost.ok, true);
    assert.equal(parsedPost.strategy.mode, "offline_download");
    assert.equal(parsedPost.persisted, true);
  });
});
