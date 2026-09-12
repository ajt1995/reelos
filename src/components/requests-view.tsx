import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getTitle } from "@/lib/catalog";
import { viaLabel } from "@/lib/adapter";
import { useReelStore } from "@/lib/store";
import { useResolveGhostRequestTitles, useSyncRequests } from "@/lib/use-sync-requests";
import {
  inFlightRequests,
  isGhostRequestLabel,
  isTvRequestRow,
  requestShowsRetry,
  titleForRequest,
  tvSeasonChips,
} from "@/lib/sync-requests";
import { cn, formatWhen } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const FILTERS: { id: "all" | "downloading" | "waiting"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "downloading", label: "Downloading" },
  { id: "waiting", label: "Waiting" },
];

export function RequestsView() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const requests = useReelStore((s) => s.requests);
  const shelf = useReelStore((s) => s.shelf);
  const remoteTitles = useReelStore((s) => s.remoteTitles);
  const hydrateShelf = useReelStore((s) => s.hydrateShelf);
  const retry = useReelStore((s) => s.retryRequest);
  const cancel = useReelStore((s) => s.cancelRequest);
  useSyncRequests();
  useEffect(() => {
    hydrateShelf({ limit: 24 });
  }, [hydrateShelf]);

  const catalog = [...shelf, ...remoteTitles];
  const inflight = inFlightRequests(requests, { titles: [...shelf, ...remoteTitles] });
  useResolveGhostRequestTitles(inflight, catalog);
  const filtered = inflight.filter((r) => (filter === "all" ? true : r.status === filter));
  const seenTv = new Set<string>();
  const list = filtered.filter((r) => {
    if (!isTvRequestRow(r)) return true;
    if (seenTv.has(r.titleId)) return false;
    seenTv.add(r.titleId);
    return true;
  });

  return (
    <div className="px-5 py-6 md:px-10 md:py-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Requests</h1>
      <p className="mt-2 text-sm text-muted">
        In flight — searching, grabbing, waiting to import. Playable titles are in Library.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "h-9 rounded-full px-4 text-sm",
              filter === f.id ? "bg-gold text-gold-fg" : "bg-card text-muted shadow-[var(--shadow-border)]",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <ul className="mt-6 divide-y divide-border">
        {list.length === 0 ? (
          <li className="py-12 text-sm text-muted">Nothing in flight.</li>
        ) : null}
        {list.map((r) => {
          const t = titleForRequest(r, catalog) || getTitle(r.titleId);
          const titleId = t?.id || r.titleId;
          const raw = t?.title || r.title || "";
          const label = isGhostRequestLabel(raw, titleId) ? "Looking up title…" : raw || "Title";
          const chips = isTvRequestRow(r) ? tvSeasonChips(r.titleId, requests, catalog) : [];
          const seasonLabel =
            chips.length > 1
              ? ""
              : r.season
                ? ` · S${String(r.season).padStart(2, "0")}`
                : "";
          return (
            <li key={r.id} className="flex items-center gap-4 py-4">
              <Link to="/title/$id" params={{ id: titleId }} className="shrink-0">
                {t?.poster ? (
                  <img src={t.poster} alt="" className="h-[72px] w-12 rounded-lg object-cover" />
                ) : (
                  <div className="h-[72px] w-12 rounded-lg bg-card-2" />
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <Link to="/title/$id" params={{ id: titleId }} className="truncate font-medium">
                  {label}
                  {seasonLabel}
                </Link>
                {chips.length > 1 ? (
                  <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted">
                    {chips.map((c) => (
                      <span key={c.season}>
                        S{String(c.season).padStart(2, "0")} {c.label}
                      </span>
                    ))}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted">
                  {r.requester} · {formatWhen(r.createdAt)}
                </p>
                {r.status === "downloading" && r.progress > 0 ? (
                  <div className="mt-2 h-1 max-w-xs overflow-hidden rounded-full bg-card-2">
                    <div className="h-full bg-gold" style={{ width: `${r.progress}%` }} />
                  </div>
                ) : null}
                <p className="mt-1 text-xs text-muted">
                  {r.reason ||
                    viaLabel(r.via, r.status) ||
                    (r.status === "downloading" ? `${Math.round(r.progress)}%` : r.status)}
                  {r.status === "downloading" && r.progress > 0 && !r.reason ? ` · ${Math.round(r.progress)}%` : ""}
                  {r.release ? ` · ${r.release}` : ""}
                </p>
              </div>
              {requestShowsRetry(r) ? (
                <Button size="sm" variant="ghost" onClick={() => retry(r.id)}>
                  Retry
                </Button>
              ) : (
                <Button size="sm" variant="quiet" onClick={() => cancel(r.id)}>
                  Cancel
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
