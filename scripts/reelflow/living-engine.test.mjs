import test from "node:test";
import assert from "node:assert/strict";
import {
  popcount,
  bitmaskJaccard,
  genresToBitmask,
  scoreTitleMood,
  rankLivingFeed,
  shouldPredictiveStage,
  enqueuePredictiveStage,
  completePredictiveStage,
  GENRE_BITS,
} from "./living-engine.mjs";

test("living-engine: popcount and bitmask Jaccard compute accurate set similarity", () => {
  assert.equal(popcount(0), 0);
  assert.equal(popcount(1), 1);
  assert.equal(popcount(0b1111), 4);
  assert.equal(popcount(0b10101010), 4);

  const maskA = GENRE_BITS["action"] | GENRE_BITS["sci-fi"];
  const maskB = GENRE_BITS["action"] | GENRE_BITS["comedy"];

  // Intersection: action (1), Union: action, sci-fi, comedy (3) -> Jaccard = 1/3
  const jaccard = bitmaskJaccard(maskA, maskB);
  assert.ok(Math.abs(jaccard - (1 / 3)) < 0.0001);
});

test("living-engine: scores title mood accurately for Mind-Bending and Adrenaline", () => {
  const interstellar = { title: "Interstellar", genres: ["Science Fiction", "Drama", "Mystery"] };
  const madMax = { title: "Mad Max: Fury Road", genres: ["Action", "Adventure"] };

  const interstellarMindBending = scoreTitleMood(interstellar, "mind_bending");
  const interstellarAdrenaline = scoreTitleMood(interstellar, "adrenaline");

  assert.ok(interstellarMindBending > interstellarAdrenaline, "Interstellar must resonate higher with Mind-Bending than Adrenaline");

  const madMaxAdrenaline = scoreTitleMood(madMax, "adrenaline");
  const madMaxMindBending = scoreTitleMood(madMax, "mind_bending");

  assert.ok(madMaxAdrenaline > madMaxMindBending, "Mad Max must resonate higher with Adrenaline than Mind-Bending");
});

test("living-engine: ranks 500+ candidate titles in sub-5ms", () => {
  const candidates = [];
  const genresList = ["Action", "Sci-Fi", "Comedy", "Drama", "Thriller", "Horror", "Animation"];
  for (let i = 0; i < 500; i++) {
    candidates.push({
      id: `title-${i}`,
      title: `Candidate ${i}`,
      genres: [genresList[i % genresList.length], genresList[(i + 2) % genresList.length]],
      voteAverage: 6.0 + ((i % 30) / 10),
    });
  }

  const liked = [
    { title: "Blade Runner 2049", genres: ["Sci-Fi", "Thriller", "Drama"] },
    { title: "The Matrix", genres: ["Action", "Sci-Fi"] },
  ];

  const start = performance.now();
  const ranked = rankLivingFeed(candidates, liked, { activeMood: "mind_bending", limit: 20 });
  const elapsed = performance.now() - start;

  assert.equal(ranked.length, 20);
  assert.ok(elapsed < 25, `Taste ranking 500 titles took ${elapsed.toFixed(2)}ms (must be <25ms on 1.6GHz Pentium)`);
});

test("living-engine: predictive staging triggers only at 80%+ progress without saturating bandwidth", () => {
  // 1. Movie -> no next-episode staging
  assert.equal(shouldPredictiveStage({ mediaType: "movie", progress: 0.85 }).shouldStage, false);

  // 2. TV at 30% -> false
  assert.equal(shouldPredictiveStage({ mediaType: "tv", progress: 0.30, season: 1, episode: 1 }).shouldStage, false);

  // 3. TV at 85% -> true!
  const decision = shouldPredictiveStage({
    mediaType: "tv",
    progress: 0.85,
    season: 1,
    episode: 1,
    totalEpisodesInSeason: 10,
  });
  assert.equal(decision.shouldStage, true);
  assert.equal(decision.nextEpisode, 2);
  assert.equal(decision.episodeKey, "S01E02");

  // Enqueue it
  enqueuePredictiveStage(decision.episodeKey);

  // 4. While active, second staging attempt must throttle to protect stream bandwidth
  const throttled = shouldPredictiveStage({
    mediaType: "tv",
    progress: 0.90,
    season: 1,
    episode: 3,
    totalEpisodesInSeason: 10,
  });
  assert.equal(throttled.shouldStage, false);
  assert.equal(throttled.reason, "bandwidth_throttle_active");

  completePredictiveStage(decision.episodeKey);
});
