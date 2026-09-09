import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { BookResult } from "@/components/books-view";
import { BooksShelfRow } from "@/components/books-view";
import { FilterChip } from "@/components/chip";
import { Page, PageTitle } from "@/components/page";
import { TitleCard } from "@/components/title-card";
import { useReelStore } from "@/lib/store";
import type { Kind } from "@/lib/types";

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
  const [books, setBooks] = useState<BookResult[]>([]);
  const hydrateShelf = useReelStore((s) => s.hydrateShelf);
  const items = useReelStore((s) => s.shelf);
  const err = useReelStore((s) => s.shelfError);
  const shelfReady = useReelStore((s) => s.shelfReady);
  const intent = useReelStore((s) => s.answers.intent);
  const booksOn = Boolean(intent.books);

  useEffect(() => {
    hydrateShelf();
  }, [hydrateShelf]);

  useEffect(() => {
    if (!booksOn) {
      setBooks([]);
      return;
    }
    let stop = false;
    void fetch("/api/books/shelf", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ books?: BookResult[] }>)
      .then((j) => {
        if (!stop) setBooks(Array.isArray(j.books) ? j.books : []);
      })
      .catch(() => {
        if (!stop) setBooks([]);
      });
    return () => {
      stop = true;
    };
  }, [booksOn]);

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
    <Page className="py-6 md:py-8">
      <PageTitle sub="What Jellyfin has. If it is not there, it is not on this row. Books are files on disk — Download, not Watch.">
        Library
      </PageTitle>
      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <FilterChip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </FilterChip>
        ))}
        {booksOn ? (
          <Link
            to="/books"
            className="inline-flex h-9 items-center rounded-full px-4 text-sm text-magenta shadow-[var(--shadow-magenta)]"
          >
            Books
          </Link>
        ) : null}
      </div>
      {booksOn && books.length > 0 ? <BooksShelfRow books={books} /> : null}
      {shown.length === 0 ? (
        <p className="mt-12 text-sm text-muted">
          {err ?? (shelfReady ? "Nothing in Jellyfin yet. Request a title from Discover." : "Loading library…")}
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {shown.map((t) => (
            <TitleCard key={t.id} title={t} className="w-auto" />
          ))}
        </div>
      )}
    </Page>
  );
}
