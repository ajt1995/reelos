import { S as require_jsx_runtime, y as Navigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { m as useHouseholdProfile } from "./gate-CTesRm1X.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/kids-lock-2urX_v5H.js
var import_jsx_runtime = require_jsx_runtime();
/** Kids profile cannot open Request or Settings. Adult/admin still can. */
function KidsLock({ children }) {
	const { kids, profile } = useHouseholdProfile();
	if (profile && kids) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, { to: "/" });
	return children;
}
//#endregion
export { KidsLock as t };
