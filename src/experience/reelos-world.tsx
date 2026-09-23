import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  Check,
  ChevronRight,
  Clock3,
  Coffee,
  Compass,
  Download,
  ExternalLink,
  Flame,
  Heart,
  Home,
  Library,
  Lock,
  MessageCircle,
  MonitorUp,
  Moon,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Speaker,
  SunMedium,
  Tv,
  ThumbsDown,
  Upload,
  UserRound,
  Users,
  Volume2,
  Wand2,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { AdvancedView } from "@/components/advanced-view";
import { BooksView } from "@/components/books-view";
import { WatchTogetherWorld } from "@/components/watch-together-world";
import { StorageSettings } from "@/components/storage-settings";
import { PreparationPanel } from "@/components/preparation-panel";
import { StreamingAvailabilityBar } from "@/components/streaming-availability-bar";
import { LuxuryPinInput } from "@/components/luxury-pin-input";
import {
  EXPERIENCE_CATALOG,
  PUBLIC_DOMAIN_TITLES,
  type ExperienceTitle,
  TASTE_ITEMS,
  TITLE_BY_EXPERIENCE_ID,
  curateForProfile,
  titlesForPerson,
  whyThisTitle,
} from "@/experience/experience-catalog";
import {
  type ReelSearchResult,
  mapLookupTitle,
  parseSearchIntent,
  rankLocalSearch,
  searchReelOS,
} from "@/experience/search-service";
import {
  activeExperienceProfile,
  type ExperienceProfile,
  type ExperienceView,
  type Reaction,
  useExperienceStore,
} from "@/experience/experience-state";
import {
  nextTasteReaction,
  tasteFieldViewport,
} from "@/experience/taste-field";
import {
  isDebridConnected,
  publicPlaybackPath,
  sourceIsAccessible,
  titleCanUseProvider,
} from "@/experience/source-access";
import {
  inspectSourceLink,
  type SourceLinkReview,
} from "@/experience/source-handoff";
import {
  conciergeGuidance,
  inferConciergeIntent,
} from "@/experience/concierge";
import {
  buildDecisionPicks,
  type DecisionClue,
} from "@/experience/decision-engine";
import {
  loadLiveLibrary,
  mergeExperienceTitles,
  type LiveLibraryResult,
} from "@/experience/library-adapter";
import {
  loadStreamingAvailability,
  type StreamingAvailability,
} from "@/experience/streaming-availability";
import {
  loadExperienceProfiles,
  completeExperienceSetup,
  saveActiveExperienceProfile,
  saveExperienceProfile,
  type ProfileSession,
} from "@/experience/profile-adapter";
import { saveSetupHousehold, savePublicSourceChoice } from "@/experience/setup-adapter";
import { createPlaybackSleepTimer } from "@/lib/playback-sleep-timer";
import { createClientId } from "@/lib/client-id";
import { attachAudioBooster, type AudioController, type AudioPreset } from "@/lib/audio-booster";
import {
  pathForWorldDestination,
  pathForWorldView,
  type WorldContentDestination,
  worldViewForPath,
} from "@/experience/world-routing";
import {
  resolveCompanionSeed,
  type CompanionDeepLink,
} from "@/experience/companion-deep-link";
import {
  companionProgress,
  companionSeekTicks,
  loadActiveCompanionState,
  loadCompanionDossier,
  queueCompanionCommand,
  type ActiveCompanionState,
  type CompanionDossier,
} from "@/experience/companion-client";


type Modal =
  | { type: "title"; title: ExperienceTitle }
  | { type: "person"; name: string; externalId?: string }
  | {
      type: "collection";
      name: string;
      titleIds: string[];
      externalId?: string;
    }
  | { type: "protect-child"; profile: ExperienceProfile }
  | null;

type ExitGate = { profile: ExperienceProfile; action: () => void } | null;

export type WorldDestination = WorldContentDestination;

const WORLD_RETURN_STATE_KEY = "reelos.world-return.v1";

type WorldReturnState = {
  origin: string;
  target: string;
  scrollY: number;
  focusLabel?: string;
};

function rememberWorldOrigin(target: string) {
  if (typeof window === "undefined") return;
  const focused = document.activeElement;
  const focusLabel = focused instanceof HTMLElement
    ? focused.getAttribute("aria-label") || undefined
    : undefined;
  const state: WorldReturnState = {
    origin: `${window.location.pathname}${window.location.search}`,
    target,
    scrollY: window.scrollY,
    focusLabel,
  };
  window.sessionStorage.setItem(WORLD_RETURN_STATE_KEY, JSON.stringify(state));
}

function readWorldReturnState(): WorldReturnState | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const value = JSON.parse(window.sessionStorage.getItem(WORLD_RETURN_STATE_KEY) || "null") as Partial<WorldReturnState> | null;
    if (!value || typeof value.origin !== "string" || typeof value.target !== "string" || typeof value.scrollY !== "number") return undefined;
    return value as WorldReturnState;
  } catch {
    return undefined;
  }
}

const NAV: Array<readonly [ExperienceView, string, typeof Home]> = [
  ["home", "Home", Home],
  ["discover", "Discover", Compass],
  ["library", "Library", Library],
  ["books", "Books", BookOpen],
];

type ReelOSNativeWindow = Window & {
  ReelOSNative?: { platform(): string };
};

function nativePlatform() {
  if (typeof window === "undefined") return "web";
  try {
    return (window as ReelOSNativeWindow).ReelOSNative?.platform() || "web";
  } catch {
    return "web";
  }
}

function ProfileAura({ lightweight = false }: { lightweight?: boolean }) {
  return (
    <div
      className="reelos-profile-aura"
      aria-hidden="true"
      // Android TV WebViews repaint a viewport-sized blurred layer every frame.
      // Keep the personal colour alive with compositor-only opacity/transform;
      // the native TV stylesheet removes only the expensive blur.
      style={lightweight ? { filter: "none", opacity: 0.28 } : undefined}
    />
  );
}

function visibleNavigation() {
  return nativePlatform() === "android-tv"
    ? NAV.filter(([id]) => id !== "books")
    : NAV;
}

function experienceTitleIsAccessible(
  title: ExperienceTitle,
  debrid: ReturnType<typeof useExperienceStore.getState>["debrid"],
) {
  return title.sources.some((source) => sourceIsAccessible(source, debrid));
}

function possessive(name: string) {
  return /s$/i.test(name) ? `${name}’` : `${name}’s`;
}

function syncFamilyPresence(childProfileIds: string[]) {
  return fetch("/api/companion/presence-filter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "living_room_tv",
      kidsPresent: childProfileIds.length > 0,
      childProfileIds,
    }),
  });
}

