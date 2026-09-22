import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createBackupSnapshot, generateBackupFileName, restoreBackupSnapshot, validateArchivePaths } from "./reelos-backup.mjs";

test("recovery filename and allowlist are portable", () => {
  assert.equal(generateBackupFileName(new Date("2026-09-21T14:30:45Z")), "reelos-recovery-20260921-143045Z.json");
  assert.equal(validateArchivePaths(["profiles/adult.json", "library-shelf.json"]).ok, true);
  for (const path of ["../etc/shadow", "/etc/passwd", "C:\\Windows\\system32", "answers.json", "providers/key.json"]) assert.equal(validateArchivePaths([path]).ok, false);
});

test("recovery export strips credentials, verifies checksums, and preserves overwritten state", () => {
  const root = mkdtempSync(join(tmpdir(), "reelos-recovery-"));
  try {
    const state = join(root, "state"); const backups = join(root, "backups"); const restored = join(root, "restored");
    mkdirSync(join(state, "profiles"), { recursive: true }); mkdirSync(restored);
    writeFileSync(join(state, "profiles", "adult.json"), JSON.stringify({ id: "adult", name: "Friend", pinHash: "secret", accessToken: "secret", tastes: ["noir"] }));
    writeFileSync(join(state, "answers.json"), JSON.stringify({ apiKey: "never-export" }));
    const created = createBackupSnapshot({ stateDir: state, backupDir: backups, targetFileName: "reelos-recovery-test.json" });
    assert.equal(created.ok, true); assert.equal(created.credentialsIncluded, false);
    const text = readFileSync(created.path, "utf8"); assert.doesNotMatch(text, /secret|never-export|answers\.json/);
    assert.equal(restoreBackupSnapshot({ archivePath: created.path, targetDir: restored }).code, "recovery_confirmation_required");
    mkdirSync(join(restored, "profiles"), { recursive: true });
    writeFileSync(join(restored, "profiles", "adult.json"), JSON.stringify({ id: "old" }));
    const result = restoreBackupSnapshot({ archivePath: created.path, targetDir: restored, confirmed: true, now: new Date("2026-09-21T15:00:00Z") });
    assert.equal(result.ok, true); assert.deepEqual(JSON.parse(readFileSync(join(restored, "profiles", "adult.json"))), { id: "adult", name: "Friend", tastes: ["noir"] });
    assert.deepEqual(JSON.parse(readFileSync(join(result.previousState, "profiles", "adult.json"))), { id: "old" });
    const bundle = JSON.parse(text); bundle.entries[0].content = Buffer.from("{}").toString("base64"); writeFileSync(join(root, "tampered.json"), JSON.stringify(bundle));
    assert.equal(restoreBackupSnapshot({ archivePath: join(root, "tampered.json"), targetDir: restored, confirmed: true }).ok, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
