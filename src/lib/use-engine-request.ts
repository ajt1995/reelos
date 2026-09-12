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
  const [importingSeasons, setImportingSeasons] = useState<number[]>([]);
  const [unreleasedSeasons, setUnreleasedSeasons] = useState<number[]>([]);
  const [extraIds, setExtraIds] = useState<string[]>(() => titlePresenceKeys(id));

  useEffect(() => {
    let aliases = titlePresenceKeys(id);
    let stop = false;
    const ac = new AbortController();
    void fetch("/api/library", { cache: "no-store", signal: ac.signal })
      .then((r) => r.json() as Promise<{ titles?: { id: string; ids?: string[]; jellyfinId?: string; onDiskSeasons?: number[]; importingSeasons?: number[] }[] }>)
      .then((j) => {
        if (stop) return;
        const hit = (j.titles || []).find((t) => titleMatchesId(t, id));
        setInJellyfin(Boolean(hit));
        if (hit) {
          aliases = [...new Set([...aliases, ...titlePresenceKeys(hit.id, hit.ids || [])])];
          setExtraIds(aliases);
          const disk = seasonNumbersFrom(hit.onDiskSeasons);
          if (disk.length) setOnDiskSeasons((prev) => [...new Set([...prev, ...disk])].sort((a, b) => a - b));
          const importing = seasonNumbersFrom((hit as { importingSeasons?: number[] }).importingSeasons);
          if (importing.length) setImportingSeasons((prev) => [...new Set([...prev, ...importing])].sort((a, b) => a - b));
        }
        // TV: series-in-library is not every season. Do not mark a whole-show row available.
        if (!hit || id.startsWith("tmdb-tv-") || id.startsWith("tvdb-") || id.startsWith("jf-")) return;
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
          importingSeasons?: number[];
          unreleasedSeasons?: number[];
          seasons?: number;
        }>)
        .then((j) => {
          if (stop) return;
          setEngineStatus(j.status || null);
          const fromApi = seasonNumbersFrom(j.seasonList);
          if (fromApi.length) setSeasonList(fromApi);
          const disk = seasonNumbersFrom(j.onDiskSeasons);
          if (disk.length) setOnDiskSeasons((prev) => [...new Set([...prev, ...disk])].sort((a, b) => a - b));
          const importing = seasonNumbersFrom(j.importingSeasons);
          if (importing.length) setImportingSeasons((prev) => [...new Set([...prev, ...importing])].sort((a, b) => a - b));
          const coming = seasonNumbersFrom(j.unreleasedSeasons);
          if (coming.length) setUnreleasedSeasons((prev) => [...new Set([...prev, ...coming])].sort((a, b) => a - b));
          const pollIds = [...aliases, j.titleId || ""].filter(Boolean);
          const apiProg =
            typeof j.progress === "number"
              ? j.progress
              : typeof j.percent === "number"
                ? j.percent
                : undefined;
          const diskNow = seasonNumbersFrom(j.onDiskSeasons);
          const pollStatus =
            season != null && (j.status === "downloaded" || j.status === "available") && !diskNow.includes(Number(season))
              ? "unknown"
              : j.status;
          useReelStore.setState((s) => ({
            requests: applyTitleRequestPoll(s.requests, {
              titleId: id,
              extraIds: pollIds,
              season,
              status: pollStatus,
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

  return { inJellyfin, engineStatus, seasonList, onDiskSeasons, importingSeasons, unreleasedSeasons, extraIds };
}
