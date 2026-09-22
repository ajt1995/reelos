import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const world = readFileSync(
  new URL("../experience/reelos-world.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("Android TV keeps the personal atmosphere without continuously repainting a blurred viewport", () => {
  assert.match(world, /<ProfileAura lightweight=\{tvPlatform\}/);
  assert.match(world, /filter: "none", opacity: 0\.28/);
  assert.match(world, /data-platform=\{platform\}/);
  assert.match(world, /data-motion=\{profile\.motion\}/);
  assert.match(world, /data-transparency=\{tvPlatform \|\| profile\.transparency === false \? "solid" : "glass"\}/);
  assert.match(world, /tvPlatform \? "reelos-tv-living-art" : ""/);
  assert.match(styles, /\.reelos-tv-living-art\s*\{[^}]*will-change: transform;[^}]*animation: reelos-tv-living-art/s);
  assert.match(styles, /@keyframes reelos-tv-living-art/);
});

test("TV shelves use a stable six-column focus layout", () => {
  assert.match(world, /tvPlatform\s*\? "grid grid-cols-6 overflow-visible"/);
  assert.match(world, /tvPlatform\s*\? "w-auto max-w-none"/);
  assert.match(world, /contentVisibility: "auto", containIntrinsicSize: "auto 420px"/);
});

test("search does not summon the software keyboard when opened by a TV remote", () => {
  assert.match(world, /if \(tvPlatform\) closeRef\.current\?\.focus\(\)/);
  assert.match(world, /results\.slice\(0, tvPlatform \? 12 : 24\)/);
});

test("artwork decoding does not block the interface thread", () => {
  const asyncDecodeCount = world.match(/decoding="async"/g)?.length ?? 0;
  assert.ok(asyncDecodeCount >= 5, `expected async decoding on primary artwork, found ${asyncDecodeCount}`);
});

test("companion polling pauses offscreen and never uses a free-running interval", () => {
  const companion = world.slice(world.indexOf("function CompanionWorld"), world.indexOf("function PartyWorld"));
  assert.match(companion, /document\.visibilityState === "hidden"/);
  assert.match(companion, /window\.setTimeout\(poll, 5_000\)/);
  assert.doesNotMatch(companion, /setInterval/);
});
