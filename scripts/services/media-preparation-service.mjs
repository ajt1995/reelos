import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { playbackIdentity, playbackStateDir, readPlaybackLibraryItems } from './playback-access-service.mjs';
import { resolveVerifiedLocalOriginal } from './media-retention-service.mjs';
import { isSameOriginProfileMutation } from './profile-session-service.mjs';
import { safeWriteFileSync, isValidProfileId } from './profile-service.mjs';
import { reservePreparationBytes, releasePreparationReservation, withPreparationBudgetLock } from './preparation-budget-service.mjs';
import { checkStorageHeadroom } from './storage-service.mjs';
import { featureCollisionArbiter } from './feature-collision-arbiter.mjs';
import { hasPreparationBlockingPlayback, subscribePreparationBlockingPlayback, updatePreparationBlockingSession, endPreparationBlockingSession } from './preparation-activity.mjs';
import { PREPARATION_RECIPES, probePreparationSource, estimatePreparationBytes, runPreparationCodec } from './preparation-codec.mjs';
import { admitCoordinatedWorkload } from './resource-workload-coordinator.mjs';

const runners = new Map();
const viewingSessions = new Map();
const VIEWING_LEASE_MS = 60000;
const PREPARATION_MEMORY_BUDGET_BYTES = 384 * 1024 ** 2;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
const STATUSES = new Set(['deferred', 'preparing', 'validating', 'ready', 'failed', 'cancelled', 'interrupted']);
const active = (job) => ['preparing', 'validating'].includes(job.status);
const YIELD_CODES = new Set(['playback_yield', 'host_yield', 'memory_yield', 'storage_yield']);
const failureMessages = {
  unsupported_hdr: 'HDR conversion is not verified yet. Your original stays unchanged.',
  unsupported_subtitles: 'This subtitle format cannot be preserved by the available recipes. Your original stays unchanged.',
  unsupported_streams: 'This original has tracks outside the supported preparation limits. Your original stays unchanged.',
  unsupported_audio: 'This audio layout needs a separately verified recipe. Your original stays unchanged.',
  unsupported_video: 'This video layout needs a separately verified recipe. Your original stays unchanged.',
  codec_unavailable: 'The media preparation tools are unavailable on this computer. Your original stays unchanged.',
  output_verification_failed: 'The copy did not pass full playback validation and was not made available. Your original stays unchanged.',
  output_budget_exceeded: 'The copy exceeded its reserved space. Check the storage setting or choose a smaller copy.',
};
const waitingMessage = (code) => ({
  memory_yield: 'Preparation needs more free memory. Close an unused app or try again later.',
  storage_yield: 'Preparation is waiting for safe free storage. Check Library & storage before retrying.',
  playback_yield: 'Preparation is waiting until playback has finished.',
  host_yield: 'Preparation is waiting while this computer is busy.',
}[code] || 'Preparation stopped to protect this computer. Try again when it is free.');
const governorWaitCode = (code) => ({
  memory_safety_floor: 'memory_yield',
  disk_safety_floor: 'storage_yield',
  foreground_priority: 'playback_yield',
}[code] || 'host_yield');
const fail = (status, code, message) => { throw Object.assign(new Error(message), { status, code }); };
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => record(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
const recipes = () => Object.entries(PREPARATION_RECIPES).map(([id, { label }]) => ({ id, label }));
const recipeKnown = (id) => recipes().some((recipe) => recipe.id === id);
const rootOf = (options) => path.resolve(playbackStateDir(options));
const ledgerPath = (root) => path.join(root, 'preparation-jobs.json');
const outputPath = (root, id) => path.join(root, 'prepared-media', id, 'output.mp4');
const fingerprint = (file) => {
  const st = fs.lstatSync(file, { bigint: true });
  if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1n) fail(409, 'prepared_file_changed', 'This prepared file needs to be checked again.');
  return Object.fromEntries(['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'].map((key) => [key, String(st[key])]));
};
const directoryIdentity = (directory) => {
  let cursor = directory;
  while (true) {
    const stat = fs.lstatSync(cursor);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail(503, 'unsafe_preparation_path', 'Preparation storage could not be verified.');
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  const st = fs.lstatSync(directory, { bigint: true });
  return { dev: String(st.dev), ino: String(st.ino) };
};

function readJobs(root) {
  try {
    const file = ledgerPath(root), stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024) throw new Error();
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!exact(data, ['schemaVersion', 'jobs']) || data.schemaVersion !== 1 || !record(data.jobs) || Object.keys(data.jobs).length > 1000) throw new Error();
    for (const [id, job] of Object.entries(data.jobs)) {
      if (!UUID.test(id) || job.id !== id || !isValidProfileId(job.profileId) || !ID.test(job.titleId) || !recipeKnown(job.recipe)
        || !STATUSES.has(job.status) || typeof job.title !== 'string' || job.title.length > 500
        || typeof job.message !== 'string' || job.message.length > 500
        || !Number.isFinite(job.createdAt) || !Number.isFinite(job.updatedAt)
        || (job.progress !== null && (!Number.isFinite(job.progress) || job.progress < 0 || job.progress > 1))
        || !record(job.source) || !(job.directory === null || record(job.directory)) || !(job.reservationId === null || UUID.test(job.reservationId))
        || !(job.output === null || (record(job.output) && record(job.output.fingerprint) && record(job.output.media)))) throw new Error();
      if (job.status === 'deferred' && (job.progress !== null || job.reservationId !== null || job.output !== null)) throw new Error();
    }
    return data;
  } catch (error) {
    if (error.code === 'ENOENT') return { schemaVersion: 1, jobs: {} };
    fail(503, 'preparation_state_invalid', 'Preparation history needs recovery. Existing files were not changed.');
  }
}

