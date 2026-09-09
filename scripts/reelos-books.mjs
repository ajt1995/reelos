/**
 * Legal Books search + phone file download.
 * Gutenberg, Standard Ebooks, Internet Archive public scans only.
 * The browser supplies downloadUrl — treat it as untrusted.
 *
 * Phone Read = GET /api/books/file or /api/books/fetch with
 * Content-Disposition: attachment. No in-app EPUB renderer.
 */
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { basename, extname, join, relative, resolve, sep } from "node:path";
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
export const BOOKS_DIR = process.env.REELOS_BOOKS_DIR || "/srv/media/books";

const IA_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const BOOK_EXTS = new Set([".epub", ".pdf", ".mobi", ".azw3", ".txt", ".cbz", ".cbr"]);

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
    if (relative(booksDir, filePath).startsWith("..") || relative(booksDir, filePath).includes(`..${sep}`)) {
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

export function mimeForPath(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".epub") return "application/epub+zip";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".mobi") return "application/x-mobipocket-ebook";
  if (ext === ".azw3") return "application/vnd.amazon.ebook";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  if (ext === ".cbz") return "application/vnd.comicbook+zip";
  if (ext === ".cbr") return "application/vnd.comicbook-rar";
  return "application/octet-stream";
}

export function contentDisposition(filename) {
  const ascii = String(filename)
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function shelfId(rel) {
  return `shelf-${Buffer.from(String(rel), "utf8").toString("base64url")}`;
}

export function relFromShelfId(id) {
  if (typeof id !== "string" || !id.startsWith("shelf-")) return null;
  const payload = id.slice(6);
  if (!payload || /[^A-Za-z0-9_-]/.test(payload)) return null;
  try {
    const rel = Buffer.from(payload, "base64url").toString("utf8");
    if (!rel || /[\u0000-\u001f]/.test(rel)) return null;
    if (Buffer.from(rel, "utf8").toString("base64url") !== payload) return null;
    return rel;
  } catch {
    return null;
  }
}

export function resolveShelfPath(id, booksDir = BOOKS_DIR) {
  const rel = relFromShelfId(id);
  if (!rel || rel.includes("\0") || rel.split(/[/\\]/).includes("..")) return null;
  const root = resolve(booksDir);
  const filePath = resolve(root, rel);
  const prefix = root.endsWith(sep) ? root : root + sep;
  if (filePath !== root && !filePath.startsWith(prefix)) return null;
  return filePath;
}

export async function listShelfBooks(booksDir = BOOKS_DIR) {
  const root = resolve(booksDir);
  /** @type {{ id: string, title: string, author: string, format: string, rel: string, bytes: number }[]} */
  const out = [];
  try {
    await walk(root, root, out);
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "ENOENT") return [];
    throw e;
  }
  out.sort((a, b) => a.title.localeCompare(b.title) || a.author.localeCompare(b.author));
  return out;
}

async function walk(root, dir, out) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(root, full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = extname(entry.name).toLowerCase();
    if (!BOOK_EXTS.has(ext)) continue;
    const rel = relative(root, full);
    if (!rel || rel.startsWith("..")) continue;
    const info = await stat(full);
    const author = rel.includes(sep) ? rel.split(sep)[0] : "Unknown Author";
    const title = basename(entry.name, ext);
    out.push({
      id: shelfId(rel),
      title,
      author,
      source: "On this box",
      format: ext.slice(1).toUpperCase(),
      rel,
      bytes: info.size,
      downloadUrl: `/api/books/file?id=${encodeURIComponent(shelfId(rel))}`,
    });
  }
}

export function pipeBookFile(res, filePath) {
  const name = basename(filePath);
  res.statusCode = 200;
  res.setHeader("content-type", mimeForPath(filePath));
  res.setHeader("content-disposition", contentDisposition(name));
  res.setHeader("cache-control", "no-store");
  createReadStream(filePath).pipe(res);
}

export function opdsFeed(books, origin) {
  const base = String(origin || "").replace(/\/$/, "");
  const entries = books
    .map((b) => {
      const href = `${base}${b.downloadUrl.startsWith("/") ? b.downloadUrl : `/${b.downloadUrl}`}`;
      const type = mimeForPath(b.rel || b.title);
      return `<entry>
  <title>${escapeXml(b.title)}</title>
  <author><name>${escapeXml(b.author)}</name></author>
  <id>${escapeXml(b.id)}</id>
  <link rel="http://opds-spec.org/acquisition" href="${escapeXml(href)}" type="${escapeXml(type)}"/>
</entry>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>ReelOS Books</title>
  <id>reelos-books</id>
${entries}
</feed>
`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
