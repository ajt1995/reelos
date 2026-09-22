import { S as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as Route$3 } from "./router-2BoRtkQZ.mjs";
import { t as ReelOSWorld } from "./reelos-world-DIxxmkcq.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/person._id-CBOv3uUe.js
var import_jsx_runtime = require_jsx_runtime();
function Page() {
	const { id } = Route$3.useParams();
	const { name } = Route$3.useSearch();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReelOSWorld, { initialDestination: {
		type: "person",
		id,
		name
	} });
}
//#endregion
export { Page as component };
