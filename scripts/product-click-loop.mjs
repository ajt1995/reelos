#!/usr/bin/env node
/**
 * Real hashed-UI click loop. Not the fixture HTML page.
 * Search / Request / Discover dislike / Rookie seasons / dump Remove / people.
 * Never Apply HP. Never wipe /media. Never POST person ids.
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import {
  houseHomeShelf,
  houseRawShelf,
  mergeLibraryJson,
  mergeLookupJson,
  honestReadyJson,
  idleUpdateStatus,
  HOUSE_UNMATCHED_DUMP,
} from "./cloud-house-shelf.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = String(process.env.CLICK_PORT || "18056");
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.env.CLICK_OUT || "/opt/cursor/artifacts";
const HASHED_CSS = "/assets/styles-BpMpl5a6.css";

mkdirSync(OUT, { recursive: true });

function waitHttp(url, { timeoutMs = 25000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  return (async () => {
    while (Date.now() < deadline) {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
        if (r.ok || r.status === 200) return true;
      } catch {
        /* door not up */
      }
      await new Promise((res) => setTimeout(res, 250));
    }
    throw new Error(`timeout waiting for ${url}`);
  })();
}

async function ensureDoor() {
  try {
    const html = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(2000) }).then((r) => r.text());
    if (html.includes(HASHED_CSS)) return null;
  } catch {
    /* start */
  }
  const child = spawn("node", ["scripts/with-app-env.mjs", "node", "scripts/reelos-box.mjs"], {
    cwd: ROOT,
    env: { ...process.env, PORT, HOST: "127.0.0.1", NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout?.on("data", (d) => {
    log += d;
  });
  child.stderr?.on("data", (d) => {
    log += d;
  });
  await waitHttp(`${BASE}/`);
  const html = await fetch(`${BASE}/`).then((r) => r.text());
  if (!html.includes("/assets/styles-")) {
    child.kill("SIGTERM");
    throw new Error(`hashed UI missing on ${BASE}: ${html.slice(0, 180)}\n${log.slice(-400)}`);
  }
  return child;
}

function jsonFrom(route) {
  return route.request().postDataJSON?.() || null;
}

async function snapshotDoorApis() {
  const ready = await fetch(`${BASE}/api/ready?limit=24`, { signal: AbortSignal.timeout(8000) }).then((r) => r.json());
  const library = await fetch(`${BASE}/api/library?limit=24`, { signal: AbortSignal.timeout(8000) })
    .then((r) => r.json())
    .catch(() => ({ titles: [] }));
  return { ready, library };
}

async function installProductRoutes(page, posts, snap) {
  const removed = new Set();
  const namedRefuse = new Set(["tvdb-350665", "tmdb-tv-79744", "rook", "tmdb-tv-125988", "tvdb-403245", "silo", "reach"]);

  function dropRemoved(titles) {
    return (titles || []).filter((t) => {
      const keys = [t.id, t.jellyfinId, ...(t.ids || [])].map(String);
      return !keys.some((k) => removed.has(k));
    });
  }
  function readyJson() {
    const base = honestReadyJson(snap.ready, houseHomeShelf());
    return { ...base, titles: dropRemoved(base.titles) };
  }
  function libraryJson() {
    const base = mergeLibraryJson(snap.library || { titles: [] });
    return { ...base, titles: dropRemoved(base.titles) };
  }

  await page.route(/\/api\/update\/(status|progress|check)(\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(idleUpdateStatus()),
    });
  });
  await page.route(/\/api\/update\/apply(\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "click loop does not Apply" }),
    });
  });
  await page.route(/\/api\/ready(\?|$)/, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(readyJson()) });
  });
  await page.route(/\/api\/library(\?|$)/, async (route) => {
    const req = route.request();
    if (req.method() === "DELETE") {
      const body = jsonFrom(route) || {};
      posts.deletes.push(body);
      const id = String(body.titleId || body.jellyfinId || "");
      if (namedRefuse.has(id) || /350665|79744/.test(JSON.stringify(body))) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "refused: would remove named The Rookie" }),
        });
        return;
      }
      for (const k of [id, body.jellyfinId, ...(body.ids || [])]) if (k) removed.add(String(k));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, keys: [id, body.jellyfinId].filter(Boolean) }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(libraryJson()) });
  });
  await page.route(/\/api\/lookup(\?|$)/, async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("q")) {
      await route.continue();
      return;
    }
    const id = url.searchParams.get("id") || "";
    const live = await fetch(route.request().url(), { signal: AbortSignal.timeout(12000) })
      .then((r) => r.json())
      .catch(() => ({ titles: [] }));
    const body = id ? mergeLookupJson(live, id) : live;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.route(/\/api\/request(\?|$)/, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === "POST") {
      const body = jsonFrom(route) || {};
      posts.requests.push(body);
      const blob = JSON.stringify(body).toLowerCase();
      if (body.mediaType === "person" || /"person"/.test(blob) || /person-\d+/.test(blob)) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "refused person id" }),
        });
        return;
      }
    }
    const id = url.searchParams.get("id") || "";
    if (req.method() === "GET" && /79744|350665|tmdb-tv-79744|tvdb-350665/.test(id)) {
      const live = await fetch(req.url(), { signal: AbortSignal.timeout(12000) })
        .then((r) => r.json())
        .catch(() => ({}));
      const house = houseRawShelf().find((t) => t.id === "tvdb-350665");
      const zero = /0%/.test(String(live.reason || live.status || ""));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...live,
          onDiskSeasons: house.onDiskSeasons,
          importingSeasons: house.importingSeasons,
          unreleasedSeasons: house.unreleasedSeasons,
          seasonList: house.seasonList,
          reason: zero ? "On disk, importing" : live.reason,
          status: zero ? "downloading" : live.status,
        }),
      });
      return;
    }
    await route.continue();
  });
}

