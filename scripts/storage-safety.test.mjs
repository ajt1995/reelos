import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("daemon and install/bin byte-for-byte parity for appliance USB scripts", () => {
  assert.equal(read("daemon/reelos-install-internal.sh"), read("install/bin/reelos-install-internal.sh"));
  assert.equal(read("daemon/reelos-expand-usb.sh"), read("install/bin/reelos-expand-usb.sh"));
  assert.equal(read("daemon/reelos-hotspot.sh"), read("install/bin/reelos-hotspot.sh"));
  assert.equal(read("daemon/console-card.sh"), read("install/bin/console-card.sh"));
});

test("internal install script strictly requires --confirm-phrase ERASE", () => {
  const code = read("daemon/reelos-install-internal.sh");
  assert.match(code, /--confirm-phrase ERASE/);
  assert.match(code, /CONFIRM="\$\{2:-\}"/);
  assert.match(code, /\[ "\$CONFIRM" != "ERASE" \]/);
  assert.match(code, /Refusing install/);
  assert.match(code, /efibootmgr/);
});

test("expand usb script configures volatile RAM journal to prevent flash wear", () => {
  const code = read("daemon/reelos-expand-usb.sh");
  assert.match(code, /Storage=volatile/);
  assert.match(code, /RuntimeMaxUse=64M/);
  assert.match(code, /resize2fs/);
});

test("hotspot script manages captive portal DNS redirection for setup", () => {
  const code = read("daemon/reelos-hotspot.sh");
  assert.match(code, /ReelOS-Setup/);
  assert.match(code, /192\.168\.4\.1/);
  assert.match(code, /captive\.apple\.com/);
  assert.match(code, /connectivitycheck\.gstatic\.com/);
});

test("reelos-lookup-plugin strictly validates confirmPhrase === 'ERASE' for /api/disks/migrate-internal", () => {
  const code = read("scripts/reelos-lookup-plugin.mjs");
  assert.match(code, /confirmPhrase !== "ERASE"/);
  assert.match(code, /Must type ERASE to confirm wiping internal drive/);
  assert.match(code, /\/api\/disks\/migrate-internal/);
  assert.match(code, /\/api\/wifi\/status/);
  assert.match(code, /\/api\/wifi\/scan/);
  assert.match(code, /\/api\/wifi\/connect/);
});

test("console card renders dual-panel setup and 15m screen blanking post-setup", () => {
  const code = read("daemon/console-card.sh");
  assert.match(code, /PANEL 1: SCAN WITH PHONE/);
  assert.match(code, /PANEL 2: OR CONNECT MANUALLY/);
  assert.match(code, /ReelOS-Setup/);
  assert.match(code, /setterm --blank 15 --powerdown 15/);
  // setterm must appear in draw_setup(), not just draw_post_setup()
  const setupStart = code.indexOf("draw_setup()");
  const setupEnd = code.indexOf("\ndraw() {");
  const setupFn = code.slice(setupStart, setupEnd > setupStart ? setupEnd : undefined);
  assert.match(setupFn, /setterm --blank 15 --powerdown 15/);
});

test("laptop lid close inhibits sleep for 24/7 clamshell mode", () => {
  const code = read("daemon/reelos-lid.sh");
  assert.match(code, /HandleLidSwitch=ignore/);
  assert.match(code, /HandleLidSwitchExternalPower=ignore/);
  assert.match(code, /mask sleep\.target suspend\.target/);
});

test("looksLikeSceneRelease parses scene strings and repairs raw dump titles", async () => {
  const { looksLikeSceneRelease } = await import("./reelos-library.mjs");
  assert.equal(looksLikeSceneRelease("Minions.And.Monsters.2026.2160p.UHD.BluRay.REMUX"), true);
  assert.equal(looksLikeSceneRelease("Inception.1080p.BluRay.x264"), true);
  assert.equal(looksLikeSceneRelease("The.Dark.Knight.720p.WEB-DL"), true);
  assert.equal(looksLikeSceneRelease("The Dark Knight (2008)"), false);
  assert.equal(looksLikeSceneRelease("Breaking Bad S01E01"), false);
});

