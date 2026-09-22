import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyIndexerHealth,
  NeuralIndexerRepair,
} from "./neural-indexer-repair.mjs";

test("classifyIndexerHealth: scores healthy indexers at 1.0", () => {
  const result = classifyIndexerHealth({ latencyMs: 120, statusCode: 200 });
  assert.equal(result.status, "healthy");
  assert.equal(result.requiresRepair, false);
  assert.ok(result.score >= 0.9);
});

test("classifyIndexerHealth: flags dead or cloudflare-blocked indexers", () => {
  const dead = classifyIndexerHealth({ latencyMs: 5000, statusCode: 503, isError: true });
  assert.equal(dead.status, "dead");
  assert.equal(dead.requiresRepair, true);

  const cfBlocked = classifyIndexerHealth({ latencyMs: 300, statusCode: 403, isCloudflare: true });
  assert.equal(cfBlocked.requiresRepair, true);
});

test("NeuralIndexerRepair: auto-diagnoses and repairs failing indexer by swapping mirror", async () => {
  const indexers = [
    {
      id: "authorized-test-source",
      name: "Owner-authorized-test-source",
      displayName: "Authorized test source",
      role: "both",
      type: "search",
      mirrors: ["https://primary.example.test", "https://backup.example.test"],
      activeMirror: "https://primary.example.test",
    },
  ];
  const engine = new NeuralIndexerRepair({ indexers });

  // Mock fetch: fails primary 1337x mirror, succeeds on alternate
  const mockFetch = async (url) => {
    if (url === "https://primary.example.test") {
      return { ok: false, status: 503, headers: new Map() };
    }
    return { ok: true, status: 200, headers: new Map() };
  };

  const report = await engine.runAutoDiagnostics(mockFetch);
  assert.equal(report.total, indexers.length);
  assert.ok(report.repairedCount >= 1, "Should have repaired the owner source");

  const repaired = report.indexers.find(
    (indexer) => indexer.name === "Owner-authorized-test-source",
  );
  assert.ok(repaired.repaired, "owner source should be marked repaired");
  assert.equal(repaired.activeMirror, "https://backup.example.test");
});
