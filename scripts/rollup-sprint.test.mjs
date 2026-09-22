import assert from "node:assert/strict";
import { readFileSync, existsSync, unlinkSync, rmSync, mkdirSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";
import { loadPendingGuestRequests, savePendingGuestRequests, addPendingGuestRequest, removePendingGuestRequest } from "./reelos-guest-gate.mjs";
import { getCabinStatus, setCabinMode, syncTitleToVault } from "./reelos-cabin.mjs";

test("guest gate: add, list, and remove pending requests", () => {
  const tmpFile = join(process.cwd(), "scripts", "tmp-pending-test.json");
  try {
    savePendingGuestRequests([], tmpFile);
    assert.deepEqual(loadPendingGuestRequests(tmpFile), []);

    const added = addPendingGuestRequest({
      titleId: "tmdb-12345",
      title: "Inception",
      year: "2010",
      mediaType: "movie",
      requester: "Guest Friend",
    }, tmpFile);

    assert.equal(added.title, "Inception");
    assert.equal(added.requestedBy, "Guest Friend");

    const pending = loadPendingGuestRequests(tmpFile);
    assert.equal(pending.length, 1);
    assert.equal(pending[0].id, added.id);

    const removed = removePendingGuestRequest(added.id, tmpFile);
    assert.equal(removed?.id, added.id);
    assert.deepEqual(loadPendingGuestRequests(tmpFile), []);
  } finally {
    if (existsSync(tmpFile)) unlinkSync(tmpFile);
  }
});

test("cabin mode: get status, toggle state, and vault sync", () => {
  const tmpFile = join(process.cwd(), "scripts", "tmp-cabin-test.json");
  const tmpVault = join(process.cwd(), "scripts", "tmp-vault-test");
  try {
    if (existsSync(tmpFile)) unlinkSync(tmpFile);
    if (!existsSync(tmpVault)) mkdirSync(tmpVault, { recursive: true });

    const status1 = getCabinStatus(tmpFile, tmpVault);
    assert.equal(status1.ok, true);
    assert.equal(status1.active, false);

    const setRes = setCabinMode(true, tmpFile);
    assert.equal(setRes.ok, true);
    assert.equal(setRes.active, true);

    const status2 = getCabinStatus(tmpFile, tmpVault);
    assert.equal(status2.active, true);

    const syncRes = syncTitleToVault("movie-1", "Test Movie", null, tmpVault);
    assert.equal(syncRes.ok, true);
    assert.equal(syncRes.registered, true);
  } finally {
    if (existsSync(tmpFile)) unlinkSync(tmpFile);
    if (existsSync(tmpVault)) rmSync(tmpVault, { recursive: true, force: true });
  }
});

test("subtitles governor: config enforces single thread and safety limits", () => {
  const arrDaemon = readFileSync("daemon/wiring/arr.py", "utf8");
  const arrInstall = readFileSync("install/bin/wiring/arr.py", "utf8");
  assert.equal(arrDaemon, arrInstall, "arr.py must maintain byte-for-byte twin parity");

  assert.match(arrDaemon, /threads:\s*1/);
  assert.match(arrDaemon, /multithreading:\s*false/);
  assert.match(arrDaemon, /adaptive_searching:\s*false/);
  assert.match(arrDaemon, /subtitles_search_interval:\s*60/);
  assert.match(arrDaemon, /minimum_score:\s*80/);
});

test("systemd plumbing: battery guardian and usb automount unit files exist and are enabled in installer", () => {
  assert.ok(existsSync("install/systemd/reelos-battery-guardian.service"));
  assert.ok(existsSync("install/systemd/reelos-battery-guardian.timer"));
  assert.ok(existsSync("install/systemd/reelos-usb-automount.service"));
  assert.ok(existsSync("install/systemd/reelos-usb-automount.timer"));

  const installScript = readFileSync("install/reelos-install.sh", "utf8");
  const daemonScript = readFileSync("daemon/install.sh", "utf8");
  assert.equal(installScript, daemonScript, "install scripts must maintain byte-for-byte twin parity");

  assert.match(installScript, /reelos-battery-guardian\.service/);
  assert.match(installScript, /reelos-battery-guardian\.timer/);
  assert.match(installScript, /reelos-usb-automount\.service/);
  assert.match(installScript, /reelos-usb-automount\.timer/);
  assert.match(installScript, /systemctl enable.*reelos-battery-guardian\.timer/);
  assert.match(installScript, /systemctl enable.*reelos-usb-automount\.timer/);
});
