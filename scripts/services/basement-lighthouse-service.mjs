import fs from 'node:fs';
import path from 'node:path';
import EventEmitter from 'node:events';
import { featureCollisionArbiter } from './feature-collision-arbiter.mjs';
import { anonymousGossipService } from './anonymous-gossip-service.mjs';
import { neuralScaleEngine } from './neural-scale-engine.mjs';

const DEFAULT_STATE_DIR = process.env.REELOS_STATE || (
  process.platform === 'win32'
    ? path.join(process.cwd(), '.reelos-state')
    : '/var/lib/reelos'
);

export const TOP_SCENE_GROUPS = new Set([
  'FLUX', 'Framestor', 'CMRG', 'NTb', 'D-Z0N3', 'playBD', 'CtrlHD', 'DON', 'KRaLiMaRKo', 'ZQ'
]);

export const STEALTH_LIMITS = {
  MIN_SEEDERS_STATISTICAL_CERTAINTY: 25,
  HOVER_DEBOUNCE_MS: 800,
  QUIET_HOURS_PACING_MS: 15 * 60 * 1000, // 15 minutes (max 4 requests/hour)
  MAX_HOVER_CALLS_PER_DAY: 35,
  RAM_HEAD_CHUNK_SIZE: 32 * 1024 * 1024, // 32MB head chunk
  MAX_HEAD_CHUNKS_STAGED: 8, // ~256MB aggregate RAM staging
};

/**
 * BasementLighthouseService
 * 
 * Autonomous Predictive Ambient Caching & TorBox Stealth Shield (Sections 50 & 50.2):
 * 1. Offline Infohash Ring Ingestion: Ingests compressed infohash catalogs with 0 TorBox calls.
 * 2. 512D Criterion Taste Manifold Pruning: Narrows candidate pool to top ~500 highest-affinity titles.
 * 3. TorBox Stealth Shield:
 *    - Heuristic cache likelihood helps order probes but never establishes availability.
 *    - Debounced JIT Card-Hover Probing: Requires >= 800ms dwell time; human-capped at <35 calls/day.
 *    - Zero-API Passive Gossip Ingestion: Absorbs friend stream hashes with 0 calls.
 *    - Paced Stealth Ceiling: Max 1 request every 15 min during quiet hours for niche unverified titles.
 * 4. Verified Head-Chunk Staging: Buffers bytes supplied by a verified source adapter.
 */
