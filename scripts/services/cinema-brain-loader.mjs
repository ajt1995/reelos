import fs from 'node:fs';
import path from 'node:path';
import EventEmitter from 'node:events';

const DEFAULT_STATE_DIR = process.env.REELOS_STATE || (
  process.platform === 'win32'
    ? path.join(process.cwd(), '.reelos-state')
    : '/var/lib/reelos'
);

export const RWT_MAGIC = 0x52575431; // 'RWT1' in ASCII
export const MAX_LATENT_DIM = 512;

// Cinematic Semantic Vocabulary: Foundation tokens spanning genres, aesthetics, auteur vibes, and tempos
export const CINEMA_LEXICON = [
  // Aesthetic & Atmosphere
  'oled_spectacle', 'neon_noir', 'slow_burn', 'contemplative', 'visceral',
  'adrenaline', 'claustrophobic', 'mind_bender', 'fireside_comfort', 'dinner_watch',
  'bleeding_edge', 'melancholic', 'gritty', 'surreal', 'cosmic_dread', 'cerebral',
  'nostalgic', 'dreamlike', 'euphoric', 'stark', 'hypnotic', 'intimate',
  
  // Primary Genres & Movements
  'sci_fi', 'cyberpunk', 'psychological_thriller', 'crime_saga', 'space_opera',
  'criterion_classic', 'auteur_cinema', 'arthouse', 'film_noir', 'neo_noir',
  'dark_comedy', 'existential_drama', 'folk_horror', 'body_horror', 'anime_masterpiece',
  'japanese_new_wave', 'french_new_wave', 'spaghetti_western', 'dystopian', 'post_apocalyptic',

  // Sensory & Cadence Markers
  'synth_heavy', 'orchestral_crescendo', 'silence_driven', 'dialogue_rich',
  'visual_poetry', 'high_octane', 'intense_pacing', 'meditative_tempo',
  'hdr_grading', 'grain_texture', 'wide_anamorphic', 'deep_shadows'
];

/**
 * CinemaBrainLoader
 * 
 * Manages a deterministic lexicon projection used as a prototype ranking
 * baseline. It is not a trained semantic model.
 */
export class CinemaBrainLoader extends EventEmitter {
  constructor(options = {}) {
    super();
    this.stateDir = options.stateDir || DEFAULT_STATE_DIR;
    this.brainFile = path.join(this.stateDir, 'cinema-latent-brain.rwt');
    this.vocab = [...CINEMA_LEXICON];
    this.vocabMap = new Map(this.vocab.map((token, idx) => [token, idx]));
    this.latentDim = options.latentDim || MAX_LATENT_DIM;
    this.weightsBuffer = null;
    this.projectionMatrix = null; // Float32Array (vocab.length x latentDim)
    this.biasVector = null; // Float32Array (latentDim)
    this.isLoaded = false;
  }

  ensureStateDir() {
    try {
      if (!fs.existsSync(this.stateDir)) {
        fs.mkdirSync(this.stateDir, { recursive: true });
      }
    } catch {}
  }

  /**
   * Generates deterministic orthogonal-like pseudo-random weights for the cinematic vocabulary.
   * Seeded mathematically per token index so generation is 100% reproducible.
   */
  generateBaselineWeights() {
    const vocabSize = this.vocab.length;
    const totalWeights = vocabSize * this.latentDim;
    const matrix = new Float32Array(totalWeights);
    const bias = new Float32Array(this.latentDim);

    for (let v = 0; v < vocabSize; v++) {
      let norm = 0;
      const offset = v * this.latentDim;
      for (let d = 0; d < this.latentDim; d++) {
        // High-frequency harmonic distribution
        const val = Math.sin((v + 1) * 31.17 + (d + 1) * 17.31) * Math.cos((v + 1) * (d + 1) * 0.13);
        matrix[offset + d] = val;
        norm += val * val;
      }
      norm = Math.sqrt(norm) || 1.0;
      for (let d = 0; d < this.latentDim; d++) {
        matrix[offset + d] /= norm;
      }
    }

    for (let d = 0; d < this.latentDim; d++) {
      bias[d] = Math.sin((d + 1) * 7.11) * 0.05;
    }

    return { matrix, bias };
  }

