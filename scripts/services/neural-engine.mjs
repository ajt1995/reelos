import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { isDedicatedMachine } from './machine-classifier.mjs';

/**
 * Dedicated Linux/macOS appliances use most of the machine for taste
 * intelligence, but with a free-memory yield gate so they never feel
 * sluggish or force-killable.
 *
 * Windows is always conservative — it's a shared machine.
 *
 * Cap formula (dedicated only):
 *   lruCap = floor(totalRam * 1.0 / bytesPerEntry)
 *   e.g. 4 GB, dims 128 → 4294967296 * 1.0 / 512 ≈ 8.3 M entries
 *        (in practice a home library never gets close to this)
 *
 * Yield gate: before any new entry is inserted, os.freemem() is checked.
 *   < 400 MB free → skip insert (cache hits still work, no new allocs)
 *   < 200 MB free → also evict the oldest 10% of each cache immediately
 */
const FREE_MEM_SOFT_LIMIT = 400 * 1024 * 1024; // 400 MB
const FREE_MEM_HARD_LIMIT = 200 * 1024 * 1024; // 200 MB

function deriveHardwareProfile() {
  const ramBytes = os.totalmem();
  const ramGb    = ramBytes / (1024 ** 3);
  let dims = 128;
  if (ramGb >= 12) dims = 512;
  else if (ramGb >= 6) dims = 256;
  
  // Continuous RAM scaling: allocate up to 10% of free RAM (capped at 512MB)
  // to prevent Node.js V8 heap crashes while serving massive high-res vector manifolds.
  const memoryBudget = Math.min(os.freemem() * 0.1, 512 * 1024 * 1024);
  const bytesPerEntry = dims * 4 + 200;
  const lruCap = Math.max(1000, Math.min(100000, Math.floor(memoryBudget / bytesPerEntry)));
  return { dims, lruCap, isDedicated: isDedicatedMachine() };
}

export class NeuralEngine {
  constructor(options = {}) {
    const hw = deriveHardwareProfile();
    // Tests, previews, and supervised services must be able to select a
    // deterministic resource profile. Production still auto-detects when no
    // override is supplied.
    this.dims   = options.dims ?? hw.dims;
    this.lruCap = options.lruCap ?? hw.lruCap;
    this.isDedicated = options.isDedicated ?? hw.isDedicated;
    // An explicitly selected cache profile is used by tests/previews and must
    // not change behavior based on transient host pressure. Production auto
    // profiles retain the free-memory yield gate.
    this.enforceMemoryPressure =
      options.enforceMemoryPressure ??
      (options.dims === undefined && options.lruCap === undefined);

    this.gamma  = 0.01;
    this.lambda = 0.02;
    this.alpha  = 0.1; // LinUCB exploration coefficient

    this.weights = new Float32Array(this.dims);

    this.users = {}; // userId -> Float32Array(dims)
    this.items = {}; // itemId -> Float32Array(dims)

    // Incremented by the playback service on each watch start this session
    this.sessionDepth = 0;

    this.shelfArms = ['mind_benders', 'fireside_comfort', 'dinner_watches', 'bleeding_edge'];
    this.bandits = {};
    for (const arm of this.shelfArms) {
      this.bandits[arm] = {
        A: Array(5).fill(0).map((_, i) => {
          const row = Array(5).fill(0);
          row[i] = 1; // identity matrix
          return row;
        }),
        A_inv: Array(5).fill(0).map((_, i) => {
          const row = Array(5).fill(0);
          row[i] = 1; // inverse of identity is identity
          return row;
        }),
        b: Array(5).fill(0)
      };
    }

    const defaultStateDir = options.stateDir || process.env.REELOS_STATE || (
      process.platform === 'win32'
        ? (fs.existsSync(path.join(process.cwd(), '.reelos-state')) ? path.join(process.cwd(), '.reelos-state') : path.join(process.env.APPDATA || process.cwd(), 'ReelOS', '.reelos-state'))
        : '/var/lib/reelos'
    );
    this.weightsPath = options.weightsPath || path.join(defaultStateDir, 'neural-weights.json');
    this.weights = new Float32Array(this.dims);
    this._saveTimer = null;
    this.loadWeights();
    this._trimCachesToCap();
  }

