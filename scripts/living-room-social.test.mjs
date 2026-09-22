import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { FlickMatchEngine } from "./reelos-flickmatch.mjs";
import { sweepGuestRequests } from "./reelos-guest-cleanup.mjs";
import {
  isTitleKidContent,
  filterShelfForAdults,
  filterShelfForKids,
  giftTitleForKids,
  ungiftTitleForKids,
  isTitleGifted,
  getGiftedKidsTitles,
} from "./reelos-kids.mjs";

test("flickmatch: room creation initializes 15-card deck and host player", () => {
  const engine = new FlickMatchEngine();
  const sampleTitles = Array.from({ length: 20 }, (_, i) => ({
    id: `title-${i}`,
    title: `Movie ${i}`,
    year: 2020 + (i % 4),
    genres: ["Sci-Fi", "Action"],
  }));

  const res = engine.createOrJoinRoom({
    roomCode: "CINE",
    residentName: "Alex",
    residentAvatar: "clapperboard",
    libraryTitles: sampleTitles,
  });

  assert.equal(res.ok, true);
  assert.equal(res.roomCode, "CINE");
  assert.equal(res.host, "Alex");
  assert.equal(res.players.length, 1);
  assert.equal(res.deck.length, 15);
  assert.equal(res.match, null);
});

test("flickmatch: unanimous right-swipe produces immediate match", () => {
  const engine = new FlickMatchEngine();
  const sampleTitles = [
    { id: "interstellar", title: "Interstellar", year: 2014 },
    { id: "inception", title: "Inception", year: 2010 },
  ];

  // Alex creates room
  engine.createOrJoinRoom({
    roomCode: "TEST",
    residentName: "Alex",
    libraryTitles: sampleTitles,
  });

  // Friend joins room
  engine.createOrJoinRoom({
    roomCode: "TEST",
    residentName: "Sarah",
    libraryTitles: sampleTitles,
  });

  // Alex votes YES on Interstellar
  const vote1 = engine.recordVote({
    roomCode: "TEST",
    residentName: "Alex",
    titleId: "interstellar",
    vote: "yes",
  });
  // Not unanimous yet because Sarah hasn't voted
  assert.equal(vote1.matched, false);

  // Sarah votes YES on Interstellar
  const vote2 = engine.recordVote({
    roomCode: "TEST",
    residentName: "Sarah",
    titleId: "interstellar",
    vote: "yes",
  });

  // Now unanimous!
  assert.equal(vote2.matched, true);
  assert.equal(vote2.match.titleId, "interstellar");
  assert.equal(vote2.match.title, "Interstellar");
});

test("flickmatch: pass vote prevents match", () => {
  const engine = new FlickMatchEngine();
  const sampleTitles = [{ id: "dune", title: "Dune", year: 2021 }];

  engine.createOrJoinRoom({ roomCode: "DUNE", residentName: "Alex", libraryTitles: sampleTitles });
  engine.createOrJoinRoom({ roomCode: "DUNE", residentName: "Bob", libraryTitles: sampleTitles });

  engine.recordVote({ roomCode: "DUNE", residentName: "Alex", titleId: "dune", vote: "yes" });
  const voteBob = engine.recordVote({ roomCode: "DUNE", residentName: "Bob", titleId: "dune", vote: "no" });

  assert.equal(voteBob.matched, false);
});

