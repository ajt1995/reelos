import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as getTitle } from "./appliance-CsV_BBL_.mjs";
import { O as titleMatchesId, h as useReelStore, r as Route$2 } from "./router-DJXQsDxk.mjs";
import { f as jellyfinWatchHref, i as Gate } from "./gate-hkGl6LFk.mjs";
//#region ../../workspace/node_modules/.nitro/vite/services/ssr/assets/play._id-DlGLa5o-.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** Opens the working Jellyfin door (LAN/Tailscale IP:8096), never hostname:8096. */
function PlayerView({ id }) {
	const catalog = getTitle(id);
	const shelf = useReelStore((s) => s.shelf.find((t) => titleMatchesId(t, id)));
	const remote = useReelStore((s) => s.remoteTitles.find((t) => titleMatchesId(t, id) || t.id === id));
	const title = catalog ?? shelf ?? remote;
	const jfId = shelf?.jellyfinId;
	const ipv4 = useReelStore((s) => s.ipv4);
	const tailscaleIp = useReelStore((s) => s.tailscaleIp);
	const watch = useReelStore((s) => s.watch);
	(0, import_react.useEffect)(() => {
		const dest = jellyfinWatchHref({
			ipv4,
			tailscaleIp,
			watch,
			hostname: window.location.hostname,
			jellyfinId: jfId
		});
		if (dest) window.location.replace(dest);
	}, [
		jfId,
		ipv4,
		tailscaleIp,
		watch
	]);
	if (!title) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-dvh flex-col items-center justify-center px-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-muted",
			children: "Not in the library."
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/",
			className: "mt-4 text-gold",
			children: "Home"
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-dvh flex-col items-center justify-center px-6",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "text-sm text-muted",
			children: [
				"Opening Jellyfin for ",
				title.title,
				"…"
			]
		})
	});
}
function Page() {
	const { id } = Route$2.useParams();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gate, {
		chrome: false,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayerView, { id })
	});
}
//#endregion
export { Page as component };
