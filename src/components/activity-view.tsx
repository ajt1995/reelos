import { getTitle } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import { formatWhen } from "@/lib/utils";

export function ActivityView() {
  const activity = useReelStore((s) => s.activity);
  return (
    <div className="px-5 py-6 md:px-10 md:py-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Activity</h1>
      <p className="mt-2 text-sm text-muted">What the stack is doing. Not a port list.</p>
      <ol className="mt-8 space-y-0">
        {activity.length === 0 ? (
          <p className="text-sm text-muted">Quiet so far.</p>
        ) : null}
        {activity.map((e) => {
          const t = e.titleId ? getTitle(e.titleId) : undefined;
          return (
            <li key={e.id} className="flex gap-4 border-b border-border py-4">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-gold/80" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{e.message}</p>
                <p className="mt-1 font-mono text-[11px] text-faint">
                  {formatWhen(e.at)}
                  {t ? ` · ${t.title}` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
