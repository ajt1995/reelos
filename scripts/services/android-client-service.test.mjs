import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ANDROID_APP_MANIFEST,
  buildDiscoveryPayload,
  getApkPath,
  handleAndroidClientRoute,
  inspectAndroidApk,
  pushApkToTv,
  scanForDevices,
} from "./android-client-service.mjs";
import { getGateSecret, registerAuthorizedDevice, signDeviceToken } from "./reelos-gate-service.mjs";
import { createMockRequest, createMockResponse } from "../test-harness/harness-utils.mjs";

test("ANDROID_APP_MANIFEST has required update fields", () => {
  assert.equal(ANDROID_APP_MANIFEST.version, "2.5.4");
  assert.equal(ANDROID_APP_MANIFEST.versionCode, 2005004);
  assert.equal(ANDROID_APP_MANIFEST.url, "/clients/reelos-android-universal.apk");
  assert.equal(ANDROID_APP_MANIFEST.standaloneSupported, true);
  assert.equal(ANDROID_APP_MANIFEST.zeroHostMode, true);
  assert.ok(ANDROID_APP_MANIFEST.releaseNotes.length > 10);
});

test("buildDiscoveryPayload populates LAN and Tailscale configuration", () => {
  const payload = buildDiscoveryPayload({
    boxName: "ReelOS Cinema Lounge",
    ipv4: "192.168.1.234",
    port: 8080,
    jellyfinPort: 8096,
    tailscaleIp: "100.100.154.16",
  });
  assert.equal(payload.app, "reelos");
  assert.equal(payload.boxName, "ReelOS Cinema Lounge");
  assert.equal(payload.ipv4, "192.168.1.234");
  assert.equal(payload.port, 8080);
  assert.equal(payload.jellyfinPort, 8096);
  assert.equal(payload.tailscaleIp, "100.100.154.16");
  assert.equal(payload.tvUrl, "http://192.168.1.234:8080/tv");
  assert.equal(payload.quickConnect, true);
  assert.equal(payload.standaloneSupported, true);
  assert.equal(payload.zeroHostMode, true);
});

test("buildDiscoveryPayload handles null or empty options gracefully", () => {
  const payloadNull = buildDiscoveryPayload(null);
  assert.equal(payloadNull.app, "reelos");
  assert.equal(payloadNull.ipv4, "127.0.0.1");
  assert.equal(payloadNull.port, 8080);
  assert.equal(payloadNull.jellyfinPort, 8080);

  const payloadEmpty = buildDiscoveryPayload();
  assert.equal(payloadEmpty.app, "reelos");
  assert.equal(payloadEmpty.jellyfinPort, 8080);
});

test("getApkPath returns a non-empty string ending with .apk", () => {
  const apkPath = getApkPath();
  assert.ok(typeof apkPath === "string" && apkPath.endsWith(".apk"));
});

test("paired Android clients receive truthful hashed update metadata and exact bytes", async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-android-update-"));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const apkPath = path.join(temporary, "release.apk");
  const apkBytes = Buffer.from("fixture signed APK bytes");
  fs.writeFileSync(apkPath, apkBytes);
  const sha256 = createHash("sha256").update(apkBytes).digest("hex");
  const device = registerAuthorizedDevice({ id: "android-day0" }, temporary);
  const token = signDeviceToken(device, getGateSecret(temporary));
  const cookie = `reelos_device_token=${token}`;

  const deniedReq = createMockRequest({ url: "/api/app/version" });
  const deniedRes = createMockResponse();
  await handleAndroidClientRoute(deniedReq, deniedRes, undefined, { stateDir: temporary, apkPath });
  await deniedRes.waitForEnd();
  assert.equal(deniedRes.statusCode, 401);
  assert.equal(JSON.stringify(deniedRes.json).includes(token), false);

  const manifestReq = createMockRequest({ url: "/api/app/version", headers: { cookie } });
  const manifestRes = createMockResponse();
  await handleAndroidClientRoute(manifestReq, manifestRes, undefined, {
    stateDir: temporary,
    apkPath,
    release: { version: "2.5.4", versionCode: 2005004 },
  });
  await manifestRes.waitForEnd();
  assert.equal(manifestRes.statusCode, 200);
  assert.deepEqual(manifestRes.json, {
    ok: true,
    version: "2.5.4",
    versionCode: 2005004,
    sha256,
    size: apkBytes.length,
    apkUrl: `/clients/android/sha256/${sha256}/reelos-android-universal.apk`,
    notes: "Verified ReelOS household Android update.",
  });
  assert.equal(JSON.stringify(manifestRes.json).includes(token), false);

  const anonymousDownloadReq = createMockRequest({ url: manifestRes.json.apkUrl });
  const anonymousDownloadRes = createMockResponse();
  await handleAndroidClientRoute(anonymousDownloadReq, anonymousDownloadRes, undefined, { stateDir: temporary, apkPath });
  await anonymousDownloadRes.waitForEnd();
  assert.equal(anonymousDownloadRes.statusCode, 401);

  const downloadReq = createMockRequest({ url: manifestRes.json.apkUrl, headers: { cookie } });
  const downloadRes = createMockResponse();
  await handleAndroidClientRoute(downloadReq, downloadRes, undefined, { stateDir: temporary, apkPath });
  await downloadRes.waitForEnd();
  assert.equal(downloadRes.statusCode, 200);
  assert.deepEqual(downloadRes.body, apkBytes);
  assert.equal(createHash("sha256").update(downloadRes.body).digest("hex"), manifestRes.json.sha256);
  assert.equal(downloadRes.getHeader("content-length"), String(apkBytes.length));
});

