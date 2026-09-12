/**
 * Honest Apply splash progress. Percent is only bytes of real work
 * (tarball download / extract). Stages without bytes are "N of M + last
 * heartbeat". Never invent a climbing fake percent.
 */
import { existsSync, readFileSync } from "node:fs";

export const APPLY_STAGE_COUNT = 7;
export const DOWNLOAD_STALL_MS = 120_000;

export const APPLY_STAGES = [
  { id: "download", index: 1, label: "Downloading update" },
  { id: "extract", index: 2, label: "Extracting" },
  { id: "probe", index: 3, label: "Probing this computer" },
  { id: "cleaner", index: 4, label: "Cleaning leftover builds" },
  { id: "health", index: 5, label: "Checking health" },
  { id: "door", index: 6, label: "Restarting the door" },
  { id: "images", index: 7, label: "Pulling images" },
];

const STAGE_BY_ID = new Map(APPLY_STAGES.map((s) => [s.id, s]));

export function reelosStateDir(env = process.env) {
  return String(env.REELOS_STATE || "/var/lib/reelos").replace(/\/$/, "") || "/var/lib/reelos";
}

export function applyProgressPath(env = process.env) {
  return `${reelosStateDir(env)}/apply-progress.json`;
}

export function idleApplyProgress() {
  return {
    status: "idle",
    stage: "",
    stageIndex: 0,
    stageCount: APPLY_STAGE_COUNT,
    label: "",
    detail: "",
    bytesGot: 0,
    bytesTotal: 0,
    percent: null,
    percentKind: null,
    heartbeatAt: 0,
    startedAt: 0,
    stageStartedAt: 0,
    stalled: false,
    heartbeatAgo: "",
    message: "",
  };
}

export function stageMeta(id) {
  return STAGE_BY_ID.get(String(id || "")) || null;
}

export function formatHeartbeatAgo(ms, now = Date.now()) {
  const at = Number(ms) || 0;
  if (!at) return "";
  const sec = Math.max(0, Math.floor((Number(now) - at) / 1000));
  if (sec < 1) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  return `${min}m ago`;
}

export function formatBytes(n) {
  const v = Number(n) || 0;
  if (v < 1024) return `${Math.max(0, Math.round(v))} B`;
  if (v < 1024 * 1024) return `${Math.round(v / 1024)} KB`;
  if (v < 1024 * 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(1)} MB`;
  return `${(v / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Byte percent of this stage only. Null when total is unknown. Never time-based. */
export function bytePercent(got, total) {
  const g = Number(got);
  const t = Number(total);
  if (!Number.isFinite(g) || !Number.isFinite(t) || t <= 0 || g < 0) return null;
  return Math.max(0, Math.min(100, Math.round((g / t) * 100)));
}

export function honestApplyProgress(raw, { now = Date.now(), running = true } = {}) {
  const idle = idleApplyProgress();
  if (!running) {
    if (raw && String(raw.status || "") === "done") {
      return {
        ...idle,
        status: "done",
        stage: "done",
        stageIndex: APPLY_STAGE_COUNT,
        stageCount: APPLY_STAGE_COUNT,
        label: "Done",
        heartbeatAt: Number(raw.heartbeatAt) || 0,
        startedAt: Number(raw.startedAt) || 0,
        percent: 100,
        percentKind: "bytes",
        message: "Done",
      };
    }
    return idle;
  }
  const doc = raw && typeof raw === "object" ? raw : {};
  const meta = stageMeta(doc.stage) || APPLY_STAGES[0];
  const stageIndex = Number(doc.stageIndex) > 0 ? Number(doc.stageIndex) : meta.index;
  const stageCount = Number(doc.stageCount) > 0 ? Number(doc.stageCount) : APPLY_STAGE_COUNT;
  const label = String(doc.label || meta.label || "Updating ReelOS");
  const detail = String(doc.detail || "");
  const bytesGot = Math.max(0, Number(doc.bytesGot) || 0);
  const bytesTotal = Math.max(0, Number(doc.bytesTotal) || 0);
  const heartbeatAt = Number(doc.heartbeatAt) || Number(doc.stageStartedAt) || Number(doc.startedAt) || 0;
  const startedAt = Number(doc.startedAt) || heartbeatAt;
  const stageStartedAt = Number(doc.stageStartedAt) || startedAt;
  const percent = bytePercent(bytesGot, bytesTotal);
  const stalled =
    meta.id === "download" &&
    bytesGot <= 0 &&
    stageStartedAt > 0 &&
    now - stageStartedAt >= DOWNLOAD_STALL_MS;
  const ago = formatHeartbeatAgo(heartbeatAt, now);
  let message;
  if (stalled) {
    message = "Download stalled — 0 bytes for 2+ minutes";
  } else if (percent != null) {
    message = `${label} · ${percent}%`;
  } else if (bytesGot > 0) {
    message = `${label} · ${formatBytes(bytesGot)}${ago ? ` · ${ago}` : ""}`;
  } else {
    const head = detail || label;
    message = `${head} · ${stageIndex}/${stageCount}${ago ? ` · ${ago}` : ""}`;
  }
  return {
    status: stalled ? "stalled" : String(doc.status || "running") || "running",
    stage: meta.id,
    stageIndex,
    stageCount,
    label,
    detail,
    bytesGot,
    bytesTotal,
    percent,
    percentKind: percent != null ? "bytes" : null,
    heartbeatAt,
    startedAt,
    stageStartedAt,
    stalled,
    heartbeatAgo: ago,
    message,
  };
}

export function parseApplyProgress(text, opts = {}) {
  try {
    const doc = JSON.parse(String(text || "{}"));
    if (!doc || typeof doc !== "object") return honestApplyProgress({}, opts);
    return honestApplyProgress(doc, opts);
  } catch {
    return honestApplyProgress({}, opts);
  }
}

export function readApplyProgress({
  path,
  env = process.env,
  now = Date.now(),
  running = true,
  readFile = readFileSync,
} = {}) {
  const file = path || applyProgressPath(env);
  try {
    if (!existsSync(file)) return honestApplyProgress({}, { now, running });
    return parseApplyProgress(readFile(file, "utf8"), { now, running });
  } catch {
    return honestApplyProgress({}, { now, running });
  }
}
