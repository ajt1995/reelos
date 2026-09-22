/**
 * Always-on, lawful public catalogs.
 *
 * These are deliberately separate from owner-supplied release indexers. A
 * catalog result is discovery evidence, not permission to download it. Direct
 * playback is exposed only when the item record provides a media URL and
 * explicit item-level rights language.
 */

export const PUBLIC_CATALOGS = Object.freeze([
  {
    id: "reelos-public-cinema",
    name: "Verified public-domain cinema",
    media: ["movie"],
    access: "playable",
    enabled: true,
    provider: "ReelOS",
  },
  {
    id: "loc-national-screening-room",
    name: "Library of Congress",
    media: ["movie"],
    access: "rights-checked-per-item",
    enabled: true,
    provider: "Library of Congress",
  },
  {
    id: "project-gutenberg",
    name: "Project Gutenberg",
    media: ["book"],
    access: "open-download",
    enabled: true,
    provider: "Project Gutenberg",
  },
  {
    id: "standard-ebooks",
    name: "Standard Ebooks",
    media: ["book"],
    access: "open-download",
    enabled: true,
    provider: "Standard Ebooks",
  },
  {
    id: "internet-archive-open-books",
    name: "Internet Archive open books",
    media: ["book"],
    access: "open-download",
    enabled: true,
    provider: "Internet Archive",
  },
]);

const LOC_COLLECTION =
  "https://www.loc.gov/collections/national-screening-room/";
const CACHE_MS = 10 * 60 * 1000;
const resultCache = new Map();

function firstString(value) {
  if (Array.isArray(value))
    return value.find((item) => typeof item === "string") || "";
  return typeof value === "string" ? value : "";
}

function allText(value) {
  if (Array.isArray(value)) return value.map(allText).filter(Boolean).join(" ");
  if (value && typeof value === "object")
    return Object.values(value).map(allText).filter(Boolean).join(" ");
  return typeof value === "string" ? value : "";
}

function locSlug(value) {
  const match = String(value || "").match(/\/item\/([^/?#]+)/i);
  return match?.[1] || "";
}

function yearFrom(value) {
  const match = allText(value).match(/\b(18|19|20)\d{2}\b/);
  return match ? Number(match[0]) : 0;
}

function bestImage(item) {
  const images = [item?.image_url, item?.image, item?.resources]
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .flatMap((value) => {
      if (typeof value === "string") return [value];
      if (!value || typeof value !== "object") return [];
      return [
        value.image,
        value.url,
        ...(Array.isArray(value.files)
          ? value.files.map((file) => file?.url)
          : []),
      ];
    })
    .filter((value) => typeof value === "string" && /^https:\/\//i.test(value));
  return (
    images.find((url) => /\.(jpe?g|png|webp)(\?|$)/i.test(url)) ||
    images[0] ||
    ""
  );
}

function directVideo(item) {
  const candidates = [item?.resources, item?.files]
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .flatMap((value) => {
      if (typeof value === "string") return [value];
      if (!value || typeof value !== "object") return [];
      return [
        value.url,
        value.download,
        ...(Array.isArray(value.files)
          ? value.files.map((file) => file?.url)
          : []),
      ];
    })
    .filter((value) => typeof value === "string" && /^https:\/\//i.test(value));
  return candidates.find((url) => /\.(mp4|m3u8|mov)(\?|$)/i.test(url)) || "";
}

export function mapLocCinemaItem(item = {}) {
  const detailUrl = String(item.id || item.url || "").replace(
    /^http:/,
    "https:",
  );
  const slug = locSlug(detailUrl);
  const title = firstString(item.title) || firstString(item.name);
  if (!slug || !title) return null;
  const rights = allText([
    item.rights_information,
    item.rights_advisory,
    item.rights,
    item.restrictions,
  ]).trim();
  const explicitOpenRights =
    /public domain|no known (copyright or other )?restrictions|free to use and reuse/i.test(
      rights,
    );
  const videoUrl = explicitOpenRights ? directVideo(item) : "";
  const description =
    firstString(item.description) ||
    firstString(item.notes) ||
    "A moving-image item from the Library of Congress National Screening Room.";
  return {
    id: `loc-${slug}`,
    kind: "movie",
    title,
    year: yearFrom(
      item.date || item.created_published || item.created_published_date,
    ),
    overview: description,
    poster: bestImage(item),
    banner: bestImage(item),
    genres: ["Public collection"],
    runtime: 0,
    sourceKind: videoUrl ? "public_domain" : "public_catalog",
    sourceVerified: true,
    sourceUri: videoUrl || detailUrl,
    catalogUrl: detailUrl,
    rights:
      rights || "Check the item record for rights and access information.",
    playable: Boolean(videoUrl),
  };
}

async function readJson(url, fetchImpl, signal) {
  const response = await fetchImpl(url, {
    signal,
    headers: {
      accept: "application/json",
      "user-agent": "ReelOS/2.5 public-catalog discovery",
    },
  });
  if (!response.ok) throw new Error(`Library of Congress ${response.status}`);
  return response.json();
}

export async function searchPublicCinema(query, options = {}) {
  const q = String(query || "")
    .trim()
    .slice(0, 160);
  if (q.length < 2) return [];
  const now = Date.now();
  const cached = resultCache.get(q.toLowerCase());
  if (cached && now - cached.at < CACHE_MS) return cached.value;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const signal = options.signal || AbortSignal.timeout(8000);
  const params = new URLSearchParams({
    fo: "json",
    at: "results",
    c: String(Math.min(12, Math.max(1, Number(options.limit) || 8))),
    q,
  });
  const data = await readJson(`${LOC_COLLECTION}?${params}`, fetchImpl, signal);
  const value = (Array.isArray(data?.results) ? data.results : [])
    .map(mapLocCinemaItem)
    .filter(Boolean);
  resultCache.set(q.toLowerCase(), { at: now, value });
  return value;
}

export async function lookupPublicCinema(id, options = {}) {
  const slug = String(id || "")
    .replace(/^loc-/, "")
    .replace(/[^A-Za-z0-9._-]/g, "");
  if (!slug) return null;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const signal = options.signal || AbortSignal.timeout(8000);
  const data = await readJson(
    `https://www.loc.gov/item/${encodeURIComponent(slug)}/?fo=json`,
    fetchImpl,
    signal,
  );
  return mapLocCinemaItem({
    ...(data?.item || {}),
    resources: data?.resources,
    id: `https://www.loc.gov/item/${slug}/`,
  });
}
