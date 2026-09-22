import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getMediaStrategy } from "./media-strategy-service.mjs";
import { checkStorageHeadroom } from "./storage-service.mjs";
import { safeWriteFileSync } from "./profile-service.mjs";

const GIB = 1024 ** 3;
const MAX_ENTRIES = 10000;
const MAX_DEPTH = 16;
const MAX_RESERVATIONS = 4096;
const MAX_LEDGER_BYTES = 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const defaultStateDir = () => process.env.REELOS_STATE || (process.platform === "win32"
  ? path.join(process.cwd(), ".reelos-state") : "/var/lib/reelos");
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const keys = (value, allowed) => object(value) && Object.keys(value).length === allowed.length && Object.keys(value).every((key) => allowed.includes(key));
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
const failure = (error) => ({ ok: false, code: error.code || "budget_unavailable", reason: error.message || "Preparation storage is unavailable." });

function stateRoot(stateDir) {
  if (typeof stateDir !== "string" || !path.isAbsolute(stateDir) || /^[/\\]{2}/.test(stateDir)) fail("budget_unavailable", "A local preparation state directory is required.");
  const resolved = path.resolve(stateDir);
  let cursor = resolved;
  while (true) {
    const stat = fs.lstatSync(cursor);
    if (stat.isSymbolicLink() || !stat.isDirectory()) fail("unsafe_preparation_path", "Preparation storage cannot use linked directories.");
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  const stat = fs.lstatSync(resolved, { bigint: true });
  return { dir: resolved, dev: Number(stat.dev), ino: String(stat.ino) };
}

function readRegularJson(file, maxBytes, fallback, dev) {
  let stat;
  try { stat = fs.lstatSync(file); }
  catch (error) { if (error.code === "ENOENT") return fallback; throw error; }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.dev !== dev || stat.size > maxBytes) fail("budget_state_invalid", "Preparation state could not be verified.");
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { fail("budget_state_invalid", "Preparation state could not be read."); }
}

function readReservations(root) {
  const ledger = readRegularJson(path.join(root.dir, "preparation-reservations.json"), MAX_LEDGER_BYTES,
    { schemaVersion: 1, reservations: {} }, root.dev);
  if (!keys(ledger, ["schemaVersion", "reservations"]) || ledger.schemaVersion !== 1 || !object(ledger.reservations)
    || Object.keys(ledger.reservations).length > MAX_RESERVATIONS) fail("budget_state_invalid", "Preparation reservations need recovery.");
  let reservedBytes = 0;
  for (const [id, reservation] of Object.entries(ledger.reservations)) {
    if (!UUID.test(id) || !keys(reservation, ["maxBytes", "createdAt"])
      || !Number.isSafeInteger(reservation.maxBytes) || reservation.maxBytes <= 0
      || !Number.isSafeInteger(reservation.createdAt) || reservation.createdAt < 0) fail("budget_state_invalid", "Preparation reservations need recovery.");
    reservedBytes += reservation.maxBytes;
    if (!Number.isSafeInteger(reservedBytes)) fail("budget_state_invalid", "Preparation reservation totals are invalid.");
  }
  return { ledger, reservedBytes };
}

function managedBytes(root) {
  const directory = path.join(root.dir, "prepared-media");
  try { fs.lstatSync(directory); }
  catch (error) { if (error.code === "ENOENT") return 0; throw error; }
  let visited = 0;
  let total = 0;
  const walk = (file, depth) => {
    if (++visited > MAX_ENTRIES || depth > MAX_DEPTH) fail("preparation_scan_limit", "Preparation storage exceeds the bounded inventory limit.");
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || stat.dev !== root.dev) fail("unsafe_preparation_path", "Preparation storage contains a link or a different volume.");
    if (stat.isFile()) {
      if (!Number.isSafeInteger(stat.size) || stat.size < 0 || !Number.isSafeInteger(total + stat.size)) fail("preparation_scan_limit", "Preparation storage size is invalid.");
      total += stat.size;
    } else if (stat.isDirectory()) {
      const dir = fs.opendirSync(file);
      try {
        let entry;
        while ((entry = dir.readSync()) !== null) walk(path.join(file, entry.name), depth + 1);
      } finally { dir.closeSync(); }
    } else fail("unsafe_preparation_path", "Preparation storage contains an unsupported file.");
  };
  walk(directory, 0);
  return total;
}

