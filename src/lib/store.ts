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
import { dropLibraryOverlay, mergeServerRequests, overlayLibraryPresence } from "./sync-requests";

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
export const LATEST_VERSION = "1.2.50.40";
export const SHIPPED_VERSION = "1.2.50.40";
export const CHANNEL_URL = "https://raw.githubusercontent.com/ajt1995/reelos/main/channel.json";
export const CHANNEL_BETA_URL = "https://raw.githubusercontent.com/ajt1995/reelos/main/channel-beta.json";

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
  jellyfin?: unknown;
  update?: { running?: boolean; local?: string; target?: string | null; log?: string; library?: LibraryCatchupState };
  libraryCatchup?: LibraryCatchupState;
  titles?: Title[];
  requests?: MediaRequest[];
  pipeline?: unknown;
  timings?: Record<string, number>;
};

export const UPDATE_NOTES = [
  "1.2.50.40: Check/Apply only swaps the product (tarball, restart, splash, stamp). Library catch-up is its own worker with its own phone clock — folder N, skips, timeouts — not buried in wire.log while Apply looks frozen. Indexers/import/heal never block stamp. Catch-up is a persistent oneshot (not killed when selfheal exits); backs off when ffprobe is D-state; does not stack another FUSE. Splash-locks Home only while dumps still need import. 4GB prebuilt UI. Complements #120. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
  "1.2.50.39: Check/Apply stamps after hops and the door — dump import/heal runs in the background so the phone is not frozen on import after hops. Import/heal red does not un-stamp a UI swap. Skip Sonarr dump folders that already have files; do not RescanSeries all shows; do not list host+container paths twice; skip a FUSE folder on a short list timeout. No hybrid 1080 grab on Apply. Background import is capped on 4GB. First provision can still do a long walk. Never /media. Complements #117. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
  "1.2.50.38: Wizard stays seven steps; TorBox is the working source (Validate hits api.torbox.app with User-Agent ReelOS; Continue needs that OK). Real-Debrid, AllDebrid, Premiumize, Local+VPN, Plex claim, and Cloudflare Tunnel are labeled untested; Validate and Finish refuse (no fake always-ok). No GPU (/dev/dri render/card): persist Jellyfin encoding.xml DirectPlay/DirectStream only and disable user video/audio transcode (remux stays) so a 4GB box cannot CPU-ffmpeg-storm. VAAPI when a GPU is present; low-perf still caps threads. 37 prebuilt hashed UI stays in the tarball. Complements #115. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
  "1.2.50.37: Detect 4GB from MemTotal (≤4.5Gi) even if the low-perf toggle is off. Cap *arr/Jellyfin library scans; keep MediaInfo off. Do not remount Decypharr FUSE when /mnt/debrid lists. Idle high-load skips extra recover/compose/heal (D-state skip stays). Channel tarball ships a prebuilt UI so Apply never compiles on 4GB; npm ci only if the lockfile changed. start:box serves that hashed UI plus /api (not vite --host). No GPU (/dev/dri): Jellyfin DirectPlay/DirectStream only — no CPU ffmpeg transcode. VAAPI transcode when a GPU is present; low-perf still caps threads. Complements #113. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
  "1.2.50.36: Sonarr/Radarr stop ffprobe/MediaInfo on debrid FUSE dumps so Apply does not restorm. Mailman/nudge_fuse do not stack another Decypharr FUSE when /mnt/debrid is live; unmount extras only when stale. 35's 4GB skip-npm/skip-vite and self-heal D-state skip stay. Complements #106. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
  "1.2.50.35: House Apply of 34 would npm ci (start:box script) and vite-build on 4GB while Sonarr ffprobe-storms FUSE dumps. Reuse node_modules when lockfile matches; skip vite build on 4GB; self-heal skips compose/recover while ffprobe is D-state. Complements #111. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
  "1.2.50.34: Background self-heal keeps the door, compose/*arr/Seerr, Jellyfin token, and request recover going so you do not tap Heal. Settings is Check/Apply, not a repair bench. Production start serves the built UI when dist exists. Beta channel is a stub for later Arena+Books. Complements #95. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
  "1.2.50.33: Requests is in-flight only. Remove from this box unmonitors and deletes the *arr row — never /media. Settings → Updates shows this install and, after Check, the pending update. Complements #94. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
  "1.2.50.32: Search→request→play: recover keeps kicking, overlay does not sticky-available, Home cards match the transferring chip, GET-by-id imports when available, dump list cannot hang Vite, JF chip is amber until probed, loopback JF is not localhost-red. Complements #86. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
  "1.2.50.31: Firstboot does not loop on a provisioned box. Wizard and Apply stamp stack-installed; install.sh does not cp onto itself when HERE==ROOT; Apply does not enable firstboot. Complements #86. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
  "1.2.50.30: Home Your requests only lists in-flight titles (searching, grabbing, linked waiting for import). Available/Cached/library hits stay on Requests and On this box — not the top row. Transferring chip uses the same in-flight count. Complements #85. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
  "1.2.50.29: Apply skips FUSE dumps so Vite can bind. probe_home restarts hung reelos after 15s. GET /api/ready fans in box+library+requests; splash shows honest warming steps instead of Begin setup on a provisioned house. *arr start from ready in the background. Complements #84. Not 1.2.51 (Tron).",
  "1.2.50.28: Phone Home does not wait on Jellyfin or a Seerr title fan-out. /api/box returns provisioned immediately; Requests lists in one Seerr call. Recover still kicks in the background. Complements #83. Not 1.2.51 (Tron).",
  "1.2.50.27: Heal-red Apply still brings :80/:8080 back before exiting. Restart hung Vite instead of a no-op systemctl start. Still no stamp on indexer/import red. Complements #82. Not 1.2.51 (Tron).",
  "1.2.50.26: Low performance mode actually caps the 4GB box: VAAPI when /dev/dri exists (HEVC decode), one ffmpeg thread, throttle + delete transcode segments. Scene previews stay off either way. Complements #82. Not 1.2.51 (Tron).",
  "1.2.50.22: Hybrid 1080+4K reliably lands as one tile. Recycle bin is chowned to the engine user so Radarr stops 400ing the mediamanagement PUT and keeps the 1080 when 4K upgrades. Apply removes leftover HostConfig.Dns=1.1.1.1 containers before recreate, so the fixed-name Seerr/Decypharr clash no longer skips compose up. Sonarr manualimport scans each dump folder instead of the whole FUSE tree so TV imports stop timing out. The 4K-only 1080-companion grab gets a 90s interactive search (sweep 300s) so a 1080 actually grabs. Complements #73. Not 1.2.51 (Tron).",
  "1.2.50.21: One poster in Jellyfin Movies after a scan (native `Title (Year) - 1080p` / `- 2160p`; extra 4Ks park; merge LAST). Hybrid grabs 1080 and 4K and keeps both (recycle+restore, cutoff 4K, interactive 1080 for 4K-only titles). Apply heals dumps already on the box and recreates *arr that still carry HostConfig.Dns=1.1.1.1. Settings Fix: named Run scripts with descriptions; hops are not guessed green; Run says Finished or the log. Phone Home paints without waiting on /api/box. Never /media. Complements #72. Not 1.2.51 (Tron).",
  "1.2.50.20: Apply parks release-named movie dumps into Title (Year) so Jellyfin Movies is not Interstellar×3 / Dune×2. Part One aliases Dune (2021); Part Two does not. Same-folder files MergeVersions to one poster. TV season packs with quality after S01 collapse into the series folder. Never /media. Complements #71. Not 1.2.51 (Tron).",
  "1.2.50.19: House Apply of 1.2.50.18 recreated compose, left ENOTCONN FUSE, and SIGKILL'd Decypharr/Jellyfin/Radarr/Sonarr. Mailman treated [ -e __all__ ] as mounted. Lazy-unmount before compose up; hops/wait use ls not -e; docker start exited readers after remount. Complements #69. Not 1.2.51 (Tron).",
  "1.2.50.18: FUSE dumps named [Bitsearch.to] Show.S01… now relink into the Sonarr series folder, so a requested season can import without a tap. TV Requests say searching / linked / unmonitored instead of silent 0%. Library Items send MediaBrowser Token (JF 12 401 on X-Emby-Token alone). Complements #69 Discover. Not 1.2.51 (Tron #52).",
  "1.2.50.17: Discover browse is Seerr popular movies/shows this box does not have — not the Jellyfin shelf. Search still lookup. TorBox wizard ping sends a named User-Agent. Wait longer for Seerr first-run so Finish can login. Not 1.2.51 (Tron #52).",
  "1.2.50.16: Live *arr v4 lists Torznab YTS with enable=null (search flags on). Heal treated that as no indexer — MoviesSearch worked, Apply stayed heal_red. Count RSS/search flags. Complements #69 DNS + mailman. Not 1.2.51 (Tron #52).",
  "1.2.50.15: House Apply of 1.2.50.13 left containers 14h old because mailman compared tarball compose yml to the already-swapped live file (always unchanged). Compare against the pre-swap yml so dropping dns: 1.1.1.1 actually recreates *arr. Refuse a second Apply instead of deleting ota.lock. Remount FUSE after compose up before hops. Complements #69 DNS. Not 1.2.51 (Tron #52).",
  "1.2.50.14: House Apply of 1.2.50.13 heal_red'd again (still 1.2.50.11). compose dns: 1.1.1.1 hid Docker names (radarr/prowlarr/decypharr); docker compose ps ETIMEDOUT so Torznab fell back to hostname prowlarr which Radarr cannot resolve. Drop per-container dns so embedded DNS works. Keep forceSave. Complements #68. Not 1.2.51 (Tron #52).",
  "1.2.50.13: House Apply of 1.2.50.12 stayed honest (heal red, no stamp) because *arr rejected the Torznab POST (test-on-add, hand-rolled body) and Prowlarr fullSync never landed. Attach now clones /indexer/schema, POSTs ?forceSave=true, waits for ApplicationIndexerSync, and talks to Prowlarr/*arr/Seerr by container IP so compose dns: 1.1.1.1 cannot hide service names. Complements #67. Not 1.2.51 (Tron #52).",
  "1.2.50.12: Prowlarr fullSync force-pushes searchable indexers onto Sonarr and Radarr (enable + Torznab attach if ApplicationIndexerSync leaves them empty). Seerr movie recover/POST adds a missing Radarr row via lookup/tmdb (National Treasure). Doctor Jellyfin VirtualFolders sends MediaBrowser Token headers. Complements #64/#66. Not 1.2.51 (Tron #52).",
  "1.2.50.11: Apply does not stamp VERSION after JF/indexer heal red. Import scans dumps then heals — it does not re-ingest collapsed dumps. Doctor checks JF library paths, Radarr add/search, and Sonarr search indexers. stuck-downloads remonitors + lock/widen before search. kickArrRecover and pipeline.radarrMissing tell the truth. Complements #62/#64. Not 1.2.51 (Tron #52).",
  "1.2.50.10: Disabled Decypharr client is not a lock. Doctor fails closed when it cannot probe download clients. recover=1 only kicks Seerr-requested titles, not the whole *arr backlog. Ghost AVAILABLE and GET-by-id carry a reason. Retry re-POSTs /api/request. Complements #62. Not 1.2.51 (Tron #52).",
  "1.2.50.9: Home merges a jf-only season-folder row (TWD - Season 1 / 2011) onto the tvdb series even when PremiereDate ≠ series year. Remakes and anime split seasons with real ids stay separate. Apply heals leftover JF Series items (delete/rename) — season-named dump dirs only, never a /media local-disk row. Requests never sit on silent 0% — say searching / unmonitored / quality / queue; recover monitors and MoviesSearchs. Not 1.2.51 (Tron #52).",
  "1.2.50.8: Home collapses JF season-folder aliases (B99 S01 / TWD - Season 1) without hiding remakes. Apply heals leftover JF libraries/paths and season-named dumps; keeps /media on local/both. Movie POST/recover locks Decypharr, widens quality, adds to Radarr if Seerr never pushed, then MoviesSearch. Honest reason when Radarr has no movie or no grab client. Not 1.2.51 (Tron #52).",
  "1.2.50.7: OTA POSTs EZTV/ShowRSS via TorrentRss when Cardigann schema is missing. Doctor lists every indexer. recover=1 locks Decypharr + falls Ultra-HD back to Any so SeasonSearch can grab 720p. Jellyfin Movies/Shows keep one dump path (no Interstellar×3). Not 1.2.51 (Tron #52).",
  "1.2.50.6: OTA adds EZTV/ShowRSS (YTS is movies-only) and fullSyncs Prowlarr→Sonarr. SeasonSearch still fires for 0-file TV. MoviesSearch on movie POST. Not 1.2.51 (Tron #52).",
  "1.2.50.5: Discover search surfaces Seerr timeout/empty honestly. TV POST is one season (never all). No Cached glow on live TMDB ids. QA gate: 2 movies + 2 TV seasons 2012–2016 search→request→honest 0%. Not 1.2.51 (Tron #52).",
  "1.2.50.4: SeasonSearch on empty TV season POST/reuse. GET /api/request?recover=1. stuck-downloads searches 0-file monitored seasons. Keep Decypharr dumps. Honest unfinished TV when Seerr is empty. Not 1.2.51 (Tron #52).",
  "1.2.50.3: Apply Stage 3 heartbeat. Relink recreates empty sonarr/radarr dumps from FUSE. Title page season-honest, no 42%. Not 1.2.51 (Tron #52).",
  "1.2.50.2: Requests tell the truth. Library / Seerr available / *arr hasFile ⇒ AVAILABLE, not grabbing. Duplicate same title+season collapses. Not 1.2.51 (Tron #52).",
  "1.2.50.1: TV season grab→symlink→Sonarr import. Skip movie dumps under Sonarr. Match S01.E01 / season packs. Reuse duplicate season requests.",
  "1.2.50: Stacked house Apply (#45–#50). Overlay house compose/configs so #49 seed cannot nest. FUSE rslave ENOTCONN heal + importPending retry. Check then Apply.",
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

export interface ReelState {
  hydrated: boolean;
  phase: Phase;
  wizardStep: number;
  answers: WizardAnswers;
  build: BuildStep[];
  buildLogOpen: boolean;
  provisioned: boolean;
  requests: MediaRequest[];
  library: string[];
  shelf: Title[];
  shelfError: string | null;
  shelfReady: boolean;
  watchProgress: Record<string, number>;
  activity: ActivityEvent[];
  users: HouseholdUser[];
  settings: Settings;
  update: UpdateState;
  libraryCatchup: LibraryCatchupState;
  adapter: AdapterState;
  indexers: IndexerEntry[];
  remoteTitles: Title[];
  bootSteps: Record<BootStepId, BootStepStatus>;
  requestsSeeded: boolean;
  setHydrated: () => void;
  setBootStep: (id: BootStepId, status: BootStepStatus) => void;
  applyReadyPayload: (ready: ReadyPayload) => void;
  setPhase: (p: Phase) => void;
  setWizardStep: (n: number) => void;
  patchAnswers: (p: Partial<WizardAnswers>) => void;
  patchIntent: (p: Partial<Intent>) => void;
  startBuild: () => void;
  tick: () => void;
  openReelOS: () => void;
  requestTitle: (titleId: string, season?: number) => void;
  cancelRequest: (id: string) => void;
  retryRequest: (id: string) => void;
  setWatchProgress: (titleId: string, v: number) => void;
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
  hydrateShelf: (opts?: { limit?: number }) => void;
  dropLibraryTitle: (titleId: string, extraIds?: string[]) => void;
}

const shelfFetches = new Map<string, Promise<void>>();

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
  source: "torbox",
  apiKey: "lab-preview-not-live",
  adminName: "Ada",
  adminPassword: "household",
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
  build: [] as BuildStep[],
  buildLogOpen: false,
  provisioned: false,
  requests: [] as MediaRequest[],
  library: [] as string[],
  shelf: [] as Title[],
  shelfError: null as string | null,
  shelfReady: false,
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
  indexers: [] as IndexerEntry[],
  remoteTitles: [] as Title[],
  bootSteps: idleBootSteps(),
  requestsSeeded: false,
};

