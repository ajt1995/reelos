import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const tree = fs.readdirSync(path.join(root, "app/src/main/java"), { recursive: true })
  .filter((name) => name.endsWith(".kt"))
  .map((name) => fs.readFileSync(path.join(root, "app/src/main/java", name), "utf8"))
  .join("\n");
const manifest = fs.readFileSync(path.join(root, "app/src/main/AndroidManifest.xml"), "utf8");
const mobilePlayer = fs.readFileSync(path.join(root, "app/src/main/java/com/reelos/ui/mobile/MobilePlayerActivity.kt"), "utf8");
const projectRoot = path.resolve(root, "../..");
const sharedUi = ["src/experience/reelos-world.tsx", "src/routes/__root.tsx", "scripts/build-android-shared-ui.mjs"]
  .map((name) => fs.readFileSync(path.join(projectRoot, name), "utf8"))
  .join("\n");

test("Android stays on the shared ReelOS spine and never becomes a direct-provider fork", () => {
  assert.doesNotMatch(tree, /torbox|real[-_ ]?debrid|debridApiKey|standalone cloud/i);
  assert.match(tree, /api\/gate\/pair-lan/);
  assert.match(tree, /reelos_device_token/);
  assert.match(tree, /reelos_profile_session/);
  assert.match(tree, /SharedReelOsActivity/);
  assert.match(tree, /path\.startsWith\("reelos\/"\)/);
  assert.match(tree, /"reelos\/assets\/\$path"/);
  assert.match(tree, /asset\("reelos\/\$path"/);
  assert.match(tree, /NATIVE_BACK_BRIDGE/);
  assert.match(sharedUi, /aria-label="Search ReelOS"/);
  assert.doesNotMatch(tree, /\$\{path\.take\(120\)\} is not available/);
  assert.match(sharedUi, /reelos-world/);
});

test("Android bundles the same generated ReelOS world and runs as a local node", () => {
  assert.match(sharedUi, /\.vercel[\s\S]*output[\s\S]*static/);
  assert.match(sharedUi, /server\.fetch\(new Request/);
  assert.match(tree, /appassets\.androidplatform\.net/);
  assert.match(tree, /sharedComputeStage/);
  assert.match(tree, /homeOptional/);
  assert.match(tree, /native_capability_unavailable/);
  assert.match(tree, /REELOS_MESH_BEACON/);
  assert.match(tree, /schemaVersion", 1/);
  assert.match(tree, /\/api\/grid\/capabilities/);
  assert.match(tree, /Real-device playback evidence is pending/);
  assert.match(tree, /Android transcoding has not passed the measured safety gate/);
  assert.match(tree, /StandaloneNodeApi/);
  assert.match(tree, /__REELOS_NATIVE_FETCH_INSTALLED__/);
  assert.match(tree, /\/api\/library/);
  assert.match(tree, /\/api\/media\/\[\^\/\]\+\/sources/);
  assert.match(tree, /\/api\/capabilities/);
});

test("standalone Android persists profiles, progress, settings, and personal media truth", () => {
  assert.match(tree, /reelos_standalone_media/);
  assert.match(tree, /putString\("profiles"/);
  assert.match(tree, /putString\("progress"/);
  assert.match(tree, /putString\("settings"/);
  assert.match(tree, /sourceKind", "personal_import"/);
  assert.match(tree, /sourceVerified", true/);
  assert.doesNotMatch(tree, /sourceVerified", true[\s\S]{0,200}provider_stream/);
});

test("catalog and streams cross an authenticated same-origin boundary", () => {
  assert.match(tree, /header\("Cookie"/);
  assert.match(tree, /HouseholdEndpoint\.sameOrigin/);
  assert.doesNotMatch(tree, /api\/stream\/sample|videos\/sample\.mp4/);
});

test("APK updates require origin, digest, and installed signer continuity", () => {
  assert.match(tree, /Update APK must come from the paired ReelOS server/);
  assert.match(tree, /MessageDigest\.getInstance\("SHA-256"\)/);
  assert.match(tree, /not signed by the installed ReelOS identity/);
  assert.match(tree, /authenticatedRequest\(endpoint, credential\)/);
  assert.match(tree, /authenticatedRequest\(download, preferences\.deviceCookie\)/);
  assert.match(tree, /\^reelos_device_token=/);
  assert.doesNotMatch(tree, /api\/app\/version[^\n]{0,300}Authorization/);
});

test("manual update actions are reachable on mobile and TV", () => {
  assert.match(tree, /OtaUpdateManager/);
  assert.match(tree, /checkForUpdate\(/);
  assert.match(tree, /downloadAndInstall\(/);
  assert.match(sharedUi, /ReelOSWorld/);
  assert.match(sharedUi, /nativePlatform\(\) === "android-tv"/);
  assert.match(sharedUi, /id !== "books"/);
});

test("phone and TV retain subtitles and volume leveling", () => {
  assert.match(tree, /setSubtitleEnabled/);
  assert.match(tree, /DynamicsProcessing/);
  assert.match(tree, /Volume leveling/);
  assert.match(tree, /KEYCODE_CAPTIONS/);
});

test("phone playback uses native touch controls and preserves progress across lifecycle changes", () => {
  assert.match(mobilePlayer, /controllerShowTimeoutMs = 3_000/);
  assert.match(mobilePlayer, /setShowSubtitleButton\(true\)/);
  assert.match(mobilePlayer, /setAutoEnterEnabled\(true\)/);
  assert.match(mobilePlayer, /override fun onStop\(\)/);
  assert.match(mobilePlayer, /playbackReporter\.launch/);
  assert.doesNotMatch(mobilePlayer, /onDestroy\(\)[\s\S]{0,350}lifecycleScope\.launch/);
  assert.match(mobilePlayer, /playbackSnapshot\(\)/);
  assert.match(tree, /SOFT_INPUT_ADJUST_RESIZE/);
});

test("Android TV uses deterministic D-pad navigation without blocking reads on the UI thread", () => {
  assert.match(tree, /TV_NAVIGATION_BRIDGE/);
  assert.match(tree, /reelos-native-tv/);
  assert.match(tree, /animation: reelos-tv-aura 12s steps\(24, end\)/);
  assert.match(tree, /reelos-endless-taste-bubble img[\s\S]*animation: none/);
  assert.match(tree, /scrollIntoView\(\{ block: 'center', inline: 'center', behavior: 'auto' \}\)/);
  assert.match(tree, /addEventListener\('keydown',[\s\S]*event\.stopImmediatePropagation/);
  assert.match(tree, /MutationObserver/);
  assert.match(tree, /method === 'GET' \|\| method === 'HEAD'/);
  assert.match(tree, /return networkFetch\(input, init\)/);
  assert.match(tree, /setRendererPriorityPolicy\(WebView\.RENDERER_PRIORITY_IMPORTANT, false\)/);
  assert.match(tree, /View\.OVER_SCROLL_NEVER/);
  assert.match(tree, /max-age=31536000, immutable/);
  assert.match(tree, /webView\.onPause\(\)/);
  assert.match(tree, /webView\.destroy\(\)/);
  assert.match(tree, /←\/→ Seek 10s · OK Play\/Pause/);
});

test("credentials are excluded from Android backup and pairing links", () => {
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:scheme="reelos" android:host="pair"/);
});
