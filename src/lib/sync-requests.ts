import type { Kind, MediaRequest, RequestStatus, Title } from "./types.ts";

const IN_FLIGHT = new Set<RequestStatus>(["downloading", "waiting"]);

/** Searching / grabbing / linked waiting for import. Available, failed, and engine-downloaded are not. */
export function isInFlightRequest(r: { status: string; engine?: string }): boolean {
  if (r.engine === "downloaded") return false;
  return IN_FLIGHT.has(r.status as RequestStatus);
}

/** Home "Your requests", Requests page, and transferring chip: overlay library hits, then keep in-flight only. */
export function inFlightRequests(
  requests: MediaRequest[],
  opts: { libraryIds?: string[]; titles?: Pick<Title, "id" | "ids" | "kind">[] } = {},
): MediaRequest[] {
  return overlayLibraryPresence(requests, opts).filter(isInFlightRequest);
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
  if (id.startsWith("tmdb-tv-")) add(`tmdb-${id.slice(8)}`);
  if (id.startsWith("tmdb-") && !id.startsWith("tmdb-tv-")) add(`tmdb-tv-${id.slice(5)}`);
  return [...keys];
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

export function libraryDropKeys(titleId: string, extra: string[] = []): string[] {
  return titlePresenceKeys(titleId, extra);
}

export function titleMatchesRemoved(
  title: { id?: string; titleId?: string; ids?: string[]; jellyfinId?: string },
  removedIds: string[] | undefined,
): boolean {
  if (!removedIds?.length) return false;
  const set = new Set(removedIds);
  const keys = new Set(titlePresenceKeys(String(title.id || title.titleId || ""), title.ids || []));
  if (title.titleId) for (const k of titlePresenceKeys(title.titleId)) keys.add(k);
  if (title.jellyfinId) {
    keys.add(String(title.jellyfinId));
    keys.add(`jf-${title.jellyfinId}`);
  }
  return [...keys].some((k) => set.has(k));
}

export function applyRemovedTitles<T extends { id?: string; ids?: string[]; jellyfinId?: string }>(
  titles: T[],
  removedIds: string[] | undefined,
): T[] {
  if (!removedIds?.length) return titles;
  return titles.filter((t) => !titleMatchesRemoved(t, removedIds));
}

export function forgetRemovedLibraryIds(prev: string[] | undefined, dropKeys: string[]): string[] {
  const keys = new Set(dropKeys || []);
  return (prev || []).filter((id) => !keys.has(id));
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
  for (const t of state.shelf || []) {
    if (!titleInDropSet(t, keys)) continue;
    for (const k of titlePresenceKeys(t.id, t.ids || [])) keys.add(k);
    if (t.jellyfinId) {
      keys.add(String(t.jellyfinId));
      keys.add(`jf-${t.jellyfinId}`);
    }
  }
  const gone = (id: string) => keys.has(id) || titlePresenceKeys(id).some((k) => keys.has(k));
  return {
    shelf: (state.shelf || []).filter((t) => !titleInDropSet(t, keys)),
    library: (state.library || []).filter((id) => !gone(String(id))),
    requests: (state.requests || []).filter((r) => !r?.titleId || !gone(r.titleId)),
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
  opts: { titleId: string; season?: number; status?: string | null; progress?: number; reason?: string },
): MediaRequest[] {
  const mapped = mapEnginePollStatus(opts.status);
  const apiProg = typeof opts.progress === "number" ? opts.progress : undefined;
  if (!mapped && apiProg == null && opts.reason == null) return requests;
  return requests.map((x) => {
    if (x.titleId !== opts.titleId || x.status === "failed") return x;
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
  opts: { libraryIds?: string[]; titles?: Pick<Title, "id" | "ids" | "kind">[] },
): MediaRequest[] {
  const movieKeys = new Set<string>();
  for (const id of opts.libraryIds || []) {
    if (id.startsWith("tmdb-tv-") || id.startsWith("tvdb-") || id.startsWith("jf-")) continue;
    for (const k of titlePresenceKeys(id)) movieKeys.add(k);
  }
  for (const t of opts.titles || []) {
    if (t.kind === "tv" || t.kind === "anime") continue;
    for (const k of titlePresenceKeys(t.id, t.ids || [])) {
      if (k.startsWith("jf-")) continue;
      movieKeys.add(k);
    }
  }
  const overlaid = requests.map((row) => {
    if (row.status === "available" || row.engine === "downloaded") {
      return row.status === "available" ? row : markAvailable(row);
    }
    if (!isMovieRequest(row)) return row;
    if (titlePresenceKeys(row.titleId).some((k) => movieKeys.has(k))) return markAvailable(row);
    return row;
  });
  return collapseDuplicateRequests(overlaid);
}
