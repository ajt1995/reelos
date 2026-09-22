import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

function getBatteryModeFile() {
  return join(process.env.REELOS_STATE || "/var/lib/reelos", "battery-mode.json");
}
const POWER_SUPPLY_SYS = "/sys/class/power_supply";

export function parseBatteryUevent(raw) {
  const lines = (raw || "").split("\n");
  const data = {};
  for (const line of lines) {
    const idx = line.indexOf("=");
    if (idx > 0) {
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      data[k] = v;
    }
  }

  const name = data.POWER_SUPPLY_NAME || "BAT0";
  const status = (data.POWER_SUPPLY_STATUS || "unknown").toLowerCase();
  const capacity = Number.parseInt(data.POWER_SUPPLY_CAPACITY ?? "100", 10);
  const cycleCount = Number.parseInt(data.POWER_SUPPLY_CYCLE_COUNT ?? "0", 10);
  const manufacturer = data.POWER_SUPPLY_MANUFACTURER || "";
  const model = data.POWER_SUPPLY_MODEL_NAME || "";
  const technology = data.POWER_SUPPLY_TECHNOLOGY || "Li-ion";
  const voltageNow = Number.parseInt(data.POWER_SUPPLY_VOLTAGE_NOW ?? "0", 10);
  const chargeFull = Number.parseInt(data.POWER_SUPPLY_CHARGE_FULL || data.POWER_SUPPLY_ENERGY_FULL || "0", 10);
  const chargeFullDesign = Number.parseInt(data.POWER_SUPPLY_CHARGE_FULL_DESIGN || data.POWER_SUPPLY_ENERGY_FULL_DESIGN || "0", 10);
  const chargeNow = Number.parseInt(data.POWER_SUPPLY_CHARGE_NOW || data.POWER_SUPPLY_ENERGY_NOW || "0", 10);

  return {
    name,
    status,
    capacity: Number.isNaN(capacity) ? 100 : capacity,
    cycleCount: Number.isNaN(cycleCount) ? 0 : cycleCount,
    manufacturer,
    model,
    technology,
    voltageNow: voltageNow / 1_000_000,
    chargeFull,
    chargeFullDesign,
    chargeNow,
  };
}

export function evaluateBatteryHealth(chargeFull, chargeFullDesign, cycleCount = 0) {
  if (!chargeFull || !chargeFullDesign || chargeFullDesign <= 0) {
    return {
      healthPercent: 100,
      isDegraded: false,
      recommendation: "Battery healthy or telemetry unavailable",
    };
  }

  const ratio = (chargeFull / chargeFullDesign) * 100;
  const healthPercent = Math.min(100, Math.round(ratio * 10) / 10);
  const isDegraded = healthPercent < 55 || cycleCount > 800;

  let recommendation = "Battery in good health for appliance standby.";
  if (isDegraded) {
    recommendation = "Degraded battery cell capacity. Running on AC protection mode to prevent sudden power brownouts.";
  } else if (healthPercent < 75) {
    recommendation = "Moderate battery wear. Balanced 80% charge mode recommended for 24/7 appliance operation.";
  } else {
    recommendation = "Optimal battery health. Appliance charge protection active.";
  }

  return {
    healthPercent,
    isDegraded,
    recommendation,
  };
}

export function determineBatteryModeKnobs(mode = "balanced") {
  switch (mode) {
    case "lifespan":
      return {
        mode: "lifespan",
        threshold: 60,
        label: "Max Lifespan (60%)",
        detail: "Preserves lithium cells indefinitely during 24/7 continuous AC operation.",
      };
    case "full":
      return {
        mode: "full",
        threshold: 100,
        label: "Passthrough (100%)",
        detail: "Standard laptop charging to 100% capacity.",
      };
    case "conditioning":
      return {
        mode: "conditioning",
        threshold: 80,
        label: "Active Ion Conditioning (60%–80%)",
        detail: "Cycles between 60% and 80% to prevent electrolyte crystallization.",
      };
    case "balanced":
    default:
      return {
        mode: "balanced",
        threshold: 80,
        label: "Balanced Protection (80%)",
        detail: "Prevents high-voltage stress while retaining 80% emergency backup power.",
      };
  }
}

export function getSavedBatteryMode() {
  try {
    const file = getBatteryModeFile();
    const target = existsSync(file) ? file : (existsSync("/tmp/battery-mode.json") ? "/tmp/battery-mode.json" : null);
    if (target) {
      const parsed = JSON.parse(readFileSync(target, "utf8"));
      if (parsed?.mode) return parsed.mode;
    }
  } catch {}
  return "balanced";
}

