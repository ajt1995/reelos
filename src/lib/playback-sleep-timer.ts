export interface SleepTimerVideo {
  pause(): void;
  readonly isConnected: boolean;
}

export interface SleepTimerClock {
  now(): number;
  /** Schedule once and return a function that cancels the scheduled callback. */
  schedule(callback: () => void, delayMs: number): () => void;
}

export interface PlaybackSleepTimerOptions {
  getVideo(): SleepTimerVideo | null;
  onExpire?(): void;
  clock?: SleepTimerClock;
}

const wallClock: SleepTimerClock = {
  now: () => Date.now(),
  schedule(callback, delayMs) {
    const handle = setTimeout(callback, delayMs);
    return () => clearTimeout(handle);
  },
};

/** One wall-clock deadline, scoped to the video present when the timer is armed. */
export function createPlaybackSleepTimer({ getVideo, onExpire, clock = wallClock }: PlaybackSleepTimerOptions) {
  let deadline: number | null = null;
  let target: SleepTimerVideo | null = null;
  let cancelScheduled: (() => void) | null = null;
  let generation = 0;
  let disposed = false;

  function cancel() {
    generation += 1;
    cancelScheduled?.();
    cancelScheduled = null;
    deadline = null;
    target = null;
  }

  function checkDeadline() {
    if (disposed || deadline === null || target === null) return;
    cancelScheduled?.();
    cancelScheduled = null;
    // Invalidate even callbacks that were queued before cancellation completed.
    const currentGeneration = ++generation;
    if (getVideo() !== target || !target.isConnected) {
      cancel();
      return;
    }
    const remaining = deadline - clock.now();
    if (remaining > 0) {
      // Browsers clamp delays above the signed 32-bit timeout range.
      cancelScheduled = clock.schedule(() => {
        if (generation === currentGeneration) checkDeadline();
      }, Math.min(remaining, 2_147_483_647));
      return;
    }
    const video = target;
    cancel();
    video.pause();
    onExpire?.();
  }

  return {
    /** Reset from now. Zero, invalid durations, or a missing video disable the timer. */
    setDelay(durationMs: number): number | null {
      cancel();
      if (disposed || !Number.isFinite(durationMs) || durationMs <= 0) return null;
      const video = getVideo();
      if (!video?.isConnected) return null;
      const nextDeadline = clock.now() + durationMs;
      if (!Number.isFinite(nextDeadline)) return null;
      target = video;
      deadline = nextDeadline;
      checkDeadline();
      return deadline;
    },
    getDeadline: () => deadline,
    checkDeadline,
    cancel,
    dispose() {
      disposed = true;
      cancel();
    },
  };
}
