import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { getTitle } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import { isInFlightRequest, requestStatusWord } from "@/lib/sync-requests";
import { useSyncRequests } from "@/lib/use-sync-requests";
import type { RequestStatus } from "@/lib/types";
import { formatWhen } from "@/lib/utils";
import { FilterChip } from "@/components/chip";
import { Page, PageTitle } from "@/components/page";
import { Row, TitleCard } from "@/components/title-card";
import { Button } from "@/components/ui/button";

const FILTERS: { id: "all" | RequestStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "available", label: "Ready" },
  { id: "downloading", label: "Grabbing" },
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
  const inFlight = requests.filter(isInFlightRequest);

  return (
    <Page className="py-6 md:py-8">
      <PageTitle sub="Household asks. Status comes from Seerr / *arr — no fake percent.">
        Requests
      </PageTitle>
      {inFlight.length > 0 ? (
        <Row label="In progress" tone="magenta">
          {inFlight.map((r) => {
            const t = getTitle(r.titleId);
            return t ? <TitleCard key={r.id} title={t} request={r} /> : null;
          })}
        </Row>
      ) : null}
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
                {r.status === "failed" ? (
                  <p className="mt-1 text-sm text-danger">{r.reason}</p>
                ) : (
                  <p className="mt-1 text-xs text-muted">{requestStatusWord(r.status)}</p>
                )}
              </div>
              {r.status === "failed" ? (
                <Button size="sm" variant="ghost" onClick={() => retry(r.id)}>
                  Retry
                </Button>
              ) : r.status === "available" ? (
                <a
                  href={
                    typeof window !== "undefined"
                      ? `http://${window.location.hostname}:8096`
                      : "http://127.0.0.1:8096"
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-gold hover:text-gold-bright"
                >
                  Watch
                </a>
              ) : (
                <Button size="sm" variant="quiet" onClick={() => cancel(r.id)}>
                  Cancel
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
