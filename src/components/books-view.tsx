import { useEffect, useState } from "react";
import { BookOpen, Download, LoaderCircle, Search, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReelStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type BookHit = {
  id: string;
  title: string;
  author: string;
  source: string;
  year?: number | null;
  format?: string;
  downloadUrl: string;
};

type ShelfBook = { title: string; author: string; rel: string; bytes: number };

export function BooksView() {
  const intent = useReelStore((s) => s.answers.intent);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<BookHit[]>([]);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [shelf, setShelf] = useState<ShelfBook[] | null>(null);
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!intent.books) return;
    void fetch("/api/books/library", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ books?: ShelfBook[] }>)
      .then((j) => setShelf(j.books || []))
      .catch(() => setShelf([]));
  }, [intent.books]);

  if (!intent.books) {
    return (
      <div className="arena-page">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Books</h1>
        <p className="mt-2 text-sm text-muted">
          Books is off. Flip the Books chip in the wizard or Settings → Library. Kavita stays uninstalled until then.
        </p>
      </div>
    );
  }

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setErrors((prev) => ({ ...prev, __search: "" }));
    try {
      const data = await fetch(`/api/books/search?q=${encodeURIComponent(query.trim())}`, {
        cache: "no-store",
      }).then((r) => r.json() as Promise<{ results?: BookHit[]; unavailable?: string[] }>);
      setResults(data.results ?? []);
      setUnavailable(data.unavailable ?? []);
    } catch {
      setResults([]);
      setUnavailable([]);
      setErrors((prev) => ({ ...prev, __search: "Search failed. Is the box online?" }));
    } finally {
      setSearching(false);
      setSearched(true);
    }
  };

  const handleDownload = async (book: BookHit) => {
    setDownloading((prev) => ({ ...prev, [book.id]: true }));
    setErrors((prev) => ({ ...prev, [book.id]: "" }));
    try {
      const res = await fetch("/api/books/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ book }),
      }).then((r) => r.json() as Promise<{ ok?: boolean; rel?: string; filename?: string; error?: string }>);
      if (!res.ok && !res.rel) {
        setErrors((prev) => ({ ...prev, [book.id]: res.error ?? "Download failed." }));
        return;
      }
      setDownloaded((prev) => ({ ...prev, [book.id]: true }));
      const href = res.rel
        ? `/api/books/file?rel=${encodeURIComponent(res.rel)}`
        : `/api/books/file?url=${encodeURIComponent(book.downloadUrl)}`;
      const a = document.createElement("a");
      a.href = href;
      a.download = res.filename || `${book.title}.epub`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      void fetch("/api/books/library", { cache: "no-store" })
        .then((r) => r.json() as Promise<{ books?: ShelfBook[] }>)
        .then((j) => setShelf(j.books || []));
    } catch {
      setErrors((prev) => ({ ...prev, [book.id]: "Download failed." }));
    } finally {
      setDownloading((prev) => ({ ...prev, [book.id]: false }));
    }
  };

  const kavitaUrl =
    typeof window !== "undefined" ? `http://${window.location.hostname}:5000` : "#";

  return (
    <div className="arena-page">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Books</h1>
      <p className="mt-1 max-w-xl text-sm text-muted">
        Legal catalogs only — Gutenberg, Standard Ebooks, Internet Archive. Download saves the file on this phone and
        on the box for Kavita.
      </p>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSearch();
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Dracula, Sherlock Holmes…"
            className="h-10 w-full rounded-xl bg-card pl-9 pr-3 text-sm shadow-[var(--shadow-border)] placeholder:text-faint"
          />
        </div>
        <Button type="submit" variant="circuit" size="sm" disabled={searching}>
          {searching ? <LoaderCircle className="size-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      {errors.__search ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <TriangleAlert className="size-4" /> {errors.__search}
        </p>
      ) : null}
      {unavailable.length > 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <TriangleAlert className="size-4" />
          Could not reach {unavailable.join(" or ")}. Showing what the other catalogs returned.
        </p>
      ) : null}
      {searched && !searching && results.length === 0 && !errors.__search ? (
        <p className="mt-4 text-sm text-muted">
          Nothing in the open catalogs matches that. They carry public domain and openly licensed titles.
        </p>
      ) : null}

      {results.length > 0 ? (
        <ul className="mt-4 divide-y divide-border">
          {results.map((book) => (
            <li key={book.id} className="flex items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{book.title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {book.author}
                  {book.year ? ` · ${book.year}` : ""} · {book.source}
                  {book.format ? ` · ${book.format}` : ""}
                </p>
                {errors[book.id] ? <p className="mt-1 text-xs text-danger">{errors[book.id]}</p> : null}
              </div>
              <Button
                variant="gold"
                size="sm"
                disabled={downloading[book.id]}
                onClick={() => void handleDownload(book)}
              >
                {downloading[book.id] ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                {downloaded[book.id] ? "Saved" : "Download"}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 rounded-xl bg-card px-3 py-3 shadow-[var(--shadow-border)]">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-circuit" />
          <div>
            <p className="text-sm font-medium">Library on the box</p>
            <p className="text-xs text-muted">Kavita · :5000 · /kavita on this host</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">
          Files you already own go in <span className="font-mono">/srv/media/books</span>, one folder per author.
        </p>
        <a href={kavitaUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-circuit">
          Open Kavita
        </a>
      </div>

      {shelf && shelf.length > 0 ? (
        <div className="mt-4">
          <h2 className="font-display text-sm font-medium">On this box</h2>
          <ul className="mt-2 divide-y divide-border">
            {shelf.map((b) => (
              <li key={b.rel} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{b.title}</p>
                  <p className="text-xs text-muted">{b.author}</p>
                </div>
                <a
                  className={cn(
                    "inline-flex h-8 items-center rounded-full bg-gold px-3 text-xs font-medium text-gold-fg",
                  )}
                  href={`/api/books/file?rel=${encodeURIComponent(b.rel)}`}
                  download
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
