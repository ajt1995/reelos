import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { p as useReelStore } from "./router-DvmzfdIa.mjs";
import { c as TitleCard, i as Gate, l as cn, o as RemoveFromBox } from "./gate-BI3T0Pqc.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/library-CdYaYp29.js
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
	},
	{
		id: "book",
		label: "Books"
	}
];
function LibraryView() {
	const [tab, setTab] = (0, import_react.useState)("all");
	const hydrateShelf = useReelStore((s) => s.hydrateShelf);
	const items = useReelStore((s) => s.shelf);
	const err = useReelStore((s) => s.shelfError);
	const shelfReady = useReelStore((s) => s.shelfReady);
	const intent = useReelStore((s) => s.answers.intent);
	const [books, setBooks] = (0, import_react.useState)([]);
	(0, import_react.useEffect)(() => {
		hydrateShelf();
	}, [hydrateShelf]);
	(0, import_react.useEffect)(() => {
		if (!intent.books) return;
		fetch("/api/books/library", { cache: "no-store" }).then((r) => r.json()).then((j) => setBooks(j.books || [])).catch(() => setBooks([]));
	}, [intent.books]);
	const shown = (0, import_react.useMemo)(() => items.filter((t) => tab === "all" ? true : t.kind === tab), [items, tab]);
	const tabs = TABS.filter((t) => {
		if (t.id === "all") return true;
		if (t.id === "movie") return intent.movies;
		if (t.id === "tv") return intent.tv;
		if (t.id === "anime") return intent.anime;
		if (t.id === "kids") return intent.kids;
		if (t.id === "music") return intent.music;
		if (t.id === "book") return intent.books;
		return true;
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "arena-page",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-2xl font-semibold tracking-tight",
				children: "Library"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted",
				children: "What Jellyfin has. If it is not there, it is not on this row. Play uses Jellyfin."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap gap-1.5",
				children: [tabs.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setTab(t.id),
					className: cn("h-7 rounded-full px-3 text-xs", tab === t.id ? "bg-circuit/20 text-circuit" : "bg-card text-muted shadow-[var(--shadow-border)]"),
					children: t.label
				}, t.id)), intent.books ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/books",
					className: "ml-1 self-center text-xs text-circuit",
					children: "Catalog"
				}) : null]
			}),
			tab === "book" ? books.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-6 text-sm text-muted",
				children: "No files in /srv/media/books yet. Search the catalogs — Download is the file."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-4 divide-y divide-border",
				children: books.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center gap-3 py-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate text-sm",
							children: b.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted",
							children: b.author
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						className: "inline-flex h-8 items-center rounded-full bg-gold px-3 text-xs font-medium text-gold-fg arena-gold-press",
						href: `/api/books/file?rel=${encodeURIComponent(b.rel)}`,
						download: true,
						children: "Download"
					})]
				}, b.rel))
			}) : shown.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
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
