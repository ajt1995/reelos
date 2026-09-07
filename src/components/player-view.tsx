import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { getTitle } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";

export function PlayerView({ id }: { id: string }) {
  const catalog = getTitle(id);
  const shelf = useReelStore((s) => s.shelf.find((t) => t.id === id));
  const remote = useReelStore((s) => s.remoteTitles.find((t) => t.id === id));
  const title = catalog ?? shelf ?? remote;
  const jfId = shelf?.jellyfinId;

  useEffect(() => {
    const host = window.location.hostname;
    const dest = jfId
      ? `http://${host}:8096/web/#/details?id=${encodeURIComponent(jfId)}`
      : `http://${host}:8096`;
    window.location.replace(dest);
  }, [jfId]);

  if (!title) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6">
        <p className="text-muted">Not in the library.</p>
        <Link to="/" className="mt-4 text-gold">
          Home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <p className="text-sm text-muted">Opening Jellyfin for {title.title}…</p>
    </div>
  );
}
