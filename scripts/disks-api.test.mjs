import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("handleDisks in reelos-lookup-plugin.mjs returns rotational, powerState, isStandby, and storageMode", () => {
  const plugin = read("scripts/reelos-lookup-plugin.mjs");
  assert.match(plugin, /async function handleDisks/);
  assert.match(plugin, /rotational/);
  assert.match(plugin, /powerState/);
  assert.match(plugin, /isStandby/);
  assert.match(plugin, /spindownMode/);
  assert.match(plugin, /hdparm.*-C/);
  assert.match(plugin, /storageMode/);
});

test("DisksPanel and DisksRow are exported and integrated into Settings view", () => {
  const panels = read("src/components/settings-panels.tsx");
  assert.match(panels, /export function DisksPanel/);
  assert.match(panels, /export function DisksRow/);
  assert.match(panels, /Standby \(Spun Down\)/);
  assert.match(panels, /Active \(Spinning\)/);
  assert.match(panels, /APM 127/);

  const view = read("src/components/settings-view.tsx");
  assert.match(view, /import.*DisksRow.*from\s+["']@\/components\/settings-panels["']/);
  assert.match(view, /<DisksRow/);
});

test("PerformanceRow exposes auto-tuned GPU badge", () => {
  const panels = read("src/components/settings-panels.tsx");
  assert.match(panels, /Intel QuickSync \(QSV\)/);
  assert.match(panels, /NVIDIA NVENC/);
  assert.match(panels, /VAAPI Hardware Transcode/);
  assert.match(panels, /DirectPlay CPU Lock \(Potato Mode\)/);
});
