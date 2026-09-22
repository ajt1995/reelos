#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = "/workspace";
const staging = "/tmp/reelos-pack";
const dest = join(root, "public", "install");

rmSync(staging, { recursive: true, force: true });
mkdirSync(join(staging, "reelos", "app"), { recursive: true });
mkdirSync(dest, { recursive: true });

const appCopies = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vite.config.ts",
  "src",
  "scripts",
  "server",
];
for (const rel of appCopies) {
  const from = join(root, rel);
  if (!existsSync(from)) continue;
  cpSync(from, join(staging, "reelos", "app", rel), { recursive: true });
}
mkdirSync(join(staging, "reelos", "app", "public"), { recursive: true });
cpSync(join(root, "public"), join(staging, "reelos", "app", "public"), {
  recursive: true,
  filter: (src) => !src.includes(`${join("public", "install")}`),
});
cpSync(join(root, "install"), join(staging, "reelos"), { recursive: true });
cpSync(join(root, "install", "reelos-install.sh"), join(staging, "reelos", "install.sh"));
chmodSync(join(staging, "reelos", "install.sh"), 0o755);
chmodSync(join(staging, "reelos", "reelos-install.sh"), 0o755);
if (existsSync(join(root, "VERSION"))) {
  cpSync(join(root, "VERSION"), join(staging, "reelos", "VERSION"));
}
for (const sh of [
  "console-card.sh",
  "kiosk.sh",
  "lock-download-clients.py",
  "stuck-downloads.py",
  "wire-engines.py",
  "reelos-doctor.py",
  "reelos-access.sh",
  "reelos-update.sh",
  "live-wifi.sh",
]) {
  const p = join(staging, "reelos", "bin", sh);
  if (existsSync(p)) chmodSync(p, 0o755);
}

writeFileSync(
  join(staging, "reelos", "app", ".reelos-appliance"),
  "1\n",
);

const zip = join(dest, "reelos-vm.zip");
rmSync(zip, { force: true });
const z = spawnSync(
  "python3",
  [
    "-c",
    "import sys, zipfile, os\nroot, out = sys.argv[1], sys.argv[2]\nwith zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:\n  for dirpath, _, files in os.walk(root):\n    for f in files:\n      p = os.path.join(dirpath, f)\n      z.write(p, os.path.relpath(p, root))\n",
    staging,
    zip,
  ],
  { stdio: "inherit" },
);
if (z.status !== 0) {
  console.error("zip failed", z.status);
  process.exit(1);
}

const bundle = join(staging, "cidata", "reelos-bundle.tar.gz");
mkdirSync(join(staging, "cidata"), { recursive: true });
const tar = spawnSync(
  "tar",
  ["-czf", bundle, "reelos"],
  { cwd: staging, stdio: "inherit" },
);
if (tar.status !== 0) process.exit(1);
cpSync(join(root, "install", "autoinstall", "user-data"), join(staging, "cidata", "user-data"));
cpSync(join(root, "install", "autoinstall", "meta-data"), join(staging, "cidata", "meta-data"));

const iso = join(dest, "reelos-cidata.iso");
const py = spawnSync("python3", [join(root, "scripts", "cidata-iso.py"), join(staging, "cidata"), iso], {
  stdio: "inherit",
});
if (py.status !== 0) process.exit(1);

const st = spawnSync("bash", ["-lc", `ls -lh ${zip} ${iso}`], { stdio: "inherit" });
if (st.status !== 0) process.exit(1);
