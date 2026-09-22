import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, describe, it } from 'node:test';
import { handleMediaPreparationRoute, waitForPreparationIdle } from './media-preparation-service.mjs';
import { saveProfile } from './profile-service.mjs';
import { registerAuthorizedDevice, signDeviceToken, getGateSecret, revokeAuthorizedDevice } from './reelos-gate-service.mjs';
import { replaceProfileSession } from './profile-session-service.mjs';
import { createMockRequest, createMockResponse } from '../test-harness/harness-utils.mjs';
import { beginPreparationBlockingStream, hasPreparationBlockingPlayback, subscribePreparationBlockingPlayback } from './preparation-activity.mjs';
import { probePreparationSource, runPreparationCodec } from './preparation-codec.mjs';
import { ResourceGovernor } from './resource-governor-service.mjs';

const GiB = 1024 ** 3;
const fingerprint = (file) => {
  const stat = fs.lstatSync(file, { bigint: true });
  return Object.fromEntries(['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'].map((key) => [key, String(stat[key])]));
};
const metadata = { sizeBytes: 1024, durationSeconds: 1, width: 640, height: 360, videoCodec: 'h264', pixelFormat: 'yuv420p',
  hdr: false, frameRate: 24, videoIndex: 0, audioCodecs: [], audioChannels: [], audioIndices: [], subtitleCodecs: [], subtitleIndices: [] };
function receipt(outputPath) {
  return { durationSeconds: 1, width: 640, height: 360, videoCodec: 'h264', audioCodecs: [], subtitleCodecs: [],
    sizeBytes: fs.statSync(outputPath).size, recipe: 'compatible', operation: 'remux', verifiedFingerprint: fingerprint(outputPath) };
}
async function goodCodec({ outputPath, onPhase }) {
  fs.writeFileSync(outputPath, 'isolated prepared fixture bytes');
  onPhase?.('validating');
  return receipt(outputPath);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function holdUntilAbort(signal, entered) {
  assert.ok(signal instanceof AbortSignal, 'Every codec/probe must have a cancellation signal');
  return new Promise((_resolve, reject) => {
    const abort = () => reject(Object.assign(new Error('fixture abort after process reaping'), { code: 'preparation_aborted' }));
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
    entered.resolve(signal);
  });
}
function waitForPlaybackIdle() {
  if (!hasPreparationBlockingPlayback()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { unsubscribe(); reject(new Error('Fixture playback leases did not settle')); }, 2000);
    const unsubscribe = subscribePreparationBlockingPlayback((active) => {
      if (!active) { clearTimeout(timer); unsubscribe(); resolve(); }
    });
  });
}

