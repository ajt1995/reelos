import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { p as useReelStore } from "./router-2YMnuui2.mjs";
import { c as TitleCard, i as Gate, l as cn, o as RemoveFromBox } from "./gate-4q4-7_5m.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/library-C_BNg5ea.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var TABS = [
	{
		id: "all",
		label: "All"
	},
	{
		id: "movie",
		label: "Movies"
	},
	{
		id: "tv",
		label: "TV"
	},
	{
		id: "anime",
		label: "Anime"
	},
	{
		id: "kids",
		label: "Kids"
	},
	{
		id: "music",
		label: "Music"
	}
];
function LibraryView() {
	const [tab, setTab] = (0, import_react.useState)("all");
	const hydrateShelf = useReelStore((s) => s.hydrateShelf);
	const items = useReelStore((s) => s.shelf);
	const err = useReelStore((s) => s.shelfError);
	const shelfReady = useReelStore((s) => s.shelfReady);
	const intent = useReelStore((s) => s.answers.intent);
	(0, import_react.useEffect)(() => {
		hydrateShelf();
	}, [hydrateShelf]);
	const shown = (0, import_react.useMemo)(() => items.filter((t) => tab === "all" ? true : t.kind === tab), [items, tab]);
	const tabs = TABS.filter((t) => {
		if (t.id === "all") return true;
		if (t.id === "movie") return intent.movies;
		if (t.id === "tv") return intent.tv;
		if (t.id === "anime") return intent.anime;
		if (t.id === "kids") return intent.kids;
		if (t.id === "music") return intent.music;
		return true;
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "px-5 py-6 md:px-10 md:py-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-semibold tracking-tight",
				children: "Library"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted",
				children: "What Jellyfin has. If it is not there, it is not on this row. Play uses Jellyfin."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-6 flex flex-wrap gap-2",
				children: tabs.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setTab(t.id),
					className: cn("h-9 rounded-full px-4 text-sm", tab === t.id ? "bg-gold text-gold-fg" : "bg-card text-muted shadow-[var(--shadow-border)]"),
					children: t.label
				}, t.id))
			}),
			shown.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-12 text-sm text-muted",
				children: err ?? (shelfReady ? "Nothing in Jellyfin yet. Request a title from Home. Play uses Jellyfin; on this LAN the official app is http://<lan>:8096 without Tailscale." : "Loading library…")
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
				children: shown.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TitleCard, {
					title: t,
					className: "w-auto"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RemoveFromBox, {
					title: t,
					compact: true
				})] }, t.id))
			})
		]
	});
}
function Page() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gate, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LibraryView, {}) });
}
//#endregion
export { Page as component };
