import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_DEBRID_CONNECTION,
  accessibleTitleIds,
  providerDisabledConnection,
  titleIsAccessible,
  type DebridConnection,
} from "./source-access.ts";

export type Reaction = "like" | "love" | "cozy";
export type MotionPreference = "still" | "subtle" | "expressive";
export type DensityPreference = "comfortable" | "compact";
export type ExplorationPreference = "familiar" | "balanced" | "adventurous";
export type ReaderTheme = "dark" | "sepia" | "light" | "slate";
export interface ReadingAppearance {
  theme: ReaderTheme;
  fontSizeIndex: number;
}
export interface FamilyPlaybackPolicy {
  languageSeverity: "off" | "strong" | "moderate" | "mild";
  religiousLanguage: boolean;
  audioTreatment: "mute" | "soften";
  subtitleTreatment: "hide" | "replace";
  exceptions: string[];
}

export type ExperienceView =
  | "home"
  | "discover"
  | "library"
  | "books"
  | "profile"
  | "taste"
  | "family"
  | "player"
  | "companion"
  | "party"
  | "devices"
  | "ambiance"
  | "settings"
  | "setup";

export interface ExperienceProfile {
  id: string;
  name: string;
  color: string;
  isChild?: boolean;
  isGuest?: boolean;
  pinEnabled?: boolean;
  atmosphere?: boolean;
  transparency?: boolean;
  motion: MotionPreference;
  density: DensityPreference;
  exploration: ExplorationPreference;
  reactions: Record<string, Reaction>;
  dismissedTasteIds: string[];
  lessLikeIds: string[];
  savedIds: string[];
  progress: Record<string, number>;
  bookProgress: Record<string, number>;
  bookLocations?: Record<string, string>;
  bookBookmarks?: Record<string, string[]>;
  readingAppearance?: ReadingAppearance;
  audioPreference: "original" | "dub" | "sub";
  subtitleLanguage: string;
  maturity?: "little" | "big" | "teen" | "mature";
  bedtime?: string;
  boundaries?: Record<string, "fine" | "ask" | "never">;
  familyPlayback?: FamilyPlaybackPolicy;
  updatedAt?: number;
  summaryOnly?: boolean;
}

export interface TonightFilters {
  mood: string;
  duration: "any" | "short" | "feature" | "long";
  kind: "all" | "movie" | "series" | "book";
  person: string;
  exploration: ExplorationPreference;
}

export interface PreviewRequest {
  titleId: string;
  status: "finding" | "preparing" | "ready" | "failed";
  progress: number;
}

export interface SetupDraft {
  ownerId?: string;
  step?: number;
  name?: string;
  color?: string;
  pinEnabled?: boolean;
  householdMembers?: Array<{ id?: string; name: string; isChild: boolean }>;
  addHouseholdNow?: boolean;
  memberName?: string;
  memberIsChild?: boolean;
  guidance?: "hand" | "balanced" | "free";
  reactions?: Record<string, Reaction>;
  dismissed?: string[];
  lessLike?: string[];
  path?: "new" | "existing";
  sourceChoice?: "public" | "torbox" | "real-debrid";
  device?: "phone" | "tv" | "usb";
}

interface ExperienceState {
  adapter: "service";
  view: ExperienceView;
  activeProfileId: string;
  profiles: ExperienceProfile[];
  kidsPresentIds: string[];
  tonight: TonightFilters;
  requests: Record<string, PreviewRequest>;
  connectedDevices: string[];
  debrid: DebridConnection;
  onboardingComplete: boolean;
  setupDraft: SetupDraft;
  setSetupDraft(draft: SetupDraft): void;
  setView(view: ExperienceView): void;
  setActiveProfile(id: string): void;
  addProfile(profile: Omit<ExperienceProfile, "id">): string;
  patchProfile(id: string, patch: Partial<ExperienceProfile>): void;
  toggleKidPresent(id: string): void;
  setTonight(patch: Partial<TonightFilters>): void;
  clearTonight(): void;
  react(profileId: string, itemId: string, reaction?: Reaction): void;
  dismissTaste(profileId: string, itemId: string): void;
  toggleLessLike(profileId: string, itemId: string): void;
  toggleSaved(
    profileId: string,
    titleId: string,
    availableFromTitle?: boolean,
  ): void;
  setProgress(profileId: string, titleId: string, progress: number): void;
  setBookProgress(
    profileId: string,
    bookId: string,
    progress: number,
    location?: string,
  ): void;
  toggleBookBookmark(profileId: string, bookId: string, location: string): void;
  setReadingAppearance(
    profileId: string,
    patch: Partial<ReadingAppearance>,
  ): void;
  setRequest(titleId: string, request?: PreviewRequest): void;
  addDevice(name: string): void;
  setDebridEnabled(enabled: boolean): void;
  setDebridConnection(connection: DebridConnection): void;
  finishOnboarding(): void;
  hydrateProfiles(
    profiles: ExperienceProfile[],
    activeProfileId?: string,
    setupComplete?: boolean,
  ): void;
}

