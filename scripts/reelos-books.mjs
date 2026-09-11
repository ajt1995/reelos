/**
 * Books HTTP: legal catalogs only. Phone Download is the file. Kavita is the box library.
 */
import { createReadStream, createWriteStream, existsSync, readdirSync, statSync } from "node:fs";
import { rm, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  BOOKS_DIR,
  MAX_BOOK_BYTES,
  PER_SOURCE_LIMIT,
  dedupe,
  extensionFor,
  isHttps,
  ownsDownload,
  parseStandardEbooksFeed,
  rank,
  resolveBookRel,
  safeSegment,
} from "./books-catalog.mjs";

const SEARCH_TIMEOUT_MS = 8000;
const DOWNLOAD_TIMEOUT_MS = 120_000;

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function getJson(url, signal) {
  const res = await fetch(url, { signal, headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

const gutenberg = {
  id: "gutenberg",
  label: "Project Gutenberg",
  async search(q, signal) {
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
  },
};

const standardEbooks = {
  id: "standardebooks",
  label: "Standard Ebooks",
  async search(q, signal) {
    const res = await fetch(
      `https://standardebooks.org/feeds/opds/all?query=${encodeURIComponent(q)}`,
      { signal, headers: { accept: "application/atom+xml" } },
    );
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return parseStandardEbooksFeed(await res.text());
  },
};

const IA_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

async function archiveEpubUrl(identifier, signal) {
  const data = await getJson(`https://archive.org/metadata/${identifier}/files`, signal);
  const file = (data.result ?? []).find(
    (f) => typeof f?.name === "string" && f.name.toLowerCase().endsWith(".epub"),
  );
  return file
    ? `https://archive.org/download/${identifier}/${encodeURIComponent(file.name)}`
    : null;
}

const internetArchive = {
  id: "archive",
  label: "Internet Archive",
  async search(q, signal) {
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
  },
};

const SOURCES = [gutenberg, standardEbooks, internetArchive];

function listLibrary() {
  /** @type {{ title: string, author: string, rel: string, bytes: number }[]} */
  const out = [];
  if (!existsSync(BOOKS_DIR)) return out;
  let authors = [];
  try {
    authors = readdirSync(BOOKS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  } catch {
    return out;
  }
  for (const dir of authors) {
    const folder = path.join(BOOKS_DIR, dir.name);
    let files = [];
    try {
      files = readdirSync(folder);
    } catch {
      continue;
    }
    for (const name of files) {
      if (name.endsWith(".part")) continue;
      if (!/\.(epub|txt)$/i.test(name)) continue;
      let st;
      try {
        st = statSync(path.join(folder, name));
      } catch {
        continue;
      }
      if (!st.isFile() || !st.size) continue;
      out.push({
        title: name.replace(/\.(epub|txt)$/i, ""),
        author: dir.name,
        rel: `${dir.name}/${name}`,
        bytes: st.size,
      });
    }
  }
  return out;
}

async function handleSearch(req, res) {
  const u = new URL(req.url || "/", "http://reelos.local");
  const q = String(u.searchParams.get("q") || "").trim().slice(0, 200);
  if (!q) {
    send(res, 200, { results: [], unavailable: [] });
    return;
  }
  const settled = await Promise.allSettled(
    SOURCES.map((s) => s.search(q, AbortSignal.timeout(SEARCH_TIMEOUT_MS))),
  );
  const results = [];
  const unavailable = [];
  settled.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") results.push(...outcome.value);
    else {
      console.error(`${SOURCES[i].label} search failed:`, outcome.reason);
      unavailable.push(SOURCES[i].label);
    }
  });
  send(res, 200, { results: dedupe(rank(results, q)), unavailable });
}

async function fetchAllowlisted(url) {
  if (url.protocol !== "https:" || !ownsDownload(url)) {
    return { error: `ReelOS does not download books from ${url.hostname}.` };
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  if (!res.body) throw new Error("Empty response body");
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BOOK_BYTES) {
    return { error: "That file is too large for the books library." };
  }
  return { res, url };
}

async function saveToLibrary(book, url, res) {
  const authorDir = path.join(BOOKS_DIR, safeSegment(book.author, "Unknown Author"));
  const stem = safeSegment(book.title, "Untitled");
  const filePath = path.join(authorDir, stem + extensionFor(url, res.headers.get("content-type")));
  if (path.relative(BOOKS_DIR, filePath).startsWith("..")) {
    return { error: "Refusing to write outside the books library." };
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
  return { path: filePath, rel: path.relative(BOOKS_DIR, filePath), filename: path.basename(filePath) };
}

async function handleDownload(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false, error: "POST a book" });
    return;
  }
  const body = await readBody(req);
  const book = body.book || body;
  if (!book || typeof book.downloadUrl !== "string") {
    send(res, 200, { ok: false, error: "book.downloadUrl is required" });
    return;
  }
  let url;
  try {
    url = new URL(book.downloadUrl);
  } catch {
    send(res, 200, { ok: false, error: "Not a valid download link." });
    return;
  }
  try {
    const got = await fetchAllowlisted(url);
    if (got.error) {
      send(res, 200, { ok: false, error: got.error });
      return;
    }
    try {
      const saved = await saveToLibrary(book, got.url, got.res);
      if (saved.error) {
        send(res, 200, { ok: false, error: saved.error });
        return;
      }
      send(res, 200, { ok: true, rel: saved.rel, filename: saved.filename, path: saved.path });
    } catch (diskErr) {
      console.error("Book save to box failed:", diskErr);
      send(res, 200, {
        ok: true,
        proxy: true,
        filename: `${safeSegment(book.title, "Untitled")}.epub`,
        error: "Saved on the phone only — the box library was not writable.",
      });
    }
  } catch (e) {
    console.error("Book download failed:", e);
    send(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

function contentTypeFor(name) {
  if (/\.txt$/i.test(name)) return "text/plain; charset=utf-8";
  return "application/epub+zip";
}

async function handleFile(req, res) {
  const u = new URL(req.url || "/", "http://reelos.local");
  const rel = u.searchParams.get("rel");
  const rawUrl = u.searchParams.get("url");
  if (rel) {
    const abs = resolveBookRel(rel, path);
    if (!abs || !existsSync(abs)) {
      send(res, 404, { ok: false, error: "No such book on this box." });
      return;
    }
    const name = path.basename(abs);
    res.statusCode = 200;
    res.setHeader("content-type", contentTypeFor(name));
    res.setHeader("content-disposition", `attachment; filename="${name.replace(/"/g, "")}"`);
    createReadStream(abs).pipe(res);
    return;
  }
  if (rawUrl) {
    let url;
    try {
      url = new URL(rawUrl);
    } catch {
      send(res, 400, { ok: false, error: "Not a valid download link." });
      return;
    }
    try {
      const got = await fetchAllowlisted(url);
      if (got.error) {
        send(res, 400, { ok: false, error: got.error });
        return;
      }
      const name = path.basename(url.pathname) || "book.epub";
      res.statusCode = 200;
      res.setHeader("content-type", contentTypeFor(name));
      res.setHeader("content-disposition", `attachment; filename="${name.replace(/"/g, "")}"`);
      if (got.res.body) {
        // @ts-ignore web stream
        await pipeline(got.res.body, res);
      } else {
        res.end();
      }
    } catch (e) {
      if (!res.headersSent) send(res, 502, { ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return;
  }
  send(res, 400, { ok: false, error: "rel or url required" });
}

function handleLibrary(_req, res) {
  send(res, 200, { books: listLibrary() });
}

export async function dispatchBooksApi(req, res) {
  const pathOnly = (req.url ?? "").split("?", 1)[0] ?? "";
  if (pathOnly === "/api/books/search") {
    await handleSearch(req, res);
    return true;
  }
  if (pathOnly === "/api/books/download") {
    await handleDownload(req, res);
    return true;
  }
  if (pathOnly === "/api/books/file") {
    await handleFile(req, res);
    return true;
  }
  if (pathOnly === "/api/books/library") {
    handleLibrary(req, res);
    return true;
  }
  return false;
}
