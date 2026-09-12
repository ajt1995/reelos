import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as cacheCopy, c as rememberCatalogTitles, o as getTitle, s as kindLabel } from "./appliance-CsV_BBL_.mjs";
import { M as Check, m as Play, p as Plus } from "../_libs/lucide-react.mjs";
import { C as requestTitleIdForPage, D as titleMatchesId, O as titlePresenceKeys, S as requestShowsRetry, T as showRequestQueueControls, m as applyTitleRequestPoll, n as Route, p as useReelStore, w as showHashAdapter, x as requestMediaTypeForPage } from "./router-lHCqvkdz.mjs";
import { a as Poster, f as jellyfinWatchHref, i as Gate, n as Button, o as RemoveFromBox, u as formatRuntime } from "./gate-BwFzgC3q.mjs";
//#region ../../workspace/node_modules/.nitro/vite/services/ssr/assets/title._id-xsOfYHtW.js
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
	const [lookupKey, setLookupKey] = (0, import_react.useState)(0);
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
	const thisSeasonOnBox = !series || diskSeasons.includes(season);
	const onBox = series ? thisSeasonOnBox : inJellyfin || inLibrary;
	const available = onBox;
	const requestTitleId = requestTitleIdForPage(id, resolved.kind, extraIds);
	const hashPaste = showHashAdapter({
		pageId: id,
		title: resolved.title
	});
	const blocked = resolved.kind === "music" && !intent.music || resolved.kind === "anime" && !intent.anime || resolved.kind === "kids" && !intent.kids || resolved.kind === "movie" && !intent.movies || resolved.kind === "tv" && !intent.tv;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pb-16",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative min-h-[280px] overflow-hidden md:min-h-[360px]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: resolved.poster,
				alt: "",
				className: "absolute inset-0 size-full object-cover opacity-40 kenburns"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-linear-to-t from-background via-background/70 to-background/20" })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative z-10 mx-auto -mt-40 grid max-w-5xl gap-8 px-5 md:-mt-48 md:grid-cols-[200px_1fr] md:px-10",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Poster, {
				title: resolved,
				className: "mx-auto w-[180px] rounded-2xl md:w-auto"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "pt-2",
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
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-5 max-w-xl text-[15px] leading-relaxed text-muted",
						children: resolved.overview
					}),
					!available && !blocked && !request ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 text-sm text-gold",
						children: cacheCopy(resolved, source)
					}) : null,
					series && !onBox ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-5 flex flex-wrap gap-2",
						children: seasonNumbers.length === 0 && seasonsLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted",
							children: "Loading seasons from Seerr…"
						}) : seasonNumbers.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-danger",
								children: seasonErr || "Could not load seasons from Seerr."
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								size: "lg",
								onClick: () => setLookupKey((n) => n + 1),
								children: "Retry"
							})]
						}) : seasonNumbers.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setSeason(n),
							className: season === n ? "h-9 rounded-full bg-gold px-3 text-xs text-gold-fg" : "h-9 rounded-full bg-card px-3 text-xs text-muted shadow-[var(--shadow-border)]",
							children: [
								"Season ",
								n,
								diskSeasons.includes(n) ? " · Watch" : " · Request"
							]
						}, n))
					}) : series && seasonNumbers.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-5 flex flex-wrap gap-2",
						children: seasonNumbers.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setSeason(n),
							className: season === n ? "h-9 rounded-full bg-gold px-3 text-xs text-gold-fg" : "h-9 rounded-full bg-card px-3 text-xs text-muted shadow-[var(--shadow-border)]",
							children: [
								"Season ",
								n,
								diskSeasons.includes(n) ? " · Watch" : " · Request"
							]
						}, n))
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
							available ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RemoveFromBox, { title: resolved }) : null,
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
		})]
	});
}
function Page() {
	const { id } = Route.useParams();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gate, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TitleView, { id }) });
}
//#endregion
export { Page as component };