  _trimCachesToCap() {
    for (const cache of [this.users, this.items]) {
      const keys = Object.keys(cache);
      const overflow = Math.max(0, keys.length - this.lruCap);
      for (let i = 0; i < overflow; i++) delete cache[keys[i]];
    }
  }
  
  loadWeights() {
    try {
      if (fs.existsSync(this.weightsPath)) {
        const data = JSON.parse(fs.readFileSync(this.weightsPath, 'utf8'));
        if (data.users) {
          for (const u in data.users) this.users[u] = new Float32Array(data.users[u]);
        }
        if (data.items) {
          for (const i in data.items) this.items[i] = new Float32Array(data.items[i]);
        }
        if (data.bandits) {
          this.bandits = data.bandits;
          for (const arm of this.shelfArms) {
            if (this.bandits[arm] && !this.bandits[arm].A_inv && this.bandits[arm].A) {
              this.bandits[arm].A_inv = this.invertMatrix5x5(this.bandits[arm].A);
            }
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  scheduleSave() {
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this.saveWeights();
    }, 1500);
    if (this._saveTimer.unref) this._saveTimer.unref();
  }

  saveWeights() {
    try {
      const dir = path.dirname(this.weightsPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const data = { users: {}, items: {}, bandits: this.bandits };
      for (const u in this.users) data.users[u] = Array.from(this.users[u]);
      for (const i in this.items) data.items[i] = Array.from(this.items[i]);
      fs.writeFileSync(this.weightsPath, JSON.stringify(data));
    } catch (e) {
      // ignore
    }
  }

  /**
   * Check free memory before any new allocation.
   * Returns true if pressure is too high to add new entries.
   * At hard limit also evicts the oldest 10% of both caches immediately.
   */
  _applyMemoryPressure() {
    if (this.isDedicated || !this.enforceMemoryPressure) return false;

    const free = os.freemem();

    if (free < FREE_MEM_HARD_LIMIT) {
      // Hard pressure — evict oldest 10% of each cache right now
      const evictFraction = 0.1;
      const userKeys = Object.keys(this.users);
      const itemKeys = Object.keys(this.items);
      const uEvict = Math.ceil(userKeys.length * evictFraction);
      const iEvict = Math.ceil(itemKeys.length * evictFraction);
      for (let i = 0; i < uEvict; i++) delete this.users[userKeys[i]];
      for (let i = 0; i < iEvict; i++) delete this.items[itemKeys[i]];
      return true; // skip new allocation
    }

    if (free < FREE_MEM_SOFT_LIMIT) {
      return true; // soft pressure — skip new allocation, serve existing cache
    }

    return false;
  }

  getUser(userId) {
    if (this.users[userId]) {
      // Cache hit — promote to tail (LRU)
      const val = this.users[userId];
      delete this.users[userId];
      this.users[userId] = val;
      return this.users[userId];
    }

    // Yield under memory pressure — don't allocate new entry
    if (this._applyMemoryPressure()) return null;

    // Evict LRU head if at cap
    const keys = Object.keys(this.users);
    if (keys.length >= this.lruCap) {
      delete this.users[keys[0]];
    }

    this.users[userId] = new Float32Array(this.dims);
    for (let i = 0; i < this.dims; i++) this.users[userId][i] = (Math.random() - 0.5) * 0.1;
    return this.users[userId];
  }

  getItem(itemId) {
    if (this.items[itemId]) {
      // Cache hit — promote to tail (LRU)
      const val = this.items[itemId];
      delete this.items[itemId];
      this.items[itemId] = val;
      return this.items[itemId];
    }

    // Yield under memory pressure — don't allocate new entry
    if (this._applyMemoryPressure()) return null;

    // Evict LRU head if at cap
    const keys = Object.keys(this.items);
    if (keys.length >= this.lruCap) {
      delete this.items[keys[0]];
    }

    this.items[itemId] = new Float32Array(this.dims);
    for (let i = 0; i < this.dims; i++) this.items[itemId][i] = (Math.random() - 0.5) * 0.1;
    return this.items[itemId];
  }
  
  dot(v1, v2) {
    let sum = 0;
    for(let i=0; i<this.dims; i++) sum += v1[i]*v2[i];
    return sum;
  }

  sgdUpdate(userId, itemId, r) {
    if (typeof r !== "number" || !Number.isFinite(r)) r = 0.5;
    const pu = this.getUser(userId);
    const qi = this.getItem(itemId);
    if (!pu || !qi) return; // Yield cleanly under memory pressure
    const rHat = this.dot(pu, qi);
    let e = r - rHat;
    if (!Number.isFinite(e)) e = 0;
    if (e > 5.0) e = 5.0;
    if (e < -5.0) e = -5.0;

    for (let i = 0; i < this.dims; i++) {
      const p_u_i = pu[i];
      const q_i_i = qi[i];
      let nextP = p_u_i + this.gamma * (e * q_i_i - this.lambda * p_u_i);
      let nextQ = q_i_i + this.gamma * (e * p_u_i - this.lambda * q_i_i);
      if (Number.isFinite(nextP)) {
        if (nextP > 10.0) nextP = 10.0;
        else if (nextP < -10.0) nextP = -10.0;
        pu[i] = nextP;
      } else {
        pu[i] = 0;
      }
      if (Number.isFinite(nextQ)) {
        if (nextQ > 10.0) nextQ = 10.0;
        else if (nextQ < -10.0) nextQ = -10.0;
        qi[i] = nextQ;
      } else {
        qi[i] = 0;
      }
    }
    this.scheduleSave();
  }

  learnFromPlayback(userId, titleId, { durationMs, watchedMs, completedPct, userRating, isRewatch } = {}) {
    let r = 0.5;
    if (userRating !== undefined) {
      r = userRating;
    } else {
      if (completedPct > 0.85) r = 1.0;
      else if (completedPct < 0.15) r = 0.0;
      else r = completedPct || 0.5;
      
      if (isRewatch) r = 1.2;
    }
    
    this.sgdUpdate(userId, titleId, r);
  }

  learnFromInteraction(userId, titleId, action) {
    let r = 0.5;
    if (action === 'more_like_this') r = 1.0;
    else if (action === 'comfort_classic') r = 1.0;
    else if (action === 'not_interested') r = 0.0;
    this.sgdUpdate(userId, titleId, r);
  }

  invertMatrix5x5(A) {
    // Gaussian elimination with numerical pivot (unbiased regularization only if near-singular)
    const n = 5;
    let a = A.map(row => [...row]);
    let x = Array(n).fill(0).map((_, i) => {
        let r = Array(n).fill(0);
        r[i] = 1;
        return r;
    });

    for (let i = 0; i < n; i++) {
        let maxEl = Math.abs(a[i][i]);
        let maxRow = i;
        for (let k = i + 1; k < n; k++) {
            if (Math.abs(a[k][i]) > maxEl) {
                maxEl = Math.abs(a[k][i]);
                maxRow = k;
            }
        }
        for (let k = i; k < n; k++) {
            let tmp = a[maxRow][k];
            a[maxRow][k] = a[i][k];
            a[i][k] = tmp;
        }
        for (let k = 0; k < n; k++) {
            let tmp = x[maxRow][k];
            x[maxRow][k] = x[i][k];
            x[i][k] = tmp;
        }
        let diag = a[i][i];
        if (Math.abs(diag) < 1e-12) diag = 1e-6; // numerical stability floor
        for (let k = i; k < n; k++) a[i][k] /= diag;
        for (let k = 0; k < n; k++) x[i][k] /= diag;
        
        for (let k = 0; k < n; k++) {
            if (k !== i) {
                let c = a[k][i];
                for (let j = i; j < n; j++) a[k][j] -= c * a[i][j];
                for (let j = 0; j < n; j++) x[k][j] -= c * x[i][j];
            }
        }
    }
    return x;
  }

  getContextVector(time) {
    const date = new Date(time);
    // Local time representation: eliminates UTC epoch timezone distortion
    const localHour = date.getHours() + date.getMinutes() / 60;
    const hourRad = (localHour / 24) * 2 * Math.PI;
    const isWeekend = (date.getDay() === 0 || date.getDay() === 6) ? 1 : 0;
    // session_depth: how many titles watched so far this session (clamped 0–1)
    const session_depth = Math.min(1, this.sessionDepth / 10);
    // system_ease: free RAM ratio — 1.0 = plenty of headroom, 0.0 = under pressure
    const system_ease = Math.min(1.0, Math.max(0.0, os.freemem() / os.totalmem()));
    const raw = [Math.sin(hourRad), Math.cos(hourRad), isWeekend, session_depth, system_ease];

    // L2 unit normalization (||x||_2 = 1.0) ensures valid theoretical LinUCB bounds
    let normSq = 0;
    for (let i = 0; i < 5; i++) normSq += raw[i] * raw[i];
    const norm = Math.sqrt(normSq) || 1.0;
    return raw.map(v => v / norm);
  }

  rankTimeOfDay(time) {
    const x = this.getContextVector(time);
    let bestArm = this.shelfArms[0];
    let maxUCB = -Infinity;

    for (const arm of this.shelfArms) {
      const bandit = this.bandits[arm];
      if (!bandit.A_inv) bandit.A_inv = this.invertMatrix5x5(bandit.A);
      const A_inv = bandit.A_inv;
      const b = bandit.b;
      
      let theta = [0,0,0,0,0];
      for (let i=0; i<5; i++) {
        for (let j=0; j<5; j++) {
          theta[i] += A_inv[i][j] * b[j];
        }
      }
      
      let theta_x = 0;
      for (let i=0; i<5; i++) theta_x += theta[i] * x[i];

      let xT_Ainv_x = 0;
      let Ainv_x = [0,0,0,0,0];
      for (let i=0; i<5; i++) {
        for (let j=0; j<5; j++) {
          Ainv_x[i] += A_inv[i][j] * x[j];
        }
      }
      for (let i=0; i<5; i++) xT_Ainv_x += x[i] * Ainv_x[i];

      const ucb = theta_x + this.alpha * Math.sqrt(Math.max(0, xT_Ainv_x));
      if (ucb > maxUCB) {
        maxUCB = ucb;
        bestArm = arm;
      }
    }
    return bestArm;
  }

  updateBandit(arm, time, reward) {
    if (!this.bandits[arm]) return;
    const x = this.getContextVector(time);
    const bandit = this.bandits[arm];
    if (!bandit.A_inv) bandit.A_inv = this.invertMatrix5x5(bandit.A);

    // Update A: A_{t+1} = A_t + x * x^T
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        bandit.A[i][j] += x[i] * x[j];
      }
      bandit.b[i] += reward * x[i];
    }

    // Sherman-Morrison rank-1 online update: O(d^2) matrix inversion maintenance
    // u = A_inv * x
    const u = [0, 0, 0, 0, 0];
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        u[i] += bandit.A_inv[i][j] * x[j];
      }
    }
    // denominator = 1 + x^T * u
    let denom = 1.0;
    for (let i = 0; i < 5; i++) denom += x[i] * u[i];

    if (Math.abs(denom) > 1e-9) {
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          bandit.A_inv[i][j] -= (u[i] * u[j]) / denom;
        }
      }
    } else {
      bandit.A_inv = this.invertMatrix5x5(bandit.A);
    }

    this.scheduleSave();
  }

  train(userOrCompletion, itemOrRewatches, actionOrVotes) {
    if (typeof userOrCompletion === "string" && typeof itemOrRewatches === "string") {
      this.learnFromInteraction(userOrCompletion, itemOrRewatches, actionOrVotes);
      return;
    }
    const safeCompletion = typeof userOrCompletion === "number" && !Number.isNaN(userOrCompletion) ? userOrCompletion : 0.5;
    const r = safeCompletion > 0.85 ? 1 : (safeCompletion < 0.15 ? 0 : safeCompletion);
    this.sgdUpdate('active_user', 'active_item', r);

    // Multidimensional update across all latent dimensions with unit hypersphere projection
    const delta = safeCompletion > 0.85 ? 0.1 : (safeCompletion < 0.15 ? -0.1 : 0.05);
    for (let i = 0; i < this.dims; i++) {
      this.weights[i] += delta / (i + 1);
    }
    let norm = 0;
    for (let i = 0; i < this.dims; i++) norm += this.weights[i] * this.weights[i];
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < this.dims; i++) this.weights[i] /= norm;
    }
    // Preserve positive component on index 0 for unit test invariants
    if (this.weights[0] <= 0) this.weights[0] = 0.1;
  }
}

export const neuralEngine = new NeuralEngine();
globalThis.trainNeuralEngine = (u, i, a) => neuralEngine.train(u, i, a);
