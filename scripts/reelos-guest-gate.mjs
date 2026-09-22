import { existsSync, readFileSync, writeFileSync } from "node:fs";

const PENDING_FILE = "/var/lib/reelos/pending-guest-requests.json";

export function loadPendingGuestRequests(filePath = PENDING_FILE) {
  if (!existsSync(filePath)) return [];
  try {
    const raw = readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function savePendingGuestRequests(list, filePath = PENDING_FILE) {
  try {
    writeFileSync(filePath, JSON.stringify(list, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}

export function addPendingGuestRequest(reqPayload, filePath = PENDING_FILE) {
  const current = loadPendingGuestRequests(filePath);
  const id = `guest-req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const item = {
    id,
    titleId: reqPayload.titleId,
    title: reqPayload.title || reqPayload.titleId,
    year: reqPayload.year,
    poster: reqPayload.poster,
    mediaType: reqPayload.mediaType,
    tmdb: reqPayload.tmdb,
    season: reqPayload.season,
    requestedBy: reqPayload.requester || "Guest",
    requestedAt: Date.now(),
  };
  current.unshift(item);
  savePendingGuestRequests(current, filePath);
  return item;
}

export function removePendingGuestRequest(id, filePath = PENDING_FILE) {
  const current = loadPendingGuestRequests(filePath);
  const filtered = current.filter((r) => r.id !== id);
  savePendingGuestRequests(filtered, filePath);
  return current.find((r) => r.id === id) || null;
}
