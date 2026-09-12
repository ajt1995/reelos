/** Working Jellyfin door: LAN or Tailscale IP:8096, never hostname:8096 (that 302s). */

const V4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

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
  if (V4.test(host)) return `http://${host}:8096`;
  const ts = String(opts.tailscaleIp || "").trim();
  const lan = String(opts.ipv4 || "").trim();
  const fromWatch = String(opts.watch || "")
    .trim()
    .replace(/\/$/, "");
  const onTail = /\.ts\.net$/i.test(host) || host.startsWith("100.");
  if (onTail && V4.test(ts)) return `http://${ts}:8096`;
  if (V4.test(lan)) return `http://${lan}:8096`;
  if (/^https?:\/\/\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?$/i.test(fromWatch)) return fromWatch;
  if (V4.test(ts)) return `http://${ts}:8096`;
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
