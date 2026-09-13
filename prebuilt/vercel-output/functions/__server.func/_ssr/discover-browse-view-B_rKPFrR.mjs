import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, b as useNavigate, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as rememberCatalogTitles } from "./appliance-Dk74LcNF.mjs";
import { j as ChevronLeft } from "../_libs/lucide-react.mjs";
import { _ as useReelStore } from "./router-DX-qMurZ.mjs";
import { i as cn, r as TitleCard } from "./title-card-KpuUDXg2.mjs";
import { n as filterDiscoverCatalog, t as filterCuratorHidden } from "./discover-owned-BdToXqdA.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/discover-browse-view-B_rKPFrR.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var CATEGORIES = [
	{
		id: "popular",
		label: "Popular"
	},
	{
		id: "upcoming",
		label: "Upcoming"
	},
	{
		id: "trending",
		label: "Trending"
	}
];
function DiscoverBrowseView({ kind, category, genre }) {
	const heading = kind === "tv" ? "Shows" : "Movies";
	const path = kind === "tv" ? "/discover/shows" : "/discover/movies";
	const navigate = useNavigate();
	const shelf = useReelStore((s) => s.shelf);
	const rememberTitles = useReelStore((s) => s.rememberTitles);
	const hydrateShelf = useReelStore((s) => s.hydrateShelf);
	const [hiddenIds, setHiddenIds] = (0, import_react.useState)([]);
	const [genres, setGenres] = (0, import_react.useState)([]);
	const [titles, setTitles] = (0, import_react.useState)([]);
	const [page, setPage] = (0, import_react.useState)(1);
	const [totalPages, setTotalPages] = (0, import_react.useState)(1);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [err, setErr] = (0, import_react.useState)(null);
	const seen = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	const sentinel = (0, import_react.useRef)(null);
	const cat = CATEGORIES.some((c) => c.id === category) ? category : "popular";
	const genreId = String(genre || "").replace(/\D/g, "");
	(0, import_react.useEffect)(() => {
		hydrateShelf({
			limit: 24,
			force: true
		});
	}, [hydrateShelf]);
	(0, import_react.useEffect)(() => {
		fetch("/api/curator", { cache: "no-store" }).then((r) => r.json()).then((j) => setHiddenIds(Array.isArray(j.hidden) ? j.hidden : [])).catch(() => {});
	}, []);
	(0, import_react.useEffect)(() => {
		seen.current = /* @__PURE__ */ new Set();
		setTitles([]);
		setPage(1);
		setTotalPages(1);
		setErr(null);
	}, [
		kind,
		cat,
		genreId
	]);
	const loadPage = (0, import_react.useCallback)((nextPage) => {
		setLoading(true);
		const q = new URLSearchParams({
			kind,
			page: String(nextPage),
			category: cat
		});
		if (genreId) q.set("genre", genreId);
		fetch(`/api/discover?${q}`, { cache: "no-store" }).then(async (res) => {
			if (!res.ok) throw new Error(`discover ${res.status}`);
			return res.json();
		}).then((j) => {
			const rows = Array.isArray(j.titles) ? j.titles : [];
			rememberCatalogTitles(rows);
			rememberTitles?.(rows);
			if (Array.isArray(j.genres) && j.genres.length) setGenres(j.genres);
			const extra = [];
			for (const t of rows) {
				if (!t?.id || seen.current.has(t.id)) continue;
				seen.current.add(t.id);
				extra.push(t);
			}
			setTitles((cur) => nextPage <= 1 ? extra : [...cur, ...extra]);
			setPage(Number(j.page || nextPage) || nextPage);
			setTotalPages(Math.max(1, Number(j.totalPages || 1) || 1));
			setErr(rows.length ? null : j.error || null);
			setLoading(false);
		}).catch((e) => {
			setErr(String(e));
			setLoading(false);
		});
	}, [
		kind,
		cat,
		genreId,
		rememberTitles
	]);
	(0, import_react.useEffect)(() => {
		loadPage(1);
	}, [loadPage]);
	(0, import_react.useEffect)(() => {
		const el = sentinel.current;
		if (!el) return;
		const io = new IntersectionObserver((entries) => {
			if (!entries.some((e) => e.isIntersecting)) return;
			if (loading) return;
			if (page >= totalPages) return;
			loadPage(page + 1);
		}, { rootMargin: "240px" });
		io.observe(el);
		return () => io.disconnect();
	}, [
		loadPage,
		loading,
		page,
		totalPages
	]);
	const hideTitle = (title) => {
		const extra = [title.id, ...title.ids || []].filter(Boolean);
		setHiddenIds((cur) => [.../* @__PURE__ */ new Set([...cur, ...extra])]);
		fetch("/api/curator", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				id: title.id,
				ids: title.ids,
				jellyfinId: title.jellyfinId,
				title: title.title
			})
		}).then((r) => r.json()).then((j) => {
			if (Array.isArray(j.hidden)) setHiddenIds(j.hidden);
		}).catch(() => {});
	};
	const shown = (0, import_react.useMemo)(() => filterCuratorHidden(filterDiscoverCatalog(titles, shelf, hiddenIds), hiddenIds), [
		titles,
		shelf,
		hiddenIds
	]);
	const go = (next) => {
		navigate({
			to: path,
			search: {
				category: next.category ?? cat,
				genre: next.genre ?? genreId
			}
		});
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "px-5 py-6 md:px-10 md:py-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: "/discover",
				className: "inline-flex items-center gap-1 text-sm text-muted",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "size-4" }), "Discover"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-3 font-display text-3xl font-semibold tracking-tight",
				children: heading
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted",
				children: "Titles on this box stay on Home."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-5 flex flex-wrap gap-2",
				children: CATEGORIES.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => go({
						category: c.id,
						genre: ""
					}),
					className: cn("h-9 rounded-full px-4 text-sm", cat === c.id && !genreId ? "bg-gold text-gold-fg" : "bg-card text-muted shadow-[var(--shadow-border)]"),
					children: c.label
				}, c.id))
			}),
			genres.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 flex flex-wrap gap-2",
				children: genres.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => go({
						category: "popular",
						genre: String(g.id)
					}),
					className: cn("h-8 rounded-full px-3 text-xs", genreId === String(g.id) ? "bg-gold text-gold-fg" : "bg-card text-muted shadow-[var(--shadow-border)]"),
					children: g.name
				}, g.id))
			}) : null,
			shown.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
				children: shown.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TitleCard, {
					title: t,
					className: "w-full max-w-full",
					onHide: hideTitle
				}, t.id))
			}) : loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-10 text-sm text-muted",
				children: [
					"Looking up ",
					kind === "tv" ? "shows" : "movies",
					"…"
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-10 text-sm text-muted",
				children: err || "Seerr has nothing new to show yet."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: sentinel,
				className: "h-8"
			}),
			loading && shown.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-center text-xs text-muted",
				children: "Loading more…"
			}) : null
		]
	});
}
//#endregion
export { DiscoverBrowseView as t };
