import { Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HomeCanvas } from "@/components/home-canvas";
import { Provision } from "@/components/provision";
import { Shell } from "@/components/shell";
import { Splash } from "@/components/splash";
import { Wizard } from "@/components/wizard";
import { HouseholdGateView } from "@/components/household-gate-view";
import { updateLocksUi } from "@/lib/library-catchup";
import { useReelStore } from "@/lib/store";
import { useExperienceStore } from "@/experience/experience-state";

export function Gate({
  children,
  chrome = true,
  personalSetup = false,
}: {
  children: React.ReactNode;
  chrome?: boolean;
  personalSetup?: boolean;
}) {
  const [personalReady, setPersonalReady] = useState<boolean | null>(null);
  const [personalName, setPersonalName] = useState("Your profile");
  useEffect(() => {
    if (!personalSetup) return;
    const controller = new AbortController();
    void fetch("/api/profiles", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Profile unavailable");
        const payload = await response.json();
        const active = payload.profiles?.find((profile: { id: string }) => profile.id === payload.activeId);
        if (!controller.signal.aborted) {
          const ready = payload.auth?.authenticated === true && payload.setup?.status === "complete" && !!active && !active.isKids;
          // Legacy destinations share the server-confirmed identity, never a
          // remembered local profile from an earlier session/device.
          if (ready) {
            useExperienceStore.setState({ activeProfileId: active.id });
            setPersonalName(typeof active.name === "string" ? active.name : "Your profile");
          }
          setPersonalReady(ready);
        }
      }).catch(() => { if (!controller.signal.aborted) setPersonalReady(false); });
    return () => controller.abort();
  }, [personalSetup]);
  const hydrated = useReelStore((s) => s.hydrated);
  const provisioned = useReelStore((s) => s.provisioned);
  const phase = useReelStore((s) => s.phase);
  const applying = useReelStore((s) => updateLocksUi(s.update.status));
  const failed = useReelStore((s) => s.update.status === "error");
  const remoteChallenged = useReelStore((s) => s.remoteChallenged);

  if (!hydrated) return null;
  if (remoteChallenged) return <HouseholdGateView />;
  if (personalSetup) {
    if (applying) return <Splash updating />;
    if (failed) return <Splash failed />;
    if (personalReady === null) return <main className="min-h-dvh bg-black" aria-label="Opening your profile" />;
    if (!personalReady) return <Navigate to="/" />;
    return chrome ? <Shell personalProfileName={personalName}>{children}</Shell> : children;
  }
  if (!provisioned || phase === "wizard" || phase === "splash") return <Navigate to="/" />;
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
  const remoteChallenged = useReelStore((s) => s.remoteChallenged);

  if (!hydrated) return <Splash warming />;
  if (remoteChallenged) return <HouseholdGateView />;
  if (applying) return <Splash updating />;
  if (failed) return <Splash failed />;
  if (phase === "splash") return <Splash />;
  if (phase === "building") return <Provision />;
  if (phase === "ready" && !provisioned) return <Provision />;
  if (!provisioned || phase === "wizard") return <Wizard />;
  return (
    <Shell>
      <HomeCanvas />
    </Shell>
  );
}
