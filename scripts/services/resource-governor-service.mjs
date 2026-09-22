import { createHash, randomUUID } from "node:crypto";

export const WORKLOAD_PRIORITIES = Object.freeze({
  safety_playback: 1,
  user_interaction: 2,
  playback_recovery: 3,
  requested_work: 4,
  predictive_preparation: 5,
  media_analysis: 6,
  maintenance: 7,
});

const ACTIVE_STATES = new Set(["running", "yielding"]);
const TERMINAL_STATES = new Set(["cancelled", "expired", "released"]);
const PREEMPTION_MODES = new Set(["yield", "cancel", "none"]);
const safeInteger = (value) => Number.isSafeInteger(value) && value >= 0;

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  if (["string", "number", "boolean"].includes(typeof value) || value === null) return value;
  throw new TypeError("Hardware fingerprints may contain only JSON scalar, array, and object values.");
}

export function hashHardwareFingerprint(fingerprint) {
  if (!fingerprint || typeof fingerprint !== "object" || Array.isArray(fingerprint)) {
    throw new TypeError("A hardware fingerprint object is required.");
  }
  return createHash("sha256").update(JSON.stringify(stableValue(fingerprint))).digest("hex");
}

function signalReason(code, message) {
  return Object.assign(new Error(message), { code });
}

/**
 * Process-local admission authority for bounded ReelOS work. It owns budgets
 * and cooperative control signals, but it does not identify users, authorize
 * media, or decide whether an output is safe to publish.
 */
export class ResourceGovernor {
  constructor({
    telemetry,
    storageAuthority = null,
    memorySafetyFloorBytes,
    diskSafetyFloorBytes,
    defaultLeaseTtlMs = 30_000,
    maxLeaseTtlMs = 5 * 60_000,
    now = () => Date.now(),
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    autoSweep = true,
  } = {}) {
    if (typeof telemetry !== "function") throw new TypeError("A telemetry sampler is required.");
    if (!safeInteger(memorySafetyFloorBytes) || !safeInteger(diskSafetyFloorBytes)) {
      throw new TypeError("Memory and disk safety floors must be non-negative safe integers.");
    }
    if (!Number.isSafeInteger(defaultLeaseTtlMs) || defaultLeaseTtlMs <= 0
      || !Number.isSafeInteger(maxLeaseTtlMs) || maxLeaseTtlMs < defaultLeaseTtlMs) {
      throw new TypeError("Lease lifetimes are invalid.");
    }
    this.telemetry = telemetry;
    this.storageAuthority = storageAuthority;
    this.memorySafetyFloorBytes = memorySafetyFloorBytes;
    this.diskSafetyFloorBytes = diskSafetyFloorBytes;
    this.defaultLeaseTtlMs = defaultLeaseTtlMs;
    this.maxLeaseTtlMs = maxLeaseTtlMs;
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.autoSweep = autoSweep;
    this.leases = new Map();
    this.foreground = { playbackActive: false, interactionActive: false };
    this.hardware = { generation: 0, hash: null };
    this.hardwareInvalidationListeners = new Set();
    this.pendingReservationReleases = new Map();
    this.expiryTimer = null;
    this.lastTelemetry = null;
    this.metrics = {
      admissionAttempts: 0, admitted: 0, denied: 0, heartbeats: 0,
      yields: 0, resumes: 0, cancellations: 0, expirations: 0,
      releases: 0, preemptions: 0, hardwareInvalidations: 0,
      reservationReleaseFailures: 0,
    };
  }

  sampleTelemetry() {
    let sample;
    try { sample = this.telemetry(); }
    catch { throw signalReason("telemetry_unavailable", "Machine resources could not be measured."); }
    if (!sample || !safeInteger(sample.availableMemoryBytes) || !safeInteger(sample.freeDiskBytes)) {
      throw signalReason("telemetry_unavailable", "Machine resources could not be verified.");
    }
    this.lastTelemetry = {
      availableMemoryBytes: sample.availableMemoryBytes,
      freeDiskBytes: sample.freeDiskBytes,
      ...(typeof sample.thermalState === "string" ? { thermalState: sample.thermalState } : {}),
      ...(safeInteger(sample.sampledAt) ? { sampledAt: sample.sampledAt } : {}),
    };
    return this.lastTelemetry;
  }

