import type { Kind, MediaRequest, RequestStatus, Title } from "./types.ts";

const IN_FLIGHT = new Set<RequestStatus>(["downloading", "waiting"]);

/** Fresh local POST that Seerr has not echoed yet. Older unmatched inflight is stale persist. */
export const OPTIMISTIC_LOCAL_MS = 90_000;

/** Raw TMDB ids are not a title — National Treasure must not paint as tmdb-2059. */
export function isGhostRequestLabel(title?: string, titleId?: string): boolean {
  const name = String(title || "").trim();
  const id = String(titleId || "").trim();
  if (!name) return true;
  if (id && name === id) return true;
  if (/^[0-9a-f]{32,64}$/i.test(name)) return true;
  return /^tmdb(-tv)?-\d+$/i.test(name);
}

function isOptimisticLocal(row: Pick<MediaRequest, "createdAt" | "updatedAt">, now = Date.now()): boolean {
  const at = Math.max(row.updatedAt || 0, row.createdAt || 0);
  return now - at < OPTIMISTIC_LOCAL_MS;
}

/** Searching / grabbing / linked waiting for import. Available, failed, and engine-downloaded are not. */
export function isInFlightRequest(r: { status: string; engine?: string }): boolean {
  if (r.engine === "downloaded") return false;
  return IN_FLIGHT.has(r.status as RequestStatus);
}

/** Home "Your requests", Requests page, and transferring chip: overlay library hits, then keep in-flight only. */
export function inFlightRequests(
  requests: MediaRequest[],
  opts: { libraryIds?: string[]; titles?: Pick<Title, "id" | "ids" | "kind" | "jellyfinId" | "onDiskSeasons">[] } = {},
): MediaRequest[] {
  return overlayLibraryPresence(requests, opts).filter(isInFlightRequest);
}

export function isTvRequestRow(row: Pick<MediaRequest, "titleId" | "season">): boolean {
  const id = String(row.titleId || "");
  return id.startsWith("tmdb-tv-") || id.startsWith("tvdb-") || row.season != null;
}

/** Per-season Watch vs Request from files on disk — series AVAILABLE is not S05 Watch. */
export function tvSeasonChips(
  titleId: string,
  requests: MediaRequest[],
  titles: Pick<Title, "id" | "ids" | "kind" | "jellyfinId" | "onDiskSeasons">[] = [],
): { season: number; label: "Watch" | "Request" }[] {
  const keys = new Set(titlePresenceKeys(titleId));
  const bySeason = new Map<number, "Watch" | "Request">();
  for (const t of titles) {
    if (!titleMatchesId(t, titleId)) continue;
    for (const n of t.onDiskSeasons || []) {
      const season = Number(n);
      if (Number.isFinite(season) && season > 0) bySeason.set(season, "Watch");
    }
  }
  for (const row of requests) {
    if (!titlePresenceKeys(row.titleId).some((k) => keys.has(k))) continue;
    if (row.season == null) continue;
    const n = Number(row.season);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (bySeason.get(n) === "Watch") continue;
    bySeason.set(n, "Request");
  }
  return [...bySeason.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([season, label]) => ({ season, label }));
}

/** Movies: hide Request/Grabbing/Waiting once the title is available. TV/anime: hide only when this season is available. */
export function showRequestQueueControls(opts: {
  kind: Kind;
  available: boolean;
  requestStatus?: RequestStatus | null;
}): boolean {
  const series = opts.kind === "tv" || opts.kind === "anime";
  if (series) return opts.requestStatus !== "available";
  return !opts.available;
}

/** Locks that will never progress without a write — Retry must stay visible (Cancel is not enough). */
export function requestShowsRetry(r: { status: string; reason?: string }): boolean {
  if (r.status === "failed") return true;
  if (r.status === "available") return false;
  return /will not run|has no movie yet|has no series yet|cannot land/i.test(r.reason || "");
}

