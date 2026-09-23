import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  parseBatteryUevent,
  evaluateBatteryHealth,
  determineBatteryModeKnobs,
} from "./reelos-battery.mjs";
import {
  runSiliconBenchmarkSync,
  classifySiliconTier,
  getSiliconBenchmark,
  isCompatibleBenchmarkCache,
} from "./reelos-benchmark.mjs";
import {
  isSafeUsbTarget,
  generateMountPath,
} from "./reelos-usb.mjs";
import {
  calculatePrefetchBounds,
} from "./reelos-prefetch.mjs";

test("parseBatteryUevent extracts all standard power_supply attributes", () => {
  const sampleUevent = `
DEVTYPE=power_supply
POWER_SUPPLY_NAME=BAT1
POWER_SUPPLY_TYPE=Battery
POWER_SUPPLY_STATUS=Full
POWER_SUPPLY_PRESENT=1
POWER_SUPPLY_TECHNOLOGY=Li-ion
POWER_SUPPLY_CYCLE_COUNT=12
POWER_SUPPLY_VOLTAGE_MIN_DESIGN=10950000
POWER_SUPPLY_VOLTAGE_NOW=12373000
POWER_SUPPLY_CHARGE_FULL_DESIGN=2850000
POWER_SUPPLY_CHARGE_FULL=2866000
POWER_SUPPLY_CHARGE_NOW=2866000
POWER_SUPPLY_CAPACITY=100
POWER_SUPPLY_MODEL_NAME=PABAS0241231
POWER_SUPPLY_MANUFACTURER=COMPAL
`;
  const parsed = parseBatteryUevent(sampleUevent);
  assert.equal(parsed.name, "BAT1");
  assert.equal(parsed.status, "full");
  assert.equal(parsed.capacity, 100);
  assert.equal(parsed.cycleCount, 12);
  assert.equal(parsed.manufacturer, "COMPAL");
  assert.equal(parsed.model, "PABAS0241231");
  assert.equal(parsed.technology, "Li-ion");
  assert.equal(parsed.chargeFull, 2866000);
  assert.equal(parsed.chargeFullDesign, 2850000);
});

test("evaluateBatteryHealth accurately calculates health percentage and risk flags", () => {
  const healthy = evaluateBatteryHealth(2866000, 2850000, 10);
  assert.equal(healthy.healthPercent, 100);
  assert.equal(healthy.isDegraded, false);

  const degraded = evaluateBatteryHealth(1200000, 2850000, 450);
  assert.equal(degraded.healthPercent, 42.1);
  assert.equal(degraded.isDegraded, true);
  assert.equal(degraded.recommendation.includes("Degraded"), true);
});

test("determineBatteryModeKnobs sets appropriate limits and descriptions", () => {
  const balanced = determineBatteryModeKnobs("balanced");
  assert.equal(balanced.threshold, 80);
  assert.match(balanced.label, /Balanced/);

  const lifespan = determineBatteryModeKnobs("lifespan");
  assert.equal(lifespan.threshold, 60);
  assert.match(lifespan.label, /Max Lifespan/);

  const full = determineBatteryModeKnobs("full");
  assert.equal(full.threshold, 100);
  assert.match(full.label, /Passthrough/);
});

test("classifySiliconTier distinguishes potato, balanced, and powerhouse hardware", () => {
  const potato = classifySiliconTier({
    ramGb: 3.2,
    cpus: 4,
    cpuScoreMs: 1200,
    ramThroughputMBs: 450,
    isRotational: true,
  });
  assert.equal(potato.tier, "potato");
  assert.equal(potato.knobs.directPlayOnly, true);
  assert.equal(potato.knobs.maxTranscodes, 0);

  const powerhouse = classifySiliconTier({
    ramGb: 32,
    cpus: 16,
    cpuScoreMs: 120,
    ramThroughputMBs: 4800,
    isRotational: false,
  });
  assert.equal(powerhouse.tier, "powerhouse");
  assert.equal(powerhouse.knobs.directPlayOnly, false);
  assert.equal(powerhouse.knobs.maxTranscodes, 6);
});

test("runSiliconBenchmarkSync executes math and memory micro-benchmarks", () => {
  const result = runSiliconBenchmarkSync();
  assert.ok(result.cpuScoreMs >= 0);
  assert.ok(result.ramThroughputMBs > 0);
  assert.ok(["potato", "balanced", "powerhouse"].includes(result.tier));
  assert.equal(result.benchmarkType, "local-cpu-memory-microbenchmark");
  assert.match(result.capabilityNote, /does not verify.*encoding capability/i);
  assert.ok(result.hardware.totalRamBytes > 0);
});

test("benchmark cache is accepted only for the same local hardware identity", () => {
  const hardware = {
    cpuModel: "Intel(R) Pentium(R) CPU N3710 @ 1.60GHz",
    cpuCount: 4,
    totalRamBytes: Math.round(3.2 * 1024 * 1024 * 1024),
  };
  const cached = { ok: true, tier: "potato", hardware };

  assert.equal(isCompatibleBenchmarkCache(cached, hardware), true);
  assert.equal(isCompatibleBenchmarkCache(cached, {
    ...hardware,
    totalRamBytes: hardware.totalRamBytes + (128 * 1024 * 1024),
  }), true);
  assert.equal(isCompatibleBenchmarkCache(cached, { ...hardware, cpuCount: 16 }), false);
  assert.equal(isCompatibleBenchmarkCache(cached, { ...hardware, cpuModel: "Intel(R) Core(TM) i7-11800H" }), false);
  assert.equal(isCompatibleBenchmarkCache(cached, {
    ...hardware,
    totalRamBytes: hardware.totalRamBytes + (512 * 1024 * 1024),
  }), false);
  assert.equal(isCompatibleBenchmarkCache({ ok: true, tier: "potato" }, hardware), false);
  assert.equal(isCompatibleBenchmarkCache({ ...cached, tier: "arbitrary" }, hardware), false);
  assert.equal(isCompatibleBenchmarkCache({
    ok: true,
    tier: "potato",
    hardware: { ...hardware, totalRamBytes: "3.2 GiB" },
  }, hardware), false);
});

