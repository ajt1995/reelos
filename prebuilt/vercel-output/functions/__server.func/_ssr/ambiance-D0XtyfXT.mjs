import { S as require_jsx_runtime, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { Tt as Clock3, Ut as ArrowLeft } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ambiance-D0XtyfXT.js
var import_jsx_runtime = require_jsx_runtime();
function LaterReleaseView({ title, detail }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "mx-auto flex min-h-dvh w-full max-w-3xl items-center px-5 py-16 md:px-10",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "w-full rounded-[2rem] border border-white/8 bg-card/55 p-7 shadow-[var(--shadow-border)] backdrop-blur-xl md:p-10",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "grid size-12 place-items-center rounded-full bg-white/7 text-gold",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock3, {
						className: "size-5",
						"aria-hidden": "true"
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-7 text-xs font-semibold uppercase tracking-[.18em] text-gold",
					children: "Later release"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl",
					children: title
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-5 max-w-2xl text-base leading-7 text-muted",
					children: detail
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 max-w-2xl text-sm leading-6 text-muted",
					children: "Nothing has been applied or simulated on this device."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-8 flex flex-wrap gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/settings/advanced",
						className: "inline-flex min-h-12 items-center rounded-full bg-white px-6 text-sm font-semibold text-black",
						children: "See feature status"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/settings",
						className: "inline-flex min-h-12 items-center gap-2 rounded-full border border-white/12 px-5 text-sm text-foreground/85",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, {
							className: "size-4",
							"aria-hidden": "true"
						}), "Settings"]
					})]
				})
			]
		})
	});
}
function Page() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LaterReleaseView, {
		title: "Room ambiance is not available yet.",
		detail: "Connected lights and phone-guided room sound tuning are planned beyond the current household release. The approved standby artwork experience remains separate and unchanged."
	});
}
//#endregion
export { Page as component };
