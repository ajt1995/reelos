#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrapReleaseTrust } from "./release-trust.mjs";
import { applySignedUpdate } from "./signed-update.mjs";
import { createBackupSnapshot, restoreBackupSnapshot } from "./reelos-backup.mjs";

function options(argv) {
  const found = {};
  for (let i = 0; i < argv.length; i += 1) if (argv[i].startsWith("--")) found[argv[i].slice(2)] = argv[i + 1]?.startsWith("--") ? true : argv[++i] ?? true;
  return found;
}
function required(value, name) { if (!value || value === true) throw Object.assign(new Error(`--${name} is required.`), { code: "argument_required" }); return resolve(String(value)); }

export async function runReleaseTool(argv = process.argv.slice(2), env = process.env) {
  const [command] = argv; const args = options(argv.slice(1));
  const stateDir = resolve(String(args.state || env.REELOS_STATE || (process.platform === "win32" ? ".reelos-state" : "/var/lib/reelos")));
  const installDir = resolve(String(args.install || env.REELOS_ROOT || (process.platform === "win32" ? ".reelos-install" : "/opt/reelos")));
  if (command === "trust-bootstrap") return bootstrapReleaseTrust({ publicKeyPath: required(args.key, "key"), trustStorePath: resolve(stateDir, "release-trust.json"), expectedFingerprint: String(args.fingerprint || ""), confirmed: args.confirm === "I-TRUST-THIS-KEY" });
  if (command === "apply") {
    const manifest = JSON.parse(readFileSync(required(args.manifest, "manifest"), "utf8"));
    return applySignedUpdate({ manifest, artifactPath: required(args.artifact, "artifact"), stateDir, installDir, platform: String(args.platform || process.platform), architecture: String(args.arch || process.arch) });
  }
  if (command === "recovery-export") return createBackupSnapshot({ stateDir, backupDir: required(args.output, "output") });
  if (command === "recovery-import") return restoreBackupSnapshot({ archivePath: required(args.bundle, "bundle"), targetDir: stateDir, confirmed: args.confirm === "RESTORE" });
  throw Object.assign(new Error("Use trust-bootstrap, apply, recovery-export, or recovery-import."), { code: "command_required" });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runReleaseTool().then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)).catch((error) => { process.stderr.write(`${error.code || "release_tool_failed"}: ${error.message}\n`); process.exitCode = 1; });
}
