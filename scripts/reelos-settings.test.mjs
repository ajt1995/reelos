import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "scripts/reelos-lookup-plugin.mjs"), "utf8");

test("Settings autoUpdate write is best-effort and does not 500 the JSON", () => {
  assert.match(src, /function writeSystemdFile/);
  assert.match(src, /sudo.*-n.*tee/);
  const idx = src.indexOf("async function handleSettings");
  const chunk = src.slice(idx, src.indexOf("async function handlePorts", idx));
  assert.match(chunk, /writeFileSync\(uiSettingsPath/);
  assert.match(chunk, /try \{\s*if \("autoUpdate" in body\)/);
  assert.ok(
    chunk.indexOf("writeFileSync(uiSettingsPath") < chunk.indexOf('if ("autoUpdate" in body)'),
    "persist ui-settings.json before touching systemd",
  );
});

test("Check can target the beta channel stub", () => {
  assert.match(src, /channel-beta\.json/);
  assert.match(src, /betaChannel === true/);
  assert.match(src, /betaChannelStub/);
  assert.match(src, /channel: "beta"/);
  assert.match(src, /CHANNEL_BETA_URL/);
  assert.match(src, /ajt1995\/reelos\/main\/channel-beta\.json/);
});

test("jellyfinState does not call a timed-out VirtualFolders empty list Missing library", () => {
  const idx = src.indexOf("async function jellyfinState");
  assert.ok(idx >= 0);
  const chunk = src.slice(idx, src.indexOf("function saveAuthUrl", idx));
  assert.match(chunk, /AbortSignal\.timeout\(1500\)/);
  assert.match(chunk, /api_key=/);
  assert.match(chunk, /Cannot read virtual folders/);
  assert.match(chunk, /Missing library/);
  assert.ok(
    chunk.indexOf("Cannot read virtual folders") < chunk.indexOf("Missing library"),
    "read failure is not reported as missing libraries",
  );
});
