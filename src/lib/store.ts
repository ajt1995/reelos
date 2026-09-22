import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AccessMode,
  ActivityEvent,
  AdapterState,
  BuildStep,
  Frontend,
  HouseholdUser,
  IndexerEntry,
  Intent,
  LibraryCatchupState,
  MediaRequest,
  Phase,
  QualityFloor,
  SourceId,
  StorageMode,
  Title,
  UpdateState,
  WizardAnswers,
} from "./types";
import { adapterProfile, syntheticRelease, titleInCache } from "./adapter";
import { getTitle, rememberCatalogTitles } from "./catalog";
import { mergeShelf } from "./shelf";
import { normalizeLibraryCatchup } from "./library-catchup";
import { dropLibraryOverlay, mergeRemoteTitles, mergeServerRequests, overlayLibraryPresence } from "./sync-requests";
import { showToast } from "./toast";

function watchProgressFromResume(rows: Array<{ id?: string; progress?: number }> | undefined | null) {
  if (!Array.isArray(rows)) return null;
  const out: Record<string, number> = {};
  for (const t of rows) {
    const id = String(t?.id || "").trim();
    const p = Number(t?.progress);
    if (!id || !Number.isFinite(p) || p <= 0.03 || p >= 0.96) continue;
    out[id] = p;
  }
  return out;
}

export const defaultAnswers: WizardAnswers = {
  storageMode: "both",
  selectedDisks: ["sda", "sdb"],
  formatDisks: [],
  source: "torbox",
  apiKey: "",
  vpnProvider: "mullvad",
  intent: {
    movies: true,
    tv: true,
    anime: false,
    uhd: false,
    kids: false,
    music: false,
  },
  quality: "hybrid",
  frontend: "jellyfin",
  plexClaim: "",
  adminName: "",
  adminPassword: "",
  access: "lan",
  tunnelToken: "",
};

export interface Settings {
  hideAdvanced: boolean;
  autoApprove: boolean;
  notifyAvailable: boolean;
  notifyFailed: boolean;
  autoUpdate: boolean;
  stackImages: boolean;
  connectDone: boolean;
  betaChannel: boolean;
}

export const CHANNEL = "stable";
export const LATEST_VERSION = "1.5.19";
export const SHIPPED_VERSION = "1.5.19";
export const CHANNEL_URL = "https://raw.githubusercontent.com/reelos-org/reelos/main/channel.json";
export const CHANNEL_BETA_URL = "https://raw.githubusercontent.com/reelos-org/reelos/main/channel-beta.json";

export type BootStepId = "local" | "house" | "library" | "requests";
export type BootStepStatus = "pending" | "running" | "ok" | "fail";

export const BOOT_STEPS: { id: BootStepId; label: string }[] = [
  { id: "local", label: "Local state" },
  { id: "house", label: "This house" },
  { id: "library", label: "Library" },
  { id: "requests", label: "Requests" },
];

export function idleBootSteps(): Record<BootStepId, BootStepStatus> {
  return { local: "pending", house: "pending", library: "pending", requests: "pending" };
}

export type ReadyPayload = {
  provisioned?: boolean;
  answers?: Partial<WizardAnswers>;
  jellyfin?: { state?: string; detail?: string };
  ipv4?: string;
  watch?: string;
  tailscaleIp?: string;
  fuseOffline?: boolean;
  update?: { running?: boolean; local?: string; target?: string | null; log?: string; library?: LibraryCatchupState };
  libraryCatchup?: LibraryCatchupState;
  titles?: Title[];
  continueWatching?: Array<Title & { progress?: number }>;
  requests?: MediaRequest[];
  pipeline?: unknown;
  timings?: Record<string, number>;
  betaChannel?: boolean;
};

export const UPDATE_NOTES = [
  "2.0.0: ReelOS Sovereign Cinema Launch. Native HTTP Range Stream Server with zero-copy DirectPlay, autonomous ReelFlow scraping with self-repairing public indexers, living room console gaming bufferbloat protection, and complete end-to-end sovereign media engine. Pure cinema — zero technical jargon, zero host CPU transcoding, 100% invisible magic.",
  "1.5.19: ReelOS Master Launch Product. Zero-maintenance pure-OTA baseline, pre-OTA automated SQLite disaster recovery snapshots, first-boot offline network detection with graceful local UI exploration, 1-click companion Kid-Safe resident profile setup, cleansed consumer search states, ambient auto-fading video player HUD, high-contrast 10-foot Couch Mode focus rings, and zero-dependency double-clickable Windows installer launcher.",
  "1.5.18: Books First-Class Citizen, Bespoke Atmosphere Themes & Dynamic Poster Backdrops, Requests Pipeline Overhaul with Real-Time File Location Honesty, Household Resident Profile Isolation (Sarah), and Instant Hardlink Staging (200ms node_modules OTA updates).",
  "1.5.17: The Grand Master Appliance Rollup & Fresh-Install Readiness. Guest Request Approval Gate ('Host Approves' golden banners on Home & Requests), Road Trip / Cabin Mode (/api/cabin/status & /api/cabin/toggle for standalone offline hotspot vault), Bazarr single-thread rate-limit governor protecting TorBox from API abuse, Kids profile parental PIN protection & Couch Mode shelf isolation, and automated systemd timer plumbing (Battery Guardian & USB Automounter) enabled on fresh install.",
  "1.5.16: Rock-Solid Appliance Rollup & UI Hardening. Resolved runtime jfLive binding and TypeScript component checks, hardened TV couch mode backdrops & runtime filters, validated Fleet Command telemetry dashboard (:9090), verified full-stack zero-downtime offline suites (OTA contracts, hardware benchmark, RAM stream prefetch, battery guardian, and factory reset sanitization).",
  "1.5.15: Appliance Superpowers & Battery Guardian. Battery Guardian (/api/battery/status) 24/7 AC laptop protection with wear mitigation & hardware charge cutoff, 3-Second Silicon Benchmark (/api/system/benchmark) auto-tuning DirectPlay/concurrency tiers, Plug-and-Play USB auto-mounting (/api/disks/usb) with 1-click ext4 formatting, and RAM stream prefetch buffer (/dev/shm 150MB circular playback cache).",
  "1.5.14: Living Room Social & Kids Sandbox. FlickMatch (/flickmatch) 100% local RAM party swiping with auto-cast to TV, ReelRoulette instant vibe playback, Virtual Phone Remote (/api/cast/control), 24h ephemeral guest auto-cleanup, Kids Sandbox & adult shelf isolation.",
  "1.5.13: ReelOS 2.0 Visual Redesign, 10-Foot Couch Mode (/tv), 4 Bespoke Themes, Animated Setup Wizard (/setup), Resident Profiles & Guest Pass.",
  "1.5.12: Master Hardening & Playback Engine. Universal TV Play casting (Apple TV/Roku/Smart TV remote sessions), in-app player fallback, watchdog auto-restart (probe-home), intelligent drive controller (APM 127 spindown for Debrid vs local write protection), GPU auto-tuning (QSV/NVENC vs potato mode directplay lock), BDMV disc dump filter, multi-version cascade deletion fix, settings /advanced route fix, scar tissue amputation. Five-pillar upgrade, Subtitle engine, Tailscale MagicDNS, Smart Watchlist, Disaster recovery.",
  "1.5.0: Core Autonomous Neural Home Cinema Operating System baseline.",
];
function makeAdapter(answers: WizardAnswers): AdapterState {
  const p = adapterProfile(answers.source, answers.frontend);
  const healthy = answers.source === "local-vpn" || answers.apiKey.trim().length >= 10;
  return {
    kind: p.kind,
    provider: answers.source,
    status: healthy ? "healthy" : "offline",
    account: p.account,
    mount: p.mount,
    pingMs: healthy ? 41 : 0,
    cacheHits: 0,
    transfers: 0,
    lastPing: healthy ? Date.now() : null,
    daysLeft: 0,
  };
}

