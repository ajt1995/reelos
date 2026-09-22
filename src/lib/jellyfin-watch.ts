/** Household stream door: LAN or Tailscale IP:8080 / window.location.origin. */

const V4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const LOOPBACK = /^(127\.0\.0\.1|localhost|::1)$/i;

function lanV4(raw?: string): string {
  const s = String(raw || "").trim();
  if (!V4.test(s) || LOOPBACK.test(s)) return "";
  return s;
}

export function jellyfinWatchOrigin(
  opts: {
    ipv4?: string;
    tailscaleIp?: string;
    watch?: string;
    hostname?: string;
  } = {},
): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  const host = String(opts.hostname || "")
    .trim()
    .replace(/^\[|\]$/g, "");
  if (lanV4(host)) return `http://${host}:8080`;
  const ts = lanV4(opts.tailscaleIp);
  const lan = lanV4(opts.ipv4);
  const fromWatch = String(opts.watch || "")
    .trim()
    .replace(/\/$/, "");
  const onTail = /\.ts\.net$/i.test(host) || host.startsWith("100.");
  if (onTail && ts) return `http://${ts}:8080`;
  if (lan) return `http://${lan}:8080`;
  const watchHost = fromWatch.replace(/^https?:\/\//i, "").split("/")[0]?.split(":")[0] || "";
  if (/^https?:\/\/\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?$/i.test(fromWatch) && lanV4(watchHost)) {
    return fromWatch;
  }
  if (ts) return `http://${ts}:8080`;
  return "";
}

export function jellyfinWatchHref(
  opts: {
    ipv4?: string;
    tailscaleIp?: string;
    watch?: string;
    hostname?: string;
    jellyfinId?: string;
  } = {},
): string {
  const origin = jellyfinWatchOrigin(opts);
  if (!origin) return "";
  const id = String(opts.jellyfinId || "").trim();
  if (!id) return origin;
  return `${origin}/web/#/details?id=${encodeURIComponent(id)}`;
}

export function jellyfinWebPlayerUrl(
  opts: {
    ipv4?: string;
    tailscaleIp?: string;
    watch?: string;
    hostname?: string;
    jellyfinId?: string;
  } = {},
): string {
  const origin = jellyfinWatchOrigin(opts);
  if (!origin) return "";
  const id = String(opts.jellyfinId || "").trim();
  if (!id) return origin;
  return `${origin}/web/index.html#!/video?id=${encodeURIComponent(id)}`;
}

export function jellyfinStreamUrl(
  opts: {
    ipv4?: string;
    tailscaleIp?: string;
    watch?: string;
    hostname?: string;
    jellyfinId?: string;
    mediaSourceId?: string;
    directStream?: boolean;
    playSessionId?: string;
  } = {},
): string {
  const origin = jellyfinWatchOrigin(opts);
  if (!origin) return "";
  const id = String(opts.jellyfinId || "").trim();
  if (!id) return "";
  // The server resolves this logical library id using the authenticated device
  // and active profile. Media-source, codec, and client-provided device hints
  // are deliberately not URL authority: they could otherwise select bytes
  // outside the source and family policy checks.
  return `${origin}/api/stream/item/${encodeURIComponent(id)}`;
}
