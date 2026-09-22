import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { MachineOverseer } from "./machine-overseer-service.mjs";

describe("machine-overseer-service", () => {
  it("enforces the strict TorBox Air-Gap Boundary by stripping credentials and download keys", () => {
    const overseer = new MachineOverseer();
    const taintedContext = {
      modelRequest: "Analyze system diagnostics",
      torboxToken: "SECRET_TORBOX_API_KEY_DO_NOT_LEAK",
      torbox_key: "abc123xyz",
      systemLogs: ["Jellyfin shim active", "Stream socket ready"],
      nested: {
        torboxDownloadId: 48921,
        title: "The Matrix",
      },
    };

    const sanitized = overseer.sanitizeContext(taintedContext);
    assert.equal(sanitized.torboxToken, undefined);
    assert.equal(sanitized.torbox_key, undefined);
    assert.equal(sanitized.nested.torboxDownloadId, undefined);
    assert.equal(sanitized.nested.title, "The Matrix");
    assert.equal(sanitized.systemLogs.length, 2);
  });

  it("enforces the Leash Constraint requiring signed manifests for model updates", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-leash-test-"));
    const modelsDir = path.join(tmpDir, "distilled-models");
    fs.mkdirSync(modelsDir, { recursive: true });

    const manifest = {
      models: {
        "overseer-v2": {
          sha256:
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          signedByCore: true,
        },
        "untrusted-model": {
          sha256: "deadbeef",
          signedByCore: false,
        },
      },
    };
    fs.writeFileSync(
      path.join(modelsDir, "manifest.json"),
      JSON.stringify(manifest),
    );

    const unsignedOverseer = new MachineOverseer({ stateDir: tmpDir });
    assert.equal(
      unsignedOverseer.verifyModelManifest(
        "overseer-v2",
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      ),
      false,
    );
    const overseer = new MachineOverseer({
      stateDir: tmpDir,
      manifestVerifier: ({ record }) => record.signedByCore === true,
    });
    assert.equal(
      overseer.verifyModelManifest(
        "overseer-v2",
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      ),
      true,
    );
    assert.equal(
      overseer.verifyModelManifest("untrusted-model", "deadbeef"),
      false,
    );
    assert.equal(overseer.verifyModelManifest("non-existent", "any"), false);
  });

  it("allocates resources per Austin's Zero Eyebrows and safe 32MB-64MB stealth floor", () => {
    const overseerShared = new MachineOverseer({ isDedicated: false });
    const alloc = overseerShared.resolveAllocation();
    assert.equal(alloc.tier, "shared_pc");
    assert.equal(alloc.stealthFloorMB, 64);
    assert.equal(alloc.baselineIdleMB, 128);

    overseerShared.setYieldState(true);
    assert.equal(overseerShared.checkActiveUserYield(), true);

    const gib = 1024 ** 3;
    const overseerDedicated = new MachineOverseer({
      isDedicated: true,
      totalMemoryBytes: 4 * gib,
      freeMemoryBytes: () => 3 * gib,
    });
    const allocDed = overseerDedicated.resolveAllocation();
    assert.equal(allocDed.systemBudgetMB, 3072);
    assert.equal(allocDed.systemHeadroomMB, 1024);
    assert.equal(allocDed.maxAllocMB, 768);
    assert.equal(allocDed.budgetScope, "model-within-system");
    assert.equal(allocDed.modelSize, null);
    assert.equal(allocDed.adapterRequired, true);
    assert.equal(overseerDedicated.checkActiveUserYield(), false);
  });
});
