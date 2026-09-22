//#region node_modules/.nitro/vite/services/ssr/assets/jellyfin-watch-DyhgK2S6.js
/** Household stream door: LAN or Tailscale IP:8080 / window.location.origin. */
var V4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
var LOOPBACK = /^(127\.0\.0\.1|localhost|::1)$/i;
function lanV4(raw) {
	const s = String(raw || "").trim();
	if (!V4.test(s) || LOOPBACK.test(s)) return "";
	return s;
}
function jellyfinWatchOrigin(opts = {}) {
	if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
	const host = String(opts.hostname || "").trim().replace(/^\[|\]$/g, "");
	if (lanV4(host)) return `http://${host}:8080`;
	const ts = lanV4(opts.tailscaleIp);
	const lan = lanV4(opts.ipv4);
	const fromWatch = String(opts.watch || "").trim().replace(/\/$/, "");
	if ((/\.ts\.net$/i.test(host) || host.startsWith("100.")) && ts) return `http://${ts}:8080`;
	if (lan) return `http://${lan}:8080`;
	const watchHost = fromWatch.replace(/^https?:\/\//i, "").split("/")[0]?.split(":")[0] || "";
	if (/^https?:\/\/\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?$/i.test(fromWatch) && lanV4(watchHost)) return fromWatch;
	if (ts) return `http://${ts}:8080`;
	return "";
}
function jellyfinWatchHref(opts = {}) {
	const origin = jellyfinWatchOrigin(opts);
	if (!origin) return "";
	const id = String(opts.jellyfinId || "").trim();
	if (!id) return origin;
	return `${origin}/web/#/details?id=${encodeURIComponent(id)}`;
}
function jellyfinStreamUrl(opts = {}) {
	const origin = jellyfinWatchOrigin(opts);
	if (!origin) return "";
	const id = String(opts.jellyfinId || "").trim();
	if (!id) return "";
	return `${origin}/api/stream/item/${encodeURIComponent(id)}`;
}
//#endregion
export { jellyfinWatchHref as n, jellyfinWatchOrigin as r, jellyfinStreamUrl as t };
