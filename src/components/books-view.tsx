import { useState } from "react";
import { useReelStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { BookOpen, Search, Download, LoaderCircle, Check } from "lucide-react";
import { searchBooks, downloadBook } from "../../server/books";

export function BooksView() {
  const intent = useReelStore((s) => s.answers.intent);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});

  if (!intent.books) {
    return (
      <div className="px-5 py-8 md:px-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Books</h1>
        <p className="mt-4 text-sm text-muted">Books are not enabled on this ReelOS box.</p>
      </div>
    );
  }

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const data = await searchBooks({ data: { q: query } });
      setResults(data.results || []);
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  const handleDownload = async (book: any) => {
    setDownloading((prev) => ({ ...prev, [book.id]: true }));
    try {
      const res = await downloadBook({ data: { book } });
      if (res.ok) {
        setDownloaded((prev) => ({ ...prev, [book.id]: true }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading((prev) => ({ ...prev, [book.id]: false }));
    }
  };

  const kavitaUrl = typeof window !== "undefined" ? `http://${window.location.hostname}:5000` : "#";

  return (
    <div className="px-5 py-8 md:px-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Books</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Search public domain catalogs (Project Gutenberg, Standard Ebooks) and add them to your Kavita library.
      </p>

      <div className="mt-8 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search for a book or author..."
            className="h-11 w-full rounded-xl bg-card pl-10 pr-4 text-sm shadow-[var(--shadow-border)] outline-none focus:ring-2 focus:ring-gold/50"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button onClick={handleSearch} disabled={searching} className="h-11">
          {searching ? <LoaderCircle className="size-4 animate-spin" /> : "Search"}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((book) => (
            <div key={book.id} className="flex flex-col justify-between rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
              <div>
                <h3 className="font-display font-medium leading-tight">{book.title}</h3>
                <p className="mt-1 text-sm text-muted">{book.author}</p>
                <p className="mt-2 text-xs text-faint">{book.source}</p>
              </div>
              <Button
                variant={downloaded[book.id] ? "ghost" : "gold"}
                size="sm"
                className="mt-4 w-full"
                disabled={downloading[book.id] || downloaded[book.id]}
                onClick={() => handleDownload(book)}
              >
                {downloading[book.id] ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : downloaded[book.id] ? (
                  <>
                    <Check className="mr-2 size-4" /> Added
                  </>
                ) : (
                  <>
                    <Download className="mr-2 size-4" /> Add to Library
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-12 rounded-2xl bg-card px-5 py-6 shadow-[var(--shadow-border)]">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-gold/10 text-gold">
            <BookOpen className="size-6" />
          </div>
          <div>
            <p className="font-display text-lg font-medium">Kavita Library</p>
            <p className="text-sm text-muted">Browse and read your books</p>
          </div>
        </div>
        
        <div className="mt-6">
          <a href={kavitaUrl} target="_blank" rel="noreferrer">
            <Button size="lg" className="w-full sm:w-auto">
              Open Kavita
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
