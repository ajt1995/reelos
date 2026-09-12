import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Gate } from "@/components/gate";

export const Route = createFileRoute("/discover")({ component: Page });

function Page() {
  return (
    <Gate>
      <Outlet />
    </Gate>
  );
}
