import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, _ as createRootRoute, g as createFileRoute, h as lazyRouteComponent, l as Scripts, m as Outlet, p as createRouter, u as HeadContent, x as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as rememberCatalogTitles, i as adapterProfile, l as syntheticRelease, o as getTitle, t as __exportAll, u as titleInCache } from "./appliance-CsV_BBL_.mjs";
import { a as TriangleAlert } from "../_libs/lucide-react.mjs";
import { a as union, i as string, n as number, r as object, t as literal } from "../_libs/zod.mjs";
import { n as persist, r as create, t as createJSONStorage } from "../_libs/zustand.mjs";
//#region ../../workspace/node_modules/.nitro/vite/services/ssr/assets/router-B2ojDOqc.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: error.message || "An unexpected error occurred. Try reloading the page."
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	if (typeof window === "undefined") return () => {};
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	const parentOrigin = resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		if (envelope.data.type === "hello") {
			if (!HelloSchema.safeParse(event.data).success) return;
			announce();
			return;
		}
		if (envelope.data.type === "navigate") {
			const parsed = NavigateSchema.safeParse(event.data);
			if (!parsed.success) return;
			navigate(parsed.data.path);
			queueMicrotask(reportLocation);
			return;
		}
		if (envelope.data.type === "history") {
			const parsed = HistorySchema.safeParse(event.data);
			if (!parsed.success) return;
			if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
			window.history.go(parsed.data.delta);
		}
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
/** Limited Home fetches must not shrink a larger Library shelf. */
function mergeShelf(prev, next, limited) {
	if (!limited) return next;
	if (!prev.length) return next;
	const have = new Set(next.map((t) => t.id));
	return [...next, ...prev.filter((t) => !have.has(t.id))];
}
var SETTLED = /* @__PURE__ */ new Set([
	"done",
	"idle",
	"stopped",
	"stop",
	"backoff"
]);
/** Splash-lock Home only while catch-up is actually running and dumps still need import. */
function catchupLocksHome(c) {
	if (!c) return false;
	const status = String(c.status || "idle").toLowerCase();
	if (SETTLED.has(status)) return false;
	if (status !== "running") return false;
	return Boolean(c.needsImport);
}
/** Full-screen Updating ReelOS splash until the door is actually accepting browse/request. */
function updateLocksUi(status) {
	return String(status || "").toLowerCase() === "applying";
}
function honestCatchupMessage(c, splashLock) {
	const status = String(c.status || "idle").toLowerCase();
	const raw = String(c.message || "");
	const catching = /^library catching up/i.test(raw) || /backing off/i.test(raw);
	if (splashLock) return raw || "Library catching up";
	const skipped = Number(c.skipped || 0) || 0;
	const timeouts = Number(c.timeouts || 0) || 0;
	if (catching || !raw) {
		if (status === "done" || status === "stopped" || status === "running" && !c.needsImport && skipped) {
			if (skipped || timeouts) return `Library catch-up done — ${skipped} skipped, ${timeouts} timeouts`;
			return status === "done" || status === "stopped" ? "Library catch-up done" : "";
		}
		if (status === "idle" || status === "backoff") return "";
		return catching ? "" : raw;
	}
	return raw;
}
function normalizeLibraryCatchup(lib) {
	const src = lib && typeof lib === "object" ? lib : {};
	let status = String(src.status || "idle");
	if (status === "backoff") status = "idle";
	const needsImport = Boolean(src.needsImport);
	const skipped = Number(src.skipped || 0) || 0;
	const timeouts = Number(src.timeouts || 0) || 0;
	const folder = Number(src.folder || 0) || 0;
	const total = Number(src.total || 0) || 0;
	const splashLock = catchupLocksHome({
		status,
		needsImport
	});
	const message = honestCatchupMessage({
		status,
		message: String(src.message || ""),
		skipped,
		timeouts,
		needsImport
	}, splashLock);
	return {
		status,
		message,
		folder,
		total,
		skipped,
		timeouts,
		needsImport,
		splashLock
	};
}
var IN_FLIGHT = /* @__PURE__ */ new Set(["downloading", "waiting"]);
/** Fresh local POST that Seerr has not echoed yet. Older unmatched inflight is stale persist. */
var OPTIMISTIC_LOCAL_MS = 9e4;
/** Raw TMDB ids are not a title — National Treasure must not paint as tmdb-2059. */
function isGhostRequestLabel(title, titleId) {
	const name = String(title || "").trim();
	const id = String(titleId || "").trim();
	if (!name) return true;
	if (id && name === id) return true;
	if (/^[0-9a-f]{32,64}$/i.test(name)) return true;
	return /^tmdb(-tv)?-\d+$/i.test(name);
}
function isOptimisticLocal(row, now = Date.now()) {
	return now - Math.max(row.updatedAt || 0, row.createdAt || 0) < OPTIMISTIC_LOCAL_MS;
}
/** Searching / grabbing / linked waiting for import. Available, failed, and engine-downloaded are not. */
function isInFlightRequest(r) {
	if (r.engine === "downloaded") return false;
	return IN_FLIGHT.has(r.status);
}
/** Home "Your requests", Requests page, and transferring chip: overlay library hits, then keep in-flight only. */
function inFlightRequests(requests, opts = {}) {
	return overlayLibraryPresence(requests, opts).filter(isInFlightRequest);
}
function isTvRequestRow(row) {
	const id = String(row.titleId || "");
	return id.startsWith("tmdb-tv-") || id.startsWith("tvdb-") || row.season != null;
}
/** Per-season Watch vs Request without a title-page click. */
function tvSeasonChips(titleId, requests, titles = []) {
	const keys = new Set(titlePresenceKeys(titleId));
	const bySeason = /* @__PURE__ */ new Map();
	for (const t of titles) {
		if (!titleMatchesId(t, titleId)) continue;
		for (const n of t.onDiskSeasons || []) {
			const season = Number(n);
			if (Number.isFinite(season) && season > 0) bySeason.set(season, "Watch");
		}
	}
	for (const row of requests) {
		if (!titlePresenceKeys(row.titleId).some((k) => keys.has(k))) continue;
		if (row.season == null) continue;
		const n = Number(row.season);
		if (!Number.isFinite(n) || n <= 0) continue;
		if (row.status === "available" || row.engine === "downloaded") bySeason.set(n, "Watch");
		else if (!bySeason.has(n)) bySeason.set(n, "Request");
	}
	return [...bySeason.entries()].sort((a, b) => a[0] - b[0]).map(([season, label]) => ({
		season,
		label
	}));
}
/** Movies: hide Request/Grabbing/Waiting once the title is available. TV/anime: hide only when this season is available. */
function showRequestQueueControls(opts) {
	if (opts.kind === "tv" || opts.kind === "anime") return opts.requestStatus !== "available";
	return !opts.available;
}
/** Locks that will never progress without a write — Retry must stay visible (Cancel is not enough). */
function requestShowsRetry(r) {
	if (r.status === "failed") return true;
	if (r.status === "available") return false;
	return /will not run|has no movie yet|has no series yet|cannot land/i.test(r.reason || "");
}
function requestMatchKey(r) {
	return r.season == null ? r.titleId : `${r.titleId}#${r.season}`;
}
function seasonsCompatible(a, b) {
	return a == null || b == null || a === b;
}
function preferServerRow(local, server) {
	const progress = server.status === "available" ? 100 : typeof server.progress === "number" && server.progress > 0 ? Math.max(0, Math.min(100, Math.round(server.progress))) : server.status === local.status ? local.progress : typeof server.progress === "number" ? server.progress : 0;
	return {
		...local,
		...server,
		id: server.id || local.id,
		status: server.status,
		progress,
		createdAt: local.createdAt || server.createdAt,
		updatedAt: Math.max(local.updatedAt || 0, server.updatedAt || 0),
		requester: server.requester || local.requester,
		season: server.season ?? local.season,
		via: server.via ?? local.via,
		release: server.release ?? local.release,
		reason: server.status === "failed" ? server.reason ?? local.reason : server.reason
	};
}
/** Merge GET /api/request list into persisted local rows. Server status/progress wins. */
function mergeServerRequests(local, server) {
	if (!server.length) return local;
	const serverById = /* @__PURE__ */ new Map();
	const serverByKey = /* @__PURE__ */ new Map();
	for (const row of server) {
		if (row.id) serverById.set(row.id, row);
		if (row.titleId) serverByKey.set(requestMatchKey(row), row);
	}
	const used = /* @__PURE__ */ new Set();
	const out = [];
	for (const loc of local) {
		const match = (loc.id ? serverById.get(loc.id) : void 0) || serverByKey.get(requestMatchKey(loc));
		if (match) {
			if (used.has(match.id)) continue;
			used.add(match.id);
			out.push(preferServerRow(loc, match));
			continue;
		}
		if (loc.status === "downloading" || loc.status === "waiting") {
			const available = server.find((s) => s.titleId === loc.titleId && s.status === "available" && seasonsCompatible(s.season, loc.season));
			if (available) {
				if (used.has(available.id)) continue;
				used.add(available.id);
				out.push(preferServerRow(loc, available));
				continue;
			}
			if (server.some((s) => s.titleId === loc.titleId)) {
				out.push(loc);
				continue;
			}
			if (isOptimisticLocal(loc) || /has no movie yet|has no series yet|search cannot land/i.test(loc.reason || "")) {
				out.push(loc);
				continue;
			}
			continue;
		}
		out.push(loc);
	}
	for (const row of server) {
		if (used.has(row.id)) continue;
		const key = requestMatchKey(row);
		if (out.find((r) => requestMatchKey(r) === key && r.status !== "failed") && row.status !== "available") continue;
		out.push({
			...row,
			progress: row.status === "available" ? 100 : row.progress ?? 0
		});
	}
	return collapseDuplicateRequests(out);
}
var STATUS_RANK = {
	available: 4,
	downloading: 3,
	waiting: 2,
	failed: 1
};
/** Home Your requests: one card per title, not every season row (two Expanse Waitings). */
function collapseHomeRequestCards(rows) {
	const groups = /* @__PURE__ */ new Map();
	for (const row of rows) {
		if (!row?.titleId) continue;
		const list = groups.get(row.titleId) || [];
		list.push(row);
		groups.set(row.titleId, list);
	}
	const out = [];
	for (const list of groups.values()) out.push(list.reduce((best, row) => {
		const br = STATUS_RANK[best.status] || 0;
		const rr = STATUS_RANK[row.status] || 0;
		if (rr !== br) return rr > br ? row : best;
		if ((row.progress || 0) !== (best.progress || 0)) return (row.progress || 0) > (best.progress || 0) ? row : best;
		return (row.updatedAt || 0) >= (best.updatedAt || 0) ? row : best;
	}));
	return out;
}
/** Transferring chip matches the collapsed Home cards, not every season row. */
function transferringChipCount(rows) {
	return collapseHomeRequestCards(rows).length;
}
function markAvailable(row) {
	return {
		...row,
		status: "available",
		progress: 100,
		reason: void 0
	};
}
function isMovieRequest(row) {
	return !String(row.titleId).startsWith("tmdb-tv-") && row.season == null;
}
function titlePresenceKeys(id, extra = []) {
	const keys = /* @__PURE__ */ new Set();
	const add = (raw) => {
		const s = String(raw || "").trim();
		if (!s) return;
		keys.add(s);
	};
	add(id);
	extra.forEach(add);
	if (id.startsWith("tmdb-tv-")) add(`tmdb-${id.slice(8)}`);
	return [...keys];
}
/** POST /api/request titleId: movie pages stay tmdb-<n>, never tmdb-tv-<n>. */
function requestTitleIdForPage(pageId, kind, extraIds = []) {
	const series = kind === "tv" || kind === "anime";
	const ids = extraIds.map(String);
	if (series || pageId.startsWith("tmdb-tv-") || pageId.startsWith("tvdb-")) return ids.find((k) => k.startsWith("tmdb-tv-")) || (pageId.startsWith("tmdb-tv-") ? pageId : "") || ids.find((k) => /^tmdb-\d/.test(k)) || pageId;
	if (pageId.startsWith("tmdb-") && !pageId.startsWith("tmdb-tv-")) return pageId;
	return ids.find((k) => /^tmdb-\d/.test(k) && !k.startsWith("tmdb-tv-")) || pageId;
}
function requestMediaTypeForPage(pageId, kind) {
	if (kind === "tv" || kind === "anime") return "tv";
	if (kind === "movie") return "movie";
	if (pageId.startsWith("tmdb-tv-") || pageId.startsWith("tvdb-")) return "tv";
	return "movie";
}
/** Hash paste is for unnamed dumps. Request on a named title goes to Seerr/*arr. */
function showHashAdapter(opts = {}) {
	const name = String(opts.title || "").trim();
	const id = String(opts.pageId || "").trim();
	if (name === "Unknown on this box") return true;
	return /^[0-9a-f]{32,64}$/i.test(name) || /^[0-9a-f]{32,64}$/i.test(id);
}
function titleMatchesId(t, id) {
	const keys = new Set(titlePresenceKeys(t.id, t.ids || []));
	if (t.jellyfinId) {
		keys.add(String(t.jellyfinId));
		keys.add(`jf-${t.jellyfinId}`);
	}
	return titlePresenceKeys(id).some((k) => keys.has(k));
}
/** Home cards: shelf / remembered titles / the request's own name. Always a Title so chip and cards match. */
function titleForRequest(r, titles = []) {
	const hit = titles.find((t) => titleMatchesId(t, r.titleId));
	if (hit) return hit;
	return {
		id: r.titleId,
		kind: String(r.titleId).startsWith("tmdb-tv-") ? "tv" : "movie",
		title: r.title || r.titleId,
		year: 0,
		rating: 0,
		genres: [],
		overview: "",
		poster: "",
		maxQuality: "1080p",
		popularity: 0
	};
}
function titleInDropSet(t, keys) {
	const ids = titlePresenceKeys(t.id, t.ids || []);
	if (t.jellyfinId) ids.push(String(t.jellyfinId), `jf-${t.jellyfinId}`);
	return ids.some((k) => keys.has(k));
}
/** Drop a title from shelf, library ids, and request overlay. TV drops every season row. */
function dropLibraryOverlay(state, titleId, extraIds = []) {
	const keys = new Set(titlePresenceKeys(titleId, extraIds));
	for (const t of state.shelf || []) {
		if (!titleInDropSet(t, keys)) continue;
		for (const k of titlePresenceKeys(t.id, t.ids || [])) keys.add(k);
		if (t.jellyfinId) {
			keys.add(String(t.jellyfinId));
			keys.add(`jf-${t.jellyfinId}`);
		}
	}
	const gone = (id) => keys.has(id) || titlePresenceKeys(id).some((k) => keys.has(k));
	return {
		shelf: (state.shelf || []).filter((t) => !titleInDropSet(t, keys)),
		library: (state.library || []).filter((id) => !gone(String(id))),
		requests: (state.requests || []).filter((r) => !r?.titleId || !gone(r.titleId)),
		keys: [...keys]
	};
}
/** Collapse same titleId+season. A done sibling upgrades the rest. */
function collapseDuplicateRequests(rows) {
	const groups = /* @__PURE__ */ new Map();
	for (const row of rows) {
		if (!row?.titleId) continue;
		const key = requestMatchKey(row);
		const list = groups.get(key) || [];
		list.push(row);
		groups.set(key, list);
	}
	const out = [];
	for (const list of groups.values()) {
		const anyAvailable = list.some((r) => r.status === "available" || r.engine === "downloaded");
		const picked = list.reduce((best, row) => {
			const br = STATUS_RANK[best.status] || 0;
			const rr = STATUS_RANK[row.status] || 0;
			if (rr !== br) return rr > br ? row : best;
			return (row.updatedAt || 0) >= (best.updatedAt || 0) ? row : best;
		});
		out.push(anyAvailable ? markAvailable(picked) : picked);
	}
	return out;
}
function mapEnginePollStatus(status) {
	if (status === "downloaded" || status === "available") return "available";
	if (status === "grabbing" || status === "downloading") return "downloading";
	if (status === "failed") return "failed";
	if (status === "queued" || status === "waiting") return "waiting";
	return null;
}
/** Title-page GET /api/request poll: only the matching title+season row. */
function applyTitleRequestPoll(requests, opts) {
	const mapped = mapEnginePollStatus(opts.status);
	const apiProg = typeof opts.progress === "number" ? opts.progress : void 0;
	if (!mapped && apiProg == null && opts.reason == null) return requests;
	const pageKeys = new Set(titlePresenceKeys(opts.titleId, opts.extraIds || []));
	return requests.map((x) => {
		if (x.status === "failed") return x;
		if (!titlePresenceKeys(x.titleId).some((k) => pageKeys.has(k))) return x;
		if (opts.season != null) {
			if (x.season !== opts.season) return x;
		} else if (x.season != null) return x;
		if (x.status === "available" && mapped !== "available") return x;
		const status = mapped || x.status;
		const progress = status === "available" ? 100 : typeof apiProg === "number" ? Math.max(0, Math.min(100, Math.round(apiProg))) : x.progress;
		return {
			...x,
			status,
			progress,
			reason: opts.reason !== void 0 ? opts.reason : x.reason,
			updatedAt: Date.now()
		};
	});
}
/** Movies on the JF shelf are AVAILABLE even if Seerr still says grabbing. TV stays season-by-season. */
function overlayLibraryPresence(requests, opts) {
	const movieKeys = /* @__PURE__ */ new Set();
	const tvDisk = /* @__PURE__ */ new Map();
	for (const id of opts.libraryIds || []) {
		if (id.startsWith("tmdb-tv-") || id.startsWith("tvdb-") || id.startsWith("jf-")) continue;
		for (const k of titlePresenceKeys(id)) movieKeys.add(k);
	}
	for (const t of opts.titles || []) {
		if (t.kind === "tv" || t.kind === "anime") {
			const disk = (t.onDiskSeasons || []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
			if (!disk.length) continue;
			for (const k of titlePresenceKeys(t.id, t.ids || [])) {
				const set = tvDisk.get(k) || /* @__PURE__ */ new Set();
				disk.forEach((n) => set.add(n));
				tvDisk.set(k, set);
			}
			continue;
		}
		if (!t.jellyfinId) continue;
		for (const k of titlePresenceKeys(t.id, t.ids || [])) {
			if (k.startsWith("jf-")) continue;
			movieKeys.add(k);
		}
	}
	return collapseDuplicateRequests(requests.map((row) => {
		if (row.status === "available" || row.engine === "downloaded") return row.status === "available" ? row : markAvailable(row);
		if (isMovieRequest(row)) {
			if (titlePresenceKeys(row.titleId).some((k) => movieKeys.has(k))) return markAvailable(row);
			return row;
		}
		if (row.season == null) return row;
		return titlePresenceKeys(row.titleId).some((k) => tvDisk.get(k)?.has(Number(row.season))) ? markAvailable(row) : row;
	}));
}
var defaultAnswers = {
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
		music: false
	},
	quality: "hybrid",
	frontend: "jellyfin",
	plexClaim: "",
	adminName: "",
	adminPassword: "",
	access: "lan",
	tunnelToken: ""
};
var CHANNEL = "stable";
var SHIPPED_VERSION = "1.2.50.52";
function idleBootSteps() {
	return {
		local: "pending",
		house: "pending",
		library: "pending",
		requests: "pending"
	};
}
var UPDATE_NOTES = [
	"1.2.50.52: Request list hydrates per-season availability without a title click. Multi-season Seerr rows expand; S01 on disk is Watch (or dropped when every season is), S02 still Request. Same *arr/Jellyfin/onDiskSeasons truth as GET /api/request?id=&season=. Movies unchanged. Wizard 7 steps. Arena/Books stay behind Beta (default off). Do not house-Apply until 50 finishes. Gold chrome, prebuilt hashed UI. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
	"1.2.50.50: OTA includes a cleaner (orphan :8080, retired containers, ghost JF ids, OS tune, tmp leftovers) and a full-screen Updating ReelOS splash until the door accepts browse/request. Probe this computer (RAM, CPU, HDD vs SSD, USB root, kdump, zram), persist /var/lib/reelos/hardware-profile.json, and drive knobs from that profile — 1 FUSE and skip dump ffprobe on 4GB HDD. Settings shows what was detected; splash can say Tuning for 4GB HDD…. Knaben/TorrentsCSV SeasonSearch. Arena+Books sit behind Settings Beta (default off) — no second 2.0.0 Apply. Library catch-up stays a banner — Request still works. Post-OTA heal is faster (stamp-first + no dump ffprobe + one FUSE + skip-nanosecond); tarball download/extract is still network+disk. OTA cannot move Ubuntu off the HDD. Never /media, never ota.lock. Skip 49 (cloud-only #136). Do not house-Apply until told. Gold chrome, prebuilt hashed UI. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
	"1.2.50.48: Hands-off home — Discover is on this box / finishing / pick tonight (not unreleased 2026 junk). Home posters skip empty ImageTags; 404 is a blank card not a duplicate title. One Watch to LAN/Tailscale IP:8096. Requests stay visible; recover adds National Treasure to Radarr without a magnet. Gold chrome, prebuilt hashed UI. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
	"1.2.50.47: Request honesty — movie pages POST tmdb-<n> (Moon is not The Great Escape). Named titles hide hash paste; Request goes to Seerr/Radarr first. National Treasure stays on Requests until Radarr has the movie. Request Sxx hides when that season is on disk. /title/73ceff… is Rick S04. JF posters skip empty ImageTags; Home chip is live only when virtual folders are green. Gold chrome, prebuilt hashed UI. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
	"1.2.50.46: Library never paints a 40-char infohash as the title. Hash dump folders (73ceff… /title/jf-*) are named from the files on the box (Rick and Morty S04) or Unknown on this box. Watch / In library when Jellyfin has it — Seerr did not find is not the headline. Gold chrome, prebuilt hashed UI. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
	"1.2.50.45: Title page honesty — /title/tvdb-* is the same Expanse as library tmdb-tv / Jellyfin. Watch when it is on the box, not TorBox-will-transfer + Available after request. Seerr season load fails with Retry instead of infinite Loading seasons from Seerr. Complete pack dumps collapse onto the series. Gold chrome, prebuilt hashed UI. Complements #128. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
	"1.2.50.44: Splash-lock Home only while library catch-up is actually running and dumps still need import. Status done / idle / stopped and skip-only (14 skipped) do not freeze the phone on catching up. Gold chrome, prebuilt hashed UI. Complements #127. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
	"1.2.50.43: Home names the ghost tmdb-2059 card (National Treasure) with a poster. Stale phone persist is dropped so transferring matches live Seerr in-flight, not 24 Waitings. One Expanse card, not two. Header Watch stays; Watch in this browser is gone. Gold chrome, prebuilt hashed UI. Complements #127. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
	"1.2.50.42: enableMediaInfo was already false; Sonarr still spawned ffprobe on FUSE dumps. no-ffprobe stubs *arr/Jellyfin ffprobe (rename busy ELF). Extra fuse.decypharr rows were rshared /mnt self-binds of one device — peel extras without lazy-umounting the live FUSE or /media. Catch-up imports skip-existing dumps; D-state concurrency 0; splash idle unless actually importing. Complements #124. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
	"1.2.50.41: Measure CPU (nproc), RAM (MemTotal + DirectMap vs cgroup so hidden DIMMs are not treated as 4GB), and disk (SSD vs HDD). HP 15-bs0xx is a 4GB DIMM (~3.2Gi visible after iGPU/reserved; cgroup is not hiding 8/16/32GB) — a laptop, not a Pi. Conservative RAM caps stay on ≤4.5Gi (catch-up MemoryMax 768M). CPU/SSD can raise import caps; HDD stays throttled. Catch-up does not wedge FUSE: no-ffprobe on dumps, D-state concurrency 0, one fuse.decypharr. Selfheal does not restart catch-up while ffprobe is D-state. Prebuilt hashed UI. Complements #122. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
	"1.2.50.40: Check/Apply only swaps the product (tarball, restart, splash, stamp). Library catch-up is its own worker with its own phone clock — folder N, skips, timeouts — not buried in wire.log while Apply looks frozen. Indexers/import/heal never block stamp. Catch-up is a persistent oneshot (not killed when selfheal exits); backs off when ffprobe is D-state; does not stack another FUSE. Splash-locks Home only while dumps still need import. Settings Beta ON then Check fetches 2.0.0 Arena+Books as a separate tarball (not this stamp); OFF stays 1.2.50.x. 4GB prebuilt UI. Complements #120. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
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
	"1.2.50: Stacked house Apply (#45–#50). Overlay house compose/configs so #49 seed cannot nest. FUSE rslave ENOTCONN heal + importPending retry. Check then Apply."
];
function makeAdapter(answers) {
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
		daysLeft: 0
	};
}
function idleLibraryCatchup() {
	return {
		status: "idle",
		message: "",
		folder: 0,
		total: 0,
		skipped: 0,
		timeouts: 0,
		needsImport: false,
		splashLock: false
	};
}
function idleUpdate(current = SHIPPED_VERSION) {
	return {
		status: "idle",
		current,
		target: null,
		checkedAt: null,
		steps: [],
		notes: [],
		rollback: false
	};
}
function updatePlan() {
	return [
		{
			id: "channel",
			label: "Read the stable channel",
			status: "pending",
			log: ""
		},
		{
			id: "host",
			label: "Host patches",
			status: "pending",
			log: ""
		},
		{
			id: "images",
			label: "Pull stack images",
			status: "pending",
			log: ""
		},
		{
			id: "recreate",
			label: "Recreate changed services",
			status: "pending",
			log: ""
		},
		{
			id: "health",
			label: "Health check",
			status: "pending",
			log: ""
		}
	];
}
var shelfFetches = /* @__PURE__ */ new Map();
function uid(prefix) {
	return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
function normalizeRelease(raw) {
	const t = raw.trim();
	if (!t) return null;
	const magnet = /urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i.exec(t);
	if (magnet?.[1]) return magnet[1].toLowerCase();
	if (/^[a-fA-F0-9]{40}$/.test(t)) return t.toLowerCase();
	return null;
}
function logFor(id, label) {
	return {
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
		health: "Caddy, media server, and engines answered."
	}[id] ?? `${label} ready.`;
}
function buildPlan(answers) {
	const steps = [{
		id: "docker",
		label: "Docker engine"
	}, {
		id: "indexers",
		label: "Indexer manager"
	}];
	if (answers.intent.movies) steps.push({
		id: "radarr",
		label: "Movie engine"
	});
	if (answers.intent.tv) steps.push({
		id: "sonarr",
		label: "TV engine"
	});
	if (answers.intent.anime) steps.push({
		id: "anime",
		label: "Anime profile"
	});
	if (answers.intent.music) steps.push({
		id: "lidarr",
		label: "Music engine"
	});
	steps.push({
		id: "seerr",
		label: "Request UI"
	});
	if (answers.frontend !== "plex") steps.push({
		id: "jellyfin",
		label: "Jellyfin"
	});
	if (answers.frontend !== "jellyfin") steps.push({
		id: "plex",
		label: "Plex"
	});
	steps.push({
		id: "bazarr",
		label: "Subtitles"
	});
	if (answers.source === "local-vpn") steps.push({
		id: "gluetun",
		label: "VPN + download client"
	});
	else {
		const p = adapterProfile(answers.source, answers.frontend);
		steps.push({
			id: "debrid",
			label: p.name
		});
	}
	steps.push({
		id: "caddy",
		label: "Ingress"
	});
	steps.push({
		id: "transcode",
		label: "Hardware transcode probe"
	});
	steps.push({
		id: "link",
		label: "Link engines and libraries"
	});
	if (answers.access === "tailscale") steps.push({
		id: "tailscale",
		label: "Tailscale"
	});
	if (answers.access === "cloudflare") steps.push({
		id: "cf",
		label: "Cloudflare Tunnel"
	});
	return steps.map((s) => ({
		...s,
		status: "pending",
		log: ""
	}));
}
function event(kind, message, titleId) {
	return {
		id: uid("ev"),
		at: Date.now(),
		kind,
		message,
		titleId
	};
}
var demoAnswers = {
	...defaultAnswers,
	source: "torbox",
	apiKey: "lab-preview-not-live",
	adminName: "Ada",
	adminPassword: "household",
	intent: {
		movies: true,
		tv: true,
		anime: true,
		uhd: true,
		kids: true,
		music: true
	},
	quality: "hybrid",
	frontend: "jellyfin"
};
function labState() {
	const now = Date.now();
	const req = (titleId, status, extra = {}) => ({
		id: uid("req"),
		titleId,
		status,
		progress: status === "available" ? 100 : status === "downloading" ? 62 : 0,
		createdAt: now - 864e5,
		updatedAt: now,
		requester: "Ada",
		...extra
	});
	return {
		phase: "running",
		wizardStep: 7,
		answers: demoAnswers,
		build: buildPlan(demoAnswers).map((s) => ({
			...s,
			status: "done",
			log: logFor(s.id, s.label)
		})),
		provisioned: true,
		requests: [
			req("night-harbor", "available", {
				via: "cache",
				release: "Night.Harbor.2024.2160p.WEB-DL.DDP5.1",
				createdAt: now - 1728e5
			}),
			req("ember-season", "available", {
				via: "cache",
				release: "Ember.Season.2025.2160p.WEB-DL.DDP5.1",
				createdAt: now - 864e5
			}),
			req("glass-orchard", "available", {
				via: "cache",
				release: "Glass.Orchard.2024.2160p.WEB-DL.DDP5.1",
				createdAt: now - 5e7
			}),
			req("station-line", "downloading", {
				via: "uncached",
				progress: 62,
				season: 2,
				release: "Station.Line.S02E01.2160p.WEB-DL.DDP5.1",
				createdAt: now - 36e5
			}),
			req("drift-protocol", "waiting", { createdAt: now - 18e5 }),
			req("hollow-broadcast", "failed", {
				reason: "Real-Debrid has no matching hash",
				createdAt: now - 72e5
			})
		],
		library: [
			"night-harbor",
			"ember-season",
			"glass-orchard",
			"iron-parish",
			"paper-moons",
			"maple-pilot"
		],
		shelf: [],
		shelfError: null,
		shelfReady: true,
		watchProgress: {
			"night-harbor": .42,
			"ember-season": .18,
			"iron-parish": .71
		},
		activity: [
			event("import", "Cache hit — Night Harbor on Real-Debrid", "night-harbor"),
			event("import", "Cache hit — Ember Season on Real-Debrid", "ember-season"),
			event("grab", "Uncached. Decypharr sent Station Line S02 to Real-Debrid.", "station-line"),
			event("request", "Ada requested Drift Protocol", "drift-protocol"),
			event("fail", "Hollow Broadcast — Real-Debrid has no matching hash", "hollow-broadcast"),
			event("scan", "Library scan finished. 6 items."),
			event("index", "Indexer manager empty. Add your own under Advanced."),
			event("system", "Decypharr healthy. Engines registered it as the download client.")
		],
		users: [
			{
				id: "u-ada",
				name: "Ada",
				role: "admin"
			},
			{
				id: "u-jon",
				name: "Jon",
				role: "member"
			},
			{
				id: "u-nes",
				name: "Nessa",
				role: "member"
			}
		],
		settings: {
			hideAdvanced: false,
			autoApprove: true,
			notifyAvailable: true,
			notifyFailed: true,
			autoUpdate: true,
			stackImages: false,
			connectDone: true,
			betaChannel: false
		},
		update: idleUpdate(),
		adapter: {
			...makeAdapter(demoAnswers),
			cacheHits: 3,
			transfers: 1,
			pingMs: 41,
			lastPing: now
		},
		indexers: [],
		remoteTitles: []
	};
}
var initial = {
	hydrated: false,
	phase: "splash",
	wizardStep: 1,
	answers: defaultAnswers,
	build: [],
	buildLogOpen: false,
	provisioned: false,
	requests: [],
	library: [],
	shelf: [],
	shelfError: null,
	shelfReady: false,
	jellyfinHop: {
		state: "amber",
		detail: "Still starting"
	},
	ipv4: "",
	watch: "",
	tailscaleIp: "",
	watchProgress: {},
	activity: [],
	users: [],
	settings: {
		hideAdvanced: false,
		autoApprove: true,
		notifyAvailable: true,
		notifyFailed: true,
		autoUpdate: true,
		stackImages: false,
		connectDone: false,
		betaChannel: false
	},
	update: idleUpdate(),
	libraryCatchup: idleLibraryCatchup(),
	adapter: makeAdapter(defaultAnswers),
	indexers: [],
	remoteTitles: [],
	bootSteps: idleBootSteps(),
	requestsSeeded: false
};
var useReelStore = create()(persist((set, get) => ({
	...initial,
	setHydrated: () => set({ hydrated: true }),
	setBootStep: (id, status) => set({ bootSteps: {
		...get().bootSteps,
		[id]: status
	} }),
	applyReadyPayload: (ready) => {
		const provisioned = Boolean(ready?.provisioned);
		const incoming = ready?.answers && typeof ready.answers === "object" ? ready.answers : null;
		const titles = Array.isArray(ready?.titles) ? ready.titles : [];
		const live = Array.isArray(ready?.requests) ? ready.requests : [];
		if (titles.length) rememberCatalogTitles(titles);
		set((s) => {
			const { adminPassword: _omitPassword, ...safeIncoming } = incoming || {};
			const answers = incoming ? {
				...s.answers,
				...safeIncoming,
				adminPassword: s.answers.adminPassword
			} : s.answers;
			const shelf = titles.length ? mergeShelf(s.shelf, titles, true) : s.shelf;
			const requests = overlayLibraryPresence(mergeServerRequests(s.requests, live), { titles: [...shelf, ...s.remoteTitles] });
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
					local: "ok",
					house: provisioned ? "ok" : "fail",
					library: libraryOk ? "ok" : "fail",
					requests: requestsOk ? "ok" : "fail"
				},
				jellyfinHop: ready?.jellyfin?.state ? {
					state: String(ready.jellyfin.state),
					detail: ready.jellyfin.detail
				} : s.jellyfinHop,
				ipv4: ready?.ipv4 != null ? String(ready.ipv4) : s.ipv4,
				watch: ready?.watch != null ? String(ready.watch) : s.watch,
				tailscaleIp: ready?.tailscaleIp != null ? String(ready.tailscaleIp) : s.tailscaleIp,
				settings: typeof ready?.betaChannel === "boolean" ? {
					...s.settings,
					betaChannel: ready.betaChannel
				} : s.settings
			};
		});
		const s = get();
		if (provisioned) {
			if (!s.provisioned || s.phase === "wizard" || s.phase === "splash") s.openReelOS();
		} else if (s.provisioned || s.phase !== "wizard") s.factoryReset();
		const st = ready?.update;
		const lib = ready?.libraryCatchup || ready?.update?.library;
		if (lib && typeof lib === "object") set({ libraryCatchup: normalizeLibraryCatchup(lib) });
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
				set({ update: {
					...cur.update,
					status: "applying",
					current: st.local || cur.update.current,
					target: st.target || cur.update.target,
					steps,
					notes: []
				} });
			}
		}
	},
	setPhase: (phase) => set({ phase }),
	setWizardStep: (wizardStep) => set({ wizardStep }),
	patchAnswers: (p) => set({ answers: {
		...get().answers,
		...p
	} }),
	patchIntent: (p) => set({ answers: {
		...get().answers,
		intent: {
			...get().answers.intent,
			...p
		}
	} }),
	startBuild: () => {
		const answers = get().answers;
		const build = buildPlan(answers);
		if (build[0]) build[0].status = "running";
		set({
			phase: "building",
			build,
			buildLogOpen: false,
			users: [{
				id: "u-admin",
				name: answers.adminName.trim() || "Admin",
				role: "admin"
			}],
			adapter: makeAdapter(answers)
		});
	},
	tick: () => {},
	openReelOS: () => set({
		phase: "running",
		provisioned: true,
		adapter: get().adapter.status === "offline" ? makeAdapter(get().answers) : get().adapter
	}),
	requestTitle: (titleId, season) => {
		const s = get();
		if (s.requests.find((r) => r.titleId === titleId && (season == null || r.season === season) && r.status !== "failed")) return;
		const title = getTitle(titleId) ?? get().remoteTitles.find((t) => t.id === titleId);
		if (!title) return;
		const fail = s.answers.quality === "4k" && title.maxQuality !== "4k";
		const requester = s.users.find((u) => u.role === "admin")?.name ?? "Ada";
		const local = s.answers.source === "local-vpn";
		const cached = !local && titleInCache(title);
		const via = fail ? void 0 : local ? "local" : cached ? "cache" : "uncached";
		const rec = {
			id: uid("req"),
			titleId,
			status: fail ? "failed" : "waiting",
			progress: 0,
			reason: fail ? "No release matches your quality floor" : void 0,
			season,
			createdAt: Date.now(),
			updatedAt: Date.now(),
			requester,
			via,
			release: fail ? void 0 : syntheticRelease(title, s.answers.quality)
		};
		const activity = fail ? [event("fail", `${title.title} — no release matches your quality floor`, titleId), ...s.activity] : cached ? [
			event("grab", `Cache hit — ${title.title} on ${sourceLabel[s.answers.source]}`, titleId),
			event("request", `${requester} requested ${title.title}`, titleId),
			...s.activity
		] : [event("request", `${requester} requested ${title.title}`, titleId), ...s.activity];
		set({
			requests: [rec, ...s.requests],
			activity: activity.slice(0, 40)
		});
	},
	cancelRequest: (id) => set({ requests: get().requests.filter((r) => r.id !== id) }),
	retryRequest: (id) => {
		const s = get();
		const row = s.requests.find((r) => r.id === id);
		set({ requests: s.requests.map((r) => r.id === id ? {
			...r,
			status: "waiting",
			progress: 0,
			reason: void 0,
			updatedAt: Date.now()
		} : r) });
		const titleId = String(row?.titleId || "");
		if (!titleId.startsWith("tmdb-")) return;
		const tv = titleId.startsWith("tmdb-tv-");
		const tmdb = Number(tv ? titleId.slice(8) : titleId.slice(5));
		if (!Number.isFinite(tmdb) || tmdb <= 0) return;
		fetch("/api/request", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				titleId,
				mediaType: tv ? "tv" : "movie",
				tmdb,
				season: row?.season
			})
		}).catch(() => {});
	},
	setWatchProgress: (titleId, v) => set({ watchProgress: {
		...get().watchProgress,
		[titleId]: v
	} }),
	patchSettings: (p) => set({ settings: {
		...get().settings,
		...p
	} }),
	addUser: (name) => {
		const n = name.trim();
		if (!n) return;
		set({ users: [...get().users, {
			id: uid("u"),
			name: n,
			role: "member"
		}] });
	},
	removeUser: (id) => set({ users: get().users.filter((u) => u.id !== id) }),
	loadLab: () => set({ ...labState() }),
	startRepair: () => set({
		phase: "wizard",
		wizardStep: 1
	}),
	factoryReset: () => set({
		...initial,
		hydrated: true,
		shelfReady: true
	}),
	syncUpdateFromBox: () => {
		fetch("/api/update/status", { cache: "no-store" }).then((r) => r.json()).then((st) => {
			const cur = get();
			const last = (st.log || "").trim().split("\n").pop() || "";
			if (st.library && typeof st.library === "object") set({ libraryCatchup: normalizeLibraryCatchup(st.library) });
			if (st.running) {
				const steps = (cur.update.steps?.length ? cur.update.steps : updatePlan()).map((x) => ({ ...x }));
				if (steps[0]) {
					steps[0].status = "running";
					steps[0].label = "Configuring this house";
					steps[0].log = last.slice(0, 160);
				}
				set({ update: {
					...cur.update,
					status: "applying",
					current: st.local || cur.update.current,
					target: st.target || cur.update.target,
					steps,
					notes: []
				} });
				return;
			}
			if (cur.update.status === "applying") {
				set({ update: {
					...cur.update,
					status: "current",
					current: st.local || cur.update.current,
					target: null,
					steps: (cur.update.steps || []).map((x) => ({
						...x,
						status: "done"
					})),
					notes: []
				} });
				return;
			}
			if (st.local && st.local !== cur.update.current && cur.update.status !== "checking") set({ update: {
				...cur.update,
				current: st.local
			} });
		}).catch(() => {});
	},
	checkForUpdate: () => {
		const s = get();
		if (s.update.status === "checking" || s.update.status === "applying") return;
		set({ update: {
			...s.update,
			status: "checking",
			checkedAt: Date.now()
		} });
		fetch("/api/update/check", { cache: "no-store" }).then((r) => r.json()).then((r) => {
			const cur = get();
			const pending = Array.isArray(r.pendingNotes) ? r.pendingNotes : Array.isArray(r.notes) ? r.notes : [];
			if (r.ok && r.available) set({ update: {
				...cur.update,
				status: "available",
				current: r.local || cur.update.current,
				target: r.remote || null,
				notes: pending,
				rollback: r.rollback === true,
				checkedAt: Date.now()
			} });
			else set({ update: {
				...cur.update,
				status: r.ok ? "current" : "error",
				current: r.local || cur.update.current,
				target: null,
				notes: r.ok ? [] : [r.error ?? "Channel unreachable"],
				rollback: false,
				checkedAt: Date.now()
			} });
		}).catch((e) => {
			set({ update: {
				...get().update,
				status: "error",
				notes: [String(e)],
				checkedAt: Date.now()
			} });
		});
	},
	startUpdate: () => {
		const s = get();
		if (s.update.status !== "available") return;
		const steps = updatePlan();
		if (steps[0]) steps[0].status = "running";
		const target = s.update.target;
		set({ update: {
			...s.update,
			status: "applying",
			steps
		} });
		fetch("/api/update/apply", { method: "POST" }).then((r) => r.json()).then((j) => {
			if (!j.ok) {
				set({ update: {
					...get().update,
					status: "error",
					notes: [j.error || "apply did not start"]
				} });
				return;
			}
			let misses = 0;
			const tick = () => {
				fetch("/api/update/status", { cache: "no-store" }).then((r) => r.json()).then((st) => {
					const cur = get();
					const steps2 = (cur.update.steps || []).map((x) => ({ ...x }));
					const last = (st.log || "").trim().split("\n").pop() || "";
					if (st.library && typeof st.library === "object") set({ libraryCatchup: normalizeLibraryCatchup(st.library) });
					if (steps2[0]) {
						steps2[0].status = "running";
						steps2[0].log = last.slice(0, 160);
					}
					if (st.local && target && st.local === target && !st.running) {
						set({ update: {
							...cur.update,
							status: "current",
							current: st.local,
							target: null,
							steps: steps2.map((x) => ({
								...x,
								status: "done"
							})),
							notes: []
						} });
						return;
					}
					if (st.running) misses = 0;
					else misses += 1;
					if (st.running || misses < 24) {
						set({ update: {
							...cur.update,
							status: "applying",
							steps: steps2,
							notes: []
						} });
						window.setTimeout(tick, 2500);
						return;
					}
					set({ update: {
						...cur.update,
						status: "error",
						current: st.local || cur.update.current,
						notes: [last.slice(0, 160) || "Apply ended. Version did not change."],
						steps: steps2
					} });
				}).catch(() => window.setTimeout(tick, 4e3));
			};
			window.setTimeout(tick, 2e3);
		}).catch((e) => {
			set({ update: {
				...get().update,
				status: "error",
				notes: [String(e)]
			} });
		});
	},
	pingAdapter: () => {
		fetch("/api/ping", { cache: "no-store" }).then((r) => r.json()).then((j) => {
			const s = get();
			set({
				adapter: {
					...s.adapter,
					pingMs: j.pingMs || 0,
					lastPing: Date.now(),
					status: j.ok ? "healthy" : "offline"
				},
				activity: [event("system", j.ok ? `Decypharr ${j.pingMs}ms` : "Decypharr offline"), ...s.activity].slice(0, 40)
			});
		}).catch(() => {
			const s = get();
			set({
				adapter: {
					...s.adapter,
					status: "offline",
					lastPing: Date.now()
				},
				activity: [event("system", "Decypharr unreachable"), ...s.activity].slice(0, 40)
			});
		});
	},
	addIndexer: (name, url, key) => {
		const n = name.trim();
		const u = url.trim();
		if (!n || !u) return;
		set({
			indexers: [...get().indexers, {
				id: uid("idx"),
				name: n,
				url: u,
				key: key.trim()
			}],
			activity: [event("index", `Indexer added: ${n}`), ...get().activity].slice(0, 40)
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
		set({
			requests: [{
				id: uid("req"),
				titleId,
				status: "waiting",
				progress: 0,
				createdAt: Date.now(),
				updatedAt: Date.now(),
				requester,
				via: s.answers.source === "local-vpn" ? "local" : "uncached",
				release: hash
			}, ...s.requests.filter((r) => !(r.titleId === titleId && r.status !== "available"))],
			activity: [event("request", `${requester} handed a hash for ${title.title} to the adapter`, titleId), ...s.activity].slice(0, 40)
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
		const overlay = dropLibraryOverlay({
			shelf: s.shelf,
			library: s.library,
			requests: s.requests
		}, titleId, extraIds);
		set({
			shelf: overlay.shelf,
			library: overlay.library,
			requests: overlay.requests
		});
	},
	hydrateShelf: (opts) => {
		if (get().shelfReady) return;
		const limit = opts?.limit;
		const key = limit ? `n${limit}` : "all";
		if (shelfFetches.has(key)) return;
		const qs = limit ? `?limit=${encodeURIComponent(String(limit))}` : "";
		const p = fetch(`/api/library${qs}`, { cache: "no-store" }).then((r) => r.json()).then((j) => {
			const titles = Array.isArray(j.titles) ? j.titles : [];
			rememberCatalogTitles(titles);
			const cur = get();
			const shelf = mergeShelf(cur.shelf, titles, Boolean(limit));
			const library = [...new Set(shelf.map((t) => t.id))];
			const requests = overlayLibraryPresence(cur.requests, { titles: [...shelf, ...cur.remoteTitles] });
			set({
				shelf,
				shelfError: j.error || null,
				shelfReady: true,
				library,
				requests
			});
		}).catch((e) => set({
			shelfError: String(e),
			shelfReady: true
		})).finally(() => {
			shelfFetches.delete(key);
		});
		shelfFetches.set(key, p);
	}
}), {
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
		ipv4: s.ipv4,
		watch: s.watch,
		tailscaleIp: s.tailscaleIp,
		watchProgress: s.watchProgress,
		activity: s.activity,
		users: s.users,
		settings: s.settings,
		adapter: s.adapter,
		indexers: s.indexers,
		remoteTitles: s.remoteTitles
	}),
	onRehydrateStorage: () => (state) => {
		if (!state) return;
		state.update = idleUpdate();
		state.libraryCatchup = idleLibraryCatchup();
		if (state.shelf?.length) state.shelfReady = true;
	}
}));
var qualityLabel = {
	"1080p": "1080p",
	hybrid: "1080p / 4K when available",
	"4k": "4K only",
	custom: "Custom"
};
var storageLabel = {
	debrid: "Debrid only",
	local: "Local disks",
	both: "Both"
};
var frontendLabel = {
	jellyfin: "Jellyfin",
	plex: "Plex",
	both: "Jellyfin + Plex"
};
var accessLabel = {
	lan: "This network only",
	tailscale: "Tailscale",
	cloudflare: "Cloudflare Tunnel"
};
var sourceLabel = {
	torbox: "TorBox",
	"real-debrid": "Real-Debrid",
	alldebrid: "AllDebrid",
	premiumize: "Premiumize",
	"local-vpn": "Local + VPN"
};
var styles_default = "/assets/styles-B27PjOTg.css";
var APP_NAME = "ReelOS";
var Route$12 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: APP_NAME },
			{
				name: "description",
				content: "Install. Point. Stream. A personal media appliance."
			},
			{
				name: "theme-color",
				content: "#0B0D10"
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap"
			}
		]
	}),
	component: RootDocument
});
function RootDocument() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		className: "antialiased",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", {
			className: "film-grain bg-background text-foreground",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Runtime, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
			]
		})]
	});
}
function Runtime({ children }) {
	const arena = useReelStore((s) => s.settings.betaChannel);
	(0, import_react.useEffect)(() => {
		document.documentElement.classList.toggle("arena-on", arena);
		document.body.classList.toggle("arena-on", arena);
	}, [arena]);
	(0, import_react.useEffect)(() => {
		Promise.resolve(useReelStore.persist.rehydrate()).catch(() => {}).then(async () => {
			const s = useReelStore.getState();
			s.setBootStep("local", "ok");
			s.setBootStep("house", "running");
			s.setBootStep("library", "running");
			s.setBootStep("requests", "running");
			s.syncUpdateFromBox();
			try {
				const ui = await fetch("/api/settings", {
					cache: "no-store",
					signal: AbortSignal.timeout(2500)
				}).then((r) => r.json());
				if (typeof ui?.betaChannel === "boolean") useReelStore.getState().patchSettings({ betaChannel: ui.betaChannel });
			} catch {}
			return fetch("/api/ready?limit=24", {
				cache: "no-store",
				signal: AbortSignal.timeout(4e3)
			}).then(async (r) => {
				const ready = await r.json();
				useReelStore.getState().applyReadyPayload(ready);
			}).catch(() => {
				const cur = useReelStore.getState();
				cur.setBootStep("house", cur.provisioned ? "ok" : "fail");
				cur.setBootStep("library", cur.shelfReady ? "ok" : "fail");
				cur.setBootStep("requests", cur.requestsSeeded ? "ok" : "fail");
				if (cur.provisioned) cur.openReelOS();
			}).finally(() => {
				useReelStore.getState().setHydrated();
			});
		});
	}, []);
	(0, import_react.useEffect)(() => {
		const id = window.setInterval(() => {
			useReelStore.getState().tick();
		}, 480);
		return () => window.clearInterval(id);
	}, []);
	(0, import_react.useEffect)(() => {
		const id = window.setInterval(() => {
			useReelStore.getState().syncUpdateFromBox();
		}, 2500);
		return () => window.clearInterval(id);
	}, []);
	return children;
}
var $$splitComponentImporter$11 = () => import("./routes-3FifxHfZ.mjs");
var Route$11 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$11, "component") });
var $$splitComponentImporter$10 = () => import("./activity-CRZ0EHR_.mjs");
var Route$10 = createFileRoute("/activity")({ component: lazyRouteComponent($$splitComponentImporter$10, "component") });
var $$splitComponentImporter$9 = () => import("./books-Cq2kocjp.mjs");
var Route$9 = createFileRoute("/books")({ component: lazyRouteComponent($$splitComponentImporter$9, "component") });
var $$splitComponentImporter$8 = () => import("./connect--WEzprf0.mjs");
var Route$8 = createFileRoute("/connect")({ component: lazyRouteComponent($$splitComponentImporter$8, "component") });
var $$splitComponentImporter$7 = () => import("./discover-Z3ABAFTz.mjs");
var Route$7 = createFileRoute("/discover")({ component: lazyRouteComponent($$splitComponentImporter$7, "component") });
var $$splitComponentImporter$6 = () => import("./library-B_KAPRL7.mjs");
var Route$6 = createFileRoute("/library")({ component: lazyRouteComponent($$splitComponentImporter$6, "component") });
var $$splitComponentImporter$5 = () => import("./requests-CNsU-jq7.mjs");
var Route$5 = createFileRoute("/requests")({ component: lazyRouteComponent($$splitComponentImporter$5, "component") });
var $$splitComponentImporter$4 = () => import("./settings-KEJSCkRG.mjs");
var Route$4 = createFileRoute("/settings")({ component: lazyRouteComponent($$splitComponentImporter$4, "component") });
var $$splitComponentImporter$3 = () => import("./engine._id-DEex_NhC.mjs");
var Route$3 = createFileRoute("/engine/$id")({ component: lazyRouteComponent($$splitComponentImporter$3, "component") });
var $$splitComponentImporter$2 = () => import("./play._id-DkWB_GXq.mjs");
var Route$2 = createFileRoute("/play/$id")({ component: lazyRouteComponent($$splitComponentImporter$2, "component") });
var $$splitComponentImporter$1 = () => import("./settings.advanced-BLxAs0S_.mjs");
var Route$1 = createFileRoute("/settings/advanced")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var $$splitComponentImporter = () => import("./title._id-B4cb-XwS.mjs");
var Route = createFileRoute("/title/$id")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
var IndexRoute = Route$11.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$12
});
var ActivityRoute = Route$10.update({
	id: "/activity",
	path: "/activity",
	getParentRoute: () => Route$12
});
var BooksRoute = Route$9.update({
	id: "/books",
	path: "/books",
	getParentRoute: () => Route$12
});
var ConnectRoute = Route$8.update({
	id: "/connect",
	path: "/connect",
	getParentRoute: () => Route$12
});
var DiscoverRoute = Route$7.update({
	id: "/discover",
	path: "/discover",
	getParentRoute: () => Route$12
});
var LibraryRoute = Route$6.update({
	id: "/library",
	path: "/library",
	getParentRoute: () => Route$12
});
var RequestsRoute = Route$5.update({
	id: "/requests",
	path: "/requests",
	getParentRoute: () => Route$12
});
var SettingsRoute = Route$4.update({
	id: "/settings",
	path: "/settings",
	getParentRoute: () => Route$12
});
var EngineIdRoute = Route$3.update({
	id: "/engine/$id",
	path: "/engine/$id",
	getParentRoute: () => Route$12
});
var PlayIdRoute = Route$2.update({
	id: "/play/$id",
	path: "/play/$id",
	getParentRoute: () => Route$12
});
var SettingsAdvancedRoute = Route$1.update({
	id: "/advanced",
	path: "/advanced",
	getParentRoute: () => SettingsRoute
});
var TitleIdRoute = Route.update({
	id: "/title/$id",
	path: "/title/$id",
	getParentRoute: () => Route$12
});
var SettingsRouteChildren = { SettingsAdvancedRoute };
var rootRouteChildren = {
	IndexRoute,
	ActivityRoute,
	BooksRoute,
	ConnectRoute,
	DiscoverRoute,
	LibraryRoute,
	RequestsRoute,
	SettingsRoute: SettingsRoute._addFileChildren(SettingsRouteChildren),
	EngineIdRoute,
	PlayIdRoute,
	TitleIdRoute
};
var routeTree = Route$12._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { tvSeasonChips as A, requestTitleIdForPage as C, titleMatchesId as D, titleForRequest as E, updateLocksUi as M, titlePresenceKeys as O, requestShowsRetry as S, showRequestQueueControls as T, isGhostRequestLabel as _, CHANNEL as a, overlayLibraryPresence as b, accessLabel as c, sourceLabel as d, storageLabel as f, inFlightRequests as g, collapseHomeRequestCards as h, Route$3 as i, catchupLocksHome as j, transferringChipCount as k, frontendLabel as l, applyTitleRequestPoll as m, Route as n, SHIPPED_VERSION as o, useReelStore as p, Route$2 as r, UPDATE_NOTES as s, router_exports as t, qualityLabel as u, isTvRequestRow as v, showHashAdapter as w, requestMediaTypeForPage as x, mergeServerRequests as y };
