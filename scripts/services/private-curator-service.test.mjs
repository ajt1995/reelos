import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, afterEach, describe, it } from "node:test";
import { processPrivateCuratorRequest, privateCuratorState } from "./private-curator-service.mjs";
import { saveProfile, getProfile } from "./profile-service.mjs";
import { registerAuthorizedDevice, signDeviceToken, getGateSecret, setAuthorizedDeviceActiveProfile, revokeAuthorizedDevice } from "./reelos-gate-service.mjs";
import { replaceProfileSession } from "./profile-session-service.mjs";

describe("Private curator compatibility", () => {
  let stateDir, profilesDir;
  beforeEach(() => {
    stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "private-curator-"));
    profilesDir = path.join(stateDir, "profiles");
    saveProfile({ id: "owner", name: "Owner", role: "owner", pin: "1357", reactions: { private: "love" } }, profilesDir);
    saveProfile({ id: "reader", name: "Reader", reactions: { novel: "cozy" } }, profilesDir);
    saveProfile({ id: "child", name: "Child", isKids: true, pin: "2468" }, profilesDir);
    // Deliberately unrelated household data must never become a fallback.
    fs.writeFileSync(path.join(stateDir, "curator.json"), JSON.stringify({ liked: ["global-secret"], hidden: ["global-hidden"] }));
  });
  afterEach(() => fs.rmSync(stateDir, { recursive: true, force: true }));
  function client(profileId) {
    const device = registerAuthorizedDevice({ name: "Test", activeProfileId: profileId }, stateDir);
    const req = { method: "GET", url: "/api/curator", headers: { host: "localhost" }, socket: { remoteAddress: "127.0.0.1" } };
    const token = signDeviceToken(device, getGateSecret(stateDir));
    const session = replaceProfileSession(req, profilesDir, profileId, device.id);
    req.headers.cookie = `reelos_device_token=${token}; reelos_profile_session=${session.token}`;
    return { req, device,
      request: (route = "/api/curator", method = "GET", body = {}, extra = {}) =>
        processPrivateCuratorRequest({ ...req, method, url: route }, async () => body, { stateDir, profilesDir, ...extra }),
    };
  }
  function stored(id) { return fs.readFileSync(path.join(profilesDir, `${id}.json`), "utf8"); }

  it("derives legacy reads only from each device's canonical private profile", async () => {
    const owner = client("owner"), reader = client("reader");
    assert.deepEqual((await owner.request()).payload.liked, ["private"]);
    assert.deepEqual((await reader.request()).payload.liked, ["novel"]);
    const originalGlobal = fs.readFileSync(path.join(stateDir, "curator.json"), "utf8");
    await owner.request("/api/curator", "POST", { id: "film", vote: "dislike" });
    assert.deepEqual((await owner.request()).payload.hidden, ["film"]);
    assert.deepEqual((await reader.request()).payload.hidden, []);
    assert.equal(fs.readFileSync(path.join(stateDir, "curator.json"), "utf8"), originalGlobal);
    assert.deepEqual(privateCuratorState(null).liked, []);
    assert.equal(privateCuratorState({ reactions: { x: "dismiss", y: "love" }, likedIds: ["legacy"] }).liked.join(), "y");
    const taste = await owner.request("/api/curator/taste");
    assert.equal(taste.payload.profile.id, "owner");
    assert.equal(taste.payload.profile.pinHash, undefined);
    assert.equal(taste.payload.profile.pin, undefined);
  });

  it("denies unauthenticated, device-only, session-only, forged-device and cross-origin requests", async () => {
    const owner = client("owner"), other = client("reader");
    const cookies = owner.req.headers.cookie.split("; ");
    for (const cookie of ["", cookies[0], cookies[1], other.req.headers.cookie.split("; ")[0] + "; " + cookies[1]]) {
      for (const method of ["GET", "POST"]) {
        const result = await processPrivateCuratorRequest({ ...owner.req, method, headers: { host: "localhost", cookie } }, async () => ({ id: "film", vote: "like" }), { profilesDir });
        assert.equal(result.status, 401);
      }
    }
    for (const method of ["GET", "POST"]) {
      for (const extra of [{ origin: "https://hostile.invalid" }, { "sec-fetch-site": "cross-site" }]) {
        const result = await processPrivateCuratorRequest({ ...owner.req, method, headers: { ...owner.req.headers, ...extra } }, async () => ({}), { profilesDir });
        assert.equal(result.status, 403);
      }
    }
  });

  it("treats every body and query profile selector as an assertion on every route", async () => {
    const owner = client("owner");
    for (const route of ["/api/curator", "/api/curator/reset", "/api/curator/teach", "/api/curator/taste", "/api/curator/feed", "/api/curator/recommendations"]) {
      const method = ["/api/curator/reset", "/api/curator/teach"].includes(route) ? "POST" : "GET";
      for (const key of ["profileId", "residentId", "expectedProfileId"]) {
        assert.equal((await owner.request(`${route}?${key}=reader`, method)).status, 403);
        assert.equal((await owner.request(`${route}?${key}=owner&${key}=reader`, method)).status, 403);
      }
    }
    for (const key of ["profileId", "residentId", "expectedProfileId"]) {
      assert.equal((await owner.request("/api/curator", "POST", { id: "film", vote: "like", [key]: "reader" })).status, 403);
      assert.equal((await owner.request("/api/curator/taste", "POST", { weights: { [key]: "reader" } })).status, 403);
    }
    assert.equal((await owner.request("/api/curator?profileId=../owner")).status, 400);
    assert.equal((await owner.request("/api/curator?profileId=owner", "POST", { id: "film", vote: "like", expectedProfileId: "owner" })).status, 200);
  });

  it("maps explicit aliases to canonical taste and reset, preserving other fields and not training globally", async (t) => {
    const owner = client("owner");
    const original = getProfile("owner", profilesDir);
    original.futurePrivate = { untouched: true };
    fs.writeFileSync(path.join(profilesDir, "owner.json"), JSON.stringify(original));
    let trainingCalls = 0;
    const originalTraining = Object.getOwnPropertyDescriptor(globalThis, "trainNeuralEngine");
    Object.defineProperty(globalThis, "trainNeuralEngine", { configurable: true, value: () => { trainingCalls++; } });
    t.after(() => {
      if (originalTraining) Object.defineProperty(globalThis, "trainNeuralEngine", originalTraining);
      else Reflect.deleteProperty(globalThis, "trainNeuralEngine");
    });
    for (const [vote, reaction, dismissed, less] of [
      ["likes", "like", false, false], ["love", "love", false, false], ["cozy", "cozy", false, false],
      ["dislike", undefined, false, true], ["hidden", undefined, false, true], ["dismiss", undefined, true, false],
      ["reset", undefined, false, false], [null, undefined, false, false],
    ]) {
      const result = await owner.request("/api/curator", "POST", { id: "film", vote, ids: ["alias"], jellyfinId: "media" });
      assert.equal(result.status, 200);
      assert.equal(result.payload.persisted, true);
      const current = getProfile("owner", profilesDir);
      assert.equal(current.reactions.film, reaction);
      assert.equal(current.dismissedTasteIds.includes("film"), dismissed);
      assert.equal(current.lessLikeIds.includes("film"), less);
      assert.deepEqual(current, { ...original, reactions: { ...original.reactions, ...(reaction ? { film: reaction } : {}) },
        dismissedTasteIds: dismissed ? ["film"] : [], lessLikeIds: less ? ["film"] : [], updatedAt: current.updatedAt });
    }
    for (const [action, reaction] of [["more_like_this", "like"], ["comfort_classic", "cozy"], ["not_interested", undefined]]) {
      assert.equal((await owner.request("/api/curator/teach", "POST", { titleId: "film", action, genres: ["Drama"] })).status, 200);
      assert.equal(getProfile("owner", profilesDir).reactions.film, reaction);
    }
    assert.equal((await owner.request("/api/curator/teach", "POST", { id: "film", rating: "love" })).status, 200);
    assert.equal((await owner.request("/api/curator/reset", "POST")).status, 200);
    assert.deepEqual(getProfile("owner", profilesDir).reactions, {});
    assert.deepEqual(getProfile("reader", profilesDir).reactions, { novel: "cozy" });
    assert.equal(trainingCalls, 0);
  });

  it("permits children to change only their own taste without changing protections", async () => {
    const child = client("child");
    const before = getProfile("child", profilesDir);
    assert.equal((await child.request("/api/curator/teach", "POST", { id: "film", rating: "cozy" })).status, 200);
    const after = getProfile("child", profilesDir);
    assert.deepEqual(after, { ...before, reactions: { film: "cozy" }, updatedAt: after.updatedAt });
    assert.equal((await child.request("/api/curator/teach", "POST", { id: "film", rating: "like", profileId: "owner" })).status, 403);
    assert.equal((await child.request("/api/curator/taste", "POST", { tasteVibe: "comfort", isKids: false })).status, 400);
  });

  it("rereads authorization and profile data after asynchronous body or catalog work", async () => {
    for (const mutation of ["revoke", "switch", "profile-update"]) {
      const owner = client("owner");
      const before = stored("owner");
      const result = await processPrivateCuratorRequest({ ...owner.req, method: "POST" }, async () => {
        if (mutation === "revoke") revokeAuthorizedDevice(owner.device.id, stateDir);
        if (mutation === "switch") setAuthorizedDeviceActiveProfile(owner.device.id, "reader", stateDir);
        if (mutation === "profile-update") {
          const current = getProfile("owner", profilesDir);
          fs.writeFileSync(path.join(profilesDir, "owner.json"), JSON.stringify({ ...current, futureDuringRead: true }));
        }
        return { id: "film", vote: "like" };
      }, { profilesDir });
      assert.equal(result.status, mutation === "profile-update" ? 200 : 401);
      if (mutation !== "profile-update") assert.equal(stored("owner"), before);
      else assert.equal(getProfile("owner", profilesDir).futureDuringRead, true);
    }
    const owner = client("owner");
    const feed = await owner.request("/api/curator/feed", "GET", {}, { catalog: async () => {
      revokeAuthorizedDevice(owner.device.id, stateDir);
      return { movies: [{ id: "film", title: "Film" }] };
    } });
    assert.equal(feed.status, 401);
    assert.equal(feed.payload.feed, undefined);
  });

  it("validates votes, IDs, methods and bounded taste fields without accidental dislikes", async () => {
    const owner = client("owner");
    const before = stored("owner");
    for (const body of [{ id: "film" }, { id: "film", vote: "unknown" }, { id: "../film", vote: "like" },
      { id: "film", titleId: "other", vote: "like" }, { id: "film", vote: "like", taste: "dislike" },
      { id: "film", vote: "like", role: "owner" }, [], { id: "__proto__", vote: "like" }]) {
      assert.equal((await owner.request("/api/curator", "POST", body)).status, 400);
    }
    for (const body of [{ id: "film" }, { id: "film", action: "train" }, { id: "film", rating: "like", action: "not_interested" },
      { id: "film", rating: "love", genres: [42] }]) {
      assert.equal((await owner.request("/api/curator/teach", "POST", body)).status, 400);
    }
    for (const body of [{}, { tasteVibe: "unknown" }, { mediaPriorities: { movies: 101 } }, { mediaPriorities: { adult: 50 } },
      { curationWeights: { drama: 4 } }, { weights: { drama: "1" } }, { themeDesign: "../secret" },
      { preset: {} }, { curationWeights: { constructor: 1 } }, { curationWeights: Object.fromEntries(Array.from({ length: 129 }, (_, index) => [`w${index}`, 1])) }]) {
      assert.equal((await owner.request("/api/curator/taste", "POST", body)).status, 400);
    }
    assert.equal(stored("owner"), before);
    assert.equal((await owner.request("/api/curator/teach")).status, 405);
    assert.equal((await owner.request("/api/curator/feed", "POST")).status, 405);
    assert.equal((await owner.request("/api/curator", "DELETE")).status, 405);
    assert.equal((await owner.request("/api/curator/unknown")).status, 404);
    const patch = { tasteVibe: "comfort", curationWeights: { drama: 2 }, weights: { warmth: 0.5 },
      mediaPriorities: { movies: 70, tv: 30, books: 40 }, themeDesign: "warm_velvet", preset: "cozy" };
    assert.equal((await owner.request("/api/curator/taste", "POST", patch)).status, 200);
    const current = getProfile("owner", profilesDir);
    assert.deepEqual(current, { ...JSON.parse(before), ...patch, updatedAt: current.updatedAt });
  });

  it("preserves body-size failures and rejects a freshly switched identity after reading", async () => {
    const owner = client("owner");
    const before = stored("owner");
    const tooLarge = await processPrivateCuratorRequest({ ...owner.req, method: "POST" }, async () => {
      throw Object.assign(new Error("too large"), { status: 413 });
    }, { profilesDir });
    assert.equal(tooLarge.status, 413);
    assert.equal(tooLarge.payload.code, "payload_too_large");
    const req = { ...owner.req, method: "POST", headers: { ...owner.req.headers } };
    const changed = await processPrivateCuratorRequest(req, async () => {
      setAuthorizedDeviceActiveProfile(owner.device.id, "reader", stateDir);
      const session = replaceProfileSession(req, profilesDir, "reader", owner.device.id);
      req.headers.cookie = req.headers.cookie.split("; ")[0] + `; reelos_profile_session=${session.token}`;
      return { id: "film", vote: "love" };
    }, { profilesDir });
    assert.equal(changed.status, 403);
    assert.equal(changed.payload.code, "profile_changed");
    assert.equal(stored("owner"), before);
    assert.deepEqual(getProfile("reader", profilesDir).reactions, { novel: "cozy" });
  });

  it("fails closed without an authorized catalog adapter and excludes private hidden titles", async () => {
    const owner = client("owner");
    assert.equal((await owner.request("/api/curator/feed")).status, 503);
    assert.equal((await owner.request("/api/curator/feed", "GET", {}, { catalog: { movies: [] } })).status, 503);
    await owner.request("/api/curator", "POST", { id: "hidden", vote: "dislike" });
    await owner.request("/api/curator", "POST", { id: "safe", vote: "dismiss" });
    assert.deepEqual((await owner.request()).payload.dismissed, ["safe"]);
    assert.deepEqual((await owner.request()).payload.hidden, ["hidden"]);
    const result = await owner.request("/api/curator/recommendations", "GET", {}, { catalog: async (req, profile) => {
      assert.equal(profile.id, "owner");
      assert.equal(req.url, "/api/curator/recommendations");
      return { movies: [{ id: "safe", title: "Safe", rating: 8 }, { id: "hidden", title: "Hidden", rating: 9 }] };
    } });
    assert.equal(result.status, 200);
    assert.deepEqual(result.payload.feed.personalized.map((item) => item.id), ["safe"]);
    assert.equal(result.payload.profileId, "owner");
    assert.equal(result.payload.familySafe, undefined);
  });

  it("projects only public catalog metadata before curation, including nested collections and bridges", async () => {
    const owner = client("owner");
    const result = await owner.request("/api/curator/feed", "GET", {}, { catalog: async () => ({
      movies: [{ id: "dune", title: "Dune", year: 2021, rating: 8, genres: ["Science Fiction", { token: "NESTED_SECRET" }],
        overview: "A desert planet.", director: "Denis Villeneuve", runtime: 155, inLibrary: true,
        poster: "https://image.tmdb.org/t/p/w500/dune.jpg",
        backdrop: "/api/jf/Items/dune/Images/Backdrop?maxWidth=1280&quality=70",
        path: "/private/LOCAL_SECRET.mp4", Path: "C:\\private\\WINDOWS_SECRET.mp4",
        source: { token: "SOURCE_SECRET", url: "https://provider.invalid/STREAM_SECRET" },
        streamUrl: "https://provider.invalid/STREAM_SECRET", arbitrary: { secret: "UNKNOWN_SECRET" },
        crossMediaBridge: { token: "BRIDGE_SECRET" },
        collection: { id: 12, name: "Dune collection", poster: "https://archive.org/services/img/Dune", token: "COLLECTION_SECRET" } }],
      books: [{ id: "dune-book", title: "Dune", author: "Frank Herbert", rating: 8, genres: ["Science Fiction"],
        path: "/private/BOOK_SECRET.epub", credentials: { key: "BOOK_TOKEN_SECRET" } }],
    }) });
    assert.equal(result.status, 200);
    const movie = result.payload.feed.personalized.find((item) => item.id === "dune");
    assert.equal(movie.title, "Dune");
    assert.equal(movie.runtime, 155);
    assert.deepEqual(movie.genres, ["Science Fiction"]);
    assert.equal(movie.poster, "https://image.tmdb.org/t/p/w500/dune.jpg");
    assert.equal(movie.backdrop, "/api/jf/Items/dune/Images/Backdrop?maxWidth=1280&quality=70");
    assert.deepEqual(movie.collection, { id: 12, name: "Dune collection", poster: "https://archive.org/services/img/Dune" });
    assert.deepEqual(movie.crossMediaBridge, { bookTitle: "Dune", bookAuthor: "Frank Herbert", bookId: "dune-book" });
    assert.equal(result.payload.feed.pageToScreen.length, 2);
    assert.doesNotMatch(JSON.stringify(result.payload), /SECRET|provider\.invalid|"path"|"Path"|"source"|"credentials"/);
  });

  it("drops local, credential-bearing and arbitrary upstream artwork without dropping the title", async () => {
    const owner = client("owner");
    const unsafe = [
      "/private/art.jpg", "C:\\private\\art.jpg", "file:///private/art.jpg", "data:image/svg+xml,secret",
      "//image.tmdb.org/t/p/w500/art.jpg", "https://user:pass@image.tmdb.org/t/p/w500/art.jpg",
      "https://image.tmdb.org/t/p/w500/art.jpg?api_key=secret", "https://image.tmdb.org/t/p/w500/art.jpg#secret",
      "http://image.tmdb.org/t/p/w500/art.jpg", "https://image.tmdb.org:9443/t/p/w500/art.jpg",
      "https://image.tmdb.org.evil.invalid/t/p/w500/art.jpg", "https://provider.invalid/art.jpg",
      "https://archive.org/download/secret/art.jpg", "https://127.0.0.1/private.jpg",
      "/api/jf/Items/film/Images/Primary?api_key=secret", "/api/jf/Items/film/Images/Primary?url=https://provider.invalid",
      "/api/jf/Items/film/Images/Primary?maxWidth=240&maxWidth=999", "/api/jf/Items/film/Images/Primary?quality=101",
      "/api/jf/Items/film/Images/Primary#secret", "/api/jf/Items/film/../other/Images/Primary",
      "/api/jf/Items/%66ilm/Images/Primary", "/api/stream/film", { url: "https://image.tmdb.org/t/p/w500/art.jpg", token: "secret" },
    ];
    for (const artwork of unsafe) {
      const result = await owner.request("/api/curator/feed", "GET", {}, { catalog: async () => ({ movies: [{
        id: "film", title: "Film", poster: artwork, backdrop: artwork,
        collection: { id: 1, name: "Collection", poster: artwork },
      }] }) });
      assert.equal(result.status, 200);
      const item = result.payload.feed.personalized[0];
      assert.equal(item.id, "film");
      assert.equal(item.poster, undefined, String(artwork));
      assert.equal(item.backdrop, undefined, String(artwork));
      assert.deepEqual(item.collection, { id: 1, name: "Collection" });
    }
  });

  it("reports failed writes and renames honestly and leaves the stored profile unchanged", async (t) => {
    const owner = client("owner");
    const before = stored("owner");
    for (const method of ["writeFileSync", "renameSync"]) {
      for (const [code, expected] of [["ENOSPC", 507], ["EACCES", 503]]) {
        const mock = t.mock.method(fs, method, () => { throw Object.assign(new Error(code), { code }); });
        let result;
        try { result = await owner.request("/api/curator", "POST", { id: "film", vote: "like" }); }
        finally { mock.mock.restore(); }
        assert.equal(result.status, expected);
        assert.equal(result.payload.ok, false);
        assert.equal(result.payload.persisted, undefined);
        assert.equal(stored("owner"), before);
        assert.equal(fs.readdirSync(profilesDir).some((name) => name.endsWith(".tmp")), false);
      }
    }
  });
});
