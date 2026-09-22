import { createFileRoute } from "@tanstack/react-router";
import { Gate } from "@/components/gate";
import { PlayerView } from "@/components/player-view";

interface PlaySearch {
  season?: number;
  episode?: number;
  mediaId?: string;
}

export const Route = createFileRoute("/play/$id")({
  validateSearch: (search: Record<string, unknown>): PlaySearch => ({
    season: search.season ? Number(search.season) : undefined,
    episode: search.episode ? Number(search.episode) : undefined,
    mediaId: typeof search.mediaId === "string" && search.mediaId ? search.mediaId : undefined,
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  return (
    <Gate chrome={false} personalSetup>
      <PlayerView
        key={`${id}:${search.season ?? ""}:${search.episode ?? ""}:${search.mediaId ?? ""}`}
        id={id}
        season={search.season}
        episode={search.episode}
        mediaId={search.mediaId}
      />
    </Gate>
  );
}
