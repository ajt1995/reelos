import { test } from "node:test";
import assert from "node:assert/strict";
import { protocolFuzzer } from "../protocol-fuzzer.mjs";
import { parseRangeHeader } from "../../services/neural-stream-server.mjs";

test("Tier 2 - F17.1 Protocol Fuzzing Boundary: inverted range returns null or unsatisfiable", () => {
  const result = parseRangeHeader("bytes=500-200", 1000);
  assert.ok(result === null || result === "unsatisfiable");
});

test("Tier 2 - F17.2 Protocol Fuzzing Boundary: suffix range larger than total file clamps to full file", () => {
  const result = parseRangeHeader("bytes=-500", 100);
  assert.ok(result && typeof result === "object");
  assert.equal(result.start, 0);
  assert.equal(result.end, 99);
});

test("Tier 2 - F17.3 Protocol Fuzzing Boundary: range starting past EOF returns unsatisfiable", () => {
  const result = parseRangeHeader("bytes=500-600", 100);
  assert.ok(result === null || result === "unsatisfiable");
});

test("Tier 2 - F17.4 Protocol Fuzzing Boundary: adversarial WS frames corpus covers all 8 RFC 6455 violation types", () => {
  const frames = protocolFuzzer.generateAdversarialWsFrames();
  assert.equal(frames.length, 8);

  const violationTypes = frames.map((f) => f.expectedViolation);
  assert.ok(violationTypes.includes("masking_required"));
  assert.ok(violationTypes.includes("rsv_non_zero"));
  assert.ok(violationTypes.includes("invalid_opcode"));
  assert.ok(violationTypes.includes("incomplete_frame"));
  assert.ok(violationTypes.includes("oversized_frame"));
  assert.ok(violationTypes.includes("control_frame_length"));
  assert.ok(violationTypes.includes("fragmented_control_frame"));
});

test("Tier 2 - F17.5 Protocol Fuzzing Boundary: ping flood generator handles count=0 and count=100", () => {
  const emptyFlood = protocolFuzzer.generatePingFlood(0);
  assert.equal(emptyFlood.length, 0);

  const flood100 = protocolFuzzer.generatePingFlood(100);
  // 6 bytes per masked 0-payload ping frame: [0x89, 0x80, mask[0], mask[1], mask[2], mask[3]]
  assert.equal(flood100.length, 600);
  assert.equal(flood100[0], 0x89);
  assert.equal(flood100[1], 0x80);
});
