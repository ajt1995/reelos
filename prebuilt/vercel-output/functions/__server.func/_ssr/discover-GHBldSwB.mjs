import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as rememberCatalogTitles, l as syntheticRelease, o as getTitle, u as titleInCache } from "./appliance-BpvQVhxl.mjs";
import { c as Search } from "../_libs/lucide-react.mjs";
import { p as useReelStore } from "./router-BQRDW39d.mjs";
import { c as TitleCard, i as Gate, s as Row } from "./gate-C62mb7cr.mjs";
//#region ../../workspace/node_modules/.nitro/vite/services/ssr/assets/discover-GHBldSwB.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function uid(prefix) {
	return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
/** Replace optimistic fake % inventing — GET /api/request owns status after this. */
function installHonestRequest() {
	useReelStore.setState({ requestTitle: (titleId, season) => {
		const s = useReelStore.getState();
		if (s.requests.find((r) => r.titleId === titleId && (season == null || r.season === season) && r.status !== "failed")) return;
		const title = getTitle(titleId) ?? s.remoteTitles.find((t) => t.id === titleId);
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
		const activity = fail ? [{
			id: uid("ev"),
			at: Date.now(),
			kind: "fail",
			message: `${title.title} — no release matches your quality floor`,
			titleId
		}, ...s.activity] : [{
			id: uid("ev"),
			at: Date.now(),
			kind: "request",
			message: `${requester} requested ${title.title}`,
			titleId
		}, ...s.activity];
		useReelStore.setState({
			requests: [rec, ...s.requests],
			activity: activity.slice(0, 40)
		});
	} });
}
function DiscoverView() {
	const [q, setQ] = (0, import_react.useState)("");
	const [remoteHits, setRemoteHits] = (0, import_react.useState)([]);
	const [looking, setLooking] = (0, import_react.useState)(false);
	const [lookupErr, setLookupErr] = (0, import_react.useState)(null);
	const [browseMovies, setBrowseMovies] = (0, import_react.useState)([]);
	const [browseTv, setBrowseTv] = (0, import_react.useState)([]);
	const [browseErr, setBrowseErr] = (0, import_react.useState)(null);
	const [browseReady, setBrowseReady] = (0, import_react.useState)(false);
	const rememberTitles = useReelStore((s) => s.rememberTitles);
	(0, import_react.useEffect)(() => {
		installHonestRequest();
	}, []);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		fetch("/api/discover", { cache: "no-store" }).then(async (res) => {
			if (!res.ok) throw new Error(`discover ${res.status}`);
			return res.json();
		}).then((r) => {
			if (cancelled) return;
			const movies = Array.isArray(r?.movies) ? r.movies : [];
			const tv = Array.isArray(r?.tv) ? r.tv : [];
			rememberCatalogTitles([...movies, ...tv]);
			rememberTitles?.([...movies, ...tv]);
			setBrowseMovies(movies);
			setBrowseTv(tv);
			setBrowseErr(movies.length || tv.length ? null : r?.error || null);
			setBrowseReady(true);
		}).catch((e) => {
			if (!cancelled) {
				setBrowseMovies([]);
				setBrowseTv([]);
				setBrowseErr(String(e));
				setBrowseReady(true);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [rememberTitles]);
	const hits = (0, import_react.useMemo)(() => {
		const seen = /* @__PURE__ */ new Set();
		const out = [];
		for (const t of remoteHits) {
			if (seen.has(t.id)) continue;
			seen.add(t.id);
			out.push(t);
		}
		return out;
	}, [remoteHits]);
	(0, import_react.useEffect)(() => {
		const term = q.trim();
		if (term.length < 2) {
			setRemoteHits([]);
			setLookupErr(null);
			setLooking(false);
			return;
		}
		setLooking(true);
		setLookupErr(null);
		let cancelled = false;
		const ac = new AbortController();
		const t = window.setTimeout(() => {
			fetch(`/api/lookup?q=${encodeURIComponent(term)}`, {
				cache: "no-store",
				signal: ac.signal
			}).then(async (res) => {
				if (!res.ok) throw new Error(`lookup ${res.status}`);
				return res.json();
			}).then((r) => {
				if (cancelled) return;
				const titles = Array.isArray(r?.titles) ? r.titles : [];
				rememberCatalogTitles(titles);
				rememberTitles?.(titles);
				setRemoteHits(titles);
				setLookupErr(titles.length ? null : r?.error || "Seerr returned no titles");
				setLooking(false);
			}).catch((e) => {
				if (cancelled || e?.name === "AbortError") return;
				setRemoteHits([]);
				setLookupErr(String(e?.name === "AbortError" ? "Seerr lookup timed out. Try the search again." : e));
				setLooking(false);
			});
		}, 280);
		return () => {
			cancelled = true;
			ac.abort();
			window.clearTimeout(t);
		};
	}, [q, rememberTitles]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "px-5 py-6 md:px-10 md:py-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-semibold tracking-tight",
				children: "Discover"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted",
				children: "Titles this box does not have. Search to find something else."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative mt-6 max-w-xl",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-faint" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Find a title",
					className: "h-12 w-full rounded-2xl bg-card pl-11 pr-4 text-sm shadow-[var(--shadow-border)] placeholder:text-faint"
				})]
			}),
			q.trim().length >= 2 ? hits.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
				label: "Results",
				children: hits.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TitleCard, { title: t }, t.id))
			}) : looking ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-10 text-sm text-muted",
				children: "Looking up movies and shows…"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-10 text-sm text-muted",
				children: lookupErr || "No titles from Seerr for that search."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				browseMovies.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
					label: "Movies",
					children: browseMovies.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TitleCard, { title: t }, t.id))
				}) : null,
				browseTv.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
					label: "Shows",
					children: browseTv.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TitleCard, { title: t }, t.id))
				}) : null,
				browseMovies.length === 0 && browseTv.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-10 text-sm text-muted",
					children: browseErr || (browseReady ? "Seerr has nothing new to show yet." : "Looking up movies and shows…")
				}) : null
			] })
		]
	});
}
function Page() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gate, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscoverView, {}) });
}
//#endregion
export { Page as component };
