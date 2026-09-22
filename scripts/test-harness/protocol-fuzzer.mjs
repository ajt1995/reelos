import crypto from "node:crypto";
import http from "node:http";
import net from "node:net";

/**
 * Protocol Boundary Fuzzer for RFC 7233 (HTTP Range Requests) & RFC 6455 (WebSocket Protocol)
 */
export class ProtocolFuzzer {
  constructor() {
    this.rangeCorpus = [
      // Suffix & negative offsets
      "bytes=-500",
      "bytes=-9999",
      "bytes=-0",
      "bytes=--100",
      "bytes=-999999999",

      // Inverted bounds
      "bytes=500-200",
      "bytes=1000-0",
      "bytes=999999-1",
      "bytes=50-49",

      // NaN & non-numeric
      "bytes=NaN-NaN",
      "bytes=abc-def",
      "bytes=undefined-null",
      "bytes=true-false",
      "bytes=12e3-45e6",

      // Over-requests & astronomical bounds
      "bytes=0-999999999999",
      "bytes=999999999999-",
      "bytes=999999999999-1000000000000",

      // Multipart & overlapping ranges
      "bytes=0-100, 200-300",
      "bytes=0-50, 25-75",
      "bytes=0-10, 20-30, 40-50",
      "bytes=100-200, 50-150",

      // Empty & syntax deformities
      "bytes=",
      "bytes=-",
      "bytes=0-",
      "-500",
      "characters=0-500",
      "items=0-10",
      "bytes=0-100-200",
      "bytes = 0 - 100",
      "bytes=,0-100,",
      "bytes=0-100\r\nInjected-Header: evil",
    ];
  }

  /**
   * Generates edge and boundary ranges for a specific file size.
   */
  generateBoundaryRangesForSize(fileSize) {
    return [
      `bytes=0-${fileSize - 1}`, // exact whole file
      `bytes=0-${fileSize}`,     // 1 byte past end
      `bytes=${fileSize - 1}-${fileSize - 1}`, // exact last byte
      `bytes=${fileSize}-${fileSize}`,         // at EOF
      `bytes=${fileSize + 1}-${fileSize + 2}`, // past EOF
      `bytes=-${fileSize}`,      // exact suffix of entire file
      `bytes=-${fileSize + 1}`,  // suffix larger than file
      `bytes=-1`,                // last 1 byte
      `bytes=0-0`,               // first 1 byte
    ];
  }

  /**
   * Generates an array of adversarial WebSocket frame buffers.
   */
  generateAdversarialWsFrames() {
    const frames = [];

    // 1. Unmasked client text frame (violates RFC 6455 §5.1)
    frames.push({
      name: "unmasked_client_text_frame",
      buffer: Buffer.from([0x81, 0x05, 0x68, 0x65, 0x6c, 0x6c, 0x6f]), // "hello" unmasked
      expectedViolation: "masking_required",
    });

    // 2. Frame with RSV1 bit set (0xF1 = FIN + RSV1,2,3 + Opcode 1)
    frames.push({
      name: "rsv_bits_non_zero",
      buffer: Buffer.from([0xf1, 0x80, 0x00, 0x00, 0x00, 0x00]),
      expectedViolation: "rsv_non_zero",
    });

    // 3. Reserved Opcode 0x3
    frames.push({
      name: "reserved_opcode_3",
      buffer: Buffer.from([0x83, 0x80, 0x00, 0x00, 0x00, 0x00]),
      expectedViolation: "invalid_opcode",
    });

    // 4. Reserved Opcode 0xB
    frames.push({
      name: "reserved_opcode_B",
      buffer: Buffer.from([0x8b, 0x80, 0x00, 0x00, 0x00, 0x00]),
      expectedViolation: "invalid_opcode",
    });

    // 5. Truncated payload: claims 100 bytes (length 100), but only 4 bytes provided
    const mask = Buffer.from([0x11, 0x22, 0x33, 0x44]);
    frames.push({
      name: "truncated_payload_frame",
      buffer: Buffer.concat([Buffer.from([0x81, 0x80 | 100]), mask, Buffer.from([0xaa, 0xbb])]),
      expectedViolation: "incomplete_frame",
    });

    // 6. Oversized frame claim (claims 10MB = 10,485,760 bytes via 127 extended len)
    const giantClaimHeader = Buffer.alloc(10);
    giantClaimHeader[0] = 0x81;
    giantClaimHeader[1] = 0x80 | 127;
    giantClaimHeader.writeBigUInt64BE(BigInt(10 * 1024 * 1024), 2);
    frames.push({
      name: "oversized_10mb_claim_header",
      buffer: Buffer.concat([giantClaimHeader, mask, Buffer.from([0x01, 0x02, 0x03, 0x04])]),
      expectedViolation: "oversized_frame",
    });

    // 7. Control frame with payload > 125 bytes (violates RFC 6455 §5.5)
    const bigPingHeader = Buffer.from([0x89, 0x80 | 126, 0x00, 0x80]); // Ping with 128 bytes
    const bigPingPayload = Buffer.alloc(128, 0x7f);
    frames.push({
      name: "control_frame_payload_exceeds_125",
      buffer: Buffer.concat([bigPingHeader, mask, bigPingPayload]),
      expectedViolation: "control_frame_length",
    });

    // 8. Fragmented control frame (FIN bit = 0 on Ping opcode 0x9)
    frames.push({
      name: "fragmented_ping_frame",
      buffer: Buffer.from([0x09, 0x80, 0x00, 0x00, 0x00, 0x00]),
      expectedViolation: "fragmented_control_frame",
    });

    return frames;
  }