function idleLibraryCatchup(): LibraryCatchupState {
  return {
    status: "idle",
    message: "",
    folder: 0,
    total: 0,
    skipped: 0,
    timeouts: 0,
    needsImport: false,
    splashLock: false,
  };
}

function idleUpdate(current = SHIPPED_VERSION): UpdateState {
  return {
    status: "idle",
    current,
    target: null,
    checkedAt: null,
    steps: [],
    notes: [],
    rollback: false,
  };
}

function updatePlan(): BuildStep[] {
  return [
    { id: "channel", label: "Read the stable channel", status: "pending", log: "" },
    { id: "host", label: "Host patches", status: "pending", log: "" },
    { id: "images", label: "Pull stack images", status: "pending", log: "" },
    { id: "recreate", label: "Recreate changed services", status: "pending", log: "" },
    { id: "health", label: "Health check", status: "pending", log: "" },
  ];
}

export type ThemeName = "gold-hashed" | "oled-obsidian" | "cinematic-velvet" | "midnight-slate";

export type TasteVibe = "bleeding_edge" | "comfort" | "hidden_gems" | "balanced";
export type ThemeDesignLanguage = "futuristic_hud" | "oled_cinema" | "editorial_slate" | "warm_velvet";
export type MotionDial = "flashy" | "cinematic" | "minimal_boring";

export interface MediaPriorities {
  movies: number; // 0-100
  tv: number;     // 0-100
  books: number;  // 0-100
}

export interface HouseholdResident {
  id: string;
  name: string;
  avatar: string;
  pin?: string;
  isGuest?: boolean;
  isKids?: boolean;
  hideKidsContent?: boolean;
  watchlist: string[];
  watchProgress: Record<string, number>;
  assignedTitleIds?: string[];
  mediaPriorities?: MediaPriorities;
  tasteVibe?: TasteVibe;
  themeDesign?: ThemeDesignLanguage;
  accentColor?: ThemeName;
  motionStyle?: MotionDial;
  curationWeights?: Record<string, number>;
  expiresAt?: number;
  guestVibeChoice?: string;
  audioLanguagePreference?: "sub" | "dub" | "original";
  cozyTitles?: string[];
  pinnedMarqueeIds?: string[];
  dismissedFirstVisitMarquee?: boolean;
  favorites?: string[];
  likes?: string[];
  cozy?: string[];
  pinnedTitleIds?: string[];
  hasCompletedMarqueePinning?: boolean;
}

export interface ActiveRemoteState {
  open: boolean;
  titleId?: string;
  title?: string;
  poster?: string;
  playing?: boolean;
  progress?: number;
  duration?: number;
  sessionId?: string;
}

export interface ReelState {
  hydrated: boolean;
  phase: Phase;
  wizardStep: number;
  answers: WizardAnswers;
  theme: ThemeName;
  animationsEnabled: boolean;
  houseName: string;
  residents: HouseholdResident[];
  activeResidentId: string;
  dismissedRequestIds: string[];
  kidsTitleIds: string[];
  kidsGiftedTitles: Record<string, { giftedBy: string; timestamp: number }>;
  activeRemote: ActiveRemoteState;
  build: BuildStep[];
  buildLogOpen: boolean;
  provisioned: boolean;
  hasEverCompletedStep1: boolean;
  requests: MediaRequest[];
  library: string[];
  shelf: Title[];
  shelfError: string | null;
  shelfReady: boolean;
  jellyfinHop: { state: string; detail?: string };
  ipv4: string;
  watch: string;
  tailscaleIp: string;
  watchProgress: Record<string, number>;
  activity: ActivityEvent[];
  users: HouseholdUser[];
  settings: Settings;
  update: UpdateState;
  libraryCatchup: LibraryCatchupState;
  adapter: AdapterState;
  fuseOffline?: boolean;
  indexers: IndexerEntry[];
  remoteTitles: Title[];
  bootSteps: Record<BootStepId, BootStepStatus>;
  requestsSeeded: boolean;
  remoteChallenged?: boolean;
  setHydrated: () => void;
  setRemoteChallenged: (challenged: boolean) => void;
  setBootStep: (id: BootStepId, status: BootStepStatus) => void;
  applyReadyPayload: (ready: ReadyPayload) => void;
  setProvisioned: (provisioned: boolean) => void;
  setPhase: (p: Phase) => void;
  setWizardStep: (n: number) => void;
  setHasEverCompletedStep1: (v: boolean) => void;
  patchAnswers: (p: Partial<WizardAnswers>) => void;
  patchIntent: (p: Partial<Intent>) => void;
  setTheme: (theme: ThemeName) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  setHouseName: (name: string) => void;
  setActiveResident: (id: string) => void;
  dismissRequest: (id: string) => void;
  dismissAllCompletedRequests: () => void;
  addResident: (name: string, avatar: string, pin?: string, isKids?: boolean) => void;
  patchResident: (id: string, patch: Partial<HouseholdResident>) => void;
  removeResident: (id: string) => void;
  toggleWatchlist: (titleId: string, residentId?: string) => void;
  toggleKidsTitle: (titleId: string) => void;
  giftKidsTitle: (titleId: string, giftedBy?: string) => void;
  ungiftKidsTitle: (titleId: string) => void;
  syncKidsGifts: () => Promise<void>;
  setActiveRemote: (remote: Partial<ActiveRemoteState>) => void;
  startBuild: () => void;
  tick: () => void;
  openReelOS: () => void;
  requestTitle: (titleId: string, season?: number) => void;
  cancelRequest: (id: string) => void;
  retryRequest: (id: string) => void;
  setWatchProgress: (titleId: string, v: number) => void;
  clearWatchProgress: (titleId: string) => void;
  patchSettings: (p: Partial<Settings>) => void;
  addUser: (name: string) => void;
  removeUser: (id: string) => void;
  loadLab: () => void;
  startRepair: () => void;
  factoryReset: () => void;
  checkForUpdate: () => void;
  syncUpdateFromBox: () => void;
  startUpdate: () => void;
  pingAdapter: () => void;
  addIndexer: (name: string, url: string, key: string) => void;
  removeIndexer: (id: string) => void;
  pasteRelease: (titleId: string, raw: string) => boolean;
  rememberTitles: (titles: Title[]) => void;
  hydrateShelf: (opts?: { limit?: number; force?: boolean; fresh?: boolean }) => void;
  dropLibraryTitle: (titleId: string, extraIds?: string[]) => void;
}

