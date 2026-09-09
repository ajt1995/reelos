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

test("compose jellyfin network.xml defaults publish URI by request", () => {
  for (const rel of [
    "compose/configs/jellyfin/config/network.xml",
    "install/compose/configs/jellyfin/config/network.xml",
  ]) {
    const xml = read(rel);
    assert.match(xml, /<EnablePublishedServerUriByRequest>\s*true\s*</);
    assert.match(xml, /<EnableRemoteAccess>\s*true\s*</);
    assert.doesNotMatch(xml, /172\.18\./);
  }
});

test("wire-engines.parts concatenate and compile (install + daemon)", () => {
  for (const rel of ["install/bin/wire-engines.parts", "daemon/wire-engines.parts"]) {
    const code = joinParts(join(root, rel));
    const r = spawnSync("python3", ["-c", "import sys; compile(sys.stdin.read(), 'wire-engines.py', 'exec')"], {
      input: code,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, `${rel} compile\n${r.stderr}`);
    assert.match(code, /Authorization.*MediaBrowser Client="ReelOS".*DeviceId="reelos"/);
    assert.match(code, /reveal_jellyfin_admin/);
    assert.match(code, /IsHidden/);
    assert.match(code, /seed_jellyfin_network_xml/);
    assert.match(code, /EnablePublishedServerUriByRequest/);
    assert.match(code, /apply_jellyfin_published_uri/);
    assert.match(code, /jellyfin_want_libraries/);
    assert.match(code, /extra_jellyfin_paths/);
    assert.match(code, /remove_jellyfin_path/);
    assert.match(code, /jellyfin drop extra path/);
    assert.match(code, /wizard_completed/);
    assert.match(code, /Startup\/Configuration/);
  }
});

test("Movies/Shows keep only /symlinks/radarr|sonarr — extra paths are dropped", () => {
  const code = joinParts(join(root, "daemon/wire-engines.parts"));
  const r = spawnSync(
    "python3",
    [
      "-c",
      `
import sys
g = {"__name__": "wire_engines"}
exec(compile(sys.stdin.read(), "wire-engines.py", "exec"), g)
folder = {
    "Name": "Movies",
    "Locations": ["/symlinks", "/symlinks/radarr", "/mnt/symlinks/radarr", "/media/movies"],
    "LibraryOptions": {"PathInfos": []},
}
keep = g["library_symlink_path"]("Movies")
assert keep == "/symlinks/radarr", keep
extras = g["extra_jellyfin_paths"](folder, keep)
assert "/media/movies" in extras, extras
assert "/symlinks" in extras, extras
assert "/mnt/symlinks/radarr" in extras, extras
assert "/symlinks/radarr" not in extras, extras
assert g["libraries_ready"]([folder], [("Movies", "movies")]) is False
ready = {
    "Name": "Movies",
    "Locations": ["/symlinks/radarr"],
    "LibraryOptions": {"PathInfos": [{"Path": "/symlinks/radarr"}]},
}
assert g["libraries_ready"]([ready], [("Movies", "movies")]) is True
shows = {
    "Name": "Shows",
    "Locations": ["/symlinks", "/symlinks/sonarr"],
    "LibraryOptions": {"PathInfos": []},
}
assert "/symlinks" in g["extra_jellyfin_paths"](shows, "/symlinks/sonarr")
print("ok")
`,
    ],
    { input: code, encoding: "utf8" },
  );
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /ok/);
  const hop = read("daemon/wire-engines.parts/09.part");
  assert.match(hop, /ensure_jellyfin_libraries/);
  assert.match(hop, /jellyfin libraries one dump path each/);
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
  assert.match(src, /seedJellyfinNetworkXml/);
  assert.match(src, /EnablePublishedServerUriByRequest/);
});

test("Finish /api/provision seeds jellyfin network.xml before detached compose up", () => {
  const src = read("scripts/reelos-lookup-plugin.mjs");
  const idx = src.indexOf("async function handleProvision");
  assert.ok(idx >= 0);
  const chunk = src.slice(idx, src.indexOf("async function handlePing", idx));
  assert.match(chunk, /seedJellyfinNetworkXml\(composeDir\)/);
  assert.match(chunk, /Do not spawnSync `compose pull`/);
  assert.match(chunk, /docker compose up -d/);
  assert.match(chunk, /detached: true/);
  assert.doesNotMatch(chunk, /run\(\["pull"\]/);
  assert.ok(chunk.indexOf("seedJellyfinNetworkXml") < chunk.indexOf("docker compose up -d"));
});

test("/api/box requires Movies/Shows unless intent turns them off", () => {
  const src = read("scripts/reelos-lookup-plugin.mjs");
  const idx = src.indexOf("async function jellyfinState");
  const chunk = src.slice(idx, src.indexOf("function saveAuthUrl", idx));
  assert.match(chunk, /intent\.movies !== false/);
  assert.match(chunk, /intent\.tv !== false/);
  assert.match(chunk, /no matching user\/PIN/);
});

test("soft-reset re-seeds jellyfin network.xml", () => {
  for (const rel of ["install/bin/reelos-reset.sh", "daemon/reelos-reset.sh"]) {
    const src = read(rel);
    assert.match(src, /EnablePublishedServerUriByRequest>true/);
    assert.match(src, /configs\/jellyfin\/config\/network\.xml/);
    assert.match(src, /jellyfin network\.xml re-seeded/);
  }
});

test("auth-mismatch reset waits for first-run then completes startup", () => {
  const code = joinParts(join(root, "daemon/wire-engines.parts"));
  assert.match(code, /seed_jellyfin_network_xml\(\)/);
  assert.match(code, /wait_jellyfin\(90, wizard_completed=False\)/);
  assert.match(code, /apply_jellyfin_published_uri\(token\)/);
  const reset = code.slice(code.indexOf("def reset_jellyfin_config"), code.indexOf("def wait_jellyfin"));
  assert.ok(reset.indexOf("seed_jellyfin_network_xml") < reset.indexOf('compose("up"'));
});
