import type { ExperienceTitle } from "./experience-catalog.ts";
import type { DebridConnection } from "./source-access.ts";
import { sourceIsAccessible } from "./source-access.ts";

export interface CompanionDeepLink {
  id: string;
  season?: number;
  episode?: number;
}

export interface CompanionSeed {
  title: ExperienceTitle;
  season?: number;
  episode?: number;
}

const SAFE_MEDIA_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/;

function positiveInteger(value: unknown, maximum: number): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum
    ? parsed
    : undefined;
}

/**
 * Keeps legacy companion query links usable without allowing arbitrary values
 * to become a media lookup or service path.
 */
export function parseCompanionDeepLink(
  search: Record<string, unknown>,
): CompanionDeepLink | undefined {
  const id = typeof search.id === "string" ? search.id.trim() : "";
  if (!SAFE_MEDIA_ID.test(id)) return undefined;
  return {
    id,
    season: positiveInteger(search.season, 999),
    episode: positiveInteger(search.episode, 9999),
  };
}

/**
 * Resolves a link only against titles already projected through the active
 * profile's authenticated library/catalog view. This is presentation context;
 * server-side playback and companion actions still perform their own checks.
 */
export function resolveCompanionSeed(
  link: CompanionDeepLink | undefined,
  titles: ExperienceTitle[],
  connection: DebridConnection,
  isChild: boolean,
): CompanionSeed | undefined {
  if (!link) return undefined;
  const title = titles.find(
    (candidate) =>
      candidate.id === link.id || candidate.playbackId === link.id,
  );
  if (!title) return undefined;
  if (!title.sources.some((source) => sourceIsAccessible(source, connection))) {
    return undefined;
  }
  if (isChild && title.family !== true) return undefined;
  const episodic = title.kind === "series";
  return {
    title,
    season: episodic ? link.season : undefined,
    episode: episodic ? link.episode : undefined,
  };
}
