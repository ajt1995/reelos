import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { findClientRoot, findNitroOutput, findPreviewBuild } from "./reelos-box.mjs";
import {
  SMALL_MEM_KB,
  anythingPlaying,
  boxIsSmall,
  loadHigh,
  loadavg1,
  memTotalKb,
  shouldSkipIdleWork,
} from "./reelos-box-scale.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("MemTotal ≤4.5Gi is small even if the toggle is weird", () => {
  assert.equal(SMALL_MEM_KB, 4_718_592);
  assert.equal(memTotalKb("MemTotal:       3276800 kB\n"), 3276800);
  assert.equal(boxIsSmall(3276800), true);
  assert.equal(boxIsSmall(4718592), true);
  assert.equal(boxIsSmall(8388608), false);
  assert.equal(boxIsSmall(0), false);
  assert.equal(loadavg1("3.14 1.00 0.50 1/100 1\n"), 3.14);
  assert.equal(loadHigh(2), true);
  assert.equal(loadHigh(1.9), false);
  assert.equal(anythingPlaying({ psArgs: "/usr/bin/ffmpeg -i foo" }), false);
  assert.equal(
    anythingPlaying({ psArgs: "/usr/lib/jellyfin-ffmpeg/ffmpeg -i dump.mkv" }),
    true,
  );
  assert.deepEqual(shouldSkipIdleWork({ playing: false, load1: 3, ffprobeD: 0 }), {
    skip: true,
    reason: "idle load",
  });
  assert.deepEqual(shouldSkipIdleWork({ playing: true, load1: 8, ffprobeD: 0 }), {
    skip: false,
    reason: "",
  });
  assert.equal(shouldSkipIdleWork({ playing: false, load1: 0.1, ffprobeD: 4 }).reason, "ffprobe D-state");
  const wire = read("daemon/wire-engines.parts/06.part");
  assert.match(wire, /def box_is_small/);
  assert.match(wire, /if box_is_small\(\):\n        return True/);
});

