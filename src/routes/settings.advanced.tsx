import { createFileRoute } from "@tanstack/react-router";
import { ReelOSWorld } from "@/experience/reelos-world";

export const Route = createFileRoute("/settings/advanced")({ component: Page });

function Page() {
  return <ReelOSWorld initialView="settings" initialSettingsGroup="advanced" />;
}
