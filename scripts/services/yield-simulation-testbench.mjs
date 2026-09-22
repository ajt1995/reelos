import EventEmitter from 'node:events';
import { ConsoleSentinel } from './console-sentinel.mjs';
import { NeuralScaleEngine, SCALE_STATES } from './neural-scale-engine.mjs';
import { TorBoxRateLimiter } from './debrid-service.mjs';
import { getRollingNextUpBuffer } from './media-strategy-service.mjs';
import { isQuietHours, shouldYieldToCpu } from './polite-scheduler.mjs';

/**
 * YieldSimulationTestbench orchestrates automated deterministic simulations
 * to verify that all ReelOS background subsystems gracefully yield resources
 * (network bandwidth, CPU, memory, storage) during active console gaming,
 * transcoding, rate-limit storms, or storage constraints.
 */
export class YieldSimulationTestbench extends EventEmitter {
  constructor(options = {}) {
    super();
    this.history = [];
  }

  /**
   * Simulation 1: Console Gaming Bufferbloat Spike & Resume
   */
  async simulateConsoleYield({
    baselineRtt = 18,
    spikeRtt = 50,
    consoleVendor = 'playstation',
    cooldownMs = 50,
  } = {}) {
    const sentinel = new ConsoleSentinel({
      thresholdMs: 15,
      baselineRtt,
      cooldownMs,
    });

    let yieldEvent = null;
    let resumeEvent = null;
    let downloadSpeedBps = 50_000_000; // 50MB/s downloading

    sentinel.on('CONSOLES_GAMING_YIELD', (evt) => {
      yieldEvent = evt;
      downloadSpeedBps = 0; // Throttle downloads to 0 for zero-jitter gaming
    });

    sentinel.on('CONSOLES_GAMING_RESUME', (evt) => {
      resumeEvent = evt;
      downloadSpeedBps = 50_000_000; // Restore downloads
    });

    sentinel.registerConsole('192.168.1.150', consoleVendor);

    // Step 1: Normal ping baseline
    sentinel.evaluatePing(baselineRtt);
    const initialStatus = sentinel.getStatus();

    // Step 2: Latency spike occurs during intense multiplayer match
    sentinel.evaluatePing(spikeRtt);
    const yieldedStatus = sentinel.getStatus();

    // Step 3: Wait for cooldown and stabilize
    await new Promise((resolve) => setTimeout(resolve, cooldownMs + 15));
    sentinel.evaluatePing(baselineRtt);
    const resumedStatus = sentinel.getStatus();

    const record = {
      test: 'console_gaming_yield',
      success: Boolean(yieldEvent && resumeEvent && downloadSpeedBps > 0),
      yieldEvent,
      resumeEvent,
      initialStatus,
      yieldedStatus,
      resumedStatus,
    };
    this.history.push(record);
    return record;
  }

  /**
   * Simulation 2: TorBox 429 Storm & Token-Bucket Pacing
   */
  async simulateTorBox429Storm({ requestCount = 20, retryAfterSec = 1 } = {}) {
    const limiter = new TorBoxRateLimiter({
      capacity: 5,
      refillRate: 5, // 5 tokens/sec for fast test execution
      ttlMs: 5000,
    });

    let totalDispatched = 0;
    let rateLimitEncountered = 0;
    let successfulDeliveries = 0;

    const requestFn = async () => {
      totalDispatched++;
      if (totalDispatched === 6) {
        // Trigger a 429 response on request 6
        rateLimitEncountered++;
        return {
          status: 429,
          headers: {
            get: (h) => (h.toLowerCase() === 'retry-after' ? String(retryAfterSec) : null),
          },
        };
      }
      return { status: 200, data: { id: `hash-${totalDispatched}`, cached: true } };
    };

    const tasks = [];
    for (let i = 0; i < requestCount; i++) {
      tasks.push(
        limiter
          .executeRequest(`key-${i}`, requestFn, { bypassCache: true })
          .then((res) => {
            successfulDeliveries++;
            return res;
          })
          .catch((err) => {
            // Expected for the 429 probe
            return { error: err.message };
          })
      );
    }

    const results = await Promise.all(tasks);

    const record = {
      test: 'torbox_429_storm',
      requestCount,
      totalDispatched,
      successfulDeliveries,
      rateLimitEncountered,
      backoffActive: limiter.backoffUntil > 0,
      success: successfulDeliveries >= requestCount - 1, // All succeeded except the intentional 429 probe
    };
    this.history.push(record);
    return record;
  }