describe('Private original preparation integration', () => {
  let stateDir, profilesDir, sourceFile, options, item;
  beforeEach((t) => {
    stateDir = fs.mkdtempSync(path.join(process.cwd(), '.media-preparation-'));
    profilesDir = path.join(stateDir, 'profiles');
    sourceFile = path.join(stateDir, 'original.mp4');
    fs.writeFileSync(sourceFile, 'irreplaceable isolated original bytes');
    for (const id of ['owner', 'other-owner', 'reader']) saveProfile({ id, name: id, role: id === 'reader' ? 'member' : 'owner' }, profilesDir);
    saveProfile({ id: 'child', name: 'Child', role: 'child', isKids: true, pin: '2468' }, profilesDir);
    item = { id: 'local-film', type: 'movie', title: 'Private original fixture', path: sourceFile, sourceKind: 'personal_import', OfficialRating: 'G' };
    shelf([item]);
    t.mock.method(fs, 'statfsSync', () => ({ bsize: 1, blocks: 100 * GiB, bavail: 80 * GiB, bfree: 80 * GiB }));
    options = { stateDir, profilesDir, presenceService: { roomPresence: new Map() }, workloadReason: () => null,
      probe: async () => ({ ...metadata }), runCodec: goodCodec };
  });
  afterEach(async () => {
    await waitForPreparationIdle(stateDir);
    await waitForPlaybackIdle();
    fs.rmSync(stateDir, { recursive: true, force: true });
  });
  function shelf(titles) { fs.writeFileSync(path.join(stateDir, 'library-shelf.json'), JSON.stringify({ titles })); }
  function jobs() { return JSON.parse(fs.readFileSync(path.join(stateDir, 'preparation-jobs.json'), 'utf8')).jobs; }
  function reservations() {
    const file = path.join(stateDir, 'preparation-reservations.json');
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).reservations : {};
  }
  function output(id) { return path.join(stateDir, 'prepared-media', id, 'output.mp4'); }
  function client(profileId = 'owner') {
    const device = registerAuthorizedDevice({ name: 'Fixture', activeProfileId: profileId }, stateDir);
    const deviceCookie = `reelos_device_token=${signDeviceToken(device, getGateSecret(stateDir))}`;
    const session = replaceProfileSession({ headers: { cookie: deviceCookie } }, profilesDir, profileId, device.id);
    const cookie = `${deviceCookie}; ${session.cookie.split(';')[0]}`;
    const call = async (method, suffix = '', body, overrides = {}) => {
      const url = `/api/preparation${suffix}${['GET', 'HEAD'].includes(method) ? `${suffix.includes('?') ? '&' : '?'}expectedProfileId=${profileId}` : ''}`;
      const req = createMockRequest({ method, url, headers: { host: 'localhost', cookie, ...overrides.headers } });
      const res = createMockResponse();
      assert.equal(await handleMediaPreparationRoute(req, res, new URL(url, 'http://localhost'), overrides.readBody || (async () => body), options), true);
      await res.waitForEnd();
      return { status: res.statusCode, data: res.json, raw: res.body, res };
    };
    return { device, call, list: () => call('GET'),
      start: (patch = {}) => call('POST', '', { expectedProfileId: profileId, titleId: item.id, recipe: 'compatible', ...patch }),
      cancel: (id) => call('POST', `/${id}/cancel`, { expectedProfileId: profileId }),
      retry: (id) => call('POST', `/${id}/retry`, { expectedProfileId: profileId }),
      viewing: (id, sessionId, action, patch = {}) => call('POST', `/${id}/viewing`, { expectedProfileId: profileId, sessionId, action, ...patch }),
      file: (id, method = 'GET') => call(method, `/${id}/file`, null, { headers: { range: 'bytes=0-7' } }) };
  }

  it('requires authorized adults, owner mutations, exact identity, same origin and strict bounded route bodies', async () => {
    const owner = client();
    assert.equal((await owner.call('GET', '', null, { headers: { cookie: '' } })).status, 401);
    assert.equal((await client('child').list()).status, 403);
    const reader = client('reader');
    assert.equal((await reader.list()).data.canManage, false);
    assert.equal((await reader.start()).status, 403);
    assert.equal((await owner.start({ expectedProfileId: 'other-owner' })).status, 403);
    assert.equal((await owner.call('POST', '', { expectedProfileId: 'owner', titleId: item.id, recipe: 'compatible' }, { headers: { origin: 'https://outside.invalid' } })).status, 403);
    for (const patch of [{ path: sourceFile }, { outputPath: sourceFile }, { url: 'https://outside.invalid/media' }, { recipe: 'invented' }, { titleId: '../original.mp4' }]) {
      assert.equal((await owner.start(patch)).status, 400);
    }
    assert.equal((await owner.call('POST', '', {}, { readBody: async () => { throw Object.assign(new Error(), { status: 413 }); } })).status, 413);
    assert.equal(fs.existsSync(path.join(stateDir, 'preparation-jobs.json')), false);
    assert.deepEqual(reservations(), {});
  });

  it('denies provider projections, unknown ownership and originals inside prepared storage without running a codec', async () => {
    const owner = client();
    let calls = 0;
    options.runCodec = async () => { calls++; throw new Error('must not run'); };
    for (const sourceKind of ['debrid', 'unknown', undefined]) {
      shelf([{ ...item, sourceKind }]);
      assert.notEqual((await owner.start()).status, 202);
    }
    const folder = path.join(stateDir, 'prepared-media');
    fs.mkdirSync(folder);
    const nested = path.join(folder, 'not-an-original.mp4');
    fs.writeFileSync(nested, 'existing prepared bytes');
    shelf([{ ...item, path: nested }]);
    assert.equal((await owner.start()).data.code, 'original_required');
    assert.equal(calls, 0);
    assert.equal(fs.readFileSync(sourceFile, 'utf8'), 'irreplaceable isolated original bytes');
    assert.equal(fs.readFileSync(nested, 'utf8'), 'existing prepared bytes');
  });

  it('publishes only verified ready output, serves guarded ranges, and keeps job metadata profile-private', async () => {
    const owner = client();
    const started = await owner.start();
    assert.equal(started.status, 202);
    assert.equal(started.data.persisted, true);
    await waitForPreparationIdle(stateDir);
    const listing = await owner.list();
    const job = listing.data.jobs[0];
    assert.equal(job.status, 'ready');
    assert.equal(job.progress, 1);
    assert.equal(job.title, item.title);
    assert.equal(listing.res.getHeader('cache-control'), 'private, no-store');
    assert.equal(JSON.stringify(listing.data).includes(sourceFile), false);
    for (const secret of ['source', 'directory', 'reservationId', 'fingerprint', 'verifiedFingerprint']) assert.equal(Object.hasOwn(job, secret), false);
    assert.equal((await owner.file(job.id)).raw.toString(), 'isolated');
    assert.equal((await owner.file(job.id, 'HEAD')).raw.length, 0);
    const other = client('other-owner');
    assert.deepEqual((await other.list()).data.jobs, []);
    assert.equal((await other.file(job.id)).status, 404);
    assert.equal((await other.cancel(job.id)).status, 404);
    assert.equal((await other.retry(job.id)).status, 404);
    assert.deepEqual(reservations(), {});
    assert.equal(jobs()[job.id].reservationId, null);
    assert.equal(fs.readFileSync(sourceFile, 'utf8'), 'irreplaceable isolated original bytes');
  });

  it('reuses an exact verified recipe but rejects stale source identity and allocates a fresh job', async () => {
    const owner = client();
    let codecs = 0;
    options.runCodec = async (args) => { codecs++; return goodCodec(args); };
    const first = await owner.start();
    await waitForPreparationIdle(stateDir);
    const reused = await owner.start();
    assert.equal(reused.data.job.id, first.data.job.id);
    assert.equal(reused.data.job.status, 'ready');
    assert.equal(codecs, 1);
    fs.appendFileSync(sourceFile, ' source changed');
    assert.equal((await owner.list()).data.jobs[0].status, 'failed');
    assert.equal((await owner.file(first.data.job.id)).status, 409);
    const replacement = await owner.start();
    await waitForPreparationIdle(stateDir);
    assert.notEqual(replacement.data.job.id, first.data.job.id);
    assert.equal(codecs, 2);
    assert.equal(fs.existsSync(output(first.data.job.id)), true, 'invalidated old output is not deleted');
  });

  it('reuses a verified prepared copy during memory pressure without launching or claiming new work', async () => {
    const owner = client();
    let codecs = 0;
    options.runCodec = async (args) => { codecs++; return goodCodec(args); };
    const first = await owner.start();
    await waitForPreparationIdle(stateDir);
    options.workloadReason = () => 'memory_yield';
    const reused = await owner.start();
    assert.equal(reused.status, 202);
    assert.equal(reused.data.job.id, first.data.job.id);
    assert.equal(reused.data.job.status, 'ready');
    assert.equal(reused.data.job.progress, 1);
    assert.equal(codecs, 1);
    assert.deepEqual(reservations(), {});
    assert.equal(fs.readFileSync(sourceFile, 'utf8'), 'irreplaceable isolated original bytes');
  });

  it('cancels only after the worker settles, releases reservation, and retries with a new UUID', async () => {
    const owner = client(), entered = deferred(), reaped = deferred();
    options.runCodec = async ({ signal }) => {
      await holdUntilAbort(signal, entered).catch(async (error) => { await reaped.promise; throw error; });
    };
    const started = await owner.start();
    const signal = await entered.promise;
    assert.equal(Object.keys(reservations()).length, 1);
    const cancellation = owner.cancel(started.data.job.id);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(signal.aborted, true);
    assert.equal(Object.keys(reservations()).length, 1, 'cannot release bytes while the process still owns them');
    reaped.resolve();
    const cancelled = await cancellation;
    assert.equal(cancelled.data.job.status, 'cancelled');
    assert.equal(cancelled.data.job.canRetry, true);
    assert.deepEqual(reservations(), {});
    options.runCodec = goodCodec;
    const retried = await owner.retry(started.data.job.id);
    await waitForPreparationIdle(stateDir);
    assert.notEqual(retried.data.job.id, started.data.job.id);
    assert.equal(jobs()[retried.data.job.id].status, 'ready');
  });

  it('playback aborts the initial probe into a persisted deferred job without reserving space', async () => {
    const owner = client(), entered = deferred();
    options.probe = (_file, { signal }) => holdUntilAbort(signal, entered);
    const starting = owner.start();
    const signal = await entered.promise;
    const release = beginPreparationBlockingStream();
    try {
      assert.equal(signal.aborted, true);
      const result = await starting;
      assert.equal(result.status, 202);
      assert.equal(result.data.persisted, true);
      assert.equal(result.data.job.status, 'deferred');
      assert.equal(result.data.job.canRetry, true);
      assert.equal(result.data.job.progress, null);
      assert.deepEqual(reservations(), {});
      assert.equal(jobs()[result.data.job.id].output, null);
      assert.equal(jobs()[result.data.job.id].directory, null);
      assert.equal(fs.existsSync(path.join(stateDir, 'preparation-worker.lock')), false);
    } finally { release(); }
  });

  it('playback during codec work aborts promptly and records deferred only after settling', async () => {
    const owner = client(), entered = deferred();
    options.runCodec = ({ signal }) => holdUntilAbort(signal, entered);
    const started = await owner.start();
    const signal = await entered.promise;
    const release = beginPreparationBlockingStream();
    try {
      assert.equal(signal.aborted, true);
      await waitForPreparationIdle(stateDir);
      assert.equal(jobs()[started.data.job.id].status, 'deferred');
      assert.equal(jobs()[started.data.job.id].output, null);
      assert.deepEqual(reservations(), {});
    } finally { release(); }
  });

  it('persists a retryable deferred job before probing when the shared governor cannot preserve its memory floor', async () => {
    let probes = 0;
    const governor = new ResourceGovernor({
      telemetry: () => ({ availableMemoryBytes: 400 * 1024 ** 2, freeDiskBytes: 10 * GiB }),
      memorySafetyFloorBytes: 128 * 1024 ** 2,
      diskSafetyFloorBytes: GiB,
      autoSweep: false,
    });
    options.resourceGovernor = governor;
    options.probe = async () => { probes++; return metadata; };
    try {
      const denied = await client().start();
      assert.equal(denied.status, 202);
      assert.equal(denied.data.persisted, true);
      assert.equal(denied.data.job.status, 'deferred');
      assert.equal(denied.data.job.canRetry, true);
      assert.match(denied.data.job.message, /more free memory/i);
      assert.equal(probes, 0);
      assert.equal(fs.existsSync(path.join(stateDir, 'preparation-worker.lock')), false);
      assert.deepEqual(reservations(), {});
      assert.equal(jobs()[denied.data.job.id].output, null);
      assert.equal(fs.readFileSync(sourceFile, 'utf8'), 'irreplaceable isolated original bytes');
      assert.equal(governor.snapshot().metrics.denied, 1);
    } finally { governor.close(); }
  });

  it('shared playback pressure cancels codec work and releases its resource lease after reaping', async () => {
    const entered = deferred();
    const governor = new ResourceGovernor({
      telemetry: () => ({ availableMemoryBytes: 2 * GiB, freeDiskBytes: 10 * GiB }),
      memorySafetyFloorBytes: 128 * 1024 ** 2,
      diskSafetyFloorBytes: GiB,
      autoSweep: false,
    });
    options.resourceGovernor = governor;
    options.runCodec = ({ signal }) => holdUntilAbort(signal, entered);
    try {
      const started = await client().start();
      const signal = await entered.promise;
      assert.equal(governor.snapshot().activeWorkloads.requested_work, 1);
      governor.updateForegroundState({ playbackActive: true });
      assert.equal(signal.aborted, true);
      await waitForPreparationIdle(stateDir);
      assert.equal(jobs()[started.data.job.id].status, 'deferred');
      assert.equal(governor.snapshot().commitments.memoryBytes, 0);
      assert.equal(governor.snapshot().leaseStates.cancelled, 1);
    } finally {
      governor.updateForegroundState({ playbackActive: false });
      governor.close();
    }
  });

  it('rejects substituted output receipts and preserves all unverified replacement bytes', async () => {
    const owner = client();
    options.runCodec = async ({ outputPath }) => {
      fs.writeFileSync(outputPath, 'verified A');
      const verified = receipt(outputPath);
      fs.writeFileSync(outputPath, 'unverified replacement B, not codec-owned');
      return verified;
    };
    const started = await owner.start();
    await waitForPreparationIdle(stateDir);
    const job = jobs()[started.data.job.id];
    assert.equal(job.status, 'failed');
    assert.equal(job.output, null);
    assert.equal(fs.readFileSync(output(job.id), 'utf8'), 'unverified replacement B, not codec-owned');
    assert.equal((await owner.file(job.id)).status, 404);
    assert.deepEqual(reservations(), {});
  });

  it('preserves an unknown partial on codec failure and never labels it ready', async () => {
    const owner = client();
    options.runCodec = async ({ outputPath }) => {
      fs.writeFileSync(outputPath, 'unknown existing bytes');
      throw Object.assign(new Error('Output existed before codec creation'), { code: 'output_exists' });
    };
    const started = await owner.start();
    await waitForPreparationIdle(stateDir);
    const job = jobs()[started.data.job.id];
    assert.equal(job.status, 'failed');
    assert.equal(job.output, null);
    assert.equal(fs.readFileSync(output(job.id), 'utf8'), 'unknown existing bytes');
    assert.equal(fs.readFileSync(sourceFile, 'utf8'), 'irreplaceable isolated original bytes');
    assert.deepEqual(reservations(), {});
  });

  it('rechecks authorization after probe and rejects source changes during codec work', async () => {
    const owner = client();
    options.probe = async () => { revokeAuthorizedDevice(owner.device.id, stateDir); return metadata; };
    assert.equal((await owner.start()).status, 401);
    assert.deepEqual(reservations(), {});
    assert.equal(fs.existsSync(path.join(stateDir, 'preparation-jobs.json')), false);
    const nextOwner = client();
    options.probe = async () => metadata;
    options.runCodec = async (args) => {
      const result = await goodCodec(args);
      fs.appendFileSync(sourceFile, ' owner changed original');
      return result;
    };
    const started = await nextOwner.start();
    await waitForPreparationIdle(stateDir);
    assert.equal(jobs()[started.data.job.id].status, 'failed');
    assert.equal(jobs()[started.data.job.id].output, null);
    assert.match(fs.readFileSync(sourceFile, 'utf8'), /owner changed original$/);
  });

  it('never acknowledges failed job persistence and preserves existing originals', async (t) => {
    const owner = client();
    const rename = fs.renameSync;
    t.mock.method(fs, 'renameSync', (from, to) => {
      if (to === path.join(stateDir, 'preparation-jobs.json')) throw Object.assign(new Error('fixture storage full'), { code: 'ENOSPC' });
      return rename(from, to);
    });
    const result = await owner.start();
    assert.equal(result.status, 507);
    assert.notEqual(result.data.persisted, true);
    assert.deepEqual(reservations(), {});
    assert.equal(fs.existsSync(path.join(stateDir, 'preparation-worker.lock')), false);
    assert.equal(fs.readFileSync(sourceFile, 'utf8'), 'irreplaceable isolated original bytes');
  });

  it('does not claim persisted cancellation when the terminal ledger update fails after the worker settles', async (t) => {
    const owner = client(), entered = deferred();
    let workerSettled = false;
    options.runCodec = async ({ signal }) => {
      try { await holdUntilAbort(signal, entered); }
      finally { workerSettled = true; }
    };
    const started = await owner.start();
    assert.equal(started.status, 202);
    await entered.promise;
    const before = fs.readFileSync(sourceFile);
    const rename = fs.renameSync;
    t.mock.method(fs, 'renameSync', (from, to) => {
      if (to === path.join(stateDir, 'preparation-jobs.json')) throw Object.assign(new Error('fixture terminal write failure'), { code: 'ENOSPC' });
      return rename(from, to);
    });
    const cancelled = await owner.cancel(started.data.job.id);
    assert.equal(workerSettled, true);
    assert.equal(cancelled.status, 507);
    assert.equal(cancelled.data.code, 'cancellation_not_saved');
    assert.notEqual(cancelled.data.persisted, true);
    assert.notEqual(cancelled.data.job?.status, 'cancelled');
    assert.notEqual(jobs()[started.data.job.id].status, 'cancelled');
    assert.deepEqual(fs.readFileSync(sourceFile), before);
    assert.deepEqual(reservations(), {});
    assert.equal(fs.existsSync(path.join(stateDir, 'preparation-worker.lock')), false);
  });

  it('fails closed on corrupt job history without overwriting history or touching originals', async () => {
    const owner = client();
    const file = path.join(stateDir, 'preparation-jobs.json');
    const original = fs.readFileSync(sourceFile);
    let codecs = 0;
    options.runCodec = async (args) => { codecs++; return goodCodec(args); };
    for (const invalid of ['{broken', JSON.stringify({ schemaVersion: 2, jobs: {} }), JSON.stringify({ schemaVersion: 1, jobs: { [randomUUID()]: null } })]) {
      fs.writeFileSync(file, invalid);
      const listed = await owner.list(), started = await owner.start();
      assert.equal(listed.status, 503);
      assert.equal(listed.data.code, 'preparation_state_invalid');
      assert.equal(started.status, 503);
      assert.notEqual(started.data.persisted, true);
      assert.equal(fs.readFileSync(file, 'utf8'), invalid);
      assert.equal(fs.existsSync(path.join(stateDir, 'preparation-worker.lock')), false);
      assert.deepEqual(reservations(), {});
    }
    assert.equal(codecs, 0);
    assert.deepEqual(fs.readFileSync(sourceFile), original);
  });

  it('refuses corrupt reservation state without launching a codec or replacing the damaged ledger', async () => {
    const owner = client();
    const file = path.join(stateDir, 'preparation-reservations.json');
    let codecs = 0;
    options.runCodec = async (args) => { codecs++; return goodCodec(args); };
    for (const invalid of ['{broken', JSON.stringify({ schemaVersion: 2, reservations: {} }),
      JSON.stringify({ schemaVersion: 1, reservations: { [randomUUID()]: { maxBytes: -1, createdAt: 1 } } })]) {
      fs.writeFileSync(file, invalid);
      const started = await owner.start();
      assert.equal(started.status, 409);
      assert.equal(started.data.code, 'budget_state_invalid');
      assert.notEqual(started.data.persisted, true);
      assert.equal(fs.readFileSync(file, 'utf8'), invalid);
      assert.equal(fs.existsSync(path.join(stateDir, 'preparation-jobs.json')), false);
      assert.equal(fs.existsSync(path.join(stateDir, 'preparation-worker.lock')), false);
    }
    assert.equal(codecs, 0);
    assert.equal(fs.readFileSync(sourceFile, 'utf8'), 'irreplaceable isolated original bytes');
  });

  it('never reclaims an existing old or unknown worker lock and never starts a concurrent codec', async () => {
    const owner = client();
    const lock = path.join(stateDir, 'preparation-worker.lock');
    let codecs = 0;
    options.runCodec = async (args) => { codecs++; return goodCodec(args); };
    const lockBytes = 'unknown worker ownership requiring recovery';
    fs.writeFileSync(lock, lockBytes);
    fs.utimesSync(lock, new Date(0), new Date(0));
    const denied = await owner.start();
    assert.equal(denied.status, 409);
    assert.equal(denied.data.code, 'preparation_worker_busy');
    assert.equal(fs.readFileSync(lock, 'utf8'), lockBytes);
    assert.equal(codecs, 0);
    assert.deepEqual(reservations(), {});
    fs.unlinkSync(lock); // Remove only the exact disposable lock this test wrote.
    const entered = deferred();
    options.runCodec = ({ signal }) => { codecs++; return holdUntilAbort(signal, entered); };
    const first = await owner.start();
    await entered.promise;
    const activeLock = fs.readFileSync(lock);
    try {
      const competing = await owner.start({ recipe: 'portable720' });
      assert.equal(competing.status, 409);
      assert.equal(competing.data.code, 'preparation_worker_busy');
      assert.equal(codecs, 1);
      assert.deepEqual(fs.readFileSync(lock), activeLock);
      assert.equal(Object.keys(reservations()).length, 1);
    } finally { await owner.cancel(first.data.job.id); }
    assert.equal(fs.existsSync(lock), false);
  });

  it('does not relabel another live worker as interrupted or reclaim its state', async () => {
    const owner = client();
    const prepared = await owner.start();
    await waitForPreparationIdle(stateDir);
    const id = prepared.data.job.id;
    const data = { schemaVersion: 1, jobs: jobs() };
    data.jobs[id] = { ...data.jobs[id], status: 'preparing', progress: 0.3, output: null, message: 'Worker preparing fixture.' };
    const ledger = path.join(stateDir, 'preparation-jobs.json');
    const lock = path.join(stateDir, 'preparation-worker.lock');
    fs.writeFileSync(ledger, JSON.stringify(data));
    // The local runner map is empty; a valid live PID lock represents another
    // server's worker without launching a second process or touching real work.
    const lockBytes = JSON.stringify({ processId: process.pid, startedAt: Date.now() });
    fs.writeFileSync(lock, lockBytes);
    const before = fs.readFileSync(ledger);
    const listed = (await owner.list()).data.jobs[0];
    assert.equal(listed.status, 'preparing');
    assert.equal(listed.progress, 0.3);
    assert.equal(listed.canRetry, false);
    assert.equal((await owner.start()).data.code, 'preparation_worker_busy');
    assert.equal((await owner.retry(id)).status, 409);
    assert.equal((await owner.cancel(id)).status, 409);
    assert.deepEqual(fs.readFileSync(ledger), before);
    assert.equal(fs.readFileSync(lock, 'utf8'), lockBytes);
    assert.equal(fs.existsSync(output(id)), true);
  });

  it('refuses ready byte access after same-byte output identity replacement and preserves both files', async () => {
    const owner = client();
    const prepared = await owner.start();
    await waitForPreparationIdle(stateDir);
    const id = prepared.data.job.id, file = output(id), previous = file + '.verified-original-fixture';
    const bytes = fs.readFileSync(file), stat = fs.statSync(file);
    fs.renameSync(file, previous);
    fs.writeFileSync(file, bytes);
    fs.utimesSync(file, stat.atime, stat.mtime);
    assert.notDeepEqual(fingerprint(file), jobs()[id].output.fingerprint);
    const listed = (await owner.list()).data.jobs[0];
    assert.equal(listed.status, 'failed');
    for (const method of ['GET', 'HEAD']) {
      const denied = await owner.file(id, method);
      assert.equal(denied.status, 409);
      assert.equal(denied.data.code, 'prepared_file_changed');
      assert.equal(denied.res.getHeader('content-range'), undefined);
    }
    assert.deepEqual(fs.readFileSync(file), bytes);
    assert.deepEqual(fs.readFileSync(previous), bytes);
    assert.equal(fs.readFileSync(sourceFile, 'utf8'), 'irreplaceable isolated original bytes');
  });

  it('verified viewing leases block preparation between byte requests and keep overlapping viewers independent', async () => {
    const owner = client();
    const prepared = await owner.start();
    await waitForPreparationIdle(stateDir);
    const id = prepared.data.job.id, first = randomUUID(), second = randomUUID();
    options.workloadReason = undefined; // Exercise real activity arbitration, not the fixture workload override.
    try {
      const startedAt = Date.now();
      const started = await owner.viewing(id, first, 'start');
      assert.equal(started.status, 200);
      assert.deepEqual(Object.keys(started.data).sort(), ['action', 'expiresAt', 'jobId', 'ok', 'profileId', 'sessionId'].sort());
      assert.equal(started.data.profileId, 'owner');
      assert.equal(started.data.jobId, id);
      assert.equal(started.data.sessionId, first);
      assert.equal(started.data.action, 'start');
      assert.ok(started.data.expiresAt >= startedAt + 60000 && started.data.expiresAt <= Date.now() + 60000);
      assert.equal(hasPreparationBlockingPlayback(), true);
      const deferred = await owner.start({ recipe: 'portable720' });
      assert.equal(deferred.status, 202);
      assert.equal(deferred.data.job.status, 'deferred');
      assert.equal(deferred.data.job.canRetry, true);
      assert.equal((await owner.viewing(id, second, 'start')).status, 200);
      const heartbeat = await owner.viewing(id, first, 'heartbeat');
      assert.equal(heartbeat.status, 200);
      assert.equal(heartbeat.data.action, 'heartbeat');
      const stopped = await owner.viewing(id, first, 'stop');
      assert.equal(stopped.status, 200);
      assert.equal(stopped.data.expiresAt, null);
      assert.equal(hasPreparationBlockingPlayback(), true, 'second buffered viewer still owns priority');
      assert.equal((await owner.viewing(id, first, 'heartbeat')).status, 409);
      assert.equal((await owner.viewing(id, second, 'stop')).status, 200);
      assert.equal(hasPreparationBlockingPlayback(), false);
      assert.equal((await owner.start()).status, 202);
    } finally {
      await owner.viewing(id, first, 'stop');
      await owner.viewing(id, second, 'stop');
    }
  });

  it('viewing sessions bind device/profile/job, strictly validate input, and allow owned stop after file loss', async () => {
    const owner = client();
    const prepared = await owner.start();
    await waitForPreparationIdle(stateDir);
    const id = prepared.data.job.id, session = randomUUID();
    assert.equal((await owner.viewing(id, session, 'start', { path: sourceFile })).status, 400);
    assert.equal((await owner.viewing(id, 'not-a-uuid', 'start')).status, 400);
    assert.equal((await owner.viewing(id, session, 'pause')).status, 400);
    assert.equal((await owner.viewing(id, session, 'heartbeat')).status, 409);
    try {
      assert.equal((await owner.viewing(id, session, 'start')).status, 200);
      const sameProfileOtherDevice = client();
      assert.equal((await sameProfileOtherDevice.viewing(id, session, 'heartbeat')).status, 403);
      assert.equal((await sameProfileOtherDevice.viewing(id, session, 'stop')).status, 403);
      assert.equal((await client('other-owner').viewing(id, session, 'start')).status, 403);
      assert.equal((await owner.viewing(randomUUID(), session, 'heartbeat')).status, 403);
      fs.unlinkSync(output(id)); // Only this disposable generated fixture.
      assert.notEqual((await owner.viewing(id, session, 'heartbeat')).status, 200);
      assert.notEqual((await owner.viewing(id, randomUUID(), 'start')).status, 200);
      assert.equal((await owner.viewing(id, session, 'stop')).status, 200);
      assert.equal(hasPreparationBlockingPlayback(), false);
    } finally { await owner.viewing(id, session, 'stop'); }
  });

  it('viewing heartbeat rechecks original identity and expired leases cannot be revived', async (t) => {
    const owner = client();
    const prepared = await owner.start();
    await waitForPreparationIdle(stateDir);
    const id = prepared.data.job.id, session = randomUUID();
    let now = Date.now();
    t.mock.method(Date, 'now', () => now);
    try {
      assert.equal((await owner.viewing(id, session, 'start')).status, 200);
      now += 60001;
      assert.equal(hasPreparationBlockingPlayback(), false);
      assert.equal((await owner.viewing(id, session, 'heartbeat')).status, 409);
      assert.equal(hasPreparationBlockingPlayback(), false);
      assert.equal((await owner.viewing(id, session, 'start')).status, 200);
      fs.appendFileSync(sourceFile, ' replaced source identity');
      assert.equal((await owner.viewing(id, session, 'heartbeat')).status, 409);
      assert.equal((await owner.viewing(id, session, 'stop')).status, 200);
      assert.equal(hasPreparationBlockingPlayback(), false);
    } finally { await owner.viewing(id, session, 'stop'); }
  });

  it('prepares a real local audiovisual fixture and serves its verified bytes through the guarded route', async () => {
    fs.unlinkSync(sourceFile); // Disposable fixture only, never user media.
    const generated = spawnSync(process.env.REELOS_FFMPEG || 'ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-n', '-threads', '1', '-filter_threads', '1',
      '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=24:duration=1',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-map', '0:v', '-map', '1:a',
      '-c:v', 'libx264', '-threads:v', '1', '-pix_fmt', 'yuv420p', '-c:a', 'aac', sourceFile,
    ], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
    assert.equal(generated.status, 0, generated.error?.message || generated.stderr);
    const before = fs.readFileSync(sourceFile);
    options.probe = probePreparationSource;
    options.runCodec = runPreparationCodec;
    const owner = client();
    const started = await owner.start();
    assert.equal(started.status, 202, JSON.stringify(started.data));
    await waitForPreparationIdle(stateDir);
    const listed = (await owner.list()).data.jobs[0];
    assert.equal(listed.status, 'ready', listed.message);
    assert.equal(jobs()[listed.id].output.media.operation, 'remux');
    const bytes = await owner.file(listed.id);
    assert.equal(bytes.status, 206);
    assert.deepEqual(bytes.raw, fs.readFileSync(output(listed.id)).subarray(0, 8));
    assert.deepEqual(fs.readFileSync(sourceFile), before);
    assert.deepEqual(reservations(), {});
  });
});
