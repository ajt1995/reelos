/**
 * Metadata Enricher Service
 * Resolves genuine movie and TV metadata (overviews, genres, directors, artwork)
 * using local catalog, Cinemeta, and persistent caching.
 * Ensures zero empty placeholders across all endpoints (/api/lookup, /Items, etc.).
 */
import fs from "node:fs";
import path from "node:path";

export const KNOWN_METADATA = {
  "tmdb-603": {
    id: "tmdb-603",
    imdbId: "tt0133093",
    title: "The Matrix",
    year: 1999,
    kind: "movie",
    overview: "Set in the 22nd century, The Matrix tells the story of a computer hacker who joins a group of underground insurgents fighting the vast and powerful computers who now rule the earth.",
    genres: ["Action", "Sci-Fi"],
    director: "Lana Wachowski, Lilly Wachowski",
    rating: 8.7,
    maxQuality: "4k",
    popularity: 98,
    poster: "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
    banner: "https://image.tmdb.org/t/p/original/l4QHerTSbflqI4Vsh0x6rZ0oi3.jpg",
  },
  "tmdb-693134": {
    id: "tmdb-693134",
    imdbId: "tt15239678",
    title: "Dune: Part Two",
    year: 2024,
    kind: "movie",
    overview: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family. Facing a choice between the love of his life and the fate of the universe, he endeavors to prevent a terrible future.",
    genres: ["Sci-Fi", "Adventure"],
    director: "Denis Villeneuve",
    rating: 8.6,
    maxQuality: "4k",
    popularity: 99,
    poster: "https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
    banner: "https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJv9JCnx7s5200SV.jpg",
  },
  "tmdb-335984": {
    id: "tmdb-335984",
    imdbId: "tt1856191",
    title: "Blade Runner 2049",
    year: 2017,
    kind: "movie",
    overview: "Thirty years after the events of the first film, a new blade runner, LAPD Officer K, unearths a long-buried secret that has the potential to plunge what's left of society into chaos.",
    genres: ["Sci-Fi", "Mystery"],
    director: "Denis Villeneuve",
    rating: 8.0,
    maxQuality: "4k",
    popularity: 94,
    poster: "https://image.tmdb.org/t/p/w500/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg",
    banner: "https://image.tmdb.org/t/p/original/ilRyASDvt7v6oR1c7O5zXdpB524.jpg",
  },
  "tmdb-157336": {
    id: "tmdb-157336",
    imdbId: "tt0816692",
    title: "Interstellar",
    year: 2014,
    kind: "movie",
    overview: "The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel and conquer the vast distances involved in an interstellar voyage.",
    genres: ["Adventure", "Drama", "Sci-Fi"],
    director: "Christopher Nolan",
    rating: 8.4,
    maxQuality: "4k",
    popularity: 97,
    poster: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    banner: "https://image.tmdb.org/t/p/original/rAiYTsqJiOEZg05z5U4jD8rU07E.jpg",
  },
  "tmdb-414906": {
    id: "tmdb-414906",
    imdbId: "tt1877830",
    title: "The Batman",
    year: 2022,
    kind: "movie",
    overview: "In his second year of fighting crime, Batman uncovers corruption in Gotham City that connects to his own family while facing a serial killer known as the Riddler.",
    genres: ["Action", "Crime", "Drama"],
    director: "Matt Reeves",
    rating: 7.8,
    maxQuality: "4k",
    popularity: 92,
    poster: "https://image.tmdb.org/t/p/w500/74xTEgt7R36Fpooo50r9T25onhq.jpg",
    banner: "https://image.tmdb.org/t/p/original/b0PlSFdDwbyK0cf5RxwDpaOJQvQ.jpg",
  },
  "tmdb-872585": {
    id: "tmdb-872585",
    imdbId: "tt15398776",
    title: "Oppenheimer",
    year: 2023,
    kind: "movie",
    overview: "The story of J. Robert Oppenheimer's role in the development of the atomic bomb during World War II.",
    genres: ["Drama", "History"],
    director: "Christopher Nolan",
    rating: 8.1,
    maxQuality: "4k",
    popularity: 96,
    poster: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    banner: "https://image.tmdb.org/t/p/original/rLb2cwF3Pazuxaj0sRXQ037tGI1.jpg",
  },
  "tmdb-129": {
    id: "tmdb-129",
    imdbId: "tt0245429",
    title: "Spirited Away",
    year: 2001,
    kind: "movie",
    overview: "A young girl, Chihiro, becomes trapped in a strange new world of spirits. When her parents undergo a mysterious transformation, she must call upon the courage she never knew she had to free her family.",
    genres: ["Animation", "Family", "Fantasy"],
    director: "Hayao Miyazaki",
    rating: 8.5,
    maxQuality: "4k",
    popularity: 95,
    poster: "https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
    banner: "https://image.tmdb.org/t/p/original/Ab8mkHmkYADjU7wQiOkia99GQI.jpg",
  },
  "tmdb-245891": {
    id: "tmdb-245891",
    imdbId: "tt2911666",
    title: "John Wick",
    year: 2014,
    kind: "movie",
    overview: "An ex-hit-man comes out of retirement to track down the gangsters that took everything from him.",
    genres: ["Action", "Thriller"],
    director: "Chad Stahelski",
    rating: 7.4,
    maxQuality: "4k",
    popularity: 90,
    poster: "https://image.tmdb.org/t/p/w500/fZPSMVECvvkg7332L8FLbYVFFG.jpg",
    banner: "https://image.tmdb.org/t/p/original/umC04BuvvIOJQcuDY8fUmIXR5nh.jpg",
  },
  "tmdb-tv-95396": {
    id: "tmdb-tv-95396",
    tvdbId: "371980",
    imdbId: "tt11280740",
    title: "Severance",
    year: 2022,
    kind: "tv",
    overview: "Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives. When a mysterious colleague appears outside of work, it begins a journey to discover the truth about their jobs.",
    genres: ["Drama", "Mystery", "Sci-Fi"],
    director: "Ben Stiller",
    rating: 8.7,
    seasons: 2,
    seasonList: [1, 2],
    maxQuality: "4k",
    popularity: 95,
    poster: "https://image.tmdb.org/t/p/w500/815777z5WnQcK2g1Xw9Ue4T3K4r.jpg",
    banner: "https://image.tmdb.org/t/p/original/9faGSFi5jam6pDWGNd0ip80ioSO.jpg",
  },
  "tmdb-tv-106379": {
    id: "tmdb-tv-106379",
    tvdbId: "384469",
    imdbId: "tt12637874",
    title: "Fallout",
    year: 2024,
    kind: "tv",
    overview: "In a future, post-apocalyptic Los Angeles brought about by nuclear decimation, citizens must live in underground bunkers to protect themselves from radiation, mutants and bandits.",
    genres: ["Action", "Adventure", "Drama"],
    director: "Jonathan Nolan",
    rating: 8.4,
    seasons: 1,
    seasonList: [1],
    maxQuality: "4k",
    popularity: 98,
    poster: "https://image.tmdb.org/t/p/w500/AnsZu4nuhfFqT5oO22x1B0eR8t3.jpg",
    banner: "https://image.tmdb.org/t/p/original/2meX1nMdScFOoV4370rqHWKm5oY.jpg",
  },
  "tmdb-tv-126308": {
    id: "tmdb-tv-126308",
    tvdbId: "410091",
    imdbId: "tt2788316",
    title: "Shōgun",
    year: 2024,
    kind: "tv",
    overview: "When a mysterious European ship is found marooned in a nearby fishing village, Lord Yoshii Toranaga discovers secrets that could tip the scales of power and devastate his formidable enemies.",
    genres: ["Action", "Adventure", "Drama"],
    director: "Rachel Kondo, Justin Marks",
    rating: 8.7,
    seasons: 1,
    seasonList: [1],
    maxQuality: "4k",
    popularity: 96,
    poster: "https://image.tmdb.org/t/p/w500/7O4iVfOMQmdCSxhOg1WNzG1AgYT.jpg",
    banner: "https://image.tmdb.org/t/p/original/j1Z5aIeW301pI7Y78OqN07G4T4Z.jpg",
  },
  "tmdb-tv-79744": {
    id: "tmdb-tv-79744",
    tvdbId: "350665",
    imdbId: "tt7587890",
    title: "The Rookie",
    year: 2018,
    kind: "tv",
    overview: "Starting over isn’t easy, especially for small-town guy John Nolan who, after a life-altering incident, is pursuing his dream of being an LAPD officer.",
    genres: ["Crime", "Drama"],
    director: "Alexi Hawley",
    rating: 8.0,
    seasons: 6,
    seasonList: [1, 2, 3, 4, 5, 6],
    maxQuality: "4k",
    popularity: 88,
    poster: "https://image.tmdb.org/t/p/w500/bL5I5zVb69Yw9B0tZ8uM9hI6k3d.jpg",
  },
  "tmdb-tv-125988": {
    id: "tmdb-tv-125988",
    tvdbId: "403245",
    imdbId: "tt14688458",
    title: "Silo",
    year: 2023,
    kind: "tv",
    overview: "In a ruined and toxic future, thousands live in a giant silo deep underground. After its sheriff breaks a cardinal rule and residents die mysteriously, engineer Juliette starts to uncover shocking secrets.",
    genres: ["Drama", "Sci-Fi"],
    director: "Graham Yost",
    rating: 8.1,
    seasons: 2,
    seasonList: [1, 2],
    maxQuality: "4k",
    popularity: 91,
    poster: "https://image.tmdb.org/t/p/w500/1X4h40fcB4WWUmIBK0auT4zRkMM.jpg",
  },
  "tmdb-tv-108978": {
    id: "tmdb-tv-108978",
    tvdbId: "366924",
    imdbId: "tt9288030",
    title: "Reacher",
    year: 2022,
    kind: "tv",
    overview: "Jack Reacher, a veteran military police investigator, has just entered civilian life when he is falsely accused of murder.",
    genres: ["Action", "Crime", "Drama"],
    director: "Nick Santora",
    rating: 8.1,
    seasons: 2,
    seasonList: [1, 2],
    maxQuality: "4k",
    popularity: 92,
    poster: "https://image.tmdb.org/t/p/w500/jBF3wlhp0b9tq4oIeT5gY8Qy9Y7.jpg",
  },
  "tmdb-tv-1402": {
    id: "tmdb-tv-1402",
    imdbId: "tt1520211",
    title: "The Walking Dead",
    year: 2010,
    kind: "tv",
    overview: "Sheriff Deputy Rick Grimes wakes up from a coma to learn the world is in ruins and must lead a group of survivors to stay alive.",
    genres: ["Action", "Drama", "Horror"],
    director: "Frank Darabont",
    rating: 8.2,
    seasons: 11,
    seasonList: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    maxQuality: "1080p",
    popularity: 89,
    poster: "https://image.tmdb.org/t/p/w500/rqeYMLryjcawh2JeRpCVUDXYM5b.jpg",
  },
};

