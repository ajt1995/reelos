import assert from "node:assert/strict";
import test from "node:test";
import { conciergeCapability, inferConciergeIntent, sanitizeConciergeContext } from "../experience/concierge.ts";

test("concierge inference keeps setup help deterministic", () => {
  assert.equal(inferConciergeIntent("I want to import my personal media"), "personal-media");
  assert.equal(inferConciergeIntent("why can't I play this?"), "unavailable-title");
  assert.equal(conciergeCapability({ totalMemoryMb: 4096, freeMemoryMb: 1000 }).mode, "deterministic");
});

test("concierge context removes secrets before any adapter can receive it", () => {
  assert.deepEqual(
    sanitizeConciergeContext({ title: "Charade", torboxKey: "secret", nested: { apiToken: "nope", mood: "cozy" } }),
    { title: "Charade", nested: { mood: "cozy" } },
  );
});
