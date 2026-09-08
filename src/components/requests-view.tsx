import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getTitle, rememberCatalogTitles } from "@/lib/catalog";
import { viaLabel } from "@/lib/adapter";
import { useReelStore } from "@/lib/store";
import type { MediaRequest, RequestStatus, Title } from "@/lib/types";
import { cn, formatWhen } from "@/lib/utils";
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

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const j = (await fetch("/api/request", { cache: "no-store" }).then((res) => res.json())) as {
          requests?: MediaRequest[];
          titles?: Title[];
        };
        if (stop) return;
        const titles = Array.isArray(j.titles) ? j.titles : [];
        rememberCatalogTitles(titles);
        useReelStore.getState().rememberTitles?.(titles);
        const live = Array.isArray(j.requests) ? j.requests : [];
        if (live.length) {
          useReelStore.setState((s) => ({
            requests: live,
            library: [
              ...new Set([
                ...s.library,
                ...live.filter((r) => r.status === "available").map((r) => r.titleId),
              ]),
            ],
          }));
        }
      } catch {
        /* */
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 8000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  const list = requests.filter((r) => (filter === "all" ? true : r.status === filter));

  return (
    <div className="px-5 py-6 md:px-10 md:py-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Requests</h1>
      <p className="mt-2 text-sm text-muted">Household asks. Admin can auto-approve.</p>
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
          <li className="py-12 text-sm text-muted">Nothing in this list.</li>
        ) : null}
        {list.map((r) => {
          const t = getTitle(r.titleId);
          if (!t) return null;
          return (
            <li key={r.id} className="flex items-center gap-4 py-4">
              <Link to="/title/$id" params={{ id: t.id }} className="shrink-0">
                <img src={t.poster} alt="" className="h-[72px] w-12 rounded-lg object-cover" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link to="/title/$id" params={{ id: t.id }} className="truncate font-medium">
                  {t.title}
                  {r.season ? ` · S${String(r.season).padStart(2, "0")}` : ""}
                </Link>
                <p className="mt-1 text-xs text-muted">
                  {r.requester} · {formatWhen(r.createdAt)}
                </p>
                {r.status === "downloading" && r.progress > 0 ? (
                  <div className="mt-2 h-1 max-w-xs overflow-hidden rounded-full bg-card-2">
                    <div className="h-full bg-gold" style={{ width: `${r.progress}%` }} />
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
                  params={{ id: t.id }}
                  className="text-sm text-gold hover:text-gold-bright"
                >
                  Play
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
