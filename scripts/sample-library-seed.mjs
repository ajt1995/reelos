import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export const SAMPLE_MOVIES = [
  {
    id: "night-of-the-living-dead-1968",
    title: "Night of the Living Dead",
    year: 1968,
    runtime: 96,
    rating: 7.8,
    genres: ["Horror", "Mystery", "Cult"],
    overview:
      "A disparate group of individuals takes refuge in an abandoned house when corpses begin to leave the graveyard in search of fresh human flesh.",
    director: "George A. Romero",
    poster: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80",
    streamUrl: "https://archive.org/download/night_of_the_living_dead_dvd/Night.mp4",
    videoCodec: "480p H.264",
    audioCodec: "AAC",
    is4k: false,
    isHdr: false,
    isPublicDomain: true,
    tagline: "They won't stay dead!",
  },
  {
    id: "charade-1963",
    title: "Charade",
    year: 1963,
    runtime: 113,
    rating: 7.9,
    genres: ["Mystery", "Comedy", "Romance"],
    overview:
      "A woman is pursued by several men who want a fortune her murdered husband had stolen. Whom can she trust?",
    director: "Stanley Donen",
    poster: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&auto=format&fit=crop&q=80",
    streamUrl: "https://archive.org/download/Charade1963/Charade1963.mp4",
    videoCodec: "1080p H.264",
    audioCodec: "Stereo AAC",
    is4k: false,
    isHdr: false,
    isPublicDomain: true,
    tagline: "You can expect the unexpected when you play Charade!",
  },
  {
    id: "his-girl-friday-1940",
    title: "His Girl Friday",
    year: 1940,
    runtime: 92,
    rating: 7.8,
    genres: ["Comedy", "Romance", "Drama"],
    overview:
      "A newspaper editor uses every trick in the book to keep his ace reporter ex-wife from remarrying and retiring from the newspaper business.",
    director: "Howard Hawks",
    poster: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800&auto=format&fit=crop&q=80",
    streamUrl: "https://archive.org/download/HisGirlFriday1940/HisGirlFriday1940.mp4",
    videoCodec: "1080p H.264",
    audioCodec: "Mono AAC",
    is4k: false,
    isHdr: false,
    isPublicDomain: true,
    tagline: "She had him scooped on the front page and hooked in the heart!",
  },
  {
    id: "a-star-is-born-1937",
    title: "A Star Is Born",
    year: 1937,
    runtime: 111,
    rating: 7.5,
    genres: ["Drama", "Romance"],
    overview:
      "A young woman comes to Hollywood with dreams of stardom and achieves them only to find that fame brings heartbreak as her husband's career plummets.",
    director: "William A. Wellman",
    poster: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&auto=format&fit=crop&q=80",
    streamUrl: "https://archive.org/download/AStarIsBorn1937/AStarIsBorn1937.mp4",
    videoCodec: "1080p H.264",
    audioCodec: "Mono AAC",
    is4k: false,
    isHdr: false,
    isPublicDomain: true,
    tagline: "The world's most glamorous story of love and fame!",
  },
];

/**
 * Seeds verified sample public domain titles into local state directory.
 * @param {string} [targetDir]
 * @returns {{ count: number, titles: string[], seededPath: string }}
 */
export function seedSampleLibrary(targetDir) {
  if (!targetDir) {
    const isWin = process.platform === "win32";
    targetDir = isWin
      ? join(process.env.LOCALAPPDATA || "C:\\ProgramData", "ReelOS", "sample-library")
      : "/var/lib/reelos/sample-library";
  }

  try {
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    const manifestPath = join(targetDir, "sample-library.json");
    const payload = {
      seededAt: new Date().toISOString(),
      version: "1.0.0",
      movies: SAMPLE_MOVIES,
    };

    writeFileSync(manifestPath, JSON.stringify(payload, null, 2), "utf8");

    return {
      count: SAMPLE_MOVIES.length,
      titles: SAMPLE_MOVIES.map((m) => m.title),
      seededPath: manifestPath,
    };
  } catch (err) {
    return {
      count: SAMPLE_MOVIES.length,
      titles: SAMPLE_MOVIES.map((m) => m.title),
      seededPath: "memory",
      readOnly: true,
      error: err.message,
    };
  }
}
