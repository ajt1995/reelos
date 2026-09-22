import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Calendar, Check, ChevronDown, ChevronRight, Cloud, FolderSymlink, HardDrive, LoaderCircle, Radio, Sparkles, Trash2 } from "lucide-react";
import { getTitle } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import { useResolveGhostRequestTitles, useSyncRequests } from "@/lib/use-sync-requests";
import {
  extractUpcomingMonitoredSeasons,
  inFlightRequests,
  isGhostRequestLabel,
  isTvRequestRow,
  requestProgressLabel,
  requestShowsRetry,
  titleForRequest,
  tvSeasonChips,
} from "@/lib/sync-requests";
import { cn, formatWhen } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Poster } from "@/components/poster";
import { showToast } from "@/lib/toast";

const FILTERS: { id: "all" | "downloading" | "waiting"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "downloading", label: "Downloading" },
  { id: "waiting", label: "Waiting" },
];

function sourceProgressLabel(via: string | undefined, status: string) {
  if (status === "waiting") return via === "cache" ? "Source found · adding to library" : "Looking for a source";
  if (status === "downloading") return via === "cache" ? "Preparing provider copy" : "Transferring provider copy";
  if (status === "available") return "Ready to watch";
  return null;
}

export const PIPELINE_STAGES = [
  { id: 1, label: "Finding a source", short: "Finding" },
  { id: 2, label: "Source found", short: "Found" },
  { id: 3, label: "Adding to library", short: "Adding" },
  { id: 4, label: "Ready to watch", short: "Ready" },
] as const;

export type StorageTier =
  | "source_searching"
  | "debrid_cloud"
  | "provider_transfer"
  | "library_link"
  | "local_storage";

export function getHonestFileStatus(r: {
  status: string;
  reason?: string;
  progress?: number;
  via?: string;
}): {
  stage: number;
  tier: StorageTier;
  tierLabel: string;
  location: string;
  isCloudOnly: boolean;
  statusHeadline: string;
  detail: string;
  badgeClass: string;
} {
  const reason = String(r.reason || "").toLowerCase();

  // Tier 4 / Stage 4: Local Media Ready on Box
  if (r.status === "available") {
    return {
      stage: 4,
      tier: "local_storage",
      tierLabel: "Local Media",
      location: "On this ReelOS home",
      isCloudOnly: false,
      statusHeadline: "Ready to Watch",
      detail: "ReelOS verified this copy and it is ready to play.",
      badgeClass: "text-success border-success/30 bg-success/10",
    };
  }

  // Stage 3: an available source is being linked into the library.
  if (reason.includes("importing") || reason.includes("symlink") || reason.includes("on disk")) {
    return {
      stage: 3,
      tier: "library_link",
      tierLabel: "Instant Cloud",
      location: "Instant Cloud Library",
      isCloudOnly: false,
      statusHeadline: "Linking into Library",
      detail: "ReelOS is adding the available cloud copy without storing a second local copy.",
      badgeClass: "text-circuit border-circuit/30 bg-circuit/10",
    };
  }

  // Stage 2: an active provider transfer is in progress.
  if (r.status === "downloading" && r.via !== "cache" && (r.progress || 0) > 0) {
    return {
      stage: 2,
      tier: "provider_transfer",
      tierLabel: "Cloud Transfer",
      location: "Cloud Stream Transfer",
      isCloudOnly: true,
      statusHeadline: `Transferring (${Math.round(r.progress || 0)}%)`,
      detail: "Transferring media directly into secure cloud cinema storage.",
      badgeClass: "text-amber-400 border-amber-400/30 bg-amber-400/10",
    };
  }

  // Tier 2 / Stage 2: Cloud Stream Cache (TorBox)
  if (r.via === "cache" || r.status === "downloading") {
    return {
      stage: 2,
      tier: "debrid_cloud",
      tierLabel: "Cloud Cache",
      location: "High-Speed Cloud Storage",
      isCloudOnly: true,
      statusHeadline: "Ready in Cloud Cinema",
      detail: "Your provider has a complete copy. ReelOS is adding it to your library.",
      badgeClass: "text-gold border-gold/30 bg-gold/10",
    };
  }

  // Stage 1: no playable source has been resolved yet.
  return {
    stage: 1,
    tier: "source_searching",
    tierLabel: "Source search",
    location: "No playable copy yet",
    isCloudOnly: true,
    statusHeadline: "Looking for a playable source",
    detail: "ReelOS has not found or created a playable copy yet.",
    badgeClass: "text-muted border-border bg-card-2/60",
  };
}

