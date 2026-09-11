import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const updater = readFileSync(join(root, "daemon/reelos-update.sh"), "utf8");
const packed = readFileSync(join(root, "install/bin/reelos-update.sh"), "utf8");

test("appliance copy of the mailman matches daemon/", () => {
  assert.equal(packed, updater);
});

test("SKIP_NPM reuses node_modules when the lockfile matches", () => {
  assert.match(updater, /cmp -s "\$ROOT\/app\/package-lock\.json" "\$NEXT\/app\/package-lock\.json"/);
  assert.match(updater, /package-lock.json unchanged — reused node_modules/);
  assert.match(updater, /package\.json or package-lock\.json changed — running npm ci/);
  assert.match(updater, /vite build skipped — 4GB box/);
  assert.match(updater, /prebuilt client staged/);
  assert.match(updater, /4GB box never compiles/);
  assert.doesNotMatch(
    updater,
    /if cmp -s "\$ROOT\/app\/package\.json" "\$NEXT\/app\/package\.json"; then\n    SKIP_NPM=1/,
  );
});

test("failed npm ci / missing package.json never swap the live tree", () => {
  assert.match(updater, /staging missing package\.json — not swapping/);
  assert.match(updater, /npm ci failed — not swapping/);
  const npmFail = updater.indexOf('log "npm ci failed — not swapping"');
  const swap = updater.indexOf('mv "$ROOT/app" "$ROOT.prev/app"');
  assert.ok(npmFail >= 0 && swap > npmFail, "npm ci abort must be before the live mv");
});

test("npm ci does not fall back to npm install when a lockfile is present", () => {
  const lockCi = updater.indexOf("[ -f \"$NEXT/app/package-lock.json\" ]");
  const fallback = updater.indexOf("npm ci --no-audit --no-fund || npm install");
  assert.ok(lockCi >= 0, "lockfile-present npm ci branch missing");
  assert.equal(fallback, -1, "lockfile-present apply must not hide drift with npm install");
});

test("search hop is advisory; FUSE/Jellyfin fail-close only when compose changed", () => {
  assert.match(updater, /SEARCH_HOP_FAIL=1/);
  assert.match(updater, /hop search red — not blocking UI-only stamp/);
  assert.match(updater, /hop FUSE\/Jellyfin red — compose unchanged, not blocking stamp/);
  assert.match(updater, /hop search retry \$i\/4/);
  assert.match(updater, /COMPOSE_CHANGED:-0\}" = "1" \] && \[ "\$\{HOP_FAIL:-0\}" = "1"/);
  assert.equal(
    updater.includes('log "hop search red"\n    HOP_FAIL=1'),
    false,
    "search hop must not set HOP_FAIL",
  );
});

test("home probe waits longer than a Vite cold start and does not restart every second", () => {
  assert.match(updater, /for i in \$\(seq 1 90\)/);
  assert.match(updater, /\[waiting Home\] %d\/90/);
  assert.match(updater, /i % 5/);
});

test("restore moves the broken tree aside instead of deleting live app first", () => {
  assert.match(updater, /mv "\$ROOT\/app" "\$ROOT\/app\.broken"/);
  const blindRm = updater.indexOf('rm -rf "$ROOT/app"\n    mv "$ROOT.prev/app"');
  assert.equal(blindRm, -1);
});

test("house compose/configs overlay onto staging (no dest-exists nest)", () => {
  assert.match(updater, /overlay house compose\/configs onto staging/);
  assert.match(updater, /overlay_house_configs/);
  assert.match(updater, /"\$ROOT\/compose\/configs\/" "\$NEXT\/compose\/configs\/"/);
  assert.doesNotMatch(updater, /cp -a "\$ROOT\/compose\/configs" "\$NEXT\/compose\/configs"/);
  assert.doesNotMatch(updater, /cp -a "\$ROOT\/compose\/configs\/\." "\$NEXT\/compose\/configs\/"/);
});

