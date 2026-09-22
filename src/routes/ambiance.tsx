import { createFileRoute } from "@tanstack/react-router";
import { LaterReleaseView } from "@/components/later-release-view";

export const Route = createFileRoute("/ambiance")({ component: Page });

function Page() {
  return (
    <LaterReleaseView
      title="Room ambiance is not available yet."
      detail="Connected lights and phone-guided room sound tuning are planned beyond the current household release. The approved standby artwork experience remains separate and unchanged."
    />
  );
}
