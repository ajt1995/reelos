import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { annotateVerifiedLibraryOriginals } from "./library-api-service.mjs";
import { saveProfile } from "./profile-service.mjs";
import { registerAuthorizedDevice, signDeviceToken, getGateSecret } from "./reelos-gate-service.mjs";
import { replaceProfileSession } from "./profile-session-service.mjs";

describe("authoritative original annotations on public library metadata", () => {
  let stateDir, profilesDir, mediaFile, item, req, options;
  beforeEach(() => {
    stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "library-original-annotation-"));
    profilesDir = path.join(stateDir, "profiles");
    mediaFile = path.join(stateDir, "original.mp4");
    fs.writeFileSync(mediaFile, "local original fixture bytes");
    saveProfile({ id: "owner", name: "Owner", role: "owner" }, profilesDir);
    const device = registerAuthorizedDevice({ name: "Test", activeProfileId: "owner" }, stateDir);
    req = { method: "GET", url: "/api/library", headers: { host: "localhost" }, socket: { remoteAddress: "127.0.0.1" } };
    const session = replaceProfileSession(req, profilesDir, "owner", device.id);
    req.headers.cookie = `reelos_device_token=${signDeviceToken(device, getGateSecret(stateDir))}; reelos_profile_session=${session.token}`;
    item = { id: "personal-a", jellyfinId: "file-a", type: "movie", path: mediaFile, sourceKind: "personal_import", OfficialRating: "G" };
    options = { stateDir, profilesDir, libraryItems: [item], presenceService: { roomPresence: new Map() } };
  });
  afterEach(() => fs.rmSync(stateDir, { recursive: true, force: true }));

  it("annotates only independently resolved authorized local originals without exposing paths or receipts", () => {
    const input = { id: item.id, title: "Original", jellyfinId: "file-a", sourceKind: "forged", sourceVerified: true,
      path: "private path", Path: "another private path", source: { path: "private source path" }, file: { ino: "private receipt" }, fileVersion: "private fingerprint", pins: { owner: true } };
    assert.deepEqual(annotateVerifiedLibraryOriginals(req, [input], options), [{
      id: item.id, title: "Original", jellyfinId: "file-a", sourceKind: "personal_import", sourceVerified: true,
    }]);
    assert.equal(input.sourceKind, "forged", "cached input must not be mutated");
    assert.equal(input.path, "private path");
    options.libraryItems = [{ ...item, sourceKind: "public_domain" }];
    assert.equal(annotateVerifiedLibraryOriginals(req, [input], options)[0].sourceKind, "public_domain");
  });

  it("unknown, provider, retained and conflicting authoritative kinds cannot masquerade as originals", () => {
    for (const original of [
      { ...item, sourceKind: undefined }, { ...item, sourceKind: "debrid" },
      { ...item, sourceKind: "retained_local" }, { ...item, sourceKind: "public_catalog" },
      { ...item, sourceKind: "personal_import", source: { kind: "debrid" } },
    ]) {
      options.libraryItems = [original];
      assert.deepEqual(annotateVerifiedLibraryOriginals(req, [{ id: item.id, title: "Claim", sourceKind: "personal_import", sourceVerified: true }], options), [{ id: item.id, title: "Claim" }]);
    }
  });

  it("missing files, missing mappings and unauthenticated requests cannot reuse cached verified claims", () => {
    const input = { id: item.id, title: "Claim", sourceKind: "public_domain", sourceVerified: true };
    assert.deepEqual(annotateVerifiedLibraryOriginals({ ...req, headers: { host: "localhost" } }, [input], options), [{ id: item.id, title: "Claim" }]);
    options.libraryItems = [];
    assert.deepEqual(annotateVerifiedLibraryOriginals(req, [input], options), [{ id: item.id, title: "Claim" }]);
    options.libraryItems = [{ ...item, path: path.join(stateDir, "missing.mp4") }];
    assert.deepEqual(annotateVerifiedLibraryOriginals(req, [input], options), [{ id: item.id, title: "Claim" }]);
  });

  it("aggregate, ambiguous and projected files remain unverified shelf entries", () => {
    const input = { id: item.id, title: "Claim", sourceKind: "personal_import", sourceVerified: true };
    for (const entries of [[{ ...item, type: "series" }], [item, { ...item }], [{ ...item, path: path.join(stateDir, "projections", "copy.mp4") }]]) {
      options.libraryItems = entries;
      assert.deepEqual(annotateVerifiedLibraryOriginals(req, [input], options), [{ id: item.id, title: "Claim" }]);
    }
  });
});
