import { Link, useRouterState } from "@tanstack/react-router";
import {
  Clapperboard,
  Compass,
  Home,
  Library,
  Search,
  Settings,
} from "lucide-react";
import { ApplyingBar } from "@/components/applying-bar";
import { CircuitFloor } from "@/components/circuit-floor";
import { ReelMark } from "@/components/logo";
import { HOSTNAME } from "@/lib/catalog";
import { frontendLabel, useReelStore } from "@/lib/store";
import { inFlightRequests } from "@/lib/sync-requests";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/requests", label: "Requests", icon: Clapperboard },
  { to: "/library", label: "Library", icon: Library },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const frontend = useReelStore((s) => s.answers.frontend);
  const transferring = useReelStore(
    (s) => inFlightRequests(s.requests, { titles: s.shelf }).length,
  );
  const watchUrl =
    typeof window !== "undefined" ? `http://${window.location.hostname}:8096` : "http://127.0.0.1:8096";

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <CircuitFloor className="fixed inset-0 z-0 opacity-80" />
      <ApplyingBar />
      <div className="relative z-10 md:flex">
      <aside className="hidden w-[200px] shrink-0 flex-col border-r border-border md:flex">
        <div className="flex items-center gap-2 px-4 py-3">
          <ReelMark className="size-6" />
          <span className="font-display text-sm font-semibold tracking-[0.18em] text-foreground">
            ReelOS
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-2">
          {NAV.map((n) => {
            const on = n.to === "/" ? path === "/" : path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors duration-150",
                  on ? "bg-card text-circuit" : "text-muted hover:bg-card/60 hover:text-foreground",
                )}
              >
                <n.icon className="size-4" />
                {n.label}
                {n.to === "/requests" && transferring > 0 ? (
                  <span className="ml-auto font-mono text-[11px] text-circuit tabular-nums">
                    {transferring}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="px-2 pb-3">
          <a
            href={watchUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-gold px-3 text-sm font-medium text-gold-fg arena-gold-press"
          >
            Watch
          </a>
          <div className="mt-2 rounded-lg bg-raised px-2.5 py-2">
            <p className="font-mono text-[11px] text-faint">{HOSTNAME}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-circuit">
              <span className="size-1.5 rounded-full bg-circuit" />
              {frontendLabel[frontend]} live
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-12 md:pb-0">
        <header className="flex items-center gap-2 px-3 pt-2 md:hidden">
          <ReelMark className="size-6" />
          <span className="font-display text-sm font-semibold tracking-[0.16em] text-foreground">
            ReelOS
          </span>
          <a
            href={watchUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex h-8 items-center rounded-full bg-gold px-3 text-xs font-medium text-gold-fg arena-gold-press"
          >
            Watch
          </a>
          <Link
            to="/discover"
            className="flex size-8 items-center justify-center rounded-lg text-muted"
            aria-label="Search"
          >
            <Search className="size-4" />
          </Link>
          <Link
            to="/settings"
            className="flex size-8 items-center justify-center rounded-lg text-muted"
            aria-label="Settings"
          >
            <Settings className="size-4" />
          </Link>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/92 backdrop-blur-md md:hidden">
        {NAV.map((n) => {
          const on = n.to === "/" ? path === "/" : path.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "relative flex h-12 flex-1 flex-col items-center justify-center gap-0.5 text-[10px]",
                on ? "text-circuit" : "text-faint",
              )}
            >
              <n.icon className="size-4" />
              {n.label}
              {n.to === "/requests" && transferring > 0 ? (
                <span className="absolute right-[18%] top-1 min-w-3.5 rounded-full bg-circuit px-1 text-[9px] font-medium text-background tabular-nums">
                  {transferring}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
