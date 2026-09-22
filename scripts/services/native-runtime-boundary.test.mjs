import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const boxPath = path.resolve(import.meta.dirname, "..", "reelos-box.mjs");

test("the shipping appliance starts one local intelligence system, not retired parallel brains", () => {
  const source = fs.readFileSync(boxPath, "utf8");

  assert.match(source, /getReelIntelligenceSystem/);
  assert.doesNotMatch(source, /import\("\.\/services\/fleet-learning-service\.mjs"\)/);
  assert.doesNotMatch(source, /import\("\.\/services\/anonymous-gossip-service\.mjs"\)/);
  assert.doesNotMatch(source, /import\("\.\/services\/cinema-brain-loader\.mjs"\)/);
  assert.doesNotMatch(source, /import\("\.\/services\/basement-lighthouse-service\.mjs"\)/);
  assert.doesNotMatch(source, /import\("\.\/services\/neural-scale-engine\.mjs"\)/);
});

test("Jellyfin is started only as the compatibility shim", () => {
  const source = fs.readFileSync(boxPath, "utf8");

  assert.match(source, /startJellyfinShimServer/);
  assert.doesNotMatch(source, /import\("\.\/services\/jellyfin-service\.mjs"\)/);
  assert.doesNotMatch(source, /import\("\.\/services\/gemini-service\.mjs"\)/);
});

test("taste calibration does not activate retired brains or a cloud model", async () => {
  const taste = fs.readFileSync(path.join(import.meta.dirname, "neural-taste-bubbles-service.mjs"), "utf8");
  assert.doesNotMatch(taste, /cinema-brain-loader|neural-scale-engine|gemini-service/i);
  assert.match(taste, /projectTasteFeatures/);
});

test("the fallback router cannot load retired managed-server or scale services", () => {
  const fallback = fs.readFileSync(path.join(import.meta.dirname, "..", "reelos-lookup-plugin.mjs"), "utf8");
  assert.doesNotMatch(fallback, /from "\.\/services\/jellyfin-service\.mjs"/);
  assert.doesNotMatch(fallback, /import\("\.\/services\/neural-scale-engine\.mjs"\)/);
});