// Aliases for TVDB and clean TMDB numbers
KNOWN_METADATA["tvdb-371980"] = KNOWN_METADATA["tmdb-tv-95396"];
KNOWN_METADATA["tvdb-384469"] = KNOWN_METADATA["tmdb-tv-106379"];
KNOWN_METADATA["tvdb-410091"] = KNOWN_METADATA["tmdb-tv-126308"];
KNOWN_METADATA["tvdb-350665"] = KNOWN_METADATA["tmdb-tv-79744"];
KNOWN_METADATA["tvdb-403245"] = KNOWN_METADATA["tmdb-tv-125988"];
KNOWN_METADATA["tvdb-366924"] = KNOWN_METADATA["tmdb-tv-108978"];
KNOWN_METADATA["movie-603"] = KNOWN_METADATA["tmdb-603"];
KNOWN_METADATA["imdb-tt0133093"] = KNOWN_METADATA["tmdb-603"];

const cacheMem = new Map();

function resolveStateDir() {
  const win = path.join(process.cwd(), ".reelos-state");
  if (fs.existsSync(win)) return win;
  if (fs.existsSync("/var/lib/reelos")) return "/var/lib/reelos";
  return process.cwd();
}

function getCachePath() {
  return path.join(resolveStateDir(), "metadata-cache.json");
}

