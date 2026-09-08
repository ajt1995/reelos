import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Play, Plus } from "lucide-react";
import { Poster } from "@/components/poster";
import { Button } from "@/components/ui/button";
import { cacheCopy } from "@/lib/adapter";
import { getTitle, kindLabel } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import { formatRuntime } from "@/lib/utils";

export function TitleView({ id }: { id: string }) {
  const catalog = getTitle(id);
  const remote = useReelStore((s) => s.remoteTitles.find((t) => t.id === id));
  const title = catalog ?? remote;
  const request = useReelStore((s) =>
    s.requests.find((r) => r.titleId === id && r.status !== "failed"),
  );
  const failed = useReelStore((s) =>
    s.requests.find((r) => r.titleId === id && r.status === "failed"),
  );
  const inLibrary = useReelStore((s) => s.library.includes(id));
  const intent = useReelStore((s) => s.answers.intent);
  const source = useReelStore((s) => s.answers.source);
  const requestTitle = useReelStore((s) => s.requestTitle);
  const pasteRelease = useReelStore((s) => s.pasteRelease);
  const [season, setSeason] = useState(1);
  const [hash, setHash] = useState("");
  const [hashErr, setHashErr] = useState(false);
  const [reqErr, setReqErr] = useState<string | null>(null);
  const [inJellyfin, setInJellyfin] = useState(false);
  const [engineStatus, setEngineStatus] = useState<string | null>(null);
  useEffect(() => {
    void fetch("/api/library", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ titles?: { id: string; ids?: string[] }[] }>)
      .then((j) =>
        setInJellyfin(
          (j.titles || []).some((t) => t.id === id || (t.ids || []).includes(id)),
        ),
      )
      .catch(() => {});
    const q = id.startsWith("tmdb-")
      ? `tmdb=${id.slice(5)}`
      : id.startsWith("tvdb-")
        ? `tvdb=${id.slice(5)}`
        : `id=${encodeURIComponent(id)}`;
    void fetch(`/api/request?${q}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<{ status?: string }>)
      .then((j) => setEngineStatus(j.status || null))
      .catch(() => {});
  }, [id]);

  const sendRequest = (payload: { titleId: string; season?: number; hash?: string }) => {
    setReqErr(null);
    void fetch("/api/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titleId: payload.titleId,
        title: title?.title,
        tmdb: payload.titleId.startsWith("tmdb-") ? payload.titleId.slice(5) : undefined,
        tvdb: payload.titleId.startsWith("tvdb-") ? payload.titleId.slice(5) : undefined,
        season: payload.season,
        hash: payload.hash,
      }),
    })
      .then((r) => r.json())
      .then((j: { ok?: boolean; error?: string }) => {
        if (!j.ok) setReqErr(j.error || "Engine did not add the title");
      })
      .catch((e) => setReqErr(String(e)));
  };

  if (!title) {
    return (
      <div className="px-6 py-16">
        <p className="text-muted">That title is not in the catalog.</p>
        <Link to="/" className="mt-4 inline-block text-gold">
          Home
        </Link>
      </div>
    );
  }

  const jellyfin = typeof window !== "undefined" ? `http://${window.location.hostname}:8096` : "";
  const available =
    inJellyfin ||
    inLibrary ||
    request?.status === "available" ||
    engineStatus === "downloaded";
  const blocked =
    (title.kind === "music" && !intent.music) ||
    (title.kind === "book" && !intent.books) ||
    (title.kind === "anime" && !intent.anime) ||
    (title.kind === "kids" && !intent.kids) ||
    (title.kind === "movie" && !intent.movies) ||
    (title.kind === "tv" && !intent.tv);

  return (
    <div className="pb-16">
      <div className="relative min-h-[280px] overflow-hidden md:min-h-[360px]">
        <img
          src={title.poster}
          alt=""
          className="absolute inset-0 size-full object-cover opacity-40 kenburns"
        />
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/70 to-background/20" />
      </div>
      <div className="relative z-10 mx-auto -mt-40 grid max-w-5xl gap-8 px-5 md:-mt-48 md:grid-cols-[200px_1fr] md:px-10">
        <Poster title={title} className="mx-auto w-[180px] rounded-2xl md:w-auto" />
        <div className="pt-2">
          <p className="text-xs tracking-[0.18em] text-gold uppercase">{kindLabel(title.kind)}</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">{title.title}</h1>
          <p className="mt-2 text-sm text-muted">
            {title.year}
            {title.runtime ? ` · ${formatRuntime(title.runtime)}` : null}
            {title.seasons ? ` · ${title.seasons} seasons` : null}
            {title.tracks ? ` · ${title.tracks} tracks` : null}
            {` · ${title.rating.toFixed(1)}`}
            {title.director ? ` · ${title.director}` : null}
          </p>
          <p className="mt-2 text-xs text-faint">{title.genres.join(" · ")}</p>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">{title.overview}</p>
          {!available && !blocked && !request ? (
            <p className="mt-4 text-sm text-gold">{cacheCopy(title, source)}</p>
          ) : null}

          {title.kind === "tv" || title.kind === "anime" ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {Array.from({ length: title.seasons ?? 1 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSeason(n)}
                  className={
                    season === n
                      ? "h-9 rounded-full bg-gold px-3 text-xs text-gold-fg"
                      : "h-9 rounded-full bg-card px-3 text-xs text-muted shadow-[var(--shadow-border)]"
                  }
                >
                  Season {n}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            {available ? (
              <a href={jellyfin} target="_blank" rel="noreferrer">
                <Button size="lg">
                  <Play className="size-4" fill="currentColor" />
                  Play in Jellyfin
                </Button>
              </a>
            ) : (
              <Button size="lg" disabled>
                <Play className="size-4" />
                Available after request
              </Button>
            )}
            {available ? (
              <span className="inline-flex h-12 items-center gap-2 rounded-2xl bg-success/10 px-4 text-sm text-success">
                <Check className="size-4" />
                In library
              </span>
            ) : blocked ? (
              <p className="self-center text-sm text-muted">
                This collection is off. Enable it in Settings.
              </p>
            ) : request?.status === "downloading" ? (
              <span className="inline-flex h-12 items-center rounded-2xl bg-card px-4 text-sm text-gold">
                {request.via === "cache"
                  ? "Cache hit · importing"
                  : "Grabbing"}
              </span>
            ) : request?.status === "waiting" ? (
              <span className="inline-flex h-12 items-center rounded-2xl bg-card px-4 text-sm text-muted">
                {request.via === "uncached" ? "No cache · looking for a transfer" : "Waiting for a release"}
              </span>
            ) : (
              <Button
                variant="ghost"
                size="lg"
                onClick={() => {
                  requestTitle(
                    title.id,
                    title.kind === "tv" || title.kind === "anime" ? season : undefined,
                  );
                  sendRequest({
                    titleId: title.id,
                    season: title.kind === "tv" || title.kind === "anime" ? season : undefined,
                  });
                }}
              >
                <Plus className="size-4" />
                Request
              </Button>
            )}
          </div>
          {failed ? (
            <p className="mt-4 text-sm text-danger">{failed.reason}</p>
          ) : null}
          {reqErr ? <p className="mt-4 text-sm text-danger">{reqErr}</p> : null}

          {!available && !blocked ? (
            <form
              className="mt-6 max-w-md"
              onSubmit={(e) => {
                e.preventDefault();
                const ok = pasteRelease(title.id, hash);
                setHashErr(!ok);
                if (ok) {
                  setHash("");
                  sendRequest({ titleId: title.id, hash });
                }
              }}
            >
              <p className="text-xs tracking-[0.16em] text-faint uppercase">Hand a hash to the adapter</p>
              <p className="mt-1 text-sm text-muted">
                Request asks the provider first. Paste only a hash you already have. Nothing is seeded.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  value={hash}
                  onChange={(e) => {
                    setHash(e.target.value);
                    setHashErr(false);
                  }}
                  placeholder="Magnet or 40-character infohash"
                  className="h-11 flex-1 rounded-2xl bg-card px-4 text-sm shadow-[var(--shadow-border)] outline-none"
                />
                <Button type="submit" variant="ghost" size="lg">
                  Send
                </Button>
              </div>
              {hashErr ? <p className="mt-2 text-sm text-danger">That is not a hash or magnet.</p> : null}
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