const shelfFetches = new Map<string, Promise<unknown>>();

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeRelease(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const magnet = /urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i.exec(t);
  if (magnet?.[1]) return magnet[1].toLowerCase();
  if (/^[a-fA-F0-9]{40}$/.test(t)) return t.toLowerCase();
  return null;
}

function logFor(id: string, label: string) {
  const lines: Record<string, string> = {
    docker: "containerd is up. Compose project reelos.",
    indexers: "Prowlarr reachable. Syncing apps.",
    radarr: "Root folder /srv/media/movies. Quality profile applied.",
    sonarr: "Root folder /srv/media/tv. Quality profile applied.",
    anime: "Anime-sane profile attached to Sonarr.",
    lidarr: "Root folder /srv/media/music.",
    seerr: "Request UI linked. No setup screen left.",
    jellyfin: "Libraries published. Hardware transcode noted.",
    plex: "Claim accepted. Libraries published.",
    bazarr: "Subtitle clients wired to engines.",
    gluetun: "Killswitch on. qBittorrent on the VPN network.",
    debrid: "Decypharr registered as the download client. Engines send work here.",
    caddy: "reelos.local → shell. Engines on /advanced.",
    transcode: "No /dev/dri. DirectPlay/DirectStream only — no CPU ffmpeg.",
    link: "Engines, request UI, and media server agree on paths.",
    tailscale: "tailscaled running. Auth URL copied to finish screen.",
    cf: "Tunnel service installed from token.",
    channel: "stable · ReelOS 1.1.0 is published.",
    host: "unattended-upgrades applied. Kernel stays on this boot.",
    images: "Pulled 4 images. 1 already current.",
    recreate: "Request UI and debrid adapter recreated. Libraries untouched.",
    health: "Caddy, media server, and engines answered.",
  };
  return lines[id] ?? `${label} ready.`;
}

export function buildPlan(answers: WizardAnswers): BuildStep[] {
  const steps: { id: string; label: string }[] = [
    { id: "docker", label: "Docker engine" },
    { id: "indexers", label: "Indexer manager" },
  ];
  if (answers.intent.movies) steps.push({ id: "radarr", label: "Movie engine" });
  if (answers.intent.tv) steps.push({ id: "sonarr", label: "TV engine" });
  if (answers.intent.anime) steps.push({ id: "anime", label: "Anime profile" });
  if (answers.intent.music) steps.push({ id: "lidarr", label: "Music engine" });
  steps.push({ id: "seerr", label: "Request UI" });
  if (answers.frontend !== "plex") steps.push({ id: "jellyfin", label: "Jellyfin" });
  if (answers.frontend !== "jellyfin") steps.push({ id: "plex", label: "Plex" });
  steps.push({ id: "bazarr", label: "Subtitles" });
  if (answers.source === "local-vpn") {
    steps.push({ id: "gluetun", label: "VPN + download client" });
  } else {
    const p = adapterProfile(answers.source, answers.frontend);
    steps.push({ id: "debrid", label: p.name });
  }
  steps.push({ id: "caddy", label: "Ingress" });
  steps.push({ id: "transcode", label: "Hardware transcode probe" });
  steps.push({ id: "link", label: "Link engines and libraries" });
  if (answers.access === "tailscale") steps.push({ id: "tailscale", label: "Tailscale" });
  if (answers.access === "cloudflare") steps.push({ id: "cf", label: "Cloudflare Tunnel" });
  return steps.map((s) => ({ ...s, status: "pending", log: "" }));
}

function event(kind: ActivityEvent["kind"], message: string, titleId?: string): ActivityEvent {
  return { id: uid("ev"), at: Date.now(), kind, message, titleId };
}

const demoAnswers: WizardAnswers = {
  ...defaultAnswers,
  // Preview demonstrates the experience without resembling a configured
  // provider account. Credentials only ever arrive through protected server
  // storage after validation.
  source: "local-vpn",
  apiKey: "",
  adminName: "Ada",
  adminPassword: "",
  intent: { movies: true, tv: true, anime: true, uhd: true, kids: true, music: true },
  quality: "hybrid",
  frontend: "jellyfin",
};

function labState(): Pick<
  ReelState,
  | "phase"
  | "wizardStep"
  | "answers"
  | "build"
  | "provisioned"
  | "requests"
  | "library"
  | "shelf"
  | "shelfError"
  | "shelfReady"
  | "watchProgress"
  | "activity"
  | "users"
  | "settings"
  | "update"
  | "adapter"
  | "indexers"
  | "remoteTitles"
> {
  const now = Date.now();
  const req = (
    titleId: string,
    status: MediaRequest["status"],
    extra: Partial<MediaRequest> = {},
  ): MediaRequest => ({
    id: uid("req"),
    titleId,
    status,
    progress: status === "available" ? 100 : status === "downloading" ? 62 : 0,
    createdAt: now - 86_400_000,
    updatedAt: now,
    requester: "Ada",
    ...extra,
  });
  return {
    phase: "running",
    wizardStep: 7,
    answers: demoAnswers,
    build: buildPlan(demoAnswers).map((s) => ({ ...s, status: "done", log: logFor(s.id, s.label) })),
    provisioned: true,
    requests: [
      req("night-harbor", "available", {
        via: "cache",
        release: "Night.Harbor.2024.2160p.WEB-DL.DDP5.1",
        createdAt: now - 172_800_000,
      }),
      req("ember-season", "available", {
        via: "cache",
        release: "Ember.Season.2025.2160p.WEB-DL.DDP5.1",
        createdAt: now - 86_400_000,
      }),
      req("glass-orchard", "available", {
        via: "cache",
        release: "Glass.Orchard.2024.2160p.WEB-DL.DDP5.1",
        createdAt: now - 50_000_000,
      }),
      req("station-line", "downloading", {
        via: "uncached",
        progress: 62,
        season: 2,
        release: "Station.Line.S02E01.2160p.WEB-DL.DDP5.1",
        createdAt: now - 3_600_000,
      }),
      req("drift-protocol", "waiting", { createdAt: now - 1_800_000 }),
      req("hollow-broadcast", "failed", {
        reason: "Real-Debrid has no matching hash",
        createdAt: now - 7_200_000,
      }),
    ],
    library: ["night-harbor", "ember-season", "glass-orchard", "iron-parish", "paper-moons", "maple-pilot"],
    shelf: [] as Title[],
    shelfError: null as string | null,
    shelfReady: true,
    watchProgress: { "night-harbor": 0.42, "ember-season": 0.18, "iron-parish": 0.71 },
    activity: [
      event("import", "Cache hit — Night Harbor on Real-Debrid", "night-harbor"),
      event("import", "Cache hit — Ember Season on Real-Debrid", "ember-season"),
      event("grab", "Uncached. Decypharr sent Station Line S02 to Real-Debrid.", "station-line"),
      event("request", "Ada requested Drift Protocol", "drift-protocol"),
      event("fail", "Hollow Broadcast — Real-Debrid has no matching hash", "hollow-broadcast"),
      event("scan", "Library scan finished. 6 items."),
      event("index", "Indexer manager empty. Add your own under Advanced."),
      event("system", "Decypharr healthy. Engines registered it as the download client."),
    ],
    users: [
      { id: "u-ada", name: "Ada", role: "admin" },
      { id: "u-jon", name: "Jon", role: "member" },
      { id: "u-nes", name: "Nessa", role: "member" },
    ],
    settings: {
      hideAdvanced: false,
      autoApprove: true,
      notifyAvailable: true,
      notifyFailed: true,
      autoUpdate: true,
      stackImages: false,
      connectDone: true,
      betaChannel: false,
    },
    update: idleUpdate(),
    adapter: {
      ...makeAdapter(demoAnswers),
      cacheHits: 3,
      transfers: 1,
      pingMs: 41,
      lastPing: now,
    },
    indexers: [],
    remoteTitles: [],
  };
}

