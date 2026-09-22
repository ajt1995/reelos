import type { ExperienceTitle } from "./experience-catalog.ts";
import type {
  ExperienceProfile,
  ExplorationPreference,
  TonightFilters,
} from "./experience-state.ts";

export type DecisionClue =
  | { kind: "none" }
  | { kind: "mood"; value: string; label: string }
  | { kind: "duration"; value: TonightFilters["duration"]; label: string }
  | { kind: "company"; value: "solo" | "together" | "kids"; label: string };

export interface DecisionRequest {
  profile: ExperienceProfile;
  titles: ExperienceTitle[];
  availableIds?: Iterable<string>;
  clue: DecisionClue;
  exploration: ExplorationPreference;
  offset?: number;
}

export interface DecisionPick {
  title: ExperienceTitle;
  reason: string;
}

const MOOD_WORDS: Record<string, string[]> = {
  comfort: ["warm", "comfort", "cozy", "gentle", "familiar", "playful"],
  funny: ["fun", "funny", "comedy", "playful", "sharp"],
  wonder: ["wonder", "beautiful", "transporting", "colorful", "epic"],
  edge: ["tense", "dark", "restless", "urgent", "kinetic"],
  quiet: ["quiet", "patient", "human", "cerebral", "gentle"],
};

function stableNumber(value: string) {
  let number = 0;
  for (const character of value) {
    number = (number * 31 + character.charCodeAt(0)) >>> 0;
  }
  return number;
}

function durationMatches(title: ExperienceTitle, duration: TonightFilters["duration"]) {
  if (duration === "short") return title.minutes <= 100;
  if (duration === "feature") return title.minutes > 100 && title.minutes <= 145;
  if (duration === "long") return title.minutes > 145 || title.kind === "series";
  return true;
}

function sharedTasteWords(profile: ExperienceProfile, title: ExperienceTitle) {
  const titleWords = new Set(
    [...title.genres, ...title.moods].map((word) => word.toLowerCase()),
  );
  const matches = new Set<string>();
  for (const [id, reaction] of Object.entries(profile.reactions)) {
    if (!reaction) continue;
    // The caller's candidates carry all title metadata, so related IDs are
    // resolved by the scoring pass below when they appear in the same pool.
    if (id === title.id) matches.add("itself");
  }
  return { titleWords, matches };
}

function reasonFor(
  title: ExperienceTitle,
  profile: ExperienceProfile,
  clue: DecisionClue,
  exploration: ExplorationPreference,
) {
  if (clue.kind === "duration") {
    return title.kind === "series"
      ? `${title.minutes} minutes gets you through one episode.`
      : `${title.minutes} minutes—inside the time you gave ReelOS.`;
  }
  if (clue.kind === "mood") {
    return `${clue.label}, translated into ${title.genres[0]?.toLowerCase() || "a story"} with ${title.moods[0] || "its own pull"}.`;
  }
  if (clue.kind === "company") {
    if (clue.value === "kids") return "Safe for the whole group, without feeling like a compromise.";
    if (clue.value === "together") return "A strong shared-room choice with enough personality to talk about afterward.";
    return "A choice that can belong entirely to your night.";
  }
  if (exploration === "familiar") {
    return profile.savedIds.includes(title.id) || profile.reactions[title.id]
      ? "Already connected to your taste, so this is the low-risk answer."
      : `Close to the shape of ${profile.name}’s favorites.`;
  }
  if (exploration === "adventurous") {
    return "Outside your usual orbit, but connected enough to be worth the leap.";
  }
  return title.note || `A balanced match for ${profile.name} right now.`;
}

export function buildDecisionPicks({
  profile,
  titles,
  availableIds = [],
  clue,
  exploration,
  offset = 0,
}: DecisionRequest): DecisionPick[] {
  const available = new Set(availableIds);
  const reacted = new Set(Object.keys(profile.reactions));
  const known = new Set([
    ...reacted,
    ...profile.savedIds,
    ...Object.keys(profile.progress),
  ]);
  const moodWords = clue.kind === "mood" ? MOOD_WORDS[clue.value] || [clue.value] : [];

  const moodMatches = (title: ExperienceTitle) =>
    clue.kind !== "mood" ||
    title.moods.some((mood) =>
      moodWords.some((word) => mood.toLowerCase().includes(word)),
    );
  const moodEligible = titles.filter(moodMatches);
  const cluePool = clue.kind === "mood" && moodEligible.length ? moodEligible : titles;
  const eligible = cluePool
    .filter((title) => !profile.lessLikeIds.includes(title.id))
    .filter((title) => clue.kind !== "duration" || durationMatches(title, clue.value))
    .filter(
      (title) =>
        clue.kind !== "company" || clue.value !== "kids" || title.family,
    );
  // A clue is a promise, not a soft suggestion. Return fewer choices when the
  // catalog cannot honestly supply three rather than quietly violating it.
  const pool = eligible;

  const ranked = pool
    .map((title, index) => {
      let score = 100 - Math.min(index, 60);
      const reaction = profile.reactions[title.id];
      if (reaction === "love") score += 36;
      if (reaction === "cozy") score += 28;
      if (reaction === "like") score += 18;
      if (profile.savedIds.includes(title.id)) score += 16;
      if (profile.progress[title.id]) score += 8;
      if (available.has(title.id)) score += 80;
      if (clue.kind === "mood") {
        score += title.moods.filter((mood) =>
          moodWords.some((word) => mood.toLowerCase().includes(word)),
        ).length * 34;
      }
      if (clue.kind === "company" && clue.value === "together" && title.family) score += 8;
      if (exploration === "familiar") score += known.has(title.id) ? 50 : -8;
      if (exploration === "adventurous") score += known.has(title.id) ? -70 : 22;
      const { matches } = sharedTasteWords(profile, title);
      score += matches.size * 5;
      score += stableNumber(`${profile.id}:${title.id}:${offset}`) % 7;
      return { title, score };
    })
    .sort((left, right) => right.score - left.score);

  const chosen: ExperienceTitle[] = [];
  const usedLeadGenres = new Set<string>();
  const rotated = offset > 0
    ? [...ranked.slice(offset % Math.max(ranked.length, 1)), ...ranked.slice(0, offset % Math.max(ranked.length, 1))]
    : ranked;
  for (const { title } of rotated) {
    const leadGenre = title.genres[0]?.toLowerCase() || title.kind;
    if (chosen.length < 2 && usedLeadGenres.has(leadGenre)) continue;
    chosen.push(title);
    usedLeadGenres.add(leadGenre);
    if (chosen.length === 3) break;
  }
  if (chosen.length < 3) {
    for (const { title } of rotated) {
      if (!chosen.some((item) => item.id === title.id)) chosen.push(title);
      if (chosen.length === 3) break;
    }
  }

  return chosen.map((title) => ({
    title,
    reason: reasonFor(title, profile, clue, exploration),
  }));
}
