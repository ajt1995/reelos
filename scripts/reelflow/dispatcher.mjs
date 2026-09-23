/**
 * ReelFlow Dispatcher
 * Submits torrents/magnets through the exact validated TorBox account.
 */

import { providerCacheScope } from "./cache-checker.mjs";
import { torBoxRateLimiter } from "../services/debrid-service.mjs";

const DECYPHARR_API = process.env.DECYPHARR_API || "http://127.0.0.1:8282";

/**
 * Dispatches a torrent / magnet link to the validated TorBox account.
 * @param {string} magnetOrUrl - Magnet URI or torrent file URL
 * @param {Object} [options]
 * @param {string} [options.category="movies"] - "movies" | "tv"
 * @param {string} [options.savePath] - Optional custom save path
 * @param {typeof fetch} [options.fetchImpl] - Optional fetch override
 * @returns {Promise<{ ok: boolean, hash?: string, error?: string }>}
 */
export async function dispatchTorrent(magnetOrUrl, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const apiKey = String(options.apiKey || "").trim();
  if (!apiKey || !/^[a-f0-9]{64}$/.test(String(options.accountScope || ""))
      || typeof options.authorize !== "function") {
    return { ok: false, error: "Connect and validate a provider before dispatching." };
  }

  if (!magnetOrUrl) {
    return { ok: false, error: "Missing magnet or torrent URL" };
  }

  // Extract infohash if magnet
  let hash = null;
  const hashMatch = magnetOrUrl.match(/xt=urn:btih:([a-f0-9]{40}|[a-z2-7]{32})/i);
  if (hashMatch) {
    hash = hashMatch[1].toLowerCase();
  }

  // The retired local bridge has no account-attestation boundary. Never send
  // a validated provider request through an unknown configured account.
  if ((options.provider || "torbox") !== "torbox") {
    return { ok: false, error: "This provider has no account-bound native dispatch path." };
  }
  if ((options.provider || "torbox") === "torbox" && apiKey && hash) {
    try {
      const tbForm = new URLSearchParams();
      tbForm.append("magnet", magnetOrUrl);

      const cacheKey = `createtorrent:${providerCacheScope("torbox", apiKey, options.accountScope)}:${hash}`;
      const { data } = await torBoxRateLimiter.executeRequest(cacheKey, async () => {
        if (options.authorize() !== true) throw new Error("Provider authority changed.");
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

      if (data && data.success !== false && !data.error) {
        return { ok: true, hash, method: "torbox_native", data: data?.data || data };
      }
    } catch {
      return { ok: false, error: "TorBox could not accept this request." };
    }
  }

  return { ok: false, error: "TorBox could not accept this source." };
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
