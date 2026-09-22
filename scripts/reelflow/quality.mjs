/**
 * ReelFlow Quality & Scene Release Engine
 * Fast, deterministic scene parsing, quality scoring, and poison-pill filtering.
 */

// Poison-pill indicators that can never be streamed over debrid FUSE
const POISON_PILL_REGEX = /\b(cam|camrip|telesync|ts|hdcam|hdts|workprint|wp|screener|scr|dvdscr)\b/i;
const ARCHIVE_EXT_REGEX = /\.(rar|zip|7z|tar|gz|r0[0-9]|r1[0-9]|part[0-9]+\.rar)$/i;
const SAMPLE_REGEX = /[._\-\s]sample[._\-\s]/i;

/**
 * Parses a scene release name into structured metadata.
 */
export function parseSceneTitle(rawName) {
  if (!rawName || typeof rawName !== "string") {
    return {
      raw: "",
      cleanTitle: "",
      year: null,
      resolution: "unknown",
      hdr: [],
      source: "unknown",
      codec: "unknown",
      audio: [],
      season: null,
      episode: null,
      seasonPack: false,
      isPoison: false,
      poisonReason: null,
    };
  }

  const raw = rawName.trim();

  // Check archive poison
  if (ARCHIVE_EXT_REGEX.test(raw)) {
    return {
      raw,
      cleanTitle: raw,
      isPoison: true,
      poisonReason: "archive_packed",
      resolution: "unknown",
    };
  }

  // Check cam/telesync poison
  if (POISON_PILL_REGEX.test(raw)) {
    return {
      raw,
      cleanTitle: raw,
      isPoison: true,
      poisonReason: "cam_low_quality",
      resolution: "cam",
    };
  }

  // Resolution detection
  let resolution = "1080p";
  if (/\b(2160p|4k|uhd)\b/i.test(raw)) {
    resolution = "2160p";
  } else if (/\b1080[pi]\b/i.test(raw)) {
    resolution = "1080p";
  } else if (/\b720p\b/i.test(raw)) {
    resolution = "720p";
  } else if (/\b(480p|576p|sd)\b/i.test(raw)) {
    resolution = "480p";
  }

  // Dynamic range / HDR detection
  const hdr = [];
  if (/\b(dolby\s*vision|dovi|dv)\b/i.test(raw)) hdr.push("DV");
  if (/\bhdr10\+/i.test(raw) || /\bhdr10plus\b/i.test(raw)) hdr.push("HDR10+");
  else if (/\b(hdr10|hdr)\b/i.test(raw)) hdr.push("HDR10");
  if (/\bhlg\b/i.test(raw)) hdr.push("HLG");

  // Source detection
  let source = "WEB-DL";
  if (/\b(remux)\b/i.test(raw)) source = "Remux";
  else if (/\b(bluray|bdrip|brrip)\b/i.test(raw)) source = "BluRay";
  else if (/\b(web[-._]?dl|webrip)\b/i.test(raw)) source = "WEB-DL";
  else if (/\b(hdtv)\b/i.test(raw)) source = "HDTV";
  else if (/\b(dvd|dvdrip)\b/i.test(raw)) source = "DVD";

  // Codec detection
  let codec = "unknown";
  if (/\b(hevc|x265|h[-.]?265)\b/i.test(raw)) codec = "HEVC";
  else if (/\b(avc|x264|h[-.]?264)\b/i.test(raw)) codec = "AVC";
  else if (/\b(av1)\b/i.test(raw)) codec = "AV1";

  // Audio formats
  const audio = [];
  if (/\b(atmos)\b/i.test(raw)) audio.push("Atmos");
  if (/\b(truehd)\b/i.test(raw)) audio.push("TrueHD");
  if (/\b(dts[-._]?hd\s*ma|dts[-._]?ma)\b/i.test(raw)) audio.push("DTS-HD MA");
  else if (/\b(dts)\b/i.test(raw)) audio.push("DTS");
  if (/\b(ddp|eac3|dovi)\b/i.test(raw)) audio.push("EAC3");
  if (/\b(ac3|dd5[._-]?1)\b/i.test(raw)) audio.push("AC3");
  if (/\b(aac)\b/i.test(raw)) audio.push("AAC");

  // TV Season / Episode detection
  let season = null;
  let episode = null;
  let seasonPack = false;

  // e.g. S01E02 or S01E01-E02 or s1e2
  const epMatch = raw.match(/\bS(\d{1,2})E(\d{1,3})(?:[-_.]?E?(\d{1,3}))?\b/i);
  if (epMatch) {
    season = parseInt(epMatch[1], 10);
    episode = parseInt(epMatch[2], 10);
  } else {
    // Check for Season Pack: e.g. S01 or Season.1 or Season 1 or S01-S03
    const spMatch = raw.match(/\b(?:S(\d{1,2})|Season[._\s]*(\d{1,2}))(?:\s*-\s*S?(\d{1,2}))?\b/i);
    if (spMatch) {
      season = parseInt(spMatch[1] || spMatch[2], 10);
      seasonPack = true;
    }
  }

  // Clean Title & Year Extraction
  let cleanTitle = raw;
  let year = null;
  const yearMatch = raw.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
    const idx = raw.indexOf(yearMatch[0]);
    if (idx > 0) {
      cleanTitle = raw.substring(0, idx);
    }
  } else if (epMatch && epMatch.index > 0) {
    cleanTitle = raw.substring(0, epMatch.index);
  }

  // Clean dots, underscores, dashes
  cleanTitle = cleanTitle
    .replace(/[._\-+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    raw,
    cleanTitle,
    year,
    resolution,
    hdr,
    source,
    codec,
    audio,
    season,
    episode,
    seasonPack,
    isPoison: false,
    poisonReason: null,
  };
}

