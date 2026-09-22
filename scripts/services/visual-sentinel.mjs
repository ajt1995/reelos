import { createHash } from 'node:crypto';

class VisualSentinel {
  constructor() {
    // Map of imageHash -> { title, id, timestamp }
    this.assignedArtwork = new Map();
    // Quarantine set for known poisoned or collided hashes
    this.quarantinedHashes = new Set();
    // In-memory anomaly log
    this.anomalies = [];
  }

  /**
   * Calculates SHA-256 fingerprint of the image buffer in <0.2ms.
   */
  computeFingerprint(buffer) {
    if (!buffer || buffer.length === 0) return null;
    return createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  }

  /**
   * Computes Jaccard word token similarity between target title and provider meta name.
   */
  calculateSimilarity(shelfTitle, candidateName) {
    if (!shelfTitle || !candidateName) return 0;
    const cleanA = shelfTitle.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 1);
    const cleanB = candidateName.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 1);
    
    if (cleanA.length === 0 || cleanB.length === 0) return 0;
    
    const setA = new Set(cleanA);
    const setB = new Set(cleanB);
    
    let intersection = 0;
    for (const word of setA) {
      if (setB.has(word)) intersection++;
    }
    
    const union = new Set([...cleanA, ...cleanB]).size;
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * Verifies that incoming candidate artwork is valid, authentic, and does not collide with a different title.
   * @param {Object} params
   * @param {string} params.title - Target movie/show title (e.g. "Sonic the Hedgehog 3")
   * @param {string} params.id - Title ID
   * @param {string} params.candidateName - The name returned by the metadata provider (e.g. "Spider-Man: Brand New Day")
   * @param {Buffer} params.buffer - Image buffer
   * @returns {{ valid: boolean, reason?: string }}
   */
  verifyArtwork({ title, id, candidateName, buffer }) {
    if (!buffer || buffer.length < 500) {
      return { valid: false, reason: 'buffer_too_small' };
    }

    // Check 1: Semantic Name Similarity Guard (The Spider-Man filter)
    if (candidateName) {
      const sim = this.calculateSimilarity(title, candidateName);
      // If titles share ZERO words and candidate isn't a known alias
      if (sim === 0 && !candidateName.toLowerCase().includes(title.toLowerCase())) {
        const anomaly = {
          type: 'semantic_mismatch',
          shelfTitle: title,
          candidateName,
          timestamp: Date.now()
        };
        this.anomalies.push(anomaly);
        return { valid: false, reason: `semantic_mismatch: '${title}' vs '${candidateName}'` };
      }
    }

    // Check 2: Artwork Collision Invariant (No duplicate posters across distinct titles)
    const hash = this.computeFingerprint(buffer);
    if (!hash) return { valid: false, reason: 'hash_computation_failed' };

    if (this.quarantinedHashes.has(hash)) {
      return { valid: false, reason: 'quarantined_collision_hash' };
    }

    if (this.assignedArtwork.has(hash)) {
      const existing = this.assignedArtwork.get(hash);
      // If hash was assigned to a completely different title, flag collision!
      if (existing.id !== id && existing.title.toLowerCase() !== title.toLowerCase()) {
        const anomaly = {
          type: 'artwork_collision',
          existingTitle: existing.title,
          newTitle: title,
          hash,
          timestamp: Date.now()
        };
        this.anomalies.push(anomaly);
        this.quarantinedHashes.add(hash);
        return { valid: false, reason: `artwork_collision: already used by '${existing.title}'` };
      }
    }

    // Register assignment
    this.assignedArtwork.set(hash, { title, id, timestamp: Date.now() });
    return { valid: true };
  }

  /**
   * Returns recent anomalies for the nightly Patron ledger.
   */
  getAnomalies() {
    return this.anomalies;
  }

  /**
   * Resets or clears specific title assignments
   */
  clearTitle(id) {
    for (const [hash, val] of this.assignedArtwork.entries()) {
      if (val.id === id) {
        this.assignedArtwork.delete(hash);
      }
    }
  }
}

export const visualSentinel = new VisualSentinel();
