import { createFileRoute } from "@tanstack/react-router";
import { Gate } from "@/components/gate";
import { TvView } from "@/components/tv-view";

export const Route = createFileRoute("/tv")({ component: TvPage });

function TvPage() {
  return (
    <Gate chrome={false}>
      <TvView />
    </Gate>
  );
}

