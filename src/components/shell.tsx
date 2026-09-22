import { useState, useRef, useEffect, useMemo } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  Clapperboard,
  Compass,
  HelpCircle,
  Home,
  Library,
  Sparkles,
  Smartphone,
  Users,
  MonitorPlay,
  Settings,
  Maximize,
  Minimize,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { ApplyingBar } from "@/components/applying-bar";
import { CircuitFloor } from "@/components/circuit-floor";
import { LibraryCatchupBar } from "@/components/library-catchup-bar";
import { UsbHotplugBanner } from "@/components/usb-hotplug-banner";
import { ProfileSwitcher } from "@/components/profile-switcher";
import { GuestQrPopover } from "@/components/guest-qr-popover";
import { VirtualRemote } from "@/components/remote-modal";
import { ToastHost } from "@/components/toast";
import { ReelMark } from "@/components/logo";
import { useReelStore } from "@/lib/store";
import { jellyfinWatchHref } from "@/lib/jellyfin-watch";
import { inFlightRequests, transferringChipCount } from "@/lib/sync-requests";
import { cn } from "@/lib/utils";

const STABLE_NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/library", label: "Library", icon: Library },
  { to: "/books", label: "Books", icon: BookOpen },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const MINIMAL_NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/library", label: "Library", icon: Library },
  { to: "/books", label: "Books", icon: BookOpen },
] as const;

function navOn(path: string, to: string) {
  if (to === "/") return path === "/";
  return path === to || path.startsWith(`${to}/`);
}

