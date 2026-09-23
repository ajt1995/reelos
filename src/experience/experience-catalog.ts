import { TITLES } from "@/lib/catalog";
import type {
  ExperienceProfile,
  TonightFilters,
} from "@/experience/experience-state";
import {
  sourcesForExperienceTitle,
  type ExperienceMediaSource,
} from "@/experience/source-access";

export type ExperienceKind = "movie" | "series" | "book";

export interface ExperienceTitle {
  id: string;
  title: string;
  year: number;
  kind: ExperienceKind;
  genres: string[];
  poster: string;
  backdrop: string;
  note: string;
  people: string[];
  moods: string[];
  minutes: number;
  runtimeKnown?: boolean;
  family?: boolean;
  sources: ExperienceMediaSource[];
  playbackId?: string;
}

export interface TasteItem {
  id: string;
  title: string;
  subtitle: string;
  kind: "title" | "person" | "mood";
  image?: string;
  titleId?: string;
}

type ExtraSeed = readonly [
  id: string,
  title: string,
  year: number,
  genres: string,
  poster: string,
  people: string,
  moods: string,
  kind?: ExperienceKind,
  family?: boolean,
];

const tmdb = (path: string) =>
  path ? `https://image.tmdb.org/t/p/w500/${path}` : "";

const EXTRAS: ExtraSeed[] = [
  [
    "inception",
    "Inception",
    2010,
    "Science fiction,Mystery",
    "oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
    "Leonardo DiCaprio,Christopher Nolan",
    "cerebral,big,late night",
  ],
  [
    "dark-knight",
    "The Dark Knight",
    2008,
    "Crime,Thriller",
    "qJ2tW6WMUDux911r6m7haRef0WH.jpg",
    "Christian Bale,Christopher Nolan",
    "tense,big,late night",
  ],
  [
    "pulp-fiction",
    "Pulp Fiction",
    1994,
    "Crime,Comedy",
    "d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg",
    "Samuel L. Jackson,Uma Thurman",
    "sharp,restless,late night",
  ],
  [
    "fight-club",
    "Fight Club",
    1999,
    "Drama,Thriller",
    "pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
    "Brad Pitt,Edward Norton",
    "dark,cerebral,restless",
  ],
  [
    "severance",
    "Severance",
    2022,
    "Science fiction,Drama",
    "",
    "Adam Scott,Britt Lower",
    "strange,cerebral,quiet",
    "series",
  ],
  [
    "the-bear",
    "The Bear",
    2022,
    "Drama,Comedy",
    "sHqbe6m4rIS5b2b2vPz259O1wQf.jpg",
    "Ayo Edebiri,Jeremy Allen White",
    "urgent,human,sharp",
    "series",
  ],
  [
    "shogun",
    "Shōgun",
    2024,
    "Drama,History",
    "7O4iVfOMQmdCSxhOg1WNzG1AgYT.jpg",
    "Hiroyuki Sanada,Anna Sawai",
    "epic,patient,transporting",
    "series",
  ],
  [
    "fallout",
    "Fallout",
    2024,
    "Science fiction,Adventure",
    "AnsZu445z2hR68b191v38M8j6f8.jpg",
    "Ella Purnell,Walton Goggins",
    "strange,fun,restless",
    "series",
  ],
  [
    "arcane",
    "Arcane",
    2021,
    "Animation,Fantasy",
    "fqldf2t8ztc9aiwn39679G0bZtq.jpg",
    "Hailee Steinfeld,Ella Purnell",
    "beautiful,big,emotional",
    "series",
  ],
  [
    "jurassic-park",
    "Jurassic Park",
    1993,
    "Adventure,Science fiction",
    "b1x09nyJwQDU7z44Pj5fqzE2w7R.jpg",
    "Sam Neill,Laura Dern",
    "wonder,big,familiar",
    "movie",
    true,
  ],
  [
    "alien",
    "Alien",
    1979,
    "Horror,Science fiction",
    "vfrQk5IPloGg1v9Rzbh2Eg3VGyM.jpg",
    "Sigourney Weaver,Ridley Scott",
    "dark,tense,late night",
  ],
  [
    "john-wick",
    "John Wick",
    2014,
    "Action,Thriller",
    "fZPSMVXTptipclsvJu29nR06os3.jpg",
    "Keanu Reeves,Ian McShane",
    "kinetic,stylish,restless",
  ],
  [
    "toy-story",
    "Toy Story",
    1995,
    "Animation,Family",
    "uXDfjJbdP4ijW5hWSBrPrlKpxab.jpg",
    "Tom Hanks,Tim Allen",
    "warm,familiar,playful",
    "movie",
    true,
  ],
  [
    "finding-nemo",
    "Finding Nemo",
    2003,
    "Animation,Family",
    "eHuGQ10FUzK1mdOY69wF5pGgEf5.jpg",
    "Albert Brooks,Ellen DeGeneres",
    "warm,adventure,comfort",
    "movie",
    true,
  ],
  [
    "lion-king",
    "The Lion King",
    1994,
    "Animation,Family",
    "sKCr78MXSLixwmZ8DyJLrcsHXWA.jpg",
    "Matthew Broderick,James Earl Jones",
    "emotional,familiar,comfort",
    "movie",
    true,
  ],
  [
    "spider-verse",
    "Spider-Man: Into the Spider-Verse",
    2018,
    "Animation,Adventure",
    "iiZZdoQBEYBv6id8su7ImL0oCbD.jpg",
    "Shameik Moore,Hailee Steinfeld",
    "kinetic,colorful,big",
    "movie",
    true,
  ],
  [
    "frozen",
    "Frozen",
    2013,
    "Animation,Family",
    "kgwjIb2RWgXXtlcbGbcKy80qXU0.jpg",
    "Kristen Bell,Idina Menzel",
    "singalong,warm,familiar",
    "movie",
    true,
  ],
  [
    "moana",
    "Moana",
    2016,
    "Animation,Family",
    "r2305Z3P3hX243uD1E2lY2R6kY5.jpg",
    "Auliʻi Cravalho,Dwayne Johnson",
    "adventure,warm,colorful",
    "movie",
    true,
  ],
  [
    "wall-e",
    "WALL-E",
    2008,
    "Animation,Science fiction",
    "hbhFnRzzg6ZDmm8YAmxBnQpQIPh.jpg",
    "Ben Burtt,Elissa Knight",
    "gentle,quiet,warm",
    "movie",
    true,
  ],
  [
    "paddington-2",
    "Paddington 2",
    2017,
    "Family,Comedy",
    "1OJ9vkD5xPt3skC6KguyXAgagRZ.jpg",
    "Ben Whishaw,Hugh Grant",
    "kind,comfort,warm",
    "movie",
    true,
  ],
  [
    "parasite",
    "Parasite",
    2019,
    "Thriller,Drama",
    "7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
    "Song Kang-ho,Cho Yeo-jeong",
    "sharp,tense,unexpected",
  ],
  [
    "everything-everywhere",
    "Everything Everywhere All at Once",
    2022,
    "Fantasy,Comedy",
    "w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg",
    "Michelle Yeoh,Ke Huy Quan",
    "wild,emotional,colorful",
  ],
  [
    "mad-max-fury-road",
    "Mad Max: Fury Road",
    2015,
    "Action,Adventure",
    "hA2ple9q4qnwxp3hKVNhroipsir.jpg",
    "Charlize Theron,Tom Hardy",
    "kinetic,big,restless",
  ],
  [
    "arrival",
    "Arrival",
    2016,
    "Science fiction,Drama",
    "x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg",
    "Amy Adams,Jeremy Renner",
    "quiet,cerebral,emotional",
  ],
  [
    "ex-machina",
    "Ex Machina",
    2015,
    "Science fiction,Thriller",
    "btbRB7BrD887j5NrvjxceRDmaot.jpg",
    "Alicia Vikander,Oscar Isaac",
    "clinical,cerebral,tense",
  ],
  [
    "her",
    "Her",
    2013,
    "Romance,Science fiction",
    "qWUNpeDXIGU4vP7O1Cvu2B2x4xV.jpg",
    "Joaquin Phoenix,Scarlett Johansson",
    "soft,lonely,warm",
  ],
  [
    "moonlight",
    "Moonlight",
    2016,
    "Drama",
    "4911T5FbJ9eD2Faz5Z8cT3SUhU.jpg",
    "Mahershala Ali,Trevante Rhodes",
    "tender,quiet,emotional",
  ],
  [
    "la-la-land",
    "La La Land",
    2016,
    "Romance,Music",
    "uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg",
    "Emma Stone,Ryan Gosling",
    "romantic,colorful,bittersweet",
  ],
  [
    "whiplash",
    "Whiplash",
    2014,
    "Drama,Music",
    "7fn624j5lj3xTme2SgiLCeuedmO.jpg",
    "Miles Teller,J.K. Simmons",
    "intense,sharp,restless",
  ],
  [
    "grand-budapest",
    "The Grand Budapest Hotel",
    2014,
    "Comedy,Drama",
    "eWdyYQreja6JGCzqHWXpWHDrrPo.jpg",
    "Ralph Fiennes,Saoirse Ronan",
    "playful,colorful,comfort",
  ],
  [
    "eternal-sunshine",
    "Eternal Sunshine of the Spotless Mind",
    2004,
    "Romance,Drama",
    "5MwkWH9tYHv3mV9OdYTMR5qreIz.jpg",
    "Jim Carrey,Kate Winslet",
    "bittersweet,strange,intimate",
  ],
  [
    "portrait-lady-fire",
    "Portrait of a Lady on Fire",
    2019,
    "Romance,Drama",
    "2LquGwEhbg3soxSCs9VNyh5VJd9.jpg",
    "Noémie Merlant,Adèle Haenel",
    "patient,intimate,beautiful",
  ],
  [
    "aftersun",
    "Aftersun",
    2022,
    "Drama",
    "jeXmhP2zbUkREMRqFOYIwQOk49T.jpg",
    "Paul Mescal,Frankie Corio",
    "tender,quiet,bittersweet",
  ],
  [
    "past-lives",
    "Past Lives",
    2023,
    "Romance,Drama",
    "k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
    "Greta Lee,Teo Yoo",
    "quiet,intimate,bittersweet",
  ],
  [
    "holdovers",
    "The Holdovers",
    2023,
    "Comedy,Drama",
    "VHSzNBTwxV8vh7wylo7O9CLdac.jpg",
    "Paul Giamatti,Da'Vine Joy Randolph",
    "winter,comfort,human",
  ],
  [
    "the-shining",
    "The Shining",
    1980,
    "Horror,Drama",
    "xazWoLealQwEgqZ89MLZklLZD3k.jpg",
    "Jack Nicholson,Shelley Duvall",
    "cold,dark,patient",
  ],
  [
    "midsommar",
    "Midsommar",
    2019,
    "Horror,Drama",
    "7LEI8ulZzO5gy9Ww2NVCrKmHeDZ.jpg",
    "Florence Pugh,Jack Reynor",
    "bright,dread,patient",
  ],
  [
    "get-out",
    "Get Out",
    2017,
    "Horror,Thriller",
    "tFXcEccSQMf3lfhfXKSU9iRBpa3.jpg",
    "Daniel Kaluuya,Allison Williams",
    "sharp,tense,unexpected",
  ],
  [
    "hereditary",
    "Hereditary",
    2018,
    "Horror,Drama",
    "p9fmuz2Oj3HtEJEqbIwkFGUhVXD.jpg",
    "Toni Collette,Alex Wolff",
    "dark,dread,intense",
  ],
  [
    "the-witch",
    "The Witch",
    2015,
    "Horror,Drama",
    "zap5hpFCWSvdWSuPGAQyjUv2wAC.jpg",
    "Anya Taylor-Joy,Ralph Ineson",
    "patient,dread,folklore",
  ],
  [
    "nope",
    "Nope",
    2022,
    "Science fiction,Horror",
    "AcKVlWaNVVVFQwro3nLXqPljcYA.jpg",
    "Daniel Kaluuya,Keke Palmer",
    "strange,big,unexpected",
  ],
  [
    "social-network",
    "The Social Network",
    2010,
    "Drama",
    "n0ybibhJtQ5icDqTp8eRytcIHJx.jpg",
    "Jesse Eisenberg,Andrew Garfield",
    "sharp,fast,cold",
  ],
  [
    "zodiac",
    "Zodiac",
    2007,
    "Crime,Thriller",
    "6YmeO4pB7XTh8P8F960O1uA14JO.jpg",
    "Jake Gyllenhaal,Mark Ruffalo",
    "patient,dark,procedural",
  ],
  [
    "gone-girl",
    "Gone Girl",
    2014,
    "Thriller,Drama",
    "lv5xShBIDPe7m4ufdlV0IAc7Avk.jpg",
    "Rosamund Pike,Ben Affleck",
    "sharp,dark,tense",
  ],
  [
    "prisoners",
    "Prisoners",
    2013,
    "Thriller,Drama",
    "uhviyknTT5cEQXbn6vWIqfM4vGm.jpg",
    "Hugh Jackman,Jake Gyllenhaal",
    "rainy,dark,intense",
  ],
  [
    "sicario",
    "Sicario",
    2015,
    "Thriller,Crime",
    "tw0lXhbNkklv4d65tPEUbpT2v1F.jpg",
    "Emily Blunt,Benicio del Toro",
    "tense,dark,patient",
  ],
  [
    "the-prestige",
    "The Prestige",
    2006,
    "Mystery,Drama",
    "Ag2B2KHKQPukjH7WutmgnnSNurZ.jpg",
    "Christian Bale,Hugh Jackman",
    "cerebral,dark,unexpected",
  ],
  [
    "tenet",
    "Tenet",
    2020,
    "Science fiction,Action",
    "aCIFMriQh8rvhxpN1IWGgvH0Tlg.jpg",
    "John David Washington,Robert Pattinson",
    "cerebral,big,kinetic",
  ],
  [
    "2001-space-odyssey",
    "2001: A Space Odyssey",
    1968,
    "Science fiction,Adventure",
    "ve72VxNqjGM69Uky4WTo2bK6rfq.jpg",
    "Keir Dullea,Stanley Kubrick",
    "patient,cerebral,big",
  ],
  [
    "goodfellas",
    "Goodfellas",
    1990,
    "Crime,Drama",
    "aKuFiU82s5ISJpGZp7YkIr3kCUd.jpg",
    "Robert De Niro,Ray Liotta",
    "fast,sharp,classic",
  ],
  [
    "taxi-driver",
    "Taxi Driver",
    1976,
    "Drama,Crime",
    "ekstpH614fwDX8DUln1a2Opz0N8.jpg",
    "Robert De Niro,Jodie Foster",
    "lonely,dark,late night",
  ],
  [
    "godfather",
    "The Godfather",
    1972,
    "Crime,Drama",
    "3bhkrj58Vtu7enYsRolD1fZdja1.jpg",
    "Al Pacino,Marlon Brando",
    "patient,classic,dark",
  ],
  [
    "big-lebowski",
    "The Big Lebowski",
    1998,
    "Comedy,Crime",
    "d4htqU3WfDROqJEY0r7kqFTJxl.jpg",
    "Jeff Bridges,John Goodman",
    "loose,fun,comfort",
  ],
  [
    "fargo",
    "Fargo",
    1996,
    "Crime,Comedy",
    "rt7cpEr1uP6RTZykBFhBTcRaKvG.jpg",
    "Frances McDormand,William H. Macy",
    "winter,darkly funny,sharp",
  ],
  [
    "casablanca",
    "Casablanca",
    1942,
    "Romance,Drama",
    "5K7cOHoay2mZusSLezBOY0Qxh8a.jpg",
    "Humphrey Bogart,Ingrid Bergman",
    "romantic,classic,bittersweet",
  ],
  [
    "rear-window",
    "Rear Window",
    1954,
    "Mystery,Thriller",
    "qitnZcLP7C9DLRuPpmvZ7GiEjJN.jpg",
    "James Stewart,Grace Kelly",
    "suspense,classic,playful",
  ],
  [
    "vertigo",
    "Vertigo",
    1958,
    "Mystery,Romance",
    "15uOEfqBNTVtDUT7hGBVCka0rZz.jpg",
    "James Stewart,Kim Novak",
    "dreamlike,classic,obsessive",
  ],
  [
    "seven-samurai",
    "Seven Samurai",
    1954,
    "Action,Drama",
    "8OKmBV5BUFzmozIC3pPWKHy17kx.jpg",
    "Toshiro Mifune,Takashi Shimura",
    "epic,classic,human",
  ],
  [
    "pans-labyrinth",
    "Pan's Labyrinth",
    2006,
    "Fantasy,Drama",
    "s8C4whhKtDaJvMDcyiMvx3BIF5F.jpg",
    "Ivana Baquero,Sergi López",
    "dark,fairytale,beautiful",
  ],
  [
    "shape-of-water",
    "The Shape of Water",
    2017,
    "Fantasy,Romance",
    "9zfwPffUXpBrEP26yp0q1ckXDcj.jpg",
    "Sally Hawkins,Doug Jones",
    "romantic,fairytale,warm",
  ],
  [
    "amelie",
    "Amélie",
    2001,
    "Romance,Comedy",
    "oTKduWL2tpIKEmkAqF4mFEAWAsv.jpg",
    "Audrey Tautou,Mathieu Kassovitz",
    "whimsical,colorful,comfort",
  ],
  [
    "in-the-mood-for-love",
    "In the Mood for Love",
    2000,
    "Romance,Drama",
    "iYypPT4bhqXfq1b6EnmxvRt6b2Y.jpg",
    "Tony Leung,Maggie Cheung",
    "romantic,patient,beautiful",
  ],
  [
    "princess-mononoke",
    "Princess Mononoke",
    1997,
    "Animation,Fantasy",
    "cMYCDADoLKLbB83g4WnJegaZimC.jpg",
    "Yōji Matsuda,Yuriko Ishida",
    "epic,nature,beautiful",
    "movie",
    true,
  ],
  [
    "my-neighbor-totoro",
    "My Neighbor Totoro",
    1988,
    "Animation,Family",
    "rtGDOeG9LzoerkDGZF9dnVeLppL.jpg",
    "Noriko Hidaka,Chika Sakamoto",
    "gentle,comfort,nature",
    "movie",
    true,
  ],
  [
    "howls-moving-castle",
    "Howl's Moving Castle",
    2004,
    "Animation,Fantasy",
    "6pZgH10jhpToPcf0uvyTCPFhWpI.jpg",
    "Chieko Baisho,Takuya Kimura",
    "romantic,wonder,comfort",
    "movie",
    true,
  ],
  [
    "ratatouille",
    "Ratatouille",
    2007,
    "Animation,Family",
    "t3vaWRPSf6WjDSamIkKDs1iQWna.jpg",
    "Patton Oswalt,Ian Holm",
    "warm,food,comfort",
    "movie",
    true,
  ],
  [
    "fantastic-mr-fox",
    "Fantastic Mr. Fox",
    2009,
    "Animation,Comedy",
    "njbTizADSZg4PqeyJdDzZGooikv.jpg",
    "George Clooney,Meryl Streep",
    "autumn,playful,comfort",
    "movie",
    true,
  ],
  [
    "truman-show",
    "The Truman Show",
    1998,
    "Comedy,Drama",
    "vuza0WqY239yBXOadKlGwJsZJFE.jpg",
    "Jim Carrey,Laura Linney",
    "warm,cerebral,bittersweet",
  ],
  [
    "shawshank",
    "The Shawshank Redemption",
    1994,
    "Drama",
    "9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg",
    "Tim Robbins,Morgan Freeman",
    "hopeful,classic,patient",
  ],
  [
    "green-mile",
    "The Green Mile",
    1999,
    "Drama,Fantasy",
    "8VG8fDNiy50H4FedGwdSVUPoaJe.jpg",
    "Tom Hanks,Michael Clarke Duncan",
    "emotional,classic,patient",
  ],
];

