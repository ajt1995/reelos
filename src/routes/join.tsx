import { createFileRoute } from "@tanstack/react-router";
import { GuestJoinView } from "@/components/guest-join-view";
import { HouseholdGateView } from "@/components/household-gate-view";

export const Route = createFileRoute("/join")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: JoinPage,
});

function JoinPage() {
  const { token } = Route.useSearch();
  if (token) {
    return <HouseholdGateView />;
  }
  return <GuestJoinView />;
}
