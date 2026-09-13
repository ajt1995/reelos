import { S as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as Route$5 } from "./router-D4zanu1c.mjs";
import { t as DiscoverBrowseView } from "./discover-browse-view-BCZ1rKZB.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/discover.shows-D5z2PWT1.js
var import_jsx_runtime = require_jsx_runtime();
function Page() {
	const { genre, category } = Route$5.useSearch();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscoverBrowseView, {
		kind: "tv",
		genre,
		category
	});
}
//#endregion
export { Page as component };
