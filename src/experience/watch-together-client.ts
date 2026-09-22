import type { ExperienceTitle } from "./experience-catalog";
import type { ExperienceProfile, Reaction } from "./experience-state";

export interface PartyParticipant {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  joinedAt: number;
}

export interface PartyRoom {
  code: string;
  titleId: string;
  title: string;
  hostId: string;
  participants: PartyParticipant[];
}

const reactionWeight: Record<Reaction, number> = {
  like: 2,
  love: 4,
  cozy: 3,
};

export function normalizeInviteCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function inviteCodeFromLocation(search: string) {
  const raw = new URLSearchParams(search).get("code") || "";
  return normalizeInviteCode(raw);
}

export function parsePartyRoom(value: unknown): PartyRoom | null {
  if (!value || typeof value !== "object") return null;
  const room = value as Record<string, unknown>;
  const code = normalizeInviteCode(String(room.code || ""));
  if (code.length !== 6 || !room.titleId || !room.title || !room.hostId) return null;
  const participants = Array.isArray(room.participants)
    ? room.participants
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .filter((item) => item.id && item.name)
        .map((item) => ({
          id: String(item.id),
          name: String(item.name),
          isHost: Boolean(item.isHost),
          connected: Boolean(item.connected),
          joinedAt: Number(item.joinedAt) || 0,
        }))
    : [];
  return {
    code,
    titleId: String(room.titleId),
    title: String(room.title),
    hostId: String(room.hostId),
    participants,
  };
}

/**
 * A deterministic, local-only household compromise. It rewards direct
 * enthusiasm while treating "less like this" as an objection instead of
 * averaging one person's strong dislike away.
 */
export function householdConsensus(
  titles: ExperienceTitle[],
  profiles: ExperienceProfile[],
) {
  if (!profiles.length) return titles;
  return titles
    .map((title, index) => {
      const scores = profiles.map((profile) => {
        if (profile.lessLikeIds.includes(title.id)) return -100;
        const reaction = profile.reactions[title.id];
        if (reaction) return reactionWeight[reaction];
        return 0;
      });
      return {
        title,
        score: Math.min(...scores) + scores.reduce((sum, score) => sum + score, 0) / scores.length,
        index,
      };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ title }) => title);
}
