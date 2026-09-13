import { useCallback, useEffect, useState } from "react";
import type { CuratorVote } from "@/lib/discover-curator";
import type { Title } from "@/lib/types";

type CuratorPayload = {
  hidden?: string[];
  liked?: string[];
  count?: number;
  hiddenCount?: number;
  likedCount?: number;
};

export function useCurator() {
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [likedIds, setLikedIds] = useState<string[]>([]);

  const apply = useCallback((j: CuratorPayload) => {
    if (Array.isArray(j.hidden)) setHiddenIds(j.hidden);
    if (Array.isArray(j.liked)) setLikedIds(j.liked);
  }, []);

  useEffect(() => {
    void fetch("/api/curator", { cache: "no-store" })
      .then((r) => r.json() as Promise<CuratorPayload>)
      .then(apply)
      .catch(() => {});
  }, [apply]);

  const voteTitle = useCallback(
    (title: Title, vote: CuratorVote) => {
      const extra = [title.id, ...(title.ids || [])].filter(Boolean) as string[];
      if (vote === "like") {
        setLikedIds((cur) => [...new Set([...cur, ...extra])]);
        setHiddenIds((cur) => cur.filter((id) => !extra.includes(id)));
      } else if (vote === "dislike") {
        setHiddenIds((cur) => [...new Set([...cur, ...extra])]);
        setLikedIds((cur) => cur.filter((id) => !extra.includes(id)));
      } else {
        setHiddenIds((cur) => cur.filter((id) => !extra.includes(id)));
        setLikedIds((cur) => cur.filter((id) => !extra.includes(id)));
      }
      void fetch("/api/curator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: title.id,
          ids: title.ids,
          jellyfinId: title.jellyfinId,
          title: title.title,
          vote,
        }),
      })
        .then((r) => r.json() as Promise<CuratorPayload>)
        .then(apply)
        .catch(() => {});
    },
    [apply],
  );

  return { hiddenIds, likedIds, voteTitle };
}
