import { Navigate } from "@tanstack/react-router";
import { HomeView } from "@/components/home-view";
import { Provision } from "@/components/provision";
import { Shell } from "@/components/shell";
import { Splash } from "@/components/splash";
import { Wizard } from "@/components/wizard";
import { updateLocksUi } from "@/lib/library-catchup";
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
  const applying = useReelStore((s) => updateLocksUi(s.update.status));
  const failed = useReelStore((s) => s.update.status === "error");

  if (!hydrated) return <Splash warming />;
  if (!provisioned || phase === "wizard") return <Navigate to="/" />;
  if (phase === "building") return <Provision />;
  if (applying) return <Splash updating />;
  if (failed) return <Splash failed />;
  if (!chrome) return children;
  return <Shell>{children}</Shell>;
}

/** `/` after hydrate. Never returns null — that was a white screen on the house box. */
export function Boot() {
  const hydrated = useReelStore((s) => s.hydrated);
  const provisioned = useReelStore((s) => s.provisioned);
  const phase = useReelStore((s) => s.phase);
  const applying = useReelStore((s) => updateLocksUi(s.update.status));
  const failed = useReelStore((s) => s.update.status === "error");

  if (!hydrated) return <Splash warming />;
  if (phase === "wizard") return <Wizard />;
  if (phase === "building") return <Provision />;
  if (phase === "ready" && !provisioned) return <Provision />;
  if (provisioned) {
    if (applying) return <Splash updating />;
    if (failed) return <Splash failed />;
    return (
      <Shell>
        <HomeView />
      </Shell>
    );
  }
  if (phase === "splash") return <Splash />;
  return <Wizard />;
}
