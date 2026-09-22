import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  generatePassportEnvelope,
  restorePassportEnvelope,
  exportToUsbThumbStick,
  getGoogleDriveStatus,
  setGoogleDriveLink,
  handlePassportRoute,
} from "./passport-service.mjs";
import { saveProfile, getProfile, getRequestActiveProfile, setActiveProfileId, getActiveProfileId } from "./profile-service.mjs";
import { replaceProfileSession } from "./profile-session-service.mjs";
import { registerAuthorizedDevice, signDeviceToken, getGateSecret, revokeAuthorizedDevice } from "./reelos-gate-service.mjs";

describe("ReelOS Passport & Cloud Backup Service", () => {
  let tempDir;
  let tempUsbDir;
  let ownerReq;
  let createdDirs;

  function sessionFor(profileId, stateDir = tempDir) {
    const device = registerAuthorizedDevice({ name: "Passport test", activeProfileId: profileId }, stateDir);
    const session = replaceProfileSession({}, path.join(stateDir, "profiles"), profileId, device.id);
    return { headers: { host: "127.0.0.1",
      cookie: `reelos_device_token=${signDeviceToken(device, getGateSecret(stateDir))}; reelos_profile_session=${session.token}`,
    }, socket: { remoteAddress: "127.0.0.1" }, deviceId: device.id };
  }

  function personalEnvelope(overrides = {}) {
    return { reelosPassportVersion: 1, scope: "profile", profiles: [{ id: "imported-person", name: "Imported person", savedIds: ["personal-save"] }], ...overrides };
  }

  async function route(routePath, { req = ownerReq, method = "GET", body, headers = {} } = {}) {
    let status, response, responseHeaders;
    const handled = await handlePassportRoute({ ...req, method, headers: { ...req?.headers, ...headers } }, {
      writeHead(code, values) { status = code; responseHeaders = values; },
      end(value) { response = JSON.parse(value); },
    }, new URL(`http://127.0.0.1${routePath}`), async () => body || {}, tempDir);
    return { handled, status, body: response, headers: responseHeaders };
  }

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-passport-test-"));
    tempUsbDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-usb-test-"));
    createdDirs = [tempDir, tempUsbDir];

    // Seed dummy profile
    saveProfile(
      {
        id: "res-primary",
        role: "owner",
        pin: "1234",
        name: "Primary User",
        avatar: "clapperboard",
        tasteVibe: "comfort",
        themeDesign: "oled_cinema",
        motionStyle: "cinematic",
        savedIds: ["owner-save"],
        bookProgress: { "owner-book": 0.4 },
      },
      path.join(tempDir, "profiles")
    );
    saveProfile({ id: "reader", name: "Reader", pin: "8642", progress: { "other-private": 0.8 },
      bookLocations: { "reader-book": "epubcfi(/6/18)" }, reactions: { "reader-love": "love" } }, path.join(tempDir, "profiles"));
    saveProfile({ id: "child", name: "Child", isKids: true, pin: "2468", maturity: "little", bedtime: "20:00",
      boundaries: { violence: "never" }, familyPlayback: { languageSeverity: "mild" } }, path.join(tempDir, "profiles"));
    ownerReq = sessionFor("res-primary");

    // Seed strategy
    fs.writeFileSync(path.join(tempDir, "media-strategy.json"), JSON.stringify({ mode: "smart_hybrid", allocatedGb: 50,
      dedicatedUsbMount: "private-device-path", credentials: { token: "strategy-secret" } }));

    // Seed curator & answers
    fs.writeFileSync(path.join(tempDir, "curator.json"), JSON.stringify({ liked: ["tmdb-949"], hidden: [] }));
    fs.writeFileSync(path.join(tempDir, "watchlist.json"), JSON.stringify({ titles: ["shared-private-title"] }));
    fs.writeFileSync(path.join(tempDir, "answers.json"), JSON.stringify({ houseName: "Living Room Lounge", source: "torbox", apiKey: "tb-secret-123",
      adminPassword: "admin-secret", providers: { password: "nested-secret" }, oauth: { refreshToken: "oauth-secret" } }));
  });

  afterEach(() => {
    for (const directory of createdDirs) fs.rmSync(directory, { recursive: true, force: true });
  });

  it("generates a complete portable personal passport without credentials even when includeSecrets is requested", () => {
    const envelope = generatePassportEnvelope({ stateDir: tempDir, req: ownerReq, includeSecrets: true });
    assert.equal(envelope.reelosPassportVersion, 1);
    assert.ok(envelope.exportedAt > 0);
    assert.equal(envelope.applianceName, "Living Room Lounge");
    assert.ok(Array.isArray(envelope.profiles));
    assert.equal(envelope.profiles.length, 1);
    assert.equal(envelope.profiles[0].id, "res-primary");
    assert.deepEqual(envelope.profiles[0].savedIds, ["owner-save"]);
    assert.deepEqual(envelope.profiles[0].bookProgress, { "owner-book": 0.4 });
    assert.equal(envelope.mediaStrategy.mode, "smart_hybrid");
    assert.deepEqual(envelope.answers, { houseName: "Living Room Lounge" });
    assert.doesNotMatch(JSON.stringify(envelope), /pinHash|scrypt:|secret|other-private|reader-love|shared-private|private-device-path/);
    assert.equal(envelope.curator, undefined);
    assert.equal(envelope.watchlist, undefined);
    assert.equal(envelope.profiles[0].role, undefined);
  });

  it("redacts sensitive keys when includeSecrets is false", () => {
    const envelope = generatePassportEnvelope({ stateDir: tempDir, req: ownerReq, includeSecrets: false });
    assert.equal(envelope.answers.apiKey, undefined);
    assert.equal(envelope.profiles[0].pinHash, undefined);
  });

  it("restores a passport envelope into an authenticated profile on a newly set-up installation", () => {
    const envelope = generatePassportEnvelope({ stateDir: tempDir, req: ownerReq });
    const cleanDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-clean-restore-"));
    createdDirs.push(cleanDir);
    saveProfile({ id: "new-owner", role: "owner", pin: "9876" }, path.join(cleanDir, "profiles"));
    const req = sessionFor("new-owner", cleanDir);

    const res = restorePassportEnvelope(envelope, { stateDir: cleanDir, req });
    assert.equal(res.ok, true);
    assert.ok(res.restored.profilesCount >= 1);
    assert.equal(res.restored.applianceName, "Living Room Lounge");

    // Verify restored file presence
    assert.ok(fs.existsSync(path.join(cleanDir, "profiles", "new-owner.json")));
    assert.equal(fs.existsSync(path.join(cleanDir, "profiles", "res-primary.json")), false);
    assert.equal(fs.existsSync(path.join(cleanDir, "curator.json")), false);
    assert.ok(fs.existsSync(path.join(cleanDir, "media-strategy.json")));
    assert.ok(fs.existsSync(path.join(cleanDir, "answers.json")));
    assert.deepEqual(getProfile("new-owner", path.join(cleanDir, "profiles")).savedIds, ["owner-save"]);
    assert.equal(getRequestActiveProfile(req, path.join(cleanDir, "profiles")).id, "new-owner");
  });

  it("refuses to restore an invalid or corrupted passport envelope", () => {
    const res = restorePassportEnvelope({ reelosPassportVersion: 999 }, { stateDir: tempDir, req: ownerReq });
    assert.equal(res.ok, false);
    assert.match(res.error, /unsupported version/i);
  });

  it("exports passport and portable launcher onto an external USB drive", () => {
    const res = exportToUsbThumbStick({
      usbMountPath: tempUsbDir,
      stateDir: tempDir,
      repoRoot: tempDir,
      req: ownerReq,
    });
    assert.equal(res.ok, true);
    assert.ok(fs.existsSync(path.join(tempUsbDir, "reelos-passport.json")));
    assert.ok(fs.existsSync(path.join(tempUsbDir, "PORTABLE_REELOS_STICK.txt")));

    const readmeContent = fs.readFileSync(path.join(tempUsbDir, "PORTABLE_REELOS_STICK.txt"), "utf8");
    assert.match(readmeContent, /Portable Media Server Thumb Stick/);
    assert.match(readmeContent, /reelos-setup\.bat/);
    assert.match(readmeContent, /not bootable media/);
    const exported = fs.readFileSync(path.join(tempUsbDir, "reelos-passport.json"), "utf8");
    assert.doesNotMatch(exported, /pinHash|scrypt:|secret|other-private|reader-love/);
  });

  it("fails Google Drive closed until an OAuth-backed adapter exists", () => {
    const initial = getGoogleDriveStatus();
    assert.equal(initial.ok, false);
    assert.equal(initial.available, false);

    const linked = setGoogleDriveLink({ email: "family@gmail.com", linked: true });
    assert.equal(linked.ok, false);
    assert.equal(linked.linked, false);
    assert.equal(linked.accountEmail, null);
  });

  it("handles HTTP /api/passport routes", async () => {
    let status = 0;
    let output = "";
    let headers = {};
    const fakeRes = {
      writeHead(s, h) { status = s; headers = h || {}; },
      end(data) { output = data; },
    };

    // 1. GET /api/passport/export
    const handledExport = await handlePassportRoute(
      { ...ownerReq, method: "GET" },
      fakeRes,
      new URL("http://127.0.0.1/api/passport/export"),
      null,
      tempDir
    );
    assert.equal(handledExport, true);
    assert.equal(status, 200);
    const parsedExport = JSON.parse(output);
    assert.equal(parsedExport.reelosPassportVersion, 1);
    assert.equal(headers["Cache-Control"], "no-store");

    // 2. POST /api/passport/google-sync
    const handledGoogle = await handlePassportRoute(
      { ...ownerReq, method: "POST" },
      fakeRes,
      new URL("http://127.0.0.1/api/passport/google-sync"),
      async () => ({ email: "test@google.com" }),
      tempDir
    );
    assert.equal(handledGoogle, true);
    assert.equal(status, 501);
    const parsedGoogle = JSON.parse(output);
    assert.equal(parsedGoogle.ok, false);
    assert.equal(parsedGoogle.available, false);
  });

  it("requires a device-bound profile session before export, import, USB, or cloud routes read a body", async () => {
    const cookies = ownerReq.headers.cookie.split("; ");
    const requests = [{}, { headers: { cookie: cookies[0] } }, { headers: { cookie: cookies[1] } },
      { headers: { cookie: "reelos_device_token=forged; reelos_profile_session=forged" } }];
    for (const req of requests) {
      for (const [pathname, method] of [["export", "GET"], ["import", "POST"], ["usb-export", "POST"], ["google-status", "GET"], ["google-sync", "POST"]]) {
        let status;
        await handlePassportRoute({ ...req, method }, { writeHead(code) { status = code; }, end() {} },
          new URL(`http://127.0.0.1/api/passport/${pathname}`), () => { assert.fail("Unauthorized requests must not consume bodies"); }, tempDir);
        assert.equal(status, 401, `${pathname} requires both credentials`);
      }
    }
  });

  it("rejects direct helper calls without an authorized profile and writes no USB files", () => {
    assert.throws(() => generatePassportEnvelope({ stateDir: tempDir }), (error) => error.status === 401);
    assert.equal(restorePassportEnvelope(personalEnvelope(), { stateDir: tempDir }).status, 401);
    assert.equal(exportToUsbThumbStick({ stateDir: tempDir, usbMountPath: tempUsbDir }).status, 401);
    assert.deepEqual(fs.readdirSync(tempUsbDir), []);
  });

  it("denies revoked devices and cookies from different authorized devices", async () => {
    const readerReq = sessionFor("reader");
    const combined = `${ownerReq.headers.cookie.split("; ")[0]}; ${readerReq.headers.cookie.split("; ")[1]}`;
    assert.equal((await route("/api/passport/export", { headers: { cookie: combined } })).status, 401);
    revokeAuthorizedDevice(ownerReq.deviceId, tempDir);
    assert.equal((await route("/api/passport/export")).status, 401);
  });

  it("exports only the member's personal data regardless of the legacy active profile", () => {
    setActiveProfileId("res-primary", path.join(tempDir, "profiles"));
    const envelope = generatePassportEnvelope({ stateDir: tempDir, req: sessionFor("reader"), includeSecrets: true });
    assert.equal(envelope.activeProfileId, "reader");
    assert.equal(envelope.profiles.length, 1);
    assert.deepEqual(envelope.profiles[0].reactions, { "reader-love": "love" });
    assert.equal(envelope.answers, undefined);
    assert.equal(envelope.mediaStrategy, undefined);
    assert.doesNotMatch(JSON.stringify(envelope), /owner-save|owner-book|pinHash|scrypt:|secret/);
  });

  it("drops nested credentials and malformed personal objects from exports", () => {
    const file = path.join(tempDir, "profiles", "res-primary.json");
    const profile = JSON.parse(fs.readFileSync(file, "utf8"));
    profile.mediaPriorities = { movies: 50, credentials: { apiKey: "nested-profile-secret" } };
    profile.reactions = { personal: "love", apiKey: "credential-secret" };
    profile.bookLocations = { refreshToken: "another-secret" };
    profile.extraData = { password: "unknown-secret" };
    fs.writeFileSync(file, JSON.stringify(profile));
    const envelope = generatePassportEnvelope({ stateDir: tempDir, req: ownerReq });
    assert.doesNotMatch(JSON.stringify(envelope), /secret|credentials|apiKey|refreshToken|extraData/);
  });

  it("does not reveal malformed home credentials in errors or import response metadata", async () => {
    const answersPath = path.join(tempDir, "answers.json");
    fs.writeFileSync(answersPath, '{"apiKey":"private-secret",broken');
    const failed = await route("/api/passport/export");
    assert.equal(failed.status, 503);
    assert.doesNotMatch(JSON.stringify(failed.body), /apiKey|private-secret/);
    fs.writeFileSync(answersPath, JSON.stringify({ houseName: { credentials: "private-secret" }, apiKey: "existing-secret" }));
    const imported = await route("/api/passport/import", { method: "POST", body: personalEnvelope({ answers: {} }) });
    assert.equal(imported.status, 200);
    assert.equal(imported.body.restored.applianceName, "Living Room");
    assert.doesNotMatch(JSON.stringify(imported.body), /credentials|private-secret|existing-secret/);
  });

  it("restores a personal round trip into the open profile without changing any family policy or other identity", () => {
    const profilesDir = path.join(tempDir, "profiles");
    const envelope = generatePassportEnvelope({ stateDir: tempDir, req: sessionFor("reader") });
    const before = getProfile("child", profilesDir);
    const readerBefore = fs.readFileSync(path.join(profilesDir, "reader.json"), "utf8");
    setActiveProfileId("res-primary", profilesDir);
    const childReq = sessionFor("child");
    const result = restorePassportEnvelope(envelope, { stateDir: tempDir, req: childReq });
    assert.equal(result.ok, true);
    assert.equal(result.restored.activeProfileId, "child");
    const after = getProfile("child", profilesDir);
    assert.deepEqual(after.reactions, { "reader-love": "love" });
    assert.deepEqual(after.bookLocations, { "reader-book": "epubcfi(/6/18)" });
    for (const key of ["id", "role", "pinHash", "isKids", "isGuest", "maturity", "bedtime", "boundaries", "familyPlayback", "expiresAt"]) {
      assert.deepEqual(after[key], before[key], `${key} is preserved`);
    }
    assert.equal(fs.readFileSync(path.join(profilesDir, "reader.json"), "utf8"), readerBefore);
    assert.equal(getRequestActiveProfile(childReq, profilesDir).id, "child");
    assert.equal(getActiveProfileId(profilesDir), "res-primary");
  });

  it("rejects legacy bulk, active-identity, global-history, role, PIN, and child-safety imports before any write", () => {
    const profilesDir = path.join(tempDir, "profiles");
    const before = fs.readFileSync(path.join(profilesDir, "child.json"), "utf8");
    const settingsBefore = fs.readFileSync(path.join(tempDir, "answers.json"), "utf8");
    const req = sessionFor("child");
    const payloads = [
      personalEnvelope({ profiles: [{ id: "child", savedIds: ["changed"] }, { id: "attacker", role: "owner" }] }),
      personalEnvelope({ activeProfileId: "res-primary" }),
      personalEnvelope({ curator: { liked: ["changed-global"] } }),
      personalEnvelope({ watchlist: { titles: ["changed-global"] } }),
      ...Object.entries({ role: "owner", isKids: false, isChild: false, isGuest: false, pin: "", pinHash: "forged",
        maturity: "mature", bedtime: "", boundaries: {}, familyPlayback: { languageSeverity: "off" }, expiresAt: null,
      }).map(([key, value]) => personalEnvelope({ profiles: [{ id: "child", savedIds: ["changed"], [key]: value }] })),
      ...["../escape", "..\\escape", "active", "CON"].map((id) => personalEnvelope({ profiles: [{ id, name: "Changed" }] })),
    ];
    for (const envelope of payloads) {
      assert.equal(restorePassportEnvelope(envelope, { stateDir: tempDir, req }).ok, false);
      assert.equal(fs.readFileSync(path.join(profilesDir, "child.json"), "utf8"), before);
      assert.equal(fs.readFileSync(path.join(tempDir, "answers.json"), "utf8"), settingsBefore);
      assert.equal(getProfile("attacker", profilesDir), null);
    }
  });

  it("requires the owner for home preferences and USB export", async () => {
    const req = sessionFor("reader");
    const before = fs.readFileSync(path.join(tempDir, "answers.json"), "utf8");
    for (const settings of [{ answers: { houseName: "Changed" } }, { mediaStrategy: { mode: "cloud_stream" } }]) {
      const result = await route("/api/passport/import", { method: "POST", req, body: personalEnvelope(settings) });
      assert.equal(result.status, 403);
      assert.equal(result.body.code, "owner_required");
    }
    assert.equal((await route("/api/passport/usb-export", { method: "POST", req, body: { usbMountPath: tempUsbDir } })).status, 403);
    assert.equal(fs.readFileSync(path.join(tempDir, "answers.json"), "utf8"), before);
    assert.deepEqual(fs.readdirSync(tempUsbDir), []);
  });

  it("allows owner home preferences while preserving credentials and rejects credential, provider, and device-path imports", async () => {
    const original = JSON.parse(fs.readFileSync(path.join(tempDir, "answers.json"), "utf8"));
    const imported = await route("/api/passport/import", { method: "POST", body: personalEnvelope({ answers: { houseName: "New Home" } }) });
    assert.equal(imported.status, 200);
    const saved = JSON.parse(fs.readFileSync(path.join(tempDir, "answers.json"), "utf8"));
    assert.deepEqual(saved, { ...original, houseName: "New Home" });
    const beforeProfile = fs.readFileSync(path.join(tempDir, "profiles", "res-primary.json"), "utf8");
    for (const settings of [
      { answers: { apiKey: "replacement" } }, { answers: { providers: { password: "replacement" } } },
      { answers: { source: "realdebrid" } }, { mediaStrategy: { dedicatedUsbMount: "/attacker/path" } },
      { mediaStrategy: { credentials: { token: "replacement" } } },
      { answers: { houseName: { password: "nested" } } },
      { profiles: [{ id: "res-primary", mediaPriorities: { movies: 10, credentials: { token: "nested" } } }] },
      { profiles: [{ id: "res-primary", bookLocations: { apiKey: "nested" } }] },
    ]) {
      const result = await route("/api/passport/import", { method: "POST", body: personalEnvelope(settings) });
      assert.equal(result.status, 400);
      assert.deepEqual(JSON.parse(fs.readFileSync(path.join(tempDir, "answers.json"), "utf8")), saved);
      assert.equal(fs.readFileSync(path.join(tempDir, "profiles", "res-primary.json"), "utf8"), beforeProfile);
    }
  });

  it("denies cross-origin imports and USB writes before side effects", async () => {
    for (const headers of [{ origin: "https://other.example" }, { "sec-fetch-site": "cross-site" }]) {
      for (const routePath of ["import", "usb-export"]) {
        const result = await route(`/api/passport/${routePath}`, { method: "POST", headers,
          body: routePath === "import" ? personalEnvelope() : { usbMountPath: tempUsbDir } });
        assert.equal(result.status, 403);
        assert.equal(result.body.code, "cross_origin_denied");
      }
    }
    assert.deepEqual(fs.readdirSync(tempUsbDir), []);
  });

  it("rejects malformed and oversized imports while leaving unrelated routes alone", async () => {
    for (const body of [null, [], { reelosPassportVersion: 1, profiles: "all" }, personalEnvelope({ profiles: [{ id: "valid", savedIds: "all" }] })]) {
      assert.equal((await route("/api/passport/import", { method: "POST", body })).status, 400);
    }
    assert.equal((await route("/api/passport/import", { method: "POST", body: personalEnvelope({ applianceName: "x".repeat(1024 * 1024) }) })).status, 413);
    assert.equal((await route("/api/passport/export", { method: "POST" })).status, 405);
    assert.equal((await route("/api/unrelated")).handled, false);
  });
});
