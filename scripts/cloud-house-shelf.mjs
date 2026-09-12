/**
 * House On this box fixture for cloud hashed-UI clicks when Jellyfin is red.
 * Named Silo / Reacher / The Rookie win dump twins. Never wipes /media.
 */
import { homeShelfRows } from "./reelos-library.mjs";

export const HOUSE_NAMED = [
  {
    id: "tvdb-403245",
    kind: "tv",
    title: "Silo",
    year: 2023,
    poster: "",
    ids: ["tvdb-403245", "tmdb-tv-125988"],
    jellyfinId: "silo",
    onDiskSeasons: [1, 2, 3],
    unreleasedSeasons: [4],
    seasonList: [1, 2, 3, 4],
  },
  {
    id: "tvdb-366924",
    kind: "tv",
    title: "Reacher",
    year: 2022,
    poster: "",
    ids: ["tvdb-366924", "tmdb-tv-108978"],
    jellyfinId: "reach",
    onDiskSeasons: [1],
    importingSeasons: [2],
    seasonList: [1, 2],
  },
  {
    id: "tvdb-350665",
    kind: "tv",
    title: "The Rookie",
    year: 2018,
    poster: "",
    ids: ["tvdb-350665", "tmdb-tv-79744"],
    jellyfinId: "rook",
    onDiskSeasons: [1],
    importingSeasons: [2, 3, 4, 5, 6, 7, 8],
    unreleasedSeasons: [9],
    seasonList: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  },
];

export const HOUSE_DUMP_TWINS = [
  {
    id: "jf-orgsilo",
    kind: "tv",
    title: "www UIndex org - Silo",
    year: 0,
    poster: "",
    ids: ["jf-orgsilo"],
    jellyfinId: "orgsilo",
    path: "/symlinks/sonarr/www.UIndex.org - Silo",
    importingSeasons: [1],
    fromDump: true,
  },
  {
    id: "jf-torrsilo",
    kind: "tv",
    title: "www Torrenting com - Silo",
    year: 0,
    poster: "",
    ids: ["jf-torrsilo"],
    jellyfinId: "torrsilo",
    path: "/symlinks/sonarr/www.Torrenting.com - Silo",
    importingSeasons: [2],
    fromDump: true,
  },
  {
    id: "jf-ponte",
    kind: "tv",
    title: "Reacher Il Ponte",
    year: 0,
    poster: "",
    ids: ["jf-ponte"],
    jellyfinId: "ponte",
    path: "/symlinks/sonarr/Reacher Il Ponte",
    importingSeasons: [2],
    fromDump: true,
  },
  {
    id: "jf-orgrook",
    kind: "tv",
    title: "www UIndex org - The Rookie",
    year: 0,
    poster: "",
    ids: ["jf-orgrook"],
    jellyfinId: "orgrook",
    path: "/symlinks/sonarr/www.UIndex.org - The.Rookie.S02E14",
    importingSeasons: [2],
    fromDump: true,
  },
];

/** Dump that is not a twin of a named title — Remove must not hide The Rookie. */
export const HOUSE_UNMATCHED_DUMP = {
  id: "jf-orgdump",
  kind: "tv",
  title: "www UIndex org - Completely Different Show",
  year: 0,
  poster: "",
  ids: ["jf-orgdump"],
  jellyfinId: "orgdump",
  path: "/symlinks/sonarr/www.UIndex.org - Completely.Different.Show",
  fromDump: true,
};

export function houseRawShelf() {
  return [...HOUSE_DUMP_TWINS, HOUSE_UNMATCHED_DUMP, ...HOUSE_NAMED];
}

export function houseHomeShelf() {
  return homeShelfRows(houseRawShelf());
}

function titleMatches(t, id) {
  const want = String(id || "");
  if (!want) return false;
  const keys = [t?.id, ...(t?.ids || []), t?.jellyfinId, t?.jellyfinId ? `jf-${t.jellyfinId}` : ""].map(String);
  return keys.includes(want);
}

export function houseTitleById(id) {
  return houseRawShelf().find((t) => titleMatches(t, id)) || null;
}

export function mergeLibraryJson(json) {
  const live = Array.isArray(json?.titles) ? json.titles : [];
  const have = new Set(live.flatMap((t) => [t.id, ...(t.ids || [])].map(String)));
  const extra = houseRawShelf().filter((t) => !have.has(String(t.id)));
  return {
    ...json,
    titles: homeShelfRows([...live, ...extra]),
    error: null,
  };
}

export function mergeLookupJson(json, id) {
  const house = houseTitleById(id);
  const titles = Array.isArray(json?.titles) ? json.titles.map((t) => ({ ...t })) : [];
  if (!titles.length && house) titles.push({ ...house });
  for (const t of titles) {
    const hit = houseTitleById(t.id) || house;
    if (!hit) continue;
    // House fixture wins overlapping seasons so live Seerr Watch does not cancel Importing/Coming.
    const unreleased = [...new Set(hit.unreleasedSeasons || [])];
    const importing = [...new Set(hit.importingSeasons || [])].filter((n) => !unreleased.includes(n));
    const disk = [...new Set(hit.onDiskSeasons || [])].filter((n) => !importing.includes(n) && !unreleased.includes(n));
    t.onDiskSeasons = disk;
    t.importingSeasons = importing;
    t.unreleasedSeasons = unreleased;
    t.seasonList = [...new Set([...(hit.seasonList || []), ...disk, ...importing, ...unreleased])].sort((a, b) => a - b);
    t.year = t.year || hit.year;
    t.jellyfinId = t.jellyfinId || hit.jellyfinId;
    if (t.reason && /0%/.test(String(t.reason))) t.reason = "On disk, importing";
  }
  return { ...json, titles, error: json?.error || null };
}

/** Leftover ota.lock flock — never delete the lock; lie only to the click-loop session. */
export function idleUpdateStatus(local = "1.2.50.56") {
  return {
    ok: true,
    running: false,
    held: false,
    local,
    target: null,
    log: "",
    library: {
      status: "done",
      splashLock: false,
      needsImport: false,
      message: "Library catch-up done",
      folder: 0,
      total: 0,
      skipped: 0,
      timeouts: 0,
    },
    progress: { message: "", percent: null, stalled: false, label: "idle", stageIndex: 0, stageCount: 0 },
  };
}

/** Leftover cloud flock on ota.lock must not splash-lock hashed Home. Never delete the lock. */
export function honestReadyJson(json, shelf) {
  const titles = Array.isArray(shelf) ? shelf : houseHomeShelf();
  const update = json?.update && typeof json.update === "object" ? { ...json.update } : {};
  update.running = false;
  if (update.progress && typeof update.progress === "object") {
    update.progress = { ...update.progress, status: "idle", stalled: false, percent: null };
  }
  return {
    ...json,
    provisioned: true,
    titles,
    continueWatching: Array.isArray(json?.continueWatching) ? json.continueWatching : [],
    update,
    libraryCatchup: {
      ...(json?.libraryCatchup || {}),
      status: "done",
      splashLock: false,
      needsImport: false,
      message: "Library catch-up done",
    },
  };
}
