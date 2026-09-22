export type StreamingProvider = {
  id: number;
  name: string;
  logoUrl: string | null;
  displayPriority: number;
};

export type StreamingAvailabilityReason =
  | "not_configured"
  | "no_regional_availability"
  | "unsupported_title"
  | "upstream_timeout"
  | "upstream_unavailable"
  | "request_failed";

export type StreamingAvailability = {
  ok: true;
  available: boolean;
  mediaType: "movie" | "tv";
  externalId: string;
  region: string;
  groups: {
    subscription: StreamingProvider[];
    free: StreamingProvider[];
    ads: StreamingProvider[];
    rent: StreamingProvider[];
    buy: StreamingProvider[];
  };
  link: string | null;
  attribution: {
    provider: "JustWatch";
    text: string;
    url: string;
  };
  fetchedAt: string;
  reason?: StreamingAvailabilityReason;
};

function emptyAvailability(
  mediaType: "movie" | "tv",
  externalId: string,
  region: string,
  reason: StreamingAvailabilityReason,
): StreamingAvailability {
  return {
    ok: true,
    available: false,
    mediaType,
    externalId,
    region,
    groups: { subscription: [], free: [], ads: [], rent: [], buy: [] },
    link: null,
    attribution: {
      provider: "JustWatch",
      text: "Availability data by JustWatch.",
      url: "https://www.justwatch.com/",
    },
    fetchedAt: new Date().toISOString(),
    reason,
  };
}

export async function loadStreamingAvailability(
  input: { mediaType: "movie" | "tv"; externalId: string | number; region?: string },
  signal?: AbortSignal,
): Promise<StreamingAvailability> {
  const externalId = String(input.externalId).trim();
  const region = String(input.region || "US").trim().toUpperCase();
  const query = new URLSearchParams({ mediaType: input.mediaType, externalId, region });
  try {
    const response = await fetch(`/api/availability?${query}`, { cache: "no-store", signal });
    if (!response.ok) throw new Error(`Availability returned ${response.status}`);
    return (await response.json()) as StreamingAvailability;
  } catch (error) {
    if (signal?.aborted) throw error;
    return emptyAvailability(input.mediaType, externalId, region, "request_failed");
  }
}
