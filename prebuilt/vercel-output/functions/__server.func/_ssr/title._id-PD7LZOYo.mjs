import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as cacheCopy, c as rememberCatalogTitles, o as getTitle, s as kindLabel } from "./appliance-BpvQVhxl.mjs";
import { A as Check, d as Plus, f as Play } from "../_libs/lucide-react.mjs";
import { m as applyTitleRequestPoll, n as Route, p as useReelStore, v as requestShowsRetry, y as showRequestQueueControls } from "./router-CWV-siT-.mjs";
import { a as Poster, i as Gate, n as Button, o as RemoveFromBox, u as formatRuntime } from "./gate-BTY0BQJK.mjs";
//#region ../../workspace/node_modules/.nitro/vite/services/ssr/assets/title._id-PD7LZOYo.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** Poll GET /api/request; sync status + progress into the matching title+season row. */
function useEngineRequest(id, season) {
	const [inJellyfin, setInJellyfin] = (0, import_react.useState)(false);
	const [engineStatus, setEngineStatus] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		fetch("/api/library", { cache: "no-store" }).then((r) => r.json()).then((j) => {
			const hit = (j.titles || []).some((t) => {
				const ids = [t.id, ...t.ids || []];
				if (ids.includes(id)) return true;
				if (id.startsWith("tmdb-tv-")) return ids.includes(`tmdb-${id.slice(8)}`);
				return false;
			});
			setInJellyfin(hit);
			if (!hit || id.startsWith("tmdb-tv-")) return;
			useReelStore.setState((s) => ({ requests: s.requests.map((x) => x.titleId === id && x.status !== "available" && x.season == null ? {
				...x,
				status: "available",
				progress: 100,
				updatedAt: Date.now()
			} : x) }));
		}).catch(() => {});
		const q = new URLSearchParams({ id });
		if (season != null) q.set("season", String(season));
		let stop = false;
		const poll = () => {
			fetch(`/api/request?${q}`, { cache: "no-store" }).then((r) => r.json()).then((j) => {
				if (stop) return;
				setEngineStatus(j.status || null);
				const apiProg = typeof j.progress === "number" ? j.progress : typeof j.percent === "number" ? j.percent : void 0;
				useReelStore.setState((s) => ({ requests: applyTitleRequestPoll(s.requests, {
					titleId: id,
					season,
					status: j.status,
					progress: apiProg,
					reason: j.reason
				}) }));
			}).catch(() => {});
		};
		poll();
		const timer = window.setInterval(poll, 8e3);
		return () => {
			stop = true;
			window.clearInterval(timer);
		};
	}, [id, season]);
	return {
		inJellyfin,
		engineStatus
	};
}
function TitleView({ id }) {
	const catalog = getTitle(id);
	const remote = useReelStore((s) => s.remoteTitles.find((t) => t.id === id));
	const rememberTitles = useReelStore((s) => s.rememberTitles);
	const title = catalog ?? remote;
	const [detail, setDetail] = (0, import_react.useState)(null);
	const resolved = detail ?? title;
	const seasonNumbers = resolved?.seasonList?.filter((n) => n > 0) ?? (resolved?.seasons && resolved.seasons > 0 ? Array.from({ length: resolved.seasons }, (_, i) => i + 1) : []);
	const [season, setSeason] = (0, import_react.useState)(seasonNumbers[0] ?? 1);
	const [hash, setHash] = (0, import_react.useState)("");
	const [hashErr, setHashErr] = (0, import_react.useState)(false);
	const [reqErr, setReqErr] = (0, import_react.useState)(null);
	const request = useReelStore((s) => s.requests.find((r) => r.titleId === id && r.status !== "failed" && (r.season == null || r.season === season)));
	const failed = useReelStore((s) => s.requests.find((r) => r.titleId === id && r.status === "failed"));
	const inLibrary = useReelStore((s) => s.library.includes(id));
	const intent = useReelStore((s) => s.answers.intent);
	const source = useReelStore((s) => s.answers.source);
	const requestTitle = useReelStore((s) => s.requestTitle);
	const retryRequest = useReelStore((s) => s.retryRequest);
	const pasteRelease = useReelStore((s) => s.pasteRelease);
	const { inJellyfin, engineStatus } = useEngineRequest(id, season);
	(0, import_react.useEffect)(() => {
		let stop = false;
		fetch(`/api/lookup?id=${encodeURIComponent(id)}`, { cache: "no-store" }).then((r) => r.json()).then((j) => {
			const t = j.titles?.[0];
			if (stop || !t) return;
			rememberCatalogTitles([t]);
			rememberTitles?.([t]);
			setDetail(t);
			const nums = t.seasonList?.filter((n) => n > 0) ?? (t.seasons && t.seasons > 0 ? Array.from({ length: t.seasons }, (_, i) => i + 1) : []);
			if (nums.length) setSeason((cur) => nums.includes(cur) ? cur : nums[0] ?? 1);
		}).catch(() => {});
		return () => {
			stop = true;
		};
	}, [id, rememberTitles]);
	const sendRequest = (payload) => {
		setReqErr(null);
		const mediaType = payload.titleId.startsWith("tmdb-tv-") ? "tv" : "movie";
		const tmdb = payload.titleId.startsWith("tmdb-tv-") ? payload.titleId.slice(8) : payload.titleId.startsWith("tmdb-") ? payload.titleId.slice(5) : void 0;
		fetch("/api/request", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				titleId: payload.titleId,
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
	const jellyfin = typeof window !== "undefined" ? `http://${window.location.hostname}:8096` : "";
	const series = resolved.kind === "tv" || resolved.kind === "anime";
	const seasonReady = request?.status === "available" || engineStatus === "downloaded";
	const available = series ? seasonReady : inJellyfin || inLibrary || seasonReady;
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
							resolved.year,
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
					resolved.kind === "tv" || resolved.kind === "anime" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-5 flex flex-wrap gap-2",
						children: seasonNumbers.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted",
							children: "Loading seasons from Seerr…"
						}) : seasonNumbers.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setSeason(n),
							className: season === n ? "h-9 rounded-full bg-gold px-3 text-xs text-gold-fg" : "h-9 rounded-full bg-card px-3 text-xs text-muted shadow-[var(--shadow-border)]",
							children: ["Season ", n]
						}, n))
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-6 flex flex-wrap gap-3",
						children: [
							available ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href: jellyfin,
								target: "_blank",
								rel: "noreferrer",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "lg",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, {
										className: "size-4",
										fill: "currentColor"
									}), "Play in Jellyfin"]
								})
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
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
								available,
								requestStatus: request?.status
							}) ? request?.status === "downloading" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "inline-flex h-12 items-center rounded-2xl bg-card px-4 text-sm text-gold",
								children: typeof request.progress === "number" && request.progress > 0 ? `Grabbing · ${Math.round(request.progress)}%` : request.reason ? request.reason : request.via === "cache" ? "Cache hit · importing" : "Grabbing"
							}) : request?.status === "waiting" || engineStatus === "queued" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "inline-flex h-12 items-center rounded-2xl bg-card px-4 text-sm text-muted",
								children: request?.reason ? request.reason : request?.via === "uncached" ? "No cache · looking for a transfer" : "Waiting for a release"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								variant: "ghost",
								size: "lg",
								disabled: (resolved.kind === "tv" || resolved.kind === "anime") && seasonNumbers.length === 0,
								onClick: () => {
									requestTitle(resolved.id, resolved.kind === "tv" || resolved.kind === "anime" ? season : void 0);
									sendRequest({
										titleId: resolved.id,
										season: resolved.kind === "tv" || resolved.kind === "anime" ? season : void 0
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
					(!available || resolved.kind === "tv" || resolved.kind === "anime") && !blocked ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						className: "mt-6 max-w-md",
						onSubmit: (e) => {
							e.preventDefault();
							const ok = pasteRelease(resolved.id, hash);
							setHashErr(!ok);
							if (ok) {
								setHash("");
								sendRequest({
									titleId: resolved.id,
									hash,
									season: resolved.kind === "tv" || resolved.kind === "anime" ? season : void 0
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
