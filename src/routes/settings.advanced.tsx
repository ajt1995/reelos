import { createFileRoute } from "@tanstack/react-router";
import { AdvancedView } from "@/components/advanced-view";
import { Gate } from "@/components/gate";
import { KidsLock } from "@/components/kids-lock";

export const Route = createFileRoute("/settings/advanced")({ component: Page });

function Page() {
  return (
    <Gate>
      <KidsLock>
        <AdvancedView />
      </KidsLock>
    </Gate>
  );
}
