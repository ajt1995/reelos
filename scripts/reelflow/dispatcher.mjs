/**
 * ReelFlow Dispatcher
 * Submits torrents/magnets to Decypharr qBittorrent bridge (:8282) or directly to TorBox debrid.
 */

import { getDebridApiKey } from "./cache-checker.mjs";
import { torBoxRateLimiter } from "../services/debrid-service.mjs";

const DECYPHARR_API = process.env.DECYPHARR_API || "http://127.0.0.1:8282";

/**
 * Dispatches a torrent / magnet link to Decypharr qBittorrent bridge.
 * @param {string} magnetOrUrl - Magnet URI or torrent file URL
 * @param {Object} [options]
 * @param {string} [options.category="movies"] - "movies" | "tv"
 * @param {string} [options.savePath] - Optional custom save path
 * @param {typeof fetch} [options.fetchImpl] - Optional fetch override
 * @returns {Promise<{ ok: boolean, hash?: string, error?: string }>}
 */
export async function dispatchTorrent(magnetOrUrl, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const category = options.category || "movies";

  if (!magnetOrUrl) {
    return { ok: false, error: "Missing magnet or torrent URL" };
  }

  // Extract infohash if magnet
  let hash = null;
  const hashMatch = magnetOrUrl.match(/xt=urn:btih:([a-f0-9]{40}|[a-z2-7]{32})/i);
  if (hashMatch) {
    hash = hashMatch[1].toLowerCase();
  }

  // Step 1: Submit to Decypharr (:8282)
  try {
    const formData = new URLSearchParams();
    formData.append("urls", magnetOrUrl);
    formData.append("category", category);
    if (options.savePath) {
      formData.append("savepath", options.savePath);
    }

    const res = await fetchImpl(`${DECYPHARR_API}/api/v2/torrents/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "ReelOS/2.0 (ReelFlow)",
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      return { ok: true, hash, method: "decypharr" };
    }
  } catch (err) {
    // Decypharr call failed, fall through to TorBox native fallback
  }

  // Step 2: Fallback to TorBox Native API if Decypharr is unavailable
  const apiKey = (options.apiKey || getDebridApiKey()).trim();
  if ((options.provider || "torbox") === "torbox" && apiKey && hash) {
    try {
      const tbForm = new URLSearchParams();
      tbForm.append("magnet", magnetOrUrl);

      const cacheKey = `createtorrent:${hash}`;
      const { data } = await torBoxRateLimiter.executeRequest(cacheKey, async () => {
        return fetchImpl("https://api.torbox.app/v1/api/torrents/createtorrent", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "ReelOS/2.0 (ReelFlow)",
          },
          body: tbForm.toString(),
          signal: AbortSignal.timeout(6000),
        });
      }, { bypassCache: true });

      if (data) {
        return { ok: true, hash, method: "torbox_native", data: data?.data || data };
      }
    } catch (e) {
      return { ok: false, error: `TorBox API error: ${String(e)}` };
    }
  }

  return { ok: false, error: `Failed to dispatch torrent through Decypharr${(options.provider || "torbox") === "torbox" ? " or TorBox" : ""}` };
}

/**
 * Gets active torrents list from Decypharr.
 */
export async function getDecypharrTorrents(fetchImpl = fetch) {
  try {
    const res = await fetchImpl(`${DECYPHARR_API}/api/v2/torrents/info`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
