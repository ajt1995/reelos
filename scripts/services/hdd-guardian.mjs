import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

export class HddGuardian {
  constructor() {
    this.buffer = [];
    this.bufferSize = 0;
    this.maxBufferSize = 30 * 1024 * 1024; // 30MB
    this.flushIntervalMs = 15 * 60 * 1000; // 15 minutes
    this.lastFlush = Date.now();
    this.currentSource = 'idle'; // 'ram', 'disk', 'idle'
    this.lastDiskActivity = Date.now();
    this.spindownThresholdMs = 10 * 60 * 1000; // ~10 min
  }

  writeState(data) {
    const jsonStr = JSON.stringify(data);
    const size = Buffer.byteLength(jsonStr);
    this.buffer.push(data);
    this.bufferSize += size;
    
    if (this.bufferSize >= this.maxBufferSize || Date.now() - this.lastFlush >= this.flushIntervalMs) {
      this.flush();
    }
  }

  flush() {
    if (this.buffer.length > 0) {
      try {
        const p = path.join(process.cwd(), '.reelos-state', 'hdd-telemetry.json');
        const dir = path.dirname(p);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        let existing = [];
        if (fs.existsSync(p)) {
          try {
            existing = JSON.parse(fs.readFileSync(p, 'utf8'));
          } catch(e) {}
        }
        existing = existing.concat(this.buffer);
        fs.writeFileSync(p, JSON.stringify(existing));
      } catch (e) {}
    }
    this.buffer = [];
    this.bufferSize = 0;
    this.lastFlush = Date.now();
  }

  reportPlaybackSource(source) {
    this.currentSource = source;
    if (source === 'disk') {
      this.lastDiskActivity = Date.now();
    }
  }

  predictFailure(attributes) {
    const { reallocatedSectors = 0, currentPendingSectors = 0, seekErrorRate = 0, temperature = 35 } = attributes;
    
    // Flag impending mechanical drive wear
    let failurePredicted = false;
    if (reallocatedSectors > 100 || currentPendingSectors > 50 || seekErrorRate > 10000 || temperature >= 65) {
      failurePredicted = true;
    }
    
    let spindownRecommended = false;
    const idleDuration = Date.now() - this.lastDiskActivity;
    
    if (this.currentSource === 'ram' || this.currentSource === 'idle') {
      if (idleDuration >= this.spindownThresholdMs) {
        spindownRecommended = true;
      }
    }
    
    return {
      reallocatedSectors,
      currentPendingSectors,
      seekErrorRate,
      temperature,
      failurePredicted,
      action: failurePredicted ? "switch_to_cloud_only" : "none",
      spindownRecommended
    };
  }

  getSmartStatus() {
    let reallocatedSectors = 0;
    let currentPendingSectors = 0;
    let seekErrorRate = 0;
    let temperature = 35;
    let realSource = "fallback";

    // Attempt real hardware SMART query if platform tools are available
    if (process.platform === "win32") {
      try {
        const out = execSync("powershell -NoProfile -Command \"Get-PhysicalDisk | Select-Object -First 1 OperationalStatus, HealthStatus | ConvertTo-Json\"", { timeout: 1500, stdio: ["ignore", "pipe", "ignore"] }).toString();
        const disk = JSON.parse(out);
        realSource = "wmi";
        if (disk.HealthStatus && disk.HealthStatus !== "Healthy") {
          reallocatedSectors = 150;
        }
      } catch {}
    } else {
      try {
        const out = execSync("smartctl -a -j /dev/sda", { timeout: 1500, stdio: ["ignore", "pipe", "ignore"] }).toString();
        const json = JSON.parse(out);
        realSource = "smartctl";
        if (json.temperature && json.temperature.current) {
          temperature = json.temperature.current;
        }
        if (json.ata_smart_attributes && Array.isArray(json.ata_smart_attributes.table)) {
          for (const attr of json.ata_smart_attributes.table) {
            if (attr.id === 5) reallocatedSectors = attr.raw?.value || 0;
            if (attr.id === 197) currentPendingSectors = attr.raw?.value || 0;
            if (attr.id === 7) seekErrorRate = attr.raw?.value || 0;
          }
        }
      } catch {}
    }

    const prediction = this.predictFailure({
      reallocatedSectors,
      currentPendingSectors,
      seekErrorRate,
      temperature
    });
    return { ...prediction, telemetrySource: realSource };
  }
}

export const guardian = new HddGuardian();

export async function handleHddHealthRoute(req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(guardian.getSmartStatus()));
  return true;
}
