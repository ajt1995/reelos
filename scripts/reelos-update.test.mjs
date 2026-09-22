import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const daemon = readFileSync(join(root, "daemon/reelos-update.sh"), "utf8");
const packed = readFileSync(join(root, "install/bin/reelos-update.sh"), "utf8");

test("packaged update entry point exactly matches daemon source", () => assert.equal(packed, daemon));
test("shell updater refuses missing trust and delegates only to signed apply", () => {
  assert.match(daemon, /release-trust\.json/); assert.match(daemon, /manual Day-0 release trust bootstrap/);
  assert.match(daemon, /reelos-release-tool\.mjs" apply/); assert.doesNotMatch(daemon, /github\.com|curl|wget|Mocked|simulat/i);
});
test("Linux service launches the health-gated active pointer", () => {
  const service = readFileSync(join(root, "install/systemd/reelos.service"), "utf8");
  assert.match(service, /reelos-launch-active\.mjs/); assert.doesNotMatch(service, /WorkingDirectory=\/opt\/reelos\/app/);
});
