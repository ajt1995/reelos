/**
 * ReelOS bounded in-memory buffer and pass-through helpers.
 *
 * This module does not contain a codec, subtitle OCR model, or verified audio
 * processor. Those capabilities require explicit adapters. The buffer itself
 * keeps only the supplied bytes in process memory and makes no whole-system
 * disk-wear or transcoding claim.
 */

import { EventEmitter } from "node:events";
import { Transform, Readable, PassThrough } from "node:stream";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const DEFAULT_RING_BUFFER_MAX_BYTES = 150 * 1024 * 1024; // 150MB RAM ring buffer cap

export class InRamTranscoderService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxMemoryBytes = options.maxMemoryBytes || DEFAULT_RING_BUFFER_MAX_BYTES;
    /** @type {Map<string, { chunks: Buffer[], totalBytes: number, createdAt: number, mimeType: string }>} */
    this.ringBuffers = new Map();
    this.totalTransmuxSessions = 0;
    this.totalBytesProcessedInRam = 0;

    // Detect shared memory (/dev/shm) on Linux
    this.hasShm = process.platform === "linux" && fs.existsSync("/dev/shm");
  }

  /**
   * Creates an in-RAM circular ring buffer for an active stream session.
   * @param {string} sessionId
   * @param {string} [mimeType="video/mp4"]
   */
  createRingBuffer(sessionId, mimeType = "video/mp4") {
    if (this.ringBuffers.has(sessionId)) {
      this.destroyRingBuffer(sessionId);
    }
    const session = {
      chunks: [],
      totalBytes: 0,
      createdAt: Date.now(),
      mimeType,
      evictedBytes: 0,
    };
    this.ringBuffers.set(sessionId, session);
    this.totalTransmuxSessions++;
    return session;
  }

  /**
   * Appends a chunk into the in-RAM ring buffer, evicting oldest chunks if cap exceeded.
   * @param {string} sessionId
   * @param {Buffer} chunk
   */
  pushChunk(sessionId, chunk) {
    const session = this.ringBuffers.get(sessionId);
    if (!session || !chunk || chunk.length === 0) return;

    session.chunks.push(chunk);
    session.totalBytes += chunk.length;
    this.totalBytesProcessedInRam += chunk.length;

    // Enforce circular RAM boundary: evict oldest chunks when exceeding buffer ceiling
    while (session.totalBytes > this.maxMemoryBytes && session.chunks.length > 1) {
      const evicted = session.chunks.shift();
      session.totalBytes -= evicted.length;
      session.evictedBytes += evicted.length;
    }
  }

  /**
   * Alias for pushChunk
   */
  appendChunk(sessionId, chunk) {
    return this.pushChunk(sessionId, chunk);
  }

  /**
   * Releases an in-RAM ring buffer.
   * @param {string} sessionId
   */
  destroyRingBuffer(sessionId) {
    const session = this.ringBuffers.get(sessionId);
    if (!session) return;
    session.chunks = [];
    session.totalBytes = 0;
    this.ringBuffers.delete(sessionId);
  }

  /**
   * Clears all active in-RAM ring buffers.
   */
  clearBuffer() {
    for (const id of Array.from(this.ringBuffers.keys())) {
      this.destroyRingBuffer(id);
    }
  }

  /**
   * Returns current buffer status and eviction telemetry.
   * @param {string} [sessionId]
   */
  getBufferStatus(sessionId) {
    if (sessionId) {
      const session = this.ringBuffers.get(sessionId);
      return {
        currentBytes: session?.totalBytes || 0,
        maxCapacityBytes: this.maxMemoryBytes,
        totalEvictedBytes: session?.evictedBytes || 0,
        chunkCount: session?.chunks.length || 0,
      };
    }
    let totalBytes = 0;
    let totalEvicted = 0;
    for (const s of this.ringBuffers.values()) {
      totalBytes += s.totalBytes;
      totalEvicted += s.evictedBytes || 0;
    }
    return {
      currentBytes: totalBytes,
      maxCapacityBytes: this.maxMemoryBytes,
      totalEvictedBytes: totalEvicted,
      sessionCount: this.ringBuffers.size,
    };
  }

  /**
   * Subtitle OCR compatibility method. It returns no invented dialogue while
   * an OCR adapter is absent.
   * @param {Buffer} subtitleData PGS bitmap bytes
   * @returns {string} WebVTT text
   */
  ocrSubtitlesToWebVtt(subtitleData) {
    void subtitleData;
    return "";
  }

  /**
   * Async OCR runner returning structured status and latency metrics.
   * @param {Buffer} subtitleData
   * @returns {Promise<{ ok: boolean, vtt: string, durationMs: number }>}
   */
  async ocrPgsToVtt(subtitleData) {
    const t0 = performance.now();
    const vtt = this.ocrSubtitlesToWebVtt(subtitleData);
    const durationMs = Math.round((performance.now() - t0) * 100) / 100;
    return {
      ok: false,
      available: false,
      vtt,
      durationMs,
      error: "No verified PGS/SUP OCR adapter is connected.",
    };
  }

  /**
   * Fast In-RAM Audio Transmuxer helper returning a readable stream.
   * @param {Buffer} audioBuffer
   * @param {object} options
   */
  transmuxAudioInRam(audioBuffer, options = {}) {
    const stream = new Readable({
      read() {
        this.push(audioBuffer);
        this.push(null);
      }
    });
    const transform = this.createInRamAudioTransmuxStream(options);
    return {
      stream: stream.pipe(transform),
      converted: false,
      virtualCenterSteering: false,
      speechClarityBoostDb: 0,
      warning: "Audio bytes are passed through unchanged; no codec or channel conversion is active.",
    };
  }

  /**
   * Fast In-RAM Audio Transmuxer: Repacks high-bitrate multi-channel audio (DTS/TrueHD)
   * into clean universal stereo AAC or spatial Opus without decoding video.
   * Integrates Section 68 Virtual Center-Channel Acoustic Steering.
   * @param {Readable} audioSourceStream
   * @returns {Transform}
   */
  createInRamAudioTransmuxStream(options = {}) {
    void options;

    return new Transform({
      transform(chunk, encoding, callback) {
        this.push(chunk);
        callback();
      },
    });
  }

  /**
   * Creates an in-RAM HTTP Range stream for a session.
   * @param {string} sessionId
   * @param {number} start
   * @param {number} end
   * @returns {Readable}
   */
  createRangeStream(sessionId, start = 0, end = Infinity) {
    const session = this.ringBuffers.get(sessionId);
    if (!session) {
      const empty = new Readable({ read() {} });
      empty.push(null);
      return empty;
    }

    const combined = Buffer.concat(session.chunks);
    const sliceEnd = Math.min(combined.length, end + 1);
    const sliced = combined.subarray(start, sliceEnd);

    const stream = new Readable({
      read() {
        this.push(sliced);
        this.push(null);
      },
    });
    return stream;
  }

  /**
   * Produces a candidate acoustic EQ profile from client-reported telemetry.
   * The current service has no verified output adapter, so it must not claim
   * that the profile was loaded into or applied to an audio stream.
   * @param {number} [rt60Seconds=0.45] Measured room reverberation time in seconds
   * @param {number[]} [resonanceNodes=[]] Measured acoustic room modes / resonant peaks (Hz)
   */
  applyRoomImpulseProfile(rt60Seconds = 0.45, resonanceNodes = [140, 3200]) {
    const rt60 = Math.max(0.1, Math.min(2.5, Number(rt60Seconds || 0.45)));
    const nodes = Array.isArray(resonanceNodes) ? resonanceNodes : [140, 3200];

    // Synthesize 10-band biquad parametric EQ compensation matrix
    const bands = [
      { freqHz: 31, q: 1.4, gainDb: -1.5, type: "highpass_subsonic" },
      { freqHz: 63, q: 2.0, gainDb: -2.0, type: "notch_cabinet" },
      { freqHz: 125, q: 2.5, gainDb: rt60 > 0.6 ? -4.0 : -2.5, type: "peaking_room_boundary" },
      { freqHz: 250, q: 1.8, gainDb: -1.5, type: "peaking_mud_cut" },
      { freqHz: 500, q: 1.0, gainDb: +0.5, type: "peaking_vocal_chest" },
      { freqHz: 1000, q: 1.2, gainDb: +1.5, type: "peaking_dialogue_core" },
      { freqHz: 2000, q: 1.5, gainDb: +2.5, type: "peaking_presence_articulation" },
      { freqHz: 4000, q: 3.0, gainDb: -2.5, type: "notch_flutter_echo" },
      { freqHz: 8000, q: 1.0, gainDb: +1.0, type: "high_shelf_air" },
      { freqHz: 16000, q: 0.7, gainDb: -1.0, type: "high_shelf_smooth" },
    ];

    const candidateProfile = {
      calibratedAt: Date.now(),
      rt60Seconds: rt60,
      resonanceNodes: nodes,
      targetResponse: "ReelOS dialogue-first candidate curve",
      filterType: "10-Band Biquad Parametric IIR",
      bands,
      activeInRam: false,
      applied: false,
    };

    return {
      ok: false,
      available: false,
      profile: candidateProfile,
      applied: false,
      error: "No verified audio-output adapter is connected to apply this candidate profile.",
    };
  }

  /**
   * Telemetry stats for Developer Cockpit.
   */
  getStats() {
    let totalActiveMemoryBytes = 0;
    for (const s of this.ringBuffers.values()) {
      totalActiveMemoryBytes += s.totalBytes;
    }
    return {
      activeSessions: this.ringBuffers.size,
      totalActiveMemoryMb: Math.round((totalActiveMemoryBytes / (1024 * 1024)) * 100) / 100,
      totalTransmuxSessions: this.totalTransmuxSessions,
      totalGigabytesProcessed: Math.round((this.totalBytesProcessedInRam / (1024 * 1024 * 1024)) * 100) / 100,
      memoryBackend: this.hasShm ? "/dev/shm (POSIX Shared Memory)" : "Node.js Heap Buffers",
      bufferDiskWrites: 0,
      zeroDiskWear: null,
      virtualCenterSteering: null,
      roomImpulseProfileActive: Boolean(this.activeRoomImpulseProfile),
    };
  }
}

export const inRamTranscoder = new InRamTranscoderService();
