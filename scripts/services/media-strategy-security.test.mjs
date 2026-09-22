import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { createPlaybackFixture } from '../test-harness/playback-fixtures.mjs';
import { createMockRequest, createMockResponse } from '../test-harness/harness-utils.mjs';
import { getMediaStrategy, saveMediaStrategy, inspectStorageSpace, handleMediaStrategyRoute } from './media-strategy-service.mjs';
import { reservePreparationBytes } from './preparation-budget-service.mjs';
import { revokeAuthorizedDevice } from './reelos-gate-service.mjs';
const GiB = 1024 ** 3;

function fixture(t, profile = { id: 'owner', name: 'Owner', role: 'owner' }) {
  t.mock.method(fs, 'statfsSync', () => ({ bsize: GiB, blocks: 100, bavail: 80, bfree: 90 }));
  const home = createPlaybackFixture({ profile });
  const req = { headers: { host: '127.0.0.1', cookie: home.cookie }, socket: { remoteAddress: '127.0.0.1' } };
  const call = async (method = 'GET', body, options = {}) => {
    const response = createMockResponse();
    const request = { ...req, method, ...options.request };
    await handleMediaStrategyRoute(request, response, new URL('http://127.0.0.1/api/strategy'), options.readBody || (async () => body), home.stateDir);
    return { status: response.statusCode, data: response.json, headers: response.headers };
  };
  return { ...home, req, call };
}

test('storage preferences need an authorized adult and only the owner may save', async (t) => {
  const home = fixture(t);
  assert.equal((await home.call('GET', null, { request: { headers: {} } })).status, 401);
  const current = await home.call();
  assert.equal(current.status, 200);
  assert.equal(current.data.canEdit, true);
  assert.equal(current.data.profileId, 'owner');
  assert.equal(current.data.storage.freeBytes, 80 * GiB);
  assert.equal(current.data.budget.limitBytes, 14 * GiB);
  assert.equal(current.data.preparation.available, false);
  assert.equal('dedicatedUsbMount' in current.data.strategy, false);
  const body = { expectedProfileId: 'owner', expectedRevision: current.data.revision, storageAllocation: 'fixed', allocatedGb: 1 };
  const saved = await home.call('POST', body);
  assert.equal(saved.status, 200);
  assert.equal(saved.data.persisted, true);
  assert.equal(saved.data.budget.limitBytes, GiB);
  assert.equal((await home.call('POST', body)).status, 409, 'A stale screen cannot overwrite current settings');
  assert.equal((await home.call('POST', { ...body, expectedProfileId: 'someone' })).status, 403);
  assert.equal((await home.call('POST', body, { request: { headers: { ...home.req.headers, origin: 'https://foreign.invalid' } } })).status, 403);
  const member = fixture(t, { id: 'member', name: 'Member' });
  const read = await member.call();
  assert.equal(read.data.canEdit, false);
  assert.equal((await member.call('POST', { ...body, expectedProfileId: 'member', expectedRevision: read.data.revision })).status, 403);
  const child = fixture(t, { id: 'child', name: 'Child', isKids: true, pin: '2468' });
  assert.equal((await child.call()).status, 403);
});

test('owner authority is checked again after body reads and inside the storage lock', async (t) => {
  for (const phase of ['body', 'lock']) {
    const home = fixture(t);
    const current = (await home.call()).data;
    const body = { expectedProfileId: 'owner', expectedRevision: current.revision, allocatedGb: 1, storageAllocation: 'fixed' };
    const originalOpen = fs.openSync;
    const intercept = phase === 'lock' ? t.mock.method(fs, 'openSync', (file, ...args) => {
      const fd = originalOpen(file, ...args);
      if (String(file).endsWith('preparation-reservations.json.lock')) revokeAuthorizedDevice(home.device.id, home.stateDir);
      return fd;
    }) : null;
    const result = await home.call('POST', body, { readBody: async () => {
      if (phase === 'body') revokeAuthorizedDevice(home.device.id, home.stateDir);
      return body;
    } });
    intercept?.mock.restore();
    assert.equal(result.status, 401, phase);
    assert.equal(fs.existsSync(path.join(home.stateDir, 'media-strategy.json')), false);
  }
});

