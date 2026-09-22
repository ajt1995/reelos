import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ChildProfileService } from "./child-profile-service.mjs";

function withTempService(run) {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-child-policy-"));
  try {
    return run(new ChildProfileService({ stateDir }), stateDir);
  } finally {
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
}

test("does not invent a default child, PIN, or catalog", () => {
  withTempService((service) => {
    assert.equal(service.profiles.size, 0);
    assert.deepEqual(service.filterCatalogForChild("missing", [{ id: "movie" }]), []);
  });
});

test("persists learned boundaries without persisting a plaintext PIN", () => {
  withTempService((service, stateDir) => {
    const result = service.calibrateChildProfile("kid-1", {
      name: "Kid",
      maturityPreset: "big_kids",
      pin: "4321",
      matchGameResponses: [{ cardId: "scare_monsters", reaction: "block" }],
    });
    assert.equal(result.ok, true);
    assert.equal("pin" in result.profile, false);
    const disk = fs.readFileSync(path.join(stateDir, "child-profiles.json"), "utf8");
    assert.equal(disk.includes("4321"), false);
  });
});

test("migrates a legacy boundary file by stripping plaintext PIN data", () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-child-policy-"));
  try {
    fs.writeFileSync(
      path.join(stateDir, "child-profiles.json"),
      JSON.stringify([{ id: "legacy", name: "Legacy", pin: "1234" }]),
    );
    const service = new ChildProfileService({ stateDir });
    assert.equal("pin" in service.profiles.get("legacy"), false);
    assert.equal(
      fs.readFileSync(path.join(stateDir, "child-profiles.json"), "utf8").includes("1234"),
      false,
    );
  } finally {
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});

test("presence updates are honest about pending playback enforcement", () => {
  withTempService((service) => {
    const result = service.setRoomPresence("tv", {
      kidsPresent: true,
      childProfileIds: [" kid-1 ", "kid-1", "kid-2"],
    });
    assert.equal(result.policyUpdated, true);
    assert.equal(result.playbackEnforcement, "awaiting-session-adapter");
    assert.deepEqual(result.state.childProfileIds, ["kid-1", "kid-2"]);
    assert.equal("instantStreamUpdate" in result, false);
  });
});
