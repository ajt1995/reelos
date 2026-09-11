import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BOOKS_DIR,
  FEATURED_OPEN_BOOKS,
  LICENSED_HONESTY,
  catalogRelevant,
  dedupe,
  extensionFor,
  featuredFallback,
  filterOpenHits,
  iaKeepable,
  legalActions,
  mapGoogleVolume,
  mapOpenLibraryWork,
  opdsLinks,
  ownsDownload,
  parseGutenbergOpds,
  parseStandardEbooksFeed,
  rank,
  resolveBookRel,
  safeSegment,
} from "./books-catalog.mjs";

/**
 * Trimmed from a live https://standardebooks.org/feeds/opds/all?query=dracula
 * response. Acquisition hrefs carry `?source=feed`, rel is `/open-access`,
 * and rel follows href on some links and precedes it on others.
 */
const SE_FEED = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <title>Standard Ebooks - All Ebooks</title>
  <entry>
    <id>https://standardebooks.org/ebooks/bram-stoker/dracula</id>
    <title>Dracula</title>
    <author>
      <name>Bram Stoker</name>
      <uri>https://standardebooks.org/ebooks/bram-stoker</uri>
    </author>
    <published>2014-05-25T00:00:00Z</published>
    <link href="https://standardebooks.org/ebooks/bram-stoker/dracula/downloads/cover.jpg" rel="http://opds-spec.org/image" type="image/jpeg"/>
    <link href="https://standardebooks.org/ebooks/bram-stoker/dracula/downloads/bram-stoker_dracula.epub?source=feed" length="633860" rel="http://opds-spec.org/acquisition/open-access" title="Recommended compatible epub" type="application/epub+zip" />
    <link href="https://standardebooks.org/ebooks/bram-stoker/dracula/downloads/bram-stoker_dracula_advanced.epub?source=feed" length="575173" rel="http://opds-spec.org/acquisition/open-access" title="Advanced epub" type="application/epub+zip" />
    <link href="https://standardebooks.org/ebooks/bram-stoker/dracula/downloads/bram-stoker_dracula.kepub.epub?source=feed" length="625383" rel="http://opds-spec.org/acquisition/open-access" title="Kobo Kepub epub" type="application/kepub+zip" />
    <link href="https://standardebooks.org/ebooks/bram-stoker/dracula/text/single-page" length="1009543" rel="http://opds-spec.org/acquisition/open-access" title="XHTML" type="application/xhtml+xml" />
  </entry>
