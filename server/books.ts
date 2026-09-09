import { createServerFn } from "@tanstack/react-start";
import {
  PER_SOURCE_LIMIT,
  dedupe,
  extensionFor,
  isHttps,
  parseStandardEbooksFeed,
  rank,
  safeSegment,
  type BookResult,
  type SourceId,
} from "./books-catalog.mjs";

/**
 * Books comes from open-access catalogs only: Project Gutenberg, Standard
 * Ebooks, and the freely readable slice of the Internet Archive. A shadow
 * library here would make the box a redistribution point, so `downloadBook`
 * refuses any host that no source claims.
 */

export type { BookResult, SourceId };

export interface BookSearchResponse {
  results: BookResult[];
  /** Labels of catalogs that failed or timed out, so the UI can say so. */
  unavailable: string[];
}

const SEARCH_TIMEOUT_MS = 8000;
const DOWNLOAD_TIMEOUT_MS = 120_000;
const MAX_BOOK_BYTES = 200 * 1024 * 1024;
const BOOKS_DIR = "/srv/media/books";

interface Source {
  id: SourceId;
  label: string;
  search: (q: string, signal: AbortSignal) => Promise<BookResult[]>;
  /** A download is only fetched if some source claims its host. */
  ownsDownload: (url: URL) => boolean;
}

