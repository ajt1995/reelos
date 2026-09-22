import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import net from "node:net";
import tls from "node:tls";
import { getTailscaleStatus, findTailscaleBin, getLanIpv4 } from "./network-service.mjs";
import { getRequestProfileAuthorization } from "./profile-service.mjs";
import { isSameOriginProfileMutation, isSecureRequest } from "./profile-session-service.mjs";

const DEFAULT_STATE_DIR = process.env.REELOS_STATE || (process.platform === "win32" ? path.join(process.cwd(), ".reelos-state") : "/var/lib/reelos");

export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const RATE_LIMIT_MAX_ATTEMPTS = 3; // Max 3 requests per 15 min
export const DEVICE_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

// In-memory rate limiting: key (IP or email) -> Array<timestamp>
const rateLimitMap = new Map();

// In-memory active OTP challenges: email/token -> challenge object
const activeOtpChallenges = new Map();

// Ensure state directory exists
function ensureStateDir(dir = DEFAULT_STATE_DIR) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  } catch {
    /* ignore */
  }
}

/**
 * Loads or initializes the server-side HMAC secret for signing device tokens.
 */
export function getGateSecret(stateDir = DEFAULT_STATE_DIR) {
  ensureStateDir(stateDir);
  const secretPath = path.join(stateDir, "gate_secret.key");
  try {
    if (fs.existsSync(secretPath)) {
      const secret = fs.readFileSync(secretPath, "utf8").trim();
      if (secret.length >= 32) return secret;
    }
  } catch {
    /* fallback to env or generation */
  }

  const fallback = process.env.BETTER_AUTH_SECRET || crypto.randomBytes(32).toString("hex");
  try {
    fs.writeFileSync(secretPath, fallback, { mode: 0o600 });
  } catch {
    /* read-only fs or fallback */
  }
  return fallback;
}

/**
 * Gate configuration (Funnel toggle, email mode, SMTP settings).
 */
export function getGateConfig(stateDir = DEFAULT_STATE_DIR) {
  ensureStateDir(stateDir);
  const configPath = path.join(stateDir, "gate_config.json");
  const defaults = {
    funnelEnabled: false,
    customDomain: "",
    householdEmail: "",
    emailMode: "managed", // "managed" | "custom"
    smtp: {
      provider: "custom", // "gmail" | "outlook" | "icloud" | "yahoo" | "custom"
      host: "",
      port: 587,
      secure: false,
      user: "",
      pass: "",
      from: "",
    },
  };

  try {
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
      return {
        ...defaults,
        ...parsed,
        smtp: {
          ...defaults.smtp,
          ...(parsed.smtp || {}),
        },
      };
    }
  } catch {
    /* ignore */
  }
  return defaults;
}

export function saveGateConfig(patch = {}, stateDir = DEFAULT_STATE_DIR) {
  ensureStateDir(stateDir);
  const configPath = path.join(stateDir, "gate_config.json");
  const current = getGateConfig(stateDir);
  const updated = {
    ...current,
    ...patch,
    smtp: {
      ...current.smtp,
      ...(patch.smtp || {}),
    },
  };
  fs.writeFileSync(configPath, JSON.stringify(updated, null, 2) + "\n", { mode: 0o600 });
  return updated;
}

/**
 * Authorized paired devices storage.
 */
