import { createFileRoute } from "@tanstack/react-router";
import { Gate } from "@/components/gate";
import { ConnectView } from "@/components/connect-view";

export const Route = createFileRoute("/connect")({ component: Page });

function Page() {
  return (
    <Gate>
      <ConnectView />
    </Gate>
  );
}
