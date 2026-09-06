import { createFileRoute } from "@tanstack/react-router";
import { Boot } from "@/components/gate";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <Boot />;
}
