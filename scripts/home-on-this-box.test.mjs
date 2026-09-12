import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  collapseDumpTwins,
  dumpMatchesNamed,
  homeShelfRows,
  humanTitleFromSceneName,
  stripIndexerPrefix,
} from "./reelos-library.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("Home On this box cards wrap, placeholder empty art, and hide dump twins", () => {
  const card = read("src/components/title-card.tsx");
  const poster = read("src/components/poster.tsx");
  const home = read("src/components/home-view.tsx");
  const library = read("src/components/library-view.tsx");
  const shelf = read("src/lib/shelf.ts");
  const lib = read("scripts/reelos-library.mjs");
  assert.match(home, /On this box/);
  assert.match(home, /homeShelfRows/);
  assert.match(home, /w-full max-w-full/);
  assert.doesNotMatch(home, /className="w-auto"/);
  assert.match(card, /line-clamp-2 break-words/);
  assert.match(card, /Number\(title\.year\) > 0/);
  assert.match(card, /overflow-hidden/);
  assert.match(poster, /posterInitial/);
  assert.match(poster, /w-full min-h-0 min-w-0 max-w-full overflow-hidden/);
  assert.match(library, /homeShelfRows/);
  assert.match(shelf, /isDumpTwinCard/);
  assert.match(shelf, /dumpMatchesNamed/);
  assert.match(lib, /stripIndexerPrefix/);
  assert.match(lib, /collapseDumpTwins/);
  assert.match(read("src/components/wizard.tsx"), /const TOTAL = 7/);
  assert.match(read("src/lib/store.ts"), /betaChannel: false/);
});

const LIVE_DUMPS = [
  { id: "jf-org-silo", title: "org-Silo", year: 0, poster: "" },
  { id: "jf-uindex-rookie", title: "www UIndex org    -    The Rookie", year: 0, poster: "" },
  { id: "jf-uindex-silo", title: "www UIndex org    -    Silo", year: 0, poster: "" },
  { id: "jf-torrenting-silo", title: "www Torrenting com - Silo", year: 0, poster: "" },
  { id: "jf-reacher-ponte", title: "Reacher Il Ponte", year: 2026, poster: "" },
  { id: "jf-reacher-plum", title: "S04E06 Reacher Lo Sfortunato Plum", year: 2026, poster: "" },
];
const LIVE_NAMED = [
  { id: "tvdb-350665", title: "The Rookie", year: 2018, poster: "/p.jpg", ids: ["tvdb-350665", "tmdb-tv-79744"] },
  { id: "tvdb-403245", title: "Silo", year: 2023, poster: "/p.jpg", ids: ["tvdb-403245", "tmdb-tv-125988"] },
  { id: "tvdb-366924", title: "Reacher", year: 2022, poster: "/p.jpg", ids: ["tvdb-366924", "tmdb-tv-108978"] },
  { id: "tvdb-269586", title: "Brooklyn Nine-Nine", year: 2013, poster: "/p.jpg", ids: ["tvdb-269586"] },
];

test("live HP dump twin fixture collapses to named cards only", () => {
  assert.equal(stripIndexerPrefix("www UIndex org    -    The Rookie"), "The Rookie");
  assert.equal(humanTitleFromSceneName("www.UIndex.org    -    The.Rookie.S02E14.Casualties.1080p.mkv").title, "The Rookie");
  assert.equal(dumpMatchesNamed(LIVE_DUMPS[0], LIVE_NAMED[0]), true);
  const shown = homeShelfRows([...LIVE_DUMPS, ...LIVE_NAMED].map((t) => ({ kind: "tv", ...t })));
  assert.deepEqual(
    shown.map((t) => t.title).sort(),
    ["Brooklyn Nine-Nine", "Reacher", "Silo", "The Rookie"],
  );
  assert.equal(collapseDumpTwins([...LIVE_DUMPS, ...LIVE_NAMED].map((t) => ({ kind: "tv", ...t }))).length, 4);
});

