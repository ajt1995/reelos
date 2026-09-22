const TICKS_PER_SECOND = 10_000_000;
const AUTH_BEARER_KEY = "grok-auth.bearer-token";

export interface CompanionCharacter {
  name: string;
  actor: string;
  role: string;
  avatar?: string | null;
}

export interface CompanionDossier {
  available: boolean;
  message?: string | null;
  title: string;
  season?: number;
  episode?: number;
  currentMinute?: number;
  storySoFar: string[];
  whoIsWho: CompanionCharacter[];
  whyAreTheyHere?: string | null;
  whisperNotes: string[];
  spoilerShield: {
    active: boolean;
    safeThroughSeason: number;
    safeThroughEpisode: number;
    futureLoreBlocked: boolean;
  };
}

export interface CompanionSession {
  active: boolean;
  sessionId: string;
  client?: string;
  device?: string;
  titleId?: string;
  titleName?: string;
  seriesName?: string | null;
  seasonNumber?: number;
  episodeNumber?: number;
  positionTicks: number;
  durationTicks: number;
  isPaused: boolean;
  lastUpdated?: number;
}

export interface ActiveCompanionState {
  active: boolean;
  session: CompanionSession | null;
  dossier: CompanionDossier | null;
}

type CompanionFetch = typeof fetch;

function authenticatedHeaders(extra?: HeadersInit) {
  const headers = new Headers(extra);
  let bearer: string | null = null;
  if (typeof window !== "undefined") {
    try { bearer = window.sessionStorage.getItem(AUTH_BEARER_KEY); } catch { /* cookie auth remains available */ }
  }
  if (bearer) headers.set("Authorization", `Bearer ${bearer}`);
  return headers;
}

function finiteNonNegative(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function parseSession(value: unknown): CompanionSession | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.active !== true || typeof raw.sessionId !== "string") return null;
  return {
    active: true,
    sessionId: raw.sessionId,
    client: typeof raw.client === "string" ? raw.client : undefined,
    device: typeof raw.device === "string" ? raw.device : undefined,
    titleId: typeof raw.titleId === "string" ? raw.titleId : undefined,
    titleName: typeof raw.titleName === "string" ? raw.titleName : undefined,
    seriesName: typeof raw.seriesName === "string" ? raw.seriesName : null,
    seasonNumber: finiteNonNegative(raw.seasonNumber) || undefined,
    episodeNumber: finiteNonNegative(raw.episodeNumber) || undefined,
    positionTicks: finiteNonNegative(raw.positionTicks),
    durationTicks: finiteNonNegative(raw.durationTicks),
    isPaused: raw.isPaused === true,
    lastUpdated: finiteNonNegative(raw.lastUpdated) || undefined,
  };
}

function parseDossier(value: unknown): CompanionDossier | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.title !== "string") return null;
  const shield = raw.spoilerShield && typeof raw.spoilerShield === "object"
    ? raw.spoilerShield as Record<string, unknown>
    : {};
  return {
    available: raw.available === true,
    message: typeof raw.message === "string" ? raw.message : null,
    title: raw.title,
    season: finiteNonNegative(raw.season) || undefined,
    episode: finiteNonNegative(raw.episode) || undefined,
    currentMinute: finiteNonNegative(raw.currentMinute),
    storySoFar: Array.isArray(raw.storySoFar)
      ? raw.storySoFar.filter((item): item is string => typeof item === "string")
      : [],
    whoIsWho: Array.isArray(raw.whoIsWho)
      ? raw.whoIsWho.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const character = item as Record<string, unknown>;
          if (typeof character.name !== "string" || typeof character.actor !== "string" || typeof character.role !== "string") return [];
          return [{
            name: character.name,
            actor: character.actor,
            role: character.role,
            avatar: typeof character.avatar === "string" ? character.avatar : null,
          }];
        })
      : [],
    whyAreTheyHere: typeof raw.whyAreTheyHere === "string" ? raw.whyAreTheyHere : null,
    whisperNotes: Array.isArray(raw.whisperNotes)
      ? raw.whisperNotes.filter((item): item is string => typeof item === "string")
      : [],
    spoilerShield: {
      active: shield.active === true,
      safeThroughSeason: finiteNonNegative(shield.safeThroughSeason),
      safeThroughEpisode: finiteNonNegative(shield.safeThroughEpisode),
      futureLoreBlocked: shield.futureLoreBlocked === true,
    },
  };
}

export function companionProgress(session: CompanionSession | null) {
  if (!session) return { positionSeconds: 0, durationSeconds: 0, remainingMinutes: null };
  const positionSeconds = Math.floor(session.positionTicks / TICKS_PER_SECOND);
  const durationSeconds = Math.floor(session.durationTicks / TICKS_PER_SECOND);
  return {
    positionSeconds,
    durationSeconds,
    remainingMinutes: durationSeconds > 0
      ? Math.max(0, Math.ceil((durationSeconds - positionSeconds) / 60))
      : null,
  };
}

export async function loadActiveCompanionState(
  signal?: AbortSignal,
  fetchImpl: CompanionFetch = fetch,
): Promise<ActiveCompanionState> {
  const response = await fetchImpl("/api/companion/active", {
    cache: "no-store",
    credentials: "same-origin",
    headers: authenticatedHeaders(),
    signal,
  });
  if (!response.ok) throw new Error(response.status === 401 ? "Open a profile to use Companion." : "Companion could not reach the player.");
  const payload = await response.json() as Record<string, unknown>;
  if (payload.ok !== true) throw new Error("Companion could not verify the player.");
  const session = parseSession(payload.session);
  return {
    active: payload.active === true && Boolean(session),
    session,
    dossier: parseDossier(payload.dossier),
  };
}

export async function loadCompanionDossier(
  id: string,
  season?: number,
  episode?: number,
  signal?: AbortSignal,
  fetchImpl: CompanionFetch = fetch,
): Promise<CompanionDossier | null> {
  const query = new URLSearchParams();
  if (season) query.set("season", String(season));
  if (episode) query.set("episode", String(episode));
  const response = await fetchImpl(`/api/companion/${encodeURIComponent(id)}${query.size ? `?${query}` : ""}`, {
    cache: "no-store",
    credentials: "same-origin",
    headers: authenticatedHeaders(),
    signal,
  });
  if (!response.ok) throw new Error(response.status === 401 ? "Open a profile to use Companion." : "Companion context is unavailable.");
  const payload = await response.json() as Record<string, unknown>;
  return payload.ok === true ? parseDossier(payload.dossier) : null;
}

export type CompanionRemoteAction = "play" | "pause" | "seek";

export async function queueCompanionCommand(
  sessionId: string,
  action: CompanionRemoteAction,
  payload: Record<string, number> = {},
  fetchImpl: CompanionFetch = fetch,
) {
  const response = await fetchImpl("/api/companion/remote", {
    method: "POST",
    credentials: "same-origin",
    headers: authenticatedHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ sessionId, action, payload }),
  });
  if (!response.ok) throw new Error(response.status === 409 ? "That playback session has ended." : "The TV did not accept that command.");
  const result = await response.json() as { ok?: boolean; command?: { id?: string } };
  if (result.ok !== true || !result.command?.id) throw new Error("The TV did not accept that command.");
  return result.command.id;
}

export const companionSeekTicks = (seconds: number) => Math.trunc(seconds * TICKS_PER_SECOND);
