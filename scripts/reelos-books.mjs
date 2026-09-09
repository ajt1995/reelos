/**
 * Legal Books search + download. Gutenberg, Standard Ebooks, Internet Archive
 * public scans only. The browser supplies downloadUrl — treat it as untrusted.
 */
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  PER_SOURCE_LIMIT,
  dedupe,
  extensionFor,
  isHttps,
  ownsDownload,
  parseStandardEbooksFeed,
  rank,
  safeSegment,
} from "./books-catalog.mjs";

export { ownsDownload, safeSegment };

const SEARCH_TIMEOUT_MS = 8000;
const DOWNLOAD_TIMEOUT_MS = 120_000;
const MAX_BOOK_BYTES = 200 * 1024 * 1024;
export const BOOKS_DIR = "/srv/media/books";

const IA_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

async function getJson(url, signal) {
  const res = await fetch(url, { signal, headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function searchGutenberg(q, signal) {
  const data = await getJson(`https://gutendex.com/books?search=${encodeURIComponent(q)}`, signal);
  const out = [];
  for (const book of (data.results ?? []).slice(0, PER_SOURCE_LIMIT)) {
    const formats = book.formats ?? {};
    const key =
      Object.keys(formats).find((k) => k.startsWith("application/epub")) ??
      Object.keys(formats).find((k) => k.startsWith("text/plain") && !k.includes("zip"));
    if (!key || !isHttps(formats[key])) continue;
    out.push({
      id: `gutenberg-${book.id}`,
      sourceId: "gutenberg",
      title: book.title ?? "Untitled",
      author: (book.authors ?? []).map((a) => a.name).join(", ") || "Unknown",
      source: "Project Gutenberg",
      year: null,
      format: key.startsWith("application/epub") ? "EPUB" : "TXT",
      downloadUrl: formats[key],
    });
  }
  return out;
}

async function searchStandardEbooks(q, signal) {
  const res = await fetch(
    `https://standardebooks.org/feeds/opds/all?query=${encodeURIComponent(q)}`,
    { signal, headers: { accept: "application/atom+xml" } },
  );
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return parseStandardEbooksFeed(await res.text());
}

async function archiveEpubUrl(identifier, signal) {
  const data = await getJson(`https://archive.org/metadata/${identifier}/files`, signal);
  const file = (data.result ?? []).find(
    (f) => typeof f?.name === "string" && f.name.toLowerCase().endsWith(".epub"),
  );
  return file
    ? `https://archive.org/download/${identifier}/${encodeURIComponent(file.name)}`
    : null;
}

async function searchInternetArchive(q, signal) {
  const params = new URLSearchParams({
    q,
    limit: String(PER_SOURCE_LIMIT * 2),
    fields: "key,title,author_name,ia,ebook_access,first_publish_year",
  });
  const data = await getJson(`https://openlibrary.org/search.json?${params}`, signal);
  const candidates = (data.docs ?? [])
    .filter((d) => d.ebook_access === "public" && Array.isArray(d.ia) && d.ia.length > 0)
    .slice(0, PER_SOURCE_LIMIT);

  const resolved = await Promise.all(
    candidates.map(async (doc) => {
      const identifier = doc.ia.find((v) => typeof v === "string" && IA_ID.test(v));
      if (!identifier) return null;
      const url = await archiveEpubUrl(identifier, signal).catch(() => null);
      if (!url) return null;
      return {
        id: `ia-${identifier}`,
        sourceId: "archive",
        title: doc.title ?? "Untitled",
        author: (doc.author_name ?? []).join(", ") || "Unknown",
        source: "Internet Archive",
        year: typeof doc.first_publish_year === "number" ? doc.first_publish_year : null,
        format: "EPUB",
        downloadUrl: url,
      };
    }),
  );
  return resolved.filter(Boolean);
}

const SOURCES = [
  { id: "gutenberg", label: "Project Gutenberg", search: searchGutenberg },
  { id: "standardebooks", label: "Standard Ebooks", search: searchStandardEbooks },
  { id: "archive", label: "Internet Archive", search: searchInternetArchive },
];

export async function searchLegalBooks(q) {
  const query = String(q || "").trim().slice(0, 200);
  if (!query) return { results: [], unavailable: [] };

  const settled = await Promise.allSettled(
    SOURCES.map((s) => s.search(query, AbortSignal.timeout(SEARCH_TIMEOUT_MS))),
  );

  const results = [];
  const unavailable = [];
  settled.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") results.push(...outcome.value);
    else unavailable.push(SOURCES[i].label);
  });

  return { results: dedupe(rank(results, query)), unavailable };
}

export async function downloadLegalBook(book, booksDir = BOOKS_DIR) {
  let url;
  try {
    url = new URL(book?.downloadUrl || "");
  } catch {
    return { ok: false, error: "Not a valid download link." };
  }

  if (url.protocol !== "https:" || !ownsDownload(url)) {
    return { ok: false, error: `ReelOS does not download books from ${url.hostname}.` };
  }

  const authorDir = join(booksDir, safeSegment(book.author, "Unknown Author"));
  const stem = safeSegment(book.title, "Untitled");

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    if (!res.body) throw new Error("Empty response body");

    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_BOOK_BYTES) {
      return { ok: false, error: "That file is too large for the books library." };
    }

    const filePath = join(authorDir, stem + extensionFor(url, res.headers.get("content-type")));
    if (relative(booksDir, filePath).startsWith("..")) {
      return { ok: false, error: "Refusing to write outside the books library." };
    }

    await mkdir(authorDir, { recursive: true });

    const staged = `${filePath}.part`;
    let written = 0;
    const cap = new Transform({
      transform(chunk, _enc, cb) {
        written += chunk.length;
        if (written > MAX_BOOK_BYTES) return cb(new Error("Book exceeds size limit"));
        cb(null, chunk);
      },
    });

    try {
      await pipeline(res.body, cap, createWriteStream(staged));
      await rename(staged, filePath);
    } catch (err) {
      await rm(staged, { force: true });
      throw err;
    }

    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
