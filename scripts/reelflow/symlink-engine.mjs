/**
 * ReelFlow Canonical Symlink Engine
 * High-performance bulk directory scanner, FUSE stat-thrashing protector,
 * multi-episode & multi-season pack canonical link orchestrator, and dead symlink detector.
 */

import fs from "node:fs";
import path from "node:path";
import { parseSceneTitle, isSampleOrJunkFile } from "./quality.mjs";

const VIDEO_EXTS = new Set([".mkv", ".mp4", ".avi", ".m4v", ".ts"]);
const dirCache = new Map(); // path -> { entries: string[], timestamp: number }
const DIR_CACHE_TTL_MS = 10 * 1000; // 10 seconds cache to protect FUSE

/**
 * Reads a directory with memory caching to prevent repeated FUSE stat calls.
 */
export function cachedReaddir(dirPath) {
  const now = Date.now();
  const cached = dirCache.get(dirPath);
  if (cached && now - cached.timestamp < DIR_CACHE_TTL_MS) {
    return cached.entries;
  }
  try {
    if (!fs.existsSync(dirPath)) return [];
    const entries = fs.readdirSync(dirPath);
    dirCache.set(dirPath, { entries, timestamp: now });
    return entries;
  } catch {
    return [];
  }
}

/**
 * Finds matching video files inside /mnt/debrid for a given release name or hash.
 */
export function findMediaFilesOnDebrid(debridRoot = "/mnt/debrid", releaseName = "", hash = "") {
  const candidates = [];
  const searchRoots = [
    path.join(debridRoot, "torbox"),
    path.join(debridRoot, "torrents"),
    path.join(debridRoot, "__all__"),
    debridRoot,
  ];

  for (const root of searchRoots) {
    const entries = cachedReaddir(root);
    if (!entries.length) continue;

    // Check if there is an exact folder matching hash or release name
    for (const entry of entries) {
      const isHashMatch = hash && entry.toLowerCase() === hash.toLowerCase();
      const isNameMatch = releaseName && entry.toLowerCase() === releaseName.toLowerCase();
      const isPrefixMatch = releaseName && entry.toLowerCase().startsWith(releaseName.toLowerCase().slice(0, 20));

      if (isHashMatch || isNameMatch || isPrefixMatch) {
        const fullPath = path.join(root, entry);
        // If it's a direct video file:
        const ext = path.extname(entry).toLowerCase();
        if (VIDEO_EXTS.has(ext) && !isSampleOrJunkFile(entry)) {
          candidates.push(fullPath);
        } else {
          // If it's a directory, walk one level inside
          const innerFiles = cachedReaddir(fullPath);
          for (const f of innerFiles) {
            const fExt = path.extname(f).toLowerCase();
            if (VIDEO_EXTS.has(fExt) && !isSampleOrJunkFile(f)) {
              candidates.push(path.join(fullPath, f));
            } else {
              // Check subdirectories (e.g. Season 1 folders)
              const subPath = path.join(fullPath, f);
              const subEntries = cachedReaddir(subPath);
              for (const sf of subEntries) {
                const sfExt = path.extname(sf).toLowerCase();
                if (VIDEO_EXTS.has(sfExt) && !isSampleOrJunkFile(sf)) {
                  candidates.push(path.join(subPath, sf));
                }
              }
            }
          }
        }
      }
    }
    if (candidates.length > 0) break;
  }

  return candidates;
}

/**
 * Safely creates an atomic symlink from sourcePath to targetPath.
 */
export function createAtomicSymlink(sourcePath, targetPath) {
  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // If symlink already exists and points to the right target, return early
  if (fs.existsSync(targetPath)) {
    try {
      const currentTarget = fs.readlinkSync(targetPath);
      if (currentTarget === sourcePath) {
        return { ok: true, created: false, path: targetPath };
      }
      fs.unlinkSync(targetPath);
    } catch {
      if (process.platform === "win32") {
        try {
          const content = fs.readFileSync(targetPath, "utf8");
          if (content === `REELOS_SYMLINK:${sourcePath}`) {
            return { ok: true, created: false, path: targetPath, fallback: "simulated" };
          }
        } catch {}
      }
      fs.rmSync(targetPath, { force: true });
    }
  }

  // Create temporary symlink and rename atomically
  const tempLink = `${targetPath}.tmp.${Date.now()}`;
  try {
    fs.symlinkSync(sourcePath, tempLink, process.platform === "win32" ? "file" : undefined);
    fs.renameSync(tempLink, targetPath);
    return { ok: true, created: true, path: targetPath };
  } catch (err) {
    if (process.platform === "win32" && err.code === "EPERM") {
      // Simulated symlink marker for Windows test runner
      fs.writeFileSync(tempLink, `REELOS_SYMLINK:${sourcePath}`, "utf8");
      fs.renameSync(tempLink, targetPath);
      return { ok: true, created: true, path: targetPath, fallback: "simulated" };
    }
    if (fs.existsSync(tempLink)) {
      try { fs.unlinkSync(tempLink); } catch {}
    }
    throw err;
  }
}

