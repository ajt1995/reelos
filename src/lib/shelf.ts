import type { Title } from "./types";

export function looksLikeHashTitle(name?: string) {
  return /^[0-9a-f]{32,64}$/i.test(String(name || "").trim());
}

export function isHashDumpCard(t?: Pick<Title, "id" | "title" | "year" | "poster" | "fromHashDump"> | null) {
  if (!t) return false;
  if (looksLikeHashTitle(t.title) || looksLikeHashTitle(t.id)) return true;
  if (t.fromHashDump && !(Number(t.year) > 0 && t.poster)) return true;
  return false;
}

function titleAliasIds(t: Pick<Title, "id" | "ids" | "jellyfinId">): string[] {
  return [t.id, ...(t.ids || []), t.jellyfinId, t.jellyfinId ? `jf-${t.jellyfinId}` : ""]
    .filter(Boolean)
    .map(String);
}

function normName(title?: string) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** Drop hash-named / year-0 empty posters when the same files are a named show. */
export function homeShelfRows(titles: Title[]): Title[] {
  const list = (titles || []).filter(Boolean);
  const named = list.filter(
    (t) => !isHashDumpCard(t) && t.title && t.title !== "Unknown on this box" && !looksLikeHashTitle(t.title),
  );
  const namedIds = new Set(named.flatMap(titleAliasIds));
  const namedNames = new Set(named.map((t) => normName(t.title)).filter(Boolean));
  return list.filter((t) => {
    if (looksLikeHashTitle(t.title) || looksLikeHashTitle(t.id)) {
      return false;
    }
    if (isHashDumpCard(t)) {
      if (titleAliasIds(t).some((id) => namedIds.has(id))) return false;
      const name = normName(t.title);
      if (name && namedNames.has(name)) return false;
      if (!(Number(t.year) > 0) && !t.poster) return false;
    }
    return true;
  });
}

/** Limited Home fetches must not shrink a larger Library shelf — or resurrect a hash leftover. */
export function mergeShelf(prev: Title[], next: Title[], limited: boolean): Title[] {
  const incoming = homeShelfRows(next);
  if (!limited) return incoming;
  if (!prev.length) return incoming;
  const have = new Set(incoming.flatMap(titleAliasIds));
  const extra = homeShelfRows(prev).filter((t) => !titleAliasIds(t).some((k) => have.has(k)));
  return homeShelfRows([...incoming, ...extra]);
}
