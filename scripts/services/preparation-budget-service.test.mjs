import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { beforeEach, afterEach, describe, it } from "node:test";
import {
  getPreparationBudget, reservePreparationBytes, releasePreparationReservation, withPreparationBudgetLock,
} from "./preparation-budget-service.mjs";
import { DEFAULT_STRATEGY } from "./media-strategy-service.mjs";
import { chaosMonkeyService } from "./chaos-monkey-service.mjs";

const GIB = 1024 ** 3;
describe("Preparation disk and policy reservations", () => {
  let stateDir, prepared, ledgerFile, lockFile;
  beforeEach(() => {
    stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "preparation-budget-"));
    prepared = path.join(stateDir, "prepared-media");
    ledgerFile = path.join(stateDir, "preparation-reservations.json");
    lockFile = ledgerFile + ".lock";
    policy();
    chaosMonkeyService.reset();
  });
  afterEach(() => {
    chaosMonkeyService.reset();
    fs.rmSync(stateDir, { recursive: true, force: true });
  });
  function policy(patch = {}) {
    fs.writeFileSync(path.join(stateDir, "media-strategy.json"), JSON.stringify({ ...DEFAULT_STRATEGY, ...patch }));
  }
  function disk(t, free = 50 * GIB, total = 100 * GIB) {
    return t.mock.method(fs, "statfsSync", () => ({ bsize: 1, blocks: total, bavail: free, bfree: free }));
  }
  function ledger() { return JSON.parse(fs.readFileSync(ledgerFile, "utf8")); }

  it("measures real isolated storage without creating a managed directory or reservation file", () => {
    const measured = fs.statfsSync(stateDir);
    const result = getPreparationBudget(stateDir);
    assert.equal(result.available, true);
    assert.equal(result.protectedFreeBytes, Math.max(2 * GIB, Math.ceil(Number(measured.bsize) * Number(measured.blocks) * 0.1)));
    assert.equal(result.usedBytes, 0);
    assert.equal(result.reservedBytes, 0);
    assert.equal(fs.existsSync(prepared), false);
    assert.equal(fs.existsSync(ledgerFile), false);
  });

  it("uses a stable dynamic formula and counts staging output against both full reservations and policy", (t) => {
    let free = 50 * GIB;
    t.mock.method(fs, "statfsSync", () => ({ bsize: 1, blocks: 100 * GIB, bavail: free, bfree: free }));
    assert.equal(getPreparationBudget(stateDir).limitBytes, 8 * GIB);
    const reservation = reservePreparationBytes(GIB, stateDir);
    assert.equal(reservation.ok, true);
    fs.mkdirSync(prepared);
    fs.mkdirSync(path.join(prepared, ".staging"));
    const staging = path.join(prepared, ".staging", "partial.bin");
    fs.writeFileSync(staging, Buffer.alloc(4096));
    free -= 4096;
    const result = getPreparationBudget(stateDir);
    assert.equal(result.limitBytes, 8 * GIB);
    assert.equal(result.usedBytes, 4096);
    assert.equal(result.reservedBytes, GIB);
    assert.equal(result.remainingBytes, 7 * GIB - 4096);
    assert.equal(fs.statSync(staging).size, 4096);
  });

  it("bounds fixed policy by total protected capacity and available physical headroom", (t) => {
    disk(t, 12 * GIB, 100 * GIB);
    policy({ storageAllocation: "fixed", allocatedGb: 1000 });
    let snapshot = getPreparationBudget(stateDir);
    assert.equal(snapshot.limitBytes, 90 * GIB);
    assert.equal(snapshot.remainingBytes, 2 * GIB);
    assert.equal(reservePreparationBytes(2 * GIB + 1, stateDir).ok, false);
    assert.equal(reservePreparationBytes(2 * GIB, stateDir).ok, true);
    snapshot = getPreparationBudget(stateDir);
    assert.equal(snapshot.remainingBytes, 0);
    assert.equal(reservePreparationBytes(1, stateDir).ok, false);
  });

  it("refuses unsupported external-mount policies instead of measuring the state volume for them", (t) => {
    disk(t);
    policy({ dedicatedUsbMount: path.join(stateDir, "external") });
    assert.equal(getPreparationBudget(stateDir).available, false);
    assert.equal(reservePreparationBytes(1, stateDir).ok, false);
    assert.equal(fs.existsSync(ledgerFile), false);
    policy();
    assert.equal(getPreparationBudget(stateDir, { strategy: { ...DEFAULT_STRATEGY, dedicatedUsbMount: "/mnt/external" } }).available, false);
  });

  it("protects at least 2GiB on tiny disks and grants no space under cloud-stream policy", (t) => {
    const measured = disk(t, GIB, GIB);
    let snapshot = getPreparationBudget(stateDir);
    assert.equal(snapshot.available, true);
    assert.equal(snapshot.protectedFreeBytes, 2 * GIB);
    assert.equal(snapshot.remainingBytes, 0);
    assert.equal(reservePreparationBytes(1, stateDir).ok, false);
    measured.mock.restore();
    disk(t);
    policy({ mode: "cloud_stream", storageAllocation: "fixed", allocatedGb: 50 });
    snapshot = getPreparationBudget(stateDir);
    assert.equal(snapshot.limitBytes, 0);
    assert.equal(snapshot.remainingBytes, 0);
    assert.match(snapshot.reason, /disabled/);
    assert.equal(reservePreparationBytes(1, stateDir).ok, false);
  });

  it("fails closed on failed or invalid real measurements and never consults chaos simulations", (t) => {
    const failed = t.mock.method(fs, "statfsSync", () => { throw new Error("disk unavailable"); });
    assert.equal(getPreparationBudget(stateDir).available, false);
    assert.equal(reservePreparationBytes(1, stateDir).ok, false);
    failed.mock.restore();
    for (const [free, total] of [[NaN, 100], [100, 0], [-1, 100], [101, 100], [0.5, 100]]) {
      const mocked = disk(t, free, total);
      assert.equal(getPreparationBudget(stateDir).available, false);
      mocked.mock.restore();
    }
    disk(t);
    t.mock.method(chaosMonkeyService, "getStorageHeadroomOverride", () => { throw new Error("Budget must bypass simulation"); });
    assert.equal(getPreparationBudget(stateDir).remainingBytes, 8 * GIB);
    assert.equal(reservePreparationBytes(1024, stateDir).ok, true);
  });

  it("persists competing reservations across module reload and releases only the exact known capability", async (t) => {
    disk(t);
    policy({ storageAllocation: "fixed", allocatedGb: 1 });
    const first = reservePreparationBytes(GIB - 1, stateDir);
    assert.equal(first.ok, true);
    assert.equal(first.maxBytes, GIB - 1);
    assert.match(first.id, /^[a-f0-9-]{36}$/);
    const fresh = await import("./preparation-budget-service.mjs?reload=reservations");
    assert.equal(fresh.getPreparationBudget(stateDir).reservedBytes, GIB - 1);
    assert.equal(fresh.reservePreparationBytes(2, stateDir).ok, false);
    const second = fresh.reservePreparationBytes(1, stateDir);
    assert.equal(second.ok, true);
    assert.equal(releasePreparationReservation(randomUUID(), stateDir).code, "reservation_not_found");
    assert.equal(releasePreparationReservation("../unsafe", stateDir).code, "invalid_reservation");
    assert.equal(releasePreparationReservation(first.id, stateDir).released, true);
    assert.equal(getPreparationBudget(stateDir).reservedBytes, 1);
    assert.deepEqual(Object.keys(ledger().reservations), [second.id]);
    assert.equal(releasePreparationReservation(first.id, stateDir).ok, false);
  });

  it("uses the same cross-process lock for policy edits and reservation admission without reclaiming old locks", (t) => {
    disk(t);
    const blocked = withPreparationBudgetLock(stateDir, () => {
      assert.equal(reservePreparationBytes(1, stateDir).code, "budget_busy");
      const script = `import {reservePreparationBytes} from ${JSON.stringify(new URL("./preparation-budget-service.mjs", import.meta.url).href)}; process.stdout.write(JSON.stringify(reservePreparationBytes(1, process.argv[1])));`;
      const child = spawnSync(process.execPath, ["--input-type=module", "-e", script, stateDir], { encoding: "utf8", timeout: 10000 });
      assert.equal(child.status, 0, child.stderr);
      assert.equal(JSON.parse(child.stdout).code, "budget_busy");
      return "exclusive";
    });
    assert.equal(blocked, "exclusive");
    assert.equal(fs.existsSync(lockFile), false);
    fs.writeFileSync(lockFile, "unknown owner");
    fs.utimesSync(lockFile, new Date(0), new Date(0));
    assert.equal(reservePreparationBytes(1, stateDir).code, "budget_busy");
    assert.equal(fs.readFileSync(lockFile, "utf8"), "unknown owner");
  });

  it("revalidates the state-directory identity after lock acquisition before running any mutation callback", (t) => {
    disk(t);
    const open = fs.openSync, lstat = fs.lstatSync;
    let replaced = false, called = false;
    t.mock.method(fs, "openSync", (file, flags, ...args) => {
      const handle = open(file, flags, ...args);
      if (file === lockFile && flags === "wx") replaced = true;
      return handle;
    });
    t.mock.method(fs, "lstatSync", (file, ...args) => {
      const stat = lstat(file, ...args);
      return replaced && file === stateDir ? {
        ...stat, ino: typeof stat.ino === "bigint" ? stat.ino + 1n : stat.ino + 100, isDirectory: () => true, isSymbolicLink: () => false,
      } : stat;
    });
    assert.throws(() => withPreparationBudgetLock(stateDir, () => { called = true; }), { code: "unsafe_preparation_path" });
    assert.equal(called, false);
    assert.equal(fs.existsSync(lockFile), false);
    assert.equal(fs.existsSync(ledgerFile), false);
  });

  it("rereads disk, policy and ledger under the lock and supports a trusted candidate-policy snapshot", (t) => {
    disk(t);
    reservePreparationBytes(1024, stateDir);
    const candidate = { ...DEFAULT_STRATEGY, storageAllocation: "fixed", allocatedGb: 0 };
    const inspected = withPreparationBudgetLock(stateDir, () => getPreparationBudget(stateDir, { strategy: candidate }));
    assert.equal(inspected.limitBytes, 0);
    assert.equal(inspected.reservedBytes, 1024);
    assert.equal(getPreparationBudget(stateDir).limitBytes, 8 * GIB);
    const open = fs.openSync;
    t.mock.method(fs, "openSync", (file, flags, ...args) => {
      const handle = open(file, flags, ...args);
      if (file === lockFile && flags === "wx") policy({ mode: "cloud_stream" });
      return handle;
    });
    assert.equal(reservePreparationBytes(1, stateDir).ok, false);
    assert.equal(getPreparationBudget(stateDir).reservedBytes, 1024);
  });

  it("counts only regular managed files read-only and leaves originals unchanged on reserve and release", (t) => {
    disk(t);
    const original = path.join(stateDir, "original.mp4");
    fs.writeFileSync(original, "irreplaceable original bytes");
    fs.mkdirSync(prepared);
    fs.writeFileSync(path.join(prepared, "ready.mp4"), Buffer.alloc(1234));
    const before = fs.statSync(original);
    const snapshot = getPreparationBudget(stateDir);
    assert.equal(snapshot.usedBytes, 1234);
    const reservation = reservePreparationBytes(2048, stateDir);
    assert.equal(reservation.ok, true);
    assert.equal(releasePreparationReservation(reservation.id, stateDir).ok, true);
    assert.equal(fs.readFileSync(original, "utf8"), "irreplaceable original bytes");
    assert.equal(fs.statSync(original).mtimeMs, before.mtimeMs);
    assert.equal(fs.statSync(original).ctimeMs, before.ctimeMs);
    assert.equal(fs.statSync(path.join(prepared, "ready.mp4")).size, 1234);
  });

  it("rejects linked managed directories and leaves simulated linked children unscanned", (t) => {
    disk(t);
    fs.mkdirSync(prepared);
    const file = path.join(prepared, "foreign.mp4");
    fs.writeFileSync(file, "untouched");
    const lstat = fs.lstatSync;
    const leaf = t.mock.method(fs, "lstatSync", (target, ...args) => {
      const stat = lstat(target, ...args);
      return target === file ? { ...stat, isSymbolicLink: () => true } : stat;
    });
    assert.equal(getPreparationBudget(stateDir).available, false);
    assert.equal(reservePreparationBytes(1, stateDir).code, "unsafe_preparation_path");
    leaf.mock.restore();
    const linkedRoot = t.mock.method(fs, "lstatSync", (target, ...args) => {
      const stat = lstat(target, ...args);
      return target === stateDir ? { ...stat, isSymbolicLink: () => true } : stat;
    });
    assert.equal(getPreparationBudget(stateDir).available, false);
    linkedRoot.mock.restore();
    assert.equal(fs.readFileSync(file, "utf8"), "untouched");
    assert.equal(fs.existsSync(ledgerFile), false);
  });

  it("refuses real linked managed subdirectories when the host supports them", (t) => {
    disk(t);
    fs.mkdirSync(prepared);
    const originals = path.join(stateDir, "originals");
    fs.mkdirSync(originals);
    fs.writeFileSync(path.join(originals, "personal.mp4"), "private original");
    try { fs.symlinkSync(originals, path.join(prepared, "projection"), process.platform === "win32" ? "junction" : "dir"); }
    catch (error) {
      if (["EPERM", "EACCES", "ENOSYS"].includes(error.code)) { t.diagnostic("Native linked-directory fixture unavailable on this host."); return; }
      throw error;
    }
    assert.equal(getPreparationBudget(stateDir).available, false);
    assert.equal(reservePreparationBytes(1, stateDir).ok, false);
    assert.equal(fs.readFileSync(path.join(originals, "personal.mp4"), "utf8"), "private original");
  });

  it("bounds traversal depth and refuses a separate managed child volume", (t) => {
    disk(t);
    let current = prepared;
    fs.mkdirSync(current);
    for (let index = 0; index < 17; index++) { current = path.join(current, "d"); fs.mkdirSync(current); }
    assert.equal(getPreparationBudget(stateDir).code, "preparation_scan_limit");
    const lstat = fs.lstatSync;
    t.mock.method(fs, "lstatSync", (file, ...args) => {
      const stat = lstat(file, ...args);
      return file === prepared ? { ...stat, dev: stat.dev + 1, isSymbolicLink: () => false } : stat;
    });
    assert.equal(getPreparationBudget(stateDir).code, "unsafe_preparation_path");
  });

  it("stops managed enumeration at its entry bound without opening or changing original media", (t) => {
    disk(t);
    fs.mkdirSync(prepared);
    const managed = path.join(prepared, "output.bin");
    fs.writeFileSync(managed, "managed");
    let reads = 0, closed = false;
    t.mock.method(fs, "opendirSync", () => ({
      readSync() { reads++; return { name: "output.bin" }; },
      closeSync() { closed = true; },
    }));
    const result = getPreparationBudget(stateDir);
    assert.equal(result.available, false);
    assert.equal(result.code, "preparation_scan_limit");
    assert.equal(reads, 10000);
    assert.equal(closed, true);
    assert.equal(fs.readFileSync(managed, "utf8"), "managed");
    assert.equal(fs.existsSync(ledgerFile), false);
  });

  it("refuses corrupt, unknown-schema, invalid and excessive reservation data or malformed policy", (t) => {
    disk(t);
    for (const content of ["{bad", JSON.stringify({ schemaVersion: 2, reservations: {} }),
      JSON.stringify({ schemaVersion: 1, reservations: { [randomUUID()]: { maxBytes: -1, createdAt: 1 } } }),
      JSON.stringify({ schemaVersion: 1, reservations: { [randomUUID()]: { maxBytes: 1, createdAt: 1, profileId: "owner" } } })]) {
      fs.writeFileSync(ledgerFile, content);
      assert.equal(getPreparationBudget(stateDir).available, false);
      assert.equal(reservePreparationBytes(1, stateDir).ok, false);
      assert.equal(fs.readFileSync(ledgerFile, "utf8"), content);
    }
    const excessive = { schemaVersion: 1, reservations: Object.fromEntries(Array.from({ length: 4097 }, () => [randomUUID(), { maxBytes: 1, createdAt: 1 }])) };
    fs.writeFileSync(ledgerFile, JSON.stringify(excessive));
    assert.equal(getPreparationBudget(stateDir).available, false);
    assert.equal(reservePreparationBytes(1, stateDir).ok, false);
    const tooLarge = JSON.stringify({ schemaVersion: 1, reservations: {} }) + " ".repeat(1024 * 1024);
    fs.writeFileSync(ledgerFile, tooLarge);
    assert.equal(getPreparationBudget(stateDir).available, false);
    assert.equal(reservePreparationBytes(1, stateDir).ok, false);
    assert.equal(fs.readFileSync(ledgerFile, "utf8"), tooLarge);
    fs.writeFileSync(ledgerFile, JSON.stringify({ schemaVersion: 1, reservations: {} }));
    for (const content of ["{bad", "[]", JSON.stringify({ mode: "invented", storageAllocation: "fixed", allocatedGb: 5 })]) {
      fs.writeFileSync(path.join(stateDir, "media-strategy.json"), content);
      assert.equal(getPreparationBudget(stateDir).available, false);
      assert.equal(reservePreparationBytes(1, stateDir).ok, false);
    }
  });

  it("uses disk and outstanding reservations observed after lock acquisition rather than a previous snapshot", (t) => {
    let free = 50 * GIB;
    t.mock.method(fs, "statfsSync", () => ({ bsize: 1, blocks: 100 * GIB, bavail: free, bfree: free }));
    policy({ storageAllocation: "fixed", allocatedGb: 1 });
    assert.equal(getPreparationBudget(stateDir).remainingBytes, GIB);
    const open = fs.openSync;
    let change = "disk";
    t.mock.method(fs, "openSync", (file, flags, ...args) => {
      const handle = open(file, flags, ...args);
      if (file === lockFile && flags === "wx") {
        if (change === "disk") free = 10 * GIB;
        else fs.writeFileSync(ledgerFile, JSON.stringify({ schemaVersion: 1, reservations: { [randomUUID()]: { maxBytes: GIB, createdAt: 1 } } }));
      }
      return handle;
    });
    assert.equal(reservePreparationBytes(1, stateDir).ok, false);
    assert.equal(fs.existsSync(ledgerFile), false);
    free = 50 * GIB;
    change = "ledger";
    assert.equal(reservePreparationBytes(1, stateDir).ok, false);
    assert.equal(Object.keys(ledger().reservations).length, 1);
    assert.equal(getPreparationBudget(stateDir).reservedBytes, GIB);
  });

  it("acknowledges no failed reservation/release persistence and preserves existing reservations", (t) => {
    disk(t);
    for (const value of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1, "100"]) assert.equal(reservePreparationBytes(value, stateDir).ok, false);
    const first = reservePreparationBytes(1024, stateDir);
    const before = fs.readFileSync(ledgerFile, "utf8");
    for (const method of ["writeFileSync", "renameSync"]) {
      for (const code of ["ENOSPC", "EACCES"]) {
        const mock = t.mock.method(fs, method, () => { throw Object.assign(new Error(code), { code }); });
        let result, released;
        try {
          result = reservePreparationBytes(1024, stateDir);
          released = releasePreparationReservation(first.id, stateDir);
        } finally { mock.mock.restore(); }
        assert.equal(result.ok, false);
        assert.equal(released.ok, false);
        assert.equal(fs.readFileSync(ledgerFile, "utf8"), before);
        assert.equal(fs.existsSync(lockFile), false);
        assert.equal(fs.readdirSync(stateDir).some((file) => file.endsWith(".tmp")), false);
      }
    }
  });
});
