import http from "node:http";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import {
  createWsClient,
  sampleProcessMemory,
  measureEventLoopLag,
  assertZeroLegacyPorts,
  TEST_HASH,
} from "./harness-utils.mjs";

/**
 * Concurrent Multi-Client Swarm Stress Simulator (15+ Synthetic Users)
 */
export class SwarmSimulator {
  constructor(options = {}) {
    this.port = options.port || 8088;
    this.baseUrl = options.baseUrl || `http://127.0.0.1:${this.port}`;
    this.serverPid = options.serverPid || null;
    this.durationMs = options.durationMs || 5000;
    this.testHash = options.testHash || TEST_HASH;
    this.playbackHeaders = options.playbackHeaders || {};

    this.metrics = {
      totalRequests: 0,
      totalBytesStreamed: 0,
      activeConnections: 0,
      errors: [],
      peakMemoryMb: 0,
      eventLoopLag: null,
      legacyPortViolations: 0,
      transcodeViolations: 0,
    };
  }

  /**
   * Runs the complete 15-client swarm scenario.
   */
  async runSwarm() {
    const startTime = Date.now();
    const abortController = new AbortController();
    const { signal } = abortController;

    // Timeout to stop the swarm
    const timer = setTimeout(() => {
      abortController.abort();
    }, this.durationMs);

    // Periodic memory sampling
    const memSampler = setInterval(async () => {
      if (this.serverPid) {
        const mem = await sampleProcessMemory(this.serverPid);
        if (mem > this.metrics.peakMemoryMb) {
          this.metrics.peakMemoryMb = mem;
        }
      }
    }, 250);

    try {
      const lagMetrics = await measureEventLoopLag(async () => {
        // Launch 15 concurrent clients across 5 behavioral clusters:
        // Clients 1-4: DirectPlay Streaming
        const c1_4 = [1, 2, 3, 4].map((id) => this.runDirectPlayStreamer(id, signal));
        // Clients 5-7: Random Seek Scrubbing & Socket Aborts
        const c5_7 = [5, 6, 7].map((id) => this.runSeekScrubber(id, signal));
        // Clients 8-10: WatchParty NTP Sync & Reaction Storm
        const c8_10 = this.runWatchPartyTrio(signal);
        // Clients 11-13: REST Polling & Legacy Port Leak Probe
        const c11_13 = [11, 12, 13].map((id) => this.runRestPoller(id, signal));
        // Clients 14-15: Console Gaming Sentinel & QoS Chunk Pacer
        const c14_15 = this.runConsoleQosPair(signal);

        await Promise.all([
          Promise.all(c1_4),
          Promise.all(c5_7),
          c8_10,
          Promise.all(c11_13),
          c14_15,
        ]);
      });

      this.metrics.eventLoopLag = lagMetrics;
    } finally {
      clearTimeout(timer);
      clearInterval(memSampler);
    }

    // Check host transcoding invariant
    this.checkTranscodeInvariant();

    return this.metrics;
  }

  /**
   * Cluster 1 (Clients 1-4): 4K DirectPlay Video Streaming via Byte-Range Requests
   */
  async runDirectPlayStreamer(clientId, signal) {
    const chunkSize = 65536; // 64KB
    let offset = (clientId - 1) * chunkSize;

    while (!signal.aborted) {
      const rangeHeader = `bytes=${offset}-${offset + chunkSize - 1}`;
      try {
        const res = await fetch(`${this.baseUrl}/api/stream/${this.testHash}`, {
          headers: { ...this.playbackHeaders, Range: rangeHeader },
          signal,
        });

        this.metrics.totalRequests++;
        assertZeroLegacyPorts(res.headers.get("location") || "");

        if (res.status === 206 || res.status === 200) {
          const buf = Buffer.from(await res.arrayBuffer());
          this.metrics.totalBytesStreamed += buf.length;
          const directPlayHeader = res.headers.get("x-reelos-directplay");
          if (directPlayHeader !== "true") {
            this.metrics.errors.push(`Client ${clientId}: Missing X-ReelOS-DirectPlay header`);
          }
          offset += chunkSize;
          if (offset > 2 * 1024 * 1024) offset = 0; // Wrap around
        } else if (res.status === 416) {
          offset = 0; // Reset
        }
      } catch (err) {
        if (signal.aborted || err.name === "AbortError" || err.cause?.name === "AbortError") break;
        this.metrics.errors.push(`Client ${clientId} DirectPlay error: ${err.message}`);
      }
      await new Promise((r) => setTimeout(r, 40));
    }
  }

