import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as rememberCatalogTitles } from "./appliance-Dk74LcNF.mjs";
import { _ as useReelStore, i as Route$3 } from "./router-mM1Mn5a3.mjs";
import { i as Gate } from "./gate-Bgio5WT8.mjs";
import { t as PresenceRow } from "./presence-row-CZyXy9yv.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/person._id-BVr635lR.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function PersonView({ id }) {
	const [payload, setPayload] = (0, import_react.useState)(null);
	const rememberTitles = useReelStore((s) => s.rememberTitles);
	(0, import_react.useEffect)(() => {
		let stop = false;
		const ac = new AbortController();
		setPayload(null);
		fetch(`/api/person?id=${encodeURIComponent(id)}`, {
			cache: "no-store",
			signal: ac.signal
		}).then((r) => r.json()).then((j) => {
			if (stop) return;
			const credits = Array.isArray(j.person?.credits) ? j.person.credits : [];
			rememberCatalogTitles(credits);
			rememberTitles?.(credits);
			setPayload(j);
		}).catch((e) => {
			if (!stop) setPayload({
				person: null,
				error: String(e?.message || e)
			});
		});
		return () => {
			stop = true;
			ac.abort();
		};
	}, [id, rememberTitles]);
	const person = payload?.person;
	const credits = person?.credits || [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "px-5 pb-16 pt-4 md:px-10",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/",
			className: "text-sm text-gold",
			children: "Home"
		}), !payload ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-8 text-sm text-muted",
			children: "Loading filmography…"
		}) : !person ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-8 text-sm text-danger",
			children: payload.error || "TMDB has no person with that id."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 flex items-start gap-4",
				children: [person.poster ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: person.poster,
					alt: "",
					className: "size-24 shrink-0 rounded-full object-cover shadow-[var(--shadow-border)]"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-24 shrink-0 rounded-full bg-card-2" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 pt-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs tracking-[0.18em] text-gold uppercase",
							children: person.knownForDepartment === "Acting" || !person.knownForDepartment ? "Actor" : person.knownForDepartment
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "mt-1 font-display text-2xl font-semibold tracking-tight",
							children: person.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 text-sm text-muted",
							children: [
								person.onBox ?? credits.filter((t) => t.inLibrary).length,
								" of ",
								credits.length,
								" on this box"
							]
						})
					]
				})]
			}),
			person.biography ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-5 max-w-xl text-[15px] leading-relaxed text-muted",
				children: person.biography
			}) : null,
			credits.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-6",
				children: credits.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PresenceRow, { title: t }, t.id))
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-6 text-sm text-muted",
				children: "TMDB listed no movie or show credits."
			})
		] })]
	});
}
function Page() {
	const { id } = Route$3.useParams();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gate, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PersonView, { id }) });
}
//#endregion
export { Page as component };
