import type { Kind, MediaRequest, RequestStatus } from "./types.ts";

const IN_FLIGHT = new Set<RequestStatus>(["downloading", "waiting"]);

export function isInFlightRequest(r: { status: string }): boolean {
  return IN_FLIGHT.has(r.status as RequestStatus);
}

/** Honest queue words. Never a percent — Seerr/*arr do not give a real grab %. */
export function requestStatusWord(status: string): "Grabbing" | "Waiting" | "Ready" | "Failed" {
  if (status === "downloading") return "Grabbing";
  if (status === "waiting") return "Waiting";
  if (status === "available") return "Ready";
  return "Failed";
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
    out.push({
      ...row,
      progress: row.status === "available" ? 100 : (row.progress ?? 0),
    });
  }

  return out;
}
