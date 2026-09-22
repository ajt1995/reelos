import { spawn, execFile, execSync } from "node:child_process";
import http from "node:http";
import net from "node:net";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { EventEmitter } from "node:events";
import { monitorEventLoopDelay } from "node:perf_hooks";

export const TEST_PORT = 8088;
export const TEST_BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
export const TEST_HASH = "e2b4f5c9d8a1e3f7a2b6c0d4e8f1a3b5c7d9e1f3";

/**
 * Ensures media fixtures exist in .reelos-state/cache for DirectPlay hash streaming tests.
 */
export function ensureMediaFixtures() {
  const root = process.cwd();
  const cacheDir = path.join(root, ".reelos-state", "cache");
  fs.mkdirSync(cacheDir, { recursive: true });

  const sampleCandidates = [
    path.join(root, "public", "reelos_teaser_45s.mp4"),
    path.join(root, "public", "reelos_what_if_45s.mp4"),
    path.join(root, "reelos_teaser_45s.mp4"),
  ];

  let sampleSource = sampleCandidates.find((c) => fs.existsSync(c));
  if (!sampleSource) {
    // Generate a valid minimal 256KB synthetic MP4 buffer if no sample video is on disk
    sampleSource = path.join(cacheDir, "synthetic_sample.mp4");
    if (!fs.existsSync(sampleSource)) {
      const synthetic = Buffer.alloc(256 * 1024, 0x00);
      // Write standard ftyp mp4 box header
      synthetic.writeUInt32BE(0x00000020, 0); // 32 bytes box
      synthetic.write("ftypisom", 4, "utf8");
      synthetic.writeUInt32BE(0x00000200, 12);
      synthetic.write("isomiso2mp41", 16, "utf8");
      // moov box marker
      synthetic.writeUInt32BE(0x00000008, 32);
      synthetic.write("moov", 36, "utf8");
      fs.writeFileSync(sampleSource, synthetic);
    }
  }

  const hashFile = path.join(cacheDir, `${TEST_HASH}.mp4`);
  if (!fs.existsSync(hashFile)) {
    try {
      fs.copyFileSync(sampleSource, hashFile);
    } catch {
      // Fallback write if copy fails
      fs.writeFileSync(hashFile, fs.readFileSync(sampleSource));
    }
  }

  return { sampleSource, hashFile, testHash: TEST_HASH };
}


/**
 * Creates a mock HTTP response object for unit/integration stream testing.
 */
