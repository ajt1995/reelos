import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const view = readFileSync(join(root, "src/components/title-view-live.tsx"), "utf8");
const css = readFileSync(join(root, "src/styles.css"), "utf8");
const poster = readFileSync(join(root, "src/components/poster.tsx"), "utf8");
const accordion = readFileSync(join(root, "src/components/season-episode-accordion.tsx"), "utf8");
const shell = readFileSync(join(root, "src/components/shell.tsx"), "utf8");

const layoutCss = css.slice(
  css.indexOf("/* title-page-layout */"),
  css.indexOf("/* /title-page-layout */") + "/* /title-page-layout */".length,
);

test("title page lookupKey is a useState so Retry cannot ReferenceError", () => {
  assert.match(view, /const \[lookupKey, setLookupKey\] = useState\(0\)/);
  assert.match(view, /\[id, rememberTitles, lookupKey\]/);
  assert.match(view, /onRetrySeasons=\{\(\) => setLookupKey\(\(n\) => n \+ 1\)\}/);
});

test("title page art is clipped and never uses intrinsic-width auto", () => {
  assert.match(view, /className="title-page pb-28 md:pb-16"/);
  assert.match(view, /className="title-hero"/);
  assert.match(view, /className="title-body"/);
  assert.match(view, /className="title-poster rounded-2xl"/);
  assert.match(view, /className="title-copy"/);
  assert.doesNotMatch(view, /md:w-auto/);
  assert.doesNotMatch(view, /-mt-40/);
  assert.doesNotMatch(view, /-mt-48/);
  assert.doesNotMatch(view, /z-10 mx-auto/);
  assert.match(poster, /min-w-0 max-w-full overflow-hidden/);
  assert.match(shell, /relative z-20 hidden w-\[220px\].*bg-background md:flex/);
  assert.match(shell, /overflow-x-clip/);
  assert.match(shell, /relative z-20 flex items-center gap-3 bg-background px-4 pt-4 md:hidden/);
  assert.match(layoutCss, /overflow-x:\s*clip/);
  assert.match(layoutCss, /max-width:\s*180px/);
  assert.match(layoutCss, /max-width:\s*200px/);
  assert.match(layoutCss, /max-width:\s*112px/);
  assert.match(layoutCss, /pointer-events:\s*none/);
  assert.match(layoutCss, /minmax\(0,\s*200px\)/);
  assert.match(layoutCss, /@media \(max-height: 500px\)/);
  assert.match(accordion, /title-season-chips/);
  assert.match(accordion, /shrink-0/);
  assert.match(layoutCss, /flex-wrap:\s*nowrap/);
  assert.match(layoutCss, /overflow-x:\s*auto/);
});

function rectsOverlap(a, b, pad = 1) {
  return !(a.right <= b.left + pad || a.left >= b.right - pad || a.bottom <= b.top + pad || a.top >= b.bottom - pad);
}