/**
 * Determines whether a file path inside a torrent is a sample, extra, or junk file.
 */
export function isSampleOrJunkFile(filePath, sizeBytes = 0) {
  if (!filePath) return true;
  const lower = filePath.toLowerCase();

  // Junk extensions
  if (/\.(nfo|txt|exe|bat|sh|url|lnk|jpg|png|gif|idx|sub)$/i.test(lower)) {
    return true;
  }

  // Archive files
  if (ARCHIVE_EXT_REGEX.test(lower)) {
    return true;
  }

  // Sample files
  if (SAMPLE_REGEX.test(lower)) {
    return true;
  }

  // Size check: if size is known and < 30MB for a video file, it is almost certainly a sample
  if (sizeBytes > 0 && sizeBytes < 30 * 1024 * 1024) {
    if (/\.(mkv|mp4|avi|ts|m4v)$/i.test(lower)) {
      return true;
    }
  }

  return false;
}

/**
 * Calculates a quality score for a candidate release against user preferences.
 * @param {Object} parsed - Result from parseSceneTitle
 * @param {Object} options
 * @param {string} options.qualityFloor - "2160p" | "1080p" | "720p"
 * @param {boolean} options.preferHdr - Prefer DV/HDR10
 * @param {boolean} options.preferRemux - Prefer Remux over WEB-DL
 * @param {number} options.sizeBytes - Size in bytes
 * @param {boolean} options.isCached - Instant debrid cache hit
 * @returns {number} Score from 0 to 1000 (0 = rejected/unusable)
 */
export function scoreRelease(parsed, options = {}) {
  if (!parsed || parsed.isPoison) return 0;

  const {
    qualityFloor = "1080p",
    preferHdr = true,
    preferRemux = false,
    sizeBytes = 0,
    isCached = false,
  } = options;

  let score = 100;

  // Cached boost: cached releases get immediate 300 points
  if (isCached) {
    score += 300;
  }

  // Resolution scoring
  if (parsed.resolution === "2160p") {
    score += 250;
  } else if (parsed.resolution === "1080p") {
    score += 200;
  } else if (parsed.resolution === "720p") {
    score += 80;
  } else {
    score += 10;
  }

  // Penalty if below quality floor
  if (qualityFloor === "2160p" && parsed.resolution !== "2160p") {
    score -= 150;
  } else if (qualityFloor === "1080p" && parsed.resolution === "720p") {
    score -= 100;
  }

  // HDR / Dolby Vision scoring
  if (parsed.hdr.includes("DV")) {
    score += preferHdr ? 120 : 50;
  }
  if (parsed.hdr.includes("HDR10+") || parsed.hdr.includes("HDR10")) {
    score += preferHdr ? 90 : 40;
  }

  // Source scoring
  if (parsed.source === "Remux") {
    score += preferRemux ? 120 : 60;
  } else if (parsed.source === "BluRay") {
    score += 100;
  } else if (parsed.source === "WEB-DL") {
    score += 90;
  }

  // Codec scoring (HEVC / AV1 modern efficiency)
  if (parsed.codec === "HEVC" || parsed.codec === "AV1") {
    score += 40;
  }

  // Audio scoring
  if (parsed.audio.includes("Atmos") || parsed.audio.includes("TrueHD") || parsed.audio.includes("DTS-HD MA")) {
    score += 40;
  }

  // File size sanity checks
  if (sizeBytes > 0) {
    const sizeGB = sizeBytes / (1024 * 1024 * 1024);
    // Suspiciously small feature film (<500MB)
    if (sizeGB < 0.5 && !parsed.episode) {
      score -= 200;
    }
    // Optimal 4K range: 10GB - 70GB
    if (parsed.resolution === "2160p" && sizeGB >= 10 && sizeGB <= 70) {
      score += 40;
    }
    // Optimal 1080p range: 2GB - 15GB
    if (parsed.resolution === "1080p" && sizeGB >= 2 && sizeGB <= 15) {
      score += 30;
    }
  }

  // Audio frequency brick-wall check: phone-mic cam-rip cutoff (<8kHz)
  if (options.audioCutoffHz && options.audioCutoffHz < 8000) {
    return 0;
  }

  return Math.max(0, score);
}

/**
 * Inspects audio spectrum parameters to detect cam-rip releases disguised as HD/4K.
 * Pure cinema standards require full audible spectrum (>=16kHz high-frequency content).
 * Phone mics and cinema hall bootlegs brick-wall abruptly below 8kHz.
 */
export function inspectAudioSpectrumQuality({
  sampleRateHz = 48000,
  frequencyCutoffHz = 20000,
  channels = 2,
} = {}) {
  const sampleRate = Number(sampleRateHz) || 48000;
  const cutoff = Number(frequencyCutoffHz) || 20000;

  if (cutoff < 8000 || sampleRate < 16000) {
    return {
      isPoison: true,
      poisonReason: "cam_audio_cutoff",
      sampleRateHz: sampleRate,
      frequencyCutoffHz: cutoff,
      description: "Audio frequency cutoff below 8kHz indicates cam-rip recording",
    };
  }

  return {
    isPoison: false,
    poisonReason: null,
    sampleRateHz: sampleRate,
    frequencyCutoffHz: cutoff,
    description: "Studio high-fidelity audio spectrum verified",
  };
}
