import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";

export const PROFILE_SESSION_COOKIE = "reelos_profile_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function readCookie(req, name) {
  const part = String(req.headers?.cookie || "").split(";")
    .map((value) => value.trim()).find((value) => value.startsWith(`${name}=`));
  if (!part) return null;
  try { return decodeURIComponent(part.slice(name.length + 1)); } catch { return null; }
}

function sessionPath(profilesDir, token) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token || "")) return null;
  return path.join(profilesDir, ".sessions", `${createHash("sha256").update(token).digest("hex")}.json`);
}

export function readProfileSession(req, profilesDir, now = Date.now()) {
  const token = readCookie(req, PROFILE_SESSION_COOKIE);
  const file = sessionPath(profilesDir, token);
  if (!file) return null;
  try {
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Number.isFinite(saved.expiresAt) || saved.expiresAt <= now) return null;
    return { ...saved, token };
  } catch { return null; }
}

export function isSecureRequest(req) {
  if (req.socket?.encrypted || req.connection?.encrypted) return true;
  const peer = req.socket?.remoteAddress || req.connection?.remoteAddress;
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(peer)
    && req.headers?.["x-forwarded-proto"] === "https";
}

export function replaceProfileSession(req, profilesDir, profileId, deviceId, now = Date.now()) {
  const previous = readProfileSession(req, profilesDir, now);
  const token = randomBytes(32).toString("base64url");
  const file = sessionPath(profilesDir, token);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const session = { profileId, deviceId, createdAt: now, expiresAt: now + SESSION_TTL_MS };
  fs.writeFileSync(file, JSON.stringify(session), { flag: "wx", mode: 0o600 });
  if (previous) {
    try { fs.unlinkSync(sessionPath(profilesDir, previous.token)); } catch (error) {
      // Never acknowledge a rotation if the old credential could still be used.
      if (error.code !== "ENOENT") { fs.unlinkSync(file); throw error; }
    }
  }
  return {
    ...session,
    token,
    cookie: `${PROFILE_SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${isSecureRequest(req) ? "; Secure" : ""}`,
  };
}

export function isSameOriginProfileMutation(req, parsedUrl) {
  if (req.headers?.["sec-fetch-site"] === "cross-site") return false;
  const origin = req.headers?.origin;
  if (!origin) return true; // Native clients authenticate using their session cookie.
  try {
    const expected = new URL(`${isSecureRequest(req) ? "https" : "http"}://${req.headers?.host || parsedUrl.host}`);
    return new URL(origin).origin === expected.origin;
  } catch { return false; }
}
