import { useEffect, useState } from "react";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { ErrorBoundary, RootRouteErrorFallback } from "@/components/error-boundary";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { useReelStore } from "@/lib/store";
import appCss from "../styles.css?url";

const APP_NAME = "ReelOS";

export const Route = createRootRoute({
  errorComponent: RootRouteErrorFallback,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content: "Install. Point. Stream. A personal media appliance.",
      },
      { name: "theme-color", content: "#0B0D10" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="film-grain bg-background text-foreground">
        <PreviewHostBridge />
        <AuthProvider>
          <Runtime>
            <ChildRouteBoundary>
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </ChildRouteBoundary>
          </Runtime>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}

function ChildRouteBoundary({ children }: { children: React.ReactNode }) {
  // Every non-Home destination starts closed and is reopened only after the
  // active profile is checked. Keying that decision to the router pathname
  // also protects client-side navigation, not only the first page load.
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [authorizedPath, setAuthorizedPath] = useState("");

  useEffect(() => {
    if (pathname === "/") {
      setAuthorizedPath(pathname);
      return;
    }
    setAuthorizedPath("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2500);
    void fetch("/api/profiles", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Profile state unavailable");
        return response.json() as Promise<{
          activeId?: string;
          profiles?: Array<{ id?: string; isKids?: boolean }>;
        }>;
      })
      .then((payload) => {
        const active = payload.profiles?.find(
          (profile) => profile.id === payload.activeId,
        );
        if (active?.isKids) {
          window.location.replace("/");
          return;
        }
        setAuthorizedPath(pathname);
      })
      .catch(() => window.location.replace("/"))
      .finally(() => window.clearTimeout(timeout));
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [pathname]);

  if (pathname !== "/" && authorizedPath !== pathname) {
    return <main className="min-h-dvh bg-[#080809]" />;
  }
  return children;
}

function Runtime({ children }: { children: React.ReactNode }) {
  const arena = useReelStore((s) => s.settings.betaChannel);
  const theme = useReelStore((s) => s.theme);
  const animationsEnabled = useReelStore((s) => s.animationsEnabled !== false);
  const activeResidentId = useReelStore((s) => s.activeResidentId);
  const residents = useReelStore((s) => s.residents);
  const resident = residents.find((r) => r.id === activeResidentId);
  const currentVibe = resident?.tasteVibe || "balanced";

  useEffect(() => {
    document.documentElement.classList.toggle("arena-on", arena);
    document.body.classList.toggle("arena-on", arena);
  }, [arena]);
  useEffect(() => {
    const t = theme || "gold-hashed";
    document.documentElement.setAttribute("data-theme", t);
    document.body.setAttribute("data-theme", t);
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.animations = String(animationsEnabled);
    document.body.dataset.animations = String(animationsEnabled);
  }, [animationsEnabled]);
  useEffect(() => {
    document.documentElement.setAttribute("data-vibe", currentVibe);
    document.body.setAttribute("data-vibe", currentVibe);
  }, [currentVibe]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.has("reset")) {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch {}
        useReelStore.getState().factoryReset();
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
    void Promise.resolve(useReelStore.persist.rehydrate())
      .catch(() => {})
      .then(async () => {
        const s = useReelStore.getState();
        s.setHydrated();
        s.setBootStep("local", "ok");
        s.setBootStep("house", "running");
        s.setBootStep("library", "running");
        s.setBootStep("requests", "running");
        s.syncUpdateFromBox();
        // Box truth for Arena/Books — do not let localStorage keep a stale off
        // if /api/ready is slow or times out (Seerr fan-out).
        try {
          const ui = await fetch("/api/settings", {
            cache: "no-store",
            signal: AbortSignal.timeout(2500),
          }).then((r) => r.json() as Promise<{ betaChannel?: boolean }>);
          if (typeof ui?.betaChannel === "boolean") {
            useReelStore.getState().patchSettings({ betaChannel: ui.betaChannel });
          }
        } catch {
          /* ready still applies betaChannel when it lands */
        }

        // Check Household Gate status for remote zero-install access
        try {
          const gateStatus = await fetch("/api/gate/status", {
            cache: "no-store",
            signal: AbortSignal.timeout(2500),
          }).then((r) => r.json() as Promise<{ ok?: boolean; isLan?: boolean; isPaired?: boolean }>);
          if (gateStatus?.ok && !gateStatus.isLan && !gateStatus.isPaired) {
            useReelStore.getState().setRemoteChallenged(true);
          } else {
            useReelStore.getState().setRemoteChallenged(false);
          }
        } catch {
          /* fail open on LAN */
        }

        return fetch("/api/ready?limit=24", { cache: "no-store", signal: AbortSignal.timeout(4000) })
          .then(async (r) => {
            if (r.status === 401) {
              const j = await r.json().catch(() => ({}));
              if (j?.challenged) {
                useReelStore.getState().setRemoteChallenged(true);
                return;
              }
            }
            const ready = (await r.json()) as Parameters<typeof s.applyReadyPayload>[0];
            useReelStore.getState().applyReadyPayload(ready);
          })
          .catch(() => {
            const cur = useReelStore.getState();
            cur.setBootStep("house", cur.provisioned ? "ok" : "fail");
            cur.setBootStep("library", cur.shelfReady ? "ok" : "fail");
            cur.setBootStep("requests", cur.requestsSeeded ? "ok" : "fail");
            if (cur.provisioned) cur.openReelOS();
          })
          .finally(() => {
            useReelStore.getState().setHydrated();
          });
      });
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      useReelStore.getState().tick();
    }, 480);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      useReelStore.getState().syncUpdateFromBox();
    }, 2500);
    return () => window.clearInterval(id);
  }, []);

  return children;
}
