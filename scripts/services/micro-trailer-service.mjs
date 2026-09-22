/**
 * Verified micro-trailer and semantic scene index.
 *
 * ReelOS may present a teaser or seek to a remembered scene only after an
 * upstream media pipeline has supplied the actual teaser bytes and a verified
 * scene map. This service deliberately does not invent media or timestamps.
 */

import { EventEmitter } from "node:events";

export class MicroTrailerService extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, { duration: number, teaserBuffer: Buffer, scenes: Array<{ label: string, timestampSec: number, verified: true }>, evidenceSource: string }>} */
    this.teaserCache = new Map();
  }

  /**
   * Registers a teaser produced by a connected media-analysis pipeline.
   * The legacy method name is retained for API compatibility.
   *
   * @param {string} titleId
   * @param {{ teaserBuffer: Buffer, durationSec: number, scenes: Array<object>, verified: true, evidenceSource: string }} asset
   */
  async generateMicroTeaser(titleId, asset) {
    if (this.teaserCache.has(titleId)) {
      const existing = this.teaserCache.get(titleId);
      return {
        ok: true,
        available: true,
        duration: existing.duration,
        sizeBytes: existing.teaserBuffer.length,
        evidenceSource: existing.evidenceSource,
      };
    }

    const scenes = Array.isArray(asset?.scenes)
      ? asset.scenes
          .filter(
            (scene) =>
              scene?.verified === true &&
              typeof scene.label === "string" &&
              scene.label.trim() &&
              Number.isFinite(Number(scene.timestampSec)) &&
              Number(scene.timestampSec) >= 0,
          )
          .map((scene) => ({
            label: scene.label.trim(),
            timestampSec: Number(scene.timestampSec),
            verified: true,
          }))
      : [];
    const duration = Number(asset?.durationSec);
    const evidenceSource = String(asset?.evidenceSource || "").trim();

    if (
      asset?.verified !== true ||
      !Buffer.isBuffer(asset?.teaserBuffer) ||
      asset.teaserBuffer.length === 0 ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      !scenes.length ||
      !evidenceSource
    ) {
      return {
        ok: false,
        available: false,
        duration: null,
        sizeBytes: 0,
        error:
          "A verified teaser asset, duration, scene map, and evidence source are required.",
      };
    }

    const teaserInfo = {
      duration,
      teaserBuffer: asset.teaserBuffer,
      scenes,
      evidenceSource,
      createdAt: Date.now(),
    };
    this.teaserCache.set(titleId, teaserInfo);
    this.emit("teaser_registered", { titleId, duration, evidenceSource });
    return {
      ok: true,
      available: true,
      duration,
      sizeBytes: asset.teaserBuffer.length,
      evidenceSource,
    };
  }

  /** Resolves a natural-language query only against a verified scene map. */
  findSceneTimestamp(titleId, query) {
    const q = String(query || "").toLowerCase().trim();
    const teaser = this.teaserCache.get(titleId);
    if (!q || !teaser?.scenes?.length) {
      return {
        ok: false,
        available: false,
        found: false,
        timestampSec: null,
        matchLabel: null,
        error: "A verified scene index is not available for this title.",
      };
    }

    const queryTerms = q.split(/\s+/).filter((term) => term.length > 2);
    const scene = teaser.scenes.find((candidate) => {
      const label = candidate.label.toLowerCase();
      return label.includes(q) || queryTerms.some((term) => label.includes(term));
    });

    if (!scene) {
      return {
        ok: true,
        available: true,
        found: false,
        timestampSec: null,
        matchLabel: null,
        evidenceSource: teaser.evidenceSource,
      };
    }

    return {
      ok: true,
      available: true,
      found: true,
      timestampSec: scene.timestampSec,
      matchLabel: scene.label,
      evidenceSource: teaser.evidenceSource,
    };
  }
}

export const microTrailerService = new MicroTrailerService();
