import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  AGE_BANDS,
  MEMBER_WIZARD_QUESTIONS,
  MEMBER_WIZARD_TOTAL,
  OWNER_PERMISSION_TOGGLES,
  applyOwnerPermissions,
  bindJellyfinAccount,
  createSession,
  defaultPermissions,
  dispatchProfilesApi,
  googleTvScrapeEnabled,
  isHouseOwner,
  loadProfiles,
  normalizeProfile,
  ownerFromAnswers,
  parentalMaxForAge,
  publicProfile,
  saveProfiles,
  sessionCookieHeader,
  sessionTokenFromReq,
  setTaste,
  tasteFor,
} from "./reelos-profiles.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function tmpRoot() {
  return mkdtempSync(join(tmpdir(), "reelos-profiles-"));
}

test("member wizard is exactly two questions, verbatim", () => {
  assert.equal(MEMBER_WIZARD_TOTAL, 2);
  assert.equal(MEMBER_WIZARD_QUESTIONS.length, 2);
  assert.equal(MEMBER_WIZARD_QUESTIONS[0].title, "How old are you?");
  assert.equal(
    MEMBER_WIZARD_QUESTIONS[0].sub,
    "This sets the parental rating on your Jellyfin account. The owner can change it later in Settings.",
  );
  assert.equal(MEMBER_WIZARD_QUESTIONS[1].title, "Jellyfin username and password/PIN");
  assert.equal(
    MEMBER_WIZARD_QUESTIONS[1].sub,
    "Your Jellyfin account — not the owner's. ReelOS signs in as this user on this phone and on the TV.",
  );
});

test("TS copy matches the box profile module", () => {
  const ts = read("src/lib/household-profile.ts");
  const wizard = read("src/components/profile-wizard.tsx");
  const house = read("src/components/wizard.tsx");
  assert.match(ts, /How old are you\?/);
  assert.match(ts, /Jellyfin username and password\/PIN/);
  assert.match(wizard, /MEMBER_WIZARD_TOTAL/);
  assert.match(wizard, /MEMBER_WIZARD_QUESTIONS/);
  assert.match(house, /const TOTAL = 7/);
  assert.doesNotMatch(house, /How old are you\?/);
  assert.doesNotMatch(house, /Jellyfin username and password\/PIN/);
});

test("owner permission toggles are named and do not scrape Google TV", () => {
  const ids = OWNER_PERMISSION_TOGGLES.map((t) => t.id);
  assert.deepEqual(ids, [
    "canRequest",
    "autoApprove",
    "canApprove",
    "canManageHouse",
    "canRemoveLibrary",
    "traktEnabled",
  ]);
  assert.equal(
    OWNER_PERMISSION_TOGGLES.find((t) => t.id === "traktEnabled")?.hint,
    "Scrobble this profile. Off by default. Not a Google TV scrape.",
  );
  assert.equal(googleTvScrapeEnabled(), false);
  const src = read("scripts/reelos-profiles.mjs");
  assert.doesNotMatch(src, /googleapis\.com|accounts\.google/);
  assert.match(src, /Not a Google TV scrape/);
});

test("age maps to Jellyfin MaxParentalRating", () => {
  assert.equal(parentalMaxForAge(5), 7);
  assert.equal(parentalMaxForAge(10), 10);
  assert.equal(parentalMaxForAge(15), 14);
  assert.equal(parentalMaxForAge(18), null);
  assert.equal(AGE_BANDS.length, 4);
});

test("owner from wizard answers; member defaults cannot manage the house", () => {
  const owner = ownerFromAnswers({ adminName: "Austin", adminPassword: "household" });
  assert.equal(owner.role, "owner");
  assert.equal(owner.jellyfinUser, "Austin");
  assert.equal(isHouseOwner(owner.role), true);
  const member = defaultPermissions("member", 10);
  assert.equal(member.canManageHouse, false);
  assert.equal(member.traktEnabled, false);
  assert.equal(member.canRequest, true);
  assert.equal(defaultPermissions("member", 6).canRequest, false);
});

test("passwords never leave publicProfile", () => {
  const p = publicProfile(normalizeProfile({ name: "Jon", jellyfinPassword: "secret", role: "member" }));
  assert.equal("jellyfinPassword" in p, false);
  assert.equal(p.name, "Jon");
});

test("like/dislike is stored per profile id", () => {
  let state = { profiles: [], sessions: {}, taste: {} };
  state = setTaste(state, "u-jon", "tmdb-550", "like");
  state = setTaste(state, "u-nes", "tmdb-550", "dislike");
  state = setTaste(state, "u-jon", "tmdb-13", "dislike");
  assert.deepEqual(tasteFor(state, "u-jon"), { likes: ["tmdb-550"], dislikes: ["tmdb-13"] });
  assert.deepEqual(tasteFor(state, "u-nes"), { likes: [], dislikes: ["tmdb-550"] });
});

