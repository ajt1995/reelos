import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  ChevronRight,
  HardDrive,
  KeyRound,
  Shield,
  SlidersHorizontal,
  Tv,
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
  WatchReadPanel,
} from "@/components/settings-accordions";
import { PasswordRow, PerformanceRow, PwaRow } from "@/components/settings-panels";
import { SourcePanel } from "@/components/settings-source";
import { UpdatesRow } from "@/components/settings-updates";
import { LogsRow } from "@/components/settings-logs";
import { Doctor } from "@/components/settings-doctor";
import { TerminalRow } from "@/components/settings-terminal";
import { Row } from "@/components/settings-ui";

export { TerminalRow };

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
  const adapter = useReelStore((s) => s.adapter);
  const [panel, setPanel] = useState<string | null>(null);
  const profile = adapterProfile(answers.source, answers.frontend);

  return (
    <div className="page-enter px-5 py-6 md:px-10 md:py-8">
      <p className="font-display text-[11px] tracking-[0.28em] text-cyan uppercase">House</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1.5 max-w-xl text-sm text-muted">
        House identity, daily knobs, updates. Engines stay under Advanced.
      </p>

      <HouseCard />

      <div className="mt-6 grid gap-2.5">
        <Row
          icon={Tv}
          title="How to watch / read"
          hint="Jellyfin for movies and TV. Kavita for books."
          open={panel === "watch"}
          onClick={() => setPanel(panel === "watch" ? null : "watch")}
        >
          <WatchReadPanel />
        </Row>
        <Link
          to="/connect"
          className="card-glow flex items-center justify-between rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]"
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
        <UpdatesRow
          open={panel === "updates"}
          onClick={() => setPanel(panel === "updates" ? null : "updates")}
        />
        <LogsRow
          open={panel === "logs"}
          onClick={() => setPanel(panel === "logs" ? null : "logs")}
        />
        <TerminalRow
          open={panel === "term"}
          onClick={() => setPanel(panel === "term" ? null : "term")}
        />
      </div>

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
