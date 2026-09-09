import { Link } from "@tanstack/react-router";
import { Poster } from "@/components/poster";
import { titleInCache } from "@/lib/adapter";
import { useReelStore } from "@/lib/store";
import type { MediaRequest } from "@/lib/types";
import type { Title } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TitleCard({
  title,
  request,
  progress,
  className,
}: {
  title: Title;
  request?: MediaRequest;
  progress?: number;
  className?: string;
}) {
  const status = request?.status;
  const source = useReelStore((s) => s.answers.source);
  const inLibrary = useReelStore((s) => s.library.includes(title.id));
  const showCache =
    !request && !inLibrary && source !== "local-vpn" && titleInCache(title);

  return (
    <Link
      to="/title/$id"
      params={{ id: title.id }}
      className={cn("group block w-[148px] shrink-0 sm:w-[168px]", className)}
    >
      <div className="card-glow relative overflow-hidden rounded-xl">
        <Poster title={title} className="rounded-xl" />
        {showCache ? (
          <span className="absolute left-2 top-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-medium tracking-wide text-gold-fg shadow-[var(--shadow-gold)]">
            Cached
          </span>
        ) : null}
        {status === "downloading" ? (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-background/40">
            <div className="h-full bg-cyan" style={{ width: `${request?.progress ?? 0}%` }} />
          </div>
        ) : null}
        {typeof progress === "number" && progress > 0 && progress < 0.97 ? (
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-background/40">
            <div className="h-full bg-live" style={{ width: `${progress * 100}%` }} />
          </div>
        ) : null}
      </div>
      <p className="mt-2 truncate text-sm font-medium">{title.title}</p>
      <p className="text-xs text-muted">
        {title.year}
        {status === "available" ? (request?.via === "cache" ? " · Cached" : " · Available now") : null}
        {status === "downloading"
          ? request?.via === "cache"
            ? " · Cached"
            : ` · ${Math.round(request?.progress ?? 0)}%`
          : null}
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
      <h2 className="mb-4 font-display text-lg font-medium tracking-tight text-cyan/90">{label}</h2>
      <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">{children}</div>
    </section>
  );
}