async function getJson(url: string, signal: AbortSignal): Promise<any> {
  const res = await fetch(url, {
    signal,
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

const gutenberg: Source = {
  id: "gutenberg",
  label: "Project Gutenberg",
  ownsDownload: (url) =>
    url.hostname === "www.gutenberg.org" || url.hostname === "gutenberg.org",
  async search(q, signal) {
    const data = await getJson(
      `https://gutendex.com/books?search=${encodeURIComponent(q)}`,
      signal,
    );
    const out: BookResult[] = [];
    for (const book of (data.results ?? []).slice(0, PER_SOURCE_LIMIT)) {
      const formats: Record<string, string> = book.formats ?? {};
      // Gutenberg spells epub a few ways (epub, epub3, .images variants) and a
      // handful of titles are plain text only; take the best rather than drop
      // the title, which the old exact `application/epub+zip` lookup did.
      const key =
        Object.keys(formats).find((k) => k.startsWith("application/epub")) ??
        Object.keys(formats).find(
          (k) => k.startsWith("text/plain") && !k.includes("zip"),
        );
      if (!key || !isHttps(formats[key])) continue;
      out.push({
        id: `gutenberg-${book.id}`,
        sourceId: "gutenberg",
        title: book.title ?? "Untitled",
        author:
          (book.authors ?? []).map((a: any) => a.name).join(", ") || "Unknown",
        source: "Project Gutenberg",
        year: null,
        format: key.startsWith("application/epub") ? "EPUB" : "TXT",
        downloadUrl: formats[key],
      });
    }
    return out;
  },
};

const standardEbooks: Source = {
  id: "standardebooks",
  label: "Standard Ebooks",
  ownsDownload: (url) => url.hostname === "standardebooks.org",
  async search(q, signal) {
    // /opds/all 301s to /feeds/opds/all; ask for the real path.
    const res = await fetch(
      `https://standardebooks.org/feeds/opds/all?query=${encodeURIComponent(q)}`,
      { signal, headers: { accept: "application/atom+xml" } },
    );
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return parseStandardEbooksFeed(await res.text());
  },
};

const IA_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

async function archiveEpubUrl(
  identifier: string,
  signal: AbortSignal,
): Promise<string | null> {
  const data = await getJson(
    `https://archive.org/metadata/${identifier}/files`,
    signal,
  );
  const file = (data.result ?? []).find(
    (f: any) =>
      typeof f?.name === "string" && f.name.toLowerCase().endsWith(".epub"),
  );
  return file
    ? `https://archive.org/download/${identifier}/${encodeURIComponent(file.name)}`
    : null;
}

const internetArchive: Source = {
  id: "archive",
  label: "Internet Archive",
  ownsDownload: (url) =>
    url.hostname === "archive.org" || url.hostname.endsWith(".archive.org"),
  async search(q, signal) {
    const params = new URLSearchParams({
      q,
      limit: String(PER_SOURCE_LIMIT * 2),
      fields: "key,title,author_name,ia,ebook_access,first_publish_year",
    });
    const data = await getJson(
      `https://openlibrary.org/search.json?${params}`,
      signal,
    );

    // `ebook_access: "public"` is Open Library's flag for a scan anyone may
    // download. Borrowable and restricted scans are deliberately skipped.
    const candidates: any[] = (data.docs ?? [])
      .filter(
        (d: any) =>
          d.ebook_access === "public" && Array.isArray(d.ia) && d.ia.length > 0,
      )
      .slice(0, PER_SOURCE_LIMIT);

    const resolved = await Promise.all(
      candidates.map(async (doc): Promise<BookResult | null> => {
        const identifier = doc.ia.find(
          (v: unknown) => typeof v === "string" && IA_ID.test(v),
        );
        if (!identifier) return null;
        const url = await archiveEpubUrl(identifier, signal).catch(() => null);
        if (!url) return null;
        return {
          id: `ia-${identifier}`,
          sourceId: "archive",
          title: doc.title ?? "Untitled",
          author: (doc.author_name ?? []).join(", ") || "Unknown",
          source: "Internet Archive",
          year:
            typeof doc.first_publish_year === "number"
              ? doc.first_publish_year
              : null,
          format: "EPUB",
          downloadUrl: url,
        };
      }),
    );
    return resolved.filter((r): r is BookResult => r !== null);
  },
};

const SOURCES: Source[] = [gutenberg, standardEbooks, internetArchive];

export const searchBooks = createServerFn({ method: "GET" })
  .validator((data: { q: string }) => {
    if (typeof data?.q !== "string") throw new Error("q must be a string");
    return { q: data.q.slice(0, 200) };
  })
  .handler(async ({ data }): Promise<BookSearchResponse> => {
    const q = data.q.trim();
    if (!q) return { results: [], unavailable: [] };

    // One slow catalog should not hold up the other two.
    const settled = await Promise.allSettled(
      SOURCES.map((s) => s.search(q, AbortSignal.timeout(SEARCH_TIMEOUT_MS))),
    );

    const results: BookResult[] = [];
    const unavailable: string[] = [];
    settled.forEach((outcome, i) => {
      if (outcome.status === "fulfilled") {
        results.push(...outcome.value);
      } else {
        console.error(`${SOURCES[i].label} search failed:`, outcome.reason);
        unavailable.push(SOURCES[i].label);
      }
    });

    return { results: dedupe(rank(results, q)), unavailable };
  });

export const downloadBook = createServerFn({ method: "POST" })
  .validator(
    (data: {
      book: { title?: string; author?: string; downloadUrl?: string };
    }) => {
      if (!data?.book || typeof data.book.downloadUrl !== "string") {
        throw new Error("book.downloadUrl is required");
      }
      return data;
    },
  )
  .handler(async ({ data }) => {
    const fs = await import("node:fs");
    const fsp = await import("node:fs/promises");
    const path = await import("node:path");
    const { Transform } = await import("node:stream");
    const { pipeline } = await import("node:stream/promises");

    let url: URL;
    try {
      url = new URL(data.book.downloadUrl!);
    } catch {
      return { ok: false as const, error: "Not a valid download link." };
    }

    // The browser supplies this URL, so treat it as untrusted: without the
    // allowlist any caller could make the box fetch an arbitrary host and write
    // the response into the library.
    if (
      url.protocol !== "https:" ||
      !SOURCES.some((s) => s.ownsDownload(url))
    ) {
      return {
        ok: false as const,
        error: `ReelOS does not download books from ${url.hostname}.`,
      };
    }

    const authorDir = path.join(
      BOOKS_DIR,
      safeSegment(data.book.author, "Unknown Author"),
    );
    const stem = safeSegment(data.book.title, "Untitled");

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      if (!res.body) throw new Error("Empty response body");

      const declared = Number(res.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > MAX_BOOK_BYTES) {
        return {
          ok: false as const,
          error: "That file is too large for the books library.",
        };
      }

      const filePath = path.join(
        authorDir,
        stem + extensionFor(url, res.headers.get("content-type")),
      );
      // Belt and braces over safeSegment: never write outside the library.
      if (path.relative(BOOKS_DIR, filePath).startsWith("..")) {
        return {
          ok: false as const,
          error: "Refusing to write outside the books library.",
        };
      }

      await fsp.mkdir(authorDir, { recursive: true });

      // Kavita scans on a timer, so a half-written file in the library reads as
      // a corrupt book. Stage beside the target and rename, which is atomic
      // within one filesystem.
      const staged = `${filePath}.part`;
      let written = 0;
      const cap = new Transform({
        transform(chunk, _enc, cb) {
          written += chunk.length;
          if (written > MAX_BOOK_BYTES)
            return cb(new Error("Book exceeds size limit"));
          cb(null, chunk);
        },
      });

      try {
        await pipeline(res.body as any, cap, fs.createWriteStream(staged));
        await fsp.rename(staged, filePath);
      } catch (err) {
        await fsp.rm(staged, { force: true });
        throw err;
      }

      return { ok: true as const, path: filePath };
    } catch (e) {
      console.error("Book download failed:", e);
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });
