import type { Disk, Kind, SourceId, Title } from "./types";

export const DISKS: Disk[] = [
  { id: "nvme0n1", label: "nvme0n1", size: "256 GB NVMe", kind: "OS disk", os: true },
  { id: "sda", label: "sda", size: "4 TB HDD", kind: "Data" },
  { id: "sdb", label: "sdb", size: "8 TB HDD", kind: "Data" },
];

export const SOURCES: {
  id: SourceId;
  name: string;
  blurb: string;
  mark: string;
}[] = [
  { id: "torbox", name: "TorBox", blurb: "Cloud debrid. STRM for Jellyfin, FUSE for Plex.", mark: "TB" },
  { id: "real-debrid", name: "Real-Debrid", blurb: "Cached torrents into a virtual library.", mark: "RD" },
  { id: "alldebrid", name: "AllDebrid", blurb: "Same class of cloud unlock as Real-Debrid.", mark: "AD" },
  { id: "premiumize", name: "Premiumize", blurb: "Cloud transfer plus a hosted library.", mark: "PM" },
  { id: "local-vpn", name: "Local + VPN", blurb: "qBittorrent behind Gluetun. Killswitch on.", mark: "LN" },
];

export const TITLES: Title[] = [
  {
    id: "night-harbor",
    kind: "movie",
    title: "Night Harbor",
    year: 2024,
    runtime: 118,
    rating: 8.1,
    genres: ["Noir", "Thriller"],
    overview:
      "A harbor master in a closed industrial port finds a transponder that should not exist. The tide keeps returning the same crate. Someone on the water is keeping a schedule older than the town.",
    director: "A. Voss",
    poster: "/posters/night-harbor.jpg",
    maxQuality: "4k",
    popularity: 98,
  },
  {
    id: "last-signal",
    kind: "movie",
    title: "The Last Signal",
    year: 2023,
    runtime: 132,
    rating: 7.9,
    genres: ["Sci-Fi", "Mystery"],
    overview:
      "An observatory tech decodes a burst that matches a message her late mentor filed and never sent. The dish keeps tracking a point in the sky that official charts leave blank.",
    director: "N. Okada",
    poster: "/posters/last-signal.jpg",
    maxQuality: "4k",
    popularity: 91,
  },
  {
    id: "ember-season",
    kind: "movie",
    title: "Ember Season",
    year: 2025,
    runtime: 126,
    rating: 8.4,
    genres: ["Drama"],
    overview:
      "Two estranged siblings inherit a fire lookout for one autumn. The ridge burns on a schedule. What they owe each other is older than the forest.",
    director: "M. Ellison",
    poster: "/posters/ember-season.jpg",
    maxQuality: "4k",
    popularity: 95,
  },
  {
    id: "glass-orchard",
    kind: "movie",
    title: "Glass Orchard",
    year: 2024,
    runtime: 109,
    rating: 7.6,
    genres: ["Mystery"],
    overview:
      "A botanist is hired to winterize a sealed greenhouse whose trees still fruit in the dark. Every morning a new pane is frosted from the inside.",
    director: "I. Pram",
    poster: "/posters/glass-orchard.jpg",
    maxQuality: "4k",
    popularity: 84,
  },
  {
    id: "copper-tide",
    kind: "movie",
    title: "Copper Tide",
    year: 2022,
    runtime: 141,
    rating: 7.4,
    genres: ["Adventure"],
    overview:
      "A cartographer is paid to prove a coastal path does not exist. The cliffs keep offering one anyway, always at low tide, always one hour shorter.",
    director: "R. Dalca",
    poster: "/posters/copper-tide.jpg",
    maxQuality: "4k",
    popularity: 73,
  },
  {
    id: "winter-circuit",
    kind: "movie",
    title: "Winter Circuit",
    year: 2025,
    runtime: 114,
    rating: 8.0,
    genres: ["Thriller"],
    overview:
      "A grid engineer traces a blackout to a substation that has been drawing power in a pattern only she recognizes. The snow is writing the same circuit twice.",
    director: "S. Kade",
    poster: "/posters/winter-circuit.jpg",
    maxQuality: "4k",
    popularity: 88,
  },
  {
    id: "hollow-broadcast",
    kind: "movie",
    title: "Hollow Broadcast",
    year: 2023,
    runtime: 97,
    rating: 7.2,
    genres: ["Horror"],
    overview:
      "Overnight staff at a shuttered TV plant keep finding last night's show already in the archive — with one extra extra in the frame. The transmitters were unplugged in 1998.",
    director: "K. Mirov",
    poster: "/posters/hollow-broadcast.jpg",
    maxQuality: "1080p",
    popularity: 70,
  },
  {
    id: "iron-parish",
    kind: "movie",
    title: "Iron Parish",
    year: 2021,
    runtime: 128,
    rating: 7.8,
    genres: ["Western"],
    overview:
      "A circuit preacher rides into a prairie town that has already buried him. The church is iron. The congregation is not entirely the living.",
    director: "J. Harrow",
    poster: "/posters/iron-parish.jpg",
    maxQuality: "4k",
    popularity: 76,
  },
  {
    id: "paper-moons",
    kind: "movie",
    title: "Paper Moons",
    year: 2024,
    runtime: 104,
    rating: 7.5,
    genres: ["Romance"],
    overview:
      "Two restorers of festival lanterns share a workshop for one winter. Neither intends to stay. The canal freezes in a shape that looks like a map home.",
    director: "L. Chen",
    poster: "/posters/paper-moons.jpg",
    maxQuality: "4k",
    popularity: 80,
  },
  {
    id: "drift-protocol",
    kind: "movie",
    title: "Drift Protocol",
    year: 2025,
    runtime: 148,
    rating: 8.3,
    genres: ["Sci-Fi"],
    overview:
      "A stationkeeper is ordered to abandon a corridor that still reports occupancy. The protocol says drift. The logs say someone is keeping the lights on.",
    director: "P. Rane",
    poster: "/posters/drift-protocol.jpg",
    maxQuality: "4k",
    popularity: 93,
  },
  {
    id: "salt-velvet",
    kind: "movie",
    title: "Salt and Velvet",
    year: 2022,
    runtime: 121,
    rating: 7.7,
    genres: ["Period", "Drama"],
    overview:
      "A salon in 1924 begins serving a salt that cannot be sourced. Guests leave with other people's memories. The hostess keeps a ledger in a language she does not speak.",
    director: "C. Moreau",
    poster: "/posters/salt-velvet.jpg",
    maxQuality: "4k",
    popularity: 74,
  },
  {
    id: "after-floodlights",
    kind: "movie",
    title: "After the Floodlights",
    year: 2024,
    runtime: 119,
    rating: 7.3,
    genres: ["Drama", "Sport"],
    overview:
      "A groundskeeper stays after the last home game of a club that will not exist in the morning. The grass keeps the shape of a play that never made the record.",
    director: "T. Brann",
    poster: "/posters/after-floodlights.jpg",
    maxQuality: "1080p",
    popularity: 68,
  },
  {
    id: "red-line-harvest",
    kind: "movie",
    title: "Red Line Harvest",
    year: 2023,
    runtime: 135,
    rating: 8.2,
    genres: ["Crime"],
    overview:
      "A grain buyer notices the same freight car returning full after every empty run. The harvest is a cover. The red line is a schedule for men who are not farmers.",
    director: "D. Pell",
    poster: "/posters/red-line-harvest.jpg",
    maxQuality: "4k",
    popularity: 86,
  },
  {
    id: "chamber-12",
    kind: "movie",
    title: "Chamber 12",
    year: 2025,
    runtime: 96,
    rating: 7.1,
    genres: ["Psychological"],
    overview:
      "An auditor is locked in for a standard overnight review. The file on the table is her own. Chamber 12 does not appear on the building plan.",
    director: "E. Sol",
    poster: "/posters/chamber-12.jpg",
    maxQuality: "1080p",
    popularity: 64,
  },
  {
    id: "quiet-atlas",
    kind: "movie",
    title: "The Quiet Atlas",
    year: 2021,
    runtime: 111,
    rating: 8.0,
    genres: ["Drama"],
    overview:
      "A map conservator is asked to restore a coastline that has not existed since 1842. Each night the ink redraws a city she almost remembers.",
    director: "H. Ibarra",
    poster: "/posters/quiet-atlas.jpg",
    maxQuality: "4k",
    popularity: 72,
  },
  {
    id: "static-kingdom",
    kind: "movie",
    title: "Static Kingdom",
    year: 2024,
    runtime: 139,
    rating: 7.9,
    genres: ["Dystopia"],
    overview:
      "In a palace that broadcasts weather instead of ruling, a junior clerk finds a frequency that still names the old streets. The snow is not weather.",
    director: "V. Kren",
    poster: "/posters/static-kingdom.jpg",
    maxQuality: "4k",
    popularity: 82,
  },
  {
    id: "station-line",
    kind: "tv",
    title: "Station Line",
    year: 2024,
    seasons: 3,
    runtime: 48,
    rating: 8.2,
    genres: ["Procedural"],
    overview:
      "Night-shift transit police work a single subway line that keeps delivering the same missing person to different decades. The last train is never listed.",
    director: "G. Marlowe",
    poster: "/posters/station-line.jpg",
    maxQuality: "4k",
    popularity: 94,
  },
  {
    id: "harbor-watch",
    kind: "tv",
    title: "Harbor Watch",
    year: 2023,
    seasons: 2,
    runtime: 52,
    rating: 7.8,
    genres: ["Mystery"],
    overview:
      "A lighthouse keeper and a marine insurer investigate wrecks that happen on nights with no weather. The lantern room has a second log.",
    director: "F. Quinn",
    poster: "/posters/harbor-watch.jpg",
    maxQuality: "4k",
    popularity: 81,
  },
  {
    id: "second-shift",
    kind: "tv",
    title: "Second Shift",
    year: 2025,
    seasons: 1,
    runtime: 42,
    rating: 7.6,
    genres: ["Drama"],
    overview:
      "The 2 a.m. crew at a 24-hour diner serves a town that officially sleeps. Regulars pay in favors. The pie case is a filing system.",
    director: "A. Ruiz",
    poster: "/posters/second-shift.jpg",
    maxQuality: "1080p",
    popularity: 77,
  },
  {
    id: "millwrights",
    kind: "tv",
    title: "The Millwrights",
    year: 2022,
    seasons: 4,
    runtime: 56,
    rating: 8.4,
    genres: ["Family", "Drama"],
    overview:
      "Three generations keep a brick mill running after the river company leaves. The machines remember a wage the books no longer show.",
    director: "B. Cole",
    poster: "/posters/millwrights.jpg",
    maxQuality: "4k",
    popularity: 85,
  },
  {
    id: "deep-current",
    kind: "tv",
    title: "Deep Current",
    year: 2024,
    seasons: 2,
    runtime: 44,
    rating: 8.0,
    genres: ["Science"],
    overview:
      "A small submersible team maps a current that should not hold a shape. Each dive returns with a sample from a year they have not dived yet.",
    director: "N. Hale",
    poster: "/posters/deep-current.jpg",
    maxQuality: "4k",
    popularity: 79,
  },
  {
    id: "orbital-kitchen",
    kind: "tv",
    title: "Orbital Kitchen",
    year: 2025,
    seasons: 1,
    runtime: 28,
    rating: 7.7,
    genres: ["Comedy", "Sci-Fi"],
    overview:
      "The galley of a tired waystation feeds crews who were never scheduled to dock. Recipes are classified. The citrus is contraband.",
    director: "Y. Park",
    poster: "/posters/orbital-kitchen.jpg",
    maxQuality: "4k",
    popularity: 75,
  },
  {
    id: "circuit-sakura",
    kind: "anime",
    title: "Circuit Sakura",
    year: 2024,
    seasons: 2,
    runtime: 24,
    rating: 8.5,
    genres: ["Anime", "Sci-Fi"],
    overview:
      "A city that blooms in code every spring hires a student to prune one street. The petals are packets. Cutting the wrong branch unhooks a life.",
    director: "Studio Northline",
    poster: "/posters/circuit-sakura.jpg",
    maxQuality: "4k",
    popularity: 90,
  },
  {
    id: "tidebound",
    kind: "anime",
    title: "Tidebound Academy",
    year: 2025,
    seasons: 1,
    runtime: 24,
    rating: 8.1,
    genres: ["Anime"],
    overview:
      "A seaside school teaches navigation by asking the tide to sit still. First-years who fail the exam wake up further out than they remember walking.",
    director: "Studio Northline",
    poster: "/posters/tidebound.jpg",
    maxQuality: "4k",
    popularity: 83,
  },
  {
    id: "maple-pilot",
    kind: "kids",
    title: "Maple Pilot",
    year: 2023,
    runtime: 86,
    rating: 7.9,
    genres: ["Family", "Adventure"],
    overview:
      "A small yellow plane that only flies in autumn takes a shy navigator over a forest that rearranges itself each year. Home is a runway of leaves.",
    director: "R. Whit",
    poster: "/posters/maple-pilot.jpg",
    maxQuality: "4k",
    popularity: 71,
  },
  {
    id: "cloud-workshop",
    kind: "kids",
    title: "Cloud Workshop",
    year: 2024,
    runtime: 78,
    rating: 7.8,
    genres: ["Family"],
    overview:
      "In a timber loft above the weather, two apprentices learn to patch holes in the sky. Saturday's cloud is always due back by Monday.",
    director: "S. Linden",
    poster: "/posters/cloud-workshop.jpg",
    maxQuality: "1080p",
    popularity: 66,
  },
  {
    id: "north-room",
    kind: "music",
    title: "North Room",
    year: 2024,
    tracks: 11,
    runtime: 47,
    rating: 8.0,
    genres: ["Ambient"],
    overview:
      "A quiet record made in a north-facing room. Tape hiss, a window, and eleven pieces that sound like furniture remembering weather.",
    director: "Ada North",
    poster: "/posters/north-room.jpg",
    maxQuality: "4k",
    popularity: 60,
  },
  {
    id: "lowland-radio",
    kind: "music",
    title: "Lowland Radio",
    year: 2023,
    tracks: 9,
    runtime: 41,
    rating: 7.6,
    genres: ["Folk"],
    overview:
      "Songs written between AM stations on a floodplain. The chorus is always a weather report for a county that dropped off the map.",
    director: "The Lowlands",
    poster: "/posters/lowland-radio.jpg",
    maxQuality: "1080p",
    popularity: 55,
  },
];

export const TITLE_BY_ID: Record<string, Title> = Object.fromEntries(
  TITLES.map((t) => [t.id, t]),
);

const extra: Record<string, Title> = {};

/** Engine lookup (TMDB via Radarr/Sonarr) lives here so title pages resolve after search. */
export function rememberCatalogTitles(list: Title[] | null | undefined) {
  if (!list || !list.length) return;
  for (const t of list) extra[t.id] = t;
}

export function getTitle(id: string) {
  return TITLE_BY_ID[id] ?? extra[id];
}

export function kindLabel(kind: Kind) {
  switch (kind) {
    case "movie":
      return "Movie";
    case "tv":
      return "TV";
    case "anime":
      return "Anime";
    case "kids":
      return "Kids";
    case "music":
      return "Music";
    case "book":
      return "Book";
  }
}

export function searchTitles(q: string) {
  const n = q.trim().toLowerCase();
  if (!n) return [];
  return TITLES.filter((t) => {
    const hay = `${t.title} ${t.genres.join(" ")} ${t.director ?? ""} ${t.year}`.toLowerCase();
    return hay.includes(n);
  }).sort((a, b) => b.popularity - a.popularity);
}

export function titlesForKind(kind: Kind) {
  return TITLES.filter((t) => t.kind === kind).sort((a, b) => b.popularity - a.popularity);
}

export const LAN_IP = "";
export const HOSTNAME = "reelos.local";