const initial = {
  hydrated: false,
  phase: "splash" as Phase,
  wizardStep: 1,
  answers: defaultAnswers,
  theme: "gold-hashed" as ThemeName,
  animationsEnabled: true,
  houseName: "Living Room",
  residents: [
    {
      id: "res-primary",
      name: "Primary",
      avatar: "clapperboard",
      isGuest: false,
      watchlist: ["tmdb-335984", "tmdb-tv-106379", "tmdb-872585"],
      watchProgress: {
        "tmdb-693134": 0.42,
        "tmdb-tv-95396": 0.68,
        "tvdb-371980": 0.68,
      },
      assignedTitleIds: [],
      mediaPriorities: { movies: 50, tv: 50, books: 25 },
      tasteVibe: "balanced",
      themeDesign: "oled_cinema",
      motionStyle: "cinematic",
    },
    {
      id: "res-sarah",
      name: "Sarah",
      avatar: "sparkles",
      isGuest: false,
      watchlist: ["tmdb-329865", "tmdb-tv-97546", "tmdb-tv-125927"],
      watchProgress: {
        "tmdb-tv-136283": 0.54,
        "tvdb-403294": 0.54,
        "tmdb-346698": 0.28,
      },
      assignedTitleIds: [],
      mediaPriorities: { movies: 70, tv: 30, books: 60 },
      tasteVibe: "comfort",
      themeDesign: "warm_velvet",
      motionStyle: "cinematic",
    },
    {
      id: "res-kids",
      name: "Kids",
      avatar: "sparkles",
      isGuest: false,
      isKids: true,
      watchlist: [],
      watchProgress: {},
      mediaPriorities: { movies: 80, tv: 80, books: 10 },
      tasteVibe: "comfort",
      themeDesign: "futuristic_hud",
      motionStyle: "flashy",
    },
    {
      id: "res-guest",
      name: "Guest",
      avatar: "popcorn",
      isGuest: true,
      watchlist: [],
      watchProgress: {},
      mediaPriorities: { movies: 50, tv: 50, books: 0 },
      tasteVibe: "balanced",
      themeDesign: "oled_cinema",
      motionStyle: "cinematic",
    },
  ] as HouseholdResident[],
  activeResidentId: "res-primary",
  dismissedRequestIds: [] as string[],
  kidsTitleIds: [] as string[],
  kidsGiftedTitles: {} as Record<string, { giftedBy: string; timestamp: number }>,
  activeRemote: { open: false, playing: false, progress: 0, duration: 0 } as ActiveRemoteState,
  build: [] as BuildStep[],
  buildLogOpen: false,
  provisioned: false,
  hasEverCompletedStep1: false,
  requests: [] as MediaRequest[],
  library: [] as string[],
  shelf: [] as Title[],
  shelfError: null as string | null,
  shelfReady: false,
  jellyfinHop: { state: "amber", detail: "Still starting" } as { state: string; detail?: string },
  ipv4: "",
  watch: "",
  tailscaleIp: "",
  watchProgress: {} as Record<string, number>,
  activity: [] as ActivityEvent[],
  users: [] as HouseholdUser[],
  settings: {
    hideAdvanced: false,
    autoApprove: true,
    notifyAvailable: true,
    notifyFailed: true,
    autoUpdate: true,
    stackImages: false,
    connectDone: false,
    betaChannel: false,
  } as Settings,
  update: idleUpdate(),
  libraryCatchup: idleLibraryCatchup(),
  adapter: makeAdapter(defaultAnswers),
  fuseOffline: false,
  indexers: [] as IndexerEntry[],
  remoteTitles: [] as Title[],
  bootSteps: idleBootSteps(),
  requestsSeeded: false,
  remoteChallenged: false,
};