test('common persistence rejects unsafe patches, corrupt state, storage failure and overcommitted budgets', async (t) => {
  const home = fixture(t);
  for (const patch of [{ allocatedGb: -1 }, { allocatedGb: '10' }, { allocatedGb: Infinity }, { path: 'C:\\' }, { dedicatedUsbMount: 'C:\\' }, { mode: 'invented' }, { autoDownloadFavorites: 'true' }, { allocatedGb: 91, storageAllocation: 'fixed' }]) {
    assert.equal(saveMediaStrategy(patch, home.stateDir).ok, false, JSON.stringify(patch));
  }
  const reserved = reservePreparationBytes(2 * GiB, home.stateDir);
  assert.equal(reserved.ok, true);
  const denied = saveMediaStrategy({ allocatedGb: 1, storageAllocation: 'fixed' }, home.stateDir);
  assert.equal(denied.code, 'budget_in_use');
  assert.equal(saveMediaStrategy({ mode: 'cloud_stream' }, home.stateDir).code, 'budget_in_use');
  assert.equal(fs.existsSync(path.join(home.stateDir, 'media-strategy.json')), false);
  const lock = path.join(home.stateDir, 'preparation-reservations.json.lock');
  fs.writeFileSync(lock, 'live or unknown owner');
  assert.equal(saveMediaStrategy({ allocatedGb: 5, storageAllocation: 'fixed' }, home.stateDir).code, 'budget_busy');
  assert.equal(fs.readFileSync(lock, 'utf8'), 'live or unknown owner');
  fs.unlinkSync(lock);
  const file = path.join(home.stateDir, 'media-strategy.json');
  fs.writeFileSync(file, '{broken');
  assert.throws(() => getMediaStrategy(home.stateDir), /could not be read/);
  assert.equal(saveMediaStrategy({ mode: 'cloud_stream' }, home.stateDir).ok, false);
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
  fs.unlinkSync(file);
  const unavailable = t.mock.method(fs, 'statfsSync', () => { throw new Error('No volume'); });
  assert.equal(inspectStorageSpace(home.stateDir).available, false);
  assert.equal(saveMediaStrategy({ mode: 'cloud_stream' }, home.stateDir).ok, false);
  unavailable.mock.restore();
});

test('strategy dispatch uses live isolated state, bounded bodies, and atomic failure receipts', async (t) => {
  const home = fixture(t);
  const oldState = process.env.REELOS_STATE;
  process.env.REELOS_STATE = home.stateDir;
  try {
    const { dispatchReelOsApi } = await import('../reelos-lookup-plugin.mjs');
    const request = async (method = 'GET', body) => {
      const req = createMockRequest({ url: '/api/strategy', method, body, headers: home.req.headers });
      const res = createMockResponse();
      assert.equal(await dispatchReelOsApi(req, res), true);
      await res.waitForEnd();
      return res;
    };
    const current = await request();
    assert.equal(current.json.profileId, 'owner');
    assert.equal(current.getHeader('cache-control'), 'private, no-store');
    const body = { expectedProfileId: 'owner', expectedRevision: current.json.revision, storageAllocation: 'fixed', allocatedGb: 1 };
    assert.equal((await request('POST', { ...body, arbitraryPath: '/tmp' })).statusCode, 400);
    assert.equal((await request('POST', 'x'.repeat(65537))).statusCode, 413);
    const brokenWrite = t.mock.method(fs, 'renameSync', () => { throw Object.assign(new Error('No space'), { code: 'ENOSPC' }); });
    const failed = await request('POST', body);
    assert.notEqual(failed.statusCode, 200);
    assert.notEqual(failed.json.persisted, true);
    assert.equal(fs.existsSync(path.join(home.stateDir, 'media-strategy.json')), false);
    brokenWrite.mock.restore();
    const saved = await request('POST', body);
    assert.equal(saved.statusCode, 200);
    assert.equal(saved.json.persisted, true);
    assert.equal(getMediaStrategy(home.stateDir).allocatedGb, 1);
  } finally {
    if (oldState === undefined) delete process.env.REELOS_STATE; else process.env.REELOS_STATE = oldState;
  }
});
