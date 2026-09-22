import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  PRESET_LABELS,
  attachAudioBooster,
  type AudioStatus,
} from "./audio-booster.ts";

test("Audio Booster: provides valid preset labels and descriptions", () => {
  assert.ok(PRESET_LABELS.off);
  assert.ok(PRESET_LABELS.volumeLeveling);
  assert.ok(PRESET_LABELS.dialogueBoost);
  assert.ok(PRESET_LABELS.nightMode);
  assert.match(PRESET_LABELS.dialogueBoost.desc, /voice frequencies/i);
  assert.match(PRESET_LABELS.nightMode.desc, /explosions/i);
  assert.match(PRESET_LABELS.volumeLeveling.desc, /quiet and loud/i);
});

test("Audio Booster: attaches gracefully in headless / non-audio environment", async () => {
  const dummyVideo = {} as HTMLVideoElement;
  const controller = attachAudioBooster(dummyVideo);
  assert.equal(controller.getPreset(), "off");
  assert.equal(await controller.setPreset("dialogueBoost"), false);
  assert.equal(controller.supported, false);
  assert.equal(controller.getStatus().state, "unsupported");
  controller.destroy();
});

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
afterEach(() => {
  if (originalWindow)
    Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

class FakeParam {
  value = 0;
  setValueAtTime(value: number) {
    this.value = value;
  }
}

class FakeNode {
  connections = new Set<FakeNode>();
  type = "";
  gain = new FakeParam();
  frequency = new FakeParam();
  Q = new FakeParam();
  threshold = new FakeParam();
  knee = new FakeParam();
  ratio = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
  connect(node: FakeNode) {
    this.connections.add(node);
    return node;
  }
  disconnect(node?: FakeNode) {
    if (node) this.connections.delete(node);
    else this.connections.clear();
  }
}

function fakeAudio(
  options: {
    fail?: "constructor" | "effects" | "source" | "resume";
    waitForResume?: Promise<void>;
  } = {},
) {
  const contexts: FakeContext[] = [];
  const captured = new WeakSet<object>();
  class FakeContext extends EventTarget {
    state = "suspended";
    currentTime = 0;
    destination = new FakeNode();
    source = new FakeNode();
    compressor = new FakeNode();
    filters: FakeNode[] = [];
    gain = new FakeNode();
    sourceCalls = 0;
    closeCalls = 0;
    resumeCalls = 0;
    rejectResume = false;
    constructor() {
      super();
      if (options.fail === "constructor") throw new Error("No audio device");
      contexts.push(this);
    }
    async resume() {
      this.resumeCalls++;
      await options.waitForResume;
      if (options.fail === "resume" || this.rejectResume)
        throw new Error("Activation denied");
      this.state = "running";
      this.dispatchEvent(new Event("statechange"));
    }
    async close() {
      this.closeCalls++;
      this.state = "closed";
      this.dispatchEvent(new Event("statechange"));
    }
    createMediaElementSource(element: object) {
      this.sourceCalls++;
      if (options.fail === "source" || captured.has(element))
        throw new Error("Already captured");
      captured.add(element);
      return this.source;
    }
    createDynamicsCompressor() {
      if (options.fail === "effects") throw new Error("Cannot create effects");
      return this.compressor;
    }
    createBiquadFilter() {
      const filter = new FakeNode();
      this.filters.push(filter);
      return filter;
    }
    createGain() {
      return this.gain;
    }
  }
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { AudioContext: FakeContext },
  });
  return contexts;
}

test("Audio Booster: attach and original selection leave native audio untouched", async () => {
  const contexts = fakeAudio();
  const controller = attachAudioBooster({} as HTMLVideoElement);
  assert.equal(controller.supported, true);
  assert.equal(contexts.length, 0);
  assert.equal(await controller.setPreset("off"), true);
  controller.destroy();
  assert.equal(contexts.length, 0);
});

test("Audio Booster: night mode routes through compression and original bypasses all effects", async () => {
  const contexts = fakeAudio();
  const controller = attachAudioBooster({} as HTMLVideoElement);
  assert.equal(await controller.setPreset("nightMode"), true);
  const ctx = contexts[0];
  const [voice, bass] = ctx.filters;
  assert.deepEqual([...ctx.source.connections], [bass]);
  assert.deepEqual([...bass.connections], [voice]);
  assert.deepEqual([...voice.connections], [ctx.compressor]);
  assert.deepEqual([...ctx.compressor.connections], [ctx.gain]);
  assert.deepEqual([...ctx.gain.connections], [ctx.destination]);
  assert.equal(ctx.compressor.ratio.value, 12);
  assert.equal(ctx.compressor.threshold.value, -30);
  assert.equal(bass.gain.value, -10);
  assert.equal(controller.getPreset(), "nightMode");
  assert.equal(await controller.setPreset("off"), true);
  assert.deepEqual([...ctx.source.connections], [ctx.destination]);
  assert.equal(controller.getPreset(), "off");
  assert.equal(ctx.closeCalls, 0);
});