function writeJobs(root, data) {
  const text = JSON.stringify(data, null, 2);
  if (Buffer.byteLength(text) > 2 * 1024 * 1024 || Object.keys(data.jobs).length > 1000) fail(507, 'preparation_history_full', 'Preparation history has reached its supported size.');
  if (!safeWriteFileSync(ledgerPath(root), text)) fail(507, 'storage_full', 'Preparation progress could not be saved.');
}

function updateJob(root, id, patch) {
  return withPreparationBudgetLock(root, () => {
    const data = readJobs(root);
    if (!Object.hasOwn(data.jobs, id)) fail(404, 'preparation_not_found', 'This preparation could not be found.');
    const job = { ...data.jobs[id], ...patch, updatedAt: Date.now() };
    data.jobs[id] = job;
    writeJobs(root, data);
    return job;
  });
}

function identity(req, expected, options, owner = false) {
  const auth = playbackIdentity(req, options);
  if (!auth.ok) fail(auth.status, auth.code, 'Open an authorized profile to manage prepared media.');
  if (auth.profile.isKids || auth.profile.role === 'child') fail(403, 'adult_required', 'An adult profile manages prepared media.');
  if (auth.profile.id !== expected) fail(403, 'profile_changed', 'The active profile changed.');
  if (owner && auth.profile.role !== 'owner') fail(403, 'owner_required', 'Only the home owner can prepare media.');
  return auth;
}

function original(req, titleId, options) {
  const source = resolveVerifiedLocalOriginal(req, titleId, options);
  const relative = path.relative(path.join(rootOf(options), 'prepared-media'), source.file.path);
  if (relative === '' || (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))) fail(409, 'original_required', 'Prepare from an original, not another prepared copy.');
  return source;
}

function validateReady(req, job, options) {
  if (!isDeepStrictEqual(original(req, job.titleId, options), job.source)) fail(409, 'source_changed', 'The original source changed. Prepare this title again.');
  const file = outputPath(rootOf(options), job.id);
  if (!isDeepStrictEqual(directoryIdentity(path.dirname(file)), job.directory)
    || !job.output || !isDeepStrictEqual(fingerprint(file), job.output.fingerprint)) fail(409, 'prepared_file_changed', 'The prepared copy is no longer verified.');
  return file;
}

