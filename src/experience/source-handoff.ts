export type SourceLinkReview = {
  kind: "source-link" | "unsupported";
  safeToReview: boolean;
  display: string;
  message: string;
};

function redactUrl(url: URL) {
  const path = url.pathname === "/" ? "" : url.pathname;
  return `${url.hostname}${path}`.slice(0, 160);
}

/**
 * Performs only local shape validation. It never fetches, stores, or activates
 * a submitted URL; that must happen later inside an owner-authorized flow.
 */
export function inspectSourceLink(value: string): SourceLinkReview | null {
  const raw = value.trim();
  if (!/^https?:\/\//i.test(raw)) return null;
  try {
    const url = new URL(raw);
    const looksLikeSource = /(?:torznab|newznab|indexer|feed|rss|api|source)/i.test(
      `${url.hostname}${url.pathname}`,
    );
    if (!looksLikeSource) return null;
    const privateMaterial = Boolean(url.username || url.password || url.search);
    const secure = url.protocol === "https:";
    return {
      kind: secure && !privateMaterial ? "source-link" : "unsupported",
      safeToReview: secure && !privateMaterial,
      display: redactUrl(url),
      message: !secure
        ? "For your privacy, source setup only reviews HTTPS links."
        : privateMaterial
          ? "This link appears to include private details. Remove keys, passwords, and query text before reviewing it here."
          : "ReelOS can guide the appliance owner to review this source privately. It will not contact or save it from search.",
    };
  } catch {
    return null;
  }
}
