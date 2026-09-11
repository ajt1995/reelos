import { createFileRoute } from "@tanstack/react-router";
import { Gate } from "@/components/gate";
import { BooksView } from "@/components/books-view";

export const Route = createFileRoute("/books")({ component: Page });

function Page() {
  return (
    <Gate>
      <BooksView />
    </Gate>
  );
}
