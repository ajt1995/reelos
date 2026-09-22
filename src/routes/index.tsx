import { createFileRoute } from "@tanstack/react-router";
import { ReelOSWorld } from "@/experience/reelos-world";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <ReelOSWorld />;
}