const notes: Record<string, string> = {
  "tmdb-movie-872585":
    "A towering character study built from pressure, consequence, and fire.",
  "past-lives": "For a quiet night when every small look matters.",
  arrival: "A patient mystery with an enormous emotional horizon.",
  "mad-max-fury-road":
    "Pure movement, color, and beautifully controlled chaos.",
  "paddington-2": "Kindness with impeccable comic timing.",
  "in-the-mood-for-love": "Color, longing, and time held in a hallway.",
};

const mappedCatalog: ExperienceTitle[] = TITLES.filter(
  (title) => title.kind !== "music",
).map((title) => ({
  id: title.id,
  title: title.title,
  year: title.year,
  kind: title.kind === "tv" || title.kind === "anime" ? "series" : "movie",
  genres: title.genres,
  poster: title.poster ?? "",
  backdrop: title.backdrop ?? title.poster ?? "",
  note:
    notes[title.id] ?? title.overview.split(". ")[0].replace(/\.$/, "") + ".",
  people: title.director ? [title.director] : [],
  moods: title.genres.map((genre) => genre.toLowerCase()),
  minutes: title.runtime ?? (title.kind === "tv" ? 48 : 115),
  family: title.kind === "kids" || title.genres.includes("Family"),
  sources: sourcesForExperienceTitle(title.id),
}));

