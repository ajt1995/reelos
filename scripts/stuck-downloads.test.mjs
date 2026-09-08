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
