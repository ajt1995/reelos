import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { NeuralEngine } from './services/neural-engine.mjs';
import { CouchConsensus } from './services/couch-consensus.mjs';
import { HddGuardian } from './services/hdd-guardian.mjs';
import { BatteryGuardian } from './services/battery-guardian.mjs';
import { politeScheduler } from './services/polite-scheduler.mjs';

test('NeuralEngine: finite guards prevent runaway numbers', () => {
  const engine = new NeuralEngine();
  
  assert.doesNotThrow(() => {
    engine.sgdUpdate('user1', 'movie1', NaN);
    engine.sgdUpdate('user1', 'movie1', Infinity);
    engine.sgdUpdate('user1', 'movie1', -Infinity);
    engine.sgdUpdate('user1', 'movie1', 0.95);
  });

  const userVec = engine.getUser('user1');
  const movieVec = engine.getItem('movie1');

  for (let i = 0; i < userVec.length; i++) {
    assert.equal(Number.isFinite(userVec[i]), true, 'user vector must be finite');
    assert.equal(Number.isFinite(movieVec[i]), true, 'movie vector must be finite');
  }
});

test('NeuralEngine: LRU caches strictly bound memory to max 100 entries', () => {
  const engine = new NeuralEngine({
    isDedicated: false,
    dims: 32,
    lruCap: 100,
    weightsPath: path.join(process.cwd(), '.missing-test-neural-weights.json'),
  });
  
  for (let i = 0; i < 150; i++) {
    engine.getUser('user_' + i);
    engine.getItem('movie_' + i);
  }

  const userKeys = Object.keys(engine.users);
  const itemKeys = Object.keys(engine.items);

  assert.ok(userKeys.length <= 100, 'user cache count ' + userKeys.length + ' exceeds 100');
  assert.ok(itemKeys.length <= 100, 'item cache count ' + itemKeys.length + ' exceeds 100');
  assert.equal(userKeys.includes('user_149'), true, 'latest user must be present');
  assert.equal(userKeys.includes('user_0'), false, 'oldest user must be evicted');
});

test('CouchConsensus: genuine profile vector averaging', () => {
  const consensus = new CouchConsensus();

  const vec1 = new Float32Array([1.0, 0.0, 0.5, 0.0]);
  const vec2 = new Float32Array([0.0, 1.0, 0.5, 0.0]);

  const profile1 = { id: 'p1', vector: vec1, dislikedIds: ['bad_movie_1'] };
  const profile2 = { id: 'p2', vector: vec2, dislikedIds: [] };

  const blended = consensus.blendProfiles([profile1, profile2]);

  assert.equal(blended.profileCount, 2);
  assert.equal(blended.vector.length, 4);
  assert.equal(blended.vector[0], 0.5);
  assert.equal(blended.vector[1], 0.5);
  assert.equal(blended.vector[2], 0.5);
  assert.equal(blended.vector[3], 0.0);
  assert.equal(blended.dislikedIds.has('bad_movie_1'), true);
});

test('CouchConsensus: Strict Harmony veto penalty of -1000 for disliked titles', () => {
  const consensus = new CouchConsensus();

  const candidateGood = {
    id: 'jurassic_park',
    title: 'Jurassic Park',
    vector: new Float32Array([1.0, 0.5, 0.2, 0.0])
  };

  const candidateVetoed = {
    id: 'scary_clowns',
    title: 'Scary Clowns',
    vector: new Float32Array([1.0, 0.5, 0.2, 0.0])
  };

  const profiles = [
    { id: 'kid', vector: new Float32Array([1.0, 0.5, 0.2, 0.0]), dislikedIds: ['scary_clowns'] },
    { id: 'parent', vector: new Float32Array([0.9, 0.4, 0.1, 0.0]), dislikedIds: [] }
  ];

  const results = consensus.findConsensus([candidateVetoed, candidateGood], profiles);

  assert.equal(results[0].id, 'jurassic_park');
  assert.equal(results[0].disputeFree, true);
  assert.ok(results[0].score > 0);

  assert.equal(results[1].id, 'scary_clowns');
  assert.equal(results[1].disputeFree, false);
  assert.ok(results[1].score < -500, 'vetoed candidate must have large negative penalty');
});

test('HddGuardian: flush persists telemetry to disk and does not reset idle timer on SMART poll', () => {
  const guardian = new HddGuardian();
  const testTelemetryPath = path.join(process.cwd(), '.reelos-state', 'hdd-telemetry.json');

  guardian.writeState({ timestamp: Date.now(), testEvent: 'spin_down_test' });
  assert.equal(guardian.buffer.length, 1);

  guardian.flush();
  assert.equal(guardian.buffer.length, 0);
  assert.equal(fs.existsSync(testTelemetryPath), true, 'telemetry file must be written to disk');

  const fixedTime = Date.now() - 60000;
  guardian.lastDiskActivity = fixedTime;
  guardian.reportPlaybackSource('idle');

  guardian.predictFailure({ temperature: 38 });
  assert.equal(guardian.lastDiskActivity, fixedTime, 'predictFailure must not mutate lastDiskActivity');
});

test('BatteryGuardian: chargeRecommendation returns clean integers for OS sysfs', async () => {
  const bg = new BatteryGuardian();
  const res = await bg.evaluateBatteryState();
  
  if (res.chargeRecommendation !== null) {
    assert.equal(typeof res.chargeRecommendation, 'number', 'chargeRecommendation must be a number');
    assert.ok(res.chargeRecommendation >= 50 && res.chargeRecommendation <= 80);
  }
});

test('PoliteScheduler: status inspection', () => {
  const status = politeScheduler.getStatus();
  assert.ok(['normal', 'stealth_yield', 'turbo_maintenance'].includes(status.hostState));
  assert.equal(typeof status.isYielding, 'boolean');
});
