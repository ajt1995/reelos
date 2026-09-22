import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAdaptiveMemoryCeiling } from "./reelos-box-scale.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = new Set(process.argv.slice(2));
const secondsArg = process.argv.find((arg) => arg.startsWith("--seconds="));
const inputArg = process.argv.find((arg) => arg.startsWith("--input="));
const durationSec = Math.max(
  5,
  Math.min(120, Number(secondsArg?.split("=")[1]) || 20),
);
const inputPath = path.resolve(
  inputArg?.slice("--input=".length) ||
    path.join(ROOT, "public", "reelos_teaser_45s.mp4"),
);
const ffmpeg = process.env.REELOS_FFMPEG || "ffmpeg";
const ffprobe = process.env.REELOS_FFPROBE || "ffprobe";

function run(binary, commandArgs, options = {}) {
  const started = performance.now();
  const result = spawnSync(binary, commandArgs, {
    encoding: options.input ? undefined : "utf8",
    input: options.input,
    timeout: options.timeoutMs || 120_000,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  return {
    status: result.status,
    signal: result.signal,
    error: result.error?.message || null,
    stdout: Buffer.isBuffer(result.stdout)
      ? result.stdout.toString("utf8")
      : result.stdout || "",
    stderr: Buffer.isBuffer(result.stderr)
      ? result.stderr.toString("utf8")
      : result.stderr || "",
    wallMs: Math.round(performance.now() - started),
  };
}

function firstTemperatureC() {
  if (process.platform !== "linux") return null;
  for (let index = 0; index < 16; index++) {
    const candidate = `/sys/class/thermal/thermal_zone${index}/temp`;
    try {
      const raw = Number(readFileSync(candidate, "utf8").trim());
      if (Number.isFinite(raw) && raw > 0)
        return Math.round((raw / 1000) * 10) / 10;
    } catch {}
  }
  return null;
}

function parseSpeed(stderr) {
  const values = [...String(stderr).matchAll(/speed=\s*([0-9.]+)x/g)];
  return values.length ? Number(values.at(-1)[1]) : null;
}

function parseMaxRssKb(stderr) {
  const match = String(stderr).match(/maxrss=(\d+)kB/i);
  return match ? Number(match[1]) : null;
}

function trial(name, codecArgs, inputBuffer) {
  const beforeFreeMb = Math.round(os.freemem() / 1024 / 1024);
  const beforeTempC = firstTemperatureC();
  const result = run(
    ffmpeg,
    [
      "-hide_banner",
      "-benchmark",
      "-stats",
      "-t",
      String(durationSec),
      "-i",
      "pipe:0",
      "-map",
      "0:v:0?",
      "-map",
      "0:a:0?",
      ...codecArgs,
      "-f",
      "null",
      "-",
    ],
    { input: inputBuffer, timeoutMs: Math.max(90_000, durationSec * 8_000) },
  );
  const afterFreeMb = Math.round(os.freemem() / 1024 / 1024);
  const speed = parseSpeed(result.stderr);
  return {
    name,
    ok: result.status === 0,
    realtime: result.status === 0 && speed !== null ? speed >= 1 : null,
    speed,
    wallMs: result.wallMs,
    maxRssMb: parseMaxRssKb(result.stderr)
      ? Math.round((parseMaxRssKb(result.stderr) / 1024) * 10) / 10
      : null,
    freeMemoryDeltaMb: beforeFreeMb - afterFreeMb,
    temperatureBeforeC: beforeTempC,
    temperatureAfterC: firstTemperatureC(),
    error:
      result.status === 0
        ? null
        : result.error ||
          result.stderr.split("\n").filter(Boolean).slice(-3).join(" "),
  };
}

function main() {
  const version = run(ffmpeg, ["-version"], { timeoutMs: 10_000 });
  if (version.status !== 0) {
    throw new Error(
      `ffmpeg is unavailable: ${version.error || version.stderr || "not found"}`,
    );
  }
  if (!existsSync(inputPath))
    throw new Error(`Benchmark input is missing: ${inputPath}`);

  const inputBuffer = readFileSync(inputPath);
  const probe = run(
    ffprobe,
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=codec_name,width,height,pix_fmt",
      "-of",
      "json",
      inputPath,
    ],
    { timeoutMs: 15_000 },
  );
  let media = null;
  try {
    media = JSON.parse(probe.stdout).streams?.[0] || null;
  } catch {}

  const memory = getAdaptiveMemoryCeiling({
    isDedicated: true,
    platform: "linux",
  });
  const threads = Math.max(1, Math.min(4, os.cpus().length - 1 || 1));
  const trials = [
    trial("RAM-fed remux/copy", ["-c", "copy"], inputBuffer),
    trial(
      "480p software transcode",
      [
        "-vf",
        "scale=-2:480",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-threads",
        String(threads),
        "-c:a",
        "aac",
      ],
      inputBuffer,
    ),
    trial(
      "720p software transcode",
      [
        "-vf",
        "scale=-2:720",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-threads",
        String(threads),
        "-c:a",
        "aac",
      ],
      inputBuffer,
    ),
    trial(
      "1080p software transcode",
      [
        "-vf",
        "scale=-2:1080",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-threads",
        String(threads),
        "-c:a",
        "aac",
      ],
      inputBuffer,
    ),
  ];

  const report = {
    schemaVersion: 1,
    measuredAt: new Date().toISOString(),
    destructive: false,
    inputMode: "memory-pipe",
    outputMode: "null-sink",
    durationSec,
    input: { path: inputPath, bytes: inputBuffer.length, media },
    hardware: {
      hostname: os.hostname(),
      platform: process.platform,
      arch: os.arch(),
      cpu: os.cpus()[0]?.model || "Unknown",
      logicalCpus: os.cpus().length,
      totalMemoryMb: Math.round(os.totalmem() / 1024 / 1024),
      applianceMemoryBudgetMb: memory.targetMemoryMb,
      protectedHeadroomMb: memory.videoHeadroomMb,
      ffmpeg: version.stdout.split("\n")[0] || "unknown",
    },
    trials,
    verdict: {
      remux: trials[0].ok,
      software480pRealtime: trials[1].realtime,
      software720pRealtime: trials[2].realtime,
      software1080pRealtime: trials[3].realtime,
    },
  };

  if (args.has("--write")) {
    const stateDir =
      process.env.REELOS_STATE || path.join(ROOT, ".reelos-state");
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(
      path.join(stateDir, "potato-transcode-benchmark.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