export function ReelOSWorld({
  initialView = "home",
  initialDestination,
  initialSettingsGroup,
  initialCompanionLink,
}: {
  initialView?: ExperienceView;
  initialDestination?: WorldDestination;
  initialSettingsGroup?: string;
  initialCompanionLink?: CompanionDeepLink;
}) {
  const routeNavigate = useNavigate();
  const platform = useMemo(nativePlatform, []);
  const tvPlatform = platform === "android-tv";
  const state = useExperienceStore();
  const profile = activeExperienceProfile(state);
  const [modal, setModal] = useState<Modal>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceReview, setSourceReview] = useState<SourceLinkReview | null>(
    null,
  );
  const [conciergeOpen, setConciergeOpen] = useState(false);
  const [booksInitialQuery, setBooksInitialQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [playing, setPlaying] = useState<ExperienceTitle | null>(null);
  const [returnView, setReturnView] = useState<ExperienceView>("home");
  const [profileAdapterReady, setProfileAdapterReady] = useState(false);
  const [hydrationRevision, setHydrationRevision] = useState(0);
  const [profileError, setProfileError] = useState("");
  const [destinationError, setDestinationError] = useState("");
  const [sessionAuth, setSessionAuth] = useState<ProfileSession | undefined>();
  const savedProfiles = useRef(new Map<string, string>());
  const [switchTarget, setSwitchTarget] = useState<ExperienceProfile | null>(null);
  const [switchBusy, setSwitchBusy] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const [exitGate, setExitGate] = useState<ExitGate>(null);
  const [liveLibrary, setLiveLibrary] = useState<LiveLibraryResult>({
    titles: [],
    progress: {},
    status: "unavailable",
  });
  const kidsPresent = state.kidsPresentIds.length > 0;
  const experienceTitles = useMemo(
    () => mergeExperienceTitles(EXPERIENCE_CATALOG, liveLibrary.titles),
    [liveLibrary.titles],
  );
  const curated = useMemo(
    () =>
      curateForProfile(profile, state.tonight, kidsPresent, experienceTitles),
    [profile, state.tonight, kidsPresent, experienceTitles],
  );
  const companionSeed = useMemo(
    () =>
      sessionAuth?.authenticated
        ? resolveCompanionSeed(
            initialCompanionLink,
            experienceTitles,
            state.debrid,
            Boolean(profile.isChild),
          )
        : undefined,
    [
      sessionAuth?.authenticated,
      initialCompanionLink,
      experienceTitles,
      state.debrid,
      profile.isChild,
    ],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLiveLibrary({ titles: [], progress: {}, status: "unavailable" });
    if (!profileAdapterReady || !sessionAuth?.authenticated) return () => controller.abort();
    void loadLiveLibrary(controller.signal)
      .then((library) => { if (!controller.signal.aborted) setLiveLibrary(library); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [profileAdapterReady, sessionAuth?.authenticated, profile.id]);

  useEffect(() => {
    const controller = new AbortController();
    setProfileAdapterReady(false);
    setProfileError("");
    void loadExperienceProfiles(controller.signal)
      .then(({ profiles, activeId, auth, setup }) => {
        if (controller.signal.aborted) return;
        const setupComplete = setup?.status === "complete";
        useExperienceStore.getState().hydrateProfiles(profiles, activeId, setupComplete);
        if (setupComplete) useExperienceStore.getState().setView(initialView);
        savedProfiles.current = new Map(profiles.map((item) => [item.id, JSON.stringify(item)]));
        setSessionAuth(auth ?? {
          bootstrapRequired: profiles.length === 0,
          authenticated: false,
        });
        setProfileAdapterReady(true);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setProfileError(
          reason instanceof Error ? reason.message : "This home could not be reached.",
        );
      });
    return () => controller.abort();
  }, [hydrationRevision, initialView]);

  useEffect(() => {
    if (!profileAdapterReady || !sessionAuth?.authenticated || !initialDestination) return;
    setDestinationError("");
    if (initialDestination.type === "person") {
      setModal({
        type: "person",
        name: initialDestination.name || (initialDestination.id.match(/^\d+$/) ? "Person" : initialDestination.id),
        externalId: initialDestination.id.match(/^\d+$/) ? initialDestination.id : undefined,
      });
      return;
    }
    if (initialDestination.type === "collection") {
      setModal({
        type: "collection",
        name: initialDestination.name || "Collection",
        titleIds: initialDestination.titleIds || [],
        externalId: initialDestination.id.match(/^\d+$/) ? initialDestination.id : undefined,
      });
      return;
    }
    const local = experienceTitles.find((title) => title.id === initialDestination.id || title.playbackId === initialDestination.id);
    if (local) {
      setModal({ type: "title", title: local });
      return;
    }
    const controller = new AbortController();
    void fetch(`/api/lookup?id=${encodeURIComponent(initialDestination.id)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("That title is unavailable right now.");
        return response.json() as Promise<{ titles?: Record<string, unknown>[]; error?: string }>;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        const title = payload.titles?.map(mapLookupTitle).find((item): item is ExperienceTitle => Boolean(item));
        if (title) setModal({ type: "title", title });
        else setDestinationError(payload.error || "That title is unavailable right now.");
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setDestinationError(
          reason instanceof Error ? reason.message : "That title is unavailable right now.",
        );
      });
    return () => controller.abort();
  }, [
    profileAdapterReady,
    sessionAuth?.authenticated,
    initialDestination?.type,
    initialDestination?.id,
    initialDestination && "name" in initialDestination ? initialDestination.name : undefined,
    initialDestination?.type === "collection" ? initialDestination.titleIds?.join(",") : undefined,
    experienceTitles,
  ]);

  useEffect(() => {
    if (!profileAdapterReady || initialDestination || typeof window === "undefined") return;
    const saved = readWorldReturnState();
    const here = `${window.location.pathname}${window.location.search}`;
    if (!saved || saved.origin !== here) return;
    window.sessionStorage.removeItem(WORLD_RETURN_STATE_KEY);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: saved.scrollY, behavior: "auto" });
      if (!saved.focusLabel) return;
      const focusTarget = [...document.querySelectorAll<HTMLElement>("[aria-label]")]
        .find((element) => element.getAttribute("aria-label") === saved.focusLabel);
      focusTarget?.focus({ preventScroll: true });
    });
  }, [profileAdapterReady, initialDestination]);

  useEffect(() => {
    if (!profileAdapterReady || !sessionAuth?.authenticated || state.view === "setup" ||
        !profile.id || profile.summaryOnly) return;
    const snapshot = JSON.stringify(profile);
    if (savedProfiles.current.get(profile.id) === snapshot) return;
    const timer = window.setTimeout(() => {
      void saveExperienceProfile(profile).then(() => {
        savedProfiles.current.set(profile.id, snapshot);
        setProfileError("");
      }).catch((reason: unknown) => setProfileError(
        reason instanceof Error ? reason.message : "Your changes have not been saved. Please retry.",
      ));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [profileAdapterReady, sessionAuth, profile, state.view]);

  useEffect(() => {
    if (!profile.isChild) return;
    const childSafeViews: ExperienceView[] = [
      "home",
      "discover",
      "library",
      "taste",
      "player",
    ];
    if (!childSafeViews.includes(state.view)) {
      state.setView("home");
      if (window.location.pathname !== "/") {
        void routeNavigate({ to: "/", replace: true });
      }
    }
  }, [profile.isChild, state.view, state.setView, routeNavigate]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/settings", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as {
          sourcePolicy?: {
            enabled?: boolean;
            provider?: "torbox" | "real-debrid";
            status?: "disabled" | "validating" | "connected" | "failed";
            connected?: boolean;
          };
        };
      })
      .then((result) => {
        const policy = result?.sourcePolicy;
        if (!policy) return;
        state.setDebridConnection({
          enabled: policy.enabled === true,
          provider: policy.provider || "torbox",
          status: policy.connected
            ? "connected"
            : policy.status === "validating" || policy.status === "failed"
              ? policy.status
              : policy.enabled
                ? "needs-key"
                : "disabled",
        });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [state.setDebridConnection]);

  const navigate = (view: ExperienceView) => {
    if (view !== "player") {
      const location = new URL(window.location.href);
      location.searchParams.delete("watch");
      window.history.replaceState(window.history.state, "", location);
    }
    const nextView = !state.onboardingComplete && view !== "devices" ? "setup" : view;
    state.setView(nextView);
    const path = pathForWorldView(nextView);
    if (path && window.location.pathname !== path) {
      void routeNavigate({ to: path });
    }
    setProfileOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const afterChildExit = (action: () => void) => {
    if (!profile.isChild) action();
    else setExitGate({ profile, action });
  };
  const openDestination = useCallback((destination: WorldContentDestination) => {
    const targetPath = pathForWorldDestination(destination);
    const search = destination.type === "person"
      ? destination.name ? `?name=${encodeURIComponent(destination.name)}` : ""
      : destination.type === "collection"
        ? new URLSearchParams({
            ...(destination.name ? { name: destination.name } : {}),
            ...(destination.titleIds?.length ? { titles: destination.titleIds.join(",") } : {}),
          }).toString()
        : "";
    const target = search && destination.type === "collection" ? `${targetPath}?${search}` : `${targetPath}${search}`;
    rememberWorldOrigin(target);
    if (destination.type === "title") {
      void routeNavigate({ to: "/title/$id", params: { id: destination.id } });
    } else if (destination.type === "person") {
      void routeNavigate({
        to: "/person/$id",
        params: { id: destination.id },
        search: { name: destination.name },
      });
    } else {
      void routeNavigate({
        to: "/collection/$id",
        params: { id: destination.id },
        search: {
          name: destination.name,
          titles: destination.titleIds?.length ? destination.titleIds.join(",") : undefined,
        },
      });
    }
  }, [routeNavigate]);
  const openTitle = useCallback((title: ExperienceTitle) =>
    openDestination({ type: "title", id: title.playbackId || title.id }), [openDestination]);
  const openSearch = (query = "") => {
    setSearchQuery(query);
    setSearchOpen(true);
  };
  const closeContentDestination = () => {
    setModal(null);
    if (!initialDestination) return;
    const saved = readWorldReturnState();
    const savedTargetPath = saved ? new URL(saved.target, window.location.origin).pathname : undefined;
    if (savedTargetPath === window.location.pathname) window.history.back();
    else void routeNavigate({ to: "/" });
  };
  const playTitle = (title: ExperienceTitle) => {
    const directPublicSource = title.sources.some(
      (source) =>
        source.verified && source.kind === "public_domain" && source.uri,
    );
    if (!directPublicSource) {
      window.location.assign(
        `/play/${encodeURIComponent(title.playbackId || title.id)}`,
      );
      return;
    }
    setReturnView(state.view);
    const location = new URL(window.location.href);
    location.searchParams.set("watch", title.id);
    window.history.pushState(window.history.state, "", location);
    setModal(null);
    setPlaying(title);
    state.setView("player");
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  useEffect(() => {
    if (!profileAdapterReady) return;
    const restorePlayer = () => {
      if (!state.onboardingComplete) {
        const location = new URL(window.location.href);
        location.searchParams.delete("watch");
        window.history.replaceState(window.history.state, "", location);
        setPlaying(null);
        state.setView("setup");
        return;
      }
      const location = new URL(window.location.href);
      const id = location.searchParams.get("watch");
      const title = id && publicPlaybackPath(id) ? TITLE_BY_EXPERIENCE_ID[id] : undefined;
      if (title && sessionAuth?.authenticated && (!profile.isChild || title.family)) {
        setPlaying(title);
        state.setView("player");
      } else {
        const routeView = worldViewForPath(location.pathname);
        if (routeView) state.setView(routeView);
        else if (useExperienceStore.getState().view === "player") state.setView(returnView);
        setPlaying(null);
      }
    };
    restorePlayer();
    window.addEventListener("popstate", restorePlayer);
    return () => window.removeEventListener("popstate", restorePlayer);
  }, [profileAdapterReady, state.onboardingComplete, profile.id, profile.isChild, sessionAuth?.authenticated, state.setView, returnView]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (modal) setModal(null);
      else if (searchOpen) setSearchOpen(false);
      else if (refineOpen) setRefineOpen(false);
      else if (exitGate) setExitGate(null);
      else if (profileOpen) setProfileOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modal, searchOpen, refineOpen, exitGate, profileOpen]);

  const hideShell =
    state.view === "setup" || state.view === "player" || state.view === "taste";
  const switchProfile = async (id: string, pin?: string) => {
    setSwitchBusy(true);
    setSwitchError("");
    try {
      const confirmed = await saveActiveExperienceProfile(id, pin);
      // Clear the previous person's private data before opening another profile.
      setProfileAdapterReady(false);
      setModal(null); setSearchOpen(false); setSearchQuery("");
      setPlaying(null); setRefineOpen(false);
      useExperienceStore.setState({ profiles: [], activeProfileId: "", kidsPresentIds: [], requests: {} });
      const loaded = await loadExperienceProfiles();
      state.hydrateProfiles(loaded.profiles, confirmed.activeId, loaded.setup?.status === "complete");
      savedProfiles.current = new Map(loaded.profiles.map((item) => [item.id, JSON.stringify(item)]));
      setSessionAuth(confirmed.auth ?? loaded.auth);
      setSwitchTarget(null);
      setProfileOpen(false);
      setProfileAdapterReady(true);
      window.scrollTo({ top: 0, behavior: "auto" });
    } catch (reason: unknown) {
      setSwitchError(reason instanceof Error ? reason.message : "This profile could not be opened.");
      setProfileError(reason instanceof Error ? reason.message : "This profile could not be opened.");
    } finally {
      setSwitchBusy(false);
    }
  };
  if (!profileAdapterReady) {
    return <div className="reelos-world grid min-h-dvh place-items-center px-6 text-white"
      style={{ "--reelos-favorite": "#2563eb" } as CSSProperties}>
      <ProfileAura lightweight={tvPlatform} />
      <div className="relative max-w-md text-center" role="status">
        <p className="text-lg">{profileError || "Opening your home…"}</p>
        {profileError && <button className="mt-6 min-h-12 rounded-full bg-white px-6 text-black"
          onClick={() => setHydrationRevision((value) => value + 1)}>Try again</button>}
      </div>
    </div>;
  }
  if (sessionAuth && !sessionAuth.authenticated && !sessionAuth.bootstrapRequired) {
    return <ProfileSessionEntry profiles={state.profiles} busy={switchBusy} error={switchError}
      deviceAuthorized={sessionAuth.deviceAuthorized !== false}
      onSelect={switchProfile} />;
  }
  const activeColor =
    !state.onboardingComplete && state.setupDraft?.color
      ? state.setupDraft.color
      : (profile.color || "#d4a017");
  return (
    <div
      className="reelos-world min-h-dvh overflow-x-hidden bg-[#080809] text-[#f5f1eb]"
      data-motion={profile.motion}
      data-density={profile.density}
      data-atmosphere={profile.atmosphere === false ? "off" : "on"}
      data-transparency={tvPlatform || profile.transparency === false ? "solid" : "glass"}
      data-platform={platform}
      style={
        {
          "--reelos-favorite": activeColor,
          "--color-gold": activeColor,
          "--color-gold-bright": activeColor,
        } as CSSProperties
      }
    >
      <ProfileAura lightweight={tvPlatform} />
      {profileError && <div role="alert" className="relative z-50 flex items-center justify-center gap-4 bg-black/80 p-3 text-sm text-white">
        <span>{profileError}</span>
        <button className="min-h-12 px-3 underline" onClick={() => {
          savedProfiles.current.delete(profile.id);
          state.patchProfile(profile.id, {});
        }}>Retry saving</button>
      </div>}
      {!hideShell && (
        <Shell
          view={state.view}
          profile={profile}
          profiles={state.profiles}
          kidsPresent={kidsPresent}
          profileOpen={profileOpen}
          onProfileOpen={() => setProfileOpen((open) => !open)}
          onNavigate={navigate}
          onSearch={() => openSearch()}
          onProfile={(id) => {
            if (id === profile.id) {
              setProfileOpen(false);
              return;
            }
            const target = state.profiles.find((item) => item.id === id);
            if (target?.isChild && !target.pinEnabled) {
              setProfileOpen(false);
              setModal({ type: "protect-child", profile: target });
              return;
            }
            setProfileOpen(false);
            afterChildExit(() => {
              setSwitchError("");
              setSwitchTarget(target ?? null);
            });
          }}
          onProtectedNavigate={(view) => afterChildExit(() => navigate(view))}
          onKids={() => {
            const firstChild = state.profiles.find((item) => item.isChild);
            if (firstChild) {
              const nextIds = state.kidsPresentIds.includes(firstChild.id)
                ? state.kidsPresentIds.filter((id) => id !== firstChild.id)
                : [...state.kidsPresentIds, firstChild.id];
              state.toggleKidPresent(firstChild.id);
              void syncFamilyPresence(nextIds).catch(() => undefined);
            }
          }}
        />
      )}

      {state.view === "home" && (
        <HomeWorld
          profile={profile}
          titles={curated}
          kidsPresent={kidsPresent}
          liveProgress={liveLibrary.progress}
          onOpen={openTitle}
          onPlay={playTitle}
          onSearch={openSearch}
          onNavigate={navigate}
        />
      )}
      {state.view === "discover" && (
        <DiscoverWorld
          profile={profile}
          titles={curated}
          onOpen={openTitle}
          onSearch={openSearch}
          onRefine={() => setRefineOpen(true)}
          onPerson={(name) => openDestination({ type: "person", id: name, name })}
          onCollection={(name, titleIds) =>
            openDestination({ type: "collection", id: name, name, titleIds })
          }
        />
      )}
      {state.view === "library" && (
        <LibraryWorld
          profile={profile}
          titles={experienceTitles}
          originals={liveLibrary.titles}
          liveProgress={liveLibrary.progress}
          libraryStatus={liveLibrary.status}
          libraryMessage={liveLibrary.message}
          requests={state.requests}
          onOpen={openTitle}
          onPlay={playTitle}
          onNavigate={navigate}
        />
      )}
      {state.view === "books" && (
        <BooksWorld
          profile={profile}
          initialQuery={booksInitialQuery}
          onNavigate={navigate}
        />
      )}
      {state.view === "profile" && (
        <ProfileWorld
          profile={profile}
          onNavigate={navigate}
          onOpen={openTitle}
        />
      )}
      {state.view === "taste" && (
        <TasteWorld profile={profile} onExit={() => navigate("profile")} />
      )}
      {state.view === "family" && <FamilyWorld onNavigate={navigate} />}
      {state.view === "settings" && <SettingsWorld onNavigate={navigate} initialGroup={initialSettingsGroup} />}
      {state.view === "devices" && <DevicesWorld onNavigate={navigate} />}
      {state.view === "ambiance" && <AmbianceWorld onNavigate={navigate} />}
      {state.view === "companion" && (
        <CompanionWorld onNavigate={navigate} seed={companionSeed} />
      )}
      {state.view === "party" && (
        <PartyWorld onNavigate={navigate} onOpen={openTitle} />
      )}
      {state.view === "setup" && <SetupWorld onNavigate={navigate}
        onComplete={() => setHydrationRevision((value) => value + 1)} />}
      {state.view === "player" && playing && (
        <PlayerWorld
          key={`${profile.id}:${playing.id}`}
          title={playing}
          profile={profile}
          onBack={() => {
            navigate(returnView);
            setPlaying(null);
          }}
          onCompanion={() => navigate("companion")}
        />
      )}

      {!hideShell && <MobileNav view={state.view} onNavigate={navigate} />}
      {searchOpen && (
        <SearchOverlay
          query={searchQuery}
          setQuery={setSearchQuery}
          onClose={() => setSearchOpen(false)}
          onOpen={(title) => {
            setSearchOpen(false);
            openTitle(title);
          }}
          onPerson={(name, externalId) => {
            setSearchOpen(false);
            openDestination({ type: "person", id: externalId || name, name });
          }}
          onCollection={(name, externalId) => {
            setSearchOpen(false);
            openDestination({ type: "collection", id: externalId, name });
          }}
          onBook={(title) => {
            setSearchOpen(false);
            setBooksInitialQuery(title);
            navigate("books");
          }}
          onSourceSetup={(review) => {
            setSearchOpen(false);
            setSourceReview(review);
          }}
          onConcierge={() => setConciergeOpen(true)}
          profile={profile}
        />
      )}
      {sourceReview && (
        <SourceSetupReview
          review={sourceReview}
          onClose={() => setSourceReview(null)}
          onSettings={() => {
            setSourceReview(null);
            navigate("settings");
          }}
        />
      )}
      {conciergeOpen && (
        <ConciergeSheet
          onClose={() => setConciergeOpen(false)}
          onSetup={() => {
            setConciergeOpen(false);
            navigate("setup");
          }}
          onSettings={() => {
            setConciergeOpen(false);
            navigate("settings");
          }}
        />
      )}
      {switchTarget && (
        <SimpleDialog title={switchTarget.name} onClose={() => setSwitchTarget(null)}>
          <ProfileSessionEntry profiles={[switchTarget]} busy={switchBusy} error={switchError}
            onSelect={switchProfile} embedded />
        </SimpleDialog>
      )}
      {exitGate && (
        <ExitPinGate
          profile={exitGate.profile}
          onClose={() => setExitGate(null)}
          onVerified={() => {
            const action = exitGate.action;
            setExitGate(null);
            action();
          }}
        />
      )}
      {refineOpen && <RefineSheet onClose={() => setRefineOpen(false)} />}
      {destinationError && (
        <SimpleDialog title="Not available yet" onClose={() => {
          setDestinationError("");
          void routeNavigate({ to: "/" });
        }}>
          <p className="leading-7 text-white/54">{destinationError}</p>
          <p className="mt-3 text-sm leading-6 text-white/38">
            ReelOS will not substitute an unrelated title or pretend this destination loaded.
          </p>
        </SimpleDialog>
      )}
      {modal?.type === "title" && (
        <TitleSheet
          title={modal.title}
          profile={profile}
          onClose={closeContentDestination}
          onPlay={playTitle}
          onOpenRelated={openTitle}
        />
      )}
      {modal?.type === "person" && (
        <PersonSheet
          name={modal.name}
          externalId={modal.externalId}
          onClose={closeContentDestination}
          onOpen={openTitle}
        />
      )}
      {modal?.type === "collection" && (
        <CollectionSheet
          name={modal.name}
          titleIds={modal.titleIds}
          externalId={modal.externalId}
          onClose={closeContentDestination}
          onOpen={openTitle}
        />
      )}
      {modal?.type === "protect-child" && (
        <SimpleDialog
          title={`Protect ${modal.profile.name} first`}
          onClose={() => setModal(null)}
        >
          <p className="leading-7 text-white/54">
            Every child profile needs an exit PIN before it can be opened. Set
            one in Family so a child can never get trapped—or leave without a
            grown-up.
          </p>
          <button
            onClick={() => {
              setModal(null);
              navigate("family");
            }}
            className="mt-6 min-h-12 rounded-full bg-white px-6 text-sm font-bold text-black"
          >
            Open Family
          </button>
        </SimpleDialog>
      )}
    </div>
  );
}

function ProfileSessionEntry({ profiles, busy, error, onSelect, embedded = false, deviceAuthorized = true }: {
  profiles: ExperienceProfile[];
  busy: boolean;
  error: string;
  onSelect(id: string, pin?: string): Promise<void>;
  embedded?: boolean;
  deviceAuthorized?: boolean;
}) {
  const [selected, setSelected] = useState(profiles.length === 1 ? profiles[0].id : "");
  const [pin, setPin] = useState("");
  const [pairing, setPairing] = useState(false);
  const [pairError, setPairError] = useState("");
  const target = profiles.find((item) => item.id === selected);
  const needsPin = Boolean(target?.pinEnabled && !target.isChild);
  return <div className={embedded ? "" : "reelos-world flex min-h-[100dvh] w-full flex-col items-center justify-center p-4 sm:p-8 text-white overflow-y-auto overscroll-contain"}
    style={{ "--reelos-favorite": target?.color || "#f5c518" } as CSSProperties}>
    {!embedded && <div className="reelos-profile-aura" aria-hidden="true" />}
    <form className={embedded ? "relative mx-auto w-full max-w-xl" : "reelos-luxury-card relative mx-auto my-auto w-full max-w-md rounded-[2.5rem] p-6 sm:p-8 transition-all duration-300"} onSubmit={(event) => {
      event.preventDefault();
      if (target && !busy) void onSelect(target.id, needsPin ? pin : undefined).then(() => setPin(""));
    }}>
      {!embedded && (
        <div className="mb-6 text-center space-y-1">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white/95">Who's watching?</h1>
          <p className="text-xs text-white/50">Select your resident space</p>
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
        {profiles.map((item) => {
          const isSelected = selected === item.id;
          return (
            <button
              key={item.id}
              type="button"
              disabled={busy}
              aria-pressed={isSelected}
              onClick={() => { setSelected(item.id); setPin(""); }}
              className={`min-h-24 min-w-24 sm:min-w-28 rounded-3xl border px-4 py-3.5 text-center transition-all duration-200 active:scale-95 cursor-pointer ${
                isSelected
                  ? "border-[#f5c518]/90 bg-[#f5c518]/15 shadow-[0_0_24px_rgba(245,197,24,0.25)] scale-[1.03]"
                  : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
              }`}
            >
              <span
                className="mx-auto mb-2.5 block size-8 rounded-full shadow-[0_0_12px_rgba(0,0,0,0.5)] transition-transform duration-200"
                style={{ backgroundColor: item.color }}
              />
              <span className="block text-xs sm:text-sm font-medium tracking-tight text-white/90">{item.name}</span>
            </button>
          );
        })}
      </div>

      {needsPin && (
        <div className="mt-7 flex flex-col items-center space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#f5c518]/90">
            <Lock className="size-3.5" />
            <span>Enter Passcode</span>
          </div>
          <LuxuryPinInput
            value={pin}
            onChange={(val) => setPin(val)}
            length={4}
            disabled={busy}
            autoFocus
            onComplete={(fullPin) => {
              if (target && !busy && deviceAuthorized) {
                void onSelect(target.id, fullPin).then(() => setPin(""));
              }
            }}
          />
        </div>
      )}

      {!deviceAuthorized && (
        <div className="mt-7 rounded-3xl border border-white/10 bg-white/[0.035] p-5 text-center shadow-inner">
          <p className="text-xs sm:text-sm leading-relaxed text-white/70">
            Connect this phone, TV, or computer to your home once. It stays private to this household.
          </p>
          <button
            type="button"
            disabled={pairing}
            onClick={() => {
              setPairing(true);
              setPairError("");
              void fetch("/api/gate/pair-lan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
              })
                .then(async (response) => {
                  const result = (await response.json()) as { ok?: boolean; error?: string };
                  if (!response.ok || !result.ok) throw new Error(result.error || "This device could not connect.");
                  window.location.reload();
                })
                .catch((reason: unknown) => {
                  setPairError(reason instanceof Error ? reason.message : "This device could not connect.");
                  setPairing(false);
                });
            }}
            className="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl bg-white px-6 font-semibold text-black transition-all hover:bg-white/90 active:scale-[0.98] disabled:opacity-40 cursor-pointer"
          >
            {pairing ? "Connecting…" : "Connect this device"}
          </button>
          {pairError && <p role="alert" className="mt-3 text-sm text-rose-300">{pairError}</p>}
        </div>
      )}

      {(error || (!deviceAuthorized && !pairError)) && <p role="alert" className="mt-4 text-center text-sm text-rose-300">{error}</p>}

      <button
        type="submit"
        disabled={!deviceAuthorized || !target || busy || (needsPin && pin.length !== 4)}
        className="mt-7 flex min-h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#f5c518] to-[#e6b40e] px-6 text-base font-bold text-black shadow-[0_4px_20px_rgba(245,197,24,0.3)] transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
      >
        {busy ? "Opening…" : "Continue"}
      </button>
    </form>
  </div>;
}

function Shell({
  view,
  profile,
  profiles,
  kidsPresent,
  profileOpen,
  onProfileOpen,
  onNavigate,
  onSearch,
  onProfile,
  onKids,
  onProtectedNavigate,
}: {
  view: ExperienceView;
  profile: ExperienceProfile;
  profiles: ExperienceProfile[];
  kidsPresent: boolean;
  profileOpen: boolean;
  onProfileOpen(): void;
  onNavigate(view: ExperienceView): void;
  onSearch(): void;
  onProfile(id: string): void;
  onKids(): void;
  onProtectedNavigate(view: ExperienceView): void;
}) {
  const tvPlatform = nativePlatform() === "android-tv";
  const navigation = visibleNavigation();
  return (
    <header
      className={`reelos-world-header top-0 z-40 w-full px-5 md:px-10 ${
        view === "home"
          ? "absolute border-transparent bg-transparent"
          : `sticky border-b border-white/[.07] bg-[#080809]/92 ${tvPlatform ? "" : "backdrop-blur-2xl"}`
      }`}
    >
      <div className="mx-auto flex h-[76px] max-w-[1600px] items-center justify-between gap-4">
        <button
          onClick={() => onNavigate("home")}
          className="flex min-h-12 items-center gap-3"
        >
          <span
            className="grid size-9 place-items-center rounded-full text-sm font-black text-[#0b0b0d]"
            style={{
              backgroundColor: profile.color,
              boxShadow: `0 0 24px ${profile.color}44`,
            }}
          >
            R
          </span>
          <span className={`font-display text-lg font-bold tracking-tight ${view === "home" ? "hidden sm:inline" : ""}`}>
            ReelOS
          </span>
        </button>
        <nav className={`${tvPlatform ? "flex" : "hidden lg:flex"} items-center gap-1`} aria-label="Primary">
          {navigation.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex min-h-12 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${view === id ? "bg-white/10 text-white" : "text-white/52 hover:text-white"}`}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </nav>
        <div className="relative flex items-center gap-2">
          <button
            onClick={onSearch}
            aria-label="Find anything"
            className={`grid size-12 place-items-center rounded-full border border-white/12 bg-black/35 text-white/75 hover:border-white/35 ${tvPlatform ? "" : "backdrop-blur-xl"}`}
          >
            <Search className="size-4" />
          </button>
          <button
            onClick={onKids}
            className={`hidden min-h-12 rounded-full border px-4 text-xs font-semibold sm:block ${kidsPresent ? "border-transparent text-[#0a1010]" : `border-white/12 bg-black/35 text-white/70 ${tvPlatform ? "" : "backdrop-blur-xl"}`}`}
            style={kidsPresent ? { backgroundColor: profile.color } : undefined}
          >
            {kidsPresent ? "Kids here" : "Adults only"}
          </button>
          <button
            onClick={onProfileOpen}
            aria-label="Change profile"
            className="grid size-12 place-items-center rounded-full font-bold text-[#0b0b0d]"
            style={{ backgroundColor: profile.color }}
          >
            {profile.name.slice(0, 1)}
          </button>
          {profileOpen && (
            <div className={`absolute right-0 top-14 max-h-[calc(100dvh-10rem)] w-[min(350px,calc(100vw-32px))] overflow-y-auto overscroll-contain rounded-[1.6rem] border border-white/12 bg-[#141419]/96 p-3 shadow-2xl ${tvPlatform ? "" : "backdrop-blur-2xl"}`}>
              <p className="px-3 pb-2 pt-1 text-xs text-white/42">
                Who’s here?
              </p>
              {profiles.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onProfile(item.id)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left hover:bg-white/7"
                >
                  <span
                    className="grid size-9 place-items-center rounded-full text-sm font-bold text-[#0b0b0d]"
                    style={{ backgroundColor: item.color }}
                  >
                    {item.name[0]}
                  </span>
                  <span className="flex-1">
                    <b className="block text-sm">{item.name}</b>
                    <small className="text-white/42">
                      {item.isChild
                        ? "Their safe cinema"
                        : item.isGuest
                          ? "A fresh start"
                          : "Their own taste"}
                    </small>
                  </span>
                  {item.id === profile.id && <Check className="size-4" />}
                </button>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/8 pt-3">
                <button
                  onClick={() => onProtectedNavigate("profile")}
                  className="min-h-11 rounded-xl bg-white/7 text-sm"
                >
                  Your profile
                </button>
                <button
                  onClick={() => onProtectedNavigate("family")}
                  className="min-h-11 rounded-xl bg-white/7 text-sm"
                >
                  Family
                </button>
                <button
                  onClick={() => onProtectedNavigate("settings")}
                  className="min-h-11 rounded-xl bg-white/7 text-sm"
                >
                  Settings
                </button>
                <button
                  onClick={() => onProtectedNavigate("devices")}
                  className="min-h-11 rounded-xl bg-white/7 text-sm"
                >
                  Devices
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MobileNav({
  view,
  onNavigate,
}: {
  view: ExperienceView;
  onNavigate(view: ExperienceView): void;
}) {
  if (nativePlatform() === "android-tv") return null;
  const navigation = visibleNavigation();
  return (
    <nav
      className="reelos-mobile-nav fixed inset-x-3 z-40 mx-auto grid max-w-2xl grid-cols-4 rounded-[1.5rem] border border-white/10 bg-[#111116]/86 p-1.5 shadow-2xl backdrop-blur-2xl lg:hidden"
      aria-label="Primary navigation"
    >
      {navigation.map(([id, label, Icon]) => (
        <button
          key={id}
          onClick={() => onNavigate(id)}
          className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1.15rem] text-[11px] ${view === id ? "bg-white/10 text-white" : "text-white/48"}`}
        >
          <Icon className="size-4" /> {label}
        </button>
      ))}
    </nav>
  );
}

const PosterCard = memo(function PosterCard({
  title,
  onOpen,
  className = "",
}: {
  title: ExperienceTitle;
  onOpen(title: ExperienceTitle): void;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const tvPlatform = nativePlatform() === "android-tv";
  const activeProfileId = useExperienceStore((state) => state.activeProfileId);
  const profile = useExperienceStore((state) =>
    state.profiles.find((item) => item.id === state.activeProfileId),
  );
  const react = useExperienceStore((state) => state.react);
  const toggleLessLike = useExperienceStore((state) => state.toggleLessLike);
  const liked = profile?.reactions[title.id] === "like";
  const lessLike = profile?.lessLikeIds.includes(title.id) ?? false;
  return (
    <article
      className={`group relative aspect-[.68] min-w-0 overflow-hidden rounded-[1.15rem] bg-white/6 text-left ${className}`}
    >
      <button
        onClick={() => onOpen(title)}
        aria-label={`Open ${title.title}`}
        className="absolute inset-0 text-left"
      >
        {!failed && title.poster ? (
          <img
            src={title.poster}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-[1.035] group-focus-within:scale-[1.035]"
          />
        ) : (
          <ArtworkFallback title={title.title} />
        )}
        <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/5 to-transparent opacity-80" />
        <span className="absolute inset-x-3 bottom-3 translate-y-1 transition group-hover:translate-y-0 group-focus-within:translate-y-0">
          <b className="block text-sm leading-tight">{title.title}</b>
          <small className="mt-1 block text-white/52">
            {title.year} ·{" "}
            {title.kind === "series" ? "Series" : title.genres[0]}
          </small>
        </span>
      </button>
      <div className="absolute right-2 top-2 z-10 flex gap-1.5 opacity-100">
        <button
          onClick={() =>
            react(activeProfileId, title.id, liked ? undefined : "like")
          }
          aria-label={`${liked ? "Remove like from" : "Like"} ${title.title}`}
          aria-pressed={liked}
          className={`grid size-12 place-items-center rounded-full ${tvPlatform ? "" : "backdrop-blur-xl"} ${liked ? "bg-white text-black" : "bg-black/72 text-white"}`}
        >
          <Check className="size-4" />
        </button>
        <button
          onClick={() => toggleLessLike(activeProfileId, title.id)}
          aria-label={`${lessLike ? "Undo less like this for" : "Less like"} ${title.title}`}
          aria-pressed={lessLike}
          className={`grid size-12 place-items-center rounded-full ${tvPlatform ? "" : "backdrop-blur-xl"} ${lessLike ? "bg-white text-black" : "bg-black/72 text-white"}`}
        >
          <ThumbsDown className="size-4" />
        </button>
      </div>
    </article>
  );
});

function ArtworkFallback({ title }: { title: string }) {
  const hue =
    [...title].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 360;
  return (
    <span
      aria-hidden="true"
      className="absolute inset-0"
      style={{
        background: `radial-gradient(circle at 30% 20%, hsl(${hue} 72% 46% / .7), transparent 45%), linear-gradient(145deg,hsl(${hue + 40} 45% 18%),#09090b)`,
      }}
    />
  );
}

function Shelf({
  title,
  note,
  items,
  onOpen,
  onSeeAll,
}: {
  title: string;
  note?: string;
  items: ExperienceTitle[];
  onOpen(title: ExperienceTitle): void;
  onSeeAll?(): void;
}) {
  if (!items.length) return null;
  const tvPlatform = nativePlatform() === "android-tv";
  return (
    <section
      className="reelos-world-shelf"
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 420px" }}
    >
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-[clamp(1.65rem,3vw,2.5rem)] font-semibold leading-none tracking-[-.055em]">
            {title}
          </h2>
          {note && <p className="mt-2 text-sm text-white/44">{note}</p>}
        </div>
        {onSeeAll && (
          <button
            onClick={onSeeAll}
            className="min-h-12 shrink-0 rounded-full px-3 text-sm text-white/58 hover:text-white"
          >
            See all
          </button>
        )}
      </div>
      <div className={`reelos-poster-row gap-3 ${tvPlatform
        ? "grid grid-cols-6 overflow-visible"
        : "-mx-5 flex snap-x snap-mandatory overflow-x-auto px-5 pb-2 md:-mx-10 md:px-10 lg:mx-0 lg:grid lg:grid-cols-6 lg:overflow-visible lg:px-0 lg:pb-0"
      }`}>
        {items.slice(0, 6).map((item) => (
          <PosterCard key={item.id} title={item} onOpen={onOpen} className={tvPlatform
            ? "w-auto max-w-none"
            : "w-[44vw] max-w-52 shrink-0 snap-start sm:w-[30vw] lg:w-auto lg:max-w-none"
          } />
        ))}
      </div>
    </section>
  );
}

function HomeWorld({
  profile,
  titles,
  kidsPresent,
  liveProgress,
  onOpen,
  onPlay,
  onSearch,
  onNavigate,
}: {
  profile: ExperienceProfile;
  titles: ExperienceTitle[];
  kidsPresent: boolean;
  liveProgress: Record<string, number>;
  onOpen(title: ExperienceTitle): void;
  onPlay(title: ExperienceTitle): void;
  onSearch(query?: string): void;
  onNavigate(view: ExperienceView): void;
}) {
  const tvPlatform = nativePlatform() === "android-tv";
  const toggleSaved = useExperienceStore((state) => state.toggleSaved);
  const [heroArtIndex, setHeroArtIndex] = useState(0);
  const debrid = useExperienceStore((state) => state.debrid);
  const hero =
    titles.find((title) => title.backdrop) ??
    titles[0] ??
    EXPERIENCE_CATALOG[0];
  const heroAccessible = experienceTitleIsAccessible(hero, debrid);
  const heroArtwork = useMemo(
    () =>
      Array.from(
        new Set(
          [hero.backdrop, hero.poster].filter(
            (candidate): candidate is string => Boolean(candidate),
          ),
        ),
      ),
    [hero.backdrop, hero.poster],
  );
  const heroArt = heroArtwork[heroArtIndex];
  useEffect(() => setHeroArtIndex(0), [hero.id, hero.backdrop, hero.poster]);
  const suggestions = titles
    .filter((title) => title.id !== hero.id)
    .slice(0, 6);
  const titleById = useMemo(
    () => new Map(titles.map((title) => [title.id, title])),
    [titles],
  );
  const continueTitles = Object.entries({
    ...profile.progress,
    ...liveProgress,
  })
    .sort((left, right) => right[1] - left[1])
    .map(([id]) => titleById.get(id))
    .filter((title): title is ExperienceTitle => Boolean(title))
    .slice(0, 6);
  return (
    <main className="pb-28 lg:pb-16">
      <section className="relative min-h-[clamp(30rem,76svh,34rem)] overflow-hidden md:min-h-[590px]">
        {heroArt ? (
          <img
            src={heroArt}
            alt=""
            decoding="async"
            fetchPriority="high"
            onError={() => setHeroArtIndex((index) => index + 1)}
            className={`absolute inset-0 size-full object-cover opacity-85 ${tvPlatform ? "reelos-tv-living-art" : ""}`}
          />
        ) : (
          <ArtworkFallback title={hero.title} />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,8,9,.9)_0%,rgba(8,8,9,.5)_48%,rgba(8,8,9,.08)),linear-gradient(0deg,#080809_0%,transparent_50%)]" />
        <div
          className="reelos-art-haze absolute inset-0 opacity-60"
          style={{
            background: `radial-gradient(circle at 70% 45%,${profile.color}2d,transparent 42%)`,
          }}
        />
        <div className="relative mx-auto flex min-h-[clamp(30rem,76svh,34rem)] max-w-[1600px] items-end px-5 pb-16 md:min-h-[590px] md:px-10 md:pb-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[.22em] text-white/48">
              {kidsPresent
                ? "Tonight together"
                : `For ${profile.name}, right now`}
            </p>
            <h1 className="mt-4 max-w-[12ch] font-display text-[clamp(3.05rem,12vw,8.8rem)] font-semibold leading-[.88] tracking-[-.068em] md:leading-[.82] md:tracking-[-.078em]">
              {hero.title}
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-white/64">
              {whyThisTitle(hero, profile)}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                onClick={() => (heroAccessible ? onPlay(hero) : onOpen(hero))}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-black"
              >
                {heroAccessible ? (
                  <>
                    <Play className="size-4 fill-current" /> Play now
                  </>
                ) : (
                  <>View details</>
                )}
              </button>
              {heroAccessible && (
                <button
                  onClick={() => toggleSaved(profile.id, hero.id)}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/18 bg-black/20 px-6 text-sm font-semibold backdrop-blur"
                >
                  <Bookmark
                    className={`size-4 ${profile.savedIds.includes(hero.id) ? "fill-current" : ""}`}
                  />
                  {profile.savedIds.includes(hero.id) ? "Saved" : "Save"}
                </button>
              )}
              {heroAccessible && (
                <button
                  onClick={() => onOpen(hero)}
                  className="min-h-12 rounded-full border border-white/18 px-5 text-sm text-white/72"
                >
                  Details
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-8 max-w-[1600px] space-y-16 px-5 md:px-10">
        <button
          onClick={() => onSearch()}
          className="reelos-search-prompt flex min-h-20 w-full items-center gap-4 rounded-[1.4rem] border border-white/10 bg-[#141419]/92 px-5 text-left shadow-2xl backdrop-blur-xl md:px-7"
        >
          <Search
            className="size-5 shrink-0"
            style={{ color: profile.color }}
          />
          <span className="min-w-0 flex-1">
            <b className="block text-base">Find anything.</b>
            <span className="mt-1 block text-sm text-white/45">
              A title, actor, feeling, exclusion, or half-remembered scene.
            </span>
          </span>
          <ChevronRight className="size-5 text-white/32" />
        </button>

        <Shelf
          title="Continue."
          note={
            Object.keys(liveProgress).length
              ? "Exactly where the box says you stopped—not a guessed percentage."
              : `Progress saved to ${possessive(profile.name)} profile. The box has not reported a resume point.`
          }
          items={continueTitles}
          onOpen={onOpen}
        />

        <Shelf
          title="A few good bets."
          note={`Shaped by ${possessive(profile.name)} taste, without hiding the rest of cinema.`}
          items={suggestions}
          onOpen={onOpen}
          onSeeAll={() => onNavigate("discover")}
        />

        <Shelf
          title="Public domain classics."
          note="Restored, lossless, and ready to play right now without external services."
          items={PUBLIC_DOMAIN_TITLES}
          onOpen={onOpen}
        />

        <NoIdeaChooser
          profile={profile}
          titles={titles}
          debrid={debrid}
          kidsPresent={kidsPresent}
          onOpen={onOpen}
          onPlay={onPlay}
          onDiscover={() => onNavigate("discover")}
        />
      </div>
    </main>
  );
}

function NoIdeaChooser({
  profile,
  titles,
  debrid,
  kidsPresent,
  onOpen,
  onPlay,
  onDiscover,
}: {
  profile: ExperienceProfile;
  titles: ExperienceTitle[];
  debrid: ReturnType<typeof useExperienceStore.getState>["debrid"];
  kidsPresent: boolean;
  onOpen(title: ExperienceTitle): void;
  onPlay(title: ExperienceTitle): void;
  onDiscover(): void;
}) {
  const setTonight = useExperienceStore((state) => state.setTonight);
  const react = useExperienceStore((state) => state.react);
  const toggleLessLike = useExperienceStore((state) => state.toggleLessLike);
  const [stage, setStage] = useState<"idle" | "clues" | "options" | "results">(
    "idle",
  );
  const [clueKind, setClueKind] = useState<"mood" | "duration" | "company">(
    "mood",
  );
  const [clue, setClue] = useState<DecisionClue>({ kind: "none" });
  const [exploration, setExploration] = useState(profile.exploration);
  const [offset, setOffset] = useState(0);
  const accessible = useMemo(
    () => titles.filter((title) => experienceTitleIsAccessible(title, debrid)),
    [titles, debrid],
  );
  const picks = useMemo(
    () =>
      buildDecisionPicks({
        profile,
        titles: accessible,
        availableIds: accessible.map((title) => title.id),
        clue: kidsPresent
          ? { kind: "company", value: "kids", label: "Kids are here" }
          : clue,
        exploration,
        offset,
      }),
    [profile, titles, accessible, clue, exploration, offset, kidsPresent],
  );

  const decide = (nextClue: DecisionClue, nextExploration = exploration) => {
    setClue(nextClue);
    setExploration(nextExploration);
    setOffset(0);
    if (nextClue.kind === "mood") setTonight({ mood: nextClue.value });
    if (nextClue.kind === "duration") setTonight({ duration: nextClue.value });
    setTonight({ exploration: nextExploration });
    setStage("results");
  };
  const primary = picks[0];

  const options: Record<
    "mood" | "duration" | "company",
    Array<{ label: string; clue: DecisionClue }>
  > = {
    mood: [
      {
        label: "Comfort me",
        clue: { kind: "mood", value: "comfort", label: "Something comforting" },
      },
      {
        label: "Make me laugh",
        clue: { kind: "mood", value: "funny", label: "Something funny" },
      },
      {
        label: "Give me wonder",
        clue: { kind: "mood", value: "wonder", label: "A sense of wonder" },
      },
      {
        label: "Put me on edge",
        clue: { kind: "mood", value: "edge", label: "Something with an edge" },
      },
      {
        label: "Quiet, please",
        clue: { kind: "mood", value: "quiet", label: "Something quiet" },
      },
    ],
    duration: [
      {
        label: "Under 100 minutes",
        clue: { kind: "duration", value: "short", label: "Under 100 minutes" },
      },
      {
        label: "A proper feature",
        clue: { kind: "duration", value: "feature", label: "A proper feature" },
      },
      {
        label: "I have all night",
        clue: { kind: "duration", value: "long", label: "All night" },
      },
    ],
    company: [
      {
        label: "Just me",
        clue: { kind: "company", value: "solo", label: "Just me" },
      },
      {
        label: "A few of us",
        clue: { kind: "company", value: "together", label: "A few of us" },
      },
      {
        label: "Kids are here",
        clue: { kind: "company", value: "kids", label: "Kids are here" },
      },
    ],
  };

  return (
    <section className="reelos-no-idea relative min-h-[24rem] overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.025] px-6 py-8 md:px-10 md:py-10">
      <div className="relative z-10 max-w-2xl">
        {stage === "idle" && (
          <>
            <h2 className="font-display text-[clamp(2.2rem,4vw,3.8rem)] font-semibold leading-[.92] tracking-[-.06em]">
              No idea what to watch?
            </h2>
            <p className="mt-5 max-w-lg leading-7 text-white/52">
              Don’t browse harder. Hand ReelOS the decision—or give it exactly
              one clue.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => decide({ kind: "none" }, "balanced")}
                className="min-h-12 rounded-full bg-white px-6 text-sm font-bold text-black"
              >
                Decide for me
              </button>
              <button
                onClick={() => setStage("clues")}
                className="min-h-12 rounded-full border border-white/15 px-6 text-sm font-semibold"
              >
                I can give you one clue
              </button>
              <button
                onClick={() => decide({ kind: "none" }, "familiar")}
                className="min-h-12 rounded-full border border-white/15 px-6 text-sm font-semibold"
              >
                Keep it close to home
              </button>
            </div>
          </>
        )}

        {stage === "clues" && (
          <>
            <button
              onClick={() => setStage("idle")}
              className="min-h-12 text-sm text-white/52"
            >
              <ArrowLeft className="mr-2 inline size-4" /> Back
            </button>
            <h2 className="mt-3 font-display text-[clamp(2.5rem,5vw,4.7rem)] font-semibold leading-[.9] tracking-[-.065em]">
              What do you know?
            </h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["mood", "How it should feel", "The emotional answer."],
                  ["duration", "How much time", "No accidental epic."],
                  ["company", "Who is here", "A choice the room can share."],
                ] as const
              ).map(([kind, label, note]) => (
                <button
                  key={kind}
                  onClick={() => {
                    setClueKind(kind);
                    setStage("options");
                  }}
                  className="min-h-36 rounded-[1.4rem] bg-black/24 p-5 text-left ring-1 ring-white/10 transition hover:bg-white/8"
                >
                  <b className="block text-lg">{label}</b>
                  <span className="mt-2 block text-sm leading-6 text-white/42">
                    {note}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {stage === "options" && (
          <>
            <button
              onClick={() => setStage("clues")}
              className="min-h-12 text-sm text-white/52"
            >
              <ArrowLeft className="mr-2 inline size-4" /> Back
            </button>
            <h2 className="mt-3 font-display text-[clamp(2.5rem,5vw,4.7rem)] font-semibold leading-[.9] tracking-[-.065em]">
              One clue is enough.
            </h2>
            <div className="mt-8 flex flex-wrap gap-3">
              {options[clueKind].map((option) => (
                <button
                  key={option.label}
                  onClick={() => decide(option.clue, "balanced")}
                  className="min-h-12 rounded-full border border-white/15 bg-black/20 px-5 text-sm"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        )}

        {stage === "results" && primary && (
          <>
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-white/42">
              ReelOS would stop here
            </p>
            <h2 className="mt-3 font-display text-[clamp(3rem,6vw,5.8rem)] font-semibold leading-[.86] tracking-[-.07em]">
              {primary.title.title}
            </h2>
            <p className="mt-5 max-w-lg leading-7 text-white/54">
              {primary.reason}{" "}
              {!experienceTitleIsAccessible(primary.title, debrid) &&
                "It matches the clue, but it is not available from your current sources yet."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() =>
                  experienceTitleIsAccessible(primary.title, debrid)
                    ? onPlay(primary.title)
                    : onOpen(primary.title)
                }
                className="min-h-12 rounded-full bg-white px-6 text-sm font-bold text-black"
              >
                {experienceTitleIsAccessible(primary.title, debrid)
                  ? "Play this"
                  : "See how to watch"}
              </button>
              <button
                onClick={() => setOffset((value) => value + 3)}
                className="min-h-12 rounded-full border border-white/15 px-5 text-sm"
              >
                Give me three more
              </button>
              <button
                onClick={() => setStage("idle")}
                className="min-h-12 px-3 text-sm text-white/45"
              >
                Start over
              </button>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-white/48">
              <span className="mr-1">Was that a good instinct?</span>
              <button
                onClick={() =>
                  react(
                    profile.id,
                    primary.title.id,
                    profile.reactions[primary.title.id] === "like"
                      ? undefined
                      : "like",
                  )
                }
                aria-pressed={profile.reactions[primary.title.id] === "like"}
                className={`min-h-12 rounded-full px-4 text-sm transition ${profile.reactions[primary.title.id] === "like" ? "bg-white text-black" : "bg-white/8 text-white hover:bg-white/14"}`}
              >
                {profile.reactions[primary.title.id] === "like"
                  ? "Liked"
                  : "Like this"}
              </button>
              <button
                onClick={() => toggleLessLike(profile.id, primary.title.id)}
                aria-pressed={profile.lessLikeIds.includes(primary.title.id)}
                className={`min-h-12 rounded-full px-4 text-sm transition ${profile.lessLikeIds.includes(primary.title.id) ? "bg-white text-black" : "bg-white/8 text-white hover:bg-white/14"}`}
              >
                {profile.lessLikeIds.includes(primary.title.id)
                  ? "Undo less like this"
                  : "Less like this"}
              </button>
            </div>
            {picks.length > 1 && (
              <div className="mt-9 flex gap-3">
                {picks.slice(1).map((pick) => (
                  <button
                    key={pick.title.id}
                    onClick={() => onOpen(pick.title)}
                    className="flex min-h-20 flex-1 items-center gap-3 rounded-2xl bg-black/24 p-3 text-left ring-1 ring-white/8"
                  >
                    {pick.title.poster && (
                      <img
                        src={pick.title.poster}
                        alt=""
                        className="h-16 w-11 rounded-lg object-cover"
                      />
                    )}
                    <span>
                      <b className="block text-sm">{pick.title.title}</b>
                      <span className="mt-1 block text-xs text-white/42">
                        Another honest answer
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {stage === "results" && !primary && (
          <>
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-white/42">
              Nothing ready yet
            </p>
            <h2 className="mt-3 max-w-xl font-display text-[clamp(2.9rem,6vw,5.8rem)] font-semibold leading-[.86] tracking-[-.07em]">
              This home needs something it can actually play.
            </h2>
            <p className="mt-5 max-w-lg leading-7 text-white/54">
              Your taste can still grow from anything you love. Add a verified
              public or personal source when you are ready, then ReelOS can
              make a real choice for tonight.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={onDiscover}
                className="min-h-12 rounded-full bg-white px-6 text-sm font-bold text-black"
              >
                Explore anyway
              </button>
              <button
                onClick={() => setStage("idle")}
                className="min-h-12 rounded-full border border-white/15 px-5 text-sm"
              >
                Start over
              </button>
            </div>
          </>
        )}
      </div>
      <FallingArtwork titles={titles.slice(7, 19)} />
    </section>
  );
}

function FallingArtwork({ titles }: { titles: ExperienceTitle[] }) {
  const colSpeedClasses = [
    "reelos-falling-col-slow",
    "reelos-falling-col-mid",
    "reelos-falling-col-fast",
  ];
  return (
    <div
      className="reelos-falling-art pointer-events-none absolute -bottom-24 right-[-5%] hidden h-[135%] w-[48%] rotate-[8deg] grid-cols-3 gap-3 opacity-65 md:grid"
      aria-hidden="true"
    >
      {[0, 1, 2].map((colIndex) => {
        const columnItems = titles.filter((_, i) => i % 3 === colIndex);
        const colTitles = columnItems.length > 0 ? [...columnItems, ...columnItems] : titles.slice(0, 6);
        return (
          <div
            key={colIndex}
            className={`reelos-falling-column ${colSpeedClasses[colIndex]}`}
          >
            {colTitles.map((title, itemIdx) => (
              <img
                key={`${title.id}-${colIndex}-${itemIdx}`}
                src={title.poster}
                alt=""
                loading="lazy"
                decoding="async"
                className="aspect-[.68] w-full rounded-2xl object-cover shadow-2xl"
              />
            ))}
          </div>
        );
      })}
      <span className="absolute inset-0 bg-gradient-to-r from-[#0c0c0f] via-transparent to-transparent pointer-events-none" />
    </div>
  );
}

function DiscoverWorld({
  profile,
  titles,
  onOpen,
  onSearch,
  onRefine,
  onPerson,
  onCollection,
}: {
  profile: ExperienceProfile;
  titles: ExperienceTitle[];
  onOpen(title: ExperienceTitle): void;
  onSearch(query?: string): void;
  onRefine(): void;
  onPerson(name: string): void;
  onCollection(name: string, ids: string[]): void;
}) {
  const tonight = useExperienceStore((state) => state.tonight);
  const setTonight = useExperienceStore((state) => state.setTonight);
  const clearTonight = useExperienceStore((state) => state.clearTonight);
  const hero =
    titles.find((title) => title.id !== profile.savedIds[0]) ?? titles[0];
  const paths = [
    {
      id: "quiet",
      label: "Quietly strange",
      note: "Arrival · Her · Severance",
      ids: ["arrival", "her", "severance"],
    },
    {
      id: "comfort",
      label: "Warm, never sugary",
      note: "The Holdovers · Amélie · Totoro",
      ids: ["holdovers", "amelie", "my-neighbor-totoro"],
    },
    {
      id: "kinetic",
      label: "Make the home feel bigger",
      note: "Fury Road · Dune · Spider-Verse",
      ids: ["mad-max-fury-road", "tmdb-movie-693134", "spider-verse"],
    },
  ];
  const people = ["Florence Pugh", "Ayo Edebiri", "Ryan Gosling", "Zendaya"];
  const selectShelf = (
    excluded: Set<string>,
    matches: (title: ExperienceTitle) => boolean,
  ) =>
    titles
      .filter((title) => !excluded.has(title.id) && matches(title))
      .slice(0, 6);
  const beautifulTrouble = selectShelf(
    new Set(),
    (title) =>
      title.moods.some((mood) =>
        ["beautiful", "tense", "colorful", "dark"].includes(mood),
      ),
  );
  const afterMidnight = selectShelf(
    new Set(beautifulTrouble.map((title) => title.id)),
    (title) =>
      title.moods.some((mood) =>
        ["late night", "rainy", "patient", "cerebral"].includes(mood),
      ),
  );
  const kindOnes = selectShelf(
    new Set([...beautifulTrouble, ...afterMidnight].map((title) => title.id)),
    (title) =>
      title.family ||
      title.moods.some((mood) =>
        ["warm", "comfort", "gentle"].includes(mood),
      ),
  );
  const shelves = [
    {
      name: "Beautiful trouble",
      note: "Color, tension, and a world with edges.",
      items: beautifulTrouble,
    },
    {
      name: "A little after midnight",
      note: "Patient mysteries with a world of their own.",
      items: afterMidnight,
    },
    {
      name: "The kind ones",
      note: "Comfort with craft, not background noise.",
      items: kindOnes,
    },
  ];
  const activeCount = [
    tonight.mood,
    tonight.person,
    tonight.duration !== "any",
    tonight.kind !== "all",
    tonight.exploration !== "balanced",
  ].filter(Boolean).length;
  return (
    <main className="mx-auto max-w-[1600px] space-y-16 px-5 pb-28 pt-7 md:px-10 md:pt-10 lg:pb-20">
      <section className="relative min-h-[520px] overflow-hidden rounded-[2rem] bg-white/[.035] md:min-h-[600px]">
        <img
          src={hero.backdrop}
          alt=""
          decoding="async"
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover opacity-72"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,8,9,.97),rgba(8,8,9,.52)_52%,rgba(8,8,9,.08)),linear-gradient(0deg,rgba(8,8,9,.7),transparent_45%)]" />
        <div className="relative flex min-h-[520px] max-w-xl flex-col justify-end p-7 md:min-h-[600px] md:p-12">
          <p className="text-sm text-white/54">{whyThisTitle(hero, profile)}</p>
          <h1 className="mt-4 font-display text-[clamp(3.8rem,7vw,7.2rem)] font-semibold leading-[.84] tracking-[-.075em]">
            {hero.title}
          </h1>
          <p className="mt-5 max-w-md leading-7 text-white/60">{hero.note}</p>
          <button
            onClick={() => onOpen(hero)}
            className="mt-7 inline-flex min-h-12 w-fit items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-black"
          >
            Open this door <ChevronRight className="size-4" />
          </button>
        </div>
      </section>

      <section>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => onSearch()}
            className="flex min-h-14 flex-1 items-center gap-3 rounded-full bg-white/7 px-5 text-left text-sm text-white/60"
          >
            <Search className="size-4" />
            Search a title, person, mood, or memory
          </button>
          <button
            onClick={onRefine}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-white/12 px-5 text-sm font-semibold"
          >
            <SlidersHorizontal className="size-4" />
            Refine{activeCount ? ` · ${activeCount}` : ""}
          </button>
        </div>
        {activeCount > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/56">
            <span>Tonight:</span>
            {tonight.mood && (
              <span className="rounded-full bg-white/8 px-3 py-1.5">
                {tonight.mood}
              </span>
            )}
            {tonight.person && (
              <span className="rounded-full bg-white/8 px-3 py-1.5">
                {tonight.person}
              </span>
            )}
            {tonight.duration !== "any" && (
              <span className="rounded-full bg-white/8 px-3 py-1.5">
                {tonight.duration}
              </span>
            )}
            {tonight.kind !== "all" && (
              <span className="rounded-full bg-white/8 px-3 py-1.5">
                {tonight.kind}
              </span>
            )}
            {tonight.exploration !== "balanced" && (
              <span className="rounded-full bg-white/8 px-3 py-1.5">
                {tonight.exploration}
              </span>
            )}
            <button
              onClick={clearTonight}
              className="min-h-8 rounded-full px-2.5 text-xs text-white/70 underline decoration-white/30 underline-offset-4 hover:text-white"
            >
              Clear
            </button>
          </div>
        )}
      </section>

      <section>
        <div className="grid gap-4 md:grid-cols-3">
          {paths.map((path) => (
            <button
              key={path.id}
              onClick={() => {
                setTonight({ mood: path.id });
                onCollection(path.label, path.ids);
              }}
              className="group relative min-h-64 overflow-hidden rounded-[1.7rem] bg-white/[.035] p-6 text-left"
            >
              <div className="absolute -right-5 -top-5 flex w-[55%] -space-x-10 rotate-[7deg] opacity-72 transition duration-700 group-hover:translate-x-[-6px]">
                {path.ids
                  .map((id) => TITLE_BY_EXPERIENCE_ID[id])
                  .filter(Boolean)
                  .map((title) => (
                    <img
                      key={title.id}
                      src={title.poster}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="aspect-[.68] w-24 rounded-xl object-cover shadow-2xl"
                    />
                  ))}
              </div>
              <div className="relative mt-28">
                <b className="font-display text-2xl tracking-[-.045em]">
                  {path.label}
                </b>
                <span className="mt-2 block text-sm text-white/46">
                  {path.note}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <Shelf
        title={shelves[0].name}
        note={shelves[0].note}
        items={shelves[0].items}
        onOpen={onOpen}
        onSeeAll={() =>
          onCollection(
            shelves[0].name,
            shelves[0].items.map((item) => item.id),
          )
        }
      />

      <section className="flex flex-wrap items-center gap-3 rounded-[1.6rem] bg-[linear-gradient(135deg,rgba(239,125,180,.14),rgba(96,121,206,.07))] p-5 md:p-6">
        <span className="mr-1 text-sm text-white/52">Follow a familiar face</span>
        <div className="flex flex-wrap gap-3">
          {people.map((person) => (
            <button
              key={person}
              onClick={() => onPerson(person)}
              className="min-h-12 rounded-full border border-white/13 bg-black/15 px-5 text-sm hover:bg-white/10"
            >
              {person}
            </button>
          ))}
        </div>
      </section>

      <Shelf
        title={shelves[1].name}
        note={shelves[1].note}
        items={shelves[1].items}
        onOpen={onOpen}
        onSeeAll={() =>
          onCollection(
            shelves[1].name,
            shelves[1].items.map((item) => item.id),
          )
        }
      />
      <Shelf
        title={shelves[2].name}
        note={shelves[2].note}
        items={shelves[2].items}
        onOpen={onOpen}
        onSeeAll={() =>
          onCollection(
            shelves[2].name,
            shelves[2].items.map((item) => item.id),
          )
        }
      />

      <section className="relative overflow-hidden rounded-[2rem] border border-white/8 bg-gradient-to-b from-white/[.04] to-black/60 p-8 md:p-12">
        <div className="relative z-10 max-w-xl">
          <p className="text-sm font-semibold text-[var(--reelos-favorite,#d4a017)]">
            Endless Cinema
          </p>
          <h2 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Still looking for the right note?
          </h2>
          <p className="mt-3 text-base text-white/60 leading-relaxed">
            ReelOS continuously watches the edges of cinema. Tell it how tonight feels, or let the current pull you into something unexpected.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <button
              onClick={() => onSearch()}
              className="min-h-12 rounded-full bg-white px-7 text-sm font-bold text-black shadow-lg hover:bg-white/90"
            >
              Ask the concierge
            </button>
            <button
              onClick={onRefine}
              className="min-h-12 rounded-full border border-white/20 bg-white/5 px-6 text-sm font-medium text-white hover:bg-white/10"
            >
              Refine tonight’s temperature
            </button>
          </div>
        </div>
        <FallingArtwork titles={titles} />
      </section>
    </main>
  );
}

function LibraryWorld({
  profile,
  titles,
  originals,
  liveProgress,
  libraryStatus,
  libraryMessage,
  requests,
  onOpen,
  onPlay,
  onNavigate,
}: {
  profile: ExperienceProfile;
  titles: ExperienceTitle[];
  originals: ExperienceTitle[];
  liveProgress: Record<string, number>;
  libraryStatus: LiveLibraryResult["status"];
  libraryMessage?: string;
  requests: ReturnType<typeof useExperienceStore.getState>["requests"];
  onOpen(title: ExperienceTitle): void;
  onPlay(title: ExperienceTitle): void;
  onNavigate(view: ExperienceView): void;
}) {
  const debrid = useExperienceStore((state) => state.debrid);
  const titleById = new Map(titles.map((title) => [title.id, title]));
  const progress = Object.entries({ ...profile.progress, ...liveProgress })
    .map(([id, value]) => ({ title: titleById.get(id), value }))
    .filter(
      (item): item is { title: ExperienceTitle; value: number } =>
        item.title !== undefined &&
        experienceTitleIsAccessible(item.title, debrid),
    );
  const saved = profile.savedIds
    .map((id) => titleById.get(id))
    .filter(
      (title): title is ExperienceTitle =>
        title !== undefined && experienceTitleIsAccessible(title, debrid),
    );
  const reactions = (kind: Reaction) =>
    Object.entries(profile.reactions)
      .filter(([, reaction]) => reaction === kind)
      .map(([id]) => titleById.get(id))
      .filter(
        (title): title is ExperienceTitle =>
          title !== undefined && experienceTitleIsAccessible(title, debrid),
      );
  const activeRequests = Object.values(requests)
    .map((request) => ({
      ...request,
      title: titleById.get(request.titleId),
    }))
    .filter(
      (item): item is typeof item & { title: ExperienceTitle } =>
        item.title !== undefined,
    );
  const [tab, setTab] = useState<"all" | "saved" | "offline">("all");
  const onBox = titles.filter((title) =>
    title.sources.some(
      (source) => source.kind === "retained_local" && source.verified,
    ),
  );
  const preparationTitles = originals.filter((title) => title.kind !== "book" && title.sources.some((source) =>
    source.verified && (source.kind === "personal_import" || source.kind === "public_domain"),
  )).map((title) => ({ id: title.id, title: title.title }));
  return (
    <main className="mx-auto max-w-[1600px] space-y-16 px-5 pb-28 pt-10 md:px-10 lg:pb-20">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="font-display text-[clamp(3.4rem,7vw,6.6rem)] font-semibold leading-none tracking-[-.075em]">
            Library
          </h1>
          <p className="mt-4 text-white/50">
            Everything {profile.name} kept close.
          </p>
        </div>
        <div className="flex gap-2">
          {(["all", "saved", "offline"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`min-h-11 rounded-full px-4 text-sm capitalize ${tab === item ? "bg-white text-black" : "bg-white/7 text-white/58"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      {(tab === "all" || tab === "offline") && <PreparationPanel key={profile.id} titles={preparationTitles} />}
      {tab === "all" && progress.length > 0 && (
        <section>
          <h2 className="font-display text-3xl font-semibold tracking-[-.055em]">
            Pick up where you left off.
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {progress.map(({ title, value }) => (
              <article
                key={title.id}
                className="relative min-h-72 overflow-hidden rounded-[1.8rem] bg-white/5"
              >
                <img
                  src={title.backdrop}
                  alt=""
                  className="absolute inset-0 size-full object-cover opacity-55"
                />
                <span className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/48 to-transparent" />
                <div className="relative flex min-h-72 max-w-sm flex-col justify-end p-7">
                  <span className="text-sm text-white/54">
                    {Math.round(value * 100)}% complete
                  </span>
                  <h3 className="mt-2 font-display text-4xl font-semibold tracking-[-.055em]">
                    {title.title}
                  </h3>
                  <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/18">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${value * 100}%`,
                        backgroundColor: profile.color,
                      }}
                    />
                  </div>
                  <button
                    onClick={() => onPlay(title)}
                    className="mt-5 inline-flex min-h-12 w-fit items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-black"
                  >
                    <Play className="size-4 fill-current" />
                    Keep watching
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {activeRequests.length > 0 && (
        <section>
          <h2 className="font-display text-3xl font-semibold tracking-[-.055em]">
            Preparing.
          </h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {activeRequests.map((request) => (
              <button
                key={request.titleId}
                onClick={() => onOpen(request.title)}
                className="flex min-h-20 items-center gap-4 rounded-2xl bg-white/[.045] px-5 text-left"
              >
                <img
                  src={request.title.poster}
                  alt=""
                  className="h-14 w-10 rounded-md object-cover"
                />
                <span className="flex-1">
                  <b className="block">{request.title.title}</b>
                  <small className="mt-1 block text-white/45">
                    Preview state · {request.status}
                    {request.progress ? ` · ${request.progress}%` : ""}
                  </small>
                </span>
                <ChevronRight className="size-4 text-white/35" />
              </button>
            ))}
          </div>
        </section>
      )}
      {tab !== "offline" && (
        <Shelf
          title={tab === "saved" ? "Saved." : "Your shelf."}
          note={
            saved.length
              ? "Ready whenever the mood returns."
              : "Save something and it will wait here."
          }
          items={saved}
          onOpen={onOpen}
        />
      )}
      {tab === "all" && (
        <>
          {onBox.length ? (
            <Shelf
              title="On this box."
              note="The real local shelf reported by ReelOS."
              items={onBox}
              onOpen={onOpen}
            />
          ) : (
            <EmptyState
              icon={<Library />}
              title={
                libraryStatus === "live"
                  ? "This box is waiting."
                  : "The box library didn’t answer."
              }
              text={
                libraryStatus === "live"
                  ? "No retained or personal titles were reported. Public-domain choices and your saved list remain available without pretending they are stored locally."
                  : libraryMessage ||
                    "Your saved profile state is still here. ReelOS will restore the local shelf when the library service returns."
              }
              action="Explore something"
              onAction={() => onNavigate("discover")}
            />
          )}
          <Shelf title="Loved." items={reactions("love")} onOpen={onOpen} />
          <Shelf
            title="Cozy."
            note="The things that feel like returning somewhere."
            items={reactions("cozy")}
            onOpen={onOpen}
          />
        </>
      )}
      <button
        onClick={() => onNavigate("books")}
        className="group relative flex min-h-64 w-full overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_80%_20%,var(--reelos-favorite),transparent_32%),linear-gradient(145deg,#19151a,#0c0c0f)] p-8 text-left md:p-10"
      >
        <span className="mt-auto max-w-xl">
          <BookOpen className="size-6" />
          <b className="mt-6 block font-display text-4xl tracking-[-.055em]">
            Books belong to {profile.name}, too.
          </b>
          <span className="mt-3 block leading-7 text-white/55">
            Your shelf, reading progress, and discoveries stay personal. Open
            your reading world.
          </span>
        </span>
        <ChevronRight className="absolute bottom-8 right-8 size-6 transition group-hover:translate-x-1" />
      </button>
    </main>
  );
}

function BooksWorld({
  profile,
  initialQuery,
  onNavigate,
}: {
  profile: ExperienceProfile;
  initialQuery?: string;
  onNavigate(view: ExperienceView): void;
}) {
  const setBookProgress = useExperienceStore((state) => state.setBookProgress);
  const toggleBookBookmark = useExperienceStore(
    (state) => state.toggleBookBookmark,
  );
  const setReadingAppearance = useExperienceStore(
    (state) => state.setReadingAppearance,
  );
  return (
    <main className="pb-28 lg:pb-16">
      <div className="mx-auto max-w-[1600px] px-5 pt-10 md:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-white/48">
            {possessive(profile.name)} reading world · progress stays with this
            profile
          </p>
          <button
            onClick={() => onNavigate("settings")}
            className="min-h-11 rounded-full border border-white/12 px-4 text-sm text-white/65"
          >
            Reading appearance
          </button>
        </div>
      </div>
      <div className="reelos-books-host mx-auto max-w-[1600px] px-5 md:px-10">
        <BooksView
          initialQuery={initialQuery}
          bookProgress={profile.bookProgress}
          bookLocations={profile.bookLocations || {}}
          bookBookmarks={profile.bookBookmarks || {}}
          readingAppearance={
            profile.readingAppearance || { theme: "dark", fontSizeIndex: 1 }
          }
          onProgress={(bookId, progress, location) =>
            setBookProgress(profile.id, bookId, progress, location)
          }
          onToggleBookmark={(bookId, location) =>
            toggleBookBookmark(profile.id, bookId, location)
          }
          onAppearance={(patch) => setReadingAppearance(profile.id, patch)}
        />
      </div>
    </main>
  );
}

function ProfileWorld({
  profile,
  onNavigate,
  onOpen,
}: {
  profile: ExperienceProfile;
  onNavigate(view: ExperienceView): void;
  onOpen(title: ExperienceTitle): void;
}) {
  const loved = Object.entries(profile.reactions)
    .filter(([, reaction]) => reaction === "love")
    .map(([id]) => TITLE_BY_EXPERIENCE_ID[id])
    .filter(Boolean);
  const cozy = Object.entries(profile.reactions)
    .filter(([, reaction]) => reaction === "cozy")
    .map(([id]) => TITLE_BY_EXPERIENCE_ID[id])
    .filter(Boolean);
  const backdrop =
    loved[0] ??
    profile.savedIds.map((id) => TITLE_BY_EXPERIENCE_ID[id]).find(Boolean) ??
    EXPERIENCE_CATALOG[0];
  return (
    <main className="pb-28 lg:pb-16">
      <section className="relative min-h-[430px] overflow-hidden">
        <img
          src={backdrop.backdrop}
          alt=""
          className="absolute inset-0 size-full object-cover opacity-38"
        />
        <span className="absolute inset-0 bg-[linear-gradient(0deg,#080809,transparent_80%),linear-gradient(90deg,#080809,transparent)]" />
        <div className="relative mx-auto flex min-h-[430px] max-w-[1600px] items-end px-5 pb-12 md:px-10">
          <div>
            <span
              className="grid size-20 place-items-center rounded-full text-3xl font-bold text-black shadow-2xl"
              style={{ backgroundColor: profile.color }}
            >
              {profile.name[0]}
            </span>
            <h1 className="mt-6 font-display text-[clamp(3.6rem,8vw,7.5rem)] font-semibold leading-none tracking-[-.075em]">
              {profile.name}
            </h1>
            <p className="mt-4 max-w-lg text-white/54">
              A private place for taste, history, and the things you return to.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                onClick={() => onNavigate("taste")}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-black"
              >
                <Wand2 className="size-4" />
                Tune your taste
              </button>
              <button
                onClick={() => onNavigate("settings")}
                className="min-h-12 rounded-full border border-white/15 px-6 text-sm"
              >
                Appearance & preferences
              </button>
            </div>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-[1600px] space-y-16 px-5 md:px-10">
        <Shelf
          title="Loved."
          note="The strongest anchors in this profile."
          items={loved}
          onOpen={onOpen}
        />
        <Shelf
          title="Comfort."
          note="A shelf made from Cozy reactions."
          items={cozy}
          onOpen={onOpen}
        />
        <section className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Loved"
            value={String(loved.length)}
            note="Strong taste anchors"
          />
          <StatCard
            label="Saved"
            value={String(profile.savedIds.length)}
            note="Waiting in Library"
          />
          <StatCard
            label="Motion"
            value={profile.motion}
            note="Personal appearance"
          />
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[1.5rem] bg-white/[.035] p-6">
      <span className="text-sm text-white/42">{label}</span>
      <b className="mt-5 block font-display text-3xl capitalize tracking-[-.05em]">
        {value}
      </b>
      <span className="mt-2 block text-sm text-white/42">{note}</span>
    </div>
  );
}

function TasteWorld({
  profile,
  onExit,
}: {
  profile: ExperienceProfile;
  onExit(): void;
}) {
  const react = useExperienceStore((state) => state.react);
  const dismissTaste = useExperienceStore((state) => state.dismissTaste);
  const toggleLessLike = useExperienceStore((state) => state.toggleLessLike);
  return (
    <main className="reelos-taste-world relative min-h-dvh overflow-hidden">
      <div
        className="reelos-taste-glow absolute left-1/2 top-[42%] h-[70vw] max-h-[800px] w-[70vw] max-w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px]"
        style={{ backgroundColor: `${profile.color}23` }}
      />
      <div className="relative mx-auto flex min-h-dvh max-w-[1600px] flex-col px-5 py-5 md:px-10 md:py-8">
        <div className="z-20 flex items-start justify-between gap-5">
          <div>
            <p className="text-sm text-white/45">
              {possessive(profile.name)} taste
            </p>
            <h1 className="mt-2 font-display text-[clamp(2rem,4.5vw,4.5rem)] font-semibold leading-none tracking-[-.07em]">
              Fill it with what you love.
            </h1>
            <p className="mt-3 max-w-xl text-sm text-white/52 md:text-base">
              Tap to like. Tap again to love. Stay while it is fun—this world
              keeps growing with you. Anything you love belongs here, even if
              it lives somewhere else.
            </p>
          </div>
          <button
            onClick={onExit}
            className="grid size-12 shrink-0 place-items-center rounded-full border border-white/14"
            aria-label="Leave taste tuning"
          >
            <X className="size-5" />
          </button>
        </div>
        <EndlessTasteField
          color={profile.color}
          reactions={profile.reactions}
          dismissedIds={profile.dismissedTasteIds}
          lessLikeIds={profile.lessLikeIds}
          onReact={(itemId, reaction) => react(profile.id, itemId, reaction)}
          onDismiss={(itemId) => dismissTaste(profile.id, itemId)}
          onToggleLessLike={(itemId) => toggleLessLike(profile.id, itemId)}
        />
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
          <button
            onClick={onExit}
            className="pointer-events-auto min-h-12 rounded-full bg-white px-7 text-sm font-bold text-black shadow-2xl"
          >
            That feels like me
          </button>
        </div>
      </div>
    </main>
  );
}

function EndlessTasteField({
  color,
  reactions,
  dismissedIds,
  lessLikeIds,
  onReact,
  onDismiss,
  onToggleLessLike,
  setup = false,
}: {
  color: string;
  reactions: Record<string, Reaction>;
  dismissedIds: string[];
  lessLikeIds: string[];
  onReact(itemId: string, reaction?: Reaction): void;
  onDismiss(itemId: string): void;
  onToggleLessLike(itemId: string): void;
  setup?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [departedIds, setDepartedIds] = useState<string[]>([]);
  const [departingIds, setDepartingIds] = useState<string[]>([]);
  const [cycle, setCycle] = useState(0);
  const dismissedKey = dismissedIds.join("\u001f");
  const departureTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(
    () => () => {
      for (const timer of departureTimers.current.values()) clearTimeout(timer);
    },
    [],
  );
  const visible = useMemo(
    () =>
      tasteFieldViewport(
        TASTE_ITEMS,
        { reactions, dismissedIds, lessLikeIds },
        departedIds,
        cycle,
      ),
    // Signals are deliberately sampled only when the field advances. Updating
    // a reaction must never make unrelated controls jump under a finger/remote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cycle, departedIds, dismissedKey],
  );
  const selected = TASTE_ITEMS.find((item) => item.id === selectedId);
  const releaseBubble = (itemId: string, delay = 420) => {
    const existing = departureTimers.current.get(itemId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setDepartingIds((current) => current.includes(itemId) ? current : [...current, itemId]);
      const departureKey = `${itemId}:departure`;
      const departureTimer = setTimeout(() => {
        setDepartedIds((current) => [...current.filter((id) => id !== itemId), itemId].slice(-18));
        setDepartingIds((current) => current.filter((id) => id !== itemId));
        setCycle((current) => current + 1);
        setSelectedId((current) => (current === itemId ? null : current));
        departureTimers.current.delete(departureKey);
      }, 260);
      departureTimers.current.set(departureKey, departureTimer);
      departureTimers.current.delete(itemId);
    }, delay);
    departureTimers.current.set(itemId, timer);
  };
  const chooseBubble = (itemId: string) => {
    const next = nextTasteReaction(reactions[itemId]);
    onReact(itemId, next);
    setSelectedId(itemId);
    releaseBubble(itemId, next === "love" ? 520 : 1900);
  };

  return (
    <>
      <div
        className={`reelos-endless-taste-field ${setup ? "is-setup" : ""}`}
        role="group"
        aria-label="Your endless taste picker"
      >
        {visible.map((item, index) => {
          const reaction = reactions[item.id];
          const less = lessLikeIds.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              data-taste-item={item.kind}
              aria-label={`${reaction === "like" ? "Love" : "Like"} ${item.title}${reaction ? `, currently ${reaction}` : ""}`}
              aria-pressed={Boolean(reaction)}
              onClick={() => chooseBubble(item.id)}
              className={`reelos-endless-taste-bubble ${reaction ? `is-${reaction}` : ""} ${less ? "is-less" : ""} ${departingIds.includes(item.id) ? "is-departing" : ""}`}
              style={
                {
                  "--taste-color": color,
                  "--taste-delay": `${-((index * 0.73) % 6)}s`,
                } as CSSProperties
              }
            >
              {item.image && <img src={item.image} alt="" loading="lazy" decoding="async" />}
              <span className="reelos-endless-taste-shade" />
              <span className="reelos-endless-taste-copy">
                <b>{item.title}</b>
                <small>{item.subtitle}</small>
                <em>
                  {reaction === "love"
                    ? "Loved"
                    : reaction === "like"
                      ? "Tap again to love"
                      : reaction === "cozy"
                        ? "Cozy"
                        : less
                          ? "Less like this"
                          : item.kind}
                </em>
              </span>
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="reelos-taste-actions fixed inset-x-3 bottom-20 z-50 mx-auto max-w-xl rounded-[1.7rem] border border-white/12 bg-[#17171c]/96 p-4 shadow-2xl backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <b className="block truncate">{selected.title}</b>
              <span className="mt-1 block truncate text-xs text-white/45">
                {selected.subtitle}
              </span>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              aria-label="Close taste actions"
              className="grid size-11 place-items-center rounded-full hover:bg-white/8"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2">
            <ReactionButton
              label="Like"
              active={reactions[selected.id] === "like"}
              icon={<Check />}
              onClick={() => {
                onReact(selected.id, reactions[selected.id] === "like" ? undefined : "like");
                releaseBubble(selected.id, 900);
              }}
            />
            <ReactionButton
              label="Love"
              active={reactions[selected.id] === "love"}
              icon={<Heart />}
              onClick={() => {
                onReact(selected.id, reactions[selected.id] === "love" ? undefined : "love");
                releaseBubble(selected.id);
              }}
            />
            <ReactionButton
              label="Cozy"
              active={reactions[selected.id] === "cozy"}
              icon={<Coffee />}
              onClick={() => {
                onReact(selected.id, reactions[selected.id] === "cozy" ? undefined : "cozy");
                releaseBubble(selected.id, 650);
              }}
            />
            <ReactionButton
              label="Less"
              active={lessLikeIds.includes(selected.id)}
              icon={<SlidersHorizontal />}
              onClick={() => onToggleLessLike(selected.id)}
            />
            <ReactionButton
              label="Dismiss"
              active={false}
              icon={<X />}
              onClick={() => {
                onDismiss(selected.id);
                releaseBubble(selected.id, 0);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

function ReactionButton({
  label,
  active,
  icon,
  onClick,
}: {
  label: string;
  active: boolean;
  icon: ReactNode;
  onClick(): void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] ${active ? "bg-white text-black" : "bg-white/7 text-white/64"}`}
    >
      {<span className="[&>svg]:size-4">{icon}</span>}
      {label}
    </button>
  );
}

function FamilyWorld({
  onNavigate,
}: {
  onNavigate(view: ExperienceView): void;
}) {
  const profiles = useExperienceStore((state) => state.profiles);
  const addProfile = useExperienceStore((state) => state.addProfile);
  const patchProfile = useExperienceStore((state) => state.patchProfile);
  const kidsPresentIds = useExperienceStore((state) => state.kidsPresentIds);
  const toggleKidPresent = useExperienceStore(
    (state) => state.toggleKidPresent,
  );
  const [editor, setEditor] = useState<"adult" | "child" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const pendingNewProfileId = useRef<string | null>(null);
  const [maturity, setMaturity] =
    useState<NonNullable<ExperienceProfile["maturity"]>>("big");
  const [bedtime, setBedtime] = useState("8:30 PM");
  const [boundaries, setBoundaries] = useState<
    Record<string, "fine" | "ask" | "never">
  >({
    scares: "ask",
    slapstick: "fine",
    fantasy: "fine",
    romance: "ask",
    grief: "ask",
    supernatural: "ask",
    stunts: "ask",
    language: "never",
  });
  const [familyPlayback, setFamilyPlayback] = useState<
    NonNullable<ExperienceProfile["familyPlayback"]>
  >({
    languageSeverity: "moderate",
    religiousLanguage: false,
    audioTreatment: "mute",
    subtitleTreatment: "hide",
    exceptions: [],
  });
  const closeEditor = () => {
    setEditor(null);
    setEditingId(null);
    setName("");
    setPin("");
    setPinConfirm("");
    setPinEnabled(false);
    setProfileError("");
    pendingNewProfileId.current = null;
  };
  const edit = (profile: ExperienceProfile) => {
    setEditingId(profile.id);
    setEditor(profile.isChild ? "child" : "adult");
    setName(profile.name);
    setPinEnabled(Boolean(profile.pinEnabled));
    setPin("");
    setPinConfirm("");
    setMaturity(profile.maturity ?? "big");
    setBedtime(profile.bedtime ?? "8:30 PM");
    setBoundaries(profile.boundaries ?? boundaries);
    setFamilyPlayback(
      profile.familyPlayback ?? {
        languageSeverity: "moderate",
        religiousLanguage: false,
        audioTreatment: "mute",
        subtitleTreatment: "hide",
        exceptions: [],
      },
    );
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const beginAdd = (type: "adult" | "child") => {
    setEditor(type);
    setPinEnabled(type === "child");
    setPin("");
    setPinConfirm("");
    setProfileError("");
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const save = async () => {
    const needsNewPin = !editingId && (pinEnabled || editor === "child");
    if (
      !name.trim() ||
      (needsNewPin && pin.length !== 4) ||
      (pin.length > 0 && pin.length !== 4) ||
      (pin.length > 0 && pin !== pinConfirm)
    )
      return;
    setSavingProfile(true);
    setProfileError("");
    const patch: Partial<ExperienceProfile> = {
      name: name.trim(),
      pinEnabled: editor === "child" ? true : pinEnabled,
      ...(editor === "child"
        ? { isChild: true, maturity, bedtime, boundaries, familyPlayback }
        : {}),
    };
    try {
      if (editingId) {
        const existing = profiles.find((profile) => profile.id === editingId);
        if (!existing) throw new Error("That profile is no longer available.");
        const updated = { ...existing, ...patch, updatedAt: Date.now() };
        const pinUpdate = pin
          ? pin
          : editor === "adult" && !pinEnabled
            ? null
            : undefined;
        await saveExperienceProfile(updated, pinUpdate);
        patchProfile(editingId, patch);
      } else {
        let newId = pendingNewProfileId.current;
        if (!newId) {
          newId = addProfile({
            name: name.trim(),
            color: editor === "child" ? "#58d5bc" : "#a9b9ff",
            isChild: editor === "child",
            pinEnabled: editor === "child" ? true : pinEnabled,
            motion: editor === "child" ? "expressive" : "subtle",
            density: "comfortable",
            exploration: editor === "child" ? "familiar" : "balanced",
            reactions: {},
            dismissedTasteIds: [],
            lessLikeIds: [],
            savedIds: [],
            progress: {},
            bookProgress: {},
            audioPreference: editor === "child" ? "dub" : "original",
            subtitleLanguage: "English",
            ...(editor === "child"
              ? { maturity, bedtime, boundaries, familyPlayback }
              : {}),
          });
          pendingNewProfileId.current = newId;
        }
        const created = useExperienceStore
          .getState()
          .profiles.find((profile) => profile.id === newId);
        if (!created) throw new Error("That profile could not be prepared.");
        await saveExperienceProfile(created, pin || undefined);
      }
      closeEditor();
    } catch (reason) {
      setProfileError(
        reason instanceof Error
          ? reason.message
          : "This profile could not be saved yet.",
      );
    } finally {
      setSavingProfile(false);
    }
  };
  if (editor)
    return (
      <FamilyEditor
        type={editor}
        name={name}
        setName={setName}
        pinEnabled={pinEnabled}
        setPinEnabled={setPinEnabled}
        pin={pin}
        setPin={setPin}
        pinConfirm={pinConfirm}
        setPinConfirm={setPinConfirm}
        maturity={maturity}
        setMaturity={setMaturity}
        bedtime={bedtime}
        setBedtime={setBedtime}
        boundaries={boundaries}
        setBoundaries={setBoundaries}
        familyPlayback={familyPlayback}
        setFamilyPlayback={setFamilyPlayback}
        editing={Boolean(editingId)}
        saving={savingProfile}
        error={profileError}
        onBack={closeEditor}
        onSave={() => void save()}
      />
    );
  return (
    <main className="mx-auto max-w-[1400px] px-5 pb-28 pt-12 md:px-10 lg:pb-20">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-[clamp(3.4rem,7vw,6.5rem)] font-semibold leading-none tracking-[-.075em]">
            Family
          </h1>
          <p className="mt-4 max-w-xl text-white/52">
            People, private tastes, and the boundaries that make this home work
            for everyone.
          </p>
        </div>
        <button
          onClick={() => onNavigate("party")}
          className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/13 px-5 text-sm"
        >
          <Users className="size-4" />
          Watch together
        </button>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {profiles
          .filter((profile) => !profile.isGuest)
          .map((profile) => (
            <button
              key={profile.id}
              onClick={() => edit(profile)}
              className="reelos-family-card min-h-64 rounded-[1.7rem] bg-white/[.035] p-6 text-left"
            >
              <span
                className="grid size-16 place-items-center rounded-full text-xl font-bold text-black"
                style={{ backgroundColor: profile.color }}
              >
                {profile.name[0]}
              </span>
              <b className="mt-8 block text-xl">{profile.name}</b>
              <span className="mt-1 block text-sm text-white/45">
                {profile.isChild
                  ? `${profile.maturity ?? "Custom"} boundaries · PIN required`
                  : profile.pinEnabled
                    ? "Adult · Passcode protected"
                    : "Adult · Open profile"}
              </span>
            </button>
          ))}
        <button
          onClick={() => beginAdd("adult")}
          className="reelos-family-card min-h-64 rounded-[1.7rem] border border-dashed border-white/16 p-6 text-left"
        >
          <span className="grid size-16 place-items-center rounded-full border border-dashed border-white/24">
            <Plus />
          </span>
          <b className="mt-8 block text-xl">Add an adult</b>
          <span className="mt-1 block text-sm text-white/45">
            Their own history and taste.
          </span>
        </button>
        <button
          onClick={() => beginAdd("child")}
          className="reelos-family-card min-h-64 rounded-[1.7rem] bg-[linear-gradient(145deg,rgba(88,213,188,.16),rgba(50,84,135,.14))] p-6 text-left"
        >
          <span className="grid size-16 place-items-center rounded-full bg-[#58d5bc]/18 text-[#58d5bc]">
            <ShieldCheck />
          </span>
          <b className="mt-8 block text-xl">Add a child</b>
          <span className="mt-1 block text-sm text-white/48">
            Set the boundaries of their cinema.
          </span>
        </button>
      </div>
      {profiles.some((profile) => profile.isChild) && (
        <section className="mt-14 rounded-[1.7rem] bg-white/[.035] p-6 md:p-8">
          <p className="text-sm text-white/44">Who is watching right now?</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-.055em]">
            Presence changes tonight, not anyone’s profile.
          </h2>
          <div className="mt-6 flex flex-wrap gap-3">
            {profiles
              .filter((profile) => profile.isChild)
              .map((child) => (
                <button
                  key={child.id}
                  onClick={() => {
                    const nextIds = kidsPresentIds.includes(child.id)
                      ? kidsPresentIds.filter((id) => id !== child.id)
                      : [...kidsPresentIds, child.id];
                    toggleKidPresent(child.id);
                    void syncFamilyPresence(nextIds).catch(() => undefined);
                  }}
                  className={`min-h-12 rounded-full px-5 text-sm font-semibold ${kidsPresentIds.includes(child.id) ? "bg-[#58d5bc] text-[#071411]" : "border border-white/14"}`}
                >
                  {kidsPresentIds.includes(child.id)
                    ? `${child.name} is here`
                    : `${child.name} is in bed`}
                </button>
              ))}
          </div>
        </section>
      )}
    </main>
  );
}

function FamilyEditor({
  type,
  name,
  setName,
  pinEnabled,
  setPinEnabled,
  pin,
  setPin,
  pinConfirm,
  setPinConfirm,
  maturity,
  setMaturity,
  bedtime,
  setBedtime,
  boundaries,
  setBoundaries,
  familyPlayback,
  setFamilyPlayback,
  editing,
  saving,
  error,
  onBack,
  onSave,
}: {
  type: "adult" | "child";
  name: string;
  setName(value: string): void;
  pinEnabled: boolean;
  setPinEnabled(value: boolean): void;
  pin: string;
  setPin(value: string): void;
  pinConfirm: string;
  setPinConfirm(value: string): void;
  maturity: NonNullable<ExperienceProfile["maturity"]>;
  setMaturity(value: NonNullable<ExperienceProfile["maturity"]>): void;
  bedtime: string;
  setBedtime(value: string): void;
  boundaries: Record<string, "fine" | "ask" | "never">;
  setBoundaries(value: Record<string, "fine" | "ask" | "never">): void;
  familyPlayback: NonNullable<ExperienceProfile["familyPlayback"]>;
  setFamilyPlayback(
    value: NonNullable<ExperienceProfile["familyPlayback"]>,
  ): void;
  editing: boolean;
  saving: boolean;
  error: string;
  onBack(): void;
  onSave(): void;
}) {
  const examples: Array<[string, string]> = [
    ["scares", "Scary monsters & jump scares"],
    ["slapstick", "Comic danger & slapstick"],
    ["fantasy", "Fantasy creature combat"],
    ["romance", "Romance & mild innuendo"],
    ["grief", "Grief & emotional peril"],
    ["supernatural", "Ghosts & supernatural themes"],
    ["stunts", "Imitable stunts"],
    ["language", "Coarse language"],
  ];
  return (
    <main className="mx-auto max-w-5xl px-5 pb-28 pt-10 md:px-10">
      <button
        onClick={onBack}
        className="inline-flex min-h-12 items-center gap-2 text-sm text-white/55"
      >
        <ArrowLeft className="size-4" />
        Family
      </button>
      <h1 className="mt-6 font-display text-[clamp(3rem,6vw,5.5rem)] font-semibold leading-none tracking-[-.07em]">
        {editing
          ? `Edit ${name}`
          : type === "child"
            ? "Make a safe little cinema."
            : "Add someone to the home."}
      </h1>
      <div className="mt-10 max-w-2xl border-b border-white/22">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Their name"
          className="w-full bg-transparent py-4 text-2xl outline-none placeholder:text-white/25"
        />
      </div>
      {type === "child" && (
        <>
          <section className="mt-12">
            <p className="text-sm text-white/44">Starting point</p>
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
              {(["little", "big", "teen", "mature"] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setMaturity(item)}
                  className={`min-h-14 rounded-2xl capitalize ${maturity === item ? "bg-[#58d5bc] text-[#071411]" : "bg-white/7"}`}
                >
                  {item === "little"
                    ? "Little kids"
                    : item === "big"
                      ? "Big kids"
                      : item === "mature"
                        ? "Mature teens"
                        : "Teens"}
                </button>
              ))}
            </div>
          </section>
          <section className="mt-12">
            <p className="text-sm text-white/44">Teach the boundary</p>
            <h2 className="mt-2 font-display text-3xl tracking-[-.05em]">
              Every family draws these lines differently.
            </h2>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {examples.map(([id, label]) => (
                <div key={id} className="rounded-2xl bg-white/[.035] p-4">
                  <b className="text-sm">{label}</b>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {(["fine", "ask", "never"] as const).map((choice) => (
                      <button
                        key={choice}
                        onClick={() =>
                          setBoundaries({ ...boundaries, [id]: choice })
                        }
                        className={`min-h-11 rounded-xl text-xs capitalize ${boundaries[id] === choice ? (choice === "fine" ? "bg-[#58d5bc] text-[#071411]" : choice === "ask" ? "bg-[#f0ba61] text-[#201608]" : "bg-[#df8790] text-[#2b0b10]") : "bg-white/7 text-white/55"}`}
                      >
                        {choice === "ask" ? "Ask first" : choice}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <label className="mt-8 block max-w-sm">
            <span className="text-sm text-white/50">Bedtime</span>
            <input
              value={bedtime}
              onChange={(event) => setBedtime(event.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl bg-white/7 px-4 outline-none"
            />
          </label>
          <section className="mt-12 rounded-[1.7rem] bg-white/[.035] p-5 md:p-7">
            <p className="text-sm text-white/44">During playback</p>
            <h2 className="mt-2 font-display text-3xl tracking-[-.05em]">
              Choose how language is treated.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/48">
              This changes audio and matching subtitles only when ReelOS has a
              verified dialogue track. It never claims to edit every title, and
              it does not remove a film from the catalog.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
              {(["off", "strong", "moderate", "mild"] as const).map(
                (severity) => (
                  <button
                    key={severity}
                    onClick={() =>
                      setFamilyPlayback({
                        ...familyPlayback,
                        languageSeverity: severity,
                      })
                    }
                    className={`min-h-12 rounded-xl text-sm capitalize ${familyPlayback.languageSeverity === severity ? "bg-[#58d5bc] text-[#071411]" : "bg-white/7"}`}
                  >
                    {severity === "off" ? "Off" : `${severity} + above`}
                  </button>
                ),
              )}
            </div>
            <button
              onClick={() =>
                setFamilyPlayback({
                  ...familyPlayback,
                  religiousLanguage: !familyPlayback.religiousLanguage,
                })
              }
              className="mt-4 flex min-h-14 w-full items-center justify-between rounded-xl bg-white/7 px-4 text-left text-sm"
            >
              <span>
                <b className="block">Religious language</b>
                <small className="mt-1 block text-white/45">
                  Treat religious expletives separately from other language.
                </small>
              </span>
              <span
                className={`grid size-8 place-items-center rounded-full ${familyPlayback.religiousLanguage ? "bg-[#58d5bc] text-[#071411]" : "bg-white/10"}`}
              >
                {familyPlayback.religiousLanguage && (
                  <Check className="size-4" />
                )}
              </span>
            </button>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-white/40">
                  Audio
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(["mute", "soften"] as const).map((treatment) => (
                    <button
                      key={treatment}
                      onClick={() =>
                        setFamilyPlayback({
                          ...familyPlayback,
                          audioTreatment: treatment,
                        })
                      }
                      className={`min-h-11 rounded-xl capitalize ${familyPlayback.audioTreatment === treatment ? "bg-white text-black" : "bg-white/7"}`}
                    >
                      {treatment}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-white/40">
                  Matching subtitles
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(["hide", "replace"] as const).map((treatment) => (
                    <button
                      key={treatment}
                      onClick={() =>
                        setFamilyPlayback({
                          ...familyPlayback,
                          subtitleTreatment: treatment,
                        })
                      }
                      className={`min-h-11 rounded-xl capitalize ${familyPlayback.subtitleTreatment === treatment ? "bg-white text-black" : "bg-white/7"}`}
                    >
                      {treatment}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <label className="mt-5 block">
              <span className="text-sm text-white/50">
                Always allow these titles
              </span>
              <input
                value={familyPlayback.exceptions.join(", ")}
                onChange={(event) =>
                  setFamilyPlayback({
                    ...familyPlayback,
                    exceptions: event.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Title, another title"
                className="mt-2 min-h-12 w-full rounded-xl bg-white/7 px-4 outline-none placeholder:text-white/25"
              />
            </label>
          </section>
        </>
      )}
      <button
        onClick={() => type === "adult" && setPinEnabled(!pinEnabled)}
        className={`mt-10 flex min-h-20 w-full max-w-2xl items-center justify-between rounded-[1.35rem] px-5 text-left ${pinEnabled || type === "child" ? "bg-white/9" : "bg-white/[.035]"}`}
      >
        <span>
          <b className="block">
            {type === "child"
              ? "Family PIN required to leave"
              : "Protect this profile with a passcode"}
          </b>
          <small className="mt-1 block text-white/45">
            {type === "child"
              ? "Both parents can change or reset it."
              : "Optional privacy for history and taste."}
          </small>
        </span>
        <span
          className={`grid size-9 place-items-center rounded-full ${pinEnabled || type === "child" ? "bg-white text-black" : "bg-white/9"}`}
        >
          {(pinEnabled || type === "child") && <Check className="size-4" />}
        </span>
      </button>
      {(pinEnabled || type === "child") && (
        <div className="mt-3 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
          <input
            value={pin}
            onChange={(event) =>
              setPin(event.target.value.replace(/\D/g, "").slice(0, 4))
            }
            inputMode="numeric"
            autoComplete="new-password"
            aria-label={editing ? "New 4-digit PIN" : "Create a 4-digit PIN"}
            placeholder={
              editing ? "New PIN (optional)" : "Create a 4-digit PIN"
            }
            className="min-h-14 rounded-xl bg-white/7 px-4 text-lg tracking-[.25em] outline-none placeholder:text-sm placeholder:tracking-normal placeholder:text-white/24"
          />
          <input
            value={pinConfirm}
            onChange={(event) =>
              setPinConfirm(event.target.value.replace(/\D/g, "").slice(0, 4))
            }
            inputMode="numeric"
            autoComplete="new-password"
            aria-label="Confirm 4-digit PIN"
            placeholder="Confirm PIN"
            className="min-h-14 rounded-xl bg-white/7 px-4 text-lg tracking-[.25em] outline-none placeholder:text-sm placeholder:tracking-normal placeholder:text-white/24"
          />
        </div>
      )}
      <button
        disabled={
          saving ||
          !name.trim() ||
          ((pinEnabled || type === "child") && !editing && pin.length !== 4) ||
          (pin.length > 0 && (pin.length !== 4 || pin !== pinConfirm))
        }
        onClick={onSave}
        className="mt-8 min-h-12 rounded-full bg-white px-7 text-sm font-bold text-black disabled:opacity-30"
      >
        {saving
          ? "Saving…"
          : editing
            ? "Save changes"
            : type === "child"
              ? "Create child profile"
              : "Add profile"}
      </button>
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      <p className="mt-3 text-xs text-white/35">
        PINs are salted and hashed by this home. They are never stored in the
        browser or returned to this screen.
      </p>
    </main>
  );
}

function SettingsWorld({
  onNavigate,
  initialGroup,
}: {
  onNavigate(view: ExperienceView): void;
  initialGroup?: string;
}) {
  const state = useExperienceStore();
  const profile = activeExperienceProfile(state);
  const patchProfile = state.patchProfile;
  // Storage policy is a Day-0 safety control, so keep it reachable on arrival.
  // Explicit deep links (for example Advanced) still select their requested group.
  const [open, setOpen] = useState(initialGroup || "library");
  const groups = [
    {
      id: "appearance",
      title: "For you",
      note: "Color, motion, density, and personal taste",
    },
    {
      id: "family",
      title: "Family",
      note: "People, privacy, children, and presence",
    },
    {
      id: "playback",
      title: "Playback & companion",
      note: "Language, subtitles, listening, and context",
    },
    {
      id: "books",
      title: "Books",
      note: "Reading appearance and library choices",
    },
    {
      id: "library",
      title: "Library & storage",
      note: "Requests, travel, and retention",
    },
    {
      id: "devices",
      title: "Sources & devices",
      note: "TorBox, private sources, screens, and installation",
    },
    {
      id: "help",
      title: "Help & about",
      note: "Health, recovery, updates, and feature status",
    },
    {
      id: "advanced",
      title: "Quietly getting better",
      note: "See which private capabilities are ready, validating, or unavailable",
    },
  ];
  return (
    <main className="mx-auto max-w-4xl px-5 pb-28 pt-10 md:px-10 lg:pb-20">
      <div className="space-y-3">
        {groups.map((group) => (
          <section
            key={group.id}
            className="overflow-hidden rounded-[1.55rem] bg-white/[.035]"
          >
            <button
              aria-expanded={open === group.id}
              onClick={() => setOpen(open === group.id ? "" : group.id)}
              className="flex min-h-24 w-full items-center justify-between gap-5 px-6 text-left"
            >
              <span>
                <b className="font-display text-2xl tracking-[-.045em]">
                  {group.title}
                </b>
                <small className="mt-1 block text-white/42">{group.note}</small>
              </span>
              <span className="grid size-10 place-items-center rounded-full bg-white/7 text-xl">
                {open === group.id ? "−" : "+"}
              </span>
            </button>
            {open === group.id && (
              <div className="border-t border-white/7 px-6 py-6">
                {group.id === "appearance" && (
                  <AppearanceSettings
                    profile={profile}
                    patchProfile={patchProfile}
                    onTaste={() => onNavigate("taste")}
                  />
                )}
                {group.id === "family" && (
                  <ActionRows
                    rows={[
                      [
                        "Manage everyone in this home",
                        "Profiles, PINs, boundaries, and bedtime",
                        () => onNavigate("family"),
                      ],
                      [
                        "Who is watching",
                        "A quick presence control for tonight",
                        () => onNavigate("family"),
                      ],
                    ]}
                  />
                )}
                {group.id === "playback" && (
                  <PlaybackSettings
                    profile={profile}
                    patchProfile={patchProfile}
                    onCompanion={() => onNavigate("companion")}
                  />
                )}
                {group.id === "books" && (
                  <ActionRows
                    rows={[
                      [
                        "Reading world",
                        "Open your shelf and continue reading",
                        () => onNavigate("books"),
                      ],
                      [
                        "Reading defaults",
                        "Warm page · Medium type · Relaxed spacing",
                        () => onNavigate("books"),
                      ],
                    ]}
                  />
                )}
                {group.id === "library" && (
                  <div className="space-y-6">
                    <StorageSettings />
                    <ActionRows rows={[["Your Library", "Saved titles and kept local files", () => onNavigate("library")]]} />
                  </div>
                )}
                {group.id === "devices" && (
                  <div className="space-y-5">
                    <HomeRegionSetting />
                    <DebridSettings />
                    <AdvancedIndexerSettings />
                    <ActionRows
                      rows={[
                        [
                          "Manage devices",
                          state.connectedDevices.length
                            ? `${state.connectedDevices.length} connected`
                            : "No connected devices reported",
                          () => onNavigate("devices"),
                        ],
                        [
                          "Configure media provider",
                          "Validate or change TorBox",
                          () => onNavigate("devices"),
                        ],
                      ]}
                    />
                  </div>
                )}
                {group.id === "help" && (
                  <HelpSettings onSetup={() => onNavigate("setup")} />
                )}
                {group.id === "advanced" && <AdvancedView embedded />}
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}

function HomeRegionSetting() {
  const [region, setRegion] = useState("US");
  const [status, setStatus] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/settings", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((result: { region?: string } | null) => {
        if (result?.region && /^[A-Z]{2}$/.test(result.region)) setRegion(result.region);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  const save = (next: string) => {
    setRegion(next);
    setStatus("Saving…");
    void fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region: next }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("The home region was not saved.");
        setStatus("Saved for this home.");
      })
      .catch((reason: unknown) => setStatus(reason instanceof Error ? reason.message : "The home region was not saved."));
  };
  return (
    <label className="block rounded-2xl bg-white/[.045] p-5 text-sm font-semibold">
      Streaming region
      <select
        value={region}
        onChange={(event) => save(event.target.value)}
        className="mt-3 min-h-12 w-full rounded-xl bg-black/25 px-4 text-sm text-white"
      >
        <option value="US">United States</option>
        <option value="CA">Canada</option>
        <option value="GB">United Kingdom</option>
        <option value="AU">Australia</option>
        <option value="DE">Germany</option>
        <option value="FR">France</option>
      </select>
      <span className="mt-2 block text-xs font-normal text-white/42">
        Used only to show legitimate services available in this home. {status}
      </span>
    </label>
  );
}

function DebridSettings() {
  const debrid = useExperienceStore((state) => state.debrid);
  const setDebridEnabled = useExperienceStore(
    (state) => state.setDebridEnabled,
  );
  const setDebridConnection = useExperienceStore(
    (state) => state.setDebridConnection,
  );
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState("");
  const provider = "torbox" as const;
  const [key, setKey] = useState("");
  const connected = isDebridConnected(debrid);
  const status = connected
    ? "Connected and available to this home"
    : debrid.enabled
      ? "Enabled, but a key still needs live validation"
      : "Off — Library uses verified public-domain and personal media only";
  const saveProvider = (enabled: boolean, nextKey = "") => {
    if (changing) return;
    setChanging(true);
    setError("");
    void fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        debridEnabled: enabled,
        debridProvider: provider,
        ...(nextKey ? { debridKey: nextKey } : {}),
      }),
    })
      .then(async (response) => {
        const result = (await response.json()) as {
          debridEnabled?: boolean;
          debridProvider?: "torbox" | "real-debrid";
          debridStatus?:
            | "disabled"
            | "needs-key"
            | "validating"
            | "connected"
            | "failed";
          error?: string;
        };
        if (!response.ok)
          throw new Error(result.error || "Provider could not be changed.");
        setDebridConnection({
          enabled: result.debridEnabled === true,
          provider: result.debridProvider || provider,
          status: result.debridStatus || (enabled ? "failed" : "disabled"),
        });
        if (enabled) setKey("");
        if (!enabled) setDebridEnabled(false);
      })
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "This home could not change its provider right now.",
        );
      })
      .finally(() => setChanging(false));
  };
  return (
    <div className="rounded-2xl bg-white/[.045] p-5">
      <ToggleRow
        title="TorBox"
        note={changing ? "Checking this home…" : status}
        active={debrid.enabled && debrid.provider === provider}
        onChange={() => {
          const active = debrid.enabled && debrid.provider === provider;
          if (active) {
            saveProvider(false);
            return;
          }
          if (!key.trim()) {
            setError("Paste a TorBox key first.");
            return;
          }
          saveProvider(true, key.trim());
        }}
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-black/20 px-4 py-3 text-xs text-white/45">
          <b className="block text-sm text-white/75">Debrid / WebDAV Streaming Adapter</b>
          High-speed external cache adapter for streaming sources
        </div>
        <label className="text-xs text-white/45">
          API key{" "}
          {connected && debrid.provider === provider ? "(connected)" : ""}
          <input
            type="password"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="Paste your private API key to connect"
            autoComplete="off"
            className="mt-2 min-h-12 w-full rounded-xl bg-black/25 px-4 text-sm text-white placeholder:text-white/25"
          />
        </label>
      </div>
      <button
        type="button"
        disabled={!key.trim() || changing}
        onClick={() => saveProvider(true, key.trim())}
        className="mt-4 min-h-12 rounded-full bg-white px-5 text-sm font-bold text-black disabled:opacity-35"
      >
        {changing
          ? "Validating…"
          : connected && debrid.provider === provider
            ? "Change key"
            : "Connect Provider"}
      </button>
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      <p className="mt-4 text-sm leading-6 text-white/45">
        Turning this off removes external provider titles and pending cache requests from
        the active Library. Personal files, public-domain media, taste, history,
        and progress stay yours.
      </p>
      <p className="mt-3 text-xs leading-5 text-white/32">
        ReelOS supports provider-agnostic debrid and WebDAV access via user-supplied API credentials.
      </p>
    </div>
  );
}

type IndexerPreset = {
  id: string;
  name: string;
  role: "movie" | "tv" | "both";
  type: "search" | "rss";
};

type PublicCatalog = {
  id: string;
  name: string;
  media: Array<"movie" | "book">;
  access: string;
  enabled: boolean;
  provider: string;
};

function AdvancedIndexerSettings() {
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState<IndexerPreset[]>([]);
  const [publicCatalogs, setPublicCatalogs] = useState<PublicCatalog[]>([]);
  const [enabled, setEnabled] = useState<string[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!open || presets.length) return;
    void fetch("/api/settings", { cache: "no-store" })
      .then((response) => response.json())
      .then(
        (result: {
          availableIndexerPresets?: IndexerPreset[];
          enabledIndexerIds?: string[];
          publicCatalogs?: PublicCatalog[];
        }) => {
          setPresets(result.availableIndexerPresets || []);
          setEnabled(result.enabledIndexerIds || []);
          setPublicCatalogs(result.publicCatalogs || []);
        },
      )
      .catch(() => setStatus("This home could not load source-search settings."));
  }, [open, presets.length]);

  const save = () => {
    setStatus("Saving…");
    void fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabledIndexerIds: enabled }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Source choices were not saved.");
        setStatus(
          enabled.length
            ? `${enabled.length} enabled for this home.`
            : "No optional source connections enabled.",
        );
      })
      .catch((reason: unknown) =>
        setStatus(
          reason instanceof Error
            ? reason.message
            : "Source choices were not saved.",
        ),
      );
  };

  return (
    <div className="rounded-2xl bg-white/[.03] p-5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-12 w-full items-center justify-between text-left"
      >
        <span>
          <b className="block text-sm">Public catalogs & owner source connections</b>
          <small className="mt-1 block text-white/42">
            Public collections are ready. Owner connections are optional.
          </small>
        </span>
        <span className="text-xl text-white/50">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="mt-4 border-t border-white/7 pt-4">
          <p className="text-sm font-semibold text-white/80">
            Always available
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {publicCatalogs.map((catalog) => (
              <div
                key={catalog.id}
                className="min-h-14 rounded-xl bg-black/20 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <b className="text-sm">{catalog.name}</b>
                  <span className="text-xs text-emerald-300">Connected</span>
                </div>
                <small className="mt-1 block text-white/35">
                  {catalog.media.join(" + ")} ·{" "}
                  {catalog.access.replaceAll("-", " ")}
                </small>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-white/38">
            Catalog results carry their source and rights record. ReelOS only
            offers direct playback when the item itself supplies usable media
            and clear open-rights evidence.
          </p>
          <p className="mt-6 text-sm font-semibold text-white/80">
            Owner connections
          </p>
          <p className="text-sm leading-6 text-white/45">
            Connections appear here only when this appliance owner supplies a
            private preset file. They are separate from the public catalogs
            above and are never enabled silently.
          </p>
          {presets.length === 0 && (
            <p className="mt-4 rounded-xl bg-black/20 p-4 text-sm leading-6 text-white/55">
              No owner presets are installed. Public catalogs, your media
              provider, and your personal library continue to work normally.
            </p>
          )}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {presets.map((preset) => {
              const active = enabled.includes(preset.id);
              return (
                <button
                  type="button"
                  key={preset.id}
                  onClick={() =>
                    setEnabled((items) =>
                      active
                        ? items.filter((id) => id !== preset.id)
                        : [...items, preset.id],
                    )
                  }
                  className={`min-h-14 rounded-xl px-4 text-left ${active ? "bg-white text-black" : "bg-black/20 text-white"}`}
                >
                  <b className="text-sm">{preset.name}</b>
                  <small
                    className={`ml-2 ${active ? "text-black/55" : "text-white/35"}`}
                  >
                    {preset.role === "both" ? "movies + TV" : preset.role}
                  </small>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={save}
            disabled={presets.length === 0}
            className="mt-4 min-h-12 rounded-full bg-white px-6 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-35"
          >
            Save owner connections
          </button>
          {status && <p className="mt-3 text-xs text-white/45">{status}</p>}
        </div>
      )}
    </div>
  );
}

function AppearanceSettings({
  profile,
  patchProfile,
  onTaste,
}: {
  profile: ExperienceProfile;
  patchProfile(id: string, patch: Partial<ExperienceProfile>): void;
  onTaste(): void;
}) {
  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm text-white/45">
          A color you’ll want to come home to.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {[
            "#2563eb",
            "#e11d48",
            "#f97316",
            "#eab308",
            "#22c55e",
            "#06b6d4",
            "#a855f7",
            "#ec4899",
          ].map((color) => (
            <button
              key={color}
              onClick={() => patchProfile(profile.id, { color })}
              aria-label={`Use ${color}`}
              className={`size-12 rounded-full ${profile.color === color ? "ring-4 ring-white/35" : ""}`}
              style={{ backgroundColor: color }}
            />
          ))}
          <label className="grid size-12 cursor-pointer place-items-center rounded-full border border-dashed border-white/24">
            <Plus className="size-4" />
            <input
              type="color"
              value={profile.color}
              onChange={(event) =>
                patchProfile(profile.id, { color: event.target.value })
              }
              className="sr-only"
            />
          </label>
        </div>
      </div>
      <ChoiceSetting
        label="Motion"
        value={profile.motion}
        options={["still", "subtle", "expressive"]}
        onChange={(motion) =>
          patchProfile(profile.id, {
            motion: motion as ExperienceProfile["motion"],
          })
        }
      />
      <ChoiceSetting
        label="Browsing density"
        value={profile.density}
        options={["comfortable", "compact"]}
        onChange={(density) =>
          patchProfile(profile.id, {
            density: density as ExperienceProfile["density"],
          })
        }
      />
      <ToggleRow
        title="Living color"
        note="Let your favorite color breathe behind every screen."
        active={profile.atmosphere !== false}
        onChange={() =>
          patchProfile(profile.id, { atmosphere: profile.atmosphere === false })
        }
      />
      <ToggleRow
        title="Translucent surfaces"
        note="Let artwork and living color travel through menus and sheets."
        active={profile.transparency !== false}
        onChange={() =>
          patchProfile(profile.id, {
            transparency: profile.transparency === false,
          })
        }
      />
      <button
        onClick={onTaste}
        className="flex min-h-16 w-full items-center justify-between rounded-2xl bg-white/7 px-5 text-left"
      >
        <span>
          <b className="block">Tune your taste</b>
          <small className="mt-1 block text-white/43">
            Return to the endless bubble field.
          </small>
        </span>
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

function PlaybackSettings({
  profile,
  patchProfile,
  onCompanion,
}: {
  profile: ExperienceProfile;
  patchProfile(id: string, patch: Partial<ExperienceProfile>): void;
  onCompanion(): void;
}) {
  return (
    <div className="space-y-6">
      <ChoiceSetting
        label="Audio preference"
        value={profile.audioPreference}
        options={["original", "dub", "sub"]}
        onChange={(audioPreference) =>
          patchProfile(profile.id, {
            audioPreference:
              audioPreference as ExperienceProfile["audioPreference"],
          })
        }
      />
      <ChoiceSetting
        label="Subtitle language"
        value={profile.subtitleLanguage}
        options={["Off", "English", "Spanish"]}
        onChange={(subtitleLanguage) =>
          patchProfile(profile.id, { subtitleLanguage })
        }
      />
      <button
        onClick={onCompanion}
        className="flex min-h-16 w-full items-center justify-between rounded-2xl bg-white/7 px-5 text-left"
      >
        <span>
          <b className="block">Companion screen</b>
          <small className="mt-1 block text-white/43">
            Remote, cast, story, music, and context.
          </small>
        </span>
        <ChevronRight className="size-4" />
      </button>
      <CapabilityStatusRows
        rows={[
          ["Story so far", "Needs a verified scene timeline"],
          ["Soundtrack moments", "Needs timestamped music metadata"],
          [
            "Film-scholar commentary",
            "Needs verified local story evidence",
          ],
          ["Character relationships", "Needs verified context for this exact edition"],
        ]}
      />
    </div>
  );
}

function CapabilityStatusRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white/[.025]">
      {rows.map(([title, note], index) => (
        <div
          key={title}
          className={`flex min-h-16 items-center justify-between gap-5 px-5 ${index ? "border-t border-white/7" : ""}`}
        >
          <span>
            <b className="block text-sm font-medium">{title}</b>
            <small className="mt-1 block text-white/38">{note}</small>
          </span>
          <span className="shrink-0 rounded-full bg-white/[.06] px-3 py-1 text-[11px] text-white/42">
            Not connected
          </span>
        </div>
      ))}
    </div>
  );
}

function ChoiceSetting({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange(value: string): void;
}) {
  return (
    <div>
      <p className="text-sm text-white/46">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`min-h-11 rounded-full px-4 text-sm capitalize ${value === option ? "bg-white text-black" : "bg-white/7 text-white/58"}`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function ActionRows({ rows }: { rows: Array<[string, string, () => void]> }) {
  return (
    <div className="space-y-2">
      {rows.map(([title, note, action]) => (
        <button
          key={title}
          onClick={action}
          className="flex min-h-16 w-full items-center justify-between rounded-2xl bg-white/[.045] px-5 text-left"
        >
          <span>
            <b className="block">{title}</b>
            <small className="mt-1 block text-white/42">{note}</small>
          </span>
          <ChevronRight className="size-4 text-white/35" />
        </button>
      ))}
    </div>
  );
}

function HelpSettings({ onSetup }: { onSetup(): void }) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white/[.045] p-5">
        <b>Feature status</b>
        <p className="mt-3 text-sm leading-6 text-white/48">
          ReelOS reports a feature as working only after this home confirms its
          service is available. Advanced settings separates active, checking,
          paused, blocked, and later-release abilities.
        </p>
      </div>
      <div className="rounded-2xl bg-white/[.045] p-5">
        <b>ReelOS 2.5</b>
        <p className="mt-2 text-sm text-white/42">
          Automatic engine protections stay on and out of everyday controls.
        </p>
      </div>
      <button
        onClick={onSetup}
        className="flex min-h-16 w-full items-center justify-between rounded-2xl bg-white/[.045] px-5 text-left"
      >
        <span>
          <b className="block">Review first-time setup</b>
          <small className="mt-1 block text-white/42">
            Identity, taste, home connection, media provider, and screens.
          </small>
        </span>
        <ChevronRight className="size-4 text-white/35" />
      </button>
    </div>
  );
}

function DevicesWorld({
  onNavigate,
}: {
  onNavigate(view: ExperienceView): void;
}) {
  const devices = useExperienceStore((state) => state.connectedDevices);
  const setDebridConnection = useExperienceStore(
    (state) => state.setDebridConnection,
  );
  const [flow, setFlow] = useState<"provider" | "phone" | "tv" | "usb" | null>(
    null,
  );
  const provider = "torbox" as const;
  const [key, setKey] = useState("");
  const [step, setStep] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const labels = {
    provider: "Media provider",
    phone: "Phone or tablet",
    tv: "TV",
    usb: "USB installer",
  } as const;
  const continueFlow = async () => {
    if (flow !== "provider") {
      setStep(1);
      return;
    }
    setConnecting(true);
    setConnectionError("");
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          debridEnabled: true,
          debridProvider: provider,
          debridKey: key,
        }),
      });
      const result = (await response.json()) as {
        debridEnabled?: boolean;
        debridStatus?: "connected" | "failed";
        error?: string;
      };
      if (!response.ok || result.debridStatus !== "connected") {
        throw new Error(
          result.error || "The provider did not accept that key.",
        );
      }
      setDebridConnection({
        enabled: true,
        provider,
        status: "connected",
      });
      setStep(2);
      setKey("");
    } catch (reason) {
      setConnectionError(
        reason instanceof Error
          ? reason.message
          : "The provider could not be reached.",
      );
    } finally {
      setConnecting(false);
    }
  };
  return (
    <main className="mx-auto max-w-5xl px-5 pb-28 pt-10 md:px-10 lg:pb-20">
      <button
        onClick={() => onNavigate("settings")}
        className="inline-flex min-h-12 items-center gap-2 text-sm text-white/55"
      >
        <ArrowLeft className="size-4" />
        Settings
      </button>
      <h1 className="mt-6 font-display text-[clamp(3.3rem,7vw,6.4rem)] font-semibold leading-none tracking-[-.075em]">
        Every screen, one home.
      </h1>
      <p className="mt-5 max-w-xl leading-7 text-white/52">
        Add a device without repeating who you are. Connection steps stay
        specific to the thing you chose.
      </p>
      <section className="mt-12">
        <p className="text-sm text-white/42">Connected here</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {devices.map((device) => (
            <div
              key={device}
              className="flex min-h-20 items-center gap-4 rounded-2xl bg-white/[.04] px-5"
            >
              <span className="grid size-10 place-items-center rounded-full bg-white/8">
                <MonitorUp className="size-4" />
              </span>
              <span>
                <b className="block">{device}</b>
                <small className="mt-1 block text-white/42">
                  Preview-only device profile
                </small>
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="mt-12 grid gap-3 sm:grid-cols-2">
        <DeviceCard
          icon={<Radio />}
          title="Media provider"
          note="Connect the certified TorBox source path."
          onClick={() => {
            setFlow("provider");
            setStep(0);
          }}
        />
        <DeviceCard
          icon={<Smartphone />}
          title="Phone or tablet"
          note="Pair locally or from anywhere."
          onClick={() => {
            setFlow("phone");
            setStep(0);
          }}
        />
        <DeviceCard
          icon={<Tv />}
          title="TV"
          note="Install, pair, and choose its name."
          onClick={() => {
            setFlow("tv");
            setStep(0);
          }}
        />
        <DeviceCard
          icon={<Upload />}
          title="USB installer"
          note="Choose a target before any erase step."
          onClick={() => {
            setFlow("usb");
            setStep(0);
          }}
        />
      </section>
      {flow && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/70 p-3 md:place-items-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`${labels[flow]} setup`}
            className="w-full max-w-xl rounded-[1.8rem] border border-white/12 bg-[#15151a] p-6 shadow-2xl md:p-8"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/40">
                  {labels[flow]} · {step + 1} of 3
                </p>
                <h2 className="mt-2 font-display text-3xl tracking-[-.055em]">
                  {step === 0
                    ? flow === "provider"
                      ? "Connect your provider."
                      : `Add ${labels[flow].toLowerCase()}.`
                    : step === 1
                      ? flow === "usb"
                        ? "Choose the target."
                        : "Ready to hand off."
                      : "Connected."}
                </h2>
              </div>
              <button
                onClick={() => setFlow(null)}
                className="grid size-11 place-items-center rounded-full bg-white/7"
              >
                <X className="size-4" />
              </button>
            </div>
            {step === 0 && (
              <div className="mt-7">
                {flow === "provider" ? (
                  <>
                    <p className="rounded-xl bg-white/7 px-4 py-4 text-sm text-white/60">
                      TorBox · certified for this release
                    </p>
                    <label className="mt-4 block text-sm text-white/50">
                      TorBox key
                    </label>
                    <input
                      type="password"
                      value={key}
                      onChange={(event) => setKey(event.target.value)}
                      placeholder="Paste the key here"
                      className="mt-2 min-h-14 w-full rounded-xl bg-white/7 px-4 outline-none"
                    />
                    <p className="mt-3 text-xs leading-5 text-white/38">
                      Your home validates this directly with the provider and
                      stores it in its protected local state. It is never
                      returned to this screen.
                    </p>
                    {connectionError && (
                      <p className="mt-3 text-sm text-rose-300">
                        {connectionError}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="leading-7 text-white/55">
                    {flow === "phone"
                      ? "The live flow will show a QR code for local Wi-Fi or the home’s private remote address."
                      : flow === "tv"
                        ? "The live flow will offer the TV app and pair the screen to this home."
                        : "The live flow will list removable drives by name and size before asking for an erase confirmation."}
                  </p>
                )}
                <button
                  disabled={(flow === "provider" && !key.trim()) || connecting}
                  onClick={() => void continueFlow()}
                  className="mt-7 min-h-12 rounded-full bg-white px-6 text-sm font-bold text-black disabled:opacity-30"
                >
                  {connecting
                    ? "Validating…"
                    : flow === "provider"
                      ? "Validate and connect"
                      : "Continue"}
                </button>
              </div>
            )}
            {step === 1 && (
              <div className="mt-7">
                <div className="rounded-2xl bg-white/[.045] p-5">
                  <b>
                    {flow === "usb"
                      ? "No removable target selected"
                      : "Live connection required"}
                  </b>
                  <p className="mt-2 text-sm leading-6 text-white/45">
                    This review build shows the full decision path without
                    claiming an install, connection, or credential check
                    happened.
                  </p>
                </div>
                <button
                  onClick={() => setFlow(null)}
                  className="mt-7 min-h-12 rounded-full border border-white/15 px-6 text-sm"
                >
                  Close
                </button>
              </div>
            )}
            {step === 2 && (
              <div className="mt-7">
                <div className="grid size-14 place-items-center rounded-full bg-[#58d5bc] text-[#071411]">
                  <Check />
                </div>
                <p className="mt-5 leading-7 text-white/55">
                  TorBox validated this home's key. Provider-backed actions can now use the
                  connected source policy.
                </p>
                <button
                  onClick={() => setFlow(null)}
                  className="mt-7 min-h-12 rounded-full border border-white/15 px-6 text-sm"
                >
                  Done
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function DeviceCard({
  icon,
  title,
  note,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  note: string;
  onClick(): void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-32 items-center gap-5 rounded-[1.5rem] bg-white/[.035] p-5 text-left"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/7 [&>svg]:size-5">
        {icon}
      </span>
      <span>
        <b className="block text-lg">{title}</b>
        <small className="mt-2 block leading-5 text-white/44">{note}</small>
      </span>
    </button>
  );
}

function AmbianceWorld({
  onNavigate,
}: {
  onNavigate(view: ExperienceView): void;
}) {
  const [mode, setMode] = useState<"art" | "fire" | "photos">("art");
  const [sound, setSound] = useState(true);
  const [timer, setTimer] = useState("30 min");
  const [calibrating, setCalibrating] = useState(false);
  return (
    <main className="min-h-[calc(100dvh-76px)] pb-28 lg:pb-12">
      <section className="relative min-h-[520px] overflow-hidden">
        <img
          src={
            mode === "art"
              ? TITLE_BY_EXPERIENCE_ID["in-the-mood-for-love"]?.backdrop
              : mode === "fire"
                ? TITLE_BY_EXPERIENCE_ID["holdovers"]?.backdrop
                : TITLE_BY_EXPERIENCE_ID["my-neighbor-totoro"]?.backdrop
          }
          alt=""
          className="absolute inset-0 size-full object-cover opacity-48"
        />
        <span className="absolute inset-0 bg-[linear-gradient(0deg,#080809,transparent_70%),linear-gradient(90deg,#080809aa,transparent)]" />
        <div className="relative mx-auto flex min-h-[520px] max-w-[1400px] items-end px-5 pb-12 md:px-10">
          <div>
            <button
              onClick={() => onNavigate("settings")}
              className="inline-flex min-h-12 items-center gap-2 text-sm text-white/60"
            >
              <ArrowLeft className="size-4" />
              Settings
            </button>
            <h1 className="mt-5 font-display text-[clamp(3.5rem,8vw,7rem)] font-semibold leading-none tracking-[-.075em]">
              Let the home exhale.
            </h1>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-[1400px] px-5 md:px-10">
        <div className="grid gap-3 md:grid-cols-3">
          {(
            [
              ["art", "Artwork", <SunMedium />],
              ["fire", "Firelight", <Flame />],
              ["photos", "Private photos", <SunMedium />],
            ] as const
          ).map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`flex min-h-20 items-center gap-4 rounded-2xl px-5 text-left ${mode === id ? "bg-white text-black" : "bg-white/[.045]"}`}
            >
              <span className="[&>svg]:size-5">{icon}</span>
              <b>{label}</b>
            </button>
          ))}
        </div>
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          <ToggleRow
            title="Ambient sound"
            note="Fire, rain, or quiet depending on the chosen scene."
            active={sound}
            onChange={() => setSound(!sound)}
          />
          <div className="flex min-h-24 items-center justify-between gap-5 rounded-2xl bg-white/[.035] p-5">
            <span>
              <b className="block">Supported home lights</b>
              <small className="mt-2 block leading-5 text-white/43">
                A Hue, Nanoleaf, or Matter bridge and active screen color sync are
                required.
              </small>
            </span>
            <span className="shrink-0 rounded-full bg-white/[.06] px-3 py-1 text-[11px] text-white/42">
              Not connected
            </span>
          </div>
          <div className="flex min-h-24 items-center justify-between gap-5 rounded-2xl bg-white/[.035] p-5">
            <span>
              <b className="block">Living posters</b>
              <small className="mt-2 block leading-5 text-white/43">
                Verified title loops appear automatically; still artwork remains
                the fallback.
              </small>
            </span>
            <span className="shrink-0 rounded-full bg-white/[.06] px-3 py-1 text-[11px] text-white/42">
              Assets required
            </span>
          </div>
          <div className="rounded-2xl bg-white/[.035] p-5">
            <p className="text-sm text-white/45">Sleep after</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["15 min", "30 min", "1 hour", "Never"].map((item) => (
                <button
                  key={item}
                  onClick={() => setTimer(item)}
                  className={`min-h-11 rounded-full px-4 text-sm ${timer === item ? "bg-white text-black" : "bg-white/7"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setCalibrating(true)}
            className="flex min-h-28 items-center justify-between rounded-2xl bg-white/[.035] p-5 text-left"
          >
            <span>
              <b className="block">Tune sound for this space</b>
              <small className="mt-2 block max-w-sm leading-5 text-white/43">
                Preview the guided phone measurement. Applying its EQ still
                needs a supported audio output.
              </small>
            </span>
            <Speaker className="size-5" />
          </button>
        </div>
      </div>
      {calibrating && (
        <SimpleDialog
          title="Acoustic space tuning"
          onClose={() => setCalibrating(false)}
        >
          <p className="leading-7 text-white/55">
            Place your phone where you usually sit. A finished adapter will
            request microphone permission, play a short TV sweep, measure the
            response, and confirm that the named screen actually applied it.
          </p>
          <div className="mt-6 rounded-2xl bg-white/[.045] p-5 text-sm text-white/45">
            No tone plays in this interface preview.
          </div>
        </SimpleDialog>
      )}
    </main>
  );
}

function ToggleRow({
  title,
  note,
  active,
  onChange,
}: {
  title: string;
  note: string;
  active: boolean;
  onChange(): void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`group flex w-full min-h-[5.5rem] items-center justify-between gap-5 rounded-2xl border p-5 text-left transition-all duration-300 ${
        active
          ? "border-amber-400/40 bg-white/[0.07] shadow-[0_0_24px_rgba(245,197,24,0.08)]"
          : "border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.05]"
      }`}
    >
      <span className="flex-1 min-w-0 pr-2">
        <b className={`block text-base font-semibold tracking-tight transition-colors duration-200 ${active ? "text-amber-300" : "text-white"}`}>
          {title}
        </b>
        <small className="mt-1.5 block text-xs sm:text-sm leading-5 text-white/50">
          {note}
        </small>
      </span>
      <span
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors duration-300 ease-in-out ${
          active
            ? "bg-gradient-to-r from-amber-400 to-amber-500 shadow-[0_0_12px_rgba(245,197,24,0.4)]"
            : "bg-white/15"
        }`}
      >
        <span
          className={`pointer-events-none inline-block size-5 transform rounded-full bg-black shadow-md transition-transform duration-300 ease-in-out ${
            active ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

function CompanionWorld({
  onNavigate,
  seed,
}: {
  onNavigate(view: ExperienceView): void;
  seed?: ReturnType<typeof resolveCompanionSeed>;
}) {
  const profile = activeExperienceProfile(useExperienceStore());
  const profiles = useExperienceStore((state) => state.profiles);
  const childProfiles = useMemo(
    () => profiles.filter((item) => item.isChild),
    [profiles],
  );
  const kidsPresentIds = useExperienceStore((state) => state.kidsPresentIds);
  const toggleKidPresent = useExperienceStore(
    (state) => state.toggleKidPresent,
  );
  const [section, setSection] = useState<
    "remote" | "story" | "people" | "music" | "craft"
  >("remote");
  const [companion, setCompanion] = useState<ActiveCompanionState>({
    active: false,
    session: null,
    dossier: null,
  });
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [commandState, setCommandState] = useState<string | null>(null);
  const session = companion.session;
  const sessionCatalogTitle = session?.titleId
    ? TITLE_BY_EXPERIENCE_ID[session.titleId]
    : undefined;
  const seedMatchesSession = Boolean(
    seed?.title && session &&
    (seed.title.id === session.titleId || seed.title.playbackId === session.titleId),
  );
  const companionTitle = companion.active
    ? sessionCatalogTitle || (seedMatchesSession ? seed?.title : undefined)
    : seed?.title;
  const dossier = companion.dossier;
  const progress = companionProgress(session);
  const syncCompanion = async (signal?: AbortSignal) => {
    try {
      const active = await loadActiveCompanionState(signal);
      if (!active.active && seed?.title) {
        active.dossier = await loadCompanionDossier(
          seed.title.playbackId || seed.title.id,
          seed.season,
          seed.episode,
          signal,
        );
      }
      setCompanion(active);
      setSyncError(null);
    } catch (error) {
      if (signal?.aborted) return;
      setSyncError(error instanceof Error ? error.message : "Companion could not reach the player.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };
  useEffect(() => {
    const controller = new AbortController();
    let stopped = false;
    let timer: number | undefined;
    const poll = async () => {
      if (stopped || document.visibilityState === "hidden") return;
      await syncCompanion(controller.signal);
      if (!stopped) timer = window.setTimeout(poll, 5_000);
    };
    const resume = () => {
      if (document.visibilityState !== "visible" || stopped) return;
      if (timer) window.clearTimeout(timer);
      timer = undefined;
      void poll();
    };
    document.addEventListener("visibilitychange", resume);
    void poll();
    return () => {
      stopped = true;
      controller.abort();
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [seed?.title.id, seed?.season, seed?.episode]);

  const sendRemote = async (
    action: "play" | "pause" | "seek",
    payload: Record<string, number> = {},
  ) => {
    if (!session?.sessionId) return;
    setCommandState("Sending…");
    try {
      await queueCompanionCommand(session.sessionId, action, payload);
      setCommandState("Sent to the TV");
      window.setTimeout(() => setCommandState(null), 2_500);
      window.setTimeout(() => void syncCompanion(), 500);
    } catch (error) {
      setCommandState(error instanceof Error ? error.message : "The TV did not accept that command.");
    }
  };

  const nowPlayingTitle = session?.seriesName || session?.titleName || dossier?.title || companionTitle?.title;
  const playbackDetail = companion.active
    ? progress.remainingMinutes !== null
      ? `${progress.remainingMinutes} minutes remaining`
      : progress.positionSeconds > 0
        ? `${Math.floor(progress.positionSeconds / 60)} minutes in`
        : "Playback position is syncing"
    : seed
      ? "No active TV playback"
      : "Nothing is playing right now";
  return (
    <main className="mx-auto max-w-5xl px-5 pb-28 pt-10 md:px-10 lg:pb-16">
      <button
        onClick={() => onNavigate("home")}
        className="inline-flex min-h-12 items-center gap-2 text-sm text-white/55"
      >
        <ArrowLeft className="size-4" />
        Home
      </button>
      <div className="mt-6 rounded-[2rem] bg-[linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.02))] p-7 md:p-9">
        <p className="text-xs uppercase tracking-[.18em] text-white/38">
          {companion.active
            ? `Playing on ${session?.device || "Home TV"}`
            : loading
              ? "Finding your player"
              : "Companion"}
        </p>
        <div className="mt-4 flex items-center gap-5">
          {companionTitle?.poster ? (
            <img
              src={companionTitle.poster}
              alt=""
              className="h-24 w-16 rounded-lg object-cover"
            />
          ) : (
            <div className="grid h-24 w-16 shrink-0 place-items-center rounded-lg bg-white/7 text-white/30">
              <Tv className="size-5" />
            </div>
          )}
          <div>
            <h1 className="font-display text-4xl tracking-[-.055em]">
              {nowPlayingTitle || "Your TV is quiet"}
            </h1>
            <p className="mt-2 text-sm text-white/46">
              {(session?.seasonNumber || seed?.season) && (session?.episodeNumber || seed?.episode)
                ? `Season ${session?.seasonNumber || seed?.season} · Episode ${session?.episodeNumber || seed?.episode} · `
                : session?.seasonNumber || seed?.season
                  ? `Season ${session?.seasonNumber || seed?.season} · `
                  : ""}
              {playbackDetail} · {profile.name}
            </p>
            {syncError && <p className="mt-2 text-sm text-rose-200/70">{syncError}</p>}
          </div>
        </div>
        <div className="mt-7 flex items-center justify-center gap-5">
          <button
            onClick={() => void sendRemote("seek", { deltaTicks: companionSeekTicks(-10) })}
            disabled={!companion.active || commandState === "Sending…"}
            aria-label="Go back ten seconds"
            className="grid size-12 place-items-center rounded-full bg-white/8 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            onClick={() => void sendRemote(session?.isPaused ? "play" : "pause")}
            disabled={!companion.active || commandState === "Sending…"}
            aria-label={session?.isPaused ? "Play" : "Pause"}
            className="grid size-16 place-items-center rounded-full bg-white text-black disabled:cursor-not-allowed disabled:opacity-30"
          >
            {session?.isPaused ? (
              <Play className="size-5 fill-current" />
            ) : (
              <Pause className="size-5 fill-current" />
            )}
          </button>
          <button
            onClick={() => void sendRemote("seek", { deltaTicks: companionSeekTicks(10) })}
            disabled={!companion.active || commandState === "Sending…"}
            aria-label="Go forward ten seconds"
            className="grid size-12 place-items-center rounded-full bg-white/8 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
        {commandState && (
          <p className="mt-4 text-center text-xs text-white/42" role="status">{commandState}</p>
        )}
      </div>
      {childProfiles.length > 0 && (
        <section className="mt-6 rounded-[1.5rem] bg-white/[.035] p-5">
          <p className="text-sm text-white/42">Who’s watching?</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {childProfiles.map((child) => (
              <button
                key={child.id}
                onClick={() => {
                  const nextIds = kidsPresentIds.includes(child.id)
                    ? kidsPresentIds.filter((id) => id !== child.id)
                    : [...kidsPresentIds, child.id];
                  toggleKidPresent(child.id);
                  void syncFamilyPresence(nextIds).catch(() => undefined);
                }}
                className={`min-h-11 rounded-full px-4 text-sm ${kidsPresentIds.includes(child.id) ? "bg-[#58d5bc] text-[#071411]" : "bg-white/7"}`}
              >
                {kidsPresentIds.includes(child.id)
                  ? `${child.name} here`
                  : `${child.name} in bed`}
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="mt-6 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
        {(
          [
            ["remote", "Remote"],
            ["story", "Catch me up"],
            ["people", "Who is that?"],
            ["music", "What’s playing?"],
            ["craft", "How they made it"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm ${section === id ? "bg-white text-black" : "bg-white/7"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <CompanionSection
        section={section}
        active={companion.active}
        dossier={dossier}
      />
    </main>
  );
}

function CompanionSection({
  section,
  active,
  dossier,
}: {
  section: "remote" | "story" | "people" | "music" | "craft";
  active: boolean;
  dossier: CompanionDossier | null;
}) {
  const unavailable = dossier?.message || "Verified context is not available for this moment yet.";
  const content = section === "remote"
    ? {
        title: "A quiet remote",
        body: active
          ? "Commands are sent to the active player. The screen updates only when the player confirms its state."
          : "Start playing something on an authorized ReelOS screen to use the remote.",
      }
    : section === "story"
      ? {
          title: "The story so far",
          body: dossier?.storySoFar.length
            ? dossier.storySoFar.join(" ")
            : unavailable,
        }
      : section === "people"
        ? {
            title: "Who is that?",
            body: dossier?.whoIsWho.length
              ? dossier.whoIsWho.map((person) => `${person.name} — ${person.actor}. ${person.role}`).join(" ")
              : unavailable,
          }
        : section === "music"
          ? {
              title: "What’s playing?",
              body: "No verified soundtrack cue is available for this playback position.",
            }
          : {
              title: "How they made it",
              body: "No verified production context is available for this playback position.",
            };
  return (
    <section className="mt-6 min-h-64 rounded-[1.7rem] bg-white/[.035] p-7">
      <h2 className="font-display text-3xl tracking-[-.055em]">{content.title}</h2>
      <p className="mt-4 max-w-xl leading-7 text-white/48">{content.body}</p>
      <p className="mt-8 text-xs text-white/30">
        {dossier?.spoilerShield.active
          ? "Verified only through the current playback position."
          : "ReelOS will not imply spoiler protection without a verified timeline."}
      </p>
    </section>
  );
}

function PartyWorld({
  onNavigate,
  onOpen,
}: {
  onNavigate(view: ExperienceView): void;
  onOpen(title: ExperienceTitle): void;
}) {
  const allProfiles = useExperienceStore((state) => state.profiles);
  const activeProfileId = useExperienceStore((state) => state.activeProfileId);
  const profiles = useMemo(
    () => allProfiles.filter((item) => !item.isGuest),
    [allProfiles],
  );
  return (
    <WatchTogetherWorld
      profiles={profiles}
      activeProfileId={activeProfileId}
      onBack={() => onNavigate("family")}
      onOpen={onOpen}
    />
  );
}

function SetupWorld({
  onNavigate,
  onComplete,
}: {
  onNavigate(view: ExperienceView): void;
  onComplete(): void;
}) {
  const draft = useExperienceStore((state) => state.setupDraft);
  const initialProfile = activeExperienceProfile(useExperienceStore.getState());
  const [ownerId] = useState(() => draft.ownerId || initialProfile.id || createClientId("profile-"));
  const setSetupDraft = useExperienceStore((state) => state.setSetupDraft);
  const finishOnboarding = useExperienceStore(
    (state) => state.finishOnboarding,
  );
  const setDebridEnabled = useExperienceStore(
    (state) => state.setDebridEnabled,
  );
  const setDebridConnection = useExperienceStore(
    (state) => state.setDebridConnection,
  );
  const [step, setStep] = useState(Math.min(draft.step ?? 0, 7));
  const [name, setName] = useState(() => {
    const raw = draft.name ?? initialProfile.name;
    return raw === "This device" ? "" : raw;
  });
  const [color, setColor] = useState(() => {
    const raw = draft.color ?? initialProfile.color;
    return raw === "#4f8cff" ? "#f5c518" : (raw || "#f5c518");
  });
  const [pinEnabled, setPinEnabled] = useState(draft.pinEnabled ?? initialProfile.pinEnabled ?? false);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [addHouseholdNow, setAddHouseholdNow] = useState(draft.addHouseholdNow ?? Boolean(draft.householdMembers?.length));
  const [memberName, setMemberName] = useState(draft.memberName ?? "");
  const [memberIsChild, setMemberIsChild] = useState(draft.memberIsChild ?? false);
  const [removingMember, setRemovingMember] = useState(false);
  const [householdError, setHouseholdError] = useState("");
  const [childExitPin, setChildExitPin] = useState("");
  const [childExitPinConfirm, setChildExitPinConfirm] = useState("");
  const [householdMembers, setHouseholdMembers] = useState<
    Array<{ id: string; name: string; isChild: boolean }>
  >(() => (draft.householdMembers ?? useExperienceStore.getState().profiles
    .filter((member) => member.id !== ownerId && !member.isGuest)
    .map((member) => ({ id: member.id, name: member.name, isChild: Boolean(member.isChild) })))
    .map((member) => ({ ...member, id: member.id || createClientId("profile-") })));
  const [guidance, setGuidance] = useState<"hand" | "balanced" | "free">(
    draft.guidance ?? "balanced",
  );
  const [reactions, setReactions] = useState<Record<string, Reaction>>(draft.reactions ?? {});
  const [dismissed, setDismissed] = useState<string[]>(draft.dismissed ?? []);
  const [lessLike, setLessLike] = useState<string[]>(draft.lessLike ?? []);
  const [path, setPath] = useState<"new" | "existing">("new");
  const [providerKey, setProviderKey] = useState("");
  const [sourceChoice, setSourceChoice] = useState<"public" | "torbox">(
    draft.sourceChoice === "torbox" ? "torbox" : "public",
  );
  const [sourceConnecting, setSourceConnecting] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [device, setDevice] = useState<"phone" | "tv" | "usb">(
    draft.device ?? (nativePlatform() === "android-tv" ? "tv" : "phone"),
  );
  const [creating, setCreating] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [createError, setCreateError] = useState("");
  const savingHousehold = useRef(false);
  useEffect(() => {
    // Only non-secret inputs and stable IDs survive reload.
    setSetupDraft({ ownerId, step, name, color, pinEnabled, householdMembers, guidance,
      reactions, dismissed, lessLike, path, sourceChoice, device, addHouseholdNow, memberName, memberIsChild });
  }, [ownerId, step, name, color, pinEnabled, householdMembers, guidance, reactions,
    dismissed, lessLike, path, sourceChoice, device, addHouseholdNow, memberName, memberIsChild, setSetupDraft]);
  const removeHouseholdMember = async (id: string) => {
    if (removingMember) return;
    setRemovingMember(true); setHouseholdError("");
    try {
      if (useExperienceStore.getState().profiles.some((member) => member.id === id)) {
        const response = await fetch(`/api/profiles/${encodeURIComponent(id)}`, { method: "DELETE" });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || "This person could not be removed. Please retry.");
        useExperienceStore.setState((state) => ({ profiles: state.profiles.filter((member) => member.id !== id) }));
      }
      setHouseholdMembers((members) => members.filter((member) => member.id !== id));
    } catch (reason) { setHouseholdError(reason instanceof Error ? reason.message : "This person could not be removed."); }
    finally { setRemovingMember(false); }
  };
  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); }, [step]);
  const prepareHousehold = async () => {
    if (path === "existing") throw new Error("Connect to your existing home before creating profiles here.");
    if (savingHousehold.current) throw new Error("Your home is still saving. Please wait.");
    savingHousehold.current = true;
    try {
      const ids = await saveSetupHousehold(
        { ownerId, name, color, pinEnabled, householdMembers, guidance, reactions, dismissed, lessLike },
        { pin, childExitPin }, useExperienceStore.getState().profiles,
      );
      const loaded = await loadExperienceProfiles();
      // Keep this setup screen mounted while updating the acknowledged roster.
      useExperienceStore.setState({ profiles: loaded.profiles, activeProfileId: loaded.activeId || "" });
      return ids;
    } finally { savingHousehold.current = false; }
  };
  const create = async () => {
    if (creating) return;
    setCreating(true);
    setCreateError("");
    try {
      const ids = await prepareHousehold();
      await completeExperienceSetup(ids);
      setExpanding(true);
      await new Promise((resolve) => setTimeout(resolve, 750));
      finishOnboarding();
      onComplete();
      onNavigate("home");
    } catch (reason) {
      setCreateError(reason instanceof Error ? reason.message : "This home could not finish setup.");
      setExpanding(false);
    } finally { setCreating(false); }
  };
  const continueWithPublicSources = async () => {
    if (sourceConnecting) return;
    setSourceConnecting(true);
    setSourceError("");
    try {
      await prepareHousehold();
      await savePublicSourceChoice();
      setDebridEnabled(false);
      setStep(7);
    } catch (reason) {
      setSourceError(reason instanceof Error ? reason.message : "Your source choice could not be saved.");
    } finally { setSourceConnecting(false); }
  };
  const connectSetupProvider = async () => {
    if (sourceConnecting) return;
    setSourceConnecting(true);
    setSourceError("");
    try {
      await prepareHousehold();
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          debridEnabled: true,
          debridProvider: "torbox",
          debridKey: providerKey,
        }),
      });
      const result = (await response.json()) as {
        debridStatus?: "connected" | "failed";
        error?: string;
      };
      if (!response.ok || result.debridStatus !== "connected") {
        throw new Error(
          result.error || "The provider did not accept that key.",
        );
      }
      setDebridConnection({
        enabled: true,
        provider: "torbox",
        status: "connected",
      });
      setProviderKey("");
      setStep(7);
    } catch (reason) {
      setSourceError(
        reason instanceof Error
          ? reason.message
          : "The provider could not be reached.",
      );
    } finally {
      setSourceConnecting(false);
    }
  };
  const steps = [
    "You",
    "Color",
    "Household",
    "Guidance",
    "Taste",
    "Home",
    "Sources",
    "Screens",
  ];
  return (
    <main
      className="reelos-setup relative flex min-h-dvh flex-col overflow-y-auto px-5 py-8 md:px-10 pb-40 md:pb-16"
      style={
        {
          "--reelos-favorite": color,
          "--color-gold": color,
          "--color-gold-bright": color,
        } as CSSProperties
      }
    >
      <div
        className={`reelos-setup-orb reelos-setup-orb-a ${expanding ? "is-expanding" : ""}`}
        style={{ backgroundColor: color }}
      />
      <div
        className={`reelos-setup-orb reelos-setup-orb-b ${expanding ? "is-expanding" : ""}`}
        style={{ backgroundColor: color }}
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col">
        <div className="flex items-center justify-between">
          <button
            aria-label="Previous setup step"
            disabled={step === 0 || sourceConnecting || creating}
            onClick={() => (step > 0 ? setStep(step - 1) : onNavigate("home"))}
            className="grid size-12 place-items-center rounded-full border border-white/12 hover:bg-white/10 active:scale-95 transition-all"
          >
            <ArrowLeft className="size-4" />
          </button>
          <span className="text-xs font-medium tracking-wide text-white/50">
            {steps[step]} · {step + 1} of {steps.length}
          </span>
          <span className="text-xs text-white/40">You can close this and return later</span>
        </div>
        <div className="flex flex-1 items-start justify-center py-8 md:py-12">
          {step === 0 && (
            <SetupPanel
              title="Hi, what should we call you?"
              note="Your profile keeps its own taste, history, books, and appearance."
            >
              <div className="space-y-6">
                <LuxuryInputCard
                  label="Profile Name"
                  placeholder="What should we call you?"
                  value={name}
                  onChange={setName}
                  autoFocus
                />
                <ToggleRow
                  title="Add a passcode"
                  note="Optional privacy for an adult profile."
                  active={pinEnabled}
                  onChange={() => setPinEnabled(!pinEnabled)}
                />
                {pinEnabled && (
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
                    <div className="grid gap-6 sm:grid-cols-2">
                      <TactilePinInput
                        label="Create 4-Digit Passcode"
                        value={pin}
                        onChange={setPin}
                        autoFocus
                      />
                      <TactilePinInput
                        label="Confirm Passcode"
                        value={pinConfirm}
                        onChange={setPinConfirm}
                        error={pinConfirm.length === 4 && pin !== pinConfirm}
                      />
                    </div>
                    {pin.length === 4 && pinConfirm.length === 4 && (
                      <p className={`mt-4 text-center text-xs font-medium ${pin === pinConfirm ? "text-amber-400" : "text-rose-400"}`}>
                        {pin === pinConfirm ? "✓ Passcodes match perfectly" : "Passcodes do not match"}
                      </p>
                    )}
                  </div>
                )}
                <ToggleRow
                  title="Set up this household too"
                  note="Add adults and children before everyone shapes their own taste."
                  active={addHouseholdNow}
                  onChange={() => setAddHouseholdNow(!addHouseholdNow)}
                />
                <SetupNext
                  disabled={!name.trim() || (pinEnabled && (pin.length !== 4 || pin !== pinConfirm))}
                  onClick={() => setStep(1)}
                />
              </div>
            </SetupPanel>
          )}
          {step === 1 && (
            <SetupPanel
              title="And what is your favorite color?"
              note="It will breathe through your profile without coloring every surface."
            >
              <div className="mt-9 flex flex-wrap gap-4">
                {[
                  "#2563eb",
                  "#e11d48",
                  "#f97316",
                  "#eab308",
                  "#22c55e",
                  "#06b6d4",
                  "#a855f7",
                  "#ec4899",
                ].map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      setColor(item);
                      setSetupDraft({
                        ...useExperienceStore.getState().setupDraft,
                        color: item,
                      });
                    }}
                    className={`size-16 rounded-full ${color === item ? "scale-110 ring-4 ring-white/30" : ""}`}
                    style={{
                      backgroundColor: item,
                      boxShadow: `0 0 34px ${item}66`,
                    }}
                  />
                ))}
              </div>
              <SetupNext onClick={() => setStep(2)} />
            </SetupPanel>
          )}
          {step === 2 && (
            <SetupPanel
              title={
                addHouseholdNow
                  ? "Who else calls this home theirs?"
                  : "Just you for now?"
              }
              note="Everyone gets a private taste, history, books, and color. Children also get boundaries and a required exit PIN."
            >
              {addHouseholdNow ? (
                <>
                  <div className="mt-8 space-y-2">
                    {householdMembers.map((member, index) => (
                      <div
                        key={`${member.name}-${index}`}
                        className="flex min-h-14 items-center gap-3 rounded-2xl bg-white/[.055] px-4"
                      >
                        <span className="grid size-9 place-items-center rounded-full bg-white/10 text-sm font-bold">
                          {member.name[0]?.toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <b className="block truncate">{member.name}</b>
                          <small className="text-white/42">
                            {member.isChild
                              ? "Child · exit PIN required"
                              : "Adult · optional private PIN later"}
                          </small>
                        </span>
                        <button
                          onClick={() => void removeHouseholdMember(member.id)}
                          disabled={removingMember}
                          aria-label={`Remove ${member.name}`}
                          className="grid size-12 place-items-center rounded-full hover:bg-white/8"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 rounded-3xl border border-white/10 bg-white/[.03] p-5 backdrop-blur-xl">
                    <LuxuryInputCard
                      label="Household Member Name"
                      placeholder="e.g. Maya or Sam"
                      value={memberName}
                      onChange={setMemberName}
                    />
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setMemberIsChild(false)}
                        className={`min-h-12 rounded-2xl font-semibold text-sm transition-all ${!memberIsChild ? "bg-amber-400 text-black shadow-[0_0_16px_rgba(245,197,24,0.3)]" : "bg-white/[0.05] text-white/70 hover:bg-white/[0.08]"}`}
                      >
                        Adult
                      </button>
                      <button
                        type="button"
                        onClick={() => setMemberIsChild(true)}
                        className={`min-h-12 rounded-2xl font-semibold text-sm transition-all ${memberIsChild ? "bg-amber-400 text-black shadow-[0_0_16px_rgba(245,197,24,0.3)]" : "bg-white/[0.05] text-white/70 hover:bg-white/[0.08]"}`}
                      >
                        Child
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!memberName.trim()) return;
                        setHouseholdMembers((current) => [
                          ...current,
                          { id: createClientId("profile-"), name: memberName.trim(), isChild: memberIsChild },
                        ]);
                        setMemberName("");
                      }}
                      disabled={!memberName.trim()}
                      className="mt-4 min-h-12 w-full rounded-2xl bg-white/10 px-5 text-sm font-bold text-white hover:bg-white/20 active:scale-[0.98] transition-all disabled:opacity-30 disabled:pointer-events-none"
                    >
                      Add to this home
                    </button>
                  </div>
                  {householdMembers.some((member) => member.isChild) && (
                    <div className="mt-6 rounded-3xl border border-white/10 bg-white/[.03] p-6 backdrop-blur-xl">
                      <b className="block text-base font-semibold text-white">Child exit PIN</b>
                      <p className="mt-1 text-sm leading-6 text-white/50">
                        Required to leave any child profile. It is stored securely by this home.
                      </p>
                      <div className="mt-5 grid gap-6 sm:grid-cols-2">
                        <TactilePinInput
                          label="Exit PIN"
                          value={childExitPin}
                          onChange={setChildExitPin}
                        />
                        <TactilePinInput
                          label="Confirm Exit PIN"
                          value={childExitPinConfirm}
                          onChange={setChildExitPinConfirm}
                          error={childExitPinConfirm.length === 4 && childExitPin !== childExitPinConfirm}
                        />
                      </div>
                      {childExitPin.length === 4 && childExitPinConfirm.length === 4 && (
                        <p className={`mt-3 text-center text-xs font-medium ${childExitPin === childExitPinConfirm ? "text-amber-400" : "text-rose-400"}`}>
                          {childExitPin === childExitPinConfirm ? "✓ Exit PINs match" : "Exit PINs do not match"}
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={() => setAddHouseholdNow(true)}
                  className="mt-9 min-h-16 rounded-2xl bg-white/[.055] px-6 text-left"
                >
                  <b className="block">Add people now</b>
                  <span className="mt-1 block text-sm text-white/45">
                    Adults and children can also be added from Family later.
                  </span>
                </button>
              )}
              {householdError && <p role="alert" className="mt-3 text-sm text-rose-300">{householdError}</p>}
              <SetupNext
                disabled={removingMember || (addHouseholdNow &&
                  householdMembers.some((member) => member.isChild && !useExperienceStore.getState().profiles.some((saved) => saved.id === member.id && saved.pinEnabled)) &&
                  (childExitPin.length !== 4 || childExitPin !== childExitPinConfirm)
                )}
                label="Continue"
                onClick={() => setStep(3)}
              />
            </SetupPanel>
          )}
          {step === 3 && (
            <SetupPanel
              title="How much help feels right?"
              note="This changes guidance, never what you are allowed to do."
            >
              <div className="mt-9 grid gap-3 md:grid-cols-2">
                {(
                  [
                    [
                      "hand",
                      "Hold my hand",
                      "Gentle context and clear next steps.",
                    ],
                    [
                      "balanced",
                      "Balanced",
                      "Quiet defaults with help close by.",
                    ],
                    [
                      "free",
                      "I’ll explore",
                      "Fewer prompts and wider discovery.",
                    ],
                  ] as const
                ).map(([id, label, note]) => (
                  <button
                    key={id}
                    onClick={() => setGuidance(id)}
                    className={`min-h-40 rounded-[1.5rem] p-5 text-left ${guidance === id ? "bg-white text-black" : "bg-white/[.045]"}`}
                  >
                    <b className="text-lg">{label}</b>
                    <span
                      className={`mt-3 block text-sm leading-6 ${guidance === id ? "text-black/55" : "text-white/45"}`}
                    >
                      {note}
                    </span>
                  </button>
                ))}
              </div>
              <SetupNext onClick={() => setStep(4)} />
            </SetupPanel>
          )}
          {step === 4 && (
            <SetupPanel
              title="Show us what pulls you in."
              note="Tap to like, tap again to love. Make anything Cozy, dismiss what you do not know, and stay for as long as it is fun."
              wide
            >
              <EndlessTasteField
                setup
                color={color}
                reactions={reactions}
                dismissedIds={dismissed}
                lessLikeIds={lessLike}
                onReact={(itemId, reaction) => {
                  setReactions((current) => {
                    const next = { ...current };
                    if (reaction) next[itemId] = reaction;
                    else delete next[itemId];
                    return next;
                  });
                  setDismissed((current) => current.filter((id) => id !== itemId));
                  setLessLike((current) => current.filter((id) => id !== itemId));
                }}
                onDismiss={(itemId) => {
                  setReactions((current) => {
                    const next = { ...current };
                    delete next[itemId];
                    return next;
                  });
                  setLessLike((current) => current.filter((id) => id !== itemId));
                  setDismissed((current) => [...new Set([...current, itemId])]);
                }}
                onToggleLessLike={(itemId) => {
                  setLessLike((current) => {
                    const removing = current.includes(itemId);
                    if (!removing) {
                      setReactions((reactionsNow) => {
                        const next = { ...reactionsNow };
                        delete next[itemId];
                        return next;
                      });
                      setDismissed((dismissedNow) => dismissedNow.filter((id) => id !== itemId));
                    }
                    return removing
                      ? current.filter((id) => id !== itemId)
                      : [...current, itemId];
                  });
                }}
              />
              <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
                <div className="pointer-events-auto flex flex-wrap justify-center gap-2 rounded-full border border-white/10 bg-black/72 p-2 shadow-2xl backdrop-blur-2xl [&>button]:mt-0">
                  <SetupNext
                    label="That feels like me"
                    onClick={() => setStep(5)}
                  />
                  <button
                    onClick={() => setStep(5)}
                    className="min-h-12 rounded-full border border-white/14 px-6 text-sm"
                  >
                    Continue without choosing
                  </button>
                </div>
              </div>
            </SetupPanel>
          )}
          {step === 5 && (
            <SetupPanel
              title="Where does this home begin?"
              note="Every installation is its own home unless you connect it to one you already trust."
            >
              <div className="mt-9 grid gap-3 md:grid-cols-2">
                <button
                  onClick={() => setPath("new")}
                  className={`min-h-44 rounded-[1.5rem] p-6 text-left ${path === "new" ? "bg-white text-black" : "bg-white/[.045]"}`}
                >
                  <Home className="size-5" />
                  <b className="mt-8 block text-xl">Start this home</b>
                  <span className="mt-2 block text-sm opacity-55">
                    Create the first ReelOS home on this machine.
                  </span>
                </button>
                <button
                  disabled
                  aria-disabled="true"
                  className="min-h-44 rounded-[1.5rem] bg-white/[.025] p-6 text-left text-white/38"
                >
                  <Radio className="size-5" />
                  <b className="mt-8 block text-xl">Join an existing home</b>
                  <span className="mt-2 block text-sm opacity-55">
                    Pair this device from Devices after the first home is ready.
                  </span>
                </button>
              </div>
              <SetupNext onClick={() => setStep(6)} />
            </SetupPanel>
          )}
          {step === 6 && (
            <SetupPanel
              title="What can this home play?"
              note="Start with your own and verified public-domain media, or connect a debrid provider for the wider source pipeline. You can change this later."
            >
              <div className="mt-9 grid gap-3 md:grid-cols-3">
                <button
                  onClick={() => setSourceChoice("public")}
                  className={`min-h-36 rounded-[1.5rem] p-5 text-left ${sourceChoice === "public" ? "bg-white text-black" : "bg-white/[.045]"}`}
                >
                  <b className="text-lg">Mine + public domain</b>
                  <span className="mt-3 block text-sm opacity-55">
                    Clean, honest, and ready without a provider.
                  </span>
                </button>
                <button
                  onClick={() => setSourceChoice("torbox")}
                  className={`min-h-36 rounded-[1.5rem] p-5 text-left ${sourceChoice === "torbox" ? "bg-white text-black" : "bg-white/[.045]"}`}
                >
                  <b className="text-lg">Connect TorBox</b>
                  <span className="mt-3 block text-sm opacity-55">
                    Validate a key before provider titles become available.
                  </span>
                </button>
              </div>
              {sourceChoice !== "public" && (
                <div className="mt-6 space-y-3">
                  <LuxuryInputCard
                    label="TorBox API Key"
                    type="password"
                    value={providerKey}
                    onChange={setProviderKey}
                    placeholder="Enter your personal API key"
                    autoFocus
                  />
                  <p className="text-xs leading-5 text-white/40">
                    The key is validated directly and stored only in protected
                    state on this home.
                  </p>
                </div>
              )}
              {sourceError && <p role="alert" className="mt-3 text-sm text-rose-300">{sourceError}</p>}
              <SetupNext
                disabled={
                  sourceConnecting ||
                  (sourceChoice !== "public" && !providerKey.trim())
                }
                label={
                  sourceConnecting
                    ? "Validating…"
                    : sourceChoice !== "public"
                      ? "Validate and continue"
                      : "Use public and personal media"
                }
                onClick={() =>
                  sourceChoice !== "public"
                    ? void connectSetupProvider()
                    : void continueWithPublicSources()
                }
              />
            </SetupPanel>
          )}
          {step === 7 && (
            <SetupPanel
              title="Where should ReelOS meet you?"
              note="Install now or finish this profile and return to Devices later."
            >
              <div className="mt-9 grid gap-3 md:grid-cols-3">
                {(
                  [
                    ["phone", "Phone or tablet", <Smartphone />],
                    ["tv", "TV", <Tv />],
                    ["usb", "USB installer", <Upload />],
                  ] as const
                ).map(([id, label, icon]) => (
                  <button
                    key={id}
                    disabled={id === "usb"}
                    onClick={() => setDevice(id)}
                    className={`min-h-40 rounded-[1.5rem] p-5 text-left disabled:cursor-not-allowed disabled:opacity-35 ${device === id ? "bg-white text-black" : "bg-white/[.045]"}`}
                  >
                    <span className="[&>svg]:size-5">{icon}</span>
                    <b className="mt-8 block text-lg">{label}</b>
                    {id === "usb" && <small className="mt-2 block">Available when a supported target is detected.</small>}
                  </button>
                ))}
              </div>
              <button
                onClick={() => void create()}
                disabled={creating}
                className="mt-8 min-h-14 px-8 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-black font-bold text-base shadow-[0_0_24px_rgba(245,197,24,0.25)] hover:shadow-[0_0_32px_rgba(245,197,24,0.4)] active:scale-[0.98] transition-all disabled:opacity-25 disabled:shadow-none disabled:pointer-events-none"
              >
                {creating ? "Saving this home…" : `Finish and open ${device === "tv" ? "TV setup" : "phone setup"}`}
              </button>
              {createError && (
                <p className="mt-3 text-sm text-rose-300">{createError}</p>
              )}
              <p className="mt-3 text-xs text-white/34">
                Deployment remains unconfirmed until the selected installer
                reports success.
              </p>
            </SetupPanel>
          )}
        </div>
      </div>
    </main>
  );
}

function LuxuryInputCard({
  value,
  onChange,
  placeholder,
  label,
  autoFocus = false,
  type = "text",
  className = "",
  error,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  label?: string;
  autoFocus?: boolean;
  type?: string;
  className?: string;
  error?: string;
}) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={`group relative flex flex-col rounded-2xl border px-6 py-4 transition-all duration-300 cursor-text ${
        focused
          ? "border-amber-400/60 bg-white/[0.08] shadow-[0_0_28px_rgba(245,197,24,0.16)]"
          : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]"
      } ${className}`}
    >
      {label && (
        <span
          className={`text-[11px] font-semibold tracking-wider uppercase transition-colors duration-200 ${
            focused ? "text-amber-400" : "text-white/40"
          }`}
        >
          {label}
        </span>
      )}
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => {
            setFocused(true);
            setTimeout(() => {
              e.target.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 300);
          }}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full bg-transparent text-xl sm:text-2xl font-medium text-white placeholder:text-white/20 border-none outline-none focus:outline-none focus:ring-0 p-0 caret-[#f5c518]"
          style={{
            WebkitTapHighlightColor: "transparent",
            outline: "none",
            boxShadow: "none",
          }}
        />
        {value.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              inputRef.current?.focus();
            }}
            aria-label="Clear input"
            className="grid size-7 place-items-center rounded-full bg-white/10 text-white/50 hover:bg-white/20 hover:text-white transition-all shrink-0"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {error && <span className="mt-1.5 text-xs text-rose-400">{error}</span>}
    </div>
  );
}

function TactilePinInput({
  value,
  onChange,
  label,
  autoFocus = false,
  error = false,
}: {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  autoFocus?: boolean;
  error?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div
      className="relative flex flex-col items-center justify-center cursor-pointer select-none py-2"
      onClick={() => inputRef.current?.focus()}
    >
      {label && (
        <span className="mb-3 text-xs font-semibold tracking-wider uppercase text-white/50">
          {label}
        </span>
      )}
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={4}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        onFocus={(e) => {
          setIsFocused(true);
          setTimeout(() => {
            e.target.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 300);
        }}
        onBlur={() => setIsFocused(false)}
        autoFocus={autoFocus}
        className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0 outline-none focus:outline-none focus:ring-0"
        style={{
          caretColor: "transparent",
          WebkitTapHighlightColor: "transparent",
          outline: "none",
          boxShadow: "none",
        }}
        tabIndex={0}
      />
      <div className="flex items-center gap-3">
        {[0, 1, 2, 3].map((index) => {
          const filled = index < value.length;
          const active = isFocused && (index === value.length || (index === 3 && value.length === 4));
          return (
            <div
              key={index}
              className={`reelos-pin-cell size-14 sm:size-16 rounded-2xl ${active ? "is-active" : ""} ${filled ? "is-filled" : ""} ${error ? "border-rose-500/70" : ""}`}
            >
              {filled ? (
                <div className="reelos-pin-dot" />
              ) : (
                <span className="text-white/20 text-lg">•</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SetupPanel({
  title,
  note,
  children,
  wide = false,
}: {
  title: string;
  note: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={`w-full ${wide ? "max-w-6xl" : "max-w-3xl"} mx-auto text-left`}>
      <h1 className="font-display text-[clamp(2rem,4.5vw,3.75rem)] font-medium leading-[1.08] tracking-tight text-white">
        {title}
      </h1>
      <p className="mt-3.5 max-w-xl text-base sm:text-lg leading-relaxed text-white/60 font-normal">{note}</p>
      <div className="mt-8 w-full">{children}</div>
    </section>
  );
}

function SetupNext({
  onClick,
  disabled,
  label = "Continue",
}: {
  onClick(): void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="mt-8 flex w-full sm:w-auto items-center justify-center gap-2 min-h-14 px-10 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-black font-bold text-base tracking-wide shadow-[0_0_28px_rgba(245,197,24,0.3)] hover:shadow-[0_0_40px_rgba(245,197,24,0.5)] active:scale-[0.98] transition-all disabled:opacity-25 disabled:shadow-none disabled:pointer-events-none cursor-pointer"
    >
      <span>{label}</span>
      <ChevronRight className="size-4 stroke-[2.5]" />
    </button>
  );
}

function PlayerWorld({
  title,
  profile,
  onBack,
  onCompanion,
}: {
  title: ExperienceTitle;
  profile: ExperienceProfile;
  onBack(): void;
  onCompanion(): void;
}) {
  const setProgress = useExperienceStore((state) => state.setProgress);
  const [playing, setPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const resumeProgress = useRef(profile.progress[title.id] ?? 0);
  const resumeRestored = useRef(false);
  const lastProgressSave = useRef(0);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const savePosition = (video: HTMLVideoElement, force = false) => {
    setPosition(video.currentTime);
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    // Saving every timeupdate kept resetting the profile adapter's debounce.
    if (!force && Date.now() - lastProgressSave.current < 5000) return;
    lastProgressSave.current = Date.now();
    resumeProgress.current = Math.max(0, Math.min(1, video.currentTime / video.duration));
    setProgress(profile.id, title.id, resumeProgress.current);
  };
  const playbackUri = publicPlaybackPath(title.id);
  const [controls, setControls] = useState(true);
  const [audioPreset, setAudioPreset] = useState<AudioPreset>("off");
  const [audioError, setAudioError] = useState("");
  const [volume, setVolume] = useState(1);
  const audioController = useRef<AudioController | null>(null);
  const unsubscribeAudio = useRef<(() => void) | null>(null);
  const audioRevision = useRef(0);
  const sleepController = useRef<ReturnType<typeof createPlaybackSleepTimer> | null>(null);
  const [timer, setTimer] = useState("Off");
  const [panel, setPanel] = useState<"audio" | "story" | "end" | null>(null);
  useEffect(() => {
    const sleep = createPlaybackSleepTimer({ getVideo: () => videoRef.current, onExpire: () => setTimer("Off") });
    sleepController.current = sleep;
    const check = () => sleep.checkDeadline();
    document.addEventListener("visibilitychange", check);
    return () => {
      sleep.dispose();
      document.removeEventListener("visibilitychange", check);
      audioRevision.current += 1;
      unsubscribeAudio.current?.();
      unsubscribeAudio.current = null;
      audioController.current?.destroy();
      audioController.current = null;
    };
  }, []);
  const changeAudio = async (preset: AudioPreset) => {
    const video = videoRef.current;
    if (!video) return;
    if (!audioController.current) {
      const controller = attachAudioBooster(video);
      audioController.current = controller;
      unsubscribeAudio.current = controller.subscribe((status) => {
        setAudioPreset(status.preset);
        setAudioError(status.error ?? "");
      });
    }
    const controller = audioController.current;
    const revision = ++audioRevision.current;
    const applied = await controller.setPreset(preset);
    if (revision !== audioRevision.current) return;
    setAudioPreset(controller.getPreset());
    if (applied) setAudioError("");
    else setAudioError("Audio processing could not be enabled. Try Original, or reopen the player.");
  };
  return (
    <main
      data-player="true"
      className="relative min-h-dvh overflow-hidden bg-black"
      onClick={() => setControls(true)}
    >
      {playbackUri ? (
        <video
          ref={videoRef}
          src={playbackUri}
          poster={title.backdrop}
          playsInline
          preload="metadata"
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            if (!Number.isFinite(video.duration) || video.duration <= 0) return;
            setDuration(video.duration);
            if (!resumeRestored.current) {
              resumeRestored.current = true;
              const saved = resumeProgress.current;
              video.currentTime = saved > 0 && saved < 0.99 ? saved * video.duration : 0;
              setPosition(video.currentTime);
            }
          }}
          onPlay={() => setPlaying(true)}
          onPause={(event) => {
            setPlaying(false);
            savePosition(event.currentTarget, true);
          }}
          onSeeked={(event) => savePosition(event.currentTarget, true)}
          onEnded={() => {
            setPlaying(false);
            setProgress(profile.id, title.id, 1);
          }}
          onTimeUpdate={(event) => savePosition(event.currentTarget)}
          onError={() =>
            setPlaybackError(
              "This title could not be played with the current source or viewing permissions. Try again or return to its details.",
            )
          }
          className="absolute inset-0 size-full object-contain"
        />
      ) : (
        <img
          src={title.backdrop}
          alt=""
          className="absolute inset-0 size-full object-cover opacity-50"
        />
      )}
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_60%_40%,transparent,#000_88%)]" />
      <div className="absolute left-5 top-5 z-10 rounded-full bg-black/55 px-3 py-1.5 text-[10px] text-white/54 backdrop-blur">
        {playbackUri
          ? "Public-domain source"
          : "No playable source is connected"}
      </div>
      {controls && (
        <div className="relative flex min-h-dvh flex-col justify-between p-5 md:p-9">
          <div className="flex items-center justify-between">
            <button
              aria-label="Back to browsing"
              onClick={(event) => {
                event.stopPropagation();
                if (videoRef.current) savePosition(videoRef.current, true);
                onBack();
              }}
              className="grid size-12 place-items-center rounded-full bg-black/45 backdrop-blur"
            >
              <ArrowLeft className="size-5" />
            </button>
            <button
              onClick={onCompanion}
              className="min-h-12 rounded-full bg-black/45 px-5 text-sm backdrop-blur"
            >
              Open companion
            </button>
          </div>
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-white text-black">
            <button
              onClick={(event) => {
                event.stopPropagation();
                const video = videoRef.current;
                if (!video) return;
                setPlaybackError("");
                if (video.paused) {
                  void video
                    .play()
                    .catch(() =>
                      setPlaybackError(
                        "Playback was blocked by this device. Tap play once more.",
                      ),
                    );
                } else {
                  video.pause();
                }
              }}
              disabled={!playbackUri}
              aria-label={playing ? "Pause" : "Play"}
              className="grid size-20 place-items-center rounded-full focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {playing ? (
                <Pause className="size-7 fill-current" />
              ) : (
                <Play className="size-7 fill-current" />
              )}
            </button>
          </div>
          <div>
            <div className="flex items-end justify-between gap-5">
              <div>
                <p className="text-sm text-white/45">
                  {title.kind === "series"
                    ? "Season 1 · Episode 1"
                    : `${title.year} · ${title.minutes} min`}
                </p>
                <h1 className="mt-2 font-display text-[clamp(2.7rem,6vw,5.7rem)] font-semibold leading-none tracking-[-.065em]">
                  {title.title}
                </h1>
              </div>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setControls(false);
                }}
                className="hidden min-h-11 rounded-full px-4 text-sm text-white/45 md:block"
              >
                Hide controls
              </button>
            </div>
            <input
              type="range"
              aria-label="Seek playback"
              aria-valuetext={`${Math.floor(position)} of ${Math.floor(duration)} seconds`}
              min={0}
              max={duration || 1}
              step={1}
              value={position}
              disabled={!duration || !!playbackError}
              onChange={(event) => {
                const video = videoRef.current;
                if (!video) return;
                video.currentTime = Number(event.target.value);
                savePosition(video, true);
              }}
              className="mt-3 min-h-12 w-full cursor-pointer accent-white focus-visible:outline focus-visible:outline-2 disabled:opacity-35"
            />
            {playbackError && (
              <div role="alert" className="mt-3 text-sm text-rose-300">
                <p>{playbackError}</p>
                <button className="mt-2 min-h-12 rounded-full bg-white/10 px-5 text-white"
                  onClick={() => {
                    setPlaybackError("");
                    resumeRestored.current = false;
                    videoRef.current?.load();
                  }}>Retry playback</button>
              </div>
            )}
            <div className="mt-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {[
                [<Volume2 />, "Sound & subtitles", () => setPanel("audio")],
                [
                  <Moon />,
                  audioPreset === "nightMode" ? "Night listening on" : "Night listening",
                  () => void changeAudio(audioPreset === "nightMode" ? "off" : "nightMode"),
                ],
                [
                  <Clock3 />,
                  `Sleep · ${timer}`,
                  () => {
                    const minutes = timer === "Off" ? 30 : timer === "30 min" ? 60 : 0;
                    sleepController.current?.setDelay(minutes * 60000);
                    setTimer(minutes === 30 ? "30 min" : minutes === 60 ? "1 hour" : "Off");
                  },
                ],
                [<MessageCircle />, "Catch me up", () => setPanel("story")],
                [<MonitorUp />, "Move playback", onCompanion],
              ].map(([icon, label, action]) => (
                <button
                  key={String(label)}
                  onClick={(event) => {
                    event.stopPropagation();
                    (action as () => void)();
                  }}
                  className="flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-black/48 px-4 text-sm backdrop-blur"
                >
                  <span className="[&>svg]:size-4">{icon as ReactNode}</span>
                  {String(label)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {panel === "audio" && (
        <SimpleDialog title="Sound & subtitles" onClose={() => setPanel(null)}>
          <label className="block text-sm text-white/70">
            Volume
            <input type="range" aria-label="Volume" min="0" max="1" step="0.05" value={volume}
              onChange={(event) => {
                const next = Number(event.target.value);
                setVolume(next);
                if (videoRef.current) videoRef.current.volume = next;
              }} className="min-h-12 w-full accent-white" />
          </label>
          <ChoiceSetting
            label="Sound"
            value={audioPreset === "off" ? "Original" : audioPreset === "nightMode" ? "Night listening" : "Dialogue focus"}
            options={["Original", "Dialogue focus", "Night listening"]}
            onChange={(value) => void changeAudio(value === "Original" ? "off" : value === "Night listening" ? "nightMode" : "dialogueBoost")}
          />
          {audioError && <p role="alert" className="mt-4 text-sm text-rose-300">{audioError}</p>}
          <div className="mt-6 rounded-2xl bg-white/[.045] p-5 text-sm text-white/45">
            This source has its original audio. No alternate language or subtitle tracks are connected to it yet.
          </div>
        </SimpleDialog>
      )}
      {panel === "story" && (
        <SimpleDialog title="The story so far" onClose={() => setPanel(null)}>
          <p className="leading-7 text-white/54">
            A production recap will use the verified playback position and
            reveal nothing beyond it. This preview has no scene timeline, so it
            will not invent a recap.
          </p>
        </SimpleDialog>
      )}
    </main>
  );
}

function ExitPinGate({
  profile,
  onClose,
  onVerified,
}: {
  profile: ExperienceProfile;
  onClose(): void;
  onVerified(): void;
}) {
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const verify = async () => {
    if (pin.length !== 4) return;
    setChecking(true);
    setError("");
    try {
      const response = await fetch(
        `/api/profiles/${encodeURIComponent(profile.id)}/verify-pin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        },
      );
      if (!response.ok) throw new Error("That PIN did not match.");
      const result = (await response.json()) as { verified?: boolean };
      if (!result.verified) throw new Error("That PIN did not match.");
      setPin("");
      onVerified();
    } catch (reason) {
      setPin("");
      setError(
        reason instanceof Error
          ? reason.message
          : "The PIN could not be checked.",
      );
    } finally {
      setChecking(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/80 px-5 backdrop-blur-xl">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-pin-title"
        className="w-full max-w-md rounded-[1.8rem] border border-white/10 bg-[#151519] p-6 shadow-2xl"
      >
        <button
          onClick={onClose}
          aria-label="Stay in child profile"
          className="grid size-12 place-items-center rounded-full bg-white/7"
        >
          <X className="size-4" />
        </button>
        <h2
          id="exit-pin-title"
          className="mt-6 font-display text-4xl font-semibold tracking-[-.06em]"
        >
          A grown-up takes it from here.
        </h2>
        {profile.pinEnabled ? (
          <>
            <p className="mt-3 leading-7 text-white/48">
              Enter the family PIN to leave {possessive(profile.name)} cinema.
            </p>
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(event) =>
                setPin(event.target.value.replace(/\D/g, "").slice(0, 4))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") void verify();
              }}
              placeholder="4-digit PIN"
              className="mt-6 min-h-16 w-full rounded-2xl bg-white/7 px-5 text-center text-2xl tracking-[.3em] outline-none placeholder:text-sm placeholder:tracking-normal"
            />
            <button
              onClick={() => void verify()}
              disabled={checking || pin.length !== 4}
              className="mt-3 min-h-14 w-full rounded-2xl bg-white text-sm font-bold text-black disabled:opacity-35"
            >
              {checking ? "Checking…" : "Continue"}
            </button>
          </>
        ) : (
          <p className="mt-3 leading-7 text-white/48">
            This child profile has no verified exit PIN yet. A parent must
            finish protection from Family on an authorized device.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      </section>
    </div>
  );
}

function SearchOverlay({
  query,
  setQuery,
  onClose,
  onOpen,
  onPerson,
  onCollection,
  onBook,
  onSourceSetup,
  onConcierge,
  profile,
}: {
  query: string;
  setQuery(value: string): void;
  onClose(): void;
  onOpen(title: ExperienceTitle): void;
  onPerson(name: string, externalId?: string): void;
  onCollection(name: string, externalId: string): void;
  onBook(title: string): void;
  onSourceSetup(review: SourceLinkReview): void;
  onConcierge(): void;
  profile: ExperienceProfile;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const tvPlatform = nativePlatform() === "android-tv";
  const [result, setResult] = useState<ReelSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const intent = useMemo(() => parseSearchIntent(query), [query]);
  const sourceReview = useMemo(() => inspectSourceLink(query), [query]);
  const localResults = useMemo(
    () =>
      rankLocalSearch(intent).filter(
        (title) => !profile.isChild || title.family,
      ),
    [intent, profile.isChild],
  );
  const localPeople = useMemo(() => {
    if (!query.trim()) return [] as string[];
    const clues = intent.person
      ? [intent.person]
      : intent.terms.length
        ? intent.terms
        : [query.toLowerCase()];
    const searchableCatalog = profile.isChild
      ? EXPERIENCE_CATALOG.filter((title) => title.family)
      : EXPERIENCE_CATALOG;
    return [...new Set(searchableCatalog.flatMap((title) => title.people))]
      .filter((person) =>
        clues.some((clue) => person.toLowerCase().includes(clue)),
      )
      .slice(0, 6);
  }, [intent, profile.isChild, query]);

  useEffect(() => {
    if (!query.trim()) {
      setResult(null);
      setLoading(false);
      setSearchError("");
      return;
    }
    if (profile.isChild) {
      setResult(null);
      setLoading(false);
      setSearchError("");
      return;
    }
    const controller = new AbortController();
    setResult(null);
    const timer = window.setTimeout(() => {
      setLoading(true);
      setSearchError("");
      void searchReelOS(query, { signal: controller.signal })
        .then(setResult)
        .catch((error: unknown) => {
          if ((error as { name?: string })?.name !== "AbortError") {
            setSearchError(
              "The wider catalogs are quiet right now. Your personal catalog still works.",
            );
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 280);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [profile.isChild, query]);
  useEffect(() => {
    // Opening search with a remote should not immediately cover the results
    // with Android's software keyboard. Phone and desktop retain autofocus.
    if (tvPlatform) closeRef.current?.focus();
    else inputRef.current?.focus();
  }, [tvPlatform]);
  const results = result?.titles ?? localResults;
  const activeIntent = result?.intent ?? intent;
  const people = result?.people ?? [];
  const collections = result?.collections ?? [];
  const books = result?.books ?? [];
  const hasAny =
    results.length > 0 ||
    people.length > 0 ||
    collections.length > 0 ||
    books.length > 0 ||
    localPeople.length > 0;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search ReelOS"
      className={`fixed inset-0 z-50 overflow-y-auto bg-[#080809]/96 ${tvPlatform ? "" : "backdrop-blur-2xl"}`}
    >
      <div className="mx-auto max-w-[1400px] px-5 py-5 md:px-10">
        <div className="flex items-center gap-3">
          <Search className="size-5 shrink-0 text-white/45" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="A title, person, feeling, exclusion, or half-remembered scene"
            className="min-h-16 flex-1 bg-transparent text-xl outline-none placeholder:text-white/28"
          />
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close search"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-white/7"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="border-t border-white/8 pt-8">
          {query.trim() && (
            <div className="mb-7 flex flex-wrap items-center gap-2">
              {activeIntent.kind && (
                <span className="rounded-full bg-white/10 px-4 py-2 text-xs text-white/70">
                  {activeIntent.kind === "series"
                    ? "Series"
                    : activeIntent.kind === "book"
                      ? "Books"
                      : "Movies"}
                </span>
              )}
              {activeIntent.maxMinutes && (
                <span className="rounded-full bg-white/10 px-4 py-2 text-xs text-white/70">
                  Under {activeIntent.maxMinutes} minutes
                </span>
              )}
              {activeIntent.moods.map((mood) => (
                <span
                  key={mood}
                  className="rounded-full bg-white/10 px-4 py-2 text-xs capitalize text-white/70"
                >
                  {mood}
                </span>
              ))}
              {activeIntent.excludedTerms.map((term) => (
                <span
                  key={term}
                  className="rounded-full bg-white/10 px-4 py-2 text-xs text-white/70"
                >
                  Without {term}
                </span>
              ))}
              {loading && (
                <span className="ml-1 text-xs text-white/35">
                  Looking a little farther…
                </span>
              )}
            </div>
          )}
          {profile.isChild && query.trim() && (
            <p className="mb-6 max-w-2xl text-sm leading-6 text-white/42">
              Search stays inside titles already approved for this child
              profile. Wider catalogs remain behind the family PIN.
            </p>
          )}
          {!profile.isChild && sourceReview && (
            <section className="mb-7 max-w-2xl rounded-[1.35rem] bg-white/[.055] p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[var(--reelos-favorite)]" />
                <div>
                  <p className="font-semibold">This looks like a source setup link.</p>
                  <p className="mt-1 text-sm leading-6 text-white/48">{sourceReview.message}</p>
                  <p className="mt-2 text-xs text-white/32">{sourceReview.display}</p>
                  <button
                    onClick={() => onSourceSetup(sourceReview)}
                    disabled={!sourceReview.safeToReview}
                    className="mt-4 min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    Set up a content source
                  </button>
                </div>
              </div>
            </section>
          )}
          {(people.length > 0 ||
            localPeople.length > 0 ||
            collections.length > 0) && (
            <section className="mb-10">
              <p className="text-sm text-white/42">People and collections</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {people.map((person) => (
                  <button
                    key={`live-${person.id}`}
                    onClick={() => onPerson(person.name, person.id)}
                    className="min-h-12 rounded-full bg-white/7 px-5 text-sm"
                  >
                    {person.name}
                  </button>
                ))}
                {localPeople
                  .filter(
                    (name) =>
                      !people.some(
                        (person) =>
                          person.name.toLowerCase() === name.toLowerCase(),
                      ),
                  )
                  .map((person) => (
                    <button
                      key={`local-${person}`}
                      onClick={() => onPerson(person)}
                      className="min-h-12 rounded-full bg-white/7 px-5 text-sm"
                    >
                      {person}
                    </button>
                  ))}
                {collections.map((collection) => (
                  <button
                    key={`collection-${collection.id}`}
                    onClick={() => onCollection(collection.name, collection.id)}
                    className="min-h-12 rounded-full border border-white/10 bg-white/[.035] px-5 text-sm text-white/75"
                  >
                    {collection.name}
                  </button>
                ))}
              </div>
            </section>
          )}
          {result?.notices.map((notice) => (
            <p
              key={notice}
              className="mb-3 max-w-3xl text-sm leading-6 text-white/42"
            >
              {notice}
            </p>
          ))}
          {query.trim() && !loading && !hasAny ? (
            <EmptyState
              icon={<Search />}
              title="Nothing exact yet."
              text="Try a title, actor, mood, genre, remembered detail, or fewer constraints. ReelOS keeps the parts it understood below."
            />
          ) : (
            <>
              {results.length > 0 && (
                <section>
                  <p className="mb-5 text-sm text-white/42">
                    {query.trim()
                      ? `${results.length} paths from that clue`
                      : "A few places to begin"}
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {results.slice(0, tvPlatform ? 12 : 24).map((title) => (
                      <PosterCard
                        key={title.id}
                        title={title}
                        onOpen={onOpen}
                      />
                    ))}
                  </div>
                </section>
              )}
              {books.length > 0 && (
                <section className="mt-12">
                  <p className="mb-5 text-sm text-white/42">Books</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {books.slice(0, 12).map((book) => (
                      <button
                        key={`${book.licensed ? "licensed" : "open"}-${book.id}`}
                        onClick={() => onBook(book.title)}
                        className="group min-h-64 overflow-hidden rounded-[1.35rem] bg-white/[.045] text-left"
                      >
                        <div className="aspect-[2/3] overflow-hidden bg-[radial-gradient(circle_at_40%_20%,var(--reelos-favorite),#17171b_70%)]">
                          {book.cover ? (
                            <img
                              src={book.cover}
                              alt=""
                              className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
                            />
                          ) : (
                            <span className="grid size-full place-items-center">
                              <BookOpen className="size-7 text-white/35" />
                            </span>
                          )}
                        </div>
                        <span className="block p-4">
                          <b className="line-clamp-2 text-sm">{book.title}</b>
                          <span className="mt-1 block text-xs text-white/42">
                            {book.author}
                          </span>
                          <span className="mt-3 block text-[10px] uppercase tracking-[.14em] text-white/30">
                            {book.licensed
                              ? "Discover"
                              : book.format || "Open book"}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
          {query.trim() && (result?.suggestions.length ?? 0) > 0 && (
            <section className="mt-10 border-t border-white/8 pt-6">
              <p className="text-xs text-white/34">
                Narrow it without rewriting
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {result?.suggestions.map((suggestion) => (
                  <button
                    key={suggestion.label}
                    onClick={() =>
                      setQuery(`${query.trim()}${suggestion.addition}`)
                    }
                    className="min-h-11 rounded-full border border-white/10 px-4 text-sm text-white/62"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </section>
          )}
          {(searchError || (result?.unavailable.length ?? 0) > 0) && (
            <p className="mt-7 text-xs leading-5 text-white/32">
              {searchError ||
                `${result?.unavailable.join(", ")} did not answer. Everything else above remains usable.`}
            </p>
          )}
          {query.trim() && !profile.isChild && !sourceReview && (
            <button
              onClick={onConcierge}
              className="mt-8 min-h-12 text-left text-sm text-white/48 transition hover:text-white"
            >
              Need a hand setting up this home or bringing in your own media?
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SourceSetupReview({
  review,
  onClose,
  onSettings,
}: {
  review: SourceLinkReview;
  onClose(): void;
  onSettings(): void;
}) {
  return (
    <SimpleDialog title="Set up a content source" onClose={onClose}>
      <div className="space-y-5 text-sm leading-6 text-white/55">
        <p>{review.message}</p>
        <div className="rounded-2xl bg-black/25 px-4 py-3 font-mono text-xs text-white/58">
          {review.display}
        </div>
        <p>
          Nothing has been saved or contacted. Owner settings keep private source details out of search, profiles, and ordinary support exports.
        </p>
        <button
          onClick={onSettings}
          className="min-h-12 rounded-full bg-white px-5 text-sm font-bold text-black"
        >
          Open owner settings
        </button>
      </div>
    </SimpleDialog>
  );
}

function ConciergeSheet({
  onClose,
  onSetup,
  onSettings,
}: {
  onClose(): void;
  onSetup(): void;
  onSettings(): void;
}) {
  const [prompt, setPrompt] = useState("");
  const guidance = conciergeGuidance(inferConciergeIntent(prompt));
  return (
    <SimpleDialog title="A little help, when you want it" onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm leading-6 text-white/52">
          This home can guide setup without sending your question away. Private local conversation becomes available only when this machine has an approved local speech package.
        </p>
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="For example: how do I bring in my own movies?"
          className="min-h-14 w-full rounded-2xl bg-white/[.06] px-4 text-sm outline-none placeholder:text-white/28"
        />
        <p className="rounded-2xl bg-white/[.045] p-4 text-sm leading-6 text-white/62">
          {guidance}
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={onSetup} className="min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black">
            Help me set up
          </button>
          <button onClick={onSettings} className="min-h-11 rounded-full bg-white/8 px-4 text-sm">
            Owner settings
          </button>
        </div>
      </div>
    </SimpleDialog>
  );
}

function RefineSheet({ onClose }: { onClose(): void }) {
  const tonight = useExperienceStore((state) => state.tonight);
  const setTonight = useExperienceStore((state) => state.setTonight);
  const clearTonight = useExperienceStore((state) => state.clearTonight);
  const people = ["Florence Pugh", "Ayo Edebiri", "Ryan Gosling", "Zendaya"];
  return (
    <SimpleDialog title="Shape tonight, briefly." onClose={onClose}>
      <div className="space-y-7">
        <ChoiceSetting
          label="Mood"
          value={tonight.mood || "any"}
          options={["any", "quiet", "comfort", "kinetic", "dark", "fun"]}
          onChange={(mood) => setTonight({ mood: mood === "any" ? "" : mood })}
        />
        <ChoiceSetting
          label="Time"
          value={tonight.duration}
          options={["any", "short", "feature", "long"]}
          onChange={(duration) =>
            setTonight({ duration: duration as typeof tonight.duration })
          }
        />
        <ChoiceSetting
          label="Kind"
          value={tonight.kind}
          options={["all", "movie", "series", "book"]}
          onChange={(kind) => setTonight({ kind: kind as typeof tonight.kind })}
        />
        <ChoiceSetting
          label="Exploration"
          value={tonight.exploration}
          options={["familiar", "balanced", "adventurous"]}
          onChange={(exploration) =>
            setTonight({
              exploration: exploration as typeof tonight.exploration,
            })
          }
        />
        <div>
          <p className="text-sm text-white/46">Person</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setTonight({ person: "" })}
              className={`min-h-11 rounded-full px-4 text-sm ${!tonight.person ? "bg-white text-black" : "bg-white/7"}`}
            >
              Anyone
            </button>
            {people.map((person) => (
              <button
                key={person}
                onClick={() => setTonight({ person })}
                className={`min-h-11 rounded-full px-4 text-sm ${tonight.person === person ? "bg-white text-black" : "bg-white/7"}`}
              >
                {person}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="min-h-12 rounded-full bg-white px-6 text-sm font-bold text-black"
          >
            Show me
          </button>
          <button
            onClick={clearTonight}
            className="min-h-12 rounded-full border border-white/13 px-6 text-sm"
          >
            Clear
          </button>
        </div>
      </div>
    </SimpleDialog>
  );
}

function TitleSheet({
  title,
  profile,
  onClose,
  onPlay,
  onOpenRelated,
}: {
  title: ExperienceTitle;
  profile: ExperienceProfile;
  onClose(): void;
  onPlay(title: ExperienceTitle): void;
  onOpenRelated(title: ExperienceTitle): void;
}) {
  const toggleSaved = useExperienceStore((state) => state.toggleSaved);
  const react = useExperienceStore((state) => state.react);
  const toggleLessLike = useExperienceStore((state) => state.toggleLessLike);
  const request = useExperienceStore((state) => state.requests[title.id]);
  const setRequest = useExperienceStore((state) => state.setRequest);
  const debrid = useExperienceStore((state) => state.debrid);
  const accessible = experienceTitleIsAccessible(title, debrid);
  const canRequest = titleCanUseProvider(title.id, debrid);
  const publicCatalogSource = title.sources.find(
    (source) =>
      source.kind === "public_catalog" && source.verified && source.uri,
  );
  const [requestError, setRequestError] = useState("");
  const [requesting, setRequesting] = useState(false);
  const related = EXPERIENCE_CATALOG.filter(
    (item) =>
      item.id !== title.id &&
      item.genres.some((genre) => title.genres.includes(genre)),
  ).slice(0, 6);
  const primary = async () => {
    if (publicCatalogSource?.uri) {
      window.open(publicCatalogSource.uri, "_blank", "noopener,noreferrer");
      return;
    }
    if (accessible || request?.status === "ready") {
      onPlay(title);
      return;
    }
    if (!canRequest || requesting) return;
    setRequesting(true);
    setRequestError("");
    setRequest(title.id, { titleId: title.id, status: "finding", progress: 0 });
    try {
      const legacyMovieId = /^tmdb-movie-(\d+)$/.exec(title.id);
      const response = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleId: legacyMovieId ? `tmdb-${legacyMovieId[1]}` : title.id,
          tmdb: legacyMovieId?.[1],
          title: title.title,
          year: title.year,
          mediaType: title.kind === "series" ? "tv" : "movie",
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        status?: string;
        error?: string;
      };
      if (!response.ok || !result.ok)
        throw new Error(result.error || "This request could not be started.");
      const ready = ["ready", "available", "downloaded"].includes(
        String(result.status || "").toLowerCase(),
      );
      setRequest(title.id, {
        titleId: title.id,
        status: ready ? "ready" : "preparing",
        progress: ready ? 100 : 0,
      });
    } catch (reason) {
      setRequest(title.id, {
        titleId: title.id,
        status: "failed",
        progress: 0,
      });
      setRequestError(
        reason instanceof Error
          ? reason.message
          : "This request could not be started.",
      );
    } finally {
      setRequesting(false);
    }
  };
  const primaryLabel = requesting
    ? "Starting request…"
    : publicCatalogSource
      ? "View source record"
      : !accessible && !canRequest && request?.status !== "ready"
        ? "Unavailable with current sources"
        : request?.status === "ready"
          ? profile.progress[title.id]
            ? "Resume"
            : "Play"
          : !request
            ? accessible
              ? profile.progress[title.id] && profile.progress[title.id] < 0.99 ? "Resume" : "Play"
              : "Find a source"
            : request.status === "finding"
              ? "Finding a source…"
              : request.status === "preparing"
                ? request.progress > 0
                  ? `Preparing · ${request.progress}%`
                  : "Request started"
                : request.status === "failed"
                  ? "Retry"
                  : "Play";
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/72 p-0 backdrop-blur-md md:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title.title}
        className="relative mx-auto min-h-dvh max-w-5xl overflow-hidden bg-[#111115] md:min-h-0 md:rounded-[2rem]"
      >
        <div className="relative min-h-[430px]">
          <img
            src={title.backdrop}
            alt=""
            className="absolute inset-0 size-full object-cover opacity-55"
          />
          <span className="absolute inset-0 bg-[linear-gradient(0deg,#111115,transparent_75%),linear-gradient(90deg,#111115d9,transparent)]" />
          <button
            onClick={onClose}
            className="absolute right-5 top-5 z-10 grid size-12 place-items-center rounded-full bg-black/48 backdrop-blur"
          >
            <X className="size-5" />
          </button>
          <div className="relative flex min-h-[430px] max-w-2xl flex-col justify-end p-7 md:p-10">
            <p className="text-sm text-white/48">
              {[
                title.year || null,
                title.runtimeKnown === false ? null : `${title.minutes} min`,
                ...title.genres,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <h1 className="mt-3 font-display text-[clamp(3.3rem,7vw,6.8rem)] font-semibold leading-[.85] tracking-[-.075em]">
              {title.title}
            </h1>
            <p className="mt-5 max-w-lg leading-7 text-white/60">
              {whyThisTitle(title, profile)}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                onClick={() => void primary()}
                disabled={
                  requesting ||
                  (!publicCatalogSource &&
                    !accessible &&
                    !canRequest &&
                    request?.status !== "ready")
                }
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-black disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/45"
              >
                {publicCatalogSource ? (
                  <ExternalLink className="size-4" />
                ) : accessible || request?.status === "ready" ? (
                  <Play className="size-4 fill-current" />
                ) : (
                  <Radio className="size-4" />
                )}
                {primaryLabel}
              </button>
              <button
                onClick={() =>
                  toggleSaved(
                    profile.id,
                    title.id,
                    accessible || request?.status === "ready",
                  )
                }
                disabled={!accessible && request?.status !== "ready"}
                className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 px-5 text-sm disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Bookmark
                  className={`size-4 ${profile.savedIds.includes(title.id) ? "fill-current" : ""}`}
                />
                {!accessible && request?.status !== "ready"
                  ? "No accessible source"
                  : profile.savedIds.includes(title.id)
                    ? "Saved"
                    : "Save"}
              </button>
            </div>
            {publicCatalogSource && (
              <p className="mt-3 text-xs text-white/42">
                This opens the catalog's authoritative record. ReelOS only
                presents direct media when the source explicitly identifies it
                as open to use.
              </p>
            )}
            {!publicCatalogSource &&
              !accessible &&
              !canRequest &&
              request?.status !== "ready" && (
                <p className="mt-3 text-xs text-white/42">
                  ReelOS knows this title, but public-domain and
                  personal-library mode does not provide access to it.
                </p>
              )}
            {requestError && (
              <p className="mt-3 text-sm text-rose-300">{requestError}</p>
            )}
          </div>
        </div>
        <div className="space-y-12 p-7 md:p-10">
          <WhereToWatch title={title} />
          <section>
            <p className="text-sm text-white/42">
              How does this feel to {profile.name}?
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(
                [
                  ["like", "Like", <Check />],
                  ["love", "Love", <Heart />],
                  ["cozy", "Cozy", <Coffee />],
                ] as const
              ).map(([id, label, icon]) => (
                <button
                  key={id}
                  onClick={() =>
                    react(
                      profile.id,
                      title.id,
                      profile.reactions[title.id] === id ? undefined : id,
                    )
                  }
                  className={`inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-sm ${profile.reactions[title.id] === id ? "bg-white text-black" : "bg-white/7"}`}
                >
                  <span className="[&>svg]:size-4">{icon}</span>
                  {label}
                </button>
              ))}
              <button
                onClick={() => toggleLessLike(profile.id, title.id)}
                className={`min-h-12 rounded-full px-4 text-sm ${profile.lessLikeIds.includes(title.id) ? "bg-white text-black" : "bg-white/7"}`}
              >
                Less like this
              </button>
            </div>
          </section>
          <section>
            <h2 className="font-display text-3xl tracking-[-.05em]">
              The shape of it.
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-white/52">
              {title.note} Featuring{" "}
              {title.people.slice(0, 2).join(" and ") || "an ensemble cast"}.
              Longer story, episode, and craft details unfold here only when
              they are available.
            </p>
          </section>
          <WhereToWatch title={title} />
          <Shelf
            title="Nearby worlds."
            items={related}
            onOpen={onOpenRelated}
          />
        </div>
      </section>
    </div>
  );
}

function WhereToWatch({ title }: { title: ExperienceTitle }) {
  return (
    <section aria-label="Commercial stream and broadcast availability" className="pt-2">
      <StreamingAvailabilityBar
        titleId={title.id}
        titleName={title.title}
        kind={title.kind}
        year={title.year}
        extraIds={title.playbackId ? [title.playbackId] : []}
      />
    </section>
  );
}

function PersonSheet({
  name,
  externalId,
  onClose,
  onOpen,
}: {
  name: string;
  externalId?: string;
  onClose(): void;
  onOpen(title: ExperienceTitle): void;
}) {
  const localItems = titlesForPerson(name);
  const [remoteItems, setRemoteItems] = useState<ExperienceTitle[]>([]);
  const [remoteName, setRemoteName] = useState("");
  const [loading, setLoading] = useState(Boolean(externalId));
  const [error, setError] = useState("");
  useEffect(() => {
    if (!externalId) return;
    const controller = new AbortController();
    setLoading(true);
    void fetch(`/api/person?id=${encodeURIComponent(externalId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then(
        (payload: {
          person?: { name?: string; credits?: Record<string, unknown>[] };
          error?: string;
        }) => {
          const mapped = (payload.person?.credits ?? [])
            .map(mapLookupTitle)
            .filter((title): title is ExperienceTitle => Boolean(title));
          setRemoteItems(mapped);
          if (payload.person?.name) setRemoteName(payload.person.name);
          if (!mapped.length && payload.error) setError(payload.error);
        },
      )
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string })?.name !== "AbortError") {
          setError("That filmography is unavailable right now.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [externalId]);
  const items = [...localItems, ...remoteItems].filter(
    (title, index, all) =>
      all.findIndex((candidate) => candidate.id === title.id) === index,
  );
  return (
    <SimpleDialog title={remoteName || name} onClose={onClose}>
      <p className="text-white/48">
        Films and series connected to this person.
      </p>
      {loading && (
        <p className="mt-5 text-sm text-white/34">Gathering their work…</p>
      )}
      {error && <p className="mt-5 text-sm text-amber-200/65">{error}</p>}
      {items.length ? (
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((title) => (
            <PosterCard key={title.id} title={title} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<UserRound />}
          title="Their work is not indexed here yet."
          text="Try again when the wider metadata catalog is available. ReelOS will not redirect you to an unrelated title."
        />
      )}
    </SimpleDialog>
  );
}

function CollectionSheet({
  name,
  titleIds,
  externalId,
  onClose,
  onOpen,
}: {
  name: string;
  titleIds: string[];
  externalId?: string;
  onClose(): void;
  onOpen(title: ExperienceTitle): void;
}) {
  const localItems = titleIds
    .map((id) => TITLE_BY_EXPERIENCE_ID[id])
    .filter(Boolean);
  const [remoteItems, setRemoteItems] = useState<ExperienceTitle[]>([]);
  const [remoteName, setRemoteName] = useState("");
  const [loading, setLoading] = useState(Boolean(externalId));
  const [error, setError] = useState("");
  useEffect(() => {
    if (!externalId) return;
    const controller = new AbortController();
    setLoading(true);
    void fetch(`/api/collection?id=${encodeURIComponent(externalId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then(
        (payload: {
          collection?: { name?: string; parts?: Record<string, unknown>[] };
          error?: string;
        }) => {
          const mapped = (payload.collection?.parts ?? [])
            .map(mapLookupTitle)
            .filter((title): title is ExperienceTitle => Boolean(title));
          setRemoteItems(mapped);
          if (payload.collection?.name) setRemoteName(payload.collection.name);
          if (!mapped.length && payload.error) setError(payload.error);
        },
      )
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string })?.name !== "AbortError") {
          setError("That collection is unavailable right now.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [externalId]);
  const items = [...localItems, ...remoteItems].filter(
    (title, index, all) =>
      all.findIndex((candidate) => candidate.id === title.id) === index,
  );
  return (
    <SimpleDialog title={remoteName || name} onClose={onClose}>
      {loading && (
        <p className="mb-5 text-sm text-white/34">Gathering the collection…</p>
      )}
      {error && <p className="mb-5 text-sm text-amber-200/65">{error}</p>}
      {items.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((title) => (
            <PosterCard key={title.id} title={title} onOpen={onOpen} />
          ))}
        </div>
      ) : !loading ? (
        <EmptyState
          icon={<Library />}
          title="This collection is not available yet."
          text="ReelOS keeps the destination honest when its metadata source is offline."
        />
      ) : null}
    </SimpleDialog>
  );
}

function SimpleDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose(): void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] grid items-end overflow-y-auto bg-black/72 p-3 backdrop-blur-md md:place-items-center">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-[1.8rem] border border-white/12 bg-[#15151a] p-6 shadow-2xl md:p-8"
      >
        <div className="mb-7 flex items-start justify-between gap-4">
          <h2 className="font-display text-[clamp(2.3rem,5vw,4rem)] font-semibold leading-none tracking-[-.06em]">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="grid size-12 shrink-0 place-items-center rounded-full bg-white/7"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: string;
  onAction?(): void;
}) {
  return (
    <div className="rounded-[1.7rem] bg-white/[.035] p-7">
      <span className="grid size-12 place-items-center rounded-full bg-white/7 [&>svg]:size-5">
        {icon}
      </span>
      <h3 className="mt-6 font-display text-3xl tracking-[-.05em]">{title}</h3>
      <p className="mt-3 max-w-lg leading-7 text-white/46">{text}</p>
      {action && onAction && (
        <button
          onClick={onAction}
          className="mt-6 min-h-12 rounded-full bg-white px-6 text-sm font-bold text-black"
        >
          {action}
        </button>
      )}
    </div>
  );
}
