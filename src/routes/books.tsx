import { createFileRoute } from "@tanstack/react-router";
import { BooksView } from "@/components/books-view";
import { Gate } from "@/components/gate";

export const Route = createFileRoute("/books")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: Page,
});

function Page() {
  return (
    <Gate>
      <BooksView />
    </Gate>
  );
}
