import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { getTitle } from "@/lib/catalog";
import { viaLabel } from "@/lib/adapter";
import { useReelStore } from "@/lib/store";
import { useSyncRequests } from "@/lib/use-sync-requests";
import type { RequestStatus } from "@/lib/types";
import { formatWhen } from "@/lib/utils";
import { FilterChip } from "@/components/chip";
import { Page, PageTitle } from "@/components/page";
import { Button } from "@/components/ui/button";

const FILTERS: { id: "all" | RequestStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "available", label: "Available" },
  { id: "downloading", label: "Downloading" },
  { id: "waiting", label: "Waiting" },
  { id: "failed", label: "Failed" },
];

export function RequestsView() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const requests = useReelStore((s) => s.requests);
  const retry = useReelStore((s) => s.retryRequest);
  const cancel = useReelStore((s) => s.cancelRequest);
  useSyncRequests();

  const list = requests.filter((r) => (filter === "all" ? true : r.status === filter));

  return (
    <Page className="py-6 md:py-8">
      <PageTitle sub="Household asks. Status comes from Seerr / *arr — no fake percent.">
        Requests
      </PageTitle>
      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <FilterChip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </FilterChip>
        ))}
      </div>
      <ul className="mt-6 divide-y divide-border">
        {list.length === 0 ? (
          <li className="py-12 text-sm text-muted">Nothing in this list.</li>
        ) : null}
        {list.map((r) => {
          const t = getTitle(r.titleId);
          const titleId = t?.id || r.titleId;
          const label = t?.title || r.titleId || "Title";
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
                  {r.season ? ` · S${String(r.season).padStart(2, "0")}` : ""}
                </Link>
                <p className="mt-1 text-xs text-muted">
                  {r.requester} · {formatWhen(r.createdAt)}
                </p>
                {r.status === "downloading" && r.progress > 0 ? (
                  <div className="mt-2 h-1 max-w-xs overflow-hidden rounded-full bg-card-2">
                    <div className="h-full bg-cyan" style={{ width: `${r.progress}%` }} />
                  </div>
                ) : null}
                {r.status === "failed" ? (
                  <p className="mt-1 text-sm text-danger">{r.reason}</p>
                ) : (
                  <p className="mt-1 text-xs text-muted">
                    {viaLabel(r.via, r.status) ??
                      (r.status === "downloading" ? `${Math.round(r.progress)}%` : r.status)}
                    {r.status === "downloading" && r.progress > 0 ? ` · ${Math.round(r.progress)}%` : ""}
                    {r.release ? ` · ${r.release}` : ""}
                  </p>
                )}
              </div>
              {r.status === "failed" ? (
                <Button size="sm" variant="ghost" onClick={() => retry(r.id)}>
                  Retry
                </Button>
              ) : r.status !== "available" ? (
                <Button size="sm" variant="quiet" onClick={() => cancel(r.id)}>
                  Cancel
                </Button>
              ) : (
                <Link
                  to="/play/$id"
                  params={{ id: titleId }}
                  className="text-sm text-cyan hover:text-live"
                >
                  Play
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
