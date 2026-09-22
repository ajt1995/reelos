import type { ExperienceProfile, SetupDraft } from "./experience-state.ts";
import { saveExperienceProfile } from "./profile-adapter.ts";

type SetupSecrets = { pin: string; childExitPin: string };

// Stable draft IDs make retry/reload update the same people, not create duplicates.
export function setupProfileWrites(draft: SetupDraft, secrets: SetupSecrets, existing: ExperienceProfile[]) {
  if (!draft.ownerId || !draft.name?.trim()) throw new Error("Enter your name before continuing.");
  const protectedIds = new Set(existing.filter((profile) => profile.pinEnabled).map((profile) => profile.id));
  if (draft.pinEnabled && !protectedIds.has(draft.ownerId) && !/^\d{4}$/.test(secrets.pin)) {
    throw new Error("Enter your four-digit PIN again before continuing.");
  }
  if (draft.householdMembers?.some((member) => member.isChild && !protectedIds.has(member.id || "")) &&
      !/^\d{4}$/.test(secrets.childExitPin)) {
    throw new Error("Enter the children's four-digit exit PIN again before continuing.");
  }
  const base = {
    motion: "subtle" as const, density: "comfortable" as const, exploration: "balanced" as const,
    reactions: {}, dismissedTasteIds: [], lessLikeIds: [], savedIds: [], progress: {}, bookProgress: {},
    audioPreference: "original" as const, subtitleLanguage: "English",
  };
  const previous = existing.find((profile) => profile.id === draft.ownerId && !profile.summaryOnly);
  const owner: ExperienceProfile = {
    ...base, ...previous, id: draft.ownerId, name: draft.name.trim(), color: draft.color || "#2563eb",
    pinEnabled: Boolean(draft.pinEnabled), summaryOnly: false,
    exploration: draft.guidance === "free" ? "adventurous" : draft.guidance === "hand" ? "familiar" : "balanced",
    reactions: draft.reactions ?? previous?.reactions ?? {},
    dismissedTasteIds: draft.dismissed ?? previous?.dismissedTasteIds ?? [],
    lessLikeIds: draft.lessLike ?? previous?.lessLikeIds ?? [],
  };
  const writes: Array<{ profile: ExperienceProfile; pin?: string | null }> = [{
    profile: owner,
    pin: draft.pinEnabled ? (secrets.pin || undefined) : null,
  }];
  const colors = ["#58d5bc", "#f0ba61", "#a855f7", "#06b6d4"];
  for (const [index, member] of (draft.householdMembers ?? []).entries()) {
    if (!member.id || !member.name.trim()) throw new Error("A household member needs a name. Please review your household.");
    const profile: ExperienceProfile = {
      ...base, id: member.id, name: member.name.trim(), color: colors[index % colors.length],
      isChild: member.isChild, pinEnabled: member.isChild,
      ...(member.isChild ? { maturity: "big" as const, exploration: "familiar" as const,
        audioPreference: "dub" as const, subtitleLanguage: "Off",
        boundaries: { scares: "ask", slapstick: "fine", fantasy: "fine", romance: "ask",
          grief: "ask", supernatural: "ask", stunts: "ask", language: "never" } as const } : {}),
    };
    // Already saved members are not rewritten from display-only roster data.
    if (!existing.some((saved) => saved.id === member.id)) {
      writes.push({ profile, pin: member.isChild ? secrets.childExitPin : undefined });
    }
  }
  return writes;
}

export async function saveSetupHousehold(draft: SetupDraft, secrets: SetupSecrets, existing: ExperienceProfile[]) {
  const writes = setupProfileWrites(draft, secrets, existing);
  // The first response creates the owner session. Subsequent writes require it.
  for (const { profile, pin } of writes) await saveExperienceProfile(profile, pin);
  return [draft.ownerId!, ...(draft.householdMembers ?? []).map((member) => member.id!)];
}

export async function savePublicSourceChoice() {
  const response = await fetch("/api/settings", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ debridEnabled: false }),
  });
  const result = await response.json();
  if (!response.ok || result.ok === false || result.debridEnabled !== false) {
    throw new Error(result.error || "Your source choice was not confirmed. Please retry.");
  }
}
