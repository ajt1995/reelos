import { createFileRoute } from "@tanstack/react-router";
import { Gate } from "@/components/gate";
import { PlayerView } from "@/components/player-view";

export const Route = createFileRoute("/play/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <Gate chrome={false}>
      <PlayerView id={id} />
    </Gate>
  );
}