test("handleLibraryReset purges Seerr requests, media, parked symlinks, and invalidates cache", () => {
  const code = read("scripts/reelos-lookup-plugin.mjs");
  assert.match(code, /\/api\/v1\/request\/\$\{item\.id\}/);
  assert.match(code, /\/api\/v1\/media\/\$\{item\.id\}/);
  assert.match(code, /\/mnt\/symlinks\/\.reel-parked/);
  assert.match(code, /writeRemovedTitleIds\(new Set\(\)\)/);
  assert.match(code, /invalidateRequestProgressCache\(\)/);
  assert.match(code, /invalidateRequestListCache\(\)/);
});

test("request progress plugin implements 2.5s TTL cache and exportable invalidation", () => {
  const code = read("scripts/reelos-request-progress-plugin.mjs");
  assert.match(code, /export function invalidateRequestProgressCache/);
  assert.match(code, /Date\.now\(\) - _requestListCacheAt < 2500/);
});

test("reelos-hotspot.sh twin parity between daemon and install/bin", () => {
  assert.equal(read("daemon/reelos-hotspot.sh"), read("install/bin/reelos-hotspot.sh"),
    "daemon/reelos-hotspot.sh and install/bin/reelos-hotspot.sh must be byte-identical");
  assert.equal(read("daemon/console-card.sh"), read("install/bin/console-card.sh"),
    "daemon/console-card.sh and install/bin/console-card.sh must be byte-identical");
});

test("wifi API handlers preserve service truth and handle errors", () => {
  const code = read("scripts/reelos-lookup-plugin.mjs");
  // Status and scan must preserve service success/failure rather than force success.
  assert.match(code, /async function handleWifiStatus/);
  assert.match(code, /ok: Boolean\(result\.ok\),\s*\n\s*hotspotActive/);
  assert.match(code, /async function handleWifiScan/);
  assert.match(code, /supported: result\.supported !== false/);
  // handleWifiConnect returns ok:true on success
  assert.match(code, /async function handleWifiConnect/);
  assert.match(code, /ok: true, connected: true, ssid/);
  // All three have error handling (try/catch returning ok:false)
  const statusFn = code.slice(code.indexOf("async function handleWifiStatus"), code.indexOf("async function handleWifiScan"));
  assert.match(statusFn, /ok: false, error/);
  const scanFn = code.slice(code.indexOf("async function handleWifiScan"), code.indexOf("async function handleWifiConnect"));
  assert.match(scanFn, /ok: false, error/);
  const connectFn = code.slice(code.indexOf("async function handleWifiConnect"), code.indexOf("async function handleStorage"));
  assert.match(connectFn, /ok: false, error/);
  // Routes registered correctly
  assert.match(code, /\/api\/wifi\/status/);
  assert.match(code, /\/api\/wifi\/scan/);
  assert.match(code, /\/api\/wifi\/connect/);
});

test("handleRemove triggers Radarr delete, symlink wipe, JF purge, and cache invalidation", async () => {
  const {
    removeLibraryTitle,
    planArrDeleteUrl,
    deleteFilesAllowed,
  } = await import("./reelos-library-remove.mjs");

  const calls = { radarrDel: null, jfDel: null, removedIds: null };

  const mockFetchArr = async (url, _key, _ms, opts = {}) => {
    // List call returns one movie on a symlink-safe path
    if (!opts.method) return [{ id: 42, tmdbId: 999, path: "/mnt/symlinks/radarr/Some Movie (2024)" }];
    // PUT unmonitor — ignore
    if (opts.method === "PUT") return {};
    // DELETE call — capture url
    if (opts.method === "DELETE") { calls.radarrDel = url; return {}; }
    return {};
  };

  const result = await removeLibraryTitle({
    titleId: "tmdb-999",
    tmdb: "999",
    mediaType: "movie",
    jellyfinId: "abc123jfid",
    confirm: true,
    shelf: [],
    seerrKey: null,          // skip Seerr for this unit test
    fetchArr: mockFetchArr,
    radarrKey: "test-key",
    sonarrKey: null,
    jellyfinGetItem: async () => ({ Path: "/mnt/symlinks/radarr/Some Movie (2024)/movie.mkv" }),
    jellyfinDeleteItem: async (id) => { calls.jfDel = id; },
    onRemovedIds: (keys) => { calls.removedIds = keys; },
  });

  // Radarr DELETE fired with deleteFiles=true (symlink path is allowed)
  assert.ok(result.ok, `removeLibraryTitle returned ok=false: ${result.error}`);
  assert.ok(calls.radarrDel, "Radarr DELETE url was not called");
  assert.match(calls.radarrDel, /deleteFiles=true/, "Radarr DELETE must include deleteFiles=true");
  assert.match(calls.radarrDel, /\/api\/v3\/movie\/42/, "Radarr DELETE must target the *arr movie id");
  // JF purge fired
  assert.equal(calls.jfDel, "abc123jfid", "Jellyfin DELETE must fire with the jellyfinId");
  // Cache invalidation keys recorded
  assert.ok(Array.isArray(calls.removedIds) && calls.removedIds.length > 0, "onRemovedIds must receive at least one key");
  // steps confirm all phases ran
  assert.ok(result.steps.arr?.deleteFiles, "steps.arr.deleteFiles should be true for symlink path");
  assert.ok(result.steps.jellyfin?.deleted, "steps.jellyfin.deleted should be true");
});

