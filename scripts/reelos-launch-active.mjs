#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const root = resolve(process.env.REELOS_ROOT || (process.platform === "win32" ? ".reelos-install" : "/opt/reelos"));
const pointer = resolve(root, "current.json");
if (!existsSync(pointer)) throw Object.assign(new Error("ReelOS has no active release pointer."), { code: "active_release_missing" });
const active = JSON.parse(readFileSync(pointer, "utf8"));
if (!active?.version || !isAbsolute(active.path) || !resolve(active.path).startsWith(`${root}${process.platform === "win32" ? "\\" : "/"}`) || !existsSync(resolve(active.path, "package.json"))) {
  throw Object.assign(new Error("The active ReelOS release pointer is invalid."), { code: "active_release_invalid" });
}
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(npm, ["run", "start:box"], { cwd: resolve(active.path), stdio: "inherit", env: process.env });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => { if (signal) process.kill(process.pid, signal); else process.exitCode = code ?? 1; });
