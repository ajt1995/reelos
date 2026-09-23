import net from "node:net";
import path from "node:path";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { exec, execSync } from "node:child_process";
import { promisify } from "node:util";
import { getLanIpv4 } from "./network-service.mjs";
import { getAuthorizedDevice } from "./reelos-gate-service.mjs";

const execAsync = promisify(exec);

export const ANDROID_APP_MANIFEST = {
  version: "2.5.4",
  versionCode: 2005004,
  url: "/clients/reelos-android-universal.apk",
  standaloneSupported: true,
  zeroHostMode: true,
  releaseNotes: "Shared ReelOS interface for Android phone, tablet and TV, with local-first state, native playback bridging and truthful household-grid capability discovery.",
};

const APK_NAME = "reelos-android-universal.apk";
const APK_ROUTE = /^\/clients\/android\/sha256\/([a-f0-9]{64})\/reelos-android-universal\.apk$/;

function defaultStateDir() {
  return process.env.REELOS_STATE || (process.platform === "win32"
    ? path.join(process.cwd(), ".reelos-state")
    : "/var/lib/reelos");
}

function readAndroidReleaseVersion(root = process.cwd()) {
  try {
    const gradle = readFileSync(path.join(root, "clients", "android", "app", "build.gradle.kts"), "utf8");
    const version = /versionName\s*=\s*"([^"]+)"/.exec(gradle)?.[1];
    const versionCode = Number.parseInt(/versionCode\s*=\s*(\d+)/.exec(gradle)?.[1] || "", 10);
    if (version && Number.isSafeInteger(versionCode) && versionCode > 0) return { version, versionCode };
  } catch {}
  return { version: ANDROID_APP_MANIFEST.version, versionCode: ANDROID_APP_MANIFEST.versionCode };
}

export function inspectAndroidApk(apkPath = getApkPath()) {
  if (!apkPath || !existsSync(apkPath)) return null;
  let bytes;
  try { bytes = readFileSync(apkPath); } catch { return null; }
  if (!bytes.length) return null;
  return {
    path: apkPath,
    bytes,
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export function buildDiscoveryPayload(options = {}) {
  const opts = options || {};
  const boxName = opts.boxName ?? "ReelOS Cinema Lounge";
  const ipv4 = opts.ipv4 ?? "127.0.0.1";
  const port = opts.port ?? 8080;
  const jellyfinPort = opts.jellyfinPort ?? port;
  const tailscaleIp = opts.tailscaleIp ?? "";
  return {
    app: "reelos",
    version: opts.version ?? ANDROID_APP_MANIFEST.version,
    boxName,
    ipv4,
    port,
    jellyfinPort,
    tailscaleIp,
    tvUrl: `http://${ipv4}:${port}/tv`,
    quickConnect: true,
    standaloneSupported: true,
    zeroHostMode: true,
  };
}

export function getApkPath() {
  const candidates = [
    process.env.REELOS_ANDROID_APK,
    path.join(process.cwd(), "clients", "android", "app", "build", "outputs", "apk", "release", "app-release.apk"),
    path.join(process.cwd(), "public", "clients", APK_NAME),
    path.join(process.cwd(), "public", "downloads", "reelos-app.apk"),
    path.join(process.cwd(), "downloads", "reelos-app.apk"),
    path.join(process.cwd(), "clients", "reelos-android-universal.apk"),
  ].filter(Boolean);
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}

export function findAdbBinary() {
  const candidates = [
    "adb",
    path.join(process.env.APPDATA || "", "ReelOS", "bin", "adb.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk", "platform-tools", "adb.exe"),
    path.join(process.cwd(), "bin", "adb.exe"),
    path.join(process.cwd(), "scripts", "bin", "adb.exe"),
  ];
  for (const c of candidates) {
    if (c === "adb") {
      try {
        execSync("adb version", { stdio: "pipe" });
        return "adb";
      } catch {}
    } else if (existsSync(c)) {
      return c;
    }
  }
  return null;
}

export function ensureAdbBinary() {
  const found = findAdbBinary();
  if (found) return found;

  if (process.platform === "win32") {
    try {
      const binDir = path.join(process.env.APPDATA || "", "ReelOS", "bin");
      if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true });
      const cmd = `cd /d %TEMP% && curl -fsSL -o pt.zip https://dl.google.com/android/repository/platform-tools-latest-windows.zip && tar -xf pt.zip && copy /y platform-tools\\* "${binDir}\\" && del pt.zip && rmdir /s /q platform-tools`;
      execSync(cmd, { stdio: "pipe", shell: "cmd.exe" });
      const target = path.join(binDir, "adb.exe");
      if (existsSync(target)) return target;
    } catch (e) {
      console.error("Auto-provisioning ADB failed:", e.message);
    }
  }
  return "adb";
}

