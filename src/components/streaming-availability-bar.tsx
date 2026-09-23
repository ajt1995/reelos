import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Film, ShoppingBag, Tag, Tv } from "lucide-react";
import {
  loadStreamingAvailability,
  type StreamingAvailability,
  type StreamingProvider,
} from "@/experience/streaming-availability";
import { cn } from "@/lib/utils";

export interface StreamingBarProps {
  titleId: string;
  titleName: string;
  kind?: "movie" | "tv" | "anime" | "series" | string;
  year?: number | string;
  extraIds?: string[];
  className?: string;
}

interface ProviderMeta {
  name: string;
  slug: string;
  brandColor: string;
  textColor: string;
  androidTvPackage?: string;
  androidMobilePackage?: string;
  getWebUrl: (title: string, externalId?: string) => string;
}

const CANONICAL_PROVIDERS: Record<number, ProviderMeta> = {
  // Netflix
  8: {
    name: "Netflix",
    slug: "netflix",
    brandColor: "#E50914",
    textColor: "#FFFFFF",
    androidTvPackage: "com.netflix.ninja",
    androidMobilePackage: "com.netflix.mediaclient",
    getWebUrl: (title) => `https://www.netflix.com/search?q=${encodeURIComponent(title)}`,
  },
  1796: {
    name: "Netflix (Ads)",
    slug: "netflix",
    brandColor: "#E50914",
    textColor: "#FFFFFF",
    androidTvPackage: "com.netflix.ninja",
    androidMobilePackage: "com.netflix.mediaclient",
    getWebUrl: (title) => `https://www.netflix.com/search?q=${encodeURIComponent(title)}`,
  },
  // Max / HBO Max
  1899: {
    name: "Max",
    slug: "max",
    brandColor: "#002BE7",
    textColor: "#FFFFFF",
    androidTvPackage: "com.wbd.stream",
    androidMobilePackage: "com.wbd.stream",
    getWebUrl: (title) => `https://play.max.com/search?q=${encodeURIComponent(title)}`,
  },
  384: {
    name: "HBO Max",
    slug: "max",
    brandColor: "#002BE7",
    textColor: "#FFFFFF",
    androidTvPackage: "com.wbd.stream",
    androidMobilePackage: "com.wbd.stream",
    getWebUrl: (title) => `https://play.max.com/search?q=${encodeURIComponent(title)}`,
  },
  // Amazon Prime Video
  9: {
    name: "Prime Video",
    slug: "prime",
    brandColor: "#00A8E1",
    textColor: "#FFFFFF",
    androidTvPackage: "com.amazon.amazonvideo.livingroom",
    androidMobilePackage: "com.amazon.avod.thirdpartyclient",
    getWebUrl: (title) => `https://www.amazon.com/gp/video/search?phrase=${encodeURIComponent(title)}`,
  },
  119: {
    name: "Prime Video",
    slug: "prime",
    brandColor: "#00A8E1",
    textColor: "#FFFFFF",
    androidTvPackage: "com.amazon.amazonvideo.livingroom",
    androidMobilePackage: "com.amazon.avod.thirdpartyclient",
    getWebUrl: (title) => `https://www.amazon.com/gp/video/search?phrase=${encodeURIComponent(title)}`,
  },
  // Disney+
  337: {
    name: "Disney+",
    slug: "disney",
    brandColor: "#113CCF",
    textColor: "#FFFFFF",
    androidTvPackage: "com.disney.disneyplus",
    androidMobilePackage: "com.disney.disneyplus",
    getWebUrl: (title) => `https://www.disneyplus.com/search?q=${encodeURIComponent(title)}`,
  },
  // Apple TV+
  350: {
    name: "Apple TV+",
    slug: "apple-tv",
    brandColor: "#1A1A1A",
    textColor: "#FFFFFF",
    androidTvPackage: "com.apple.atve.androidtv.appletv",
    getWebUrl: (title) => `https://tv.apple.com/us/search?term=${encodeURIComponent(title)}`,
  },
  2: {
    name: "Apple TV",
    slug: "apple-tv",
    brandColor: "#1A1A1A",
    textColor: "#FFFFFF",
    androidTvPackage: "com.apple.atve.androidtv.appletv",
    getWebUrl: (title) => `https://tv.apple.com/us/search?term=${encodeURIComponent(title)}`,
  },
  // Tubi
  73: {
    name: "Tubi",
    slug: "tubi",
    brandColor: "#FA3200",
    textColor: "#FFFFFF",
    androidTvPackage: "com.tubitv",
    androidMobilePackage: "com.tubitv",
    getWebUrl: (title) => `https://tubitv.com/search/${encodeURIComponent(title)}`,
  },
  // Pluto TV
  300: {
    name: "Pluto TV",
    slug: "pluto",
    brandColor: "#FFE600",
    textColor: "#000000",
    androidTvPackage: "tv.pluto.android",
    androidMobilePackage: "tv.pluto.android",
    getWebUrl: (title) => `https://pluto.tv/search?query=${encodeURIComponent(title)}`,
  },
};

