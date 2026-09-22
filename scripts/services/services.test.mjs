import assert from "node:assert/strict";
import { test } from "node:test";
import { isSafeStorageTarget, listStorageDevices } from "./storage-service.mjs";
import { getBatteryStatus, setBatteryMode, detectAcMains } from "./battery-service.mjs";
import { getOfflineVaultStatus, toggleHotspot } from "./offline-service.mjs";
import { getAudioProfile, DIALOGUE_PRESETS } from "./audio-service.mjs";

test("Storage Service: protects internal sda and root disks", () => {
  assert.equal(isSafeStorageTarget("sda"), false);
  assert.equal(isSafeStorageTarget("sda1"), false);
  assert.equal(isSafeStorageTarget("sda2"), false);
  assert.equal(isSafeStorageTarget(""), false);
  assert.equal(isSafeStorageTarget(null), false);
  // Safe external drives
  assert.equal(isSafeStorageTarget("sdb"), true);
  assert.equal(isSafeStorageTarget("sdc"), true);
});

test("Storage Service: listStorageDevices returns structured schema", () => {
  const res = listStorageDevices();
  assert.ok(typeof res.ok === "boolean");
  assert.ok(Array.isArray(res.usbPool));
  assert.ok(Array.isArray(res.internalDisks));
});

import { tmpdir } from "node:os";

process.env.REELOS_STATE = process.env.REELOS_STATE || tmpdir();

test("Battery Service: manages charge mode knobs and AC mains", () => {
  const ac = detectAcMains();
  assert.ok(typeof ac.connected === "boolean" || ac.connected === null);

  const status = getBatteryStatus();
  assert.ok(status.ok);
  assert.ok(["balanced", "lifespan", "full", "conditioning"].includes(status.mode));

  const setRes = setBatteryMode("lifespan");
  assert.equal(setRes.ok, true);
  assert.equal(setRes.mode, "lifespan");
  assert.equal(setRes.threshold, 60);

  const resetRes = setBatteryMode("balanced");
  assert.equal(resetRes.mode, "balanced");
  assert.equal(resetRes.threshold, 80);
});

test("Offline Service: reports vault status and never reports a simulated hotspot as active", () => {
  const vault = getOfflineVaultStatus();
  assert.equal(vault.ok, true);
  assert.ok(typeof vault.count === "number");
  assert.ok(Array.isArray(vault.files));

  const hs = toggleHotspot(true, "Test-Cabin", "password123");
  assert.ok(typeof hs.ok === "boolean");
  if (process.platform !== "linux") {
    assert.equal(hs.ok, false);
    assert.equal(hs.active, false);
    assert.equal(hs.simulated, false);
  }
});

test("Audio Service: produces speech compression profiles", () => {
  const boost = getAudioProfile("dialogueBoost");
  assert.equal(boost.label, "Dialogue Clarity (Speech Boost)");
  assert.ok(boost.compressor.threshold < 0);
  assert.ok(boost.compressor.ratio > 1);
  assert.ok(boost.dialogueBoostDb > 0);

  const flat = getAudioProfile("off");
  assert.equal(flat.compressor, null);
  assert.equal(flat.dialogueBoostDb, 0);

  const night = getAudioProfile("nightMode");
  assert.ok(night.compressor.ratio >= 8);
});

test("Network Service: resolves LAN IPv4 and reports Wi-Fi/Tailscale", async () => {
  const { getLanIpv4, getTailscaleStatus, getWifiStatus } = await import("./network-service.mjs");
  const ip = getLanIpv4();
  assert.ok(ip);
  assert.match(ip, /^(127\.0\.0\.1|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);

  const status = getTailscaleStatus("/nonexistent/tailscale");
  assert.equal(status.installed, false);

  const wifi = getWifiStatus();
  assert.ok(wifi.ok !== undefined);
  assert.ok(wifi.lanIp);
});