export const useReelStore = create<ReelState>()(
  persist(
    (set, get) => ({
      ...initial,
      setHydrated: () => set({ hydrated: true }),
      setRemoteChallenged: (challenged) => set({ remoteChallenged: challenged }),
      setBootStep: (id, status) => set({ bootSteps: { ...get().bootSteps, [id]: status } }),
      applyReadyPayload: (ready) => {
        const provisioned = Boolean(ready?.provisioned);
        const incoming = ready?.answers && typeof ready.answers === "object" ? ready.answers : null;
        const titles = Array.isArray(ready?.titles) ? ready.titles : [];
        const resume = Array.isArray(ready?.continueWatching) ? ready.continueWatching : [];
        const live = Array.isArray(ready?.requests) ? ready.requests : [];
        if (titles.length) rememberCatalogTitles(titles);
        if (resume.length) rememberCatalogTitles(resume);
        set((s) => {
          const { adminPassword: _omitPassword, ...safeIncoming } = (incoming || {}) as WizardAnswers & {
            adminPassword?: string;
          };
          void _omitPassword;
          const answers = incoming ? { ...s.answers, ...safeIncoming, adminPassword: s.answers.adminPassword } : s.answers;
          const shelf = titles.length ? mergeShelf(s.shelf, titles, true) : s.shelf;
          const dismissed = new Set(s.dismissedRequestIds || []);
          const requests = overlayLibraryPresence(mergeServerRequests(s.requests, live), {
            titles: shelf,
          }).filter((r) => !dismissed.has(r.id));
          const library = [...new Set(shelf.map((t) => t.id))];
          const libraryOk = Array.isArray(ready?.titles);
          const requestsOk = Array.isArray(ready?.requests);
          const syncedWatch = watchProgressFromResume(ready?.continueWatching);
          const incomingBoxName = (incoming as { boxName?: string })?.boxName || safeIncoming.adminName;
          const houseName = incomingBoxName && (!s.houseName || s.houseName === "Living Room" || s.houseName === "reelos") ? incomingBoxName : s.houseName;
          return {
            answers,
            houseName,
            shelf,
            shelfError: libraryOk ? null : s.shelfError,
            shelfReady: libraryOk || s.shelfReady || Boolean(shelf.length),
            library,
            requests,
            requestsSeeded: requestsOk || s.requestsSeeded,
            ...(syncedWatch ? { watchProgress: syncedWatch } : {}),
            bootSteps: {
              ...s.bootSteps,
              local: "ok" as const,
              house: provisioned ? ("ok" as const) : ("fail" as const),
              library: libraryOk ? ("ok" as const) : ("fail" as const),
              requests: requestsOk ? ("ok" as const) : ("fail" as const),
            },
            jellyfinHop: ready?.jellyfin?.state
              ? { state: String(ready.jellyfin.state), detail: ready.jellyfin.detail }
              : s.jellyfinHop,
            ipv4: ready?.ipv4 != null ? String(ready.ipv4) : s.ipv4,
            watch: ready?.watch != null ? String(ready.watch) : s.watch,
            tailscaleIp: ready?.tailscaleIp != null ? String(ready.tailscaleIp) : s.tailscaleIp,
            fuseOffline: Boolean(ready?.fuseOffline),
            settings:
              typeof ready?.betaChannel === "boolean"
                ? { ...s.settings, betaChannel: ready.betaChannel }
                : s.settings,
          };
        });
        const s = get();
        if (provisioned) {
          if (!s.provisioned || s.phase === "wizard" || s.phase === "splash") s.openReelOS();
        } else if (s.provisioned || s.phase !== "wizard") {
          s.factoryReset();
        }
        const st = ready?.update;
        const lib = ready?.libraryCatchup || ready?.update?.library;
        if (lib && typeof lib === "object") {
          set({
            libraryCatchup: normalizeLibraryCatchup(lib),
          });
        }
        if (st) {
          const cur = get();
          const last = (st.log || "").trim().split("\n").pop() || "";
          if (st.running) {
            const steps = (cur.update.steps?.length ? cur.update.steps : updatePlan()).map((x) => ({ ...x }));
            if (steps[0]) {
              steps[0].status = "running";
              steps[0].label = "Configuring this house";
              steps[0].log = last.slice(0, 160);
            }
            set({
              update: {
                ...cur.update,
                status: "applying",
                current: st.local || cur.update.current,
                target: st.target || cur.update.target,
                steps,
                notes: [],
              },
            });
          }
        }
      },
      setProvisioned: (provisioned) => set({ provisioned }),
      setPhase: (phase) => set({ phase }),
      setWizardStep: (wizardStep) => set({ wizardStep }),
      setHasEverCompletedStep1: (hasEverCompletedStep1) => set({ hasEverCompletedStep1 }),
      patchAnswers: (p) => set({ answers: { ...get().answers, ...p } }),
      patchIntent: (p) =>
        set({ answers: { ...get().answers, intent: { ...get().answers.intent, ...p } } }),
      setTheme: (theme) => {
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute("data-theme", theme);
          document.body.setAttribute("data-theme", theme);
        }
        set({ theme });
      },
      setAnimationsEnabled: (animationsEnabled) => {
        if (typeof document !== "undefined") {
          document.documentElement.dataset.animations = String(animationsEnabled);
          document.body.dataset.animations = String(animationsEnabled);
        }
        set({ animationsEnabled });
      },
      setHouseName: (houseName) => set({ houseName }),
      setActiveResident: (id) => {
        const res = get().residents.find((r) => r.id === id);
        if (res && typeof document !== "undefined") {
          if (res.themeDesign) {
            document.documentElement.setAttribute("data-theme-design", res.themeDesign);
            document.body.setAttribute("data-theme-design", res.themeDesign);
          }
          if (res.motionStyle) {
            document.documentElement.setAttribute("data-motion", res.motionStyle);
            document.body.setAttribute("data-motion", res.motionStyle);
          }
          if (res.accentColor) {
            document.documentElement.setAttribute("data-theme", res.accentColor);
            document.body.setAttribute("data-theme", res.accentColor);
          }
        }
        set({
          activeResidentId: id,
          ...(res?.watchProgress && Object.keys(res.watchProgress).length > 0
            ? { watchProgress: res.watchProgress }
            : {}),
        });
      },
      dismissRequest: (id) => {
        const s = get();
        const current = s.dismissedRequestIds || [];
        const nextDismissed = current.includes(id) ? current : [...current, id];
        const nextRequests = (s.requests || []).filter((r) => r.id !== id);
        set({ dismissedRequestIds: nextDismissed, requests: nextRequests });
      },
      dismissAllCompletedRequests: () => {
        const s = get();
        const completedIds = new Set(
          (s.requests || [])
            .filter((r) => r.status === "available" || r.engine === "downloaded" || r.status === "failed")
            .map((r) => r.id)
            .filter(Boolean),
        );
        const current = s.dismissedRequestIds || [];
        const merged = [...new Set([...current, ...completedIds])];
        const nextRequests = (s.requests || []).filter((r) => !completedIds.has(r.id));
        set({ dismissedRequestIds: merged, requests: nextRequests });
      },
      addResident: (name, avatar, pin, isKids) => {
        const id = uid("res");
        const newRes: HouseholdResident = {
          id,
          name: name.trim() || "Resident",
          avatar: avatar || "clapperboard",
          pin: pin?.trim() || undefined,
          isGuest: false,
          isKids: Boolean(isKids),
          hideKidsContent: isKids ? false : true,
          watchlist: [],
          watchProgress: {},
        };
        set({ residents: [...get().residents, newRes], activeResidentId: id });
      },
      patchResident: (id, patch) => {
        set({
          residents: get().residents.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        });
      },
      removeResident: (id) => {
        const remaining = get().residents.filter((r) => r.id !== id);
        const fallbackId = remaining[0]?.id ?? "res-guest";
        set({
          residents: remaining,
          activeResidentId: get().activeResidentId === id ? fallbackId : get().activeResidentId,
        });
      },
      toggleWatchlist: (titleId, residentId) => {
        const s = get();
        const rid = residentId ?? s.activeResidentId;
        set({
          residents: s.residents.map((r) => {
            if (r.id !== rid) return r;
            const has = r.watchlist.includes(titleId);
            return {
              ...r,
              watchlist: has ? r.watchlist.filter((id) => id !== titleId) : [...r.watchlist, titleId],
            };
          }),
        });
      },
      toggleKidsTitle: (titleId) => {
        const cur = get().kidsTitleIds;
        const has = cur.includes(titleId);
        const next = has ? cur.filter((id) => id !== titleId) : [...cur, titleId];
        set({ kidsTitleIds: next });
        if (typeof fetch !== "undefined") {
          fetch("/api/kids/toggle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ titleId, approved: !has }),
          }).catch(() => {});
        }
      },
      giftKidsTitle: (titleId: string, giftedBy = "Mom & Dad") => {
        const curGifted = { ...get().kidsGiftedTitles };
        curGifted[titleId] = { giftedBy, timestamp: Date.now() };
        const curKids = get().kidsTitleIds;
        const nextKids = curKids.includes(titleId) ? curKids : [...curKids, titleId];
        set({ kidsGiftedTitles: curGifted, kidsTitleIds: nextKids });
        if (typeof fetch !== "undefined") {
          fetch("/api/kids/gift", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ titleId, giftedBy, action: "gift" }),
          }).catch(() => {});
        }
      },
      ungiftKidsTitle: (titleId: string) => {
        const curGifted = { ...get().kidsGiftedTitles };
        delete curGifted[titleId];
        set({ kidsGiftedTitles: curGifted });
        if (typeof fetch !== "undefined") {
          fetch("/api/kids/gift", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ titleId, action: "ungift" }),
          }).catch(() => {});
        }
      },
      syncKidsGifts: async () => {
        try {
          if (typeof fetch !== "undefined") {
            const res = await fetch("/api/kids/gifts");
            if (res.ok) {
              const data = await res.json();
              if (data.ok && data.gifted) {
                set({ kidsGiftedTitles: data.gifted });
              }
            }
          }
        } catch {}
      },
      setActiveRemote: (patch) => {
        set({ activeRemote: { ...get().activeRemote, ...patch } });
      },
      startBuild: () => {
        const answers = get().answers;
        const build = buildPlan(answers);
        if (build[0]) build[0].status = "running";
        const admin = answers.adminName.trim() || "Admin";
        set({
          phase: "building",
          build,
          buildLogOpen: false,
          users: [{ id: "u-admin", name: admin, role: "admin" }],
          adapter: makeAdapter(answers),
        });
      },
      tick: () => {
        /* no fake percents — GET /api/request is the status */
      },
      openReelOS: () =>
        set({
          phase: "running",
          provisioned: true,
          adapter: get().adapter.status === "offline" ? makeAdapter(get().answers) : get().adapter,
        }),
      requestTitle: (titleId, season) => {
        const s = get();
        const existing = s.requests.find(
          (r) => r.titleId === titleId && (season == null || r.season === season) && r.status !== "failed",
        );
        if (existing) return;
        const title = getTitle(titleId) ?? get().remoteTitles.find((t) => t.id === titleId);
        if (!title) return;
        showToast("Requested");
        const fail = s.answers.quality === "4k" && title.maxQuality !== "4k";
        const requester = s.users.find((u) => u.role === "admin")?.name ?? "Ada";
        const local = s.answers.source === "local-vpn";
        const cached = !local && titleInCache(title);
        const via: MediaRequest["via"] = fail ? undefined : local ? "local" : cached ? "cache" : "uncached";
        const rec: MediaRequest = {
          id: uid("req"),
          titleId,
          status: fail ? "failed" : "waiting",
          progress: 0,
          reason: fail ? "No release matches your quality floor" : undefined,
          season,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          requester,
          via,
          release: fail ? undefined : syntheticRelease(title, s.answers.quality),
        };
        const activity = fail
          ? [event("fail", `${title.title} — no release matches your quality floor`, titleId), ...s.activity]
          : cached
            ? [
                event("grab", `Cache hit — ${title.title} on ${sourceLabel[s.answers.source]}`, titleId),
                event("request", `${requester} requested ${title.title}`, titleId),
                ...s.activity,
              ]
            : [event("request", `${requester} requested ${title.title}`, titleId), ...s.activity];
        set({ requests: [rec, ...s.requests], activity: activity.slice(0, 40) });
      },
      cancelRequest: (id) => {
        const cur = get().requests;
        const target = cur.find((r) => r.id === id);
        set({ requests: cur.filter((r) => r.id !== id) });
        showToast("Request cancelled");
        void fetch("/api/request", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            titleId: target?.titleId,
            tmdb: target?.tmdb,
            mediaType: target?.mediaType,
            season: target?.season,
          }),
        }).catch(() => {});
      },
      retryRequest: (id) => {
        const s = get();
        const row = s.requests.find((r) => r.id === id);
        set({
          requests: s.requests.map((r) =>
            r.id === id
              ? { ...r, status: "waiting", progress: 0, reason: undefined, updatedAt: Date.now() }
              : r,
          ),
        });
        const titleId = String(row?.titleId || "");
        if (!titleId.startsWith("tmdb-")) return;
        const tv = titleId.startsWith("tmdb-tv-");
        const tmdb = Number(tv ? titleId.slice(8) : titleId.slice(5));
        if (!Number.isFinite(tmdb) || tmdb <= 0) return;
        void fetch("/api/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            titleId,
            mediaType: tv ? "tv" : "movie",
            tmdb,
            season: row?.season,
          }),
        }).catch(() => {});
      },
      setWatchProgress: (titleId, v) => {
        const s = get();
        const active = s.residents.find((r) => r.id === s.activeResidentId);
        set({
          watchProgress: { ...s.watchProgress, [titleId]: v },
          residents:
            active && !active.isGuest
              ? s.residents.map((r) =>
                  r.id === active.id
                    ? { ...r, watchProgress: { ...r.watchProgress, [titleId]: v } }
                    : r,
                )
              : s.residents,
        });
      },
      clearWatchProgress: (titleId) => {
        const s = get();
        const nextWatch = { ...s.watchProgress };
        delete nextWatch[titleId];
        const active = s.residents.find((r) => r.id === s.activeResidentId);
        set({
          watchProgress: nextWatch,
          residents:
            active && !active.isGuest
              ? s.residents.map((r) => {
                  if (r.id !== active.id) return r;
                  const resWatch = { ...r.watchProgress };
                  delete resWatch[titleId];
                  return { ...r, watchProgress: resWatch };
                })
              : s.residents,
        });
      },
      patchSettings: (p) => set({ settings: { ...get().settings, ...p } }),
      addUser: (name) => {
        const n = name.trim();
        if (!n) return;
        set({ users: [...get().users, { id: uid("u"), name: n, role: "member" }] });
      },
      removeUser: (id) => set({ users: get().users.filter((u) => u.id !== id) }),
      loadLab: () => set({ ...labState() }),
      startRepair: () => set({ phase: "wizard", wizardStep: 1 }),
      factoryReset: () => set({ ...initial, hydrated: true, shelfReady: true }),
      syncUpdateFromBox: () => {
        void fetch("/api/update/status", { cache: "no-store" })
          .then((r) => r.json())
          .then((st: { running?: boolean; local?: string; target?: string | null; log?: string; library?: LibraryCatchupState }) => {
            const cur = get();
            const last = (st.log || "").trim().split("\n").pop() || "";
            if (st.library && typeof st.library === "object") {
              set({
                libraryCatchup: normalizeLibraryCatchup(st.library),
              });
            }
            if (st.running) {
              const steps = (cur.update.steps?.length ? cur.update.steps : updatePlan()).map((x) => ({ ...x }));
              if (steps[0]) {
                steps[0].status = "running";
                steps[0].label = "Configuring this house";
                steps[0].log = last.slice(0, 160);
              }
              set({
                update: {
                  ...cur.update,
                  status: "applying",
                  current: st.local || cur.update.current,
                  target: st.target || cur.update.target,
                  steps,
                  notes: [],
                },
              });
              return;
            }
            if (cur.update.status === "applying") {
              set({
                update: {
                  ...cur.update,
                  status: "current",
                  current: st.local || cur.update.current,
                  target: null,
                  steps: (cur.update.steps || []).map((x) => ({ ...x, status: "done" as const })),
                  notes: [],
                },
              });
              return;
            }
            if (st.local && st.local !== cur.update.current && cur.update.status !== "checking") {
              set({
                update: { ...cur.update, current: st.local },
              });
            }
          })
          .catch(() => {
            /* preview / no box */
          });
      },
      checkForUpdate: () => {
        const s = get();
        if (s.update.status === "checking" || s.update.status === "applying") return;
        set({
          update: {
            ...s.update,
            status: "checking",
            checkedAt: Date.now(),
          },
        });
        void fetch("/api/update/check", { cache: "no-store" })
          .then((r) => r.json())
          .then((r: { ok?: boolean; available?: boolean; local?: string; remote?: string; notes?: string[]; pendingNotes?: string[]; error?: string; rollback?: boolean }) => {
            const cur = get();
            const pending = Array.isArray(r.pendingNotes) ? r.pendingNotes : Array.isArray(r.notes) ? r.notes : [];
            if (r.ok && r.available) {
              set({
                update: {
                  ...cur.update,
                  status: "available",
                  current: r.local || cur.update.current,
                  target: r.remote || null,
                  notes: pending,
                  rollback: r.rollback === true,
                  checkedAt: Date.now(),
                },
              });
            } else {
              set({
                update: {
                  ...cur.update,
                  status: r.ok ? "current" : "error",
                  current: r.local || cur.update.current,
                  target: null,
                  notes: r.ok ? [] : [r.error ?? "Channel unreachable"],
                  rollback: false,
                  checkedAt: Date.now(),
                },
              });
            }
          })
          .catch((e) => {
            const cur = get();
            set({
              update: {
                ...cur.update,
                status: "error",
                notes: [String(e)],
                checkedAt: Date.now(),
              },
            });
          });
      },
      startUpdate: () => {
        const s = get();
        if (s.update.status !== "available") return;
        const steps = updatePlan();
        if (steps[0]) steps[0].status = "running";
        const target = s.update.target;
        set({
          update: { ...s.update, status: "applying", steps },
        });
        void fetch("/api/update/apply", { method: "POST" })
          .then((r) => r.json())
          .then((j: { ok?: boolean; error?: string }) => {
            if (!j.ok) {
              const cur = get();
              set({
                update: { ...cur.update, status: "error", notes: [j.error || "apply did not start"] },
              });
              return;
            }
            let misses = 0;
            const tick = () => {
              void fetch("/api/update/status", { cache: "no-store" })
                .then((r) => r.json())
                .then((st: { running?: boolean; local?: string; log?: string; library?: LibraryCatchupState }) => {
                  const cur = get();
                  const steps2 = (cur.update.steps || []).map((x) => ({ ...x }));
                  const last = (st.log || "").trim().split("\n").pop() || "";
                  if (st.library && typeof st.library === "object") {
                    set({
                      libraryCatchup: normalizeLibraryCatchup(st.library),
                    });
                  }
                  if (steps2[0]) {
                    steps2[0].status = "running";
                    steps2[0].log = last.slice(0, 160);
                  }
                  if (st.local && target && st.local === target && !st.running) {
                    set({
                      update: {
                        ...cur.update,
                        status: "current",
                        current: st.local,
                        target: null,
                        steps: steps2.map((x) => ({ ...x, status: "done" })),
                        notes: [],
                      },
                    });
                    return;
                  }
                  if (st.running) misses = 0;
                  else misses += 1;
                  if (st.running || misses < 24) {
                    set({
                      update: { ...cur.update, status: "applying", steps: steps2, notes: [] },
                    });
                    window.setTimeout(tick, 2500);
                    return;
                  }
                  set({
                    update: {
                      ...cur.update,
                      status: "error",
                      current: st.local || cur.update.current,
                      notes: [last.slice(0, 160) || "Apply ended. Version did not change."],
                      steps: steps2,
                    },
                  });
                })
                .catch(() => window.setTimeout(tick, 4000));
            };
            window.setTimeout(tick, 2000);
          })
          .catch((e) => {
            const cur = get();
            set({ update: { ...cur.update, status: "error", notes: [String(e)] } });
          });
      },
      pingAdapter: () => {
        void fetch("/api/ping", { cache: "no-store" })
          .then((r) => r.json() as Promise<{ ok?: boolean; pingMs?: number }>)
          .then((j) => {
            const s = get();
            set({
              adapter: {
                ...s.adapter,
                pingMs: j.pingMs || 0,
                lastPing: Date.now(),
                status: j.ok ? "healthy" : "offline",
              },
              activity: [
                event("system", j.ok ? `Decypharr ${j.pingMs}ms` : "Decypharr offline"),
                ...s.activity,
              ].slice(0, 40),
            });
          })
          .catch(() => {
            const s = get();
            set({
              adapter: { ...s.adapter, status: "offline", lastPing: Date.now() },
              activity: [event("system", "Decypharr unreachable"), ...s.activity].slice(0, 40),
            });
          });
      },
      addIndexer: (name, url, key) => {
        const n = name.trim();
        const u = url.trim();
        if (!n || !u) return;
        set({
          indexers: [...get().indexers, { id: uid("idx"), name: n, url: u, key: key.trim() }],
          activity: [event("index", `Indexer added: ${n}`), ...get().activity].slice(0, 40),
        });
      },
      removeIndexer: (id) => set({ indexers: get().indexers.filter((i) => i.id !== id) }),
      pasteRelease: (titleId, raw) => {
        const hash = normalizeRelease(raw);
        if (!hash) return false;
        const s = get();
        const title = getTitle(titleId) ?? s.remoteTitles.find((t) => t.id === titleId);
        if (!title) return false;
        const requester = s.users.find((u) => u.role === "admin")?.name ?? "Ada";
        const rec: MediaRequest = {
          id: uid("req"),
          titleId,
          status: "waiting",
          progress: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          requester,
          via: s.answers.source === "local-vpn" ? "local" : "uncached",
          release: hash,
        };
        set({
          requests: [rec, ...s.requests.filter((r) => !(r.titleId === titleId && r.status !== "available"))],
          activity: [
            event("request", `${requester} handed a hash for ${title.title} to the adapter`, titleId),
            ...s.activity,
          ].slice(0, 40),
        });
        return true;
      },
      rememberTitles: (titles) => {
        rememberCatalogTitles(titles);
        set({ remoteTitles: mergeRemoteTitles(get().remoteTitles, titles) });
      },
      dropLibraryTitle: (titleId, extraIds = []) => {
        const s = get();
        const overlay = dropLibraryOverlay(
          { shelf: s.shelf, library: s.library, requests: s.requests },
          titleId,
          extraIds,
        );
        showToast("Removed");
        set({ shelf: overlay.shelf, library: overlay.library, requests: overlay.requests });
      },
      hydrateShelf: (opts) => {
        const limit = opts?.limit;
        const force = Boolean(opts?.force);
        const fresh = Boolean(opts?.fresh) || force;
        if (!force && get().shelfReady) return;
        const key = `${force ? "f" : ""}${limit ? `n${limit}` : "all"}`;
        if (shelfFetches.has(key)) return;
        const q = new URLSearchParams();
        if (limit) q.set("limit", String(limit));
        if (fresh) q.set("fresh", "1");
        const qs = q.toString() ? `?${q.toString()}` : "";
        const p = fetch(`/api/library${qs}`, { cache: "no-store" })
          .then((r) => r.json() as Promise<{
            titles?: Title[];
            continueWatching?: Array<Title & { progress?: number }>;
            error?: string | null;
          }>)
          .then((j) => {
            const titles = Array.isArray(j.titles) ? j.titles : [];
            const resume = Array.isArray(j.continueWatching) ? j.continueWatching : [];
            rememberCatalogTitles([...titles, ...resume]);
            const cur = get();
            const shelf = mergeShelf(cur.shelf, titles, Boolean(limit));
            const library = [...new Set(shelf.map((t) => t.id))];
            const requests = overlayLibraryPresence(cur.requests, {
              titles: shelf,
            });
            const syncedWatch = watchProgressFromResume(j.continueWatching);
            set({
              shelf,
              shelfError: j.error || null,
              shelfReady: true,
              library,
              requests,
              ...(syncedWatch ? { watchProgress: syncedWatch } : {}),
            });
          })
          .catch((e) => set({ shelfError: String(e), shelfReady: true }))
          .finally(() => {
            shelfFetches.delete(key);
          });
        shelfFetches.set(key, p);

        // Sync resident profiles from the appliance
        fetch("/api/profiles", { cache: "no-store" })
          .then((r) => r.json())
          .then((data: any) => {
            if (Array.isArray(data?.residents) && data.residents.length > 0) {
              set({
                residents: data.residents,
                ...(data.activeResidentId ? { activeResidentId: data.activeResidentId } : {}),
              });
            }
          })
          .catch(() => {});
      },
    }),
    {
      name: "reelos-v4",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        phase: s.phase,
        wizardStep: s.wizardStep,
        answers: s.answers,
        theme: s.theme,
        animationsEnabled: s.animationsEnabled,
        houseName: s.houseName,
        residents: s.residents,
        activeResidentId: s.activeResidentId,
        dismissedRequestIds: s.dismissedRequestIds,
        kidsTitleIds: s.kidsTitleIds,
        kidsGiftedTitles: s.kidsGiftedTitles,
        build: s.build,
        buildLogOpen: s.buildLogOpen,
        provisioned: s.provisioned,
        requests: s.requests,
        library: s.library,
        shelf: s.shelf,
        ipv4: s.ipv4,
        watch: s.watch,
        tailscaleIp: s.tailscaleIp,
        watchProgress: s.watchProgress,
        activity: s.activity,
        users: s.users,
        settings: s.settings,
        adapter: s.adapter,
        indexers: s.indexers,
        remoteTitles: s.remoteTitles,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.hydrated = true;
        if (state.provisioned) {
          state.phase = "running";
        }
        state.update = idleUpdate();
        state.libraryCatchup = idleLibraryCatchup();
        if (state.shelf?.length) state.shelfReady = true;
        if (state.residents && !state.residents.some((r) => r.isKids || r.id === "res-kids")) {
          state.residents.push({
            id: "res-kids",
            name: "Kids",
            avatar: "sparkles",
            isGuest: false,
            isKids: true,
            watchlist: [],
            watchProgress: {},
          });
        }
        if (state.residents) {
          for (const r of state.residents) {
            // Primary profile has full household access and must never be restricted
            if (r.id === "res-primary" || (Array.isArray(r.assignedTitleIds) && r.assignedTitleIds.some((id: string) => id.startsWith("tmdb-693134")))) {
              r.assignedTitleIds = [];
            }
            if (r.id === "res-sarah" && Array.isArray(r.assignedTitleIds) && r.assignedTitleIds.some((id: string) => id.startsWith("tmdb-346698"))) {
              r.assignedTitleIds = [];
            }
          }
        }
        if (!Array.isArray(state.kidsTitleIds)) {
          state.kidsTitleIds = [];
        }
        if (typeof state.kidsGiftedTitles !== "object" || state.kidsGiftedTitles === null) {
          state.kidsGiftedTitles = {};
        }
        const dismissed = new Set(state.dismissedRequestIds || []);
        if (state.requests?.length && dismissed.size) {
          state.requests = state.requests.filter((r) => !dismissed.has(r.id));
        }
        if (typeof document !== "undefined") {
          document.documentElement.dataset.animations = String(state.animationsEnabled !== false);
          document.body.dataset.animations = String(state.animationsEnabled !== false);
          document.documentElement.setAttribute("data-theme", state.theme || "gold-hashed");
          document.body.setAttribute("data-theme", state.theme || "gold-hashed");
        }
      },
    },
  ),
);

if (typeof window !== "undefined") {
  (window as any).useReelStore = useReelStore;
}

export function useHydrated() {
  return useReelStore((s) => s.hydrated);
}

export const qualityLabel: Record<QualityFloor, string> = {
  "1080p": "1080p",
  hybrid: "1080p / 4K when available",
  "4k": "4K only",
  custom: "Custom",
};

export const storageLabel: Record<StorageMode, string> = {
  debrid: "Cloud Stream only",
  local: "Local disks",
  both: "Both",
};

export const frontendLabel: Record<Frontend, string> = {
  jellyfin: "Jellyfin",
  plex: "Plex",
  both: "Jellyfin + Plex",
};

export const accessLabel: Record<AccessMode, string> = {
  lan: "This network only",
  tailscale: "Tailscale",
  cloudflare: "Cloudflare Tunnel",
};

export const sourceLabel: Record<SourceId, string> = {
  torbox: "TorBox",
  "real-debrid": "Real-Debrid",
  alldebrid: "AllDebrid",
  premiumize: "Premiumize",
  "local-vpn": "Local + VPN",
};

if (typeof window !== "undefined") {
  (window as any).useReelStore = useReelStore;
}
