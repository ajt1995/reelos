import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export const PREPARATION_RECIPES = Object.freeze({
  compatible: Object.freeze({ label: "Compatible", maxWidth: 1920, maxHeight: 1080, maxRate: 6000000, bufferSize: 12000000, crf: 20, preferRemux: true }),
  portable720: Object.freeze({ label: "Portable 720p", maxWidth: 1280, maxHeight: 720, maxRate: 4000000, bufferSize: 8000000, crf: 20, preferRemux: false }),
  living1080: Object.freeze({ label: "Living room 1080p", maxWidth: 1920, maxHeight: 1080, maxRate: 6000000, bufferSize: 12000000, crf: 20, preferRemux: false }),
});
const TEXT_SUBTITLES = new Set(["subrip", "mov_text"]);
const MAX_DURATION = 12 * 60 * 60;
const MAX_PROCESS_MS = 6 * 60 * 60 * 1000;
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
const abortError = () => Object.assign(new Error("Preparation was cancelled."), { code: "preparation_aborted", name: "AbortError" });

function regularFile(file) {
  if (typeof file !== "string" || !path.isAbsolute(file) || /^[/\\]{2}/.test(file)) fail("invalid_media_path", "A local absolute media file is required.");
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || !Number.isSafeInteger(stat.size) || stat.size <= 0) fail("invalid_media_path", "A nonempty regular media file is required.");
  return stat;
}

/** Direct child only: bounded streams, no shell, and cancellation waits for close. */
function runTool(command, args, options = {}) {
  if (options.signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    let child, failure, stdout = "", stderr = "", pending = "", lastTimeUs = 0, done = false;
    const timeoutMs = Math.min(MAX_PROCESS_MS, Math.max(1, options.timeoutMs || 30000));
    const stop = (error) => {
      failure ??= error;
      if (child && !done) child.kill("SIGKILL");
    };
    const abort = () => stop(abortError());
    try {
      child = (options.spawnFn || spawn)(command, args, {
        windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, OMP_NUM_THREADS: "1" },
      });
    } catch (error) { reject(Object.assign(new Error("The local media tool could not start."), { code: "codec_unavailable", cause: error })); return; }
    const timer = setTimeout(() => stop(Object.assign(new Error("The local media tool exceeded its time limit."), { code: "codec_timeout" })), timeoutMs);
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    child.stdout?.on("data", (chunk) => {
      if (failure) return;
      const text = chunk.toString("utf8");
      if (!options.progress) {
        if (Buffer.byteLength(stdout) + Buffer.byteLength(text) > 256 * 1024) {
          stop(Object.assign(new Error("Media probe output exceeded its limit."), { code: "probe_output_limit" }));
          return;
        }
        stdout += text;
      } else {
        pending += text;
        if (Buffer.byteLength(pending) > 16 * 1024) {
          stop(Object.assign(new Error("Media progress output exceeded its limit."), { code: "progress_output_limit" }));
          return;
        }
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() || "";
        for (const line of lines) {
          const match = /^out_time_us=(\d+)$/.exec(line);
          if (match) {
            const time = Number(match[1]);
            if (Number.isSafeInteger(time) && time >= 0) {
              lastTimeUs = Math.max(lastTimeUs, time);
              try { options.progress(lastTimeUs); } catch { /* Reporting cannot alter codec completion. */ }
            }
          }
        }
      }
    });
    child.stderr?.on("data", (chunk) => {
      // Keep a bounded diagnostic tail, including when ffmpeg is very noisy.
      stderr = (stderr + chunk.toString("utf8")).slice(-16384);
    });
    child.once("error", (error) => {
      failure ??= Object.assign(new Error("The local media tool could not run."), { code: "codec_unavailable", cause: error });
    });
    child.once("close", (code) => {
      done = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      if (failure) reject(failure);
      else if (code !== 0) reject(Object.assign(new Error("The local media tool rejected this media."), { code: "codec_failed", diagnostic: stderr }));
      else resolve({ stdout, stderr, lastTimeUs });
    });
  });
}

function rational(value) {
  if (typeof value === "number") return value;
  const [num, den = "1"] = String(value || "").split("/");
  return Number(num) / Number(den);
}