const defaultTonight: TonightFilters = {
  mood: "",
  duration: "any",
  kind: "all",
  person: "",
  exploration: "balanced",
};

// Rendering defaults for first-run setup, never a persisted household member.
export const EMPTY_SETUP_PROFILE: ExperienceProfile = {
  id: "",
  name: "",
  color: "#2563eb",
  motion: "subtle",
  density: "comfortable",
  exploration: "balanced",
  reactions: {},
  dismissedTasteIds: [],
  lessLikeIds: [],
  savedIds: [],
  progress: {},
  bookProgress: {},
  audioPreference: "original",
  subtitleLanguage: "English",
};

const unique = (items: string[]) => [...new Set(items)];

export const useExperienceStore = create<ExperienceState>()(
  persist(
    (set, get) => ({
      adapter: "service",
      view: "setup",
      activeProfileId: "",
      profiles: [],
      kidsPresentIds: [],
      tonight: defaultTonight,
      requests: {},
      connectedDevices: [],
      debrid: DEFAULT_DEBRID_CONNECTION,
      onboardingComplete: false,
      setupDraft: {},
      setSetupDraft: (setupDraft) => set({ setupDraft }),
      setView: (view) => set({ view }),
      setActiveProfile: (activeProfileId) =>
        set({ activeProfileId, view: "home" }),
      addProfile: (profile) => {
        const id = `${profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
        set((state) => ({
          profiles: [
            ...state.profiles,
            { ...profile, id, updatedAt: Date.now() },
          ],
        }));
        return id;
      },
      patchProfile: (id, patch) =>
        set((state) => ({
          profiles: state.profiles.map((profile) =>
            profile.id === id
              ? { ...profile, ...patch, updatedAt: Date.now() }
              : profile,
          ),
        })),
      toggleKidPresent: (id) =>
        set((state) => ({
          kidsPresentIds: state.kidsPresentIds.includes(id)
            ? state.kidsPresentIds.filter((item) => item !== id)
            : [...state.kidsPresentIds, id],
        })),
      setTonight: (patch) =>
        set((state) => ({ tonight: { ...state.tonight, ...patch } })),
      clearTonight: () => set({ tonight: defaultTonight }),
      react: (profileId, itemId, reaction) =>
        set((state) => ({
          profiles: state.profiles.map((profile) => {
            if (profile.id !== profileId) return profile;
            const reactions = { ...profile.reactions };
            if (reaction) reactions[itemId] = reaction;
            else delete reactions[itemId];
            return {
              ...profile,
              updatedAt: Date.now(),
              reactions,
              dismissedTasteIds: profile.dismissedTasteIds.filter(
                (id) => id !== itemId,
              ),
              lessLikeIds: profile.lessLikeIds.filter((id) => id !== itemId),
            };
          }),
        })),
      dismissTaste: (profileId, itemId) =>
        set((state) => ({
          profiles: state.profiles.map((profile) => {
            if (profile.id !== profileId) return profile;
            const reactions = { ...profile.reactions };
            delete reactions[itemId];
            return {
              ...profile,
              updatedAt: Date.now(),
              reactions,
              lessLikeIds: profile.lessLikeIds.filter((id) => id !== itemId),
              dismissedTasteIds: unique([
                ...profile.dismissedTasteIds,
                itemId,
              ]),
            };
          }),
        })),
      toggleLessLike: (profileId, itemId) =>
        set((state) => ({
          profiles: state.profiles.map((profile) => {
            if (profile.id !== profileId) return profile;
            const removing = profile.lessLikeIds.includes(itemId);
            const reactions = { ...profile.reactions };
            if (!removing) delete reactions[itemId];
            return {
              ...profile,
              updatedAt: Date.now(),
              reactions,
              dismissedTasteIds: removing
                ? profile.dismissedTasteIds
                : profile.dismissedTasteIds.filter((id) => id !== itemId),
              lessLikeIds: removing
                ? profile.lessLikeIds.filter((id) => id !== itemId)
                : [...profile.lessLikeIds, itemId],
            };
          }),
        })),
      toggleSaved: (profileId, titleId, availableFromTitle) =>
        set((state) => {
          const profile = state.profiles.find((item) => item.id === profileId);
          const removing = profile?.savedIds.includes(titleId) ?? false;
          const requestReady = state.requests[titleId]?.status === "ready";
          const accessible =
            availableFromTitle ?? titleIsAccessible(titleId, state.debrid);
          if (
            !removing &&
            !accessible &&
            !requestReady
          )
            return state;
          return {
            profiles: state.profiles.map((item) =>
              item.id === profileId
                ? {
                    ...item,
                    updatedAt: Date.now(),
                    savedIds: removing
                      ? item.savedIds.filter((id) => id !== titleId)
                      : [...item.savedIds, titleId],
                  }
                : item,
            ),
          };
        }),
      setProgress: (profileId, titleId, progress) =>
        set((state) => ({
          profiles: state.profiles.map((profile) =>
            profile.id === profileId
              ? {
                  ...profile,
                  updatedAt: Date.now(),
                  progress: { ...profile.progress, [titleId]: progress },
                }
              : profile,
          ),
        })),
      setBookProgress: (profileId, bookId, progress, location) =>
        set((state) => ({
          profiles: state.profiles.map((profile) =>
            profile.id === profileId
              ? {
                  ...profile,
                  updatedAt: Date.now(),
                  bookProgress: {
                    ...profile.bookProgress,
                    [bookId]: Math.max(0, Math.min(1, progress)),
                  },
                  bookLocations: location
                    ? { ...profile.bookLocations, [bookId]: location }
                    : profile.bookLocations,
                }
              : profile,
          ),
        })),
      toggleBookBookmark: (profileId, bookId, location) =>
        set((state) => ({
          profiles: state.profiles.map((profile) => {
            if (profile.id !== profileId || !location) return profile;
            const current = profile.bookBookmarks?.[bookId] || [];
            const next = current.includes(location)
              ? current.filter((item) => item !== location)
              : unique([...current, location]);
            return {
              ...profile,
              updatedAt: Date.now(),
              bookBookmarks: {
                ...profile.bookBookmarks,
                [bookId]: next,
              },
            };
          }),
        })),
      setReadingAppearance: (profileId, patch) =>
        set((state) => ({
          profiles: state.profiles.map((profile) =>
            profile.id === profileId
              ? {
                  ...profile,
                  updatedAt: Date.now(),
                  readingAppearance: {
                    theme: patch.theme || profile.readingAppearance?.theme || "dark",
                    fontSizeIndex: Math.max(
                      0,
                      Math.min(
                        4,
                        patch.fontSizeIndex ??
                          profile.readingAppearance?.fontSizeIndex ??
                          1,
                      ),
                    ),
                  },
                }
              : profile,
          ),
        })),
      setRequest: (titleId, request) =>
        set((state) => {
          const requests = { ...state.requests };
          if (request) requests[titleId] = request;
          else delete requests[titleId];
          return { requests };
        }),
      addDevice: (name) =>
        set((state) => ({
          connectedDevices: unique([...state.connectedDevices, name]),
        })),
      setDebridEnabled: (enabled) =>
        set((state) => {
          if (enabled) {
            return {
              debrid: {
                ...state.debrid,
                enabled: true,
                status:
                  state.debrid.status === "connected"
                    ? "connected"
                    : "needs-key",
              },
            };
          }
          const debrid = providerDisabledConnection(state.debrid);
          return {
            debrid,
            profiles: state.profiles.map((profile) => ({
              ...profile,
              savedIds: accessibleTitleIds(profile.savedIds, debrid),
            })),
            requests: Object.fromEntries(
              Object.entries(state.requests).filter(([titleId]) =>
                titleIsAccessible(titleId, debrid),
              ),
            ),
          };
        }),
      setDebridConnection: (debrid) => set({ debrid }),
      finishOnboarding: () => set({ onboardingComplete: true, view: "home", setupDraft: {} }),
      hydrateProfiles: (profiles, requestedActiveId, setupComplete = false) =>
        set((state) => {
          if (!profiles.length) return {
            profiles: [], activeProfileId: "", onboardingComplete: false,
            view: "setup" as const, kidsPresentIds: [], connectedDevices: [],
          };
          const activeProfileId = profiles.some(
            (profile) => profile.id === requestedActiveId && !profile.summaryOnly,
          ) ? requestedActiveId! : "";
          return {
            profiles, activeProfileId,
            onboardingComplete: setupComplete,
            // Presence is session-scoped, but route remounts must not erase who
            // is currently watching. It is intentionally excluded from persisted storage.
            // Keep session presence across ordinary route remounts, but clear it
            // when the requested private identity cannot be authenticated.
            kidsPresentIds: activeProfileId ? state.kidsPresentIds : [], tonight: defaultTonight, requests: {},
            view: !setupComplete ? "setup" as const
              : state.view === "setup" ? "home" as const : state.view,
          };
        }),
    }),
    {
      // Keep old preview storage untouched; it must never become production data.
      name: "reelos-experience-service-v3",
      partialize: (state) => ({
        view: state.view,
        activeProfileId: state.activeProfileId,
        // Private profile data, source authorization, presence and device state
        // are hydrated from their services rather than trusted after a reload.
        onboardingComplete: state.onboardingComplete,
        setupDraft: state.setupDraft,
      }),
    },
  ),
);

export function activeExperienceProfile(
  state: Pick<ExperienceState, "profiles" | "activeProfileId">,
) {
  return (
    state.profiles.find((profile) => profile.id === state.activeProfileId) ??
    state.profiles[0] ??
    EMPTY_SETUP_PROFILE
  );
}
