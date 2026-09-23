import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { projectPlaybackSources, readPlaybackLibraryItems } from "./playback-access-service.mjs";
import { NativeMediaRegistry } from "./native-media-registry.mjs";

const allowed = (sourceKind, sourcePolicy = {}) => ({ ok: true, sourceKind, sourcePolicy });

test("projects a verified public-domain route without inventing codec readiness", () => {
  const [source] = projectPlaybackSources({
    id: "night-of-the-living-dead-1968",
    source: { id: "archive-source", kind: "public_domain" },
    publicUrl: "https://archive.org/download/example/movie.mp4",
  }, allowed("public_domain"));
  assert.equal(source.name, "Public-domain source");
  assert.equal(source.streamUrl, "/api/stream/item/night-of-the-living-dead-1968");
  assert.equal(source.available, true);
  assert.equal(source.directPlayReady, false);
  assert.equal(source.compatibility, "unverified");
});

test("projects only the currently connected provider binding", () => {
  const item = {
    id: "media-private",
    source: { id: "tb-source", kind: "provider_stream", provider: "torbox", infohash: "a".repeat(40), torrentId: 8, fileId: 7 },
    infohash: "a".repeat(40),
    providerFileId: 7,
  };
  assert.equal(projectPlaybackSources(item, allowed("debrid", { connected: false, provider: "torbox" })).length, 0);
  assert.equal(projectPlaybackSources(item, allowed("debrid", { connected: true, provider: "realdebrid" })).length, 0);
  const [source] = projectPlaybackSources(item, allowed("debrid", { connected: true, provider: "torbox" }));
  assert.equal(source.name, "Connected provider");
  assert.equal(source.streamUrl, "/api/stream/item/media-private");
});

test("projects a verified local file but refuses missing local bytes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-source-projection-"));
  const file = path.join(dir, "movie.mp4");
  fs.writeFileSync(file, Buffer.from("verified fixture"));
  try {
    const item = { id: "personal-film", source: { id: "personal-source", kind: "personal_import" }, path: file,
      fileReceipt: { sizeBytes: fs.statSync(file).size } };
    const [source] = projectPlaybackSources(item, allowed("personal_import"));
    assert.equal(source.container, "mp4");
    assert.equal(source.name, "Original file");
    assert.equal(projectPlaybackSources({ ...item, path: `${file}.missing` }, allowed("personal_import")).length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("native registry presence does not hide separately verified personal shelf items", () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-library-merge-"));
  try {
    const registry = new NativeMediaRegistry({ stateDir });
    registry.register({ itemId: "public-film", workId: "public-film", editionId: "archive-edition",
      title: "Public Film", mediaType: "movie", source: { id: "public-source", kind: "public_domain",
        verified: true, uri: "https://archive.org/download/example/movie.mp4" } });
    fs.writeFileSync(path.join(stateDir, "library-shelf.json"), JSON.stringify({ titles: [
      { id: "personal-film", title: "Personal Film", sourceKind: "personal_import", path: "C:\\Media\\personal.mp4" },
      { id: "public-film", title: "Stale Duplicate" },
    ] }));
    const items = readPlaybackLibraryItems({ stateDir });
    assert.deepEqual(items.map((item) => item.id).sort(), ["personal-film", "public-film"]);
    assert.equal(items.find((item) => item.id === "public-film").title, "Public Film");
  } finally {
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});
