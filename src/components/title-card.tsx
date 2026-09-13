import { Link } from "@tanstack/react-router";
import { ThumbsDown } from "lucide-react";
import { Poster } from "@/components/poster";
import { titleInCache } from "@/lib/adapter";
import { useReelStore } from "@/lib/store";
import { titleHasRemotePoster, titleMatchesId, requestProgressLabel } from "@/lib/sync-requests";
import type { MediaRequest } from "@/lib/types";
import type { Title } from "@/lib/types";
import { cn } from "@/lib/utils";

export function posterArt(title: Title, extras: Title[] = []): string {
  const tmdb = extras.find((x) => {
    const p = String(x.poster || "").trim();
    if (!p || p.includes("/api/jf/")) return false;
    return titleMatchesId(title, x.id) || x.id === title.id;
  });
  if (tmdb?.poster) return String(tmdb.poster);
  return String(title.poster || "");
}

export function TitleCard({
  title,
  request,
  progress,
  className,
  onHide,
}: {
  title: Title;
  request?: MediaRequest;
  progress?: number;
  className?: string;
  onHide?: (title: Title) => void;
}) {
  const status = request?.status;
  const source = useReelStore((s) => s.answers.source);
  const inLibrary = useReelStore((s) => s.library.includes(title.id));
  const remoteTitles = useReelStore((s) => s.remoteTitles);
  const showCache =
    !request && !inLibrary && source !== "local-vpn" && titleInCache(title);
  const painted = { ...title, poster: posterArt(title, remoteTitles) };
  const pct = Number(request?.progress) || 0;
  const downloadingLabel = requestProgressLabel(request);

  return (
    <Link
      to="/title/$id"
      params={{ id: title.id }}
      className={cn("group block w-[148px] min-w-0 max-w-full shrink-0 overflow-hidden sm:w-[168px]", className)}
    >
      <div className="relative overflow-hidden rounded-xl transition-transform duration-200 ease-out group-hover:-translate-y-0.5">
        <Poster
          title={painted}
          className="rounded-xl"
          placeholder={request && !titleHasRemotePoster(painted) ? "empty" : "letter"}
        />
        {showCache ? (
          <span className="absolute left-2 top-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-medium tracking-wide text-gold-fg">
            Cached
          </span>
        ) : null}
        {status === "downloading" && pct > 0 ? (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-background/40">
            <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
        {onHide ? (
          <button
            type="button"
            aria-label="Not interested"
            title="Not interested"
            className="absolute right-2 top-2 z-10 rounded-full bg-background/80 p-1.5 text-muted opacity-90 shadow-[var(--shadow-border)] hover:bg-background hover:text-foreground"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onHide(title);
            }}
          >
            <ThumbsDown className="size-3.5" />
          </button>
        ) : null}
        {typeof progress === "number" && progress > 0.03 && progress < 0.97 ? (
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-background/40">
            <div className="h-full bg-live" style={{ width: `${progress * 100}%` }} />
          </div>
        ) : null}
      </div>
      <p className="mt-2 line-clamp-2 break-words text-sm font-medium leading-snug">{title.title}</p>
      <p className="text-xs text-muted">
        {Number(title.year) > 0 ? title.year : null}
        {status === "available" ? (request?.via === "cache" ? " · Cached" : " · Available now") : null}
        {status === "downloading" && downloadingLabel ? ` · ${downloadingLabel}` : null}
        {status === "waiting" ? " · Waiting" : null}
        {status === "failed" ? " · Failed" : null}
      </p>
    </Link>
  );
}

export function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-4 font-display text-lg font-medium tracking-tight">{label}</h2>
      <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">{children}</div>
    </section>
  );
}