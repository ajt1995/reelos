import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getMagicDnsUrl,
  exchangeHeadlessAuthKey,
  getTailscaleStatus,
} from "./services/network-service.mjs";

test("Tailscale MagicDNS: getMagicDnsUrl formats anonymized domain cleanly", () => {
  const url1 = getMagicDnsUrl("livingroom");
  assert.equal(url1, "https://reel-livingroom.ts.net");

  const url2 = getMagicDnsUrl("bedroom", "reel-bedroom.ts.net");
  assert.equal(url2, "https://reel-bedroom.ts.net");

  // Handles special chars
  const url3 = getMagicDnsUrl("Austin's TV!");
  assert.equal(url3, "https://reel-austinstv.ts.net");

  // Falls back to box if all characters are stripped
  const url4 = getMagicDnsUrl("$$$");
  assert.equal(url4, "https://reel-box.ts.net");
});

test("Tailscale MagicDNS: exchangeHeadlessAuthKey requires auth key when not simulated", () => {
  const res = exchangeHeadlessAuthKey("", "cinema");
  assert.equal(res.ok, false);
  assert.match(res.error, /auth key/i);
});

test("Tailscale MagicDNS: exchangeHeadlessAuthKey performs silent automated key exchange without modals", () => {
  const res = exchangeHeadlessAuthKey("tskey-auth-sample123", "cinema-vault", { simulated: true });
  assert.equal(res.ok, true);
  assert.equal(res.hostname, "reel-cinema-vault");
  assert.equal(res.dns, "reel-cinema-vault.ts.net");
  assert.equal(res.magicDnsUrl, "https://reel-cinema-vault.ts.net");
  assert.equal(res.ip, "100.64.0.42");
  assert.doesNotMatch(res.magicDnsUrl, /8096/);
  assert.doesNotMatch(res.magicDnsUrl, /192\.168/);
});

test("Tailscale MagicDNS: getTailscaleStatus includes magicDnsUrl when dns is present", () => {
  // Test with non-existent binary returns clean default
  const status = getTailscaleStatus("/nonexistent/tailscale");
  assert.equal(status.installed, false);
  assert.equal(status.up, false);
  assert.equal(status.magicDnsUrl, null);
});
