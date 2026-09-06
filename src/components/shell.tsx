import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Clapperboard,
  Compass,
  Home,
  Library,
  Search,
  Settings,
} from "lucide-react";
import { ReelMark } from "@/components/logo";
import { HOSTNAME } from "@/lib/catalog";
import { frontendLabel, useReelStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/requests", label: "Requests", icon: Clapperboard },
  { to: "/library", label: "Library", icon: Library },
  { to: "/activity", label: "Activity", icon: Activity },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const frontend = useReelStore((s) => s.answers.frontend);
  const downloading = useReelStore(
    (s) => s.requests.filter((r) => r.status === "downloading").length,
  );

  return (
    <div className="min-h-dvh bg-background md:flex">
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-border md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <ReelMark className="size-7" />
          <span className="font-display text-sm font-semibold tracking-[0.18em] text-gold">
            ReelOS
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV.map((n) => {
            const on = n.to === "/" ? path === "/" : path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-150",
                  on ? "bg-card text-foreground" : "text-muted hover:bg-card/60 hover:text-foreground",
                )}
              >
                <n.icon className="size-4" />
                {n.label}
                {n.to === "/requests" && downloading > 0 ? (
                  <span className="ml-auto font-mono text-[11px] text-gold tabular-nums">
                    {downloading}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 pb-3">
          <Link
            to="/settings"
            className={cn(
              "flex h-11 items-center gap-3 rounded-xl px-3 text-sm",
              path.startsWith("/settings")
                ? "bg-card text-foreground"
                : "text-muted hover:bg-card/60 hover:text-foreground",
            )}
          >
            <Settings className="size-4" />
            Settings
          </Link>
          <div className="mt-3 rounded-xl bg-raised px-3 py-3">
            <p className="font-mono text-[11px] text-faint">{HOSTNAME}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-live">
              <span className="size-1.5 rounded-full bg-live" style={{ animation: "pulse-live 2s ease infinite" }} />
              {frontendLabel[frontend]} live
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-[4.5rem] md:pb-0">
        <header className="flex items-center gap-3 px-4 pt-4 md:hidden">
          <ReelMark className="size-7" />
          <span className="font-display text-sm font-semibold tracking-[0.18em] text-gold">
            ReelOS
          </span>
          <Link
            to="/discover"
            className="ml-auto flex size-11 items-center justify-center rounded-xl text-muted"
            aria-label="Search"
          >
            <Search className="size-5" />
          </Link>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/90 backdrop-blur-md md:hidden">
        {[
          ...NAV.filter((n) => n.to !== "/activity"),
          { to: "/settings", label: "Settings", icon: Settings },
        ].map((n) => {
          const on = n.to === "/" ? path === "/" : path.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px]",
                on ? "text-gold" : "text-faint",
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
