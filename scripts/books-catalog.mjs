/**
 * Pure parsing and naming helpers for the Books catalogs.
 *
 * Open-access only: Project Gutenberg, Standard Ebooks, Internet Archive.
 * Kept apart from the HTTP handlers so OPDS parsing and library path rules
 * can be tested without a network or a filesystem.
 *
 * @typedef {"gutenberg" | "standardebooks" | "archive" | "googlebooks"} SourceId
 *
 * @typedef {object} BookResult
 * @property {string} id
 * @property {SourceId} sourceId
 * @property {string} title
 * @property {string} author
 * @property {string} source
 * @property {number | null} year
 * @property {string} format
 * @property {string} downloadUrl
 */

export const PER_SOURCE_LIMIT = 10;
export const BOOKS_DIR = "/srv/media/books";
export const MAX_BOOK_BYTES = 200 * 1024 * 1024;

/** @param {string} s */
export function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * @param {string} scope
 * @param {string} tag
 * @returns {string | null}
 */
export function tagText(scope, tag) {
  const m = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`).exec(scope);
  return m ? decodeEntities(m[1]).trim() : null;
}

/**
 * OPDS feeds order link attributes however they like and hang query strings off
 * acquisition hrefs, so match the whole tag and read attributes by name.
 *
 * @param {string} entry
 * @returns {Record<string, string>[]}
 */
export function opdsLinks(entry) {
  /** @type {Record<string, string>[]} */
  const links = [];
  for (const tag of entry.match(/<link\b[^>]*\/?>/g) ?? []) {
    /** @type {Record<string, string>} */
    const attrs = {};
    for (const a of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) {
      attrs[a[1]] = decodeEntities(a[2]);
    }
    links.push(attrs);
  }
  return links;
}

/** @param {string} url */
export function isHttps(url) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * @param {string | null} value
 * @returns {number | null}
 */
export function yearOf(value) {
  const year = value ? Number(value.slice(0, 4)) : NaN;
  return Number.isInteger(year) ? year : null;
}

/**
 * @param {string} xml
 * @returns {BookResult[]}
 */
export function parseStandardEbooksFeed(xml) {
  /** @type {BookResult[]} */
  const out = [];
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    if (out.length >= PER_SOURCE_LIMIT) break;
    const entry = match[1];
    const title = tagText(entry, "title");
    const id = tagText(entry, "id");
    if (!title || !id) continue;

    const links = opdsLinks(entry).filter((l) =>
      (l.rel ?? "").startsWith("http://opds-spec.org/acquisition"),
    );
    const epub =
      links.find((l) => l.type === "application/epub+zip" && /recommended/i.test(l.title ?? "")) ??
      links.find((l) => l.type === "application/epub+zip");
    if (!epub?.href || !isHttps(epub.href)) continue;

    const authorBlock = /<author>([\s\S]*?)<\/author>/.exec(entry);
    out.push({
      id: `se-${id.replace(/[^a-zA-Z0-9]+/g, "-")}`,
      sourceId: "standardebooks",
      title,
      author: (authorBlock && tagText(authorBlock[1], "name")) || "Unknown",
      source: "Standard Ebooks",
      year: yearOf(tagText(entry, "published")),
      format: "EPUB",
      downloadUrl: epub.href,
    });
  }
  return out;
}

/** @param {string} s */
export function normalize(s) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function rank(results, q) {
  const needle = normalize(q);
  /** @param {BookResult} b */
  const score = (b) => {
    const title = normalize(b.title);
    if (title === needle) return 0;
    if (title.startsWith(needle)) return 1;
    if (title.includes(needle)) return 2;
    return 3;
  };
  return results
    .map((b, i) => ({ b, i, s: score(b) }))
    .sort((x, y) => x.s - y.s || x.i - y.i)
    .map((x) => x.b);
}

/**
 * @param {BookResult[]} results
 * @returns {BookResult[]}
 */
export function dedupe(results) {
  const seen = new Set();
  return results.filter((b) => {
    const key = `${normalize(b.title)}|${normalize(b.author)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * NFC, not NFKD: decomposing "Les Misérables" would strip the accent.
 *
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string}
 */
export function safeSegment(value, fallback) {
  const cleaned =
    typeof value === "string"
      ? value
          .normalize("NFC")
          .replace(/[/\\]/g, " ")
          .replace(/[^\p{L}\p{N} ,'’-]/gu, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 120)
      : "";
  return cleaned && !/^\.+$/.test(cleaned) ? cleaned : fallback;
}

/**
 * @param {URL} url
 * @param {string | null} contentType
 * @returns {string}
 */
export function extensionFor(url, contentType) {
  if (/\.epub$/i.test(url.pathname)) return ".epub";
  if (/\.pdf$/i.test(url.pathname) || /application\/pdf/i.test(contentType ?? "")) return ".pdf";
  if (/epub/i.test(contentType ?? "")) return ".epub";
  if (/\.txt$/i.test(url.pathname) || /text\/plain/i.test(contentType ?? "")) return ".txt";
  return ".epub";
}

/**
 * A download is only fetched if some source claims its host.
 * @param {URL} url
 */
export function ownsDownload(url) {
  const h = url.hostname;
  return (
    h === "www.gutenberg.org" ||
    h === "gutenberg.org" ||
    h.endsWith(".gutenberg.org") ||
    h === "standardebooks.org" ||
    h.endsWith(".standardebooks.org") ||
    h === "archive.org" ||
    h.endsWith(".archive.org") ||
    h === "gutenberg.pglaf.org" ||
    h.endsWith(".pglaf.org") ||
    h === "books.google.com" ||
    h.endsWith(".books.google.com") ||
    h.endsWith(".googleusercontent.com")
  );
}

/**
 * @param {string} rel
 * @param {Pick<import("node:path"), "join" | "relative" | "isAbsolute">} [path]
 * @returns {string | null} absolute path inside BOOKS_DIR, or null if it would escape
 */
export function resolveBookRel(rel, path) {
  const p = path ?? joinPath();
  const cleaned = String(rel || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter((seg) => seg && seg !== "." && seg !== "..");
  if (!cleaned.length) return null;
  const abs = p.join(BOOKS_DIR, ...cleaned);
  const relToRoot = p.relative(BOOKS_DIR, abs);
  if (!relToRoot || relToRoot.startsWith("..") || p.isAbsolute(relToRoot)) return null;
  return abs;
}

function joinPath() {
  return {
    join: (...parts) => parts.join("/").replace(/\/+/g, "/"),
    relative: (from, to) => {
      const a = from.replace(/\/+$/, "").split("/").filter(Boolean);
      const b = to.replace(/\/+$/, "").split("/").filter(Boolean);
      let i = 0;
      while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
      const up = a.slice(i).map(() => "..");
      return [...up, ...b.slice(i)].join("/") || ".";
    },
    isAbsolute: (x) => String(x).startsWith("/"),
  };
}

/** US public-domain cutoff for IA keep-files (95-year term; 1930 entered PD in 2026). */
export const US_PD_YEAR_MAX = 1930;

const STOP_TOKENS = new Set([
  "the",
  "a",
  "an",
  "of",
  "and",
  "or",
  "in",
  "to",
  "for",
  "on",
  "at",
  "by",
  "from",
  "with",
  "series",
  "book",
  "vol",
  "volume",
  "pt",
  "part",
]);

/**
 * @param {string} q
 * @returns {string[]}
 */
export function queryTokens(q) {
  return normalize(q)
    .split(" ")
    .filter((t) => t.length >= 3 && !STOP_TOKENS.has(t));
}

/**
 * Open-catalog hits must actually be the searched work.
 * Kills Robert E. Howard (or any PD leftover) as a Hunger Games stand-in.
 *
 * @param {{ title?: string, author?: string }} book
 * @param {string} q
 */
export function catalogRelevant(book, q) {
  const needle = String(q || "").trim();
  if (!needle) return true;
  const hay = normalize(`${book?.title ?? ""} ${book?.author ?? ""}`);
  const tokens = queryTokens(needle);
  if (!tokens.length) return hay.includes(normalize(needle));
  return tokens.every((t) => hay.includes(t));
}

/**
 * @template { { title?: string, author?: string } } T
 * @param {T[]} results
 * @param {string} q
 * @returns {T[]}
 */
export function filterOpenHits(results, q) {
  return results.filter((b) => catalogRelevant(b, q));
}

/**
 * IA "public" ebooks published after the PD cutoff are not a keep-file this box may fetch.
 * @param {{ ebook_access?: string, first_publish_year?: number, ia?: unknown }} doc
 */
export function iaKeepable(doc) {
  if (doc?.ebook_access !== "public") return false;
  const y = doc.first_publish_year;
  if (typeof y !== "number" || y > US_PD_YEAR_MAX) return false;
  return Array.isArray(doc.ia) && doc.ia.length > 0;
}

export const LICENSED_HONESTY =
  "In-copyright titles (Hunger Games and the like) cannot be fetched as a keep-file. No Google Books, TorBox, or Seerr API gives this box the full EPUB. Buy it, borrow it from a library, or sideload a DRM-free file you already own into /srv/media/books.";

/**
 * Store / library URLs only — never a full-file fetch.
 *
 * @param {{ title: string, author?: string, isbn?: string | null, openLibraryKey?: string | null, previewUrl?: string | null }} book
 */
export function legalActions(book) {
  const q = encodeURIComponent([book.title, book.author].filter(Boolean).join(" "));
  const titleQ = encodeURIComponent(book.title);
  /** @type {{ kind: "buy" | "borrow" | "preview", label: string, url: string }[]} */
  const out = [
    { kind: "buy", label: "Bookshop", url: `https://bookshop.org/search?keywords=${q}` },
    { kind: "buy", label: "Kobo", url: `https://www.kobo.com/us/en/search?query=${q}` },
    { kind: "buy", label: "Google Play", url: `https://play.google.com/store/search?c=books&q=${q}` },
    { kind: "buy", label: "Amazon", url: `https://www.amazon.com/s?k=${q}` },
    { kind: "buy", label: "Smashwords", url: `https://www.smashwords.com/books/search?query=${q}` },
    { kind: "borrow", label: "Libby", url: `https://libbyapp.com/search/search/query-${titleQ}/page-1` },
    {
      kind: "borrow",
      label: "Open Library",
      url: book.openLibraryKey
        ? `https://openlibrary.org${book.openLibraryKey}`
        : `https://openlibrary.org/search?q=${q}`,
    },
  ];
  if (book.previewUrl && /^https:/i.test(book.previewUrl)) {
    out.unshift({ kind: "preview", label: "Preview", url: book.previewUrl });
  }
  return out;
}

/**
 * @param {string} href
 * @returns {string}
 */
export function upgradeHttps(href) {
  try {
    const u = new URL(href);
    if (u.protocol === "http:") {
      const h = u.hostname;
      if (
        h === "www.gutenberg.org" ||
        h === "gutenberg.org" ||
        h.endsWith(".gutenberg.org") ||
        h === "standardebooks.org" ||
        h === "books.google.com"
      ) {
        u.protocol = "https:";
        return u.toString();
      }
    }
    return href;
  } catch {
    return href;
  }
}

/**
 * Gutenberg OPDS search. Acquisition hrefs are often `/ebooks/1661.epub.images`.
 *
 * @param {string} xml
 * @returns {import("./books-catalog.mjs").BookResult[]}
 */
export function parseGutenbergOpds(xml) {
  /** @type {ReturnType<typeof parseStandardEbooksFeed>} */
  const out = [];
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    if (out.length >= PER_SOURCE_LIMIT) break;
    const entry = match[1];
    const title = tagText(entry, "title") || tagText(entry, "dc:title");
    if (!title) continue;
    const links = opdsLinks(entry);
    const epub = links.find(
      (l) =>
        /epub/i.test(l.type ?? "") ||
        /\.epub/i.test(l.href ?? "") ||
        /epub/i.test(l.title ?? ""),
    );
    if (!epub?.href) continue;
    let href = epub.href;
    if (href.startsWith("/")) href = `https://www.gutenberg.org${href}`;
    href = upgradeHttps(href);
    if (!isHttps(href)) continue;
    const authorBlock = /<author>([\s\S]*?)<\/author>/.exec(entry);
    const id = tagText(entry, "id") || href;
    out.push({
      id: `gutenberg-opds-${id.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 80)}`,
      sourceId: "gutenberg",
      title,
      author: (authorBlock && tagText(authorBlock[1], "name")) || tagText(entry, "dc:creator") || "Unknown",
      source: "Project Gutenberg",
      year: yearOf(tagText(entry, "dc:issued") || tagText(entry, "published")),
      format: "EPUB",
      downloadUrl: href,
    });
  }
  return out;
}

/**
 * Google Books volume → open keep-file (PD downloadLink only) or licensed metadata.
 * Never follows acsTokenLink (Adobe DRM).
 *
 * @param {Record<string, unknown>} item
 */
export function mapGoogleVolume(item) {
  const info = /** @type {Record<string, unknown>} */ (item?.volumeInfo || {});
  const access = /** @type {Record<string, unknown>} */ (item?.accessInfo || {});
  const sale = /** @type {Record<string, unknown>} */ (item?.saleInfo || {});
  const title = String(info.title || "Untitled");
  const authors = Array.isArray(info.authors) ? info.authors.map(String) : [];
  const author = authors.join(", ") || "Unknown";
  const ids = Array.isArray(info.industryIdentifiers) ? info.industryIdentifiers : [];
  const isbn13 = ids.find((i) => i && /** @type {any} */ (i).type === "ISBN_13");
  const isbn10 = ids.find((i) => i && /** @type {any} */ (i).type === "ISBN_10");
  const isbn = String(/** @type {any} */ (isbn13 || isbn10)?.identifier || "") || null;
  const epub = /** @type {Record<string, unknown>} */ (access.epub || {});
  const pdf = /** @type {Record<string, unknown>} */ (access.pdf || {});
  const publicDomain = access.publicDomain === true;
  const acs = typeof epub.acsTokenLink === "string" || typeof pdf.acsTokenLink === "string";
  const rawDl =
    publicDomain && !acs && typeof epub.downloadLink === "string"
      ? epub.downloadLink
      : publicDomain && !acs && typeof pdf.downloadLink === "string"
        ? pdf.downloadLink
        : "";
  const downloadUrl = rawDl ? upgradeHttps(rawDl) : "";
  const previewUrl =
    typeof info.previewLink === "string"
      ? info.previewLink
      : typeof access.webReaderLink === "string"
        ? access.webReaderLink
        : null;
  const year = yearOf(String(info.publishedDate || ""));
  const cover =
    info.imageLinks && typeof /** @type {any} */ (info.imageLinks).thumbnail === "string"
      ? String(/** @type {any} */ (info.imageLinks).thumbnail).replace(/^http:/, "https:")
      : null;
  const id = `gbooks-${String(item.id || title).replace(/[^a-zA-Z0-9]+/g, "-")}`;
  if (downloadUrl && isHttps(downloadUrl)) {
    return {
      kind: "open",
      id,
      sourceId: "googlebooks",
      title,
      author,
      source: "Google Books (public domain)",
      year,
      format: /\.pdf/i.test(downloadUrl) ? "PDF" : "EPUB",
      downloadUrl,
      cover,
    };
  }
  return {
    kind: "licensed",
    id,
    title,
    author,
    year,
    source: "Google Books",
    isbn,
    cover,
    previewUrl,
    openLibraryKey: null,
    publicDomain: false,
    actions: legalActions({ title, author, isbn, previewUrl }),
    honesty: LICENSED_HONESTY,
  };
}

/**
 * Open Library search doc → licensed metadata (no keep-file).
 * @param {Record<string, unknown>} doc
 */
export function mapOpenLibraryWork(doc) {
  const title = String(doc.title || "Untitled");
  const author = Array.isArray(doc.author_name) ? doc.author_name.map(String).join(", ") : "Unknown";
  const isbn = Array.isArray(doc.isbn) ? String(doc.isbn[0]) : null;
  const key = typeof doc.key === "string" ? doc.key : null;
  const coverId = typeof doc.cover_i === "number" ? doc.cover_i : null;
  return {
    kind: "licensed",
    id: `ol-${String(key || title).replace(/[^a-zA-Z0-9]+/g, "-")}`,
    title,
    author,
    year: typeof doc.first_publish_year === "number" ? doc.first_publish_year : null,
    source: "Open Library",
    isbn,
    cover: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null,
    previewUrl: key ? `https://openlibrary.org${key}` : null,
    openLibraryKey: key,
    publicDomain: false,
    actions: legalActions({ title, author, isbn, openLibraryKey: key }),
    honesty: LICENSED_HONESTY,
  };
}

/** Holmes-class PD Discover when gutendex 403s. Standard Ebooks keep-files only. */
export const FEATURED_OPEN_BOOKS = [
  seFeatured(
    "The Adventures of Sherlock Holmes",
    "Arthur Conan Doyle",
    "arthur-conan-doyle",
    "the-adventures-of-sherlock-holmes",
    1892,
  ),
  seFeatured(
    "The Hound of the Baskervilles",
    "Arthur Conan Doyle",
    "arthur-conan-doyle",
    "the-hound-of-the-baskervilles",
    1902,
  ),
  seFeatured("Dracula", "Bram Stoker", "bram-stoker", "dracula", 1897),
  seFeatured("Frankenstein", "Mary Shelley", "mary-shelley", "frankenstein", 1818),
  seFeatured("Pride and Prejudice", "Jane Austen", "jane-austen", "pride-and-prejudice", 1813),
  seFeatured(
    "Alice's Adventures in Wonderland",
    "Lewis Carroll",
    "lewis-carroll",
    "alices-adventures-in-wonderland",
    1865,
  ),
  seFeatured("The War of the Worlds", "H. G. Wells", "h-g-wells", "the-war-of-the-worlds", 1898),
  seFeatured("Moby Dick", "Herman Melville", "herman-melville", "moby-dick", 1851),
  seFeatured("Jane Eyre", "Charlotte Brontë", "charlotte-bronte", "jane-eyre", 1847),
  seFeatured("Treasure Island", "Robert Louis Stevenson", "robert-louis-stevenson", "treasure-island", 1883),
  seFeatured("The Picture of Dorian Gray", "Oscar Wilde", "oscar-wilde", "the-picture-of-dorian-gray", 1890),
  seFeatured("A Tale of Two Cities", "Charles Dickens", "charles-dickens", "a-tale-of-two-cities", 1859),
];

/**
 * @param {string} title
 * @param {string} author
 * @param {string} authorSlug
 * @param {string} titleSlug
 * @param {number} year
 */
function seFeatured(title, author, authorSlug, titleSlug, year) {
  const base = `https://standardebooks.org/ebooks/${authorSlug}/${titleSlug}`;
  return {
    id: `se-featured-${titleSlug}`,
    sourceId: "standardebooks",
    title,
    author,
    source: "Standard Ebooks",
    year,
    format: "EPUB",
    downloadUrl: `${base}/downloads/${authorSlug}_${titleSlug}.epub`,
    cover: `${base}/downloads/cover.jpg`,
  };
}

/**
 * @param {string} q
 */
export function featuredFallback(q) {
  const list = FEATURED_OPEN_BOOKS;
  if (!String(q || "").trim()) return list;
  return list.filter((b) => catalogRelevant(b, q));
}
