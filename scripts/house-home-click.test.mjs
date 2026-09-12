import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { homeShelfRows } from "./reelos-library.mjs";
import { seasonChipLabel } from "./reelos-seerr.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function houseFixture() {
  const named = (id, name, year, ids, jf, disk, extra = {}) => ({
    id,
    kind: "tv",
    title: name,
    year,
    poster: "",
    ids,
    jellyfinId: jf,
    onDiskSeasons: disk,
    ...extra,
  });
  const dump = (jf, name, path, seasons) => ({
    id: `jf-${jf}`,
    kind: "tv",
    title: name,
    year: 0,
    poster: "",
    ids: [`jf-${jf}`],
    jellyfinId: jf,
    path,
    importingSeasons: seasons,
    fromDump: true,
  });
  const silo = named("tvdb-403245", "Silo", 2023, ["tvdb-403245", "tmdb-tv-125988"], "silo", [1, 2, 3], {
    unreleasedSeasons: [4],
  });
  const reacher = named("tvdb-366924", "Reacher", 2022, ["tvdb-366924", "tmdb-tv-108978"], "reach", [1], {
    importingSeasons: [2],
  });
  const rookie = named("tvdb-350665", "The Rookie", 2018, ["tvdb-350665", "tmdb-tv-79744"], "rook", [1], {
    importingSeasons: [2, 3, 4, 6, 7, 8],
    unreleasedSeasons: [9],
  });
  const shelf = [
    dump("orgsilo", "org-Silo", "/symlinks/sonarr/www.UIndex.org - Silo", [1]),
    reacher,
    dump("ponte", "Reacher II Ponte", "/symlinks/sonarr/Reacher II Ponte", [2]),
    dump("torrsilo", "www Torrenting com - Silo", "/symlinks/sonarr/www.Torrenting.com - Silo", [2]),
    dump("orgrook", "www UIndex org - The Rookie", "/symlinks/sonarr/www.UIndex.org - The.Rookie.S02E14", [2]),
    silo,
    rookie,
  ];
  const chipsFor = (t, seasons) =>
    seasons.map((n) => {
      const onDisk = (t.onDiskSeasons || []).includes(n);
      const importing = (t.importingSeasons || []).includes(n);
      const unreleased = (t.unreleasedSeasons || []).includes(n);
      return `S${n} · ${seasonChipLabel({ onDisk, importing, unreleased })}`;
    });
  return {
    homeTitles: homeShelfRows(shelf).map((t) => t.title),
    rookieYear: 2018,
    homeRequests: [],
    pages: {
      Silo: chipsFor(silo, [1, 2, 3, 4]),
      Reacher: chipsFor(reacher, [1, 2]),
      "The Rookie": chipsFor(rookie, [1, 2, 3, 5, 8, 9]),
    },
  };
}

