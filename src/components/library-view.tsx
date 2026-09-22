import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Clapperboard, ChevronRight } from "lucide-react";
import { TitleCard } from "@/components/title-card";
import { RemoveFromBox } from "@/components/remove-from-box";
import { homeShelfRows } from "@/lib/shelf";
import { useReelStore } from "@/lib/store";
import { useSyncRequests } from "@/lib/use-sync-requests";
import { useCurator } from "@/lib/use-curator";
import { CuratorStatus } from "@/components/curator-status";
import { titleIsCuratorLiked, titleIsCuratorHidden } from "@/lib/discover-curator";
import type { Kind, Title } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS: { id: "all" | Kind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "movie", label: "Movies" },
  { id: "tv", label: "TV" },
  { id: "anime", label: "Anime" },
  { id: "kids", label: "Kids" },
  { id: "music", label: "Music" },
];

export function LibraryView() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const curator = useCurator();
  const { hiddenIds, likedIds, voteTitle } = curator;
  const hydrateShelf = useReelStore((s) => s.hydrateShelf);
  const shelf = useReelStore((s) => s.shelf);
  const items = useMemo(() => homeShelfRows(shelf), [shelf]);
  useSyncRequests();
  const err = useReelStore((s) => s.shelfError);
  const shelfReady = useReelStore((s) => s.shelfReady);
  const intent = useReelStore((s) => s.answers.intent);
  const fuseOffline = useReelStore((s) => Boolean(s.fuseOffline || s.adapter.status === "offline"));
  const booksOn = useReelStore((s) => s.settings.betaChannel);
  const [books, setBooks] = useState<{ title: string; author: string; rel: string }[]>([]);

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

  useEffect(() => {
    hydrateShelf({ force: true, fresh: true });
  }, [hydrateShelf]);
  useEffect(() => {
    if (!booksOn) {
      setBooks([]);
      return;
    }
    void fetch("/api/books/library", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ books?: { title: string; author: string; rel: string }[] }>)
      .then((j) => setBooks(Array.isArray(j.books) ? j.books : []))
      .catch(() => setBooks([]));
  }, [booksOn]);

  const [scope, setScope] = useState<"resident" | "household">("resident");
  const hasAssigned = Boolean(
    activeResident?.id !== "res-primary" &&
    activeResident?.assignedTitleIds &&
    activeResident.assignedTitleIds.length > 0
  );

  const shown = useMemo(() => {
    let list = items.filter((t) => (tab === "all" ? true : t.kind === tab));
    if (scope === "resident" && hasAssigned && activeResident?.assignedTitleIds) {
      const allowed = new Set(activeResident.assignedTitleIds);
      const filtered = list.filter((t) => {
        if (allowed.has(t.id)) return true;
        if (t.jellyfinId && allowed.has(t.jellyfinId)) return true;
        if (Array.isArray(t.ids) && t.ids.some((i) => allowed.has(i))) return true;
        return false;
      });
      if (filtered.length > 0) {
        list = filtered;
      }
    }
    if (isKidsProfile) return list.filter(isKidTitle);
    if (hideKids && tab !== "kids") return list.filter((t) => !isKidTitle(t));
    return list;
  }, [items, tab, isKidsProfile, hideKids, kidsTitleIds, scope, hasAssigned, activeResident?.assignedTitleIds]);

  const tabs = TABS.filter((t) => {
    if (t.id === "all") return true;
    if (t.id === "movie") return intent.movies;
    if (t.id === "tv") return intent.tv;
    if (t.id === "anime") return intent.anime;
    if (t.id === "kids") return intent.kids;
    if (t.id === "music") return intent.music;
    return true;
  });

  return (
    <div className="w-full px-6 md:px-12 lg:px-16 py-6 md:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Library</h1>
          <p className="mt-2 text-sm text-muted">
            Titles ready to stream on this box in full 4K DirectPlay.
          </p>
        </div>
        {hasAssigned ? (
          <div className="flex items-center gap-1.5 self-start sm:self-auto rounded-2xl bg-card p-1 border border-border shadow-sm">
            <button
              type="button"
              onClick={() => setScope("resident")}
              className={cn(
                "rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                scope === "resident" ? "bg-gold text-gold-fg shadow-sm" : "text-muted hover:text-foreground",
              )}
            >
              {activeResident.name}'s Collection
            </button>
            <button
              type="button"
              onClick={() => setScope("household")}
              className={cn(
                "rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                scope === "household" ? "bg-gold text-gold-fg shadow-sm" : "text-muted hover:text-foreground",
              )}
            >
              All Household ({items.length})
            </button>
          </div>
        ) : null}
      </div>
      <CuratorStatus {...curator} />
      {isKidsProfile ? (
        <div className="mt-4 rounded-2xl border border-gold/40 bg-gold/10 p-3.5 text-center">
          <p className="font-display text-sm font-bold text-gold">👶 Kids Library Active</p>
          <p className="mt-0.5 text-xs text-muted">Showing kid-safe movies and parent-approved family favorites installed on this box.</p>
        </div>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "h-9 rounded-full px-4 text-sm",
              tab === t.id ? "bg-gold text-gold-fg" : "bg-card text-muted shadow-[var(--shadow-border)]",
            )}
          >
            {t.label}
          </button>
        ))}
        {booksOn ? (
          <Link to="/books" className="ml-1 self-center text-xs text-circuit">
            Books catalog{books.length ? ` · ${books.length}` : ""}
          </Link>
        ) : null}
      </div>
      {shown.length === 0 ? (
        fuseOffline ? (
          <div className="mt-8 rounded-2xl border border-warning/30 bg-card px-5 py-4 text-center text-sm font-medium text-warning shadow-[var(--shadow-border)]">
            Cinema cloud connection offline — library temporarily unavailable
          </div>
        ) : (
          <div className="mt-10 flex flex-col items-center justify-center rounded-3xl border border-border/60 bg-card/40 p-10 text-center shadow-inner">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-gold/10 text-gold border border-gold/25 mb-4">
              <Clapperboard className="size-7" />
            </div>
            {scope === "resident" && items.length > 0 ? (
              <>
                <h3 className="font-display text-lg font-semibold text-foreground">
                  No Titles in {activeResident.name}’s Collection
                </h3>
                <p className="mt-1 max-w-sm text-xs text-muted leading-relaxed">
                  There are {items.length} titles available in the household library.
                </p>
                <button
                  type="button"
                  onClick={() => setScope("household")}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-xs font-bold text-gold-fg shadow-[var(--shadow-gold)] hover:bg-gold-bright transition-all cursor-pointer"
                >
                  <span>View All Household ({items.length})</span>
                  <ChevronRight className="size-4" />
                </button>
              </>
            ) : (
              <>
                <h3 className="font-display text-lg font-semibold text-foreground">Your Library is Empty</h3>
                <p className="mt-1 max-w-sm text-xs text-muted leading-relaxed">
                  Browse movies and shows in Discover. Requesting a title links it directly to this box in full 4K within seconds.
                </p>
                <Link
                  to="/discover"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-xs font-bold text-gold-fg shadow-[var(--shadow-gold)] hover:bg-gold-bright transition-all"
                >
                  <span>Explore Discover</span>
                  <ChevronRight className="size-4" />
                </Link>
              </>
            )}
          </div>
        )
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 4xl:grid-cols-9 5xl:grid-cols-10">
          {shown.map((t) => (
            <div key={t.id} className="min-w-0 overflow-hidden">
              <TitleCard
                title={t}
                className="w-full max-w-full"
                onVote={voteTitle}
                liked={titleIsCuratorLiked(t, likedIds)}
                hidden={titleIsCuratorHidden(t, hiddenIds)}
              />
              <RemoveFromBox title={t} compact />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
