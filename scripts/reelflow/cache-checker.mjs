/**
 * ReelFlow TorBox / Debrid Pre-Flight Cache Verifier
 * Batched cache checking with exponential backoff, jitter, and in-memory TTL caching.
 */

import fs from "node:fs";
import path from "node:path";
import { torBoxRateLimiter } from "../services/debrid-service.mjs";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL
const memoryCache = new Map(); // hash -> { cached: boolean, data: Object, expiresAt: number }

/**
 * Retrieves the TorBox API key from answers.json or process environment.
 */
export function getDebridApiKey() {
  const provider = getDebridProvider();
  if (provider === "real-debrid" && (process.env.REAL_DEBRID_API_KEY || process.env.RD_API_KEY)) {
    return String(process.env.REAL_DEBRID_API_KEY || process.env.RD_API_KEY).trim();
  }
  if (provider === "torbox" && process.env.TORBOX_API_KEY) return process.env.TORBOX_API_KEY.trim();
  const stateDir = process.env.REELOS_STATE || (process.platform === "win32" ? path.join(process.cwd(), ".reelos-state") : "/var/lib/reelos");
  const answersPath = path.join(stateDir, "answers.json");
  try {
    if (fs.existsSync(answersPath)) {
      const data = JSON.parse(fs.readFileSync(answersPath, "utf8"));
      if (data && data.apiKey) return String(data.apiKey).trim();
    }
  } catch {
    /* ignore fallback */
  }
  return "";
}

export function getDebridProvider() {
  const stateDir = process.env.REELOS_STATE || (process.platform === "win32" ? path.join(process.cwd(), ".reelos-state") : "/var/lib/reelos");
  try {
    const answersPath = path.join(stateDir, "answers.json");
    if (fs.existsSync(answersPath)) {
      const source = String(JSON.parse(fs.readFileSync(answersPath, "utf8"))?.source || "").toLowerCase();
      if (source === "realdebrid" || source === "real-debrid") return "real-debrid";
    }
  } catch {}
  return "torbox";
}

/**
 * Checks whether an array of infohashes is instantly cached on TorBox.
 * @param {string[]} hashes - Array of infohashes
 * @param {string} [apiKey] - Optional TorBox API key
 * @param {Object} [options]
 * @param {typeof fetch} [options.fetchImpl] - Fetch implementation (for testing)
 * @param {number} [options.maxRetries=3] - Maximum retry attempts on 429
 * @returns {Promise<Record<string, { cached: boolean, name?: string, size?: number, files?: Array<{ name: string, size: number }> }>>}
 */
export async function checkCachedTorrents(hashes = [], apiKey = "", options = {}) {
  const key = (apiKey || getDebridApiKey()).trim();
  const provider = options.provider || getDebridProvider();
  const fetchImpl = options.fetchImpl || fetch;
  const maxRetries = options.maxRetries || 3;

  const results = {};
  if (!hashes || !hashes.length) return results;

  // Clean and deduplicate hashes
  const cleanHashes = [...new Set(hashes.map((h) => String(h).trim().toLowerCase()).filter((h) => /^[a-f0-9]{40}$/i.test(h)))];
  const now = Date.now();
  const needed = [];

  // Check in-memory cache first
  for (const h of cleanHashes) {
    const entry = memoryCache.get(h);
    if (entry && entry.expiresAt > now) {
      results[h] = entry.data;
    } else {
      needed.push(h);
    }
  }

  if (needed.length === 0) {
    return results;
  }

  // If no API key is available, report unknown/uncached
  if (!key) {
    for (const h of needed) {
      results[h] = { cached: false };
    }
    return results;
  }

  // Batch in chunks of 20
  const BATCH_SIZE = 20;
  for (let i = 0; i < needed.length; i += BATCH_SIZE) {
    const batch = needed.slice(i, i + BATCH_SIZE);
    let attempts = 0;
    let delay = 250;

    while (attempts < maxRetries) {
      attempts++;
      try {
        const isRealDebrid = provider === "real-debrid";
        const url = isRealDebrid
          ? `https://api.real-debrid.com/rest/1.0/torrents/instantAvailability/${batch.join("/")}`
          : `https://api.torbox.app/v1/api/torrents/checkcached?hash=${batch.join(",")}&format=object&list_files=true`;
        const request = async () => {
          const response = await fetchImpl(url, {
            headers: {
              Authorization: `Bearer ${key}`,
              Accept: "application/json",
              "User-Agent": "ReelOS/2.0 (ReelFlow)",
            },
            signal: AbortSignal.timeout(6000),
          });
          if (!response.ok) throw new Error(`${provider} ${response.status}`);
          return response.json();
        };
        const json = isRealDebrid
          ? await request()
          : (await torBoxRateLimiter.executeRequest(
              `checkcached:${batch.slice().sort().join(",")}`,
              request,
              { ttlMs: CACHE_TTL_MS },
            )).data;

        const data = json && json.data ? json.data : json || {};

        for (const h of batch) {
          const item = data[h];
          const rdVariants = isRealDebrid && item && typeof item === "object"
            ? Object.values(item).flatMap((value) => Array.isArray(value) ? value : [])
            : [];
          const isCached = isRealDebrid
            ? rdVariants.length > 0
            : Boolean(item && (item === true || (typeof item === "object" && item.name)));
          const entryData = {
            cached: isCached,
            name: isRealDebrid ? "" : typeof item === "object" && item.name ? item.name : "",
            size: isRealDebrid ? 0 : typeof item === "object" && item.size ? item.size : 0,
            files: isRealDebrid ? rdVariants.flatMap((variant) => variant?.files || []) : typeof item === "object" && Array.isArray(item.files) ? item.files : [],
          };
          results[h] = entryData;
          memoryCache.set(h, { cached: isCached, data: entryData, expiresAt: now + CACHE_TTL_MS });
        }
        break; // Success!
      } catch {
        if (attempts >= maxRetries) {
          for (const h of batch) {
            results[h] = { cached: false };
          }
        } else {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
        }
      }
    }
  }

  return results;
}

/**
 * Clears the in-memory cache (primarily for tests).
 */
export function clearCachedMemory() {
  memoryCache.clear();
}
