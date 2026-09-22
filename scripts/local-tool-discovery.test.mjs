import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { findBundledMediaTool, findLocalIntelligencePack } from "./local-tool-discovery.mjs";

test("media tool discovery finds a bounded sibling bundle", () => {
  const base = fs.mkdtempSync(path.join(process.cwd(), ".reelos-tool-discovery-"));
  try {
    const project = path.join(base, "app");
    const filename = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    const tool = path.join(base, "tools", "bundle", "bin", filename);
    fs.mkdirSync(project, { recursive: true });
    fs.mkdirSync(path.dirname(tool), { recursive: true });
    fs.writeFileSync(tool, "fixture");
    assert.equal(findBundledMediaTool("ffmpeg", project), tool);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("local intelligence discovery requires a complete non-activated install receipt", () => {
  const base = fs.mkdtempSync(path.join(process.cwd(), ".reelos-model-discovery-"));
  const previous = process.env.REELOS_MODEL_PACK_DIR;
  try {
    const project = path.join(base, "app");
    const pack = path.join(base, "pack");
    const runtime = path.join(pack, "runtime.zip");
    const model = path.join(pack, "model.gguf");
    fs.mkdirSync(project, { recursive: true });
    fs.mkdirSync(pack, { recursive: true });
    fs.writeFileSync(runtime, "runtime");
    fs.writeFileSync(model, "model");
    fs.writeFileSync(path.join(pack, "install-receipt.json"), JSON.stringify({
      status: "downloaded_not_registered_or_activated", runtime: { path: runtime }, model: { path: model },
    }));
    process.env.REELOS_MODEL_PACK_DIR = pack;
    assert.deepEqual(findLocalIntelligencePack(project), { directory: pack, runtime, model });
    fs.rmSync(model);
    assert.equal(findLocalIntelligencePack(project), null);
  } finally {
    if (previous === undefined) delete process.env.REELOS_MODEL_PACK_DIR;
    else process.env.REELOS_MODEL_PACK_DIR = previous;
    fs.rmSync(base, { recursive: true, force: true });
  }
});
