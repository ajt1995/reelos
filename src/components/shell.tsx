import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Clapperboard,
  Compass,
  Home,
  Library,
  Settings,
} from "lucide-react";
import { ApplyingBar } from "@/components/applying-bar";
import { LibraryCatchupBar } from "@/components/library-catchup-bar";
import { ReelMark } from "@/components/logo";
import { HOSTNAME } from "@/lib/catalog";
import { frontendLabel, useReelStore } from "@/lib/store";
import { jellyfinWatchHref } from "@/lib/jellyfin-watch";
import { inFlightRequests, transferringChipCount } from "@/lib/sync-requests";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/requests", label: "Requests", icon: Clapperboard },
  { to: "/library", label: "Library", icon: Library },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const frontend = useReelStore((s) => s.answers.frontend);
  const jfLive = useReelStore((s) => s.jellyfinHop?.state === "green");
  const ipv4 = useReelStore((s) => s.ipv4);
  const tailscaleIp = useReelStore((s) => s.tailscaleIp);
  const watch = useReelStore((s) => s.watch);
  const transferring = useReelStore((s) =>
    transferringChipCount(inFlightRequests(s.requests, { titles: s.shelf })),
  );
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const watchHref = jellyfinWatchHref({ ipv4, tailscaleIp, watch, hostname });

  return (
    <div className="min-h-dvh bg-background">
      <ApplyingBar />
      <LibraryCatchupBar />
      <div className="md:flex">
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
                {n.to === "/requests" && transferring > 0 ? (
                  <span className="ml-auto font-mono text-[11px] text-gold tabular-nums">
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
              className="mt-1 flex h-11 items-center gap-3 rounded-xl px-3 text-sm text-gold hover:bg-card/60"
            >
              <Clapperboard className="size-4" />
              Watch
            </a>
          ) : null}
          <div className="mt-3 rounded-xl bg-raised px-3 py-3">
            <p className="font-mono text-[11px] text-faint">{HOSTNAME}</p>
            <p className={cn("mt-1 flex items-center gap-1.5 text-[11px]", jfLive ? "text-live" : "text-muted")}>
              {jfLive ? (
                <span className="size-1.5 rounded-full bg-live" style={{ animation: "pulse-live 2s ease infinite" }} />
              ) : null}
              {frontendLabel[frontend]}
              {jfLive ? " live" : ""}
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
          {watchHref ? (
            <a
              href={watchHref}
              target="_blank"
              rel="noreferrer"
              className="ml-auto flex h-11 items-center rounded-xl px-3 text-sm font-medium text-gold"
            >
              Watch
            </a>
          ) : (
            <span className="ml-auto" />
          )}
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/90 backdrop-blur-md md:hidden">
        {NAV.filter((n) => n.to !== "/activity").map((n) => {
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
