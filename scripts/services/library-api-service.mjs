import { resolveVerifiedLocalOriginal } from "./media-retention-service.mjs";

const privateSourceFields = ["sourceKind", "sourceVerified", "source", "path", "Path", "file", "fileVersion", "pins", "retentionReceipt", "preparationReceipt"];

/**
 * Request-scoped annotation after library access filtering. Catalog/cache claims
 * cannot establish original ownership: resolve and authorize the actual bytes.
 */
export function annotateVerifiedLibraryOriginals(req, titles, options = {}) {
  if (!Array.isArray(titles)) return [];
  return titles.map((title) => {
    if (!title || typeof title !== "object" || Array.isArray(title)) return title;
    const publicTitle = { ...title };
    for (const field of privateSourceFields) delete publicTitle[field];
    if (typeof title.id !== "string" || !title.id.trim()) return publicTitle;
    try {
      const original = resolveVerifiedLocalOriginal(req, title.id, options);
      if (original.sourceKind === "personal_import" || original.sourceKind === "public_domain") {
        publicTitle.sourceKind = original.sourceKind;
        publicTitle.sourceVerified = true;
      }
    } catch {
      // Missing, denied, projected, ambiguous, or changed originals stay ordinary
      // shelf entries. No path, receipt, or unverified original claim is returned.
    }
    return publicTitle;
  });
}
