import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  GOOGLE_TV_COPY,
  TRAKT_FREE_COPY,
  continueEntries,
  createProfileStore,
  defaultHouse,
  dispatchProfilesApi,
  filterDiscoverForProfile,
  isAdultTitle,
  kidsLocks,
  needsProfilePicker,
  publicTrakt,
  voteOnTitle,
} from "./reelos-profiles.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function tmpStore(fetchImpl) {
  const dir = mkdtempSync(join(tmpdir(), "reelos-profiles-"));
  writeFileSync(join(dir, "answers.json"), JSON.stringify({ adminName: "Ada" }) + "\n");
  return createProfileStore({ dir, fetchImpl });
}

function mockRes() {
  const headers = {};
  return {
    statusCode: 0,
    body: null,
    headers,
    setHeader(k, v) {
      headers[String(k).toLowerCase()] = v;
    },
  };
}

function send(res, code, body) {
  res.statusCode = code;
  res.body = body;
}

test("single admin does not need a profile picker", () => {
  const house = defaultHouse({ adminName: "Ada" });
  assert.equal(needsProfilePicker(house), false);
  assert.equal(house.profiles[0].role, "admin");
  assert.equal(house.profiles[0].kind, "adult");
  assert.equal(kidsLocks(house.profiles[0]).lockRequest, false);
});

test("two profiles do not share downvotes", () => {
  const box = tmpStore();
  const ada = box.readHouse().profiles[0];
  const sam = box.addProfile({ name: "Sam" }).profile;
  assert.equal(needsProfilePicker(box.readHouse()), true);

  box.vote(ada.id, "tmdb-550", "down");
  box.vote(sam.id, "tmdb-13", "down");

  const adaCur = box.readCurator(ada.id);
  const samCur = box.readCurator(sam.id);
  assert.equal(adaCur.votes["tmdb-550"], "down");
  assert.equal(adaCur.votes["tmdb-13"], undefined);
  assert.equal(samCur.votes["tmdb-13"], "down");
  assert.equal(samCur.votes["tmdb-550"], undefined);

  const fightClub = { id: "tmdb-550", title: "Fight Club", genres: ["Drama"] };
  const adaRow = filterDiscoverForProfile([fightClub], { curator: adaCur, profile: ada });
  const samRow = filterDiscoverForProfile([fightClub], { curator: samCur, profile: sam });
  assert.equal(adaRow.length, 0, "Ada downvoted Fight Club");
  assert.equal(samRow.length, 1, "Sam still sees Fight Club");
});

test("local like/dislike works without Trakt", () => {
  const box = tmpStore();
  const id = box.readHouse().profiles[0].id;
  const curator = box.vote(id, "tmdb-13", "up");
  assert.equal(curator.votes["tmdb-13"], "up");
  assert.equal(curator.trakt.connected, false);
  const toggled = voteOnTitle(curator, "tmdb-13", "up");
  assert.equal(toggled.votes["tmdb-13"], undefined);
});

test("reset curator is per profile", () => {
  const box = tmpStore();
  const ada = box.readHouse().profiles[0];
  const kids = box.addProfile({ name: "Kids", kind: "kids" }).profile;
  box.vote(ada.id, "tmdb-550", "down");
  box.vote(kids.id, "tmdb-13", "up");
  box.resetCurator(ada.id);
  assert.deepEqual(box.readCurator(ada.id).votes, {});
  assert.equal(box.readCurator(kids.id).votes["tmdb-13"], "up");
});

test("kids hide adult and lock Request/Settings", () => {
  const box = tmpStore();
  const kids = box.addProfile({ name: "Kids", kind: "kids" }).profile;
  assert.deepEqual(kidsLocks(kids), { hideAdult: true, lockRequest: true, lockSettings: true });
  const adult = { id: "tmdb-69", title: "Adult Film", adult: true, genres: ["Drama"] };
  const kidOk = { id: "tmdb-12", title: "Finding Nemo", genres: ["Animation", "Family"] };
  const shown = filterDiscoverForProfile([adult, kidOk], { curator: box.readCurator(kids.id), profile: kids });
  assert.deepEqual(
    shown.map((t) => t.id),
    ["tmdb-12"],
  );
  assert.equal(isAdultTitle({ genres: ["Erotica"] }), true);
  assert.equal(isAdultTitle({ certification: "TV-MA" }), true);
  assert.equal(isAdultTitle({ genres: ["Animation"] }), false);
});

test("cannot remove the household admin", () => {
  const box = tmpStore();
  const out = box.removeProfile("p-admin");
  assert.equal(out.ok, false);
  assert.match(out.error, /admin/i);
});

