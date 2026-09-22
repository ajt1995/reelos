/**
 * ReelEngine Multi-Media Curation & Cross-Media Recommendation Engine.
 * Tailors Home & Discover feeds across Movies, TV Series, and Books
 * according to individual profile priorities, taste vibes, and genre affinities.
 */

export const KNOWN_CROSS_MEDIA_BRIDGES = [
  { screenTitle: "Dune", bookTitle: "Dune", author: "Frank Herbert" },
  { screenTitle: "Dune: Part Two", bookTitle: "Dune", author: "Frank Herbert" },
  { screenTitle: "The Lord of the Rings", bookTitle: "The Fellowship of the Ring", author: "J.R.R. Tolkien" },
  { screenTitle: "The Fellowship of the Ring", bookTitle: "The Fellowship of the Ring", author: "J.R.R. Tolkien" },
  { screenTitle: "Foundation", bookTitle: "Foundation", author: "Isaac Asimov" },
  { screenTitle: "Silo", bookTitle: "Wool", author: "Hugh Howey" },
  { screenTitle: "The Three-Body Problem", bookTitle: "The Three-Body Problem", author: "Cixin Liu" },
  { screenTitle: "3 Body Problem", bookTitle: "The Three-Body Problem", author: "Cixin Liu" },
  { screenTitle: "The Witcher", bookTitle: "The Last Wish", author: "Andrzej Sapkowski" },
  { screenTitle: "Game of Thrones", bookTitle: "A Game of Thrones", author: "George R.R. Martin" },
  { screenTitle: "House of the Dragon", bookTitle: "Fire & Blood", author: "George R.R. Martin" },
  { screenTitle: "Blade Runner", bookTitle: "Do Androids Dream of Electric Sheep?", author: "Philip K. Dick" },
  { screenTitle: "Arrival", bookTitle: "Story of Your Life", author: "Ted Chiang" },
  { screenTitle: "The Martian", bookTitle: "The Martian", author: "Andy Weir" },
  { screenTitle: "Project Hail Mary", bookTitle: "Project Hail Mary", author: "Andy Weir" },
  { screenTitle: "Oppenheimer", bookTitle: "American Prometheus", author: "Kai Bird" },
  { screenTitle: "Killers of the Flower Moon", bookTitle: "Killers of the Flower Moon", author: "David Grann" },
];

/**
 * Normalizes title for loose string comparison.
 */
