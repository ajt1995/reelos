import type { Frontend, SourceId, Title } from "./types";

export type AdapterKind = "decypharr" | "torbox" | "qbittorrent";
export type RequestVia = "cache" | "uncached" | "local";

/** Titles the lab provider does not have cached — they transfer. */
const UNCACHED = new Set([
  "copper-tide",
  "chamber-12",
  "after-floodlights",
  "station-line",
  "second-shift",
  "quiet-atlas",
  "salt-velvet",
  "hollow-broadcast",
]);

/** Live Seerr/Jellyfin ids are not lab catalog — no fake Cached glow. */
export function isLiveEngineTitleId(id?: string): boolean {
  return /^(tmdb-|tvdb-|jf-)/.test(String(id || ""));
}

export function titleInCache(title: Title): boolean {
  if (!title?.id || isLiveEngineTitleId(title.id)) return false;
  return !UNCACHED.has(title.id);
}

export function adapterProfile(source: SourceId, frontend: Frontend) {
  if (source === "local-vpn") {
    return {
      kind: "qbittorrent" as AdapterKind,
      name: "qBittorrent",
      fandom: "qBittorrent",
      port: "8085",
      mount: "/srv/media/downloads",
      account: "Gluetun killswitch on",
      api: "Native",
      blurb: "Local client on the VPN network. Engines send work here.",
    };
  }
  if (source === "torbox") {
    const mount = frontend === "plex" ? "/mnt/torbox (FUSE)" : "/mnt/torbox (STRM)";
    return {
      kind: "torbox" as AdapterKind,
      name: "TorBox",
      fandom: "TorBox",
      port: "8085",
      mount,
      account: "Premium",
      api: "qBittorrent-compatible shim",
      blurb: "Official mount plus a shim so the engines can send work.",
    };
  }
  const provider =
    source === "alldebrid" ? "AllDebrid" : source === "premiumize" ? "Premiumize" : "Real-Debrid";
  return {
    kind: "decypharr" as AdapterKind,
    name: "Decypharr",
    fandom: "Decypharr",
    port: "8085",
    mount: "/mnt/debrid",
    account: `Premium · ${provider}`,
    api: "qBittorrent-compatible",
    blurb: "Maintained download-client API. Engines talk to this, not the provider.",
  };
}

export function pingCopy(source: SourceId, frontend: Frontend): string {
  const p = adapterProfile(source, frontend);
  if (source === "local-vpn") return "VPN client ready. Killswitch on.";
  if (source === "torbox") return `Account live. ${p.mount}. ${p.api}.`;
  return `Premium · 38 days. ${p.name} will be the download client.`;
}

export function syntheticRelease(title: Title, floor: string): string {
  const res = title.maxQuality === "4k" && floor !== "1080p" ? "2160p" : "1080p";
  const slug = title.title.replace(/[^A-Za-z0-9]+/g, ".");
  return `${slug}.${title.year}.${res}.WEB-DL.DDP5.1`;
}

export function cacheHint(title: Title, source: SourceId): "cache" | "uncached" | "local" {
  if (source === "local-vpn") return "local";
  return titleInCache(title) ? "cache" : "uncached";
}

export function cacheCopy(title: Title, source: SourceId): string {
  const via = cacheHint(title, source);
  if (via === "local") return "Will download through the VPN client.";
  const name =
    source === "torbox"
      ? "TorBox"
      : source === "alldebrid"
        ? "AllDebrid"
        : source === "premiumize"
          ? "Premiumize"
          : "Real-Debrid";
  if (via === "cache") return `Cached on ${name}. Request imports it.`;
  const client = source === "torbox" ? "TorBox" : "Decypharr";
  return `Not in the ${name} cache. ${client} will transfer.`;
}

export function viaLabel(via: RequestVia | undefined, status: string): string | null {
  if (status === "waiting") {
    if (via === "uncached") return "No cache · looking for a transfer";
    if (via === "cache") return "Cache hit · waiting to import";
    return "Waiting for a release";
  }
  if (status === "available") {
    if (via === "cache") return "Cached · in library";
    if (via === "local") return "Downloaded · in library";
    if (via === "uncached") return "Transferred · in library";
    return "Available now";
  }
  if (status === "downloading") {
    if (via === "cache") return "Cache hit · importing";
    if (via === "local") return null;
    if (via === "uncached") return "Uncached · transferring";
  }
  return null;
}
