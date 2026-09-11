import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { M as BookOpen, S as Download, c as Search, m as LoaderCircle, r as TriangleAlert } from "../_libs/lucide-react.mjs";
import { p as useReelStore } from "./router-DvmzfdIa.mjs";
import { i as Gate, l as cn, n as Button } from "./gate-BI3T0Pqc.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/books-g80JNS3c.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function BooksView() {
	const intent = useReelStore((s) => s.answers.intent);
	const [query, setQuery] = (0, import_react.useState)("");
	const [searching, setSearching] = (0, import_react.useState)(false);
	const [searched, setSearched] = (0, import_react.useState)(false);
	const [results, setResults] = (0, import_react.useState)([]);
	const [unavailable, setUnavailable] = (0, import_react.useState)([]);
	const [shelf, setShelf] = (0, import_react.useState)(null);
	const [downloading, setDownloading] = (0, import_react.useState)({});
	const [downloaded, setDownloaded] = (0, import_react.useState)({});
	const [errors, setErrors] = (0, import_react.useState)({});
	(0, import_react.useEffect)(() => {
		if (!intent.books) return;
		fetch("/api/books/library", { cache: "no-store" }).then((r) => r.json()).then((j) => setShelf(j.books || [])).catch(() => setShelf([]));
	}, [intent.books]);
	if (!intent.books) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "arena-page",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "font-display text-2xl font-semibold tracking-tight",
			children: "Books"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-sm text-muted",
			children: "Books is off. Flip the Books chip in the wizard or Settings → Library. Kavita stays uninstalled until then."
		})]
	});
	const handleSearch = async () => {
		if (!query.trim()) return;
		setSearching(true);
		setErrors((prev) => ({
			...prev,
			__search: ""
		}));
		try {
			const data = await fetch(`/api/books/search?q=${encodeURIComponent(query.trim())}`, { cache: "no-store" }).then((r) => r.json());
			setResults(data.results ?? []);
			setUnavailable(data.unavailable ?? []);
		} catch {
			setResults([]);
			setUnavailable([]);
			setErrors((prev) => ({
				...prev,
				__search: "Search failed. Is the box online?"
			}));
		} finally {
			setSearching(false);
			setSearched(true);
		}
	};
	const handleDownload = async (book) => {
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
			const href = res.rel ? `/api/books/file?rel=${encodeURIComponent(res.rel)}` : `/api/books/file?url=${encodeURIComponent(book.downloadUrl)}`;
			const a = document.createElement("a");
			a.href = href;
			a.download = res.filename || `${book.title}.epub`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			fetch("/api/books/library", { cache: "no-store" }).then((r) => r.json()).then((j) => setShelf(j.books || []));
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
	const kavitaUrl = typeof window !== "undefined" ? `http://${window.location.hostname}:5000` : "#";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "arena-page",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-2xl font-semibold tracking-tight",
				children: "Books"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted",
				children: "Legal catalogs only — Gutenberg, Standard Ebooks, Internet Archive. Download saves the file on this phone and on the box for Kavita."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-4 flex gap-2",
				onSubmit: (e) => {
					e.preventDefault();
					handleSearch();
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: query,
						onChange: (e) => setQuery(e.target.value),
						placeholder: "Dracula, Sherlock Holmes…",
						className: "h-10 w-full rounded-xl bg-card pl-9 pr-3 text-sm shadow-[var(--shadow-border)] placeholder:text-faint"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					variant: "circuit",
					size: "sm",
					disabled: searching,
					children: searching ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : "Search"
				})]
			}),
			errors.__search ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 flex items-center gap-2 text-sm text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4" }),
					" ",
					errors.__search
				]
			}) : null,
			unavailable.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 flex items-center gap-2 text-sm text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4" }),
					"Could not reach ",
					unavailable.join(" or "),
					". Showing what the other catalogs returned."
				]
			}) : null,
			searched && !searching && results.length === 0 && !errors.__search ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-sm text-muted",
				children: "Nothing in the open catalogs matches that. They carry public domain and openly licensed titles."
			}) : null,
			results.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-4 divide-y divide-border",
				children: results.map((book) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-start gap-3 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate text-sm font-medium",
								children: book.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-0.5 text-xs text-muted",
								children: [
									book.author,
									book.year ? ` · ${book.year}` : "",
									" · ",
									book.source,
									book.format ? ` · ${book.format}` : ""
								]
							}),
							errors[book.id] ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-danger",
								children: errors[book.id]
							}) : null
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "gold",
						size: "sm",
						disabled: downloading[book.id],
						onClick: () => void handleDownload(book),
						children: [downloading[book.id] ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-3.5" }), downloaded[book.id] ? "Saved" : "Download"]
					})]
				}, book.id))
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6 rounded-xl bg-card px-3 py-3 shadow-[var(--shadow-border)]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, { className: "size-4 text-circuit" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-medium",
							children: "Library on the box"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted",
							children: "Kavita · :5000 · /kavita on this host"
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-xs text-muted",
						children: [
							"Files you already own go in ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono",
								children: "/srv/media/books"
							}),
							", one folder per author."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: kavitaUrl,
						target: "_blank",
						rel: "noreferrer",
						className: "mt-2 inline-block text-sm text-circuit",
						children: "Open Kavita"
					})
				]
			}),
			shelf && shelf.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-sm font-medium",
					children: "On this box"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-2 divide-y divide-border",
					children: shelf.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
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
							className: cn("inline-flex h-8 items-center rounded-full bg-gold px-3 text-xs font-medium text-gold-fg"),
							href: `/api/books/file?rel=${encodeURIComponent(b.rel)}`,
							download: true,
							children: "Download"
						})]
					}, b.rel))
				})]
			}) : null
		]
	});
}
function Page() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gate, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BooksView, {}) });
}
//#endregion
export { Page as component };