test("Stage 3 node_modules copy heartbeats so a long cp does not look wedged", () => {
  assert.match(updater, /copy_node_modules_with_heartbeat/);
  assert.match(updater, /still copying node_modules/);
  assert.match(updater, /copying node_modules into staging \(8080 still up\)/);
  const copy = updater.indexOf("copy_node_modules_with_heartbeat");
  const swap = updater.indexOf('mv "$ROOT/app" "$ROOT.prev/app"');
  assert.ok(copy >= 0 && swap > copy, "node_modules copy must stay before the live mv");
});

test("compose pull is after applied. and time-bounded", () => {
  const applied = updater.indexOf('log "ReelOS $REMOTE applied."');
  const pull = updater.indexOf("stack images — docker compose pull");
  assert.ok(applied >= 0 && pull > applied, "pull must not run before stamp");
  assert.match(updater, /timeout 600 docker compose pull/);
});

test("FUSE hops use ls not -e; stale unmount runs before compose up", () => {
  assert.match(updater, /fuse_live\(\) \{/);
  assert.match(updater, /ls \/mnt\/debrid\/__all__/);
  assert.match(updater, /clear stale FUSE before compose up/);
  assert.match(updater, /start_fuse_readers\(\) \{/);
  assert.match(updater, /docker start decypharr/);
  const clear = updater.indexOf('log "clear stale FUSE before compose up"');
  const up = updater.indexOf("up -d --remove-orphans");
  const remount = updater.indexOf('log "compose recreated — remount FUSE before hops"');
  const startReaders = updater.lastIndexOf("start_fuse_readers");
  assert.ok(clear >= 0 && up > clear, "stale FUSE must unmount before compose up");
  assert.ok(remount > up && startReaders > remount, "exited readers start after remount");
  assert.equal(
    updater.includes("[ -e /mnt/debrid/__all__ ] || [ -e /mnt/debrid/version.txt ]"),
    false,
    "ENOTCONN leftovers make -e true; hops must ls",
  );
});

test("compose change is vs pre-swap yml; FUSE remounts after compose up", () => {
  assert.match(
    updater,
    /cmp -s "\$WORK\/src\/install\/compose\/docker-compose\.yml" "\$PREV_YML"/,
  );
  assert.match(updater, /PREV_YML="\$ROOT\.prev\/docker-compose\.yml"/);
  assert.equal(
    updater.includes(
      'cmp -s "$WORK/src/install/compose/docker-compose.yml" "$ROOT/compose/docker-compose.yml"',
    ),
    false,
    "live compose was already swapped — comparing it to the tarball always skips up",
  );
  const up = updater.indexOf("up -d --remove-orphans");
  const remount = updater.indexOf('log "compose recreated — remount FUSE before hops"');
  assert.ok(up >= 0 && remount > up, "FUSE remount must run after compose up");
});

test("second Apply is refused; ota.lock is never deleted", () => {
  assert.match(updater, /apply already running — refusing second Apply/);
  assert.equal(updater.includes("stale ota.lock — taking lock"), false);
  assert.equal(updater.includes('rm -f "$STATE/ota.lock"'), false);
});

test("nudge_fuse does not stack a live Decypharr mount; no-ffprobe always runs", () => {
  assert.match(updater, /fuse_count\(\) \{/);
  assert.match(updater, /fuse stacked \$n — live, not unmounting/);
  assert.match(updater, /fuse already on host \(\$n mount\(s\)\) — do not remount if listed/);
  assert.match(updater, /python3 "\$ROOT\/bin\/wire-engines.py" no-ffprobe/);
  assert.match(updater, /seed_arr_debrid_json/);
  assert.match(updater, /reelos-debrid\.json/);
  assert.doesNotMatch(updater, /umount -l \/media/);
  assert.doesNotMatch(updater, /rm -rf \/media/);
});
