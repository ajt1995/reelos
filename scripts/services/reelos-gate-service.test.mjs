import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHmac } from "node:crypto";
import { saveProfile } from "./profile-service.mjs";
import { replaceProfileSession } from "./profile-session-service.mjs";
import {
  isPrivateOrLanIp,
  getGateSecret,
  signDeviceToken,
  verifyDeviceToken,
  registerAuthorizedDevice,
  listAuthorizedDevices,
  revokeAuthorizedDevice,
  createOtpChallenge,
  verifyOtpChallenge,
  checkRateLimit,
  handleGateRoute,
  getGateConfig,
  saveGateConfig,
  sendGateEmail,
  setFunnelEnabled,
  getAuthorizedDevice,
  isRemoteChallengeRequired,
  extractDeviceToken,
  sendCustomSmtpEmail,
  updateDeviceStorageQuota,
} from "./reelos-gate-service.mjs";

test("managed relay and missing Tailscale fail closed", async () => {
  const email = await sendGateEmail({
    to: "household@example.invalid",
    otpCode: "123456",
    magicLink: "https://example.invalid/join",
    config: { emailMode: "managed" },
  });
  assert.equal(email.ok, false);
  assert.equal(email.available, false);
  assert.equal("simulatedOtp" in email, false);

  const funnel = setFunnelEnabled(true, { binOverride: "/definitely/missing/tailscale" });
  assert.equal(funnel.ok, false);
  assert.equal(funnel.enabled, false);
  assert.equal(funnel.url, null);
});

test("isPrivateOrLanIp correctly identifies LAN and remote IPs", () => {
  // Loopback
  assert.equal(isPrivateOrLanIp("127.0.0.1"), true);
  assert.equal(isPrivateOrLanIp("::1"), true);
  assert.equal(isPrivateOrLanIp("localhost"), true);
  assert.equal(isPrivateOrLanIp("::ffff:127.0.0.1"), true);

  // Private RFC1918 & Tailscale CGNAT
  assert.equal(isPrivateOrLanIp("192.168.1.50"), true);
  assert.equal(isPrivateOrLanIp("10.0.1.2"), true);
  assert.equal(isPrivateOrLanIp("172.16.0.1"), true);
  assert.equal(isPrivateOrLanIp("172.31.255.254"), true);
  assert.equal(isPrivateOrLanIp("100.64.0.1"), true);
  assert.equal(isPrivateOrLanIp("100.127.255.254"), true);
  assert.equal(isPrivateOrLanIp("fe80::1ff:fe23:4567:890a"), true);

  // Public remote WAN IPs
  assert.equal(isPrivateOrLanIp("8.8.8.8"), false);
  assert.equal(isPrivateOrLanIp("142.250.190.46"), false);
  assert.equal(isPrivateOrLanIp("203.0.113.195"), false);
  assert.equal(isPrivateOrLanIp("172.32.0.1"), false);
  assert.equal(isPrivateOrLanIp("100.128.0.1"), false);
});

test("Device token signing and HMAC verification", () => {
  const secret = "a".repeat(64);
  const device = {
    id: "dev_test_12345",
    email: "family@reelos.org",
    platform: "ios",
    createdAt: Date.now(),
    expiresAt: Date.now() + 100000,
  };

  const token = signDeviceToken(device, secret);
  assert.ok(typeof token === "string");
  assert.equal(token.split(".").length, 3);

  // Valid verification
  const verified = verifyDeviceToken(token, secret);
  assert.ok(verified);
  assert.equal(verified.devId, "dev_test_12345");
  assert.equal(verified.email, "family@reelos.org");
  assert.equal(verified.platform, "ios");

  // Tampered token rejection
  const tamperedToken = token.slice(0, -4) + "XXXX";
  assert.equal(verifyDeviceToken(tamperedToken, secret), null);

  // Expired token rejection
  const expiredDevice = {
    id: "dev_expired",
    createdAt: Date.now() - 200000,
    expiresAt: Date.now() - 100000,
  };
  const expiredToken = signDeviceToken(expiredDevice, secret);
  assert.equal(verifyDeviceToken(expiredToken, secret), null);
});

