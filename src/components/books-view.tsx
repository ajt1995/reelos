import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Compass,
  Download,
  Library,
  LoaderCircle,
  Search,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { BookCover } from "@/components/book-cover";
import { BookReader } from "@/components/book-reader";
import { Button } from "@/components/ui/button";
import { useReelStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { ReadingAppearance } from "@/experience/experience-state";

type BookHit = {
  id: string;
  title: string;
  author: string;
  source: string;
  year?: number | null;
  format?: string;
  downloadUrl: string;
  cover?: string | null;
};

type LicensedHit = {
  id: string;
  title: string;
  author: string;
  source: string;
  year?: number | null;
  cover?: string | null;
  honesty?: string;
  actions?: { kind: string; label: string; url: string }[];
};

type ShelfBook = {
  title: string;
  author: string;
  rel: string;
  bytes: number;
  cover?: string | null;
};

function readParam() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("read") || "";
}

type BooksViewProps = {
  initialQuery?: string;
  bookProgress?: Record<string, number>;
  bookLocations?: Record<string, string>;
  bookBookmarks?: Record<string, string[]>;
  readingAppearance?: ReadingAppearance;
  onProgress?(bookId: string, progress: number, location?: string): void;
  onToggleBookmark?(bookId: string, location: string): void;
  onAppearance?(patch: Partial<ReadingAppearance>): void;
};

