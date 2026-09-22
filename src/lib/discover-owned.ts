/** Home keeps the library. Discover hides titles this box already has. */

export type DiscoverOwnedTitle = {
  id?: string;
  ids?: string[];
  title?: string;
  name?: string;
  year?: number;
  kind?: string;
  mediaType?: string;
  jellyfinId?: string;
  releaseDate?: string;
  firstAirDate?: string;
};

export type DiscoverOwnedIndex = {
  ids: Set<string>;
  names: Set<string>;
};

export function discoverOwnedNameKey(t: DiscoverOwnedTitle | null | undefined): string {
  const kind = t?.kind === "tv" || t?.kind === "anime" || t?.mediaType === "tv" ? "tv" : "movie";
  const title = String(t?.title || t?.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const year = Number(t?.year) || Number(String(t?.releaseDate || t?.firstAirDate || "").slice(0, 4)) || 0;
  if (!title) return "";
  return `${kind}:${title}:${year || ""}`;
}

export function discoverOwnedIndex(
  titles: DiscoverOwnedTitle[] = [],
  requests: Array<{ id?: string; titleId?: string; title?: string; mediaType?: string }> = [],
): DiscoverOwnedIndex {
  const ids = new Set<string>();
  const names = new Set<string>();
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
  for (const r of requests) {
    if (r?.titleId) ids.add(String(r.titleId));
    if (r?.id) ids.add(String(r.id));
    const anyR = r as any;
    const extraId = anyR?.tmdbId || anyR?.media?.tmdbId || anyR?.tvdbId || anyR?.media?.tvdbId;
    if (extraId) ids.add(String(extraId));
    for (const rawId of [r?.titleId, r?.id, extraId]) {
      if (!rawId) continue;
      const sId = String(rawId);
      const numOnly = sId.replace(/^[a-z]+-/, "");
      if (numOnly && numOnly !== sId) {
        ids.add(numOnly);
        ids.add(`tmdb-${numOnly}`);
        ids.add(`tv-${numOnly}`);
        ids.add(`movie-${numOnly}`);
      } else if (/^\d+$/.test(sId)) {
        ids.add(`tmdb-${sId}`);
        ids.add(`tv-${sId}`);
        ids.add(`movie-${sId}`);
      }
    }
    if (r?.title) {
      const kind = r.mediaType === "tv" ? "tv" : "movie";
      const norm = String(r.title).toLowerCase().replace(/[^a-z0-9]+/g, "");
      if (norm) {
        names.add(`${kind}:${norm}:`);
        names.add(`movie:${norm}:`);
        names.add(`tv:${norm}:`);
      }
    }
  }
  return { ids, names };
}

export function asDiscoverOwned(
  exclude: DiscoverOwnedIndex | Set<string> | DiscoverOwnedTitle[] | null | undefined,
): DiscoverOwnedIndex {
  if (!exclude) return { ids: new Set(), names: new Set() };
  if (exclude instanceof Set) return { ids: exclude, names: new Set() };
  if (Array.isArray(exclude)) return discoverOwnedIndex(exclude);
  return {
    ids: exclude.ids instanceof Set ? exclude.ids : new Set(),
    names: exclude.names instanceof Set ? exclude.names : new Set(),
  };
}

/** JF-available / in-library / currently downloading — not for Discover. */
export function discoverTitleIsOwned(
  title: DiscoverOwnedTitle | null | undefined,
  owned: DiscoverOwnedIndex | Set<string> | DiscoverOwnedTitle[] | null | undefined,
): boolean {
  if (!title) return false;
  if (title.jellyfinId) return true;
  const index = asDiscoverOwned(owned);
  if (title.id && index.ids.has(String(title.id))) return true;
  for (const extra of title.ids || []) if (index.ids.has(String(extra))) return true;
  const key = discoverOwnedNameKey(title);
  if (key && index.names.has(key)) return true;
  const kind = title?.kind === "tv" || title?.kind === "anime" || title?.mediaType === "tv" ? "tv" : "movie";
  const normTitle = String(title?.title || title?.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (normTitle && (index.names.has(`${kind}:${normTitle}:`) || index.names.has(`movie:${normTitle}:`) || index.names.has(`tv:${normTitle}:`))) {
    return true;
  }
  return false;
}

export function filterDiscoverCatalog<T extends DiscoverOwnedTitle>(
  titles: T[],
  library: DiscoverOwnedTitle[],
  extraSkipIds: Iterable<string> = [],
  requests: Array<{ id?: string; titleId?: string; title?: string; mediaType?: string }> = [],
): T[] {
  const owned = discoverOwnedIndex(library, requests);
  for (const id of extraSkipIds) if (id) owned.ids.add(String(id));
  return titles.filter((t) => !discoverTitleIsOwned(t, owned));
}
