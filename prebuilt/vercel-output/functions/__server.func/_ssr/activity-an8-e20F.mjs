import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as getTitle } from "./appliance-Dk74LcNF.mjs";
import { _ as useReelStore } from "./router-BRdtnWtf.mjs";
import { o as formatWhen } from "./title-card-CenIlcA6.mjs";
import { i as Gate } from "./gate-C28F9liZ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/activity-an8-e20F.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ActivityView() {
	const local = useReelStore((s) => s.activity);
	const [live, setLive] = (0, import_react.useState)([]);
	(0, import_react.useEffect)(() => {
		let stop = false;
		const load = () => {
			fetch("/api/activity", { cache: "no-store" }).then((r) => r.json()).then((j) => {
				if (!stop) setLive(Array.isArray(j.events) ? j.events : []);
			}).catch(() => {});
		};
		load();
		const id = window.setInterval(load, 8e3);
		return () => {
			stop = true;
			window.clearInterval(id);
		};
	}, []);
	const activity = live.length ? live : local;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "px-5 py-6 md:px-10 md:py-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-semibold tracking-tight",
				children: "Activity"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted",
				children: "OTA, wire, and the shell. Not a port list."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
				className: "mt-8 space-y-0",
				children: [activity.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "Quiet so far."
				}) : null, activity.map((e) => {
					const t = e.titleId ? getTitle(e.titleId) : void 0;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex gap-4 border-b border-border py-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mt-1 size-2 shrink-0 rounded-full bg-gold/80" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm",
								children: e.message
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 font-mono text-[11px] text-faint",
								children: [formatWhen(e.at), t ? ` · ${t.title}` : ""]
							})]
						})]
					}, e.id);
				})]
			})
		]
	});
}
function Page() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gate, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActivityView, {}) });
}
//#endregion
export { Page as component };
