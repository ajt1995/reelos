import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { homeShelfRows } from "./reelos-library.mjs";
import { seasonChipLabel } from "./reelos-seerr.mjs";

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
    importingSeasons: [2],
    unreleasedSeasons: [9],
  });
  const shelf = [
    dump("orgsilo", "www UIndex org - Silo", "/symlinks/sonarr/www.UIndex.org - Silo", [1]),
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
    rookiePct: "Importing",
    pages: {
      Silo: chipsFor(silo, [1, 2, 3, 4]),
      Reacher: chipsFor(reacher, [1, 2]),
      "The Rookie": chipsFor(rookie, [1, 2, 9]),
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
  <p class="req" data-rookie-req>The Rookie · ${data.rookiePct}</p>
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
  assert.equal(data.rookiePct, "Importing");
  assert.ok(data.pages.Silo.includes("S4 · Coming"));
  assert.ok(data.pages["The Rookie"].includes("S2 · Importing"));
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
  const reqText = await page.locator("[data-rookie-req]").innerText();
  assert.match(reqText, /Importing/);
  assert.doesNotMatch(reqText, /0%/);

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
      assert.doesNotMatch(chips, /S2 · Watch/);
    }
    await page.screenshot({ path: join(outDir, `house-home-${name.toLowerCase().replace(/\s+/g, "-")}.png`) });
    await page.locator("[data-back]").first().click();
  }
  await page.screenshot({ path: join(outDir, "house-home-on-this-box.png") });
  writeFileSync(
    join(outDir, "house-home-click-verdict.json"),
    JSON.stringify({ ok: true, homeTitles: data.homeTitles, rookiePct: data.rookiePct, pages: data.pages }, null, 2),
  );
  await browser.close();
});
