import { createFileRoute } from "@tanstack/react-router";
import { Boot } from "@/components/gate";
import { HomeView } from "@/components/home-view";
import { Shell } from "@/components/shell";
import { useReelStore } from "@/lib/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const provisioned = useReelStore((s) => s.provisioned);
  const phase = useReelStore((s) => s.phase);
  const hydrated = useReelStore((s) => s.hydrated);

  if (!hydrated || !provisioned || phase === "wizard" || phase === "building" || phase === "ready") {
    return <Boot />;
  }
  return (
    <Shell>
      <HomeView />
    </Shell>
  );
}
