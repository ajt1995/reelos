import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  listProfiles, getProfile, saveProfile, deleteProfile, getActiveProfileId,
  setActiveProfileId, blendProfiles, handleProfilesRoute, hashProfilePin,
  verifyProfilePin, publicProfile, profilePinAttemptState, recordProfilePinAttempt,
  clearProfilePinAttempts, getRequestActiveProfile, getProfileSetupStatus,
  visibleProfilesForHome, DEFAULT_PROFILES,
} from "./profile-service.mjs";
import { readProfileSession } from "./profile-session-service.mjs";
import { registerAuthorizedDevice, signDeviceToken, getGateSecret, revokeAuthorizedDevice } from "./reelos-gate-service.mjs";
import { validateEvent } from "./intelligence-contracts.mjs";

describe("Profile Service", () => {
  let tmpDir, profilesDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(process.cwd(), ".reelos-profiles-test-"));
    profilesDir = path.join(tmpDir, "profiles");
  });
  afterEach(() => { clearProfilePinAttempts(); fs.rmSync(tmpDir, { recursive: true, force: true }); });

  function client({ authorized = false, address = "127.0.0.1", intelligenceStore = null,
    onIntelligenceError } = {}) {
    const cookies = new Map();
    let device;
    if (authorized) {
      device = registerAuthorizedDevice({ name: "Test device", ip: address }, tmpDir);
      cookies.set("reelos_device_token", signDeviceToken(device, getGateSecret(tmpDir)));
    }
    return {
      cookies, device,
      async request(route = "/api/profiles", method = "GET", body, extraHeaders = {}) {
        const req = new EventEmitter();
        req.method = method;
        req.socket = { remoteAddress: address };
        req.headers = { cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; "), host: "localhost", ...extraHeaders };
        let status, headers, response;
        const res = {
          writeHead(code, values) { status = code; headers = values; },
          end(value) { response = JSON.parse(value); },
        };
        assert.equal(await handleProfilesRoute(req, res, new URL(`http://localhost${route}`), profilesDir, {
          intelligenceStore, onIntelligenceError,
        }), true);
        if (method === "POST") { req.emit("data", JSON.stringify(body ?? {})); req.emit("end"); }
        const cookie = headers?.["Set-Cookie"];
        for (const value of cookie ? (Array.isArray(cookie) ? cookie : [cookie]) : []) {
          const [name, token] = value.split(";")[0].split("="); cookies.set(name, token);
        }
        return { status, headers, body: response, req };
      },
    };
  }
  async function household(ownerPin, clientOptions = {}) {
    const owner = client(clientOptions);
    const first = await owner.request("/api/profiles", "POST", {
      id: "owner", name: "Owner", pin: ownerPin, experienceVersion: 2,
      reactions: { private: "love" }, bookProgress: { novel: 0.6 },
    });
    assert.equal(first.status, 200);
    assert.equal(first.body.auth.role, "owner");
    for (const cookie of first.headers["Set-Cookie"]) assert.match(cookie, /HttpOnly; SameSite=Strict/);
    assert.equal((await owner.request("/api/profiles", "POST", { id: "reader", name: "Reader", pin: "8642", experienceVersion: 2 })).status, 200);
    assert.equal((await owner.request("/api/profiles", "POST", { id: "child", name: "Child", isKids: true, pin: "2468", experienceVersion: 2 })).status, 200);
    return owner;
  }

  it("leaves a new store empty and never resurrects deleted fixture profiles", () => {
    assert.deepEqual(listProfiles(profilesDir), []);
    assert.equal(getProfile("res-primary", profilesDir), null);
    assert.equal(getActiveProfileId(profilesDir), null);
    assert.deepEqual(fs.readdirSync(profilesDir), []);
    saveProfile({ id: "test", name: "Test" }, profilesDir);
    assert.equal(deleteProfile("test", profilesDir).ok, true);
    assert.equal(getProfile("test", profilesDir), null);
  });

  it("hides retired demo residents after a real household completes setup", () => {
    const householdProfiles = [...DEFAULT_PROFILES, { id: "owner", name: "Austin", role: "owner" }];
    assert.deepEqual(
      visibleProfilesForHome(householdProfiles, { status: "complete" }).map((profile) => profile.id),
      ["owner"],
    );
    assert.equal(
      visibleProfilesForHome(DEFAULT_PROFILES, { status: "complete" }).length,
      DEFAULT_PROFILES.length,
      "a legacy-only home remains recoverable instead of becoming empty",
    );
    assert.equal(
      visibleProfilesForHome(householdProfiles, { status: "in_progress" }).length,
      householdProfiles.length,
      "setup never hides residents before the household is confirmed",
    );
  });

  it("reports corrupt storage instead of offering owner bootstrap", async () => {
    fs.mkdirSync(profilesDir);
    fs.writeFileSync(path.join(profilesDir, "owner.json"), "{broken");
    assert.throws(() => listProfiles(profilesDir));
    assert.equal((await client().request()).status, 503);
    assert.equal((await client().request("/api/profiles", "POST", { id: "takeover" })).body.ok, false);
  });

  it("rejects traversal, reserved filenames, and unknown active profiles", () => {
    for (const id of ["../escape", "..\\escape", "active", "CON", "lpt1", "a/b", "A", "x".repeat(97)]) {
      assert.throws(() => saveProfile({ id }, profilesDir), /Invalid profile ID/);
      assert.throws(() => getProfile(id, profilesDir), /Invalid profile ID/);
      assert.throws(() => deleteProfile(id, profilesDir), /Invalid profile ID/);
    }
    assert.throws(() => setActiveProfileId("missing", profilesDir), /not found/);
  });

  it("preserves independent reader state, preferences, and taste vectors", () => {
    saveProfile({ id: "reader", name: "Reader", mediaPriorities: { movies: 90, tv: 20, books: 40 },
      tasteVibe: "comfort", themeDesign: "warm_velvet", motionStyle: "cinematic",
      bookProgress: { book: 0.42 }, bookLocations: { book: "epubcfi(/6/18)" },
      bookBookmarks: { book: ["epubcfi(/6/18)"] }, readingAppearance: { theme: "sepia", fontSizeIndex: 3 },
    }, profilesDir);
    saveProfile({ id: "other" }, profilesDir);
    const saved = saveProfile({ id: "reader", name: "New Reader" }, profilesDir);
    assert.equal(saved.mediaPriorities.movies, 90);
    assert.equal(saved.tasteVibe, "comfort");
    assert.equal(saved.themeDesign, "warm_velvet");
    assert.equal(saved.bookProgress.book, 0.42);
    assert.equal(saved.bookLocations.book, "epubcfi(/6/18)");
    assert.deepEqual(saved.bookBookmarks.book, ["epubcfi(/6/18)"]);
    assert.deepEqual(saved.readingAppearance, { theme: "sepia", fontSizeIndex: 3 });
    assert.deepEqual(getProfile("other", profilesDir).bookProgress, {});
  });

  it("requires a child PIN, preserves it on empty updates, and bounds playback policy", () => {
    assert.throws(() => hashProfilePin("12ab"), /4 to 8 digits/);
    assert.throws(() => saveProfile({ id: "child", isKids: true }, profilesDir), /requires a family PIN/);
    const child = saveProfile({ id: "child", isKids: true, pin: "1234", familyPlayback: {
      languageSeverity: "strong", religiousLanguage: true, audioTreatment: "soften",
      subtitleTreatment: "replace", exceptions: ["The Princess Bride", "", 42],
    } }, profilesDir);
    assert.equal(saveProfile({ id: "child", pin: "" }, profilesDir).pinHash, child.pinHash);
    assert.deepEqual(child.familyPlayback, { languageSeverity: "strong", religiousLanguage: true,
      audioTreatment: "soften", subtitleTreatment: "replace", exceptions: ["The Princess Bride"] });
  });

  it("uses bounded salted PIN hashes, rejects malformed digests, and hides secrets", () => {
    const saved = saveProfile({ id: "secret", pin: "2468" }, profilesDir);
    assert.equal(verifyProfilePin("2468", saved.pinHash), true);
    assert.equal(verifyProfilePin("1357", saved.pinHash), false);
    assert.equal(saved.pin, undefined);
    for (const malformed of ["scrypt:AA==:AA==", "scrypt:!!!!:!!!!", "scrypt:YWJj:YWJj"]) assert.equal(verifyProfilePin("2468", malformed), false);
    assert.equal(publicProfile(saved).pinHash, undefined);
    assert.equal(publicProfile(saved).pin, undefined);
    assert.equal(publicProfile(saved).pinEnabled, true);
    assert.equal(publicProfile({ ...saved, summaryOnly: true }).summaryOnly, undefined);
    assert.equal(publicProfile({ ...saved, experienceVersion: 0 }).experienceVersion, 2);
  });

  it("rate-limits repeated PIN guesses and resets after valid verification", () => {
    for (let i = 0; i < 4; i++) assert.equal(recordProfilePinAttempt("child:local", false, 10000 + i).locked, false);
    assert.equal(recordProfilePinAttempt("child:local", false, 10004).locked, true);
    recordProfilePinAttempt("child:local", true, 10005);
    assert.deepEqual(profilePinAttemptState("child:local", 10005), { locked: false, failures: 0, retryAfterMs: 0 });
  });

  it("protects owners from deletion and keeps legacy active selection explicit", () => {
    saveProfile({ id: "owner", role: "owner" }, profilesDir);
    saveProfile({ id: "other" }, profilesDir);
    assert.equal(deleteProfile("owner", profilesDir).ok, false);
    assert.equal(getActiveProfileId(profilesDir), null);
    setActiveProfileId("other", profilesDir);
    assert.equal(getActiveProfileId(profilesDir), "other");
    deleteProfile("other", profilesDir);
    assert.equal(getActiveProfileId(profilesDir), null);
  });

  it("blends explicit profiles without changing saved tastes", () => {
    saveProfile({ id: "one", name: "One", mediaPriorities: { movies: 50, tv: 50 } }, profilesDir);
    saveProfile({ id: "two", name: "Two", mediaPriorities: { movies: 70, tv: 30 } }, profilesDir);
    const blended = blendProfiles(["one", "two"], profilesDir);
    assert.equal(blended.name, "One & Two");
    assert.equal(blended.mediaPriorities.movies, 60);
    assert.equal(blended.mediaPriorities.tv, 40);
    assert.equal(getProfile("one", profilesDir).mediaPriorities.movies, 50);
  });

  it("bootstraps one owner from the home network and requires authorization on later writes", async () => {
    const stranger = client({ address: "203.0.113.9" });
    const empty = await stranger.request();
    assert.equal(empty.body.auth.bootstrapRequired, true);
    assert.equal((await stranger.request("/api/profiles", "POST", { id: "attacker" })).body.code, "local_bootstrap_required");
    const owner = await household(undefined, { address: "192.168.1.2" });
    assert.equal((await stranger.request("/api/profiles", "POST", { id: "attacker", role: "owner" })).status, 401);
    assert.equal(getProfile("attacker", profilesDir), null);
    assert.equal((await owner.request("/api/profiles", "POST", { id: "owner", isKids: true })).status, 409);
    assert.equal((await stranger.request("/api/profiles/owner", "DELETE")).status, 401);
  });

  it("returns private data only for the request's active identity", async () => {
    const owner = await household();
    const publicRoster = await client().request();
    assert.equal(publicRoster.body.activeId, null);
    for (const summary of publicRoster.body.profiles) {
      assert.equal(summary.summaryOnly, true);
      assert.equal(summary.experienceVersion, 2);
      for (const field of ["pinHash", "pin", "reactions", "bookProgress", "savedIds", "progress"]) assert.equal(field in summary, false);
    }
    const roster = await owner.request();
    assert.deepEqual(roster.body.profiles.find((p) => p.id === "owner").reactions, { private: "love" });
    assert.equal(roster.body.profiles.find((p) => p.id === "reader").summaryOnly, true);
  });

  it("allows PIN-free adult access only on registered household devices", async () => {
    await household();
    const lan = client({ address: "192.168.1.2" });
    assert.equal((await lan.request("/api/profiles/active", "POST", { id: "owner" })).body.code, "device_auth_required");
    const paired = client({ authorized: true, address: "100.64.1.2" });
    const opened = await paired.request("/api/profiles/active", "POST", { id: "owner" });
    assert.equal(opened.status, 200);
    assert.equal(opened.body.auth.role, "owner");
    revokeAuthorizedDevice(paired.device.id, tmpDir);
    assert.equal((await paired.request()).body.auth.authenticated, false);
    assert.equal((await paired.request("/api/profiles/active", "POST", { id: "owner" })).status, 401);
  });

  it("enforces adult PIN entry and keeps two devices' active profiles independent", async () => {
    const owner = await household("1357");
    const reader = client({ authorized: true });
    assert.equal((await reader.request("/api/profiles/active", "POST", { id: "reader" })).status, 403);
    const opened = await reader.request("/api/profiles/active", "POST", { id: "reader", pin: "8642" });
    assert.equal(opened.status, 200);
    assert.equal(opened.body.profile.id, "reader");
    assert.equal((await owner.request()).body.activeId, "owner");
    assert.equal((await reader.request()).body.activeId, "reader");
    assert.equal(getRequestActiveProfile((await reader.request()).req, profilesDir).id, "reader");
    assert.equal(getActiveProfileId(profilesDir), null);
  });

  it("permits own progress and denies member elevation or changes to other people", async () => {
    const owner = await household("1357");
    const member = client({ authorized: true });
    await member.request("/api/profiles/active", "POST", { id: "reader", pin: "8642" });
    assert.equal((await member.request("/api/profiles", "POST", { id: "reader", bookProgress: { own: 0.5 } })).status, 200);
    for (const update of [{ id: "owner", reactions: {} }, { id: "reader", role: "owner" }, { id: "reader", pin: "9999" }, { id: "new" }]) {
      assert.equal((await member.request("/api/profiles", "POST", update)).status, 403);
    }
    assert.equal((await member.request("/api/profiles/child", "DELETE")).status, 403);
    await owner.request("/api/profiles", "POST", { id: "reader", name: "Renamed", bookProgress: {} });
    assert.deepEqual(getProfile("reader", profilesDir).bookProgress, { own: 0.5 });
  });

  it("requires a same-origin current device-bound identity for title reactions", async () => {
    const owner = await household();
    const payload = { expectedProfileId: "owner", titleId: "tmdb-123", reaction: "love" };
    const anonymous = client();
    const deviceOnly = client({ authorized: true });
    const sessionOnly = client();
    sessionOnly.cookies.set("reelos_profile_session", owner.cookies.get("reelos_profile_session"));
    const otherDevice = client({ authorized: true });
    otherDevice.cookies.set("reelos_profile_session", owner.cookies.get("reelos_profile_session"));
    const before = fs.readFileSync(path.join(profilesDir, "owner.json"), "utf8");
    for (const viewer of [anonymous, deviceOnly, sessionOnly, otherDevice]) {
      const denied = await viewer.request("/api/profiles/reaction", "POST", payload);
      assert.equal(denied.status, 401);
      assert.equal(denied.body.code, "profile_auth_required");
    }
    for (const headers of [{ origin: "https://untrusted.invalid" }, { "sec-fetch-site": "cross-site" }]) {
      const denied = await owner.request("/api/profiles/reaction", "POST", payload, headers);
      assert.equal(denied.status, 403);
      assert.equal(denied.body.code, "cross_origin_denied");
    }
    assert.equal(fs.readFileSync(path.join(profilesDir, "owner.json"), "utf8"), before);
  });

  it("strictly validates title reactions and rejects caller-selected write targets", async () => {
    const owner = await household();
    const payload = { expectedProfileId: "owner", titleId: "tmdb-123", reaction: "like" };
    const before = fs.readFileSync(path.join(profilesDir, "owner.json"), "utf8");
    const invalid = [
      {}, [], "like", { titleId: "tmdb-123", reaction: "like" }, { expectedProfileId: "owner", titleId: "tmdb-123" },
      ...["profileId", "id", "role", "reactions", "dismissedTasteIds", "lessLikeIds"].map((key) => ({ ...payload, [key]: "reader" })),
      ...[null, 12, "", " ", "../film", "film/1", "__proto__", "constructor", "prototype", "x".repeat(257)].map((titleId) => ({ ...payload, titleId })),
      ...["", "Love", "dislike", true, 0, {}, [], ["like"]].map((reaction) => ({ ...payload, reaction })),
      ...[null, "", "../owner", "active", "Owner", 12].map((expectedProfileId) => ({ ...payload, expectedProfileId })),
    ];
    for (const update of invalid) {
      const result = await owner.request("/api/profiles/reaction", "POST", update);
      assert.equal(result.status, 400, JSON.stringify(update));
      assert.equal(result.body.ok, false);
    }
    const mismatch = await owner.request("/api/profiles/reaction", "POST", { ...payload, expectedProfileId: "reader" });
    assert.equal(mismatch.status, 403);
    assert.equal(mismatch.body.code, "profile_changed");
    for (const method of ["GET", "PUT", "DELETE"]) {
      assert.equal((await owner.request("/api/profiles/reaction", method)).status, 405);
    }
    assert.equal(fs.readFileSync(path.join(profilesDir, "owner.json"), "utf8"), before);
  });

  it("persists explicit private taste choices and reset without changing other profile fields", async () => {
    const owner = await household();
    const original = saveProfile({ id: "owner", progress: { film: 0.4 }, savedIds: ["favorite"],
      reactions: { private: "love", "tmdb-123": "cozy" }, dismissedTasteIds: ["other-dismissed", "tmdb-123"],
      lessLikeIds: ["other-less", "tmdb-123"], bookProgress: { novel: 0.6 },
    }, profilesDir);
    original.futurePreference = { preserved: true };
    fs.writeFileSync(path.join(profilesDir, "owner.json"), JSON.stringify(original));
    for (const reaction of ["like", "love", "cozy", "dismiss", "dismiss", "less", "less", null, null]) {
      const result = await owner.request("/api/profiles/reaction", "POST", {
        expectedProfileId: "owner", titleId: "tmdb-123", reaction,
      }, { origin: "http://localhost" });
      assert.equal(result.status, 200);
      assert.deepEqual(result.body, { ok: true, profileId: "owner", titleId: "tmdb-123", reaction, persisted: true });
      const stored = getProfile("owner", profilesDir);
      assert.deepEqual(stored, { ...original,
        reactions: { private: "love", ...(["like", "love", "cozy"].includes(reaction) ? { "tmdb-123": reaction } : {}) },
        dismissedTasteIds: ["other-dismissed", ...(reaction === "dismiss" ? ["tmdb-123"] : [])],
        lessLikeIds: ["other-less", ...(reaction === "less" ? ["tmdb-123"] : [])],
        updatedAt: stored.updatedAt,
      });
    }
  });

  it("records persisted taste and progress locally and cascades an owner-approved profile deletion", async () => {
    const events = [];
    const deleted = [];
    const intelligenceStore = {
      async appendEvent(event) { events.push(event); return { event }; },
      async deleteProfile(profileId, options) { deleted.push([profileId, options]); return { deleted: true }; },
    };
    const owner = await household(undefined, { intelligenceStore });
    assert.equal((await owner.request("/api/profiles/reaction", "POST", {
      expectedProfileId: "owner", titleId: "tmdb-123", reaction: "love",
    })).status, 200);
    assert.equal((await owner.request("/api/profiles/reaction", "POST", {
      expectedProfileId: "owner", titleId: "tmdb-123", reaction: null,
    })).status, 200);
    assert.equal((await owner.request("/api/profiles/progress", "POST", {
      expectedProfileId: "owner", titleId: "tmdb-123", progress: 0.95,
    })).status, 200);
    assert.equal((await owner.request("/api/profiles/reader", "DELETE")).status, 200);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(events.map((event) => event.type), ["taste.set", "taste.reset", "playback.completed"]);
    assert.deepEqual(events.map((event) => event.profileId), ["owner", "owner", "owner"]);
    assert.doesNotThrow(() => events.forEach((event) => validateEvent(event)));
    assert.deepEqual(events[0].payload, { titleId: "tmdb-123", reaction: "love" });
    assert.deepEqual(deleted, [["reader", { reason: "profile_deleted_by_owner" }]]);
    assert.equal(getProfile("reader", profilesDir), null);
  });

  it("keeps authoritative profile writes successful when the derived intelligence ledger is unavailable", async () => {
    const failures = [];
    const intelligenceStore = {
      async appendEvent() { throw Object.assign(new Error("offline"), { code: "ledger_offline" }); },
      async deleteProfile() { throw Object.assign(new Error("offline"), { code: "ledger_offline" }); },
    };
    const owner = await household(undefined, { intelligenceStore, onIntelligenceError: (error) => failures.push(error.code) });
    assert.equal((await owner.request("/api/profiles/reaction", "POST", {
      expectedProfileId: "owner", titleId: "film", reaction: "cozy",
    })).status, 200);
    assert.equal(getProfile("owner", profilesDir).reactions.film, "cozy");
    assert.equal((await owner.request("/api/profiles/reader", "DELETE")).status, 200);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(getProfile("reader", profilesDir), null);
    assert.deepEqual(failures, ["ledger_offline", "ledger_offline"]);
  });

  it("keeps reactions private across devices, permits child own taste, and rejects stale or revoked identities", async () => {
    const owner = await household();
    const reader = client({ authorized: true });
    await reader.request("/api/profiles/active", "POST", { id: "reader", pin: "8642" });
    for (const [viewer, expectedProfileId, reaction] of [[owner, "owner", "love"], [reader, "reader", "cozy"]]) {
      assert.equal((await viewer.request("/api/profiles/reaction", "POST", { expectedProfileId, titleId: "same-film", reaction })).status, 200);
    }
    for (const [viewer, id, reaction] of [[owner, "owner", "love"], [reader, "reader", "cozy"]]) {
      const loaded = await viewer.request();
      assert.equal(loaded.body.profiles.find((profile) => profile.id === id).reactions["same-film"], reaction);
      for (const other of loaded.body.profiles.filter((profile) => profile.id !== id)) {
        for (const key of ["reactions", "dismissedTasteIds", "lessLikeIds"]) assert.equal(other[key], undefined);
      }
    }
    for (const profile of (await client().request()).body.profiles) {
      for (const key of ["reactions", "dismissedTasteIds", "lessLikeIds"]) assert.equal(profile[key], undefined);
    }
    const ownerBefore = fs.readFileSync(path.join(profilesDir, "owner.json"), "utf8");
    const childBefore = getProfile("child", profilesDir);
    await owner.request("/api/profiles/active", "POST", { id: "child" });
    const delayed = await owner.request("/api/profiles/reaction", "POST", { expectedProfileId: "owner", titleId: "same-film", reaction: "less" });
    assert.equal(delayed.status, 403);
    assert.equal(delayed.body.code, "profile_changed");
    assert.equal((await owner.request("/api/profiles/reaction", "POST", { expectedProfileId: "child", titleId: "child-film", reaction: "less" })).status, 200);
    const childAfter = getProfile("child", profilesDir);
    assert.deepEqual(childAfter, { ...childBefore, lessLikeIds: ["child-film"], updatedAt: childAfter.updatedAt });
    assert.equal(fs.readFileSync(path.join(profilesDir, "owner.json"), "utf8"), ownerBefore);
    revokeAuthorizedDevice(reader.device.id, tmpDir);
    const denied = await reader.request("/api/profiles/reaction", "POST", { expectedProfileId: "reader", titleId: "same-film", reaction: null });
    assert.equal(denied.status, 401);
    assert.equal(getProfile("reader", profilesDir).reactions["same-film"], "cozy");
  });

  it("never acknowledges a title reaction when atomic storage fails", async (t) => {
    const owner = await household();
    const before = fs.readFileSync(path.join(profilesDir, "owner.json"), "utf8");
    for (const method of ["writeFileSync", "renameSync"]) {
      for (const [code, status, responseCode] of [["ENOSPC", 507, "storage_full"], ["EACCES", 503, "reaction_save_failed"]]) {
        const write = t.mock.method(fs, method, () => { throw Object.assign(new Error(code), { code }); });
        let result;
        try {
          result = await owner.request("/api/profiles/reaction", "POST", { expectedProfileId: "owner", titleId: "film", reaction: "love" });
        } finally { write.mock.restore(); }
        assert.equal(result.status, status);
        assert.equal(result.body.ok, false);
        assert.equal(result.body.code, responseCode);
        assert.equal(result.body.persisted, undefined);
        assert.equal(fs.readFileSync(path.join(profilesDir, "owner.json"), "utf8"), before);
        assert.equal(fs.readdirSync(profilesDir).some((name) => name.endsWith(".tmp")), false);
      }
    }
  });

  it("requires a current device-bound identity for narrow playback progress writes", async () => {
    const owner = await household();
    const payload = { expectedProfileId: "owner", titleId: "tmdb-123", progress: 0.4 };
    const anonymous = client();
    const deviceOnly = client({ authorized: true });
    const sessionOnly = client();
    sessionOnly.cookies.set("reelos_profile_session", owner.cookies.get("reelos_profile_session"));
    const otherDevice = client({ authorized: true });
    otherDevice.cookies.set("reelos_profile_session", owner.cookies.get("reelos_profile_session"));
    for (const viewer of [anonymous, deviceOnly, sessionOnly, otherDevice]) {
      const denied = await viewer.request("/api/profiles/progress", "POST", payload);
      assert.equal(denied.status, 401);
      assert.equal(denied.body.code, "profile_auth_required");
    }
    assert.equal((await owner.request("/api/profiles/progress", "POST", payload, { origin: "https://untrusted.invalid" })).status, 403);
    assert.equal((await owner.request("/api/profiles/progress", "POST", payload, { "sec-fetch-site": "cross-site" })).status, 403);
    assert.deepEqual(getProfile("owner", profilesDir).progress, {});
  });

  it("strictly validates playback progress and rejects client-selected profile targets", async () => {
    const owner = await household();
    const payload = { expectedProfileId: "owner", titleId: "tmdb-123", progress: 0.4 };
    const invalid = [
      {}, [], { titleId: "tmdb-123", progress: 0.4 },
      ...["profileId", "id", "role", "watchProgress"].map((key) => ({ ...payload, [key]: "reader" })),
      ...[null, 12, "", " ", "../film", "film/1", "__proto__", "constructor", "prototype", "x".repeat(257)].map((titleId) => ({ ...payload, titleId })),
      ...[null, "0.4", false, {}, -0.01, 1.01, NaN, Infinity].map((progress) => ({ ...payload, progress })),
      { ...payload, expectedProfileId: "../owner" },
    ];
    for (const update of invalid) {
      const result = await owner.request("/api/profiles/progress", "POST", update);
      assert.equal(result.status, 400, JSON.stringify(update));
      assert.equal(result.body.ok, false);
    }
    assert.equal((await owner.request("/api/profiles/progress", "POST", { ...payload, expectedProfileId: "reader" })).status, 403);
    assert.equal((await owner.request("/api/profiles/progress", "GET")).status, 405);
    assert.deepEqual(getProfile("owner", profilesDir).progress, {});
  });

  it("merges only one title into both progress maps while preserving private preferences", async () => {
    const owner = await household();
    const original = saveProfile({ id: "owner", progress: { older: 0.3 }, watchProgress: { legacy: 0.7 },
      savedIds: ["favorite"], reactions: { private: "love" }, bookProgress: { novel: 0.6 },
      themeDesign: "warm_velvet", readingAppearance: { theme: "sepia", fontSizeIndex: 3 },
    }, profilesDir);
    // A narrow write also preserves future fields that the general profile editor does not know about.
    original.futurePreference = { preserved: true };
    fs.writeFileSync(path.join(profilesDir, "owner.json"), JSON.stringify(original));
    for (const progress of [0, 0.42, 1]) {
      const saved = await owner.request("/api/profiles/progress", "POST", { expectedProfileId: "owner", titleId: "tmdb-123", progress }, { origin: "http://localhost" });
      assert.equal(saved.status, 200);
      assert.deepEqual(saved.body, { ok: true, profileId: "owner", titleId: "tmdb-123", progress, persisted: true });
      const stored = getProfile("owner", profilesDir);
      assert.deepEqual(stored, { ...original, progress: { older: 0.3, "tmdb-123": progress },
        watchProgress: { legacy: 0.7, "tmdb-123": progress }, updatedAt: stored.updatedAt });
    }
  });

  it("persists separate playback positions and exposes them only to their own profile", async () => {
    const owner = await household();
    const reader = client({ authorized: true });
    await reader.request("/api/profiles/active", "POST", { id: "reader", pin: "8642" });
    for (const [viewer, expectedProfileId, progress] of [[owner, "owner", 0.25], [reader, "reader", 0.8]]) {
      assert.equal((await viewer.request("/api/profiles/progress", "POST", { expectedProfileId, titleId: "same-film", progress })).status, 200);
    }
    for (const [viewer, id, progress] of [[owner, "owner", 0.25], [reader, "reader", 0.8]]) {
      const loaded = await viewer.request();
      assert.equal(loaded.body.profiles.find((profile) => profile.id === id).progress["same-film"], progress);
      for (const other of loaded.body.profiles.filter((profile) => profile.id !== id)) {
        assert.equal(other.progress, undefined);
        assert.equal(other.watchProgress, undefined);
      }
    }
    for (const profile of (await client().request()).body.profiles) {
      assert.equal(profile.progress, undefined);
      assert.equal(profile.watchProgress, undefined);
    }
    await owner.request("/api/profiles/active", "POST", { id: "child" });
    const delayed = await owner.request("/api/profiles/progress", "POST", { expectedProfileId: "owner", titleId: "same-film", progress: 0.9 });
    assert.equal(delayed.status, 403);
    assert.equal(delayed.body.code, "profile_changed");
    assert.deepEqual(getProfile("child", profilesDir).progress, {});
    assert.equal(getProfile("owner", profilesDir).progress["same-film"], 0.25);
    assert.equal((await owner.request("/api/profiles/progress", "POST", { expectedProfileId: "child", titleId: "child-film", progress: 0.1 })).status, 200);
    revokeAuthorizedDevice(reader.device.id, tmpDir);
    assert.equal((await reader.request("/api/profiles/progress", "POST", { expectedProfileId: "reader", titleId: "same-film", progress: 0.9 })).status, 401);
  });

  it("does not acknowledge progress persistence when atomic storage fails", async (t) => {
    const owner = await household();
    const before = fs.readFileSync(path.join(profilesDir, "owner.json"), "utf8");
    for (const [code, status, responseCode] of [["ENOSPC", 507, "storage_full"], ["EACCES", 503, "progress_save_failed"]]) {
      const write = t.mock.method(fs, "writeFileSync", () => { throw Object.assign(new Error(code), { code }); });
      let result;
      try {
        result = await owner.request("/api/profiles/progress", "POST", { expectedProfileId: "owner", titleId: "film", progress: 0.5 });
      } finally { write.mock.restore(); }
      assert.equal(result.status, status);
      assert.equal(result.body.ok, false);
      assert.equal(result.body.code, responseCode);
      assert.equal(result.body.persisted, undefined);
      assert.equal(fs.readFileSync(path.join(profilesDir, "owner.json"), "utf8"), before);
    }
  });

  it("blocks child escape through changes, deletion, stale cookies, and cookie clearing", async () => {
    const viewer = await household();
    const oldCookie = viewer.cookies.get("reelos_profile_session");
    await viewer.request("/api/profiles/active", "POST", { id: "child" });
    assert.equal(readProfileSession({ headers: { cookie: `reelos_profile_session=${oldCookie}` } }, profilesDir), null);
    for (const update of [{ id: "child", isKids: false }, { id: "child", pin: "0000" }, { id: "child", boundaries: { violence: false } }, { id: "owner" }, { id: "escape" }]) {
      assert.equal((await viewer.request("/api/profiles", "POST", update)).status, 403);
    }
    assert.equal((await viewer.request("/api/profiles/child", "DELETE")).status, 403);
    viewer.cookies.delete("reelos_profile_session");
    assert.equal((await viewer.request("/api/profiles/active", "POST", { id: "owner" })).body.code, "child_exit_pin_required");
    assert.equal((await viewer.request("/api/profiles/active", "POST", { id: "owner", exitPin: "2468" })).status, 200);
  });

  it("requires current child exit and target adult entry PINs", async () => {
    const viewer = await household("1357");
    await viewer.request("/api/profiles/active", "POST", { id: "child" });
    assert.equal((await viewer.request("/api/profiles/active", "POST", { id: "owner", exitPin: "2468" })).body.code, "profile_pin_required");
    assert.equal((await viewer.request("/api/profiles/active", "POST", { id: "owner", exitPin: "2468", pin: "1357" })).status, 200);
  });

  it("issues one-use PIN grants and rejects replay after session rotation", async () => {
    const viewer = await household();
    await viewer.request("/api/profiles/active", "POST", { id: "child" });
    const verified = await viewer.request("/api/profiles/child/verify-pin", "POST", { pin: "2468" });
    assert.deepEqual(verified.body, { ok: true, verified: true });
    assert.equal((await viewer.request("/api/profiles/active", "POST", { id: "owner" })).status, 200);
    await viewer.request("/api/profiles/active", "POST", { id: "child" });
    assert.equal((await viewer.request("/api/profiles/active", "POST", { id: "owner" })).status, 403);
  });

  it("does not transfer a PIN grant to another authorized device without a profile session", async () => {
    await household("1357");
    const one = client({ authorized: true });
    const two = client({ authorized: true });
    assert.equal((await one.request("/api/profiles/owner/verify-pin", "POST", { pin: "1357" })).status, 200);
    two.cookies.set("reelos_profile_pin", one.cookies.get("reelos_profile_pin"));
    assert.equal((await two.request("/api/profiles/active", "POST", { id: "owner" })).status, 403);
  });

  it("restores persisted sessions and rejects expired sessions without dropping device child locks", async () => {
    const viewer = await household();
    await viewer.request("/api/profiles/active", "POST", { id: "child" });
    const loaded = await viewer.request();
    assert.equal(readProfileSession(loaded.req, profilesDir).profileId, "child");
    const sessionDir = path.join(profilesDir, ".sessions");
    const file = path.join(sessionDir, fs.readdirSync(sessionDir)[0]);
    const session = JSON.parse(fs.readFileSync(file, "utf8"));
    session.expiresAt = Date.now() - 1;
    fs.writeFileSync(file, JSON.stringify(session));
    assert.equal((await viewer.request()).body.auth.authenticated, false);
    assert.equal((await viewer.request("/api/profiles/active", "POST", { id: "owner" })).body.code, "child_exit_pin_required");
  });

  it("shares rate limiting between PIN verification and direct switches", async () => {
    await household("1357");
    const stranger = client({ authorized: true });
    for (let i = 0; i < 5; i++) assert.equal((await stranger.request("/api/profiles/owner/verify-pin", "POST", { pin: "0000" })).status, 401);
    const locked = await stranger.request("/api/profiles/active", "POST", { id: "owner", pin: "1357" });
    assert.equal(locked.status, 429);
    assert.ok(Number(locked.headers["Retry-After"]) > 0);
  });

  it("rejects cross-origin mutations and handles malformed cookies", async () => {
    const owner = await household();
    assert.equal((await owner.request("/api/profiles", "POST", { id: "owner", name: "Changed" }, { origin: "https://untrusted.invalid" })).status, 403);
    assert.equal(getProfile("owner", profilesDir).name, "Owner");
    assert.equal((await client().request("/api/profiles", "GET", null, { cookie: "reelos_profile_session=%GG" })).body.auth.authenticated, false);
  });

  it("refuses legacy unprotected child entry", async () => {
    const owner = await household();
    fs.writeFileSync(path.join(profilesDir, "legacy-child.json"), JSON.stringify({ id: "legacy-child", isKids: true }));
    const result = await owner.request("/api/profiles/active", "POST", { id: "legacy-child" });
    assert.equal(result.status, 409);
    assert.equal(result.body.code, "child_pin_required");
  });

  it("keeps partial setup in progress until the owner confirms all persisted profiles", async () => {
    assert.deepEqual(getProfileSetupStatus(profilesDir), { status: "not_started", completedAt: null });
    const owner = await household();
    const before = await owner.request();
    assert.equal(before.body.setup.status, "in_progress");
    assert.equal(before.body.profiles.find((p) => p.id === "owner").name, "Owner");
    assert.equal((await owner.request("/api/profiles/setup/complete", "POST", { expectedProfileIds: ["owner", "missing"] })).status, 409);
    const subset = await owner.request("/api/profiles/setup/complete", "POST", { expectedProfileIds: ["owner"] });
    assert.equal(subset.status, 409);
    assert.equal(subset.body.code, "setup_roster_mismatch");
    assert.equal(getProfileSetupStatus(profilesDir).status, "in_progress");
    const completed = await owner.request("/api/profiles/setup/complete", "POST", { expectedProfileIds: ["owner", "reader", "child"] });
    assert.equal(completed.status, 200);
    assert.equal(completed.body.setup.status, "complete");
    const again = await owner.request("/api/profiles/setup/complete", "POST", { expectedProfileIds: ["owner", "reader", "child"] });
    assert.equal(again.body.setup.completedAt, completed.body.setup.completedAt);
    const member = client({ authorized: true });
    await member.request("/api/profiles/active", "POST", { id: "reader", pin: "8642" });
    assert.equal((await member.request("/api/profiles/setup/complete", "POST", { expectedProfileIds: ["reader"] })).status, 403);
  });
});