  /**
   * Simulation 3: Dynamic AI Model Contraction & Expansion Under Load
   */
  async simulateAiContraction() {
    const sentinel = new EventEmitter();
    // This scenario verifies the shared-machine contraction contract. A
    // dedicated appliance deliberately keeps a different memory floor.
    const engine = new NeuralScaleEngine({ consoleSentinel: sentinel, isDedicated: false });

    // 1. Initial Expanded Baseline
    const initialConfig = engine.getConfig();
    const emb1 = engine.embedText('Interstellar Christopher Nolan 4K');
    const simInitial = engine.cosineSimilarity(emb1, emb1);

    // 2. Gaming Sentinel signals Yield -> optional workload budget contracts.
    sentinel.emit('CONSOLES_GAMING_YIELD', { reason: 'bufferbloat_spike' });
    const contractedConfig = engine.getConfig();

    // 3. Continuous inference during contraction: zero dropped inferences!
    const embContracted = engine.embedText('Severance Macrodata Refinement');
    const simContracted = engine.cosineSimilarity(embContracted, embContracted);

    // 4. Gaming Ends -> Model expands back to 15MB
    sentinel.emit('CONSOLES_GAMING_RESUME', { reason: 'latency_stabilized' });
    const resumedConfig = engine.getConfig();

    const record = {
      test: 'ai_dynamic_contraction',
      initialState: initialConfig.state,
      contractedState: contractedConfig.state,
      contractedMemoryMb: contractedConfig.currentMemoryMb,
      contractedBudgetMb: contractedConfig.maxMemoryBudgetMb,
      resumedBudgetMb: resumedConfig.maxMemoryBudgetMb,
      resumedState: resumedConfig.state,
      droppedInferences: resumedConfig.droppedInferences,
      simInitial,
      simContracted,
      success: (
        initialConfig.state === SCALE_STATES.EXPANDED &&
        contractedConfig.state === SCALE_STATES.CONTRACTED &&
        contractedConfig.currentMemoryMb === 0 &&
        contractedConfig.maxMemoryBudgetMb === 48 &&
        resumedConfig.state === SCALE_STATES.EXPANDED &&
        resumedConfig.maxMemoryBudgetMb === 128 &&
        resumedConfig.droppedInferences === 0
      ),
    };
    this.history.push(record);
    return record;
  }

  /**
   * Simulation 4: Polite Scheduler Quiet-Hours & CPU Load Yield
   */
  simulatePoliteSchedulerYield({ quietHour = 23, daytimeHour = 14, highCpu = 90, lowCpu = 20 } = {}) {
    // Test quiet hours (11 PM - 7 AM default quiet period)
    const quietDecision = isQuietHours(quietHour);
    const daytimeDecision = isQuietHours(daytimeHour);

    // Test CPU yield
    const highCpuYield = shouldYieldToCpu(highCpu, 80);
    const lowCpuYield = shouldYieldToCpu(lowCpu, 80);

    const record = {
      test: 'polite_scheduler_yield',
      quietHour,
      quietDecision,
      daytimeHour,
      daytimeDecision,
      highCpuYield,
      lowCpuYield,
      success: Boolean(quietDecision && !daytimeDecision && highCpuYield && !lowCpuYield),
    };
    this.history.push(record);
    return record;
  }

  /**
   * Simulation 5: Hybrid Storage Rolling Buffer Eviction at Capacity
   */
  simulateStorageEviction({ capacityPct = 96, seriesId = 'series-severance' } = {}) {
    const watchedHistory = [
      { seriesId, season: 1, episode: 1 },
      { seriesId, season: 1, episode: 2 },
      { seriesId, season: 1, episode: 3 },
    ];

    // Current watching: Season 1, Episode 3. Next up: Episode 4 and 5.
    const bufferResult = getRollingNextUpBuffer(seriesId, 1, 3, 2, {
      capacityPct,
      watchedEpisodes: watchedHistory,
    });

    const record = {
      test: 'storage_rolling_buffer_eviction',
      capacityPct,
      nextUpEpisodes: bufferResult.map((e) => `${e.season}x${e.episode}`),
      evictedEpisodes: (bufferResult.evicted || []).map((e) => `${e.season}x${e.episode}`),
      maintainedForwardWindow: bufferResult.maintainedForwardWindow,
      success: (
        bufferResult.length === 2 &&
        bufferResult.maintainedForwardWindow === true &&
        Array.isArray(bufferResult.evicted) &&
        bufferResult.evicted.length === 3
      ),
    };
    this.history.push(record);
    return record;
  }

  /**
   * Executes full testbench suite
   */
  async runAllSimulations() {
    const s1 = await this.simulateConsoleYield();
    const s2 = await this.simulateTorBox429Storm();
    const s3 = await this.simulateAiContraction();
    const s4 = this.simulatePoliteSchedulerYield();
    const s5 = this.simulateStorageEviction();

    const allPassed = s1.success && s2.success && s3.success && s4.success && s5.success;

    return {
      timestamp: new Date().toISOString(),
      allPassed,
      results: {
        consoleYield: s1,
        torBoxPacing: s2,
        aiContraction: s3,
        politeScheduler: s4,
        storageEviction: s5,
      },
    };
  }
}

export const yieldSimulationTestbench = new YieldSimulationTestbench();

export async function handleYieldSimulationRoute(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/api/simulation/run') {
    const results = await yieldSimulationTestbench.runAllSimulations();
    res.statusCode = results.allPassed ? 200 : 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: results.allPassed, ...results }));
    return true;
  }
  return false;
}
