import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  FleetLearningService,
  FLEET_BOUNDS,
} from './fleet-learning-service.mjs';

test('FleetLearningService initializes with valid bounded default parameters', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-test-'));
  const service = new FleetLearningService({ stateDir: tempDir });
  const params = service.getTunedParameters();

  assert.equal(params.bufferbloatThresholdMs, FLEET_BOUNDS.DEFAULT_BUFFERBLOAT_THRESHOLD_MS);
  assert.equal(params.torboxRefillRate, FLEET_BOUNDS.DEFAULT_TORBOX_REFILL_RATE);
  assert.ok(params.bufferbloatThresholdMs >= FLEET_BOUNDS.MIN_BUFFERBLOAT_THRESHOLD_MS);
  assert.ok(params.bufferbloatThresholdMs <= FLEET_BOUNDS.MAX_BUFFERBLOAT_THRESHOLD_MS);
  assert.equal(params.observations, 0);
});

test('FleetLearningService tunes bufferbloat threshold up on high jitter to prevent false yields', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-test-'));
  const service = new FleetLearningService({ stateDir: tempDir, alpha: 0.5 });

  const initial = service.getTunedParameters().bufferbloatThresholdMs;

  // Record 5 observations of high jitter mesh network (jitter = 25ms)
  for (let i = 0; i < 5; i++) {
    service.recordTelemetry({ baselineRtt: 30, jitterVariance: 25, incidents429: 0 });
  }

  const tuned = service.getTunedParameters().bufferbloatThresholdMs;
  assert.ok(tuned > initial, 'Threshold should increase on high jitter');
  assert.ok(tuned <= FLEET_BOUNDS.MAX_BUFFERBLOAT_THRESHOLD_MS, 'Threshold must remain clamped');
});

test('FleetLearningService tunes bufferbloat threshold down on clean low-jitter connection', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-test-'));
  const service = new FleetLearningService({ stateDir: tempDir, alpha: 0.5 });

  // Record 5 observations of low jitter ethernet (jitter = 1ms)
  for (let i = 0; i < 5; i++) {
    service.recordTelemetry({ baselineRtt: 15, jitterVariance: 1, incidents429: 0 });
  }

  const tuned = service.getTunedParameters().bufferbloatThresholdMs;
  assert.ok(tuned <= 18, 'Threshold should tighten towards minimum on low jitter');
  assert.ok(tuned >= FLEET_BOUNDS.MIN_BUFFERBLOAT_THRESHOLD_MS, 'Threshold must not drop below minimum');
});

test('FleetLearningService steps down TorBox refill rate on 429 rate limit incidents', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-test-'));
  const service = new FleetLearningService({ stateDir: tempDir });

  const initialRate = service.getTunedParameters().torboxRefillRate;

  // 429 incident occurs
  service.recordTelemetry({ baselineRtt: 20, jitterVariance: 2, incidents429: 2 });

  const tunedRate = service.getTunedParameters().torboxRefillRate;
  assert.ok(tunedRate < initialRate, 'TorBox refill rate should step down after 429s');
  assert.ok(tunedRate >= FLEET_BOUNDS.MIN_TORBOX_REFILL_RATE, 'Rate must clamp at min bounds');
});

test('FleetLearningService tunes indexer mirror weights based on latency', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-test-'));
  const service = new FleetLearningService({ stateDir: tempDir, alpha: 0.5 });

  // 1337x is fast (150ms), knaben is slow (2500ms)
  for (let i = 0; i < 3; i++) {
    service.recordTelemetry({
      baselineRtt: 20,
      jitterVariance: 2,
      mirrorLatencies: { '1337x': 150, knaben: 2500 },
    });
  }

  const params = service.getTunedParameters();
  assert.ok(params.mirrorWeights['1337x'] > params.mirrorWeights.knaben);
});

test('FleetLearningService applies tuned parameters directly to services', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-test-'));
  const service = new FleetLearningService({ stateDir: tempDir });

  const mockSentinel = { thresholdMs: 15 };
  const mockLimiter = { refillRate: 1.0 };

  // Tune parameters
  service.recordTelemetry({ baselineRtt: 20, jitterVariance: 20, incidents429: 1 });
  service.applyToServices({ consoleSentinel: mockSentinel, torBoxRateLimiter: mockLimiter });

  assert.equal(mockSentinel.thresholdMs, service.getTunedParameters().bufferbloatThresholdMs);
  assert.equal(mockLimiter.refillRate, service.getTunedParameters().torboxRefillRate);
});

test('FleetLearningService exports and ingests distilled taste manifold for smaller machines', () => {
  const hostDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-host-'));
  const potatoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-potato-'));

  const hostService = new FleetLearningService({ stateDir: hostDir });
  const potatoService = new FleetLearningService({ stateDir: potatoDir });

  // Host exports compressed 16-dim manifold anchors
  const distilled = hostService.exportDistilledManifold(16);
  assert.equal(distilled.dim, 16);
  assert.equal(distilled.version, '2.0.0');
  assert.ok(distilled.anchors.action_adrenaline.length === 16);

  // Potato box ingests distilled anchors
  const ingestResult = potatoService.ingestDistilledManifold(distilled);
  assert.equal(ingestResult.ok, true);
  assert.equal(ingestResult.dim, 16);

  // Distilled anchors are persisted in stateDir
  const persistedFile = path.join(potatoDir, 'distilled-manifold-anchors.json');
  assert.ok(fs.existsSync(persistedFile));
  const persistedData = JSON.parse(fs.readFileSync(persistedFile, 'utf8'));
  assert.equal(persistedData.version, '2.0.0');
});

test('FleetLearningService runs whispering compute with micro-batches keeping fans silent', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-test-'));
  const service = new FleetLearningService({ stateDir: tempDir });

  const report = await service.runNightlyWhisperingCompute({
    steps: 3,
    stepDurationMs: 10,
    pauseDurationMs: 20,
  });

  assert.equal(report.ok, true);
  assert.equal(report.stepsCompleted, 3);
  assert.equal(report.cpuSafe, true);
  assert.equal(report.whisperingStandard, 'active');
});

test('FleetLearningService manages auto-tune timer lifecycle cleanly', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-test-'));
  const service = new FleetLearningService({ stateDir: tempDir });

  let cycleFired = false;
  service.on('AUTOTUNE_CYCLE', () => { cycleFired = true; });

  service.startAutoTune(50);
  assert.ok(service.autoTuneTimer);

  await new Promise((r) => setTimeout(r, 80));
  assert.equal(cycleFired, true);

  service.stopAutoTune();
  assert.equal(service.autoTuneTimer, null);
});