test("continue watching is isolated per profile", () => {
  const box = tmpStore();
  const ada = box.readHouse().profiles[0];
  const sam = box.addProfile({ name: "Sam" }).profile;
  box.setContinue(ada.id, "tmdb-1396", 0.4);
  box.setContinue(sam.id, "tmdb-1396", 0.8);
  assert.equal(continueEntries(box.readCurator(ada.id))[0].progress, 0.4);
  assert.equal(continueEntries(box.readCurator(sam.id))[0].progress, 0.8);
});

test("Google TV copy is honest and Trakt is optional free", () => {
  assert.match(GOOGLE_TV_COPY, /no supported taste/i);
  assert.match(GOOGLE_TV_COPY, /will not Sign in with Google/i);
  assert.match(GOOGLE_TV_COPY, /will not scrape Google/i);
  assert.match(TRAKT_FREE_COPY, /Trakt is free/i);
  assert.match(TRAKT_FREE_COPY, /Local like\/dislike works/i);
  const plugin = readFileSync(join(root, "scripts/reelos-lookup-plugin.mjs"), "utf8");
  assert.match(plugin, /dispatchProfilesApi/);
  assert.match(plugin, /refuseIfKidsLocked/);
  assert.doesNotMatch(plugin, /accounts\.google\.com/);
  assert.doesNotMatch(plugin, /Sign in with Google/);
  const settings = readFileSync(join(root, "src/components/settings-accordions.tsx"), "utf8");
  assert.match(settings, /GOOGLE_TV_COPY|Google TV has no supported/);
  assert.doesNotMatch(settings, /Sign in with Google/);
  const discover = readFileSync(join(root, "src/components/discover-view.tsx"), "utf8");
  assert.match(discover, /DiscoverTitleCard|vote=/);
  const home = readFileSync(join(root, "src/components/home-view.tsx"), "utf8");
  assert.doesNotMatch(home, /vote=/);
});

test("GET /api/profiles reports isolated curator and Google TV no", async () => {
  const box = tmpStore();
  box.vote("p-admin", "tmdb-550", "down");
  box.addProfile({ name: "Sam" });
  const res = mockRes();
  const ok = await dispatchProfilesApi(
    { method: "GET", url: "/api/profiles", headers: { "x-reelos-profile": "p-admin" } },
    res,
    { send, readBody: async () => ({}), store: box },
  );
  assert.equal(ok, true);
  assert.equal(res.body.googleTv.supported, false);
  assert.match(res.body.googleTv.copy, /no supported/);
  assert.equal(res.body.trakt.free, true);
  assert.equal(res.body.curator.votes["tmdb-550"], "down");
  assert.equal(res.body.picker, true);

  const sam = mockRes();
  await dispatchProfilesApi(
    { method: "GET", url: "/api/profiles", headers: { "x-reelos-profile": "p-sam" } },
    sam,
    { send, readBody: async () => ({}), store: box },
  );
  assert.equal(sam.body.curator.votes["tmdb-550"], undefined);
});

test("kids POST /api/profiles is 403; Trakt device is optional", async () => {
  const box = tmpStore();
  const kids = box.addProfile({ name: "Kids", kind: "kids" }).profile;
  const res = mockRes();
  await dispatchProfilesApi(
    { method: "POST", url: "/api/profiles", headers: { "x-reelos-profile": kids.id } },
    res,
    { send, readBody: async () => ({ name: "Other" }), store: box },
  );
  assert.equal(res.statusCode, 403);

  const calls = [];
  const withFetch = tmpStore(async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        device_code: "dev",
        user_code: "ABCD",
        verification_url: "https://trakt.tv/activate",
        expires_in: 600,
        interval: 5,
      }),
    };
  });
  withFetch.writeTraktApp({ clientId: "cid", clientSecret: "sec" });
  const start = mockRes();
  await dispatchProfilesApi(
    { method: "POST", url: "/api/trakt", headers: { "x-reelos-profile": "p-admin" } },
    start,
    { send, readBody: async () => ({ action: "start" }), store: withFetch },
  );
  assert.equal(start.body.ok, true);
  assert.equal(start.body.pending.userCode, "ABCD");
  assert.match(calls[0].url, /api\.trakt\.tv\/oauth\/device\/code/);
  assert.equal(publicTrakt(withFetch.readCurator("p-admin")).connected, false);
});

test("vote toggle and Discover filter keep liked titles", () => {
  let curator = voteOnTitle(undefined, "tmdb-13", "up");
  curator = voteOnTitle(curator, "tmdb-550", "down");
  const titles = [
    { id: "tmdb-13", title: "Forrest Gump" },
    { id: "tmdb-550", title: "Fight Club" },
    { id: "tmdb-155", title: "The Dark Knight" },
  ];
  const shown = filterDiscoverForProfile(titles, { curator, profile: defaultHouse().profiles[0] });
  assert.deepEqual(
    shown.map((t) => t.id),
    ["tmdb-13", "tmdb-155"],
  );
});
