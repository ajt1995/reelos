import { createFileRoute } from "@tanstack/react-router";
import { ReelOSWorld } from "@/experience/reelos-world";

export const Route = createFileRoute("/calibrate")({ component: Page });

function Page() {
  return <ReelOSWorld initialView="taste" />;
}
