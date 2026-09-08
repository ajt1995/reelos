import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useReelStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type Box = {
  provisioned: boolean;
  ipv4: string;
  watch: string;
  seerr?: string;
  jellyfin: { state: "green" | "amber" | "red"; detail: string };
  frontend: string;
  access: string;
  adminName: string;
  adminPassword: string;
  tailscaleAuth: string | null;
  tailscaleInstalled: boolean;
  tailscaleUp: boolean;
  tailscaleIp?: string | null;
  tailscaleDns?: string | null;
  tailnet: string | null;
};

const empty: Box = {
  provisioned: false,
  ipv4: "",
  watch: "",
  seerr: "",
  jellyfin: { state: "amber", detail: "Still starting" },
  frontend: "jellyfin",
  access: "lan",
  adminName: "reelos",
  adminPassword: "reelos",
  tailscaleAuth: null,
  tailscaleInstalled: false,
  tailscaleUp: false,
  tailnet: null,
};

export function ConnectView({ onDone }: { onDone?: () => void }) {
  const navigate = useNavigate();
  const patchSettings = useReelStore((s) => s.patchSettings);
  const openReelOS = useReelStore((s) => s.openReelOS);
  const [box, setBox] = useState<Box>(empty);
  const [away, setAway] = useState<"house" | "out" | null>(null);
  const [idxName, setIdxName] = useState("Indexer");
  const [idxUrl, setIdxUrl] = useState("");
  const [idxKey, setIdxKey] = useState("");
  const [idxMsg, setIdxMsg] = useState("");
  const [tsBusy, setTsBusy] = useState(false);
  const [tsMsg, setTsMsg] = useState("");

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/box", { cache: "no-store" });
        const j = (await r.json()) as Box;
        if (!stop) setBox({ ...empty, ...j });
      } catch {
        if (!stop) setBox((b) => ({ ...b, jellyfin: { state: "red", detail: "Can't start" } }));
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 4000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  const finish = () => {
    patchSettings({ connectDone: true });
    openReelOS();
    onDone?.();
    void navigate({ to: "/" });
  };

  const jfLock = box.jellyfin.state === "red";
  const watch = box.watch || (box.ipv4 ? `http://${box.ipv4}:8096` : "");

  const addIndexer = async () => {
    setIdxMsg("");
    const r = await fetch("/api/indexer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: idxName, url: idxUrl, key: idxKey }),
    });
    const j = (await r.json()) as { ok?: boolean; error?: string };
    setIdxMsg(j.ok ? "Added." : j.error || "Could not add");
    if (j.ok) {
      setIdxUrl("");
      setIdxKey("");
    }
  };

  return (
    <div className="px-5 py-8 md:px-10">
      <p className="font-display text-xs tracking-[0.22em] text-gold uppercase">Connect</p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Your TV is not ReelOS</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Request in ReelOS (Discover). Watch in Jellyfin. Seerr on :5055 is the TV/admin door.
      </p>

      <Card>
        <Dot state={box.jellyfin.state} />
        <div>
          <p className="font-display font-medium">Jellyfin</p>
          <p className="mt-1 text-sm text-muted">{box.jellyfin.detail}</p>
        </div>
      </Card>

      <Card locked={jfLock}>
        <div className="w-full">
          <p className="font-display font-medium">Watch on the TV</p>
          <p className="mt-1 text-sm text-muted">
            Install Jellyfin on the TV → Add server → paste this. Not reelos.local.
          </p>
          {jfLock ? (
            <p className="mt-3 text-sm text-gold">{box.jellyfin.detail}</p>
          ) : (
            <>
              <p className="mt-4 break-all font-mono text-xl text-gold">{watch}</p>
              {watch ? (
                <img
                  alt="QR for the TV app"
                  className="mt-4 size-40 rounded-xl bg-white p-2"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(watch)}`}
                />
              ) : null}
              <p className="mt-3 text-sm text-muted">
                Login <span className="text-foreground">{box.adminName}</span> · PIN{" "}
                <span className="font-mono text-foreground">{box.adminPassword}</span>
              </p>
            </>
          )}
        </div>
      </Card>

      <Card locked={jfLock}>
        <div>
          <p className="font-display font-medium">Watch on this phone</p>
          <p className="mt-1 text-sm text-muted">
            Same login in this browser or the Jellyfin app. Request here, watch there.
          </p>
          {!jfLock && watch ? (
            <a href={watch} target="_blank" rel="noreferrer">
              <Button className="mt-3" size="lg">
                Open Jellyfin in this browser
              </Button>
            </a>
          ) : null}
        </div>
      </Card>

      <Card>
        <div className="w-full">
          <p className="font-display font-medium">Seerr (TV / admin)</p>
          <p className="mt-1 text-sm text-muted">
            Phone search and Request stay in ReelOS. Same Jellyfin login. After Apply, hook Radarr, Sonarr, and
            Jellyfin in Seerr if wire did not finish.
          </p>
          {box.seerr || box.ipv4 ? (
            <>
              <p className="mt-4 break-all font-mono text-xl text-gold">
                {box.seerr || `http://${box.ipv4}:5055`}
              </p>
              <a href={box.seerr || `http://${box.ipv4}:5055`} target="_blank" rel="noreferrer">
                <Button className="mt-3" size="lg">
                  Open Seerr
                </Button>
              </a>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">Waiting on LAN address.</p>
          )}
        </div>
      </Card>

      <Card>
        <div className="w-full">
          <p className="font-display font-medium">Away from home</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant={away === "house" ? "default" : "ghost"} onClick={() => setAway("house")}>
              Only this house
            </Button>
            <Button variant={away === "out" ? "default" : "ghost"} onClick={() => setAway("out")}>
              Also my phone when I'm out
            </Button>
          </div>
          {away === "out" ? (
            <div className="mt-4 text-sm text-muted">
              {box.tailscaleUp && box.tailscaleIp ? (
                <div className="text-foreground">
                  <p className="font-display text-2xl tracking-tight">{box.tailscaleIp}</p>
                  {box.tailscaleDns ? <p className="mt-1 text-gold">{box.tailscaleDns}</p> : null}
                  {box.tailnet ? <p className="mt-1">Tailnet {box.tailnet}. Survives reboot.</p> : null}
                  <p className="mt-3">
                    Phone: Tailscale app, same account, then{" "}
                    <span className="text-gold">http://{box.tailscaleIp}</span>
                  </p>
                </div>
              ) : (
                <>
                  <p>Install the Tailscale app on the phone, same account. First this box has to log in.</p>
                  <Button
                    className="mt-3"
                    disabled={tsBusy}
                    onClick={() => {
                      setTsBusy(true);
                      setTsMsg("Getting a login link…");
                      void fetch("/api/tailscale/login", { method: "POST" })
                        .then((r) => r.json())
                        .then((j: { ok?: boolean; error?: string; auth?: string; up?: boolean }) => {
                          if (j.up) setTsMsg("Already logged in.");
                          else setTsMsg(j.ok ? "Open the link or scan the QR." : j.error || "Could not start login");
                        })
                        .finally(() => setTsBusy(false));
                    }}
                  >
                    Get Tailscale login
                  </Button>
                  {tsMsg ? <p className="mt-2">{tsMsg}</p> : null}
                  {box.tailscaleAuth ? (
                    <>
                      <a className="mt-4 block break-all font-display text-2xl text-gold" href={box.tailscaleAuth}>
                        {box.tailscaleAuth}
                      </a>
                      <img
                        alt="Tailscale login"
                        className="mt-3 size-52 rounded-xl bg-white p-2"
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(box.tailscaleAuth)}`}
                      />
                      <Button
                        className="mt-3"
                        variant="ghost"
                        onClick={() => {
                          void fetch("/api/tailscale/check", { method: "POST" });
                        }}
                      >
                        I've signed in
                      </Button>
                    </>
                  ) : box.tailscaleInstalled ? (
                    <p className="mt-2">Installed. Not logged in — tap Get Tailscale login.</p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <div className="w-full">
          <p className="font-display font-medium">Indexers</p>
          <p className="mt-1 text-sm text-muted">
            Optional extra Torznab. Skip is valid — the provider is already the first release source.
          </p>
          <input
            className="mt-3 h-11 w-full rounded-xl bg-raised px-3 text-sm"
            value={idxName}
            onChange={(e) => setIdxName(e.target.value)}
            placeholder="Name"
          />
          <input
            className="mt-2 h-11 w-full rounded-xl bg-raised px-3 text-sm"
            value={idxUrl}
            onChange={(e) => setIdxUrl(e.target.value)}
            placeholder="https://…"
          />
          <input
            className="mt-2 h-11 w-full rounded-xl bg-raised px-3 text-sm"
            value={idxKey}
            onChange={(e) => setIdxKey(e.target.value)}
            placeholder="API key"
          />
          <div className="mt-3 flex gap-2">
            <Button onClick={() => void addIndexer()}>Add</Button>
            <Button variant="ghost" onClick={() => setIdxMsg("Skipped")}>
              Skip
            </Button>
          </div>
          {idxMsg ? <p className="mt-2 text-xs text-muted">{idxMsg}</p> : null}
        </div>
      </Card>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button size="lg" onClick={finish}>
          Open ReelOS
        </Button>
        <Button variant="ghost" onClick={finish}>
          Skip
        </Button>
      </div>
    </div>
  );
}

function Card({ children, locked }: { children: React.ReactNode; locked?: boolean }) {
  return (
    <div
      className={cn(
        "mt-4 flex items-start gap-3 rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]",
        locked && "opacity-50",
      )}
    >
      {children}
    </div>
  );
}

function Dot({ state }: { state: "green" | "amber" | "red" }) {
  const color = state === "green" ? "bg-live" : state === "amber" ? "bg-gold" : "bg-danger";
  return <span className={cn("mt-1 size-2.5 shrink-0 rounded-full", color)} />;
}
