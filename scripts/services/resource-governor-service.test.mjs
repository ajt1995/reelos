import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ResourceGovernor, WORKLOAD_PRIORITIES, hashHardwareFingerprint,
} from "./resource-governor-service.mjs";

const MIB = 1024 * 1024;
function fixture(overrides = {}) {
  let now = 1_000;
  const telemetry = {
    availableMemoryBytes: 1_000 * MIB,
    freeDiskBytes: 10_000 * MIB,
  };
  const reservations = new Map();
  let nextReservation = 0;
  const storageAuthority = {
    reserve(bytes, metadata) {
      const id = `reservation-${++nextReservation}`;
      reservations.set(id, { bytes, metadata });
      return { ok: true, id };
    },
    release(id) { return { ok: reservations.delete(id) }; },
    snapshot() { return { reservations: reservations.size }; },
  };
  const governor = new ResourceGovernor({
    telemetry: () => ({ ...telemetry, sampledAt: now }),
    storageAuthority,
    memorySafetyFloorBytes: 200 * MIB,
    diskSafetyFloorBytes: 2_000 * MIB,
    defaultLeaseTtlMs: 1_000,
    maxLeaseTtlMs: 10_000,
    now: () => now,
    autoSweep: false,
    ...overrides,
  });
  return { governor, telemetry, reservations, advance: (milliseconds) => { now += milliseconds; } };
}

