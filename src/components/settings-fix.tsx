import { useState } from "react";
import { LoaderCircle, TriangleAlert, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REPAIR_GROUPS, REPAIRS } from "@/lib/repairs";
import { adapterProfile } from "@/lib/adapter";
import { sourceLabel, useReelStore } from "@/lib/store";

export function FixSection() {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, string>>({});

  const run = async (id: string) => {
    setBusy(id);
    setMsg((m) => ({ ...m, [id]: "" }));
    try {
      const r = await fetch("/api/repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: id }),
        signal: AbortSignal.timeout(15000),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      setMsg((m) => ({
        ...m,
        [id]:
          r.status === 409
            ? j.error || "Wait — a repair or update is already running."
            : j.ok
              ? "Started. Give it a minute, then check Movies / Requests."
              : j.error || "Repair failed",
      }));
    } catch (e) {
      setMsg((m) => ({ ...m, [id]: e instanceof Error ? e.message : "Repair failed" }));
    }
    setBusy(null);
  };

  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-medium">Fix</h2>
      <p className="mt-1 max-w-xl text-sm text-muted">
        Named scripts for when Movies doubles up, a request sits, or files vanish. Each one says what it does. Never writes to /media.
      </p>
      <div className="mt-3 grid gap-2.5">
        {REPAIR_GROUPS.map((g) => (
          <div key={g.id} className="rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
            <p className="text-xs font-medium uppercase tracking-wide text-faint">{g.title}</p>
            <ul className="mt-3 divide-y divide-border">
              {REPAIRS.filter((r) => r.group === g.id).map((r) => (
                <li key={r.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <Wrench className="mt-0.5 size-4 shrink-0 text-gold" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <p className="min-w-0 flex-1 font-display font-medium">{r.title}</p>
                      <Button
                        size="sm"
                        disabled={busy !== null}
                        aria-label={`Run ${r.title}`}
                        onClick={() => void run(r.id)}
                      >
                        {busy === r.id ? <LoaderCircle className="size-4 animate-spin" /> : null}
                        {busy === r.id ? "Starting…" : "Run"}
                      </Button>
                    </div>
                    <p className="mt-1 text-sm text-muted">{r.blurb}</p>
                    {msg[r.id] ? <p className="mt-1.5 text-sm text-gold">{msg[r.id]}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <CheckHops />
      </div>
    </section>
  );
}

function CheckHops() {
  const answers = useReelStore((s) => s.answers);
  const version = useReelStore((s) => s.update.current);
  const status = useReelStore((s) => s.update.status);
  const adapter = useReelStore((s) => s.adapter);
  const profile = adapterProfile(answers.source, answers.frontend);
  const [live, setLive] = useState<{ ok: boolean; label: string; detail: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = () => {
    setBusy(true);
    setErr("");
    void fetch("/api/doctor", { cache: "no-store", signal: AbortSignal.timeout(45000) })
      .then((r) => r.json())
      .then((r: { live?: boolean; checks?: { ok: boolean; label: string; detail: string }[]; error?: string }) => {
        if (r.live && r.checks?.length) setLive(r.checks);
        else setErr(r.error || "Doctor returned no checks");
      })
      .catch((e) => setErr(String(e).slice(0, 120)))
      .finally(() => setBusy(false));
  };

  const fallback = [
    { ok: true, label: "Docker engine", detail: "Compose project reelos" },
    { ok: adapter.status === "healthy", label: "Source", detail: `${profile.name} · ${sourceLabel[answers.source]}` },
    {
      ok: status !== "available" && status !== "applying" && status !== "error",
      label: "Updates",
      detail: `ReelOS ${version}`,
    },
  ];
  const checks = live ?? fallback;

  return (
    <div className="rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
      <p className="font-display font-medium">Check hops</p>
      <p className="mt-1 text-sm text-muted">Read-only. Green/red for FUSE, Jellyfin, Radarr, indexers. Changes nothing.</p>
      <div className="mt-3">
        <Button variant="ghost" size="sm" onClick={() => load()} disabled={busy}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {busy ? "Running…" : live ? "Run again" : "Run doctor"}
        </Button>
        {err ? <p className="mt-2 text-sm text-gold">{err}</p> : null}
      </div>
      <ul className="mt-4 space-y-3">
        {checks.map((c) => (
          <li key={c.label} className="flex items-start gap-3 text-sm">
            {c.ok ? (
              <span className="mt-1 size-2 rounded-full bg-success" />
            ) : (
              <TriangleAlert className="mt-0.5 size-4 text-gold" />
            )}
            <span>
              <span className="block">{c.label}</span>
              <span className="text-muted">{c.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
