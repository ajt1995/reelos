export type AudioPreset = "off" | "volumeLeveling" | "dialogueBoost" | "nightMode";

export interface AudioStatus {
  supported: boolean;
  preset: AudioPreset;
  state: "ready" | "unsupported" | "error" | "destroyed";
  error: string | null;
}

export interface AudioController {
  readonly supported: boolean;
  setPreset: (preset: AudioPreset) => Promise<boolean>;
  getPreset: () => AudioPreset;
  getStatus: () => AudioStatus;
  subscribe: (callback: (status: AudioStatus) => void) => () => void;
  destroy: () => void;
}

export const PRESET_LABELS: Record<
  AudioPreset,
  { label: string; desc: string }
> = {
  off: { label: "Flat (Original)", desc: "Standard unprocessed direct audio" },
  volumeLeveling: {
    label: "Volume Leveling",
    desc: "Reduces jumps between quiet and loud moments",
  },
  dialogueBoost: {
    label: "Dialogue Boost",
    desc: "Enhances voice frequencies & smooths loud effects",
  },
  nightMode: {
    label: "Night Mode",
    desc: "Limits explosions/spikes while keeping speech clear",
  },
};

interface AudioGraph {
  ctx: AudioContext;
  source: MediaElementAudioSourceNode;
  compressor: DynamicsCompressorNode;
  voice: BiquadFilterNode;
  bass: BiquadFilterNode;
  gain: GainNode;
  route: AudioPreset | null;
  onStateChange: () => void;
}

interface ElementAudio {
  graph?: AudioGraph;
  pending?: Promise<void>;
  owner: symbol;
  request: number;
  wanted: AudioPreset;
  preset: AudioPreset;
  error: string | null;
  cleanup?: ReturnType<typeof setTimeout>;
  disposed?: boolean;
  notify?: () => void;
}

// A media element can only acquire one MediaElementAudioSourceNode. Closing its
// context cannot restore native playback, so retain a direct path while the
// element is live. Only detached, released elements receive terminal cleanup.
const elementAudio = new WeakMap<HTMLVideoElement, ElementAudio>();

function isRunning(ctx: AudioContext) {
  return ctx.state === "running";
}

function bypass(graph: AudioGraph) {
  if (graph.route === "off") return;
  graph.source.connect(graph.ctx.destination);
  if (graph.route) graph.source.disconnect(graph.bass);
  graph.route = "off";
}

function applyPreset(graph: AudioGraph, preset: Exclude<AudioPreset, "off">) {
  if (graph.route === null) bypass(graph);
  const { ctx, compressor, voice, bass, gain } = graph;
  const night = preset === "nightMode";
  const leveling = preset === "volumeLeveling";
  const now = ctx.currentTime;
  compressor.threshold.setValueAtTime(night ? -30 : leveling ? -20 : -24, now);
  compressor.knee.setValueAtTime(night ? 30 : leveling ? 18 : 10, now);
  compressor.ratio.setValueAtTime(night ? 12 : leveling ? 3 : 4.5, now);
  compressor.attack.setValueAtTime(night ? 0.003 : 0.005, now);
  compressor.release.setValueAtTime(0.25, now);
  voice.gain.setValueAtTime(leveling ? 0 : night ? 5 : 4.5, now);
  bass.gain.setValueAtTime(leveling ? 0 : night ? -10 : -3, now);
  gain.gain.setValueAtTime(leveling ? 1 : night ? 1.2 : 1.3, now);
  if (graph.route === "off") {
    // Establish the new path before removing the audible original path.
    graph.source.connect(bass);
    graph.source.disconnect(ctx.destination);
  }
  graph.route = preset;
}

