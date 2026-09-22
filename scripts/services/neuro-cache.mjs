import { getMediaStrategy, inspectStorageSpace } from './media-strategy-service.mjs';

const MAX_PREWARMED_ENTRIES = 3;
const MAX_PREWARMED_BYTES = 150 * 1024 * 1024; // 150MB total buffer memory cap
const MAX_STAGED = 64;
const MAX_EVICTED = 256;
const MAX_WATCH_KEYS = 512;
const MAX_WATCHERS_PER = 16;

function capSet(set, max) {
  while (set.size > max) {
    const first = set.values().next().value;
    set.delete(first);
  }
}

export class NeuroCache {
  constructor() {
    this.pinned = new Set();
    this.staged = new Set();
    this.evicted = new Set();
    this.watchHistory = {};
    this.prewarmed = new Map();
  }

  /**
   * Enforces LRU and size limits on prewarmed memory buffers.
   */
  enforcePrewarmedBounds() {
    let totalBytes = 0;
    for (const item of this.prewarmed.values()) {
      if (item?.buffer) totalBytes += item.buffer.length;
    }

    // Evict oldest entries if exceeding count or byte limits
    while ((this.prewarmed.size > MAX_PREWARMED_ENTRIES || totalBytes > MAX_PREWARMED_BYTES) && this.prewarmed.size > 0) {
      const oldestKey = this.prewarmed.keys().next().value;
      if (!oldestKey) break;
      const oldestItem = this.prewarmed.get(oldestKey);
      if (oldestItem?.buffer) {
        totalBytes -= oldestItem.buffer.length;
        oldestItem.buffer = null; // release buffer memory
      }
      this.prewarmed.delete(oldestKey);
    }
  }

  /**
   * Prunes stale prewarmed buffers older than or equal to TTL.
   */
  prune(maxAgeMs = 15 * 60 * 1000) {
    const now = Date.now();
    for (const [key, item] of this.prewarmed.entries()) {
      if (item?.primedAt !== undefined && (now - item.primedAt >= maxAgeMs)) {
        if (item.buffer) item.buffer = null;
        this.prewarmed.delete(key);
      }
    }
    this.enforcePrewarmedBounds();
  }

  prewarmStream(showId, nextEpisodeNumber, nextMediaId) {
    this.enforcePrewarmedBounds();
    const staged = this.stageNextEpisodes(showId, nextEpisodeNumber);
    const info = {
      showId,
      nextEpisodeNumber,
      nextMediaId,
      staged,
      primedAt: Date.now(),
      status: "primed",
      buffer: null,
      contentType: null,
    };
    const key = `${showId}:${nextEpisodeNumber || nextMediaId}`;
    this.prewarmed.set(key, info);
    if (nextMediaId) {
      this.prewarmed.set(String(nextMediaId).toLowerCase(), info);
    }

    const promise = (async () => {
      if (nextMediaId) {
        try {
          const port = process.env.PORT || 8080;
          const host = process.env.HOST || "127.0.0.1";
          const url = `http://${host}:${port}/Videos/${encodeURIComponent(nextMediaId)}/stream?static=true`;
          // 50MB predictive pre-warming for zero-latency instant start
          const res = await fetch(url, { headers: { 'Range': 'bytes=0-52428800' } });
          if (res.ok || res.status === 206) {
            const buffer = Buffer.from(await res.arrayBuffer());
            info.buffer = buffer;
            info.contentType = res.headers.get('content-type') || "video/mp4";
            info.size = buffer.length;
            this.prewarmed.set(String(nextMediaId).toLowerCase(), info);
            this.prewarmed.set(key, info);
            this.enforcePrewarmedBounds();
          }
        } catch (err) {}
      }
      return info;
    })();

    Object.assign(promise, info);
    return promise;
  }

  setPrewarmedBuffer(mediaId, buffer, contentType = "video/mp4") {
    this.enforcePrewarmedBounds();
    const key = String(mediaId).toLowerCase();
    const info = {
      mediaId,
      buffer,
      contentType,
      size: buffer?.length || 0,
      primedAt: Date.now(),
      status: "ready",
    };
    this.prewarmed.set(key, info);
    this.enforcePrewarmedBounds();
    return info;
  }

  getPrewarmed(mediaId) {
    if (!mediaId) return null;
    return this.prewarmed.get(String(mediaId).toLowerCase()) || this.prewarmed.get(mediaId) || null;
  }

  hasPrewarmed(mediaId) {
    if (!mediaId) return false;
    const entry = this.getPrewarmed(mediaId);
    return Boolean(entry && entry.buffer && entry.buffer.length > 0);
  }

  stageNextEpisodes(showId, currentEpisode) {
    // Predictive Binge Stager
    let epNum = parseInt(currentEpisode, 10);
    let prefix = "";
    if (typeof currentEpisode === "string") {
      const match = currentEpisode.match(/^(.*?[eE])(\d+)$/);
      if (match) {
        prefix = match[1];
        epNum = parseInt(match[2], 10);
      }
    }
    if (isNaN(epNum)) epNum = 0;
    
    const ep4 = prefix ? `${showId}-${prefix}${String(epNum + 1).padStart(2, '0')}` : `${showId}-E${epNum + 1}`;
    const ep5 = prefix ? `${showId}-${prefix}${String(epNum + 2).padStart(2, '0')}` : `${showId}-E${epNum + 2}`;
    this.staged.add(ep4);
    this.staged.add(ep5);
    capSet(this.staged, MAX_STAGED);
    return [ep4, ep5];
  }

  recordWatch(userId, mediaId, isKidsOrComfort = false) {
    if (!this.watchHistory[mediaId]) {
      this.watchHistory[mediaId] = [];
    }
    this.watchHistory[mediaId].push(userId);
    if (this.watchHistory[mediaId].length > MAX_WATCHERS_PER) {
      this.watchHistory[mediaId] = this.watchHistory[mediaId].slice(-MAX_WATCHERS_PER);
    }
    const keys = Object.keys(this.watchHistory);
    if (keys.length > MAX_WATCH_KEYS) {
      delete this.watchHistory[keys[0]];
    }
    
    // Smart Child & Comfort Media Auto-Pinning
    if (isKidsOrComfort && this.watchHistory[mediaId].length > 2) {
      this.pinned.add(mediaId);
    }
  }

  evictPostWatch(mediaId, householdSize = 1) {
    // Fast Post-Watch Eviction
    if (this.pinned.has(mediaId)) return false;
    
    const watchers = new Set(this.watchHistory[mediaId] || []);
    if (watchers.size >= householdSize) {
      this.evicted.add(mediaId);
      capSet(this.evicted, MAX_EVICTED);
      this.staged.delete(mediaId);
      return true;
    }
    return false;
  }

  manageWatermarks() {
    // High/Low Watermark Manager
    const strategy = getMediaStrategy();
    const storage = inspectStorageSpace();
    
    const highWatermarkGb = strategy.allocatedGb * 0.9;
    const lowWatermarkGb = strategy.allocatedGb * 0.5;
    
    let action = 'none';
    const usedGb = storage.totalGb - storage.freeGb;
    
    if (usedGb > highWatermarkGb) {
      action = 'evict';
    } else if (usedGb < lowWatermarkGb) {
      action = 'stage';
    }
    return { action, usedGb, highWatermarkGb, lowWatermarkGb };
  }
}

export const neuroCache = new NeuroCache();

export async function handleNeuroCacheRoute(req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ 
    pinned: Array.from(neuroCache.pinned),
    staged: Array.from(neuroCache.staged),
    evicted: Array.from(neuroCache.evicted)
  }));
  return true;
}
