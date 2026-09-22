import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  ListTree,
  Loader2,
  Moon,
  Search,
  Sun,
  Type,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReadingAppearance, ReaderTheme } from "@/experience/experience-state";

const LOCAL_JSZIP_JS = "/vendor/jszip.min.js";
const CDN_JSZIP_JS = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";

const LOCAL_EPUB_JS = "/vendor/epub.min.js";
const CDN_EPUB_JS = "https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js";

const LOCAL_PDF_JS = "/vendor/pdf.min.js";
const CDN_PDF_JS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";

const LOCAL_PDF_WORKER = "/vendor/pdf.worker.min.js";
const CDN_PDF_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

type ShelfBook = { title: string; author: string; rel: string };

const THEMES: Record<
  ReaderTheme,
  {
    name: string;
    bg: string;
    fg: string;
    cardBg: string;
    border: string;
    accent: string;
    css: {
      body: Record<string, string>;
      p: Record<string, string>;
      "h1, h2, h3, h4, h5, h6": Record<string, string>;
      "a, a:link, a:visited": Record<string, string>;
    };
  }
> = {
  dark: {
    name: "OLED Noir",
    bg: "#0B0D10",
    fg: "#E4E4E7",
    cardBg: "#12151B",
    border: "#27272A",
    accent: "#E5A93C",
    css: {
      body: {
        background: "#0B0D10 !important",
        color: "#E4E4E7 !important",
        "font-family": "Charter, Georgia, serif !important",
      },
      p: { color: "#D4D4D8 !important", "line-height": "1.75 !important" },
      "h1, h2, h3, h4, h5, h6": { color: "#F4F4F5 !important" },
      "a, a:link, a:visited": { color: "#E5A93C !important" },
    },
  },
  sepia: {
    name: "Warm Sepia",
    bg: "#F5EEDB",
    fg: "#3D2E1E",
    cardBg: "#EFE5CE",
    border: "#DBCDB0",
    accent: "#9A6520",
    css: {
      body: {
        background: "#F5EEDB !important",
        color: "#3D2E1E !important",
        "font-family": "Charter, Georgia, serif !important",
      },
      p: { color: "#3D2E1E !important", "line-height": "1.75 !important" },
      "h1, h2, h3, h4, h5, h6": { color: "#2B1D0E !important" },
      "a, a:link, a:visited": { color: "#9A6520 !important" },
    },
  },
  light: {
    name: "Crisp Paper",
    bg: "#FAFAF9",
    fg: "#1C1917",
    cardBg: "#F5F5F4",
    border: "#E7E5E4",
    accent: "#B45309",
    css: {
      body: {
        background: "#FAFAF9 !important",
        color: "#1C1917 !important",
        "font-family": "Charter, Georgia, serif !important",
      },
      p: { color: "#292524 !important", "line-height": "1.75 !important" },
      "h1, h2, h3, h4, h5, h6": { color: "#1C1917 !important" },
      "a, a:link, a:visited": { color: "#B45309 !important" },
    },
  },
  slate: {
    name: "Midnight Slate",
    bg: "#0F172A",
    fg: "#E2E8F0",
    cardBg: "#1E293B",
    border: "#334155",
    accent: "#38BDF8",
    css: {
      body: {
        background: "#0F172A !important",
        color: "#E2E8F0 !important",
        "font-family": "Charter, Georgia, serif !important",
      },
      p: { color: "#CBD5E1 !important", "line-height": "1.75 !important" },
      "h1, h2, h3, h4, h5, h6": { color: "#F8FAFC !important" },
      "a, a:link, a:visited": { color: "#38BDF8 !important" },
    },
  },
};

const FONT_SIZES = [85, 100, 115, 130, 150];

