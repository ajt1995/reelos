import { existsSync, readFileSync, writeFileSync, openSync, mkdirSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

const DEFAULT_STATE_DIR = "/var/lib/reelos";
const DEFAULT_SCRIPT_PATH = "/opt/reelos/bin/reelos-os-upgrade.sh";
const FALLBACK_SCRIPT_PATH = "daemon/reelos-os-upgrade.sh";

function resolveScriptPath(customScript) {
  if (customScript && existsSync(customScript)) return customScript;
  if (existsSync(DEFAULT_SCRIPT_PATH)) return DEFAULT_SCRIPT_PATH;
  const inTree = path.resolve(process.cwd(), FALLBACK_SCRIPT_PATH);
  if (existsSync(inTree)) return inTree;
  return null;
}

export function readOsUpgradeStatus(stateDir = DEFAULT_STATE_DIR) {
  const statusFile = path.join(stateDir, "os-upgrade-status.json");
  const logFile = path.join(stateDir, "os-upgrade.log");
  const rebootFile = path.join(stateDir, "reboot-required");
  const sysRebootFile = "/var/run/reboot-required";
  const sysRebootPkgs = "/var/run/reboot-required.pkgs";
  const lockFile = "/var/lock/reelos-os-upgrade.lock";

  let status = {
    status: "idle",
    lastChecked: null,
    updatesAvailable: 0,
    securityUpdates: 0,
    rebootRequired: false,
    rebootPackages: [],
    osName: "Ubuntu Linux",
    logTail: "",
  };

  if (existsSync(statusFile)) {
    try {
      const parsed = JSON.parse(readFileSync(statusFile, "utf8"));
      status = { ...status, ...parsed };
    } catch {
      /* ignore read error */
    }
  }

  // Check reboot-required flags (system or test state)
  const isReboot = existsSync(rebootFile) || existsSync(sysRebootFile);
  status.rebootRequired = isReboot || Boolean(status.rebootRequired);

  if (existsSync(sysRebootPkgs) && (!status.rebootPackages || status.rebootPackages.length === 0)) {
    try {
      const lines = readFileSync(sysRebootPkgs, "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      status.rebootPackages = lines;
    } catch {
      /* ignore */
    }
  }

  // Check if upgrade lock file indicates running process
  if (existsSync(lockFile) && status.status === "running") {
    // Verified still running
  }

  // Attach log tail
  if (existsSync(logFile)) {
    try {
      const content = readFileSync(logFile, "utf8");
      const lines = content.split("\n");
      status.logTail = lines.slice(-40).join("\n");
    } catch {
      status.logTail = "";
    }
  }

  return { ok: true, ...status };
}

export function checkOsUpdatesSync({ stateDir = DEFAULT_STATE_DIR, scriptPath = null } = {}) {
  const script = resolveScriptPath(scriptPath);
  if (!script || process.platform === "win32") {
    return {
      ok: false,
      available: false,
      error: "OS update checks require the ReelOS Linux appliance update bridge.",
    };
  }

  try {
    const res = spawnSync("bash", [script, "--check"], {
      encoding: "utf8",
      timeout: 45000,
      env: {
        ...process.env,
        REELOS_STATE_DIR: stateDir,
        REELOS_LOCK_FILE: path.join(stateDir, "os-upgrade.lock"),
      },
    });
    if (res.status === 0) {
      return readOsUpgradeStatus(stateDir);
    }
    return { ok: false, error: res.stderr || "Check failed with code " + res.status };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export function startOsUpgrade({ stateDir = DEFAULT_STATE_DIR, scriptPath = null } = {}) {
  // Check if ReelOS OTA is running
  if (process.env.REELOS_OTA === "1") {
    return { ok: false, error: "ReelOS OTA is currently running. Please wait for it to complete." };
  }
  try {
    const checkOta = spawnSync("pgrep", ["-f", "reelos-update.sh"], { encoding: "utf8" });
    if (checkOta.status === 0) {
      return { ok: false, error: "ReelOS OTA is currently running. Cannot apply OS updates simultaneously." };
    }
  } catch {
    /* pgrep not available or non-linux */
  }

  const currentStatus = readOsUpgradeStatus(stateDir);
  if (currentStatus.status === "running") {
    return { ok: false, error: "OS security upgrade is already in progress.", alreadyRunning: true };
  }

  mkdirSync(stateDir, { recursive: true });
  const logFilePath = path.join(stateDir, "os-upgrade.log");
  const script = resolveScriptPath(scriptPath);

  if (!script || process.platform === "win32") {
    return {
      ok: false,
      available: false,
      error: "OS upgrades require the ReelOS Linux appliance update bridge; nothing was started.",
    };
  }

  try {
    const logFd = openSync(logFilePath, "a");
    const cp = spawn("bash", [script, "--apply"], {
      detached: true,
      stdio: ["ignore", logFd, logFd],
      env: {
        ...process.env,
        DEBIAN_FRONTEND: "noninteractive",
        REELOS_STATE_DIR: stateDir,
        REELOS_LOCK_FILE: path.join(stateDir, "os-upgrade.lock"),
      },
    });
    cp.unref();

    return { ok: true, message: "OS security upgrade initiated in background", pid: cp.pid };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export function requestReboot({ stateDir = DEFAULT_STATE_DIR, scriptPath = null } = {}) {
  const script = resolveScriptPath(scriptPath);
  if (!script || process.platform === "win32") {
    return {
      ok: false,
      available: false,
      error: "Reboot control is not available on this host; no reboot was requested.",
    };
  }

  try {
    const cp = spawn("bash", [script, "--reboot"], {
      detached: true,
      stdio: "ignore",
    });
    cp.unref();
    return { ok: true, message: "Appliance reboot sequence initiated" };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function handleOsUpgradeRoute(req, res, { stateDir = DEFAULT_STATE_DIR, scriptPath = null } = {}) {
  const url = new URL(req.url, "http://127.0.0.1");
  const pathname = url.pathname;
  const method = (req.method || "GET").toUpperCase();

  const send = (code, body) => {
    res.writeHead(code, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    });
    res.end(JSON.stringify(body));
  };

  if (pathname === "/api/system/os-upgrade/status" && method === "GET") {
    const data = readOsUpgradeStatus(stateDir);
    send(200, data);
    return true;
  }

  if (pathname === "/api/system/os-upgrade/check" && (method === "POST" || method === "GET")) {
    const result = checkOsUpdatesSync({ stateDir, scriptPath });
    send(result.ok ? 200 : 500, result);
    return true;
  }

  if (pathname === "/api/system/os-upgrade/apply" && method === "POST") {
    const result = startOsUpgrade({ stateDir, scriptPath });
    send(result.ok ? 200 : 409, result);
    return true;
  }

  if (pathname === "/api/system/os-upgrade/log" && method === "GET") {
    const data = readOsUpgradeStatus(stateDir);
    send(200, { ok: true, logTail: data.logTail });
    return true;
  }

  if (pathname === "/api/system/reboot" && method === "POST") {
    const result = requestReboot({ stateDir, scriptPath });
    send(result.ok ? 200 : 500, result);
    return true;
  }

  return false;
}
