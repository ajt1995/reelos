import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const DEFAULT_STATE_DIR = process.env.REELOS_STATE || (process.platform === "win32" ? path.join(process.cwd(), ".reelos-state") : "/var/lib/reelos");

function readJellyfinToken(stateDir = DEFAULT_STATE_DIR) {
  try {
    const p = path.join(stateDir, "jellyfin.token");
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8").trim();
  } catch {}
  return "";
}

export function detectHardwareTier(stateDir = DEFAULT_STATE_DIR) {
  try {
    const tcPath = path.join(stateDir, "transcode.json");
    if (fs.existsSync(tcPath)) {
      const tc = JSON.parse(fs.readFileSync(tcPath, "utf8"));
      const gpu = String(tc.gpuType || tc.mode || "").toLowerCase();
      const hasHw = ["qsv", "nvenc", "vaapi"].includes(gpu) || Boolean(tc.videoTranscoding);
      if (gpu === "nvenc") return "beast";
      if (hasHw) return "workhorse";
      if (!hasHw && (gpu === "direct" || gpu === "none")) return "potato";
    }
  } catch {}

  try {
    const hwPath = path.join(stateDir, "hardware.json");
    if (fs.existsSync(hwPath)) {
      const data = JSON.parse(fs.readFileSync(hwPath, "utf8"));
      const gpu = String(data.gpu_type || data.gpu || "").toLowerCase();
      const cpuModel = String(data.cpu_model || data.cpu || "").toLowerCase();
      const cpus = Number(data.cpus || (Array.isArray(os.cpus?.()) ? os.cpus().length : 4));
      
      // High-performance Silicon: NVIDIA NVENC, Apple Silicon, or 8+ modern cores
      if (gpu.includes("nvidia") || gpu.includes("nvenc") || gpu.includes("apple") || cpus >= 8) {
        return "beast";
      }
      // Capable Silicon: Intel QuickSync (QSV), AMD VAAPI, or 4+ modern CPU cores
      if (gpu.includes("qsv") || gpu.includes("vaapi") || (cpus >= 4 && !cpuModel.includes("pentium") && !cpuModel.includes("celeron") && !cpuModel.includes("atom"))) {
        return "workhorse";
      }
      // Low-power Silicon / CPU Protection Mode (Pentium N3710, Celeron, Dual-Core, no GPU)
      return "potato";
    }
  } catch {}

  // Silicon-centric fallback: inspect CPU topology and cores instead of RAM
  const cpuList = Array.isArray(os.cpus?.()) ? os.cpus() : [];
  const coreCount = cpuList.length || 4;
  const firstCpu = (cpuList[0]?.model || "").toLowerCase();
  
  if (coreCount >= 8) return "beast";
  if (coreCount >= 4 && !firstCpu.includes("pentium") && !firstCpu.includes("celeron") && !firstCpu.includes("atom")) {
    return "workhorse";
  }
  return "potato";
}

/**
 * Normalizes a raw Jellyfin MediaSource into a structured, typed source object.
 */
export function normalizeMediaSource(source = {}, itemId = "") {
  const id = String(source.Id || itemId);
  const filePath = String(source.Path || "");
  const baseName = filePath ? path.basename(filePath) : String(source.Name || "Default");
  const container = String(source.Container || "").toLowerCase() || (filePath.endsWith(".mp4") ? "mp4" : "mkv");

  const streams = Array.isArray(source.MediaStreams) ? source.MediaStreams : [];
  const vStream = streams.find((s) => s.Type === "Video") || {};
  const aStream = streams.find((s) => s.Type === "Audio") || {};

  const vCodec = String(vStream.Codec || "").toLowerCase();
  const aCodec = String(aStream.Codec || "").toLowerCase();
  const width = Number(vStream.Width) || 0;
  const height = Number(vStream.Height) || 0;

  const is4k = (width >= 3800 || height >= 2000 || /2160p|4k|uhd/i.test(baseName));
  const quality = is4k ? "4k" : "1080p";

  const isH264 = vCodec === "h264" || vCodec === "avc";
  const isAac = aCodec === "aac" || aCodec === "mp3";
  const isDirectPlayableInBrowser = container === "mp4" && isH264 && isAac;

  const subStreams = streams.filter((s) => s.Type === "Subtitle");
  const subtitles = subStreams.map((s, idx) => {
    const lang = String(s.Language || "und").toLowerCase();
    const codec = String(s.Codec || "srt").toLowerCase();
    const title = s.DisplayTitle || s.Title || (lang === "eng" ? "English" : lang);
    const subIndex = s.Index !== undefined ? s.Index : idx;
    const isDefault = Boolean(s.IsDefault);
    const isForced = Boolean(s.IsForced);
    return {
      index: subIndex,
      language: lang,
      codec,
      label: title,
      isDefault,
      isForced,
      vttUrl: `/Videos/${encodeURIComponent(itemId)}/${encodeURIComponent(id)}/Subtitles/${encodeURIComponent(subIndex)}/Stream.vtt`,
    };
  });

  return {
    id,
    name: baseName,
    path: filePath,
    container,
    quality,
    is4k,
    videoCodec: vCodec || "unknown",
    audioCodec: aCodec || "unknown",
    width,
    height,
    bitrate: Number(source.Bitrate) || 0,
    sizeBytes: Number(source.Size) || 0,
    isDirectPlayableInBrowser,
    subtitles,
    directStreamUrl: `/Videos/${encodeURIComponent(itemId)}/stream.mp4?MediaSourceId=${encodeURIComponent(id)}&static=false&VideoCodec=copy&AudioCodec=aac`,
    transcodeStreamUrl: `/Videos/${encodeURIComponent(itemId)}/stream.mp4?MediaSourceId=${encodeURIComponent(id)}&static=false&VideoCodec=h264&AudioCodec=aac`,
    staticStreamUrl: `/Videos/${encodeURIComponent(itemId)}/stream.mp4?MediaSourceId=${encodeURIComponent(id)}&static=true`,
  };
}

