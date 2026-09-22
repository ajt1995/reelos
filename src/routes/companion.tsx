import { createFileRoute } from "@tanstack/react-router";
import { ReelOSWorld } from "@/experience/reelos-world";
import { parseCompanionDeepLink } from "@/experience/companion-deep-link";

interface CompanionSearch {
  id?: string;
  season?: number;
  episode?: number;
}

export const Route = createFileRoute("/companion")({
  validateSearch: (search: Record<string, unknown>): CompanionSearch =>
    parseCompanionDeepLink(search) || {},
  component: Page,
});

function Page() {
  const search = Route.useSearch();
  const companionLink = parseCompanionDeepLink(search);
  return (
    <ReelOSWorld
      initialView="companion"
      initialCompanionLink={companionLink}
    />
  );
}
