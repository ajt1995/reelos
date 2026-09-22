/**
 * ReelOS Smart Watchlist Sync
 * Automatically parses Letterboxd RSS & Trakt Atom feeds and requests missing titles.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

export const WATCHLIST_CONFIG_PATH = "/var/lib/reelos/watchlist.json";

export function defaultWatchlistConfig() {
  return {
    enabled: false,
    service: "letterboxd",
    username: "",
    feedUrl: "",
    lastSync: null,
    syncedCount: 0,
    lastAdded: [],
    lastError: null,
  };
}

export function readWatchlistConfig(filePath = WATCHLIST_CONFIG_PATH) {
  try {
    if (existsSync(filePath)) {
      return { ...defaultWatchlistConfig(), ...JSON.parse(readFileSync(filePath, "utf8")) };
    }
  } catch {
    /* fallback to default on read/parse error */
  }
  return defaultWatchlistConfig();
}

export function writeWatchlistConfig(cfg, filePath = WATCHLIST_CONFIG_PATH) {
  try {
    const dir = filePath.substring(0, filePath.lastIndexOf("/"));
    if (dir) mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(filePath, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o644 });
    return true;
  } catch {
    return false;
  }
}

export function buildWatchlistUrl(service, username) {
  const user = String(username || "").trim();
  if (!user) return "";
  if (service === "letterboxd") {
    return `https://letterboxd.com/${encodeURIComponent(user)}/watchlist/rss/`;
  }
  if (service === "trakt") {
    return `https://trakt.tv/users/${encodeURIComponent(user)}/watchlist.atom`;
  }
  return user.startsWith("http://") || user.startsWith("https://") ? user : "";
}

/**
 * Parses title and optional 4-digit release year from a title string.
 * Example: "Inception (2010)" -> { title: "Inception", year: 2010 }
 */
export function parseTitleAndYear(rawTitle) {
  const cleaned = String(rawTitle || "").trim();
  const m = cleaned.match(/^(.*?)\s*\((\d{4})\)\s*$/);
  if (m) {
    return { title: m[1].trim(), year: Number.parseInt(m[2], 10) };
  }
  return { title: cleaned, year: null };
}

/**
 * Parses XML feed content from Letterboxd RSS or Trakt Atom.
 */
export function parseWatchlistXml(xmlText) {
  if (!xmlText || typeof xmlText !== "string") return [];
  const items = [];

  // Match RSS <item> blocks
  const rssItemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = rssItemRegex.exec(xmlText)) !== null) {
    const block = match[1];

    const titleMatch = block.match(/<(?:letterboxd:filmTitle|title)>([\s\S]*?)<\/(?:letterboxd:filmTitle|title)>/i);
    const rawTitle = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/gi, "$1").trim() : "";

    const yearMatch = block.match(/<letterboxd:filmYear>(\d{4})<\/letterboxd:filmYear>/i);
    let year = yearMatch ? Number.parseInt(yearMatch[1], 10) : null;

    const parsed = parseTitleAndYear(rawTitle);
    const title = parsed.title;
    if (!year && parsed.year) year = parsed.year;

    const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
    const link = linkMatch ? linkMatch[1].trim() : "";

    const tmdbMatch =
      block.match(/<tmdb:movieId>(\d+)<\/tmdb:movieId>/i) ||
      block.match(/themoviedb\.org\/movie\/(\d+)/i) ||
      block.match(/tmdb\.org\/movie\/(\d+)/i);
    const tmdbId = tmdbMatch ? tmdbMatch[1] : null;

    if (title) {
      items.push({
        title,
        year,
        link,
        tmdbId,
        mediaType: "movie",
      });
    }
  }

  // If no RSS items found, check for Atom <entry> blocks (e.g. Trakt)
  if (items.length === 0) {
    const atomEntryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    while ((match = atomEntryRegex.exec(xmlText)) !== null) {
      const block = match[1];

      const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const rawTitle = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/gi, "$1").trim() : "";

      const parsed = parseTitleAndYear(rawTitle);

      const linkMatch = block.match(/<link[^>]*href=["']([^"']+)["']/i);
      const link = linkMatch ? linkMatch[1].trim() : "";

      const isTv = link.includes("/shows/") || /season|episode/i.test(rawTitle);

      if (parsed.title) {
        items.push({
          title: parsed.title,
          year: parsed.year,
          link,
          tmdbId: null,
          mediaType: isTv ? "tv" : "movie",
        });
      }
    }
  }

  return items;
}

