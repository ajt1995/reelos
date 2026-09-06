import { createFileRoute } from "@tanstack/react-router";
import { Gate } from "@/components/gate";
import { LibraryView } from "@/components/library-view";

export const Route = createFileRoute("/library")({ component: Page });

function Page() {
  return (
    <Gate>
      <LibraryView />
    </Gate>
  );
}
