import { useEffect } from "react";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { useReelStore } from "@/lib/store";
import appCss from "../styles.css?url";

const APP_NAME = "ReelOS";

export const Route = createRootRoute({
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
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
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
            <Outlet />
          </Runtime>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}

function Runtime({ children }: { children: React.ReactNode }) {
  const arena = useReelStore((s) => s.settings.betaChannel);
  useEffect(() => {
    document.documentElement.classList.toggle("arena-on", arena);
    document.body.classList.toggle("arena-on", arena);
  }, [arena]);
  useEffect(() => {
    void Promise.resolve(useReelStore.persist.rehydrate())
      .catch(() => {})
      .then(async () => {
        const s = useReelStore.getState();
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
        return fetch("/api/ready?limit=24", { cache: "no-store", signal: AbortSignal.timeout(4000) })
          .then(async (r) => {
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
