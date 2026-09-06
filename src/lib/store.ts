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

export const defaultAnswers: WizardAnswers = {
  storageMode: "both",
  selectedDisks: ["sda", "sdb"],
  formatDisks: [],
  source: "real-debrid",
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
}

export const CHANNEL = "stable";
export const LATEST_VERSION = "1.2.6";
export const SHIPPED_VERSION = "1.2.6";
export const CHANNEL_URL = "https://raw.githubusercontent.com/ajt1995/reelos/main/channel.json";

export const UPDATE_NOTES = [
  "Open Jellyfin in this browser. TV uses http://<ip>:8096.",
  "Search talks to Radarr on the box. OTA will not install Chromium.",
  "New browser hydrates from the box. Do not re-run the wizard.",
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
    daysLeft: answers.source === "local-vpn" ? 0 : 38,
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
  watchProgress: Record<string, number>;
  activity: ActivityEvent[];
  users: HouseholdUser[];
  settings: Settings;
  update: UpdateState;
  adapter: AdapterState;
  indexers: IndexerEntry[];
  remoteTitles: Title[];
  setHydrated: () => void;
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
  startUpdate: () => void;
  pingAdapter: () => void;
  addIndexer: (name: string, url: string, key: string) => void;
  removeIndexer: (id: string) => void;
  pasteRelease: (titleId: string, raw: string) => boolean;
  rememberTitles: (titles: Title[]) => void;
}

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
    transcode: "No discrete GPU. Software encode with a Settings note.",
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
  apiKey: "RD-LAB-KEY-7F3A",
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
  } as Settings,
  update: idleUpdate(),
  adapter: makeAdapter(defaultAnswers),
  indexers: [] as IndexerEntry[],
  remoteTitles: [] as Title[],
};

