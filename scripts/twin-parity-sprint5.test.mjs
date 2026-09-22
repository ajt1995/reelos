import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("Sprint 5: strict byte-for-byte twin parity between daemon/ and install/bin/", () => {
  const twinFiles = [
    ["daemon/wiring/hardware.py", "install/bin/wiring/hardware.py"],
    ["daemon/wiring/jellyfin.py", "install/bin/wiring/jellyfin.py"],
    ["daemon/reelos_hardware.py", "install/bin/reelos_hardware.py"],
    ["daemon/wire-engines.parts/07.part", "install/bin/wire-engines.parts/07.part"],
    ["daemon/wire-engines.parts/09.part", "install/bin/wire-engines.parts/09.part"],
    ["daemon/probe-home.sh", "install/bin/probe-home.sh"],
    ["daemon/reelos-bios-tune.sh", "install/bin/reelos-bios-tune.sh"],
  ];

  for (const [f1, f2] of twinFiles) {
    if (!existsSync(join(root, f1))) continue;
    assert.equal(
      read(f1),
      read(f2),
      `Twin mismatch between ${f1} and ${f2}`
    );
  }
});
