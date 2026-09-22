import { Link } from "@tanstack/react-router";
import { BookOpen, Coffee, ThumbsDown, ThumbsUp } from "lucide-react";
import { Poster } from "@/components/poster";
import type { CuratorVote } from "@/lib/discover-curator";
import { useReelStore } from "@/lib/store";
import { titleHasRemotePoster, titleMatchesId, requestProgressLabel, requestIsWatchableOnShelf, getMediaLifecycleState } from "@/lib/sync-requests";
import type { MediaRequest } from "@/lib/types";
import type { Title } from "@/lib/types";
import { cn } from "@/lib/utils";

const ADAPTED_BOOK_TITLES = [
  "dune",
  "fellowship",
  "lord of the rings",
  "foundation",
  "silo",
  "wool",
  "three-body",
  "3 body",
  "witcher",
  "game of thrones",
  "house of the dragon",
  "blade runner",
  "arrival",
  "martian",
  "project hail mary",
  "oppenheimer",
  "killers of the flower moon",
];

function hasBookAdaptation(title: string = ""): boolean {
  const norm = title.toLowerCase();
  return ADAPTED_BOOK_TITLES.some((t) => norm.includes(t));
}

export function posterArt(title: Title, extras: Title[] = []): string {
  const tmdb = extras.find((x) => {
    const p = String(x.poster || "").trim();
    if (!p || p.includes("/api/jf/")) return false;
    return titleMatchesId(title, x.id) || x.id === title.id;
  });
  if (tmdb?.poster) return String(tmdb.poster);
  return String(title.poster || "");
}

export function CuratorVoteBar({
  liked,
  hidden,
  onVote,
  placement = "overlay",
}: {
  liked?: boolean;
  hidden?: boolean;
  onVote: (vote: CuratorVote) => void;
  placement?: "overlay" | "inline";
}) {
  if (placement === "inline") {
    return (
      <div className="z-20 flex items-center gap-2">
        <button
          type="button"
          aria-label="Like"
          title="More like this"
          aria-pressed={liked ? true : undefined}
          className={cn(
            "flex h-12 items-center gap-2 rounded-2xl px-4 text-sm font-medium transition-all shadow-sm cursor-pointer",
            liked
              ? "bg-gold text-gold-fg font-semibold shadow-[var(--shadow-gold)]"
              : "border border-border bg-card text-muted hover:text-foreground hover:border-border-strong",
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onVote(liked ? "none" : "like");
          }}
        >
          <ThumbsUp className="size-4" />
          <span>{liked ? "Liked" : "Like"}</span>
        </button>
        <button
          type="button"
          aria-label="Comfort Classic"
          title="Comfort Classic — teach curator your cozy favorites"
          className="flex h-12 items-center gap-2 rounded-2xl px-4 text-sm font-medium transition-all shadow-sm cursor-pointer border border-border bg-card text-muted hover:text-amber-300 hover:border-amber-500/40"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onVote("comfort");
          }}
        >
          <Coffee className="size-4 text-amber-400" />
          <span>Comfort</span>
        </button>
        <button
          type="button"
          aria-label="Not interested"
          title="Not interested"
          aria-pressed={hidden ? true : undefined}
          className={cn(
            "flex h-12 items-center gap-2 rounded-2xl px-4 text-sm font-medium transition-all shadow-sm cursor-pointer",
            hidden
              ? "bg-card-2 text-foreground font-semibold border border-border-strong"
              : "border border-border bg-card text-muted hover:text-foreground hover:border-border-strong",
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onVote(hidden ? "none" : "dislike");
          }}
        >
          <ThumbsDown className="size-4" />
          <span>{hidden ? "Hidden" : "Dislike"}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "z-20 flex items-center gap-0.5 rounded-full border border-white/20 bg-background/85 px-1.5 py-0.5 backdrop-blur-md shadow-lg transition-all duration-200",
        liked || hidden
          ? "opacity-100 scale-100 ring-1 ring-gold/40"
          : "opacity-85 hover:opacity-100 scale-100",
        "absolute top-2 right-2",
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        type="button"
        aria-label="More like this"
        title="More like this"
        aria-pressed={liked ? true : undefined}
        className={cn(
          "flex size-7 items-center justify-center rounded-full transition-transform active:scale-90 cursor-pointer",
          liked ? "bg-gold text-gold-fg shadow-sm" : "text-muted hover:text-foreground hover:bg-white/10",
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onVote(liked ? "none" : "like");
        }}
      >
        <ThumbsUp className="size-3.5" />
      </button>
      <div className="h-2.5 w-px bg-white/20" />
      <button
        type="button"
        aria-label="Comfort Classic"
        title="Comfort Classic"
        className="flex size-7 items-center justify-center rounded-full transition-transform active:scale-90 cursor-pointer text-muted hover:text-amber-300 hover:bg-white/10"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onVote("comfort");
        }}
      >
        <Coffee className="size-3.5 text-amber-400" />
      </button>
      <div className="h-2.5 w-px bg-white/20" />
      <button
        type="button"
        aria-label="Not interested"
        title="Not interested"
        aria-pressed={hidden ? true : undefined}
        className={cn(
          "flex size-7 items-center justify-center rounded-full transition-transform active:scale-90 cursor-pointer",
          hidden ? "bg-card-2 text-foreground font-semibold" : "text-muted hover:text-foreground hover:bg-white/10",
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onVote(hidden ? "none" : "dislike");
        }}
      >
        <ThumbsDown className="size-3" />
      </button>
    </div>
  );
}

