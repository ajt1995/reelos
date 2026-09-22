import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function component(name: string) {
  return readFileSync(new URL(`../components/${name}`, import.meta.url), "utf8");
}

function route(name: string) {
  return readFileSync(new URL(`../routes/${name}`, import.meta.url), "utf8");
}

function experience(name: string) {
  return readFileSync(new URL(`../experience/${name}`, import.meta.url), "utf8");
}

test("request progress uses consumer source and readiness language", () => {
  const source = component("requests-view.tsx");

  for (const retiredCopy of [
    "Searching Indexers",
    "Torznab Search",
    "Indexer Swarm",
    "Virtual FUSE",
    "Jellyfin Library",
    "Imported into local Jellyfin",
  ]) {
    assert.doesNotMatch(source, new RegExp(retiredCopy, "i"));
  }

  assert.match(source, /Looking for a playable source/);
  assert.match(source, /ReelOS verified this copy and it is ready to play/);
});

test("consumer capability copy does not hard-code autonomous success", () => {
  const source = [
    component("cinema-intelligence-card.tsx"),
    component("connect-view.tsx"),
    component("sovereign-onboarding-wizard.tsx"),
    component("support-diagnostics-view.tsx"),
  ].join("\n");

  for (const unsupportedClaim of [
    "Dual-Brain Active",
    "Autonomous (Zero Toggles)",
    "Hardware Offloading Guarantee",
    "Instant 4K Direct Play",
    "In-RAM Streaming Engine",
    "Autonomous recovery tool",
  ]) {
    assert.doesNotMatch(source, new RegExp(unsupportedClaim.replace(/[()]/g, "\\$&"), "i"));
  }

  assert.match(source, /Availability shown below/);
  assert.match(source, /Not reported by this player/);
  assert.match(source, /Compatibility checked per title/);
});

test("Jellyfin is described only as optional client compatibility in setup copy", () => {
  const source = component("wizard.tsx");

  assert.doesNotMatch(source, /ReelOS is not a player/);
  assert.doesNotMatch(source, /Jellyfin is the working path/);
  assert.match(source, /Jellyfin-compatible apps/);
  assert.match(source, /ReelOS plays in the browser/);
});

test("post-Day-0 ambiance cannot look enabled or simulated", () => {
  const ambianceRoute = route("ambiance.tsx");
  const laterRelease = component("later-release-view.tsx");
  const world = experience("reelos-world.tsx");

  assert.match(ambianceRoute, /not available yet/i);
  assert.match(laterRelease, /Nothing has been applied or simulated/i);
  assert.match(laterRelease, /to="\/settings\/advanced"/);
  assert.doesNotMatch(world, /id: "ambiance"[\s\S]{0,120}title: "Ambiance"/);
});

test("Day-0 storage safety controls are open when Settings first loads", () => {
  const world = experience("reelos-world.tsx");
  assert.match(world, /useState\(initialGroup \|\| "library"\)/);
  assert.match(world, /<StorageSettings \/>/);
});

test("Settings does not present preview state as service success", () => {
  const world = experience("reelos-world.tsx");
  assert.doesNotMatch(world, /Interface preview is healthy/i);
  assert.doesNotMatch(world, /connected in this preview/i);
  assert.doesNotMatch(world, /Real-Debrid is validating locally/i);
  assert.match(world, /reports a feature as working only after this home confirms/i);
});

test("retired engineering screens redirect into the consumer experience", () => {
  assert.match(route("dev.tsx"), /to: "\/settings\/advanced"/);
  assert.match(route("engine.$id.tsx"), /to: "\/settings\/advanced"/);
  assert.match(route("guide.tsx"), /to: "\/settings"/);
  assert.doesNotMatch(route("dev.tsx"), /DeveloperCockpitView/);
  assert.doesNotMatch(route("engine.$id.tsx"), /EngineView/);
  assert.doesNotMatch(route("guide.tsx"), /ApplianceGuideView/);
});

test("consumer links never guess a developer household address", () => {
  const source = [component("connect-view.tsx"), component("flickmatch-view.tsx")].join("\n");
  assert.doesNotMatch(source, /192\.168\.1\.(?:214|234)/);
  assert.match(source, /tailscaleDns/);
  assert.match(source, /window\.location\.origin|window\.location\.protocol/);
});
