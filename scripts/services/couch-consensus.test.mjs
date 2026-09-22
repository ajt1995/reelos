import test from "node:test";
import assert from "node:assert";
import { CouchConsensus } from "./couch-consensus.mjs";

test("CouchConsensus min-max pareto", () => {
  const cc = new CouchConsensus();
  assert.ok(cc.blendProfiles([]).disputeFree);
});
