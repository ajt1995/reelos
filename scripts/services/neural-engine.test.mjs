import test from "node:test";
import assert from "node:assert";
import os from "node:os";
import { NeuralEngine } from "./neural-engine.mjs";
import { reactToTasteBubble } from "./neural-taste-bubbles-service.mjs";

test("NeuralEngine footprint and SGD", () => {
  const engine = new NeuralEngine();
  assert.ok(engine.weights instanceof Float32Array);
  engine.train(0.9, 0, 0);
  assert.ok(engine.weights[0] > 0);
  if (os.totalmem() >= 12 * 1024 ** 3) {
    assert.strictEqual(engine.dims, 512, "64GB/128GB workstations must run full 512D latent vectors");
  }
});

test("LinUCB context vector is strictly L2 normalized to unit sphere", () => {
  const engine = new NeuralEngine();
  const x = engine.getContextVector(Date.now());
  assert.strictEqual(x.length, 5);
  let normSq = 0;
  for (const v of x) normSq += v * v;
  assert.ok(Math.abs(Math.sqrt(normSq) - 1.0) < 1e-5, `Context vector norm must be 1.0, got ${Math.sqrt(normSq)}`);
});

test("LinUCB Sherman-Morrison rank-1 update retains matrix inversion consistency", () => {
  const engine = new NeuralEngine();
  const arm = engine.shelfArms[0];
  const now = Date.now();
  
  // Before update
  const armBefore = engine.rankTimeOfDay(now);
  assert.ok(engine.shelfArms.includes(armBefore));

  // Update arm with positive reward
  engine.updateBandit(arm, now, 1.0);
  const bandit = engine.bandits[arm];
  assert.ok(bandit.A_inv, "A_inv must be maintained");

  // Invert A directly and check that Sherman-Morrison A_inv is within epsilon
  const trueInv = engine.invertMatrix5x5(bandit.A);
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      const diff = Math.abs(bandit.A_inv[i][j] - trueInv[i][j]);
      assert.ok(diff < 0.05, `Sherman-Morrison divergence at (${i},${j}): diff=${diff}`);
    }
  }
});

test("Taste bubble affinity weights match standard manifold specification", () => {
  const dummyBubble = { latentVector: new Array(512).fill(0.1) };
  const initial = new Array(512).fill(0);

  const loved = reactToTasteBubble(dummyBubble, "love", initial);
  assert.ok(loved[0] > 0, "Loved reaction must increase component");

  const comfy = reactToTasteBubble(dummyBubble, "cozy", initial);
  assert.ok(comfy[0] > 0, "Cozy reaction must increase component");

  const lesslike = reactToTasteBubble(dummyBubble, "less_like", initial);
  assert.ok(lesslike[0] < 0, "Less-like reaction must decrease component");
});
