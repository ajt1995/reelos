import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { hasVaapiDri } from "./reelos-box-scale.mjs";

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

test("hasVaapiDri is render/card, not an empty /dev/dri dir", () => {
  assert.equal(hasVaapiDri({ driPath: "/nope", exists: () => false }), false);
  assert.equal(hasVaapiDri({ driPath: "/dev/dri", exists: () => true, entries: [] }), false);
  assert.equal(hasVaapiDri({ driPath: "/dev/dri", exists: () => true, entries: ["by-path"] }), false);
  assert.equal(hasVaapiDri({ driPath: "/dev/dri", exists: () => true, entries: ["renderD128"] }), true);
  assert.equal(hasVaapiDri({ driPath: "/dev/dri", exists: () => true, entries: ["card0"] }), true);
});

test("no GPU: encoding.xml DirectPlay/DirectStream; GPU: VAAPI with low thread cap", () => {
  const code = joinParts(join(root, "daemon/wire-engines.parts"));
  assert.match(code, /def has_vaapi_dri/);
  assert.match(code, /DirectPlay\/DirectStream/);
  assert.match(code, /persist_jellyfin_encoding_xml/);
  assert.match(code, /jellyfin_playback_policy_for_box/);
  assert.match(code, /seed_jellyfin_encoding_xml/);
  assert.match(code, /EnableVideoPlaybackTranscoding/);
  const r = spawnSync(
    "python3",
    [
      "-c",
      `
import sys, tempfile
from pathlib import Path
g = {"__name__": "wire_engines"}
exec(compile(sys.stdin.read(), "wire-engines.py", "exec"), g)
leftover = g["jellyfin_encoding_for_box"](
    {"HardwareAccelerationType": "vaapi", "EnableHardwareEncoding": True, "EncodingThreadCount": -1},
    low=True,
    has_dri=False,
)
assert leftover["HardwareAccelerationType"] == "none"
assert leftover["EnableHardwareEncoding"] is False
assert leftover["AllowHevcEncoding"] is False
assert leftover["EncodingThreadCount"] == 1
gpu = g["jellyfin_encoding_for_box"]({"HardwareAccelerationType": "none"}, low=True, has_dri=True)
assert gpu["HardwareAccelerationType"] == "vaapi"
assert gpu["EnableHardwareEncoding"] is True
assert gpu["EncodingThreadCount"] == 1
gpu_hi = g["jellyfin_encoding_for_box"]({}, low=False, has_dri=True)
assert gpu_hi["HardwareAccelerationType"] == "vaapi"
assert gpu_hi["EncodingThreadCount"] == -1
pol = g["jellyfin_playback_policy_for_box"]({"EnableVideoPlaybackTranscoding": True}, has_dri=False)
assert pol["EnableVideoPlaybackTranscoding"] is False
assert pol["EnableAudioPlaybackTranscoding"] is False
assert pol["EnablePlaybackRemuxing"] is True
assert pol["ForceRemoteSourceTranscoding"] is False
gpu_pol = g["jellyfin_playback_policy_for_box"]({}, has_dri=True)
assert gpu_pol["EnableVideoPlaybackTranscoding"] is True
assert gpu_pol["EnableAudioPlaybackTranscoding"] is True
td = tempfile.mkdtemp()
xml = g["persist_jellyfin_encoding_xml"](leftover, dest=Path(td) / "encoding.xml")
text = xml.read_text()
assert "<HardwareAccelerationType>none</HardwareAccelerationType>" in text
assert "<EnableHardwareEncoding>false</EnableHardwareEncoding>" in text
empty = Path(td) / "empty-dri"
empty.mkdir()
assert g["has_vaapi_dri"](str(empty)) is False
(empty / "renderD128").touch()
assert g["has_vaapi_dri"](str(empty)) is True
print("ok")
`,
    ],
    { input: code, encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /ok/);
});

test("provision, self-heal, Settings, doctor, reset persist DirectPlay path", () => {
  const plugin = read("scripts/reelos-lookup-plugin.mjs");
  const prov = plugin.slice(plugin.indexOf("async function handleProvision"), plugin.indexOf("async function handlePing"));
  assert.match(prov, /seedJellyfinEncodingXml\(composeDir\)/);
  assert.ok(prov.indexOf("seedJellyfinEncodingXml") < prov.indexOf("docker compose up -d"));
  assert.match(plugin, /No \/dev\/dri — DirectPlay\/DirectStream only/);
  assert.doesNotMatch(plugin, /CPU encode/);
  assert.match(plugin, /mode: dri \? "vaapi" : "direct"/);
  assert.match(read("scripts/reelos-selfheal.mjs"), /--performance/);
  assert.match(read("scripts/reelos-selfheal.mjs"), /encoding DirectPlay\/VAAPI/);
  assert.doesNotMatch(read("scripts/reelos-selfheal.mjs"), /api\.torbox|torbox\.app/i);
  assert.match(read("src/components/settings-panels.tsx"), /DirectPlay\/DirectStream/);
  assert.match(read("src/components/settings-panels.tsx"), /one thread/);
  assert.match(read("src/components/settings-panels.tsx"), /does not read TorBox dumps/);
  const nine = read("daemon/wire-engines.parts/09.part");
  assert.match(nine, /seed_jellyfin_encoding_xml/);
  assert.match(nine, /def has_vaapi_dri/);
  assert.match(nine, /compose_up=False/);
  assert.match(read("daemon/reelos-doctor.py"), /No \/dev\/dri — DirectPlay\/DirectStream only/);
  assert.doesNotMatch(read("daemon/reelos-doctor.py"), /Software encode/);
  assert.match(read("daemon/reelos-reset.sh"), /encoding\.xml/);
  assert.match(read("daemon/reelos-reset.sh"), /renderD\* \/dev\/dri\/card\*/);
  assert.equal(read("install/bin/reelos-doctor.py"), read("daemon/reelos-doctor.py"));
  assert.equal(read("install/bin/reelos-reset.sh"), read("daemon/reelos-reset.sh"));
  assert.equal(read("install/bin/reelos-update.sh"), read("daemon/reelos-update.sh"));
  assert.equal(joinParts(join(root, "install/bin/wire-engines.parts")), joinParts(join(root, "daemon/wire-engines.parts")));
});
