import type { TasteItem } from "./experience-catalog.ts";
import type { Reaction } from "./experience-state.ts";

export interface TasteFieldSignals {
  reactions: Record<string, Reaction>;
  dismissedIds: string[];
  lessLikeIds: string[];
}

const usefulWords = (value: string) =>
  new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2),
  );

const stableHash = (value: string) => {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/** A normal tap progresses from no opinion to Like, then from Like to Love. */
export function nextTasteReaction(reaction?: Reaction): "like" | "love" {
  return reaction === "like" ? "love" : reaction === "love" ? "love" : "like";
}

/**
 * Builds one viewport of an endless field. It is deliberately deterministic so
 * reloads feel continuous, while the cycle advances whenever a bubble leaves.
 */
export function tasteFieldViewport(
  items: TasteItem[],
  signals: TasteFieldSignals,
  departedIds: string[],
  cycle: number,
  limit = 15,
) {
  const dismissed = new Set(signals.dismissedIds);
  const departed = new Set(departedIds);
  const lessLike = new Set(signals.lessLikeIds);
  const byId = new Map(items.map((item) => [item.id, item]));
  const positive = Object.entries(signals.reactions).flatMap(([id, reaction]) => {
    const item = byId.get(id);
    return item ? [{ item, reaction }] : [];
  });

  const scored = items
    .filter((item) => !dismissed.has(item.id) && !departed.has(item.id))
    .map((item) => {
      const words = usefulWords(`${item.title} ${item.subtitle}`);
      let affinity = 0;
      for (const signal of positive) {
        const signalWords = usefulWords(`${signal.item.title} ${signal.item.subtitle}`);
        let overlap = 0;
        for (const word of words) if (signalWords.has(word)) overlap += 1;
        const weight = signal.reaction === "love" ? 7 : signal.reaction === "cozy" ? 5 : 3;
        affinity += overlap * weight + (signal.item.kind === item.kind ? weight / 3 : 0);
      }
      if (lessLike.has(item.id)) affinity -= 100;
      if (signals.reactions[item.id]) affinity -= 12;
      const variety = ((stableHash(item.id) + cycle * 2654435761) >>> 0) / 2 ** 32;
      return { item, score: affinity + variety * 2 };
    })
    .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id));

  // Preserve variety: seed one person and one mood when the catalog can supply
  // them, then let learned affinity fill the rest.
  const chosen: TasteItem[] = [];
  for (const kind of ["person", "mood"] as const) {
    const match = scored.find(({ item }) => item.kind === kind);
    if (match) chosen.push(match.item);
  }
  for (const { item } of scored) {
    if (chosen.some((candidate) => candidate.id === item.id)) continue;
    chosen.push(item);
    if (chosen.length >= limit) break;
  }
  return chosen.slice(0, limit);
}
