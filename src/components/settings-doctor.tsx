import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adapterProfile } from "@/lib/adapter";
import { sourceLabel, useReelStore } from "@/lib/store";

export function Doctor() {
  const answers = useReelStore((s) => s.answers);
  const version = useReelStore((s) => s.update.current);
  const status = useReelStore((s) => s.update.status);
  const adapter = useReelStore((s) => s.adapter);
  const profile = adapterProfile(answers.source, answers.frontend);
  const [live, setLive] = useState<{ ok: boolean; label: string; detail: string }[] | null>(null);
  const [wireMsg, setWireMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [docErr, setDocErr] = useState("");

  const load = () => {
    setBusy(true);
    setDocErr("");
    void fetch("/api/doctor", { cache: "no-store", signal: AbortSignal.timeout(45000) })
      .then((r) => r.json())
      .then((r: { live?: boolean; checks?: { ok: boolean; label: string; detail: string }[]; error?: string }) => {
        if (r.live && r.checks?.length) setLive(r.checks);
        else setDocErr(r.error || "Doctor returned no checks");
      })
      .catch((e) => setDocErr(String(e).slice(0, 120)))
      .finally(() => setBusy(false));
  };

  const rewire = async () => {
    setWireMsg("Rewiring…");
    const r = await fetch("/api/wire", { method: "POST" });
    if (r.status === 409) {
      setWireMsg("OTA is running. Wait.");
      return;
    }
    const j = (await r.json()) as { ok?: boolean; error?: string };
    setWireMsg(j.ok ? "Wire started. Doctor will refresh." : j.error || "Wire failed");
    window.setTimeout(load, 8000);
  };

  const fallback = [
    { ok: true, label: "Docker engine", detail: "Compose project reelos" },
    { ok: true, label: "Ingress", detail: "Caddy · reelos.local" },
    { ok: true, label: "Media path", detail: "/srv/media" },
    {
      ok: adapter.status === "healthy",
      label: "Source",
      detail:
        adapter.status === "healthy"
          ? `${profile.name} · ${sourceLabel[answers.source]} · ${adapter.pingMs}ms`
          : "Adapter offline",
    },
    {
      ok: false,
      label: "Hardware transcode",
      detail: "Probe runs on the box. Software encode if no GPU.",
    },
    {
      ok: status !== "available" && status !== "applying" && status !== "error",
      label: "Updates",
      detail: `ReelOS ${version}`,
    },
  ];
  const checks = live ?? fallback;
  return (
    <div className="mt-8 rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
      <p className="font-display font-medium">Doctor</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={() => load()} disabled={busy}>
          {busy ? "Running…" : "Run doctor"}
        </Button>
        <Button variant="ghost" onClick={() => void rewire()}>
          Rewire engines
        </Button>
        {wireMsg ? <p className="text-sm text-muted">{wireMsg}</p> : null}
        {docErr ? <p className="text-sm text-gold">{docErr}</p> : null}
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
