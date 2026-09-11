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

test("stack: compose uses Docker embedded DNS (no per-container 1.1.1.1) and OTA does not stamp heal red", () => {
  const compose = read("compose/docker-compose.yml");
  const installCompose = read("install/compose/docker-compose.yml");
  const dnsHosts = read("daemon/wire-engines.parts/03.part");
  assert.match(compose, /Do not set dns: 1\.1\.1\.1/);
  assert.doesNotMatch(compose, /^\s+dns:\s*$/m);
  assert.doesNotMatch(compose, /^\s+- 1\.1\.1\.1\s*$/m);
  assert.doesNotMatch(installCompose, /^\s+- 1\.1\.1\.1\s*$/m);
  assert.doesNotMatch(compose, /127\.0\.0\.11/);
  assert.match(dnsHosts, /stripped compose dns/);
  assert.doesNotMatch(dnsHosts, /DNS_HOSTS = """    dns:\n      - 1\.1\.1\.1/);
  assert.doesNotMatch(dnsHosts, /127\.0\.0\.11/);
  const updater = read("daemon/reelos-update.sh");
  assert.match(updater, /HostConfig.Dns=1\.1\.1\.1 — recreate/);
  const heal = updater.indexOf('if [ "${HEAL_FAIL:-0}" = "1" ]; then');
  const stampOk = updater.indexOf("STAMP_OK=1");
  const stamp = updater.indexOf('echo "$REMOTE" >"$ROOT/VERSION"');
  const applied = updater.indexOf('log "ReelOS $REMOTE applied."');
  const door = updater.indexOf("if ! ensure_door");
  assert.ok(heal > 0 && stamp > heal && applied > stamp);
  assert.ok(door > heal && door < stamp);
  assert.ok(stampOk > 0 && stampOk < door);
  assert.equal(updater.slice(stampOk, door).includes("exit 1"), false);
  assert.match(updater, /not printing applied — jellyfin\/indexer heal red/);
  assert.match(updater, /door restored — still not stamping/);
  assert.match(updater, /restart hung reelos/);
  assert.equal(read("install/bin/reelos-update.sh"), updater);
  assert.equal(read("install/bin/public_indexers.py"), read("daemon/public_indexers.py"));
  assert.equal(read("install/bin/wire-engines.parts/09.part"), read("daemon/wire-engines.parts/09.part"));
  assert.equal(read("install/bin/wire-engines.parts/02.part"), read("daemon/wire-engines.parts/02.part"));
  assert.equal(read("install/bin/wire-engines.parts/03.part"), read("daemon/wire-engines.parts/03.part"));
});

test("stack: VERSION / channel / stamps agree (1.2.50.35)", () => {
  const ver = read("VERSION").trim();
  const chan = JSON.parse(read("channel.json"));
  const beta = JSON.parse(read("channel-beta.json"));
  const stamp = read("src/lib/version-stamp.ts");
  const store = read("src/lib/store.ts");
  assert.equal(ver, "1.2.50.35");
  assert.equal(chan.version, "1.2.50.35");
  assert.equal(chan.channel, "stable");
  assert.equal(beta.channel, "beta");
  assert.match(beta.notes[0], /Arena chrome and Books/);
  assert.match(stamp, /SHIPPED_VERSION = "1\.2\.50\.35"/);
  assert.match(stamp, /LATEST_VERSION = "1\.2\.50\.35"/);
  assert.match(store, /SHIPPED_VERSION = "1\.2\.50\.35"/);
  assert.match(store, /LATEST_VERSION = "1\.2\.50\.35"/);
  assert.match(read("STATUS.md"), /1\.2\.50\.35/);
  assert.match(read("STATUS.md"), /1\.2\.50\.34/);
  assert.match(read("src/components/settings-updates.tsx"), /This install/);
  assert.match(read("src/components/settings-updates.tsx"), /This update/);
  assert.match(read("src/components/settings-updates.tsx"), /Beta channel/);
  assert.match(read("scripts/reelos-lookup-plugin.mjs"), /pendingNotes: notes/);
  assert.match(read("scripts/reelos-lookup-plugin.mjs"), /currentNotes: notesForVersion/);
  assert.match(read("scripts/reelos-lookup-plugin.mjs"), /channel-beta\.json/);
  assert.match(read("scripts/reelos-lookup-plugin.mjs"), /CHANNEL_BETA_URL/);
  assert.match(read("src/components/requests-view.tsx"), /inFlightRequests\(requests, \{ titles: shelf \}\)/);
  assert.match(read("src/components/remove-from-box.tsx"), /Remove from this box/);
  assert.match(read("scripts/reelos-library-remove.mjs"), /deleteFilesAllowed/);
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
  assert.match(src, /function jellyfinAuthedHeaders/);
  assert.match(src, /jellyfinAuthedHeaders\(auth\.token\)/);
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
  assert.match(updater, /--exclude 'decypharr\/cache\/'/);
  assert.match(updater, /\*\*\/cache\/dfs\//);
  assert.doesNotMatch(updater, /cp -a "\$ROOT\/compose\/configs\/\."/);
  assert.match(updater, /not 200 after 15s/);
  assert.match(updater, /mv "\$ROOT\/app" "\$ROOT\/app\.broken"/);
  assert.match(updater, /need src\/components\/title-view-live\.tsx '\/api\/request'/);
  assert.match(updater, /need src\/components\/settings-terminal\.tsx 'title="Terminal"'/);
  assert.match(updater, /need scripts\/reelos-lookup-plugin\.mjs 'serveLibrary'/);
  assert.match(updater, /not printing applied — jellyfin\/indexer heal red/);
  assert.match(updater, /HEAL_FAIL=1/);
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
  assert.match(stuck, /recover_missing_series/);
  assert.match(stuck, /recover_missing_movies/);
  assert.match(stuck, /MoviesSearch/);
  const part = read("install/bin/wire-engines.parts/01.part");
  assert.doesNotMatch(part, /for path in \("\/mnt\/symlinks\/sonarr", "\/mnt\/symlinks"\)/);
  assert.match(part, /relink_dumps/);
  assert.match(part, /return heal_after_import\(\)/);
  assert.equal(read("install/bin/relink_dumps.py"), read("daemon/relink_dumps.py"));
  assert.match(read("install/bin/relink_dumps.py"), /relink created/);
});

test("stack: firstboot loop guards (provisioned latch, no self-cp, mailman does not enable)", () => {
  const install = read("install/reelos-install.sh");
  const updater = read("daemon/reelos-update.sh");
  const plugin = read("scripts/reelos-lookup-plugin.mjs");
  const unit = read("install/systemd/reelos-firstboot.service");
  assert.equal(install, read("daemon/install.sh"));
  assert.equal(unit, read("firstboot/reelos-firstboot.service"));
  assert.match(unit, /ConditionPathExists=!\/var\/lib\/reelos\/stack-installed/);
  assert.match(unit, /Restart=on-failure/);
  assert.match(install, /Already provisioned — stamped stack-installed/);
  assert.match(install, /not enabling firstboot/);
  const binCp = install.indexOf('cp -a "$HERE/bin/."');
  const guard = install.lastIndexOf('if [ "$HERE" != "$ROOT" ]', binCp);
  assert.ok(binCp > 0 && guard >= 0 && guard < binCp, "bin copy must sit inside HERE != ROOT");
  assert.match(install, /if \[ -f "\$HERE\/VERSION" \] && \[ "\$HERE" != "\$ROOT" \]/);
  const enableIdx = install.indexOf("enable_unit reelos-firstboot");
  const gate = install.lastIndexOf('if [ ! -f "$STATE/provisioned" ]', enableIdx);
  assert.ok(enableIdx > 0 && gate >= 0 && gate < enableIdx);
  assert.match(updater, /stack-installed latched \(provisioned box — firstboot stays a no-op\)/);
  assert.match(updater, /Do not systemctl-enable the firstboot unit/);
  assert.match(updater, /cp "\$WORK\/src\/install\/reelos-install\.sh" "\$ROOT\/install\.sh"/);
  assert.equal(updater.includes("enable reelos-firstboot"), false);
  assert.equal(updater.includes("enable --now reelos-firstboot"), false);
  assert.match(plugin, /function latchStackInstalled/);
  assert.match(plugin, /printf '1\\\\n' > \/var\/lib\/reelos\/stack-installed/);
  assert.match(read("src/lib/provision-appliance.ts"), /stack-installed/);
});

test("stack: wire-engines parts compile and stay twins after #47/#49/#50", () => {
  for (const rel of ["install/bin/wire-engines.parts", "daemon/wire-engines.parts"]) {
    const code = joinParts(join(root, rel));
    const r = spawnSync("python3", ["-c", "import sys; compile(sys.stdin.read(), 'wire-engines.py', 'exec')"], {
      input: code,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, `${rel} compile\n${r.stderr}`);
    assert.match(code, /MediaBrowser Client="ReelOS"/);
    assert.match(code, /def jellyfin_headers/);
    assert.match(code, /Token=/);
    assert.match(code, /reveal_jellyfin_admin/);
    assert.match(code, /seed_jellyfin_network_xml/);
    assert.match(code, /wait_fuse_ready/);
    assert.match(code, /def fuse_clear_stale/);
    assert.match(code, /os.listdir\("\/mnt\/debrid\/__all__"\)/);
    assert.match(code, /kick_imports/);
    assert.match(code, /heal_after_import/);
    assert.match(code, /collapse_movie_named_dumps/);
    assert.match(code, /heal_movie_dump_items/);
    assert.match(code, /collapse_dumps=False/);
    assert.match(code, /restart_fuse_readers/);
  }
  assert.equal(joinParts(join(root, "install/bin/wire-engines.parts")), joinParts(join(root, "daemon/wire-engines.parts")));
  assert.equal(read("install/bin/reelos-update.sh"), read("daemon/reelos-update.sh"));
});

test("stack: self-heal, Settings Advanced, start:box, beta stub", () => {
  const heal = read("daemon/reelos-selfheal.sh");
  assert.equal(heal, read("install/bin/reelos-selfheal.sh"));
  assert.match(heal, /not walking FUSE/);
  assert.match(heal, /not enabling firstboot/);
  assert.match(heal, /not talking to TorBox/);
  assert.match(heal, /ensure_door/);
  assert.match(heal, /docker compose up -d --no-recreate/);
  assert.equal(heal.includes("enable reelos-firstboot"), false);
  assert.equal(heal.includes("/mnt/debrid/__all__"), false);
  assert.doesNotMatch(heal, /api\.torbox|torbox\.app/i);
  const updater = read("daemon/reelos-update.sh");
  assert.match(updater, /reelos-selfheal\.timer/);
  assert.match(updater, /enable --now reelos-selfheal.timer/);
  assert.equal(updater.includes("enable reelos-firstboot"), false);
  assert.equal(
    read("install/systemd/reelos-selfheal.timer"),
    read("firstboot/reelos-selfheal.timer"),
  );
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["start:box"], "node scripts/with-app-env.mjs node scripts/reelos-box.mjs");
  const box = read("scripts/reelos-box.mjs");
  assert.match(box, /findClientRoot/);
  assert.match(box, /findPreviewBuild/);
  assert.match(box, /dispatchReelOsApi/);
  assert.match(box, /serving built UI/);
  assert.match(box, /production preview/);
  assert.match(box, /vite preview/);
  assert.match(updater, /vite build for production door/);
  assert.match(updater, /vite build skipped — 4GB box/);
  assert.match(updater, /package-lock.json unchanged — reused node_modules/);
  assert.match(heal, /ffprobe D-state/);
  assert.match(read("scripts/reelos-lookup-plugin.mjs"), /configurePreviewServer/);
  assert.match(read("scripts/reelos-request-progress-plugin.mjs"), /configurePreviewServer/);
  const view = read("src/components/settings-view.tsx");
  const settingsBody = view.slice(view.indexOf("export function SettingsView"));
  assert.match(view, /Show Advanced/);
  assert.match(view, /FixSection/);
  assert.ok(settingsBody.indexOf("Show Advanced") < settingsBody.indexOf("<FixSection"));
  assert.match(read("src/components/settings-updates.tsx"), /Beta channel/);
  assert.match(read("src/lib/store.ts"), /betaChannel: false/);
});
