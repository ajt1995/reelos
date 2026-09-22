/**
 * ReelFlow Scraper & Search Orchestrator
 * High-speed scraping with Circuit Breaker (Torrentio + TorBox Native Search fallback),
 * pre-flight poison filtering, instant debrid cache checking, and quality scoring.
 */

import { parseSceneTitle, scoreRelease } from "./quality.mjs";
import { checkCachedTorrents, getDebridApiKey } from "./cache-checker.mjs";
import { torBoxRateLimiter } from "../services/debrid-service.mjs";
import { neuralIndexerRepair, PUBLIC_INDEXER_ROSTER } from "../services/neural-indexer-repair.mjs";

// Circuit Breaker State for Primary Scraper (Torrentio)
export const circuitBreaker = {
  state: "CLOSED", // "CLOSED" | "OPEN" | "HALF_OPEN"
  failureCount: 0,
  lastFailureTime: 0,
  successCount: 0,
  FAILURE_THRESHOLD: 3,
  RESET_TIMEOUT_MS: 60 * 1000, // 60s cooldown before half-open probe
};

export function recordFailure() {
  circuitBreaker.failureCount++;
  circuitBreaker.lastFailureTime = Date.now();
  if (circuitBreaker.failureCount >= circuitBreaker.FAILURE_THRESHOLD) {
    circuitBreaker.state = "OPEN";
  }
}

export function recordSuccess() {
  circuitBreaker.failureCount = 0;
  circuitBreaker.state = "CLOSED";
}

export function isPrimaryAvailable() {
  if (circuitBreaker.state === "CLOSED") return true;
  if (circuitBreaker.state === "OPEN") {
    const elapsed = Date.now() - circuitBreaker.lastFailureTime;
    if (elapsed > circuitBreaker.RESET_TIMEOUT_MS) {
      circuitBreaker.state = "HALF_OPEN";
      return true; // allow probe request
    }
    return false;
  }
  return true; // HALF_OPEN allows single attempt
}

/**
 * Searches Torrentio for releases matching an IMDb ID (and optional season/episode).
 */
export async function scrapeTorrentio(imdbId, season = null, episode = null, fetchImpl = fetch) {
  if (!imdbId) return [];

  let endpoint = `https://torrentio.strem.fun/stream/movie/${imdbId}.json`;
  if (season != null && episode != null) {
    endpoint = `https://torrentio.strem.fun/stream/series/${imdbId}:${season}:${episode}.json`;
  }

  const res = await fetchImpl(endpoint, {
    headers: { "User-Agent": "ReelOS/2.0 (ReelFlow)" },
    signal: AbortSignal.timeout(3500),
  });

  if (!res.ok) {
    throw new Error(`Torrentio returned HTTP ${res.status}`);
  }

  const data = await res.json();
  const streams = Array.isArray(data?.streams) ? data.streams : [];
  const releases = [];

  for (const s of streams) {
    if (!s.infoHash) continue;
    // Torrentio title format often contains name on first line, size/seeds on second
    const lines = (s.title || "").split("\n");
    const name = lines[0]?.trim() || s.name || "";
    releases.push({
      title: name,
      infoHash: s.infoHash.toLowerCase(),
      fileIdx: s.fileIdx,
      source: "torrentio",
    });
  }

  return releases;
}

/**
 * Fallback: TorBox Search API.
 * Main API /v1/api/torrents/search was removed (TorBox v4.9). Search lives on
 * search-api.torbox.app.
 */
export const TORBOX_SEARCH_BASE = "https://search-api.torbox.app/torrents/search";

function torboxSearchItems(json) {
  const root = json?.data ?? json;
  if (Array.isArray(root)) return root;
  if (Array.isArray(root?.torrents)) return root.torrents;
  return [];
}

