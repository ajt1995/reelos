import { createFileRoute } from "@tanstack/react-router";
import { ReelOSWorld } from "@/experience/reelos-world";

export const Route = createFileRoute("/party")({
  component: WatchPartyPage,
});

function WatchPartyPage() {
  return <ReelOSWorld initialView="party" />;
}
