import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { ReelOSWorld } from "@/experience/reelos-world";

export const Route = createFileRoute("/settings")({ component: Page });

function Page() {
  const isChild = useRouterState({
    select: (s) => s.location.pathname !== "/settings" && s.location.pathname !== "/settings/",
  });
  return isChild ? <Outlet /> : <ReelOSWorld initialView="settings" />;
}
