import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("watchdog probe-home.sh exists and contains required fail-tracking contracts", () => {
  const daemonPath = join(root, "daemon/probe-home.sh");
  const installPath = join(root, "install/bin/probe-home.sh");

  assert.ok(existsSync(daemonPath), "daemon/probe-home.sh must exist");
  assert.ok(existsSync(installPath), "install/bin/probe-home.sh must exist");

  const daemonSrc = readFileSync(daemonPath, "utf8");
  const installSrc = readFileSync(installPath, "utf8");

  assert.equal(daemonSrc, installSrc, "daemon and install twins must be identical");
  assert.match(daemonSrc, /probe-home\.fails/, "tracks consecutive failures");
  assert.match(daemonSrc, /watchdog\.log/, "logs to watchdog.log");
  assert.match(daemonSrc, /systemctl restart reelos/, "restarts reelos");
  assert.match(daemonSrc, /api\/ready/, "probes api/ready");
  assert.match(daemonSrc, /-ge 3/, "triggers on 3 consecutive failures");
});
