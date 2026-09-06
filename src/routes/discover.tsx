import { createFileRoute } from "@tanstack/react-router";
import { DiscoverView } from "@/components/discover-view";
import { Gate } from "@/components/gate";

export const Route = createFileRoute("/discover")({ component: Page });

function Page() {
  return (
    <Gate>
      <DiscoverView />
    </Gate>
  );
}
