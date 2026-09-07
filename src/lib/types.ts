export type Kind = "movie" | "tv" | "anime" | "kids" | "music";
export type StorageMode = "debrid" | "local" | "both";
export type SourceId =
  | "torbox"
  | "real-debrid"
  | "alldebrid"
  | "premiumize"
  | "local-vpn";
export type QualityFloor = "1080p" | "hybrid" | "4k" | "custom";
export type Frontend = "jellyfin" | "plex" | "both";
export type AccessMode = "lan" | "tailscale" | "cloudflare";
export type Phase = "splash" | "wizard" | "building" | "ready" | "running";
export type RequestStatus = "waiting" | "downloading" | "available" | "failed";
export type RequestVia = "cache" | "uncached" | "local";
export type AdapterKind = "decypharr" | "torbox" | "qbittorrent";
export type AdapterHealth = "offline" | "healthy" | "degraded";
export type BuildStatus = "pending" | "running" | "done" | "error";
export type UpdateStatus = "idle" | "checking" | "available" | "applying" | "current" | "error";

export interface Intent {
  movies: boolean;
  tv: boolean;
  anime: boolean;
  uhd: boolean;
  kids: boolean;
  music: boolean;
}

export interface WizardAnswers {
  storageMode: StorageMode;
  selectedDisks: string[];
  formatDisks: string[];
  source: SourceId;
  apiKey: string;
  vpnProvider: string;
  intent: Intent;
  quality: QualityFloor;
  upgradeCutoff?: boolean;
  frontend: Frontend;
  plexClaim: string;
  adminName: string;
  adminPassword: string;
  access: AccessMode;
  tunnelToken: string;
}

export interface Title {
  id: string;
  kind: Kind;
  title: string;
  year: number;
  runtime?: number;
  seasons?: number;
  tracks?: number;
  rating: number;
  genres: string[];
  overview: string;
  director?: string;
  poster: string;
  jellyfinId?: string;
  maxQuality: "1080p" | "4k";
  popularity: number;
}

export interface MediaRequest {
  id: string;
  titleId: string;
  status: RequestStatus;
  progress: number;
  reason?: string;
  season?: number;
  createdAt: number;
  updatedAt: number;
  requester: string;
  via?: RequestVia;
  release?: string;
}

export interface AdapterState {
  kind: AdapterKind;
  provider: SourceId;
  status: AdapterHealth;
  account: string;
  mount: string;
  pingMs: number;
  cacheHits: number;
  transfers: number;
  lastPing: number | null;
  daysLeft: number;
}

export interface ActivityEvent {
  id: string;
  at: number;
  kind: "request" | "grab" | "import" | "scan" | "index" | "system" | "fail";
  message: string;
  titleId?: string;
}

export interface BuildStep {
  id: string;
  label: string;
  status: BuildStatus;
  log: string;
}

export interface HouseholdUser {
  id: string;
  name: string;
  role: "admin" | "member";
}

export interface Disk {
  id: string;
  label: string;
  size: string;
  kind: string;
  os?: boolean;
}

export interface IndexerEntry {
  id: string;
  name: string;
  url: string;
  key: string;
}

export interface UpdateState {
  status: UpdateStatus;
  current: string;
  target: string | null;
  checkedAt: number | null;
  steps: BuildStep[];
  notes: string[];
}