function requestMatchKey(r: Pick<MediaRequest, "titleId" | "season">): string {
  return r.season == null ? r.titleId : `${r.titleId}#${r.season}`;
}

function seasonsCompatible(a?: number, b?: number): boolean {
  return a == null || b == null || a === b;
}

function preferServerRow(local: MediaRequest, server: MediaRequest): MediaRequest {
  const progress =
    server.status === "available"
      ? 100
      : typeof server.progress === "number" && server.progress > 0
        ? Math.max(0, Math.min(100, Math.round(server.progress)))
        : server.status === local.status
          ? local.progress
          : typeof server.progress === "number"
            ? server.progress
            : 0;
  return {
    ...local,
    ...server,
    id: server.id || local.id,
    status: server.status,
    progress,
    createdAt: local.createdAt || server.createdAt,
    updatedAt: Math.max(local.updatedAt || 0, server.updatedAt || 0),
    requester: server.requester || local.requester,
    season: server.season ?? local.season,
    via: server.via ?? local.via,
    release: server.release ?? local.release,
    reason: server.status === "failed" ? (server.reason ?? local.reason) : server.reason,
  };
}

/** Merge GET /api/request list into persisted local rows. Server status/progress wins. */
export function mergeServerRequests(local: MediaRequest[], server: MediaRequest[]): MediaRequest[] {
  if (!server.length) return local;

  const serverById = new Map<string, MediaRequest>();
  const serverByKey = new Map<string, MediaRequest>();
  for (const row of server) {
    if (row.id) serverById.set(row.id, row);
    if (row.titleId) serverByKey.set(requestMatchKey(row), row);
  }

  const used = new Set<string>();
  const out: MediaRequest[] = [];

  for (const loc of local) {
    const match = (loc.id ? serverById.get(loc.id) : undefined) || serverByKey.get(requestMatchKey(loc));
    if (match) {
      if (used.has(match.id)) continue;
      used.add(match.id);
      out.push(preferServerRow(loc, match));
      continue;
    }

    if (loc.status === "downloading" || loc.status === "waiting") {
      const available = server.find(
        (s) =>
          s.titleId === loc.titleId &&
          s.status === "available" &&
          seasonsCompatible(s.season, loc.season),
      );
      if (available) {
        if (used.has(available.id)) continue;
        used.add(available.id);
        out.push(preferServerRow(loc, available));
        continue;
      }
      // Seerr listed another season for this title — keep this season row.
      if (server.some((s) => s.titleId === loc.titleId)) {
        out.push(loc);
        continue;
      }
      // Non-empty server list is source of truth. Drop phone persist Seerr dropped,
      // except a just-tapped Request that has not echoed yet — or a stuck movie
      // Seerr still owns while Radarr has no row (Requests must not go empty).
      if (isOptimisticLocal(loc) || /has no movie yet|has no series yet|search cannot land/i.test(loc.reason || "")) {
        out.push(loc);
        continue;
      }
      continue;
    }

    out.push(loc);
  }

  for (const row of server) {
    if (used.has(row.id)) continue;
    const key = requestMatchKey(row);
    const existing = out.find((r) => requestMatchKey(r) === key && r.status !== "failed");
    if (existing && row.status !== "available") continue;
    out.push({
      ...row,
      progress: row.status === "available" ? 100 : (row.progress ?? 0),
    });
  }

  return collapseDuplicateRequests(out);
}

const STATUS_RANK: Record<string, number> = { available: 4, downloading: 3, waiting: 2, failed: 1 };

/** Home Your requests: one card per title, not every season row (two Expanse Waitings). */
export function collapseHomeRequestCards(rows: MediaRequest[]): MediaRequest[] {
  const groups = new Map<string, MediaRequest[]>();
  for (const row of rows) {
    if (!row?.titleId) continue;
    const list = groups.get(row.titleId) || [];
    list.push(row);
    groups.set(row.titleId, list);
  }
  const out: MediaRequest[] = [];
  for (const list of groups.values()) {
    out.push(
      list.reduce((best, row) => {
        const br = STATUS_RANK[best.status] || 0;
        const rr = STATUS_RANK[row.status] || 0;
        if (rr !== br) return rr > br ? row : best;
        if ((row.progress || 0) !== (best.progress || 0)) {
          return (row.progress || 0) > (best.progress || 0) ? row : best;
        }
        return (row.updatedAt || 0) >= (best.updatedAt || 0) ? row : best;
      }),
    );
  }
  return out;
}

