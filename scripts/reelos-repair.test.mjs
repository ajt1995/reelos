import { EventEmitter } from "node:events";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  binKnowsRepair,
  handleRepair,
  openRepairState,
  repairArgv,
  repairBusy,
  resolveRepairBin,
  REPAIR_IDS,
} from "./reelos-repair.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("repair argv is an allowlist — no free-form shell", () => {
  assert.deepEqual(repairArgv("posters"), { bin: "wire-engines.py", args: ["merge-movies"], need: "merge-movies" });
  assert.deepEqual(repairArgv("hybrid1080"), {
    bin: "stuck-downloads.py",
    args: ["--hybrid-1080"],
    need: "--hybrid-1080",
  });
  assert.deepEqual(repairArgv("import"), { bin: "wire-engines.py", args: ["import"], need: 'if "import" in sys.argv' });
  assert.deepEqual(repairArgv("downloads"), { bin: "stuck-downloads.py", args: [] });
  assert.deepEqual(repairArgv("indexers"), {
    bin: "wire-engines.py",
    args: ["indexers"],
    need: 'if "indexers" in sys.argv',
  });
  assert.deepEqual(repairArgv("wire"), { bin: "wire-engines.py", args: [] });
  assert.deepEqual(repairArgv("fuse"), { bin: "wire-engines.py", args: ["fuse"], need: 'if "fuse" in sys.argv' });
  for (const bad of ["", "rm", "-rf", "../wire", "posters;reboot", "factory-reset", "media", "/bin/sh"]) {
    assert.equal(repairArgv(bad), null, bad);
  }
});

test("repair bin resolver refuses paths", () => {
  const exists = (p) => p === "/workspace/daemon/wire-engines.py";
  assert.equal(resolveRepairBin("wire-engines.py", { exists }), "/workspace/daemon/wire-engines.py");
  assert.equal(resolveRepairBin("../wire-engines.py", { exists }), null);
  assert.equal(resolveRepairBin("/opt/reelos/bin/wire-engines.py", { exists }), null);
  assert.equal(resolveRepairBin("stuck-downloads.py", { exists }), null);
});

test("repair bin resolver skips a stale house bin that cannot merge-movies", () => {
  const files = {
    "/opt/reelos/bin/wire-engines.py": "shim",
    "/opt/reelos/bin/wire-engines.parts/09.part": 'if "fuse" in sys.argv',
    "/workspace/daemon/wire-engines.py": "shim",
    "/workspace/daemon/wire-engines.parts/09.part": 'if "merge-movies" in sys.argv\nif "fuse" in sys.argv',
  };
  const exists = (p) =>
    p in files || p === "/opt/reelos/bin/wire-engines.parts" || p === "/workspace/daemon/wire-engines.parts";
  const read = (p) => files[p] || "";
  const readdir = (dir) =>
    dir.endsWith("wire-engines.parts") ? ["09.part"] : [];
  assert.equal(
    resolveRepairBin("wire-engines.py", { exists, read, readdir, need: "merge-movies" }),
    "/workspace/daemon/wire-engines.py",
  );
  assert.equal(
    resolveRepairBin("wire-engines.py", { exists, read, readdir, need: 'if "fuse" in sys.argv' }),
    "/workspace/daemon/wire-engines.py",
  );
  assert.equal(binKnowsRepair("/opt/reelos/bin/wire-engines.py", "merge-movies", { exists, read, readdir }), false);
});

test("repairBusy is false when pid is dead", () => {
  assert.equal(
    repairBusy({
      pidFile: "/tmp/reelos-no-such-pid",
      killFn: () => {
        throw new Error("ESRCH");
      },
    }),
    false,
  );
});

test("openRepairState falls back when the house dir is not writable", () => {
  const opened = [];
  const state = openRepairState({
    mkdir: () => {},
    open: (p) => {
      opened.push(p);
      if (p.startsWith("/var/lib/reelos")) {
        const err = new Error("EACCES");
        err.code = "EACCES";
        throw err;
      }
      return 7;
    },
  });
  assert.equal(state.dir, "/tmp/reelos");
  assert.equal(state.pidFile, "/tmp/reelos/repair.pid");
  assert.deepEqual(opened, ["/var/lib/reelos/repair.log", "/tmp/reelos/repair.log"]);
});

