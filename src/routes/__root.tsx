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
  useEffect(() => {
    const finish = () => useReelStore.getState().setHydrated();
    void Promise.resolve(useReelStore.persist.rehydrate())
      .then(async () => {
        try {
          const r = await fetch("/api/box", { cache: "no-store" });
          const box = (await r.json()) as { provisioned?: boolean; answers?: Record<string, unknown> };
          if (box.provisioned) {
            const s = useReelStore.getState();
            if (box.answers && typeof box.answers === "object") {
              s.patchAnswers(box.answers as Parameters<typeof s.patchAnswers>[0]);
            }
            if (!s.provisioned || s.phase === "wizard") s.openReelOS();
          }
        } catch {
          /* preview / no box */
        }
      })
      .then(finish, finish);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      useReelStore.getState().tick();
    }, 480);
    return () => window.clearInterval(id);
  }, []);

  return children;
}