test("remove endpoint refuses requests without a valid titleId", async () => {
  const { removeLibraryTitle } = await import("./reelos-library-remove.mjs");

  // No titleId, no jellyfinId, no ids — should bounce with ok:false
  const r1 = await removeLibraryTitle({ confirm: true, shelf: [], titleId: "" });
  assert.equal(r1.ok, false, "empty titleId must be rejected");
  assert.ok(r1.error, "rejection must carry an error message");

  // Confirm=false should also be rejected regardless of titleId
  const r2 = await removeLibraryTitle({ confirm: false, titleId: "tmdb-1", shelf: [] });
  assert.equal(r2.ok, false, "missing confirm must be rejected");
  assert.match(r2.error, /Confirm/i, "rejection must mention Confirm");
});

test("JF item is purged even when path is local-disk (not a symlink folder)", async () => {
  const { removeLibraryTitle } = await import("./reelos-library-remove.mjs");

  let jfDelCalled = false;

  const result = await removeLibraryTitle({
    titleId: "tmdb-777",
    tmdb: "777",
    mediaType: "movie",
    jellyfinId: "localid99",
    confirm: true,
    shelf: [],
    seerrKey: null,
    fetchArr: null,           // no *arr for this test
    radarrKey: null,
    sonarrKey: null,
    jellyfinGetItem: async () => ({ Path: "/media/movies/Some Movie" }), // local-disk path
    jellyfinDeleteItem: async () => { jfDelCalled = true; },
    onRemovedIds: () => {},
  });

  assert.ok(result.ok, `removeLibraryTitle returned ok=false: ${result.error}`);
  assert.ok(jfDelCalled, "jellyfinDeleteItem must be called even for local-disk paths");
  assert.ok(result.steps.jellyfin?.deleted, "steps.jellyfin.deleted must be true for local-disk path");
});

test("handleLibrarySanitize routes and cleans scene titles", async () => {
  const code = read("scripts/reelos-lookup-plugin.mjs");
  assert.match(code, /\/api\/library\/sanitize/);
  assert.match(code, /async function handleLibrarySanitize/);
  assert.match(code, /sanitizeTitleString/);

  const { handleLibrarySanitize, sanitizeTitleString } = await import("./reelos-lookup-plugin.mjs");
  assert.equal(typeof handleLibrarySanitize, "function");
  assert.equal(typeof sanitizeTitleString, "function");

  // Verify title cleaning logic
  assert.equal(sanitizeTitleString("Inception.1080p.BluRay.x264"), "Inception");
  assert.equal(sanitizeTitleString("Minions.And.Monsters.2026.2160p.UHD.BluRay.REMUX"), "Minions And Monsters 2026");
  assert.equal(sanitizeTitleString("The Dark Knight (2008)"), "The Dark Knight (2008)");

  // Verify method check
  const makeMockRes = () => {
    const res = {
      statusCode: null,
      headers: {},
      body: null,
      setHeader: (k, v) => { res.headers[k] = v; },
      end: (b) => { res.body = JSON.parse(b); },
    };
    return res;
  };

  const res1 = makeMockRes();
  await handleLibrarySanitize({ method: "DELETE" }, res1);
  assert.equal(res1.statusCode, 405);
  assert.equal(res1.body.ok, false);

  // Verify GET/POST empty library returns ok:true
  const res2 = makeMockRes();
  await handleLibrarySanitize({ method: "POST" }, res2);
  assert.equal(res2.statusCode, 200);
  assert.equal(res2.body.ok, true);
});