/** Transferring chip matches the collapsed Home cards, not every season row. */
export function transferringChipCount(rows: MediaRequest[]): number {
  return collapseHomeRequestCards(rows).length;
}

function markAvailable(row: MediaRequest): MediaRequest {
  return { ...row, status: "available", progress: 100, reason: undefined };
}

function isMovieRequest(row: Pick<MediaRequest, "titleId" | "season">): boolean {
  return !String(row.titleId).startsWith("tmdb-tv-") && row.season == null;
}

export function titlePresenceKeys(id: string, extra: string[] = []): string[] {
  const keys = new Set<string>();
  const add = (raw?: string) => {
    const s = String(raw || "").trim();
    if (!s) return;
    keys.add(s);
  };
  add(id);
  extra.forEach(add);
  // TV pages alias the movie-shaped tmdb-* id. A movie page must not grow tmdb-tv-*
  // or Moon /title/tmdb-17431 POSTs The Great Escape.
  if (id.startsWith("tmdb-tv-")) add(`tmdb-${id.slice(8)}`);
  return [...keys];
}

/** POST /api/request titleId: movie pages stay tmdb-<n>, never tmdb-tv-<n>. */
export function requestTitleIdForPage(
  pageId: string,
  kind?: Kind | null,
  extraIds: string[] = [],
): string {
  const series = kind === "tv" || kind === "anime";
  const ids = extraIds.map(String);
  if (series || pageId.startsWith("tmdb-tv-") || pageId.startsWith("tvdb-")) {
    return ids.find((k) => k.startsWith("tmdb-tv-")) || (pageId.startsWith("tmdb-tv-") ? pageId : "") || ids.find((k) => /^tmdb-\d/.test(k)) || pageId;
  }
  if (pageId.startsWith("tmdb-") && !pageId.startsWith("tmdb-tv-")) return pageId;
  return ids.find((k) => /^tmdb-\d/.test(k) && !k.startsWith("tmdb-tv-")) || pageId;
}

export function requestMediaTypeForPage(pageId: string, kind?: Kind | null): "tv" | "movie" {
  if (kind === "tv" || kind === "anime") return "tv";
  if (kind === "movie") return "movie";
  if (pageId.startsWith("tmdb-tv-") || pageId.startsWith("tvdb-")) return "tv";
  return "movie";
}

/** Hash paste is for unnamed dumps. Request on a named title goes to Seerr/*arr. */
export function showHashAdapter(opts: { pageId?: string; title?: string } = {}): boolean {
  const name = String(opts.title || "").trim();
  const id = String(opts.pageId || "").trim();
  if (name === "Unknown on this box") return true;
  return /^[0-9a-f]{32,64}$/i.test(name) || /^[0-9a-f]{32,64}$/i.test(id);
}

export function titleMatchesId(
  t: Pick<Title, "id" | "ids" | "jellyfinId">,
  id: string,
): boolean {
  const keys = new Set(titlePresenceKeys(t.id, t.ids || []));
  if (t.jellyfinId) {
    keys.add(String(t.jellyfinId));
    keys.add(`jf-${t.jellyfinId}`);
  }
  return titlePresenceKeys(id).some((k) => keys.has(k));
}

