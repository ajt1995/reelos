import { createFileRoute } from "@tanstack/react-router";
import { DiscoverBrowseView } from "@/components/discover-browse-view";

export const Route = createFileRoute("/discover/movies")({
  validateSearch: (search: Record<string, unknown>) => ({
    genre: typeof search.genre === "string" ? search.genre : "",
    category: typeof search.category === "string" ? search.category : "popular",
  }),
  component: Page,
});

function Page() {
  const { genre, category } = Route.useSearch();
  return <DiscoverBrowseView kind="movie" genre={genre} category={category} />;
}
