import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function joinParts(dir) {
  return readdirSync(dir)
    .filter((n) => n.endsWith(".part"))
    .sort()
    .map((n) => readFileSync(join(dir, n), "utf8"))
    .join("");
}

test("stack: VERSION / channel / stamps agree (1.2.50.1)", () => {
  const ver = read("VERSION").trim();
  const chan = JSON.parse(read("channel.json"));
  const stamp = read("src/lib/version-stamp.ts");
  const store = read("src/lib/store.ts");
  assert.equal(ver, "1.2.50.1");
  assert.equal(chan.version, "1.2.50.1");
  assert.match(stamp, /SHIPPED_VERSION = "1\.2\.50\.1"/);
  assert.match(stamp, /LATEST_VERSION = "1\.2\.50\.1"/);
  assert.match(store, /SHIPPED_VERSION = "1\.2\.50\.1"/);
  assert.match(store, /LATEST_VERSION = "1\.2\.50\.1"/);
  assert.match(read("HAL.md"), /1\.2\.50\.1/);
});

test("stack: package-lock stays npm-ci-able and mailman gates SKIP_NPM on it", () => {
  const pkg = JSON.parse(read("package.json"));
  const lock = JSON.parse(read("package-lock.json"));
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.packages?.[""]?.name, pkg.name);
  const updater = read("daemon/reelos-update.sh");
  assert.match(updater, /cmp -s "\$ROOT\/app\/package-lock\.json" "\$NEXT\/app\/package-lock\.json"/);
  assert.equal(updater.includes("npm ci --no-audit --no-fund || npm install"), false);
});

test("stack: jellyfinToken Authorization + #46 cache + lean /api/library", () => {
  const src = read("scripts/reelos-lookup-plugin.mjs");
  assert.match(src, /const JF_AUTH/);
  assert.match(src, /Authorization: JF_AUTH/);
  assert.match(src, /"X-Emby-Authorization": JF_AUTH/);
  assert.match(src, /jellyfinTokens\.set\(user, password, auth\)/);
  assert.match(src, /createLibraryCache/);
  assert.match(src, /serveLibrary/);
  assert.match(src, /revealJellyfinAdmin/);
  assert.doesNotMatch(src, /Fields=Overview,ProviderIds/);
});

test("stack: Finish does not spawnSync pull; seeds network.xml then detaches up", () => {
  const src = read("scripts/reelos-lookup-plugin.mjs");
  const chunk = src.slice(src.indexOf("async function handleProvision"), src.indexOf("async function handlePing"));
  assert.doesNotMatch(chunk, /run\(\["pull"\]/);
  assert.doesNotMatch(src, /compose", "pull"/);
  assert.match(chunk, /seedJellyfinNetworkXml\(composeDir\)/);
  assert.match(chunk, /Do not spawnSync `compose pull`/);
  assert.match(chunk, /docker compose up -d/);
  assert.match(chunk, /detached: true/);
  assert.ok(chunk.indexOf("seedJellyfinNetworkXml") < chunk.indexOf("docker compose up -d"));
});

test("stack: search hop is advisory; FUSE/Jellyfin fail-close only if compose yml changed", () => {
  const updater = read("daemon/reelos-update.sh");
  assert.match(updater, /SEARCH_HOP_FAIL=1/);
  assert.match(updater, /hop search red — not blocking UI-only stamp/);
  assert.equal(updater.includes('log "hop search red"\n    HOP_FAIL=1'), false);
  assert.match(updater, /overlay house compose\/configs onto staging/);
  assert.match(updater, /mv "\$ROOT\/app" "\$ROOT\/app\.broken"/);
  assert.match(updater, /need src\/components\/title-view-live\.tsx '\/api\/request'/);
  assert.match(updater, /need src\/components\/settings-terminal\.tsx 'title="Terminal"'/);
  assert.match(updater, /need scripts\/reelos-lookup-plugin\.mjs 'serveLibrary'/);
});

test("stack: importPending retries when FUSE is readable (does not ignore)", () => {
  const src = read("daemon/stuck-downloads.py");
  assert.match(src, /def import_is_stuck/);
  assert.match(src, /retry_import/);
  assert.match(src, /fuse green — retry/);
  assert.equal(read("daemon/stuck-downloads.py"), read("install/bin/stuck-downloads.py"));
});

test("stack: #50 rshared unit + container ENOTCONN heal stay on main", () => {
  const updater = read("daemon/reelos-update.sh");
  const stuck = read("daemon/stuck-downloads.py");
  assert.match(updater, /reelos-mnt-rshared\.service/);
  assert.match(updater, /systemctl enable --now reelos-mnt-rshared/);
  assert.match(stuck, /True if host OR \*arr\/Jellyfin rslave bind is ENOTCONN/);
  assert.match(stuck, /"--make-rshared"/);
  assert.equal(read("install/systemd/reelos-mnt-rshared.service"), read("firstboot/reelos-mnt-rshared.service"));
});

test("stack: TV season import stays on sonarr dumps and twins", () => {
  const harden = read("install/bin/sonarr_manual_import.py");
  assert.equal(harden, read("daemon/sonarr_manual_import.py"));
  assert.equal(read("install/bin/stuck-downloads.py"), read("daemon/stuck-downloads.py"));
  assert.match(harden, /S01\.E01/);
  assert.match(harden, /is_foreign_media_path/);
  assert.doesNotMatch(harden, /folders = \["\/mnt\/symlinks\/sonarr", "\/mnt\/symlinks"\]/);
  const stuck = read("install/bin/stuck-downloads.py");
  assert.match(stuck, /_sonarr_manual_import/);
  assert.match(stuck, /category_folders/);
  const part = read("install/bin/wire-engines.parts/01.part");
  assert.doesNotMatch(part, /for path in \("\/mnt\/symlinks\/sonarr", "\/mnt\/symlinks"\)/);
});

test("stack: wire-engines parts compile and stay twins after #47/#49/#50", () => {
  for (const rel of ["install/bin/wire-engines.parts", "daemon/wire-engines.parts"]) {
    const code = joinParts(join(root, rel));
    const r = spawnSync("python3", ["-c", "import sys; compile(sys.stdin.read(), 'wire-engines.py', 'exec')"], {
      input: code,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, `${rel} compile\n${r.stderr}`);
    assert.match(code, /Authorization.*MediaBrowser Client="ReelOS"/);
    assert.match(code, /reveal_jellyfin_admin/);
    assert.match(code, /seed_jellyfin_network_xml/);
    assert.match(code, /wait_fuse_ready/);
    assert.match(code, /kick_imports/);
    assert.match(code, /restart_fuse_readers/);
  }
  assert.equal(joinParts(join(root, "install/bin/wire-engines.parts")), joinParts(join(root, "daemon/wire-engines.parts")));
  assert.equal(read("install/bin/reelos-update.sh"), read("daemon/reelos-update.sh"));
});
