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

test("shared native save control can remove unavailable saved titles", () => {
  // Structural guard only; source revocation and remote input still need runtime tests.
  const screen = read("clients/native/shared-ui/src/commonMain/kotlin/com/reelos/ui/NativeScreen.kt");
  const bridge = read("clients/native/presentation/src/main/kotlin/com/reelos/presentation/NativeExperience.kt");
  assert.match(screen, /if \(media\.saved \|\| media\.action == UiAction\.PLAY\)/);
  assert.match(screen, /if \(media\.action == UiAction\.PLAY\) \{\s*ReelButton\(if \(media\.positionMs > 0\) "Resume" else "Play"/);
  assert.ok(bridge.includes('positionMs = profile?.playbackPositionsMs?.get(item.id) ?: 0L'));
  assert.match(bridge, /if \(event\.saved\) \{\s*check\(core\.mediaAction\(event\.id\)/);
  assert.match(bridge, /event\.id in core\.snapshot\.profiles\.getValue\(activeId\)\.savedMediaIds/);
  assert.match(screen, /\.clickable\(enabled = enabled, role = Role\.Button, onClick = onClick\)/);
  assert.doesNotMatch(screen, /\.focusable\(enabled = enabled\)/);
  assert.match(screen, /UiAction\.PLAY -> "On this device"/);
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
  for (const suffix of ["/ReelCoreTest.kt", "/CoreSmoke.kt", "/LocalLearningTest.kt", "/NativeTasteCoordinatorTest.kt", "/NativeTasteIntegrationTest.kt", "/AppearanceCoreTest.kt", "/NativeTasteCatalogTest.kt", "/DesktopMotionPolicyTest.kt", "/LocalPlaybackSessionTest.kt"]) {
    const entry = inventory.tests.find((candidate) => candidate.file.endsWith(suffix));
    assert.ok(entry, `Missing test inventory entry: ${suffix}`);
    assert.equal(entry.disposition, "targeted");
  }
  assert.deepEqual(inventory.unclassified, []);
});

test("native package identity and hardware provenance include canonical VERSION and source bytes", () => {
  // Structural guard; the physical runner independently checks actual hashes before install.
  const build = read("clients/native/build.gradle.kts");
  const android = read("clients/native/android/build.gradle.kts");
  const runner = read("scripts/test-native-android-hardware.ps1");
  assert.match(build, /resolve\("\.\.\/\.\.\/VERSION"\)/);
  assert.match(build, /sourceDigest\.update\(it\.readBytes\(\)\)/);
  assert.match(android, /dependsOn\("assembleDebug", "assembleDebugAndroidTest"\)/);
  assert.match(android, /"productVersionSha256" to digest\(rootProject\.rootDir\.resolve\("\.\.\/\.\.\/VERSION"\)\)/);
  assert.match(runner, /\$buildEvidence\.productVersionSha256 -ne \$result\.productVersionSha256/);
  assert.match(runner, /\$buildEvidence\.appSha256 -ne \$result\.appSha256/);
  assert.match(runner, /\$buildEvidence\.testApkSha256 -ne \$result\.testApkSha256/);
  assert.match(runner, /\$sourceFiles\.Count -ne \$declared\.Count/);
  assert.match(runner, /\$actual -ne \$expected\.Value/);
  assert.ok(runner.indexOf('$actual -ne $expected.Value') < runner.indexOf('install -r $apk'));
  assert.doesNotMatch(runner, /LastWriteTimeUtc/);
  assert.ok(build.includes('"**/*.tsv"'));
  assert.ok(android.includes('"**/*.tsv"'));
  assert.ok(runner.includes("'.tsv'"));
});

test("native calibration metadata is separate from playable media and excludes books on TV", () => {
  // Boundary guard, not a claim of visual or recommendation-quality acceptance.
  const bridge = read("clients/native/presentation/src/main/kotlin/com/reelos/presentation/NativeExperience.kt");
  const field = read("clients/native/shared-ui/src/commonMain/kotlin/com/reelos/ui/NativeTasteField.kt");
  const subjects = read("clients/native/core/src/main/kotlin/com/reelos/core/intelligence/NativeTasteCatalog.kt");
  assert.ok(bridge.includes("NativeTasteCatalog.subjects(includeBooks = core.deviceKind != DeviceKind.ANDROID_TV)"));
  assert.ok(bridge.includes("UiTasteSubject(item.id"));
  assert.ok(field.includes("model.tasteSubjects"));
  assert.ok(field.includes('if (columns == 1) 2 else 1'));
  assert.doesNotMatch(subjects, /MediaRecord\(/);
  assert.doesNotMatch(field, /UiEvent\.(Save|Play)\(/);
  assert.doesNotMatch(field, /ReelButton\("(More|Next batch)"/);
});

test("personal navigation resets entry scroll and appearance controls send only field changes", () => {
  // Structural guards; installed native interaction evidence remains separately required.
  const screen = read("clients/native/shared-ui/src/commonMain/kotlin/com/reelos/ui/NativeScreen.kt");
  const personal = read("clients/native/shared-ui/src/commonMain/kotlin/com/reelos/ui/PersonalView.kt");
  assert.ok(screen.includes("remember(model.profileId, model.step, destination, advancedOpen) { LazyListState() }"));
  assert.ok(screen.includes("state = destinationScroll"));
  assert.ok(personal.includes("UiEvent.Appearance(motion = value)"));
  assert.ok(personal.includes("UiEvent.Appearance(density = value)"));
  assert.ok(personal.includes("UiEvent.Appearance(toggleTransparency = true)"));
});

test("fresh native journey uses visible setup and import controls instead of seeded completion", () => {
  const checks = read("clients/native/android/src/androidTest/kotlin/com/reelos/nativepreview/NativePersonalUiChecks.kt");
  const fresh = checks.slice(checks.indexOf("fun runFreshJourney()"), checks.indexOf("check(host.targetContext.packageName"));
  assert.ok(fresh.includes('ACTION_SET_TEXT'));
  assert.ok(fresh.includes('click("Continue on this device")'));
  assert.ok(fresh.includes('click("Add video")'));
  assert.ok(fresh.includes('click("Play")'));
  assert.ok(fresh.includes('getDeclaredField("hasRenderedFrame")'));
  assert.doesNotMatch(fresh, /core\.(createProfile|setColor|acknowledgeCurator|finishTaste|chooseHome|putMedia)/);
  assert.doesNotMatch(fresh, /getDeclaredMethod\("importVideo"/);
  const runner = read("scripts/test-native-android-hardware.ps1");
  for (const name of ['fresh-identity-and-back', 'fresh-color-and-guidance', 'fresh-taste-and-restart', 'fresh-standalone-and-empty-home', 'fresh-completed-restart', 'fresh-import-requires-confirmation', 'fresh-confirmed-import-and-save', 'fresh-ui-playback-and-return', 'fresh-ui-resume']) {
    assert.ok(runner.includes(name));
    assert.ok(fresh.includes(name));
  }
  assert.ok(runner.includes('.reelos-audit/native-first-run/'));
  assert.ok(checks.includes('cleanupPendingImport()'));
  assert.ok(checks.includes('it.fd.sync()'));
  assert.doesNotMatch(checks, /host\.waitForIdleSync\(/);
});

test("both native players enforce the shared continuity guard and TV checks cannot omit revocation", () => {
  for (const file of ["clients/native/android/src/main/kotlin/com/reelos/nativepreview/PlaybackActivity.kt", "clients/native/desktop/src/main/kotlin/com/reelos/desktop/Main.kt"]) {
    const source = read(file);
    assert.ok(source.includes("LocalPlaybackSession.open("));
    assert.ok(source.includes(".isAllowed("));
    assert.ok(source.includes("delay(1_000)"));
  }
  const runner = read("scripts/test-native-android-hardware.ps1");
  assert.ok(runner.includes("active-playback-stops-after-source-revocation"));
  assert.ok(runner.includes("active-playback-stops-after-profile-switch"));
});