export function RequestsView() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const requests = useReelStore((s) => s.requests);
  const shelf = useReelStore((s) => s.shelf);
  const remoteTitles = useReelStore((s) => s.remoteTitles);
  const hydrateShelf = useReelStore((s) => s.hydrateShelf);
  const retry = useReelStore((s) => s.retryRequest);
  const cancel = useReelStore((s) => s.cancelRequest);
  const dismissedRequestIds = useReelStore((s) => s.dismissedRequestIds || []);
  const dismissRequest = useReelStore((s) => s.dismissRequest);
  const dismissAllCompletedRequests = useReelStore((s) => s.dismissAllCompletedRequests);
  const [upcomingExpanded, setUpcomingExpanded] = useState(true);
  const residents = useReelStore((s) => s.residents);
  const activeResidentId = useReelStore((s) => s.activeResidentId);
  const libraryCatchup = useReelStore((s) => s.libraryCatchup);
  const activeResident =
    residents.find((r) => r.id === activeResidentId) ??
    residents[0] ?? { name: "Host" };
  const isKids = Boolean(activeResident?.isKids);

  const [pendingGuestRequests, setPendingGuestRequests] = useState<{
    id: string;
    titleId: string;
    title: string;
    year?: string | number;
    poster?: string;
    mediaType?: string;
    requestedBy?: string;
  }[]>([]);

  const fetchPending = () => {
    if (isKids) return;
    fetch("/api/requests/pending", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && Array.isArray(d.pending)) {
          setPendingGuestRequests(d.pending);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchPending();
  }, [isKids, requests.length]);

  const handleApproveGuest = async (id: string) => {
    setPendingGuestRequests((cur) => cur.filter((p) => p.id !== id));
    showToast("Guest request approved", "success");
    try {
      const res = await fetch("/api/requests/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await res.json().catch(() => ({ ok: true }))) as { ok?: boolean; error?: string };
      if (!data?.ok) {
        showToast(data?.error || "Could not approve request", "error");
        fetchPending();
      } else {
        fetchPending();
        hydrateShelf({ limit: 24, force: true });
      }
    } catch {
      showToast("Network error approving request", "error");
      fetchPending();
    }
  };

  const handleRejectGuest = async (id: string) => {
    setPendingGuestRequests((cur) => cur.filter((p) => p.id !== id));
    showToast("Guest request declined", "info");
    try {
      const res = await fetch("/api/requests/reject", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await res.json().catch(() => ({ ok: true }))) as { ok?: boolean; error?: string };
      if (!data?.ok) {
        showToast(data?.error || "Could not decline request", "error");
        fetchPending();
      } else {
        fetchPending();
      }
    } catch {
      showToast("Network error declining request", "error");
      fetchPending();
    }
  };

  const handleRemoveRequest = async (r: (typeof requests)[0]) => {
    cancel(r.id);
    dismissRequest(r.id);
    showToast("Canceling & removing from box…");
    try {
      await fetch("/api/library", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleId: r.titleId,
          confirm: true,
        }),
      });
      useReelStore.getState().hydrateShelf({ limit: 24, force: true });
      showToast("Removed from box", "info");
    } catch {
      showToast("Removed from requests list", "info");
    }
  };

  useSyncRequests();
  useEffect(() => {
    hydrateShelf({ limit: 24, force: true });
  }, [hydrateShelf]);

  const catalog = [...shelf, ...remoteTitles];
  const inflight = inFlightRequests(requests, { titles: [...shelf, ...remoteTitles] }).filter(
    (r) => !dismissedRequestIds.includes(r.id),
  );
  useResolveGhostRequestTitles(inflight, catalog);
  const filtered = inflight.filter((r) => (filter === "all" ? true : r.status === filter));
  const seenTv = new Set<string>();
  const list = filtered.filter((r) => {
    if (!isTvRequestRow(r)) return true;
    if (seenTv.has(r.titleId)) return false;
    seenTv.add(r.titleId);
    return true;
  });

  const completedCount = inflight.filter((r) => r.status === "available" || r.engine === "downloaded").length;
  const upcomingSeasons = extractUpcomingMonitoredSeasons(requests, catalog);

  const isSystemBusy = libraryCatchup?.status === "running" || Boolean(libraryCatchup?.needsImport);

  return (
    <div className="w-full px-6 md:px-12 lg:px-16 max-w-7xl mx-auto py-6 md:py-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Requests</h1>
      <p className="mt-2 text-sm text-muted">
        Searching, grabbing, or finished and waiting for Watch on Home. Playable titles are On this box.
      </p>

      {/* System Busy Banner */}
      {isSystemBusy ? (
        <div className="mt-5 flex items-start gap-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100 shadow-sm">
          <LoaderCircle className="size-5 shrink-0 animate-spin text-amber-400 mt-0.5" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-amber-300">
              System is actively linking media onto storage — this will take a moment longer.
            </p>
            <p className="mt-1 text-xs text-amber-200/80 leading-relaxed">
              {libraryCatchup?.message || "ReelOS is catching up with available media in the background. Your original files are unchanged."}
              {libraryCatchup?.total && libraryCatchup.total > 0 ? ` (Folder ${libraryCatchup.folder} of ${libraryCatchup.total})` : ""}
            </p>
          </div>
        </div>
      ) : null}

      {/* Guest Requests Gate */}
      {pendingGuestRequests.length > 0 && !isKids ? (
        <div className="mt-5 flex flex-col gap-2 rounded-2xl border border-gold/40 bg-card p-4 shadow-[var(--shadow-gold)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gold">
              Guest Requests Pending Host Approval ({pendingGuestRequests.length})
            </span>
            <span className="text-[11px] text-muted">Host Approves Gate</span>
          </div>
          {pendingGuestRequests.map((pr) => (
            <div key={pr.id} className="flex items-center justify-between gap-3 rounded-xl bg-card-2 p-3">
              <div className="flex items-center gap-3 truncate">
                {pr.poster ? (
                  <img src={pr.poster} alt="" className="h-10 w-7 rounded object-cover" />
                ) : (
                  <div className="h-10 w-7 rounded bg-muted/20" />
                )}
                <div className="truncate">
                  <p className="truncate text-sm font-medium text-foreground">{pr.title}</p>
                  <p className="text-xs text-muted">Requested by {pr.requestedBy || "Guest"} • {pr.year || "Movie/TV"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={() => void handleApproveGuest(pr.id)}
                  className="bg-gold text-gold-fg font-bold hover:bg-gold/90"
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="quiet"
                  onClick={() => void handleRejectGuest(pr.id)}
                >
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "h-9 rounded-full px-4 text-sm font-medium transition-all",
                filter === f.id
                  ? "bg-gold text-gold-fg shadow-[var(--shadow-gold)] font-semibold"
                  : "bg-card text-muted shadow-[var(--shadow-border)] hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {completedCount > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => dismissAllCompletedRequests()}
            className="text-xs text-muted hover:text-foreground flex items-center gap-1.5 h-9 px-3 rounded-full border border-border/50 bg-card/60"
            title="Clear finished titles from requests"
          >
            <Check className="size-3.5 text-success" />
            <span>Clear Completed ({completedCount})</span>
          </Button>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-border/60 bg-card/40 p-10 text-center shadow-inner">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gold/10 text-gold border border-gold/20 mb-3">
              <Cloud className="size-6" />
            </div>
            <p className="font-display text-base font-semibold text-foreground">No In-Flight Requests</p>
            <p className="mt-1 max-w-xs text-xs text-muted leading-relaxed">
              Titles you request in Discover will show their real-time download and cloud-linking progress here.
            </p>
            <Link
              to="/discover"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/10 px-4 py-2 text-xs font-semibold text-gold hover:bg-gold/20 transition-all"
            >
              <span>Browse Titles to Request</span>
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
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
          const honest = getHonestFileStatus(r);

          return (
            <div
              key={r.id}
              className="rounded-2xl border border-border/60 bg-card p-4 md:p-5 shadow-sm transition-all hover:border-border space-y-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4 min-w-0">
                  <Link to="/title/$id" params={{ id: titleId }} className="shrink-0 overflow-hidden rounded-xl">
                    {t ? (
                      <Poster title={t} className="h-20 w-14 rounded-xl object-cover shadow-sm" />
                    ) : (
                      <div className="h-20 w-14 rounded-xl bg-card-2" />
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to="/title/$id"
                        params={{ id: titleId }}
                        className="truncate font-display text-base font-semibold hover:text-gold transition-colors"
                      >
                        {label}
                        {seasonLabel}
                      </Link>
                      {chips.length > 1 ? (
                        <span className="flex flex-wrap gap-1">
                          {chips.map((c) => (
                            <span
                              key={c.season}
                              className="rounded-md bg-card-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted"
                            >
                              S{String(c.season).padStart(2, "0")} · {c.label}
                            </span>
                          ))}
                        </span>
                      ) : null}
                      <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", honest.badgeClass)}>
                        {honest.statusHeadline}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="rounded-full bg-card-2 px-2 py-0.5 font-medium text-foreground">
                        {r.requester}
                      </span>
                      <span>·</span>
                      <span>{formatWhen(r.createdAt)}</span>
                      {r.release ? (
                        <>
                          <span>·</span>
                          <span className="max-w-xs truncate font-mono text-[11px] text-faint">
                            {r.release}
                          </span>
                        </>
                      ) : null}
                    </div>

                    {/* Honest Real-Time Storage Location */}
                    <div className="mt-2.5 flex flex-col gap-1 rounded-xl bg-card-2/50 p-2.5 border border-border/40 text-xs">
                      <div className="flex items-center gap-1.5 font-medium">
                        {honest.isCloudOnly ? (
                          <Cloud className="size-3.5 shrink-0 text-gold" />
                        ) : honest.tier === "library_link" ? (
                          <FolderSymlink className="size-3.5 shrink-0 text-circuit" />
                        ) : (
                          <HardDrive className="size-3.5 shrink-0 text-success" />
                        )}
                        <span className="text-muted">Storage:</span>
                        <code className="rounded bg-card px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                          {honest.location}
                        </code>
                      </div>
                      <p className="text-[11px] text-muted/90 pl-5">
                        {honest.detail}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-start shrink-0">
                  {r.status === "available" || r.engine === "downloaded" ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => dismissRequest(r.id)}
                        className="text-xs text-muted hover:text-foreground flex items-center gap-1"
                        title="Clear from requests list"
                      >
                        <Check className="size-3.5 text-success" />
                        <span>Clear</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleRemoveRequest(r)}
                        className="text-xs text-danger/80 hover:text-danger flex items-center gap-1"
                        title="Remove title and files from box"
                      >
                        <Trash2 className="size-3.5" />
                        <span>Remove</span>
                      </Button>
                    </>
                  ) : requestShowsRetry(r) ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => retry(r.id)}>
                        Retry
                      </Button>
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => void handleRemoveRequest(r)}
                        className="text-xs text-danger/80 hover:text-danger"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="quiet"
                      onClick={() => void handleRemoveRequest(r)}
                      className="text-xs hover:text-danger"
                      title="Cancel and remove from box"
                    >
                      Cancel & Remove
                    </Button>
                  )}
                </div>
              </div>

              {/* Downloading progress bar */}
              {r.status === "downloading" && r.progress > 0 ? (
                <div>
                  <div className="flex justify-between text-xs text-muted mb-1.5 font-medium">
                    <span>{requestProgressLabel(r) || sourceProgressLabel(r.via, r.status) || "Preparing"}</span>
                    <span className="font-mono text-gold">{Math.round(r.progress)}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-card-2">
                    <div
                      className="h-full bg-gold transition-all duration-300 shadow-[var(--shadow-gold)]"
                      style={{ width: `${r.progress}%` }}
                    />
                  </div>
                </div>
              ) : null}

              {/* Honest 4-stage pipeline breadcrumb */}
              <div className="pt-2 border-t border-border/40">
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                  {PIPELINE_STAGES.map((s) => {
                    const isDone = s.id < honest.stage;
                    const isCurrent = s.id === honest.stage;
                    return (
                      <div
                        key={s.id}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-center text-xs font-semibold transition-all",
                          isDone
                            ? "border border-gold/40 bg-gold/10 text-gold"
                            : isCurrent
                              ? "bg-gold text-gold-fg font-bold shadow-[var(--shadow-gold)]"
                              : "border border-border/30 bg-card-2/40 text-muted/50",
                        )}
                      >
                        {isDone ? (
                          <Check className="size-3 stroke-[3]" />
                        ) : (
                          <span className="text-[10px] opacity-75">{s.id}.</span>
                        )}
                        <span className="truncate">{s.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Collapsible Upcoming & Monitored TV Seasons Accordion */}
      {upcomingSeasons.length > 0 ? (
        <div className="mt-8 rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setUpcomingExpanded((prev) => !prev)}
            className="w-full flex items-center justify-between p-4 md:px-5 text-left transition-colors hover:bg-card-2/40"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Calendar className="size-4 text-gold shrink-0" />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 truncate">
                  Upcoming & Monitored TV Seasons
                  <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold ring-1 ring-gold/30 shrink-0">
                    {upcomingSeasons.length}
                  </span>
                </h3>
                <p className="text-xs text-muted truncate">
                  Future seasons monitored by ReelFlow — automatically added upon release
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted shrink-0 ml-3">
              <span>{upcomingExpanded ? "Hide" : "Show"}</span>
              {upcomingExpanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </div>
          </button>

          {upcomingExpanded ? (
            <div className="border-t border-border/40 p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {upcomingSeasons.map((us) => (
                  <div
                    key={`${us.showId}-s${us.seasonNumber}`}
                    className="flex items-center gap-3 rounded-xl border border-border/40 bg-card-2/60 p-3 hover:border-gold/30 transition-all"
                  >
                    {us.poster ? (
                      <img
                        src={us.poster}
                        alt=""
                        className="h-14 w-10 shrink-0 rounded-lg object-cover shadow-sm"
                      />
                    ) : (
                      <div className="h-14 w-10 shrink-0 rounded-lg bg-card-2 border border-border/40 flex items-center justify-center">
                        <Calendar className="size-4 text-muted/50" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/title/$id"
                        params={{ id: us.showId }}
                        className="truncate block text-xs font-semibold text-foreground hover:text-gold transition-colors"
                      >
                        {us.showTitle}
                      </Link>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-gold">
                          S{String(us.seasonNumber).padStart(2, "0")}
                        </span>
                        <span className="text-[11px] text-muted truncate">
                          {us.airDate ? `Expected ${us.airDate}` : "Monitored"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted/70 truncate">
                        {us.reason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