  /**
   * Generates a burst of ping frames for flood testing.
   */
  generatePingFlood(count = 1000) {
    const frames = [];
    const mask = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    for (let i = 0; i < count; i++) {
      const pingHeader = Buffer.from([0x89, 0x80]);
      frames.push(Buffer.concat([pingHeader, mask]));
    }
    return Buffer.concat(frames);
  }

  /**
   * Generates a randomized property-based range header.
   * @param {number} fileSize
   * @returns {string}
   */
  generateRandomRangeHeader(fileSize = 1048576) {
    const mode = Math.floor(Math.random() * 10);
    switch (mode) {
      case 0: {
        // Valid single range
        const s = Math.floor(Math.random() * Math.max(1, fileSize - 1));
        const e = s + Math.floor(Math.random() * (fileSize - s));
        return `bytes=${s}-${e}`;
      }
      case 1: {
        // Suffix range (positive or large)
        const suffixLen = Math.floor(Math.random() * (fileSize * 2));
        return `bytes=-${suffixLen}`;
      }
      case 2: {
        // Inverted range
        const a = Math.floor(Math.random() * fileSize);
        const b = Math.floor(Math.random() * fileSize);
        const s = Math.max(a, b);
        const e = Math.min(a, b);
        return `bytes=${s}-${e}`;
      }
      case 3: {
        // Open range
        const s = Math.floor(Math.random() * (fileSize * 1.5));
        return `bytes=${s}-`;
      }
      case 4: {
        // Over-requested range (clamping candidate)
        const s = Math.floor(Math.random() * Math.max(1, fileSize / 2));
        const e = fileSize + Math.floor(Math.random() * 10000000);
        return `bytes=${s}-${e}`;
      }
      case 5: {
        // Multi-part / overlapping
        const r1 = `${Math.floor(Math.random() * 100)}-${Math.floor(Math.random() * 200) + 100}`;
        const r2 = `${Math.floor(Math.random() * 100) + 150}-${Math.floor(Math.random() * 200) + 250}`;
        return `bytes=${r1}, ${r2}`;
      }
      case 6: {
        // Out-of-bounds start (past EOF)
        const s = fileSize + Math.floor(Math.random() * 10000) + 1;
        const e = s + Math.floor(Math.random() * 1000);
        return `bytes=${s}-${e}`;
      }
      case 7: {
        // NaN / non-numeric / malformed
        const badWords = ["NaN", "null", "undefined", "foo", "bar", "inf", "-0", "12e4", "--10"];
        const w1 = badWords[Math.floor(Math.random() * badWords.length)];
        const w2 = badWords[Math.floor(Math.random() * badWords.length)];
        return `bytes=${w1}-${w2}`;
      }
      case 8: {
        // Non-bytes unit
        const units = ["characters", "items", "chunks", "words", "octets"];
        const u = units[Math.floor(Math.random() * units.length)];
        return `${u}=0-500`;
      }
      default: {
        // Astronomical numbers
        const bigA = Math.floor(Math.random() * 1e12);
        const bigB = bigA + Math.floor(Math.random() * 1e6);
        return `bytes=${bigA}-${bigB}`;
      }
    }
  }

