import { Check, ChevronDown, Copy, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { HOSTNAME, LAN_IP } from "@/lib/catalog";
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
        <p className="mt-3 text-sm text-muted">
          {done} of {total}
          {current ? ` · ${current.label}` : ""}
        </p>
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
  const [copied, setCopied] = useState(false);
  const access = useReelStore((s) => s.answers.access);
  const url = `http://${HOSTNAME}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 size-[28rem] -translate-x-1/2 rounded-full bg-gold/12 blur-[100px]"
      />
      <Wordmark markClassName="size-16" className="flex-col gap-4" />
      <h1 className="mt-10 font-display text-3xl font-semibold tracking-tight">ReelOS is ready</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
        One front door. Search and request here. Watch in Jellyfin or Plex.
      </p>
      <div className="mt-8 flex flex-col items-center gap-2 rounded-2xl bg-card px-8 py-5 shadow-[var(--shadow-border)]">
        <p className="font-display text-lg tracking-wide text-gold">{HOSTNAME}</p>
        <p className="font-mono text-xs text-muted">{LAN_IP}</p>
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button variant="ghost" onClick={() => void copy()}>
          <Copy className="size-4" />
          {copied ? "Copied" : "Copy setup URL"}
        </Button>
        <Button size="lg" onClick={() => useReelStore.getState().openReelOS()}>
          Open ReelOS
        </Button>
      </div>
      {access === "tailscale" ? (
        <p className="mt-6 max-w-sm text-xs text-muted">
          Tailscale is waiting for an auth click. Finish that on any device signed into your tailnet.
        </p>
      ) : null}
    </div>
  );
}
