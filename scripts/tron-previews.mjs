/**
 * Phone-viewport captures of the Tron chrome for design review.
 * Mocks box APIs so the provisioned shell paints without a house appliance.
 *
 *   node scripts/tron-previews.mjs
 */
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs/tron-previews");
const ART = "/opt/cursor/artifacts/screenshots";
const ORIGIN = process.env.TRON_PREVIEW_ORIGIN || "http://127.0.0.1:8080";

const TITLES = [
  t("night-harbor", "movie", "Night Harbor", 2024),
  t("ember-season", "movie", "Ember Season", 2025),
  t("glass-orchard", "movie", "Glass Orchard", 2024),
  t("iron-parish", "movie", "Iron Parish", 2023),
  t("paper-moons", "movie", "Paper Moons", 2022),
  t("maple-pilot", "movie", "Maple Pilot", 2024),
  t("station-line", "tv", "Station Line", 2024),
  t("drift-protocol", "movie", "Drift Protocol", 2025),
  t("hollow-broadcast", "tv", "Hollow Broadcast", 2023),
  t("last-signal", "movie", "The Last Signal", 2023),
  t("copper-tide", "movie", "Copper Tide", 2024),
  t("winter-circuit", "tv", "Winter Circuit", 2025),
];

function t(id, kind, title, year) {
  return {
    id,
    kind,
    title,
    year,
    rating: 8,
    genres: ["Drama"],
    overview: "",
    poster: `/posters/${id}.jpg`,
    maxQuality: "4k",
    popularity: 80,
  };
}

const BOOKS = [
  {
    id: "gutenberg-84",
    title: "Frankenstein",
    author: "Mary Wollstonecraft Shelley",
    source: "Project Gutenberg",
    year: 1818,
    format: "EPUB",
    downloadUrl: "https://www.gutenberg.org/ebooks/84.epub.images",
  },
  {
    id: "se-dracula",
    title: "Dracula",
    author: "Bram Stoker",
    source: "Standard Ebooks",
    year: 1897,
    format: "EPUB",
    downloadUrl: "https://standardebooks.org/ebooks/bram-stoker/dracula/downloads/dracula.epub",
  },
  {
    id: "ia-pride",
    title: "Pride and Prejudice",
    author: "Jane Austen",
    source: "Internet Archive",
    year: 1813,
    format: "EPUB",
    downloadUrl: "https://archive.org/download/prideandprejudice/pride.epub",
  },
];

function persistBlob() {
  const now = Date.now();
  const req = (titleId, status, extra = {}) => ({
    id: `req-${titleId}`,
    titleId,
    status,
    progress: status === "available" ? 100 : status === "downloading" ? 62 : 0,
    createdAt: now - 86_400_000,
    updatedAt: now,
    requester: "Ada",
    ...extra,
  });
  return {
    state: {
      phase: "running",
      wizardStep: 7,
      answers: {
        storageMode: "both",
        selectedDisks: ["sda", "sdb"],
        formatDisks: [],
        source: "real-debrid",
        apiKey: "RD-LAB-KEY-7F3A",
        vpnProvider: "mullvad",
        intent: {
          movies: true,
          tv: true,
          anime: true,
          uhd: true,
          kids: true,
          music: true,
          books: true,
        },
        quality: "hybrid",
        frontend: "jellyfin",
        plexClaim: "",
        adminName: "Ada",
        adminPassword: "household",
        access: "lan",
        tunnelToken: "",
      },
      build: [],
      buildLogOpen: false,
      provisioned: true,
      requests: [
        req("night-harbor", "available", { via: "cache" }),
        req("station-line", "downloading", { via: "uncached", progress: 62, season: 2 }),
        req("drift-protocol", "waiting"),
      ],
      library: ["night-harbor", "ember-season", "iron-parish"],
      shelf: TITLES.slice(0, 6),
      watchProgress: { "night-harbor": 0.42, "ember-season": 0.18, "iron-parish": 0.71 },
      activity: [],
      users: [{ id: "u-ada", name: "Ada", role: "admin" }],
      settings: {
        hideAdvanced: false,
        autoApprove: true,
        notifyAvailable: true,
        notifyFailed: true,
        autoUpdate: true,
        stackImages: false,
        connectDone: true,
      },
      adapter: {
        kind: "decypharr",
        provider: "real-debrid",
        status: "healthy",
        account: "lab",
        mount: "/mnt/debrid",
        pingMs: 41,
        cacheHits: 3,
        transfers: 1,
        lastPing: now,
        daysLeft: 38,
      },
      indexers: [],
      remoteTitles: TITLES,
    },
    version: 0,
  };
}

