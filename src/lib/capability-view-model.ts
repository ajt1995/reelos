export type CapabilityState =
  | "installed"
  | "validating"
  | "learning_locally"
  | "ready"
  | "active"
  | "paused"
  | "unsupported"
  | "needs_attention"
  | "disabled"
  | "quarantined"
  | "rolled_back";

export type CapabilityRecord = {
  id: string;
  state: CapabilityState;
  reason?: string;
  scope?: "person" | "home" | "device" | string;
  updatedAt?: number;
};

export type CapabilityResponse = {
  ok: boolean;
  capabilities: CapabilityRecord[];
  resources?: unknown;
  models?: unknown[];
};

export type CapabilityInfluence = "built_in_rules" | "evaluation_only" | "not_connected";

type CapabilityInfluenceCopy = {
  state: CapabilityInfluence;
  label: string;
  explanation: string;
};

type CapabilityCopy = { name: string; short: string; detail: string };

const COPY: Record<string, CapabilityCopy> = {
  "taste-ranking": {
    name: "Your taste",
    short: "Learns what feels right for you.",
    detail: "Connects your reactions, favorites, and viewing choices without mixing your private history with anyone else’s.",
  },
  "semantic-search": {
    name: "Natural search",
    short: "Understands ideas, feelings, and half-remembered scenes.",
    detail: "Helps ReelOS understand searches such as “that rainy movie with the train” without requiring exact titles.",
  },
  "scene-understanding": {
    name: "Scene awareness",
    short: "Evaluates private, spoiler-safe scene context.",
    detail: "This is still being evaluated with edition-matched, spoiler-safe evidence. It cannot yet add inferred scene details to recaps, cast help, or story answers.",
  },
  "family-scene-guidance": {
    name: "Family guidance",
    short: "Evaluates scene-by-scene family context.",
    detail: "This is still being evaluated locally and cannot relax or replace a parent’s rules. Current family protection uses the household’s saved boundaries.",
  },
  "dialogue-enhancement": {
    name: "Clearer dialogue",
    short: "Evaluates private audio improvements for difficult mixes.",
    detail: "This is not connected to playback yet. Original audio, available tracks, subtitles, and current listening controls remain in use.",
  },
  "predictive-preparation": {
    name: "Ready when you are",
    short: "Anticipates what this home may watch next.",
    detail: "Helps prepare the right version ahead of time, within your source access and storage choices, so playback can start with less waiting.",
  },
  "storage-optimization": {
    name: "Thoughtful storage",
    short: "Keeps the most useful versions without filling the drive.",
    detail: "Learns this home’s viewing and device patterns to suggest what to retain, resize, or safely release. ReelOS rules still approve every change.",
  },
  "machine-protection": {
    name: "Machine care",
    short: "Yields before background work gets in your way.",
    detail: "Watches memory, storage, heat, and playback pressure so optional work can slow down or stop before the experience suffers.",
  },
  "interface-protection": {
    name: "A calmer interface",
    short: "Adapts presentation without moving the ground beneath you.",
    detail: "Learns comfortable density and motion preferences while preserving predictable navigation, focus, and accessibility settings.",
  },
  "shared-taste-intelligence": {
    name: "Broader discoveries",
    short: "Evaluates privacy-safe discovery beyond this home.",
    detail: "Cross-home sharing is blocked while privacy checks are unfinished. Taste, history, profiles, model files, and raw reactions stay inside this home.",
  },
  "release-ranking": {
    name: "Best version",
    short: "Chooses the most suitable available edition for each screen.",
    detail: "Balances quality, compatibility, connection, and storage so ReelOS can select among versions you can actually access.",
  },
};

