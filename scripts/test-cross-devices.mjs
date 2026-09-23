import { execSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";

const ADB = "C:\\Users\\austi\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe";

function runAdb(args) {
  try {
    return execSync(`"${ADB}" ${args}`, { stdio: ["ignore", "pipe", "pipe"], timeout: 15000 }).toString().trim();
  } catch (err) {
    return `ERROR: ${err.message}`;
  }
}

export async function checkDevices() {
  const report = {
    localPc: {
      ip: "192.168.1.214",
      port8080: false,
    },
    tv: {
      ip: "192.168.1.95:5555",
      connected: false,
      model: null,
      androidVersion: null,
      display: null,
      screenshot: false,
    },
    phone: {
      serial: "R5GL64PC0CF",
      connected: false,
      authorized: false,
      model: null,
    },
    linuxLaptop: {
      ip: "192.168.1.234",
      online: false,
      sshPortOpen: false,
    },
  };

  // 1. Check local port 8080
  await new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(1000);
    s.on("connect", () => {
      report.localPc.port8080 = true;
      s.destroy();
      resolve();
    });
    s.on("timeout", () => { s.destroy(); resolve(); });
    s.on("error", () => { resolve(); });
    s.connect(8080, "127.0.0.1");
  });

  // 2. Connect and check TV
  runAdb("connect 192.168.1.95:5555");
  const devicesOutput = runAdb("devices -l");

  if (devicesOutput.includes("192.168.1.95:5555\tdevice") || devicesOutput.includes("192.168.1.95:5555      device")) {
    report.tv.connected = true;
    report.tv.model = runAdb("-s 192.168.1.95:5555 shell getprop ro.product.model");
    report.tv.androidVersion = runAdb("-s 192.168.1.95:5555 shell getprop ro.build.version.release");
    report.tv.display = runAdb("-s 192.168.1.95:5555 shell wm size");
    
    // Capture screenshot from TV to verify display
    try {
      execSync(`"${ADB}" -s 192.168.1.95:5555 exec-out screencap -p > .reelos-audit/tv-screen.png`, {
        stdio: ["ignore", "ignore", "pipe"],
        timeout: 10000,
        shell: "cmd.exe"
      });
      if (fs.existsSync(".reelos-audit/tv-screen.png")) {
        const stats = fs.statSync(".reelos-audit/tv-screen.png");
        if (stats.size > 10000) {
          report.tv.screenshot = true;
        }
      }
    } catch {}
  }

  // 3. Check Phone
  if (devicesOutput.includes("R5GL64PC0CF")) {
    report.phone.connected = true;
    if (devicesOutput.includes("R5GL64PC0CF\tdevice") || devicesOutput.includes("R5GL64PC0CF            device")) {
      report.phone.authorized = true;
      report.phone.model = runAdb("-s R5GL64PC0CF shell getprop ro.product.model");
    } else {
      report.phone.authorized = false;
    }
  }

  // 4. Check Linux Laptop
  await new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(1000);
    s.on("connect", () => {
      report.linuxLaptop.online = true;
      report.linuxLaptop.sshPortOpen = true;
      s.destroy();
      resolve();
    });
    s.on("timeout", () => { s.destroy(); resolve(); });
    s.on("error", () => { resolve(); });
    s.connect(22, "192.168.1.234");
  });

  return report;
}

if (process.argv[1]?.endsWith("test-cross-devices.mjs")) {
  checkDevices().then((res) => {
    console.log(JSON.stringify(res, null, 2));
  });
}
