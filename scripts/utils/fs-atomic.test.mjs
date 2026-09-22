import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { atomicWriteJsonSync } from "./fs-atomic.mjs";

test("atomicWriteJsonSync writes valid JSON data and replaces target cleanly", () => {
  const tmp = mkdtempSync(join(tmpdir(), "reelos-atomic-"));
  try {
    const target = join(tmp, "sub", "answers.json");
    
    // Initial write
    atomicWriteJsonSync(target, { houseName: "Living Room", source: "torbox" });
    assert.equal(existsSync(target), true);
    let read = JSON.parse(readFileSync(target, "utf8"));
    assert.equal(read.houseName, "Living Room");
    assert.equal(read.source, "torbox");

    // Overwrite with update
    atomicWriteJsonSync(target, { houseName: "Lounge 4K", source: "realdebrid" });
    read = JSON.parse(readFileSync(target, "utf8"));
    assert.equal(read.houseName, "Lounge 4K");
    assert.equal(read.source, "realdebrid");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
