import { useEffect } from "react";
import { rememberCatalogTitles } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import { mergeServerRequests, overlayLibraryPresence, titleMatchesRemoved } from "@/lib/sync-requests";
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
          const removed = s.removedLibraryIds || [];
          const kept = live.filter((r) => !titleMatchesRemoved({ id: r.titleId, titleId: r.titleId }, removed));
          const requests = overlayLibraryPresence(mergeServerRequests(s.requests, kept), {
            titles: s.shelf,
          }).filter((r) => !titleMatchesRemoved({ id: r.titleId, titleId: r.titleId }, removed));
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
