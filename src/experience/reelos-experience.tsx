import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  ChevronRight,
  Compass,
  Home,
  Library,
  Pause,
  Play,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Volume2,
  X,
} from "lucide-react";
import { type CSSProperties, useMemo, useState } from "react";
import { OnboardingFlow } from "@/experience/onboarding-flow";
import { FamilySuite } from "@/experience/family-suite";
import { LibraryArchive } from "@/experience/library-archive";
import { BooksView } from "@/components/books-view";

type View =
  | "home"
  | "discover"
  | "library"
  | "books"
  | "family"
  | "player"
  | "settings"
  | "onboarding";
type Film = {
  id: string;
  title: string;
  year: number;
  genre: string;
  image: string;
  backdrop: string;
  note: string;
  family?: boolean;
};

const FILMS: Film[] = [
  {
    id: "matrix",
    title: "The Matrix",
    year: 1999,
    genre: "Science fiction",
    image: "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
    backdrop:
      "https://image.tmdb.org/t/p/original/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg",
    note: "A world-changing escape for a late night.",
  },
  {
    id: "dune",
    title: "Dune: Part Two",
    year: 2024,
    genre: "Epic adventure",
    image: "https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
    backdrop:
      "https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJv9JCnx7s5200SV.jpg",
    note: "Big, strange, and best with the lights down.",
  },
  {
    id: "spirited",
    title: "Spirited Away",
    year: 2001,
    genre: "Animated fantasy",
    image: "https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
    backdrop:
      "https://image.tmdb.org/t/p/original/Ab8mkHmkYADjU7wQiOkia99GQI.jpg",
    note: "A gentle doorway into another world.",
    family: true,
  },
  {
    id: "interstellar",
    title: "Interstellar",
    year: 2014,
    genre: "Science fiction",
    image: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    backdrop:
      "https://image.tmdb.org/t/p/original/rAiYTsqJiOEZg05z5U4jD8rU07E.jpg",
    note: "For when home wants to feel enormous.",
  },
  {
    id: "batman",
    title: "The Batman",
    year: 2022,
    genre: "Mystery",
    image: "https://image.tmdb.org/t/p/w500/74xTEgt7R36Fpooo50r9T25onhq.jpg",
    backdrop:
      "https://image.tmdb.org/t/p/original/b0PlSFdDwbyK0cf5RxwDpaOJQvQ.jpg",
    note: "Rain, shadow, and a very long night.",
  },
  {
    id: "paddington",
    title: "Paddington 2",
    year: 2017,
    genre: "Family",
    image: "https://image.tmdb.org/t/p/w500/1OJ9vkD5xPt3skC6KguyXAgagRZ.jpg",
    backdrop:
      "https://image.tmdb.org/t/p/original/5E6y0JbQhNkyHfWwbvYB2YjMxFq.jpg",
    note: "A bright little reset for everyone.",
    family: true,
  },
];