test("Android update routes fail closed for absent, stale, and traversal-shaped artifacts", async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-android-update-"));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const missingPath = path.join(temporary, "missing.apk");
  const device = registerAuthorizedDevice({ id: "android-day0" }, temporary);
  const token = signDeviceToken(device, getGateSecret(temporary));
  const manifestReq = createMockRequest({ url: "/api/app/version", headers: { cookie: `reelos_device_token=${token}` } });
  const manifestRes = createMockResponse();
  await handleAndroidClientRoute(manifestReq, manifestRes, undefined, { stateDir: temporary, apkPath: missingPath });
  await manifestRes.waitForEnd();
  assert.equal(manifestRes.statusCode, 404);
  assert.equal(manifestRes.json.code, "android_apk_unavailable");
  assert.equal("apkUrl" in manifestRes.json, false);

  const apkPath = path.join(temporary, "release.apk");
  fs.writeFileSync(apkPath, "current bytes");
  for (const url of [
    `/clients/android/sha256/${"0".repeat(64)}/reelos-android-universal.apk`,
    "/clients/android/sha256/%2e%2e/%2e%2e/reelos-android-universal.apk",
    `/clients/android/sha256/${"a".repeat(64)}/../secrets.json`,
  ]) {
    const req = createMockRequest({ url, headers: { cookie: `reelos_device_token=${token}` } });
    const res = createMockResponse();
    const handled = await handleAndroidClientRoute(req, res, undefined, { stateDir: temporary, apkPath });
    assert.equal(handled, true);
    await res.waitForEnd();
    assert.equal(res.statusCode, 404);
  }
  assert.equal(inspectAndroidApk(missingPath), null);
});

test("pushApkToTv refuses invalid IP address without executing command", async () => {
  const res = await pushApkToTv("invalid;rm -rf /");
  assert.equal(res.ok, false);
  assert.match(res.error, /Invalid TV IP/);

  const resRange = await pushApkToTv("999.168.1.1");
  assert.equal(resRange.ok, false);
  assert.match(resRange.error, /Invalid TV IP/);
});

test("pushApkToTv refuses invalid port without executing command", async () => {
  const res = await pushApkToTv("192.168.1.50", "invalid;rm -rf /");
  assert.equal(res.ok, false);
  assert.match(res.error, /Invalid TV IP or port format/);
});

test("pushApkToTv returns graceful error when APK is missing", async () => {
  const res = await pushApkToTv("192.168.1.99", 5555, "/nonexistent/path/app.apk");
  assert.equal(res.ok, false);
  assert.match(res.error, /not found on server/);
});

test("handleAndroidClientRoute redirects /tv to APK download", async () => {
  const req = { url: "/tv", headers: { host: "192.168.1.234:8080" } };
  let statusCode = 0;
  const headers = {};
  const res = {
    set statusCode(c) { statusCode = c; },
    setHeader(k, v) { headers[k] = v; },
    end() {},
  };
  const handled = await handleAndroidClientRoute(req, res);
  assert.equal(handled, true);
  assert.equal(statusCode, 302);
  assert.equal(headers["Location"], "/downloads/reelos-app.apk");
});

