/**
 * ReelOS Native HTTP Range Stream Server
 * Sovereign End-to-End Neural Cinema Streaming Engine.
 *
 * Implements RFC 7233 byte-range serving (HTTP 206 Partial Content),
 * zero-copy piping directly into client video players (Android TV ExoPlayer,
 * Mobile Player, and Web HTML5 Video), and zero host transcoding (100% DirectPlay).
 */

import fs, { createReadStream, existsSync, statSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import http from "node:http";
import dns from "node:dns/promises";
import net from "node:net";
import { Transform } from "node:stream";
import { beginPreparationBlockingStream } from "./preparation-activity.mjs";
import { createHash } from "node:crypto";
import { torBoxRateLimiter } from "./debrid-service.mjs";
import { chaosMonkeyService, createChaosStreamTransform } from "./chaos-monkey-service.mjs";
import { SAMPLE_MOVIES } from "../sample-library-seed.mjs";
import { authorizePlaybackItem, playbackIdentity, playbackItemId, resolvePlaybackItem, sendPlaybackFailure, verifiedPlaybackFile } from "./playback-access-service.mjs";


const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

const VIDEO_MIME = {
  ".mp4": "video/mp4",
  ".mkv": "video/x-matroska",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".ts": "video/mp2t",
  ".m4v": "video/mp4",
};

const PROVIDER_READY_STATES = new Set(["completed", "cached", "seeding", "uploading"]);
const PROVIDER_IPV4_DENY = new net.BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
]) PROVIDER_IPV4_DENY.addSubnet(network, prefix, "ipv4");
PROVIDER_IPV4_DENY.addAddress("168.63.129.16", "ipv4");
const PROVIDER_IPV6_GLOBAL = new net.BlockList();
PROVIDER_IPV6_GLOBAL.addSubnet("2000::", 3, "ipv6");
const PROVIDER_IPV6_DENY = new net.BlockList();
for (const [network, prefix] of [["2001::", 32], ["2001:db8::", 32], ["2002::", 16]]) {
  PROVIDER_IPV6_DENY.addSubnet(network, prefix, "ipv6");
}

function providerAddressAllowed(address) {
  const family = net.isIP(address);
  if (family === 4) return !PROVIDER_IPV4_DENY.check(address, "ipv4");
  if (family === 6) return PROVIDER_IPV6_GLOBAL.check(address, "ipv6") && !PROVIDER_IPV6_DENY.check(address, "ipv6");
  return false;
}

async function providerDestination(remoteUrl, { providerLookup = dns.lookup, providerSecret = "" } = {}) {
  const url = new URL(remoteUrl);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const lower = hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:" || url.username || url.password || !hostname
      || lower === "localhost" || lower.endsWith(".localhost") || lower.endsWith(".local")
      || lower.endsWith(".internal") || lower.endsWith(".home.arpa") || lower === "metadata") {
    throw new Error("Provider stream destination is not allowed.");
  }
  if (providerSecret && (url.href.includes(providerSecret) || decodeURIComponent(url.href).includes(providerSecret))) {
    throw new Error("Provider stream destination is not allowed.");
  }
  const family = net.isIP(hostname);
  const addresses = family ? [{ address: hostname, family }]
    : await providerLookup(hostname, { all: true, verbatim: true });
  if (!Array.isArray(addresses) || addresses.length === 0
      || addresses.some((entry) => !entry || net.isIP(entry.address) !== entry.family || !providerAddressAllowed(entry.address))) {
    throw new Error("Provider stream destination is not allowed.");
  }
  const pinned = addresses[0];
  const lookup = (requestedHost, lookupOptions, callback) => {
    if (typeof lookupOptions === "function") { callback = lookupOptions; lookupOptions = {}; }
    if (requestedHost.toLowerCase().replace(/\.$/, "") !== lower) {
      callback(new Error("Provider stream destination changed."));
      return;
    }
    if (lookupOptions?.all) callback(null, [pinned]);
    else callback(null, pinned.address, pinned.family);
  };
  return { lookup };
}

