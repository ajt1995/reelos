import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseBatteryUevent,
  evaluateBatteryHealth,
  determineBatteryModeKnobs,
  getSavedBatteryMode,
  getBatteryStatus as getCoreBatteryStatus,
  setBatteryMode as setCoreBatteryMode,
} from "../reelos-battery.mjs";

const POWER_SUPPLY_SYS = "/sys/class/power_supply";

/**
 * Battery & Hardware Guardian Service for ReelOS.
 * Monitors battery state, AC mains, wear degradation,
 * and manages charge limitation profiles (80% / 60% / 100%).
 */

export function detectAcMains() {
  if (!existsSync(POWER_SUPPLY_SYS)) {
    return { connected: null, supported: false, simulated: false };
  }

  try {
    const supplies = readdirSync(POWER_SUPPLY_SYS);
    for (const s of supplies) {
      if (s.startsWith("AC") || s.startsWith("ADP")) {
        const onlinePath = join(POWER_SUPPLY_SYS, s, "online");
        if (existsSync(onlinePath)) {
          const online = readFileSync(onlinePath, "utf8").trim();
          return { connected: online === "1", name: s };
        }
      }
    }
  } catch {
    // Fallback
  }

  return { connected: null, supported: true, simulated: false };
}

export function getBatteryStatus() {
  const core = getCoreBatteryStatus();
  const ac = detectAcMains();
  return {
    ...core,
    acOnline: core.acOnline ?? ac.connected,
    modeKnobs: determineBatteryModeKnobs(core.mode || "balanced"),
  };
}

export function setBatteryMode(requestedMode) {
  return setCoreBatteryMode(requestedMode);
}
