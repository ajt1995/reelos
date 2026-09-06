import { createFileRoute } from "@tanstack/react-router";
import { AdvancedView } from "@/components/advanced-view";
import { Gate } from "@/components/gate";

export const Route = createFileRoute("/settings/advanced")({ component: Page });

function Page() {
  return (
    <Gate>
      <AdvancedView />
    </Gate>
  );
}