test("Authorized devices registry lifecycle (register, list, revoke)", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-gate-test-"));
  try {
    const dev1 = registerAuthorizedDevice(
      {
        id: "dev_iphone",
        name: "Living Room iPhone",
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        ip: "203.0.113.4",
      },
      tmpDir
    );

    assert.equal(dev1.id, "dev_iphone");
    assert.equal(dev1.platform, "ios");
    assert.equal(dev1.revoked, false);

    const list = listAuthorizedDevices(tmpDir);
    assert.equal(list.length, 1);
    assert.equal(list[0].id, "dev_iphone");

    // Revoke device
    const revoked = revokeAuthorizedDevice("dev_iphone", tmpDir);
    assert.equal(revoked, true);

    const listAfterRevoke = listAuthorizedDevices(tmpDir);
    assert.equal(listAfterRevoke.length, 1);
    assert.equal(listAfterRevoke[0].revoked, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("OTP and Magic Link challenge creation and verification", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-gate-otp-test-"));
  try {
    const email = "remote-family@gmail.com";
    const clientIp = "198.51.100.22";

    const challengeRes = createOtpChallenge({ email, clientIp, stateDir: tmpDir });
    assert.ok(challengeRes.ok);
    assert.ok(challengeRes.code);
    assert.equal(challengeRes.code.length, 6);
    assert.ok(challengeRes.token);

    // Verify with incorrect code fails
    const badVerify = verifyOtpChallenge({
      email,
      code: "000000",
      clientIp,
      userAgent: "Test Mobile Safari",
      stateDir: tmpDir,
    });
    assert.equal(badVerify.ok, false);
    assert.match(badVerify.error, /Incorrect 6-digit/);

    // Verify with correct code succeeds
    const goodVerify = verifyOtpChallenge({
      email,
      code: challengeRes.code,
      clientIp,
      userAgent: "Test Mobile Safari",
      stateDir: tmpDir,
    });
    assert.ok(goodVerify.ok);
    assert.ok(goodVerify.device);
    assert.ok(goodVerify.token);

    // Device token is valid and signed
    const secret = getGateSecret(tmpDir);
    const decoded = verifyDeviceToken(goodVerify.token, secret);
    assert.ok(decoded);
    assert.equal(decoded.devId, goodVerify.device.id);

    // Used OTP cannot be re-used
    const reuseVerify = verifyOtpChallenge({
      email,
      code: challengeRes.code,
      clientIp,
      userAgent: "Test Mobile Safari",
      stateDir: tmpDir,
    });
    assert.equal(reuseVerify.ok, false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("Rate limiter blocks excessive OTP requests", () => {
  const testKey = `test_rate_limit_${Date.now()}`;
  assert.equal(checkRateLimit(testKey, 3, 60000).ok, true);
  assert.equal(checkRateLimit(testKey, 3, 60000).ok, true);
  assert.equal(checkRateLimit(testKey, 3, 60000).ok, true);
  // 4th attempt within window must be rejected
  const fourth = checkRateLimit(testKey, 3, 60000);
  assert.equal(fourth.ok, false);
  assert.ok(fourth.waitSec > 0);
});

test("public gate status does not disclose household configuration or claim authentication from LAN", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-gate-route-test-"));
  try {
    saveGateConfig({ householdEmail: "home@reelos.org", emailMode: "managed" }, tmpDir);

    let statusCode = 0;
    let headers = {};
    let responseBody = "";

    const res = {
      statusCode: 200,
      setHeader(k, v) {
        headers[k.toLowerCase()] = v;
      },
      end(body) {
        responseBody = body;
      },
    };

    const req = {
      method: "GET",
      url: "/api/gate/status",
      headers: { "x-forwarded-for": "127.0.0.1" },
    };

    const handled = await handleGateRoute(
      req,
      res,
      new URL("http://127.0.0.1/api/gate/status"),
      async () => ({}),
      tmpDir
    );

    assert.equal(handled, true);
    const parsed = JSON.parse(responseBody);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.householdEmail, undefined);
    assert.equal(parsed.emailMode, undefined);
    assert.equal(parsed.smtp, undefined);
    assert.equal(parsed.isPaired, false);
    assert.equal(parsed.isLan, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("LAN pairing requires a private connection and issues a registered device cookie", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-lan-pair-"));
  try {
    const request = async (remoteAddress) => {
      let responseBody = "";
      const headers = {};
      const req = {
        method: "POST",
        url: "/api/gate/pair-lan",
        socket: { remoteAddress },
        headers: { host: "reelos.local", origin: "http://reelos.local", "user-agent": "Mozilla/5.0 (Linux; Android 15)" },
      };
      const res = {
        statusCode: 0,
        setHeader(key, value) { headers[key.toLowerCase()] = value; },
        end(raw) { responseBody = raw; },
      };
      assert.equal(await handleGateRoute(req, res, new URL("http://reelos.local/api/gate/pair-lan"), async () => ({}), tmpDir), true);
      return { status: res.statusCode, body: JSON.parse(responseBody), headers };
    };

    const remote = await request("203.0.113.8");
    assert.equal(remote.status, 403);
    assert.equal(listAuthorizedDevices(tmpDir).length, 0);

    const local = await request("192.168.1.88");
    assert.equal(local.status, 200);
    assert.equal(local.body.ok, true);
    assert.match(local.headers["set-cookie"], /^reelos_device_token=/);
    assert.equal(listAuthorizedDevices(tmpDir).length, 1);
    assert.equal(listAuthorizedDevices(tmpDir)[0].platform, "android");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("malformed tokens and cookies fail closed without throwing", () => {
  const secret = "a".repeat(64);
  for (const token of ["a.b.c", "a.b.", "..", "a.b.%%", "x".repeat(5000)]) {
    assert.equal(verifyDeviceToken(token, secret), null);
  }
  assert.equal(extractDeviceToken({ headers: { cookie: "reelos_device_token=%GG" } }), null);
  const forge = (header, payload) => {
    const encoded = [header, payload].map((value) => Buffer.from(JSON.stringify(value)).toString("base64url")).join(".");
    return `${encoded}.${createHmac("sha256", secret).update(encoded).digest("base64url")}`;
  };
  const now = Math.floor(Date.now() / 1000);
  for (const payload of [{ devId: "dev", iat: now }, { devId: "dev", iat: now, exp: now }, { devId: "dev", iat: now, exp: "9999999999" }, { exp: now + 100, iat: now }]) {
    assert.equal(verifyDeviceToken(forge({ alg: "HS256", typ: "JWT" }, payload), secret), null);
  }
  assert.equal(verifyDeviceToken(forge({ alg: "none", typ: "JWT" }, { devId: "dev", iat: now, exp: now + 100 }), secret), null);
});

test("LAN and Tailscale addresses require registered, unexpired, unrevoked device credentials", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-device-auth-"));
  try {
    for (const address of ["127.0.0.1", "192.168.1.1", "100.64.1.2", "203.0.113.2"]) {
      assert.equal(isRemoteChallengeRequired({ url: "/api/settings", socket: { remoteAddress: address }, headers: {} }, tmpDir), true);
    }
    assert.equal(isRemoteChallengeRequired({ url: "/api/profiles", headers: {} }, tmpDir), false, "profile handler owns controlled bootstrap authorization");
    assert.equal(isRemoteChallengeRequired({ url: "/api/discovery", headers: {} }, tmpDir), false, "discovery endpoint bypasses challenge for unauthenticated LAN probes");
    const device = registerAuthorizedDevice({ id: "paired" }, tmpDir);
    assert.equal(device.storageQuotaGb, 25);
    assert.equal(device.overnightChargingOnly, true);
    const token = signDeviceToken(device, getGateSecret(tmpDir));
    const req = { url: "/api/settings", headers: { authorization: `Bearer ${token}` } };
    assert.equal(getAuthorizedDevice(req, tmpDir).id, "paired");
    assert.equal(isRemoteChallengeRequired(req, tmpDir), false);
    revokeAuthorizedDevice("paired", tmpDir);
    assert.equal(getAuthorizedDevice(req, tmpDir), null);
    assert.equal(isRemoteChallengeRequired(req, tmpDir), true);
  } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
});

test("replacement OTP invalidates old links and challenges cannot cross households", () => {
  const one = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-otp-one-"));
  const two = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-otp-two-"));
  try {
    const first = createOtpChallenge({ email: "pair@example.invalid", clientIp: "192.0.2.20", stateDir: one });
    const second = createOtpChallenge({ email: "pair@example.invalid", clientIp: "192.0.2.20", stateDir: one });
    assert.equal(verifyOtpChallenge({ token: first.token, stateDir: one }).ok, false);
    assert.equal(verifyOtpChallenge({ token: second.token, stateDir: two }).ok, false);
    assert.equal(verifyOtpChallenge({ token: second.token, stateDir: one }).ok, true);
    assert.equal(verifyOtpChallenge({ token: second.token, stateDir: one }).ok, false);
  } finally { fs.rmSync(one, { recursive: true, force: true }); fs.rmSync(two, { recursive: true, force: true }); }
});

test("gate administration requires an active owner and invitation requests cannot select another mailbox", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-gate-owner-"));
  try {
    const request = async (route, body = {}, cookie = "", method = "POST", extraHeaders = {}) => {
      const req = { method, url: route, socket: { remoteAddress: "127.0.0.1" }, headers: { host: "localhost", cookie, ...extraHeaders } };
      let output;
      const res = { statusCode: 0, setHeader() {}, end(raw) { output = JSON.parse(raw); } };
      assert.equal(await handleGateRoute(req, res, new URL(`http://localhost${route}`), async () => body, tmpDir), true);
      return { status: res.statusCode, body: output };
    };
    for (const [route, method] of [["/api/gate/config", "POST"], ["/api/gate/devices", "GET"], ["/api/gate/revoke-device", "POST"], ["/api/gate/test-email", "POST"], ["/api/tailscale/funnel", "POST"]]) {
      assert.equal((await request(route, {}, "", method)).status, 401);
    }
    const profilesDir = path.join(tmpDir, "profiles");
    saveProfile({ id: "owner", role: "owner" }, profilesDir);
    const device = registerAuthorizedDevice({ id: "owner-device", activeProfileId: "owner" }, tmpDir);
    const deviceCookie = `reelos_device_token=${signDeviceToken(device, getGateSecret(tmpDir))}`;
    const session = replaceProfileSession({ headers: { cookie: deviceCookie } }, profilesDir, "owner", device.id);
    const cookie = `${deviceCookie}; ${session.cookie.split(";")[0]}`;
    const configured = await request("/api/gate/config", { householdEmail: "home@example.invalid" }, cookie);
    assert.equal(configured.status, 200);
    assert.equal(getGateConfig(tmpDir).householdEmail, "home@example.invalid");
    assert.equal((await request("/api/gate/config", { householdEmail: "changed@example.invalid" }, cookie, "POST", { origin: "https://untrusted.invalid" })).status, 403);
    assert.equal((await request("/api/gate/devices", {}, cookie, "GET")).status, 200);
    assert.equal((await request("/api/tailscale/funnel", { enabled: true }, cookie)).body.code, "private_access_only");
    assert.equal((await request("/api/gate/request-otp", { email: "attacker@example.invalid" })).status, 403);
    assert.equal(listAuthorizedDevices(tmpDir).length, 1);
    revokeAuthorizedDevice(device.id, tmpDir);
    assert.equal((await request("/api/gate/status", {}, cookie, "GET")).body.isPaired, false);
    assert.equal((await request("/api/gate/config", {}, cookie)).status, 401);
  } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
});

test("SMTP refuses plaintext delivery and newline injection before connecting", async () => {
  await assert.rejects(sendCustomSmtpEmail({ smtp: { host: "example.invalid", port: 25, user: "user", pass: "pass" }, to: "user@example.invalid", subject: "test" }), /verified TLS/);
  await assert.rejects(sendCustomSmtpEmail({ smtp: { host: "example.invalid", port: 465 }, to: "user@example.invalid\r\nBcc: victim@example.invalid", subject: "test" }), /Invalid email/);
});

test("per-device storage quotas and night-charging distributed compute policy can be updated", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-policy-test-"));
  try {
    const dev = registerAuthorizedDevice({ id: "phone-1", userAgent: "Android Phone" }, tmpDir);
    assert.equal(dev.storageQuotaGb, 25);
    assert.equal(dev.nightChargingCompute, true);

    const updated = updateDeviceStorageQuota("phone-1", {
      storageQuotaGb: 64,
      nightChargingCompute: false,
      overnightChargingOnly: true,
      overnightPreStage: false,
    }, tmpDir);

    assert.equal(updated.storageQuotaGb, 64);
    assert.equal(updated.nightChargingCompute, false);
    assert.equal(updated.overnightPreStage, false);

    // Test API route handling
    const token = signDeviceToken(dev, getGateSecret(tmpDir));
    let replyBody = null;
    const fakeRes = {
      statusCode: null,
      end(data) { replyBody = data ? JSON.parse(data) : null; },
      setHeader() {},
    };
    const req = {
      method: "POST",
      url: "/api/gate/device-policy",
      headers: { host: "127.0.0.1:8080", cookie: `reelos_device_token=${token}` },
    };
    const readBody = async () => ({ id: "phone-1", storageQuotaGb: 100, nightChargingCompute: true });
    const handled = await handleGateRoute(req, fakeRes, new URL("http://127.0.0.1:8080/api/gate/device-policy"), readBody, tmpDir);
    assert.equal(handled, true);
    assert.equal(fakeRes.statusCode, 200);
    assert.equal(replyBody.ok, true);
    assert.equal(replyBody.device.storageQuotaGb, 100);
    assert.equal(replyBody.device.nightChargingCompute, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

