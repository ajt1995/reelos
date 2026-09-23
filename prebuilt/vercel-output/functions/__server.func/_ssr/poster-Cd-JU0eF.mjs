import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { E as cn } from "./router-M-yvs45k.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/poster-Cd-JU0eF.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function posterInitial(title) {
	return String(title?.title || "").replace(/^[^A-Za-z0-9]+/, "").charAt(0).toUpperCase() || "•";
}
function Poster({ title, className, sizes = "poster", placeholder = "letter" }) {
	const src = String(title?.poster || "").trim();
	const [ok, setOk] = (0, import_react.useState)(Boolean(src));
	const [loaded, setLoaded] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		setOk(Boolean(src));
		setLoaded(false);
	}, [src]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("relative w-full min-h-0 min-w-0 max-w-full overflow-hidden bg-card-2", sizes === "poster" ? "aspect-[2/3]" : "aspect-[16/9]", className),
		children: [src && ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			src,
			alt: "",
			loading: "lazy",
			decoding: "async",
			className: cn("poster absolute inset-0 size-full object-cover transition-opacity duration-200", loaded ? "opacity-100" : "opacity-0"),
			onLoad: () => setLoaded(true),
			onError: () => setOk(false)
		}) : null, !loaded ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: cn("absolute inset-0 flex items-center justify-center", src && ok ? "shimmer-skeleton" : "bg-linear-to-br from-card-2 via-card to-background"),
			"aria-hidden": true,
			children: placeholder === "letter" && (!src || !ok) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-display text-xl sm:text-2xl font-medium text-muted/70",
				children: posterInitial(title)
			}) : null
		}) : null]
	});
}
//#endregion
export { Poster as t };
