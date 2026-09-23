import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { authorizePlaybackItem, projectPlaybackSources, readPlaybackLibraryItems, readPlaybackSourcePolicy } from "./playback-access-service.mjs";
import { NativeMediaRegistry } from "./native-media-registry.mjs";
import { createProviderValidation, sourcePolicyFromState, writeProviderValidation } from "./source-access-policy.mjs";
import { createPlaybackFixture } from "../test-harness/playback-fixtures.mjs";
import { createMockRequest } from "../test-harness/harness-utils.mjs";

const accountScope = sourcePolicyFromState({
  answers: { source: "torbox", apiKey: "fixture-key" },
  uiSettings: { debridEnabled: true, debridProvider: "torbox", debridStatus: "connected" },
  validation: createProviderValidation("torbox", "fixture-key", "fixture-account"),
}).accountScope;

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
    source: { id: "tb-source", kind: "provider_stream", provider: "torbox", infohash: "a".repeat(40), torrentId: 8, fileId: 7, accountScope },
    infohash: "a".repeat(40),
    providerFileId: 7,
  };
  assert.equal(projectPlaybackSources(item, allowed("debrid", { connected: false, provider: "torbox" })).length, 0);
  assert.equal(projectPlaybackSources(item, allowed("debrid", { connected: true, provider: "realdebrid" })).length, 0);
  const [source] = projectPlaybackSources(item, allowed("debrid", { connected: true, provider: "torbox", accountScope }));
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

test("playback projection follows a reacquired provider torrent", () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-provider-reacquire-"));
  try {
    fs.writeFileSync(path.join(stateDir, "answers.json"), JSON.stringify({ source: "torbox", apiKey: "fixture-key" }));
    fs.writeFileSync(path.join(stateDir, "ui-settings.json"), JSON.stringify({ debridConnection: {
      provider: "torbox", enabled: true, status: "connected",
    } }));
    writeProviderValidation(stateDir, createProviderValidation("torbox", "fixture-key", "fixture-account"));
    const registry = new NativeMediaRegistry({ stateDir });
    for (const torrentId of [10, 11]) registry.register({ workId: "series", editionId: "episode-cut",
      mediaType: "episode", season: 1, episode: 2,
      source: { id: `torrent-${torrentId}`, kind: "provider_stream", provider: "torbox", verified: true,
        binding: { infohash: "a".repeat(40), torrentId, fileId: 2, accountScope } } });
    const [item] = readPlaybackLibraryItems({ stateDir });
    assert.equal(item.source.torrentId, 11);
    assert.equal(item.season, 1);
    assert.equal(item.episode, 2);
  } finally {
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});

test("provider source belongs only to its validated account across disable, switch, and reacquisition", () => {
  const who = createPlaybackFixture();
  const registry = new NativeMediaRegistry({ stateDir: who.stateDir });
  const request = createMockRequest({ url: "/api/stream/item/account-film", headers: { cookie: who.cookie } });
  const register = (id, scope, torrentId) => registry.register({
    itemId: "account-film", workId: "account-film", editionId: "cut-one", title: "Account Film",
    source: { id, kind: "provider_stream", provider: "torbox", verified: true,
      binding: { infohash: "a".repeat(40), torrentId, fileId: 1, accountScope: scope } },
  });
  who.setProvider(true);
  register("account-a", who.providerScope, 10);
  who.writeLibrary([{ id: "account-film", sourceKind: "debrid", title: "Stale shelf duplicate" }]);
  const original = readPlaybackLibraryItems(who.options)[0];
  assert.equal(original.source.accountScope, who.providerScope);
  assert.equal(authorizePlaybackItem(request, original, who.options).ok, true);
  const legacy = { ...original, source: { ...original.source, accountScope: undefined } };
  assert.equal(authorizePlaybackItem(request, legacy, who.options).code, "source_unavailable");
  const legacyState = registry.read();
  delete legacyState.items["account-film"].sources[0].binding.accountScope;
  registry.write(legacyState);
  assert.equal(readPlaybackLibraryItems(who.options).length, 0);
  register("account-a", who.providerScope, 10);
  who.setProvider(false);
  assert.equal(readPlaybackLibraryItems(who.options).length, 0);
  assert.equal(authorizePlaybackItem(request, original, who.options).code, "source_unavailable");
  who.setProvider(true);
  assert.equal(readPlaybackLibraryItems(who.options)[0].source.id, "account-a");
  assert.equal(authorizePlaybackItem(request, original, who.options).ok, true);
  const accountB = createProviderValidation("torbox", "fixture-key-B", "fixture-account-B");
  fs.writeFileSync(path.join(who.stateDir, "answers.json"), JSON.stringify({ source: "torbox", apiKey: "fixture-key-B" }));
  writeProviderValidation(who.stateDir, accountB);
  const scopeB = readPlaybackSourcePolicy(who.options).accountScope;
  assert.notEqual(scopeB, who.providerScope);
  assert.equal(readPlaybackLibraryItems(who.options).length, 0);
  assert.equal(authorizePlaybackItem(request, original, who.options).code, "source_unavailable");
  assert.deepEqual(projectPlaybackSources(original, allowed("debrid", readPlaybackSourcePolicy(who.options))), []);
  register("account-b", scopeB, 11);
  const reacquired = readPlaybackLibraryItems(who.options)[0];
  assert.equal(reacquired.source.id, "account-b");
  assert.equal(reacquired.source.torrentId, 11);
  assert.equal(authorizePlaybackItem(request, reacquired, who.options).ok, true);
});
