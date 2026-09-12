import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as rememberCatalogTitles } from "./appliance-Dk74LcNF.mjs";
import { h as useReelStore, o as Route$5 } from "./router-BmL0jyLk.mjs";
import { i as Gate } from "./gate-DR2vtzkr.mjs";
import { t as PresenceRow } from "./presence-row-ChkHEGle.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/collection._id-CapG6Apf.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function CollectionView({ id }) {
	const [payload, setPayload] = (0, import_react.useState)(null);
	const rememberTitles = useReelStore((s) => s.rememberTitles);
	(0, import_react.useEffect)(() => {
		let stop = false;
		const ac = new AbortController();
		setPayload(null);
		fetch(`/api/collection?id=${encodeURIComponent(id)}`, {
			cache: "no-store",
			signal: ac.signal
		}).then((r) => r.json()).then((j) => {
			if (stop) return;
			const parts = Array.isArray(j.collection?.parts) ? j.collection.parts : [];
			rememberCatalogTitles(parts);
			rememberTitles?.(parts);
			setPayload(j);
		}).catch((e) => {
			if (!stop) setPayload({
				collection: null,
				error: String(e?.message || e)
			});
		});
		return () => {
			stop = true;
			ac.abort();
		};
	}, [id, rememberTitles]);
	const collection = payload?.collection;
	const parts = collection?.parts || [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "px-5 pb-16 pt-4 md:px-10",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/",
			className: "text-sm text-gold",
			children: "Home"
		}), !payload ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-8 text-sm text-muted",
			children: "Loading collection…"
		}) : !collection ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-8 text-sm text-danger",
			children: payload.error || "TMDB has no collection with that id."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 flex items-start gap-4",
				children: [collection.poster ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: collection.poster,
					alt: "",
					className: "h-36 w-24 shrink-0 rounded-xl object-cover shadow-[var(--shadow-border)]"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-36 w-24 shrink-0 rounded-xl bg-card-2" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 pt-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs tracking-[0.18em] text-gold uppercase",
							children: "Collection"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "mt-1 font-display text-2xl font-semibold tracking-tight",
							children: collection.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 text-sm text-muted",
							children: [
								collection.onBox ?? parts.filter((p) => p.inLibrary).length,
								" of ",
								parts.length,
								" on this box"
							]
						})
					]
				})]
			}),
			collection.overview ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-5 max-w-xl text-[15px] leading-relaxed text-muted",
				children: collection.overview
			}) : null,
			parts.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-6",
				children: parts.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PresenceRow, { title: t }, t.id))
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-6 text-sm text-muted",
				children: "TMDB listed no movies in this collection."
			})
		] })]
	});
}
function Page() {
	const { id } = Route$5.useParams();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gate, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CollectionView, { id }) });
}
//#endregion
export { Page as component };