export function normalizeTitleString(str = "") {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Checks if a screen title and a book are connected via a cross-media bridge.
 */
export function matchCrossMediaBridge(screenTitle = "", bookTitle = "", bookAuthor = "") {
  const normScreen = normalizeTitleString(screenTitle);
  const normBook = normalizeTitleString(bookTitle);

  for (const bridge of KNOWN_CROSS_MEDIA_BRIDGES) {
    const bScreen = normalizeTitleString(bridge.screenTitle);
    const bBook = normalizeTitleString(bridge.bookTitle);

    if (
      (normScreen.includes(bScreen) || bScreen.includes(normScreen)) &&
      (normBook.includes(bBook) || bBook.includes(normBook))
    ) {
      return { matched: true, bridge };
    }
  }

  // Fallback: exact or high substring title overlap
  if (normScreen.length >= 4 && normBook.length >= 4) {
    if (normScreen === normBook || normScreen.includes(normBook) || normBook.includes(normScreen)) {
      return {
        matched: true,
        bridge: { screenTitle, bookTitle, author: bookAuthor || "Unknown" },
      };
    }
  }

  return { matched: false };
}

/**
 * Scores an individual media item against a user profile.
 */
export function scoreMediaItem(item, profile = {}) {
  if (!item) return 0;

  const mediaType = item.mediaType || (item.author ? "books" : item.seasons ? "tv" : "movies");
  const priorities = profile.mediaPriorities || { movies: 50, tv: 50, books: 25 };

  // 1. Media Type Preference Factor (0.0 to 1.0)
  const rawPriority = priorities[mediaType] ?? 50;
  const mediaFactor = Math.max(0.05, Math.min(1.0, rawPriority / 100));

  // 2. Base Rating / Popularity
  const rating = Number(item.rating || item.voteAverage || 7.0);
  let baseScore = rating * 10 * mediaFactor; // 0 to 100

  // 3. Genre Affinities
  const curationWeights = profile.curationWeights || {};
  const genres = (item.genres || []).map((g) => String(g).toLowerCase());
  let genreBonus = 0;
  for (const g of genres) {
    if (curationWeights[g]) {
      genreBonus += curationWeights[g] * 15;
    }
  }

  // 4. Taste Vibe Multiplier
  const vibe = profile.tasteVibe || "balanced";
  let vibeMultiplier = 1.0;
  const currentYear = new Date().getFullYear();
  const itemYear = Number(item.year || (item.releaseDate ? item.releaseDate.slice(0, 4) : 0));

  switch (vibe) {
    case "bleeding_edge": {
      // Rewards latest releases
      if (itemYear >= currentYear - 1) vibeMultiplier += 0.35;
      else if (itemYear >= currentYear - 3) vibeMultiplier += 0.15;
      else if (itemYear > 0 && itemYear < currentYear - 10) vibeMultiplier -= 0.2;
      break;
    }
    case "comfort": {
      // Rewards sitcoms, long-running series, procedural dramas, familiar classics
      const isSeries = mediaType === "tv" || (item.seasons && item.seasons.length >= 3);
      const isComfortGenre = genres.some((g) =>
        ["comedy", "drama", "animation", "family", "romance", "mystery"].includes(g)
      );
      if (isSeries && isComfortGenre) vibeMultiplier += 0.4;
      else if (isComfortGenre) vibeMultiplier += 0.2;
      break;
    }
    case "hidden_gems": {
      // High rating with cult / lower vote counts
      const voteCount = Number(item.voteCount || 2000);
      if (rating >= 7.8 && voteCount < 8000) vibeMultiplier += 0.45;
      else if (rating >= 8.2) vibeMultiplier += 0.25;
      break;
    }
    case "balanced":
    default:
      vibeMultiplier = 1.0;
      break;
  }

  // 5. Cross-Media Bridge Bonus
  let bridgeBonus = 0;
  if (item.crossMediaBridge || item.hasAdaptation) {
    bridgeBonus = 12;
  }

  // 6. Explicit Like / Dislike overrides
  const likedIds = profile.likedIds || [];
  const dislikedIds = profile.dislikedIds || [];
  const itemId = String(item.id || item.tmdbId || item.jellyfinId || "");

  if (dislikedIds.includes(itemId)) {
    return 0; // Filtered out
  }

  // Section 32: Negative Prompt & Taste Pruning Vector Geometry
  const negativePrompts = profile.negativePrompts || profile.dislikedKeywords || [];
  const negativeAlignment = computeNegativeAlignment(item, negativePrompts);
  if (negativeAlignment >= 0.4) {
    return 0; // Pruned by negative prompt vector geometry
  }

  if (likedIds.includes(itemId)) {
    baseScore += 35;
  }

  const finalScore = Math.round((baseScore + genreBonus + bridgeBonus) * vibeMultiplier);
  return Math.max(0, finalScore);
}

/**
 * Calculates negative taste vector alignment against item metadata.
 * Prunes titles that align with user negative prompts (e.g. 'cringe romcom', 'torture porn').
 */
export function computeNegativeAlignment(item, negativePrompts = []) {
  if (!item || !Array.isArray(negativePrompts) || negativePrompts.length === 0) {
    return 0;
  }

  const titleText = String(item.title || item.name || "").toLowerCase();
  const overviewText = String(item.overview || item.description || item.tagline || "").toLowerCase();
  const genres = (item.genres || []).map((g) => String(g).toLowerCase());
  const itemCorpus = `${titleText} ${genres.join(" ")} ${overviewText}`;

  for (const rawPrompt of negativePrompts) {
    const prompt = String(rawPrompt).toLowerCase().trim();
    if (!prompt) continue;

    // Direct phrase match
    if (itemCorpus.includes(prompt)) {
      return 1.0;
    }

    // Keyword vector alignment
    const keywords = prompt.split(/\s+/).filter((k) => k.length > 2);
    if (keywords.length > 0) {
      let matched = 0;
      for (const kw of keywords) {
        if (itemCorpus.includes(kw)) matched++;
      }
      const ratio = matched / keywords.length;
      if (ratio >= 0.5) return ratio;
    }
  }

  return 0;
}

/**
 * Curates a multi-media catalog into personalized shelves.
 */
export function curateFeed({ movies = [], tv = [], books = [] }, profile = {}, options = {}) {
  // Discover cross-media bridges
  const enrichedBooks = books.map((b) => ({ ...b, mediaType: "books" }));
  const enrichedMovies = movies.map((m) => ({ ...m, mediaType: "movies" }));
  const enrichedTv = tv.map((t) => ({ ...t, mediaType: "tv" }));

  // Detect and tag cross-media bridges
  for (const b of enrichedBooks) {
    for (const screen of [...enrichedMovies, ...enrichedTv]) {
      const match = matchCrossMediaBridge(screen.title, b.title, b.author);
      if (match.matched) {
        b.crossMediaBridge = { screenTitle: screen.title, screenId: screen.id };
        screen.crossMediaBridge = { bookTitle: b.title, bookAuthor: b.author, bookId: b.id };
      }
    }
  }

  const allItems = [...enrichedMovies, ...enrichedTv, ...enrichedBooks];

  // Score every item
  const scoredItems = allItems
    .map((item) => ({
      item,
      score: scoreMediaItem(item, profile),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  // Shelf 1: For You (Top personalized blend)
  const topPersonalized = scoredItems.slice(0, options.topLimit || 16).map((e) => e.item);

  // Shelf 2: From Page to Screen (Cross-Media Bridges)
  const pageToScreen = scoredItems
    .filter((e) => Boolean(e.item.crossMediaBridge))
    .slice(0, 10)
    .map((e) => e.item);

  // Shelf 3: Vibe Shelf (Bleeding Edge Drops / Comfort Classics / Hidden Gems)
  const currentYear = new Date().getFullYear();
  let vibeShelf = [];
  const vibe = profile.tasteVibe || "balanced";

  if (vibe === "bleeding_edge") {
    vibeShelf = scoredItems
      .filter((e) => {
        const y = Number(e.item.year || 0);
        return y >= currentYear - 1;
      })
      .slice(0, 10)
      .map((e) => e.item);
  } else if (vibe === "comfort") {
    vibeShelf = scoredItems
      .filter((e) => e.item.mediaType === "tv" || (e.item.genres || []).includes("comedy"))
      .slice(0, 10)
      .map((e) => e.item);
  } else if (vibe === "hidden_gems") {
    vibeShelf = scoredItems
      .filter((e) => Number(e.item.rating || e.item.voteAverage || 0) >= 7.8)
      .slice(0, 10)
      .map((e) => e.item);
  }

  // Contextual Mood Shelves
  const dinnerWatches = scoredItems
    .filter((e) => {
      const isShortSeries = e.item.mediaType === "tv" || (e.item.seasons && e.item.seasons.length >= 1);
      const isLightGenre = (e.item.genres || []).some((g) => ["comedy", "animation", "family", "sitcom"].includes(String(g).toLowerCase()));
      return isShortSeries && isLightGenre;
    })
    .slice(0, 8)
    .map((e) => e.item);

  const mindBenders = scoredItems
    .filter((e) => (e.item.genres || []).some((g) => ["sci-fi", "science fiction", "mystery", "thriller", "psychological"].includes(String(g).toLowerCase())))
    .slice(0, 8)
    .map((e) => e.item);

  const forgottenClassics = scoredItems
    .filter((e) => {
      const y = Number(e.item.year || 0);
      const r = Number(e.item.rating || e.item.voteAverage || 0);
      return y > 0 && y <= currentYear - 10 && r >= 7.6;
    })
    .slice(0, 8)
    .map((e) => e.item);

  return {
    personalized: topPersonalized,
    pageToScreen,
    dinnerWatches,
    mindBenders,
    forgottenClassics,
    vibeShelf: vibeShelf.length > 0 ? vibeShelf : topPersonalized.slice(0, 8),
    vibeTitle:
      vibe === "bleeding_edge"
        ? "Bleeding Edge Premieres"
        : vibe === "comfort"
          ? "Fireside Comfort Classics"
          : vibe === "hidden_gems"
            ? "Hidden Gems & Cult Treasures"
            : "Trending Tonight",
  };
}

/**
 * Records 1-tap user feedback: "more_like_this", "not_interested", "comfort_classic".
 */
export function recordTasteInteraction({
  profile = {},
  titleId = "",
  genres = [],
  action = "more_like_this",
} = {}) {
  const updatedProfile = { ...profile };
  const curationWeights = { ...(updatedProfile.curationWeights || {}) };
  const likedIds = [...(updatedProfile.likedIds || [])];
  const dislikedIds = [...(updatedProfile.dislikedIds || [])];
  const tId = String(titleId || "").trim();

  if (action === "more_like_this") {
    if (tId && !likedIds.includes(tId)) likedIds.push(tId);
    for (const g of genres) {
      const norm = String(g).toLowerCase();
      curationWeights[norm] = Math.min(3.0, Math.round(((curationWeights[norm] || 1.0) + 0.3) * 100) / 100);
    }
  } else if (action === "not_interested") {
    if (tId && !dislikedIds.includes(tId)) dislikedIds.push(tId);
    for (const g of genres) {
      const norm = String(g).toLowerCase();
      curationWeights[norm] = Math.max(-2.0, Math.round(((curationWeights[norm] || 1.0) - 0.25) * 100) / 100);
    }
  } else if (action === "comfort_classic") {
    if (tId && !likedIds.includes(tId)) likedIds.push(tId);
    updatedProfile.tasteVibe = "comfort";
    curationWeights["comedy"] = Math.min(3.0, (curationWeights["comedy"] || 1.0) + 0.4);
  } else if (action === "add_negative_prompt" && titleId) {
    const neg = Array.isArray(updatedProfile.negativePrompts) ? [...updatedProfile.negativePrompts] : [];
    if (!neg.includes(titleId)) neg.push(titleId);
    updatedProfile.negativePrompts = neg;
  }

  updatedProfile.curationWeights = curationWeights;
  updatedProfile.likedIds = likedIds;
  updatedProfile.dislikedIds = dislikedIds;
  updatedProfile.updatedAt = Date.now();

  return updatedProfile;
}