/**
 * Creates canonical symlink for a Movie into /srv/media/movies/{CleanTitle} ({Year})/{CleanTitle} ({Year}) [{Resolution}].{ext}
 */
export function linkMovie({
  cleanTitle,
  year,
  resolution = "1080p",
  sourceVideoPath,
  mediaRootDir = "/srv/media",
}) {
  if (!cleanTitle || !sourceVideoPath) {
    return { ok: false, error: "Missing required movie parameters" };
  }

  const ext = path.extname(sourceVideoPath).toLowerCase() || ".mkv";
  const folderName = year ? `${cleanTitle} (${year})` : cleanTitle;
  const fileName = `${folderName} [${resolution}]${ext}`;
  const targetPath = path.join(mediaRootDir, "movies", folderName, fileName);

  const res = createAtomicSymlink(sourceVideoPath, targetPath);
  return { ...res, cleanTitle, year, resolution, targetPath };
}

/**
 * Creates canonical symlinks for a TV show episode or multi-episode file.
 * Handles S01E01-E02 dual linking, season packs, and canonical TV folder structuring.
 */
export function linkTvEpisodes({
  cleanShowTitle,
  seasonNum,
  sourceVideoPaths = [],
  mediaRootDir = "/srv/media",
}) {
  if (!cleanShowTitle || !sourceVideoPaths.length) {
    return { ok: false, linked: [] };
  }

  const linked = [];
  const showFolder = path.join(mediaRootDir, "tv", cleanShowTitle);

  for (const src of sourceVideoPaths) {
    const filename = path.basename(src);
    const parsed = parseSceneTitle(filename);
    const s = seasonNum || parsed.season || 1;
    const seasonFolder = path.join(showFolder, `Season ${String(s).padStart(2, "0")}`);
    const ext = path.extname(src).toLowerCase() || ".mkv";
    const resTag = parsed.resolution || "1080p";

    // Detect if this file covers multiple episodes: e.g. S01E01-E02 or S01E01E02
    const multiMatch = filename.match(/\bS\d{1,2}E(\d{1,3})[-_.]?E?(\d{1,3})\b/i);
    let episodeNumbers = [];

    if (multiMatch && multiMatch[1] && multiMatch[2]) {
      const epStart = parseInt(multiMatch[1], 10);
      const epEnd = parseInt(multiMatch[2], 10);
      for (let ep = epStart; ep <= epEnd; ep++) {
        episodeNumbers.push(ep);
      }
    } else if (parsed.episode !== null) {
      episodeNumbers.push(parsed.episode);
    } else {
      // Fallback: check simple "Episode 01" or numbers
      const fallbackMatch = filename.match(/(?:ep|episode|e)[._\s-]*(\d{1,3})/i);
      if (fallbackMatch) {
        episodeNumbers.push(parseInt(fallbackMatch[1], 10));
      } else {
        episodeNumbers.push(1);
      }
    }

    // Create a distinct canonical symlink for every episode covered by the file
    for (const epNum of episodeNumbers) {
      const epTag = `S${String(s).padStart(2, "0")}E${String(epNum).padStart(2, "0")}`;
      const canonicalFileName = `${cleanShowTitle} - ${epTag} [${resTag}]${ext}`;
      const targetPath = path.join(seasonFolder, canonicalFileName);

      const linkResult = createAtomicSymlink(src, targetPath);
      linked.push({
        ...linkResult,
        episode: epNum,
        season: s,
        targetPath,
      });
    }
  }

  return { ok: true, linked };
}

/**
 * Scans existing canonical symlinks in /srv/media and detects broken/dead links
 * (such as when TorBox deletes 30-day cloud cache).
 */
export function scanForDeadSymlinks(mediaRootDir = "/srv/media") {
  const dead = [];
  const dirsToScan = [
    path.join(mediaRootDir, "movies"),
    path.join(mediaRootDir, "tv"),
  ];

  for (const dir of dirsToScan) {
    if (!fs.existsSync(dir)) continue;

    const walk = (current) => {
      let entries = [];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isSymbolicLink()) {
          try {
            const target = fs.readlinkSync(fullPath);
            if (!fs.existsSync(target)) {
              dead.push({
                symlinkPath: fullPath,
                targetPath: target,
                name: entry.name,
              });
            }
          } catch {
            dead.push({
              symlinkPath: fullPath,
              targetPath: "unreadable",
              name: entry.name,
            });
          }
        } else if (process.platform === "win32" && entry.isFile()) {
          try {
            const content = fs.readFileSync(fullPath, "utf8");
            if (content.startsWith("REELOS_SYMLINK:")) {
              const target = content.slice("REELOS_SYMLINK:".length);
              if (!fs.existsSync(target)) {
                dead.push({
                  symlinkPath: fullPath,
                  targetPath: target,
                  name: entry.name,
                });
              }
            }
          } catch {}
        }
      }
    };

    walk(dir);
  }

  return dead;
}
