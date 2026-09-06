import { useMemo, useState } from "react";
import { TitleCard } from "@/components/title-card";
import { getTitle } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import type { Kind } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS: { id: "all" | Kind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "movie", label: "Movies" },
  { id: "tv", label: "TV" },
  { id: "anime", label: "Anime" },
  { id: "kids", label: "Kids" },
  { id: "music", label: "Music" },
];

export function LibraryView() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const library = useReelStore((s) => s.library);
  const intent = useReelStore((s) => s.answers.intent);
  const items = useMemo(
    () =>
      library
        .map((id) => getTitle(id))
        .filter((t): t is NonNullable<typeof t> => Boolean(t))
        .filter((t) => (tab === "all" ? true : t.kind === tab)),
    [library, tab],
  );

  const tabs = TABS.filter((t) => {
    if (t.id === "all") return true;
    if (t.id === "movie") return intent.movies;
    if (t.id === "tv") return intent.tv;
    if (t.id === "anime") return intent.anime;
    if (t.id === "kids") return intent.kids;
    if (t.id === "music") return intent.music;
    return true;
  });

  return (
    <div className="px-5 py-6 md:px-10 md:py-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Library</h1>
      <p className="mt-2 text-sm text-muted">
        Files under /srv/media. Play opens the media server, not a custom TV OS.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "h-9 rounded-full px-4 text-sm",
              tab === t.id ? "bg-gold text-gold-fg" : "bg-card text-muted shadow-[var(--shadow-border)]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <p className="mt-12 text-sm text-muted">Nothing here yet. Request a title from Discover.</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {items.map((t) => (
            <TitleCard key={t.id} title={t} className="w-auto" />
          ))}
        </div>
      )}
    </div>
  );
}
