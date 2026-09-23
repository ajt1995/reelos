import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const ADB = "C:\\Users\\austi\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe";

function runAdb(args) {
  try {
    return execSync(`"${ADB}" ${args}`, { stdio: ["ignore", "pipe", "pipe"], timeout: 10000 }).toString().trim();
  } catch (err) {
    return `ERROR: ${err.message}`;
  }
}

console.log("=== REELOS CROSS-DEVICE DISCOVERY ===");

// 1. Connect to Android TV
console.log("\n[1] Connecting to TV (192.168.1.95:5555)...");
const connectRes = runAdb("connect 192.168.1.95:5555");
console.log("Connect result:", connectRes);

// 2. List all ADB devices
console.log("\n[2] Listing ADB devices...");
const devices = runAdb("devices -l");
console.log(devices);

// 3. Inspect TV if connected
if (devices.includes("192.168.1.95:5555")) {
  console.log("\n[3] Querying onn 4K Pro TV Specs...");
  const model = runAdb("-s 192.168.1.95:5555 shell getprop ro.product.model");
  const androidVer = runAdb("-s 192.168.1.95:5555 shell getprop ro.build.version.release");
  const wmSize = runAdb("-s 192.168.1.95:5555 shell wm size");
  const memTotal = runAdb("-s 192.168.1.95:5555 shell cat /proc/meminfo");
  const firstMem = memTotal.split("\n").slice(0, 3).join(" | ");

  console.log("Model:", model);
  console.log("Android Version:", androidVer);
  console.log("Display Size:", wmSize);
  console.log("Memory:", firstMem);
}

// 4. Check Phone Status
if (devices.includes("R5GL64PC0CF")) {
  console.log("\n[4] USB Phone Status:");
  if (devices.includes("R5GL64PC0CF\tdevice") || devices.includes("R5GL64PC0CF            device")) {
    const phoneModel = runAdb("-s R5GL64PC0CF shell getprop ro.product.model");
    console.log("Phone Authorized! Model:", phoneModel);
  } else {
    console.log("Phone detected via USB (R5GL64PC0CF), but status is UNAUTHORIZED.");
    console.log("-> Please check phone screen and tap 'Allow USB debugging'.");
  }
}
