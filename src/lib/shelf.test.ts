import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeShelf } from "./shelf.ts";
import type { Title } from "./types.ts";

function title(id: string): Title {
  return {
    id,
    kind: "movie",
    title: id,
    year: 2024,
    rating: 0,
    genres: [],
    overview: "",
    poster: "",
    maxQuality: "4k",
    popularity: 50,
  };
}

test("limited Home merge keeps extra Library titles", () => {
  const prev = [title("a"), title("b"), title("c")];
  const next = [title("a"), title("d")];
  assert.deepEqual(
    mergeShelf(prev, next, true).map((t) => t.id),
    ["a", "d", "b", "c"],
  );
});

test("full Library response replaces the shelf", () => {
  const prev = [title("a"), title("b")];
  const next = [title("c")];
  assert.deepEqual(
    mergeShelf(prev, next, false).map((t) => t.id),
    ["c"],
  );
});
