import { useEffect } from "react";
import { rememberCatalogTitles } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import { isGhostRequestLabel, mergeServerRequests, overlayLibraryPresence, titleForRequest } from "@/lib/sync-requests";
import type { MediaRequest, Title } from "@/lib/types";

/** Pull GET /api/request (list) into the persisted store. Home + Requests both call this.
 *  Every poll sends recover=1. Server cooldown + in-flight guard keep kicks from piling up.
 *  Recover must not block the list — mailman returns the rows first. */
export function useSyncRequests() {
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const j = (await fetch("/api/request?recover=1", { cache: "no-store" }).then((res) => res.json())) as {
          requests?: MediaRequest[];
          titles?: Title[];
        };
        if (stop) return;
        const titles = Array.isArray(j.titles) ? j.titles : [];
        rememberCatalogTitles(titles);
        useReelStore.getState().rememberTitles?.(titles);
        const live = Array.isArray(j.requests) ? j.requests : [];
        useReelStore.setState((s) => {
          const requests = overlayLibraryPresence(mergeServerRequests(s.requests, live), {
            titles: [...s.shelf, ...s.remoteTitles],
          });
          return { requests };
        });
      } catch {
        /* Seerr down — keep local rows */
      }
    };
    const seeded = useReelStore.getState().requestsSeeded;
    const start = window.setTimeout(() => void tick(), seeded ? 0 : 1500);
    const id = window.setInterval(() => void tick(), 15000);
    return () => {
      stop = true;
      window.clearTimeout(start);
      window.clearInterval(id);
    };
  }, []);
}

/** Lookup posters/names for inflight rows that still paint as tmdb-2059. */
export function useResolveGhostRequestTitles(requests: MediaRequest[], titles: Title[]) {
  const rememberTitles = useReelStore((s) => s.rememberTitles);
  const ids = [
    ...new Set(
      requests
        .filter((r) => {
          const t = titleForRequest(r, titles);
          return isGhostRequestLabel(t.title, t.id) || !t.poster;
        })
        .map((r) => r.titleId)
        .filter(Boolean),
    ),
  ].slice(0, 8);
  const key = ids.join("|");
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    for (const id of key.split("|")) {
      void fetch(`/api/lookup?id=${encodeURIComponent(id)}`, { cache: "no-store" })
        .then(async (res) => {
          if (!res.ok) return null;
          return res.json() as Promise<{ titles?: Title[] }>;
        })
        .then((j) => {
          if (cancelled || !j) return;
          const list = Array.isArray(j.titles) ? j.titles : [];
          rememberCatalogTitles(list);
          rememberTitles?.(list);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [key, rememberTitles]);
}
