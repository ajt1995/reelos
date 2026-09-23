import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { saveProfile, setActiveProfileId } from "./profile-service.mjs";
import { getGateSecret, registerAuthorizedDevice, signDeviceToken, revokeAuthorizedDevice } from "./reelos-gate-service.mjs";
import { replaceProfileSession } from "./profile-session-service.mjs";
import {
  forwardPlaybackSession,
  handlePlaybackSessionRoute,
  resolveFamilyPlaybackPolicy,
  verifyFamilyTitle,
  playbackPresenceKey,
} from "./playback-session-service.mjs";
import { validateEvent } from "./intelligence-contracts.mjs";
import { localEditionFingerprint } from "./family-treatment-service.mjs";
import { createProviderValidation, sourcePolicyFromState, writeProviderValidation } from "./source-access-policy.mjs";

describe("Playback Session Service", () => {
  let stateDir, profilesDir;
  beforeEach(() => {
    stateDir = fs.mkdtempSync(path.join(process.cwd(), ".reelos-playback-auth-"));
    profilesDir = path.join(stateDir, "profiles");
  });
  afterEach(() => { fs.rmSync(stateDir, { recursive: true, force: true }); });

  function identity(profile = { id: "adult", name: "Adult" }) {
    saveProfile(profile, profilesDir);
    const device = registerAuthorizedDevice({ activeProfileId: profile.id }, stateDir);
    const deviceCookie = `reelos_device_token=${signDeviceToken(device, getGateSecret(stateDir))}`;
    const session = replaceProfileSession({ headers: { cookie: deviceCookie } }, profilesDir, profile.id, device.id);
    return { device, request: { socket: { remoteAddress: "127.0.0.1" }, headers: { host: "localhost", cookie: `${deviceCookie}; ${session.cookie.split(";")[0]}` } } };
  }

  function options(jellyfinUrl, who, presence = new Map()) {
    return { jellyfinUrl, token: "test-token", stateDir, profilesDir, request: who.request,
      presenceService: { roomPresence: presence, getRoomPresence(key) { return { state: presence.get(key) || { kidsPresent: false } }; } } };
  }

  function localLibrary(overrides = {}) {
    const file = path.join(stateDir, "personal-film.mp4");
    fs.writeFileSync(file, "local fixture media");
    const item = { id: "local-film", path: file, sourceKind: "personal_import", OfficialRating: "PG", ...overrides };
    fs.writeFileSync(path.join(stateDir, "library-shelf.json"), JSON.stringify({ titles: [item] }));
    return item;
  }

  async function upstream(fn, items = {}) {
    const received = [];
    const server = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk) => { raw += chunk; });
      req.on("end", () => {
        const message = { url: req.url, method: req.method, body: JSON.parse(raw || "{}"), headers: req.headers };
        received.push(message);
        if (req.url.startsWith("/Items/")) {
          const item = items[decodeURIComponent(req.url.slice("/Items/".length))];
          res.writeHead(item ? 200 : 404, { "Content-Type": "application/json" });
          res.end(JSON.stringify(item || {}));
        } else {
          res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: true }));
        }
      });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    try { await fn(`http://127.0.0.1:${server.address().port}`, received); }
    finally { await new Promise((resolve) => server.close(resolve)); }
  }
  it("merges participating child policy by the strictest safe preference", () => {
    const item = { Id: "movie-1", Name: "Movie", OfficialRating: "PG" };
    const policy = resolveFamilyPlaybackPolicy({
      activeProfile: { id: "adult", isKids: false },
      presentProfiles: [
        {
          id: "kid-a",
          name: "A",
          isKids: true,
          maturity: "big",
          familyPlayback: {
            languageSeverity: "strong",
            religiousLanguage: false,
            audioTreatment: "soften",
            subtitleTreatment: "replace",
            exceptions: [],
          },
        },
        {
          id: "kid-b",
          name: "B",
          isKids: true,
          maturity: "little",
          familyPlayback: {
            languageSeverity: "mild",
            religiousLanguage: true,
            audioTreatment: "mute",
            subtitleTreatment: "hide",
            exceptions: [],
          },
        },
      ],
      item,
    });
    assert.equal(policy.required, true);
    assert.equal(policy.languageSeverity, "mild");
    assert.equal(policy.religiousLanguage, true);
    assert.equal(policy.audioTreatment, "mute");
    assert.equal(policy.subtitleTreatment, "hide");
    assert.deepEqual(policy.maturity, ["big", "little"]);
  });

  it("fails closed for unrated or over-boundary titles and honors unanimous exceptions", () => {
    const children = ["a", "b"].map((id) => ({
      id,
      name: id,
      isKids: true,
      maturity: "little",
      familyPlayback: { exceptions: ["movie-1"], languageSeverity: "off" },
    }));
    const excepted = resolveFamilyPlaybackPolicy({
      presentProfiles: children,
      item: { Id: "movie-1", Name: "Movie" },
    });
    assert.equal(excepted.exceptionApplied, true);
    assert.equal(verifyFamilyTitle(excepted, { OfficialRating: "R" }).allowed, true);

    const guarded = resolveFamilyPlaybackPolicy({
      presentProfiles: children,
      item: { Id: "movie-2", Name: "Other" },
    });
    assert.equal(verifyFamilyTitle(guarded, {}).allowed, false);
    assert.equal(verifyFamilyTitle(guarded, { OfficialRating: "PG-13" }).allowed, false);
    assert.equal(verifyFamilyTitle(guarded, { OfficialRating: "G" }).allowed, true);
    assert.equal(verifyFamilyTitle(guarded, { OfficialRating: "UNKNOWN" }).allowed, false);
  });

  it("forwards start, progress, and stop to Jellyfin server", async () => {
    const who = identity();
    const received = [];
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        received.push({ url: req.url, method: req.method, body: JSON.parse(body || "{}") });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    const jellyfinUrl = `http://127.0.0.1:${port}`;

    try {
      const startRes = await forwardPlaybackSession("start", {
        itemId: "item123",
        mediaSourceId: "source456",
        playSessionId: "sess789",
      }, options(jellyfinUrl, who));
      assert.equal(startRes.ok, true);

      const progRes = await forwardPlaybackSession("progress", {
        itemId: "item123",
        mediaSourceId: "source456",
        playSessionId: "sess789",
        positionTicks: 100000000,
        isPaused: false,
      }, options(jellyfinUrl, who));
      assert.equal(progRes.ok, true);

      const stopRes = await forwardPlaybackSession("stop", {
        itemId: "item123",
        mediaSourceId: "source456",
        playSessionId: "sess789",
      }, options(jellyfinUrl, who));
      assert.equal(stopRes.ok, true);

      assert.equal(received.length, 3);
      assert.equal(received[0].url, "/Sessions/Playing");
      assert.equal(received[1].url, "/Sessions/Playing/Progress");
      assert.equal(received[1].body.PositionTicks, 100000000);
      assert.equal(received[2].url, "/Sessions/Playing/Stopped");
    } finally {
      server.close();
    }
  });

  it("registers local start, progress, and stop without an external media service", async (t) => {
    const who = identity();
    localLibrary();
    const external = t.mock.method(globalThis, "fetch", () => { throw new Error("No external calls permitted"); });
    const body = { itemId: "local-film", playSessionId: "local-session" };
    const opts = options("http://unavailable.invalid", who);
    for (const action of ["start", "progress", "stop"]) {
      const result = await forwardPlaybackSession(action, { ...body, positionTicks: 20000000, durationTicks: 60000000 }, opts);
      assert.equal(result.ok, true);
      assert.equal(result.engine, "local-file");
      assert.equal(result.mode, "direct-play");
      assert.equal(result.profileId, "adult");
      assert.equal(result.positionTicks, 20000000);
      assert.equal(result.presenceKey, playbackPresenceKey(who.device.id, body.playSessionId));
    }
    assert.equal((await forwardPlaybackSession("progress", body, opts)).code, "playback_session_not_started");
    assert.equal(external.mock.callCount(), 0);
  });

  it("fails closed for child playback until this exact local edition has a verified treatment", async (t) => {
    const child = identity({ id: "child-safe", isKids: true, pin: "2468", maturity: "big",
      familyPlayback: { languageSeverity: "mild", audioTreatment: "mute", subtitleTreatment: "hide", exceptions: [] } });
    const item = localLibrary({ OfficialRating: "PG" });
    const external = t.mock.method(globalThis, "fetch", () => { throw new Error("No external calls permitted"); });
    const opts = options("http://unavailable.invalid", child);
    const denied = await forwardPlaybackSession("start", { itemId: "local-film", playSessionId: "child-no-treatment", durationTicks: 60_000_000 }, opts);
    assert.equal(denied.code, "family_treatment_unavailable");

    fs.mkdirSync(path.join(stateDir, "family-treatments"));
    fs.writeFileSync(path.join(stateDir, "family-treatments", "local-film.json"), JSON.stringify({
      schema: "reelos.family-treatment/v1",
      media: { itemId: "local-film", mediaSourceId: "local-film", editionFingerprint: localEditionFingerprint(item.path) },
      timebase: { ticksPerSecond: 10_000_000, durationTicks: 60_000_000 },
      verification: { status: "verified", verifiedAt: 1, evidenceId: "fixture-evidence" },
      intervals: { visual: [{ startTicks: 10, endTicks: 20, action: "hide" }], audio: [], subtitle: [] },
    }));
    const allowed = await forwardPlaybackSession("start", { itemId: "local-film", playSessionId: "child-verified", durationTicks: 60_000_000 }, opts);
    assert.equal(allowed.ok, true);
    assert.equal(allowed.familyPolicy.enforcement, "verified-treatment-manifest");
    assert.equal(allowed.familyTreatment.media.editionFingerprint, localEditionFingerprint(item.path));
    assert.equal(external.mock.callCount(), 0);
  });

  it("binds local sessions to their device, identity, title, and source", async (t) => {
    const one = identity({ id: "one" });
    const two = identity({ id: "two" });
    localLibrary();
    const external = t.mock.method(globalThis, "fetch", () => { throw new Error("No external calls permitted"); });
    const body = { itemId: "local-film", playSessionId: "local-session" };
    const opts = options("http://unavailable.invalid", one);
    assert.equal((await forwardPlaybackSession("start", { ...body, mediaSourceId: "fake-source" }, opts)).code, "invalid_media_source");
    assert.equal((await forwardPlaybackSession("start", body, opts)).ok, true);
    for (const action of ["start", "progress", "stop"]) {
      assert.equal((await forwardPlaybackSession(action, body, options("http://unavailable.invalid", two))).status, 403);
    }
    assert.equal((await forwardPlaybackSession("progress", { ...body, itemId: "other" }, opts)).status, 403);
    assert.equal((await forwardPlaybackSession("progress", { ...body, mediaSourceId: "other" }, opts)).status, 403);
    revokeAuthorizedDevice(one.device.id, stateDir);
    assert.equal((await forwardPlaybackSession("progress", body, opts)).status, 401);
    assert.equal(external.mock.callCount(), 0);
  });

  it("rechecks local provider access and family boundaries while allowing an owned session to stop", async (t) => {
    const adult = identity();
    const child = identity({ id: "child", isKids: true, pin: "2468", maturity: "little" });
    localLibrary({ OfficialRating: "R" });
    const external = t.mock.method(globalThis, "fetch", () => { throw new Error("No external calls permitted"); });
    const body = { itemId: "local-film", playSessionId: "local-session" };
    const presence = new Map();
    const opts = options("http://unavailable.invalid", adult, presence);
    assert.equal((await forwardPlaybackSession("start", { ...body, playSessionId: "child-session", familyPolicy: { required: false } }, options("http://unavailable.invalid", child))).code, "family_title_denied");
    assert.equal((await forwardPlaybackSession("start", body, opts)).ok, true);
    presence.set(playbackPresenceKey(adult.device.id, body.playSessionId), { kidsPresent: true, childProfileIds: ["child"] });
    assert.equal((await forwardPlaybackSession("progress", body, opts)).code, "family_title_denied");
    assert.equal((await forwardPlaybackSession("stop", body, opts)).ok, true);
    presence.clear();
    const accountScope = sourcePolicyFromState({
      answers: { source: "torbox", apiKey: "fixture-only" },
      uiSettings: { debridEnabled: true, debridProvider: "torbox", debridStatus: "connected" },
      validation: createProviderValidation("torbox", "fixture-only", "fixture-account"),
    }).accountScope;
    localLibrary({ sourceKind: "debrid", source: { provider: "torbox", accountScope } });
    assert.equal((await forwardPlaybackSession("start", body, opts)).code, "source_unavailable");
    fs.writeFileSync(path.join(stateDir, "answers.json"), JSON.stringify({ source: "torbox", apiKey: "fixture-only" }));
    fs.writeFileSync(path.join(stateDir, "ui-settings.json"), JSON.stringify({ debridConnection: { enabled: true, provider: "torbox", status: "connected" } }));
    writeProviderValidation(stateDir, createProviderValidation("torbox", "fixture-only", "fixture-account"));
    assert.equal((await forwardPlaybackSession("start", body, opts)).ok, true);
    fs.writeFileSync(path.join(stateDir, "ui-settings.json"), JSON.stringify({ debridConnection: { enabled: false } }));
    assert.equal((await forwardPlaybackSession("progress", body, opts)).code, "source_unavailable");
    assert.equal((await forwardPlaybackSession("stop", body, opts)).ok, true);
    assert.equal(external.mock.callCount(), 0);
  });

  it("rejects removed, missing, or ambiguous local media without falling back to external services", async (t) => {
    const who = identity();
    const item = localLibrary();
    const external = t.mock.method(globalThis, "fetch", () => { throw new Error("No external calls permitted"); });
    const body = { itemId: "local-film", playSessionId: "local-session" };
    const opts = options("http://unavailable.invalid", who);
    fs.writeFileSync(path.join(stateDir, "library-shelf.json"), JSON.stringify({ titles: [item, { ...item }] }));
    assert.equal((await forwardPlaybackSession("start", body, opts)).code, "playback_source_unmapped");
    localLibrary();
    assert.equal((await forwardPlaybackSession("start", body, opts)).ok, true);
    fs.unlinkSync(item.path);
    assert.equal((await forwardPlaybackSession("progress", body, opts)).code, "playback_file_unavailable");
    fs.writeFileSync(path.join(stateDir, "library-shelf.json"), JSON.stringify({ titles: [] }));
    assert.equal((await forwardPlaybackSession("progress", body, opts)).code, "playback_source_unmapped");
    assert.equal((await forwardPlaybackSession("stop", body, opts)).ok, true);
    assert.equal(external.mock.callCount(), 0);
  });

  it("does not accept a client engine or file path as proof of local playback", async () => {
    const who = identity();
    await upstream(async (jellyfinUrl, received) => {
      const result = await forwardPlaybackSession("start", { itemId: "remote-film", playSessionId: "fake-local", engine: "local-file", mode: "direct-play", path: path.join(stateDir, "fake.mp4") }, options(jellyfinUrl, who));
      assert.equal(result.ok, true);
      assert.notEqual(result.engine, "local-file");
      assert.equal(received.length, 1);
      assert.equal(received[0].url, "/Sessions/Playing");
    });
  });

  it("requires a request-authenticated profile for every playback action", async () => {
    await upstream(async (jellyfinUrl, received) => {
      for (const action of ["start", "progress", "stop"]) {
        const result = await forwardPlaybackSession(action, { itemId: "movie", playSessionId: "session", profileId: "adult" }, { jellyfinUrl, stateDir, profilesDir });
        assert.equal(result.status, 401);
      }
      assert.equal(received.length, 0);
    });
  });

  it("resolves child policy from each device instead of the shared active profile or request body", async () => {
    const adult = identity();
    const child = identity({ id: "child", isKids: true, name: "Child", pin: "2468", maturity: "little" });
    setActiveProfileId("adult", profilesDir);
    await upstream(async (jellyfinUrl, received) => {
      const adultResult = await forwardPlaybackSession("start", { itemId: "restricted", playSessionId: "adult-session" }, options(jellyfinUrl, adult));
      assert.equal(adultResult.ok, true);
      const childResult = await forwardPlaybackSession("start", { itemId: "restricted", playSessionId: "child-session", profileId: "adult", familyPolicy: { required: false } }, options(jellyfinUrl, child));
      assert.equal(childResult.status, 403);
      assert.equal(childResult.code, "family_title_denied");
      assert.equal(childResult.familyPolicy.children[0].id, "child");
      assert.equal(received.filter((request) => request.method === "POST").length, 1);
      assert.match(received[0].headers.authorization, new RegExp(adult.device.id));
    }, { restricted: { Id: "restricted", Name: "Restricted", OfficialRating: "R" } });
  });

  it("binds playback IDs to device, profile, media source, and title", async () => {
    const one = identity({ id: "one" });
    const two = identity({ id: "two" });
    await upstream(async (jellyfinUrl, received) => {
      const body = { itemId: "movie", mediaSourceId: "source", playSessionId: "owned-session" };
      assert.equal((await forwardPlaybackSession("start", body, options(jellyfinUrl, one))).ok, true);
      for (const action of ["start", "progress", "stop"]) {
        assert.equal((await forwardPlaybackSession(action, body, options(jellyfinUrl, two))).status, 403);
      }
      assert.equal((await forwardPlaybackSession("progress", { ...body, itemId: "other" }, options(jellyfinUrl, one))).status, 403);
      assert.equal((await forwardPlaybackSession("progress", { ...body, mediaSourceId: "other" }, options(jellyfinUrl, one))).status, 403);
      assert.equal((await forwardPlaybackSession("start", { ...body, playSessionId: "second-session" }, options(jellyfinUrl, two))).ok, true);
      assert.equal((await forwardPlaybackSession("progress", body, options(jellyfinUrl, one))).ok, true);
      assert.equal(received.length, 3);
      revokeAuthorizedDevice(one.device.id, stateDir);
      assert.equal((await forwardPlaybackSession("stop", body, options(jellyfinUrl, one))).status, 401);
      assert.equal(received.length, 3);
    });
  });

  it("uses presence for the authenticated device session and rechecks policy on progress", async () => {
    const adult = identity();
    saveProfile({ id: "child", isKids: true, pin: "2468", maturity: "little" }, profilesDir);
    const presence = new Map([["living_room_tv", { kidsPresent: true, childProfileIds: ["child"] }]]);
    await upstream(async (jellyfinUrl, received) => {
      const body = { itemId: "restricted", playSessionId: "viewer-session" };
      assert.equal((await forwardPlaybackSession("start", body, options(jellyfinUrl, adult, presence))).ok, true, "another room's presence must not replace this session's identity");
      presence.set(playbackPresenceKey(adult.device.id, body.playSessionId), { kidsPresent: true, childProfileIds: ["child"] });
      const denied = await forwardPlaybackSession("progress", body, options(jellyfinUrl, adult, presence));
      assert.equal(denied.code, "family_title_denied");
      assert.equal(received.filter((request) => request.method === "POST").length, 1);
      assert.equal((await forwardPlaybackSession("stop", body, options(jellyfinUrl, adult, presence))).ok, true, "a session must remain stoppable after policy changes");
    }, { restricted: { Id: "restricted", OfficialRating: "R" } });
  });

  it("denies unavailable presence and mismatched catalog metadata", async () => {
    const adult = identity();
    const presence = new Map([[playbackPresenceKey(adult.device.id, "missing-session"), { kidsPresent: true, childProfileIds: ["missing"] }]]);
    await upstream(async (jellyfinUrl, received) => {
      const result = await forwardPlaybackSession("start", { itemId: "movie", playSessionId: "missing-session" }, options(jellyfinUrl, adult, presence));
      assert.equal(result.code, "family_presence_unavailable");
      assert.equal(received.length, 0);
      const child = identity({ id: "child", isKids: true, pin: "2468" });
      assert.equal((await forwardPlaybackSession("start", { itemId: "movie", playSessionId: "child-session" }, options(jellyfinUrl, child))).code, "family_title_mismatch");
    }, { movie: { Id: "different", OfficialRating: "G" } });
  });

  it("does not cache mismatched metadata after presence changes on an existing session", async () => {
    const adult = identity();
    saveProfile({ id: "child", isKids: true, pin: "2468", maturity: "little" }, profilesDir);
    const presence = new Map();
    await upstream(async (jellyfinUrl, received) => {
      const body = { itemId: "movie", playSessionId: "presence-session" };
      assert.equal((await forwardPlaybackSession("start", body, options(jellyfinUrl, adult, presence))).ok, true);
      presence.set(playbackPresenceKey(adult.device.id, body.playSessionId), { kidsPresent: true, childProfileIds: ["child"] });
      for (let i = 0; i < 2; i++) {
        assert.equal((await forwardPlaybackSession("progress", body, options(jellyfinUrl, adult, presence))).code, "family_title_mismatch");
      }
      assert.equal(received.filter((entry) => entry.method === "POST").length, 1);
    }, { movie: { Id: "wrong-title", OfficialRating: "G" } });
  });

  it("rejects unstarted sessions and invalid progress before contacting media services", async () => {
    const viewer = identity();
    await upstream(async (jellyfinUrl, received) => {
      const body = { itemId: "movie", playSessionId: "unknown-session" };
      assert.equal((await forwardPlaybackSession("progress", body, options(jellyfinUrl, viewer))).status, 409);
      assert.equal((await forwardPlaybackSession("start", { ...body, positionTicks: -1 }, options(jellyfinUrl, viewer))).status, 400);
      assert.equal((await forwardPlaybackSession("start", { ...body, itemId: "../settings" }, options(jellyfinUrl, viewer))).status, 400);
      assert.equal(received.length, 0);
    });
  });

  it("acknowledges only successful route effects and rejects cross-origin control", async () => {
    const viewer = identity();
    const events = [];
    const intelligenceEvents = [];
    const intelligenceStore = { async appendEvent(event) { intelligenceEvents.push(event); return { event }; } };
    const arbiter = {
      notifyPlaybackStart(...args) { events.push(["start", ...args]); },
      notifyPlaybackProgress(...args) { events.push(["progress", ...args]); },
      notifyPlaybackStop(...args) { events.push(["stop", ...args]); },
    };
    await upstream(async (jellyfinUrl, received) => {
      const route = async (action, body, who = viewer, extraHeaders = {}) => {
        const req = Readable.from([Buffer.from(JSON.stringify(body))]);
        req.method = "POST"; req.url = `/api/playback/${action}`;
        req.headers = { ...who.request.headers, ...extraHeaders }; req.socket = who.request.socket;
        let status, output;
        const res = { writeHead(value) { status = value; }, end(raw) { output = JSON.parse(raw); } };
        assert.equal(await handlePlaybackSessionRoute(req, res, {
          ...options(jellyfinUrl, viewer), arbiter, intelligenceStore,
        }), true);
        return { status, body: output };
      };
      const body = { itemId: "movie", playSessionId: "route-session" };
      assert.equal((await route("progress", body)).status, 409);
      assert.equal((await route("start", body, viewer, { origin: "https://untrusted.invalid" })).status, 403);
      assert.equal(events.length, 0);
      assert.equal(received.length, 0);
      assert.equal((await route("start", body)).status, 200);
      assert.equal((await route("progress", { ...body, positionTicks: 1000000 })).status, 200);
      assert.equal(events[1][2].durationMs, undefined, "never invent a title duration");
      const stranger = { request: { headers: {}, socket: { remoteAddress: "192.168.1.2" } } };
      assert.equal((await route("stop", body, stranger)).status, 401);
      assert.equal(events.length, 2);
      assert.equal((await route("stop", body)).status, 200);
      assert.equal(events.length, 3);
      assert.deepEqual(intelligenceEvents.map((event) => event.type), [
        "playback.failed", "playback.started", "playback.progress", "playback.stopped",
      ]);
      assert.deepEqual(intelligenceEvents.map((event) => event.profileId), ["adult", "adult", "adult", "adult"]);
      assert.doesNotThrow(() => intelligenceEvents.forEach((event) => validateEvent(event)));
      assert.equal(intelligenceEvents[0].payload.failureCode, "playback_session_not_started");
      assert.equal(intelligenceEvents[2].payload.positionTicks, 1000000);
      assert.equal(intelligenceEvents[2].payload.durationTicks, undefined);
    });
  });

  it("does not turn a completed playback action into failure when intelligence recording is offline", async () => {
    const viewer = identity();
    const failures = [];
    const intelligenceStore = { async appendEvent() { throw Object.assign(new Error("offline"), { code: "ledger_offline" }); } };
    await upstream(async (jellyfinUrl) => {
      const body = { itemId: "movie", playSessionId: "ledger-outage-session" };
      const req = Readable.from([Buffer.from(JSON.stringify(body))]);
      req.method = "POST"; req.url = "/api/playback/start";
      req.headers = viewer.request.headers; req.socket = viewer.request.socket;
      let status, output;
      const res = { writeHead(value) { status = value; }, end(raw) { output = JSON.parse(raw); } };
      assert.equal(await handlePlaybackSessionRoute(req, res, {
        ...options(jellyfinUrl, viewer), intelligenceStore,
        onIntelligenceError: (error) => failures.push(error.code),
      }), true);
      assert.equal(status, 200);
      assert.equal(output.ok, true);
      assert.deepEqual(failures, ["ledger_offline"]);
    });
  });
});
