import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Row, TitleCard } from "@/components/title-card";
import { HOSTNAME, rememberCatalogTitles } from "@/lib/catalog";
import { getTitle, searchTitles, TITLES } from "@/lib/catalog";
import { titleInCache } from "@/lib/adapter";
import { frontendLabel, sourceLabel, useReelStore } from "@/lib/store";
import type { Title } from "@/lib/types";
import { cn } from "@/lib/utils";

export function HomeView() {
  const [q, setQ] = useState("");
  const [remoteHits, setRemoteHits] = useState<Title[]>([]);
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const [watchUrl, setWatchUrl] = useState("");
  useEffect(() => {
    void fetch("/api/box", { cache: "no-store" })
      .then((r) => r.json())
      .then((b: { watch?: string }) => {
        if (b.watch) setWatchUrl(b.watch);
      })
      .catch(() => {});
  }, []);
  const rememberTitles = useReelStore((s) =>
    "rememberTitles" in s ? (s as { rememberTitles?: (t: Title[]) => void }).rememberTitles : undefined,
  );
  const navigate = useNavigate();
  const requests = useReelStore((s) => s.requests);
  const library = useReelStore((s) => s.library);
  const watch = useReelStore((s) => s.watchProgress);
  const frontend = useReelStore((s) => s.answers.frontend);
  const source = useReelStore((s) => s.answers.source);
  const adapter = useReelStore((s) => s.adapter);
  const intent = useReelStore((s) => s.answers.intent);
  const downloading = requests.filter((r) => r.status === "downloading").length;

  const catalogHits = useMemo(() => (q.trim().length >= 2 ? searchTitles(q) : []), [q]);
  const hits = useMemo(() => {
    const seen = new Set<string>();
    const out: Title[] = [];
    for (const t of [...remoteHits, ...catalogHits]) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
    return out;
  }, [catalogHits, remoteHits]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setRemoteHits([]);
      setLookupErr(null);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void fetch(`/api/lookup?q=${encodeURIComponent(term)}`, { cache: "no-store" })
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
          setLookupErr(r?.error || (titles.length ? null : "Engine returned no titles"));
        })
        .catch((e) => {
          if (!cancelled) {
            setRemoteHits([]);
            setLookupErr(String(e));
          }
        });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q, rememberTitles]);

  const reqCards = requests
    .map((r) => ({ r, t: getTitle(r.titleId) }))
    .filter((x) => x.t)
    .slice(0, 12);

  const continueWatch = Object.entries(watch)
    .filter(([, v]) => v > 0.03 && v < 0.96)
    .map(([id, v]) => ({ t: getTitle(id), v }))
    .filter((x) => x.t && library.includes(x.t.id));

  const discover = TITLES.filter((t) => {
    if (t.kind === "anime" && !intent.anime) return false;
    if (t.kind === "kids" && !intent.kids) return false;
    if (t.kind === "music" && !intent.music) return false;
    if (t.kind === "movie" && !intent.movies) return false;
    if (t.kind === "tv" && !intent.tv) return false;
    return !library.includes(t.id);
  }).slice(0, 14);

  const cachedNow =
    source === "local-vpn"
      ? []
      : TITLES.filter((t) => titleInCache(t) && !library.includes(t.id) && !requests.some((r) => r.titleId === t.id)).slice(
          0,
          10,
        );

  return (
    <div className="px-5 pb-12 pt-2 md:px-10 md:pt-8">
      {watchUrl && (frontend === "jellyfin" || frontend === "both") ? (
        <a
          href={watchUrl}
          target="_blank"
          rel="noreferrer"
          className="mb-4 inline-flex h-11 items-center rounded-full bg-gold px-5 text-sm font-medium text-gold-fg"
        >
          Watch in this browser
        </a>
      ) : null}
      <form
        className="relative mx-auto block w-full max-w-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (hits[0]) void navigate({ to: "/title/$id", params: { id: hits[0].id } });
        }}
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search movies, shows, music"
          className="h-14 w-full rounded-2xl bg-card pl-12 pr-4 text-base shadow-[var(--shadow-border)] placeholder:text-faint"
        />
        {hits.length > 0 ? (
          <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
            {hits.slice(0, 6).map((t) => (
              <li key={t.id}>
                <Link
                  to="/title/$id"
                  params={{ id: t.id }}
                  className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-foreground/5"
                  onClick={() => setQ("")}
                >
                  <img src={t.poster} alt="" className="h-10 w-7 rounded object-cover" />
                  <span className="flex-1 truncate">{t.title}</span>
                  <span className="text-xs text-muted">{t.year}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : q.trim().length >= 2 ? (
          <p className="mt-2 text-xs text-muted">
            {lookupErr ?? "Looking up through the movie engine…"}
          </p>
        ) : null}
      </form>

      <div className="mt-5 flex flex-wrap gap-2">
        <Chip live>
          {frontendLabel[frontend]} live
        </Chip>
        <Chip live={adapter.status === "healthy"}>
          {sourceLabel[source]}
          {adapter.status === "healthy" ? " live" : ""}
        </Chip>
        <Chip>{HOSTNAME}</Chip>
        {downloading > 0 ? <Chip gold>{downloading} transferring</Chip> : <Chip>Library idle</Chip>}
      </div>

      {continueWatch.length > 0 ? (
        <Row label="Continue">
          {continueWatch.map(({ t, v }) =>
            t ? <TitleCard key={t.id} title={t} progress={v} /> : null,
          )}
        </Row>
      ) : null}

      {reqCards.length > 0 ? (
        <Row label="Your requests">
          {reqCards.map(({ r, t }) =>
            t ? <TitleCard key={r.id} title={t} request={r} /> : null,
          )}
        </Row>
      ) : null}

      {cachedNow.length > 0 ? (
        <Row label={`Cached on ${sourceLabel[source]}`}>
          {cachedNow.map((t) => (
            <TitleCard key={t.id} title={t} />
          ))}
        </Row>
      ) : null}

      <Row label="Discover">
        {discover.map((t) => (
          <TitleCard key={t.id} title={t} />
        ))}
      </Row>
    </div>
  );
}

function Chip({
  children,
  live,
  gold,
}: {
  children: React.ReactNode;
  live?: boolean;
  gold?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full bg-card px-3 text-xs text-muted shadow-[var(--shadow-border)]",
        gold && "text-gold",
        live && "text-live",
      )}
    >
      {live ? <span className="size-1.5 rounded-full bg-live" /> : null}
      {children}
    </span>
  );
}
