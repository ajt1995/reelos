import { BookOpen, Play } from "lucide-react";

const CONTINUE = [
  {
    title: "The Bear",
    detail: "Season 2 · Episode 6",
    progress: "62%",
    image:
      "https://image.tmdb.org/t/p/original/bpOSxM0uibdL8XttLBNQ7l8D4dL.jpg",
  },
  {
    title: "Interstellar",
    detail: "01:07 remaining",
    progress: "51%",
    image:
      "https://image.tmdb.org/t/p/original/rAiYTsqJiOEZg05z5U4jD8rU07E.jpg",
  },
];

const SHELF = [
  {
    title: "Dune: Part Two",
    image: "https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
  },
  {
    title: "Spirited Away",
    image: "https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
  },
  {
    title: "The Batman",
    image: "https://image.tmdb.org/t/p/w500/74xTEgt7R36Fpooo50r9T25onhq.jpg",
  },
  {
    title: "Past Lives",
    image: "https://image.tmdb.org/t/p/w500/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
  },
  {
    title: "Arrival",
    image: "https://image.tmdb.org/t/p/w500/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg",
  },
];

export function LibraryArchive({ onOpenBooks }: { onOpenBooks(): void }) {
  return (
    <section className="mx-auto max-w-[1600px] px-5 py-14 md:px-10">
      <div>
        <h1 className="font-display text-5xl font-semibold tracking-[-.07em]">
          Library
        </h1>
        <p className="mt-3 text-white/55">Your stories, kept close.</p>
      </div>
      <div className="mt-12">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-3xl font-semibold tracking-[-.05em]">
            Pick up where you left off.
          </h2>
          <button className="text-sm text-white/55 hover:text-white">
            See all
          </button>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {CONTINUE.map((item) => (
            <article
              key={item.title}
              className="reelos-continue relative min-h-72 overflow-hidden rounded-[1.8rem] border border-white/10"
            >
              <img
                src={item.image}
                alt=""
                className="absolute inset-0 size-full object-cover opacity-60"
              />
              <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,7,11,.94),rgba(6,7,11,.4),rgba(6,7,11,.16))]" />
              <div className="relative flex min-h-72 max-w-sm flex-col justify-end p-7">
                <span className="text-sm text-white/58">{item.detail}</span>
                <h3 className="mt-2 font-display text-4xl font-semibold tracking-[-.055em]">
                  {item.title}
                </h3>
                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-[#b8c7ff]"
                    style={{ width: item.progress }}
                  />
                </div>
                <button className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black">
                  <Play className="size-4 fill-current" />
                  Keep watching
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="mt-16">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-3xl font-semibold tracking-[-.05em]">
            Your shelf.
          </h2>
          <button className="text-sm text-white/55 hover:text-white">
            Explore your archive
          </button>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {SHELF.map((item) => (
            <button
              key={item.title}
              className="group relative aspect-[.68] overflow-hidden rounded-2xl text-left"
            >
              <img
                src={item.image}
                alt=""
                className="size-full object-cover transition duration-500 group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
              <b className="absolute inset-x-4 bottom-4 text-sm">
                {item.title}
              </b>
            </button>
          ))}
        </div>
      </div>
      <div className="reelos-reading-room mt-16 rounded-[2rem] border border-white/10 p-8">
        <BookOpen className="size-6 text-[#b8c7ff]" />
        <h2 className="mt-6 font-display text-3xl font-semibold tracking-[-.05em]">
          Books.
        </h2>
        <p className="mt-3 max-w-lg leading-7 text-white/58">
          Your books are personal. Reading progress, margins, and private
          recommendations stay with you. Books stays off the TV so cinema keeps
          the whole screen.
        </p>
        <button
          onClick={onOpenBooks}
          className="mt-6 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white/80"
        >
          Open Books
        </button>
      </div>
    </section>
  );
}