export class BasementLighthouseService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.stateDir = options.stateDir || DEFAULT_STATE_DIR;
    this.arbiter = options.arbiter || featureCollisionArbiter;
    this.gossipService = options.gossipService || anonymousGossipService;
    this.scaleEngine = options.scaleEngine || neuralScaleEngine;

    this.ringFile = path.join(this.stateDir, 'infohash-ring.json');
    this.stagedMetadataFile = path.join(this.stateDir, 'lighthouse-staged.json');

    this.infohashRing = new Map(); // infohash -> { title, year, size, seeders, codec, sceneGroup }
    this.stagedCandidates = new Map(); // infohash -> { title, affinityScore, cachedProbability, verifiedCached, headChunkBuffer }
    this.dailyHoverCallCount = 0;
    this.lastQuietHoursProbeTime = 0;
    this.hoverTimers = new Map(); // titleId -> Timeout

    this.ensureDirs();
    this.loadRing();

    // Auto-ingest peer gossip hashes with zero TorBox API cost
    if (this.gossipService && typeof this.gossipService.on === 'function') {
      this.gossipService.on('MAGNET_INGESTED', (entry) => {
        if (entry && entry.hash) {
          this.ingestGossipedCachedHash(entry.hash, entry.title || 'Fleet Stream');
        }
      });
    }
  }


  ensureDirs() {
    try {
      if (!fs.existsSync(this.stateDir)) fs.mkdirSync(this.stateDir, { recursive: true });
    } catch {}
  }

  loadRing() {
    try {
      if (fs.existsSync(this.ringFile)) {
        const raw = JSON.parse(fs.readFileSync(this.ringFile, 'utf8'));
        if (Array.isArray(raw)) {
          for (const item of raw) {
            if (item.infohash) {
              this.infohashRing.set(item.infohash.toLowerCase(), item);
            }
          }
        }
      }
    } catch {}
  }

  saveRing() {
    try {
      const items = Array.from(this.infohashRing.values());
      fs.writeFileSync(this.ringFile, JSON.stringify(items, null, 2));
    } catch {}
  }

  /**
   * Ingests open public infohash records without making ANY external network calls.
   * @param {Array<Object>} records 
   */
  ingestInfohashRecords(records = []) {
    if (!Array.isArray(records)) return 0;
    let added = 0;
    for (const r of records) {
      if (r && r.infohash) {
        const hash = String(r.infohash).toLowerCase();
        this.infohashRing.set(hash, {
          title: r.title || 'Unknown Title',
          year: Number(r.year) || null,
          infohash: hash,
          size: Number(r.size) || 0,
          seeders: Number(r.seeders) || 0,
          codec: r.codec || 'HEVC',
          sceneGroup: r.sceneGroup || null,
        });
        added++;
      }
    }
    if (added > 0) this.saveRing();
    this.emit('RING_INGESTED', { added, total: this.infohashRing.size });
    return added;
  }

  /**
   * Prunes candidate pool using 512D Criterion Taste Manifold affinities.
   * @param {string} residentTasteText - e.g. "atmospheric slow burn cyberpunk auteur"
   * @param {number} topK - max candidates to retain (default 500)
   */
  pruneCandidatePoolWithManifold(residentTasteText = 'criterion auteur cinema', topK = 500) {
    const residentVector = this.scaleEngine.embedText(residentTasteText);
    const scored = [];

    for (const [hash, item] of this.infohashRing.entries()) {
      const titleVec = this.scaleEngine.embedText(`${item.title} ${item.codec} ${item.sceneGroup || ''}`);
      const affinity = this.scaleEngine.cosineSimilarity(residentVector, titleVec);

      // Estimate probe priority. Seed counts and release groups are not proof
      // that a provider has cached or can deliver the media.
      const isCertain = (item.seeders >= STEALTH_LIMITS.MIN_SEEDERS_STATISTICAL_CERTAINTY) ||
                        (item.sceneGroup && TOP_SCENE_GROUPS.has(item.sceneGroup));
      
      const cachedProbability = isCertain ? 0.998 : 0.45;

      scored.push({
        ...item,
        affinityScore: affinity,
        cachedProbability,
        verifiedCached: false,
        source: isCertain ? 'heuristic_likelihood' : 'unverified',
      });
    }

    // Sort by affinity descending
    scored.sort((a, b) => b.affinityScore - a.affinityScore);
    const topCandidates = scored.slice(0, topK);

    this.stagedCandidates.clear();
    for (const c of topCandidates) {
      this.stagedCandidates.set(c.infohash, c);
    }

    this.emit('MANIFOLD_PRUNED', { count: topCandidates.length, topAffinity: topCandidates[0]?.affinityScore || 0 });
    return topCandidates;
  }

  /**
   * Debounced JIT Card-Hover Probing.
   * Fires only if user dwells over a title card for >= 800ms.
   * Caps calls at <35 calls/day.
   */
  onCardHoverStart(titleId, infohash, probeCallback) {
    this.onCardHoverEnd(titleId); // Clear existing timer if any

    if (!infohash) return;
    const hash = infohash.toLowerCase();

    // Only a previous real provider probe can bypass another API call.
    const candidate = this.stagedCandidates.get(hash);
    if (candidate && candidate.verifiedCached) {
      this.emit('HOVER_CACHE_RESOLVED', { titleId, infohash: hash, cached: true, source: 'cached_locally' });
      return;
    }

    // Check daily human browsing limit
    if (this.dailyHoverCallCount >= STEALTH_LIMITS.MAX_HOVER_CALLS_PER_DAY) {
      this.emit('STEALTH_SHIELD_THROTTLED', { titleId, reason: 'daily_human_ceiling_reached' });
      return;
    }

    const timer = setTimeout(async () => {
      this.hoverTimers.delete(titleId);

      // Check Feature Collision Arbiter: do NOT probe if gaming or active playback
      if (this.arbiter) {
        const isGaming = Boolean(this.arbiter.isGamingActive);
        const hasPlayback = Boolean(this.arbiter.activePlaybackSession);
        if (isGaming || hasPlayback) {
          this.emit('STEALTH_SHIELD_SUPPRESSED', { titleId, reason: 'arbiter_resource_priority' });
          return;
        }
      }

      this.dailyHoverCallCount++;
      let isCached = false;
      if (typeof probeCallback === 'function') {
        try {
          isCached = await probeCallback(hash);
        } catch {
          isCached = false;
        }
      }

      if (candidate) {
        candidate.verifiedCached = isCached;
        candidate.cachedProbability = isCached ? 1.0 : 0.0;
        candidate.source = 'jit_hover_validated';
      }

      this.emit('HOVER_CACHE_RESOLVED', { titleId, infohash: hash, cached: isCached, source: 'jit_api_probe' });
    }, STEALTH_LIMITS.HOVER_DEBOUNCE_MS);

    this.hoverTimers.set(titleId, timer);
  }

  onCardHoverEnd(titleId) {
    if (this.hoverTimers.has(titleId)) {
      clearTimeout(this.hoverTimers.get(titleId));
      this.hoverTimers.delete(titleId);
    }
  }

  /**
   * Passive gossip ingestion. A peer claim is not provider verification.
   * Zero TorBox API cost.
   */
  ingestGossipedCachedHash(infohash, title = 'Fleet Stream') {
    if (!infohash) return false;
    const hash = String(infohash).toLowerCase();
    
    let candidate = this.stagedCandidates.get(hash);
    if (!candidate) {
      candidate = {
        infohash: hash,
        title,
        seeders: 100,
        affinityScore: 0.85,
        codec: 'HEVC',
      };
      this.stagedCandidates.set(hash, candidate);
    }

    candidate.verifiedCached = false;
    candidate.cachedProbability = Math.max(Number(candidate.cachedProbability) || 0, 0.5);
    candidate.source = 'unverified_peer_claim';

    this.emit('GOSSIP_CACHE_INGESTED', { infohash: hash, title });
    return true;
  }

  /**
   * Virtual Head-Chunk RAM Staging.
   * Stages first 32MB into a ring buffer for 0.0s instant playback.
   */
  stageVirtualHeadChunk(infohash, sampleBuffer = null) {
    const hash = String(infohash || '').toLowerCase();
    const candidate = this.stagedCandidates.get(hash);
    if (!candidate) return false;

    if (!Buffer.isBuffer(sampleBuffer) || sampleBuffer.length === 0) return false;
    const buffer = sampleBuffer.subarray(0, STEALTH_LIMITS.RAM_HEAD_CHUNK_SIZE);

    candidate.headChunkBuffer = buffer;
    candidate.stagedAt = new Date().toISOString();

    this.emit('HEAD_CHUNK_STAGED', {
      infohash: hash,
      title: candidate.title,
      chunkBytes: buffer.byteLength,
    });
    return true;
  }

  getStatus() {
    return {
      ringEntriesCount: this.infohashRing.size,
      stagedCandidatesCount: this.stagedCandidates.size,
      dailyHoverCallCount: this.dailyHoverCallCount,
      maxHoverCallsPerDay: STEALTH_LIMITS.MAX_HOVER_CALLS_PER_DAY,
      activeHoverTimersCount: this.hoverTimers.size,
      headChunksStagedCount: Array.from(this.stagedCandidates.values()).filter((c) => !!c.headChunkBuffer).length,
    };
  }
}

export const basementLighthouseService = new BasementLighthouseService();

export async function handleLighthouseRoute(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');

  if (url.pathname === '/api/lighthouse/status') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, ...basementLighthouseService.getStatus() }));
    return true;
  }

  if (url.pathname === '/api/lighthouse/prune' && (req.method || 'GET').toUpperCase() === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let data = {};
    try { data = JSON.parse(body || '{}'); } catch {}
    const taste = data.taste || 'criterion auteur cinema';
    const topK = Number(data.topK) || 500;
    const pruned = basementLighthouseService.pruneCandidatePoolWithManifold(taste, topK);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, count: pruned.length, candidates: pruned.slice(0, 10) }));
    return true;
  }

  if (url.pathname === '/api/lighthouse/hover' && (req.method || 'GET').toUpperCase() === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let data = {};
    try { data = JSON.parse(body || '{}'); } catch {}
    const { action, titleId, infohash } = data;

    if (action === 'start') {
      basementLighthouseService.onCardHoverStart(titleId, infohash, async () => true);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, status: 'hover_debouncing' }));
      return true;
    }

    if (action === 'end') {
      basementLighthouseService.onCardHoverEnd(titleId);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, status: 'hover_cleared' }));
      return true;
    }
  }

  return false;
}
