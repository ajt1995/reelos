import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  ChevronRight,
  HardDrive,
  KeyRound,
  Shield,
  SlidersHorizontal,
  ThumbsDown,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { adapterProfile } from "@/lib/adapter";
import {
  accessLabel,
  qualityLabel,
  sourceLabel,
  storageLabel,
  useReelStore,
} from "@/lib/store";
import { HouseCard } from "@/components/settings-house";
import {
  AccessPanel,
  LibraryPanel,
  NotesPanel,
  QualityPanel,
  UsersPanel,
} from "@/components/settings-accordions";
import { HardwareDetectedCard, PasswordRow, PerformanceRow, PwaRow } from "@/components/settings-panels";
import { SourcePanel } from "@/components/settings-source";
import { UpdatesRow } from "@/components/settings-updates";
import { LogsRow } from "@/components/settings-logs";
import { FixSection } from "@/components/settings-fix";
import { TerminalRow } from "@/components/settings-terminal";
import { Row, Section } from "@/components/settings-ui";

export { TerminalRow };

function CuratorResetRow() {
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    void fetch("/api/curator", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ count?: number }>)
      .then((j) => setCount(Number(j.count) || 0))
      .catch(() => {});
  }, []);
  const run = async () => {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/curator/reset", { method: "POST" });
      const j = (await r.json()) as { ok?: boolean; count?: number; error?: string };
      if (!j.ok && j.ok !== undefined) {
        setMsg(j.error || "Reset refused");
        setBusy(false);
        return;
      }
      setCount(Number(j.count) || 0);
      setMsg("Discover Not interested list cleared. Library on this box is unchanged.");
    } catch (e) {
      setMsg(String(e));
    }
    setBusy(false);
  };
  return (
    <div className="rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
      <div className="flex items-start gap-3">
        <ThumbsDown className="mt-0.5 size-4 text-faint" />
        <div className="min-w-0 flex-1">
          <p className="font-display font-medium">Reset curator preferences</p>
          <p className="mt-1 text-sm text-muted">
            Clears Not interested titles on Discover. Titles on this box stay on Home. No Google account.
            {count ? ` ${count} hidden.` : ""}
          </p>
          <Button className="mt-3" variant="ghost" size="sm" disabled={busy} onClick={() => void run()}>
            {busy ? "Resetting…" : "Reset curator preferences"}
          </Button>
          {msg ? <p className="mt-2 text-sm text-muted">{msg}</p> : null}
        </div>
      </div>
    </div>
  );
}

function FactoryResetRow() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const run = async () => {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/reset", { method: "POST" });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!j.ok) {
        setMsg(j.error || "Reset refused");
        setBusy(false);
        return;
      }
      useReelStore.getState().factoryReset();
      setMsg("Resetting. Wizard, then Connect.");
      window.setTimeout(() => window.location.reload(), 4000);
    } catch (e) {
      setMsg(String(e));
      setBusy(false);
    }
  };
  return (
    <div className="rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
      <p className="font-display font-medium">Factory reset</p>
      <p className="mt-1 text-sm text-muted">
        First-run again. Keeps media on disk. Wipes wizard answers and engine configs. Will not run during an update.
      </p>
      {!open ? (
        <Button className="mt-3" variant="danger" size="sm" onClick={() => setOpen(true)}>
          Factory reset
        </Button>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="danger" size="sm" disabled={busy} onClick={() => void run()}>
            {busy ? "Resetting…" : "Yes, reset"}
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      )}
      {msg ? <p className="mt-2 text-sm text-muted">{msg}</p> : null}
    </div>
  );
}

