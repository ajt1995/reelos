import { createFileRoute } from "@tanstack/react-router";
import { ActivityView } from "@/components/activity-view";
import { Gate } from "@/components/gate";

export const Route = createFileRoute("/activity")({ component: Page });

function Page() {
  return (
    <Gate>
      <ActivityView />
    </Gate>
  );
}
