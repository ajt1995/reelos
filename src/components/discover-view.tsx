import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Row, TitleCard } from "@/components/title-card";
import { rememberCatalogTitles, searchTitles, TITLES } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import type { Title } from "@/lib/types";

export function DiscoverView() {
  const [q, setQ] = useState("");
  const [remoteHits, setRemoteHits] = useState<Title[]>([]);
  const rememberTitles = useReelStore((s) =>
    "rememberTitles" in s ? (s as { rememberTitles?: (t: Title[]) => void }).rememberTitles : undefined,
  );
  const intent = useReelStore((s) => s.answers.intent);
  const library = useReelStore((s) => s.library);

  const visible = useMemo(
    () =>
      TITLES.filter((t) => {
        if (t.kind === "anime" && !intent.anime) return false;
        if (t.kind === "kids" && !intent.kids) return false;
        if (t.kind === "music" && !intent.music) return false;
        if (t.kind === "movie" && !intent.movies) return false;
        if (t.kind === "tv" && !intent.tv) return false;
        return true;
      }),
    [intent],
  );

  const catalogHits = q.trim().length >= 2 ? searchTitles(q).filter((t) => visible.includes(t)) : [];
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
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void fetch(`/api/lookup?q=${encodeURIComponent(term)}`, { cache: "no-store" })
        .then((res) => res.json() as Promise<{ titles?: Title[] }>)
        .then((r) => {
          if (cancelled) return;
          const titles = Array.isArray(r?.titles) ? r.titles : [];
          rememberCatalogTitles(titles);
          rememberTitles?.(titles);
          setRemoteHits(titles);
        })
        .catch(() => {
          if (!cancelled) setRemoteHits([]);
        });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q, rememberTitles]);

  const trending = [...visible].sort((a, b) => b.popularity - a.popularity).slice(0, 12);
  const movies = visible.filter((t) => t.kind === "movie").slice(0, 12);
  const tv = visible.filter((t) => t.kind === "tv" || t.kind === "anime").slice(0, 12);
  const fresh = visible.filter((t) => !library.includes(t.id)).slice(0, 12);

  return (
    <div className="px-5 py-6 md:px-10 md:py-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Discover</h1>
      <div className="relative mt-6 max-w-xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a title"
          className="h-12 w-full rounded-2xl bg-card pl-11 pr-4 text-sm shadow-[var(--shadow-border)] placeholder:text-faint"
        />
      </div>
      {q.trim().length >= 2 ? (
        hits.length > 0 ? (
          <Row label="Results">
            {hits.map((t) => (
              <TitleCard key={t.id} title={t} />
            ))}
          </Row>
        ) : (
          <p className="mt-10 text-sm text-muted">
            No titles yet. The movie engine looks this up on TMDB — wait a few seconds after first boot.
          </p>
        )
      ) : (
        <>
          <Row label="Trending this week">
            {trending.map((t) => (
              <TitleCard key={t.id} title={t} />
            ))}
          </Row>
          {movies.length > 0 ? (
            <Row label="Movies">
              {movies.map((t) => (
                <TitleCard key={t.id} title={t} />
              ))}
            </Row>
          ) : null}
          {tv.length > 0 ? (
            <Row label="Television">
              {tv.map((t) => (
                <TitleCard key={t.id} title={t} />
              ))}
            </Row>
          ) : null}
          <Row label="Not in your library">
            {fresh.map((t) => (
              <TitleCard key={t.id} title={t} />
            ))}
          </Row>
        </>
      )}
    </div>
  );
}