function fixtureHtml(data) {
  const cards = data.homeTitles
    .map((name) => `<button class="card" data-title="${name}" data-open="${name}">${name}</button>`)
    .join("");
  const pages = Object.entries(data.pages)
    .map(
      ([name, chips]) =>
        `<section class="title" hidden data-page="${name}">
          <h1>${name}</h1>
          <div class="chips">${chips.map((c) => `<button class="chip">${c}</button>`).join("")}</div>
          <button data-back>Home</button>
        </section>`,
    )
    .join("");
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>House Home</title>
<style>
body { font-family: sans-serif; background: #0b0d10; color: #f3f4f6; margin: 0; }
h2, h1 { font-size: 18px; }
.row { display: flex; gap: 12px; padding: 16px; }
.card, .chip, [data-back] { min-height: 44px; padding: 8px 12px; border-radius: 12px; background: #181c24; color: #f3f4f6; border: 0; }
.req { padding: 16px; }
</style></head>
<body>
<main data-home>
  <h2>On this box</h2>
  <div class="row" data-shelf>${cards}</div>
  <h2>Your requests</h2>
  <div class="req" data-home-req>${data.homeRequests.length ? data.homeRequests.join(" · ") : "Nothing in flight"}</div>
  <p class="year" data-rookie-year>The Rookie ${data.rookieYear}</p>
</main>
${pages}
<script>
document.querySelectorAll("[data-open]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelector("[data-home]").hidden = true;
    document.querySelectorAll("[data-page]").forEach((p) => { p.hidden = p.getAttribute("data-page") !== btn.getAttribute("data-open"); });
  });
});
document.querySelectorAll("[data-back]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-page]").forEach((p) => { p.hidden = true; });
    document.querySelector("[data-home]").hidden = false;
  });
});
</script>
</body></html>`;
}

function missingChromiumMessage(err) {
  const msg = String(err?.message || err);
  if (/Executable doesn't exist/i.test(msg) || /playwright install/i.test(msg)) {
    return "Chromium is not installed; run npx playwright install";
  }
  return null;
}

test("house screenshot hashed-UI clicks: named titles, Importing, Coming, no 0%", async (t) => {
  const data = houseFixture();
  assert.deepEqual([...data.homeTitles].sort(), ["Reacher", "Silo", "The Rookie"]);
  assert.equal(data.homeRequests.length, 0);
  assert.ok(data.pages.Silo.includes("S4 · Coming"));
  assert.ok(data.pages["The Rookie"].includes("S1 · Watch"));
  assert.ok(data.pages["The Rookie"].includes("S2 · Importing"));
  assert.ok(data.pages["The Rookie"].includes("S5 · Request"));
  assert.ok(data.pages["The Rookie"].includes("S8 · Importing"));
  assert.ok(data.pages["The Rookie"].includes("S9 · Coming"));
  assert.equal(seasonChipLabel({ importing: true }), "Importing");

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    t.skip("playwright package is not installed");
    return;
  }
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  } catch (err) {
    const skip = missingChromiumMessage(err);
    if (skip) {
      t.skip(skip);
      return;
    }
    throw err;
  }
  const outDir = "/tmp/cursor/artifacts";
  mkdirSync(outDir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.setContent(fixtureHtml(data), { waitUntil: "load" });
  const homeText = await page.locator("[data-shelf]").innerText();
  assert.match(homeText, /Silo/);
  assert.match(homeText, /Reacher/);
  assert.match(homeText, /The Rookie/);
  assert.doesNotMatch(homeText, /UIndex|Torrenting|Ponte/i);
  const reqText = await page.locator("[data-home-req]").innerText();
  assert.doesNotMatch(reqText, /The Rookie|0%/);
  const yearText = await page.locator("[data-rookie-year]").innerText();
  assert.match(yearText, /2018/);

  for (const name of ["Silo", "Reacher", "The Rookie"]) {
    await page.locator(`[data-open="${name}"]`).click();
    const chips = await page.locator(`[data-page="${name}"] .chips`).innerText();
    if (name === "Silo") {
      assert.match(chips, /Coming/);
      assert.doesNotMatch(chips, /S4 · Watch|S4 · Request/);
    }
    if (name === "The Rookie") {
      assert.match(chips, /Importing/);
      assert.match(chips, /Coming/);
      assert.match(chips, /S5 · Request/);
      assert.doesNotMatch(chips, /S2 · Watch|S5 · Importing/);
    }
    await page.screenshot({ path: join(outDir, `house-home-${name.toLowerCase().replace(/\s+/g, "-")}.png`) });
    await page.locator(`[data-page="${name}"] [data-back]`).click();
  }
  await page.screenshot({ path: join(outDir, "house-home-on-this-box.png") });
  writeFileSync(
    join(outDir, "house-home-click-verdict.json"),
    JSON.stringify({ ok: true, homeTitles: data.homeTitles, rookiePct: data.rookiePct, pages: data.pages }, null, 2),
  );
  await browser.close();
});

function isImportingCopy(reason) {
  return /on disk, importing|files linked|waiting for.*import/i.test(String(reason || ""));
}

function goldHit(gold, id) {
  return gold.byId[id] || gold.named.rookie;
}

function goldImportingSeasons(gold, hit) {
  const keys = new Set([hit.id, ...(hit.ids || [])]);
  const fromReqs = gold.requests
    .filter((r) => keys.has(r.titleId) && isImportingCopy(r.reason))
    .map((r) => Number(r.season))
    .filter((n) => Number.isFinite(n) && n > 0);
  return [...new Set([...(hit.importingSeasons || []), ...fromReqs])];
}

function houseGoldTitles() {
  const base = {
    kind: "tv",
    rating: 8,
    genres: ["Drama"],
    overview: "",
    maxQuality: "1080p",
    popularity: 1,
    poster: "",
  };
  const silo = {
    ...base,
    id: "tvdb-403245",
    title: "Silo",
    year: 2023,
    ids: ["tvdb-403245", "tmdb-tv-125988"],
    jellyfinId: "silo",
    onDiskSeasons: [1, 2, 3],
    unreleasedSeasons: [4],
    seasonList: [1, 2, 3, 4],
    seasonFacts: [{ season: 4, episodeCount: 0, airDate: "2027-01-01", unreleased: true }],
  };
  const reacher = {
    ...base,
    id: "tvdb-366924",
    title: "Reacher",
    year: 2022,
    ids: ["tvdb-366924", "tmdb-tv-108978"],
    jellyfinId: "reach",
    onDiskSeasons: [1],
    importingSeasons: [2],
    seasonList: [1, 2],
  };
  const rookie = {
    ...base,
    id: "tvdb-350665",
    title: "The Rookie",
    year: 2018,
    ids: ["tvdb-350665", "tmdb-tv-79744", "tmdb-79744"],
    jellyfinId: "rook",
    onDiskSeasons: [1],
    importingSeasons: [2],
    unreleasedSeasons: [9],
    seasonList: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    seasonFacts: [{ season: 9, episodeCount: 0, airDate: "2027-01-01", unreleased: true }],
  };
  const dump = (jf, title, path, seasons) => ({
    ...base,
    id: `jf-${jf}`,
    title,
    year: 0,
    ids: [`jf-${jf}`],
    jellyfinId: jf,
    path,
    importingSeasons: seasons,
    fromDump: true,
  });
  const named = [silo, reacher, rookie];
  const titles = [
    dump("orgsilo", "org-Silo", "/symlinks/sonarr/www.UIndex.org - Silo", [1]),
    dump("ponte", "Reacher II Ponte", "/symlinks/sonarr/Reacher II Ponte", [2]),
    dump("torrsilo", "www Torrenting com - Silo", "/symlinks/sonarr/www.Torrenting.com - Silo", [2]),
    dump("orgrook", "www UIndex org - The Rookie", "/symlinks/sonarr/www.UIndex.org - The.Rookie.S02E14", [2]),
    ...named,
  ];
  const now = Date.now();
  const rookReq = (season, reason) => ({
    id: `req-rook-s${season}`,
    titleId: "tmdb-tv-79744",
    title: "The Rookie",
    status: "downloading",
    progress: 0,
    reason,
    season,
    createdAt: now,
    updatedAt: now,
    requester: "Austin",
  });
  const requests = [
    ...[2, 3, 4, 6, 7, 8].map((n) => rookReq(n, "Files linked — waiting for Sonarr import")),
    rookReq(5, "Searching — no file yet"),
  ];
  const byId = {};
  for (const t of named) {
    byId[t.id] = t;
    for (const id of t.ids) byId[id] = t;
  }
  return { titles, requests, named: { silo, reacher, rookie }, byId };
}

async function waitForBox(port, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = spawnSync(
      "curl",
      ["-sS", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "2", `http://127.0.0.1:${port}/`],
      { encoding: "utf8" },
    );
    if ((r.stdout || "").trim() === "200") return;
    await new Promise((ok) => setTimeout(ok, 250));
  }
  throw new Error(`hashed door on :${port} never returned 200`);
}

