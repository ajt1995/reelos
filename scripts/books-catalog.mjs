/**
 * Pure parsing and naming helpers for the Books catalogs.
 *
 * Open-access only: Project Gutenberg, Standard Ebooks, Internet Archive.
 * Kept apart from the HTTP handlers so OPDS parsing and library path rules
 * can be tested without a network or a filesystem.
 *
 * @typedef {"gutenberg" | "standardebooks" | "archive"} SourceId
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

/**
 * @param {BookResult[]} results
 * @param {string} q
 * @returns {BookResult[]}
 */
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
    h.endsWith(".archive.org")
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
