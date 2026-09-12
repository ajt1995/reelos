import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PresenceRow } from "@/components/presence-row";
import { rememberCatalogTitles } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import type { Title } from "@/lib/types";

type CollectionPayload = {
  collection?: {
    id: number;
    name: string;
    overview?: string;
    poster?: string;
    source?: string;
    parts?: Title[];
    onBox?: number;
  } | null;
  error?: string | null;
};

export function CollectionView({ id }: { id: string }) {
  const [payload, setPayload] = useState<CollectionPayload | null>(null);
  const rememberTitles = useReelStore((s) => s.rememberTitles);

  useEffect(() => {
    let stop = false;
    const ac = new AbortController();
    setPayload(null);
    void fetch(`/api/collection?id=${encodeURIComponent(id)}`, { cache: "no-store", signal: ac.signal })
      .then((r) => r.json() as Promise<CollectionPayload>)
      .then((j) => {
        if (stop) return;
        const parts = Array.isArray(j.collection?.parts) ? j.collection.parts : [];
        rememberCatalogTitles(parts);
        rememberTitles?.(parts);
        setPayload(j);
      })
      .catch((e) => {
        if (!stop) setPayload({ collection: null, error: String(e?.message || e) });
      });
    return () => {
      stop = true;
      ac.abort();
    };
  }, [id, rememberTitles]);

  const collection = payload?.collection;
  const parts = collection?.parts || [];

  return (
    <div className="px-5 pb-16 pt-4 md:px-10">
      <Link to="/" className="text-sm text-gold">
        Home
      </Link>
      {!payload ? (
        <p className="mt-8 text-sm text-muted">Loading collection…</p>
      ) : !collection ? (
        <p className="mt-8 text-sm text-danger">{payload.error || "TMDB has no collection with that id."}</p>
      ) : (
        <>
          <div className="mt-5 flex items-start gap-4">
            {collection.poster ? (
              <img
                src={collection.poster}
                alt=""
                className="h-36 w-24 shrink-0 rounded-xl object-cover shadow-[var(--shadow-border)]"
              />
            ) : (
              <div className="h-36 w-24 shrink-0 rounded-xl bg-card-2" />
            )}
            <div className="min-w-0 pt-1">
              <p className="text-xs tracking-[0.18em] text-gold uppercase">Collection</p>
              <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">{collection.name}</h1>
              <p className="mt-2 text-sm text-muted">
                {collection.onBox ?? parts.filter((p) => p.inLibrary).length} of {parts.length} on this box
              </p>
            </div>
          </div>
          {collection.overview ? (
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">{collection.overview}</p>
          ) : null}
          {parts.length ? (
            <ul className="mt-6">
              {parts.map((t) => (
                <PresenceRow key={t.id} title={t} />
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-sm text-muted">TMDB listed no movies in this collection.</p>
          )}
        </>
      )}
    </div>
  );
}