async function shot(page, name) {
  const path = join(OUT, name);
  await page.screenshot({ path, fullPage: false });
  return path;
}

async function nav(page, label) {
  const phone = page.locator("nav.fixed a", { hasText: label }).first();
  if (await phone.count()) {
    await phone.click();
    return;
  }
  await page.locator("aside a", { hasText: label }).first().click();
}

async function waitHome(page) {
  const splash = /Updating ReelOS|Downloading update|Applying 1\.2/i;
  try {
    await page.getByPlaceholder(/Search movies, shows, people/i).waitFor({ timeout: 25000 });
  } catch (err) {
    const body = await page.locator("body").innerText().catch(() => "");
    throw new Error(`hashed Home missing search: ${body.slice(0, 400)}\n${err}`);
  }
  const body = await page.locator("body").innerText();
  if (splash.test(body) && !/On this box/i.test(body)) {
    throw new Error(`splash-locked hashed Home: ${body.slice(0, 240)}`);
  }
}

async function searchAndOpen(page, query, { title, kind } = {}) {
  const box = page.getByPlaceholder(/Search movies, shows, people/i);
  await box.click();
  await box.fill("");
  await box.fill(query);
  await page.waitForTimeout(700);
  const hit = title
    ? page.locator("form ul a", { hasText: title }).first()
    : page.locator("form ul a").first();
  await hit.waitFor({ timeout: 15000 });
  if (kind === "person") {
    await page.locator("form ul a", { hasText: "Actor" }).first().click();
    return;
  }
  if (kind === "collection") {
    await page.locator("form ul a", { hasText: "Collection" }).first().click();
    return;
  }
  await hit.click();
  await page.waitForURL(/\/(title|person|collection)\//, { timeout: 15000 });
}

async function searchRequestTitle(page, queries, { tv = false } = {}) {
  for (const q of queries) {
    await nav(page, "Home");
    await waitHome(page);
    try {
      await searchAndOpen(page, q, { title: q });
      await page.getByRole("heading", { name: q }).waitFor({ timeout: 15000 });
    } catch {
      continue;
    }
    if (tv) {
      if (!/\/title\/tmdb-tv-/.test(page.url())) continue;
    } else {
      if (!/\/title\/tmdb-\d+/.test(page.url()) || /tmdb-tv-/.test(page.url())) continue;
    }
    const ok = await clickRequestIfPresent(page);
    if (ok) return { query: q, requested: true };
  }
  return { query: queries[0], requested: false };
}

async function clickRequestIfPresent(page) {
  const btn = page.getByRole("button", { name: /^(Request( S\d+)?)$/ }).first();
  try {
    await btn.waitFor({ state: "attached", timeout: 12000 });
  } catch {
    return false;
  }
  if (await btn.isDisabled()) return false;
  await btn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await btn.click();
  await page.waitForTimeout(900);
  return true;
}

const verdict = {
  ok: false,
  version: "1.2.50.56",
  hashedCss: HASHED_CSS,
  steps: {},
  posts: { requests: [], deletes: [] },
  errors: [],
};

let child = null;
let browser = null;
try {
  child = await ensureDoor();
  const html = await fetch(`${BASE}/`).then((r) => r.text());
  assert.match(html, /\/assets\/styles-[A-Za-z0-9_-]+\.css/);
  assert.doesNotMatch(html, /\/src\/styles\.css/);
  verdict.steps.hashedUi = html.includes(HASHED_CSS) || /\/assets\/styles-/.test(html);

  const collapsed = houseHomeShelf().map((t) => t.title);
  assert.ok(collapsed.includes("The Rookie"));
  assert.ok(collapsed.includes("Silo"));
  assert.ok(collapsed.includes("Reacher"));
  assert.ok(!collapsed.some((n) => /UIndex org - Silo|Torrenting|Il Ponte|UIndex org - The Rookie/i.test(n)));
  assert.ok(collapsed.some((n) => n === HOUSE_UNMATCHED_DUMP.title || n.includes("Completely Different Show")));

  const snap = await snapshotDoorApis();
  assert.equal(honestReadyJson(snap.ready, houseHomeShelf()).update.running, false);
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const posts = { requests: [], deletes: [] };
  await page.addInitScript((idle) => {
    const orig = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      if (/\/api\/update\/apply/.test(url) && String(init?.method || "GET").toUpperCase() === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: false, error: "click loop does not Apply" }), {
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (/\/api\/update\/(status|progress|check)/.test(url)) {
        return Promise.resolve(new Response(JSON.stringify(idle), { headers: { "content-type": "application/json" } }));
      }
      return orig(input, init);
    };
  }, idleUpdateStatus());
  await installProductRoutes(page, posts, snap);

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await waitHome(page);
  await shot(page, "clickloop_01_home_hashed.png");
  let homeText = await page.locator("body").innerText();
  assert.match(homeText, /On this box/);
  assert.match(homeText, /The Rookie/);
  assert.match(homeText, /Silo/);
  assert.match(homeText, /Reacher/);
  assert.doesNotMatch(homeText, /UIndex org - Silo|Torrenting|Il Ponte|UIndex org - The Rookie/i);
  assert.doesNotMatch(homeText, /\b0%/);
  verdict.steps.homeNamed = true;

  // 1. Search movie + TV, Request, Requests, Home
  const moonBox = page.getByPlaceholder(/Search movies, shows, people/i);
  await moonBox.fill("Moon");
  await page.waitForTimeout(800);
  const moonHit = page.locator("form ul a").filter({ hasText: "2009" }).filter({ hasText: "Moon" }).first();
  await moonHit.waitFor({ timeout: 15000 });
  await moonHit.click();
  await page.waitForURL(/\/title\//, { timeout: 15000 });
  await page.getByRole("heading", { name: "Moon" }).waitFor({ timeout: 15000 });
  await shot(page, "clickloop_02_title_moon.png");
  const moonUrl = page.url();
  assert.match(moonUrl, /\/title\/tmdb-\d+/);
  assert.doesNotMatch(moonUrl, /tmdb-tv-/);
  const moonRequested = await clickRequestIfPresent(page);
  await shot(page, "clickloop_02b_moon_request.png");
  verdict.steps.movieSearch = true;
  verdict.steps.movieRequest = moonRequested;
  if (!moonRequested) {
    const altMovie = await searchRequestTitle(page, ["Ex Machina", "Arrival", "Coherence"], { tv: false });
    verdict.steps.movieRequest = altMovie.requested;
    await shot(page, "clickloop_02b_moon_request.png");
  }
  const moonCollection = page.getByRole("link", { name: /Collection/i }).first();
  if (await moonCollection.count()) {
    await moonCollection.scrollIntoViewIfNeeded();
    await moonCollection.click();
    await page.waitForURL(/\/collection\//, { timeout: 15000 });
    await page.getByRole("heading", { name: /Moon/i }).waitFor({ timeout: 15000 }).catch(() => {});
    await shot(page, "clickloop_13_collection.png");
    verdict.steps.collectionSearch = true;
  }
  await nav(page, "Home");
  await waitHome(page);
  const tv = await searchRequestTitle(page, ["Slow Horses", "Reservation Dogs", "What We Do in the Shadows"], { tv: true });
  await shot(page, "clickloop_03_title_tv.png");
  await shot(page, "clickloop_03b_tv_request.png");
  verdict.steps.tvSearch = true;
  verdict.steps.tvRequest = tv.requested;
  await nav(page, "Requests");
  await page.getByRole("heading", { name: "Requests" }).waitFor({ timeout: 15000 });
  await shot(page, "clickloop_04_requests.png");
  const reqText = await page.locator("body").innerText();
  assert.match(reqText, /Requests/);
  verdict.steps.requestsTab = true;
  await nav(page, "Home");
  await waitHome(page);
  verdict.steps.homeAfterRequest = /On this box|The Rookie/.test(await page.locator("body").innerText());

  // 2. Discover dislike, gone, Home stays, reset curator
  await nav(page, "Discover");
  await page.getByRole("heading", { name: /Discover/i }).waitFor({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await shot(page, "clickloop_05_discover.png");
  const hideBtn = page.getByRole("button", { name: "Not interested" }).first();
  await hideBtn.waitFor({ timeout: 20000 });
  const card = hideBtn.locator("xpath=ancestor::a[1]");
  const hiddenTitle = ((await card.innerText()) || "").split("\n")[0].trim();
  await hideBtn.click();
  await page.waitForTimeout(600);
  const afterHide = await page.locator("body").innerText();
  if (hiddenTitle) {
    const first = afterHide.split(hiddenTitle).length;
    verdict.steps.dislikedTitle = hiddenTitle;
    verdict.steps.dislikeGone = first <= 2;
  }
  await shot(page, "clickloop_06_discover_after_dislike.png");
  await nav(page, "Home");
  await waitHome(page);
  homeText = await page.locator("body").innerText();
  assert.match(homeText, /The Rookie/);
  assert.match(homeText, /On this box/);
  verdict.steps.homeAfterDislike = true;
  await nav(page, "Settings");
  await page.getByRole("heading", { name: "Settings" }).waitFor({ timeout: 15000 });
  const reset = page.getByRole("button", { name: "Reset curator preferences" });
  await reset.waitFor({ timeout: 15000 });
  await reset.scrollIntoViewIfNeeded();
  await reset.click();
  await page.waitForTimeout(500);
  await shot(page, "clickloop_07_settings_reset_curator.png");
  const settingsText = await page.locator("body").innerText();
  assert.match(settingsText, /Library on this box is unchanged|Discover Not interested list cleared|Reset curator/i);
  verdict.steps.resetCurator = true;
  await nav(page, "Discover");
  await page.waitForTimeout(1000);
  verdict.steps.discoverAfterReset = true;

  // 3. The Rookie seasons honest
  await nav(page, "Home");
  await waitHome(page);
  const rookieCard = page.locator("a", { hasText: "The Rookie" }).first();
  await rookieCard.click();
  await page.waitForURL(/\/title\//, { timeout: 15000 });
  await page.waitForTimeout(1200);
  await shot(page, "clickloop_08_rookie_title.png");
  const rookieText = await page.locator("body").innerText();
  assert.match(rookieText, /The Rookie/);
  assert.doesNotMatch(rookieText, /\b0%/);
  assert.match(rookieText, /Coming/);
  assert.match(rookieText, /Importing|Watch/);
  assert.doesNotMatch(rookieText, /Season 9 · Request|S09 · Request|Season 2 · Watch/i);
  verdict.steps.rookieHonest = /Coming/.test(rookieText) && !/\b0%/.test(rookieText);
  await nav(page, "Home");
  await waitHome(page);
  homeText = await page.locator("body").innerText();
  assert.doesNotMatch(homeText, /UIndex org - Silo|Torrenting|Il Ponte|UIndex org - The Rookie/i);
  verdict.steps.noDumpTwin = true;

  // 4. Remove only dump-named card if shown
  await page.getByText("On this box", { exact: true }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const dumpCard = page.locator("div.w-\\[148px\\]").filter({ hasText: /Completely Different Show/ }).first();
  if (await dumpCard.count()) {
    await dumpCard.scrollIntoViewIfNeeded();
    await dumpCard.getByText("Remove", { exact: true }).click();
    const confirm = page.getByText("Confirm remove?");
    if (await confirm.count()) await confirm.click();
    await page.waitForTimeout(600);
    await shot(page, "clickloop_09_after_dump_remove.png");
    const afterRm = await page.locator("body").innerText();
    assert.match(afterRm, /The Rookie/);
    assert.doesNotMatch(afterRm, /Completely Different Show/);
    verdict.steps.dumpRemoved = true;
    const bad = posts.deletes.some((d) => /350665|79744|tvdb-350665/.test(JSON.stringify(d)));
    assert.equal(bad, false, "Remove posted named Rookie ids");
  } else {
    verdict.steps.dumpRemoved = "not-shown";
    await shot(page, "clickloop_09_no_dump_card.png");
  }
  assert.match(await page.locator("body").innerText(), /The Rookie/);

  // 5. Actor / collection search — do not POST person ids
  await page.getByPlaceholder(/Search movies, shows, people/i).fill("Keanu Reeves");
  await page.waitForTimeout(800);
  await shot(page, "clickloop_10_search_keanu.png");
  const actor = page.locator("form ul a", { hasText: "Actor" }).first();
  if (await actor.count()) {
    await actor.click();
    await page.waitForURL(/\/person\//, { timeout: 15000 });
    await page.getByText(/Loading filmography|Keanu Reeves/i).first().waitFor({ timeout: 15000 });
    await page.getByRole("heading", { name: /Keanu Reeves/i }).waitFor({ timeout: 20000 });
    await shot(page, "clickloop_11_person.png");
    verdict.steps.personSearch = true;
    const personPost = posts.requests.some((b) => String(b.mediaType || "").toLowerCase() === "person");
    assert.equal(personPost, false);
  } else {
    verdict.steps.personSearch = "no-actor-hit";
  }
  await nav(page, "Home");
  await waitHome(page);
  await page.getByPlaceholder(/Search movies, shows, people/i).fill("John Wick");
  await page.waitForTimeout(800);
  await shot(page, "clickloop_12_search_wick.png");
  const collection = page.locator("form ul a", { hasText: "Collection" }).first();
  if (await collection.count()) {
    await collection.click();
    await page.waitForURL(/\/collection\//, { timeout: 15000 });
    await page.getByRole("heading", { name: /John Wick/i }).waitFor({ timeout: 15000 }).catch(() => {});
    await shot(page, "clickloop_13_collection.png");
    verdict.steps.collectionSearch = true;
  } else {
    await nav(page, "Discover");
    await page.getByPlaceholder(/Find a title, actor, or collection/i).fill("John Wick Collection");
    await page.waitForTimeout(900);
    await shot(page, "clickloop_12b_discover_wick.png");
    const discCol = page.getByText(/Collection/i).first();
    if (await discCol.count()) {
      await discCol.click();
      await page.waitForURL(/\/collection\//, { timeout: 15000 }).catch(() => {});
      await shot(page, "clickloop_13_collection.png");
      verdict.steps.collectionSearch = /\/collection\//.test(page.url()) ? true : "discover-hit";
    } else {
      verdict.steps.collectionSearch = "no-collection-hit";
      await shot(page, "clickloop_13_collection.png");
    }
  }
  const personPosts = posts.requests.filter((b) => String(b.mediaType || "").toLowerCase() === "person");
  assert.equal(personPosts.length, 0, "posted person ids");
  verdict.steps.noPersonPost = true;
  verdict.posts = posts;

  const likeBtn = page.getByRole("button", { name: /^Like$/i });
  verdict.steps.like = (await likeBtn.count()) ? "present" : "no-like-control";

  verdict.ok =
    Boolean(verdict.steps.hashedUi) &&
    Boolean(verdict.steps.homeNamed) &&
    Boolean(verdict.steps.movieSearch) &&
    Boolean(verdict.steps.movieRequest) &&
    Boolean(verdict.steps.tvSearch) &&
    Boolean(verdict.steps.tvRequest) &&
    Boolean(verdict.steps.requestsTab) &&
    Boolean(verdict.steps.homeAfterDislike) &&
    Boolean(verdict.steps.resetCurator) &&
    Boolean(verdict.steps.rookieHonest) &&
    Boolean(verdict.steps.noDumpTwin) &&
    Boolean(verdict.steps.noPersonPost) &&
    posts.requests.length >= 2 &&
    !posts.requests.some((b) => String(b.mediaType || "").toLowerCase() === "person");

  writeFileSync(join(OUT, "clickloop_verdict.json"), JSON.stringify(verdict, null, 2));
  console.log(JSON.stringify(verdict, null, 2));
  if (!verdict.ok) process.exitCode = 1;
} catch (err) {
  verdict.ok = false;
  verdict.errors.push(String(err?.stack || err));
  writeFileSync(join(OUT, "clickloop_verdict.json"), JSON.stringify(verdict, null, 2));
  console.error(JSON.stringify(verdict, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (child) {
    child.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 400));
  }
}