test("owner can flip member permission toggles", () => {
  const member = normalizeProfile({ name: "Nessa", role: "member", ageYears: 10 });
  const next = applyOwnerPermissions(member, { canRequest: false, traktEnabled: true });
  assert.equal(next.permissions.canRequest, false);
  assert.equal(next.permissions.traktEnabled, true);
  assert.equal(next.traktEnabled, true);
});

test("session cookie is HttpOnly and names the profile cookie", () => {
  const set = sessionCookieHeader("abc123");
  assert.match(set, /reelos_profile=abc123/);
  assert.match(set, /HttpOnly/);
  const req = { headers: { cookie: "reelos_profile=abc123; other=1" } };
  assert.equal(sessionTokenFromReq(req), "abc123");
  const state = { profiles: [ownerFromAnswers({ adminName: "Ada" })], sessions: {}, taste: {} };
  const sess = createSession(state, state.profiles[0].id);
  assert.equal(sess.state.sessions[sess.token].profileId, "u-owner");
});

test("profiles persist under a house dir and seed the owner", () => {
  const dir = tmpRoot();
  try {
    const state = loadProfiles(dir, { adminName: "Austin", adminPassword: "pinpinpin" });
    assert.equal(state.profiles[0].name, "Austin");
    saveProfiles(state, dir);
    const again = loadProfiles(dir, { adminName: "Austin", adminPassword: "pinpinpin" });
    assert.equal(again.profiles[0].jellyfinUser, "Austin");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("setup creates a member session as that Jellyfin user, not the owner", async () => {
  const dir = tmpRoot();
  try {
    const tokens = new Map();
    const created = [];
    const jellyfinToken = async (user, password) => {
      if (user === "Austin" && password === "housepin") return { token: "owner-token", id: "jf-owner" };
      if (tokens.has(user) && tokens.get(user) === password) return { token: `tok-${user}`, id: `jf-${user}` };
      return null;
    };
    const fetchImpl = async (url, opts) => {
      if (String(url).endsWith("/Users/New")) {
        const body = JSON.parse(opts.body);
        created.push(body.Name);
        tokens.set(body.Name, body.Password);
        return { ok: true, json: async () => ({ Id: `jf-${body.Name}` }), text: async () => "" };
      }
      if (String(url).includes("/Policy")) return { ok: true, json: async () => ({}), text: async () => "" };
      if (String(url).includes("/Users/jf-")) {
        return { ok: true, json: async () => ({ Id: "jf-kid", Policy: { EnableAllFolders: true } }), text: async () => "" };
      }
      return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
    };
    const req = {
      method: "POST",
      url: "/api/profiles/setup",
      headers: {},
    };
    const chunks = [
      JSON.stringify({
        ageYears: 10,
        jellyfinUser: "Jon",
        jellyfinPassword: "jonpin",
      }),
    ];
    req[Symbol.asyncIterator] = async function* () {
      yield Buffer.from(chunks[0]);
    };
    let status = 0;
    let body = null;
    let cookie = "";
    const res = {
      setHeader(k, v) {
        if (String(k).toLowerCase() === "set-cookie") cookie = v;
      },
      end(s) {
        body = JSON.parse(s);
      },
      set statusCode(n) {
        status = n;
      },
    };
    const handled = await dispatchProfilesApi(req, res, {
      root: dir,
      answers: () => ({ adminName: "Austin", adminPassword: "housepin" }),
      readBody: async () => JSON.parse(chunks[0]),
      jellyfinToken,
      jellyfinAuthedHeaders: (t) => ({ Authorization: t }),
      fetchImpl,
    });
    assert.equal(handled, true);
    assert.equal(status, 200);
    assert.equal(body.session.jellyfinUser, "Jon");
    assert.equal(body.session.role, "member");
    assert.equal("jellyfinPassword" in body.session, false);
    assert.match(cookie, /reelos_profile=/);
    assert.deepEqual(created, ["Jon"]);
    const saved = loadProfiles(dir, { adminName: "Austin", adminPassword: "housepin" });
    const jon = saved.profiles.find((p) => p.jellyfinUser === "Jon");
    assert.equal(jon.jellyfinPassword, "jonpin");
    assert.equal(jon.parentalMax, 10);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("bindJellyfinAccount authenticates an existing user without Users/New", async () => {
  let created = 0;
  const r = await bindJellyfinAccount({
    fetchImpl: async (url) => {
      if (String(url).includes("/Users/New")) created += 1;
      return { ok: false, text: async () => "no" };
    },
    jellyfinToken: async (user, pin) => (user === "Ada" && pin === "adaada" ? { token: "t", id: "1" } : null),
    jellyfinAuthedHeaders: () => ({}),
    ownerAuth: { token: "owner", id: "o" },
    username: "Ada",
    password: "adaada",
    parentalMax: null,
  });
  assert.equal(r.ok, true);
  assert.equal(created, 0);
});

test("house wizard file stays seven steps", () => {
  const wizard = read("src/components/wizard.tsx");
  assert.match(wizard, /const TOTAL = 7/);
  assert.match(wizard, /step === 7 && <StepAccess/);
  assert.doesNotMatch(wizard, /const TOTAL = 8/);
});
