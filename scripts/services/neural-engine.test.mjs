import test from "node:test";
import assert from "node:assert";
import { NeuralEngine } from "./neural-engine.mjs";

test("NeuralEngine footprint and SGD", () => {
  const engine = new NeuralEngine();
  assert.ok(engine.weights instanceof Float32Array);
  engine.train(0.9, 0, 0);
  assert.ok(engine.weights[0] > 0);
});