export const useReelStore = create<ReelState>()(
  persist(
    (set, get) => ({
      ...initial,
      setHydrated: () => set({ hydrated: true }),
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
        const s = get();
        if (s.phase === "building") {
          const build = s.build.map((st) => ({ ...st }));
          const running = build.findIndex((st) => st.status === "running");
          if (running === -1) return;
          const cur = build[running];
          if (cur.status === "running" && !cur.log) {
            cur.log = logFor(cur.id, cur.label);
            set({ build });
            return;
          }
          cur.status = "done";
          const next = build[running + 1];
          if (next) {
            next.status = "running";
            set({ build });
          } else {
            set({
              build,
              phase: "ready",
              activity: [
                event("system", "Provision finished. ReelOS is the front door."),
                event("scan", "Libraries created under /srv/media."),
                ...s.activity,
              ],
            });
          }
          return;
        }

        if (!s.provisioned) return;

        if (s.update.status === "applying") {
          const steps = s.update.steps.map((st) => ({ ...st }));
          const running = steps.findIndex((st) => st.status === "running");
          if (running !== -1) {
            const cur = steps[running];
            if (!cur.log) {
              cur.log = logFor(cur.id, cur.label);
              set({ update: { ...s.update, steps } });
              return;
            }
            cur.status = "done";
            const next = steps[running + 1];
            if (next) {
              next.status = "running";
              set({ update: { ...s.update, steps } });
              return;
            }
            const nextVer = s.update.target ?? LATEST_VERSION;
            set({
              update: {
                status: "current",
                current: nextVer,
                target: null,
                checkedAt: Date.now(),
                steps,
                notes: [],
              },
              activity: [
                event("system", `ReelOS ${nextVer} applied. Libraries were not touched.`),
                ...s.activity,
              ].slice(0, 40),
            });
            return;
          }
        }

        let changed = false;
        const library = [...s.library];
        const activity = [...s.activity];
        let adapter = s.adapter;
        const providerName = sourceLabel[s.answers.source];
        const requests = s.requests.map((r) => {
          if (r.status === "waiting") {
            const wait = r.via === "cache" ? 500 : r.via === "uncached" ? 2000 : 1800;
            if (Date.now() - r.updatedAt > wait) {
              const title = getTitle(r.titleId);
              if (!title) return r;
              changed = true;
              const local = s.answers.source === "local-vpn";
              const cached = !local && titleInCache(title);
              const via: MediaRequest["via"] = local ? "local" : cached ? "cache" : "uncached";
              const release = syntheticRelease(title, s.answers.quality);
              if (via === "cache") {
                activity.unshift(
                  event("grab", `Cache hit — ${title.title} on ${providerName}`, r.titleId),
                );
              } else if (via === "uncached") {
                activity.unshift(
                  event(
                    "grab",
                    `Uncached. ${s.adapter.kind === "torbox" ? "TorBox" : "Decypharr"} sent ${title.title} to ${providerName}.`,
                    r.titleId,
                  ),
                );
              } else {
                activity.unshift(event("grab", `qBittorrent grabbed ${title.title}`, r.titleId));
              }
              return {
                ...r,
                status: "downloading" as const,
                progress: via === "cache" ? 52 : 6,
                via,
                release,
                updatedAt: Date.now(),
              };
            }
          }
          if (r.status === "downloading") {
            changed = true;
            const bump =
              r.via === "cache" ? 16 + Math.random() * 14 : r.via === "local" ? 3 + Math.random() * 5 : 4 + Math.random() * 7;
            const progress = Math.min(100, r.progress + bump);
            if (progress >= 100) {
              if (!library.includes(r.titleId)) library.push(r.titleId);
              if (r.via === "cache") adapter = { ...adapter, cacheHits: adapter.cacheHits + 1 };
              else adapter = { ...adapter, transfers: adapter.transfers + 1 };
              activity.unshift(
                event("import", `Imported ${getTitle(r.titleId)?.title} into the library`, r.titleId),
              );
              return { ...r, status: "available" as const, progress: 100, updatedAt: Date.now() };
            }
            return { ...r, progress, updatedAt: Date.now() };
          }
          return r;
        });
        if (changed) set({ requests, library, activity: activity.slice(0, 40), adapter });
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
          status: fail ? "failed" : cached ? "downloading" : "waiting",
          progress: fail ? 0 : cached ? 42 : 0,
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
        set({
          requests: s.requests.map((r) =>
            r.id === id
              ? { ...r, status: "waiting", progress: 0, reason: undefined, updatedAt: Date.now() }
              : r,
          ),
        });
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
      factoryReset: () => set({ ...initial, hydrated: true }),
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
          .then((r: { ok?: boolean; available?: boolean; local?: string; remote?: string; notes?: string[]; error?: string }) => {
            const cur = get();
            if (r.ok && r.available) {
              set({
                update: {
                  ...cur.update,
                  status: "available",
                  current: r.local || cur.update.current,
                  target: r.remote || null,
                  notes: r.notes?.length ? r.notes : UPDATE_NOTES,
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
            const tick = () => {
              void fetch("/api/update/status", { cache: "no-store" })
                .then((r) => r.json())
                .then((st: { running?: boolean; local?: string; log?: string }) => {
                  const cur = get();
                  const steps2 = (cur.update.steps || []).map((x) => ({ ...x }));
                  if (steps2[0]) {
                    steps2[0].status = "running";
                    steps2[0].log = st.log || "";
                  }
                  if (st.running) {
                    set({ update: { ...cur.update, status: "applying", steps: steps2 } });
                    window.setTimeout(tick, 2500);
                    return;
                  }
                  if (st.local && target && st.local === target) {
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
                  set({
                    update: {
                      ...cur.update,
                      status: "error",
                      current: st.local || cur.update.current,
                      notes: [st.log || "Apply ended. Version did not change."],
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
        const s = get();
        const next = makeAdapter(s.answers);
        next.cacheHits = s.adapter.cacheHits;
        next.transfers = s.adapter.transfers;
        next.daysLeft = s.adapter.daysLeft || next.daysLeft;
        next.pingMs = 28 + Math.round(Math.random() * 24);
        next.lastPing = Date.now();
        set({
          adapter: next,
          activity: [
            event("system", `${next.status === "healthy" ? "Adapter ping ok" : "Adapter offline"} · ${next.pingMs}ms`),
            ...s.activity,
          ].slice(0, 40),
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
