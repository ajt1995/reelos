import { createFileRoute } from "@tanstack/react-router";
import { BooksView } from "@/components/books-view";
import { Gate } from "@/components/gate";

export const Route = createFileRoute("/books")({ component: Page });

function Page() {
  return (
    <Gate>
      <BooksView />
    </Gate>
  );
}
