import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { CinemaBrainLoader, RWT_MAGIC, CINEMA_LEXICON } from './cinema-brain-loader.mjs';

test('CinemaBrainLoader initializes, persists binary .rwt, and allocates Float32 projection matrix', () => {
  const tmpDir = path.join(process.cwd(), '.reelos-state', 'test-brain-' + Date.now());
  const loader = new CinemaBrainLoader({ stateDir: tmpDir, latentDim: 512 });

  assert.equal(loader.isLoaded, false);
  const ok = loader.initBrain();
  assert.equal(ok, true);
  assert.equal(loader.isLoaded, true);

  // Check stats
  const stats = loader.getStats();
  assert.equal(stats.isLoaded, true);
  assert.equal(stats.vocabCount, CINEMA_LEXICON.length);
  assert.equal(stats.latentDim, 512);
  assert.ok(stats.bufferBytes > 0);
  assert.ok(fs.existsSync(stats.brainFile));

  // Verify binary header
  const fileBytes = fs.readFileSync(stats.brainFile);
  assert.equal(fileBytes.readUInt32LE(0), RWT_MAGIC);
  assert.equal(fileBytes.readUInt32LE(4), CINEMA_LEXICON.length);
  assert.equal(fileBytes.readUInt32LE(8), 512);

  // Clean up
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
});

test('CinemaBrainLoader encodes text into dense normalized latent vectors', () => {
  const tmpDir = path.join(process.cwd(), '.reelos-state', 'test-brain-' + Date.now());
  const loader = new CinemaBrainLoader({ stateDir: tmpDir, latentDim: 512 });

  const vec512 = loader.encodeTextToLatent('Blade Runner 2049 neon noir sci fi cyberpunk', 512);
  assert.equal(vec512.length, 512);
  assert.ok(vec512 instanceof Float32Array);

  // Check L2 norm is ~1.0
  let norm = 0;
  for (let i = 0; i < vec512.length; i++) norm += vec512[i] * vec512[i];
  assert.ok(Math.abs(Math.sqrt(norm) - 1.0) < 1e-4, 'Latent vector must be L2-normalized');

  // Truncated / distilled dimensional projection
  const vec64 = loader.encodeTextToLatent('Blade Runner 2049 neon noir sci fi cyberpunk', 64);
  assert.equal(vec64.length, 64);

  const vec16 = loader.encodeTextToLatent('Blade Runner 2049 neon noir sci fi cyberpunk', 16);
  assert.equal(vec16.length, 16);

  // Clean up
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
});
