import type { Title } from "./types";

/** Limited Home fetches must not shrink a larger Library shelf. */
export function mergeShelf(prev: Title[], next: Title[], limited: boolean): Title[] {
  if (!limited) return next;
  if (!prev.length) return next;
  const have = new Set(next.map((t) => t.id));
  return [...next, ...prev.filter((t) => !have.has(t.id))];
}