test("guest cleanup: sweeps unpinned requests older than 24h", () => {
  const now = Date.now();
  const requests = [
    { id: "req-1", titleId: "movie-guest-old", requester: "Guest", createdAt: now - 25 * 3600 * 1000 },
    { id: "req-2", titleId: "movie-guest-pinned", requester: "Guest", createdAt: now - 30 * 3600 * 1000 },
    { id: "req-3", titleId: "movie-guest-recent", requester: "Guest", createdAt: now - 2 * 3600 * 1000 },
    { id: "req-4", titleId: "movie-resident", requester: "Alex", createdAt: now - 48 * 3600 * 1000 },
  ];

  const pinnedWatchlist = new Set(["movie-guest-pinned"]);

  const { toRemove, kept } = sweepGuestRequests({
    requests,
    watchlistTitleIds: pinnedWatchlist,
    maxAgeHours: 24,
    now,
  });

  // Only req-1 is removed (old guest request not pinned)
  assert.equal(toRemove.length, 1);
  assert.equal(toRemove[0].id, "req-1");

  // req-2 (pinned), req-3 (recent), and req-4 (resident) are kept
  assert.equal(kept.length, 3);
  assert.ok(kept.some((r) => r.id === "req-2"));
  assert.ok(kept.some((r) => r.id === "req-3"));
  assert.ok(kept.some((r) => r.id === "req-4"));
});

test("kids sandbox: adult shelf isolates kids content unless in watchlist", () => {
  const shelf = [
    { id: "paw-patrol", title: "Paw Patrol", genres: ["Animation", "Family"] },
    { id: "peppa-pig", title: "Peppa Pig", genres: ["Children"] },
    { id: "spirited-away", title: "Spirited Away", genres: ["Animation"] },
    { id: "oppenheimer", title: "Oppenheimer", genres: ["Drama", "History"] },
    { id: "godfather", title: "The Godfather", genres: ["Crime", "Drama"] },
  ];

  const kidsApprovedIds = ["paw-patrol", "peppa-pig"];
  // Adult pinned Spirited Away into their own watchlist
  const adultWatchlist = ["spirited-away"];

  // Filter for adult with hideKidsContent
  const adultShelf = filterShelfForAdults(shelf, kidsApprovedIds, adultWatchlist);

  // Adult sees Oppenheimer, Godfather, and pinned Spirited Away, but NOT Paw Patrol or Peppa Pig
  assert.equal(adultShelf.length, 3);
  assert.ok(adultShelf.some((t) => t.id === "oppenheimer"));
  assert.ok(adultShelf.some((t) => t.id === "godfather"));
  assert.ok(adultShelf.some((t) => t.id === "spirited-away"));
  assert.ok(!adultShelf.some((t) => t.id === "paw-patrol"));
  assert.ok(!adultShelf.some((t) => t.id === "peppa-pig"));

  // Filter for Kids Profile
  const kidsShelf = filterShelfForKids(shelf, kidsApprovedIds);
  // Kids profile only sees kid content (Paw Patrol, Peppa Pig, Spirited Away)
  assert.equal(kidsShelf.length, 3);
  assert.ok(kidsShelf.some((t) => t.id === "paw-patrol"));
  assert.ok(kidsShelf.some((t) => t.id === "peppa-pig"));
  assert.ok(kidsShelf.some((t) => t.id === "spirited-away"));
  assert.ok(!kidsShelf.some((t) => t.id === "oppenheimer"));
  assert.ok(!kidsShelf.some((t) => t.id === "godfather"));
});

test("kids gifting: Mom & Dad can gift a title with golden ribbon and ungift seamlessly", () => {
  const tmpFile = path.join(os.tmpdir(), `reelos-kids-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);

  try {
    // Initially not gifted
    assert.equal(isTitleGifted("toy-story", tmpFile), null);

    // Gift Toy Story from Mom & Dad
    const ok = giftTitleForKids("toy-story", "Mom & Dad", tmpFile);
    assert.equal(ok, true);

    const gift = isTitleGifted("toy-story", tmpFile);
    assert.ok(gift);
    assert.equal(gift.giftedBy, "Mom & Dad");
    assert.ok(gift.timestamp > 0);

    const allGifts = getGiftedKidsTitles(tmpFile);
    assert.ok(allGifts["toy-story"]);
    assert.equal(allGifts["toy-story"].giftedBy, "Mom & Dad");

    // Ungift
    const unOk = ungiftTitleForKids("toy-story", tmpFile);
    assert.equal(unOk, true);
    assert.equal(isTitleGifted("toy-story", tmpFile), null);
  } finally {
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {}
  }
});

