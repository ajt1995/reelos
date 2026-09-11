import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { TitleCard } from "@/components/title-card";
import { RemoveFromBox } from "@/components/remove-from-box";
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
  { id: "book", label: "Books" },
];

export function LibraryView() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const hydrateShelf = useReelStore((s) => s.hydrateShelf);
  const items = useReelStore((s) => s.shelf);
  const err = useReelStore((s) => s.shelfError);
  const shelfReady = useReelStore((s) => s.shelfReady);
  const intent = useReelStore((s) => s.answers.intent);
  const [books, setBooks] = useState<{ title: string; author: string; rel: string }[]>([]);

  useEffect(() => {
    hydrateShelf();
  }, [hydrateShelf]);
  useEffect(() => {
    if (!intent.books) return;
    void fetch("/api/books/library", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ books?: { title: string; author: string; rel: string }[] }>)
      .then((j) => setBooks(j.books || []))
      .catch(() => setBooks([]));
  }, [intent.books]);

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
    if (t.id === "book") return intent.books;
    return true;
  });

  return (
    <div className="arena-page">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Library</h1>
      <p className="mt-1 text-sm text-muted">
        What Jellyfin has. If it is not there, it is not on this row. Play uses Jellyfin.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "h-7 rounded-full px-3 text-xs",
              tab === t.id ? "bg-circuit/20 text-circuit" : "bg-card text-muted shadow-[var(--shadow-border)]",
            )}
          >
            {t.label}
          </button>
        ))}
        {intent.books ? (
          <Link to="/books" className="ml-1 self-center text-xs text-circuit">
            Catalog
          </Link>
        ) : null}
      </div>
      {tab === "book" ? (
        books.length === 0 ? (
          <p className="mt-6 text-sm text-muted">
            No files in /srv/media/books yet. Search the catalogs — Download is the file.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {books.map((b) => (
              <li key={b.rel} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{b.title}</p>
                  <p className="text-xs text-muted">{b.author}</p>
                </div>
                <a
                  className="inline-flex h-8 items-center rounded-full bg-gold px-3 text-xs font-medium text-gold-fg arena-gold-press"
                  href={`/api/books/file?rel=${encodeURIComponent(b.rel)}`}
                  download
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        )
      ) : shown.length === 0 ? (
        <p className="mt-12 text-sm text-muted">
          {err ??
            (shelfReady
              ? "Nothing in Jellyfin yet. Request a title from Home. Play uses Jellyfin; on this LAN the official app is http://<lan>:8096 without Tailscale."
              : "Loading library…")}
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {shown.map((t) => (
            <div key={t.id}>
              <TitleCard title={t} className="w-auto" />
              <RemoveFromBox title={t} compact />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
