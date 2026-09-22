import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";

/**
 * Network & Connectivity Service for ReelOS.
 * Manages LAN IPv4 discovery, Tailscale VPN status,
 * and Wi-Fi client connectivity.
 */

export function getLanIpv4() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    const list = nets[name] || [];
    for (const net of list) {
      if (net.family === "IPv4" && !net.internal) {
        // Skip virtual and docker bridges
        if (
          name.startsWith("docker") ||
          name.startsWith("br-") ||
          name.startsWith("veth") ||
          name.startsWith("tailscale")
        ) {
          continue;
        }
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}

export function findTailscaleBin() {
  const candidates = ["/usr/bin/tailscale", "/bin/tailscale", "/snap/bin/tailscale", "tailscale"];
  if (process.platform === "win32") {
    candidates.unshift(
      "C:\\Program Files\\Tailscale\\tailscale.exe",
      "C:\\Program Files (x86)\\Tailscale\\tailscale.exe",
      `${process.env.LOCALAPPDATA || ""}\\Tailscale\\tailscale.exe`
    );
  }
  for (const p of candidates) {
    try {
      if (!p) continue;
      const r = spawnSync(p, ["--version"], { encoding: "utf8", timeout: 2000 });
      if (r.status === 0) return p;
    } catch {
      /* not found */
    }
  }
  return null;
}

export function getTailscaleStatus(binOverride = null) {
  const bin = binOverride ?? findTailscaleBin();
  if (!bin || !existsSync(bin)) {
    return {
      installed: false,
      up: false,
      ip: null,
      dns: null,
      magicDnsUrl: null,
      tailnet: null,
      auth: null,
      state: "NotInstalled",
    };

  }

  try {
    const r = spawnSync(bin, ["status", "--json"], { encoding: "utf8", timeout: 4000 });
    if (r.status === 0 && r.stdout) {
      const j = JSON.parse(r.stdout);
      const self = j.Self || {};
      const ips = self.TailscaleIPs || [];
      const v4 = ips.find((ip) => ip.includes(".")) || ips[0] || null;
      const dns = (self.DNSName || "").replace(/\.$/, "") || null;
      const backendState = j.BackendState || "Unknown";
      const up = backendState === "Running";

      let auth = null;
      if (j.AuthURL) {
        auth = j.AuthURL;
      }

      return {
        installed: true,
        up,
        ip: v4,
        dns,
        magicDnsUrl: dns ? `https://${dns}` : null,
        tailnet: (self.DNSName || "").split(".")[1] || null,
        auth,
        state: backendState,
      };

    }
  } catch (e) {
    return {
      installed: true,
      up: false,
      error: String(e?.message || e),
      state: "Error",
    };
  }

  return {
    installed: true,
    up: false,
    ip: null,
    dns: null,
    magicDnsUrl: null,
    tailnet: null,
    auth: null,
    state: "Stopped",
  };

}

export function hasBin(name) {
  try {
    const r = spawnSync("which", [name], { encoding: "utf8", timeout: 2000 });
    return r.status === 0 && Boolean(r.stdout?.trim());
  } catch {
    return false;
  }
}

export function findWirelessInterface() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    if (/^(wl|wlan)/i.test(name)) return name;
  }
  return null;
}