export function BooksView({
  initialQuery = "",
  bookProgress = {},
  bookLocations = {},
  bookBookmarks = {},
  readingAppearance = { theme: "dark", fontSizeIndex: 1 },
  onProgress,
  onToggleBookmark,
  onAppearance,
}: BooksViewProps) {
  const booksOn = useReelStore((s) => s.settings.betaChannel);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<BookHit[]>([]);
  const [licensed, setLicensed] = useState<LicensedHit[]>([]);
  const [honesty, setHonesty] = useState("");
  const [catalog, setCatalog] = useState<BookHit[]>([]);
  const [featuredLicensed, setFeaturedLicensed] = useState<LicensedHit[]>([]);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [shelf, setShelf] = useState<ShelfBook[] | null>(null);
  const [shelfFilter, setShelfFilter] = useState<"all" | "epub" | "pdf">("all");
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reading, setReading] = useState<ShelfBook | null>(null);
  const [sideloadMsg, setSideloadMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const initialQueryRef = useRef("");

  const refreshShelf = () =>
    fetch("/api/books/library", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ books?: ShelfBook[] }>)
      .then((j) => setShelf(j.books || []))
      .catch(() => setShelf([]));

  useEffect(() => {
    void refreshShelf();
    void fetch("/api/books/discover", { cache: "no-store" })
      .then(
        (r) =>
          r.json() as Promise<{
            featured?: BookHit[];
            licensed?: LicensedHit[];
            unavailable?: string[];
          }>,
      )
      .then((j) => {
        setCatalog(j.featured || []);
        setFeaturedLicensed(j.licensed || []);
        if (j.unavailable?.length) setUnavailable(j.unavailable);
      })
      .catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    const rel = readParam();
    if (!rel || !shelf) return;
    const hit = shelf.find((b) => b.rel === rel);
    if (hit) setReading(hit);
  }, [shelf]);

  const handleSearch = async (requestedQuery = query) => {
    const nextQuery = requestedQuery.trim();
    if (!nextQuery) return;
    setQuery(nextQuery);
    searchAbortRef.current?.abort();
    const ctrl = new AbortController();
    searchAbortRef.current = ctrl;

    setSearching(true);
    setErrors((prev) => ({ ...prev, __search: "" }));
    try {
      const data = await fetch(
        `/api/books/search?q=${encodeURIComponent(nextQuery)}`,
        { cache: "no-store", signal: ctrl.signal },
      ).then(
        (r) =>
          r.json() as Promise<{
            results?: BookHit[];
            licensed?: LicensedHit[];
            unavailable?: string[];
            honesty?: string;
          }>,
      );
      setResults(data.results ?? []);
      setLicensed(data.licensed ?? []);
      setUnavailable(data.unavailable ?? []);
      setHonesty(data.honesty ?? "");
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setResults([]);
      setLicensed([]);
      setUnavailable([]);
      setHonesty("");
      setErrors((prev) => ({
        ...prev,
        __search:
          "Search is unavailable right now. Your personal shelf is still here.",
      }));
    } finally {
      if (searchAbortRef.current === ctrl) {
        setSearching(false);
        setSearched(true);
      }
    }
  };

  useEffect(() => {
    const next = initialQuery.trim();
    if (!next || initialQueryRef.current === next) return;
    initialQueryRef.current = next;
    void handleSearch(next);
  }, [initialQuery]);

  const handleReadOrDownload = async (
    book: BookHit,
    action: "read" | "download" = "read",
  ) => {
    if (action === "read" && shelf) {
      const existing = shelf.find(
        (b) =>
          b.title.toLowerCase() === book.title.toLowerCase() ||
          (b.rel &&
            book.title &&
            b.rel.toLowerCase().includes(book.title.toLowerCase())),
      );
      if (existing) {
        setReading(existing);
        return;
      }
    }

    setDownloading((prev) => ({ ...prev, [book.id]: true }));
    setErrors((prev) => ({ ...prev, [book.id]: "" }));
    try {
      const res = await fetch("/api/books/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ book }),
      }).then(
        (r) =>
          r.json() as Promise<{
            ok?: boolean;
            rel?: string;
            filename?: string;
            error?: string;
          }>,
      );
      if (!res.ok && !res.rel) {
        setErrors((prev) => ({
          ...prev,
          [book.id]: res.error ?? "Download failed.",
        }));
        return;
      }
      setDownloaded((prev) => ({ ...prev, [book.id]: true }));

      if (action === "download") {
        const href = res.rel
          ? `/api/books/file?rel=${encodeURIComponent(res.rel)}`
          : `/api/books/file?url=${encodeURIComponent(book.downloadUrl)}`;
        const a = document.createElement("a");
        a.href = href;
        a.download = res.filename || `${book.title}.epub`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      const lib = await fetch("/api/books/library", { cache: "no-store" }).then(
        (r) => r.json() as Promise<{ books?: ShelfBook[] }>,
      );
      setShelf(lib.books || []);
      if (res.rel) {
        const saved = (lib.books || []).find((b) => b.rel === res.rel);
        if (saved && action === "read") setReading(saved);
      }
    } catch {
      setErrors((prev) => ({ ...prev, [book.id]: "Download failed." }));
    } finally {
      setDownloading((prev) => ({ ...prev, [book.id]: false }));
    }
  };

  const handleSideload = async (file: File) => {
    setSideloadMsg("");
    const body = await file.arrayBuffer();
    const res = await fetch("/api/books/sideload", {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-Book-Filename": file.name,
      },
      body,
    }).then(
      (r) =>
        r.json() as Promise<{ ok?: boolean; rel?: string; error?: string }>,
    );
    if (!res.ok || !res.rel) {
      setSideloadMsg(res.error || "Sideload failed.");
      return;
    }
    setSideloadMsg("Saved to shelf. Opening in reader.");
    await refreshShelf();
    setReading({
      title: file.name.replace(/\.(epub|pdf|txt)$/i, ""),
      author: "Unknown Author",
      rel: res.rel,
      bytes: file.size,
    });
  };

  const renderOpenGrid = (books: BookHit[], titlePrefix = "") => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
      {books.map((book) => (
        <div
          key={book.id}
          className="group flex flex-col justify-between rounded-2xl border border-border/50 bg-card/60 p-3 shadow-md backdrop-blur-sm transition-all duration-200 hover:border-gold/40 hover:bg-card hover:shadow-xl"
        >
          <div>
            <BookCover
              title={book.title}
              author={book.author}
              coverUrl={book.cover}
              format={book.format}
              badge={downloaded[book.id] ? "Saved" : undefined}
            />
            <div className="mt-3">
              <h3
                className="line-clamp-1 font-display text-xs sm:text-sm font-semibold text-foreground group-hover:text-gold transition-colors"
                title={book.title}
              >
                {book.title}
              </h3>
              <p
                className="mt-0.5 line-clamp-1 text-[11px] text-muted"
                title={book.author}
              >
                {book.author}
                {book.year ? ` · ${book.year}` : ""}
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-faint">
                <span>{book.source}</span>
                {book.format ? (
                  <>
                    <span>·</span>
                    <span className="font-mono uppercase">{book.format}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-border/40 flex items-center gap-1.5">
            {errors[book.id] ? (
              <p className="mb-2 text-[10px] text-danger">{errors[book.id]}</p>
            ) : null}
            <Button
              variant="gold"
              size="sm"
              disabled={downloading[book.id]}
              onClick={() => void handleReadOrDownload(book, "read")}
              className="h-8 flex-1 rounded-xl text-xs font-semibold transition-all shadow-sm"
              title="Read book directly in browser"
            >
              {downloading[book.id] ? (
                <LoaderCircle className="size-3.5 animate-spin mr-1.5" />
              ) : (
                <BookOpen className="size-3.5 mr-1.5" />
              )}
              Read
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={downloading[book.id]}
              onClick={() => void handleReadOrDownload(book, "download")}
              className="size-8 rounded-xl border border-border/60 hover:text-gold hover:border-gold/40 transition-colors"
              title="Download EPUB file to device"
            >
              <Download className="size-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );

  const renderLicensedGrid = (items: LicensedHit[], label: string) =>
    items.length === 0 ? null : (
      <div className="mt-8 space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-sm sm:text-base font-semibold tracking-wide text-foreground">
            {label}
          </h2>
          <span className="text-[11px] text-muted">
            Legal storefronts & libraries
          </span>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          {honesty ||
            "Available from booksellers and libraries. If you already own a compatible copy, you can add it to your shelf."}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6 pt-2">
          {items.map((book) => (
            <div
              key={book.id}
              className="group flex flex-col justify-between rounded-2xl border border-border/50 bg-card/60 p-3 shadow-md backdrop-blur-sm transition-all duration-200 hover:border-gold/30 hover:bg-card hover:shadow-xl"
            >
              <div>
                <BookCover
                  title={book.title}
                  author={book.author}
                  coverUrl={book.cover}
                  badge="Copyright"
                />
                <div className="mt-3">
                  <h3
                    className="line-clamp-1 font-display text-xs sm:text-sm font-semibold text-foreground group-hover:text-gold transition-colors"
                    title={book.title}
                  >
                    {book.title}
                  </h3>
                  <p
                    className="mt-0.5 line-clamp-1 text-[11px] text-muted"
                    title={book.author}
                  >
                    {book.author}
                    {book.year ? ` · ${book.year}` : ""}
                  </p>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-border/40 space-y-1.5">
                <div className="flex flex-wrap gap-1">
                  {(book.actions ?? []).slice(0, 3).map((a) => (
                    <a
                      key={`${book.id}-${a.label}`}
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-6 items-center rounded-lg border border-border/60 bg-raised/70 px-2 text-[10px] font-medium text-muted hover:text-gold hover:border-gold/40 transition-colors"
                    >
                      {a.label}
                    </a>
                  ))}
                </div>
                <Button
                  variant="quiet"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  className="h-7 w-full rounded-lg text-[11px] font-medium text-gold hover:bg-gold/10"
                >
                  <Upload className="size-3 mr-1" />
                  Sideload
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );

  return (
    <div className="arena-page max-w-6xl mx-auto space-y-7 pb-16 px-4 sm:px-6">
      {/* Header & Overview */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-gold/15 text-gold border border-gold/30 shadow-inner">
            <BookOpen className="size-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Books
            </h1>
            <p className="text-xs sm:text-sm text-muted">
              Your shelf, enduring classics, and focused in-browser reading.
            </p>
          </div>
        </div>

        {/* Gentle Context Note */}
        <div className="flex items-start gap-2.5 rounded-2xl border border-border/50 bg-card/40 px-3.5 py-2.5 text-xs text-muted/90 backdrop-blur-sm">
          <BookOpen className="size-4 shrink-0 text-gold mt-0.5" />
          <p className="leading-relaxed">
            Keep a classic, continue something already on your shelf, or add a
            compatible book you own.
          </p>
        </div>
      </div>

      {/* Search Input Bar */}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSearch();
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search authors, titles (Holmes, Dracula, Austen, Frankenstein)…"
            className="h-11 w-full rounded-2xl border border-border/60 bg-card/80 pl-10 pr-10 text-sm shadow-sm transition-all placeholder:text-faint focus:border-gold/60 focus:bg-card focus:outline-none focus:ring-2 focus:ring-gold/20"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSearched(false);
                setResults([]);
                setLicensed([]);
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <Button
          type="submit"
          variant="gold"
          size="sm"
          disabled={searching}
          className="h-11 px-5 rounded-2xl font-semibold shadow-md"
        >
          {searching ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            "Search"
          )}
        </Button>
      </form>

      {/* Error & Status Alerts */}
      {errors.__search ? (
        <p className="flex items-center gap-2 text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl px-3.5 py-2">
          <TriangleAlert className="size-4 shrink-0" /> {errors.__search}
        </p>
      ) : null}
      {unavailable.length > 0 ? (
        <p className="flex items-center gap-2 text-xs text-muted bg-card/60 border border-border/50 rounded-xl px-3 py-2">
          <TriangleAlert className="size-3.5 text-gold shrink-0" />
          Could not reach {unavailable.join(" or ")}. Showing results from
          reachable catalogs.
        </p>
      ) : null}

      {/* Search Results */}
      {searched ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
            <h2 className="font-display text-base font-semibold text-foreground">
              Search Results
            </h2>
            <button
              type="button"
              onClick={() => {
                setSearched(false);
                setQuery("");
                setResults([]);
                setLicensed([]);
              }}
              className="text-xs font-semibold text-gold hover:underline"
            >
              Back to Discover
            </button>
          </div>

          {results.length > 0 ? (
            renderOpenGrid(results)
          ) : !searching && licensed.length === 0 && !errors.__search ? (
            <div className="rounded-2xl border border-border/50 bg-card/40 p-8 text-center">
              <BookOpen className="mx-auto size-8 text-muted/50 mb-2" />
              <p className="text-sm font-medium text-foreground">
                No open titles found
              </p>
              <p className="mt-1 text-xs text-muted max-w-md mx-auto">
                No classic matches yet. Try the author, a shorter title, or look
                in stores and libraries.
              </p>
            </div>
          ) : null}

          {renderLicensedGrid(licensed, "Get this legally")}
        </div>
      ) : null}

      {/* On This Box / Bookshelf (Primary Shelf) */}
      {!searched && shelf && shelf.length > 0
        ? (() => {
            const isPdf = (rel: string) => /\.pdf$/i.test(rel);
            const epubCount = shelf.filter((b) => !isPdf(b.rel)).length;
            const pdfCount = shelf.filter((b) => isPdf(b.rel)).length;
            const displayedShelf = shelf.filter((b) => {
              if (shelfFilter === "epub") return !isPdf(b.rel);
              if (shelfFilter === "pdf") return isPdf(b.rel);
              return true;
            });

            return (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <Library className="size-5 text-gold" />
                    <h2 className="font-display text-lg font-bold text-foreground">
                      Your shelf
                    </h2>
                    <span className="rounded-full bg-gold/15 border border-gold/30 px-2 py-0.5 text-[11px] font-bold text-gold">
                      {shelf.length} {shelf.length === 1 ? "book" : "books"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Format Filter Pills */}
                    <div className="flex items-center rounded-xl bg-raised/70 border border-border/60 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setShelfFilter("all")}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                          shelfFilter === "all"
                            ? "bg-gold/20 text-gold font-semibold shadow-sm"
                            : "text-muted hover:text-foreground"
                        }`}
                      >
                        All ({shelf.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setShelfFilter("epub")}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                          shelfFilter === "epub"
                            ? "bg-gold/20 text-gold font-semibold shadow-sm"
                            : "text-muted hover:text-foreground"
                        }`}
                      >
                        EPUB ({epubCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setShelfFilter("pdf")}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                          shelfFilter === "pdf"
                            ? "bg-gold/20 text-gold font-semibold shadow-sm"
                            : "text-muted hover:text-foreground"
                        }`}
                      >
                        PDF ({pdfCount})
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/20 transition-all"
                    >
                      <Upload className="size-3.5" />
                      Sideload
                    </button>
                  </div>
                </div>

                {displayedShelf.length === 0 ? (
                  <div className="rounded-2xl border border-border/50 bg-card/40 p-8 text-center">
                    <BookOpen className="mx-auto size-8 text-muted/50 mb-2" />
                    <p className="text-sm font-medium text-foreground">
                      No {shelfFilter.toUpperCase()} books on this shelf
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Try switching filters or sideloading a{" "}
                      {shelfFilter.toUpperCase()} file.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                    {displayedShelf.map((b) => (
                      <div
                        key={b.rel}
                        className="group flex flex-col justify-between rounded-2xl border border-border/50 bg-card/70 p-3 shadow-md backdrop-blur-sm transition-all duration-200 hover:border-gold/50 hover:bg-card hover:shadow-2xl"
                      >
                        <div>
                          <BookCover
                            title={b.title}
                            author={b.author}
                            coverUrl={b.cover}
                            badge={isPdf(b.rel) ? "PDF" : "EPUB"}
                          />
                          <div className="mt-3">
                            <h3
                              className="line-clamp-1 font-display text-xs sm:text-sm font-semibold text-foreground group-hover:text-gold transition-colors"
                              title={b.title}
                            >
                              {b.title}
                            </h3>
                            <p
                              className="mt-0.5 line-clamp-1 text-[11px] text-muted"
                              title={b.author}
                            >
                              {b.author}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center gap-2">
                          <Button
                            variant="gold"
                            size="sm"
                            onClick={() => setReading(b)}
                            className="h-8 flex-1 rounded-xl text-xs font-semibold shadow-sm"
                          >
                            <BookOpen className="size-3.5 mr-1" />
                            {bookProgress[b.rel] > 0 ? (
                              "Continue"
                            ) : (
                              <span>Read</span>
                            )}
                          </Button>
                          <a
                            href={`/api/books/file?rel=${encodeURIComponent(b.rel)}`}
                            download
                            className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-raised/70 text-muted hover:text-gold hover:border-gold/40 hover:bg-raised transition-all"
                            title={`Download ${isPdf(b.rel) ? "PDF" : "EPUB"} to Device`}
                          >
                            <Download className="size-3.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()
        : null}

      {/* Discover / Featured Public Domain Titles */}
      {!searched ? (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
            <div className="flex items-center gap-2">
              <Compass className="size-5 text-gold" />
              <h2 className="font-display text-lg font-bold text-foreground">
                Discover
              </h2>
            </div>
            <span className="text-xs text-muted">Classics to keep</span>
          </div>

          {catalog.length > 0 ? (
            renderOpenGrid(catalog)
          ) : (
            <div className="flex items-center justify-center py-12 text-sm text-muted">
              <LoaderCircle className="size-5 animate-spin mr-2 text-gold" />
              Loading featured books…
            </div>
          )}

          {renderLicensedGrid(featuredLicensed, "In stores and libraries")}
        </div>
      ) : null}

      {/* Personal import */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card/90 to-card/50 p-5 shadow-lg backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold border border-gold/30">
              <BookOpen className="size-5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground">
                Bring your own books
              </h3>
              <p className="mt-1 text-xs text-muted/90 max-w-xl">
                Add a compatible EPUB or PDF you own. It joins this shelf and
                opens in the ReelOS reader.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              variant="gold"
              size="sm"
              onClick={() => fileRef.current?.click()}
              className="h-9 px-4 rounded-xl text-xs font-semibold shadow-md"
            >
              <Upload className="size-3.5 mr-1.5" />
              Add EPUB or PDF
            </Button>
          </div>
        </div>

        {/* Hidden File Picker */}
        <input
          ref={fileRef}
          type="file"
          accept=".epub,.pdf,.txt,application/epub+zip,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void handleSideload(f);
          }}
        />
        {sideloadMsg ? (
          <p className="mt-3 text-xs text-gold font-medium bg-gold/10 border border-gold/20 rounded-xl px-3 py-1.5 inline-block">
            {sideloadMsg}
          </p>
        ) : null}
      </div>

      {/* In-App Reader Modal */}
      {reading ? (
        <BookReader
          book={reading}
          initialProgress={bookProgress[reading.rel] || 0}
          initialLocation={bookLocations[reading.rel]}
          bookmarks={bookBookmarks[reading.rel] || []}
          appearance={readingAppearance}
          onProgress={(progress, location) =>
            onProgress?.(reading.rel, progress, location)
          }
          onToggleBookmark={(location) =>
            onToggleBookmark?.(reading.rel, location)
          }
          onAppearance={onAppearance}
          onClose={() => setReading(null)}
        />
      ) : null}
    </div>
  );
}
