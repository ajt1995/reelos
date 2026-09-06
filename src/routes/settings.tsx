import { createFileRoute } from "@tanstack/react-router";
import { Gate } from "@/components/gate";
import { SettingsView } from "@/components/settings-view";

export const Route = createFileRoute("/settings")({ component: Page });

function Page() {
  return (
    <Gate>
      <SettingsView />
    </Gate>
  );
}
