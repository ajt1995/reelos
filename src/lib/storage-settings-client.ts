export interface StorageStrategy {
  mode: "smart_hybrid" | "cloud_stream" | "offline_download";
  storageAllocation: "dynamic_20" | "fixed";
  allocatedGb: number;
  autoDownloadFavorites: boolean;
  autoDownloadWatchlist: boolean;
  autoDownloadCabinVault: boolean;
}

export interface StorageSettingsSnapshot {
  profileId: string;
  revision: string;
  strategy: StorageStrategy;
  storage: {
    ok: boolean;
    available: boolean;
    totalBytes?: number | null;
    freeBytes?: number | null;
    totalGb?: number | null;
    freeGb?: number | null;
    dynamic20Gb?: number | null;
  };
  budget: {
    available: boolean;
    limitBytes?: number | null;
    protectedFreeBytes?: number | null;
    usedBytes?: number | null;
    reservedBytes?: number | null;
    remainingBytes?: number | null;
    reason?: string;
  };
  preparation: { available: false; reason: string };
  canEdit: boolean;
}

export interface StorageSettingsState {
  snapshot: StorageSettingsSnapshot | null;
  loading: boolean;
  saving: boolean;
  saved: boolean;
  error: string | null;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type StoragePatch = Partial<StorageStrategy>;
const strategyKeys = ["mode", "storageAllocation", "allocatedGb", "autoDownloadFavorites", "autoDownloadWatchlist", "autoDownloadCabinVault"] as const;
const nonnegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));

export class StorageSettingsError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "StorageSettingsError";
    this.status = status;
    this.code = code;
  }
}

function validStrategy(value: unknown): value is StorageStrategy {
  return record(value) && ["smart_hybrid", "cloud_stream", "offline_download"].includes(String(value.mode)) &&
    ["dynamic_20", "fixed"].includes(String(value.storageAllocation)) && nonnegative(value.allocatedGb) &&
    [value.autoDownloadFavorites, value.autoDownloadWatchlist, value.autoDownloadCabinVault].every((flag) => typeof flag === "boolean");
}

async function readSettings(response: Response, expectedProfileId: string, patch?: StoragePatch): Promise<StorageSettingsSnapshot> {
  const payload: unknown = await response.json().catch(() => null);
  if (!record(payload)) throw new StorageSettingsError("Storage settings could not be verified. Please retry.", response.status, "invalid_acknowledgement");
  if (!response.ok || payload.ok === false) {
    throw new StorageSettingsError(typeof payload.error === "string" ? payload.error : "Storage settings are unavailable. Please retry.",
      response.status, typeof payload.code === "string" ? payload.code : "storage_settings_unavailable");
  }
  const { storage, budget, preparation, strategy } = payload;
  const valid = payload.ok === true && payload.profileId === expectedProfileId &&
    typeof payload.revision === "string" && payload.revision.trim().length > 0 && validStrategy(strategy) &&
    typeof payload.canEdit === "boolean" && record(storage) && typeof storage.ok === "boolean" && typeof storage.available === "boolean" &&
    (!storage.available || (storage.ok === true && [storage.totalBytes, storage.freeBytes, storage.totalGb, storage.freeGb, storage.dynamic20Gb].every(nonnegative) &&
      Number(storage.freeBytes) <= Number(storage.totalBytes))) &&
    record(budget) && typeof budget.available === "boolean" &&
    (!budget.available || [budget.limitBytes, budget.protectedFreeBytes, budget.usedBytes, budget.reservedBytes, budget.remainingBytes].every(nonnegative)) &&
    record(preparation) && preparation.available === false && typeof preparation.reason === "string" && preparation.reason.trim().length > 0;
  if (!valid || (patch && (payload.persisted !== true || !payload.canEdit ||
    !record(storage) || storage.available !== true || storage.ok !== true || !record(budget) || budget.available !== true ||
    !Object.entries(patch).every(([key, value]) => (strategy as unknown as Record<string, unknown>)[key] === value)))) {
    throw new StorageSettingsError("Storage settings were not acknowledged for this profile. Please reload them.", response.status, "invalid_acknowledgement");
  }
  return {
    profileId: expectedProfileId, revision: payload.revision as string, strategy: { ...(strategy as unknown as StorageStrategy) },
    storage: { ...(storage as unknown as StorageSettingsSnapshot["storage"]) }, budget: { ...(budget as unknown as StorageSettingsSnapshot["budget"]) },
    preparation: { ...(preparation as unknown as StorageSettingsSnapshot["preparation"]) }, canEdit: payload.canEdit as boolean,
  };
}

