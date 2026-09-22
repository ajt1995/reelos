import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  LOCAL_INTELLIGENCE_PACK,
  downloadVerifiedArtifact,
  installLocalIntelligencePack,
  resolveLocalModelPackDirectory,
} from "./install-local-intelligence-pack.mjs";

const digest = (body) => createHash("sha256").update(body).digest("hex");
const testRoot = join(resolve(import.meta.dirname, ".."), ".reelos-test-tmp");
function temporaryDirectory(prefix) {
  mkdirSync(testRoot, { recursive: true });
  return mkdtempSync(join(testRoot, prefix));
}
const artifact = (id, fileName, body, kind) => ({ id, kind, fileName, url: `https://fixture.invalid/${fileName}`,
  byteSize: body.length, sha256: digest(body), license: { id: "Apache-2.0", noticeUrl: "https://fixture.invalid/LICENSE" } });

function fixturePack() {
  const runtimeBody = Buffer.from("fixture runtime archive");
  const modelBody = Buffer.from("fixture model");
  return { runtime: artifact("fixture-runtime", "runtime.zip", runtimeBody, "runtime"), model: artifact("fixture-model", "model.gguf", modelBody, "model"), bodies: new Map([["runtime.zip", runtimeBody], ["model.gguf", modelBody]]) };
}

function fakeFetch(bodies, calls) {
  return async (url) => {
    calls.push(url);
    const body = [...bodies.entries()].find(([name]) => url.includes(name))?.[1];
    return body ? new Response(body, { status: 200, headers: { "content-length": String(body.length) } }) : new Response("missing", { status: 404 });
  };
}

test("model-pack pins remain explicit and external by default", () => {
  assert.equal(LOCAL_INTELLIGENCE_PACK.runtime.sha256, "33f941a74b8db38e92690f5f151a770ef5a66481c07dabfe2e505b57e3546807");
  assert.equal(LOCAL_INTELLIGENCE_PACK.model.revision, "91cad51170dc346986eccefdc2dd33a9da36ead9");
  assert.equal(LOCAL_INTELLIGENCE_PACK.model.license.id, "Apache-2.0");
  assert.equal(resolveLocalModelPackDirectory({ platform: "win32", home: "C:\\Users\\fixture", env: { LOCALAPPDATA: "C:\\State" } }), "C:\\State\\ReelOS\\model-packs");
  assert.throws(() => resolveLocalModelPackDirectory({ env: { REELOS_MODEL_PACK_DIR: "relative" } }), { code: "model_pack_directory_invalid" });
});

test("model-pack installation is atomically verified, idempotent, and never activates a model", async (t) => {
  const root = temporaryDirectory("reelos-model-pack-");
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const fx = fixturePack();
  const calls = [];
  const unpackZip = (_archive, destination) => {
    const bin = join(destination, "bin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, process.platform === "win32" ? "llama-cli.exe" : "llama-cli"), "fixture runtime");
  };
  const options = { packDir: root, platform: "win32", artifacts: fx, fetchImpl: fakeFetch(fx.bodies, calls), unpackZip };
  const first = await installLocalIntelligencePack(options);
  assert.equal(first.status, "downloaded_not_registered_or_activated");
  assert.equal(calls.length, 2);
  assert.ok(existsSync(first.model.path));
  assert.ok(existsSync(first.runtime.executable));
  assert.equal(existsSync(join(root, "intelligence", "artifact-registry.json")), false);
  const receipt = JSON.parse(readFileSync(join(root, "install-receipt.json"), "utf8"));
  assert.match(receipt.nextStep, /verification, and evaluation/);
  await installLocalIntelligencePack(options);
  assert.equal(calls.length, 2, "valid artifacts are reused without a new network request");
});

test("a bad download never becomes a visible artifact", async (t) => {
  const root = temporaryDirectory("reelos-model-download-");
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const body = Buffer.from("wrong bytes");
  const expected = artifact("fixture", "fixture.bin", Buffer.from("right bytes"), "model");
  const target = join(root, "fixture.bin");
  await assert.rejects(() => downloadVerifiedArtifact({ artifact: expected, target, fetchImpl: async () => new Response(body, { status: 200 }) }), { code: "model_pack_hash_mismatch" });
  assert.equal(existsSync(target), false);
});