test("workload classes have a strict foreground-to-maintenance priority order", () => {
  assert.deepEqual(Object.values(WORKLOAD_PRIORITIES), [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(WORKLOAD_PRIORITIES.safety_playback < WORKLOAD_PRIORITIES.user_interaction);
  assert.ok(WORKLOAD_PRIORITIES.media_analysis < WORKLOAD_PRIORITIES.maintenance);
});

test("admission fails closed at hard memory and disk safety floors", () => {
  const { governor, telemetry, reservations } = fixture();
  assert.equal(governor.admit({ workloadId: "safe", workloadClass: "media_analysis", memoryBytes: 801 * MIB }).code,
    "memory_safety_floor");
  assert.equal(governor.admit({ workloadId: "disk", workloadClass: "requested_work", storageBytes: 8_001 * MIB }).code,
    "disk_safety_floor");
  assert.equal(reservations.size, 0, "failed floor checks cannot reserve storage");
  telemetry.availableMemoryBytes = 199 * MIB;
  assert.equal(governor.admit({ workloadId: "tiny", workloadClass: "maintenance" }).code, "memory_safety_floor");
  assert.equal(governor.snapshot().metrics.denied, 3);
});

test("concurrent lease budgets cannot overcommit memory hidden by a stale telemetry sample", () => {
  const { governor } = fixture();
  const first = governor.admit({ workloadId: "first", workloadClass: "media_analysis", memoryBytes: 500 * MIB });
  assert.equal(first.ok, true);
  const second = governor.admit({ workloadId: "second", workloadClass: "media_analysis", memoryBytes: 301 * MIB });
  assert.equal(second.code, "memory_safety_floor");
  assert.equal(governor.snapshot().commitments.memoryBytes, 500 * MIB);
});

test("storage reservations are owned for the entire lease and released exactly once", () => {
  const { governor, reservations } = fixture();
  const admitted = governor.admit({
    workloadId: "prepare-film", workloadClass: "requested_work", storageBytes: 900 * MIB,
  });
  assert.equal(admitted.ok, true);
  assert.equal(reservations.size, 1);
  assert.deepEqual([...reservations.values()][0].metadata,
    { workloadId: "prepare-film", workloadClass: "requested_work", hardwareGeneration: 0 });
  assert.equal(admitted.lease.release().ok, true);
  assert.equal(admitted.lease.release().code, "lease_inactive");
  assert.equal(reservations.size, 0);
});

test("failed reservation releases remain committed until an explicit retry succeeds", () => {
  let releaseWorks = false;
  const reservations = new Map();
  const storageAuthority = {
    reserve(bytes) { reservations.set("held", bytes); return { ok: true, id: "held" }; },
    release(id) {
      if (!releaseWorks) return { ok: false };
      reservations.delete(id);
      return { ok: true };
    },
  };
  const { governor } = fixture({ storageAuthority });
  const lease = governor.admit({
    workloadId: "output", workloadClass: "requested_work", storageBytes: 500 * MIB,
  }).lease;
  lease.release();
  assert.deepEqual(governor.snapshot().pendingStorageReleases, { count: 1, bytes: 500 * MIB });
  assert.equal(governor.snapshot().commitments.storageBytes, 500 * MIB);
  releaseWorks = true;
  assert.deepEqual(governor.retryPendingStorageReleases(), { ok: true, released: 1, pending: 0 });
  assert.equal(governor.snapshot().commitments.storageBytes, 0);
});

test("heartbeats extend leases while missed heartbeats expire, abort, signal, and release storage", () => {
  const { governor, reservations, advance } = fixture();
  const admitted = governor.admit({
    workloadId: "analysis", workloadClass: "media_analysis", storageBytes: 100 * MIB,
  });
  const events = [];
  admitted.lease.subscribe((event) => events.push(event));
  advance(900);
  assert.deepEqual(admitted.lease.heartbeat(), { ok: true, expiresAt: 2_900 });
  advance(999);
  governor.sweepExpired();
  assert.equal(admitted.lease.snapshot().state, "running");
  advance(2);
  governor.sweepExpired();
  assert.equal(admitted.lease.snapshot().state, "expired");
  assert.equal(admitted.lease.signal.aborted, true);
  assert.equal(admitted.lease.signal.reason.code, "lease_expired");
  assert.deepEqual(events.map(({ type, reason }) => [type, reason]), [["cancel", "lease_expired"]]);
  assert.equal(reservations.size, 0);
});

test("the expiry scheduler automatically sweeps the next missed heartbeat", () => {
  let scheduled = null;
  const timer = { unref() {} };
  const { governor, advance } = fixture({
    autoSweep: true,
    setTimer(callback, delay) { scheduled = { callback, delay }; return timer; },
    clearTimer() { scheduled = null; },
  });
  const lease = governor.admit({ workloadId: "automatic-expiry", workloadClass: "maintenance" }).lease;
  assert.equal(scheduled.delay, 1_000);
  advance(1_000);
  scheduled.callback();
  assert.equal(lease.snapshot().state, "expired");
  assert.equal(lease.signal.reason.code, "lease_expired");
});

test("playback yields requested and background work while preserving immediate recovery", () => {
  const { governor } = fixture();
  const requested = governor.admit({ workloadId: "manual-import", workloadClass: "requested_work", memoryBytes: 100 * MIB });
  const recovery = governor.admit({ workloadId: "buffer-recovery", workloadClass: "playback_recovery", memoryBytes: 100 * MIB });
  const predictive = governor.admit({ workloadId: "next-film", workloadClass: "predictive_preparation", memoryBytes: 100 * MIB });
  const events = [];
  requested.lease.subscribe((event) => events.push(event.type));
  governor.updateForegroundState({ playbackActive: true });
  assert.equal(requested.lease.snapshot().state, "yielding");
  assert.equal(predictive.lease.snapshot().state, "yielding");
  assert.equal(recovery.lease.snapshot().state, "running");
  assert.deepEqual(events, ["yield"]);
  assert.equal(governor.admit({ workloadId: "blocked", workloadClass: "maintenance" }).code, "foreground_priority");
  governor.updateForegroundState({ playbackActive: false });
  assert.equal(requested.lease.snapshot().state, "running");
  assert.equal(predictive.lease.snapshot().state, "running");
  assert.deepEqual(events, ["yield", "resume"]);
});

test("interaction preempts predictive and lower work but not requested foreground work", () => {
  const { governor } = fixture();
  const requested = governor.admit({ workloadId: "user-request", workloadClass: "requested_work" });
  const predictive = governor.admit({ workloadId: "prediction", workloadClass: "predictive_preparation" });
  const analysis = governor.admit({ workloadId: "frames", workloadClass: "media_analysis" });
  governor.updateForegroundState({ interactionActive: true });
  assert.equal(requested.lease.snapshot().state, "running");
  assert.equal(predictive.lease.snapshot().state, "yielding");
  assert.equal(analysis.lease.snapshot().state, "yielding");
});

test("non-cooperative lower-priority work is cancelled and aborted on preemption", () => {
  const { governor } = fixture();
  const stubborn = governor.admit({
    workloadId: "codec", workloadClass: "media_analysis", preemption: "none",
  });
  governor.updateForegroundState({ playbackActive: true });
  assert.equal(stubborn.lease.snapshot().state, "cancelled");
  assert.equal(stubborn.lease.signal.aborted, true);
  assert.equal(stubborn.lease.signal.reason.code, "playback_active");
});

test("a safety/playback lease admission itself preempts optional work", () => {
  const { governor } = fixture();
  const background = governor.admit({
    workloadId: "index", workloadClass: "maintenance", memoryBytes: 700 * MIB,
  });
  const playback = governor.admit({
    workloadId: "stream", workloadClass: "safety_playback", memoryBytes: 300 * MIB,
  });
  assert.equal(playback.ok, true);
  assert.equal(background.lease.snapshot().state, "yielding");
  assert.equal(governor.snapshot().metrics.preemptions, 1);
});

test("hardware fingerprints are stable by key order and changes invalidate sensitive leases and hooks", () => {
  assert.equal(hashHardwareFingerprint({ ram: 8, cpu: "x" }), hashHardwareFingerprint({ cpu: "x", ram: 8 }));
  const { governor } = fixture();
  const initial = governor.updateHardwareFingerprint({ cpu: "x", ram: 8, codecs: ["h264"] });
  assert.equal(initial.changed, false);
  const sensitive = governor.admit({ workloadId: "encode", workloadClass: "requested_work" });
  const portable = governor.admit({ workloadId: "metadata", workloadClass: "maintenance", hardwareSensitive: false });
  const invalidations = [];
  governor.onHardwareInvalidated((event) => invalidations.push(event));
  assert.equal(governor.updateHardwareFingerprint({ codecs: ["h264"], ram: 8, cpu: "x" }).changed, false);
  const changed = governor.updateHardwareFingerprint({ cpu: "y", ram: 8, codecs: ["h264"] });
  assert.equal(changed.changed, true);
  assert.equal(sensitive.lease.snapshot().state, "cancelled");
  assert.equal(sensitive.lease.signal.reason.code, "hardware_fingerprint_changed");
  assert.equal(portable.lease.snapshot().state, "running");
  assert.equal(invalidations.length, 1);
  assert.equal(invalidations[0].generation, 2);
});

test("metrics snapshots expose safe aggregate state without workload metadata", () => {
  const { governor } = fixture();
  governor.updateHardwareFingerprint({ cpu: "fixture", ram: 16 });
  const lease = governor.admit({
    workloadId: "private-title-id", workloadClass: "media_analysis", memoryBytes: 64 * MIB,
    metadata: { title: "must not leak" },
  }).lease;
  lease.heartbeat();
  const snapshot = governor.snapshot();
  assert.equal(snapshot.commitments.memoryBytes, 64 * MIB);
  assert.equal(snapshot.activeWorkloads.media_analysis, 1);
  assert.equal(snapshot.metrics.admitted, 1);
  assert.equal(snapshot.metrics.heartbeats, 1);
  assert.equal(snapshot.hardware.generation, 1);
  assert.equal(JSON.stringify(snapshot).includes("must not leak"), false);
  assert.equal(JSON.stringify(snapshot).includes("private-title-id"), false);
});

test("telemetry and storage authority failures deny work without leaking a lease", () => {
  const brokenTelemetry = fixture({ telemetry: () => { throw new Error("sensor secret"); } }).governor;
  assert.deepEqual(brokenTelemetry.admit({ workloadId: "x", workloadClass: "maintenance" }), {
    ok: false, code: "telemetry_unavailable", reason: "Machine resources could not be measured.",
  });
  const brokenStorage = fixture({ storageAuthority: { reserve: () => { throw new Error("disk secret"); }, release() {} } }).governor;
  assert.equal(brokenStorage.admit({ workloadId: "x", workloadClass: "requested_work", storageBytes: 1 }).code,
    "storage_reservation_failed");
  assert.equal(brokenStorage.snapshot().metrics.admitted, 0);
});
