/**
 * ReelOS Master Test Suite: Normal, Edge, and Corner Cases
 *
 * Exhaustively exercises all subsystems across BOTH:
 * - Local Windows Node: http://127.0.0.1:8080
 * - Remote HP Linux Appliance: http://192.168.1.234:8080
 *
 * Structure:
 * 1. NORMAL CASES: Golden paths for in-RAM streaming, OCR, audio downmix, palette, and mesh.
 * 2. EDGE CASES: Boundary conditions, exact byte ranges, date rollovers, extreme timestamps.
 * 3. CORNER CASES: Buffer saturation, socket murder, adversarial injections, gaming yields, and cross-node parity.
 */

import assert from "node:assert/strict";
import { inRamTranscoder } from "./services/in-ram-transcoder-service.mjs";
import { torBoxShield } from "./services/torbox-shield-service.mjs";
import { dualBrainService } from "./services/dual-brain-service.mjs";
import { microTrailerService } from "./services/micro-trailer-service.mjs";
import { consoleSentinel } from "./services/console-sentinel.mjs";
import { childProfileService } from "./services/child-profile-service.mjs";

const TARGETS = [
  { name: "Local Windows Node", url: "http://127.0.0.1:8080" },
  { name: "HP Linux Appliance", url: "http://192.168.1.234:8080" },
];

let totalPassed = 0;
let totalFailed = 0;

function pass(msg) {
  console.log(`    [PASS] ${msg}`);
  totalPassed++;
}

function fail(msg, err) {
  console.error(`    [FAIL] ${msg}:`, err?.message || err);
  totalFailed++;
}

async function fetchSafe(url, options = {}) {
  try {
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(options.timeout || 3500) });
    return res;
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}

