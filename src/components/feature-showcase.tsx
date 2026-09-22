import { useEffect, useState } from "react";
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Crown,
  FastForward,
  Film,
  Heart,
  Laptop,
  Lock,
  Play,
  Rewind,
  Sparkles,
  Subtitles,
  Tv,
  Users,
  Volume2,
  Zap,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QrCodeSvg } from "@/components/ui/qr-code-svg";
import { useReelStore } from "@/lib/store";

export interface FeatureSlide {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  renderMockup: () => React.ReactNode;
}

export function FeatureShowcase({
  className,
  autoPlay = true,
  intervalMs = 6000,
}: {
  className?: string;
  autoPlay?: boolean;
  intervalMs?: number;
}) {
  const [activeIdx, setActiveIdx] = useState(0);

  const slides: FeatureSlide[] = [
    {
      id: "native-apps",
      tag: "Unified Client",
      title: "The ReelOS App",
      subtitle: "Zero-config 4K DirectPlay on Fire TV, Google TV, and Android. Grab it now while the engine boots.",
      renderMockup: () => <MockupNativeApps />,
    },
    {
      id: "flickmatch",
      tag: "Party Swiping",
      title: "FlickMatch",
      subtitle: "Swipe movie cards together with your housemates. Match and watch instantly.",
      renderMockup: () => <MockupFlickMatch />,
    },
    {
      id: "couch-mode",
      tag: "10-Foot Experience",
      title: "Couch Mode",
      subtitle: "Cinematic D-pad browsing engineered specifically for large screen 4K TVs.",
      renderMockup: () => <MockupCouchMode />,
    },
    {
      id: "reading-audio",
      tag: "Digital Literature",
      title: "Reader & Audio",
      subtitle: "First-class EPUB reading and audiobook playback synced across every room.",
      renderMockup: () => <MockupReader />,
    },
    {
      id: "virtual-remote",
      tag: "Zero-Install Remote",
      title: "Virtual Remote",
      subtitle: "Turn any phone or browser into a precision playback remote with audio & subtitle toggles.",
      renderMockup: () => <MockupVirtualRemote />,
    },
    {
      id: "battery-guardian",
      tag: "24/7 Appliance",
      title: "Battery Guardian",
      subtitle: "Smart AC cutoff and clamshell wear mitigation turn any old laptop into a whisper-quiet server.",
      renderMockup: () => <MockupBatteryGuardian />,
    },
    {
      id: "multi-user",
      tag: "Private Profiles",
      title: "Resident Isolation",
      subtitle: "Independent Continue Watching queues and optional 4-digit PIN locks for everyone.",
      renderMockup: () => <MockupMultiUser />,
    },
  ];

  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % slides.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [autoPlay, intervalMs, slides.length]);

  const current = slides[activeIdx];

  return (
    <div
      className={cn(
        "relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card/60 p-6 backdrop-blur-xl shadow-2xl md:p-8",
        className,
      )}
    >
      {/* Background ambient radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 size-80 rounded-full bg-gold/15 blur-[100px] transition-all duration-700"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 -left-16 size-80 rounded-full bg-live/10 blur-[100px] transition-all duration-700"
      />

      {/* Slide Header */}
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[11px] font-semibold tracking-wider text-gold-bright uppercase">
            <Sparkles className="size-3 text-gold" />
            {current.tag}
          </span>

          {/* Carousel navigation arrows */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveIdx((prev) => (prev - 1 + slides.length) % slides.length)}
              className="flex size-8 items-center justify-center rounded-full border border-border bg-card/80 text-muted transition-colors hover:border-border-strong hover:text-foreground active:scale-95"
              aria-label="Previous feature"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setActiveIdx((prev) => (prev + 1) % slides.length)}
              className="flex size-8 items-center justify-center rounded-full border border-border bg-card/80 text-muted transition-colors hover:border-border-strong hover:text-foreground active:scale-95"
              aria-label="Next feature"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          {current.title}
        </h3>
        <p className="mt-1.5 text-xs text-muted leading-relaxed md:text-sm">
          {current.subtitle}
        </p>
      </div>

      {/* Main Mockup Stage with Smooth Fade Transition */}
      <div className="relative z-10 my-6 flex min-h-[300px] items-center justify-center">
        <div key={current.id} className="rise w-full">
          {current.renderMockup()}
        </div>
      </div>

      {/* Progress Dots */}
      <div className="relative z-10 flex items-center justify-between border-t border-border pt-4">
        <div className="flex items-center gap-2">
          {slides.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                idx === activeIdx
                  ? "w-7 bg-gold shadow-[var(--shadow-gold)]"
                  : "w-2 bg-card-2 border border-border hover:bg-muted"
              )}
              aria-label={`Go to slide ${s.title}`}
            />
          ))}
        </div>

        <span className="font-mono text-[11px] text-faint tabular-nums">
          0{activeIdx + 1} / 0{slides.length}
        </span>
      </div>
    </div>
  );
}

