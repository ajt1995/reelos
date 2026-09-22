import { batteryGuardian } from "./battery-guardian.mjs";
import { adaptivePlayback } from "./adaptive-playback.mjs";
import { audioIntelligence } from "./audio-intelligence.mjs";
import { telemetryWatchdog } from "./telemetry-watchdog.mjs";
import { neuralEngine } from "./neural-engine.mjs";

export function getTasteDistance(vectorA, vectorB) {
  if (!vectorA || !vectorB || vectorA.length === 0 || vectorB.length === 0) return 1.0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < Math.min(vectorA.length, vectorB.length); i++) {
    const a = vectorA[i] || 0;
    const b = vectorB[i] || 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }
  if (normA === 0 || normB === 0) return 1.0;
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  if (Number.isNaN(similarity) || !Number.isFinite(similarity)) return 1.0;
  return 1 - similarity;
}

const GENRE_FEATURE_MAP = {
  action: [0, 16],
  adventure: [0, 26],
  scifi: [1, 10, 18],
  "sci-fi": [1, 10, 18],
  fantasy: [1, 15],
  drama: [2, 17, 23],
  crime: [2, 14, 20],
  comedy: [3, 19],
  animation: [3, 15, 23],
  horror: [4, 14, 20],
  thriller: [4, 18, 20],
  mystery: [4, 18],
  romance: [5, 19],
  documentary: [5, 17, 22],
  family: [7, 19, 23],
  war: [0, 2, 20],
  western: [0, 8, 17],
};

const VIBE_FEATURE_MAP = {
  comfort: [3, 8, 15, 19],
  bleeding_edge: [1, 10, 16, 22],
  hidden_gems: [2, 11, 18, 23],
  balanced: [0, 2, 3, 26],
};

function hashTokenToDim(token, modulus = 32) {
  let hash = 5381;
  for (let i = 0; i < token.length; i++) {
    hash = ((hash << 5) + hash) + token.charCodeAt(i);
  }
  return Math.abs(hash) % modulus;
}

export function generateLatentEmbedding(watchHistory) {
  const embedding = new Array(32).fill(0);
  if (!watchHistory || !Array.isArray(watchHistory) || watchHistory.length === 0) {
    return embedding;
  }

  for (const item of watchHistory) {
    if (!item) continue;
    // 1. Direct genre features
    const genres = Array.isArray(item.genres)
      ? item.genres
      : typeof item.genre === "string"
        ? [item.genre]
        : [];
    for (const g of genres) {
      const norm = String(g).toLowerCase().replace(/[^a-z-]/g, "");
      const dims = GENRE_FEATURE_MAP[norm];
      if (dims) {
        for (const d of dims) embedding[d] += 1.5;
      } else {
        embedding[hashTokenToDim(norm)] += 0.8;
      }
    }

    // 2. Taste Vibe features
    const vibe = item.tasteVibe || item.vibe;
    if (vibe && VIBE_FEATURE_MAP[vibe]) {
      for (const d of VIBE_FEATURE_MAP[vibe]) embedding[d] += 2.0;
    }

    // 3. Era / Vintage features
    const year = Number(item.year || (item.releaseDate ? item.releaseDate.slice(0, 4) : 0));
    if (year > 0) {
      if (year < 2000) embedding[8] += 1.2; // 80s/90s Nostalgia
      else if (year >= 2020) embedding[10] += 1.2; // Bleeding Edge modern
      else embedding[9] += 0.8; // 2000s/2010s
    }

    // 4. Fallback token projection from title/id
    const title = typeof item === "string" ? item : item.title || item.name || item.id || "";
    const words = String(title).toLowerCase().split(/[\s_-]+/);
    for (const w of words) {
      if (w.length > 2) embedding[hashTokenToDim(w)] += 0.4;
    }
  }

  // L2-normalization for cosine geometry
  let norm = 0;
  for (let i = 0; i < 32; i++) {
    const w = (neuralEngine && neuralEngine.weights && !Number.isNaN(neuralEngine.weights[i])) ? neuralEngine.weights[i] : 0;
    embedding[i] += w;
    norm += embedding[i] * embedding[i];
  }
  if (norm === 0) return embedding;
  const sqrtNorm = Math.sqrt(norm);
  for (let i = 0; i < 32; i++) embedding[i] /= sqrtNorm;
  return embedding;
}

export async function handlePulseAiRoute(req, res, parsedUrl) {
  const method = (req.method || "GET").toUpperCase();
  const pathname = parsedUrl.pathname;

  if (pathname === "/api/pulse/telemetry" && method === "GET") {
    const raw = telemetryWatchdog.generateSanitizedCapsule();
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(raw);
  }

  if (pathname === "/api/pulse/playback-plan" && method === "POST") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    let body = {};
    try { body = JSON.parse(raw); } catch {}
    const client = body.client || { type: body.clientDevice || "tv" };
    const network = body.network || { onAcPower: !body.isBattery, fastLan: body.connectionSpeed === "fast" };
    const media = body.media || { is4k: true };
    const plan = adaptivePlayback.evaluatePlaybackPlan(client, network, media);
    const mode = plan.decision || "DirectPlay";
    const maxResolution = media.is4k ? "4K UHD (2160p)" : "1080p FHD";
    const audioPolicy = plan.audioTranscode ? "AAC Stereo Transmux" : "DirectPlay (Untouched Audio)";
    const rationale = plan.decision || "Optimal local playback profile selected";
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, plan, mode, maxResolution, audioPolicy, rationale }));
  }

  if (pathname === "/api/pulse/battery" && method === "GET") {
    const state = await batteryGuardian.evaluateBatteryState();
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, battery: state }));
  }

  if (pathname === "/api/pulse/audio/night-mode" && method === "GET") {
    const profile = audioIntelligence.getSmartNightModeProfile();
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, profile }));
  }

  return false;
}
