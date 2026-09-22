export type PreparationStatus = "deferred" | "preparing" | "validating" | "ready" | "failed" | "cancelled" | "interrupted";
export interface PreparationJob {
  id: string;
  titleId: string;
  title: string;
  recipe: string;
  status: PreparationStatus;
  progress: number | null;
  message: string;
  createdAt: number;
  updatedAt: number;
  canRetry: boolean;
}
export interface PreparationSnapshot {
  profileId: string;
  canManage: boolean;
  recipes: { id: string; label: string }[];
  jobs: PreparationJob[];
  available: true;
}
export interface PreparationState {
  snapshot: PreparationSnapshot | null;
  loading: boolean;
  mutating: boolean;
  error: string | null;
}
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const uuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const nonnegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
export const preparationIsActive = (job: PreparationJob) => job.status === "preparing" || job.status === "validating";

export class PreparationError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status: number, code: string) {
    super(message); this.name = "PreparationError"; this.status = status; this.code = code;
  }
}
const invalid = () => new PreparationError("Preparation could not be verified for this profile. Refresh and try again.", 0, "invalid_acknowledgement");

function readJob(value: unknown): PreparationJob {
  if (!record(value) || !uuid(value.id) || !text(value.titleId) || !text(value.title) || !text(value.recipe) ||
    !["deferred", "preparing", "validating", "ready", "failed", "cancelled", "interrupted"].includes(String(value.status)) ||
    !(value.progress === null || (nonnegative(value.progress) && value.progress <= 1)) ||
    typeof value.message !== "string" || !nonnegative(value.createdAt) || !nonnegative(value.updatedAt) || typeof value.canRetry !== "boolean") throw invalid();
  return { id: value.id, titleId: value.titleId, title: value.title, recipe: value.recipe,
    status: value.status as PreparationStatus, progress: value.progress as number | null, message: value.message,
    createdAt: value.createdAt, updatedAt: value.updatedAt, canRetry: value.canRetry };
}

async function readResponse(response: Response, profileId: string): Promise<Record<string, unknown>> {
  const body: unknown = await response.json().catch(() => null);
  if (!record(body)) throw invalid();
  if (!response.ok || body.ok !== true) throw new PreparationError(
    typeof body.error === "string" ? body.error : "Preparation is unavailable. Please retry.", response.status,
    typeof body.code === "string" ? body.code : "preparation_unavailable",
  );
  if (body.profileId !== profileId || !text(profileId)) throw invalid();
  return body;
}

export async function loadPreparation(profileId: string, signal?: AbortSignal, fetcher: FetchLike = fetch): Promise<PreparationSnapshot> {
  if (!text(profileId)) throw invalid();
  const response = await fetcher(`/api/preparation?expectedProfileId=${encodeURIComponent(profileId)}`, { cache: "no-store", signal });
  const body = await readResponse(response, profileId);
  if (body.available !== true || typeof body.canManage !== "boolean" || !Array.isArray(body.recipes) || !Array.isArray(body.jobs)) throw invalid();
  const recipes = body.recipes.map((recipe) => {
    if (!record(recipe) || !text(recipe.id) || !text(recipe.label)) throw invalid();
    return { id: recipe.id, label: recipe.label };
  });
  const jobs = body.jobs.map(readJob);
  if (new Set(jobs.map((job) => job.id)).size !== jobs.length || new Set(recipes.map((recipe) => recipe.id)).size !== recipes.length) throw invalid();
  return { profileId, canManage: body.canManage, recipes, jobs, available: true };
}

async function postPreparation(profileId: string, path: string, body: Record<string, unknown>, expected: { titleId: string; recipe: string; id?: string }, signal: AbortSignal, fetcher: FetchLike) {
  const response = await fetcher(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedProfileId: profileId, ...body }), signal });
  const result = await readResponse(response, profileId);
  if (result.persisted !== true) throw invalid();
  const job = readJob(result.job);
  if (job.titleId !== expected.titleId || job.recipe !== expected.recipe || (expected.id && job.id !== expected.id)) throw invalid();
  return job;
}

export function preparedFileUrl(job: PreparationJob, profileId: string) {
  if (job.status !== "ready" || !uuid(job.id) || !text(profileId)) return null;
  return `/api/preparation/${encodeURIComponent(job.id)}/file?expectedProfileId=${encodeURIComponent(profileId)}`;
}

const emptyState = (): PreparationState => ({ snapshot: null, loading: false, mutating: false, error: null });
type Schedule = (callback: () => void, delayMs: number) => () => void;
const scheduleTimeout: Schedule = (callback, delayMs) => { const timer = setTimeout(callback, delayMs); return () => clearTimeout(timer); };

