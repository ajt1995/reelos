import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AudioLines,
  BrainCircuit,
  ChevronDown,
  ChevronLeft,
  Clock3,
  Film,
  Gauge,
  HardDrive,
  Heart,
  MonitorSmartphone,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  capabilityAction,
  capabilityCopy,
  capabilityInfluence,
  capabilityProgress,
  capabilityStatus,
  type CapabilityRecord,
  type CapabilityResponse,
} from "@/lib/capability-view-model";

const capabilityIcons = {
  "taste-ranking": Heart,
  "semantic-search": Search,
  "scene-understanding": Film,
  "family-scene-guidance": ShieldCheck,
  "dialogue-enhancement": AudioLines,
  "predictive-preparation": Clock3,
  "storage-optimization": HardDrive,
  "machine-protection": Gauge,
  "interface-protection": MonitorSmartphone,
  "shared-taste-intelligence": UsersRound,
  "release-ranking": Sparkles,
} as const;

type ActionName = "disable" | "revalidate";

export function AdvancedView({ embedded = false }: { embedded?: boolean }) {
  const [data, setData] = useState<CapabilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/capabilities", { cache: "no-store", signal });
      const body = (await response.json()) as CapabilityResponse & { error?: string };
      if (!response.ok || !body.ok || !Array.isArray(body.capabilities)) {
        throw new Error(body.error || "ReelOS could not read this home’s capabilities.");
      }
      setData(body);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "ReelOS could not read this home’s capabilities.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const counts = useMemo(() => capabilityProgress(data?.capabilities ?? []), [data]);

  const runAction = async (capability: CapabilityRecord, action: ActionName) => {
    setBusyId(capability.id);
    setError("");
    try {
      const response = await fetch(`/api/capabilities/${encodeURIComponent(capability.id)}/${action}`, {
        method: "POST",
      });
      const body = (await response.json()) as { ok?: boolean; capability?: CapabilityRecord; error?: string };
      if (!response.ok || !body.ok || !body.capability) {
        throw new Error(
          response.status === 403
            ? "Only the home owner can change this."
            : body.error || "That change could not be saved.",
        );
      }
      setData((current) =>
        current
          ? {
              ...current,
              capabilities: current.capabilities.map((item) =>
                item.id === body.capability?.id ? body.capability : item,
              ),
            }
          : current,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That change could not be saved.");
    } finally {
      setBusyId(null);
    }
  };

  const Root = embedded ? "div" : "main";
  return (
    <Root className={embedded ? "w-full" : "mx-auto w-full max-w-5xl px-5 pb-28 pt-5 md:px-10 md:pt-8"}>
      {!embedded && <Link
        to="/settings"
        className="inline-flex min-h-12 items-center gap-2 rounded-xl px-2 text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-background),0_0_0_4px_var(--color-gold)]"
      >
        <ChevronLeft className="size-4" />
        Settings
      </Link>}

      <section className="relative mt-5 overflow-hidden rounded-[2rem] border border-white/8 bg-card/55 px-6 py-8 shadow-[var(--shadow-border)] backdrop-blur-xl md:px-9 md:py-10">
        <div className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-gold/16 blur-[90px]" />
        <div className="relative flex items-start gap-5">
          <span className="mt-1 flex size-12 shrink-0 items-center justify-center rounded-full bg-gold/12 text-gold shadow-[0_0_38px_color-mix(in_srgb,var(--color-gold)_30%,transparent)]">
            <BrainCircuit className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Quietly getting better</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted md:text-base">
              These abilities stay inside your home. Each one must prove it works here before ReelOS lets it shape your experience.
            </p>
            {!loading && !error && data ? (
              <p className="mt-5 text-sm text-foreground/85" aria-live="polite">
                <span className="font-medium text-gold">{counts.active} active</span>
                <span className="mx-2 text-muted/50">·</span>
                {counts.checking} checking locally
                {counts.inactive ? ` · ${counts.inactive} not active` : ""}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {error ? (
        <div role="alert" className="mt-5 rounded-2xl border border-danger/25 bg-danger/8 px-5 py-4">
          <p className="text-sm text-foreground">{error}</p>
          <Button className="mt-3 min-h-12" variant="ghost" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : null}

      <section className="mt-6" aria-label="ReelOS capabilities" aria-busy={loading}>
        {loading ? <CapabilitySkeleton /> : null}
        {!loading && !error && data?.capabilities.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-card/45 px-6 py-8 text-sm text-muted backdrop-blur-lg">
            No additional capabilities are installed on this home yet.
          </div>
        ) : null}
        {!loading && data?.capabilities.map((capability) => {
          const copy = capabilityCopy(capability.id);
          const status = capabilityStatus(capability.state);
          const influence = capabilityInfluence(capability.id);
          const Icon = capabilityIcons[capability.id as keyof typeof capabilityIcons] ?? Sparkles;
          const open = openId === capability.id;
          const action = capabilityAction(capability.state);
          const busy = busyId === capability.id;

          return (
            <article
              key={capability.id}
              className="mb-3 overflow-hidden rounded-2xl border border-white/8 bg-card/50 shadow-[var(--shadow-border)] backdrop-blur-lg"
            >
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : capability.id)}
                className="flex min-h-[76px] w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-white/[0.035] focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--color-gold)] md:px-5"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.045] text-gold">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[15px] font-medium text-foreground md:text-base">{copy.name}</span>
                  <span className="mt-1 block truncate text-xs text-muted md:text-sm">{copy.short}</span>
                </span>
                <span className={cn("hidden rounded-full border px-3 py-1.5 text-xs font-medium sm:inline-flex", status.tone)}>
                  {status.label}
                </span>
                <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
              </button>

              {open ? (
                <div className="border-t border-white/7 px-4 pb-5 pt-4 md:px-20 md:pr-5">
                  <span className={cn("inline-flex rounded-full border px-3 py-1.5 text-xs font-medium sm:hidden", status.tone)}>
                    {status.label}
                  </span>
                  <p className="mt-3 text-sm leading-6 text-foreground/85 sm:mt-0">{copy.detail}</p>
                  <p className="mt-2 text-xs leading-5 text-muted">{status.explanation}</p>
                  <div className="mt-4 rounded-xl border border-white/8 bg-black/15 px-4 py-3">
                    <p className="text-xs font-semibold text-foreground/90">{influence.label}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">{influence.explanation}</p>
                  </div>
                  {action ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {action === "revalidate" ? (
                        <Button
                          className="min-h-12"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void runAction(capability, "revalidate")}
                        >
                          {busy ? "Checking…" : "Check again"}
                        </Button>
                      ) : null}
                      {action === "disable" || action === "revalidate" ? (
                        <Button
                          className="min-h-12"
                          variant="quiet"
                          disabled={busy}
                          onClick={() => void runAction(capability, "disable")}
                        >
                          {busy ? "Saving…" : "Turn off"}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      <section className="mt-8 rounded-[2rem] border border-white/8 bg-card/45 px-6 py-7 shadow-[var(--shadow-border)] backdrop-blur-lg md:px-8" aria-labelledby="later-release-heading">
        <h2 id="later-release-heading" className="font-display text-2xl font-semibold tracking-tight">Planned for a later release</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          These ideas are not part of the current household release. They are shown here for clarity and cannot be turned on yet.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {[
            ["Room ambiance", "Connected lights and phone-guided room sound tuning are not available in this release."],
            ["Commercial streaming handoff", "Opening titles in commercial streaming apps is not available in this release."],
            ["Additional computer platforms", "The household release currently targets Windows and Linux hosts; other computer platforms remain unverified."],
            ["Experimental local abilities", "Evaluation-only model packs stay disconnected until their privacy, quality, and resource checks pass."],
          ].map(([name, detail]) => (
            <article key={name} className="rounded-2xl border border-white/7 bg-black/10 p-5">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-display text-base font-medium">{name}</h3>
                <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted">Later release</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <p className="mx-auto mt-7 max-w-2xl text-center text-xs leading-5 text-muted">
        Watching always comes first. Background learning pauses automatically when playback or this device needs the room.
      </p>
    </Root>
  );
}

function CapabilitySkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading capabilities">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="flex min-h-[76px] animate-pulse items-center gap-4 rounded-2xl border border-white/6 bg-card/40 px-4 py-4">
          <span className="size-11 rounded-2xl bg-white/6" />
          <span className="flex-1">
            <span className="block h-3.5 w-36 rounded bg-white/7" />
            <span className="mt-2 block h-3 w-56 max-w-full rounded bg-white/5" />
          </span>
        </div>
      ))}
    </div>
  );
}
