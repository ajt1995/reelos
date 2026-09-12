import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as cacheCopy, c as rememberCatalogTitles, o as getTitle, s as kindLabel } from "./appliance-Dk74LcNF.mjs";
import { M as ChevronDown, N as Check, h as Play, m as Plus } from "../_libs/lucide-react.mjs";
import { A as titleMatchesId, C as requestMediaTypeForPage, D as showHashAdapter, E as requestTitleIdForPage, O as showRequestQueueControls, T as requestShowsRetry, g as applyTitleRequestPoll, h as useReelStore, j as titlePresenceKeys, n as Route } from "./router-BmL0jyLk.mjs";
import { a as Poster, c as TitleCard, f as jellyfinWatchHref, i as Gate, l as cn, n as Button, o as RemoveFromBox, s as Row, u as formatRuntime } from "./gate-DR2vtzkr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/title._id-Dhq3-HEn.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function seasonNumbersFrom(raw) {
	if (!Array.isArray(raw)) return [];
	return raw.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
}
/** Poll GET /api/request; sync status + progress into the matching title+season row. */
function useEngineRequest(id, season) {
	const [inJellyfin, setInJellyfin] = (0, import_react.useState)(false);
	const [engineStatus, setEngineStatus] = (0, import_react.useState)(null);
	const [seasonList, setSeasonList] = (0, import_react.useState)([]);
	const [onDiskSeasons, setOnDiskSeasons] = (0, import_react.useState)([]);
	const [extraIds, setExtraIds] = (0, import_react.useState)(() => titlePresenceKeys(id));
	(0, import_react.useEffect)(() => {
		let aliases = titlePresenceKeys(id);
		let stop = false;
		const ac = new AbortController();
		fetch("/api/library", {
			cache: "no-store",
			signal: ac.signal
		}).then((r) => r.json()).then((j) => {
			if (stop) return;
			const hit = (j.titles || []).find((t) => titleMatchesId(t, id));
			setInJellyfin(Boolean(hit));
			if (hit) {
				aliases = [.../* @__PURE__ */ new Set([...aliases, ...titlePresenceKeys(hit.id, hit.ids || [])])];
				setExtraIds(aliases);
				const disk = seasonNumbersFrom(hit.onDiskSeasons);
				if (disk.length) setOnDiskSeasons((prev) => [.../* @__PURE__ */ new Set([...prev, ...disk])].sort((a, b) => a - b));
			}
			if (!hit || id.startsWith("tmdb-tv-") || id.startsWith("tvdb-") || id.startsWith("jf-")) return;
			useReelStore.setState((s) => ({ requests: s.requests.map((x) => x.titleId === id && x.status !== "available" && x.season == null ? {
				...x,
				status: "available",
				progress: 100,
				updatedAt: Date.now()
			} : x) }));
		}).catch(() => {});
		const q = new URLSearchParams({ id });
		if (season != null) q.set("season", String(season));
		const poll = () => {
			fetch(`/api/request?${q}`, {
				cache: "no-store",
				signal: ac.signal
			}).then((r) => r.json()).then((j) => {
				if (stop) return;
				setEngineStatus(j.status || null);
				const fromApi = seasonNumbersFrom(j.seasonList);
				if (fromApi.length) setSeasonList(fromApi);
				const disk = seasonNumbersFrom(j.onDiskSeasons);
				if (disk.length) setOnDiskSeasons((prev) => [.../* @__PURE__ */ new Set([...prev, ...disk])].sort((a, b) => a - b));
				const pollIds = [...aliases, j.titleId || ""].filter(Boolean);
				const apiProg = typeof j.progress === "number" ? j.progress : typeof j.percent === "number" ? j.percent : void 0;
				const diskNow = seasonNumbersFrom(j.onDiskSeasons);
				const pollStatus = season != null && (j.status === "downloaded" || j.status === "available") && !diskNow.includes(Number(season)) ? "unknown" : j.status;
				useReelStore.setState((s) => ({ requests: applyTitleRequestPoll(s.requests, {
					titleId: id,
					extraIds: pollIds,
					season,
					status: pollStatus,
					progress: apiProg,
					reason: j.reason
				}) }));
			}).catch(() => {});
		};
		poll();
		const timer = window.setInterval(poll, 8e3);
		return () => {
			stop = true;
			ac.abort();
			window.clearInterval(timer);
		};
	}, [id, season]);
	return {
		inJellyfin,
		engineStatus,
		seasonList,
		onDiskSeasons,
		extraIds
	};
}
var EPISODE_STATUS_LABEL = {
	"in-library": "In library",
	downloading: "Downloading",
	requested: "Requested",
	missing: "Missing"
};
/** Missing always. After Remove, a still-listed Requested row is one tap, not a hunt. */
function episodeRequestAction(status, removedHere = false) {
	if (status === "missing") return "Request";
	if (status === "requested" && removedHere) return "Request again";
	return null;
}
var STATUS_CLASS = {
	"in-library": "bg-success/15 text-success",
	downloading: "bg-gold/15 text-gold",
	requested: "bg-card-2 text-muted",
	missing: "bg-danger/10 text-danger"
};
function SeasonEpisodeAccordion({ seasonNumbers, selectedSeason, onSelectSeason, diskSeasons, titleId, seasonsLoading, seasonErr, onRetrySeasons, blocked, removedHere, onRequestSeason, onRequestEpisode }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [episodes, setEpisodes] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [err, setErr] = (0, import_react.useState)(null);
	const [pending, setPending] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		let stop = false;
		const ac = new AbortController();
		setLoading(true);
		setErr(null);
		const q = new URLSearchParams({
			id: titleId,
			season: String(selectedSeason)
		});
		fetch(`/api/episodes?${q}`, {
			cache: "no-store",
			signal: ac.signal
		}).then((r) => r.json()).then((j) => {
			if (stop) return;
			setEpisodes(Array.isArray(j.episodes) ? j.episodes : []);
			setErr(j.error || null);
			setLoading(false);
		}).catch((e) => {
			if (stop) return;
			setErr(String(e?.message || e));
			setLoading(false);
		});
		return () => {
			stop = true;
			ac.abort();
		};
	}, [
		open,
		titleId,
		selectedSeason
	]);
	(0, import_react.useEffect)(() => {
		if (!open || loading) return;
		const node = document.getElementById(`season-${selectedSeason}-episodes`);
		if (!node) return;
		const id = window.requestAnimationFrame(() => {
			node.scrollIntoView({
				block: "end",
				behavior: "smooth"
			});
		});
		return () => window.cancelAnimationFrame(id);
	}, [
		open,
		selectedSeason,
		loading,
		episodes.length
	]);
	const tapSeason = (n) => {
		if (n === selectedSeason && open) {
			setOpen(false);
			return;
		}
		onSelectSeason(n);
		setOpen(true);
	};
	const missing = episodes.filter((e) => e.status === "missing" || removedHere && e.status === "requested");
	const showSeasonRequest = !blocked && (removedHere || missing.length > 0 || open && !loading && episodes.length === 0);
	if (seasonNumbers.length === 0 && seasonsLoading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted",
		children: "Loading seasons from Seerr…"
	});
	if (seasonNumbers.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-wrap items-center gap-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-danger",
			children: seasonErr || "Could not load seasons from Seerr."
		}), onRetrySeasons ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			variant: "ghost",
			size: "lg",
			onClick: onRetrySeasons,
			children: "Retry"
		}) : null]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "title-season-accordion relative z-20 w-full min-w-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex flex-wrap gap-2",
			children: seasonNumbers.map((n) => {
				const selected = selectedSeason === n;
				const expanded = selected && open;
				const onDisk = diskSeasons.includes(n) && !removedHere;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					"aria-expanded": expanded,
					"aria-controls": `season-${n}-episodes`,
					onClick: () => tapSeason(n),
					className: cn("inline-flex h-11 min-h-11 items-center gap-1 rounded-full px-3 text-sm", selected ? "bg-gold text-gold-fg" : "bg-card text-muted shadow-[var(--shadow-border)]"),
					children: [
						"Season ",
						n,
						onDisk ? " · Watch" : " · Request",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: cn("size-3.5 opacity-80 transition-transform", expanded ? "rotate-180" : "") })
					]
				}, n);
			})
		}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			id: `season-${selectedSeason}-episodes`,
			className: "relative z-20 mt-3 min-w-0 scroll-mt-4 scroll-mb-24 rounded-2xl bg-card px-3 py-2 shadow-[var(--shadow-border)]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center justify-between gap-2 py-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm text-muted",
						children: [
							"S",
							String(selectedSeason).padStart(2, "0"),
							" episodes",
							episodes.length ? ` · ${episodes.length}` : ""
						]
					}), showSeasonRequest ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "ghost",
						size: "sm",
						disabled: pending === "season",
						onClick: () => {
							setPending("season");
							onRequestSeason(selectedSeason);
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "Request this season"]
					}) : null]
				}),
				loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "py-3 text-sm text-muted",
					children: "Loading episodes from Sonarr…"
				}) : null,
				err && !episodes.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "py-2 text-sm text-danger",
					children: err
				}) : null,
				!loading && !episodes.length && !err ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "py-3 text-sm text-muted",
					children: "Episode names land once Sonarr or Seerr has this season. Request this season without hunting."
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "divide-y divide-border",
					children: episodes.map((ep) => {
						const action = episodeRequestAction(ep.status, Boolean(removedHere));
						const key = `e${ep.episodeNumber}`;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex min-h-11 items-center gap-2 py-2.5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "w-9 shrink-0 text-xs text-faint",
									children: ["E", String(ep.episodeNumber).padStart(2, "0")]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "min-w-0 flex-1 truncate text-sm",
									children: ep.title
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									"data-episode-status": ep.status,
									className: cn("shrink-0 rounded-full px-2 py-1 text-[11px] leading-none", STATUS_CLASS[ep.status]),
									children: ep.label || EPISODE_STATUS_LABEL[ep.status]
								}),
								action && !blocked ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "shrink-0 text-xs text-gold",
									disabled: pending === key,
									onClick: () => {
										setPending(key);
										onRequestEpisode(selectedSeason, ep.episodeNumber);
										setEpisodes((cur) => cur.map((row) => row.episodeNumber === ep.episodeNumber ? {
											...row,
											status: "requested",
											label: EPISODE_STATUS_LABEL.requested
										} : row));
									},
									children: action === "Request again" ? "Request again" : "Request"
								}) : null
							]
						}, ep.episodeNumber);
					})
				})
			]
		}) : null]
	});
}
function looksLikeHashTitle(name) {
	return /^[0-9a-f]{32,64}$/i.test(String(name || "").trim());
}
function seasonNumbersOf(title, extra = []) {
	const listed = title?.seasonList?.filter((n) => n > 0) ?? [];
	if (listed.length) return listed;
	if (extra.length) return extra;
	if (title?.seasons && title.seasons > 0) return Array.from({ length: title.seasons }, (_, i) => i + 1);
	return [];
}
function TitleView({ id }) {
	const catalog = getTitle(id);
	const remote = useReelStore((s) => s.remoteTitles.find((t) => titleMatchesId(t, id) || t.id === id));
	const shelf = useReelStore((s) => s.shelf.find((t) => titleMatchesId(t, id) || t.id === id));
	const rememberTitles = useReelStore((s) => s.rememberTitles);
	const title = catalog ?? remote ?? shelf;
	const [detail, setDetail] = (0, import_react.useState)(null);
	const [seasonErr, setSeasonErr] = (0, import_react.useState)(null);
	const [seasonsLoading, setSeasonsLoading] = (0, import_react.useState)(true);
	const [similar, setSimilar] = (0, import_react.useState)([]);
	const raw = detail ?? title;
	const resolved = looksLikeHashTitle(raw?.title) ? detail && !looksLikeHashTitle(detail.title) ? detail : seasonsLoading && !detail ? null : raw ? {
		...raw,
		title: "Unknown on this box"
	} : null : raw;
	const extraIds = titlePresenceKeys(id, resolved?.ids || []);
	const [season, setSeason] = (0, import_react.useState)(1);
	const [hash, setHash] = (0, import_react.useState)("");
	const [hashErr, setHashErr] = (0, import_react.useState)(false);
	const [reqErr, setReqErr] = (0, import_react.useState)(null);
	const [removedHere, setRemovedHere] = (0, import_react.useState)(false);
	const request = useReelStore((s) => {
		const keys = new Set(extraIds);
		const moviePage = resolved?.kind === "movie" || id.startsWith("tmdb-") && !id.startsWith("tmdb-tv-") && !id.startsWith("tvdb-");
		return s.requests.find((r) => {
			if (r.status === "failed") return false;
			if (moviePage && String(r.titleId).startsWith("tmdb-tv-")) return false;
			if (!titlePresenceKeys(r.titleId).some((k) => keys.has(k))) return false;
			return r.season == null || r.season === season;
		});
	});
	const failed = useReelStore((s) => {
		const keys = new Set(extraIds);
		return s.requests.find((r) => r.status === "failed" && titlePresenceKeys(r.titleId).some((k) => keys.has(k)));
	});
	const inLibrary = useReelStore((s) => {
		if (s.library.includes(id)) return true;
		return [...s.shelf, ...s.remoteTitles].some((t) => titleMatchesId(t, id) && s.library.some((lib) => titleMatchesId(t, lib)));
	});
	const intent = useReelStore((s) => s.answers.intent);
	const source = useReelStore((s) => s.answers.source);
	const requestTitle = useReelStore((s) => s.requestTitle);
	const retryRequest = useReelStore((s) => s.retryRequest);
	const pasteRelease = useReelStore((s) => s.pasteRelease);
	const ipv4 = useReelStore((s) => s.ipv4);
	const tailscaleIp = useReelStore((s) => s.tailscaleIp);
	const watchDoor = useReelStore((s) => s.watch);
	const { inJellyfin, engineStatus, seasonList, onDiskSeasons } = useEngineRequest(id, season);
	const seasonNumbers = seasonNumbersOf(resolved, seasonList);
	(0, import_react.useEffect)(() => {
		let stop = false;
		const ac = new AbortController();
		const timer = window.setTimeout(() => ac.abort(), 2e4);
		setSeasonErr(null);
		setSeasonsLoading(true);
		fetch(`/api/lookup?id=${encodeURIComponent(id)}`, {
			cache: "no-store",
			signal: ac.signal
		}).then((r) => r.json()).then((j) => {
			const t = j.titles?.[0];
			if (stop) return;
			if (!t) {
				setSeasonErr(j.error || "Seerr did not return seasons.");
				setSeasonsLoading(false);
				return;
			}
			rememberCatalogTitles([t]);
			rememberTitles?.([t]);
			setDetail(t);
			const nums = seasonNumbersOf(t);
			if (nums.length) setSeason((cur) => nums.includes(cur) ? cur : nums[0] ?? 1);
			setSeasonsLoading(false);
		}).catch((e) => {
			if (stop) return;
			const aborted = String(e?.name || "") === "AbortError";
			setSeasonErr(aborted ? "Seerr lookup timed out. Try again." : String(e?.message || e));
			setSeasonsLoading(false);
		});
		return () => {
			stop = true;
			ac.abort();
			window.clearTimeout(timer);
		};
	}, [
		id,
		rememberTitles,
		lookupKey
	]);
	(0, import_react.useEffect)(() => {
		let stop = false;
		const ac = new AbortController();
		setSimilar([]);
		fetch(`/api/similar?id=${encodeURIComponent(id)}`, {
			cache: "no-store",
			signal: ac.signal
		}).then((r) => r.json()).then((j) => {
			if (stop) return;
			const titles = Array.isArray(j.titles) ? j.titles : [];
			rememberCatalogTitles(titles);
			rememberTitles?.(titles);
			setSimilar(titles);
		}).catch(() => {
			if (!stop) setSimilar([]);
		});
		return () => {
			stop = true;
			ac.abort();
		};
	}, [id, rememberTitles]);
	const sendRequest = (payload) => {
		setReqErr(null);
		const titleId = payload.titleId;
		const mediaType = requestMediaTypeForPage(id, resolved?.kind);
		const tmdb = mediaType === "tv" ? titleId.startsWith("tmdb-tv-") ? titleId.slice(8) : extraIds.find((k) => k.startsWith("tmdb-tv-"))?.slice(8) || extraIds.find((k) => /^tmdb-\d/.test(k))?.slice(5) : titleId.startsWith("tmdb-") && !titleId.startsWith("tmdb-tv-") ? titleId.slice(5) : extraIds.find((k) => /^tmdb-\d/.test(k) && !k.startsWith("tmdb-tv-"))?.slice(5);
		fetch("/api/request", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				titleId,
				title: resolved?.title,
				mediaType,
				tmdb,
				season: payload.season,
				episode: payload.episode,
				hash: payload.hash
			})
		}).then((r) => r.json()).then((j) => {
			if (!j.ok) setReqErr(j.error || "Engine did not add the title");
		}).catch((e) => setReqErr(String(e)));
	};
	if (!resolved) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "px-6 py-16",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-muted",
			children: "Looking up that title…"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/",
			className: "mt-4 inline-block text-gold",
			children: "Home"
		})]
	});
	const hostname = typeof window !== "undefined" ? window.location.hostname : "";
	const jellyfin = jellyfinWatchHref({
		ipv4,
		tailscaleIp,
		watch: watchDoor,
		hostname,
		jellyfinId: resolved.jellyfinId
	});
	const series = resolved.kind === "tv" || resolved.kind === "anime";
	const diskSeasons = [.../* @__PURE__ */ new Set([...onDiskSeasons || [], ...resolved.onDiskSeasons || []])];
	const thisSeasonOnBox = !removedHere && (!series || diskSeasons.includes(season));
	const onBox = series ? thisSeasonOnBox : inJellyfin || inLibrary;
	const available = onBox;
	const requestTitleId = requestTitleIdForPage(id, resolved.kind, extraIds);
	const hashPaste = showHashAdapter({
		pageId: id,
		title: resolved.title
	});
	const blocked = resolved.kind === "music" && !intent.music || resolved.kind === "anime" && !intent.anime || resolved.kind === "kids" && !intent.kids || resolved.kind === "movie" && !intent.movies || resolved.kind === "tv" && !intent.tv;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "title-page pb-16",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "title-hero",
				"aria-hidden": "true",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: resolved.poster,
					alt: "",
					className: "title-hero-art kenburns"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "title-hero-fade" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "title-body",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Poster, {
					title: resolved,
					className: "title-poster rounded-2xl"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "title-copy",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs tracking-[0.18em] text-gold uppercase",
							children: kindLabel(resolved.kind)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "mt-2 font-display text-4xl font-semibold tracking-tight",
							children: resolved.title
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 text-sm text-muted",
							children: [
								resolved.year || null,
								resolved.runtime ? ` · ${formatRuntime(resolved.runtime)}` : null,
								seasonNumbers.length ? ` · ${seasonNumbers.length} seasons` : null,
								resolved.tracks ? ` · ${resolved.tracks} tracks` : null,
								resolved.rating != null && Number.isFinite(Number(resolved.rating)) ? ` · ${Number(resolved.rating).toFixed(1)}` : null,
								resolved.director ? ` · ${resolved.director}` : null
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-xs text-faint",
							children: (resolved.genres ?? []).join(" · ")
						}),
						resolved.kind === "movie" && resolved.collection?.id && resolved.collection.name ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/collection/$id",
							params: { id: String(resolved.collection.id) },
							className: "mt-3 inline-flex text-sm text-gold",
							children: ["Collection · ", resolved.collection.name]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-5 max-w-xl text-[15px] leading-relaxed text-muted",
							children: resolved.overview
						}),
						series && !onBox && !blocked && !request || !series && !available && !blocked && !request ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-4 text-sm text-gold",
							children: cacheCopy(resolved, source)
						}) : null,
						series ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-5",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SeasonEpisodeAccordion, {
								seasonNumbers,
								selectedSeason: season,
								onSelectSeason: setSeason,
								diskSeasons,
								titleId: requestTitleId,
								seasonsLoading,
								seasonErr,
								onRetrySeasons: () => setLookupKey((n) => n + 1),
								blocked,
								removedHere,
								onRequestSeason: (n) => {
									requestTitle(requestTitleId, n);
									sendRequest({
										titleId: requestTitleId,
										season: n
									});
								},
								onRequestEpisode: (n, episode) => {
									sendRequest({
										titleId: requestTitleId,
										season: n,
										episode
									});
								}
							})
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-6 flex flex-wrap gap-3",
							children: [
								available && jellyfin ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: jellyfin,
									target: "_blank",
									rel: "noreferrer",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										size: "lg",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, {
											className: "size-4",
											fill: "currentColor"
										}), "Watch"]
									})
								}) : available ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "lg",
									disabled: true,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, {
										className: "size-4",
										fill: "currentColor"
									}), "Watch"]
								}) : request?.status === "downloading" || request?.status === "waiting" ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "lg",
									disabled: true,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4" }), "Available after request"]
								}),
								available ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "inline-flex h-12 items-center gap-2 rounded-2xl bg-success/10 px-4 text-sm text-success",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" }), "In library"]
								}) : null,
								available ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RemoveFromBox, {
									title: resolved,
									onRemoved: () => setRemovedHere(true)
								}) : null,
								blocked ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "self-center text-sm text-muted",
									children: "This collection is off. Enable it in Settings."
								}) : showRequestQueueControls({
									kind: resolved.kind,
									available: series ? thisSeasonOnBox : available,
									requestStatus: thisSeasonOnBox && series ? "available" : request?.status
								}) ? request?.status === "downloading" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "inline-flex h-12 items-center rounded-2xl bg-card px-4 text-sm text-gold",
									children: typeof request.progress === "number" && request.progress > 0 ? `Grabbing · ${Math.round(request.progress)}%` : request.reason ? request.reason : request.via === "cache" ? "Cache hit · importing" : "Grabbing"
								}) : request?.status === "waiting" || engineStatus === "queued" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "inline-flex h-12 items-center rounded-2xl bg-card px-4 text-sm text-muted",
									children: request?.reason ? request.reason : request?.via === "uncached" ? "No cache · looking for a transfer" : "Waiting for a release"
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									variant: "ghost",
									size: "lg",
									disabled: series && seasonNumbers.length === 0 && !available,
									onClick: () => {
										requestTitle(requestTitleId, series ? season : void 0);
										sendRequest({
											titleId: requestTitleId,
											season: series ? season : void 0
										});
									},
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), resolved.kind === "tv" || resolved.kind === "anime" ? `Request S${String(season).padStart(2, "0")}` : "Request"]
								}) : null,
								request && requestShowsRetry(request) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									size: "lg",
									onClick: () => retryRequest(request.id),
									children: "Retry"
								}) : null
							]
						}),
						failed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-4 text-sm text-danger",
							children: failed.reason
						}) : null,
						reqErr ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-4 text-sm text-danger",
							children: reqErr
						}) : null,
						!available && !blocked && hashPaste ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							className: "mt-6 max-w-md",
							onSubmit: (e) => {
								e.preventDefault();
								const ok = pasteRelease(resolved.id, hash);
								setHashErr(!ok);
								if (ok) {
									setHash("");
									sendRequest({
										titleId: requestTitleId,
										hash,
										season: series ? season : void 0
									});
								}
							},
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs tracking-[0.16em] text-faint uppercase",
									children: "Hand a hash to the adapter"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-sm text-muted",
									children: "Request asks the provider first. Paste only a hash you already have. Nothing is seeded."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-2 flex gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										value: hash,
										onChange: (e) => {
											setHash(e.target.value);
											setHashErr(false);
										},
										placeholder: "Magnet or 40-character infohash",
										className: "h-11 flex-1 rounded-2xl bg-card px-4 text-sm shadow-[var(--shadow-border)] outline-none"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										type: "submit",
										variant: "ghost",
										size: "lg",
										children: "Send"
									})]
								}),
								hashErr ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-sm text-danger",
									children: "That is not a hash or magnet."
								}) : null
							]
						}) : null
					]
				})]
			}),
			similar.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mx-auto max-w-5xl px-5 md:px-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
					label: "More like this",
					children: similar.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TitleCard, { title: t }, t.id))
				})
			}) : null
		]
	});
}
function Page() {
	const { id } = Route.useParams();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gate, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TitleView, { id }) });
}
//#endregion
export { Page as component };
