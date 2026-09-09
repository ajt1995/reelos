import { useEffect, useState } from "react";
import { getTitle } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import { formatWhen } from "@/lib/utils";

type Ev = { id: string; at: number; message: string; titleId?: string };

export function ActivityView() {
  const local = useReelStore((s) => s.activity);
  const [live, setLive] = useState<Ev[]>([]);

  useEffect(() => {
    let stop = false;
    const load = () => {
      void fetch("/api/activity", { cache: "no-store" })
        .then((r) => r.json() as Promise<{ events?: Ev[] }>)
        .then((j) => {
          if (!stop) setLive(Array.isArray(j.events) ? j.events : []);
        })
        .catch(() => {});
    };
    load();
    const id = window.setInterval(load, 8000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  const activity = live.length ? live : local;

  return (
    <div className="page-enter px-5 py-6 md:px-10 md:py-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Activity</h1>
      <p className="mt-2 text-sm text-muted">OTA, wire, and the shell. Not a port list.</p>
      <ol className="mt-8 space-y-0">
        {activity.length === 0 ? <p className="text-sm text-muted">Quiet so far.</p> : null}
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
