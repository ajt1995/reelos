/**
 * ReelOS Kids Content Engine
 * Walled garden sandbox for kids profiles and adult shelf isolation.
 * Includes "🎁 Gift from Mom/Dad" family gifting engine.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const DEFAULT_DIR = process.env.REELOS_STATE || (process.platform === "win32" ? path.join(process.cwd(), ".reelos-state") : "/var/lib/reelos");
const KIDS_STORE_PATH = path.join(DEFAULT_DIR, "kids-titles.json");

export function readKidsStore(filePath = KIDS_STORE_PATH) {
  try {
    if (existsSync(filePath)) {
      const parsed = JSON.parse(readFileSync(filePath, "utf8"));
      if (Array.isArray(parsed)) {
        return { approvedIds: parsed, gifted: {} };
      }
      return {
        approvedIds: Array.isArray(parsed?.approvedIds) ? parsed.approvedIds : [],
        gifted: typeof parsed?.gifted === "object" && parsed?.gifted !== null ? parsed.gifted : {}
      };
    }
  } catch {
    /* ignore read error */
  }
  return { approvedIds: [], gifted: {} };
}

export function writeKidsStore(store, filePath = KIDS_STORE_PATH) {
  try {
    const dir = path.dirname(filePath);
    if (dir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o755 });
    }
    const payload = {
      approvedIds: [...new Set(store.approvedIds || [])],
      gifted: store.gifted || {}
    };
    writeFileSync(filePath, JSON.stringify(payload, null, 2) + "\n");
    return true;
  } catch {
    return false;
  }
}

export function readKidsApprovedIds(filePath = KIDS_STORE_PATH) {
  return readKidsStore(filePath).approvedIds;
}

export function writeKidsApprovedIds(ids, filePath = KIDS_STORE_PATH) {
  const current = readKidsStore(filePath);
  current.approvedIds = ids;
  return writeKidsStore(current, filePath);
}

export function giftTitleForKids(titleId, giftedBy = "Mom & Dad", filePath = KIDS_STORE_PATH) {
  if (!titleId) return false;
  const store = readKidsStore(filePath);
  const idStr = String(titleId).trim();
  if (!store.approvedIds.includes(idStr)) {
    store.approvedIds.push(idStr);
  }
  store.gifted[idStr] = {
    giftedBy: giftedBy || "Mom & Dad",
    timestamp: Date.now()
  };
  return writeKidsStore(store, filePath);
}

export function ungiftTitleForKids(titleId, filePath = KIDS_STORE_PATH) {
  if (!titleId) return false;
  const store = readKidsStore(filePath);
  const idStr = String(titleId).trim();
  if (store.gifted[idStr]) {
    delete store.gifted[idStr];
    return writeKidsStore(store, filePath);
  }
  return true;
}

export function getGiftedKidsTitles(filePath = KIDS_STORE_PATH) {
  return readKidsStore(filePath).gifted;
}

export function isTitleGifted(titleId, filePath = KIDS_STORE_PATH) {
  if (!titleId) return null;
  const gifted = getGiftedKidsTitles(filePath);
  return gifted[String(titleId).trim()] || null;
}

export const KID_GENRES = new Set([
  "animation",
  "family",
  "children",
  "kids",
]);

export function isTitleKidContent(title, approvedIds = []) {
  if (!title) return false;
  const id = String(title.id || title.jellyfinId || "");
  if (approvedIds.includes(id)) return true;

  const genres = Array.isArray(title.genres) ? title.genres : [];
  for (const g of genres) {
    if (KID_GENRES.has(String(g).toLowerCase().trim())) {
      return true;
    }
  }
  return false;
}

/**
 * For adult profiles with hideKidsContent: true,
 * removes kids content unless explicitly added to the adult's own watchlist.
 */
export function filterShelfForAdults(shelf = [], approvedIds = [], adultWatchlist = []) {
  const watchlistSet = new Set(adultWatchlist || []);
  return shelf.filter((title) => {
    const id = String(title.id || title.jellyfinId || "");
    if (watchlistSet.has(id)) return true; // Adult explicitly added it, keep it
    return !isTitleKidContent(title, approvedIds);
  });
}

/**
 * For kids profile: strictly limit to kid-approved or family titles.
 */
export function filterShelfForKids(shelf = [], approvedIds = []) {
  return shelf.filter((title) => isTitleKidContent(title, approvedIds));
}
