import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { d as viaLabel, o as getTitle } from "./appliance-CsV_BBL_.mjs";
import { T as titleForRequest, _ as isGhostRequestLabel, g as inFlightRequests, p as useReelStore, x as requestShowsRetry } from "./router-Eei6X2k-.mjs";
import { d as formatWhen, i as Gate, l as cn, m as useSyncRequests, n as Button, p as useResolveGhostRequestTitles } from "./gate-DWMcUxiC.mjs";
//#region ../../workspace/node_modules/.nitro/vite/services/ssr/assets/requests-CAwGapcr.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
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
function RequestsView() {
	const [filter, setFilter] = (0, import_react.useState)("all");
	const requests = useReelStore((s) => s.requests);
	const shelf = useReelStore((s) => s.shelf);
	const remoteTitles = useReelStore((s) => s.remoteTitles);
	const hydrateShelf = useReelStore((s) => s.hydrateShelf);
	const retry = useReelStore((s) => s.retryRequest);
	const cancel = useReelStore((s) => s.cancelRequest);
	useSyncRequests();
	(0, import_react.useEffect)(() => {
		hydrateShelf({ limit: 24 });
	}, [hydrateShelf]);
	const catalog = [...shelf, ...remoteTitles];
	const inflight = inFlightRequests(requests, { titles: shelf });
	useResolveGhostRequestTitles(inflight, catalog);
	const list = inflight.filter((r) => filter === "all" ? true : r.status === filter);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "px-5 py-6 md:px-10 md:py-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-semibold tracking-tight",
				children: "Requests"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted",
				children: "In flight — searching, grabbing, waiting to import. Playable titles are in Library."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-6 flex flex-wrap gap-2",
				children: FILTERS.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setFilter(f.id),
					className: cn("h-9 rounded-full px-4 text-sm", filter === f.id ? "bg-gold text-gold-fg" : "bg-card text-muted shadow-[var(--shadow-border)]"),
					children: f.label
				}, f.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "mt-6 divide-y divide-border",
				children: [list.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "py-12 text-sm text-muted",
					children: "Nothing in flight."
				}) : null, list.map((r) => {
					const t = titleForRequest(r, catalog) || getTitle(r.titleId);
					const titleId = t?.id || r.titleId;
					const raw = t?.title || r.title || "";
					const label = isGhostRequestLabel(raw, titleId) ? "Looking up title…" : raw || "Title";
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center gap-4 py-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/title/$id",
								params: { id: titleId },
								className: "shrink-0",
								children: t?.poster ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
									src: t.poster,
									alt: "",
									className: "h-[72px] w-12 rounded-lg object-cover"
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-[72px] w-12 rounded-lg bg-card-2" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
										to: "/title/$id",
										params: { id: titleId },
										className: "truncate font-medium",
										children: [label, r.season ? ` · S${String(r.season).padStart(2, "0")}` : ""]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "mt-1 text-xs text-muted",
										children: [
											r.requester,
											" · ",
											formatWhen(r.createdAt)
										]
									}),
									r.status === "downloading" && r.progress > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-2 h-1 max-w-xs overflow-hidden rounded-full bg-card-2",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "h-full bg-gold",
											style: { width: `${r.progress}%` }
										})
									}) : null,
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "mt-1 text-xs text-muted",
										children: [
											r.reason || viaLabel(r.via, r.status) || (r.status === "downloading" ? `${Math.round(r.progress)}%` : r.status),
											r.status === "downloading" && r.progress > 0 && !r.reason ? ` · ${Math.round(r.progress)}%` : "",
											r.release ? ` · ${r.release}` : ""
										]
									})
								]
							}),
							requestShowsRetry(r) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "ghost",
								onClick: () => retry(r.id),
								children: "Retry"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "quiet",
								onClick: () => cancel(r.id),
								children: "Cancel"
							})
						]
					}, r.id);
				})]
			})
		]
	});
}
function Page() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gate, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RequestsView, {}) });
}
//#endregion
export { Page as component };
