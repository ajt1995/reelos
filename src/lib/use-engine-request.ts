import { useEffect, useState } from "react";
import { useReelStore } from "@/lib/store";

/** Poll GET /api/request; sync status + progress into the matching store row. */
export function useEngineRequest(id: string) {
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
          library: s.library.includes(id) ? s.library : [...s.library, id],
        }));
      })
      .catch(() => {});
    const q = `id=${encodeURIComponent(id)}`;
    let stop = false;
    const poll = () => {
      void fetch(`/api/request?${q}`, { cache: "no-store" })
        .then((r) => r.json() as Promise<{ status?: string; progress?: number; percent?: number }>)
        .then((j) => {
          if (stop) return;
          setEngineStatus(j.status || null);
          const mapped =
            j.status === "downloaded"
              ? "available"
              : j.status === "grabbing"
                ? "downloading"
                : j.status === "failed"
                  ? "failed"
                  : j.status === "queued"
                    ? "waiting"
                    : null;
          const apiProg =
            typeof j.progress === "number"
              ? j.progress
              : typeof j.percent === "number"
                ? j.percent
                : undefined;
          if (!mapped && apiProg == null) return;
          useReelStore.setState((s) => ({
            requests: s.requests.map((x) => {
              if (x.titleId !== id || x.status === "failed") return x;
              const status = (mapped as typeof x.status) || x.status;
              if (x.status === "available" && status !== "available") return x;
              const progress =
                status === "available"
                  ? 100
                  : typeof apiProg === "number"
                    ? Math.max(0, Math.min(100, Math.round(apiProg)))
                    : x.progress;
              return { ...x, status, progress, updatedAt: Date.now() };
            }),
            library:
              mapped === "available" && !s.library.includes(id) ? [...s.library, id] : s.library,
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
  }, [id]);

  return { inJellyfin, engineStatus };
}