test("scan caps persist MediaInfo off and Never rescan", () => {
  for (const app of ["sonarr", "radarr", "lidarr"]) {
    const install = JSON.parse(read(`install/compose/configs/${app}/reelos-debrid.json`));
    assert.equal(install.enableMediaInfo, false, app);
    assert.equal(install.rescanAfterRefresh, "Never", app);
  }
  assert.match(read("daemon/wire-engines.parts/07.part"), /rescanAfterRefresh": "Never"/);
  assert.match(read("daemon/wire-engines.parts/07.part"), /def jellyfin_task_library_scan/);
});

test("FUSE persist don't remount if listed; idle skip does not fight D-state", () => {
  const fuse = read("daemon/wire-engines.parts/02.part");
  const zero = read("daemon/wire-engines.parts/00.part");
  const heal = read("daemon/reelos-selfheal.sh");
  const updater = read("daemon/reelos-update.sh");
  assert.match(zero, /def persist_fuse_listed/);
  assert.match(zero, /do not remount if listed/);
  assert.match(fuse, /do not remount if listed/);
  assert.match(updater, /do not remount if listed/);
  assert.match(heal, /idle load/);
  assert.match(heal, /ffprobe D-state/);
  const dState = heal.indexOf('log "skip engines — ffprobe D-state');
  const idle = heal.indexOf("idle_load_skip");
  assert.ok(dState >= 0 && idle >= 0);
  assert.doesNotMatch(heal, /enable reelos-firstboot/);
  assert.doesNotMatch(updater, /umount -l \/media/);
});

test("mailman stages prebuilt and never compiles on 4GB; npm ci only if lockfile changed", () => {
  const updater = read("daemon/reelos-update.sh");
  assert.match(updater, /prebuilt client staged/);
  assert.match(updater, /4GB box never compiles/);
  assert.match(updater, /\[ -d "\$WORK\/src\/prebuilt" \] && cp -a "\$WORK\/src\/prebuilt"/);
  assert.match(updater, /cmp -s "\$ROOT\/app\/package-lock\.json" "\$NEXT\/app\/package-lock\.json"/);
  assert.match(updater, /package-lock.json unchanged — reused node_modules/);
  assert.match(updater, /package\.json or package-lock\.json changed — running npm ci/);
  assert.match(updater, /vite build skipped — 4GB box/);
  assert.equal(updater, read("install/bin/reelos-update.sh"));
});

test("start:box finds prebuilt nitro and hashed manifest", () => {
  const box = read("scripts/reelos-box.mjs");
  assert.match(box, /nitro\+api/);
  assert.match(box, /prebuilt\/vercel-output/);
  assert.match(box, /prebuilt\/client/);
  assert.match(box, /vite --host :8080 \(door still binds\)/);
  assert.match(box, /killOrphan8080/);
  const dir = mkdtempSync(join(tmpdir(), "reelos-37-"));
  try {
    mkdirSync(join(dir, "prebuilt/client"), { recursive: true });
    writeFileSync(join(dir, "prebuilt/client", "index.html"), "<html></html>\n");
    assert.equal(findClientRoot(dir), join(dir, "prebuilt/client"));
    mkdirSync(join(dir, "prebuilt/vercel-output"), { recursive: true });
    writeFileSync(join(dir, "prebuilt/vercel-output", "nitro.json"), "{}\n");
    assert.equal(findNitroOutput(dir), join(dir, "prebuilt/vercel-output"));
    assert.equal(findPreviewBuild(dir), join(dir, "prebuilt/vercel-output"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const man = read("prebuilt/MANIFEST.txt");
  assert.match(man, /\/assets\/styles-/);
  assert.match(man, /\/assets\/index-/);
  assert.match(man, /4GB box never compiles/);
  assert.match(read("prebuilt/vercel-output/nitro.json"), /nitro/);
});

test("production start:box GET / hashed assets and GET /api/ready", { timeout: 40000 }, async () => {
  const port = "18087";
  const child = spawn("node", ["scripts/with-app-env.mjs", "node", "scripts/reelos-box.mjs"], {
    cwd: root,
    env: { ...process.env, PORT: port, HOST: "127.0.0.1", NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout?.on("data", (d) => {
    out += d;
  });
  child.stderr?.on("data", (d) => {
    out += d;
  });
  const homeFile = join(tmpdir(), "reelos-37-home.html");
  const readyFile = join(tmpdir(), "reelos-37-ready.json");
  const deadline = Date.now() + 25000;
  let home = "";
  let homeCode = "000";
  let readyCode = "000";
  try {
    while (Date.now() < deadline) {
      const homeR = spawnSync(
        "curl",
        ["-sS", "-o", homeFile, "-w", "%{http_code}", "--max-time", "2", `http://127.0.0.1:${port}/`],
        { encoding: "utf8" },
      );
      homeCode = (homeR.stdout || "").trim();
      if (homeCode === "200") break;
      await new Promise((r) => setTimeout(r, 250));
    }
    try {
      home = readFileSync(homeFile, "utf8").replace(/\0/g, "");
    } catch {
      home = "";
    }
    const readyR = spawnSync(
      "curl",
      ["-sS", "-o", readyFile, "-w", "%{http_code}", "--max-time", "3", `http://127.0.0.1:${port}/api/ready`],
      { encoding: "utf8" },
    );
    readyCode = (readyR.stdout || "").trim();
  } finally {
    child.kill("SIGTERM");
    await new Promise((r) => {
      const t = setTimeout(r, 2000);
      child.on("exit", () => {
        clearTimeout(t);
        r();
      });
    });
  }
  assert.equal(homeCode, "200", `GET / ${homeCode}\n${out}\n${home.slice(0, 400)}`);
  assert.match(home, /\/assets\/styles-[A-Za-z0-9_-]+\.css/);
  assert.doesNotMatch(home, /\/src\/styles\.css/);
  assert.equal(readyCode, "200", `GET /api/ready ${readyCode}\n${out}`);
  assert.match(out, /nitro\+api|production preview|serving built UI/);
});
