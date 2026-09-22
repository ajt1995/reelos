import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = "reelos.family-treatment/v1";
const ACTIONS = {
  visual: new Set(["skip", "hide"]),
  audio: new Set(["mute", "soften"]),
  subtitle: new Set(["hide", "replace"]),
};

const cleanId = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(value);
const safeRecord = (value) => value && typeof value === "object" && !Array.isArray(value);

export function localEditionFingerprint(file) {
  const stat = fs.statSync(file, { bigint: true });
  const identity = JSON.stringify({
    realpath: fs.realpathSync(file),
    size: stat.size.toString(),
    modifiedNs: stat.mtimeNs.toString(),
    inode: stat.ino.toString(),
  });
  return `sha256:${createHash("sha256").update(identity).digest("hex")}`;
}

export function remoteEditionFingerprint(item, mediaSourceId) {
  const sources = Array.isArray(item?.MediaSources) ? item.MediaSources : [];
  const source = sources.find((candidate) => String(candidate?.Id || "") === mediaSourceId);
  if (!source) return null;
  const stable = {
    itemId: String(item.Id || item.id || ""),
    mediaSourceId,
    path: source.Path || null,
    size: Number.isSafeInteger(source.Size) ? source.Size : null,
    etag: source.ETag || source.ETagId || null,
    runtimeTicks: Number.isSafeInteger(source.RunTimeTicks) ? source.RunTimeTicks : null,
    container: source.Container || null,
  };
  if (!stable.path && stable.size === null && !stable.etag && stable.runtimeTicks === null) return null;
  return `sha256:${createHash("sha256").update(JSON.stringify(stable)).digest("hex")}`;
}

function validateIntervals(kind, intervals, durationTicks) {
  if (!Array.isArray(intervals)) return null;
  const output = [];
  let priorEnd = 0;
  for (const interval of intervals) {
    if (!safeRecord(interval) || !ACTIONS[kind].has(interval.action)
      || !Number.isSafeInteger(interval.startTicks) || !Number.isSafeInteger(interval.endTicks)
      || interval.startTicks < 0 || interval.endTicks <= interval.startTicks
      || interval.endTicks > durationTicks || interval.startTicks < priorEnd) return null;
    if (kind === "subtitle" && interval.action === "replace"
      && (typeof interval.replacement !== "string" || !interval.replacement.trim() || interval.replacement.length > 500)) return null;
    output.push({
      startTicks: interval.startTicks,
      endTicks: interval.endTicks,
      action: interval.action,
      ...(kind === "subtitle" && interval.action === "replace" ? { replacement: interval.replacement.trim() } : {}),
    });
    priorEnd = interval.endTicks;
  }
  return output;
}

export function validateFamilyTreatmentManifest(raw, expected) {
  if (!safeRecord(raw) || raw.schema !== SCHEMA || !safeRecord(raw.media)
    || !safeRecord(raw.timebase) || !safeRecord(raw.verification)) return null;
  if (!cleanId(raw.media.itemId) || !cleanId(raw.media.mediaSourceId)
    || raw.media.itemId !== expected.itemId || raw.media.mediaSourceId !== expected.mediaSourceId
    || raw.media.editionFingerprint !== expected.editionFingerprint) return null;
  if (raw.verification.status !== "verified" || !Number.isSafeInteger(raw.verification.verifiedAt)
    || raw.verification.verifiedAt <= 0 || typeof raw.verification.evidenceId !== "string"
    || !raw.verification.evidenceId.trim()) return null;
  const durationTicks = raw.timebase.durationTicks;
  if (raw.timebase.ticksPerSecond !== 10_000_000 || !Number.isSafeInteger(durationTicks) || durationTicks <= 0) return null;
  if (expected.durationTicks && Math.abs(durationTicks - expected.durationTicks) > 10_000_000) return null;
  const visual = validateIntervals("visual", raw.intervals?.visual, durationTicks);
  const audio = validateIntervals("audio", raw.intervals?.audio, durationTicks);
  const subtitle = validateIntervals("subtitle", raw.intervals?.subtitle, durationTicks);
  if (!visual || !audio || !subtitle) return null;
  return {
    schema: SCHEMA,
    media: { itemId: raw.media.itemId, mediaSourceId: raw.media.mediaSourceId, editionFingerprint: raw.media.editionFingerprint },
    timebase: { ticksPerSecond: 10_000_000, durationTicks },
    verification: { status: "verified", verifiedAt: raw.verification.verifiedAt, evidenceId: raw.verification.evidenceId },
    intervals: { visual, audio, subtitle },
  };
}

export function loadFamilyTreatmentManifest(expected, { stateDir }) {
  const file = path.join(stateDir, "family-treatments", `${expected.itemId}.json`);
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const manifest = validateFamilyTreatmentManifest(raw, expected);
    return manifest
      ? { ok: true, manifest }
      : { ok: false, code: "family_treatment_unverified", error: "This exact edition does not have a verified family treatment." };
  } catch {
    return { ok: false, code: "family_treatment_unavailable", error: "This exact edition does not have a verified family treatment." };
  }
}
