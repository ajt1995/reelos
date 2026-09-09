import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, Search } from "lucide-react";
import type { BookResult } from "@/components/books-view";
import { Chip, FilterChip } from "@/components/chip";
import { Page, PageTitle } from "@/components/page";
import { Row, TitleCard } from "@/components/title-card";
import { rememberCatalogTitles } from "@/lib/catalog";
import { installHonestRequest } from "@/lib/honest-request";
import { useReelStore } from "@/lib/store";
import type { Title } from "@/lib/types";

type KindFilter = "all" | "movie" | "tv";

type DiscoverPayload = {
  trending?: Title[];
  movies?: Title[];
  tv?: Title[];
  error?: string | null;
};

function remember(titles: Title[], rememberTitles?: (t: Title[]) => void) {
  rememberCatalogTitles(titles);
  rememberTitles?.(titles);
}

export function DiscoverView() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [remoteHits, setRemoteHits] = useState<Title[]>([]);
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [bookHits, setBookHits] = useState<BookResult[]>([]);
  const [discover, setDiscover] = useState<DiscoverPayload>({});
  const [discoverBusy, setDiscoverBusy] = useState(true);
  const rememberTitles = useReelStore((s) => s.rememberTitles);
  const hydrateShelf = useReelStore((s) => s.hydrateShelf);
  const shelf = useReelStore((s) => s.shelf);
  const shelfError = useReelStore((s) => s.shelfError);
  const shelfReady = useReelStore((s) => s.shelfReady);
  const navigate = useNavigate();

  useEffect(() => {
    installHonestRequest();
    hydrateShelf();
  }, [hydrateShelf]);

  useEffect(() => {
    let stop = false;
    setDiscoverBusy(true);
    const qs = kind === "all" ? "" : `?kind=${kind}`;
    void fetch(`/api/discover${qs}`, { cache: "no-store" })
      .then((res) => res.json() as Promise<DiscoverPayload>)
      .then((r) => {
        if (stop) return;
        const trending = Array.isArray(r.trending) ? r.trending : [];
        const movies = Array.isArray(r.movies) ? r.movies : [];
        const tv = Array.isArray(r.tv) ? r.tv : [];
        remember([...trending, ...movies, ...tv], rememberTitles);
        setDiscover({ trending, movies, tv, error: r.error ?? null });
      })
      .catch((e) => {
        if (!stop) setDiscover({ trending: [], movies: [], tv: [], error: String(e) });
      })
      .finally(() => {
        if (!stop) setDiscoverBusy(false);
      });
    return () => {
      stop = true;
    };
  }, [kind, rememberTitles]);

  const hits = useMemo(() => {
    const seen = new Set<string>();
    const out: Title[] = [];
    for (const t of remoteHits) {
      if (kind !== "all" && t.kind !== kind) continue;
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
    return out;
  }, [kind, remoteHits]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setRemoteHits([]);
      setLookupErr(null);
      setLookupBusy(false);
      return;
    }
    let cancelled = false;
    setLookupBusy(true);
    const t = window.setTimeout(() => {
      const kindQs = kind === "all" ? "" : `&kind=${kind}`;
      void fetch(`/api/lookup?q=${encodeURIComponent(term)}${kindQs}`, { cache: "no-store" })
        .then(async (res) => {
          if (!res.ok) throw new Error(`lookup ${res.status}`);
          return res.json() as Promise<{ titles?: Title[]; error?: string | null }>;
        })
        .then((r) => {
          if (cancelled) return;
          const titles = Array.isArray(r?.titles) ? r.titles : [];
          remember(titles, rememberTitles);
          setRemoteHits(titles);
          setLookupErr(titles.length ? null : r?.error || "Seerr returned no titles");
        })
        .catch((e) => {
          if (!cancelled) {
            setRemoteHits([]);
            setLookupErr(String(e));
          }
        })
        .finally(() => {
          if (!cancelled) setLookupBusy(false);
        });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q, kind, rememberTitles]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setBookHits([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void fetch(`/api/books?q=${encodeURIComponent(term)}`, { cache: "no-store" })
        .then((res) => res.json() as Promise<{ results?: BookResult[] }>)
        .then((r) => {
          if (!cancelled) setBookHits(Array.isArray(r.results) ? r.results.slice(0, 3) : []);
        })
        .catch(() => {
          if (!cancelled) setBookHits([]);
        });
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q]);

  const searching = q.trim().length >= 2;
  const typeaheadOpen = searching && (hits.length > 0 || bookHits.length > 0);
  const recentShelf = shelf.slice(0, 16);
  const trending = discover.trending ?? [];
  const movies = discover.movies ?? [];
  const tv = discover.tv ?? [];
  const idleHasRows =
    trending.length > 0 || movies.length > 0 || tv.length > 0 || recentShelf.length > 0;

  return (
    <Page>
      <PageTitle kicker="Find · Request · Stream" sub="Live Seerr search. Tap a title, pick a season, Request. No fake progress.">
        Discover
      </PageTitle>

      <form
        className="relative mt-6 max-w-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (hits[0]) void navigate({ to: "/title/$id", params: { id: hits[0].id } });
        }}
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search movies, shows, books"
          aria-label="Search movies, shows, and books"
          className="field-glow h-12 w-full rounded-2xl bg-card pl-11 pr-4 text-sm placeholder:text-faint"
        />
        {typeaheadOpen ? (
          <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-cyan)]">
            {hits.slice(0, 8).map((t) => (
              <li key={t.id}>
                <Link
                  to="/title/$id"
                  params={{ id: t.id }}
                  className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-cyan/8"
                  onClick={() => setQ("")}
                >
                  {t.poster ? (
                    <img src={t.poster} alt="" className="h-10 w-7 rounded object-cover" />
                  ) : (
                    <span className="h-10 w-7 rounded bg-card-2" />
                  )}
                  <span className="flex-1 truncate">{t.title}</span>
                  <span className="text-xs text-muted">{t.kind === "tv" ? "TV" : "Movie"}</span>
                  <span className="text-xs text-faint">{t.year || ""}</span>
                </Link>
              </li>
            ))}
            {bookHits.length > 0 ? (
              <>
                <li className="border-t border-border px-4 pb-1 pt-2 font-mono text-[10px] tracking-[0.18em] text-magenta uppercase">
                  Books
                </li>
                {bookHits.map((book) => (
                  <li key={book.id}>
                    <Link
                      to="/books"
                      search={{ q: book.title } as never}
                      className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-magenta/8"
                      onClick={() => setQ("")}
                    >
                      <span
                        aria-hidden
                        className="flex h-10 w-7 items-center justify-center rounded bg-magenta/12 text-magenta shadow-[var(--shadow-magenta)]"
                      >
                        <BookOpen className="size-3.5" />
                      </span>
                      <span className="flex-1 truncate">{book.title}</span>
                      <span className="text-xs text-magenta">{book.source}</span>
                    </Link>
                  </li>
                ))}
              </>
            ) : null}
          </ul>
        ) : searching ? (
          <p className="mt-2 text-xs text-muted">
            {lookupBusy ? "Looking up movies and shows…" : lookupErr ?? "No titles from Seerr for that search."}
          </p>
        ) : null}
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <FilterChip active={kind === "all"} onClick={() => setKind("all")}>
          All
        </FilterChip>
        <FilterChip active={kind === "movie"} onClick={() => setKind("movie")}>
          Movies
        </FilterChip>
        <FilterChip active={kind === "tv"} onClick={() => setKind("tv")}>
          TV
        </FilterChip>
        <Chip live>Seerr</Chip>
        <Chip magenta>Books</Chip>
      </div>

      {trending.length > 0 ? (
        <Row label="Trending">
          {trending.map((t) => (
            <TitleCard key={t.id} title={t} />
          ))}
        </Row>
      ) : null}

      {movies.length > 0 && kind !== "tv" ? (
        <Row label="Popular movies">
          {movies.map((t) => (
            <TitleCard key={t.id} title={t} />
          ))}
        </Row>
      ) : null}

      {tv.length > 0 && kind !== "movie" ? (
        <Row label="Popular TV">
          {tv.map((t) => (
            <TitleCard key={t.id} title={t} />
          ))}
        </Row>
      ) : null}

      {recentShelf.length > 0 ? (
        <Row label="Recently added">
          {recentShelf.map((t) => (
            <TitleCard key={t.id} title={t} />
          ))}
        </Row>
      ) : null}

      {!idleHasRows ? (
        <p className="mt-10 text-sm text-muted">
          {discoverBusy
            ? "Loading trending from Seerr…"
            : discover.error ||
              shelfError ||
              (shelfReady
                ? "Seerr has nothing to show yet. Type a title above — Request still creates a real *arr job."
                : "Loading library…")}
        </p>
      ) : discover.error ? (
        <p className="mt-6 text-xs text-faint">{discover.error}</p>
      ) : null}
    </Page>
  );
}
