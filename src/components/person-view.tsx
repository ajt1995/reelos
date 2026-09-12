import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PresenceRow } from "@/components/presence-row";
import { rememberCatalogTitles } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import type { Title } from "@/lib/types";

type PersonPayload = {
  person?: {
    id: number;
    name: string;
    biography?: string;
    poster?: string;
    knownForDepartment?: string;
    credits?: Title[];
    onBox?: number;
  } | null;
  error?: string | null;
};

export function PersonView({ id }: { id: string }) {
  const [payload, setPayload] = useState<PersonPayload | null>(null);
  const rememberTitles = useReelStore((s) => s.rememberTitles);

  useEffect(() => {
    let stop = false;
    const ac = new AbortController();
    setPayload(null);
    void fetch(`/api/person?id=${encodeURIComponent(id)}`, { cache: "no-store", signal: ac.signal })
      .then((r) => r.json() as Promise<PersonPayload>)
      .then((j) => {
        if (stop) return;
        const credits = Array.isArray(j.person?.credits) ? j.person.credits : [];
        rememberCatalogTitles(credits);
        rememberTitles?.(credits);
        setPayload(j);
      })
      .catch((e) => {
        if (!stop) setPayload({ person: null, error: String(e?.message || e) });
      });
    return () => {
      stop = true;
      ac.abort();
    };
  }, [id, rememberTitles]);

  const person = payload?.person;
  const credits = person?.credits || [];

  return (
    <div className="px-5 pb-16 pt-4 md:px-10">
      <Link to="/" className="text-sm text-gold">
        Home
      </Link>
      {!payload ? (
        <p className="mt-8 text-sm text-muted">Loading filmography…</p>
      ) : !person ? (
        <p className="mt-8 text-sm text-danger">{payload.error || "TMDB has no person with that id."}</p>
      ) : (
        <>
          <div className="mt-5 flex items-start gap-4">
            {person.poster ? (
              <img
                src={person.poster}
                alt=""
                className="size-24 shrink-0 rounded-full object-cover shadow-[var(--shadow-border)]"
              />
            ) : (
              <div className="size-24 shrink-0 rounded-full bg-card-2" />
            )}
            <div className="min-w-0 pt-1">
              <p className="text-xs tracking-[0.18em] text-gold uppercase">
                {person.knownForDepartment === "Acting" || !person.knownForDepartment ? "Actor" : person.knownForDepartment}
              </p>
              <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">{person.name}</h1>
              <p className="mt-2 text-sm text-muted">
                {person.onBox ?? credits.filter((t) => t.inLibrary).length} of {credits.length} on this box
              </p>
            </div>
          </div>
          {person.biography ? (
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">{person.biography}</p>
          ) : null}
          {credits.length ? (
            <ul className="mt-6">
              {credits.map((t) => (
                <PresenceRow key={t.id} title={t} />
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-sm text-muted">TMDB listed no movie or show credits.</p>
          )}
        </>
      )}
    </div>
  );
}
