import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createReelIntelligenceSystem, REEL_INTELLIGENCE_CAPABILITIES } from "./reel-intelligence-system.mjs";

const dirs = [];
test.after(() => dirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

test("one intelligence system owns capabilities, event truth, models, storage and resources", async () => {
  const stateDir = fs.mkdtempSync(path.join(process.cwd(), ".reelos-intelligence-system-test-"));
  dirs.push(stateDir);
  const system = await createReelIntelligenceSystem({ stateDir, storageRoot: stateDir, db: new PGlite() });
  assert.equal(system.status().capabilities.length, REEL_INTELLIGENCE_CAPABILITIES.length);
  assert.equal(system.status().capabilities.every((item) => item.state === "installed"), true);
  assert.equal(system.status().execution.length, REEL_INTELLIGENCE_CAPABILITIES.length);
  assert.equal(system.status().execution.every((item) => item.eligible === false), true);
  const result = await system.runtime.infer({
    requestId: "request-1", capabilityId: "semantic-search", profileScope: "adult-a",
    featureSnapshotId: "snapshot-1", deadlineMs: 1000, qualityFloor: "baseline",
    resourceClass: "interactive", privacyClass: "profile_private", shadowAllowed: true,
    input: { query: "something warm" },
  });
  assert.equal(result.fallbackUsed, true);
  const events = await system.store.readEvents({ partitionKey: "profile:adult-a" });
  assert.equal(events.some((event) => event.event_type === "model.inference"), true);
  await system.close();
});
