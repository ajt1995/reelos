import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, b as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { B as Popcorn, C as Sparkles, nt as LoaderCircle, w as Smile, wt as Coffee } from "../_libs/lucide-react.mjs";
import { E as cn, X as useReelStore, c as Route$15, u as Button } from "./router-M-yvs45k.mjs";
import { t as HouseholdGateView } from "./household-gate-view--zXnfObv.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/join-DoglpD9i.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var VIBES = [
	{
		id: "cinema",
		label: "Cinema Night",
		desc: "Blockbusters, high-octane action & sci-fi spectacles",
		icon: Popcorn,
		vibeChoice: "bleeding_edge"
	},
	{
		id: "cozy",
		label: "Cozy Binge",
		desc: "Comedies, sitcoms, procedural mysteries & feel-good TV",
		icon: Coffee,
		vibeChoice: "comfort"
	},
	{
		id: "mindbender",
		label: "Mind-Benders",
		desc: "Psychological thrillers, twists, cult classics & cerebral fiction",
		icon: Sparkles,
		vibeChoice: "hidden_gems"
	},
	{
		id: "family",
		label: "Family & Animation",
		desc: "Pixar, Studio Ghibli, adventure & animated gems",
		icon: Smile,
		vibeChoice: "comfort"
	}
];
function GuestJoinView() {
	const navigate = useNavigate();
	const [nickname, setNickname] = (0, import_react.useState)("");
	const [selectedVibe, setSelectedVibe] = (0, import_react.useState)("cinema");
	const [ratingFloor, setRatingFloor] = (0, import_react.useState)("all");
	const [submitting, setSubmitting] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)("");
	const handleJoin = async (e) => {
		e.preventDefault();
		const cleanNick = nickname.trim() || "Guest";
		setSubmitting(true);
		setError("");
		try {
			const res = await fetch("/api/guest/join", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					nickname: cleanNick,
					vibe: selectedVibe,
					ratingFloor
				})
			});
			const data = await res.json();
			if (!res.ok || !data.ok) throw new Error(data.error || "Failed to join session");
			const resident = data.resident;
			if (resident) {
				useReelStore.getState().patchResident("res-guest", {
					name: resident.name,
					tasteVibe: resident.tasteVibe,
					expiresAt: resident.expiresAt
				});
				useReelStore.getState().setActiveResident("res-guest");
			}
			useReelStore.getState().openReelOS();
			await navigate({ to: "/discover" });
		} catch (err) {
			setError(String(err instanceof Error ? err.message : err));
			setSubmitting(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-[#090B0E] text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				"aria-hidden": true,
				className: "pointer-events-none absolute -top-40 -left-40 size-96 rounded-full bg-amber-500/10 blur-[120px]"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				"aria-hidden": true,
				className: "pointer-events-none absolute -bottom-40 -right-40 size-96 rounded-full bg-sky-500/10 blur-[120px]"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "w-full max-w-md relative z-10",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-center mb-8",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "inline-flex size-14 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 mb-4 shadow-lg shadow-amber-500/10",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Popcorn, { className: "size-7" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "text-2xl font-bold tracking-tight text-white",
							children: "Guest Fast-Join"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1.5 text-xs text-slate-400",
							children: "Join the living room session in 3 seconds. Your pass automatically expires in 12 hours."
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					onSubmit: handleJoin,
					className: "rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8 space-y-6 shadow-2xl",
					children: [
						error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300",
							children: error
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-xs font-semibold uppercase tracking-wider text-slate-400",
								children: "1. Your Nickname"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								value: nickname,
								onChange: (e) => setNickname(e.target.value),
								placeholder: "e.g. Sarah, Alex, Movie Squad",
								maxLength: 24,
								className: "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-colors"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-xs font-semibold uppercase tracking-wider text-slate-400",
								children: "2. What's Tonight's Vibe?"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid grid-cols-1 gap-2.5",
								children: VIBES.map((v) => {
									const Icon = v.icon;
									const isSelected = selectedVibe === v.id;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => setSelectedVibe(v.id),
										className: cn("flex items-center gap-3.5 rounded-2xl border p-3.5 text-left transition-all cursor-pointer", isSelected ? "border-amber-500/60 bg-amber-500/15 shadow-md shadow-amber-500/10" : "border-white/10 bg-white/[0.02] hover:bg-white/5 hover:border-white/20"),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: cn("flex size-10 items-center justify-center rounded-xl shrink-0 transition-colors", isSelected ? "bg-amber-400 text-slate-950 font-bold" : "bg-white/5 text-slate-400"),
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-5" })
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "min-w-0 flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: cn("text-xs font-semibold", isSelected ? "text-amber-300" : "text-white"),
												children: v.label
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[11px] text-slate-400 truncate",
												children: v.desc
											})]
										})]
									}, v.id);
								})
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-xs font-semibold uppercase tracking-wider text-slate-400",
								children: "3. Content Filter"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid grid-cols-2 gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setRatingFloor("chill"),
									className: cn("rounded-xl border p-3 text-center transition-all cursor-pointer", ratingFloor === "chill" ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 font-semibold" : "border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/5"),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-xs font-medium",
										children: "🌿 Keep it Chill"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[10px] text-slate-500 mt-0.5",
										children: "PG-13 / Family friendly"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setRatingFloor("all"),
									className: cn("rounded-xl border p-3 text-center transition-all cursor-pointer", ratingFloor === "all" ? "border-amber-500/50 bg-amber-500/15 text-amber-300 font-semibold" : "border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/5"),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-xs font-medium",
										children: "🔥 Anything Goes"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[10px] text-slate-500 mt-0.5",
										children: "R-rated / Full library"
									})]
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							disabled: submitting,
							variant: "gold",
							className: "w-full h-12 rounded-xl text-sm font-bold shadow-lg shadow-amber-500/20",
							children: submitting ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }), "Preparing Vibe Feed..."]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-4" }), "Join Living Room Feed"]
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] text-center text-slate-500",
							children: "🔒 No account or password required. Session prunes automatically after 12 hours."
						})
					]
				})]
			})
		]
	});
}
function JoinPage() {
	const { token } = Route$15.useSearch();
	if (token) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HouseholdGateView, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GuestJoinView, {});
}
//#endregion
export { JoinPage as component };