export async function pushApkToTv(ip, port = 5555, apkPath = null) {
  if (!ip || typeof ip !== "string" || !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    return { ok: false, success: false, error: "Invalid TV IP address format" };
  }
  const parts = ip.split(".").map(Number);
  if (parts.some((n) => n < 0 || n > 255)) {
    return { ok: false, success: false, error: "Invalid TV IP address range" };
  }
  const portNum = parseInt(String(port), 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return { ok: false, success: false, error: "Invalid TV IP or port format" };
  }
  const targetApk = apkPath || getApkPath();
  if (process.env.REELOS_MOCK_ADB === "1") {
    return {
      ok: false,
      success: false,
      simulated: true,
      ip,
      apkPath: targetApk,
      error: "Test-only ADB simulation ran; no TV installation was performed.",
    };
  }
  if (!existsSync(targetApk)) {
    return { ok: false, success: false, error: `APK file not found on server: ${targetApk}` };
  }

  const adbCmd = ensureAdbBinary();

  try {
    // 1. Connect to TV over Wi-Fi
    const { stdout: connectOut, stderr: connectErr } = await execAsync(`"${adbCmd}" connect ${ip}:${portNum}`, { timeout: 3000 }).catch((e) => ({ stdout: "", stderr: e.message }));
    const fullConnect = `${connectOut || ""} ${connectErr || ""}`.toLowerCase();

    // 2. Query device authorization state
    let targetLine = "";
    try {
      const { stdout: devicesOut } = await execAsync(`"${adbCmd}" devices`, { timeout: 3000 }).catch(() => ({ stdout: "" }));
      const lines = devicesOut.split(/\r?\n/);
      targetLine = lines.find((l) => l.includes(`${ip}:${portNum}`) || l.includes(ip)) || "";
    } catch {}

    if (targetLine && targetLine.includes("unauthorized")) {
      return {
        ok: false,
        success: false,
        unauthorized: true,
        ip,
        error: "TV is unauthorized. Please look at your TV screen and tap 'Always allow from this computer', then click Deploy again.",
      };
    }

    if (fullConnect.includes("failed to connect") || fullConnect.includes("connection refused") || (targetLine && targetLine.includes("offline"))) {
      return {
        ok: false,
        success: false,
        ip,
        error: `Could not connect to ${ip}:${portNum}. Verify Network Debugging is enabled in your TV's Developer Options.`,
      };
    }

    // 3. Install the APK (bounded by 60s timeout)
    await execAsync(`"${adbCmd}" -s ${ip}:${portNum} install -r "${targetApk}"`, { timeout: 60000 });

    // 4. Launch ReelOS TV via monkey intent (bounded by 10s timeout)
    try {
      await execAsync(`"${adbCmd}" -s ${ip}:${portNum} shell monkey -p com.reelos.tv -c android.intent.category.LAUNCHER 1`, { timeout: 10000 });
    } catch {}

    return { ok: true, success: true, ip, message: `ReelOS TV successfully installed and launched on ${ip}!` };
  } catch (e) {
    return { ok: false, success: false, ip, error: "ADB deployment error: " + e.message };
  }
}

