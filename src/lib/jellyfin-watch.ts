/** Working Jellyfin door: LAN or Tailscale IP:8096, never hostname:8096 (that 302s). */

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
  const host = String(opts.hostname || "")
    .trim()
    .replace(/^\[|\]$/g, "");
  // Loopback is the phone/browser, not the box — Watch would hit another process on :8096.
  if (lanV4(host)) return `http://${host}:8096`;
  const ts = lanV4(opts.tailscaleIp);
  const lan = lanV4(opts.ipv4);
  const fromWatch = String(opts.watch || "")
    .trim()
    .replace(/\/$/, "");
  const onTail = /\.ts\.net$/i.test(host) || host.startsWith("100.");
  if (onTail && ts) return `http://${ts}:8096`;
  if (lan) return `http://${lan}:8096`;
  const watchHost = fromWatch.replace(/^https?:\/\//i, "").split("/")[0]?.split(":")[0] || "";
  if (/^https?:\/\/\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?$/i.test(fromWatch) && lanV4(watchHost)) {
    return fromWatch;
  }
  if (ts) return `http://${ts}:8096`;
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
