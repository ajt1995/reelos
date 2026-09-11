import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("Apply overlays configs with rsync excludes, not FUSE dumps", () => {
  const updater = read("daemon/reelos-update.sh");
  assert.equal(updater, read("install/bin/reelos-update.sh"));
  assert.match(updater, /overlay_house_configs/);
  assert.match(updater, /rsync -a --exclude 'decypharr\/cache\/'/);
  assert.match(updater, /--exclude '\*\*\/cache\/dfs\/'/);
  assert.match(updater, /--exclude 'jellyfin\/\*\*\/cache\/'/);
  assert.match(updater, /--exclude 'jellyfin\/\*\*\/transcodes\/'/);
  assert.match(updater, /--exclude '\*\*\/MediaCover\/'/);
  assert.match(updater, /--exclude '\*\*\/logs\/'/);
  assert.match(updater, /--exclude '\*\.db-wal'/);
  assert.match(updater, /overlay house compose\/configs onto staging/);
  assert.match(updater, /rsync missing — copy top-level config dirs without cache\/dfs/);
  assert.doesNotMatch(updater, /cp -a "\$ROOT\/compose\/configs\/\."/);
});

test("probe_home restarts hung reelos after 15s and daemon-reloads", () => {
  const updater = read("daemon/reelos-update.sh");
  const probe = updater.slice(updater.indexOf("probe_home()"), updater.indexOf("probe_port80()"));
  assert.match(probe, /systemctl daemon-reload/);
  assert.match(probe, /not 200 after 15s/);
  assert.match(probe, /restart hung reelos/);
  assert.match(probe, /systemctl restart reelos/);
  assert.match(probe, /restarted=1/);
});

test("GET /api/ready fans in box+library+requests without awaiting jellyfin", () => {
  const src = read("scripts/reelos-lookup-plugin.mjs");
  const progress = read("scripts/reelos-request-progress-plugin.mjs");
  assert.match(src, /pathOnly === "\/api\/ready"/);
  assert.match(src, /async function handleReady/);
  assert.match(src, /collectRequestList/);
  assert.match(src, /scheduleFuseReaders/);
  assert.match(src, /Promise\.all/);
  assert.match(src, /function publicAnswers/);
  assert.match(src, /delete out\.adminPassword/);
  const ready = src.slice(src.indexOf("async function handleReady"), src.indexOf("async function handleDisks"));
  assert.match(ready, /boxSyncSlice/);
  assert.match(ready, /serveLibrary/);
  assert.match(ready, /collectRequestList/);
  assert.match(ready, /publicAnswers\(slice\.answers\)/);
  assert.doesNotMatch(ready, /await jellyfinState/);
  assert.doesNotMatch(ready, /adminPassword:/);
  assert.match(ready, /timings/);
  assert.match(progress, /export async function collectRequestList/);
  assert.doesNotMatch(progress, /await maybeRecover/);
});

test("handleBox still does not await jellyfinState", () => {
  const src = read("scripts/reelos-lookup-plugin.mjs");
  const box = src.slice(src.indexOf("function boxSyncSlice"), src.indexOf("async function handleTailscaleLogin"));
  assert.match(box, /scheduleBoxProbe/);
  assert.doesNotMatch(box, /await jellyfinState/);
  assert.match(box, /adminPassword/);
});

test("splash shows warming steps when provisioned; Begin setup only when not", () => {
  const splash = read("src/components/splash.tsx");
  const gate = read("src/components/gate.tsx");
  const rootFile = read("src/routes/__root.tsx");
  const store = read("src/lib/store.ts");
  const sync = read("src/lib/use-sync-requests.ts");
  assert.match(splash, /Local state/);
  assert.match(splash, /This house/);
  assert.match(splash, /Library/);
  assert.match(splash, /Requests/);
  assert.match(splash, /Begin setup/);
  assert.match(splash, /showWarming/);
  assert.match(splash, /spinRing=\{showWarming/);
  assert.match(gate, /<Splash warming \/>/);
  assert.match(gate, /phase === "splash"\) return <Splash \/>/);
  assert.match(rootFile, /\/api\/ready\?limit=24/);
  assert.match(rootFile, /applyReadyPayload/);
  assert.match(rootFile, /AbortSignal\.timeout\(4000\)/);
  assert.match(store, /applyReadyPayload/);
  assert.match(store, /bootSteps/);
  assert.match(store, /if \(get\(\)\.shelfReady\) return/);
  assert.match(sync, /seeded \? 0 : 1500/);
});