export function SettingsView() {
  const [lan, setLan] = useState("");
  const [advanced, setAdvanced] = useState(false);
  useEffect(() => {
    void fetch("/api/box", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ ipv4?: string | null }>)
      .then((b) => setLan(b.ipv4 || ""))
      .catch(() => {});
  }, []);
  const answers = useReelStore((s) => s.answers);
  const users = useReelStore((s) => s.users);
  const settings = useReelStore((s) => s.settings);
  const adapter = useReelStore((s) => s.adapter);
  const hideAdvanced = settings.hideAdvanced;
  const [panel, setPanel] = useState<string | null>(null);
  const profile = adapterProfile(answers.source, answers.frontend);

  return (
    <div className="px-5 py-6 md:px-10 md:py-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1.5 max-w-xl text-sm text-muted">
        House identity, daily knobs, and updates. The box heals itself — you should not need Heal.
      </p>

      <HouseCard />

      <Section title="This house" hint="Library, quality, who can request, how you reach the box.">
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
          <LibraryPanel />
        </Row>
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
          <QualityPanel />
        </Row>
        <Row
          icon={Users}
          title="Users"
          hint={`${users.length} in this house`}
          open={panel === "users"}
          onClick={() => setPanel(panel === "users" ? null : "users")}
        >
          <UsersPanel />
        </Row>
        <Row
          icon={Shield}
          title="Access"
          hint={accessLabel[answers.access]}
          open={panel === "access"}
          onClick={() => setPanel(panel === "access" ? null : "access")}
        >
          <AccessPanel lan={lan} />
        </Row>
        <PasswordRow open={panel === "pin"} onClick={() => setPanel(panel === "pin" ? null : "pin")} />
        <Row
          icon={Bell}
          title="Notifications"
          hint={settings.notifyAvailable ? "Available + failed" : "Off"}
          open={panel === "notes"}
          onClick={() => setPanel(panel === "notes" ? null : "notes")}
        >
          <NotesPanel />
        </Row>
      </Section>

      <Section title="Box" hint="Updates, changelog, performance, logs. Apply still lives here.">
        <HardwareDetectedCard />
        <UpdatesRow
          open={panel === "updates"}
          onClick={() => setPanel(panel === "updates" ? null : "updates")}
        />
        <PerformanceRow />
        <PwaRow />
        <CuratorResetRow />
        <LogsRow
          open={panel === "logs"}
          onClick={() => setPanel(panel === "logs" ? null : "logs")}
        />
      </Section>

      <Section title="Advanced" hint="Heal, hops, doctor, and nerd tools. Daily use does not need these.">
        <button
          type="button"
          className="flex items-center justify-between rounded-2xl bg-card px-5 py-4 text-left shadow-[var(--shadow-border)]"
          onClick={() => setAdvanced((v) => !v)}
        >
          <div>
            <p className="font-display font-medium">{advanced ? "Hide Advanced" : "Show Advanced"}</p>
            <p className="mt-1 text-sm text-muted">
              Named Fix scripts, hops, a shell, engines, factory reset. The box already self-heals in the background.
            </p>
          </div>
          <ChevronRight className={`size-4 text-faint transition-transform ${advanced ? "rotate-90" : ""}`} />
        </button>
        {advanced ? (
          <>
            <FixSection />
            {hideAdvanced ? null : (
              <Link
                to="/settings/advanced"
                className="flex items-center justify-between rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]"
              >
                <div>
                  <p className="font-display font-medium">Advanced apps</p>
                  <p className="mt-1 text-sm text-muted">
                    Radarr, Sonarr, Jellyfin by their house names. Daily use does not need these.
                  </p>
                </div>
                <ChevronRight className="size-4 text-faint" />
              </Link>
            )}
            <TerminalRow open={panel === "term"} onClick={() => setPanel(panel === "term" ? null : "term")} />
            <div className="rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
              <p className="font-display font-medium">Repair wizard</p>
              <p className="mt-1 text-sm text-muted">
                Walk the setup questions again (source, disks, quality). Does not Apply an update and does not delete
                /media.
              </p>
              <Button className="mt-3" variant="ghost" size="sm" onClick={() => useReelStore.getState().startRepair()}>
                Start wizard
              </Button>
            </div>
            <FactoryResetRow />
          </>
        ) : null}
      </Section>
    </div>
  );
}
