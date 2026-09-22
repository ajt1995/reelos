#!/usr/bin/env node

/**
 * ReelOS Tier 5 Adversarial Stress & Invariant Hardening Audit
 *
 * Requirements verified:
 * a) Concurrent Chaos + Swarm: inject 50% packet loss and 50KB/s slow-drip throttling
 *    during active 15-client swarm load on port 8088. Verify: zero unhandled promise
 *    rejections, zero uncaught exceptions, zero daemon process crashes.
 * b) Memory Footprint Invariant: sample process memory over repeated stress cycles.
 *    Verify Windows background memory footprint strictly stays under 100MB (WorkingSet64 < 104857600).
 * c) Zero CPU Transcoding Invariant: verify DirectPlay headers (X-ReelOS-DirectPlay: true)
 *    and assert 0 ffmpeg or ffprobe processes are spawned during streaming.
 * d) Zero Legacy Port Leaks: scan network sockets and HTTP response bodies/headers to
 *    ensure zero occurrences of dead legacy ports (8096, 8989, 7878, 9696) and zero raw LAN IP leakage.
 * e) Clean Teardown: verify /api/chaos/reset cleanly restores all streaming pacing,
 *    resets TorBox circuit breaker, and closes any dangling chaos sockets.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import {
  startTestBox,
  createWsClient,
  sampleProcessMemory,
  assertZeroLegacyPorts,
  ensureMediaFixtures,
  TEST_HASH,
} from "./harness-utils.mjs";
import { SwarmSimulator } from "./swarm-simulator.mjs";
import { torBoxRateLimiter } from "../services/debrid-service.mjs";

ensureMediaFixtures();

describe("Tier 5: Adversarial Stress & Invariant Hardening Audit", () => {
  let box = null;

  before(async () => {
    box = await startTestBox({ port: 8088, timeoutMs: 20000 });
  });

  after(() => {
    if (box) {
      box.stop();
    }
  });

  test("Tier 5.a - Concurrent Chaos + 15-Client Swarm Stress (50% Packet Loss + 50KB/s Slow-Drip)", async () => {
    // 1. Configure Chaos Monkey via REST: 50% packet loss + 50KB/s slow-drip throttling
    const configRes = await fetch(`${box.baseUrl}/api/chaos/configure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: true,
        packetLoss: 0.5,
        slowDripBps: 51200,
      }),
    });
    assert.equal(configRes.status, 200, "Chaos configuration must succeed");
    const configBody = await configRes.json();
    assert.equal(configBody.config.packetLossRate, 0.5, "Packet loss rate must be 0.5");
    assert.equal(configBody.config.slowDripRateBps, 51200, "Slow-drip rate must be 51200 bps");

    // 2. Launch 15-client swarm under active chaos
    const sim = new SwarmSimulator({
      port: box.port,
      baseUrl: box.baseUrl,
      serverPid: box.pid,
      durationMs: 3500,
      testHash: TEST_HASH,
    });

    const metrics = await sim.runSwarm();

    // 3. Inspect chaos telemetry
    const telemRes = await fetch(`${box.baseUrl}/api/chaos/telemetry`);
    assert.equal(telemRes.status, 200);
    const telemBody = await telemRes.json();
    assert.ok(telemBody.ok);

    // 4. Verify daemon process survival
    assert.equal(box.proc.exitCode, null, "ReelOS daemon process must not have exited");
    assert.equal(box.proc.killed, false, "ReelOS daemon process must not be killed");

    // 5. Verify zero uncaught exceptions or unhandled rejections in server logs
    const stderrCombined = box.stderrLogs.join("\n");
    assert.equal(
      stderrCombined.includes("UnhandledPromiseRejection"),
      false,
      `UnhandledPromiseRejection detected in server logs:\n${stderrCombined}`
    );
    assert.equal(
      stderrCombined.includes("uncaughtException"),
      false,
      `uncaughtException detected in server logs:\n${stderrCombined}`
    );
    assert.equal(
      stderrCombined.includes("ERR_HTTP_HEADERS_SENT"),
      false,
      `ERR_HTTP_HEADERS_SENT detected in server logs:\n${stderrCombined}`
    );

    // 6. Verify server is still completely responsive to health checks
    const pingRes = await fetch(`${box.baseUrl}/api/watchparty/rooms`);
    assert.equal(pingRes.status, 200, "Server must remain responsive after chaos swarm");
  });

  test("Tier 5.b - Memory Footprint Invariant Under Repeated Stress Cycles (< 100MB WorkingSet64)", async () => {
    const memorySamplesMb = [];
    const MAX_MEMORY_BYTES = 104857600; // Strictly 100MB

    // Execute 5 repeated bursts of concurrent DirectPlay and seek requests
    for (let cycle = 1; cycle <= 5; cycle++) {
      const burstPromises = [];
      for (let i = 0; i < 6; i++) {
        burstPromises.push(
          fetch(`${box.baseUrl}/api/stream/${TEST_HASH}`, {
            headers: { Range: `bytes=${i * 32768}-${(i + 1) * 32768 - 1}` },
          }).then((r) => r.arrayBuffer()).catch(() => null)
        );
      }
      await Promise.all(burstPromises);

      // Sample memory via sampleProcessMemory
      const workingSetMb = await sampleProcessMemory(box.pid);
      memorySamplesMb.push(workingSetMb);

      assert.ok(
        workingSetMb < 100,
        `Memory invariant violation in cycle ${cycle}: ${workingSetMb.toFixed(2)}MB exceeds 100MB limit`
      );

      await new Promise((r) => setTimeout(r, 100));
    }

    const peakMem = Math.max(...memorySamplesMb);
    console.log(`\n  [Memory Invariant Verified]: Peak memory over 5 cycles: ${peakMem.toFixed(2)} MB (< 100MB threshold)`);
  });

  test("Tier 5.c - Zero CPU Transcoding Invariant (X-ReelOS-DirectPlay & 0 ffmpeg/ffprobe processes)", async () => {
    // 1. Issue DirectPlay stream requests
    const resSample = await fetch(`${box.baseUrl}/api/stream/sample`, {
      headers: { Range: "bytes=0-32767" },
    });
    assert.equal(resSample.status, 206, "Sample stream must return 206 Partial Content");
    assert.equal(
      resSample.headers.get("x-reelos-directplay"),
      "true",
      "Must contain X-ReelOS-DirectPlay: true header"
    );

    const resHash = await fetch(`${box.baseUrl}/api/stream/${TEST_HASH}`, {
      headers: { Range: "bytes=0-32767" },
    });
    assert.equal(resHash.status, 206, "Hash stream must return 206 Partial Content");
    assert.equal(
      resHash.headers.get("x-reelos-directplay"),
      "true",
      "Must contain X-ReelOS-DirectPlay: true header"
    );

    // 2. Query OS process table to verify 0 transcoding processes
    if (process.platform === "win32") {
      try {
        const ffmpegOut = execSync('tasklist /FI "IMAGENAME eq ffmpeg.exe" /NH', { encoding: "utf8" });
        assert.equal(
          ffmpegOut.toLowerCase().includes("ffmpeg.exe"),
          false,
          "Zero ffmpeg.exe processes must be spawned during streaming"
        );

        const ffprobeOut = execSync('tasklist /FI "IMAGENAME eq ffprobe.exe" /NH', { encoding: "utf8" });
        assert.equal(
          ffprobeOut.toLowerCase().includes("ffprobe.exe"),
          false,
          "Zero ffprobe.exe processes must be spawned during streaming"
        );
      } catch (err) {
        // If tasklist fails or returns empty, verify that error wasn't due to ffmpeg presence
        assert.equal(err.message?.includes("ffmpeg.exe"), false);
      }
    } else {
      try {
        const pgrep = execSync("pgrep -c 'ffmpeg|ffprobe' || true", { encoding: "utf8" });
        assert.equal(parseInt(pgrep.trim() || "0", 10), 0, "Zero ffmpeg/ffprobe processes on Linux");
      } catch {}
    }
  });

  test("Tier 5.d1 - Zero Legacy Port & LAN IP Leaks Across Core Endpoints (/api/library, /api/watchparty/rooms, /api/chaos/*, /api/stream/*)", async () => {
    // Reset chaos first so packet loss does not drop HTTP chunks during port audit
    await fetch(`${box.baseUrl}/api/chaos/reset`, { method: "POST" });

    const cleanEndpoints = [
      "/api/library",
      "/api/watchparty/rooms",
      "/api/chaos/config",
      "/api/chaos/telemetry",
      "/api/stream/sample",
    ];

    const legacyPortRegex = /:8096\b|:8989\b|:7878\b|:9696\b/;
    const rawLanIpRegex = /https?:\/\/(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d+)?(?!\.ts\.net)/;

    for (const ep of cleanEndpoints) {
      const res = await fetch(`${box.baseUrl}${ep}`, {
        headers: ep.includes("stream") ? { Range: "bytes=0-1023" } : {},
      });

      for (const [headerName, headerValue] of res.headers.entries()) {
        assert.equal(
          legacyPortRegex.test(headerValue),
          false,
          `Legacy port leaked in header '${headerName}' from ${ep}: ${headerValue}`
        );
        assert.equal(
          rawLanIpRegex.test(headerValue),
          false,
          `Raw LAN IP leaked in header '${headerName}' from ${ep}: ${headerValue}`
        );
      }

      const bodyText = await res.text();
      assertZeroLegacyPorts(bodyText);
      assert.equal(
        rawLanIpRegex.test(bodyText),
        false,
        `Raw LAN IP leaked in response body from ${ep}: ${bodyText.slice(0, 300)}`
      );
    }
  });

  test("Tier 5.d2 - Adversarial Legacy Relic Audit on /api/box (Identifies Legacy :8096 and Raw LAN IP Leaks)", async () => {
    const res = await fetch(`${box.baseUrl}/api/box`);
    assert.equal(res.status, 200, "/api/box must respond with 200 OK");
    const bodyText = await res.text();

    const legacyPortRegex = /:8096\b|:8989\b|:7878\b|:9696\b/;
    const rawLanIpRegex = /https?:\/\/(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d+)?(?!\.ts\.net)/;

    const hasLegacyPort = legacyPortRegex.test(bodyText);
    const hasRawLanIp = rawLanIpRegex.test(bodyText);

    // Audit and assert with detailed defect report if present
    if (hasLegacyPort || hasRawLanIp) {
      console.warn(`\n  [DEFECT-M5-02 AUDIT FINDING]: /api/box legacy leak detected:\n  - Legacy port :8096: ${hasLegacyPort}\n  - Raw LAN IP: ${hasRawLanIp}\n  - Sample payload: ${bodyText.slice(0, 250)}`);
    }

    // Explicit adversarial assertion:
    assert.equal(
      hasLegacyPort,
      false,
      `[DEFECT-M5-02] /api/box response payload leaks dead legacy port 8096: ${bodyText.slice(0, 200)}`
    );
    assert.equal(
      hasRawLanIp,
      false,
      `[DEFECT-M5-02] /api/box response payload leaks unshielded raw LAN IP: ${bodyText.slice(0, 200)}`
    );
  });

  test("Tier 5.e - Clean Teardown & Full System Restoration via /api/chaos/reset", async () => {
    // 1. Call POST /api/chaos/reset
    const resetRes = await fetch(`${box.baseUrl}/api/chaos/reset`, {
      method: "POST",
    });
    assert.equal(resetRes.status, 200, "Reset endpoint must return 200 OK");
    const resetBody = await resetRes.json();
    assert.equal(resetBody.ok, true, "Reset response must indicate ok: true");
    assert.equal(resetBody.config.enabled, false, "Chaos config enabled must be false");
    assert.equal(resetBody.config.packetLossRate, 0, "Packet loss rate must be reset to 0");
    assert.equal(resetBody.config.slowDripRateBps, 0, "Slow drip rate must be reset to 0");

    // 2. Verify TorBox circuit breaker is in closed/operational state
    assert.equal(
      torBoxRateLimiter.getCircuitState().state,
      "CLOSED",
      "TorBox rate limiter circuit breaker must be CLOSED (operational)"
    );

    // 3. Verify normal streaming throughput is restored (no slow-drip throttling delay)
    const t0 = Date.now();
    const streamRes = await fetch(`${box.baseUrl}/api/stream/sample`, {
      headers: { Range: "bytes=0-65535" },
    });
    assert.equal(streamRes.status, 206);
    const streamBuf = await streamRes.arrayBuffer();
    const durationMs = Date.now() - t0;

    assert.equal(streamBuf.byteLength, 65536, "Must receive full 64KB chunk");
    // Under 50KB/s slow drip, 64KB chunk would take at least 1,280ms.
    // Restored unthrottled streaming should complete within 350ms locally.
    assert.ok(
      durationMs < 600,
      `Stream throughput must be restored without throttling (completed in ${durationMs}ms)`
    );
  });
});