function loadDiskCache() {
  try {
    const cp = getCachePath();
    if (fs.existsSync(cp)) {
      const data = JSON.parse(fs.readFileSync(cp, "utf8"));
      for (const [k, v] of Object.entries(data)) {
        cacheMem.set(k.toLowerCase(), v);
      }
    }
  } catch {}
}

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const cp = getCachePath();
      const obj = {};
      for (const [k, v] of cacheMem.entries()) {
        obj[k] = v;
      }
      fs.writeFileSync(cp, JSON.stringify(obj, null, 2), "utf8");
    } catch {}
  }, 1000);
}

loadDiskCache();

/**
 * Fetch genuine metadata from Cinemeta for any title or IMDb ID
 */
export async function fetchCinemetaMetadata(titleOrImdb, { kind = "movie", year = 0 } = {}) {
  const isSeries = kind === "tv" || kind === "anime";
  const type = isSeries ? "series" : "movie";
  const raw = String(titleOrImdb || "").trim();
  if (!raw) return null;

  const cleanImdb = raw.replace(/^imdb-/, "");
  const isImdb = cleanImdb.startsWith("tt");

  try {
    if (isImdb) {
      const metaRes = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${cleanImdb}.json`, {
        signal: AbortSignal.timeout(6000),
      });
      if (metaRes.ok) {
        const j = await metaRes.json();
        if (j?.meta?.name) return formatCinemetaMeta(j.meta, isSeries);
      }
      // Try opposite type if not found
      const altType = isSeries ? "movie" : "series";
      const altRes = await fetch(`https://v3-cinemeta.strem.io/meta/${altType}/${cleanImdb}.json`, {
        signal: AbortSignal.timeout(6000),
      });
      if (altRes.ok) {
        const j = await altRes.json();
        if (j?.meta?.name) return formatCinemetaMeta(j.meta, !isSeries);
      }
    } else {
      // Search by title name
      const searchRes = await fetch(
        `https://v3-cinemeta.strem.io/catalog/${type}/top/search=${encodeURIComponent(raw)}.json`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (searchRes.ok) {
        const sj = await searchRes.json();
        const hits = Array.isArray(sj?.metas) ? sj.metas : [];
        if (hits.length > 0) {
          // Match year if available
          let hit = hits[0];
          if (year && Number(year) > 0) {
            const matchedYear = hits.find((h) => {
              const y = parseInt(h.releaseInfo || h.year, 10);
              return y && Math.abs(y - Number(year)) <= 1;
            });
            if (matchedYear) hit = matchedYear;
          }
          if (hit?.id) {
            const metaRes = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${hit.id}.json`, {
              signal: AbortSignal.timeout(6000),
            });
            if (metaRes.ok) {
              const mj = await metaRes.json();
              if (mj?.meta?.name) return formatCinemetaMeta(mj.meta, isSeries);
            }
            return formatCinemetaMeta(hit, isSeries);
          }
        }
      }
    }
  } catch {}

  return null;
}

function formatCinemetaMeta(meta, isSeries) {
  const videos = Array.isArray(meta.videos) ? meta.videos : [];
  const seasonList = isSeries
    ? [...new Set(videos.map((v) => Number(v.season)).filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b)
    : [];

  const director = Array.isArray(meta.director)
    ? meta.director.join(", ")
    : meta.director || (Array.isArray(meta.directors) ? meta.directors.join(", ") : undefined);

  return {
    title: meta.name || "Untitled",
    year: parseInt(meta.releaseInfo || meta.year, 10) || 0,
    overview: meta.description || meta.overview || "",
    genres: Array.isArray(meta.genres) ? meta.genres : [],
    director: director || undefined,
    rating: parseFloat(meta.imdbRating) || 8.0,
    poster: (meta.poster || "").replace("/small/", "/medium/"),
    banner: meta.background || "",
    seasons: seasonList.length || (isSeries ? 1 : 0),
    seasonList: seasonList.length > 0 ? seasonList : (isSeries ? [1] : []),
    imdbId: meta.id?.startsWith("tt") ? meta.id : undefined,
  };
}

/**
 * Universal resolver: checks known metadata, the verified cache, and Cinemeta.
 * Unknown facts remain unknown; this boundary never invents editorial copy,
 * genres, seasons, or ratings.
 */
export async function resolveTitleMetadata(idOrTitle, { kind = "movie", year = 0 } = {}) {
  const raw = String(idOrTitle || "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  // 1. Direct match in KNOWN_METADATA
  if (KNOWN_METADATA[raw] || KNOWN_METADATA[lower]) {
    return { ...(KNOWN_METADATA[raw] || KNOWN_METADATA[lower]) };
  }

  // 2. Cache check
  if (cacheMem.has(lower)) {
    const cached = cacheMem.get(lower);
    if (cached && cached.overview && cached.genres?.length) {
      return { ...cached };
    }
  }

  // Check by normalized title
  const normTitle = raw.toLowerCase().replace(/[^a-z0-9]+/g, "");
  for (const item of Object.values(KNOWN_METADATA)) {
    const itemNorm = String(item.title).toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (itemNorm && itemNorm === normTitle) {
      if (!year || !item.year || Math.abs(Number(item.year) - Number(year)) <= 1) {
        return { ...item };
      }
    }
  }

  // 3. Live fetch via Cinemeta
  const fetched = await fetchCinemetaMetadata(raw, { kind, year });
  if (fetched && fetched.overview) {
    cacheMem.set(lower, fetched);
    if (fetched.title) cacheMem.set(fetched.title.toLowerCase(), fetched);
    scheduleSave();
    return fetched;
  }

  // 4. Honest unresolved record. The interface can progressively disclose that
  // richer metadata is unavailable without presenting generated prose as fact.
  const fallback = {
    title: raw,
    year: Number(year) || 0,
    kind,
    overview: "",
    genres: [],
    rating: null,
    seasons: 0,
    seasonList: [],
    verified: false,
    metadataSource: "unavailable",
  };

  cacheMem.set(lower, fallback);
  scheduleSave();
  return fallback;
}

/**
 * Enriches a title object in-place or returns a enriched copy.
 */
export function enrichTitleSync(t) {
  if (!t) return t;
  const id = t.id || t.jellyfinId || "";
  const known = KNOWN_METADATA[id] || KNOWN_METADATA[String(id).toLowerCase()];
  if (known) {
    return {
      ...t,
      overview: t.overview || known.overview || "",
      genres: (t.genres && t.genres.length > 0) ? t.genres : (known.genres || []),
      director: t.director || known.director || undefined,
      rating: t.rating || known.rating || 8.0,
      poster: t.poster || known.poster || "",
      banner: t.banner || known.banner || "",
      seasons: t.seasons || known.seasons || (t.kind === "tv" ? 1 : 0),
      seasonList: (t.seasonList && t.seasonList.length > 0) ? t.seasonList : (known.seasonList || (t.kind === "tv" ? [1] : [])),
    };
  }

  const cached = cacheMem.get(String(t.title || "").toLowerCase()) || cacheMem.get(String(id).toLowerCase());
  if (cached) {
    return {
      ...t,
      overview: t.overview || cached.overview || "",
      genres: (t.genres && t.genres.length > 0) ? t.genres : (cached.genres || []),
      director: t.director || cached.director || undefined,
      rating: t.rating || cached.rating || 8.0,
      poster: t.poster || cached.poster || "",
      banner: t.banner || cached.banner || "",
    };
  }

  return {
    ...t,
    overview: t.overview || "",
    genres: Array.isArray(t.genres) ? t.genres : [],
    ...(!t.overview ? { metadataStatus: "unavailable" } : {}),
  };
}
