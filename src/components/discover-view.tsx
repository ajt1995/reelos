import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Row, TitleCard } from "@/components/title-card";
import { rememberCatalogTitles } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import { inFlightRequests, titleForRequest } from "@/lib/sync-requests";
import { useSyncRequests } from "@/lib/use-sync-requests";
import type { Kind, MediaRequest, Title } from "@/lib/types";
import { installHonestRequest } from "@/lib/honest-request";

function isKind(t: Title | undefined, want: Kind) {
  if (!t) return false;
  if (want === "tv") return t.kind === "tv" || t.kind === "anime";
  return t.kind === "movie";
}

export function DiscoverView() {
  const [q, setQ] = useState("");
  const [remoteHits, setRemoteHits] = useState<Title[]>([]);
  const [looking, setLooking] = useState(false);
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const [browseMovies, setBrowseMovies] = useState<Title[]>([]);
  const [browseTv, setBrowseTv] = useState<Title[]>([]);
  const [browseErr, setBrowseErr] = useState<string | null>(null);
  const [browseReady, setBrowseReady] = useState(false);
  const rememberTitles = useReelStore((s) => s.rememberTitles);
  const hydrateShelf = useReelStore((s) => s.hydrateShelf);
  const shelf = useReelStore((s) => s.shelf);
  const remoteTitles = useReelStore((s) => s.remoteTitles);
  const requests = useReelStore((s) => s.requests);
  const catalog = useMemo(() => [...shelf, ...remoteTitles], [shelf, remoteTitles]);
  const inflight = inFlightRequests(requests, { titles: shelf });
  useSyncRequests();

  useEffect(() => {
    installHonestRequest();
  }, []);

  useEffect(() => {
    hydrateShelf({ limit: 24 });
  }, [hydrateShelf]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/discover", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`discover ${res.status}`);
        return res.json() as Promise<{ movies?: Title[]; tv?: Title[]; error?: string | null }>;
      })
      .then((r) => {
        if (cancelled) return;
        const movies = Array.isArray(r?.movies) ? r.movies : [];
        const tv = Array.isArray(r?.tv) ? r.tv : [];
        rememberCatalogTitles([...movies, ...tv]);
        rememberTitles?.([...movies, ...tv]);
        setBrowseMovies(movies);
        setBrowseTv(tv);
        setBrowseErr(movies.length || tv.length ? null : r?.error || null);
        setBrowseReady(true);
      })
      .catch((e) => {
        if (!cancelled) {
          setBrowseMovies([]);
          setBrowseTv([]);
          setBrowseErr(String(e));
          setBrowseReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [rememberTitles]);

  const hits = useMemo(() => {
    const seen = new Set<string>();
    const out: Title[] = [];
    for (const t of remoteHits) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
    return out;
  }, [remoteHits]);

  const movieShelf = useMemo(() => shelf.filter((t) => isKind(t, "movie")).slice(0, 24), [shelf]);
  const tvShelf = useMemo(() => shelf.filter((t) => isKind(t, "tv")).slice(0, 24), [shelf]);
  const finishing = useMemo(() => {
    const rows: { r: MediaRequest; t: Title }[] = [];
    for (const r of inflight) {
      const t = titleForRequest(r, catalog);
      if (!t?.id) continue;
      rows.push({ r, t });
    }
    return rows;
  }, [inflight, catalog]);
  const finishingMovies = finishing.filter((x) => isKind(x.t, "movie")).slice(0, 12);
  const finishingTv = finishing.filter((x) => isKind(x.t, "tv")).slice(0, 12);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setRemoteHits([]);
      setLookupErr(null);
      setLooking(false);
      return;
    }
    setLooking(true);
    setLookupErr(null);
    let cancelled = false;
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void fetch(`/api/lookup?q=${encodeURIComponent(term)}`, { cache: "no-store", signal: ac.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error(`lookup ${res.status}`);
          return res.json() as Promise<{ titles?: Title[]; error?: string | null }>;
        })
        .then((r) => {
          if (cancelled) return;
          const titles = Array.isArray(r?.titles) ? r.titles : [];
          rememberCatalogTitles(titles);
          rememberTitles?.(titles);
          setRemoteHits(titles);
          setLookupErr(titles.length ? null : r?.error || "Seerr returned no titles");
          setLooking(false);
        })
        .catch((e) => {
          if (cancelled || e?.name === "AbortError") return;
          setRemoteHits([]);
          setLookupErr(String(e?.name === "AbortError" ? "Seerr lookup timed out. Try the search again." : e));
          setLooking(false);
        });
    }, 280);
    return () => {
      cancelled = true;
      ac.abort();
      window.clearTimeout(t);
    };
  }, [q, rememberTitles]);

  return (
    <div className="px-5 py-6 md:px-10 md:py-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Discover</h1>
      <p className="mt-2 text-sm text-muted">On this box, finishing, or pick tonight. Search to find something else.</p>
      <div className="relative mt-6 max-w-xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a title"
          className="h-12 w-full rounded-2xl bg-card pl-11 pr-4 text-sm shadow-[var(--shadow-border)] placeholder:text-faint"
        />
      </div>
      {q.trim().length >= 2 ? (
        hits.length > 0 ? (
          <Row label="Results">
            {hits.map((t) => (
              <TitleCard key={t.id} title={t} />
            ))}
          </Row>
        ) : looking ? (
          <p className="mt-10 text-sm text-muted">Looking up movies and shows…</p>
        ) : (
          <p className="mt-10 text-sm text-muted">
            {lookupErr || "No titles from Seerr for that search."}
          </p>
        )
      ) : (
        <>
          <DiscoverKind
            heading="Movies"
            onBox={movieShelf}
            finishing={finishingMovies}
            pick={browseMovies}
          />
          <DiscoverKind heading="Shows" onBox={tvShelf} finishing={finishingTv} pick={browseTv} />
          {browseMovies.length === 0 &&
          browseTv.length === 0 &&
          movieShelf.length === 0 &&
          tvShelf.length === 0 &&
          finishing.length === 0 ? (
            <p className="mt-10 text-sm text-muted">
              {browseErr ||
                (browseReady ? "Seerr has nothing new to show yet." : "Looking up movies and shows…")}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function DiscoverKind({
  heading,
  onBox,
  finishing,
  pick,
}: {
  heading: string;
  onBox: Title[];
  finishing: { r: MediaRequest; t: Title }[];
  pick: Title[];
}) {
  if (!onBox.length && !finishing.length && !pick.length) return null;
  return (
    <div className="mt-10">
      <h2 className="font-display text-xl font-semibold tracking-tight">{heading}</h2>
      {onBox.length ? (
        <Row label="On this box">
          {onBox.map((t) => (
            <TitleCard key={t.id} title={t} />
          ))}
        </Row>
      ) : null}
      {finishing.length ? (
        <Row label="Finishing">
          {finishing.map(({ r, t }) => (
            <TitleCard key={r.id} title={t} request={r} />
          ))}
        </Row>
      ) : null}
      {pick.length ? (
        <Row label="Pick tonight">
          {pick.map((t) => (
            <TitleCard key={t.id} title={t} />
          ))}
        </Row>
      ) : null}
    </div>
  );
}
