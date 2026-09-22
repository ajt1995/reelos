import { createFileRoute } from "@tanstack/react-router";
import { ReelOSWorld } from "@/experience/reelos-world";

export const Route = createFileRoute("/person/$id")({
  validateSearch: (search: Record<string, unknown>): { name?: string } => ({
    name: typeof search.name === "string" ? search.name.slice(0, 160) : undefined,
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { name } = Route.useSearch();
  return <ReelOSWorld initialDestination={{ type: "person", id, name }} />;
}
