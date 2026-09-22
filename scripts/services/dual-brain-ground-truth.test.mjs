import assert from "node:assert/strict";
import test from "node:test";

import { DualBrainService } from "./dual-brain-service.mjs";
import { MicroTrailerService } from "./micro-trailer-service.mjs";

test("catch-up never invents a plot or spoiler horizon", () => {
  const service = new DualBrainService();
  const result = service.generateCatchMeUp("unknown", 1800, 4);
  assert.equal(result.ok, false);
  assert.equal(result.available, false);
  assert.deepEqual(result.recapBullets, []);
  assert.equal(result.spoilerHorizonSec, null);
  assert.equal(JSON.stringify(result).includes("encryption key"), false);
});

test("acoustic tuning requires bounded measured telemetry", () => {
  const service = new DualBrainService();
  assert.equal(service.tuneAcousticRoom({}).ok, false);
  assert.equal(
    service.tuneAcousticRoom({
      measured: false,
      reverberationR60Ms: 340,
      bassResonanceHz: 120,
    }).ok,
    false,
  );
  const measured = service.tuneAcousticRoom({
    measured: true,
    reverberationR60Ms: 340,
    bassResonanceHz: 120,
  });
  assert.equal(measured.ok, false);
  assert.equal(measured.available, false);
  assert.equal(measured.applied, false);
  assert.equal(measured.measurementSource, "client-reported-measurement");
});

test("cinema context features fail closed without verified title evidence", () => {
  const service = new DualBrainService();
  assert.equal(service.getCompanionContext("unknown", 120).available, false);
  assert.equal(service.generateCommentary("unknown", 120).available, false);
  assert.equal(service.getNeedleDrop("unknown", 120).available, false);
  assert.equal(service.getCinemagraphLoop("unknown").available, false);
  const graph = service.getDramaturgGraph("unknown", 120);
  assert.equal(graph.available, false);
  assert.equal(graph.spoilerShieldActive, false);
  assert.equal(graph.graph, null);
  assert.equal(service.getPredictiveJumpPoints("unknown").length, 0);
  assert.equal(service.extractAmbientPalette().available, false);
  assert.equal(service.getAmbientSpectralPalette("unknown", 120).available, false);
});

test("micro-trailers and scene seeking require verified media evidence", async () => {
  const service = new MicroTrailerService();
  const missing = await service.generateMicroTeaser("film", Buffer.from("not a teaser"));
  assert.equal(missing.ok, false);
  assert.equal(service.findSceneTimestamp("film", "docking scene").available, false);

  const registered = await service.generateMicroTeaser("film", {
    verified: true,
    teaserBuffer: Buffer.from("verified-teaser-fixture"),
    durationSec: 15,
    evidenceSource: "test-fixture",
    scenes: [{ verified: true, label: "docking scene", timestampSec: 3600 }],
  });
  assert.equal(registered.ok, true);
  assert.equal(service.findSceneTimestamp("film", "docking").timestampSec, 3600);
  assert.equal(service.findSceneTimestamp("film", "unindexed climax").found, false);
});

test("verified title evidence can be registered explicitly", () => {
  const service = new DualBrainService();
  assert.equal(
    service.setCompanionContext("film", [
      {
        verified: true,
        timestampSec: 60,
        sceneType: "Opening",
        trivia: "Published production note.",
        directorNote: "Verified commentary excerpt.",
      },
    ]),
    true,
  );
  assert.equal(service.getCompanionContext("film", 70).available, true);

  assert.equal(
    service.setVerifiedSoundtrackCues("film", [
      { verified: true, timestampSec: 50, songTitle: "Verified track", artist: "Verified artist" },
    ]),
    true,
  );
  assert.equal(service.getNeedleDrop("film", 70).songTitle, "Verified track");

  assert.equal(
    service.setVerifiedCinemagraph("film", { verified: true, url: "/media/film-loop.webm" }),
    true,
  );
  assert.equal(service.getCinemagraphLoop("film").url, "/media/film-loop.webm");

  assert.equal(
    service.setVerifiedDramaturgGraph("film", {
      verified: true,
      characters: [{ id: "one", name: "One" }],
      factions: [],
      relationships: [],
    }),
    true,
  );
  assert.equal(service.getDramaturgGraph("film", 70).available, true);
});
