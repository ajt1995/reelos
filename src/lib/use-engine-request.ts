import { useEffect, useState } from "react";
import { applyTitleRequestPoll } from "@/lib/sync-requests";
import { useReelStore } from "@/lib/store";

/** Poll GET /api/request; sync status + progress into the matching title+season row. */
export function useEngineRequest(id: string, season?: number) {
  const [inJellyfin, setInJellyfin] = useState(false);
  const [engineStatus, setEngineStatus] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/library", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ titles?: { id: string; ids?: string[] }[] }>)
      .then((j) => {
        const hit = (j.titles || []).some((t) => {
          const ids = [t.id, ...(t.ids || [])];
          if (ids.includes(id)) return true;
          if (id.startsWith("tmdb-tv-")) return ids.includes(`tmdb-${id.slice(8)}`);
          return false;
        });
        setInJellyfin(hit);
        if (!hit || id.startsWith("tmdb-tv-")) return;
        useReelStore.setState((s) => ({
          requests: s.requests.map((x) =>
            x.titleId === id && x.status !== "available" && x.season == null
              ? { ...x, status: "available", progress: 100, updatedAt: Date.now() }
              : x,
          ),
        }));
      })
      .catch(() => {});
    const q = new URLSearchParams({ id });
    if (season != null) q.set("season", String(season));
    let stop = false;
    const poll = () => {
      void fetch(`/api/request?${q}`, { cache: "no-store" })
        .then((r) => r.json() as Promise<{ status?: string; progress?: number; percent?: number; reason?: string }>)
        .then((j) => {
          if (stop) return;
          setEngineStatus(j.status || null);
          const apiProg =
            typeof j.progress === "number"
              ? j.progress
              : typeof j.percent === "number"
                ? j.percent
                : undefined;
          useReelStore.setState((s) => ({
            requests: applyTitleRequestPoll(s.requests, {
              titleId: id,
              season,
              status: j.status,
              progress: apiProg,
              reason: j.reason,
            }),
          }));
        })
        .catch(() => {});
    };
    poll();
    const timer = window.setInterval(poll, 8000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [id, season]);

  return { inJellyfin, engineStatus };
}