export function listAuthorizedDevices(stateDir = DEFAULT_STATE_DIR) {
  ensureStateDir(stateDir);
  const filePath = path.join(stateDir, "authorized_devices.json");
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (Array.isArray(data)) return data;
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function saveAuthorizedDevices(devices = [], stateDir = DEFAULT_STATE_DIR) {
  ensureStateDir(stateDir);
  const filePath = path.join(stateDir, "authorized_devices.json");
  fs.writeFileSync(filePath, JSON.stringify(devices, null, 2) + "\n", { mode: 0o600 });
}

export function registerAuthorizedDevice(deviceData, stateDir = DEFAULT_STATE_DIR) {
  const devices = listAuthorizedDevices(stateDir);
  const id = deviceData.id || `dev_${crypto.randomBytes(8).toString("hex")}`;
  const now = Date.now();
  const entry = {
    id,
    name: deviceData.name || detectPlatformName(deviceData.userAgent),
    platform: deviceData.platform || detectPlatformType(deviceData.userAgent),
    userAgent: deviceData.userAgent || "Unknown Client",
    email: deviceData.email || "",
    firstSeenIp: deviceData.ip || "unknown",
    lastSeenIp: deviceData.ip || "unknown",
    createdAt: deviceData.createdAt || now,
    lastSeenAt: now,
    expiresAt: deviceData.expiresAt || (now + DEVICE_TOKEN_TTL_MS),
    revoked: false,
    activeProfileId: deviceData.activeProfileId || null,
  };

  const existingIdx = devices.findIndex((d) => d.id === id);
  if (existingIdx >= 0) {
    devices[existingIdx] = { ...devices[existingIdx], ...entry };
  } else {
    devices.unshift(entry);
  }

  saveAuthorizedDevices(devices, stateDir);
  return entry;
}

export function revokeAuthorizedDevice(deviceId, stateDir = DEFAULT_STATE_DIR) {
  const devices = listAuthorizedDevices(stateDir);
  const found = devices.find((d) => d.id === deviceId);
  if (found) {
    found.revoked = true;
    found.revokedAt = Date.now();
    saveAuthorizedDevices(devices, stateDir);
    return true;
  }
  return false;
}

export function updateDeviceLastSeen(deviceId, ip = "unknown", stateDir = DEFAULT_STATE_DIR) {
  const devices = listAuthorizedDevices(stateDir);
  const found = devices.find((d) => d.id === deviceId);
  if (found && !found.revoked) {
    found.lastSeenAt = Date.now();
    found.lastSeenIp = ip;
    saveAuthorizedDevices(devices, stateDir);
    return true;
  }
  return false;
}

/**
 * Token Signing & HMAC Verification
 */
export function signDeviceToken(deviceData, secret) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      devId: deviceData.id,
      email: deviceData.email || "",
      platform: deviceData.platform || "unknown",
      iat: Math.floor((deviceData.createdAt || Date.now()) / 1000),
      exp: Math.floor((deviceData.expiresAt || (Date.now() + DEVICE_TOKEN_TTL_MS)) / 1000),
    })
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