/**
 * Filter watchlist items against already available library titles or active requests.
 */
export function filterMissingWatchlistItems(items, existingTitles = [], existingRequests = []) {
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  const existingSet = new Set();

  for (const t of existingTitles) {
    if (t.tmdb) existingSet.add(`tmdb-${t.tmdb}`);
    if (t.title) existingSet.add(norm(t.title));
  }

  for (const r of existingRequests) {
    if (r.tmdbId || r.tmdb) existingSet.add(`tmdb-${r.tmdbId || r.tmdb}`);
    if (r.title) existingSet.add(norm(r.title));
  }

  return items.filter((item) => {
    if (item.tmdbId && existingSet.has(`tmdb-${item.tmdbId}`)) return false;
    if (item.title && existingSet.has(norm(item.title))) return false;
    return true;
  });
}

/**
 * Executes a sync pass against the configured watchlist feed.
 */
export async function syncWatchlistFeed({
  config,
  fetchFeed = async (url) => {
    const r = await fetch(url, { headers: { "User-Agent": "ReelOS/1.0" }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`Feed HTTP ${r.status}`);
    return r.text();
  },
  searchSeerr = async () => null,
  requestSeerr = async () => ({ ok: true }),
  getLibraryTitles = () => [],
  getExistingRequests = () => [],
} = {}) {
  const cfg = config || readWatchlistConfig();
  const url = cfg.feedUrl || buildWatchlistUrl(cfg.service, cfg.username);
  if (!url) {
    return { ok: false, error: "No feed URL or username configured" };
  }

  let xml = "";
  try {
    xml = await fetchFeed(url);
  } catch (err) {
    const msg = String(err?.message || err);
    cfg.lastError = msg;
    writeWatchlistConfig(cfg);
    return { ok: false, error: msg };
  }

  const parsedItems = parseWatchlistXml(xml);
  if (!parsedItems.length) {
    cfg.lastSync = new Date().toISOString();
    cfg.lastError = null;
    writeWatchlistConfig(cfg);
    return { ok: true, synced: 0, items: [] };
  }

  const missing = filterMissingWatchlistItems(parsedItems, getLibraryTitles(), getExistingRequests());
  const added = [];

  for (const item of missing.slice(0, 20)) {
    let tmdbId = item.tmdbId;
    if (!tmdbId && searchSeerr) {
      try {
        const hit = await searchSeerr(item.title, item.year, item.mediaType);
        if (hit?.tmdbId || hit?.id) tmdbId = String(hit.tmdbId || hit.id);
      } catch {
        /* proceed to next if lookup fails */
      }
    }

    if (tmdbId) {
      try {
        const res = await requestSeerr({
          tmdbId,
          mediaType: item.mediaType || "movie",
          title: item.title,
        });
        if (res?.ok) {
          added.push(`${item.title}${item.year ? ` (${item.year})` : ""}`);
        }
      } catch {
        /* skip on request failure */
      }
    }
  }

  cfg.lastSync = new Date().toISOString();
  cfg.syncedCount = (cfg.syncedCount || 0) + added.length;
  cfg.lastAdded = added;
  cfg.lastError = null;
  writeWatchlistConfig(cfg);

  return { ok: true, synced: added.length, added, totalInFeed: parsedItems.length };
}
