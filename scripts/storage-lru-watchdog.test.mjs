import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { join } from "node:path";
import os from "node:os";
import {
  checkStorageHeadroom,
  scanWatchedMediaCandidates,
  runBackgroundLruEviction,
  StoragePoolWatchdog,
} from "./services/storage-service.mjs";

test("Storage Watchdog: checkStorageHeadroom returns valid percentages and headroom state", () => {
  const res = checkStorageHeadroom();
  assert.equal(res.ok, true);
  assert.equal(typeof res.totalBytes, "number");
  assert.equal(typeof res.freeBytes, "number");
  assert.equal(typeof res.freePercent, "number");
  assert.equal(typeof res.usedPercent, "number");
  assert.equal(typeof res.lowHeadroom, "boolean");
  assert.ok(res.totalBytes > 0);
});

test("Storage measurement fails closed on absent volumes, invalid statistics, and unavailable APIs", (t) => {
  const missing = join(os.tmpdir(), `reelos-missing-volume-${Date.now()}`);
  assert.equal(checkStorageHeadroom(missing, { allowSimulation: false }).available, false);
  for (const stats of [
    { bsize: 4096, blocks: 0, bavail: 0 },
    { bsize: 4096, blocks: 100, bavail: 101 },
    { bsize: 4096, blocks: 100, bavail: -1 },
    { bsize: 4096, blocks: NaN, bavail: 1 },
    { bsize: Number.MAX_SAFE_INTEGER, blocks: 100, bavail: 1 },
  ]) {
    const mocked = t.mock.method(fs, "statfsSync", () => stats);
    const result = checkStorageHeadroom(os.tmpdir(), { allowSimulation: false });
    assert.equal(result.ok, false);
    assert.equal(result.freeBytes, null);
    assert.equal(result.lowHeadroom, true);
    mocked.mock.restore();
  }
  const denied = t.mock.method(fs, "statfsSync", () => { throw new Error("Denied"); });
  assert.equal(checkStorageHeadroom(os.tmpdir(), { allowSimulation: false }).totalBytes, null);
  denied.mock.restore();
});

test("Storage measurement uses available blocks rather than OS-reserved free blocks", (t) => {
  t.mock.method(fs, "statfsSync", () => ({ bsize: 1024, blocks: 1000, bfree: 500, bavail: 100 }));
  const result = checkStorageHeadroom(os.tmpdir(), { allowSimulation: false });
  assert.equal(result.freeBytes, 102400);
  assert.equal(result.freePercent, 10);
});

