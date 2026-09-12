/** Phone-visible episode status. Keep in lockstep with scripts/reelos-episodes.mjs. */

export const EPISODE_STATUSES = ["in-library", "downloading", "requested", "missing"] as const;
export type EpisodeStatus = (typeof EPISODE_STATUSES)[number];

export const EPISODE_STATUS_LABEL: Record<EpisodeStatus, string> = {
  "in-library": "In library",
  downloading: "Downloading",
  requested: "Requested",
  missing: "Missing",
};

export function classifyEpisodeStatus(facts: {
  hasFile?: boolean;
  inJellyfin?: boolean;
  inQueue?: boolean;
  requested?: boolean;
}): EpisodeStatus {
  if (facts.hasFile || facts.inJellyfin) return "in-library";
  if (facts.inQueue) return "downloading";
  if (facts.requested) return "requested";
  return "missing";
}

/** Missing always. After Remove, a still-listed Requested row is one tap, not a hunt. */
export function episodeRequestAction(status: EpisodeStatus, removedHere = false): "Request" | "Request again" | null {
  if (status === "missing") return "Request";
  if (status === "requested" && removedHere) return "Request again";
  return null;
}

export type SeasonEpisodeRow = {
  episodeNumber: number;
  title: string;
  status: EpisodeStatus;
  label: string;
};
