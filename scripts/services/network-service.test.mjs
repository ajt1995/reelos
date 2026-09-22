import assert from "node:assert/strict";
import { test } from "node:test";
import { getLanIpv4, getTailscaleStatus, getWifiStatus, scanWifiNetworks, connectWifi } from "./network-service.mjs";

test("Network Service: resolves local LAN IPv4 address", () => {
  const ip = getLanIpv4();
  assert.ok(ip, "IPv4 address should be non-empty string");
  assert.match(ip, /^(127\.0\.0\.1|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
});

test("Network Service: handles Tailscale status when not installed", () => {
  const status = getTailscaleStatus("/nonexistent/bin/tailscale");
  assert.equal(status.installed, false);
  assert.equal(status.up, false);
  assert.equal(status.ip, null);
});

test("Network Service: reports Wi-Fi status or an explicit unsupported state", () => {
  const wifi = getWifiStatus();
  assert.ok(wifi.ok !== undefined);
  assert.ok(wifi.lanIp);
});

test("Network Service: scans Wi-Fi networks and handles connect requests", () => {
  const scan = scanWifiNetworks();
  assert.ok(Array.isArray(scan.networks));
  if (process.platform !== "linux") {
    assert.equal(scan.ok, false);
    assert.equal(scan.supported, false);
    assert.equal(scan.networks.length, 0);
  }

  const connReqEmpty = connectWifi("");
  assert.equal(connReqEmpty.ok, false);

  const connReq = connectWifi("Test-SSID", "secret123");
  assert.ok(typeof connReq.ok === "boolean");
});
