import fs from 'node:fs';
import path from 'node:path';
import EventEmitter from 'node:events';
import { cinemaBrainLoader, RWT_MAGIC } from './cinema-brain-loader.mjs';
import { neuralScaleEngine } from './neural-scale-engine.mjs';

const DEFAULT_STATE_DIR = process.env.REELOS_STATE || (
  process.platform === 'win32'
    ? path.join(process.cwd(), '.reelos-state')
    : '/var/lib/reelos'
);

export const HIERARCHICAL_TIERS = {
  TIER_1_TEACHER: {
    id: 'tier1_teacher',
    label: 'Tier 1: Master Workstation (Teacher)',
    dim: 512,
    quantized: false,
  },
  TIER_2_APPLIANCE: {
    id: 'tier2_appliance',
    label: 'Tier 2: Living Room Appliance',
    dim: 64,
    quantized: false,
  },
  TIER_3_EDGE: {
    id: 'tier3_edge',
    label: 'Tier 3: Edge TV Stick / Handheld',
    dim: 16,
    quantized: true,
  },
};

/**
 * NeuralDistillationService
 * 
 * Projects the deterministic lexicon baseline into smaller vector packages.
 * This is prototype dimensionality reduction, not teacher/student model
 * training or proof of learned semantic quality.
 */
