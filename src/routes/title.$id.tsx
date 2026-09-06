import { createFileRoute } from "@tanstack/react-router";
import { Gate } from "@/components/gate";
import { TitleView } from "@/components/title-view";

export const Route = createFileRoute("/title/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <Gate>
      <TitleView id={id} />
    </Gate>
  );
}
