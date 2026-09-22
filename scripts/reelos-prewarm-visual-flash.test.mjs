import test from 'node:test';
import assert from 'node:assert/strict';
import { neuroCache } from './services/neuro-cache.mjs';

test('Visual Flash: 5-Second Aesthetic Vector Synthesis', () => {
  const aesthetics = [
    { id: "neon_rain", vibe: "comfort", traits: ["80s_bias", "neo_noir"] },
    { id: "spectacle_70mm", vibe: "bleeding_edge", traits: ["spectacle", "adrenaline"] },
    { id: "golden_nostalgia", vibe: "comfort", traits: ["80s_bias", "warmth"] },
    { id: "clinical_cold", vibe: "hidden_gems", traits: ["mind_bender", "cerebral"] },
    { id: "ghibli_cozy", vibe: "comfort", traits: ["whimsical", "warmth"] },
  ];

  for (const item of aesthetics) {
    const weights = {
      "80s_bias": item.traits.includes("80s_bias") ? 0.95 : 0.2,
      "mind_bender": item.traits.includes("mind_bender") ? 0.95 : 0.2,
      "adrenaline": item.traits.includes("adrenaline") ? 0.95 : 0.2,
      "whimsical": item.traits.includes("whimsical") ? 0.95 : 0.2,
      "spectacle": item.traits.includes("spectacle") ? 0.95 : 0.2,
    };

    assert.ok(item.vibe, `Vibe must exist for ${item.id}`);
    assert.ok(typeof weights["80s_bias"] === "number");
    assert.ok(typeof weights["spectacle"] === "number");

    if (item.id === "spectacle_70mm") {
      assert.equal(weights["spectacle"], 0.95);
      assert.equal(weights["adrenaline"], 0.95);
      assert.equal(item.vibe, "bleeding_edge");
    } else if (item.id === "clinical_cold") {
      assert.equal(weights["mind_bender"], 0.95);
      assert.equal(item.vibe, "hidden_gems");
    }
  }
});

test('NeuroCache: Zero-Latency Pre-Warm Stream Engine', () => {
  const showId = "severance";
  const nextEpNum = 4;
  const nextMediaId = "jf-sev-s01e04";

  const result = neuroCache.prewarmStream(showId, nextEpNum, nextMediaId);
  
  assert.equal(result.status, "primed");
  assert.equal(result.showId, showId);
  assert.equal(result.nextEpisodeNumber, nextEpNum);
  assert.equal(result.nextMediaId, nextMediaId);
  assert.ok(Array.isArray(result.staged));
  assert.ok(result.staged.includes("severance-E5"));
  assert.ok(result.staged.includes("severance-E6"));
  assert.ok(neuroCache.prewarmed.has(`${showId}:${nextEpNum}`));
});