function publicJob(req, job, options) {
  let { status, message, progress } = job;
  const root = rootOf(options);
  if (active(job) && runners.get(root)?.id !== job.id && !workerMayBeAlive(root)) {
    status = 'interrupted'; progress = null;
    message = 'Preparation was interrupted. Its worker and reserved space need recovery before retrying.';
  }
  if (status === 'ready') {
    try { validateReady(req, job, options); }
    catch { status = 'failed'; progress = null; message = 'The prepared copy or its original is no longer available. Nothing was deleted.'; }
  }
  return { id: job.id, titleId: job.titleId, title: job.title, recipe: job.recipe, status, progress, message,
    createdAt: job.createdAt, updatedAt: job.updatedAt,
    canRetry: ['deferred', 'failed', 'cancelled', 'interrupted'].includes(status) && !runners.has(root)
      && !fs.existsSync(path.join(root, 'preparation-worker.lock')) && job.reservationId === null };
}

function deferJob(req, auth, source, recipe, reason, options) {
  const root = rootOf(options);
  const id = randomUUID();
  const item = readPlaybackLibraryItems(options).find((candidate) => candidate.id === source.titleId);
  const now = Date.now();
  const job = {
    id, profileId: auth.profile.id, titleId: source.titleId,
    title: String(item?.title || item?.Name || 'Personal media').slice(0, 500), recipe,
    status: 'deferred', progress: null, message: waitingMessage(reason), createdAt: now, updatedAt: now,
    source, directory: null, reservationId: null, output: null,
  };
  withPreparationBudgetLock(root, () => {
    identity(req, auth.profile.id, options, true);
    if (!isDeepStrictEqual(original(req, source.titleId, options), source)) fail(409, 'source_changed', 'The source changed while preparation was deferred.');
    const data = readJobs(root); data.jobs[id] = job; writeJobs(root, data);
  });
  return job;
}

// Absence from this process is not evidence that another server's worker died.
// Unknown/malformed lock ownership is preserved for explicit recovery.
function workerMayBeAlive(root) {
  try {
    const file = path.join(root, 'preparation-worker.lock'), stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024) return true;
    const lock = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Number.isSafeInteger(lock.processId) || lock.processId <= 0) return true;
    try { process.kill(lock.processId, 0); return true; }
    catch (error) { return error.code !== 'ESRCH'; }
  } catch (error) { return error.code !== 'ENOENT'; }
}

function workloadReason(root) {
  if (hasPreparationBlockingPlayback()) return 'playback_yield';
  if (featureCollisionArbiter.memoryPressure !== 'none') return 'memory_yield';
  if (featureCollisionArbiter.isGamingActive || featureCollisionArbiter.isCreatorAppActive) return 'host_yield';
  if (os.freemem() < Math.max(512 * 1024 ** 2, os.totalmem() * 0.1)) return 'memory_yield';
  const storage = checkStorageHeadroom(root, { allowSimulation: false });
  if (!storage.ok || storage.freeBytes < Math.max(2 * 1024 ** 3, Math.ceil(storage.totalBytes * 0.1))) return 'storage_yield';
  return null;
}

function acquireWorker(root) {
  return withPreparationBudgetLock(root, () => {
    const file = path.join(root, 'preparation-worker.lock');
    let fd;
    try { fd = fs.openSync(file, 'wx', 0o600); }
    catch (error) { fail(error.code === 'EEXIST' ? 409 : 503, 'preparation_worker_busy', 'Another preparation is active, or an interrupted worker needs recovery.'); }
    let owned, closed = false;
    const release = () => {
      if (closed) return;
      closed = true;
      try { fs.closeSync(fd); } catch { /* Preserve unknown ownership. */ }
      try {
        const now = fs.lstatSync(file, { bigint: true });
        if (owned && !now.isSymbolicLink() && now.dev === owned.dev && now.ino === owned.ino) fs.unlinkSync(file);
      } catch { /* Never reclaim another worker's lock. */ }
    };
    try {
      owned = fs.fstatSync(fd, { bigint: true });
      fs.writeFileSync(fd, JSON.stringify({ processId: process.pid, startedAt: Date.now() }));
      return release;
    } catch (error) { release(); throw error; }
  });
}

function partialAbsent(root, job) {
  const file = outputPath(root, job.id);
  try {
    if (!isDeepStrictEqual(directoryIdentity(path.dirname(file)), job.directory)) return false;
    // A UUID directory alone does not prove that FFmpeg created the current
    // output. Preserve failed/replaced bytes until ownership can be established.
    fs.lstatSync(file);
    return false;
  } catch (error) { return error.code === 'ENOENT'; }
}

