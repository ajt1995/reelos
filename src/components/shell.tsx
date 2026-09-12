import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BookOpen,
  Clapperboard,
  Compass,
  Home,
  Library,
  Settings,
} from "lucide-react";
import { ApplyingBar } from "@/components/applying-bar";
import { CircuitFloor } from "@/components/circuit-floor";
import { LibraryCatchupBar } from "@/components/library-catchup-bar";
import { ProfileSwitcher } from "@/components/profile-switcher";
import { ReelMark } from "@/components/logo";
import { HOSTNAME } from "@/lib/catalog";
import { useHouseholdProfile } from "@/lib/profiles";
import { frontendLabel, useReelStore } from "@/lib/store";
import { jellyfinWatchHref } from "@/lib/jellyfin-watch";
import { inFlightRequests, transferringChipCount } from "@/lib/sync-requests";
import { cn } from "@/lib/utils";

const STABLE_NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/requests", label: "Requests", icon: Clapperboard },
  { to: "/library", label: "Library", icon: Library },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const ARENA_DESKTOP_NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/books", label: "Books", icon: BookOpen },
  { to: "/requests", label: "Requests", icon: Clapperboard },
  { to: "/library", label: "Library", icon: Library },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const ARENA_PHONE_NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/books", label: "Books", icon: BookOpen },
  { to: "/requests", label: "Requests", icon: Clapperboard },
  { to: "/library", label: "Library", icon: Library },
] as const;

function navOn(path: string, to: string) {
  if (to === "/") return path === "/";
  return path === to || path.startsWith(`${to}/`);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const arena = useReelStore((s) => s.settings.betaChannel);
  const frontend = useReelStore((s) => s.answers.frontend);
  const jfLive = useReelStore((s) => s.jellyfinHop?.state === "green");
  const ipv4 = useReelStore((s) => s.ipv4);
  const tailscaleIp = useReelStore((s) => s.tailscaleIp);
  const watch = useReelStore((s) => s.watch);
  const transferring = useReelStore((s) =>
    transferringChipCount(inFlightRequests(s.requests, { titles: s.shelf })),
  );
  const { kids } = useHouseholdProfile();
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const watchHref = jellyfinWatchHref({ ipv4, tailscaleIp, watch, hostname });
  const desktopNav = (arena ? ARENA_DESKTOP_NAV : STABLE_NAV).filter((n) => {
    if (kids && (n.to === "/settings" || n.to === "/requests")) return false;
    return true;
  });
  const phoneNav = (arena ? ARENA_PHONE_NAV : STABLE_NAV.filter((n) => n.to !== "/activity")).filter((n) => {
    if (kids && (n.to === "/settings" || n.to === "/requests")) return false;
    return true;
  });
  const brand = arena ? "Arena" : "ReelOS";

  return (
    <div className={cn("min-h-dvh bg-background", arena && "relative overflow-hidden")}>
      {arena ? <CircuitFloor className="fixed inset-0 z-0 opacity-80" /> : null}
      <ApplyingBar />
      <LibraryCatchupBar />
      <div className={cn("md:flex", arena && "relative z-10")}>
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-border md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <ReelMark className="size-7" />
          <span
            className={cn(
              "font-display text-sm font-semibold tracking-[0.18em]",
              arena ? "text-foreground" : "text-gold",
            )}
          >
            {brand}
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {desktopNav.map((n) => {
            const on = navOn(path, n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-150",
                  on
                    ? arena
                      ? "bg-card text-circuit"
                      : "bg-card text-foreground"
                    : "text-muted hover:bg-card/60 hover:text-foreground",
                )}
              >
                <n.icon className="size-4" />
                {n.label}
                {n.to === "/requests" && transferring > 0 ? (
                  <span
                    className={cn(
                      "ml-auto font-mono text-[11px] tabular-nums",
                      arena ? "text-circuit" : "text-gold",
                    )}
                  >
                    {transferring}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 pb-3">
          {watchHref ? (
            <a
              href={watchHref}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "mt-1 flex h-11 items-center gap-3 rounded-xl px-3 text-sm text-gold hover:bg-card/60",
                arena && "justify-center rounded-full bg-gold text-gold-fg hover:bg-gold-bright arena-gold-press",
              )}
            >
              {arena ? null : <Clapperboard className="size-4" />}
              Watch
            </a>
          ) : null}
          <div className="mt-3 rounded-xl bg-raised px-3 py-3">
            <p className="font-mono text-[11px] text-faint">{HOSTNAME}</p>
            <p className={cn("mt-1 flex items-center gap-1.5 text-[11px]", jfLive ? (arena ? "text-circuit" : "text-live") : "text-muted")}>
              {jfLive ? (
                <span
                  className={cn("size-1.5 rounded-full", arena ? "bg-circuit" : "bg-live")}
                  style={{ animation: "pulse-live 2s ease infinite" }}
                />
              ) : null}
              {frontendLabel[frontend]}
              {jfLive ? " live" : ""}
            </p>
          </div>
          <div className="px-3 pb-2">
            <ProfileSwitcher />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-[4.5rem] md:pb-0">
        <header className="flex items-center gap-3 px-4 pt-4 md:hidden">
          <ReelMark className="size-7" />
          <span
            className={cn(
              "font-display text-sm font-semibold tracking-[0.18em]",
              arena ? "text-foreground" : "text-gold",
            )}
          >
            {brand}
          </span>
          {watchHref ? (
            <a
              href={watchHref}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "ml-auto flex h-11 items-center rounded-xl px-3 text-sm font-medium text-gold",
                arena && "h-8 rounded-full bg-gold px-3 text-xs text-gold-fg arena-gold-press",
              )}
            >
              Watch
            </a>
          ) : (
            <span className="ml-auto" />
          )}
          {arena && !kids ? (
            <Link
              to="/settings"
              className="flex size-8 items-center justify-center rounded-lg text-muted"
              aria-label="Settings"
            >
              <Settings className="size-4" />
            </Link>
          ) : null}
        </header>
        <div className="px-4 pt-2 md:hidden">
          <ProfileSwitcher compact />
        </div>
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/90 backdrop-blur-md md:hidden">
        {phoneNav.map((n) => {
          const on = navOn(path, n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px]",
                on ? (arena ? "text-circuit" : "text-gold") : "text-faint",
              )}
            >
              <n.icon className="size-5" />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
