import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { d as viaLabel, i as adapterProfile, o as getTitle } from "./appliance-Dk74LcNF.mjs";
import { L as ArrowLeft } from "../_libs/lucide-react.mjs";
import { A as requestProgressLabel, _ as useReelStore, a as Route$4, h as sourceLabel } from "./router-mM1Mn5a3.mjs";
import { i as Gate, n as Button } from "./gate-Bgio5WT8.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/engine._id-BFtvUsan.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
createServerFn({ method: "GET" }).handler(createSsrRpc("41d2c07472a4f1e5dcb4aab96fabd1ba92e389d7e8e8e8645f602cca3019fa35"));
createServerFn({ method: "POST" }).handler(createSsrRpc("95fc432c40828f34b0a9df54f531530faf3cf2c3132f82e6f301329ef0df2d0d"));
createServerFn({ method: "POST" }).handler(createSsrRpc("258f0c1890e4544d82619f31600079d1a054c2e11b8af15418d099f7d01f07e0"));
createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("8e2c75e67287fd6b481a987be04b658a98350cf13e5ff73b0a11f19adf3d801f"));
var pushIndexer = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("9b1162b45ecf77c4e9f949cb833621bae5038735658ddada1011101c1b77d7a5"));
createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("da29a55faba4a3535cedb4ac09bfa8bbf09aefb1c5ca11099c758b2b1ff3f6c3"));
createServerFn({ method: "GET" }).handler(createSsrRpc("9dfc77b31da6c0fd514d28a91d4dbd04a3b1978d535211e18a7589379263907e"));
createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("e527b35fb0741ee0fe03221620fa9230845510147ace7804948043c6fad06cb2"));
var META = {
	indexers: {
		title: "Indexers",
		fandom: "Prowlarr",
		port: "9696"
	},
	movies: {
		title: "Movies engine",
		fandom: "Radarr",
		port: "7878"
	},
	tv: {
		title: "TV engine",
		fandom: "Sonarr",
		port: "8989"
	},
	music: {
		title: "Music engine",
		fandom: "Lidarr",
		port: "8686"
	},
	subtitles: {
		title: "Subtitles",
		fandom: "Bazarr",
		port: "6767"
	},
	downloads: {
		title: "Provider adapter",
		fandom: "Client",
		port: "8085"
	},
	seerr: {
		title: "Seerr",
		fandom: "Jellyseerr",
		port: "5055"
	}
};
function EngineView({ id }) {
	const answers = useReelStore((s) => s.answers);
	const profile = adapterProfile(answers.source, answers.frontend);
	const meta = id === "downloads" ? {
		title: profile.name,
		fandom: profile.fandom,
		port: profile.port
	} : META[id];
	const requests = useReelStore((s) => s.requests);
	const library = useReelStore((s) => s.library);
	const shelf = useReelStore((s) => s.shelf);
	if (!meta) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-8",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-muted",
			children: "Unknown engine."
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/settings/advanced",
			className: "mt-3 inline-block text-gold",
			children: "Back"
		})]
	});
	const movies = shelf.filter((t) => t.kind === "movie");
	const shows = shelf.filter((t) => t.kind === "tv" || t.kind === "anime");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "bg-raised",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex items-center gap-3 border-b border-border px-4 py-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/settings/advanced",
				className: "flex size-10 items-center justify-center rounded-lg text-muted hover:text-foreground",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-4" })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm font-medium",
				children: meta.title
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "font-mono text-[11px] text-faint",
				children: [
					"proxied · ",
					meta.fandom,
					" · ",
					meta.port
				]
			})] })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "p-4 md:p-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-4 rounded-lg bg-gold/10 px-3 py-2 text-xs text-gold",
					children: "Daily search and request belong in ReelOS. This page is for repairs. Download clients other than the debrid adapter are removed."
				}),
				id === "movies" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Table, {
					rows: movies,
					requests,
					library
				}) : null,
				id === "tv" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Table, {
					rows: shows,
					requests,
					library,
					series: true
				}) : null,
				id === "indexers" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IndexerPanel, {}) : null,
				id === "subtitles" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "English preferred. Wired to the library."
				}) : null,
				id === "downloads" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdapterConsole, {}) : null,
				id === "seerr" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "Daily search and Request stay in ReelOS. This is the Jellyseerr admin on :5055 (also /seerr)."
				}) : null
			]
		})]
	});
}
function IndexerPanel() {
	const indexers = useReelStore((s) => s.indexers);
	const addIndexer = useReelStore((s) => s.addIndexer);
	const removeIndexer = useReelStore((s) => s.removeIndexer);
	const [name, setName] = (0, import_react.useState)("");
	const [url, setUrl] = (0, import_react.useState)("");
	const [key, setKey] = (0, import_react.useState)("");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted",
			children: "None ship on the disc. Request talks to the debrid adapter. Add an indexer here only if you already have one."
		}),
		indexers.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 rounded-lg bg-card px-4 py-3 text-sm text-muted",
			children: "No indexers. This is correct."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-4 space-y-2",
			children: indexers.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex items-center justify-between gap-3 rounded-lg bg-card px-4 py-3 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-medium",
					children: i.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "mt-0.5 block font-mono text-xs text-faint",
					children: i.url
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "text-xs text-danger",
					onClick: () => removeIndexer(i.id),
					children: "Remove"
				})]
			}, i.id))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "mt-6 grid gap-2 sm:grid-cols-2",
			onSubmit: (e) => {
				e.preventDefault();
				addIndexer(name, url, key);
				pushIndexer({ data: {
					name,
					url,
					key
				} });
				setName("");
				setUrl("");
				setKey("");
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: name,
					onChange: (e) => setName(e.target.value),
					placeholder: "Name",
					className: "h-11 rounded-2xl bg-card px-4 text-sm shadow-[var(--shadow-border)] outline-none"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: url,
					onChange: (e) => setUrl(e.target.value),
					placeholder: "URL",
					className: "h-11 rounded-2xl bg-card px-4 text-sm shadow-[var(--shadow-border)] outline-none"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: key,
					onChange: (e) => setKey(e.target.value),
					placeholder: "API key",
					className: "h-11 rounded-2xl bg-card px-4 text-sm shadow-[var(--shadow-border)] outline-none sm:col-span-2"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					className: "sm:col-span-2",
					children: "Add indexer"
				})
			]
		})
	] });
}
function AdapterConsole() {
	const adapter = useReelStore((s) => s.adapter);
	const answers = useReelStore((s) => s.answers);
	const requests = useReelStore((s) => s.requests);
	const pingAdapter = useReelStore((s) => s.pingAdapter);
	const profile = adapterProfile(answers.source, answers.frontend);
	const queue = requests.filter((r) => r.status === "downloading" || r.status === "waiting");
	const recent = requests.filter((r) => r.status === "available" || r.status === "failed").slice(0, 6);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-3 sm:grid-cols-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Provider",
					value: sourceLabel[adapter.provider],
					hint: adapter.status === "healthy" ? `${adapter.pingMs}ms · ${adapter.daysLeft ? `${adapter.daysLeft}d left` : adapter.account}` : "Offline"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "API",
					value: profile.api,
					hint: adapter.mount
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Traffic",
					value: `${adapter.cacheHits} cache`,
					hint: `${adapter.transfers} transfers`
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 text-sm text-muted",
			children: profile.blurb
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			onClick: pingAdapter,
			className: "mt-4 h-9 rounded-full bg-card px-4 text-sm text-muted shadow-[var(--shadow-border)] hover:text-foreground",
			children: "Ping adapter"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-6 mb-2 text-xs tracking-[0.16em] text-faint uppercase",
			children: "Queue"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
			className: "space-y-2",
			children: [queue.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
				className: "rounded-lg bg-card px-4 py-3 text-sm text-muted",
				children: "Queue empty."
			}) : null, queue.map((r) => {
				const t = getTitle(r.titleId);
				const via = viaLabel(r.via, r.status);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded-lg bg-card px-4 py-3 text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "truncate font-medium",
								children: t?.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "shrink-0 font-mono text-xs text-gold",
								children: r.status === "downloading" ? requestProgressLabel(r) || "Grabbing" : "search"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-xs text-muted",
							children: [via ?? r.status, r.release ? ` · ${r.release}` : ""]
						}),
						r.status === "downloading" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 h-1 overflow-hidden rounded-full bg-card-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-full bg-gold",
								style: { width: `${r.progress}%` }
							})
						}) : null
					]
				}, r.id);
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-6 mb-2 text-xs tracking-[0.16em] text-faint uppercase",
			children: "Recent"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
			className: "space-y-2",
			children: [recent.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
				className: "rounded-lg bg-card px-4 py-3 text-sm text-muted",
				children: "No completed jobs."
			}) : null, recent.map((r) => {
				const t = getTitle(r.titleId);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center justify-between gap-3 rounded-lg bg-card px-4 py-3 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "truncate",
						children: t?.title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "shrink-0 text-xs text-muted",
						children: r.status === "failed" ? r.reason : viaLabel(r.via, r.status)
					})]
				}, r.id);
			})]
		})
	] });
}
function Stat({ label, value, hint }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl bg-card px-4 py-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] tracking-[0.16em] text-faint uppercase",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 font-display font-medium",
				children: value
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-0.5 text-xs text-muted",
				children: hint
			})
		]
	});
}
function Table({ rows, requests, library, series }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "overflow-x-auto rounded-lg bg-card",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
			className: "w-full text-left text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
				className: "text-xs uppercase tracking-wide text-faint",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
					className: "border-b border-border",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-3 font-medium",
							children: "Title"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-3 font-medium",
							children: "Year"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-3 font-medium",
							children: series ? "Monitored" : "Status"
						})
					]
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: rows.map((r) => {
				const req = requests.find((q) => q.titleId === r.id);
				const status = library.includes(r.id) ? "Imported" : req?.status === "downloading" ? requestProgressLabel(req) || "Grabbing" : req?.status ?? "Missing";
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
					className: "border-b border-border/70",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-4 py-3",
							children: r.title
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-4 py-3 text-muted",
							children: r.year
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-4 py-3 text-muted",
							children: status
						})
					]
				}, r.id);
			}) })]
		})
	});
}
function Page() {
	const { id } = Route$4.useParams();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gate, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EngineView, { id }) });
}
//#endregion
export { Page as component };
