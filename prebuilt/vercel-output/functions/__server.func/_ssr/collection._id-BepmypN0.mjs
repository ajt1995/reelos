import { S as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as Route$8 } from "./router-2BoRtkQZ.mjs";
import { t as ReelOSWorld } from "./reelos-world-DIxxmkcq.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/collection._id-BepmypN0.js
var import_jsx_runtime = require_jsx_runtime();
function Page() {
	const { id } = Route$8.useParams();
	const { name, titles } = Route$8.useSearch();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReelOSWorld, { initialDestination: {
		type: "collection",
		id,
		name,
		titleIds: titles?.split(",").filter(Boolean).slice(0, 80)
	} });
}
//#endregion
export { Page as component };
