import test from "node:test";
import assert from "node:assert";
import { politeScheduler } from "./polite-scheduler.mjs";

test("PoliteScheduler test", () => {
  const status = politeScheduler.getStatus();
  assert.ok(status.hostState);
});