  committedMemoryBytes(exceptId = null, preemptedAtOrBelow = null) {
    let total = 0;
    for (const lease of this.leases.values()) {
      if (lease.id !== exceptId && lease.state === "running"
        && (preemptedAtOrBelow === null || lease.priority < preemptedAtOrBelow)) total += lease.memoryBytes;
    }
    return total;
  }

  committedStorageBytes() {
    let total = 0;
    for (const lease of this.leases.values()) {
      if (ACTIVE_STATES.has(lease.state)) total += lease.storageBytes;
    }
    for (const pending of this.pendingReservationReleases.values()) total += pending.bytes;
    return total;
  }

  admissionPressure(memoryBytes, storageBytes, exceptId = null, preemptedAtOrBelow = null) {
    const sample = this.sampleTelemetry();
    const memoryAfter = sample.availableMemoryBytes
      - this.committedMemoryBytes(exceptId, preemptedAtOrBelow) - memoryBytes;
    const diskAfter = sample.freeDiskBytes - this.committedStorageBytes() - storageBytes;
    return {
      sample,
      memoryAfter,
      diskAfter,
      memorySafe: memoryAfter >= this.memorySafetyFloorBytes,
      diskSafe: diskAfter >= this.diskSafetyFloorBytes,
    };
  }

  admit({
    workloadId,
    workloadClass,
    memoryBytes = 0,
    storageBytes = 0,
    ttlMs = this.defaultLeaseTtlMs,
    preemption = "yield",
    hardwareSensitive = true,
    metadata = {},
  } = {}) {
    this.sweepExpired();
    this.metrics.admissionAttempts++;
    if (typeof workloadId !== "string" || !workloadId.trim()
      || !Object.hasOwn(WORKLOAD_PRIORITIES, workloadClass)
      || !safeInteger(memoryBytes) || !safeInteger(storageBytes)
      || !Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > this.maxLeaseTtlMs
      || !PREEMPTION_MODES.has(preemption)
      || !metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return this.denial("invalid_workload", "The workload admission request is invalid.");
    }
    if (this.isForegroundBlocked(WORKLOAD_PRIORITIES[workloadClass])) {
      return this.denial("foreground_priority", "Foreground playback or interaction currently has priority.");
    }
    const priority = WORKLOAD_PRIORITIES[workloadClass];
    const preemptedAtOrBelow = priority === WORKLOAD_PRIORITIES.safety_playback
      ? WORKLOAD_PRIORITIES.requested_work
      : priority === WORKLOAD_PRIORITIES.user_interaction
        ? WORKLOAD_PRIORITIES.predictive_preparation : null;
    let pressure;
    try { pressure = this.admissionPressure(memoryBytes, storageBytes, null, preemptedAtOrBelow); }
    catch (error) { return this.denial(error.code || "telemetry_unavailable", error.message); }
    if (!pressure.memorySafe) return this.denial("memory_safety_floor", "The workload would cross the protected memory floor.");
    if (!pressure.diskSafe) return this.denial("disk_safety_floor", "The workload would cross the protected disk floor.");

    let reservationId = null;
    if (storageBytes > 0) {
      if (!this.storageAuthority || typeof this.storageAuthority.reserve !== "function"
        || typeof this.storageAuthority.release !== "function") {
        return this.denial("storage_authority_unavailable", "Storage cannot be reserved safely.");
      }
      let reservation;
      try {
        reservation = this.storageAuthority.reserve(storageBytes, {
          workloadId: workloadId.trim(), workloadClass, hardwareGeneration: this.hardware.generation,
        });
      } catch {
        return this.denial("storage_reservation_failed", "Storage could not be reserved.");
      }
      if (!reservation?.ok || typeof reservation.id !== "string" || !reservation.id) {
        return this.denial(reservation?.code || "storage_reservation_failed", reservation?.reason || "Storage could not be reserved.");
      }
      reservationId = reservation.id;
    }

    const timestamp = this.checkedNow();
    const internal = {
      id: randomUUID(), workloadId: workloadId.trim(), workloadClass,
      priority, memoryBytes, storageBytes,
      reservationId, preemption, hardwareSensitive: Boolean(hardwareSensitive),
      hardwareGeneration: this.hardware.generation, state: "running",
      createdAt: timestamp, heartbeatAt: timestamp, expiresAt: timestamp + ttlMs,
      ttlMs, metadata: { ...metadata }, listeners: new Set(), abortController: new AbortController(),
      lastReason: null,
    };
    this.leases.set(internal.id, internal);
    this.metrics.admitted++;
    this.preemptForPriority(internal.priority, `${workloadClass}_admitted`, internal.id);
    this.scheduleExpiry();
    return { ok: true, lease: this.publicLease(internal) };
  }

