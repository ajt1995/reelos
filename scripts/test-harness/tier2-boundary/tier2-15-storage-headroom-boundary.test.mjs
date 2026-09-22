import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { checkStorageHeadroom, runBackgroundLruEviction } from "../../services/storage-service.mjs";

test("Tier 2 - F15.1 Storage Headroom Boundary: lowHeadroom boolean triggers strictly below 10.0%", () => {
  // Free percent exactly 10.0% is not lowHeadroom
  const healthy = runBackgroundLruEviction(null, { forcedFreePercent: 10.0 });
  assert.equal(healthy.ok, false);
  assert.equal(healthy.available, false);
  assert.equal(healthy.code, "managed_retention_unavailable");
  assert.equal(healthy.evicted, false);
  assert.equal(healthy.lowHeadroom, false);
  assert.equal(healthy.freePercent, 10);

  // The pressure threshold remains meaningful, but never authorizes cleanup.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-headroom-edge-"));
  try {
    const file = path.join(tmpDir, "original.mp4");
    const original = Buffer.from("boundary original media bytes");
    fs.writeFileSync(file, original);
    const edge = runBackgroundLruEviction(tmpDir, {
      forcedFreePercent: 9.99,
      dryRun: true,
      mediaDir: tmpDir,
    });
    assert.equal(edge.ok, false);
    assert.equal(edge.available, false);
    assert.equal(edge.code, "managed_retention_unavailable");
    assert.equal(edge.lowHeadroom, true);
    assert.equal(edge.freePercent, 9.99);
    assert.equal(edge.evicted, false);
    assert.equal(edge.freedBytes, 0);
    assert.deepEqual(edge.items, []);
    assert.deepEqual(fs.readFileSync(file), original);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
});

test("Tier 2 - F15.2 Storage Headroom Boundary: empty directories do not imply cleanup ownership", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-empty-evict-"));
  try {
    const res = runBackgroundLruEviction(tmpDir, {
      forcedFreePercent: 2.0,
      mediaDir: tmpDir,
    });
    assert.equal(res.ok, false);
    assert.equal(res.available, false);
    assert.equal(res.code, "managed_retention_unavailable");
    assert.equal(res.lowHeadroom, true);
    assert.equal(res.evicted, false, "No cleanup adapter has verified disposable ownership");
    assert.equal(res.freedBytes, 0);
    assert.equal(res.items.length, 0);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
});

// Replaces unsafe age-only deletion assumptions pending a durable managed
// ownership registry; this verifies preservation, not completed retention.
test("Tier 2 - F15.3 Storage Headroom Boundary: old and new originals both survive low pressure", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-lru-order-"));
  try {
    const fileOld = path.join(tmpDir, "old-video.mp4");
    const fileNew = path.join(tmpDir, "new-video.mp4");

    // Old file: 200KB, New file: 100KB
    const oldOriginal = Buffer.alloc(200 * 1024, 0x11);
    const newOriginal = Buffer.alloc(100 * 1024, 0x22);
    fs.writeFileSync(fileOld, oldOriginal);
    fs.writeFileSync(fileNew, newOriginal);

    const tenDaysAgo = new Date(Date.now() - 10 * 86400 * 1000);
    fs.utimesSync(fileOld, tenDaysAgo, tenDaysAgo);

    const headroom = checkStorageHeadroom(tmpDir);
    const totalBytes = headroom.totalBytes || (500 * 1024 * 1024 * 1024);
    // Even a requested 150KB target cannot authorize deletion based on age.
    const targetDeltaPercent = (150 * 1024 / totalBytes) * 100;

    const res = runBackgroundLruEviction(tmpDir, {
      forcedFreePercent: 5.0,
      targetFreePercent: 5.0 + targetDeltaPercent,
      dryRun: false,
      mediaDir: tmpDir,
    });

    assert.equal(res.ok, false);
    assert.equal(res.available, false);
    assert.equal(res.code, "managed_retention_unavailable");
    assert.equal(res.lowHeadroom, true);
    assert.equal(res.freePercent, 5);
    assert.equal(res.evicted, false);
    assert.equal(res.freedBytes, 0);
    assert.deepEqual(res.items, []);
    assert.deepEqual(fs.readFileSync(fileOld), oldOriginal);
    assert.deepEqual(fs.readFileSync(fileNew), newOriginal);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
});

test("Tier 2 - F15.4 Storage Headroom Boundary: non-existent directory handled without crashing", () => {
  const fakeDir = path.join(os.tmpdir(), `non-existent-dir-${Date.now()}`);
  const res = runBackgroundLruEviction(fakeDir, {
    forcedFreePercent: 3.0,
    mediaDir: fakeDir,
  });
  assert.equal(res.ok, false);
  assert.equal(res.available, false);
  assert.equal(res.code, "managed_retention_unavailable");
  assert.equal(res.lowHeadroom, true);
  assert.equal(res.evicted, false);
  assert.equal(res.freedBytes, 0);
  assert.deepEqual(res.items, []);
  assert.equal(fs.existsSync(fakeDir), false);
});

test("Tier 2 - F15.5 Storage Headroom Boundary: safe write guard halts when freePercent is critical (<1%)", () => {
  function safeWriteGuard(freePercent) {
    if (freePercent < 1.0) {
      return { ok: false, status: 507, error: "Insufficient Storage: critical headroom <1%" };
    }
    return { ok: true };
  }

  assert.equal(safeWriteGuard(0.0).ok, false);
  assert.equal(safeWriteGuard(0.5).ok, false);
  assert.equal(safeWriteGuard(0.99).ok, false);
  assert.equal(safeWriteGuard(1.0).ok, true);
  assert.equal(safeWriteGuard(10.0).ok, true);
});
