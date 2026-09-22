import { createFileRoute } from "@tanstack/react-router";
import { ReelOSWorld } from "@/experience/reelos-world";

export const Route = createFileRoute("/title/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return <ReelOSWorld initialDestination={{ type: "title", id }} />;
}