async function startJob(req, { titleId, recipe, expectedProfileId }, options) {
  if (typeof titleId !== 'string' || !ID.test(titleId) || !recipeKnown(recipe)) fail(400, 'invalid_preparation', 'Choose a local original and a supported playback format.');
  const auth = identity(req, expectedProfileId, options, true);
  const root = rootOf(options);
  const source = original(req, titleId, options);
  const existing = Object.values(readJobs(root).jobs).find((job) => job.profileId === auth.profile.id && job.recipe === recipe && job.status === 'ready' && isDeepStrictEqual(job.source, source));
  if (existing) {
    try { validateReady(req, existing, options); return existing; } catch { /* Create a new verified copy rather than adopting changed bytes. */ }
  }
  const reason = (options.workloadReason || workloadReason)(root);
  if (reason) return deferJob(req, auth, source, recipe, reason, options);
  const admission = admitCoordinatedWorkload(root, {
    workloadId: `media-preparation:${randomUUID()}`,
    workloadClass: options.workloadClass || 'requested_work',
    memoryBytes: options.preparationMemoryBudgetBytes ?? PREPARATION_MEMORY_BUDGET_BYTES,
    preemption: 'cancel',
    hardwareSensitive: true,
    metadata: { operation: 'media-preparation' },
  }, options.resourceGovernor);
  if (!admission.ok) {
    const code = governorWaitCode(admission.code);
    return deferJob(req, auth, source, recipe, code, options);
  }
  const resourceLease = admission.lease;
  let leaseTransferred = false;
  let releaseWorker = () => {};
  const startup = new AbortController();
  const checkStartup = () => {
    try {
      const reason = (options.workloadReason || workloadReason)(root);
      if (reason) startup.abort({ code: reason });
    } catch { startup.abort({ code: 'host_yield' }); }
  };
  const unsubscribeStartup = subscribePreparationBlockingPlayback((blocking) => { if (blocking) startup.abort({ code: 'playback_yield' }); });
  const externalAbort = () => startup.abort({ code: 'cancelled' });
  const resourceAbort = () => startup.abort({ code: resourceLease?.signal.reason?.code === 'playback_active' ? 'playback_yield' : 'host_yield' });
  options.signal?.addEventListener('abort', externalAbort, { once: true });
  resourceLease?.signal.addEventListener('abort', resourceAbort, { once: true });
  if (options.signal?.aborted) externalAbort();
  const startupTimer = setInterval(checkStartup, 500); startupTimer.unref?.();
  let reservation, job, runner;
  try {
    releaseWorker = acquireWorker(root);
    checkStartup();
    const metadata = await (options.probe || probePreparationSource)(source.file.path, { signal: startup.signal });
    if (startup.signal.aborted) fail(409, startup.signal.reason?.code || 'preparation_interrupted', waitingMessage(startup.signal.reason?.code));
    identity(req, expectedProfileId, options, true);
    if (!isDeepStrictEqual(original(req, titleId, options), source)) fail(409, 'source_changed', 'The source changed while it was checked.');
    const afterProbeReason = (options.workloadReason || workloadReason)(root);
    if (afterProbeReason) fail(409, afterProbeReason, waitingMessage(afterProbeReason));
    const maxBytes = estimatePreparationBytes(metadata, recipe);
    reservation = reservePreparationBytes(maxBytes, root);
    if (!reservation.ok) fail(409, reservation.code, reservation.reason);
    const id = randomUUID();
    const parent = path.join(root, 'prepared-media');
    fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
    directoryIdentity(parent);
    const directory = path.join(parent, id);
    fs.mkdirSync(directory, { mode: 0o700 });
    const item = readPlaybackLibraryItems(options).find((item) => item.id === source.titleId);
    job = { id, profileId: auth.profile.id, titleId: source.titleId, title: String(item?.title || item?.Name || 'Personal media').slice(0, 500), recipe,
      status: 'preparing', progress: 0, message: 'Preparing a compatible local copy.', createdAt: Date.now(), updatedAt: Date.now(),
      source, directory: directoryIdentity(directory), reservationId: reservation.id, output: null };
    withPreparationBudgetLock(root, () => {
      identity(req, expectedProfileId, options, true);
      const data = readJobs(root); data.jobs[id] = job; writeJobs(root, data);
    });
    runner = { id, controller: new AbortController(), promise: null };
    runners.set(root, runner);
    leaseTransferred = true;
    runner.promise = executeJob(req, job, source, reservation, maxBytes, runner, releaseWorker, options, resourceLease);
    // Errors are recorded by executeJob; never create an unhandled background rejection.
    runner.promise.catch(() => {});
    return job;
  } catch (error) {
    if (reservation?.ok) releasePreparationReservation(reservation.id, root);
    releaseWorker();
    const waitCode = startup.signal.aborted ? startup.signal.reason?.code : error.code;
    if (YIELD_CODES.has(waitCode)) return deferJob(req, auth, source, recipe, waitCode, options);
    if (startup.signal.aborted) fail(409, startup.signal.reason?.code || 'preparation_interrupted', waitingMessage(startup.signal.reason?.code));
    throw error;
  } finally {
    clearInterval(startupTimer); unsubscribeStartup();
    options.signal?.removeEventListener('abort', externalAbort);
    resourceLease?.signal.removeEventListener('abort', resourceAbort);
    if (!leaseTransferred) resourceLease?.release();
  }
}

