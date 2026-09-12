/** Client filter for Discover Not interested. Library/Home do not import this. */

export type CuratorTitle = {
  id?: string;
  ids?: string[];
  jellyfinId?: string;
};

export function curatorTitleKeys(title: CuratorTitle | string | null | undefined): string[] {
  if (title == null) return [];
  if (typeof title === "string") return title.trim() ? [title.trim()] : [];
  const keys = new Set<string>();
  for (const x of [title.id, title.jellyfinId, ...(title.ids || [])]) {
    const s = String(x || "").trim();
    if (s) keys.add(s);
  }
  return [...keys];
}

export function titleIsCuratorHidden(title: CuratorTitle | null | undefined, hidden: Iterable<string>): boolean {
  const set = hidden instanceof Set ? hidden : new Set([...hidden].map(String));
  if (!set.size) return false;
  return curatorTitleKeys(title).some((k) => set.has(k));
}

export function filterCuratorHidden<T extends CuratorTitle>(titles: T[], hidden: Iterable<string>): T[] {
  const set = hidden instanceof Set ? hidden : new Set([...hidden].map(String));
  if (!set.size) return titles;
  return titles.filter((t) => !titleIsCuratorHidden(t, set));
}
