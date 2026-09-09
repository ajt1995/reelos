import { useState } from "react";
import {
  BookOpen,
  Check,
  Download,
  LoaderCircle,
  Search,
  TriangleAlert,
} from "lucide-react";
import { Chip } from "@/components/chip";
import { Page, PageTitle } from "@/components/page";
import { Button } from "@/components/ui/button";
import { useReelStore } from "@/lib/store";

export type BookResult = {
  id: string;
  title: string;
  author: string;
  source: string;
  year: number | null;
  format: string;
  downloadUrl: string;
};

export function BooksView() {
  const intent = useReelStore((s) => s.answers.intent);
  const patchIntent = useReelStore((s) => s.patchIntent);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<BookResult[]>([]);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [enabling, setEnabling] = useState(false);

  const enabled = intent.books !== false;

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setErrors((prev) => ({ ...prev, __search: "" }));
    try {
      const res = await fetch(`/api/books?q=${encodeURIComponent(query.trim())}`, {
        cache: "no-store",
      });
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

  const handleDownload = async (book: BookResult) => {
    setDownloading((prev) => ({ ...prev, [book.id]: true }));
    setErrors((prev) => ({ ...prev, [book.id]: "" }));
    try {
      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ book }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) setDownloaded((prev) => ({ ...prev, [book.id]: true }));
      else setErrors((prev) => ({ ...prev, [book.id]: data.error ?? "Download failed." }));
    } catch {
      setErrors((prev) => ({ ...prev, [book.id]: "Download failed." }));
    } finally {
      setDownloading((prev) => ({ ...prev, [book.id]: false }));
    }
  };

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
  const kavitaUrl = `http://${host}:5000`;

  return (
    <Page>
      <PageTitle
        kicker="Open catalogs"
        sub="Project Gutenberg, Standard Ebooks, and freely readable Internet Archive scans. Add lands in /srv/media/books for Kavita. No shadow libraries."
      >
        Books
      </PageTitle>

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip live>Legal only</Chip>
        <Chip>Gutenberg</Chip>
        <Chip>Standard Ebooks</Chip>
        <Chip>Internet Archive</Chip>
      </div>

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
            aria-label="Search legal book catalogs"
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
        <p className="mt-6 text-sm text-muted">
          Nothing in the open catalogs matches that. They carry public-domain and openly licensed
          titles, so most books still in copyright will not be here.
        </p>
      ) : null}

      {results.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((book) => (
            <article
              key={book.id}
              className="card-glow flex flex-col justify-between rounded-xl bg-card p-4 shadow-[var(--shadow-border)]"
            >
              <div>
                <h3 className="font-display font-medium leading-tight">{book.title}</h3>
                <p className="mt-1 text-sm text-muted">{book.author}</p>
                <p className="mt-2 text-xs text-faint">
                  {book.source}
                  {book.year ? ` · ${book.year}` : ""} · {book.format}
                </p>
              </div>
              <Button
                variant={downloaded[book.id] ? "ghost" : "gold"}
                size="sm"
                className="mt-4 w-full"
                disabled={downloading[book.id] || downloaded[book.id]}
                onClick={() => void handleDownload(book)}
              >
                {downloading[book.id] ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : downloaded[book.id] ? (
                  <>
                    <Check className="size-4" /> Added
                  </>
                ) : (
                  <>
                    <Download className="size-4" /> Add to library
                  </>
                )}
              </Button>
              {errors[book.id] ? <p className="mt-2 text-xs text-danger">{errors[book.id]}</p> : null}
            </article>
          ))}
        </div>
      ) : null}

      <div className="mt-12 rounded-2xl bg-card px-5 py-6 shadow-[var(--shadow-border)]">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-cyan/10 text-cyan shadow-[var(--shadow-cyan)]">
            <BookOpen className="size-6" />
          </div>
          <div>
            <p className="font-display text-lg font-medium">Kavita</p>
            <p className="text-sm text-muted">Read on the phone. OPDS readers can use the same host.</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted">
          Files you already own go in <span className="font-mono text-xs text-cyan">/srv/media/books</span>,
          one folder per author. Kavita indexes them on its next scan.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {enabled ? (
            <a href={kavitaUrl} target="_blank" rel="noreferrer">
              <Button size="lg">Open Kavita</Button>
            </a>
          ) : (
            <Button size="lg" disabled={enabling} onClick={() => void startKavita()}>
              {enabling ? <LoaderCircle className="size-4 animate-spin" /> : "Start Kavita"}
            </Button>
          )}
        </div>
      </div>
    </Page>
  );
}
