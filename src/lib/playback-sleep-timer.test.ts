import assert from "node:assert/strict";
import { test } from "node:test";
import { createPlaybackSleepTimer, type SleepTimerClock } from "./playback-sleep-timer.ts";

function fixture() {
  let now = 1_000;
  let expired = 0;
  const jobs: { callback: () => void; delay: number; cancelled: boolean }[] = [];
  const clock: SleepTimerClock = {
    now: () => now,
    schedule(callback, delay) {
      const job = { callback, delay, cancelled: false };
      jobs.push(job);
      return () => { job.cancelled = true; };
    },
  };
  const video = { isConnected: true, pauses: 0, pause() { this.pauses += 1; } };
  let current: typeof video | null = video;
  const timer = createPlaybackSleepTimer({
    getVideo: () => current,
    onExpire: () => { expired += 1; },
    clock,
  });
  return {
    timer, video, jobs,
    setNow(value: number) { now = value; },
    setVideo(value: typeof video | null) { current = value; },
    getExpired: () => expired,
  };
}

test("sleep timer pauses the actual video once at its deadline", () => {
  const f = fixture();
  assert.equal(f.timer.setDelay(50), 1_050);
  assert.equal(f.jobs[0].delay, 50);
  assert.equal(f.video.pauses, 0);
  f.setNow(1_050);
  f.jobs[0].callback();
  assert.equal(f.video.pauses, 1);
  assert.equal(f.getExpired(), 1);
  assert.equal(f.timer.getDeadline(), null);
  f.jobs[0].callback();
  f.timer.checkDeadline();
  assert.equal(f.video.pauses, 1);
});

test("an early callback reschedules only the time remaining to the original deadline", () => {
  const f = fixture();
  f.timer.setDelay(50);
  f.setNow(1_020);
  f.jobs[0].callback();
  assert.equal(f.video.pauses, 0);
  assert.equal(f.timer.getDeadline(), 1_050);
  assert.equal(f.jobs[1].delay, 30);
  f.setNow(1_050);
  f.jobs[1].callback();
  assert.equal(f.video.pauses, 1);
});

test("a delayed callback expires immediately using wall time", () => {
  const f = fixture();
  f.timer.setDelay(50);
  f.setNow(60_000);
  f.jobs[0].callback();
  assert.equal(f.video.pauses, 1);
  assert.equal(f.jobs.length, 1);
});

test("changing the duration resets from now and invalidates queued old callbacks", () => {
  const f = fixture();
  f.timer.setDelay(30 * 60_000);
  f.setNow(2_000);
  assert.equal(f.timer.setDelay(60 * 60_000), 3_602_000);
  assert.equal(f.jobs[0].cancelled, true);
  f.setNow(1_801_000);
  f.jobs[0].callback();
  assert.equal(f.video.pauses, 0);
  assert.equal(f.timer.getDeadline(), 3_602_000);
  f.setNow(3_602_000);
  f.jobs[1].callback();
  assert.equal(f.video.pauses, 1);
});

test("Off and explicit cancellation invalidate even already queued callbacks", () => {
  for (const mode of ["off", "cancel"] as const) {
    const f = fixture();
    f.timer.setDelay(50);
    if (mode === "off") f.timer.setDelay(0);
    else f.timer.cancel();
    assert.equal(f.jobs[0].cancelled, true);
    assert.equal(f.timer.getDeadline(), null);
    f.setNow(1_100);
    f.jobs[0].callback();
    assert.equal(f.video.pauses, 0);
    assert.equal(f.getExpired(), 0);
  }
});

test("disposal cancels the timer permanently and never pauses the video", () => {
  const f = fixture();
  f.timer.setDelay(50);
  f.timer.dispose();
  f.timer.dispose();
  f.setNow(1_100);
  f.jobs[0].callback();
  assert.equal(f.timer.setDelay(20), null);
  assert.equal(f.video.pauses, 0);
  assert.equal(f.jobs.length, 1);
  assert.equal(f.getExpired(), 0);
});

test("a replaced, removed, or detached video cannot be paused by the old timer", () => {
  for (const mode of ["replaced", "removed", "detached"] as const) {
    const f = fixture();
    const replacement = { isConnected: true, pauses: 0, pause() { this.pauses += 1; } };
    f.timer.setDelay(50);
    if (mode === "replaced") f.setVideo(replacement);
    if (mode === "removed") f.setVideo(null);
    if (mode === "detached") f.video.isConnected = false;
    f.setNow(1_050);
    f.jobs[0].callback();
    assert.equal(f.video.pauses, 0);
    assert.equal(replacement.pauses, 0);
    assert.equal(f.timer.getDeadline(), null);
    assert.equal(f.getExpired(), 0);
  }
});

test("a wake-up check expires a suspended timer and invalidates its queued callback", () => {
  const f = fixture();
  f.timer.setDelay(50);
  f.setNow(10_000);
  f.timer.checkDeadline();
  assert.equal(f.video.pauses, 1);
  assert.equal(f.jobs[0].cancelled, true);
  f.jobs[0].callback();
  assert.equal(f.video.pauses, 1);
});

test("invalid durations and an unavailable video do not schedule work", () => {
  const f = fixture();
  for (const duration of [0, -1, NaN, Infinity]) {
    assert.equal(f.timer.setDelay(duration), null);
  }
  f.setVideo(null);
  assert.equal(f.timer.setDelay(50), null);
  assert.equal(f.jobs.length, 0);
});
