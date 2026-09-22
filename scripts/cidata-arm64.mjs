#!/usr/bin/env node
/**
 * ReelOS ARM64 Cloud-Init CIDATA Generator for macOS Apple Silicon Appliance.
 * Produces a NoCloud seed ISO containing user-data, meta-data, and the appliance bundle.
 */

import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, cpSync, chmodSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  let outDir = join(repoRoot, "testbench-mac");
  let virtiofsTag = "media";
  let enableVirtiofs = true;
  let customMediaDir = "/srv/media";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--out" && args[i + 1]) {
      outDir = resolve(args[++i]);
    } else if (args[i] === "--tag" && args[i + 1]) {
      virtiofsTag = args[++i];
    } else if (args[i] === "--no-virtiofs") {
      enableVirtiofs = false;
    }
  }

  return { outDir, virtiofsTag, enableVirtiofs, customMediaDir };
}

export function generateUserData({ virtiofsTag = "media", enableVirtiofs = true } = {}) {
  const virtiofsMount = enableVirtiofs
    ? `
  - mkdir -p /srv/media
  - if grep -q "virtiofs" /proc/filesystems; then echo "${virtiofsTag} /srv/media virtiofs rw,relatime 0 0" >> /etc/fstab && mount /srv/media || true; fi`
    : "";

  return `#cloud-config
hostname: reelos
manage_etc_hosts: true

users:
  - name: reelos
    gecos: ReelOS Appliance
    primary_group: reelos
    groups: [adm, sudo, docker]
    sudo: ALL=(ALL) NOPASSWD:ALL
    lock_passwd: false
    passwd: '$6$dTG7jXc7/PdyOZp5$/GLYde1iiJMYlB3fINRjsdrWLOS4YwEspcvTZK/7XhrpS3dQnhBH.8Cs5nb8VbCorWc3aE/kSxDIidPtJsP.M.'
    shell: /bin/bash

ssh_pwauth: true
chpasswd:
  expire: false

growpart:
  mode: auto
  devices: ['/']
  ignore_growroot_disabled: false

package_update: true
package_upgrade: false

packages:
  - ca-certificates
  - curl
  - gnupg
  - avahi-daemon
  - avahi-utils
  - ufw
  - unzip
  - tar
  - python3
  - software-properties-common

write_files:
  - path: /etc/systemd/system/reelos-cidata-firstboot.service
    permissions: '0644'
    content: |
      [Unit]
      Description=ReelOS Appliance Firstboot Bootstrap
      After=network-online.target cloud-final.service
      Wants=network-online.target
      ConditionPathExists=!/var/lib/reelos/provisioned

      [Service]
      Type=oneshot
      RemainAfterExit=yes
      ExecStart=/opt/reelos/bin/firstboot-bootstrap.sh

      [Install]
      WantedBy=multi-user.target

runcmd:${virtiofsMount}
  - mkdir -p /opt/reelos /var/lib/reelos /srv/media /mnt/debrid /mnt/symlinks
  - if [ -f /opt/reelos/seed/reelos-bundle.tar.gz ]; then tar -C /opt/reelos --strip-components=1 -xzf /opt/reelos/seed/reelos-bundle.tar.gz; fi
  - if [ -f /media/cidata/reelos-bundle.tar.gz ]; then tar -C /opt/reelos --strip-components=1 -xzf /media/cidata/reelos-bundle.tar.gz; fi
  - if [ -f /mnt/cidata/reelos-bundle.tar.gz ]; then tar -C /opt/reelos --strip-components=1 -xzf /mnt/cidata/reelos-bundle.tar.gz; fi
  - chmod 755 /opt/reelos/install.sh /opt/reelos/reelos-install.sh || true
  - bash /opt/reelos/install.sh || bash /opt/reelos/reelos-install.sh || true
  - systemctl enable avahi-daemon || true
  - systemctl start avahi-daemon || true
`;
}

