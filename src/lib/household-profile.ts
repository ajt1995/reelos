/** Austin household profiles — member wizard is 1–2 questions, not the owner's 7-step house wizard. */

export const MEMBER_WIZARD_TOTAL = 2;

export const MEMBER_WIZARD_QUESTIONS = [
  {
    id: "age",
    title: "How old are you?",
    sub: "This sets the parental rating on your Jellyfin account. The owner can change it later in Settings.",
  },
  {
    id: "jellyfin",
    title: "Jellyfin username and password/PIN",
    sub: "Your Jellyfin account — not the owner's. ReelOS signs in as this user on this phone and on the TV.",
  },
] as const;

export const AGE_BANDS = [
  { id: "under7", label: "Under 7", minAge: 0, maxAge: 6, parentalMax: 7 },
  { id: "7to12", label: "7–12", minAge: 7, maxAge: 12, parentalMax: 10 },
  { id: "13to16", label: "13–16", minAge: 13, maxAge: 16, parentalMax: 14 },
  { id: "17plus", label: "17+", minAge: 17, maxAge: 120, parentalMax: null as number | null },
] as const;

export type AgeBandId = (typeof AGE_BANDS)[number]["id"];

export const OWNER_PERMISSION_TOGGLES = [
  {
    id: "canRequest",
    label: "Can request titles",
    hint: "Discover and Request on this profile.",
  },
  {
    id: "autoApprove",
    label: "Auto-approve their requests",
    hint: "Skip the owner queue for this person.",
  },
  {
    id: "canApprove",
    label: "Can approve others' requests",
    hint: "House queue, not just their own.",
  },
  {
    id: "canManageHouse",
    label: "Can change house Settings",
    hint: "Source, quality, Apply, users. Owner-only by default.",
  },
  {
    id: "canRemoveLibrary",
    label: "Can remove titles from this box",
    hint: "Unmonitor and delete the engine row — never /media.",
  },
  {
    id: "traktEnabled",
    label: "Trakt (optional)",
    hint: "Scrobble this profile. Off by default. Not a Google TV scrape.",
  },
] as const;

export type OwnerPermissionId = (typeof OWNER_PERMISSION_TOGGLES)[number]["id"];

export type HouseholdRole = "owner" | "member";

export interface HouseholdPermissions {
  canRequest: boolean;
  autoApprove: boolean;
  canApprove: boolean;
  canManageHouse: boolean;
  canRemoveLibrary: boolean;
  traktEnabled: boolean;
}

export function isHouseOwner(role?: string | null): boolean {
  return role === "owner" || role === "admin";
}

export function ageBandForYears(years: number): (typeof AGE_BANDS)[number] {
  const n = Number.isFinite(years) ? years : 17;
  return AGE_BANDS.find((b) => n >= b.minAge && n <= b.maxAge) ?? AGE_BANDS[3];
}

export function parentalMaxForAge(years: number): number | null {
  return ageBandForYears(years).parentalMax;
}

export function defaultPermissions(role: string, ageYears?: number | null): HouseholdPermissions {
  const owner = isHouseOwner(role);
  const years = ageYears == null ? 17 : ageYears;
  return {
    canRequest: owner || years >= 7,
    autoApprove: owner,
    canApprove: owner,
    canManageHouse: owner,
    canRemoveLibrary: owner,
    traktEnabled: false,
  };
}

export function publicProfile<T extends { jellyfinPassword?: string }>(profile: T): Omit<T, "jellyfinPassword"> {
  const { jellyfinPassword: _omit, ...rest } = profile;
  void _omit;
  return rest;
}
