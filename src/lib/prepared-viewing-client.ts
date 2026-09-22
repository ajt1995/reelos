import { createClientId } from "./client-id.ts";

export type PreparedViewingAction = "start" | "heartbeat" | "stop";
export interface PreparedViewingIdentity { profileId: string; jobId: string; sessionId: string }
export interface PreparedViewingState {
  status: "idle" | "starting" | "active" | "error" | "stopped";
  expiresAt: number | null;
  error: string | null;
}
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type Schedule = (callback: () => void, delayMs: number) => () => void;
const validUuid = (value: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);

export async function postPreparedViewing(
  identity: PreparedViewingIdentity,
  action: PreparedViewingAction,
  { fetcher = fetch, now = () => Date.now() }: { fetcher?: FetchLike; now?: () => number } = {},
): Promise<{ expiresAt: number | null }> {
  if (!identity.profileId.trim() || !validUuid(identity.jobId) || !validUuid(identity.sessionId)) throw new Error("Prepared viewing identity is unavailable");
  const response = await fetcher(`/api/preparation/${encodeURIComponent(identity.jobId)}/viewing`, {
    method: "POST", headers: { "Content-Type": "application/json" }, keepalive: action === "stop",
    body: JSON.stringify({ expectedProfileId: identity.profileId, sessionId: identity.sessionId, action }),
  });
  const result: unknown = await response.json().catch(() => null);
  if (response.status !== 200 || !result || typeof result !== "object" || Array.isArray(result)) throw new Error("Prepared viewing was not acknowledged");
  const ack = result as Record<string, unknown>;
  if (ack.ok !== true || ack.profileId !== identity.profileId || ack.jobId !== identity.jobId || ack.sessionId !== identity.sessionId || ack.action !== action ||
    (action === "stop" ? ack.expiresAt !== null : typeof ack.expiresAt !== "number" || !Number.isFinite(ack.expiresAt) || ack.expiresAt <= now())) {
    throw new Error("Prepared viewing identity or expiry could not be verified");
  }
  return { expiresAt: ack.expiresAt as number | null };
}

const scheduleTimeout: Schedule = (callback, delayMs) => { const timer = setTimeout(callback, delayMs); return () => clearTimeout(timer); };

/** Protects playback for the whole mounted viewing session, including pause and buffering. */
export function createPreparedViewingController({
  profileId, jobId, sessionId = createClientId(), isCurrent = () => true,
  onChange, fetcher = fetch, now = () => Date.now(), schedule = scheduleTimeout,
}: Omit<PreparedViewingIdentity, "sessionId"> & {
  sessionId?: string;
  isCurrent?(): boolean;
  onChange?(state: PreparedViewingState): void;
  fetcher?: FetchLike;
  now?: () => number;
  schedule?: Schedule;
}) {
  const identity = { profileId, jobId, sessionId };
  let state: PreparedViewingState = { status: "idle", expiresAt: null, error: null };
  let closed = false;
  let disposed = false;
  let attempted = false;
  let inFlight: Promise<{ expiresAt: number | null }> | null = null;
  let stopTask: Promise<void> | null = null;
  let cancelHeartbeat: (() => void) | null = null;
  let cancelExpiry: (() => void) | null = null;
  let timerRevision = 0;

  function publish(next: PreparedViewingState) { state = next; if (!disposed) onChange?.(next); }
  function clearTimers() { timerRevision += 1; cancelHeartbeat?.(); cancelExpiry?.(); cancelHeartbeat = null; cancelExpiry = null; }
  async function request(action: PreparedViewingAction) {
    const pending = postPreparedViewing(identity, action, { fetcher, now });
    inFlight = pending;
    try { return await pending; } finally { if (inFlight === pending) inFlight = null; }
  }
  function stopLease(): Promise<void> {
    if (!attempted) return Promise.resolve();
    if (stopTask) return stopTask;
    const pending = inFlight;
    stopTask = (async () => {
      // Do not race a stop ahead of a delayed start or renew it after stopping.
      if (pending) await pending.catch(() => {});
      await postPreparedViewing(identity, "stop", { fetcher, now }).catch(() => {});
    })();
    return stopTask;
  }
  function fail(message: string) {
    if (closed) return;
    closed = true; clearTimers();
    publish({ status: "error", expiresAt: null, error: message });
    void stopLease();
  }
  function markStoppedUnlessError() {
    if (state.status !== "error") publish({ status: "stopped", expiresAt: null, error: null });
  }
  function armTimers(expiresAt: number) {
    clearTimers();
    const scheduledRevision = timerRevision;
    cancelExpiry = schedule(() => {
      if (closed || scheduledRevision !== timerRevision) return;
      if (now() < expiresAt) { armTimers(expiresAt); return; }
      fail("Prepared playback could not stay verified. Choose Play prepared copy to try again.");
    }, Math.max(0, expiresAt - now()));
    cancelHeartbeat = schedule(() => { if (!closed && scheduledRevision === timerRevision) void controller.heartbeat(); }, 15_000);
  }
  const controller = {
    getState: () => state,
    async start(): Promise<boolean> {
      if (closed || disposed || !isCurrent() || inFlight || state.status === "active") return false;
      attempted = true;
      publish({ status: "starting", expiresAt: null, error: null });
      try {
        const ack = await request("start");
        if (closed || !isCurrent()) { closed = true; clearTimers(); markStoppedUnlessError(); await stopLease(); return false; }
        publish({ status: "active", expiresAt: ack.expiresAt, error: null });
        armTimers(ack.expiresAt!);
        return true;
      } catch {
        fail("This prepared copy could not be opened safely. Choose Play prepared copy to try again.");
        if (closed) void stopLease();
        return false;
      }
    },
    async heartbeat(): Promise<boolean> {
      if (closed || disposed || state.status !== "active" || inFlight) return false;
      cancelHeartbeat?.(); cancelHeartbeat = null;
      if (!isCurrent() || state.expiresAt === null || now() >= state.expiresAt) {
        fail("Prepared playback could not stay verified. Choose Play prepared copy to try again."); return false;
      }
      try {
        const ack = await request("heartbeat");
        if (closed || !isCurrent()) { closed = true; clearTimers(); markStoppedUnlessError(); await stopLease(); return false; }
        publish({ status: "active", expiresAt: ack.expiresAt, error: null });
        armTimers(ack.expiresAt!); return true;
      } catch {
        fail("Prepared playback could not stay verified. Choose Play prepared copy to try again.");
        if (closed) void stopLease();
        return false;
      }
    },
    stop(): Promise<void> {
      closed = true; clearTimers();
      if (state.status !== "error") publish({ status: "stopped", expiresAt: null, error: null });
      return stopLease();
    },
    dispose(): Promise<void> {
      disposed = true; closed = true; clearTimers();
      state = { status: "stopped", expiresAt: null, error: null };
      return stopLease();
    },
  };
  return controller;
}
