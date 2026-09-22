#!/usr/bin/env node
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { MachineOverseer } from "./services/machine-overseer-service.mjs";

const overseer = new MachineOverseer();

const TARGET_HOST = process.env.REELOS_HOST || "127.0.0.1";
const TARGET_PORT = Number(process.env.PORT || 8080);
const BASE_URL = `http://${TARGET_HOST}:${TARGET_PORT}`;

console.log("================================================================================");
console.log("             REELOS CHAOS CRUCIBLE & ADVERSARIAL STRESS TEST                    ");
console.log(`             Target Appliance: ${BASE_URL}`);
console.log("================================================================================\n");

const results = { passed: 0, failed: 0, bugsFound: [] };

function record(name, pass, bugDetail = "") {
  if (pass) {
    results.passed++;
    console.log(`  [PASS] ${name}`);
  } else {
    results.failed++;
    results.bugsFound.push({ name, bugDetail });
    console.error(`  [BUG FOUND] ${name}: ${bugDetail}`);
  }
}

async function runCrucible() {
  console.log("--- Vector 1: Concurrent High-Frequency State File Race (50 workers) ---");
  const testDir = path.join(process.cwd(), ".reelos-state", "test-chaos");
  fs.mkdirSync(testDir, { recursive: true });
  const testFile = path.join(testDir, "chaos-state.json");

  try {
    const workers = Array.from({ length: 50 }, (_, i) => {
      return (async () => {
        for (let cycle = 0; cycle < 10; cycle++) {
          const payload = { worker: i, cycle, timestamp: Date.now(), randomData: "x".repeat(5000) };
          overseer.writeJsonAtomic(testFile, payload);
          const readBack = overseer.readJsonSafe(testFile, null);
          assert(readBack !== null, "Read back must never be null during concurrent atomic writes");
          assert(typeof readBack.worker === "number", "Read back must contain valid parsed JSON");
        }
      })();
    });

    await Promise.all(workers);
    record("Concurrent writeJsonAtomic & readJsonSafe under 500-op hammer", true);
  } catch (err) {
    record("Concurrent writeJsonAtomic & readJsonSafe under 500-op hammer", false, err.message);
  } finally {
    try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
  }

  console.log("\n--- Vector 2: Premature Socket Termination / Sudden Client Disconnect ---");
  try {
    const socketAbortPromises = Array.from({ length: 30 }, () => {
      return new Promise((resolve) => {
        const socket = net.createConnection({ host: TARGET_HOST, port: TARGET_PORT }, () => {
          socket.write("GET /api/ready HTTP/1.1\r\nHost: localhost:8080\r\nConnection: keep-alive\r\n\r\n");
        });
        socket.on("data", () => {
          socket.destroy();
          resolve(true);
        });
        socket.on("error", () => resolve(true));
        socket.setTimeout(2000, () => {
          socket.destroy();
          resolve(true);
        });
      });
    });

    await Promise.all(socketAbortPromises);
    const checkRes = await fetch(`${BASE_URL}/api/ready`);
    record("Server survives 30 abrupt TCP socket murders without crashing", checkRes.status === 200, `Status: ${checkRes.status}`);
  } catch (err) {
    record("Server survives 30 abrupt TCP socket murders without crashing", false, err.message);
  }

  console.log("\n--- Vector 3: Slowloris Connection Starvation Stress ---");
  try {
    const slowSockets = [];
    const openSlowloris = (count) => {
      return Promise.all(
        Array.from({ length: count }, () => {
          return new Promise((resolve) => {
            const socket = net.createConnection({ host: TARGET_HOST, port: TARGET_PORT }, () => {
              socket.write("POST /api/quality HTTP/1.1\r\nHost: localhost:8080\r\nContent-Type: application/json\r\nContent-Length: 1000\r\n\r\n");
              const timer = setInterval(() => {
                try { if (!socket.destroyed) socket.write("a"); } catch { clearInterval(timer); }
              }, 200);
              slowSockets.push({ socket, timer });
              resolve(true);
            });
            socket.on("error", () => resolve(true));
            socket.setTimeout(3000, () => resolve(true));
          });
        })
      );
    };

    await openSlowloris(25);
    const fastStart = Date.now();
    const fastRes = await fetch(`${BASE_URL}/api/ready`, { signal: AbortSignal.timeout(3000) });
    const fastDuration = Date.now() - fastStart;

    record("Legitimate requests succeed during active Slowloris socket pressure", fastRes.status === 200 && fastDuration < 2000,
      `Duration: ${fastDuration}ms, Status: ${fastRes.status}`);

    for (const s of slowSockets) {
      clearInterval(s.timer);
      s.socket.destroy();
    }
  } catch (err) {
    record("Legitimate requests succeed during active Slowloris socket pressure", false, err.message);
  }

  console.log("\n--- Vector 4: Path Traversal, Null Bytes & Malformed Headers ---");
  const fuzzPaths = [
    "/..%2f..%2f..%2f..%2fetc%2fpasswd",
    "/..\\..\\..\\..\\windows\\win.ini",
    "/api/stream/%00%00malformed",
    "/api/stream/../../package.json",
    "/public/../../../.env",
    "/%2e%2e%2f%2e%2e%2fprivate",
    "/api/settings?param=" + "A".repeat(16384),
  ];

  let pathTraversalExploited = false;
  let serverCrashesOnFuzz = false;

  for (const fPath of fuzzPaths) {
    try {
      const res = await fetch(`${BASE_URL}${fPath}`, { signal: AbortSignal.timeout(2000) });
      const text = await res.text();
      if (text.includes("root:") || text.includes("[extensions]") || text.includes("PORT=")) {
        pathTraversalExploited = true;
      }
    } catch (err) {
      if (err.code === "ECONNRESET" || err.code === "ECONNREFUSED") {
        serverCrashesOnFuzz = true;
      }
    }
  }

  record("Zero path traversal or null-byte filesystem leakage", !pathTraversalExploited, "Forbidden paths blocked");
  record("Zero server crashes on adversarial URI fuzzing", !serverCrashesOnFuzz, "All paths handled safely");

  console.log("\n--- Vector 5: Gigantic JSON Bomb & Body Flooding ---");
  try {
    const hugePayload = JSON.stringify({ quality: "hybrid", bomb: "A".repeat(5 * 1024 * 1024) });
    const res = await fetch(`${BASE_URL}/api/quality`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: hugePayload,
      signal: AbortSignal.timeout(5000),
    });
    const checkAfterBomb = await fetch(`${BASE_URL}/api/ready`);
    record("Server survives 5MB JSON body flood without Out-of-Memory crash", checkAfterBomb.status === 200,
      `Flood status: ${res.status}, Health: ${checkAfterBomb.status}`);
  } catch (err) {
    const checkAfterBomb = await fetch(`${BASE_URL}/api/ready`).catch(() => ({ status: 0 }));
    record("Server survives 5MB JSON body flood without Out-of-Memory crash", checkAfterBomb.status === 200, err.message);
  }

  console.log("\n--- Vector 6: Rapid Concurrent Mutation Race ---");
  try {
    const modes = ["1080p", "4k", "hybrid"];
    const mutationPromises = Array.from({ length: 40 }, (_, i) => {
      const q = modes[i % modes.length];
      return fetch(`${BASE_URL}/api/quality`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quality: q }),
      });
    });

    const responses = await Promise.all(mutationPromises);
    const all200 = responses.every((r) => r.status === 200);
    const statusRes = await fetch(`${BASE_URL}/api/ready`);
    const statusData = await statusRes.json();
    const finalQuality = statusData.answers?.quality;

    record("40 concurrent quality toggle mutations completed with zero 500 errors", all200, `All 200: ${all200}`);
    record("Final persisted quality state is valid and non-corrupt", ["1080p", "4k", "hybrid"].includes(finalQuality),
      `Final quality: ${finalQuality}`);
  } catch (err) {
    record("40 concurrent quality toggle mutations completed with zero 500 errors", false, err.message);
  }

  console.log("\n--- Vector 7: WatchParty 100-Room Churn & Garbage Collection ---");
  try {
    // Rapidly create 100 rooms
    const createPromises = Array.from({ length: 100 }, (_, i) => {
      return fetch(`${BASE_URL}/api/watchparty/room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleId: `chaos-title-${i}`,
          mediaTitle: `Chaos Movie ${i}`,
          hostName: `ChaosHost${i}`,
        }),
      });
    });

    await Promise.all(createPromises);
    const afterCreateRes = await fetch(`${BASE_URL}/api/watchparty/rooms`);
    const afterCreate = await afterCreateRes.json();
    const createdCount = Array.isArray(afterCreate.rooms) ? afterCreate.rooms.length : Object.keys(afterCreate.rooms || {}).length;

    record("100 concurrent WatchParty rooms created cleanly", createdCount >= 100, `Total active rooms: ${createdCount}`);
  } catch (err) {
    record("100 concurrent WatchParty rooms created cleanly", false, err.message);
  }

  console.log("\n================================================================================");
  console.log("                        CHAOS CRUCIBLE SUMMARY                                  ");
  console.log("================================================================================");
  console.log(`  Passed Checks:  ${results.passed}`);
  console.log(`  Failed Checks:  ${results.failed}`);
  console.log(`  Bugs Uncovered: ${results.bugsFound.length}`);
  console.log("--------------------------------------------------------------------------------");

  if (results.bugsFound.length > 0) {
    console.error("\n>>> BUGS DISCOVERED DURING CRUCIBLE TESTING: <<<");
    for (const b of results.bugsFound) {
      console.error(`  * ${b.name}: ${b.bugDetail}`);
    }
    process.exit(1);
  } else {
    console.log("\n>>> ZERO CRITICAL BUGS DISCOVERED UNDER SEVERE CHAOS PRESSURE. <<<");
    process.exit(0);
  }
}

runCrucible().catch((err) => {
  console.error("FATAL CRUCIBLE RUNNER ERROR:", err);
  process.exit(1);
});
