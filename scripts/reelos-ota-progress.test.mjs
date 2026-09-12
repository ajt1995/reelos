import assert from "node:assert/strict";
import http from "node:http";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  APPLY_STAGE_COUNT,
  DOWNLOAD_STALL_MS,
  bytePercent,
  formatHeartbeatAgo,
  honestApplyProgress,
  parseApplyProgress,
} from "./reelos-ota-progress.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("byte percent is got/total only — never a time climb", () => {
  assert.equal(bytePercent(0, 0), null);
  assert.equal(bytePercent(50, 100), 50);
  assert.equal(bytePercent(100, 100), 100);
  const now = 1_700_000_000_000;
  const a = honestApplyProgress(
    { stage: "download", stageIndex: 1, bytesGot: 40, bytesTotal: 100, heartbeatAt: now, stageStartedAt: now },
    { now, running: true },
  );
  const b = honestApplyProgress(
    { stage: "download", stageIndex: 1, bytesGot: 40, bytesTotal: 100, heartbeatAt: now + 30_000, stageStartedAt: now },
    { now: now + 30_000, running: true },
  );
  assert.equal(a.percent, 40);
  assert.equal(b.percent, 40);
  assert.equal(a.message, "Downloading update · 40%");
  assert.equal(b.percentKind, "bytes");
});

test("no-byte stages are N of M plus heartbeat, not a fake percent", () => {
  const now = 1_700_000_040_000;
  const row = honestApplyProgress(
    {
      stage: "images",
      stageIndex: 7,
      stageCount: 7,
      heartbeatAt: now - 40_000,
      stageStartedAt: now - 40_000,
      label: "Pulling images",
    },
    { now, running: true },
  );
  assert.equal(row.percent, null);
  assert.match(row.message, /Pulling images · 7\/7 · 40s ago/);
  assert.equal(formatHeartbeatAgo(now - 40_000, now), "40s ago");
});

test("download 0 bytes for 2+ minutes is stalled", () => {
  const started = 1_700_000_000_000;
  const row = honestApplyProgress(
    { stage: "download", bytesGot: 0, bytesTotal: 0, stageStartedAt: started, heartbeatAt: started },
    { now: started + DOWNLOAD_STALL_MS, running: true },
  );
  assert.equal(row.stalled, true);
  assert.match(row.message, /stalled/);
  const early = honestApplyProgress(
    { stage: "download", bytesGot: 0, bytesTotal: 8000, stageStartedAt: started, heartbeatAt: started },
    { now: started + 30_000, running: true },
  );
  assert.equal(early.stalled, false);
  assert.equal(early.percent, 0);
});

test("idle when Apply is not running; done only if stamped", () => {
  const idle = honestApplyProgress({ stage: "download", bytesGot: 10, bytesTotal: 100 }, { running: false });
  assert.equal(idle.status, "idle");
  assert.equal(idle.percent, null);
  const done = parseApplyProgress(JSON.stringify({ status: "done", heartbeatAt: 1 }), { running: false });
  assert.equal(done.status, "done");
  assert.equal(done.percent, 100);
});

test("GET /api/update/progress returns honest bytes percent (cloud)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "reelos-progress-api-"));
  const prevState = process.env.REELOS_STATE;
  const prevOta = process.env.REELOS_OTA;
  process.env.REELOS_STATE = dir;
  process.env.REELOS_OTA = "1";
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "apply-progress.json"),
    JSON.stringify({
      status: "running",
      stage: "download",
      stageIndex: 1,
      stageCount: APPLY_STAGE_COUNT,
      label: "Downloading update",
      bytesGot: 25_000_000,
      bytesTotal: 50_000_000,
      heartbeatAt: Date.now(),
      stageStartedAt: Date.now(),
      startedAt: Date.now(),
    }),
  );
  const { dispatchReelOsApi } = await import("./reelos-lookup-plugin.mjs");
  const server = http.createServer(async (req, res) => {
    if (await dispatchReelOsApi(req, res)) return;
    res.statusCode = 404;
    res.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/update/progress`);
    const j = await r.json();
    assert.equal(r.status, 200);
    assert.equal(j.ok, true);
    assert.equal(j.percent, 50);
    assert.equal(j.percentKind, "bytes");
    assert.match(j.message, /Downloading update · 50%/);
    const st = await fetch(`http://127.0.0.1:${port}/api/update/status`);
    const body = await st.json();
    assert.equal(body.progress.percent, 50);
    const health = honestApplyProgress(
      { stage: "health", stageIndex: 5, stageCount: 7, heartbeatAt: Date.now() - 12_000 },
      { now: Date.now(), running: true },
    );
    assert.equal(health.percent, null);
    assert.match(health.message, /5\/7/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (prevState == null) delete process.env.REELOS_STATE;
    else process.env.REELOS_STATE = prevState;
    if (prevOta == null) delete process.env.REELOS_OTA;
    else process.env.REELOS_OTA = prevOta;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("splash and mailman contracts for honest progress", () => {
  assert.match(read("src/components/splash.tsx"), /\/api\/update\/status/);
  assert.match(read("src/components/splash.tsx"), /stalled/);
  assert.match(read("src/components/splash.tsx"), /Updating ReelOS/);
  assert.doesNotMatch(read("src/components/splash.tsx"), /Not a percent/);
  assert.match(read("scripts/reelos-lookup-plugin.mjs"), /\/api\/update\/progress/);
  assert.match(read("daemon/reelos-update.sh"), /apply-progress\.json/);
  assert.match(read("src/components/wizard.tsx"), /TOTAL = 7/);
  assert.doesNotMatch(read("src/components/wizard.tsx"), /hardware profile step/i);
  assert.equal(read("daemon/reelos-update.sh"), read("install/bin/reelos-update.sh"));
  assert.equal(read("daemon/reelos_apply_progress.py"), read("install/bin/reelos_apply_progress.py"));
  assert.match(read("src/components/settings-panels.tsx"), /Disk type/);
  assert.match(read("src/components/settings-panels.tsx"), /Disk size/);
  assert.match(read("scripts/reelos-box-scale.mjs"), /Tuning for 4GB RAM · spinning disk/);
});
