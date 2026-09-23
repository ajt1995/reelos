export type ConciergeIntent =
  | "onboarding"
  | "personal-media"
  | "provider"
  | "source-setup"
  | "unavailable-title"
  | "general";

export type ConciergeCapability = {
  mode: "deterministic" | "local-model" | "unavailable";
  eligible: boolean;
  reason: string;
};

const REDACTED_KEY = /(?:api[_ -]?key|token|secret|password|torbox|debrid)/i;

export function sanitizeConciergeContext(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeConciergeContext);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !REDACTED_KEY.test(key))
      .map(([key, item]) => [key, sanitizeConciergeContext(item)]),
  );
}

export function inferConciergeIntent(value: string): ConciergeIntent {
  const text = value.toLowerCase();
  if (/\b(set ?up|start|onboard|first time|name)\b/.test(text)) return "onboarding";
  if (/\b(import|folder|file|personal media|my media)\b/.test(text)) return "personal-media";
  if (/\b(torbox|real.?debrid|provider|key)\b/.test(text)) return "provider";
  if (/\b(indexer|torznab|newznab|rss|source link)\b/.test(text)) return "source-setup";
  if (/\b(unavailable|cant play|can't play|not available|why)\b/.test(text)) return "unavailable-title";
  return "general";
}

export function conciergeCapability({ totalMemoryMb, freeMemoryMb, modelInstalled = false }: { totalMemoryMb: number; freeMemoryMb: number; modelInstalled?: boolean }): ConciergeCapability {
  const eligible = totalMemoryMb >= 12 * 1024 && freeMemoryMb >= 6 * 1024;
  if (eligible && modelInstalled) return { mode: "local-model", eligible: true, reason: "Local private help is ready." };
  if (eligible) return { mode: "deterministic", eligible: true, reason: "Guided concierge help is ready; conversational dialogue assistant is optional." };
  return { mode: "deterministic", eligible: false, reason: "Guided concierge help stays available offline on this machine." };
}

export function conciergeGuidance(intent: ConciergeIntent) {
  return {
    onboarding: "Start with the people in this home, a favorite color, then a few titles or actors. You can always tune taste later.",
    "personal-media": "Bring in media you already own from the owner settings. ReelOS keeps imported files separate from provider-only availability.",
    provider: "A provider is optional. Public-domain and personal media still work when it is off. Connect one only from owner settings and validate it before it appears available.",
    "source-setup": "Source connections are owner-only. Review the link privately, then confirm before anything is saved or contacted.",
    "unavailable-title": "A title can help ReelOS understand taste without being playable here. Search can show wider catalog context, while Home and No idea stay inside what this home can access.",
    general: "I can help with setup, personal media, providers, source setup, or why a title is unavailable."
  }[intent];
}
