import assert from "node:assert/strict";
import test from "node:test";
import EventEmitter from "node:events";
import os from "node:os";
import {
  NeuralScaleEngine,
  SCALE_STATES,
  SCALE_CONFIGS,
} from "./neural-scale-engine.mjs";

test("NeuralScaleEngine initializes in EXPANDED state with 128MB budget and 64 dims on shared workstations", () => {
  const engine = new NeuralScaleEngine({
    consoleSentinel: new EventEmitter(),
    isDedicated: false,
  });
  const status = engine.getStatus();

  assert.equal(status.state, SCALE_STATES.EXPANDED);
  assert.equal(status.embeddingDim, 64);
  assert.equal(status.maxMemoryBudgetMb, 128);
  assert.equal(status.concurrencyThreads, 2);
  assert.equal(status.quantized, false);
  assert.match(status.label, /Full High-Fidelity/);
});

test("NeuralScaleEngine initializes in DEDICATED_MAX with a bounded non-reserved budget", () => {
  const engine = new NeuralScaleEngine({
    consoleSentinel: new EventEmitter(),
    isDedicated: true,
  });
  const status = engine.getStatus();

  assert.equal(status.state, SCALE_STATES.DEDICATED_MAX);

  const ramGb = os.totalmem() / 1024 ** 3;
  let expectedDims = 128;
  if (ramGb > 12) expectedDims = 512;
  else if (ramGb >= 6) expectedDims = 256;
  assert.equal(status.embeddingDim, expectedDims);

  const totalMb = Math.round(os.totalmem() / (1024 * 1024));
  const systemBudgetMb =
    ramGb < 6 ? Math.max(128, totalMb - 1024) : Math.max(512, totalMb - 256);
  const expectedMem = Math.min(
    systemBudgetMb,
    Math.min(2048, Math.max(128, Math.round(systemBudgetMb * 0.25))),
  );
  assert.equal(status.maxMemoryBudgetMb, expectedMem);
  assert.equal(status.systemMemoryBudgetMb, systemBudgetMb);
  assert.equal(status.budgetScope, "model-within-system");

  assert.equal(status.concurrencyThreads, 4);
  assert.match(status.label, /Dedicated Turbo/);
});

test("NeuralScaleEngine reports a near-whole-machine appliance budget without allocating it", () => {
  const gib = 1024 ** 3;
  const engine = new NeuralScaleEngine({
    consoleSentinel: new EventEmitter(),
    isDedicated: true,
    totalMemoryBytes: 4 * gib,
    freeMemoryBytes: () => 3 * gib,
  });
  const status = engine.getStatus();

  assert.equal(status.systemMemoryBudgetMb, 3072);
  assert.equal(status.systemMemoryHeadroomMb, 1024);
  assert.equal(status.maxMemoryBudgetMb, 768);
  assert.equal(status.currentMemoryMb, 0);
});

test("NeuralScaleEngine contracts to stealth floor (48MB) when creator workstation runs heavy foreground apps", () => {
  const scheduler = new EventEmitter();
  scheduler.subscribe = (fn) => scheduler.on("STATE_UPDATE", fn);

  const engine = new NeuralScaleEngine({
    consoleSentinel: new EventEmitter(),
    politeScheduler: scheduler,
    isDedicated: false,
  });

  assert.equal(engine.state, SCALE_STATES.EXPANDED);

  // Photo editor opens Lightroom/Photoshop -> scheduler signals stealth_yield
  scheduler.emit("STATE_UPDATE", "stealth_yield", true, "none");

  assert.equal(engine.state, SCALE_STATES.CONTRACTED);
  const status = engine.getStatus();
  assert.equal(status.embeddingDim, 16);
  assert.equal(status.maxMemoryBudgetMb, 48);
  assert.ok(status.currentMemoryMb <= 48.0);
  assert.match(status.label, /Stealth Floor/);

  // Photo editor finishes work -> normal state returns
  scheduler.emit("STATE_UPDATE", "normal", false, "none");
  assert.equal(engine.state, SCALE_STATES.EXPANDED);
});

test("NeuralScaleEngine contracts on CONSOLES_GAMING_YIELD event to 48MB budget and 16 dims", () => {
  const sentinel = new EventEmitter();
  const engine = new NeuralScaleEngine({
    consoleSentinel: sentinel,
    isDedicated: false,
  });

  let stateChanged = null;
  engine.on("STATE_CHANGED", (evt) => {
    stateChanged = evt;
  });

  // Emit yield event from sentinel
  sentinel.emit("CONSOLES_GAMING_YIELD", {
    reason: "bufferbloat_spike",
    deltaMs: 22,
  });

  assert.equal(engine.state, SCALE_STATES.CONTRACTED);
  const status = engine.getStatus();
  assert.equal(status.embeddingDim, 16);
  assert.equal(status.maxMemoryBudgetMb, 48);
  assert.equal(status.quantized, true);
  assert.ok(
    status.currentMemoryMb <= 48.0,
    "Contracted memory must be within 48MB floor",
  );

  assert.ok(stateChanged);
  assert.equal(stateChanged.from, SCALE_STATES.EXPANDED);
  assert.equal(stateChanged.to, SCALE_STATES.CONTRACTED);
  assert.equal(stateChanged.reason, "console_gaming_yield");
});

test("NeuralScaleEngine resumes to EXPANDED on CONSOLES_GAMING_RESUME event", () => {
  const sentinel = new EventEmitter();
  const engine = new NeuralScaleEngine({
    consoleSentinel: sentinel,
    isDedicated: false,
  });

  // First contract
  sentinel.emit("CONSOLES_GAMING_YIELD", { reason: "bufferbloat_spike" });
  assert.equal(engine.state, SCALE_STATES.CONTRACTED);

  // Then resume
  sentinel.emit("CONSOLES_GAMING_RESUME", { reason: "latency_stabilized" });
  assert.equal(engine.state, SCALE_STATES.EXPANDED);
  assert.equal(engine.getStatus().maxMemoryBudgetMb, 128);
});