const extrasCatalog: ExperienceTitle[] = EXTRAS.map(
  ([
    id,
    title,
    year,
    genres,
    poster,
    people,
    moods,
    kind = "movie",
    family,
  ]) => ({
    id,
    title,
    year,
    kind,
    genres: genres.split(","),
    poster: tmdb(poster),
    backdrop: tmdb(poster),
    note:
      notes[id] ??
      `${moods.split(",").slice(0, 2).join(" and ")} cinema for the right night.`,
    people: people.split(","),
    moods: moods.split(","),
    minutes: kind === "series" ? 48 : 92 + ((year + title.length) % 79),
    family,
    sources: sourcesForExperienceTitle(id),
  }),
);

export const PUBLIC_DOMAIN_TITLES: ExperienceTitle[] = [
  {
    id: "night-of-the-living-dead-1968",
    title: "Night of the Living Dead",
    year: 1968,
    kind: "movie",
    genres: ["Horror", "Mystery", "Cult"],
    poster: "https://archive.org/services/img/night_of_the_living_dead",
    backdrop: "https://archive.org/services/img/night_of_the_living_dead",
    note: "A stark independent landmark built from dread, pressure, and invention.",
    people: ["George A. Romero", "Duane Jones", "Judith O'Dea"],
    moods: ["tense", "classic", "late night"],
    minutes: 96,
    sources: sourcesForExperienceTitle("night-of-the-living-dead-1968"),
  },
  {
    id: "charade-1963",
    title: "Charade",
    year: 1963,
    kind: "movie",
    genres: ["Mystery", "Comedy", "Romance"],
    poster: "https://archive.org/services/img/Charade1963",
    backdrop: "https://archive.org/services/img/Charade1963",
    note: "A bright, slippery mystery that keeps changing the rules.",
    people: ["Audrey Hepburn", "Cary Grant", "Stanley Donen"],
    moods: ["playful", "romantic", "classic"],
    minutes: 113,
    sources: sourcesForExperienceTitle("charade-1963"),
  },
  {
    id: "his-girl-friday-1940",
    title: "His Girl Friday",
    year: 1940,
    kind: "movie",
    genres: ["Comedy", "Romance", "Drama"],
    poster: "https://archive.org/services/img/HisGirlFriday1940",
    backdrop: "https://archive.org/services/img/HisGirlFriday1940",
    note: "Quick voices, sharper timing, and a newsroom moving at full speed.",
    people: ["Cary Grant", "Rosalind Russell", "Howard Hawks"],
    moods: ["fast", "funny", "classic"],
    minutes: 92,
    sources: sourcesForExperienceTitle("his-girl-friday-1940"),
  },
  {
    id: "a-star-is-born-1937",
    title: "A Star Is Born",
    year: 1937,
    kind: "movie",
    genres: ["Drama", "Romance"],
    poster: "https://archive.org/services/img/AStarIsBorn1937",
    backdrop: "https://archive.org/services/img/AStarIsBorn1937",
    note: "Ambition, love, and the cost of being seen by everyone.",
    people: ["Janet Gaynor", "Fredric March", "William A. Wellman"],
    moods: ["romantic", "bittersweet", "classic"],
    minutes: 111,
    sources: sourcesForExperienceTitle("a-star-is-born-1937"),
  },
];