  denial(code, reason) {
    this.metrics.denied++;
    return { ok: false, code, reason };
  }

  checkedNow() {
    const value = this.now();
    if (!safeInteger(value)) throw new TypeError("The governor clock returned an invalid time.");
    return value;
  }

  isForegroundBlocked(priority) {
    return (this.foreground.playbackActive && priority >= WORKLOAD_PRIORITIES.requested_work)
      || (this.foreground.interactionActive && priority >= WORKLOAD_PRIORITIES.predictive_preparation);
  }

  publicLease(internal) {
    const governor = this;
    return Object.freeze({
      id: internal.id,
      signal: internal.abortController.signal,
      heartbeat: () => governor.heartbeat(internal.id),
      release: () => governor.release(internal.id),
      cancel: (reason = "workload_cancelled") => governor.cancel(internal.id, reason),
      subscribe: (listener) => governor.subscribe(internal.id, listener),
      snapshot: () => governor.leaseSnapshot(internal.id),
    });
  }

  leaseSnapshot(id) {
    const lease = this.leases.get(id);
    if (!lease) return null;
    return Object.freeze({
      id: lease.id, workloadId: lease.workloadId, workloadClass: lease.workloadClass,
      priority: lease.priority, state: lease.state, memoryBytes: lease.memoryBytes,
      storageBytes: lease.storageBytes, createdAt: lease.createdAt,
      heartbeatAt: lease.heartbeatAt, expiresAt: lease.expiresAt,
      hardwareGeneration: lease.hardwareGeneration, lastReason: lease.lastReason,
    });
  }

  subscribe(id, listener) {
    if (typeof listener !== "function") throw new TypeError("A lease signal listener is required.");
    const lease = this.leases.get(id);
    if (!lease || TERMINAL_STATES.has(lease.state)) return () => {};
    lease.listeners.add(listener);
    return () => lease.listeners.delete(listener);
  }

  emitLease(lease, type, reason) {
    const event = Object.freeze({ type, reason, leaseId: lease.id, workloadId: lease.workloadId, at: this.checkedNow() });
    for (const listener of [...lease.listeners]) {
      try { listener(event); } catch { /* Observers cannot break resource authority. */ }
    }
  }

  heartbeat(id, ttlMs) {
    const lease = this.leases.get(id);
    if (!lease || TERMINAL_STATES.has(lease.state)) return { ok: false, code: "lease_inactive" };
    const lifetime = ttlMs ?? lease.ttlMs;
    if (!Number.isSafeInteger(lifetime) || lifetime <= 0 || lifetime > this.maxLeaseTtlMs) {
      return { ok: false, code: "invalid_lease_ttl" };
    }
    const timestamp = this.checkedNow();
    if (lease.expiresAt <= timestamp) {
      this.expireLease(lease);
      return { ok: false, code: "lease_expired" };
    }
    lease.heartbeatAt = timestamp;
    lease.expiresAt = timestamp + lifetime;
    lease.ttlMs = lifetime;
    this.metrics.heartbeats++;
    this.scheduleExpiry();
    return { ok: true, expiresAt: lease.expiresAt };
  }