function providerEpisodeMatches(item, file) {
  if (item?.mediaType !== "episode" && item?.episode == null) return true;
  const season = item.season;
  const episode = item.episode;
  if (!Number.isInteger(season) || !Number.isInteger(episode)) return false;
  const name = String(file?.name || file?.short_name || file?.path || "");
  const markers = [...name.matchAll(/(?:^|[^a-z0-9])s0*(\d{1,3})e0*(\d{1,3})(?!\d)/gi)];
  if (markers.length !== 1 || Number(markers[0][1]) !== season || Number(markers[0][2]) !== episode) return false;
  const suffix = name.slice(markers[0].index + markers[0][0].length);
  return !/^(?:[-_. ]*e0*\d{1,3}|[-_]0*\d{1,3}(?:[^0-9]|$))/i.test(suffix);
}

/**
 * Dynamic Console Gaming QoS Video Chunk Pacing State
 */
export const streamPacingState = {
  isPacingActive: false,
  pacingDelayMs: 20,
  pacingChunkSize: 64 * 1024, // 64KB chunk size during active gaming
  bitrateMultiplier: 1.0,
  activeSpikeReason: null,
  totalPacedSessions: 0,
};

/**
 * Resets stream pacing state to baseline defaults for test isolation.
 */
export function resetStreamPacingState() {
  streamPacingState.isPacingActive = false;
  streamPacingState.pacingDelayMs = 20;
  streamPacingState.pacingChunkSize = 64 * 1024;
  streamPacingState.bitrateMultiplier = 1.0;
  streamPacingState.activeSpikeReason = null;
  streamPacingState.totalPacedSessions = 0;
}

/**
 * Creates a Transform stream that dynamically paces video chunks and throttles burst size.
 * @param {number} [pacingDelayMs=20]
 * @param {number} [maxChunkSize=65536]
 * @returns {Transform}
 */
export function createPacedChunkStream(pacingDelayMs = 20, maxChunkSize = 64 * 1024) {
  let timer = null;
  return new Transform({
    transform(chunk, encoding, callback) {
      if (this.destroyed) return;
      if (pacingDelayMs <= 0 && chunk.length <= maxChunkSize) {
        this.push(chunk);
        callback();
        return;
      }

      let offset = 0;
      if (pacingDelayMs <= 0) {
        while (offset < chunk.length) {
          const piece = chunk.subarray(offset, offset + maxChunkSize);
          offset += maxChunkSize;
          this.push(piece);
        }
        callback();
        return;
      }

      const sendNextPiece = () => {
        if (this.destroyed) return;
        if (offset >= chunk.length) {
          callback();
          return;
        }
        const piece = chunk.subarray(offset, offset + maxChunkSize);
        offset += maxChunkSize;
        this.push(piece);

        if (offset < chunk.length) {
          timer = setTimeout(sendNextPiece, pacingDelayMs);
        } else {
          callback();
        }
      };
      sendNextPiece();
    },
    destroy(err, callback) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      callback(err);
    },
  });
}

/**
 * Wires ConsoleSentinel latency events to dynamic video chunk pacing.
 * @param {import("node:events").EventEmitter} sentinel
 */
export function attachConsoleSentinelQoS(sentinel) {
  if (!sentinel || typeof sentinel.on !== "function") return;

  sentinel.on("CONSOLES_GAMING_YIELD", (event) => {
    streamPacingState.isPacingActive = true;
    streamPacingState.bitrateMultiplier = 0.5;
    streamPacingState.pacingDelayMs = Math.min(50, Math.max(15, event?.deltaMs || 20));
    streamPacingState.activeSpikeReason = event?.reason || "bufferbloat_spike";
    streamPacingState.totalPacedSessions++;
    console.log(`[neural-stream] Console QoS Active: pacing video chunks (${streamPacingState.pacingDelayMs}ms delay, 50% bitrate stepdown)`);
  });

  sentinel.on("CONSOLES_GAMING_RESUME", (event) => {
    streamPacingState.isPacingActive = false;
    streamPacingState.bitrateMultiplier = 1.0;
    streamPacingState.pacingDelayMs = 0;
    streamPacingState.activeSpikeReason = null;
    console.log(`[neural-stream] Console QoS Restored: latency normalized (${event?.currentRtt || 18}ms)`);
  });
}

// Auto-wire console sentinel if available
try {
  import("./console-sentinel.mjs").then((m) => {
    if (m?.consoleSentinel) attachConsoleSentinelQoS(m.consoleSentinel);
  }).catch(() => {});
} catch {}

