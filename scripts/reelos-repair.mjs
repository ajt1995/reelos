/** Allowlisted Settings repairs. Never a free-form shell. Never during OTA. */
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";

export const REPAIR_IDS = ["posters", "hybrid1080", "import", "downloads", "indexers", "wire", "fuse"];

/** House first. /tmp if the UI is not root (dev preview). */
export const REPAIR_STATE_DIRS = ["/var/lib/reelos", "/tmp/reelos"];

const BINS = {
  wire: "wire-engines.py",
  stuck: "stuck-downloads.py",
};

/** argv after python3. Unknown id → null. */
export function repairArgv(action) {
  const id = String(action || "").trim();
  if (!/^[a-z][a-z0-9]+$/.test(id)) return null;
  if (id === "posters") return { bin: BINS.wire, args: ["merge-movies"] };
  if (id === "hybrid1080") return { bin: BINS.stuck, args: ["--hybrid-1080"] };
  if (id === "import") return { bin: BINS.wire, args: ["import"] };
  if (id === "downloads") return { bin: BINS.stuck, args: [] };
  if (id === "indexers") return { bin: BINS.wire, args: ["indexers"] };
  if (id === "wire") return { bin: BINS.wire, args: [] };
  if (id === "fuse") return { bin: BINS.wire, args: ["fuse"] };
  return null;
}

export function resolveRepairBin(name, { exists = existsSync } = {}) {
  const raw = String(name || "");
  if (!raw.endsWith(".py") || raw.includes("/") || raw.includes("..")) return null;
  for (const p of [`/opt/reelos/bin/${raw}`, `/workspace/daemon/${raw}`, `/workspace/install/bin/${raw}`]) {
    if (exists(p)) return p;
  }
  return null;
}

export function repairPidFiles() {
  return REPAIR_STATE_DIRS.map((d) => `${d}/repair.pid`);
}

export function repairBusy({ pidFile, pidFiles, killFn = process.kill.bind(process) } = {}) {
  const files = pidFiles || (pidFile ? [pidFile] : repairPidFiles());
  for (const f of files) {
    try {
      const pid = Number(readFileSync(f, "utf8").trim());
      if (!Number.isInteger(pid) || pid <= 1) continue;
      killFn(pid, 0);
      return true;
    } catch {
      /* dead or unreadable */
    }
  }
  return false;
}

/** First dir we can append a log in. House is /var/lib/reelos. */
export function openRepairState({ mkdir = mkdirSync, open = openSync } = {}) {
  for (const dir of REPAIR_STATE_DIRS) {
    try {
      mkdir(dir, { recursive: true });
      const log = open(`${dir}/repair.log`, "a");
      return { dir, log, pidFile: `${dir}/repair.pid` };
    } catch {
      /* EACCES on a root-owned dir — try the next */
    }
  }
  return null;
}

function otaIsRunning(otaRunning) {
  if (typeof otaRunning === "function") return Boolean(otaRunning());
  return false;
}

export async function handleRepair(req, res, deps) {
  const send = deps.send;
  const method = (req.method || "GET").toUpperCase();
  if (method === "GET") {
    send(res, 200, { ok: true, actions: REPAIR_IDS, busy: (deps.repairBusy || repairBusy)() });
    return;
  }
  if (method !== "POST") {
    send(res, 405, { ok: false, error: "POST a repair action" });
    return;
  }
  if (otaIsRunning(deps.otaRunning)) {
    send(res, 409, { ok: false, error: "Repairs do not run during an update" });
    return;
  }
  const busyFn = deps.repairBusy || repairBusy;
  if (busyFn()) {
    send(res, 409, { ok: false, error: "A repair is already running. Wait." });
    return;
  }
  const body = deps.readBody ? await deps.readBody(req) : {};
  const spec = repairArgv(body.action);
  if (!spec) {
    send(res, 400, { ok: false, error: "Unknown repair" });
    return;
  }
  const exists = deps.existsSync || existsSync;
  const script = resolveRepairBin(spec.bin, { exists });
  if (!script) {
    send(res, 500, { ok: false, error: `${spec.bin} missing` });
    return;
  }
  const mkdir = deps.mkdirSync || mkdirSync;
  const open = deps.openSync || openSync;
  const write = deps.writeFileSync || writeFileSync;
  const spawnFn = deps.spawn || spawn;
  const state = (deps.openRepairState || openRepairState)({ mkdir, open });
  if (!state) {
    send(res, 500, { ok: false, error: "Cannot write repair log" });
    return;
  }
  try {
    const child = spawnFn("python3", [script, ...spec.args], {
      detached: true,
      stdio: ["ignore", state.log, state.log],
    });
    child.unref?.();
    if (child.pid) write(state.pidFile, `${child.pid}\n`);
    send(res, 200, { ok: true, started: true, action: body.action });
  } catch (e) {
    send(res, 500, { ok: false, error: e instanceof Error ? e.message : "Repair failed" });
  }
}
