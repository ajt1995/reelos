import { createFileRoute } from "@tanstack/react-router";
import { Gate } from "@/components/gate";
import { KidsLock } from "@/components/kids-lock";
import { SettingsView } from "@/components/settings-view";

export const Route = createFileRoute("/settings")({ component: Page });

function Page() {
  return (
    <Gate>
      <KidsLock>
        <SettingsView />
      </KidsLock>
    </Gate>
  );
}
