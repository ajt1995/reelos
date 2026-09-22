export type DebridProviderId = "torbox" | "real-debrid";

export type DebridConnectionStatus =
  | "disabled"
  | "needs-key"
  | "validating"
  | "connected"
  | "failed";

export interface DebridConnection {
  enabled: boolean;
  provider: DebridProviderId;
  status: DebridConnectionStatus;
}

export type ExperienceSourceKind =
  | "public_domain"
  | "public_catalog"
  | "personal_import"
  | "retained_local"
  | "debrid";

export interface ExperienceMediaSource {
  kind: ExperienceSourceKind;
  provider?: DebridProviderId;
  uri?: string;
  verified: boolean;
}

const PUBLIC_DOMAIN_SOURCES: Record<string, ExperienceMediaSource> = {
  "night-of-the-living-dead-1968": {
    kind: "public_domain",
    uri: "https://archive.org/download/night_of_the_living_dead_dvd/Night.mp4",
    verified: true,
  },
  "charade-1963": {
    kind: "public_domain",
    uri: "https://archive.org/download/Charade1963/Charade1963.mp4",
    verified: true,
  },
  "his-girl-friday-1940": {
    kind: "public_domain",
    uri: "https://archive.org/download/HisGirlFriday1940/HisGirlFriday1940.mp4",
    verified: true,
  },
  "a-star-is-born-1937": {
    kind: "public_domain",
    uri: "https://archive.org/download/AStarIsBorn1937/AStarIsBorn1937.mp4",
    verified: true,
  },
};

export const DEFAULT_DEBRID_CONNECTION: DebridConnection = {
  enabled: false,
  provider: "torbox",
  status: "disabled",
};

// The browser selects a known title, never supplies an upstream media URL.
// The server rechecks device, profile, family and source access on every request.
export function publicPlaybackPath(titleId: string): string | null {
  return Object.hasOwn(PUBLIC_DOMAIN_SOURCES, titleId)
    ? `/api/stream/public/${encodeURIComponent(titleId)}`
    : null;
}

export function sourcesForExperienceTitle(
  titleId: string,
): ExperienceMediaSource[] {
  const publicSource = PUBLIC_DOMAIN_SOURCES[titleId];
  if (publicSource) return [publicSource];
  return [
    {
      kind: "debrid",
      verified: false,
    },
  ];
}

export function sourceForLookupTitle(raw: Record<string, unknown>): ExperienceMediaSource | null {
  const kind = String(raw.sourceKind || "");
  if (kind !== "public_domain" && kind !== "public_catalog") return null;
  return {
    kind,
    uri: String(raw.sourceUri || raw.catalogUrl || "") || undefined,
    verified: raw.sourceVerified === true,
  };
}

export function isDebridConnected(connection: DebridConnection): boolean {
  return connection.enabled && connection.status === "connected";
}

export function sourceIsAccessible(
  source: ExperienceMediaSource,
  connection: DebridConnection,
): boolean {
  if (!source.verified) return false;
  if (source.kind === "debrid") {
    return (
      isDebridConnected(connection) &&
      (!source.provider || source.provider === connection.provider)
    );
  }
  if (source.kind === "public_catalog") return false;
  return true;
}

export function titleIsAccessible(
  titleId: string,
  connection: DebridConnection,
): boolean {
  return sourcesForExperienceTitle(titleId).some((source) =>
    sourceIsAccessible(source, connection),
  );
}

export function titleCanUseProvider(
  titleId: string,
  connection: DebridConnection,
): boolean {
  return (
    isDebridConnected(connection) &&
    connection.provider === "torbox" &&
    sourcesForExperienceTitle(titleId).some(
      (source) =>
        source.kind === "debrid" &&
        (!source.provider || source.provider === connection.provider),
    )
  );
}

export function accessibleTitleIds(
  titleIds: string[],
  connection: DebridConnection,
): string[] {
  return titleIds.filter((titleId) => titleIsAccessible(titleId, connection));
}

export function providerDisabledConnection(
  connection: DebridConnection,
): DebridConnection {
  return { ...connection, enabled: false, status: "disabled" };
}
