import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { spawnSync } from "node:child_process";
import { beforeEach, afterEach, describe, it } from "node:test";
import { PREPARATION_RECIPES, probePreparationSource, estimatePreparationBytes, runPreparationCodec } from "./preparation-codec.mjs";

function probeData({ duration = 2, width = 640, height = 360, video = "h264", audio = ["aac", "aac"], subtitles = [], ...extra } = {}) {
  return { format: { duration: String(duration) }, streams: [
    { index: 0, codec_type: "video", codec_name: video, width, height, pix_fmt: "yuv420p", avg_frame_rate: "24/1", sample_aspect_ratio: "1:1", duration: String(duration), ...extra },
    ...audio.map((codec, index) => ({ index: index + 1, codec_type: "audio", codec_name: codec, channels: 2, duration: String(duration) })),
    ...subtitles.map((codec, index) => ({ index: audio.length + index + 1, codec_type: "subtitle", codec_name: codec })),
  ] };
}

function fakeTools({ source = probeData(), output = probeData(), decodeTime = 2000000, onSpawn, probeText, noisy = false, badProgress = false, encodeExit = 0 } = {}) {
  const calls = [];
  const spawnFn = (command, args, options) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.pid = 123;
    let closed = false;
    const close = (code) => { if (!closed) { closed = true; child.emit("close", code); } };
    child.kill = () => { calls.at(-1).killed = true; setImmediate(() => close(null)); return true; };
    const call = { command, args, options, child, close };
    calls.push(call);
    const intercepted = onSpawn?.(call, calls.length);
    if (!intercepted) setImmediate(() => {
      if (closed) return;
      if (args.includes("-show_streams")) {
        child.stdout.emit("data", Buffer.from(probeText ?? JSON.stringify(calls.filter((entry) => entry.args.includes("-show_streams")).length === 1 ? source : output)));
      } else if (args.includes("null")) {
        child.stdout.emit("data", Buffer.from(`out_time_us=${decodeTime}\nprogress=end\n`));
      } else {
        fs.writeFileSync(args.at(-1), Buffer.alloc(2048));
        if (noisy) child.stderr.emit("data", Buffer.alloc(2 * 1024 * 1024, 0x65));
        child.stdout.emit("data", Buffer.from(badProgress ? "x".repeat(20000) : "out_time_us=1000000\nprogress=continue\nout_time_us=2000000\nprogress=end\n"));
        if (calls.at(-1).killed) return;
        close(encodeExit);
        return;
      }
      if (!calls.at(-1).killed) close(0);
    });
    return child;
  };
  return { spawnFn, calls };
}

