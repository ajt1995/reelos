import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SAMPLE_MOVIES, seedSampleLibrary } from "./sample-library-seed.mjs";

test("sample-library-seed: provides valid public domain titles", () => {
  assert.ok(Array.isArray(SAMPLE_MOVIES));
  assert.ok(SAMPLE_MOVIES.length >= 4);

  for (const movie of SAMPLE_MOVIES) {
    assert.ok(movie.id, "Movie must have id");
    assert.ok(movie.title, "Movie must have title");
    assert.ok(movie.year > 1900 && movie.year < 2000, "Movie must be classic public domain");
    assert.ok(movie.streamUrl.startsWith("https://archive.org/"), "Stream URL must point to archive.org");
    assert.equal(movie.isPublicDomain, true);
    assert.ok(movie.genres.length > 0);
  }
});

test("sample-library-seed: seedSampleLibrary writes manifest cleanly", () => {
  const tmp = mkdtempSync(join(tmpdir(), "reelos-sample-test-"));
  try {
    const result = seedSampleLibrary(tmp);
    assert.equal(result.count, SAMPLE_MOVIES.length);
    assert.ok(existsSync(result.seededPath));

    const content = JSON.parse(readFileSync(result.seededPath, "utf8"));
    assert.equal(content.version, "1.0.0");
    assert.equal(content.movies.length, SAMPLE_MOVIES.length);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("Night sample metadata matches the probed full-film SD source", () => {
  const movie = SAMPLE_MOVIES.find((item) => item.id === "night-of-the-living-dead-1968");
  assert.equal(movie.streamUrl, "https://archive.org/download/night_of_the_living_dead_dvd/Night.mp4");
  assert.equal(movie.videoCodec, "480p H.264");
  assert.equal(movie.audioCodec, "AAC");
});
