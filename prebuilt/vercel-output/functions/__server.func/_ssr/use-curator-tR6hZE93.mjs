import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-curator-tR6hZE93.js
var import_react = /* @__PURE__ */ __toESM(require_react());
function curatorTitleKeys(title) {
	if (title == null) return [];
	if (typeof title === "string") return title.trim() ? [title.trim()] : [];
	const keys = /* @__PURE__ */ new Set();
	for (const x of [
		title.id,
		title.jellyfinId,
		...title.ids || []
	]) {
		const s = String(x || "").trim();
		if (s) keys.add(s);
	}
	return [...keys];
}
function titleIsCuratorHidden(title, hidden) {
	const set = hidden instanceof Set ? hidden : new Set([...hidden].map(String));
	if (!set.size) return false;
	return curatorTitleKeys(title).some((k) => set.has(k));
}
function titleIsCuratorLiked(title, liked) {
	const set = liked instanceof Set ? liked : new Set([...liked].map(String));
	if (!set.size) return false;
	return curatorTitleKeys(title).some((k) => set.has(k));
}
function filterCuratorHidden(titles, hidden) {
	const set = hidden instanceof Set ? hidden : new Set([...hidden].map(String));
	if (!set.size) return titles;
	return titles.filter((t) => !titleIsCuratorHidden(t, set));
}
function useCurator() {
	const [hiddenIds, setHiddenIds] = (0, import_react.useState)([]);
	const [likedIds, setLikedIds] = (0, import_react.useState)([]);
	const apply = (0, import_react.useCallback)((j) => {
		if (Array.isArray(j.hidden)) setHiddenIds(j.hidden);
		if (Array.isArray(j.liked)) setLikedIds(j.liked);
	}, []);
	(0, import_react.useEffect)(() => {
		fetch("/api/curator", { cache: "no-store" }).then((r) => r.json()).then(apply).catch(() => {});
	}, [apply]);
	return {
		hiddenIds,
		likedIds,
		voteTitle: (0, import_react.useCallback)((title, vote) => {
			const extra = [title.id, ...title.ids || []].filter(Boolean);
			if (vote === "like") {
				setLikedIds((cur) => [.../* @__PURE__ */ new Set([...cur, ...extra])]);
				setHiddenIds((cur) => cur.filter((id) => !extra.includes(id)));
			} else if (vote === "dislike") {
				setHiddenIds((cur) => [.../* @__PURE__ */ new Set([...cur, ...extra])]);
				setLikedIds((cur) => cur.filter((id) => !extra.includes(id)));
			} else {
				setHiddenIds((cur) => cur.filter((id) => !extra.includes(id)));
				setLikedIds((cur) => cur.filter((id) => !extra.includes(id)));
			}
			fetch("/api/curator", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: title.id,
					ids: title.ids,
					jellyfinId: title.jellyfinId,
					title: title.title,
					vote
				})
			}).then((r) => r.json()).then(apply).catch(() => {});
		}, [apply])
	};
}
//#endregion
export { useCurator as i, titleIsCuratorHidden as n, titleIsCuratorLiked as r, filterCuratorHidden as t };
