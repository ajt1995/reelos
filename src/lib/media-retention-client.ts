import { useCallback, useEffect, useRef, useState } from "react";

export interface MediaRetentionSnapshot {
  profileId: string;
  id: string;
  kept: boolean;
  storage: "local-original";
  fileVersion: string;
}

export interface MediaRetentionState {
  snapshot: MediaRetentionSnapshot | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  failure?: { status: number; code: string };
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type RetentionIdentity = { id: string; expectedProfileId: string };
type RetentionWriteIdentity = RetentionIdentity & { expectedFileVersion: string };

export class MediaRetentionError extends Error {
  readonly status: number;
  readonly code: string;
  readonly invalidatesSnapshot: boolean;

  constructor(message: string, status: number, code: string, invalidatesSnapshot: boolean) {
    super(message);
    this.name = "MediaRetentionError";
    this.status = status;
    this.code = code;
    this.invalidatesSnapshot = invalidatesSnapshot;
  }
}

const isFileVersion = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);

async function readRetention(response: Response, identity: RetentionIdentity, keep?: boolean, expectedFileVersion?: string): Promise<MediaRetentionSnapshot> {
  const payload: unknown = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new MediaRetentionError("Retention returned an invalid acknowledgement", response.status, "malformed_retention_ack", true);
  }
  const result = payload as Record<string, unknown>;
  if (!response.ok || result.ok === false) {
    const code = typeof result.code === "string" ? result.code : "retention_request_failed";
    const invalidatesSnapshot = [401, 403, 404, 409].includes(response.status) ||
      code === "retention_identity_changed" || code === "identity_changed" || code === "retention_unavailable";
    throw new MediaRetentionError(
      typeof result.error === "string" ? result.error : "Retention unavailable",
      response.status, code, invalidatesSnapshot,
    );
  }
  if (
    result.ok !== true || result.profileId !== identity.expectedProfileId || result.id !== identity.id ||
    result.storage !== "local-original" || typeof result.kept !== "boolean" || !isFileVersion(result.fileVersion) ||
    (keep !== undefined && (result.persisted !== true || result.kept !== keep || result.fileVersion !== expectedFileVersion))
  ) throw new MediaRetentionError("Retention was not acknowledged for this file version and profile", response.status, "malformed_retention_ack", true);
  return { profileId: identity.expectedProfileId, id: identity.id, kept: result.kept, storage: "local-original", fileVersion: result.fileVersion };
}

function assertIdentity(identity: RetentionIdentity) {
  if (!identity.id?.trim() || !identity.expectedProfileId?.trim()) throw new Error("A verified file and profile are required");
}

export async function loadMediaRetention(identity: RetentionIdentity, signal?: AbortSignal, fetcher: FetchLike = fetch) {
  assertIdentity(identity);
  const query = new URLSearchParams({ id: identity.id, expectedProfileId: identity.expectedProfileId });
  const response = await fetcher(`/api/library/keep?${query}`, { cache: "no-store", signal });
  return readRetention(response, identity);
}

export async function saveMediaRetention(identity: RetentionWriteIdentity, keep: boolean, signal?: AbortSignal, fetcher: FetchLike = fetch) {
  assertIdentity(identity);
  if (!isFileVersion(identity.expectedFileVersion)) throw new MediaRetentionError("Check the current file version before keeping it", 0, "retention_version_required", true);
  if (typeof keep !== "boolean") throw new Error("Choose whether to keep this local original");
  const response = await fetcher("/api/library/keep", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: identity.id, expectedProfileId: identity.expectedProfileId, expectedFileVersion: identity.expectedFileVersion, keep }), signal,
  });
  return readRetention(response, identity, keep, identity.expectedFileVersion);
}

const emptyState = (): MediaRetentionState => ({ snapshot: null, loading: false, saving: false, error: null });