export async function scrapeTorBoxSearch(query, apiKey = "", fetchImpl = fetch) {
  const key = (apiKey || getDebridApiKey()).trim();
  if (!key || !query) return [];

  try {
    const url = `${TORBOX_SEARCH_BASE}/${encodeURIComponent(query)}?check_cache=true`;
    const cacheKey = `search:${encodeURIComponent(query.toLowerCase())}`;
    const { data: json } = await torBoxRateLimiter.executeRequest(cacheKey, async () => {
      return fetchImpl(url, {
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
          "User-Agent": "ReelOS/2.0 (ReelFlow)",
        },
        signal: AbortSignal.timeout(6000),
      });
    }, { ttlMs: 15 * 60 * 1000 });

    if (!json) return [];
    const releases = [];

    for (const item of torboxSearchItems(json)) {
      const hash = String(item.hash || item.infoHash || item.infohash || "").toLowerCase();
      if (!/^[a-f0-9]{40}$/.test(hash)) continue;
      releases.push({
        title: item.name || item.title || item.raw_title || "",
        infoHash: hash,
        size: item.size || item.size_bytes || 0,
        source: "torbox_native",
      });
    }
    return releases;
  } catch {
    return [];
  }
}

/**
 * Fallback: Scrapes public indexer roster with autonomous mirror self-repair.
 * Queries active mirrors for movies or TV based on category, extracts magnet hashes
 * from JSON/API responses or XML/HTML magnet links, and triggers self-healing on failure.
 *
 * @param {string} query
 * @param {string|Object} [roleOrOptions="both"] - Role ("movie"|"tv"|"both") or options object
 * @param {typeof fetch} [maybeFetchImpl=fetch]
 * @returns {Promise<Array<{ title: string, infoHash: string, size?: number, source: string }>>}
 */