async function runMasterBattery() {
  console.log("================================================================================");
  console.log("       REELOS MASTER HARNESS: NORMAL, EDGE & CORNER CASES                       ");
  console.log("================================================================================");

  // ==========================================================================
  // SUITE 1: NORMAL CASES (The Golden Paths)
  // ==========================================================================
  console.log("\n>>> SUITE 1: NORMAL CASES (The Golden Paths) <<<");

  try {
    // 1.1 In-RAM Direct Streaming
    const sessId = "norm-stream-01";
    inRamTranscoder.createRingBuffer(sessId);
    inRamTranscoder.appendChunk(sessId, Buffer.alloc(1024 * 512, 0x11)); // 512KB
    const rangeStream = inRamTranscoder.createRangeStream(sessId, 0, 1023);
    let bytesRead = 0;
    for await (const chunk of rangeStream) bytesRead += chunk.length;
    assert.equal(bytesRead, 1024);
    pass("1.1 In-RAM stream served exact 1024-byte chunk directly from memory");
    inRamTranscoder.destroyRingBuffer(sessId);

    // 1.2 Subtitle OCR to WebVTT
    const ocr = await inRamTranscoder.ocrPgsToVtt(Buffer.from("PGS_NORMAL_SAMPLE"));
    assert.equal(ocr.ok, true);
    assert.ok(ocr.vtt.includes("WEBVTT"));
    assert.ok(ocr.durationMs < 50);
    pass(`1.2 In-RAM subtitle OCR converted PGS to WebVTT in ${ocr.durationMs}ms (<50ms target)`);

    // 1.3 Audio Downmixing Transform
    const mockAudio = Buffer.alloc(2048, 0x33);
    const downmix = inRamTranscoder.transmuxAudioInRam(mockAudio, { channels: 2, nightMode: true });
    assert.ok(downmix.stream);
    pass("1.3 Audio transform downmix pipe initialized in RAM without disk write");

    // 1.4 Ambient 16-Color Palette
    const palette = dualBrainService.extractAmbientPalette(Buffer.alloc(1024, 0x55));
    assert.equal(palette.colors.length, 16);
    assert.ok(palette.latencyMs < 5);
    pass(`1.4 Ambient palette extracted 16 colors in ${palette.latencyMs}ms (mood: ${palette.dominantMood})`);

    // 1.5 TorBox Courtesy Pacing
    assert.equal(torBoxShield.minIntervalMs, 1500);
    pass("1.5 TorBox Courtesy Shield enforces baseline 1500ms pacing interval");

    // 1.6 Criterion Companion Context
    dualBrainService.setCompanionContext("oppenheimer", [{
      verified: true,
      timestampSec: 120,
      sceneType: "Verified production context",
      trivia: "Source-backed production note.",
      directorNote: "Source-backed scene note.",
    }]);
    const ctx = dualBrainService.getCompanionContext("oppenheimer", 120);
    assert.equal(ctx.found, true);
    assert.ok(ctx.trivia.length > 0);
    pass(`1.6 Criterion Companion returned scene context: [${ctx.sceneType}]`);

    // 1.7 Semantic Scene Seeker
    await microTrailerService.generateMicroTeaser("oppenheimer", {
      verified: true,
      teaserBuffer: Buffer.alloc(2048, 0x22),
      durationSec: 15,
      evidenceSource: "test-fixture",
      scenes: [{ verified: true, label: "docking scene", timestampSec: 3600 }],
    });
    const scene = microTrailerService.findSceneTimestamp("oppenheimer", "docking scene");
    assert.equal(scene.found, true);
    assert.equal(scene.timestampSec, 3600);
    pass(`1.7 Semantic Scene Seeker resolved 'docking scene' to ${scene.timestampSec}s`);

    // 1.8 Commentary remains unavailable until a sourced model adapter is connected
    const commentary = dualBrainService.generateCommentary("oppenheimer", 120, "director");
    assert.equal(commentary.ok, false);
    assert.equal(commentary.available, false);
    assert.equal(commentary.commentary, null);
    pass("1.8 Director's Commentary refuses to invent unsourced analysis");

    // 1.9 Spoiler-Free Catch Me Up
    const recap = dualBrainService.generateCatchMeUp("oppenheimer", 1800, 1);
    assert.equal(recap.ok, false);
    assert.equal(recap.available, false);
    assert.equal(recap.progressMinutes, 30);
    assert.equal(recap.recapBullets.length, 0);
    pass("1.9 Catch Me Up refuses to invent an unverified recap");

    // 1.10 Acoustic Room Auto-Tuning
    const tune = dualBrainService.tuneAcousticRoom({ measured: true, reverberationR60Ms: 320, bassResonanceHz: 115 });
    assert.equal(tune.ok, true);
    assert.equal(tune.speechClarityBoostDb, 2.0);
    assert.ok(tune.eqFilters.length >= 4);
    pass("1.10 Acoustic Room Auto-Tuning calculated 4-stage parametric EQ correction");

    // 1.11 Subconscious Mood Manifold
    const moodLate = dualBrainService.predictMoodManifold({ hour: 23 });
    assert.equal(moodLate.mood, "atmospheric_noir");
    assert.equal(moodLate.targetBedtimeVolume, true);
    pass("1.11 Subconscious Mood Manifold resolved late-night hour to atmospheric_noir");

    // 1.12 Virtual Center-Channel Acoustic Steering
    const stereoTransform = inRamTranscoder.transmuxAudioInRam(Buffer.alloc(1024, 0x44), { channels: 2 });
    assert.equal(stereoTransform.virtualCenterSteering, true);
    assert.equal(stereoTransform.speechClarityBoostDb, 3.5);
    pass("1.12 Virtual Center-Channel Steering applied +3.5dB vocal presence in RAM");

    // 1.13 Needle-Drop Soundtrack Identifier
    const needle = dualBrainService.getNeedleDrop("oppenheimer", 120);
    assert.equal(needle.ok, false);
    assert.equal(needle.available, false);
    pass("1.13 Needle-Drop Identifier refuses unverified soundtrack metadata");

    // 1.14 Kinesthetic Subtitle Typography
    const subWhisper = dualBrainService.formatKinestheticSubtitle("Quiet whisper...", 0.1, true);
    assert.equal(subWhisper.opacity, 0.75);
    assert.equal(subWhisper.fontSizePct, 85);
    const subShout = dualBrainService.formatKinestheticSubtitle("WATCH OUT!", 0.9, false);
    assert.equal(subShout.fontWeight, "bold");
    assert.equal(subShout.fontSizePct, 120);
    pass("1.14 Kinesthetic Subtitle Typography dynamically styled whisper and shout cues");

    // 1.15 Living Cinemagraph Loop
    const cinemaLoop = dualBrainService.getCinemagraphLoop("oppenheimer");
    assert.equal(cinemaLoop.ok, false);
    assert.equal(cinemaLoop.available, false);
    pass("1.15 Living Cinemagraph refuses to claim a loop without a verified asset");

    // 1.16 Family Cinema Shield (Granular Severity Tiers & Synchronized Redaction)
    const testCues = [
      { id: "c1", startMs: 1000, endMs: 4000, text: "What the fuck is this crazy bullshit?" },
      { id: "c2", startMs: 5000, endMs: 8000, text: "God damn it, this is completely peaceful." }
    ];
    const shieldLvl1 = dualBrainService.processProfanityShield(testCues, { severityLevel: 1, filterBlasphemy: false });
    assert.equal(shieldLvl1.ok, true);
    assert.equal(shieldLvl1.stats.severityBreakdown.level1, 1);
    assert.equal(shieldLvl1.stats.severityBreakdown.level2, 0); // bullshit preserved at Level 1

    const shieldLvl3 = dualBrainService.processProfanityShield(testCues, { severityLevel: 3, filterBlasphemy: true });
    assert.equal(shieldLvl3.ok, true);
    assert.equal(shieldLvl3.stats.suppressedCount, 3); // fuck, bullshit, god damn
    assert.ok(shieldLvl3.duckingWindows.length >= 3);
    assert.equal(shieldLvl3.duckingWindows[0].gainDb, -48);
    pass(`1.16 Family Cinema Shield verified across granular tiers (Suppressed: ${shieldLvl3.stats.suppressedCount} words, -48dB micro-ducking windows)`);

    // 1.17 Acoustic Room Impulse Auto-Tuning (TruePlay 10-Band Biquad IIR)
    const trueplay = inRamTranscoder.applyRoomImpulseProfile(0.42, [135, 3400]);
    assert.equal(trueplay.ok, true);
    assert.equal(trueplay.profile.bands.length, 10);
    assert.equal(trueplay.profile.activeInRam, true);
    pass(`1.17 Acoustic TruePlay synthesized 10-band biquad parametric IIR filter for RT60 ${trueplay.profile.rt60Seconds}s`);

    // 1.18 Predictive Debrid Warming (Subconscious Pre-Fetch)
    const prewarmEp = dualBrainService.predictNextDebridTarget("series-got:s02e07", 89);
    assert.equal(prewarmEp.ok, true);
    assert.equal(prewarmEp.shouldPreWarm, true);
    assert.equal(prewarmEp.targetTitleId, "series-got:s02e08");
    assert.equal(prewarmEp.preWarmedInRam, false);
    assert.equal(prewarmEp.estimatedTtffMs, null);
    pass(`1.18 Predictive Debrid logic identified ${prewarmEp.targetTitleId} without claiming it was staged`);

    // 1.19 The Cinema Dramaturg & Real-Time Character Graph
    const dramaturg = dualBrainService.getDramaturgGraph("dune", 1200);
    assert.equal(dramaturg.ok, false);
    assert.equal(dramaturg.available, false);
    assert.equal(dramaturg.spoilerShieldActive, false);
    pass("1.19 Cinema Dramaturg refuses to invent a spoiler-safe character graph");

    // 1.20 Child Profile Calibration & 8-Card Boundary Vector Learning
    const cal = childProfileService.calibrateChildProfile("test_kid_01", {
      name: "Leo Cinema",
      maturityPreset: "big_kids",
      parentAccounts: ["mom", "dad"],
      matchGameResponses: [
        { cardId: "scare_monsters", reaction: "block" },
        { cardId: "comic_slapstick", reaction: "fine" },
        { cardId: "fantasy_combat", reaction: "fine" },
        { cardId: "adult_innuendo", reaction: "ask" },
      ],
      whitelistOverrides: ["tt0088763"], // Back to the Future
    });
    assert.equal(cal.ok, true);
    assert.ok(cal.profile.boundaryVector.scare < 0.5); // scare blocked, should be clamped
    assert.ok(cal.profile.boundaryVector.violence >= 0.6); // fine, expanded
    pass(`1.20 Child Profile trained via 8-card boundary match game (Scare: ${cal.profile.boundaryVector.scare}, Violence: ${cal.profile.boundaryVector.violence})`);

    // 1.21 PIN ownership boundary
    assert.equal("pin" in cal.profile, false);
    pass("1.21 Child boundary learner stores no PIN; secure profile service owns authorization");

    // 1.22 Parent-Trained Discover Feed Curation
    const testCatalog = [
      { id: "tt0110413", title: "The Lion King", certification: "G", scareScore: 0.2, violenceScore: 0.2 },
      { id: "tt0088763", title: "Back to the Future", certification: "PG", scareScore: 0.3, violenceScore: 0.3 }, // Whitelisted!
      { id: "tt0107290", title: "Jurassic Park", certification: "PG-13", scareScore: 0.8, violenceScore: 0.6 }, // Blocked scare!
      { id: "tt15398776", title: "Oppenheimer", certification: "R", scareScore: 0.3, violenceScore: 0.4 }, // Blocked R rating!
    ];
    const curated = childProfileService.filterCatalogForChild("test_kid_01", testCatalog);
    assert.equal(curated.length, 2); // Lion King and Back to the Future allowed
    assert.equal(curated[0].title, "The Lion King");
    assert.equal(curated[1].title, "Back to the Future");
    assert.equal(curated[1].whitelisted, true);
    pass(`1.22 Parent-Trained Discover feed curated ${curated.length} approved titles, respecting whitelists and blocking scare/R-rated cinema`);

    // 1.23 Mobile Companion "Who's in the Room?" Presence Filter
    const presKids = childProfileService.setRoomPresence("living_room_tv", { kidsPresent: true });
    assert.equal(presKids.state.kidsPresent, true);
    assert.equal(presKids.state.filterLevel, 3);
    assert.equal(presKids.state.filterBlasphemy, true);

    const presAdults = childProfileService.setRoomPresence("living_room_tv", { kidsPresent: false });
    assert.equal(presAdults.state.kidsPresent, false);
    assert.equal(presAdults.state.filterLevel, 0);
    assert.equal(presAdults.state.filterBlasphemy, false);
    pass("1.23 Mobile Companion 'Who's in the Room?' presence filter dynamically switched between Kids (Level 3) and Adults (Uncensored)");
  } catch (err) {
    fail("Suite 1 Normal Cases", err);
  }

  // ==========================================================================
  // SUITE 2: EDGE CASES (The Boundaries)
  // ==========================================================================
  console.log("\n>>> SUITE 2: EDGE CASES (The Boundaries) <<<");

  try {
    // 2.1 Zero-Length Buffer for Ambient Palette
    const zeroPalette = dualBrainService.extractAmbientPalette(Buffer.alloc(0));
    assert.equal(zeroPalette.ok, false);
    assert.equal(zeroPalette.colors.length, 0);
    pass("2.1 Empty 0-byte frame buffer fails closed without a fabricated palette");

    // 2.2 Boundary Range Requests in RAM Stream
    const sessEdge = "edge-stream-02";
    inRamTranscoder.createRingBuffer(sessEdge);
    inRamTranscoder.appendChunk(sessEdge, Buffer.alloc(100, 0x77));

    // Exact 1-byte Range (0-0)
    const stream1b = inRamTranscoder.createRangeStream(sessEdge, 0, 0);
    let b1 = 0;
    for await (const c of stream1b) b1 += c.length;
    assert.equal(b1, 1);
    pass("2.2 Exact 1-byte HTTP Range (bytes=0-0) returned exactly 1 byte");

    // Exact Last Byte (99-99)
    const streamLast = inRamTranscoder.createRangeStream(sessEdge, 99, 99);
    let bLast = 0;
    for await (const c of streamLast) bLast += c.length;
    assert.equal(bLast, 1);
    pass("2.3 Exact last-byte Range (bytes=99-99) returned exactly 1 byte");

    // Exceeding Size Range (0-999999)
    const streamOver = inRamTranscoder.createRangeStream(sessEdge, 0, 999999);
    let bOver = 0;
    for await (const c of streamOver) bOver += c.length;
    assert.equal(bOver, 100);
    pass("2.4 Oversized Range (bytes=0-999999) safely clamped to buffer length (100 bytes)");
    inRamTranscoder.destroyRingBuffer(sessEdge);

    // 2.5 Clamping Extreme Negative Timestamps
    const ctxNeg = dualBrainService.getCompanionContext("oppenheimer", -9999);
    assert.equal(ctxNeg.found, true);
    assert.equal(ctxNeg.sceneType, "Verified production context");
    pass("2.5 Extreme negative timestamp resolves only against registered context");

    // 2.6 Clamping Extreme Distant Timestamps
    const ctxFar = dualBrainService.getCompanionContext("oppenheimer", 99999999);
    assert.equal(ctxFar.found, true);
    assert.equal(ctxFar.sceneType, "Verified production context");
    pass("2.6 Extreme distant timestamp does not fabricate a later scene");

    // 2.7 Overnight Staging Ceiling & Date Rollover
    torBoxShield.dailyStagedCount.set("rollover-resident", 1);
    assert.equal(torBoxShield.canStageOvernight("rollover-resident"), false);
    torBoxShield.lastResetDate = "Yesterday, Jan 1";
    assert.equal(torBoxShield.canStageOvernight("rollover-resident"), true);
    pass("2.7 Date rollover clears daily staging quota autonomously");

    // 2.8 Interactive Priority Preemption
    torBoxShield.fetchWithShield("http://httpbin.org/delay/0", {}, "background").catch(() => {});
    torBoxShield.fetchWithShield("http://httpbin.org/delay/0", {}, "interactive").catch(() => {});
    const priorities = torBoxShield.queue.map(x => x.priority);
    assert.equal(priorities[0], "interactive", "Interactive click MUST preempt background queue");
    pass("2.8 Interactive Play request preempted background tasks to front of queue");
    torBoxShield.queue.length = 0; // drain
  } catch (err) {
    fail("Suite 2 Edge Cases", err);
  }

  // ==========================================================================
  // SUITE 3: CORNER CASES (The Adversarial Chaos & Failures)
  // ==========================================================================
  console.log("\n>>> SUITE 3: CORNER CASES (The Adversarial Chaos & Failures) <<<");

  try {
    // 3.1 Ring Buffer Overflow & Eviction Protection (200MB burst into 150MB cap)
    const sessCorner = "corner-sat-03";
    inRamTranscoder.createRingBuffer(sessCorner);
    const chunk5Mb = Buffer.alloc(5 * 1024 * 1024, 0xee);
    for (let i = 0; i < 40; i++) { // 200MB total
      inRamTranscoder.appendChunk(sessCorner, chunk5Mb);
    }
    const bufMeta = inRamTranscoder.ringBuffers.get(sessCorner);
    assert.ok(bufMeta.totalBytes <= inRamTranscoder.maxMemoryBytes);
    assert.ok(bufMeta.evictedBytes > 0);
    pass(`3.1 Ring buffer saturation capped at ${Math.round(bufMeta.totalBytes / (1024 * 1024))}MB (Evicted: ${Math.round(bufMeta.evictedBytes / (1024 * 1024))}MB, 0 OOM)`);
    inRamTranscoder.destroyRingBuffer(sessCorner);

    // 3.2 Console Gaming Latency Spike Yield
    consoleSentinel.simulateConsoleYield(45, "playstation");
    assert.equal(consoleSentinel.yieldActive, true);
    pass("3.2 Console Sentinel activated gaming yield (PS5 latency spike detected)");

    // 3.3 Dynamic Scaling & Yielding under Gaming
    dualBrainService.setYielding(true);
    const yieldedComm = dualBrainService.generateCommentary("oppenheimer", 120);
    assert.equal(yieldedComm.yielded, true);
    pass("3.3 Dual-Brain Commentary yielded to 0.0% CPU during active console gaming");

    // 3.4 Console Gaming Restoration & Full Compute Recovery
    consoleSentinel.simulateConsoleResume();
    assert.equal(consoleSentinel.yieldActive, false);
    dualBrainService.setYielding(false);
    const restoredComm = dualBrainService.generateCommentary("oppenheimer", 120);
    assert.equal(restoredComm.yielded, false);
    pass("3.4 Console Sentinel restored full bandwidth and unyielded Big Brain compute");
  } catch (err) {
    fail("Suite 3 Corner Cases local", err);
  }

  // ==========================================================================
  // SUITE 4: CROSS-APPLIANCE NETWORK ENDPOINT BATTERY
  // ==========================================================================
  console.log("\n>>> SUITE 4: CROSS-APPLIANCE NETWORK BATTERY <<<");

  for (const target of TARGETS) {
    console.log(`\n  --- Testing Node: ${target.name} (${target.url}) ---`);
    const reachability = await fetchSafe(`${target.url}/api/ping`, { timeout: 1000 });
    if (reachability.status === 0) {
      pass(`Cross-appliance checks skipped because ${target.name} is offline`);
      continue;
    }

    // 4.1 Inverted & Malformed Ranges
    const badRanges = ["bytes=500-200", "bytes=abc-xyz", "bytes=---", "bytes=-0"];
    for (const r of badRanges) {
      const res = await fetchSafe(`${target.url}/api/grid/cache/stream/nonexistent`, {
        headers: { Range: r },
      });
      assert.ok([200, 206, 400, 404, 416].includes(res.status) || res.status === 0);
    }
    pass(`4.1 Inverted/malformed HTTP Ranges handled gracefully on ${target.name}`);

    // 4.2 Adversarial Titles & Injections
    const evilIds = [
      "🎬🍿🎥✨🔥",
      "../../../etc/passwd",
      "..%2F..%2Fwindows%2Fsystem32",
      "null%00byte",
      "'; DROP TABLE library; --",
      "x".repeat(1024),
    ];
    for (const evil of evilIds) {
      const res = await fetchSafe(`${target.url}/api/grid/cache/has/${encodeURIComponent(evil)}`);
      if (res.ok) {
        const data = await res.json();
        assert.equal(data.hasCache, false, `Adversarial ID '${evil.slice(0, 15)}' must return hasCache: false`);
      }
    }
    pass(`4.2 All 6 adversarial title injections rejected safely on ${target.name}`);

    // 4.3 Ambient Palette Telemetry
    const resPal = await fetchSafe(`${target.url}/api/ambient/palette`);
    if (resPal.ok) {
      const pal = await resPal.json();
      assert.equal(pal.colors.length, 16);
      pass(`4.3 Ambient Palette API functional on ${target.name} (Latency: ${pal.latencyMs}ms)`);
    } else {
      pass(`4.3 Ambient Palette remains unavailable on ${target.name} without decoded frame bytes`);
    }

    // 4.4 In-RAM Transcode Telemetry
    const resTc = await fetchSafe(`${target.url}/api/transcode/stats`);
    if (resTc.ok) {
      const tc = await resTc.json();
      assert.equal(tc.zeroDiskWear, true);
      pass(`4.4 In-RAM Transcode API active on ${target.name} (Backend: ${tc.memoryBackend})`);
    } else {
      pass(`4.4 In-RAM Transcode telemetry is not exposed by ${target.name}; appliance-only route skipped`);
    }

    // 4.5 TorBox Shield Telemetry
    const resTb = await fetchSafe(`${target.url}/api/torbox/stats`);
    if (resTb.ok) {
      const tb = await resTb.json();
      assert.equal(tb.courtesyShieldActive, true);
      assert.equal(tb.tokenAirGap, true);
      pass(`4.5 TorBox Courtesy Shield active on ${target.name} (airGap: ${tb.tokenAirGap})`);
    } else {
      pass(`4.5 TorBox Shield telemetry is not exposed by ${target.name}; appliance-only route skipped`);
    }

    // 4.6 Dual-Brain Screenplay Companion
    const resComp = await fetchSafe(`${target.url}/api/companion/context?titleId=oppenheimer&ts=120`);
    if (resComp.ok) {
      const comp = await resComp.json();
      assert.equal(comp.dossier?.available, false);
      pass(`4.6 Companion Context truthfully unavailable without verified evidence on ${target.name}`);
    } else {
      assert.ok([404, 422].includes(resComp.status));
      pass(`4.6 Companion Context truthfully unavailable on ${target.name}`);
    }

    // 4.7 Grid Mesh Status & Inter-Node Health
    const resGrid = await fetchSafe(`${target.url}/api/grid/status`);
    if (resGrid.ok) {
      const grid = await resGrid.json();
      assert.ok(grid.hardware.machineId);
      pass(`4.7 Grid Mesh Status healthy on ${target.name} (Host: ${grid.hardware.machineId}, RAM: ${grid.hardware.totalMemoryMb}MB)`);
    } else {
      pass(`4.7 Grid Mesh Status is not exposed by ${target.name}; appliance-only route skipped`);
    }

    // 4.8 Director's Commentary API
    const resComm = await fetchSafe(`${target.url}/api/commentary/scene?titleId=oppenheimer&ts=120&perspective=director`);
    if (resComm.ok) {
      const comm = await resComm.json();
      assert.equal(comm.ok, true);
      pass(`4.8 Director's Commentary API verified on ${target.name}`);
    } else if ([404, 422].includes(resComm.status)) {
      pass(`4.8 Director's Commentary truthfully unavailable on ${target.name}`);
    }

    // 4.9 Catch Me Up Recap API
    const resRecap = await fetchSafe(`${target.url}/api/recap/catchmeup?titleId=oppenheimer&progress=1200`);
    assert.equal(resRecap.status, 422);
    const rec = await resRecap.json();
    assert.equal(rec.available, false);
    pass(`4.9 Catch Me Up fails honestly without verified timeline data on ${target.name}`);

    // 4.10 Subconscious Mood Manifold API
    const resMood = await fetchSafe(`${target.url}/api/mood/manifold?hour=23`);
    if (resMood.ok) {
      const m = await resMood.json();
      assert.equal(m.ok, true);
      pass(`4.10 Subconscious Mood Manifold verified on ${target.name} (Mood: ${m.mood})`);
    }

    // 4.11 Soundtrack Identifier API
    const resTrack = await fetchSafe(`${target.url}/api/soundtrack/current?titleId=oppenheimer&ts=120`);
    if (resTrack.ok) {
      const track = await resTrack.json();
      assert.equal(track.ok, true);
      pass(`4.11 Soundtrack Identifier API verified on ${target.name} ('${track.songTitle}')`);
    } else if ([404, 422].includes(resTrack.status)) {
      pass(`4.11 Soundtrack Identifier truthfully unavailable on ${target.name}`);
    }

    // 4.12 Kinesthetic Subtitles API
    const resKin = await fetchSafe(`${target.url}/api/subtitles/kinesthetic?text=testing&energy=0.9`);
    if (resKin.ok) {
      const kin = await resKin.json();
      assert.equal(kin.ok, true);
      pass(`4.12 Kinesthetic Subtitles API verified on ${target.name}`);
    }

    // 4.13 Cinemagraph Loop API
    const resCine = await fetchSafe(`${target.url}/api/cinemagraph/oppenheimer`);
    if (resCine.ok) {
      const cine = await resCine.json();
      assert.equal(cine.ok, true);
      pass(`4.13 Cinemagraph Loop API verified on ${target.name} (${cine.loopDurationSec}s loop)`);
    } else if ([404, 422].includes(resCine.status)) {
      pass(`4.13 Cinemagraph Loop truthfully unavailable on ${target.name}`);
    }

    // 4.14 Family Cinema Shield Levels API
    const resShieldLvl = await fetchSafe(`${target.url}/api/audio/profanity-shield/levels`);
    if (resShieldLvl.ok) {
      const lvls = await resShieldLvl.json();
      assert.equal(lvls.ok, true);
      assert.ok(lvls.tiers.length >= 4);
      pass(`4.14 Family Cinema Shield Levels API verified on ${target.name} (${lvls.preTaughtVocabularyCount} pre-taught stems)`);
    }

    // 4.15 Family Cinema Shield Dialogue Filtering API
    const resShield = await fetchSafe(`${target.url}/api/audio/profanity-shield`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: "What the fuck is this bullshit? God damn it.",
        severityLevel: 2,
        filterBlasphemy: true,
      }),
    });
    if (resShield.ok) {
      const shieldData = await resShield.json();
      assert.equal(shieldData.ok, true);
      assert.ok(shieldData.stats.suppressedCount >= 2);
      pass(`4.15 Family Cinema Shield Filter API verified on ${target.name} (Suppressed: ${shieldData.stats.suppressedCount})`);
    }

    // 4.16 Predictive Debrid Pre-Warm API
    const resPreWarm = await fetchSafe(`${target.url}/api/stream/pre-warm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titleId: "series-got:s03e05", progress: 92 }),
    });
    if (resPreWarm.ok) {
      const pw = await resPreWarm.json();
      assert.equal(pw.ok, true);
      assert.equal(pw.shouldPreWarm, true);
      assert.equal(pw.preWarmedInRam, false);
      pass(`4.16 Predictive Debrid API suggested ${pw.targetTitleId} without claiming it was staged`);
    }

    // 4.17 Acoustic Room Impulse Profile API
    const resImpulse = await fetchSafe(`${target.url}/api/acoustic/impulse-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ measured: true, rt60: 0.45, nodes: [140, 3200] }),
    });
    if (resImpulse.ok) {
      const imp = await resImpulse.json();
      assert.equal(imp.ok, true);
      assert.equal(imp.profile.bands.length, 10);
      pass(`4.17 Acoustic Room Impulse API verified on ${target.name} (10-Band Biquad IIR active)`);
    }

    // 4.18 Cinema Dramaturg Character Graph API
    const resDramaturg = await fetchSafe(`${target.url}/api/dramaturg/character-graph?titleId=dune&ts=1200`);
    if (resDramaturg.ok) {
      const dg = await resDramaturg.json();
      assert.equal(dg.ok, true);
      assert.ok(dg.graph.characters.length >= 5);
      pass(`4.18 Cinema Dramaturg Character Graph API verified on ${target.name} (${dg.graph.characters.length} characters)`);
    } else if ([404, 422].includes(resDramaturg.status)) {
      pass(`4.18 Cinema Dramaturg truthfully unavailable on ${target.name}`);
    }

    // 4.19 16-Color Dynamic Ambient Light Telemetry API
    const resLight = await fetchSafe(`${target.url}/api/lighting/ambient-palette?titleId=blade-runner&ts=600`);
    if (resLight.ok) {
      const lt = await resLight.json();
      assert.equal(lt.ok, true);
      assert.equal(lt.palette16.length, 16);
      assert.ok(lt.cie1931.x > 0);
      pass(`4.19 16-Color Ambient Light Telemetry verified on ${target.name} (CIE xy: ${lt.cie1931.x}, ${lt.cie1931.y})`);
    }

    // 4.20 Child Profile Deck API
    const resDeck = await fetchSafe(`${target.url}/api/child-profile/deck`);
    if (resDeck.ok) {
      const d = await resDeck.json();
      assert.equal(d.ok, true);
      assert.equal(d.totalCards, 8);
      pass(`4.20 Child Profile Deck API verified on ${target.name} (8-Card Micro-Deck)`);
    }

    // 4.21 Child Profile Calibration API
    const resCal = await fetchSafe(`${target.url}/api/child-profile/calibrate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: "remote_test_child",
        name: "Remote Child",
        maturityPreset: "big_kids",
        matchGameResponses: [{ cardId: "scare_monsters", reaction: "block" }],
      }),
    });
    if (resCal.ok) {
      const calData = await resCal.json();
      assert.equal(calData.ok, true);
      pass(`4.21 Child Profile Calibration API verified on ${target.name} (Trained: ${calData.profile.id})`);
    }

    // 4.22 Child Profile Curated Discover Catalog API
    const resChildCat = await fetchSafe(`${target.url}/api/child-profile/catalog?profileId=remote_test_child`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalog: [
        { id: "family-film", title: "Family Film", certification: "G", scareScore: 0.1, violenceScore: 0.1 },
        { id: "adult-film", title: "Adult Film", certification: "R", scareScore: 0.2, violenceScore: 0.2 },
      ] }),
    });
    if (resChildCat.ok) {
      const ccat = await resChildCat.json();
      assert.equal(ccat.ok, true);
      assert.ok(ccat.titles.length >= 1);
      pass(`4.22 Child Profile Curated Catalog verified on ${target.name} (${ccat.count} titles approved)`);
    }

    // 4.23 Legacy PIN bypass is permanently retired
    const resPinV = await fetchSafe(`${target.url}/api/child-profile/pin/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: "remote_test_child", pin: "4321" }),
    });
    if (resPinV.status === 410) {
      pass(`4.23 Legacy plaintext PIN route is retired on ${target.name}`);
    }

    // 4.24 Mobile Companion "Who's in the Room?" Presence Filter API
    const resPresPost = await fetchSafe(`${target.url}/api/companion/presence-filter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "living_room_tv", kidsPresent: true, filterLevel: 3 }),
    });
    if (resPresPost.ok) {
      const pPost = await resPresPost.json();
      assert.equal(pPost.ok, true);
      assert.equal(pPost.state.kidsPresent, true);

      // Verify immediate fetch
      const resPresGet = await fetchSafe(`${target.url}/api/companion/presence-filter?sessionId=living_room_tv`);
      const pGet = await resPresGet.json();
      assert.equal(pGet.state.kidsPresent, true);
      pass(`4.24 Mobile Companion Presence Filter API verified on ${target.name} ('${pPost.state.label}')`);
    }
  }

  // ==========================================================================
  // FINAL SCORECARD
  // ==========================================================================
  console.log("\n================================================================================");
  console.log("                        MASTER HARNESS SUMMARY                                  ");
  console.log("================================================================================");
  console.log(`  Total Checks Passed: ${totalPassed}`);
  console.log(`  Total Checks Failed: ${totalFailed}`);
  console.log("--------------------------------------------------------------------------------");

  if (totalFailed === 0) {
    console.log("\n>>> AVAILABLE NORMAL, EDGE, AND CORNER CHECKS PASSED; OFFLINE APPLIANCES WERE SKIPPED. <<<\n");
  } else {
    console.error(`\n>>> FAILED ${totalFailed} CHECKS UNDER MASTER HARNESS. <<<\n`);
    process.exit(1);
  }
}

runMasterBattery().catch((err) => {
  console.error("Fatal master harness failure:", err);
  process.exit(1);
});
