import { Link } from "@tanstack/react-router";
import { Bookmark, ChevronRight, Compass, Play, Search, Sparkles } from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import { getTitle, TITLES } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import type { Title } from "@/lib/types";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function artwork(title?: Title | null) {
  return title?.backdrop || title?.poster || "";
}

function cardArt(title: Title) {
  return title.poster || title.backdrop || "";
}

export function HomeCanvas() {
  const shelf = useReelStore((s) => s.shelf);
  const remoteTitles = useReelStore((s) => s.remoteTitles);
  const watchProgress = useReelStore((s) => s.watchProgress);
  const residents = useReelStore((s) => s.residents);
  const activeResidentId = useReelStore((s) => s.activeResidentId);
  const toggleWatchlist = useReelStore((s) => s.toggleWatchlist);

  const resident = residents.find((item) => item.id === activeResidentId) ?? residents[0];
  const catalog = useMemo(() => {
    const seen = new Set<string>();
    return [...shelf, ...remoteTitles, ...TITLES].filter((title) => {
      if (seen.has(title.id)) return false;
      seen.add(title.id);
      return true;
    });
  }, [remoteTitles, shelf]);

  const continueWatching = useMemo(
    () => Object.entries(watchProgress)
      .filter(([, progress]) => progress > 0.03 && progress < 0.96)
      .map(([id, progress]) => ({ title: catalog.find((item) => item.id === id) ?? getTitle(id), progress }))
      .filter((item): item is { title: Title; progress: number } => Boolean(item.title)),
    [catalog, watchProgress],
  );

  const hero = continueWatching[0]?.title ?? catalog[0] ?? TITLES[0];
  const saved = new Set(resident?.watchlist ?? []);
  const nextUp = catalog.filter((title) => title.id !== hero?.id).slice(0, 6);
  const progress = continueWatching[0]?.progress;

  return (
    <main className="canvas-home">
      <section className="canvas-stage">
        {artwork(hero) ? (
          <div className="canvas-stage-art" style={{ backgroundImage: `url(${artwork(hero)})` }} />
        ) : null}
        <div className="canvas-stage-wash" />

        <div className="canvas-stage-top">
          <div className="canvas-kicker"><span /> The living room</div>
          <div className="canvas-search-hint"><Search className="size-4" /> Search anything</div>
        </div>

        <div className="canvas-stage-copy">
          <p className="canvas-greeting">{greeting()}{resident?.name ? `, ${resident.name}` : ""}.</p>
          <p className="canvas-eyebrow">{progress ? "Ready when you are" : "A little escape, waiting"}</p>
          <h1>{hero?.title ?? "Your cinema is ready"}</h1>
          <p className="canvas-summary">
            {hero?.overview || "A home for the stories your household will remember."}
          </p>

          <div className="canvas-actions">
            {hero ? (
              <Link to="/play/$id" params={{ id: hero.id }} className="canvas-primary-action">
                <Play className="size-4 fill-current" /> {progress ? "Continue" : "Play tonight"}
              </Link>
            ) : null}
            {hero ? (
              <button type="button" className="canvas-save-action" onClick={() => toggleWatchlist(hero.id)}>
                <Bookmark className={saved.has(hero.id) ? "size-4 fill-current" : "size-4"} />
                {saved.has(hero.id) ? "Saved" : "Save for later"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="canvas-stage-foot">
          <div>
            <span>{hero?.year}</span>
            {hero?.genres?.slice(0, 2).map((genre) => <span key={genre}>• {genre}</span>)}
          </div>
          <Link to="/title/$id" params={{ id: hero.id }} className="canvas-details-link">
            About this film <ChevronRight className="size-4" />
          </Link>
        </div>
      </section>

      <section className="canvas-room">
        <div className="canvas-room-heading">
          <div>
            <p className="canvas-overline">For this room</p>
            <h2>What feels right now?</h2>
          </div>
          <Link to="/discover" className="canvas-text-link">Explore everything <ChevronRight className="size-4" /></Link>
        </div>

        <div className="canvas-moods">
          <Link to="/discover" search={{}} className="canvas-mood-card canvas-mood-warm">
            <Sparkles className="size-5" /><span>Easy & familiar</span><small>Comfort viewing</small>
          </Link>
          <Link to="/discover/movies" search={{ genre: "", category: "popular" }} className="canvas-mood-card canvas-mood-night">
            <Compass className="size-5" /><span>Something new</span><small>Make a discovery</small>
          </Link>
          <Link to="/library" className="canvas-mood-card canvas-mood-library">
            <Bookmark className="size-5" /><span>Already yours</span><small>From your collection</small>
          </Link>
        </div>

        <div className="canvas-room-heading canvas-next-heading">
          <div>
            <p className="canvas-overline">Keep nearby</p>
            <h2>Next on the shelf</h2>
          </div>
          <Link to="/library" className="canvas-text-link">Your library <ChevronRight className="size-4" /></Link>
        </div>

        <div className="canvas-shelf" aria-label="Next on the shelf">
          {nextUp.map((title, index) => (
            <Link key={title.id} to="/title/$id" params={{ id: title.id }} className="canvas-poster" style={{ "--delay": `${index * 45}ms` } as CSSProperties}>
              {cardArt(title) ? <img src={cardArt(title)} alt="" /> : <span className="canvas-poster-empty">{title.title.slice(0, 1)}</span>}
              <span className="canvas-poster-shade" />
              <span className="canvas-poster-meta"><b>{title.title}</b><small>{title.year}</small></span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
