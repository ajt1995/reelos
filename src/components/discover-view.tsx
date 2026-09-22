import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, ChevronRight, Cloud, Play, Sparkles, Plus, Flame, X, Check, Clock, LoaderCircle } from "lucide-react";
import { Row, TitleCard } from "@/components/title-card";
import { getTitle, rememberCatalogTitles } from "@/lib/catalog";
import { filterCuratorHidden, titleIsCuratorLiked, type CuratorVote } from "@/lib/discover-curator";
import { filterDiscoverCatalog } from "@/lib/discover-owned";
import { useCurator } from "@/lib/use-curator";
import { CuratorStatus } from "@/components/curator-status";
import { useReelStore } from "@/lib/store";
import { collapseHomeRequestCards, homeInFlightRequests, isGhostRequestLabel, titleForRequest, titleMatchesId, getMediaLifecycleState } from "@/lib/sync-requests";
import { useResolveGhostRequestTitles, useSyncRequests } from "@/lib/use-sync-requests";
import type { CollectionHit, Kind, MediaRequest, PersonHit, Title } from "@/lib/types";
import { installHonestRequest } from "@/lib/honest-request";
import { postTitleRequest, requestBodyForTitle } from "@/lib/door-request";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

function personRouteId(p: PersonHit) {
  return String(p.tmdbId || p.id).replace(/^person-/, "");
}

function collectionRouteId(c: CollectionHit) {
  return String(c.tmdbId || c.id).replace(/^collection-/, "");
}

function isKind(t: Title | undefined, want: Kind) {
  if (!t) return false;
  if (want === "tv") return t.kind === "tv" || t.kind === "anime";
  return t.kind === "movie";
}

