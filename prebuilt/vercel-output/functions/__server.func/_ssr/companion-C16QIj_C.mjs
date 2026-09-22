import { S as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { d as parseCompanionDeepLink, l as Route$22 } from "./router-2BoRtkQZ.mjs";
import { t as ReelOSWorld } from "./reelos-world-DIxxmkcq.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/companion-C16QIj_C.js
var import_jsx_runtime = require_jsx_runtime();
function Page() {
	const search = Route$22.useSearch();
	const companionLink = parseCompanionDeepLink(search);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReelOSWorld, {
		initialView: "companion",
		initialCompanionLink: companionLink
	});
}
//#endregion
export { Page as component };
