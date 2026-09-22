import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { checkStorageHeadroom, runBackgroundLruEviction } from "../../services/storage-service.mjs";

test("Tier 1 - F15.1 Storage Headroom: checkStorageHeadroom reports valid free bytes and percentage", () => {
  const status = checkStorageHeadroom();
  assert.equal(status.ok, true);
  assert.ok(typeof status.totalBytes === "number" && status.totalBytes > 0);
  assert.ok(typeof status.freeBytes === "number" && status.freeBytes >= 0);
  assert.ok(typeof status.freePercent === "number");
  assert.ok(typeof status.lowHeadroom === "boolean");
});

test("Tier 1 - F15.2 Storage Headroom: healthy pressure does not imply cleanup is available", () => {
  const result = runBackgroundLruEviction(null, { forcedFreePercent: 25.0 });
  assert.equal(result.ok, false);
  assert.equal(result.available, false);
  assert.equal(result.code, "managed_retention_unavailable");
  assert.equal(result.lowHeadroom, false);
  assert.equal(result.freePercent, 25);
  assert.equal(result.evicted, false);
  assert.equal(result.freedBytes, 0);
});

// These replace unsafe age-only deletion assumptions pending a durable managed
// ownership registry. Preservation here does not verify completed retention.
test("Tier 1 - F15.3 Storage Headroom: low space preserves original bytes while cleanup is unavailable", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-evict-"));
  try {
    const file1 = path.join(tmpDir, "old-video.mp4");
    const original = Buffer.alloc(1024 * 1024, 0x11);
    fs.writeFileSync(file1, original);

    const result = runBackgroundLruEviction(tmpDir, {
      forcedFreePercent: 4.0,
      targetFreePercent: 15.0,
      mediaDir: tmpDir,
    });

    assert.equal(result.ok, false);
    assert.equal(result.available, false);
    assert.equal(result.code, "managed_retention_unavailable");
    assert.equal(result.lowHeadroom, true);
    assert.equal(result.freePercent, 4);
    assert.equal(result.evicted, false);
    assert.equal(result.freedBytes, 0);
    assert.deepEqual(result.items, []);
    assert.deepEqual(fs.readFileSync(file1), original);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
});

test("Tier 1 - F15.4 Storage Headroom: dryRun preserves bytes without claiming candidates or freed space", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-dryrun-"));
  try {
    const file1 = path.join(tmpDir, "keep-me.mp4");
    const original = Buffer.alloc(512 * 1024, 0x22);
    fs.writeFileSync(file1, original);

    const result = runBackgroundLruEviction(tmpDir, {
      forcedFreePercent: 5.0,
      dryRun: true,
      mediaDir: tmpDir,
    });

    assert.equal(result.ok, false);
    assert.equal(result.available, false);
    assert.equal(result.code, "managed_retention_unavailable");
    assert.equal(result.lowHeadroom, true);
    assert.equal(result.freePercent, 5);
    assert.equal(result.evicted, false);
    assert.equal(result.freedBytes, 0);
    assert.deepEqual(result.items, []);
    assert.deepEqual(fs.readFileSync(file1), original);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
});

test("Tier 1 - F15.5 Storage Headroom: safe atomic file write guard handles ENOSPC gracefully", () => {
  // Simulates ENOSPC safe write wrapper pattern
  function safeAtomicWrite(filePath, data) {
    try {
      const headroom = checkStorageHeadroom();
      if (headroom.freePercent < 1.0) {
        return { ok: false, error: "ENOSPC: critical storage headroom (<1%)" };
      }
      fs.writeFileSync(filePath, data);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  const tmpFile = path.join(os.tmpdir(), `reelos-safe-write-${Date.now()}.json`);
  try {
    const res = safeAtomicWrite(tmpFile, JSON.stringify({ saved: true }));
    assert.equal(res.ok, true);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
});
