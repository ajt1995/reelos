import { Navigate } from "@tanstack/react-router";
import { HomeView } from "@/components/home-view";
import { Provision } from "@/components/provision";
import { Shell } from "@/components/shell";
import { Splash } from "@/components/splash";
import { Wizard } from "@/components/wizard";
import { catchupLocksHome } from "@/lib/library-catchup";
import { useReelStore } from "@/lib/store";

export function Gate({
  children,
  chrome = true,
}: {
  children: React.ReactNode;
  chrome?: boolean;
}) {
  const hydrated = useReelStore((s) => s.hydrated);
  const provisioned = useReelStore((s) => s.provisioned);
  const phase = useReelStore((s) => s.phase);

  if (!hydrated) return <Splash warming />;
  if (!provisioned || phase === "wizard") return <Navigate to="/" />;
  if (phase === "building") return <Provision />;
  if (!chrome) return children;
  return <Shell>{children}</Shell>;
}

/** `/` after hydrate. Never returns null — that was a white screen on the house box. */
export function Boot() {
  const hydrated = useReelStore((s) => s.hydrated);
  const provisioned = useReelStore((s) => s.provisioned);
  const phase = useReelStore((s) => s.phase);
  const catchup = useReelStore((s) => s.libraryCatchup);
  const applying = useReelStore((s) => s.update.status === "applying");
  const splashLock = catchupLocksHome(catchup);

  if (!hydrated) return <Splash warming />;
  if (phase === "wizard") return <Wizard />;
  if (phase === "building") return <Provision />;
  if (phase === "ready" && !provisioned) return <Provision />;
  if (provisioned) {
    if (splashLock && !applying) return <Splash warming />;
    return (
      <Shell>
        <HomeView />
      </Shell>
    );
  }
  if (phase === "splash") return <Splash />;
  return <Wizard />;
}
