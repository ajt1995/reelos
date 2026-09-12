import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, b as useNavigate, d as useRouterState, v as Link, y as Navigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as rememberCatalogTitles, n as HOSTNAME, o as getTitle, r as SOURCES } from "./appliance-Dk74LcNF.mjs";
import { A as ChevronRight, C as HardDrive, D as Compass, F as BookOpen, M as ChevronDown, N as Check, O as Cloud, R as Activity, S as House, _ as LoaderCircle, a as TriangleAlert, b as Layers, d as Search, j as ChevronLeft, k as Clapperboard, u as Settings, y as Library } from "../_libs/lucide-react.mjs";
import { B as homeShelfRows, F as transferringChipCount, L as catchupLocksHome, M as titleForRequest, R as catchupShowsBanner, _ as useReelStore, b as inFlightRequests, h as sourceLabel, p as frontendLabel, x as isGhostRequestLabel, y as collapseHomeRequestCards, z as updateLocksUi } from "./router-BPo84ujE.mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { i as cn, n as Row, r as TitleCard } from "./title-card-D_EBASBo.mjs";
import { n as useSyncRequests, t as useResolveGhostRequestTitles } from "./use-sync-requests-DuWLXOt4.mjs";
import { t as Slot } from "../_libs/radix-ui__react-slot.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/gate-C9D7tlj1.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,box-shadow,color,transform,opacity] duration-150 ease-out disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-background),0_0_0_4px_var(--color-gold)] active:not-disabled:scale-[0.98]", {
	variants: {
		variant: {
			gold: "bg-gold text-gold-fg hover:bg-gold-bright",
			ghost: "bg-transparent text-foreground hover:bg-foreground/6 shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]",
			quiet: "bg-transparent text-muted hover:text-foreground hover:bg-foreground/5",
			live: "bg-live text-background hover:brightness-110",
			danger: "bg-danger/15 text-danger hover:bg-danger/25"
		},
		size: {
			sm: "h-9 rounded-lg px-3.5 text-sm",
			md: "h-11 rounded-xl px-5 text-sm",
			lg: "h-12 rounded-2xl px-6 text-[15px]",
			icon: "size-11 rounded-xl"
		}
	},
	defaultVariants: {
		variant: "gold",
		size: "md"
	}
});
function Button({ className, variant, size, asChild = false, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size
		}), className),
		...props
	});
}
function idsFromTitle(title) {
	const extra = [...title.ids || []];
	if (title.jellyfinId) extra.push(title.jellyfinId, `jf-${title.jellyfinId}`);
	return extra;
}
function mediaFields(title) {
	const id = String(title.id || "");
	const tv = title.kind === "tv" || title.kind === "anime" || id.startsWith("tmdb-tv-") || id.startsWith("tvdb-");
	const fromIds = (prefix) => (title.ids || []).map((x) => String(x)).find((x) => x.startsWith(prefix))?.slice(prefix.length);
	const tmdb = id.startsWith("tmdb-tv-") ? id.slice(8) : id.startsWith("tmdb-") ? id.slice(5) : fromIds("tmdb-tv-") || fromIds("tmdb-");
	const tvdb = id.startsWith("tvdb-") ? id.slice(5) : fromIds("tvdb-");
	return {
		mediaType: tv ? "tv" : "movie",
		tmdb,
		tvdb
	};
}
function RemoveFromBox({ title, compact = false, className, onRemoved }) {
	const [step, setStep] = (0, import_react.useState)("idle");
	const [err, setErr] = (0, import_react.useState)(null);
	const dropLibraryTitle = useReelStore((s) => s.dropLibraryTitle);
	const run = () => {
		setErr(null);
		setStep("working");
		const media = mediaFields(title);
		const extra = idsFromTitle(title);
		fetch("/api/library", {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				titleId: title.id,
				jellyfinId: title.jellyfinId,
				ids: extra,
				confirm: true,
				...media
			})
		}).then((r) => r.json()).then((j) => {
			if (!j.ok) {
				setErr(j.error || "Could not remove that title");
				setStep("confirm");
				return;
			}
			dropLibraryTitle(title.id, [...extra, ...j.keys || []]);
			setStep("idle");
			onRemoved?.();
		}).catch((e) => {
			setErr(String(e));
			setStep("confirm");
		});
	};
	if (compact) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("mt-1", className),
		children: [
			step === "idle" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "text-xs text-danger",
				onClick: () => setStep("confirm"),
				children: "Remove"
			}) : null,
			step === "confirm" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "text-xs text-danger",
					onClick: run,
					children: "Confirm remove?"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "text-xs text-muted",
					onClick: () => setStep("idle"),
					children: "Keep"
				})]
			}) : null,
			step === "working" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted",
				children: "Removing…"
			}) : null,
			err ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-danger",
				children: err
			}) : null
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("flex flex-col gap-2", className),
		children: [
			step === "idle" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "button",
				variant: "ghost",
				size: "lg",
				onClick: () => setStep("confirm"),
				children: "Remove from this box"
			}) : null,
			step === "confirm" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "max-w-sm text-sm text-muted",
				children: [
					"Remove ",
					title.title,
					" from this box? Radarr or Sonarr stops watching it. Files on /media stay. Decypharr is not wiped."
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					variant: "danger",
					size: "lg",
					onClick: run,
					children: "Remove"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					variant: "ghost",
					size: "lg",
					onClick: () => setStep("idle"),
					children: "Keep"
				})]
			})] }) : null,
			step === "working" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "Removing…"
			}) : null,
			err ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-danger",
				children: err
			}) : null
		]
	});
}
function HomeView() {
	const [q, setQ] = (0, import_react.useState)("");
	const [remoteHits, setRemoteHits] = (0, import_react.useState)([]);
	const [peopleHits, setPeopleHits] = (0, import_react.useState)([]);
	const [collectionHits, setCollectionHits] = (0, import_react.useState)([]);
	const [lookupErr, setLookupErr] = (0, import_react.useState)(null);
	const rememberTitles = useReelStore((s) => s.rememberTitles);
	const hydrateShelf = useReelStore((s) => s.hydrateShelf);
	const shelf = useReelStore((s) => s.shelf);
	const remoteTitles = useReelStore((s) => s.remoteTitles);
	const shelfError = useReelStore((s) => s.shelfError);
	const shelfReady = useReelStore((s) => s.shelfReady);
	const navigate = useNavigate();
	const requests = useReelStore((s) => s.requests);
	const watch = useReelStore((s) => s.watchProgress);
	const frontend = useReelStore((s) => s.answers.frontend);
	const source = useReelStore((s) => s.answers.source);
	const adapter = useReelStore((s) => s.adapter);
	const booksOn = useReelStore((s) => s.settings.betaChannel);
	const [bookShelf, setBookShelf] = (0, import_react.useState)([]);
	const catalog = (0, import_react.useMemo)(() => [...shelf, ...remoteTitles], [shelf, remoteTitles]);
	const jfLive = useReelStore((s) => s.jellyfinHop?.state === "green");
	const boxShelf = (0, import_react.useMemo)(() => homeShelfRows(shelf), [shelf]);
	const inflight = inFlightRequests(requests, { titles: shelf });
	const transferring = transferringChipCount(inflight);
	const libraryCatchup = useReelStore((s) => s.libraryCatchup);
	const catchupChip = catchupShowsBanner(libraryCatchup);
	useSyncRequests();
	useResolveGhostRequestTitles(inflight, catalog);
	(0, import_react.useEffect)(() => {
		hydrateShelf({
			limit: 24,
			force: true
		});
	}, [hydrateShelf]);
	(0, import_react.useEffect)(() => {
		if (!booksOn) {
			setBookShelf([]);
			return;
		}
		fetch("/api/books/library", { cache: "no-store" }).then((r) => r.json()).then((j) => setBookShelf(Array.isArray(j.books) ? j.books : [])).catch(() => setBookShelf([]));
	}, [booksOn]);
	const catalogHits = [];
	const hits = (0, import_react.useMemo)(() => {
		const seen = /* @__PURE__ */ new Set();
		const out = [];
		for (const t of [...remoteHits, ...catalogHits]) {
			if (seen.has(t.id)) continue;
			seen.add(t.id);
			out.push(t);
		}
		return out;
	}, [catalogHits, remoteHits]);
	(0, import_react.useEffect)(() => {
		const term = q.trim();
		if (term.length < 2) {
			setRemoteHits([]);
			setPeopleHits([]);
			setCollectionHits([]);
			setLookupErr(null);
			return;
		}
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
				const people = Array.isArray(r?.people) ? r.people : [];
				const collections = Array.isArray(r?.collections) ? r.collections : [];
				rememberCatalogTitles(titles);
				rememberTitles?.(titles);
				setRemoteHits(titles);
				setPeopleHits(people);
				setCollectionHits(collections);
				setLookupErr(titles.length || people.length || collections.length ? null : r?.error || "Seerr returned no titles");
				if (titles.some((t) => t.jellyfinId)) useReelStore.getState().hydrateShelf({
					limit: 24,
					force: true
				});
			}).catch((e) => {
				if (cancelled || e?.name === "AbortError") return;
				setRemoteHits([]);
				setPeopleHits([]);
				setCollectionHits([]);
				setLookupErr(String(e));
			});
		}, 280);
		return () => {
			cancelled = true;
			ac.abort();
			window.clearTimeout(t);
		};
	}, [q, rememberTitles]);
	const reqCards = collapseHomeRequestCards(inflight).map((r) => ({
		r,
		t: titleForRequest(r, catalog) ?? getTitle(r.titleId)
	})).filter((x) => x.t && !isGhostRequestLabel(x.t.title, x.t.id)).slice(0, 12);
	const continueWatch = Object.entries(watch).filter(([, v]) => v > .03 && v < .96).map(([id, v]) => ({
		t: getTitle(id) || catalog.find((x) => x.id === id),
		v
	})).filter((x) => x.t);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "px-5 pb-12 pt-2 md:px-10 md:pt-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "relative mx-auto block w-full max-w-2xl",
				onSubmit: (e) => {
					e.preventDefault();
					if (hits[0]) navigate({
						to: "/title/$id",
						params: { id: hits[0].id }
					});
					else if (peopleHits[0]) navigate({
						to: "/person/$id",
						params: { id: String(peopleHits[0].id) }
					});
					else if (collectionHits[0]) navigate({
						to: "/collection/$id",
						params: { id: String(collectionHits[0].id) }
					});
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-faint" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: q,
						onChange: (e) => setQ(e.target.value),
						placeholder: "Search movies, shows, people",
						className: "h-14 w-full rounded-2xl bg-card pl-12 pr-4 text-base shadow-[var(--shadow-border)] placeholder:text-faint"
					}),
					hits.length > 0 || peopleHits.length > 0 || collectionHits.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "absolute z-20 mt-2 w-full overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]",
						children: [
							hits.slice(0, 6).map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/title/$id",
								params: { id: t.id },
								className: "flex items-center gap-3 px-4 py-3 text-sm hover:bg-foreground/5",
								onClick: () => setQ(""),
								children: [
									t.poster ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: t.poster,
										alt: "",
										className: "h-10 w-7 rounded object-cover"
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-10 w-7 rounded bg-card-2" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "flex-1 truncate",
										children: t.title
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs text-muted",
										children: t.year
									})
								]
							}) }, t.id)),
							peopleHits.slice(0, 3).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/person/$id",
								params: { id: String(p.id) },
								className: "flex items-center gap-3 px-4 py-3 text-sm hover:bg-foreground/5",
								onClick: () => setQ(""),
								children: [
									p.poster ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: p.poster,
										alt: "",
										className: "h-10 w-10 rounded-full object-cover"
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-10 w-10 rounded-full bg-card-2" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "flex-1 truncate",
										children: p.name
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs text-muted",
										children: "Actor"
									})
								]
							}) }, `person-${p.id}`)),
							collectionHits.slice(0, 2).map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/collection/$id",
								params: { id: String(c.id) },
								className: "flex items-center gap-3 px-4 py-3 text-sm hover:bg-foreground/5",
								onClick: () => setQ(""),
								children: [
									c.poster ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: c.poster,
										alt: "",
										className: "h-10 w-7 rounded object-cover"
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-10 w-7 rounded bg-card-2" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "flex-1 truncate",
										children: c.name
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs text-muted",
										children: "Collection"
									})
								]
							}) }, `collection-${c.id}`))
						]
					}) : q.trim().length >= 2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-xs text-muted",
						children: lookupErr ?? "Looking up movies and shows…"
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
						live: jfLive,
						children: [frontendLabel[frontend], jfLive ? " live" : ""]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
						live: adapter.status === "healthy",
						children: [sourceLabel[source], adapter.status === "healthy" ? " live" : ""]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { children: HOSTNAME }),
					catchupChip ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
						gold: true,
						children: libraryCatchup.message || "Library catching up"
					}) : transferring > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
						gold: true,
						children: [transferring, " transferring"]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { children: "Library idle" })
				]
			}),
			booksOn && bookShelf.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-2 flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-sm font-medium",
						children: "Books"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/books",
						className: "text-xs text-circuit",
						children: "Catalog"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "space-y-1 text-sm",
					children: bookShelf.slice(0, 6).map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "truncate",
							children: [b.title, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-2 text-muted",
								children: b.author
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							href: `/books?read=${encodeURIComponent(b.rel)}`,
							className: "inline-flex h-7 items-center rounded-full bg-gold px-2.5 text-[11px] font-medium text-gold-fg",
							children: "Read"
						})]
					}, b.rel))
				})]
			}) : null,
			continueWatch.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
				label: "Continue watching",
				children: continueWatch.map(({ t, v }) => t ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TitleCard, {
					title: t,
					progress: v
				}, t.id) : null)
			}) : null,
			reqCards.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
				label: "Your requests",
				children: reqCards.map(({ r, t }) => t ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TitleCard, {
					title: t,
					request: r
				}, r.id) : null)
			}) : null,
			boxShelf.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
				label: "On this box",
				children: boxShelf.slice(0, 24).map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-[148px] min-w-[148px] max-w-[148px] shrink-0 overflow-hidden sm:w-[168px] sm:min-w-[168px] sm:max-w-[168px]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TitleCard, {
						title: t,
						className: "w-full max-w-full"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RemoveFromBox, {
						title: t,
						compact: true
					})]
				}, t.id))
			}) : q.trim().length < 2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-16 text-center text-sm text-muted",
				children: shelfError || (shelfReady ? "Nothing in Jellyfin yet. Search and Request — it lands here. Play uses Jellyfin; on this LAN the official app is http://<lan>:8096 without Tailscale." : "Loading library…")
			}) : null
		]
	});
}
function Chip({ children, live, gold }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: cn("inline-flex h-8 items-center gap-2 rounded-full bg-card px-3 text-xs text-muted shadow-[var(--shadow-border)]", gold && "text-gold", live && "text-live"),
		children: [live ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-1.5 rounded-full bg-live" }) : null, children]
	});
}
function ReelMark({ className, spinRing = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 64 64",
		fill: "none",
		"aria-hidden": "true",
		className: cn("text-gold", className),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "32",
				cy: "32",
				r: "29",
				stroke: "currentColor",
				strokeOpacity: "0.22",
				strokeWidth: "1.25"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "32",
				cy: "32",
				r: "25.5",
				stroke: "#3EC6D8",
				strokeOpacity: "0.55",
				strokeWidth: "1.4",
				strokeDasharray: "18 80",
				strokeDashoffset: "8",
				className: spinRing ? "reel-spin-ring" : void 0
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "32",
				cy: "32",
				r: "23.5",
				stroke: "currentColor",
				strokeWidth: "3.2"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "32",
				cy: "32",
				r: "11.2",
				stroke: "currentColor",
				strokeWidth: "2.4"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M30.4 7.2h3.2v14.6h-3.2zM30.4 42.2h3.2v14.6h-3.2zM7.2 30.4h14.6v3.2H7.2zM42.2 30.4h14.6v3.2H42.2z",
				fill: "currentColor"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M28.2 24.4 42.4 32 28.2 39.6Z",
				fill: "currentColor"
			})
		]
	});
}
function Wordmark({ className, markClassName, spinRing = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: cn("inline-flex items-center gap-2.5", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReelMark, {
			className: cn("size-8", markClassName),
			spinRing
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-display text-[1.35rem] font-semibold tracking-[0.18em] text-gold",
			children: "ReelOS"
		})]
	});
}
var empty = {
	provisioned: false,
	ipv4: "",
	watch: "",
	seerr: "",
	jellyfin: {
		state: "amber",
		detail: "Still starting"
	},
	frontend: "jellyfin",
	access: "lan",
	adminName: "reelos",
	adminPassword: "reelos",
	tailscaleAuth: null,
	tailscaleInstalled: false,
	tailscaleUp: false,
	tailnet: null
};
function ConnectView({ onDone }) {
	const navigate = useNavigate();
	const patchSettings = useReelStore((s) => s.patchSettings);
	const openReelOS = useReelStore((s) => s.openReelOS);
	const [box, setBox] = (0, import_react.useState)(empty);
	const [away, setAway] = (0, import_react.useState)(null);
	const [idxName, setIdxName] = (0, import_react.useState)("Indexer");
	const [idxUrl, setIdxUrl] = (0, import_react.useState)("");
	const [idxKey, setIdxKey] = (0, import_react.useState)("");
	const [idxMsg, setIdxMsg] = (0, import_react.useState)("");
	const [tsBusy, setTsBusy] = (0, import_react.useState)(false);
	const [tsMsg, setTsMsg] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		let stop = false;
		const tick = async () => {
			try {
				const j = await (await fetch("/api/box", { cache: "no-store" })).json();
				if (!stop) setBox({
					...empty,
					...j
				});
			} catch {
				if (!stop) setBox((b) => ({
					...b,
					jellyfin: {
						state: "red",
						detail: "Can't start"
					}
				}));
			}
		};
		tick();
		const id = window.setInterval(() => void tick(), 4e3);
		return () => {
			stop = true;
			window.clearInterval(id);
		};
	}, []);
	const finish = () => {
		patchSettings({ connectDone: true });
		openReelOS();
		onDone?.();
		navigate({ to: "/" });
	};
	const jfLock = box.jellyfin.state === "red";
	const watch = box.watch || (box.ipv4 ? `http://${box.ipv4}:8096` : "");
	const addIndexer = async () => {
		setIdxMsg("");
		const j = await (await fetch("/api/indexer", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: idxName,
				url: idxUrl,
				key: idxKey
			})
		})).json();
		setIdxMsg(j.ok ? "Added." : j.error || "Could not add");
		if (j.ok) {
			setIdxUrl("");
			setIdxKey("");
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "px-5 py-8 md:px-10",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-display text-xs tracking-[0.22em] text-gold uppercase",
				children: "Connect"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-3 font-display text-3xl font-semibold tracking-tight",
				children: "Your TV is not ReelOS"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 max-w-xl text-sm text-muted",
				children: "Request in ReelOS (Discover). Watch in Jellyfin. Seerr on :5055 is the TV/admin door."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dot, { state: box.jellyfin.state }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-display font-medium",
				children: "Jellyfin"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted",
				children: box.jellyfin.detail
			})] })] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card$1, {
				locked: jfLock,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-full",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display font-medium",
							children: "Watch on the TV"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm text-muted",
							children: "Install Jellyfin on the TV → Add server → paste this. Not reelos.local."
						}),
						jfLock ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-sm text-gold",
							children: box.jellyfin.detail
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-4 break-all font-mono text-xl text-gold",
								children: watch
							}),
							watch ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								alt: "QR for the TV app",
								className: "mt-4 size-40 rounded-xl bg-white p-2",
								src: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(watch)}`
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-3 text-sm text-muted",
								children: [
									"Login ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-foreground",
										children: box.adminName
									}),
									" · PIN",
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-mono text-foreground",
										children: box.adminPassword
									})
								]
							})
						] })
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card$1, {
				locked: jfLock,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display font-medium",
						children: "Watch on this phone"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: "Same login in this browser or the Jellyfin app. Request here, watch there."
					}),
					!jfLock && watch ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: watch,
						target: "_blank",
						rel: "noreferrer",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							className: "mt-3",
							size: "lg",
							children: "Open Jellyfin in this browser"
						})
					}) : null
				] })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card$1, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "w-full",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display font-medium",
						children: "Seerr (TV / admin)"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: "Phone search and Request stay in ReelOS. Same Jellyfin login. After Apply, hook Radarr, Sonarr, and Jellyfin in Seerr if wire did not finish."
					}),
					box.seerr || box.ipv4 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 break-all font-mono text-xl text-gold",
						children: box.seerr || `http://${box.ipv4}:5055`
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: box.seerr || `http://${box.ipv4}:5055`,
						target: "_blank",
						rel: "noreferrer",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							className: "mt-3",
							size: "lg",
							children: "Open Seerr"
						})
					})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-sm text-muted",
						children: "Waiting on LAN address."
					})
				]
			}) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card$1, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "w-full",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display font-medium",
						children: "Away from home"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex flex-wrap gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: away === "house" ? "default" : "ghost",
							onClick: () => setAway("house"),
							children: "Only this house"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: away === "out" ? "default" : "ghost",
							onClick: () => setAway("out"),
							children: "Also my phone when I'm out"
						})]
					}),
					away === "out" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4 text-sm text-muted",
						children: box.tailscaleUp && box.tailscaleIp ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-display text-2xl tracking-tight",
									children: box.tailscaleIp
								}),
								box.tailscaleDns ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-gold",
									children: box.tailscaleDns
								}) : null,
								box.tailnet ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-1",
									children: [
										"Tailnet ",
										box.tailnet,
										". Survives reboot."
									]
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-3",
									children: [
										"Phone: Tailscale app, same account, then",
										" ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-gold",
											children: ["http://", box.tailscaleIp]
										})
									]
								})
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Install the Tailscale app on the phone, same account. First this box has to log in." }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								className: "mt-3",
								disabled: tsBusy,
								onClick: () => {
									setTsBusy(true);
									setTsMsg("Getting a login link…");
									fetch("/api/tailscale/login", { method: "POST" }).then((r) => r.json()).then((j) => {
										if (j.up) setTsMsg("Already logged in.");
										else setTsMsg(j.ok ? "Open the link or scan the QR." : j.error || "Could not start login");
									}).finally(() => setTsBusy(false));
								},
								children: "Get Tailscale login"
							}),
							tsMsg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2",
								children: tsMsg
							}) : null,
							box.tailscaleAuth ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									className: "mt-4 block break-all font-display text-2xl text-gold",
									href: box.tailscaleAuth,
									children: box.tailscaleAuth
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
									alt: "Tailscale login",
									className: "mt-3 size-52 rounded-xl bg-white p-2",
									src: `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(box.tailscaleAuth)}`
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									className: "mt-3",
									variant: "ghost",
									onClick: () => {
										fetch("/api/tailscale/check", { method: "POST" });
									},
									children: "I've signed in"
								})
							] }) : box.tailscaleInstalled ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2",
								children: "Installed. Not logged in — tap Get Tailscale login."
							}) : null
						] })
					}) : null
				]
			}) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card$1, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "w-full",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display font-medium",
						children: "Indexers"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: "Optional extra Torznab. Skip is valid — the provider is already the first release source."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "mt-3 h-11 w-full rounded-xl bg-raised px-3 text-sm",
						value: idxName,
						onChange: (e) => setIdxName(e.target.value),
						placeholder: "Name"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "mt-2 h-11 w-full rounded-xl bg-raised px-3 text-sm",
						value: idxUrl,
						onChange: (e) => setIdxUrl(e.target.value),
						placeholder: "https://…"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "mt-2 h-11 w-full rounded-xl bg-raised px-3 text-sm",
						value: idxKey,
						onChange: (e) => setIdxKey(e.target.value),
						placeholder: "API key"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							onClick: () => void addIndexer(),
							children: "Add"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							onClick: () => setIdxMsg("Skipped"),
							children: "Skip"
						})]
					}),
					idxMsg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-xs text-muted",
						children: idxMsg
					}) : null
				]
			}) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-8 flex flex-wrap gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "lg",
					onClick: finish,
					children: "Open ReelOS"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					onClick: finish,
					children: "Skip"
				})]
			})
		]
	});
}
function Card$1({ children, locked }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("mt-4 flex items-start gap-3 rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]", locked && "opacity-50"),
		children
	});
}
function Dot({ state }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("mt-1 size-2.5 shrink-0 rounded-full", state === "green" ? "bg-live" : state === "red" ? "bg-danger" : "bg-gold") });
}
function Provision() {
	if (useReelStore((s) => s.phase) === "ready") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ready, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Building, {});
}
function Building() {
	const build = useReelStore((s) => s.build);
	const open = useReelStore((s) => s.buildLogOpen);
	const done = build.filter((s) => s.status === "done").length;
	const total = build.length || 1;
	build.find((s) => s.status === "running");
	const setPhase = useReelStore((s) => s.setPhase);
	const [provisionErr, setProvisionErr] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		let stop = false;
		const tick = () => {
			fetch("/api/box", { cache: "no-store" }).then((r) => r.json()).then((b) => {
				if (stop) return;
				if (b.provisioned) setPhase("ready");
				if (b.provisionError) setProvisionErr(b.provisionError);
			}).catch(() => {});
		};
		tick();
		const id = window.setInterval(tick, 3e3);
		return () => {
			stop = true;
			window.clearInterval(id);
		};
	}, [setPhase]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative min-h-dvh bg-background px-6 py-8 md:px-10",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				"aria-hidden": true,
				className: "pointer-events-none absolute -left-16 top-10 size-72 rounded-full bg-gold/10 blur-[90px]"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wordmark, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto mt-12 max-w-lg",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-xs tracking-[0.22em] text-gold uppercase",
						children: "Building your stack"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-3 font-display text-3xl font-semibold tracking-tight",
						children: "Standing up ReelOS"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-sm text-muted",
						children: "Waiting for engines. Libraries are not claimed until the box says so."
					}),
					provisionErr ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-sm text-danger",
						children: provisionErr
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-6 h-1 overflow-hidden rounded-full bg-card-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-full bg-gold transition-[width] duration-500 ease-out",
							style: { width: `${done / total * 100}%` }
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
						className: "mt-8 space-y-3",
						children: build.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-start gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDot, { status: s.status }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: cn("text-sm", s.status === "pending" && "text-faint", s.status === "running" && "text-gold-bright", s.status === "done" && "text-foreground"),
									children: s.label
								}), s.status === "running" || s.status === "done" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-0.5 truncate font-mono text-[11px] text-faint",
									children: s.log
								}) : null]
							})]
						}, s.id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "mt-8 flex items-center gap-2 text-xs text-faint hover:text-muted",
						onClick: () => useReelStore.setState({ buildLogOpen: !open }),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: cn("size-3.5 transition-transform", open && "rotate-180") }), "Log"]
					}),
					open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
						className: "mt-3 max-h-48 overflow-auto rounded-xl bg-raised p-4 font-mono text-[11px] leading-relaxed text-muted",
						children: build.filter((s) => s.log).map((s) => `[${s.id}] ${s.log}`).join("\n") || "Waiting for the first step."
					}) : null
				]
			})
		]
	});
}
function StatusDot({ status }) {
	if (status === "done") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "mt-0.5 flex size-5 items-center justify-center rounded-full bg-gold text-gold-fg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
			className: "size-3",
			strokeWidth: 3
		})
	});
	if (status === "running") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mt-0.5 size-5 animate-spin text-gold" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mt-0.5 size-5 rounded-full shadow-[var(--shadow-border)]" });
}
function Ready() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConnectView, {});
}
function ApplyingBar() {
	const update = useReelStore((s) => s.update);
	if (update.status !== "applying") return null;
	const log = update.steps.find((s) => s.log)?.log || update.steps[0]?.log || "";
	const name = update.target || "this update";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border-b border-gold/35 bg-gold/12 px-4 py-2.5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "flex items-center gap-2 text-sm text-gold-bright",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 shrink-0 animate-spin" }),
					"Applying ",
					name,
					". Updating ReelOS — engines are still configuring."
				]
			}),
			log ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-0.5 font-mono text-[11px] text-muted",
				children: log
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/settings",
				className: "mt-1 inline-block text-[12px] text-gold",
				children: "Updates"
			})
		]
	});
}
/** Circuit lanes + one packet while splash/search/grab/Check is working. */
function CircuitFloor({ className }) {
	const busy = useArenaBusy();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		className: cn("arena-circuit pointer-events-none absolute inset-0 h-full w-full text-circuit", className),
		viewBox: "0 0 390 844",
		preserveAspectRatio: "xMidYMid slice",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.15",
				opacity: "0.55",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 72h48l18 18h40" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 110h28l12 12" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M378 72h-52l-16 16h-36" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M378 118h-24l-10 10" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 760h40l16-16h36" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M378 760h-44l-14-14h-28" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M28 200v80l12 12v90" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M362 210v70l-10 10v100" })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
				fill: "currentColor",
				opacity: "0.8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
						cx: "12",
						cy: "72",
						r: "2.2"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
						cx: "78",
						cy: "90",
						r: "2.2"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
						cx: "378",
						cy: "72",
						r: "2.2"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
						cx: "310",
						cy: "88",
						r: "2.2"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
						cx: "12",
						cy: "760",
						r: "2.2"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
						cx: "104",
						cy: "744",
						r: "2.2"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
						cx: "378",
						cy: "760",
						r: "2.2"
					})
				]
			}),
			busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				r: "2.6",
				fill: "currentColor",
				className: "arena-packet",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("animateMotion", {
					dur: "3.6s",
					repeatCount: "indefinite",
					path: "M12 72h48l18 18h40"
				})
			}) : null
		]
	});
}
function useArenaBusy() {
	const phase = useReelStore((s) => s.phase);
	const boot = useReelStore((s) => s.bootSteps);
	const update = useReelStore((s) => s.update);
	const requests = useReelStore((s) => s.requests);
	const shelf = useReelStore((s) => s.shelf);
	if (update.status === "checking") return true;
	if (phase === "splash" || phase === "wizard") return Object.values(boot).some((st) => st === "running");
	return inFlightRequests(requests, { titles: shelf }).some((r) => r.status === "downloading" || /search/i.test(String(r.reason || "")));
}
function LibraryCatchupBar() {
	const catchup = useReelStore((s) => s.libraryCatchup);
	if (useReelStore((s) => s.update.status === "applying")) return null;
	if (!catchupShowsBanner(catchup)) return null;
	const text = catchup.message || (catchup.status === "backoff" ? "TorBox filesystem busy — not copying to disk" : "Library catching up");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative z-20 border-b border-border bg-raised px-3 py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "flex items-center gap-2 text-sm text-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 shrink-0 animate-spin" }), text]
		}), catchup.folder && catchup.total ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-0.5 font-mono text-[11px] text-muted",
			children: [
				"folder ",
				catchup.folder,
				" of ",
				catchup.total,
				catchup.skipped ? ` · ${catchup.skipped} skipped` : "",
				catchup.timeouts ? ` · ${catchup.timeouts} timeouts` : ""
			]
		}) : null]
	});
}
/** Working Jellyfin door: LAN or Tailscale IP:8096, never hostname:8096 (that 302s). */
var V4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
var LOOPBACK = /^(127\.0\.0\.1|localhost|::1)$/i;
function lanV4(raw) {
	const s = String(raw || "").trim();
	if (!V4.test(s) || LOOPBACK.test(s)) return "";
	return s;
}
function jellyfinWatchOrigin(opts = {}) {
	const host = String(opts.hostname || "").trim().replace(/^\[|\]$/g, "");
	if (lanV4(host)) return `http://${host}:8096`;
	const ts = lanV4(opts.tailscaleIp);
	const lan = lanV4(opts.ipv4);
	const fromWatch = String(opts.watch || "").trim().replace(/\/$/, "");
	if ((/\.ts\.net$/i.test(host) || host.startsWith("100.")) && ts) return `http://${ts}:8096`;
	if (lan) return `http://${lan}:8096`;
	const watchHost = fromWatch.replace(/^https?:\/\//i, "").split("/")[0]?.split(":")[0] || "";
	if (/^https?:\/\/\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?$/i.test(fromWatch) && lanV4(watchHost)) return fromWatch;
	if (ts) return `http://${ts}:8096`;
	return "";
}
function jellyfinWatchHref(opts = {}) {
	const origin = jellyfinWatchOrigin(opts);
	if (!origin) return "";
	const id = String(opts.jellyfinId || "").trim();
	if (!id) return origin;
	return `${origin}/web/#/details?id=${encodeURIComponent(id)}`;
}
var STABLE_NAV = [
	{
		to: "/",
		label: "Home",
		icon: House
	},
	{
		to: "/discover",
		label: "Discover",
		icon: Compass
	},
	{
		to: "/requests",
		label: "Requests",
		icon: Clapperboard
	},
	{
		to: "/library",
		label: "Library",
		icon: Library
	},
	{
		to: "/activity",
		label: "Activity",
		icon: Activity
	},
	{
		to: "/settings",
		label: "Settings",
		icon: Settings
	}
];
var ARENA_DESKTOP_NAV = [
	{
		to: "/",
		label: "Home",
		icon: House
	},
	{
		to: "/discover",
		label: "Discover",
		icon: Compass
	},
	{
		to: "/books",
		label: "Books",
		icon: BookOpen
	},
	{
		to: "/requests",
		label: "Requests",
		icon: Clapperboard
	},
	{
		to: "/library",
		label: "Library",
		icon: Library
	},
	{
		to: "/settings",
		label: "Settings",
		icon: Settings
	}
];
var ARENA_PHONE_NAV = [
	{
		to: "/",
		label: "Home",
		icon: House
	},
	{
		to: "/discover",
		label: "Discover",
		icon: Compass
	},
	{
		to: "/books",
		label: "Books",
		icon: BookOpen
	},
	{
		to: "/requests",
		label: "Requests",
		icon: Clapperboard
	},
	{
		to: "/library",
		label: "Library",
		icon: Library
	}
];
function navOn(path, to) {
	if (to === "/") return path === "/";
	return path === to || path.startsWith(`${to}/`);
}
function Shell({ children }) {
	const path = useRouterState({ select: (s) => s.location.pathname });
	const arena = useReelStore((s) => s.settings.betaChannel);
	const frontend = useReelStore((s) => s.answers.frontend);
	const jfLive = useReelStore((s) => s.jellyfinHop?.state === "green");
	const ipv4 = useReelStore((s) => s.ipv4);
	const tailscaleIp = useReelStore((s) => s.tailscaleIp);
	const watch = useReelStore((s) => s.watch);
	const transferring = useReelStore((s) => transferringChipCount(inFlightRequests(s.requests, { titles: s.shelf })));
	const watchHref = jellyfinWatchHref({
		ipv4,
		tailscaleIp,
		watch,
		hostname: typeof window !== "undefined" ? window.location.hostname : ""
	});
	const desktopNav = arena ? ARENA_DESKTOP_NAV : STABLE_NAV;
	const phoneNav = arena ? ARENA_PHONE_NAV : STABLE_NAV.filter((n) => n.to !== "/activity");
	const brand = arena ? "Arena" : "ReelOS";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("min-h-dvh bg-background", arena && "relative overflow-hidden"),
		children: [
			arena ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircuitFloor, { className: "fixed inset-0 z-0 opacity-80" }) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ApplyingBar, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LibraryCatchupBar, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn("md:flex", arena && "relative z-10"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: "relative z-20 hidden w-[220px] shrink-0 flex-col border-r border-border bg-background md:flex",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2.5 px-5 py-5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReelMark, { className: "size-7" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: cn("font-display text-sm font-semibold tracking-[0.18em]", arena ? "text-foreground" : "text-gold"),
								children: brand
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
							className: "flex flex-1 flex-col gap-0.5 px-3",
							children: desktopNav.map((n) => {
								const on = navOn(path, n.to);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
									to: n.to,
									className: cn("flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-150", on ? arena ? "bg-card text-circuit" : "bg-card text-foreground" : "text-muted hover:bg-card/60 hover:text-foreground"),
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(n.icon, { className: "size-4" }),
										n.label,
										n.to === "/requests" && transferring > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: cn("ml-auto font-mono text-[11px] tabular-nums", arena ? "text-circuit" : "text-gold"),
											children: transferring
										}) : null
									]
								}, n.to);
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "px-3 pb-3",
							children: [watchHref ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
								href: watchHref,
								target: "_blank",
								rel: "noreferrer",
								className: cn("mt-1 flex h-11 items-center gap-3 rounded-xl px-3 text-sm text-gold hover:bg-card/60", arena && "justify-center rounded-full bg-gold text-gold-fg hover:bg-gold-bright arena-gold-press"),
								children: [arena ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clapperboard, { className: "size-4" }), "Watch"]
							}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 rounded-xl bg-raised px-3 py-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-mono text-[11px] text-faint",
									children: HOSTNAME
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: cn("mt-1 flex items-center gap-1.5 text-[11px]", jfLive ? arena ? "text-circuit" : "text-live" : "text-muted"),
									children: [
										jfLive ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: cn("size-1.5 rounded-full", arena ? "bg-circuit" : "bg-live"),
											style: { animation: "pulse-live 2s ease infinite" }
										}) : null,
										frontendLabel[frontend],
										jfLive ? " live" : ""
									]
								})]
							})]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex min-w-0 flex-1 flex-col overflow-x-clip pb-[4.5rem] md:pb-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
						className: "relative z-20 flex items-center gap-3 bg-background px-4 pt-4 md:hidden",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReelMark, { className: "size-7" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: cn("font-display text-sm font-semibold tracking-[0.18em]", arena ? "text-foreground" : "text-gold"),
								children: brand
							}),
							watchHref ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href: watchHref,
								target: "_blank",
								rel: "noreferrer",
								className: cn("ml-auto flex h-11 shrink-0 items-center rounded-xl px-3 text-sm font-medium text-gold", arena && "h-8 rounded-full bg-gold px-3 text-xs text-gold-fg arena-gold-press"),
								children: "Watch"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "ml-auto" }),
							arena ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/settings",
								className: "flex size-8 items-center justify-center rounded-lg text-muted",
								"aria-label": "Settings",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, { className: "size-4" })
							}) : null
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
						className: "min-w-0 flex-1",
						children
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/90 backdrop-blur-md md:hidden",
				children: phoneNav.map((n) => {
					const on = navOn(path, n.to);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: n.to,
						className: cn("flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px]", on ? arena ? "text-circuit" : "text-gold" : "text-faint"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(n.icon, { className: "size-5" }), n.label]
					}, n.to);
				})
			})
		]
	});
}
/** Full-screen apply splash. Copy: Updating ReelOS. Fail splash: Update failed, still on previous.
* Honest % is tarball/extract bytes — never a fake climbing percent. */
var STEPS = [
	{
		id: "local",
		label: "Local state"
	},
	{
		id: "house",
		label: "This house"
	},
	{
		id: "library",
		label: "Library"
	},
	{
		id: "requests",
		label: "Requests"
	}
];
function stepLabel(status) {
	if (status === "ok") return "Ready";
	if (status === "fail") return "Still filling";
	if (status === "running") return "Working";
	return "Waiting";
}
function UpdatingSplash() {
	const [tune, setTune] = (0, import_react.useState)("");
	const [progress, setProgress] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		fetch("/api/hardware", { cache: "no-store" }).then((r) => r.json()).then((j) => setTune(j.splashTune || j.summary || "")).catch(() => {});
	}, []);
	(0, import_react.useEffect)(() => {
		let alive = true;
		const tick = () => {
			fetch("/api/update/status", { cache: "no-store" }).then((r) => r.json()).then((j) => {
				if (alive && j.progress) setProgress(j.progress);
			}).catch(() => {});
		};
		tick();
		const id = window.setInterval(tick, 2e3);
		return () => {
			alive = false;
			window.clearInterval(id);
		};
	}, []);
	const pct = typeof progress?.percent === "number" ? progress.percent : null;
	const line = progress?.stalled ? "Download stalled — 0 bytes for 2+ minutes" : progress?.message || "Download, extract, clean leftover builds, restart the door.";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				"aria-hidden": true,
				className: "pointer-events-none absolute left-1/2 top-[28%] size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/12 blur-[120px]"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rise relative",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wordmark, {
					className: "flex-col gap-5",
					markClassName: "size-20",
					spinRing: true
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rise rise-2 mt-8 font-display text-sm tracking-[0.34em] text-gold-bright uppercase",
				children: "Updating ReelOS…"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rise rise-3 mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-muted",
				"aria-live": "polite",
				children: line
			}),
			pct != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rise rise-4 mx-auto mt-4 w-full max-w-xs",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-display text-2xl tabular-nums text-gold-bright",
						children: [pct, "%"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 h-1.5 overflow-hidden rounded-full bg-faint",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-full rounded-full bg-gold",
							style: { width: `${pct}%` }
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-xs text-muted",
						children: "Tarball / extract bytes — not a timer."
					})
				]
			}) : progress?.stageIndex ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "rise rise-4 mx-auto mt-3 max-w-md text-sm text-muted",
				children: [
					progress.label || "Working",
					" · ",
					progress.stageIndex,
					"/",
					progress.stageCount || 7,
					progress.heartbeatAgo ? ` · ${progress.heartbeatAgo}` : ""
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rise rise-4 mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted",
				children: "Browse and request come back when this page lifts."
			}),
			tune ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rise rise-4 mx-auto mt-3 max-w-md text-sm text-gold-bright",
				children: tune
			}) : null
		]
	});
}
function FailedSplash() {
	const continueOnPrevious = () => {
		const cur = useReelStore.getState().update;
		useReelStore.setState({ update: {
			...cur,
			status: "current",
			target: null,
			notes: []
		} });
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				"aria-hidden": true,
				className: "pointer-events-none absolute left-1/2 top-[28%] size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/12 blur-[120px]"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rise relative",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wordmark, {
					className: "flex-col gap-5",
					markClassName: "size-20"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rise rise-2 mt-8 font-display text-sm tracking-[0.34em] text-gold-bright uppercase",
				children: "Update failed, still on previous"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rise rise-3 mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-muted",
				children: "ReelOS did not stamp this update. This box is still the version that was already running. Browse and request still work."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rise rise-4 mt-8",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "lg",
					onClick: continueOnPrevious,
					children: "Continue"
				})
			})
		]
	});
}
function Splash({ compact = false, warming = false, updating = false, failed = false }) {
	const provisioned = useReelStore((s) => s.provisioned);
	const bootSteps = useReelStore((s) => s.bootSteps);
	const catchup = useReelStore((s) => s.libraryCatchup);
	const showWarming = warming || provisioned;
	const libraryLock = catchupLocksHome(catchup);
	const libraryWorking = libraryLock || bootSteps.library === "running";
	const begin = () => {
		useReelStore.getState().setPhase("wizard");
		useReelStore.getState().setWizardStep(1);
	};
	if (updating) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UpdatingSplash, {});
	if (failed) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FailedSplash, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				"aria-hidden": true,
				className: "pointer-events-none absolute left-1/2 top-[28%] size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/12 blur-[120px]"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rise relative",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wordmark, {
					className: "flex-col gap-5",
					markClassName: "size-20",
					spinRing: showWarming && libraryWorking
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rise rise-2 mt-8 font-display text-sm tracking-[0.34em] text-gold-bright uppercase",
				children: "Install. Point. Stream."
			}),
			showWarming ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "rise rise-3 mx-auto mt-10 w-full max-w-xs space-y-3 text-left",
				"aria-busy": "true",
				"aria-live": "polite",
				children: STEPS.map((step) => {
					const status = bootSteps[step.id];
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center justify-between gap-3 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex items-center gap-2.5 text-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-2 rounded-full", status === "ok" && "bg-success", status === "fail" && "bg-muted", status === "running" && "bg-live animate-pulse", status === "pending" && "bg-faint") }), step.label]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-muted",
							children: step.id === "library" && libraryLock ? catchup.message || "Library catching up" : stepLabel(status)
						})]
					}, step.id);
				})
			}) : compact ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "rise rise-3 mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-muted",
				children: [
					"This machine is advertising as ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-foreground",
						children: "reelos.local"
					}),
					". Seven questions. Then a working media house."
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rise rise-4 mt-10 flex flex-col items-center gap-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "lg",
					onClick: begin,
					children: "Begin setup"
				})
			})] })
		]
	});
}
var TESTED_ACCESS = /* @__PURE__ */ new Set(["lan", "tailscale"]);
/** @type {Record<string, string>} */
var UNTESTED_SOURCE_REASON = {
	"real-debrid": "Real-Debrid is untested on this house. Use TorBox.",
	alldebrid: "AllDebrid is untested on this house. Use TorBox.",
	premiumize: "Premiumize is untested on this house. Use TorBox.",
	"local-vpn": "Local + VPN is untested (no VPN credentials; Validate is not a fake OK). Use TorBox."
};
/**
* @param {string} source
* @returns {string | null}
*/
function sourceValidateError(source) {
	if (source === "torbox") return null;
	return UNTESTED_SOURCE_REASON[source] || "Unknown source. Use TorBox.";
}
/**
* @param {string} frontend
* @returns {string | null}
*/
function frontendHonestyError(frontend) {
	if (!frontend || frontend === "jellyfin") return null;
	return "Plex claim is untested on this house. Use Jellyfin.";
}
/**
* @param {string} access
* @returns {string | null}
*/
function accessHonestyError(access) {
	if (!access || TESTED_ACCESS.has(access)) return null;
	return "Cloudflare Tunnel is untested on this house. Use this network or Tailscale.";
}
var TOTAL = 7;
function Wizard() {
	const step = useReelStore((s) => s.wizardStep);
	const answers = useReelStore((s) => s.answers);
	const setStep = useReelStore((s) => s.setWizardStep);
	const startBuild = useReelStore((s) => s.startBuild);
	const [finishErr, setFinishErr] = (0, import_react.useState)("");
	const [finishing, setFinishing] = (0, import_react.useState)(false);
	const [sourceOk, setSourceOk] = (0, import_react.useState)(false);
	const go = (n) => setStep(Math.min(TOTAL, Math.max(1, n)));
	const finish = async () => {
		setFinishErr("");
		setFinishing(true);
		try {
			const j = await (await fetch("/api/provision", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ answers })
			})).json();
			if (!j.ok || j.simulated) {
				setFinishErr(j.error || "Compose did not start");
				setFinishing(false);
				return;
			}
			startBuild();
		} catch (e) {
			setFinishErr(String(e));
			setFinishing(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative min-h-dvh overflow-hidden bg-background",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				"aria-hidden": true,
				className: "pointer-events-none absolute -left-24 top-[-8rem] size-[28rem] rounded-full bg-gold/10 blur-[90px]"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				"aria-hidden": true,
				className: "pointer-events-none absolute -right-20 bottom-[-6rem] size-[22rem] rounded-full bg-live/8 blur-[80px]"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center justify-between px-6 py-5 md:px-10",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wordmark, { markClassName: "size-7" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "font-display text-sm tracking-[0.22em] text-muted tabular-nums",
					children: [
						String(step).padStart(2, "0"),
						" / ",
						String(TOTAL).padStart(2, "0")
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto w-full max-w-3xl px-6 pb-36 pt-4 md:px-8",
				children: [
					step === 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StepStorage, {}),
					step === 2 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StepSource, {
						sourceOk,
						setSourceOk
					}),
					step === 3 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StepIntent, {}),
					step === 4 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StepQuality, {}),
					step === 5 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StepFrontend, {}),
					step === 6 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StepAdmin, {}),
					step === 7 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StepAccess, {})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
				className: "fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/85 px-6 py-4 backdrop-blur-md md:px-10",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex max-w-3xl items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "ghost",
						onClick: () => step === 1 ? useReelStore.getState().setPhase("splash") : go(step - 1),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "size-4" }), "Back"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						onClick: () => {
							if (step < TOTAL) go(step + 1);
							else finish();
						},
						disabled: !canContinue(step, answers, sourceOk) || finishing,
						children: [
							finishing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : null,
							step === TOTAL ? "Finish" : "Continue",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4" })
						]
					})]
				}), finishErr ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mx-auto mt-2 max-w-3xl text-sm text-danger",
					children: finishErr
				}) : null]
			})
		]
	});
}
function canContinue(step, a, sourceOk) {
	if (step === 2) {
		if (sourceValidateError(a.source)) return false;
		return a.apiKey.trim().length >= 10 && sourceOk;
	}
	if (step === 3) {
		const i = a.intent;
		return i.movies || i.tv || i.anime || i.kids || i.music;
	}
	if (step === 5) return !frontendHonestyError(a.frontend);
	if (step === 6) return a.adminName.trim().length >= 2 && a.adminPassword.length >= 8;
	if (step === 7) return !accessHonestyError(a.access);
	return true;
}
function Heading({ kicker, title, sub }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mb-8 rise",
		children: [
			kicker ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-2 font-display text-xs tracking-[0.22em] text-gold uppercase",
				children: kicker
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 max-w-xl text-[15px] leading-relaxed text-muted",
				children: sub
			})
		]
	});
}
function Card({ selected, onClick, children, className, disabled }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		disabled,
		onClick,
		className: cn("relative w-full rounded-2xl p-5 text-left transition-[box-shadow,background-color,transform] duration-150 ease-out", selected ? "bg-gold/8 shadow-[var(--shadow-gold)]" : "bg-card shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]", disabled && "opacity-45", className),
		children: [selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "absolute right-4 top-4 flex size-6 items-center justify-center rounded-full bg-gold text-gold-fg",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
				className: "size-3.5",
				strokeWidth: 3
			})
		}) : null, children]
	});
}
function StepStorage() {
	const mode = useReelStore((s) => s.answers.storageMode);
	const selected = useReelStore((s) => s.answers.selectedDisks);
	const format = useReelStore((s) => s.answers.formatDisks);
	const patch = useReelStore((s) => s.patchAnswers);
	const [disks, setDisks] = (0, import_react.useState)([]);
	(0, import_react.useEffect)(() => {
		fetch("/api/disks", { cache: "no-store" }).then((r) => r.json()).then((j) => setDisks(j.disks || []));
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heading, {
			title: "Where should media live?",
			sub: "The OS disk stays untouched. Extra disks can mount into /srv/media. Formatting a blank data disk needs an explicit confirm."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid gap-3",
			children: [
				{
					id: "debrid",
					title: "Debrid only",
					body: "Virtual library. Almost no disk. Titles appear as soon as the provider has them.",
					icon: Cloud
				},
				{
					id: "local",
					title: "Local disks",
					body: "Download and keep. Best when you want a house that works without the cloud.",
					icon: HardDrive
				},
				{
					id: "both",
					title: "Both",
					body: "Cloud for on-demand. Disk for keepers. The default for most houses.",
					icon: Layers
				}
			].map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				selected: mode === o.id,
				onClick: () => patch({ storageMode: o.id }),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-4 pr-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(o.icon, { className: cn("mt-0.5 size-5", mode === o.id ? "text-gold" : "text-muted") }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-lg font-medium",
						children: o.title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm leading-relaxed text-muted",
						children: o.body
					})] })]
				})
			}, o.id))
		}),
		mode !== "debrid" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-3 text-sm font-medium text-muted",
					children: "Disks for /srv/media"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-2",
					children: disks.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "No extra disks. That is fine."
					}) : disks.map((d) => {
						const on = selected.includes(d.name);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: cn("flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)]", d.os && "opacity-60"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "font-mono text-sm",
								children: ["/dev/", d.name]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs text-muted",
								children: [
									d.size,
									" ",
									d.model,
									" ",
									d.os ? "· OS" : ""
								]
							})] }), d.os ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-faint",
								children: "Not selectable"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "flex items-center gap-2 text-xs text-muted",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "checkbox",
										className: "size-4 accent-gold",
										checked: format.includes(d.name),
										onChange: () => {
											const next = format.includes(d.name) ? format.filter((x) => x !== d.name) : [...format, d.name];
											patch({ formatDisks: next });
										}
									}), "Format"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									variant: on ? "gold" : "ghost",
									onClick: () => {
										const next = on ? selected.filter((x) => x !== d.name) : [...selected, d.name];
										patch({ selectedDisks: next });
									},
									children: on ? "Mounted" : "Use"
								})]
							})]
						}, d.name);
					})
				}),
				format.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-3 flex items-start gap-2 text-sm text-gold-bright",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "mt-0.5 size-4 shrink-0" }),
						"Formatting erases ",
						format.join(", "),
						". The OS disk is never touched here."
					]
				}) : null
			]
		}) : null
	] });
}
function StepSource({ sourceOk, setSourceOk }) {
	const answers = useReelStore((s) => s.answers);
	const patch = useReelStore((s) => s.patchAnswers);
	const [checking, setChecking] = (0, import_react.useState)(false);
	const [err, setErr] = (0, import_react.useState)("");
	const untested = sourceValidateError(answers.source);
	const ping = async () => {
		setChecking(true);
		setSourceOk(false);
		setErr("");
		const key = answers.apiKey.trim();
		try {
			const result = await (await fetch("/api/ping", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					source: answers.source,
					key
				})
			})).json();
			if (result.ok) {
				setSourceOk(true);
				setErr(result.message || "Key accepted");
			} else {
				setSourceOk(false);
				setErr(result.error || "Provider rejected this key.");
			}
		} catch (e) {
			setSourceOk(false);
			setErr(String(e));
		}
		setChecking(false);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heading, {
			title: "Your source",
			sub: "TorBox is the working path on this house. Paste a TorBox key and Validate it before Continue. Other providers stay visible but untested — Validate refuses; there is no fake OK."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid gap-3 sm:grid-cols-2",
			children: SOURCES.map((s) => {
				const blocked = sourceValidateError(s.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					selected: answers.source === s.id,
					onClick: () => {
						patch({ source: s.id });
						setSourceOk(false);
						setErr("");
					},
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start gap-3 pr-6",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: cn("flex size-10 items-center justify-center rounded-lg font-display text-xs tracking-wide", answers.source === s.id ? "bg-gold text-gold-fg" : "bg-card-2 text-muted"),
							children: s.mark
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-display font-medium",
							children: [s.name, blocked ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-2 align-middle font-sans text-[11px] font-medium tracking-normal text-gold-bright",
								children: "Untested"
							}) : null]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm text-muted",
							children: s.blurb
						})] })]
					})
				}, s.id);
			})
		}),
		untested ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-gold-bright",
					children: untested
				}),
				answers.source !== "local-vpn" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					className: "mt-3",
					variant: "ghost",
					onClick: () => void ping(),
					disabled: checking,
					children: [checking ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : null, "Validate"]
				}) : null,
				!sourceOk && err ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-danger",
					children: err
				}) : null
			]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					className: "text-sm text-muted",
					children: "API key"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 flex flex-col gap-2 sm:flex-row",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "password",
						autoComplete: "off",
						placeholder: "Paste TorBox key",
						value: answers.apiKey,
						onChange: (e) => {
							patch({ apiKey: e.target.value });
							setSourceOk(false);
							setErr("");
						},
						className: "h-12 flex-1 rounded-xl bg-card px-4 text-sm shadow-[var(--shadow-border)] placeholder:text-faint"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "ghost",
						onClick: () => void ping(),
						disabled: checking,
						children: [checking ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : null, checking ? "Checking" : "Validate"]
					})]
				}),
				sourceOk ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-success",
					children: err
				}) : null,
				!sourceOk && err ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-danger",
					children: err
				}) : null
			]
		})
	] });
}
function StepIntent() {
	const intent = useReelStore((s) => s.answers.intent);
	const patchIntent = useReelStore((s) => s.patchIntent);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heading, {
		title: "What are you collecting?",
		sub: "We only install engines you need. Movies and TV are on by default. Music never appears unless you ask."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex flex-wrap gap-2",
		children: [
			{
				key: "movies",
				label: "Movies"
			},
			{
				key: "tv",
				label: "TV Shows"
			},
			{
				key: "anime",
				label: "Anime"
			},
			{
				key: "uhd",
				label: "4K"
			},
			{
				key: "kids",
				label: "Kids"
			},
			{
				key: "music",
				label: "Music"
			}
		].map((c) => {
			const on = intent[c.key];
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => patchIntent({ [c.key]: !on }),
				className: cn("h-11 rounded-full px-5 text-sm font-medium transition-colors duration-150", on ? "bg-gold text-gold-fg" : "bg-card text-muted shadow-[var(--shadow-border)]"),
				children: c.label
			}, c.key);
		})
	})] });
}
function StepQuality() {
	const quality = useReelStore((s) => s.answers.quality);
	const patch = useReelStore((s) => s.patchAnswers);
	const anime = useReelStore((s) => s.answers.intent.anime);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heading, {
			title: "Quality floor",
			sub: "Not a lecture. One choice. Anime, if selected, gets its own profile automatically."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid gap-3",
			children: [
				{
					id: "1080p",
					title: "1080p",
					body: "A sane floor. Saves disk and transcode."
				},
				{
					id: "hybrid",
					title: "1080p / 4K when available",
					body: "Keep 1080p. Prefer 4K when the release is clean. Default."
				},
				{
					id: "4k",
					title: "4K only",
					body: "Rejects anything below. Some titles will fail."
				},
				{
					id: "custom",
					title: "Custom",
					body: "Unlocks Advanced later. You do not need this today."
				}
			].map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				selected: quality === o.id,
				onClick: () => patch({ quality: o.id }),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-lg font-medium pr-8",
					children: o.title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted",
					children: o.body
				})]
			}, o.id))
		}),
		anime ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-5 text-sm text-live",
			children: "Anime profile will be applied on the TV engine."
		}) : null
	] });
}
function StepFrontend() {
	const answers = useReelStore((s) => s.answers);
	const patch = useReelStore((s) => s.patchAnswers);
	const opts = [
		{
			id: "jellyfin",
			title: "Jellyfin",
			body: "Open source. Default. No claim token."
		},
		{
			id: "plex",
			title: "Plex",
			body: "Bring a claim token from plex.tv/claim."
		},
		{
			id: "both",
			title: "Both",
			body: "Same libraries. Choose a player when you hit Play."
		}
	];
	const plexUntested = frontendHonestyError(answers.frontend);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heading, {
			title: "Where will you watch?",
			sub: "ReelOS is not a player. Jellyfin is the working path. Plex claim is untested on this house — Continue refuses it."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid gap-3",
			children: opts.map((o) => {
				const blocked = frontendHonestyError(o.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					selected: answers.frontend === o.id,
					onClick: () => patch({ frontend: o.id }),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-display text-lg font-medium pr-8",
						children: [o.title, blocked ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ml-2 align-middle font-sans text-[11px] font-medium tracking-normal text-gold-bright",
							children: "Untested"
						}) : null]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: o.body
					})]
				}, o.id);
			})
		}),
		plexUntested ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-6 text-sm text-gold-bright",
			children: plexUntested
		}) : null
	] });
}
function StepAdmin() {
	const answers = useReelStore((s) => s.answers);
	const patch = useReelStore((s) => s.patchAnswers);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heading, {
		title: "Who is this for?",
		sub: "Create the household admin. One password for the ReelOS shell. Engines inherit it. You will not invent twelve service passwords."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "block",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-sm text-muted",
					children: "Display name"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					className: "mt-2 h-12 w-full rounded-xl bg-card px-4 shadow-[var(--shadow-border)] placeholder:text-faint",
					placeholder: "Ada",
					value: answers.adminName,
					onChange: (e) => patch({ adminName: e.target.value })
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "block",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-sm text-muted",
					children: "Password"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "password",
					className: "mt-2 h-12 w-full rounded-xl bg-card px-4 shadow-[var(--shadow-border)] placeholder:text-faint",
					placeholder: "At least 8 characters",
					value: answers.adminPassword,
					onChange: (e) => patch({ adminPassword: e.target.value })
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-faint",
				children: "Household members can be invited later in Settings."
			})
		]
	})] });
}
function StepAccess() {
	const answers = useReelStore((s) => s.answers);
	const patch = useReelStore((s) => s.patchAnswers);
	const opts = [
		{
			id: "lan",
			title: "This network only",
			body: "reelos.local and the LAN IP. The usual first week."
		},
		{
			id: "tailscale",
			title: "Tailscale",
			body: "We install tailscaled and show an auth URL on Finish."
		},
		{
			id: "cloudflare",
			title: "Cloudflare Tunnel",
			body: "Paste a tunnel token. No inbound ports."
		}
	];
	const cfUntested = accessHonestyError(answers.access);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heading, {
			title: "How will you reach it?",
			sub: "One front door. This network and Tailscale are the working paths. Cloudflare Tunnel is untested — Continue refuses it."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid gap-3",
			children: opts.map((o) => {
				const blocked = accessHonestyError(o.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					selected: answers.access === o.id,
					onClick: () => patch({ access: o.id }),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-display text-lg font-medium pr-8",
						children: [o.title, blocked ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ml-2 align-middle font-sans text-[11px] font-medium tracking-normal text-gold-bright",
							children: "Untested"
						}) : null]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: o.body
					})]
				}, o.id);
			})
		}),
		cfUntested ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-6 text-sm text-gold-bright",
			children: cfUntested
		}) : null
	] });
}
function Gate({ children, chrome = true }) {
	const hydrated = useReelStore((s) => s.hydrated);
	const provisioned = useReelStore((s) => s.provisioned);
	const phase = useReelStore((s) => s.phase);
	const applying = useReelStore((s) => updateLocksUi(s.update.status));
	const failed = useReelStore((s) => s.update.status === "error");
	if (!hydrated) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Splash, { warming: true });
	if (!provisioned || phase === "wizard") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, { to: "/" });
	if (phase === "building") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Provision, {});
	if (applying) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Splash, { updating: true });
	if (failed) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Splash, { failed: true });
	if (!chrome) return children;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { children });
}
/** `/` after hydrate. Never returns null — that was a white screen on the house box. */
function Boot() {
	const hydrated = useReelStore((s) => s.hydrated);
	const provisioned = useReelStore((s) => s.provisioned);
	const phase = useReelStore((s) => s.phase);
	const applying = useReelStore((s) => updateLocksUi(s.update.status));
	const failed = useReelStore((s) => s.update.status === "error");
	if (!hydrated) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Splash, { warming: true });
	if (phase === "wizard") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wizard, {});
	if (phase === "building") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Provision, {});
	if (phase === "ready" && !provisioned) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Provision, {});
	if (provisioned) {
		if (applying) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Splash, { updating: true });
		if (failed) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Splash, { failed: true });
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HomeView, {}) });
	}
	if (phase === "splash") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Splash, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wizard, {});
}
//#endregion
export { RemoveFromBox as a, Gate as i, Button as n, jellyfinWatchHref as o, ConnectView as r, Boot as t };
