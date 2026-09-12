import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { getTitle } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import { titleMatchesId } from "@/lib/sync-requests";
import { jellyfinWatchHref } from "@/lib/jellyfin-watch";

/** Opens the working Jellyfin door (LAN/Tailscale IP:8096), never hostname:8096. */

export function PlayerView({ id }: { id: string }) {
  const catalog = getTitle(id);
  const shelf = useReelStore((s) => s.shelf.find((t) => titleMatchesId(t, id)));
  const remote = useReelStore((s) => s.remoteTitles.find((t) => titleMatchesId(t, id) || t.id === id));
  const title = catalog ?? shelf ?? remote;
  const jfId = shelf?.jellyfinId;

  const ipv4 = useReelStore((s) => s.ipv4);
  const tailscaleIp = useReelStore((s) => s.tailscaleIp);
  const watch = useReelStore((s) => s.watch);

  useEffect(() => {
    const dest = jellyfinWatchHref({
      ipv4,
      tailscaleIp,
      watch,
      hostname: window.location.hostname,
      jellyfinId: jfId,
    });
    if (dest) window.location.replace(dest);
  }, [jfId, ipv4, tailscaleIp, watch]);

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
