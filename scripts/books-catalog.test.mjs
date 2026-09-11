import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BOOKS_DIR,
  dedupe,
  extensionFor,
  opdsLinks,
  ownsDownload,
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
  assert.equal(resolveBookRel("../etc/passwd"), null);
  assert.equal(resolveBookRel("/etc/passwd"), null);
  assert.equal(resolveBookRel("Bram/../../etc/passwd"), null);
});

test("download hosts are the legal catalogs only", () => {
  assert.equal(ownsDownload(new URL("https://www.gutenberg.org/ebooks/345.epub.images")), true);
  assert.equal(ownsDownload(new URL("https://gutenberg.org/cache/epub/345/pg345.epub")), true);
  assert.equal(ownsDownload(new URL("https://aleph.gutenberg.org/1/3/4/134/134-0.txt")), true);
  assert.equal(ownsDownload(new URL("https://standardebooks.org/ebooks/bram-stoker/dracula/downloads/bram-stoker_dracula.epub")), true);
  assert.equal(ownsDownload(new URL("https://archive.org/download/dracula00stok/dracula00stok.epub")), true);
  assert.equal(ownsDownload(new URL("https://ia800301.us.archive.org/foo.epub")), true);
  assert.equal(ownsDownload(new URL("https://piratebay.example/x.epub")), false);
  assert.equal(ownsDownload(new URL("https://gutendex.com/books/345.epub")), false);
});
