/** Allowlisted Settings repairs. Never a free-form shell. Never during OTA. */
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";

export const REPAIR_IDS = ["posters", "hybrid1080", "import", "downloads", "indexers", "wire", "fuse"];

/** House first. /tmp if the UI is not root (dev preview). */
export const REPAIR_STATE_DIRS = ["/var/lib/reelos", "/tmp/reelos"];

const BINS = {
  wire: "wire-engines.py",
  stuck: "stuck-downloads.py",
};

const BIN_PATHS = (name) => [
  `/workspace/daemon/${name}`,
  `/workspace/install/bin/${name}`,
  `/opt/reelos/bin/${name}`,
];

/** argv after python3. Unknown id → null. `need` must appear in the bin (or its parts). */
export function repairArgv(action) {
  const id = String(action || "").trim();
  if (!/^[a-z][a-z0-9]+$/.test(id)) return null;
  if (id === "posters") return { bin: BINS.wire, args: ["merge-movies"], need: "merge-movies" };
  if (id === "hybrid1080") return { bin: BINS.stuck, args: ["--hybrid-1080"], need: "--hybrid-1080" };
  if (id === "import") return { bin: BINS.wire, args: ["import"], need: 'if "import" in sys.argv' };
  if (id === "downloads") return { bin: BINS.stuck, args: [] };
  if (id === "indexers") return { bin: BINS.wire, args: ["indexers"], need: 'if "indexers" in sys.argv' };
  if (id === "wire") return { bin: BINS.wire, args: [] };
  if (id === "fuse") return { bin: BINS.wire, args: ["fuse"], need: 'if "fuse" in sys.argv' };
  return null;
}

export function binKnowsRepair(path, need, { exists = existsSync, read = readFileSync, readdir = readdirSync } = {}) {
  if (!need) return true;
  const has = (p) => {
    try {
      return read(p, "utf8").includes(need);
    } catch {
      return false;
    }
  };
  if (has(path)) return true;
  const dir = path.replace(/\/[^/]+$/, "/wire-engines.parts");
  if (!exists(dir)) return false;
  try {
    for (const f of readdir(dir)) {
      if (f.endsWith(".part") && has(`${dir}/${f}`)) return true;
    }
  } catch {
    /* */
  }
  return false;
}

export function resolveRepairBin(name, { exists = existsSync, read = readFileSync, readdir = readdirSync, need = "" } = {}) {
  const raw = String(name || "");
  if (!raw.endsWith(".py") || raw.includes("/") || raw.includes("..")) return null;
  for (const p of BIN_PATHS(raw)) {
    if (!exists(p)) continue;
    if (binKnowsRepair(p, need, { exists, read, readdir })) return p;
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

export function tailRepairLog(dir, { read = readFileSync } = {}) {
  try {
    const lines = read(`${dir}/repair.log`, "utf8").trim().split(/\n/).filter(Boolean);
    return lines.slice(-3).join(" · ").slice(0, 220);
  } catch {
    return "";
  }
}

export function waitEarlyExit(child, ms) {
  if (!ms) return Promise.resolve({ early: false, code: null });
  if (!child) return Promise.resolve({ early: false, code: null });
  if (child.exitCode != null || child.signalCode != null) {
    return Promise.resolve({ early: true, code: child.exitCode });
  }
  if (typeof child.once !== "function") {
    return Promise.resolve({ early: false, code: null });
  }
  return new Promise((resolve) => {
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      resolve(result);
    };
    const t = setTimeout(() => finish({ early: false, code: null }), ms);
    child.once("exit", (code) => {
      clearTimeout(t);
      finish({ early: true, code });
    });
  });
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
  const read = deps.readFileSync || readFileSync;
  const readdir = deps.readdirSync || readdirSync;
  const script = resolveRepairBin(spec.bin, { exists, read, readdir, need: spec.need });
  if (!script) {
    send(res, 500, {
      ok: false,
      error: spec.need
        ? "This box’s engines cannot run that repair yet. Apply the update first."
        : `${spec.bin} missing`,
    });
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
    if (child.pid) write(state.pidFile, `${child.pid}\n`);
    const earlyMs = deps.earlyMs ?? 2000;
    const early = await (deps.waitEarlyExit || waitEarlyExit)(child, earlyMs);
    if (early.early && early.code === 0) {
      send(res, 200, { ok: true, started: true, finished: true, action: body.action });
      return;
    }
    if (early.early) {
      const tail = (deps.tailRepairLog || tailRepairLog)(state.dir, { read });
      send(res, 500, {
        ok: false,
        error: tail || `Repair failed (${early.code ?? "?"}).`,
      });
      return;
    }
    child.unref?.();
    send(res, 200, { ok: true, started: true, action: body.action });
  } catch (e) {
    send(res, 500, { ok: false, error: e instanceof Error ? e.message : "Repair failed" });
  }
}