export function verifyDeviceToken(tokenString, secret) {
  if (!tokenString || typeof tokenString !== "string" || tokenString.length > 4096) return null;
  const parts = tokenString.trim().split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  if (signature.length !== expectedSig.length || !/^[A-Za-z0-9_-]+$/.test(signature)
    || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return null;
  }

  try {
    const descriptor = JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
    if (descriptor.alg !== "HS256" || descriptor.typ !== "JWT") return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof data.devId !== "string" || !data.devId || !Number.isFinite(data.exp)
      || !Number.isFinite(data.iat) || data.iat > nowSec + 60 || data.exp <= nowSec) {
      return null; // Expired
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Helper to detect client platform badges from userAgent.
 */
export function detectPlatformType(ua = "") {
  const s = ua.toLowerCase();
  if (s.includes("iphone") || s.includes("ipad") || s.includes("ipod")) return "ios";
  if (s.includes("android")) return "android";
  if (s.includes("macintosh") || s.includes("mac os")) return "macos";
  if (s.includes("windows")) return "windows";
  if (s.includes("linux")) return "linux";
  if (s.includes("cros")) return "chromeos";
  if (s.includes("appletv") || s.includes("smart-tv") || s.includes("googletv") || s.includes("tizen")) return "tv";
  return "other";
}

export function detectPlatformName(ua = "") {
  const type = detectPlatformType(ua);
  switch (type) {
    case "ios":
      return ua.includes("iPad") ? "Apple iPad" : "Apple iPhone";
    case "android":
      return "Android Device";
    case "macos":
      return "Mac Computer";
    case "windows":
      return "Windows PC";
    case "linux":
      return "Linux Workstation";
    case "chromeos":
      return "Chromebook";
    case "tv":
      return "Smart TV";
    default:
      return "Personal Device";
  }
}

/**
 * IP & Remote Recognition
 */
export function isPrivateOrLanIp(rawIp) {
  if (!rawIp || typeof rawIp !== "string") return true;
  let ip = rawIp.trim();

  // Strip IPv4-mapped IPv6 (::ffff:192.168.1.1)
  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }

  // Loopback
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") return true;

  // Link-local
  if (ip.startsWith("169.254.")) return true;

  // Class A private (10.0.0.0/8)
  if (ip.startsWith("10.")) return true;

  // Class C private (192.168.0.0/16)
  if (ip.startsWith("192.168.")) return true;

  // Class B private (172.16.0.0/12: 172.16.0.0 to 172.31.255.255)
  const bMatch = /^172\.(\d+)\./.exec(ip);
  if (bMatch) {
    const octet = parseInt(bMatch[1], 10);
    if (octet >= 16 && octet <= 31) return true;
  }

  // Tailscale CGNAT range (100.64.0.0/10: 100.64.0.0 to 100.127.255.255)
  const tsMatch = /^100\.(\d+)\./.exec(ip);
  if (tsMatch) {
    const octet = parseInt(tsMatch[1], 10);
    if (octet >= 64 && octet <= 127) return true;
  }

  // IPv6 ULA (fc00::/7) or Link-Local (fe80::/10)
  if (ip.startsWith("fe80:") || ip.startsWith("fc00:") || ip.startsWith("fd")) {
    return true;
  }

  return false;
}

export function extractClientIp(req) {
  if (!req) return "127.0.0.1";
  const rawSocket = req.socket?.remoteAddress || req.connection?.remoteAddress;
  const socketIp = String(rawSocket || "127.0.0.1").trim();
  const cleanSocketIp = socketIp.startsWith("::ffff:") ? socketIp.slice(7) : socketIp;

  // Only trust upstream proxy headers (X-Forwarded-For, etc.) if the direct socket is a trusted local reverse proxy (e.g. Caddy) or mock
  const isTrustedProxy = !rawSocket || cleanSocketIp === "127.0.0.1" || cleanSocketIp === "::1" || cleanSocketIp === "localhost";
  if (isTrustedProxy) {
    const cf = req.headers?.["cf-connecting-ip"];
    if (cf) return String(cf).trim();
    const real = req.headers?.["x-real-ip"];
    if (real) return String(real).trim();
    const forwarded = req.headers?.["x-forwarded-for"];
    if (forwarded) {
      const first = String(forwarded).split(",")[0].trim();
      if (first) return first;
    }
  }
  return cleanSocketIp;
}

export function extractDeviceToken(req) {
  if (!req) return null;
  // Check Authorization Bearer header
  const auth = req.headers?.authorization || "";
  if (auth.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }

  // Check Cookie header
  const cookieHeader = req.headers?.cookie || "";
  if (cookieHeader) {
    const match = /(?:^|;\s*)reelos_device_token=([^;]+)/.exec(cookieHeader);
    if (match) {
      try { return decodeURIComponent(match[1].trim()); } catch { return null; }
    }
  }

  return null;
}

/** Device membership is separate from an active person's authority. */
export function getAuthorizedDevice(req, stateDir = DEFAULT_STATE_DIR) {
  const token = extractDeviceToken(req);
  if (!token) return null;
  let secret;
  try { secret = fs.readFileSync(path.join(stateDir, "gate_secret.key"), "utf8").trim(); }
  catch { return null; }
  const payload = verifyDeviceToken(token, secret);
  if (!payload) return null;
  return listAuthorizedDevices(stateDir).find((device) => device.id === payload.devId
    && !device.revoked && Number.isFinite(device.expiresAt) && device.expiresAt > Date.now()) || null;
}

export function setAuthorizedDeviceActiveProfile(deviceId, profileId, stateDir = DEFAULT_STATE_DIR) {
  const devices = listAuthorizedDevices(stateDir);
  const device = devices.find((entry) => entry.id === deviceId && !entry.revoked && entry.expiresAt > Date.now());
  if (!device) throw new Error("Household device authorization is required");
  device.activeProfileId = profileId;
  saveAuthorizedDevices(devices, stateDir);
}

export function deviceTokenCookie(token, req) {
  return `reelos_device_token=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(DEVICE_TOKEN_TTL_MS / 1000)}${isSecureRequest(req) ? "; Secure" : ""}`;
}

export function isRemoteChallengeRequired(req, stateDir = DEFAULT_STATE_DIR) {
  const clientIp = extractClientIp(req);

  const url = req.url || "";
  const pathOnly = url.split("?")[0];

  // Whitelist gate auth endpoints, join routes, health checks, and public static assets
  if (
    ["/api/gate/status", "/api/gate/request-otp", "/api/gate/verify-otp"].includes(pathOnly) ||
    pathOnly === "/api/profiles" || pathOnly.startsWith("/api/profiles/") ||
    pathOnly === "/api/ping" ||
    pathOnly === "/api/health" ||
    pathOnly === "/join" ||
    pathOnly.startsWith("/join/") ||
    pathOnly.startsWith("/assets/") ||
    pathOnly.startsWith("/favicon") ||
    pathOnly.startsWith("/__grok/")
  ) {
    return false;
  }

  // Verify device token
  const device = getAuthorizedDevice(req, stateDir);
  if (device) return false;

  return true;
}

/**
 * Sliding Rate-Limiter (Max 3 requests per 15 minutes)
 */
export function checkRateLimit(key, maxAttempts = RATE_LIMIT_MAX_ATTEMPTS, windowMs = RATE_LIMIT_WINDOW_MS) {
  const now = Date.now();
  const history = rateLimitMap.get(key) || [];
  const valid = history.filter((t) => now - t < windowMs);

  if (valid.length >= maxAttempts) {
    const oldest = valid[0];
    const waitSec = Math.ceil((windowMs - (now - oldest)) / 1000);
    return { ok: false, waitSec };
  }

  valid.push(now);
  rateLimitMap.set(key, valid);
  return { ok: true };
}

/**
 * OTP & Magic Link Generation
 */
export function createOtpChallenge({ email, clientIp, stateDir = DEFAULT_STATE_DIR }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) {
    return { ok: false, error: "Valid email address is required" };
  }

  // Enforce rate limiting per IP and per Email
  const scope = path.resolve(stateDir);
  const emailKey = `${scope}:email:${cleanEmail}`;
  const ipCheck = checkRateLimit(`${scope}:ip:${clientIp}`);
  if (!ipCheck.ok) {
    return {
      ok: false,
      error: `Rate limit reached. Please wait ${ipCheck.waitSec}s before requesting another code.`,
    };
  }

  const emailCheck = checkRateLimit(emailKey);
  if (!emailCheck.ok) {
    return {
      ok: false,
      error: `Too many requests for this email. Please wait ${emailCheck.waitSec}s before trying again.`,
    };
  }

  // Generate 6-digit numeric OTP and cryptographic magic link token
  const code = String(100000 + crypto.randomInt(900000));
  const token = crypto.randomBytes(24).toString("hex");
  const now = Date.now();
  const expiresAt = now + OTP_TTL_MS;

  const challenge = {
    code,
    token,
    email: cleanEmail,
    emailKey,
    stateDir: scope,
    clientIp,
    createdAt: now,
    expiresAt,
    attempts: 0,
  };

  const previous = activeOtpChallenges.get(emailKey);
  if (previous) activeOtpChallenges.delete(previous.token);
  activeOtpChallenges.set(emailKey, challenge);
  activeOtpChallenges.set(token, challenge);

  // Prune expired challenges periodically
  for (const [key, item] of activeOtpChallenges.entries()) {
    if (item.expiresAt < now) {
      activeOtpChallenges.delete(key);
    }
  }

  return { ok: true, challenge, code, token, expiresAt };
}

