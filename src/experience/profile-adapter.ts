import type { ExperienceProfile } from "@/experience/experience-state";

type ProfilesResponse = {
  ok?: boolean;
  profiles?: Array<Record<string, unknown>>;
  activeId?: string;
  auth?: ProfileSession;
  setup?: { status: "not_started" | "in_progress" | "complete"; completedAt: number | null };
};

export type ProfileSession = {
  bootstrapRequired: boolean;
  authenticated: boolean;
  role?: string;
  profileId?: string;
  deviceAuthorized?: boolean;
};

export function profileToServer(
  profile: ExperienceProfile,
  pin?: string | null,
) {
  return {
    ...profile,
    experienceVersion: 2,
    isKids: Boolean(profile.isChild),
    watchlist: profile.savedIds,
    watchProgress: profile.progress,
    ...(pin !== undefined ? { pin: pin ?? "" } : {}),
  };
}

export function profileFromServer(
  raw: Record<string, unknown>,
): ExperienceProfile | null {
  if (
    Number(raw.experienceVersion) !== 2 ||
    typeof raw.id !== "string" ||
    typeof raw.name !== "string"
  ) {
    return null;
  }
  return {
    id: raw.id,
    name: raw.name,
    color: typeof raw.color === "string" ? raw.color : "#9eb6ff",
    isChild: Boolean(raw.isKids),
    isGuest: Boolean(raw.isGuest),
    pinEnabled: Boolean(raw.pinEnabled),
    summaryOnly: raw.summaryOnly === true,
    atmosphere: raw.atmosphere !== false,
    transparency: raw.transparency !== false,
    motion:
      raw.motion === "still" || raw.motion === "expressive"
        ? raw.motion
        : "subtle",
    density: raw.density === "compact" ? "compact" : "comfortable",
    exploration:
      raw.exploration === "familiar" || raw.exploration === "adventurous"
        ? raw.exploration
        : "balanced",
    reactions:
      typeof raw.reactions === "object" && raw.reactions
        ? (raw.reactions as ExperienceProfile["reactions"])
        : {},
    dismissedTasteIds: Array.isArray(raw.dismissedTasteIds)
      ? raw.dismissedTasteIds.filter(
          (id): id is string => typeof id === "string",
        )
      : [],
    lessLikeIds: Array.isArray(raw.lessLikeIds)
      ? raw.lessLikeIds.filter((id): id is string => typeof id === "string")
      : [],
    savedIds: Array.isArray(raw.savedIds)
      ? raw.savedIds.filter((id): id is string => typeof id === "string")
      : [],
    progress:
      typeof raw.progress === "object" && raw.progress
        ? (raw.progress as Record<string, number>)
        : {},
    bookProgress:
      typeof raw.bookProgress === "object" && raw.bookProgress
        ? (raw.bookProgress as Record<string, number>)
        : {},
    bookLocations:
      typeof raw.bookLocations === "object" && raw.bookLocations
        ? (raw.bookLocations as Record<string, string>)
        : {},
    bookBookmarks:
      typeof raw.bookBookmarks === "object" && raw.bookBookmarks
        ? (raw.bookBookmarks as Record<string, string[]>)
        : {},
    readingAppearance:
      typeof raw.readingAppearance === "object" && raw.readingAppearance
        ? {
            theme:
              (raw.readingAppearance as Record<string, unknown>).theme === "sepia" ||
              (raw.readingAppearance as Record<string, unknown>).theme === "light" ||
              (raw.readingAppearance as Record<string, unknown>).theme === "slate"
                ? ((raw.readingAppearance as Record<string, unknown>).theme as
                    | "sepia"
                    | "light"
                    | "slate")
                : "dark",
            fontSizeIndex: Math.max(
              0,
              Math.min(
                4,
                Number(
                  (raw.readingAppearance as Record<string, unknown>)
                    .fontSizeIndex ?? 1,
                ),
              ),
            ),
          }
        : { theme: "dark", fontSizeIndex: 1 },
    audioPreference:
      raw.audioPreference === "dub" || raw.audioPreference === "sub"
        ? raw.audioPreference
        : "original",
    subtitleLanguage:
      typeof raw.subtitleLanguage === "string"
        ? raw.subtitleLanguage
        : "English",
    maturity:
      raw.maturity === "little" ||
      raw.maturity === "big" ||
      raw.maturity === "teen" ||
      raw.maturity === "mature"
        ? raw.maturity
        : undefined,
    bedtime: typeof raw.bedtime === "string" ? raw.bedtime : undefined,
    boundaries:
      typeof raw.boundaries === "object" && raw.boundaries
        ? (raw.boundaries as ExperienceProfile["boundaries"])
        : undefined,
    familyPlayback:
      typeof raw.familyPlayback === "object" && raw.familyPlayback
        ? {
            languageSeverity:
              (raw.familyPlayback as Record<string, unknown>)
                .languageSeverity === "off" ||
              (raw.familyPlayback as Record<string, unknown>)
                .languageSeverity === "strong" ||
              (raw.familyPlayback as Record<string, unknown>)
                .languageSeverity === "mild"
                ? ((raw.familyPlayback as Record<string, unknown>)
                    .languageSeverity as "off" | "strong" | "mild")
                : "moderate",
            religiousLanguage: Boolean(
              (raw.familyPlayback as Record<string, unknown>)
                .religiousLanguage,
            ),
            audioTreatment:
              (raw.familyPlayback as Record<string, unknown>).audioTreatment ===
              "soften"
                ? "soften"
                : "mute",
            subtitleTreatment:
              (raw.familyPlayback as Record<string, unknown>)
                .subtitleTreatment === "replace"
                ? "replace"
                : "hide",
            exceptions: Array.isArray(
              (raw.familyPlayback as Record<string, unknown>).exceptions,
            )
              ? ((raw.familyPlayback as Record<string, unknown>)
                  .exceptions as unknown[]).filter(
                  (item): item is string => typeof item === "string",
                )
              : [],
          }
        : undefined,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : undefined,
  };
}