function posterSvg(id) {
  const title = TITLES.find((x) => x.id === id)?.title || id;
  const hue = [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="336" height="504" viewBox="0 0 336 504">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue}, 70%, 18%)"/>
      <stop offset="1" stop-color="#03060c"/>
    </linearGradient>
  </defs>
  <rect width="336" height="504" fill="url(#g)"/>
  <rect x="12" y="12" width="312" height="480" fill="none" stroke="#00e5ff" stroke-opacity="0.28"/>
  <text x="24" y="460" fill="#e8f4ff" font-family="Share Tech Mono, ui-monospace, monospace" font-size="22">${escapeXml(title)}</text>
</svg>`;
}

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

async function mockApis(page) {
  await page.route("**/api/box**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        provisioned: true,
        ipv4: "192.168.1.40",
        watch: "http://192.168.1.40:8096",
        seerr: "http://192.168.1.40:5055",
        jellyfin: { state: "green", detail: "Live" },
        frontend: "jellyfin",
        access: "lan",
        adminName: "Ada",
        adminPassword: "household",
        answers: persistBlob().state.answers,
      }),
    }),
  );
  await page.route("**/api/library**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ titles: TITLES.slice(0, 8), error: null }),
    }),
  );
  await page.route("**/api/discover**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        trending: TITLES.slice(0, 6),
        movies: TITLES.filter((x) => x.kind === "movie").slice(0, 6),
        tv: TITLES.filter((x) => x.kind === "tv"),
        error: null,
      }),
    }),
  );
  await page.route("**/api/lookup**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ titles: TITLES.slice(0, 4), error: null }),
    }),
  );
  await page.route("**/api/books**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ results: BOOKS, unavailable: [] }),
    }),
  );
  await page.route("**/api/request**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ requests: persistBlob().state.requests }),
    }),
  );
  await page.route("**/posters/**", (route) => {
    const id = decodeURIComponent(route.request().url().split("/").pop() || "").replace(/\.jpg$/, "");
    route.fulfill({ contentType: "image/svg+xml", body: posterSvg(id) });
  });
}

async function shot(page, name) {
  mkdirSync(OUT, { recursive: true });
  if (existsSync(dirname(ART))) mkdirSync(ART, { recursive: true });
  const dest = join(OUT, name);
  await page.screenshot({ path: dest, type: "png" });
  if (existsSync(ART)) copyFileSync(dest, join(ART, name));
  console.log("wrote", dest);
}

async function main() {
  const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  await page.addInitScript((blob) => {
    localStorage.setItem("reelos-v4", JSON.stringify(blob));
  }, persistBlob());
  await mockApis(page);

  await page.goto(`${ORIGIN}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await shot(page, "home.png");

  await page.goto(`${ORIGIN}/discover`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await shot(page, "discover.png");

  const search = page.getByLabel("Search movies, shows, and books");
  await search.fill("dracula");
  await page.waitForTimeout(900);
  await shot(page, "discover-typeahead.png");

  await page.goto(`${ORIGIN}/requests`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await shot(page, "requests.png");

  await page.goto(`${ORIGIN}/books?q=Dracula`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await shot(page, "books.png");

  await page.goto(`${ORIGIN}/settings`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.locator("main").getByRole("button", { name: /How to watch/ }).click();
  await page.getByText("How to watch / read", { exact: true }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await shot(page, "settings.png");

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
