import {
  EXPERIENCE_CATALOG,
  type ExperienceKind,
  type ExperienceTitle,
} from "./experience-catalog";
import {
  SEARCH_MOOD_ALIASES,
  type SearchIntent,
  type SearchSuggestion,
  normalizeSearchText,
  parseSearchIntent,
  suggestionsForIntent,
} from "./search-intent";
export { parseSearchIntent } from "./search-intent";
import {
  sourceForLookupTitle,
  sourcesForExperienceTitle,
  type ExperienceMediaSource,
} from "./source-access";

export type SearchPerson = {
  id: string;
  name: string;
  poster?: string;
  knownFor?: string;
};

export type SearchCollection = {
  id: string;
  name: string;
  poster?: string;
};

export type SearchBook = {
  id: string;
  title: string;
  author: string;
  source: string;
  year?: number | null;
  format?: string;
  downloadUrl?: string;
  cover?: string | null;
  licensed: boolean;
  honesty?: string;
};

export type ReelSearchResult = {
  intent: SearchIntent;
  titles: ExperienceTitle[];
  people: SearchPerson[];
  collections: SearchCollection[];
  books: SearchBook[];
  suggestions: SearchSuggestion[];
  unavailable: string[];
  notices: string[];
  liveCatalogReached: boolean;
};

type LookupTitle = Record<string, unknown> & {
  id?: unknown;
  title?: unknown;
  name?: unknown;
  year?: unknown;
  kind?: unknown;
  mediaType?: unknown;
  genres?: unknown;
  poster?: unknown;
  backdrop?: unknown;
  banner?: unknown;
  overview?: unknown;
  runtime?: unknown;
  people?: unknown;
  cast?: unknown;
  inLibrary?: unknown;
  jellyfinId?: unknown;
};

type LookupPayload = {
  titles?: LookupTitle[];
  people?: Array<Record<string, unknown>>;
  collections?: Array<Record<string, unknown>>;
  error?: string | null;
};

type BooksPayload = {
  results?: Array<Record<string, unknown>>;
  licensed?: Array<Record<string, unknown>>;
  unavailable?: string[];
  honesty?: string;
};

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) =>
      typeof item === "string"
        ? item
        : typeof item === "object" && item
          ? String((item as { name?: unknown }).name ?? "")
          : "",
    )
    .filter(Boolean);
}

function searchable(title: ExperienceTitle) {
  return normalizeSearchText(
    [title.title, ...title.genres, ...title.people, ...title.moods, title.note].join(" "),
  );
}

function matchesExclusions(title: ExperienceTitle, excluded: string[]) {
  const haystack = searchable(title);
  return !excluded.some((term) => haystack.includes(term));
}

function moodScore(title: ExperienceTitle, intent: SearchIntent) {
  const haystack = searchable(title);
  let score = 0;
  for (const mood of intent.moods) {
    const aliases = SEARCH_MOOD_ALIASES[mood] ?? [mood];
    if (aliases.some((alias) => haystack.includes(normalizeSearchText(alias)))) score += 4;
  }
  return score;
}

export function rankLocalSearch(
  intent: SearchIntent,
  catalog: ExperienceTitle[] = EXPERIENCE_CATALOG,
) {
  if (!intent.raw) return catalog.slice(0, 18);
  return catalog
    .filter((title) => !intent.kind || title.kind === intent.kind)
    .filter((title) => !intent.maxMinutes || title.minutes <= intent.maxMinutes)
    .filter((title) => matchesExclusions(title, intent.excludedTerms))
    .map((title) => {
      const haystack = searchable(title);
      const exact = normalizeSearchText(title.title) === normalizeSearchText(intent.lookupQuery) ? 20 : 0;
      const prefix = normalizeSearchText(title.title).startsWith(normalizeSearchText(intent.lookupQuery)) ? 8 : 0;
      const terms = intent.terms.reduce(
        (score, term) => score + (haystack.includes(term) ? 2 : 0),
        0,
      );
      return { title, score: exact + prefix + terms + moodScore(title, intent) };
    })
    .filter(({ score }) => score > 0 || (!intent.terms.length && intent.moods.length > 0))
    .sort((a, b) => b.score - a.score || b.title.year - a.title.year)
    .map(({ title }) => title);
}

export function mapLookupTitle(raw: LookupTitle): ExperienceTitle | null {
  const id = String(raw.id ?? "").trim();
  const title = String(raw.title ?? raw.name ?? "").trim();
  if (!id || !title) return null;
  const backendKind = String(raw.kind ?? raw.mediaType ?? "movie").toLowerCase();
  const kind: ExperienceKind = backendKind === "tv" || backendKind === "series" ? "series" : "movie";
  const inLibrary = Boolean(raw.inLibrary || raw.jellyfinId);
  const publicLookupSource = sourceForLookupTitle(raw);
  const sources: ExperienceMediaSource[] = inLibrary
    ? [{ kind: "retained_local", verified: true }]
    : publicLookupSource
      ? [publicLookupSource]
      : sourcesForExperienceTitle(id);
  const runtime = Number(raw.runtime);
  const runtimeKnown = Number.isFinite(runtime) && runtime > 0;
  const people = unique([...asStringArray(raw.people), ...asStringArray(raw.cast)]);
  return {
    id,
    title,
    year: Number(raw.year) || 0,
    kind,
    genres: asStringArray(raw.genres),
    poster: String(raw.poster ?? ""),
    backdrop: String(raw.backdrop ?? raw.banner ?? raw.poster ?? ""),
    note: String(raw.overview ?? "").trim() || (inLibrary ? "In your personal library." : "Found in the wider catalog."),
    people,
    moods: [],
    minutes: runtimeKnown ? runtime : 0,
    runtimeKnown,
    sources,
    playbackId: inLibrary ? String(raw.jellyfinId ?? raw.id ?? "") : undefined,
  };
}

