import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveTitleMetadata,
  enrichTitleSync,
  KNOWN_METADATA,
} from "./metadata-enricher.mjs";

describe("metadata-enricher", () => {
  it("resolves known titles instantly with authentic overviews and genres", async () => {
    const matrix = await resolveTitleMetadata("tmdb-603");
    assert.equal(matrix.title, "The Matrix");
    assert.equal(matrix.year, 1999);
    assert.ok(matrix.overview.includes("Neo") || matrix.overview.includes("computer"));
    assert.ok(matrix.genres.includes("Action"));
    assert.ok(matrix.genres.includes("Sci-Fi"));
    assert.equal(matrix.kind, "movie");
  });

  it("resolves TV series with season lists and creator metadata", async () => {
    const sev = await resolveTitleMetadata("tmdb-tv-95396");
    assert.equal(sev.title, "Severance");
    assert.equal(sev.year, 2022);
    assert.ok(sev.overview.length > 20);
    assert.ok(sev.genres.includes("Drama"));
    assert.ok(sev.seasonList.includes(1));
  });

  it("resolves TVDB aliases cleanly", async () => {
    const sevTvdb = await resolveTitleMetadata("tvdb-371980");
    assert.equal(sevTvdb.title, "Severance");
    assert.equal(sevTvdb.year, 2022);
  });

  it("enrichTitleSync enriches an empty library item with genuine metadata", () => {
    const raw = {
      id: "tmdb-603",
      title: "The Matrix",
      year: 1999,
      overview: "",
      genres: [],
    };
    const enriched = enrichTitleSync(raw);
    assert.ok(enriched.overview.length > 20, "overview must be populated");
    assert.ok(enriched.genres.length > 0, "genres must be populated");
  });

  it("keeps unknown offline metadata explicitly unresolved", async () => {
    const unresolved = await resolveTitleMetadata("__reelos_missing_metadata_fixture_8f3d2c__", { kind: "movie", year: 2025 });
    assert.equal(unresolved.overview, "");
    assert.deepEqual(unresolved.genres, []);
    assert.equal(unresolved.rating, null);
    assert.equal(unresolved.verified, false);
    assert.equal(unresolved.metadataSource, "unavailable");
  });
});
