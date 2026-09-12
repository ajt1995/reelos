/**
 * Books HTTP: legal catalogs only. Phone Download is the file. Kavita is the box library.
 */
import { createReadStream, createWriteStream, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { rm, mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  BOOKS_DIR,
  FEATURED_OPEN_BOOKS,
  LICENSED_HONESTY,
  MAX_BOOK_BYTES,
  PER_SOURCE_LIMIT,
  catalogRelevant,
  dedupe,
  extensionFor,
  featuredFallback,
  filterOpenHits,
  iaKeepable,
  isHttps,
  mapGoogleVolume,
  mapOpenLibraryWork,
  ownsDownload,
  parseGutenbergOpds,
  parseStandardEbooksFeed,
  rank,
  resolveBookRel,
  safeSegment,
} from "./books-catalog.mjs";

const SEARCH_TIMEOUT_MS = 8000;
const DOWNLOAD_TIMEOUT_MS = 120_000;
const BOOK_UA = "ReelOS-books";

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
  const res = await fetch(url, {
    signal,
    headers: { accept: "application/json", "user-agent": BOOK_UA },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function mapGutendex(data) {
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

async function gutenbergViaOpenLibrary(q, signal) {
  const params = new URLSearchParams({
    q,
    limit: String(PER_SOURCE_LIMIT * 2),
    fields: "title,author_name,id_project_gutenberg,first_publish_year",
  });
  const data = await getJson(`https://openlibrary.org/search.json?${params}`, signal);
  const out = [];
  for (const doc of data.docs ?? []) {
    const ids = doc.id_project_gutenberg;
    if (!Array.isArray(ids) || !ids.length) continue;
    const gid = String(ids[0]).replace(/\D/g, "");
    if (!gid) continue;
    const author = (doc.author_name ?? []).join(", ") || "Unknown";
    if (!catalogRelevant({ title: doc.title, author }, q)) continue;
    out.push({
      id: `gutenberg-ol-${gid}`,
      sourceId: "gutenberg",
      title: doc.title ?? "Untitled",
      author,
      source: "Project Gutenberg",
      year: typeof doc.first_publish_year === "number" ? doc.first_publish_year : null,
      format: "EPUB",
      downloadUrl: `https://www.gutenberg.org/cache/epub/${gid}/pg${gid}-images.epub`,
    });
    if (out.length >= PER_SOURCE_LIMIT) break;
  }
  return out;
}

async function gutenbergOpds(q, signal) {
  const res = await fetch(
    `https://www.gutenberg.org/ebooks/search.opds/?query=${encodeURIComponent(q)}`,
    { signal, headers: { accept: "application/atom+xml,application/xml,text/xml", "user-agent": BOOK_UA } },
  );
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return parseGutenbergOpds(await res.text());
}

const gutenberg = {
  id: "gutenberg",
  label: "Project Gutenberg",
  async search(q, signal) {
    try {
      const data = await getJson(`https://gutendex.com/books?search=${encodeURIComponent(q)}`, signal);
      const mapped = mapGutendex(data);
      if (mapped.length) return mapped;
    } catch {
      /* gutendex 403s from some clouds — OPDS next, then Holmes-class fallback. */
    }
    try {
      const opds = await gutenbergOpds(q, signal);
      if (opds.length) return opds;
    } catch {
      /* Gutenberg.org itself 403s from this VM too. */
    }
    try {
      return await gutenbergViaOpenLibrary(q, signal);
    } catch {
      return [];
    }
  },
  async browse(signal) {
    try {
      const data = await getJson("https://gutendex.com/books?sort=popular", signal);
      const mapped = mapGutendex(data);
      if (mapped.length) return mapped;
    } catch {
      /* ignore */
    }
    try {
      const res = await fetch("https://www.gutenberg.org/ebooks/search.opds/?sort_order=downloads", {
        signal,
        headers: { accept: "application/atom+xml,application/xml,text/xml", "user-agent": BOOK_UA },
      });
      if (res.ok) {
        const parsed = parseGutenbergOpds(await res.text());
        if (parsed.length) return parsed;
      }
    } catch {
      /* ignore */
    }
    return [];
  },
};

const standardEbooks = {
  id: "standardebooks",
  label: "Standard Ebooks",
  async search(q, signal) {
    const res = await fetch(
      `https://standardebooks.org/feeds/opds/all?query=${encodeURIComponent(q)}`,
      { signal, headers: { accept: "application/atom+xml", "user-agent": BOOK_UA } },
    );
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return parseStandardEbooksFeed(await res.text());
  },
  async browse(signal) {
    const res = await fetch("https://standardebooks.org/feeds/opds/all?query=the", {
      signal,
      headers: { accept: "application/atom+xml", "user-agent": BOOK_UA },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return parseStandardEbooksFeed(await res.text());
  },
};

const IA_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

async function archiveFileUrl(identifier, signal) {
  const data = await getJson(`https://archive.org/metadata/${identifier}/files`, signal);
  const files = data.result ?? [];
  const epub = files.find((f) => typeof f?.name === "string" && f.name.toLowerCase().endsWith(".epub"));
  const pdf = files.find((f) => typeof f?.name === "string" && f.name.toLowerCase().endsWith(".pdf"));
  const file = epub || pdf;
  if (!file) return null;
  return {
    url: `https://archive.org/download/${identifier}/${encodeURIComponent(file.name)}`,
    format: epub ? "EPUB" : "PDF",
  };
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
    const candidates = (data.docs ?? []).filter((d) => iaKeepable(d)).slice(0, PER_SOURCE_LIMIT);
    const resolved = await Promise.all(
      candidates.map(async (doc) => {
        const identifier = doc.ia.find((v) => typeof v === "string" && IA_ID.test(v));
        if (!identifier) return null;
        const got = await archiveFileUrl(identifier, signal).catch(() => null);
        if (!got) return null;
        return {
          id: `ia-${identifier}`,
          sourceId: "archive",
          title: doc.title ?? "Untitled",
          author: (doc.author_name ?? []).join(", ") || "Unknown",
          source: "Internet Archive",
          year: typeof doc.first_publish_year === "number" ? doc.first_publish_year : null,
          format: got.format,
          downloadUrl: got.url,
        };
      }),
    );
    return resolved.filter(Boolean);
  },
};

const SOURCES = [gutenberg, standardEbooks, internetArchive];

function googleBooksKey() {
  const env = String(process.env.GOOGLE_BOOKS_API_KEY || "").trim();
  if (env) return env;
  try {
    const ui = JSON.parse(readFileSync("/var/lib/reelos/ui-settings.json", "utf8"));
    return String(ui.googleBooksApiKey || "").trim();
  } catch {
    return "";
  }
}

async function searchGoogleBooks(q, signal) {
  const params = new URLSearchParams({
    q,
    maxResults: "8",
    printType: "books",
  });
  const key = googleBooksKey();
  if (key) params.set("key", key);
  const data = await getJson(`https://www.googleapis.com/books/v1/volumes?${params}`, signal);
  return (data.items ?? []).map(mapGoogleVolume);
}

async function searchOpenLibraryLicensed(q, signal) {
  const params = new URLSearchParams({
    q,
    limit: "8",
    fields: "key,title,author_name,first_publish_year,isbn,cover_i,ebook_access,ia",
  });
  const data = await getJson(`https://openlibrary.org/search.json?${params}`, signal);
  return (data.docs ?? [])
    .filter((d) => !iaKeepable(d))
    .filter((d) => catalogRelevant({ title: d.title, author: (d.author_name ?? []).join(", ") }, q))
    .slice(0, 8)
    .map(mapOpenLibraryWork);
}

async function browseLicensed(signal) {
  try {
    const g = await searchGoogleBooks("subject:young adult fiction", signal);
    return g.filter((x) => x.kind === "licensed").slice(0, 8);
  } catch {
    try {
      const params = new URLSearchParams({
        q: "the hunger games suzanne collins",
        limit: "5",
        fields: "key,title,author_name,first_publish_year,isbn,cover_i,ebook_access,ia",
      });
      const data = await getJson(`https://openlibrary.org/search.json?${params}`, signal);
      return (data.docs ?? [])
        .filter((d) =>
          catalogRelevant({ title: d.title, author: (d.author_name ?? []).join(", ") }, "hunger games"),
        )
        .slice(0, 5)
        .map(mapOpenLibraryWork);
    } catch {
      return [];
    }
  }
}

function splitGoogle(mapped) {
  const open = [];
  const licensed = [];
  for (const item of mapped) {
    if (item.kind === "open") {
      try {
        if (!ownsDownload(new URL(item.downloadUrl))) {
          licensed.push({
            kind: "licensed",
            id: item.id,
            title: item.title,
            author: item.author,
            year: item.year,
            source: item.source,
            isbn: null,
            cover: item.cover ?? null,
            previewUrl: null,
            openLibraryKey: null,
            publicDomain: true,
            actions: [],
            honesty: LICENSED_HONESTY,
          });
          continue;
        }
      } catch {
        continue;
      }
      const { kind: _k, ...book } = item;
      open.push(book);
    } else if (item.kind === "licensed") {
      licensed.push(item);
    }
  }
  return { open, licensed };
}

function publicBook(book) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    source: book.source,
    year: book.year ?? null,
    format: book.format,
    downloadUrl: book.downloadUrl,
    cover: book.cover ?? null,
  };
}

async function handleSearch(req, res) {
  const u = new URL(req.url || "/", "http://reelos.local");
  const q = String(u.searchParams.get("q") || "").trim().slice(0, 200);
  if (!q) {
    send(res, 200, { results: [], licensed: [], unavailable: [], honesty: LICENSED_HONESTY });
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
  let open = filterOpenHits(dedupe(rank(results, q)), q);
  if (!open.length) {
    const fallback = featuredFallback(q);
    if (fallback.length) open = fallback;
  }

  /** @type {ReturnType<typeof mapOpenLibraryWork>[]} */
  let licensed = [];
  try {
    const g = await searchGoogleBooks(q, AbortSignal.timeout(SEARCH_TIMEOUT_MS));
    const split = splitGoogle(g.filter((x) => catalogRelevant(x, q)));
    open = dedupe([...split.open, ...open]);
    licensed.push(...split.licensed);
  } catch (e) {
    console.error("Google Books search failed:", e);
    unavailable.push("Google Books");
  }
  try {
    licensed.push(...(await searchOpenLibraryLicensed(q, AbortSignal.timeout(SEARCH_TIMEOUT_MS))));
  } catch (e) {
    console.error("Open Library licensed search failed:", e);
    if (!unavailable.includes("Internet Archive")) unavailable.push("Open Library");
  }

  const openKeys = new Set(open.map((b) => `${normalizeKey(b.title)}|${normalizeKey(b.author)}`));
  licensed = dedupeLicensed(
    licensed.filter((b) => !openKeys.has(`${normalizeKey(b.title)}|${normalizeKey(b.author)}`)),
  ).slice(0, 8);

  send(res, 200, {
    results: open.map(publicBook),
    licensed,
    unavailable,
    honesty: licensed.length ? LICENSED_HONESTY : undefined,
  });
}

function normalizeKey(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dedupeLicensed(items) {
  const seen = new Set();
  return items.filter((b) => {
    const key = `${normalizeKey(b.title)}|${normalizeKey(b.author)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function handleDiscover(_req, res) {
  const unavailable = [];
  const live = [];
  const settled = await Promise.allSettled(
    SOURCES.map((s) =>
      typeof s.browse === "function"
        ? s.browse(AbortSignal.timeout(SEARCH_TIMEOUT_MS))
        : Promise.resolve([]),
    ),
  );
  settled.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") live.push(...outcome.value);
    else unavailable.push(SOURCES[i].label);
  });
  const featured = dedupe([...FEATURED_OPEN_BOOKS, ...live]).slice(0, 16);
  let licensed = [];
  try {
    licensed = (await browseLicensed(AbortSignal.timeout(SEARCH_TIMEOUT_MS))).slice(0, 8);
  } catch {
    unavailable.push("Google Books");
  }
  send(res, 200, {
    featured: featured.map(publicBook),
    licensed,
    unavailable,
    honesty: LICENSED_HONESTY,
  });
}

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
      if (!/\.(epub|txt|pdf)$/i.test(name)) continue;
      let st;
      try {
        st = statSync(path.join(folder, name));
      } catch {
        continue;
      }
      if (!st.isFile() || !st.size) continue;
      out.push({
        title: name.replace(/\.(epub|txt|pdf)$/i, ""),
        author: dir.name,
        rel: `${dir.name}/${name}`,
        bytes: st.size,
      });
    }
  }
  return out;
}

async function fetchAllowlisted(url) {
  if (url.protocol !== "https:" || !ownsDownload(url)) {
    return { error: `ReelOS does not download books from ${url.hostname}.` };
  }
  const res = await fetch(url, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    headers: { "user-agent": BOOK_UA },
  });
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
  if (/\.pdf$/i.test(name)) return "application/pdf";
  return "application/epub+zip";
}

async function handleFile(req, res) {
  const u = new URL(req.url || "/", "http://reelos.local");
  const rel = u.searchParams.get("rel");
  const rawUrl = u.searchParams.get("url");
  const inline = u.searchParams.get("inline") === "1" || u.searchParams.get("dl") === "0";
  const disposition = inline ? "inline" : "attachment";
  if (rel) {
    const abs = resolveBookRel(rel, path);
    if (!abs || !existsSync(abs)) {
      send(res, 404, { ok: false, error: "No such book on this box." });
      return;
    }
    const name = path.basename(abs);
    res.statusCode = 200;
    res.setHeader("content-type", contentTypeFor(name));
    res.setHeader("content-disposition", `${disposition}; filename="${name.replace(/"/g, "")}"`);
    if (inline) res.setHeader("cache-control", "private, max-age=120");
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
      res.setHeader("content-disposition", `${disposition}; filename="${name.replace(/"/g, "")}"`);
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

function extFromName(name) {
  if (/\.pdf$/i.test(name)) return ".pdf";
  if (/\.txt$/i.test(name)) return ".txt";
  return ".epub";
}

/**
 * @param {Buffer} buf
 * @param {string} contentType
 */
function parseMultipartFile(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!m) return null;
  const boundary = `--${(m[1] || m[2] || "").trim()}`;
  const head = buf.toString("latin1", 0, Math.min(buf.length, 8192));
  const filename = /filename="([^"]+)"/i.exec(head)?.[1];
  const sep = buf.indexOf(Buffer.from("\r\n\r\n"));
  if (sep < 0) return null;
  const start = sep + 4;
  const endMark = Buffer.from(`\r\n${boundary}`);
  let end = buf.indexOf(endMark, start);
  if (end < 0) end = buf.length;
  return { filename: filename || "sideload.epub", bytes: buf.subarray(start, end) };
}

async function handleSideload(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    send(res, 405, { ok: false, error: "POST a DRM-free EPUB or PDF you own" });
    return;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const buf = Buffer.concat(chunks);
  if (!buf.length) {
    send(res, 200, { ok: false, error: "Empty upload." });
    return;
  }
  if (buf.length > MAX_BOOK_BYTES) {
    send(res, 200, { ok: false, error: "That file is too large for the books library." });
    return;
  }
  const type = String(req.headers["content-type"] || "");
  let filename = String(req.headers["x-book-filename"] || "").replace(/[/\\]/g, "");
  let bytes = buf;
  if (/multipart\/form-data/i.test(type)) {
    const parsed = parseMultipartFile(buf, type);
    if (!parsed) {
      send(res, 200, { ok: false, error: "Could not read the uploaded file." });
      return;
    }
    filename = parsed.filename;
    bytes = parsed.bytes;
  }
  const ext = extFromName(filename);
  if (!/\.(epub|pdf|txt)$/i.test(filename) && type && !/epub|pdf|text\/plain/i.test(type)) {
    send(res, 200, { ok: false, error: "Sideload DRM-free EPUB or PDF only." });
    return;
  }
  const title =
    String(req.headers["x-book-title"] || "").trim() ||
    filename.replace(/\.(epub|pdf|txt)$/i, "") ||
    "Sideload";
  const author = String(req.headers["x-book-author"] || "").trim() || "Unknown Author";
  const authorDir = path.join(BOOKS_DIR, safeSegment(author, "Unknown Author"));
  const filePath = path.join(authorDir, safeSegment(title, "Untitled") + ext);
  if (path.relative(BOOKS_DIR, filePath).startsWith("..")) {
    send(res, 200, { ok: false, error: "Refusing to write outside the books library." });
    return;
  }
  try {
    await mkdir(authorDir, { recursive: true });
    await writeFile(filePath, bytes);
    send(res, 200, {
      ok: true,
      rel: path.relative(BOOKS_DIR, filePath),
      filename: path.basename(filePath),
    });
  } catch (e) {
    send(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
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
  if (pathOnly === "/api/books/discover" || pathOnly === "/api/books/catalog") {
    await handleDiscover(req, res);
    return true;
  }
  if (pathOnly === "/api/books/download") {
    await handleDownload(req, res);
    return true;
  }
  if (pathOnly === "/api/books/sideload") {
    await handleSideload(req, res);
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
