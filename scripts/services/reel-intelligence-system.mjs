import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { LocalIntelligenceStore } from "./local-intelligence-store.mjs";
import { CapabilityLedger } from "./capability-ledger.mjs";
import { ModelArtifactRegistry } from "./model-artifact-registry.mjs";
import { ReelIntelligenceRuntime } from "./reel-intelligence-runtime.mjs";
import { ResourceGovernor } from "./resource-governor-service.mjs";
import { StorageReservationAuthority } from "./storage-reservation-service.mjs";
import { registerResourceGovernor } from "./resource-workload-coordinator.mjs";
import { createLocalModelExecutor } from "./local-model-executor.mjs";
import { IntelligenceCoordinator } from "./intelligence-coordinator.mjs";
import { registerShippingIntelligenceSpecialists } from "./shipping-intelligence-specialists.mjs";

export const REEL_INTELLIGENCE_CAPABILITIES = Object.freeze([
  ["taste-ranking", "person"], ["semantic-search", "person"], ["scene-understanding", "home"],
  ["family-scene-guidance", "home"], ["dialogue-enhancement", "home"],
  ["predictive-preparation", "home"], ["storage-optimization", "home"],
  ["machine-protection", "device"], ["interface-protection", "device"],
  ["shared-taste-intelligence", "home"], ["release-ranking", "home"],
]);

function diskSample(root) {
  fs.mkdirSync(root, { recursive: true });
  const stat = fs.statfsSync(root, { bigint: true });
  const cap = (value) => value > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(value);
  return { freeBytes: cap(stat.bavail * stat.bsize), totalBytes: cap(stat.blocks * stat.bsize) };
}

function hardwareFingerprint() {
  return {
    platform: process.platform, arch: process.arch, release: os.release(), totalMemoryBytes: os.totalmem(),
    cpus: os.cpus().map((cpu) => ({ model: cpu.model, speed: cpu.speed })),
  };
}

function transactionAdapter(db) {
  return {
    query: (...args) => db.query(...args),
    transaction: (callback) => db.transaction(async (tx) => callback({ query: (...args) => tx.query(...args) })),
  };
}

export async function createReelIntelligenceSystem({
  stateDir = process.env.REELOS_STATE || path.join(process.cwd(), ".reelos-state"),
  storageRoot = process.env.REELOS_MEDIA_ROOT || stateDir,
  db = null,
  trustedModelKeys = {},
  executor = null,
} = {}) {
  const absoluteState = path.resolve(stateDir);
  fs.mkdirSync(path.join(absoluteState, "intelligence"), { recursive: true, mode: 0o700 });
  const database = db || new PGlite(path.join(absoluteState, "intelligence", "events-pgdata"));
  await database.waitReady;
  const store = await new LocalIntelligenceStore({ db: transactionAdapter(database), stateDir: absoluteState }).initialize();
  const capabilityLedger = new CapabilityLedger({ stateDir: absoluteState });
  const artifactRegistry = new ModelArtifactRegistry({ stateDir: absoluteState, trustedKeys: trustedModelKeys });
  const storage = new StorageReservationAuthority({ stateDir: absoluteState, storageRoot });
  const initialDisk = diskSample(storageRoot);
  const governor = new ResourceGovernor({
    telemetry: () => ({ availableMemoryBytes: os.freemem(), freeDiskBytes: diskSample(storageRoot).freeBytes, sampledAt: Date.now() }),
    storageAuthority: storage,
    memorySafetyFloorBytes: Math.max(512 * 1024 ** 2, Math.ceil(os.totalmem() * 0.1)),
    diskSafetyFloorBytes: Math.max(2 * 1024 ** 3, Math.ceil(initialDisk.totalBytes * 0.1)),
  });
  governor.updateHardwareFingerprint(hardwareFingerprint());
  const unregisterGovernor = registerResourceGovernor(absoluteState, governor);
  const modelExecutor = executor || createLocalModelExecutor({ registry: artifactRegistry });

  const runtime = new ReelIntelligenceRuntime({
    registry: artifactRegistry,
    ledger: capabilityLedger,
    governor,
    executor: modelExecutor,
    eventSink: ({ request, result }) => store.appendEvent({
      type: "model.inference", source: "reel-intelligence-runtime", profileId: request.profileScope || null,
      workId: request.media?.canonicalId || null, editionId: request.media?.editionId || null,
      occurredAt: Date.now(), privacyClass: request.profileScope ? "local-sensitive" : "local-private",
      payload: {
        capabilityId: request.capabilityId, modelSetId: result.modelSetId,
        fallbackUsed: result.fallbackUsed, confidence: result.confidence,
        uncertainty: result.uncertainty, elapsedMs: Math.round(result.elapsedMs),
      },
    }),
    onAuditFailure: (error, context) => {
      const record = capabilityLedger.get(context.capabilityId);
      if (record && ["active", "paused"].includes(record.state)) {
        try {
          capabilityLedger.transition(context.capabilityId, "needs_attention", { reason: `Inference audit failed: ${error.code || "store_unavailable"}` });
        } catch (transitionError) {
          console.error("[reelos-intelligence] could not persist audit failure", {
            capabilityId: context.capabilityId,
            code: transitionError?.code || "capability_state_error",
          });
        }
      }
    },
  });

  for (const [id, scope] of REEL_INTELLIGENCE_CAPABILITIES) {
    capabilityLedger.install(id, { scope, reason: "Installed with deterministic behavior while local model validation is pending." });
    runtime.registerCapability(id, {
      fallback: async (_request, context) => ({ available: false, enhanced: false, reason: context.reason }),
    });
  }
  const coordinator = new IntelligenceCoordinator({ store, runtime });
  registerShippingIntelligenceSpecialists(coordinator, { runtime, governor, storage });

  return {
    stateDir: absoluteState, database, store, capabilityLedger, artifactRegistry, storage, governor, runtime, coordinator,
    modelExecutor,
    status() {
      return {
        capabilities: capabilityLedger.list(),
        resources: governor.snapshot(),
        models: REEL_INTELLIGENCE_CAPABILITIES.map(([id]) => artifactRegistry.status(id)),
        execution: REEL_INTELLIGENCE_CAPABILITIES.map(([id]) => runtime.status(id).execution),
      };
    },
    async close() {
      unregisterGovernor();
      governor.close();
      await database.close?.();
    },
  };
}

let singletonPromise = null;
export function getReelIntelligenceSystem(options = {}) {
  singletonPromise ||= createReelIntelligenceSystem(options).catch((error) => {
    singletonPromise = null;
    throw error;
  });
  return singletonPromise;
}
