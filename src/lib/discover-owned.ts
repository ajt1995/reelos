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

export function discoverOwnedIndex(titles: DiscoverOwnedTitle[] = []): DiscoverOwnedIndex {
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

/** JF-available / in-library — not in-progress Requests. */
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
  return Boolean(key && index.names.has(key));
}

export function filterDiscoverCatalog<T extends DiscoverOwnedTitle>(
  titles: T[],
  library: DiscoverOwnedTitle[],
  extraSkipIds: Iterable<string> = [],
): T[] {
  const owned = discoverOwnedIndex(library);
  for (const id of extraSkipIds) if (id) owned.ids.add(String(id));
  return titles.filter((t) => !discoverTitleIsOwned(t, owned));
}
