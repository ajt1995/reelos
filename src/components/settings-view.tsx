import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  Check,
  ChevronRight,
  Cpu,
  HardDrive,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Shield,
  SlidersHorizontal,
  SquareTerminal,
  ScrollText,
  TriangleAlert,
  Usb,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HOSTNAME } from "@/lib/catalog";
import { adapterProfile } from "@/lib/adapter";
import {
  accessLabel,
  CHANNEL,
  frontendLabel,
  qualityLabel,
  sourceLabel,
  storageLabel,
  useReelStore,
} from "@/lib/store";
import { cn, formatWhen } from "@/lib/utils";

export function SettingsView() {
  const [lan, setLan] = useState("");
  useEffect(() => {
    void fetch("/api/box", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ ipv4?: string | null }>)
      .then((b) => setLan(b.ipv4 || ""))
      .catch(() => {});
  }, []);
  const answers = useReelStore((s) => s.answers);
  const users = useReelStore((s) => s.users);
  const settings = useReelStore((s) => s.settings);
  const patchSettings = useReelStore((s) => s.patchSettings);
  const patchIntent = useReelStore((s) => s.patchIntent);
  const addUser = useReelStore((s) => s.addUser);
  const removeUser = useReelStore((s) => s.removeUser);
  const adapter = useReelStore((s) => s.adapter);
  const [name, setName] = useState("");
  const [panel, setPanel] = useState<string | null>(null);
  const profile = adapterProfile(answers.source, answers.frontend);

  return (
    <div className="px-5 py-6 md:px-10 md:py-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Daily knobs live here. Engines are under Advanced, and you do not need them.
      </p>

      <div className="mt-8 grid gap-3">
        <Link
          to="/connect"
          className="flex items-center justify-between rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]"
        >
          <div>
            <p className="font-display font-medium">Connect</p>
            <p className="mt-1 text-sm text-muted">TV, phone, away from home, indexers.</p>
          </div>
          <ChevronRight className="size-4 text-faint" />
        </Link>
        <Row
          icon={HardDrive}
          title="Library"
          hint={`${storageLabel[answers.storageMode]} · ${answers.selectedDisks.join(", ") || "no extra disks"}`}
          open={panel === "library"}
          onClick={() => setPanel(panel === "library" ? null : "library")}
        >
          <p className="text-sm text-muted">Collections installed from your wizard answers.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                ["movies", "Movies"],
                ["tv", "TV"],
                ["anime", "Anime"],
                ["kids", "Kids"],
                ["music", "Music"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => patchIntent({ [k]: !answers.intent[k] })}
                className={cn(
                  "h-9 rounded-full px-4 text-sm",
                  answers.intent[k] ? "bg-gold text-gold-fg" : "bg-card-2 text-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <DisksPanel />
        </Row>
        <PwaRow />
        <PerformanceRow />
        <Row
          icon={KeyRound}
          title="Source"
          hint={`${sourceLabel[answers.source]} · ${adapter.status === "healthy" ? profile.name : "offline"}`}
          open={panel === "source"}
          onClick={() => setPanel(panel === "source" ? null : "source")}
        >
          <SourcePanel />
        </Row>
        <Row
          icon={SlidersHorizontal}
          title="Quality"
          hint={qualityLabel[answers.quality]}
          open={panel === "quality"}
          onClick={() => setPanel(panel === "quality" ? null : "quality")}
        >
          <p className="text-sm text-muted">
            Re-run the wizard to change the floor. Anime profiles stay attached when Anime is on.
          </p>
        </Row>
        <Row
          icon={Users}
          title="Users"
          hint={`${users.length} in this house`}
          open={panel === "users"}
          onClick={() => setPanel(panel === "users" ? null : "users")}
        >
          <ul className="space-y-2">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between text-sm">
                <span>
                  {u.name}{" "}
                  <span className="text-faint">{u.role === "admin" ? "admin" : "member"}</span>
                </span>
                {u.role !== "admin" ? (
                  <button type="button" className="text-xs text-danger" onClick={() => removeUser(u.id)}>
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addUser(name);
              setName("");
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Invite name"
              className="h-10 flex-1 rounded-xl bg-card-2 px-3 text-sm"
            />
            <Button size="sm" type="submit">
              Add
            </Button>
          </form>
          <label className="mt-4 flex items-center justify-between text-sm">
            Auto-approve requests
            <Toggle
              on={settings.autoApprove}
              onChange={(v) => patchSettings({ autoApprove: v })}
            />
          </label>
        </Row>
        <Row
          icon={Shield}
          title="Access"
          hint={accessLabel[answers.access]}
          open={panel === "access"}
          onClick={() => setPanel(panel === "access" ? null : "access")}
        >
          <p className="font-mono text-sm">
            {HOSTNAME}
            <span className="ml-3 text-muted">{lan || "no LAN yet"}</span>
          </p>
          <p className="mt-2 text-sm text-muted">Watching: {frontendLabel[answers.frontend]}</p>
        </Row>
        <PasswordRow open={panel === "pin"} onClick={() => setPanel(panel === "pin" ? null : "pin")} />
        <Row
          icon={Bell}
          title="Notifications"
          hint={settings.notifyAvailable ? "Available + failed" : "Off"}
          open={panel === "notes"}
          onClick={() => setPanel(panel === "notes" ? null : "notes")}
        >
          <label className="flex items-center justify-between text-sm">
            When a title becomes available
            <Toggle
              on={settings.notifyAvailable}
              onChange={(v) => patchSettings({ notifyAvailable: v })}
            />
          </label>
          <label className="mt-3 flex items-center justify-between text-sm">
            When a request fails
            <Toggle
              on={settings.notifyFailed}
              onChange={(v) => patchSettings({ notifyFailed: v })}
            />
          </label>
        </Row>
        <UpdatesRow
          open={panel === "updates"}
          onClick={() => setPanel(panel === "updates" ? null : "updates")}
        />
        <LogsRow
          open={panel === "logs"}
          onClick={() => setPanel(panel === "logs" ? null : "logs")}
        />
        <InstallRow
          open={panel === "install"}
          onClick={() => setPanel(panel === "install" ? null : "install")}
        />
      </div>

      {!settings.hideAdvanced ? (
        <Link
          to="/settings/advanced"
          className="mt-4 flex items-center justify-between rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]"
        >
          <div>
            <p className="font-display font-medium">Advanced apps</p>
            <p className="mt-1 text-sm text-muted">Engines. You do not need these for daily use.</p>
          </div>
          <ChevronRight className="size-4 text-faint" />
        </Link>
      ) : null}

      <Doctor />

      <div className="mt-8 flex flex-wrap gap-3">
        <Button variant="ghost" onClick={() => useReelStore.getState().startRepair()}>
          Repair wizard
        </Button>
        <Button variant="danger" onClick={() => useReelStore.getState().factoryReset()}>
          Factory reset
        </Button>
      </div>
    </div>
  );
}

function DisksPanel() {
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

function PwaRow() {
  return (
    <div className="mt-3 rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
      <p className="font-display font-medium">Add to Home Screen</p>
      <p className="mt-1 text-sm text-muted">
        Browser menu → Add to Home Screen. This page is already a PWA. Not an APK.
      </p>
    </div>
  );
}

function PerformanceRow() {
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
            Trickplay and chapter images off. Default on for this box.
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

function PasswordRow({ open, onClick }: { open: boolean; onClick: () => void }) {
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

function SourcePanel() {
  const answers = useReelStore((s) => s.answers);
  const adapter = useReelStore((s) => s.adapter);
  const pingAdapter = useReelStore((s) => s.pingAdapter);
  const profile = adapterProfile(answers.source, answers.frontend);
  return (
    <div>
      <p className="font-mono text-sm">
        {profile.name}
        <span className="ml-3 text-muted">{profile.api}</span>
      </p>
      <p className="mt-2 text-sm text-muted">{profile.blurb}</p>
      <dl className="mt-4 grid gap-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Provider</dt>
          <dd>{sourceLabel[answers.source]}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Account</dt>
          <dd>
            {adapter.account}
            {adapter.daysLeft ? ` · ${adapter.daysLeft}d` : ""}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Mount</dt>
          <dd className="font-mono text-xs">{adapter.mount}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Key</dt>
          <dd className="font-mono text-xs">
            {answers.source === "local-vpn"
              ? "None"
              : answers.apiKey
                ? `••••${answers.apiKey.slice(-4)}`
                : "Missing"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Cache / transfer</dt>
          <dd>
            {adapter.cacheHits} / {adapter.transfers}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={pingAdapter}>
          Ping
        </Button>
        <Link to="/engine/$id" params={{ id: "downloads" }} className="text-sm text-gold">
          Open adapter
        </Link>
        <span className="text-xs text-faint">
          {adapter.status === "healthy"
            ? `${adapter.pingMs}ms · ${adapter.lastPing ? formatWhen(adapter.lastPing) : "never"}`
            : "Offline"}
        </span>
      </div>
    </div>
  );
}

function UpdatesRow({ open, onClick }: { open: boolean; onClick: () => void }) {
  const update = useReelStore((s) => s.update);
  const autoUpdate = useReelStore((s) => s.settings.autoUpdate);
  const stackImages = useReelStore((s) => s.settings.stackImages);
  const patchSettings = useReelStore((s) => s.patchSettings);
  const checkForUpdate = useReelStore((s) => s.checkForUpdate);
  const startUpdate = useReelStore((s) => s.startUpdate);

  const hint =
    update.status === "applying"
      ? `Applying ${update.target ?? ""}`
      : update.status === "available"
        ? `${update.target} is ready`
        : update.status === "checking"
          ? "Checking the stable channel"
          : update.status === "current"
            ? `${update.current} · up to date`
            : `${update.current} · ${CHANNEL}`;

  return (
    <Row icon={RefreshCw} title="Updates" hint={hint} open={open} onClick={onClick}>
      <p className="font-mono text-sm">
        ReelOS {update.current}
        <span className="ml-3 text-muted">{CHANNEL}</span>
      </p>
      <p className="mt-2 text-sm text-muted">
        Host patches from Ubuntu, ReelOS from GitHub. Stack images stay frozen unless you flip the toggle. Libraries stay put.
      </p>
      {update.status === "error" && update.notes[0] ? (
        <p className="mt-2 text-sm text-danger">{update.notes[0].slice(0, 180)}</p>
      ) : null}

      {update.status === "available" ? (
        <ul className="mt-4 space-y-1.5 text-sm text-muted">
          {update.notes.map((n) => (
            <li key={n}>· {n}</li>
          ))}
        </ul>
      ) : null}

      {update.status === "applying" ? (
        <ol className="mt-4 space-y-2">
          {update.steps.map((s) => (
            <li key={s.id} className="flex items-start gap-2 text-sm">
              {s.status === "done" ? (
                <Check className="mt-0.5 size-3.5 text-gold" strokeWidth={3} />
              ) : s.status === "running" ? (
                <LoaderCircle className="mt-0.5 size-3.5 animate-spin text-gold" />
              ) : (
                <span className="mt-1.5 size-1.5 rounded-full bg-faint/40" />
              )}
              <span>
                <span className={s.status === "pending" ? "text-faint" : ""}>{s.label}</span>
                {s.log ? (
                  <span className="mt-0.5 block font-mono text-[11px] text-faint">{s.log}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={checkForUpdate}
          disabled={update.status === "checking" || update.status === "applying"}
        >
          {update.status === "checking" ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Check
        </Button>
        {update.status === "available" ? (
          <Button size="sm" onClick={startUpdate}>
            Apply {update.target}
          </Button>
        ) : null}
      </div>

      <label className="mt-4 flex items-center justify-between text-sm">
        Check the stable channel daily
        <Toggle on={autoUpdate} onChange={(v) => patchSettings({ autoUpdate: v })} />
      </label>
      <label className="mt-3 flex items-center justify-between text-sm">
        Also pull Jellyfin / engine images
        <Toggle on={stackImages} onChange={(v) => patchSettings({ stackImages: v })} />
      </label>
    </Row>
  );
}

export function TerminalRow({ open, onClick }: { open: boolean; onClick: () => void }) {
  const [cmd, setCmd] = useState("");
  const [out, setOut] = useState("");
  const [running, setRunning] = useState(false);
  const [cwd, setCwd] = useState("/home/reelos");
  const pre = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (pre.current) pre.current.scrollTop = pre.current.scrollHeight;
  }, [out]);

  useEffect(() => {
    if (!running) return;
    let stop = false;
    const tick = async () => {
      while (!stop) {
        const r = await fetch("/api/terminal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }).then((x) => x.json());
        if (stop) return;
        setOut(r.output || "");
        setRunning(Boolean(r.running));
        if (r.cwd) setCwd(r.cwd);
        if (!r.running) return;
        await new Promise((res) => setTimeout(res, 700));
      }
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [running]);

  const run = async () => {
    const command = cmd.trim();
    if (!command || running) return;
    setRunning(true);
    const r = await fetch("/api/terminal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
    }).then((x) => x.json());
    setOut(r.output || "");
    setRunning(Boolean(r.running));
    if (r.cwd) setCwd(r.cwd);
  };

  const kill = async () => {
    const r = await fetch("/api/terminal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kill: true }),
    }).then((x) => x.json());
    setOut(r.output || "");
    setRunning(Boolean(r.running));
  };

  return (
    <Row
      icon={SquareTerminal}
      title="Terminal"
      hint={running ? "Running on this box" : "Paste a command · runs here"}
      open={open}
      onClick={onClick}
    >
      <p className="text-sm text-muted">
        This is the box. Paste from your phone. You are already root — skip sudo.
      </p>
      <p className="mt-1 font-mono text-[11px] text-faint">{cwd}</p>
      <textarea
        value={cmd}
        onChange={(e) => setCmd(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void run();
          }
        }}
        spellCheck={false}
        placeholder={"curl -fsSL …\nbash /tmp/reelos-update.sh apply"}
        className="mt-3 min-h-[96px] w-full resize-y rounded-xl bg-[#07080a] px-3 py-2.5 font-mono text-[12px] leading-relaxed text-[#d4e0c8] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void run()} disabled={!cmd.trim() || running}>
          {running ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Run
        </Button>
        {running ? (
          <Button size="sm" variant="danger" onClick={() => void kill()}>
            Stop
          </Button>
        ) : null}
        {out ? (
          <Button size="sm" variant="ghost" onClick={() => setOut("")}>
            Clear
          </Button>
        ) : null}
      </div>
      <pre
        ref={pre}
        className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-[#07080a] px-3 py-2.5 font-mono text-[11px] leading-relaxed text-[#9ccc7c]"
      >
        {out || "output lands here"}
      </pre>
    </Row>
  );
}

function InstallRow({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <Row
      icon={Usb}
      title="Install on a machine"
      hint="Bootable ISO · ReelOS 1.2"
      open={open}
      onClick={onClick}
    >
      <p className="text-sm leading-relaxed text-muted">
        One disc. Boot it, it installs Ubuntu Server 26.04 and ReelOS 1.2. It will wipe the disk you point it at.
        Join Wi-Fi on that screen if the box has no ethernet.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href="/install/reelos-1.2.iso"
          download
          className="inline-flex h-9 items-center rounded-full bg-gold px-4 text-sm text-gold-fg"
        >
          Download ReelOS 1.2
        </a>
        <a
          href="/install/reelos-vm.zip"
          download
          className="inline-flex h-9 items-center rounded-full bg-card px-4 text-sm text-muted shadow-[var(--shadow-border)]"
        >
          VM pack
        </a>
      </div>
      <ol className="mt-4 space-y-2 text-sm text-muted">
        <li>1. Write the ISO to a USB, or attach it as a DVD in VirtualBox / VMware / Proxmox.</li>
        <li>2. Boot. “Install ReelOS 1.2” is the default (2 seconds). Join Wi-Fi if asked.</li>
        <li>3. It autoinstalls hostname reelos, then first-boot. Default login reelos / reelos — change it.</li>
        <li>4. From another device, open reelos.local. Seven questions. Validate a Real-Debrid key against the live API.</li>
      </ol>
      <p className="mt-4 text-sm text-muted">
        UEFI and BIOS. About 2.8 GB. Volume id ReelOS 1.2. The pack is the same installer if you already have Ubuntu.
      </p>
      <p className="mt-3 break-all font-mono text-[11px] leading-relaxed text-faint">
        SHA256 8392b2c122235ed691bc8c8e0f950e67f7ef4e5754167e06179d22ad717c4962
      </p>
      <p className="mt-3 text-sm text-muted">
        No indexers seeded. Engines only talk to the debrid adapter. Extra apt packages cannot abort this disc.
      </p>
    </Row>
  );
}

function Row({
  icon: Icon,
  title,
  hint,
  open,
  onClick,
  children,
}: {
  icon: typeof HardDrive;
  title: string;
  hint: string;
  open: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-card shadow-[var(--shadow-border)]">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-4 px-5 py-4 text-left"
      >
        <Icon className="size-5 text-gold" />
        <span className="flex-1">
          <span className="block font-display font-medium">{title}</span>
          <span className="mt-0.5 block text-sm text-muted">{hint}</span>
        </span>
        <ChevronRight className={cn("size-4 text-faint transition-transform", open && "rotate-90")} />
      </button>
      {open ? <div className="border-t border-border px-5 py-4">{children}</div> : null}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors",
        on ? "bg-gold" : "bg-card-2",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-foreground transition-transform",
          on ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function LogsRow({ open, onClick }: { open: boolean; onClick: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [text, setText] = useState("");
  const loaded = useRef(false);

  const grab = async () => {
    const r = await fetch("/api/logs", { cache: "no-store", signal: AbortSignal.timeout(15000) });
    const j = (await r.json()) as { ok?: boolean; text?: string; error?: string };
    if (!j.text) throw new Error(j.error || "No logs");
    return j.text;
  };

  const load = async () => {
    setBusy(true);
    setMsg("Collecting…");
    try {
      const t = await grab();
      setText(t);
      loaded.current = true;
      setMsg(`${t.split("\n").length} lines`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Collect failed");
    }
    setBusy(false);
  };

  useEffect(() => {
    if (open && !loaded.current && !busy) void load();
  }, [open]);

  const copy = async () => {
    setBusy(true);
    try {
      const t = text || (await grab());
      if (!text) setText(t);
      await navigator.clipboard.writeText(t);
      setMsg("Copied. Paste that here.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Copy failed");
    }
    setBusy(false);
  };

  const download = async () => {
    setBusy(true);
    try {
      const t = text || (await grab());
      if (!text) setText(t);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([t], { type: "text/plain" }));
      a.download = "reelos-house.txt";
      a.click();
      setMsg("Downloaded reelos-house.txt");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Download failed");
    }
    setBusy(false);
  };

  return (
    <Row icon={ScrollText} title="Logs" hint={msg || "Last hour on this box"} open={open} onClick={onClick}>
      <p className="text-sm text-muted">
        On-screen dump from this machine. Keys stripped. Copy and paste here — not a screenshot.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void load()} disabled={busy}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Refresh
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void copy()} disabled={busy}>
          Copy
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void download()} disabled={busy}>
          Download
        </Button>
      </div>
      {text ? (
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-raised p-3 font-mono text-[11px] leading-4 text-muted">
          {text}
        </pre>
      ) : (
        <p className="mt-3 text-sm text-faint">{busy ? "Collecting from the box…" : "Open this row to load."}</p>
      )}
    </Row>
  );
}

function Doctor() {
  const answers = useReelStore((s) => s.answers);
  const version = useReelStore((s) => s.update.current);
  const status = useReelStore((s) => s.update.status);
  const adapter = useReelStore((s) => s.adapter);
  const profile = adapterProfile(answers.source, answers.frontend);
  const [live, setLive] = useState<{ ok: boolean; label: string; detail: string }[] | null>(null);
  const [wireMsg, setWireMsg] = useState("");

  const load = () => {
    void fetch("/api/doctor", { cache: "no-store", signal: AbortSignal.timeout(8000) })
      .then((r) => r.json())
      .then((r: { live?: boolean; checks?: { ok: boolean; label: string; detail: string }[] }) => {
        if (r.live && r.checks?.length) setLive(r.checks);
      })
      .catch(() => {});
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
        <Button variant="ghost" onClick={() => load()}>
          Run doctor
        </Button>
        <Button variant="ghost" onClick={() => void rewire()}>
          Rewire engines
        </Button>
        {wireMsg ? <p className="text-sm text-muted">{wireMsg}</p> : null}
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
