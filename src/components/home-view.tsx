import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Row, TitleCard } from "@/components/title-card";
import { RemoveFromBox } from "@/components/remove-from-box";
import { HOSTNAME, rememberCatalogTitles } from "@/lib/catalog";
import { getTitle } from "@/lib/catalog";
import { frontendLabel, sourceLabel, useReelStore } from "@/lib/store";
import {
  collapseHomeRequestCards,
  inFlightRequests,
  isGhostRequestLabel,
  titleForRequest,
  transferringChipCount,
} from "@/lib/sync-requests";
import { homeShelfRows } from "@/lib/shelf";
import { useResolveGhostRequestTitles, useSyncRequests } from "@/lib/use-sync-requests";
import type { Title } from "@/lib/types";
import { cn } from "@/lib/utils";

export function HomeView() {
  const [q, setQ] = useState("");
  const [remoteHits, setRemoteHits] = useState<Title[]>([]);
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const rememberTitles = useReelStore((s) => s.rememberTitles);
  const hydrateShelf = useReelStore((s) => s.hydrateShelf);
  const shelf = useReelStore((s) => s.shelf);
  const remoteTitles = useReelStore((s) => s.remoteTitles);
  const shelfError = useReelStore((s) => s.shelfError);
  const shelfReady = useReelStore((s) => s.shelfReady);
  const navigate = useNavigate();
  const requests = useReelStore((s) => s.requests);
  const library = useReelStore((s) => s.library);
  const watch = useReelStore((s) => s.watchProgress);
  const frontend = useReelStore((s) => s.answers.frontend);
  const source = useReelStore((s) => s.answers.source);
  const adapter = useReelStore((s) => s.adapter);
  const booksOn = useReelStore((s) => s.settings.betaChannel);
  const [bookShelf, setBookShelf] = useState<{ title: string; author: string; rel: string }[]>([]);
  const catalog = useMemo(() => [...shelf, ...remoteTitles], [shelf, remoteTitles]);
  const jfLive = useReelStore((s) => s.jellyfinHop?.state === "green");
  const boxShelf = useMemo(() => homeShelfRows(shelf), [shelf]);
  const inflight = inFlightRequests(requests, { titles: shelf });
  const transferring = transferringChipCount(inflight);
  useSyncRequests();
  useResolveGhostRequestTitles(inflight, catalog);
  useEffect(() => {
    hydrateShelf({ limit: 24 });
  }, [hydrateShelf]);
  useEffect(() => {
    if (!booksOn) {
      setBookShelf([]);
      return;
    }
    void fetch("/api/books/library", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ books?: { title: string; author: string; rel: string }[] }>)
      .then((j) => setBookShelf(Array.isArray(j.books) ? j.books : []))
      .catch(() => setBookShelf([]));
  }, [booksOn]);

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
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void fetch(`/api/lookup?q=${encodeURIComponent(term)}`, { cache: "no-store", signal: ac.signal })
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
          if (cancelled || e?.name === "AbortError") return;
          setRemoteHits([]);
          setLookupErr(String(e));
        });
    }, 280);
    return () => {
      cancelled = true;
      ac.abort();
      window.clearTimeout(t);
    };
  }, [q, rememberTitles]);

  const reqCards = collapseHomeRequestCards(inflight)
    .map((r) => ({ r, t: titleForRequest(r, catalog) ?? getTitle(r.titleId) }))
    .filter((x) => x.t && !isGhostRequestLabel(x.t.title, x.t.id))
    .slice(0, 12);

  const continueWatch = Object.entries(watch)
    .filter(([, v]) => v > 0.03 && v < 0.96)
    .map(([id, v]) => ({ t: getTitle(id), v }))
    .filter((x) => x.t && library.includes(x.t.id));

  return (
    <div className="px-5 pb-12 pt-2 md:px-10 md:pt-8">
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
        <Chip live={jfLive}>
          {frontendLabel[frontend]}
          {jfLive ? " live" : ""}
        </Chip>
        <Chip live={adapter.status === "healthy"}>
          {sourceLabel[source]}
          {adapter.status === "healthy" ? " live" : ""}
        </Chip>
        <Chip>{HOSTNAME}</Chip>
        {transferring > 0 ? <Chip gold>{transferring} transferring</Chip> : <Chip>Library idle</Chip>}
      </div>

      {booksOn && bookShelf.length > 0 ? (
        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-sm font-medium">Books</h2>
            <Link to="/books" className="text-xs text-circuit">
              Catalog
            </Link>
          </div>
          <ul className="space-y-1 text-sm">
            {bookShelf.slice(0, 6).map((b) => (
              <li key={b.rel} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {b.title}
                  <span className="ml-2 text-muted">{b.author}</span>
                </span>
                <a
                  href={`/books?read=${encodeURIComponent(b.rel)}`}
                  className="inline-flex h-7 items-center rounded-full bg-gold px-2.5 text-[11px] font-medium text-gold-fg"
                >
                  Read
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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

      {boxShelf.length > 0 ? (
        <Row label="On this box">
          {boxShelf.slice(0, 24).map((t) => (
            <div key={t.id} className="w-[148px] shrink-0 sm:w-[168px]">
              <TitleCard title={t} className="w-auto" />
              <RemoveFromBox title={t} compact />
            </div>
          ))}
        </Row>
      ) : q.trim().length < 2 ? (
        <p className="mt-16 text-center text-sm text-muted">
          {shelfError ||
            (shelfReady
              ? "Nothing in Jellyfin yet. Search and Request — it lands here. Play uses Jellyfin; on this LAN the official app is http://<lan>:8096 without Tailscale."
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
