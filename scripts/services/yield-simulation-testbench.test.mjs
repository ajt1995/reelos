import assert from 'node:assert/strict';
import test from 'node:test';
import {
  YieldSimulationTestbench,
} from './yield-simulation-testbench.mjs';

test('YieldSimulationTestbench: Console gaming bufferbloat spike yields traffic and resumes cleanly', async () => {
  const bench = new YieldSimulationTestbench();
  const res = await bench.simulateConsoleYield({
    baselineRtt: 18,
    spikeRtt: 52,
    consoleVendor: 'playstation',
    cooldownMs: 30,
  });

  assert.equal(res.success, true);
  assert.ok(res.yieldEvent);
  assert.equal(res.yieldEvent.reason, 'bufferbloat_spike');
  assert.ok(res.yieldEvent.deltaMs >= 15);
  assert.ok(res.resumeEvent);
  assert.equal(res.resumeEvent.reason, 'latency_stabilized');
});

test('YieldSimulationTestbench: TorBox 429 storm paces rapid requests with token bucket', async () => {
  const bench = new YieldSimulationTestbench();
  const res = await bench.simulateTorBox429Storm({ requestCount: 15, retryAfterSec: 1 });

  assert.equal(res.success, true);
  assert.ok(res.successfulDeliveries >= 14);
  assert.equal(res.rateLimitEncountered, 1);
  assert.equal(res.backoffActive, true);
});

test('YieldSimulationTestbench: lazy model budget contracts and expands with no dummy RAM allocation', async () => {
  const bench = new YieldSimulationTestbench();
  const res = await bench.simulateAiContraction();

  assert.equal(res.success, true);
  assert.equal(res.initialState, 'EXPANDED');
  assert.equal(res.contractedState, 'CONTRACTED');
  assert.equal(res.contractedMemoryMb, 0);
  assert.equal(res.contractedBudgetMb, 48);
  assert.equal(res.resumedBudgetMb, 128);
  assert.equal(res.resumedState, 'EXPANDED');
  assert.equal(res.droppedInferences, 0);
  assert.ok(res.simInitial > 0.9);
  assert.ok(res.simContracted > 0.9);
});

test('YieldSimulationTestbench: Polite scheduler quiet-hours and CPU load yielding', () => {
  const bench = new YieldSimulationTestbench();
  const res = bench.simulatePoliteSchedulerYield({
    quietHour: 23,
    daytimeHour: 15,
    highCpu: 88,
    lowCpu: 25,
  });

  assert.equal(res.success, true);
  assert.equal(res.quietDecision, true);
  assert.equal(res.daytimeDecision, false);
  assert.equal(res.highCpuYield, true);
  assert.equal(res.lowCpuYield, false);
});

test('YieldSimulationTestbench: Hybrid storage rolling buffer space eviction maintains 2-episode forward window', () => {
  const bench = new YieldSimulationTestbench();
  const res = bench.simulateStorageEviction({
    capacityPct: 97,
    seriesId: 'series-interstellar-tv',
  });

  assert.equal(res.success, true);
  assert.deepEqual(res.nextUpEpisodes, ['1x4', '1x5']);
  assert.deepEqual(res.evictedEpisodes, ['1x1', '1x2', '1x3']);
  assert.equal(res.maintainedForwardWindow, true);
});

test('YieldSimulationTestbench: runAllSimulations executes complete deterministic verification pass', async () => {
  const bench = new YieldSimulationTestbench();
  const summary = await bench.runAllSimulations();

  assert.equal(summary.allPassed, true);
  assert.ok(summary.results.consoleYield.success);
  assert.ok(summary.results.torBoxPacing.success);
  assert.ok(summary.results.aiContraction.success);
  assert.ok(summary.results.politeScheduler.success);
  assert.ok(summary.results.storageEviction.success);
});