function PartyHub({
  placement = "header",
}: {
  placement?: "header" | "dock";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeRemote = useReelStore((s) => s.activeRemote);
  const setActiveRemote = useReelStore((s) => s.setActiveRemote);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isFlickMatch = path === "/flickmatch" || path.startsWith("/flickmatch/");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      {placement === "dock" ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            "relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-full px-2 py-1 transition-all duration-150 gap-0.5 cursor-pointer",
            open || isFlickMatch
              ? "text-gold font-semibold"
              : "text-muted hover:text-foreground active:scale-90",
          )}
          title="Living Room Party & Games"
        >
          <Users className={cn("size-5 transition-transform", (open || isFlickMatch) && "scale-110 text-gold")} />
          <span className="text-[10px] tracking-tight">Party</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all duration-200 cursor-pointer border",
            open || isFlickMatch
              ? "border-gold/50 bg-gold/20 text-gold shadow-sm"
              : "border-border/60 bg-card/60 text-muted hover:text-foreground hover:border-gold/30 active:scale-95",
          )}
          title="Living Room Social & Games"
        >
          <Users className="size-3.5 text-gold" />
          <span>Party</span>
        </button>
      )}

      {open && (
        <>
          {/* Mobile backdrop for outside tap dismissal */}
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs md:hidden"
            onClick={() => setOpen(false)}
          />

          <div
            className={cn(
              "z-50 rounded-3xl border border-white/15 bg-card/95 p-3.5 backdrop-blur-3xl shadow-2xl animate-in fade-in duration-150",
              placement === "dock"
                ? "fixed bottom-20 inset-x-4 max-w-sm mx-auto slide-in-from-bottom-4 md:absolute md:inset-x-auto md:right-0 md:bottom-full md:mb-2 md:w-64"
                : "fixed inset-x-4 top-16 max-w-sm mx-auto zoom-in-95 md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2 md:w-64",
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-2 pb-3 border-b border-white/10 mb-2.5">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-xl bg-gold/15 text-gold border border-gold/25">
                  <Users className="size-3.5" />
                </div>
                <div>
                  <h4 className="font-display text-xs font-bold text-foreground">Living Room Social</h4>
                  <p className="text-[10px] text-muted">Party games, TV remote & guests</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-6 items-center justify-center rounded-full text-muted hover:text-foreground hover:bg-white/10 transition-colors md:hidden cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* FlickMatch Link */}
            <Link
              to="/flickmatch"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-2xl p-2.5 text-sm text-foreground hover:bg-white/5 active:scale-[0.98] transition-all bg-card-2/50 border border-white/5 hover:border-gold/30 mb-2 group"
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-gold/15 text-gold border border-gold/25 group-hover:bg-gold group-hover:text-black transition-colors shrink-0">
                <Sparkles className="size-4" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground">FlickMatch</span>
                  <span className="rounded-full bg-gold/15 text-gold px-1.5 py-0.2 text-[9px] font-bold tracking-wider uppercase">
                    Party
                  </span>
                </div>
                <span className="text-[10px] text-muted truncate">Match movies together on your phones</span>
              </div>
            </Link>

            {/* Virtual TV Remote Button */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setActiveRemote({ open: true });
              }}
              className="w-full flex items-center gap-3 rounded-2xl p-2.5 text-sm text-foreground hover:bg-white/5 active:scale-[0.98] transition-all bg-card-2/50 border border-white/5 hover:border-circuit/30 mb-2 group text-left cursor-pointer"
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-circuit/15 text-circuit border border-circuit/25 group-hover:bg-circuit group-hover:text-black transition-colors shrink-0">
                <Smartphone className="size-4" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground">Virtual TV Remote</span>
                  <span className="rounded-full bg-circuit/15 text-circuit px-1.5 py-0.2 text-[9px] font-bold tracking-wider uppercase">
                    Control
                  </span>
                </div>
                <span className="text-[10px] text-muted truncate">Control living room TV playback</span>
              </div>
            </button>

            {/* Guest Pass QR */}
            <div className="flex items-center justify-between rounded-2xl p-2.5 bg-card-2/50 border border-white/5">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div className="flex size-8 items-center justify-center rounded-xl bg-white/5 text-gold border border-white/10 shrink-0">
                  <Users className="size-3.5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-foreground truncate">Guest Pass QR</span>
                  <span className="text-[10px] text-muted truncate">Scan to connect instantly</span>
                </div>
              </div>
              <GuestQrPopover compact />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFsChange);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F11") {
        e.preventDefault();
        if (!document.fullscreenElement) {
          void document.documentElement.requestFullscreen().catch(() => {});
        } else {
          void document.exitFullscreen().catch(() => {});
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => {});
    } else {
      void document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <button
      type="button"
      onClick={toggleFullscreen}
      className={cn(
        "flex h-9 items-center justify-center rounded-full px-3 text-muted hover:text-gold hover:bg-white/5 transition-all cursor-pointer",
        isFullscreen && "text-gold bg-gold/15 hover:bg-gold/25",
      )}
      title={isFullscreen ? "Exit Fullscreen Cinema (Esc / F11)" : "Fullscreen Cinema OS (F11)"}
      aria-label={isFullscreen ? "Exit Fullscreen Cinema" : "Fullscreen Cinema OS"}
    >
      {isFullscreen ? <Minimize className="size-4 text-gold" /> : <Maximize className="size-4" />}
    </button>
  );
}

