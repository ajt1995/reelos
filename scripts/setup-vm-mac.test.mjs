import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { generateUserData, generateMetaData } from "./cidata-arm64.mjs";
import { hardwareLimits, hardwareProfile } from "./reelos-box-scale.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

test("cidata-arm64 generates valid cloud-config and metadata", () => {
  const userData = generateUserData({ virtiofsTag: "media", enableVirtiofs: true });
  assert.match(userData, /^#cloud-config/);
  assert.match(userData, /hostname: reelos/);
  assert.match(userData, /name: reelos/);
  assert.match(userData, /media \/srv\/media virtiofs/);
  assert.match(userData, /\/opt\/reelos\/install\.sh/);
  assert.match(userData, /systemctl enable avahi-daemon/);

  const noVirtiofs = generateUserData({ enableVirtiofs: false });
  assert.doesNotMatch(noVirtiofs, /virtiofs/);

  const metaData = generateMetaData();
  assert.match(metaData, /instance-id:/);
  assert.match(metaData, /local-hostname: reelos/);
});

test("setup-vm-mac.sh contains all required actions, power assertions, and tiering logic", () => {
  const scriptPath = join(repoRoot, "scripts", "setup-vm-mac.sh");
  assert.ok(existsSync(scriptPath), "setup-vm-mac.sh must exist");

  const content = readFileSync(scriptPath, "utf8");
  assert.match(content, /ReelOS Apple Silicon Virtual Appliance Orchestrator/);
  assert.match(content, /audit_host/);
  assert.match(content, /action_setup/);
  assert.match(content, /action_boot/);
  assert.match(content, /action_stop/);
  assert.match(content, /action_status/);
  assert.match(content, /action_reset/);

  // Power assertion (caffeinate) to protect background media server
  assert.match(content, /caffeinate -s/);

  // Apple Silicon hardware detection & memory recommendation
  assert.match(content, /calculate_recommended_ram/);
  assert.match(content, /hw\.memsize/);
  assert.match(content, /machdep\.cpu\.brand_string/);

  // Storage choices
  assert.match(content, /VirtioFS Shared Folder/);
  assert.match(content, /Direct USB External Drive Pass-Through/);
  assert.match(content, /Internal Virtual Disk Only/);

  // Bridged vs NAT networking
  assert.match(content, /Bridged/);
  assert.match(content, /Shared NAT/);
  assert.match(content, /utmctl/);
});

test("Apple Silicon hardware scale math correctly provisions RAM tiers", () => {
  // Tier 1: 2GB Minimal VM on 8GB host
  const tier1 = hardwareLimits(
    hardwareProfile({ ramKb: 2 * 1024 * 1024, cpus: 2, cpuModel: "Apple M1", diskKind: "ssd" }),
  );
  assert.equal(tier1.isAppleSilicon, true);
  assert.equal(tier1.tiny, true);
  assert.equal(tier1.lowPerf, true);
  assert.equal(tier1.jellyfinMem, "512M");
  assert.equal(tier1.transcodeCacheTarget, "disk"); // Protects 2GB RAM from tmpfs overflow
  assert.equal(tier1.zram, false);

  // Tier 2: 4GB Standard VM on 16GB host
  const tier2 = hardwareLimits(
    hardwareProfile({ ramKb: 4 * 1024 * 1024, cpus: 2, cpuModel: "Apple M1", diskKind: "ssd" }),
  );
  assert.equal(tier2.isAppleSilicon, true);
  assert.equal(tier2.tiny, false);
  assert.equal(tier2.lowPerf, false);
  assert.equal(tier2.jellyfinMem, "1024M");
  assert.equal(tier2.transcodeCacheTarget, "disk");

  // Tier 3: 16GB Performance VM on 32GB+ host
  const tier3 = hardwareLimits(
    hardwareProfile({ ramKb: 16 * 1024 * 1024, cpus: 4, cpuModel: "Apple M3 Max", diskKind: "ssd" }),
  );
  assert.equal(tier3.isAppleSilicon, true);
  assert.equal(tier3.tiny, false);
  assert.equal(tier3.lowPerf, false);
  assert.equal(tier3.transcodeCacheTarget, "shm"); // In-memory transcode RAM disk enabled
  assert.equal(tier3.jellyfinMem, "5G");
});
