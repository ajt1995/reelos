import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NativeAcquisitionService } from "./native-acquisition-service.mjs";
import { NativeMediaRegistry } from "./native-media-registry.mjs";

const dirs = [];
function setup() {
  const stateDir = fs.mkdtempSync(path.join(process.cwd(), ".reelos-acquisition-test-"));
  dirs.push(stateDir);
  return { service: new NativeAcquisitionService({ stateDir }), registry: new NativeMediaRegistry({ stateDir }) };
}
test.after(() => dirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

test("native acquisition is idempotent and publishes only after source verification", async () => {
  const { service, registry } = setup();
  const input = { profileId: "adult-a", workId: "tmdb-550", title: "Fight Club", mediaType: "movie", provider: "torbox" };
  const first = service.create(input);
  assert.equal(service.create(input).job.id, first.job.id);
  const ready = await service.run(first.job.id, {
    discover: async () => [{ id: "candidate-a" }],
    rank: async (_job, candidates) => candidates[0],
    resolveProvider: async () => ({ id: "torbox", adapter: {
      acquire: async () => ({ receipt: { providerJobId: "opaque" } }),
      verify: async () => ({ editionId: "tmdb-550-cut-1999", source: { id: "tb-file-a", kind: "provider_stream", provider: "torbox", verified: true,
        binding: { infohash: "a".repeat(40), torrentId: 7, fileId: 3 } } }),
    } }),
    registry,
  });
  assert.equal(ready.status, "ready");
  assert.equal(registry.get(ready.libraryItemId).workId, "tmdb-550");
});

test("native acquisition fails closed when provider verification is absent", async () => {
  const { service, registry } = setup();
  const { job } = service.create({ profileId: "adult-a", workId: "tmdb-1", mediaType: "movie" });
  const failed = await service.run(job.id, {
    discover: async () => [{ id: "candidate-a" }], rank: async (_job, candidates) => candidates[0],
    resolveProvider: async () => ({ id: "torbox", adapter: { acquire: async () => ({}), verify: async () => ({ editionId: "edition-a", source: { verified: false } }) } }),
    registry,
  });
  assert.equal(failed.status, "failed");
  assert.equal(registry.list().length, 0);
});

test("acquisition passes the canonical episode to the provider", async () => {
  const { service, registry } = setup();
  const { job } = service.create({ profileId: "adult-a", workId: "series-a", mediaType: "episode", season: 2, episode: 4 });
  let requestedMedia;
  const result = await service.run(job.id, {
    discover: async () => [{ id: "episode-candidate" }],
    rank: async (_job, candidates) => candidates[0],
    resolveProvider: async () => ({ id: "torbox", adapter: {
      acquire: async (_candidate, options) => { requestedMedia = options.requestedMedia; return {}; },
      verify: async () => ({ editionId: "series-a-s02e04", source: { id: "episode-file", kind: "provider_stream", provider: "torbox",
        verified: true, binding: { infohash: "d".repeat(40), torrentId: 12, fileId: 4 } } }),
    } }),
    registry,
  });
  assert.deepEqual(requestedMedia, { mediaType: "episode", season: 2, episode: 4 });
  assert.equal(registry.get(result.libraryItemId).episode, 4);
  assert.throws(() => service.create({ profileId: "adult-a", workId: "series-a", mediaType: "episode", episode: 4 }),
    /both season and episode/);
});

test("restart converts active jobs to explicit interrupted state", () => {
  const { service } = setup();
  const { job } = service.create({ profileId: "adult-a", workId: "tmdb-2", mediaType: "movie" });
  service.transition(job.id, "discovering");
  assert.equal(service.recoverInterrupted(), 1);
  assert.equal(service.get(job.id).status, "interrupted");
  assert.equal(service.retry(job.id).status, "queued");
});

test("illegal transitions and retries fail closed", () => {
  const { service } = setup();
  const { job } = service.create({ profileId: "adult-a", workId: "tmdb-3", mediaType: "movie" });
  assert.throws(() => service.transition(job.id, "ready"), /Cannot move/);
  assert.throws(() => service.retry(job.id), /not retryable/);
});
