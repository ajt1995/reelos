import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  contentDisposition,
  listShelfBooks,
  mimeForPath,
  resolveShelfPath,
  shelfId,
} from "./reelos-books.mjs";

test("shelf listing only returns real files on disk", async () => {
  const root = mkdtempSync(join(tmpdir(), "reelos-books-"));
  assert.deepEqual(await listShelfBooks(join(root, "missing")), []);
  mkdirSync(join(root, "Mary Shelley"), { recursive: true });
  writeFileSync(join(root, "Mary Shelley", "Frankenstein.epub"), "epub");
  writeFileSync(join(root, "Mary Shelley", "notes.txt"), "txt");
  writeFileSync(join(root, "Mary Shelley", "cover.jpg"), "nope");
  const books = await listShelfBooks(root);
  assert.equal(books.length, 2);
  assert.equal(books[0].title, "Frankenstein");
  assert.equal(books[0].author, "Mary Shelley");
  assert.equal(books[0].format, "EPUB");
  assert.match(books[0].id, /^shelf-/);
});

test("shelf ids cannot climb out of the books directory", () => {
  const root = mkdtempSync(join(tmpdir(), "reelos-books-"));
  assert.equal(resolveShelfPath("shelf-not-base64", root), null);
  assert.equal(resolveShelfPath(shelfId("../passwd"), root), null);
  assert.equal(resolveShelfPath(shelfId("..\\windows"), root), null);
  const ok = resolveShelfPath(shelfId("Author/Book.epub"), root);
  assert.ok(ok && ok.startsWith(root));
});

test("phone download headers force an attachment, not inline render", () => {
  assert.match(contentDisposition("Dracula.epub"), /^attachment;/);
  assert.match(contentDisposition("Dracula.epub"), /filename="Dracula.epub"/);
  assert.equal(mimeForPath("/srv/media/books/a.epub"), "application/epub+zip");
  assert.equal(mimeForPath("/srv/media/books/a.pdf"), "application/pdf");
  assert.equal(mimeForPath("/srv/media/books/a.mobi"), "application/x-mobipocket-ebook");
});
