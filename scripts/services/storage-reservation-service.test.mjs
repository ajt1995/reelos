import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { StorageReservationAuthority } from "./storage-reservation-service.mjs";

const dirs = [];
const fixture = (freeBytes = 1000) => {
  const stateDir = fs.mkdtempSync(path.join(process.cwd(), ".reelos-storage-test-"));
  dirs.push(stateDir);
  return new StorageReservationAuthority({ stateDir, freeBytes });
};
test.after(() => dirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

test("storage reservations persist and cannot overcommit verified free bytes", () => {
  const first = fixture();
  const reserved = first.reserve(600, { workloadId: "analysis", workloadClass: "media_analysis" });
  assert.equal(reserved.ok, true);
  const restarted = new StorageReservationAuthority({ stateDir: first.stateDir, freeBytes: 1000 });
  assert.equal(restarted.reserve(401).code, "storage_full");
  assert.equal(restarted.snapshot().reservedBytes, 600);
  assert.equal(restarted.release(reserved.id).ok, true);
  assert.equal(restarted.snapshot().reservedBytes, 0);
});

test("reservation records contain no arbitrary metadata", () => {
  const authority = fixture();
  authority.reserve(10, { workloadId: "safe", workloadClass: "maintenance", credential: "NOPE" });
  assert.equal(JSON.stringify(authority.read()).includes("NOPE"), false);
});
