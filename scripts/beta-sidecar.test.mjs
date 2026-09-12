import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { cmpVer, isRollback } from "./update-notes.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("sidecar: VERSION is 1.2.50.50; beta is a separate 2.0.0 tarball", () => {
  const ver = read("VERSION").trim();
  const chan = JSON.parse(read("channel.json"));
  const beta = JSON.parse(read("channel-beta.json"));
  assert.equal(ver, "1.2.50.50");
  assert.equal(chan.version, "1.2.50.50");
  assert.equal(chan.channel, "stable");
  assert.match(chan.tarball, /main\.tar\.gz/);
  assert.doesNotMatch(JSON.stringify(chan), /beta-arena-books/);
  assert.equal(beta.version, "2.0.0");
  assert.equal(beta.channel, "beta");
  assert.match(beta.tarball, /cursor\/beta-arena-books-5ba6\.tar\.gz/);
  assert.doesNotMatch(beta.tarball, /main\.tar\.gz/);
  assert.doesNotMatch(read("src/styles.css"), /\.arena-page/);
  assert.doesNotMatch(read("src/lib/store.ts"), /LATEST_VERSION = "2\./);
  assert.doesNotMatch(read("src/components/settings-updates.tsx"), /stub today/);
});

test("sidecar: 2.0.0 is newer; leaving beta is a rollback to 50", () => {
  assert.ok(cmpVer("2.0.0", "1.2.50.50") > 0);
  assert.equal(isRollback("2.0.0", "1.2.50.50", false), true);
  assert.equal(isRollback("2.0.0", "1.2.50.50", true), false);
});

test("sidecar: mailman prefers main channel-beta and skips the stub", () => {
  const updater = read("daemon/reelos-update.sh");
  const plugin = read("scripts/reelos-lookup-plugin.mjs");
  assert.equal(updater, read("install/bin/reelos-update.sh"));
  assert.match(updater, /ui_wants_beta/);
  assert.match(updater, /beta channel from ui-settings.json/);
  assert.match(updater, /channel-beta stub — keep looking/);
  assert.match(updater, /leave beta for last stable/);
  const mainIdx = updater.indexOf("contents/channel-beta.json?ref=main");
  const branchIdx = updater.indexOf("contents/channel-beta.json?ref=cursor/beta-arena-books-5ba6");
  assert.ok(mainIdx > 0 && branchIdx > mainIdx, "main channel-beta must be fetched before the beta branch");
  assert.match(plugin, /shaDrift = !beta && !rollback && Boolean\(head\) && head !== applied/);
  assert.match(plugin, /ui apply using local mailman/);
  assert.match(read("src/components/settings-updates.tsx"), /Roll back/);
  assert.match(read("src/components/settings-updates.tsx"), /Beta channel/);
});

test("sidecar: check-ota stays green without Arena CSS", () => {
  const r = spawnSync("python3", ["scripts/check-ota.py", "."], { cwd: root, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /check-ota ok version=1\.2\.50\.50/);
});
