import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { adapterProfile, viaLabel } from "@/lib/adapter";
import { getTitle, TITLES } from "@/lib/catalog";
import { sourceLabel, useReelStore } from "@/lib/store";
import { pushIndexer } from "@/lib/appliance";
import { Button } from "@/components/ui/button";

const META: Record<string, { title: string; fandom: string; port: string }> = {
  indexers: { title: "Indexers", fandom: "Prowlarr", port: "9696" },
  movies: { title: "Movies engine", fandom: "Radarr", port: "7878" },
  tv: { title: "TV engine", fandom: "Sonarr", port: "8989" },
  music: { title: "Music engine", fandom: "Lidarr", port: "8686" },
  subtitles: { title: "Subtitles", fandom: "Bazarr", port: "6767" },
  downloads: { title: "Provider adapter", fandom: "Client", port: "8085" },
};

export function EngineView({ id }: { id: string }) {
  const answers = useReelStore((s) => s.answers);
  const profile = adapterProfile(answers.source, answers.frontend);
  const meta =
    id === "downloads"
      ? { title: profile.name, fandom: profile.fandom, port: profile.port }
      : META[id];
  const requests = useReelStore((s) => s.requests);
  const library = useReelStore((s) => s.library);

  if (!meta) {
    return (
      <div className="p-8">
        <p className="text-muted">Unknown engine.</p>
        <Link to="/settings/advanced" className="mt-3 inline-block text-gold">
          Back
        </Link>
      </div>
    );
  }

  const movies = TITLES.filter((t) => t.kind === "movie" && (library.includes(t.id) || requests.some((r) => r.titleId === t.id)));
  const shows = TITLES.filter(
    (t) =>
      (t.kind === "tv" || t.kind === "anime") &&
      (library.includes(t.id) || requests.some((r) => r.titleId === t.id)),
  );

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
            proxied · {meta.fandom} · {meta.port}
          </p>
        </div>
      </header>
      <div className="p-4 md:p-6">
        <p className="mb-4 rounded-lg bg-gold/10 px-3 py-2 text-xs text-gold">
          Daily search and request belong in ReelOS. This page is for repairs. Download clients other than the debrid adapter are removed.
        </p>
        {id === "movies" ? <Table rows={movies} requests={requests} library={library} /> : null}
        {id === "tv" ? <Table rows={shows} requests={requests} library={library} series /> : null}
        {id === "indexers" ? <IndexerPanel /> : null}
        {id === "subtitles" ? (
          <p className="text-sm text-muted">
            English preferred. Wired to {library.length} library items. Missing: 2.
          </p>
        ) : null}
        {id === "downloads" ? <AdapterConsole /> : null}
      </div>
    </div>
  );
}

function IndexerPanel() {
  const indexers = useReelStore((s) => s.indexers);
  const addIndexer = useReelStore((s) => s.addIndexer);
  const removeIndexer = useReelStore((s) => s.removeIndexer);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");

  return (
    <div>
      <p className="text-sm text-muted">
        None ship on the disc. Request talks to the debrid adapter. Add an indexer here only if you already have one.
      </p>
      {indexers.length === 0 ? (
        <p className="mt-4 rounded-lg bg-card px-4 py-3 text-sm text-muted">No indexers. This is correct.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {indexers.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 rounded-lg bg-card px-4 py-3 text-sm">
              <span>
                <span className="font-medium">{i.name}</span>
                <span className="mt-0.5 block font-mono text-xs text-faint">{i.url}</span>
              </span>
              <button type="button" className="text-xs text-danger" onClick={() => removeIndexer(i.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-6 grid gap-2 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          addIndexer(name, url, key);
          void pushIndexer({ data: { name, url, key } });
          setName("");
          setUrl("");
          setKey("");
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="h-11 rounded-2xl bg-card px-4 text-sm shadow-[var(--shadow-border)] outline-none"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL"
          className="h-11 rounded-2xl bg-card px-4 text-sm shadow-[var(--shadow-border)] outline-none"
        />
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="API key"
          className="h-11 rounded-2xl bg-card px-4 text-sm shadow-[var(--shadow-border)] outline-none sm:col-span-2"
        />
        <Button type="submit" className="sm:col-span-2">
          Add indexer
        </Button>
      </form>
    </div>
  );
}

function AdapterConsole() {
  const adapter = useReelStore((s) => s.adapter);
  const answers = useReelStore((s) => s.answers);
  const requests = useReelStore((s) => s.requests);
  const pingAdapter = useReelStore((s) => s.pingAdapter);
  const profile = adapterProfile(answers.source, answers.frontend);
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
        <Stat label="API" value={profile.api} hint={adapter.mount} />
        <Stat
          label="Traffic"
          value={`${adapter.cacheHits} cache`}
          hint={`${adapter.transfers} transfers`}
        />
      </div>
      <p className="mt-4 text-sm text-muted">{profile.blurb}</p>
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
          const via = viaLabel(r.via, r.status);
          return (
            <li key={r.id} className="rounded-lg bg-card px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate font-medium">{t?.title}</span>
                <span className="shrink-0 font-mono text-xs text-gold">
                  {r.status === "downloading" ? `${Math.round(r.progress)}%` : "search"}
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
                {r.status === "failed" ? r.reason : viaLabel(r.via, r.status)}
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
  requests: { titleId: string; status: string; progress: number }[];
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
              : req?.status === "downloading"
                ? `${Math.round(req.progress)}%`
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
