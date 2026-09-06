import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useReelStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type Box = {
  provisioned: boolean;
  ipv4: string;
  watch: string;
  jellyfin: { state: "green" | "amber" | "red"; detail: string };
  frontend: string;
  access: string;
  adminName: string;
  adminPassword: string;
  tailscaleAuth: string | null;
  tailscaleInstalled: boolean;
  tailscaleUp: boolean;
};

const empty: Box = {
  provisioned: false,
  ipv4: "",
  watch: "",
  jellyfin: { state: "amber", detail: "Still starting" },
  frontend: "jellyfin",
  access: "lan",
  adminName: "reelos",
  adminPassword: "reelos",
  tailscaleAuth: null,
  tailscaleInstalled: false,
  tailscaleUp: false,
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

  const jfLock = box.jellyfin.state !== "green";
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
        Request in ReelOS. Watch in Jellyfin. This page is also in Settings.
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
              {box.tailscaleUp ? (
                <p className="text-foreground">This box is on Tailscale. Install the app on your phone and sign into the same account.</p>
              ) : (
                <>
                  <p>Install Tailscale on the phone too. First this box needs it — that was skipped on purpose during updates.</p>
                  <Button
                    className="mt-3"
                    disabled={tsBusy}
                    onClick={() => {
                      setTsBusy(true);
                      setTsMsg("Installing on the box. Apt can take a minute.");
                      void fetch("/api/tailscale/install", { method: "POST" })
                        .then((r) => r.json())
                        .then((j: { ok?: boolean; error?: string }) => {
                          setTsMsg(j.ok ? "Installing… watch for a login link below." : j.error || "Could not start");
                        })
                        .finally(() => setTsBusy(false));
                    }}
                  >
                    Install Tailscale on this box
                  </Button>
                  {tsMsg ? <p className="mt-2">{tsMsg}</p> : null}
                  {box.tailscaleAuth ? (
                    <>
                      <a className="mt-3 block break-all text-gold" href={box.tailscaleAuth}>
                        {box.tailscaleAuth}
                      </a>
                      <img
                        alt="Tailscale login"
                        className="mt-3 size-40 rounded-xl bg-white p-2"
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(box.tailscaleAuth)}`}
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
                    <p className="mt-2">Installed. Waiting for a login.tailscale.com link…</p>
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
            URL + API key. Skip is fine — search still finds titles. Request waits on no release.
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