test("Audio Booster: volume leveling compresses dynamics without coloring voice or bass", async () => {
  const contexts = fakeAudio();
  const controller = attachAudioBooster({} as HTMLVideoElement);
  assert.equal(await controller.setPreset("volumeLeveling"), true);
  const ctx = contexts[0];
  const [voice, bass] = ctx.filters;
  assert.equal(ctx.compressor.threshold.value, -20);
  assert.equal(ctx.compressor.ratio.value, 3);
  assert.equal(voice.gain.value, 0);
  assert.equal(bass.gain.value, 0);
  assert.equal(ctx.gain.gain.value, 1);
});

for (const fail of ["constructor", "effects", "source", "resume"] as const) {
  test(`Audio Booster: ${fail} failure never claims a preset or leaves a captured source`, async () => {
    const contexts = fakeAudio({ fail });
    const controller = attachAudioBooster({} as HTMLVideoElement);
    assert.equal(await controller.setPreset("dialogueBoost"), false);
    assert.equal(controller.getPreset(), "off");
    assert.equal(controller.getStatus().state, "error");
    assert.ok(controller.getStatus().error);
    if (contexts.length) {
      assert.equal(contexts[0].sourceCalls, fail === "source" ? 1 : 0);
      assert.equal(contexts[0].closeCalls, 1);
    }
    controller.destroy();
  });
}

test("Audio Booster: destruction preserves direct audio and reattachment reuses the source", async () => {
  const contexts = fakeAudio();
  const element = {} as HTMLVideoElement;
  const first = attachAudioBooster(element);
  await first.setPreset("dialogueBoost");
  const ctx = contexts[0];
  first.destroy();
  first.destroy();
  assert.deepEqual([...ctx.source.connections], [ctx.destination]);
  assert.equal(ctx.closeCalls, 0);
  assert.equal(await first.setPreset("nightMode"), false);
  const second = attachAudioBooster(element);
  assert.equal(await second.setPreset("nightMode"), true);
  assert.equal(contexts.length, 1);
  assert.equal(ctx.sourceCalls, 1);
  first.destroy();
  assert.equal(second.getPreset(), "nightMode");
  second.destroy();
  assert.deepEqual([...ctx.source.connections], [ctx.destination]);
});

test("Audio Booster: a replaced controller cannot change or destroy the current controller", async () => {
  const contexts = fakeAudio();
  const element = {} as HTMLVideoElement;
  const first = attachAudioBooster(element);
  await first.setPreset("nightMode");
  const second = attachAudioBooster(element);
  assert.equal(first.getStatus().state, "destroyed");
  assert.equal(second.getPreset(), "off");
  assert.equal(await second.setPreset("dialogueBoost"), true);
  first.destroy();
  assert.equal(await first.setPreset("off"), false);
  assert.equal(second.getPreset(), "dialogueBoost");
  assert.equal(contexts[0].closeCalls, 0);
});

test("Audio Booster: off or destroy during activation prevents capturing the media element", async () => {
  for (const action of ["off", "destroy"]) {
    let resume!: () => void;
    const contexts = fakeAudio({
      waitForResume: new Promise<void>((resolve) => {
        resume = resolve;
      }),
    });
    const controller = attachAudioBooster({} as HTMLVideoElement);
    const pending = controller.setPreset("nightMode");
    if (action === "off") assert.equal(await controller.setPreset("off"), true);
    else controller.destroy();
    resume();
    assert.equal(await pending, false);
    assert.equal(contexts[0].sourceCalls, 0);
    assert.equal(contexts[0].closeCalls, 1);
  }
});

test("Audio Booster: concurrent selections initialize once and only apply the newest preset", async () => {
  let resume!: () => void;
  const contexts = fakeAudio({
    waitForResume: new Promise<void>((resolve) => {
      resume = resolve;
    }),
  });
  const controller = attachAudioBooster({} as HTMLVideoElement);
  const first = controller.setPreset("nightMode");
  const second = controller.setPreset("dialogueBoost");
  resume();
  assert.equal(await first, false);
  assert.equal(await second, true);
  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].sourceCalls, 1);
  assert.equal(controller.getPreset(), "dialogueBoost");
});

test("Audio Booster: later resume denial retains bypass and reports failure until retry succeeds", async () => {
  const contexts = fakeAudio();
  const controller = attachAudioBooster({} as HTMLVideoElement);
  await controller.setPreset("nightMode");
  const ctx = contexts[0];
  ctx.state = "suspended";
  ctx.rejectResume = true;
  assert.equal(controller.getStatus().state, "error");
  assert.equal(await controller.setPreset("dialogueBoost"), false);
  assert.deepEqual([...ctx.source.connections], [ctx.destination]);
  assert.equal(ctx.closeCalls, 0);
  assert.equal(controller.getPreset(), "off");
  ctx.rejectResume = false;
  assert.equal(await controller.setPreset("dialogueBoost"), true);
  assert.equal(controller.getStatus().state, "ready");
  assert.equal(controller.getPreset(), "dialogueBoost");
});

