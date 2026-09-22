import type { CuratorVote } from "./discover-curator.ts";

export interface PrivateCuratorSnapshot {
  profileId: string;
  liked: string[];
  hidden: string[];
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function isIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((id) => typeof id === "string" && id.trim().length > 0);
}

async function readSnapshot(response: Response, expectedProfileId: string, saved: boolean): Promise<PrivateCuratorSnapshot> {
  const message = saved ? "Your taste was not saved. Please try again." : "Your taste could not be loaded. Please retry.";
  const result: unknown = await response.json().catch(() => null);
  if (response.status !== 200 || !result || typeof result !== "object" || Array.isArray(result)) throw new Error(message);
  const payload = result as Record<string, unknown>;
  if (
    payload.ok !== true || !expectedProfileId || payload.profileId !== expectedProfileId ||
    !isIds(payload.liked) || !isIds(payload.hidden) || (saved && payload.persisted !== true)
  ) throw new Error(message);
  return { profileId: expectedProfileId, liked: [...payload.liked], hidden: [...payload.hidden] };
}

/** The expected identity is only checked locally; the server resolves its own session. */
export async function loadPrivateCurator(
  expectedProfileId: string,
  signal?: AbortSignal,
  fetcher: FetchLike = fetch,
): Promise<PrivateCuratorSnapshot> {
  const response = await fetcher("/api/curator", { cache: "no-store", signal });
  return readSnapshot(response, expectedProfileId, false);
}

export async function savePrivateCuratorVote(
  { id, vote, expectedProfileId }: { id: string; vote: CuratorVote; expectedProfileId: string },
  signal?: AbortSignal,
  fetcher: FetchLike = fetch,
): Promise<PrivateCuratorSnapshot> {
  if (!id?.trim() || !expectedProfileId?.trim() || !["like", "dislike", "comfort", "none"].includes(vote)) {
    throw new Error("Your taste was not saved. Please reload your profile and try again.");
  }
  const response = await fetcher("/api/curator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, vote, expectedProfileId }),
    signal,
  });
  return readSnapshot(response, expectedProfileId, true);
}
