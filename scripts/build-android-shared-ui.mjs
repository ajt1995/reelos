#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const staticRoot = join(root, ".vercel", "output", "static");
const serverEntry = join(root, ".vercel", "output", "functions", "__server.func", "index.mjs");
const androidRoot = join(root, "clients", "android", "app", "src", "main", "assets", "reelos");

if (process.argv.includes("--build")) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const built = spawnSync(npm, ["run", "build:dev"], { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (built.status !== 0) process.exit(built.status ?? 1);
}

if (!existsSync(staticRoot) || !existsSync(serverEntry)) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const built = spawnSync(npm, ["run", "build:dev"], { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (built.status !== 0) {
    console.error("Shared ReelOS output could not be built.");
    process.exit(built.status ?? 1);
  }
}

const server = (await import(`${pathToFileURL(serverEntry).href}?android=${Date.now()}`)).default;
const response = await server.fetch(new Request("http://reelos.android/"), {});
if (!response.ok) {
  console.error(`Could not render the shared ReelOS entry document (${response.status}).`);
  process.exit(1);
}

let html = await response.text();
html = html
  .replace(/<script[^>]+src="https:\/\/grok\.com\/grok-app-builder\/extensions\.js"[^>]*><\/script>/gi, "")
  .replaceAll('"/assets/', '"/assets/reelos/assets/')
  .replaceAll("'/assets/", "'/assets/reelos/assets/")
  .replaceAll('href="/favicon.svg"', 'href="/assets/reelos/favicon.svg"')
  .replaceAll('href="/manifest.webmanifest"', 'href="/assets/reelos/manifest.webmanifest"')
  .replaceAll('href="/apple-touch-icon.png"', 'href="/assets/reelos/apple-touch-icon.png"');

rmSync(androidRoot, { recursive: true, force: true });
mkdirSync(androidRoot, { recursive: true });
cpSync(staticRoot, androidRoot, { recursive: true });
writeFileSync(join(androidRoot, "index.html"), html, "utf8");
writeFileSync(join(androidRoot, "SHARED_UI_BUILD.txt"), `ReelOS shared UI generated ${new Date().toISOString()}\n`, "utf8");
console.log(`Bundled the shared ReelOS interface into ${androidRoot}`);
