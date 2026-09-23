import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildTestInventory } from "./test-inventory.mjs";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("independent native UX audit retains every existing UI acceptance ID", () => {
  const ledger = JSON.parse(read("docs/feature-acceptance.json"));
  const ids = ledger.requirements.map((requirement) => requirement.id);
  assert.equal(ids.length, 47);
  const audit = read("docs/native-ui-ux-audit.md");
  const rows = [...audit.matchAll(/^\| `(ui-[a-z0-9-]+)` \|/gm)].map((match) => match[1]);
  assert.deepEqual(rows.sort(), ids.sort());
  assert.match(audit, /not.*installed-device review/);
});

test("both native hosts consume the same core, presentation and Compose UI", () => {
  // Both hosts import MaterialTheme from the shared UI's exported Compose runtime.
  assert.match(read("clients/native/shared-ui/build.gradle.kts"), /api\(compose\.material3\)/);
  for (const platform of ["desktop", "android"]) {
    const build = read(`clients/native/${platform}/build.gradle.kts`);
    assert.match(build, /project\(":core"\)/);
    assert.match(build, /project\(":shared-ui"\)/);
    assert.match(build, /presentation\/src\/main\/kotlin/);
    assert.doesNotMatch(build, /webkit|build-android-shared-ui|chromium/i);
  }
});

test("Android host declares system and keyboard insets inside a themed surface", () => {
  // Structural regression only; physical keyboard/posture acceptance remains separate.
  const host = read("clients/native/android/src/main/kotlin/com/reelos/nativepreview/MainActivity.kt");
  assert.match(host, /Surface\(modifier = Modifier\.fillMaxSize\(\)\)/);
  assert.match(host, /Column\(Modifier\.safeDrawingPadding\(\)\.imePadding\(\)\)/);
});

test("validation Android app cannot replace household installation or claim release signing", () => {
  const build = read("clients/native/android/build.gradle.kts");
  assert.match(build, /applicationId = "com\.reelos\.nativepreview"/);
  assert.match(build, /not an accepted or signed consumer release/);
  const manifest = read("clients/native/android/src/main/AndroidManifest.xml");
  assert.doesNotMatch(manifest, /android\.permission\.INTERNET/);
  assert.match(manifest, /PlaybackActivity" android:exported="false"/);
  assert.match(manifest, /android:allowBackup="false"/);
});

test("new native Kotlin tests cannot disappear from the test inventory", () => {
  const inventory = buildTestInventory();
  for (const suffix of ["/ReelCoreTest.kt", "/CoreSmoke.kt"]) {
    const entry = inventory.tests.find((candidate) => candidate.file.endsWith(suffix));
    assert.ok(entry, `Missing test inventory entry: ${suffix}`);
    assert.equal(entry.disposition, "targeted");
  }
  assert.deepEqual(inventory.unclassified, []);
});
