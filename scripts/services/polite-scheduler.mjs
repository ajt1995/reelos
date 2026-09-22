import os from "node:os";
import { exec } from "node:child_process";
import { isDedicatedMachine } from "./machine-classifier.mjs";
import util from "node:util";

const execAsync = util.promisify(exec);

// ── Memory pressure thresholds ─────────────────────────────────────────────
// Fractions of total RAM. Platform-tuned so Windows (shared) yields earlier.
const MEM_THRESHOLDS = process.platform === "win32"
  ? { soft: 0.25, hard: 0.15, critical: 0.08 }   // Windows: yield at 25% free
  : { soft: 0.15, hard: 0.08, critical: 0.04 };   // Dedicated: yield at 15% free

/**
 * Cooperative OS Scheduler ("Polite Mode") for ReelOS.
 *
 * Monitors both CPU load AND free memory on a single interval.
 * All components subscribe once and react to the emitted state —
 * no component ever needs to call os.freemem() or os.loadavg() itself.
 *
 * Pressure levels:
 *   none     → allocate freely
 *   soft     → skip new background allocations, existing cache serves
 *   hard     → skip allocations + evict oldest 10% of caches
 *   critical → skip allocations + evict oldest 25% + pause all background work
 *
 * hostState values:
 *   normal            → business as usual
 *   stealth_yield     → heavy foreground app detected, drop to idle priority
 *   turbo_maintenance → machine idle at night, run heavier background tasks
 */

class PoliteScheduler {
  constructor() {
    this.hostState    = "normal";
    this.previousState = "normal";
    this.isYielding   = false;
    this.memPressure  = "none";       // 'none' | 'soft' | 'hard' | 'critical'
    this._prevMemPressure = "none";
    this.checkIntervalMs = 6000;
    this.timer = null;
    this.listeners = new Set();
    this._totalRam = os.totalmem();   // read once — doesn't change at runtime
  }

