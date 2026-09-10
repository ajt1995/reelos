import { useEffect } from "react";
import { rememberCatalogTitles } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import { mergeServerRequests, overlayLibraryPresence } from "@/lib/sync-requests";
import type { MediaRequest, Title } from "@/lib/types";

/** Pull GET /api/request (list) into the persisted store. Home + Requests both call this. */
export function useSyncRequests() {
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const j = (await fetch("/api/request", { cache: "no-store" }).then((res) => res.json())) as {
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
            libraryIds: s.library,
            titles: s.shelf,
          });
          const extra = requests.filter((r) => r.status === "available").map((r) => r.titleId);
          return {
            requests,
            library: extra.length ? [...new Set([...s.library, ...extra])] : s.library,
          };
        });
      } catch {
        /* Seerr down — keep local rows */
      }
    };
    const start = window.setTimeout(() => void tick(), 1500);
    const id = window.setInterval(() => void tick(), 15000);
    return () => {
      stop = true;
      window.clearTimeout(start);
      window.clearInterval(id);
    };
  }, []);
}
