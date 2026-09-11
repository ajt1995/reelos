import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { findClientRoot, findPreviewBuild, safeJoin } from "./reelos-box.mjs";
import { betaChannelStub } from "./reelos-lookup-plugin.mjs";
import { planUnstickSearchingIfFileOnDisk } from "./reelos-request-status.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("self-heal shell never walks FUSE, TorBox, or firstboot", () => {
  const heal = read("daemon/reelos-selfheal.sh");
  assert.equal(heal, read("install/bin/reelos-selfheal.sh"));
  assert.match(heal, /not walking FUSE/);
  assert.match(heal, /not enabling firstboot/);
  assert.match(heal, /not talking to TorBox/);
  assert.doesNotMatch(heal, /enable reelos-firstboot/);
  assert.doesNotMatch(heal, /\/mnt\/debrid\/__all__/);
  assert.doesNotMatch(heal, /ota\.lock/);
  assert.doesNotMatch(heal, /find \/mnt/);
  assert.doesNotMatch(heal, /compose pull/);
  assert.doesNotMatch(heal, /api\.torbox|torbox\.app/i);
  assert.match(heal, /ffprobe D-state/);
  assert.match(heal, /skip engines — ffprobe D-state/);
  assert.match(heal, /skip compose up — ffprobe D-state/);
  assert.match(heal, /skip engines — idle load/);
  assert.match(heal, /skip compose up — idle load/);
  assert.doesNotMatch(heal, /ffprobe -/);
});

test("box finds a built client and rejects path escape", () => {
  const dir = mkdtempSync(join(tmpdir(), "reelos-box-"));
  try {
    mkdirSync(join(dir, "dist"), { recursive: true });
    writeFileSync(join(dir, "dist", "index.html"), "<html>ReelOS</html>\n");
    assert.equal(findClientRoot(dir), join(dir, "dist"));
    assert.equal(safeJoin(join(dir, "dist"), "/assets/app.js"), join(dir, "dist", "assets/app.js"));
    assert.equal(safeJoin(join(dir, "dist"), "/../secret"), null);
    mkdirSync(join(dir, ".vercel/output"), { recursive: true });
    writeFileSync(join(dir, ".vercel/output", "nitro.json"), "{}\n");
    assert.equal(findPreviewBuild(dir), join(dir, ".vercel/output"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assert.equal(findClientRoot(join(tmpdir(), "reelos-box-missing")), null);
  assert.equal(findPreviewBuild(join(tmpdir(), "reelos-box-missing")), null);
});

test("beta sidecar is infrastructure only", () => {
  const stub = betaChannelStub("1.2.50.34");
  assert.equal(stub.channel, "beta");
  assert.match(stub.notes[0], /Arena chrome and Books/);
  assert.doesNotMatch(JSON.stringify(stub), /Kavita/);
  assert.match(read("channel-beta.json"), /Arena chrome and Books/);
  assert.match(read("channel-beta.json"), /2\.0\.0/);
  assert.doesNotMatch(JSON.parse(read("channel-beta.json")).tarball, /main\.tar\.gz/);
  assert.doesNotMatch(read("src/styles.css"), /\.arena-page/);
  assert.match(read("scripts/reelos-lookup-plugin.mjs"), /betaChannel === true/);
});

test("unstick plan is import-not-search", () => {
  assert.equal(planUnstickSearchingIfFileOnDisk({ status: "waiting", arrHasFile: true }).search, false);
});
