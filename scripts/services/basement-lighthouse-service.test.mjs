import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import EventEmitter from 'node:events';
import {
  BasementLighthouseService,
  handleLighthouseRoute,
  STEALTH_LIMITS,
} from './basement-lighthouse-service.mjs';

test('BasementLighthouseService ingests open infohash ring and prunes with 512D manifold', () => {
  const tmpDir = path.join(process.cwd(), '.reelos-state', 'test-lighthouse-' + Date.now());
  const service = new BasementLighthouseService({ stateDir: tmpDir });

  const added = service.ingestInfohashRecords([
    {
      title: 'Solaris',
      year: 1972,
      infohash: 'abcd1234ef0123456789abcdef0123456789abcd',
      size: 15000000000,
      seeders: 42, // high likelihood, not provider proof
      codec: 'HEVC',
      sceneGroup: 'Framestor',
    },
    {
      title: 'Obscure Arthouse Short',
      year: 2011,
      infohash: '1111222233334444555566667777888899990000',
      size: 2000000000,
      seeders: 3, // < 25 -> unverified
      codec: 'AVC',
      sceneGroup: 'UnknownGroup',
    },
  ]);

  assert.equal(added, 2);
  assert.equal(service.infohashRing.size, 2);

  // Prune candidate pool
  const candidates = service.pruneCandidatePoolWithManifold('criterion contemplative sci fi auteur', 10);
  assert.equal(candidates.length, 2);

  const solaris = candidates.find((c) => c.title === 'Solaris');
  assert.ok(solaris);
  assert.equal(solaris.verifiedCached, false);
  assert.equal(solaris.cachedProbability, 0.998, 'Seeders may influence probe priority only');
  assert.equal(solaris.source, 'heuristic_likelihood');

  const obscure = candidates.find((c) => c.title.includes('Obscure'));
  assert.ok(obscure);
  assert.equal(obscure.verifiedCached, false);
  assert.equal(obscure.cachedProbability, 0.45);

  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
});

test('BasementLighthouseService card hover verifies likely titles through the provider callback', async () => {
  const tmpDir = path.join(process.cwd(), '.reelos-state', 'test-lighthouse-' + Date.now());
  const service = new BasementLighthouseService({ stateDir: tmpDir });

  service.ingestInfohashRecords([
    {
      title: 'Dune Part Two',
      infohash: 'dune2hash1234567890abcdef1234567890abcdef',
      seeders: 120, // high likelihood still needs verification
      sceneGroup: 'FLUX',
    },
    {
      title: 'Niche NFO',
      infohash: 'niche1234567890abcdef1234567890abcdef12',
      seeders: 2,
    },
  ]);

  service.pruneCandidatePoolWithManifold('sci fi spectacle');

  let resolvedEvt = null;
  service.on('HOVER_CACHE_RESOLVED', (evt) => {
    resolvedEvt = evt;
  });

  let probes = 0;
  service.onCardHoverStart('title-dune-2', 'dune2hash1234567890abcdef1234567890abcdef', async () => {
    probes++;
    return true;
  });

  await new Promise((resolve) => setTimeout(resolve, STEALTH_LIMITS.HOVER_DEBOUNCE_MS + 40));
  assert.ok(resolvedEvt);
  assert.equal(probes, 1);
  assert.equal(resolvedEvt.cached, true);
  assert.equal(resolvedEvt.source, 'jit_api_probe');

  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
});

test('BasementLighthouseService treats peer gossip as unverified and stages only supplied bytes', () => {
  const tmpDir = path.join(process.cwd(), '.reelos-state', 'test-lighthouse-' + Date.now());
  const service = new BasementLighthouseService({ stateDir: tmpDir });

  const hash = 'friendgossiphsh1234567890abcdef12345678';
  const ok = service.ingestGossipedCachedHash(hash, 'Stalker 1979');
  assert.equal(ok, true);

  const candidate = service.stagedCandidates.get(hash);
  assert.ok(candidate);
  assert.equal(candidate.verifiedCached, false);
  assert.equal(candidate.source, 'unverified_peer_claim');

  assert.equal(service.stageVirtualHeadChunk(hash), false);
  const verifiedBytes = Buffer.from('verified source bytes');
  const staged = service.stageVirtualHeadChunk(hash, verifiedBytes);
  assert.equal(staged, true);
  assert.ok(candidate.headChunkBuffer instanceof Buffer);
  assert.equal(candidate.headChunkBuffer.byteLength, verifiedBytes.byteLength);

  const status = service.getStatus();
  assert.equal(status.headChunksStagedCount, 1);

  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
});

test('handleLighthouseRoute dispatches status, prune, and hover actions', async () => {
  // Test /api/lighthouse/status
  let statusJson = null;
  const mockResStatus = {
    statusCode: 0,
    setHeader: () => {},
    end: (data) => { statusJson = JSON.parse(data); },
  };
  const handledStatus = await handleLighthouseRoute({ url: '/api/lighthouse/status', method: 'GET' }, mockResStatus);
  assert.ok(handledStatus);
  assert.equal(statusJson.ok, true);
  assert.equal(statusJson.maxHoverCallsPerDay, 35);

  // Test /api/lighthouse/prune
  let pruneJson = null;
  const mockResPrune = {
    statusCode: 0,
    setHeader: () => {},
    end: (data) => { pruneJson = JSON.parse(data); },
  };
  async function* mockStreamPrune() {
    yield Buffer.from(JSON.stringify({ taste: 'noir cyberpunk', topK: 10 }));
  }
  const handledPrune = await handleLighthouseRoute({
    url: '/api/lighthouse/prune',
    method: 'POST',
    [Symbol.asyncIterator]: mockStreamPrune,
  }, mockResPrune);

  assert.ok(handledPrune);
  assert.equal(pruneJson.ok, true);
});
