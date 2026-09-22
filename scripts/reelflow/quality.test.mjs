import test from "node:test";
import assert from "node:assert/strict";
import { parseSceneTitle, isSampleOrJunkFile, scoreRelease } from "./quality.mjs";

test("quality: rejects .rar and archive packed torrents as poison", () => {
  const archive1 = parseSceneTitle("Dune.Part.Two.2024.2160p.UHD.Remux.part01.rar");
  assert.equal(archive1.isPoison, true);
  assert.equal(archive1.poisonReason, "archive_packed");

  const archive2 = parseSceneTitle("Severance.S01E01.1080p.WEB-DL.zip");
  assert.equal(archive2.isPoison, true);
  assert.equal(archive2.poisonReason, "archive_packed");
});

test("quality: rejects CAM and TeleSync releases as poison", () => {
  const cam = parseSceneTitle("Gladiator.II.2024.CAMRip.x264-WAR");
  assert.equal(cam.isPoison, true);
  assert.equal(cam.poisonReason, "cam_low_quality");

  const ts = parseSceneTitle("Deadpool.and.Wolverine.2024.TELESYNC.HDCAM");
  assert.equal(ts.isPoison, true);
  assert.equal(ts.poisonReason, "cam_low_quality");
});

test("quality: parses 4K Dolby Vision HDR10+ Remux cleanly", () => {
  const parsed = parseSceneTitle("Oppenheimer.2023.2160p.UHD.Remux.HEVC.DV.HDR10+.Atmos.TrueHD.7.1-FraMeSToR.mkv");
  assert.equal(parsed.isPoison, false);
  assert.equal(parsed.cleanTitle, "Oppenheimer");
  assert.equal(parsed.year, 2023);
  assert.equal(parsed.resolution, "2160p");
  assert.equal(parsed.source, "Remux");
  assert.equal(parsed.codec, "HEVC");
  assert.ok(parsed.hdr.includes("DV"));
  assert.ok(parsed.hdr.includes("HDR10+"));
  assert.ok(parsed.audio.includes("Atmos"));
  assert.ok(parsed.audio.includes("TrueHD"));
});

test("quality: parses TV episode and Season Packs", () => {
  const ep = parseSceneTitle("The.Bear.S03E01.Tomorrow.1080p.DSNP.WEB-DL.DDP5.1.Atmos.H.264-FLUX");
  assert.equal(ep.season, 3);
  assert.equal(ep.episode, 1);
  assert.equal(ep.seasonPack, false);

  const pack = parseSceneTitle("Severance.Season.1.2160p.ATVP.WEB-DL.DDP5.1.Atmos.DV.H.265-FLUX");
  assert.equal(pack.season, 1);
  assert.equal(pack.seasonPack, true);
});

test("quality: detects junk and sample files without FUSE stat-thrashing", () => {
  assert.equal(isSampleOrJunkFile("Dune/sample.mkv", 15 * 1024 * 1024), true);
  assert.equal(isSampleOrJunkFile("Dune/Dune.2021.sample-rarbg.mkv", 20 * 1024 * 1024), true);
  assert.equal(isSampleOrJunkFile("Dune/info.nfo"), true);
  assert.equal(isSampleOrJunkFile("Dune/subs.idx"), true);
  assert.equal(isSampleOrJunkFile("Dune/Dune.2021.2160p.mkv", 45 * 1024 * 1024 * 1024), false);
});

test("quality: scores releases giving priority to instant cached 4K HDR", () => {
  const parsed4K = parseSceneTitle("Inception.2010.2160p.UHD.Remux.HEVC.DV.TrueHD.Atmos-Framestor");
  const parsed1080p = parseSceneTitle("Inception.2010.1080p.BluRay.x264-SPARKS");

  const score4kCached = scoreRelease(parsed4K, {
    qualityFloor: "2160p",
    preferHdr: true,
    isCached: true,
    sizeBytes: 50 * 1024 * 1024 * 1024,
  });

  const score1080Uncached = scoreRelease(parsed1080p, {
    qualityFloor: "2160p",
    preferHdr: true,
    isCached: false,
    sizeBytes: 8 * 1024 * 1024 * 1024,
  });

  assert.ok(score4kCached > score1080Uncached, "Cached 4K Remux must outscore uncached 1080p");
  assert.ok(score4kCached >= 800, "Cached 4K Remux should score >= 800");
});
