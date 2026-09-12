import { syntheticRelease, titleInCache } from "@/lib/adapter";
import { getTitle } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import type { MediaRequest } from "@/lib/types";

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Replace optimistic fake % inventing — GET /api/request owns status after this. */
export function installHonestRequest() {
  useReelStore.setState({
    requestTitle: (titleId, season) => {
      const s = useReelStore.getState();
      const existing = s.requests.find(
        (r) => r.titleId === titleId && (season == null || r.season === season) && r.status !== "failed",
      );
      if (existing) return;
      const title = getTitle(titleId) ?? s.remoteTitles.find((t) => t.id === titleId);
      if (!title) return;
      const fail = s.answers.quality === "4k" && title.maxQuality !== "4k";
      const requester =
        s.users.find((u) => u.id === s.activeProfileId)?.name ??
        s.users.find((u) => u.role === "owner" || u.role === "admin")?.name ??
        "Ada";
      const local = s.answers.source === "local-vpn";
      const cached = !local && titleInCache(title);
      const via: MediaRequest["via"] = fail ? undefined : local ? "local" : cached ? "cache" : "uncached";
      const rec: MediaRequest = {
        id: uid("req"),
        titleId,
        status: fail ? "failed" : "waiting",
        progress: 0,
        reason: fail ? "No release matches your quality floor" : undefined,
        season,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        requester,
        via,
        release: fail ? undefined : syntheticRelease(title, s.answers.quality),
      };
      const activity = fail
        ? [
            {
              id: uid("ev"),
              at: Date.now(),
              kind: "fail" as const,
              message: `${title.title} — no release matches your quality floor`,
              titleId,
            },
            ...s.activity,
          ]
        : [
            {
              id: uid("ev"),
              at: Date.now(),
              kind: "request" as const,
              message: `${requester} requested ${title.title}`,
              titleId,
            },
            ...s.activity,
          ];
      useReelStore.setState({ requests: [rec, ...s.requests], activity: activity.slice(0, 40) });
    },
  });
}