async function executeJob(req, job, source, reservation, maxBytes, runner, releaseWorker, options, resourceLease) {
  const root = rootOf(options), output = outputPath(root, job.id);
  let lastSave = 0, finished = false;
  const stop = (code) => { if (!runner.controller.signal.aborted) runner.controller.abort({ code }); };
  const check = () => {
    try {
      identity(req, job.profileId, options, true);
      if (!isDeepStrictEqual(original(req, job.titleId, options), source)) return stop('source_changed');
      const reason = (options.workloadReason || workloadReason)(root);
      if (reason) stop(reason);
      if (fs.existsSync(output) && Number(fingerprint(output).size) > maxBytes) stop('preparation_limit');
    } catch { stop('access_changed'); }
  };
  const unsubscribe = subscribePreparationBlockingPlayback((blocking) => { if (blocking) stop('playback_yield'); });
  const resourceAbort = () => stop(resourceLease?.signal.reason?.code === 'playback_active' ? 'playback_yield' : 'host_yield');
  resourceLease?.signal.addEventListener('abort', resourceAbort, { once: true });
  const timer = setInterval(check, 500); timer.unref?.();
  const heartbeat = resourceLease ? setInterval(() => {
    const result = resourceLease.heartbeat();
    if (!result.ok) stop(result.code === 'lease_expired' ? 'host_yield' : 'host_yield');
  }, 10000) : null;
  heartbeat?.unref?.();
  try {
    check();
    const media = await (options.runCodec || runPreparationCodec)({ inputPath: source.file.path, outputPath: output, recipe: job.recipe, maxBytes,
      signal: runner.controller.signal,
      onPhase: (phase) => {
        if (phase !== 'validating') return;
        try { updateJob(root, job.id, { status: 'validating', message: 'Checking the prepared copy before making it available.' }); }
        catch { stop('progress_save_failed'); }
      },
      onProgress: (fraction) => {
        if (Date.now() - lastSave < 1000 || !Number.isFinite(fraction)) return;
        lastSave = Date.now();
        try { updateJob(root, job.id, { progress: Math.max(0, Math.min(0.99, fraction)) }); }
        catch { stop('progress_save_failed'); }
      } });
    check();
    if (runner.controller.signal.aborted) throw new Error('Preparation interrupted');
    const bytes = fingerprint(output);
    if (!isDeepStrictEqual(bytes, media.verifiedFingerprint) || Number(bytes.size) > maxBytes || Number(bytes.size) <= 0 || !isDeepStrictEqual(directoryIdentity(path.dirname(output)), job.directory)) fail(409, 'prepared_file_changed', 'Prepared output could not be verified.');
    updateJob(root, job.id, { status: 'ready', progress: 1, message: 'The prepared copy passed validation.', output: { fingerprint: bytes, media } });
    finished = true;
  } catch (error) {
    const code = runner.controller.signal.reason?.code || error.code || 'preparation_failed';
    const cancelled = code === 'cancelled';
    const yielding = YIELD_CODES.has(code);
    // The converter reaps before rejecting. Unknown failed output is preserved,
    // counted by the storage budget, and never published as ready.
    const cleaned = partialAbsent(root, job);
    const message = cancelled ? 'Preparation cancelled. Your original is unchanged.'
      : yielding ? waitingMessage(code)
      : failureMessages[code] || 'This copy could not be prepared and verified. Your original is unchanged.';
    try { updateJob(root, job.id, { status: cancelled ? 'cancelled' : yielding ? 'deferred' : 'failed', progress: null,
      message: message + (cleaned ? '' : ' Unverified output was preserved and still counts toward storage.'), output: null }); } catch { /* Keep unverified work unavailable. */ }
  } finally {
    clearInterval(timer); if (heartbeat) clearInterval(heartbeat); unsubscribe();
    resourceLease?.signal.removeEventListener('abort', resourceAbort);
    const released = releasePreparationReservation(reservation.id, root);
    if (released.ok) {
      try { updateJob(root, job.id, { reservationId: null }); } catch { /* A remaining reservation reference prevents an unsafe retry. */ }
    } else if (finished) {
      try { updateJob(root, job.id, { message: 'The copy is verified; reserved-space bookkeeping needs recovery.' }); } catch {}
    }
    runners.delete(root);
    resourceLease?.release();
    releaseWorker();
  }
}

