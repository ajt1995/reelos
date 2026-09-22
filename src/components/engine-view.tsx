import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { getTitle } from "@/lib/catalog";
import { sourceLabel, useReelStore } from "@/lib/store";
import { requestProgressLabel } from "@/lib/sync-requests";
import type { MediaRequest } from "@/lib/types";

const META: Record<string, { title: string; subtitle: string; port?: string }> = {
  reelflow: { title: "Source preparation", subtitle: "Source lookup and library linking" },
  living: { title: "Personalization", subtitle: "Local taste matching and preparation suggestions" },
  storage: { title: "Hybrid Storage & Watermarks", subtitle: "85% High / 70% Low LRU Cache Manager" },
  downloads: { title: "Cloud Stream Provider & Storage", subtitle: "Instant Cloud Cache & Stream Bridge (:8282)", port: "8282" },
  seerr: { title: "Discovery Catalog", subtitle: "Metadata Engine (:5055)", port: "5055" },
  // Backwards compatibility aliases
  movies: { title: "Movies Pipeline", subtitle: "Canonical Movies Symlink Engine" },
  tv: { title: "TV Pipeline", subtitle: "Canonical TV & Multi-Episode Engine" },
  indexers: { title: "Custom sources", subtitle: "Optional household source endpoints" },
  subtitles: { title: "Subtitles Engine", subtitle: "Auto English Subtitles" },
};

