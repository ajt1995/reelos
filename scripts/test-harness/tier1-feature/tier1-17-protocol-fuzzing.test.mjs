import { test } from "node:test";
import assert from "node:assert/strict";
import { protocolFuzzer } from "../protocol-fuzzer.mjs";
import { parseRangeHeader } from "../../services/neural-stream-server.mjs";
import { watchPartyService } from "../../services/watchparty-service.mjs";

test("Tier 1 - F17.1 Protocol Fuzzing: generates boundary range headers for resource size", () => {
  const boundaries = protocolFuzzer.generateBoundaryRangesForSize(1000);
  assert.ok(Array.isArray(boundaries));
  assert.ok(boundaries.length >= 8);
  assert.ok(boundaries.includes("bytes=0-999"));
  assert.ok(boundaries.includes("bytes=999-999"));
  assert.ok(boundaries.includes("bytes=1000-1000"));
});

test("Tier 1 - F17.2 Protocol Fuzzing: rangeCorpus covers inverted, NaN, suffix, and multipart headers", () => {
  const corpus = protocolFuzzer.rangeCorpus;
  assert.ok(corpus.length >= 15);
  assert.ok(corpus.some((r) => r.includes("-500")));
  assert.ok(corpus.some((r) => r.includes("500-200")));
  assert.ok(corpus.some((r) => r.includes("NaN")));
  assert.ok(corpus.some((r) => r.includes(",")));
});

test("Tier 1 - F17.3 Protocol Fuzzing: parseRangeHeader never throws on adversarial range corpus", () => {
  const totalSize = 10000;
  for (const header of protocolFuzzer.rangeCorpus) {
    assert.doesNotThrow(() => {
      const res = parseRangeHeader(header, totalSize);
      // Result must be null, "unsatisfiable", or a valid object with start <= end
      if (res && typeof res === "object") {
        assert.ok(res.start >= 0);
        assert.ok(res.end < totalSize);
        assert.ok(res.start <= res.end);
      } else {
        assert.ok(res === null || res === "unsatisfiable");
      }
    }, `Failed on header: ${header}`);
  }
});

test("Tier 1 - F17.4 Protocol Fuzzing: generates adversarial WebSocket frames with opcodes & masks", () => {
  const frames = protocolFuzzer.generateAdversarialWsFrames();
  assert.ok(Array.isArray(frames));
  assert.ok(frames.length >= 6);

  const unmasked = frames.find((f) => f.name === "unmasked_client_text_frame");
  assert.ok(unmasked);
  assert.equal(unmasked.buffer[1] & 0x80, 0); // Mask bit 0

  const rsvFrame = frames.find((f) => f.name === "rsv_bits_non_zero");
  assert.ok(rsvFrame);
  assert.notEqual(rsvFrame.buffer[0] & 0x70, 0); // RSV bits set
});

test("Tier 1 - F17.5 Protocol Fuzzing: generatePingFlood constructs high-frequency frame payload", () => {
  const floodBuf = protocolFuzzer.generatePingFlood(50);
  assert.ok(Buffer.isBuffer(floodBuf));
  // 50 pings * 6 bytes per masked ping frame = 300 bytes
  assert.equal(floodBuf.length, 50 * 6);
  assert.equal(floodBuf[0], 0x89); // Ping opcode
});