export function getBatteryStatus() {
  if (process.platform === "win32") {
    try {
      const ps = spawnSync(
        "powershell.exe",
        ["-NoProfile", "-Command", "Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object EstimatedChargeRemaining, BatteryStatus, Name | ConvertTo-Json"],
        { encoding: "utf8", timeout: 4000 }
      );
      if (ps.stdout && !ps.error) {
        const raw = JSON.parse(ps.stdout);
        const bat = Array.isArray(raw) ? raw[0] : raw;
        if (bat && (bat.EstimatedChargeRemaining !== undefined || bat.Name)) {
          const capacity = Number(bat.EstimatedChargeRemaining) || 100;
          const statusVal = Number(bat.BatteryStatus) || 2;
          const acOnline = statusVal !== 1;
          const currentMode = getSavedBatteryMode();
          return {
            ok: true,
            present: true,
            acOnline,
            status: acOnline ? "charging" : "discharging",
            capacity,
            cycleCount: 0,
            healthPercent: 100,
            isDegraded: false,
            recommendation: "Optimal battery health. Appliance charge protection active.",
            mode: currentMode,
            knobs: determineBatteryModeKnobs(currentMode),
            hardwareSupport: false,
          };
        }
      }
    } catch {}
  }

  if (!existsSync(POWER_SUPPLY_SYS)) {
    return {
      ok: true,
      present: false,
      message: "No power supply subsystem detected",
      mode: "balanced",
    };
  }

  let batDir = null;
  let acOnline = true;

  try {
    const entries = readdirSync(POWER_SUPPLY_SYS);
    for (const ent of entries) {
      if (ent.startsWith("BAT")) {
        batDir = join(POWER_SUPPLY_SYS, ent);
      }
      if (ent.startsWith("AC")) {
        try {
          const onlineVal = readFileSync(join(POWER_SUPPLY_SYS, ent, "online"), "utf8").trim();
          acOnline = onlineVal === "1";
        } catch {}
      }
    }
  } catch {
    return {
      ok: true,
      present: false,
      message: "Unable to read power_supply entries",
      mode: "balanced",
    };
  }

  if (!batDir || !existsSync(batDir)) {
    return {
      ok: true,
      present: false,
      message: "Desktop / No battery detected (Mains Power)",
      acOnline,
      mode: "balanced",
    };
  }

  let uevent = "";
  try {
    uevent = readFileSync(join(batDir, "uevent"), "utf8");
  } catch {}

  const telemetry = parseBatteryUevent(uevent);
  const health = evaluateBatteryHealth(telemetry.chargeFull, telemetry.chargeFullDesign, telemetry.cycleCount);
  const currentMode = getSavedBatteryMode();
  const knobs = determineBatteryModeKnobs(currentMode);

  // Check if hardware/kernel exposes charge control threshold
  const thresholdFile = join(batDir, "charge_control_limit_max");
  const thresholdAlt = join(batDir, "charge_stop_threshold");
  const thresholdSupported = existsSync(thresholdFile) || existsSync(thresholdAlt);

  return {
    ok: true,
    present: true,
    name: telemetry.name,
    percent: telemetry.capacity,
    status: telemetry.status,
    acOnline,
    healthPercent: health.healthPercent,
    isDegraded: health.isDegraded,
    recommendation: health.recommendation,
    voltage: telemetry.voltageNow,
    cycleCount: telemetry.cycleCount,
    technology: telemetry.technology,
    manufacturer: telemetry.manufacturer,
    model: telemetry.model,
    mode: currentMode,
    modeKnobs: knobs,
    thresholdSupported,
    hardwareProtected: thresholdSupported,
  };
}

export function setBatteryMode(mode) {
  const allowed = ["balanced", "lifespan", "full", "conditioning"];
  if (!allowed.includes(mode)) {
    return { ok: false, error: `Invalid battery mode: ${mode}` };
  }

  const knobs = determineBatteryModeKnobs(mode);
  const modeFile = getBatteryModeFile();
  try {
    writeFileSync(modeFile, JSON.stringify({ mode, updatedAt: Date.now() }, null, 2), "utf8");
  } catch (e) {
    try {
      writeFileSync("/tmp/battery-mode.json", JSON.stringify({ mode, updatedAt: Date.now() }, null, 2), "utf8");
    } catch {
      return { ok: false, error: `Failed to save mode: ${e.message}` };
    }
  }

  // Attempt to write threshold if supported
  let written = false;
  if (existsSync(POWER_SUPPLY_SYS)) {
    try {
      const entries = readdirSync(POWER_SUPPLY_SYS);
      for (const ent of entries) {
        if (ent.startsWith("BAT")) {
          const batDir = join(POWER_SUPPLY_SYS, ent);
          const limitFile = join(batDir, "charge_control_limit_max");
          const stopFile = join(batDir, "charge_stop_threshold");
          if (existsSync(limitFile)) {
            writeFileSync(limitFile, String(knobs.threshold), "utf8");
            written = true;
          } else if (existsSync(stopFile)) {
            writeFileSync(stopFile, String(knobs.threshold), "utf8");
            written = true;
          }
        }
      }
    } catch {}
  }

  return {
    ok: true,
    mode,
    threshold: knobs.threshold,
    hardwareApplied: written,
  };
}
