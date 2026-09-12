import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as rememberCatalogTitles, l as syntheticRelease, o as getTitle, u as titleInCache } from "./appliance-CsV_BBL_.mjs";
import { u as Search } from "../_libs/lucide-react.mjs";
import { T as titleForRequest, g as inFlightRequests, h as collapseHomeRequestCards, p as useReelStore } from "./router-D9x7Rmhk.mjs";
import { c as TitleCard, i as Gate, m as useSyncRequests, s as Row } from "./gate-CDpyfh-b.mjs";
//#region ../../workspace/node_modules/.nitro/vite/services/ssr/assets/discover-Zdcw6orA.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function discoverOwnedNameKey(t) {
	const kind = t?.kind === "tv" || t?.kind === "anime" || t?.mediaType === "tv" ? "tv" : "movie";
	const title = String(t?.title || t?.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
	const year = Number(t?.year) || Number(String(t?.releaseDate || t?.firstAirDate || "").slice(0, 4)) || 0;
	if (!title) return "";
	return `${kind}:${title}:${year || ""}`;
}
function discoverOwnedIndex(titles = []) {
	const ids = /* @__PURE__ */ new Set();
	const names = /* @__PURE__ */ new Set();
	for (const t of titles) {
		if (t?.id) ids.add(String(t.id));
		for (const extra of t?.ids || []) if (extra) ids.add(String(extra));
		if (t?.jellyfinId) {
			ids.add(String(t.jellyfinId));
			ids.add(`jf-${t.jellyfinId}`);
		}
		const key = discoverOwnedNameKey(t);
		if (key) names.add(key);
	}
	return {
		ids,
		names
	};
}
function asDiscoverOwned(exclude) {
	if (!exclude) return {
		ids: /* @__PURE__ */ new Set(),
		names: /* @__PURE__ */ new Set()
	};
	if (exclude instanceof Set) return {
		ids: exclude,
		names: /* @__PURE__ */ new Set()
	};
	if (Array.isArray(exclude)) return discoverOwnedIndex(exclude);
	return {
		ids: exclude.ids instanceof Set ? exclude.ids : /* @__PURE__ */ new Set(),
		names: exclude.names instanceof Set ? exclude.names : /* @__PURE__ */ new Set()
	};
}
/** JF-available / in-library — not in-progress Requests. */
function discoverTitleIsOwned(title, owned) {
	if (!title) return false;
	if (title.jellyfinId) return true;
	const index = asDiscoverOwned(owned);
	if (title.id && index.ids.has(String(title.id))) return true;
	for (const extra of title.ids || []) if (index.ids.has(String(extra))) return true;
	const key = discoverOwnedNameKey(title);
	return Boolean(key && index.names.has(key));
}
function filterDiscoverCatalog(titles, library, extraSkipIds = []) {
	const owned = discoverOwnedIndex(library);
	for (const id of extraSkipIds) if (id) owned.ids.add(String(id));
	return titles.filter((t) => !discoverTitleIsOwned(t, owned));
}
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
function isKind(t, want) {
	if (!t) return false;
	if (want === "tv") return t.kind === "tv" || t.kind === "anime";
	return t.kind === "movie";
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
	const booksOn = useReelStore((s) => s.settings.betaChannel);
	const [bookFeatured, setBookFeatured] = (0, import_react.useState)([]);
	const rememberTitles = useReelStore((s) => s.rememberTitles);
	const hydrateShelf = useReelStore((s) => s.hydrateShelf);
	const shelf = useReelStore((s) => s.shelf);
	const remoteTitles = useReelStore((s) => s.remoteTitles);
	const requests = useReelStore((s) => s.requests);
	const catalog = (0, import_react.useMemo)(() => [...shelf, ...remoteTitles], [shelf, remoteTitles]);
	const inflight = inFlightRequests(requests, { titles: shelf });
	useSyncRequests();
	(0, import_react.useEffect)(() => {
		installHonestRequest();
	}, []);
	(0, import_react.useEffect)(() => {
		hydrateShelf({ limit: 24 });
	}, [hydrateShelf]);
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
	(0, import_react.useEffect)(() => {
		if (!booksOn) {
			setBookFeatured([]);
			return;
		}
		let cancelled = false;
		fetch("/api/books/discover", { cache: "no-store" }).then((r) => r.json()).then((j) => {
			if (cancelled) return;
			setBookFeatured(Array.isArray(j.featured) ? j.featured : []);
		}).catch(() => {
			if (!cancelled) setBookFeatured([]);
		});
		return () => {
			cancelled = true;
		};
	}, [booksOn]);
	const finishing = (0, import_react.useMemo)(() => {
		return collapseHomeRequestCards(inflight).map((r) => ({
			r,
			t: titleForRequest(r, catalog)
		})).filter((x) => x.t?.id);
	}, [inflight, catalog]);
	const finishingIds = (0, import_react.useMemo)(() => new Set(finishing.map((x) => x.t.id)), [finishing]);
	const finishingMovies = finishing.filter((x) => isKind(x.t, "movie")).slice(0, 12);
	const finishingTv = finishing.filter((x) => isKind(x.t, "tv")).slice(0, 12);
	const pickMovies = (0, import_react.useMemo)(() => filterDiscoverCatalog(browseMovies, shelf, finishingIds), [
		browseMovies,
		shelf,
		finishingIds
	]);
	const pickTv = (0, import_react.useMemo)(() => filterDiscoverCatalog(browseTv, shelf, finishingIds), [
		browseTv,
		shelf,
		finishingIds
	]);
	const hits = (0, import_react.useMemo)(() => {
		const seen = /* @__PURE__ */ new Set();
		const out = [];
		for (const t of filterDiscoverCatalog(remoteHits, shelf)) {
			if (seen.has(t.id)) continue;
			seen.add(t.id);
			out.push(t);
		}
		return out;
	}, [remoteHits, shelf]);
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
			fetch(`/api/lookup?q=${encodeURIComponent(term)}&scope=discover`, {
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
				children: "Pick tonight, finish a grab, or search. Titles on this box live on Home."
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
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscoverKind, {
					heading: "Movies",
					finishing: finishingMovies,
					pick: pickMovies
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscoverKind, {
					heading: "Shows",
					finishing: finishingTv,
					pick: pickTv
				}),
				booksOn && bookFeatured.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-10",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-xl font-semibold tracking-tight",
							children: "Books"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-muted",
							children: "Open catalogs. Download is a real DRM-free file — not Seerr."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-3 divide-y divide-border",
							children: bookFeatured.slice(0, 8).map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex items-center justify-between gap-2 py-2 text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "truncate",
									children: [b.title, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "ml-2 text-muted",
										children: b.author
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: "/books",
									className: "text-xs text-circuit",
									children: "Open"
								})]
							}, b.id))
						})
					]
				}) : null,
				pickMovies.length === 0 && pickTv.length === 0 && finishing.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-10 text-sm text-muted",
					children: browseErr || (browseReady ? "Seerr has nothing new to show yet." : "Looking up movies and shows…")
				}) : null
			] })
		]
	});
}
function DiscoverKind({ heading, finishing, pick }) {
	if (!finishing.length && !pick.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-10",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-xl font-semibold tracking-tight",
				children: heading
			}),
			finishing.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
				label: "Finishing",
				children: finishing.map(({ r, t }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TitleCard, {
					title: t,
					request: r
				}, r.id))
			}) : null,
			pick.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
				label: "Pick tonight",
				children: pick.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TitleCard, { title: t }, t.id))
			}) : null
		]
	});
}
function Page() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gate, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscoverView, {}) });
}
//#endregion
export { Page as component };
