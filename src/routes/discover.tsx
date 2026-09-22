import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/discover")({ component: Page });

function Page() {
  return <Outlet />;
}