export function getWifiStatus() {
  if (process.platform === "win32") {
    try {
      const r = spawnSync("netsh", ["wlan", "show", "interfaces"], { encoding: "utf8", timeout: 4000 });
      let connectedSsid = null;
      if (r.status === 0 && r.stdout) {
        for (const line of r.stdout.split("\n")) {
          const trimmed = line.trim();
          if (trimmed.startsWith("SSID") && !trimmed.startsWith("SSID name") && !trimmed.startsWith("BSSID") && !trimmed.startsWith("AP BSSID")) {
            const parts = trimmed.split(":");
            if (parts.length > 1) {
              const val = parts.slice(1).join(":").trim();
              if (val) {
                connectedSsid = val;
                break;
              }
            }
          }
        }
      }
      return {
        ok: true,
        simulated: false,
        hotspotActive: false,
        connectedSsid,
        lanIp: getLanIpv4(),
      };
    } catch {
      /* fallback below */
    }
  }

  if (process.platform !== "linux") {
    return {
      ok: false,
      supported: false,
      simulated: false,
      hotspotActive: false,
      connectedSsid: null,
      lanIp: getLanIpv4(),
      error: "Wi-Fi management is available only on a ReelOS Linux appliance.",
    };
  }

  const hotspotActive = existsSync("/var/lib/reelos/hotspot-active");

  if (hasBin("nmcli")) {
    try {
      const r = spawnSync("nmcli", ["-t", "-f", "ACTIVE,SSID", "dev", "wifi"], {
        encoding: "utf8",
        timeout: 4000,
      });
      let connectedSsid = null;
      if (r.status === 0 && r.stdout) {
        for (const line of r.stdout.split("\n")) {
          if (line.startsWith("yes:")) {
            connectedSsid = line.split(":")[1] || null;
            break;
          }
        }
      }
      return {
        ok: true,
        hotspotActive,
        connectedSsid,
        lanIp: getLanIpv4(),
      };
    } catch {
      /* fallback below */
    }
  }

  // Fallback: wpa_cli or iwgetid
  try {
    const iface = findWirelessInterface() || "wlan0";
    if (hasBin("wpa_cli")) {
      const r = spawnSync("wpa_cli", ["-i", iface, "status"], { encoding: "utf8", timeout: 3000 });
      if (r.status === 0 && r.stdout) {
        for (const line of r.stdout.split("\n")) {
          if (line.startsWith("ssid=")) {
            const ssid = line.slice(5).trim();
            if (ssid) {
              return { ok: true, hotspotActive, connectedSsid: ssid, lanIp: getLanIpv4() };
            }
          }
        }
      }
    }
    if (hasBin("iwgetid")) {
      const r = spawnSync("iwgetid", ["-r"], { encoding: "utf8", timeout: 2000 });
      if (r.status === 0 && r.stdout?.trim()) {
        return { ok: true, hotspotActive, connectedSsid: r.stdout.trim(), lanIp: getLanIpv4() };
      }
    }
  } catch {
    /* fallback to disconnected status */
  }

  return {
    ok: true,
    hotspotActive,
    connectedSsid: null,
    lanIp: getLanIpv4(),
  };
}

export function scanWifiNetworks() {
  if (process.platform !== "linux") {
    return {
      ok: false,
      supported: false,
      simulated: false,
      networks: [],
      error: "Wi-Fi scanning is available only on a ReelOS Linux appliance.",
    };
  }

  if (hasBin("nmcli")) {
    try {
      const r = spawnSync(
        "nmcli",
        ["-t", "-f", "SSID,SIGNAL,SECURITY", "dev", "wifi", "list", "--rescan", "yes"],
        { encoding: "utf8", timeout: 8000 },
      );
      const networks = [];
      const seen = new Set();
      if (r.status === 0 && r.stdout) {
        for (const line of r.stdout.split("\n")) {
          const parts = line.split(":");
          const ssid = (parts[0] || "").trim();
          if (!ssid || ssid === "ReelOS-Setup" || seen.has(ssid)) continue;
          seen.add(ssid);
          networks.push({
            ssid,
            signal: Number(parts[1] || 0),
            security: parts[2] || "Open",
          });
        }
      }
      return { ok: true, networks };
    } catch {
      /* fallback below */
    }
  }

  // Fallback: wpa_cli scan results
  try {
    const iface = findWirelessInterface() || "wlan0";
    if (hasBin("wpa_cli")) {
      spawnSync("wpa_cli", ["-i", iface, "scan"], { encoding: "utf8", timeout: 3000 });
      const r = spawnSync("wpa_cli", ["-i", iface, "scan_results"], { encoding: "utf8", timeout: 4000 });
      if (r.status === 0 && r.stdout) {
        const networks = [];
        const seen = new Set();
        const lines = r.stdout.split("\n").slice(1);
        for (const line of lines) {
          const parts = line.split("\t");
          if (parts.length >= 5) {
            const ssid = (parts[4] || "").trim();
            const signalDb = Number(parts[2] || -90);
            const signal = Math.max(10, Math.min(100, 2 * (signalDb + 100)));
            const flags = parts[3] || "";
            const security = flags.includes("WPA2") ? "WPA2" : flags.includes("WPA") ? "WPA" : "Open";
            if (ssid && !seen.has(ssid) && ssid !== "ReelOS-Setup") {
              seen.add(ssid);
              networks.push({ ssid, signal, security });
            }
          }
        }
        return { ok: true, networks };
      }
    }
  } catch {
    /* empty */
  }

  return { ok: true, networks: [] };
}