export function createPreparationController({ expectedProfileId, isCurrent = () => true, onChange, fetcher = fetch, schedule = scheduleTimeout, pollMs = 2_000 }: {
  expectedProfileId: string;
  isCurrent?(): boolean;
  onChange?(state: PreparationState): void;
  fetcher?: FetchLike;
  schedule?: Schedule;
  pollMs?: number;
}) {
  let state = emptyState();
  let disposed = false;
  let visible = true;
  let revision = 0;
  let pending: AbortController | null = null;
  let cancelPoll: (() => void) | null = null;
  const current = (request: number) => !disposed && request === revision && isCurrent();
  const publish = (next: PreparationState) => { state = next; onChange?.(next); };
  function stopPolling() { cancelPoll?.(); cancelPoll = null; }
  function begin() {
    stopPolling(); pending?.abort(); pending = new AbortController(); revision += 1;
    return { request: revision, signal: pending.signal };
  }
  function armPoll() {
    stopPolling();
    if (!visible || disposed || !isCurrent() || !state.snapshot?.jobs.some(preparationIsActive)) return;
    const request = revision;
    cancelPoll = schedule(() => {
      cancelPoll = null;
      if (visible && current(request)) void controller.refresh();
    }, pollMs);
  }
  function fail(error: unknown) {
    const invalidate = error instanceof PreparationError && ([401, 403, 404, 409].includes(error.status) || error.code === "invalid_acknowledgement");
    publish({ ...state, snapshot: invalidate ? null : state.snapshot, loading: false, mutating: false,
      error: error instanceof PreparationError ? error.message : "Preparation could not be confirmed. Refresh and try again.",
    });
  }
  async function mutate(choice: { titleId: string; recipe: string } | { action: "cancel" | "retry"; job: PreparationJob }): Promise<boolean> {
    if (disposed || !isCurrent() || state.mutating || state.loading) return false;
    const { request, signal } = begin();
    publish({ ...state, mutating: true, error: null });
    try {
      // Reconfirm server authority immediately before every mutation, including retries.
      const fresh = await loadPreparation(expectedProfileId, signal, fetcher);
      if (!current(request)) return false;
      publish({ snapshot: fresh, loading: false, mutating: true, error: null });
      if (!fresh.canManage) throw new PreparationError("Only the home owner can prepare media.", 403, "owner_required");
      let job: PreparationJob;
      if ("action" in choice) {
        const existing = fresh.jobs.find((item) => item.id === choice.job.id);
        if (!existing || existing.titleId !== choice.job.titleId || existing.recipe !== choice.job.recipe) throw invalid();
        if (choice.action === "cancel" ? !preparationIsActive(existing) : !existing.canRetry || !["deferred", "failed", "cancelled", "interrupted"].includes(existing.status)) {
          throw new PreparationError("This job changed. Refresh its status before trying again.", 409, "job_changed");
        }
        job = await postPreparation(expectedProfileId, `/api/preparation/${encodeURIComponent(existing.id)}/${choice.action}`, {},
          choice.action === "cancel" ? existing : { titleId: existing.titleId, recipe: existing.recipe }, signal, fetcher);
        if (choice.action === "retry" && job.id === existing.id) throw invalid();
      } else {
        if (!text(choice.titleId) || !fresh.recipes.some((recipe) => recipe.id === choice.recipe)) throw invalid();
        job = await postPreparation(expectedProfileId, "/api/preparation", { titleId: choice.titleId, recipe: choice.recipe }, choice, signal, fetcher);
      }
      if (!current(request)) return false;
      publish({ snapshot: { ...fresh, jobs: [job, ...fresh.jobs.filter((item) => item.id !== job.id)] }, loading: false, mutating: false, error: null });
      armPoll();
      return true;
    } catch (error) { if (current(request)) fail(error); return false; }
  }
  const controller = {
    getState: () => state,
    async refresh(): Promise<boolean> {
      if (disposed || !isCurrent() || state.mutating) return false;
      const { request, signal } = begin();
      publish({ ...state, loading: true, error: null });
      try {
        const snapshot = await loadPreparation(expectedProfileId, signal, fetcher);
        if (!current(request)) return false;
        publish({ snapshot, loading: false, mutating: false, error: null });
        armPoll(); return true;
      } catch (error) { if (current(request)) fail(error); return false; }
    },
    prepare: (titleId: string, recipe: string) => mutate({ titleId, recipe }),
    cancel: (job: PreparationJob) => mutate({ action: "cancel", job }),
    retry: (job: PreparationJob) => mutate({ action: "retry", job }),
    setVisible(next: boolean) {
      const resumed = !visible && next;
      visible = next;
      if (!next) stopPolling();
      else if (resumed && (!state.snapshot || state.snapshot.jobs.some(preparationIsActive))) void controller.refresh();
    },
    dispose() { disposed = true; revision += 1; stopPolling(); pending?.abort(); },
  };
  return controller;
}