export function verifyOtpChallenge({ email, code, token, clientIp, userAgent, stateDir = DEFAULT_STATE_DIR }) {
  const now = Date.now();
  let challenge = null;

  if (token) {
    challenge = activeOtpChallenges.get(token);
  } else if (email) {
    challenge = activeOtpChallenges.get(`${path.resolve(stateDir)}:email:${String(email).trim().toLowerCase()}`);
  }

  if (!challenge || challenge.stateDir !== path.resolve(stateDir)) {
    return { ok: false, error: "Verification code expired or not found. Please request a new one." };
  }

  if (challenge.expiresAt <= now) {
    activeOtpChallenges.delete(challenge.token);
    activeOtpChallenges.delete(challenge.emailKey);
    return { ok: false, error: "Verification code expired. Please request a new code." };
  }

  challenge.attempts += 1;
  if (challenge.attempts > 5) {
    activeOtpChallenges.delete(challenge.token);
    activeOtpChallenges.delete(challenge.emailKey);
    return { ok: false, error: "Too many invalid attempts. Please request a new code." };
  }

  // Match token or code
  let match = false;
  if (token && challenge.token === token) {
    match = true;
  } else if (code && challenge.code === String(code).trim()) {
    match = true;
  }

  if (!match) {
    return { ok: false, error: "Incorrect 6-digit verification code. Please check and try again." };
  }

  // Verified! Clean up challenge
  activeOtpChallenges.delete(challenge.token);
  activeOtpChallenges.delete(challenge.emailKey);

  // Register device
  const device = registerAuthorizedDevice(
    {
      email: challenge.email,
      ip: clientIp,
      userAgent: userAgent || "Unknown Device",
    },
    stateDir
  );

  const secret = getGateSecret(stateDir);
  const deviceToken = signDeviceToken(device, secret);

  return { ok: true, device, token: deviceToken };
}

/**
 * Pure Node SMTP Client for Mode B
 */
