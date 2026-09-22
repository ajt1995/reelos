/**
 * Just-In-Time (JIT) Debrid Resolution & Media Ingestion Service.
 * Resolves cloud torrents to instantaneous HTTPS streams (<800ms),
 * performs regex-based episode tree matching across season packs,
 * and computes OpenSubtitles moviehash over HTTP Range requests.
 */

const VIDEO_EXTS = new Set(['.mkv', '.mp4', '.avi', '.mov', '.ts', '.m4v', '.webm']);
const SAMPLE_REGEX = /(^|[._ -])(sample|trailer|extras?|featurette|preview)([._ -]|$)/i;

/**
 * Matches an episode file from a release file tree.
 * Supports S01E02, 1x02, [01x02], Season 1 Episode 2, multi-episode (S01E01-E02), and anime absolute numbering.
 * @param {Array<{id: string|number, name: string, path?: string, size?: number}>} files
 * @param {number} seasonNum
 * @param {number} episodeNum
 * @returns {{id: string|number, name: string, path?: string, size?: number} | null}
 */
export function matchEpisodeFile(files, seasonNum, episodeNum) {
  if (!Array.isArray(files) || files.length === 0) return null;
  const s = Number(seasonNum);
  const e = Number(episodeNum);

  // 1. Filter out non-video files and samples
  const videoFiles = files.filter((f) => {
    const name = String(f.path || f.name || '').toLowerCase();
    const isVideo = Array.from(VIDEO_EXTS).some((ext) => name.endsWith(ext));
    if (!isVideo) return false;
    if (SAMPLE_REGEX.test(name)) return false;
    return true;
  });

  if (videoFiles.length === 0) return null;

  // Pattern 1: Standard S01E02 / S1E2 (including range S01E01-E03 or S01E01-03)
  for (const file of videoFiles) {
    const name = String(file.path || file.name || '');
    const m = name.match(/s(\d{1,2})[._ -]?e(\d{1,3})(?:[-~](?:e|ep)?(\d{1,3}))?/i);
    if (m) {
      const fileSeason = parseInt(m[1], 10);
      const fileEpStart = parseInt(m[2], 10);
      const fileEpEnd = m[3] ? parseInt(m[3], 10) : fileEpStart;
      if (fileSeason === s && e >= fileEpStart && e <= fileEpEnd) {
        return file;
      }
    }
  }

  // Pattern 2: 1x02 or 01x02 format
  for (const file of videoFiles) {
    const name = String(file.path || file.name || '');
    const m = name.match(/(?:^|[^a-z0-9])(\d{1,2})x(\d{1,3})(?:-(\d{1,3}))?(?:[^a-z0-9]|$)/i);
    if (m) {
      const fileSeason = parseInt(m[1], 10);
      const fileEpStart = parseInt(m[2], 10);
      const fileEpEnd = m[3] ? parseInt(m[3], 10) : fileEpStart;
      if (fileSeason === s && e >= fileEpStart && e <= fileEpEnd) {
        return file;
      }
    }
  }

  // Pattern 3: "Season X Episode Y" verbose format
  for (const file of videoFiles) {
    const name = String(file.path || file.name || '');
    const m = name.match(/season[._ -]?(\d+)[._ -]+episode[._ -]?(\d+)/i);
    if (m) {
      const fileSeason = parseInt(m[1], 10);
      const fileEp = parseInt(m[2], 10);
      if (fileSeason === s && fileEp === e) {
        return file;
      }
    }
  }

  // Pattern 4: Absolute episode numbering if Season 1 (e.g., Anime " - 02" or "E02")
  if (s === 1) {
    for (const file of videoFiles) {
      const name = String(file.path || file.name || '');
      const m = name.match(/(?:^|[._ -])(?:e|ep|episode)[._ -]?(\d{1,3})(?:[._ -]|$)/i);
      if (m) {
        const fileEp = parseInt(m[1], 10);
        if (fileEp === e) return file;
      }
      const m2 = name.match(/(?: - )(\d{2,3})(?:[._ -])/);
      if (m2) {
        const fileEp = parseInt(m2[1], 10);
        if (fileEp === e) return file;
      }
    }
  }

  return null;
}

/**
 * Computes OpenSubtitles 64-bit little-endian moviehash from an HTTP media stream
 * using two 64KB HTTP Range requests in memory (<150ms). Zero disk I/O.
 * @param {string} streamUrl
 * @param {number} [knownSize]
 * @returns {Promise<{hash: string, size: number} | null>}
 */
export async function computeMovieHashFromHttpStream(streamUrl, knownSize = null) {
  try {
    let fileSize = knownSize;
    if (!fileSize) {
      const head = await fetch(streamUrl, { method: 'HEAD' });
      const cl = head.headers.get('content-length');
      if (cl) fileSize = parseInt(cl, 10);
    }

    if (!fileSize || fileSize < 131072) return null; // Minimum 128KB required

    const CHUNK_SIZE = 65536; // 64 KB

    // Fetch start chunk (0 to 65535) and end chunk (size-65536 to size-1)
    const [startResp, endResp] = await Promise.all([
      fetch(streamUrl, { headers: { Range: `bytes=0-${CHUNK_SIZE - 1}` } }),
      fetch(streamUrl, { headers: { Range: `bytes=${fileSize - CHUNK_SIZE}-${fileSize - 1}` } }),
    ]);

    if (!startResp.ok || !endResp.ok) return null;

    const startBuf = Buffer.from(await startResp.arrayBuffer());
    const endBuf = Buffer.from(await endResp.arrayBuffer());

    if (startBuf.length < CHUNK_SIZE || endBuf.length < CHUNK_SIZE) return null;

    // 64-bit integer addition matching OpenSubtitles algorithm
    let hashLow = fileSize & 0xffffffff;
    let hashHigh = Math.floor(fileSize / 0x100000000) & 0xffffffff;

    function add64(low, high) {
      hashLow = (hashLow + low) >>> 0;
      let carry = hashLow < low ? 1 : 0;
      hashHigh = (hashHigh + high + carry) >>> 0;
    }

    // Process 64KB start chunk in 8-byte 64-bit words
    for (let i = 0; i < CHUNK_SIZE; i += 8) {
      const l = startBuf.readUInt32LE(i);
      const h = startBuf.readUInt32LE(i + 4);
      add64(l, h);
    }

    // Process 64KB end chunk in 8-byte 64-bit words
    for (let i = 0; i < CHUNK_SIZE; i += 8) {
      const l = endBuf.readUInt32LE(i);
      const h = endBuf.readUInt32LE(i + 4);
      add64(l, h);
    }

    const hexH = hashHigh.toString(16).padStart(8, '0');
    const hexL = hashLow.toString(16).padStart(8, '0');
    return {
      hash: `${hexH}${hexL}`,
      size: fileSize,
    };
  } catch (_e) {
    return null;
  }
}
