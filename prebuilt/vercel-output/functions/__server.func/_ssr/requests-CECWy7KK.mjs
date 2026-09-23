import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { Ft as Check, Mt as ChevronRight, Pt as ChevronDown, Rt as Calendar, Tt as Cloud, ft as HardDrive, g as Trash2, ht as FolderSymlink, nt as LoaderCircle } from "../_libs/lucide-react.mjs";
import { B as requestNeedsLibraryHandoff, E as cn, F as isTvRequestRow, G as titleHasRemotePoster, H as requestShowsRetry, I as mergeServerRequests, J as tvSeasonChips, L as overlayLibraryPresence, N as inFlightRequests, O as extractUpcomingMonitoredSeasons, P as isGhostRequestLabel, R as rememberCatalogTitles, U as showToast, V as requestProgressLabel, W as titleForRequest, X as useReelStore, j as getTitle, k as formatWhen, u as Button } from "./router-M-yvs45k.mjs";
import { t as Gate } from "./gate-C-z8U9Xa.mjs";
import { t as Poster } from "./poster-Cd-JU0eF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/requests-CECWy7KK.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** Pull GET /api/request (list) into the persisted store. Home + Requests both call this.
*  Every poll sends recover=1. Server cooldown + in-flight guard keep kicks from piling up.
*  Recover must not block the list — mailman returns the rows first. */
function useSyncRequests() {
	(0, import_react.useEffect)(() => {
		let stop = false;
		const tick = async () => {
			try {
				const j = await fetch("/api/request?recover=1", { cache: "no-store" }).then((res) => res.json());
				if (stop) return;
				const titles = Array.isArray(j.titles) ? j.titles : [];
				rememberCatalogTitles(titles);
				useReelStore.getState().rememberTitles?.(titles);
				const live = Array.isArray(j.requests) ? j.requests : [];
				useReelStore.setState((s) => {
					const dismissed = new Set(s.dismissedRequestIds || []);
					const overlayTitles = [...s.shelf, ...titles];
					return { requests: overlayLibraryPresence(mergeServerRequests(s.requests, live), { titles: overlayTitles }).filter((r) => !dismissed.has(r.id)) };
				});
				const s = useReelStore.getState();
				if (s.requests.some((r) => requestNeedsLibraryHandoff(r, { titles: s.shelf }))) s.hydrateShelf({
					force: true,
					fresh: true
				});
			} catch {}
		};
		const seeded = useReelStore.getState().requestsSeeded;
		const start = window.setTimeout(() => void tick(), seeded ? 0 : 1500);
		const id = window.setInterval(() => void tick(), 15e3);
		return () => {
			stop = true;
			window.clearTimeout(start);
			window.clearInterval(id);
		};
	}, []);
}
/** Lookup posters/names for inflight rows that still paint as tmdb-2059. */
function useResolveGhostRequestTitles(requests, titles) {
	const rememberTitles = useReelStore((s) => s.rememberTitles);
	const key = [...new Set(requests.filter((r) => {
		const t = titleForRequest(r, titles);
		return isGhostRequestLabel(t.title, t.id) || !titleHasRemotePoster(t);
	}).map((r) => r.titleId).filter(Boolean))].slice(0, 8).join("|");
	(0, import_react.useEffect)(() => {
		if (!key) return;
		let cancelled = false;
		for (const id of key.split("|")) fetch(`/api/lookup?id=${encodeURIComponent(id)}`, { cache: "no-store" }).then(async (res) => {
			if (!res.ok) return null;
			return res.json();
		}).then((j) => {
			if (cancelled || !j) return;
			const list = Array.isArray(j.titles) ? j.titles : [];
			rememberCatalogTitles(list);
			rememberTitles?.(list);
		}).catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [key, rememberTitles]);
}
var FILTERS = [
	{
		id: "all",
		label: "All"
	},
	{
		id: "downloading",
		label: "Downloading"
	},
	{
		id: "waiting",
		label: "Waiting"
	}
];
function sourceProgressLabel(via, status) {
	if (status === "waiting") return via === "cache" ? "Source found · adding to library" : "Looking for a source";
	if (status === "downloading") return via === "cache" ? "Preparing provider copy" : "Transferring provider copy";
	if (status === "available") return "Ready to watch";
	return null;
}
var PIPELINE_STAGES = [
	{
		id: 1,
		label: "Finding a source",
		short: "Finding"
	},
	{
		id: 2,
		label: "Source found",
		short: "Found"
	},
	{
		id: 3,
		label: "Adding to library",
		short: "Adding"
	},
	{
		id: 4,
		label: "Ready to watch",
		short: "Ready"
	}
];
function getHonestFileStatus(r) {
	const reason = String(r.reason || "").toLowerCase();
	if (r.status === "available") return {
		stage: 4,
		tier: "local_storage",
		tierLabel: "Local Media",
		location: "On this ReelOS home",
		isCloudOnly: false,
		statusHeadline: "Ready to Watch",
		detail: "ReelOS verified this copy and it is ready to play.",
		badgeClass: "text-success border-success/30 bg-success/10"
	};
	if (reason.includes("importing") || reason.includes("symlink") || reason.includes("on disk")) return {
		stage: 3,
		tier: "library_link",
		tierLabel: "Instant Cloud",
		location: "Instant Cloud Library",
		isCloudOnly: false,
		statusHeadline: "Linking into Library",
		detail: "ReelOS is adding the available cloud copy without storing a second local copy.",
		badgeClass: "text-circuit border-circuit/30 bg-circuit/10"
	};
	if (r.status === "downloading" && r.via !== "cache" && (r.progress || 0) > 0) return {
		stage: 2,
		tier: "provider_transfer",
		tierLabel: "Cloud Transfer",
		location: "Cloud Stream Transfer",
		isCloudOnly: true,
		statusHeadline: `Transferring (${Math.round(r.progress || 0)}%)`,
		detail: "Transferring media directly into secure cloud cinema storage.",
		badgeClass: "text-amber-400 border-amber-400/30 bg-amber-400/10"
	};
	if (r.via === "cache" || r.status === "downloading") return {
		stage: 2,
		tier: "debrid_cloud",
		tierLabel: "Cloud Cache",
		location: "High-Speed Cloud Storage",
		isCloudOnly: true,
		statusHeadline: "Ready in Cloud Cinema",
		detail: "Your provider has a complete copy. ReelOS is adding it to your library.",
		badgeClass: "text-gold border-gold/30 bg-gold/10"
	};
	return {
		stage: 1,
		tier: "source_searching",
		tierLabel: "Source search",
		location: "No playable copy yet",
		isCloudOnly: true,
		statusHeadline: "Looking for a playable source",
		detail: "ReelOS has not found or created a playable copy yet.",
		badgeClass: "text-muted border-border bg-card-2/60"
	};
}
function RequestsView() {
	const [filter, setFilter] = (0, import_react.useState)("all");
	const requests = useReelStore((s) => s.requests);
	const shelf = useReelStore((s) => s.shelf);
	const remoteTitles = useReelStore((s) => s.remoteTitles);
	const hydrateShelf = useReelStore((s) => s.hydrateShelf);
	const retry = useReelStore((s) => s.retryRequest);
	const cancel = useReelStore((s) => s.cancelRequest);
	const dismissedRequestIds = useReelStore((s) => s.dismissedRequestIds || []);
	const dismissRequest = useReelStore((s) => s.dismissRequest);
	const dismissAllCompletedRequests = useReelStore((s) => s.dismissAllCompletedRequests);
	const [upcomingExpanded, setUpcomingExpanded] = (0, import_react.useState)(true);
	const residents = useReelStore((s) => s.residents);
	const activeResidentId = useReelStore((s) => s.activeResidentId);
	const libraryCatchup = useReelStore((s) => s.libraryCatchup);
	const activeResident = residents.find((r) => r.id === activeResidentId) ?? residents[0] ?? { name: "Host" };
	const isKids = Boolean(activeResident?.isKids);
	const [pendingGuestRequests, setPendingGuestRequests] = (0, import_react.useState)([]);
	const fetchPending = () => {
		if (isKids) return;
		fetch("/api/requests/pending", { cache: "no-store" }).then((r) => r.json()).then((d) => {
			if (d.ok && Array.isArray(d.pending)) setPendingGuestRequests(d.pending);
		}).catch(() => {});
	};
	(0, import_react.useEffect)(() => {
		fetchPending();
	}, [isKids, requests.length]);
	const handleApproveGuest = async (id) => {
		setPendingGuestRequests((cur) => cur.filter((p) => p.id !== id));
		showToast("Guest request approved", "success");
		try {
			const data = await (await fetch("/api/requests/approve", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ id })
			})).json().catch(() => ({ ok: true }));
			if (!data?.ok) {
				showToast(data?.error || "Could not approve request", "error");
				fetchPending();
			} else {
				fetchPending();
				hydrateShelf({
					limit: 24,
					force: true
				});
			}
		} catch {
			showToast("Network error approving request", "error");
			fetchPending();
		}
	};
	const handleRejectGuest = async (id) => {
		setPendingGuestRequests((cur) => cur.filter((p) => p.id !== id));
		showToast("Guest request declined", "info");
		try {
			const data = await (await fetch("/api/requests/reject", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ id })
			})).json().catch(() => ({ ok: true }));
			if (!data?.ok) {
				showToast(data?.error || "Could not decline request", "error");
				fetchPending();
			} else fetchPending();
		} catch {
			showToast("Network error declining request", "error");
			fetchPending();
		}
	};
	const handleRemoveRequest = async (r) => {
		cancel(r.id);
		dismissRequest(r.id);
		showToast("Canceling & removing from box…");
		try {
			await fetch("/api/library", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					titleId: r.titleId,
					confirm: true
				})
			});
			useReelStore.getState().hydrateShelf({
				limit: 24,
				force: true
			});
			showToast("Removed from box", "info");
		} catch {
			showToast("Removed from requests list", "info");
		}
	};
	useSyncRequests();
	(0, import_react.useEffect)(() => {
		hydrateShelf({
			limit: 24,
			force: true
		});
	}, [hydrateShelf]);
	const catalog = [...shelf, ...remoteTitles];
	const inflight = inFlightRequests(requests, { titles: [...shelf, ...remoteTitles] }).filter((r) => !dismissedRequestIds.includes(r.id));
	useResolveGhostRequestTitles(inflight, catalog);
	const filtered = inflight.filter((r) => filter === "all" ? true : r.status === filter);
	const seenTv = /* @__PURE__ */ new Set();
	const list = filtered.filter((r) => {
		if (!isTvRequestRow(r)) return true;
		if (seenTv.has(r.titleId)) return false;
		seenTv.add(r.titleId);
		return true;
	});
	const completedCount = inflight.filter((r) => r.status === "available" || r.engine === "downloaded").length;
	const upcomingSeasons = extractUpcomingMonitoredSeasons(requests, catalog);
	const isSystemBusy = libraryCatchup?.status === "running" || Boolean(libraryCatchup?.needsImport);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "w-full px-6 md:px-12 lg:px-16 max-w-7xl mx-auto py-6 md:py-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-semibold tracking-tight",
				children: "Requests"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted",
				children: "Searching, grabbing, or finished and waiting for Watch on Home. Playable titles are On this box."
			}),
			isSystemBusy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 flex items-start gap-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100 shadow-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-5 shrink-0 animate-spin text-amber-400 mt-0.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 flex-1 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-semibold text-amber-300",
						children: "System is actively linking media onto storage — this will take a moment longer."
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-xs text-amber-200/80 leading-relaxed",
						children: [libraryCatchup?.message || "ReelOS is catching up with available media in the background. Your original files are unchanged.", libraryCatchup?.total && libraryCatchup.total > 0 ? ` (Folder ${libraryCatchup.folder} of ${libraryCatchup.total})` : ""]
					})]
				})]
			}) : null,
			pendingGuestRequests.length > 0 && !isKids ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 flex flex-col gap-2 rounded-2xl border border-gold/40 bg-card p-4 shadow-[var(--shadow-gold)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-xs font-semibold text-gold",
						children: [
							"Guest Requests Pending Host Approval (",
							pendingGuestRequests.length,
							")"
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[11px] text-muted",
						children: "Host Approves Gate"
					})]
				}), pendingGuestRequests.map((pr) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-3 rounded-xl bg-card-2 p-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3 truncate",
						children: [pr.poster ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: pr.poster,
							alt: "",
							className: "h-10 w-7 rounded object-cover"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-10 w-7 rounded bg-muted/20" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "truncate",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate text-sm font-medium text-foreground",
								children: pr.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs text-muted",
								children: [
									"Requested by ",
									pr.requestedBy || "Guest",
									" • ",
									pr.year || "Movie/TV"
								]
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 shrink-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							onClick: () => void handleApproveGuest(pr.id),
							className: "bg-gold text-gold-fg font-bold hover:bg-gold/90",
							children: "Approve"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "quiet",
							onClick: () => void handleRejectGuest(pr.id),
							children: "Decline"
						})]
					})]
				}, pr.id))]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6 flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-2",
					children: FILTERS.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setFilter(f.id),
						className: cn("h-9 rounded-full px-4 text-sm font-medium transition-all", filter === f.id ? "bg-gold text-gold-fg shadow-[var(--shadow-gold)] font-semibold" : "bg-card text-muted shadow-[var(--shadow-border)] hover:text-foreground"),
						children: f.label
					}, f.id))
				}), completedCount > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					variant: "ghost",
					onClick: () => dismissAllCompletedRequests(),
					className: "text-xs text-muted hover:text-foreground flex items-center gap-1.5 h-9 px-3 rounded-full border border-border/50 bg-card/60",
					title: "Clear finished titles from requests",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5 text-success" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						"Clear Completed (",
						completedCount,
						")"
					] })]
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6 flex flex-col gap-4",
				children: [list.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col items-center justify-center rounded-3xl border border-border/60 bg-card/40 p-10 text-center shadow-inner",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex size-12 items-center justify-center rounded-2xl bg-gold/10 text-gold border border-gold/20 mb-3",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cloud, { className: "size-6" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-base font-semibold text-foreground",
							children: "No In-Flight Requests"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 max-w-xs text-xs text-muted leading-relaxed",
							children: "Titles you request in Discover will show their real-time download and cloud-linking progress here."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/discover",
							className: "mt-4 inline-flex items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/10 px-4 py-2 text-xs font-semibold text-gold hover:bg-gold/20 transition-all",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Browse Titles to Request" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-3.5" })]
						})
					]
				}) : null, list.map((r) => {
					const t = titleForRequest(r, catalog) || getTitle(r.titleId);
					const titleId = t?.id || r.titleId;
					const raw = t?.title || r.title || "";
					const label = isGhostRequestLabel(raw, titleId) ? "Looking up title…" : raw || "Title";
					const chips = isTvRequestRow(r) ? tvSeasonChips(r.titleId, requests, catalog) : [];
					const seasonLabel = chips.length > 1 ? "" : r.season ? ` · S${String(r.season).padStart(2, "0")}` : "";
					const honest = getHonestFileStatus(r);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-2xl border border-border/60 bg-card p-4 md:p-5 shadow-sm transition-all hover:border-border space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-start gap-4 min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
										to: "/title/$id",
										params: { id: titleId },
										className: "shrink-0 overflow-hidden rounded-xl",
										children: t ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Poster, {
											title: t,
											className: "h-20 w-14 rounded-xl object-cover shadow-sm"
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-20 w-14 rounded-xl bg-card-2" })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "min-w-0 flex-1",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-wrap items-center gap-2",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
														to: "/title/$id",
														params: { id: titleId },
														className: "truncate font-display text-base font-semibold hover:text-gold transition-colors",
														children: [label, seasonLabel]
													}),
													chips.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "flex flex-wrap gap-1",
														children: chips.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "rounded-md bg-card-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted",
															children: [
																"S",
																String(c.season).padStart(2, "0"),
																" · ",
																c.label
															]
														}, c.season))
													}) : null,
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: cn("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", honest.badgeClass),
														children: honest.statusHeadline
													})
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "mt-1 flex flex-wrap items-center gap-2 text-xs text-muted",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "rounded-full bg-card-2 px-2 py-0.5 font-medium text-foreground",
														children: r.requester
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatWhen(r.createdAt) }),
													r.release ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "max-w-xs truncate font-mono text-[11px] text-faint",
														children: r.release
													})] }) : null
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "mt-2.5 flex flex-col gap-1 rounded-xl bg-card-2/50 p-2.5 border border-border/40 text-xs",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-1.5 font-medium",
													children: [
														honest.isCloudOnly ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cloud, { className: "size-3.5 shrink-0 text-gold" }) : honest.tier === "library_link" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderSymlink, { className: "size-3.5 shrink-0 text-circuit" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HardDrive, { className: "size-3.5 shrink-0 text-success" }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-muted",
															children: "Storage:"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
															className: "rounded bg-card px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground",
															children: honest.location
														})
													]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "text-[11px] text-muted/90 pl-5",
													children: honest.detail
												})]
											})
										]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex items-center gap-2 self-end sm:self-start shrink-0",
									children: r.status === "available" || r.engine === "downloaded" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										size: "sm",
										variant: "ghost",
										onClick: () => dismissRequest(r.id),
										className: "text-xs text-muted hover:text-foreground flex items-center gap-1",
										title: "Clear from requests list",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5 text-success" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Clear" })]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										size: "sm",
										variant: "ghost",
										onClick: () => void handleRemoveRequest(r),
										className: "text-xs text-danger/80 hover:text-danger flex items-center gap-1",
										title: "Remove title and files from box",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Remove" })]
									})] }) : requestShowsRetry(r) ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										variant: "ghost",
										onClick: () => retry(r.id),
										children: "Retry"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										variant: "quiet",
										onClick: () => void handleRemoveRequest(r),
										className: "text-xs text-danger/80 hover:text-danger",
										children: "Cancel"
									})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										variant: "quiet",
										onClick: () => void handleRemoveRequest(r),
										className: "text-xs hover:text-danger",
										title: "Cancel and remove from box",
										children: "Cancel & Remove"
									})
								})]
							}),
							r.status === "downloading" && r.progress > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex justify-between text-xs text-muted mb-1.5 font-medium",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: requestProgressLabel(r) || sourceProgressLabel(r.via, r.status) || "Preparing" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "font-mono text-gold",
									children: [Math.round(r.progress), "%"]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-1.5 w-full overflow-hidden rounded-full bg-card-2",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "h-full bg-gold transition-all duration-300 shadow-[var(--shadow-gold)]",
									style: { width: `${r.progress}%` }
								})
							})] }) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "pt-2 border-t border-border/40",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "grid grid-cols-4 gap-1.5 sm:gap-2",
									children: PIPELINE_STAGES.map((s) => {
										const isDone = s.id < honest.stage;
										const isCurrent = s.id === honest.stage;
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: cn("flex items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-center text-xs font-semibold transition-all", isDone ? "border border-gold/40 bg-gold/10 text-gold" : isCurrent ? "bg-gold text-gold-fg font-bold shadow-[var(--shadow-gold)]" : "border border-border/30 bg-card-2/40 text-muted/50"),
											children: [isDone ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3 stroke-[3]" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "text-[10px] opacity-75",
												children: [s.id, "."]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "truncate",
												children: s.label
											})]
										}, s.id);
									})
								})
							})
						]
					}, r.id);
				})]
			}),
			upcomingSeasons.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-8 rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setUpcomingExpanded((prev) => !prev),
					className: "w-full flex items-center justify-between p-4 md:px-5 text-left transition-colors hover:bg-card-2/40",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2.5 min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Calendar, { className: "size-4 text-gold shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
								className: "text-sm font-semibold text-foreground flex items-center gap-2 truncate",
								children: ["Upcoming & Monitored TV Seasons", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold ring-1 ring-gold/30 shrink-0",
									children: upcomingSeasons.length
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted truncate",
								children: "Future seasons monitored by ReelFlow — automatically added upon release"
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1 text-xs text-muted shrink-0 ml-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: upcomingExpanded ? "Hide" : "Show" }), upcomingExpanded ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4" })]
					})]
				}), upcomingExpanded ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "border-t border-border/40 p-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3",
						children: upcomingSeasons.map((us) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3 rounded-xl border border-border/40 bg-card-2/60 p-3 hover:border-gold/30 transition-all",
							children: [us.poster ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: us.poster,
								alt: "",
								className: "h-14 w-10 shrink-0 rounded-lg object-cover shadow-sm"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-14 w-10 shrink-0 rounded-lg bg-card-2 border border-border/40 flex items-center justify-center",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Calendar, { className: "size-4 text-muted/50" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
										to: "/title/$id",
										params: { id: us.showId },
										className: "truncate block text-xs font-semibold text-foreground hover:text-gold transition-colors",
										children: us.showTitle
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-1 flex items-center gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-gold",
											children: ["S", String(us.seasonNumber).padStart(2, "0")]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11px] text-muted truncate",
											children: us.airDate ? `Expected ${us.airDate}` : "Monitored"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-0.5 text-[10px] text-muted/70 truncate",
										children: us.reason
									})
								]
							})]
						}, `${us.showId}-s${us.seasonNumber}`))
					})
				}) : null]
			}) : null
		]
	});
}
function Page() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gate, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RequestsView, {}) });
}
//#endregion
export { Page as component };