/**
 * Pipes a media stream through dynamic QoS chunk pacing and/or Adversarial Chaos Monkey transforms.
 * Ensures timer cleanup on stream destroy, socket error handling, and proper .on("close") destruction.
 * @param {import("node:stream").Readable} sourceStream
 * @param {import("node:http").ServerResponse} res
 */
export function pipeStreamWithPacing(sourceStream, res) {
  const isPacing = Boolean(streamPacingState.isPacingActive);
  const isChaos = Boolean(chaosMonkeyService?.config?.enabled);

  // Fast-path: plain pass-through when neither pacing nor chaos is active
  if (!isPacing && !isChaos) {
    sourceStream.pipe(res);
    return;
  }

  let currentStream = sourceStream;
  let pacer = null;
  let chaosTransform = null;

  // Synchronously attach non-crashing error handlers to socket and response
  if (res.socket && !res.socket._hasStreamErrorHandler) {
    res.socket._hasStreamErrorHandler = true;
    res.socket.on("error", () => {});
  }
  if (!res._hasStreamErrorHandler) {
    res._hasStreamErrorHandler = true;
    res.on("error", () => {});
  }

  // 1. Wire Chaos Monkey Transform if enabled
  if (isChaos) {
    chaosTransform = createChaosStreamTransform(
      {
        res,
        socket: res.socket,
      },
      chaosMonkeyService
    );

    chaosTransform.on("error", (err) => {
      try { sourceStream.destroy(err); } catch {}
      try { res.destroy(err); } catch {}
    });

    currentStream = currentStream.pipe(chaosTransform);
  }

  // 2. Wire Console Gaming QoS Pacer if active
  if (isPacing) {
    if (!res.headersSent) {
      res.setHeader("X-ReelOS-Chunk-Pacing", "active");
      res.setHeader("X-ReelOS-Bitrate-Stepdown", "50%");
      res.setHeader("X-ReelOS-QoS-Yield", "console-gaming");
    }
    pacer = createPacedChunkStream(streamPacingState.pacingDelayMs, streamPacingState.pacingChunkSize);

    pacer.on("error", (err) => {
      try { sourceStream.destroy(err); } catch {}
      try { if (chaosTransform && !chaosTransform.destroyed) chaosTransform.destroy(err); } catch {}
      try { res.destroy(err); } catch {}
    });

    currentStream = currentStream.pipe(pacer);
  }

  // 3. Centralized Teardown on Client Disconnect
  const cleanup = () => {
    try { if (chaosTransform && !chaosTransform.destroyed) chaosTransform.destroy(); } catch {}
    try { if (pacer && !pacer.destroyed) pacer.destroy(); } catch {}
    try { if (sourceStream && !sourceStream.destroyed) sourceStream.destroy(); } catch {}
  };

  res.on("close", cleanup);
  currentStream.pipe(res);
}


/**
 * Parses an HTTP Range header into { start, end } byte offsets.
 * Supports "bytes=0-1024", "bytes=1024-", and "bytes=-500".
 * @param {string} rangeHeader
 * @param {number} totalSize
 * @returns {{ start: number, end: number, chunkSize: number } | null | "unsatisfiable"}
 */
export function parseRangeHeader(rangeHeader, totalSize) {
  if (!rangeHeader || typeof rangeHeader !== "string") return null;
  const match = rangeHeader.trim().match(/^bytes=(\d*)-(\d*)$/i);
  if (!match) return null;

  let [, startStr, endStr] = match;
  let start = startStr ? parseInt(startStr, 10) : NaN;
  let end = endStr ? parseInt(endStr, 10) : NaN;

  if (isNaN(start) && isNaN(end)) return null;

  if (totalSize <= 0) return "unsatisfiable";

  if (isNaN(start)) {
    // Suffix range: bytes=-500 means last 500 bytes
    start = Math.max(0, totalSize - end);
    end = totalSize - 1;
  } else if (isNaN(end)) {
    // Open range: bytes=1000-
    end = totalSize - 1;
  } else if (end >= totalSize) {
    // RFC 7233 Section 2.1: clamp last-byte-pos if greater than representation length
    end = totalSize - 1;
  }

  // Validate bounds
  if (start >= totalSize || start > end || start < 0) {
    return "unsatisfiable";
  }

  return {
    start,
    end,
    chunkSize: end - start + 1,
  };
}

