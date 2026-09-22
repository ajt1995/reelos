import { Link } from "@tanstack/react-router";
import { Check, Play, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { postTitleRequest, requestBodyForTitle } from "@/lib/door-request";
import { jellyfinWatchHref } from "@/lib/jellyfin-watch";
import { rememberCatalogTitles } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import { titleMatchesId, titlePresenceKeys } from "@/lib/sync-requests";
import type { Title } from "@/lib/types";

export function PresenceRow({ title }: { title: Title }) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requestTitle = useReelStore((s) => s.requestTitle);
  const ipv4 = useReelStore((s) => s.ipv4);
  const tailscaleIp = useReelStore((s) => s.tailscaleIp);
  const watchDoor = useReelStore((s) => s.watch);
  const extra = titlePresenceKeys(title.id, title.ids || []);
  const inLibrary = useReelStore((s) => {
    if (title.inLibrary || s.library.includes(title.id)) return true;
    return [...s.shelf, ...s.remoteTitles].some(
      (t) => titleMatchesId(t, title.id) && s.library.some((lib) => titleMatchesId(t, lib)),
    );
  });
  const request = useReelStore((s) => {
    const keys = new Set(extra);
    return s.requests.find((r) => {
      if (r.status === "failed") return false;
      if (!titlePresenceKeys(r.titleId).some((k) => keys.has(k))) return false;
      if (title.kind === "tv" || title.kind === "anime") return r.season == null || r.season === 1;
      return r.season == null;
    });
  });
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const jellyfin = inLibrary
    ? jellyfinWatchHref({
        ipv4,
        tailscaleIp,
        watch: watchDoor,
        hostname,
        jellyfinId: title.jellyfinId,
      })
    : "";
  const body = requestBodyForTitle(title);
  const series = title.kind === "tv" || title.kind === "anime";

  return (
    <li className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0">
      <Link
        to="/title/$id"
        params={{ id: title.id }}
        className="flex min-w-0 flex-1 items-center gap-3"
        onClick={() => rememberCatalogTitles([title])}
      >
        {title.poster ? (
          <img src={title.poster} alt="" className="h-16 w-11 shrink-0 rounded-md object-cover" />
        ) : (
          <span className="h-16 w-11 shrink-0 rounded-md bg-card-2" />
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{title.title}</span>
          <span className="block text-xs text-muted">
            {title.year || null}
            {series ? " · Show" : " · Movie"}
          </span>
          {err ? <span className="mt-1 block text-xs text-danger">{err}</span> : null}
        </span>
      </Link>
      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
        {inLibrary && jellyfin ? (
          <a href={jellyfin} target="_blank" rel="noreferrer">
            <Button size="sm">
              <Play className="size-3.5" fill="currentColor" />
              Watch
            </Button>
          </a>
        ) : null}
        {inLibrary ? (
          <span className="inline-flex h-9 items-center gap-1 rounded-lg bg-success/10 px-2.5 text-xs text-success">
            <Check className="size-3.5" />
            In library
          </span>
        ) : request?.status === "downloading" || request?.status === "waiting" ? (
          <span className="inline-flex h-9 items-center rounded-lg bg-card px-2.5 text-xs text-gold">
            {request.status === "downloading" ? "Grabbing" : request.reason || "Waiting"}
          </span>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy || !body}
            onClick={() => {
              if (!body) return;
              setErr(null);
              setBusy(true);
              rememberCatalogTitles([title]);
              requestTitle(body.titleId, body.season);
              void postTitleRequest(title, body.season)
                .then((r) => {
                  if (!r.ok) setErr(r.error || "Engine did not add the title");
                })
                .finally(() => setBusy(false));
            }}
          >
            <Plus className="size-3.5" />
            {series ? "Request S01" : "Request"}
          </Button>
        )}
      </div>
    </li>
  );
}