export function DiscoverView() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [remoteHits, setRemoteHits] = useState<Title[]>([]);
  const [peopleHits, setPeopleHits] = useState<PersonHit[]>([]);
  const [collectionHits, setCollectionHits] = useState<CollectionHit[]>([]);
  const [looking, setLooking] = useState(false);
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const [browseMovies, setBrowseMovies] = useState<Title[]>([]);
  const [browseTv, setBrowseTv] = useState<Title[]>([]);
  const [browseErr, setBrowseErr] = useState<string | null>(null);
  const [browseReady, setBrowseReady] = useState(false);
  const curator = useCurator();
  const { hiddenIds, likedIds, voteTitle } = curator;
  const booksOn = useReelStore((s) => s.settings.betaChannel);
  const [bookFeatured, setBookFeatured] = useState<
    { id: string; title: string; author: string; year?: number | null; source: string; downloadUrl: string }[]
  >([]);
  const rememberTitles = useReelStore((s) => s.rememberTitles);
  const hydrateShelf = useReelStore((s) => s.hydrateShelf);
  const shelf = useReelStore((s) => s.shelf);
  const remoteTitles = useReelStore((s) => s.remoteTitles);
  const requests = useReelStore((s) => s.requests);
  const requestTitle = useReelStore((s) => s.requestTitle);
  const residents = useReelStore((s) => s.residents);
  const activeResidentId = useReelStore((s) => s.activeResidentId);
  const kidsTitleIds = useReelStore((s) => s.kidsTitleIds);
  const activeResident =
    residents.find((r) => r.id === activeResidentId) ??
    residents[0] ?? { name: "Living Room" };
  const isKidsProfile = Boolean(activeResident?.isKids);
  const hideKids = Boolean(activeResident?.hideKidsContent);

  const isKidTitle = (t: Title) => {
    const id = String(t.id || t.jellyfinId || "");
    if (kidsTitleIds.includes(id)) return true;
    const genres = (t.genres || []).map((g) => g.toLowerCase());
    return (
      genres.includes("animation") ||
      genres.includes("family") ||
      genres.includes("children") ||
      t.kind === "kids"
    );
  };

  const catalog = useMemo(() => [...shelf, ...remoteTitles], [shelf, remoteTitles]);
  const inflight = homeInFlightRequests(requests, { titles: shelf });
  useSyncRequests();
  useResolveGhostRequestTitles(inflight, catalog);

  useEffect(() => {
    installHonestRequest();
  }, []);

  useEffect(() => {
    hydrateShelf({ limit: 24, force: true });
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

  useEffect(() => {
    if (!booksOn) {
      setBookFeatured([]);
      return;
    }
    let cancelled = false;
    void fetch("/api/books/discover", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ featured?: typeof bookFeatured }>)
      .then((j) => {
        if (cancelled) return;
        setBookFeatured(Array.isArray(j.featured) ? j.featured : []);
      })
      .catch(() => {
        if (!cancelled) setBookFeatured([]);
      });
    return () => {
      cancelled = true;
    };
  }, [booksOn]);

  const [curatedFeed, setCuratedFeed] = useState<{
    dinnerWatches?: Title[];
    mindBenders?: Title[];
    forgottenClassics?: Title[];
    pageToScreen?: Title[];
    vibeShelf?: Title[];
    vibeTitle?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/curator/feed?profileId=${encodeURIComponent(activeResidentId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.ok && data.feed) {
          setCuratedFeed(data.feed);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeResidentId]);

  const voteDiscover = (title: Title, vote: "like" | "dislike" | "comfort" | "none") => {
    // Discover Like boosts similar; Not interested hides. Home/Library stay.
    voteTitle(title, vote);
    if (vote === "like" || vote === "comfort") {
      void fetch("/api/discover", { cache: "no-store" })
        .then((res) => res.json() as Promise<{ movies?: Title[]; tv?: Title[] }>)
        .then((r) => {
          const movies = Array.isArray(r?.movies) ? r.movies : [];
          const tv = Array.isArray(r?.tv) ? r.tv : [];
          rememberCatalogTitles([...movies, ...tv]);
          rememberTitles?.([...movies, ...tv]);
          setBrowseMovies(movies);
          setBrowseTv(tv);
        })
        .catch(() => {});
    }
  };

  const inFlightRequestIds = useMemo(() => {
    return new Set(inflight.map((r) => r.titleId).concat(requests.map((r) => r.titleId)));
  }, [inflight, requests]);
  const skipIds = useMemo(() => [...inFlightRequestIds, ...hiddenIds], [inFlightRequestIds, hiddenIds]);
  const pickMovies = useMemo(() => {
    const filtered = filterCuratorHidden(filterDiscoverCatalog(browseMovies, shelf, skipIds, requests), hiddenIds);
    if (isKidsProfile) return filtered.filter(isKidTitle);
    if (hideKids) return filtered.filter((t) => !isKidTitle(t));
    return filtered;
  }, [browseMovies, shelf, skipIds, requests, hiddenIds, isKidsProfile, hideKids, kidsTitleIds]);

  const pickTv = useMemo(() => {
    const filtered = filterCuratorHidden(filterDiscoverCatalog(browseTv, shelf, skipIds, requests), hiddenIds);
    if (isKidsProfile) return filtered.filter(isKidTitle);
    if (hideKids) return filtered.filter((t) => !isKidTitle(t));
    return filtered;
  }, [browseTv, shelf, skipIds, requests, hiddenIds, isKidsProfile, hideKids, kidsTitleIds]);

  const hits = useMemo(() => {
    const seen = new Set<string>();
    const out: Title[] = [];
    for (const t of filterCuratorHidden(filterDiscoverCatalog(remoteHits, shelf, inFlightRequestIds, requests), hiddenIds)) {
      if (seen.has(t.id)) continue;
      if (isKidsProfile && !isKidTitle(t)) continue;
      if (hideKids && isKidTitle(t)) continue;
      seen.add(t.id);
      out.push(t);
    }
    return out;
  }, [remoteHits, shelf, inFlightRequestIds, requests, hiddenIds, isKidsProfile, hideKids, kidsTitleIds]);

  const reqCards = collapseHomeRequestCards(inflight)
    .map((r) => ({ r, t: titleForRequest(r, catalog) ?? getTitle(r.titleId) }))
    .filter((x) => x.t && !isGhostRequestLabel(x.t.title, x.t.id))
    .slice(0, 12);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setRemoteHits([]);
      setPeopleHits([]);
      setCollectionHits([]);
      setLookupErr(null);
      setLooking(false);
      return;
    }
    setLooking(true);
    setLookupErr(null);
    let cancelled = false;
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void fetch(`/api/lookup?q=${encodeURIComponent(term)}&scope=discover`, { cache: "no-store", signal: ac.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error(`lookup ${res.status}`);
          return res.json() as Promise<{
            titles?: Title[];
            people?: PersonHit[];
            collections?: CollectionHit[];
            error?: string | null;
          }>;
        })
        .then((r) => {
          if (cancelled) return;
          const titles = Array.isArray(r?.titles) ? r.titles : [];
          const people = Array.isArray(r?.people) ? r.people : [];
          const collections = Array.isArray(r?.collections) ? r.collections : [];
          rememberCatalogTitles(titles);
          rememberTitles?.(titles);
          setRemoteHits(titles);
          setPeopleHits(people);
          setCollectionHits(collections);
          setLookupErr(titles.length || people.length || collections.length ? null : r?.error || "No matching titles found");
          setLooking(false);
        })
        .catch((e) => {
          if (cancelled || e?.name === "AbortError") return;
          setRemoteHits([]);
          setPeopleHits([]);
          setCollectionHits([]);
          setLookupErr(String(e?.name === "AbortError" ? "Catalog lookup timed out. Try the search again." : e));
          setLooking(false);
        });
    }, 280);
    return () => {
      cancelled = true;
      ac.abort();
      window.clearTimeout(t);
    };
  }, [q, rememberTitles]);

  const [activeMood, setActiveMood] = useState<string>("all");

  const [showCoachBanner, setShowCoachBanner] = useState(false);
  useEffect(() => {
    if (typeof localStorage !== "undefined" && !localStorage.getItem("reelos_dismiss_coach_banner")) {
      setShowCoachBanner(true);
    }
  }, []);
  const dismissCoachBanner = () => {
    setShowCoachBanner(false);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("reelos_dismiss_coach_banner", "1");
    }
  };

  const cloudSpotlight = useMemo(() => {
    return (
      pickMovies.find((t) => t.backdrop || t.poster) ??
      pickTv.find((t) => t.backdrop || t.poster) ??
      browseMovies.find((t) => t.backdrop || t.poster) ??
      browseTv.find((t) => t.backdrop || t.poster) ??
      null
    );
  }, [pickMovies, pickTv, browseMovies, browseTv]);

  const spotlightInLibrary = useMemo(() => {
    if (!cloudSpotlight) return false;
    return (
      Boolean(cloudSpotlight.jellyfinId) ||
      shelf.some((x) => titleMatchesId(x, cloudSpotlight.id) || x.id === cloudSpotlight.id)
    );
  }, [cloudSpotlight, shelf]);

  const spotlightRequest = useMemo(() => {
    if (!cloudSpotlight) return null;
    return (
      requests.find(
        (r) =>
          r.titleId === cloudSpotlight.id ||
          (cloudSpotlight.ids && cloudSpotlight.ids.includes(r.titleId)),
      ) ?? null
    );
  }, [cloudSpotlight, requests]);

  const [requestingSpotlight, setRequestingSpotlight] = useState(false);
  const [spotlightRequested, setSpotlightRequested] = useState(false);

  const spotlightLifecycle = useMemo(() => {
    if (!cloudSpotlight) return "unowned";
    if (spotlightRequested && !spotlightInLibrary) return "searching";
    return getMediaLifecycleState(cloudSpotlight, spotlightRequest, {
      titles: shelf,
      inLibrary: spotlightInLibrary,
    });
  }, [cloudSpotlight, spotlightRequest, shelf, spotlightInLibrary, spotlightRequested]);

  const handleRequestSpotlight = async () => {
    if (!cloudSpotlight || requestingSpotlight) return;
    setRequestingSpotlight(true);
    rememberCatalogTitles([cloudSpotlight]);
    const body = requestBodyForTitle(cloudSpotlight);
    if (body) {
      requestTitle(body.titleId, body.season);
    }
    showToast(`Resolving 4K Stream for "${cloudSpotlight.title}"…`, "info");
    setSpotlightRequested(true);
    try {
      void postTitleRequest(cloudSpotlight);
    } catch {}
    setTimeout(() => {
      setRequestingSpotlight(false);
      void navigate({
        to: "/play/$id",
        params: { id: cloudSpotlight.id },
      });
    }, 1000);
  };

  const DISCOVER_MOOD_CHIPS = [
    { id: "all", label: "All Curated" },
    { id: "dinner", label: "🍽️ 30-Min Dinner" },
    { id: "mind", label: "Mind-Bending" },
    { id: "classics", label: "📼 Cult Classics" },
    { id: "books", label: "📖 Page to Screen" },
    { id: "movies", label: "🎬 Feature Films" },
    { id: "shows", label: "📺 Serialized TV" },
  ] as const;

  return (
    <div className="cinema-discover w-full pb-24 md:pb-16">
      <div className="px-6 md:px-12 lg:px-16"><CuratorStatus {...curator} /></div>
      {/* Curated Spotlight Banner */}
      {cloudSpotlight && q.trim().length < 2 && activeMood === "all" ? (
        <div className="cinema-hero relative w-full overflow-hidden mb-10 group">
          <div className="relative h-[56vh] min-h-[460px] max-h-[700px] md:h-[68vh] md:min-h-[540px] md:max-h-[820px] 2xl:h-[74vh] 2xl:max-h-[960px] w-full overflow-hidden bg-card">
            {cloudSpotlight.backdrop || cloudSpotlight.poster ? (
              <img
                key={cloudSpotlight.id}
                src={cloudSpotlight.backdrop || cloudSpotlight.poster}
                alt=""
                className="size-full object-cover object-center opacity-50 kenburns transition-all duration-700 animate-in fade-in duration-500"
              />
            ) : (
              <div className="size-full bg-gradient-to-br from-card to-card-2" />
            )}
            {/* Cinematic multi-stop gradient fades */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-transparent" />

            {/* Content Details */}
            <div className="absolute bottom-8 left-6 right-6 max-w-3xl md:bottom-12 md:left-12 lg:left-16 z-10">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {spotlightLifecycle === "on_shelf" ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-emerald-400 backdrop-blur-md">
                    <Check className="size-3" />
                    <span>On This Box</span>
                  </span>
                ) : spotlightLifecycle === "downloading" ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 px-3 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-amber-300 backdrop-blur-md">
                    <Clock className="size-3" />
                    <span>Downloading {spotlightRequest?.progress ? `${spotlightRequest.progress}%` : ""}</span>
                  </span>
                ) : spotlightLifecycle === "importing" ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 px-3 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-amber-300 backdrop-blur-md">
                    <Sparkles className="size-3" />
                    <span>Linking to Storage</span>
                  </span>
                ) : spotlightLifecycle === "searching" ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-sky-500/20 border border-sky-500/40 px-3 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-sky-300 backdrop-blur-md">
                    <Clock className="size-3" />
                    <span>Looking for a playable source</span>
                  </span>
                ) : spotlightLifecycle === "coming_soon" ? (
                  <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-background/60 px-3 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-muted backdrop-blur-md">
                    <span>Coming Soon</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 px-3 py-0.5 font-display text-[10px] font-extrabold uppercase tracking-wider text-black shadow-sm">
                    <Sparkles className="size-3" />
                    <span>Featured Tonight</span>
                  </span>
                )}

                {cloudSpotlight.maxQuality === "4k" ? (
                  <span className="rounded-full border border-white/20 bg-background/60 px-2.5 py-0.5 text-[10px] font-semibold text-foreground backdrop-blur-md">
                    4K HDR
                  </span>
                ) : null}

                {cloudSpotlight.year ? (
                  <span className="text-xs font-semibold text-muted">{cloudSpotlight.year}</span>
                ) : null}

                {cloudSpotlight.rating != null && Number(cloudSpotlight.rating) > 0 ? (
                  <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 backdrop-blur-md">
                    ★ {Number(cloudSpotlight.rating).toFixed(1)}
                  </span>
                ) : null}

                {(cloudSpotlight.genres || []).slice(0, 2).map((g) => (
                  <span
                    key={g}
                    className="hidden sm:inline-block rounded-full border border-white/15 bg-background/60 px-2.5 py-0.5 text-[10px] font-medium text-foreground/80 backdrop-blur-md"
                  >
                    {g}
                  </span>
                ))}
              </div>

              <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-foreground drop-shadow-2xl">
                {cloudSpotlight.title}
              </h1>

              {cloudSpotlight.overview ? (
                <p className="mt-2.5 line-clamp-2 text-xs sm:text-sm text-foreground/90 max-w-2xl drop-shadow">
                  {cloudSpotlight.overview}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {spotlightLifecycle === "on_shelf" ? (
                  <Link
                    to="/play/$id"
                    params={{ id: cloudSpotlight.id }}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-gold px-5 text-xs font-bold text-gold-fg shadow-[var(--shadow-gold)] transition-all hover:scale-105 hover:bg-gold-bright active:scale-95"
                  >
                    <Play className="size-4 fill-current" />
                    <span>Watch Now</span>
                  </Link>
                ) : spotlightLifecycle === "downloading" ||
                  spotlightLifecycle === "importing" ||
                  spotlightLifecycle === "searching" ||
                  spotlightLifecycle === "coming_soon" ? (
                  <Link
                    to="/requests"
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-gold px-5 text-xs font-bold text-gold-fg shadow-[var(--shadow-gold)] transition-all hover:scale-105 hover:bg-gold-bright active:scale-95"
                  >
                    <Clock className="size-4" />
                    <span>View Progress</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={requestingSpotlight}
                    onClick={() => void handleRequestSpotlight()}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-gold px-5 text-xs font-bold text-gold-fg shadow-[var(--shadow-gold)] transition-all hover:scale-105 hover:bg-gold-bright active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {requestingSpotlight ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4 fill-current" />}
                    <span>{requestingSpotlight ? "Resolving Stream…" : "Stream 4K"}</span>
                  </button>
                )}
                <Link
                  to="/title/$id"
                  params={{ id: cloudSpotlight.id }}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-card/60 px-4 text-xs font-semibold text-foreground backdrop-blur-md transition-all hover:bg-card hover:border-gold/30 active:scale-95"
                >
                  <span>View Details</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="cinema-discover-content w-full px-6 md:px-12 lg:px-16 space-y-8">
        {showCoachBanner ? (
          <div className="flex items-start justify-between rounded-2xl bg-gold/10 border border-gold/30 p-4 shadow-sm relative pr-10">
            <p className="text-sm text-foreground/90 leading-relaxed font-medium">
              🎉 <strong>Welcome to ReelOS!</strong> Pick any movie or show below and click Request. ReelOS will link it to your library in seconds so you can watch on your TV or phone.
            </p>
            <button 
              type="button" 
              onClick={dismissCoachBanner}
              className="absolute right-3 top-3 rounded-full p-1.5 text-muted hover:bg-black/10 hover:text-foreground transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Discover</h1>
          <p className="mt-1 text-sm text-muted">
            A few excellent places to start—then make the night your own.
          </p>
        </div>

        {/* Search Input in Discover */}
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a title, actor, or collection"
            className="h-12 w-full rounded-2xl border border-white/10 bg-card/70 pl-11 pr-10 text-sm backdrop-blur-md shadow-inner placeholder:text-faint focus:border-gold/40 focus:outline-none"
          />
          {q ? (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-faint hover:text-foreground cursor-pointer rounded-lg"
              title="Clear search"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      {isKidsProfile ? (
        <div className="mt-4 rounded-2xl border border-gold/40 bg-gold/10 p-3.5 text-center">
          <p className="font-display text-sm font-bold text-gold">👶 Kids Discover Active</p>
          <p className="mt-0.5 text-xs text-muted">Showing kid-safe and family-approved movies and shows only.</p>
        </div>
      ) : null}

      {/* Horizontal Tactile Mood Chips Bar */}
      {q.trim().length < 2 ? (
        <div className="mt-6 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {DISCOVER_MOOD_CHIPS.map((chip) => {
            const active = activeMood === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setActiveMood(chip.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 cursor-pointer active:scale-95",
                  active
                    ? "border border-gold/50 bg-gold text-gold-fg shadow-[var(--shadow-gold)] font-bold scale-[1.02]"
                    : "border border-white/5 bg-card/60 text-muted hover:border-gold/30 hover:text-foreground",
                )}
              >
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {q.trim().length >= 2 ? (
        hits.length > 0 || peopleHits.length > 0 || collectionHits.length > 0 ? (
          <>
            {peopleHits.length ? (
              <section className="mt-8">
                <h2 className="font-display text-xl font-semibold tracking-tight">People</h2>
                <ul className="mt-3 divide-y divide-border">
                  {peopleHits.map((p) => (
                    <li key={p.id}>
                      <Link to="/person/$id" params={{ id: personRouteId(p) }} className="flex items-center gap-3 py-3">
                        {p.poster ? (
                          <img src={p.poster} alt="" className="size-12 rounded-full object-cover" />
                        ) : (
                          <span className="size-12 rounded-full bg-card-2" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{p.name}</span>
                          <span className="block text-xs text-muted">{p.knownForDepartment || "Actor"}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {collectionHits.length ? (
              <section className="mt-8">
                <h2 className="font-display text-xl font-semibold tracking-tight">Collections</h2>
                <ul className="mt-3 divide-y divide-border">
                  {collectionHits.map((c) => (
                    <li key={c.id}>
                      <Link to="/collection/$id" params={{ id: collectionRouteId(c) }} className="flex items-center gap-3 py-3">
                        {c.poster ? (
                          <img src={c.poster} alt="" className="h-16 w-11 rounded-md object-cover" />
                        ) : (
                          <span className="h-16 w-11 rounded-md bg-card-2" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{c.name}</span>
                          <span className="block text-xs text-muted">Collection</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {hits.length ? (
              <Row label="Results">
                {hits.map((t) => (
                  <TitleCard
                    key={t.id}
                    title={t}
                    onVote={voteDiscover}
                    liked={titleIsCuratorLiked(t, likedIds)}
                    hidden={hiddenIds.includes(t.id)}
                  />
                ))}
              </Row>
            ) : null}
          </>
        ) : looking ? (
          <p className="mt-10 text-sm text-muted">Looking up movies and shows…</p>
        ) : (
          <p className="mt-10 text-sm text-muted">
            {lookupErr || "No movies or shows found matching that search."}
          </p>
        )
      ) : (
        <>
          {reqCards.length > 0 ? (
            <div className="mt-8">
              <Row label="Finishing">
                {reqCards.map(({ r, t }) => (
                  <TitleCard key={r.id} title={t!} request={r} />
                ))}
              </Row>
            </div>
          ) : null}

          {/* Contextual Mood Shelves */}
          {(activeMood === "all" || activeMood === "dinner") && curatedFeed?.dinnerWatches && curatedFeed.dinnerWatches.length > 0 ? (
            <div className="mt-8">
              <Row label="🍽️ 30-Minute Dinner Watches">
                {curatedFeed.dinnerWatches.map((t) => (
                  <TitleCard
                    key={`dinner-${t.id}`}
                    title={t}
                    onVote={voteDiscover}
                    liked={titleIsCuratorLiked(t, likedIds)}
                    hidden={hiddenIds.includes(t.id)}
                  />
                ))}
              </Row>
            </div>
          ) : null}

          {(activeMood === "all" || activeMood === "mind") && curatedFeed?.mindBenders && curatedFeed.mindBenders.length > 0 ? (
            <div className="mt-8">
              <Row label="Mind-Bending Night Shifts">
                {curatedFeed.mindBenders.map((t) => (
                  <TitleCard
                    key={`mind-${t.id}`}
                    title={t}
                    onVote={voteDiscover}
                    liked={titleIsCuratorLiked(t, likedIds)}
                    hidden={hiddenIds.includes(t.id)}
                  />
                ))}
              </Row>
            </div>
          ) : null}

          {(activeMood === "all" || activeMood === "classics") && curatedFeed?.forgottenClassics && curatedFeed.forgottenClassics.length > 0 ? (
            <div className="mt-8">
              <Row label="📼 Forgotten Classics & Cult Gems">
                {curatedFeed.forgottenClassics.map((t) => (
                  <TitleCard
                    key={`classic-${t.id}`}
                    title={t}
                    onVote={voteDiscover}
                    liked={titleIsCuratorLiked(t, likedIds)}
                    hidden={hiddenIds.includes(t.id)}
                  />
                ))}
              </Row>
            </div>
          ) : null}

          {(activeMood === "all" || activeMood === "books") && curatedFeed?.pageToScreen && curatedFeed.pageToScreen.length > 0 ? (
            <div className="mt-8">
              <Row label="📖 From Page to Screen">
                {curatedFeed.pageToScreen.map((t) => (
                  <TitleCard
                    key={`page-${t.id}`}
                    title={t}
                    onVote={voteDiscover}
                    liked={titleIsCuratorLiked(t, likedIds)}
                    hidden={hiddenIds.includes(t.id)}
                  />
                ))}
              </Row>
            </div>
          ) : null}

          <DiscoverKind
            heading="Movies"
            to="/discover/movies"
            pick={pickMovies}
            likedIds={likedIds}
            hiddenIds={hiddenIds}
            onVote={voteDiscover}
          />
          <DiscoverKind
            heading="TV"
            to="/discover/shows"
            pick={pickTv}
            likedIds={likedIds}
            hiddenIds={hiddenIds}
            onVote={voteDiscover}
          />
          {booksOn && bookFeatured.length > 0 ? (
            <section className="mt-10">
              <h2 className="font-display text-xl font-semibold tracking-tight">Books</h2>
              <p className="mt-1 text-xs text-muted">Open catalogs. Download is a real DRM-free file.</p>
              <ul className="mt-3 divide-y divide-border">
                {bookFeatured.slice(0, 8).map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="truncate">
                      {b.title}
                      <span className="ml-2 text-muted">{b.author}</span>
                    </span>
                    <a href="/books" className="text-xs text-circuit">
                      Open
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {pickMovies.length === 0 && pickTv.length === 0 ? (
            <p className="mt-10 text-sm text-muted">
              {browseErr ||
                (browseReady ? "No new recommendations available right now." : "Looking up movies and shows…")}
            </p>
          ) : null}
        </>
      )}
      </div>
    </div>
  );
}

function DiscoverKind({
  heading,
  to,
  pick,
  likedIds,
  hiddenIds,
  onVote,
}: {
  heading: string;
  to: "/discover/movies" | "/discover/shows";
  pick: Title[];
  likedIds: string[];
  hiddenIds: string[];
  onVote: (title: Title, vote: CuratorVote) => void;
}) {
  return (
    <div className="mt-10">
      <Link to={to} search={{ genre: "", category: "popular" }} className="flex items-center gap-1">
        <h2 className="font-display text-xl font-semibold tracking-tight">{heading}</h2>
        <ChevronRight className="size-5 text-muted" />
      </Link>
      {pick.length ? (
        <Row label="Pick tonight">
          {pick.map((t) => (
            <TitleCard
              key={t.id}
              title={t}
              onVote={onVote}
              liked={titleIsCuratorLiked(t, likedIds)}
              hidden={hiddenIds.includes(t.id)}
            />
          ))}
        </Row>
      ) : null}
    </div>
  );
}