/** Local-original preparation only. Provider acquisition is a separate adapter. */
export async function handleMediaPreparationRoute(req, res, url, readBody, options = {}) {
  const match = /^\/api\/preparation(?:\/([0-9a-f-]+)\/(file|cancel|retry|viewing))?$/.exec(url.pathname);
  if (!match) return false;
  const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }); res.end(JSON.stringify(value)); return true; };
  try {
    const method = (req.method || 'GET').toUpperCase();
    if (!isSameOriginProfileMutation(req, url)) fail(403, 'cross_origin_denied', "Use this home's connection.");
    const initial = playbackIdentity(req, options);
    if (!initial.ok) fail(initial.status, initial.code, 'Open an authorized profile.');
    if (initial.profile.isKids) fail(403, 'adult_required', 'An adult manages prepared media.');
    const root = rootOf(options), [, id, action] = match;
    if (id && !UUID.test(id)) fail(400, 'invalid_preparation', 'Choose an existing preparation.');
    if (['GET', 'HEAD'].includes(method)) {
      if ([...url.searchParams].length !== 1 || !url.searchParams.has('expectedProfileId')) fail(400, 'profile_required', 'Supply the current profile.');
      const auth = identity(req, url.searchParams.get('expectedProfileId'), options);
      if (!id && method === 'GET') return send(200, { ok: true, available: true, profileId: auth.profile.id, canManage: auth.profile.role === 'owner', recipes: recipes(),
        jobs: auth.profile.role === 'owner' ? Object.values(readJobs(root).jobs).filter((job) => job.profileId === auth.profile.id).map((job) => publicJob(req, job, options)).sort((a, b) => b.createdAt - a.createdAt) : [] });
      if (action !== 'file') fail(405, 'method_not_allowed', 'Method not allowed.');
      identity(req, auth.profile.id, options, true);
      const job = readJobs(root).jobs[id];
      if (!job || job.profileId !== auth.profile.id || job.status !== 'ready') fail(404, 'preparation_not_ready', 'No verified prepared copy is available.');
      const file = validateReady(req, job, options);
      const { streamLocalFile } = await import('./neural-stream-server.mjs');
      identity(req, auth.profile.id, options, true);
      validateReady(req, job, options);
      streamLocalFile(req, res, file, 'video/mp4', { expectedFingerprint: job.output.fingerprint });
      return true;
    }
    if (method !== 'POST' || action === 'file') fail(405, 'method_not_allowed', 'Method not allowed.');
    identity(req, initial.profile.id, options, true);
    if ([...url.searchParams].length) fail(400, 'invalid_payload', 'Preparation changes accept a JSON body only.');
    let body;
    try { body = await readBody(req); } catch (error) { fail(error.status === 413 ? 413 : 400, 'invalid_payload', 'Preparation request could not be read.'); }
    identity(req, initial.profile.id, options, true);
    if (!record(body) || body.expectedProfileId !== initial.profile.id) fail(403, 'profile_changed', 'The active profile changed.');
    if (action === 'viewing') {
      if (!exact(body, ['expectedProfileId', 'sessionId', 'action']) || !UUID.test(body.sessionId)
        || !['start', 'heartbeat', 'stop'].includes(body.action)) fail(400, 'invalid_viewing_session', 'A valid viewing session is required.');
      const now = Date.now();
      for (const [key, session] of viewingSessions) if (session.expiresAt <= now) {
        viewingSessions.delete(key); endPreparationBlockingSession(key);
      }
      const key = `prepared:${root}:${body.sessionId}`, previous = viewingSessions.get(key);
      if (previous && (previous.deviceId !== initial.device.id || previous.profileId !== initial.profile.id || previous.jobId !== id)) fail(403, 'viewing_session_forbidden', 'This viewing session belongs to another person or device.');
      if (body.action !== 'start' && !previous) fail(409, 'viewing_session_expired', 'Reopen the prepared copy to continue.');
      if (body.action === 'stop') {
        viewingSessions.delete(key); endPreparationBlockingSession(key);
        return send(200, { ok: true, profileId: initial.profile.id, jobId: id, sessionId: body.sessionId, action: body.action, expiresAt: null });
      }
      const current = readJobs(root).jobs[id];
      if (!current || current.profileId !== initial.profile.id || current.status !== 'ready') fail(404, 'preparation_not_ready', 'No verified prepared copy is available.');
      validateReady(req, current, options);
      if (!previous && viewingSessions.size >= 256) fail(503, 'viewing_sessions_full', 'Too many prepared viewing sessions are open.');
      const expiresAt = now + VIEWING_LEASE_MS;
      viewingSessions.set(key, { deviceId: initial.device.id, profileId: initial.profile.id, jobId: id, expiresAt });
      updatePreparationBlockingSession(key, expiresAt);
      return send(200, { ok: true, profileId: initial.profile.id, jobId: id, sessionId: body.sessionId, action: body.action, expiresAt });
    }
    let job;
    if (!id) {
      if (!exact(body, ['expectedProfileId', 'titleId', 'recipe'])) fail(400, 'invalid_payload', 'Choose a title and playback format only.');
      job = await startJob(req, body, options);
    } else {
      if (!exact(body, ['expectedProfileId'])) fail(400, 'invalid_payload', 'Supply the current profile only.');
      const previous = readJobs(root).jobs[id];
      if (!previous || previous.profileId !== initial.profile.id) fail(404, 'preparation_not_found', 'Preparation not found.');
      if (action === 'cancel') {
        const runner = runners.get(root);
        if (!runner || runner.id !== id || !active(previous)) fail(409, 'preparation_not_active', 'This preparation is not running.');
        runner.controller.abort({ code: 'cancelled' });
        await runner.promise;
        job = readJobs(root).jobs[id];
        if (job?.status !== 'cancelled') fail(507, 'cancellation_not_saved', 'The worker stopped, but cancellation could not be saved. Refresh preparation before retrying.');
      } else {
        if (!publicJob(req, previous, options).canRetry) fail(409, 'preparation_not_retryable', 'This preparation cannot be retried until its worker and reserved space are settled.');
        job = await startJob(req, { expectedProfileId: initial.profile.id, titleId: previous.titleId, recipe: previous.recipe }, options);
      }
    }
    identity(req, initial.profile.id, options, true);
    job = readJobs(root).jobs[job.id];
    return send(202, { ok: true, persisted: true, profileId: initial.profile.id, job: publicJob(req, job, options) });
  } catch (error) {
    return send(error.status || 503, { ok: false, code: error.code || 'preparation_unavailable', error: error.status ? error.message : 'Preparation is unavailable. Nothing was marked ready.' });
  }
}

export async function waitForPreparationIdle(stateDir) {
  await runners.get(path.resolve(stateDir))?.promise;
}