/** A mounted file/profile scope; only its acknowledged GET may authorize a later POST. */
export function createMediaRetentionController({
  id, expectedProfileId, onChange, isCurrent = () => true, fetcher = fetch,
}: RetentionIdentity & {
  onChange?(state: MediaRetentionState): void;
  isCurrent?(): boolean;
  fetcher?: FetchLike;
}) {
  let state = emptyState();
  let generation = 0;
  let disposed = false;
  let pending: AbortController | null = null;
  const current = (request: number) => !disposed && request === generation && isCurrent();
  const publish = (next: MediaRetentionState) => { state = next; onChange?.(next); };
  function begin() {
    pending?.abort();
    pending = new AbortController();
    generation += 1;
    return { request: generation, signal: pending.signal };
  }
  return {
    getState: () => state,
    async load(): Promise<boolean> {
      if (disposed || !isCurrent()) return false;
      const { request, signal } = begin();
      publish({ ...emptyState(), loading: true });
      try {
        const snapshot = await loadMediaRetention({ id, expectedProfileId }, signal, fetcher);
        if (!current(request)) return false;
        publish({ snapshot, loading: false, saving: false, error: null });
        return true;
      } catch (error) {
        if (current(request)) publish({ ...emptyState(),
          error: "This home could not verify a local original. Nothing was marked as kept by this attempt. Retry to check this file.",
          failure: error instanceof MediaRetentionError ? { status: error.status, code: error.code } : undefined,
        });
        return false;
      }
    },
    async save(keep: boolean): Promise<boolean> {
      if (disposed || !isCurrent() || state.loading || state.saving) return false;
      const acknowledged = state.snapshot;
      if (!acknowledged) {
        publish({ ...state, error: "Check this file's library status before keeping it." });
        return false;
      }
      const { request, signal } = begin();
      publish({ ...state, saving: true, error: null, failure: undefined });
      try {
        const snapshot = await saveMediaRetention({ id: acknowledged.id, expectedProfileId: acknowledged.profileId, expectedFileVersion: acknowledged.fileVersion }, keep, signal, fetcher);
        if (!current(request)) return false;
        publish({ snapshot, loading: false, saving: false, error: null });
        return true;
      } catch (error) {
        if (current(request)) publish({ ...state,
          snapshot: error instanceof MediaRetentionError && error.invalidatesSnapshot ? null : state.snapshot,
          saving: false, error: "Your library choice could not be confirmed. Retry checking this file, then choose again if needed.",
          failure: error instanceof MediaRetentionError ? { status: error.status, code: error.code } : undefined,
        });
        return false;
      }
    },
    dispose() {
      disposed = true;
      generation += 1;
      pending?.abort();
    },
  };
}

/** Changing the file, profile, or playback scope clears all previous retention UI. */
export function useMediaRetention(id: string | null, expectedProfileId: string | null, scope: string, isCurrent?: () => boolean) {
  const key = JSON.stringify([id, expectedProfileId, scope]);
  const currentKey = useRef(key);
  currentKey.current = key;
  const currentGuard = useRef(isCurrent);
  currentGuard.current = isCurrent;
  const controllerRef = useRef<{ key: string; controller: ReturnType<typeof createMediaRetentionController> } | null>(null);
  const [stored, setStored] = useState<{ key: string; state: MediaRetentionState }>({ key: "", state: emptyState() });
  useEffect(() => {
    if (!id || !expectedProfileId) {
      setStored({ key, state: { ...emptyState(), error: "Library keeping is unavailable until this file and your profile are verified." } });
      return;
    }
    const controller = createMediaRetentionController({
      id, expectedProfileId,
      isCurrent: () => currentKey.current === key && (currentGuard.current?.() ?? true),
      onChange: (state) => setStored({ key, state }),
    });
    controllerRef.current = { key, controller };
    void controller.load();
    return () => {
      controller.dispose();
      if (controllerRef.current?.controller === controller) controllerRef.current = null;
    };
  }, [id, expectedProfileId, key]);
  const retry = useCallback(() => {
    if (controllerRef.current?.key === key) void controllerRef.current.controller.load();
  }, [key]);
  const save = useCallback((keep: boolean) => (
    controllerRef.current?.key === key ? controllerRef.current.controller.save(keep) : Promise.resolve(false)
  ), [key]);
  const state = stored.key === key ? stored.state : { ...emptyState(), loading: Boolean(id && expectedProfileId) };
  return { ...state, retry, save, canCheck: Boolean(id && expectedProfileId) };
}
