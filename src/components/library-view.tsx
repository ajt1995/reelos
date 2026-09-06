import { useEffect, useMemo, useState } from "react";
import { TitleCard } from "@/components/title-card";
import { rememberCatalogTitles } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import type { Kind, Title } from "@/lib/types";
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
  const [items, setItems] = useState<Title[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const intent = useReelStore((s) => s.answers.intent);

  useEffect(() => {
    let stop = false;
    const load = () => {
      void fetch("/api/library", { cache: "no-store" })
        .then((r) => r.json() as Promise<{ titles?: Title[]; error?: string | null }>)
        .then((j) => {
          if (stop) return;
          const titles = Array.isArray(j.titles) ? j.titles : [];
          rememberCatalogTitles(titles);
          setItems(titles);
          setErr(j.error || null);
        })
        .catch((e) => {
          if (!stop) setErr(String(e));
        });
    };
    load();
    const id = window.setInterval(load, 15000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  const shown = useMemo(
    () => items.filter((t) => (tab === "all" ? true : t.kind === tab)),
    [items, tab],
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
      <p className="mt-2 text-sm text-muted">What Jellyfin has. If it is not there, it is not on this row.</p>
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
      {shown.length === 0 ? (
        <p className="mt-12 text-sm text-muted">{err ?? "Nothing in Jellyfin yet. Request a title from Home."}</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {shown.map((t) => (
            <TitleCard key={t.id} title={t} className="w-auto" />
          ))}
        </div>
      )}
    </div>
  );
}
