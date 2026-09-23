import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "scripts/reelos-lookup-plugin.mjs"), "utf8");
const world = readFileSync(join(root, "src/experience/reelos-world.tsx"), "utf8");

test("Settings autoUpdate write is best-effort and does not 500 the JSON", () => {
  assert.match(src, /function writeSystemdFile/);
  assert.match(src, /sudo.*-n.*tee/);
  const idx = src.indexOf("async function handleSettings");
  const chunk = src.slice(idx, src.indexOf("async function handlePorts", idx));
  assert.match(chunk, /writeFileSync\(uiSettingsPath/);
  assert.match(chunk, /try \{\s*if \("autoUpdate" in body\)/);
  assert.ok(
    chunk.indexOf("writeFileSync(uiSettingsPath") < chunk.indexOf('if ("autoUpdate" in body)'),
    "persist ui-settings.json before touching systemd",
  );
});

test("Check can target the beta channel sidecar", () => {
  assert.match(src, /channel-beta\.json/);
  assert.match(src, /betaChannel === true/);
  assert.match(src, /betaChannelStub/);
  assert.match(src, /channel: "beta"/);
  assert.match(src, /CHANNEL_BETA_URL/);
  assert.match(src, /reelos-org\/reelos\/main\/channel-beta\.json/);
});

test("jellyfinState reports native cinema engine active without legacy daemon dependencies", () => {
  const idx = src.indexOf("async function jellyfinState");
  assert.ok(idx >= 0);
  const chunk = src.slice(idx, src.indexOf("function saveAuthUrl", idx));
  assert.match(chunk, /ReelOS native cinema engine active/);
  assert.match(chunk, /readJellyfinVirtualFolders/);
  assert.match(chunk, /AbortSignal\.timeout\(4000\)/);
});

test("provider requests are rejected before queueing or dispatch when source access is off", () => {
  const idx = src.indexOf("async function handleRequest");
  const chunk = src.slice(idx, src.indexOf("async function handleDiscover", idx));
  assert.match(chunk, /sourcePolicyFromState/);
  assert.match(chunk, /canDispatchProviderRequest/);
  assert.match(chunk, /providerUnavailablePayload/);
  assert.ok(
    chunk.indexOf("canDispatchProviderRequest") < chunk.indexOf("isGuestPendingRequest"),
    "source policy must run before a guest request can enter the approval queue",
  );
});

test("provider requests can resolve a curated title and year through the live catalog", () => {
  const idx = src.indexOf("async function handleRequest");
  const chunk = src.slice(idx, src.indexOf("async function handleDiscover", idx));
  assert.match(chunk, /api\/v1\/search\?query=/);
  assert.match(chunk, /wantedYear/);
  assert.match(chunk, /mapSeerrSearchResults/);
});

test("debrid settings use server-side validation and do not accept client connection status", () => {
  const idx = src.indexOf("async function handleSettings");
  const chunk = src.slice(idx, src.indexOf("async function handlePorts", idx));
  assert.match(chunk, /pingWizardSource\(provider, key, undefined, \{ requireAccount: true \}\)/);
  assert.match(chunk, /writeProviderValidation/);
  assert.match(chunk, /publicUiSettings\(settings, sourcePolicy\)/);
  assert.match(chunk, /publicUiSettings\(next, sourcePolicy\)/);
  assert.match(chunk, /debridProvider : cur\.debridProvider/);
  assert.match(chunk, /atomicWriteJsonSync/);
  assert.match(chunk, /mode: 0o600/);
  assert.match(chunk, /next\.debridStatus = "connected"/);
  assert.doesNotMatch(chunk, /next\.debridStatus = body\.debridStatus/);
});

test("consumer setup advertises only the provider with a certified native path", () => {
  assert.match(world, /Connect TorBox/);
  assert.doesNotMatch(world, /Real-Debrid is validating locally/);
  assert.doesNotMatch(world, />Connect Real-Debrid</);
  assert.doesNotMatch(world, /option value="real-debrid"/);
});

test("disabling debrid schedules request cleanup without deleting library files", () => {
  const idx = src.indexOf("async function reconcileDisabledProvider");
  const chunk = src.slice(idx, src.indexOf("async function handleSettings", idx));
  assert.match(chunk, /cancelRequest/);
  assert.match(chunk, /removePendingGuestRequest/);
  assert.doesNotMatch(chunk, /removeLibraryTitle/);
  assert.match(src, /providerCleanup: cleanupScheduled \? "scheduled"/);
});

test("public readiness state never returns stored credentials", () => {
  const idx = src.indexOf("function publicAnswers");
  const chunk = src.slice(idx, src.indexOf("function withBudget", idx));
  assert.match(chunk, /delete out\.adminPassword/);
  assert.match(chunk, /delete out\.apiKey/);
  assert.match(chunk, /delete out\.tunnelToken/);
  assert.match(chunk, /delete out\.plexClaim/);
});
