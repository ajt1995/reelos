import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import os from "node:os";
import { join, resolve } from "node:path";
import { findBundledChromium, findBundledMediaTool, findLocalIntelligencePack } from "./local-tool-discovery.mjs";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const jsonMode = process.argv.includes("--json");
const strictMedia = process.argv.includes("--require-media");
const requireFfmpeg = strictMedia || process.argv.includes("--require-ffmpeg");
const requireFfprobe = strictMedia || process.argv.includes("--require-ffprobe");
const requireBrowser = strictMedia || process.argv.includes("--require-browser");
const requireGit = process.argv.includes("--require-git");
const gitCandidates = [
  { source: "program-files", executable: process.platform === "win32" ? join(process.env.ProgramFiles ?? "", "Git", "cmd", "git.exe") : null },
  { source: "local-appdata", executable: process.platform === "win32" ? join(process.env.LOCALAPPDATA ?? "", "Programs", "Git", "cmd", "git.exe") : null },
  { source: "codex-runtime", executable: process.platform === "win32" ? join(process.env.USERPROFILE ?? "", ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "native", "git", "cmd", "git.exe") : null },
].filter((candidate) => candidate.executable);

function binaryVersion(binary) {
  try {
    return execFileSync(binary, ["-version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split(/\r?\n/)[0] || null;
  } catch {
    return null;
  }
}

function browserStatus() {
  try {
    const playwright = require("playwright");
    const executable = playwright.chromium.executablePath();
    const discovered = existsSync(executable) ? executable : findBundledChromium(root);
    return { installed: Boolean(discovered), executable: discovered || null };
  } catch {
    return { installed: false, executable: null };
  }
}

function gitStatus() {
  const unavailable = {
    installed: false,
    pathAvailable: false,
    source: null,
    executable: null,
    repository: false,
    head: null,
    dirty: null,
    version: null,
  };
  try {
    let pathAvailable = false;
    try {
      execFileSync("git", ["--version"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      pathAvailable = true;
    } catch {
      // Git may be supplied by the desktop runtime rather than PATH.
    }
    const fallback = gitCandidates.find((candidate) => existsSync(candidate.executable));
    const selected = pathAvailable
      ? { source: "PATH", executable: "git" }
      : fallback;
    if (!selected) return unavailable;
    const command = (args) => execFileSync(
      selected.executable,
      ["-c", `safe.directory=${root}`, "-C", root, ...args],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    const version = command(["--version"]);
    const repository = command(["rev-parse", "--is-inside-work-tree"]) === "true";
    if (!repository) return { ...unavailable, installed: true, pathAvailable, source: selected.source, executable: selected.executable, version };
    const head = command(["rev-parse", "--short", "HEAD"]) || null;
    const dirty = command(["status", "--porcelain"]).length > 0;
    return { installed: true, pathAvailable, source: selected.source, executable: selected.executable, repository: true, head, dirty, version };
  } catch {
    return unavailable;
  }
}

function stateProfile() {
  const candidates = [join(root, ".reelos-state", "hardware-profile.json"), join(root, ".reelos-state", "potato-transcode-benchmark.json")];
  return candidates.map((path) => ({ path: path.slice(root.length + 1).replaceAll("\\", "/"), present: existsSync(path) }));
}

function fixtureStatus() {
  return ["reelos_teaser_45s.mp4", "reelos_what_if_45s.mp4"].map((name) => {
    const path = join(root, "public", name);
    return { name, present: existsSync(path), bytes: existsSync(path) ? Number(readFileSync(path).length) : 0 };
  });
}

const freeMemoryMb = Math.round(os.freemem() / 1024 / 1024);
const totalMemoryMb = Math.round(os.totalmem() / 1024 / 1024);
const ffmpegPath = findBundledMediaTool("ffmpeg", root);
const ffprobePath = findBundledMediaTool("ffprobe", root);
const ffmpeg = binaryVersion(ffmpegPath || "ffmpeg");
const ffprobe = binaryVersion(ffprobePath || "ffprobe");
const browser = browserStatus();
const git = gitStatus();
const intelligencePack = findLocalIntelligencePack(root);
const report = {
  schema: "reelos-runtime-doctor/v1",
  generatedAt: new Date().toISOString(),
  machine: {
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
    cpu: os.cpus()[0]?.model ?? "Unknown",
    logicalCpus: os.cpus().length,
    totalMemoryMb,
    freeMemoryMb
  },
  tools: { ffmpeg, ffprobe, ffmpegPath, ffprobePath, chromium: browser },
  repository: git,
  fixtures: fixtureStatus(),
  localConcierge: {
    eligible: totalMemoryMb >= 12 * 1024 && freeMemoryMb >= 6 * 1024,
    reason: totalMemoryMb < 12 * 1024 ? "requires 12 GiB installed RAM" : freeMemoryMb < 6 * 1024 ? "requires 6 GiB free RAM" : "hardware gate satisfied",
    modelInstalled: Boolean(intelligencePack),
    packDirectory: intelligencePack?.directory || null
  },
  stateEvidence: stateProfile()
};

const mediaReady = Boolean(ffmpeg && ffprobe && browser.installed && report.fixtures.every((fixture) => fixture.present));
if (jsonMode) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
else {
  console.log(`Runtime doctor: ${report.machine.cpu} | ${Math.round(totalMemoryMb / 1024)} GiB RAM | ${Math.round(freeMemoryMb / 1024)} GiB free`);
  console.log(`Media tools: ffmpeg ${ffmpeg ? "ready" : "missing"}, ffprobe ${ffprobe ? "ready" : "missing"}, Chromium ${browser.installed ? "ready" : "missing"}`);
  console.log(`Git: ${git.installed ? (git.repository ? `${git.head || "unknown"}${git.dirty ? " (dirty)" : ""} via ${git.source}` : `installed via ${git.source}, not a repository`) : "binary missing"}${git.installed && !git.pathAvailable ? " (not on PATH)" : ""}`);
  console.log(`Local concierge: ${report.localConcierge.eligible ? "eligible" : `disabled — ${report.localConcierge.reason}`}`);
  console.log(`Fixtures: ${report.fixtures.every((fixture) => fixture.present) ? "ready" : "missing"}`);
}
if (
  (strictMedia && !mediaReady) ||
  (requireFfmpeg && !ffmpeg) ||
  (requireFfprobe && !ffprobe) ||
  (requireBrowser && !browser.installed) ||
  (requireGit && (!git.installed || !git.repository))
) process.exitCode = 1;
