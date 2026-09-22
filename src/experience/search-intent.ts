import type { ExperienceKind } from "./experience-catalog";

export type SearchIntent = {
  raw: string;
  lookupQuery: string;
  terms: string[];
  excludedTerms: string[];
  kind?: ExperienceKind;
  maxMinutes?: number;
  moods: string[];
  person?: string;
  sceneClue: boolean;
};

export type SearchSuggestion = {
  label: string;
  addition: string;
};

const FILLER = new Set([
  "a",
  "an",
  "and",
  "anything",
  "find",
  "for",
  "give",
  "i",
  "in",
  "is",
  "like",
  "me",
  "movie",
  "movies",
  "of",
  "please",
  "series",
  "show",
  "shows",
  "something",
  "that",
  "the",
  "to",
  "tv",
  "watch",
  "with",
]);

export const SEARCH_MOOD_ALIASES: Record<string, string[]> = {
  comfort: ["comfort", "comforting", "cozy", "gentle", "warm"],
  funny: ["funny", "comedy", "laugh", "lighthearted"],
  dark: ["dark", "grim", "bleak", "noir"],
  quiet: ["quiet", "calm", "patient", "slow"],
  romantic: ["romantic", "romance", "date night"],
  tense: ["tense", "thrilling", "thriller", "suspense"],
  strange: ["strange", "weird", "surreal", "unusual"],
  adventurous: ["adventure", "adventurous", "epic", "big"],
};

export function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

export function parseSearchIntent(rawQuery: string): SearchIntent {
  const raw = rawQuery.trim().slice(0, 240);
  const normalized = normalizeSearchText(raw);
  const excludedTerms: string[] = [];

  for (const match of normalized.matchAll(
    /(?:without|except|exclude|excluding|no)\s+([a-z0-9 ]+?)(?=\s+(?:under|over|with|starring|movie|movies|series|show|book|novel)\b|$)/g,
  )) {
    const phrase = match[1]?.trim();
    if (phrase) excludedTerms.push(...phrase.split(/\s*(?:,|\band\b)\s*/).filter(Boolean));
  }

  let kind: ExperienceKind | undefined;
  if (/\b(book|books|novel|novels|read|reading)\b/.test(normalized)) kind = "book";
  else if (/\b(series|show|shows|tv)\b/.test(normalized)) kind = "series";
  else if (/\b(movie|movies|film|films)\b/.test(normalized)) kind = "movie";

  let maxMinutes: number | undefined;
  const duration = normalized.match(/\b(?:under|less than|shorter than|within)\s+(\d{2,3})\s*(?:minutes?|mins?)?\b/);
  if (duration) maxMinutes = Math.min(360, Math.max(20, Number(duration[1])));
  else if (/\b(short|quick)\b/.test(normalized)) maxMinutes = kind === "series" ? 45 : 100;

  const moods = Object.entries(SEARCH_MOOD_ALIASES)
    .filter(([, aliases]) => aliases.some((alias) => normalized.includes(alias)))
    .map(([mood]) => mood);

  const personMatch = normalized.match(
    /\b(?:with|starring|featuring)\s+([a-z][a-z ]{2,40}?)(?=\s+(?:without|under|less|movie|series|show|book)\b|$)/,
  );
  const person = personMatch?.[1]?.trim() || undefined;
  const sceneClue = /\b(scene|moment|part)\s+(?:where|when|with)\b|\bremember(?:ed)?\b/.test(normalized);

  const clean = normalized
    .replace(/(?:without|except|exclude|excluding|no)\s+[a-z0-9 ]+?(?=\s+(?:under|over|with|starring|movie|movies|series|show|book|novel)\b|$)/g, " ")
    .replace(/\b(?:under|less than|shorter than|within)\s+\d{2,3}\s*(?:minutes?|mins?)?\b/g, " ")
    .replace(/\b(?:short|quick)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const terms = unique(
    clean
      .split(" ")
      .filter(Boolean)
      .filter(
        (word) =>
          word.length > 2 &&
          !FILLER.has(word) &&
          !["film", "films", "book", "books", "novel", "novels", "read", "reading"].includes(word),
      ),
  );

  return {
    raw,
    lookupQuery: person || terms.join(" ") || raw,
    terms,
    excludedTerms: unique(excludedTerms.map(normalizeSearchText).filter(Boolean)),
    kind,
    maxMinutes,
    moods,
    person,
    sceneClue,
  };
}

export function suggestionsForIntent(intent: SearchIntent): SearchSuggestion[] {
  const suggestions: SearchSuggestion[] = [];
  if (!intent.kind) {
    suggestions.push(
      { label: "Movies", addition: " movie" },
      { label: "Series", addition: " series" },
      { label: "Books", addition: " books" },
    );
  }
  if (!intent.maxMinutes) suggestions.push({ label: "Under 100 min", addition: " under 100 minutes" });
  if (!intent.excludedTerms.length) suggestions.push({ label: "No horror", addition: " without horror" });
  return suggestions.slice(0, 5);
}
