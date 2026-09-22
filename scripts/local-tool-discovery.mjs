import fs from "node:fs";
import path from "node:path";

function onPath(name) {
  const suffix = process.platform === "win32" ? ".exe" : "";
  for (const entry of String(process.env.PATH || "").split(path.delimiter)) {
    if (!entry) continue;
    const candidate = path.join(entry, `${name}${suffix}`);
    try { if (fs.statSync(candidate).isFile()) return candidate; } catch { /* keep looking */ }
  }
  return null;
}

function boundedFind(root, filename, maxDepth = 5) {
  if (!root) return null;
  const pending = [{ dir: path.resolve(root), depth: 0 }];
  let visited = 0;
  while (pending.length && visited < 600) {
    const { dir, depth } = pending.shift();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      visited += 1;
      if (visited >= 600) break;
      if (entry.isSymbolicLink()) continue;
      const candidate = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === filename.toLowerCase()) return candidate;
      if (entry.isDirectory() && depth < maxDepth) pending.push({ dir: candidate, depth: depth + 1 });
    }
  }
  return null;
}

export function findBundledMediaTool(name, projectRoot) {
  const envName = name === "ffmpeg" ? "REELOS_FFMPEG" : "REELOS_FFPROBE";
  const explicit = process.env[envName];
  if (explicit) {
    try { if (fs.statSync(explicit).isFile()) return path.resolve(explicit); } catch { /* invalid override fails into discovery */ }
  }
  const fromPath = onPath(name);
  if (fromPath) return fromPath;
  const filename = process.platform === "win32" ? `${name}.exe` : name;
  const projectTools = path.join(projectRoot, "tools");
  const siblingTools = path.join(path.dirname(projectRoot), "tools");
  const roots = [
    path.join(projectTools, `${name}-portable`),
    path.join(siblingTools, `${name}-portable`),
    path.join(projectTools, "ffmpeg-portable"),
    path.join(siblingTools, "ffmpeg-portable"),
    projectTools,
    siblingTools,
    process.resourcesPath ? path.join(process.resourcesPath, "tools") : null,
    path.join(path.dirname(process.execPath), "tools"),
  ];
  for (const root of roots) {
    const found = boundedFind(root, filename);
    if (found) return found;
  }
  return null;
}

export function mediaToolEnvironment(projectRoot) {
  const ffmpeg = findBundledMediaTool("ffmpeg", projectRoot);
  const ffprobe = findBundledMediaTool("ffprobe", projectRoot);
  return {
    ...(ffmpeg ? { REELOS_FFMPEG: ffmpeg } : {}),
    ...(ffprobe ? { REELOS_FFPROBE: ffprobe } : {}),
  };
}

export function findBundledChromium(projectRoot) {
  const filename = process.platform === "win32" ? "chrome.exe" : process.platform === "darwin" ? "Chromium" : "chrome";
  const roots = [
    path.join(projectRoot, "tools", "playwright"),
    path.join(path.dirname(projectRoot), "tools", "playwright"),
  ];
  for (const root of roots) {
    const found = boundedFind(root, filename, 5);
    if (found) return found;
  }
  return null;
}

export function findLocalIntelligencePack(projectRoot) {
  const candidates = [
    process.env.REELOS_MODEL_PACK_DIR,
    process.platform === "win32" && process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "ReelOS", "model-packs")
      : null,
    path.join(projectRoot, "tools", "reelos-intelligence"),
    path.join(path.dirname(projectRoot), "tools", "reelos-intelligence"),
  ].filter(Boolean);
  for (const directory of candidates) {
    try {
      const receipt = JSON.parse(fs.readFileSync(path.join(directory, "install-receipt.json"), "utf8"));
      if (receipt?.status !== "downloaded_not_registered_or_activated") continue;
      if (!fs.statSync(receipt.runtime?.path).isFile() || !fs.statSync(receipt.model?.path).isFile()) continue;
      return { directory: path.resolve(directory), runtime: receipt.runtime.path, model: receipt.model.path };
    } catch { /* keep looking */ }
  }
  return null;
}