export async function loadStorageSettings(expectedProfileId: string, signal?: AbortSignal, fetcher: FetchLike = fetch) {
  if (!expectedProfileId.trim()) throw new StorageSettingsError("Choose your profile to view storage settings.", 0, "profile_required");
  return readSettings(await fetcher("/api/strategy", { cache: "no-store", signal }), expectedProfileId);
}

export async function saveStorageSettings(snapshot: StorageSettingsSnapshot, requestedPatch: StoragePatch, signal?: AbortSignal, fetcher: FetchLike = fetch) {
  if (!snapshot.profileId || !snapshot.revision || !snapshot.canEdit || !snapshot.storage.available || !snapshot.storage.ok || !snapshot.budget.available) {
    throw new StorageSettingsError("Only the home owner can save after storage has been verified.", 0, "storage_not_verified");
  }
  const patch = Object.fromEntries(strategyKeys.filter((key) => requestedPatch[key] !== undefined).map((key) => [key, requestedPatch[key]])) as StoragePatch;
  if (!Object.keys(patch).length || !validStrategy({ ...snapshot.strategy, ...patch })) {
    throw new StorageSettingsError("Choose valid storage preferences before saving.", 0, "invalid_strategy");
  }
  const response = await fetcher("/api/strategy", {
    method: "POST", headers: { "Content-Type": "application/json" }, signal,
    body: JSON.stringify({ expectedProfileId: snapshot.profileId, expectedRevision: snapshot.revision, ...patch }),
  });
  return readSettings(response, snapshot.profileId, patch);
}

export function maximumFixedStorageGb(snapshot: StorageSettingsSnapshot): number {
  if (!snapshot.storage.available || !snapshot.budget.available) return 0;
  return Math.max(0, Math.floor(((snapshot.storage.totalBytes ?? 0) - (snapshot.budget.protectedFreeBytes ?? 0)) / 2 ** 30));
}

export function automaticStorageAllowanceBytes(snapshot: StorageSettingsSnapshot): number | null {
  if (!snapshot.storage.ok || !snapshot.storage.available || !snapshot.budget.available || !nonnegative(snapshot.storage.dynamic20Gb)) return null;
  return snapshot.storage.dynamic20Gb * 2 ** 30;
}

const emptyState = (): StorageSettingsState => ({ snapshot: null, loading: false, saving: false, saved: false, error: null });

export function createStorageSettingsController({ expectedProfileId, isCurrent = () => true, onChange, fetcher = fetch }: {
  expectedProfileId: string;
  isCurrent?(): boolean;
  onChange?(state: StorageSettingsState): void;
  fetcher?: FetchLike;
}) {
  let state = emptyState();
  let disposed = false;
  let sequence = 0;
  let pending: AbortController | null = null;
  const publish = (value: StorageSettingsState) => { state = value; onChange?.(value); };
  const current = (request: number) => !disposed && request === sequence && isCurrent();
  function begin() {
    pending?.abort();
    pending = new AbortController();
    sequence += 1;
    return { request: sequence, signal: pending.signal };
  }
  return {
    getState: () => state,
    async load() {
      if (disposed || !isCurrent()) return false;
      const { request, signal } = begin();
      publish({ ...emptyState(), loading: true });
      try {
        const snapshot = await loadStorageSettings(expectedProfileId, signal, fetcher);
        if (!current(request)) return false;
        publish({ ...emptyState(), snapshot });
        return true;
      } catch (error) {
        if (current(request)) publish({ ...emptyState(), error: error instanceof StorageSettingsError ? error.message : "Storage settings could not be loaded. Please retry." });
        return false;
      }
    },
    async save(patch: StoragePatch) {
      if (disposed || !isCurrent() || state.loading || state.saving || !state.snapshot) return false;
      const acknowledged = state.snapshot;
      const { request, signal } = begin();
      publish({ ...state, saving: true, saved: false, error: null });
      try {
        const snapshot = await saveStorageSettings(acknowledged, patch, signal, fetcher);
        if (!current(request)) return false;
        publish({ ...emptyState(), snapshot, saved: true });
        return true;
      } catch (error) {
        const invalidate = error instanceof StorageSettingsError && ([401, 403, 404, 409].includes(error.status) || error.code === "invalid_acknowledgement" ||
          (error.status === 503 && error.code === "storage_unavailable"));
        if (current(request)) publish({ ...state, snapshot: invalidate ? null : state.snapshot, saving: false, saved: false,
          error: error instanceof StorageSettingsError ? error.message : "Storage settings were not saved. Please retry.",
        });
        return false;
      }
    },
    dispose() { disposed = true; sequence += 1; pending?.abort(); },
  };
}
