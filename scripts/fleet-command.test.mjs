import assert from "node:assert/strict";
import { test } from "node:test";
import { FleetStore } from "../fleet/store.mjs";

test("fleet: recordHeartbeat stores new box and updates existing", () => {
  const store = new FleetStore(":memory:");
  const box1 = {
    box_id: "testbox-123456",
    version: "1.5.15",
    sha: "ed4fbdd",
    channel: "stable",
    ram_mb: 3311,
    disk_kind: "rotational",
    arch: "x86_64",
    uptime_seconds: 7200,
    services: { door: true, jellyfin: true, debrid: true },
  };

  const res = store.recordHeartbeat(box1, "192.168.1.234");
  assert.equal(res.ok, true);

  const boxes = store.listBoxes();
  assert.equal(boxes.length, 1);
  assert.equal(boxes[0].boxId, "testbox-123456");
  assert.equal(boxes[0].version, "1.5.15");
  assert.equal(boxes[0].ip, "192.168.1.234");
  assert.equal(boxes[0].isOnline, true);
  assert.equal(boxes[0].diskKind, "rotational");
});

test("fleet: getSummary aggregates fleet statistics accurately", () => {
  const store = new FleetStore(":memory:");
  store.recordHeartbeat({
    box_id: "box-alpha",
    version: "1.5.15",
    channel: "stable",
    ram_mb: 4096,
    disk_kind: "rotational",
    arch: "x86_64",
    uptime_seconds: 3600,
    services: { door: true, jellyfin: true, debrid: true },
  }, "192.168.1.10");

  store.recordHeartbeat({
    box_id: "box-beta",
    version: "1.5.14",
    channel: "beta",
    ram_mb: 16384,
    disk_kind: "ssd",
    arch: "x86_64",
    uptime_seconds: 14400,
    services: { door: true, jellyfin: true, debrid: true },
  }, "192.168.1.20");

  const summary = store.getSummary();
  assert.equal(summary.totalBoxes, 2);
  assert.equal(summary.onlineCount, 2);
  assert.equal(summary.rotationalCount, 1);
  assert.equal(summary.ssdCount, 1);
  assert.equal(summary.versionCounts["1.5.15"], 1);
  assert.equal(summary.versionCounts["1.5.14"], 1);
});
