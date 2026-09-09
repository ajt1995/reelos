import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Download, LoaderCircle, Search, TriangleAlert } from "lucide-react";
import { Chip } from "@/components/chip";
import { Page, PageTitle } from "@/components/page";
import { Button } from "@/components/ui/button";
import { useReelStore } from "@/lib/store";

export type BookResult = {
  id: string;
  title: string;
  author: string;
  source: string;
  year?: number | null;
  format: string;
  downloadUrl: string;
  rel?: string;
  bytes?: number;
};

export function bookFetchHref(book: BookResult) {
  if (book.id.startsWith("shelf-")) return `/api/books/file?id=${encodeURIComponent(book.id)}`;
  const q = new URLSearchParams({
    url: book.downloadUrl,
    title: book.title,
    author: book.author,
  });
  return `/api/books/fetch?${q.toString()}`;
}

export function BookCover({ title }: { title: string }) {
  return (
    <div
      aria-hidden
      className="flex aspect-[2/3] w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-magenta/12 text-magenta shadow-[var(--shadow-magenta)]"
    >
      <span className="font-mono text-2xl leading-none">{(title.trim()[0] || "B").toUpperCase()}</span>
      <BookOpen className="mt-1.5 size-3.5 opacity-70" />
    </div>
  );
}

export function BookDownloadLink({ book, className }: { book: BookResult; className?: string }) {
  return (
    <Button asChild variant="gold" size="sm" className={className ?? "w-full"}>
      <a href={bookFetchHref(book)}>
        <Download className="size-4" /> Download
      </a>
    </Button>
  );
}

