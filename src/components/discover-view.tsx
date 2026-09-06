import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Row, TitleCard } from "@/components/title-card";
import { searchTitles, TITLES } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";

export function DiscoverView() {
  const [q, setQ] = useState("");
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

  const hits = q.trim().length >= 2 ? searchTitles(q).filter((t) => visible.includes(t)) : [];
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
      {hits.length > 0 ? (
        <Row label="Results">
          {hits.map((t) => (
            <TitleCard key={t.id} title={t} />
          ))}
        </Row>
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
