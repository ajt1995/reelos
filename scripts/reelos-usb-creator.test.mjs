import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  UBUNTU_ISO_OFFICIAL_URL,
  detectIsoFile,
  listUsbDrives,
  prepareSeedDirectory,
} from "./reelos-usb-creator.mjs";

test("UBUNTU_ISO_OFFICIAL_URL points to Ubuntu 24.04 official live server", () => {
  assert.match(UBUNTU_ISO_OFFICIAL_URL, /releases\.ubuntu\.com\/24\.04/);
  assert.match(UBUNTU_ISO_OFFICIAL_URL, /live-server-amd64\.iso$/);
});

test("listUsbDrives returns { ok: true, drives: [...] } shape with id", () => {
  const res = listUsbDrives();
  assert.equal(typeof res.ok, "boolean");
  assert.equal(Array.isArray(res.drives), true);
  // Never allow Disk 0 / sda
  for (const d of res.drives) {
    assert.notEqual(d.device, "\\\\.\\PhysicalDrive0");
    assert.notEqual(d.device, "/dev/sda");
    assert.equal(typeof d.id, "string");
  }
});

test("detectIsoFile checks directories safely and returns file metadata", () => {
  const res = detectIsoFile();
  assert.equal(typeof res.found, "boolean");
  assert.equal(typeof res.officialUrl, "string");
  assert.equal(typeof res.sizeGb, "string");

  // Test with mock ISO directory
  const tmp = mkdtempSync(join(tmpdir(), "reelos-iso-mock-"));
  try {
    const mockIsoPath = join(tmp, "ubuntu-24.04-live-server-amd64.iso");
    writeFileSync(mockIsoPath, "mock ISO data content for test");
    const foundRes = detectIsoFile([tmp]);
    assert.equal(foundRes.found, true);
    assert.equal(foundRes.filename, "ubuntu-24.04-live-server-amd64.iso");
    assert.equal(foundRes.path, mockIsoPath);
    assert.equal(typeof foundRes.sizeGb, "string");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("prepareSeedDirectory creates user-data, meta-data, and pre-seeds answers.json in root and nocloud", () => {
  const tmp = mkdtempSync(join(tmpdir(), "reelos-usb-test-"));
  try {
    const mockAnswers = {
      source: "torbox",
      apiKey: "test-api-key-123",
      adminName: "Resident",
      storageMode: "debrid",
    };
    const res = prepareSeedDirectory(mockAnswers, tmp);
    assert.equal(res.ok, true);
    assert.equal(existsSync(join(tmp, "user-data")), true);
    assert.equal(existsSync(join(tmp, "meta-data")), true);
    assert.equal(existsSync(join(tmp, "nocloud", "user-data")), true);
    assert.equal(existsSync(join(tmp, "nocloud", "meta-data")), true);
    assert.equal(existsSync(join(tmp, "seed", "answers.json")), true);
    assert.equal(existsSync(join(tmp, "nocloud", "answers.json")), true);
    assert.equal(existsSync(join(tmp, "answers.json")), true);

    const saved = JSON.parse(readFileSync(join(tmp, "seed", "answers.json"), "utf8"));
    assert.equal(saved.source, "torbox");
    assert.equal(saved.apiKey, "test-api-key-123");
    assert.equal(saved.adminName, "Resident");

    const savedNocloud = JSON.parse(readFileSync(join(tmp, "nocloud", "answers.json"), "utf8"));
    assert.equal(savedNocloud.source, "torbox");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("prepareSeedDirectory supports clean install with empty answers and nocloud subfolder target", () => {
  const tmp = mkdtempSync(join(tmpdir(), "reelos-clean-test-"));
  try {
    const nocloudTarget = join(tmp, "nocloud");
    const res = prepareSeedDirectory({}, nocloudTarget);
    assert.equal(res.ok, true);
    assert.equal(existsSync(join(nocloudTarget, "user-data")), true);
    assert.equal(existsSync(join(nocloudTarget, "meta-data")), true);
    assert.equal(existsSync(join(tmp, "user-data")), true);
    assert.equal(existsSync(join(tmp, "meta-data")), true);

    const cleanSeed = JSON.parse(readFileSync(join(nocloudTarget, "seed", "answers.json"), "utf8"));
    assert.deepEqual(cleanSeed, {});
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