/** Home cards: shelf / remembered titles / the request's own name. Always a Title so chip and cards match. */
export function titleForRequest(
  r: Pick<MediaRequest, "titleId" | "title">,
  titles: Pick<Title, "id" | "ids" | "kind" | "title" | "year" | "poster" | "jellyfinId">[] = [],
): Title {
  const hit = titles.find((t) => titleMatchesId(t, r.titleId));
  if (hit) return hit as Title;
  return {
    id: r.titleId,
    kind: String(r.titleId).startsWith("tmdb-tv-") ? "tv" : "movie",
    title: r.title || r.titleId,
    year: 0,
    rating: 0,
    genres: [],
    overview: "",
    poster: "",
    maxQuality: "1080p",
    popularity: 0,
  };
}

function isHashDumpId(id: string) {
  const s = String(id || "");
  return /^[0-9a-f]{32,64}$/i.test(s) || /^jf-[0-9a-f]{32,64}$/i.test(s);
}

function titleInDropSet(t: Pick<Title, "id" | "ids" | "jellyfinId">, keys: Set<string>): boolean {
  const ids = titlePresenceKeys(t.id, t.ids || []);
  if (t.jellyfinId) {
    ids.push(String(t.jellyfinId), `jf-${t.jellyfinId}`);
  }
  return ids.some((k) => keys.has(k));
}

/** Drop a title from shelf, library ids, and request overlay. TV drops every season row. */
export function dropLibraryOverlay(
  state: { shelf?: Title[]; library?: string[]; requests?: MediaRequest[] },
  titleId: string,
  extraIds: string[] = [],
): { shelf: Title[]; library: string[]; requests: MediaRequest[]; keys: string[] } {
  const keys = new Set(titlePresenceKeys(titleId, extraIds));
  const hashOnly = [...keys].some(isHashDumpId) && ![...keys].some((k) => /^(tmdb-|tvdb-)/.test(k));
  for (const t of state.shelf || []) {
    if (!titleInDropSet(t, keys)) continue;
    for (const k of titlePresenceKeys(t.id, t.ids || [])) {
      if (hashOnly && /^(tmdb-|tvdb-)/.test(k)) continue;
      if (hashOnly && !isHashDumpId(k) && !k.startsWith("jf-")) continue;
      keys.add(k);
    }
    if (t.jellyfinId && !hashOnly) {
      keys.add(String(t.jellyfinId));
      keys.add(`jf-${t.jellyfinId}`);
    } else if (t.jellyfinId && hashOnly) {
      const jf = String(t.jellyfinId);
      if ([titleId, ...extraIds].some((id) => String(id) === jf || String(id) === `jf-${jf}`)) {
        keys.add(jf);
        keys.add(`jf-${jf}`);
      }
    }
  }
  const gone = (id: string) => keys.has(id) || titlePresenceKeys(id).some((k) => keys.has(k));
  const keepNamed = (t: Pick<Title, "id" | "ids">) =>
    hashOnly && [t.id, ...(t.ids || [])].some((id) => /^(tmdb-|tvdb-)/.test(String(id)));
  return {
    shelf: (state.shelf || []).filter((t) => keepNamed(t) || !titleInDropSet(t, keys)),
    library: (state.library || []).filter((id) => (hashOnly && /^(tmdb-|tvdb-)/.test(String(id))) || !gone(String(id))),
    requests: (state.requests || []).filter((r) => {
      if (!r?.titleId) return true;
      if (hashOnly && /^(tmdb-|tvdb-)/.test(String(r.titleId))) return true;
      return !gone(r.titleId);
    }),
    keys: [...keys],
  };
}

