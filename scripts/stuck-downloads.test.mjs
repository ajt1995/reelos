import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { applyStuckNotes, seerrRequestRow } from "./reelos-seerr.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(root, "install/bin/stuck-downloads.py");

test("stuck-download guards: no re-add + stuck 0% fails without a second TorBox submit", () => {
  const r = spawnSync("python3", [script, "--self-test"], { encoding: "utf8" });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
});

test("lock-clients timer invokes the stuck-download sweep after the client lock", () => {
  const lock = readFileSync(join(root, "install/bin/lock-download-clients.py"), "utf8");
  const daemon = readFileSync(join(root, "daemon/lock-download-clients.py"), "utf8");
  assert.match(lock, /stuck-downloads\.py/);
  assert.match(daemon, /stuck-downloads\.py/);
  assert.match(lock, /removeCompletedDownloads": False/);
  const r = spawnSync("python3", [join(root, "install/bin/lock-download-clients.py"), "--self-test"], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
});

test("daemon stuck-downloads stays twin with install/bin", () => {
  const a = readFileSync(join(root, "install/bin/stuck-downloads.py"), "utf8");
  const b = readFileSync(join(root, "daemon/stuck-downloads.py"), "utf8");
  assert.equal(a, b);
  const p1 = readFileSync(join(root, "install/bin/wire-engines.parts/01.part"), "utf8");
  const p2 = readFileSync(join(root, "daemon/wire-engines.parts/01.part"), "utf8");
  assert.equal(p1, p2);
  assert.match(p1, /wait_fuse_ready/);
});

test("TV retry posts Sonarr ManualImport and never scans /mnt/symlinks parent", () => {
  const src = readFileSync(script, "utf8");
  assert.match(src, /_sonarr_manual_import/);
  assert.match(src, /category_folders/);
  assert.match(src, /queue_season_key/);
  assert.doesNotMatch(src, /folders = \[f"\/mnt\/symlinks\/\{app\['category'\]\}", "\/mnt\/symlinks"\]/);
  const harden = readFileSync(join(root, "install/bin/sonarr_manual_import.py"), "utf8");
  assert.match(harden, /SONARR_FOLDERS/);
  assert.doesNotMatch(harden, /folders = \["\/mnt\/symlinks\/sonarr", "\/mnt\/symlinks"\]/);
  const r = spawnSync("python3", [join(root, "install/bin/sonarr_manual_import.py"), "--self-test"], { encoding: "utf8" });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
});

test("importPending unexpected error is retried, not ignored", () => {
  const src = readFileSync(script, "utf8");
  assert.match(src, /import_is_stuck/);
  assert.match(src, /retry_import/);
  assert.match(src, /importPending/);
  assert.match(src, /fuse green — retry/);
  assert.match(src, /docker exec/);
  assert.match(src, /make_mnt_rshared/);
  assert.match(src, /test_import_pending_unexpected_error_retries_when_readable/);
  assert.match(src, /test_docker_exec_enotconn_is_stale/);
  assert.match(src, /recover_missing_movies/);
  assert.match(src, /MoviesSearch/);
});

test("rshared unit ships for firstboot and install so rslave *arr binds follow FUSE remount", () => {
  const unit = readFileSync(join(root, "install/systemd/reelos-mnt-rshared.service"), "utf8");
  const first = readFileSync(join(root, "firstboot/reelos-mnt-rshared.service"), "utf8");
  assert.equal(unit, first);
  assert.match(unit, /make-rshared \/mnt/);
  assert.match(unit, /Before=docker.service/);
  const updater = readFileSync(join(root, "daemon/reelos-update.sh"), "utf8");
  assert.match(updater, /reelos-mnt-rshared/);
});

test("Requests overlay a stuck-note as failed without wiping an available title", () => {
  const grabbing = seerrRequestRow(
    {
      id: 3,
      type: "movie",
      status: 2,
      createdAt: "2026-09-08T00:00:00.000Z",
      updatedAt: "2026-09-08T00:00:00.000Z",
      media: { tmdbId: 634649, status: 3 },
    },
    {
      "tmdb-634649": {
        status: "failed",
        reason: "Stuck at 0% for 900s — cleared, not re-grabbed",
      },
    },
  );
  assert.equal(grabbing.status, "failed");
  assert.match(grabbing.reason, /not re-grabbed/);

  const available = applyStuckNotes(
    { titleId: "tmdb-634649", status: "available", engine: "downloaded", progress: 100 },
    { "tmdb-634649": { status: "failed", reason: "stale" } },
  );
  assert.equal(available.status, "available");
});
