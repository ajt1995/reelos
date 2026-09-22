import { parseFamilyTreatmentManifest, type FamilyTreatmentManifest } from "./family-treatment.ts";

export type PlaybackSessionAction = "start" | "progress" | "stop";

export type PlaybackSessionBody = {
  itemId: string;
  mediaSourceId: string;
  playSessionId: string;
  positionTicks?: number;
  durationTicks?: number;
  isPaused?: boolean;
};

export type PlaybackSessionResult = {
  ok: boolean;
  status: number;
  code?: string;
  error?: string;
  presenceKey?: string;
  familyTreatment?: FamilyTreatmentManifest;
};

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function postPlaybackSession(
  action: PlaybackSessionAction,
  body: PlaybackSessionBody,
  signal?: AbortSignal,
  fetcher: FetchLike = fetch,
): Promise<PlaybackSessionResult> {
  const response = await fetcher(`/api/playback/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
    keepalive: action === "stop",
  });
  let payload: Record<string, unknown> = {};
  try {
    const parsed: unknown = await response.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed as Record<string, unknown>;
  } catch {
    // A non-JSON failure still has a useful HTTP status.
  }
  const familyTreatment = parseFamilyTreatmentManifest(payload.familyTreatment);
  return {
    ok: response.ok && payload.ok === true,
    status: response.status,
    code: typeof payload.code === "string" ? payload.code : undefined,
    error: typeof payload.error === "string" ? payload.error : undefined,
    presenceKey: typeof payload.presenceKey === "string" ? payload.presenceKey : undefined,
    ...(familyTreatment ? { familyTreatment } : {}),
  };
}

export function playbackPosition(video: { currentTime: number; duration: number; paused: boolean }) {
  return {
    positionTicks: Math.floor(Math.max(0, Number.isFinite(video.currentTime) ? video.currentTime : 0) * 10000000),
    durationTicks: Number.isFinite(video.duration) && video.duration > 0 ? Math.floor(video.duration * 10000000) : undefined,
    isPaused: video.paused,
  };
}

export async function savePrivatePlaybackProgress(
  body: { expectedProfileId: string; titleId: string; progress: number },
  fetcher: FetchLike = fetch,
) {
  const response = await fetcher("/api/profiles/progress", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), keepalive: true,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true || result.persisted !== true) {
    throw new Error("Your playback position could not be saved. Keep this page open and try again.");
  }
}

export function playbackSessionNeedsRestart(result: PlaybackSessionResult) {
  return result.status === 409 && result.code === "playback_session_not_started";
}

export async function savePrivateTitleReaction(
  body: { expectedProfileId: string; titleId: string; reaction: "like" | "love" | "cozy" | "dismiss" | "less" | null },
  fetcher: FetchLike = fetch,
) {
  const response = await fetcher("/api/profiles/reaction", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true || result.persisted !== true || result.profileId !== body.expectedProfileId || result.titleId !== body.titleId || result.reaction !== body.reaction) {
    throw new Error("Your reaction was not saved. Please try again.");
  }
}

export function playbackSessionFailureMessage(result: PlaybackSessionResult) {
  if (result.status === 401 || result.status === 403) {
    return result.error || "Playback controls need an authorized profile. Open your profile and try again.";
  }
  return result.error || "Playback controls could not connect to this home. Please try again.";
}
