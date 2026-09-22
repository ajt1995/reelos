import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NativeMediaRegistry } from "./native-media-registry.mjs";
import { ensureBuiltinPublicCinema } from "./native-library-bootstrap.mjs";

const dirs = [];
test.after(() => dirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

test("verified public cinema is automatic and idempotent", () => {
  const stateDir = fs.mkdtempSync(path.join(process.cwd(), ".reelos-public-bootstrap-"));
  dirs.push(stateDir);
  const registry = new NativeMediaRegistry({ stateDir });
  assert.ok(ensureBuiltinPublicCinema(registry) >= 4);
  assert.equal(ensureBuiltinPublicCinema(registry), 0);
  const items = registry.list();
  assert.ok(items.every((item) => item.sources[0].kind === "public_domain"));
  assert.ok(items.every((item) => item.sources[0].uri.startsWith("https://archive.org/")));
});
