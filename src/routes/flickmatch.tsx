import { createFileRoute } from "@tanstack/react-router";
import { Gate } from "@/components/gate";
import { FlickMatchView } from "@/components/flickmatch-view";

export const Route = createFileRoute("/flickmatch")({ component: FlickMatchPage });

function FlickMatchPage() {
  return (
    <Gate chrome={false}>
      <FlickMatchView />
    </Gate>
  );
}