export async function sendCustomSmtpEmail({ smtp, to, subject, html, text }) {
  const { host, port = 587, secure = false, user, pass, from } = smtp;
  if (!host) throw new Error("SMTP host is missing");
  const sender = from || user || "reelos@local";
  if ([host, sender, to, subject].some((value) => /[\r\n]/.test(String(value || "")))) throw new Error("Invalid email delivery settings");
  if (!secure && ![465, 587].includes(Number(port))) throw new Error("Email delivery requires verified TLS");

  return new Promise((resolve, reject) => {
    let socket;
    let step = 0;
    let responseBuffer = "";

    const cleanUp = () => {
      if (socket) {
        try {
          socket.removeAllListeners();
          socket.end();
          socket.destroy();
        } catch {}
      }
    };

    const timeoutId = setTimeout(() => {
      cleanUp();
      reject(new Error("SMTP connection timed out"));
    }, 15000);

    const onConnect = () => {
      // Waiting for greeting 220
    };

    if (secure || Number(port) === 465) {
      socket = tls.connect({ host, servername: host, port: Number(port), timeout: 10000, rejectUnauthorized: true }, onConnect);
    } else {
      socket = net.connect({ host, port: Number(port), timeout: 10000 }, onConnect);
    }

    socket.setEncoding("utf8");

    const sendCmd = (cmd) => {
      socket.write(cmd + "\r\n");
    };

    const handleData = (chunk) => {
      responseBuffer += chunk;
      const lines = responseBuffer.split("\r\n");
      // If the last line is not complete, wait for more data
      if (!responseBuffer.endsWith("\r\n")) return;
      responseBuffer = "";

      const lastLine = lines.filter(Boolean).pop() || "";
      const code = parseInt(lastLine.slice(0, 3), 10);

      // Handle multiline responses (hyphen at position 3 e.g. 250-AUTH)
      if (lastLine.charAt(3) === "-") return;

      try {
        if (step === 0 && code === 220) {
          step = 1;
          sendCmd(`EHLO reelos.local`);
        } else if ((step === 1 || step === 3) && code === 250) {
          if (step === 1 && !secure && Number(port) === 587) {
            step = 2;
            sendCmd("STARTTLS");
          } else if (user && pass) {
            step = 4;
            sendCmd("AUTH LOGIN");
          } else {
            step = 6;
            sendCmd(`MAIL FROM:<${sender}>`);
          }
        } else if (step === 2 && code === 220) {
          // Upgrade to TLS
          socket.removeAllListeners("data");
          const tlsSocket = tls.connect(
            {
              socket,
              servername: host,
              rejectUnauthorized: true,
            },
            () => {
              socket = tlsSocket;
              socket.setEncoding("utf8");
              step = 3;
              sendCmd("EHLO reelos.local");
              socket.on("data", handleData);
            }
          );
          tlsSocket.on("error", (error) => { clearTimeout(timeoutId); cleanUp(); reject(error); });
        } else if (step === 4 && code === 334) {
          step = 5;
          sendCmd(Buffer.from(user).toString("base64"));
        } else if (step === 5 && code === 334) {
          step = 6;
          sendCmd(Buffer.from(pass).toString("base64"));
        } else if (step === 6 && code === 235) {
          step = 7;
          sendCmd(`MAIL FROM:<${sender}>`);
        } else if ((step === 6 || step === 7) && code === 250) {
          step = 8;
          sendCmd(`RCPT TO:<${to}>`);
        } else if (step === 8 && code === 250) {
          step = 9;
          sendCmd("DATA");
        } else if (step === 9 && code === 354) {
          step = 10;
          const mime = [
            `From: ${sender}`,
            `To: ${to}`,
            `Subject: ${subject}`,
            `MIME-Version: 1.0`,
            `Content-Type: multipart/alternative; boundary="reelos-bound"`,
            "",
            "--reelos-bound",
            `Content-Type: text/plain; charset=utf-8`,
            "",
            text,
            "",
            "--reelos-bound",
            `Content-Type: text/html; charset=utf-8`,
            "",
            html,
            "",
            "--reelos-bound--",
            ".",
          ].join("\r\n");
          sendCmd(mime);
        } else if (step === 10 && code === 250) {
          clearTimeout(timeoutId);
          cleanUp();
          resolve({ ok: true, status: "sent" });
        } else if (code >= 400) {
          clearTimeout(timeoutId);
          cleanUp();
          reject(new Error(`SMTP error ${code}: ${lastLine}`));
        }
      } catch (err) {
        clearTimeout(timeoutId);
        cleanUp();
        reject(err);
      }
    };
    socket.on("data", handleData);

    socket.on("error", (err) => {
      clearTimeout(timeoutId);
      cleanUp();
      reject(err);
    });
  });
}

/**
 * Email Dispatcher: Mode A (Managed Relay) & Mode B (Custom SMTP)
 */
