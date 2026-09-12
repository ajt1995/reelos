import { requestMediaTypeForPage, requestTitleIdForPage, titlePresenceKeys } from "./sync-requests";
import type { Title } from "@/lib/types";

/** POST /api/request for a collection/filmography row. Person and collection ids never go here. */
export function requestBodyForTitle(title: Title, season?: number) {
  if (!title?.id) return null;
  const extra = titlePresenceKeys(title.id, title.ids || []);
  const titleId = requestTitleIdForPage(title.id, title.kind, extra);
  if (!titleId || titleId.startsWith("person-") || titleId.startsWith("collection-")) return null;
  const mediaType = requestMediaTypeForPage(titleId, title.kind);
  const tmdbRaw =
    mediaType === "tv"
      ? titleId.startsWith("tmdb-tv-")
        ? titleId.slice(8)
        : extra.find((k) => k.startsWith("tmdb-tv-"))?.slice(8) || extra.find((k) => /^tmdb-\d/.test(k))?.slice(5)
      : titleId.startsWith("tmdb-") && !titleId.startsWith("tmdb-tv-")
        ? titleId.slice(5)
        : extra.find((k) => /^tmdb-\d/.test(k) && !k.startsWith("tmdb-tv-"))?.slice(5);
  const tmdb = Number(tmdbRaw);
  if (!Number.isFinite(tmdb) || tmdb <= 0) return null;
  return {
    titleId,
    title: title.title,
    mediaType,
    tmdb,
    season: mediaType === "tv" ? (Number(season) > 0 ? Number(season) : 1) : undefined,
  };
}

export async function postTitleRequest(title: Title, season?: number) {
  const body = requestBodyForTitle(title, season);
  if (!body) return { ok: false, error: "Need a TMDB movie or show id to Request." };
  const res = await fetch("/api/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!res.ok || !j?.ok) return { ok: false, error: j?.error || `request ${res.status}` };
  return { ok: true as const };
}
