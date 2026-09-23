import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bookmark, BookOpen, Check, ChevronLeft, ChevronRight, Compass, Play, Search, X } from "lucide-react";
import { Row, TitleCard } from "@/components/title-card";
import { BookCover } from "@/components/book-cover";
import { RemoveFromBox } from "@/components/remove-from-box";
import { ReelRoulette } from "@/components/reel-roulette";
import { MarqueePinningTray } from "@/components/marquee-pinning-tray";
import { ResidentAvatar } from "@/components/profile-switcher";
import { HOSTNAME, rememberCatalogTitles } from "@/lib/catalog";
import { getTitle } from "@/lib/catalog";
import { frontendLabel, sourceLabel, useReelStore, TasteVibe } from "@/lib/store";
import {
  collapseHomeRequestCards,
  homeInFlightRequests,
  isGhostRequestLabel,
  isInFlightRequest,
  titleForRequest,
  titleMatchesId,
  transferringChipCount,
} from "@/lib/sync-requests";
import { catchupShowsBanner } from "@/lib/library-catchup";
import { homeShelfRows } from "@/lib/shelf";
import { useResolveGhostRequestTitles, useSyncRequests } from "@/lib/use-sync-requests";
import type { CollectionHit, PersonHit, Title } from "@/lib/types";
import { cn } from "@/lib/utils";

