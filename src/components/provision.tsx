import { useEffect, useState } from "react";
import { Check, ChevronDown, LoaderCircle } from "lucide-react";
import { Wordmark } from "@/components/logo";
import { ConnectView } from "@/components/connect-view";
import { useReelStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function Provision() {
  const phase = useReelStore((s) => s.phase);
  if (phase === "ready") return <Ready />;
  return <Building />;
}

function Building() {
  const build = useReelStore((s) => s.build);
  const open = useReelStore((s) => s.buildLogOpen);
  const done = build.filter((s) => s.status === "done").length;
  const total = build.length || 1;
  const current = build.find((s) => s.status === "running");
  const setPhase = useReelStore((s) => s.setPhase);
  const [provisionErr, setProvisionErr] = useState("");

  useEffect(() => {
    let stop = false;
    const tick = () => {
      void fetch("/api/box", { cache: "no-store" })
        .then((r) => r.json() as Promise<{ provisioned?: boolean; provisionError?: string; jellyfin?: { state?: string } }>)
        .then((b) => {
          if (stop) return;
          if (b.provisioned) setPhase("ready");
          if (b.provisionError) setProvisionErr(b.provisionError);
        })
        .catch(() => {});
    };
    tick();
    const id = window.setInterval(tick, 3000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [setPhase]);

  return (
    <div className="relative min-h-dvh bg-background px-6 py-8 md:px-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 top-10 size-72 rounded-full bg-gold/10 blur-[90px]"
      />
      <Wordmark />
      <div className="mx-auto mt-12 max-w-lg">
        <p className="font-display text-xs tracking-[0.22em] text-gold uppercase">Building your stack</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Standing up ReelOS</h1>
        <p className="mt-3 text-sm text-muted">Waiting for engines. Libraries are not claimed until the box says so.</p>
        {provisionErr ? <p className="mt-3 text-sm text-danger">{provisionErr}</p> : null}
        <div className="mt-6 h-1 overflow-hidden rounded-full bg-card-2">
          <div
            className="h-full bg-gold transition-[width] duration-500 ease-out"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
        <ol className="mt-8 space-y-3">
          {build.map((s) => (
            <li key={s.id} className="flex items-start gap-3">
              <StatusDot status={s.status} />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm",
                    s.status === "pending" && "text-faint",
                    s.status === "running" && "text-gold-bright",
                    s.status === "done" && "text-foreground",
                  )}
                >
                  {s.label}
                </p>
                {s.status === "running" || s.status === "done" ? (
                  <p className="mt-0.5 truncate font-mono text-[11px] text-faint">{s.log}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="mt-8 flex items-center gap-2 text-xs text-faint hover:text-muted"
          onClick={() => useReelStore.setState({ buildLogOpen: !open })}
        >
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
          Log
        </button>
        {open ? (
          <pre className="mt-3 max-h-48 overflow-auto rounded-xl bg-raised p-4 font-mono text-[11px] leading-relaxed text-muted">
            {build
              .filter((s) => s.log)
              .map((s) => `[${s.id}] ${s.log}`)
              .join("\n") || "Waiting for the first step."}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  if (status === "done") {
    return (
      <span className="mt-0.5 flex size-5 items-center justify-center rounded-full bg-gold text-gold-fg">
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  }
  if (status === "running") {
    return <LoaderCircle className="mt-0.5 size-5 animate-spin text-gold" />;
  }
  return <span className="mt-0.5 size-5 rounded-full shadow-[var(--shadow-border)]" />;
}

function Ready() {
  return <ConnectView />;
}
