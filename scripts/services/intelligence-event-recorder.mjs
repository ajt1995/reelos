/**
 * Best-effort boundary between authoritative product state and the derived
 * local-intelligence ledger. Product writes happen first. A ledger outage is
 * observable to the caller, but can never turn a completed product write into
 * a fabricated failure or success.
 */
export async function recordIntelligenceEvent(store, event, { onError } = {}) {
  if (!store?.appendEvent) return { recorded: false, reason: "store_unavailable" };
  try {
    const result = await store.appendEvent(event);
    return { recorded: true, result };
  } catch (error) {
    onError?.(error, event);
    return { recorded: false, reason: error?.code || "event_write_failed" };
  }
}

export async function deleteIntelligenceProfile(store, profileId, { onError } = {}) {
  if (!store?.deleteProfile) return { deleted: false, reason: "store_unavailable" };
  try {
    const result = await store.deleteProfile(profileId, { reason: "profile_deleted_by_owner" });
    return { deleted: true, result };
  } catch (error) {
    onError?.(error, { type: "profile.deleted", profileId });
    return { deleted: false, reason: error?.code || "profile_delete_failed" };
  }
}

export function scheduleIntelligenceWork(work, { onError } = {}) {
  Promise.resolve(work).catch((error) => onError?.(error));
}
