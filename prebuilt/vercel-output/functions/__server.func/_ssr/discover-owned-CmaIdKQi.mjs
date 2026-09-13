//#region node_modules/.nitro/vite/services/ssr/assets/discover-owned-CmaIdKQi.js
function discoverOwnedNameKey(t) {
	const kind = t?.kind === "tv" || t?.kind === "anime" || t?.mediaType === "tv" ? "tv" : "movie";
	const title = String(t?.title || t?.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
	const year = Number(t?.year) || Number(String(t?.releaseDate || t?.firstAirDate || "").slice(0, 4)) || 0;
	if (!title) return "";
	return `${kind}:${title}:${year || ""}`;
}
function discoverOwnedIndex(titles = []) {
	const ids = /* @__PURE__ */ new Set();
	const names = /* @__PURE__ */ new Set();
	for (const t of titles) {
		if (t?.id) ids.add(String(t.id));
		for (const extra of t?.ids || []) if (extra) ids.add(String(extra));
		if (t?.jellyfinId) {
			ids.add(String(t.jellyfinId));
			ids.add(`jf-${t.jellyfinId}`);
		}
		const key = discoverOwnedNameKey(t);
		if (key) names.add(key);
	}
	return {
		ids,
		names
	};
}
function asDiscoverOwned(exclude) {
	if (!exclude) return {
		ids: /* @__PURE__ */ new Set(),
		names: /* @__PURE__ */ new Set()
	};
	if (exclude instanceof Set) return {
		ids: exclude,
		names: /* @__PURE__ */ new Set()
	};
	if (Array.isArray(exclude)) return discoverOwnedIndex(exclude);
	return {
		ids: exclude.ids instanceof Set ? exclude.ids : /* @__PURE__ */ new Set(),
		names: exclude.names instanceof Set ? exclude.names : /* @__PURE__ */ new Set()
	};
}
/** JF-available / in-library — not in-progress Requests. */
function discoverTitleIsOwned(title, owned) {
	if (!title) return false;
	if (title.jellyfinId) return true;
	const index = asDiscoverOwned(owned);
	if (title.id && index.ids.has(String(title.id))) return true;
	for (const extra of title.ids || []) if (index.ids.has(String(extra))) return true;
	const key = discoverOwnedNameKey(title);
	return Boolean(key && index.names.has(key));
}
function filterDiscoverCatalog(titles, library, extraSkipIds = []) {
	const owned = discoverOwnedIndex(library);
	for (const id of extraSkipIds) if (id) owned.ids.add(String(id));
	return titles.filter((t) => !discoverTitleIsOwned(t, owned));
}
//#endregion
export { filterDiscoverCatalog as t };