/**
 * Resolves an external or prefixed ID (tmdb-*, tvdb-*, jf-*) to a bare Jellyfin GUID.
 */
export function resolveItemJellyfinId(itemId, { resolveJellyfinId = null, stateDir = DEFAULT_STATE_DIR } = {}) {
  const cleanId = String(itemId || "").trim();
  if (!cleanId) return "";

  if (cleanId.startsWith("jf-")) {
    return cleanId.replace(/^jf-/, "");
  }

  // If already 32-hex GUID, return directly
  if (/^[0-9a-f]{32}$/i.test(cleanId)) {
    return cleanId;
  }

  // 1. Check custom resolver if passed
  if (typeof resolveJellyfinId === "function") {
    try {
      const resolved = resolveJellyfinId(cleanId);
      if (resolved) return String(resolved).replace(/^jf-/, "");
    } catch {}
  }

  // 2. Check local shelf file in stateDir
  try {
    const p = path.join(stateDir, "library-shelf.json");
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, "utf8"));
      const titles = Array.isArray(data) ? data : data.titles || [];
      const match = titles.find(
        (t) =>
          t.id === cleanId ||
          t.jellyfinId === cleanId ||
          (Array.isArray(t.ids) && t.ids.includes(cleanId))
      );
      if (match?.jellyfinId) return String(match.jellyfinId).replace(/^jf-/, "");
    }
  } catch {}

  return cleanId;
}

/**
 * Queries Jellyfin API for item media sources and computes optimal recommendations.
 */
