import assert from "node:assert/strict";
import test from "node:test";
import {
  capabilityAction,
  capabilityCopy,
  capabilityInfluence,
  capabilityProgress,
  capabilityStatus,
  type CapabilityRecord,
} from "./capability-view-model.ts";

test("capability copy uses calm consumer language and supports unknown additions", () => {
  assert.equal(capabilityCopy("semantic-search").name, "Natural search");
  assert.match(capabilityCopy("scene-understanding").detail, /spoiler-safe/i);
  assert.equal(capabilityCopy("future-home-magic").name, "Future Home Magic");
});

test("every lifecycle state has honest user-facing status", () => {
  assert.equal(capabilityStatus("installed").label, "Installed · not checked");
  assert.equal(capabilityStatus("validating").label, "Checking locally");
  assert.equal(capabilityStatus("learning_locally").label, "Learning · not in use");
  assert.equal(capabilityStatus("ready").label, "Ready · not active");
  assert.equal(capabilityStatus("active").label, "Active");
  assert.equal(capabilityStatus("paused").label, "Paused");
  assert.equal(capabilityStatus("unsupported").label, "Not supported here");
  assert.equal(capabilityStatus("disabled").label, "Off");
  assert.equal(capabilityStatus("quarantined").label, "Blocked for safety");
  assert.equal(capabilityStatus("rolled_back").label, "Previous version restored");
  assert.match(capabilityStatus("needs_attention").explanation, /stopped/i);
  assert.match(capabilityStatus("unsupported").explanation, /continues without it/i);
});

test("capability influence keeps evaluation-only work out of live claims", () => {
  assert.equal(capabilityInfluence("semantic-search").state, "built_in_rules");
  assert.equal(capabilityInfluence("scene-understanding").state, "evaluation_only");
  assert.equal(capabilityInfluence("shared-taste-intelligence").state, "evaluation_only");
  assert.match(capabilityInfluence("future-home-magic").explanation, /cannot influence live decisions/i);
  assert.match(capabilityCopy("shared-taste-intelligence").detail, /blocked/i);
});

test("capability actions match transitions exposed by the owner API", () => {
  assert.equal(capabilityAction("active"), "disable");
  assert.equal(capabilityAction("validating"), "disable");
  assert.equal(capabilityAction("needs_attention"), "revalidate");
  assert.equal(capabilityAction("disabled"), "revalidate");
  assert.equal(capabilityAction("ready"), "revalidate");
});

test("summary separates active, checking, and inactive capabilities", () => {
  const capabilities: CapabilityRecord[] = [
    { id: "one", state: "active" },
    { id: "two", state: "installed" },
    { id: "three", state: "learning_locally" },
    { id: "four", state: "paused" },
    { id: "five", state: "needs_attention" },
  ];
  assert.deepEqual(capabilityProgress(capabilities), { active: 1, checking: 2, inactive: 2 });
});
