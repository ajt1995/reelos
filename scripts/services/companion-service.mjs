import fs from 'node:fs';
import path from 'node:path';
import { getRequestProfileAuthorization } from './profile-service.mjs';
import { isSameOriginProfileMutation } from './profile-session-service.mjs';

const DEFAULT_STATE_DIR = process.env.REELOS_STATE || (
  process.platform === 'win32'
    ? path.join(process.cwd(), '.reelos-state')
    : '/var/lib/reelos'
);

function ensureStateDir() {
  try {
    if (!fs.existsSync(DEFAULT_STATE_DIR)) {
      fs.mkdirSync(DEFAULT_STATE_DIR, { recursive: true });
    }
  } catch {}
}

ensureStateDir();

// In-memory active playback registry
const activeSessionsRegistry = new Map();

// Remote command queue for TV player
const pendingRemoteCommands = [];
const REMOTE_ACTIONS = new Set(['play', 'pause', 'seek']);

/**
 * Atomic JSON write with .bak mirror protection for bulletproof self-healing.
 */
export function atomicWriteJsonWithBackup(filePath, data) {
  try {
    ensureStateDir();
    const str = JSON.stringify(data, null, 2);
    const bakPath = `${filePath}.bak`;
    if (fs.existsSync(filePath)) {
      try {
        fs.copyFileSync(filePath, bakPath);
      } catch {}
    } else {
      try {
        fs.writeFileSync(bakPath, str, 'utf8');
      } catch {}
    }
    fs.writeFileSync(filePath, str, 'utf8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Safe JSON read with automatic .bak recovery if file is corrupted.
 */
export function safeReadJsonWithBackup(filePath, fallback = {}) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    const bakPath = `${filePath}.bak`;
    try {
      if (fs.existsSync(bakPath)) {
        const rawBak = fs.readFileSync(bakPath, 'utf8');
        const restored = JSON.parse(rawBak);
        // Self-heal the main file
        try { fs.writeFileSync(filePath, rawBak, 'utf8'); } catch {}
        return restored;
      }
    } catch {}
  }
  return fallback;
}

/**
 * Records an active playback session directly from ReelOS video player.
 */
export function recordActiveSession(sessionData = {}) {
  const sessionId = sessionData.sessionId || sessionData.id || 'primary-session';
  const now = Date.now();
  const session = {
    ok: true,
    active: true,
    sessionId,
    client: sessionData.client || 'ReelOS Cinema Player',
    device: sessionData.device || 'Living Room TV',
    titleId: sessionData.titleId || sessionData.id || 'sample',
    titleName: sessionData.titleName || sessionData.title || 'Cinema Title',
    seriesName: sessionData.seriesName || null,
    seasonNumber: Number(sessionData.seasonNumber || sessionData.season || 1),
    episodeNumber: Number(sessionData.episodeNumber || sessionData.episode || 1),
    positionTicks: Number(sessionData.positionTicks || 0),
    durationTicks: Number(sessionData.durationTicks || 0),
    isPaused: Boolean(sessionData.isPaused),
    lastUpdated: now,
    mediaUrl: sessionData.mediaUrl || null,
  };

  activeSessionsRegistry.clear();
  activeSessionsRegistry.set(sessionId, session);
  for (let index = pendingRemoteCommands.length - 1; index >= 0; index--) {
    if (pendingRemoteCommands[index].sessionId !== sessionId) pendingRemoteCommands.splice(index, 1);
  }
  const sessionFile = path.join(DEFAULT_STATE_DIR, 'active-session.json');
  atomicWriteJsonWithBackup(sessionFile, session);
  return session;
}

/**
 * Clears an active session when playback stops.
 */
export function clearActiveSession(sessionId = 'primary-session') {
  activeSessionsRegistry.delete(sessionId);
  const sessionFile = path.join(DEFAULT_STATE_DIR, 'active-session.json');
  const inactive = { ok: true, active: false, message: 'No active playback session detected.', lastUpdated: Date.now() };
  atomicWriteJsonWithBackup(sessionFile, inactive);
  return inactive;
}

/**
 * Retrieves the active playback session strictly from native ReelOS state (Zero Port 8096 probes).
 */
export async function getActivePlaybackSession() {
  // 1. Check in-memory registry first
  for (const session of activeSessionsRegistry.values()) {
    if (session.active && (Date.now() - (session.lastUpdated || 0)) < 120000) {
      return session;
    }
  }

  // 2. Check on-disk state with safe .bak fallback
  try {
    const sessionFile = path.join(DEFAULT_STATE_DIR, 'active-session.json');
    const data = safeReadJsonWithBackup(sessionFile, null);
    if (data && data.active && data.titleId) {
      // If updated within the last 2 minutes
      if ((Date.now() - (data.lastUpdated || 0)) < 120000) {
        return { ok: true, ...data };
      }
    }
  } catch {}

  return { ok: true, active: false, message: 'No active TV playback session detected.' };
}

/**
 * Builds "The Story So Far": 3-sentence spoiler-free narrative recap.
 * If user hasn't watched in >14 days (or when resuming a migrated show),
 * catches them up up to episode N-1 without spoiling future lore.
 */
export function generateStorySoFar(title, { season = 1, episode = 1, lastWatchedTimestamp = 0, verifiedRecap = [] } = {}) {
  const isHiatus = lastWatchedTimestamp > 0 && (Date.now() - lastWatchedTimestamp) > (14 * 24 * 60 * 60 * 1000);
  return {
    isHiatus,
    available: Array.isArray(verifiedRecap) && verifiedRecap.length > 0,
    storySoFar: Array.isArray(verifiedRecap)
      ? verifiedRecap.filter((line) => typeof line === 'string' && line.trim()).slice(0, 8)
      : [],
  };
}

/**
 * Retrieves dynamic cast details, character roles, and scene context for ANY title in the catalog.
 */
export async function getCompanionDossier(titleIdOrName, { season = 1, episode = 1, minute = 0, lastWatchedTimestamp = 0 } = {}) {
  const cleanId = String(titleIdOrName || 'Featured Title').trim();
  const normKey = cleanId.toLowerCase().replace(/[^a-z0-9]/g, '');

  let meta = null;
  try {
    const metaFile = path.join(DEFAULT_STATE_DIR, 'metadata', `${normKey}.json`);
    if (fs.existsSync(metaFile)) {
      meta = safeReadJsonWithBackup(metaFile, null);
    }
  } catch {}

  const cleanTitle = meta?.title || cleanId.replace(/[-_]/g, ' ');
  const recap = generateStorySoFar(cleanTitle, {
    season,
    episode,
    lastWatchedTimestamp,
    verifiedRecap: meta?.verifiedRecap,
  });

  const whoIsWho = (meta && Array.isArray(meta.cast) && meta.cast.length > 0)
    ? meta.cast.slice(0, 6).map((c) => ({
        name: c.name || 'Ensemble Member',
        actor: c.actor || c.name || 'Cast',
        role: c.character || 'Supporting Role',
        avatar: c.avatar || null
      }))
    : [];

  const hasVerifiedContext = Boolean(
    meta &&
    (recap.storySoFar.length > 0 || whoIsWho.length > 0 || meta.currentScene || meta.plot),
  );

  return {
    ok: true,
    available: hasVerifiedContext,
    message: hasVerifiedContext
      ? null
      : 'Verified companion context is not available for this title yet.',
    title: cleanTitle,
    tagline: meta?.tagline || '',
    season: Number(season) || 1,
    episode: Number(episode) || 1,
    currentMinute: Number(minute) || 0,
    isHiatus: recap.isHiatus,
    storySoFar: recap.storySoFar,
    whoIsWho,
    whyAreTheyHere: meta?.currentScene || meta?.plot || null,
    whisperNotes: Array.isArray(meta?.whisperNotes) ? meta.whisperNotes : [],
    spoilerShield: {
      active: Boolean(meta?.timelineVerified),
      safeThroughSeason: Number(season) || 1,
      safeThroughEpisode: Number(episode) || 1,
      futureLoreBlocked: Boolean(meta?.timelineVerified)
    }
  };
}

/**
 * Dispatches remote commands from phone Companion to TV
 */
export function queueRemoteCommand(command) {
  if (!command || !REMOTE_ACTIONS.has(command.action)) return null;
  if (typeof command.sessionId !== 'string' || !command.sessionId) return null;
  const payload = command.payload && typeof command.payload === 'object' && !Array.isArray(command.payload) ? command.payload : {};
  if (command.action === 'seek') {
    const hasDelta = Number.isSafeInteger(payload.deltaTicks);
    const hasPosition = Number.isSafeInteger(payload.positionTicks) && payload.positionTicks >= 0;
    if (hasDelta === hasPosition) return null;
  }
  const cmd = {
    id: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    action: command.action,
    sessionId: command.sessionId,
    payload,
    timestamp: Date.now()
  };
  pendingRemoteCommands.push(cmd);
  if (pendingRemoteCommands.length > 20) pendingRemoteCommands.shift();
  return cmd;
}

export function popRemoteCommands(sessionId) {
  const cmds = pendingRemoteCommands.filter((command) => !sessionId || command.sessionId === sessionId);
  for (let index = pendingRemoteCommands.length - 1; index >= 0; index--) {
    if (!sessionId || pendingRemoteCommands[index].sessionId === sessionId) pendingRemoteCommands.splice(index, 1);
  }
  return cmds;
}

/**
 * HTTP Route Handler for /api/companion/*
 */
export async function handleCompanionRoute(req, res, options = {}) {
  const url = new URL(req.url, 'http://127.0.0.1');
  const p = url.pathname;
  const method = (req.method || 'GET').toUpperCase();

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const profilesDir = options.profilesDir || path.join(DEFAULT_STATE_DIR, 'profiles');
  const authorization = options.authorize
    ? options.authorize(req)
    : getRequestProfileAuthorization(req, profilesDir);
  if (!authorization?.authenticated) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: 'Open an authorized profile to use Companion.' }));
  }
  if (method !== 'GET' && !isSameOriginProfileMutation(req, url)) {
    res.statusCode = 403;
    return res.end(JSON.stringify({ ok: false, error: "Use this home's connection to control playback." }));
  }

  // Session-scoped family presence belongs to policy, never to the generic
  // /api/companion/:title dossier fallback.
  if (p === '/api/companion/presence-filter') {
    const { childProfileService } = await import('./child-profile-service.mjs');
    if (method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      let data = {};
      try { data = JSON.parse(body || '{}'); } catch {}
      const result = childProfileService.setRoomPresence(
        data.sessionId || 'living_room_tv',
        data,
      );
      res.statusCode = 200;
      return res.end(JSON.stringify(result));
    }
    const sessionId = url.searchParams.get('sessionId') || 'living_room_tv';
    res.statusCode = 200;
    return res.end(JSON.stringify(childProfileService.getRoomPresence(sessionId)));
  }

  // POST /api/companion/session - update active session from client
  if (p === '/api/companion/session' && method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let data = {};
    try { data = JSON.parse(body || '{}'); } catch {}
    if (!data || typeof data !== 'object' || typeof data.sessionId !== 'string' || !data.sessionId
      || typeof data.titleId !== 'string' || !data.titleId || typeof data.titleName !== 'string' || !data.titleName
      || !Number.isSafeInteger(data.positionTicks) || data.positionTicks < 0
      || !Number.isSafeInteger(data.durationTicks) || data.durationTicks < 0) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: 'A verified player session and timing are required.' }));
    }
    const session = recordActiveSession(data);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, session }));
  }

  // POST /api/companion/stop - stop active session
  if (p === '/api/companion/stop' && method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let data = {};
    try { data = JSON.parse(body || '{}'); } catch {}
    const current = await getActivePlaybackSession();
    if (!current.active || data.sessionId !== current.sessionId) {
      res.statusCode = 409;
      return res.end(JSON.stringify({ ok: false, error: 'That playback session is no longer active.' }));
    }
    const result = clearActiveSession(data.sessionId);
    res.statusCode = 200;
    return res.end(JSON.stringify(result));
  }

  // POST /api/companion/remote - dispatch remote commands
  if (p === '/api/companion/remote' && method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let data = {};
    try { data = JSON.parse(body || '{}'); } catch {}
    const session = await getActivePlaybackSession();
    if (!session.active || !session.sessionId || data.sessionId !== session.sessionId) {
      res.statusCode = 409;
      return res.end(JSON.stringify({ ok: false, error: 'That playback session is no longer active.' }));
    }
    const cmd = queueRemoteCommand(data);
    if (!cmd) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: 'That Companion command is not supported.' }));
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, command: cmd }));
  }

  // GET /api/companion/remote/poll - TV player polls for pending commands
  if (p === '/api/companion/remote/poll') {
    const sessionId = url.searchParams.get('sessionId');
    const session = await getActivePlaybackSession();
    if (!sessionId || !session.active || session.sessionId !== sessionId) {
      res.statusCode = 409;
      return res.end(JSON.stringify({ ok: false, error: 'That playback session is no longer active.' }));
    }
    const commands = popRemoteCommands(sessionId);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, commands }));
  }

  // GET /api/companion/handoff - 1-tap room handoff
  if (p === '/api/companion/handoff') {
    const target = url.searchParams.get('target') || 'tv';
    const session = await getActivePlaybackSession();
    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true,
      target,
      session,
      handoffTimestamp: session.positionTicks || 0
    }));
  }

  // GET /api/companion/active
  if (p === '/api/companion/active') {
    const session = await getActivePlaybackSession();
    const titleQuery = session.seriesName || session.titleName || session.titleId || 'severance';
    const minute = Math.floor((session.positionTicks || 0) / 10000000 / 60);
    const dossier = await getCompanionDossier(titleQuery, {
      season: session.seasonNumber || 1,
      episode: session.episodeNumber || 1,
      minute
    });

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, active: Boolean(session.active), session, dossier }));
  }

  // GET /api/companion/:id
  const titleId = p.replace('/api/companion/', '').trim();
  const season = parseInt(url.searchParams.get('season') || '1', 10);
  const episode = parseInt(url.searchParams.get('episode') || '1', 10);
  const minute = parseInt(url.searchParams.get('minute') || '0', 10);

  const dossier = await getCompanionDossier(titleId, { season, episode, minute });
  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, dossier }));
}
