import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { enforceStorageWatermarks } from "./maintenance.mjs";

test("maintenance: LRU watermark eviction preserves pinned files and prunes unpinned until low-watermark", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelflow-watermark-"));

  // Create 3 files in cache: 1 old unpinned, 1 old PINNED, 1 recent unpinned
  const file1 = path.join(tmpDir, "old-unpinned.mkv");
  const file2 = path.join(tmpDir, "old-pinned.mkv");
  const file3 = path.join(tmpDir, "recent-unpinned.mkv");

  fs.writeFileSync(file1, "large chunk 1");
  fs.writeFileSync(file2, "large chunk 2 (comfort show)");
  fs.writeFileSync(`${file2}.pinned`, "pinned by user for offline trip");
  fs.writeFileSync(file3, "large chunk 3");

  // Set fake access times
  const past = new Date(Date.now() - 1000000);
  fs.utimesSync(file1, past, past);
  fs.utimesSync(file2, past, past);

  let simulatedUsage = 90; // High watermark triggered!
  const mockGetUsage = () => {
    return simulatedUsage;
  };

  // Run watermark enforcement with mock usage decrement
  const result = enforceStorageWatermarks(tmpDir, {
    highWatermark: 85,
    lowWatermark: 70,
    getUsage: () => {
      // Each unlinked file drops simulated usage by 15%
      const count = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".mkv")).length;
      return 50 + (count * 15);
    },
  });

  assert.equal(result.triggered, true);

  // file1 should be pruned (oldest unpinned)
  assert.equal(fs.existsSync(file1), false);

  // file2 MUST BE PRESERVED because it has .pinned!
  assert.equal(fs.existsSync(file2), true);
  assert.equal(fs.existsSync(`${file2}.pinned`), true);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
