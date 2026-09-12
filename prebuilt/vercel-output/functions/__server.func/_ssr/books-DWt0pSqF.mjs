import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { A as ChevronRight, F as BookOpen, T as Download, _ as LoaderCircle, a as TriangleAlert, d as Search, i as Upload, j as ChevronLeft, t as X } from "../_libs/lucide-react.mjs";
import { h as useReelStore } from "./router-CT7qiXto.mjs";
import { i as Gate, l as cn, n as Button } from "./gate-D9ix56SU.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/books-DWt0pSqF.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var EPUB_JS = "https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js";
var PDF_JS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
var PDF_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
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
		s.onerror = () => reject(/* @__PURE__ */ new Error(`Could not load reader script`));
		document.head.appendChild(s);
	});
}
function isPdf(rel) {
	return /\.pdf$/i.test(rel);
}
function BookReader({ book, onClose }) {
	const host = (0, import_react.useRef)(null);
	const [err, setErr] = (0, import_react.useState)(null);
	const [pageLabel, setPageLabel] = (0, import_react.useState)("");
	const turn = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		const src = `/api/books/file?rel=${encodeURIComponent(book.rel)}&inline=1`;
		const node = host.current;
		if (!node) return;
		const run = async () => {
			setErr(null);
			try {
				if (isPdf(book.rel)) {
					await loadScript(PDF_JS);
					const pdfjsLib = window.pdfjsLib;
					if (!pdfjsLib) throw new Error("PDF.js did not load");
					pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER;
					const doc = await pdfjsLib.getDocument(src).promise;
					if (cancelled) return;
					let pageNum = 1;
					const canvas = document.createElement("canvas");
					canvas.className = "mx-auto max-h-[calc(100dvh-7rem)] w-full max-w-3xl";
					node.innerHTML = "";
					node.appendChild(canvas);
					const paint = async (n) => {
						const page = await doc.getPage(n);
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
						setPageLabel(`${n} / ${doc.numPages}`);
					};
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
					await paint(1);
					return;
				}
				await loadScript(EPUB_JS);
				const ePub = window.ePub;
				if (!ePub) throw new Error("EPUB.js did not load");
				node.innerHTML = "";
				const bookObj = ePub(src);
				const rendition = bookObj.renderTo(node, {
					width: "100%",
					height: "100%",
					spread: "none",
					allowScriptedContent: false
				});
				await rendition.display();
				if (cancelled) {
					bookObj.destroy?.();
					return;
				}
				turn.current = {
					next: () => void rendition.next(),
					prev: () => void rendition.prev()
				};
				const loc = rendition.currentLocation?.();
				if (loc?.start?.displayed) setPageLabel(`${loc.start.displayed.page} / ${loc.start.displayed.total}`);
				rendition.on("relocated", (location) => {
					const d = location?.start?.displayed;
					if (d) setPageLabel(`${d.page} / ${d.total}`);
				});
				rendition.on("displayedError", () => {
					setErr("This file is DRM-protected (Adobe/LCP) or unreadable. ReelOS reads DRM-free EPUB and PDF only.");
				});
			} catch (e) {
				if (!cancelled) setErr(String(e).includes("DRM") || String(e).toLowerCase().includes("encrypt") ? "This file is DRM-protected (Adobe/LCP). ReelOS reads DRM-free EPUB and PDF only." : "Could not open that file in the in-app reader. Download it for iOS Books / Android, or sideload a DRM-free EPUB/PDF.");
			}
		};
		run();
		return () => {
			cancelled = true;
			turn.current = null;
			if (node) node.innerHTML = "";
		};
	}, [book.rel]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 z-50 flex flex-col bg-background",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center gap-2 border-b border-border px-3 py-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "quiet",
						size: "icon",
						"aria-label": "Close reader",
						onClick: onClose,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate text-sm font-medium",
							children: book.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate text-xs text-muted",
							children: book.author
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						className: "inline-flex h-8 items-center rounded-full bg-gold px-3 text-xs font-medium text-gold-fg",
						href: `/api/books/file?rel=${encodeURIComponent(book.rel)}`,
						download: true,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "mr-1 size-3.5" }), "Download"]
					})
				]
			}),
			err ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-4 py-6 text-sm text-muted",
				children: err
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: host,
				className: "min-h-0 flex-1 overflow-auto bg-background px-2 py-2"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
				className: "flex items-center justify-between gap-2 border-t border-border px-3 py-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "circuit",
						size: "sm",
						onClick: () => turn.current?.prev(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "size-4" }), " Prev"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-muted",
						children: pageLabel || " "
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "circuit",
						size: "sm",
						onClick: () => turn.current?.next(),
						children: ["Next ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4" })]
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
function BooksView() {
	const booksOn = useReelStore((s) => s.settings.betaChannel);
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
	const [downloading, setDownloading] = (0, import_react.useState)({});
	const [downloaded, setDownloaded] = (0, import_react.useState)({});
	const [errors, setErrors] = (0, import_react.useState)({});
	const [reading, setReading] = (0, import_react.useState)(null);
	const [sideloadMsg, setSideloadMsg] = (0, import_react.useState)("");
	const fileRef = (0, import_react.useRef)(null);
	const refreshShelf = () => fetch("/api/books/library", { cache: "no-store" }).then((r) => r.json()).then((j) => setShelf(j.books || [])).catch(() => setShelf([]));
	(0, import_react.useEffect)(() => {
		if (!booksOn) return;
		refreshShelf();
		fetch("/api/books/discover", { cache: "no-store" }).then((r) => r.json()).then((j) => {
			setCatalog(j.featured || []);
			setFeaturedLicensed(j.licensed || []);
			if (j.unavailable?.length) setUnavailable(j.unavailable);
		}).catch(() => setCatalog([]));
	}, [booksOn]);
	(0, import_react.useEffect)(() => {
		const rel = readParam();
		if (!rel || !shelf) return;
		const hit = shelf.find((b) => b.rel === rel);
		if (hit) setReading(hit);
	}, [shelf]);
	if (!booksOn) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "px-5 py-6 md:px-10 md:py-8",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "font-display text-2xl font-semibold tracking-tight",
			children: "Books"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-sm text-muted",
			children: "Books is off. Settings → Updates → Beta channel turns on Arena chrome and Books. Kavita stays stopped until then."
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
			setLicensed(data.licensed ?? []);
			setUnavailable(data.unavailable ?? []);
			setHonesty(data.honesty ?? "");
		} catch {
			setResults([]);
			setLicensed([]);
			setUnavailable([]);
			setHonesty("");
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
			const lib = await fetch("/api/books/library", { cache: "no-store" }).then((r) => r.json());
			setShelf(lib.books || []);
			if (res.rel) {
				const saved = (lib.books || []).find((b) => b.rel === res.rel);
				if (saved) setReading(saved);
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
		setSideloadMsg("Saved on the box. Opening the in-app reader.");
		await refreshShelf();
		setReading({
			title: file.name.replace(/\.(epub|pdf|txt)$/i, ""),
			author: "Unknown Author",
			rel: res.rel,
			bytes: file.size
		});
	};
	const kavitaUrl = typeof window !== "undefined" ? `http://${window.location.hostname}:5000` : "#";
	const renderOpen = (books) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "mt-3 divide-y divide-border",
		children: books.map((book) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
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
	});
	const renderLicensed = (items, label) => items.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-sm font-medium",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted",
				children: honesty || "In copyright. This box cannot fetch the full file. Buy, borrow from a library, or sideload a DRM-free EPUB you own."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2 divide-y divide-border",
				children: items.map((book) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "py-3",
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
								" · in copyright"
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 flex flex-wrap gap-1.5",
							children: [(book.actions ?? []).slice(0, 6).map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href: a.url,
								target: "_blank",
								rel: "noreferrer",
								className: "inline-flex h-7 items-center rounded-full bg-card-2 px-2.5 text-[11px] text-circuit",
								children: a.label
							}, `${book.id}-${a.label}`)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => fileRef.current?.click(),
								className: "inline-flex h-7 items-center rounded-full bg-card-2 px-2.5 text-[11px] text-circuit",
								children: "Sideload"
							})]
						})
					]
				}, book.id))
			})
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "arena-page",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-2xl font-semibold tracking-tight",
				children: "Books"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted",
				children: "Books Discover is browse/featured from legal catalogs — not Seerr. In-copyright series (Hunger Games) are buy, borrow, or sideload. Download still saves a real DRM-free file for iOS Books / Android; Read opens it here."
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
						placeholder: "Holmes, Dracula, Hunger Games…",
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
			searched && !searching && results.length === 0 && licensed.length === 0 && !errors.__search ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-sm text-muted",
				children: "Nothing in the open catalogs matches that. They carry public domain and openly licensed titles — not in-copyright series."
			}) : null,
			results.length > 0 ? renderOpen(results) : null,
			renderLicensed(licensed, "Get this legally"),
			!searched ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-sm font-medium",
						children: "Discover"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted",
						children: "Featured public-domain keep-files. Movie/TV Discover on the Discover tab is still Seerr."
					}),
					catalog.length > 0 ? renderOpen(catalog) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-sm text-muted",
						children: "Loading featured books…"
					}),
					renderLicensed(featuredLicensed, "In stores and libraries")
				]
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
							", one folder per author. Sideload a DRM-free EPUB or PDF — Adobe DRM will fail in the reader."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 flex flex-wrap items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							href: kavitaUrl,
							target: "_blank",
							rel: "noreferrer",
							className: "text-sm text-circuit",
							children: "Open Kavita"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "text-sm text-circuit",
							onClick: () => fileRef.current?.click(),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "mr-1 inline size-3.5" }), "Sideload EPUB/PDF"]
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
						className: "mt-2 text-xs text-muted",
						children: sideloadMsg
					}) : null
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
						className: "flex items-center gap-2 py-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "truncate text-sm",
									children: b.title
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted",
									children: b.author
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "circuit",
								size: "sm",
								onClick: () => setReading(b),
								children: "Read"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								className: cn("inline-flex h-8 items-center rounded-full bg-gold px-3 text-xs font-medium text-gold-fg"),
								href: `/api/books/file?rel=${encodeURIComponent(b.rel)}`,
								download: true,
								children: "Download"
							})
						]
					}, b.rel))
				})]
			}) : null,
			reading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookReader, {
				book: reading,
				onClose: () => setReading(null)
			}) : null
		]
	});
}
function Page() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gate, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BooksView, {}) });
}
//#endregion
export { Page as component };