test("Storage Watchdog: scanWatchedMediaCandidates detects media files and metadata", () => {
  const tmpDir = fs.mkdtempSync(join(os.tmpdir(), "reelos-media-scan-"));
  try {
    const file1 = join(tmpDir, "movie1.mp4");
    const file2 = join(tmpDir, "show1.mkv");
    const textFile = join(tmpDir, "notes.txt");

    fs.writeFileSync(file1, Buffer.alloc(1024, 0x1));
    fs.writeFileSync(file2, Buffer.alloc(2048, 0x2));
    fs.writeFileSync(textFile, "not a video");

    const candidates = scanWatchedMediaCandidates(tmpDir);
    assert.equal(candidates.length, 2);

    const paths = candidates.map((c) => c.path.replace(/\\/g, "/"));
    assert.ok(paths.some((p) => p.endsWith("movie1.mp4")));
    assert.ok(paths.some((p) => p.endsWith("show1.mkv")));
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
});

test("Storage Watchdog: healthy pressure remains visible but cleanup is explicitly unavailable", () => {
  const res = runBackgroundLruEviction("/mnt/storage", { forcedFreePercent: 25.0 });
  assert.equal(res.ok, false);
  assert.equal(res.available, false);
  assert.equal(res.code, "managed_retention_unavailable");
  assert.equal(res.freePercent, 25);
  assert.equal(res.lowHeadroom, false);
  assert.equal(res.evicted, false);
  assert.equal(res.freedBytes, 0);
  assert.equal(res.items.length, 0);
});

// Replaces the unsafe age-based deletion contract: age and directory placement
// cannot prove managed/disposable ownership or that a title is not retained.
test("Storage Watchdog: low pressure preserves originals, pinned and unrecognized files without scanning", (t) => {
  const tmpDir = fs.mkdtempSync(join(os.tmpdir(), "reelos-evict-test-"));
  try {
    fs.mkdirSync(join(tmpDir, "nested"));
    const files = [
      [join(tmpDir, "personal-original.mp4"), "personal original bytes"],
      [join(tmpDir, "pinned-favorite.mkv"), "retained favorite bytes"],
      [join(tmpDir, "nested", "unrecognized.webm"), "unrecognized bytes"],
      [join(tmpDir, "pins.json"), '{"pinned":["pinned-favorite"]}'],
    ];
    const now = Date.now() / 1000;
    for (const [file, contents] of files) {
      fs.writeFileSync(file, contents);
      fs.utimesSync(file, now - 10000, now - 10000);
    }
    const scan = t.mock.method(fs, "readdirSync", () => { throw new Error("Cleanup must not enumerate media"); });
    const remove = t.mock.method(fs, "unlinkSync", () => { throw new Error("Cleanup must not unlink files"); });
    for (const dryRun of [false, true]) {
      const res = runBackgroundLruEviction(tmpDir, {
        forcedFreePercent: 0,
        targetFreePercent: 100,
        mediaDir: tmpDir,
        dryRun,
      });
      assert.equal(res.ok, false);
      assert.equal(res.available, false);
      assert.equal(res.code, "managed_retention_unavailable");
      assert.equal(res.evicted, false);
      assert.equal(res.freePercent, 0);
      assert.equal(res.lowHeadroom, true);
      assert.equal(res.freedBytes, 0);
      assert.deepEqual(res.items, []);
    }
    assert.equal(scan.mock.callCount(), 0);
    assert.equal(remove.mock.callCount(), 0);
    for (const [file, contents] of files) assert.equal(fs.readFileSync(file, "utf8"), contents);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
});

test("Storage Watchdog: root, broad and default pools refuse cleanup without enumerating user files", (t) => {
  const scan = t.mock.method(fs, "readdirSync", () => { throw new Error("Root scan forbidden"); });
  const remove = t.mock.method(fs, "unlinkSync", () => { throw new Error("File deletion forbidden"); });
  for (const pool of ["/", "C:\\", process.cwd(), os.homedir(), null]) {
    const res = runBackgroundLruEviction(pool, { forcedFreePercent: 1, mediaDir: pool, dryRun: false });
    assert.equal(res.ok, false);
    assert.equal(res.available, false);
    assert.equal(res.evicted, false);
    assert.equal(res.freedBytes, 0);
    assert.deepEqual(res.items, []);
  }
  assert.equal(scan.mock.callCount(), 0);
  assert.equal(remove.mock.callCount(), 0);
});

test("Storage Watchdog: low-pressure timer monitors but reports cleanup not connected", (t) => {
  let tick;
  t.mock.method(globalThis, "setInterval", (callback) => {
    tick = callback;
    return { unref() {} };
  });
  t.mock.method(globalThis, "clearInterval", () => {});
  t.mock.method(fs, "statfsSync", () => ({ blocks: 100, bavail: 1, bsize: 1024 }));
  const scan = t.mock.method(fs, "readdirSync", () => { throw new Error("Watchdog scan forbidden"); });
  const remove = t.mock.method(fs, "unlinkSync", () => { throw new Error("Watchdog deletion forbidden"); });
  const dog = new StoragePoolWatchdog();
  dog.startWatchdog(10000);
  tick();
  const status = dog.getStatus();
  assert.equal(status.headroom.lowHeadroom, true);
  assert.equal(status.cleanup.available, false);
  assert.equal(status.cleanup.status, "not-connected");
  assert.equal(status.lastEvictionResult.code, "managed_retention_unavailable");
  assert.equal(status.lastEvictionResult.evicted, false);
  assert.equal(scan.mock.callCount(), 0);
  assert.equal(remove.mock.callCount(), 0);
  dog.stopWatchdog();
});

test("Storage Watchdog: StoragePoolWatchdog start, getStatus, stop cycle works cleanly", () => {
  const dog = new StoragePoolWatchdog();
  assert.equal(dog.isActive, false);

  dog.startWatchdog(10000);
  assert.equal(dog.isActive, true);

  const status = dog.getStatus();
  assert.equal(status.isActive, true);
  assert.ok(status.headroom);
  assert.equal(status.cleanup.available, false);
  assert.equal(status.cleanup.status, "not-connected");

  dog.stopWatchdog();
  assert.equal(dog.isActive, false);
});

test("Storage Watchdog: resolveDefaultPoolPath returns a non-empty string", async () => {
  const { resolveDefaultPoolPath } = await import("./services/storage-service.mjs");
  const path = resolveDefaultPoolPath();
  assert.equal(typeof path, "string");
  assert.ok(path.length > 0);
});