export function TitleCard({
  title,
  request,
  progress,
  className,
  onHide,
  onVote,
  liked,
  hidden,
}: {
  title: Title;
  request?: MediaRequest;
  progress?: number;
  className?: string;
  onHide?: (title: Title) => void;
  onVote?: (title: Title, vote: CuratorVote) => void;
  liked?: boolean;
  hidden?: boolean;
}) {
  const status = request?.status;
  const inLibrary = useReelStore(
    (s) => s.library.includes(title.id) || s.shelf.some((x) => titleMatchesId(x, title.id)),
  );
  const remoteTitles = useReelStore((s) => s.remoteTitles);
  const shelf = useReelStore((s) => s.shelf);
  const kidsTitleIds = useReelStore((s) => s.kidsTitleIds);
  const kidsGiftedTitles = useReelStore((s) => s.kidsGiftedTitles || {});
  const giftedInfo = kidsGiftedTitles[title.id] || (title.jellyfinId ? kidsGiftedTitles[title.jellyfinId] : null);
  const isKids = kidsTitleIds.includes(title.id) || (title.jellyfinId ? kidsTitleIds.includes(title.jellyfinId) : false);
  const isPlayable = Boolean(title.jellyfinId) || (request ? requestIsWatchableOnShelf(request, { titles: shelf }) : inLibrary);
  const painted = { ...title, poster: posterArt(title, remoteTitles) };
  const pct = Number(request?.progress) || 0;
  const downloadingLabel = requestProgressLabel(request);
  const lifecycle = getMediaLifecycleState(title, request, { titles: shelf, inLibrary });
  const inFlightBadge = (() => {
    if (isPlayable || lifecycle === "on_shelf" || lifecycle === "unowned") return null;
    if (lifecycle === "importing") return "Importing";
    if (lifecycle === "downloading") return "Downloading";
    if (lifecycle === "searching") return "Searching";
    if (lifecycle === "coming_soon") return "Coming";
    if (lifecycle === "failed") return "Failed";
    return null;
  })();
  const showVotes = Boolean(onVote || onHide);
  const vote = (next: CuratorVote) => {
    if (onVote) onVote(title, next);
    else if (onHide && next === "dislike") onHide(title);
  };

  return (
    <Link
      to="/title/$id"
      params={{ id: title.id }}
      className={cn("group block w-[148px] min-w-0 max-w-full shrink-0 sm:w-[168px]", className)}
    >
      <div className="cinema-title-card relative overflow-hidden rounded-2xl border border-white/10 bg-card/80 shadow-md transition-all duration-300 ease-out group-hover:scale-[1.035] group-hover:shadow-2xl group-hover:border-gold/50 group-hover:z-10 group-focus-visible:scale-[1.035] group-focus-visible:ring-2 group-focus-visible:ring-gold">
        <Poster
          title={painted}
          className="rounded-2xl"
          placeholder={request && !titleHasRemotePoster(painted) ? "empty" : "letter"}
        />

        {/* Catalog identity and library presence do not verify cache or encoding.
            Source/format claims belong to acknowledged playback metadata. */}

        {giftedInfo ? (
          <div className="absolute top-0 right-0 z-20 overflow-hidden pointer-events-none rounded-tr-2xl">
            <div className="bg-gradient-to-r from-amber-500 via-amber-300 to-yellow-500 text-amber-950 font-black text-[8px] tracking-wide uppercase px-2.5 py-0.5 shadow-md flex items-center gap-1 border-b border-l border-amber-300/60 backdrop-blur-md rounded-bl-lg">
              <span>🎁</span>
              <span>Gift from {giftedInfo.giftedBy || "Mom & Dad"}</span>
            </div>
          </div>
        ) : null}

        {hasBookAdaptation(title.title) ? (
          <span
            className="absolute left-2 bottom-2 z-10 flex items-center gap-1 rounded-full border border-sky-400/40 bg-slate-950/85 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-sky-300 shadow-md backdrop-blur-md"
            title="Adapted from a book in the library"
          >
            <BookOpen className="size-2.5" />
            Book
          </span>
        ) : null}

        {isKids ? (
          <span className="absolute bottom-2 right-2 flex size-6 items-center justify-center rounded-full bg-gold/90 text-xs shadow-md border border-gold-bright" title="Kid-Approved Title">
            👶
          </span>
        ) : null}

        {inFlightBadge ? (
          <span
            className={cn(
              "absolute left-2 top-2 z-10 flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide shadow-sm backdrop-blur-md",
              inFlightBadge === "Importing" && "bg-live/90 text-background font-semibold",
              inFlightBadge === "Downloading" && "bg-gold/90 text-gold-fg font-semibold",
              inFlightBadge === "Searching" && "bg-card/90 text-foreground border border-border-strong",
              inFlightBadge === "Failed" && "bg-danger/90 text-white font-semibold",
              inFlightBadge === "Coming" && "bg-card/85 text-muted border border-border",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                inFlightBadge === "Importing" && "bg-background animate-pulse",
                inFlightBadge === "Downloading" && "bg-gold-fg animate-pulse",
                inFlightBadge === "Searching" && "bg-circuit animate-pulse",
                inFlightBadge === "Failed" && "bg-white",
                inFlightBadge === "Coming" && "bg-muted",
              )}
            />
            {inFlightBadge}
          </span>
        ) : null}
        {status === "downloading" && pct > 0 ? (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-background/40">
            <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
        {typeof progress === "number" && progress > 0.03 && progress < 0.97 ? (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-background/50">
            <div className="h-full bg-live" style={{ width: `${progress * 100}%` }} />
          </div>
        ) : null}
        {showVotes ? <CuratorVoteBar liked={liked} hidden={hidden} onVote={vote} /> : null}
      </div>
      <p className="mt-2.5 line-clamp-2 break-words font-display text-sm font-semibold leading-snug text-foreground group-hover:text-gold transition-colors">
        {title.title}
      </p>
      <p className="text-xs text-muted">
        {Number(title.year) > 0 ? title.year : null}
        {status === "available"
          ? isPlayable
            ? request?.via === "cache"
              ? " · Cached"
              : " · Available now"
            : ` · ${downloadingLabel || "Importing"}`
          : null}
        {(status === "downloading" || status === "waiting") && downloadingLabel ? ` · ${downloadingLabel}` : null}
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
    <section className="cinema-shelf mt-10">
      <h2 className="mb-4 font-display text-lg font-medium tracking-tight">{label}</h2>
      <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">{children}</div>
    </section>
  );
}