export function EngineView({ id }: { id: string }) {
  const answers = useReelStore((s) => s.answers);
  const meta =
    id === "downloads"
      ? { title: "Connected source", subtitle: `${sourceLabel[answers.source]} source connector` }
      : META[id];
  const requests = useReelStore((s) => s.requests);
  const library = useReelStore((s) => s.library);
  const shelf = useReelStore((s) => s.shelf);

  if (!meta) {
    return (
      <div className="p-8">
        <p className="text-muted">Unknown component.</p>
        <Link to="/settings/advanced" className="mt-3 inline-block text-gold">
          Back
        </Link>
      </div>
    );
  }

  const movies = shelf.filter((t) => t.kind === "movie");
  const shows = shelf.filter((t) => t.kind === "tv" || t.kind === "anime");

  return (
    <div className="bg-raised">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Link
          to="/settings/advanced"
          className="flex size-10 items-center justify-center rounded-lg text-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <p className="text-sm font-medium">{meta.title}</p>
          <p className="font-mono text-[11px] text-faint">
            {meta.subtitle} {meta.port ? `· :${meta.port}` : ""}
          </p>
        </div>
      </header>
      <div className="p-4 md:p-6 space-y-4">
        {id === "reelflow" ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
              <h3 className="font-display text-base font-semibold text-foreground">Source preparation status</h3>
              <p className="text-xs text-muted">Measured service state for this ReelOS home.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="rounded-xl bg-card-2 p-3 border border-border/40">
                  <p className="text-[10px] text-muted">Circuit Breaker</p>
                  <p className="text-sm font-semibold text-muted">Reported by health check</p>
                </div>
                <div className="rounded-xl bg-card-2 p-3 border border-border/40">
                  <p className="text-[10px] text-muted">Primary source</p>
                  <p className="text-sm font-semibold text-foreground">Configured provider</p>
                </div>
                <div className="rounded-xl bg-card-2 p-3 border border-border/40">
                  <p className="text-[10px] text-muted">Fallback</p>
                  <p className="text-sm font-semibold text-foreground">Public or personal source</p>
                </div>
                <div className="rounded-xl bg-card-2 p-3 border border-border/40">
                  <p className="text-[10px] text-muted">Safety checks</p>
                  <p className="text-sm font-semibold text-foreground">Required before playback</p>
                </div>
              </div>
            </div>
            <Table rows={movies} requests={requests} library={library} />
          </div>
        ) : null}

        {id === "living" ? (
          <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
            <h3 className="font-display text-base font-semibold text-foreground">The Living Engine Diagnostics</h3>
            <p className="text-xs text-muted">Deterministic, sub-10ms bitmask Jaccard similarity without heavy ML libraries.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="rounded-xl bg-card-2 p-3 border border-border/40">
                <p className="text-[10px] text-muted">Taste Profiler</p>
                <p className="text-sm font-semibold text-emerald-400">&lt;5ms (32-bit Bitmask)</p>
              </div>
              <div className="rounded-xl bg-card-2 p-3 border border-border/40">
                <p className="text-[10px] text-muted">Predictive Binge Buffer</p>
                <p className="text-sm font-semibold text-gold">80% Playback Trigger</p>
              </div>
              <div className="rounded-xl bg-card-2 p-3 border border-border/40">
                <p className="text-[10px] text-muted">Staging Concurrency</p>
                <p className="text-sm font-semibold text-foreground">Max 1 (Stream Protected)</p>
              </div>
            </div>
          </div>
        ) : null}

        {id === "storage" ? (
          <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
            <h3 className="font-display text-base font-semibold text-foreground">Storage & Watermark Manager</h3>
            <p className="text-xs text-muted">Prevents disk exhaustion while keeping offline favorites permanently locked.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="rounded-xl bg-card-2 p-3 border border-border/40">
                <p className="text-[10px] text-muted">High-Watermark</p>
                <p className="text-sm font-semibold text-foreground">85% (Triggers Eviction)</p>
              </div>
              <div className="rounded-xl bg-card-2 p-3 border border-border/40">
                <p className="text-[10px] text-muted">Low-Watermark</p>
                <p className="text-sm font-semibold text-foreground">70% (Target Quota)</p>
              </div>
              <div className="rounded-xl bg-card-2 p-3 border border-border/40">
                <p className="text-[10px] text-muted">Offline Pin Locks</p>
                <p className="text-sm font-semibold text-emerald-400">Active (.pinned Guard)</p>
              </div>
            </div>
          </div>
        ) : null}

        {id === "movies" ? <Table rows={movies} requests={requests} library={library} /> : null}
        {id === "tv" ? <Table rows={shows} requests={requests} library={library} series /> : null}
        {id === "downloads" ? <AdapterConsole /> : null}
        {id === "seerr" ? (
          <p className="text-sm text-muted">
            Daily search and Request stay in ReelOS. Discovery and catalog requests talk to Seerr on :5055.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AdapterConsole() {
  const adapter = useReelStore((s) => s.adapter);
  const answers = useReelStore((s) => s.answers);
  const requests = useReelStore((s) => s.requests);
  const pingAdapter = useReelStore((s) => s.pingAdapter);
  const queue = requests.filter((r) => r.status === "downloading" || r.status === "waiting");
  const recent = requests.filter((r) => r.status === "available" || r.status === "failed").slice(0, 6);

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Provider"
          value={sourceLabel[adapter.provider]}
          hint={
            adapter.status === "healthy"
              ? `${adapter.pingMs}ms · ${adapter.daysLeft ? `${adapter.daysLeft}d left` : adapter.account}`
              : "Offline"
          }
        />
        <Stat label="Connection" value="ReelOS source connector" hint="Credentials stay on this ReelOS home" />
        <Stat
          label="Traffic"
          value={`${adapter.cacheHits} cache`}
          hint={`${adapter.transfers} transfers`}
        />
      </div>
      <p className="mt-4 text-sm text-muted">Availability is checked before ReelOS offers playback or saving.</p>
      <button
        type="button"
        onClick={pingAdapter}
        className="mt-4 h-9 rounded-full bg-card px-4 text-sm text-muted shadow-[var(--shadow-border)] hover:text-foreground"
      >
        Ping adapter
      </button>
      <p className="mt-6 mb-2 text-xs tracking-[0.16em] text-faint uppercase">Queue</p>
      <ul className="space-y-2">
        {queue.length === 0 ? (
          <li className="rounded-lg bg-card px-4 py-3 text-sm text-muted">Queue empty.</li>
        ) : null}
        {queue.map((r) => {
          const t = getTitle(r.titleId);
          const via = r.via === "cache" ? "Provider copy found" : "Provider transfer";
          return (
            <li key={r.id} className="rounded-lg bg-card px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate font-medium">{t?.title}</span>
                <span className="shrink-0 font-mono text-xs text-gold">
                  {r.status === "downloading" ? requestProgressLabel(r) || "Grabbing" : "search"}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {via ?? r.status}
                {r.release ? ` · ${r.release}` : ""}
              </p>
              {r.status === "downloading" ? (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-card-2">
                  <div className="h-full bg-gold" style={{ width: `${r.progress}%` }} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="mt-6 mb-2 text-xs tracking-[0.16em] text-faint uppercase">Recent</p>
      <ul className="space-y-2">
        {recent.length === 0 ? (
          <li className="rounded-lg bg-card px-4 py-3 text-sm text-muted">No completed jobs.</li>
        ) : null}
        {recent.map((r) => {
          const t = getTitle(r.titleId);
          return (
            <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-card px-4 py-3 text-sm">
              <span className="truncate">{t?.title}</span>
              <span className="shrink-0 text-xs text-muted">
                {r.status === "failed" ? r.reason : r.status === "available" ? "Ready to watch" : "Preparing"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl bg-card px-4 py-3">
      <p className="text-[11px] tracking-[0.16em] text-faint uppercase">{label}</p>
      <p className="mt-1 font-display font-medium">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </div>
  );
}

function Table({
  rows,
  requests,
  library,
  series,
}: {
  rows: { id: string; title: string; year: number }[];
  requests: MediaRequest[];
  library: string[];
  series?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg bg-card">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-faint">
          <tr className="border-b border-border">
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Year</th>
            <th className="px-4 py-3 font-medium">{series ? "Monitored" : "Status"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const req = requests.find((q) => q.titleId === r.id);
            const status = library.includes(r.id)
              ? "Imported"
              : req && req.status === "downloading"
                ? requestProgressLabel(req) || "Grabbing"
                : req?.status ?? "Missing";
            return (
              <tr key={r.id} className="border-b border-border/70">
                <td className="px-4 py-3">{r.title}</td>
                <td className="px-4 py-3 text-muted">{r.year}</td>
                <td className="px-4 py-3 text-muted">{status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