export async function queryMediaSources(itemId, { jellyfinUrl = "http://127.0.0.1:8096", token = "", stateDir = DEFAULT_STATE_DIR, resolveJellyfinId = null, hardwareTier = null } = {}) {
  const cleanId = String(itemId || "").trim();
  if (!cleanId) return { ok: false, error: "Missing itemId" };

  let targetJfId = resolveItemJellyfinId(cleanId, { resolveJellyfinId, stateDir });
  const tok = token || readJellyfinToken(stateDir);
  const tier = hardwareTier || detectHardwareTier(stateDir);

  const headers = {
    Accept: "application/json",
  };
  if (tok) {
    headers["X-Emby-Token"] = tok;
    headers["Authorization"] = `MediaBrowser Client="ReelOS", Device="ReelOS", DeviceId="reelos-box", Version="1.5.19", Token="${tok}"`;
  }

  let rawSources = [];

  // Fallback resolution: If targetJfId is still not a GUID, search Jellyfin library by ProviderIds
  if (!/^[0-9a-f]{32}$/i.test(targetJfId) && /^(?:tmdb|tvdb)-/i.test(cleanId)) {
    const tmdbMatch = cleanId.match(/^tmdb-(?:tv-)?(\d+)$/i);
    const tvdbMatch = cleanId.match(/^tvdb-(\d+)$/i);
    const tmdbId = tmdbMatch ? tmdbMatch[1] : null;
    const tvdbId = tvdbMatch ? tvdbMatch[1] : null;

    try {
      const res = await fetch(
        `${jellyfinUrl}/Items?Recursive=true&IncludeItemTypes=Movie,Series,Episode&Fields=MediaSources,MediaStreams,Path,ProviderIds`,
        { headers, signal: AbortSignal.timeout(6000) }
      );
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data.Items) ? data.Items : [];
        const match = items.find((it) => {
          const prov = it.ProviderIds || {};
          if (tmdbId && String(prov.Tmdb || "") === tmdbId) return true;
          if (tvdbId && String(prov.Tvdb || "") === tvdbId) return true;
          return false;
        });
        if (match) {
          targetJfId = match.Id;
          if (Array.isArray(match.MediaSources) && match.MediaSources.length) {
            rawSources = match.MediaSources;
          }
        }
      }
    } catch {}
  }

  if (!rawSources.length && targetJfId) {
    try {
      const res = await fetch(`${jellyfinUrl}/Items?Ids=${encodeURIComponent(targetJfId)}&Fields=MediaSources,MediaStreams,Path`, {
        headers,
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = await res.json();
        const item = (data.Items || [])[0];
        if (item && Array.isArray(item.MediaSources) && item.MediaSources.length) {
          rawSources = item.MediaSources;
        }
      }
    } catch {}
  }

  // Fallback: query single item PlaybackInfo if Items list was empty
  if (!rawSources.length && targetJfId) {
    try {
      const res = await fetch(`${jellyfinUrl}/Items/${encodeURIComponent(targetJfId)}/PlaybackInfo`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ DeviceProfile: {} }),
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.MediaSources)) {
          rawSources = data.MediaSources;
        }
      }
    } catch {}
  }

  const sources = rawSources.map((s) => normalizeMediaSource(s, targetJfId));

  const recommendedForTv = recommendStreamsForClient(sources, "tv", tier, targetJfId);
  const recommendedForBrowser = recommendStreamsForClient(sources, "browser", tier, targetJfId);
  const recommendedForMobile = recommendStreamsForClient(sources, "mobile", tier, targetJfId);

  return {
    ok: true,
    itemId: cleanId,
    jellyfinId: targetJfId,
    hardwareTier: tier,
    hasMultipleVersions: sources.length > 1,
    sources,
    recommendedForBrowser,
    recommendedForMobile,
    recommendedForTv,
  };
}

/**
 * Computes optimal stream recommendations based on client capability and server hardware tier.
 *
 * Routing Rules:
 * - On TVs: Always recommend highest visual quality (4K HDR Remux / DirectPlay).
 * - On potato systems (<= 4.5 GB RAM, without capable GPU):
 *   Always recommend 1080p MP4 / DirectStream remux to prevent server CPU transcode spikes.
 *   If only 4K exists, direct stream remux (audio copy/transcode) without triggering CPU video transcode.
 * - On hardware-transcode-capable servers (non-potato, e.g. workhorse/beast with QSV/NVENC/VAAPI):
 *   Allow browser and mobile clients to stream 4K sources via dynamic hardware transcode
 *   (deliveryMethod: "hardware_transcode", VideoCodec=h264) rather than locking them out or failing.
 */