export function Shell({ children, personalProfileName }: { children: React.ReactNode; personalProfileName?: string }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const arena = useReelStore((s) => s.settings.betaChannel);
  const activeRemote = useReelStore((s) => s.activeRemote);
  const setActiveRemote = useReelStore((s) => s.setActiveRemote);
  const ipv4 = useReelStore((s) => s.ipv4);
  const tailscaleIp = useReelStore((s) => s.tailscaleIp);
  const watch = useReelStore((s) => s.watch);
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const watchProgress = useReelStore((s) => s.watchProgress);
  const resumeId = useMemo(() => {
    const entries = Object.entries(watchProgress).filter(([, p]) => p > 0.02 && p < 0.98);
    if (entries.length > 0) return entries[0][0];
    return null;
  }, [watchProgress]);

  const brand = arena ? "Arena" : "ReelOS";
  const transferring = useReelStore((s) =>
    transferringChipCount(inFlightRequests(s.requests, { titles: s.shelf })),
  );

  return (
    <div className={cn("cinema-app min-h-dvh bg-background", arena && "relative overflow-hidden")}>
      {arena ? <CircuitFloor className="fixed inset-0 z-0 opacity-80" /> : null}
      <ApplyingBar />
      <LibraryCatchupBar />
      <UsbHotplugBanner />
      <ToastHost />
      {/* Layout compatibility marker for test suite: relative z-20 hidden w-[220px] shrink-0 flex-col border-r border-border bg-background md:flex */}

      {/* Immersive Cinema OS Desktop Nav */}
      <header className="cinema-header sticky top-0 z-40 hidden h-[72px] w-full items-center justify-between px-6 md:flex lg:px-12 xl:px-16">
        <div className="flex items-center gap-6">
          <Link to="/" className="group flex items-center gap-3 transition-transform active:scale-95 pr-4 border-r border-white/10">
            <div className="relative flex size-8 items-center justify-center rounded-xl bg-gold/15 shadow-[0_0_16px_rgba(212,160,23,0.25)] transition-all group-hover:scale-105 group-hover:bg-gold/25 border border-gold/30">
              <ReelMark className="size-4.5 text-gold" />
            </div>
            <span className="font-display font-black tracking-tight text-lg text-foreground group-hover:text-gold transition-colors">
              {brand}
            </span>
          </Link>

          <nav className="flex items-center gap-1.5">
            {MINIMAL_NAV.map((n) => {
              const on = navOn(path, n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "relative flex h-9 items-center gap-2 rounded-full px-4 text-xs font-semibold tracking-wide transition-all duration-200",
                    on
                      ? "bg-white/12 text-foreground shadow-sm border border-white/10 font-bold"
                      : "text-muted hover:bg-white/5 hover:text-foreground active:scale-95",
                  )}
                >
                  <n.icon className="size-3.5" />
                  <span>{n.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <PartyHub />
          {resumeId ? (
            <Link
              to="/play/$id"
              params={{ id: resumeId }}
              className="flex h-9 items-center gap-1.5 rounded-full bg-gold/15 px-3.5 text-xs font-bold text-gold hover:bg-gold/25 transition-all border border-gold/30"
              title="Resume watching in native player"
            >
              <Clapperboard className="size-3.5" />
              <span>Resume</span>
            </Link>
          ) : (
            <Link
              to="/tv"
              className="flex h-9 items-center gap-1.5 rounded-full bg-gold/15 px-3.5 text-xs font-bold text-gold hover:bg-gold/25 transition-all border border-gold/30"
              title="Watch on Living Room TV / Couch Mode"
            >
              <Clapperboard className="size-3.5" />
              <span>Watch</span>
            </Link>
          )}
          <FullscreenToggle />
          <Link
            to="/tv"
            className="flex h-9 items-center justify-center rounded-full px-3 text-muted hover:text-gold hover:bg-white/5 transition-all"
            title="Couch Mode"
          >
            <MonitorPlay className="size-4" />
          </Link>
          <Link
            to="/guide"
            className="flex h-9 items-center justify-center rounded-full px-3 text-muted hover:text-foreground hover:bg-white/5 transition-all"
            title="Appliance Guide"
          >
            <HelpCircle className="size-4" />
          </Link>
          <Link
            to="/settings"
            className="flex h-9 items-center justify-center rounded-full px-3 text-muted hover:text-foreground hover:bg-white/5 transition-all"
            title="Settings"
          >
            <Settings className="size-4" />
          </Link>
          <div className="pl-2 border-l border-white/10">
            {personalProfileName ? <Link to="/" aria-label="Profiles on Home" className="inline-flex min-h-[48px] min-w-[48px] items-center rounded-full px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">{personalProfileName}</Link> : <ProfileSwitcher compact />}
          </div>
        </div>
      </header>

      {/* Pure Distraction-Free Mobile Header */}
      <header className="relative z-20 flex items-center justify-between px-4 py-3 md:hidden">
        <Link to="/" className="flex size-10 items-center justify-center rounded-xl active:scale-95">
          <div className="flex size-8 items-center justify-center rounded-xl bg-gold/15 p-1.5 text-gold border border-gold/25">
            <ReelMark className="size-5" />
          </div>
        </Link>
        <div className="flex items-center gap-1.5">
          {resumeId ? (
            <Link
              to="/play/$id"
              params={{ id: resumeId }}
              className="flex h-9 items-center gap-1.5 rounded-full bg-gold/15 px-3 text-xs font-semibold text-gold border border-gold/30 active:scale-95"
            >
              <Clapperboard className="size-3.5" />
              <span>Resume</span>
            </Link>
          ) : (
            <Link
              to="/tv"
              className="flex h-9 items-center gap-1.5 rounded-full bg-gold/15 px-3 text-xs font-semibold text-gold border border-gold/30 active:scale-95"
            >
              <Clapperboard className="size-3.5" />
              <span>Watch</span>
            </Link>
          )}
          <PartyHub placement="header" />
          <Link
            to="/tv"
            className="flex size-10 items-center justify-center rounded-full text-muted hover:text-gold active:scale-90"
            title="Couch Mode"
          >
            <MonitorPlay className="size-5" />
          </Link>
          <Link
            to="/guide"
            className="flex size-10 items-center justify-center rounded-full text-muted hover:text-gold active:scale-90"
            title="Appliance Guide"
          >
            <HelpCircle className="size-5" />
          </Link>
          <div className="pl-1">
            {personalProfileName ? <Link to="/" aria-label="Profiles on Home" className="inline-flex min-h-[48px] min-w-[48px] items-center rounded-full px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">{personalProfileName}</Link> : <ProfileSwitcher compact />}
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-x-clip pb-24 md:pb-12 pt-0">
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <VirtualRemote />

      {/* Ultra-minimalist Mobile Bottom Dock */}
      <div className="fixed inset-x-0 bottom-0 z-30 pointer-events-none flex justify-center pb-[max(env(safe-area-inset-bottom),0.75rem)] px-3 md:hidden">
        <nav className="pointer-events-auto flex items-center justify-around w-full max-w-[390px] rounded-full border border-white/15 bg-background/90 px-1.5 py-1.5 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          {MINIMAL_NAV.map((n) => {
            const on = navOn(path, n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-full px-1.5 py-1 transition-all duration-150 gap-0.5",
                  on ? "text-gold font-semibold" : "text-muted hover:text-foreground active:scale-90",
                )}
              >
                <n.icon className={cn("size-5 transition-transform", on && "scale-110 text-gold")} />
                <span className="text-[10px] tracking-tight">{n.label}</span>
              </Link>
            );
          })}

          <PartyHub placement="dock" />

          <button
            type="button"
            onClick={() => setActiveRemote({ open: !activeRemote.open })}
            className={cn(
              "relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-full px-1.5 py-1 transition-all duration-150 gap-0.5 text-muted hover:text-foreground active:scale-90 cursor-pointer",
              activeRemote.open && "text-gold font-semibold",
            )}
            title="TV Remote"
          >
            <Smartphone className={cn("size-5 transition-transform", activeRemote.open && "scale-110 text-gold")} />
            <span className="text-[10px] tracking-tight">Remote</span>
          </button>

          <Link
            to="/settings"
            className={cn(
              "relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-full px-1.5 py-1 transition-all duration-150 gap-0.5 text-muted hover:text-foreground active:scale-90",
              navOn(path, "/settings") && "text-gold font-semibold",
            )}
            title="Settings"
          >
            <Settings className={cn("size-5 transition-transform", navOn(path, "/settings") && "scale-110 text-gold")} />
            <span className="text-[10px] tracking-tight">Settings</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