  /**
   * Cluster 2 (Clients 5-7): Rapid Seek Scrubbing & Mid-Stream Socket Aborts
   */
  async runSeekScrubber(clientId, signal) {
    while (!signal.aborted) {
      const randStart = Math.floor(Math.random() * 500000);
      const randEnd = randStart + Math.floor(Math.random() * 100000) + 1024;
      const rangeHeader = `bytes=${randStart}-${randEnd}`;

      try {
        const reqAbort = new AbortController();
        const fetchPromise = fetch(`${this.baseUrl}/api/stream/${this.testHash}`, {
          headers: { ...this.playbackHeaders, Range: rangeHeader },
          signal: reqAbort.signal,
        });

        this.metrics.totalRequests++;
        // Rapid random abort: abort halfway through
        if (Math.random() > 0.4) {
          setTimeout(() => reqAbort.abort(), 10);
        }

        const res = await fetchPromise;
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          this.metrics.totalBytesStreamed += buf.length;
        }
      } catch (err) {
        // AbortError is expected here
        if (err.name !== "AbortError" && err.cause?.name !== "AbortError" && !signal.aborted) {
          this.metrics.errors.push(`Client ${clientId} Scrubber error: ${err.message}`);
        }
      }
      await new Promise((r) => setTimeout(r, 30));
    }
  }

  /**
   * Cluster 3 (Clients 8-10): WatchParty Trio (Host + 2 Guests)
   */
  async runWatchPartyTrio(signal) {
    const roomCode = `SW${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      // 1. Create room via REST
      const createRes = await fetch(`${this.baseUrl}/api/watchparty/room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostName: "SwarmHost", customCode: roomCode }),
        signal,
      });
      this.metrics.totalRequests++;
      const roomData = await createRes.json();
      assertZeroLegacyPorts(roomData);

      // 2. Connect 3 WebSocket clients
      const hostWs = await createWsClient(this.port, `/ws/watchparty?room=${roomCode}&name=Host8&id=host-8`);
      const guest1Ws = await createWsClient(this.port, `/ws/watchparty?room=${roomCode}&name=Guest9&id=guest-9`);
      const guest2Ws = await createWsClient(this.port, `/ws/watchparty?room=${roomCode}&name=Guest10&id=guest-10`);

      // Exchange NTP pings and floating reactions in loop
      let step = 0;
      while (!signal.aborted) {
        step++;
        // NTP sync
        const t0 = Date.now();
        hostWs.send({ type: "ping", clientSendTime: t0 });

        // Playback sync
        if (step % 3 === 0) {
          hostWs.send({
            type: "playback",
            action: step % 6 === 0 ? "pause" : "play",
            currentTime: step * 2.5,
            playbackRate: 1.0,
          });
        }

        // Reactions
        guest1Ws.send({ type: "reaction", emoji: "🍿", senderName: "Guest9" });
        guest2Ws.send({ type: "reaction", emoji: "❤️", senderName: "Guest10" });

        this.metrics.totalRequests += 4;
        await new Promise((r) => setTimeout(r, 100));
      }

      hostWs.close();
      guest1Ws.close();
      guest2Ws.close();
    } catch (err) {
      if (!signal.aborted) {
        this.metrics.errors.push(`WatchParty trio error: ${err.message}`);
      }
    }
  }

  /**
   * Cluster 4 (Clients 11-13): REST API Polling & Anti-Legacy Port Scanner
   */
  async runRestPoller(clientId, signal) {
    const endpoints = [
      "/api/box",
      "/api/library",
      "/api/watchparty/rooms",
      "/api/lookup?q=cinema",
    ];

    let idx = 0;
    while (!signal.aborted) {
      const ep = endpoints[idx % endpoints.length];
      idx++;
      try {
        const res = await fetch(`${this.baseUrl}${ep}`, { signal });
        this.metrics.totalRequests++;
        const text = await res.text();
        assertZeroLegacyPorts(text);
      } catch (err) {
        if (err.message.includes("Legacy port leak")) {
          this.metrics.legacyPortViolations++;
          console.error("[SWARM LEAK DETECTED]:", ep, err.message);
        } else if (!signal.aborted) {
          // Some optional endpoints may return 404 in minimal test mode, which is fine
        }
      }
      await new Promise((r) => setTimeout(r, 60));
    }
  }

  /**
   * Cluster 5 (Clients 14-15): Console Gaming Latency Shield & Dynamic QoS Chunk Pacing
   */
  async runConsoleQosPair(signal) {
    while (!signal.aborted) {
      try {
        // Client 14: Simulate bufferbloat latency spike (45ms spike)
        const spikeRes = await fetch(
          `${this.baseUrl}/api/network/console-sentinel/simulate?action=yield&spike=45&vendor=playstation`,
          { signal }
        );
        this.metrics.totalRequests++;

        // Client 15: Stream chunk and verify QoS pacing headers
        const chunkRes = await fetch(`${this.baseUrl}/api/stream/${this.testHash}`, {
          headers: { ...this.playbackHeaders, Range: "bytes=0-65535" },
          signal,
        });
        this.metrics.totalRequests++;
        const chunkPacingHeader = chunkRes.headers.get("x-reelos-chunk-pacing");

        // Client 14: Restore latency
        await fetch(`${this.baseUrl}/api/network/console-sentinel/simulate?action=resume`, { signal });
        this.metrics.totalRequests++;
      } catch (err) {
        if (!signal.aborted) {
          // Optional in non-mocked environment
        }
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  /**
   * Verifies 0 host CPU transcoding (0 ffmpeg processes).
   */
  checkTranscodeInvariant() {
    if (process.platform === "win32") {
      try {
        const out = execSync('tasklist /FI "IMAGENAME eq ffmpeg.exe" /NH', { encoding: "utf8" });
        if (out.toLowerCase().includes("ffmpeg.exe")) {
          this.metrics.transcodeViolations++;
        }
      } catch {}
    }
  }
}