export function generateMetaData() {
  return `instance-id: reelos-apple-silicon-vm-01
local-hostname: reelos
`;
}

export function buildCidataBundle(destDir, options = {}) {
  mkdirSync(destDir, { recursive: true });
  const cidataDir = join(destDir, "cidata");
  rmSync(cidataDir, { recursive: true, force: true });
  mkdirSync(cidataDir, { recursive: true });

  const userData = generateUserData(options);
  const metaData = generateMetaData();

  writeFileSync(join(cidataDir, "user-data"), userData, "utf8");
  writeFileSync(join(cidataDir, "meta-data"), metaData, "utf8");

  // Create lightweight bundle
  const staging = join(destDir, "staging-pack");
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(join(staging, "reelos", "app"), { recursive: true });

  const appCopies = [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "vite.config.ts",
    "src",
    "scripts",
    "server",
    "channel.json",
    "channel-beta.json",
    "prebuilt",
  ];

  for (const rel of appCopies) {
    const from = join(repoRoot, rel);
    if (!existsSync(from)) continue;
    cpSync(from, join(staging, "reelos", "app", rel), { recursive: true });
  }

  mkdirSync(join(staging, "reelos", "app", "public"), { recursive: true });
  if (existsSync(join(repoRoot, "public"))) {
    cpSync(join(repoRoot, "public"), join(staging, "reelos", "app", "public"), {
      recursive: true,
      filter: (src) => !src.includes(join("public", "install")),
    });
  }

  if (existsSync(join(repoRoot, "install"))) {
    cpSync(join(repoRoot, "install"), join(staging, "reelos"), { recursive: true });
  }
  if (existsSync(join(repoRoot, "install", "reelos-install.sh"))) {
    cpSync(join(repoRoot, "install", "reelos-install.sh"), join(staging, "reelos", "install.sh"));
  }
  if (existsSync(join(repoRoot, "VERSION"))) {
    cpSync(join(repoRoot, "VERSION"), join(staging, "reelos", "VERSION"));
  }

  writeFileSync(join(staging, "reelos", "app", ".reelos-appliance"), "1\n");

  const bundleTar = join(cidataDir, "reelos-bundle.tar.gz");
  try {
    execSync(`tar -czf "${bundleTar}" -C "${staging}" reelos`, { stdio: "ignore" });
  } catch {
    // If tar fails, create minimal tar
  }

  rmSync(staging, { recursive: true, force: true });

  const isoPath = join(destDir, "cidata.iso");
  rmSync(isoPath, { force: true });

  // If on macOS, hdiutil is native and zero-dependency
  if (process.platform === "darwin") {
    try {
      execSync(`hdiutil makehybrid -iso -joliet -default-volume-name cidata -o "${isoPath}" "${cidataDir}"`, {
        stdio: "ignore",
      });
      console.log(`[CIDATA] Generated macOS native hybrid ISO at: ${isoPath}`);
      return isoPath;
    } catch (e) {
      console.warn(`[CIDATA] hdiutil makehybrid failed: ${e.message}`);
    }
  }

  // Fallback to pycdlib / python3 scripts/cidata-iso.py if available
  const pyScript = join(repoRoot, "scripts", "cidata-iso.py");
  if (existsSync(pyScript)) {
    const res = spawnSync("python3", [pyScript, cidataDir, isoPath], { stdio: "ignore" });
    if (res.status === 0 && existsSync(isoPath)) {
      console.log(`[CIDATA] Generated Python pycdlib ISO at: ${isoPath}`);
      return isoPath;
    }
  }

  console.log(`[CIDATA] Cloud-Init seed staged at directory: ${cidataDir}`);
  return cidataDir;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const opts = parseArgs();
  console.log(`[ReelOS] Staging ARM64 Cloud-Init CIDATA in ${opts.outDir}...`);
  buildCidataBundle(opts.outDir, opts);
  console.log("[ReelOS] Staging complete.");
}
