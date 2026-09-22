import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Cast,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Download,
  ExternalLink,
  Flame,
  Globe,
  HardDrive,
  HelpCircle,
  Info,
  Layers,
  Monitor,
  Moon,
  Play,
  Shield,
  Smartphone,
  Sparkles,
  Tv,
  Usb,
  VolumeX,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ApplianceGuideView() {
  const [tab, setTab] = useState<"silicon" | "casting" | "storage" | "features">("silicon");

  return (
    <div className="min-h-dvh bg-background text-foreground p-6 md:p-12 font-sans">
      <div className="mx-auto max-w-5xl">
        {/* Navigation Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted hover:text-foreground hover:border-border-strong transition-colors"
                title="Return to ReelOS"
              >
                <ArrowLeft className="size-4" />
              </Link>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                <Sparkles className="size-6 text-gold" />
                Appliance Guide & Hardware Playbook
              </h1>
            </div>
            <p className="mt-1.5 text-sm text-muted">
              Learn how ReelOS tunes your hardware, prevents mistakes, enables zero-config casting, and runs your personal media appliance.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/dev">
              <Button
                variant="quiet"
                size="sm"
                className="text-xs h-9 gap-1.5"
              >
                <Cpu className="size-3.5 text-gold" />
                Developer Cockpit
              </Button>
            </Link>
            <Link to="/">
              <Button
                variant="gold"
                size="sm"
                className="text-xs h-9 gap-1.5 font-semibold"
              >
                <Play className="size-3.5" />
                Launch ReelOS
              </Button>
            </Link>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 border-b border-border/70 pb-4 mb-8">
          <button
            onClick={() => setTab("silicon")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer",
              tab === "silicon"
                ? "bg-gold text-gold-fg shadow-[var(--shadow-gold)]"
                : "bg-card border border-border text-muted hover:text-foreground hover:border-border-strong"
            )}
          >
            <Cpu className="size-4" />
            Hardware Tiers & Mistake Protection
          </button>
          <button
            onClick={() => setTab("casting")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer",
              tab === "casting"
                ? "bg-gold text-gold-fg shadow-[var(--shadow-gold)]"
                : "bg-card border border-border text-muted hover:text-foreground hover:border-border-strong"
            )}
          >
            <Cast className="size-4" />
            Watch Directly & Casting from PC
          </button>
          <button
            onClick={() => setTab("storage")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer",
              tab === "storage"
                ? "bg-gold text-gold-fg shadow-[var(--shadow-gold)]"
                : "bg-card border border-border text-muted hover:text-foreground hover:border-border-strong"
            )}
          >
            <Usb className="size-4" />
            Storage & Thumb Stick Mode
          </button>
          <button
            onClick={() => setTab("features")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer",
              tab === "features"
                ? "bg-gold text-gold-fg shadow-[var(--shadow-gold)]"
                : "bg-card border border-border text-muted hover:text-foreground hover:border-border-strong"
            )}
          >
            <Sparkles className="size-4" />
            Features & Curation Soul
          </button>
        </div>

        {/* Tab 1: Silicon Tiers & Mistake Protection */}
        {tab === "silicon" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* The 3 Tiers Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Potato Mode */}
              <div className="rounded-2xl border border-amber-500/30 bg-card/60 p-6 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 rounded-bl-xl bg-amber-500/15 border-b border-l border-amber-500/30 px-3 py-1 font-mono text-[10px] text-amber-300 font-bold">
                  ≤ 4.5 GB RAM
                </div>
                <div>
                  <div className="text-3xl mb-3">🥔</div>
                  <h3 className="text-lg font-bold text-foreground">Potato Mode</h3>
                  <p className="text-xs text-muted mt-1">
                    Vintage laptops, older mini PCs, low RAM devices without dedicated GPUs.
                  </p>

                  <div className="mt-5 space-y-2.5 text-xs">
                    <div className="flex items-start gap-2">
                      <Shield className="size-4 text-amber-400 shrink-0 mt-0.5" />
                      <span><strong>Mistake Protection:</strong> Hard DirectPlay Lock. Software CPU transcoding is disabled in <code>encoding.xml</code> to prevent thermal lockups.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <VolumeX className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Power behavior:</strong> ReelOS reduces background work and may let supported drives sleep when they are not in use.</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-border">
                  <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block mb-1">
                    Recommended Apps:
                  </span>
                  <p className="text-xs text-muted leading-relaxed">
                    Use the ReelOS player or a compatible client such as <strong>Swiftfin</strong> or <strong>Findroid</strong>. Format support is checked per device and title.
                  </p>
                </div>
              </div>

              {/* Whisper Workhorse */}
              <div className="rounded-2xl border-2 border-gold bg-gold/5 p-6 flex flex-col justify-between relative overflow-hidden shadow-lg shadow-gold/10">
                <div className="absolute top-0 right-0 rounded-bl-xl bg-gold text-gold-fg px-3 py-1 font-mono text-[10px] font-bold">
                  THE GOLDILOCKS TIER
                </div>
                <div>
                  <div className="text-3xl mb-3">⚡</div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-1.5">
                    Whisper Workhorse
                  </h3>
                  <p className="text-xs text-muted mt-1">
                    Intel N100 / N200 / Alder Lake-N mini PCs with 8–16 GB RAM and 12th-Gen QuickSync (QSV).
                  </p>

                  <div className="mt-5 space-y-2.5 text-xs">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="size-4 text-gold shrink-0 mt-0.5" />
                      <span><strong>Additional option:</strong> Supported Intel video hardware may create compatible renditions after the machine check passes.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Zap className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Trade-off:</strong> Compact systems can use less power, but noise, heat, and playback capacity depend on the actual hardware.</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gold/20">
                  <span className="text-[11px] font-semibold text-gold uppercase tracking-wider block mb-1">
                    The Sweet Spot:
                  </span>
                  <p className="text-xs text-muted leading-relaxed">
                    A practical target for one household after codec, thermal, and sustained-playback checks pass.
                  </p>
                </div>
              </div>

              {/* Beast Mode */}
              <div className="rounded-2xl border border-sky-500/30 bg-card/60 p-6 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 rounded-bl-xl bg-sky-500/15 border-b border-l border-sky-500/30 px-3 py-1 font-mono text-[10px] text-sky-300 font-bold">
                  Dedicated GPU
                </div>
                <div>
                  <div className="text-3xl mb-3">🐉</div>
                  <h3 className="text-lg font-bold text-foreground">Beast Mode</h3>
                  <p className="text-xs text-muted mt-1">
                    Dedicated NVIDIA NVENC / AMD GPUs, 32GB+ RAM desktops and rack servers.
                  </p>

                  <div className="mt-5 space-y-2.5 text-xs">
                    <div className="flex items-start gap-2">
                      <Flame className="size-4 text-sky-400 shrink-0 mt-0.5" />
                      <span><strong>Additional headroom:</strong> May support more simultaneous streams and video conversion after sustained testing.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Info className="size-4 text-muted shrink-0 mt-0.5" />
                      <span><strong>Trade-off:</strong> Draws 150W–350W under load, requires cooling fans and dedicated power.</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-border">
                  <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider block mb-1">
                    Powerhouse Features:
                  </span>
                  <p className="text-xs text-muted leading-relaxed">
                    Higher-capacity hardware still follows measured concurrency and temperature limits.
                  </p>
                </div>
              </div>
            </div>

            {/* Invariant & Mistake Protection Deep Dive */}
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Shield className="size-5 text-gold" />
                How ReelOS Protects You From Costly Mistakes
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                Live video conversion can overwhelm low-power hardware when a browser cannot play the original format. ReelOS limits that work and prefers compatible originals or prepared renditions so playback does not consume all available machine capacity.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="rounded-xl border border-border/60 bg-background/50 p-4 text-xs">
                  <span className="font-semibold text-foreground block mb-1">1. Automatic Silicon Probing</span>
                  <p className="text-muted">
                    At boot, ReelOS inspects RAM size and <code>/dev/dri</code> render devices. If RAM is ≤ 4.5 GB and no GPU exists, <strong>Potato Mode</strong> activates automatically.
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/50 p-4 text-xs">
                  <span className="font-semibold text-foreground block mb-1">2. Hardware-Enforced Config</span>
                  <p className="text-muted">
                    ReelOS can disable CPU video re-encoding on constrained hardware. Playback still depends on the title, rendition, network, and client capabilities.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Watch Directly & Casting */}
        {tab === "casting" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Cast className="size-5 text-gold" />
                Can Casting Happen from a Computer?
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                <strong>Yes, absolutely!</strong> Casting from a computer (laptop or desktop) to a television or smart speaker is supported across multiple protocols without requiring cables:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="rounded-xl border border-border/60 bg-background/50 p-4 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <Monitor className="size-4 text-gold" />
                    Google Cast / Chromecast
                  </div>
                  <p className="text-muted leading-relaxed">
                    In <strong>Google Chrome</strong>, <strong>Brave</strong>, or <strong>Microsoft Edge</strong> on Windows/Mac/Linux, click the <strong>Cast icon</strong> in the video player or click the 3-dot menu → <em>Cast...</em> to beam the stream directly to any Chromecast, Google TV, or Android TV.
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/50 p-4 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <Tv className="size-4 text-sky-400" />
                    Apple AirPlay
                  </div>
                  <p className="text-muted leading-relaxed">
                    In <strong>Safari on macOS</strong> or from any iPhone/iPad, click the <strong>AirPlay icon</strong> in the player control bar to instantly send high-fidelity audio and video to an Apple TV or AirPlay 2 compatible television.
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/50 p-4 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <Globe className="size-4 text-emerald-400" />
                    Universal TV Remote
                  </div>
                  <p className="text-muted leading-relaxed">
                    ReelOS features a built-in <strong>Virtual Remote</strong> (click &quot;Remote&quot; in top bar). It scans your local subnet for DLNA / smart TV targets and lets you control volume, seek, and pause right from your computer screen.
                  </p>
                </div>
              </div>
            </div>

            {/* Direct Watch Links */}
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Play className="size-5 text-gold" />
                Direct Playback Links
              </h3>
              <p className="text-xs text-muted">
                If you are running ReelOS in VM Mode or on your host machine, you can launch playback instantly:
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  to="/tv"
                  className="inline-flex items-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-4 py-2 text-xs font-semibold text-gold hover:bg-gold/20 transition-all"
                >
                  <Tv className="size-3.5 text-gold" />
                  Launch 10-Foot Couch Mode (/tv)
                </Link>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-card-2 transition-all"
                >
                  <Play className="size-3.5 text-gold" />
                  Return to Home Cinema
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Storage & Thumb Stick Mode */}
        {tab === "storage" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Usb className="size-5 text-gold" />
                Plain English Storage Strategies
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                ReelOS eliminates storage jargon. Choose how your files live on disk:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
                <div className="rounded-xl border border-border/60 bg-background/50 p-5 space-y-3">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                    <Zap className="size-4 text-gold" />
                    Zero-Duplication Symlinks
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Adds an available provider copy to the library without creating a second full local copy. Small metadata and temporary workspace use may still apply.
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/50 p-5 space-y-3">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                    <Download className="size-4 text-sky-400" />
                    Full Local Download
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Copies the selected media to local storage or a home NAS. Offline playback is available after ReelOS verifies that the copy is complete and compatible.
                  </p>
                </div>

                <div className="rounded-xl border border-gold/40 bg-gold/5 p-5 space-y-3">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                    <Usb className="size-4 text-gold" />
                    Portable Thumb Stick Mode
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Plug in any USB drive. ReelOS creates a portable media vault. Bring the thumb stick to a friend&apos;s house, plug it in, and stream without touching their computer!
                  </p>
                </div>
              </div>
            </div>

            {/* Hotplug Auto-Detection */}
            <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <HardDrive className="size-5 text-gold" />
                Hot-Plug USB Detection
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                Whenever you plug a new USB drive into your machine, ReelOS proactively detects the device and asks if you want to expand your storage pool or create an autoinstall flash drive. No Linux command line needed.
              </p>
            </div>
          </div>
        )}

        {/* Tab 4: Features & Curation */}
        {tab === "features" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="size-5 text-gold" />
                  Dynamic Mood Shelves
                </h3>
                <p className="text-xs text-muted leading-relaxed">
                  Curation is the soul of ReelOS. Discover automatically populates personalized shelves:
                </p>
                <ul className="text-xs text-muted space-y-2 pt-1 list-disc pl-5">
                  <li><strong>30-Minute Dinner Watches:</strong> Quick comedies, animated shorts, and bite-sized docuseries.</li>
                  <li><strong>Mind-Bending Night Shifts:</strong> Psychological thrillers, cerebral sci-fi, and unpredictable twists.</li>
                  <li><strong>From Page to Screen:</strong> Books in your library adapted into movies and TV series with 1-click reading.</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Shield className="size-5 text-emerald-400" />
                  Resident Profiles & Guest Pass
                </h3>
                <p className="text-xs text-muted leading-relaxed">
                  Every resident gets their own taste profile, watch progress, and custom theme:
                </p>
                <ul className="text-xs text-muted space-y-2 pt-1 list-disc pl-5">
                  <li><strong>Family & Partner Profiles:</strong> Independent watchlist, romantic drama & comfort priorities.</li>
                  <li><strong>Kids Sandbox:</strong> PIN-locked isolation protecting little eyes from mature content.</li>
                  <li><strong>Guest Pass:</strong> Instant mobile join with 12-hour session auto-pruning.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