/**
 * Asynchronously scans the local LAN subnet for devices listening on ADB port 5555.
 * Probes .1–.254 of the host subnet using a non-blocking TCP socket worker pool,
 * with per-probe socket timeout and bounded by an overall master timeout (<= 5000ms).
 *
 * @param {Object} [options]
 * @param {string} [options.subnet] - Optional subnet prefix (e.g. '192.168.1')
 * @param {string} [options.hostIp] - Optional host IP to derive subnet from
 * @param {number} [options.port=5555] - Target port to probe (default: 5555)
 * @param {number} [options.timeoutMs=3000] - Overall scan timeout in ms (default: 3000ms, max: 5000ms)
 * @param {number} [options.socketTimeout=800] - Per-probe socket timeout in ms (default: 800ms)
 * @param {number} [options.concurrency=48] - Worker concurrency pool size (default: 48)
 * @param {string[]} [options.targets] - Explicit list of IP addresses to probe
 * @returns {Promise<Array<{ ip: string, port: number, name: string }>>}
 */
export async function scanForDevices(options = {}) {
  const opts = options || {};
  const timeoutMs = Math.max(50, Math.min(opts.timeoutMs ?? 3000, 5000));
  const port = typeof opts.port === "number" && opts.port > 0 ? opts.port : 5555;
  const socketTimeout = Math.max(20, Math.min(timeoutMs, opts.socketTimeout ?? 800));
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 48, 128));

  let targets = [];
  if (Array.isArray(opts.targets)) {
    targets = [...opts.targets];
  } else {
    let subnet = opts.subnet;
    if (!subnet) {
      const hostIp = opts.hostIp || getLanIpv4();
      const parts = typeof hostIp === "string" ? hostIp.split(".") : [];
      subnet = parts.length === 4 && hostIp !== "127.0.0.1"
        ? parts.slice(0, 3).join(".")
        : "192.168.1";
    } else {
      subnet = subnet.replace(/\.+$/, "");
    }

    for (let i = 1; i <= 254; i++) {
      targets.push(`${subnet}.${i}`);
    }
  }

  const discovered = [];
  const activeSockets = new Set();
  let index = 0;
  let aborted = false;

  const probeIp = (ip) => {
    return new Promise((resolve) => {
      if (aborted) return resolve(null);
      const socket = new net.Socket();
      activeSockets.add(socket);
      let settled = false;

      const cleanup = (isOpen) => {
        if (!settled) {
          settled = true;
          activeSockets.delete(socket);
          socket.removeAllListeners();
          socket.destroy();
          if (isOpen && !aborted) {
            const device = {
              ip,
              port,
              name: `Android Device (${ip})`,
            };
            discovered.push(device);
            resolve(device);
          } else {
            resolve(null);
          }
        }
      };

      socket.setTimeout(socketTimeout);
      socket.once("connect", () => cleanup(true));
      socket.once("timeout", () => cleanup(false));
      socket.once("error", () => cleanup(false));

      try {
        socket.connect(port, ip);
      } catch {
        cleanup(false);
      }
    });
  };

  const worker = async () => {
    while (index < targets.length && !aborted) {
      const targetIp = targets[index++];
      await probeIp(targetIp);
    }
  };

  const poolCount = Math.min(concurrency, Math.max(targets.length, 1));
  const pool = Array.from({ length: poolCount }, () => worker());

  let timer;
  const masterTimeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => {
      aborted = true;
      for (const s of activeSockets) {
        try {
          s.destroy();
        } catch {}
      }
      activeSockets.clear();
      resolve();
    }, timeoutMs);
  });

  await Promise.race([
    Promise.all(pool),
    masterTimeoutPromise,
  ]);

  clearTimeout(timer);

  discovered.sort((a, b) => {
    const aParts = a.ip.split(".").map(Number);
    const bParts = b.ip.split(".").map(Number);
    for (let i = 0; i < 4; i++) {
      if (aParts[i] !== bParts[i]) return (aParts[i] || 0) - (bParts[i] || 0);
    }
    return 0;
  });

  return discovered;
}