export function HomeView() {
  const [q, setQ] = useState("");
  const [remoteHits, setRemoteHits] = useState<Title[]>([]);
  const [peopleHits, setPeopleHits] = useState<PersonHit[]>([]);
  const [collectionHits, setCollectionHits] = useState<CollectionHit[]>([]);
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const rememberTitles = useReelStore((s) => s.rememberTitles);
  const hydrateShelf = useReelStore((s) => s.hydrateShelf);
  const shelf = useReelStore((s) => s.shelf);
  const remoteTitles = useReelStore((s) => s.remoteTitles);
  const shelfError = useReelStore((s) => s.shelfError);
  const shelfReady = useReelStore((s) => s.shelfReady);
  const navigate = useNavigate();
  const requests = useReelStore((s) => s.requests);
  const watch = useReelStore((s) => s.watchProgress);
  const clearWatchProgress = useReelStore((s) => s.clearWatchProgress);
  const frontend = useReelStore((s) => s.answers.frontend);
  const source = useReelStore((s) => s.answers.source);
  const adapter = useReelStore((s) => s.adapter);
  const fuseOffline = useReelStore((s) => Boolean(s.fuseOffline || s.adapter.status === "offline"));
  const jfLive = useReelStore((s) => s.jellyfinHop?.state === "green");
  const booksOn = useReelStore((s) => s.settings.betaChannel);
  const [bookShelf, setBookShelf] = useState<
    Array<{ id?: string; title: string; author: string; rel?: string; cover?: string; format?: string }>
  >([]);
  const catalog = useMemo(() => [...shelf, ...remoteTitles], [shelf, remoteTitles]);
  const residents = useReelStore((s) => s.residents);
  const activeResidentId = useReelStore((s) => s.activeResidentId);
  const kidsTitleIds = useReelStore((s) => s.kidsTitleIds);
  const activeResident =
    residents.find((r) => r.id === activeResidentId) ??
    residents[0] ?? { name: "Living Room", avatar: "clapperboard" };
  const isKidsProfile = Boolean(activeResident?.isKids);
  const hideKids = Boolean(activeResident?.hideKidsContent);
  const residentWatchlist = activeResident?.watchlist || [];
  const toggleWatchlist = useReelStore((s) => s.toggleWatchlist);
  const patchResident = useReelStore((s) => s.patchResident);
  const currentVibe = activeResident?.tasteVibe || "balanced";
  const watchlistTitles = useMemo(() => {
    if (!residentWatchlist.length) return [];
    const set = new Set(residentWatchlist);
    return catalog.filter((t) => set.has(t.id) || (t.jellyfinId && set.has(t.jellyfinId)));
  }, [catalog, residentWatchlist]);

  // First-visit marquee tray state
  const [showMarqueeTray, setShowMarqueeTray] = useState(false);

  useEffect(() => {
    try {
      if (!activeResident?.id || activeResident.hasCompletedMarqueePinning) {
        setShowMarqueeTray(false);
      }
    } catch {
      setShowMarqueeTray(false);
    }
  }, [activeResident?.id, activeResident?.hasCompletedMarqueePinning]);

  // Marquee showcase titles pinned by the active resident
  const marqueeShowcaseTitles = useMemo(() => {
    const ids = activeResident?.pinnedTitleIds || [];
    if (!ids.length) return [];
    const set = new Set(ids);
    const matched = catalog.filter((t) => set.has(t.id) || (t.jellyfinId && set.has(t.jellyfinId)));
    const map = new Map(matched.map((t) => [t.id, t]));
    for (const id of ids) {
      if (!map.has(id)) {
        const found = getTitle(id);
        if (found) map.set(id, found);
      }
    }
    return ids.map((id) => map.get(id)).filter((t): t is Title => Boolean(t));
  }, [catalog, activeResident?.pinnedTitleIds]);

  const [pendingGuestRequests, setPendingGuestRequests] = useState<{
    id: string;
    titleId: string;
    title: string;
    year?: string | number;
    poster?: string;
    mediaType?: string;
    requestedBy?: string;
  }[]>([]);

  const fetchPending = () => {
    if (isKidsProfile) return;
    fetch("/api/requests/pending", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && Array.isArray(d.pending)) {
          setPendingGuestRequests(d.pending);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchPending();
  }, [isKidsProfile, requests.length]);

  const handleApproveGuest = async (id: string) => {
    try {
      await fetch("/api/requests/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchPending();
      useReelStore.getState().hydrateShelf({ limit: 24, force: true });
    } catch {}
  };

  const handleRejectGuest = async (id: string) => {
    try {
      await fetch("/api/requests/reject", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchPending();
    } catch {}
  };

  const filteredShelf = useMemo(() => {
    let list = shelf;
    if (activeResident?.id !== "res-primary" && activeResident?.assignedTitleIds && activeResident.assignedTitleIds.length > 0) {
      const allowed = new Set(activeResident.assignedTitleIds);
      const matches = list.filter((t) => {
        if (allowed.has(t.id)) return true;
        if (t.jellyfinId && allowed.has(t.jellyfinId)) return true;
        if (Array.isArray(t.ids) && t.ids.some((i) => allowed.has(i))) return true;
        return false;
      });
      if (matches.length > 0) {
        list = matches;
      }
    }
    if (isKidsProfile) {
      return list.filter((t) => {
        const id = String(t.id || t.jellyfinId || "");
        if (kidsTitleIds.includes(id)) return true;
        const genres = (t.genres || []).map((g) => g.toLowerCase());
        return genres.includes("animation") || genres.includes("family") || genres.includes("children");
      });
    }
    if (hideKids) {
      const watchlistSet = new Set(residentWatchlist);
      return list.filter((t) => {
        const id = String(t.id || t.jellyfinId || "");
        if (watchlistSet.has(id)) return true;
        if (kidsTitleIds.includes(id)) return false;
        const genres = (t.genres || []).map((g) => g.toLowerCase());
        const isKidGenre = genres.includes("animation") || genres.includes("family") || genres.includes("children");
        return !isKidGenre;
      });
    }
    return list;
  }, [shelf, isKidsProfile, hideKids, kidsTitleIds, residentWatchlist, activeResident?.assignedTitleIds, activeResident?.id]);

  const boxShelf = useMemo(() => homeShelfRows(filteredShelf), [filteredShelf]);
  const recentlyAdded = useMemo(() => {
    return [...boxShelf]
      .sort((a, b) => {
        if (a.dateAdded && b.dateAdded) {
          const diff = new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
          if (diff !== 0) return diff;
        }
        return 0;
      })
      .slice(0, 16);
  }, [boxShelf]);
  const inflight = homeInFlightRequests(requests, { titles: shelf });
  const transferring = transferringChipCount(inflight);
  const libraryCatchup = useReelStore((s) => s.libraryCatchup);
  const catchupChip = catchupShowsBanner(libraryCatchup);
  useSyncRequests();
  useResolveGhostRequestTitles(inflight, catalog);
  useEffect(() => {
    hydrateShelf({ limit: 24, force: true });
  }, [hydrateShelf]);
  useEffect(() => {
    let cancelled = false;
    async function loadBooks() {
      try {
        const libRes = await fetch("/api/books/library", { cache: "no-store" });
        const libData = await libRes.json();
        const books = Array.isArray(libData.books) ? libData.books : [];
        if (books.length >= 4) {
          if (!cancelled) setBookShelf(books);
          return;
        }
        const discRes = await fetch("/api/books/discover", { cache: "no-store" });
        const discData = await discRes.json();
        const featured = Array.isArray(discData.featured) ? discData.featured : [];
        const combined = [...books];
        const seen = new Set(books.map((b: any) => String(b.title).toLowerCase()));
        for (const f of featured) {
          if (!seen.has(String(f.title).toLowerCase())) {
            seen.add(String(f.title).toLowerCase());
            combined.push(f);
          }
        }
        if (!cancelled) setBookShelf(combined);
      } catch {
        if (!cancelled) setBookShelf([]);
      }
    }
    void loadBooks();
    return () => {
      cancelled = true;
    };
  }, []);

  const catalogHits: Title[] = [];
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
      setPeopleHits([]);
      setCollectionHits([]);
      setLookupErr(null);
      return;
    }
    let cancelled = false;
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void fetch(`/api/lookup?q=${encodeURIComponent(term)}`, { cache: "no-store", signal: ac.signal })
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
          if (titles.some((t) => t.jellyfinId)) {
            useReelStore.getState().hydrateShelf({ limit: 24, force: true });
          }
        })
        .catch((e) => {
          if (cancelled || e?.name === "AbortError") return;
          setRemoteHits([]);
          setPeopleHits([]);
          setCollectionHits([]);
          setLookupErr(String(e));
        });
    }, 280);
    return () => {
      cancelled = true;
      ac.abort();
      window.clearTimeout(t);
    };
  }, [q, rememberTitles]);

  const reqCards = collapseHomeRequestCards(inflight)
    .map((r) => ({ r, t: titleForRequest(r, catalog) ?? getTitle(r.titleId) }))
    .filter((x) => x.t && !isGhostRequestLabel(x.t.title, x.t.id))
    .slice(0, 12);

  const residentWatchProgress =
    activeResident?.watchProgress && Object.keys(activeResident.watchProgress).length > 0
      ? activeResident.watchProgress
      : activeResident?.id === (residents[0]?.id ?? "res-primary")
        ? watch
        : {};

  const [dismissedWatch, setDismissedWatch] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("reelos_dismissed_watch") || "[]");
    } catch {
      return [];
    }
  });

  const handleDismissWatch = (titleId: string) => {
    clearWatchProgress(titleId);
    setDismissedWatch((prev) => {
      const next = [...prev, titleId];
      try {
        localStorage.setItem("reelos_dismissed_watch", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const [showApkBanner, setShowApkBanner] = useState(() => {
    // Companion setup belongs in Settings/Connect, not at the front door.
    return false;
  });

  const continueWatch = Object.entries(residentWatchProgress)
    .filter(([id, v]) => v > 0.03 && v < 0.96 && !dismissedWatch.includes(id))
    .map(([id, v]) => ({
      t: getTitle(id) || catalog.find((x) => titleMatchesId(x, id) || x.id === id),
      v,
    }))
    .filter((x) => x.t);

  // Curate a rotating spotlight pool of up to 6 diverse, high-quality featured titles
  const featuredList = useMemo(() => {
    const list: { title: Title; tag: string }[] = [];
    const seen = new Set<string>();

    // 1. Top recently added titles with backdrop artwork (fresh additions take spotlight)
    for (const t of recentlyAdded) {
      if (t && !seen.has(t.id) && (t.backdrop || t.poster)) {
        seen.add(t.id);
        list.push({ title: t, tag: "Recently Added" });
      }
      if (list.length >= 3) break;
    }

    // 2. Continue watching (personal relevance, but does not monopolize slot 0)
    for (const cw of continueWatch) {
      if (cw.t && !seen.has(cw.t.id) && (cw.t.backdrop || cw.t.poster)) {
        seen.add(cw.t.id);
        const pct = Math.round(cw.v * 100);
        list.push({ title: cw.t, tag: `Continue (${pct}%)` });
      }
      if (list.length >= 5) break;
    }

    // 3. Fallback to box shelf if needed
    for (const t of boxShelf) {
      if (t && !seen.has(t.id) && (t.backdrop || t.poster)) {
        seen.add(t.id);
        list.push({ title: t, tag: "Featured" });
      }
      if (list.length >= 6) break;
    }

    return list;
  }, [continueWatch, recentlyAdded, boxShelf]);

  const [heroIndex, setHeroIndex] = useState(() => Math.floor(Math.random() * 6));
  const [heroPaused, setHeroPaused] = useState(false);
  const touchStartRef = useRef<number | null>(null);

  const activeHero = featuredList[heroIndex % (featuredList.length || 1)] || null;
  const featured = activeHero?.title ?? boxShelf[0];
  const featuredTag = activeHero?.tag ?? "Featured";

  // Auto-advance spotlight carousel every 7.5 seconds when not paused/hovered
  useEffect(() => {
    if (featuredList.length <= 1 || heroPaused) return;
    const timer = setTimeout(() => {
      setHeroIndex((prev) => (prev + 1) % featuredList.length);
    }, 7500);
    return () => clearTimeout(timer);
  }, [featuredList.length, heroPaused, heroIndex]);

  const VIBE_OPTIONS = [
    { id: "balanced" as TasteVibe, label: "Golden Popcorn", desc: "Blockbusters & familiar favorites", icon: "🍿" },
    { id: "comfort" as TasteVibe, label: "35mm Film Warmth", desc: "Cozy, nostalgic & uplifting", icon: "🎞️" },
    { id: "hidden_gems" as TasteVibe, label: "A24 Midnight", desc: "Dark, esoteric & moody", icon: "🌌" },
    { id: "bleeding_edge" as TasteVibe, label: "90-Min Dinner", desc: "Fast-paced & punchy", icon: "⏱️" },
  ];

  return (
    <div className="cinema-page px-5 pb-24 pt-2 md:px-10 md:pb-12 md:pt-8">
      {/* Universal Browser-First: Optional Native APK Companion Banner */}
      {showApkBanner && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-neutral-900/80 to-neutral-950 p-3 text-xs shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 font-bold">
              📱
            </span>
            <div>
              <p className="font-semibold text-neutral-100">
                Experience 120fps DirectPlay & Foldable Mode
              </p>
              <p className="text-neutral-400">
                Download the native ReelOS Companion APK for phone, tablet, and TV.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/downloads/reelos-app.apk"
              download="reelos-app.apk"
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 font-bold text-neutral-950 transition hover:bg-amber-300"
            >
              Download APK
            </a>
            <button
              onClick={() => {
                setShowApkBanner(false);
                try {
                  localStorage.setItem("reelos_dismiss_apk_banner", "1");
                } catch {}
              }}
              className="rounded-md p-1 text-neutral-400 hover:text-neutral-200"
              aria-label="Dismiss banner"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Full-bleed cinematic hero backdrop with auto-rotating spotlight carousel */}
      {featured && q.trim().length < 2 ? (
        <div
          className="cinema-hero relative -mx-5 -mt-2 mb-10 overflow-hidden md:-mx-10 md:-mt-8 group"
          onMouseEnter={() => setHeroPaused(true)}
          onMouseLeave={() => setHeroPaused(false)}
          onTouchStart={(e) => {
            touchStartRef.current = e.touches[0].clientX;
            setHeroPaused(true);
          }}
          onTouchEnd={(e) => {
            setHeroPaused(false);
            if (touchStartRef.current === null) return;
            const diff = e.changedTouches[0].clientX - touchStartRef.current;
            if (Math.abs(diff) > 40 && featuredList.length > 1) {
              if (diff < 0) {
                // Swipe left -> Next
                setHeroIndex((prev) => (prev + 1) % featuredList.length);
              } else {
                // Swipe right -> Prev
                setHeroIndex((prev) => (prev - 1 + featuredList.length) % featuredList.length);
              }
            }
            touchStartRef.current = null;
          }}
        >
          <div className="cinema-hero-stage relative h-[52vh] min-h-[420px] max-h-[640px] md:h-[62vh] md:min-h-[480px] w-full overflow-hidden bg-card">
            {featured.backdrop || featured.poster ? (
              <img
                key={featured.id}
                src={featured.backdrop || featured.poster}
                alt=""
                className="size-full object-cover object-center opacity-55 kenburns transition-all duration-700 animate-in fade-in duration-500"
              />
            ) : (
              <div className="size-full bg-gradient-to-br from-card to-card-2" />
            )}
            {/* Cinematic multi-stop gradient fades */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-transparent" />

            {/* Left/Right Navigation Chevrons (Mobile & Desktop) */}
            {featuredList.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHeroIndex((prev) => (prev - 1 + featuredList.length) % featuredList.length);
                  }}
                  aria-label="Previous spotlight title"
                  className="flex absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 min-h-[44px] min-w-[44px] size-11 items-center justify-center rounded-full bg-background/60 text-foreground/80 backdrop-blur-md border border-white/10 hover:bg-background/90 hover:text-foreground hover:scale-105 transition-all shadow-lg cursor-pointer"
                >
                  <ChevronLeft className="size-4 sm:size-5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHeroIndex((prev) => (prev + 1) % featuredList.length);
                  }}
                  aria-label="Next spotlight title"
                  className="flex absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 min-h-[44px] min-w-[44px] size-11 items-center justify-center rounded-full bg-background/60 text-foreground/80 backdrop-blur-md border border-white/10 hover:bg-background/90 hover:text-foreground hover:scale-105 transition-all shadow-lg cursor-pointer"
                >
                  <ChevronRight className="size-4 sm:size-5" />
                </button>
              </>
            ) : null}

            {/* Hero Content Details */}
            <div className="absolute bottom-8 left-6 right-6 max-w-3xl md:bottom-12 md:left-14 z-10">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="rounded-full bg-gold px-3 py-0.5 font-display text-[10px] font-extrabold uppercase tracking-wider text-gold-fg shadow-sm">
                  {featuredTag}
                </span>
                <span className="rounded-full border border-white/20 bg-background/60 px-2.5 py-0.5 text-[10px] font-semibold text-foreground backdrop-blur-md">
                  4K HDR
                </span>
                <span className="rounded-full border border-white/20 bg-background/60 px-2.5 py-0.5 text-[10px] font-semibold text-foreground backdrop-blur-md">
                  DOLBY VISION
                </span>
                <span className="rounded-full border border-white/20 bg-background/60 px-2.5 py-0.5 text-[10px] font-semibold text-foreground backdrop-blur-md">
                  DOLBY ATMOS
                </span>
                {featured.year ? (
                  <span className="text-xs font-semibold text-muted">{featured.year}</span>
                ) : null}
              </div>

              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-gold/90">Tonight's feature</p>
              <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-foreground drop-shadow-2xl">
                {featured.title}
              </h1>

              {featured.overview ? (
                <p className="mt-2.5 line-clamp-2 text-xs sm:text-sm text-foreground/90 max-w-2xl drop-shadow">
                  {featured.overview}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  to="/play/$id"
                  params={{ id: featured.id }}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-gold px-5 text-xs font-bold text-gold-fg shadow-[var(--shadow-gold)] transition-all hover:scale-105 hover:bg-gold-bright active:scale-95"
                >
                  <Play className="size-4 fill-current" />
                  <span>Watch</span>
                </Link>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleWatchlist(featured.id);
                  }}
                  className={cn(
                    "inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-xs font-semibold backdrop-blur-md transition-all active:scale-95 cursor-pointer",
                    watchlistTitles.some((w) => w.id === featured.id)
                      ? "border-gold/50 bg-gold/20 text-gold shadow-sm"
                      : "border-white/15 bg-card/60 text-foreground hover:border-gold/40 hover:bg-card/80",
                  )}
                  title={watchlistTitles.some((w) => w.id === featured.id) ? "Remove from Watchlist" : "Add to Watchlist"}
                >
                  {watchlistTitles.some((w) => w.id === featured.id) ? (
                    <>
                      <Bookmark className="size-4 fill-current text-gold" />
                      <span>Saved</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="size-4" />
                      <span>Watchlist</span>
                    </>
                  )}
                </button>

                <Link
                  to="/title/$id"
                  params={{ id: featured.id }}
                  className="inline-flex h-11 items-center rounded-xl border border-white/15 bg-card/60 px-4 text-xs font-medium text-foreground backdrop-blur-md transition-all hover:bg-card hover:border-gold/30 active:scale-95"
                >
                  Details
                </Link>

                {featuredList.length > 1 ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setHeroIndex((prev) => (prev + 1) % featuredList.length);
                    }}
                    className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-card/50 px-3.5 text-xs font-medium text-muted backdrop-blur-md transition-all hover:text-foreground hover:bg-card hover:border-gold/30 cursor-pointer active:scale-95"
                    title="Next spotlight title"
                  >
                    <Compass className="size-3.5 text-gold" />
                    <span>Next</span>
                  </button>
                ) : null}
              </div>
            </div>

            {/* Spotlight Carousel Indicator Progress Pills */}
            {featuredList.length > 1 ? (
              <div className="absolute bottom-6 right-6 z-20 hidden sm:flex items-center gap-1.5 bg-background/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
                {featuredList.map((item, idx) => {
                  const isCurrent = idx === (heroIndex % featuredList.length);
                  return (
                    <button
                      key={item.title.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setHeroIndex(idx);
                      }}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                        isCurrent
                          ? "w-6 bg-gold shadow-[0_0_8px_rgba(234,179,8,0.8)]"
                          : "w-2 bg-white/25 hover:bg-white/60",
                      )}
                      title={`Jump to ${item.title.title}`}
                      aria-label={`Slide ${idx + 1}: ${item.title.title}`}
                    />
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <form
        className="cinema-search relative mx-auto block w-full max-w-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (hits[0]) void navigate({ to: "/title/$id", params: { id: hits[0].id } });
          else if (peopleHits[0]) void navigate({ to: "/person/$id", params: { id: String(peopleHits[0].id) } });
          else if (collectionHits[0]) void navigate({ to: "/collection/$id", params: { id: String(collectionHits[0].id) } });
        }}
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search movies, shows, people"
          className="h-14 w-full rounded-2xl bg-card pl-12 pr-11 text-base shadow-[var(--shadow-border)] placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-gold/40 transition-all"
        />
        {q ? (
          <button
            type="button"
            onClick={() => setQ("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-faint hover:text-foreground cursor-pointer rounded-lg"
            title="Clear search"
          >
            <X className="size-4" />
          </button>
        ) : null}
        {hits.length > 0 || peopleHits.length > 0 || collectionHits.length > 0 ? (
          <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
            {hits.slice(0, 6).map((t) => (
              <li key={t.id}>
                <Link
                  to="/title/$id"
                  params={{ id: t.id }}
                  className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-foreground/5"
                  onClick={() => setQ("")}
                >
                  {t.poster ? <img src={t.poster} alt="" className="h-10 w-7 rounded object-cover" /> : <span className="h-10 w-7 rounded bg-card-2" />}
                  <span className="flex-1 truncate">{t.title}</span>
                  <span className="text-xs text-muted">{t.year}</span>
                </Link>
              </li>
            ))}
            {peopleHits.slice(0, 3).map((p) => (
              <li key={`person-${p.id}`}>
                <Link
                  to="/person/$id"
                  params={{ id: String(p.id) }}
                  className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-foreground/5"
                  onClick={() => setQ("")}
                >
                  {p.poster ? (
                    <img src={p.poster} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <span className="h-10 w-10 rounded-full bg-card-2" />
                  )}
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-muted">Actor</span>
                </Link>
              </li>
            ))}
            {collectionHits.slice(0, 2).map((c) => (
              <li key={`collection-${c.id}`}>
                <Link
                  to="/collection/$id"
                  params={{ id: String(c.id) }}
                  className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-foreground/5"
                  onClick={() => setQ("")}
                >
                  {c.poster ? <img src={c.poster} alt="" className="h-10 w-7 rounded object-cover" /> : <span className="h-10 w-7 rounded bg-card-2" />}
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-muted">Collection</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : q.trim().length >= 2 ? (
          <p className="mt-2 text-xs text-muted">
            {lookupErr ?? "Looking up movies and shows…"}
          </p>
        ) : null}
      </form>

      {pendingGuestRequests.length > 0 && !isKidsProfile ? (
        <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-gold/40 bg-card p-4 shadow-[var(--shadow-gold)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gold">
              Guest Request Pending Approval ({pendingGuestRequests.length})
            </span>
            <span className="text-[11px] text-muted">Host Approves Gate</span>
          </div>
          {pendingGuestRequests.slice(0, 3).map((pr) => (
            <div key={pr.id} className="flex items-center justify-between gap-3 rounded-xl bg-card-2 p-2.5">
              <div className="flex items-center gap-2.5 truncate">
                {pr.poster ? (
                  <img src={pr.poster} alt="" className="h-9 w-6 rounded object-cover" />
                ) : (
                  <div className="h-9 w-6 rounded bg-muted/20" />
                )}
                <div className="truncate">
                  <p className="truncate text-xs font-medium text-foreground">{pr.title}</p>
                  <p className="text-[10px] text-muted">{pr.requestedBy || "Guest"} • {pr.year || "Movie/TV"}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleApproveGuest(pr.id)}
                  className="rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-gold-fg shadow-sm transition hover:scale-102 cursor-pointer"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => void handleRejectGuest(pr.id)}
                  className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted hover:text-foreground cursor-pointer"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      

      {libraryCatchup.status === "running" ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-gold/30 bg-card p-4 shadow-[var(--shadow-border)]">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-medium text-gold">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-gold opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-gold" />
              </span>
              {libraryCatchup.message || "Library scanning in progress…"}
            </span>
            {libraryCatchup.total > 0 ? (
              <span className="font-mono text-muted">
                {Math.round((libraryCatchup.folder / libraryCatchup.total) * 100)}% ({libraryCatchup.folder}/{libraryCatchup.total})
              </span>
            ) : (
              <span className="text-muted">Scanning folders…</span>
            )}
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-card-2">
            {libraryCatchup.total > 0 ? (
              <div
                className="h-full rounded-full bg-gold transition-all duration-300 ease-out"
                style={{
                  width: `${Math.max(4, Math.min(100, Math.round((libraryCatchup.folder / libraryCatchup.total) * 100)))}%`,
                }}
              />
            ) : (
              <div className="h-full w-1/3 rounded-full bg-gold animate-[shimmer_1.6s_infinite]" />
            )}
          </div>
        </div>
      ) : null}



      {isKidsProfile ? (
        <div className="mb-6 rounded-2xl border-2 border-gold/40 bg-gold/15 p-4 text-center rise">
          <p className="font-display text-lg font-bold text-gold">👶 Kids Corner Active</p>
          <p className="mt-0.5 text-xs text-muted">Showing kid-safe movies and parent-approved family favorites only.</p>
        </div>
      ) : (
        <>
          {activeResident && !activeResident.hasCompletedMarqueePinning && !activeResident.dismissedFirstVisitMarquee ? (
            <div className="cinema-personalize mb-7 flex items-center justify-between gap-4 rounded-2xl px-5 py-4">
              <div>
                <p className="font-display text-sm font-semibold text-foreground">Make this room yours</p>
                <p className="mt-0.5 text-xs text-muted">Choose a few favorites and ReelOS will give your home screen a point of view.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMarqueeTray(true)}
                className="shrink-0 rounded-full border border-gold/35 bg-gold/10 px-3.5 py-2 text-xs font-semibold text-gold transition hover:bg-gold/18"
              >
                Personalize
              </button>
            </div>
          ) : null}
          {activeResident && showMarqueeTray && !activeResident.hasCompletedMarqueePinning && !activeResident.dismissedFirstVisitMarquee ? (
            <div className="mb-8">
              <MarqueePinningTray resident={activeResident} catalog={catalog} />
            </div>
          ) : null}
          <div className="mb-6">
            <ReelRoulette />
          </div>
        </>
      )}

      {recentlyAdded.length > 0 ? (
        <Row label="Recently added">
          {recentlyAdded.map((t) => (
            <TitleCard key={`recent-${t.id}`} title={t} />
          ))}
        </Row>
      ) : null}

      {continueWatch.length > 0 ? (
        <Row label="Continue watching">
          {continueWatch.map(({ t, v }) =>
            t ? (
              <div key={t.id} className="relative group/cw shrink-0">
                <TitleCard title={t} progress={v} />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDismissWatch(t.id);
                  }}
                  className="absolute top-2 right-2 z-30 flex size-7 items-center justify-center rounded-full bg-black/80 text-white/90 hover:text-white hover:bg-black border border-white/20 opacity-100 lg:opacity-0 lg:group-hover/cw:opacity-100 transition-opacity shadow-md cursor-pointer"
                  title="Dismiss from Continue Watching"
                  aria-label="Dismiss from Continue Watching"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : null,
          )}
        </Row>
      ) : null}

      {watchlistTitles.length > 0 ? (
        <Row label={`${activeResident.name}'s Watchlist`}>
          {watchlistTitles.map((t) => (
            <TitleCard key={`watchlist-${t.id}`} title={t} />
          ))}
        </Row>
      ) : null}

      {reqCards.length > 0 ? (
        <Row label="Your requests">
          {reqCards.map(({ r, t }) =>
            t ? <TitleCard key={r.id} title={t} request={r} /> : null,
          )}
        </Row>
      ) : null}

      {boxShelf.length > 0 ? (
        <Row label="On this box">
          {boxShelf.slice(0, 24).map((t) => (
            <div key={t.id} className="w-[148px] min-w-[148px] max-w-[148px] shrink-0 overflow-hidden sm:w-[168px] sm:min-w-[168px] sm:max-w-[168px]">
              <TitleCard title={t} className="w-full max-w-full" />
              <RemoveFromBox title={t} compact />
            </div>
          ))}
        </Row>
      ) : q.trim().length < 2 ? (
        <div className="mt-16 text-center space-y-3">
          <p className="font-display text-base font-medium text-foreground">
            Your personal cinema is ready.
          </p>
          <p className="text-xs text-muted max-w-sm mx-auto">
            Discover films and series to start streaming instantly.
          </p>
          <Link
            to="/discover"
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-xs font-semibold text-gold-fg shadow-sm hover:scale-102 transition"
          >
            Explore Discover →
          </Link>
        </div>
      ) : null}
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
