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

test("wire-engines.parts concatenate and compile (install + daemon)", () => {
  for (const rel of ["install/bin/wire-engines.parts", "daemon/wire-engines.parts"]) {
    const code = joinParts(join(root, rel));
    const r = spawnSync("python3", ["-c", "import sys; compile(sys.stdin.read(), 'wire-engines.py', 'exec')"], {
      input: code,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, `${rel} compile\n${r.stderr}`);
    assert.match(code, /MediaBrowser Client="ReelOS".*DeviceId="reelos"/);
    assert.match(code, /def jellyfin_headers/);
    assert.match(code, /Token=/);
    assert.match(code, /reveal_jellyfin_admin/);
    assert.match(code, /IsHidden/);
    assert.match(code, /restart_fuse_readers/);
    assert.match(code, /not bind-mounting \/mnt/);
    assert.match(code, /sonarr_manual_import/);
    assert.match(code, /Startup\/Configuration/);
  }
});

test("install and daemon wire-engines bodies stay twins", () => {
  const a = joinParts(join(root, "install/bin/wire-engines.parts"));
  const b = joinParts(join(root, "daemon/wire-engines.parts"));
  assert.equal(a, b);
  assert.equal(read("install/bin/wire-engines.py"), read("daemon/wire-engines.py"));
});

test("plugin AuthenticateByName sends Authorization MediaBrowser (JF 10.10+/12)", () => {
  const src = read("scripts/reelos-lookup-plugin.mjs");
  assert.match(src, /const JF_AUTH/);
  assert.match(src, /Authorization: JF_AUTH/);
  assert.match(src, /"X-Emby-Authorization": JF_AUTH/);
  assert.match(src, /revealJellyfinAdmin/);
  assert.match(src, /IsHidden: false/);
  // #46 shelf cache must survive the rebase
  assert.match(src, /jellyfinTokens\.set\(user, password, auth\)/);
  assert.match(src, /createLibraryCache/);
  assert.match(src, /serveLibrary/);
});

test("Finish /api/provision does not spawnSync compose pull on the Vite thread", () => {
  const src = read("scripts/reelos-lookup-plugin.mjs");
  assert.doesNotMatch(src, /run\(\["pull"\]/);
  assert.doesNotMatch(src, /compose", "pull"/);
  assert.match(src, /Do not spawnSync `compose pull`/);
  assert.match(src, /detached: true/);
  assert.match(src, /docker compose up -d/);
  assert.match(src, /provisioning/);
});

test("Seerr bootstrap turns preventSearch off on an existing Radarr/Sonarr", () => {
  const part = read("daemon/wire-engines.parts/09.part");
  assert.match(part, /def seerr_needs_search_enable/);
  assert.match(part, /def ensure_seerr_arr_service/);
  assert.match(part, /preventSearch": False/);
  assert.match(part, /seerr radarr search enabled/);
  assert.match(part, /seerr sonarr search enabled/);
  assert.equal(read("install/bin/wire-engines.parts/09.part"), part);
});

test("heal pulls wire-engines.parts, not only the shim", () => {
  for (const rel of ["install/bin/reelos-heal.sh", "daemon/reelos-heal.sh"]) {
    const src = read(rel);
    assert.match(src, /wire-engines\.parts\/\$i\.part/);
    assert.match(src, /relink_dumps\.py/);
    assert.match(src, /stuck-downloads\.py/);
    assert.match(src, /public_indexers\.py/);
  }
});

test("OTA hop search retries /api/lookup before fail-closing applied-sha", () => {
  for (const rel of ["install/bin/reelos-update.sh", "daemon/reelos-update.sh"]) {
    const src = read(rel);
    assert.match(src, /hop search retry/);
    assert.match(src, /seq 1 4/);
    assert.match(src, /\/api\/lookup\?q=Batman/);
    const idx = src.indexOf('step "Search"');
    const chunk = src.slice(idx, src.indexOf("if [ -f /var/lib/reelos/provisioned ]", idx));
    assert.match(chunk, /if titles:\n    print\([^\n]+\n    sys\.exit\(0\)/);
  }
});