export function mergeSearchTitles(
  local: ExperienceTitle[],
  remote: ExperienceTitle[],
  intent: SearchIntent,
) {
  const seen = new Set<string>();
  return [...local, ...remote]
    .filter((title) => !intent.kind || title.kind === intent.kind)
    .filter(
      (title) =>
        !intent.maxMinutes ||
        (title.runtimeKnown !== false && title.minutes <= intent.maxMinutes),
    )
    .filter((title) => matchesExclusions(title, intent.excludedTerms))
    .filter((title) => {
      const key = `${normalizeSearchText(title.title)}:${title.year || ""}:${title.kind}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 36);
}

function mapPerson(raw: Record<string, unknown>): SearchPerson | null {
  const id = String(raw.id ?? raw.tmdbId ?? "").trim();
  const name = String(raw.name ?? "").trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    poster: String(raw.poster ?? "") || undefined,
    knownFor: String(raw.knownForDepartment ?? "") || undefined,
  };
}

function mapCollection(raw: Record<string, unknown>): SearchCollection | null {
  const id = String(raw.id ?? raw.tmdbId ?? "").trim();
  const name = String(raw.name ?? raw.title ?? "").trim();
  if (!id || !name) return null;
  return { id, name, poster: String(raw.poster ?? "") || undefined };
}

function mapBook(raw: Record<string, unknown>, licensed: boolean, honesty?: string): SearchBook | null {
  const id = String(raw.id ?? "").trim();
  const title = String(raw.title ?? "").trim();
  const author = String(raw.author ?? "Unknown").trim();
  if (!id || !title) return null;
  return {
    id,
    title,
    author,
    source: String(raw.source ?? (licensed ? "Catalog" : "Open library")),
    year: Number(raw.year) || null,
    format: String(raw.format ?? "") || undefined,
    downloadUrl: String(raw.downloadUrl ?? "") || undefined,
    cover: String(raw.cover ?? "") || null,
    licensed,
    honesty: String(raw.honesty ?? honesty ?? "") || undefined,
  };
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json() as Promise<T>;
}

export async function searchReelOS(
  rawQuery: string,
  options: { signal?: AbortSignal; includeBooks?: boolean; fetcher?: typeof fetch } = {},
): Promise<ReelSearchResult> {
  const intent = parseSearchIntent(rawQuery);
  const local = rankLocalSearch(intent);
  const fetcher = options.fetcher ?? fetch;
  const includeBooks = options.includeBooks !== false;
  const lookupQuery = intent.lookupQuery.trim();
  const jobs: Array<Promise<{ kind: "lookup" | "books"; value?: LookupPayload | BooksPayload; error?: string }>> = [];

  if (lookupQuery.length >= 2 && intent.kind !== "book") {
    jobs.push(
      fetcher(`/api/lookup?q=${encodeURIComponent(lookupQuery)}`, {
        cache: "no-store",
        signal: options.signal,
      })
        .then((response) => readJson<LookupPayload>(response))
        .then((value) => ({ kind: "lookup" as const, value }))
        .catch((error: unknown) => {
          if ((error as { name?: string })?.name === "AbortError") throw error;
          return { kind: "lookup" as const, error: "Film and television catalog" };
        }),
    );
  }

  if (lookupQuery.length >= 2 && includeBooks) {
    jobs.push(
      fetcher(`/api/books/search?q=${encodeURIComponent(lookupQuery)}`, {
        cache: "no-store",
        signal: options.signal,
      })
        .then((response) => readJson<BooksPayload>(response))
        .then((value) => ({ kind: "books" as const, value }))
        .catch((error: unknown) => {
          if ((error as { name?: string })?.name === "AbortError") throw error;
          return { kind: "books" as const, error: "Books catalog" };
        }),
    );
  }

  const settled = await Promise.all(jobs);
  const lookup = settled.find((item) => item.kind === "lookup")?.value as LookupPayload | undefined;
  const books = settled.find((item) => item.kind === "books")?.value as BooksPayload | undefined;
  const remote = (lookup?.titles ?? []).map(mapLookupTitle).filter((title): title is ExperienceTitle => Boolean(title));
  const people = (lookup?.people ?? []).map(mapPerson).filter((person): person is SearchPerson => Boolean(person));
  const collections = (lookup?.collections ?? [])
    .map(mapCollection)
    .filter((collection): collection is SearchCollection => Boolean(collection));
  const openBooks = (books?.results ?? [])
    .map((book) => mapBook(book, false))
    .filter((book): book is SearchBook => Boolean(book));
  const licensedBooks = (books?.licensed ?? [])
    .map((book) => mapBook(book, true, books?.honesty))
    .filter((book): book is SearchBook => Boolean(book));
  const unavailable = unique([
    ...settled.map((item) => item.error).filter((item): item is string => Boolean(item)),
    ...(books?.unavailable ?? []),
  ]);
  const notices: string[] = [];
  if (intent.sceneClue) {
    notices.push("Scene wording is being used as a catalog clue. Exact scene matching turns on only for media with an indexed timeline.");
  }
  if (lookup?.error && !remote.length) notices.push("The wider film and television catalog did not answer; personal results remain available.");
  if (licensedBooks.length) notices.push(books?.honesty || "Licensed books are shown for discovery; ReelOS does not imply an included download.");

  return {
    intent,
    titles: intent.kind === "book" ? [] : mergeSearchTitles(local, remote, intent),
    people,
    collections,
    books: [...openBooks, ...licensedBooks].slice(0, 16),
    suggestions: suggestionsForIntent(intent),
    unavailable,
    notices,
    liveCatalogReached: settled.some((item) => item.kind === "lookup" && !item.error),
  };
}
