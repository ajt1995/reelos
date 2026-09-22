import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, b as useNavigate, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { At as ChevronRight, B as Play, Bt as BookOpen, E as SlidersHorizontal, F as RefreshCw, G as MonitorUp, I as Radio, K as MonitorSmartphone, Lt as BrainCircuit, Mt as ChevronDown, N as RotateCcw, Nt as Check, O as ShieldCheck, Rt as Bookmark, S as Sparkles, St as Coffee, Tt as Clock3, Ut as ArrowLeft, V as Pause, Vt as AudioLines, W as Moon, X as MessageCircle, _t as ExternalLink, b as SunMedium, bt as Copy, c as UsersRound, ct as House, dt as Gauge, et as LoaderCircle, f as Upload, h as TriangleAlert, ht as Film, i as WandSparkles, j as Search, jt as ChevronLeft, lt as Heart, m as Tv, mt as Flame, n as X, nt as Library, o as Volume2, p as Type, s as Users, tt as ListTree, u as UserRound, ut as HardDrive, v as ThumbsDown, vt as Download, w as Smartphone, x as Speaker, xt as Compass, y as Sun, z as Plus, zt as BookmarkCheck } from "../_libs/lucide-react.mjs";
import { C as TITLES, E as cn, X as useReelStore, _ as publicPlaybackPath, b as sourcesForExperienceTitle, f as resolveCompanionSeed, h as isDebridConnected, u as Button, v as sourceForLookupTitle, x as titleCanUseProvider, y as sourceIsAccessible } from "./router-2BoRtkQZ.mjs";
import { n as useExperienceStore, t as activeExperienceProfile } from "./experience-state-BipBJc8l.mjs";
import { t as attachAudioBooster } from "./audio-booster-CEgXQ0KE.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/reelos-world-DIxxmkcq.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var fallbackCounter = 0;
/** Non-authoritative UI identity that also works on plain-HTTP household LANs. */
function createClientId(prefix = "") {
	const webCrypto = globalThis.crypto;
	if (typeof webCrypto?.randomUUID === "function") return `${prefix}${webCrypto.randomUUID()}`;
	const bytes = /* @__PURE__ */ new Uint8Array(16);
	if (typeof webCrypto?.getRandomValues === "function") webCrypto.getRandomValues(bytes);
	else {
		fallbackCounter += 1;
		const seed = `${Date.now().toString(36)}-${fallbackCounter.toString(36)}`;
		for (let index = 0; index < bytes.length; index += 1) bytes[index] = seed.charCodeAt(index % seed.length) ^ index * 29;
	}
	bytes[6] = bytes[6] & 15 | 64;
	bytes[8] = bytes[8] & 63 | 128;
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
	return `${prefix}${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}
var COPY = {
	"taste-ranking": {
		name: "Your taste",
		short: "Learns what feels right for you.",
		detail: "Connects your reactions, favorites, and viewing choices without mixing your private history with anyone else’s."
	},
	"semantic-search": {
		name: "Natural search",
		short: "Understands ideas, feelings, and half-remembered scenes.",
		detail: "Helps ReelOS understand searches such as “that rainy movie with the train” without requiring exact titles."
	},
	"scene-understanding": {
		name: "Scene awareness",
		short: "Evaluates private, spoiler-safe scene context.",
		detail: "This is still being evaluated with edition-matched, spoiler-safe evidence. It cannot yet add inferred scene details to recaps, cast help, or story answers."
	},
	"family-scene-guidance": {
		name: "Family guidance",
		short: "Evaluates scene-by-scene family context.",
		detail: "This is still being evaluated locally and cannot relax or replace a parent’s rules. Current family protection uses the household’s saved boundaries."
	},
	"dialogue-enhancement": {
		name: "Clearer dialogue",
		short: "Evaluates private audio improvements for difficult mixes.",
		detail: "This is not connected to playback yet. Original audio, available tracks, subtitles, and current listening controls remain in use."
	},
	"predictive-preparation": {
		name: "Ready when you are",
		short: "Anticipates what this home may watch next.",
		detail: "Helps prepare the right version ahead of time, within your source access and storage choices, so playback can start with less waiting."
	},
	"storage-optimization": {
		name: "Thoughtful storage",
		short: "Keeps the most useful versions without filling the drive.",
		detail: "Learns this home’s viewing and device patterns to suggest what to retain, resize, or safely release. ReelOS rules still approve every change."
	},
	"machine-protection": {
		name: "Machine care",
		short: "Yields before background work gets in your way.",
		detail: "Watches memory, storage, heat, and playback pressure so optional work can slow down or stop before the experience suffers."
	},
	"interface-protection": {
		name: "A calmer interface",
		short: "Adapts presentation without moving the ground beneath you.",
		detail: "Learns comfortable density and motion preferences while preserving predictable navigation, focus, and accessibility settings."
	},
	"shared-taste-intelligence": {
		name: "Broader discoveries",
		short: "Evaluates privacy-safe discovery beyond this home.",
		detail: "Cross-home sharing is blocked while privacy checks are unfinished. Taste, history, profiles, model files, and raw reactions stay inside this home."
	},
	"release-ranking": {
		name: "Best version",
		short: "Chooses the most suitable available edition for each screen.",
		detail: "Balances quality, compatibility, connection, and storage so ReelOS can select among versions you can actually access."
	}
};
var STATUS = {
	installed: {
		label: "Installed · not checked",
		explanation: "Present on this home, but it has not passed its first local check and cannot influence the experience.",
		tone: "border-white/12 bg-white/5 text-foreground/80"
	},
	validating: {
		label: "Checking locally",
		explanation: "A local check is in progress. It cannot influence the experience unless that check passes.",
		tone: "border-sky-300/20 bg-sky-300/8 text-sky-200"
	},
	learning_locally: {
		label: "Learning · not in use",
		explanation: "Learning privately inside this home, but not making or changing live decisions.",
		tone: "border-violet-300/20 bg-violet-300/8 text-violet-200"
	},
	ready: {
		label: "Ready · not active",
		explanation: "Its local checks passed, but it is not currently influencing the experience.",
		tone: "border-emerald-300/20 bg-emerald-300/8 text-emerald-200"
	},
	active: {
		label: "Active",
		explanation: "Working quietly in the background with ReelOS safety rules still in control.",
		tone: "border-gold/25 bg-gold/10 text-gold"
	},
	paused: {
		label: "Paused",
		explanation: "Temporarily yielding to watching or to the needs of this device.",
		tone: "border-amber-300/20 bg-amber-300/8 text-amber-200"
	},
	unsupported: {
		label: "Not supported here",
		explanation: "This device cannot run it safely right now. The rest of ReelOS continues without it.",
		tone: "border-white/12 bg-white/5 text-muted"
	},
	needs_attention: {
		label: "Needs attention",
		explanation: "A check failed, so ReelOS stopped it instead of guessing.",
		tone: "border-danger/25 bg-danger/8 text-danger"
	},
	disabled: {
		label: "Off",
		explanation: "Turned off for this home. Its deterministic ReelOS fallback remains available.",
		tone: "border-white/10 bg-black/15 text-muted"
	},
	quarantined: {
		label: "Blocked for safety",
		explanation: "Isolated after a safety or integrity check. It cannot influence the experience.",
		tone: "border-danger/25 bg-danger/8 text-danger"
	},
	rolled_back: {
		label: "Previous version restored",
		explanation: "The latest version was withdrawn. Only the last validated behavior may be used.",
		tone: "border-amber-300/20 bg-amber-300/8 text-amber-200"
	}
};
function capabilityCopy(id) {
	if (COPY[id]) return COPY[id];
	return {
		name: id.split(/[-_.:]+/g).filter(Boolean).map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`).join(" ") || "ReelOS capability",
		short: "An optional ability running privately in this home.",
		detail: "ReelOS keeps this ability behind the same validation, privacy, and resource protections as every other capability."
	};
}
function capabilityStatus(state) {
	return STATUS[state] ?? STATUS.needs_attention;
}
function capabilityAction(state) {
	if (state === "active" || state === "validating" || state === "learning_locally") return "disable";
	if (state === "installed" || state === "ready" || state === "paused" || state === "unsupported" || state === "needs_attention" || state === "disabled" || state === "quarantined" || state === "rolled_back") return "revalidate";
	return null;
}
var INFLUENCE = {
	"taste-ranking": builtInRules(),
	"semantic-search": builtInRules(),
	"predictive-preparation": builtInRules(),
	"storage-optimization": builtInRules(),
	"machine-protection": builtInRules(),
	"interface-protection": builtInRules(),
	"release-ranking": builtInRules(),
	"scene-understanding": evaluationOnly(),
	"family-scene-guidance": evaluationOnly(),
	"dialogue-enhancement": evaluationOnly(),
	"shared-taste-intelligence": evaluationOnly()
};
function builtInRules() {
	return {
		state: "built_in_rules",
		label: "Built-in rules in control",
		explanation: "ReelOS uses its dependable built-in behavior for live decisions. Private learning may compare suggestions, but it does not overrule those safeguards."
	};
}
function evaluationOnly() {
	return {
		state: "evaluation_only",
		label: "Evaluation only",
		explanation: "This ability is not connected to user-visible decisions. ReelOS continues with its built-in behavior while local checks continue."
	};
}
function capabilityInfluence(id) {
	return INFLUENCE[id] ?? {
		state: "not_connected",
		label: "Not connected",
		explanation: "ReelOS has not verified how this ability participates in the experience, so it cannot influence live decisions."
	};
}
function capabilityProgress(capabilities) {
	const active = capabilities.filter((item) => item.state === "active").length;
	const checking = capabilities.filter((item) => [
		"installed",
		"validating",
		"learning_locally"
	].includes(item.state)).length;
	return {
		active,
		checking,
		inactive: capabilities.length - active - checking
	};
}
var capabilityIcons = {
	"taste-ranking": Heart,
	"semantic-search": Search,
	"scene-understanding": Film,
	"family-scene-guidance": ShieldCheck,
	"dialogue-enhancement": AudioLines,
	"predictive-preparation": Clock3,
	"storage-optimization": HardDrive,
	"machine-protection": Gauge,
	"interface-protection": MonitorSmartphone,
	"shared-taste-intelligence": UsersRound,
	"release-ranking": Sparkles
};
function AdvancedView({ embedded = false }) {
	const [data, setData] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [error, setError] = (0, import_react.useState)("");
	const [openId, setOpenId] = (0, import_react.useState)(null);
	const [busyId, setBusyId] = (0, import_react.useState)(null);
	const load = (0, import_react.useCallback)(async (signal) => {
		setLoading(true);
		setError("");
		try {
			const response = await fetch("/api/capabilities", {
				cache: "no-store",
				signal
			});
			const body = await response.json();
			if (!response.ok || !body.ok || !Array.isArray(body.capabilities)) throw new Error(body.error || "ReelOS could not read this home’s capabilities.");
			setData(body);
		} catch (caught) {
			if (caught instanceof DOMException && caught.name === "AbortError") return;
			setError(caught instanceof Error ? caught.message : "ReelOS could not read this home’s capabilities.");
		} finally {
			if (!signal?.aborted) setLoading(false);
		}
	}, []);
	(0, import_react.useEffect)(() => {
		const controller = new AbortController();
		load(controller.signal);
		return () => controller.abort();
	}, [load]);
	const counts = (0, import_react.useMemo)(() => capabilityProgress(data?.capabilities ?? []), [data]);
	const runAction = async (capability, action) => {
		setBusyId(capability.id);
		setError("");
		try {
			const response = await fetch(`/api/capabilities/${encodeURIComponent(capability.id)}/${action}`, { method: "POST" });
			const body = await response.json();
			if (!response.ok || !body.ok || !body.capability) throw new Error(response.status === 403 ? "Only the home owner can change this." : body.error || "That change could not be saved.");
			setData((current) => current ? {
				...current,
				capabilities: current.capabilities.map((item) => item.id === body.capability?.id ? body.capability : item)
			} : current);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "That change could not be saved.");
		} finally {
			setBusyId(null);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(embedded ? "div" : "main", {
		className: embedded ? "w-full" : "mx-auto w-full max-w-5xl px-5 pb-28 pt-5 md:px-10 md:pt-8",
		children: [
			!embedded && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: "/settings",
				className: "inline-flex min-h-12 items-center gap-2 rounded-xl px-2 text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-background),0_0_0_4px_var(--color-gold)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "size-4" }), "Settings"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "relative mt-5 overflow-hidden rounded-[2rem] border border-white/8 bg-card/55 px-6 py-8 shadow-[var(--shadow-border)] backdrop-blur-xl md:px-9 md:py-10",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-gold/16 blur-[90px]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative flex items-start gap-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-1 flex size-12 shrink-0 items-center justify-center rounded-full bg-gold/12 text-gold shadow-[0_0_38px_color-mix(in_srgb,var(--color-gold)_30%,transparent)]",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrainCircuit, {
							className: "size-5",
							"aria-hidden": "true"
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "font-display text-3xl font-semibold tracking-tight md:text-4xl",
								children: "Quietly getting better"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-3 max-w-2xl text-sm leading-6 text-muted md:text-base",
								children: "These abilities stay inside your home. Each one must prove it works here before ReelOS lets it shape your experience."
							}),
							!loading && !error && data ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-5 text-sm text-foreground/85",
								"aria-live": "polite",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-medium text-gold",
										children: [counts.active, " active"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "mx-2 text-muted/50",
										children: "·"
									}),
									counts.checking,
									" checking locally",
									counts.inactive ? ` · ${counts.inactive} not active` : ""
								]
							}) : null
						]
					})]
				})]
			}),
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "alert",
				className: "mt-5 rounded-2xl border border-danger/25 bg-danger/8 px-5 py-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-foreground",
					children: error
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					className: "mt-3 min-h-12",
					variant: "ghost",
					onClick: () => void load(),
					children: "Try again"
				})]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-6",
				"aria-label": "ReelOS capabilities",
				"aria-busy": loading,
				children: [
					loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CapabilitySkeleton, {}) : null,
					!loading && !error && data?.capabilities.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "rounded-2xl border border-white/8 bg-card/45 px-6 py-8 text-sm text-muted backdrop-blur-lg",
						children: "No additional capabilities are installed on this home yet."
					}) : null,
					!loading && data?.capabilities.map((capability) => {
						const copy = capabilityCopy(capability.id);
						const status = capabilityStatus(capability.state);
						const influence = capabilityInfluence(capability.id);
						const Icon = capabilityIcons[capability.id] ?? Sparkles;
						const open = openId === capability.id;
						const action = capabilityAction(capability.state);
						const busy = busyId === capability.id;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
							className: "mb-3 overflow-hidden rounded-2xl border border-white/8 bg-card/50 shadow-[var(--shadow-border)] backdrop-blur-lg",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								"aria-expanded": open,
								onClick: () => setOpenId(open ? null : capability.id),
								className: "flex min-h-[76px] w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-white/[0.035] focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--color-gold)] md:px-5",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.045] text-gold",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
											className: "size-5",
											"aria-hidden": "true"
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "min-w-0 flex-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "block font-display text-[15px] font-medium text-foreground md:text-base",
											children: copy.name
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "mt-1 block truncate text-xs text-muted md:text-sm",
											children: copy.short
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: cn("hidden rounded-full border px-3 py-1.5 text-xs font-medium sm:inline-flex", status.tone),
										children: status.label
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180") })
								]
							}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border-t border-white/7 px-4 pb-5 pt-4 md:px-20 md:pr-5",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: cn("inline-flex rounded-full border px-3 py-1.5 text-xs font-medium sm:hidden", status.tone),
										children: status.label
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-3 text-sm leading-6 text-foreground/85 sm:mt-0",
										children: copy.detail
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-2 text-xs leading-5 text-muted",
										children: status.explanation
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-4 rounded-xl border border-white/8 bg-black/15 px-4 py-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-xs font-semibold text-foreground/90",
											children: influence.label
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mt-1 text-xs leading-5 text-muted",
											children: influence.explanation
										})]
									}),
									action ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-4 flex flex-wrap gap-2",
										children: [action === "revalidate" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											className: "min-h-12",
											variant: "ghost",
											disabled: busy,
											onClick: () => void runAction(capability, "revalidate"),
											children: busy ? "Checking…" : "Check again"
										}) : null, action === "disable" || action === "revalidate" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											className: "min-h-12",
											variant: "quiet",
											disabled: busy,
											onClick: () => void runAction(capability, "disable"),
											children: busy ? "Saving…" : "Turn off"
										}) : null]
									}) : null
								]
							}) : null]
						}, capability.id);
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-8 rounded-[2rem] border border-white/8 bg-card/45 px-6 py-7 shadow-[var(--shadow-border)] backdrop-blur-lg md:px-8",
				"aria-labelledby": "later-release-heading",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						id: "later-release-heading",
						className: "font-display text-2xl font-semibold tracking-tight",
						children: "Planned for a later release"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 max-w-2xl text-sm leading-6 text-muted",
						children: "These ideas are not part of the current household release. They are shown here for clarity and cannot be turned on yet."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-5 grid gap-3 md:grid-cols-2",
						children: [
							["Room ambiance", "Connected lights and phone-guided room sound tuning are not available in this release."],
							["Commercial streaming handoff", "Opening titles in commercial streaming apps is not available in this release."],
							["Additional computer platforms", "The household release currently targets Windows and Linux hosts; other computer platforms remain unverified."],
							["Experimental local abilities", "Evaluation-only model packs stay disconnected until their privacy, quality, and resource checks pass."]
						].map(([name, detail]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
							className: "rounded-2xl border border-white/7 bg-black/10 p-5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start justify-between gap-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "font-display text-base font-medium",
									children: name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted",
									children: "Later release"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-3 text-sm leading-6 text-muted",
								children: detail
							})]
						}, name))
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mx-auto mt-7 max-w-2xl text-center text-xs leading-5 text-muted",
				children: "Watching always comes first. Background learning pauses automatically when playback or this device needs the room."
			})
		]
	});
}
function CapabilitySkeleton() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "space-y-3",
		"aria-label": "Loading capabilities",
		children: [
			0,
			1,
			2,
			3
		].map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-h-[76px] animate-pulse items-center gap-4 rounded-2xl border border-white/6 bg-card/40 px-4 py-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-11 rounded-2xl bg-white/6" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "block h-3.5 w-36 rounded bg-white/7" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mt-2 block h-3 w-56 max-w-full rounded bg-white/5" })]
			})]
		}, item))
	});
}
function toStandardEbooksSlug(s) {
	return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function getStandardEbooksCover(title, author) {
	const a = toStandardEbooksSlug(author);
	const t = toStandardEbooksSlug(title);
	if (!a || !t) return null;
	return `https://standardebooks.org/ebooks/${a}/${t}/downloads/cover-thumbnail.jpg`;
}
var JACKET_PALETTES = [
	{
		gradient: "from-[#4c1318] via-[#2c0b0e] to-[#140305]",
		border: "border-red-500/30",
		foil: "text-amber-200",
		accent: "text-amber-300/80",
		spine: "from-black/60 via-black/25 to-transparent"
	},
	{
		gradient: "from-[#0f243c] via-[#0b1726] to-[#04080e]",
		border: "border-sky-500/30",
		foil: "text-sky-200",
		accent: "text-sky-300/80",
		spine: "from-black/60 via-black/25 to-transparent"
	},
	{
		gradient: "from-[#0e3322] via-[#091f15] to-[#030a07]",
		border: "border-emerald-500/30",
		foil: "text-emerald-200",
		accent: "text-emerald-300/80",
		spine: "from-black/60 via-black/25 to-transparent"
	},
	{
		gradient: "from-[#252220] via-[#161413] to-[#0a0908]",
		border: "border-amber-500/30",
		foil: "text-amber-100",
		accent: "text-amber-200/70",
		spine: "from-black/70 via-black/30 to-transparent"
	},
	{
		gradient: "from-[#35153b] via-[#200b24] to-[#0b030d]",
		border: "border-purple-500/30",
		foil: "text-purple-200",
		accent: "text-purple-300/80",
		spine: "from-black/60 via-black/25 to-transparent"
	},
	{
		gradient: "from-[#43230e] via-[#261307] to-[#0f0702]",
		border: "border-amber-600/30",
		foil: "text-amber-200",
		accent: "text-amber-300/80",
		spine: "from-black/60 via-black/25 to-transparent"
	}
];
function paletteFor(title) {
	let hash = 0;
	for (let i = 0; i < title.length; i++) hash = hash * 31 + title.charCodeAt(i) >>> 0;
	return JACKET_PALETTES[hash % JACKET_PALETTES.length];
}
function BookCover({ title, author, coverUrl, format, className, badge }) {
	const [candidateIdx, setCandidateIdx] = (0, import_react.useState)(0);
	const [imageLoaded, setImageLoaded] = (0, import_react.useState)(false);
	const candidates = [];
	if (coverUrl && /^https?:\/\//i.test(coverUrl)) candidates.push(coverUrl);
	const seUrl = getStandardEbooksCover(title, author);
	if (seUrl && !candidates.includes(seUrl)) candidates.push(seUrl);
	const currentSrc = candidates[candidateIdx];
	const hasImage = Boolean(currentSrc);
	const palette = paletteFor(title);
	const handleImageError = () => {
		if (candidateIdx + 1 < candidates.length) setCandidateIdx((prev) => prev + 1);
		else setCandidateIdx(candidates.length);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("group relative aspect-[2/3] w-full overflow-hidden rounded-xl shadow-lg ring-1 ring-border/50 select-none transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] hover:ring-gold/40", className),
		children: [
			hasImage ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: currentSrc,
				alt: `Cover of ${title}`,
				loading: "lazy",
				onLoad: () => setImageLoaded(true),
				onError: handleImageError,
				className: cn("size-full object-cover object-center transition-opacity duration-300", imageLoaded ? "opacity-100" : "opacity-0")
			}) : null,
			!hasImage || !imageLoaded ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn("absolute inset-0 flex flex-col justify-between p-3.5 bg-gradient-to-b transition-all", palette.gradient, palette.border),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-black/30 opacity-70" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative z-10 flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, { className: cn("size-3.5 opacity-60", palette.foil) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider bg-black/40", palette.accent),
							children: format || "EPUB"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: cn("relative z-10 my-auto flex flex-col items-center justify-center rounded-lg border px-2 py-3 text-center backdrop-blur-[1px]", palette.border, "bg-black/25 shadow-inner"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: cn("font-serif text-xs sm:text-sm font-bold tracking-tight leading-snug line-clamp-3 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]", palette.foil),
								children: title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "my-1.5 flex items-center justify-center gap-1 opacity-50",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: cn("text-[8px]", palette.accent),
										children: "✦"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("h-[1px] w-5 bg-current", palette.accent) }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: cn("text-[8px]", palette.accent),
										children: "✦"
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: cn("text-[10px] sm:text-[11px] font-medium tracking-wide uppercase line-clamp-2 opacity-90", palette.accent),
								children: author
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "relative z-10 flex items-center justify-center pt-1",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: cn("text-[8px] font-mono uppercase tracking-[0.2em] opacity-40", palette.foil),
							children: "REELOS LIBRARY"
						})
					})
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: cn("pointer-events-none absolute inset-y-0 left-0 w-3 bg-gradient-to-r z-20", palette.spine) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pointer-events-none absolute inset-y-0 left-1 w-[1px] bg-white/20 z-20 opacity-40" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pointer-events-none absolute inset-y-0 right-0 w-1 bg-gradient-to-l from-black/40 to-transparent z-20" }),
			badge ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute top-2 right-2 z-30",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "rounded-full bg-gold/90 px-2 py-0.5 text-[9px] font-bold tracking-wide text-gold-fg shadow-md",
					children: badge
				})
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20" })
		]
	});
}
var LOCAL_JSZIP_JS = "/vendor/jszip.min.js";
var CDN_JSZIP_JS = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
var LOCAL_EPUB_JS = "/vendor/epub.min.js";
var CDN_EPUB_JS = "https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js";
var LOCAL_PDF_JS = "/vendor/pdf.min.js";
var CDN_PDF_JS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
var LOCAL_PDF_WORKER = "/vendor/pdf.worker.min.js";
var CDN_PDF_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
var THEMES = {
	dark: {
		name: "OLED Noir",
		bg: "#0B0D10",
		fg: "#E4E4E7",
		cardBg: "#12151B",
		border: "#27272A",
		accent: "#E5A93C",
		css: {
			body: {
				background: "#0B0D10 !important",
				color: "#E4E4E7 !important",
				"font-family": "Charter, Georgia, serif !important"
			},
			p: {
				color: "#D4D4D8 !important",
				"line-height": "1.75 !important"
			},
			"h1, h2, h3, h4, h5, h6": { color: "#F4F4F5 !important" },
			"a, a:link, a:visited": { color: "#E5A93C !important" }
		}
	},
	sepia: {
		name: "Warm Sepia",
		bg: "#F5EEDB",
		fg: "#3D2E1E",
		cardBg: "#EFE5CE",
		border: "#DBCDB0",
		accent: "#9A6520",
		css: {
			body: {
				background: "#F5EEDB !important",
				color: "#3D2E1E !important",
				"font-family": "Charter, Georgia, serif !important"
			},
			p: {
				color: "#3D2E1E !important",
				"line-height": "1.75 !important"
			},
			"h1, h2, h3, h4, h5, h6": { color: "#2B1D0E !important" },
			"a, a:link, a:visited": { color: "#9A6520 !important" }
		}
	},
	light: {
		name: "Crisp Paper",
		bg: "#FAFAF9",
		fg: "#1C1917",
		cardBg: "#F5F5F4",
		border: "#E7E5E4",
		accent: "#B45309",
		css: {
			body: {
				background: "#FAFAF9 !important",
				color: "#1C1917 !important",
				"font-family": "Charter, Georgia, serif !important"
			},
			p: {
				color: "#292524 !important",
				"line-height": "1.75 !important"
			},
			"h1, h2, h3, h4, h5, h6": { color: "#1C1917 !important" },
			"a, a:link, a:visited": { color: "#B45309 !important" }
		}
	},
	slate: {
		name: "Midnight Slate",
		bg: "#0F172A",
		fg: "#E2E8F0",
		cardBg: "#1E293B",
		border: "#334155",
		accent: "#38BDF8",
		css: {
			body: {
				background: "#0F172A !important",
				color: "#E2E8F0 !important",
				"font-family": "Charter, Georgia, serif !important"
			},
			p: {
				color: "#CBD5E1 !important",
				"line-height": "1.75 !important"
			},
			"h1, h2, h3, h4, h5, h6": { color: "#F8FAFC !important" },
			"a, a:link, a:visited": { color: "#38BDF8 !important" }
		}
	}
};
var FONT_SIZES = [
	85,
	100,
	115,
	130,
	150
];
function loadScript(src) {
	return new Promise((resolve, reject) => {
		if (document.querySelector(`script[src="${src}"]`)) {
			resolve();
			return;
		}
		const s = document.createElement("script");
		s.src = src;
		s.async = true;
		s.onload = () => resolve();
		s.onerror = () => reject(/* @__PURE__ */ new Error(`Could not load script ${src}`));
		document.head.appendChild(s);
	});
}
async function loadScriptWithFallback(primary, fallback) {
	try {
		await loadScript(primary);
		return primary;
	} catch {
		await loadScript(fallback);
		return fallback;
	}
}
function isPdf(rel) {
	return /\.pdf$/i.test(rel);
}
function BookReader({ book, initialProgress = 0, initialLocation, bookmarks = [], appearance = {
	theme: "dark",
	fontSizeIndex: 1
}, onProgress, onToggleBookmark, onAppearance, onClose }) {
	const host = (0, import_react.useRef)(null);
	const [err, setErr] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [pageLabel, setPageLabel] = (0, import_react.useState)("");
	const [theme, setTheme] = (0, import_react.useState)(appearance.theme);
	const [fontSizeIndex, setFontSizeIndex] = (0, import_react.useState)(appearance.fontSizeIndex);
	const [showControls, setShowControls] = (0, import_react.useState)(false);
	const [showNavigator, setShowNavigator] = (0, import_react.useState)(false);
	const [chapters, setChapters] = (0, import_react.useState)([]);
	const [readerQuery, setReaderQuery] = (0, import_react.useState)("");
	const [searching, setSearching] = (0, import_react.useState)(false);
	const [searchResults, setSearchResults] = (0, import_react.useState)([]);
	const turn = (0, import_react.useRef)(null);
	const renditionRef = (0, import_react.useRef)(null);
	const bookObjectRef = (0, import_react.useRef)(null);
	const pdfDocumentRef = (0, import_react.useRef)(null);
	const textContentRef = (0, import_react.useRef)("");
	const pdfPaintRef = (0, import_react.useRef)(null);
	const currentLocationRef = (0, import_react.useRef)(initialLocation || "");
	const onProgressRef = (0, import_react.useRef)(onProgress);
	const onAppearanceRef = (0, import_react.useRef)(onAppearance);
	(0, import_react.useEffect)(() => {
		onProgressRef.current = onProgress;
		onAppearanceRef.current = onAppearance;
	}, [onProgress, onAppearance]);
	const activeTheme = THEMES[theme];
	const activeFontSize = FONT_SIZES[fontSizeIndex];
	(0, import_react.useEffect)(() => {
		if (!renditionRef.current) return;
		try {
			renditionRef.current.themes.select(theme);
			renditionRef.current.themes.fontSize(`${activeFontSize}%`);
		} catch {}
	}, [theme, activeFontSize]);
	(0, import_react.useEffect)(() => {
		onAppearanceRef.current?.({
			theme,
			fontSizeIndex
		});
	}, [theme, fontSizeIndex]);
	const openLocation = (location) => {
		if (location.startsWith("pdf:")) {
			const page = Number(location.slice(4));
			if (Number.isFinite(page)) pdfPaintRef.current?.(page);
		} else if (location.startsWith("text:")) {
			const offset = Number(location.slice(5));
			const targets = [...host.current?.querySelectorAll("[data-text-offset]") ?? []];
			targets.reduce((nearest, candidate) => Number(candidate.dataset.textOffset) <= offset ? candidate : nearest, targets[0])?.scrollIntoView({ block: "start" });
			currentLocationRef.current = location;
		} else renditionRef.current?.display(location);
		setShowNavigator(false);
	};
	const searchInside = async () => {
		const needle = readerQuery.trim().toLowerCase();
		if (!needle) return;
		setSearching(true);
		setSearchResults([]);
		try {
			if (textContentRef.current) {
				const text = textContentRef.current;
				const matches = [];
				let from = 0;
				while (matches.length < 30) {
					const at = text.toLowerCase().indexOf(needle, from);
					if (at < 0) break;
					matches.push({
						label: `Match ${matches.length + 1}`,
						location: `text:${at}`,
						excerpt: text.slice(Math.max(0, at - 45), at + needle.length + 70)
					});
					from = at + Math.max(1, needle.length);
				}
				setSearchResults(matches);
			} else if (pdfDocumentRef.current) {
				const doc = pdfDocumentRef.current;
				const matches = [];
				for (let pageNumber = 1; pageNumber <= doc.numPages && matches.length < 30; pageNumber += 1) {
					const text = (await (await doc.getPage(pageNumber)).getTextContent()).items.map((item) => item.str || "").join(" ");
					const at = text.toLowerCase().indexOf(needle);
					if (at >= 0) matches.push({
						label: `Page ${pageNumber}`,
						location: `pdf:${pageNumber}`,
						excerpt: text.slice(Math.max(0, at - 45), at + needle.length + 70)
					});
				}
				setSearchResults(matches);
			} else if (bookObjectRef.current) {
				const bookObject = bookObjectRef.current;
				const items = bookObject.spine?.spineItems || bookObject.spine?.items || [];
				const matches = [];
				for (const item of items) {
					if (matches.length >= 30) break;
					await item.load(bookObject.load.bind(bookObject));
					const found = item.find(needle) || [];
					for (const hit of found.slice(0, 5)) matches.push({
						label: hit.excerpt || "Match",
						location: hit.cfi,
						excerpt: hit.excerpt
					});
					item.unload?.();
				}
				setSearchResults(matches.slice(0, 30));
			}
		} finally {
			setSearching(false);
		}
	};
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		let cleanupTextScroll;
		const src = `/api/books/file?rel=${encodeURIComponent(book.rel)}&inline=1`;
		const node = host.current;
		if (!node) return;
		const run = async () => {
			setLoading(true);
			setErr(null);
			try {
				if (/\.txt$/i.test(book.rel)) {
					const response = await fetch(src);
					if (!response.ok) throw new Error(`Could not load text file (${response.status})`);
					const text = await response.text();
					if (cancelled) return;
					textContentRef.current = text;
					const lines = text.split(/\r?\n/);
					const fragment = document.createDocumentFragment();
					const textChapters = [];
					let offset = 0;
					for (const line of lines) {
						const element = document.createElement(/^\s*(chapter|part)\b/i.test(line) ? "h2" : "p");
						element.textContent = line || " ";
						element.dataset.textOffset = String(offset);
						element.className = element.tagName === "H2" ? "mb-4 mt-10 font-display text-2xl font-semibold first:mt-0" : "mb-4 whitespace-pre-wrap leading-8";
						if (element.tagName === "H2") textChapters.push({
							label: line.trim(),
							href: `text:${offset}`
						});
						fragment.appendChild(element);
						offset += line.length + 1;
					}
					node.innerHTML = "";
					node.className = "size-full overflow-y-auto px-6 py-8 sm:px-12";
					const article = document.createElement("article");
					article.className = "mx-auto max-w-3xl";
					article.appendChild(fragment);
					node.appendChild(article);
					setChapters(textChapters);
					const initialOffset = initialLocation?.startsWith("text:") ? Number(initialLocation.slice(5)) : 0;
					currentLocationRef.current = `text:${Number.isFinite(initialOffset) ? initialOffset : 0}`;
					const reportPosition = () => {
						const max = Math.max(1, node.scrollHeight - node.clientHeight);
						const progress = Math.max(0, Math.min(1, node.scrollTop / max));
						const location = `text:${Math.round(progress * Math.max(0, text.length - 1))}`;
						currentLocationRef.current = location;
						setPageLabel(`${Math.round(progress * 100)}%`);
						onProgressRef.current?.(progress, location);
					};
					node.addEventListener("scroll", reportPosition, { passive: true });
					cleanupTextScroll = () => node.removeEventListener("scroll", reportPosition);
					turn.current = {
						next: () => node.scrollBy({
							top: node.clientHeight * .85,
							behavior: "smooth"
						}),
						prev: () => node.scrollBy({
							top: -node.clientHeight * .85,
							behavior: "smooth"
						})
					};
					if (initialOffset > 0) {
						const progress = initialOffset / Math.max(1, text.length - 1);
						node.scrollTop = progress * Math.max(0, node.scrollHeight - node.clientHeight);
					}
					reportPosition();
					if (!cancelled) setLoading(false);
					return;
				}
				if (isPdf(book.rel)) {
					await loadScriptWithFallback(LOCAL_PDF_JS, CDN_PDF_JS);
					const pdfjsLib = window.pdfjsLib;
					if (!pdfjsLib) throw new Error("PDF.js did not load");
					try {
						const workerRes = await fetch(LOCAL_PDF_WORKER, { method: "HEAD" });
						pdfjsLib.GlobalWorkerOptions.workerSrc = workerRes.ok ? LOCAL_PDF_WORKER : CDN_PDF_WORKER;
					} catch {
						pdfjsLib.GlobalWorkerOptions.workerSrc = CDN_PDF_WORKER;
					}
					const doc = await pdfjsLib.getDocument(src).promise;
					if (cancelled) return;
					pdfDocumentRef.current = doc;
					const savedPdfPage = initialLocation?.startsWith("pdf:") ? Number(initialLocation.slice(4)) : 0;
					let pageNum = Math.max(1, Math.min(doc.numPages, savedPdfPage || Math.round(initialProgress * Math.max(1, doc.numPages - 1)) + 1));
					const canvas = document.createElement("canvas");
					canvas.className = "mx-auto max-h-[calc(100dvh-7rem)] w-full max-w-3xl shadow-2xl rounded-lg";
					node.innerHTML = "";
					node.appendChild(canvas);
					const paint = async (n) => {
						pageNum = Math.max(1, Math.min(doc.numPages, n));
						const page = await doc.getPage(pageNum);
						const unscaled = page.getViewport({ scale: 1 });
						const scale = Math.min(node.clientWidth || 360, 800) / unscaled.width;
						const viewport = page.getViewport({ scale });
						canvas.width = viewport.width;
						canvas.height = viewport.height;
						const ctx = canvas.getContext("2d");
						if (!ctx) return;
						await page.render({
							canvasContext: ctx,
							viewport
						}).promise;
						const location = `pdf:${pageNum}`;
						currentLocationRef.current = location;
						setPageLabel(`${pageNum} / ${doc.numPages}`);
						onProgressRef.current?.(doc.numPages <= 1 ? 1 : (pageNum - 1) / (doc.numPages - 1), location);
					};
					pdfPaintRef.current = paint;
					turn.current = {
						next: () => {
							if (pageNum < doc.numPages) {
								pageNum += 1;
								paint(pageNum);
							}
						},
						prev: () => {
							if (pageNum > 1) {
								pageNum -= 1;
								paint(pageNum);
							}
						}
					};
					await paint(pageNum);
					if (!cancelled) setLoading(false);
					return;
				}
				await loadScriptWithFallback(LOCAL_JSZIP_JS, CDN_JSZIP_JS);
				await loadScriptWithFallback(LOCAL_EPUB_JS, CDN_EPUB_JS);
				const ePub = window.ePub;
				if (!ePub) throw new Error("EPUB.js did not load");
				const fileRes = await fetch(src);
				if (!fileRes.ok) throw new Error(`Could not load book file (${fileRes.status})`);
				const fileBuffer = await fileRes.arrayBuffer();
				if (cancelled) return;
				node.innerHTML = "";
				const bookObj = ePub(fileBuffer);
				bookObjectRef.current = bookObj;
				bookObj.on?.("openFailed", (error) => {
					if (!cancelled) {
						setLoading(false);
						setErr("This file is unreadable or not a valid EPUB archive. Try re-downloading or sideloading a DRM-free copy.");
					}
				});
				const rendition = bookObj.renderTo(node, {
					width: "100%",
					height: "100%",
					spread: "none",
					allowScriptedContent: false
				});
				renditionRef.current = rendition;
				rendition.hooks?.content?.register((contents) => {
					const doc = contents?.document;
					if (!doc) return;
					const style = doc.createElement("style");
					style.textContent = `
            [style*="-999"],
            [style*="9999px"],
            section[epub\\:type~="titlepage"] h1,
            section[epub\\:type~="titlepage"] p,
            section[epub\\:type~="colophon"] h2,
            section[epub\\:type~="imprint"] h2,
            .epub-type-contains-word-titlepage h1,
            .epub-type-contains-word-titlepage p,
            .epub-type-contains-word-colophon h2,
            .epub-type-contains-word-imprint h2,
            .sr-only,
            .visually-hidden {
              display: none !important;
            }
          `;
					doc.head?.appendChild(style);
				});
				Object.entries(THEMES).forEach(([key, cfg]) => {
					rendition.themes.register(key, cfg.css);
				});
				rendition.themes.select(theme);
				rendition.themes.fontSize(`${activeFontSize}%`);
				rendition.on?.("rendered", () => {
					if (!cancelled) setLoading(false);
				});
				const navigation = await bookObj.loaded.navigation;
				const flattenToc = (items) => (items || []).flatMap((item) => [{
					label: String(item.label || "Chapter").trim(),
					href: item.href
				}, ...flattenToc(item.subitems || [])]);
				setChapters(flattenToc(navigation?.toc || []).filter((item) => item.href));
				const displayPromise = rendition.display(initialLocation || void 0);
				const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(/* @__PURE__ */ new Error("Reader timed out loading the document.")), 15e3));
				await Promise.race([displayPromise, timeoutPromise]);
				if (cancelled) {
					bookObj.destroy?.();
					return;
				}
				setLoading(false);
				turn.current = {
					next: () => void rendition.next(),
					prev: () => void rendition.prev()
				};
				const updateLocation = (location) => {
					if (!location?.start) return;
					const d = location.start.displayed;
					const spineTotal = bookObj?.spine?.length || (bookObj?.spine?.items?.length ?? 0);
					const spineIdx = location.start.index;
					const savedLocation = location.start.cfi;
					if (savedLocation) currentLocationRef.current = savedLocation;
					const sectionProgress = d?.total ? Math.max(0, (Number(d.page || 1) - 1) / Math.max(1, Number(d.total))) : 0;
					const progress = typeof location.start.percentage === "number" && location.start.percentage > 0 ? location.start.percentage : Math.max(0, Math.min(1, ((Number(spineIdx) || 0) + sectionProgress) / Math.max(1, spineTotal)));
					onProgressRef.current?.(progress, savedLocation);
					if (d && d.total > 1) setPageLabel(`p. ${d.page} / ${d.total}${spineTotal > 1 && spineIdx !== void 0 ? ` · Sec ${spineIdx + 1}/${spineTotal}` : ""}`);
					else if (spineTotal > 1 && spineIdx !== void 0) setPageLabel(`Section ${spineIdx + 1} / ${spineTotal}`);
					else if (d) setPageLabel(`${d.page} / ${d.total}`);
				};
				updateLocation(rendition.currentLocation?.());
				rendition.on("relocated", updateLocation);
				rendition.on("displayedError", () => {
					setErr("This file is DRM-protected (Adobe/LCP) or unreadable. ReelOS reads DRM-free EPUB and PDF only.");
				});
			} catch (e) {
				if (!cancelled) {
					console.error("Book reader failed", e);
					setLoading(false);
					setErr(String(e).includes("DRM") || String(e).toLowerCase().includes("encrypt") ? "This file is DRM-protected (Adobe/LCP). ReelOS reads DRM-free EPUB and PDF only." : String(e).includes("timed out") ? "Reader timed out loading this book. The file may be corrupt or invalid. Try downloading the file to your device." : "Could not open that file in the in-app reader. Download it for iOS Books / Android, or sideload a DRM-free EPUB/PDF.");
				}
			}
		};
		run();
		return () => {
			cancelled = true;
			cleanupTextScroll?.();
			turn.current = null;
			renditionRef.current = null;
			bookObjectRef.current = null;
			pdfDocumentRef.current = null;
			textContentRef.current = "";
			pdfPaintRef.current = null;
			if (node) node.innerHTML = "";
		};
	}, [
		book.rel,
		initialLocation,
		initialProgress
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 z-50 flex flex-col transition-colors duration-300 select-none",
		style: {
			backgroundColor: activeTheme.bg,
			color: activeTheme.fg
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center justify-between gap-2 border-b px-3 sm:px-5 py-2.5 shadow-sm transition-colors",
				style: {
					borderColor: activeTheme.border,
					backgroundColor: activeTheme.cardBg
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "quiet",
						size: "icon",
						"aria-label": "Close reader",
						onClick: onClose,
						className: "hover:opacity-75",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate text-xs sm:text-sm font-semibold",
							children: book.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate text-[11px] opacity-75",
							children: book.author
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-1.5 sm:gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "icon",
							disabled: !currentLocationRef.current,
							onClick: () => onToggleBookmark?.(currentLocationRef.current),
							"aria-label": bookmarks.includes(currentLocationRef.current) ? "Remove bookmark" : "Add bookmark",
							title: "Bookmark this place",
							children: bookmarks.includes(currentLocationRef.current) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookmarkCheck, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bookmark, { className: "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "ghost",
							size: "sm",
							onClick: () => setShowNavigator((value) => !value),
							className: "h-8 gap-1.5 px-2.5 text-xs rounded-xl border border-border/50",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ListTree, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "hidden sm:inline",
								children: "Find"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "ghost",
							size: "sm",
							onClick: () => setShowControls((v) => !v),
							className: "h-8 gap-1.5 px-2.5 text-xs rounded-xl border border-border/50",
							title: "Appearance & Typography",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Type, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "hidden sm:inline",
								children: "Theme"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							className: "inline-flex h-8 items-center rounded-xl bg-gold px-3 text-xs font-semibold text-gold-fg shadow-sm hover:opacity-90 transition-opacity",
							href: `/api/books/file?rel=${encodeURIComponent(book.rel)}`,
							download: true,
							title: "Download DRM-free file to device",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "mr-1.5 size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "hidden sm:inline",
								children: "Download"
							})]
						})
					]
				})]
			}),
			showControls ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-b px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs transition-colors",
				style: {
					borderColor: activeTheme.border,
					backgroundColor: activeTheme.cardBg
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[11px] opacity-70 uppercase tracking-wider font-semibold",
						children: "Theme:"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-1.5",
						children: Object.keys(THEMES).map((tKey) => {
							const tCfg = THEMES[tKey];
							const isCurrent = theme === tKey;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setTheme(tKey),
								className: "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all shadow-sm",
								style: {
									backgroundColor: tCfg.bg,
									color: tCfg.fg,
									borderColor: isCurrent ? tCfg.accent : tCfg.border,
									boxShadow: isCurrent ? `0 0 0 1px ${tCfg.accent}` : "none"
								},
								children: [tKey === "dark" || tKey === "slate" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, { className: "size-3" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sun, { className: "size-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: tCfg.name })]
							}, tKey);
						})
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[11px] opacity-70 uppercase tracking-wider font-semibold",
						children: "Text Size:"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1 bg-background/50 rounded-lg p-0.5 border border-border/60",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: fontSizeIndex <= 0,
								onClick: () => setFontSizeIndex((i) => Math.max(0, i - 1)),
								className: "px-2 py-0.5 rounded text-xs font-bold disabled:opacity-30 hover:bg-card",
								title: "Decrease font size",
								children: "A-"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "px-2 font-mono text-[11px] font-semibold",
								children: [activeFontSize, "%"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: fontSizeIndex >= FONT_SIZES.length - 1,
								onClick: () => setFontSizeIndex((i) => Math.min(FONT_SIZES.length - 1, i + 1)),
								className: "px-2 py-0.5 rounded text-xs font-bold disabled:opacity-30 hover:bg-card",
								title: "Increase font size",
								children: "A+"
							})
						]
					})]
				})]
			}) : null,
			showNavigator ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "max-h-[45dvh] overflow-y-auto border-b px-4 py-4 text-sm",
				style: {
					borderColor: activeTheme.border,
					backgroundColor: activeTheme.cardBg
				},
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto grid max-w-5xl gap-5 md:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-2 text-xs font-semibold uppercase tracking-wider opacity-65",
						children: "Chapters and bookmarks"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1",
						children: [
							bookmarks.map((location, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => openLocation(location),
								className: "block min-h-11 w-full rounded-lg px-3 text-left hover:bg-white/10",
								children: ["Bookmark ", index + 1]
							}, location)),
							chapters.map((chapter) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => openLocation(chapter.href),
								className: "block min-h-11 w-full rounded-lg px-3 text-left hover:bg-white/10",
								children: chapter.label
							}, `${chapter.href}-${chapter.label}`)),
							!bookmarks.length && !chapters.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "py-3 opacity-60",
								children: "No chapter list or bookmarks yet."
							}) : null
						]
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mb-2 text-xs font-semibold uppercase tracking-wider opacity-65",
							children: "Search this book"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							className: "flex gap-2",
							onSubmit: (event) => {
								event.preventDefault();
								searchInside();
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: readerQuery,
								onChange: (event) => setReaderQuery(event.target.value),
								placeholder: "A name, place, or phrase",
								className: "min-h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-black/15 px-3 outline-none focus:border-white/40"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "submit",
								disabled: searching || !readerQuery.trim(),
								className: "grid min-h-11 min-w-11 place-items-center rounded-xl border border-white/15 disabled:opacity-40",
								"aria-label": "Search this book",
								children: searching ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 space-y-1",
							children: [searchResults.map((result, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => openLocation(result.location),
								className: "block min-h-11 w-full rounded-lg px-3 py-2 text-left hover:bg-white/10",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "line-clamp-2",
									children: result.excerpt || result.label
								})
							}, `${result.location}-${index}`)), !searching && readerQuery && !searchResults.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "py-3 opacity-60",
								children: "No matches in this book yet."
							}) : null]
						})
					] })]
				})
			}) : null,
			err ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-1 items-center justify-center p-6 text-center",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "max-w-md space-y-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-danger font-medium",
						children: err
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs opacity-75",
						children: "You can still download this file and open it in your native reader (Apple Books, Kindle app, Moon+ Reader, or ReadEra)."
					})]
				})
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative min-h-0 flex-1 overflow-hidden",
				children: [loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-7 animate-spin text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-medium text-muted",
						children: "Opening book…"
					})]
				}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					ref: host,
					className: "size-full overflow-hidden transition-colors",
					style: { backgroundColor: activeTheme.bg }
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
				className: "flex items-center justify-between gap-2 border-t px-4 sm:px-6 py-2.5 shadow-sm transition-colors",
				style: {
					borderColor: activeTheme.border,
					backgroundColor: activeTheme.cardBg
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "live",
						size: "sm",
						onClick: () => turn.current?.prev(),
						className: "rounded-xl px-3 font-semibold",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "size-4 mr-1" }), " Prev"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs font-mono font-medium opacity-75",
						children: pageLabel || " "
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "live",
						size: "sm",
						onClick: () => turn.current?.next(),
						className: "rounded-xl px-3 font-semibold",
						children: ["Next ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4 ml-1" })]
					})
				]
			})
		]
	});
}
function readParam() {
	if (typeof window === "undefined") return "";
	return new URLSearchParams(window.location.search).get("read") || "";
}
function BooksView({ initialQuery = "", bookProgress = {}, bookLocations = {}, bookBookmarks = {}, readingAppearance = {
	theme: "dark",
	fontSizeIndex: 1
}, onProgress, onToggleBookmark, onAppearance }) {
	useReelStore((s) => s.settings.betaChannel);
	const [query, setQuery] = (0, import_react.useState)("");
	const [searching, setSearching] = (0, import_react.useState)(false);
	const [searched, setSearched] = (0, import_react.useState)(false);
	const [results, setResults] = (0, import_react.useState)([]);
	const [licensed, setLicensed] = (0, import_react.useState)([]);
	const [honesty, setHonesty] = (0, import_react.useState)("");
	const [catalog, setCatalog] = (0, import_react.useState)([]);
	const [featuredLicensed, setFeaturedLicensed] = (0, import_react.useState)([]);
	const [unavailable, setUnavailable] = (0, import_react.useState)([]);
	const [shelf, setShelf] = (0, import_react.useState)(null);
	const [shelfFilter, setShelfFilter] = (0, import_react.useState)("all");
	const [downloading, setDownloading] = (0, import_react.useState)({});
	const [downloaded, setDownloaded] = (0, import_react.useState)({});
	const [errors, setErrors] = (0, import_react.useState)({});
	const [reading, setReading] = (0, import_react.useState)(null);
	const [sideloadMsg, setSideloadMsg] = (0, import_react.useState)("");
	const fileRef = (0, import_react.useRef)(null);
	const searchAbortRef = (0, import_react.useRef)(null);
	const initialQueryRef = (0, import_react.useRef)("");
	const refreshShelf = () => fetch("/api/books/library", { cache: "no-store" }).then((r) => r.json()).then((j) => setShelf(j.books || [])).catch(() => setShelf([]));
	(0, import_react.useEffect)(() => {
		refreshShelf();
		fetch("/api/books/discover", { cache: "no-store" }).then((r) => r.json()).then((j) => {
			setCatalog(j.featured || []);
			setFeaturedLicensed(j.licensed || []);
			if (j.unavailable?.length) setUnavailable(j.unavailable);
		}).catch(() => setCatalog([]));
	}, []);
	(0, import_react.useEffect)(() => {
		const rel = readParam();
		if (!rel || !shelf) return;
		const hit = shelf.find((b) => b.rel === rel);
		if (hit) setReading(hit);
	}, [shelf]);
	const handleSearch = async (requestedQuery = query) => {
		const nextQuery = requestedQuery.trim();
		if (!nextQuery) return;
		setQuery(nextQuery);
		searchAbortRef.current?.abort();
		const ctrl = new AbortController();
		searchAbortRef.current = ctrl;
		setSearching(true);
		setErrors((prev) => ({
			...prev,
			__search: ""
		}));
		try {
			const data = await fetch(`/api/books/search?q=${encodeURIComponent(nextQuery)}`, {
				cache: "no-store",
				signal: ctrl.signal
			}).then((r) => r.json());
			setResults(data.results ?? []);
			setLicensed(data.licensed ?? []);
			setUnavailable(data.unavailable ?? []);
			setHonesty(data.honesty ?? "");
		} catch (err) {
			if (err?.name === "AbortError") return;
			setResults([]);
			setLicensed([]);
			setUnavailable([]);
			setHonesty("");
			setErrors((prev) => ({
				...prev,
				__search: "Search is unavailable right now. Your personal shelf is still here."
			}));
		} finally {
			if (searchAbortRef.current === ctrl) {
				setSearching(false);
				setSearched(true);
			}
		}
	};
	(0, import_react.useEffect)(() => {
		const next = initialQuery.trim();
		if (!next || initialQueryRef.current === next) return;
		initialQueryRef.current = next;
		handleSearch(next);
	}, [initialQuery]);
	const handleReadOrDownload = async (book, action = "read") => {
		if (action === "read" && shelf) {
			const existing = shelf.find((b) => b.title.toLowerCase() === book.title.toLowerCase() || b.rel && book.title && b.rel.toLowerCase().includes(book.title.toLowerCase()));
			if (existing) {
				setReading(existing);
				return;
			}
		}
		setDownloading((prev) => ({
			...prev,
			[book.id]: true
		}));
		setErrors((prev) => ({
			...prev,
			[book.id]: ""
		}));
		try {
			const res = await fetch("/api/books/download", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ book })
			}).then((r) => r.json());
			if (!res.ok && !res.rel) {
				setErrors((prev) => ({
					...prev,
					[book.id]: res.error ?? "Download failed."
				}));
				return;
			}
			setDownloaded((prev) => ({
				...prev,
				[book.id]: true
			}));
			if (action === "download") {
				const href = res.rel ? `/api/books/file?rel=${encodeURIComponent(res.rel)}` : `/api/books/file?url=${encodeURIComponent(book.downloadUrl)}`;
				const a = document.createElement("a");
				a.href = href;
				a.download = res.filename || `${book.title}.epub`;
				document.body.appendChild(a);
				a.click();
				a.remove();
			}
			const lib = await fetch("/api/books/library", { cache: "no-store" }).then((r) => r.json());
			setShelf(lib.books || []);
			if (res.rel) {
				const saved = (lib.books || []).find((b) => b.rel === res.rel);
				if (saved && action === "read") setReading(saved);
			}
		} catch {
			setErrors((prev) => ({
				...prev,
				[book.id]: "Download failed."
			}));
		} finally {
			setDownloading((prev) => ({
				...prev,
				[book.id]: false
			}));
		}
	};
	const handleSideload = async (file) => {
		setSideloadMsg("");
		const body = await file.arrayBuffer();
		const res = await fetch("/api/books/sideload", {
			method: "POST",
			headers: {
				"Content-Type": file.type || "application/octet-stream",
				"X-Book-Filename": file.name
			},
			body
		}).then((r) => r.json());
		if (!res.ok || !res.rel) {
			setSideloadMsg(res.error || "Sideload failed.");
			return;
		}
		setSideloadMsg("Saved to shelf. Opening in reader.");
		await refreshShelf();
		setReading({
			title: file.name.replace(/\.(epub|pdf|txt)$/i, ""),
			author: "Unknown Author",
			rel: res.rel,
			bytes: file.size
		});
	};
	const renderOpenGrid = (books, titlePrefix = "") => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6",
		children: books.map((book) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "group flex flex-col justify-between rounded-2xl border border-border/50 bg-card/60 p-3 shadow-md backdrop-blur-sm transition-all duration-200 hover:border-gold/40 hover:bg-card hover:shadow-xl",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookCover, {
				title: book.title,
				author: book.author,
				coverUrl: book.cover,
				format: book.format,
				badge: downloaded[book.id] ? "Saved" : void 0
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "line-clamp-1 font-display text-xs sm:text-sm font-semibold text-foreground group-hover:text-gold transition-colors",
						title: book.title,
						children: book.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-0.5 line-clamp-1 text-[11px] text-muted",
						title: book.author,
						children: [book.author, book.year ? ` · ${book.year}` : ""]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-1 flex items-center gap-1.5 text-[10px] text-faint",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: book.source }), book.format ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono uppercase",
							children: book.format
						})] }) : null]
					})
				]
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 pt-2 border-t border-border/40 flex items-center gap-1.5",
				children: [
					errors[book.id] ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-2 text-[10px] text-danger",
						children: errors[book.id]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "gold",
						size: "sm",
						disabled: downloading[book.id],
						onClick: () => void handleReadOrDownload(book, "read"),
						className: "h-8 flex-1 rounded-xl text-xs font-semibold transition-all shadow-sm",
						title: "Read book directly in browser",
						children: [downloading[book.id] ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 animate-spin mr-1.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, { className: "size-3.5 mr-1.5" }), "Read"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "icon",
						disabled: downloading[book.id],
						onClick: () => void handleReadOrDownload(book, "download"),
						className: "size-8 rounded-xl border border-border/60 hover:text-gold hover:border-gold/40 transition-colors",
						title: "Download EPUB file to device",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-3.5" })
					})
				]
			})]
		}, book.id))
	});
	const renderLicensedGrid = (items, label) => items.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-8 space-y-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-baseline justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-sm sm:text-base font-semibold tracking-wide text-foreground",
					children: label
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-[11px] text-muted",
					children: "Legal storefronts & libraries"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted leading-relaxed",
				children: honesty || "Available from booksellers and libraries. If you already own a compatible copy, you can add it to your shelf."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6 pt-2",
				children: items.map((book) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "group flex flex-col justify-between rounded-2xl border border-border/50 bg-card/60 p-3 shadow-md backdrop-blur-sm transition-all duration-200 hover:border-gold/30 hover:bg-card hover:shadow-xl",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookCover, {
						title: book.title,
						author: book.author,
						coverUrl: book.cover,
						badge: "Copyright"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "line-clamp-1 font-display text-xs sm:text-sm font-semibold text-foreground group-hover:text-gold transition-colors",
							title: book.title,
							children: book.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-0.5 line-clamp-1 text-[11px] text-muted",
							title: book.author,
							children: [book.author, book.year ? ` · ${book.year}` : ""]
						})]
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 pt-2 border-t border-border/40 space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap gap-1",
							children: (book.actions ?? []).slice(0, 3).map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href: a.url,
								target: "_blank",
								rel: "noreferrer",
								className: "inline-flex h-6 items-center rounded-lg border border-border/60 bg-raised/70 px-2 text-[10px] font-medium text-muted hover:text-gold hover:border-gold/40 transition-colors",
								children: a.label
							}, `${book.id}-${a.label}`))
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "quiet",
							size: "sm",
							onClick: () => fileRef.current?.click(),
							className: "h-7 w-full rounded-lg text-[11px] font-medium text-gold hover:bg-gold/10",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-3 mr-1" }), "Sideload"]
						})]
					})]
				}, book.id))
			})
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "arena-page max-w-6xl mx-auto space-y-7 pb-16 px-4 sm:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex size-11 items-center justify-center rounded-2xl bg-gold/15 text-gold border border-gold/30 shadow-inner",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, { className: "size-6" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground",
						children: "Books"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs sm:text-sm text-muted",
						children: "Your shelf, enduring classics, and focused in-browser reading."
					})] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start gap-2.5 rounded-2xl border border-border/50 bg-card/40 px-3.5 py-2.5 text-xs text-muted/90 backdrop-blur-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, { className: "size-4 shrink-0 text-gold mt-0.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "leading-relaxed",
						children: "Keep a classic, continue something already on your shelf, or add a compatible book you own."
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "flex gap-2",
				onSubmit: (e) => {
					e.preventDefault();
					handleSearch();
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative min-w-0 flex-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: query,
							onChange: (e) => setQuery(e.target.value),
							placeholder: "Search authors, titles (Holmes, Dracula, Austen, Frankenstein)…",
							className: "h-11 w-full rounded-2xl border border-border/60 bg-card/80 pl-10 pr-10 text-sm shadow-sm transition-all placeholder:text-faint focus:border-gold/60 focus:bg-card focus:outline-none focus:ring-2 focus:ring-gold/20"
						}),
						query ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => {
								setQuery("");
								setSearched(false);
								setResults([]);
								setLicensed([]);
							},
							className: "absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
						}) : null
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					variant: "gold",
					size: "sm",
					disabled: searching,
					className: "h-11 px-5 rounded-2xl font-semibold shadow-md",
					children: searching ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : "Search"
				})]
			}),
			errors.__search ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "flex items-center gap-2 text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl px-3.5 py-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4 shrink-0" }),
					" ",
					errors.__search
				]
			}) : null,
			unavailable.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "flex items-center gap-2 text-xs text-muted bg-card/60 border border-border/50 rounded-xl px-3 py-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-3.5 text-gold shrink-0" }),
					"Could not reach ",
					unavailable.join(" or "),
					". Showing results from reachable catalogs."
				]
			}) : null,
			searched ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between border-b border-border/50 pb-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-base font-semibold text-foreground",
							children: "Search Results"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => {
								setSearched(false);
								setQuery("");
								setResults([]);
								setLicensed([]);
							},
							className: "text-xs font-semibold text-gold hover:underline",
							children: "Back to Discover"
						})]
					}),
					results.length > 0 ? renderOpenGrid(results) : !searching && licensed.length === 0 && !errors.__search ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-2xl border border-border/50 bg-card/40 p-8 text-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, { className: "mx-auto size-8 text-muted/50 mb-2" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm font-medium text-foreground",
								children: "No open titles found"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-muted max-w-md mx-auto",
								children: "No classic matches yet. Try the author, a shorter title, or look in stores and libraries."
							})
						]
					}) : null,
					renderLicensedGrid(licensed, "Get this legally")
				]
			}) : null,
			!searched && shelf && shelf.length > 0 ? (() => {
				const isPdf = (rel) => /\.pdf$/i.test(rel);
				const epubCount = shelf.filter((b) => !isPdf(b.rel)).length;
				const pdfCount = shelf.filter((b) => isPdf(b.rel)).length;
				const displayedShelf = shelf.filter((b) => {
					if (shelfFilter === "epub") return !isPdf(b.rel);
					if (shelfFilter === "pdf") return isPdf(b.rel);
					return true;
				});
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2.5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Library, { className: "size-5 text-gold" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-display text-lg font-bold text-foreground",
									children: "Your shelf"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "rounded-full bg-gold/15 border border-gold/30 px-2 py-0.5 text-[11px] font-bold text-gold",
									children: [
										shelf.length,
										" ",
										shelf.length === 1 ? "book" : "books"
									]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center rounded-xl bg-raised/70 border border-border/60 p-0.5 text-xs",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => setShelfFilter("all"),
										className: `px-2.5 py-1 rounded-lg font-medium transition-all ${shelfFilter === "all" ? "bg-gold/20 text-gold font-semibold shadow-sm" : "text-muted hover:text-foreground"}`,
										children: [
											"All (",
											shelf.length,
											")"
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => setShelfFilter("epub"),
										className: `px-2.5 py-1 rounded-lg font-medium transition-all ${shelfFilter === "epub" ? "bg-gold/20 text-gold font-semibold shadow-sm" : "text-muted hover:text-foreground"}`,
										children: [
											"EPUB (",
											epubCount,
											")"
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => setShelfFilter("pdf"),
										className: `px-2.5 py-1 rounded-lg font-medium transition-all ${shelfFilter === "pdf" ? "bg-gold/20 text-gold font-semibold shadow-sm" : "text-muted hover:text-foreground"}`,
										children: [
											"PDF (",
											pdfCount,
											")"
										]
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => fileRef.current?.click(),
								className: "inline-flex items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/20 transition-all",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-3.5" }), "Sideload"]
							})]
						})]
					}), displayedShelf.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-2xl border border-border/50 bg-card/40 p-8 text-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, { className: "mx-auto size-8 text-muted/50 mb-2" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-sm font-medium text-foreground",
								children: [
									"No ",
									shelfFilter.toUpperCase(),
									" books on this shelf"
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 text-xs text-muted",
								children: [
									"Try switching filters or sideloading a",
									" ",
									shelfFilter.toUpperCase(),
									" file."
								]
							})
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6",
						children: displayedShelf.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "group flex flex-col justify-between rounded-2xl border border-border/50 bg-card/70 p-3 shadow-md backdrop-blur-sm transition-all duration-200 hover:border-gold/50 hover:bg-card hover:shadow-2xl",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookCover, {
								title: b.title,
								author: b.author,
								coverUrl: b.cover,
								badge: isPdf(b.rel) ? "PDF" : "EPUB"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "line-clamp-1 font-display text-xs sm:text-sm font-semibold text-foreground group-hover:text-gold transition-colors",
									title: b.title,
									children: b.title
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-0.5 line-clamp-1 text-[11px] text-muted",
									title: b.author,
									children: b.author
								})]
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 pt-2.5 border-t border-border/40 flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									variant: "gold",
									size: "sm",
									onClick: () => setReading(b),
									className: "h-8 flex-1 rounded-xl text-xs font-semibold shadow-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, { className: "size-3.5 mr-1" }), bookProgress[b.rel] > 0 ? "Continue" : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Read" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: `/api/books/file?rel=${encodeURIComponent(b.rel)}`,
									download: true,
									className: "flex size-8 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-raised/70 text-muted hover:text-gold hover:border-gold/40 hover:bg-raised transition-all",
									title: `Download ${isPdf(b.rel) ? "PDF" : "EPUB"} to Device`,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-3.5" })
								})]
							})]
						}, b.rel))
					})]
				});
			})() : null,
			!searched ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-4 pt-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between border-b border-border/50 pb-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Compass, { className: "size-5 text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-display text-lg font-bold text-foreground",
								children: "Discover"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-muted",
							children: "Classics to keep"
						})]
					}),
					catalog.length > 0 ? renderOpenGrid(catalog) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-center py-12 text-sm text-muted",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-5 animate-spin mr-2 text-gold" }), "Loading featured books…"]
					}),
					renderLicensedGrid(featuredLicensed, "In stores and libraries")
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl border border-border/60 bg-gradient-to-br from-card/90 to-card/50 p-5 shadow-lg backdrop-blur-md",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold border border-gold/30",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, { className: "size-5" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-display text-sm font-semibold text-foreground",
								children: "Bring your own books"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-muted/90 max-w-xl",
								children: "Add a compatible EPUB or PDF you own. It joins this shelf and opens in the ReelOS reader."
							})] })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap items-center gap-2.5 shrink-0",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								variant: "gold",
								size: "sm",
								onClick: () => fileRef.current?.click(),
								className: "h-9 px-4 rounded-xl text-xs font-semibold shadow-md",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-3.5 mr-1.5" }), "Add EPUB or PDF"]
							})
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						ref: fileRef,
						type: "file",
						accept: ".epub,.pdf,.txt,application/epub+zip,application/pdf",
						className: "hidden",
						onChange: (e) => {
							const f = e.target.files?.[0];
							e.target.value = "";
							if (f) handleSideload(f);
						}
					}),
					sideloadMsg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-xs text-gold font-medium bg-gold/10 border border-gold/20 rounded-xl px-3 py-1.5 inline-block",
						children: sideloadMsg
					}) : null
				]
			}),
			reading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookReader, {
				book: reading,
				initialProgress: bookProgress[reading.rel] || 0,
				initialLocation: bookLocations[reading.rel],
				bookmarks: bookBookmarks[reading.rel] || [],
				appearance: readingAppearance,
				onProgress: (progress, location) => onProgress?.(reading.rel, progress, location),
				onToggleBookmark: (location) => onToggleBookmark?.(reading.rel, location),
				onAppearance,
				onClose: () => setReading(null)
			}) : null
		]
	});
}
var tmdb = (path) => path ? `https://image.tmdb.org/t/p/w500/${path}` : "";
var EXTRAS = [
	[
		"inception",
		"Inception",
		2010,
		"Science fiction,Mystery",
		"oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
		"Leonardo DiCaprio,Christopher Nolan",
		"cerebral,big,late night"
	],
	[
		"dark-knight",
		"The Dark Knight",
		2008,
		"Crime,Thriller",
		"qJ2tW6WMUDux911r6m7haRef0WH.jpg",
		"Christian Bale,Christopher Nolan",
		"tense,big,late night"
	],
	[
		"pulp-fiction",
		"Pulp Fiction",
		1994,
		"Crime,Comedy",
		"d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg",
		"Samuel L. Jackson,Uma Thurman",
		"sharp,restless,late night"
	],
	[
		"fight-club",
		"Fight Club",
		1999,
		"Drama,Thriller",
		"pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
		"Brad Pitt,Edward Norton",
		"dark,cerebral,restless"
	],
	[
		"severance",
		"Severance",
		2022,
		"Science fiction,Drama",
		"",
		"Adam Scott,Britt Lower",
		"strange,cerebral,quiet",
		"series"
	],
	[
		"the-bear",
		"The Bear",
		2022,
		"Drama,Comedy",
		"sHqbe6m4rIS5b2b2vPz259O1wQf.jpg",
		"Ayo Edebiri,Jeremy Allen White",
		"urgent,human,sharp",
		"series"
	],
	[
		"shogun",
		"Shōgun",
		2024,
		"Drama,History",
		"7O4iVfOMQmdCSxhOg1WNzG1AgYT.jpg",
		"Hiroyuki Sanada,Anna Sawai",
		"epic,patient,transporting",
		"series"
	],
	[
		"fallout",
		"Fallout",
		2024,
		"Science fiction,Adventure",
		"AnsZu445z2hR68b191v38M8j6f8.jpg",
		"Ella Purnell,Walton Goggins",
		"strange,fun,restless",
		"series"
	],
	[
		"arcane",
		"Arcane",
		2021,
		"Animation,Fantasy",
		"fqldf2t8ztc9aiwn39679G0bZtq.jpg",
		"Hailee Steinfeld,Ella Purnell",
		"beautiful,big,emotional",
		"series"
	],
	[
		"jurassic-park",
		"Jurassic Park",
		1993,
		"Adventure,Science fiction",
		"b1x09nyJwQDU7z44Pj5fqzE2w7R.jpg",
		"Sam Neill,Laura Dern",
		"wonder,big,familiar",
		"movie",
		true
	],
	[
		"alien",
		"Alien",
		1979,
		"Horror,Science fiction",
		"vfrQk5IPloGg1v9Rzbh2Eg3VGyM.jpg",
		"Sigourney Weaver,Ridley Scott",
		"dark,tense,late night"
	],
	[
		"john-wick",
		"John Wick",
		2014,
		"Action,Thriller",
		"fZPSMVXTptipclsvJu29nR06os3.jpg",
		"Keanu Reeves,Ian McShane",
		"kinetic,stylish,restless"
	],
	[
		"toy-story",
		"Toy Story",
		1995,
		"Animation,Family",
		"uXDfjJbdP4ijW5hWSBrPrlKpxab.jpg",
		"Tom Hanks,Tim Allen",
		"warm,familiar,playful",
		"movie",
		true
	],
	[
		"finding-nemo",
		"Finding Nemo",
		2003,
		"Animation,Family",
		"eHuGQ10FUzK1mdOY69wF5pGgEf5.jpg",
		"Albert Brooks,Ellen DeGeneres",
		"warm,adventure,comfort",
		"movie",
		true
	],
	[
		"lion-king",
		"The Lion King",
		1994,
		"Animation,Family",
		"sKCr78MXSLixwmZ8DyJLrcsHXWA.jpg",
		"Matthew Broderick,James Earl Jones",
		"emotional,familiar,comfort",
		"movie",
		true
	],
	[
		"spider-verse",
		"Spider-Man: Into the Spider-Verse",
		2018,
		"Animation,Adventure",
		"iiZZdoQBEYBv6id8su7ImL0oCbD.jpg",
		"Shameik Moore,Hailee Steinfeld",
		"kinetic,colorful,big",
		"movie",
		true
	],
	[
		"frozen",
		"Frozen",
		2013,
		"Animation,Family",
		"kgwjIb2RWgXXtlcbGbcKy80qXU0.jpg",
		"Kristen Bell,Idina Menzel",
		"singalong,warm,familiar",
		"movie",
		true
	],
	[
		"moana",
		"Moana",
		2016,
		"Animation,Family",
		"r2305Z3P3hX243uD1E2lY2R6kY5.jpg",
		"Auliʻi Cravalho,Dwayne Johnson",
		"adventure,warm,colorful",
		"movie",
		true
	],
	[
		"wall-e",
		"WALL-E",
		2008,
		"Animation,Science fiction",
		"hbhFnRzzg6ZDmm8YAmxBnQpQIPh.jpg",
		"Ben Burtt,Elissa Knight",
		"gentle,quiet,warm",
		"movie",
		true
	],
	[
		"paddington-2",
		"Paddington 2",
		2017,
		"Family,Comedy",
		"1OJ9vkD5xPt3skC6KguyXAgagRZ.jpg",
		"Ben Whishaw,Hugh Grant",
		"kind,comfort,warm",
		"movie",
		true
	],
	[
		"parasite",
		"Parasite",
		2019,
		"Thriller,Drama",
		"7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
		"Song Kang-ho,Cho Yeo-jeong",
		"sharp,tense,unexpected"
	],
	[
		"everything-everywhere",
		"Everything Everywhere All at Once",
		2022,
		"Fantasy,Comedy",
		"w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg",
		"Michelle Yeoh,Ke Huy Quan",
		"wild,emotional,colorful"
	],
	[
		"mad-max-fury-road",
		"Mad Max: Fury Road",
		2015,
		"Action,Adventure",
		"hA2ple9q4qnwxp3hKVNhroipsir.jpg",
		"Charlize Theron,Tom Hardy",
		"kinetic,big,restless"
	],
	[
		"arrival",
		"Arrival",
		2016,
		"Science fiction,Drama",
		"x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg",
		"Amy Adams,Jeremy Renner",
		"quiet,cerebral,emotional"
	],
	[
		"ex-machina",
		"Ex Machina",
		2015,
		"Science fiction,Thriller",
		"btbRB7BrD887j5NrvjxceRDmaot.jpg",
		"Alicia Vikander,Oscar Isaac",
		"clinical,cerebral,tense"
	],
	[
		"her",
		"Her",
		2013,
		"Romance,Science fiction",
		"qWUNpeDXIGU4vP7O1Cvu2B2x4xV.jpg",
		"Joaquin Phoenix,Scarlett Johansson",
		"soft,lonely,warm"
	],
	[
		"moonlight",
		"Moonlight",
		2016,
		"Drama",
		"4911T5FbJ9eD2Faz5Z8cT3SUhU.jpg",
		"Mahershala Ali,Trevante Rhodes",
		"tender,quiet,emotional"
	],
	[
		"la-la-land",
		"La La Land",
		2016,
		"Romance,Music",
		"uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg",
		"Emma Stone,Ryan Gosling",
		"romantic,colorful,bittersweet"
	],
	[
		"whiplash",
		"Whiplash",
		2014,
		"Drama,Music",
		"7fn624j5lj3xTme2SgiLCeuedmO.jpg",
		"Miles Teller,J.K. Simmons",
		"intense,sharp,restless"
	],
	[
		"grand-budapest",
		"The Grand Budapest Hotel",
		2014,
		"Comedy,Drama",
		"eWdyYQreja6JGCzqHWXpWHDrrPo.jpg",
		"Ralph Fiennes,Saoirse Ronan",
		"playful,colorful,comfort"
	],
	[
		"eternal-sunshine",
		"Eternal Sunshine of the Spotless Mind",
		2004,
		"Romance,Drama",
		"5MwkWH9tYHv3mV9OdYTMR5qreIz.jpg",
		"Jim Carrey,Kate Winslet",
		"bittersweet,strange,intimate"
	],
	[
		"portrait-lady-fire",
		"Portrait of a Lady on Fire",
		2019,
		"Romance,Drama",
		"2LquGwEhbg3soxSCs9VNyh5VJd9.jpg",
		"Noémie Merlant,Adèle Haenel",
		"patient,intimate,beautiful"
	],
	[
		"aftersun",
		"Aftersun",
		2022,
		"Drama",
		"jeXmhP2zbUkREMRqFOYIwQOk49T.jpg",
		"Paul Mescal,Frankie Corio",
		"tender,quiet,bittersweet"
	],
	[
		"past-lives",
		"Past Lives",
		2023,
		"Romance,Drama",
		"k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
		"Greta Lee,Teo Yoo",
		"quiet,intimate,bittersweet"
	],
	[
		"holdovers",
		"The Holdovers",
		2023,
		"Comedy,Drama",
		"VHSzNBTwxV8vh7wylo7O9CLdac.jpg",
		"Paul Giamatti,Da'Vine Joy Randolph",
		"winter,comfort,human"
	],
	[
		"the-shining",
		"The Shining",
		1980,
		"Horror,Drama",
		"xazWoLealQwEgqZ89MLZklLZD3k.jpg",
		"Jack Nicholson,Shelley Duvall",
		"cold,dark,patient"
	],
	[
		"midsommar",
		"Midsommar",
		2019,
		"Horror,Drama",
		"7LEI8ulZzO5gy9Ww2NVCrKmHeDZ.jpg",
		"Florence Pugh,Jack Reynor",
		"bright,dread,patient"
	],
	[
		"get-out",
		"Get Out",
		2017,
		"Horror,Thriller",
		"tFXcEccSQMf3lfhfXKSU9iRBpa3.jpg",
		"Daniel Kaluuya,Allison Williams",
		"sharp,tense,unexpected"
	],
	[
		"hereditary",
		"Hereditary",
		2018,
		"Horror,Drama",
		"p9fmuz2Oj3HtEJEqbIwkFGUhVXD.jpg",
		"Toni Collette,Alex Wolff",
		"dark,dread,intense"
	],
	[
		"the-witch",
		"The Witch",
		2015,
		"Horror,Drama",
		"zap5hpFCWSvdWSuPGAQyjUv2wAC.jpg",
		"Anya Taylor-Joy,Ralph Ineson",
		"patient,dread,folklore"
	],
	[
		"nope",
		"Nope",
		2022,
		"Science fiction,Horror",
		"AcKVlWaNVVVFQwro3nLXqPljcYA.jpg",
		"Daniel Kaluuya,Keke Palmer",
		"strange,big,unexpected"
	],
	[
		"social-network",
		"The Social Network",
		2010,
		"Drama",
		"n0ybibhJtQ5icDqTp8eRytcIHJx.jpg",
		"Jesse Eisenberg,Andrew Garfield",
		"sharp,fast,cold"
	],
	[
		"zodiac",
		"Zodiac",
		2007,
		"Crime,Thriller",
		"6YmeO4pB7XTh8P8F960O1uA14JO.jpg",
		"Jake Gyllenhaal,Mark Ruffalo",
		"patient,dark,procedural"
	],
	[
		"gone-girl",
		"Gone Girl",
		2014,
		"Thriller,Drama",
		"lv5xShBIDPe7m4ufdlV0IAc7Avk.jpg",
		"Rosamund Pike,Ben Affleck",
		"sharp,dark,tense"
	],
	[
		"prisoners",
		"Prisoners",
		2013,
		"Thriller,Drama",
		"uhviyknTT5cEQXbn6vWIqfM4vGm.jpg",
		"Hugh Jackman,Jake Gyllenhaal",
		"rainy,dark,intense"
	],
	[
		"sicario",
		"Sicario",
		2015,
		"Thriller,Crime",
		"tw0lXhbNkklv4d65tPEUbpT2v1F.jpg",
		"Emily Blunt,Benicio del Toro",
		"tense,dark,patient"
	],
	[
		"the-prestige",
		"The Prestige",
		2006,
		"Mystery,Drama",
		"Ag2B2KHKQPukjH7WutmgnnSNurZ.jpg",
		"Christian Bale,Hugh Jackman",
		"cerebral,dark,unexpected"
	],
	[
		"tenet",
		"Tenet",
		2020,
		"Science fiction,Action",
		"aCIFMriQh8rvhxpN1IWGgvH0Tlg.jpg",
		"John David Washington,Robert Pattinson",
		"cerebral,big,kinetic"
	],
	[
		"2001-space-odyssey",
		"2001: A Space Odyssey",
		1968,
		"Science fiction,Adventure",
		"ve72VxNqjGM69Uky4WTo2bK6rfq.jpg",
		"Keir Dullea,Stanley Kubrick",
		"patient,cerebral,big"
	],
	[
		"goodfellas",
		"Goodfellas",
		1990,
		"Crime,Drama",
		"aKuFiU82s5ISJpGZp7YkIr3kCUd.jpg",
		"Robert De Niro,Ray Liotta",
		"fast,sharp,classic"
	],
	[
		"taxi-driver",
		"Taxi Driver",
		1976,
		"Drama,Crime",
		"ekstpH614fwDX8DUln1a2Opz0N8.jpg",
		"Robert De Niro,Jodie Foster",
		"lonely,dark,late night"
	],
	[
		"godfather",
		"The Godfather",
		1972,
		"Crime,Drama",
		"3bhkrj58Vtu7enYsRolD1fZdja1.jpg",
		"Al Pacino,Marlon Brando",
		"patient,classic,dark"
	],
	[
		"big-lebowski",
		"The Big Lebowski",
		1998,
		"Comedy,Crime",
		"d4htqU3WfDROqJEY0r7kqFTJxl.jpg",
		"Jeff Bridges,John Goodman",
		"loose,fun,comfort"
	],
	[
		"fargo",
		"Fargo",
		1996,
		"Crime,Comedy",
		"rt7cpEr1uP6RTZykBFhBTcRaKvG.jpg",
		"Frances McDormand,William H. Macy",
		"winter,darkly funny,sharp"
	],
	[
		"casablanca",
		"Casablanca",
		1942,
		"Romance,Drama",
		"5K7cOHoay2mZusSLezBOY0Qxh8a.jpg",
		"Humphrey Bogart,Ingrid Bergman",
		"romantic,classic,bittersweet"
	],
	[
		"rear-window",
		"Rear Window",
		1954,
		"Mystery,Thriller",
		"qitnZcLP7C9DLRuPpmvZ7GiEjJN.jpg",
		"James Stewart,Grace Kelly",
		"suspense,classic,playful"
	],
	[
		"vertigo",
		"Vertigo",
		1958,
		"Mystery,Romance",
		"15uOEfqBNTVtDUT7hGBVCka0rZz.jpg",
		"James Stewart,Kim Novak",
		"dreamlike,classic,obsessive"
	],
	[
		"seven-samurai",
		"Seven Samurai",
		1954,
		"Action,Drama",
		"8OKmBV5BUFzmozIC3pPWKHy17kx.jpg",
		"Toshiro Mifune,Takashi Shimura",
		"epic,classic,human"
	],
	[
		"pans-labyrinth",
		"Pan's Labyrinth",
		2006,
		"Fantasy,Drama",
		"s8C4whhKtDaJvMDcyiMvx3BIF5F.jpg",
		"Ivana Baquero,Sergi López",
		"dark,fairytale,beautiful"
	],
	[
		"shape-of-water",
		"The Shape of Water",
		2017,
		"Fantasy,Romance",
		"9zfwPffUXpBrEP26yp0q1ckXDcj.jpg",
		"Sally Hawkins,Doug Jones",
		"romantic,fairytale,warm"
	],
	[
		"amelie",
		"Amélie",
		2001,
		"Romance,Comedy",
		"oTKduWL2tpIKEmkAqF4mFEAWAsv.jpg",
		"Audrey Tautou,Mathieu Kassovitz",
		"whimsical,colorful,comfort"
	],
	[
		"in-the-mood-for-love",
		"In the Mood for Love",
		2e3,
		"Romance,Drama",
		"iYypPT4bhqXfq1b6EnmxvRt6b2Y.jpg",
		"Tony Leung,Maggie Cheung",
		"romantic,patient,beautiful"
	],
	[
		"princess-mononoke",
		"Princess Mononoke",
		1997,
		"Animation,Fantasy",
		"cMYCDADoLKLbB83g4WnJegaZimC.jpg",
		"Yōji Matsuda,Yuriko Ishida",
		"epic,nature,beautiful",
		"movie",
		true
	],
	[
		"my-neighbor-totoro",
		"My Neighbor Totoro",
		1988,
		"Animation,Family",
		"rtGDOeG9LzoerkDGZF9dnVeLppL.jpg",
		"Noriko Hidaka,Chika Sakamoto",
		"gentle,comfort,nature",
		"movie",
		true
	],
	[
		"howls-moving-castle",
		"Howl's Moving Castle",
		2004,
		"Animation,Fantasy",
		"6pZgH10jhpToPcf0uvyTCPFhWpI.jpg",
		"Chieko Baisho,Takuya Kimura",
		"romantic,wonder,comfort",
		"movie",
		true
	],
	[
		"ratatouille",
		"Ratatouille",
		2007,
		"Animation,Family",
		"t3vaWRPSf6WjDSamIkKDs1iQWna.jpg",
		"Patton Oswalt,Ian Holm",
		"warm,food,comfort",
		"movie",
		true
	],
	[
		"fantastic-mr-fox",
		"Fantastic Mr. Fox",
		2009,
		"Animation,Comedy",
		"njbTizADSZg4PqeyJdDzZGooikv.jpg",
		"George Clooney,Meryl Streep",
		"autumn,playful,comfort",
		"movie",
		true
	],
	[
		"truman-show",
		"The Truman Show",
		1998,
		"Comedy,Drama",
		"vuza0WqY239yBXOadKlGwJsZJFE.jpg",
		"Jim Carrey,Laura Linney",
		"warm,cerebral,bittersweet"
	],
	[
		"shawshank",
		"The Shawshank Redemption",
		1994,
		"Drama",
		"9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg",
		"Tim Robbins,Morgan Freeman",
		"hopeful,classic,patient"
	],
	[
		"green-mile",
		"The Green Mile",
		1999,
		"Drama,Fantasy",
		"8VG8fDNiy50H4FedGwdSVUPoaJe.jpg",
		"Tom Hanks,Michael Clarke Duncan",
		"emotional,classic,patient"
	]
];
var notes = {
	"tmdb-movie-872585": "A towering character study built from pressure, consequence, and fire.",
	"past-lives": "For a quiet night when every small look matters.",
	arrival: "A patient mystery with an enormous emotional horizon.",
	"mad-max-fury-road": "Pure movement, color, and beautifully controlled chaos.",
	"paddington-2": "Kindness with impeccable comic timing.",
	"in-the-mood-for-love": "Color, longing, and time held in a hallway."
};
var mappedCatalog = TITLES.filter((title) => title.kind !== "music").map((title) => ({
	id: title.id,
	title: title.title,
	year: title.year,
	kind: title.kind === "tv" || title.kind === "anime" ? "series" : "movie",
	genres: title.genres,
	poster: title.poster ?? "",
	backdrop: title.backdrop ?? title.poster ?? "",
	note: notes[title.id] ?? title.overview.split(". ")[0].replace(/\.$/, "") + ".",
	people: title.director ? [title.director] : [],
	moods: title.genres.map((genre) => genre.toLowerCase()),
	minutes: title.runtime ?? (title.kind === "tv" ? 48 : 115),
	family: title.kind === "kids" || title.genres.includes("Family"),
	sources: sourcesForExperienceTitle(title.id)
}));
var extrasCatalog = EXTRAS.map(([id, title, year, genres, poster, people, moods, kind = "movie", family]) => ({
	id,
	title,
	year,
	kind,
	genres: genres.split(","),
	poster: tmdb(poster),
	backdrop: tmdb(poster),
	note: notes[id] ?? `${moods.split(",").slice(0, 2).join(" and ")} cinema for the right night.`,
	people: people.split(","),
	moods: moods.split(","),
	minutes: kind === "series" ? 48 : 92 + (year + title.length) % 79,
	family,
	sources: sourcesForExperienceTitle(id)
}));
var PUBLIC_DOMAIN_TITLES = [
	{
		id: "night-of-the-living-dead-1968",
		title: "Night of the Living Dead",
		year: 1968,
		kind: "movie",
		genres: [
			"Horror",
			"Mystery",
			"Cult"
		],
		poster: "https://archive.org/services/img/night_of_the_living_dead",
		backdrop: "https://archive.org/services/img/night_of_the_living_dead",
		note: "A stark independent landmark built from dread, pressure, and invention.",
		people: [
			"George A. Romero",
			"Duane Jones",
			"Judith O'Dea"
		],
		moods: [
			"tense",
			"classic",
			"late night"
		],
		minutes: 96,
		sources: sourcesForExperienceTitle("night-of-the-living-dead-1968")
	},
	{
		id: "charade-1963",
		title: "Charade",
		year: 1963,
		kind: "movie",
		genres: [
			"Mystery",
			"Comedy",
			"Romance"
		],
		poster: "https://archive.org/services/img/Charade1963",
		backdrop: "https://archive.org/services/img/Charade1963",
		note: "A bright, slippery mystery that keeps changing the rules.",
		people: [
			"Audrey Hepburn",
			"Cary Grant",
			"Stanley Donen"
		],
		moods: [
			"playful",
			"romantic",
			"classic"
		],
		minutes: 113,
		sources: sourcesForExperienceTitle("charade-1963")
	},
	{
		id: "his-girl-friday-1940",
		title: "His Girl Friday",
		year: 1940,
		kind: "movie",
		genres: [
			"Comedy",
			"Romance",
			"Drama"
		],
		poster: "https://archive.org/services/img/HisGirlFriday1940",
		backdrop: "https://archive.org/services/img/HisGirlFriday1940",
		note: "Quick voices, sharper timing, and a newsroom moving at full speed.",
		people: [
			"Cary Grant",
			"Rosalind Russell",
			"Howard Hawks"
		],
		moods: [
			"fast",
			"funny",
			"classic"
		],
		minutes: 92,
		sources: sourcesForExperienceTitle("his-girl-friday-1940")
	},
	{
		id: "a-star-is-born-1937",
		title: "A Star Is Born",
		year: 1937,
		kind: "movie",
		genres: ["Drama", "Romance"],
		poster: "https://archive.org/services/img/AStarIsBorn1937",
		backdrop: "https://archive.org/services/img/AStarIsBorn1937",
		note: "Ambition, love, and the cost of being seen by everyone.",
		people: [
			"Janet Gaynor",
			"Fredric March",
			"William A. Wellman"
		],
		moods: [
			"romantic",
			"bittersweet",
			"classic"
		],
		minutes: 111,
		sources: sourcesForExperienceTitle("a-star-is-born-1937")
	}
];
var EXPERIENCE_CATALOG = [
	...mappedCatalog,
	...extrasCatalog.filter((extra) => !mappedCatalog.some((title) => title.title === extra.title)),
	...PUBLIC_DOMAIN_TITLES
];
var TITLE_BY_EXPERIENCE_ID = Object.fromEntries(EXPERIENCE_CATALOG.map((title) => [title.id, title]));
var personImage = (titleId) => TITLE_BY_EXPERIENCE_ID[titleId]?.poster;
var TASTE_ITEMS = [
	...EXPERIENCE_CATALOG.map((title) => ({
		id: title.id,
		title: title.title,
		subtitle: `${title.year} · ${title.genres[0]}`,
		kind: "title",
		image: title.poster || void 0,
		titleId: title.id
	})),
	{
		id: "florence-pugh",
		title: "Florence Pugh",
		subtitle: "Midsommar · Dune · Oppenheimer",
		kind: "person",
		image: personImage("midsommar")
	},
	{
		id: "ayo-edebiri",
		title: "Ayo Edebiri",
		subtitle: "The Bear · Bottoms",
		kind: "person",
		image: personImage("the-bear")
	},
	{
		id: "pedro-pascal",
		title: "Pedro Pascal",
		subtitle: "The Last of Us · The Mandalorian",
		kind: "person",
		image: personImage("fallout")
	},
	{
		id: "viola-davis",
		title: "Viola Davis",
		subtitle: "Fences · Widows · The Woman King",
		kind: "person",
		image: personImage("past-lives")
	},
	{
		id: "ryan-gosling",
		title: "Ryan Gosling",
		subtitle: "Drive · La La Land · The Nice Guys",
		kind: "person",
		image: personImage("la-la-land")
	},
	{
		id: "zendaya",
		title: "Zendaya",
		subtitle: "Dune · Challengers · Euphoria",
		kind: "person",
		image: personImage("tmdb-movie-693134")
	},
	{
		id: "slow-rain",
		title: "Slow rain & neon",
		subtitle: "Blade Runner 2049 · The Batman",
		kind: "mood",
		image: personImage("tmdb-movie-335984")
	},
	{
		id: "sunday-comfort",
		title: "Sunday comfort",
		subtitle: "The Holdovers · Paddington 2",
		kind: "mood",
		image: personImage("holdovers")
	},
	{
		id: "big-feelings",
		title: "Big feelings",
		subtitle: "Everything Everywhere · Interstellar",
		kind: "mood",
		image: personImage("everything-everywhere")
	},
	{
		id: "quietly-strange",
		title: "Quietly strange",
		subtitle: "Arrival · Severance · Her",
		kind: "mood",
		image: personImage("arrival")
	}
];
function titlesForPerson(person) {
	return EXPERIENCE_CATALOG.filter((title) => title.people.some((name) => name.toLowerCase().includes(person.toLowerCase())));
}
function curateForProfile(profile, tonight, kidsPresent, catalog = EXPERIENCE_CATALOG) {
	const loved = new Set(Object.entries(profile.reactions).filter(([, reaction]) => reaction === "love").map(([id]) => id));
	const preferredWords = /* @__PURE__ */ new Set();
	for (const id of Object.keys(profile.reactions)) {
		const title = TITLE_BY_EXPERIENCE_ID[id];
		title?.genres.forEach((genre) => preferredWords.add(genre.toLowerCase()));
		title?.moods.forEach((mood) => preferredWords.add(mood.toLowerCase()));
	}
	return catalog.filter((title) => !profile.isChild && !kidsPresent || title.family).filter((title) => tonight.kind === "all" || title.kind === tonight.kind).filter((title) => {
		if (tonight.duration === "short") return title.minutes <= 100;
		if (tonight.duration === "feature") return title.minutes > 100 && title.minutes <= 145;
		if (tonight.duration === "long") return title.minutes > 145 || title.kind === "series";
		return true;
	}).filter((title) => !tonight.person || title.people.some((person) => person === tonight.person)).map((title, index) => {
		let score = 120 - index;
		if (loved.has(title.id)) score += 24;
		if (profile.savedIds.includes(title.id)) score += 8;
		if (profile.lessLikeIds.includes(title.id)) score -= 80;
		for (const value of [...title.genres, ...title.moods]) if (preferredWords.has(value.toLowerCase())) score += 7;
		if (tonight.mood && title.moods.some((mood) => mood.includes(tonight.mood))) score += 35;
		if (tonight.exploration === "adventurous" && !profile.savedIds.includes(title.id)) score += index % 13;
		if (tonight.exploration === "familiar" && profile.savedIds.includes(title.id)) score += 28;
		return {
			title,
			score
		};
	}).sort((a, b) => b.score - a.score).map(({ title }) => title);
}
function whyThisTitle(title, profile) {
	const related = Object.entries(profile.reactions).map(([id, reaction]) => ({
		title: TITLE_BY_EXPERIENCE_ID[id],
		reaction
	})).find(({ title: liked }) => liked?.genres.some((genre) => title.genres.includes(genre)));
	if (related?.title) return `Because ${profile.name} ${related.reaction === "love" ? "loves" : "liked"} ${related.title.title}.`;
	return title.note;
}
var reactionWeight = {
	like: 2,
	love: 4,
	cozy: 3
};
function normalizeInviteCode(value) {
	return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}
function inviteCodeFromLocation(search) {
	return normalizeInviteCode(new URLSearchParams(search).get("code") || "");
}
function parsePartyRoom(value) {
	if (!value || typeof value !== "object") return null;
	const room = value;
	const code = normalizeInviteCode(String(room.code || ""));
	if (code.length !== 6 || !room.titleId || !room.title || !room.hostId) return null;
	const participants = Array.isArray(room.participants) ? room.participants.filter((item) => Boolean(item && typeof item === "object")).filter((item) => item.id && item.name).map((item) => ({
		id: String(item.id),
		name: String(item.name),
		isHost: Boolean(item.isHost),
		connected: Boolean(item.connected),
		joinedAt: Number(item.joinedAt) || 0
	})) : [];
	return {
		code,
		titleId: String(room.titleId),
		title: String(room.title),
		hostId: String(room.hostId),
		participants
	};
}
/**
* A deterministic, local-only household compromise. It rewards direct
* enthusiasm while treating "less like this" as an objection instead of
* averaging one person's strong dislike away.
*/
function householdConsensus(titles, profiles) {
	if (!profiles.length) return titles;
	return titles.map((title, index) => {
		const scores = profiles.map((profile) => {
			if (profile.lessLikeIds.includes(title.id)) return -100;
			const reaction = profile.reactions[title.id];
			if (reaction) return reactionWeight[reaction];
			return 0;
		});
		return {
			title,
			score: Math.min(...scores) + scores.reduce((sum, score) => sum + score, 0) / scores.length,
			index
		};
	}).sort((a, b) => b.score - a.score || a.index - b.index).map(({ title }) => title);
}
function WatchTogetherWorld({ profiles, activeProfileId, onBack, onOpen }) {
	const [mode, setMode] = (0, import_react.useState)(() => typeof window !== "undefined" && inviteCodeFromLocation(window.location.search) ? "remote" : "home");
	const [joined, setJoined] = (0, import_react.useState)(() => profiles.slice(0, 2).map((profile) => profile.id));
	const participating = profiles.filter((profile) => joined.includes(profile.id));
	const matches = (0, import_react.useMemo)(() => participating.length ? householdConsensus(EXPERIENCE_CATALOG.filter((title) => title.kind !== "book"), participating).slice(0, 8) : [], [participating]);
	const [selectedTitleId, setSelectedTitleId] = (0, import_react.useState)(matches[0]?.id || "");
	const selectedTitle = EXPERIENCE_CATALOG.find((title) => title.id === selectedTitleId) || matches[0];
	const [roomCode, setRoomCode] = (0, import_react.useState)(() => typeof window === "undefined" ? "" : inviteCodeFromLocation(window.location.search));
	const [room, setRoom] = (0, import_react.useState)(null);
	const [participantId, setParticipantId] = (0, import_react.useState)("");
	const [connection, setConnection] = (0, import_react.useState)("idle");
	const [error, setError] = (0, import_react.useState)("");
	const [copied, setCopied] = (0, import_react.useState)(false);
	const socketRef = (0, import_react.useRef)(null);
	const reconnectRef = (0, import_react.useRef)(null);
	const reconnectAttempts = (0, import_react.useRef)(0);
	const shouldReconnect = (0, import_react.useRef)(true);
	const displayName = (profiles.find((profile) => profile.id === activeProfileId) || profiles[0])?.name || "Viewer";
	const openSocket = (code, stableId, reconnecting = false) => {
		socketRef.current?.close();
		shouldReconnect.current = true;
		if (!reconnecting) reconnectAttempts.current = 0;
		setConnection(reconnecting ? "reconnecting" : "connecting");
		const url = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/watchparty?room=${encodeURIComponent(code)}&name=${encodeURIComponent(displayName)}&id=${encodeURIComponent(stableId)}`;
		const socket = new WebSocket(url, "reelos-watchparty-v1");
		socketRef.current = socket;
		socket.onmessage = (event) => {
			try {
				const message = JSON.parse(String(event.data));
				if (message.type === "error") {
					shouldReconnect.current = false;
					setError(message.error || "That invite is no longer available.");
					setConnection("unavailable");
					socket.close();
					return;
				}
				const nextRoom = parsePartyRoom(message.room);
				if (message.type === "init" && nextRoom) {
					const confirmedId = String(message.participantId || stableId);
					setParticipantId(confirmedId);
					sessionStorage.setItem(`reelos-party:${code}`, confirmedId);
					setRoom(nextRoom);
					setConnection("connected");
					reconnectAttempts.current = 0;
					setError("");
				} else if (nextRoom) setRoom(nextRoom);
			} catch {
				setError("The party sent a response ReelOS could not read.");
			}
		};
		socket.onerror = () => {
			setError("The live party connection is unavailable right now.");
		};
		socket.onclose = () => {
			if (socketRef.current !== socket || !shouldReconnect.current) return;
			if (reconnectAttempts.current >= 3) {
				setConnection("unavailable");
				setError("The party could not reconnect. Your invite is still shown so you can retry.");
				return;
			}
			reconnectAttempts.current += 1;
			setConnection("reconnecting");
			reconnectRef.current = window.setTimeout(() => openSocket(code, stableId, true), 1600);
		};
	};
	(0, import_react.useEffect)(() => () => {
		if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
		shouldReconnect.current = false;
		const socket = socketRef.current;
		socketRef.current = null;
		socket?.close();
	}, []);
	const createRoom = async () => {
		if (!selectedTitle) {
			setError("Choose something before creating an invite.");
			return;
		}
		setError("");
		setConnection("connecting");
		try {
			const response = await fetch("/api/watchparty/room", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					hostName: displayName,
					titleId: selectedTitle.id,
					title: selectedTitle.title
				})
			});
			const payload = await response.json();
			const confirmed = parsePartyRoom(payload.room);
			if (!response.ok || !payload.ok || !confirmed) throw new Error("ReelOS could not create a confirmed room.");
			setRoomCode(confirmed.code);
			setRoom(confirmed);
			setParticipantId(confirmed.hostId);
			openSocket(confirmed.code, confirmed.hostId);
		} catch (reason) {
			setConnection("unavailable");
			setError(reason instanceof Error ? reason.message : "Watch Together is unavailable.");
		}
	};
	const joinRoom = async () => {
		const code = normalizeInviteCode(roomCode);
		if (code.length !== 6) {
			setError("Enter the six-character invite code.");
			return;
		}
		setError("");
		setConnection("connecting");
		try {
			const remembered = sessionStorage.getItem(`reelos-party:${code}`) || void 0;
			const response = await fetch("/api/watchparty/join", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					code,
					name: displayName,
					participantId: remembered
				})
			});
			const payload = await response.json();
			const confirmed = parsePartyRoom(payload.room);
			if (!response.ok || !payload.ok || !confirmed || !payload.participantId) throw new Error(payload.error || "That invite is no longer available.");
			setRoom(confirmed);
			setParticipantId(String(payload.participantId));
			openSocket(code, String(payload.participantId));
		} catch (reason) {
			setConnection("unavailable");
			setError(reason instanceof Error ? reason.message : "That invite is unavailable.");
		}
	};
	const copyInvite = async () => {
		if (!room) return;
		const invite = `${window.location.origin}/party?code=${room.code}`;
		try {
			await navigator.clipboard.writeText(invite);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1600);
		} catch {
			setError(`Share this code: ${room.code}`);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto max-w-6xl px-5 pb-28 pt-10 md:px-10 lg:pb-16",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				onClick: onBack,
				className: "inline-flex min-h-12 items-center gap-2 text-sm text-white/55",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-4" }), " Family"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-6 font-display text-[clamp(3.3rem,7vw,6.6rem)] font-semibold leading-none tracking-[-.075em]",
				children: "Find the overlap."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-5 max-w-xl leading-7 text-white/52",
				children: "Choose together at Home without exposing anyone’s history, or open a live invite for people somewhere else."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-8 flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => setMode("home"),
					className: `min-h-12 rounded-full px-5 text-sm ${mode === "home" ? "bg-white text-black" : "bg-white/7"}`,
					children: "Together at Home"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => setMode("remote"),
					className: `min-h-12 rounded-full px-5 text-sm ${mode === "remote" ? "bg-white text-black" : "bg-white/7"}`,
					children: "Watch from apart"
				})]
			}),
			mode === "home" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-10",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-white/42",
					children: "Who is choosing?"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4 flex flex-wrap gap-3",
					children: profiles.map((profile) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setJoined((items) => items.includes(profile.id) ? items.filter((id) => id !== profile.id) : [...items, profile.id]),
						className: `min-h-12 rounded-full px-5 text-sm ${joined.includes(profile.id) ? "text-black" : "bg-white/7"}`,
						style: joined.includes(profile.id) ? { backgroundColor: profile.color } : void 0,
						children: profile.name
					}, profile.id))
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-12",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-white/42",
						children: "Strongest shared matches"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4",
						children: matches.map((title) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => onOpen(title),
							className: "group relative aspect-[2/3] overflow-hidden rounded-[1.4rem] bg-white/5 text-left",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: title.poster,
								alt: "",
								className: "size-full object-cover transition duration-500 group-hover:scale-105"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-4 pb-4 pt-14 text-sm font-semibold",
								children: title.title
							})]
						}, title.id))
					}),
					!participating.length && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 text-sm text-amber-200/70",
						children: "Choose at least one person to make a shared match."
					})
				]
			})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-10 grid gap-7 lg:grid-cols-[1.1fr_.9fr]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-[1.8rem] bg-white/[.035] p-7",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid size-14 place-items-center rounded-full bg-white/8",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, {})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-6 font-display text-3xl tracking-[-.05em]",
							children: "A real shared session."
						}),
						!room ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-3 max-w-lg leading-7 text-white/48",
								children: "Pick the title you intend to watch, create an invite, or enter the code somebody sent you. ReelOS won’t claim you joined until the Home confirms it."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "mt-7 block text-xs text-white/38",
								children: "Title for a new invite"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								value: selectedTitle?.id || "",
								onChange: (event) => setSelectedTitleId(event.target.value),
								className: "mt-2 min-h-12 w-full rounded-xl bg-white/7 px-4 text-white outline-none",
								children: matches.map((title) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: title.id,
									className: "bg-neutral-950",
									children: title.title
								}, title.id))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: createRoom,
								disabled: connection === "connecting",
								className: "mt-3 min-h-12 w-full rounded-full bg-white px-6 text-sm font-bold text-black disabled:opacity-40",
								children: "Create invite"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "my-6 h-px bg-white/8" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									value: roomCode,
									onChange: (event) => setRoomCode(normalizeInviteCode(event.target.value)),
									placeholder: "Six-character code",
									inputMode: "text",
									autoCapitalize: "characters",
									className: "min-h-12 min-w-0 flex-1 rounded-xl bg-white/7 px-4 font-mono tracking-[.15em] outline-none"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: joinRoom,
									disabled: connection === "connecting",
									className: "min-h-12 rounded-full border border-white/14 px-6 text-sm disabled:opacity-40",
									children: "Join"
								})]
							})
						] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-6 text-xs uppercase tracking-[.18em] text-white/36",
								children: connection === "connected" ? "Connected" : connection === "reconnecting" ? "Reconnecting" : "Connecting"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 flex items-center justify-between gap-4 rounded-2xl bg-white/[.045] p-5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
									className: "block text-lg",
									children: room.title
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mt-1 block font-mono text-sm tracking-[.22em] text-white/50",
									children: room.code
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: copyInvite,
									className: "grid min-h-12 min-w-12 place-items-center rounded-full bg-white/8",
									"aria-label": "Copy invite",
									children: copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-4" })
								})]
							}),
							EXPERIENCE_CATALOG.find((title) => title.id === room.titleId) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => onOpen(EXPERIENCE_CATALOG.find((title) => title.id === room.titleId)),
								className: "mt-3 min-h-12 rounded-full bg-white px-6 text-sm font-bold text-black",
								children: "Open title"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-4 text-xs leading-5 text-white/34",
								children: "The invite and participant connection are live. Playback synchronization begins only from a compatible ReelOS player; this screen does not pretend playback started."
							})
						] }),
						error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							role: "alert",
							className: "mt-4 rounded-xl bg-red-400/10 p-4 text-sm text-red-100",
							children: [error, connection === "unavailable" && roomCode.length === 6 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: joinRoom,
								className: "ml-3 inline-flex items-center gap-1 underline",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "size-3" }), "Retry"]
							})]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-[1.8rem] bg-white/[.025] p-7",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs uppercase tracking-[.18em] text-white/34",
						children: "People here"
					}), !room ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-5 text-sm leading-6 text-white/42",
						children: "Participants appear only after a Home confirms the invite."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-5 space-y-3",
						children: room.participants.map((person) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-white/[.045] px-4",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", {
								className: "text-sm",
								children: [person.name, person.id === participantId ? " · You" : ""]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "mt-1 block text-xs text-white/35",
								children: [person.connected ? "Connected" : "Away", person.isHost ? " · Host" : ""]
							})] })
						}, person.id))
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-5 text-xs leading-5 text-white/30",
						children: "Direct host handoff is not available yet. A disconnected host stays reserved while ReelOS attempts to reconnect rather than silently moving control."
					})] })]
				})]
			})
		]
	});
}
var strategyKeys = [
	"mode",
	"storageAllocation",
	"allocatedGb",
	"autoDownloadFavorites",
	"autoDownloadWatchlist",
	"autoDownloadCabinVault"
];
var nonnegative$1 = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
var record$1 = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
var StorageSettingsError = class extends Error {
	status;
	code;
	constructor(message, status, code) {
		super(message);
		this.name = "StorageSettingsError";
		this.status = status;
		this.code = code;
	}
};
function validStrategy(value) {
	return record$1(value) && [
		"smart_hybrid",
		"cloud_stream",
		"offline_download"
	].includes(String(value.mode)) && ["dynamic_20", "fixed"].includes(String(value.storageAllocation)) && nonnegative$1(value.allocatedGb) && [
		value.autoDownloadFavorites,
		value.autoDownloadWatchlist,
		value.autoDownloadCabinVault
	].every((flag) => typeof flag === "boolean");
}
async function readSettings(response, expectedProfileId, patch) {
	const payload = await response.json().catch(() => null);
	if (!record$1(payload)) throw new StorageSettingsError("Storage settings could not be verified. Please retry.", response.status, "invalid_acknowledgement");
	if (!response.ok || payload.ok === false) throw new StorageSettingsError(typeof payload.error === "string" ? payload.error : "Storage settings are unavailable. Please retry.", response.status, typeof payload.code === "string" ? payload.code : "storage_settings_unavailable");
	const { storage, budget, preparation, strategy } = payload;
	if (!(payload.ok === true && payload.profileId === expectedProfileId && typeof payload.revision === "string" && payload.revision.trim().length > 0 && validStrategy(strategy) && typeof payload.canEdit === "boolean" && record$1(storage) && typeof storage.ok === "boolean" && typeof storage.available === "boolean" && (!storage.available || storage.ok === true && [
		storage.totalBytes,
		storage.freeBytes,
		storage.totalGb,
		storage.freeGb,
		storage.dynamic20Gb
	].every(nonnegative$1) && Number(storage.freeBytes) <= Number(storage.totalBytes)) && record$1(budget) && typeof budget.available === "boolean" && (!budget.available || [
		budget.limitBytes,
		budget.protectedFreeBytes,
		budget.usedBytes,
		budget.reservedBytes,
		budget.remainingBytes
	].every(nonnegative$1)) && record$1(preparation) && preparation.available === false && typeof preparation.reason === "string" && preparation.reason.trim().length > 0) || patch && (payload.persisted !== true || !payload.canEdit || !record$1(storage) || storage.available !== true || storage.ok !== true || !record$1(budget) || budget.available !== true || !Object.entries(patch).every(([key, value]) => strategy[key] === value))) throw new StorageSettingsError("Storage settings were not acknowledged for this profile. Please reload them.", response.status, "invalid_acknowledgement");
	return {
		profileId: expectedProfileId,
		revision: payload.revision,
		strategy: { ...strategy },
		storage: { ...storage },
		budget: { ...budget },
		preparation: { ...preparation },
		canEdit: payload.canEdit
	};
}
async function loadStorageSettings(expectedProfileId, signal, fetcher = fetch) {
	if (!expectedProfileId.trim()) throw new StorageSettingsError("Choose your profile to view storage settings.", 0, "profile_required");
	return readSettings(await fetcher("/api/strategy", {
		cache: "no-store",
		signal
	}), expectedProfileId);
}
async function saveStorageSettings(snapshot, requestedPatch, signal, fetcher = fetch) {
	if (!snapshot.profileId || !snapshot.revision || !snapshot.canEdit || !snapshot.storage.available || !snapshot.storage.ok || !snapshot.budget.available) throw new StorageSettingsError("Only the home owner can save after storage has been verified.", 0, "storage_not_verified");
	const patch = Object.fromEntries(strategyKeys.filter((key) => requestedPatch[key] !== void 0).map((key) => [key, requestedPatch[key]]));
	if (!Object.keys(patch).length || !validStrategy({
		...snapshot.strategy,
		...patch
	})) throw new StorageSettingsError("Choose valid storage preferences before saving.", 0, "invalid_strategy");
	return readSettings(await fetcher("/api/strategy", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		signal,
		body: JSON.stringify({
			expectedProfileId: snapshot.profileId,
			expectedRevision: snapshot.revision,
			...patch
		})
	}), snapshot.profileId, patch);
}
function maximumFixedStorageGb(snapshot) {
	if (!snapshot.storage.available || !snapshot.budget.available) return 0;
	return Math.max(0, Math.floor(((snapshot.storage.totalBytes ?? 0) - (snapshot.budget.protectedFreeBytes ?? 0)) / 2 ** 30));
}
function automaticStorageAllowanceBytes(snapshot) {
	if (!snapshot.storage.ok || !snapshot.storage.available || !snapshot.budget.available || !nonnegative$1(snapshot.storage.dynamic20Gb)) return null;
	return snapshot.storage.dynamic20Gb * 2 ** 30;
}
var emptyState$3 = () => ({
	snapshot: null,
	loading: false,
	saving: false,
	saved: false,
	error: null
});
function createStorageSettingsController({ expectedProfileId, isCurrent = () => true, onChange, fetcher = fetch }) {
	let state = emptyState$3();
	let disposed = false;
	let sequence = 0;
	let pending = null;
	const publish = (value) => {
		state = value;
		onChange?.(value);
	};
	const current = (request) => !disposed && request === sequence && isCurrent();
	function begin() {
		pending?.abort();
		pending = new AbortController();
		sequence += 1;
		return {
			request: sequence,
			signal: pending.signal
		};
	}
	return {
		getState: () => state,
		async load() {
			if (disposed || !isCurrent()) return false;
			const { request, signal } = begin();
			publish({
				...emptyState$3(),
				loading: true
			});
			try {
				const snapshot = await loadStorageSettings(expectedProfileId, signal, fetcher);
				if (!current(request)) return false;
				publish({
					...emptyState$3(),
					snapshot
				});
				return true;
			} catch (error) {
				if (current(request)) publish({
					...emptyState$3(),
					error: error instanceof StorageSettingsError ? error.message : "Storage settings could not be loaded. Please retry."
				});
				return false;
			}
		},
		async save(patch) {
			if (disposed || !isCurrent() || state.loading || state.saving || !state.snapshot) return false;
			const acknowledged = state.snapshot;
			const { request, signal } = begin();
			publish({
				...state,
				saving: true,
				saved: false,
				error: null
			});
			try {
				const snapshot = await saveStorageSettings(acknowledged, patch, signal, fetcher);
				if (!current(request)) return false;
				publish({
					...emptyState$3(),
					snapshot,
					saved: true
				});
				return true;
			} catch (error) {
				const invalidate = error instanceof StorageSettingsError && ([
					401,
					403,
					404,
					409
				].includes(error.status) || error.code === "invalid_acknowledgement" || error.status === 503 && error.code === "storage_unavailable");
				if (current(request)) publish({
					...state,
					snapshot: invalidate ? null : state.snapshot,
					saving: false,
					saved: false,
					error: error instanceof StorageSettingsError ? error.message : "Storage settings were not saved. Please retry."
				});
				return false;
			}
		},
		dispose() {
			disposed = true;
			sequence += 1;
			pending?.abort();
		}
	};
}
var controlClass = "min-h-12 min-w-12 rounded-xl border border-white/15 px-4 text-sm transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:cursor-not-allowed disabled:opacity-40";
var emptyState$2 = {
	snapshot: null,
	loading: false,
	saving: false,
	saved: false,
	error: null
};
var gib = (bytes, available) => available && typeof bytes === "number" ? `${(bytes / 2 ** 30).toLocaleString(void 0, { maximumFractionDigits: 1 })} GiB` : "Unavailable";
function StorageSettings() {
	const rangeId = (0, import_react.useId)();
	const profileId = activeExperienceProfile(useExperienceStore()).id;
	const currentProfile = (0, import_react.useRef)(profileId);
	currentProfile.current = profileId;
	const controllerRef = (0, import_react.useRef)(null);
	const [stored, setStored] = (0, import_react.useState)({
		profileId: "",
		state: emptyState$2
	});
	const [draft, setDraft] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		setDraft(null);
		if (!profileId) {
			setStored({
				profileId,
				state: {
					...emptyState$2,
					error: "Choose your profile to view storage settings."
				}
			});
			return;
		}
		const controller = createStorageSettingsController({
			expectedProfileId: profileId,
			isCurrent: () => currentProfile.current === profileId && activeExperienceProfile(useExperienceStore.getState()).id === profileId,
			onChange: (state) => setStored({
				profileId,
				state
			})
		});
		controllerRef.current = controller;
		controller.load();
		return () => {
			controller.dispose();
			if (controllerRef.current === controller) controllerRef.current = null;
		};
	}, [profileId]);
	const state = stored.profileId === profileId ? stored.state : {
		...emptyState$2,
		loading: Boolean(profileId)
	};
	const snapshot = state.snapshot;
	(0, import_react.useEffect)(() => {
		setDraft(snapshot ? {
			profileId: snapshot.profileId,
			revision: snapshot.revision,
			strategy: { ...snapshot.strategy }
		} : null);
	}, [snapshot]);
	const strategy = draft?.profileId === profileId && draft.revision === snapshot?.revision ? draft.strategy : snapshot?.strategy;
	const dirty = Boolean(snapshot && strategy && (strategy.mode !== snapshot.strategy.mode || strategy.storageAllocation !== snapshot.strategy.storageAllocation || strategy.allocatedGb !== snapshot.strategy.allocatedGb));
	const busy = state.loading || state.saving;
	const measured = Boolean(snapshot?.storage.ok && snapshot.storage.available && snapshot.budget.available);
	const editable = Boolean(snapshot?.canEdit && measured && !busy);
	const maxGb = snapshot ? maximumFixedStorageGb(snapshot) : 0;
	const automaticAllowance = snapshot ? automaticStorageAllowanceBytes(snapshot) : null;
	function update(patch) {
		if (!snapshot || !strategy || !editable) return;
		setDraft({
			profileId,
			revision: snapshot.revision,
			strategy: {
				...strategy,
				...patch
			}
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		"aria-label": "Storage settings",
		className: "space-y-5 text-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-white/60",
				children: "Choose the space this home may use for prepared media. Your existing local originals are separate from this budget."
			}),
			busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				role: "status",
				className: "text-white/65",
				children: state.saving ? "Saving storage settings…" : "Checking this home’s storage…"
			}) : null,
			state.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "alert",
				className: "space-y-3 rounded-xl bg-white/[.04] p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: state.error }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: controlClass,
					disabled: busy || !profileId,
					onClick: () => void controllerRef.current?.load(),
					children: "Retry storage settings"
				})]
			}) : null,
			snapshot && strategy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dl", {
					className: "grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3",
					children: [
						["Drive capacity", gib(snapshot.storage.totalBytes, snapshot.storage.available)],
						["Free on drive", gib(snapshot.storage.freeBytes, snapshot.storage.available)],
						["Protected free space", gib(snapshot.budget.protectedFreeBytes, snapshot.budget.available)],
						["Prepared media used", gib(snapshot.budget.usedBytes, snapshot.budget.available)],
						["Reserved for preparation", gib(snapshot.budget.reservedBytes, snapshot.budget.available)],
						["Budget remaining", gib(snapshot.budget.remainingBytes, snapshot.budget.available)]
					].map(([label, value]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-xs text-white/45",
						children: label
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
						className: "mt-1 tabular-nums",
						children: value
					})] }, label))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-white/55",
					children: [
						"Current preparation budget: ",
						gib(snapshot.budget.limitBytes, snapshot.budget.available),
						"."
					]
				}),
				!measured ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						role: "status",
						className: "text-white/60",
						children: snapshot.budget.reason || "Storage measurements are unavailable. Check again before changing the budget."
					}), !state.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: controlClass,
						disabled: busy,
						onClick: () => void controllerRef.current?.load(),
						children: "Retry storage settings"
					}) : null]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					role: "group",
					"aria-label": "Storage allocation",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: `${controlClass} ${strategy.storageAllocation === "dynamic_20" ? "bg-white/10" : ""}`,
						"aria-pressed": strategy.storageAllocation === "dynamic_20",
						disabled: !editable,
						onClick: () => update({ storageAllocation: "dynamic_20" }),
						children: "Automatic 20%"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: `${controlClass} ${strategy.storageAllocation === "fixed" ? "bg-white/10" : ""}`,
						"aria-pressed": strategy.storageAllocation === "fixed",
						disabled: !editable,
						onClick: () => update({
							storageAllocation: "fixed",
							allocatedGb: Math.min(maxGb, Math.max(0, Math.floor(strategy.allocatedGb)))
						}),
						children: "Fixed limit"
					})]
				}),
				strategy.storageAllocation === "dynamic_20" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-white/55",
					children: [
						"Automatic allocation currently allows ",
						gib(automaticAllowance, automaticAllowance !== null),
						". Protected free space still applies."
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							htmlFor: rangeId,
							className: "block",
							children: ["Storage budget: ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "tabular-nums",
								children: [strategy.allocatedGb, " GiB"]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"aria-label": "Decrease storage budget",
									className: controlClass,
									disabled: !editable || strategy.allocatedGb <= 0,
									onClick: () => update({ allocatedGb: Math.max(0, Math.floor(strategy.allocatedGb) - 1) }),
									children: "−"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									id: rangeId,
									type: "range",
									"aria-label": "Storage budget in GiB",
									min: 0,
									max: maxGb,
									step: 1,
									value: Math.min(maxGb, strategy.allocatedGb),
									disabled: !editable || maxGb === 0,
									className: "min-h-12 min-w-0 flex-1 accent-current",
									onChange: (event) => update({ allocatedGb: Math.max(0, Math.min(maxGb, Number(event.target.value))) })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"aria-label": "Increase storage budget",
									className: controlClass,
									disabled: !editable || strategy.allocatedGb >= maxGb,
									onClick: () => update({ allocatedGb: Math.min(maxGb, Math.floor(strategy.allocatedGb) + 1) }),
									children: "+"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-white/45",
							children: [
								"0–",
								maxGb,
								" GiB, after protected free space. Existing usage and reservations must fit."
							]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "block space-y-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Playback preference" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						className: `${controlClass} block w-full bg-zinc-950`,
						disabled: !editable,
						value: strategy.mode,
						onChange: (event) => update({ mode: event.target.value }),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "smart_hybrid",
								children: "Balanced"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "cloud_stream",
								children: "Prefer streaming"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "offline_download",
								children: "Prefer local playback"
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-white/55",
					children: [snapshot.preparation.reason, " Saving these preferences does not prepare or download any media."]
				}),
				!snapshot.canEdit ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-white/55",
					children: "Only the home owner can change these settings."
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: `${controlClass} bg-white/10`,
						disabled: !editable || !dirty,
						onClick: () => void controllerRef.current?.save({
							mode: strategy.mode,
							storageAllocation: strategy.storageAllocation,
							allocatedGb: strategy.allocatedGb
						}),
						children: "Save storage settings"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						role: "status",
						className: "text-xs text-white/55",
						children: dirty ? "Unsaved changes" : state.saved ? "Storage settings saved" : ""
					})]
				})
			] }) : null
		]
	});
}
var record = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
var text = (value) => typeof value === "string" && value.trim().length > 0;
var uuid = (value) => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
var nonnegative = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
var preparationIsActive = (job) => job.status === "preparing" || job.status === "validating";
var PreparationError = class extends Error {
	status;
	code;
	constructor(message, status, code) {
		super(message);
		this.name = "PreparationError";
		this.status = status;
		this.code = code;
	}
};
var invalid = () => new PreparationError("Preparation could not be verified for this profile. Refresh and try again.", 0, "invalid_acknowledgement");
function readJob(value) {
	if (!record(value) || !uuid(value.id) || !text(value.titleId) || !text(value.title) || !text(value.recipe) || ![
		"deferred",
		"preparing",
		"validating",
		"ready",
		"failed",
		"cancelled",
		"interrupted"
	].includes(String(value.status)) || !(value.progress === null || nonnegative(value.progress) && value.progress <= 1) || typeof value.message !== "string" || !nonnegative(value.createdAt) || !nonnegative(value.updatedAt) || typeof value.canRetry !== "boolean") throw invalid();
	return {
		id: value.id,
		titleId: value.titleId,
		title: value.title,
		recipe: value.recipe,
		status: value.status,
		progress: value.progress,
		message: value.message,
		createdAt: value.createdAt,
		updatedAt: value.updatedAt,
		canRetry: value.canRetry
	};
}
async function readResponse(response, profileId) {
	const body = await response.json().catch(() => null);
	if (!record(body)) throw invalid();
	if (!response.ok || body.ok !== true) throw new PreparationError(typeof body.error === "string" ? body.error : "Preparation is unavailable. Please retry.", response.status, typeof body.code === "string" ? body.code : "preparation_unavailable");
	if (body.profileId !== profileId || !text(profileId)) throw invalid();
	return body;
}
async function loadPreparation(profileId, signal, fetcher = fetch) {
	if (!text(profileId)) throw invalid();
	const body = await readResponse(await fetcher(`/api/preparation?expectedProfileId=${encodeURIComponent(profileId)}`, {
		cache: "no-store",
		signal
	}), profileId);
	if (body.available !== true || typeof body.canManage !== "boolean" || !Array.isArray(body.recipes) || !Array.isArray(body.jobs)) throw invalid();
	const recipes = body.recipes.map((recipe) => {
		if (!record(recipe) || !text(recipe.id) || !text(recipe.label)) throw invalid();
		return {
			id: recipe.id,
			label: recipe.label
		};
	});
	const jobs = body.jobs.map(readJob);
	if (new Set(jobs.map((job) => job.id)).size !== jobs.length || new Set(recipes.map((recipe) => recipe.id)).size !== recipes.length) throw invalid();
	return {
		profileId,
		canManage: body.canManage,
		recipes,
		jobs,
		available: true
	};
}
async function postPreparation(profileId, path, body, expected, signal, fetcher) {
	const result = await readResponse(await fetcher(path, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			expectedProfileId: profileId,
			...body
		}),
		signal
	}), profileId);
	if (result.persisted !== true) throw invalid();
	const job = readJob(result.job);
	if (job.titleId !== expected.titleId || job.recipe !== expected.recipe || expected.id && job.id !== expected.id) throw invalid();
	return job;
}
function preparedFileUrl(job, profileId) {
	if (job.status !== "ready" || !uuid(job.id) || !text(profileId)) return null;
	return `/api/preparation/${encodeURIComponent(job.id)}/file?expectedProfileId=${encodeURIComponent(profileId)}`;
}
var emptyState$1 = () => ({
	snapshot: null,
	loading: false,
	mutating: false,
	error: null
});
var scheduleTimeout$1 = (callback, delayMs) => {
	const timer = setTimeout(callback, delayMs);
	return () => clearTimeout(timer);
};
function createPreparationController({ expectedProfileId, isCurrent = () => true, onChange, fetcher = fetch, schedule = scheduleTimeout$1, pollMs = 2e3 }) {
	let state = emptyState$1();
	let disposed = false;
	let visible = true;
	let revision = 0;
	let pending = null;
	let cancelPoll = null;
	const current = (request) => !disposed && request === revision && isCurrent();
	const publish = (next) => {
		state = next;
		onChange?.(next);
	};
	function stopPolling() {
		cancelPoll?.();
		cancelPoll = null;
	}
	function begin() {
		stopPolling();
		pending?.abort();
		pending = new AbortController();
		revision += 1;
		return {
			request: revision,
			signal: pending.signal
		};
	}
	function armPoll() {
		stopPolling();
		if (!visible || disposed || !isCurrent() || !state.snapshot?.jobs.some(preparationIsActive)) return;
		const request = revision;
		cancelPoll = schedule(() => {
			cancelPoll = null;
			if (visible && current(request)) controller.refresh();
		}, pollMs);
	}
	function fail(error) {
		const invalidate = error instanceof PreparationError && ([
			401,
			403,
			404,
			409
		].includes(error.status) || error.code === "invalid_acknowledgement");
		publish({
			...state,
			snapshot: invalidate ? null : state.snapshot,
			loading: false,
			mutating: false,
			error: error instanceof PreparationError ? error.message : "Preparation could not be confirmed. Refresh and try again."
		});
	}
	async function mutate(choice) {
		if (disposed || !isCurrent() || state.mutating || state.loading) return false;
		const { request, signal } = begin();
		publish({
			...state,
			mutating: true,
			error: null
		});
		try {
			const fresh = await loadPreparation(expectedProfileId, signal, fetcher);
			if (!current(request)) return false;
			publish({
				snapshot: fresh,
				loading: false,
				mutating: true,
				error: null
			});
			if (!fresh.canManage) throw new PreparationError("Only the home owner can prepare media.", 403, "owner_required");
			let job;
			if ("action" in choice) {
				const existing = fresh.jobs.find((item) => item.id === choice.job.id);
				if (!existing || existing.titleId !== choice.job.titleId || existing.recipe !== choice.job.recipe) throw invalid();
				if (choice.action === "cancel" ? !preparationIsActive(existing) : !existing.canRetry || ![
					"deferred",
					"failed",
					"cancelled",
					"interrupted"
				].includes(existing.status)) throw new PreparationError("This job changed. Refresh its status before trying again.", 409, "job_changed");
				job = await postPreparation(expectedProfileId, `/api/preparation/${encodeURIComponent(existing.id)}/${choice.action}`, {}, choice.action === "cancel" ? existing : {
					titleId: existing.titleId,
					recipe: existing.recipe
				}, signal, fetcher);
				if (choice.action === "retry" && job.id === existing.id) throw invalid();
			} else {
				if (!text(choice.titleId) || !fresh.recipes.some((recipe) => recipe.id === choice.recipe)) throw invalid();
				job = await postPreparation(expectedProfileId, "/api/preparation", {
					titleId: choice.titleId,
					recipe: choice.recipe
				}, choice, signal, fetcher);
			}
			if (!current(request)) return false;
			publish({
				snapshot: {
					...fresh,
					jobs: [job, ...fresh.jobs.filter((item) => item.id !== job.id)]
				},
				loading: false,
				mutating: false,
				error: null
			});
			armPoll();
			return true;
		} catch (error) {
			if (current(request)) fail(error);
			return false;
		}
	}
	const controller = {
		getState: () => state,
		async refresh() {
			if (disposed || !isCurrent() || state.mutating) return false;
			const { request, signal } = begin();
			publish({
				...state,
				loading: true,
				error: null
			});
			try {
				const snapshot = await loadPreparation(expectedProfileId, signal, fetcher);
				if (!current(request)) return false;
				publish({
					snapshot,
					loading: false,
					mutating: false,
					error: null
				});
				armPoll();
				return true;
			} catch (error) {
				if (current(request)) fail(error);
				return false;
			}
		},
		prepare: (titleId, recipe) => mutate({
			titleId,
			recipe
		}),
		cancel: (job) => mutate({
			action: "cancel",
			job
		}),
		retry: (job) => mutate({
			action: "retry",
			job
		}),
		setVisible(next) {
			const resumed = !visible && next;
			visible = next;
			if (!next) stopPolling();
			else if (resumed && (!state.snapshot || state.snapshot.jobs.some(preparationIsActive))) controller.refresh();
		},
		dispose() {
			disposed = true;
			revision += 1;
			stopPolling();
			pending?.abort();
		}
	};
	return controller;
}
var validUuid = (value) => /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
async function postPreparedViewing(identity, action, { fetcher = fetch, now = () => Date.now() } = {}) {
	if (!identity.profileId.trim() || !validUuid(identity.jobId) || !validUuid(identity.sessionId)) throw new Error("Prepared viewing identity is unavailable");
	const response = await fetcher(`/api/preparation/${encodeURIComponent(identity.jobId)}/viewing`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		keepalive: action === "stop",
		body: JSON.stringify({
			expectedProfileId: identity.profileId,
			sessionId: identity.sessionId,
			action
		})
	});
	const result = await response.json().catch(() => null);
	if (response.status !== 200 || !result || typeof result !== "object" || Array.isArray(result)) throw new Error("Prepared viewing was not acknowledged");
	const ack = result;
	if (ack.ok !== true || ack.profileId !== identity.profileId || ack.jobId !== identity.jobId || ack.sessionId !== identity.sessionId || ack.action !== action || (action === "stop" ? ack.expiresAt !== null : typeof ack.expiresAt !== "number" || !Number.isFinite(ack.expiresAt) || ack.expiresAt <= now())) throw new Error("Prepared viewing identity or expiry could not be verified");
	return { expiresAt: ack.expiresAt };
}
var scheduleTimeout = (callback, delayMs) => {
	const timer = setTimeout(callback, delayMs);
	return () => clearTimeout(timer);
};
/** Protects playback for the whole mounted viewing session, including pause and buffering. */
function createPreparedViewingController({ profileId, jobId, sessionId = createClientId(), isCurrent = () => true, onChange, fetcher = fetch, now = () => Date.now(), schedule = scheduleTimeout }) {
	const identity = {
		profileId,
		jobId,
		sessionId
	};
	let state = {
		status: "idle",
		expiresAt: null,
		error: null
	};
	let closed = false;
	let disposed = false;
	let attempted = false;
	let inFlight = null;
	let stopTask = null;
	let cancelHeartbeat = null;
	let cancelExpiry = null;
	let timerRevision = 0;
	function publish(next) {
		state = next;
		if (!disposed) onChange?.(next);
	}
	function clearTimers() {
		timerRevision += 1;
		cancelHeartbeat?.();
		cancelExpiry?.();
		cancelHeartbeat = null;
		cancelExpiry = null;
	}
	async function request(action) {
		const pending = postPreparedViewing(identity, action, {
			fetcher,
			now
		});
		inFlight = pending;
		try {
			return await pending;
		} finally {
			if (inFlight === pending) inFlight = null;
		}
	}
	function stopLease() {
		if (!attempted) return Promise.resolve();
		if (stopTask) return stopTask;
		const pending = inFlight;
		stopTask = (async () => {
			if (pending) await pending.catch(() => {});
			await postPreparedViewing(identity, "stop", {
				fetcher,
				now
			}).catch(() => {});
		})();
		return stopTask;
	}
	function fail(message) {
		if (closed) return;
		closed = true;
		clearTimers();
		publish({
			status: "error",
			expiresAt: null,
			error: message
		});
		stopLease();
	}
	function markStoppedUnlessError() {
		if (state.status !== "error") publish({
			status: "stopped",
			expiresAt: null,
			error: null
		});
	}
	function armTimers(expiresAt) {
		clearTimers();
		const scheduledRevision = timerRevision;
		cancelExpiry = schedule(() => {
			if (closed || scheduledRevision !== timerRevision) return;
			if (now() < expiresAt) {
				armTimers(expiresAt);
				return;
			}
			fail("Prepared playback could not stay verified. Choose Play prepared copy to try again.");
		}, Math.max(0, expiresAt - now()));
		cancelHeartbeat = schedule(() => {
			if (!closed && scheduledRevision === timerRevision) controller.heartbeat();
		}, 15e3);
	}
	const controller = {
		getState: () => state,
		async start() {
			if (closed || disposed || !isCurrent() || inFlight || state.status === "active") return false;
			attempted = true;
			publish({
				status: "starting",
				expiresAt: null,
				error: null
			});
			try {
				const ack = await request("start");
				if (closed || !isCurrent()) {
					closed = true;
					clearTimers();
					markStoppedUnlessError();
					await stopLease();
					return false;
				}
				publish({
					status: "active",
					expiresAt: ack.expiresAt,
					error: null
				});
				armTimers(ack.expiresAt);
				return true;
			} catch {
				fail("This prepared copy could not be opened safely. Choose Play prepared copy to try again.");
				if (closed) stopLease();
				return false;
			}
		},
		async heartbeat() {
			if (closed || disposed || state.status !== "active" || inFlight) return false;
			cancelHeartbeat?.();
			cancelHeartbeat = null;
			if (!isCurrent() || state.expiresAt === null || now() >= state.expiresAt) {
				fail("Prepared playback could not stay verified. Choose Play prepared copy to try again.");
				return false;
			}
			try {
				const ack = await request("heartbeat");
				if (closed || !isCurrent()) {
					closed = true;
					clearTimers();
					markStoppedUnlessError();
					await stopLease();
					return false;
				}
				publish({
					status: "active",
					expiresAt: ack.expiresAt,
					error: null
				});
				armTimers(ack.expiresAt);
				return true;
			} catch {
				fail("Prepared playback could not stay verified. Choose Play prepared copy to try again.");
				if (closed) stopLease();
				return false;
			}
		},
		stop() {
			closed = true;
			clearTimers();
			if (state.status !== "error") publish({
				status: "stopped",
				expiresAt: null,
				error: null
			});
			return stopLease();
		},
		dispose() {
			disposed = true;
			closed = true;
			clearTimers();
			state = {
				status: "stopped",
				expiresAt: null,
				error: null
			};
			return stopLease();
		}
	};
	return controller;
}
var controls = "min-h-12 min-w-12 rounded-xl border border-white/15 px-4 text-sm hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40";
var emptyState = {
	snapshot: null,
	loading: false,
	mutating: false,
	error: null
};
function PreparationPanel({ titles }) {
	const profileId = activeExperienceProfile(useExperienceStore()).id;
	const activeProfile = (0, import_react.useRef)(profileId);
	activeProfile.current = profileId;
	const controllerRef = (0, import_react.useRef)(null);
	const [stored, setStored] = (0, import_react.useState)({
		profileId: "",
		state: emptyState
	});
	const [titleId, setTitleId] = (0, import_react.useState)("");
	const [recipeId, setRecipeId] = (0, import_react.useState)("");
	const [playing, setPlaying] = (0, import_react.useState)(null);
	const [opening, setOpening] = (0, import_react.useState)(null);
	const [playbackError, setPlaybackError] = (0, import_react.useState)(null);
	const videoRef = (0, import_react.useRef)(null);
	const viewingRef = (0, import_react.useRef)(null);
	function closeViewing(clearError = true) {
		const viewing = viewingRef.current;
		if (viewing?.profileId === profileId) {
			viewingRef.current = null;
			videoRef.current?.pause();
			viewing.controller.dispose();
		}
		setPlaying(null);
		setOpening(null);
		if (clearError) setPlaybackError(null);
	}
	function openViewing(job) {
		closeViewing();
		setOpening({
			profileId,
			jobId: job.id
		});
		let controller;
		try {
			controller = createPreparedViewingController({
				profileId,
				jobId: job.id,
				isCurrent: () => viewingRef.current?.controller === controller && activeProfile.current === profileId && activeExperienceProfile(useExperienceStore.getState()).id === profileId,
				onChange: (next) => {
					if (viewingRef.current?.controller !== controller || activeProfile.current !== profileId) return;
					if (next.status === "active") {
						setOpening(null);
						setPlaying((current) => current?.profileId === profileId && current.jobId === job.id ? current : {
							profileId,
							jobId: job.id
						});
					} else if (next.status === "error" || next.status === "stopped") {
						videoRef.current?.pause();
						setOpening(null);
						setPlaying(null);
						if (next.error) setPlaybackError(next.error);
					}
				}
			});
		} catch {
			setOpening(null);
			setPlaybackError("Prepared playback could not be started. Choose Play prepared copy to try again.");
			return;
		}
		viewingRef.current = {
			profileId,
			controller
		};
		controller.start();
	}
	(0, import_react.useEffect)(() => () => {
		const viewing = viewingRef.current;
		if (viewing?.profileId !== profileId) return;
		viewingRef.current = null;
		videoRef.current?.pause();
		viewing.controller.dispose();
	}, [profileId]);
	(0, import_react.useEffect)(() => {
		setTitleId("");
		setRecipeId("");
		setPlaying(null);
		setOpening(null);
		setPlaybackError(null);
		if (!profileId) {
			setStored({
				profileId,
				state: {
					...emptyState,
					error: "Choose your profile to view prepared media."
				}
			});
			return;
		}
		const controller = createPreparationController({
			expectedProfileId: profileId,
			isCurrent: () => activeProfile.current === profileId && activeExperienceProfile(useExperienceStore.getState()).id === profileId,
			onChange: (state) => setStored({
				profileId,
				state
			})
		});
		controllerRef.current = controller;
		const onVisibility = () => controller.setVisible(document.visibilityState === "visible");
		onVisibility();
		if (document.visibilityState === "visible") controller.refresh();
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			document.removeEventListener("visibilitychange", onVisibility);
			controller.dispose();
			if (controllerRef.current === controller) controllerRef.current = null;
		};
	}, [profileId]);
	const state = stored.profileId === profileId ? stored.state : {
		...emptyState,
		loading: Boolean(profileId)
	};
	const snapshot = state.snapshot;
	const busy = state.loading || state.mutating;
	const chosenTitle = titles.find((title) => title.id === titleId)?.id || titles[0]?.id || "";
	const chosenRecipe = snapshot?.recipes.find((recipe) => recipe.id === recipeId)?.id || snapshot?.recipes[0]?.id || "";
	const playingJob = playing?.profileId === profileId ? snapshot?.jobs.find((job) => job.id === playing.jobId && job.status === "ready") : null;
	const playingUrl = playingJob ? preparedFileUrl(playingJob, profileId) : null;
	const openingHere = opening?.profileId === profileId ? opening : null;
	(0, import_react.useEffect)(() => {
		if (playing?.profileId === profileId && !playingJob) {
			closeViewing(false);
			setPlaybackError("This prepared copy is no longer verified. Refresh its status before playing again.");
		}
	}, [
		playing,
		playingJob,
		profileId
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-label": "Prepared media",
		className: "space-y-5 rounded-[1.55rem] bg-white/[.035] p-5 sm:p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-2xl tracking-tight",
					children: "Prepared media"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-white/55",
					children: "Prepare a copy of an eligible original in this home. Your original stays unchanged."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: controls,
					disabled: busy || !profileId,
					onClick: () => void controllerRef.current?.refresh(),
					children: "Refresh preparation"
				})]
			}),
			state.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "alert",
				className: "space-y-3 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: state.error }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: controls,
					disabled: busy || !profileId,
					onClick: () => void controllerRef.current?.refresh(),
					children: "Retry loading preparation"
				})]
			}) : null,
			state.loading && !snapshot ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				role: "status",
				className: "text-sm text-white/55",
				children: "Checking prepared media…"
			}) : null,
			snapshot?.canManage ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 sm:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "space-y-2 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block",
								children: "Original title"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								"aria-label": "Original title",
								className: `${controls} w-full bg-zinc-950`,
								value: chosenTitle,
								disabled: busy || !titles.length,
								onChange: (event) => setTitleId(event.target.value),
								children: titles.length ? titles.map((title) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: title.id,
									children: title.title
								}, title.id)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "",
									children: "No eligible originals available"
								})
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "space-y-2 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block",
								children: "Prepared copy"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								"aria-label": "Prepared copy",
								className: `${controls} w-full bg-zinc-950`,
								value: chosenRecipe,
								disabled: busy || !snapshot.recipes.length,
								onChange: (event) => setRecipeId(event.target.value),
								children: snapshot.recipes.length ? snapshot.recipes.map((recipe) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: recipe.id,
									children: recipe.label
								}, recipe.id)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "",
									children: "No preparation recipes available"
								})
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: `${controls} bg-white/10`,
						disabled: busy || !chosenTitle || !chosenRecipe,
						onClick: () => void controllerRef.current?.prepare(chosenTitle, chosenRecipe),
						children: "Prepare media"
					}),
					state.mutating ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						role: "status",
						className: "text-sm text-white/55",
						children: "Confirming your preparation request…"
					}) : null
				]
			}) : snapshot ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-white/55",
				children: "Only the home owner can manage preparation."
			}) : null,
			snapshot && snapshot.jobs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-white/45",
				children: "No prepared copies have been reported for this profile."
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-3",
				children: snapshot?.jobs.map((job) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "space-y-3 rounded-xl border border-white/10 p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-medium",
								children: job.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-sm capitalize text-white/60",
								children: job.status
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-white/45",
							children: snapshot.recipes.find((recipe) => recipe.id === job.recipe)?.label || job.recipe
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-white/60",
							children: job.message
						}),
						job.progress !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("progress", {
								"aria-label": `Preparation progress for ${job.title}`,
								max: 1,
								value: job.progress,
								className: "h-2 w-full accent-current"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-xs tabular-nums text-white/55",
								children: [Math.floor(job.progress * 100), "%"]
							})]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-2",
							children: [
								snapshot.canManage && preparationIsActive(job) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: controls,
									disabled: busy,
									onClick: () => void controllerRef.current?.cancel(job),
									children: "Cancel preparation"
								}) : null,
								snapshot.canManage && job.canRetry && [
									"deferred",
									"failed",
									"cancelled",
									"interrupted"
								].includes(job.status) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: controls,
									disabled: busy,
									onClick: () => void controllerRef.current?.retry(job),
									children: "Retry preparation"
								}) : null,
								job.status === "ready" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: controls,
									disabled: Boolean(openingHere),
									onClick: () => openViewing(job),
									children: "Play prepared copy"
								}) : null
							]
						})
					]
				}, job.id))
			}),
			openingHere ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					role: "status",
					className: "text-sm",
					children: "Opening prepared playback…"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: controls,
					onClick: () => closeViewing(),
					children: "Close prepared playback"
				})]
			}) : null,
			playingJob && playingUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm",
						children: playingJob.title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: controls,
						onClick: () => closeViewing(),
						children: "Close prepared playback"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
					ref: videoRef,
					src: playingUrl,
					controls: true,
					playsInline: true,
					autoPlay: true,
					preload: "metadata",
					"aria-label": `Prepared copy of ${playingJob.title}`,
					className: "max-h-[65vh] w-full rounded-xl bg-black",
					onError: () => {
						closeViewing(false);
						setPlaybackError("This prepared copy could not be played. Refresh its status and try again.");
					}
				}, playingUrl)]
			}) : null,
			playbackError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				role: "alert",
				className: "text-sm",
				children: playbackError
			}) : null
		]
	});
}
var FILLER = /* @__PURE__ */ new Set([
	"a",
	"an",
	"and",
	"anything",
	"find",
	"for",
	"give",
	"i",
	"in",
	"is",
	"like",
	"me",
	"movie",
	"movies",
	"of",
	"please",
	"series",
	"show",
	"shows",
	"something",
	"that",
	"the",
	"to",
	"tv",
	"watch",
	"with"
]);
var SEARCH_MOOD_ALIASES = {
	comfort: [
		"comfort",
		"comforting",
		"cozy",
		"gentle",
		"warm"
	],
	funny: [
		"funny",
		"comedy",
		"laugh",
		"lighthearted"
	],
	dark: [
		"dark",
		"grim",
		"bleak",
		"noir"
	],
	quiet: [
		"quiet",
		"calm",
		"patient",
		"slow"
	],
	romantic: [
		"romantic",
		"romance",
		"date night"
	],
	tense: [
		"tense",
		"thrilling",
		"thriller",
		"suspense"
	],
	strange: [
		"strange",
		"weird",
		"surreal",
		"unusual"
	],
	adventurous: [
		"adventure",
		"adventurous",
		"epic",
		"big"
	]
};
function normalizeSearchText(value) {
	return String(value ?? "").toLowerCase().normalize("NFKD").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function unique$1(items) {
	return [...new Set(items)];
}
function parseSearchIntent(rawQuery) {
	const raw = rawQuery.trim().slice(0, 240);
	const normalized = normalizeSearchText(raw);
	const excludedTerms = [];
	for (const match of normalized.matchAll(/(?:without|except|exclude|excluding|no)\s+([a-z0-9 ]+?)(?=\s+(?:under|over|with|starring|movie|movies|series|show|book|novel)\b|$)/g)) {
		const phrase = match[1]?.trim();
		if (phrase) excludedTerms.push(...phrase.split(/\s*(?:,|\band\b)\s*/).filter(Boolean));
	}
	let kind;
	if (/\b(book|books|novel|novels|read|reading)\b/.test(normalized)) kind = "book";
	else if (/\b(series|show|shows|tv)\b/.test(normalized)) kind = "series";
	else if (/\b(movie|movies|film|films)\b/.test(normalized)) kind = "movie";
	let maxMinutes;
	const duration = normalized.match(/\b(?:under|less than|shorter than|within)\s+(\d{2,3})\s*(?:minutes?|mins?)?\b/);
	if (duration) maxMinutes = Math.min(360, Math.max(20, Number(duration[1])));
	else if (/\b(short|quick)\b/.test(normalized)) maxMinutes = kind === "series" ? 45 : 100;
	const moods = Object.entries(SEARCH_MOOD_ALIASES).filter(([, aliases]) => aliases.some((alias) => normalized.includes(alias))).map(([mood]) => mood);
	const person = normalized.match(/\b(?:with|starring|featuring)\s+([a-z][a-z ]{2,40}?)(?=\s+(?:without|under|less|movie|series|show|book)\b|$)/)?.[1]?.trim() || void 0;
	const sceneClue = /\b(scene|moment|part)\s+(?:where|when|with)\b|\bremember(?:ed)?\b/.test(normalized);
	const terms = unique$1(normalized.replace(/(?:without|except|exclude|excluding|no)\s+[a-z0-9 ]+?(?=\s+(?:under|over|with|starring|movie|movies|series|show|book|novel)\b|$)/g, " ").replace(/\b(?:under|less than|shorter than|within)\s+\d{2,3}\s*(?:minutes?|mins?)?\b/g, " ").replace(/\b(?:short|quick)\b/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean).filter((word) => word.length > 2 && !FILLER.has(word) && ![
		"film",
		"films",
		"book",
		"books",
		"novel",
		"novels",
		"read",
		"reading"
	].includes(word)));
	return {
		raw,
		lookupQuery: person || terms.join(" ") || raw,
		terms,
		excludedTerms: unique$1(excludedTerms.map(normalizeSearchText).filter(Boolean)),
		kind,
		maxMinutes,
		moods,
		person,
		sceneClue
	};
}
function suggestionsForIntent(intent) {
	const suggestions = [];
	if (!intent.kind) suggestions.push({
		label: "Movies",
		addition: " movie"
	}, {
		label: "Series",
		addition: " series"
	}, {
		label: "Books",
		addition: " books"
	});
	if (!intent.maxMinutes) suggestions.push({
		label: "Under 100 min",
		addition: " under 100 minutes"
	});
	if (!intent.excludedTerms.length) suggestions.push({
		label: "No horror",
		addition: " without horror"
	});
	return suggestions.slice(0, 5);
}
function unique(items) {
	return [...new Set(items)];
}
function asStringArray(value) {
	if (!Array.isArray(value)) return [];
	return value.map((item) => typeof item === "string" ? item : typeof item === "object" && item ? String(item.name ?? "") : "").filter(Boolean);
}
function searchable(title) {
	return normalizeSearchText([
		title.title,
		...title.genres,
		...title.people,
		...title.moods,
		title.note
	].join(" "));
}
function matchesExclusions(title, excluded) {
	const haystack = searchable(title);
	return !excluded.some((term) => haystack.includes(term));
}
function moodScore(title, intent) {
	const haystack = searchable(title);
	let score = 0;
	for (const mood of intent.moods) if ((SEARCH_MOOD_ALIASES[mood] ?? [mood]).some((alias) => haystack.includes(normalizeSearchText(alias)))) score += 4;
	return score;
}
function rankLocalSearch(intent, catalog = EXPERIENCE_CATALOG) {
	if (!intent.raw) return catalog.slice(0, 18);
	return catalog.filter((title) => !intent.kind || title.kind === intent.kind).filter((title) => !intent.maxMinutes || title.minutes <= intent.maxMinutes).filter((title) => matchesExclusions(title, intent.excludedTerms)).map((title) => {
		const haystack = searchable(title);
		const exact = normalizeSearchText(title.title) === normalizeSearchText(intent.lookupQuery) ? 20 : 0;
		const prefix = normalizeSearchText(title.title).startsWith(normalizeSearchText(intent.lookupQuery)) ? 8 : 0;
		const terms = intent.terms.reduce((score, term) => score + (haystack.includes(term) ? 2 : 0), 0);
		return {
			title,
			score: exact + prefix + terms + moodScore(title, intent)
		};
	}).filter(({ score }) => score > 0 || !intent.terms.length && intent.moods.length > 0).sort((a, b) => b.score - a.score || b.title.year - a.title.year).map(({ title }) => title);
}
function mapLookupTitle(raw) {
	const id = String(raw.id ?? "").trim();
	const title = String(raw.title ?? raw.name ?? "").trim();
	if (!id || !title) return null;
	const backendKind = String(raw.kind ?? raw.mediaType ?? "movie").toLowerCase();
	const kind = backendKind === "tv" || backendKind === "series" ? "series" : "movie";
	const inLibrary = Boolean(raw.inLibrary || raw.jellyfinId);
	const publicLookupSource = sourceForLookupTitle(raw);
	const sources = inLibrary ? [{
		kind: "retained_local",
		verified: true
	}] : publicLookupSource ? [publicLookupSource] : sourcesForExperienceTitle(id);
	const runtime = Number(raw.runtime);
	const runtimeKnown = Number.isFinite(runtime) && runtime > 0;
	const people = unique([...asStringArray(raw.people), ...asStringArray(raw.cast)]);
	return {
		id,
		title,
		year: Number(raw.year) || 0,
		kind,
		genres: asStringArray(raw.genres),
		poster: String(raw.poster ?? ""),
		backdrop: String(raw.backdrop ?? raw.banner ?? raw.poster ?? ""),
		note: String(raw.overview ?? "").trim() || (inLibrary ? "In your personal library." : "Found in the wider catalog."),
		people,
		moods: [],
		minutes: runtimeKnown ? runtime : 0,
		runtimeKnown,
		sources,
		playbackId: inLibrary ? String(raw.jellyfinId ?? raw.id ?? "") : void 0
	};
}
function mergeSearchTitles(local, remote, intent) {
	const seen = /* @__PURE__ */ new Set();
	return [...local, ...remote].filter((title) => !intent.kind || title.kind === intent.kind).filter((title) => !intent.maxMinutes || title.runtimeKnown !== false && title.minutes <= intent.maxMinutes).filter((title) => matchesExclusions(title, intent.excludedTerms)).filter((title) => {
		const key = `${normalizeSearchText(title.title)}:${title.year || ""}:${title.kind}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	}).slice(0, 36);
}
function mapPerson(raw) {
	const id = String(raw.id ?? raw.tmdbId ?? "").trim();
	const name = String(raw.name ?? "").trim();
	if (!id || !name) return null;
	return {
		id,
		name,
		poster: String(raw.poster ?? "") || void 0,
		knownFor: String(raw.knownForDepartment ?? "") || void 0
	};
}
function mapCollection(raw) {
	const id = String(raw.id ?? raw.tmdbId ?? "").trim();
	const name = String(raw.name ?? raw.title ?? "").trim();
	if (!id || !name) return null;
	return {
		id,
		name,
		poster: String(raw.poster ?? "") || void 0
	};
}
function mapBook(raw, licensed, honesty) {
	const id = String(raw.id ?? "").trim();
	const title = String(raw.title ?? "").trim();
	const author = String(raw.author ?? "Unknown").trim();
	if (!id || !title) return null;
	return {
		id,
		title,
		author,
		source: String(raw.source ?? (licensed ? "Catalog" : "Open library")),
		year: Number(raw.year) || null,
		format: String(raw.format ?? "") || void 0,
		downloadUrl: String(raw.downloadUrl ?? "") || void 0,
		cover: String(raw.cover ?? "") || null,
		licensed,
		honesty: String(raw.honesty ?? honesty ?? "") || void 0
	};
}
async function readJson(response) {
	if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
	return response.json();
}
async function searchReelOS(rawQuery, options = {}) {
	const intent = parseSearchIntent(rawQuery);
	const local = rankLocalSearch(intent);
	const fetcher = options.fetcher ?? fetch;
	const includeBooks = options.includeBooks !== false;
	const lookupQuery = intent.lookupQuery.trim();
	const jobs = [];
	if (lookupQuery.length >= 2 && intent.kind !== "book") jobs.push(fetcher(`/api/lookup?q=${encodeURIComponent(lookupQuery)}`, {
		cache: "no-store",
		signal: options.signal
	}).then((response) => readJson(response)).then((value) => ({
		kind: "lookup",
		value
	})).catch((error) => {
		if (error?.name === "AbortError") throw error;
		return {
			kind: "lookup",
			error: "Film and television catalog"
		};
	}));
	if (lookupQuery.length >= 2 && includeBooks) jobs.push(fetcher(`/api/books/search?q=${encodeURIComponent(lookupQuery)}`, {
		cache: "no-store",
		signal: options.signal
	}).then((response) => readJson(response)).then((value) => ({
		kind: "books",
		value
	})).catch((error) => {
		if (error?.name === "AbortError") throw error;
		return {
			kind: "books",
			error: "Books catalog"
		};
	}));
	const settled = await Promise.all(jobs);
	const lookup = settled.find((item) => item.kind === "lookup")?.value;
	const books = settled.find((item) => item.kind === "books")?.value;
	const remote = (lookup?.titles ?? []).map(mapLookupTitle).filter((title) => Boolean(title));
	const people = (lookup?.people ?? []).map(mapPerson).filter((person) => Boolean(person));
	const collections = (lookup?.collections ?? []).map(mapCollection).filter((collection) => Boolean(collection));
	const openBooks = (books?.results ?? []).map((book) => mapBook(book, false)).filter((book) => Boolean(book));
	const licensedBooks = (books?.licensed ?? []).map((book) => mapBook(book, true, books?.honesty)).filter((book) => Boolean(book));
	const unavailable = unique([...settled.map((item) => item.error).filter((item) => Boolean(item)), ...books?.unavailable ?? []]);
	const notices = [];
	if (intent.sceneClue) notices.push("Scene wording is being used as a catalog clue. Exact scene matching turns on only for media with an indexed timeline.");
	if (lookup?.error && !remote.length) notices.push("The wider film and television catalog did not answer; personal results remain available.");
	if (licensedBooks.length) notices.push(books?.honesty || "Licensed books are shown for discovery; ReelOS does not imply an included download.");
	return {
		intent,
		titles: intent.kind === "book" ? [] : mergeSearchTitles(local, remote, intent),
		people,
		collections,
		books: [...openBooks, ...licensedBooks].slice(0, 16),
		suggestions: suggestionsForIntent(intent),
		unavailable,
		notices,
		liveCatalogReached: settled.some((item) => item.kind === "lookup" && !item.error)
	};
}
var usefulWords = (value) => new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2));
var stableHash = (value) => {
	let hash = 2166136261;
	for (const character of value) {
		hash ^= character.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
};
/** A normal tap progresses from no opinion to Like, then from Like to Love. */
function nextTasteReaction(reaction) {
	return reaction === "like" ? "love" : reaction === "love" ? "love" : "like";
}
/**
* Builds one viewport of an endless field. It is deliberately deterministic so
* reloads feel continuous, while the cycle advances whenever a bubble leaves.
*/
function tasteFieldViewport(items, signals, departedIds, cycle, limit = 15) {
	const dismissed = new Set(signals.dismissedIds);
	const departed = new Set(departedIds);
	const lessLike = new Set(signals.lessLikeIds);
	const byId = new Map(items.map((item) => [item.id, item]));
	const positive = Object.entries(signals.reactions).flatMap(([id, reaction]) => {
		const item = byId.get(id);
		return item ? [{
			item,
			reaction
		}] : [];
	});
	const scored = items.filter((item) => !dismissed.has(item.id) && !departed.has(item.id)).map((item) => {
		const words = usefulWords(`${item.title} ${item.subtitle}`);
		let affinity = 0;
		for (const signal of positive) {
			const signalWords = usefulWords(`${signal.item.title} ${signal.item.subtitle}`);
			let overlap = 0;
			for (const word of words) if (signalWords.has(word)) overlap += 1;
			const weight = signal.reaction === "love" ? 7 : signal.reaction === "cozy" ? 5 : 3;
			affinity += overlap * weight + (signal.item.kind === item.kind ? weight / 3 : 0);
		}
		if (lessLike.has(item.id)) affinity -= 100;
		if (signals.reactions[item.id]) affinity -= 12;
		const variety = (stableHash(item.id) + cycle * 2654435761 >>> 0) / 2 ** 32;
		return {
			item,
			score: affinity + variety * 2
		};
	}).sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id));
	const chosen = [];
	for (const kind of ["person", "mood"]) {
		const match = scored.find(({ item }) => item.kind === kind);
		if (match) chosen.push(match.item);
	}
	for (const { item } of scored) {
		if (chosen.some((candidate) => candidate.id === item.id)) continue;
		chosen.push(item);
		if (chosen.length >= limit) break;
	}
	return chosen.slice(0, limit);
}
function redactUrl(url) {
	const path = url.pathname === "/" ? "" : url.pathname;
	return `${url.hostname}${path}`.slice(0, 160);
}
/**
* Performs only local shape validation. It never fetches, stores, or activates
* a submitted URL; that must happen later inside an owner-authorized flow.
*/
function inspectSourceLink(value) {
	const raw = value.trim();
	if (!/^https?:\/\//i.test(raw)) return null;
	try {
		const url = new URL(raw);
		if (!/(?:torznab|newznab|indexer|feed|rss|api|source)/i.test(`${url.hostname}${url.pathname}`)) return null;
		const privateMaterial = Boolean(url.username || url.password || url.search);
		const secure = url.protocol === "https:";
		return {
			kind: secure && !privateMaterial ? "source-link" : "unsupported",
			safeToReview: secure && !privateMaterial,
			display: redactUrl(url),
			message: !secure ? "For your privacy, source setup only reviews HTTPS links." : privateMaterial ? "This link appears to include private details. Remove keys, passwords, and query text before reviewing it here." : "ReelOS can guide the appliance owner to review this source privately. It will not contact or save it from search."
		};
	} catch {
		return null;
	}
}
function inferConciergeIntent(value) {
	const text = value.toLowerCase();
	if (/\b(set ?up|start|onboard|first time|name)\b/.test(text)) return "onboarding";
	if (/\b(import|folder|file|personal media|my media)\b/.test(text)) return "personal-media";
	if (/\b(torbox|real.?debrid|provider|key)\b/.test(text)) return "provider";
	if (/\b(indexer|torznab|newznab|rss|source link)\b/.test(text)) return "source-setup";
	if (/\b(unavailable|cant play|can't play|not available|why)\b/.test(text)) return "unavailable-title";
	return "general";
}
function conciergeGuidance(intent) {
	return {
		onboarding: "Start with the people in this home, a favorite color, then a few titles or actors. You can always tune taste later.",
		"personal-media": "Bring in media you already own from the owner settings. ReelOS keeps imported files separate from provider-only availability.",
		provider: "A provider is optional. Public-domain and personal media still work when it is off. Connect one only from owner settings and validate it before it appears available.",
		"source-setup": "Source connections are owner-only. Review the link privately, then confirm before anything is saved or contacted.",
		"unavailable-title": "A title can help ReelOS understand taste without being playable here. Search can show wider catalog context, while Home and No idea stay inside what this home can access.",
		general: "I can help with setup, personal media, providers, source setup, or why a title is unavailable."
	}[intent];
}
var MOOD_WORDS = {
	comfort: [
		"warm",
		"comfort",
		"cozy",
		"gentle",
		"familiar",
		"playful"
	],
	funny: [
		"fun",
		"funny",
		"comedy",
		"playful",
		"sharp"
	],
	wonder: [
		"wonder",
		"beautiful",
		"transporting",
		"colorful",
		"epic"
	],
	edge: [
		"tense",
		"dark",
		"restless",
		"urgent",
		"kinetic"
	],
	quiet: [
		"quiet",
		"patient",
		"human",
		"cerebral",
		"gentle"
	]
};
function stableNumber(value) {
	let number = 0;
	for (const character of value) number = number * 31 + character.charCodeAt(0) >>> 0;
	return number;
}
function durationMatches(title, duration) {
	if (duration === "short") return title.minutes <= 100;
	if (duration === "feature") return title.minutes > 100 && title.minutes <= 145;
	if (duration === "long") return title.minutes > 145 || title.kind === "series";
	return true;
}
function sharedTasteWords(profile, title) {
	const titleWords = new Set([...title.genres, ...title.moods].map((word) => word.toLowerCase()));
	const matches = /* @__PURE__ */ new Set();
	for (const [id, reaction] of Object.entries(profile.reactions)) {
		if (!reaction) continue;
		if (id === title.id) matches.add("itself");
	}
	return {
		titleWords,
		matches
	};
}
function reasonFor(title, profile, clue, exploration) {
	if (clue.kind === "duration") return title.kind === "series" ? `${title.minutes} minutes gets you through one episode.` : `${title.minutes} minutes—inside the time you gave ReelOS.`;
	if (clue.kind === "mood") return `${clue.label}, translated into ${title.genres[0]?.toLowerCase() || "a story"} with ${title.moods[0] || "its own pull"}.`;
	if (clue.kind === "company") {
		if (clue.value === "kids") return "Safe for the whole group, without feeling like a compromise.";
		if (clue.value === "together") return "A strong shared-room choice with enough personality to talk about afterward.";
		return "A choice that can belong entirely to your night.";
	}
	if (exploration === "familiar") return profile.savedIds.includes(title.id) || profile.reactions[title.id] ? "Already connected to your taste, so this is the low-risk answer." : `Close to the shape of ${profile.name}’s favorites.`;
	if (exploration === "adventurous") return "Outside your usual orbit, but connected enough to be worth the leap.";
	return title.note || `A balanced match for ${profile.name} right now.`;
}
function buildDecisionPicks({ profile, titles, availableIds = [], clue, exploration, offset = 0 }) {
	const available = new Set(availableIds);
	const reacted = new Set(Object.keys(profile.reactions));
	const known = /* @__PURE__ */ new Set([
		...reacted,
		...profile.savedIds,
		...Object.keys(profile.progress)
	]);
	const moodWords = clue.kind === "mood" ? MOOD_WORDS[clue.value] || [clue.value] : [];
	const moodMatches = (title) => clue.kind !== "mood" || title.moods.some((mood) => moodWords.some((word) => mood.toLowerCase().includes(word)));
	const moodEligible = titles.filter(moodMatches);
	const ranked = (clue.kind === "mood" && moodEligible.length ? moodEligible : titles).filter((title) => !profile.lessLikeIds.includes(title.id)).filter((title) => clue.kind !== "duration" || durationMatches(title, clue.value)).filter((title) => clue.kind !== "company" || clue.value !== "kids" || title.family).map((title, index) => {
		let score = 100 - Math.min(index, 60);
		const reaction = profile.reactions[title.id];
		if (reaction === "love") score += 36;
		if (reaction === "cozy") score += 28;
		if (reaction === "like") score += 18;
		if (profile.savedIds.includes(title.id)) score += 16;
		if (profile.progress[title.id]) score += 8;
		if (available.has(title.id)) score += 80;
		if (clue.kind === "mood") score += title.moods.filter((mood) => moodWords.some((word) => mood.toLowerCase().includes(word))).length * 34;
		if (clue.kind === "company" && clue.value === "together" && title.family) score += 8;
		if (exploration === "familiar") score += known.has(title.id) ? 50 : -8;
		if (exploration === "adventurous") score += known.has(title.id) ? -70 : 22;
		const { matches } = sharedTasteWords(profile, title);
		score += matches.size * 5;
		score += stableNumber(`${profile.id}:${title.id}:${offset}`) % 7;
		return {
			title,
			score
		};
	}).sort((left, right) => right.score - left.score);
	const chosen = [];
	const usedLeadGenres = /* @__PURE__ */ new Set();
	const rotated = offset > 0 ? [...ranked.slice(offset % Math.max(ranked.length, 1)), ...ranked.slice(0, offset % Math.max(ranked.length, 1))] : ranked;
	for (const { title } of rotated) {
		const leadGenre = title.genres[0]?.toLowerCase() || title.kind;
		if (chosen.length < 2 && usedLeadGenres.has(leadGenre)) continue;
		chosen.push(title);
		usedLeadGenres.add(leadGenre);
		if (chosen.length === 3) break;
	}
	if (chosen.length < 3) for (const { title } of rotated) {
		if (!chosen.some((item) => item.id === title.id)) chosen.push(title);
		if (chosen.length === 3) break;
	}
	return chosen.map((title) => ({
		title,
		reason: reasonFor(title, profile, clue, exploration)
	}));
}
var moodByGenre = {
	comedy: ["fun", "warm"],
	drama: ["human", "absorbing"],
	horror: ["dark", "tense"],
	thriller: ["tense", "restless"],
	action: ["kinetic", "big"],
	adventure: ["wonder", "transporting"],
	animation: ["colorful", "playful"],
	romance: ["warm", "emotional"],
	mystery: ["cerebral", "patient"],
	documentary: ["curious", "patient"],
	fantasy: ["wonder", "transporting"],
	"science fiction": ["cerebral", "big"],
	"sci-fi": ["cerebral", "big"]
};
function normalizeProgress(value) {
	const number = Number(value);
	if (!Number.isFinite(number) || number <= 0) return 0;
	return Math.max(0, Math.min(.99, number > 1 ? number / 100 : number));
}
function mapLibraryTitle(raw) {
	const id = String(raw.id || "").trim();
	const title = String(raw.title || "").trim();
	if (!id || !title) return null;
	const genres = Array.isArray(raw.genres) ? raw.genres.filter((genre) => typeof genre === "string" && Boolean(genre.trim())) : [];
	const moods = [...new Set(genres.flatMap((genre) => moodByGenre[genre.toLowerCase()] || []))];
	const kind = raw.kind === "tv" || raw.kind === "series" ? "series" : raw.kind === "book" ? "book" : "movie";
	const declaredSource = raw.sourceVerified === true ? raw.sourceKind === "provider_stream" || raw.sourceKind === "debrid" ? {
		kind: "debrid",
		verified: true
	} : raw.sourceKind === "personal_import" || raw.sourceKind === "public_domain" || raw.sourceKind === "retained_local" ? {
		kind: raw.sourceKind,
		verified: true
	} : raw.sourceKind === "prepared_rendition" ? {
		kind: "retained_local",
		verified: true
	} : null : null;
	const sources = declaredSource ? [declaredSource] : [{
		kind: "retained_local",
		verified: true
	}];
	return {
		id,
		title,
		year: Number.isFinite(Number(raw.year)) ? Number(raw.year) : 0,
		kind,
		genres: genres.length ? genres : [kind === "series" ? "Series" : "Film"],
		poster: typeof raw.poster === "string" ? raw.poster : "",
		backdrop: typeof raw.backdrop === "string" ? raw.backdrop : "",
		note: typeof raw.overview === "string" && raw.overview.trim() ? raw.overview.trim() : "Ready on this ReelOS box.",
		people: typeof raw.director === "string" && raw.director.trim() ? [raw.director.trim()] : [],
		moods: moods.length ? moods : ["absorbing"],
		minutes: Number.isFinite(Number(raw.runtime)) && Number(raw.runtime) > 0 ? Number(raw.runtime) : kind === "series" ? 48 : 110,
		runtimeKnown: Number.isFinite(Number(raw.runtime)) && Number(raw.runtime) > 0,
		family: raw.isKids === true,
		sources,
		playbackId: String(raw.jellyfinId || id)
	};
}
async function loadLiveLibrary(signal) {
	try {
		const response = await fetch("/api/library?limit=80", {
			cache: "no-store",
			signal
		});
		if (!response.ok) throw new Error(`Library returned ${response.status}`);
		const payload = await response.json();
		const rawTitles = [...Array.isArray(payload.titles) ? payload.titles : [], ...Array.isArray(payload.continueWatching) ? payload.continueWatching : []];
		const byId = /* @__PURE__ */ new Map();
		for (const raw of rawTitles) {
			const mapped = mapLibraryTitle(raw);
			if (mapped) byId.set(mapped.id, mapped);
		}
		const progress = {};
		for (const raw of payload.continueWatching || []) {
			const id = String(raw.id || "");
			const value = normalizeProgress(raw.progress);
			if (id && value > 0) progress[id] = value;
		}
		return {
			titles: [...byId.values()],
			progress,
			status: "live",
			...payload.error ? { message: payload.error } : {}
		};
	} catch (error) {
		if (signal?.aborted) throw error;
		return {
			titles: [],
			progress: {},
			status: "unavailable",
			message: error instanceof Error ? error.message : "Library unavailable"
		};
	}
}
function mergeExperienceTitles(catalog, live) {
	const result = [...live];
	const seen = new Set(live.flatMap((title) => [title.id, title.playbackId || ""]));
	for (const title of catalog) {
		if (seen.has(title.id) || title.playbackId && seen.has(title.playbackId)) continue;
		result.push(title);
	}
	return result;
}
function emptyAvailability(mediaType, externalId, region, reason) {
	return {
		ok: true,
		available: false,
		mediaType,
		externalId,
		region,
		groups: {
			subscription: [],
			free: [],
			ads: [],
			rent: [],
			buy: []
		},
		link: null,
		attribution: {
			provider: "JustWatch",
			text: "Availability data by JustWatch.",
			url: "https://www.justwatch.com/"
		},
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
		reason
	};
}
async function loadStreamingAvailability(input, signal) {
	const externalId = String(input.externalId).trim();
	const region = String(input.region || "US").trim().toUpperCase();
	const query = new URLSearchParams({
		mediaType: input.mediaType,
		externalId,
		region
	});
	try {
		const response = await fetch(`/api/availability?${query}`, {
			cache: "no-store",
			signal
		});
		if (!response.ok) throw new Error(`Availability returned ${response.status}`);
		return await response.json();
	} catch (error) {
		if (signal?.aborted) throw error;
		return emptyAvailability(input.mediaType, externalId, region, "request_failed");
	}
}
function profileToServer(profile, pin) {
	return {
		...profile,
		experienceVersion: 2,
		isKids: Boolean(profile.isChild),
		watchlist: profile.savedIds,
		watchProgress: profile.progress,
		...pin !== void 0 ? { pin: pin ?? "" } : {}
	};
}
function profileFromServer(raw) {
	if (Number(raw.experienceVersion) !== 2 || typeof raw.id !== "string" || typeof raw.name !== "string") return null;
	return {
		id: raw.id,
		name: raw.name,
		color: typeof raw.color === "string" ? raw.color : "#9eb6ff",
		isChild: Boolean(raw.isKids),
		isGuest: Boolean(raw.isGuest),
		pinEnabled: Boolean(raw.pinEnabled),
		summaryOnly: raw.summaryOnly === true,
		atmosphere: raw.atmosphere !== false,
		transparency: raw.transparency !== false,
		motion: raw.motion === "still" || raw.motion === "expressive" ? raw.motion : "subtle",
		density: raw.density === "compact" ? "compact" : "comfortable",
		exploration: raw.exploration === "familiar" || raw.exploration === "adventurous" ? raw.exploration : "balanced",
		reactions: typeof raw.reactions === "object" && raw.reactions ? raw.reactions : {},
		dismissedTasteIds: Array.isArray(raw.dismissedTasteIds) ? raw.dismissedTasteIds.filter((id) => typeof id === "string") : [],
		lessLikeIds: Array.isArray(raw.lessLikeIds) ? raw.lessLikeIds.filter((id) => typeof id === "string") : [],
		savedIds: Array.isArray(raw.savedIds) ? raw.savedIds.filter((id) => typeof id === "string") : [],
		progress: typeof raw.progress === "object" && raw.progress ? raw.progress : {},
		bookProgress: typeof raw.bookProgress === "object" && raw.bookProgress ? raw.bookProgress : {},
		bookLocations: typeof raw.bookLocations === "object" && raw.bookLocations ? raw.bookLocations : {},
		bookBookmarks: typeof raw.bookBookmarks === "object" && raw.bookBookmarks ? raw.bookBookmarks : {},
		readingAppearance: typeof raw.readingAppearance === "object" && raw.readingAppearance ? {
			theme: raw.readingAppearance.theme === "sepia" || raw.readingAppearance.theme === "light" || raw.readingAppearance.theme === "slate" ? raw.readingAppearance.theme : "dark",
			fontSizeIndex: Math.max(0, Math.min(4, Number(raw.readingAppearance.fontSizeIndex ?? 1)))
		} : {
			theme: "dark",
			fontSizeIndex: 1
		},
		audioPreference: raw.audioPreference === "dub" || raw.audioPreference === "sub" ? raw.audioPreference : "original",
		subtitleLanguage: typeof raw.subtitleLanguage === "string" ? raw.subtitleLanguage : "English",
		maturity: raw.maturity === "little" || raw.maturity === "big" || raw.maturity === "teen" || raw.maturity === "mature" ? raw.maturity : void 0,
		bedtime: typeof raw.bedtime === "string" ? raw.bedtime : void 0,
		boundaries: typeof raw.boundaries === "object" && raw.boundaries ? raw.boundaries : void 0,
		familyPlayback: typeof raw.familyPlayback === "object" && raw.familyPlayback ? {
			languageSeverity: raw.familyPlayback.languageSeverity === "off" || raw.familyPlayback.languageSeverity === "strong" || raw.familyPlayback.languageSeverity === "mild" ? raw.familyPlayback.languageSeverity : "moderate",
			religiousLanguage: Boolean(raw.familyPlayback.religiousLanguage),
			audioTreatment: raw.familyPlayback.audioTreatment === "soften" ? "soften" : "mute",
			subtitleTreatment: raw.familyPlayback.subtitleTreatment === "replace" ? "replace" : "hide",
			exceptions: Array.isArray(raw.familyPlayback.exceptions) ? raw.familyPlayback.exceptions.filter((item) => typeof item === "string") : []
		} : void 0,
		updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : void 0
	};
}
async function loadExperienceProfiles(signal) {
	const response = await fetch("/api/profiles", {
		cache: "no-store",
		signal
	});
	if (!response.ok) throw new Error("Profiles are unavailable");
	const payload = await response.json();
	return {
		profiles: (payload.profiles || []).map(profileFromServer).filter((profile) => Boolean(profile)),
		activeId: payload.activeId,
		auth: payload.auth,
		setup: payload.setup
	};
}
async function saveExperienceProfile(profile, pin) {
	const response = await fetch("/api/profiles", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(profileToServer(profile, pin))
	});
	const result = await response.json();
	if (!response.ok || result.ok !== true) throw new Error(result.error || "Profile could not be saved");
	return result;
}
async function completeExperienceSetup(expectedProfileIds) {
	const response = await fetch("/api/profiles/setup/complete", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ expectedProfileIds })
	});
	const result = await response.json();
	if (!response.ok || result.setup?.status !== "complete") throw new Error(result.error || "This home has not confirmed setup. Please retry.");
}
async function saveActiveExperienceProfile(id, pin, exitPin) {
	const response = await fetch("/api/profiles/active", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			id,
			pin,
			exitPin
		})
	});
	const result = await response.json();
	if (!response.ok) throw new Error(result.error || "This profile could not be opened.");
	const profile = result.profile ? profileFromServer(result.profile) : null;
	if (!profile || profile.summaryOnly) throw new Error("This home did not confirm the profile.");
	return {
		profile,
		activeId: result.activeId || profile.id,
		auth: result.auth
	};
}
function setupProfileWrites(draft, secrets, existing) {
	if (!draft.ownerId || !draft.name?.trim()) throw new Error("Enter your name before continuing.");
	const protectedIds = new Set(existing.filter((profile) => profile.pinEnabled).map((profile) => profile.id));
	if (draft.pinEnabled && !protectedIds.has(draft.ownerId) && !/^\d{4}$/.test(secrets.pin)) throw new Error("Enter your four-digit PIN again before continuing.");
	if (draft.householdMembers?.some((member) => member.isChild && !protectedIds.has(member.id || "")) && !/^\d{4}$/.test(secrets.childExitPin)) throw new Error("Enter the children's four-digit exit PIN again before continuing.");
	const base = {
		motion: "subtle",
		density: "comfortable",
		exploration: "balanced",
		reactions: {},
		dismissedTasteIds: [],
		lessLikeIds: [],
		savedIds: [],
		progress: {},
		bookProgress: {},
		audioPreference: "original",
		subtitleLanguage: "English"
	};
	const previous = existing.find((profile) => profile.id === draft.ownerId && !profile.summaryOnly);
	const writes = [{
		profile: {
			...base,
			...previous,
			id: draft.ownerId,
			name: draft.name.trim(),
			color: draft.color || "#2563eb",
			pinEnabled: Boolean(draft.pinEnabled),
			summaryOnly: false,
			exploration: draft.guidance === "free" ? "adventurous" : draft.guidance === "hand" ? "familiar" : "balanced",
			reactions: draft.reactions ?? previous?.reactions ?? {},
			dismissedTasteIds: draft.dismissed ?? previous?.dismissedTasteIds ?? [],
			lessLikeIds: draft.lessLike ?? previous?.lessLikeIds ?? []
		},
		pin: draft.pinEnabled ? secrets.pin || void 0 : null
	}];
	const colors = [
		"#58d5bc",
		"#f0ba61",
		"#a855f7",
		"#06b6d4"
	];
	for (const [index, member] of (draft.householdMembers ?? []).entries()) {
		if (!member.id || !member.name.trim()) throw new Error("A household member needs a name. Please review your household.");
		const profile = {
			...base,
			id: member.id,
			name: member.name.trim(),
			color: colors[index % colors.length],
			isChild: member.isChild,
			pinEnabled: member.isChild,
			...member.isChild ? {
				maturity: "big",
				exploration: "familiar",
				audioPreference: "dub",
				subtitleLanguage: "Off",
				boundaries: {
					scares: "ask",
					slapstick: "fine",
					fantasy: "fine",
					romance: "ask",
					grief: "ask",
					supernatural: "ask",
					stunts: "ask",
					language: "never"
				}
			} : {}
		};
		if (!existing.some((saved) => saved.id === member.id)) writes.push({
			profile,
			pin: member.isChild ? secrets.childExitPin : void 0
		});
	}
	return writes;
}
async function saveSetupHousehold(draft, secrets, existing) {
	const writes = setupProfileWrites(draft, secrets, existing);
	for (const { profile, pin } of writes) await saveExperienceProfile(profile, pin);
	return [draft.ownerId, ...(draft.householdMembers ?? []).map((member) => member.id)];
}
async function savePublicSourceChoice() {
	const response = await fetch("/api/settings", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ debridEnabled: false })
	});
	const result = await response.json();
	if (!response.ok || result.ok === false || result.debridEnabled !== false) throw new Error(result.error || "Your source choice was not confirmed. Please retry.");
}
var wallClock = {
	now: () => Date.now(),
	schedule(callback, delayMs) {
		const handle = setTimeout(callback, delayMs);
		return () => clearTimeout(handle);
	}
};
/** One wall-clock deadline, scoped to the video present when the timer is armed. */
function createPlaybackSleepTimer({ getVideo, onExpire, clock = wallClock }) {
	let deadline = null;
	let target = null;
	let cancelScheduled = null;
	let generation = 0;
	let disposed = false;
	function cancel() {
		generation += 1;
		cancelScheduled?.();
		cancelScheduled = null;
		deadline = null;
		target = null;
	}
	function checkDeadline() {
		if (disposed || deadline === null || target === null) return;
		cancelScheduled?.();
		cancelScheduled = null;
		const currentGeneration = ++generation;
		if (getVideo() !== target || !target.isConnected) {
			cancel();
			return;
		}
		const remaining = deadline - clock.now();
		if (remaining > 0) {
			cancelScheduled = clock.schedule(() => {
				if (generation === currentGeneration) checkDeadline();
			}, Math.min(remaining, 2147483647));
			return;
		}
		const video = target;
		cancel();
		video.pause();
		onExpire?.();
	}
	return {
		/** Reset from now. Zero, invalid durations, or a missing video disable the timer. */
		setDelay(durationMs) {
			cancel();
			if (disposed || !Number.isFinite(durationMs) || durationMs <= 0) return null;
			const video = getVideo();
			if (!video?.isConnected) return null;
			const nextDeadline = clock.now() + durationMs;
			if (!Number.isFinite(nextDeadline)) return null;
			target = video;
			deadline = nextDeadline;
			checkDeadline();
			return deadline;
		},
		getDeadline: () => deadline,
		checkDeadline,
		cancel,
		dispose() {
			disposed = true;
			cancel();
		}
	};
}
var WORLD_PATHS = {
	home: "/",
	discover: "/discover",
	library: "/library",
	books: "/books",
	taste: "/calibrate",
	companion: "/companion",
	party: "/party",
	devices: "/connect",
	profile: "/profile",
	family: "/family",
	ambiance: "/ambiance",
	settings: "/settings"
};
function pathForWorldView(view) {
	return WORLD_PATHS[view];
}
function worldViewForPath(pathname) {
	const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
	if (normalized === "/settings/advanced") return "settings";
	if (/^\/(?:title|person|collection)\/[^/]+$/.test(normalized)) return "home";
	return Object.entries(WORLD_PATHS).find(([, path]) => path === normalized)?.[0];
}
function pathForWorldDestination(destination) {
	return `/${destination.type}/${encodeURIComponent(destination.id)}`;
}
var TICKS_PER_SECOND = 1e7;
var AUTH_BEARER_KEY = "grok-auth.bearer-token";
function authenticatedHeaders(extra) {
	const headers = new Headers(extra);
	let bearer = null;
	if (typeof window !== "undefined") try {
		bearer = window.sessionStorage.getItem(AUTH_BEARER_KEY);
	} catch {}
	if (bearer) headers.set("Authorization", `Bearer ${bearer}`);
	return headers;
}
function finiteNonNegative(value) {
	const number = Number(value);
	return Number.isFinite(number) && number >= 0 ? number : 0;
}
function parseSession(value) {
	if (!value || typeof value !== "object") return null;
	const raw = value;
	if (raw.active !== true || typeof raw.sessionId !== "string") return null;
	return {
		active: true,
		sessionId: raw.sessionId,
		client: typeof raw.client === "string" ? raw.client : void 0,
		device: typeof raw.device === "string" ? raw.device : void 0,
		titleId: typeof raw.titleId === "string" ? raw.titleId : void 0,
		titleName: typeof raw.titleName === "string" ? raw.titleName : void 0,
		seriesName: typeof raw.seriesName === "string" ? raw.seriesName : null,
		seasonNumber: finiteNonNegative(raw.seasonNumber) || void 0,
		episodeNumber: finiteNonNegative(raw.episodeNumber) || void 0,
		positionTicks: finiteNonNegative(raw.positionTicks),
		durationTicks: finiteNonNegative(raw.durationTicks),
		isPaused: raw.isPaused === true,
		lastUpdated: finiteNonNegative(raw.lastUpdated) || void 0
	};
}
function parseDossier(value) {
	if (!value || typeof value !== "object") return null;
	const raw = value;
	if (typeof raw.title !== "string") return null;
	const shield = raw.spoilerShield && typeof raw.spoilerShield === "object" ? raw.spoilerShield : {};
	return {
		available: raw.available === true,
		message: typeof raw.message === "string" ? raw.message : null,
		title: raw.title,
		season: finiteNonNegative(raw.season) || void 0,
		episode: finiteNonNegative(raw.episode) || void 0,
		currentMinute: finiteNonNegative(raw.currentMinute),
		storySoFar: Array.isArray(raw.storySoFar) ? raw.storySoFar.filter((item) => typeof item === "string") : [],
		whoIsWho: Array.isArray(raw.whoIsWho) ? raw.whoIsWho.flatMap((item) => {
			if (!item || typeof item !== "object") return [];
			const character = item;
			if (typeof character.name !== "string" || typeof character.actor !== "string" || typeof character.role !== "string") return [];
			return [{
				name: character.name,
				actor: character.actor,
				role: character.role,
				avatar: typeof character.avatar === "string" ? character.avatar : null
			}];
		}) : [],
		whyAreTheyHere: typeof raw.whyAreTheyHere === "string" ? raw.whyAreTheyHere : null,
		whisperNotes: Array.isArray(raw.whisperNotes) ? raw.whisperNotes.filter((item) => typeof item === "string") : [],
		spoilerShield: {
			active: shield.active === true,
			safeThroughSeason: finiteNonNegative(shield.safeThroughSeason),
			safeThroughEpisode: finiteNonNegative(shield.safeThroughEpisode),
			futureLoreBlocked: shield.futureLoreBlocked === true
		}
	};
}
function companionProgress(session) {
	if (!session) return {
		positionSeconds: 0,
		durationSeconds: 0,
		remainingMinutes: null
	};
	const positionSeconds = Math.floor(session.positionTicks / TICKS_PER_SECOND);
	const durationSeconds = Math.floor(session.durationTicks / TICKS_PER_SECOND);
	return {
		positionSeconds,
		durationSeconds,
		remainingMinutes: durationSeconds > 0 ? Math.max(0, Math.ceil((durationSeconds - positionSeconds) / 60)) : null
	};
}
async function loadActiveCompanionState(signal, fetchImpl = fetch) {
	const response = await fetchImpl("/api/companion/active", {
		cache: "no-store",
		credentials: "same-origin",
		headers: authenticatedHeaders(),
		signal
	});
	if (!response.ok) throw new Error(response.status === 401 ? "Open a profile to use Companion." : "Companion could not reach the player.");
	const payload = await response.json();
	if (payload.ok !== true) throw new Error("Companion could not verify the player.");
	const session = parseSession(payload.session);
	return {
		active: payload.active === true && Boolean(session),
		session,
		dossier: parseDossier(payload.dossier)
	};
}
async function loadCompanionDossier(id, season, episode, signal, fetchImpl = fetch) {
	const query = new URLSearchParams();
	if (season) query.set("season", String(season));
	if (episode) query.set("episode", String(episode));
	const response = await fetchImpl(`/api/companion/${encodeURIComponent(id)}${query.size ? `?${query}` : ""}`, {
		cache: "no-store",
		credentials: "same-origin",
		headers: authenticatedHeaders(),
		signal
	});
	if (!response.ok) throw new Error(response.status === 401 ? "Open a profile to use Companion." : "Companion context is unavailable.");
	const payload = await response.json();
	return payload.ok === true ? parseDossier(payload.dossier) : null;
}
async function queueCompanionCommand(sessionId, action, payload = {}, fetchImpl = fetch) {
	const response = await fetchImpl("/api/companion/remote", {
		method: "POST",
		credentials: "same-origin",
		headers: authenticatedHeaders({ "Content-Type": "application/json" }),
		body: JSON.stringify({
			sessionId,
			action,
			payload
		})
	});
	if (!response.ok) throw new Error(response.status === 409 ? "That playback session has ended." : "The TV did not accept that command.");
	const result = await response.json();
	if (result.ok !== true || !result.command?.id) throw new Error("The TV did not accept that command.");
	return result.command.id;
}
var companionSeekTicks = (seconds) => Math.trunc(seconds * TICKS_PER_SECOND);
var WORLD_RETURN_STATE_KEY = "reelos.world-return.v1";
function rememberWorldOrigin(target) {
	if (typeof window === "undefined") return;
	const focused = document.activeElement;
	const focusLabel = focused instanceof HTMLElement ? focused.getAttribute("aria-label") || void 0 : void 0;
	const state = {
		origin: `${window.location.pathname}${window.location.search}`,
		target,
		scrollY: window.scrollY,
		focusLabel
	};
	window.sessionStorage.setItem(WORLD_RETURN_STATE_KEY, JSON.stringify(state));
}
function readWorldReturnState() {
	if (typeof window === "undefined") return void 0;
	try {
		const value = JSON.parse(window.sessionStorage.getItem(WORLD_RETURN_STATE_KEY) || "null");
		if (!value || typeof value.origin !== "string" || typeof value.target !== "string" || typeof value.scrollY !== "number") return void 0;
		return value;
	} catch {
		return;
	}
}
var NAV = [
	[
		"home",
		"Home",
		House
	],
	[
		"discover",
		"Discover",
		Compass
	],
	[
		"library",
		"Library",
		Library
	],
	[
		"books",
		"Books",
		BookOpen
	]
];
function experienceTitleIsAccessible(title, debrid) {
	return title.sources.some((source) => sourceIsAccessible(source, debrid));
}
function possessive(name) {
	return /s$/i.test(name) ? `${name}’` : `${name}’s`;
}
function syncFamilyPresence(childProfileIds) {
	return fetch("/api/companion/presence-filter", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			sessionId: "living_room_tv",
			kidsPresent: childProfileIds.length > 0,
			childProfileIds
		})
	});
}
function ReelOSWorld({ initialView = "home", initialDestination, initialSettingsGroup, initialCompanionLink }) {
	const routeNavigate = useNavigate();
	const state = useExperienceStore();
	const profile = activeExperienceProfile(state);
	const [modal, setModal] = (0, import_react.useState)(null);
	const [searchOpen, setSearchOpen] = (0, import_react.useState)(false);
	const [searchQuery, setSearchQuery] = (0, import_react.useState)("");
	const [sourceReview, setSourceReview] = (0, import_react.useState)(null);
	const [conciergeOpen, setConciergeOpen] = (0, import_react.useState)(false);
	const [booksInitialQuery, setBooksInitialQuery] = (0, import_react.useState)("");
	const [profileOpen, setProfileOpen] = (0, import_react.useState)(false);
	const [refineOpen, setRefineOpen] = (0, import_react.useState)(false);
	const [playing, setPlaying] = (0, import_react.useState)(null);
	const [returnView, setReturnView] = (0, import_react.useState)("home");
	const [profileAdapterReady, setProfileAdapterReady] = (0, import_react.useState)(false);
	const [hydrationRevision, setHydrationRevision] = (0, import_react.useState)(0);
	const [profileError, setProfileError] = (0, import_react.useState)("");
	const [destinationError, setDestinationError] = (0, import_react.useState)("");
	const [sessionAuth, setSessionAuth] = (0, import_react.useState)();
	const savedProfiles = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	const [switchTarget, setSwitchTarget] = (0, import_react.useState)(null);
	const [switchBusy, setSwitchBusy] = (0, import_react.useState)(false);
	const [switchError, setSwitchError] = (0, import_react.useState)("");
	const [exitGate, setExitGate] = (0, import_react.useState)(null);
	const [liveLibrary, setLiveLibrary] = (0, import_react.useState)({
		titles: [],
		progress: {},
		status: "unavailable"
	});
	const kidsPresent = state.kidsPresentIds.length > 0;
	const experienceTitles = (0, import_react.useMemo)(() => mergeExperienceTitles(EXPERIENCE_CATALOG, liveLibrary.titles), [liveLibrary.titles]);
	const curated = (0, import_react.useMemo)(() => curateForProfile(profile, state.tonight, kidsPresent, experienceTitles), [
		profile,
		state.tonight,
		kidsPresent,
		experienceTitles
	]);
	const companionSeed = (0, import_react.useMemo)(() => sessionAuth?.authenticated ? resolveCompanionSeed(initialCompanionLink, experienceTitles, state.debrid, Boolean(profile.isChild)) : void 0, [
		sessionAuth?.authenticated,
		initialCompanionLink,
		experienceTitles,
		state.debrid,
		profile.isChild
	]);
	(0, import_react.useEffect)(() => {
		const controller = new AbortController();
		setLiveLibrary({
			titles: [],
			progress: {},
			status: "unavailable"
		});
		if (!profileAdapterReady || !sessionAuth?.authenticated) return () => controller.abort();
		loadLiveLibrary(controller.signal).then((library) => {
			if (!controller.signal.aborted) setLiveLibrary(library);
		}).catch(() => void 0);
		return () => controller.abort();
	}, [
		profileAdapterReady,
		sessionAuth?.authenticated,
		profile.id
	]);
	(0, import_react.useEffect)(() => {
		const controller = new AbortController();
		setProfileAdapterReady(false);
		setProfileError("");
		loadExperienceProfiles(controller.signal).then(({ profiles, activeId, auth, setup }) => {
			if (controller.signal.aborted) return;
			const setupComplete = setup?.status === "complete";
			useExperienceStore.getState().hydrateProfiles(profiles, activeId, setupComplete);
			if (setupComplete) useExperienceStore.getState().setView(initialView);
			savedProfiles.current = new Map(profiles.map((item) => [item.id, JSON.stringify(item)]));
			setSessionAuth(auth ?? {
				bootstrapRequired: profiles.length === 0,
				authenticated: false
			});
			setProfileAdapterReady(true);
		}).catch((reason) => {
			if (!controller.signal.aborted) setProfileError(reason instanceof Error ? reason.message : "This home could not be reached.");
		});
		return () => controller.abort();
	}, [hydrationRevision, initialView]);
	(0, import_react.useEffect)(() => {
		if (!profileAdapterReady || !sessionAuth?.authenticated || !initialDestination) return;
		setDestinationError("");
		if (initialDestination.type === "person") {
			setModal({
				type: "person",
				name: initialDestination.name || (initialDestination.id.match(/^\d+$/) ? "Person" : initialDestination.id),
				externalId: initialDestination.id.match(/^\d+$/) ? initialDestination.id : void 0
			});
			return;
		}
		if (initialDestination.type === "collection") {
			setModal({
				type: "collection",
				name: initialDestination.name || "Collection",
				titleIds: initialDestination.titleIds || [],
				externalId: initialDestination.id.match(/^\d+$/) ? initialDestination.id : void 0
			});
			return;
		}
		const local = experienceTitles.find((title) => title.id === initialDestination.id || title.playbackId === initialDestination.id);
		if (local) {
			setModal({
				type: "title",
				title: local
			});
			return;
		}
		const controller = new AbortController();
		fetch(`/api/lookup?id=${encodeURIComponent(initialDestination.id)}`, {
			cache: "no-store",
			signal: controller.signal
		}).then(async (response) => {
			if (!response.ok) throw new Error("That title is unavailable right now.");
			return response.json();
		}).then((payload) => {
			if (controller.signal.aborted) return;
			const title = payload.titles?.map(mapLookupTitle).find((item) => Boolean(item));
			if (title) setModal({
				type: "title",
				title
			});
			else setDestinationError(payload.error || "That title is unavailable right now.");
		}).catch((reason) => {
			if (!controller.signal.aborted) setDestinationError(reason instanceof Error ? reason.message : "That title is unavailable right now.");
		});
		return () => controller.abort();
	}, [
		profileAdapterReady,
		sessionAuth?.authenticated,
		initialDestination?.type,
		initialDestination?.id,
		initialDestination && "name" in initialDestination ? initialDestination.name : void 0,
		initialDestination?.type === "collection" ? initialDestination.titleIds?.join(",") : void 0,
		experienceTitles
	]);
	(0, import_react.useEffect)(() => {
		if (!profileAdapterReady || initialDestination || typeof window === "undefined") return;
		const saved = readWorldReturnState();
		const here = `${window.location.pathname}${window.location.search}`;
		if (!saved || saved.origin !== here) return;
		window.sessionStorage.removeItem(WORLD_RETURN_STATE_KEY);
		window.requestAnimationFrame(() => {
			window.scrollTo({
				top: saved.scrollY,
				behavior: "auto"
			});
			if (!saved.focusLabel) return;
			[...document.querySelectorAll("[aria-label]")].find((element) => element.getAttribute("aria-label") === saved.focusLabel)?.focus({ preventScroll: true });
		});
	}, [profileAdapterReady, initialDestination]);
	(0, import_react.useEffect)(() => {
		if (!profileAdapterReady || !sessionAuth?.authenticated || state.view === "setup" || !profile.id || profile.summaryOnly) return;
		const snapshot = JSON.stringify(profile);
		if (savedProfiles.current.get(profile.id) === snapshot) return;
		const timer = window.setTimeout(() => {
			saveExperienceProfile(profile).then(() => {
				savedProfiles.current.set(profile.id, snapshot);
				setProfileError("");
			}).catch((reason) => setProfileError(reason instanceof Error ? reason.message : "Your changes have not been saved. Please retry."));
		}, 450);
		return () => window.clearTimeout(timer);
	}, [
		profileAdapterReady,
		sessionAuth,
		profile,
		state.view
	]);
	(0, import_react.useEffect)(() => {
		if (!profile.isChild) return;
		if (![
			"home",
			"discover",
			"library",
			"taste",
			"player"
		].includes(state.view)) {
			state.setView("home");
			if (window.location.pathname !== "/") routeNavigate({
				to: "/",
				replace: true
			});
		}
	}, [
		profile.isChild,
		state.view,
		state.setView,
		routeNavigate
	]);
	(0, import_react.useEffect)(() => {
		const controller = new AbortController();
		fetch("/api/settings", {
			cache: "no-store",
			signal: controller.signal
		}).then(async (response) => {
			if (!response.ok) return null;
			return await response.json();
		}).then((result) => {
			const policy = result?.sourcePolicy;
			if (!policy) return;
			state.setDebridConnection({
				enabled: policy.enabled === true,
				provider: policy.provider || "torbox",
				status: policy.connected ? "connected" : policy.status === "validating" || policy.status === "failed" ? policy.status : policy.enabled ? "needs-key" : "disabled"
			});
		}).catch(() => void 0);
		return () => controller.abort();
	}, [state.setDebridConnection]);
	const navigate = (view) => {
		if (view !== "player") {
			const location = new URL(window.location.href);
			location.searchParams.delete("watch");
			window.history.replaceState(window.history.state, "", location);
		}
		const nextView = !state.onboardingComplete && view !== "devices" ? "setup" : view;
		state.setView(nextView);
		const path = pathForWorldView(nextView);
		if (path && window.location.pathname !== path) routeNavigate({ to: path });
		setProfileOpen(false);
		window.scrollTo({
			top: 0,
			behavior: "auto"
		});
	};
	const afterChildExit = (action) => {
		if (!profile.isChild) action();
		else setExitGate({
			profile,
			action
		});
	};
	const openDestination = (destination) => {
		const targetPath = pathForWorldDestination(destination);
		const search = destination.type === "person" ? destination.name ? `?name=${encodeURIComponent(destination.name)}` : "" : destination.type === "collection" ? new URLSearchParams({
			...destination.name ? { name: destination.name } : {},
			...destination.titleIds?.length ? { titles: destination.titleIds.join(",") } : {}
		}).toString() : "";
		rememberWorldOrigin(search && destination.type === "collection" ? `${targetPath}?${search}` : `${targetPath}${search}`);
		if (destination.type === "title") routeNavigate({
			to: "/title/$id",
			params: { id: destination.id }
		});
		else if (destination.type === "person") routeNavigate({
			to: "/person/$id",
			params: { id: destination.id },
			search: { name: destination.name }
		});
		else routeNavigate({
			to: "/collection/$id",
			params: { id: destination.id },
			search: {
				name: destination.name,
				titles: destination.titleIds?.length ? destination.titleIds.join(",") : void 0
			}
		});
	};
	const openTitle = (title) => openDestination({
		type: "title",
		id: title.playbackId || title.id
	});
	const openSearch = (query = "") => {
		setSearchQuery(query);
		setSearchOpen(true);
	};
	const closeContentDestination = () => {
		setModal(null);
		if (!initialDestination) return;
		const saved = readWorldReturnState();
		if ((saved ? new URL(saved.target, window.location.origin).pathname : void 0) === window.location.pathname) window.history.back();
		else routeNavigate({ to: "/" });
	};
	const playTitle = (title) => {
		if (!title.sources.some((source) => source.verified && source.kind === "public_domain" && source.uri)) {
			window.location.assign(`/play/${encodeURIComponent(title.playbackId || title.id)}`);
			return;
		}
		setReturnView(state.view);
		const location = new URL(window.location.href);
		location.searchParams.set("watch", title.id);
		window.history.pushState(window.history.state, "", location);
		setModal(null);
		setPlaying(title);
		state.setView("player");
		window.scrollTo({
			top: 0,
			behavior: "auto"
		});
	};
	(0, import_react.useEffect)(() => {
		if (!profileAdapterReady) return;
		const restorePlayer = () => {
			if (!state.onboardingComplete) {
				const location = new URL(window.location.href);
				location.searchParams.delete("watch");
				window.history.replaceState(window.history.state, "", location);
				setPlaying(null);
				state.setView("setup");
				return;
			}
			const location = new URL(window.location.href);
			const id = location.searchParams.get("watch");
			const title = id && publicPlaybackPath(id) ? TITLE_BY_EXPERIENCE_ID[id] : void 0;
			if (title && sessionAuth?.authenticated && (!profile.isChild || title.family)) {
				setPlaying(title);
				state.setView("player");
			} else {
				const routeView = worldViewForPath(location.pathname);
				if (routeView) state.setView(routeView);
				else if (useExperienceStore.getState().view === "player") state.setView(returnView);
				setPlaying(null);
			}
		};
		restorePlayer();
		window.addEventListener("popstate", restorePlayer);
		return () => window.removeEventListener("popstate", restorePlayer);
	}, [
		profileAdapterReady,
		state.onboardingComplete,
		profile.id,
		profile.isChild,
		sessionAuth?.authenticated,
		state.setView,
		returnView
	]);
	(0, import_react.useEffect)(() => {
		const handler = (event) => {
			if (event.key !== "Escape") return;
			if (modal) setModal(null);
			else if (searchOpen) setSearchOpen(false);
			else if (refineOpen) setRefineOpen(false);
			else if (exitGate) setExitGate(null);
			else if (profileOpen) setProfileOpen(false);
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [
		modal,
		searchOpen,
		refineOpen,
		exitGate,
		profileOpen
	]);
	const hideShell = state.view === "setup" || state.view === "player" || state.view === "taste";
	const switchProfile = async (id, pin) => {
		setSwitchBusy(true);
		setSwitchError("");
		try {
			const confirmed = await saveActiveExperienceProfile(id, pin);
			setProfileAdapterReady(false);
			setModal(null);
			setSearchOpen(false);
			setSearchQuery("");
			setPlaying(null);
			setRefineOpen(false);
			useExperienceStore.setState({
				profiles: [],
				activeProfileId: "",
				kidsPresentIds: [],
				requests: {}
			});
			const loaded = await loadExperienceProfiles();
			state.hydrateProfiles(loaded.profiles, confirmed.activeId, loaded.setup?.status === "complete");
			savedProfiles.current = new Map(loaded.profiles.map((item) => [item.id, JSON.stringify(item)]));
			setSessionAuth(confirmed.auth ?? loaded.auth);
			setSwitchTarget(null);
			setProfileOpen(false);
			setProfileAdapterReady(true);
			window.scrollTo({
				top: 0,
				behavior: "auto"
			});
		} catch (reason) {
			setSwitchError(reason instanceof Error ? reason.message : "This profile could not be opened.");
			setProfileError(reason instanceof Error ? reason.message : "This profile could not be opened.");
		} finally {
			setSwitchBusy(false);
		}
	};
	if (!profileAdapterReady) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "reelos-world grid min-h-dvh place-items-center px-6 text-white",
		style: { "--reelos-favorite": "#2563eb" },
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "reelos-profile-aura",
			"aria-hidden": "true"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative max-w-md text-center",
			role: "status",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-lg",
				children: profileError || "Opening your home…"
			}), profileError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				className: "mt-6 min-h-12 rounded-full bg-white px-6 text-black",
				onClick: () => setHydrationRevision((value) => value + 1),
				children: "Try again"
			})]
		})]
	});
	if (sessionAuth && !sessionAuth.authenticated && !sessionAuth.bootstrapRequired) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileSessionEntry, {
		profiles: state.profiles,
		busy: switchBusy,
		error: switchError,
		deviceAuthorized: sessionAuth.deviceAuthorized !== false,
		onSelect: switchProfile
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "reelos-world min-h-dvh overflow-x-hidden bg-[#080809] text-[#f5f1eb]",
		"data-motion": profile.motion,
		"data-density": profile.density,
		"data-atmosphere": profile.atmosphere === false ? "off" : "on",
		"data-transparency": profile.transparency === false ? "solid" : "glass",
		style: {
			"--reelos-favorite": profile.color,
			"--color-gold": profile.color,
			"--color-gold-bright": profile.color
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "reelos-profile-aura",
				"aria-hidden": "true"
			}),
			profileError && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "alert",
				className: "relative z-50 flex items-center justify-center gap-4 bg-black/80 p-3 text-sm text-white",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: profileError }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					className: "min-h-12 px-3 underline",
					onClick: () => {
						savedProfiles.current.delete(profile.id);
						state.patchProfile(profile.id, {});
					},
					children: "Retry saving"
				})]
			}),
			!hideShell && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, {
				view: state.view,
				profile,
				profiles: state.profiles,
				kidsPresent,
				profileOpen,
				onProfileOpen: () => setProfileOpen((open) => !open),
				onNavigate: navigate,
				onSearch: () => openSearch(),
				onProfile: (id) => {
					if (id === profile.id) {
						setProfileOpen(false);
						return;
					}
					const target = state.profiles.find((item) => item.id === id);
					if (target?.isChild && !target.pinEnabled) {
						setProfileOpen(false);
						setModal({
							type: "protect-child",
							profile: target
						});
						return;
					}
					setProfileOpen(false);
					afterChildExit(() => {
						setSwitchError("");
						setSwitchTarget(target ?? null);
					});
				},
				onProtectedNavigate: (view) => afterChildExit(() => navigate(view)),
				onKids: () => {
					const firstChild = state.profiles.find((item) => item.isChild);
					if (firstChild) {
						const nextIds = state.kidsPresentIds.includes(firstChild.id) ? state.kidsPresentIds.filter((id) => id !== firstChild.id) : [...state.kidsPresentIds, firstChild.id];
						state.toggleKidPresent(firstChild.id);
						syncFamilyPresence(nextIds).catch(() => void 0);
					}
				}
			}),
			state.view === "home" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HomeWorld, {
				profile,
				titles: curated,
				kidsPresent,
				liveProgress: liveLibrary.progress,
				onOpen: openTitle,
				onPlay: playTitle,
				onSearch: openSearch,
				onNavigate: navigate
			}),
			state.view === "discover" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscoverWorld, {
				profile,
				titles: curated,
				onOpen: openTitle,
				onSearch: openSearch,
				onRefine: () => setRefineOpen(true),
				onPerson: (name) => openDestination({
					type: "person",
					id: name,
					name
				}),
				onCollection: (name, titleIds) => openDestination({
					type: "collection",
					id: name,
					name,
					titleIds
				})
			}),
			state.view === "library" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LibraryWorld, {
				profile,
				titles: experienceTitles,
				originals: liveLibrary.titles,
				liveProgress: liveLibrary.progress,
				libraryStatus: liveLibrary.status,
				libraryMessage: liveLibrary.message,
				requests: state.requests,
				onOpen: openTitle,
				onPlay: playTitle,
				onNavigate: navigate
			}),
			state.view === "books" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BooksWorld, {
				profile,
				initialQuery: booksInitialQuery,
				onNavigate: navigate
			}),
			state.view === "profile" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileWorld, {
				profile,
				onNavigate: navigate,
				onOpen: openTitle
			}),
			state.view === "taste" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TasteWorld, {
				profile,
				onExit: () => navigate("profile")
			}),
			state.view === "family" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FamilyWorld, { onNavigate: navigate }),
			state.view === "settings" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsWorld, {
				onNavigate: navigate,
				initialGroup: initialSettingsGroup
			}),
			state.view === "devices" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DevicesWorld, { onNavigate: navigate }),
			state.view === "ambiance" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AmbianceWorld, { onNavigate: navigate }),
			state.view === "companion" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompanionWorld, {
				onNavigate: navigate,
				seed: companionSeed
			}),
			state.view === "party" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PartyWorld, {
				onNavigate: navigate,
				onOpen: openTitle
			}),
			state.view === "setup" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SetupWorld, {
				onNavigate: navigate,
				onComplete: () => setHydrationRevision((value) => value + 1)
			}),
			state.view === "player" && playing && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayerWorld, {
				title: playing,
				profile,
				onBack: () => {
					navigate(returnView);
					setPlaying(null);
				},
				onCompanion: () => navigate("companion")
			}, `${profile.id}:${playing.id}`),
			!hideShell && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MobileNav, {
				view: state.view,
				onNavigate: navigate
			}),
			searchOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SearchOverlay, {
				query: searchQuery,
				setQuery: setSearchQuery,
				onClose: () => setSearchOpen(false),
				onOpen: (title) => {
					setSearchOpen(false);
					openTitle(title);
				},
				onPerson: (name, externalId) => {
					setSearchOpen(false);
					openDestination({
						type: "person",
						id: externalId || name,
						name
					});
				},
				onCollection: (name, externalId) => {
					setSearchOpen(false);
					openDestination({
						type: "collection",
						id: externalId,
						name
					});
				},
				onBook: (title) => {
					setSearchOpen(false);
					setBooksInitialQuery(title);
					navigate("books");
				},
				onSourceSetup: (review) => {
					setSearchOpen(false);
					setSourceReview(review);
				},
				onConcierge: () => setConciergeOpen(true),
				profile
			}),
			sourceReview && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourceSetupReview, {
				review: sourceReview,
				onClose: () => setSourceReview(null),
				onSettings: () => {
					setSourceReview(null);
					navigate("settings");
				}
			}),
			conciergeOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConciergeSheet, {
				onClose: () => setConciergeOpen(false),
				onSetup: () => {
					setConciergeOpen(false);
					navigate("setup");
				},
				onSettings: () => {
					setConciergeOpen(false);
					navigate("settings");
				}
			}),
			switchTarget && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleDialog, {
				title: switchTarget.name,
				onClose: () => setSwitchTarget(null),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileSessionEntry, {
					profiles: [switchTarget],
					busy: switchBusy,
					error: switchError,
					onSelect: switchProfile,
					embedded: true
				})
			}),
			exitGate && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExitPinGate, {
				profile: exitGate.profile,
				onClose: () => setExitGate(null),
				onVerified: () => {
					const action = exitGate.action;
					setExitGate(null);
					action();
				}
			}),
			refineOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefineSheet, { onClose: () => setRefineOpen(false) }),
			destinationError && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SimpleDialog, {
				title: "Not available yet",
				onClose: () => {
					setDestinationError("");
					routeNavigate({ to: "/" });
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "leading-7 text-white/54",
					children: destinationError
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-sm leading-6 text-white/38",
					children: "ReelOS will not substitute an unrelated title or pretend this destination loaded."
				})]
			}),
			modal?.type === "title" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TitleSheet, {
				title: modal.title,
				profile,
				onClose: closeContentDestination,
				onPlay: playTitle,
				onOpenRelated: openTitle
			}),
			modal?.type === "person" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PersonSheet, {
				name: modal.name,
				externalId: modal.externalId,
				onClose: closeContentDestination,
				onOpen: openTitle
			}),
			modal?.type === "collection" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CollectionSheet, {
				name: modal.name,
				titleIds: modal.titleIds,
				externalId: modal.externalId,
				onClose: closeContentDestination,
				onOpen: openTitle
			}),
			modal?.type === "protect-child" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SimpleDialog, {
				title: `Protect ${modal.profile.name} first`,
				onClose: () => setModal(null),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "leading-7 text-white/54",
					children: "Every child profile needs an exit PIN before it can be opened. Set one in Family so a child can never get trapped—or leave without a grown-up."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => {
						setModal(null);
						navigate("family");
					},
					className: "mt-6 min-h-12 rounded-full bg-white px-6 text-sm font-bold text-black",
					children: "Open Family"
				})]
			})
		]
	});
}
function ProfileSessionEntry({ profiles, busy, error, onSelect, embedded = false, deviceAuthorized = true }) {
	const [selected, setSelected] = (0, import_react.useState)(profiles.length === 1 ? profiles[0].id : "");
	const [pin, setPin] = (0, import_react.useState)("");
	const [pairing, setPairing] = (0, import_react.useState)(false);
	const [pairError, setPairError] = (0, import_react.useState)("");
	const target = profiles.find((item) => item.id === selected);
	const needsPin = Boolean(target?.pinEnabled && !target.isChild);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: embedded ? "" : "reelos-world grid min-h-dvh place-items-center px-6 text-white",
		style: { "--reelos-favorite": target?.color || "#2563eb" },
		children: [!embedded && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "reelos-profile-aura",
			"aria-hidden": "true"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "relative mx-auto w-full max-w-xl",
			onSubmit: (event) => {
				event.preventDefault();
				if (target && !busy) onSelect(target.id, needsPin ? pin : void 0).then(() => setPin(""));
			},
			children: [
				!embedded && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mb-8 text-center text-3xl font-semibold tracking-tight",
					children: "Who's watching?"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap justify-center gap-4",
					children: profiles.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						disabled: busy,
						"aria-pressed": selected === item.id,
						onClick: () => {
							setSelected(item.id);
							setPin("");
						},
						className: `min-h-24 min-w-28 rounded-3xl border px-6 py-5 text-center ${selected === item.id ? "border-white/70 bg-white/10" : "border-white/10 bg-white/5"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mx-auto mb-3 block size-8 rounded-full",
							style: { backgroundColor: item.color }
						}), item.name]
					}, item.id))
				}),
				needsPin && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "mt-7 block text-sm text-white/70",
					children: ["Your PIN", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "password",
						inputMode: "numeric",
						autoComplete: "off",
						maxLength: 4,
						value: pin,
						onChange: (event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4)),
						className: "mt-2 min-h-14 w-full rounded-2xl bg-white/10 px-5 text-center text-xl tracking-[.3em]"
					})]
				}),
				!deviceAuthorized && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-7 rounded-3xl border border-white/10 bg-white/[.045] p-4 text-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm leading-6 text-white/64",
							children: "Connect this phone, TV, or computer to your home once. It stays private to this household."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							disabled: pairing,
							onClick: () => {
								setPairing(true);
								setPairError("");
								fetch("/api/gate/pair-lan", {
									method: "POST",
									headers: { "Content-Type": "application/json" },
									body: "{}"
								}).then(async (response) => {
									const result = await response.json();
									if (!response.ok || !result.ok) throw new Error(result.error || "This device could not connect.");
									window.location.reload();
								}).catch((reason) => {
									setPairError(reason instanceof Error ? reason.message : "This device could not connect.");
									setPairing(false);
								});
							},
							className: "mt-4 min-h-14 w-full rounded-full bg-white px-6 font-semibold text-black disabled:opacity-40",
							children: pairing ? "Connecting…" : "Connect this device"
						}),
						pairError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							role: "alert",
							className: "mt-3 text-sm text-rose-300",
							children: pairError
						})
					]
				}),
				(error || !deviceAuthorized && !pairError) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					role: "alert",
					className: "mt-4 text-center text-sm text-rose-300",
					children: error
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					disabled: !deviceAuthorized || !target || busy || needsPin && pin.length !== 4,
					className: "mt-7 min-h-14 w-full rounded-full bg-white px-6 font-semibold text-black disabled:opacity-35",
					children: busy ? "Opening…" : "Continue"
				})
			]
		})]
	});
}
function Shell({ view, profile, profiles, kidsPresent, profileOpen, onProfileOpen, onNavigate, onSearch, onProfile, onKids, onProtectedNavigate }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
		className: `reelos-world-header top-0 z-40 w-full px-5 md:px-10 ${view === "home" ? "absolute border-transparent bg-transparent" : "sticky border-b border-white/[.07] bg-[#080809]/82 backdrop-blur-2xl"}`,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex h-[76px] max-w-[1600px] items-center justify-between gap-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: () => onNavigate("home"),
					className: "flex min-h-12 items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "grid size-9 place-items-center rounded-full text-sm font-black text-[#0b0b0d]",
						style: {
							backgroundColor: profile.color,
							boxShadow: `0 0 24px ${profile.color}44`
						},
						children: "R"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: `font-display text-lg font-bold tracking-tight ${view === "home" ? "hidden sm:inline" : ""}`,
						children: "ReelOS"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: "hidden items-center gap-1 lg:flex",
					"aria-label": "Primary",
					children: NAV.map(([id, label, Icon]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => onNavigate(id),
						className: `flex min-h-12 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${view === id ? "bg-white/10 text-white" : "text-white/52 hover:text-white"}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4" }),
							" ",
							label
						]
					}, id))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative flex items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: onSearch,
							"aria-label": "Find anything",
							className: "grid size-12 place-items-center rounded-full border border-white/12 bg-black/18 text-white/75 backdrop-blur-xl hover:border-white/35",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: onKids,
							className: `hidden min-h-12 rounded-full border px-4 text-xs font-semibold sm:block ${kidsPresent ? "border-transparent text-[#0a1010]" : "border-white/12 bg-black/18 text-white/70 backdrop-blur-xl"}`,
							style: kidsPresent ? { backgroundColor: profile.color } : void 0,
							children: kidsPresent ? "Kids here" : "Adults only"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: onProfileOpen,
							"aria-label": "Change profile",
							className: "grid size-12 place-items-center rounded-full font-bold text-[#0b0b0d]",
							style: { backgroundColor: profile.color },
							children: profile.name.slice(0, 1)
						}),
						profileOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "absolute right-0 top-14 max-h-[calc(100dvh-10rem)] w-[min(350px,calc(100vw-32px))] overflow-y-auto overscroll-contain rounded-[1.6rem] border border-white/12 bg-[#141419]/96 p-3 shadow-2xl backdrop-blur-2xl",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "px-3 pb-2 pt-1 text-xs text-white/42",
									children: "Who’s here?"
								}),
								profiles.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => onProfile(item.id),
									className: "flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left hover:bg-white/7",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "grid size-9 place-items-center rounded-full text-sm font-bold text-[#0b0b0d]",
											style: { backgroundColor: item.color },
											children: item.name[0]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
												className: "block text-sm",
												children: item.name
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", {
												className: "text-white/42",
												children: item.isChild ? "Their safe cinema" : item.isGuest ? "A fresh start" : "Their own taste"
											})]
										}),
										item.id === profile.id && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" })
									]
								}, item.id)),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-2 grid grid-cols-2 gap-2 border-t border-white/8 pt-3",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => onProtectedNavigate("profile"),
											className: "min-h-11 rounded-xl bg-white/7 text-sm",
											children: "Your profile"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => onProtectedNavigate("family"),
											className: "min-h-11 rounded-xl bg-white/7 text-sm",
											children: "Family"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => onProtectedNavigate("settings"),
											className: "min-h-11 rounded-xl bg-white/7 text-sm",
											children: "Settings"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => onProtectedNavigate("devices"),
											className: "min-h-11 rounded-xl bg-white/7 text-sm",
											children: "Devices"
										})
									]
								})
							]
						})
					]
				})
			]
		})
	});
}
function MobileNav({ view, onNavigate }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
		className: "reelos-mobile-nav fixed inset-x-3 z-40 mx-auto grid max-w-2xl grid-cols-4 rounded-[1.5rem] border border-white/10 bg-[#111116]/86 p-1.5 shadow-2xl backdrop-blur-2xl lg:hidden",
		"aria-label": "Primary navigation",
		children: NAV.map(([id, label, Icon]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			onClick: () => onNavigate(id),
			className: `flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1.15rem] text-[11px] ${view === id ? "bg-white/10 text-white" : "text-white/48"}`,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4" }),
				" ",
				label
			]
		}, id))
	});
}
function PosterCard({ title, onOpen, className = "" }) {
	const [failed, setFailed] = (0, import_react.useState)(false);
	const activeProfileId = useExperienceStore((state) => state.activeProfileId);
	const profile = useExperienceStore((state) => state.profiles.find((item) => item.id === state.activeProfileId));
	const react = useExperienceStore((state) => state.react);
	const toggleLessLike = useExperienceStore((state) => state.toggleLessLike);
	const liked = profile?.reactions[title.id] === "like";
	const lessLike = profile?.lessLikeIds.includes(title.id) ?? false;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: `group relative aspect-[.68] min-w-0 overflow-hidden rounded-[1.15rem] bg-white/6 text-left ${className}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			onClick: () => onOpen(title),
			"aria-label": `Open ${title.title}`,
			className: "absolute inset-0 text-left",
			children: [
				!failed && title.poster ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: title.poster,
					alt: "",
					loading: "lazy",
					onError: () => setFailed(true),
					className: "absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-[1.035] group-focus-within:scale-[1.035]"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArtworkFallback, { title: title.title }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute inset-0 bg-gradient-to-t from-black/90 via-black/5 to-transparent opacity-80" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "absolute inset-x-3 bottom-3 translate-y-1 transition group-hover:translate-y-0 group-focus-within:translate-y-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
						className: "block text-sm leading-tight",
						children: title.title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", {
						className: "mt-1 block text-white/52",
						children: [
							title.year,
							" ·",
							" ",
							title.kind === "series" ? "Series" : title.genres[0]
						]
					})]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "absolute right-2 top-2 z-10 flex gap-1.5 opacity-100",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: () => react(activeProfileId, title.id, liked ? void 0 : "like"),
				"aria-label": `${liked ? "Remove like from" : "Like"} ${title.title}`,
				"aria-pressed": liked,
				className: `grid size-12 place-items-center rounded-full backdrop-blur-xl ${liked ? "bg-white text-black" : "bg-black/58 text-white"}`,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: () => toggleLessLike(activeProfileId, title.id),
				"aria-label": `${lessLike ? "Undo less like this for" : "Less like"} ${title.title}`,
				"aria-pressed": lessLike,
				className: `grid size-12 place-items-center rounded-full backdrop-blur-xl ${lessLike ? "bg-white text-black" : "bg-black/58 text-white"}`,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThumbsDown, { className: "size-4" })
			})]
		})]
	});
}
function ArtworkFallback({ title }) {
	const hue = [...title].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 360;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		"aria-hidden": "true",
		className: "absolute inset-0",
		style: { background: `radial-gradient(circle at 30% 20%, hsl(${hue} 72% 46% / .7), transparent 45%), linear-gradient(145deg,hsl(${hue + 40} 45% 18%),#09090b)` }
	});
}
function Shelf({ title, note, items, onOpen, onSeeAll }) {
	if (!items.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "reelos-world-shelf",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-5 flex items-end justify-between gap-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-[clamp(1.65rem,3vw,2.5rem)] font-semibold leading-none tracking-[-.055em]",
				children: title
			}), note && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-white/44",
				children: note
			})] }), onSeeAll && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: onSeeAll,
				className: "min-h-12 shrink-0 rounded-full px-3 text-sm text-white/58 hover:text-white",
				children: "See all"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "reelos-poster-row -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 md:-mx-10 md:px-10 lg:mx-0 lg:grid lg:grid-cols-6 lg:overflow-visible lg:px-0 lg:pb-0",
			children: items.slice(0, 6).map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PosterCard, {
				title: item,
				onOpen,
				className: "w-[44vw] max-w-52 shrink-0 snap-start sm:w-[30vw] lg:w-auto lg:max-w-none"
			}, item.id))
		})]
	});
}
function HomeWorld({ profile, titles, kidsPresent, liveProgress, onOpen, onPlay, onSearch, onNavigate }) {
	const toggleSaved = useExperienceStore((state) => state.toggleSaved);
	const [heroArtIndex, setHeroArtIndex] = (0, import_react.useState)(0);
	const debrid = useExperienceStore((state) => state.debrid);
	const hero = titles.find((title) => title.backdrop) ?? titles[0] ?? EXPERIENCE_CATALOG[0];
	const heroAccessible = experienceTitleIsAccessible(hero, debrid);
	const heroArt = (0, import_react.useMemo)(() => Array.from(new Set([hero.backdrop, hero.poster].filter((candidate) => Boolean(candidate)))), [hero.backdrop, hero.poster])[heroArtIndex];
	(0, import_react.useEffect)(() => setHeroArtIndex(0), [
		hero.id,
		hero.backdrop,
		hero.poster
	]);
	const suggestions = titles.filter((title) => title.id !== hero.id).slice(0, 6);
	const titleById = (0, import_react.useMemo)(() => new Map(titles.map((title) => [title.id, title])), [titles]);
	const continueTitles = Object.entries({
		...profile.progress,
		...liveProgress
	}).sort((left, right) => right[1] - left[1]).map(([id]) => titleById.get(id)).filter((title) => Boolean(title)).slice(0, 6);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "pb-28 lg:pb-16",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "relative min-h-[clamp(30rem,76svh,34rem)] overflow-hidden md:min-h-[590px]",
			children: [
				heroArt ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: heroArt,
					alt: "",
					onError: () => setHeroArtIndex((index) => index + 1),
					className: "absolute inset-0 size-full object-cover opacity-85"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArtworkFallback, { title: hero.title }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-[linear-gradient(90deg,rgba(8,8,9,.9)_0%,rgba(8,8,9,.5)_48%,rgba(8,8,9,.08)),linear-gradient(0deg,#080809_0%,transparent_50%)]" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "reelos-art-haze absolute inset-0 opacity-60",
					style: { background: `radial-gradient(circle at 70% 45%,${profile.color}2d,transparent 42%)` }
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "relative mx-auto flex min-h-[clamp(30rem,76svh,34rem)] max-w-[1600px] items-end px-5 pb-16 md:min-h-[590px] md:px-10 md:pb-20",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "max-w-2xl",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs font-semibold uppercase tracking-[.22em] text-white/48",
								children: kidsPresent ? "Tonight together" : `For ${profile.name}, right now`
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "mt-4 max-w-[12ch] font-display text-[clamp(3.05rem,12vw,8.8rem)] font-semibold leading-[.88] tracking-[-.068em] md:leading-[.82] md:tracking-[-.078em]",
								children: hero.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-6 max-w-lg text-base leading-7 text-white/64",
								children: whyThisTitle(hero, profile)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-7 flex flex-wrap gap-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => heroAccessible ? onPlay(hero) : onOpen(hero),
										className: "inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-black",
										children: heroAccessible ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4 fill-current" }), " Play now"] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: "View details" })
									}),
									heroAccessible && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: () => toggleSaved(profile.id, hero.id),
										className: "inline-flex min-h-12 items-center gap-2 rounded-full border border-white/18 bg-black/20 px-6 text-sm font-semibold backdrop-blur",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bookmark, { className: `size-4 ${profile.savedIds.includes(hero.id) ? "fill-current" : ""}` }), profile.savedIds.includes(hero.id) ? "Saved" : "Save"]
									}),
									heroAccessible && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => onOpen(hero),
										className: "min-h-12 rounded-full border border-white/18 px-5 text-sm text-white/72",
										children: "Details"
									})
								]
							})
						]
					})
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative z-10 mx-auto -mt-8 max-w-[1600px] space-y-16 px-5 md:px-10",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: () => onSearch(),
					className: "reelos-search-prompt flex min-h-20 w-full items-center gap-4 rounded-[1.4rem] border border-white/10 bg-[#141419]/92 px-5 text-left shadow-2xl backdrop-blur-xl md:px-7",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
							className: "size-5 shrink-0",
							style: { color: profile.color }
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
								className: "block text-base",
								children: "Find anything."
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mt-1 block text-sm text-white/45",
								children: "A title, actor, feeling, exclusion, or half-remembered scene."
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-5 text-white/32" })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shelf, {
					title: "Continue.",
					note: Object.keys(liveProgress).length ? "Exactly where the box says you stopped—not a guessed percentage." : `Progress saved to ${possessive(profile.name)} profile. The box has not reported a resume point.`,
					items: continueTitles,
					onOpen
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shelf, {
					title: "A few good bets.",
					note: `Shaped by ${possessive(profile.name)} taste, without hiding the rest of cinema.`,
					items: suggestions,
					onOpen,
					onSeeAll: () => onNavigate("discover")
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoIdeaChooser, {
					profile,
					titles,
					debrid,
					kidsPresent,
					onOpen,
					onPlay,
					onDiscover: () => onNavigate("discover")
				})
			]
		})]
	});
}
function NoIdeaChooser({ profile, titles, debrid, kidsPresent, onOpen, onPlay, onDiscover }) {
	const setTonight = useExperienceStore((state) => state.setTonight);
	const react = useExperienceStore((state) => state.react);
	const toggleLessLike = useExperienceStore((state) => state.toggleLessLike);
	const [stage, setStage] = (0, import_react.useState)("idle");
	const [clueKind, setClueKind] = (0, import_react.useState)("mood");
	const [clue, setClue] = (0, import_react.useState)({ kind: "none" });
	const [exploration, setExploration] = (0, import_react.useState)(profile.exploration);
	const [offset, setOffset] = (0, import_react.useState)(0);
	const accessible = (0, import_react.useMemo)(() => titles.filter((title) => experienceTitleIsAccessible(title, debrid)), [titles, debrid]);
	const picks = (0, import_react.useMemo)(() => buildDecisionPicks({
		profile,
		titles: accessible,
		availableIds: accessible.map((title) => title.id),
		clue: kidsPresent ? {
			kind: "company",
			value: "kids",
			label: "Kids are here"
		} : clue,
		exploration,
		offset
	}), [
		profile,
		titles,
		accessible,
		clue,
		exploration,
		offset,
		kidsPresent
	]);
	const decide = (nextClue, nextExploration = exploration) => {
		setClue(nextClue);
		setExploration(nextExploration);
		setOffset(0);
		if (nextClue.kind === "mood") setTonight({ mood: nextClue.value });
		if (nextClue.kind === "duration") setTonight({ duration: nextClue.value });
		setTonight({ exploration: nextExploration });
		setStage("results");
	};
	const primary = picks[0];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "reelos-no-idea relative min-h-[34rem] overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.025] px-6 py-12 md:px-10 md:py-16",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative z-10 max-w-2xl",
			children: [
				stage === "idle" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-[clamp(2.6rem,5vw,5.1rem)] font-semibold leading-[.9] tracking-[-.065em]",
						children: "No idea what to watch?"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-5 max-w-lg leading-7 text-white/52",
						children: "Don’t browse harder. Hand ReelOS the decision—or give it exactly one clue."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-8 flex flex-wrap gap-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => decide({ kind: "none" }, "balanced"),
								className: "min-h-12 rounded-full bg-white px-6 text-sm font-bold text-black",
								children: "Decide for me"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setStage("clues"),
								className: "min-h-12 rounded-full border border-white/15 px-6 text-sm font-semibold",
								children: "I can give you one clue"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => decide({ kind: "none" }, "familiar"),
								className: "min-h-12 rounded-full border border-white/15 px-6 text-sm font-semibold",
								children: "Keep it close to home"
							})
						]
					})
				] }),
				stage === "clues" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => setStage("idle"),
						className: "min-h-12 text-sm text-white/52",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "mr-2 inline size-4" }), " Back"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-3 font-display text-[clamp(2.5rem,5vw,4.7rem)] font-semibold leading-[.9] tracking-[-.065em]",
						children: "What do you know?"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-8 grid gap-3 sm:grid-cols-3",
						children: [
							[
								"mood",
								"How it should feel",
								"The emotional answer."
							],
							[
								"duration",
								"How much time",
								"No accidental epic."
							],
							[
								"company",
								"Who is here",
								"A choice the room can share."
							]
						].map(([kind, label, note]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => {
								setClueKind(kind);
								setStage("options");
							},
							className: "min-h-36 rounded-[1.4rem] bg-black/24 p-5 text-left ring-1 ring-white/10 transition hover:bg-white/8",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
								className: "block text-lg",
								children: label
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mt-2 block text-sm leading-6 text-white/42",
								children: note
							})]
						}, kind))
					})
				] }),
				stage === "options" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => setStage("clues"),
						className: "min-h-12 text-sm text-white/52",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "mr-2 inline size-4" }), " Back"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-3 font-display text-[clamp(2.5rem,5vw,4.7rem)] font-semibold leading-[.9] tracking-[-.065em]",
						children: "One clue is enough."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-8 flex flex-wrap gap-3",
						children: {
							mood: [
								{
									label: "Comfort me",
									clue: {
										kind: "mood",
										value: "comfort",
										label: "Something comforting"
									}
								},
								{
									label: "Make me laugh",
									clue: {
										kind: "mood",
										value: "funny",
										label: "Something funny"
									}
								},
								{
									label: "Give me wonder",
									clue: {
										kind: "mood",
										value: "wonder",
										label: "A sense of wonder"
									}
								},
								{
									label: "Put me on edge",
									clue: {
										kind: "mood",
										value: "edge",
										label: "Something with an edge"
									}
								},
								{
									label: "Quiet, please",
									clue: {
										kind: "mood",
										value: "quiet",
										label: "Something quiet"
									}
								}
							],
							duration: [
								{
									label: "Under 100 minutes",
									clue: {
										kind: "duration",
										value: "short",
										label: "Under 100 minutes"
									}
								},
								{
									label: "A proper feature",
									clue: {
										kind: "duration",
										value: "feature",
										label: "A proper feature"
									}
								},
								{
									label: "I have all night",
									clue: {
										kind: "duration",
										value: "long",
										label: "All night"
									}
								}
							],
							company: [
								{
									label: "Just me",
									clue: {
										kind: "company",
										value: "solo",
										label: "Just me"
									}
								},
								{
									label: "A few of us",
									clue: {
										kind: "company",
										value: "together",
										label: "A few of us"
									}
								},
								{
									label: "Kids are here",
									clue: {
										kind: "company",
										value: "kids",
										label: "Kids are here"
									}
								}
							]
						}[clueKind].map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => decide(option.clue, "balanced"),
							className: "min-h-12 rounded-full border border-white/15 bg-black/20 px-5 text-sm",
							children: option.label
						}, option.label))
					})
				] }),
				stage === "results" && primary && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-semibold uppercase tracking-[.2em] text-white/42",
						children: "ReelOS would stop here"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-3 font-display text-[clamp(3rem,6vw,5.8rem)] font-semibold leading-[.86] tracking-[-.07em]",
						children: primary.title.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-5 max-w-lg leading-7 text-white/54",
						children: [
							primary.reason,
							" ",
							!experienceTitleIsAccessible(primary.title, debrid) && "It matches the clue, but it is not available from your current sources yet."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-8 flex flex-wrap gap-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => experienceTitleIsAccessible(primary.title, debrid) ? onPlay(primary.title) : onOpen(primary.title),
								className: "min-h-12 rounded-full bg-white px-6 text-sm font-bold text-black",
								children: experienceTitleIsAccessible(primary.title, debrid) ? "Play this" : "See how to watch"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setOffset((value) => value + 3),
								className: "min-h-12 rounded-full border border-white/15 px-5 text-sm",
								children: "Give me three more"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setStage("idle"),
								className: "min-h-12 px-3 text-sm text-white/45",
								children: "Start over"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-5 flex flex-wrap items-center gap-2 text-sm text-white/48",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mr-1",
								children: "Was that a good instinct?"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => react(profile.id, primary.title.id, profile.reactions[primary.title.id] === "like" ? void 0 : "like"),
								"aria-pressed": profile.reactions[primary.title.id] === "like",
								className: `min-h-12 rounded-full px-4 text-sm transition ${profile.reactions[primary.title.id] === "like" ? "bg-white text-black" : "bg-white/8 text-white hover:bg-white/14"}`,
								children: profile.reactions[primary.title.id] === "like" ? "Liked" : "Like this"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => toggleLessLike(profile.id, primary.title.id),
								"aria-pressed": profile.lessLikeIds.includes(primary.title.id),
								className: `min-h-12 rounded-full px-4 text-sm transition ${profile.lessLikeIds.includes(primary.title.id) ? "bg-white text-black" : "bg-white/8 text-white hover:bg-white/14"}`,
								children: profile.lessLikeIds.includes(primary.title.id) ? "Undo less like this" : "Less like this"
							})
						]
					}),
					picks.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-9 flex gap-3",
						children: picks.slice(1).map((pick) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => onOpen(pick.title),
							className: "flex min-h-20 flex-1 items-center gap-3 rounded-2xl bg-black/24 p-3 text-left ring-1 ring-white/8",
							children: [pick.title.poster && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: pick.title.poster,
								alt: "",
								className: "h-16 w-11 rounded-lg object-cover"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
								className: "block text-sm",
								children: pick.title.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mt-1 block text-xs text-white/42",
								children: "Another honest answer"
							})] })]
						}, pick.title.id))
					})
				] }),
				stage === "results" && !primary && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-semibold uppercase tracking-[.2em] text-white/42",
						children: "Nothing ready yet"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-3 max-w-xl font-display text-[clamp(2.9rem,6vw,5.8rem)] font-semibold leading-[.86] tracking-[-.07em]",
						children: "This home needs something it can actually play."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-5 max-w-lg leading-7 text-white/54",
						children: "Your taste can still grow from anything you love. Add a verified public or personal source when you are ready, then ReelOS can make a real choice for tonight."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-8 flex flex-wrap gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: onDiscover,
							className: "min-h-12 rounded-full bg-white px-6 text-sm font-bold text-black",
							children: "Explore anyway"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setStage("idle"),
							className: "min-h-12 rounded-full border border-white/15 px-5 text-sm",
							children: "Start over"
						})]
					})
				] })
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FallingArtwork, { titles: titles.slice(7, 19) })]
	});
}
function FallingArtwork({ titles }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "reelos-falling-art pointer-events-none absolute -bottom-24 right-[-5%] hidden h-[135%] w-[48%] rotate-[8deg] grid-cols-3 gap-3 opacity-55 md:grid",
		"aria-hidden": "true",
		children: [[
			0,
			1,
			2
		].map((column) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: `space-y-3 ${column === 1 ? "pt-20" : column === 2 ? "pt-40" : ""}`,
			children: titles.slice(column * 4, column * 4 + 4).map((title) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: title.poster,
				alt: "",
				className: "aspect-[.68] w-full rounded-2xl object-cover shadow-2xl"
			}, title.id))
		}, column)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute inset-0 bg-gradient-to-r from-[#0c0c0f] via-transparent to-transparent" })]
	});
}
function DiscoverWorld({ profile, titles, onOpen, onSearch, onRefine, onPerson, onCollection }) {
	const tonight = useExperienceStore((state) => state.tonight);
	const setTonight = useExperienceStore((state) => state.setTonight);
	const clearTonight = useExperienceStore((state) => state.clearTonight);
	const hero = titles.find((title) => title.id !== profile.savedIds[0]) ?? titles[0];
	const paths = [
		{
			id: "quiet",
			label: "Quietly strange",
			note: "Arrival · Her · Severance",
			ids: [
				"arrival",
				"her",
				"severance"
			]
		},
		{
			id: "comfort",
			label: "Warm, never sugary",
			note: "The Holdovers · Amélie · Totoro",
			ids: [
				"holdovers",
				"amelie",
				"my-neighbor-totoro"
			]
		},
		{
			id: "kinetic",
			label: "Make the home feel bigger",
			note: "Fury Road · Dune · Spider-Verse",
			ids: [
				"mad-max-fury-road",
				"tmdb-movie-693134",
				"spider-verse"
			]
		}
	];
	const people = [
		"Florence Pugh",
		"Ayo Edebiri",
		"Ryan Gosling",
		"Zendaya"
	];
	const selectShelf = (excluded, matches) => titles.filter((title) => !excluded.has(title.id) && matches(title)).slice(0, 6);
	const beautifulTrouble = selectShelf(/* @__PURE__ */ new Set(), (title) => title.moods.some((mood) => [
		"beautiful",
		"tense",
		"colorful",
		"dark"
	].includes(mood)));
	const afterMidnight = selectShelf(new Set(beautifulTrouble.map((title) => title.id)), (title) => title.moods.some((mood) => [
		"late night",
		"rainy",
		"patient",
		"cerebral"
	].includes(mood)));
	const kindOnes = selectShelf(new Set([...beautifulTrouble, ...afterMidnight].map((title) => title.id)), (title) => title.family || title.moods.some((mood) => [
		"warm",
		"comfort",
		"gentle"
	].includes(mood)));
	const shelves = [
		{
			name: "Beautiful trouble",
			note: "Color, tension, and a world with edges.",
			items: beautifulTrouble
		},
		{
			name: "A little after midnight",
			note: "Patient mysteries with a world of their own.",
			items: afterMidnight
		},
		{
			name: "The kind ones",
			note: "Comfort with craft, not background noise.",
			items: kindOnes
		}
	];
	const activeCount = [
		tonight.mood,
		tonight.person,
		tonight.duration !== "any",
		tonight.kind !== "all",
		tonight.exploration !== "balanced"
	].filter(Boolean).length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto max-w-[1600px] space-y-16 px-5 pb-28 pt-7 md:px-10 md:pt-10 lg:pb-20",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "relative min-h-[520px] overflow-hidden rounded-[2rem] bg-white/[.035] md:min-h-[600px]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: hero.backdrop,
						alt: "",
						className: "absolute inset-0 size-full object-cover opacity-72"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-[linear-gradient(90deg,rgba(8,8,9,.97),rgba(8,8,9,.52)_52%,rgba(8,8,9,.08)),linear-gradient(0deg,rgba(8,8,9,.7),transparent_45%)]" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative flex min-h-[520px] max-w-xl flex-col justify-end p-7 md:min-h-[600px] md:p-12",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-white/54",
								children: whyThisTitle(hero, profile)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "mt-4 font-display text-[clamp(3.8rem,7vw,7.2rem)] font-semibold leading-[.84] tracking-[-.075em]",
								children: hero.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-5 max-w-md leading-7 text-white/60",
								children: hero.note
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => onOpen(hero),
								className: "mt-7 inline-flex min-h-12 w-fit items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-black",
								children: ["Open this door ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4" })]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3 sm:flex-row",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: () => onSearch(),
					className: "flex min-h-14 flex-1 items-center gap-3 rounded-full bg-white/7 px-5 text-left text-sm text-white/60",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-4" }), "Search a title, person, mood, or memory"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: onRefine,
					className: "inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-white/12 px-5 text-sm font-semibold",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlidersHorizontal, { className: "size-4" }),
						"Refine",
						activeCount ? ` · ${activeCount}` : ""
					]
				})]
			}), activeCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap gap-2 text-xs text-white/56",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Tonight:" }),
					tonight.mood && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded-full bg-white/8 px-3 py-1.5",
						children: tonight.mood
					}),
					tonight.person && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded-full bg-white/8 px-3 py-1.5",
						children: tonight.person
					}),
					tonight.duration !== "any" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded-full bg-white/8 px-3 py-1.5",
						children: tonight.duration
					}),
					tonight.kind !== "all" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded-full bg-white/8 px-3 py-1.5",
						children: tonight.kind
					}),
					tonight.exploration !== "balanced" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded-full bg-white/8 px-3 py-1.5",
						children: tonight.exploration
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: clearTonight,
						className: "min-h-8 rounded-full px-2.5 text-xs text-white/70 underline decoration-white/30 underline-offset-4 hover:text-white",
						children: "Clear"
					})
				]
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-4 md:grid-cols-3",
				children: paths.map((path) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: () => {
						setTonight({ mood: path.id });
						onCollection(path.label, path.ids);
					},
					className: "group relative min-h-64 overflow-hidden rounded-[1.7rem] bg-white/[.035] p-6 text-left",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute -right-5 -top-5 flex w-[55%] -space-x-10 rotate-[7deg] opacity-72 transition duration-700 group-hover:translate-x-[-6px]",
						children: path.ids.map((id) => TITLE_BY_EXPERIENCE_ID[id]).filter(Boolean).map((title) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: title.poster,
							alt: "",
							className: "aspect-[.68] w-24 rounded-xl object-cover shadow-2xl"
						}, title.id))
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative mt-28",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
							className: "font-display text-2xl tracking-[-.045em]",
							children: path.label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-2 block text-sm text-white/46",
							children: path.note
						})]
					})]
				}, path.id))
			}) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shelf, {
				title: shelves[0].name,
				note: shelves[0].note,
				items: shelves[0].items,
				onOpen,
				onSeeAll: () => onCollection(shelves[0].name, shelves[0].items.map((item) => item.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-wrap items-center gap-3 rounded-[1.6rem] bg-[linear-gradient(135deg,rgba(239,125,180,.14),rgba(96,121,206,.07))] p-5 md:p-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "mr-1 text-sm text-white/52",
					children: "Follow a familiar face"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-3",
					children: people.map((person) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => onPerson(person),
						className: "min-h-12 rounded-full border border-white/13 bg-black/15 px-5 text-sm hover:bg-white/10",
						children: person
					}, person))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shelf, {
				title: shelves[1].name,
				note: shelves[1].note,
				items: shelves[1].items,
				onOpen,
				onSeeAll: () => onCollection(shelves[1].name, shelves[1].items.map((item) => item.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shelf, {
				title: shelves[2].name,
				note: shelves[2].note,
				items: shelves[2].items,
				onOpen,
				onSeeAll: () => onCollection(shelves[2].name, shelves[2].items.map((item) => item.id))
			})
		]
	});
}
function LibraryWorld({ profile, titles, originals, liveProgress, libraryStatus, libraryMessage, requests, onOpen, onPlay, onNavigate }) {
	const debrid = useExperienceStore((state) => state.debrid);
	const titleById = new Map(titles.map((title) => [title.id, title]));
	const progress = Object.entries({
		...profile.progress,
		...liveProgress
	}).map(([id, value]) => ({
		title: titleById.get(id),
		value
	})).filter((item) => item.title !== void 0 && experienceTitleIsAccessible(item.title, debrid));
	const saved = profile.savedIds.map((id) => titleById.get(id)).filter((title) => title !== void 0 && experienceTitleIsAccessible(title, debrid));
	const reactions = (kind) => Object.entries(profile.reactions).filter(([, reaction]) => reaction === kind).map(([id]) => titleById.get(id)).filter((title) => title !== void 0 && experienceTitleIsAccessible(title, debrid));
	const activeRequests = Object.values(requests).map((request) => ({
		...request,
		title: titleById.get(request.titleId)
	})).filter((item) => item.title !== void 0);
	const [tab, setTab] = (0, import_react.useState)("all");
	const onBox = titles.filter((title) => title.sources.some((source) => source.kind === "retained_local" && source.verified));
	const preparationTitles = originals.filter((title) => title.kind !== "book" && title.sources.some((source) => source.verified && (source.kind === "personal_import" || source.kind === "public_domain"))).map((title) => ({
		id: title.id,
		title: title.title
	}));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto max-w-[1600px] space-y-16 px-5 pb-28 pt-10 md:px-10 lg:pb-20",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-end justify-between gap-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-[clamp(3.4rem,7vw,6.6rem)] font-semibold leading-none tracking-[-.075em]",
					children: "Library"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-4 text-white/50",
					children: [
						"Everything ",
						profile.name,
						" kept close."
					]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex gap-2",
					children: [
						"all",
						"saved",
						"offline"
					].map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setTab(item),
						className: `min-h-11 rounded-full px-4 text-sm capitalize ${tab === item ? "bg-white text-black" : "bg-white/7 text-white/58"}`,
						children: item
					}, item))
				})]
			}),
			(tab === "all" || tab === "offline") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreparationPanel, { titles: preparationTitles }, profile.id),
			tab === "all" && progress.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-3xl font-semibold tracking-[-.055em]",
				children: "Pick up where you left off."
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-6 grid gap-4 md:grid-cols-2",
				children: progress.map(({ title, value }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "relative min-h-72 overflow-hidden rounded-[1.8rem] bg-white/5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: title.backdrop,
							alt: "",
							className: "absolute inset-0 size-full object-cover opacity-55"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute inset-0 bg-gradient-to-r from-black/95 via-black/48 to-transparent" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative flex min-h-72 max-w-sm flex-col justify-end p-7",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-sm text-white/54",
									children: [Math.round(value * 100), "% complete"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "mt-2 font-display text-4xl font-semibold tracking-[-.055em]",
									children: title.title
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-5 h-1.5 overflow-hidden rounded-full bg-white/18",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "h-full rounded-full",
										style: {
											width: `${value * 100}%`,
											backgroundColor: profile.color
										}
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => onPlay(title),
									className: "mt-5 inline-flex min-h-12 w-fit items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-black",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4 fill-current" }), "Keep watching"]
								})
							]
						})
					]
				}, title.id))
			})] }),
			activeRequests.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-3xl font-semibold tracking-[-.055em]",
				children: "Preparing."
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-5 grid gap-3 md:grid-cols-2",
				children: activeRequests.map((request) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: () => onOpen(request.title),
					className: "flex min-h-20 items-center gap-4 rounded-2xl bg-white/[.045] px-5 text-left",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: request.title.poster,
							alt: "",
							className: "h-14 w-10 rounded-md object-cover"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
								className: "block",
								children: request.title.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", {
								className: "mt-1 block text-white/45",
								children: [
									"Preview state · ",
									request.status,
									request.progress ? ` · ${request.progress}%` : ""
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4 text-white/35" })
					]
				}, request.titleId))
			})] }),
			tab !== "offline" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shelf, {
				title: tab === "saved" ? "Saved." : "Your shelf.",
				note: saved.length ? "Ready whenever the mood returns." : "Save something and it will wait here.",
				items: saved,
				onOpen
			}),
			tab === "all" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				onBox.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shelf, {
					title: "On this box.",
					note: "The real local shelf reported by ReelOS.",
					items: onBox,
					onOpen
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Library, {}),
					title: libraryStatus === "live" ? "This box is waiting." : "The box library didn’t answer.",
					text: libraryStatus === "live" ? "No retained or personal titles were reported. Public-domain choices and your saved list remain available without pretending they are stored locally." : libraryMessage || "Your saved profile state is still here. ReelOS will restore the local shelf when the library service returns.",
					action: "Explore something",
					onAction: () => onNavigate("discover")
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shelf, {
					title: "Loved.",
					items: reactions("love"),
					onOpen
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shelf, {
					title: "Cozy.",
					note: "The things that feel like returning somewhere.",
					items: reactions("cozy"),
					onOpen
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				onClick: () => onNavigate("books"),
				className: "group relative flex min-h-64 w-full overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_80%_20%,var(--reelos-favorite),transparent_32%),linear-gradient(145deg,#19151a,#0c0c0f)] p-8 text-left md:p-10",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "mt-auto max-w-xl",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, { className: "size-6" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", {
							className: "mt-6 block font-display text-4xl tracking-[-.055em]",
							children: [
								"Books belong to ",
								profile.name,
								", too."
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-3 block leading-7 text-white/55",
							children: "Your shelf, reading progress, and discoveries stay personal. Open your reading world."
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "absolute bottom-8 right-8 size-6 transition group-hover:translate-x-1" })]
			})
		]
	});
}
function BooksWorld({ profile, initialQuery, onNavigate }) {
	const setBookProgress = useExperienceStore((state) => state.setBookProgress);
	const toggleBookBookmark = useExperienceStore((state) => state.toggleBookBookmark);
	const setReadingAppearance = useExperienceStore((state) => state.setReadingAppearance);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "pb-28 lg:pb-16",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mx-auto max-w-[1600px] px-5 pt-10 md:px-10",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-4 flex flex-wrap items-center justify-between gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm text-white/48",
					children: [possessive(profile.name), " reading world · progress stays with this profile"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => onNavigate("settings"),
					className: "min-h-11 rounded-full border border-white/12 px-4 text-sm text-white/65",
					children: "Reading appearance"
				})]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "reelos-books-host mx-auto max-w-[1600px] px-5 md:px-10",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BooksView, {
				initialQuery,
				bookProgress: profile.bookProgress,
				bookLocations: profile.bookLocations || {},
				bookBookmarks: profile.bookBookmarks || {},
				readingAppearance: profile.readingAppearance || {
					theme: "dark",
					fontSizeIndex: 1
				},
				onProgress: (bookId, progress, location) => setBookProgress(profile.id, bookId, progress, location),
				onToggleBookmark: (bookId, location) => toggleBookBookmark(profile.id, bookId, location),
				onAppearance: (patch) => setReadingAppearance(profile.id, patch)
			})
		})]
	});
}
function ProfileWorld({ profile, onNavigate, onOpen }) {
	const loved = Object.entries(profile.reactions).filter(([, reaction]) => reaction === "love").map(([id]) => TITLE_BY_EXPERIENCE_ID[id]).filter(Boolean);
	const cozy = Object.entries(profile.reactions).filter(([, reaction]) => reaction === "cozy").map(([id]) => TITLE_BY_EXPERIENCE_ID[id]).filter(Boolean);
	const backdrop = loved[0] ?? profile.savedIds.map((id) => TITLE_BY_EXPERIENCE_ID[id]).find(Boolean) ?? EXPERIENCE_CATALOG[0];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "pb-28 lg:pb-16",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "relative min-h-[430px] overflow-hidden",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: backdrop.backdrop,
					alt: "",
					className: "absolute inset-0 size-full object-cover opacity-38"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute inset-0 bg-[linear-gradient(0deg,#080809,transparent_80%),linear-gradient(90deg,#080809,transparent)]" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "relative mx-auto flex min-h-[430px] max-w-[1600px] items-end px-5 pb-12 md:px-10",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "grid size-20 place-items-center rounded-full text-3xl font-bold text-black shadow-2xl",
							style: { backgroundColor: profile.color },
							children: profile.name[0]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "mt-6 font-display text-[clamp(3.6rem,8vw,7.5rem)] font-semibold leading-none tracking-[-.075em]",
							children: profile.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-4 max-w-lg text-white/54",
							children: "A private place for taste, history, and the things you return to."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-7 flex flex-wrap gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => onNavigate("taste"),
								className: "inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-black",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WandSparkles, { className: "size-4" }), "Tune your taste"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => onNavigate("settings"),
								className: "min-h-12 rounded-full border border-white/15 px-6 text-sm",
								children: "Appearance & preferences"
							})]
						})
					] })
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto max-w-[1600px] space-y-16 px-5 md:px-10",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shelf, {
					title: "Loved.",
					note: "The strongest anchors in this profile.",
					items: loved,
					onOpen
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shelf, {
					title: "Comfort.",
					note: "A shelf made from Cozy reactions.",
					items: cozy,
					onOpen
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "grid gap-4 md:grid-cols-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
							label: "Loved",
							value: String(loved.length),
							note: "Strong taste anchors"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
							label: "Saved",
							value: String(profile.savedIds.length),
							note: "Waiting in Library"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
							label: "Motion",
							value: profile.motion,
							note: "Personal appearance"
						})
					]
				})
			]
		})]
	});
}
function StatCard({ label, value, note }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-[1.5rem] bg-white/[.035] p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-sm text-white/42",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
				className: "mt-5 block font-display text-3xl capitalize tracking-[-.05em]",
				children: value
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mt-2 block text-sm text-white/42",
				children: note
			})
		]
	});
}
function TasteWorld({ profile, onExit }) {
	const react = useExperienceStore((state) => state.react);
	const dismissTaste = useExperienceStore((state) => state.dismissTaste);
	const toggleLessLike = useExperienceStore((state) => state.toggleLessLike);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "reelos-taste-world relative min-h-dvh overflow-hidden",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "reelos-taste-glow absolute left-1/2 top-[42%] h-[70vw] max-h-[800px] w-[70vw] max-w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px]",
			style: { backgroundColor: `${profile.color}23` }
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative mx-auto flex min-h-dvh max-w-[1600px] flex-col px-5 py-5 md:px-10 md:py-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "z-20 flex items-start justify-between gap-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm text-white/45",
							children: [possessive(profile.name), " taste"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "mt-2 font-display text-[clamp(2rem,4.5vw,4.5rem)] font-semibold leading-none tracking-[-.07em]",
							children: "Fill it with what you love."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 max-w-xl text-sm text-white/52 md:text-base",
							children: "Tap to like. Tap again to love. Stay while it is fun—this world keeps growing with you. Anything you love belongs here, even if it lives somewhere else."
						})
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onExit,
						className: "grid size-12 shrink-0 place-items-center rounded-full border border-white/14",
						"aria-label": "Leave taste tuning",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EndlessTasteField, {
					color: profile.color,
					reactions: profile.reactions,
					dismissedIds: profile.dismissedTasteIds,
					lessLikeIds: profile.lessLikeIds,
					onReact: (itemId, reaction) => react(profile.id, itemId, reaction),
					onDismiss: (itemId) => dismissTaste(profile.id, itemId),
					onToggleLessLike: (itemId) => toggleLessLike(profile.id, itemId)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onExit,
						className: "pointer-events-auto min-h-12 rounded-full bg-white px-7 text-sm font-bold text-black shadow-2xl",
						children: "That feels like me"
					})
				})
			]
		})]
	});
}
function EndlessTasteField({ color, reactions, dismissedIds, lessLikeIds, onReact, onDismiss, onToggleLessLike, setup = false }) {
	const [selectedId, setSelectedId] = (0, import_react.useState)(null);
	const [departedIds, setDepartedIds] = (0, import_react.useState)([]);
	const [departingIds, setDepartingIds] = (0, import_react.useState)([]);
	const [cycle, setCycle] = (0, import_react.useState)(0);
	const dismissedKey = dismissedIds.join("");
	const departureTimers = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	(0, import_react.useEffect)(() => () => {
		for (const timer of departureTimers.current.values()) clearTimeout(timer);
	}, []);
	const visible = (0, import_react.useMemo)(() => tasteFieldViewport(TASTE_ITEMS, {
		reactions,
		dismissedIds,
		lessLikeIds
	}, departedIds, cycle), [
		cycle,
		departedIds,
		dismissedKey
	]);
	const selected = TASTE_ITEMS.find((item) => item.id === selectedId);
	const releaseBubble = (itemId, delay = 420) => {
		const existing = departureTimers.current.get(itemId);
		if (existing) clearTimeout(existing);
		const timer = setTimeout(() => {
			setDepartingIds((current) => [...current.filter((id) => id !== itemId), itemId]);
			setTimeout(() => {
				setDepartedIds((current) => [...current.filter((id) => id !== itemId), itemId].slice(-18));
				setDepartingIds((current) => current.filter((id) => id !== itemId));
				setCycle((current) => current + 1);
				setSelectedId((current) => current === itemId ? null : current);
			}, 260);
			departureTimers.current.delete(itemId);
		}, delay);
		departureTimers.current.set(itemId, timer);
	};
	const chooseBubble = (itemId) => {
		const next = nextTasteReaction(reactions[itemId]);
		onReact(itemId, next);
		setSelectedId(itemId);
		releaseBubble(itemId, next === "love" ? 520 : 1900);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: `reelos-endless-taste-field ${setup ? "is-setup" : ""}`,
		role: "group",
		"aria-label": "Your endless taste picker",
		children: visible.map((item, index) => {
			const reaction = reactions[item.id];
			const less = lessLikeIds.includes(item.id);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				"data-taste-item": item.kind,
				"aria-label": `${reaction === "like" ? "Love" : "Like"} ${item.title}${reaction ? `, currently ${reaction}` : ""}`,
				"aria-pressed": Boolean(reaction),
				onClick: () => chooseBubble(item.id),
				className: `reelos-endless-taste-bubble ${reaction ? `is-${reaction}` : ""} ${less ? "is-less" : ""} ${departingIds.includes(item.id) ? "is-departing" : ""}`,
				style: {
					"--taste-color": color,
					"--taste-delay": `${-(index * .73 % 6)}s`
				},
				children: [
					item.image && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: item.image,
						alt: "",
						loading: "lazy"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "reelos-endless-taste-shade" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "reelos-endless-taste-copy",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: item.title }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: item.subtitle }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: reaction === "love" ? "Loved" : reaction === "like" ? "Tap again to love" : reaction === "cozy" ? "Cozy" : less ? "Less like this" : item.kind })
						]
					})
				]
			}, item.id);
		})
	}), selected && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "reelos-taste-actions fixed inset-x-3 bottom-20 z-50 mx-auto max-w-xl rounded-[1.7rem] border border-white/12 bg-[#17171c]/96 p-4 shadow-2xl backdrop-blur-2xl",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
					className: "block truncate",
					children: selected.title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "mt-1 block truncate text-xs text-white/45",
					children: selected.subtitle
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: () => setSelectedId(null),
				"aria-label": "Close taste actions",
				className: "grid size-11 place-items-center rounded-full hover:bg-white/8",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 grid grid-cols-5 gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReactionButton, {
					label: "Like",
					active: reactions[selected.id] === "like",
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {}),
					onClick: () => {
						onReact(selected.id, reactions[selected.id] === "like" ? void 0 : "like");
						releaseBubble(selected.id, 900);
					}
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReactionButton, {
					label: "Love",
					active: reactions[selected.id] === "love",
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, {}),
					onClick: () => {
						onReact(selected.id, reactions[selected.id] === "love" ? void 0 : "love");
						releaseBubble(selected.id);
					}
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReactionButton, {
					label: "Cozy",
					active: reactions[selected.id] === "cozy",
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Coffee, {}),
					onClick: () => {
						onReact(selected.id, reactions[selected.id] === "cozy" ? void 0 : "cozy");
						releaseBubble(selected.id, 650);
					}
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReactionButton, {
					label: "Less",
					active: lessLikeIds.includes(selected.id),
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlidersHorizontal, {}),
					onClick: () => onToggleLessLike(selected.id)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReactionButton, {
					label: "Dismiss",
					active: false,
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, {}),
					onClick: () => {
						onDismiss(selected.id);
						releaseBubble(selected.id, 0);
					}
				})
			]
		})]
	})] });
}
function ReactionButton({ label, active, icon, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		onClick,
		className: `flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] ${active ? "bg-white text-black" : "bg-white/7 text-white/64"}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "[&>svg]:size-4",
			children: icon
		}), label]
	});
}
function FamilyWorld({ onNavigate }) {
	const profiles = useExperienceStore((state) => state.profiles);
	const addProfile = useExperienceStore((state) => state.addProfile);
	const patchProfile = useExperienceStore((state) => state.patchProfile);
	const kidsPresentIds = useExperienceStore((state) => state.kidsPresentIds);
	const toggleKidPresent = useExperienceStore((state) => state.toggleKidPresent);
	const [editor, setEditor] = (0, import_react.useState)(null);
	const [editingId, setEditingId] = (0, import_react.useState)(null);
	const [name, setName] = (0, import_react.useState)("");
	const [pinEnabled, setPinEnabled] = (0, import_react.useState)(false);
	const [pin, setPin] = (0, import_react.useState)("");
	const [pinConfirm, setPinConfirm] = (0, import_react.useState)("");
	const [savingProfile, setSavingProfile] = (0, import_react.useState)(false);
	const [profileError, setProfileError] = (0, import_react.useState)("");
	const pendingNewProfileId = (0, import_react.useRef)(null);
	const [maturity, setMaturity] = (0, import_react.useState)("big");
	const [bedtime, setBedtime] = (0, import_react.useState)("8:30 PM");
	const [boundaries, setBoundaries] = (0, import_react.useState)({
		scares: "ask",
		slapstick: "fine",
		fantasy: "fine",
		romance: "ask",
		grief: "ask",
		supernatural: "ask",
		stunts: "ask",
		language: "never"
	});
	const [familyPlayback, setFamilyPlayback] = (0, import_react.useState)({
		languageSeverity: "moderate",
		religiousLanguage: false,
		audioTreatment: "mute",
		subtitleTreatment: "hide",
		exceptions: []
	});
	const closeEditor = () => {
		setEditor(null);
		setEditingId(null);
		setName("");
		setPin("");
		setPinConfirm("");
		setPinEnabled(false);
		setProfileError("");
		pendingNewProfileId.current = null;
	};
	const edit = (profile) => {
		setEditingId(profile.id);
		setEditor(profile.isChild ? "child" : "adult");
		setName(profile.name);
		setPinEnabled(Boolean(profile.pinEnabled));
		setPin("");
		setPinConfirm("");
		setMaturity(profile.maturity ?? "big");
		setBedtime(profile.bedtime ?? "8:30 PM");
		setBoundaries(profile.boundaries ?? boundaries);
		setFamilyPlayback(profile.familyPlayback ?? {
			languageSeverity: "moderate",
			religiousLanguage: false,
			audioTreatment: "mute",
			subtitleTreatment: "hide",
			exceptions: []
		});
		window.scrollTo({
			top: 0,
			behavior: "auto"
		});
	};
	const beginAdd = (type) => {
		setEditor(type);
		setPinEnabled(type === "child");
		setPin("");
		setPinConfirm("");
		setProfileError("");
		window.scrollTo({
			top: 0,
			behavior: "auto"
		});
	};
	const save = async () => {
		const needsNewPin = !editingId && (pinEnabled || editor === "child");
		if (!name.trim() || needsNewPin && pin.length !== 4 || pin.length > 0 && pin.length !== 4 || pin.length > 0 && pin !== pinConfirm) return;
		setSavingProfile(true);
		setProfileError("");
		const patch = {
			name: name.trim(),
			pinEnabled: editor === "child" ? true : pinEnabled,
			...editor === "child" ? {
				isChild: true,
				maturity,
				bedtime,
				boundaries,
				familyPlayback
			} : {}
		};
		try {
			if (editingId) {
				const existing = profiles.find((profile) => profile.id === editingId);
				if (!existing) throw new Error("That profile is no longer available.");
				await saveExperienceProfile({
					...existing,
					...patch,
					updatedAt: Date.now()
				}, pin ? pin : editor === "adult" && !pinEnabled ? null : void 0);
				patchProfile(editingId, patch);
			} else {
				let newId = pendingNewProfileId.current;
				if (!newId) {
					newId = addProfile({
						name: name.trim(),
						color: editor === "child" ? "#58d5bc" : "#a9b9ff",
						isChild: editor === "child",
						pinEnabled: editor === "child" ? true : pinEnabled,
						motion: editor === "child" ? "expressive" : "subtle",
						density: "comfortable",
						exploration: editor === "child" ? "familiar" : "balanced",
						reactions: {},
						dismissedTasteIds: [],
						lessLikeIds: [],
						savedIds: [],
						progress: {},
						bookProgress: {},
						audioPreference: editor === "child" ? "dub" : "original",
						subtitleLanguage: "English",
						...editor === "child" ? {
							maturity,
							bedtime,
							boundaries,
							familyPlayback
						} : {}
					});
					pendingNewProfileId.current = newId;
				}
				const created = useExperienceStore.getState().profiles.find((profile) => profile.id === newId);
				if (!created) throw new Error("That profile could not be prepared.");
				await saveExperienceProfile(created, pin || void 0);
			}
			closeEditor();
		} catch (reason) {
			setProfileError(reason instanceof Error ? reason.message : "This profile could not be saved yet.");
		} finally {
			setSavingProfile(false);
		}
	};
	if (editor) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FamilyEditor, {
		type: editor,
		name,
		setName,
		pinEnabled,
		setPinEnabled,
		pin,
		setPin,
		pinConfirm,
		setPinConfirm,
		maturity,
		setMaturity,
		bedtime,
		setBedtime,
		boundaries,
		setBoundaries,
		familyPlayback,
		setFamilyPlayback,
		editing: Boolean(editingId),
		saving: savingProfile,
		error: profileError,
		onBack: closeEditor,
		onSave: () => void save()
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto max-w-[1400px] px-5 pb-28 pt-12 md:px-10 lg:pb-20",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-end justify-between gap-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-[clamp(3.4rem,7vw,6.5rem)] font-semibold leading-none tracking-[-.075em]",
					children: "Family"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 max-w-xl text-white/52",
					children: "People, private tastes, and the boundaries that make this home work for everyone."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: () => onNavigate("party"),
					className: "inline-flex min-h-12 items-center gap-2 rounded-full border border-white/13 px-5 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "size-4" }), "Watch together"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
				children: [
					profiles.filter((profile) => !profile.isGuest).map((profile) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => edit(profile),
						className: "reelos-family-card min-h-64 rounded-[1.7rem] bg-white/[.035] p-6 text-left",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "grid size-16 place-items-center rounded-full text-xl font-bold text-black",
								style: { backgroundColor: profile.color },
								children: profile.name[0]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
								className: "mt-8 block text-xl",
								children: profile.name
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mt-1 block text-sm text-white/45",
								children: profile.isChild ? `${profile.maturity ?? "Custom"} boundaries · PIN required` : profile.pinEnabled ? "Adult · Passcode protected" : "Adult · Open profile"
							})
						]
					}, profile.id)),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => beginAdd("adult"),
						className: "reelos-family-card min-h-64 rounded-[1.7rem] border border-dashed border-white/16 p-6 text-left",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "grid size-16 place-items-center rounded-full border border-dashed border-white/24",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
								className: "mt-8 block text-xl",
								children: "Add an adult"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mt-1 block text-sm text-white/45",
								children: "Their own history and taste."
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => beginAdd("child"),
						className: "reelos-family-card min-h-64 rounded-[1.7rem] bg-[linear-gradient(145deg,rgba(88,213,188,.16),rgba(50,84,135,.14))] p-6 text-left",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "grid size-16 place-items-center rounded-full bg-[#58d5bc]/18 text-[#58d5bc]",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
								className: "mt-8 block text-xl",
								children: "Add a child"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mt-1 block text-sm text-white/48",
								children: "Set the boundaries of their cinema."
							})
						]
					})
				]
			}),
			profiles.some((profile) => profile.isChild) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-14 rounded-[1.7rem] bg-white/[.035] p-6 md:p-8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-white/44",
						children: "Who is watching right now?"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-2 font-display text-3xl font-semibold tracking-[-.055em]",
						children: "Presence changes tonight, not anyone’s profile."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-6 flex flex-wrap gap-3",
						children: profiles.filter((profile) => profile.isChild).map((child) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => {
								const nextIds = kidsPresentIds.includes(child.id) ? kidsPresentIds.filter((id) => id !== child.id) : [...kidsPresentIds, child.id];
								toggleKidPresent(child.id);
								syncFamilyPresence(nextIds).catch(() => void 0);
							},
							className: `min-h-12 rounded-full px-5 text-sm font-semibold ${kidsPresentIds.includes(child.id) ? "bg-[#58d5bc] text-[#071411]" : "border border-white/14"}`,
							children: kidsPresentIds.includes(child.id) ? `${child.name} is here` : `${child.name} is in bed`
						}, child.id))
					})
				]
			})
		]
	});
}
function FamilyEditor({ type, name, setName, pinEnabled, setPinEnabled, pin, setPin, pinConfirm, setPinConfirm, maturity, setMaturity, bedtime, setBedtime, boundaries, setBoundaries, familyPlayback, setFamilyPlayback, editing, saving, error, onBack, onSave }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto max-w-5xl px-5 pb-28 pt-10 md:px-10",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				onClick: onBack,
				className: "inline-flex min-h-12 items-center gap-2 text-sm text-white/55",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-4" }), "Family"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-6 font-display text-[clamp(3rem,6vw,5.5rem)] font-semibold leading-none tracking-[-.07em]",
				children: editing ? `Edit ${name}` : type === "child" ? "Make a safe little cinema." : "Add someone to the home."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-10 max-w-2xl border-b border-white/22",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: name,
					onChange: (event) => setName(event.target.value),
					placeholder: "Their name",
					className: "w-full bg-transparent py-4 text-2xl outline-none placeholder:text-white/25"
				})
			}),
			type === "child" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-12",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-white/44",
						children: "Starting point"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4 grid grid-cols-2 gap-2 md:grid-cols-4",
						children: [
							"little",
							"big",
							"teen",
							"mature"
						].map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setMaturity(item),
							className: `min-h-14 rounded-2xl capitalize ${maturity === item ? "bg-[#58d5bc] text-[#071411]" : "bg-white/7"}`,
							children: item === "little" ? "Little kids" : item === "big" ? "Big kids" : item === "mature" ? "Mature teens" : "Teens"
						}, item))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-12",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-white/44",
							children: "Teach the boundary"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-2 font-display text-3xl tracking-[-.05em]",
							children: "Every family draws these lines differently."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-6 grid gap-3 md:grid-cols-2",
							children: [
								["scares", "Scary monsters & jump scares"],
								["slapstick", "Comic danger & slapstick"],
								["fantasy", "Fantasy creature combat"],
								["romance", "Romance & mild innuendo"],
								["grief", "Grief & emotional peril"],
								["supernatural", "Ghosts & supernatural themes"],
								["stunts", "Imitable stunts"],
								["language", "Coarse language"]
							].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-2xl bg-white/[.035] p-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
									className: "text-sm",
									children: label
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-3 grid grid-cols-3 gap-2",
									children: [
										"fine",
										"ask",
										"never"
									].map((choice) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => setBoundaries({
											...boundaries,
											[id]: choice
										}),
										className: `min-h-11 rounded-xl text-xs capitalize ${boundaries[id] === choice ? choice === "fine" ? "bg-[#58d5bc] text-[#071411]" : choice === "ask" ? "bg-[#f0ba61] text-[#201608]" : "bg-[#df8790] text-[#2b0b10]" : "bg-white/7 text-white/55"}`,
										children: choice === "ask" ? "Ask first" : choice
									}, choice))
								})]
							}, id))
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "mt-8 block max-w-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-sm text-white/50",
						children: "Bedtime"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: bedtime,
						onChange: (event) => setBedtime(event.target.value),
						className: "mt-2 min-h-12 w-full rounded-xl bg-white/7 px-4 outline-none"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-12 rounded-[1.7rem] bg-white/[.035] p-5 md:p-7",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-white/44",
							children: "During playback"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-2 font-display text-3xl tracking-[-.05em]",
							children: "Choose how language is treated."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 max-w-2xl text-sm leading-6 text-white/48",
							children: "This changes audio and matching subtitles only when ReelOS has a verified dialogue track. It never claims to edit every title, and it does not remove a film from the catalog."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-6 grid grid-cols-2 gap-2 md:grid-cols-4",
							children: [
								"off",
								"strong",
								"moderate",
								"mild"
							].map((severity) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setFamilyPlayback({
									...familyPlayback,
									languageSeverity: severity
								}),
								className: `min-h-12 rounded-xl text-sm capitalize ${familyPlayback.languageSeverity === severity ? "bg-[#58d5bc] text-[#071411]" : "bg-white/7"}`,
								children: severity === "off" ? "Off" : `${severity} + above`
							}, severity))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setFamilyPlayback({
								...familyPlayback,
								religiousLanguage: !familyPlayback.religiousLanguage
							}),
							className: "mt-4 flex min-h-14 w-full items-center justify-between rounded-xl bg-white/7 px-4 text-left text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
								className: "block",
								children: "Religious language"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", {
								className: "mt-1 block text-white/45",
								children: "Treat religious expletives separately from other language."
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: `grid size-8 place-items-center rounded-full ${familyPlayback.religiousLanguage ? "bg-[#58d5bc] text-[#071411]" : "bg-white/10"}`,
								children: familyPlayback.religiousLanguage && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 grid gap-4 md:grid-cols-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mb-2 text-xs uppercase tracking-wider text-white/40",
								children: "Audio"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid grid-cols-2 gap-2",
								children: ["mute", "soften"].map((treatment) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setFamilyPlayback({
										...familyPlayback,
										audioTreatment: treatment
									}),
									className: `min-h-11 rounded-xl capitalize ${familyPlayback.audioTreatment === treatment ? "bg-white text-black" : "bg-white/7"}`,
									children: treatment
								}, treatment))
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mb-2 text-xs uppercase tracking-wider text-white/40",
								children: "Matching subtitles"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid grid-cols-2 gap-2",
								children: ["hide", "replace"].map((treatment) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setFamilyPlayback({
										...familyPlayback,
										subtitleTreatment: treatment
									}),
									className: `min-h-11 rounded-xl capitalize ${familyPlayback.subtitleTreatment === treatment ? "bg-white text-black" : "bg-white/7"}`,
									children: treatment
								}, treatment))
							})] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "mt-5 block",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-sm text-white/50",
								children: "Always allow these titles"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: familyPlayback.exceptions.join(", "),
								onChange: (event) => setFamilyPlayback({
									...familyPlayback,
									exceptions: event.target.value.split(",").map((item) => item.trim()).filter(Boolean)
								}),
								placeholder: "Title, another title",
								className: "mt-2 min-h-12 w-full rounded-xl bg-white/7 px-4 outline-none placeholder:text-white/25"
							})]
						})
					]
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				onClick: () => type === "adult" && setPinEnabled(!pinEnabled),
				className: `mt-10 flex min-h-20 w-full max-w-2xl items-center justify-between rounded-[1.35rem] px-5 text-left ${pinEnabled || type === "child" ? "bg-white/9" : "bg-white/[.035]"}`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
					className: "block",
					children: type === "child" ? "Family PIN required to leave" : "Protect this profile with a passcode"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", {
					className: "mt-1 block text-white/45",
					children: type === "child" ? "Both parents can change or reset it." : "Optional privacy for history and taste."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: `grid size-9 place-items-center rounded-full ${pinEnabled || type === "child" ? "bg-white text-black" : "bg-white/9"}`,
					children: (pinEnabled || type === "child") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" })
				})]
			}),
			(pinEnabled || type === "child") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid w-full max-w-2xl gap-3 sm:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: pin,
					onChange: (event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4)),
					inputMode: "numeric",
					autoComplete: "new-password",
					"aria-label": editing ? "New 4-digit PIN" : "Create a 4-digit PIN",
					placeholder: editing ? "New PIN (optional)" : "Create a 4-digit PIN",
					className: "min-h-14 rounded-xl bg-white/7 px-4 text-lg tracking-[.25em] outline-none placeholder:text-sm placeholder:tracking-normal placeholder:text-white/24"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: pinConfirm,
					onChange: (event) => setPinConfirm(event.target.value.replace(/\D/g, "").slice(0, 4)),
					inputMode: "numeric",
					autoComplete: "new-password",
					"aria-label": "Confirm 4-digit PIN",
					placeholder: "Confirm PIN",
					className: "min-h-14 rounded-xl bg-white/7 px-4 text-lg tracking-[.25em] outline-none placeholder:text-sm placeholder:tracking-normal placeholder:text-white/24"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				disabled: saving || !name.trim() || (pinEnabled || type === "child") && !editing && pin.length !== 4 || pin.length > 0 && (pin.length !== 4 || pin !== pinConfirm),
				onClick: onSave,
				className: "mt-8 min-h-12 rounded-full bg-white px-7 text-sm font-bold text-black disabled:opacity-30",
				children: saving ? "Saving…" : editing ? "Save changes" : type === "child" ? "Create child profile" : "Add profile"
			}),
			error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-rose-300",
				children: error
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-xs text-white/35",
				children: "PINs are salted and hashed by this home. They are never stored in the browser or returned to this screen."
			})
		]
	});
}
function SettingsWorld({ onNavigate, initialGroup }) {
	const state = useExperienceStore();
	const profile = activeExperienceProfile(state);
	const patchProfile = state.patchProfile;
	const [open, setOpen] = (0, import_react.useState)(initialGroup || "library");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "mx-auto max-w-4xl px-5 pb-28 pt-10 md:px-10 lg:pb-20",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "space-y-3",
			children: [
				{
					id: "appearance",
					title: "For you",
					note: "Color, motion, density, and personal taste"
				},
				{
					id: "family",
					title: "Family",
					note: "People, privacy, children, and presence"
				},
				{
					id: "playback",
					title: "Playback & companion",
					note: "Language, subtitles, listening, and context"
				},
				{
					id: "books",
					title: "Books",
					note: "Reading appearance and library choices"
				},
				{
					id: "library",
					title: "Library & storage",
					note: "Requests, travel, and retention"
				},
				{
					id: "devices",
					title: "Sources & devices",
					note: "TorBox, private sources, screens, and installation"
				},
				{
					id: "help",
					title: "Help & about",
					note: "Health, recovery, updates, and feature status"
				},
				{
					id: "advanced",
					title: "Quietly getting better",
					note: "See which private capabilities are ready, validating, or unavailable"
				}
			].map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "overflow-hidden rounded-[1.55rem] bg-white/[.035]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					"aria-expanded": open === group.id,
					onClick: () => setOpen(open === group.id ? "" : group.id),
					className: "flex min-h-24 w-full items-center justify-between gap-5 px-6 text-left",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
						className: "font-display text-2xl tracking-[-.045em]",
						children: group.title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", {
						className: "mt-1 block text-white/42",
						children: group.note
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "grid size-10 place-items-center rounded-full bg-white/7 text-xl",
						children: open === group.id ? "−" : "+"
					})]
				}), open === group.id && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "border-t border-white/7 px-6 py-6",
					children: [
						group.id === "appearance" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppearanceSettings, {
							profile,
							patchProfile,
							onTaste: () => onNavigate("taste")
						}),
						group.id === "family" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionRows, { rows: [[
							"Manage everyone in this home",
							"Profiles, PINs, boundaries, and bedtime",
							() => onNavigate("family")
						], [
							"Who is watching",
							"A quick presence control for tonight",
							() => onNavigate("family")
						]] }),
						group.id === "playback" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlaybackSettings, {
							profile,
							patchProfile,
							onCompanion: () => onNavigate("companion")
						}),
						group.id === "books" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionRows, { rows: [[
							"Reading world",
							"Open your shelf and continue reading",
							() => onNavigate("books")
						], [
							"Reading defaults",
							"Warm page · Medium type · Relaxed spacing",
							() => onNavigate("books")
						]] }),
						group.id === "library" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-6",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StorageSettings, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionRows, { rows: [[
								"Your Library",
								"Saved titles and kept local files",
								() => onNavigate("library")
							]] })]
						}),
						group.id === "devices" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HomeRegionSetting, {}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DebridSettings, {}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdvancedIndexerSettings, {}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionRows, { rows: [[
									"Manage devices",
									state.connectedDevices.length ? `${state.connectedDevices.length} connected` : "No connected devices reported",
									() => onNavigate("devices")
								], [
									"Configure media provider",
									"Validate or change TorBox",
									() => onNavigate("devices")
								]] })
							]
						}),
						group.id === "help" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HelpSettings, { onSetup: () => onNavigate("setup") }),
						group.id === "advanced" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdvancedView, { embedded: true })
					]
				})]
			}, group.id))
		})
	});
}
function HomeRegionSetting() {
	const [region, setRegion] = (0, import_react.useState)("US");
	const [status, setStatus] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		const controller = new AbortController();
		fetch("/api/settings", {
			cache: "no-store",
			signal: controller.signal
		}).then((response) => response.ok ? response.json() : null).then((result) => {
			if (result?.region && /^[A-Z]{2}$/.test(result.region)) setRegion(result.region);
		}).catch(() => void 0);
		return () => controller.abort();
	}, []);
	const save = (next) => {
		setRegion(next);
		setStatus("Saving…");
		fetch("/api/settings", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ region: next })
		}).then(async (response) => {
			if (!response.ok) throw new Error("The home region was not saved.");
			setStatus("Saved for this home.");
		}).catch((reason) => setStatus(reason instanceof Error ? reason.message : "The home region was not saved."));
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "block rounded-2xl bg-white/[.045] p-5 text-sm font-semibold",
		children: [
			"Streaming region",
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
				value: region,
				onChange: (event) => save(event.target.value),
				className: "mt-3 min-h-12 w-full rounded-xl bg-black/25 px-4 text-sm text-white",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "US",
						children: "United States"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "CA",
						children: "Canada"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "GB",
						children: "United Kingdom"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "AU",
						children: "Australia"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "DE",
						children: "Germany"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "FR",
						children: "France"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "mt-2 block text-xs font-normal text-white/42",
				children: ["Used only to show legitimate services available in this home. ", status]
			})
		]
	});
}
function DebridSettings() {
	const debrid = useExperienceStore((state) => state.debrid);
	const setDebridEnabled = useExperienceStore((state) => state.setDebridEnabled);
	const setDebridConnection = useExperienceStore((state) => state.setDebridConnection);
	const [changing, setChanging] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)("");
	const provider = "torbox";
	const [key, setKey] = (0, import_react.useState)("");
	const connected = isDebridConnected(debrid);
	const status = connected ? "Connected and available to this home" : debrid.enabled ? "Enabled, but a key still needs live validation" : "Off — Library uses verified public-domain and personal media only";
	const saveProvider = (enabled, nextKey = "") => {
		if (changing) return;
		setChanging(true);
		setError("");
		fetch("/api/settings", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				debridEnabled: enabled,
				debridProvider: provider,
				...nextKey ? { debridKey: nextKey } : {}
			})
		}).then(async (response) => {
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Provider could not be changed.");
			setDebridConnection({
				enabled: result.debridEnabled === true,
				provider: result.debridProvider || provider,
				status: result.debridStatus || (enabled ? "failed" : "disabled")
			});
			if (enabled) setKey("");
			if (!enabled) setDebridEnabled(false);
		}).catch((reason) => {
			setError(reason instanceof Error ? reason.message : "This home could not change its provider right now.");
		}).finally(() => setChanging(false));
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl bg-white/[.045] p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
				title: "TorBox",
				note: changing ? "Checking this home…" : status,
				active: debrid.enabled && debrid.provider === provider,
				onChange: () => {
					if (debrid.enabled && debrid.provider === provider) {
						saveProvider(false);
						return;
					}
					if (!key.trim()) {
						setError("Paste a TorBox key first.");
						return;
					}
					saveProvider(true, key.trim());
				}
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 grid gap-3 sm:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl bg-black/20 px-4 py-3 text-xs text-white/45",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
						className: "block text-sm text-white/75",
						children: "TorBox"
					}), "Certified for this ReelOS release"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "text-xs text-white/45",
					children: [
						"API key",
						" ",
						connected && debrid.provider === provider ? "(connected)" : "",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "password",
							value: key,
							onChange: (event) => setKey(event.target.value),
							placeholder: "Paste a new key to connect or change it",
							autoComplete: "off",
							className: "mt-2 min-h-12 w-full rounded-xl bg-black/25 px-4 text-sm text-white placeholder:text-white/25"
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: !key.trim() || changing,
				onClick: () => saveProvider(true, key.trim()),
				className: "mt-4 min-h-12 rounded-full bg-white px-5 text-sm font-bold text-black disabled:opacity-35",
				children: changing ? "Validating…" : connected && debrid.provider === provider ? "Change key" : "Connect TorBox"
			}),
			error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-rose-300",
				children: error
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-sm leading-6 text-white/45",
				children: "Turning this off removes provider-only titles and pending requests from the active Library. Personal files, public-domain media, taste, history, and progress stay yours."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-xs leading-5 text-white/32",
				children: "Other providers are not available in this release. They will appear here only after their playback and privacy checks pass."
			})
		]
	});
}
function AdvancedIndexerSettings() {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [presets, setPresets] = (0, import_react.useState)([]);
	const [publicCatalogs, setPublicCatalogs] = (0, import_react.useState)([]);
	const [enabled, setEnabled] = (0, import_react.useState)([]);
	const [status, setStatus] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		if (!open || presets.length) return;
		fetch("/api/settings", { cache: "no-store" }).then((response) => response.json()).then((result) => {
			setPresets(result.availableIndexerPresets || []);
			setEnabled(result.enabledIndexerIds || []);
			setPublicCatalogs(result.publicCatalogs || []);
		}).catch(() => setStatus("This home could not load source-search settings."));
	}, [open, presets.length]);
	const save = () => {
		setStatus("Saving…");
		fetch("/api/settings", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ enabledIndexerIds: enabled })
		}).then(async (response) => {
			if (!response.ok) throw new Error("Source choices were not saved.");
			setStatus(enabled.length ? `${enabled.length} enabled for this home.` : "No optional source connections enabled.");
		}).catch((reason) => setStatus(reason instanceof Error ? reason.message : "Source choices were not saved."));
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl bg-white/[.03] p-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: () => setOpen((value) => !value),
			className: "flex min-h-12 w-full items-center justify-between text-left",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
				className: "block text-sm",
				children: "Public catalogs & owner source connections"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", {
				className: "mt-1 block text-white/42",
				children: "Public collections are ready. Owner connections are optional."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-xl text-white/50",
				children: open ? "−" : "+"
			})]
		}), open && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 border-t border-white/7 pt-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm font-semibold text-white/80",
					children: "Always available"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 grid gap-2 sm:grid-cols-2",
					children: publicCatalogs.map((catalog) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-h-14 rounded-xl bg-black/20 px-4 py-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
								className: "text-sm",
								children: catalog.name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-emerald-300",
								children: "Connected"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", {
							className: "mt-1 block text-white/35",
							children: [
								catalog.media.join(" + "),
								" ·",
								" ",
								catalog.access.replaceAll("-", " ")
							]
						})]
					}, catalog.id))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 text-xs leading-5 text-white/38",
					children: "Catalog results carry their source and rights record. ReelOS only offers direct playback when the item itself supplies usable media and clear open-rights evidence."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-6 text-sm font-semibold text-white/80",
					children: "Owner connections"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm leading-6 text-white/45",
					children: "Connections appear here only when this appliance owner supplies a private preset file. They are separate from the public catalogs above and are never enabled silently."
				}),
				presets.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 rounded-xl bg-black/20 p-4 text-sm leading-6 text-white/55",
					children: "No owner presets are installed. Public catalogs, your media provider, and your personal library continue to work normally."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4 grid gap-2 sm:grid-cols-2",
					children: presets.map((preset) => {
						const active = enabled.includes(preset.id);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setEnabled((items) => active ? items.filter((id) => id !== preset.id) : [...items, preset.id]),
							className: `min-h-14 rounded-xl px-4 text-left ${active ? "bg-white text-black" : "bg-black/20 text-white"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
								className: "text-sm",
								children: preset.name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", {
								className: `ml-2 ${active ? "text-black/55" : "text-white/35"}`,
								children: preset.role === "both" ? "movies + TV" : preset.role
							})]
						}, preset.id);
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: save,
					disabled: presets.length === 0,
					className: "mt-4 min-h-12 rounded-full bg-white px-6 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-35",
					children: "Save owner connections"
				}),
				status && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-xs text-white/45",
					children: status
				})
			]
		})]
	});
}
function AppearanceSettings({ profile, patchProfile, onTaste }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-7",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-white/45",
				children: "A color you’ll want to come home to."
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex flex-wrap gap-3",
				children: [[
					"#2563eb",
					"#e11d48",
					"#f97316",
					"#eab308",
					"#22c55e",
					"#06b6d4",
					"#a855f7",
					"#ec4899"
				].map((color) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => patchProfile(profile.id, { color }),
					"aria-label": `Use ${color}`,
					className: `size-12 rounded-full ${profile.color === color ? "ring-4 ring-white/35" : ""}`,
					style: { backgroundColor: color }
				}, color)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "grid size-12 cursor-pointer place-items-center rounded-full border border-dashed border-white/24",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "color",
						value: profile.color,
						onChange: (event) => patchProfile(profile.id, { color: event.target.value }),
						className: "sr-only"
					})]
				})]
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChoiceSetting, {
				label: "Motion",
				value: profile.motion,
				options: [
					"still",
					"subtle",
					"expressive"
				],
				onChange: (motion) => patchProfile(profile.id, { motion })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChoiceSetting, {
				label: "Browsing density",
				value: profile.density,
				options: ["comfortable", "compact"],
				onChange: (density) => patchProfile(profile.id, { density })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
				title: "Living color",
				note: "Let your favorite color breathe behind every screen.",
				active: profile.atmosphere !== false,
				onChange: () => patchProfile(profile.id, { atmosphere: profile.atmosphere === false })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
				title: "Translucent surfaces",
				note: "Let artwork and living color travel through menus and sheets.",
				active: profile.transparency !== false,
				onChange: () => patchProfile(profile.id, { transparency: profile.transparency === false })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				onClick: onTaste,
				className: "flex min-h-16 w-full items-center justify-between rounded-2xl bg-white/7 px-5 text-left",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
					className: "block",
					children: "Tune your taste"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", {
					className: "mt-1 block text-white/43",
					children: "Return to the endless bubble field."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4" })]
			})
		]
	});
}
function PlaybackSettings({ profile, patchProfile, onCompanion }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChoiceSetting, {
				label: "Audio preference",
				value: profile.audioPreference,
				options: [
					"original",
					"dub",
					"sub"
				],
				onChange: (audioPreference) => patchProfile(profile.id, { audioPreference })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChoiceSetting, {
				label: "Subtitle language",
				value: profile.subtitleLanguage,
				options: [
					"Off",
					"English",
					"Spanish"
				],
				onChange: (subtitleLanguage) => patchProfile(profile.id, { subtitleLanguage })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				onClick: onCompanion,
				className: "flex min-h-16 w-full items-center justify-between rounded-2xl bg-white/7 px-5 text-left",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
					className: "block",
					children: "Companion screen"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", {
					className: "mt-1 block text-white/43",
					children: "Remote, cast, story, music, and context."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CapabilityStatusRows, { rows: [
				["Story so far", "Needs a verified scene timeline"],
				["Soundtrack moments", "Needs timestamped music metadata"],
				["Film-scholar commentary", "Needs verified local story evidence"],
				["Character relationships", "Needs verified context for this exact edition"]
			] })
		]
	});
}
function CapabilityStatusRows({ rows }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "overflow-hidden rounded-2xl bg-white/[.025]",
		children: rows.map(([title, note], index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `flex min-h-16 items-center justify-between gap-5 px-5 ${index ? "border-t border-white/7" : ""}`,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
				className: "block text-sm font-medium",
				children: title
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", {
				className: "mt-1 block text-white/38",
				children: note
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "shrink-0 rounded-full bg-white/[.06] px-3 py-1 text-[11px] text-white/42",
				children: "Not connected"
			})]
		}, title))
	});
}
function ChoiceSetting({ label, value, options, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-white/46",
		children: label
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mt-3 flex flex-wrap gap-2",
		children: options.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			onClick: () => onChange(option),
			className: `min-h-11 rounded-full px-4 text-sm capitalize ${value === option ? "bg-white text-black" : "bg-white/7 text-white/58"}`,
			children: option
		}, option))
	})] });
}
function ActionRows({ rows }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "space-y-2",
		children: rows.map(([title, note, action]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			onClick: action,
			className: "flex min-h-16 w-full items-center justify-between rounded-2xl bg-white/[.045] px-5 text-left",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
				className: "block",
				children: title
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", {
				className: "mt-1 block text-white/42",
				children: note
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4 text-white/35" })]
		}, title))
	});
}
function HelpSettings({ onSetup }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl bg-white/[.045] p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "Feature status" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-sm leading-6 text-white/48",
					children: "ReelOS reports a feature as working only after this home confirms its service is available. Advanced settings separates active, checking, paused, blocked, and later-release abilities."
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl bg-white/[.045] p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "ReelOS 2.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-white/42",
					children: "Automatic engine protections stay on and out of everyday controls."
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				onClick: onSetup,
				className: "flex min-h-16 w-full items-center justify-between rounded-2xl bg-white/[.045] px-5 text-left",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
					className: "block",
					children: "Review first-time setup"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", {
					className: "mt-1 block text-white/42",
					children: "Identity, taste, home connection, media provider, and screens."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4 text-white/35" })]
			})
		]
	});
}
function DevicesWorld({ onNavigate }) {
	const devices = useExperienceStore((state) => state.connectedDevices);
	const setDebridConnection = useExperienceStore((state) => state.setDebridConnection);
	const [flow, setFlow] = (0, import_react.useState)(null);
	const provider = "torbox";
	const [key, setKey] = (0, import_react.useState)("");
	const [step, setStep] = (0, import_react.useState)(0);
	const [connecting, setConnecting] = (0, import_react.useState)(false);
	const [connectionError, setConnectionError] = (0, import_react.useState)("");
	const labels = {
		provider: "Media provider",
		phone: "Phone or tablet",
		tv: "TV",
		usb: "USB installer"
	};
	const continueFlow = async () => {
		if (flow !== "provider") {
			setStep(1);
			return;
		}
		setConnecting(true);
		setConnectionError("");
		try {
			const response = await fetch("/api/settings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					debridEnabled: true,
					debridProvider: provider,
					debridKey: key
				})
			});
			const result = await response.json();
			if (!response.ok || result.debridStatus !== "connected") throw new Error(result.error || "The provider did not accept that key.");
			setDebridConnection({
				enabled: true,
				provider,
				status: "connected"
			});
			setStep(2);
			setKey("");
		} catch (reason) {
			setConnectionError(reason instanceof Error ? reason.message : "The provider could not be reached.");
		} finally {
			setConnecting(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto max-w-5xl px-5 pb-28 pt-10 md:px-10 lg:pb-20",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				onClick: () => onNavigate("settings"),
				className: "inline-flex min-h-12 items-center gap-2 text-sm text-white/55",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-4" }), "Settings"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-6 font-display text-[clamp(3.3rem,7vw,6.4rem)] font-semibold leading-none tracking-[-.075em]",
				children: "Every screen, one home."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-5 max-w-xl leading-7 text-white/52",
				children: "Add a device without repeating who you are. Connection steps stay specific to the thing you chose."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-12",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-white/42",
					children: "Connected here"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4 grid gap-3 sm:grid-cols-2",
					children: devices.map((device) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex min-h-20 items-center gap-4 rounded-2xl bg-white/[.04] px-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "grid size-10 place-items-center rounded-full bg-white/8",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MonitorUp, { className: "size-4" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
							className: "block",
							children: device
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", {
							className: "mt-1 block text-white/42",
							children: "Preview-only device profile"
						})] })]
					}, device))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-12 grid gap-3 sm:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeviceCard, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, {}),
						title: "Media provider",
						note: "Connect the certified TorBox source path.",
						onClick: () => {
							setFlow("provider");
							setStep(0);
						}
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeviceCard, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, {}),
						title: "Phone or tablet",
						note: "Pair locally or from anywhere.",
						onClick: () => {
							setFlow("phone");
							setStep(0);
						}
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeviceCard, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tv, {}),
						title: "TV",
						note: "Install, pair, and choose its name.",
						onClick: () => {
							setFlow("tv");
							setStep(0);
						}
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeviceCard, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, {}),
						title: "USB installer",
						note: "Choose a target before any erase step.",
						onClick: () => {
							setFlow("usb");
							setStep(0);
						}
					})
				]
			}),
			flow && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 grid place-items-end bg-black/70 p-3 md:place-items-center",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					role: "dialog",
					"aria-modal": "true",
					"aria-label": `${labels[flow]} setup`,
					className: "w-full max-w-xl rounded-[1.8rem] border border-white/12 bg-[#15151a] p-6 shadow-2xl md:p-8",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs text-white/40",
								children: [
									labels[flow],
									" · ",
									step + 1,
									" of 3"
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "mt-2 font-display text-3xl tracking-[-.055em]",
								children: step === 0 ? flow === "provider" ? "Connect your provider." : `Add ${labels[flow].toLowerCase()}.` : step === 1 ? flow === "usb" ? "Choose the target." : "Ready to hand off." : "Connected."
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setFlow(null),
								className: "grid size-11 place-items-center rounded-full bg-white/7",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
							})]
						}),
						step === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-7",
							children: [flow === "provider" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "rounded-xl bg-white/7 px-4 py-4 text-sm text-white/60",
									children: "TorBox · certified for this release"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "mt-4 block text-sm text-white/50",
									children: "TorBox key"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "password",
									value: key,
									onChange: (event) => setKey(event.target.value),
									placeholder: "Paste the key here",
									className: "mt-2 min-h-14 w-full rounded-xl bg-white/7 px-4 outline-none"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-3 text-xs leading-5 text-white/38",
									children: "Your home validates this directly with the provider and stores it in its protected local state. It is never returned to this screen."
								}),
								connectionError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-3 text-sm text-rose-300",
									children: connectionError
								})
							] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "leading-7 text-white/55",
								children: flow === "phone" ? "The live flow will show a QR code for local Wi-Fi or the home’s private remote address." : flow === "tv" ? "The live flow will offer the TV app and pair the screen to this home." : "The live flow will list removable drives by name and size before asking for an erase confirmation."
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								disabled: flow === "provider" && !key.trim() || connecting,
								onClick: () => void continueFlow(),
								className: "mt-7 min-h-12 rounded-full bg-white px-6 text-sm font-bold text-black disabled:opacity-30",
								children: connecting ? "Validating…" : flow === "provider" ? "Validate and connect" : "Continue"
							})]
						}),
						step === 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-7",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-2xl bg-white/[.045] p-5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: flow === "usb" ? "No removable target selected" : "Live connection required" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-sm leading-6 text-white/45",
									children: "This review build shows the full decision path without claiming an install, connection, or credential check happened."
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setFlow(null),
								className: "mt-7 min-h-12 rounded-full border border-white/15 px-6 text-sm",
								children: "Close"
							})]
						}),
						step === 2 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-7",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "grid size-14 place-items-center rounded-full bg-[#58d5bc] text-[#071411]",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-5 leading-7 text-white/55",
									children: "TorBox validated this home's key. Provider-backed actions can now use the connected source policy."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setFlow(null),
									className: "mt-7 min-h-12 rounded-full border border-white/15 px-6 text-sm",
									children: "Done"
								})
							]
						})
					]
				})
			})
		]
	});
}
function DeviceCard({ icon, title, note, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		onClick,
		className: "flex min-h-32 items-center gap-5 rounded-[1.5rem] bg-white/[.035] p-5 text-left",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "grid size-12 shrink-0 place-items-center rounded-full bg-white/7 [&>svg]:size-5",
			children: icon
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
			className: "block text-lg",
			children: title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", {
			className: "mt-2 block leading-5 text-white/44",
			children: note
		})] })]
	});
}
function AmbianceWorld({ onNavigate }) {
	const [mode, setMode] = (0, import_react.useState)("art");
	const [sound, setSound] = (0, import_react.useState)(true);
	const [timer, setTimer] = (0, import_react.useState)("30 min");
	const [calibrating, setCalibrating] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "min-h-[calc(100dvh-76px)] pb-28 lg:pb-12",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "relative min-h-[520px] overflow-hidden",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: mode === "art" ? TITLE_BY_EXPERIENCE_ID["in-the-mood-for-love"]?.backdrop : mode === "fire" ? TITLE_BY_EXPERIENCE_ID["holdovers"]?.backdrop : TITLE_BY_EXPERIENCE_ID["my-neighbor-totoro"]?.backdrop,
						alt: "",
						className: "absolute inset-0 size-full object-cover opacity-48"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute inset-0 bg-[linear-gradient(0deg,#080809,transparent_70%),linear-gradient(90deg,#080809aa,transparent)]" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "relative mx-auto flex min-h-[520px] max-w-[1400px] items-end px-5 pb-12 md:px-10",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => onNavigate("settings"),
							className: "inline-flex min-h-12 items-center gap-2 text-sm text-white/60",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-4" }), "Settings"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "mt-5 font-display text-[clamp(3.5rem,8vw,7rem)] font-semibold leading-none tracking-[-.075em]",
							children: "Let the home exhale."
						})] })
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto max-w-[1400px] px-5 md:px-10",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-3 md:grid-cols-3",
					children: [
						[
							"art",
							"Artwork",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SunMedium, {})
						],
						[
							"fire",
							"Firelight",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flame, {})
						],
						[
							"photos",
							"Private photos",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SunMedium, {})
						]
					].map(([id, label, icon]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => setMode(id),
						className: `flex min-h-20 items-center gap-4 rounded-2xl px-5 text-left ${mode === id ? "bg-white text-black" : "bg-white/[.045]"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "[&>svg]:size-5",
							children: icon
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: label })]
					}, id))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-8 grid gap-3 md:grid-cols-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
							title: "Ambient sound",
							note: "Fire, rain, or quiet depending on the chosen scene.",
							active: sound,
							onChange: () => setSound(!sound)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex min-h-24 items-center justify-between gap-5 rounded-2xl bg-white/[.035] p-5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
								className: "block",
								children: "Supported home lights"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", {
								className: "mt-2 block leading-5 text-white/43",
								children: "A Hue, Nanoleaf, or Matter bridge and real frame telemetry are required."
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "shrink-0 rounded-full bg-white/[.06] px-3 py-1 text-[11px] text-white/42",
								children: "Not connected"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex min-h-24 items-center justify-between gap-5 rounded-2xl bg-white/[.035] p-5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
								className: "block",
								children: "Living posters"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", {
								className: "mt-2 block leading-5 text-white/43",
								children: "Verified title loops appear automatically; still artwork remains the fallback."
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "shrink-0 rounded-full bg-white/[.06] px-3 py-1 text-[11px] text-white/42",
								children: "Assets required"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-2xl bg-white/[.035] p-5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-white/45",
								children: "Sleep after"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-3 flex flex-wrap gap-2",
								children: [
									"15 min",
									"30 min",
									"1 hour",
									"Never"
								].map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setTimer(item),
									className: `min-h-11 rounded-full px-4 text-sm ${timer === item ? "bg-white text-black" : "bg-white/7"}`,
									children: item
								}, item))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setCalibrating(true),
							className: "flex min-h-28 items-center justify-between rounded-2xl bg-white/[.035] p-5 text-left",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
								className: "block",
								children: "Tune sound for this space"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", {
								className: "mt-2 block max-w-sm leading-5 text-white/43",
								children: "Preview the guided phone measurement. Applying its EQ still needs a supported audio output."
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Speaker, { className: "size-5" })]
						})
					]
				})]
			}),
			calibrating && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SimpleDialog, {
				title: "Acoustic space tuning",
				onClose: () => setCalibrating(false),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "leading-7 text-white/55",
					children: "Place your phone where you usually sit. A finished adapter will request microphone permission, play a short TV sweep, measure the response, and confirm that the named screen actually applied it."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-6 rounded-2xl bg-white/[.045] p-5 text-sm text-white/45",
					children: "No tone plays in this interface preview."
				})]
			})
		]
	});
}
function ToggleRow({ title, note, active, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		onClick: onChange,
		className: "flex min-h-24 items-center justify-between gap-5 rounded-2xl bg-white/[.035] p-5 text-left",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
			className: "block",
			children: title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", {
			className: "mt-2 block leading-5 text-white/43",
			children: note
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: `flex h-7 w-12 shrink-0 items-center rounded-full p-1 ${active ? "justify-end bg-white text-black" : "justify-start bg-white/12 text-white/35"}`,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-5 rounded-full bg-current" })
		})]
	});
}
function CompanionWorld({ onNavigate, seed }) {
	const profile = activeExperienceProfile(useExperienceStore());
	const profiles = useExperienceStore((state) => state.profiles);
	const childProfiles = (0, import_react.useMemo)(() => profiles.filter((item) => item.isChild), [profiles]);
	const kidsPresentIds = useExperienceStore((state) => state.kidsPresentIds);
	const toggleKidPresent = useExperienceStore((state) => state.toggleKidPresent);
	const [section, setSection] = (0, import_react.useState)("remote");
	const [companion, setCompanion] = (0, import_react.useState)({
		active: false,
		session: null,
		dossier: null
	});
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [syncError, setSyncError] = (0, import_react.useState)(null);
	const [commandState, setCommandState] = (0, import_react.useState)(null);
	const session = companion.session;
	const sessionCatalogTitle = session?.titleId ? TITLE_BY_EXPERIENCE_ID[session.titleId] : void 0;
	const seedMatchesSession = Boolean(seed?.title && session && (seed.title.id === session.titleId || seed.title.playbackId === session.titleId));
	const companionTitle = companion.active ? sessionCatalogTitle || (seedMatchesSession ? seed?.title : void 0) : seed?.title;
	const dossier = companion.dossier;
	const progress = companionProgress(session);
	const syncCompanion = async (signal) => {
		try {
			const active = await loadActiveCompanionState(signal);
			if (!active.active && seed?.title) active.dossier = await loadCompanionDossier(seed.title.playbackId || seed.title.id, seed.season, seed.episode, signal);
			setCompanion(active);
			setSyncError(null);
		} catch (error) {
			if (signal?.aborted) return;
			setSyncError(error instanceof Error ? error.message : "Companion could not reach the player.");
		} finally {
			if (!signal?.aborted) setLoading(false);
		}
	};
	(0, import_react.useEffect)(() => {
		const controller = new AbortController();
		syncCompanion(controller.signal);
		const interval = window.setInterval(() => void syncCompanion(), 5e3);
		return () => {
			controller.abort();
			window.clearInterval(interval);
		};
	}, [
		seed?.title.id,
		seed?.season,
		seed?.episode
	]);
	const sendRemote = async (action, payload = {}) => {
		if (!session?.sessionId) return;
		setCommandState("Sending…");
		try {
			await queueCompanionCommand(session.sessionId, action, payload);
			setCommandState("Sent to the TV");
			window.setTimeout(() => setCommandState(null), 2500);
			window.setTimeout(() => void syncCompanion(), 500);
		} catch (error) {
			setCommandState(error instanceof Error ? error.message : "The TV did not accept that command.");
		}
	};
	const nowPlayingTitle = session?.seriesName || session?.titleName || dossier?.title || companionTitle?.title;
	const playbackDetail = companion.active ? progress.remainingMinutes !== null ? `${progress.remainingMinutes} minutes remaining` : progress.positionSeconds > 0 ? `${Math.floor(progress.positionSeconds / 60)} minutes in` : "Playback position is syncing" : seed ? "No active TV playback" : "Nothing is playing right now";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto max-w-5xl px-5 pb-28 pt-10 md:px-10 lg:pb-16",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				onClick: () => onNavigate("home"),
				className: "inline-flex min-h-12 items-center gap-2 text-sm text-white/55",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-4" }), "Home"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6 rounded-[2rem] bg-[linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.02))] p-7 md:p-9",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs uppercase tracking-[.18em] text-white/38",
						children: companion.active ? `Playing on ${session?.device || "Home TV"}` : loading ? "Finding your player" : "Companion"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex items-center gap-5",
						children: [companionTitle?.poster ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: companionTitle.poster,
							alt: "",
							className: "h-24 w-16 rounded-lg object-cover"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid h-24 w-16 shrink-0 place-items-center rounded-lg bg-white/7 text-white/30",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tv, { className: "size-5" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "font-display text-4xl tracking-[-.055em]",
								children: nowPlayingTitle || "Your TV is quiet"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-2 text-sm text-white/46",
								children: [
									(session?.seasonNumber || seed?.season) && (session?.episodeNumber || seed?.episode) ? `Season ${session?.seasonNumber || seed?.season} · Episode ${session?.episodeNumber || seed?.episode} · ` : session?.seasonNumber || seed?.season ? `Season ${session?.seasonNumber || seed?.season} · ` : "",
									playbackDetail,
									" · ",
									profile.name
								]
							}),
							syncError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm text-rose-200/70",
								children: syncError
							})
						] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-7 flex items-center justify-center gap-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => void sendRemote("seek", { deltaTicks: companionSeekTicks(-10) }),
								disabled: !companion.active || commandState === "Sending…",
								"aria-label": "Go back ten seconds",
								className: "grid size-12 place-items-center rounded-full bg-white/8 disabled:cursor-not-allowed disabled:opacity-30",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-4" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => void sendRemote(session?.isPaused ? "play" : "pause"),
								disabled: !companion.active || commandState === "Sending…",
								"aria-label": session?.isPaused ? "Play" : "Pause",
								className: "grid size-16 place-items-center rounded-full bg-white text-black disabled:cursor-not-allowed disabled:opacity-30",
								children: session?.isPaused ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-5 fill-current" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "size-5 fill-current" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => void sendRemote("seek", { deltaTicks: companionSeekTicks(10) }),
								disabled: !companion.active || commandState === "Sending…",
								"aria-label": "Go forward ten seconds",
								className: "grid size-12 place-items-center rounded-full bg-white/8 disabled:cursor-not-allowed disabled:opacity-30",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-5" })
							})
						]
					}),
					commandState && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 text-center text-xs text-white/42",
						role: "status",
						children: commandState
					})
				]
			}),
			childProfiles.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-6 rounded-[1.5rem] bg-white/[.035] p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-white/42",
					children: "Who’s watching?"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4 flex flex-wrap gap-2",
					children: childProfiles.map((child) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => {
							const nextIds = kidsPresentIds.includes(child.id) ? kidsPresentIds.filter((id) => id !== child.id) : [...kidsPresentIds, child.id];
							toggleKidPresent(child.id);
							syncFamilyPresence(nextIds).catch(() => void 0);
						},
						className: `min-h-11 rounded-full px-4 text-sm ${kidsPresentIds.includes(child.id) ? "bg-[#58d5bc] text-[#071411]" : "bg-white/7"}`,
						children: kidsPresentIds.includes(child.id) ? `${child.name} here` : `${child.name} in bed`
					}, child.id))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-6 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]",
				children: [
					["remote", "Remote"],
					["story", "Catch me up"],
					["people", "Who is that?"],
					["music", "What’s playing?"],
					["craft", "How they made it"]
				].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => setSection(id),
					className: `min-h-11 shrink-0 rounded-full px-4 text-sm ${section === id ? "bg-white text-black" : "bg-white/7"}`,
					children: label
				}, id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompanionSection, {
				section,
				active: companion.active,
				dossier
			})
		]
	});
}
function CompanionSection({ section, active, dossier }) {
	const unavailable = dossier?.message || "Verified context is not available for this moment yet.";
	const content = section === "remote" ? {
		title: "A quiet remote",
		body: active ? "Commands are sent to the active player. The screen updates only when the player confirms its state." : "Start playing something on an authorized ReelOS screen to use the remote."
	} : section === "story" ? {
		title: "The story so far",
		body: dossier?.storySoFar.length ? dossier.storySoFar.join(" ") : unavailable
	} : section === "people" ? {
		title: "Who is that?",
		body: dossier?.whoIsWho.length ? dossier.whoIsWho.map((person) => `${person.name} — ${person.actor}. ${person.role}`).join(" ") : unavailable
	} : section === "music" ? {
		title: "What’s playing?",
		body: "No verified soundtrack cue is available for this playback position."
	} : {
		title: "How they made it",
		body: "No verified production context is available for this playback position."
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-6 min-h-64 rounded-[1.7rem] bg-white/[.035] p-7",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-3xl tracking-[-.055em]",
				children: content.title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 max-w-xl leading-7 text-white/48",
				children: content.body
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-8 text-xs text-white/30",
				children: dossier?.spoilerShield.active ? "Verified only through the current playback position." : "ReelOS will not imply spoiler protection without a verified timeline."
			})
		]
	});
}
function PartyWorld({ onNavigate, onOpen }) {
	const allProfiles = useExperienceStore((state) => state.profiles);
	const activeProfileId = useExperienceStore((state) => state.activeProfileId);
	const profiles = (0, import_react.useMemo)(() => allProfiles.filter((item) => !item.isGuest), [allProfiles]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WatchTogetherWorld, {
		profiles,
		activeProfileId,
		onBack: () => onNavigate("family"),
		onOpen
	});
}
function SetupWorld({ onNavigate, onComplete }) {
	const draft = useExperienceStore((state) => state.setupDraft);
	const initialProfile = activeExperienceProfile(useExperienceStore.getState());
	const [ownerId] = (0, import_react.useState)(() => draft.ownerId || initialProfile.id || createClientId("profile-"));
	const setSetupDraft = useExperienceStore((state) => state.setSetupDraft);
	const finishOnboarding = useExperienceStore((state) => state.finishOnboarding);
	const setDebridEnabled = useExperienceStore((state) => state.setDebridEnabled);
	const setDebridConnection = useExperienceStore((state) => state.setDebridConnection);
	const [step, setStep] = (0, import_react.useState)(Math.min(draft.step ?? 0, 7));
	const [name, setName] = (0, import_react.useState)(draft.name ?? initialProfile.name);
	const [color, setColor] = (0, import_react.useState)(draft.color ?? initialProfile.color);
	const [pinEnabled, setPinEnabled] = (0, import_react.useState)(draft.pinEnabled ?? initialProfile.pinEnabled ?? false);
	const [pin, setPin] = (0, import_react.useState)("");
	const [pinConfirm, setPinConfirm] = (0, import_react.useState)("");
	const [addHouseholdNow, setAddHouseholdNow] = (0, import_react.useState)(draft.addHouseholdNow ?? Boolean(draft.householdMembers?.length));
	const [memberName, setMemberName] = (0, import_react.useState)(draft.memberName ?? "");
	const [memberIsChild, setMemberIsChild] = (0, import_react.useState)(draft.memberIsChild ?? false);
	const [removingMember, setRemovingMember] = (0, import_react.useState)(false);
	const [householdError, setHouseholdError] = (0, import_react.useState)("");
	const [childExitPin, setChildExitPin] = (0, import_react.useState)("");
	const [childExitPinConfirm, setChildExitPinConfirm] = (0, import_react.useState)("");
	const [householdMembers, setHouseholdMembers] = (0, import_react.useState)(() => (draft.householdMembers ?? useExperienceStore.getState().profiles.filter((member) => member.id !== ownerId && !member.isGuest).map((member) => ({
		id: member.id,
		name: member.name,
		isChild: Boolean(member.isChild)
	}))).map((member) => ({
		...member,
		id: member.id || createClientId("profile-")
	})));
	const [guidance, setGuidance] = (0, import_react.useState)(draft.guidance ?? "balanced");
	const [reactions, setReactions] = (0, import_react.useState)(draft.reactions ?? {});
	const [dismissed, setDismissed] = (0, import_react.useState)(draft.dismissed ?? []);
	const [lessLike, setLessLike] = (0, import_react.useState)(draft.lessLike ?? []);
	const [path, setPath] = (0, import_react.useState)("new");
	const [providerKey, setProviderKey] = (0, import_react.useState)("");
	const [sourceChoice, setSourceChoice] = (0, import_react.useState)(draft.sourceChoice === "torbox" ? "torbox" : "public");
	const [sourceConnecting, setSourceConnecting] = (0, import_react.useState)(false);
	const [sourceError, setSourceError] = (0, import_react.useState)("");
	const [device, setDevice] = (0, import_react.useState)(draft.device ?? "phone");
	const [creating, setCreating] = (0, import_react.useState)(false);
	const [createError, setCreateError] = (0, import_react.useState)("");
	const savingHousehold = (0, import_react.useRef)(false);
	(0, import_react.useEffect)(() => {
		setSetupDraft({
			ownerId,
			step,
			name,
			color,
			pinEnabled,
			householdMembers,
			guidance,
			reactions,
			dismissed,
			lessLike,
			path,
			sourceChoice,
			device,
			addHouseholdNow,
			memberName,
			memberIsChild
		});
	}, [
		ownerId,
		step,
		name,
		color,
		pinEnabled,
		householdMembers,
		guidance,
		reactions,
		dismissed,
		lessLike,
		path,
		sourceChoice,
		device,
		addHouseholdNow,
		memberName,
		memberIsChild,
		setSetupDraft
	]);
	const removeHouseholdMember = async (id) => {
		if (removingMember) return;
		setRemovingMember(true);
		setHouseholdError("");
		try {
			if (useExperienceStore.getState().profiles.some((member) => member.id === id)) {
				const response = await fetch(`/api/profiles/${encodeURIComponent(id)}`, { method: "DELETE" });
				const result = await response.json();
				if (!response.ok || !result.ok) throw new Error(result.error || "This person could not be removed. Please retry.");
				useExperienceStore.setState((state) => ({ profiles: state.profiles.filter((member) => member.id !== id) }));
			}
			setHouseholdMembers((members) => members.filter((member) => member.id !== id));
		} catch (reason) {
			setHouseholdError(reason instanceof Error ? reason.message : "This person could not be removed.");
		} finally {
			setRemovingMember(false);
		}
	};
	(0, import_react.useEffect)(() => {
		window.scrollTo({
			top: 0,
			behavior: "auto"
		});
	}, [step]);
	const prepareHousehold = async () => {
		if (path === "existing") throw new Error("Connect to your existing home before creating profiles here.");
		if (savingHousehold.current) throw new Error("Your home is still saving. Please wait.");
		savingHousehold.current = true;
		try {
			const ids = await saveSetupHousehold({
				ownerId,
				name,
				color,
				pinEnabled,
				householdMembers,
				guidance,
				reactions,
				dismissed,
				lessLike
			}, {
				pin,
				childExitPin
			}, useExperienceStore.getState().profiles);
			const loaded = await loadExperienceProfiles();
			useExperienceStore.setState({
				profiles: loaded.profiles,
				activeProfileId: loaded.activeId || ""
			});
			return ids;
		} finally {
			savingHousehold.current = false;
		}
	};
	const create = async () => {
		if (creating) return;
		setCreating(true);
		setCreateError("");
		try {
			await completeExperienceSetup(await prepareHousehold());
			finishOnboarding();
			onComplete();
			onNavigate("devices");
		} catch (reason) {
			setCreateError(reason instanceof Error ? reason.message : "This home could not finish setup.");
		} finally {
			setCreating(false);
		}
	};
	const continueWithPublicSources = async () => {
		if (sourceConnecting) return;
		setSourceConnecting(true);
		setSourceError("");
		try {
			await prepareHousehold();
			await savePublicSourceChoice();
			setDebridEnabled(false);
			setStep(7);
		} catch (reason) {
			setSourceError(reason instanceof Error ? reason.message : "Your source choice could not be saved.");
		} finally {
			setSourceConnecting(false);
		}
	};
	const connectSetupProvider = async () => {
		if (sourceConnecting) return;
		setSourceConnecting(true);
		setSourceError("");
		try {
			await prepareHousehold();
			const response = await fetch("/api/settings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					debridEnabled: true,
					debridProvider: "torbox",
					debridKey: providerKey
				})
			});
			const result = await response.json();
			if (!response.ok || result.debridStatus !== "connected") throw new Error(result.error || "The provider did not accept that key.");
			setDebridConnection({
				enabled: true,
				provider: "torbox",
				status: "connected"
			});
			setProviderKey("");
			setStep(7);
		} catch (reason) {
			setSourceError(reason instanceof Error ? reason.message : "The provider could not be reached.");
		} finally {
			setSourceConnecting(false);
		}
	};
	const steps = [
		"You",
		"Color",
		"Household",
		"Guidance",
		"Taste",
		"Home",
		"Sources",
		"Screens"
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "reelos-setup relative flex min-h-dvh overflow-hidden px-5 py-8 md:px-10",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "reelos-setup-orb reelos-setup-orb-a",
				style: { backgroundColor: color }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "reelos-setup-orb reelos-setup-orb-b",
				style: { backgroundColor: color }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative mx-auto flex w-full max-w-6xl flex-col",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							"aria-label": "Previous setup step",
							disabled: step === 0 || sourceConnecting || creating,
							onClick: () => step > 0 ? setStep(step - 1) : onNavigate("home"),
							className: "grid size-12 place-items-center rounded-full border border-white/12",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-xs text-white/38",
							children: [
								steps[step],
								" · ",
								step + 1,
								" of ",
								steps.length
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-white/45",
							children: "You can close this and return later"
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-1 items-start justify-center py-10 md:py-14",
					children: [
						step === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SetupPanel, {
							title: "Hi, what should we call you?",
							note: "Your profile keeps its own taste, history, books, and appearance.",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									autoFocus: true,
									value: name,
									onChange: (event) => setName(event.target.value),
									placeholder: "Your name",
									className: "mt-9 w-full border-b border-white/24 bg-transparent py-4 text-2xl outline-none placeholder:text-white/23"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
									title: "Add a passcode",
									note: "Optional privacy for an adult profile.",
									active: pinEnabled,
									onChange: () => setPinEnabled(!pinEnabled)
								}),
								pinEnabled && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 grid gap-3 sm:grid-cols-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										value: pin,
										onChange: (event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4)),
										inputMode: "numeric",
										autoComplete: "new-password",
										"aria-label": "Create a 4-digit passcode",
										placeholder: "Create a 4-digit passcode",
										className: "min-h-14 rounded-xl bg-white/7 px-4 text-lg tracking-[.25em] outline-none placeholder:text-sm placeholder:tracking-normal"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										value: pinConfirm,
										onChange: (event) => setPinConfirm(event.target.value.replace(/\D/g, "").slice(0, 4)),
										inputMode: "numeric",
										autoComplete: "new-password",
										"aria-label": "Confirm passcode",
										placeholder: "Confirm passcode",
										className: "min-h-14 rounded-xl bg-white/7 px-4 text-lg tracking-[.25em] outline-none placeholder:text-sm placeholder:tracking-normal"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
									title: "Set up this household too",
									note: "Add adults and children before everyone shapes their own taste.",
									active: addHouseholdNow,
									onChange: () => setAddHouseholdNow(!addHouseholdNow)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SetupNext, {
									disabled: !name.trim() || pinEnabled && (pin.length !== 4 || pin !== pinConfirm),
									onClick: () => setStep(1)
								})
							]
						}),
						step === 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SetupPanel, {
							title: "And what is your favorite color?",
							note: "It will breathe through your profile without coloring every surface.",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-9 flex flex-wrap gap-4",
								children: [
									"#2563eb",
									"#e11d48",
									"#f97316",
									"#eab308",
									"#22c55e",
									"#06b6d4",
									"#a855f7",
									"#ec4899"
								].map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setColor(item),
									className: `size-16 rounded-full ${color === item ? "scale-110 ring-4 ring-white/30" : ""}`,
									style: {
										backgroundColor: item,
										boxShadow: `0 0 34px ${item}66`
									}
								}, item))
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SetupNext, { onClick: () => setStep(2) })]
						}),
						step === 2 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SetupPanel, {
							title: addHouseholdNow ? "Who else calls this home theirs?" : "Just you for now?",
							note: "Everyone gets a private taste, history, books, and color. Children also get boundaries and a required exit PIN.",
							children: [
								addHouseholdNow ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-8 space-y-2",
										children: householdMembers.map((member, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex min-h-14 items-center gap-3 rounded-2xl bg-white/[.055] px-4",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "grid size-9 place-items-center rounded-full bg-white/10 text-sm font-bold",
													children: member.name[0]?.toUpperCase()
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "min-w-0 flex-1",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
														className: "block truncate",
														children: member.name
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", {
														className: "text-white/42",
														children: member.isChild ? "Child · exit PIN required" : "Adult · optional private PIN later"
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													onClick: () => void removeHouseholdMember(member.id),
													disabled: removingMember,
													"aria-label": `Remove ${member.name}`,
													className: "grid size-12 place-items-center rounded-full hover:bg-white/8",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
												})
											]
										}, `${member.name}-${index}`))
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-5 rounded-[1.5rem] bg-white/[.045] p-4",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												value: memberName,
												onChange: (event) => setMemberName(event.target.value),
												placeholder: "Their name",
												className: "min-h-14 w-full rounded-xl bg-white/7 px-4 outline-none"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "mt-3 grid grid-cols-2 gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													onClick: () => setMemberIsChild(false),
													className: `min-h-12 rounded-xl text-sm ${!memberIsChild ? "bg-white text-black" : "bg-white/7"}`,
													children: "Adult"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													onClick: () => setMemberIsChild(true),
													className: `min-h-12 rounded-xl text-sm ${memberIsChild ? "bg-white text-black" : "bg-white/7"}`,
													children: "Child"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: () => {
													if (!memberName.trim()) return;
													setHouseholdMembers((current) => [...current, {
														id: createClientId("profile-"),
														name: memberName.trim(),
														isChild: memberIsChild
													}]);
													setMemberName("");
												},
												disabled: !memberName.trim(),
												className: "mt-3 min-h-12 w-full rounded-xl bg-white px-4 text-sm font-bold text-black disabled:opacity-35",
												children: "Add to this home"
											})
										]
									}),
									householdMembers.some((member) => member.isChild) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-5 rounded-[1.5rem] bg-white/[.045] p-4",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
												className: "block",
												children: "Child exit PIN"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "mt-1 text-sm leading-6 text-white/45",
												children: "Required to leave any child profile. It is stored securely by this home."
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												value: childExitPin,
												onChange: (event) => setChildExitPin(event.target.value.replace(/\D/g, "").slice(0, 4)),
												inputMode: "numeric",
												placeholder: "Create a 4-digit exit PIN",
												className: "mt-3 min-h-14 w-full rounded-xl bg-white/7 px-4 text-lg tracking-[.25em] outline-none placeholder:text-sm placeholder:tracking-normal"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												value: childExitPinConfirm,
												onChange: (event) => setChildExitPinConfirm(event.target.value.replace(/\D/g, "").slice(0, 4)),
												inputMode: "numeric",
												autoComplete: "new-password",
												"aria-label": "Confirm child exit PIN",
												placeholder: "Confirm child exit PIN",
												className: "mt-3 min-h-14 w-full rounded-xl bg-white/7 px-4 text-lg tracking-[.25em] outline-none placeholder:text-sm placeholder:tracking-normal"
											})
										]
									})
								] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => setAddHouseholdNow(true),
									className: "mt-9 min-h-16 rounded-2xl bg-white/[.055] px-6 text-left",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
										className: "block",
										children: "Add people now"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "mt-1 block text-sm text-white/45",
										children: "Adults and children can also be added from Family later."
									})]
								}),
								householdError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									role: "alert",
									className: "mt-3 text-sm text-rose-300",
									children: householdError
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SetupNext, {
									disabled: removingMember || addHouseholdNow && householdMembers.some((member) => member.isChild && !useExperienceStore.getState().profiles.some((saved) => saved.id === member.id && saved.pinEnabled)) && (childExitPin.length !== 4 || childExitPin !== childExitPinConfirm),
									label: "Continue",
									onClick: () => setStep(3)
								})
							]
						}),
						step === 3 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SetupPanel, {
							title: "How much help feels right?",
							note: "This changes guidance, never what you are allowed to do.",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-9 grid gap-3 md:grid-cols-2",
								children: [
									[
										"hand",
										"Hold my hand",
										"Gentle context and clear next steps."
									],
									[
										"balanced",
										"Balanced",
										"Quiet defaults with help close by."
									],
									[
										"free",
										"I’ll explore",
										"Fewer prompts and wider discovery."
									]
								].map(([id, label, note]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => setGuidance(id),
									className: `min-h-40 rounded-[1.5rem] p-5 text-left ${guidance === id ? "bg-white text-black" : "bg-white/[.045]"}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
										className: "text-lg",
										children: label
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: `mt-3 block text-sm leading-6 ${guidance === id ? "text-black/55" : "text-white/45"}`,
										children: note
									})]
								}, id))
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SetupNext, { onClick: () => setStep(4) })]
						}),
						step === 4 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SetupPanel, {
							title: "Show us what pulls you in.",
							note: "Tap to like, tap again to love. Make anything Cozy, dismiss what you do not know, and stay for as long as it is fun.",
							wide: true,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EndlessTasteField, {
								setup: true,
								color,
								reactions,
								dismissedIds: dismissed,
								lessLikeIds: lessLike,
								onReact: (itemId, reaction) => {
									setReactions((current) => {
										const next = { ...current };
										if (reaction) next[itemId] = reaction;
										else delete next[itemId];
										return next;
									});
									setDismissed((current) => current.filter((id) => id !== itemId));
									setLessLike((current) => current.filter((id) => id !== itemId));
								},
								onDismiss: (itemId) => {
									setReactions((current) => {
										const next = { ...current };
										delete next[itemId];
										return next;
									});
									setLessLike((current) => current.filter((id) => id !== itemId));
									setDismissed((current) => [.../* @__PURE__ */ new Set([...current, itemId])]);
								},
								onToggleLessLike: (itemId) => {
									setLessLike((current) => {
										const removing = current.includes(itemId);
										if (!removing) {
											setReactions((reactionsNow) => {
												const next = { ...reactionsNow };
												delete next[itemId];
												return next;
											});
											setDismissed((dismissedNow) => dismissedNow.filter((id) => id !== itemId));
										}
										return removing ? current.filter((id) => id !== itemId) : [...current, itemId];
									});
								}
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "pointer-events-auto flex flex-wrap justify-center gap-2 rounded-full border border-white/10 bg-black/72 p-2 shadow-2xl backdrop-blur-2xl [&>button]:mt-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SetupNext, {
										label: "That feels like me",
										onClick: () => setStep(5)
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => setStep(5),
										className: "min-h-12 rounded-full border border-white/14 px-6 text-sm",
										children: "Continue without choosing"
									})]
								})
							})]
						}),
						step === 5 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SetupPanel, {
							title: "Where does this home begin?",
							note: "Every installation is its own home unless you connect it to one you already trust.",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-9 grid gap-3 md:grid-cols-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => setPath("new"),
									className: `min-h-44 rounded-[1.5rem] p-6 text-left ${path === "new" ? "bg-white text-black" : "bg-white/[.045]"}`,
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(House, { className: "size-5" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
											className: "mt-8 block text-xl",
											children: "Start this home"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "mt-2 block text-sm opacity-55",
											children: "Create the first ReelOS home on this machine."
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									disabled: true,
									"aria-disabled": "true",
									className: "min-h-44 rounded-[1.5rem] bg-white/[.025] p-6 text-left text-white/38",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, { className: "size-5" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
											className: "mt-8 block text-xl",
											children: "Join an existing home"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "mt-2 block text-sm opacity-55",
											children: "Pair this device from Devices after the first home is ready."
										})
									]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SetupNext, { onClick: () => setStep(6) })]
						}),
						step === 6 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SetupPanel, {
							title: "What can this home play?",
							note: "Start with your own and verified public-domain media, or connect a debrid provider for the wider source pipeline. You can change this later.",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-9 grid gap-3 md:grid-cols-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: () => setSourceChoice("public"),
										className: `min-h-36 rounded-[1.5rem] p-5 text-left ${sourceChoice === "public" ? "bg-white text-black" : "bg-white/[.045]"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
											className: "text-lg",
											children: "Mine + public domain"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "mt-3 block text-sm opacity-55",
											children: "Clean, honest, and ready without a provider."
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: () => setSourceChoice("torbox"),
										className: `min-h-36 rounded-[1.5rem] p-5 text-left ${sourceChoice === "torbox" ? "bg-white text-black" : "bg-white/[.045]"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
											className: "text-lg",
											children: "Connect TorBox"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "mt-3 block text-sm opacity-55",
											children: "Validate a key before provider titles become available."
										})]
									})]
								}),
								sourceChoice !== "public" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "password",
										value: providerKey,
										onChange: (event) => setProviderKey(event.target.value),
										placeholder: "TorBox key",
										className: "min-h-14 w-full rounded-xl bg-white/7 px-4 outline-none"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-3 text-xs leading-5 text-white/36",
										children: "The key is validated directly and stored only in protected state on this home."
									})]
								}),
								sourceError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									role: "alert",
									className: "mt-3 text-sm text-rose-300",
									children: sourceError
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SetupNext, {
									disabled: sourceConnecting || sourceChoice !== "public" && !providerKey.trim(),
									label: sourceConnecting ? "Validating…" : sourceChoice !== "public" ? "Validate and continue" : "Use public and personal media",
									onClick: () => sourceChoice !== "public" ? void connectSetupProvider() : void continueWithPublicSources()
								})
							]
						}),
						step === 7 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SetupPanel, {
							title: "Where should ReelOS meet you?",
							note: "Install now or finish this profile and return to Devices later.",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-9 grid gap-3 md:grid-cols-3",
									children: [
										[
											"phone",
											"Phone or tablet",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, {})
										],
										[
											"tv",
											"TV",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tv, {})
										],
										[
											"usb",
											"USB installer",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, {})
										]
									].map(([id, label, icon]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										disabled: id === "usb",
										onClick: () => setDevice(id),
										className: `min-h-40 rounded-[1.5rem] p-5 text-left disabled:cursor-not-allowed disabled:opacity-35 ${device === id ? "bg-white text-black" : "bg-white/[.045]"}`,
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "[&>svg]:size-5",
												children: icon
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
												className: "mt-8 block text-lg",
												children: label
											}),
											id === "usb" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", {
												className: "mt-2 block",
												children: "Available when a supported target is detected."
											})
										]
									}, id))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => void create(),
									disabled: creating,
									className: "mt-8 min-h-12 rounded-full bg-white px-7 text-sm font-bold text-black disabled:opacity-40",
									children: creating ? "Saving this home…" : `Finish and open ${device === "tv" ? "TV setup" : "phone setup"}`
								}),
								createError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-3 text-sm text-rose-300",
									children: createError
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-3 text-xs text-white/34",
									children: "Deployment remains unconfirmed until the selected installer reports success."
								})
							]
						})
					]
				})]
			})
		]
	});
}
function SetupPanel({ title, note, children, wide = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: `w-full ${wide ? "max-w-6xl" : "max-w-4xl"}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-[clamp(3.2rem,7vw,6.5rem)] font-semibold leading-[.9] tracking-[-.075em]",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-5 max-w-xl text-lg leading-7 text-white/54",
				children: note
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: wide ? "max-w-none" : "max-w-3xl",
				children
			})
		]
	});
}
function SetupNext({ onClick, disabled, label = "Continue" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		disabled,
		onClick,
		className: "mt-8 min-h-12 rounded-full bg-white px-7 text-sm font-bold text-black disabled:opacity-30",
		children: label
	});
}
function PlayerWorld({ title, profile, onBack, onCompanion }) {
	const setProgress = useExperienceStore((state) => state.setProgress);
	const [playing, setPlaying] = (0, import_react.useState)(false);
	const [playbackError, setPlaybackError] = (0, import_react.useState)("");
	const videoRef = (0, import_react.useRef)(null);
	const resumeProgress = (0, import_react.useRef)(profile.progress[title.id] ?? 0);
	const resumeRestored = (0, import_react.useRef)(false);
	const lastProgressSave = (0, import_react.useRef)(0);
	const [position, setPosition] = (0, import_react.useState)(0);
	const [duration, setDuration] = (0, import_react.useState)(0);
	const savePosition = (video, force = false) => {
		setPosition(video.currentTime);
		if (!Number.isFinite(video.duration) || video.duration <= 0) return;
		if (!force && Date.now() - lastProgressSave.current < 5e3) return;
		lastProgressSave.current = Date.now();
		resumeProgress.current = Math.max(0, Math.min(1, video.currentTime / video.duration));
		setProgress(profile.id, title.id, resumeProgress.current);
	};
	const playbackUri = publicPlaybackPath(title.id);
	const [controls, setControls] = (0, import_react.useState)(true);
	const [audioPreset, setAudioPreset] = (0, import_react.useState)("off");
	const [audioError, setAudioError] = (0, import_react.useState)("");
	const [volume, setVolume] = (0, import_react.useState)(1);
	const audioController = (0, import_react.useRef)(null);
	const unsubscribeAudio = (0, import_react.useRef)(null);
	const audioRevision = (0, import_react.useRef)(0);
	const sleepController = (0, import_react.useRef)(null);
	const [timer, setTimer] = (0, import_react.useState)("Off");
	const [panel, setPanel] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		const sleep = createPlaybackSleepTimer({
			getVideo: () => videoRef.current,
			onExpire: () => setTimer("Off")
		});
		sleepController.current = sleep;
		const check = () => sleep.checkDeadline();
		document.addEventListener("visibilitychange", check);
		return () => {
			sleep.dispose();
			document.removeEventListener("visibilitychange", check);
			audioRevision.current += 1;
			unsubscribeAudio.current?.();
			unsubscribeAudio.current = null;
			audioController.current?.destroy();
			audioController.current = null;
		};
	}, []);
	const changeAudio = async (preset) => {
		const video = videoRef.current;
		if (!video) return;
		if (!audioController.current) {
			const controller = attachAudioBooster(video);
			audioController.current = controller;
			unsubscribeAudio.current = controller.subscribe((status) => {
				setAudioPreset(status.preset);
				setAudioError(status.error ?? "");
			});
		}
		const controller = audioController.current;
		const revision = ++audioRevision.current;
		const applied = await controller.setPreset(preset);
		if (revision !== audioRevision.current) return;
		setAudioPreset(controller.getPreset());
		if (applied) setAudioError("");
		else setAudioError("Audio processing could not be enabled. Try Original, or reopen the player.");
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		"data-player": "true",
		className: "relative min-h-dvh overflow-hidden bg-black",
		onClick: () => setControls(true),
		children: [
			playbackUri ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
				ref: videoRef,
				src: playbackUri,
				poster: title.backdrop,
				playsInline: true,
				preload: "metadata",
				onLoadedMetadata: (event) => {
					const video = event.currentTarget;
					if (!Number.isFinite(video.duration) || video.duration <= 0) return;
					setDuration(video.duration);
					if (!resumeRestored.current) {
						resumeRestored.current = true;
						const saved = resumeProgress.current;
						video.currentTime = saved > 0 && saved < .99 ? saved * video.duration : 0;
						setPosition(video.currentTime);
					}
				},
				onPlay: () => setPlaying(true),
				onPause: (event) => {
					setPlaying(false);
					savePosition(event.currentTarget, true);
				},
				onSeeked: (event) => savePosition(event.currentTarget, true),
				onEnded: () => {
					setPlaying(false);
					setProgress(profile.id, title.id, 1);
				},
				onTimeUpdate: (event) => savePosition(event.currentTarget),
				onError: () => setPlaybackError("This title could not be played with the current source or viewing permissions. Try again or return to its details."),
				className: "absolute inset-0 size-full object-contain"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: title.backdrop,
				alt: "",
				className: "absolute inset-0 size-full object-cover opacity-50"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute inset-0 bg-[radial-gradient(circle_at_60%_40%,transparent,#000_88%)]" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute left-5 top-5 z-10 rounded-full bg-black/55 px-3 py-1.5 text-[10px] text-white/54 backdrop-blur",
				children: playbackUri ? "Public-domain source" : "No playable source is connected"
			}),
			controls && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative flex min-h-dvh flex-col justify-between p-5 md:p-9",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							"aria-label": "Back to browsing",
							onClick: (event) => {
								event.stopPropagation();
								if (videoRef.current) savePosition(videoRef.current, true);
								onBack();
							},
							className: "grid size-12 place-items-center rounded-full bg-black/45 backdrop-blur",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-5" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: onCompanion,
							className: "min-h-12 rounded-full bg-black/45 px-5 text-sm backdrop-blur",
							children: "Open companion"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mx-auto grid size-20 place-items-center rounded-full bg-white text-black",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: (event) => {
								event.stopPropagation();
								const video = videoRef.current;
								if (!video) return;
								setPlaybackError("");
								if (video.paused) video.play().catch(() => setPlaybackError("Playback was blocked by this device. Tap play once more."));
								else video.pause();
							},
							disabled: !playbackUri,
							"aria-label": playing ? "Pause" : "Play",
							className: "grid size-20 place-items-center rounded-full focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-35",
							children: playing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "size-7 fill-current" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-7 fill-current" })
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-end justify-between gap-5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-white/45",
								children: title.kind === "series" ? "Season 1 · Episode 1" : `${title.year} · ${title.minutes} min`
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "mt-2 font-display text-[clamp(2.7rem,6vw,5.7rem)] font-semibold leading-none tracking-[-.065em]",
								children: title.title
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: (event) => {
									event.stopPropagation();
									setControls(false);
								},
								className: "hidden min-h-11 rounded-full px-4 text-sm text-white/45 md:block",
								children: "Hide controls"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "range",
							"aria-label": "Seek playback",
							"aria-valuetext": `${Math.floor(position)} of ${Math.floor(duration)} seconds`,
							min: 0,
							max: duration || 1,
							step: 1,
							value: position,
							disabled: !duration || !!playbackError,
							onChange: (event) => {
								const video = videoRef.current;
								if (!video) return;
								video.currentTime = Number(event.target.value);
								savePosition(video, true);
							},
							className: "mt-3 min-h-12 w-full cursor-pointer accent-white focus-visible:outline focus-visible:outline-2 disabled:opacity-35"
						}),
						playbackError && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							role: "alert",
							className: "mt-3 text-sm text-rose-300",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: playbackError }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "mt-2 min-h-12 rounded-full bg-white/10 px-5 text-white",
								onClick: () => {
									setPlaybackError("");
									resumeRestored.current = false;
									videoRef.current?.load();
								},
								children: "Retry playback"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]",
							children: [
								[
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, {}),
									"Sound & subtitles",
									() => setPanel("audio")
								],
								[
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, {}),
									audioPreset === "nightMode" ? "Night listening on" : "Night listening",
									() => void changeAudio(audioPreset === "nightMode" ? "off" : "nightMode")
								],
								[
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock3, {}),
									`Sleep · ${timer}`,
									() => {
										const minutes = timer === "Off" ? 30 : timer === "30 min" ? 60 : 0;
										sleepController.current?.setDelay(minutes * 6e4);
										setTimer(minutes === 30 ? "30 min" : minutes === 60 ? "1 hour" : "Off");
									}
								],
								[
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageCircle, {}),
									"Catch me up",
									() => setPanel("story")
								],
								[
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MonitorUp, {}),
									"Move playback",
									onCompanion
								]
							].map(([icon, label, action]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: (event) => {
									event.stopPropagation();
									action();
								},
								className: "flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-black/48 px-4 text-sm backdrop-blur",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "[&>svg]:size-4",
									children: icon
								}), String(label)]
							}, String(label)))
						})
					] })
				]
			}),
			panel === "audio" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SimpleDialog, {
				title: "Sound & subtitles",
				onClose: () => setPanel(null),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block text-sm text-white/70",
						children: ["Volume", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "range",
							"aria-label": "Volume",
							min: "0",
							max: "1",
							step: "0.05",
							value: volume,
							onChange: (event) => {
								const next = Number(event.target.value);
								setVolume(next);
								if (videoRef.current) videoRef.current.volume = next;
							},
							className: "min-h-12 w-full accent-white"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChoiceSetting, {
						label: "Sound",
						value: audioPreset === "off" ? "Original" : audioPreset === "nightMode" ? "Night listening" : "Dialogue focus",
						options: [
							"Original",
							"Dialogue focus",
							"Night listening"
						],
						onChange: (value) => void changeAudio(value === "Original" ? "off" : value === "Night listening" ? "nightMode" : "dialogueBoost")
					}),
					audioError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						role: "alert",
						className: "mt-4 text-sm text-rose-300",
						children: audioError
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-6 rounded-2xl bg-white/[.045] p-5 text-sm text-white/45",
						children: "This source has its original audio. No alternate language or subtitle tracks are connected to it yet."
					})
				]
			}),
			panel === "story" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleDialog, {
				title: "The story so far",
				onClose: () => setPanel(null),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "leading-7 text-white/54",
					children: "A production recap will use the verified playback position and reveal nothing beyond it. This preview has no scene timeline, so it will not invent a recap."
				})
			})
		]
	});
}
function ExitPinGate({ profile, onClose, onVerified }) {
	const [pin, setPin] = (0, import_react.useState)("");
	const [checking, setChecking] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)("");
	const verify = async () => {
		if (pin.length !== 4) return;
		setChecking(true);
		setError("");
		try {
			const response = await fetch(`/api/profiles/${encodeURIComponent(profile.id)}/verify-pin`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ pin })
			});
			if (!response.ok) throw new Error("That PIN did not match.");
			if (!(await response.json()).verified) throw new Error("That PIN did not match.");
			setPin("");
			onVerified();
		} catch (reason) {
			setPin("");
			setError(reason instanceof Error ? reason.message : "The PIN could not be checked.");
		} finally {
			setChecking(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-[70] grid place-items-center bg-black/80 px-5 backdrop-blur-xl",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			role: "dialog",
			"aria-modal": "true",
			"aria-labelledby": "exit-pin-title",
			className: "w-full max-w-md rounded-[1.8rem] border border-white/10 bg-[#151519] p-6 shadow-2xl",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: onClose,
					"aria-label": "Stay in child profile",
					className: "grid size-12 place-items-center rounded-full bg-white/7",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					id: "exit-pin-title",
					className: "mt-6 font-display text-4xl font-semibold tracking-[-.06em]",
					children: "A grown-up takes it from here."
				}),
				profile.pinEnabled ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-3 leading-7 text-white/48",
						children: [
							"Enter the family PIN to leave ",
							possessive(profile.name),
							" cinema."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						autoFocus: true,
						type: "password",
						inputMode: "numeric",
						value: pin,
						onChange: (event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4)),
						onKeyDown: (event) => {
							if (event.key === "Enter") verify();
						},
						placeholder: "4-digit PIN",
						className: "mt-6 min-h-16 w-full rounded-2xl bg-white/7 px-5 text-center text-2xl tracking-[.3em] outline-none placeholder:text-sm placeholder:tracking-normal"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => void verify(),
						disabled: checking || pin.length !== 4,
						className: "mt-3 min-h-14 w-full rounded-2xl bg-white text-sm font-bold text-black disabled:opacity-35",
						children: checking ? "Checking…" : "Continue"
					})
				] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 leading-7 text-white/48",
					children: "This child profile has no verified exit PIN yet. A parent must finish protection from Family on an authorized device."
				}),
				error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-sm text-rose-300",
					children: error
				})
			]
		})
	});
}
function SearchOverlay({ query, setQuery, onClose, onOpen, onPerson, onCollection, onBook, onSourceSetup, onConcierge, profile }) {
	const inputRef = (0, import_react.useRef)(null);
	const [result, setResult] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [searchError, setSearchError] = (0, import_react.useState)("");
	const intent = (0, import_react.useMemo)(() => parseSearchIntent(query), [query]);
	const sourceReview = (0, import_react.useMemo)(() => inspectSourceLink(query), [query]);
	const localResults = (0, import_react.useMemo)(() => rankLocalSearch(intent).filter((title) => !profile.isChild || title.family), [intent, profile.isChild]);
	const localPeople = (0, import_react.useMemo)(() => {
		if (!query.trim()) return [];
		const clues = intent.person ? [intent.person] : intent.terms.length ? intent.terms : [query.toLowerCase()];
		const searchableCatalog = profile.isChild ? EXPERIENCE_CATALOG.filter((title) => title.family) : EXPERIENCE_CATALOG;
		return [...new Set(searchableCatalog.flatMap((title) => title.people))].filter((person) => clues.some((clue) => person.toLowerCase().includes(clue))).slice(0, 6);
	}, [
		intent,
		profile.isChild,
		query
	]);
	(0, import_react.useEffect)(() => {
		if (!query.trim()) {
			setResult(null);
			setLoading(false);
			setSearchError("");
			return;
		}
		if (profile.isChild) {
			setResult(null);
			setLoading(false);
			setSearchError("");
			return;
		}
		const controller = new AbortController();
		setResult(null);
		const timer = window.setTimeout(() => {
			setLoading(true);
			setSearchError("");
			searchReelOS(query, { signal: controller.signal }).then(setResult).catch((error) => {
				if (error?.name !== "AbortError") setSearchError("The wider catalogs are quiet right now. Your personal catalog still works.");
			}).finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});
		}, 280);
		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	}, [profile.isChild, query]);
	(0, import_react.useEffect)(() => inputRef.current?.focus(), []);
	const results = result?.titles ?? localResults;
	const activeIntent = result?.intent ?? intent;
	const people = result?.people ?? [];
	const collections = result?.collections ?? [];
	const books = result?.books ?? [];
	const hasAny = results.length > 0 || people.length > 0 || collections.length > 0 || books.length > 0 || localPeople.length > 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 overflow-y-auto bg-[#080809]/96 backdrop-blur-2xl",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto max-w-[1400px] px-5 py-5 md:px-10",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-5 shrink-0 text-white/45" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						ref: inputRef,
						value: query,
						onChange: (event) => setQuery(event.target.value),
						placeholder: "A title, person, feeling, exclusion, or half-remembered scene",
						className: "min-h-16 flex-1 bg-transparent text-xl outline-none placeholder:text-white/28"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onClose,
						"aria-label": "Close search",
						className: "grid size-12 shrink-0 place-items-center rounded-full bg-white/7",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" })
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-t border-white/8 pt-8",
				children: [
					query.trim() && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-7 flex flex-wrap items-center gap-2",
						children: [
							activeIntent.kind && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "rounded-full bg-white/10 px-4 py-2 text-xs text-white/70",
								children: activeIntent.kind === "series" ? "Series" : activeIntent.kind === "book" ? "Books" : "Movies"
							}),
							activeIntent.maxMinutes && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "rounded-full bg-white/10 px-4 py-2 text-xs text-white/70",
								children: [
									"Under ",
									activeIntent.maxMinutes,
									" minutes"
								]
							}),
							activeIntent.moods.map((mood) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "rounded-full bg-white/10 px-4 py-2 text-xs capitalize text-white/70",
								children: mood
							}, mood)),
							activeIntent.excludedTerms.map((term) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "rounded-full bg-white/10 px-4 py-2 text-xs text-white/70",
								children: ["Without ", term]
							}, term)),
							loading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-1 text-xs text-white/35",
								children: "Looking a little farther…"
							})
						]
					}),
					profile.isChild && query.trim() && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-6 max-w-2xl text-sm leading-6 text-white/42",
						children: "Search stays inside titles already approved for this child profile. Wider catalogs remain behind the family PIN."
					}),
					!profile.isChild && sourceReview && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
						className: "mb-7 max-w-2xl rounded-[1.35rem] bg-white/[.055] p-5",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "mt-0.5 size-5 shrink-0 text-[var(--reelos-favorite)]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-semibold",
									children: "This looks like a source setup link."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-sm leading-6 text-white/48",
									children: sourceReview.message
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-xs text-white/32",
									children: sourceReview.display
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => onSourceSetup(sourceReview),
									disabled: !sourceReview.safeToReview,
									className: "mt-4 min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-35",
									children: "Set up a content source"
								})
							] })]
						})
					}),
					(people.length > 0 || localPeople.length > 0 || collections.length > 0) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "mb-10",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-white/42",
							children: "People and collections"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 flex flex-wrap gap-2",
							children: [
								people.map((person) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => onPerson(person.name, person.id),
									className: "min-h-12 rounded-full bg-white/7 px-5 text-sm",
									children: person.name
								}, `live-${person.id}`)),
								localPeople.filter((name) => !people.some((person) => person.name.toLowerCase() === name.toLowerCase())).map((person) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => onPerson(person),
									className: "min-h-12 rounded-full bg-white/7 px-5 text-sm",
									children: person
								}, `local-${person}`)),
								collections.map((collection) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => onCollection(collection.name, collection.id),
									className: "min-h-12 rounded-full border border-white/10 bg-white/[.035] px-5 text-sm text-white/75",
									children: collection.name
								}, `collection-${collection.id}`))
							]
						})]
					}),
					result?.notices.map((notice) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-3 max-w-3xl text-sm leading-6 text-white/42",
						children: notice
					}, notice)),
					query.trim() && !loading && !hasAny ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {}),
						title: "Nothing exact yet.",
						text: "Try a title, actor, mood, genre, remembered detail, or fewer constraints. ReelOS keeps the parts it understood below."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [results.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-5 text-sm text-white/42",
						children: query.trim() ? `${results.length} paths from that clue` : "A few places to begin"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
						children: results.slice(0, 24).map((title) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PosterCard, {
							title,
							onOpen
						}, title.id))
					})] }), books.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "mt-12",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mb-5 text-sm text-white/42",
							children: "Books"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
							children: books.slice(0, 12).map((book) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => onBook(book.title),
								className: "group min-h-64 overflow-hidden rounded-[1.35rem] bg-white/[.045] text-left",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "aspect-[2/3] overflow-hidden bg-[radial-gradient(circle_at_40%_20%,var(--reelos-favorite),#17171b_70%)]",
									children: book.cover ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: book.cover,
										alt: "",
										className: "size-full object-cover transition duration-500 group-hover:scale-[1.03]"
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "grid size-full place-items-center",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, { className: "size-7 text-white/35" })
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "block p-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
											className: "line-clamp-2 text-sm",
											children: book.title
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "mt-1 block text-xs text-white/42",
											children: book.author
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "mt-3 block text-[10px] uppercase tracking-[.14em] text-white/30",
											children: book.licensed ? "Discover" : book.format || "Open book"
										})
									]
								})]
							}, `${book.licensed ? "licensed" : "open"}-${book.id}`))
						})]
					})] }),
					query.trim() && (result?.suggestions.length ?? 0) > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "mt-10 border-t border-white/8 pt-6",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-white/34",
							children: "Narrow it without rewriting"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3 flex flex-wrap gap-2",
							children: result?.suggestions.map((suggestion) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setQuery(`${query.trim()}${suggestion.addition}`),
								className: "min-h-11 rounded-full border border-white/10 px-4 text-sm text-white/62",
								children: suggestion.label
							}, suggestion.label))
						})]
					}),
					(searchError || (result?.unavailable.length ?? 0) > 0) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-7 text-xs leading-5 text-white/32",
						children: searchError || `${result?.unavailable.join(", ")} did not answer. Everything else above remains usable.`
					}),
					query.trim() && !profile.isChild && !sourceReview && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onConcierge,
						className: "mt-8 min-h-12 text-left text-sm text-white/48 transition hover:text-white",
						children: "Need a hand setting up this home or bringing in your own media?"
					})
				]
			})]
		})
	});
}
function SourceSetupReview({ review, onClose, onSettings }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleDialog, {
		title: "Set up a content source",
		onClose,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-5 text-sm leading-6 text-white/55",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: review.message }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "rounded-2xl bg-black/25 px-4 py-3 font-mono text-xs text-white/58",
					children: review.display
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Nothing has been saved or contacted. Owner settings keep private source details out of search, profiles, and ordinary support exports." }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: onSettings,
					className: "min-h-12 rounded-full bg-white px-5 text-sm font-bold text-black",
					children: "Open owner settings"
				})
			]
		})
	});
}
function ConciergeSheet({ onClose, onSetup, onSettings }) {
	const [prompt, setPrompt] = (0, import_react.useState)("");
	const guidance = conciergeGuidance(inferConciergeIntent(prompt));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleDialog, {
		title: "A little help, when you want it",
		onClose,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm leading-6 text-white/52",
					children: "This home can guide setup without sending your question away. Private local conversation becomes available only when this machine has an approved model pack."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: prompt,
					onChange: (event) => setPrompt(event.target.value),
					placeholder: "For example: how do I bring in my own movies?",
					className: "min-h-14 w-full rounded-2xl bg-white/[.06] px-4 text-sm outline-none placeholder:text-white/28"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "rounded-2xl bg-white/[.045] p-4 text-sm leading-6 text-white/62",
					children: guidance
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onSetup,
						className: "min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black",
						children: "Help me set up"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onSettings,
						className: "min-h-11 rounded-full bg-white/8 px-4 text-sm",
						children: "Owner settings"
					})]
				})
			]
		})
	});
}
function RefineSheet({ onClose }) {
	const tonight = useExperienceStore((state) => state.tonight);
	const setTonight = useExperienceStore((state) => state.setTonight);
	const clearTonight = useExperienceStore((state) => state.clearTonight);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleDialog, {
		title: "Shape tonight, briefly.",
		onClose,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-7",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChoiceSetting, {
					label: "Mood",
					value: tonight.mood || "any",
					options: [
						"any",
						"quiet",
						"comfort",
						"kinetic",
						"dark",
						"fun"
					],
					onChange: (mood) => setTonight({ mood: mood === "any" ? "" : mood })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChoiceSetting, {
					label: "Time",
					value: tonight.duration,
					options: [
						"any",
						"short",
						"feature",
						"long"
					],
					onChange: (duration) => setTonight({ duration })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChoiceSetting, {
					label: "Kind",
					value: tonight.kind,
					options: [
						"all",
						"movie",
						"series",
						"book"
					],
					onChange: (kind) => setTonight({ kind })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChoiceSetting, {
					label: "Exploration",
					value: tonight.exploration,
					options: [
						"familiar",
						"balanced",
						"adventurous"
					],
					onChange: (exploration) => setTonight({ exploration })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-white/46",
					children: "Person"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 flex flex-wrap gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setTonight({ person: "" }),
						className: `min-h-11 rounded-full px-4 text-sm ${!tonight.person ? "bg-white text-black" : "bg-white/7"}`,
						children: "Anyone"
					}), [
						"Florence Pugh",
						"Ayo Edebiri",
						"Ryan Gosling",
						"Zendaya"
					].map((person) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setTonight({ person }),
						className: `min-h-11 rounded-full px-4 text-sm ${tonight.person === person ? "bg-white text-black" : "bg-white/7"}`,
						children: person
					}, person))]
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onClose,
						className: "min-h-12 rounded-full bg-white px-6 text-sm font-bold text-black",
						children: "Show me"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: clearTonight,
						className: "min-h-12 rounded-full border border-white/13 px-6 text-sm",
						children: "Clear"
					})]
				})
			]
		})
	});
}
function TitleSheet({ title, profile, onClose, onPlay, onOpenRelated }) {
	const toggleSaved = useExperienceStore((state) => state.toggleSaved);
	const react = useExperienceStore((state) => state.react);
	const toggleLessLike = useExperienceStore((state) => state.toggleLessLike);
	const request = useExperienceStore((state) => state.requests[title.id]);
	const setRequest = useExperienceStore((state) => state.setRequest);
	const debrid = useExperienceStore((state) => state.debrid);
	const accessible = experienceTitleIsAccessible(title, debrid);
	const canRequest = titleCanUseProvider(title.id, debrid);
	const publicCatalogSource = title.sources.find((source) => source.kind === "public_catalog" && source.verified && source.uri);
	const [requestError, setRequestError] = (0, import_react.useState)("");
	const [requesting, setRequesting] = (0, import_react.useState)(false);
	const related = EXPERIENCE_CATALOG.filter((item) => item.id !== title.id && item.genres.some((genre) => title.genres.includes(genre))).slice(0, 6);
	const primary = async () => {
		if (publicCatalogSource?.uri) {
			window.open(publicCatalogSource.uri, "_blank", "noopener,noreferrer");
			return;
		}
		if (accessible || request?.status === "ready") {
			onPlay(title);
			return;
		}
		if (!canRequest || requesting) return;
		setRequesting(true);
		setRequestError("");
		setRequest(title.id, {
			titleId: title.id,
			status: "finding",
			progress: 0
		});
		try {
			const legacyMovieId = /^tmdb-movie-(\d+)$/.exec(title.id);
			const response = await fetch("/api/request", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					titleId: legacyMovieId ? `tmdb-${legacyMovieId[1]}` : title.id,
					tmdb: legacyMovieId?.[1],
					title: title.title,
					year: title.year,
					mediaType: title.kind === "series" ? "tv" : "movie"
				})
			});
			const result = await response.json();
			if (!response.ok || !result.ok) throw new Error(result.error || "This request could not be started.");
			const ready = [
				"ready",
				"available",
				"downloaded"
			].includes(String(result.status || "").toLowerCase());
			setRequest(title.id, {
				titleId: title.id,
				status: ready ? "ready" : "preparing",
				progress: ready ? 100 : 0
			});
		} catch (reason) {
			setRequest(title.id, {
				titleId: title.id,
				status: "failed",
				progress: 0
			});
			setRequestError(reason instanceof Error ? reason.message : "This request could not be started.");
		} finally {
			setRequesting(false);
		}
	};
	const primaryLabel = requesting ? "Starting request…" : publicCatalogSource ? "View source record" : !accessible && !canRequest && request?.status !== "ready" ? "Unavailable with current sources" : request?.status === "ready" ? profile.progress[title.id] ? "Resume" : "Play" : !request ? accessible ? profile.progress[title.id] && profile.progress[title.id] < .99 ? "Resume" : "Play" : "Find a source" : request.status === "finding" ? "Finding a source…" : request.status === "preparing" ? request.progress > 0 ? `Preparing · ${request.progress}%` : "Request started" : request.status === "failed" ? "Retry" : "Play";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 overflow-y-auto bg-black/72 p-0 backdrop-blur-md md:p-5",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			role: "dialog",
			"aria-modal": "true",
			"aria-label": title.title,
			className: "relative mx-auto min-h-dvh max-w-5xl overflow-hidden bg-[#111115] md:min-h-0 md:rounded-[2rem]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative min-h-[430px]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: title.backdrop,
						alt: "",
						className: "absolute inset-0 size-full object-cover opacity-55"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute inset-0 bg-[linear-gradient(0deg,#111115,transparent_75%),linear-gradient(90deg,#111115d9,transparent)]" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onClose,
						className: "absolute right-5 top-5 z-10 grid size-12 place-items-center rounded-full bg-black/48 backdrop-blur",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative flex min-h-[430px] max-w-2xl flex-col justify-end p-7 md:p-10",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-white/48",
								children: [
									title.year || null,
									title.runtimeKnown === false ? null : `${title.minutes} min`,
									...title.genres
								].filter(Boolean).join(" · ")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "mt-3 font-display text-[clamp(3.3rem,7vw,6.8rem)] font-semibold leading-[.85] tracking-[-.075em]",
								children: title.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-5 max-w-lg leading-7 text-white/60",
								children: whyThisTitle(title, profile)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-7 flex flex-wrap gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => void primary(),
									disabled: requesting || !publicCatalogSource && !accessible && !canRequest && request?.status !== "ready",
									className: "inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-black disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/45",
									children: [publicCatalogSource ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-4" }) : accessible || request?.status === "ready" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4 fill-current" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, { className: "size-4" }), primaryLabel]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => toggleSaved(profile.id, title.id, accessible || request?.status === "ready"),
									disabled: !accessible && request?.status !== "ready",
									className: "inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 px-5 text-sm disabled:cursor-not-allowed disabled:opacity-35",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bookmark, { className: `size-4 ${profile.savedIds.includes(title.id) ? "fill-current" : ""}` }), !accessible && request?.status !== "ready" ? "No accessible source" : profile.savedIds.includes(title.id) ? "Saved" : "Save"]
								})]
							}),
							publicCatalogSource && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-3 text-xs text-white/42",
								children: "This opens the catalog's authoritative record. ReelOS only presents direct media when the source explicitly identifies it as open to use."
							}),
							!publicCatalogSource && !accessible && !canRequest && request?.status !== "ready" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-3 text-xs text-white/42",
								children: "ReelOS knows this title, but public-domain and personal-library mode does not provide access to it."
							}),
							requestError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-3 text-sm text-rose-300",
								children: requestError
							})
						]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-12 p-7 md:p-10",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WhereToWatch, { title }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm text-white/42",
						children: [
							"How does this feel to ",
							profile.name,
							"?"
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex flex-wrap gap-2",
						children: [[
							[
								"like",
								"Like",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {})
							],
							[
								"love",
								"Love",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, {})
							],
							[
								"cozy",
								"Cozy",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Coffee, {})
							]
						].map(([id, label, icon]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => react(profile.id, title.id, profile.reactions[title.id] === id ? void 0 : id),
							className: `inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-sm ${profile.reactions[title.id] === id ? "bg-white text-black" : "bg-white/7"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "[&>svg]:size-4",
								children: icon
							}), label]
						}, id)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => toggleLessLike(profile.id, title.id),
							className: `min-h-12 rounded-full px-4 text-sm ${profile.lessLikeIds.includes(title.id) ? "bg-white text-black" : "bg-white/7"}`,
							children: "Less like this"
						})]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-3xl tracking-[-.05em]",
						children: "The shape of it."
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-4 max-w-2xl leading-7 text-white/52",
						children: [
							title.note,
							" Featuring",
							" ",
							title.people.slice(0, 2).join(" and ") || "an ensemble cast",
							". Longer story, episode, and craft details unfold here only when they are available."
						]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shelf, {
						title: "Nearby worlds.",
						items: related,
						onOpen: onOpenRelated
					})
				]
			})]
		})
	});
}
function streamingIdentity(title) {
	for (const candidate of [title.id, title.playbackId]) {
		const value = String(candidate || "");
		const tv = /^tmdb-tv-(\d+)$/.exec(value);
		if (tv) return {
			mediaType: "tv",
			externalId: tv[1]
		};
		const movie = /^tmdb-(?:movie-)?(\d+)$/.exec(value);
		if (movie) return {
			mediaType: title.kind === "series" ? "tv" : "movie",
			externalId: movie[1]
		};
	}
	return null;
}
function WhereToWatch({ title }) {
	const identity = streamingIdentity(title);
	const [availability, setAvailability] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(Boolean(identity));
	(0, import_react.useEffect)(() => {
		const controller = new AbortController();
		setAvailability(null);
		setLoading(Boolean(identity));
		if (!identity) return () => controller.abort();
		fetch("/api/settings", {
			cache: "no-store",
			signal: controller.signal
		}).then(async (response) => {
			if (!response.ok) return "US";
			const settings = await response.json();
			return settings.region && /^[A-Z]{2}$/.test(settings.region) ? settings.region : "US";
		}).catch(() => "US").then((region) => loadStreamingAvailability({
			...identity,
			region
		}, controller.signal)).then((result) => {
			if (!controller.signal.aborted) setAvailability(result);
		}).finally(() => {
			if (!controller.signal.aborted) setLoading(false);
		});
		return () => controller.abort();
	}, [identity?.mediaType, identity?.externalId]);
	if (!identity) return null;
	if (loading) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-label": "Where to watch",
		"aria-busy": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-5 w-32 animate-pulse rounded-full bg-white/8" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mt-4 h-12 max-w-sm animate-pulse rounded-2xl bg-white/6" })]
	});
	if (!availability?.available) {
		if (availability?.reason === "not_configured") return null;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
			"aria-label": "Where to watch",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm text-white/42",
				children: [
					"No streaming options are listed for region ",
					availability?.region || "US",
					" right now."
				]
			})
		});
	}
	const groups = [
		["Included", [
			...availability.groups.subscription,
			...availability.groups.free,
			...availability.groups.ads
		]],
		["Rent", availability.groups.rent],
		["Buy", availability.groups.buy]
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-label": "Where to watch",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-3xl tracking-[-.05em]",
					children: "Where to watch"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2 text-sm text-white/42",
					children: [
						"Options currently listed for region ",
						availability.region,
						"."
					]
				})] }), availability.link && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
					href: availability.link,
					target: "_blank",
					rel: "noreferrer",
					className: "inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 px-5 text-sm font-semibold",
					children: ["See watching options ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-4" })]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-5 grid gap-4 sm:grid-cols-3",
				children: groups.map(([label, providers]) => providers.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-semibold uppercase tracking-[.14em] text-white/38",
					children: label
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2 flex flex-wrap gap-2",
					children: providers.slice(0, 6).map((provider) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white/6 px-3 text-sm",
						children: [provider.logoUrl && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: provider.logoUrl,
							alt: "",
							className: "size-7 rounded-lg"
						}), provider.name]
					}, `${label}-${provider.id}`))
				})] }, label) : null)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
				href: availability.attribution.url,
				target: "_blank",
				rel: "noreferrer",
				className: "mt-4 inline-block text-xs text-white/30 hover:text-white/55",
				children: availability.attribution.text
			})
		]
	});
}
function PersonSheet({ name, externalId, onClose, onOpen }) {
	const localItems = titlesForPerson(name);
	const [remoteItems, setRemoteItems] = (0, import_react.useState)([]);
	const [remoteName, setRemoteName] = (0, import_react.useState)("");
	const [loading, setLoading] = (0, import_react.useState)(Boolean(externalId));
	const [error, setError] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		if (!externalId) return;
		const controller = new AbortController();
		setLoading(true);
		fetch(`/api/person?id=${encodeURIComponent(externalId)}`, {
			cache: "no-store",
			signal: controller.signal
		}).then((response) => response.json()).then((payload) => {
			const mapped = (payload.person?.credits ?? []).map(mapLookupTitle).filter((title) => Boolean(title));
			setRemoteItems(mapped);
			if (payload.person?.name) setRemoteName(payload.person.name);
			if (!mapped.length && payload.error) setError(payload.error);
		}).catch((fetchError) => {
			if (fetchError?.name !== "AbortError") setError("That filmography is unavailable right now.");
		}).finally(() => {
			if (!controller.signal.aborted) setLoading(false);
		});
		return () => controller.abort();
	}, [externalId]);
	const items = [...localItems, ...remoteItems].filter((title, index, all) => all.findIndex((candidate) => candidate.id === title.id) === index);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SimpleDialog, {
		title: remoteName || name,
		onClose,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-white/48",
				children: "Films and series connected to this person."
			}),
			loading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-5 text-sm text-white/34",
				children: "Gathering their work…"
			}),
			error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-5 text-sm text-amber-200/65",
				children: error
			}),
			items.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3",
				children: items.map((title) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PosterCard, {
					title,
					onOpen
				}, title.id))
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserRound, {}),
				title: "Their work is not indexed here yet.",
				text: "Try again when the wider metadata catalog is available. ReelOS will not redirect you to an unrelated title."
			})
		]
	});
}
function CollectionSheet({ name, titleIds, externalId, onClose, onOpen }) {
	const localItems = titleIds.map((id) => TITLE_BY_EXPERIENCE_ID[id]).filter(Boolean);
	const [remoteItems, setRemoteItems] = (0, import_react.useState)([]);
	const [remoteName, setRemoteName] = (0, import_react.useState)("");
	const [loading, setLoading] = (0, import_react.useState)(Boolean(externalId));
	const [error, setError] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		if (!externalId) return;
		const controller = new AbortController();
		setLoading(true);
		fetch(`/api/collection?id=${encodeURIComponent(externalId)}`, {
			cache: "no-store",
			signal: controller.signal
		}).then((response) => response.json()).then((payload) => {
			const mapped = (payload.collection?.parts ?? []).map(mapLookupTitle).filter((title) => Boolean(title));
			setRemoteItems(mapped);
			if (payload.collection?.name) setRemoteName(payload.collection.name);
			if (!mapped.length && payload.error) setError(payload.error);
		}).catch((fetchError) => {
			if (fetchError?.name !== "AbortError") setError("That collection is unavailable right now.");
		}).finally(() => {
			if (!controller.signal.aborted) setLoading(false);
		});
		return () => controller.abort();
	}, [externalId]);
	const items = [...localItems, ...remoteItems].filter((title, index, all) => all.findIndex((candidate) => candidate.id === title.id) === index);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SimpleDialog, {
		title: remoteName || name,
		onClose,
		children: [
			loading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-5 text-sm text-white/34",
				children: "Gathering the collection…"
			}),
			error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-5 text-sm text-amber-200/65",
				children: error
			}),
			items.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-2 gap-3 sm:grid-cols-3",
				children: items.map((title) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PosterCard, {
					title,
					onOpen
				}, title.id))
			}) : !loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Library, {}),
				title: "This collection is not available yet.",
				text: "ReelOS keeps the destination honest when its metadata source is offline."
			}) : null
		]
	});
}
function SimpleDialog({ title, onClose, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-[60] grid items-end overflow-y-auto bg-black/72 p-3 backdrop-blur-md md:place-items-center",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			role: "dialog",
			"aria-modal": "true",
			"aria-label": title,
			className: "max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-[1.8rem] border border-white/12 bg-[#15151a] p-6 shadow-2xl md:p-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-7 flex items-start justify-between gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-[clamp(2.3rem,5vw,4rem)] font-semibold leading-none tracking-[-.06em]",
					children: title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: onClose,
					"aria-label": `Close ${title}`,
					className: "grid size-12 shrink-0 place-items-center rounded-full bg-white/7",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" })
				})]
			}), children]
		})
	});
}
function EmptyState({ icon, title, text, action, onAction }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-[1.7rem] bg-white/[.035] p-7",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "grid size-12 place-items-center rounded-full bg-white/7 [&>svg]:size-5",
				children: icon
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "mt-6 font-display text-3xl tracking-[-.05em]",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 max-w-lg leading-7 text-white/46",
				children: text
			}),
			action && onAction && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: onAction,
				className: "mt-6 min-h-12 rounded-full bg-white px-6 text-sm font-bold text-black",
				children: action
			})
		]
	});
}
//#endregion
export { ReelOSWorld as t };
