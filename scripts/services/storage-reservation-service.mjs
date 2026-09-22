import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { atomicWriteJsonSync } from "../utils/fs-atomic.mjs";

const SCHEMA = 1;

function initial() { return { schemaVersion: SCHEMA, reservations: {} }; }

export class StorageReservationAuthority {
  constructor({ stateDir, storageRoot = stateDir, freeBytes = null, now = () => Date.now() } = {}) {
    if (!stateDir) throw new TypeError("stateDir is required");
    this.stateDir = path.resolve(stateDir);
    this.storageRoot = path.resolve(storageRoot || stateDir);
    this.file = path.join(this.stateDir, "storage-reservations.json");
    this.freeBytesOverride = freeBytes;
    this.now = now;
  }

  read() {
    if (!fs.existsSync(this.file)) return initial();
    const stat = fs.lstatSync(this.file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw Object.assign(new Error("Storage reservations need recovery."), { code: "storage_reservations_invalid" });
    let value;
    try { value = JSON.parse(fs.readFileSync(this.file, "utf8")); } catch { throw Object.assign(new Error("Storage reservations need recovery."), { code: "storage_reservations_invalid" }); }
    if (value?.schemaVersion !== SCHEMA || !value.reservations || typeof value.reservations !== "object") throw Object.assign(new Error("Storage reservations need recovery."), { code: "storage_reservations_invalid" });
    return value;
  }

  write(state) { atomicWriteJsonSync(this.file, state, { mode: 0o600 }); }

  freeBytes() {
    if (Number.isSafeInteger(this.freeBytesOverride)) return this.freeBytesOverride;
    fs.mkdirSync(this.storageRoot, { recursive: true });
    const stat = fs.statfsSync(this.storageRoot, { bigint: true });
    const bytes = stat.bavail * stat.bsize;
    return bytes > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(bytes);
  }

  reserve(bytes, metadata = {}) {
    if (!Number.isSafeInteger(bytes) || bytes <= 0) return { ok: false, code: "invalid_reservation", reason: "A positive storage reservation is required." };
    const state = this.read();
    const committed = Object.values(state.reservations).reduce((sum, item) => sum + Number(item.bytes || 0), 0);
    if (this.freeBytes() - committed < bytes) return { ok: false, code: "storage_full", reason: "There is not enough verified free storage." };
    const id = randomUUID();
    state.reservations[id] = {
      id, bytes, workloadId: String(metadata.workloadId || "unknown").slice(0, 256),
      workloadClass: String(metadata.workloadClass || "unknown").slice(0, 64),
      hardwareGeneration: Number.isSafeInteger(metadata.hardwareGeneration) ? metadata.hardwareGeneration : 0,
      ownerPid: process.pid, createdAt: this.now(),
    };
    this.write(state);
    return { ok: true, id };
  }

  release(id) {
    const state = this.read();
    if (!Object.hasOwn(state.reservations, id)) return { ok: false, code: "reservation_missing" };
    delete state.reservations[id];
    this.write(state);
    return { ok: true };
  }

  snapshot() {
    const state = this.read();
    const reservations = Object.values(state.reservations);
    return {
      available: true,
      freeBytes: this.freeBytes(),
      reservedBytes: reservations.reduce((sum, item) => sum + Number(item.bytes || 0), 0),
      reservations: reservations.length,
    };
  }
}
