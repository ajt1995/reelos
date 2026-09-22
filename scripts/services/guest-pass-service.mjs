import fs from "node:fs";
import path from "node:path";
import { saveProfile, listProfiles, deleteProfile } from "./profile-service.mjs";

const DEFAULT_STATE_DIR = process.env.REELOS_STATE || "/var/lib/reelos";

/**
 * 3-Question Vibe Check Presets for Guests
 */
export const GUEST_VIBES = {
  scifi_mindbender: {
    id: "scifi_mindbender",
    label: "Mind-Bending Sci-Fi",
    vibe: "balanced",
    weights: { "sci-fi": 1.5, "science fiction": 1.5, mystery: 1.2, thriller: 1.0 },
  },
  feelgood_comedy: {
    id: "feelgood_comedy",
    label: "Feel-Good Comedy",
    vibe: "comfort",
    weights: { comedy: 1.5, animation: 1.2, family: 1.0, adventure: 0.8 },
  },
  dark_thriller: {
    id: "dark_thriller",
    label: "Dark Thriller & Crime",
    vibe: "balanced",
    weights: { thriller: 1.5, crime: 1.5, mystery: 1.2, drama: 1.0 },
  },
  action_blast: {
    id: "action_blast",
    label: "High-Octane Action",
    vibe: "bleeding_edge",
    weights: { action: 1.5, adventure: 1.3, "sci-fi": 1.0 },
  },
  comfort_classics: {
    id: "comfort_classics",
    label: "Comfort Rewatches",
    vibe: "comfort",
    weights: { comedy: 1.2, drama: 1.2, romance: 1.0 },
  },
  indie_critique: {
    id: "indie_critique",
    label: "Indie & Prestige Cinema",
    vibe: "hidden_gems",
    weights: { drama: 1.5, mystery: 1.2, documentary: 1.0 },
  },
};

export const HORROR_LEVELS = {
  bring_it_on: { id: "bring_it_on", label: "Bring it on!", weight: 1.3 },
  mild_thrills: { id: "mild_thrills", label: "Mild thrills only", weight: 0.3 },
  none: { id: "none", label: "Absolutely none", weight: -2.0 },
};

/**
 * Creates a temporary guest pass profile with 3-question vibe blending.
 */
export function createGuestPass({
  nickname = "Guest",
  vibeChoice = "feelgood_comedy",
  horrorLevel = "mild_thrills",
  stateDir = DEFAULT_STATE_DIR,
} = {}) {
  const cleanName = String(nickname || "Guest").trim().slice(0, 24) || "Guest";
  const vibeConfig = GUEST_VIBES[vibeChoice] || GUEST_VIBES.feelgood_comedy;
  const horrorConfig = HORROR_LEVELS[horrorLevel] || HORROR_LEVELS.mild_thrills;

  const combinedWeights = { ...vibeConfig.weights };
  if (horrorConfig.weight > 0) {
    combinedWeights.horror = horrorConfig.weight;
  } else {
    combinedWeights.horror = -2.0; // Strongly suppress horror
  }

  const profilesDir = path.join(stateDir, "profiles");
  const guestId = `res-guest-${Date.now().toString(36)}`;
  const expiresAt = Date.now() + 12 * 60 * 60 * 1000; // 12-hour session TTL

  const guestProfile = {
    id: guestId,
    name: cleanName,
    avatar: "popcorn",
    isGuest: true,
    isKids: false,
    hideKidsContent: false,
    watchlist: [],
    watchProgress: {},
    mediaPriorities: { movies: 60, tv: 40, books: 0 },
    tasteVibe: vibeConfig.vibe,
    themeDesign: "oled_cinema",
    accentColor: "gold-hashed",
    motionStyle: "cinematic",
    curationWeights: combinedWeights,
    guestVibeChoice: vibeConfig.id,
    guestHorrorChoice: horrorConfig.id,
    expiresAt,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const saved = saveProfile(guestProfile, profilesDir);
  return {
    ok: true,
    guestProfile: saved,
    expiresInHours: 12,
  };
}

/**
 * Prunes expired guest profiles (>12 hours old).
 */
export function pruneExpiredGuests(stateDir = DEFAULT_STATE_DIR, now = Date.now()) {
  const profilesDir = path.join(stateDir, "profiles");
  const all = listProfiles(profilesDir);
  const removed = [];

  for (const p of all) {
    if (p.isGuest && p.expiresAt && p.expiresAt < now) {
      deleteProfile(p.id, profilesDir);
      removed.push(p.id);
    }
  }

  return { ok: true, prunedCount: removed.length, prunedIds: removed };
}

/**
 * HTTP handler for /api/guest/*
 */
export async function handleGuestPassRoute(req, res, parsedUrl, readBodyFn, stateDir = DEFAULT_STATE_DIR) {
  const method = (req.method || "GET").toUpperCase();
  const pathname = parsedUrl.pathname;

  if (pathname === "/api/guest/presets" && method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, vibes: Object.values(GUEST_VIBES), horrorLevels: Object.values(HORROR_LEVELS) }));
  }

  if (pathname === "/api/guest/join" && method === "POST") {
    try {
      const body = await readBodyFn(req);
      const data = typeof body === "string" ? JSON.parse(body || "{}") : body || {};
      const result = createGuestPass({
        nickname: data.nickname,
        vibeChoice: data.vibeChoice,
        horrorLevel: data.horrorLevel,
        stateDir,
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  }

  if (pathname === "/api/guest/prune" && method === "POST") {
    const result = pruneExpiredGuests(stateDir);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(result));
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "Not found" }));
}
