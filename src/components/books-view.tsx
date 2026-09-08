import { useReelStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";

export function BooksView() {
  const intent = useReelStore((s) => s.answers.intent);

  if (!intent.books) {
    return (
      <div className="px-5 py-8 md:px-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Books</h1>
        <p className="mt-4 text-sm text-muted">Books are not enabled on this ReelOS box.</p>
      </div>
    );
  }

  const kavitaUrl = typeof window !== "undefined" ? `http://${window.location.hostname}:5000` : "#";

  return (
    <div className="px-5 py-8 md:px-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Books</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Your books library is managed by Kavita. Open it to browse, read, and manage your collection.
      </p>

      <div className="mt-8 rounded-2xl bg-card px-5 py-6 shadow-[var(--shadow-border)]">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-gold/10 text-gold">
            <BookOpen className="size-6" />
          </div>
          <div>
            <p className="font-display text-lg font-medium">Kavita Library</p>
            <p className="text-sm text-muted">Browse and read your books</p>
          </div>
        </div>
        
        <div className="mt-6">
          <a href={kavitaUrl} target="_blank" rel="noreferrer">
            <Button size="lg" className="w-full sm:w-auto">
              Open Kavita
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
