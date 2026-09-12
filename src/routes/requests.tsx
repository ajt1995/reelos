import { createFileRoute } from "@tanstack/react-router";
import { Gate } from "@/components/gate";
import { KidsLock } from "@/components/kids-lock";
import { RequestsView } from "@/components/requests-view";

export const Route = createFileRoute("/requests")({ component: Page });

function Page() {
  return (
    <Gate>
      <KidsLock>
        <RequestsView />
      </KidsLock>
    </Gate>
  );
}