export function BooksView() {
  const intent = useReelStore((s) => s.answers.intent);
  const patchIntent = useReelStore((s) => s.patchIntent);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<BookResult[]>([]);
  const [shelf, setShelf] = useState<BookResult[]>([]);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [enabling, setEnabling] = useState(false);

  const enabled = Boolean(intent.books);
  const incomingQ = useRouterState({
    select: (s) => {
      const raw = s.location.search as { q?: string } | string;
      if (typeof raw === "string") return new URLSearchParams(raw.startsWith("?") ? raw : `?${raw}`).get("q") ?? "";
      return typeof raw?.q === "string" ? raw.q : "";
    },
  });

  const loadShelf = async () => {
    try {
      const res = await fetch("/api/books/shelf", { cache: "no-store" });
      const data = (await res.json()) as { books?: BookResult[] };
      setShelf(Array.isArray(data.books) ? data.books : []);
    } catch {
      setShelf([]);
    }
  };

  useEffect(() => {
    void loadShelf();
  }, []);

  const handleSearch = async (term = query) => {
    const q = term.trim();
    if (!q) return;
    setQuery(q);
    setSearching(true);
    setErrors((prev) => ({ ...prev, __search: "" }));
    try {
      const res = await fetch(`/api/books?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const data = (await res.json()) as {
        results?: BookResult[];
        unavailable?: string[];
        error?: string;
      };
      setResults(data.results ?? []);
      setUnavailable(data.unavailable ?? []);
      if (data.error) setErrors((prev) => ({ ...prev, __search: data.error as string }));
    } catch {
      setResults([]);
      setUnavailable([]);
      setErrors((prev) => ({ ...prev, __search: "Search failed. Is the box online?" }));
    } finally {
      setSearching(false);
      setSearched(true);
    }
  };

  useEffect(() => {
    if (incomingQ.trim()) void handleSearch(incomingQ);
    // One-shot handoff from Discover typeahead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingQ]);

  const startKavita = async () => {
    setEnabling(true);
    patchIntent({ books: true });
    try {
      await fetch("/api/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: { ...intent, books: true } }),
      });
    } finally {
      setEnabling(false);
    }
  };

  const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const kavitaUrl = `http://${host}:5000`;
  const opdsUrl = `${origin}/api/books/opds`;

  return (
    <Page>
      <PageTitle
        kicker="Files on the phone"
        sub="Download the file. Apple Books, Kindle, Drive, or any reader on this device opens it. Kavita on the box is a library, not a ReelOS player."
      >
        Books
      </PageTitle>

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip magenta>Gutenberg</Chip>
        <Chip magenta>Standard Ebooks</Chip>
        <Chip magenta>Internet Archive</Chip>
      </div>

      {enabled && shelf.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-4 font-display text-lg font-medium tracking-tight text-magenta">On the shelf</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shelf.map((book) => (
              <BookCard key={book.id} book={book} ready />
            ))}
          </div>
        </section>
      ) : null}

      <form
        className="mt-8 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSearch();
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            placeholder="Search a book or author"
            aria-label="Search books"
            className="field-glow h-11 w-full rounded-xl bg-card pl-10 pr-4 text-sm placeholder:text-faint"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={searching} className="h-11">
          {searching ? <LoaderCircle className="size-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      {errors.__search ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <TriangleAlert className="size-4 text-gold" /> {errors.__search}
        </p>
      ) : null}

      {unavailable.length > 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <TriangleAlert className="size-4 text-gold" />
          Could not reach {unavailable.join(" or ")}. Showing what the other catalogs returned.
        </p>
      ) : null}

      {searched && !searching && results.length === 0 && !errors.__search ? (
        <p className="mt-6 text-sm text-muted">Nothing in these catalogs matches that.</p>
      ) : null}

      {results.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      ) : null}

      <div className="mt-12 rounded-2xl bg-card px-5 py-6 shadow-[var(--shadow-magenta)]">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-magenta/10 text-magenta shadow-[var(--shadow-magenta)]">
            <BookOpen className="size-6" />
          </div>
          <div>
            <p className="font-display text-lg font-medium">How to read</p>
            <p className="text-sm text-muted">
              Download the file from ReelOS. The reader already on this phone opens it.
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted">
          Files you already own go in <span className="font-mono text-xs text-magenta">/srv/media/books</span>,
          one folder per author. Not TorBox. Not Jellyfin movies.
        </p>
        <p className="mt-2 text-sm text-muted">
          Android OPDS readers can subscribe to{" "}
          <span className="font-mono text-xs text-magenta">{opdsUrl || "/api/books/opds"}</span>.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {enabled ? (
            <a href={kavitaUrl} target="_blank" rel="noreferrer">
              <Button size="lg" variant="ghost">
                Library on the box (Kavita)
              </Button>
            </a>
          ) : (
            <Button size="lg" disabled={enabling} onClick={() => void startKavita()}>
              {enabling ? <LoaderCircle className="size-4 animate-spin" /> : "Turn on Books"}
            </Button>
          )}
        </div>
      </div>
    </Page>
  );
}

function BookCard({ book, ready }: { book: BookResult; ready?: boolean }) {
  return (
    <article className="card-glow flex gap-3 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
      <BookCover title={book.title} />
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <h3 className="font-display font-medium leading-tight">{book.title}</h3>
          <p className="mt-1 text-sm text-muted">{book.author}</p>
          <p className="mt-2 text-xs text-faint">
            {book.source}
            {book.year ? ` · ${book.year}` : ""} · {book.format}
            {ready ? " · Ready" : ""}
          </p>
        </div>
        <div className="mt-4">
          <BookDownloadLink book={book} />
        </div>
      </div>
    </article>
  );
}

export function BooksShelfRow({ books }: { books: BookResult[] }) {
  if (books.length === 0) return null;
  return (
    <section className="mt-8">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-medium tracking-tight text-magenta">Books</h2>
        <Link to="/books" className="text-xs text-magenta">
          All books
        </Link>
      </div>
      <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
        {books.map((book) => (
          <a
            key={book.id}
            href={bookFetchHref(book)}
            className="card-glow w-[148px] shrink-0 rounded-xl bg-card p-3 shadow-[var(--shadow-magenta)] sm:w-[168px]"
          >
            <BookCover title={book.title} />
            <p className="mt-2 truncate text-sm font-medium">{book.title}</p>
            <p className="truncate text-xs text-muted">{book.author}</p>
            <p className="mt-2 text-xs text-magenta">Download</p>
          </a>
        ))}
      </div>
    </section>
  );
}