function fixtureHtml() {
  const svg =
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="3000">
        <rect width="100%" height="100%" fill="#1b4d7a"/>
        <text x="50%" y="48%" text-anchor="middle" fill="#fff" font-size="180" font-family="sans-serif">POSTER</text>
      </svg>`,
    );
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
:root { --color-background: #0b0d10; --color-foreground: #f3f4f6; --color-muted: #9aa3b2; --color-gold: #d4a017; --color-gold-fg: #1a1406; --color-success: #3ddc97; --color-card: #181c24; }
html, body { margin: 0; background: var(--color-background); color: var(--color-foreground); font-family: sans-serif; }
.shell { min-height: 100dvh; background: var(--color-background); }
.shell-row { display: flex; }
aside.chrome-nav { position: relative; z-index: 20; display: none; width: 220px; flex-shrink: 0; border-right: 1px solid rgb(255 255 255 / 0.08); background: var(--color-background); }
header.chrome-header { position: relative; z-index: 20; display: flex; align-items: center; gap: 12px; background: var(--color-background); padding: 16px; }
nav.chrome-bottom { position: fixed; inset: auto 0 0 0; z-index: 30; display: flex; border-top: 1px solid rgb(255 255 255 / 0.08); background: rgb(11 13 16 / 0.9); }
nav.chrome-bottom a { flex: 1; height: 64px; display: flex; align-items: center; justify-content: center; color: #6b7380; text-decoration: none; font-size: 11px; }
.main { flex: 1; min-width: 0; overflow-x: clip; padding-bottom: 4.5rem; }
.title-poster { aspect-ratio: 2 / 3; overflow: hidden; background: #1e232c; }
.title-poster img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.title-poster { position: relative; }
h1 { font-size: 2.25rem; margin: 8px 0; }
.actions span, .actions a { display: inline-flex; align-items: center; height: 36px; margin: 4px 8px 0 0; padding: 0 12px; border-radius: 999px; background: var(--color-card); color: var(--color-muted); text-decoration: none; }
.title-season-chips button { display: inline-flex; align-items: center; height: 44px; padding: 0 12px; border-radius: 999px; border: 0; background: var(--color-card); color: var(--color-muted); }
.actions .watch { height: 48px; border-radius: 16px; background: var(--color-gold); color: var(--color-gold-fg); }
.actions .library { height: 48px; border-radius: 16px; background: rgb(61 220 151 / 0.12); color: var(--color-success); }
${layoutCss}
@media (min-width: 768px) {
  aside.chrome-nav { display: flex; flex-direction: column; }
  header.chrome-header, nav.chrome-bottom { display: none; }
  .main { padding-bottom: 0; }
}
</style>
</head>
<body>
<div class="shell">
  <div class="shell-row">
    <aside class="chrome-nav" data-chrome="nav">
      <p>Requests</p><p>Library</p><p>Activity</p><p>Settings</p>
      <a data-chrome="watch-nav" href="#">Watch</a>
    </aside>
    <div class="main">
      <header class="chrome-header" data-chrome="header">
        <span>ReelOS</span>
        <a data-chrome="watch-header" href="#">Watch</a>
      </header>
      <div class="title-page" data-page="tv">
        <div class="title-hero" aria-hidden="true">
          <img class="title-hero-art" src="${svg}" alt="">
          <div class="title-hero-fade"></div>
        </div>
        <div class="title-body">
          <div class="title-poster rounded-2xl" data-art>
            <img src="${svg}" alt="">
          </div>
          <div class="title-copy">
            <p>TV</p>
            <h1 data-chrome="title">Rick and Morty</h1>
            <p>2013 · 8.7</p>
            <div class="title-season-chips" data-chrome="seasons">
              <button>Season 1 · Watch</button><button>Season 2 · Request</button><button>Season 3 · Coming</button><button>Season 4 · Coming</button>
            </div>
            <div class="actions">
              <a class="watch" data-chrome="watch" href="#">Watch</a>
              <span class="library" data-chrome="library">In library</span>
              <a data-chrome="remove" href="#">Remove from this box</a>
            </div>
          </div>
        </div>
      </div>
      <div class="title-page" data-page="movie">
        <div class="title-hero" aria-hidden="true">
          <img class="title-hero-art" src="${svg}" alt="">
          <div class="title-hero-fade"></div>
        </div>
        <div class="title-body">
          <div class="title-poster" data-art-movie>
            <img src="${svg}" alt="">
          </div>
          <div class="title-copy">
            <p>Movie</p>
            <h1 data-chrome="movie-title">Moon</h1>
            <div class="actions">
              <a class="watch" data-chrome="movie-watch" href="#">Watch</a>
              <span class="library" data-chrome="movie-library">In library</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <nav class="chrome-bottom" data-chrome="bottom-nav">
    <a href="#">Home</a><a href="#">Discover</a><a href="#">Requests</a><a href="#">Library</a>
  </nav>
</div>
</body>
</html>`;
}