export function connectWifi(ssid, password = "") {
  if (!ssid || typeof ssid !== "string") {
    return { ok: false, error: "SSID is required" };
  }

  if (process.platform !== "linux") {
    return {
      ok: false,
      supported: false,
      simulated: false,
      connected: false,
      ssid,
      error: "This host cannot change ReelOS appliance Wi-Fi.",
    };
  }

  if (hasBin("nmcli")) {
    try {
      const args = ["dev", "wifi", "connect", ssid];
      if (password) {
        args.push("password", password);
      }
      const r = spawnSync("nmcli", args, { encoding: "utf8", timeout: 15000 });
      if (r.status === 0) {
        return { ok: true, connected: true, ssid };
      }
      return { ok: false, error: r.stderr || "Failed to connect to Wi-Fi" };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  }

  // Fallback: wpa_cli connection
  try {
    const iface = findWirelessInterface() || "wlan0";
    if (hasBin("wpa_cli")) {
      const idRes = spawnSync("wpa_cli", ["-i", iface, "add_network"], { encoding: "utf8", timeout: 3000 });
      const netId = idRes.stdout?.trim();
      if (netId && !isNaN(Number(netId))) {
        spawnSync("wpa_cli", ["-i", iface, "set_network", netId, "ssid", `"${ssid}"`], { timeout: 3000 });
        if (password) {
          spawnSync("wpa_cli", ["-i", iface, "set_network", netId, "psk", `"${password}"`], { timeout: 3000 });
        } else {
          spawnSync("wpa_cli", ["-i", iface, "set_network", netId, "key_mgmt", "NONE"], { timeout: 3000 });
        }
        spawnSync("wpa_cli", ["-i", iface, "enable_network", netId], { timeout: 3000 });
        spawnSync("wpa_cli", ["-i", iface, "save_config"], { timeout: 3000 });
        return { ok: true, connected: true, ssid };
      }
    }
    return { ok: false, error: "Wi-Fi daemon (NetworkManager / wpa_supplicant) not reachable" };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}


export function getMagicDnsUrl(alias = "box", dns = null) {
  if (dns) {
    return dns.startsWith("https://") || dns.startsWith("http://") ? dns : `https://${dns}`;
  }
  const cleanAlias = (alias || "box").toLowerCase().replace(/[^a-z0-9-]/g, "") || "box";
  return `https://reel-${cleanAlias}.ts.net`;
}

export function exchangeHeadlessAuthKey(authKey = null, alias = null, options = {}) {
  const { simulated = false, timeoutMs = 15000, binOverride = null } = options;
  const key = authKey || process.env.TS_AUTHKEY || process.env.TAILSCALE_AUTHKEY;
  if (!key && !simulated) {
    return { ok: false, error: "No Tailscale auth key provided" };
  }

  const cleanAlias = (alias || "box").toLowerCase().replace(/[^a-z0-9-]/g, "") || "box";
  const hostname = `reel-${cleanAlias}`;
  const magicDnsUrl = `https://${hostname}.ts.net`;

  if (simulated) {
    return {
      ok: true,
      simulated: true,
      hostname,
      dns: `${hostname}.ts.net`,
      magicDnsUrl,
      ip: "100.64.0.42",
      message: "Headless ephemeral key exchange completed without user authentication modals.",
    };
  }

  const bin = binOverride ?? findTailscaleBin();
  if (!bin) {
    return {
      ok: false,
      simulated: false,
      available: false,
      hostname,
      dns: null,
      magicDnsUrl: null,
      ip: null,
      error: "Tailscale is not installed; no key exchange was performed.",
    };
  }

  try {
    const r = spawnSync(
      bin,
      ["up", "--authkey", key, "--hostname", hostname, "--accept-dns=false", "--reset"],
      { encoding: "utf8", timeout: timeoutMs }
    );

    if (r.status === 0) {
      const status = getTailscaleStatus(bin);
      const assignedDns = status.dns || `${hostname}.ts.net`;
      return {
        ok: true,
        hostname,
        dns: assignedDns,
        magicDnsUrl: `https://${assignedDns}`,
        ip: status.ip || "100.64.0.1",
        tailnet: status.tailnet,
        headless: true,
      };
    }
    return { ok: false, error: r.stderr || "Failed to exchange headless key" };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
