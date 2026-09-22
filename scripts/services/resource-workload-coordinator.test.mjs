import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { ResourceGovernor } from "./resource-governor-service.mjs";
import {
  admitCoordinatedWorkload,
  registerResourceGovernor,
  resourceCoordinationStatus,
} from "./resource-workload-coordinator.mjs";
import { beginPreparationBlockingStream } from "./preparation-activity.mjs";

function governor() {
  return new ResourceGovernor({
    telemetry: () => ({ availableMemoryBytes: 1024 ** 3, freeDiskBytes: 10 * 1024 ** 3 }),
    memorySafetyFloorBytes: 128 * 1024 ** 2,
    diskSafetyFloorBytes: 1024 ** 3,
    autoSweep: false,
  });
}

test("registered scopes admit bounded work without mixing household roots", () => {
  const first = governor(), second = governor();
  const firstRoot = path.resolve(".fixture-resource-root-a");
  const secondRoot = path.resolve(".fixture-resource-root-b");
  const unregisterFirst = registerResourceGovernor(firstRoot, first);
  const unregisterSecond = registerResourceGovernor(secondRoot, second);
  try {
    const admitted = admitCoordinatedWorkload(firstRoot, {
      workloadId: "prepare", workloadClass: "requested_work", memoryBytes: 64 * 1024 ** 2,
    });
    assert.equal(admitted.ok, true);
    assert.equal(admitted.coordinated, true);
    assert.equal(first.snapshot().commitments.memoryBytes, 64 * 1024 ** 2);
    assert.equal(second.snapshot().commitments.memoryBytes, 0);
    admitted.lease.release();
  } finally {
    unregisterFirst(); unregisterSecond(); first.close(); second.close();
  }
});

test("playback pressure preempts optional work and blocks new background admission", () => {
  const instance = governor();
  const root = path.resolve(".fixture-resource-root-playback");
  const unregister = registerResourceGovernor(root, instance);
  let releasePlayback = null;
  try {
    const work = admitCoordinatedWorkload(root, {
      workloadId: "analysis", workloadClass: "media_analysis", preemption: "cancel",
    });
    releasePlayback = beginPreparationBlockingStream();
    assert.equal(work.lease.signal.aborted, true);
    assert.equal(work.lease.signal.reason.code, "playback_active");
    assert.equal(admitCoordinatedWorkload(root, {
      workloadId: "prediction", workloadClass: "predictive_preparation",
    }).code, "foreground_priority");
    assert.equal(resourceCoordinationStatus().playbackActive, true);
  } finally {
    releasePlayback?.();
    unregister(); instance.close();
  }
});

test("an unregistered scope keeps deterministic legacy protection available", () => {
  const result = admitCoordinatedWorkload(path.resolve(".fixture-unregistered"), {
    workloadId: "legacy", workloadClass: "maintenance",
  });
  assert.deepEqual(result, { ok: true, coordinated: false, lease: null });
});
