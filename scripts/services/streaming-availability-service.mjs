const TMDB_API_ROOT = "https://api.themoviedb.org/3";
const TMDB_IMAGE_ROOT = "https://image.tmdb.org/t/p/w92";
const DEFAULT_TIMEOUT_MS = 4_000;
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1_000;
const EMPTY_TTL_MS = 30 * 60 * 1_000;
const ERROR_TTL_MS = 60 * 1_000;

const GROUP_MAP = Object.freeze({
  subscription: "flatrate",
  free: "free",
  ads: "ads",
  rent: "rent",
  buy: "buy",
});

const ATTRIBUTION = Object.freeze({
  provider: "JustWatch",
  text: "Availability data by JustWatch.",
  url: "https://www.justwatch.com/",
});

function send(res, status, body, cacheControl = "private, no-store") {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cacheControl,
  });
  res.end(JSON.stringify(body));
  return true;
}

function unavailable({ mediaType, externalId, region, reason, fetchedAt }) {
  return {
    ok: true,
    available: false,
    mediaType,
    externalId,
    region,
    groups: { subscription: [], free: [], ads: [], rent: [], buy: [] },
    link: null,
    attribution: ATTRIBUTION,
    fetchedAt,
    reason,
  };
}

function normalizeProvider(provider) {
  const id = Number(provider?.provider_id);
  const name = String(provider?.provider_name || "").trim();
  if (!Number.isSafeInteger(id) || id <= 0 || !name) return null;
  const logoPath = typeof provider.logo_path === "string" && /^\/[A-Za-z0-9._/-]+$/.test(provider.logo_path)
    ? provider.logo_path
    : null;
  return {
    id,
    name,
    logoUrl: logoPath ? `${TMDB_IMAGE_ROOT}${logoPath}` : null,
    displayPriority: Number.isFinite(Number(provider.display_priority))
      ? Number(provider.display_priority)
      : 10_000,
  };
}

function normalizeGroup(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .map(normalizeProvider)
    .filter((provider) => {
      if (!provider || seen.has(provider.id)) return false;
      seen.add(provider.id);
      return true;
    })
    .sort((left, right) => left.displayPriority - right.displayPriority || left.name.localeCompare(right.name));
}

function officialTmdbLink(value) {
  try {
    const parsed = new URL(String(value || ""));
    if (parsed.protocol !== "https:") return null;
    if (parsed.hostname !== "www.themoviedb.org" && parsed.hostname !== "themoviedb.org") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function normalizeAvailabilityPayload(payload, { mediaType, externalId, region, fetchedAt = new Date().toISOString() }) {
  const regional = payload?.results?.[region];
  if (!regional || typeof regional !== "object") {
    return unavailable({ mediaType, externalId, region, reason: "no_regional_availability", fetchedAt });
  }
  const groups = Object.fromEntries(
    Object.entries(GROUP_MAP).map(([publicName, upstreamName]) => [publicName, normalizeGroup(regional[upstreamName])]),
  );
  const link = officialTmdbLink(regional.link);
  const available = Object.values(groups).some((providers) => providers.length > 0);
  return {
    ok: true,
    available,
    mediaType,
    externalId,
    region,
    groups,
    link,
    attribution: ATTRIBUTION,
    fetchedAt,
    ...(!available ? { reason: "no_regional_availability" } : {}),
  };
}

export class StreamingAvailabilityService {
  constructor({
    apiKey = process.env.TMDB_API_KEY,
    fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    ttlMs = DEFAULT_TTL_MS,
    now = () => Date.now(),
  } = {}) {
    this.apiKey = String(apiKey || "").trim();
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.ttlMs = ttlMs;
    this.now = now;
    this.cache = new Map();
  }

  async get({ mediaType, externalId, region }) {
    const fetchedAt = new Date(this.now()).toISOString();
    if (!this.apiKey) return unavailable({ mediaType, externalId, region, reason: "not_configured", fetchedAt });
    const cacheKey = `${mediaType}:${externalId}:${region}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > this.now()) return cached.value;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const url = new URL(`${TMDB_API_ROOT}/${mediaType}/${externalId}/watch/providers`);
      url.searchParams.set("api_key", this.apiKey);
      const response = await this.fetchImpl(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (response.status === 404) {
        const result = unavailable({ mediaType, externalId, region, reason: "unsupported_title", fetchedAt });
        this.cache.set(cacheKey, { value: result, expiresAt: this.now() + EMPTY_TTL_MS });
        return result;
      }
      if (!response.ok) throw new Error(`TMDB availability returned ${response.status}`);
      const result = normalizeAvailabilityPayload(await response.json(), { mediaType, externalId, region, fetchedAt });
      this.cache.set(cacheKey, { value: result, expiresAt: this.now() + (result.available ? this.ttlMs : EMPTY_TTL_MS) });
      return result;
    } catch (error) {
      const result = unavailable({
        mediaType,
        externalId,
        region,
        reason: error?.name === "AbortError" ? "upstream_timeout" : "upstream_unavailable",
        fetchedAt,
      });
      this.cache.set(cacheKey, { value: result, expiresAt: this.now() + ERROR_TTL_MS });
      return result;
    } finally {
      clearTimeout(timer);
    }
  }
}

let sharedService;

function requestValues(url) {
  const mediaType = String(url.searchParams.get("mediaType") || "").trim().toLowerCase();
  const externalId = String(url.searchParams.get("externalId") || "").trim();
  const region = String(url.searchParams.get("region") || process.env.REELOS_REGION || "US").trim().toUpperCase();
  return { mediaType, externalId, region };
}

export async function handleStreamingAvailabilityRoute(req, res, options = {}) {
  const url = options.url || new URL(req.url || "/", "http://reelos.local");
  if (url.pathname !== "/api/availability") return false;
  if ((req.method || "GET").toUpperCase() !== "GET") {
    return send(res, 405, { ok: false, code: "METHOD_NOT_ALLOWED", error: "Availability can only be read." });
  }

  const values = requestValues(url);
  if (!['movie', 'tv'].includes(values.mediaType)) {
    return send(res, 400, { ok: false, code: "INVALID_MEDIA_TYPE", error: "mediaType must be movie or tv." });
  }
  if (!/^\d{1,10}$/.test(values.externalId) || Number(values.externalId) <= 0) {
    return send(res, 400, { ok: false, code: "INVALID_EXTERNAL_ID", error: "externalId must be a TMDB numeric identifier." });
  }
  if (!/^[A-Z]{2}$/.test(values.region)) {
    return send(res, 400, { ok: false, code: "INVALID_REGION", error: "region must be a two-letter country code." });
  }

  const service = options.service || (sharedService ||= new StreamingAvailabilityService());
  const result = await service.get(values);
  return send(res, 200, result, "private, max-age=300");
}
