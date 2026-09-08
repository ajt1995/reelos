import { useEffect, useState } from "react";
import { Home } from "lucide-react";
import { HOSTNAME } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";

export function HouseCard() {
  const answers = useReelStore((s) => s.answers);
  const [reveal, setReveal] = useState(false);
  const [box, setBox] = useState<{
    ipv4?: string;
    watch?: string;
    tailscaleIp?: string | null;
    tailscaleUp?: boolean;
    adminName?: string;
    adminPassword?: string;
  }>({});
  useEffect(() => {
    void fetch("/api/box", { cache: "no-store" })
      .then(
        (r) =>
          r.json() as Promise<{
            ipv4?: string;
            watch?: string;
            tailscaleIp?: string | null;
            tailscaleUp?: boolean;
            adminName?: string;
            adminPassword?: string;
          }>,
      )
      .then((b) => setBox(b))
      .catch(() => {});
  }, []);
  const user = box.adminName || answers.adminName || "reelos";
  const pin = box.adminPassword || answers.adminPassword || "";
  const lan = box.ipv4 || "";
  const jf = box.watch || (lan ? `http://${lan}:8096` : "");
  return (
    <div className="mt-6 rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
      <div className="flex items-start gap-3">
        <Home className="mt-0.5 size-5 text-muted" />
        <div className="min-w-0 flex-1">
          <p className="font-display font-medium">House</p>
          <p className="mt-1 text-sm text-muted">Who you are and how you reach this box.</p>
          <dl className="mt-3 grid gap-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">User</dt>
              <dd className="font-mono">{user}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Password</dt>
              <dd className="flex items-center gap-2 font-mono">
                {reveal ? pin || "—" : "••••"}
                <button type="button" className="text-xs text-gold" onClick={() => setReveal((v) => !v)}>
                  {reveal ? "Hide" : "Reveal"}
                </button>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">LAN</dt>
              <dd className="font-mono text-xs">{lan || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{HOSTNAME}</dt>
              <dd className="font-mono text-xs">http://{HOSTNAME}</dd>
            </div>
            {box.tailscaleUp && box.tailscaleIp ? (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Tailscale</dt>
                <dd className="font-mono text-xs">{box.tailscaleIp}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Jellyfin</dt>
              <dd className="truncate font-mono text-xs">{jf || ":8096"}</dd>
            </div>
          </dl>
          <p className="mt-2.5 text-xs text-faint">TV app login is this same user. Source / quality / library live in the rows below.</p>
        </div>
      </div>
    </div>
  );
}
