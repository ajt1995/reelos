import { useEffect, useState } from "react";
import { Cpu, KeyRound, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Row } from "@/components/settings-ui";

export function DisksPanel() {
  const [disks, setDisks] = useState<{ name: string; size: string; model: string; mount: string; os: boolean }[]>([]);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    void fetch("/api/disks", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { disks?: typeof disks }) => setDisks(j.disks || []));
  }, []);
  return (
    <div className="mt-4">
      <p className="text-sm text-muted">Extra disks. Will not mount over /srv/media.</p>
      <ul className="mt-2 space-y-2">
        {disks.map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-3 text-sm">
            <span>
              /dev/{d.name} · {d.size} {d.os ? "(OS)" : ""}
              {d.mount ? ` · ${d.mount}` : ""}
            </span>
            {!d.os ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void fetch("/api/storage", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ disk: d.name }),
                  })
                    .then((r) => r.json())
                    .then((j: { ok?: boolean; dest?: string; error?: string }) => {
                      setMsg(j.ok ? `Mounted at ${j.dest}` : j.error || "Mount failed");
                    });
                }}
              >
                Use this disk
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {msg ? <p className="mt-2 text-xs text-muted">{msg}</p> : null}
    </div>
  );
}

export function PwaRow() {
  return (
    <div className="rounded-2xl bg-card px-5 py-3 shadow-[var(--shadow-border)]">
      <p className="font-display text-sm font-medium">Add to Home Screen</p>
      <p className="mt-0.5 text-xs text-muted">
        Browser menu → Add to Home Screen. Already a PWA — not an APK.
      </p>
    </div>
  );
}

export function PerformanceRow() {
  const [low, setLow] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void fetch("/api/performance", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ low?: boolean }>)
      .then((j) => setLow(j.low !== false))
      .catch(() => {});
  }, []);
  const toggle = async () => {
    setBusy(true);
    const next = !low;
    try {
      const r = await fetch("/api/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ low: next }),
      });
      const j = (await r.json()) as { low?: boolean };
      setLow(j.low !== false);
    } catch {
      /* */
    }
    setBusy(false);
  };
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
      <div className="flex items-start gap-3">
        <Cpu className="mt-0.5 size-5 text-muted" />
        <div>
          <p className="font-display font-medium">Low performance mode</p>
          <p className="mt-1 text-sm text-muted">
            Trickplay, chapter images, subtitle extraction, and intro scans stay off so Jellyfin does not read TorBox dumps. Default on for this box.
          </p>
        </div>
      </div>
      <Button variant={low ? "gold" : "ghost"} onClick={() => void toggle()} disabled={busy}>
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
        {low ? "On" : "Off"}
      </Button>
    </div>
  );
}

export function PasswordRow({ open, onClick }: { open: boolean; onClick: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState("");
  const change = async () => {
    setMsg("");
    const r = await fetch("/api/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current, next }),
    });
    const j = (await r.json()) as { ok?: boolean; error?: string };
    setMsg(j.ok ? "PIN updated." : j.error || "Could not change PIN");
    if (j.ok) {
      setCurrent("");
      setNext("");
    }
  };
  return (
    <Row icon={KeyRound} title="Box PIN" hint="Not reelos/reelos" open={open} onClick={onClick}>
      <p className="text-sm text-muted">Changes the wizard PIN and the Jellyfin user when that engine is up.</p>
      <input
        className="mt-3 h-11 w-full rounded-xl bg-raised px-3 text-sm"
        type="password"
        placeholder="Current PIN"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
      />
      <input
        className="mt-2 h-11 w-full rounded-xl bg-raised px-3 text-sm"
        type="password"
        placeholder="New PIN"
        value={next}
        onChange={(e) => setNext(e.target.value)}
      />
      <Button className="mt-3" onClick={() => void change()}>
        Change PIN
      </Button>
      {msg ? <p className="mt-2 text-sm text-muted">{msg}</p> : null}
    </Row>
  );
}
