import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Row, TitleCard } from "@/components/title-card";
import { rememberCatalogTitles } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import type { Title } from "@/lib/types";
import { installHonestRequest } from "@/lib/honest-request";

export function DiscoverView() {
  const [q, setQ] = useState("");
  const [remoteHits, setRemoteHits] = useState<Title[]>([]);
  const rememberTitles = useReelStore((s) => s.rememberTitles);
  const hydrateShelf = useReelStore((s) => s.hydrateShelf);
  const shelf = useReelStore((s) => s.shelf);
  const shelfError = useReelStore((s) => s.shelfError);

  useEffect(() => {
    installHonestRequest();
    hydrateShelf();
  }, [hydrateShelf]);

  const hits = useMemo(() => {
    const seen = new Set<string>();
    const out: Title[] = [];
    for (const t of remoteHits) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
    return out;
  }, [remoteHits]);

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

  const movies = shelf.filter((t) => t.kind === "movie").slice(0, 16);
  const tv = shelf.filter((t) => t.kind === "tv" || t.kind === "anime").slice(0, 16);

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
          <p className="mt-10 text-sm text-muted">No titles from the movie engine for that search.</p>
        )
      ) : (
        <>
          {movies.length > 0 ? (
            <Row label="Movies on this box">
              {movies.map((t) => (
                <TitleCard key={t.id} title={t} />
              ))}
            </Row>
          ) : null}
          {tv.length > 0 ? (
            <Row label="Shows on this box">
              {tv.map((t) => (
                <TitleCard key={t.id} title={t} />
              ))}
            </Row>
          ) : null}
          {shelf.length === 0 ? (
            <p className="mt-10 text-sm text-muted">
              {shelfError || "Nothing in Jellyfin yet. Search above, then Request."}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
