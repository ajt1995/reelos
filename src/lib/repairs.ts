/** Phone Settings Fix cards. Ids must match scripts/reelos-repair.mjs. */

export const REPAIR_GROUPS = [
  { id: "library", title: "When the library looks wrong" },
  { id: "requests", title: "When a request sits" },
  { id: "fuse", title: "When files vanished" },
] as const;

export const REPAIRS = [
  {
    id: "posters",
    group: "library",
    title: "One poster per movie",
    blurb: "Park extra 4K copies, keep 1080 next to 4K, merge Jellyfin Movies so Interstellar is not two posters.",
  },
  {
    id: "hybrid1080",
    group: "library",
    title: "Grab a 1080 next to 4K",
    blurb: "If a movie only has 4K, search for a 1080 and keep both. Does nothing when you already have both.",
  },
  {
    id: "import",
    group: "library",
    title: "Import what’s already downloaded",
    blurb: "Scan TorBox dumps into Radarr/Sonarr, collapse leftover folders, then heal Jellyfin. Never writes to /media.",
  },
  {
    id: "downloads",
    group: "requests",
    title: "Unstick grabs",
    blurb: "Clear stuck 0% queue rows, remount FUSE if it is disconnected, search movies that never got a file.",
  },
  {
    id: "indexers",
    group: "requests",
    title: "Fix search indexers",
    blurb: "Add public movie/TV indexers and push them to Radarr/Sonarr so a request can actually search.",
  },
  {
    id: "wire",
    group: "requests",
    title: "Rewire engines",
    blurb: "Lock Decypharr as the download client, widen 1080+4K, restore recycled 1080s, fix Jellyfin libraries.",
  },
  {
    id: "fuse",
    group: "fuse",
    title: "Remount debrid files",
    blurb: "When the library path says Socket not connected after Decypharr remounted.",
  },
] as const;

export type RepairId = (typeof REPAIRS)[number]["id"];