test("Audio Booster: deferred destruction releases a removed video's graph", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const contexts = fakeAudio();
  const element = { isConnected: true };
  const controller = attachAudioBooster(element as HTMLVideoElement);
  await controller.setPreset("nightMode");
  controller.destroy();
  const ctx = contexts[0];
  assert.equal(ctx.closeCalls, 0);
  assert.deepEqual([...ctx.source.connections], [ctx.destination]);
  element.isConnected = false;
  t.mock.timers.tick(0);
  assert.equal(ctx.closeCalls, 1);
  for (const node of [ctx.source, ...ctx.filters, ctx.compressor, ctx.gain]) {
    assert.equal(node.connections.size, 0);
  }
  controller.destroy();
  t.mock.timers.tick(0);
  assert.equal(ctx.closeCalls, 1);
  const reused = attachAudioBooster(element as HTMLVideoElement);
  assert.equal(reused.getStatus().state, "error");
  assert.match(reused.getStatus().error ?? "", /released/);
  assert.equal(await reused.setPreset("nightMode"), false);
  assert.equal(contexts.length, 1);
});

test("Audio Booster: deferred cleanup preserves a connected element", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const contexts = fakeAudio();
  const element = { isConnected: true } as HTMLVideoElement;
  const first = attachAudioBooster(element);
  await first.setPreset("nightMode");
  first.destroy();
  t.mock.timers.tick(0);
  assert.equal(contexts[0].closeCalls, 0);
  const second = attachAudioBooster(element);
  assert.equal(await second.setPreset("dialogueBoost"), true);
  assert.equal(contexts[0].sourceCalls, 1);
});

test("Audio Booster: reacquiring even a detached element cancels pending cleanup", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const contexts = fakeAudio();
  const element = { isConnected: false } as HTMLVideoElement;
  const first = attachAudioBooster(element);
  await first.setPreset("nightMode");
  first.destroy();
  const second = attachAudioBooster(element);
  t.mock.timers.tick(0);
  assert.equal(contexts[0].closeCalls, 0);
  assert.equal(await second.setPreset("dialogueBoost"), true);
  assert.equal(contexts[0].sourceCalls, 1);
  first.destroy();
  t.mock.timers.tick(0);
  assert.equal(contexts[0].closeCalls, 0);
  second.destroy();
  t.mock.timers.tick(0);
  assert.equal(contexts[0].closeCalls, 1);
});

test("Audio Booster: subscription tracks applied modes, context interruption, recovery, and unsubscribe", async () => {
  const contexts = fakeAudio();
  const controller = attachAudioBooster({} as HTMLVideoElement);
  const statuses: AudioStatus[] = [];
  const unsubscribe = controller.subscribe((status) => statuses.push(status));
  assert.equal(statuses.at(-1)?.preset, "off");
  await controller.setPreset("nightMode");
  assert.equal(statuses.at(-1)?.preset, "nightMode");
  const ctx = contexts[0];
  ctx.state = "interrupted";
  ctx.dispatchEvent(new Event("statechange"));
  assert.equal(statuses.at(-1)?.state, "error");
  assert.equal(statuses.at(-1)?.preset, "off");
  ctx.state = "running";
  ctx.dispatchEvent(new Event("statechange"));
  assert.equal(statuses.at(-1)?.state, "ready");
  assert.equal(statuses.at(-1)?.preset, "nightMode");
  await controller.setPreset("off");
  assert.equal(statuses.at(-1)?.preset, "off");
  unsubscribe();
  const count = statuses.length;
  await controller.setPreset("dialogueBoost");
  assert.equal(statuses.length, count);
});

test("Audio Booster: failure and destroy notify subscribers, and stale ownership cannot notify active subscribers", async () => {
  const contexts = fakeAudio();
  const element = {} as HTMLVideoElement;
  const first = attachAudioBooster(element);
  const firstStatuses: AudioStatus[] = [];
  first.subscribe((status) => firstStatuses.push(status));
  await first.setPreset("nightMode");
  const second = attachAudioBooster(element);
  assert.equal(firstStatuses.at(-1)?.state, "destroyed");
  const statuses: AudioStatus[] = [];
  second.subscribe((status) => statuses.push(status));
  contexts[0].state = "suspended";
  contexts[0].rejectResume = true;
  assert.equal(await second.setPreset("nightMode"), false);
  assert.equal(statuses.at(-1)?.state, "error");
  second.destroy();
  assert.equal(statuses.at(-1)?.state, "destroyed");
  const count = statuses.length;
  contexts[0].dispatchEvent(new Event("statechange"));
  assert.equal(statuses.length, count);
});
