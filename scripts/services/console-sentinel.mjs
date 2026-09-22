import EventEmitter from 'node:events';
import net from 'node:net';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export const CONSOLE_OUIS = {
  playstation: ['00:04:1f', 'f8:46:1c', '70:9e:29', '00:d9:d1'],
  xbox: ['00:50:f2', '7c:1e:52', '28:18:78', 'dc:98:40'],
  switch: ['98:b6:e9', 'e0:f6:c5', '00:09:bf'],
};

export function identifyConsoleVendor(macAddress) {
  if (!macAddress || typeof macAddress !== 'string') return null;
  const cleanMac = macAddress.toLowerCase().replace(/[:-]/g, '');
  const oui = `${cleanMac.slice(0, 2)}:${cleanMac.slice(2, 4)}:${cleanMac.slice(4, 6)}`;

  for (const [vendor, prefixes] of Object.entries(CONSOLE_OUIS)) {
    if (prefixes.includes(oui)) {
      return vendor;
    }
  }
  return null;
}

export function parseArpTable(arpText) {
  const devices = [];
  if (!arpText || typeof arpText !== 'string') return devices;

  const lines = arpText.split(/\r?\n/);
  for (const line of lines) {
    const ipMatch = line.match(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/);
    const macMatch = line.match(/\b([0-9a-fA-F]{1,2}(?:[:-][0-9a-fA-F]{1,2}){5})\b/);
    if (ipMatch && macMatch) {
      const ip = ipMatch[1];
      // Normalize MAC to 2-digit pairs
      const sep = macMatch[1].includes('-') ? '-' : ':';
      const mac = macMatch[1]
        .split(/[:-]/)
        .map((part) => part.padStart(2, '0'))
        .join(sep);
      const vendor = identifyConsoleVendor(mac);
      devices.push({
        ip,
        mac,
        isConsole: Boolean(vendor),
        vendor: vendor || 'generic',
      });
    }
  }
  return devices;
}

export function evaluateBufferbloat(baselineRtt, currentRtt, thresholdMs = 15) {
  const delta = currentRtt - baselineRtt;
  return {
    baselineRtt,
    currentRtt,
    delta,
    spikeDetected: delta >= thresholdMs,
  };
}

export async function measureGatewayLatency(host = "1.1.1.1", port = 53, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => {
      const rtt = Date.now() - start;
      socket.destroy();
      resolve(rtt);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(null);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(null);
    });
    socket.connect(port, host);
  });
}

export async function scanLocalArp() {
  try {
    const cmd = process.platform === 'win32' ? 'arp -a' : 'cat /proc/net/arp 2>/dev/null || arp -a';
    const { stdout } = await execAsync(cmd, { timeout: 3000 });
    return parseArpTable(stdout);
  } catch {
    return [];
  }
}

export class ConsoleSentinel extends EventEmitter {
  constructor(options = {}) {
    super();
    this.thresholdMs = options.thresholdMs || 15;
    this.cooldownMs = options.cooldownMs || 60000;
    this.baselineRtt = options.baselineRtt || 18;
    this.activeConsoles = new Map();
    this.yieldActive = false;
    this.lastSpikeTime = 0;
    this.pingTimer = null;
  }

  registerConsole(ip, vendor, mac = '') {
    this.activeConsoles.set(ip, {
      ip,
      vendor,
      mac,
      lastActive: Date.now(),
    });
  }

  unregisterConsole(ip) {
    this.activeConsoles.delete(ip);
    if (this.activeConsoles.size === 0 && this.yieldActive) {
      this.yieldActive = false;
      this.emit('CONSOLES_GAMING_RESUME');
    }
  }

  startPingLoop(intervalMs = 5000, pingFn = null) {
    if (this.pingTimer) return;
    const measure = pingFn || (() => measureGatewayLatency());

    // Auto-discover consoles on local ARP table on start
    scanLocalArp().then((devices) => {
      for (const d of devices) {
        if (d.isConsole) {
          this.registerConsole(d.ip, d.vendor);
        }
      }
    }).catch(() => {});

    this.pingTimer = setInterval(async () => {
      try {
        const rtt = await measure();
        if (typeof rtt === 'number' && !isNaN(rtt)) {
          this.evaluatePing(rtt);
        }
      } catch {}
    }, intervalMs);
    if (this.pingTimer.unref) this.pingTimer.unref();
  }

  stopPingLoop() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  simulateConsoleYield(spikeRtt = 45, vendor = 'playstation') {
    if (this.activeConsoles.size === 0) {
      this.registerConsole('192.168.1.55', vendor);
    }
    return this.evaluatePing(spikeRtt);
  }

  simulateConsoleResume(normalRtt = null) {
    const rtt = normalRtt !== null ? normalRtt : this.baselineRtt;
    this.lastSpikeTime = Date.now() - (this.cooldownMs + 1000);
    return this.evaluatePing(rtt);
  }

  evaluatePing(currentRtt) {
    const analysis = evaluateBufferbloat(this.baselineRtt, currentRtt, this.thresholdMs);
    const now = Date.now();

    if (this.activeConsoles.size > 0 && analysis.spikeDetected) {
      this.lastSpikeTime = now;
      if (!this.yieldActive) {
        this.yieldActive = true;
        this.emit('CONSOLES_GAMING_YIELD', {
          reason: 'bufferbloat_spike',
          deltaMs: analysis.delta,
          activeConsoles: Array.from(this.activeConsoles.values()),
        });
      }
    } else if (this.yieldActive && now - this.lastSpikeTime >= this.cooldownMs) {
      this.yieldActive = false;
      this.emit('CONSOLES_GAMING_RESUME', {
        reason: 'latency_stabilized',
        currentRtt,
      });
    }

    return {
      yieldActive: this.yieldActive,
      analysis,
      consolesOnline: this.activeConsoles.size,
    };
  }

  getStatus() {
    return {
      yieldActive: this.yieldActive,
      consolesCount: this.activeConsoles.size,
      activeConsoles: Array.from(this.activeConsoles.values()),
      lastSpikeTime: this.lastSpikeTime,
      baselineRtt: this.baselineRtt,
      thresholdMs: this.thresholdMs,
      pingLoopActive: Boolean(this.pingTimer),
    };
  }
}

export const consoleSentinel = new ConsoleSentinel();

export async function handleConsoleSentinelRoute(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/api/network/console-sentinel') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, ...consoleSentinel.getStatus() }));
    return true;
  }
  if (url.pathname === '/api/network/console-sentinel/simulate') {
    const spike = Number(url.searchParams.get('spike')) || 45;
    const vendor = url.searchParams.get('vendor') || 'playstation';
    const action = url.searchParams.get('action') || 'yield';
    if (action === 'resume') {
      const result = consoleSentinel.simulateConsoleResume();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, action: 'resume', result, ...consoleSentinel.getStatus() }));
      return true;
    }
    const result = consoleSentinel.simulateConsoleYield(spike, vendor);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, action: 'yield', result, ...consoleSentinel.getStatus() }));
    return true;
  }
  return false;
}
