import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, Search } from "lucide-react";
import type { BookResult } from "@/components/books-view";
import { Chip, FilterChip } from "@/components/chip";
import { Page, PageTitle } from "@/components/page";
import { Row, TitleCard } from "@/components/title-card";
import { rememberCatalogTitles } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import type { Title } from "@/lib/types";
import { installHonestRequest } from "@/lib/honest-request";

type KindFilter = "all" | "movie" | "tv";

export function DiscoverView() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [remoteHits, setRemoteHits] = useState<Title[]>([]);
  const [looking, setLooking] = useState(false);
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const [bookHits, setBookHits] = useState<BookResult[]>([]);
  const [browseMovies, setBrowseMovies] = useState<Title[]>([]);
  const [browseTv, setBrowseTv] = useState<Title[]>([]);
  const [browseErr, setBrowseErr] = useState<string | null>(null);
  const [browseReady, setBrowseReady] = useState(false);
  const rememberTitles = useReelStore((s) => s.rememberTitles);
  const booksOn = Boolean(useReelStore((s) => s.answers.intent.books));
  const navigate = useNavigate();

  useEffect(() => {
    installHonestRequest();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/discover", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`discover ${res.status}`);
        return res.json() as Promise<{ movies?: Title[]; tv?: Title[]; error?: string | null }>;
      })
      .then((r) => {
        if (cancelled) return;
        const movies = Array.isArray(r?.movies) ? r.movies : [];
        const tv = Array.isArray(r?.tv) ? r.tv : [];
        rememberCatalogTitles([...movies, ...tv]);
        rememberTitles?.([...movies, ...tv]);
        setBrowseMovies(movies);
        setBrowseTv(tv);
        setBrowseErr(movies.length || tv.length ? null : r?.error || null);
        setBrowseReady(true);
      })
      .catch((e) => {
        if (!cancelled) {
          setBrowseMovies([]);
          setBrowseTv([]);
          setBrowseErr(String(e));
          setBrowseReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [rememberTitles]);

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
      setLooking(false);
      return;
    }
    setLooking(true);
    setLookupErr(null);
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
          setLooking(false);
        })
        .catch((e) => {
          if (!cancelled) {
            setRemoteHits([]);
            setLookupErr(
              String(e?.name === "AbortError" ? "Seerr lookup timed out. Try the search again." : e),
            );
            setLooking(false);
          }
        });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q, rememberTitles]);

  useEffect(() => {
    const term = q.trim();
    if (!booksOn || term.length < 2) {
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
  }, [booksOn, q]);

  const searching = q.trim().length >= 2;
  const typeaheadOpen = searching && (hits.length > 0 || bookHits.length > 0);
  const movies = kind === "tv" ? [] : browseMovies;
  const tv = kind === "movie" ? [] : browseTv;

  return (
    <Page className="py-6 md:py-8">
      <PageTitle sub="Titles this box does not have. Search to find something else. Active grabs live on Requests.">
        Discover
      </PageTitle>
      <form
        className="relative mt-6 max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (hits[0]) void navigate({ to: "/title/$id", params: { id: hits[0].id } });
          else if (booksOn && q.trim()) void navigate({ to: "/books", search: { q: q.trim() } });
        }}
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={booksOn ? "Find a title or book" : "Find a title"}
          aria-label={booksOn ? "Search movies, shows, and books" : "Search movies and shows"}
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
                      search={{ q: book.title }}
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
          looking ? (
            <p className="mt-2 text-xs text-muted">Looking up movies and shows…</p>
          ) : (
            <p className="mt-2 text-xs text-muted">{lookupErr || "No titles from Seerr for that search."}</p>
          )
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
      </div>

      {searching ? (
        hits.length > 0 ? (
          <Row label="Results">
            {hits.map((t) => (
              <TitleCard key={t.id} title={t} />
            ))}
          </Row>
        ) : looking ? null : (
          <p className="mt-10 text-sm text-muted">{lookupErr || "No titles from Seerr for that search."}</p>
        )
      ) : (
        <>
          {movies.length > 0 ? (
            <Row label="Movies">
              {movies.map((t) => (
                <TitleCard key={t.id} title={t} />
              ))}
            </Row>
          ) : null}
          {tv.length > 0 ? (
            <Row label="Shows">
              {tv.map((t) => (
                <TitleCard key={t.id} title={t} />
              ))}
            </Row>
          ) : null}
          {movies.length === 0 && tv.length === 0 ? (
            <p className="mt-10 text-sm text-muted">
              {browseErr || (browseReady ? "Seerr has nothing new to show yet." : "Looking up movies and shows…")}
            </p>
          ) : null}
        </>
      )}
    </Page>
  );
}