test("getSiliconBenchmark regenerates a stale cached benchmark instead of reusing its tier", () => {
  const localHardware = {
    cpuModel: "Intel(R) Pentium(R) CPU N3710 @ 1.60GHz",
    cpuCount: 4,
    totalRamBytes: Math.round(3.2 * 1024 * 1024 * 1024),
  };
  const staleCache = {
    ok: true,
    tier: "powerhouse",
    hardware: {
      cpuModel: "Intel(R) Core(TM) i7-11800H",
      cpuCount: 16,
      totalRamBytes: Math.round(15.8 * 1024 * 1024 * 1024),
    },
  };
  const regenerated = { ok: true, tier: "potato", hardware: localHardware };
  let benchmarkRuns = 0;

  const result = getSiliconBenchmark({
    benchmarkFile: "/not-used-in-test/benchmark.json",
    exists: () => true,
    readFile: () => JSON.stringify(staleCache),
    getHardware: () => localHardware,
    runBenchmark: () => {
      benchmarkRuns += 1;
      return regenerated;
    },
  });

  assert.equal(benchmarkRuns, 1);
  assert.equal(result, regenerated);
});

test("getSiliconBenchmark reuses a valid cache for the current hardware", () => {
  const localHardware = {
    cpuModel: "Intel(R) Pentium(R) CPU N3710 @ 1.60GHz",
    cpuCount: 4,
    totalRamBytes: Math.round(3.2 * 1024 * 1024 * 1024),
  };
  const cached = { ok: true, tier: "potato", hardware: localHardware };

  const result = getSiliconBenchmark({
    benchmarkFile: "/not-used-in-test/benchmark.json",
    exists: () => true,
    readFile: () => JSON.stringify(cached),
    getHardware: () => localHardware,
    runBenchmark: () => {
      throw new Error("valid cache should not rerun the benchmark");
    },
  });

  assert.deepEqual(result, cached);
});

test("isSafeUsbTarget refuses root drive, internal drives, and invalid devices", () => {
  assert.equal(isSafeUsbTarget("sda", ["sda", "sda1", "sda2"], "sda2"), false);
  assert.equal(isSafeUsbTarget("sdb", ["sda", "sda1", "sda2"], "sda2"), true);
  assert.equal(isSafeUsbTarget("../etc/passwd", ["sda"], "sda"), false);
  assert.equal(isSafeUsbTarget("", ["sda"], "sda"), false);
});

test("generateMountPath formats clean filesystem mountpoints", () => {
  assert.equal(generateMountPath("Samsung_USB", "sdb1"), "/mnt/usb/Samsung_USB");
  assert.equal(generateMountPath(null, "sdb1"), "/mnt/usb/usb-sdb1");
  assert.equal(generateMountPath("My Drive (Backups)!", "sdc1"), "/mnt/usb/My_Drive_Backups");
});

test("calculatePrefetchBounds limits circular buffer to 150MB in RAM", () => {
  const boundsSmall = calculatePrefetchBounds(2048); // 2GB RAM
  assert.equal(boundsSmall.maxBufferMb, 64);

  const boundsLarge = calculatePrefetchBounds(8192); // 8GB RAM
  assert.equal(boundsLarge.maxBufferMb, 150);
});

test("reelos-lookup-plugin.mjs registers battery, benchmark, usb, and prefetch endpoints", () => {
  const plugin = readFileSync("scripts/reelos-lookup-plugin.mjs", "utf8");
  assert.match(plugin, /\/api\/battery\/status/);
  assert.match(plugin, /\/api\/battery\/mode/);
  assert.match(plugin, /\/api\/system\/benchmark/);
  assert.match(plugin, /\/api\/disks\/usb/);
  assert.match(plugin, /\/api\/disks\/format/);
  assert.match(plugin, /\/api\/stream\/prefetch-status/);
});

test("daemon and install/bin twin scripts for battery-guardian, usb-automount, and hotspot are identical", () => {
  const batDaemon = readFileSync("daemon/reelos-battery-guardian.sh", "utf8");
  const batInstall = readFileSync("install/bin/reelos-battery-guardian.sh", "utf8");
  assert.equal(batDaemon, batInstall);

  const usbDaemon = readFileSync("daemon/reelos-usb-automount.sh", "utf8");
  const usbInstall = readFileSync("install/bin/reelos-usb-automount.sh", "utf8");
  assert.equal(usbDaemon, usbInstall);

  const hotspotDaemon = readFileSync("daemon/reelos-hotspot.sh", "utf8");
  const hotspotInstall = readFileSync("install/bin/reelos-hotspot.sh", "utf8");
  assert.equal(hotspotDaemon, hotspotInstall);
});

test("appliance packager includes hotspot daemon and systemd service for captive headless setup", async () => {
  const { NATIVE_INSTALL_FILES } = await import("./pack-appliance.mjs");
  assert.ok(NATIVE_INSTALL_FILES.includes("bin/reelos-hotspot.sh"));
  assert.ok(NATIVE_INSTALL_FILES.includes("systemd/reelos-hotspot.service"));
});
