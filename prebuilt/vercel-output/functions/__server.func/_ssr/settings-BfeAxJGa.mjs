import { S as require_jsx_runtime, d as useRouterState, m as Outlet } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as ReelOSWorld } from "./reelos-world-DIxxmkcq.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-BfeAxJGa.js
var import_jsx_runtime = require_jsx_runtime();
function Page() {
	return useRouterState({ select: (s) => s.location.pathname !== "/settings" && s.location.pathname !== "/settings/" }) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReelOSWorld, { initialView: "settings" });
}
//#endregion
export { Page as component };