export async function loadExperienceProfiles(signal?: AbortSignal) {
  const response = await fetch("/api/profiles", { cache: "no-store", signal });
  if (!response.ok) throw new Error("Profiles are unavailable");
  const payload = (await response.json()) as ProfilesResponse;
  return {
    profiles: (payload.profiles || [])
      .map(profileFromServer)
      .filter((profile): profile is ExperienceProfile => Boolean(profile)),
    activeId: payload.activeId,
    auth: payload.auth,
    setup: payload.setup,
  };
}

export async function saveExperienceProfile(
  profile: ExperienceProfile,
  pin?: string | null,
) {
  const response = await fetch("/api/profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profileToServer(profile, pin)),
  });
  const result = await response.json();
  if (!response.ok || result.ok !== true) throw new Error(result.error || "Profile could not be saved");
  return result;
}

export async function completeExperienceSetup(expectedProfileIds: string[]) {
  const response = await fetch("/api/profiles/setup/complete", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedProfileIds }),
  });
  const result = await response.json();
  if (!response.ok || result.setup?.status !== "complete") {
    throw new Error(result.error || "This home has not confirmed setup. Please retry.");
  }
}

export async function saveActiveExperienceProfile(id: string, pin?: string, exitPin?: string) {
  const response = await fetch("/api/profiles/active", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, pin, exitPin }),
  });
  const result = await response.json() as {
    profile?: Record<string, unknown>; activeId?: string; auth?: ProfileSession; error?: string;
  };
  if (!response.ok) throw new Error(result.error || "This profile could not be opened.");
  const profile = result.profile ? profileFromServer(result.profile) : null;
  if (!profile || profile.summaryOnly) throw new Error("This home did not confirm the profile.");
  return { profile, activeId: result.activeId || profile.id, auth: result.auth };
}
