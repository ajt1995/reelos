import { createFileRoute } from "@tanstack/react-router";
import { EngineView } from "@/components/engine-view";
import { Gate } from "@/components/gate";

export const Route = createFileRoute("/engine/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <Gate>
      <EngineView id={id} />
    </Gate>
  );
}
