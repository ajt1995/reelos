/** Phone-visible episode status. Keep in lockstep with scripts/reelos-episodes.mjs. */

export const EPISODE_STATUSES = ["in-library", "importing", "downloading", "requested", "missing"] as const;
export type EpisodeStatus = (typeof EPISODE_STATUSES)[number];

export const EPISODE_STATUS_LABEL: Record<EpisodeStatus, string> = {
  "in-library": "In library",
  importing: "On disk, importing",
  downloading: "Downloading",
  requested: "Requested",
  missing: "Missing",
};

export function classifyEpisodeStatus(facts: {
  hasFile?: boolean;
  inJellyfin?: boolean;
  inQueue?: boolean;
  requested?: boolean;
  importing?: boolean;
}): EpisodeStatus {
  if (facts.hasFile) return "in-library";
  if (facts.importing) return "importing";
  if (facts.inJellyfin) return "in-library";
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

export const UNRELEASED_SEASON_COPY = "Announced — not released yet";
export const UNRELEASED_SEASON_CHIP = "Coming";
export const IMPORTING_SEASON_CHIP = "Importing";
export const IMPORTING_SEASON_COPY = "On disk, importing";

export function isImportingReason(reason?: string | null): boolean {
  return /on disk, importing|files linked|waiting for.*import/i.test(String(reason || ""));
}

export function seasonChipKind(
  opts: { onDisk?: boolean; importing?: boolean; unreleased?: boolean; removedHere?: boolean } = {},
): "watch" | "importing" | "coming" | "request" {
  if (opts.onDisk && !opts.removedHere) return "watch";
  if (opts.unreleased) return "coming";
  if (opts.importing && !opts.removedHere) return "importing";
  return "request";
}

export function seasonChipLabel(
  opts: { onDisk?: boolean; importing?: boolean; unreleased?: boolean; removedHere?: boolean } = {},
): "Watch" | "Importing" | "Coming" | "Request" {
  const kind = seasonChipKind(opts);
  if (kind === "watch") return "Watch";
  if (kind === "importing") return IMPORTING_SEASON_CHIP;
  if (kind === "coming") return UNRELEASED_SEASON_CHIP;
  return "Request";
}

/** Accordion "Request this season" follows the chip — not whether episode rows already say Requested. */
export function seasonShowsRequestButton(
  opts: {
    blocked?: boolean;
    onDisk?: boolean;
    importing?: boolean;
    unreleased?: boolean;
    removedHere?: boolean;
    open?: boolean;
    loading?: boolean;
  } = {},
): boolean {
  if (opts.blocked || !opts.open || opts.loading) return false;
  return seasonChipKind(opts) === "request";
}

/** Fixture: announced, episodeCount 0, airDate future → Coming, not Request/Watch. */
export function seasonIsUnreleasedFact(
  fact: {
    episodeCount?: number;
    airDate?: string;
    unreleased?: boolean;
    onDisk?: boolean;
  } | null | undefined,
  now = Date.now(),
): boolean {
  if (!fact || fact.onDisk) return false;
  if (fact.unreleased === true) return true;
  if (fact.unreleased === false) return false;
  const count = Number(fact.episodeCount);
  const air = Date.parse(String(fact.airDate || ""));
  if (Number.isFinite(count) && count === 0) return true;
  if (Number.isFinite(air) && air > now) return true;
  return false;
}

export type SeasonEpisodeRow = {
  episodeNumber: number;
  title: string;
  status: EpisodeStatus;
  label: string;
};