function streamDuration(stream, fallback) {
  const duration = Number(stream.duration);
  if (Number.isFinite(duration) && duration > 0) return duration;
  const match = /^(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(stream.tags?.DURATION || "");
  return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : fallback;
}

function parseMetadata(raw, sizeBytes) {
  const streams = raw?.streams;
  if (!Array.isArray(streams) || streams.length > 32) fail("invalid_media", "Media stream information is invalid.");
  const videos = streams.filter((stream) => stream.codec_type === "video" && !stream.disposition?.attached_pic);
  const audio = streams.filter((stream) => stream.codec_type === "audio");
  const subtitles = streams.filter((stream) => stream.codec_type === "subtitle");
  if (videos.length !== 1 || audio.length > 8 || subtitles.length > 16) fail("unsupported_streams", "Preparation requires one video, at most eight audio tracks and sixteen subtitle tracks.");
  if (streams.some((stream) => !["video", "audio", "subtitle"].includes(stream.codec_type))) fail("unsupported_streams", "This file contains unsupported ancillary streams.");
  const video = videos[0];
  if ([video, ...audio, ...subtitles].some((stream) => typeof stream.codec_name !== "string" || !/^[a-z0-9_]{1,64}$/.test(stream.codec_name))) fail("invalid_media", "Media codec identities are invalid.");
  const durationSeconds = Number(raw.format?.duration);
  const frameRate = rational(video.avg_frame_rate || video.r_frame_rate);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > MAX_DURATION
    || !Number.isInteger(video.width) || !Number.isInteger(video.height) || video.width < 2 || video.height < 2
    || video.width > 8192 || video.height > 8192 || video.width * video.height > 33554432
    || !Number.isFinite(frameRate) || frameRate <= 0 || frameRate > 120) fail("invalid_media", "Media duration, frame rate or dimensions exceed preparation limits.");
  if (audio.some((stream) => !Number.isInteger(stream.channels) || stream.channels < 1 || stream.channels > 8)) fail("unsupported_audio", "Audio channel layouts exceed preparation limits.");
  if (subtitles.some((stream) => !TEXT_SUBTITLES.has(stream.codec_name))) fail("unsupported_subtitles", "This subtitle format cannot be preserved by the preparation recipe.");
  const sideData = video.side_data_list || [];
  if (!Array.isArray(sideData) || sideData.length > 32) fail("invalid_media", "Media color and orientation metadata is invalid.");
  const hdr = ["smpte2084", "arib-std-b67"].includes(video.color_transfer)
    || video.color_primaries === "bt2020" || ["bt2020nc", "bt2020c"].includes(video.color_space)
    || sideData.some((entry) => /mastering display|content light|dovi|dolby vision|hdr/i.test(entry.side_data_type || ""));
  if (sideData.some((entry) => Number(entry.rotation || 0) % 360 !== 0)
    || (video.sample_aspect_ratio && !["1:1", "0:1", "N/A"].includes(video.sample_aspect_ratio))) fail("unsupported_video", "Rotated or non-square-pixel media needs a separately validated recipe.");
  const selected = [video, ...audio, ...subtitles];
  if (selected.some((stream) => !Number.isInteger(stream.index) || stream.index < 0)
    || new Set(selected.map((stream) => stream.index)).size !== selected.length) fail("invalid_media", "Media stream indices are invalid.");
  return {
    durationSeconds, width: video.width, height: video.height, videoCodec: video.codec_name,
    pixelFormat: video.pix_fmt, frameRate, sizeBytes, hdr,
    videoDurationSeconds: streamDuration(video, durationSeconds),
    videoIndex: video.index,
    audioCodecs: audio.map((stream) => stream.codec_name),
    audioChannels: audio.map((stream) => stream.channels),
    audioIndices: audio.map((stream) => stream.index),
    audioDurations: audio.map((stream) => streamDuration(stream, null)),
    subtitleCodecs: subtitles.map((stream) => stream.codec_name),
    subtitleIndices: subtitles.map((stream) => stream.index),
  };
}

export async function probePreparationSource(inputPath, options = {}) {
  if (options.signal?.aborted) throw abortError();
  const stat = regularFile(inputPath);
  const result = await runTool(options.ffprobePath || process.env.REELOS_FFPROBE || "ffprobe", [
    "-v", "error", "-threads", "1", "-protocol_whitelist", "file,pipe",
    "-show_streams", "-show_format", "-of", "json", inputPath,
  ], { ...options, timeoutMs: options.probeTimeoutMs || options.timeoutMs || 15000 });
  let raw;
  try { raw = JSON.parse(result.stdout); } catch { fail("invalid_probe", "The media probe did not return valid bounded JSON."); }
  return parseMetadata(raw, stat.size);
}