/* =========================================================================
   Mockup 1: FlickMatch (Authentic Card Swiping)
   ========================================================================= */
function MockupFlickMatch() {
  const residents = useReelStore((s) => s.residents) || [];
  const name1 = residents[0]?.name || "Resident 1";
  const name2 = residents[1]?.name || "Resident 2";
  const init1 = name1.charAt(0).toUpperCase();
  const init2 = name2.charAt(0).toUpperCase();

  return (
    <div className="relative mx-auto max-w-sm rounded-2xl border border-border bg-raised/90 p-4 shadow-xl backdrop-blur-md">
      {/* Resident Swipers Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            <span className="flex size-7 items-center justify-center rounded-full border-2 border-raised bg-gold text-gold-fg font-bold text-[10px]">
              {init1}
            </span>
            <span className="flex size-7 items-center justify-center rounded-full border-2 border-raised bg-live text-background font-bold text-[10px]">
              {init2}
            </span>
          </div>
          <div>
            <p className="font-display text-xs font-semibold text-foreground">{name1} & {name2}</p>
            <p className="text-[10px] text-muted">Session: Cinema Lounge</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-semibold text-danger">
          <Heart className="size-3 fill-current" /> Live Match
        </span>
      </div>

      {/* Swiped Card Stack */}
      <div className="relative mt-4 flex items-center justify-center py-2">
        {/* Background Card */}
        <div className="absolute top-0 w-60 translate-y-2 scale-95 rounded-xl border border-border bg-card p-3 opacity-40 blur-[0.5px]">
          <div className="h-28 rounded-lg bg-card-2" />
        </div>

        {/* Foreground Match Card */}
        <div className="relative z-10 w-64 rounded-xl border border-gold/50 bg-card p-3 shadow-2xl">
          <div className="relative h-36 overflow-hidden rounded-lg bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-3">
            <div className="absolute inset-0 bg-cover bg-center opacity-60 mix-blend-overlay" />
            <span className="w-fit rounded-md bg-gold px-1.5 py-0.5 font-display text-[9px] font-bold text-gold-fg uppercase">
              98% Match
            </span>
            <h4 className="mt-1 font-display text-sm font-bold text-white">Oppenheimer</h4>
            <p className="text-[10px] text-zinc-300">2023 · 3h 0min · 4K HDR Cinema Master</p>
          </div>

          {/* Match Banner */}
          <div className="mt-3 flex items-center justify-between rounded-lg border border-gold/30 bg-gold/15 px-2.5 py-1.5">
            <div className="flex items-center gap-1.5 text-gold font-semibold text-xs">
              <Sparkles className="size-3.5" />
              <span>Matched! Both swiped right</span>
            </div>
            <span className="text-[10px] text-foreground font-mono">100%</span>
          </div>

          {/* Action Trigger */}
          <button
            type="button"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-gold py-2 font-display text-xs font-semibold text-gold-fg shadow-[var(--shadow-gold)]"
          >
            <Tv className="size-3.5" />
            Cast to Living Room TV
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   Mockup 2: 10-Foot Couch Mode (Big Screen TV Interface)
   ========================================================================= */
function MockupCouchMode() {
  return (
    <div className="relative mx-auto max-w-md rounded-2xl border-2 border-border-strong bg-black p-4 shadow-2xl">
      {/* TV Screen Top Bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5 text-white/80">
        <div className="flex items-center gap-2">
          <Tv className="size-4 text-gold" />
          <span className="font-display text-xs font-bold tracking-wider uppercase text-gold">
            Couch Mode 10-Foot
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-zinc-300">D-PAD ON</span>
          <span className="text-zinc-400">Host</span>
        </div>
      </div>

      {/* Grid of Posters with Active Glowing Focus Ring */}
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        <div className="relative rounded-xl border border-white/10 bg-zinc-900 p-2 opacity-60">
          <div className="h-24 rounded bg-zinc-800" />
          <p className="mt-1.5 truncate text-[11px] font-medium text-zinc-300">Dune: Part Two</p>
        </div>

        {/* Selected / Focused Item with Glowing Accent */}
        <div className="relative scale-105 rounded-xl border-2 border-gold bg-zinc-900 p-2 shadow-[var(--shadow-gold)] transition-transform">
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-gold text-gold-fg text-[9px] font-bold">
            ✓
          </span>
          <div className="h-24 rounded bg-gradient-to-br from-gold/30 to-zinc-800 flex items-center justify-center">
            <Play className="size-6 text-gold fill-current" />
          </div>
          <p className="mt-1.5 truncate font-display text-xs font-bold text-white">Interstellar</p>
          <div className="mt-1 flex items-center gap-1">
            <span className="rounded bg-gold/20 px-1 text-[8px] font-bold text-gold">4K MASTER</span>
            <span className="rounded bg-white/10 px-1 text-[8px] text-zinc-300">ATMOS</span>
          </div>
        </div>

        <div className="relative rounded-xl border border-white/10 bg-zinc-900 p-2 opacity-60">
          <div className="h-24 rounded bg-zinc-800" />
          <p className="mt-1.5 truncate text-[11px] font-medium text-zinc-300">Succession</p>
        </div>
      </div>

      {/* TV Bottom Stream Stats */}
      <div className="mt-3 flex items-center justify-between rounded-lg bg-zinc-900/80 px-3 py-1.5 text-[10px] text-zinc-400">
        <div className="flex items-center gap-1.5 text-success">
          <CheckCircle2 className="size-3" />
          <span>DirectStream 68 Mbps · Zero Transcode Lag</span>
        </div>
        <span className="font-mono text-zinc-500">Living Room TV</span>
      </div>
    </div>
  );
}

/* =========================================================================
   Mockup 3: Reader & Audiobooks
   ========================================================================= */
function MockupReader() {
  return (
    <div className="relative mx-auto max-w-sm rounded-2xl border border-border bg-raised/90 p-4 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-gold" />
          <span className="font-display text-xs font-semibold text-foreground">
            Digital Literature & Audio
          </span>
        </div>
        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold">
          1.25x Speed
        </span>
      </div>

      <div className="mt-4 flex gap-4">
        {/* Book Cover */}
        <div className="h-28 w-20 shrink-0 rounded-lg border border-border bg-card-2 p-2 shadow flex flex-col justify-between">
          <span className="text-[8px] font-mono text-gold uppercase">Sci-Fi Epic</span>
          <p className="font-display text-[11px] font-bold text-foreground leading-tight">
            Project Hail Mary
          </p>
          <p className="text-[9px] text-muted">Andy Weir</p>
        </div>

        {/* Audio / Reading Progress */}
        <div className="flex flex-1 flex-col justify-between py-1">
          <div>
            <span className="rounded bg-gold/10 px-1.5 py-0.5 text-[9px] font-medium text-gold-bright">
              Chapter 14 · The Asteroid
            </span>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              &quot;Humanity was never alone in this sector of deep space...&quot;
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="h-1.5 w-full rounded-full bg-card-2 overflow-hidden">
              <div className="h-full w-[64%] bg-gold rounded-full" />
            </div>
            <div className="flex items-center justify-between text-[10px] text-faint font-mono">
              <span>04:12:30</span>
              <span>64% Done</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-card p-2 text-xs">
        <span className="text-muted text-[11px]">Synced across Phone & Couch Mode</span>
        <span className="font-semibold text-success flex items-center gap-1 text-[11px]">
          <Check className="size-3" /> Offline Ready
        </span>
      </div>
    </div>
  );
}

/* =========================================================================
   Mockup 4: Virtual Phone Remote
   ========================================================================= */
function MockupVirtualRemote() {
  return (
    <div className="relative mx-auto max-w-xs rounded-3xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-2xl">
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-lg bg-gold/15 text-gold">
            <Tv className="size-3.5" />
          </span>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">Living Room</p>
            <p className="font-display text-xs font-bold text-foreground">Couch Remote</p>
          </div>
        </div>
        <span className="flex size-2 rounded-full bg-success animate-pulse" />
      </div>

      <div className="mt-3 text-center">
        <p className="font-display text-sm font-bold text-foreground">The Dark Knight</p>
        <p className="text-[11px] text-muted">4K Ultra HD · Christopher Nolan</p>
      </div>

      {/* Scrub Bar */}
      <div className="mt-3 space-y-1">
        <div className="h-1.5 w-full rounded-full bg-raised overflow-hidden">
          <div className="h-full w-[45%] bg-gold rounded-full" />
        </div>
        <div className="flex justify-between font-mono text-[9px] text-muted">
          <span>1:12:44</span>
          <span>-1:29:16</span>
        </div>
      </div>

      {/* Large Tactile Media Controls */}
      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          type="button"
          className="flex size-10 items-center justify-center rounded-2xl border border-border bg-raised text-foreground shadow-sm"
        >
          <Rewind className="size-4" />
        </button>
        <button
          type="button"
          className="flex size-12 items-center justify-center rounded-3xl border border-gold bg-gold text-gold-fg shadow-[var(--shadow-gold)]"
        >
          <Play className="size-5 fill-current ml-0.5" />
        </button>
        <button
          type="button"
          className="flex size-10 items-center justify-center rounded-2xl border border-border bg-raised text-foreground shadow-sm"
        >
          <FastForward className="size-4" />
        </button>
      </div>

      {/* Subtitles & Volume Bar */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-2.5 text-xs text-muted">
        <div className="flex items-center gap-1.5 rounded-lg border border-gold/30 bg-gold/15 px-2 py-1 text-gold font-medium text-[10px]">
          <Subtitles className="size-3" />
          <span>Subs ON (English)</span>
        </div>
        <div className="flex items-center gap-1 text-[11px]">
          <Volume2 className="size-3.5 text-muted" />
          <span className="font-mono text-foreground font-semibold">78%</span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   Mockup 5: Battery Guardian & Thermal Shield
   ========================================================================= */
function MockupBatteryGuardian() {
  return (
    <div className="relative mx-auto max-w-sm rounded-2xl border border-border bg-raised/90 p-4 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Laptop className="size-4 text-gold" />
          <span className="font-display text-xs font-semibold text-foreground">
            24/7 Clamshell Appliance
          </span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
          <Zap className="size-3" /> AC Protected
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-border bg-card p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-muted">CPU Temp</p>
          <p className="mt-1 font-mono text-sm font-bold text-foreground">41.8°C</p>
          <p className="text-[9px] text-success font-medium">Whisper Cool</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-muted">AC Charge</p>
          <p className="mt-1 font-mono text-sm font-bold text-gold">80% Max</p>
          <p className="text-[9px] text-muted">Wear Cutoff</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-muted">Fan Speed</p>
          <p className="mt-1 font-mono text-sm font-bold text-foreground">1150 RPM</p>
          <p className="text-[9px] text-muted">Silent Curve</p>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-border bg-card p-3 space-y-1.5 text-xs">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted">Lid Switch Inhibit:</span>
          <span className="font-semibold text-success">Running 24/7 with lid closed</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted">RAM Flash Journal:</span>
          <span className="font-semibold text-foreground">SSD Wear Protection Active</span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   Mockup 6: Multi-User Resident Profiles & Privacy PINs
   ========================================================================= */
function MockupMultiUser() {
  const residents = useReelStore((s) => s.residents) || [];
  const name1 = residents[0]?.name || "Resident 1";
  const name2 = residents[1]?.name || "Resident 2";

  return (
    <div className="relative mx-auto max-w-sm rounded-2xl border border-border bg-raised/90 p-4 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-gold" />
          <span className="font-display text-xs font-semibold text-foreground">
            Isolated Household Profiles
          </span>
        </div>
        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold">
          2 Profiles Live
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {/* Profile 1: Primary (Admin) */}
        <div className="flex items-center justify-between rounded-xl border border-gold/40 bg-gold/10 p-2.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-gold text-gold-fg font-bold text-xs">
              <Clapperboard className="size-4" />
            </span>
            <div>
              <p className="font-display text-xs font-bold text-foreground flex items-center gap-1.5">
                {name1}
                <Crown className="size-3 text-gold" />
              </p>
              <p className="text-[10px] text-muted">Continue: Succession S04E03 (42m left)</p>
            </div>
          </div>
          <span className="rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-mono text-gold font-semibold">
            ACTIVE
          </span>
        </div>

        {/* Profile 2: Resident 2 (Protected with PIN) */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-2.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-card-2 text-muted font-bold text-xs border border-border">
              <Film className="size-4" />
            </span>
            <div>
              <p className="font-display text-xs font-medium text-foreground flex items-center gap-1.5">
                {name2}
                <Lock className="size-3 text-muted" />
              </p>
              <p className="text-[10px] text-muted">Private Watch History · PIN Protected</p>
            </div>
          </div>
          <span className="rounded border border-border bg-card-2 px-1.5 py-0.5 text-[10px] font-mono text-muted">
            ••••
          </span>
        </div>
      </div>

      <p className="mt-3 text-center text-[10px] text-faint">
        Each resident has private progress and a personalized Continue Watching row in ReelOS.
      </p>
    </div>
  );
}

function MockupNativeApps() {
  const ipv4 = useReelStore((s) => s.ipv4);
  const hostname = typeof window !== "undefined" ? window.location.hostname : "reelos.local";
  const port = typeof window !== "undefined" && window.location.port ? `:${window.location.port}` : ":8080";
  const effectiveHost = (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local")) && ipv4 ? ipv4 : hostname;
  const tvUrl = `http://${effectiveHost}${port}/tv`;
  const apkUrl = `http://${effectiveHost}${port}/downloads/reelos-app.apk`;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/80 p-5 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-gold/15 text-gold">
            <Tv className="size-4" />
          </span>
          <div>
            <p className="font-display text-xs font-bold text-foreground">Fire TV & Android TV Downloader</p>
            <p className="text-[10px] text-muted">Type this URL in the Downloader app</p>
          </div>
        </div>
        <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-gold">
          4K DirectPlay · 0% Host CPU
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1 space-y-2.5 w-full">
          <div className="rounded-xl bg-raised border border-border p-3 space-y-1">
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider">Downloader URL / Shortlink</span>
            <p className="font-mono text-xs font-bold text-gold break-all">{tvUrl}</p>
          </div>
          <div className="text-[11px] text-muted space-y-1">
            <p className="flex items-center gap-1.5">
              <Check className="size-3 text-success" />
              <span>Zero-touch LAN broadcast discovery</span>
            </p>
            <p className="flex items-center gap-1.5">
              <Check className="size-3 text-success" />
              <span>Hardware SurfaceView 10-bit HDR10 & Dolby Vision</span>
            </p>
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-center space-y-1.5">
          <div className="rounded-xl bg-white p-2.5 shadow-md border border-border/50">
            <QrCodeSvg value={apkUrl} size={110} />
          </div>
          <span className="text-[9px] font-mono text-muted uppercase tracking-wider">
            Scan for Android APK
          </span>
        </div>
      </div>
    </div>
  );
}