function validatedStrategy(root, override) {
  // The strategy getter may support defaults for a missing file; a corrupt
  // persisted policy must never silently grant a default reservation budget.
  const stored = readRegularJson(path.join(root.dir, "media-strategy.json"), MAX_LEDGER_BYTES, {}, root.dev);
  if (!object(stored)) fail("budget_policy_invalid", "Preparation policy needs recovery.");
  const strategy = override ?? getMediaStrategy(root.dir);
  if (!object(strategy) || !["smart_hybrid", "cloud_stream", "offline_download"].includes(strategy.mode)
    || !["dynamic_20", "fixed"].includes(strategy.storageAllocation)
    || strategy.dedicatedUsbMount != null
    || typeof strategy.allocatedGb !== "number" || !Number.isFinite(strategy.allocatedGb) || strategy.allocatedGb < 0
    || !Number.isSafeInteger(Math.floor(strategy.allocatedGb * GIB))) fail("budget_policy_invalid", "Preparation policy needs recovery.");
  return strategy;
}

function inspectBudget(root, reservationState = readReservations(root), strategyOverride) {
  const strategy = validatedStrategy(root, strategyOverride);
  const disk = checkStorageHeadroom(root.dir, { allowSimulation: false });
  if (!disk.ok || disk.available === false || disk.simulatedByChaosMonkey
    || !Number.isSafeInteger(disk.totalBytes) || disk.totalBytes <= 0
    || !Number.isSafeInteger(disk.freeBytes) || disk.freeBytes < 0 || disk.freeBytes > disk.totalBytes) {
    fail("disk_measurement_unavailable", "Real available disk space could not be verified.");
  }
  const protectedFreeBytes = Math.max(2 * GIB, Math.ceil(disk.totalBytes * 0.1));
  const usableFreeBytes = Math.max(0, disk.freeBytes - protectedFreeBytes);
  const usedBytes = managedBytes(root);
  if (!Number.isSafeInteger(usableFreeBytes + usedBytes)) fail("budget_unavailable", "Preparation storage totals are invalid.");
  // Dynamic policy uses 20% of (free after protection + managed bytes). Moving
  // bytes from free space into managed output leaves this base stable. Full
  // outstanding reservations count again while partial outputs also count as
  // used: conservative double counting never grants extra physical headroom.
  const limitBytes = strategy.mode === "cloud_stream" ? 0 : strategy.storageAllocation === "fixed"
    ? Math.min(Math.floor(strategy.allocatedGb * GIB), Math.max(0, disk.totalBytes - protectedFreeBytes))
    : Math.floor((usableFreeBytes + usedBytes) * 0.2);
  const reservedBytes = reservationState.reservedBytes;
  const remainingBytes = Math.max(0, Math.min(limitBytes - usedBytes - reservedBytes, usableFreeBytes - reservedBytes));
  return {
    available: true, limitBytes, protectedFreeBytes, usedBytes, reservedBytes, remainingBytes,
    ...(remainingBytes === 0 ? { reason: strategy.mode === "cloud_stream"
      ? "Preparation is disabled by the streaming-only policy."
      : "No unreserved preparation space remains within the policy and protected free-space limits." } : {}),
  };
}

export function getPreparationBudget(stateDir = defaultStateDir(), options = {}) {
  try { return inspectBudget(stateRoot(stateDir), undefined, options.strategy); }
  catch (error) {
    return { available: false, limitBytes: 0, protectedFreeBytes: 0, usedBytes: 0, reservedBytes: 0, remainingBytes: 0,
      code: error.code || "budget_unavailable", reason: "Preparation storage, policy, or reservations could not be verified." };
  }
}