export function recommendStreamsForClient(sources = [], clientOrOpts = "browser", maybeTier = null, maybeItemId = "") {
  let client = "browser";
  let tier = "workhorse";
  let itemId = "";

  if (typeof clientOrOpts === "object" && clientOrOpts !== null) {
    client = clientOrOpts.client || clientOrOpts.clientType || "browser";
    tier = clientOrOpts.hardwareTier || clientOrOpts.tier || "workhorse";
    itemId = clientOrOpts.itemId || clientOrOpts.jellyfinId || "";
  } else {
    client = clientOrOpts || "browser";
    tier = maybeTier || "workhorse";
    itemId = maybeItemId || "";
  }

  client = String(client).toLowerCase();
  tier = String(tier).toLowerCase();

  if (!Array.isArray(sources) || sources.length === 0) {
    return null;
  }

  // 1. TVs: Keep recommending the highest visual quality (4K HDR Remux / DirectPlay)
  if (client === "tv") {
    const sortedForTv = [...sources].sort((a, b) => {
      if (a.is4k && !b.is4k) return -1;
      if (!a.is4k && b.is4k) return 1;
      return (b.bitrate || 0) - (a.bitrate || 0);
    });
    const best = sortedForTv[0];
    return {
      ...best,
      deliveryMethod: "direct_play",
      url: best.staticStreamUrl || best.directStreamUrl,
      reason: best.is4k ? "4K HDR Remux (DirectPlay)" : "1080p DirectPlay (Highest Quality)",
    };
  }

  // 2. Browser & Mobile clients
  const isHwCapable = tier === "beast" || tier === "workhorse";

  const mp4_1080p = sources.find((s) => s.quality === "1080p" && s.container === "mp4");
  const h264_1080p = sources.find(
    (s) => s.quality === "1080p" && (s.videoCodec === "h264" || s.videoCodec === "avc")
  );
  const any_1080p = sources.find((s) => s.quality === "1080p");
  const any_mp4 = sources.find((s) => s.container === "mp4");
  const source_4k = sources.find((s) => s.is4k);

  // Favor native 1080p MP4 or 1080p H.264 direct stream remux for instant start
  if (mp4_1080p) {
    return {
      ...mp4_1080p,
      deliveryMethod: mp4_1080p.isDirectPlayableInBrowser ? "direct_play" : "direct_stream",
      url: mp4_1080p.isDirectPlayableInBrowser ? mp4_1080p.staticStreamUrl : mp4_1080p.directStreamUrl,
      reason: "Native 1080p MP4 (Instant start)",
    };
  }

  if (h264_1080p) {
    return {
      ...h264_1080p,
      deliveryMethod: "direct_stream",
      url: h264_1080p.directStreamUrl,
      reason: "1080p H.264 Direct Stream (Instant start)",
    };
  }

  // If HW-capable server and 4K source exists (no 1080p direct stream available),
  // allow browser and mobile clients to stream 4K via hardware transcode
  if (isHwCapable && source_4k && !any_1080p) {
    const targetId = itemId || source_4k.id;
    return {
      ...source_4k,
      deliveryMethod: "hardware_transcode",
      url: source_4k.transcodeStreamUrl || `/Videos/${encodeURIComponent(targetId)}/stream.mp4?MediaSourceId=${encodeURIComponent(source_4k.id)}&static=false&VideoCodec=h264&AudioCodec=aac`,
      reason: "Dynamic 4K Hardware Transcode (GPU Accelerated)",
    };
  }

  // 1080p direct stream remux (for potato systems or when 1080p exists)
  if (any_1080p) {
    return {
      ...any_1080p,
      deliveryMethod: "direct_stream",
      url: any_1080p.directStreamUrl,
      reason: "1080p Direct Stream Remux (Instant start)",
    };
  }

  // If HW-capable server with 4K
  if (isHwCapable && source_4k) {
    const targetId = itemId || source_4k.id;
    return {
      ...source_4k,
      deliveryMethod: "hardware_transcode",
      url: source_4k.transcodeStreamUrl || `/Videos/${encodeURIComponent(targetId)}/stream.mp4?MediaSourceId=${encodeURIComponent(source_4k.id)}&static=false&VideoCodec=h264&AudioCodec=aac`,
      reason: "Dynamic 4K Hardware Transcode (GPU Accelerated)",
    };
  }

  if (any_mp4) {
    return {
      ...any_mp4,
      deliveryMethod: any_mp4.isDirectPlayableInBrowser ? "direct_play" : "direct_stream",
      url: any_mp4.isDirectPlayableInBrowser ? any_mp4.staticStreamUrl : any_mp4.directStreamUrl,
      reason: "MP4 Video Stream",
    };
  }

  // Fallback for remaining sources
  const first = sources[0];
  if (first.is4k && isHwCapable) {
    const targetId = itemId || first.id;
    return {
      ...first,
      deliveryMethod: "hardware_transcode",
      url: first.transcodeStreamUrl || `/Videos/${encodeURIComponent(targetId)}/stream.mp4?MediaSourceId=${encodeURIComponent(first.id)}&static=false&VideoCodec=h264&AudioCodec=aac`,
      reason: "Dynamic 4K Hardware Transcode (GPU Accelerated)",
    };
  }

  return {
    ...first,
    deliveryMethod: "direct_stream",
    url: first.directStreamUrl,
    reason: tier === "potato" ? "Direct Stream Remux (audio transcode only)" : "Hardware Transcode / Direct Stream",
  };
}

/**
 * Route handler for GET /api/media/:id/sources
 */
export async function handleMediaSourcesRoute(req, res, { jellyfinUrl, token, stateDir, resolveJellyfinId } = {}) {
  const url = new URL(req.url, "http://127.0.0.1");
  const match = url.pathname.match(/^\/api\/media\/([^/]+)\/sources$/);
  if (!match) return false;

  const itemId = decodeURIComponent(match[1]);
  const result = await queryMediaSources(itemId, { jellyfinUrl, token, stateDir, resolveJellyfinId });

  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=60",
  });
  res.end(JSON.stringify(result));
  return true;
}
