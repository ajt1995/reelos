import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as rememberCatalogTitles } from "./appliance-Dk74LcNF.mjs";
import { N as Check, h as Play, m as Plus } from "../_libs/lucide-react.mjs";
import { I as titleMatchesId, L as titlePresenceKeys, M as requestTitleIdForPage, O as requestMediaTypeForPage, _ as useReelStore } from "./router-CtrlqYXZ.mjs";
import { n as Button, o as jellyfinWatchHref } from "./gate-BMLuYs-K.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/presence-row-Xr0E3vsu.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** POST /api/request for a collection/filmography row. Person and collection ids never go here. */
function requestBodyForTitle(title, season) {
	if (!title?.id) return null;
	const extra = titlePresenceKeys(title.id, title.ids || []);
	const titleId = requestTitleIdForPage(title.id, title.kind, extra);
	if (!titleId || titleId.startsWith("person-") || titleId.startsWith("collection-")) return null;
	const mediaType = requestMediaTypeForPage(titleId, title.kind);
	const tmdbRaw = mediaType === "tv" ? titleId.startsWith("tmdb-tv-") ? titleId.slice(8) : extra.find((k) => k.startsWith("tmdb-tv-"))?.slice(8) || extra.find((k) => /^tmdb-\d/.test(k))?.slice(5) : titleId.startsWith("tmdb-") && !titleId.startsWith("tmdb-tv-") ? titleId.slice(5) : extra.find((k) => /^tmdb-\d/.test(k) && !k.startsWith("tmdb-tv-"))?.slice(5);
	const tmdb = Number(tmdbRaw);
	if (!Number.isFinite(tmdb) || tmdb <= 0) return null;
	return {
		titleId,
		title: title.title,
		mediaType,
		tmdb,
		season: mediaType === "tv" ? Number(season) > 0 ? Number(season) : 1 : void 0
	};
}
async function postTitleRequest(title, season) {
	const body = requestBodyForTitle(title, season);
	if (!body) return {
		ok: false,
		error: "Need a TMDB movie or show id to Request."
	};
	const res = await fetch("/api/request", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body)
	});
	const j = await res.json().catch(() => null);
	if (!res.ok || !j?.ok) return {
		ok: false,
		error: j?.error || `request ${res.status}`
	};
	return { ok: true };
}
function PresenceRow({ title }) {
	const [err, setErr] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const requestTitle = useReelStore((s) => s.requestTitle);
	const ipv4 = useReelStore((s) => s.ipv4);
	const tailscaleIp = useReelStore((s) => s.tailscaleIp);
	const watchDoor = useReelStore((s) => s.watch);
	const extra = titlePresenceKeys(title.id, title.ids || []);
	const inLibrary = useReelStore((s) => {
		if (title.inLibrary || s.library.includes(title.id)) return true;
		return [...s.shelf, ...s.remoteTitles].some((t) => titleMatchesId(t, title.id) && s.library.some((lib) => titleMatchesId(t, lib)));
	});
	const request = useReelStore((s) => {
		const keys = new Set(extra);
		return s.requests.find((r) => {
			if (r.status === "failed") return false;
			if (!titlePresenceKeys(r.titleId).some((k) => keys.has(k))) return false;
			if (title.kind === "tv" || title.kind === "anime") return r.season == null || r.season === 1;
			return r.season == null;
		});
	});
	const hostname = typeof window !== "undefined" ? window.location.hostname : "";
	const jellyfin = inLibrary ? jellyfinWatchHref({
		ipv4,
		tailscaleIp,
		watch: watchDoor,
		hostname,
		jellyfinId: title.jellyfinId
	}) : "";
	const body = requestBodyForTitle(title);
	const series = title.kind === "tv" || title.kind === "anime";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "flex items-center gap-3 border-b border-border/60 py-3 last:border-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
			to: "/title/$id",
			params: { id: title.id },
			className: "flex min-w-0 flex-1 items-center gap-3",
			onClick: () => rememberCatalogTitles([title]),
			children: [title.poster ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: title.poster,
				alt: "",
				className: "h-16 w-11 shrink-0 rounded-md object-cover"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-16 w-11 shrink-0 rounded-md bg-card-2" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "min-w-0",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block truncate text-sm font-medium",
						children: title.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "block text-xs text-muted",
						children: [title.year || null, series ? " · Show" : " · Movie"]
					}),
					err ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-1 block text-xs text-danger",
						children: err
					}) : null
				]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center",
			children: [inLibrary && jellyfin ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
				href: jellyfin,
				target: "_blank",
				rel: "noreferrer",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, {
						className: "size-3.5",
						fill: "currentColor"
					}), "Watch"]
				})
			}) : null, inLibrary ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "inline-flex h-9 items-center gap-1 rounded-lg bg-success/10 px-2.5 text-xs text-success",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5" }), "In library"]
			}) : request?.status === "downloading" || request?.status === "waiting" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "inline-flex h-9 items-center rounded-lg bg-card px-2.5 text-xs text-gold",
				children: request.status === "downloading" ? "Grabbing" : request.reason || "Waiting"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				variant: "ghost",
				size: "sm",
				disabled: busy || !body,
				onClick: () => {
					if (!body) return;
					setErr(null);
					setBusy(true);
					rememberCatalogTitles([title]);
					requestTitle(body.titleId, body.season);
					postTitleRequest(title, body.season).then((r) => {
						if (!r.ok) setErr(r.error || "Engine did not add the title");
					}).finally(() => setBusy(false));
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), series ? "Request S01" : "Request"]
			})]
		})]
	});
}
//#endregion
export { PresenceRow as t };
