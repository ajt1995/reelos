import { createFileRoute } from "@tanstack/react-router";
import { ReelOSWorld } from "@/experience/reelos-world";

export const Route = createFileRoute("/family")({ component: Page });

function Page() {
  return <ReelOSWorld initialView="family" />;
}