function recipePlan(metadata, recipe) {
  if (!Object.hasOwn(PREPARATION_RECIPES, recipe)) fail("invalid_recipe", "Unknown preparation recipe.");
  if (metadata.hdr) fail("unsupported_hdr", "HDR preparation requires a validated tone-mapping recipe.");
  const selected = PREPARATION_RECIPES[recipe];
  const remux = selected.preferRemux && metadata.videoCodec === "h264"
    && ["yuv420p", "yuvj420p"].includes(metadata.pixelFormat) && metadata.audioCodecs.every((codec) => codec === "aac");
  const factor = Math.min(1, selected.maxWidth / metadata.width, selected.maxHeight / metadata.height);
  return { ...selected, operation: remux ? "remux" : "transcode",
    width: remux ? metadata.width : Math.max(2, Math.floor(metadata.width * factor / 2) * 2),
    height: remux ? metadata.height : Math.max(2, Math.floor(metadata.height * factor / 2) * 2) };
}

function audioRate(channels) { return Math.min(512000, Math.max(128000, channels * 96000)); }

/** Conservative maximum reservation, including every audio track and mux overhead. */
export function estimatePreparationBytes(metadata, recipe) {
  if (!metadata || !Number.isSafeInteger(metadata.sizeBytes) || metadata.sizeBytes <= 0
    || !Number.isFinite(metadata.durationSeconds) || metadata.durationSeconds <= 0 || metadata.durationSeconds > MAX_DURATION
    || !Array.isArray(metadata.audioChannels) || metadata.audioChannels.length > 8
    || metadata.audioChannels.some((value) => !Number.isInteger(value) || value < 1 || value > 8)) fail("invalid_media", "Verified source metadata is required to estimate storage.");
  const plan = recipePlan(metadata, recipe);
  const estimate = plan.operation === "remux" ? Math.ceil(metadata.sizeBytes * 1.1) + 1024 * 1024
    : Math.ceil(((plan.maxRate + metadata.audioChannels.reduce((sum, channels) => sum + audioRate(channels), 0)) * metadata.durationSeconds / 8 + plan.bufferSize / 8) * 1.1)
      + 1024 * 1024 + (metadata.subtitleCodecs.length ? metadata.sizeBytes : 0);
  if (!Number.isSafeInteger(estimate)) fail("invalid_media", "The output estimate exceeds supported storage limits.");
  return estimate;
}