test("NeuralScaleEngine computes cosine similarity accurately across all modes without dropped inferences", () => {
  const engine = new NeuralScaleEngine({
    consoleSentinel: new EventEmitter(),
    isDedicated: false,
  });

  // Expanded mode embeddings
  const embA = engine.embedText("Interstellar sci-fi space exploration");
  const embB = engine.embedText("Interstellar space voyage Christopher Nolan");
  const embC = engine.embedText("Romantic comedy baking Paris");

  assert.equal(embA.length, 64);
  assert.equal(embB.length, 64);

  const simHigh = engine.cosineSimilarity(embA, embB);
  const simLow = engine.cosineSimilarity(embA, embC);

  assert.ok(simHigh > simLow, "Similar titles should score higher similarity");
  assert.ok(
    simHigh > 0.5,
    "Close variants should score high cosine similarity",
  );

  // Dedicated Max mode embeddings
  engine.expandDedicatedMax();
  const dedicatedA = engine.embedText("Interstellar sci-fi space exploration");
  const ramGb = os.totalmem() / 1024 ** 3;
  let expectedDims = 128;
  if (ramGb > 12) expectedDims = 512;
  else if (ramGb >= 6) expectedDims = 256;
  assert.equal(dedicatedA.length, expectedDims);

  // Contract mode
  engine.contract("gaming_active");
  const contractedA = engine.embedText("Interstellar sci-fi space exploration");
  const contractedB = engine.embedText(
    "Interstellar space voyage Christopher Nolan",
  );

  assert.equal(contractedA.length, 16);
  assert.equal(contractedB.length, 16);

  const contractedSim = engine.cosineSimilarity(contractedA, contractedB);
  assert.ok(
    contractedSim > 0.4,
    "Contracted vectors retain strong semantic ranking",
  );

  const status = engine.getStatus();
  assert.equal(
    status.droppedInferences,
    0,
    "Zero dropped inferences invariant must hold",
  );
});

test("NeuralScaleEngine reports budgets without allocating dummy resident memory", () => {
  const engine = new NeuralScaleEngine({
    consoleSentinel: new EventEmitter(),
    isDedicated: false,
  });
  const status = engine.getStatus();

  assert.equal(status.currentMemoryMb, 0);
  assert.ok(status.residentRssMb > 0, "RSS memory must be positive and real");
  assert.equal(engine.residentBuffer, null);
  assert.equal(status.allocationStrategy, "lazy-workload-owned");

  // Contract to stealth floor
  engine.contract("gaming_active");
  const contractedStatus = engine.getStatus();
  assert.equal(contractedStatus.currentMemoryMb, 0);
  assert.equal(engine.residentBuffer, null);
});

test("handleNeuralScaleRoute dispatches scale, brain status, and embed endpoints", async () => {
  const { handleNeuralScaleRoute } = await import("./neural-scale-engine.mjs");

  // Test /api/neural/scale
  let scaleJson = null;
  const mockResScale = {
    statusCode: 0,
    setHeader: () => {},
    end: (data) => {
      scaleJson = JSON.parse(data);
    },
  };
  const handledScale = await handleNeuralScaleRoute(
    { url: "/api/neural/scale", method: "GET" },
    mockResScale,
  );
  assert.ok(handledScale);
  assert.equal(scaleJson.ok, true);
  assert.ok(scaleJson.embeddingDim > 0);

  // Test /api/neural/brain/status
  let brainJson = null;
  const mockResBrain = {
    statusCode: 0,
    setHeader: () => {},
    end: (data) => {
      brainJson = JSON.parse(data);
    },
  };
  const handledBrain = await handleNeuralScaleRoute(
    { url: "/api/neural/brain/status", method: "GET" },
    mockResBrain,
  );
  assert.ok(handledBrain);
  assert.equal(brainJson.ok, true);
  assert.ok(brainJson.brain.latentDim > 0);

  // Test /api/neural/embed
  let embedJson = null;
  const mockResEmbed = {
    statusCode: 0,
    setHeader: () => {},
    end: (data) => {
      embedJson = JSON.parse(data);
    },
  };
  async function* mockStream() {
    yield Buffer.from(
      JSON.stringify({ text: "Blade Runner 2049 neon noir cyberpunk" }),
    );
  }
  const handledEmbed = await handleNeuralScaleRoute(
    {
      url: "/api/neural/embed",
      method: "POST",
      [Symbol.asyncIterator]: mockStream,
    },
    mockResEmbed,
  );

  assert.ok(handledEmbed);
  assert.equal(embedJson.ok, true);
  assert.ok(Array.isArray(embedJson.embedding));
  assert.equal(embedJson.embedding.length, embedJson.dim);
});

test("NeuralScaleEngine quantizes and dequantizes vectors accurately", () => {
  const engine = new NeuralScaleEngine({
    consoleSentinel: new EventEmitter(),
    isDedicated: false,
  });
  const rawVec = [0.0, 0.5, -0.5, 0.99, -0.99];
  const q = engine.quantize(rawVec);

  assert.equal(q.length, rawVec.length);
  assert.ok(q.every((v) => Number.isInteger(v)));

  const deq = engine.dequantize(q);
  for (let i = 0; i < rawVec.length; i++) {
    assert.ok(
      Math.abs(rawVec[i] - deq[i]) < 0.001,
      `Index ${i} should match closely`,
    );
  }
});