test("handleRepair starts an allowlisted script", async () => {
  const sent = [];
  const spawned = [];
  const send = (_res, status, body) => sent.push({ status, body });
  await handleRepair(
    { method: "POST" },
    {},
    {
      send,
      otaRunning: () => false,
      repairBusy: () => false,
      readBody: async () => ({ action: "posters" }),
      existsSync: (p) => p === "/workspace/daemon/wire-engines.py" || p === "/workspace/daemon/wire-engines.parts",
      readFileSync: (p) => (String(p).includes("09.part") ? 'if "merge-movies" in sys.argv' : "shim"),
      readdirSync: () => ["09.part"],
      openRepairState: () => ({ dir: "/tmp/reelos", log: 3, pidFile: "/tmp/reelos/repair.pid" }),
      writeFileSync: () => {},
      earlyMs: 0,
      spawn: (bin, args) => {
        spawned.push([bin, args]);
        return { pid: 4242, unref() {} };
      },
    },
  );
  assert.equal(sent[0].status, 200);
  assert.equal(sent[0].body.started, true);
  assert.deepEqual(spawned[0], ["python3", ["/workspace/daemon/wire-engines.py", "merge-movies"]]);
});

test("handleRepair does not say Started when the child dies immediately", async () => {
  const sent = [];
  const send = (_res, status, body) => sent.push({ status, body });
  const child = new EventEmitter();
  child.pid = 99;
  await handleRepair(
    { method: "POST" },
    {},
    {
      send,
      otaRunning: () => false,
      repairBusy: () => false,
      readBody: async () => ({ action: "posters" }),
      existsSync: (p) => p === "/workspace/daemon/wire-engines.py" || p === "/workspace/daemon/wire-engines.parts",
      readFileSync: (p) =>
        String(p).includes("repair.log") ? "PermissionError: /opt/reelos/compose/.env" : 'if "merge-movies" in sys.argv',
      readdirSync: () => ["09.part"],
      openRepairState: () => ({ dir: "/tmp/reelos", log: 3, pidFile: "/tmp/reelos/repair.pid" }),
      writeFileSync: () => {},
      spawn: () => {
        queueMicrotask(() => child.emit("exit", 1));
        return child;
      },
    },
  );
  assert.equal(sent[0].status, 500);
  assert.equal(sent[0].body.ok, false);
  assert.match(sent[0].body.error, /PermissionError|Repair failed/);
});

test("handleRepair says Finished when the child exits 0 quickly", async () => {
  const sent = [];
  const send = (_res, status, body) => sent.push({ status, body });
  const child = new EventEmitter();
  child.pid = 99;
  await handleRepair(
    { method: "POST" },
    {},
    {
      send,
      otaRunning: () => false,
      repairBusy: () => false,
      readBody: async () => ({ action: "posters" }),
      existsSync: (p) => p === "/workspace/daemon/wire-engines.py" || p === "/workspace/daemon/wire-engines.parts",
      readFileSync: () => 'if "merge-movies" in sys.argv',
      readdirSync: () => ["09.part"],
      openRepairState: () => ({ dir: "/tmp/reelos", log: 3, pidFile: "/tmp/reelos/repair.pid" }),
      writeFileSync: () => {},
      spawn: () => {
        queueMicrotask(() => child.emit("exit", 0));
        return child;
      },
    },
  );
  assert.equal(sent[0].status, 200);
  assert.equal(sent[0].body.finished, true);
});

test("handleRepair refuses unknown actions and OTA", async () => {
  const sent = [];
  const send = (_res, status, body) => sent.push({ status, body });
  await handleRepair(
    { method: "POST" },
    {},
    { send, otaRunning: () => true, readBody: async () => ({ action: "posters" }), repairBusy: () => false },
  );
  assert.equal(sent[0].status, 409);
  sent.length = 0;
  await handleRepair(
    { method: "POST" },
    {},
    { send, otaRunning: () => false, readBody: async () => ({ action: "rm" }), repairBusy: () => false },
  );
  assert.equal(sent[0].status, 400);
  assert.equal(sent[0].body.error, "Unknown repair");
});

test("Settings Fix cards stay lockstep with the allowlist", () => {
  const ui = readFileSync(join(root, "src/lib/repairs.ts"), "utf8");
  for (const id of REPAIR_IDS) {
    assert.match(ui, new RegExp(`id: "${id}"`));
  }
  const view = readFileSync(join(root, "src/components/settings-view.tsx"), "utf8");
  assert.match(view, /FixSection/);
  assert.match(view, /This house/);
  assert.match(view, /named Fix/);
  const fix = readFileSync(join(root, "src/components/settings-fix.tsx"), "utf8");
  assert.match(fix, /\/api\/repair/);
  assert.match(fix, /Check hops/);
  assert.match(fix, /Finished\. Check Movies/);
  assert.match(fix, /Not checked yet/);
  assert.doesNotMatch(fix, /Compose project reelos/);
  const plugin = readFileSync(join(root, "scripts/reelos-lookup-plugin.mjs"), "utf8");
  assert.match(plugin, /\/api\/repair/);
  assert.match(plugin, /handleRepair/);
  assert.match(plugin, /createLibraryCache/);
  const chk = spawnSync("node", ["--check", join(root, "scripts/reelos-lookup-plugin.mjs")], { encoding: "utf8" });
  assert.equal(chk.status, 0, chk.stderr);
});