  start() {
    if (this.timer) return;
    this.evaluateHostState();
    this.timer = setInterval(() => this.evaluateHostState(), this.checkIntervalMs);
    if (this.timer.unref) this.timer.unref();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.hostState, this.isYielding, this.memPressure);
      } catch {}
    }
  }

  // ── Memory helpers ─────────────────────────────────────────────────────

  /** Current free-RAM fraction (0–1). */
  _freeRamFraction() {
    return os.freemem() / this._totalRam;
  }

  /** Derive pressure level from free RAM fraction. */
  _calcMemPressure(frac) {
    const t = MEM_THRESHOLDS;
    if (frac <= t.critical) return "critical";
    if (frac <= t.hard)     return "hard";
    if (frac <= t.soft)     return "soft";
    return "none";
  }

  /**
   * Can this component allocate new memory right now?
   * Pass a component name for future per-component tuning.
   */
  canAllocate(_component = "") {
    return this.memPressure === "none";
  }

  /**
   * Should this component evict cached data to relieve pressure?
   * Returns a fraction of entries to evict (0 = no, 0.1 = 10%, 0.25 = 25%).
   */
  shouldEvict() {
    if (this.memPressure === "critical") return 0.25;
    if (this.memPressure === "hard")     return 0.10;
    return 0;
  }

  /** True when any background work should be skipped. */
  shouldThrottleScraping() {
    return this.isYielding || this.memPressure !== "none";
  }

  shouldThrottlePrefetch() {
    return this.isYielding || this.memPressure !== "none";
  }

  shouldParkHdd() {
    const hour = new Date().getHours();
    const isNight = hour >= 1 && hour <= 6;
    return isNight && !this.isYielding && this.memPressure === "none";
  }

  // ── Main evaluation loop ───────────────────────────────────────────────

  async evaluateHostState() {
    if (this._isEvaluating) return;
    this._isEvaluating = true;
    try {
      // ── 1. Memory pressure (always) ──────────────────────────────────
      const frac = this._freeRamFraction();
      this.memPressure = this._calcMemPressure(frac);

      // ── 2. CPU / host-app state ──────────────────────────────────────
      if (isDedicatedMachine()) {
        this.hostState  = "turbo_maintenance";
        this.isYielding = false;
        this.applyProcessPriority("normal");
      } else {
        const isWindows = process.platform === "win32";
        let heavyForegroundApp = false;

        try {
          if (isWindows) {
            // Scan for memory pressure (>1.5GB RAM usage) OR creator apps
            const { stdout } = await new Promise(resolve => {
              const cp = exec('tasklist /FO CSV /NH', { timeout: 1500 }, (err, stdout) => {
                resolve({ stdout: stdout || "" });
              });
              cp.unref();
            });
            if (stdout && stdout.length > 5) {
              const lines = stdout.split("\n").filter(Boolean);
              
              // Creator apps that immediately trigger stealth yield regardless of RAM
              const creatorApps = /premiere\.exe|photoshop\.exe|resolve\.exe|aftereffects\.exe|blender\.exe|obs64\.exe|lightroom\.exe/i;
              
              for (const l of lines) {
                if (/node\.exe|caddy\.exe|decypharr\.exe/i.test(l)) continue;
                
                if (creatorApps.test(l)) {
                  heavyForegroundApp = true;
                  break;
                }
                
                // Parse RAM usage from tasklist output (in KB, with commas)
                // "Image Name","PID","Session Name","Session#","Mem Usage"
                const parts = l.split('","');
                if (parts.length >= 5) {
                  const memStr = parts[4].replace(/[^\d]/g, '');
                  if (parseInt(memStr, 10) > 1500000) {
                    heavyForegroundApp = true;
                    break;
                  }
                }
              }
            }
          } else {
            const load  = os.loadavg()[0];
            const cores = os.cpus().length || 1;
            if (load > cores * 0.85) heavyForegroundApp = true;
          }
        } catch {}

        if (heavyForegroundApp || this.memPressure === "critical") {
          this.hostState  = "stealth_yield";
          this.isYielding = true;
          this.applyProcessPriority("idle");
        } else {
          const hour   = new Date().getHours();
          const isNight = hour >= 1 && hour <= 6;
          const cores  = os.cpus().length || 1;
          const load   = os.loadavg()[0] || 0;

          if (isNight && load < cores * 0.3 && this.memPressure === "none") {
            this.hostState  = "turbo_maintenance";
            this.isYielding = false;
            this.applyProcessPriority("normal");
          } else {
            this.hostState  = "normal";
            this.isYielding = false;
            this.applyProcessPriority("normal");
          }
        }
      }

      // ── 3. Notify subscribers if anything changed ────────────────────
      const changed = this.previousState !== this.hostState
                   || this._prevMemPressure !== this.memPressure;
      if (changed) {
        this.previousState    = this.hostState;
        this._prevMemPressure = this.memPressure;
        this.notify();
      }
    } finally {
      this._isEvaluating = false;
    }
  }

  applyProcessPriority(priority) {
    try {
      if (priority === "idle") {
        if (os.constants?.priority?.PRIORITY_LOW !== undefined)
          os.setPriority(process.pid, os.constants.priority.PRIORITY_LOW);
      } else {
        if (os.constants?.priority?.PRIORITY_NORMAL !== undefined)
          os.setPriority(process.pid, os.constants.priority.PRIORITY_NORMAL);
      }
    } catch {}
  }

  getStatus() {
    return {
      hostState:   this.hostState,
      isYielding:  this.isYielding,
      memPressure: this.memPressure,
      freeRamMb:   Math.round(os.freemem() / (1024 * 1024)),
      totalRamMb:  Math.round(this._totalRam / (1024 * 1024)),
      platform:    process.platform,
      arch:        process.arch,
      pid:         process.pid,
    };
  }
}

export function isQuietHours(hour = new Date().getHours(), startHour = 23, endHour = 7) {
  if (startHour > endHour) {
    return hour >= startHour || hour < endHour;
  }
  return hour >= startHour && hour < endHour;
}

export function shouldYieldToCpu(currentLoadPct, thresholdPct = 80) {
  return currentLoadPct >= thresholdPct;
}

export const politeScheduler = new PoliteScheduler();
politeScheduler.start();