export async function sendGateEmail({ to, otpCode, magicLink, config, stateDir = DEFAULT_STATE_DIR }) {
  const subject = `Your ReelOS Household Pairing Code: ${otpCode}`;
  const text = [
    `Welcome to ReelOS!`,
    ``,
    `Use this 6-digit code on your remote device to pair it with your household appliance:`,
    `CODE: ${otpCode}`,
    ``,
    ...(magicLink ? [`Or open this invitation link:`, magicLink] : []),
    ``,
    `This code and link will expire in 10 minutes.`,
  ].join("\n");

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="background-color:#0B0D10; color:#E8E6E3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 32px 16px; margin: 0;">
        <div style="max-width: 480px; margin: 0 auto; background: #15181E; border: 1px solid rgba(255, 215, 0, 0.2); border-radius: 16px; padding: 32px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);">
          <div style="display:flex; align-items:center; gap: 8px; margin-bottom: 24px;">
            <span style="font-size: 24px; font-weight: 700; color: #D4A017; letter-spacing: -0.02em;">ReelOS</span>
            <span style="font-size: 11px; background: rgba(212, 160, 23, 0.15); color: #D4A017; padding: 2px 8px; border-radius: 12px; margin-left: 8px;">Household Gate</span>
          </div>
          <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 12px 0;">Pair New Remote Device</h2>
          <p style="color: #9CA3AF; font-size: 14px; line-height: 1.5; margin: 0 0 24px 0;">
            A new device is requesting access to your ReelOS media appliance. Enter this 6-digit code or tap the button below.
          </p>
          <div style="background: #0B0D10; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #D4A017; font-family: monospace;">${otpCode}</span>
          </div>
          ${magicLink ? `<div style="text-align: center; margin-bottom: 24px;">
            <a href="${magicLink}" style="display: inline-block; background: #D4A017; color: #0B0D10; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 10px; text-decoration: none;">
              Authorize This Device (1-Tap)
            </a>
          </div>` : ""}
          <p style="color: #6B7280; font-size: 12px; text-align: center; margin: 0;">
            Expires in 10 minutes. If you did not request this pairing, you can safely ignore this message.
          </p>
        </div>
      </body>
    </html>
  `;

  const emailMode = config?.emailMode || "managed";
  if (emailMode === "custom" && config?.smtp?.host) {
    return await sendCustomSmtpEmail({
      smtp: config.smtp,
      to,
      subject,
      html,
      text,
    });
  }

  return {
    ok: false,
    available: false,
    relay: "managed",
    error: "The managed email relay is not connected. Configure SMTP before requesting a remote pairing code.",
  };
}

/**
 * Tailscale Funnel Management
 */
export function getFunnelStatus(binOverride = null) {
  const tsStatus = getTailscaleStatus(binOverride);
  const bin = binOverride ?? findTailscaleBin();

  if (!tsStatus.installed || !bin) {
    return {
      installed: false,
      enabled: false,
      url: null,
      error: "Tailscale is not installed on this appliance.",
    };
  }

  try {
    const r = spawnSync(bin, ["funnel", "status", "--json"], { encoding: "utf8", timeout: 4000 });
    if (r.status === 0 && r.stdout) {
      const parsed = JSON.parse(r.stdout);
      // Funnel status JSON contains active ports or Web/Target
      const hasFunnel = Boolean(parsed && Object.keys(parsed).length > 0);
      const dns = tsStatus.dns ? `https://${tsStatus.dns}` : null;
      return {
        installed: true,
        enabled: hasFunnel,
        url: dns,
        dns: tsStatus.dns,
        details: parsed,
      };
    }
  } catch {
    /* fallback to status command parsing */
  }

  const publicUrl = tsStatus.dns ? `https://${tsStatus.dns}` : null;
  return {
    installed: true,
    enabled: false,
    url: publicUrl,
    dns: tsStatus.dns,
  };
}

export function setFunnelEnabled(enable, { port = 8080, binOverride = null, stateDir = DEFAULT_STATE_DIR } = {}) {
  const bin = binOverride ?? findTailscaleBin();
  if (!bin || !fs.existsSync(bin)) {
    return {
      ok: false,
      available: false,
      simulated: false,
      enabled: false,
      url: null,
      error: "Tailscale is not installed; the public gateway was not changed.",
    };
  }

  try {
    if (enable) {
      const r = spawnSync(bin, ["funnel", "--bg", String(port)], { encoding: "utf8", timeout: 8000 });
      saveGateConfig({ funnelEnabled: true }, stateDir);
      return { ok: r.status === 0, enabled: true, output: r.stdout || r.stderr };
    } else {
      const r = spawnSync(bin, ["funnel", "reset"], { encoding: "utf8", timeout: 8000 });
      saveGateConfig({ funnelEnabled: false }, stateDir);
      return { ok: r.status === 0, enabled: false, output: r.stdout || r.stderr };
    }
  } catch (e) {
    saveGateConfig({ funnelEnabled: Boolean(enable) }, stateDir);
    return { ok: false, error: String(e?.message || e) };
  }
}

/**
 * Route Handler for /api/gate/* and /api/tailscale/funnel
 */
