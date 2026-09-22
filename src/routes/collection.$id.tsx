import { createFileRoute } from "@tanstack/react-router";
import { ReelOSWorld } from "@/experience/reelos-world";

export const Route = createFileRoute("/collection/$id")({
  validateSearch: (search: Record<string, unknown>): { name?: string; titles?: string } => ({
    name: typeof search.name === "string" ? search.name.slice(0, 160) : undefined,
    titles: typeof search.titles === "string" ? search.titles.slice(0, 1800) : undefined,
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { name, titles } = Route.useSearch();
  return <ReelOSWorld initialDestination={{
    type: "collection",
    id,
    name,
    titleIds: titles?.split(",").filter(Boolean).slice(0, 80),
  }} />;
}
