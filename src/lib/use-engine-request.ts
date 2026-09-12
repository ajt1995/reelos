import { useEffect, useState } from "react";
import { applyTitleRequestPoll, titleMatchesId, titlePresenceKeys } from "@/lib/sync-requests";
import { useReelStore } from "@/lib/store";

function seasonNumbersFrom(raw?: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
}

/** Poll GET /api/request; sync status + progress into the matching title+season row. */
export function useEngineRequest(id: string, season?: number) {
  const [inJellyfin, setInJellyfin] = useState(false);
  const [engineStatus, setEngineStatus] = useState<string | null>(null);
  const [seasonList, setSeasonList] = useState<number[]>([]);
  const [onDiskSeasons, setOnDiskSeasons] = useState<number[]>([]);
  const [extraIds, setExtraIds] = useState<string[]>(() => titlePresenceKeys(id));

  useEffect(() => {
    let aliases = titlePresenceKeys(id);
    let stop = false;
    const ac = new AbortController();
    void fetch("/api/library", { cache: "no-store", signal: ac.signal })
      .then((r) => r.json() as Promise<{ titles?: { id: string; ids?: string[]; jellyfinId?: string }[] }>)
      .then((j) => {
        if (stop) return;
        const hit = (j.titles || []).find((t) => titleMatchesId(t, id));
        setInJellyfin(Boolean(hit));
        if (hit) {
          aliases = [...new Set([...aliases, ...titlePresenceKeys(hit.id, hit.ids || [])])];
          setExtraIds(aliases);
        }
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
    const poll = () => {
      void fetch(`/api/request?${q}`, { cache: "no-store", signal: ac.signal })
        .then((r) => r.json() as Promise<{
          status?: string;
          progress?: number;
          percent?: number;
          reason?: string;
          titleId?: string;
          seasonList?: number[];
          onDiskSeasons?: number[];
          seasons?: number;
        }>)
        .then((j) => {
          if (stop) return;
          setEngineStatus(j.status || null);
          const fromApi = seasonNumbersFrom(j.seasonList);
          if (fromApi.length) setSeasonList(fromApi);
          const disk = seasonNumbersFrom(j.onDiskSeasons);
          if (disk.length) setOnDiskSeasons(disk);
          const pollIds = [...aliases, j.titleId || ""].filter(Boolean);
          const apiProg =
            typeof j.progress === "number"
              ? j.progress
              : typeof j.percent === "number"
                ? j.percent
                : undefined;
          useReelStore.setState((s) => ({
            requests: applyTitleRequestPoll(s.requests, {
              titleId: id,
              extraIds: pollIds,
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
      ac.abort();
      window.clearInterval(timer);
    };
  }, [id, season]);

  return { inJellyfin, engineStatus, seasonList, onDiskSeasons, extraIds };
}
