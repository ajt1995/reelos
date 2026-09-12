import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const EPUB_JS = "https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js";
const PDF_JS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDF_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

type ShelfBook = { title: string; author: string; rel: string };

function loadScript(src: string) {
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
    s.onerror = () => reject(new Error(`Could not load reader script`));
    document.head.appendChild(s);
  });
}

function isPdf(rel: string) {
  return /\.pdf$/i.test(rel);
}

export function BookReader({
  book,
  onClose,
}: {
  book: ShelfBook;
  onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pageLabel, setPageLabel] = useState("");
  const turn = useRef<{ next: () => void; prev: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const src = `/api/books/file?rel=${encodeURIComponent(book.rel)}&inline=1`;
    const node = host.current;
    if (!node) return;

    const run = async () => {
      setErr(null);
      try {
        if (isPdf(book.rel)) {
          await loadScript(PDF_JS);
          const pdfjsLib = (window as unknown as { pdfjsLib?: { getDocument: Function; GlobalWorkerOptions: { workerSrc: string } } })
            .pdfjsLib;
          if (!pdfjsLib) throw new Error("PDF.js did not load");
          pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER;
          const doc = await pdfjsLib.getDocument(src).promise;
          if (cancelled) return;
          let pageNum = 1;
          const canvas = document.createElement("canvas");
          canvas.className = "mx-auto max-h-[calc(100dvh-7rem)] w-full max-w-3xl";
          node.innerHTML = "";
          node.appendChild(canvas);
          const paint = async (n: number) => {
            const page = await doc.getPage(n);
            const unscaled = page.getViewport({ scale: 1 });
            const width = Math.min(node.clientWidth || 360, 800);
            const scale = width / unscaled.width;
            const viewport = page.getViewport({ scale });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            await page.render({ canvasContext: ctx, viewport }).promise;
            setPageLabel(`${n} / ${doc.numPages}`);
          };
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
          await paint(1);
          return;
        }

        await loadScript(EPUB_JS);
        const ePub = (window as unknown as { ePub?: (u: string) => any }).ePub;
        if (!ePub) throw new Error("EPUB.js did not load");
        node.innerHTML = "";
        const bookObj = ePub(src);
        const rendition = bookObj.renderTo(node, {
          width: "100%",
          height: "100%",
          spread: "none",
          allowScriptedContent: false,
        });
        await rendition.display();
        if (cancelled) {
          bookObj.destroy?.();
          return;
        }
        turn.current = {
          next: () => void rendition.next(),
          prev: () => void rendition.prev(),
        };
        const loc = rendition.currentLocation?.();
        if (loc?.start?.displayed) {
          setPageLabel(`${loc.start.displayed.page} / ${loc.start.displayed.total}`);
        }
        rendition.on("relocated", (location: { start?: { displayed?: { page: number; total: number } } }) => {
          const d = location?.start?.displayed;
          if (d) setPageLabel(`${d.page} / ${d.total}`);
        });
        rendition.on("displayedError", () => {
          setErr("This file is DRM-protected (Adobe/LCP) or unreadable. ReelOS reads DRM-free EPUB and PDF only.");
        });
      } catch (e) {
        if (!cancelled) {
          setErr(
            String(e).includes("DRM") || String(e).toLowerCase().includes("encrypt")
              ? "This file is DRM-protected (Adobe/LCP). ReelOS reads DRM-free EPUB and PDF only."
              : "Could not open that file in the in-app reader. Download it for iOS Books / Android, or sideload a DRM-free EPUB/PDF.",
          );
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
      turn.current = null;
      if (node) node.innerHTML = "";
    };
  }, [book.rel]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Button variant="quiet" size="icon" aria-label="Close reader" onClick={onClose}>
          <X className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{book.title}</p>
          <p className="truncate text-xs text-muted">{book.author}</p>
        </div>
        <a
          className="inline-flex h-8 items-center rounded-full bg-gold px-3 text-xs font-medium text-gold-fg"
          href={`/api/books/file?rel=${encodeURIComponent(book.rel)}`}
          download
        >
          <Download className="mr-1 size-3.5" />
          Download
        </a>
      </header>
      {err ? (
        <p className="px-4 py-6 text-sm text-muted">{err}</p>
      ) : (
        <div ref={host} className="min-h-0 flex-1 overflow-auto bg-background px-2 py-2" />
      )}
      <footer className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
        <Button variant="circuit" size="sm" onClick={() => turn.current?.prev()}>
          <ChevronLeft className="size-4" /> Prev
        </Button>
        <span className="text-xs text-muted">{pageLabel || " "}</span>
        <Button variant="circuit" size="sm" onClick={() => turn.current?.next()}>
          Next <ChevronRight className="size-4" />
        </Button>
      </footer>
    </div>
  );
}