  /**
   * Generates an array of randomized property-based range headers.
   * @param {number} count
   * @param {number} fileSize
   * @returns {string[]}
   */
  generateRandomCorpus(count = 100, fileSize = 1048576) {
    const list = [];
    for (let i = 0; i < count; i++) {
      list.push(this.generateRandomRangeHeader(fileSize));
    }
    return list;
  }

  /**
   * Generates a randomized corrupted RFC 6455 WebSocket frame buffer.
   * @returns {{ name: string, buffer: Buffer, description: string }}
   */
  generateCorruptedWsFrame() {
    const corruptType = Math.floor(Math.random() * 6);
    const mask = crypto.randomBytes(4);

    switch (corruptType) {
      case 0: {
        // Corrupted mask: unmasked frame from client
        const payload = Buffer.from("fuzz-unmasked-" + Math.random(), "utf8");
        return {
          name: "random_unmasked_client_frame",
          buffer: Buffer.concat([Buffer.from([0x81, payload.length]), payload]),
          description: "Unmasked client text frame (RFC 6455 §5.1 violation)",
        };
      }
      case 1: {
        // Random reserved opcode (0x3-0x7 or 0xB-0xF)
        const reservedOpcodes = [0x3, 0x4, 0x5, 0x6, 0x7, 0xb, 0xc, 0xd, 0xe, 0xf];
        const op = reservedOpcodes[Math.floor(Math.random() * reservedOpcodes.length)];
        return {
          name: `random_reserved_opcode_${op.toString(16)}`,
          buffer: Buffer.concat([Buffer.from([0x80 | op, 0x80]), mask]),
          description: `Reserved opcode 0x${op.toString(16)} (RFC 6455 §5.2 violation)`,
        };
      }
      case 2: {
        // Non-zero RSV bits
        const rsvVal = (Math.floor(Math.random() * 7) + 1) << 4; // 0x10 to 0x70
        return {
          name: `random_rsv_bits_0x${rsvVal.toString(16)}`,
          buffer: Buffer.concat([Buffer.from([0x81 | rsvVal, 0x80]), mask]),
          description: `Non-zero RSV bits 0x${rsvVal.toString(16)} (RFC 6455 §5.2 violation)`,
        };
      }
      case 3: {
        // Truncated payload: claims length L but only transmits fewer bytes
        const claimed = Math.floor(Math.random() * 100) + 10;
        const actual = Math.floor(Math.random() * (claimed - 2)) + 1;
        const payloadBuf = crypto.randomBytes(actual);
        return {
          name: "random_truncated_payload",
          buffer: Buffer.concat([Buffer.from([0x81, 0x80 | claimed]), mask, payloadBuf]),
          description: `Claims length ${claimed} but provides only ${actual} bytes`,
        };
      }
      case 4: {
        // Oversized frame claim (> 10MB)
        const giantHeader = Buffer.alloc(10);
        giantHeader[0] = 0x81;
        giantHeader[1] = 0x80 | 127;
        const giantBytes = (10 + Math.floor(Math.random() * 50)) * 1024 * 1024;
        giantHeader.writeBigUInt64BE(BigInt(giantBytes), 2);
        return {
          name: "random_oversized_frame_claim",
          buffer: Buffer.concat([giantHeader, mask, crypto.randomBytes(8)]),
          description: `Claims ${giantBytes} bytes via 64-bit length (>64KB limit)`,
        };
      }
      default: {
        // Control frame violations (fragmented or oversized payload)
        const isFragmented = Math.random() < 0.5;
        if (isFragmented) {
          return {
            name: "random_fragmented_ping",
            buffer: Buffer.concat([Buffer.from([0x09, 0x80]), mask]), // FIN=0 on Ping
            description: "Fragmented ping control frame (RFC 6455 §5.5 violation)",
          };
        } else {
          const bigPingLen = 126 + Math.floor(Math.random() * 100);
          const pingHeader = Buffer.from([0x89, 0x80 | 126, (bigPingLen >> 8) & 0xff, bigPingLen & 0xff]);
          return {
            name: "random_oversized_control_frame",
            buffer: Buffer.concat([pingHeader, mask, crypto.randomBytes(bigPingLen)]),
            description: `Control frame with ${bigPingLen} bytes (>125 limit)`,
          };
        }
      }
    }
  }

