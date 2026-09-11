import { useEffect, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  HardDrive,
  Layers,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { SOURCES } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import type {
  AccessMode,
  Frontend,
  QualityFloor,
  StorageMode,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  accessHonestyError,
  frontendHonestyError,
  sourceValidateError,
} from "@/lib/wizard-honesty";

const TOTAL = 7;

export function Wizard() {
  const step = useReelStore((s) => s.wizardStep);
  const answers = useReelStore((s) => s.answers);
  const setStep = useReelStore((s) => s.setWizardStep);
  const startBuild = useReelStore((s) => s.startBuild);
  const [finishErr, setFinishErr] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [sourceOk, setSourceOk] = useState(false);

  const go = (n: number) => setStep(Math.min(TOTAL, Math.max(1, n)));

  const finish = async () => {
    setFinishErr("");
    setFinishing(true);
    try {
      const r = await fetch("/api/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const j = (await r.json()) as { ok?: boolean; simulated?: boolean; error?: string };
      if (!j.ok || j.simulated) {
        setFinishErr(j.error || "Compose did not start");
        setFinishing(false);
        return;
      }
      startBuild();
    } catch (e) {
      setFinishErr(String(e));
      setFinishing(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-[-8rem] size-[28rem] rounded-full bg-circuit/10 blur-[90px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 bottom-[-6rem] size-[22rem] rounded-full bg-circuit/8 blur-[80px]"
      />
      <header className="flex items-center justify-between px-4 py-3 md:px-10">
        <Wordmark markClassName="size-7" />
        <p className="font-display text-sm tracking-[0.22em] text-muted tabular-nums">
          {String(step).padStart(2, "0")} / {String(TOTAL).padStart(2, "0")}
        </p>
      </header>
      <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-3 md:px-8">
        {step === 1 && <StepStorage />}
        {step === 2 && <StepSource sourceOk={sourceOk} setSourceOk={setSourceOk} />}
        {step === 3 && <StepIntent />}
        {step === 4 && <StepQuality />}
        {step === 5 && <StepFrontend />}
        {step === 6 && <StepAdmin />}
        {step === 7 && <StepAccess />}
      </div>
      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/85 px-4 py-3 backdrop-blur-md md:px-10">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => (step === 1 ? useReelStore.getState().setPhase("splash") : go(step - 1))}
          >
            <ChevronLeft className="size-4" />
            Back
          </Button>
          <Button
            onClick={() => {
              if (step < TOTAL) go(step + 1);
              else void finish();
            }}
            disabled={!canContinue(step, answers, sourceOk) || finishing}
          >
            {finishing ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {step === TOTAL ? "Finish" : "Continue"}
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {finishErr ? <p className="mx-auto mt-2 max-w-3xl text-sm text-danger">{finishErr}</p> : null}
      </footer>
    </div>
  );
}

function canContinue(
  step: number,
  a: ReturnType<typeof useReelStore.getState>["answers"],
  sourceOk: boolean,
) {
  if (step === 2) {
    if (sourceValidateError(a.source)) return false;
    return a.apiKey.trim().length >= 10 && sourceOk;
  }
  if (step === 3) {
    const i = a.intent;
    return i.movies || i.tv || i.anime || i.kids || i.music || i.books;
  }
  if (step === 5) return !frontendHonestyError(a.frontend);
  if (step === 6) return a.adminName.trim().length >= 2 && a.adminPassword.length >= 8;
  if (step === 7) return !accessHonestyError(a.access);
  return true;
}

function Heading({ kicker, title, sub }: { kicker?: string; title: string; sub: string }) {
  return (
    <div className="mb-5 rise">
      {kicker ? (
        <p className="mb-1.5 font-display text-xs tracking-[0.22em] text-circuit uppercase">{kicker}</p>
      ) : null}
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
        {title}
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{sub}</p>
    </div>
  );
}

function Card({
  selected,
  onClick,
  children,
  className,
  disabled,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative w-full rounded-xl p-3.5 text-left transition-[box-shadow,background-color,transform] duration-150 ease-out",
        selected
          ? "bg-circuit/8 shadow-[var(--shadow-circuit)]"
          : "bg-card shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]",
        disabled && "opacity-45",
        className,
      )}
    >
      {selected ? (
        <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-circuit text-background">
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      ) : null}
      {children}
    </button>
  );
}

function StepStorage() {
  const mode = useReelStore((s) => s.answers.storageMode);
  const selected = useReelStore((s) => s.answers.selectedDisks);
  const format = useReelStore((s) => s.answers.formatDisks);
  const patch = useReelStore((s) => s.patchAnswers);
  const [disks, setDisks] = useState<{ name: string; size: string; os: boolean; model: string }[]>([]);
  useEffect(() => {
    void fetch("/api/disks", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { disks?: typeof disks }) => setDisks(j.disks || []));
  }, []);

  const options: { id: StorageMode; title: string; body: string; icon: typeof Cloud }[] = [
    {
      id: "debrid",
      title: "Debrid only",
      body: "Virtual library. Almost no disk. Titles appear as soon as the provider has them.",
      icon: Cloud,
    },
    {
      id: "local",
      title: "Local disks",
      body: "Download and keep. Best when you want a house that works without the cloud.",
      icon: HardDrive,
    },
    {
      id: "both",
      title: "Both",
      body: "Cloud for on-demand. Disk for keepers. The default for most houses.",
      icon: Layers,
    },
  ];

  return (
    <div>
      <Heading
        title="Where should media live?"
        sub="The OS disk stays untouched. Extra disks can mount into /srv/media. Formatting a blank data disk needs an explicit confirm."
      />
      <div className="grid gap-3">
        {options.map((o) => (
          <Card key={o.id} selected={mode === o.id} onClick={() => patch({ storageMode: o.id })}>
            <div className="flex gap-4 pr-8">
              <o.icon className={cn("mt-0.5 size-5", mode === o.id ? "text-circuit" : "text-muted")} />
              <div>
                <p className="font-display text-lg font-medium">{o.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{o.body}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {mode !== "debrid" ? (
        <div className="mt-8">
          <p className="mb-3 text-sm font-medium text-muted">Disks for /srv/media</p>
          <div className="grid gap-2">
            {disks.length === 0 ? (
              <p className="text-sm text-muted">No extra disks. That is fine.</p>
            ) : (
              disks.map((d) => {
              const on = selected.includes(d.name);
              return (
                <div
                  key={d.name}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)]",
                    d.os && "opacity-60",
                  )}
                >
                  <div>
                    <p className="font-mono text-sm">/dev/{d.name}</p>
                    <p className="text-xs text-muted">
                      {d.size} {d.model} {d.os ? "· OS" : ""}
                    </p>
                  </div>
                  {d.os ? (
                    <span className="text-xs text-faint">Not selectable</span>
                  ) : (
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-muted">
                        <input
                          type="checkbox"
                          className="size-4 accent-circuit"
                          checked={format.includes(d.name)}
                          onChange={() => {
                            const next = format.includes(d.name)
                              ? format.filter((x) => x !== d.name)
                              : [...format, d.name];
                            patch({ formatDisks: next });
                          }}
                        />
                        Format
                      </label>
                      <Button
                        size="sm"
                        variant={on ? "circuit" : "ghost"}
                        onClick={() => {
                          const next = on ? selected.filter((x) => x !== d.name) : [...selected, d.name];
                          patch({ selectedDisks: next });
                        }}
                      >
                        {on ? "Mounted" : "Use"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
            )}
          </div>
          {format.length > 0 ? (
            <p className="mt-3 flex items-start gap-2 text-sm text-muted">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              Formatting erases {format.join(", ")}. The OS disk is never touched here.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StepSource({
  sourceOk,
  setSourceOk,
}: {
  sourceOk: boolean;
  setSourceOk: (v: boolean) => void;
}) {
  const answers = useReelStore((s) => s.answers);
  const patch = useReelStore((s) => s.patchAnswers);
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState("");
  const untested = sourceValidateError(answers.source);

  const ping = async () => {
    setChecking(true);
    setSourceOk(false);
    setErr("");
    const key = answers.apiKey.trim();
    try {
      const r = await fetch("/api/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: answers.source, key }),
      });
      const result = (await r.json()) as { ok?: boolean; message?: string; error?: string };
      if (result.ok) {
        setSourceOk(true);
        setErr(result.message || "Key accepted");
      } else {
        setSourceOk(false);
        setErr(result.error || "Provider rejected this key.");
      }
    } catch (e) {
      setSourceOk(false);
      setErr(String(e));
    }
    setChecking(false);
  };

  return (
    <div>
      <Heading
        title="Your source"
        sub="TorBox is the working path on this house. Paste a TorBox key and Validate it before Continue. Other providers stay visible but untested — Validate refuses; there is no fake OK."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {SOURCES.map((s) => {
          const blocked = sourceValidateError(s.id);
          return (
            <Card
              key={s.id}
              selected={answers.source === s.id}
              onClick={() => {
                patch({ source: s.id });
                setSourceOk(false);
                setErr("");
              }}
            >
              <div className="flex items-start gap-3 pr-6">
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-lg font-display text-xs tracking-wide",
                    answers.source === s.id ? "bg-circuit text-background" : "bg-card-2 text-muted",
                  )}
                >
                  {s.mark}
                </span>
                <div>
                  <p className="font-display font-medium">
                    {s.name}
                    {blocked ? (
                      <span className="ml-2 align-middle font-sans text-[11px] font-medium tracking-normal text-muted">
                        Untested
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm text-muted">{s.blurb}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {untested ? (
        <div className="mt-6">
          <p className="text-sm text-muted">{untested}</p>
          {answers.source !== "local-vpn" ? (
            <Button className="mt-3" variant="ghost" onClick={() => void ping()} disabled={checking}>
              {checking ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Validate
            </Button>
          ) : null}
          {!sourceOk && err ? <p className="mt-2 text-sm text-danger">{err}</p> : null}
        </div>
      ) : (
        <div className="mt-6">
          <label className="text-sm text-muted">API key</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              type="password"
              autoComplete="off"
              placeholder="Paste TorBox key"
              value={answers.apiKey}
              onChange={(e) => {
                patch({ apiKey: e.target.value });
                setSourceOk(false);
                setErr("");
              }}
              className="h-12 flex-1 rounded-xl bg-card px-4 text-sm shadow-[var(--shadow-border)] placeholder:text-faint"
            />
            <Button variant="ghost" onClick={() => void ping()} disabled={checking}>
              {checking ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {checking ? "Checking" : "Validate"}
            </Button>
          </div>
          {sourceOk ? <p className="mt-2 text-sm text-success">{err}</p> : null}
          {!sourceOk && err ? <p className="mt-2 text-sm text-danger">{err}</p> : null}
        </div>
      )}
    </div>
  );
}

function StepIntent() {
  const intent = useReelStore((s) => s.answers.intent);
  const patchIntent = useReelStore((s) => s.patchIntent);
  const chips: { key: keyof typeof intent; label: string }[] = [
    { key: "movies", label: "Movies" },
    { key: "tv", label: "TV Shows" },
    { key: "anime", label: "Anime" },
    { key: "uhd", label: "4K" },
    { key: "kids", label: "Kids" },
    { key: "music", label: "Music" },
    { key: "books", label: "Books" },
  ];
  return (
    <div>
      <Heading
        title="What are you collecting?"
        sub="We only install engines you need. Movies and TV are on by default. Music and Books never appear unless you ask."
      />
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => {
          const on = intent[c.key];
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => patchIntent({ [c.key]: !on })}
              className={cn(
                "h-9 rounded-full px-4 text-sm font-medium transition-colors duration-150",
                on ? "bg-circuit/15 text-circuit shadow-[var(--shadow-circuit)]" : "bg-card text-muted shadow-[var(--shadow-border)]",
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepQuality() {
  const quality = useReelStore((s) => s.answers.quality);
  const patch = useReelStore((s) => s.patchAnswers);
  const anime = useReelStore((s) => s.answers.intent.anime);
  const opts: { id: QualityFloor; title: string; body: string }[] = [
    { id: "1080p", title: "1080p", body: "A sane floor. Saves disk and transcode." },
    {
      id: "hybrid",
      title: "1080p / 4K when available",
      body: "Keep 1080p. Prefer 4K when the release is clean. Default.",
    },
    { id: "4k", title: "4K only", body: "Rejects anything below. Some titles will fail." },
    { id: "custom", title: "Custom", body: "Unlocks Advanced later. You do not need this today." },
  ];
  return (
    <div>
      <Heading
        title="Quality floor"
        sub="Not a lecture. One choice. Anime, if selected, gets its own profile automatically."
      />
      <div className="grid gap-3">
        {opts.map((o) => (
          <Card key={o.id} selected={quality === o.id} onClick={() => patch({ quality: o.id })}>
            <p className="font-display text-lg font-medium pr-8">{o.title}</p>
            <p className="mt-1 text-sm text-muted">{o.body}</p>
          </Card>
        ))}
      </div>
      {anime ? (
        <p className="mt-5 text-sm text-live">Anime profile will be applied on the TV engine.</p>
      ) : null}
    </div>
  );
}

function StepFrontend() {
  const answers = useReelStore((s) => s.answers);
  const patch = useReelStore((s) => s.patchAnswers);
  const opts: { id: Frontend; title: string; body: string }[] = [
    { id: "jellyfin", title: "Jellyfin", body: "Open source. Default. No claim token." },
    { id: "plex", title: "Plex", body: "Bring a claim token from plex.tv/claim." },
    { id: "both", title: "Both", body: "Same libraries. Choose a player when you hit Play." },
  ];
  const plexUntested = frontendHonestyError(answers.frontend);
  return (
    <div>
      <Heading
        title="Where will you watch?"
        sub="ReelOS is not a player. Jellyfin is the working path. Plex claim is untested on this house — Continue refuses it."
      />
      <div className="grid gap-3">
        {opts.map((o) => {
          const blocked = frontendHonestyError(o.id);
          return (
            <Card key={o.id} selected={answers.frontend === o.id} onClick={() => patch({ frontend: o.id })}>
              <p className="font-display text-lg font-medium pr-8">
                {o.title}
                {blocked ? (
                  <span className="ml-2 align-middle font-sans text-[11px] font-medium tracking-normal text-muted">
                    Untested
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-sm text-muted">{o.body}</p>
            </Card>
          );
        })}
      </div>
      {plexUntested ? <p className="mt-6 text-sm text-muted">{plexUntested}</p> : null}
    </div>
  );
}

function StepAdmin() {
  const answers = useReelStore((s) => s.answers);
  const patch = useReelStore((s) => s.patchAnswers);
  return (
    <div>
      <Heading
        title="Who is this for?"
        sub="Create the household admin. One password for the ReelOS shell. Engines inherit it. You will not invent twelve service passwords."
      />
      <div className="grid gap-4">
        <label className="block">
          <span className="text-sm text-muted">Display name</span>
          <input
            className="mt-2 h-12 w-full rounded-xl bg-card px-4 shadow-[var(--shadow-border)] placeholder:text-faint"
            placeholder="Ada"
            value={answers.adminName}
            onChange={(e) => patch({ adminName: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="text-sm text-muted">Password</span>
          <input
            type="password"
            className="mt-2 h-12 w-full rounded-xl bg-card px-4 shadow-[var(--shadow-border)] placeholder:text-faint"
            placeholder="At least 8 characters"
            value={answers.adminPassword}
            onChange={(e) => patch({ adminPassword: e.target.value })}
          />
        </label>
        <p className="text-sm text-faint">Household members can be invited later in Settings.</p>
      </div>
    </div>
  );
}

function StepAccess() {
  const answers = useReelStore((s) => s.answers);
  const patch = useReelStore((s) => s.patchAnswers);
  const opts: { id: AccessMode; title: string; body: string }[] = [
    {
      id: "lan",
      title: "This network only",
      body: "reelos.local and the LAN IP. The usual first week.",
    },
    {
      id: "tailscale",
      title: "Tailscale",
      body: "We install tailscaled and show an auth URL on Finish.",
    },
    {
      id: "cloudflare",
      title: "Cloudflare Tunnel",
      body: "Paste a tunnel token. No inbound ports.",
    },
  ];
  const cfUntested = accessHonestyError(answers.access);
  return (
    <div>
      <Heading
        title="How will you reach it?"
        sub="One front door. This network and Tailscale are the working paths. Cloudflare Tunnel is untested — Continue refuses it."
      />
      <div className="grid gap-3">
        {opts.map((o) => {
          const blocked = accessHonestyError(o.id);
          return (
            <Card key={o.id} selected={answers.access === o.id} onClick={() => patch({ access: o.id })}>
              <p className="font-display text-lg font-medium pr-8">
                {o.title}
                {blocked ? (
                  <span className="ml-2 align-middle font-sans text-[11px] font-medium tracking-normal text-muted">
                    Untested
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-sm text-muted">{o.body}</p>
            </Card>
          );
        })}
      </div>
      {cfUntested ? <p className="mt-6 text-sm text-muted">{cfUntested}</p> : null}
    </div>
  );
}
