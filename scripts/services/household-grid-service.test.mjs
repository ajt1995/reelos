import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { HouseholdGridService } from "./household-grid-service.mjs";

test("HouseholdGridService: Dynamic Silicon Probe (Strict Anti-Hardcoding)", () => {
  const tmpDir = path.join(os.tmpdir(), "reelos-grid-test-" + Date.now());
  const service = new HouseholdGridService({ stateDir: tmpDir });

  const hw = service.probeHardwareCapacity();
  assert.ok(typeof hw.totalMemoryMb === "number" && hw.totalMemoryMb > 0, "totalMemoryMb must be dynamic number > 0");
  assert.ok(typeof hw.freeMemoryMb === "number" && hw.freeMemoryMb >= 0, "freeMemoryMb must be dynamic number");
  assert.ok(typeof hw.coreCount === "number" && hw.coreCount > 0, "coreCount must be dynamic number > 0");
  assert.ok(typeof hw.machineId === "string" && hw.machineId.length > 0, "machineId must be dynamic hostname");
  assert.equal(typeof hw.hasGpu, "boolean");

  // Clean up
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

test("HouseholdGridService: Remote Compute Toggle & Atomic Persistence", async () => {
  const tmpDir = path.join(os.tmpdir(), "reelos-grid-test-" + Date.now());
  const service = new HouseholdGridService({ stateDir: tmpDir });

  assert.equal(service.getStatus().remoteCompute, false);

  // Enable remote compute
  const enabledStatus = await service.setRemoteCompute(true);
  assert.equal(enabledStatus.remoteCompute, true);
  assert.ok(enabledStatus.headlessSince !== null);
  assert.ok(fs.existsSync(path.join(tmpDir, "remote-compute.json")));

  // Disable remote compute (physical escape hatch simulation)
  const disabledStatus = await service.setRemoteCompute(false);
  assert.equal(disabledStatus.remoteCompute, false);
  assert.equal(disabledStatus.headlessSince, null);
  assert.equal(disabledStatus.wakeCount, 1);

  // Clean up
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

test("HouseholdGridService: Self-Heal from .bak when main state is corrupt", () => {
  const tmpDir = path.join(os.tmpdir(), "reelos-grid-test-" + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  const bakContent = JSON.stringify({
    remoteCompute: true,
    headlessSince: "2026-09-17T20:00:00.000Z",
    wakeCount: 3,
  });
  fs.writeFileSync(path.join(tmpDir, "remote-compute.json.bak"), bakContent, "utf8");
  fs.writeFileSync(path.join(tmpDir, "remote-compute.json"), "CORRUPT_JSON_DATA!!!", "utf8");

  const service = new HouseholdGridService({ stateDir: tmpDir });
  const status = service.getStatus();
  assert.equal(status.remoteCompute, true);
  assert.equal(status.wakeCount, 3);

  // Clean up
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

test("HouseholdGridService: 24/7 Battery Swell & Thermal Safety Governor", () => {
  const tmpDir = path.join(os.tmpdir(), "reelos-grid-test-" + Date.now());
  const service = new HouseholdGridService({ stateDir: tmpDir });

  const status = service.getStatus();
  assert.equal(status.safetyGovernor.chargeCeilingPercent, 80);
  assert.equal(status.safetyGovernor.thermalLimitC, 65);
  assert.equal(typeof status.safetyGovernor.safe, "boolean");

  // Clean up
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

test("HouseholdGridService: Peer Node Mesh Registration", () => {
  const tmpDir = path.join(os.tmpdir(), "reelos-grid-test-" + Date.now());
  const service = new HouseholdGridService({ stateDir: tmpDir });

  service.registerPeerNode({
    machineId: "peer-laptop-basement",
    role: "remote_compute",
    totalMemoryMb: 8192,
    freeMemoryMb: 6144,
  });

  const peers = service.getPeerNodes();
  assert.equal(peers.length, 1);
  assert.equal(peers[0].machineId, "peer-laptop-basement");
  assert.equal(peers[0].role, "remote_compute");

  // Clean up
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

test("HouseholdGridService: UDP Mesh Beacon Start & Stop", () => {
  const tmpDir = path.join(os.tmpdir(), "reelos-grid-test-" + Date.now());
  const service = new HouseholdGridService({ stateDir: tmpDir });

  service.startBeacon(44449, 1000);
  assert.ok(service.beaconSocket !== null);
  assert.ok(service.beaconTimer !== null);

  service.stopBeacon();
  assert.equal(service.beaconSocket, null);
  assert.equal(service.beaconTimer, null);

  // Clean up
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