export function attachAudioBooster(videoEl: HTMLVideoElement): AudioController {
  const AudioCtx =
    typeof window === "undefined"
      ? undefined
      : window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
  const supported = typeof AudioCtx === "function";
  const owner = Symbol("audio-controller");
  let destroyed = false;
  const listeners = new Set<(status: AudioStatus) => void>();
  const state: ElementAudio = elementAudio.get(videoEl) ?? {
    owner,
    request: 0,
    wanted: "off",
    preset: "off",
    error: null,
  };
  state.owner = owner;
  if (state.cleanup !== undefined) {
    clearTimeout(state.cleanup);
    state.cleanup = undefined;
  }
  state.notify?.();
  state.notify = notify;
  state.request += 1;
  state.wanted = "off";
  state.preset = "off";
  state.error = state.disposed
    ? "This video element was released. Open the video again to restore audio."
    : null;
  elementAudio.set(videoEl, state);

  function restoreOriginal() {
    state.preset = "off";
    if (state.graph && !state.disposed) bypass(state.graph);
  }

  try {
    restoreOriginal();
  } catch {
    state.error = "Original audio could not be restored.";
  }

  async function initialize() {
    if (state.graph || !AudioCtx) return;
    const ctx = new AudioCtx();
    try {
      // Resume before capturing the element: a denied activation must leave
      // its native audio untouched. Build all fallible effects first as well.
      if (ctx.state !== "running") await ctx.resume();
      if (ctx.state !== "running")
        throw new Error("Audio processing could not start.");
      if (state.wanted === "off") {
        await ctx.close();
        return;
      }
      const compressor = ctx.createDynamicsCompressor();
      const voice = ctx.createBiquadFilter();
      const bass = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      voice.type = "peaking";
      voice.frequency.value = 2500;
      voice.Q.value = 1.2;
      bass.type = "lowshelf";
      bass.frequency.value = 120;
      bass.connect(voice);
      voice.connect(compressor);
      compressor.connect(gain);
      gain.connect(ctx.destination);
      const source = ctx.createMediaElementSource(videoEl);
      const onStateChange = () => state.notify?.();
      state.graph = {
        ctx,
        source,
        compressor,
        voice,
        bass,
        gain,
        route: null,
        onStateChange,
      };
      ctx.addEventListener("statechange", onStateChange);
      bypass(state.graph);
    } catch (error) {
      // Only uncaptured contexts may be closed safely.
      if (!state.graph) await ctx.close().catch(() => {});
      throw error;
    }
  }

  function getStatus(): AudioStatus {
    const inactive = destroyed || state.owner !== owner;
    const stopped = state.graph && state.graph.ctx.state !== "running";
    const error =
      state.error ??
      (stopped
        ? "Audio processing is paused. Select the audio mode again to retry."
        : null);
    return {
      supported,
      preset: inactive || error ? "off" : state.preset,
      state: inactive
        ? "destroyed"
        : !supported
          ? "unsupported"
          : error
            ? "error"
            : "ready",
      error: inactive ? null : error,
    };
  }

  function notify() {
    const status = getStatus();
    for (const callback of listeners) {
      // A consumer callback must not interrupt audio restoration or cleanup.
      try {
        callback(status);
      } catch {
        /* consumer owns its errors */
      }
    }
  }

  return {
    supported,
    getStatus,
    getPreset: () => getStatus().preset,
    subscribe(callback) {
      if (destroyed || state.owner !== owner) {
        callback(getStatus());
        return () => {};
      }
      listeners.add(callback);
      callback(getStatus());
      return () => {
        listeners.delete(callback);
      };
    },
    async setPreset(preset) {
      if (destroyed || state.owner !== owner) return false;
      if (state.disposed) return false;
      const request = ++state.request;
      state.wanted = preset;
      if (!supported) return preset === "off";
      try {
        if (preset === "off") restoreOriginal();
        if (preset !== "off" && !state.graph) {
          state.pending ??= initialize().finally(() => {
            state.pending = undefined;
          });
          await state.pending;
        }
        if (destroyed || state.owner !== owner || request !== state.request)
          return false;
        const graph = state.graph;
        if (graph && !isRunning(graph.ctx)) {
          await graph.ctx.resume();
          if (!isRunning(graph.ctx))
            throw new Error("Audio processing could not start.");
        }
        if (destroyed || state.owner !== owner || request !== state.request)
          return false;
        if (preset !== "off") {
          if (!graph) return false;
          applyPreset(graph, preset);
        }
        state.preset = preset;
        state.error = null;
        notify();
        return true;
      } catch {
        if (destroyed || state.owner !== owner || request !== state.request)
          return false;
        state.error =
          "This audio mode could not start. Original audio is selected; try again.";
        try {
          restoreOriginal();
        } catch {
          state.error =
            "Audio processing failed and original audio could not be restored.";
        }
        notify();
        return false;
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (state.owner !== owner) {
        notify();
        listeners.clear();
        return;
      }
      state.request += 1;
      state.wanted = "off";
      try {
        restoreOriginal();
      } catch {
        state.error = "Original audio could not be restored.";
      }
      notify();
      listeners.clear();
      state.notify = undefined;
      // React cleanup runs before removal and may be immediately followed by
      // StrictMode reattachment. Defer until both ownership and DOM membership
      // can be checked; never close a context still serving a live element.
      state.cleanup = setTimeout(() => {
        state.cleanup = undefined;
        if (
          state.owner !== owner ||
          !destroyed ||
          videoEl.isConnected !== false
        )
          return;
        const graph = state.graph;
        if (!graph || state.disposed) return;
        state.disposed = true;
        graph.ctx.removeEventListener("statechange", graph.onStateChange);
        for (const node of [
          graph.source,
          graph.bass,
          graph.voice,
          graph.compressor,
          graph.gain,
        ]) {
          try {
            node.disconnect();
          } catch {
            /* continue releasing the graph */
          }
        }
        void graph.ctx.close().catch(() => {});
      }, 0);
    },
  };
}