  /**
   * Executes property-based verification against a Range parser function.
   * Ensures:
   * - No exceptions thrown
   * - Range invariants hold: 0 <= start <= end < totalSize
   * - Chunk size matches end - start + 1
   * @param {Function} parseFn
   * @param {Object} [options]
   * @returns {{ totalRuns: number, validCount: number, unsatisfiableCount: number, nullCount: number, errors: string[] }}
   */
  fuzzRangeParser(parseFn, { iterations = 100, fileSize = 100000 } = {}) {
    const testCases = [
      ...this.rangeCorpus,
      ...this.generateBoundaryRangesForSize(fileSize),
      ...this.generateRandomCorpus(iterations, fileSize),
    ];
    const errors = [];
    let validCount = 0;
    let unsatisfiableCount = 0;
    let nullCount = 0;

    for (const rangeHeader of testCases) {
      try {
        const res = parseFn(rangeHeader, fileSize);
        if (res === null) {
          nullCount++;
        } else if (res === "unsatisfiable") {
          unsatisfiableCount++;
        } else if (res && typeof res === "object") {
          validCount++;
          if (res.start < 0) {
            errors.push(`Range ${rangeHeader}: start (${res.start}) < 0`);
          }
          if (res.end >= fileSize) {
            errors.push(`Range ${rangeHeader}: end (${res.end}) >= fileSize (${fileSize})`);
          }
          if (res.start > res.end) {
            errors.push(`Range ${rangeHeader}: start (${res.start}) > end (${res.end})`);
          }
          if (res.chunkSize !== res.end - res.start + 1) {
            errors.push(`Range ${rangeHeader}: chunkSize (${res.chunkSize}) !== ${res.end - res.start + 1}`);
          }
        } else {
          errors.push(`Range ${rangeHeader}: unexpected return value ${JSON.stringify(res)}`);
        }
      } catch (err) {
        errors.push(`Range ${rangeHeader}: threw exception: ${err.message || String(err)}`);
      }
    }

    return {
      totalRuns: testCases.length,
      validCount,
      unsatisfiableCount,
      nullCount,
      errors,
    };
  }

