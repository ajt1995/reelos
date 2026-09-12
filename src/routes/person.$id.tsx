import { createFileRoute } from "@tanstack/react-router";
import { Gate } from "@/components/gate";
import { PersonView } from "@/components/person-view";

export const Route = createFileRoute("/person/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <Gate>
      <PersonView id={id} />
    </Gate>
  );
}
