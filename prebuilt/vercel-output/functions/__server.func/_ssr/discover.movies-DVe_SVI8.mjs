import { S as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as Route$6 } from "./router-BN1QAJlL.mjs";
import { t as DiscoverBrowseView } from "./discover-browse-view-CLQLxQUA.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/discover.movies-DVe_SVI8.js
var import_jsx_runtime = require_jsx_runtime();
function Page() {
	const { genre, category } = Route$6.useSearch();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscoverBrowseView, {
		kind: "movie",
		genre,
		category
	});
}
//#endregion
export { Page as component };