export async function runPreparationCodec(options) {
  const { inputPath, outputPath, recipe, maxBytes, signal, onProgress } = options;
  if (signal?.aborted) throw abortError();
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) fail("invalid_byte_limit", "A positive bounded output reservation is required.");
  regularFile(inputPath);
  if (typeof outputPath !== "string" || !path.isAbsolute(outputPath) || !/\.mp4$/i.test(outputPath)
    || /^[/\\]{2}/.test(outputPath) || path.resolve(outputPath) === fs.realpathSync(inputPath)) fail("invalid_output_path", "A new local MP4 output path is required.");
  try { fs.lstatSync(outputPath); fail("output_exists", "Preparation never overwrites an existing output."); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const source = await probePreparationSource(inputPath, options);
  const plan = recipePlan(source, recipe);
  try { options.onPhase?.("preparing"); } catch { /* Observers do not control the codec. */ }
  let lastProgress = 0;
  const report = (value) => {
    lastProgress = Math.max(lastProgress, value);
    try { onProgress?.(lastProgress); } catch { /* Progress observers do not control preparation. */ }
  };
  report(0);
  const args = ["-hide_banner", "-loglevel", "error", "-nostdin", "-n", "-threads", "1",
    "-filter_threads", "1", "-filter_complex_threads", "1", "-protocol_whitelist", "file,pipe", "-i", inputPath,
    "-map", `0:${source.videoIndex}`];
  for (const index of [...source.audioIndices, ...source.subtitleIndices]) args.push("-map", `0:${index}`);
  args.push("-map_metadata", "0", "-map_chapters", "0");
  if (plan.operation === "remux") args.push("-c:v", "copy", "-c:a", "copy");
  else {
    args.push("-c:v", "libx264", "-preset", "medium", "-crf", String(plan.crf), "-maxrate:v", String(plan.maxRate),
      "-bufsize:v", String(plan.bufferSize), "-pix_fmt", "yuv420p", "-vf", `scale=${plan.width}:${plan.height},setsar=1`,
      "-threads:v", "1", "-c:a", "aac");
    source.audioChannels.forEach((channels, index) => args.push(`-b:a:${index}`, String(audioRate(channels))));
  }
  if (source.subtitleIndices.length) args.push("-c:s", "mov_text");
  args.push("-threads", "1", "-avoid_negative_ts", "make_zero", "-movflags", "+faststart", "-fs", String(maxBytes),
    "-progress", "pipe:1", "-nostats", "-f", "mp4", outputPath);
  const ffmpeg = options.ffmpegPath || process.env.REELOS_FFMPEG || "ffmpeg";
  await runTool(ffmpeg, args, { ...options, timeoutMs: options.timeoutMs || Math.min(MAX_PROCESS_MS, source.durationSeconds * 8000 + 300000),
    progress: (timeUs) => report(Math.min(0.99, timeUs / (source.durationSeconds * 1000000))) });
  try { options.onPhase?.("validating"); } catch { /* Observers do not control verification. */ }
  if (signal?.aborted) throw abortError();
  const outputStat = regularFile(outputPath);
  const outputIdentity = fs.lstatSync(outputPath, { bigint: true });
  if (outputStat.size > maxBytes) fail("output_budget_exceeded", "The output exceeds its reserved byte limit.");
  const output = await probePreparationSource(outputPath, options);
  const tolerance = Math.max(0.1, Math.min(0.5, source.durationSeconds * 0.001));
  if (output.hdr || output.videoCodec !== "h264" || output.width !== plan.width || output.height !== plan.height
    || !["yuv420p", "yuvj420p"].includes(output.pixelFormat)
    || output.audioCodecs.length !== source.audioCodecs.length || output.audioCodecs.some((codec) => codec !== "aac")
    || output.audioChannels.some((channels, index) => channels !== source.audioChannels[index])
    || output.subtitleCodecs.length !== source.subtitleCodecs.length || output.subtitleCodecs.some((codec) => codec !== "mov_text")
    || Math.abs(output.durationSeconds - source.durationSeconds) > tolerance
    || Math.abs(output.videoDurationSeconds - source.videoDurationSeconds) > tolerance
    || output.audioDurations.some((duration, index) => source.audioDurations[index] && (!duration || Math.abs(duration - source.audioDurations[index]) > tolerance))) {
    fail("output_verification_failed", "The complete output did not match its source duration, tracks or recipe.");
  }
  const decoded = await runTool(ffmpeg, ["-hide_banner", "-loglevel", "error", "-nostdin", "-xerror", "-err_detect", "explode",
    "-threads", "1", "-filter_threads", "1", "-filter_complex_threads", "1", "-protocol_whitelist", "file,pipe",
    "-i", outputPath, "-map", "0:v:0", "-map", "0:a?", "-threads", "1", "-progress", "pipe:1", "-nostats", "-f", "null", "-"],
  { ...options, timeoutMs: options.verificationTimeoutMs || options.timeoutMs || Math.min(MAX_PROCESS_MS, source.durationSeconds * 4000 + 30000), progress: () => {} });
  if (decoded.lastTimeUs / 1000000 < source.durationSeconds - tolerance) fail("output_verification_failed", "Full decoded output ended before the source duration.");
  if (signal?.aborted) throw abortError();
  const verifiedStat = regularFile(outputPath);
  const verifiedIdentity = fs.lstatSync(outputPath, { bigint: true });
  if (["dev", "ino", "size", "mtimeNs", "ctimeNs"].some((key) => verifiedIdentity[key] !== outputIdentity[key])) fail("output_changed", "Output changed while it was being verified.");
  report(1);
  return { durationSeconds: output.durationSeconds, width: output.width, height: output.height,
    videoCodec: output.videoCodec, audioCodecs: output.audioCodecs, subtitleCodecs: output.subtitleCodecs,
    sizeBytes: verifiedStat.size, recipe, operation: plan.operation,
    verifiedFingerprint: Object.fromEntries(["dev", "ino", "size", "mtimeNs", "ctimeNs"].map((key) => [key, String(verifiedIdentity[key])])),
  };
}
