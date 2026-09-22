import { createFileRoute } from "@tanstack/react-router";
import { ReelOSWorld } from "@/experience/reelos-world";

export const Route = createFileRoute("/discover/")({ component: Discover });

function Discover() {
  return <ReelOSWorld initialView="discover" />;
}
