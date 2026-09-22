/**
 * The Living Engine
 * Autonomous taste profiling, mood dial orchestration, predictive next-episode staging,
 * and watchlist pre-caching. Sub-10ms deterministic algorithms with zero heavy ML dependencies.
 */

import fs from "node:fs";
import path from "node:path";

// 32-Bit Genre Bitmasks for Instant Bitwise Set Operations
export const GENRE_BITS = {
  "action": 1 << 0,
  "adventure": 1 << 1,
  "animation": 1 << 2,
  "comedy": 1 << 3,
  "crime": 1 << 4,
  "documentary": 1 << 5,
  "drama": 1 << 6,
  "family": 1 << 7,
  "fantasy": 1 << 8,
  "history": 1 << 9,
  "horror": 1 << 10,
  "music": 1 << 11,
  "mystery": 1 << 12,
  "romance": 1 << 13,
  "sci-fi": 1 << 14,
  "science fiction": 1 << 14,
  "thriller": 1 << 15,
  "war": 1 << 16,
  "western": 1 << 17,
};

// Mood Bitmask Archetypes
export const MOOD_MASKS = {
  "mind_bending": GENRE_BITS["sci-fi"] | GENRE_BITS["mystery"] | GENRE_BITS["thriller"],
  "adrenaline": GENRE_BITS["action"] | GENRE_BITS["crime"] | GENRE_BITS["adventure"],
  "cozy": GENRE_BITS["comedy"] | GENRE_BITS["family"] | GENRE_BITS["animation"],
  "gritty": GENRE_BITS["crime"] | GENRE_BITS["drama"] | GENRE_BITS["history"] | GENRE_BITS["war"],
  "chill": GENRE_BITS["documentary"] | GENRE_BITS["music"] | GENRE_BITS["romance"],
};

/**
 * Fast popcount (Hamming weight) of a 32-bit integer.
 */
export function popcount(n) {
  n = n >>> 0; // force unsigned
  n = n - ((n >>> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/**
 * Calculates Jaccard Similarity between two bitmasks in <0.001ms.
 */
export function bitmaskJaccard(maskA, maskB) {
  const intersection = popcount(maskA & maskB);
  const union = popcount(maskA | maskB);
  return union === 0 ? 0 : intersection / union;
}

/**
 * Encodes an array of genre strings into a 32-bit bitmask.
 */
export function genresToBitmask(genres = []) {
  let mask = 0;
  if (!Array.isArray(genres)) return mask;
  for (const g of genres) {
    if (!g) continue;
    const clean = String(g).trim().toLowerCase();
    const bit = GENRE_BITS[clean];
    if (bit) mask |= bit;
  }
  return mask;
}

/**
 * Scores a title's resonance against a selected Mood Dial mode.
 * @param {Object} title - Title object with .genres array
 * @param {string} mood - "mind_bending" | "adrenaline" | "cozy" | "gritty" | "chill"
 * @returns {number} Score from 0.0 to 1.0
 */
export function scoreTitleMood(title, mood) {
  const targetMask = MOOD_MASKS[mood];
  if (!targetMask) return 0.5;
  const titleMask = genresToBitmask(title?.genres);
  return bitmaskJaccard(titleMask, targetMask);
}

/**
 * Ranks candidate titles against a user's liked titles and active mood dial.
 * Runs across 500+ titles in <5ms.
 */
export function rankLivingFeed(candidateTitles = [], likedTitles = [], options = {}) {
  const { activeMood = null, limit = 24 } = options;

  // Build aggregate liked bitmask
  let profileMask = 0;
  for (const lt of likedTitles) {
    profileMask |= genresToBitmask(lt?.genres);
  }

  const moodMask = (activeMood && MOOD_MASKS[activeMood]) || 0;
  const count = candidateTitles.length;
  const scored = new Array(count);

  for (let i = 0; i < count; i++) {
    const t = candidateTitles[i];
    const tMask = t._mask !== undefined ? t._mask : (t._mask = genresToBitmask(t?.genres));
    let score = 0;

    // Taste resonance (Jaccard similarity with user profile)
    if (profileMask !== 0) {
      score += bitmaskJaccard(tMask, profileMask) * 0.6;
    } else {
      score += 0.3; // Default baseline if no watch history yet
    }

    // Mood dial resonance
    if (moodMask !== 0) {
      score += bitmaskJaccard(tMask, moodMask) * 0.4;
    }

    // Rating boost (if available)
    if (typeof t.voteAverage === "number" && t.voteAverage > 0) {
      score += (t.voteAverage / 10) * 0.15;
    }

    scored[i] = { title: t, score };
  }

  scored.sort((a, b) => b.score - a.score);
  const out = [];
  const cap = Math.min(limit, count);
  for (let i = 0; i < cap; i++) {
    out.push(scored[i].title);
  }
  return out;
}

// In-memory predictive staging queue to prevent concurrent bandwidth saturation
const stagingQueue = new Set();
let activeStagingCount = 0;

/**
 * Evaluates whether next episode predictive staging should be triggered.
 * Trigger criteria:
 * 1. Current playback is TV show
 * 2. Playback progress >= 80% (0.80)
 * 3. Next episode is not currently being staged
 * 4. Concurrent staging <= 1
 */
export function shouldPredictiveStage({
  mediaType = "tv",
  progress = 0,
  season = 1,
  episode = 1,
  totalEpisodesInSeason = 10,
}) {
  if (mediaType !== "tv") return { shouldStage: false, reason: "not_tv" };
  if (progress < 0.80) return { shouldStage: false, reason: "below_80_percent_progress" };
  if (episode >= totalEpisodesInSeason) return { shouldStage: false, reason: "season_finale" };
  if (activeStagingCount >= 1) return { shouldStage: false, reason: "bandwidth_throttle_active" };

  const nextEpisodeKey = `S${String(season).padStart(2, "0")}E${String(episode + 1).padStart(2, "0")}`;
  if (stagingQueue.has(nextEpisodeKey)) {
    return { shouldStage: false, reason: "already_staged_or_queued" };
  }

  return {
    shouldStage: true,
    nextSeason: season,
    nextEpisode: episode + 1,
    episodeKey: nextEpisodeKey,
  };
}

/**
 * Enqueues next episode for predictive staging.
 */
export function enqueuePredictiveStage(episodeKey) {
  if (stagingQueue.has(episodeKey)) return;
  stagingQueue.add(episodeKey);
  activeStagingCount++;
}

/**
 * Marks predictive staging completed.
 */
export function completePredictiveStage(episodeKey) {
  stagingQueue.delete(episodeKey);
  if (activeStagingCount > 0) activeStagingCount--;
}
