import { Navigate } from "@tanstack/react-router";
import { Provision } from "@/components/provision";
import { Shell } from "@/components/shell";
import { Splash } from "@/components/splash";
import { Wizard } from "@/components/wizard";
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

  if (!hydrated) return <Splash />;
  if (!provisioned) return <Navigate to="/" />;
  if (phase === "wizard") return <Wizard />;
  if (!chrome) return children;
  return <Shell>{children}</Shell>;
}

export function Boot() {
  const hydrated = useReelStore((s) => s.hydrated);
  const provisioned = useReelStore((s) => s.provisioned);
  const phase = useReelStore((s) => s.phase);

  if (!hydrated) return <Splash />;
  if (provisioned && phase !== "wizard") {
    return null;
  }
  if (phase === "wizard") return <Wizard />;
  if (phase === "building" || phase === "ready") return <Provision />;
  return <Splash />;
}