  updateForegroundState({ playbackActive = this.foreground.playbackActive,
    interactionActive = this.foreground.interactionActive } = {}) {
    if (typeof playbackActive !== "boolean" || typeof interactionActive !== "boolean") {
      throw new TypeError("Foreground state must use booleans.");
    }
    const previous = this.foreground;
    this.foreground = { playbackActive, interactionActive };
    if (playbackActive && !previous.playbackActive) {
      this.preemptFrom(WORKLOAD_PRIORITIES.requested_work, "playback_active");
    }
    if (interactionActive && !previous.interactionActive) {
      this.preemptFrom(WORKLOAD_PRIORITIES.predictive_preparation, "interaction_active");
    }
    if ((!playbackActive && previous.playbackActive) || (!interactionActive && previous.interactionActive)) {
      this.resumeEligible();
    }
    return this.snapshot();
  }

  preemptForPriority(priority, reason, exceptId = null) {
    if (priority === WORKLOAD_PRIORITIES.safety_playback) {
      this.preemptFrom(WORKLOAD_PRIORITIES.requested_work, reason, exceptId);
    } else if (priority === WORKLOAD_PRIORITIES.user_interaction) {
      this.preemptFrom(WORKLOAD_PRIORITIES.predictive_preparation, reason, exceptId);
    }
  }

  preemptFrom(minimumPriority, reason, exceptId = null) {
    for (const lease of [...this.leases.values()]) {
      if (lease.id === exceptId || lease.state !== "running" || lease.priority < minimumPriority) continue;
      this.metrics.preemptions++;
      if (lease.preemption === "cancel" || lease.preemption === "none") this.cancelLease(lease, reason);
      else this.yieldLease(lease, reason);
    }
  }

  yieldLease(lease, reason) {
    if (lease.state !== "running") return false;
    lease.state = "yielding";
    lease.lastReason = reason;
    this.metrics.yields++;
    this.emitLease(lease, "yield", reason);
    return true;
  }

