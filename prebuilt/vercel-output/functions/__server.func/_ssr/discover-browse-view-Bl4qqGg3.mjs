import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, b as useNavigate, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { Ht as BookOpen, Nt as ChevronLeft, _ as ThumbsUp, v as ThumbsDown, wt as Coffee } from "../_libs/lucide-react.mjs";
import { A as getMediaLifecycleState, E as cn, G as titleHasRemotePoster, K as titleMatchesId, R as rememberCatalogTitles, U as showToast, V as requestProgressLabel, X as useReelStore, z as requestIsWatchableOnShelf } from "./router-M-yvs45k.mjs";
import { n as useExperienceStore } from "./experience-state-BipBJc8l.mjs";
import { t as Poster } from "./poster-Cd-JU0eF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/discover-browse-view-Bl4qqGg3.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var ADAPTED_BOOK_TITLES = [
	"dune",
	"fellowship",
	"lord of the rings",
	"foundation",
	"silo",
	"wool",
	"three-body",
	"3 body",
	"witcher",
	"game of thrones",
	"house of the dragon",
	"blade runner",
	"arrival",
	"martian",
	"project hail mary",
	"oppenheimer",
	"killers of the flower moon"
];
function hasBookAdaptation(title = "") {
	const norm = title.toLowerCase();
	return ADAPTED_BOOK_TITLES.some((t) => norm.includes(t));
}
function posterArt(title, extras = []) {
	const tmdb = extras.find((x) => {
		const p = String(x.poster || "").trim();
		if (!p || p.includes("/api/jf/")) return false;
		return titleMatchesId(title, x.id) || x.id === title.id;
	});
	if (tmdb?.poster) return String(tmdb.poster);
	return String(title.poster || "");
}
function CuratorVoteBar({ liked, hidden, onVote, placement = "overlay" }) {
	if (placement === "inline") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "z-20 flex items-center gap-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				"aria-label": "Like",
				title: "More like this",
				"aria-pressed": liked ? true : void 0,
				className: cn("flex h-12 items-center gap-2 rounded-2xl px-4 text-sm font-medium transition-all shadow-sm cursor-pointer", liked ? "bg-gold text-gold-fg font-semibold shadow-[var(--shadow-gold)]" : "border border-border bg-card text-muted hover:text-foreground hover:border-border-strong"),
				onClick: (e) => {
					e.preventDefault();
					e.stopPropagation();
					onVote(liked ? "none" : "like");
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThumbsUp, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: liked ? "Liked" : "Like" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				"aria-label": "Comfort Classic",
				title: "Comfort Classic — teach curator your cozy favorites",
				className: "flex h-12 items-center gap-2 rounded-2xl px-4 text-sm font-medium transition-all shadow-sm cursor-pointer border border-border bg-card text-muted hover:text-amber-300 hover:border-amber-500/40",
				onClick: (e) => {
					e.preventDefault();
					e.stopPropagation();
					onVote("comfort");
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Coffee, { className: "size-4 text-amber-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Comfort" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				"aria-label": "Not interested",
				title: "Not interested",
				"aria-pressed": hidden ? true : void 0,
				className: cn("flex h-12 items-center gap-2 rounded-2xl px-4 text-sm font-medium transition-all shadow-sm cursor-pointer", hidden ? "bg-card-2 text-foreground font-semibold border border-border-strong" : "border border-border bg-card text-muted hover:text-foreground hover:border-border-strong"),
				onClick: (e) => {
					e.preventDefault();
					e.stopPropagation();
					onVote(hidden ? "none" : "dislike");
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThumbsDown, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: hidden ? "Hidden" : "Dislike" })]
			})
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("z-20 flex items-center gap-0.5 rounded-full border border-white/20 bg-background/85 px-1.5 py-0.5 backdrop-blur-md shadow-lg transition-all duration-200", liked || hidden ? "opacity-100 scale-100 ring-1 ring-gold/40" : "opacity-85 hover:opacity-100 scale-100", "absolute top-2 right-2"),
		onClick: (e) => {
			e.preventDefault();
			e.stopPropagation();
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				"aria-label": "More like this",
				title: "More like this",
				"aria-pressed": liked ? true : void 0,
				className: cn("flex size-7 items-center justify-center rounded-full transition-transform active:scale-90 cursor-pointer", liked ? "bg-gold text-gold-fg shadow-sm" : "text-muted hover:text-foreground hover:bg-white/10"),
				onClick: (e) => {
					e.preventDefault();
					e.stopPropagation();
					onVote(liked ? "none" : "like");
				},
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThumbsUp, { className: "size-3.5" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-2.5 w-px bg-white/20" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				"aria-label": "Comfort Classic",
				title: "Comfort Classic",
				className: "flex size-7 items-center justify-center rounded-full transition-transform active:scale-90 cursor-pointer text-muted hover:text-amber-300 hover:bg-white/10",
				onClick: (e) => {
					e.preventDefault();
					e.stopPropagation();
					onVote("comfort");
				},
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Coffee, { className: "size-3.5 text-amber-400" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-2.5 w-px bg-white/20" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				"aria-label": "Not interested",
				title: "Not interested",
				"aria-pressed": hidden ? true : void 0,
				className: cn("flex size-7 items-center justify-center rounded-full transition-transform active:scale-90 cursor-pointer", hidden ? "bg-card-2 text-foreground font-semibold" : "text-muted hover:text-foreground hover:bg-white/10"),
				onClick: (e) => {
					e.preventDefault();
					e.stopPropagation();
					onVote(hidden ? "none" : "dislike");
				},
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThumbsDown, { className: "size-3" })
			})
		]
	});
}
function TitleCard({ title, request, progress, className, onHide, onVote, liked, hidden }) {
	const status = request?.status;
	const inLibrary = useReelStore((s) => s.library.includes(title.id) || s.shelf.some((x) => titleMatchesId(x, title.id)));
	const remoteTitles = useReelStore((s) => s.remoteTitles);
	const shelf = useReelStore((s) => s.shelf);
	const kidsTitleIds = useReelStore((s) => s.kidsTitleIds);
	const kidsGiftedTitles = useReelStore((s) => s.kidsGiftedTitles || {});
	const giftedInfo = kidsGiftedTitles[title.id] || (title.jellyfinId ? kidsGiftedTitles[title.jellyfinId] : null);
	const isKids = kidsTitleIds.includes(title.id) || (title.jellyfinId ? kidsTitleIds.includes(title.jellyfinId) : false);
	const isPlayable = Boolean(title.jellyfinId) || (request ? requestIsWatchableOnShelf(request, { titles: shelf }) : inLibrary);
	const painted = {
		...title,
		poster: posterArt(title, remoteTitles)
	};
	const pct = Number(request?.progress) || 0;
	const downloadingLabel = requestProgressLabel(request);
	const lifecycle = getMediaLifecycleState(title, request, {
		titles: shelf,
		inLibrary
	});
	const inFlightBadge = (() => {
		if (isPlayable || lifecycle === "on_shelf" || lifecycle === "unowned") return null;
		if (lifecycle === "importing") return "Importing";
		if (lifecycle === "downloading") return "Downloading";
		if (lifecycle === "searching") return "Searching";
		if (lifecycle === "coming_soon") return "Coming";
		if (lifecycle === "failed") return "Failed";
		return null;
	})();
	const showVotes = Boolean(onVote || onHide);
	const vote = (next) => {
		if (onVote) onVote(title, next);
		else if (onHide && next === "dislike") onHide(title);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/title/$id",
		params: { id: title.id },
		className: cn("group block w-[148px] min-w-0 max-w-full shrink-0 sm:w-[168px]", className),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "cinema-title-card relative overflow-hidden rounded-2xl border border-white/10 bg-card/80 shadow-md transition-all duration-300 ease-out group-hover:scale-[1.035] group-hover:shadow-2xl group-hover:border-gold/50 group-hover:z-10 group-focus-visible:scale-[1.035] group-focus-visible:ring-2 group-focus-visible:ring-gold",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Poster, {
						title: painted,
						className: "rounded-2xl",
						placeholder: request && !titleHasRemotePoster(painted) ? "empty" : "letter"
					}),
					giftedInfo ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute top-0 right-0 z-20 overflow-hidden pointer-events-none rounded-tr-2xl",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-gradient-to-r from-amber-500 via-amber-300 to-yellow-500 text-amber-950 font-black text-[8px] tracking-wide uppercase px-2.5 py-0.5 shadow-md flex items-center gap-1 border-b border-l border-amber-300/60 backdrop-blur-md rounded-bl-lg",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "🎁" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Gift from ", giftedInfo.giftedBy || "Mom & Dad"] })]
						})
					}) : null,
					hasBookAdaptation(title.title) ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "absolute left-2 bottom-2 z-10 flex items-center gap-1 rounded-full border border-sky-400/40 bg-slate-950/85 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-sky-300 shadow-md backdrop-blur-md",
						title: "Adapted from a book in the library",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, { className: "size-2.5" }), "Book"]
					}) : null,
					isKids ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "absolute bottom-2 right-2 flex size-6 items-center justify-center rounded-full bg-gold/90 text-xs shadow-md border border-gold-bright",
						title: "Kid-Approved Title",
						children: "👶"
					}) : null,
					inFlightBadge ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: cn("absolute left-2 top-2 z-10 flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide shadow-sm backdrop-blur-md", inFlightBadge === "Importing" && "bg-live/90 text-background font-semibold", inFlightBadge === "Downloading" && "bg-gold/90 text-gold-fg font-semibold", inFlightBadge === "Searching" && "bg-card/90 text-foreground border border-border-strong", inFlightBadge === "Failed" && "bg-danger/90 text-white font-semibold", inFlightBadge === "Coming" && "bg-card/85 text-muted border border-border"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-1.5 rounded-full", inFlightBadge === "Importing" && "bg-background animate-pulse", inFlightBadge === "Downloading" && "bg-gold-fg animate-pulse", inFlightBadge === "Searching" && "bg-circuit animate-pulse", inFlightBadge === "Failed" && "bg-white", inFlightBadge === "Coming" && "bg-muted") }), inFlightBadge]
					}) : null,
					status === "downloading" && pct > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute inset-x-0 bottom-0 h-1 bg-background/40",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-full bg-gold",
							style: { width: `${pct}%` }
						})
					}) : null,
					typeof progress === "number" && progress > .03 && progress < .97 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute inset-x-0 bottom-0 h-1 bg-background/50",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-full bg-live",
							style: { width: `${progress * 100}%` }
						})
					}) : null,
					showVotes ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CuratorVoteBar, {
						liked,
						hidden,
						onVote: vote
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2.5 line-clamp-2 break-words font-display text-sm font-semibold leading-snug text-foreground group-hover:text-gold transition-colors",
				children: title.title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs text-muted",
				children: [
					Number(title.year) > 0 ? title.year : null,
					status === "available" ? isPlayable ? request?.via === "cache" ? " · Cached" : " · Available now" : ` · ${downloadingLabel || "Importing"}` : null,
					(status === "downloading" || status === "waiting") && downloadingLabel ? ` · ${downloadingLabel}` : null,
					status === "failed" ? " · Failed" : null
				]
			})
		]
	});
}
function curatorTitleKeys(title) {
	if (title == null) return [];
	if (typeof title === "string") return title.trim() ? [title.trim()] : [];
	const keys = /* @__PURE__ */ new Set();
	for (const x of [
		title.id,
		title.jellyfinId,
		...title.ids || []
	]) {
		const s = String(x || "").trim();
		if (s) keys.add(s);
	}
	return [...keys];
}
function titleIsCuratorHidden(title, hidden) {
	const set = hidden instanceof Set ? hidden : new Set([...hidden].map(String));
	if (!set.size) return false;
	return curatorTitleKeys(title).some((k) => set.has(k));
}
function titleIsCuratorLiked(title, liked) {
	const set = liked instanceof Set ? liked : new Set([...liked].map(String));
	if (!set.size) return false;
	return curatorTitleKeys(title).some((k) => set.has(k));
}
function filterCuratorHidden(titles, hidden) {
	const set = hidden instanceof Set ? hidden : new Set([...hidden].map(String));
	if (!set.size) return titles;
	return titles.filter((t) => !titleIsCuratorHidden(t, set));
}
function discoverOwnedNameKey(t) {
	const kind = t?.kind === "tv" || t?.kind === "anime" || t?.mediaType === "tv" ? "tv" : "movie";
	const title = String(t?.title || t?.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
	const year = Number(t?.year) || Number(String(t?.releaseDate || t?.firstAirDate || "").slice(0, 4)) || 0;
	if (!title) return "";
	return `${kind}:${title}:${year || ""}`;
}
function discoverOwnedIndex(titles = [], requests = []) {
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
	for (const r of requests) {
		if (r?.titleId) ids.add(String(r.titleId));
		if (r?.id) ids.add(String(r.id));
		const anyR = r;
		const extraId = anyR?.tmdbId || anyR?.media?.tmdbId || anyR?.tvdbId || anyR?.media?.tvdbId;
		if (extraId) ids.add(String(extraId));
		for (const rawId of [
			r?.titleId,
			r?.id,
			extraId
		]) {
			if (!rawId) continue;
			const sId = String(rawId);
			const numOnly = sId.replace(/^[a-z]+-/, "");
			if (numOnly && numOnly !== sId) {
				ids.add(numOnly);
				ids.add(`tmdb-${numOnly}`);
				ids.add(`tv-${numOnly}`);
				ids.add(`movie-${numOnly}`);
			} else if (/^\d+$/.test(sId)) {
				ids.add(`tmdb-${sId}`);
				ids.add(`tv-${sId}`);
				ids.add(`movie-${sId}`);
			}
		}
		if (r?.title) {
			const kind = r.mediaType === "tv" ? "tv" : "movie";
			const norm = String(r.title).toLowerCase().replace(/[^a-z0-9]+/g, "");
			if (norm) {
				names.add(`${kind}:${norm}:`);
				names.add(`movie:${norm}:`);
				names.add(`tv:${norm}:`);
			}
		}
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
/** JF-available / in-library / currently downloading — not for Discover. */
function discoverTitleIsOwned(title, owned) {
	if (!title) return false;
	if (title.jellyfinId) return true;
	const index = asDiscoverOwned(owned);
	if (title.id && index.ids.has(String(title.id))) return true;
	for (const extra of title.ids || []) if (index.ids.has(String(extra))) return true;
	const key = discoverOwnedNameKey(title);
	if (key && index.names.has(key)) return true;
	const kind = title?.kind === "tv" || title?.kind === "anime" || title?.mediaType === "tv" ? "tv" : "movie";
	const normTitle = String(title?.title || title?.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
	if (normTitle && (index.names.has(`${kind}:${normTitle}:`) || index.names.has(`movie:${normTitle}:`) || index.names.has(`tv:${normTitle}:`))) return true;
	return false;
}
function filterDiscoverCatalog(titles, library, extraSkipIds = [], requests = []) {
	const owned = discoverOwnedIndex(library, requests);
	for (const id of extraSkipIds) if (id) owned.ids.add(String(id));
	return titles.filter((t) => !discoverTitleIsOwned(t, owned));
}
function isIds(value) {
	return Array.isArray(value) && value.every((id) => typeof id === "string" && id.trim().length > 0);
}
async function readSnapshot(response, expectedProfileId, saved) {
	const message = saved ? "Your taste was not saved. Please try again." : "Your taste could not be loaded. Please retry.";
	const result = await response.json().catch(() => null);
	if (response.status !== 200 || !result || typeof result !== "object" || Array.isArray(result)) throw new Error(message);
	const payload = result;
	if (payload.ok !== true || !expectedProfileId || payload.profileId !== expectedProfileId || !isIds(payload.liked) || !isIds(payload.hidden) || saved && payload.persisted !== true) throw new Error(message);
	return {
		profileId: expectedProfileId,
		liked: [...payload.liked],
		hidden: [...payload.hidden]
	};
}
/** The expected identity is only checked locally; the server resolves its own session. */
async function loadPrivateCurator(expectedProfileId, signal, fetcher = fetch) {
	return readSnapshot(await fetcher("/api/curator", {
		cache: "no-store",
		signal
	}), expectedProfileId, false);
}
async function savePrivateCuratorVote({ id, vote, expectedProfileId }, signal, fetcher = fetch) {
	if (!id?.trim() || !expectedProfileId?.trim() || ![
		"like",
		"dislike",
		"comfort",
		"none"
	].includes(vote)) throw new Error("Your taste was not saved. Please reload your profile and try again.");
	return readSnapshot(await fetcher("/api/curator", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			id,
			vote,
			expectedProfileId
		}),
		signal
	}), expectedProfileId, true);
}
function useCurator() {
	const activeProfileId = useExperienceStore((state) => state.activeProfileId);
	const [reload, setReload] = (0, import_react.useState)(0);
	const [state, setState] = (0, import_react.useState)({
		owner: "",
		snapshot: null,
		loading: false,
		saving: false,
		error: null
	});
	const sessionRef = (0, import_react.useRef)(null);
	const isCurrent = (0, import_react.useCallback)((session) => sessionRef.current === session && !session.controller.signal.aborted && useExperienceStore.getState().activeProfileId === session.localProfileId, []);
	(0, import_react.useEffect)(() => {
		const session = {
			localProfileId: activeProfileId,
			confirmedProfileId: null,
			controller: new AbortController(),
			saving: false
		};
		sessionRef.current = session;
		setState({
			owner: activeProfileId,
			snapshot: null,
			loading: Boolean(activeProfileId),
			saving: false,
			error: null
		});
		if (activeProfileId) loadPrivateCurator(activeProfileId, session.controller.signal).then((snapshot) => {
			if (!isCurrent(session)) return;
			session.confirmedProfileId = snapshot.profileId;
			setState({
				owner: activeProfileId,
				snapshot,
				loading: false,
				saving: false,
				error: null
			});
		}).catch(() => {
			if (!isCurrent(session)) return;
			const error = "Your taste could not be loaded. Please retry.";
			setState({
				owner: activeProfileId,
				snapshot: null,
				loading: false,
				saving: false,
				error
			});
			showToast(error, "error");
		});
		return () => {
			session.controller.abort();
			if (sessionRef.current === session) sessionRef.current = null;
		};
	}, [
		activeProfileId,
		reload,
		isCurrent
	]);
	const voteTitle = (0, import_react.useCallback)(async (title, vote) => {
		const session = sessionRef.current;
		if (!session || !isCurrent(session) || !session.confirmedProfileId) {
			showToast("Your profile's taste is not ready. Reload it and try again.", "error");
			return false;
		}
		if (session.saving) {
			showToast("Your previous choice is still saving. Please try again in a moment.", "info");
			return false;
		}
		session.saving = true;
		setState((current) => ({
			...current,
			saving: true,
			error: null
		}));
		try {
			const snapshot = await savePrivateCuratorVote({
				id: title.id,
				vote,
				expectedProfileId: session.confirmedProfileId
			}, session.controller.signal);
			if (!isCurrent(session)) return false;
			setState({
				owner: session.localProfileId,
				snapshot,
				loading: false,
				saving: false,
				error: null
			});
			return true;
		} catch {
			if (isCurrent(session)) {
				const error = "Your taste was not saved. Please try again.";
				setState((current) => ({
					...current,
					saving: false,
					error
				}));
				showToast(error, "error");
			}
			return false;
		} finally {
			session.saving = false;
		}
	}, [isCurrent]);
	const retry = (0, import_react.useCallback)(() => {
		sessionRef.current?.controller.abort();
		sessionRef.current = null;
		setState({
			owner: activeProfileId,
			snapshot: null,
			loading: Boolean(activeProfileId),
			saving: false,
			error: null
		});
		setReload((current) => current + 1);
	}, [activeProfileId]);
	const current = state.owner === activeProfileId ? state : null;
	return {
		hiddenIds: current?.snapshot?.hidden ?? [],
		likedIds: current?.snapshot?.liked ?? [],
		voteTitle,
		loading: current?.loading ?? Boolean(activeProfileId),
		saving: current?.saving ?? false,
		error: current?.error ?? null,
		retry
	};
}
/** Reloads saved taste only; repeating a failed vote remains an explicit choice. */
function CuratorStatus({ loading, saving, error, retry }) {
	if (!loading && !saving && !error) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		role: error ? "alert" : "status",
		"aria-atomic": "true",
		className: "my-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: error || (loading ? "Loading your saved taste…" : "Saving your choice…") }), error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-muted",
			children: "To retry a choice that was not saved, select it again."
		}) : null] }), error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			onClick: retry,
			disabled: loading || saving,
			className: "min-h-[48px] min-w-[48px] rounded-xl border border-border px-4 py-3 font-semibold text-gold hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-wait disabled:opacity-60",
			children: loading ? "Loading taste…" : "Retry loading taste"
		}) : null]
	});
}
var colorCache = /* @__PURE__ */ new Map();
/**
* Extracts dominant vibrant RGB colors from a poster URL for highly transparent
* cinematic backdrop glow on movie and TV pages.
*/
function usePosterAmbient(posterUrl, alpha = .28) {
	const [color, setColor] = (0, import_react.useState)(() => {
		if (!posterUrl) return null;
		return colorCache.get(posterUrl) || null;
	});
	(0, import_react.useEffect)(() => {
		if (!posterUrl || typeof window === "undefined") {
			setColor(null);
			return;
		}
		if (colorCache.has(posterUrl)) {
			setColor(colorCache.get(posterUrl));
			return;
		}
		let active = true;
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.src = posterUrl;
		img.onload = () => {
			if (!active) return;
			try {
				const canvas = document.createElement("canvas");
				canvas.width = 16;
				canvas.height = 16;
				const ctx = canvas.getContext("2d");
				if (!ctx) return;
				ctx.drawImage(img, 0, 0, 16, 16);
				const data = ctx.getImageData(0, 0, 16, 16).data;
				let r = 0, g = 0, b = 0, count = 0;
				for (let i = 0; i < data.length; i += 4) {
					const a = data[i + 3];
					const red = data[i];
					const green = data[i + 1];
					const blue = data[i + 2];
					if (a > 128 && (red > 20 || green > 20 || blue > 20)) {
						r += red;
						g += green;
						b += blue;
						count++;
					}
				}
				if (count > 0) {
					const val = `rgba(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)}, ${alpha})`;
					colorCache.set(posterUrl, val);
					setColor(val);
				} else setColor(null);
			} catch {
				setColor(null);
			}
		};
		img.onerror = () => {
			if (active) setColor(null);
		};
		return () => {
			active = false;
		};
	}, [posterUrl, alpha]);
	return color;
}
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
/** Each catalog query owns its requests and deduplication, including repeated page one. */
function createDiscoverBrowseQuery(key) {
	const seen = /* @__PURE__ */ new Set();
	const pending = /* @__PURE__ */ new Map();
	let disposed = false;
	const isCurrent = (request) => !disposed && !request.controller.signal.aborted && pending.get(request.page) === request.controller;
	return {
		key,
		begin(page) {
			if (page === 1) {
				for (const controller of pending.values()) controller.abort();
				pending.clear();
			} else pending.get(page)?.abort();
			const controller = new AbortController();
			if (disposed) controller.abort();
			pending.set(page, controller);
			return {
				page,
				controller
			};
		},
		isCurrent,
		accept(request, rows) {
			if (!isCurrent(request)) return null;
			if (request.page === 1) seen.clear();
			const extra = [];
			for (const title of rows) {
				if (!title?.id || seen.has(title.id)) continue;
				seen.add(title.id);
				extra.push(title);
			}
			return extra;
		},
		dispose() {
			disposed = true;
			for (const controller of pending.values()) controller.abort();
			pending.clear();
			seen.clear();
		}
	};
}
function DiscoverBrowseView({ kind, category, genre }) {
	const heading = kind === "tv" ? "Shows" : "Movies";
	const path = kind === "tv" ? "/discover/shows" : "/discover/movies";
	const navigate = useNavigate();
	const shelf = useReelStore((s) => s.shelf);
	const requests = useReelStore((s) => s.requests);
	const rememberTitles = useReelStore((s) => s.rememberTitles);
	const hydrateShelf = useReelStore((s) => s.hydrateShelf);
	const curator = useCurator();
	const { hiddenIds, likedIds, voteTitle } = curator;
	const [genres, setGenres] = (0, import_react.useState)([]);
	const [titles, setTitles] = (0, import_react.useState)([]);
	const [page, setPage] = (0, import_react.useState)(1);
	const [totalPages, setTotalPages] = (0, import_react.useState)(1);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [err, setErr] = (0, import_react.useState)(null);
	const queryRef = (0, import_react.useRef)(null);
	const sentinel = (0, import_react.useRef)(null);
	const cat = CATEGORIES.some((c) => c.id === category) ? category : "popular";
	const genreId = String(genre || "").replace(/\D/g, "");
	const queryKey = `${kind}:${cat}:${genreId}`;
	(0, import_react.useEffect)(() => {
		hydrateShelf({
			limit: 24,
			force: true
		});
	}, [hydrateShelf]);
	const loadPage = (0, import_react.useCallback)((nextPage) => {
		const query = queryRef.current;
		if (!query || query.key !== queryKey) return;
		const request = query.begin(nextPage);
		setLoading(true);
		const q = new URLSearchParams({
			kind,
			page: String(nextPage),
			category: cat
		});
		if (genreId) q.set("genre", genreId);
		fetch(`/api/discover?${q}`, {
			cache: "no-store",
			signal: request.controller.signal
		}).then(async (res) => {
			if (!res.ok) throw new Error(`discover ${res.status}`);
			return res.json();
		}).then((j) => {
			const rows = Array.isArray(j.titles) ? j.titles : [];
			if (queryRef.current !== query) return;
			const extra = query.accept(request, rows);
			if (extra === null) return;
			rememberCatalogTitles(rows);
			rememberTitles?.(rows);
			if (Array.isArray(j.genres) && j.genres.length) setGenres(j.genres);
			setTitles((cur) => nextPage <= 1 ? extra : [...cur, ...extra]);
			setPage(Number(j.page || nextPage) || nextPage);
			setTotalPages(Math.max(1, Number(j.totalPages || 1) || 1));
			setErr(rows.length ? null : j.error || null);
			setLoading(false);
		}).catch((e) => {
			if (queryRef.current !== query || !query.isCurrent(request)) return;
			setErr(String(e));
			setLoading(false);
		});
	}, [
		kind,
		cat,
		genreId,
		queryKey,
		rememberTitles
	]);
	(0, import_react.useEffect)(() => {
		const query = createDiscoverBrowseQuery(queryKey);
		queryRef.current = query;
		setTitles([]);
		setPage(1);
		setTotalPages(1);
		setErr(null);
		loadPage(1);
		return () => {
			query.dispose();
			if (queryRef.current === query) queryRef.current = null;
		};
	}, [loadPage, queryKey]);
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
	const voteDiscover = (title, vote) => {
		voteTitle(title, vote);
	};
	const inFlightRequestIds = (0, import_react.useMemo)(() => new Set(requests.map((r) => r.titleId)), [requests]);
	const skipIds = (0, import_react.useMemo)(() => [...inFlightRequestIds, ...hiddenIds], [inFlightRequestIds, hiddenIds]);
	const shown = (0, import_react.useMemo)(() => filterCuratorHidden(filterDiscoverCatalog(titles, shelf, skipIds, requests), hiddenIds), [
		titles,
		shelf,
		skipIds,
		requests,
		hiddenIds
	]);
	const topPoster = shown[0]?.poster || titles[0]?.poster;
	const topBackdrop = shown[0]?.backdrop || titles[0]?.backdrop;
	const ambientColor = usePosterAmbient(topPoster, .25);
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
		className: "relative min-h-screen overflow-x-hidden",
		children: [topPoster || ambientColor ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "pointer-events-none absolute inset-x-0 top-0 h-[380px] overflow-hidden select-none z-0",
			"aria-hidden": "true",
			children: [
				topBackdrop || topPoster ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: topBackdrop || topPoster,
					alt: "",
					className: "absolute -top-16 inset-x-0 w-full h-[460px] object-cover filter blur-[60px] saturate-[2.0] opacity-25 transition-all duration-1000 scale-110",
					onError: (e) => {
						e.currentTarget.style.opacity = "0";
					}
				}) : null,
				ambientColor ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute inset-0 transition-opacity duration-700",
					style: { background: `radial-gradient(ellipse 95% 75% at 50% 0%, ${ambientColor} 0%, transparent 80%)` }
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" })
			]
		}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative z-10 w-full px-6 md:px-12 lg:px-16 py-6 md:py-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/discover",
					className: "inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "size-4" }), "Discover"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-3 font-display text-3xl font-semibold tracking-tight",
					children: heading
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CuratorStatus, { ...curator }),
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
					className: "mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 4xl:grid-cols-9 5xl:grid-cols-10",
					children: shown.map((t) => {
						const req = requests.find((r) => titleMatchesId(t, r.titleId) || r.titleId === t.id);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TitleCard, {
							title: t,
							request: req,
							className: "w-full max-w-full",
							onVote: voteDiscover,
							liked: titleIsCuratorLiked(t, likedIds),
							hidden: hiddenIds.includes(t.id)
						}, t.id);
					})
				}) : loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-10 text-sm text-muted",
					children: [
						"Looking up ",
						kind === "tv" ? "shows" : "movies",
						"…"
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-10 text-sm text-muted",
					children: err || "Nothing new to show right now. Check back soon."
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
		})]
	});
}
//#endregion
export { DiscoverBrowseView as t };
