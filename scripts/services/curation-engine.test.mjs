import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  scoreMediaItem,
  matchCrossMediaBridge,
  curateFeed,
  recordTasteInteraction,
} from "./curation-engine.mjs";

describe("ReelEngine Curation Algorithm", () => {
  it("scores media according to media priorities (movies vs tv vs books)", () => {
    const movieProfile = {
      mediaPriorities: { movies: 100, tv: 20, books: 10 },
      tasteVibe: "balanced",
    };
    const bookProfile = {
      mediaPriorities: { movies: 10, tv: 20, books: 100 },
      tasteVibe: "balanced",
    };

    const movieItem = { id: "m1", title: "Interstellar", mediaType: "movies", rating: 8.7 };
    const bookItem = { id: "b1", title: "Dune", author: "Frank Herbert", mediaType: "books", rating: 8.7 };

    const movieScoreForMovieFan = scoreMediaItem(movieItem, movieProfile);
    const movieScoreForBookworm = scoreMediaItem(movieItem, bookProfile);
    assert.ok(movieScoreForMovieFan > movieScoreForBookworm);

    const bookScoreForBookworm = scoreMediaItem(bookItem, bookProfile);
    const bookScoreForMovieFan = scoreMediaItem(bookItem, movieProfile);
    assert.ok(bookScoreForBookworm > bookScoreForMovieFan);
  });

  it("applies bleeding edge archetype recency boost", () => {
    const currentYear = new Date().getFullYear();
    const bleedingEdgeProfile = {
      tasteVibe: "bleeding_edge",
      mediaPriorities: { movies: 50, tv: 50, books: 50 },
    };
    const balancedProfile = {
      tasteVibe: "balanced",
      mediaPriorities: { movies: 50, tv: 50, books: 50 },
    };

    const newRelease = { id: "m-new", title: "Brand New 2026 Film", year: currentYear, rating: 7.5 };
    const vintageClassic = { id: "m-old", title: "1982 Classic", year: 1982, rating: 7.5 };

    const newScoreBleeding = scoreMediaItem(newRelease, bleedingEdgeProfile);
    const newScoreBalanced = scoreMediaItem(newRelease, balancedProfile);
    assert.ok(newScoreBleeding > newScoreBalanced);

    const oldScoreBleeding = scoreMediaItem(vintageClassic, bleedingEdgeProfile);
    const oldScoreBalanced = scoreMediaItem(vintageClassic, balancedProfile);
    assert.ok(oldScoreBalanced > oldScoreBleeding);
  });

  it("applies comfort archetype boost to TV procedurals and sitcoms", () => {
    const comfortProfile = {
      tasteVibe: "comfort",
      mediaPriorities: { movies: 50, tv: 80, books: 20 },
    };
    const comfortShow = {
      id: "tv-office",
      title: "The Office",
      mediaType: "tv",
      genres: ["comedy"],
      seasons: [1, 2, 3, 4, 5],
      rating: 8.5,
    };

    const score = scoreMediaItem(comfortShow, comfortProfile);
    assert.ok(score > 70);
  });

  it("detects cross-media bridges between books and movies", () => {
    const bridge1 = matchCrossMediaBridge("Dune: Part Two", "Dune", "Frank Herbert");
    assert.equal(bridge1.matched, true);
    assert.equal(bridge1.bridge.bookTitle, "Dune");

    const bridge2 = matchCrossMediaBridge("Silo", "Wool", "Hugh Howey");
    assert.equal(bridge2.matched, true);

    const noBridge = matchCrossMediaBridge("Random Movie", "Unrelated Novel", "Someone");
    assert.equal(noBridge.matched, false);
  });

  it("curates tailored feed and populates page-to-screen shelf", () => {
    const movies = [
      { id: "m1", title: "Dune", year: 2021, rating: 8.2 },
      { id: "m2", title: "Random Film", year: 2020, rating: 6.5 },
    ];
    const tv = [
      { id: "t1", title: "Silo", seasons: [1, 2], rating: 8.1 },
    ];
    const books = [
      { id: "b1", title: "Dune", author: "Frank Herbert", rating: 8.8 },
      { id: "b2", title: "Wool", author: "Hugh Howey", rating: 8.5 },
    ];

    const feed = curateFeed({ movies, tv, books }, {
      mediaPriorities: { movies: 60, tv: 60, books: 60 },
      tasteVibe: "comfort",
    });

    assert.ok(feed.personalized.length > 0);
    assert.ok(feed.pageToScreen.length > 0);
    // Verified Dune or Silo/Wool was linked on the pageToScreen shelf
    assert.ok(feed.pageToScreen.some((i) => Boolean(i.crossMediaBridge)));
    assert.ok(Array.isArray(feed.dinnerWatches));
    assert.ok(Array.isArray(feed.mindBenders));
    assert.ok(Array.isArray(feed.forgottenClassics));
  });

  it("records 1-tap taste interactions (more_like_this, not_interested, comfort_classic)", () => {
    const profile = {
      id: "res-primary",
      curationWeights: { "sci-fi": 1.0, comedy: 1.0 },
      likedIds: [],
      dislikedIds: [],
    };

    // 1. More like this
    const boosted = recordTasteInteraction({
      profile,
      titleId: "m-interstellar",
      genres: ["sci-fi"],
      action: "more_like_this",
    });
    assert.ok(boosted.curationWeights["sci-fi"] > 1.0);
    assert.ok(boosted.likedIds.includes("m-interstellar"));

    // 2. Not interested
    const suppressed = recordTasteInteraction({
      profile,
      titleId: "m-horror1",
      genres: ["horror"],
      action: "not_interested",
    });
    assert.ok(suppressed.curationWeights["horror"] < 1.0);
    assert.ok(suppressed.dislikedIds.includes("m-horror1"));

    // 3. Comfort classic
    const comfort = recordTasteInteraction({
      profile,
      titleId: "tv-friends",
      genres: ["comedy"],
      action: "comfort_classic",
    });
    assert.equal(comfort.tasteVibe, "comfort");
    assert.ok(comfort.likedIds.includes("tv-friends"));
  });

  it("prunes titles matching negative prompt vector geometry (Section 32)", () => {
    const profile = {
      mediaPriorities: { movies: 100, tv: 100, books: 50 },
      tasteVibe: "balanced",
      negativePrompts: ["cringe romcom", "torture porn", "cheap reality tv"],
    };

    const horrorGore = {
      id: "m-gore",
      title: "Hostel: Extreme Torment",
      overview: "A terrifying torture porn experience with intense suffering",
      genres: ["horror", "thriller"],
      rating: 7.5,
    };
    const romcom = {
      id: "m-romcom",
      title: "Accidentally in Love",
      overview: "A cringe romcom about two goofy singles in New York",
      genres: ["comedy", "romance"],
      rating: 7.0,
    };
    const prestigeFilm = {
      id: "m-prestige",
      title: "Oppenheimer",
      overview: "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb",
      genres: ["biography", "drama", "history"],
      rating: 8.9,
    };

    assert.equal(scoreMediaItem(horrorGore, profile), 0);
    assert.equal(scoreMediaItem(romcom, profile), 0);
    assert.ok(scoreMediaItem(prestigeFilm, profile) > 50);
  });

  it("inspects audio spectrum quality and rejects cam-rips below 8kHz cutoff", async () => {
    const { inspectAudioSpectrumQuality, scoreRelease } = await import("../reelflow/quality.mjs");

    const camRipSpectrum = inspectAudioSpectrumQuality({
      sampleRateHz: 11025,
      frequencyCutoffHz: 7500,
    });
    assert.equal(camRipSpectrum.isPoison, true);
    assert.equal(camRipSpectrum.poisonReason, "cam_audio_cutoff");

    const studioSpectrum = inspectAudioSpectrumQuality({
      sampleRateHz: 48000,
      frequencyCutoffHz: 20000,
    });
    assert.equal(studioSpectrum.isPoison, false);
    assert.equal(studioSpectrum.poisonReason, null);

    const parsedFake1080p = {
      raw: "Disguised.Movie.2026.1080p.WEB-DL.x265",
      cleanTitle: "Disguised Movie",
      resolution: "1080p",
      source: "WEB-DL",
      codec: "HEVC",
      hdr: [],
      audio: ["AAC"],
      isPoison: false,
    };

    // Brick-walled phone-mic audio drops score to 0
    const scoreCam = scoreRelease(parsedFake1080p, { audioCutoffHz: 6500 });
    assert.equal(scoreCam, 0);

    const scoreStudio = scoreRelease(parsedFake1080p, { audioCutoffHz: 20000 });
    assert.ok(scoreStudio > 200);
  });
});

