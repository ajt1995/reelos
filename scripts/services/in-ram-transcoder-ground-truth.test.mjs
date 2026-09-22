import assert from "node:assert/strict";
import test from "node:test";

import { InRamTranscoderService } from "./in-ram-transcoder-service.mjs";

test("subtitle OCR fails closed without a verified OCR adapter", async () => {
  const service = new InRamTranscoderService({ maxMemoryBytes: 1024 });
  assert.equal(service.ocrSubtitlesToWebVtt(Buffer.from("bitmap subtitle bytes")), "");
  const result = await service.ocrPgsToVtt(Buffer.from("bitmap subtitle bytes"));
  assert.equal(result.ok, false);
  assert.equal(result.available, false);
  assert.equal(result.vtt, "");
});

test("audio helper preserves opaque bytes and never claims conversion", async () => {
  const service = new InRamTranscoderService({ maxMemoryBytes: 1024 });
  const source = Buffer.from([0xff, 0xf1, 0x50, 0x80, 0x00, 0x1f, 0xfc]);
  const result = service.transmuxAudioInRam(source, { nightMode: true, virtualCenterSteering: true });
  const chunks = [];
  for await (const chunk of result.stream) chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks), source);
  assert.equal(result.converted, false);
  assert.equal(result.virtualCenterSteering, false);
  assert.equal(result.speechClarityBoostDb, 0);
});

test("acoustic profile calculation never claims it was applied", () => {
  const service = new InRamTranscoderService({ maxMemoryBytes: 1024 });
  const result = service.applyRoomImpulseProfile(0.4, [120]);
  assert.equal(result.ok, false);
  assert.equal(result.available, false);
  assert.equal(result.applied, false);
  assert.equal(result.profile.activeInRam, false);
  assert.equal(service.getStats().roomImpulseProfileActive, false);
});