test("handleAndroidClientRoute serves /api/discovery", async () => {
  const req = { url: "/api/discovery", headers: { host: "192.168.1.234:8080" } };
  let body = "";
  const res = {
    set statusCode(c) {},
    setHeader(k, v) {},
    end(data) { body = data; },
  };
  const handled = await handleAndroidClientRoute(req, res);
  assert.equal(handled, true);
  const parsed = JSON.parse(body);
  assert.equal(parsed.app, "reelos");
  assert.equal(parsed.ipv4, "192.168.1.234");
});

test("scanForDevices is an async function returning an array", async () => {
  const devices = await scanForDevices({ timeoutMs: 100, concurrency: 16 });
  assert.ok(Array.isArray(devices));
});

test("scanForDevices respects master timeout limit (<= 5s)", async () => {
  const start = Date.now();
  const devices = await scanForDevices({ timeoutMs: 200, socketTimeout: 150, concurrency: 8 });
  const elapsed = Date.now() - start;
  assert.ok(Array.isArray(devices));
  assert.ok(elapsed <= 1000, `Expected scan to finish within timeout, took ${elapsed}ms`);
});

test("scanForDevices detects active TCP socket on probed port", async () => {
  const server = net.createServer((socket) => {
    socket.end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const assignedPort = server.address().port;

  try {
    const discovered = await scanForDevices({
      targets: ["127.0.0.1"],
      port: assignedPort,
      timeoutMs: 1000,
      socketTimeout: 500,
    });

    assert.equal(discovered.length, 1);
    assert.equal(discovered[0].ip, "127.0.0.1");
    assert.equal(discovered[0].port, assignedPort);
    assert.ok(discovered[0].name.includes("127.0.0.1"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test("scanForDevices returns empty array when target port is closed", async () => {
  const discovered = await scanForDevices({
    targets: ["127.0.0.1"],
    port: 59992,
    timeoutMs: 300,
    socketTimeout: 100,
  });
  assert.deepEqual(discovered, []);
});

test("handleAndroidClientRoute serves /api/apps/android/scan with Living Room TV", async () => {
  const req = { method: "GET", url: "/api/apps/android/scan?timeout=100" };
  let statusCode = 0;
  let body = "";
  const res = {
    set statusCode(c) { statusCode = c; },
    setHeader(k, v) {},
    writeHead(c, h) { statusCode = c; },
    end(data) { body = data; },
  };
  const handled = await handleAndroidClientRoute(req, res, new URL("http://127.0.0.1/api/apps/android/scan?timeout=100"));
  assert.equal(handled, true);
  assert.equal(statusCode, 200);
  const parsed = JSON.parse(body);
  assert.equal(parsed.ok, true);
  assert.ok(Array.isArray(parsed.devices));
  const hasLivingRoom = parsed.devices.some((d) => d.ip === "192.168.1.95" && d.name === "Living Room Android TV");
  assert.equal(hasLivingRoom, true);
});

test("test-only ADB mode can never masquerade as a successful TV install", async () => {
  process.env.REELOS_MOCK_ADB = "1";
  try {
    const req = {
      method: "POST",
      url: "/api/apps/android/sideload-push",
      [Symbol.asyncIterator]: async function* () {
        yield JSON.stringify({ ip: "192.168.1.95", port: 5555 });
      },
    };
    let statusCode = 0;
    let body = "";
    const res = {
      set statusCode(c) { statusCode = c; },
      setHeader(k, v) {},
      writeHead(c, h) { statusCode = c; },
      end(data) { body = data; },
    };
    const handled = await handleAndroidClientRoute(req, res, new URL("http://127.0.0.1/api/apps/android/sideload-push"));
    assert.equal(handled, true);
    assert.equal(statusCode, 503);
    const parsed = JSON.parse(body);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.success, false);
    assert.equal(parsed.simulated, true);
    assert.equal(parsed.ip, "192.168.1.95");
    assert.ok(parsed.apkPath && parsed.apkPath.endsWith(".apk"));
    assert.match(parsed.error, /no TV installation was performed/i);
  } finally {
    delete process.env.REELOS_MOCK_ADB;
  }
});