function fixtureHtml(titles) {
  const cards = titles
    .map((t) => {
      const year = Number(t.year) > 0 ? `<p class="year">${t.year}</p>` : `<p class="year"></p>`;
      const art = t.poster
        ? `<div class="poster"><img src="${t.poster}" alt=""></div>`
        : `<div class="poster placeholder"><span>${String(t.title).replace(/^[^A-Za-z0-9]+/, "").charAt(0)}</span></div>`;
      return `<article class="card" data-title="${t.title.replace(/"/g, "")}">${art}<p class="name">${t.title}</p>${year}</article>`;
    })
    .join("");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
html, body { margin: 0; background: #0b0d10; color: #f3f4f6; font-family: sans-serif; }
header { position: relative; z-index: 20; display: flex; align-items: center; gap: 12px; padding: 16px; background: #0b0d10; }
header a.watch { margin-left: auto; flex-shrink: 0; color: #d4a017; text-decoration: none; padding: 8px 12px; }
h2 { font-size: 18px; margin: 24px 16px 12px; }
.row { display: flex; gap: 16px; overflow-x: auto; padding: 0 16px 16px; }
.card { width: 148px; min-width: 148px; max-width: 148px; overflow: hidden; }
.poster { position: relative; width: 100%; aspect-ratio: 2 / 3; overflow: hidden; background: #1e232c; border-radius: 12px; }
.poster img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.placeholder { display: flex; align-items: center; justify-content: center; background: linear-gradient(to bottom right, #1e232c, #0b0d10); color: #9aa3b2; font-size: 28px; }
.name { margin: 8px 0 0; font-size: 14px; font-weight: 500; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.year { margin: 0; font-size: 12px; color: #9aa3b2; min-height: 1em; }
</style>
</head>
<body>
<header data-chrome="header"><span>ReelOS</span><a class="watch" data-chrome="watch" href="#">Watch</a></header>
<section>
  <h2>On this box</h2>
  <div class="row" data-row="on-this-box">${cards}</div>
</section>
</body>
</html>`;
}

function rectsOverlap(a, b, pad = 1) {
  return !(a.right <= b.left + pad || a.left >= b.right - pad || a.bottom <= b.top + pad || a.top >= b.bottom - pad);
}

function missingChromiumMessage(err) {
  const msg = String(err?.message || err);
  if (/Executable doesn't exist/i.test(msg) || /playwright install/i.test(msg)) {
    return "Chromium is not installed; run npx playwright install";
  }
  return null;
}

test("cloud-click Home On this box dump twin fixture: named cards, no overflow onto Watch", async (t) => {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    t.skip("playwright package is not installed");
    return;
  }
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
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
  const svg =
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="100%" height="100%" fill="#1b4d7a"/><text x="50%" y="52%" text-anchor="middle" fill="#fff" font-size="42" font-family="sans-serif">ART</text></svg>`,
    );
  const named = LIVE_NAMED.map((t) => ({ ...t, poster: svg }));
  const before = [...LIVE_DUMPS, ...named];
  const after = homeShelfRows(before.map((t) => ({ kind: "tv", rating: 0, genres: [], overview: "", maxQuality: "4k", popularity: 50, ...t })));
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent(fixtureHtml(before), { waitUntil: "load" });
    await page.click("text=On this box");
    await page.screenshot({ path: join(outDir, "home-on-this-box-before-dumps.png"), fullPage: false });
    const beforeTitles = await page.$$eval("[data-title]", (els) => els.map((e) => e.getAttribute("data-title")));
    assert.ok(beforeTitles.some((n) => /UIndex/i.test(n)), "fixture must include the UIndex Rookie twin");
    await page.setContent(fixtureHtml(after), { waitUntil: "load" });
    await page.click("text=On this box");
    await page.locator(".row").evaluate((el) => {
      el.scrollLeft = 80;
    });
    await page.screenshot({ path: join(outDir, "home-on-this-box-after-collapse.png"), fullPage: false });
    const measured = await page.evaluate(() => {
      const box = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { sel, left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      };
      return {
        titles: [...document.querySelectorAll("[data-title]")].map((e) => e.getAttribute("data-title")),
        placeholders: document.querySelectorAll(".placeholder").length,
        yearZeros: [...document.querySelectorAll(".year")].filter((el) => el.textContent.trim() === "0").length,
        cards: [...document.querySelectorAll(".card")].map((el) => {
          const r = el.getBoundingClientRect();
          const name = el.querySelector(".name")?.getBoundingClientRect();
          return {
            title: el.getAttribute("data-title"),
            width: r.width,
            nameOverflow: name ? name.right - r.right : 0,
          };
        }),
        watch: box("[data-chrome=watch]"),
        header: box("[data-chrome=header]"),
      };
    });
    assert.deepEqual(measured.titles.sort(), ["Brooklyn Nine-Nine", "Reacher", "Silo", "The Rookie"]);
    assert.equal(measured.yearZeros, 0);
    assert.ok(measured.watch?.width > 20, "Watch chrome missing");
    for (const card of measured.cards) {
      assert.ok(card.width <= 149, `${card.title} card wider than 148px: ${card.width}`);
      assert.ok(card.nameOverflow < 2, `${card.title} name overflows card by ${card.nameOverflow}px`);
      if (measured.watch) {
        const cardBox = await page.locator(`[data-title="${card.title}"]`).evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        });
        assert.equal(
          rectsOverlap(cardBox, measured.watch),
          false,
          `${card.title} overlaps Watch`,
        );
      }
    }
    writeFileSync(
      join(outDir, "home-on-this-box-verdict.json"),
      JSON.stringify({ ok: true, titles: measured.titles, yearZeros: measured.yearZeros }, null, 2),
    );
    await page.close();
  } finally {
    await browser.close();
  }
});
