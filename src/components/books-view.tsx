import { useEffect, useRef, useState } from "react";
import { BookOpen, Download, LoaderCircle, Search, TriangleAlert, Upload } from "lucide-react";
import { BookReader } from "@/components/book-reader";
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

type LicensedHit = {
  id: string;
  title: string;
  author: string;
  source: string;
  year?: number | null;
  honesty?: string;
  actions?: { kind: string; label: string; url: string }[];
};

type ShelfBook = { title: string; author: string; rel: string; bytes: number };

function readParam() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("read") || "";
}

export function BooksView() {
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
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reading, setReading] = useState<ShelfBook | null>(null);
  const [sideloadMsg, setSideloadMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshShelf = () =>
    fetch("/api/books/library", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ books?: ShelfBook[] }>)
      .then((j) => setShelf(j.books || []))
      .catch(() => setShelf([]));

  useEffect(() => {
    if (!booksOn) return;
    void refreshShelf();
    void fetch("/api/books/discover", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ featured?: BookHit[]; licensed?: LicensedHit[]; unavailable?: string[] }>)
      .then((j) => {
        setCatalog(j.featured || []);
        setFeaturedLicensed(j.licensed || []);
        if (j.unavailable?.length) setUnavailable(j.unavailable);
      })
      .catch(() => setCatalog([]));
  }, [booksOn]);

  useEffect(() => {
    const rel = readParam();
    if (!rel || !shelf) return;
    const hit = shelf.find((b) => b.rel === rel);
    if (hit) setReading(hit);
  }, [shelf]);

  if (!booksOn) {
    return (
      <div className="px-5 py-6 md:px-10 md:py-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Books</h1>
        <p className="mt-2 text-sm text-muted">
          Books is off. Settings → Updates → Beta channel turns on Arena chrome and Books. Kavita stays stopped until then.
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
      }).then(
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
    } catch {
      setResults([]);
      setLicensed([]);
      setUnavailable([]);
      setHonesty("");
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
      const lib = await fetch("/api/books/library", { cache: "no-store" }).then(
        (r) => r.json() as Promise<{ books?: ShelfBook[] }>,
      );
      setShelf(lib.books || []);
      if (res.rel) {
        const saved = (lib.books || []).find((b) => b.rel === res.rel);
        if (saved) setReading(saved);
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
    }).then((r) => r.json() as Promise<{ ok?: boolean; rel?: string; error?: string }>);
    if (!res.ok || !res.rel) {
      setSideloadMsg(res.error || "Sideload failed.");
      return;
    }
    setSideloadMsg("Saved on the box. Opening the in-app reader.");
    await refreshShelf();
    setReading({
      title: file.name.replace(/\.(epub|pdf|txt)$/i, ""),
      author: "Unknown Author",
      rel: res.rel,
      bytes: file.size,
    });
  };

  const kavitaUrl =
    typeof window !== "undefined" ? `http://${window.location.hostname}:5000` : "#";

  const renderOpen = (books: BookHit[]) => (
    <ul className="mt-3 divide-y divide-border">
      {books.map((book) => (
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
          <Button variant="gold" size="sm" disabled={downloading[book.id]} onClick={() => void handleDownload(book)}>
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
  );

  const renderLicensed = (items: LicensedHit[], label: string) =>
    items.length === 0 ? null : (
      <div className="mt-5">
        <h2 className="font-display text-sm font-medium">{label}</h2>
        <p className="mt-1 text-xs text-muted">
          {honesty ||
            "In copyright. This box cannot fetch the full file. Buy, borrow from a library, or sideload a DRM-free EPUB you own."}
        </p>
        <ul className="mt-2 divide-y divide-border">
          {items.map((book) => (
            <li key={book.id} className="py-3">
              <p className="truncate text-sm font-medium">{book.title}</p>
              <p className="mt-0.5 text-xs text-muted">
                {book.author}
                {book.year ? ` · ${book.year}` : ""} · {book.source} · in copyright
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(book.actions ?? []).slice(0, 6).map((a) => (
                  <a
                    key={`${book.id}-${a.label}`}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-7 items-center rounded-full bg-card-2 px-2.5 text-[11px] text-circuit"
                  >
                    {a.label}
                  </a>
                ))}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex h-7 items-center rounded-full bg-card-2 px-2.5 text-[11px] text-circuit"
                >
                  Sideload
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <div className="arena-page">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Books</h1>
      <p className="mt-1 max-w-xl text-sm text-muted">
        Books Discover is browse/featured from legal catalogs — not Seerr. In-copyright series (Hunger Games) are buy,
        borrow, or sideload. Download still saves a real DRM-free file for iOS Books / Android; Read opens it here.
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
            placeholder="Holmes, Dracula, Hunger Games…"
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
      {searched && !searching && results.length === 0 && licensed.length === 0 && !errors.__search ? (
        <p className="mt-4 text-sm text-muted">
          Nothing in the open catalogs matches that. They carry public domain and openly licensed titles — not
          in-copyright series.
        </p>
      ) : null}

      {results.length > 0 ? renderOpen(results) : null}
      {renderLicensed(licensed, "Get this legally")}

      {!searched ? (
        <div className="mt-6">
          <h2 className="font-display text-sm font-medium">Discover</h2>
          <p className="mt-1 text-xs text-muted">
            Featured public-domain keep-files. Movie/TV Discover on the Discover tab is still Seerr.
          </p>
          {catalog.length > 0 ? (
            renderOpen(catalog)
          ) : (
            <p className="mt-3 text-sm text-muted">Loading featured books…</p>
          )}
          {renderLicensed(featuredLicensed, "In stores and libraries")}
        </div>
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
          Sideload a DRM-free EPUB or PDF — Adobe DRM will fail in the reader.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <a href={kavitaUrl} target="_blank" rel="noreferrer" className="text-sm text-circuit">
            Open Kavita
          </a>
          <button type="button" className="text-sm text-circuit" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1 inline size-3.5" />
            Sideload EPUB/PDF
          </button>
        </div>
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
        {sideloadMsg ? <p className="mt-2 text-xs text-muted">{sideloadMsg}</p> : null}
      </div>

      {shelf && shelf.length > 0 ? (
        <div className="mt-4">
          <h2 className="font-display text-sm font-medium">On this box</h2>
          <ul className="mt-2 divide-y divide-border">
            {shelf.map((b) => (
              <li key={b.rel} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{b.title}</p>
                  <p className="text-xs text-muted">{b.author}</p>
                </div>
                <Button variant="circuit" size="sm" onClick={() => setReading(b)}>
                  Read
                </Button>
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

      {reading ? <BookReader book={reading} onClose={() => setReading(null)} /> : null}
    </div>
  );
}
