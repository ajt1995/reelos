import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as adapterProfile } from "./appliance-BH_6H5H0.mjs";
import { E as Clapperboard, S as Download, h as ListFilter, j as Captions, p as Music, r as TriangleAlert, x as Film } from "../_libs/lucide-react.mjs";
import { p as useReelStore } from "./router-DvmzfdIa.mjs";
import { i as Gate, n as Button } from "./gate-BI3T0Pqc.mjs";
import { r as TerminalRow } from "./settings-terminal-BsmRJ9v_.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings.advanced-BZRs06Dd.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var ENGINES = [
	{
		id: "indexers",
		label: "Indexers",
		blurb: "Empty on purpose. You add your own.",
		icon: ListFilter
	},
	{
		id: "movies",
		label: "Movies engine",
		blurb: "Monitors movie requests.",
		icon: Film
	},
	{
		id: "tv",
		label: "TV engine",
		blurb: "Monitors series and seasons.",
		icon: Clapperboard
	},
	{
		id: "music",
		label: "Music engine",
		blurb: "Monitors albums when Music is on.",
		icon: Music
	},
	{
		id: "subtitles",
		label: "Subtitles",
		blurb: "Wired to engines and the player.",
		icon: Captions
	},
	{
		id: "downloads",
		label: "Provider adapter",
		blurb: "Download client the engines speak to.",
		icon: Download
	},
	{
		id: "seerr",
		label: "Seerr",
		blurb: "Request service. Phone UI stays ReelOS.",
		icon: Film
	}
];
function AdvancedView() {
	const hide = useReelStore((s) => s.settings.hideAdvanced);
	const intent = useReelStore((s) => s.answers.intent);
	const answers = useReelStore((s) => s.answers);
	const [term, setTerm] = (0, import_react.useState)(false);
	const profile = adapterProfile(answers.source, answers.frontend);
	const tiles = ENGINES.filter((e) => {
		if (e.id === "movies" && !intent.movies) return false;
		if (e.id === "tv" && !intent.tv && !intent.anime) return false;
		if (e.id === "music" && !intent.music) return false;
		return true;
	}).map((e) => e.id === "downloads" ? {
		...e,
		label: profile.name,
		blurb: profile.blurb
	} : e);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "px-5 py-6 md:px-10 md:py-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "inline-flex items-center gap-2 rounded-full bg-gold/10 px-3 py-1 text-xs text-gold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-3.5" }), "You do not need these for daily use"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-4 font-display text-3xl font-semibold tracking-tight",
				children: "Advanced apps"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 max-w-xl text-sm text-muted",
				children: "Human names. The fandom names stay behind the proxy. Same login as the shell."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-8 grid gap-3 sm:grid-cols-2",
				children: tiles.map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/engine/$id",
					params: { id: e.id },
					className: "flex items-start gap-4 rounded-2xl bg-card p-5 shadow-[var(--shadow-border)] transition-[box-shadow] hover:shadow-[var(--shadow-border-hover)]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(e.icon, { className: "mt-0.5 size-5 text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block font-display font-medium",
						children: e.label
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-1 block text-sm text-muted",
						children: e.blurb
					})] })]
				}, e.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-8",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TerminalRow, {
					open: term,
					onClick: () => setTerm((v) => !v)
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResetAppliance, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-8",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					onClick: () => useReelStore.getState().patchSettings({ hideAdvanced: !hide }),
					children: hide ? "Show this section" : "Hide Advanced from Settings"
				})
			})
		]
	});
}
function ResetAppliance() {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [msg, setMsg] = (0, import_react.useState)("");
	const run = async () => {
		setBusy(true);
		setMsg("");
		try {
			const j = await (await fetch("/api/reset", { method: "POST" })).json();
			if (!j.ok) {
				setMsg(j.error || "Reset refused");
				setBusy(false);
				return;
			}
			useReelStore.getState().factoryReset();
			setMsg("Resetting. Wizard, then Connect.");
			window.setTimeout(() => window.location.reload(), 4e3);
		} catch (e) {
			setMsg(String(e));
			setBusy(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-8 rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-display font-medium",
				children: "Reset appliance"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted",
				children: "First-run again. Keeps media on disk and Docker images. Wipes wizard answers and engine configs. Will not run during an update."
			}),
			!open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				className: "mt-3",
				variant: "danger",
				onClick: () => setOpen(true),
				children: "Reset appliance"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "danger",
					disabled: busy,
					onClick: () => void run(),
					children: busy ? "Resetting…" : "Yes, wipe configs"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					disabled: busy,
					onClick: () => setOpen(false),
					children: "Cancel"
				})]
			}),
			msg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted",
				children: msg
			}) : null
		]
	});
}
function Page() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gate, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdvancedView, {}) });
}
//#endregion
export { Page as component };