const VIEWPORTS = [
  { name: "phone-portrait", width: 390, height: 844, maxArt: 180 },
  { name: "phone-landscape", width: 844, height: 390, maxArt: 112 },
  { name: "tablet", width: 1024, height: 768, maxArt: 200 },
];

function missingChromiumMessage(err) {
  const msg = String(err?.message || err);
  if (/Executable doesn't exist/i.test(msg) || /playwright install/i.test(msg)) {
    return "Chromium is not installed; run npx playwright install";
  }
  return null;
}

test("title artwork stays in its lane on phone, landscape, and tablet", async (t) => {
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
  try {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      await page.setContent(fixtureHtml(), { waitUntil: "load" });
      const shot = join(outDir, `title-art-after-${vp.name}.png`);
      await page.screenshot({ path: shot, fullPage: false });
      const measured = await page.evaluate(() => {
        const box = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { sel, left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
        };
        return {
          art: box("[data-page=tv] [data-art]"),
          movieArt: box("[data-page=movie] [data-art-movie]"),
          nav: box("[data-chrome=bottom-nav]"),
          chips: Array.from(document.querySelectorAll("[data-page=tv] [data-chrome=seasons] button")).map((el) => {
            const r = el.getBoundingClientRect();
            return { text: el.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
          }),
          chrome: [
            box("[data-chrome=nav]"),
            box("[data-chrome=header]"),
            box("[data-chrome=bottom-nav]"),
            box("[data-chrome=watch-nav]"),
            box("[data-chrome=watch-header]"),
            box("[data-page=tv] [data-chrome=title]"),
            box("[data-page=tv] [data-chrome=seasons]"),
            box("[data-page=tv] [data-chrome=watch]"),
            box("[data-page=tv] [data-chrome=library]"),
            box("[data-page=tv] [data-chrome=remove]"),
            box("[data-page=movie] [data-chrome=movie-title]"),
            box("[data-page=movie] [data-chrome=movie-watch]"),
            box("[data-page=movie] [data-chrome=movie-library]"),
          ].filter((r) => r && r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < window.innerHeight),
        };
      });
      assert.ok(measured.art?.width > 40, `${vp.name}: tv poster missing`);
      assert.ok(measured.art.width <= vp.maxArt + 1, `${vp.name}: tv poster ${measured.art.width}px wider than ${vp.maxArt}`);
      assert.ok(measured.movieArt?.width > 40, `${vp.name}: movie poster missing`);
      assert.ok(
        measured.movieArt.width <= vp.maxArt + 1,
        `${vp.name}: movie poster ${measured.movieArt.width}px wider than ${vp.maxArt}`,
      );
      for (const chrome of measured.chrome) {
        assert.equal(
          rectsOverlap(measured.art, chrome),
          false,
          `${vp.name}: tv poster overlaps ${chrome.sel} art=${JSON.stringify(measured.art)} chrome=${JSON.stringify(chrome)}`,
        );
      }
      if (vp.name === "phone-portrait") {
        const coming = measured.chips.filter((c) => /Coming/.test(c.text || ""));
        assert.equal(coming.length, 2, `${vp.name}: expected S3/S4 Coming chips`);
        for (const chip of measured.chips) {
          assert.equal(
            rectsOverlap(chip, measured.nav),
            false,
            `${vp.name}: season chip under tab bar chip=${JSON.stringify(chip)} nav=${JSON.stringify(measured.nav)}`,
          );
        }
        const tops = new Set(measured.chips.map((c) => Math.round(c.top)));
        assert.equal(tops.size, 1, `${vp.name}: season chips must stay on one row, not wrap under the tab bar`);
      }
      await page.close();
    }
    writeFileSync(
      join(outDir, "title-art-layout-verdict.json"),
      JSON.stringify({ ok: true, viewports: VIEWPORTS.map((v) => v.name) }, null, 2),
    );
  } finally {
    await browser.close();
  }
});
