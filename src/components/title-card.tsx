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
      <div className="relative overflow-hidden rounded-xl transition-transform duration-200 ease-out group-hover:-translate-y-0.5">
        <Poster title={title} className="rounded-xl" />
        {showCache ? (
          <span className="absolute left-2 top-2 rounded-full bg-card px-2 py-0.5 text-[10px] font-medium tracking-wide text-circuit">
            Cached
          </span>
        ) : null}
        {status === "downloading" ? (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-background/40">
            <div className="h-full bg-circuit" style={{ width: `${request?.progress ?? 0}%` }} />
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
    <section className="mt-5">
      <h2 className="mb-2 font-display text-sm font-medium tracking-tight">{label}</h2>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1.5">{children}</div>
    </section>
  );
}