/**
 * Shared synchronous critical section for strategy changes and reservations.
 * The callback must not await or recursively acquire this lock. Unknown/stale
 * locks are never reclaimed automatically.
 */
export function withPreparationBudgetLock(stateDir = defaultStateDir(), callback) {
  const root = stateRoot(stateDir);
  const lock = path.join(root.dir, "preparation-reservations.json.lock");
  let handle;
  try { handle = fs.openSync(lock, "wx", 0o600); }
  catch (error) {
    if (error.code === "EEXIST") fail("budget_busy", "Another preparation or storage-policy update is in progress.");
    if (error.code === "ENOSPC") fail("storage_full", "There is no space to reserve preparation storage.");
    fail("budget_unavailable", "Preparation storage could not be locked.");
  }
  const owned = fs.fstatSync(handle, { bigint: true });
  try {
    const latestRoot = stateRoot(stateDir);
    if (latestRoot.dev !== root.dev || latestRoot.ino !== root.ino) fail("unsafe_preparation_path", "Preparation storage changed while acquiring its lock.");
    const result = callback();
    if (result && typeof result.then === "function") fail("invalid_budget_callback", "Preparation storage lock callbacks must be synchronous.");
    return result;
  } finally {
    fs.closeSync(handle);
    try {
      const current = fs.lstatSync(lock, { bigint: true });
      if (!current.isSymbolicLink() && current.dev === owned.dev && current.ino === owned.ino) fs.unlinkSync(lock);
    } catch { /* Missing or replaced lock is not ours to delete. */ }
  }
}

function writeReservations(root, ledger) {
  const serialized = JSON.stringify(ledger, null, 2);
  if (Buffer.byteLength(serialized) > MAX_LEDGER_BYTES) fail("reservation_limit", "Preparation reservation storage is full.");
  let persisted;
  try { persisted = safeWriteFileSync(path.join(root.dir, "preparation-reservations.json"), serialized); }
  catch { fail("reservation_save_failed", "Preparation reservations could not be saved."); }
  if (!persisted) fail("storage_full", "There is no space to save preparation reservations.");
}

export function reservePreparationBytes(maxBytes, stateDir = defaultStateDir()) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) return { ok: false, code: "invalid_reservation", reason: "Reserve a positive safe-integer byte limit." };
  try {
    return withPreparationBudgetLock(stateDir, () => {
      const root = stateRoot(stateDir);
      const state = readReservations(root);
      const budget = inspectBudget(root, state);
      if (maxBytes > budget.remainingBytes) return { ok: false, code: "preparation_budget_exceeded", reason: "The preparation exceeds unreserved policy or disk headroom.", budget };
      if (Object.keys(state.ledger.reservations).length >= MAX_RESERVATIONS) fail("reservation_limit", "Too many preparation reservations are active.");
      const id = randomUUID();
      state.ledger.reservations[id] = { maxBytes, createdAt: Date.now() };
      writeReservations(root, state.ledger);
      return { ok: true, id, maxBytes, budget: { ...budget, reservedBytes: budget.reservedBytes + maxBytes, remainingBytes: budget.remainingBytes - maxBytes } };
    });
  } catch (error) { return failure(error); }
}

export function releasePreparationReservation(id, stateDir = defaultStateDir()) {
  if (typeof id !== "string" || !UUID.test(id)) return { ok: false, code: "invalid_reservation", reason: "Supply the reservation ID returned by this service." };
  try {
    return withPreparationBudgetLock(stateDir, () => {
      const root = stateRoot(stateDir);
      const { ledger } = readReservations(root);
      if (!Object.hasOwn(ledger.reservations, id)) return { ok: false, code: "reservation_not_found", reason: "This preparation reservation is not active." };
      delete ledger.reservations[id];
      writeReservations(root, ledger);
      return { ok: true, id, released: true };
    });
  } catch (error) { return failure(error); }
}
