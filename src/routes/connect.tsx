import { createFileRoute } from "@tanstack/react-router";
import { ReelOSWorld } from "@/experience/reelos-world";

export const Route = createFileRoute("/connect")({ component: Page });

function Page() {
  return <ReelOSWorld initialView="devices" />;
}