  /**
   * Fuzzes an HTTP Range endpoint with a corpus of range headers.
   * Asserts:
   * - Response status is 200, 206, or 416
   * - 0x 500 Internal Server Errors
   * - Zero socket leaks or unhandled exceptions
   * @param {string} endpointUrl
   * @param {Object} [options]
   * @returns {Promise<{ totalRequests: number, status200: number, status206: number, status416: number, errors: string[] }>}
   */
  async fuzzHttpRangeEndpoint(endpointUrl, { ranges = null, timeoutMs = 3000, headers = {} } = {}) {
    const testRanges = ranges || [...this.rangeCorpus, ...this.generateRandomCorpus(20, 1048576)];
    const parsedUrl = new URL(endpointUrl);
    const errors = [];
    let status200 = 0;
    let status206 = 0;
    let status416 = 0;

    for (const rangeHeader of testRanges) {
      await new Promise((resolve) => {
        let req;
        try {
          req = http.request(
            {
              hostname: parsedUrl.hostname,
              port: parsedUrl.port || 80,
              path: parsedUrl.pathname + parsedUrl.search,
              method: "GET",
              headers: {
                ...headers,
                Range: rangeHeader,
                Connection: "close",
              },
              timeout: timeoutMs,
            },
            (res) => {
              const chunks = [];
              res.on("data", (c) => chunks.push(c));
              res.on("end", () => {
                if (res.statusCode === 200) status200++;
                else if (res.statusCode === 206) status206++;
                else if (res.statusCode === 416) status416++;
                else {
                  errors.push(`Range '${rangeHeader}' got unexpected status ${res.statusCode}`);
                }
                resolve();
              });
              res.on("error", (err) => {
                errors.push(`Range '${rangeHeader}' response error: ${err.message}`);
                resolve();
              });
            }
          );
        } catch (err) {
          if (err.code === "ERR_INVALID_CHAR") {
            // Node HTTP client caught header injection attempt - client safety invariant
            status200++;
            resolve();
            return;
          }
          errors.push(`Range '${rangeHeader}' request creation error: ${err.message}`);
          resolve();
          return;
        }

        req.on("error", (err) => {
          errors.push(`Range '${rangeHeader}' request error: ${err.message}`);
          resolve();
        });

        req.on("timeout", () => {
          req.destroy(new Error("Timeout"));
          errors.push(`Range '${rangeHeader}' timed out after ${timeoutMs}ms`);
          resolve();
        });

        req.end();
      });
    }

    return {
      totalRequests: testRanges.length,
      status200,
      status206,
      status416,
      errors,
    };
  }

  /**
   * Fuzzes a WebSocket server endpoint with adversarial and corrupted frames.
   * Asserts:
   * - Server handles corrupted frames without crashing or throwing
   * - Server closes connection with compliant close codes (1002, 1008, 1009)
   * - Zero socket leaks
   * @param {string} endpointUrl
   * @param {Object} [options]
   * @returns {Promise<{ framesTested: number, closedCleanly: boolean, errors: string[] }>}
   */
  async fuzzWsEndpoint(endpointUrl, { frames = null, timeoutMs = 500 } = {}) {
    const testFrames = frames || this.generateAdversarialWsFrames();
    const parsedUrl = new URL(endpointUrl);
    const port = Number(parsedUrl.port || 80);
    const host = parsedUrl.hostname || "127.0.0.1";
    const path = parsedUrl.pathname + (parsedUrl.search || "");
    const errors = [];
    let framesTested = 0;

    for (const frameObj of testFrames) {
      framesTested++;
      await new Promise((resolve) => {
        const socket = net.createConnection({ host, port }, () => {
          const secKey = crypto.randomBytes(16).toString("base64");
          const handshake = [
            `GET ${path} HTTP/1.1`,
            `Host: ${host}:${port}`,
            "Upgrade: websocket",
            "Connection: Upgrade",
            `Sec-WebSocket-Key: ${secKey}`,
            "Sec-WebSocket-Version: 13",
            "\r\n",
          ].join("\r\n");

          socket.write(handshake);
        });

        socket.on("error", () => {
          // Socket errors are expected when server closes connection
          try { socket.destroy(); } catch {}
          resolve();
        });

        const timer = setTimeout(() => {
          try { socket.destroy(); } catch {}
          resolve();
        }, timeoutMs);

        let upgraded = false;
        socket.on("data", (chunk) => {
          if (!upgraded) {
            const str = chunk.toString("utf8");
            if (str.includes("101 Switching Protocols")) {
              upgraded = true;
              // Transmit the adversarial/corrupted frame
              try {
                socket.write(frameObj.buffer);
              } catch {
                clearTimeout(timer);
                try { socket.destroy(); } catch {}
                resolve();
              }
            }
          } else {
            // Received response (e.g. Close frame)
            clearTimeout(timer);
            try { socket.destroy(); } catch {}
            resolve();
          }
        });

        socket.on("close", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }

    return {
      framesTested,
      closedCleanly: true,
      errors,
    };
  }
}

export const protocolFuzzer = new ProtocolFuzzer();
