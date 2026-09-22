/**
 * ReelOS Guest Request Ephemeral Cleanup Engine
 * Cleans up guest requests older than maxAgeHours (default 24h)
 * unless pinned or favored by a permanent household resident.
 */

export function sweepGuestRequests({
  requests = [],
  watchlistTitleIds = new Set(),
  maxAgeHours = 24,
  now = Date.now(),
}) {
  const maxAgeMs = maxAgeHours * 3600 * 1000;
  const toRemove = [];
  const kept = [];

  for (const req of requests) {
    const isGuest = Boolean(
      req.isGuest ||
      (req.requester && req.requester.toLowerCase().includes("guest"))
    );

    if (!isGuest) {
      kept.push(req);
      continue;
    }

    const age = now - (req.createdAt || now);
    const titleId = String(req.titleId || "");
    const isPinned = watchlistTitleIds.has(titleId);

    if (age >= maxAgeMs && !isPinned) {
      toRemove.push(req);
    } else {
      kept.push(req);
    }
  }

  return {
    toRemove,
    kept,
    countRemoved: toRemove.length,
    countKept: kept.length,
  };
}
