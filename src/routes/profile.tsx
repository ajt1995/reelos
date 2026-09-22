import { createFileRoute } from "@tanstack/react-router";
import { ReelOSWorld } from "@/experience/reelos-world";

export const Route = createFileRoute("/profile")({ component: Page });

function Page() {
  return <ReelOSWorld initialView="profile" />;
}
