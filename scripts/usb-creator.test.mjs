import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { join } from "node:path";
import os from "node:os";
import {
  listTargetDisks,
  validateSafeTarget,
  flashImageToRawDisk,
  verifyRawDisk,
  createLiveUsb,
  SECTOR_SIZE,
  CHUNK_SIZE,
} from "../src/installer/reelos-usb-creator.mjs";

test("USB Creator: listTargetDisks identifies USB drives and enforces system disk protection", () => {
  const disks = listTargetDisks();
  assert.ok(Array.isArray(disks));
  assert.ok(disks.length > 0);

  // Drive 0 / System disk must NEVER be safeToFlash
  const sysDisk = disks.find((d) => d.deviceNumber === 0 || d.isSystem);
  if (sysDisk) {
    assert.equal(sysDisk.safeToFlash, false, "System disk / Drive 0 must never be safe to flash");
  }
});

test("USB Creator: validateSafeTarget rejects OS drive, PhysicalDrive0, and C:", () => {
  assert.equal(validateSafeTarget("\\\\.\\PhysicalDrive0").safe, false);
  assert.equal(validateSafeTarget("0").safe, false);
  assert.equal(validateSafeTarget("C:").safe, false);
  assert.match(validateSafeTarget("0").error, /system OS drive/i);

  // Validates an approved USB drive from mock disk list
  const mockDisks = [
    { id: "\\\\.\\PhysicalDrive0", deviceNumber: 0, isSystem: true, isUsb: false, safeToFlash: false, name: "NVMe" },
    { id: "\\\\.\\PhysicalDrive2", deviceNumber: 2, isSystem: false, isUsb: true, safeToFlash: true, name: "ThumbDrive" },
  ];

  const okTarget = validateSafeTarget(2, mockDisks);
  assert.equal(okTarget.safe, true);
  assert.equal(okTarget.disk.name, "ThumbDrive");

  const badTarget = validateSafeTarget(0, mockDisks);
  assert.equal(badTarget.safe, false);
});

test("USB Creator: flashImageToRawDisk dryRun computes hash and calls progress callback", async () => {
  const tempImg = join(os.tmpdir(), "reelos-test-live.iso");
  // Create a 128KB dummy image
  const dummyData = Buffer.alloc(128 * 1024, 0xa5);
  fs.writeFileSync(tempImg, dummyData);

  try {
    const mockDisks = [
      { id: "\\\\.\\PhysicalDrive3", deviceNumber: 3, isSystem: false, isUsb: true, safeToFlash: true, name: "USB" },
    ];

    const progressEvents = [];
    const res = await flashImageToRawDisk(tempImg, 3, {
      dryRun: true,
      diskList: mockDisks,
      onProgress: (p) => progressEvents.push(p),
    });

    assert.equal(res.ok, true);
    assert.equal(res.dryRun, true);
    assert.equal(res.bytesWritten, 128 * 1024);
    assert.ok(res.hash);
    assert.ok(progressEvents.length > 0);
    assert.equal(progressEvents[progressEvents.length - 1].percent, 100);
  } finally {
    try { fs.unlinkSync(tempImg); } catch {}
  }
});

test("USB Creator: verifyRawDisk checks boot sector integrity", async () => {
  const tempImg = join(os.tmpdir(), "reelos-test-verify.iso");
  const dummyData = Buffer.alloc(64 * 1024, 0x5a);
  fs.writeFileSync(tempImg, dummyData);

  try {
    const mockDisks = [
      { id: "\\\\.\\PhysicalDrive4", deviceNumber: 4, isSystem: false, isUsb: true, safeToFlash: true, name: "USB" },
    ];

    const res = await verifyRawDisk(tempImg, 4, { diskList: mockDisks });
    assert.equal(res.ok, true);
    assert.equal(res.verified, true);
    assert.ok(res.hash);
  } finally {
    try { fs.unlinkSync(tempImg); } catch {}
  }
});

test("USB Creator: createLiveUsb executes high-level creation pipeline", async () => {
  const tempImg = join(os.tmpdir(), "reelos-test-full.iso");
  const dummyData = Buffer.alloc(32 * 1024, 0xee);
  fs.writeFileSync(tempImg, dummyData);

  try {
    const mockDisks = [
      { id: "\\\\.\\PhysicalDrive5", deviceNumber: 5, isSystem: false, isUsb: true, safeToFlash: true, name: "USB" },
    ];

    const res = await createLiveUsb(tempImg, 5, { dryRun: true, diskList: mockDisks });
    assert.equal(res.ok, true);
    assert.equal(res.verified, true);
    assert.equal(res.bytesWritten, 32 * 1024);
  } finally {
    try { fs.unlinkSync(tempImg); } catch {}
  }
});

test("USB Creator: supports 4Kn Advanced Format (4096-byte sector) alignment", async () => {
  const tempImg = join(os.tmpdir(), "reelos-test-4kn.iso");
  // Non-aligned byte count (e.g. 10000 bytes)
  const dummyData = Buffer.alloc(10000, 0x7c);
  fs.writeFileSync(tempImg, dummyData);

  try {
    const mockDisks = [
      { id: "\\\\.\\PhysicalDrive6", deviceNumber: 6, isSystem: false, isUsb: true, safeToFlash: true, name: "4Kn-USB" },
    ];

    const res = await flashImageToRawDisk(tempImg, 6, {
      dryRun: true,
      sectorSize: 4096,
      diskList: mockDisks,
    });

    assert.equal(res.ok, true);
    assert.equal(res.dryRun, true);
    assert.equal(res.bytesWritten, 10000);
    assert.ok(res.hash);
  } finally {
    try { fs.unlinkSync(tempImg); } catch {}
  }
});