export const EXPERIENCE_CATALOG: ExperienceTitle[] = [
  ...mappedCatalog,
  ...extrasCatalog.filter(
    (extra) => !mappedCatalog.some((title) => title.title === extra.title),
  ),
  ...PUBLIC_DOMAIN_TITLES,
];

export const TITLE_BY_EXPERIENCE_ID = Object.fromEntries(
  EXPERIENCE_CATALOG.map((title) => [title.id, title]),
) as Record<string, ExperienceTitle>;

const personImage = (titleId: string) =>
  TITLE_BY_EXPERIENCE_ID[titleId]?.poster;

export const TASTE_ITEMS: TasteItem[] = [
  ...EXPERIENCE_CATALOG.map((title) => ({
    id: title.id,
    title: title.title,
    subtitle: `${title.year} · ${title.genres[0]}`,
    kind: "title" as const,
    image: title.poster || undefined,
    titleId: title.id,
  })),
  {
    id: "florence-pugh",
    title: "Florence Pugh",
    subtitle: "Midsommar · Dune · Oppenheimer",
    kind: "person",
    image: personImage("midsommar"),
  },
  {
    id: "ayo-edebiri",
    title: "Ayo Edebiri",
    subtitle: "The Bear · Bottoms",
    kind: "person",
    image: personImage("the-bear"),
  },
  {
    id: "pedro-pascal",
    title: "Pedro Pascal",
    subtitle: "The Last of Us · The Mandalorian",
    kind: "person",
    image: personImage("fallout"),
  },
  {
    id: "viola-davis",
    title: "Viola Davis",
    subtitle: "Fences · Widows · The Woman King",
    kind: "person",
    image: personImage("past-lives"),
  },
  {
    id: "ryan-gosling",
    title: "Ryan Gosling",
    subtitle: "Drive · La La Land · The Nice Guys",
    kind: "person",
    image: personImage("la-la-land"),
  },
  {
    id: "zendaya",
    title: "Zendaya",
    subtitle: "Dune · Challengers · Euphoria",
    kind: "person",
    image: personImage("tmdb-movie-693134"),
  },
  {
    id: "slow-rain",
    title: "Slow rain & neon",
    subtitle: "Blade Runner 2049 · The Batman",
    kind: "mood",
    image: personImage("tmdb-movie-335984"),
  },
  {
    id: "sunday-comfort",
    title: "Sunday comfort",
    subtitle: "The Holdovers · Paddington 2",
    kind: "mood",
    image: personImage("holdovers"),
  },
  {
    id: "big-feelings",
    title: "Big feelings",
    subtitle: "Everything Everywhere · Interstellar",
    kind: "mood",
    image: personImage("everything-everywhere"),
  },
  {
    id: "quietly-strange",
    title: "Quietly strange",
    subtitle: "Arrival · Severance · Her",
    kind: "mood",
    image: personImage("arrival"),
  },
];