function resolveTmdbIdentity(
  titleId: string,
  kind?: string,
  extraIds: string[] = []
): { mediaType: "movie" | "tv"; externalId: string } | null {
  const candidates = [titleId, ...extraIds];
  for (const c of candidates) {
    const s = String(c || "").trim();
    const tvMatch = /^tmdb-tv-(\d+)$/.exec(s);
    if (tvMatch) return { mediaType: "tv", externalId: tvMatch[1] };
    const movieMatch = /^tmdb-(?:movie-)?(\d+)$/.exec(s);
    if (movieMatch) {
      const isSeries = kind === "tv" || kind === "anime" || kind === "series";
      return { mediaType: isSeries ? "tv" : "movie", externalId: movieMatch[1] };
    }
  }
  return null;
}

function getNativePlatform(): "android-tv" | "android" | "web" {
  if (typeof window === "undefined") return "web";
  try {
    const native = (window as unknown as { ReelOSNative?: { platform(): string } }).ReelOSNative;
    const p = native?.platform();
    if (p === "android-tv") return "android-tv";
    if (p === "android") return "android";
    return "web";
  } catch {
    return "web";
  }
}

function generateDeepLink(
  provider: StreamingProvider,
  title: string,
  platform: "android-tv" | "android" | "web"
): string {
  const meta = CANONICAL_PROVIDERS[provider.id];
  const webFallback = meta
    ? meta.getWebUrl(title)
    : `https://www.google.com/search?q=watch+${encodeURIComponent(title)}+${encodeURIComponent(provider.name)}`;

  if (platform === "web" || !meta) return webFallback;

  const pkg =
    platform === "android-tv"
      ? meta.androidTvPackage || meta.androidMobilePackage
      : meta.androidMobilePackage;
  if (!pkg) return webFallback;

  const cleanWebUrl = webFallback.replace(/^https?:\/\//, "");
  return `intent://${cleanWebUrl}#Intent;scheme=https;package=${pkg};action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(webFallback)};end`;
}

export function StreamingAvailabilityBar({
  titleId,
  titleName,
  kind,
  extraIds = [],
  className,
}: StreamingBarProps) {
  const identity = useMemo(() => resolveTmdbIdentity(titleId, kind, extraIds), [titleId, kind, extraIds]);
  const [data, setData] = useState<StreamingAvailability | null>(null);
  const [loading, setLoading] = useState(Boolean(identity));
  const platform = useMemo(getNativePlatform, []);

  useEffect(() => {
    if (!identity) {
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    void fetch("/api/settings", { cache: "no-store", signal: ac.signal })
      .then(async (response) => {
        if (!response.ok) return "US";
        const settings = (await response.json()) as { region?: string };
        return settings.region && /^[A-Z]{2}$/.test(settings.region) ? settings.region : "US";
      })
      .catch(() => "US")
      .then((region) =>
        loadStreamingAvailability(
          { mediaType: identity.mediaType, externalId: identity.externalId, region },
          ac.signal
        )
      )
      .then((res) => {
        if (!ac.signal.aborted) setData(res);
      })
      .catch(() => {
        if (!ac.signal.aborted) setData(null);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [identity?.mediaType, identity?.externalId]);

  if (!identity) return null;

  if (loading) {
    return (
      <div className={cn("flex flex-wrap items-center gap-2.5 py-2 animate-pulse", className)}>
        <div className="h-11 w-40 rounded-2xl bg-card/60 border border-border" />
        <div className="h-11 w-32 rounded-2xl bg-card/60 border border-border" />
      </div>
    );
  }

  if (!data?.available) {
    if (data?.reason === "not_configured") return null;
    return (
      <div className={cn("text-xs text-muted/60 py-1 font-serif italic tracking-wide", className)}>
        No active commercial streaming subscriptions listed in region {data?.region || "US"}.
      </div>
    );
  }

  const subscriptions = data.groups.subscription || [];
  const freeWithAds = [...(data.groups.free || []), ...(data.groups.ads || [])];
  const rentOrBuy = [...(data.groups.rent || []), ...(data.groups.buy || [])];
  const isMoviesEligible = (kind === "movie" || !kind) && rentOrBuy.length > 0;

  if (subscriptions.length === 0 && freeWithAds.length === 0 && !isMoviesEligible && rentOrBuy.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-card/40 p-3.5 shadow-sm space-y-3 backdrop-blur-sm",
        className
      )}
    >
      {/* Primary Row: Included in Subscription */}
      {subscriptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-gold/90 flex items-center gap-1.5 mr-1 font-serif">
            <Film className="size-3.5 text-gold" />
            Commercial Stream:
          </span>
          {subscriptions.map((provider) => {
            const meta = CANONICAL_PROVIDERS[provider.id];
            const deepLink = generateDeepLink(provider, titleName, platform);
            const style = meta
              ? { backgroundColor: meta.brandColor, color: meta.textColor }
              : undefined;

            return (
              <a
                key={`sub-${provider.id}`}
                href={deepLink}
                target={platform === "web" ? "_blank" : undefined}
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 text-xs font-bold transition-all shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer border border-white/10",
                  !meta && "bg-card border-border text-foreground hover:border-gold/40"
                )}
                style={style}
                title={`Watch ${titleName} on ${provider.name}`}
              >
                {provider.logoUrl ? (
                  <img src={provider.logoUrl} alt="" className="size-5 rounded-md object-contain" />
                ) : (
                  <Tv className="size-4" />
                )}
                <span>Watch on {meta?.name || provider.name}</span>
                <ExternalLink className="size-3 opacity-80 ml-0.5" />
              </a>
            );
          })}
        </div>
      )}

      {/* Secondary Row: Free with Ads & Movies Anywhere */}
      {(freeWithAds.length > 0 || isMoviesEligible) && (
        <div className="flex flex-wrap items-center gap-2">
          {freeWithAds.map((provider) => {
            const deepLink = generateDeepLink(provider, titleName, platform);
            return (
              <a
                key={`free-${provider.id}`}
                href={deepLink}
                target={platform === "web" ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition-all shadow-sm"
                title={`Watch Free with Ads on ${provider.name}`}
              >
                {provider.logoUrl && <img src={provider.logoUrl} alt="" className="size-4 rounded" />}
                <span>Free on {provider.name}</span>
                <ExternalLink className="size-3 opacity-70" />
              </a>
            );
          })}

          {isMoviesEligible && (
            <a
              href={`intent://moviesanywhere.com/explore/search?query=${encodeURIComponent(titleName)}#Intent;scheme=https;package=com.moviesanywhere.moviesanywhere;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(`https://moviesanywhere.com/explore/search?query=${encodeURIComponent(titleName)}`)};end`}
              target={platform === "web" ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3.5 text-xs font-medium text-blue-300 hover:bg-blue-500/20 transition-all shadow-sm"
              title="Sync or redeem on Movies Anywhere"
            >
              <ShoppingBag className="size-4 text-blue-400" />
              <span>Movies Anywhere</span>
              <ExternalLink className="size-3 opacity-70" />
            </a>
          )}
        </div>
      )}

      {/* Tertiary Row: Rent / Buy Summary */}
      {rentOrBuy.length > 0 && subscriptions.length === 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <Tag className="size-3 text-muted" />
          <span className="font-serif">Available to Rent or Buy:</span>
          <span className="text-foreground font-medium">
            {[...new Set(rentOrBuy.map((p) => p.name))].slice(0, 4).join(" · ")}
          </span>
        </div>
      )}

      {/* Archival Legal Attribution */}
      {data.attribution && (
        <div className="pt-1">
          <a
            href={data.attribution.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-faint hover:text-muted transition-colors inline-block font-serif"
          >
            {data.attribution.text}
          </a>
        </div>
      )}
    </div>
  );
}
