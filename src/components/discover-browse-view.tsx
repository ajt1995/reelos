import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { TitleCard } from "@/components/title-card";
import { rememberCatalogTitles } from "@/lib/catalog";
import { filterCuratorHidden, titleIsCuratorLiked, type CuratorVote } from "@/lib/discover-curator";
import { filterDiscoverCatalog } from "@/lib/discover-owned";
import { useCurator } from "@/lib/use-curator";
import { CuratorStatus } from "@/components/curator-status";
import { useReelStore } from "@/lib/store";
import { titleMatchesId } from "@/lib/sync-requests";
import type { Title } from "@/lib/types";
import { usePosterAmbient } from "@/lib/use-poster-ambient";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "popular", label: "Popular" },
  { id: "upcoming", label: "Upcoming" },
  { id: "trending", label: "Trending" },
] as const;

type Genre = { id: number; name: string };

/** Each catalog query owns its requests and deduplication, including repeated page one. */
export function createDiscoverBrowseQuery<T extends { id: string }>(key: string) {
  const seen = new Set<string>();
  const pending = new Map<number, AbortController>();
  let disposed = false;
  const isCurrent = (request: { page: number; controller: AbortController }) => (
    !disposed && !request.controller.signal.aborted && pending.get(request.page) === request.controller
  );
  return {
    key,
    begin(page: number) {
      // A first-page refresh starts a new result set and invalidates pending appends.
      if (page === 1) {
        for (const controller of pending.values()) controller.abort();
        pending.clear();
      } else {
        pending.get(page)?.abort();
      }
      const controller = new AbortController();
      if (disposed) controller.abort();
      pending.set(page, controller);
      return { page, controller };
    },
    isCurrent,
    accept(request: { page: number; controller: AbortController }, rows: T[]): T[] | null {
      if (!isCurrent(request)) return null;
      // Replacement pages must not dedupe against the result set they replace.
      if (request.page === 1) seen.clear();
      const extra: T[] = [];
      for (const title of rows) {
        if (!title?.id || seen.has(title.id)) continue;
        seen.add(title.id);
        extra.push(title);
      }
      return extra;
    },
    dispose() {
      disposed = true;
      for (const controller of pending.values()) controller.abort();
      pending.clear();
      seen.clear();
    },
  };
}

