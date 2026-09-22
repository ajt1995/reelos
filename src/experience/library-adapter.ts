import type { ExperienceTitle } from "./experience-catalog.ts";
import type { ExperienceMediaSource } from "./source-access.ts";

export interface LiveLibraryResult {
  titles: ExperienceTitle[];
  progress: Record<string, number>;
  status: "live" | "unavailable";
  message?: string;
}

type LibraryTitle = {
  id?: string;
  kind?: string;
  title?: string;
  year?: number;
  runtime?: number;
  genres?: string[];
  overview?: string;
  director?: string;
  poster?: string;
  backdrop?: string;
  jellyfinId?: string;
  isKids?: boolean;
  progress?: number;
  sourceKind?: string;
  sourceVerified?: boolean;
};

const moodByGenre: Record<string, string[]> = {
  comedy: ["fun", "warm"],
  drama: ["human", "absorbing"],
  horror: ["dark", "tense"],
  thriller: ["tense", "restless"],
  action: ["kinetic", "big"],
  adventure: ["wonder", "transporting"],
  animation: ["colorful", "playful"],
  romance: ["warm", "emotional"],
  mystery: ["cerebral", "patient"],
  documentary: ["curious", "patient"],
  fantasy: ["wonder", "transporting"],
  "science fiction": ["cerebral", "big"],
  "sci-fi": ["cerebral", "big"],
};

function normalizeProgress(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.max(0, Math.min(0.99, number > 1 ? number / 100 : number));
}

export function mapLibraryTitle(raw: LibraryTitle): ExperienceTitle | null {
  const id = String(raw.id || "").trim();
  const title = String(raw.title || "").trim();
  if (!id || !title) return null;
  const genres = Array.isArray(raw.genres)
    ? raw.genres.filter((genre): genre is string => typeof genre === "string" && Boolean(genre.trim()))
    : [];
  const moods = [
    ...new Set(
      genres.flatMap((genre) => moodByGenre[genre.toLowerCase()] || []),
    ),
  ];
  const kind = raw.kind === "tv" || raw.kind === "series" ? "series" : raw.kind === "book" ? "book" : "movie";
  const declaredSource: ExperienceMediaSource | null = raw.sourceVerified === true
    ? raw.sourceKind === "provider_stream" || raw.sourceKind === "debrid"
      ? { kind: "debrid" as const, verified: true }
      : raw.sourceKind === "personal_import" || raw.sourceKind === "public_domain" || raw.sourceKind === "retained_local"
        ? { kind: raw.sourceKind, verified: true }
        : raw.sourceKind === "prepared_rendition"
          ? { kind: "retained_local" as const, verified: true }
          : null
    : null;
  const sources: ExperienceTitle["sources"] = declaredSource
    ? [declaredSource]
    : [{ kind: "retained_local", verified: true }];
  return {
    id,
    title,
    year: Number.isFinite(Number(raw.year)) ? Number(raw.year) : 0,
    kind,
    genres: genres.length ? genres : [kind === "series" ? "Series" : "Film"],
    poster: typeof raw.poster === "string" ? raw.poster : "",
    backdrop: typeof raw.backdrop === "string" ? raw.backdrop : "",
    note:
      typeof raw.overview === "string" && raw.overview.trim()
        ? raw.overview.trim()
        : "Ready on this ReelOS box.",
    people:
      typeof raw.director === "string" && raw.director.trim()
        ? [raw.director.trim()]
        : [],
    moods: moods.length ? moods : ["absorbing"],
    minutes:
      Number.isFinite(Number(raw.runtime)) && Number(raw.runtime) > 0
        ? Number(raw.runtime)
        : kind === "series"
          ? 48
          : 110,
    runtimeKnown: Number.isFinite(Number(raw.runtime)) && Number(raw.runtime) > 0,
    // Never infer child safety from genre or artwork. It must come from the
    // library/profile policy service.
    family: raw.isKids === true,
    // Shelf presence alone never establishes that bytes are an eligible original.
    // Only the authenticated library API's independently verified annotation does.
    sources,
    playbackId: String(raw.jellyfinId || id),
  };
}

export async function loadLiveLibrary(signal?: AbortSignal): Promise<LiveLibraryResult> {
  try {
    const response = await fetch("/api/library?limit=80", {
      cache: "no-store",
      signal,
    });
    if (!response.ok) throw new Error(`Library returned ${response.status}`);
    const payload = (await response.json()) as {
      titles?: LibraryTitle[];
      continueWatching?: LibraryTitle[];
      error?: string | null;
    };
    const rawTitles = [
      ...(Array.isArray(payload.titles) ? payload.titles : []),
      ...(Array.isArray(payload.continueWatching) ? payload.continueWatching : []),
    ];
    const byId = new Map<string, ExperienceTitle>();
    for (const raw of rawTitles) {
      const mapped = mapLibraryTitle(raw);
      if (mapped) byId.set(mapped.id, mapped);
    }
    const progress: Record<string, number> = {};
    for (const raw of payload.continueWatching || []) {
      const id = String(raw.id || "");
      const value = normalizeProgress(raw.progress);
      if (id && value > 0) progress[id] = value;
    }
    return {
      titles: [...byId.values()],
      progress,
      status: "live",
      ...(payload.error ? { message: payload.error } : {}),
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    return {
      titles: [],
      progress: {},
      status: "unavailable",
      message: error instanceof Error ? error.message : "Library unavailable",
    };
  }
}

export function mergeExperienceTitles(
  catalog: ExperienceTitle[],
  live: ExperienceTitle[],
) {
  const result = [...live];
  const seen = new Set(live.flatMap((title) => [title.id, title.playbackId || ""]));
  for (const title of catalog) {
    if (seen.has(title.id) || (title.playbackId && seen.has(title.playbackId))) continue;
    result.push(title);
  }
  return result;
}