export const useReelStore = create<ReelState>()(
  persist(
    (set, get) => ({
      ...initial,
      setHydrated: () => set({ hydrated: true }),
      setBootStep: (id, status) => set({ bootSteps: { ...get().bootSteps, [id]: status } }),
      applyReadyPayload: (ready) => {
        const provisioned = Boolean(ready?.provisioned);
        const incoming = ready?.answers && typeof ready.answers === "object" ? ready.answers : null;
        const titles = Array.isArray(ready?.titles) ? ready.titles : [];
        const live = Array.isArray(ready?.requests) ? ready.requests : [];
        if (titles.length) rememberCatalogTitles(titles);
        set((s) => {
          const { adminPassword: _omitPassword, ...safeIncoming } = (incoming || {}) as WizardAnswers & {
            adminPassword?: string;
          };
          void _omitPassword;
          const answers = incoming ? { ...s.answers, ...safeIncoming, adminPassword: s.answers.adminPassword } : s.answers;
          const shelf = titles.length ? mergeShelf(s.shelf, titles, true) : s.shelf;
          const requests = overlayLibraryPresence(mergeServerRequests(s.requests, live), {
            titles: shelf,
          });
          const library = [...new Set(shelf.map((t) => t.id))];
          const libraryOk = Array.isArray(ready?.titles);
          const requestsOk = Array.isArray(ready?.requests);
          return {
            answers,
            shelf,
            shelfError: libraryOk ? null : s.shelfError,
            shelfReady: libraryOk || s.shelfReady || Boolean(shelf.length),
            library,
            requests,
            requestsSeeded: requestsOk || s.requestsSeeded,
            bootSteps: {
              ...s.bootSteps,
              local: "ok" as const,
              house: provisioned ? ("ok" as const) : ("fail" as const),
              library: libraryOk ? ("ok" as const) : ("fail" as const),
              requests: requestsOk ? ("ok" as const) : ("fail" as const),
            },
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
            libraryCatchup: {
              status: (lib.status as LibraryCatchupState["status"]) || "idle",
              message: String(lib.message || ""),
              folder: Number(lib.folder || 0) || 0,
              total: Number(lib.total || 0) || 0,
              skipped: Number(lib.skipped || 0) || 0,
              timeouts: Number(lib.timeouts || 0) || 0,
              needsImport: Boolean(lib.needsImport),
              splashLock: Boolean(lib.splashLock),
            },
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
      setPhase: (phase) => set({ phase }),
      setWizardStep: (wizardStep) => set({ wizardStep }),
      patchAnswers: (p) => set({ answers: { ...get().answers, ...p } }),
      patchIntent: (p) =>
        set({ answers: { ...get().answers, intent: { ...get().answers.intent, ...p } } }),
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
      cancelRequest: (id) => set({ requests: get().requests.filter((r) => r.id !== id) }),
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
      setWatchProgress: (titleId, v) =>
        set({ watchProgress: { ...get().watchProgress, [titleId]: v } }),
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
                libraryCatchup: {
                  status: (st.library.status as LibraryCatchupState["status"]) || "idle",
                  message: String(st.library.message || ""),
                  folder: Number(st.library.folder || 0) || 0,
                  total: Number(st.library.total || 0) || 0,
                  skipped: Number(st.library.skipped || 0) || 0,
                  timeouts: Number(st.library.timeouts || 0) || 0,
                  needsImport: Boolean(st.library.needsImport),
                  splashLock: Boolean(st.library.splashLock),
                },
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
          .then((r: { ok?: boolean; available?: boolean; local?: string; remote?: string; notes?: string[]; pendingNotes?: string[]; error?: string }) => {
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
                      libraryCatchup: {
                        status: (st.library.status as LibraryCatchupState["status"]) || "idle",
                        message: String(st.library.message || ""),
                        folder: Number(st.library.folder || 0) || 0,
                        total: Number(st.library.total || 0) || 0,
                        skipped: Number(st.library.skipped || 0) || 0,
                        timeouts: Number(st.library.timeouts || 0) || 0,
                        needsImport: Boolean(st.library.needsImport),
                        splashLock: Boolean(st.library.splashLock),
                      },
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
        const have = new Set(get().remoteTitles.map((t) => t.id));
        const extra = titles.filter((t) => !have.has(t.id));
        if (!extra.length) return;
        rememberCatalogTitles(extra);
        set({ remoteTitles: [...extra, ...get().remoteTitles].slice(0, 80) });
      },
      dropLibraryTitle: (titleId, extraIds = []) => {
        const s = get();
        const overlay = dropLibraryOverlay(
          { shelf: s.shelf, library: s.library, requests: s.requests },
          titleId,
          extraIds,
        );
        set({ shelf: overlay.shelf, library: overlay.library, requests: overlay.requests });
      },
      hydrateShelf: (opts) => {
        if (get().shelfReady) return;
        const limit = opts?.limit;
        const key = limit ? `n${limit}` : "all";
        if (shelfFetches.has(key)) return;
        const qs = limit ? `?limit=${encodeURIComponent(String(limit))}` : "";
        const p = fetch(`/api/library${qs}`, { cache: "no-store" })
          .then((r) => r.json() as Promise<{ titles?: Title[]; error?: string | null }>)
          .then((j) => {
            const titles = Array.isArray(j.titles) ? j.titles : [];
            rememberCatalogTitles(titles);
            const cur = get();
            const shelf = mergeShelf(cur.shelf, titles, Boolean(limit));
            const library = [...new Set(shelf.map((t) => t.id))];
            const requests = overlayLibraryPresence(cur.requests, {
              titles: shelf,
            });
            set({
              shelf,
              shelfError: j.error || null,
              shelfReady: true,
              library,
              requests,
            });
          })
          .catch((e) => set({ shelfError: String(e), shelfReady: true }))
          .finally(() => {
            shelfFetches.delete(key);
          });
        shelfFetches.set(key, p);
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
        build: s.build,
        buildLogOpen: s.buildLogOpen,
        provisioned: s.provisioned,
        requests: s.requests,
        library: s.library,
        shelf: s.shelf,
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
        state.update = idleUpdate();
        state.libraryCatchup = idleLibraryCatchup();
        if (state.shelf?.length) state.shelfReady = true;
      },
    },
  ),
);

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
  debrid: "Debrid only",
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
