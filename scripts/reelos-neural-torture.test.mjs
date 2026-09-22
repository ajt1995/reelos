import test from "node:test";
import assert from "node:assert";
import { getTasteDistance, generateLatentEmbedding } from "./services/pulse-ai-service.mjs";
import { neuroCache } from "./services/neuro-cache.mjs";
import { voteCuratorTitle, resetCurator, curatorStateDir } from "./reelos-curator.mjs";

test("ReelOS Neural Torture Suite", async (t) => {
  const stateDir = ".reelos-state/torture-" + Date.now();
  
  await t.test("Pulse AI: Latent Embedding & Taste Distance Edge Cases", () => {
    const emptyVector = generateLatentEmbedding([]);
    assert.strictEqual(emptyVector.length, 32);
    assert.ok(emptyVector.every(v => v === 0));

    const distEmpty = getTasteDistance(emptyVector, emptyVector);
    assert.strictEqual(distEmpty, 1.0, "Empty vectors should default to 1.0 distance");

    const corruptedHistory = [null, undefined, "", {}, 123, NaN];
    const corruptedVector = generateLatentEmbedding(corruptedHistory);
    assert.strictEqual(corruptedVector.length, 32);
    assert.ok(!corruptedVector.some(Number.isNaN));

    const distCorrupt = getTasteDistance(corruptedVector, emptyVector);
    assert.ok(!Number.isNaN(distCorrupt));
  });

  await t.test("Neuro Cache: Episode Progression Logic", () => {
    let [ep4, ep5] = neuroCache.stageNextEpisodes("show-123", "S01E03");
    assert.strictEqual(ep4, "show-123-S01E04");
    assert.strictEqual(ep5, "show-123-S01E05");

    [ep4, ep5] = neuroCache.stageNextEpisodes("show-123", 3);
    assert.strictEqual(ep4, "show-123-E4");
    assert.strictEqual(ep5, "show-123-E5");

    [ep4, ep5] = neuroCache.stageNextEpisodes("show-invalid", "wtf");
    assert.strictEqual(ep4, "show-invalid-E1"); // fallback is 0 + 1
  });

  await t.test("Neuro Cache: Pinning & Eviction", () => {
    neuroCache.recordWatch("user-1", "kids-movie-1", true);
    neuroCache.recordWatch("user-2", "kids-movie-1", true);
    neuroCache.recordWatch("user-3", "kids-movie-1", true);
    assert.ok(neuroCache.pinned.has("kids-movie-1"), "Kids media should auto-pin after 3 views");
  });

  await t.test("Curator: Torture & Concurrency Simulator", async () => {
    resetCurator(stateDir);

    // Simulate 1000 events
    for (let i = 0; i < 1000; i++) {
      if (i % 2 === 0) {
        voteCuratorTitle(`title-${i}`, "like", stateDir);
      } else if (i % 3 === 0) {
        voteCuratorTitle(`title-${i}`, "dislike", stateDir);
      } else {
        voteCuratorTitle({ id: `title-${i}` }, "none", stateDir);
      }
    }
    
    // Corrupted votes
    voteCuratorTitle("", "like", stateDir);
    voteCuratorTitle(null, "dislike", stateDir);
  });

  await t.test("Memory Stability Check", () => {
    const memStart = process.memoryUsage().heapUsed;
    
    // Allocate some work
    for (let i = 0; i < 10000; i++) {
      const v = generateLatentEmbedding([`event-${i}`]);
      getTasteDistance(v, v);
    }

    const memEnd = process.memoryUsage().heapUsed;
    const deltaMb = (memEnd - memStart) / 1024 / 1024;
    
    assert.ok(deltaMb < 15, `Memory heap delta too high: ${deltaMb.toFixed(2)} MB`);
  });

  await t.test("Neural Engine: Concurrency and NaN Handling", async () => {
    const { neuralEngine } = await import("./services/neural-engine.mjs");
    for (let i = 0; i < 1000; i++) {
      neuralEngine.train(NaN, 0, 0);
    }
    assert.ok(!Number.isNaN(neuralEngine.weights[0]));
  });
});