/** Taste is identity, not availability. Never filter this field by provider access. */
export function tasteItemsForProfile(
  profile: Pick<ExperienceProfile, "dismissedTasteIds">,
) {
  return TASTE_ITEMS.filter(
    (item) => !profile.dismissedTasteIds.includes(item.id),
  );
}

function words(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);
}

export function searchExperienceCatalog(query: string) {
  const terms = words(query);
  if (!terms.length) return EXPERIENCE_CATALOG.slice(0, 18);
  return EXPERIENCE_CATALOG.filter((title) => {
    const haystack = [
      title.title,
      ...title.genres,
      ...title.people,
      ...title.moods,
      title.note,
    ]
      .join(" ")
      .toLowerCase();
    return (
      terms.every((term) => haystack.includes(term)) ||
      terms.some((term) => haystack.includes(term))
    );
  }).slice(0, 36);
}

export function titlesForPerson(person: string) {
  return EXPERIENCE_CATALOG.filter((title) =>
    title.people.some((name) =>
      name.toLowerCase().includes(person.toLowerCase()),
    ),
  );
}

export function curateForProfile(
  profile: ExperienceProfile,
  tonight: TonightFilters,
  kidsPresent: boolean,
  catalog: ExperienceTitle[] = EXPERIENCE_CATALOG,
) {
  const loved = new Set(
    Object.entries(profile.reactions)
      .filter(([, reaction]) => reaction === "love")
      .map(([id]) => id),
  );
  const preferredWords = new Set<string>();
  for (const id of Object.keys(profile.reactions)) {
    const title = TITLE_BY_EXPERIENCE_ID[id];
    title?.genres.forEach((genre) => preferredWords.add(genre.toLowerCase()));
    title?.moods.forEach((mood) => preferredWords.add(mood.toLowerCase()));
  }

  return catalog
    .filter((title) => (!profile.isChild && !kidsPresent) || title.family)
    .filter((title) => tonight.kind === "all" || title.kind === tonight.kind)
    .filter((title) => {
      if (tonight.duration === "short") return title.minutes <= 100;
      if (tonight.duration === "feature")
        return title.minutes > 100 && title.minutes <= 145;
      if (tonight.duration === "long")
        return title.minutes > 145 || title.kind === "series";
      return true;
    })
    .filter(
      (title) =>
        !tonight.person ||
        title.people.some((person) => person === tonight.person),
    )
    .map((title, index) => {
      let score = 120 - index;
      if (loved.has(title.id)) score += 24;
      if (profile.savedIds.includes(title.id)) score += 8;
      if (profile.lessLikeIds.includes(title.id)) score -= 80;
      for (const value of [...title.genres, ...title.moods]) {
        if (preferredWords.has(value.toLowerCase())) score += 7;
      }
      if (
        tonight.mood &&
        title.moods.some((mood) => mood.includes(tonight.mood))
      )
        score += 35;
      if (
        tonight.exploration === "adventurous" &&
        !profile.savedIds.includes(title.id)
      )
        score += index % 13;
      if (
        tonight.exploration === "familiar" &&
        profile.savedIds.includes(title.id)
      )
        score += 28;
      return { title, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ title }) => title);
}

export function whyThisTitle(
  title: ExperienceTitle,
  profile: ExperienceProfile,
) {
  const related = Object.entries(profile.reactions)
    .map(([id, reaction]) => ({ title: TITLE_BY_EXPERIENCE_ID[id], reaction }))
    .find(({ title: liked }) =>
      liked?.genres.some((genre) => title.genres.includes(genre)),
    );
  if (related?.title) {
    return `Because ${profile.name} ${related.reaction === "love" ? "loves" : "liked"} ${related.title.title}.`;
  }
  return title.note;
}