export class NeuralDistillationService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.stateDir = options.stateDir || DEFAULT_STATE_DIR;
    this.brainLoader = options.brainLoader || cinemaBrainLoader;
    this.scaleEngine = options.scaleEngine || neuralScaleEngine;
    this.distilledDir = path.join(this.stateDir, 'distilled-models');
    this.gradientDeltasFile = path.join(this.stateDir, 'edge-gradient-deltas.json');

    this.projection512to64 = null;
    this.projection64to16 = null;
    this.distilledAnchors = new Map(); // tierId -> Buffer
    this.pendingGradientDeltas = [];

    this.ensureDirs();
    this.initProjections();
  }

  ensureDirs() {
    try {
      if (!fs.existsSync(this.stateDir)) fs.mkdirSync(this.stateDir, { recursive: true });
      if (!fs.existsSync(this.distilledDir)) fs.mkdirSync(this.distilledDir, { recursive: true });
    } catch {}
  }

  /**
   * Initializes deterministic orthogonal down-projection matrices:
   * W1: 512 -> 64
   * W2: 64 -> 16
   */
  initProjections() {
    // W1: 512 -> 64
    const w1 = new Float32Array(512 * 64);
    for (let i = 0; i < 64; i++) {
      let norm = 0;
      for (let j = 0; j < 512; j++) {
        const val = Math.sin((i + 1) * 17.3 + (j + 1) * 31.7);
        w1[i * 512 + j] = val;
        norm += val * val;
      }
      norm = Math.sqrt(norm) || 1.0;
      for (let j = 0; j < 512; j++) w1[i * 512 + j] /= norm;
    }
    this.projection512to64 = w1;

    // W2: 64 -> 16
    const w2 = new Float32Array(64 * 16);
    for (let i = 0; i < 16; i++) {
      let norm = 0;
      for (let j = 0; j < 64; j++) {
        const val = Math.cos((i + 1) * 13.9 + (j + 1) * 23.3);
        w2[i * 64 + j] = val;
        norm += val * val;
      }
      norm = Math.sqrt(norm) || 1.0;
      for (let j = 0; j < 64; j++) w2[i * 64 + j] /= norm;
    }
    this.projection64to16 = w2;
  }

  /**
   * Distills a 512D vector down to 64D.
   * @param {Float32Array|Array<number>} vec512
   * @returns {Float32Array} 64D vector
   */
  project512to64(vec512) {
    const out = new Float32Array(64);
    for (let i = 0; i < 64; i++) {
      let sum = 0;
      const rowOffset = i * 512;
      for (let j = 0; j < 512; j++) {
        sum += (vec512[j] || 0) * this.projection512to64[rowOffset + j];
      }
      out[i] = sum;
    }
    // L2 Normalize
    let norm = 0;
    for (let i = 0; i < 64; i++) norm += out[i] * out[i];
    norm = Math.sqrt(norm) || 1.0;
    for (let i = 0; i < 64; i++) out[i] /= norm;
    return out;
  }

  /**
   * Distills a 64D vector down to 16D.
   * @param {Float32Array|Array<number>} vec64
   * @returns {Float32Array} 16D vector
   */
  project64to16(vec64) {
    const out = new Float32Array(16);
    for (let i = 0; i < 16; i++) {
      let sum = 0;
      const rowOffset = i * 64;
      for (let j = 0; j < 64; j++) {
        sum += (vec64[j] || 0) * this.projection64to16[rowOffset + j];
      }
      out[i] = sum;
    }
    // L2 Normalize
    let norm = 0;
    for (let i = 0; i < 16; i++) norm += out[i] * out[i];
    norm = Math.sqrt(norm) || 1.0;
    for (let i = 0; i < 16; i++) out[i] /= norm;
    return out;
  }

  /**
   * Generates a distilled binary weight package (.rwt) for a target tier.
   * @param {'tier2_appliance'|'tier3_edge'} tierKey
   * @returns {Buffer} Zero-GC binary weight buffer
   */
  generateDistilledPackage(tierKey = 'tier3_edge') {
    if (!this.brainLoader.isLoaded) {
      this.brainLoader.initBrain();
    }

    const vocab = this.brainLoader.vocab;
    const vocabCount = vocab.length;
    const isEdge = tierKey === 'tier3_edge' || tierKey === 'edge';
    const targetDim = isEdge ? 16 : 64;

    // Header: magic (4B), vocabCount (4B), targetDim (4B), isQuantized (4B)
    const headerBytes = 16;
    let dataBytes = 0;

    if (isEdge) {
      // INT8 quantized anchors: 1 byte per dimension
      dataBytes = vocabCount * targetDim;
    } else {
      // Float32 anchors: 4 bytes per dimension
      dataBytes = vocabCount * targetDim * 4;
    }

    const pkg = Buffer.alloc(headerBytes + dataBytes);
    pkg.writeUInt32LE(RWT_MAGIC, 0);
    pkg.writeUInt32LE(vocabCount, 4);
    pkg.writeUInt32LE(targetDim, 8);
    pkg.writeUInt32LE(isEdge ? 1 : 0, 12); // 1 = INT8 quantized, 0 = Float32

    let offset = headerBytes;
    for (let v = 0; v < vocabCount; v++) {
      // Source 512D vector from teacher
      const teacherVec = new Float32Array(512);
      const rowOffset = v * 512;
      for (let d = 0; d < 512; d++) {
        teacherVec[d] = this.brainLoader.projectionMatrix[rowOffset + d];
      }

      const vec64 = this.project512to64(teacherVec);

      if (isEdge) {
        const vec16 = this.project64to16(vec64);
        // Quantize float [-1.0, 1.0] to signed INT8 [-127, 127]
        for (let d = 0; d < 16; d++) {
          const clamped = Math.max(-1.0, Math.min(1.0, vec16[d]));
          const q8 = Math.round(clamped * 127);
          pkg.writeInt8(q8, offset++);
        }
      } else {
        // Float32 for Appliance
        for (let d = 0; d < 64; d++) {
          pkg.writeFloatLE(vec64[d], offset);
          offset += 4;
        }
      }
    }

    this.distilledAnchors.set(tierKey, pkg);

    // Save to disk cache
    try {
      const targetFile = path.join(this.distilledDir, `cinema-distilled-${targetDim}d.rwt`);
      fs.writeFileSync(targetFile, pkg);
    } catch {}

    this.emit('DISTILLATION_COMPLETE', { tierKey, targetDim, bytes: pkg.length });
    return pkg;
  }

  /**
   * Returns binary distilled weight buffer for the requested tier.
   */
  getDistilledBuffer(tierKey = 'tier3_edge') {
    if (this.distilledAnchors.has(tierKey)) {
      return this.distilledAnchors.get(tierKey);
    }
    return this.generateDistilledPackage(tierKey);
  }

  /**
   * Ingests anonymous engagement micro-deltas from edge devices:
   * e.g. [{ titleId, completionPct: 0.92, vibeAesthetic: 'neon_noir', deltaRating: 1.0 }]
   */
  ingestEdgeGradients(microDeltas = []) {
    if (!Array.isArray(microDeltas) || microDeltas.length === 0) return 0;

    let accepted = 0;
    for (const item of microDeltas) {
      if (item && item.titleId) {
        this.pendingGradientDeltas.push({
          titleId: String(item.titleId),
          completionPct: Number(item.completionPct) || 0,
          vibeAesthetic: item.vibeAesthetic || null,
          deltaRating: Number(item.deltaRating) || 0.5,
          timestamp: new Date().toISOString(),
        });
        accepted++;
      }
    }

    // Cap pending queue to 5000 entries
    if (this.pendingGradientDeltas.length > 5000) {
      this.pendingGradientDeltas = this.pendingGradientDeltas.slice(-5000);
    }

    // Persist deltas
    try {
      fs.writeFileSync(this.gradientDeltasFile, JSON.stringify(this.pendingGradientDeltas, null, 2));
    } catch {}

    this.emit('GRADIENTS_INGESTED', { accepted, totalPending: this.pendingGradientDeltas.length });
    return accepted;
  }

  getStatus() {
    return {
      tiers: HIERARCHICAL_TIERS,
      distilledCacheCount: this.distilledAnchors.size,
      pendingGradientDeltasCount: this.pendingGradientDeltas.length,
      gradientDeltasFile: this.gradientDeltasFile,
    };
  }
}

export const neuralDistillationService = new NeuralDistillationService();

export async function handleDistillationRoute(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  
  if (url.pathname === '/api/neural/distill') {
    const tier = url.searchParams.get('tier') || 'tier3_edge';
    const binary = url.searchParams.get('format') === 'binary';
    const pkg = neuralDistillationService.getDistilledBuffer(tier);

    if (binary) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="cinema-distilled-${tier}.rwt"`);
      res.end(pkg);
      return true;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: true,
      tier,
      bytes: pkg.length,
      magic: RWT_MAGIC,
      base64Weights: pkg.toString('base64'),
    }));
    return true;
  }

  if (url.pathname === '/api/neural/gradients' && (req.method || 'GET').toUpperCase() === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let data = {};
    try { data = JSON.parse(body || '{}'); } catch {}
    const deltas = Array.isArray(data) ? data : (data.deltas || []);
    const accepted = neuralDistillationService.ingestEdgeGradients(deltas);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, accepted }));
    return true;
  }

  return false;
}
