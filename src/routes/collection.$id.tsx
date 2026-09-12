import { createFileRoute } from "@tanstack/react-router";
import { CollectionView } from "@/components/collection-view";
import { Gate } from "@/components/gate";

export const Route = createFileRoute("/collection/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <Gate>
      <CollectionView id={id} />
    </Gate>
  );
}