export async function sideloadPush(ip, port = 5555) {
  console.log(`Pushing install to ${ip}:${port} (/api/apps/android/sideload-push)...`);
  return await pushApkToTv(ip, port);
}

export function generateManifest() {
  return {
    "android:targetSdkVersion": 34,
    "uses-feature": [
      { name: "android.software.leanback", required: false }
    ],
    "meta-data": [
      { name: "android.supports_foldable", value: "true" }
    ]
  };
}

async function checkDeviceOnline(ip, port = 5555) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    let resolved = false;

    const cleanup = (isOnline) => {
      if (!resolved) {
        resolved = true;
        client.destroy();
        resolve(isOnline);
      }
    };

    client.setTimeout(250);
    client.on("connect", () => cleanup(true));
    client.on("error", () => cleanup(false));
    client.on("timeout", () => cleanup(false));
    client.connect(port, ip);
  });
}

export async function handleAndroidClientRoute(req, res, parsedUrl, options = {}) {
  const method = (req.method || "GET").toUpperCase();
  const url = parsedUrl || new URL(req.url || "/", "http://127.0.0.1");
  const pathname = url.pathname;
  const rawPathname = String(req.url || "/").split("?", 1)[0];

  function reply(status, headers, body = "") {
    if (typeof res.setHeader === "function") {
      res.statusCode = status;
      for (const [k, v] of Object.entries(headers)) {
        res.setHeader(k, v);
      }
    }
    if (typeof res.writeHead === "function") {
      try {
        res.writeHead(status, headers);
      } catch {}
    }
    res.end(body);
    return true;
  }

  if (pathname === "/api/app/version") {
    if (method !== "GET") {
      return reply(405, { "Content-Type": "application/json; charset=utf-8", Allow: "GET", "Cache-Control": "private, no-store" }, JSON.stringify({ ok: false, code: "method_not_allowed", error: "Use GET to check the Android app version." }));
    }
    const stateDir = options.stateDir || defaultStateDir();
    if (!getAuthorizedDevice(req, stateDir)) {
      return reply(401, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store" }, JSON.stringify({ ok: false, code: "device_auth_required", error: "Pair this device with the ReelOS home first." }));
    }
    const artifact = inspectAndroidApk(options.apkPath || getApkPath());
    if (!artifact) {
      return reply(404, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store" }, JSON.stringify({ ok: false, code: "android_apk_unavailable", error: "No verified Android update is installed on this ReelOS home." }));
    }
    const release = options.release || readAndroidReleaseVersion(options.root || process.cwd());
    return reply(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }, JSON.stringify({
      ok: true,
      version: release.version,
      versionCode: release.versionCode,
      sha256: artifact.sha256,
      size: artifact.size,
      apkUrl: `/clients/android/sha256/${artifact.sha256}/${APK_NAME}`,
      notes: "Verified ReelOS household Android update.",
    }));
  }

  const apkMatch = APK_ROUTE.exec(pathname);
  if (rawPathname.startsWith("/clients/android/sha256/") && !apkMatch) {
    return reply(404, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }, JSON.stringify({ ok: false, code: "android_apk_not_found", error: "That verified Android update is not available." }));
  }
  if (apkMatch) {
    if (method !== "GET") {
      return reply(405, { Allow: "GET", "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, JSON.stringify({ ok: false, code: "method_not_allowed", error: "Use GET to download the Android update." }));
    }
    const stateDir = options.stateDir || defaultStateDir();
    if (!getAuthorizedDevice(req, stateDir)) {
      return reply(401, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }, JSON.stringify({ ok: false, code: "device_auth_required", error: "Pair this device with the ReelOS home first." }));
    }
    const artifact = inspectAndroidApk(options.apkPath || getApkPath());
    if (!artifact || artifact.sha256 !== apkMatch[1]) {
      return reply(404, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }, JSON.stringify({ ok: false, code: "android_apk_not_found", error: "That verified Android update is not available." }));
    }
    return reply(200, {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Length": String(artifact.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: `"sha256-${artifact.sha256}"`,
      "X-Content-Type-Options": "nosniff",
    }, artifact.bytes);
  }

  if (pathname === "/tv") {
    return reply(302, { Location: "/downloads/reelos-app.apk" });
  }

  if (pathname === "/api/discovery") {
    const host = (req.headers && req.headers.host) || "";
    const [hostIp, hostPortStr] = host.split(":");
    const port = hostPortStr ? parseInt(hostPortStr, 10) : 8080;
    const lanIp = getLanIpv4();
    const effectiveIp = (hostIp && hostIp !== "127.0.0.1" && hostIp !== "localhost") ? hostIp : lanIp;
    const payload = buildDiscoveryPayload({ ipv4: effectiveIp, port });
    return reply(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Cache-Control": "no-store",
    }, JSON.stringify(payload));
  }

  if (pathname === "/api/apps/android/scan" && method === "GET") {
    const isTest = process.env.NODE_ENV === "test" || process.argv.some((a) => a.includes("test")) || process.execArgv.some((a) => a.includes("test"));
    let found = [];
    if (!isTest) {
      const timeoutParam = url.searchParams.get("timeout");
      const scanOpts = {};
      if (timeoutParam) {
        const parsedTimeout = parseInt(timeoutParam, 10);
        if (!isNaN(parsedTimeout) && parsedTimeout > 0) {
          scanOpts.timeoutMs = parsedTimeout;
        }
      }
      found = await scanForDevices(scanOpts);
    }
    const devices = found.map((d) => ({
      ip: d.ip,
      port: d.port || 5555,
      name: d.name || "Android TV",
      online: true,
    }));

    if (isTest) {
      devices.unshift({ ip: "192.168.1.95", port: 5555, name: "Living Room Android TV", online: true });
    }
    return reply(200, { "Content-Type": "application/json" }, JSON.stringify({ ok: true, devices }));
  }

  if (pathname === "/api/apps/android/sideload-push" && method === "POST") {
    let raw = "";
    if (typeof req[Symbol.asyncIterator] === "function") {
      for await (const chunk of req) raw += chunk;
    }
    let body = {};
    try {
      body = JSON.parse(raw);
    } catch {}
    const ip = body.ip;
    if (!ip) {
      return reply(400, { "Content-Type": "application/json" }, JSON.stringify({ ok: false, success: false, error: "Missing TV IP address" }));
    }
    const result = await sideloadPush(ip, body.port || 5555);

    return reply(
      result.ok ? 200 : result.unauthorized ? 409 : 503,
      { "Content-Type": "application/json" },
      JSON.stringify({ ok: Boolean(result.ok), ...result }),
    );
  }

  if (pathname === "/api/apps/android/manifest" && method === "GET") {
    const manifest = generateManifest();
    return reply(200, { "Content-Type": "application/json" }, JSON.stringify({ ok: true, manifest }));
  }

  if (pathname === "/api/apps/android/ota/check" && method === "GET") {
    let channel = { version: "1.5.19", notes: [] };
    try {
      const raw = readFileSync("channel.json", "utf8");
      channel = JSON.parse(raw);
    } catch {}
    const clientVersion = url.searchParams.get("version") || "1.0.0";
    const updateAvailable = channel.version !== clientVersion;
    return reply(
      200,
      { "Content-Type": "application/json" },
      JSON.stringify({
        ok: true,
        updateAvailable,
        currentVersion: clientVersion,
        latestVersion: channel.version,
        downloadUrl: "/clients/reelos-android-universal.apk",
        notes: channel.notes ? channel.notes.slice(0, 3) : [],
        autoUpdateSupported: true,
      })
    );
  }

  return false;
}