</feed>`;

test("an acquisition href keeps its query string", () => {
  const [book] = parseStandardEbooksFeed(SE_FEED);
  assert.equal(
    book.downloadUrl,
    "https://standardebooks.org/ebooks/bram-stoker/dracula/downloads/bram-stoker_dracula.epub?source=feed",
  );
});

test("Standard Ebooks entries carry title, author and year", () => {
  const [book] = parseStandardEbooksFeed(SE_FEED);
  assert.equal(book.title, "Dracula");
  assert.equal(book.author, "Bram Stoker");
  assert.equal(book.year, 2014);
  assert.equal(book.source, "Standard Ebooks");
});

test("the recommended epub wins over the device-specific builds", () => {
  const [book] = parseStandardEbooksFeed(SE_FEED);
  assert.match(book.downloadUrl, /bram-stoker_dracula\.epub/);
  assert.doesNotMatch(book.downloadUrl, /advanced|kepub/);
});

test("the feed title is not mistaken for an entry", () => {
  const books = parseStandardEbooksFeed(SE_FEED);
  assert.equal(books.length, 1);
  assert.notEqual(books[0].title, "Standard Ebooks - All Ebooks");
});

test("an entry with no epub acquisition link is skipped", () => {
  const xhtmlOnly = SE_FEED.replace(/type="application\/epub\+zip"/g, 'type="application/xhtml+xml"');
  assert.deepEqual(parseStandardEbooksFeed(xhtmlOnly), []);
});

test("link attributes are read by name, in any order", () => {
  const links = opdsLinks('<link rel="self" href="https://example.test/a" type="text/html"/>');
  assert.deepEqual(links, [{ rel: "self", href: "https://example.test/a", type: "text/html" }]);
});

test("entities in attributes and text are decoded once", () => {
  const feed = SE_FEED.replace("<title>Dracula</title>", "<title>Jekyll &amp; Hyde</title>");
  assert.equal(parseStandardEbooksFeed(feed)[0].title, "Jekyll & Hyde");
});

test("a title that is only separators falls back rather than naming nothing", () => {
  assert.equal(safeSegment("...", "Untitled"), "Untitled");
  assert.equal(safeSegment("", "Untitled"), "Untitled");
  assert.equal(safeSegment(undefined, "Unknown Author"), "Unknown Author");
});

test("a segment can never climb out of the library", () => {
  assert.doesNotMatch(safeSegment("../../etc/passwd", "Untitled"), /[/\\.]/);
  assert.doesNotMatch(safeSegment("..\\..\\windows", "Untitled"), /[/\\.]/);
  assert.equal(safeSegment("..", "Untitled"), "Untitled");
});

test("accents and apostrophes survive sanitising", () => {
  assert.equal(safeSegment("Les Misérables", "Untitled"), "Les Misérables");
  assert.equal(safeSegment("Alice's Adventures", "Untitled"), "Alice's Adventures");
});

test("an exact title match sorts above a fuzzy one", () => {
  const results = [
    { title: "Dracula's Guest", author: "Bram Stoker" },
    { title: "Dracula", author: "Bram Stoker" },
  ];
  assert.equal(rank(results, "dracula")[0].title, "Dracula");
});

test("the same book from two catalogs is listed once", () => {
  const results = [
    { title: "Dracula", author: "Bram Stoker", source: "Standard Ebooks" },
    { title: "DRACULA", author: "Bram  Stoker", source: "Project Gutenberg" },
  ];
  const deduped = dedupe(results);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].source, "Standard Ebooks");
});

test("the extension follows the file, then the content type", () => {
  assert.equal(extensionFor(new URL("https://x.test/a.epub?source=feed"), null), ".epub");
  assert.equal(extensionFor(new URL("https://x.test/a"), "application/epub+zip"), ".epub");
  assert.equal(extensionFor(new URL("https://x.test/a.txt"), null), ".txt");
});

test("resolveBookRel stays inside the library", () => {
  assert.equal(resolveBookRel("Bram Stoker/Dracula.epub"), `${BOOKS_DIR}/Bram Stoker/Dracula.epub`);
  assert.equal(resolveBookRel(""), null);
  assert.equal(resolveBookRel(".."), null);
  assert.equal(resolveBookRel("../etc/passwd"), `${BOOKS_DIR}/etc/passwd`);
  assert.equal(resolveBookRel("/etc/passwd"), `${BOOKS_DIR}/etc/passwd`);
  assert.equal(resolveBookRel("Bram/../../etc/passwd"), `${BOOKS_DIR}/Bram/etc/passwd`);
  const abs = resolveBookRel("Bram/../../etc/passwd");
  assert.equal(abs.startsWith(`${BOOKS_DIR}/`), true);
  assert.equal(abs.includes(".."), false);
});

test("download hosts are the legal catalogs only", () => {
  assert.equal(ownsDownload(new URL("https://www.gutenberg.org/ebooks/345.epub.images")), true);
  assert.equal(ownsDownload(new URL("https://gutenberg.org/cache/epub/345/pg345.epub")), true);
  assert.equal(ownsDownload(new URL("https://aleph.gutenberg.org/1/3/4/134/134-0.txt")), true);
  assert.equal(ownsDownload(new URL("https://standardebooks.org/ebooks/bram-stoker/dracula/downloads/bram-stoker_dracula.epub")), true);
  assert.equal(ownsDownload(new URL("https://archive.org/download/dracula00stok/dracula00stok.epub")), true);
  assert.equal(ownsDownload(new URL("https://ia800301.us.archive.org/foo.epub")), true);
  assert.equal(ownsDownload(new URL("https://books.google.com/books/download/x.epub")), true);
  assert.equal(ownsDownload(new URL("https://books.googleusercontent.com/books/content?id=x")), true);
  assert.equal(ownsDownload(new URL("https://piratebay.example/x.epub")), false);
  assert.equal(ownsDownload(new URL("https://gutendex.com/books/345.epub")), false);
});

test("Hunger Games does not match a Robert E. Howard open-catalog leftover", () => {
  const howard = { title: "A Witch Shall Be Born", author: "Robert E. Howard" };
  assert.equal(catalogRelevant(howard, "Hunger Games"), false);
  assert.equal(
    filterOpenHits(
      [howard, { title: "The Hunger Games", author: "Suzanne Collins" }],
      "Hunger Games",
    ).map((b) => b.title).join(),
    "The Hunger Games",
  );
});

test("Holmes-class PD featured shelf does not depend on gutendex", () => {
  assert.ok(FEATURED_OPEN_BOOKS.some((b) => /sherlock holmes/i.test(b.title)));
  const holmes = featuredFallback("holmes");
  assert.ok(holmes.length >= 1);
  assert.ok(holmes.every((b) => /holmes|doyle/i.test(`${b.title} ${b.author}`)));
  assert.equal(featuredFallback("Hunger Games").length, 0);
  assert.match(FEATURED_OPEN_BOOKS[0].downloadUrl, /^https:\/\/standardebooks\.org\//);
});

test("IA keep-files refuse post-PD years even if ebook_access is public", () => {
  assert.equal(iaKeepable({ ebook_access: "public", first_publish_year: 1892, ia: ["x"] }), true);
  assert.equal(iaKeepable({ ebook_access: "public", first_publish_year: 2008, ia: ["hungergames"] }), false);
  assert.equal(iaKeepable({ ebook_access: "public", ia: ["mystery"] }), false);
  assert.equal(iaKeepable({ ebook_access: "borrowable", first_publish_year: 1892, ia: ["x"] }), false);
});

test("Google Books PD downloadLink is open; ACSM/in-copyright is licensed metadata", () => {
  const pd = mapGoogleVolume({
    id: "pg1",
    volumeInfo: { title: "Dracula", authors: ["Bram Stoker"], publishedDate: "1897" },
    accessInfo: { publicDomain: true, epub: { downloadLink: "https://books.google.com/books/download/Dracula.epub" } },
  });
  assert.equal(pd.kind, "open");
  assert.match(pd.downloadUrl, /books\.google\.com/);
  const hg = mapGoogleVolume({
    id: "hg1",
    volumeInfo: {
      title: "The Hunger Games",
      authors: ["Suzanne Collins"],
      publishedDate: "2008",
      industryIdentifiers: [{ type: "ISBN_13", identifier: "9780439023481" }],
      previewLink: "https://books.google.com/books?id=hg1",
    },
    accessInfo: {
      publicDomain: false,
      epub: { isAvailable: true, acsTokenLink: "https://books.google.com/books/download/acs" },
    },
  });
  assert.equal(hg.kind, "licensed");
  assert.equal(hg.downloadUrl, undefined);
  assert.ok(hg.actions.some((a) => a.label === "Bookshop"));
  assert.ok(hg.actions.some((a) => a.label === "Libby"));
  assert.doesNotMatch(JSON.stringify(hg.actions), /acsTokenLink|pirate/i);
});

test("Open Library Hunger Games work is licensed buy/borrow, not a keep-file", () => {
  const work = mapOpenLibraryWork({
    key: "/works/OL5736962W",
    title: "The Hunger Games",
    author_name: ["Suzanne Collins"],
    first_publish_year: 2008,
    isbn: ["9780439023481"],
  });
  assert.equal(work.kind, "licensed");
  assert.match(work.honesty, /keep-file/);
  assert.ok(work.actions.some((a) => a.kind === "borrow" && a.label === "Open Library"));
});

test("legal actions are storefronts, not file URLs", () => {
  const acts = legalActions({ title: "The Hunger Games", author: "Suzanne Collins" });
  assert.ok(acts.every((a) => /^https:\/\//.test(a.url)));
  assert.ok(acts.some((a) => a.url.includes("bookshop.org")));
  assert.ok(acts.some((a) => a.url.includes("libbyapp.com")));
  assert.doesNotMatch(acts.map((a) => a.url).join(" "), /epub|torrent|nzb/i);
  assert.match(LICENSED_HONESTY, /TorBox/);
});

test("Gutenberg OPDS entries keep an https epub acquisition", () => {
  const xml = `<?xml version="1.0"?>
  <feed>
    <entry>
      <id>https://www.gutenberg.org/ebooks/1661</id>
      <title>The Adventures of Sherlock Holmes</title>
      <author><name>Doyle, Arthur Conan</name></author>
      <link rel="http://opds-spec.org/acquisition" href="/ebooks/1661.epub.images" type="application/epub+zip"/>
    </entry>
  </feed>`;
  const [book] = parseGutenbergOpds(xml);
  assert.equal(book.title, "The Adventures of Sherlock Holmes");
  assert.equal(book.downloadUrl, "https://www.gutenberg.org/ebooks/1661.epub.images");
});

test("PDF extension follows the file", () => {
  assert.equal(extensionFor(new URL("https://x.test/a.pdf"), null), ".pdf");
  assert.equal(extensionFor(new URL("https://x.test/a"), "application/pdf"), ".pdf");
});

