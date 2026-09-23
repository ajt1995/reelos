import fs from "node:fs";
import path from "node:path";
import { after } from "node:test";
import { saveProfile } from "../services/profile-service.mjs";
import { getGateSecret, registerAuthorizedDevice, signDeviceToken } from "../services/reelos-gate-service.mjs";
import { replaceProfileSession } from "../services/profile-session-service.mjs";
import { createProviderValidation, writeProviderValidation } from "../services/source-access-policy.mjs";

// Real device and profile credentials, isolated from household state. Tests must
// opt in explicitly; ordinary mock requests remain unauthenticated.
export function createPlaybackFixture({ items = [], profile = { id: "adult", name: "Adult" } } = {}) {
  const stateDir = fs.mkdtempSync(path.join(process.cwd(), ".reelos-byte-access-"));
  const profilesDir = path.join(stateDir, "profiles");
  saveProfile(profile, profilesDir);
  const device = registerAuthorizedDevice({ activeProfileId: profile.id }, stateDir);
  const deviceCookie = `reelos_device_token=${signDeviceToken(device, getGateSecret(stateDir))}`;
  const session = replaceProfileSession({ headers: { cookie: deviceCookie } }, profilesDir, profile.id, device.id);
  const cookie = `${deviceCookie}; ${session.cookie.split(";")[0]}`;
  const writeLibrary = (titles) => fs.writeFileSync(path.join(stateDir, "library-shelf.json"), JSON.stringify({ titles }));
  const setProvider = (enabled) => {
    fs.writeFileSync(path.join(stateDir, "answers.json"), JSON.stringify({ apiKey: "fixture-key", source: "torbox" }));
    fs.writeFileSync(path.join(stateDir, "ui-settings.json"), JSON.stringify({ debridConnection: { provider: "torbox", enabled, status: enabled ? "connected" : "disabled" } }));
    if (enabled) writeProviderValidation(stateDir, createProviderValidation("torbox", "fixture-key", "fixture-account"));
  };
  writeLibrary(items);
  const options = { stateDir, profilesDir, presenceService: { roomPresence: new Map() } };
  after(() => fs.rmSync(stateDir, { recursive: true, force: true }));
  return { stateDir, profilesDir, options, cookie, device, writeLibrary, setProvider,
    authorize(req) { req.headers.cookie = cookie; return req; } };
}