export function ReelOSExperience() {
  const [view, setView] = useState<View>("home");
  const [hero, setHero] = useState(FILMS[0]);
  const [saved, setSaved] = useState<string[]>([]);
  const [kidsHere, setKidsHere] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Film | null>(null);
  const [playing, setPlaying] = useState<Film | null>(null);
  const [profileMenu, setProfileMenu] = useState(false);
  const [atmosphere, setAtmosphere] = useState<"midnight" | "ember" | "ocean">(
    "midnight",
  );
  const [favoriteColor, setFavoriteColor] = useState("#b8c7ff");
  const visibleFilms = useMemo(
    () => (kidsHere ? FILMS.filter((film) => film.family) : FILMS),
    [kidsHere],
  );
  const toggleSaved = (id: string) =>
    setSaved((items) =>
      items.includes(id) ? items.filter((item) => item !== id) : [...items, id],
    );
  const nav = (next: View) => {
    setView(next);
    setSearching(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const searchResults = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const literalMatches = FILMS.filter((film) =>
      words.some((word) =>
        `${film.title} ${film.genre} ${film.note}`.toLowerCase().includes(word),
      ),
    );
    return words.length ? literalMatches : FILMS.slice(0, 4);
  }, [query]);

  return (
    <div
      data-atmosphere={atmosphere}
      data-view={view}
      style={
        {
          "--reelos-favorite": favoriteColor,
          "--color-gold": favoriteColor,
          "--color-gold-bright": favoriteColor,
        } as CSSProperties
      }
      className="reelos-experience min-h-dvh bg-[#080809] text-[#f5f1eb] selection:bg-[#eebd69]/30"
    >
      <header className="reelos-header sticky top-0 z-40 border-b border-white/8 bg-[#080809]/86 px-5 backdrop-blur-2xl md:px-10">
        <div className="mx-auto flex h-[76px] max-w-[1600px] items-center justify-between gap-4">
          <button
            onClick={() => nav("home")}
            className="flex items-center gap-3 text-left"
          >
            <span className="grid size-9 place-items-center rounded-full border border-[#eebd69]/35 bg-[#eebd69]/12 text-sm font-black text-[#eebd69]">
              R
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight">
              ReelOS
            </span>
          </button>
          <nav className="hidden items-center gap-1 lg:flex">
            {(
              [
                ["home", "Home", Home],
                ["discover", "Discover", Compass],
                ["library", "Library", Library],
                ["books", "Books", BookOpen],
                ["family", "Family", ShieldCheck],
                ["settings", "Settings", SlidersHorizontal],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => nav(id)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${view === id ? "bg-white/10 text-white" : "text-white/52 hover:text-white"}`}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearching(true)}
              aria-label="Find something to watch"
              className="reelos-ask grid size-10 place-items-center rounded-full border text-white/75"
            >
              <Search className="size-4 text-[#eebd69]" />
            </button>
            <button
              onClick={() => setKidsHere((value) => !value)}
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${kidsHere ? "border-[#eebd69]/60 bg-[#eebd69] text-[#211507]" : "border-white/12 text-white/70 hover:border-white/30"}`}
            >
              {kidsHere ? "Kids here" : "Adults only"}
            </button>
            <button
              onClick={() => setProfileMenu(true)}
              className="reelos-profile grid size-9 place-items-center rounded-full text-xs font-bold"
              aria-label="Change profile"
            >
              A
            </button>
          </div>
        </div>
      </header>

      {view === "home" && (
        <HomeScreenV3
          hero={hero}
          saved={saved}
          onSave={toggleSaved}
          onHero={setHero}
          onNavigate={nav}
          onSelect={setSelected}
          onPlay={setPlaying}
          onSearch={() => setSearching(true)}
          films={visibleFilms}
          kidsHere={kidsHere}
        />
      )}
      {view === "discover" && (
        <DiscoverScreen
          films={visibleFilms}
          onSelect={setSelected}
          onSearch={(text = "") => {
            setQuery(text);
            setSearching(true);
          }}
        />
      )}
      {view === "library" && (
        <LibraryArchive onOpenBooks={() => nav("books")} />
      )}
      {view === "books" && (
        <div className="reelos-books-host mx-auto max-w-[1600px] px-5 py-8 md:px-10">
          <BooksView />
        </div>
      )}
      {view === "family" && <FamilySuite />}
      {view === "settings" && (
        <SettingsScreen
          atmosphere={atmosphere}
          setAtmosphere={setAtmosphere}
          favoriteColor={favoriteColor}
          setFavoriteColor={setFavoriteColor}
          onOpenFamily={() => nav("family")}
          onOpenSetup={() => nav("onboarding")}
        />
      )}
      {view === "onboarding" && (
        <OnboardingFlow
          onColor={setFavoriteColor}
          onFinish={() => nav("home")}
        />
      )}
      {view === "player" && playing && (
        <PlayerScreen film={playing} onExit={() => nav("home")} />
      )}

      {view !== "onboarding" && view !== "player" && (
        <nav
          aria-label="Primary navigation"
          className="reelos-mobile-nav fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 rounded-[1.4rem] border border-white/12 bg-[#101014]/92 p-1.5 shadow-2xl backdrop-blur-2xl lg:hidden"
        >
          {(
            [
              ["home", "Home", Home],
              ["discover", "Discover", Compass],
              ["library", "Library", Library],
              ["books", "Books", BookOpen],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => nav(id)}
              aria-current={view === id ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition ${view === id ? "bg-white/10 text-white" : "text-white/52"}`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </nav>
      )}

      {searching && (
        <div className="fixed inset-0 z-50 grid place-items-start bg-black/75 p-5 pt-[12vh] backdrop-blur-md">
          <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/12 bg-[#151416] shadow-2xl">
            <div className="flex items-center gap-3 border-b border-white/8 px-5">
              <Search className="size-5 text-[#eebd69]" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try: I need something strange but not too heavy"
                className="h-16 flex-1 bg-transparent text-base outline-none placeholder:text-white/35"
              />
              <button
                onClick={() => setSearching(false)}
                className="p-2 text-white/55"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="border-b border-white/8 px-5 py-4">
              <p className="text-sm text-white/72">
                {query
                  ? "I hear you. Here’s where I’d start."
                  : "Tell ReelOS what you want—not just a title."}
              </p>
              <p className="mt-1 text-xs text-white/40">
                A feeling, an old favorite, a person, a half-remembered scene.
              </p>
            </div>
            <div className="p-3">
              {query && searchResults.length === 0 && (
                <div className="rounded-2xl border border-white/8 bg-white/[.035] p-5">
                  <b className="block text-sm">Nothing exact yet.</b>
                  <p className="mt-2 text-sm leading-6 text-white/45">
                    Try a title, actor, mood, or fewer details. The full catalog
                    and request path will replace this preview index.
                  </p>
                </div>
              )}
              {searchResults.map((film) => (
                <button
                  key={film.id}
                  onClick={() => {
                    setSelected(film);
                    setSearching(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-white/6"
                >
                  <img
                    src={film.image}
                    alt=""
                    className="h-14 w-10 rounded-lg object-cover"
                  />
                  <span>
                    <b className="block text-sm">{film.title}</b>
                    <small className="text-white/45">
                      {film.year} · {film.genre}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {profileMenu && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/35 p-5 pt-20 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-[1.75rem] border border-white/10 bg-[#14141a] p-3 shadow-2xl">
            <p className="px-3 pb-3 pt-2 text-xs text-white/45">Who’s here?</p>
            {["Austin", "Kids", "Guest"].map((name) => (
              <button
                key={name}
                onClick={() => {
                  setProfileMenu(false);
                  setKidsHere(name === "Kids");
                }}
                className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-white/7"
              >
                <span className="grid size-10 place-items-center rounded-full bg-white/10 text-sm font-bold">
                  {name[0]}
                </span>
                <span>
                  <b className="block text-sm">{name}</b>
                  <small className="text-white/45">
                    {name === "Austin"
                      ? "Your taste, tonight"
                      : name === "Kids"
                        ? "A calmer home"
                        : "Start fresh"}
                  </small>
                </span>
              </button>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/8 pt-3 lg:hidden">
              <button
                onClick={() => {
                  setProfileMenu(false);
                  nav("family");
                }}
                className="rounded-xl border border-white/10 px-3 py-3 text-sm font-semibold text-white/75"
              >
                Family
              </button>
              <button
                onClick={() => {
                  setProfileMenu(false);
                  nav("settings");
                }}
                className="rounded-xl border border-white/10 px-3 py-3 text-sm font-semibold text-white/75"
              >
                Settings
              </button>
            </div>
          </div>
        </div>
      )}
      {selected && (
        <FilmSheet
          film={selected}
          saved={saved.includes(selected.id)}
          onClose={() => setSelected(null)}
          onSave={() => toggleSaved(selected.id)}
          onPlay={() => {
            setPlaying(selected);
            setSelected(null);
            nav("player");
          }}
        />
      )}
    </div>
  );
}

function HomeScreenV3({
  hero,
  saved,
  onSave,
  onHero,
  onNavigate,
  onSelect,
  onPlay,
  onSearch,
  films,
  kidsHere,
}: {
  hero: Film;
  saved: string[];
  onSave(id: string): void;
  onHero(film: Film): void;
  onNavigate(view: View): void;
  onSelect(film: Film): void;
  onPlay(film: Film): void;
  onSearch(): void;
  films: Film[];
  kidsHere: boolean;
}) {
  return (
    <>
      <section className="reelos-hero relative min-h-[450px] overflow-hidden px-5 pb-6 pt-5 md:min-h-[460px] md:px-10">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-55"
          style={{ backgroundImage: `url(${hero.backdrop})` }}
        />
        <div className="reelos-aurora reelos-aurora-one" />
        <div className="reelos-aurora reelos-aurora-two" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#080809_5%,rgba(8,8,9,.79)_42%,rgba(8,8,9,.22)),linear-gradient(0deg,#080809_0%,transparent_58%)]" />
        <div className="relative mx-auto flex min-h-[420px] max-w-[1600px] flex-col justify-between md:min-h-[425px]">
          <p className="reelos-arrive mt-3 text-[11px] font-bold uppercase tracking-[.2em] text-[#eebd69]">
            {kidsHere ? "Family time" : "Tonight at home"}
          </p>
          <div className="reelos-arrive max-w-2xl pb-6">
            <p className="mb-3 text-lg text-white/70">Good evening, Austin.</p>
            <h1 className="font-display text-[clamp(3.9rem,9vw,8.8rem)] font-black leading-[.82] tracking-[-.075em]">
              {hero.title}
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-white/68">
              {hero.note}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  onPlay(hero);
                  onNavigate("player");
                }}
                className="reelos-play inline-flex items-center gap-2 rounded-full bg-[#f0ba61] px-6 py-3.5 text-sm font-bold text-[#211507]"
              >
                <Play className="size-4 fill-current" />
                Play now
              </button>
              <button
                onClick={() => onSave(hero.id)}
                className="inline-flex items-center gap-2 rounded-full border border-white/17 bg-black/15 px-5 py-3.5 text-sm font-semibold backdrop-blur-sm"
              >
                <Bookmark
                  className={
                    saved.includes(hero.id)
                      ? "size-4 fill-[#eebd69] text-[#eebd69]"
                      : "size-4"
                  }
                />
                {saved.includes(hero.id) ? "Saved" : "Save for later"}
              </button>
            </div>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div className="flex gap-2">
              {films.slice(0, 5).map((film) => (
                <button
                  key={film.id}
                  onClick={() => onHero(film)}
                  className={`h-1.5 rounded-full transition-all ${film.id === hero.id ? "w-8 bg-[#eebd69]" : "w-2 bg-white/35"}`}
                />
              ))}
            </div>
            <button
              onClick={() => onSelect(hero)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-white/72 hover:text-white"
            >
              The details <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-[1600px] px-5 pt-7 md:px-10">
        <button
          onClick={onSearch}
          className="reelos-search-door group flex w-full items-center gap-4 rounded-[1.4rem] border px-5 py-5 text-left"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/7 text-[#eebd69]">
            <Search className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-base font-semibold">
              I don’t know what I want to watch.
            </b>
            <span className="mt-1 block truncate text-sm text-white/45">
              Tell ReelOS a feeling, a memory, or a fragment of a scene.
            </span>
          </span>
          <ChevronRight className="size-5 text-white/35 transition group-hover:translate-x-1" />
        </button>
      </section>
      <section className="mx-auto max-w-[1600px] px-5 py-12 md:px-10">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-3xl font-bold tracking-[-.05em]">
            A few good bets.
          </h2>
          <button
            onClick={() => onNavigate("library")}
            className="text-sm text-white/60 hover:text-white"
          >
            Your collection
          </button>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {films.slice(1).map((film) => (
            <Poster key={film.id} film={film} onClick={() => onSelect(film)} />
          ))}
        </div>
      </section>
      <section className="reelos-no-idea relative overflow-hidden border-y border-white/7 px-5 py-20 md:px-10">
        <div className="reelos-falling-art" aria-hidden="true">
          {FILMS.slice(0, 5).map((film) => (
            <img key={film.id} src={film.image} alt="" />
          ))}
        </div>
        <div className="relative mx-auto max-w-[1600px]">
          <div className="max-w-xl">
            <p className="text-sm text-[#eebd69]">
              When nothing is calling you
            </p>
            <h2 className="mt-3 font-display text-5xl font-black tracking-[-.07em]">
              No idea what to watch?
            </h2>
            <p className="mt-4 max-w-md leading-7 text-white/62">
              That’s when ReelOS should be at its best. Give it the steering
              wheel—or just tell it how tonight feels.
            </p>
          </div>
          <div className="mt-10 grid gap-3 md:grid-cols-3">
            <Mood
              title="Pick for me."
              note="I trust you. Take the wheel."
              tone="from-[#24305c] to-[#0d1020]"
              onClick={() => onNavigate("discover")}
            />
            <Mood
              title="Give me a feeling."
              note="Find the right temperature for tonight."
              tone="from-[#1d4a58] to-[#09191f]"
              onClick={() => onNavigate("discover")}
            />
            <Mood
              title="Something we already love."
              note="Stay close to home."
              tone="from-[#392d5a] to-[#161126]"
              onClick={() => onNavigate("library")}
            />
          </div>
        </div>
      </section>
    </>
  );
}

function HomeScreenV2({
  hero,
  saved,
  onSave,
  onHero,
  onNavigate,
  onSelect,
  onPlay,
  onSearch,
  films,
  kidsHere,
}: {
  hero: Film;
  saved: string[];
  onSave(id: string): void;
  onHero(film: Film): void;
  onNavigate(view: View): void;
  onSelect(film: Film): void;
  onPlay(film: Film): void;
  onSearch(): void;
  films: Film[];
  kidsHere: boolean;
}) {
  return (
    <>
      <section className="reelos-hero relative min-h-[450px] overflow-hidden px-5 pb-6 pt-5 md:min-h-[460px] md:px-10">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-55"
          style={{ backgroundImage: `url(${hero.backdrop})` }}
        />
        <div className="reelos-aurora reelos-aurora-one" />
        <div className="reelos-aurora reelos-aurora-two" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#080809_5%,rgba(8,8,9,.79)_42%,rgba(8,8,9,.22)),linear-gradient(0deg,#080809_0%,transparent_58%)]" />
        <div className="relative mx-auto flex min-h-[420px] max-w-[1600px] flex-col justify-between md:min-h-[425px]">
          <p className="reelos-arrive mt-3 text-[11px] font-bold uppercase tracking-[.2em] text-[#eebd69]">
            {kidsHere ? "Family time" : "Tonight at home"}
          </p>
          <div className="reelos-arrive max-w-2xl pb-6">
            <p className="mb-3 text-lg text-white/70">Good evening, Austin.</p>
            <h1 className="font-display text-[clamp(3.9rem,9vw,8.8rem)] font-black leading-[.82] tracking-[-.075em]">
              {hero.title}
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-white/68">
              {hero.note}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  onPlay(hero);
                  onNavigate("player");
                }}
                className="reelos-play inline-flex items-center gap-2 rounded-full bg-[#f0ba61] px-6 py-3.5 text-sm font-bold text-[#211507]"
              >
                <Play className="size-4 fill-current" />
                Play now
              </button>
              <button
                onClick={() => onSave(hero.id)}
                className="inline-flex items-center gap-2 rounded-full border border-white/17 bg-black/15 px-5 py-3.5 text-sm font-semibold backdrop-blur-sm"
              >
                <Bookmark
                  className={
                    saved.includes(hero.id)
                      ? "size-4 fill-[#eebd69] text-[#eebd69]"
                      : "size-4"
                  }
                />
                {saved.includes(hero.id) ? "Saved" : "Save for later"}
              </button>
            </div>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div className="flex gap-2">
              {films.slice(0, 5).map((film) => (
                <button
                  key={film.id}
                  onClick={() => onHero(film)}
                  className={`h-1.5 rounded-full transition-all ${film.id === hero.id ? "w-8 bg-[#eebd69]" : "w-2 bg-white/35"}`}
                />
              ))}
            </div>
            <button
              onClick={() => onSelect(hero)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-white/72 hover:text-white"
            >
              The details <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-[1600px] px-5 pt-7 md:px-10">
        <button
          onClick={onSearch}
          className="reelos-search-door group flex w-full items-center gap-4 rounded-[1.4rem] border px-5 py-5 text-left"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/7 text-[#eebd69]">
            <Search className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-base font-semibold">
              I don’t know what I want to watch.
            </b>
            <span className="mt-1 block truncate text-sm text-white/45">
              Tell ReelOS a feeling, a memory, or a fragment of a scene.
            </span>
          </span>
          <ChevronRight className="size-5 text-white/35 transition group-hover:translate-x-1" />
        </button>
      </section>
      <section className="reelos-arrive mx-auto max-w-[1600px] px-5 py-12 md:px-10">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-[-.05em]">
              No idea what to watch?
            </h2>
          </div>
          <button
            onClick={() => onNavigate("discover")}
            className="hidden items-center gap-1 text-sm text-white/60 hover:text-white sm:flex"
          >
            See more <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="mt-7 grid gap-3 md:grid-cols-3">
          <Mood
            title="Pick for me."
            note="I trust you. Take the wheel."
            tone="from-[#24305c] to-[#0d1020]"
            onClick={() => onNavigate("discover")}
          />
          <Mood
            title="Give me a feeling."
            note="Find the right temperature for tonight."
            tone="from-[#1d4a58] to-[#09191f]"
            onClick={() => onNavigate("discover")}
          />
          <Mood
            title="Something we already love."
            note="Stay close to home."
            tone="from-[#392d5a] to-[#161126]"
            onClick={() => onNavigate("library")}
          />
        </div>
        <div className="mt-16 flex items-end justify-between">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-[-.05em]">
              A few good bets.
            </h2>
          </div>
          <button
            onClick={() => onNavigate("library")}
            className="text-sm text-white/60 hover:text-white"
          >
            Your collection
          </button>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {films.slice(1).map((film) => (
            <Poster key={film.id} film={film} onClick={() => onSelect(film)} />
          ))}
        </div>
      </section>
    </>
  );
}

function HomeScreen({
  hero,
  saved,
  onSave,
  onHero,
  onNavigate,
  onSelect,
  onPlay,
  films,
  kidsHere,
}: {
  hero: Film;
  saved: string[];
  onSave(id: string): void;
  onHero(film: Film): void;
  onNavigate(view: View): void;
  onSelect(film: Film): void;
  onPlay(film: Film): void;
  films: Film[];
  kidsHere: boolean;
}) {
  return (
    <>
      <section className="reelos-hero relative min-h-[520px] overflow-hidden px-5 pb-7 pt-5 md:min-h-[590px] md:px-10">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-55"
          style={{ backgroundImage: `url(${hero.backdrop})` }}
        />
        <div className="reelos-aurora reelos-aurora-one" />
        <div className="reelos-aurora reelos-aurora-two" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#080809_5%,rgba(8,8,9,.79)_42%,rgba(8,8,9,.22)),linear-gradient(0deg,#080809_0%,transparent_58%)]" />
        <div className="relative mx-auto flex min-h-[490px] max-w-[1600px] flex-col justify-between md:min-h-[555px]">
          <p className="reelos-arrive mt-3 text-[11px] font-bold uppercase tracking-[.2em] text-[#eebd69]">
            {kidsHere ? "Family time" : "Tonight at home"}
          </p>
          <div className="reelos-arrive max-w-2xl pb-8">
            <p className="mb-3 text-lg text-white/70">Good evening, Austin.</p>
            <h1 className="font-display text-[clamp(3.9rem,9vw,8.8rem)] font-black leading-[.82] tracking-[-.075em]">
              {hero.title}
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-white/68">
              {hero.note}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  onPlay(hero);
                  onNavigate("player");
                }}
                className="reelos-play inline-flex items-center gap-2 rounded-full bg-[#f0ba61] px-6 py-3.5 text-sm font-bold text-[#211507] shadow-xl shadow-black/20"
              >
                <Play className="size-4 fill-current" />
                Play now
              </button>
              <button
                onClick={() => onSave(hero.id)}
                className="inline-flex items-center gap-2 rounded-full border border-white/17 bg-black/15 px-5 py-3.5 text-sm font-semibold backdrop-blur-sm"
              >
                <Bookmark
                  className={
                    saved.includes(hero.id)
                      ? "size-4 fill-[#eebd69] text-[#eebd69]"
                      : "size-4"
                  }
                />
                {saved.includes(hero.id) ? "Saved" : "Save for later"}
              </button>
            </div>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div className="flex gap-2">
              {films.slice(0, 5).map((film) => (
                <button
                  key={film.id}
                  onClick={() => onHero(film)}
                  className={`h-1.5 rounded-full transition-all ${film.id === hero.id ? "w-8 bg-[#eebd69]" : "w-2 bg-white/35"}`}
                />
              ))}
            </div>
            <button
              onClick={() => onSelect(hero)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-white/72 hover:text-white"
            >
              The details <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </section>
      <section className="reelos-arrive mx-auto max-w-[1600px] px-5 py-12 md:px-10">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#eebd69]">
              A place to begin
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-[-.05em]">
              How does the night feel?
            </h2>
          </div>
          <button
            onClick={() => onNavigate("discover")}
            className="hidden items-center gap-1 text-sm text-white/60 hover:text-white sm:flex"
          >
            See more <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="mt-7 grid gap-3 md:grid-cols-3">
          <Mood
            title="Easy & familiar"
            note="Comfort without compromise"
            tone="from-[#5d3320] to-[#1c1412]"
            onClick={() => onNavigate("discover")}
          />
          <Mood
            title="Show me something"
            note="A good surprise, chosen well"
            tone="from-[#26244c] to-[#15141d]"
            onClick={() => onNavigate("discover")}
          />
          <Mood
            title="From our shelf"
            note="The stories already here"
            tone="from-[#214134] to-[#121a16]"
            onClick={() => onNavigate("library")}
          />
        </div>
        <div className="mt-16 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#eebd69]">
              Keep nearby
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-[-.05em]">
              Next on the shelf
            </h2>
          </div>
          <button
            onClick={() => onNavigate("library")}
            className="text-sm text-white/60 hover:text-white"
          >
            Your collection
          </button>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {films.slice(1).map((film) => (
            <Poster key={film.id} film={film} onClick={() => onSelect(film)} />
          ))}
        </div>
      </section>
    </>
  );
}

function DiscoverScreen({
  films,
  onSelect,
  onSearch,
}: {
  films: Film[];
  onSelect(film: Film): void;
  onSearch(text?: string): void;
}) {
  const [turn, setTurn] = useState("big");
  const choices = [
    {
      id: "big",
      label: "Make it big",
      note: "Lose yourself for a while.",
      film: "dune",
    },
    {
      id: "strange",
      label: "Something strange",
      note: "A door into another world.",
      film: "spirited",
    },
    {
      id: "rain",
      label: "Dark & rainy",
      note: "A very long night.",
      film: "batman",
    },
    {
      id: "warm",
      label: "Keep it warm",
      note: "A soft place to land.",
      film: "paddington",
    },
  ];
  const choice = choices.find((item) => item.id === turn) ?? choices[0];
  const feature = films.find((film) => film.id === choice.film) ?? films[0];
  const next = films.filter((film) => film.id !== feature?.id).slice(0, 3);
  const shelfFilms = (ids: string[]) =>
    ids
      .map((id) => films.find((film) => film.id === id))
      .filter((film): film is Film => Boolean(film));
  const shelves = [
    {
      name: "Built for the lights off",
      note: "Home gets a little bigger.",
      ids: [
        "dune",
        "matrix",
        "interstellar",
        "batman",
        "spirited",
        "paddington",
      ],
    },
    {
      name: "Worlds with a pull",
      note: "Easy to enter. Hard to leave.",
      ids: [
        "spirited",
        "dune",
        "paddington",
        "matrix",
        "interstellar",
        "batman",
      ],
    },
    {
      name: "A little after midnight",
      note: "Rain, questions, and no hurry.",
      ids: [
        "batman",
        "matrix",
        "interstellar",
        "dune",
        "spirited",
        "paddington",
      ],
    },
  ];

  if (!feature) return null;

  return (
    <main className="reelos-discover overflow-hidden pb-16">
      <section className="relative mx-auto max-w-[1600px] px-5 pb-5 pt-6 md:px-10 md:pt-10">
        <div className="reelos-discover-glow" aria-hidden="true" />
        <div className="relative max-w-3xl">
          <p className="text-lg text-white/58">
            Not sure yet is a perfectly good place to start.
          </p>
          <h1 className="mt-3 font-display text-[clamp(3.5rem,8vw,7.8rem)] font-semibold leading-[.88] tracking-[-.075em]">
            Which way
            <br />
            does tonight lean?
          </h1>
        </div>
        <div className="relative mt-9 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none]">
          {choices.map((item) => (
            <button
              key={item.id}
              onClick={() => setTurn(item.id)}
              className={`reelos-discover-turn shrink-0 rounded-full border px-5 py-3.5 text-left transition ${turn === item.id ? "border-white/65 bg-white text-[#101014]" : "border-white/15 bg-white/[.035] text-white hover:border-white/40"}`}
            >
              <b className="block text-sm">{item.label}</b>
            </button>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-[1600px] px-5 md:px-10">
        <button
          onClick={() => onSelect(feature)}
          className="reelos-discover-feature group relative block min-h-[470px] w-full overflow-hidden rounded-[2rem] border border-white/10 text-left md:min-h-[520px]"
        >
          <img
            src={feature.backdrop}
            alt=""
            className="absolute inset-0 size-full object-cover opacity-70 transition duration-700 group-hover:scale-[1.025]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,8,10,.96)_2%,rgba(8,8,10,.67)_42%,rgba(8,8,10,.08)),linear-gradient(0deg,rgba(8,8,10,.56),transparent_55%)]" />
          <div className="relative flex min-h-[470px] max-w-xl flex-col justify-end p-6 md:min-h-[520px] md:p-10">
            <p className="text-base text-white/66">{choice.note}</p>
            <h2 className="mt-3 font-display text-[clamp(3.2rem,6vw,6.3rem)] font-bold leading-[.87] tracking-[-.07em]">
              {feature.title}
            </h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/65">
              {feature.note}
            </p>
            <span className="mt-7 inline-flex w-fit items-center gap-2 rounded-full border border-white/18 bg-black/20 px-5 py-3 text-sm font-semibold backdrop-blur-sm">
              Open this door <ChevronRight className="size-4" />
            </span>
          </div>
        </button>
      </section>
      <section className="mx-auto mt-10 max-w-[1600px] px-5 md:mt-14 md:px-10">
        <div className="grid gap-3 md:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[.035] p-6 md:p-8">
            <p className="text-white/48">Follow a face you already trust.</p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {[
                "Florence Pugh",
                "Pedro Pascal",
                "Viola Davis",
                "Ayo Edebiri",
                "Ryan Gosling",
                "Zendaya",
              ].map((person) => (
                <button
                  key={person}
                  onClick={() => onSearch(person)}
                  className="rounded-full border border-white/13 px-4 py-3 text-sm text-white/78 transition hover:border-white/50 hover:bg-white/8"
                >
                  {person}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => onSearch()}
            className="reelos-discover-request rounded-[1.75rem] border border-white/10 p-6 text-left md:p-8"
          >
            <p className="text-white/48">A title, a memory, half a scene?</p>
            <b className="mt-7 block font-display text-3xl leading-none tracking-[-.055em]">
              Find it anyway.
            </b>
            <span className="mt-5 inline-flex items-center gap-1 text-sm text-white/70">
              Tell ReelOS what you remember <ChevronRight className="size-4" />
            </span>
          </button>
        </div>
      </section>
      <section className="mx-auto mt-12 max-w-[1600px] px-5 md:mt-16 md:px-10">
        <p className="text-sm text-white/48">A few nearby worlds</p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {next.map((film) => (
            <button
              key={film.id}
              onClick={() => onSelect(film)}
              className="reelos-discover-nearby group relative aspect-[1.22] overflow-hidden rounded-[1.5rem] border border-white/10 text-left"
            >
              <img
                src={film.backdrop}
                alt=""
                className="size-full object-cover opacity-60 transition duration-500 group-hover:scale-105 group-hover:opacity-80"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-transparent" />
              <span className="absolute inset-x-4 bottom-4">
                <b className="block font-display text-xl tracking-[-.04em]">
                  {film.title}
                </b>
                <small className="mt-1 block text-white/55">{film.genre}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="mx-auto mt-16 max-w-[1600px] space-y-16 px-5 md:mt-24 md:px-10">
        {shelves.map((shelf) => (
          <div key={shelf.name}>
            <div className="flex items-end justify-between gap-5">
              <div>
                <h2 className="font-display text-[clamp(1.9rem,3vw,3.2rem)] font-semibold leading-none tracking-[-.06em]">
                  {shelf.name}
                </h2>
                <p className="mt-2 text-sm text-white/48">{shelf.note}</p>
              </div>
              <span className="hidden text-sm text-white/38 sm:block">
                Chosen for you
              </span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {shelfFilms(shelf.ids).map((film) => (
                <Poster
                  key={`${shelf.name}-${film.id}`}
                  film={film}
                  onClick={() => onSelect(film)}
                />
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
function LibraryScreen({
  films,
  saved,
  onSelect,
}: {
  films: Film[];
  saved: string[];
  onSelect(film: Film): void;
}) {
  return (
    <section className="mx-auto max-w-[1600px] px-5 py-16 md:px-10">
      <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#eebd69]">
        Your collection
      </p>
      <h1 className="mt-3 font-display text-5xl font-black tracking-[-.07em]">
        Stories that are already yours.
      </h1>
      <p className="mt-4 text-white/58">
        {saved.length
          ? `${saved.length} saved for another night.`
          : "Start saving films you want to keep close."}
      </p>
      <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {films.map((film) => (
          <Poster key={film.id} film={film} onClick={() => onSelect(film)} />
        ))}
      </div>
    </section>
  );
}
function FamilyScreen({
  kidsHere,
  setKidsHere,
  onNavigate,
}: {
  kidsHere: boolean;
  setKidsHere(value: boolean): void;
  onNavigate(view: View): void;
}) {
  return (
    <section className="mx-auto max-w-4xl px-5 py-16 md:px-10">
      <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#eebd69]">
        For the people in this home
      </p>
      <h1 className="mt-3 font-display text-5xl font-black tracking-[-.07em]">
        One home. Everyone welcome.
      </h1>
      <div className="mt-12 rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(238,189,105,.16),rgba(255,255,255,.03))] p-8">
        <ShieldCheck className="size-7 text-[#eebd69]" />
        <h2 className="mt-6 font-display text-3xl font-bold">Kids at home</h2>
        <p className="mt-3 max-w-xl leading-7 text-white/62">
          Switch home into a calmer, family-friendly shape. The final backend
          connection will make this control enforce the household’s actual
          content rules.
        </p>
        <button
          onClick={() => setKidsHere(!kidsHere)}
          className={`mt-7 rounded-full px-5 py-3 text-sm font-bold ${kidsHere ? "bg-[#eebd69] text-[#221506]" : "border border-white/16 text-white"}`}
        >
          {kidsHere ? "Kids mode is on" : "Turn on kids mode"}
        </button>
        <button
          onClick={() => onNavigate("home")}
          className="ml-3 text-sm text-white/60"
        >
          Return to home
        </button>
      </div>
    </section>
  );
}
function OnboardingScreenV4({ onFinish }: { onFinish(): void }) {
  const [name, setName] = useState("");
  const [step, setStep] = useState<"name" | "guidance" | "taste" | "path">(
    "name",
  );
  const [guidance, setGuidance] = useState<string | null>(null);
  const [tastes, setTastes] = useState<Record<string, number>>({});
  const next = () =>
    setStep(
      step === "name"
        ? "guidance"
        : step === "guidance"
          ? "taste"
          : step === "taste"
            ? "path"
            : "path",
    );
  const touchTaste = (taste: string) =>
    setTastes((current) => ({
      ...current,
      [taste]: ((current[taste] ?? 0) + 1) % 3,
    }));
  const bubbles = [
    "Sci-Fi Worldbuilding",
    "A24 Midnight",
    "35mm Warmth",
    "Slow-Burn Noir",
    "Cozy Whimsy",
    "Boardroom Betrayals",
    "High-Stakes Tension",
    "Miyazaki",
    "Villeneuve",
    "Interstellar",
    "Spirited Away",
  ];
  return (
    <main className="reelos-onboarding relative flex min-h-dvh overflow-hidden px-5 py-10 md:px-10">
      <div className="reelos-onboarding-orb reelos-onboarding-orb-one" />
      <div className="reelos-onboarding-orb reelos-onboarding-orb-two" />
      <div className="relative mx-auto flex w-full max-w-6xl items-center">
        <div className="w-full">
          {step === "name" && (
            <div className="max-w-2xl">
              <h1 className="font-display text-[clamp(3.3rem,7vw,6.8rem)] font-semibold leading-[.92] tracking-[-.07em]">
                Hi, what should we call you?
              </h1>
              <div className="mt-10 border-b border-white/25">
                <input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && name.trim()) next();
                  }}
                  placeholder="Your name or home name"
                  className="w-full bg-transparent py-4 text-2xl font-medium outline-none placeholder:text-white/25"
                />
              </div>
              <button
                disabled={!name.trim()}
                onClick={next}
                className="reelos-play mt-8 rounded-full bg-[#f0ba61] px-6 py-3.5 text-sm font-bold text-[#211507] disabled:cursor-not-allowed disabled:opacity-35"
              >
                Continue
              </button>
            </div>
          )}
          {step === "guidance" && (
            <div className="max-w-4xl">
              <h1 className="font-display text-[clamp(3.1rem,6vw,5.8rem)] font-semibold leading-[.92] tracking-[-.07em]">
                How much hand-holding do you want?
              </h1>
              <div className="mt-10 grid gap-3 md:grid-cols-3">
                {[
                  ["Hold my hand", "Guide me, make smart choices."],
                  ["Balanced", "Keep it simple. I’ll ask when I need you."],
                  ["I’ll figure it out", "Get me to the cinema."],
                ].map(([title, note]) => (
                  <button
                    key={title}
                    onClick={() => setGuidance(title)}
                    className={`reelos-guidance rounded-[1.5rem] border p-6 text-left ${guidance === title ? "border-[#eebd69] bg-white/10" : "border-white/10 bg-black/10"}`}
                  >
                    <b className="block text-lg">{title}</b>
                    <span className="mt-3 block text-sm leading-6 text-white/55">
                      {note}
                    </span>
                  </button>
                ))}
              </div>
              <button
                disabled={!guidance}
                onClick={next}
                className="reelos-play mt-8 rounded-full bg-[#f0ba61] px-6 py-3.5 text-sm font-bold text-[#211507] disabled:cursor-not-allowed disabled:opacity-35"
              >
                Continue
              </button>
            </div>
          )}
          {step === "taste" && (
            <div>
              <div className="max-w-2xl">
                <h1 className="font-display text-[clamp(3.1rem,6vw,5.8rem)] font-semibold leading-[.92] tracking-[-.07em]">
                  What makes you stop scrolling?
                </h1>
                <p className="mt-5 text-lg text-white/58">
                  Tap anything you like. Tap it again for the things you love.
                </p>
              </div>
              <div className="reelos-taste-field mt-8">
                {bubbles.map((bubble, index) => (
                  <button
                    key={bubble}
                    onClick={() => touchTaste(bubble)}
                    className={`reelos-taste-bubble reelos-taste-bubble-${index % 5} state-${tastes[bubble] ?? 0}`}
                  >
                    <span>{bubble}</span>
                    {tastes[bubble] === 2 && <small>♥</small>}
                  </button>
                ))}
              </div>
              <button
                onClick={next}
                className="reelos-play mt-8 rounded-full bg-[#f0ba61] px-6 py-3.5 text-sm font-bold text-[#211507]"
              >
                {Object.keys(tastes).length
                  ? "That feels right"
                  : "Surprise me"}
              </button>
            </div>
          )}
          {step === "path" && (
            <div className="max-w-4xl">
              <h1 className="font-display text-[clamp(3.1rem,6vw,5.8rem)] font-semibold leading-[.92] tracking-[-.07em]">
                Where is your cinema?
              </h1>
              <div className="mt-10 grid gap-4 md:grid-cols-2">
                <button
                  onClick={onFinish}
                  className="reelos-guidance rounded-[1.7rem] border border-white/15 bg-white/8 p-7 text-left"
                >
                  <b className="block text-2xl">Start this home</b>
                  <span className="mt-3 block text-sm leading-6 text-white/58">
                    Set up this ReelOS home on its own.
                  </span>
                </button>
                <button
                  onClick={onFinish}
                  className="reelos-guidance rounded-[1.7rem] border border-white/15 bg-white/8 p-7 text-left"
                >
                  <b className="block text-2xl">Connect to my home</b>
                  <span className="mt-3 block text-sm leading-6 text-white/58">
                    Pair with a ReelOS server already in your house.
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
function OnboardingScreenV3({ onFinish }: { onFinish(): void }) {
  const [name, setName] = useState("");
  const [step, setStep] = useState<"name" | "home">("name");
  return (
    <main className="reelos-onboarding relative flex min-h-dvh overflow-hidden px-5 py-10 md:px-10">
      <div className="reelos-onboarding-orb reelos-onboarding-orb-one" />
      <div className="reelos-onboarding-orb reelos-onboarding-orb-two" />
      <div className="relative mx-auto flex w-full max-w-6xl items-center">
        <div className="w-full max-w-2xl">
          {step === "name" ? (
            <>
              <h1 className="font-display text-[clamp(3.3rem,7vw,6.8rem)] font-semibold leading-[.92] tracking-[-.07em]">
                What should we call you?
              </h1>
              <div className="mt-10 border-b border-white/25">
                <input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && name.trim()) setStep("home");
                  }}
                  placeholder="Your name"
                  className="w-full bg-transparent py-4 text-2xl font-medium outline-none placeholder:text-white/25"
                />
              </div>
              <button
                disabled={!name.trim()}
                onClick={() => setStep("home")}
                className="reelos-play mt-8 rounded-full bg-[#f0ba61] px-6 py-3.5 text-sm font-bold text-[#211507] disabled:cursor-not-allowed disabled:opacity-35"
              >
                Continue
              </button>
            </>
          ) : (
            <>
              <h1 className="font-display text-[clamp(3.3rem,7vw,6.8rem)] font-semibold leading-[.92] tracking-[-.07em]">
                Welcome, {name}.
              </h1>
              <p className="mt-7 max-w-lg text-lg leading-8 text-white/62">
                Your home is ready to become yours. We’ll learn the rest
                together, one night at a time.
              </p>
              <button
                onClick={onFinish}
                className="reelos-play mt-9 rounded-full bg-[#f0ba61] px-6 py-3.5 text-sm font-bold text-[#211507]"
              >
                Open ReelOS
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
function OnboardingScreen({ onFinish }: { onFinish(): void }) {
  const [step, setStep] = useState(0);
  const screens = [
    {
      whisper: "ReelOS is not a menu.",
      title: "It learns the feeling of your home.",
      body: "A home for the stories, albums, and odd little moments that shape the people watching.",
      action: "Begin together",
    },
    {
      whisper: "First, who is here?",
      title: "This is Austin’s home.",
      body: "Your taste will be personal. Kids, guests, and everyone else will have an experience that feels right to them too.",
      action: "That’s me",
    },
    {
      whisper: "One last thing.",
      title: "How should home feel after dark?",
      body: "You can change this whenever you want. The light is part of the story.",
      action: "Open ReelOS",
    },
  ];
  const screen = screens[step];
  return (
    <main className="reelos-onboarding relative flex min-h-[calc(100dvh-76px)] overflow-hidden px-5 py-10 md:px-10">
      <div className="reelos-onboarding-orb reelos-onboarding-orb-one" />
      <div className="reelos-onboarding-orb reelos-onboarding-orb-two" />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="font-display text-xl font-bold">ReelOS</span>
          <span className="text-sm text-white/45">
            {step + 1} / {screens.length}
          </span>
        </div>
        <div className="max-w-3xl pb-8">
          <p className="text-sm text-[#eebd69]">{screen.whisper}</p>
          <h1 className="mt-5 font-display text-[clamp(3.6rem,8vw,8rem)] font-black leading-[.86] tracking-[-.075em]">
            {screen.title}
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-white/62">
            {screen.body}
          </p>
          {step === 2 && (
            <div className="mt-9 flex gap-3">
              <span className="size-12 rounded-full bg-[#b8c7ff] shadow-lg shadow-[#657cff]/30" />
              <span className="size-12 rounded-full bg-[#d77f6b]" />
              <span className="size-12 rounded-full bg-[#5fd2c1]" />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {screens.map((_, index) => (
              <span
                key={index}
                className={`h-1.5 rounded-full ${index === step ? "w-8 bg-[#eebd69]" : "w-1.5 bg-white/30"}`}
              />
            ))}
          </div>
          <button
            onClick={() =>
              step === screens.length - 1 ? onFinish() : setStep(step + 1)
            }
            className="reelos-play rounded-full bg-[#f0ba61] px-6 py-3.5 text-sm font-bold text-[#211507]"
          >
            {screen.action}
          </button>
        </div>
      </div>
    </main>
  );
}
function SettingsScreen({
  atmosphere,
  setAtmosphere,
  favoriteColor,
  setFavoriteColor,
  onOpenFamily,
  onOpenSetup,
}: {
  atmosphere: "midnight" | "ember" | "ocean";
  setAtmosphere(value: "midnight" | "ember" | "ocean"): void;
  favoriteColor: string;
  setFavoriteColor(color: string): void;
  onOpenFamily(): void;
  onOpenSetup(): void;
}) {
  const [open, setOpen] = useState("home");
  const [passcode, setPasscode] = useState(false);
  const [torboxKey, setTorboxKey] = useState("");
  const [screen, setScreen] = useState("This phone");
  const [features, setFeatures] = useState<Record<string, boolean>>({
    dialogue: true,
    subtitles: true,
    context: true,
    story: true,
    "screen-motion": false,
    "screen-type": false,
    "screen-subtitles": false,
  });
  const colors = [
    "#2563eb",
    "#e11d48",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#06b6d4",
    "#a855f7",
    "#ec4899",
  ];
  const categories = [
    {
      id: "home",
      label: "Your home",
      note: "Color, motion, and profile privacy",
    },
    { id: "family", label: "Family", note: "People, kids, and boundaries" },
    {
      id: "intelligence",
      label: "Cinema intelligence",
      note: "Taste, search, and the quiet work behind the scenes",
    },
    {
      id: "playback",
      label: "Playback",
      note: "Sound, subtitles, and spoiler-safe help",
    },
    {
      id: "screens",
      label: "Screens",
      note: "Tune every place ReelOS appears",
    },
    {
      id: "library",
      label: "Library & requests",
      note: "What belongs here, and how it gets here",
    },
    {
      id: "connections",
      label: "Connections",
      note: "TorBox and your home cinema",
    },
    { id: "devices", label: "Devices", note: "Phone, TV, and USB installs" },
  ];
  const toggle = (id: string) =>
    setOpen((current) => (current === id ? "" : id));
  const toggleFeature = (id: string) =>
    setFeatures((current) => ({ ...current, [id]: !current[id] }));
  const FeatureToggle = ({
    id,
    label,
    note,
  }: {
    id: string;
    label: string;
    note: string;
  }) => (
    <button
      type="button"
      onClick={() => toggleFeature(id)}
      className="flex w-full items-center justify-between gap-5 border-b border-white/8 py-4 text-left last:border-b-0"
    >
      <span>
        <b className="block text-sm">{label}</b>
        <small className="mt-1 block max-w-xl text-sm leading-5 text-white/45">
          {note}
        </small>
      </span>
      <span
        className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${features[id] ? "justify-end bg-white text-[#101014]" : "justify-start bg-white/15 text-white/40"}`}
      >
        <span className="size-5 rounded-full bg-current" />
      </span>
    </button>
  );

  return (
    <main
      aria-label="Settings"
      className="mx-auto max-w-4xl px-5 py-8 md:px-10 md:py-12"
    >
      <div className="space-y-3">
        {categories.map((category) => (
          <section
            key={category.id}
            className={`overflow-hidden rounded-[1.65rem] border transition ${open === category.id ? "border-white/26 bg-white/[.055]" : "border-white/10 bg-white/[.022]"}`}
          >
            <button
              type="button"
              onClick={() => toggle(category.id)}
              aria-expanded={open === category.id}
              className="flex w-full items-center justify-between gap-5 p-5 text-left md:p-6"
            >
              <span>
                <b className="block font-display text-2xl tracking-[-.045em]">
                  {category.label}
                </b>
                <small className="mt-1 block text-sm text-white/48">
                  {category.note}
                </small>
              </span>
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-full border text-xl transition ${open === category.id ? "border-white/40 bg-white text-[#101014]" : "border-white/15 text-white/60"}`}
              >
                {open === category.id ? "−" : "+"}
              </span>
            </button>
            {open === "home" && category.id === "home" && (
              <div className="border-t border-white/10 p-5 pt-6 md:p-6">
                <p className="text-sm text-white/52">
                  A color you’ll want to come home to.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFavoriteColor(color)}
                      aria-label={`Use ${color} as the home color`}
                      className={`grid size-12 place-items-center rounded-full transition hover:scale-110 ${favoriteColor === color ? "ring-2 ring-white ring-offset-4 ring-offset-[#111116]" : ""}`}
                      style={{ backgroundColor: color }}
                    >
                      <span
                        className="size-3 rounded-full bg-white/80 opacity-0 transition"
                        style={{ opacity: favoriteColor === color ? 1 : 0 }}
                      />
                    </button>
                  ))}
                  <label
                    className="grid size-12 cursor-pointer place-items-center rounded-full border border-dashed border-white/35 text-xl text-white/70"
                    title="Choose another color"
                  >
                    +
                    <input
                      type="color"
                      value={favoriteColor}
                      onChange={(event) => setFavoriteColor(event.target.value)}
                      className="sr-only"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setPasscode((value) => !value)}
                  className="mt-7 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/10 px-5 py-4 text-left"
                >
                  <span>
                    <b className="block text-sm">Profile passcode</b>
                    <small className="mt-1 block text-sm text-white/45">
                      {passcode
                        ? "This profile asks before opening."
                        : "Optional privacy for this profile."}
                    </small>
                  </span>
                  <span
                    className={`flex h-7 w-12 items-center rounded-full p-1 ${passcode ? "justify-end bg-white text-[#101014]" : "justify-start bg-white/15 text-white/40"}`}
                  >
                    <span className="size-5 rounded-full bg-current" />
                  </span>
                </button>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    onClick={() => setAtmosphere("midnight")}
                    className={`rounded-full border px-4 py-2.5 text-sm ${atmosphere === "midnight" ? "border-white/55 bg-white/10" : "border-white/12 text-white/60"}`}
                  >
                    Midnight
                  </button>
                  <button
                    onClick={() => setAtmosphere("ember")}
                    className={`rounded-full border px-4 py-2.5 text-sm ${atmosphere === "ember" ? "border-white/55 bg-white/10" : "border-white/12 text-white/60"}`}
                  >
                    Ember
                  </button>
                  <button
                    onClick={() => setAtmosphere("ocean")}
                    className={`rounded-full border px-4 py-2.5 text-sm ${atmosphere === "ocean" ? "border-white/55 bg-white/10" : "border-white/12 text-white/60"}`}
                  >
                    Ocean
                  </button>
                </div>
              </div>
            )}
            {open === "family" && category.id === "family" && (
              <div className="border-t border-white/10 p-5 pt-6 md:p-6">
                <p className="max-w-xl text-sm leading-6 text-white/56">
                  Add anyone who shares your home. Kid profiles stay inside
                  their cinema until an adult PIN lets them out.
                </p>
                <button
                  onClick={onOpenFamily}
                  className="mt-5 rounded-full border border-white/18 px-5 py-3 text-sm font-semibold text-white/85 transition hover:border-white/50"
                >
                  Open family
                </button>
              </div>
            )}
            {open === "intelligence" && category.id === "intelligence" && (
              <div className="border-t border-white/10 p-5 md:p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/9 bg-black/10 p-4">
                    <b className="block text-sm">Curated for your home</b>
                    <p className="mt-2 text-sm leading-6 text-white/45">
                      Taste, time, and who is watching shape what appears. This
                      stays on automatically.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/9 bg-black/10 p-4">
                    <b className="block text-sm">Playback protection</b>
                    <p className="mt-2 text-sm leading-6 text-white/45">
                      ReelOS quietly avoids poor releases and prepares likely
                      next watches.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-5 text-sm font-semibold text-white/78 underline decoration-white/25 underline-offset-4"
                >
                  Fine-tune cinema taste
                </button>
              </div>
            )}
            {open === "playback" && category.id === "playback" && (
              <div className="border-t border-white/10 p-5 pt-2 md:p-6 md:pt-2">
                <FeatureToggle
                  id="dialogue"
                  label="Dialogue focus"
                  note="Lift whispered voices and calm explosions without flattening the movie."
                />
                <FeatureToggle
                  id="subtitles"
                  label="Auto subtitle sync"
                  note="Find the right subtitles and quietly keep them aligned."
                />
                <FeatureToggle
                  id="context"
                  label="Show companion context"
                  note="Offer spoiler-safe cast notes and scene help on your phone."
                />
                <FeatureToggle
                  id="story"
                  label="Story so far"
                  note="Offer a short, spoiler-safe refresher when you return after time away."
                />
              </div>
            )}
            {open === "screens" && category.id === "screens" && (
              <div className="border-t border-white/10 p-5 pt-6 md:p-6">
                <p className="text-sm text-white/52">
                  Each screen can feel like itself while still belonging to the
                  same home.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {["This phone", "Home TV", "Bedroom TV"].map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setScreen(name)}
                      className={`rounded-full border px-4 py-2.5 text-sm transition ${screen === name ? "border-white/60 bg-white text-[#101014]" : "border-white/12 text-white/65 hover:border-white/40"}`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 p-5">
                  <b className="block text-base">{screen}</b>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/48">
                    {screen === "This phone"
                      ? "Touch-first controls, Books, and a companion that never takes over your screen."
                      : "Remote-first focus, large readable choices, and a cinema view made for across the home."}
                  </p>
                  <div className="mt-5 space-y-0">
                    <FeatureToggle
                      id="screen-motion"
                      label="Keep motion gentle"
                      note="Use fewer flourishes and a calmer arrival."
                    />
                    <FeatureToggle
                      id="screen-type"
                      label="Make type larger"
                      note="Give this screen a little more breathing space."
                    />
                    <FeatureToggle
                      id="screen-subtitles"
                      label="Start with subtitles"
                      note="Make captions the quiet default on this screen."
                    />
                  </div>
                </div>
              </div>
            )}
            {open === "library" && category.id === "library" && (
              <div className="border-t border-white/10 p-5 pt-6 md:p-6">
                <p className="max-w-xl text-sm leading-6 text-white/56">
                  Your own collection stays separate from the endless universe.
                  Requests, saved titles, and every new arrival land here
                  without losing the shape of your home.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="rounded-full border border-white/18 px-5 py-3 text-sm font-semibold text-white/85 transition hover:border-white/50"
                  >
                    Manage requests
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-white/18 px-5 py-3 text-sm font-semibold text-white/85 transition hover:border-white/50"
                  >
                    Refresh collection
                  </button>
                </div>
              </div>
            )}
            {open === "connections" && category.id === "connections" && (
              <div className="border-t border-white/10 p-5 pt-6 md:p-6">
                <label className="block text-sm font-semibold">
                  TorBox API key
                  <input
                    type="password"
                    value={torboxKey}
                    onChange={(event) => setTorboxKey(event.target.value)}
                    placeholder="Paste your key"
                    className="mt-3 w-full rounded-xl border border-white/14 bg-black/20 px-4 py-3.5 text-base font-normal outline-none placeholder:text-white/30 focus:border-white/45"
                  />
                </label>
                <p className="mt-3 text-sm leading-6 text-white/45">
                  Required before cinema can stream. You can return here to
                  replace it anytime.
                </p>
                <button
                  onClick={onOpenSetup}
                  className="mt-5 rounded-full border border-white/18 px-5 py-3 text-sm font-semibold text-white/85 transition hover:border-white/50"
                >
                  Pair a home cinema
                </button>
              </div>
            )}
            {open === "devices" && category.id === "devices" && (
              <div className="border-t border-white/10 p-5 pt-6 md:p-6">
                <p className="text-sm text-white/52">
                  Bring ReelOS with you, or put it on the big screen.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    ["Phone", "Keep cinema close."],
                    ["TV", "Set up the big screen."],
                    ["USB", "Make an installer."],
                  ].map(([name, note]) => (
                    <button
                      key={name}
                      onClick={onOpenSetup}
                      className="rounded-2xl border border-white/10 bg-black/10 p-5 text-left transition hover:border-white/35"
                    >
                      <b className="block text-lg">{name}</b>
                      <small className="mt-2 block text-sm leading-5 text-white/48">
                        {note}
                      </small>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
function Mood({
  title,
  note,
  tone,
  onClick,
}: {
  title: string;
  note: string;
  tone: string;
  onClick(): void;
}) {
  return (
    <button
      onClick={onClick}
      className={`reelos-mood min-h-40 rounded-3xl border border-white/8 bg-gradient-to-br ${tone} p-6 text-left transition`}
    >
      <span className="block text-xs font-medium text-white/45">
        Choose a direction
      </span>
      <b className="mt-8 block font-display text-xl">{title}</b>
      <span className="mt-1 block text-sm text-white/55">{note}</span>
      <span className="mt-5 block text-sm text-white/80">Take me there →</span>
    </button>
  );
}
function Poster({ film, onClick }: { film: Film; onClick(): void }) {
  return (
    <button
      onClick={onClick}
      className="group relative aspect-[.68] overflow-hidden rounded-2xl bg-white/5 text-left shadow-xl shadow-black/20"
    >
      <img
        src={film.image}
        alt=""
        className="size-full object-cover transition duration-500 group-hover:scale-105"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
      <span className="absolute inset-x-3 bottom-3">
        <b className="block truncate text-sm">{film.title}</b>
        <small className="text-white/55">{film.year}</small>
      </span>
    </button>
  );
}
function FilmSheet({
  film,
  saved,
  onClose,
  onSave,
  onPlay,
}: {
  film: Film;
  saved: boolean;
  onClose(): void;
  onSave(): void;
  onPlay(): void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/65 p-4 backdrop-blur-sm md:place-items-center">
      <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/12 bg-[#161517] shadow-2xl">
        <div className="flex items-start justify-between p-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#eebd69]">
              {film.genre}
            </p>
            <h2 className="mt-2 font-display text-4xl font-bold tracking-[-.06em]">
              {film.title}
            </h2>
            <p className="mt-4 max-w-lg text-white/62">{film.note}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-white/55 hover:bg-white/8"
          >
            <X />
          </button>
        </div>
        <div className="flex gap-3 border-t border-white/8 p-5">
          <button
            onClick={onPlay}
            className="inline-flex items-center gap-2 rounded-full bg-[#f0ba61] px-5 py-3 text-sm font-bold text-[#211507]"
          >
            <Play className="size-4 fill-current" />
            Play now
          </button>
          <button
            onClick={onSave}
            className="inline-flex items-center gap-2 rounded-full border border-white/14 px-5 py-3 text-sm font-semibold"
          >
            <Bookmark
              className={
                saved ? "size-4 fill-[#eebd69] text-[#eebd69]" : "size-4"
              }
            />
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
function PlayerScreen({ film, onExit }: { film: Film; onExit(): void }) {
  const [paused, setPaused] = useState(false);
  return (
    <main className="relative min-h-[calc(100dvh-76px)] overflow-hidden bg-black">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-55"
        style={{ backgroundImage: `url(${film.backdrop})` }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,.25)_45%,#000_100%)]" />
      <div className="relative mx-auto flex min-h-[calc(100dvh-76px)] max-w-[1600px] flex-col justify-between p-5 md:p-10">
        <div className="flex items-center justify-between">
          <button
            onClick={onExit}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-4 py-2.5 text-sm text-white/80 backdrop-blur"
          >
            <ArrowLeft className="size-4" />
            Back home
          </button>
          <span className="text-xs font-medium text-white/55">
            Home TV · 4K HDR
          </span>
        </div>
        <button
          onClick={() => setPaused(!paused)}
          aria-label={paused ? "Resume" : "Pause"}
          className="mx-auto grid size-20 place-items-center rounded-full border border-white/20 bg-white/12 text-white backdrop-blur transition hover:scale-105"
        >
          {paused ? (
            <Play className="ml-1 size-8 fill-current" />
          ) : (
            <Pause className="size-8 fill-current" />
          )}
        </button>
        <div>
          <div className="mb-5 flex items-center justify-between text-xs text-white/62">
            <span>01:07:38</span>
            <span>02:16:19</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
            <div className="h-full w-[51%] rounded-full bg-[#eebd69]" />
          </div>
          <div className="mt-6 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#eebd69]">
                Now playing
              </p>
              <h1 className="mt-2 font-display text-4xl font-bold tracking-[-.06em] md:text-6xl">
                {film.title}
              </h1>
            </div>
            <button className="inline-flex items-center gap-2 text-sm text-white/70">
              <Volume2 className="size-4" />
              Home TV
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
