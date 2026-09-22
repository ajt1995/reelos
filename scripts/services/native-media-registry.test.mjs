import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NativeMediaRegistry } from "./native-media-registry.mjs";

const fixtures = [];
const fixture = () => {
  const dir = fs.mkdtempSync(path.join(process.cwd(), ".reelos-registry-test-"));
  fixtures.push(dir);
  return dir;
};
test.after(() => fixtures.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));
const receipt = { sizeBytes: 42, fingerprint: "a".repeat(64) };

test("native registry publishes only verified exact sources", () => {
  const registry = new NativeMediaRegistry({ stateDir: fixture() });
  assert.throws(() => registry.register({ workId: "tmdb-1", editionId: "edition-a", source: { id: "bad", kind: "personal_import", verified: false, fileReceipt: receipt } }), /Unverified/);
  const item = registry.register({ workId: "tmdb-1", editionId: "edition-a", title: "Film", source: { id: "local-a", kind: "personal_import", verified: true, fileReceipt: receipt } });
  assert.equal(registry.publicProjection(item).ready, true);
  assert.deepEqual(registry.publicProjection(item).sourceKinds, ["personal_import"]);
  assert.equal(JSON.stringify(registry.publicProjection(item)).includes("fileReceipt"), false);
});

test("provider revocation hides only provider projections", () => {
  const registry = new NativeMediaRegistry({ stateDir: fixture() });
  const item = registry.register({ workId: "tmdb-2", editionId: "edition-b", source: { id: "provider-a", kind: "provider_stream", provider: "torbox", verified: true, binding: { opaque: "private" } } });
  assert.equal(registry.publicProjection(item, { canAccessProvider: () => true }).ready, true);
  assert.equal(registry.revokeProvider("torbox"), 1);
  const revoked = registry.get(item.itemId);
  assert.equal(registry.publicProjection(revoked, { canAccessProvider: () => true }).ready, false);
});

test("registry refuses alias ambiguity", () => {
  const registry = new NativeMediaRegistry({ stateDir: fixture() });
  registry.register({ itemId: "one", workId: "tmdb-3", editionId: "edition-1", aliases: ["shared"], source: { id: "a", kind: "personal_import", verified: true, fileReceipt: receipt } });
  registry.register({ itemId: "two", workId: "tmdb-4", editionId: "edition-2", aliases: ["shared"], source: { id: "b", kind: "personal_import", verified: true, fileReceipt: receipt } });
  assert.equal(registry.get("shared"), null);
});