  resumeEligible() {
    const candidates = [...this.leases.values()].filter((lease) => lease.state === "yielding")
      .sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt);
    for (const lease of candidates) {
      if (this.isForegroundBlocked(lease.priority)) continue;
      let pressure;
      try { pressure = this.admissionPressure(lease.memoryBytes, 0, lease.id); }
      catch { continue; }
      if (!pressure.memorySafe) continue;
      lease.state = "running";
      lease.lastReason = null;
      this.metrics.resumes++;
      this.emitLease(lease, "resume", "resources_available");
    }
  }

  cancel(id, reason = "workload_cancelled") {
    const lease = this.leases.get(id);
    if (!lease || TERMINAL_STATES.has(lease.state)) return { ok: false, code: "lease_inactive" };
    this.cancelLease(lease, reason);
    return { ok: true };
  }

  cancelLease(lease, reason) {
    lease.state = "cancelled";
    lease.lastReason = reason;
    this.metrics.cancellations++;
    this.emitLease(lease, "cancel", reason);
    lease.abortController.abort(signalReason(reason, "The resource lease was cancelled."));
    this.releaseReservation(lease);
    this.scheduleExpiry();
  }

  release(id) {
    const lease = this.leases.get(id);
    if (!lease || TERMINAL_STATES.has(lease.state)) return { ok: false, code: "lease_inactive" };
    lease.state = "released";
    lease.lastReason = "workload_complete";
    this.metrics.releases++;
    this.releaseReservation(lease);
    this.scheduleExpiry();
    this.resumeEligible();
    return { ok: true };
  }

  releaseReservation(lease) {
    if (!lease.reservationId) return;
    const id = lease.reservationId;
    lease.reservationId = null;
    try {
      const result = this.storageAuthority.release(id);
      if (result?.ok !== true) {
        this.metrics.reservationReleaseFailures++;
        this.pendingReservationReleases.set(id, { bytes: lease.storageBytes });
      }
    } catch {
      this.metrics.reservationReleaseFailures++;
      this.pendingReservationReleases.set(id, { bytes: lease.storageBytes });
    }
  }

  retryPendingStorageReleases() {
    let released = 0;
    for (const id of [...this.pendingReservationReleases.keys()]) {
      try {
        const result = this.storageAuthority.release(id);
        if (result?.ok === true) {
          this.pendingReservationReleases.delete(id);
          released++;
        }
      } catch { /* Retain the commitment until the authority confirms release. */ }
    }
    return { ok: this.pendingReservationReleases.size === 0, released,
      pending: this.pendingReservationReleases.size };
  }

  expireLease(lease) {
    if (TERMINAL_STATES.has(lease.state)) return;
    lease.state = "expired";
    lease.lastReason = "lease_expired";
    this.metrics.expirations++;
    this.emitLease(lease, "cancel", "lease_expired");
    lease.abortController.abort(signalReason("lease_expired", "The resource lease heartbeat expired."));
    this.releaseReservation(lease);
  }

  sweepExpired() {
    const timestamp = this.checkedNow();
    for (const lease of this.leases.values()) {
      if (ACTIVE_STATES.has(lease.state) && lease.expiresAt <= timestamp) this.expireLease(lease);
    }
    this.scheduleExpiry();
  }

  scheduleExpiry() {
    if (!this.autoSweep) return;
    if (this.expiryTimer) this.clearTimer(this.expiryTimer);
    this.expiryTimer = null;
    let next = Infinity;
    for (const lease of this.leases.values()) {
      if (ACTIVE_STATES.has(lease.state)) next = Math.min(next, lease.expiresAt);
    }
    if (!Number.isFinite(next)) return;
    this.expiryTimer = this.setTimer(() => {
      this.expiryTimer = null;
      this.sweepExpired();
    }, Math.max(1, next - this.checkedNow()));
    this.expiryTimer?.unref?.();
  }

  onHardwareInvalidated(listener) {
    if (typeof listener !== "function") throw new TypeError("A hardware invalidation listener is required.");
    this.hardwareInvalidationListeners.add(listener);
    return () => this.hardwareInvalidationListeners.delete(listener);
  }

  updateHardwareFingerprint(fingerprint) {
    const hash = hashHardwareFingerprint(fingerprint);
    if (hash === this.hardware.hash) return { changed: false, ...this.hardware };
    const previousHash = this.hardware.hash;
    this.hardware = { hash, generation: this.hardware.generation + 1 };
    if (previousHash !== null) {
      this.metrics.hardwareInvalidations++;
      const event = Object.freeze({ previousHash, hash, generation: this.hardware.generation, at: this.checkedNow() });
      for (const lease of [...this.leases.values()]) {
        if (ACTIVE_STATES.has(lease.state) && lease.hardwareSensitive) this.cancelLease(lease, "hardware_fingerprint_changed");
      }
      for (const listener of [...this.hardwareInvalidationListeners]) {
        try { listener(event); } catch { /* Invalidation observers cannot block safety. */ }
      }
    }
    return { changed: previousHash !== null, ...this.hardware };
  }

  snapshot() {
    const states = {};
    const workloads = {};
    for (const lease of this.leases.values()) {
      states[lease.state] = (states[lease.state] || 0) + 1;
      if (ACTIVE_STATES.has(lease.state)) workloads[lease.workloadClass] = (workloads[lease.workloadClass] || 0) + 1;
    }
    let storage = null;
    try { storage = typeof this.storageAuthority?.snapshot === "function" ? this.storageAuthority.snapshot() : null; }
    catch { storage = { available: false }; }
    return Object.freeze({
      foreground: { ...this.foreground },
      floors: { memoryBytes: this.memorySafetyFloorBytes, diskBytes: this.diskSafetyFloorBytes },
      commitments: { memoryBytes: this.committedMemoryBytes(), storageBytes: this.committedStorageBytes() },
      activeWorkloads: workloads, leaseStates: states, metrics: { ...this.metrics },
      pendingStorageReleases: {
        count: this.pendingReservationReleases.size,
        bytes: [...this.pendingReservationReleases.values()].reduce((total, item) => total + item.bytes, 0),
      },
      hardware: { ...this.hardware }, telemetry: this.lastTelemetry ? { ...this.lastTelemetry } : null,
      storage,
    });
  }

  close() {
    if (this.expiryTimer) this.clearTimer(this.expiryTimer);
    this.expiryTimer = null;
    for (const lease of [...this.leases.values()]) {
      if (ACTIVE_STATES.has(lease.state)) this.cancelLease(lease, "governor_closed");
    }
  }
}
