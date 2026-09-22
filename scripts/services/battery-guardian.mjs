import { getBatteryStatus } from './battery-service.mjs';

export class BatteryGuardian {
  constructor() {
    this.prefetchPaused = false;
  }

  async evaluateBatteryState() {
    let status;
    try {
      status = getBatteryStatus();
    } catch (err) {
      status = { acOnline: true, capacity: 100 }; // default
    }

    const result = {
      ecoFloor: 'none',
      prefetchPaused: false,
      chargeRecommendation: null,
      cycleCount: status.cycle_count || 0
    };

    if (!status.acOnline) {
      if (status.capacity > 50) {
        result.ecoFloor = 'eco-directplay';
      } else if (status.capacity < 20) {
        result.ecoFloor = 'ultra-conservation';
        result.prefetchPaused = true;
        this.prefetchPaused = true;
      }
    } else {
      this.prefetchPaused = false;
    }

    if (status.energy_full && status.energy_full_design) {
      const degradation = status.energy_full / status.energy_full_design;
      if (degradation < 0.8) {
        result.chargeRecommendation = 55; // stationary storage
      } else if (degradation < 0.9) {
        result.chargeRecommendation = 80; // active
      } else {
        result.chargeRecommendation = status.acOnline ? 50 : 80;
      }
    }

    return result;
  }

  /**
   * Applies the 80% charge ceiling directly to the Linux kernel sysfs interface
   * to protect laptop batteries from swelling when operating 24/7 on AC power.
   */
  async enforceKernelChargeCeiling(targetPercent = 80) {
    if (process.platform !== 'linux') {
      return { ok: false, reason: 'Not running on Linux', targetPercent };
    }
    try {
      const fs = await import('fs/promises');
      const glob = ['/sys/class/power_supply/BAT0/charge_control_limit_max', '/sys/class/power_supply/BAT1/charge_control_limit_max'];
      let applied = false;
      for (const p of glob) {
        try {
          await fs.writeFile(p, String(targetPercent));
          applied = true;
        } catch {
          // ignore unwriteable path
        }
      }
      return { ok: applied, targetPercent, method: applied ? 'sysfs_kernel' : 'bios_required' };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  /**
   * HP BIOS Battery Health Manager guidance for dedicated laptop appliances.
   */
  getHpBiosGuide() {
    return {
      title: "HP Battery Health Manager (Appliance Mode)",
      steps: [
        "Reboot the HP laptop and repeatedly tap F10 to enter BIOS Setup.",
        "Navigate to Advanced > Power Management Options.",
        "Select Battery Health Manager and change to 'Maximize My Battery Health' (locks charge to 80%).",
        "Press F10 to Save and Exit. The embedded controller will now prevent swelling even plugged in 24/7."
      ],
      targetCeiling: "80%"
    };
  }
}

export const batteryGuardian = new BatteryGuardian();