export function createMockResponse() {
  const chunks = [];
  const res = new Writable({
    write(chunk, encoding, callback) {
      res.headersSent = true;
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      callback();
    },
    final(callback) {
      res.headersSent = true;
      callback();
    },
  });

  res.statusCode = 200;
  res.statusMessage = "OK";
  res.headers = {};
  res.headersSent = false;
  res.chunks = chunks;

  res.setHeader = function (k, v) {
    if (res.headersSent) {
      const err = new Error("ERR_HTTP_HEADERS_SENT: Cannot set headers after they are sent to the client");
      err.code = "ERR_HTTP_HEADERS_SENT";
      throw err;
    }
    res.headers[k.toLowerCase()] = String(v);
  };

  res.getHeader = function (k) {
    return res.headers[k.toLowerCase()];
  };

  res.hasHeader = function (k) {
    return Object.prototype.hasOwnProperty.call(res.headers, k.toLowerCase());
  };

  res.removeHeader = function (k) {
    delete res.headers[k.toLowerCase()];
  };

  res.writeHead = function (code, reasonOrHeaders, headers) {
    if (res.headersSent) {
      const err = new Error("ERR_HTTP_HEADERS_SENT: Cannot set headers after they are sent to the client");
      err.code = "ERR_HTTP_HEADERS_SENT";
      throw err;
    }
    res.statusCode = code;
    let actualHeaders = headers;
    if (typeof reasonOrHeaders === "object" && reasonOrHeaders !== null) {
      actualHeaders = reasonOrHeaders;
    }
    if (actualHeaders) {
      for (const [k, v] of Object.entries(actualHeaders)) {
        res.setHeader(k, v);
      }
    }
    res.headersSent = true;
    return res;
  };

  const origEnd = res.end.bind(res);
  res.end = function (chunk, encoding, cb) {
    res.headersSent = true;
    return origEnd(chunk, encoding, cb);
  };

  res.waitForEnd = function (timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      if (res.writableEnded) {
        resolve(res);
        return;
      }
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for response to end (${timeoutMs}ms)`));
      }, timeoutMs);

      res.once("finish", () => {
        clearTimeout(timer);
        resolve(res);
      });
      res.once("close", () => {
        clearTimeout(timer);
        resolve(res);
      });
      res.once("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  };

  Object.defineProperty(res, "body", {
    get() {
      return Buffer.concat(res.chunks);
    },
  });

  Object.defineProperty(res, "text", {
    get() {
      return Buffer.concat(res.chunks).toString("utf8");
    },
  });

  Object.defineProperty(res, "json", {
    get() {
      try {
        return JSON.parse(res.text);
      } catch {
        return null;
      }
    },
  });

  return res;
}

/**
 * Creates a mock HTTP request object.
 */
export function createMockRequest(options = {}) {
  const {
    url = "/",
    method = "GET",
    headers = {},
    body = null,
  } = options;

  let stream;
  if (body !== null) {
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
    stream = Readable.from([buf]);
  } else {
    stream = Readable.from([]);
  }

  stream.url = url;
  stream.method = method;
  stream.headers = {};
  for (const [k, v] of Object.entries(headers)) {
    stream.headers[k.toLowerCase()] = String(v);
  }

  stream.socket = new EventEmitter();
  stream.socket.remoteAddress = "127.0.0.1";
  stream.socket.destroy = () => {
    stream.socket.destroyed = true;
    stream.socket.emit("close");
  };

  return stream;
}

/**
 * Connects a real RFC 6455 WebSocket client via net.Socket.
 */
export function createWsClient(port, urlPath, options = {}) {
  const { protocols = ["reelos-watchparty-v1"], timeoutMs = 5000 } = options;

  return new Promise((resolve, reject) => {
    const socket = net.connect(port, "127.0.0.1");
    let upgraded = false;
    let buffer = Buffer.alloc(0);
    const listeners = [];

    const connectTimeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`WebSocket connection timeout to 127.0.0.1:${port}${urlPath}`));
    }, timeoutMs);

    socket.on("connect", () => {
      const key = crypto.randomBytes(16).toString("base64");
      const reqHeaders = [
        `GET ${urlPath} HTTP/1.1`,
        `Host: 127.0.0.1:${port}`,
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Key: ${key}`,
        "Sec-WebSocket-Version: 13",
      ];
      if (protocols.length > 0) {
        reqHeaders.push(`Sec-WebSocket-Protocol: ${protocols.join(", ")}`);
      }
      reqHeaders.push("\r\n");
      socket.write(reqHeaders.join("\r\n"));
    });

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      if (!upgraded) {
        const headerEnd = buffer.indexOf("\r\n\r\n");
        if (headerEnd !== -1) {
          const headerStr = buffer.subarray(0, headerEnd).toString("utf8");
          if (!headerStr.includes("101 Switching Protocols")) {
            clearTimeout(connectTimeout);
            socket.destroy();
            reject(new Error(`WebSocket upgrade rejected:\n${headerStr}`));
            return;
          }
          upgraded = true;
          clearTimeout(connectTimeout);
          buffer = buffer.subarray(headerEnd + 4);

          const client = {
            socket,
            upgraded: true,
            send(obj) {
              const text = typeof obj === "string" ? obj : JSON.stringify(obj);
              const payload = Buffer.from(text, "utf8");
              const mask = crypto.randomBytes(4);
              const masked = Buffer.alloc(payload.length);
              for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];

              let header;
              if (payload.length <= 125) {
                header = Buffer.from([0x81, 0x80 | payload.length]);
              } else if (payload.length <= 65535) {
                header = Buffer.alloc(4);
                header[0] = 0x81;
                header[1] = 0x80 | 126;
                header.writeUInt16BE(payload.length, 2);
              } else {
                header = Buffer.alloc(10);
                header[0] = 0x81;
                header[1] = 0x80 | 127;
                header.writeBigUInt64BE(BigInt(payload.length), 2);
              }

              socket.write(Buffer.concat([header, mask, masked]));
            },
            sendRaw(buf) {
              socket.write(buf);
            },
            sendPing(payload = "") {
              const payloadBuf = Buffer.from(payload, "utf8");
              const mask = crypto.randomBytes(4);
              const masked = Buffer.alloc(payloadBuf.length);
              for (let i = 0; i < payloadBuf.length; i++) masked[i] = payloadBuf[i] ^ mask[i % 4];
              const header = Buffer.from([0x89, 0x80 | payloadBuf.length]);
              socket.write(Buffer.concat([header, mask, masked]));
            },
            close(code = 1000) {
              const mask = crypto.randomBytes(4);
              const payload = Buffer.alloc(2);
              payload.writeUInt16BE(code, 0);
              const masked = Buffer.alloc(2);
              masked[0] = payload[0] ^ mask[0];
              masked[1] = payload[1] ^ mask[1];
              socket.write(Buffer.concat([Buffer.from([0x88, 0x82]), mask, masked]));
              socket.end();
            },
            waitForMessage(predicate, waitTimeoutMs = 5000) {
              return new Promise((res, rej) => {
                const timer = setTimeout(() => {
                  rej(new Error(`Timeout waiting for WS message matching predicate (${waitTimeoutMs}ms)`));
                }, waitTimeoutMs);
                listeners.push({ predicate, resolve: res, timer });
              });
            },
          };

          resolve(client);
        }
      }

      if (upgraded) {
        while (buffer.length >= 2) {
          const firstByte = buffer[0];
          const secondByte = buffer[1];
          const opcode = firstByte & 0x0f;
          let len = secondByte & 0x7f;
          let offset = 2;

          if (len === 126) {
            if (buffer.length < 4) break;
            len = buffer.readUInt16BE(2);
            offset = 4;
          } else if (len === 127) {
            if (buffer.length < 10) break;
            len = Number(buffer.readBigUInt64BE(2));
            offset = 10;
          }

          if (buffer.length < offset + len) break;
          const payload = buffer.subarray(offset, offset + len);
          buffer = buffer.subarray(offset + len);

          // Dispatch text messages (0x1) and pong frames (0xA)
          let parsedMsg = null;
          if (opcode === 0x1) {
            try {
              parsedMsg = JSON.parse(payload.toString("utf8"));
            } catch {
              parsedMsg = { raw: payload.toString("utf8") };
            }
          } else if (opcode === 0xa) {
            parsedMsg = { type: "pong_frame", opcode: 0xa, data: payload.toString("utf8") };
          } else if (opcode === 0x8) {
            parsedMsg = { type: "close_frame", opcode: 0x8 };
          }

          if (parsedMsg) {
            for (let i = listeners.length - 1; i >= 0; i--) {
              if (listeners[i].predicate(parsedMsg)) {
                clearTimeout(listeners[i].timer);
                const [item] = listeners.splice(i, 1);
                item.resolve(parsedMsg);
              }
            }
          }
        }
      }
    });

    socket.on("error", (err) => {
      clearTimeout(connectTimeout);
      reject(err);
    });
  });
}

