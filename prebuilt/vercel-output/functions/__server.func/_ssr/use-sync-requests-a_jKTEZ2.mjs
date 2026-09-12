import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { c as rememberCatalogTitles } from "./appliance-Dk74LcNF.mjs";
import { C as mergeServerRequests, E as requestNeedsLibraryHandoff, _ as useReelStore, j as titleForRequest, w as overlayLibraryPresence, x as isGhostRequestLabel } from "./router-CqcOw5hF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-sync-requests-a_jKTEZ2.js
var import_react = /* @__PURE__ */ __toESM(require_react());
/** Pull GET /api/request (list) into the persisted store. Home + Requests both call this.
*  Every poll sends recover=1. Server cooldown + in-flight guard keep kicks from piling up.
*  Recover must not block the list — mailman returns the rows first. */
function useSyncRequests() {
	(0, import_react.useEffect)(() => {
		let stop = false;
		const tick = async () => {
			try {
				const j = await fetch("/api/request?recover=1", { cache: "no-store" }).then((res) => res.json());
				if (stop) return;
				const titles = Array.isArray(j.titles) ? j.titles : [];
				rememberCatalogTitles(titles);
				useReelStore.getState().rememberTitles?.(titles);
				const live = Array.isArray(j.requests) ? j.requests : [];
				useReelStore.setState((s) => {
					const overlayTitles = [...s.shelf, ...titles];
					return { requests: overlayLibraryPresence(mergeServerRequests(s.requests, live), { titles: overlayTitles }) };
				});
				const s = useReelStore.getState();
				if (s.requests.some((r) => requestNeedsLibraryHandoff(r, { titles: s.shelf }))) s.hydrateShelf({
					force: true,
					fresh: true
				});
			} catch {}
		};
		const seeded = useReelStore.getState().requestsSeeded;
		const start = window.setTimeout(() => void tick(), seeded ? 0 : 1500);
		const id = window.setInterval(() => void tick(), 15e3);
		return () => {
			stop = true;
			window.clearTimeout(start);
			window.clearInterval(id);
		};
	}, []);
}
/** Lookup posters/names for inflight rows that still paint as tmdb-2059. */
function useResolveGhostRequestTitles(requests, titles) {
	const rememberTitles = useReelStore((s) => s.rememberTitles);
	const key = [...new Set(requests.filter((r) => {
		const t = titleForRequest(r, titles);
		return isGhostRequestLabel(t.title, t.id) || !t.poster;
	}).map((r) => r.titleId).filter(Boolean))].slice(0, 8).join("|");
	(0, import_react.useEffect)(() => {
		if (!key) return;
		let cancelled = false;
		for (const id of key.split("|")) fetch(`/api/lookup?id=${encodeURIComponent(id)}`, { cache: "no-store" }).then(async (res) => {
			if (!res.ok) return null;
			return res.json();
		}).then((j) => {
			if (cancelled || !j) return;
			const list = Array.isArray(j.titles) ? j.titles : [];
			rememberCatalogTitles(list);
			rememberTitles?.(list);
		}).catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [key, rememberTitles]);
}
//#endregion
export { useSyncRequests as n, useResolveGhostRequestTitles as t };