/**
 * Streams a local file with complete HTTP Range (206) support.
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 * @param {string} filePath
 * @param {string} [customContentType]
 */
function playbackReadStream(filePath, options) {
  const release = beginPreparationBlockingStream();
  try {
    const stream = createReadStream(filePath, options);
    stream.once("close", release);
    stream.once("error", release);
    return stream;
  } catch (error) { release(); throw error; }
}

// Prepared files carry a verification receipt. Never validate a path and then
// reopen it for streaming: bind verification and bytes to one owned descriptor.
function streamVerifiedPreparedFile(req, res, filePath, customContentType, guard) {
  let fd;
  const close = () => {
    if (fd !== undefined) { const owned = fd; fd = undefined; fs.closeSync(owned); }
  };
  const deny = () => {
    res.statusCode = 409;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "private, no-store");
    res.end(JSON.stringify({ ok: false, code: "prepared_file_changed", error: "The prepared copy could not be verified. Refresh preparation before playing it." }));
  };
  let stat;
  try {
    const expected = guard?.expectedFingerprint;
    const keys = ["dev", "ino", "size", "mtimeNs", "ctimeNs"];
    if (!expected || typeof expected !== "object" || Array.isArray(expected)
      || Object.keys(expected).length !== keys.length || keys.some((key) => !Object.hasOwn(expected, key)
        || typeof expected[key] !== "string" || !(key.endsWith("Ns") ? /^-?\d+$/ : /^\d+$/).test(expected[key]))) throw new Error("Invalid receipt");
    // lstat also rejects leaf links on Windows, where O_NOFOLLOW may be absent.
    if (fs.lstatSync(filePath).isSymbolicLink()) throw new Error("Linked file");
    fd = fs.openSync(filePath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    stat = fs.fstatSync(fd, { bigint: true });
    const leaf = fs.lstatSync(filePath, { bigint: true });
    if (!stat.isFile() || stat.nlink !== 1n || leaf.isSymbolicLink()
      || keys.some((key) => String(stat[key]) !== expected[key] || leaf[key] !== stat[key])
      || stat.size <= 0n || stat.size > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Changed file");
  } catch {
    try { close(); } catch { /* The descriptor is never reused. */ }
    deny(); return;
  }
  let stream;
  let release;
  try {
    const totalSize = Number(stat.size);
    const range = parseRangeHeader(req.headers.range, totalSize);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, no-store");
    if (range === "unsatisfiable") {
      res.statusCode = 416;
      res.setHeader("Content-Range", `bytes */${totalSize}`);
      close(); res.end(); return;
    }
    res.statusCode = range ? 206 : 200;
    res.setHeader("Content-Type", customContentType || "video/mp4");
    res.setHeader("Content-Length", range ? range.chunkSize : totalSize);
    res.setHeader("X-ReelOS-DirectPlay", "true");
    res.setHeader("X-ReelOS-ZeroTranscode", "100%");
    if (range) res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${totalSize}`);
    if ((req.method || "GET").toUpperCase() === "HEAD") { close(); res.end(); return; }
    release = beginPreparationBlockingStream();
    stream = fs.createReadStream(filePath, { fd, autoClose: true, ...(range ? { start: range.start, end: range.end } : {}) });
    fd = undefined; // The stream exclusively owns and closes this descriptor.
    stream.once("close", () => { release(); req.off("aborted", cleanup); res.off("close", cleanup); res.off("error", cleanup); });
    stream.on("error", () => {
      if (!res.headersSent) {
        res.removeHeader?.("Content-Length"); res.removeHeader?.("Content-Range");
        res.statusCode = 503; res.end();
      } else res.destroy();
    });
    const cleanup = () => stream.destroy();
    req.once("aborted", cleanup);
    res.once("close", cleanup);
    res.once("error", cleanup);
    if (req.aborted || res.destroyed) { cleanup(); return; }
    pipeStreamWithPacing(stream, res);
  } catch {
    if (stream) stream.destroy();
    else { try { close(); } catch {} release?.(); }
    if (!res.headersSent) {
      res.removeHeader?.("Content-Length"); res.removeHeader?.("Content-Range");
      res.statusCode = 503; res.end();
    } else res.destroy();
  }
}

export function streamLocalFile(req, res, filePath, customContentType = null, guard = undefined) {
  if (arguments.length >= 5) return streamVerifiedPreparedFile(req, res, filePath, customContentType, guard);
  if (!existsSync(filePath)) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Media file not found", path: filePath }));
    return;
  }

  let stat;
  try {
    stat = statSync(filePath);
    if (!stat.isFile()) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Media target is not a regular file", path: filePath }));
      return;
    }
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Failed to stat file", details: err.message }));
    return;
  }

  const totalSize = stat.size;
  const mimeType = customContentType || VIDEO_MIME[extname(filePath).toLowerCase()] || "video/mp4";
  const rangeHeader = req.headers.range;

  // Set DirectPlay & zero-transcode indicator headers
  res.setHeader("X-ReelOS-DirectPlay", "true");
  res.setHeader("X-ReelOS-ZeroTranscode", "100%");
  res.setHeader("Accept-Ranges", "bytes");

  if (rangeHeader) {
    const range = parseRangeHeader(rangeHeader, totalSize);
    if (range === "unsatisfiable") {
      res.statusCode = 416;
      res.setHeader("Content-Range", `bytes */${totalSize}`);
      res.end();
      return;
    }

    if (range) {
      const { start, end, chunkSize } = range;
      res.statusCode = 206;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
      res.setHeader("Content-Length", chunkSize);
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Cache-Control", "private, no-store");

      if (req.method === "HEAD") {
        res.end();
        return;
      }

      const stream = playbackReadStream(filePath, { start, end });
      stream.on("error", (err) => {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end();
        } else {
          res.destroy();
        }
      });
      const cleanup = () => stream.destroy();
      req.on("aborted", cleanup);
      res.on("close", cleanup);
      pipeStreamWithPacing(stream, res);
      return;
    }
  }

  // Full file streaming (HTTP 200)
  res.statusCode = 200;
  res.setHeader("Content-Length", totalSize);
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Cache-Control", "private, no-store");

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  const stream = playbackReadStream(filePath);
  stream.on("error", (err) => {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end();
    } else {
      res.destroy();
    }
  });
  const cleanup = () => stream.destroy();
  req.on("aborted", cleanup);
  res.on("close", cleanup);
  pipeStreamWithPacing(stream, res);
}


/**
 * Proxies a remote stream directly to the client with Range forwarding.
 * Provider mode checks every HTTPS destination and pins the validated DNS address
 * for the socket connection; generic personal/public routes keep their own policy.
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 * @param {string} remoteUrl
 * @param {number} [maxRedirects]
 * @param {Object} [options]
 */
export function proxyRemoteStream(req, res, remoteUrl, maxRedirects = 5, options = {}) {
  const release = (req.method || "GET").toUpperCase() === "HEAD" ? () => {} : beginPreparationBlockingStream();
  const active = new Set();
  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    for (const stream of active) stream.destroy();
    active.clear();
    req.off("aborted", cleanup);
    res.off("close", cleanup);
    res.off("error", cleanup);
    release();
  };
  req.once("aborted", cleanup);
  res.once("close", cleanup);
  res.once("error", cleanup);
  const fail = (err) => {
    if (closed) return;
    cleanup();
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Remote debrid streaming error", details: err.message }));
    } else res.destroy();
  };
  const lifecycle = { active, cleanup, fail, isClosed: () => closed };
  const redirectLimit = options.remotePolicy === "provider"
    ? (Number.isInteger(maxRedirects) ? Math.max(0, Math.min(5, maxRedirects)) : 5)
    : maxRedirects;
  void proxyRemoteStreamHop(req, res, remoteUrl, redirectLimit, lifecycle, options).catch(fail);
}

async function proxyRemoteStreamHop(req, res, remoteUrl, maxRedirects, lifecycle, options) {
  if (lifecycle.isClosed()) return;
  if (maxRedirects < 0) {
    lifecycle.cleanup();
    if (!res.headersSent) {
      res.statusCode = 508;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Too many redirects from remote stream upstream" }));
    }
    return;
  }

  let urlObj;
  try {
    urlObj = new URL(remoteUrl);
  } catch (err) {
    lifecycle.cleanup();
    if (!res.headersSent) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Invalid stream URL", details: err.message }));
    }
    return;
  }

  let pinnedLookup;
  if (options.remotePolicy === "provider") {
    const destination = await providerDestination(remoteUrl, options);
    pinnedLookup = destination.lookup;
    if (lifecycle.isClosed()) return;
    if (options.providerAuthorize && options.providerAuthorize() !== true) {
      throw new Error("Provider playback authority changed.");
    }
  }
  const isHttps = urlObj.protocol === "https:";
  const client = isHttps ? { request: options.providerHttpsRequest || https.request } : http;

  const headers = {
    "User-Agent": "ReelOS/2.0 (NeuralStreamEngine)",
  };

  if (req.headers.range) {
    headers["Range"] = req.headers.range;
  }

  const method = (req.method || "GET").toUpperCase() === "HEAD" ? "HEAD" : "GET";

  const proxyReq = client.request(
    remoteUrl,
    {
      method,
      headers,
      ...(pinnedLookup ? { lookup: pinnedLookup, agent: false } : {}),
    },
    (upstreamRes) => {
      if (lifecycle.isClosed()) { upstreamRes.destroy(); return; }
      lifecycle.active.add(upstreamRes);
      upstreamRes.once("close", () => lifecycle.active.delete(upstreamRes));
      upstreamRes.once("error", lifecycle.fail);
      try {
      const statusCode = upstreamRes.statusCode || 200;

      // Follow HTTP 301, 302, 303, 307, 308 redirects automatically
      if ([301, 302, 303, 307, 308].includes(statusCode) && upstreamRes.headers.location) {
        const nextUrl = new URL(upstreamRes.headers.location, remoteUrl).href;
        upstreamRes.destroy();
        void proxyRemoteStreamHop(req, res, nextUrl, maxRedirects - 1, lifecycle, options).catch(lifecycle.fail);
        return;
      }

      res.statusCode = statusCode;

      // Forward relevant playback headers
      const passHeaders = [
        "content-type",
        "content-length",
        "content-range",
        "accept-ranges",
        "last-modified",
        "etag",
        "cache-control",
      ];

      for (const h of passHeaders) {
        const val = upstreamRes.headers[h];
        if (val) res.setHeader(h, val);
      }
      res.setHeader("Cache-Control", "private, no-store");

      res.setHeader("X-ReelOS-DirectPlay", "true");
      res.setHeader("X-ReelOS-ZeroTranscode", "100%");
      if (!res.hasHeader("Accept-Ranges")) {
        res.setHeader("Accept-Ranges", "bytes");
      }

      if (method === "HEAD") {
        upstreamRes.resume();
        res.end();
        lifecycle.cleanup();
        return;
      }

      if (statusCode === 416) {
        upstreamRes.destroy();
        res.end();
        lifecycle.cleanup();
        return;
      }

      pipeStreamWithPacing(upstreamRes, res);
      } catch (error) { lifecycle.fail(error); }
    }
  );

  lifecycle.active.add(proxyReq);
  proxyReq.once("close", () => lifecycle.active.delete(proxyReq));
  proxyReq.on("error", lifecycle.fail);
  if (lifecycle.isClosed()) proxyReq.destroy();
  else proxyReq.end();
}

/**
 * Resolves a sample MP4 video path bundled in the repository.
 * @returns {string|null}
 */
export function getSampleVideoPath(root = ROOT) {
  const candidates = [
    join(root, "public/reelos_teaser_45s.mp4"),
    join(root, "prebuilt/vercel-output/static/reelos_teaser_45s.mp4"),
    join(root, "public/reelos_what_if_45s.mp4"),
    join(root, "reelos_teaser_45s.mp4"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

/**
 * Handles /api/stream/* requests.
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 * @param {Object} [options]
 * @param {string} [options.root]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {string} [options.stateDir] Current household authority and source policy.
 * @param {Array<Object>} [options.libraryItems] Trusted server-adapter records only.
 * @returns {Promise<boolean>} true if the request was handled, false otherwise.
 */
export async function handleStreamRequest(req, res, options = {}) {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname !== "/api/stream" && !url.pathname.startsWith("/api/stream/")) return false;
  if (!["GET", "HEAD"].includes(req.method || "GET")) {
    res.setHeader("Allow", "GET, HEAD");
    return sendPlaybackFailure(res, { ok: false, status: 405, code: "method_not_allowed", error: "Use GET or HEAD for playback." });
  }
  const identity = playbackIdentity(req, options);
  if (!identity.ok) return sendPlaybackFailure(res, identity);
  const target = url.pathname.replace(/^\/api\/stream\/?/, "").replace(/\/+$/, "");
  if (!target) return sendPlaybackFailure(res, { ok: false, status: 400, error: "Missing stream target." });

  let item;
  let publicUrl;
  if (target === "sample" || target === "sample.mp4") {
    item = { id: "reelos-verified-sample", title: "ReelOS diagnostic sample", sourceKind: "public_domain", path: getSampleVideoPath(options.root || ROOT) };
  } else if (target.startsWith("item/")) {
    item = resolvePlaybackItem({ kind: "item", value: target.slice("item/".length) }, options);
  } else if (target.startsWith("public/")) {
    const known = SAMPLE_MOVIES.find((movie) => movie.id === target.slice("public/".length));
    if (known) {
      item = { ...known, sourceKind: "public_domain" };
      publicUrl = known.streamUrl;
    }
  } else {
    const parts = target.split("/");
    const hash = parts[0].replace(/\.(mp4|mkv|webm|mov|ts|m4v|avi)$/i, "").toLowerCase();
    if (!/^(?:[a-f0-9]{40}|[a-z2-7]{32}|\d+)$/i.test(hash)) {
      return sendPlaybackFailure(res, { ok: false, status: 404, code: "playback_source_unmapped", error: "No verified media source is mapped to this title." });
    }
    item = resolvePlaybackItem({ kind: "hash", value: hash }, options);
    const requestedFile = parts[1] || url.searchParams.get("file_id");
    if (parts.length > 2 || (requestedFile && String(item?.source?.fileId ?? item?.providerFileId ?? "") !== requestedFile)) {
      return sendPlaybackFailure(res, { ok: false, status: 404, code: "playback_source_unmapped", error: "No verified media source is mapped to this file." });
    }
  }
  const access = authorizePlaybackItem(req, item, options);
  if (!access.ok) return sendPlaybackFailure(res, access);
  const requestedFile = url.searchParams.get("file_id");
  if (requestedFile && String(item?.source?.fileId ?? item?.providerFileId ?? "") !== requestedFile) {
    return sendPlaybackFailure(res, { ok: false, status: 404, code: "playback_source_unmapped", error: "No verified media source is mapped to this file." });
  }
  const file = verifiedPlaybackFile(item);
  if (file && access.sourceKind !== "debrid") {
    streamLocalFile(req, res, file);
    return true;
  }
  if (!publicUrl && access.sourceKind === "public_domain" && /^https:\/\//i.test(String(item?.publicUrl || ""))) {
    publicUrl = item.publicUrl;
  }
  if (publicUrl) {
    proxyRemoteStream(req, res, publicUrl);
    return true;
  }

  // Hash-only RAM buffers and guessed disk filenames have no verified title/file
  // provenance. Do not serve them or redirect to unauthenticated relay nodes.
  const providerFileId = item?.source?.fileId ?? item?.providerFileId;
  const torrentId = item?.source?.torrentId ?? item?.torrentId;
  const hash = String(item?.infohash || item?.source?.infohash || "").toLowerCase();
  const policy = access.sourcePolicy;
  const providerScope = policy.accountScope || createHash("sha256").update(policy.apiKey || "").digest("hex");
  const assertCurrentProvider = () => {
    const currentItem = resolvePlaybackItem({ kind: "item", value: playbackItemId(item) }, options);
    const current = authorizePlaybackItem(req, currentItem, options);
    if (!current.ok || JSON.stringify(currentItem) !== JSON.stringify(item)
        || current.sourcePolicy.accountScope !== policy.accountScope
        || current.sourcePolicy.apiKey !== policy.apiKey || current.sourcePolicy.provider !== policy.provider
        || current.profile.id !== access.profile.id) throw new Error("Provider playback authority changed.");
  };
  if (access.sourceKind === "debrid" && policy.connected && policy.provider === "torbox"
      && providerFileId != null && torrentId != null && /^[A-Za-z0-9_-]+$/.test(String(torrentId))
      && /^[a-f0-9]{40}$/.test(hash) && playbackItemId(item)) {
    try {
      const fetchImpl = options.fetchImpl || globalThis.fetch;
      const { data } = await torBoxRateLimiter.executeRequest(`playback:${providerScope}:streamlink:${torrentId}`, () => {
        assertCurrentProvider();
        return fetchImpl(`https://api.torbox.app/v1/api/torrents/mylist?id=${encodeURIComponent(torrentId)}`, {
          headers: { Authorization: `Bearer ${policy.apiKey}` },
          signal: AbortSignal.timeout(5000),
        });
      }, { bypassCache: true });
      const raw = data?.data || data;
      const torrents = Array.isArray(raw) ? raw : [raw];
      const matches = torrents.filter((torrent) => String(torrent?.id ?? "") === String(torrentId)
        && String(torrent?.hash || "").toLowerCase() === hash);
      const torrent = matches.length === 1 ? matches[0] : null;
      const files = torrent?.files?.filter((entry) => String(entry.id) === String(providerFileId)) || [];
      const providerState = String(torrent?.download_state || "").toLowerCase();
      const expectedSize = item?.source?.sizeBytes;
      const sizeMatches = expectedSize == null || (Number.isSafeInteger(expectedSize) && expectedSize > 0
        && Number(files[0]?.size) === expectedSize);
      if (files.length === 1 && sizeMatches && PROVIDER_READY_STATES.has(providerState) && providerEpisodeMatches(item, files[0])) {
        const itemSelector = { kind: "item", value: playbackItemId(item) };
        const freshItem = resolvePlaybackItem(itemSelector, options);
        const current = authorizePlaybackItem(req, freshItem, options);
        if (!current.ok) return sendPlaybackFailure(res, current);
        if (JSON.stringify(freshItem) !== JSON.stringify(item) || current.sourcePolicy.apiKey !== policy.apiKey
            || current.sourcePolicy.accountScope !== policy.accountScope
            || current.sourcePolicy.provider !== policy.provider || current.profile.id !== access.profile.id) {
          return sendPlaybackFailure(res, { ok: false, status: 403, code: "playback_source_changed", error: "The playback source changed. Start playback again." });
        }
        const download = await torBoxRateLimiter.executeRequest(`playback:${providerScope}:reqdl:${torrent.id}:${providerFileId}`, () => {
          assertCurrentProvider();
          return fetchImpl(`https://api.torbox.app/v1/api/torrents/requestdl?token=${encodeURIComponent(policy.apiKey)}&torrent_id=${encodeURIComponent(torrent.id)}&file_id=${encodeURIComponent(providerFileId)}&redirect=false`, {
            headers: { Authorization: `Bearer ${policy.apiKey}` },
            signal: AbortSignal.timeout(5000),
          });
        }, { bypassCache: true });
        const value = download?.data;
        const streamUrl = typeof value?.data === "string" ? value.data : value?.data?.url || value?.data?.stream_url || (typeof value === "string" ? value : null);
        const latestItem = resolvePlaybackItem(itemSelector, options);
        const latest = authorizePlaybackItem(req, latestItem, options);
        if (!latest.ok) return sendPlaybackFailure(res, latest);
        if (JSON.stringify(latestItem) !== JSON.stringify(item) || latest.sourcePolicy.apiKey !== policy.apiKey
            || latest.sourcePolicy.accountScope !== policy.accountScope
            || latest.sourcePolicy.provider !== policy.provider || latest.profile.id !== access.profile.id) {
          return sendPlaybackFailure(res, { ok: false, status: 403, code: "playback_source_changed", error: "The playback source changed. Start playback again." });
        }
        if (streamUrl && /^https?:\/\//i.test(streamUrl)) {
          proxyRemoteStream(req, res, streamUrl, 5, {
            ...options.providerRemoteOptions,
            remotePolicy: "provider",
            providerSecret: policy.apiKey,
            providerAuthorize: () => { assertCurrentProvider(); return true; },
          });
          return true;
        }
      }
    } catch { /* A provider failure never grants access to an unbound cache. */ }
  }
  return sendPlaybackFailure(res, { ok: false, status: 404, code: "playback_source_unavailable", available: false, directPlayReady: false, error: "No verified local or remote media stream is available for this title." });
}
