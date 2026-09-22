export type FamilyTreatmentInterval = {
  startTicks: number;
  endTicks: number;
  action: string;
  replacement?: string;
};

export type FamilyTreatmentManifest = {
  schema: "reelos.family-treatment/v1";
  media: { itemId: string; mediaSourceId: string; editionFingerprint: string };
  timebase: { ticksPerSecond: 10_000_000; durationTicks: number };
  verification: { status: "verified"; verifiedAt: number; evidenceId: string };
  intervals: {
    visual: FamilyTreatmentInterval[];
    audio: FamilyTreatmentInterval[];
    subtitle: FamilyTreatmentInterval[];
  };
};

export type FamilyTreatmentFrame = {
  skipToSeconds: number | null;
  hideVisual: boolean;
  muteAudio: boolean;
  hideSubtitles: boolean;
  subtitleReplacement: string | null;
};

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));

export function parseFamilyTreatmentManifest(value: unknown): FamilyTreatmentManifest | null {
  if (!record(value) || value.schema !== "reelos.family-treatment/v1" || !record(value.media)
    || !record(value.timebase) || !record(value.verification) || !record(value.intervals)
    || value.verification.status !== "verified" || value.timebase.ticksPerSecond !== 10_000_000
    || !Number.isSafeInteger(value.timebase.durationTicks) || Number(value.timebase.durationTicks) <= 0
    || !Number.isSafeInteger(value.verification.verifiedAt) || Number(value.verification.verifiedAt) <= 0
    || typeof value.verification.evidenceId !== "string" || !value.verification.evidenceId.trim()) return null;
  const media = value.media;
  const timebase = value.timebase;
  const intervals = value.intervals;
  if (![media.itemId, media.mediaSourceId, media.editionFingerprint].every((field) => typeof field === "string" && field.length > 0)) return null;
  const parseIntervals = (kind: "visual" | "audio" | "subtitle", actions: string[]) => {
    const raw = intervals[kind];
    if (!Array.isArray(raw)) return null;
    let priorEnd = 0;
    const parsed: FamilyTreatmentInterval[] = [];
    for (const entry of raw) {
      if (!record(entry) || !actions.includes(String(entry.action))
        || !Number.isSafeInteger(entry.startTicks) || !Number.isSafeInteger(entry.endTicks)
        || Number(entry.startTicks) < priorEnd || Number(entry.endTicks) <= Number(entry.startTicks)
        || Number(entry.endTicks) > Number(timebase.durationTicks)) return null;
      if (kind === "subtitle" && entry.action === "replace" && (typeof entry.replacement !== "string" || !entry.replacement.trim())) return null;
      parsed.push({ startTicks: Number(entry.startTicks), endTicks: Number(entry.endTicks), action: String(entry.action),
        ...(typeof entry.replacement === "string" ? { replacement: entry.replacement } : {}) });
      priorEnd = Number(entry.endTicks);
    }
    return parsed;
  };
  const visual = parseIntervals("visual", ["skip", "hide"]);
  const audio = parseIntervals("audio", ["mute", "soften"]);
  const subtitle = parseIntervals("subtitle", ["hide", "replace"]);
  if (!visual || !audio || !subtitle) return null;
  return value as FamilyTreatmentManifest;
}

function active(intervals: FamilyTreatmentInterval[], ticks: number) {
  return intervals.find((interval) => ticks >= interval.startTicks && ticks < interval.endTicks) ?? null;
}

export function familyTreatmentFrame(manifest: FamilyTreatmentManifest | null, currentSeconds: number): FamilyTreatmentFrame {
  const empty = { skipToSeconds: null, hideVisual: false, muteAudio: false, hideSubtitles: false, subtitleReplacement: null };
  if (!manifest || !Number.isFinite(currentSeconds) || currentSeconds < 0) return empty;
  const ticks = Math.floor(currentSeconds * manifest.timebase.ticksPerSecond);
  const visual = active(manifest.intervals.visual, ticks);
  const audio = active(manifest.intervals.audio, ticks);
  const subtitle = active(manifest.intervals.subtitle, ticks);
  return {
    skipToSeconds: visual?.action === "skip" ? visual.endTicks / manifest.timebase.ticksPerSecond : null,
    hideVisual: visual?.action === "hide",
    // Softening requires verified replacement audio. The browser executor uses
    // the stricter deterministic mute fallback when no replacement track exists.
    muteAudio: Boolean(audio),
    hideSubtitles: Boolean(subtitle),
    subtitleReplacement: subtitle?.action === "replace" ? subtitle.replacement?.trim() || null : null,
  };
}
