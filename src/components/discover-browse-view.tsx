import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { TitleCard } from "@/components/title-card";
import { rememberCatalogTitles } from "@/lib/catalog";
import { filterCuratorHidden, titleIsCuratorLiked } from "@/lib/discover-curator";
import { filterDiscoverCatalog } from "@/lib/discover-owned";
import { useCurator } from "@/lib/use-curator";
import { useReelStore } from "@/lib/store";
import type { Title } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "popular", label: "Popular" },
  { id: "upcoming", label: "Upcoming" },
  { id: "trending", label: "Trending" },
] as const;

type Genre = { id: number; name: string };

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
  const rememberTitles = useReelStore((s) => s.rememberTitles);
  const hydrateShelf = useReelStore((s) => s.hydrateShelf);
  const { hiddenIds, likedIds, voteTitle } = useCurator();
  const [genres, setGenres] = useState<Genre[]>([]);
  const [titles, setTitles] = useState<Title[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const seen = useRef(new Set<string>());
  const sentinel = useRef<HTMLDivElement | null>(null);
  const cat = CATEGORIES.some((c) => c.id === category) ? category : "popular";
  const genreId = String(genre || "").replace(/\D/g, "");

  useEffect(() => {
    hydrateShelf({ limit: 24, force: true });
  }, [hydrateShelf]);

  useEffect(() => {
    seen.current = new Set();
    setTitles([]);
    setPage(1);
    setTotalPages(1);
    setErr(null);
  }, [kind, cat, genreId]);

  const loadPage = useCallback(
    (nextPage: number) => {
      setLoading(true);
      const q = new URLSearchParams({ kind, page: String(nextPage), category: cat });
      if (genreId) q.set("genre", genreId);
      void fetch(`/api/discover?${q}`, { cache: "no-store" })
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
          rememberCatalogTitles(rows);
          rememberTitles?.(rows);
          if (Array.isArray(j.genres) && j.genres.length) setGenres(j.genres);
          const extra: Title[] = [];
          for (const t of rows) {
            if (!t?.id || seen.current.has(t.id)) continue;
            seen.current.add(t.id);
            extra.push(t);
          }
          setTitles((cur) => (nextPage <= 1 ? extra : [...cur, ...extra]));
          setPage(Number(j.page || nextPage) || nextPage);
          setTotalPages(Math.max(1, Number(j.totalPages || 1) || 1));
          setErr(rows.length ? null : j.error || null);
          setLoading(false);
        })
        .catch((e) => {
          setErr(String(e));
          setLoading(false);
        });
    },
    [kind, cat, genreId, rememberTitles],
  );

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

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

  const voteDiscover = (title: Title, vote: "like" | "dislike" | "none") => {
    voteTitle(title, vote);
  };

  const shown = useMemo(
    () => filterCuratorHidden(filterDiscoverCatalog(titles, shelf, hiddenIds), hiddenIds),
    [titles, shelf, hiddenIds],
  );

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
    <div className="px-5 py-6 md:px-10 md:py-8">
      <Link to="/discover" className="inline-flex items-center gap-1 text-sm text-muted">
        <ChevronLeft className="size-4" />
        Discover
      </Link>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">{heading}</h1>
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
        <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {shown.map((t) => (
            <TitleCard
              key={t.id}
              title={t}
              className="w-full max-w-full"
              onVote={voteDiscover}
              liked={titleIsCuratorLiked(t, likedIds)}
              hidden={hiddenIds.includes(t.id)}
            />
          ))}
        </div>
      ) : loading ? (
        <p className="mt-10 text-sm text-muted">Looking up {kind === "tv" ? "shows" : "movies"}…</p>
      ) : (
        <p className="mt-10 text-sm text-muted">{err || "Seerr has nothing new to show yet."}</p>
      )}
      <div ref={sentinel} className="h-8" />
      {loading && shown.length ? (
        <p className="mt-4 text-center text-xs text-muted">Loading more…</p>
      ) : null}
    </div>
  );
}