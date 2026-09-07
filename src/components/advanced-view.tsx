import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Clapperboard,
  Download,
  Film,
  ListFilter,
  Music,
  Subtitles,
  TriangleAlert,
} from "lucide-react";
import { adapterProfile } from "@/lib/adapter";
import { useReelStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { TerminalRow } from "@/components/settings-view";

const ENGINES = [
  { id: "indexers", label: "Indexers", blurb: "Empty on purpose. You add your own.", icon: ListFilter },
  { id: "movies", label: "Movies engine", blurb: "Monitors movie requests.", icon: Film },
  { id: "tv", label: "TV engine", blurb: "Monitors series and seasons.", icon: Clapperboard },
  { id: "music", label: "Music engine", blurb: "Monitors albums when Music is on.", icon: Music },
  { id: "subtitles", label: "Subtitles", blurb: "Wired to engines and the player.", icon: Subtitles },
  { id: "downloads", label: "Provider adapter", blurb: "Download client the engines speak to.", icon: Download },
  { id: "seerr", label: "Seerr", blurb: "Request UI. Watch stays Jellyfin.", icon: Film },
] as const;

export function AdvancedView() {
  const hide = useReelStore((s) => s.settings.hideAdvanced);
  const intent = useReelStore((s) => s.answers.intent);
  const answers = useReelStore((s) => s.answers);
  const [term, setTerm] = useState(false);
  const profile = adapterProfile(answers.source, answers.frontend);
  const tiles = ENGINES.filter((e) => {
    if (e.id === "movies" && !intent.movies) return false;
    if (e.id === "tv" && !intent.tv && !intent.anime) return false;
    if (e.id === "music" && !intent.music) return false;
    return true;
  }).map((e) =>
    e.id === "downloads" ? { ...e, label: profile.name, blurb: profile.blurb } : e,
  );

  return (
    <div className="px-5 py-6 md:px-10 md:py-8">
      <p className="inline-flex items-center gap-2 rounded-full bg-gold/10 px-3 py-1 text-xs text-gold">
        <TriangleAlert className="size-3.5" />
        You do not need these for daily use
      </p>
      <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">Advanced apps</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Human names. The fandom names stay behind the proxy. Same login as the shell.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {tiles.map((e) => (
          <Link
            key={e.id}
            to="/engine/$id"
            params={{ id: e.id }}
            className="flex items-start gap-4 rounded-2xl bg-card p-5 shadow-[var(--shadow-border)] transition-[box-shadow] hover:shadow-[var(--shadow-border-hover)]"
          >
            <e.icon className="mt-0.5 size-5 text-gold" />
            <span>
              <span className="block font-display font-medium">{e.label}</span>
              <span className="mt-1 block text-sm text-muted">{e.blurb}</span>
            </span>
          </Link>
        ))}
      </div>
      <div className="mt-8">
        <TerminalRow open={term} onClick={() => setTerm((v) => !v)} />
      </div>
      <ResetAppliance />
      <div className="mt-8">
        <Button
          variant="ghost"
          onClick={() => useReelStore.getState().patchSettings({ hideAdvanced: !hide })}
        >
          {hide ? "Show this section" : "Hide Advanced from Settings"}
        </Button>
      </div>
    </div>
  );
}

function ResetAppliance() {
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
    <div className="mt-8 rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
      <p className="font-display font-medium">Reset appliance</p>
      <p className="mt-1 text-sm text-muted">
        First-run again. Keeps media on disk and Docker images. Wipes wizard answers and engine configs. Will not run
        during an update.
      </p>
      {!open ? (
        <Button className="mt-3" variant="danger" onClick={() => setOpen(true)}>
          Reset appliance
        </Button>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="danger" disabled={busy} onClick={() => void run()}>
            {busy ? "Resetting…" : "Yes, wipe configs"}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      )}
      {msg ? <p className="mt-2 text-sm text-muted">{msg}</p> : null}
    </div>
  );
}