export async function handleGateRoute(req, res, parsedUrl, readBodyFn, stateDir = DEFAULT_STATE_DIR) {
  const pathname = parsedUrl.pathname;
  const method = (req.method || "GET").toUpperCase();
  const clientIp = extractClientIp(req);
  const isLan = isPrivateOrLanIp(clientIp);

  const sendJson = (code, obj) => {
    res.statusCode = code;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify(obj));
  };

  if (!pathname.startsWith("/api/gate/") && pathname !== "/api/tailscale/funnel") return false;
  const device = getAuthorizedDevice(req, stateDir);
  const profilesDir = process.env.REELOS_PROFILES_DIR || path.join(stateDir, "profiles");
  const authorization = getRequestProfileAuthorization(req, profilesDir);
  const owner = authorization.authenticated && authorization.role === "owner";
  const publicRoute = ["/api/gate/status", "/api/gate/pair-lan", "/api/gate/request-otp", "/api/gate/verify-otp"].includes(pathname);
  if (method !== "GET" && !isSameOriginProfileMutation(req, parsedUrl)) {
    sendJson(403, { ok: false, code: "cross_origin_denied", error: "Use your ReelOS home connection to manage devices." });
    return true;
  }
  if (!publicRoute && !owner) {
    sendJson(authorization.authenticated ? 403 : 401, { ok: false, code: "owner_required", error: "The household owner must manage household devices and access." });
    return true;
  }

  // 1. Tailscale Funnel GET / POST
  if (pathname === "/api/tailscale/funnel") {
    if (method === "GET") {
      const status = getFunnelStatus();
      const config = getGateConfig(stateDir);
      sendJson(200, {
        ok: true,
        funnel: {
          ...status,
          enabled: status.enabled || config.funnelEnabled,
          url: status.url || null,
        },
      });
      return true;
    }
    if (method === "POST") {
      const body = await readBodyFn(req);
      if (body.enabled) {
        sendJson(403, { ok: false, code: "private_access_only", error: "This release supports private household connections only." });
        return true;
      }
      const result = setFunnelEnabled(Boolean(body.enabled), { stateDir });
      sendJson(result.ok ? 200 : 500, result);
      return true;
    }
  }

  // 2. Gate Status
  if (pathname === "/api/gate/status") {
    if (!owner) {
      sendJson(200, { ok: true, isLan, isPaired: Boolean(device),
        deviceAuthorized: Boolean(device), profileAuthenticated: authorization.authenticated,
        role: authorization.role });
      return true;
    }
    const config = getGateConfig(stateDir);
    const funnel = getFunnelStatus();
    const isPaired = Boolean(device);

    // Filter out password when returning config
    const safeSmtp = {
      ...config.smtp,
      pass: config.smtp?.pass ? "••••••••" : "",
    };

    sendJson(200, {
      ok: true,
      isLan,
      clientIp,
      lanIp: getLanIpv4(),
      isPaired,
      funnelEnabled: Boolean(config.funnelEnabled && funnel.enabled),
      publicUrl: (funnel.enabled && funnel.url) || (config.customDomain ? `https://${config.customDomain}` : null),
      tailscaleDns: funnel.dns || null,
      magicDnsUrl: funnel.dns ? `https://${funnel.dns}` : null,
      householdEmail: config.householdEmail,
      emailMode: config.emailMode,
      smtp: safeSmtp,
    });
    return true;
  }

  // A person already connected through the private home LAN or this home's
  // Tailscale network can explicitly trust the current browser. Public
  // internet clients still use the one-time-code invitation flow below.
  if (pathname === "/api/gate/pair-lan" && method === "POST") {
    if (!isLan) {
      sendJson(403, {
        ok: false,
        code: "private_connection_required",
        error: "Connect through this home's Wi-Fi or private Tailscale connection first.",
      });
      return true;
    }
    const userAgent = req.headers?.["user-agent"] || "Unknown Device";
    const pairedDevice = device || registerAuthorizedDevice({
      name: detectPlatformName(userAgent),
      userAgent,
      ip: clientIp,
    }, stateDir);
    const token = signDeviceToken(pairedDevice, getGateSecret(stateDir));
    res.setHeader("Set-Cookie", deviceTokenCookie(token, req));
    sendJson(200, { ok: true, device: pairedDevice });
    return true;
  }

  // 3. Update Gate Configuration
  if (pathname === "/api/gate/config" && method === "POST") {
    const body = await readBodyFn(req);
    const current = getGateConfig(stateDir);
    const patch = {};

    if (typeof body.householdEmail === "string") {
      patch.householdEmail = body.householdEmail.trim();
    }
    if (body.emailMode === "managed" || body.emailMode === "custom") {
      patch.emailMode = body.emailMode;
    }
    if (typeof body.customDomain === "string") {
      patch.customDomain = body.customDomain.trim();
    }
    if (body.smtp && typeof body.smtp === "object") {
      patch.smtp = {
        ...current.smtp,
        ...body.smtp,
      };
      // Keep existing password if masked
      if (body.smtp.pass === "••••••••" || body.smtp.pass === "") {
        patch.smtp.pass = current.smtp?.pass || "";
      }
    }

    const updated = saveGateConfig(patch, stateDir);
    sendJson(200, { ok: true, config: { ...updated, smtp: { ...updated.smtp, pass: updated.smtp.pass ? "••••••••" : "" } } });
    return true;
  }

  // 4. Request OTP / Magic Link
  if (pathname === "/api/gate/request-otp" && method === "POST") {
    const body = await readBodyFn(req);
    const config = getGateConfig(stateDir);
    const targetEmail = String(config.householdEmail || "").trim().toLowerCase();

    if (!targetEmail) {
      sendJson(409, { ok: false, code: "pairing_not_configured", error: "The household owner must configure device invitations first." });
      return true;
    }
    if (body.email && String(body.email).trim().toLowerCase() !== targetEmail) {
      sendJson(403, { ok: false, code: "household_email_required", error: "Only the household's configured invitation address can authorize a device." });
      return true;
    }

    const resChallenge = createOtpChallenge({ email: targetEmail, clientIp, stateDir });
    if (!resChallenge.ok) {
      sendJson(429, resChallenge);
      return true;
    }

    // Determine base URL for magic link
    const assignedDns = getTailscaleStatus().dns;
    const magicLink = assignedDns && /^[a-z0-9.-]+\.ts\.net$/i.test(assignedDns)
      ? `https://${assignedDns}/join?token=${resChallenge.token}` : null;

    try {
      const delivery = await sendGateEmail({
        to: targetEmail,
        otpCode: resChallenge.code,
        magicLink,
        config,
        stateDir,
      });

      if (!delivery.ok) {
        activeOtpChallenges.delete(resChallenge.challenge.emailKey);
        activeOtpChallenges.delete(resChallenge.token);
        sendJson(503, delivery);
        return true;
      }

      sendJson(200, {
        ok: true,
        message: "Verification code sent to the household's invitation address.",
        expiresInSec: 600,
      });
    } catch (err) {
      activeOtpChallenges.delete(resChallenge.challenge.emailKey);
      activeOtpChallenges.delete(resChallenge.token);
      sendJson(500, { ok: false, error: `Failed to send email: ${err.message}` });
    }
    return true;
  }

  // 5. Verify OTP / Magic Link Token
  if (pathname === "/api/gate/verify-otp" && method === "POST") {
    const body = await readBodyFn(req);
    const userAgent = req.headers?.["user-agent"] || "Unknown Device";

    const verifyResult = verifyOtpChallenge({
      email: body.email,
      code: body.code,
      token: body.token,
      clientIp,
      userAgent,
      stateDir,
    });

    if (!verifyResult.ok) {
      sendJson(400, verifyResult);
      return true;
    }

    res.setHeader("Set-Cookie", deviceTokenCookie(verifyResult.token, req));
    sendJson(200, {
      ok: true,
      device: verifyResult.device,
      token: verifyResult.token,
    });
    return true;
  }

  // 6. Authorized Devices List
  if (pathname === "/api/gate/devices" && method === "GET") {
    const devices = listAuthorizedDevices(stateDir);
    sendJson(200, { ok: true, devices });
    return true;
  }

  // 7. Revoke Device
  if (pathname === "/api/gate/revoke-device" && method === "POST") {
    const body = await readBodyFn(req);
    if (!body.id) {
      sendJson(400, { ok: false, error: "Device ID is required" });
      return true;
    }
    const revoked = revokeAuthorizedDevice(body.id, stateDir);
    sendJson(200, { ok: revoked });
    return true;
  }

  // 8. Test Email Dispatch
  if (pathname === "/api/gate/test-email" && method === "POST") {
    const body = await readBodyFn(req);
    const config = getGateConfig(stateDir);
    const targetEmail = body.to || body.email || config.householdEmail;
    if (!targetEmail) {
      sendJson(400, { ok: false, error: "Recipient email is required" });
      return true;
    }

    const testSmtp = body.smtp || config.smtp;
    const testConfig = {
      ...config,
      emailMode: body.emailMode || config.emailMode,
      smtp: testSmtp,
    };

    try {
      const resSend = await sendGateEmail({
        to: targetEmail,
        otpCode: "123456",
        magicLink: "https://reelos-appliance.ts.net/join?token=test-token",
        config: testConfig,
        stateDir,
      });
      if (!resSend.ok) {
        sendJson(503, resSend);
      } else {
        sendJson(200, { ok: true, message: `Test email sent successfully to ${targetEmail}`, details: resSend });
      }
    } catch (err) {
      sendJson(500, { ok: false, error: `Email test failed: ${err.message}` });
    }
    return true;
  }

  return false;
}