test("hashed gold UI clicks house screenshot: named titles win, Importing ≠ Watch, no 0%", { timeout: 90000 }, async (t) => {
  const data = houseFixture();
  const gold = houseGoldTitles();
  const port = "18056";
  const child = spawn("node", ["scripts/with-app-env.mjs", "node", "scripts/reelos-box.mjs"], {
    cwd: root,
    env: { ...process.env, PORT: port, HOST: "127.0.0.1", NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout?.on("data", (d) => {
    out += d;
  });
  child.stderr?.on("data", (d) => {
    out += d;
  });
  let browser;
  try {
    await waitForBox(port);
    let chromium;
    try {
      ({ chromium } = await import("playwright"));
    } catch {
      t.skip("playwright package is not installed");
      return;
    }
    try {
      browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    } catch (err) {
      const skip = missingChromiumMessage(err);
      if (skip) {
        t.skip(skip);
        return;
      }
      throw err;
    }
    const outDir = "/tmp/cursor/artifacts";
    mkdirSync(outDir, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const ready = {
      provisioned: true,
      betaChannel: false,
      jellyfin: { state: "green" },
      answers: {
        source: "local-vpn",
        frontend: "jellyfin",
        intent: { movies: true, tv: true, anime: false, uhd: false, kids: false, music: false },
        quality: "hybrid",
        access: "lan",
      },
      titles: gold.titles,
      continueWatching: [],
      requests: gold.requests,
      update: { running: false, local: "1.2.50.56" },
      libraryCatchup: {
        status: "done",
        message: "",
        folder: 0,
        total: 0,
        skipped: 0,
        timeouts: 0,
        needsImport: false,
        splashLock: false,
      },
    };
    await page.addInitScript(() => {
      try {
        localStorage.clear();
      } catch {
        /* private mode */
      }
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      if (path === "/api/ready") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ready) });
        return;
      }
      if (path === "/api/settings") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ betaChannel: false }) });
        return;
      }
      if (path === "/api/library") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ titles: gold.titles, continueWatching: [], error: null }),
        });
        return;
      }
      if (path === "/api/request") {
        const id = url.searchParams.get("id");
        if (id) {
          const hit = goldHit(gold, id);
          const importing = goldImportingSeasons(gold, hit);
          const seasonN = Number(url.searchParams.get("season"));
          const thisImporting = Number.isFinite(seasonN) && importing.includes(seasonN);
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              status: thisImporting ? "downloading" : "available",
              reason: thisImporting ? "On disk, importing" : undefined,
              seasonList: hit.seasonList || [],
              onDiskSeasons: (hit.onDiskSeasons || []).filter((n) => !importing.includes(n)),
              importingSeasons: importing,
              unreleasedSeasons: hit.unreleasedSeasons || [],
            }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            requests: gold.requests,
            titles: [gold.named.silo, gold.named.reacher, gold.named.rookie],
          }),
        });
        return;
      }
      if (path === "/api/lookup") {
        const id = url.searchParams.get("id") || "";
        const hit = gold.byId[id];
        const titled = hit
          ? {
              ...hit,
              importingSeasons: goldImportingSeasons(gold, hit),
            }
          : null;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(titled ? { titles: [titled] } : { titles: [], error: "Seerr did not find that title" }),
        });
        return;
      }
      if (path === "/api/similar") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ titles: [] }) });
        return;
      }
      if (path === "/api/episodes") {
        const season = Number(url.searchParams.get("season") || "0");
        const id = url.searchParams.get("id") || "";
        const hit = goldHit(gold, id);
        const importing = goldImportingSeasons(gold, hit);
        if ((hit.unreleasedSeasons || []).includes(season)) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ episodes: [], unreleased: true }),
          });
          return;
        }
        if (importing.includes(season)) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              episodes: [{ episodeNumber: 1, title: "Impact", status: "importing", label: "On disk, importing" }],
            }),
          });
          return;
        }
        if ((hit.onDiskSeasons || []).includes(season)) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              episodes: [{ episodeNumber: 1, title: "Pilot", status: "in-library", label: "In library" }],
            }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            episodes: [{ episodeNumber: 1, title: "The Roundup", status: "requested", label: "Requested" }],
          }),
        });
        return;
      }
      if (path === "/api/discover") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ movies: [], tv: [] }),
        });
        return;
      }
      if (path === "/api/curator") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ hidden: [] }) });
        return;
      }
      if (path === "/api/update/status" || path === "/api/update/check") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ running: false, local: "1.2.50.56", target: null, log: "" }),
        });
        return;
      }
      if (path === "/api/box" || path === "/api/ping") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, provisioned: true }) });
        return;
      }
      if (url.hostname.includes("googleapis") || url.hostname.includes("gstatic")) {
        await route.fulfill({ status: 200, body: "" });
        return;
      }
      await route.continue();
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    try {
      await page.getByText("On this box", { exact: true }).waitFor({ timeout: 20000 });
    } catch (err) {
      const body = await page.locator("body").innerText();
      throw new Error(`hashed Home never painted On this box\n${body.slice(0, 1200)}\n${out.slice(-800)}\n${err}`);
    }
    const home = await page.locator("body").innerText();
    assert.match(home, /Silo/);
    assert.match(home, /Reacher/);
    assert.match(home, /The Rookie/);
    assert.doesNotMatch(home, /UIndex|Torrenting|org-Silo|Ponte|0%/i);
    assert.doesNotMatch(home, /Who is watching|Trakt/i);
    await page.screenshot({ path: join(outDir, "hashed-home-on-this-box.png") });

    for (const name of ["Silo", "Reacher", "The Rookie"]) {
      await page.locator('a[href*="/title/"]').filter({ hasText: name }).first().click();
      await page.getByRole("heading", { name, exact: true }).waitFor({ timeout: 15000 });
      const body = await page.locator("body").innerText();
      assert.doesNotMatch(body, /0%/);
      if (name === "Silo") {
        assert.match(body, /Season 4 · Coming/);
        assert.doesNotMatch(body, /Season 4 · Watch|Season 4 · Request/);
      }
      if (name === "Reacher") {
        assert.match(body, /Season 1 · Watch/);
        assert.match(body, /Season 2 · Importing/);
        assert.doesNotMatch(body, /Season 2 · Watch/);
      }
      if (name === "The Rookie") {
        assert.match(body, /Season 1 · Watch/);
        assert.match(body, /Season 2 · Importing/);
        assert.match(body, /Season 3 · Importing/);
        assert.match(body, /Season 5 · Request/);
        assert.match(body, /Season 8 · Importing/);
        assert.match(body, /Season 9 · Coming/);
        assert.doesNotMatch(body, /Season 2 · Watch/);
        assert.doesNotMatch(body, /Season 5 · Importing/);
        await page.getByRole("button", { name: /Season 2 · Importing/ }).click();
        await page.getByText("On disk, importing — Sonarr has not taken the files yet.").waitFor({ timeout: 8000 });
        const s2 = await page.locator("body").innerText();
        assert.match(s2, /Impact/);
        assert.doesNotMatch(s2, /Request this season/);
        await page.getByRole("button", { name: /Season 9 · Coming/ }).click();
        await page.getByText(/Announced — not released yet/).waitFor({ timeout: 8000 });
        const s9 = await page.locator("body").innerText();
        assert.doesNotMatch(s9, /Impact/);
        assert.doesNotMatch(s9, /Request this season/);
        await page.getByRole("button", { name: /Season 5 · Request/ }).click();
        await page.getByRole("button", { name: /Request this season/ }).waitFor({ timeout: 8000 });
      }
      await page.screenshot({ path: join(outDir, `hashed-home-${name.toLowerCase().replace(/\s+/g, "-")}.png`) });
      await page.goBack({ waitUntil: "domcontentloaded" });
      await page.getByText("On this box", { exact: true }).waitFor({ timeout: 15000 });
    }

    await page.getByRole("link", { name: "Library", exact: true }).click();
    await page.getByRole("heading", { name: "Library", exact: true }).waitFor({ timeout: 15000 });
    const library = await page.locator("body").innerText();
    assert.match(library, /The Rookie/);
    assert.doesNotMatch(library, /UIndex|Torrenting|org-Silo|Ponte/i);
    await page.screenshot({ path: join(outDir, "hashed-library-named-rookie.png") });

    await page.getByRole("link", { name: "Requests", exact: true }).click();
    await page.getByRole("heading", { name: "Requests", exact: true }).waitFor({ timeout: 15000 });
    const reqs = await page.locator("body").innerText();
    assert.match(reqs, /The Rookie/);
    assert.match(reqs, /S02 Importing|S2 Importing|Season 2 · Importing/);
    assert.match(reqs, /S05 Request|S5 Request/);
    assert.doesNotMatch(reqs, /0%/);
    await page.screenshot({ path: join(outDir, "hashed-requests-rookie-importing.png") });

    await page.getByRole("link", { name: "Discover", exact: true }).click();
    await page.getByRole("heading", { name: "Discover", exact: true }).waitFor({ timeout: 15000 });
    const discover = await page.locator("body").innerText();
    assert.match(discover, /Movies/);
    assert.match(discover, /Shows/);
    assert.doesNotMatch(discover, /UIndex|Torrenting/i);
    await page.screenshot({ path: join(outDir, "hashed-discover-no-rookie.png") });
    writeFileSync(
      join(outDir, "hashed-home-click-verdict.json"),
      JSON.stringify({ ok: true, homeTitles: data.homeTitles, pages: data.pages, hashed: true }, null, 2),
    );
  } finally {
    if (browser) await browser.close().catch(() => {});
    child.kill("SIGTERM");
    await new Promise((ok) => {
      const timer = setTimeout(ok, 2000);
      child.on("exit", () => {
        clearTimeout(timer);
        ok();
      });
    });
  }
});