function loadScript(src: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Could not load script ${src}`));
    document.head.appendChild(s);
  });
}

async function loadScriptWithFallback(primary: string, fallback: string): Promise<string> {
  try {
    await loadScript(primary);
    return primary;
  } catch {
    await loadScript(fallback);
    return fallback;
  }
}

function isPdf(rel: string) {
  return /\.pdf$/i.test(rel);
}

export function BookReader({
  book,
  initialProgress = 0,
  initialLocation,
  bookmarks = [],
  appearance = { theme: "dark", fontSizeIndex: 1 },
  onProgress,
  onToggleBookmark,
  onAppearance,
  onClose,
}: {
  book: ShelfBook;
  initialProgress?: number;
  initialLocation?: string;
  bookmarks?: string[];
  appearance?: ReadingAppearance;
  onProgress?: (progress: number, location?: string) => void;
  onToggleBookmark?: (location: string) => void;
  onAppearance?: (patch: Partial<ReadingAppearance>) => void;
  onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageLabel, setPageLabel] = useState("");
  const [theme, setTheme] = useState<ReaderTheme>(appearance.theme);
  const [fontSizeIndex, setFontSizeIndex] = useState(appearance.fontSizeIndex);
  const [showControls, setShowControls] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const [chapters, setChapters] = useState<Array<{ label: string; href: string }>>([]);
  const [readerQuery, setReaderQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<
    Array<{ label: string; location: string; excerpt?: string }>
  >([]);

  const turn = useRef<{ next: () => void; prev: () => void } | null>(null);
  const renditionRef = useRef<any>(null);
  const bookObjectRef = useRef<any>(null);
  const pdfDocumentRef = useRef<any>(null);
  const textContentRef = useRef("");
  const pdfPaintRef = useRef<((page: number) => Promise<void>) | null>(null);
  const currentLocationRef = useRef(initialLocation || "");
  const onProgressRef = useRef(onProgress);
  const onAppearanceRef = useRef(onAppearance);

  useEffect(() => {
    onProgressRef.current = onProgress;
    onAppearanceRef.current = onAppearance;
  }, [onProgress, onAppearance]);

  const activeTheme = THEMES[theme];
  const activeFontSize = FONT_SIZES[fontSizeIndex];

  // Apply theme and font size dynamically to active EPUB rendition
  useEffect(() => {
    if (!renditionRef.current) return;
    try {
      renditionRef.current.themes.select(theme);
      renditionRef.current.themes.fontSize(`${activeFontSize}%`);
    } catch {
      /* rendition not ready yet */
    }
  }, [theme, activeFontSize]);

  useEffect(() => {
    onAppearanceRef.current?.({ theme, fontSizeIndex });
  }, [theme, fontSizeIndex]);

  const openLocation = (location: string) => {
    if (location.startsWith("pdf:")) {
      const page = Number(location.slice(4));
      if (Number.isFinite(page)) void pdfPaintRef.current?.(page);
    } else if (location.startsWith("text:")) {
      const offset = Number(location.slice(5));
      const targets = [...(host.current?.querySelectorAll<HTMLElement>("[data-text-offset]") ?? [])];
      const target = targets.reduce<HTMLElement | undefined>((nearest, candidate) =>
        Number(candidate.dataset.textOffset) <= offset ? candidate : nearest, targets[0]);
      target?.scrollIntoView({ block: "start" });
      currentLocationRef.current = location;
    } else {
      void renditionRef.current?.display(location);
    }
    setShowNavigator(false);
  };

  const searchInside = async () => {
    const needle = readerQuery.trim().toLowerCase();
    if (!needle) return;
    setSearching(true);
    setSearchResults([]);
    try {
      if (textContentRef.current) {
        const text = textContentRef.current;
        const matches: Array<{ label: string; location: string; excerpt?: string }> = [];
        let from = 0;
        while (matches.length < 30) {
          const at = text.toLowerCase().indexOf(needle, from);
          if (at < 0) break;
          matches.push({
            label: `Match ${matches.length + 1}`,
            location: `text:${at}`,
            excerpt: text.slice(Math.max(0, at - 45), at + needle.length + 70),
          });
          from = at + Math.max(1, needle.length);
        }
        setSearchResults(matches);
      } else if (pdfDocumentRef.current) {
        const doc = pdfDocumentRef.current;
        const matches: Array<{ label: string; location: string; excerpt?: string }> = [];
        for (let pageNumber = 1; pageNumber <= doc.numPages && matches.length < 30; pageNumber += 1) {
          const page = await doc.getPage(pageNumber);
          const content = await page.getTextContent();
          const text = content.items.map((item: any) => item.str || "").join(" ");
          const at = text.toLowerCase().indexOf(needle);
          if (at >= 0) {
            matches.push({
              label: `Page ${pageNumber}`,
              location: `pdf:${pageNumber}`,
              excerpt: text.slice(Math.max(0, at - 45), at + needle.length + 70),
            });
          }
        }
        setSearchResults(matches);
      } else if (bookObjectRef.current) {
        const bookObject = bookObjectRef.current;
        const items = bookObject.spine?.spineItems || bookObject.spine?.items || [];
        const matches: Array<{ label: string; location: string; excerpt?: string }> = [];
        for (const item of items) {
          if (matches.length >= 30) break;
          await item.load(bookObject.load.bind(bookObject));
          const found = item.find(needle) || [];
          for (const hit of found.slice(0, 5)) {
            matches.push({
              label: hit.excerpt || "Match",
              location: hit.cfi,
              excerpt: hit.excerpt,
            });
          }
          item.unload?.();
        }
        setSearchResults(matches.slice(0, 30));
      }
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let cleanupTextScroll: (() => void) | undefined;
    const src = `/api/books/file?rel=${encodeURIComponent(book.rel)}&inline=1`;
    const node = host.current;
    if (!node) return;

    const run = async () => {
      setLoading(true);
      setErr(null);
      try {
        if (/\.txt$/i.test(book.rel)) {
          const response = await fetch(src);
          if (!response.ok) throw new Error(`Could not load text file (${response.status})`);
          const text = await response.text();
          if (cancelled) return;
          textContentRef.current = text;
          const lines = text.split(/\r?\n/);
          const fragment = document.createDocumentFragment();
          const textChapters: Array<{ label: string; href: string }> = [];
          let offset = 0;
          for (const line of lines) {
            const element = document.createElement(/^\s*(chapter|part)\b/i.test(line) ? "h2" : "p");
            element.textContent = line || " ";
            element.dataset.textOffset = String(offset);
            element.className = element.tagName === "H2"
              ? "mb-4 mt-10 font-display text-2xl font-semibold first:mt-0"
              : "mb-4 whitespace-pre-wrap leading-8";
            if (element.tagName === "H2") textChapters.push({ label: line.trim(), href: `text:${offset}` });
            fragment.appendChild(element);
            offset += line.length + 1;
          }
          node.innerHTML = "";
          node.className = "size-full overflow-y-auto px-6 py-8 sm:px-12";
          const article = document.createElement("article");
          article.className = "mx-auto max-w-3xl";
          article.appendChild(fragment);
          node.appendChild(article);
          setChapters(textChapters);
          const initialOffset = initialLocation?.startsWith("text:") ? Number(initialLocation.slice(5)) : 0;
          currentLocationRef.current = `text:${Number.isFinite(initialOffset) ? initialOffset : 0}`;
          const reportPosition = () => {
            const max = Math.max(1, node.scrollHeight - node.clientHeight);
            const progress = Math.max(0, Math.min(1, node.scrollTop / max));
            const location = `text:${Math.round(progress * Math.max(0, text.length - 1))}`;
            currentLocationRef.current = location;
            setPageLabel(`${Math.round(progress * 100)}%`);
            onProgressRef.current?.(progress, location);
          };
          node.addEventListener("scroll", reportPosition, { passive: true });
          cleanupTextScroll = () => node.removeEventListener("scroll", reportPosition);
          turn.current = {
            next: () => node.scrollBy({ top: node.clientHeight * 0.85, behavior: "smooth" }),
            prev: () => node.scrollBy({ top: -node.clientHeight * 0.85, behavior: "smooth" }),
          };
          if (initialOffset > 0) {
            const progress = initialOffset / Math.max(1, text.length - 1);
            node.scrollTop = progress * Math.max(0, node.scrollHeight - node.clientHeight);
          }
          reportPosition();
          if (!cancelled) setLoading(false);
          return;
        }
        if (isPdf(book.rel)) {
          await loadScriptWithFallback(LOCAL_PDF_JS, CDN_PDF_JS);
          const pdfjsLib = (
            window as unknown as {
              pdfjsLib?: {
                getDocument: Function;
                GlobalWorkerOptions: { workerSrc: string };
              };
            }
          ).pdfjsLib;
          if (!pdfjsLib) throw new Error("PDF.js did not load");
          try {
            const workerRes = await fetch(LOCAL_PDF_WORKER, { method: "HEAD" });
            pdfjsLib.GlobalWorkerOptions.workerSrc = workerRes.ok
              ? LOCAL_PDF_WORKER
              : CDN_PDF_WORKER;
          } catch {
            pdfjsLib.GlobalWorkerOptions.workerSrc = CDN_PDF_WORKER;
          }

          const doc = await pdfjsLib.getDocument(src).promise;
          if (cancelled) return;
          pdfDocumentRef.current = doc;

          const savedPdfPage = initialLocation?.startsWith("pdf:")
            ? Number(initialLocation.slice(4))
            : 0;
          let pageNum = Math.max(
            1,
            Math.min(
              doc.numPages,
              savedPdfPage || Math.round(initialProgress * Math.max(1, doc.numPages - 1)) + 1,
            ),
          );
          const canvas = document.createElement("canvas");
          canvas.className = "mx-auto max-h-[calc(100dvh-7rem)] w-full max-w-3xl shadow-2xl rounded-lg";
          node.innerHTML = "";
          node.appendChild(canvas);

          const paint = async (n: number) => {
            pageNum = Math.max(1, Math.min(doc.numPages, n));
            const page = await doc.getPage(pageNum);
            const unscaled = page.getViewport({ scale: 1 });
            const width = Math.min(node.clientWidth || 360, 800);
            const scale = width / unscaled.width;
            const viewport = page.getViewport({ scale });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            await page.render({ canvasContext: ctx, viewport }).promise;
            const location = `pdf:${pageNum}`;
            currentLocationRef.current = location;
            setPageLabel(`${pageNum} / ${doc.numPages}`);
            onProgressRef.current?.(
              doc.numPages <= 1 ? 1 : (pageNum - 1) / (doc.numPages - 1),
              location,
            );
          };
          pdfPaintRef.current = paint;

          turn.current = {
            next: () => {
              if (pageNum < doc.numPages) {
                pageNum += 1;
                void paint(pageNum);
              }
            },
            prev: () => {
              if (pageNum > 1) {
                pageNum -= 1;
                void paint(pageNum);
              }
            },
          };
          await paint(pageNum);
          if (!cancelled) setLoading(false);
          return;
        }

        // EPUB reader: load JSZip first, then EPUB.js
        await loadScriptWithFallback(LOCAL_JSZIP_JS, CDN_JSZIP_JS);
        await loadScriptWithFallback(LOCAL_EPUB_JS, CDN_EPUB_JS);
        const ePub = (window as unknown as { ePub?: (u: any) => any }).ePub;
        if (!ePub) throw new Error("EPUB.js did not load");

        // Fetch as ArrayBuffer for guaranteed in-memory unzipping without path resolution issues
        const fileRes = await fetch(src);
        if (!fileRes.ok) throw new Error(`Could not load book file (${fileRes.status})`);
        const fileBuffer = await fileRes.arrayBuffer();
        if (cancelled) return;

        node.innerHTML = "";
        const bookObj = ePub(fileBuffer);
        bookObjectRef.current = bookObj;
        bookObj.on?.("openFailed", (error: any) => {
          if (!cancelled) {
            setLoading(false);
            setErr(
              "This file is unreadable or not a valid EPUB archive. Try re-downloading or sideloading a DRM-free copy.",
            );
          }
        });
        const rendition = bookObj.renderTo(node, {
          width: "100%",
          height: "100%",
          spread: "none",
          allowScriptedContent: false,
        });
        renditionRef.current = rendition;

        // Hide offscreen accessibility stubs and negative-margin hacks that distort column sizing
        rendition.hooks?.content?.register((contents: any) => {
          const doc = contents?.document;
          if (!doc) return;
          const style = doc.createElement("style");
          style.textContent = `
            [style*="-999"],
            [style*="9999px"],
            section[epub\\:type~="titlepage"] h1,
            section[epub\\:type~="titlepage"] p,
            section[epub\\:type~="colophon"] h2,
            section[epub\\:type~="imprint"] h2,
            .epub-type-contains-word-titlepage h1,
            .epub-type-contains-word-titlepage p,
            .epub-type-contains-word-colophon h2,
            .epub-type-contains-word-imprint h2,
            .sr-only,
            .visually-hidden {
              display: none !important;
            }
          `;
          doc.head?.appendChild(style);
        });

        // Register all themes
        Object.entries(THEMES).forEach(([key, cfg]) => {
          rendition.themes.register(key, cfg.css);
        });
        rendition.themes.select(theme);
        rendition.themes.fontSize(`${activeFontSize}%`);

        rendition.on?.("rendered", () => {
          if (!cancelled) setLoading(false);
        });

        // Guard with a safety timeout so unhandled promise stalls never freeze the UI
        const navigation = await bookObj.loaded.navigation;
        const flattenToc = (items: any[]): Array<{ label: string; href: string }> =>
          (items || []).flatMap((item) => [
            { label: String(item.label || "Chapter").trim(), href: item.href },
            ...flattenToc(item.subitems || []),
          ]);
        setChapters(flattenToc(navigation?.toc || []).filter((item) => item.href));

        const displayPromise = rendition.display(initialLocation || undefined);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Reader timed out loading the document.")), 15000),
        );
        await Promise.race([displayPromise, timeoutPromise]);
        if (cancelled) {
          bookObj.destroy?.();
          return;
        }
        setLoading(false);

        turn.current = {
          next: () => void rendition.next(),
          prev: () => void rendition.prev(),
        };

        const updateLocation = (location: any) => {
          if (!location?.start) return;
          const d = location.start.displayed;
          const spineTotal = bookObj?.spine?.length || (bookObj?.spine?.items?.length ?? 0);
          const spineIdx = location.start.index;
          const savedLocation = location.start.cfi;
          if (savedLocation) currentLocationRef.current = savedLocation;
          const sectionProgress = d?.total
            ? Math.max(0, (Number(d.page || 1) - 1) / Math.max(1, Number(d.total)))
            : 0;
          const progress =
            typeof location.start.percentage === "number" &&
            location.start.percentage > 0
              ? location.start.percentage
              : Math.max(
                  0,
                  Math.min(
                    1,
                    ((Number(spineIdx) || 0) + sectionProgress) /
                      Math.max(1, spineTotal),
                  ),
                );
          onProgressRef.current?.(progress, savedLocation);
          if (d && d.total > 1) {
            setPageLabel(`p. ${d.page} / ${d.total}${spineTotal > 1 && spineIdx !== undefined ? ` · Sec ${spineIdx + 1}/${spineTotal}` : ""}`);
          } else if (spineTotal > 1 && spineIdx !== undefined) {
            setPageLabel(`Section ${spineIdx + 1} / ${spineTotal}`);
          } else if (d) {
            setPageLabel(`${d.page} / ${d.total}`);
          }
        };

        updateLocation(rendition.currentLocation?.());
        rendition.on("relocated", updateLocation);
        rendition.on("displayedError", () => {
          setErr(
            "This file is DRM-protected (Adobe/LCP) or unreadable. ReelOS reads DRM-free EPUB and PDF only.",
          );
        });
      } catch (e) {
        if (!cancelled) {
          console.error("Book reader failed", e);
          setLoading(false);
          setErr(
            String(e).includes("DRM") || String(e).toLowerCase().includes("encrypt")
              ? "This file is DRM-protected (Adobe/LCP). ReelOS reads DRM-free EPUB and PDF only."
              : String(e).includes("timed out")
                ? "Reader timed out loading this book. The file may be corrupt or invalid. Try downloading the file to your device."
                : "Could not open that file in the in-app reader. Download it for iOS Books / Android, or sideload a DRM-free EPUB/PDF.",
          );
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      cleanupTextScroll?.();
      turn.current = null;
      renditionRef.current = null;
      bookObjectRef.current = null;
      pdfDocumentRef.current = null;
      textContentRef.current = "";
      pdfPaintRef.current = null;
      if (node) node.innerHTML = "";
    };
  }, [book.rel, initialLocation, initialProgress]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col transition-colors duration-300 select-none"
      style={{ backgroundColor: activeTheme.bg, color: activeTheme.fg }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between gap-2 border-b px-3 sm:px-5 py-2.5 shadow-sm transition-colors"
        style={{ borderColor: activeTheme.border, backgroundColor: activeTheme.cardBg }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="quiet"
            size="icon"
            aria-label="Close reader"
            onClick={onClose}
            className="hover:opacity-75"
          >
            <X className="size-4" />
          </Button>
          <div className="min-w-0">
            <p className="truncate text-xs sm:text-sm font-semibold">{book.title}</p>
            <p className="truncate text-[11px] opacity-75">{book.author}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            disabled={!currentLocationRef.current}
            onClick={() => onToggleBookmark?.(currentLocationRef.current)}
            aria-label={
              bookmarks.includes(currentLocationRef.current)
                ? "Remove bookmark"
                : "Add bookmark"
            }
            title="Bookmark this place"
          >
            {bookmarks.includes(currentLocationRef.current) ? (
              <BookmarkCheck className="size-4" />
            ) : (
              <Bookmark className="size-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNavigator((value) => !value)}
            className="h-8 gap-1.5 px-2.5 text-xs rounded-xl border border-border/50"
          >
            <ListTree className="size-3.5" />
            <span className="hidden sm:inline">Find</span>
          </Button>
          {/* Controls toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowControls((v) => !v)}
            className="h-8 gap-1.5 px-2.5 text-xs rounded-xl border border-border/50"
            title="Appearance & Typography"
          >
            <Type className="size-3.5" />
            <span className="hidden sm:inline">Theme</span>
          </Button>

          {/* Download file */}
          <a
            className="inline-flex h-8 items-center rounded-xl bg-gold px-3 text-xs font-semibold text-gold-fg shadow-sm hover:opacity-90 transition-opacity"
            href={`/api/books/file?rel=${encodeURIComponent(book.rel)}`}
            download
            title="Download DRM-free file to device"
          >
            <Download className="mr-1.5 size-3.5" />
            <span className="hidden sm:inline">Download</span>
          </a>
        </div>
      </header>

      {/* Typography & Appearance Drawer */}
      {showControls ? (
        <div
          className="border-b px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs transition-colors"
          style={{ borderColor: activeTheme.border, backgroundColor: activeTheme.cardBg }}
        >
          {/* Theme buttons */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] opacity-70 uppercase tracking-wider font-semibold">
              Theme:
            </span>
            <div className="flex gap-1.5">
              {(Object.keys(THEMES) as ReaderTheme[]).map((tKey) => {
                const tCfg = THEMES[tKey];
                const isCurrent = theme === tKey;
                return (
                  <button
                    key={tKey}
                    type="button"
                    onClick={() => setTheme(tKey)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all shadow-sm"
                    style={{
                      backgroundColor: tCfg.bg,
                      color: tCfg.fg,
                      borderColor: isCurrent ? tCfg.accent : tCfg.border,
                      boxShadow: isCurrent ? `0 0 0 1px ${tCfg.accent}` : "none",
                    }}
                  >
                    {tKey === "dark" || tKey === "slate" ? (
                      <Moon className="size-3" />
                    ) : (
                      <Sun className="size-3" />
                    )}
                    <span>{tCfg.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font Size Scaling */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] opacity-70 uppercase tracking-wider font-semibold">
              Text Size:
            </span>
            <div className="flex items-center gap-1 bg-background/50 rounded-lg p-0.5 border border-border/60">
              <button
                type="button"
                disabled={fontSizeIndex <= 0}
                onClick={() => setFontSizeIndex((i) => Math.max(0, i - 1))}
                className="px-2 py-0.5 rounded text-xs font-bold disabled:opacity-30 hover:bg-card"
                title="Decrease font size"
              >
                A-
              </button>
              <span className="px-2 font-mono text-[11px] font-semibold">{activeFontSize}%</span>
              <button
                type="button"
                disabled={fontSizeIndex >= FONT_SIZES.length - 1}
                onClick={() => setFontSizeIndex((i) => Math.min(FONT_SIZES.length - 1, i + 1))}
                className="px-2 py-0.5 rounded text-xs font-bold disabled:opacity-30 hover:bg-card"
                title="Increase font size"
              >
                A+
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showNavigator ? (
        <div
          className="max-h-[45dvh] overflow-y-auto border-b px-4 py-4 text-sm"
          style={{ borderColor: activeTheme.border, backgroundColor: activeTheme.cardBg }}
        >
          <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider opacity-65">
                Chapters and bookmarks
              </p>
              <div className="space-y-1">
                {bookmarks.map((location, index) => (
                  <button
                    key={location}
                    onClick={() => openLocation(location)}
                    className="block min-h-11 w-full rounded-lg px-3 text-left hover:bg-white/10"
                  >
                    Bookmark {index + 1}
                  </button>
                ))}
                {chapters.map((chapter) => (
                  <button
                    key={`${chapter.href}-${chapter.label}`}
                    onClick={() => openLocation(chapter.href)}
                    className="block min-h-11 w-full rounded-lg px-3 text-left hover:bg-white/10"
                  >
                    {chapter.label}
                  </button>
                ))}
                {!bookmarks.length && !chapters.length ? (
                  <p className="py-3 opacity-60">No chapter list or bookmarks yet.</p>
                ) : null}
              </div>
            </section>
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider opacity-65">
                Search this book
              </p>
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void searchInside();
                }}
              >
                <input
                  value={readerQuery}
                  onChange={(event) => setReaderQuery(event.target.value)}
                  placeholder="A name, place, or phrase"
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-black/15 px-3 outline-none focus:border-white/40"
                />
                <button
                  type="submit"
                  disabled={searching || !readerQuery.trim()}
                  className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-white/15 disabled:opacity-40"
                  aria-label="Search this book"
                >
                  {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                </button>
              </form>
              <div className="mt-2 space-y-1">
                {searchResults.map((result, index) => (
                  <button
                    key={`${result.location}-${index}`}
                    onClick={() => openLocation(result.location)}
                    className="block min-h-11 w-full rounded-lg px-3 py-2 text-left hover:bg-white/10"
                  >
                    <span className="line-clamp-2">{result.excerpt || result.label}</span>
                  </button>
                ))}
                {!searching && readerQuery && !searchResults.length ? (
                  <p className="py-3 opacity-60">No matches in this book yet.</p>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {/* Reader Viewport */}
      {err ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-3">
            <p className="text-sm text-danger font-medium">{err}</p>
            <p className="text-xs opacity-75">
              You can still download this file and open it in your native reader (Apple Books,
              Kindle app, Moon+ Reader, or ReadEra).
            </p>
          </div>
        </div>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {loading ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-xs">
              <Loader2 className="size-7 animate-spin text-gold" />
              <p className="text-xs font-medium text-muted">Opening book…</p>
            </div>
          ) : null}
          <div
            ref={host}
            className="size-full overflow-hidden transition-colors"
            style={{ backgroundColor: activeTheme.bg }}
          />
        </div>
      )}

      {/* Footer Navigation */}
      <footer
        className="flex items-center justify-between gap-2 border-t px-4 sm:px-6 py-2.5 shadow-sm transition-colors"
        style={{ borderColor: activeTheme.border, backgroundColor: activeTheme.cardBg }}
      >
        <Button
          variant="live"
          size="sm"
          onClick={() => turn.current?.prev()}
          className="rounded-xl px-3 font-semibold"
        >
          <ChevronLeft className="size-4 mr-1" /> Prev
        </Button>
        <span className="text-xs font-mono font-medium opacity-75">{pageLabel || " "}</span>
        <Button
          variant="live"
          size="sm"
          onClick={() => turn.current?.next()}
          className="rounded-xl px-3 font-semibold"
        >
          Next <ChevronRight className="size-4 ml-1" />
        </Button>
      </footer>
    </div>
  );
}