describe("Bounded local preparation codec", () => {
  let dir, inputPath, outputPath;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "preparation-codec-"));
    inputPath = path.join(dir, "source.mp4");
    outputPath = path.join(dir, "output.mp4");
    fs.writeFileSync(inputPath, "source fixture bytes");
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
  const argsFor = (inputPath, outputPath, tools, recipe = "compatible") => ({ inputPath, outputPath, recipe, maxBytes: 16 * 1024 * 1024, ...tools });

  it("builds single-thread bounded remux commands, preserves every mapped track, and validates before progress reaches one", async () => {
    const data = probeData({ subtitles: ["mov_text"] });
    const tools = fakeTools({ source: data, output: data });
    const progress = [], phases = [];
    const result = await runPreparationCodec({ ...argsFor(inputPath, outputPath, tools), onProgress: (value) => progress.push(value), onPhase: (phase) => phases.push(phase) });
    assert.equal(result.operation, "remux");
    assert.deepEqual(result.audioCodecs, ["aac", "aac"]);
    assert.deepEqual(result.subtitleCodecs, ["mov_text"]);
    const stat = fs.lstatSync(outputPath, { bigint: true });
    assert.deepEqual(result.verifiedFingerprint, Object.fromEntries(["dev", "ino", "size", "mtimeNs", "ctimeNs"].map((key) => [key, String(stat[key])])));
    const encode = tools.calls[1].args;
    assert.equal(encode[encode.indexOf("-c:v") + 1], "copy");
    assert.equal(encode[encode.indexOf("-c:a") + 1], "copy");
    assert.deepEqual(encode.flatMap((value, index) => value === "-map" ? [encode[index + 1]] : []), ["0:0", "0:1", "0:2", "0:3"]);
    assert.ok(encode.includes("-n"));
    assert.equal(encode[encode.indexOf("-fs") + 1], String(16 * 1024 * 1024));
    assert.deepEqual(phases, ["preparing", "validating"]);
    assert.ok(progress.slice(0, -1).every((value) => value <= 0.99));
    assert.equal(progress.at(-1), 1);
    assert.equal(tools.calls.length, 4);
    assert.ok(tools.calls[3].args.includes("-xerror"));
    assert.ok(tools.calls[3].args.includes("null"));
    for (const call of tools.calls) {
      assert.equal(call.options.windowsHide, true);
      assert.equal(call.options.shell, false);
      assert.equal(call.args[call.args.indexOf("-threads") + 1], "1");
      assert.equal(call.args[call.args.indexOf("-protocol_whitelist") + 1], "file,pipe");
    }
  });

  it("uses CRF20 and bounded rates for transcodes without upscaling and estimates all audio plus overhead", async () => {
    const tools = fakeTools({ source: probeData({ video: "hevc", audio: ["flac", "ac3"] }) });
    const result = await runPreparationCodec(argsFor(inputPath, outputPath, tools, "portable720"));
    assert.equal(result.operation, "transcode");
    const command = tools.calls[1].args;
    assert.equal(command[command.indexOf("-crf") + 1], "20");
    assert.equal(command[command.indexOf("-vf") + 1], "scale=640:360,setsar=1");
    assert.equal(command[command.indexOf("-maxrate:v") + 1], String(PREPARATION_RECIPES.portable720.maxRate));
    assert.ok(command.includes("-b:a:0"));
    assert.ok(command.includes("-b:a:1"));
    const metadata = await probePreparationSource(inputPath, fakeTools());
    const twoTrack = estimatePreparationBytes(metadata, "living1080");
    const oneTrack = estimatePreparationBytes({ ...metadata, audioChannels: [2], audioCodecs: ["aac"] }, "living1080");
    assert.ok(twoTrack > oneTrack);
    assert.ok(estimatePreparationBytes(metadata, "compatible") > metadata.sizeBytes);
  });

  it("bounds 4K transcodes to recipe dimensions while retaining all eight supported audio tracks", async () => {
    for (const [recipe, width, height] of [["portable720", 1280, 720], ["living1080", 1920, 1080]]) {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      const audio = Array(8).fill("aac");
      const tools = fakeTools({
        source: probeData({ width: 3840, height: 2160, audio }),
        output: probeData({ width, height, audio }),
      });
      const result = await runPreparationCodec(argsFor(inputPath, outputPath, tools, recipe));
      assert.equal(result.width, width);
      assert.equal(result.height, height);
      assert.equal(result.audioCodecs.length, 8);
      assert.equal(tools.calls[1].args.filter((value) => /^-b:a:/.test(value)).length, 8);
    }
  });

  it("rejects HDR, unsupported subtitles, excessive tracks and pathological media before producing output", async () => {
    for (const [source, code] of [
      [probeData({ color_transfer: "smpte2084" }), "unsupported_hdr"],
      [probeData({ subtitles: ["hdmv_pgs_subtitle"] }), "unsupported_subtitles"],
      [probeData({ subtitles: ["ass"] }), "unsupported_subtitles"],
      [probeData({ audio: Array(9).fill("aac") }), "unsupported_streams"],
      [probeData({ width: 20000 }), "invalid_media"],
      [probeData({ duration: 50000 }), "invalid_media"],
      [probeData({ avg_frame_rate: "200/1" }), "invalid_media"],
    ]) {
      const tools = fakeTools({ source });
      await assert.rejects(runPreparationCodec(argsFor(inputPath, outputPath, tools)), { code });
      assert.equal(tools.calls.length, 1);
      assert.equal(fs.existsSync(outputPath), false);
    }
  });

  it("rejects truncated, wrong-codec, missing-track and undecodable outputs despite successful encoding exit", async () => {
    for (const config of [
      { output: probeData({ duration: 1 }) },
      { output: probeData({ video: "hevc" }) },
      { output: probeData({ audio: ["aac"] }) },
      { decodeTime: 1000000 },
    ]) {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      const progress = [];
      await assert.rejects(runPreparationCodec({ ...argsFor(inputPath, outputPath, fakeTools(config)), onProgress: (value) => progress.push(value) }), { code: "output_verification_failed" });
      assert.equal(progress.includes(1), false);
      assert.equal(fs.existsSync(outputPath), true, "caller owns failed output cleanup");
    }
  });

  it("bounds probe JSON, progress and diagnostic tails and waits for termination after limits", async () => {
    const probe = fakeTools({ probeText: "x".repeat(300000) });
    await assert.rejects(probePreparationSource(inputPath, probe), { code: "probe_output_limit" });
    assert.equal(probe.calls[0].killed, true);
    const progress = fakeTools({ badProgress: true });
    await assert.rejects(runPreparationCodec(argsFor(inputPath, outputPath, progress)), { code: "progress_output_limit" });
    assert.equal(progress.calls[1].killed, true);
    fs.unlinkSync(outputPath);
    const noisy = fakeTools({ noisy: true, encodeExit: 1 });
    await assert.rejects(runPreparationCodec(argsFor(inputPath, outputPath, noisy)), (error) => error.code === "codec_failed" && error.diagnostic.length <= 16384);
  });

  it("kills and awaits child close for cancellation and timeout, including abort during full verification", async () => {
    for (const stopPhase of [1, 2, 4]) {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      const controller = new AbortController();
      let closed = false;
      const tools = fakeTools({ onSpawn(call, number) {
        if (number !== stopPhase) return false;
        call.child.kill = () => { setTimeout(() => { closed = true; call.close(null); }, 5); return true; };
        setImmediate(() => controller.abort());
        return true;
      } });
      await assert.rejects(runPreparationCodec({ ...argsFor(inputPath, outputPath, tools), signal: controller.signal }), { code: "preparation_aborted" });
      assert.equal(closed, true);
    }
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    const timeout = fakeTools({ onSpawn() { return true; } });
    await assert.rejects(probePreparationSource(inputPath, { ...timeout, timeoutMs: 5 }), { code: "codec_timeout" });
    assert.equal(timeout.calls[0].killed, true);
    const cancelled = new AbortController();
    cancelled.abort();
    const unused = fakeTools();
    await assert.rejects(probePreparationSource(inputPath, { ...unused, signal: cancelled.signal }), { code: "preparation_aborted" });
    assert.equal(unused.calls.length, 0);
  });

  it("never overwrites an existing output or the source and detects output byte-limit overshoot", async () => {
    const original = fs.readFileSync(inputPath);
    fs.writeFileSync(outputPath, "existing output");
    await assert.rejects(runPreparationCodec(argsFor(inputPath, outputPath, fakeTools())), { code: "output_exists" });
    assert.equal(fs.readFileSync(outputPath, "utf8"), "existing output");
    await assert.rejects(runPreparationCodec(argsFor(inputPath, inputPath, fakeTools())), { code: "invalid_output_path" });
    fs.unlinkSync(outputPath);
    await assert.rejects(runPreparationCodec({ ...argsFor(inputPath, outputPath, fakeTools()), maxBytes: 1024 }), { code: "output_budget_exceeded" });
    assert.deepEqual(fs.readFileSync(inputPath), original);
  });

  it("never issues an ownership receipt for a failed output, including an output-creation race lost by -n", async () => {
    const tools = fakeTools({ onSpawn(call, number) {
      if (number !== 2) return false;
      fs.writeFileSync(outputPath, "created independently after the absent-path check");
      setImmediate(() => call.close(1));
      return true;
    } });
    await assert.rejects(runPreparationCodec(argsFor(inputPath, outputPath, tools)), (error) => {
      assert.equal(error.code, "codec_failed");
      assert.equal(error.verifiedFingerprint, undefined);
      assert.equal(error.partialFingerprint, undefined);
      assert.equal(error.ownedPartialFingerprint, undefined);
      return true;
    });
    assert.equal(fs.readFileSync(outputPath, "utf8"), "created independently after the absent-path check");
    assert.ok(tools.calls[1].args.includes("-n"));
  });

  it("refuses publication if the output changes during full decoded verification", async () => {
    const progress = [];
    const tools = fakeTools({ onSpawn(call, number) {
      if (number !== 4) return false;
      fs.writeFileSync(outputPath, Buffer.alloc(2048, 0x43));
      setImmediate(() => {
        call.child.stdout.emit("data", Buffer.from("out_time_us=2000000\nprogress=end\n"));
        call.close(0);
      });
      return true;
    } });
    await assert.rejects(runPreparationCodec({ ...argsFor(inputPath, outputPath, tools), onProgress: (value) => progress.push(value) }), { code: "output_changed" });
    assert.equal(progress.includes(1), false);
  });

  it("prepares and fully decodes real remux and portable outputs with two audio tracks and captions using approved local tools", async () => {
    fs.unlinkSync(inputPath);
    const captions = path.join(dir, "captions.srt");
    fs.writeFileSync(captions, "1\n00:00:00,000 --> 00:00:01,500\nPreserved caption\n");
    const generated = spawnSync(process.env.REELOS_FFMPEG || "ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-nostdin", "-n", "-threads", "1", "-filter_threads", "1",
      "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24:duration=2",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
      "-f", "lavfi", "-i", "sine=frequency=880:duration=2", "-i", captions,
      "-map", "0:v", "-map", "1:a", "-map", "2:a", "-map", "3:s",
      "-c:v", "libx264", "-threads:v", "1", "-pix_fmt", "yuv420p", "-c:a", "aac", "-c:s", "mov_text", inputPath,
    ], { encoding: "utf8", windowsHide: true, timeout: 30000 });
    assert.equal(generated.status, 0, generated.error?.message || generated.stderr);
    const source = await probePreparationSource(inputPath);
    assert.deepEqual(source.audioCodecs, ["aac", "aac"]);
    assert.deepEqual(source.subtitleCodecs, ["mov_text"]);
    const original = fs.readFileSync(inputPath);
    for (const recipe of ["compatible", "portable720", "living1080"]) {
      const destination = path.join(dir, recipe + ".mp4");
      const progress = [], phases = [];
      const prepared = await runPreparationCodec({
        inputPath, outputPath: destination, recipe, maxBytes: estimatePreparationBytes(source, recipe),
        onProgress: (value) => progress.push(value), onPhase: (phase) => phases.push(phase),
      });
      assert.equal(prepared.operation, recipe === "compatible" ? "remux" : "transcode");
      assert.equal(prepared.videoCodec, "h264");
      assert.deepEqual(prepared.audioCodecs, ["aac", "aac"]);
      assert.deepEqual(prepared.subtitleCodecs, ["mov_text"]);
      assert.equal(prepared.width, 320);
      assert.equal(prepared.height, 180);
      const stat = fs.lstatSync(destination, { bigint: true });
      assert.deepEqual(prepared.verifiedFingerprint, Object.fromEntries(["dev", "ino", "size", "mtimeNs", "ctimeNs"].map((key) => [key, String(stat[key])])));
      assert.equal(progress.at(-1), 1);
      assert.deepEqual(phases, ["preparing", "validating"]);
      const subtitle = spawnSync(process.env.REELOS_FFMPEG || "ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-nostdin", "-i", destination, "-map", "0:s:0", "-f", "srt", "pipe:1",
      ], { encoding: "utf8", windowsHide: true, timeout: 15000 });
      assert.equal(subtitle.status, 0, subtitle.stderr);
      assert.match(subtitle.stdout, /Preserved caption/);
    }
    assert.deepEqual(fs.readFileSync(inputPath), original);
    const tinyOutput = path.join(dir, "too-small.mp4");
    await assert.rejects(runPreparationCodec({ inputPath, outputPath: tinyOutput, recipe: "living1080", maxBytes: 1024 }));
    assert.deepEqual(fs.readFileSync(inputPath), original);
  });
});