export function DiscoverBrowseView({
  kind,
  category,
  genre,
}: {
  kind: "movie" | "tv";
  category: string;
  genre: string;
}) {
  const heading = kind === "tv" ? "Shows" : "Movies";
  const path = kind === "tv" ? "/discover/shows" : "/discover/movies";
  const navigate = useNavigate();
  const shelf = useReelStore((s) => s.shelf);
  const requests = useReelStore((s) => s.requests);
  const rememberTitles = useReelStore((s) => s.rememberTitles);
  const hydrateShelf = useReelStore((s) => s.hydrateShelf);
  const curator = useCurator();
  const { hiddenIds, likedIds, voteTitle } = curator;
  const [genres, setGenres] = useState<Genre[]>([]);
  const [titles, setTitles] = useState<Title[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const queryRef = useRef<ReturnType<typeof createDiscoverBrowseQuery<Title>> | null>(null);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const cat = CATEGORIES.some((c) => c.id === category) ? category : "popular";
  const genreId = String(genre || "").replace(/\D/g, "");
  const queryKey = `${kind}:${cat}:${genreId}`;

  useEffect(() => {
    hydrateShelf({ limit: 24, force: true });
  }, [hydrateShelf]);

  const loadPage = useCallback(
    (nextPage: number) => {
      const query = queryRef.current;
      if (!query || query.key !== queryKey) return;
      const request = query.begin(nextPage);
      setLoading(true);
      const q = new URLSearchParams({ kind, page: String(nextPage), category: cat });
      if (genreId) q.set("genre", genreId);
      void fetch(`/api/discover?${q}`, { cache: "no-store", signal: request.controller.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error(`discover ${res.status}`);
          return res.json() as Promise<{
            titles?: Title[];
            genres?: Genre[];
            page?: number;
            totalPages?: number;
            error?: string | null;
          }>;
        })
        .then((j) => {
          const rows = Array.isArray(j.titles) ? j.titles : [];
          if (queryRef.current !== query) return;
          const extra = query.accept(request, rows);
          if (extra === null) return;
          rememberCatalogTitles(rows);
          rememberTitles?.(rows);
          if (Array.isArray(j.genres) && j.genres.length) setGenres(j.genres);
          setTitles((cur) => (nextPage <= 1 ? extra : [...cur, ...extra]));
          setPage(Number(j.page || nextPage) || nextPage);
          setTotalPages(Math.max(1, Number(j.totalPages || 1) || 1));
          setErr(rows.length ? null : j.error || null);
          setLoading(false);
        })
        .catch((e) => {
          if (queryRef.current !== query || !query.isCurrent(request)) return;
          setErr(String(e));
          setLoading(false);
        });
    },
    [kind, cat, genreId, queryKey, rememberTitles],
  );

  useEffect(() => {
    const query = createDiscoverBrowseQuery<Title>(queryKey);
    queryRef.current = query;
    setTitles([]);
    setPage(1);
    setTotalPages(1);
    setErr(null);
    loadPage(1);
    return () => {
      query.dispose();
      if (queryRef.current === query) queryRef.current = null;
    };
  }, [loadPage, queryKey]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        if (loading) return;
        if (page >= totalPages) return;
        loadPage(page + 1);
      },
      { rootMargin: "240px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadPage, loading, page, totalPages]);

  const voteDiscover = (title: Title, vote: CuratorVote) => {
    voteTitle(title, vote);
  };

  const inFlightRequestIds = useMemo(() => new Set(requests.map((r) => r.titleId)), [requests]);
  const skipIds = useMemo(() => [...inFlightRequestIds, ...hiddenIds], [inFlightRequestIds, hiddenIds]);

  const shown = useMemo(
    () => filterCuratorHidden(filterDiscoverCatalog(titles, shelf, skipIds, requests), hiddenIds),
    [titles, shelf, skipIds, requests, hiddenIds],
  );

  const topPoster = shown[0]?.poster || titles[0]?.poster;
  const topBackdrop = shown[0]?.backdrop || titles[0]?.backdrop;
  const ambientColor = usePosterAmbient(topPoster, 0.25);

  const go = (next: { category?: string; genre?: string }) => {
    void navigate({
      to: path,
      search: {
        category: next.category ?? cat,
        genre: next.genre ?? genreId,
      },
    });
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Highly transparent dynamic poster backdrop at top */}
      {topPoster || ambientColor ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[380px] overflow-hidden select-none z-0"
          aria-hidden="true"
        >
          {topBackdrop || topPoster ? (
            <img
              src={topBackdrop || topPoster}
              alt=""
              className="absolute -top-16 inset-x-0 w-full h-[460px] object-cover filter blur-[60px] saturate-[2.0] opacity-25 transition-all duration-1000 scale-110"
              onError={(e) => {
                e.currentTarget.style.opacity = "0";
              }}
            />
          ) : null}
          {ambientColor ? (
            <div
              className="absolute inset-0 transition-opacity duration-700"
              style={{
                background: `radial-gradient(ellipse 95% 75% at 50% 0%, ${ambientColor} 0%, transparent 80%)`,
              }}
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
        </div>
      ) : null}

      <div className="relative z-10 w-full px-6 md:px-12 lg:px-16 py-6 md:py-8">
        <Link to="/discover" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors">
          <ChevronLeft className="size-4" />
          Discover
        </Link>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">{heading}</h1>
        <CuratorStatus {...curator} />
        <p className="mt-2 text-sm text-muted">Titles on this box stay on Home.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => go({ category: c.id, genre: "" })}
            className={cn(
              "h-9 rounded-full px-4 text-sm",
              cat === c.id && !genreId ? "bg-gold text-gold-fg" : "bg-card text-muted shadow-[var(--shadow-border)]",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      {genres.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {genres.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => go({ category: "popular", genre: String(g.id) })}
              className={cn(
                "h-8 rounded-full px-3 text-xs",
                genreId === String(g.id) ? "bg-gold text-gold-fg" : "bg-card text-muted shadow-[var(--shadow-border)]",
              )}
            >
              {g.name}
            </button>
          ))}
        </div>
      ) : null}
      {shown.length ? (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 4xl:grid-cols-9 5xl:grid-cols-10">
          {shown.map((t) => {
            const req = requests.find((r) => titleMatchesId(t, r.titleId) || r.titleId === t.id);
            return (
              <TitleCard
                key={t.id}
                title={t}
                request={req}
                className="w-full max-w-full"
                onVote={voteDiscover}
                liked={titleIsCuratorLiked(t, likedIds)}
                hidden={hiddenIds.includes(t.id)}
              />
            );
          })}
        </div>
      ) : loading ? (
        <p className="mt-10 text-sm text-muted">Looking up {kind === "tv" ? "shows" : "movies"}…</p>
      ) : (
        <p className="mt-10 text-sm text-muted">{err || "Nothing new to show right now. Check back soon."}</p>
      )}
      <div ref={sentinel} className="h-8" />
      {loading && shown.length ? (
        <p className="mt-4 text-center text-xs text-muted">Loading more…</p>
      ) : null}
      </div>
    </div>
  );
}
