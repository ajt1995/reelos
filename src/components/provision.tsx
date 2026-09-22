import { useEffect, useState } from "react";
import { Check, ChevronDown, LoaderCircle, Sparkles } from "lucide-react";
import { Wordmark } from "@/components/logo";
import { ConnectView } from "@/components/connect-view";
import { FeatureShowcase } from "@/components/feature-showcase";
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
  const theme = useReelStore((s) => s.theme);
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

  const pct = Math.round((done / total) * 100);

  return (
    <div
      data-theme={theme}
      className="relative min-h-dvh overflow-hidden bg-background px-6 py-8 transition-colors duration-500 md:px-12"
    >
      {/* Cinematic ambient background orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 top-0 size-[32rem] rounded-full bg-gold/15 blur-[120px] transition-all duration-700"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 bottom-0 size-[28rem] rounded-full bg-live/10 blur-[110px] transition-all duration-700"
      />

      {/* Header */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between">
        <Wordmark markClassName="size-8" />
        <div className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 backdrop-blur-md">
          <LoaderCircle className="size-3.5 animate-spin text-gold" />
          <span className="font-display text-xs font-medium text-muted">
            Provisioning Media Stack · {pct}%
          </span>
        </div>
      </header>

      {/* Main Dual-Pane View */}
      <main className="relative z-10 mx-auto mt-8 max-w-6xl pb-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
          {/* Left Column: Real Build Progress & Engine Lifecycle */}
          <div className="lg:col-span-5 xl:col-span-5">
            <div className="rounded-3xl border border-border bg-card/70 p-6 backdrop-blur-xl shadow-xl md:p-8">
              <div className="flex items-center gap-2 text-gold">
                <Sparkles className="size-4 text-gold" />
                <p className="font-display text-xs font-semibold tracking-[0.22em] uppercase">
                  Stack Lifecycle
                </p>
              </div>
              <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground">
                Standing up ReelOS
              </h1>
              <p className="mt-2 text-xs text-muted leading-relaxed">
                Configuring cloud streaming links, high-fidelity media profiles, and personalized resident spaces.
              </p>

              {provisionErr ? (
                <div className="mt-4 rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger font-medium space-y-3">
                  <p>{provisionErr}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setProvisionErr("");
                        const answers = useReelStore.getState().answers;
                        fetch("/api/provision", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ answers }),
                        })
                          .then((r) => r.json())
                          .then((j: any) => {
                            if (j?.ok && !j?.simulated) {
                              useReelStore.getState().startBuild();
                            } else {
                              setProvisionErr(j?.error || "Provision retry failed");
                            }
                          })
                          .catch((e) => setProvisionErr(String(e)));
                      }}
                      className="rounded-lg bg-danger/20 hover:bg-danger/30 text-danger border border-danger/40 px-3 py-1 text-xs font-semibold transition-colors"
                    >
                      Retry Setup
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProvisionErr("");
                        useReelStore.setState({ phase: "wizard" });
                      }}
                      className="rounded-lg bg-card hover:bg-card/80 text-foreground border border-border px-3 py-1 text-xs font-semibold transition-colors"
                    >
                      Edit Configuration
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Honest Byte/Stage Progress Bar */}
              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted font-medium">Progress</span>
                  <span className="font-mono font-bold text-foreground tabular-nums">{pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-card-2 border border-border">
                  <div
                    className="h-full bg-gold transition-[width] duration-500 ease-out shadow-[var(--shadow-gold)]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Status Step Rows */}
              <ol className="mt-6 space-y-3">
                {build.map((s) => (
                  <li key={s.id} className="flex items-start gap-3">
                    <StatusDot status={s.status} />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-xs font-medium transition-colors",
                          s.status === "pending" && "text-faint",
                          s.status === "running" && "text-gold font-semibold",
                          s.status === "done" && "text-foreground",
                        )}
                      >
                        {s.label}
                      </p>
                      {s.status === "running" || s.status === "done" ? (
                        <p className="mt-0.5 truncate font-mono text-[10px] text-muted">{s.log}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>

              {/* Collapsible Console Log */}
              <div className="mt-6 border-t border-border pt-4">
                <button
                  type="button"
                  className="flex items-center gap-2 text-xs font-medium text-muted hover:text-foreground transition-colors"
                  onClick={() => useReelStore.setState({ buildLogOpen: !open })}
                >
                  <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
                  Console Logs
                </button>
                {open ? (
                  <pre className="mt-3 max-h-40 overflow-auto rounded-xl bg-raised p-3 font-mono text-[10px] leading-relaxed text-muted border border-border">
                    {build
                      .filter((s) => s.log)
                      .map((s) => `[${s.id}] ${s.log}`)
                      .join("\n") || "Waiting for first step."}
                  </pre>
                ) : null}
              </div>
            </div>
          </div>

          {/* Right Column: Dynamic Feature Mockup Showcase */}
          <div className="lg:col-span-7 xl:col-span-7">
            <FeatureShowcase className="border-border/80 shadow-2xl" />
          </div>
        </div>
      </main>
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