/** Collapse same titleId+season. A done sibling upgrades the rest. */
export function collapseDuplicateRequests(rows: MediaRequest[]): MediaRequest[] {
  const groups = new Map<string, MediaRequest[]>();
  for (const row of rows) {
    if (!row?.titleId) continue;
    const key = requestMatchKey(row);
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  const out: MediaRequest[] = [];
  for (const list of groups.values()) {
    const anyAvailable = list.some((r) => r.status === "available" || r.engine === "downloaded");
    const picked = list.reduce((best, row) => {
      const br = STATUS_RANK[best.status] || 0;
      const rr = STATUS_RANK[row.status] || 0;
      if (rr !== br) return rr > br ? row : best;
      return (row.updatedAt || 0) >= (best.updatedAt || 0) ? row : best;
    });
    out.push(anyAvailable ? markAvailable(picked) : picked);
  }
  return out;
}

function mapEnginePollStatus(status?: string | null): RequestStatus | null {
  if (status === "downloaded" || status === "available") return "available";
  if (status === "grabbing" || status === "downloading") return "downloading";
  if (status === "failed") return "failed";
  if (status === "queued" || status === "waiting") return "waiting";
  return null;
}

/** Title-page GET /api/request poll: only the matching title+season row. */
export function applyTitleRequestPoll(
  requests: MediaRequest[],
  opts: { titleId: string; extraIds?: string[]; season?: number; status?: string | null; progress?: number; reason?: string },
): MediaRequest[] {
  const mapped = mapEnginePollStatus(opts.status);
  const apiProg = typeof opts.progress === "number" ? opts.progress : undefined;
  if (!mapped && apiProg == null && opts.reason == null) return requests;
  const pageKeys = new Set(titlePresenceKeys(opts.titleId, opts.extraIds || []));
  return requests.map((x) => {
    if (x.status === "failed") return x;
    if (!titlePresenceKeys(x.titleId).some((k) => pageKeys.has(k))) return x;
    if (opts.season != null) {
      if (x.season !== opts.season) return x;
    } else if (x.season != null) {
      return x;
    }
    if (x.status === "available" && mapped !== "available") return x;
    const status = mapped || x.status;
    const progress =
      status === "available"
        ? 100
        : typeof apiProg === "number"
          ? Math.max(0, Math.min(100, Math.round(apiProg)))
          : x.progress;
    return {
      ...x,
      status,
      progress,
      reason: opts.reason !== undefined ? opts.reason : x.reason,
      updatedAt: Date.now(),
    };
  });
}

/** Movies on the JF shelf are AVAILABLE even if Seerr still says grabbing. TV stays season-by-season. */
export function overlayLibraryPresence(
  requests: MediaRequest[],
  opts: { libraryIds?: string[]; titles?: Pick<Title, "id" | "ids" | "kind" | "jellyfinId" | "onDiskSeasons">[] },
): MediaRequest[] {
  const movieKeys = new Set<string>();
  const tvDisk = new Map<string, Set<number>>();
  for (const id of opts.libraryIds || []) {
    if (id.startsWith("tmdb-tv-") || id.startsWith("tvdb-") || id.startsWith("jf-")) continue;
    for (const k of titlePresenceKeys(id)) movieKeys.add(k);
  }
  for (const t of opts.titles || []) {
    if (t.kind === "tv" || t.kind === "anime") {
      const disk = (t.onDiskSeasons || []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
      if (!disk.length) continue;
      for (const k of titlePresenceKeys(t.id, t.ids || [])) {
        const set = tvDisk.get(k) || new Set<number>();
        disk.forEach((n) => set.add(n));
        tvDisk.set(k, set);
      }
      continue;
    }
    // Discover/lookup memory is not the JF shelf — National Treasure must stay in-flight.
    if (!t.jellyfinId) continue;
    for (const k of titlePresenceKeys(t.id, t.ids || [])) {
      if (k.startsWith("jf-")) continue;
      movieKeys.add(k);
    }
  }
  const overlaid = requests.map((row) => {
    if (row.status === "available" || row.engine === "downloaded") {
      return row.status === "available" ? row : markAvailable(row);
    }
    if (isMovieRequest(row)) {
      if (titlePresenceKeys(row.titleId).some((k) => movieKeys.has(k))) return markAvailable(row);
      return row;
    }
    if (row.season == null) return row;
    const onDisk = titlePresenceKeys(row.titleId).some((k) => tvDisk.get(k)?.has(Number(row.season)));
    return onDisk ? markAvailable(row) : row;
  });
  return collapseDuplicateRequests(overlaid);
}
