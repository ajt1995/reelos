import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Row, TitleCard } from "@/components/title-card";
import { HOSTNAME, rememberCatalogTitles } from "@/lib/catalog";
import { getTitle } from "@/lib/catalog";
import { frontendLabel, sourceLabel, useReelStore } from "@/lib/store";
import { inFlightRequests } from "@/lib/sync-requests";
import { useSyncRequests } from "@/lib/use-sync-requests";
import type { Title } from "@/lib/types";
import { cn } from "@/lib/utils";

export function HomeView() {
  const [q, setQ] = useState("");
  const [remoteHits, setRemoteHits] = useState<Title[]>([]);
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const watchUrl = typeof window !== "undefined" ? `http://${window.location.hostname}:8096` : "";
  const rememberTitles = useReelStore((s) => s.rememberTitles);
  const hydrateShelf = useReelStore((s) => s.hydrateShelf);
  const shelf = useReelStore((s) => s.shelf);
  const shelfError = useReelStore((s) => s.shelfError);
  const shelfReady = useReelStore((s) => s.shelfReady);
  const navigate = useNavigate();
  const requests = useReelStore((s) => s.requests);
  const library = useReelStore((s) => s.library);
  const watch = useReelStore((s) => s.watchProgress);
  const frontend = useReelStore((s) => s.answers.frontend);
  const source = useReelStore((s) => s.answers.source);
  const adapter = useReelStore((s) => s.adapter);
  const inflight = inFlightRequests(requests, { libraryIds: library, titles: shelf });
  const transferring = inflight.length;
  useSyncRequests();
  useEffect(() => {
    hydrateShelf({ limit: 24 });
  }, [hydrateShelf]);

  const catalogHits: Title[] = [];
  const hits = useMemo(() => {
    const seen = new Set<string>();
    const out: Title[] = [];
    for (const t of [...remoteHits, ...catalogHits]) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
    return out;
  }, [catalogHits, remoteHits]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setRemoteHits([]);
      setLookupErr(null);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void fetch(`/api/lookup?q=${encodeURIComponent(term)}`, { cache: "no-store" })
        .then(async (res) => {
          if (!res.ok) throw new Error(`lookup ${res.status}`);
          return res.json() as Promise<{ titles?: Title[]; error?: string | null }>;
        })
        .then((r) => {
          if (cancelled) return;
          const titles = Array.isArray(r?.titles) ? r.titles : [];
          rememberCatalogTitles(titles);
          rememberTitles?.(titles);
          setRemoteHits(titles);
          setLookupErr(titles.length ? null : r?.error || "Seerr returned no titles");
        })
        .catch((e) => {
          if (!cancelled) {
            setRemoteHits([]);
            setLookupErr(String(e));
          }
        });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q, rememberTitles]);

  const reqCards = inflight
    .map((r) => ({ r, t: getTitle(r.titleId) }))
    .filter((x) => x.t)
    .slice(0, 12);

  const continueWatch = Object.entries(watch)
    .filter(([, v]) => v > 0.03 && v < 0.96)
    .map(([id, v]) => ({ t: getTitle(id), v }))
    .filter((x) => x.t && library.includes(x.t.id));

  return (
    <div className="px-5 pb-12 pt-2 md:px-10 md:pt-8">
      {watchUrl ? (
        <a
          href={watchUrl}
          target="_blank"
          rel="noreferrer"
          className="mb-4 inline-flex h-11 items-center rounded-full bg-gold px-5 text-sm font-medium text-gold-fg"
        >
          Watch in this browser
        </a>
      ) : null}
      <form
        className="relative mx-auto block w-full max-w-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (hits[0]) void navigate({ to: "/title/$id", params: { id: hits[0].id } });
        }}
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search movies, shows, music"
          className="h-14 w-full rounded-2xl bg-card pl-12 pr-4 text-base shadow-[var(--shadow-border)] placeholder:text-faint"
        />
        {hits.length > 0 ? (
          <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
            {hits.slice(0, 6).map((t) => (
              <li key={t.id}>
                <Link
                  to="/title/$id"
                  params={{ id: t.id }}
                  className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-foreground/5"
                  onClick={() => setQ("")}
                >
                  <img src={t.poster} alt="" className="h-10 w-7 rounded object-cover" />
                  <span className="flex-1 truncate">{t.title}</span>
                  <span className="text-xs text-muted">{t.year}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : q.trim().length >= 2 ? (
          <p className="mt-2 text-xs text-muted">
            {lookupErr ?? "Looking up movies and shows…"}
          </p>
        ) : null}
      </form>

      <div className="mt-5 flex flex-wrap gap-2">
        <Chip live>
          {frontendLabel[frontend]} live
        </Chip>
        <Chip live={adapter.status === "healthy"}>
          {sourceLabel[source]}
          {adapter.status === "healthy" ? " live" : ""}
        </Chip>
        <Chip>{HOSTNAME}</Chip>
        {transferring > 0 ? <Chip gold>{transferring} transferring</Chip> : <Chip>Library idle</Chip>}
      </div>

      {continueWatch.length > 0 ? (
        <Row label="Continue">
          {continueWatch.map(({ t, v }) =>
            t ? <TitleCard key={t.id} title={t} progress={v} /> : null,
          )}
        </Row>
      ) : null}

      {reqCards.length > 0 ? (
        <Row label="Your requests">
          {reqCards.map(({ r, t }) =>
            t ? <TitleCard key={r.id} title={t} request={r} /> : null,
          )}
        </Row>
      ) : null}

      {shelf.length > 0 ? (
        <Row label="On this box">
          {shelf.slice(0, 24).map((t) => (
            <TitleCard key={t.id} title={t} />
          ))}
        </Row>
      ) : q.trim().length < 2 ? (
        <p className="mt-16 text-center text-sm text-muted">
          {shelfError ||
            (shelfReady
              ? "Nothing in Jellyfin yet. Search and Request — it lands here."
              : "Loading library…")}
        </p>
      ) : null}
    </div>
  );
}

function Chip({
  children,
  live,
  gold,
}: {
  children: React.ReactNode;
  live?: boolean;
  gold?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full bg-card px-3 text-xs text-muted shadow-[var(--shadow-border)]",
        gold && "text-gold",
        live && "text-live",
      )}
    >
      {live ? <span className="size-1.5 rounded-full bg-live" /> : null}
      {children}
    </span>
  );
}