export async function scrapePublicIndexers(query, roleOrOptions = "both", maybeFetchImpl = fetch) {
  if (!query) return [];

  let role = "both";
  let fetchImpl = maybeFetchImpl;
  if (typeof roleOrOptions === "object" && roleOrOptions !== null) {
    role = roleOrOptions.role || "both";
    fetchImpl = roleOrOptions.fetchImpl || fetch;
  } else if (typeof roleOrOptions === "string") {
    role = roleOrOptions;
  }

  const results = [];
  const seenHashes = new Set();
  const roster = Array.isArray(roleOrOptions?.indexerRoster)
    ? roleOrOptions.indexerRoster
    : (neuralIndexerRepair && neuralIndexerRepair.indexers) || PUBLIC_INDEXER_ROSTER;
  const enabledIds = Array.isArray(roleOrOptions?.enabledIndexerIds)
    ? new Set(roleOrOptions.enabledIndexerIds.map(String))
    : null;
  const candidates = roster.filter(
    (ix) =>
      (!enabledIds || enabledIds.has(ix.id)) &&
      (ix.type === "search" || ix.type === "rss") &&
      (ix.role === "both" || role === "both" || ix.role === role)
  );

  for (const ix of candidates) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      let success = false;
      try {
        const mirror = ix.activeMirror || ix.mirrors?.[0];
        if (!mirror) break;

        if (ix.name === "ReelOS-torrentcsv") {
          const res = await fetchImpl(`${mirror.replace(/\/+$/, "")}/service/search?q=${encodeURIComponent(query)}`, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ReelOS/2.0" },
            signal: AbortSignal.timeout(3000),
          });
          if (res.ok) {
            success = true;
            const items = await res.json();
            const list = Array.isArray(items?.torrents) ? items.torrents : Array.isArray(items) ? items : [];
            for (const item of list) {
              const h = (item.infohash || item.info_hash || item.hash || "").toLowerCase();
              if (h && !seenHashes.has(h)) {
                seenHashes.add(h);
                results.push({
                  title: item.name || item.title || query,
                  infoHash: h,
                  size: item.size_bytes || item.size || 0,
                  source: ix.name,
                });
              }
            }
          }
        } else if (ix.name === "ReelOS-yts" && (role === "movie" || role === "both")) {
          const res = await fetchImpl(`${mirror.replace(/\/+$/, "")}/api/v2/list_movies.json?query_term=${encodeURIComponent(query)}`, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ReelOS/2.0" },
            signal: AbortSignal.timeout(3000),
          });
          if (res.ok) {
            success = true;
            const json = await res.json();
            const movies = json?.data?.movies || [];
            for (const m of movies) {
              for (const t of m.torrents || []) {
                const h = (t.hash || "").toLowerCase();
                if (h && !seenHashes.has(h)) {
                  seenHashes.add(h);
                  results.push({
                    title: `${m.title} ${m.year || ""} ${t.quality || ""} ${t.type || ""}`.trim(),
                    infoHash: h,
                    size: t.size_bytes || 0,
                    source: ix.name,
                  });
                }
              }
            }
          }
        } else if (ix.name === "ReelOS-tpb") {
          const res = await fetchImpl(`${mirror.replace(/\/+$/, "")}/q.php?q=${encodeURIComponent(query)}`, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ReelOS/2.0" },
            signal: AbortSignal.timeout(3000),
          });
          if (res.ok) {
            success = true;
            const list = await res.json();
            if (Array.isArray(list)) {
              for (const item of list) {
                const h = (item.info_hash || item.hash || "").toLowerCase();
                if (h && h !== "0000000000000000000000000000000000000000" && !seenHashes.has(h)) {
                  seenHashes.add(h);
                  results.push({
                    title: item.name || query,
                    infoHash: h,
                    size: parseInt(item.size, 10) || 0,
                    source: ix.name,
                  });
                }
              }
            }
          }
        } else if (ix.name === "ReelOS-knaben") {
          const res = await fetchImpl(`${mirror.replace(/\/+$/, "")}/api/v1/search?q=${encodeURIComponent(query)}`, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ReelOS/2.0" },
            signal: AbortSignal.timeout(3000),
          });
          if (res.ok) {
            success = true;
            const json = await res.json();
            const list = Array.isArray(json?.results) ? json.results : Array.isArray(json) ? json : [];
            for (const item of list) {
              const h = (item.hash || item.infoHash || item.info_hash || "").toLowerCase();
              if (h && !seenHashes.has(h)) {
                seenHashes.add(h);
                results.push({
                  title: item.title || item.name || query,
                  infoHash: h,
                  size: item.size || 0,
                  source: ix.name,
                });
              }
            }
          }
        } else {
          // Fallback: RSS or HTML magnet scraper
          const url = ix.type === "rss" ? mirror : `${mirror.replace(/\/+$/, "")}/search/${encodeURIComponent(query)}/1/`;
          const res = await fetchImpl(url, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ReelOS/2.0" },
            signal: AbortSignal.timeout(3000),
          });
          if (res.ok) {
            success = true;
            const text = await res.text();
            if (ix.type === "rss") {
              // For RSS feeds, parse individual <item> entries and match against query keywords
              const itemMatches = [...text.matchAll(/<item[\s\S]*?<\/item>/gi)];
              const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
              for (const itemMatch of itemMatches) {
                const itemXml = itemMatch[0];
                const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
                const magnetMatch = itemXml.match(/magnet:\?xt=urn:btih:([a-f0-9]{40}|[a-z2-7]{32})(?:&amp;|&|[^"'\s<>])*/i);
                if (!magnetMatch) continue;
                const h = magnetMatch[1].toLowerCase();
                if (!h || seenHashes.has(h)) continue;
  
                const rawTitle = titleMatch ? titleMatch[1].trim() : query;
                // Verify at least one significant query word appears in title
                if (queryWords.length > 0 && !queryWords.some((w) => rawTitle.toLowerCase().includes(w))) {
                  continue;
                }
  
                seenHashes.add(h);
                results.push({
                  title: rawTitle,
                  infoHash: h,
                  size: 0,
                  source: ix.name,
                });
              }
          } else {
            // HTML magnet scraper
            const magnetMatches = [...text.matchAll(/magnet:\?xt=urn:btih:([a-f0-9]{40}|[a-z2-7]{32})(?:&amp;|&|[^"'\s<>])*/gi)];
            for (const m of magnetMatches) {
              const h = m[1].toLowerCase();
              if (h && !seenHashes.has(h)) {
                seenHashes.add(h);
                const dnMatch = m[0].match(/[?&]dn=([^&"'\s<>]+)/i);
                let title = query;
                if (dnMatch) {
                  try {
                    title = decodeURIComponent(dnMatch[1].replace(/\+/g, " "));
                  } catch {
                    title = dnMatch[1];
                  }
                }
                results.push({
                  title,
                  infoHash: h,
                  size: 0,
                  source: ix.name,
                });
              }
            }
          }
        }
      }
    } catch (err) {
      // Will trigger repair if attempt === 1
    }

      if (success) {
        break;
      }
      
      if (!success && attempt === 1) {
        await neuralIndexerRepair.repairIndexer(ix.name, fetchImpl).catch(() => {});
      }
    }
  }

  return results;
}

/**
 * High-level search & release resolution:
 * Runs primary scraper (Torrentio) with circuit breaker; falls back to TorBox search;
 * filters poison-pills, verifies cache on TorBox, scores candidate releases, and returns sorted results.
 *
 * @param {Object} queryParams
 * @param {string} queryParams.title - e.g. "Inception"
 * @param {string} [queryParams.imdbId] - e.g. "tt1375666"
 * @param {number} [queryParams.year] - e.g. 2010
 * @param {number} [queryParams.season] - Optional season number
 * @param {number} [queryParams.episode] - Optional episode number
 * @param {Object} [options]
 * @param {string} [options.qualityFloor="1080p"]
 * @param {boolean} [options.preferHdr=true]
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {Promise<Array<Object>>} Sorted releases with scores, cache status, and parsed metadata
 */
export async function searchAndScoreReleases(queryParams = {}, options = {}) {
  const { title, imdbId, year, season, episode } = queryParams;
  const fetchImpl = options.fetchImpl || fetch;

  let rawReleases = [];

  // Step 1: Try Primary Scraper (Torrentio) if Circuit Breaker allows and imdbId is available
  if (imdbId && isPrimaryAvailable()) {
    try {
      rawReleases = await scrapeTorrentio(imdbId, season, episode, fetchImpl);
      recordSuccess();
    } catch (err) {
      recordFailure();
    }
  }

  const hasEp = season != null && episode != null;
  const isTv = hasEp || (typeof season === "number" && !isNaN(season));

  // Step 2: Fallback to TorBox Search if Torrentio gave 0 results or circuit is open
  if (rawReleases.length === 0 && options.providerSearch !== false
      && Array.isArray(options.enabledIndexerIds) && options.enabledIndexerIds.length > 0) {
    const q = hasEp
      ? `${title} S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`
      : `${title} ${year || ""}`.trim();
    rawReleases = await scrapeTorBoxSearch(q, options.apiKey, fetchImpl);
  }

  // Step 2.5: Fallback to Public Indexers with autonomous mirror repair
  if (rawReleases.length === 0 && (options.provider || "torbox") === "torbox") {
    const q = hasEp
      ? `${title} S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`
      : `${title} ${year || ""}`.trim();
    const role = isTv ? "tv" : "movie";
    rawReleases = await scrapePublicIndexers(q, {
      role,
      fetchImpl,
      enabledIndexerIds: options.enabledIndexerIds,
      indexerRoster: options.indexerRoster,
    });
  }

  if (rawReleases.length === 0) {
    return [];
  }

  // Step 3: Parse titles & discard poison-pills pre-flight
  const candidates = [];
  const hashesToCheck = [];

  for (const rel of rawReleases) {
    const parsed = parseSceneTitle(rel.title);
    if (parsed.isPoison) continue; // Poison pill discarded!

    // If searching for specific episode, ensure release matches
    if (hasEp) {
      if (parsed.season != null && parsed.season !== season) continue;
      if (parsed.episode != null && parsed.episode !== episode && !parsed.seasonPack) continue;
    }

    candidates.push({
      ...rel,
      parsed,
    });
    hashesToCheck.push(rel.infoHash);
  }

  if (candidates.length === 0) {
    return [];
  }

  // Step 4: Pre-flight Debrid Cache Verification (batched with backoff)
  const cacheMap = await checkCachedTorrents(hashesToCheck, options.apiKey, {
    fetchImpl,
    provider: options.provider,
  });

  // Step 5: Score releases against quality profiles
  const scored = [];
  for (const c of candidates) {
    const cacheInfo = cacheMap[c.infoHash] || { cached: false };
    const score = scoreRelease(c.parsed, {
      qualityFloor: options.qualityFloor || "1080p",
      preferHdr: options.preferHdr !== false,
      preferRemux: options.preferRemux === true,
      sizeBytes: c.size || cacheInfo.size || 0,
      isCached: cacheInfo.cached,
    });

    if (score > 0) {
      scored.push({
        ...c,
        isCached: cacheInfo.cached,
        cachedFiles: cacheInfo.files || [],
        score,
      });
    }
  }

  // Step 6: Sort by score descending (highest quality instant-cached first)
  scored.sort((a, b) => b.score - a.score);

  return scored;
}
