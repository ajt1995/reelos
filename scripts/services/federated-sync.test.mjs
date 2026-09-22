import test from "node:test";
import assert from "node:assert";
import { FederatedSync } from "./federated-sync.mjs";

test("FederatedSync zero-cloud P2P", () => {
  const fs = new FederatedSync();
  assert.ok(fs.syncWeightDeltas([]));
});
