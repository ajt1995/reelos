import { test } from 'node:test';
import assert from 'node:assert';

import { batteryGuardian } from './services/battery-guardian.mjs';
import { adaptivePlayback } from './services/adaptive-playback.mjs';
import { audioIntelligence } from './services/audio-intelligence.mjs';
import { telemetryWatchdog } from './services/telemetry-watchdog.mjs';

test('Battery Guardian', async (t) => {
  const state = await batteryGuardian.evaluateBatteryState();
  assert.ok(state.ecoFloor !== undefined, 'ecoFloor should be defined');
  assert.ok(state.prefetchPaused !== undefined, 'prefetchPaused should be defined');
});

test('Adaptive Playback', (t) => {
  const plan = adaptivePlayback.evaluatePlaybackPlan(
    { type: 'tv' },
    { onAcPower: true, fastLan: true },
    { is4k: true }
  );
  assert.strictEqual(plan.decision, '4K DirectPlay Remux');
});

test('Audio Intelligence', (t) => {
  const profile = audioIntelligence.getSmartNightModeProfile();
  assert.strictEqual(profile.name, 'Smart Night Mode DSP');

  const drift = audioIntelligence.analyzeSubtitleDrift([1000], [{ start: 900 }]);
  assert.strictEqual(drift.suggestedShiftMs, 100);

  const forced = audioIntelligence.detectForcedNarrative('en', 'en', [{}]);
  assert.strictEqual(forced.forcedTrackSelected, true);
});

test('Telemetry Watchdog', (t) => {
  telemetryWatchdog.logPlaybackEvent({ type: 'micro-stutter', userId: '123' });
  const capsuleJson = telemetryWatchdog.generateSanitizedCapsule();
  const capsule = JSON.parse(capsuleJson);
  assert.strictEqual(capsule.data.length, 1);
  assert.strictEqual(capsule.data[0].userId, undefined, 'userId should be redacted');
});
