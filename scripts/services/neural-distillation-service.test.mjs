import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  NeuralDistillationService,
  handleDistillationRoute,
  HIERARCHICAL_TIERS,
} from './neural-distillation-service.mjs';
import { RWT_MAGIC } from './cinema-brain-loader.mjs';

test('NeuralDistillationService projects 512D vectors down to 64D and 16D accurately', () => {
  const tmpDir = path.join(process.cwd(), '.reelos-state', 'test-distill-' + Date.now());
  const service = new NeuralDistillationService({ stateDir: tmpDir });

  const dummy512 = new Float32Array(512);
  for (let i = 0; i < 512; i++) dummy512[i] = Math.sin(i * 0.1);

  const vec64 = service.project512to64(dummy512);
  assert.equal(vec64.length, 64);
  let norm64 = 0;
  for (let i = 0; i < 64; i++) norm64 += vec64[i] * vec64[i];
  assert.ok(Math.abs(Math.sqrt(norm64) - 1.0) < 1e-4, '64D vector must be normalized');

  const vec16 = service.project64to16(vec64);
  assert.equal(vec16.length, 16);
  let norm16 = 0;
  for (let i = 0; i < 16; i++) norm16 += vec16[i] * vec16[i];
  assert.ok(Math.abs(Math.sqrt(norm16) - 1.0) < 1e-4, '16D vector must be normalized');

  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
});

test('NeuralDistillationService generates Tier 2 (Appliance 64D Float32) and Tier 3 (Edge 16D INT8) packages', () => {
  const tmpDir = path.join(process.cwd(), '.reelos-state', 'test-distill-' + Date.now());
  const service = new NeuralDistillationService({ stateDir: tmpDir });

  // Tier 2: 64D Float32
  const pkgTier2 = service.generateDistilledPackage('tier2_appliance');
  assert.ok(pkgTier2 instanceof Buffer);
  assert.equal(pkgTier2.readUInt32LE(0), RWT_MAGIC);
  assert.equal(pkgTier2.readUInt32LE(8), 64);
  assert.equal(pkgTier2.readUInt32LE(12), 0); // isQuantized = 0

  // Tier 3: 16D INT8 Quantized
  const pkgTier3 = service.generateDistilledPackage('tier3_edge');
  assert.ok(pkgTier3 instanceof Buffer);
  assert.equal(pkgTier3.readUInt32LE(0), RWT_MAGIC);
  assert.equal(pkgTier3.readUInt32LE(8), 16);
  assert.equal(pkgTier3.readUInt32LE(12), 1); // isQuantized = 1

  // Edge buffer should be more compact than Appliance buffer
  assert.ok(pkgTier3.length < pkgTier2.length, 'INT8 16D package must be more compact than 64D float package');

  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
});

test('NeuralDistillationService ingests anonymous engagement micro-deltas', () => {
  const tmpDir = path.join(process.cwd(), '.reelos-state', 'test-distill-' + Date.now());
  const service = new NeuralDistillationService({ stateDir: tmpDir });

  const count = service.ingestEdgeGradients([
    { titleId: 'tmdb-603', completionPct: 0.95, vibeAesthetic: 'cyberpunk', deltaRating: 1.0 },
    { titleId: 'tmdb-157336', completionPct: 0.88, vibeAesthetic: 'sci_fi', deltaRating: 1.0 },
  ]);

  assert.equal(count, 2);
  const status = service.getStatus();
  assert.equal(status.pendingGradientDeltasCount, 2);

  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
});

test('handleDistillationRoute serves /api/neural/distill and /api/neural/gradients', async () => {
  // Test JSON distill
  let jsonRes = null;
  const mockResJson = {
    statusCode: 0,
    setHeader: () => {},
    end: (data) => { jsonRes = JSON.parse(data); },
  };
  const handledJson = await handleDistillationRoute({ url: '/api/neural/distill?tier=tier3_edge', method: 'GET' }, mockResJson);
  assert.ok(handledJson);
  assert.equal(jsonRes.ok, true);
  assert.equal(jsonRes.tier, 'tier3_edge');
  assert.ok(jsonRes.base64Weights.length > 0);

  // Test POST gradients
  let gradRes = null;
  const mockResGrad = {
    statusCode: 0,
    setHeader: () => {},
    end: (data) => { gradRes = JSON.parse(data); },
  };
  async function* mockStream() {
    yield Buffer.from(JSON.stringify({
      deltas: [{ titleId: 'tmdb-105', completionPct: 0.99, deltaRating: 1.0 }],
    }));
  }
  const handledGrad = await handleDistillationRoute({
    url: '/api/neural/gradients',
    method: 'POST',
    [Symbol.asyncIterator]: mockStream,
  }, mockResGrad);

  assert.ok(handledGrad);
  assert.equal(gradRes.ok, true);
  assert.equal(gradRes.accepted, 1);
});
