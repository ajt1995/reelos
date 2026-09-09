export const LATEST_VERSION = "1.2.50.10";
export const SHIPPED_VERSION = "1.2.50.10";
export const UPDATE_NOTES = [
  "1.2.50.10: Disabled Decypharr client is not a lock. Doctor fails closed when it cannot probe download clients. recover=1 only kicks Seerr-requested titles, not the whole *arr backlog. Ghost AVAILABLE and GET-by-id carry a reason. Retry re-POSTs /api/request. Complements #62. Not 1.2.51 (Tron #52).",
  "1.2.50.9: Home merges a jf-only season-folder row (TWD - Season 1 / 2011) onto the tvdb series even when PremiereDate ≠ series year. Remakes and anime split seasons with real ids stay separate. Apply heals leftover JF Series items (delete/rename) — season-named dump dirs only, never a /media local-disk row. Requests never sit on silent 0% — say searching / unmonitored / quality / queue; recover monitors and MoviesSearchs. Not 1.2.51 (Tron #52).",
  "1.2.50.8: Home collapses JF season-folder aliases (B99 S01 / TWD - Season 1) without hiding remakes. Apply heals leftover JF libraries/paths and season-named dumps; keeps /media on local/both. Movie POST/recover locks Decypharr, widens quality, adds to Radarr if Seerr never pushed, then MoviesSearch. Honest reason when Radarr has no movie or no grab client. Not 1.2.51 (Tron #52).",
  "1.2.50.7: OTA POSTs EZTV/ShowRSS via TorrentRss when Cardigann schema is missing. Doctor lists every indexer. recover=1 locks Decypharr + falls Ultra-HD back to Any so SeasonSearch can grab 720p. Jellyfin Movies/Shows keep one dump path (no Interstellar×3). Not 1.2.51 (Tron #52).",
  "1.2.50.6: OTA adds EZTV/ShowRSS (YTS is movies-only) and fullSyncs Prowlarr→Sonarr. SeasonSearch still fires for 0-file TV. MoviesSearch on movie POST. Not 1.2.51 (Tron #52).",
  "1.2.50.5: Discover search surfaces Seerr timeout/empty honestly. TV POST is one season (never all). No Cached glow on live TMDB ids. QA gate: 2 movies + 2 TV seasons 2012–2016 search→request→honest 0%. Not 1.2.51 (Tron #52).",
  "1.2.50.4: SeasonSearch on empty TV season POST/reuse. GET /api/request?recover=1. stuck-downloads searches 0-file monitored seasons. Keep Decypharr dumps. Honest unfinished TV when Seerr is empty. Not 1.2.51 (Tron #52).",
  "1.2.50.3: Apply Stage 3 heartbeat. Relink recreates empty sonarr/radarr dumps from FUSE. Title page season-honest, no 42%. Not 1.2.51 (Tron #52).",
  "1.2.50.2: Requests tell the truth. Library / Seerr available / *arr hasFile ⇒ AVAILABLE, not grabbing. Duplicate same title+season collapses. Not 1.2.51 (Tron #52).",
  "1.2.50.1: TV season grab→symlink→Sonarr import. Skip movie dumps under Sonarr. Match S01.E01 / season packs. Reuse duplicate season requests.",
  "1.2.50: Stacked house Apply (#45–#50). Overlay house compose/configs so #49 seed cannot nest. FUSE rslave ENOTCONN heal + importPending retry. Check then Apply.",
];