const STATUS: Record<CapabilityState, { label: string; explanation: string; tone: string }> = {
  installed: {
    label: "Installed · not checked",
    explanation: "Present on this home, but it has not passed its first local check and cannot influence the experience.",
    tone: "border-white/12 bg-white/5 text-foreground/80",
  },
  validating: {
    label: "Checking locally",
    explanation: "A local check is in progress. It cannot influence the experience unless that check passes.",
    tone: "border-sky-300/20 bg-sky-300/8 text-sky-200",
  },
  learning_locally: {
    label: "Learning · not in use",
    explanation: "Learning privately inside this home, but not making or changing live decisions.",
    tone: "border-violet-300/20 bg-violet-300/8 text-violet-200",
  },
  ready: {
    label: "Ready · not active",
    explanation: "Its local checks passed, but it is not currently influencing the experience.",
    tone: "border-emerald-300/20 bg-emerald-300/8 text-emerald-200",
  },
  active: {
    label: "Active",
    explanation: "Working quietly in the background with ReelOS safety rules still in control.",
    tone: "border-gold/25 bg-gold/10 text-gold",
  },
  paused: {
    label: "Paused",
    explanation: "Temporarily yielding to watching or to the needs of this device.",
    tone: "border-amber-300/20 bg-amber-300/8 text-amber-200",
  },
  unsupported: {
    label: "Not supported here",
    explanation: "This device cannot run it safely right now. The rest of ReelOS continues without it.",
    tone: "border-white/12 bg-white/5 text-muted",
  },
  needs_attention: {
    label: "Needs attention",
    explanation: "A check failed, so ReelOS stopped it instead of guessing.",
    tone: "border-danger/25 bg-danger/8 text-danger",
  },
  disabled: {
    label: "Off",
    explanation: "Turned off for this home. Its deterministic ReelOS fallback remains available.",
    tone: "border-white/10 bg-black/15 text-muted",
  },
  quarantined: {
    label: "Blocked for safety",
    explanation: "Isolated after a safety or integrity check. It cannot influence the experience.",
    tone: "border-danger/25 bg-danger/8 text-danger",
  },
  rolled_back: {
    label: "Previous version restored",
    explanation: "The latest version was withdrawn. Only the last validated behavior may be used.",
    tone: "border-amber-300/20 bg-amber-300/8 text-amber-200",
  },
};

export function capabilityCopy(id: string): CapabilityCopy {
  if (COPY[id]) return COPY[id];
  const name = id
    .split(/[-_.:]+/g)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
  return {
    name: name || "ReelOS capability",
    short: "An optional ability running privately in this home.",
    detail: "ReelOS keeps this ability behind the same validation, privacy, and resource protections as every other capability.",
  };
}

export function capabilityStatus(state: CapabilityState) {
  return STATUS[state] ?? STATUS.needs_attention;
}

export function capabilityAction(state: CapabilityState): "disable" | "revalidate" | null {
  if (state === "active" || state === "validating" || state === "learning_locally") return "disable";
  if (
    state === "installed" || state === "ready" || state === "paused" || state === "unsupported"
    || state === "needs_attention" || state === "disabled" || state === "quarantined" || state === "rolled_back"
  ) {
    return "revalidate";
  }
  return null;
}

const INFLUENCE: Record<string, CapabilityInfluenceCopy> = {
  "taste-ranking": builtInRules(),
  "semantic-search": builtInRules(),
  "predictive-preparation": builtInRules(),
  "storage-optimization": builtInRules(),
  "machine-protection": builtInRules(),
  "interface-protection": builtInRules(),
  "release-ranking": builtInRules(),
  "scene-understanding": evaluationOnly(),
  "family-scene-guidance": evaluationOnly(),
  "dialogue-enhancement": evaluationOnly(),
  "shared-taste-intelligence": evaluationOnly(),
};

function builtInRules(): CapabilityInfluenceCopy {
  return {
    state: "built_in_rules",
    label: "Built-in rules in control",
    explanation: "ReelOS uses its dependable built-in behavior for live decisions. Private learning may compare suggestions, but it does not overrule those safeguards.",
  };
}

function evaluationOnly(): CapabilityInfluenceCopy {
  return {
    state: "evaluation_only",
    label: "Evaluation only",
    explanation: "This ability is not connected to user-visible decisions. ReelOS continues with its built-in behavior while local checks continue.",
  };
}

export function capabilityInfluence(id: string): CapabilityInfluenceCopy {
  return INFLUENCE[id] ?? {
    state: "not_connected",
    label: "Not connected",
    explanation: "ReelOS has not verified how this ability participates in the experience, so it cannot influence live decisions.",
  };
}

export function capabilityProgress(capabilities: CapabilityRecord[]) {
  const active = capabilities.filter((item) => item.state === "active").length;
  const checking = capabilities.filter((item) =>
    ["installed", "validating", "learning_locally"].includes(item.state),
  ).length;
  const inactive = capabilities.length - active - checking;
  return { active, checking, inactive };
}
