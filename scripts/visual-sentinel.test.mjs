import test from 'node:test';
import assert from 'node:assert/strict';
import { visualSentinel } from './services/visual-sentinel.mjs';

test('VisualSentinel - approves legitimate matching artwork', () => {
  const buf = Buffer.alloc(1024, 1);
  const result = visualSentinel.verifyArtwork({
    title: 'The Bear',
    id: 'bear-001',
    candidateName: 'The Bear',
    buffer: buf
  });
  assert.equal(result.valid, true);
});

test('VisualSentinel - catches and rejects semantic mismatches (The Spider-Man Rule)', () => {
  const buf = Buffer.alloc(1024, 2);
  const result = visualSentinel.verifyArtwork({
    title: 'Sonic the Hedgehog 3',
    id: 'sonic-003',
    candidateName: 'Spider-Man: Brand New Day',
    buffer: buf
  });
  assert.equal(result.valid, false);
  assert.match(result.reason, /semantic_mismatch/);
});

test('VisualSentinel - detects and quarantines duplicate artwork collisions across distinct titles', () => {
  const sharedBuf = Buffer.alloc(1024, 42); // Identical image buffer
  
  // First title gets it
  const r1 = visualSentinel.verifyArtwork({
    title: 'Severance',
    id: 'sev-001',
    candidateName: 'Severance',
    buffer: sharedBuf
  });
  assert.equal(r1.valid, true);

  // Second distinct title tries to use the exact same image buffer!
  const r2 = visualSentinel.verifyArtwork({
    title: 'Fallout',
    id: 'fallout-001',
    candidateName: 'Fallout',
    buffer: sharedBuf
  });
  assert.equal(r2.valid, false);
  assert.match(r2.reason, /artwork_collision/);
});