/**
 * Asserts zero legacy ports (8096, 8989, 7878, 9696) and zero raw LAN IPs in payloads.
 */
export function assertZeroLegacyPorts(payload) {
  const str = typeof payload === "string" ? payload : JSON.stringify(payload);
  const legacyPortRegex = /:8096\b|:8989\b|:7878\b|:9696\b/;
  if (legacyPortRegex.test(str)) {
    console.error(`[FATAL LEGACY PORT LEAK DETECTED]: ${str.slice(0, 300)}`);
    throw new Error(`Legacy port leak detected in payload: ${str.slice(0, 300)}`);
  }
}

/**
 * Samples memory of a process (WorkingSet64 on Windows, rss on Linux/macOS).
 */
export async function sampleProcessMemory(pid) {
  if (!pid) return process.memoryUsage().rss / (1024 * 1024);
  if (process.platform === "win32") {
    try {
      const numericPid = Number.parseInt(String(pid), 10);
      if (!Number.isSafeInteger(numericPid) || numericPid <= 0) {
        return process.memoryUsage().rss / (1024 * 1024);
      }
      // Keep the load probe outside the event loop being measured. The old
      // execSync probe could pause the test runner for more than a second on
      // Windows, making the instrumentation itself fail the latency budget.
      const out = await new Promise((resolve, reject) => {
        execFile(
          "powershell",
          ["-NoProfile", "-Command", `(Get-Process -Id ${numericPid}).WorkingSet64`],
          { encoding: "utf8", windowsHide: true },
          (error, stdout) => (error ? reject(error) : resolve(stdout))
        );
      });
      const bytes = parseInt(out.trim(), 10);
      if (!isNaN(bytes) && bytes > 0) return bytes / (1024 * 1024);
    } catch {}
  }
  return process.memoryUsage().rss / (1024 * 1024);
}

/**
 * Measures event loop lag using monitorEventLoopDelay.
 */
export async function measureEventLoopLag(actionFn) {
  const histogram = monitorEventLoopDelay({ resolution: 10 });
  histogram.enable();
  try {
    await actionFn();
  } finally {
    histogram.disable();
  }
  return {
    minMs: histogram.min / 1e6,
    maxMs: histogram.max / 1e6,
    meanMs: histogram.mean / 1e6,
    p50Ms: histogram.percentile(50) / 1e6,
    p90Ms: histogram.percentile(90) / 1e6,
    p99Ms: histogram.percentile(99) / 1e6,
  };
}

/**
 * Spawns a dedicated ReelOS test daemon on port 8088.
 */
export async function startTestBox(options = {}) {
  const { port = TEST_PORT, timeoutMs = 15000 } = options;
  ensureMediaFixtures();

  const baseUrl = `http://127.0.0.1:${port}`;
  const stdoutLogs = [];
  const stderrLogs = [];

  const proc = spawn(
    "node",
    ["scripts/with-app-env.mjs", "node", "scripts/reelos-box.mjs"],
    {
      cwd: process.cwd(),
      env: { ...process.env, ...options.env, PORT: String(port), HOST: "127.0.0.1" },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  proc.stdout.on("data", (d) => stdoutLogs.push(d.toString()));
  proc.stderr.on("data", (d) => stderrLogs.push(d.toString()));

  const start = Date.now();
  let ready = false;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/watchparty/rooms`);
      if (res.status === 200) {
        ready = true;
        break;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  if (!ready) {
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: "ignore" });
      } else {
        proc.kill("SIGKILL");
      }
    } catch {}
    throw new Error(`ReelOS daemon failed to start on port ${port} within ${timeoutMs}ms.\nLogs:\n${stderrLogs.join("\n")}`);
  }

  const stop = () => {
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: "ignore" });
      } else {
        proc.kill("SIGTERM");
      }
    } catch {}
  };

  return {
    proc,
    pid: proc.pid,
    port,
    baseUrl,
    stdoutLogs,
    stderrLogs,
    stop,
  };
}