  /**
   * Initializes or loads the binary .rwt weight file into physical memory.
   */
  initBrain() {
    this.ensureStateDir();

    if (fs.existsSync(this.brainFile)) {
      try {
        const raw = fs.readFileSync(this.brainFile);
        if (raw.length >= 16) {
          const magic = raw.readUInt32LE(0);
          if (magic === RWT_MAGIC) {
            const vocabCount = raw.readUInt32LE(4);
            const dim = raw.readUInt32LE(8);
            const matrixBytes = vocabCount * dim * 4;
            const biasBytes = dim * 4;

            if (raw.length >= 16 + matrixBytes + biasBytes) {
              this.latentDim = dim;
              this.weightsBuffer = raw;
              this.projectionMatrix = new Float32Array(raw.buffer, raw.byteOffset + 16, vocabCount * dim);
              this.biasVector = new Float32Array(raw.buffer, raw.byteOffset + 16 + matrixBytes, dim);
              this.isLoaded = true;
              this.emit('BRAIN_LOADED', { source: 'disk', vocabCount, dim });
              return true;
            }
          }
        }
      } catch (e) {
        // Fall back to regeneration
      }
    }

    // Generate and persist
    const { matrix, bias } = this.generateBaselineWeights();
    this.projectionMatrix = matrix;
    this.biasVector = bias;

    const vocabCount = this.vocab.length;
    const matrixBytes = vocabCount * this.latentDim * 4;
    const biasBytes = this.latentDim * 4;
    const totalBytes = 16 + matrixBytes + biasBytes;

    const buffer = Buffer.alloc(totalBytes);
    buffer.writeUInt32LE(RWT_MAGIC, 0);
    buffer.writeUInt32LE(vocabCount, 4);
    buffer.writeUInt32LE(this.latentDim, 8);
    buffer.writeUInt32LE(0, 12); // flags / reserved

    const matrixView = new Uint8Array(matrix.buffer, matrix.byteOffset, matrix.byteLength);
    buffer.set(matrixView, 16);

    const biasView = new Uint8Array(bias.buffer, bias.byteOffset, bias.byteLength);
    buffer.set(biasView, 16 + matrixBytes);

    this.weightsBuffer = buffer;
    this.isLoaded = true;

    try {
      fs.writeFileSync(this.brainFile, buffer);
    } catch {}

    this.emit('BRAIN_LOADED', { source: 'synthesized', vocabCount, dim: this.latentDim });
    return true;
  }

  /**
   * Encodes cinema text into a dense latent embedding vector of specified dimension.
   * Matches semantic tokens against the lexicon, applies projection and GELU activation,
   * then truncates/pools to the requested target dimension.
   * 
   * @param {string} text 
   * @param {number} targetDim 
   * @returns {Float32Array} L2-normalized dense embedding
   */
  encodeTextToLatent(text, targetDim = this.latentDim) {
    if (!this.isLoaded) {
      this.initBrain();
    }

    const effectiveDim = Math.min(targetDim, this.latentDim);
    const result = new Float32Array(effectiveDim);
    const tokens = String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    if (tokens.length === 0) {
      return result;
    }

    let matches = 0;
    for (const tok of tokens) {
      // Direct vocabulary match or partial substring match
      for (let v = 0; v < this.vocab.length; v++) {
        const lexiconWord = this.vocab[v];
        if (lexiconWord === tok || lexiconWord.includes(tok) || tok.includes(lexiconWord)) {
          const offset = v * this.latentDim;
          for (let d = 0; d < effectiveDim; d++) {
            result[d] += this.projectionMatrix[offset + d];
          }
          matches++;
          break;
        }
      }
    }

    // Fallback subword harmonic projection for unmatched tokens
    if (matches === 0) {
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        for (let j = 0; j < t.length; j++) {
          const c = t.charCodeAt(j);
          const idx = (c * 31 + j) % effectiveDim;
          result[idx] += 1.0 / (1.0 + Math.exp(-((c % 10) - 5)));
        }
      }
    }

    // Add bias & apply GELU non-linearity: 0.5 * x * (1 + tanh(sqrt(2/pi) * (x + 0.044715 * x^3)))
    const sqrt2OverPi = 0.7978845608;
    for (let d = 0; d < effectiveDim; d++) {
      const x = result[d] + (this.biasVector ? this.biasVector[d] : 0);
      const inner = sqrt2OverPi * (x + 0.044715 * x * x * x);
      result[d] = 0.5 * x * (1.0 + Math.tanh(inner));
    }

    // L2 Normalize
    let norm = 0;
    for (let d = 0; d < effectiveDim; d++) norm += result[d] * result[d];
    norm = Math.sqrt(norm) || 1.0;
    for (let d = 0; d < effectiveDim; d++) result[d] /= norm;

    return result;
  }

  getStats() {
    return {
      isLoaded: this.isLoaded,
      modelType: 'deterministic-lexicon-projection',
      trained: false,
      semanticModel: false,
      vocabCount: this.vocab.length,
      latentDim: this.latentDim,
      brainFile: this.brainFile,
      bufferBytes: this.weightsBuffer ? this.weightsBuffer.byteLength : 0,
      bufferMb: this.weightsBuffer ? Math.round((this.weightsBuffer.byteLength / (1024 * 1024)) * 100) / 100 : 0,
    };
  }
}

export const cinemaBrainLoader = new CinemaBrainLoader();
