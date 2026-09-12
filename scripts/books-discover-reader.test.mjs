import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("movie/TV Discover still hits Seerr /api/discover, not the books catalog", () => {
  const view = read("src/components/discover-view.tsx");
  assert.match(view, /fetch\("\/api\/discover"/);
  assert.match(view, /fetch\("\/api\/books\/discover"/);
  assert.match(view, /Looking up movies and shows/);
  assert.match(view, /settings\.betaChannel/);
  const plugin = read("scripts/reelos-lookup-plugin.mjs");
  assert.match(plugin, /async function handleDiscover/);
  assert.match(plugin, /seerrFetch\("\/api\/v1\/discover\/movies/);
  assert.match(plugin, /seerrFetch\("\/api\/v1\/discover\/tv/);
  assert.doesNotMatch(plugin, /\/api\/books\/discover/);
});

test("Books Discover, reader, and sideload are wired without Seerr/TorBox novel fetch", () => {
  const books = read("src/components/books-view.tsx");
  assert.match(books, /\/api\/books\/discover/);
  assert.match(books, />Discover</);
  assert.match(books, /Get this legally|In stores and libraries/);
  assert.match(books, /Sideload/);
  assert.match(books, /BookReader/);
  assert.match(books, />\s*Read\s*</);
  assert.match(books, /variant="gold"/);
  assert.match(books, /Download/);
  assert.doesNotMatch(books, /TorBox fetches novels|torrent/i);

  const reader = read("src/components/book-reader.tsx");
  assert.match(reader, /epubjs@0\.3\.93\/dist\/epub\.min\.js/);
  assert.match(reader, /pdf\.js\/3\.11\.174\/pdf\.min\.js/);
  assert.match(reader, /inline=1/);
  assert.match(reader, /DRM-protected/);
  assert.match(reader, /Download/);

  const api = read("scripts/reelos-books.mjs");
  assert.match(api, /\/api\/books\/discover/);
  assert.match(api, /\/api\/books\/sideload/);
  assert.match(api, /inline/);
  assert.match(api, /GOOGLE_BOOKS_API_KEY|googleBooksApiKey/);
  assert.match(api, /LICENSED_HONESTY/);
  assert.doesNotMatch(api, /acsTokenLink/);
});

test("this change ships on 1.2.50.52 behind the beta toggle", () => {
  const ver = read("VERSION").trim();
  assert.equal(ver, "1.2.50.52");
  assert.doesNotMatch(ver, /1\.2\.51/);
  const store = read("src/lib/store.ts");
  assert.match(store, /LATEST_VERSION = "1\.2\.50\.52"/);
  assert.match(store, /betaChannel: false/);
});
