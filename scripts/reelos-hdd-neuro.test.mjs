import test from 'node:test';
import assert from 'node:assert';
import { guardian } from './services/hdd-guardian.mjs';
import { neuroCache } from './services/neuro-cache.mjs';

test('HddGuardian writes state and tracks buffer', () => {
  guardian.flush();
  assert.strictEqual(guardian.bufferSize, 0);
  guardian.writeState({ foo: 'bar' });
  assert.ok(guardian.bufferSize > 0);
});

test('HddGuardian prediction', () => {
  const status = guardian.getSmartStatus();
  assert.strictEqual(status.failurePredicted, false);
  assert.strictEqual(status.action, 'none');

  const failingStatus = guardian.predictFailure({
    reallocatedSectors: 200,
    currentPendingSectors: 100,
    seekErrorRate: 20000,
    temperature: 70
  });
  assert.strictEqual(failingStatus.failurePredicted, true);
  assert.strictEqual(failingStatus.action, 'switch_to_cloud_only');
});

test('NeuroCache predictive stager', () => {
  const staged = neuroCache.stageNextEpisodes('show123', 3);
  assert.deepStrictEqual(staged, ['show123-E4', 'show123-E5']);
  assert.ok(neuroCache.staged.has('show123-E4'));
});

test('NeuroCache pinning and eviction', () => {
  // kid/comfort media gets pinned
  neuroCache.recordWatch('user1', 'show123-E4', true);
  neuroCache.recordWatch('user2', 'show123-E4', true);
  neuroCache.recordWatch('user3', 'show123-E4', true);
  assert.ok(neuroCache.pinned.has('show123-E4'));
  
  // normal media gets evicted
  neuroCache.recordWatch('user1', 'show123-E5', false);
  const evicted = neuroCache.evictPostWatch('show123-E5', 1);
  assert.strictEqual(evicted, true);
  assert.ok(neuroCache.evicted.has('show123-E5'));
  assert.ok(!neuroCache.staged.has('show123-E5'));
  
  // pinned media shouldn't be evicted
  const notEvicted = neuroCache.evictPostWatch('show123-E4', 1);
  assert.strictEqual(notEvicted, false);
});
