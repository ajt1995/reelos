#!/usr/bin/env node
/**
 * Copy the CI/dev vite build into prebuilt/ so main.tar.gz carries a client
 * the 4GB house never has to compile. Posters stay in public/ (already shipped).
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, ".vercel/output");
const dest = join(root, "prebuilt/vercel-output");

if (!existsSync(join(src, "nitro.json"))) {
  console.error("pack-prebuilt: run NODE_ENV=production vite build first");
  process.exit(1);
}

rmSync(join(root, "prebuilt"), { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(join(src, "nitro.json"), join(dest, "nitro.json"));
if (existsSync(join(src, "config.json"))) {
  cpSync(join(src, "config.json"), join(dest, "config.json"));
}
if (existsSync(join(src, "functions"))) {
  cpSync(join(src, "functions"), join(dest, "functions"), { recursive: true });
}
mkdirSync(join(dest, "static"), { recursive: true });
const staticSrc = join(src, "static");
if (existsSync(staticSrc)) {
  for (const name of readdirSync(staticSrc)) {
    if (name === "posters") continue;
    // public/install can hold local USB ISOs; never ship those in the 4GB tarball.
    if (name === "install") continue;
    if (/\.(iso|zip)$/i.test(name)) continue;
    cpSync(join(staticSrc, name), join(dest, "static", name), { recursive: true });
  }
}

const assetsDir = join(dest, "static/assets");
const assets = existsSync(assetsDir) ? readdirSync(assetsDir) : [];
const css = assets.find((n) => n.startsWith("styles-") && n.endsWith(".css"));
const js = assets.find((n) => n.startsWith("index-") && n.endsWith(".js"));
if (!css || !js) {
  console.error("pack-prebuilt: hashed styles/index missing in static/assets");
  process.exit(1);
}

const version = readFileSync(join(root, "VERSION"), "utf8").trim();
writeFileSync(
  join(root, "prebuilt/MANIFEST.txt"),
  [
    `version=${version}`,
    "mode=nitro+api",
    `css=/assets/${css}`,
    `js=/assets/${js}`,
    "note=hashed client; posters stay in public/; 4GB box never compiles",
    "",
  ].join("\n"),
);
console.log(`pack-prebuilt ok ${version} /assets/${css} /assets/${js}`);
