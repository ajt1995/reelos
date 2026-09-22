import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { createPlaybackFixture } from './test-harness/playback-fixtures.mjs';
import { createMockRequest, createMockResponse } from './test-harness/harness-utils.mjs';

test('retention routes acknowledge only durable private pins on verified local originals', async () => {
  const home = createPlaybackFixture();
  const file = path.join(home.stateDir, 'personal-original.mp4');
  const original = Buffer.from('isolated retention fixture, not playback evidence');
  fs.writeFileSync(file, original);
  home.writeLibrary([{ id: 'personal-original', title: 'Personal original', sourceKind: 'personal_import', path: file, kind: 'movie' }]);
  const previous = { state: process.env.REELOS_STATE, profiles: process.env.REELOS_PROFILES_DIR };
  process.env.REELOS_STATE = home.stateDir;
  process.env.REELOS_PROFILES_DIR = home.profilesDir;
  try {
    const { dispatchReelOsApi } = await import('./reelos-lookup-plugin.mjs');
    const request = async (url, { method = 'GET', body, cookie = home.cookie, origin } = {}) => {
      const req = createMockRequest({ url, method, body, headers: { host: '127.0.0.1', ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}) } });
      const res = createMockResponse();
      assert.equal(await dispatchReelOsApi(req, res), true);
      await res.waitForEnd();
      return res;
    };
    const read = '/api/library/keep?id=personal-original&expectedProfileId=adult';
    assert.equal((await request(read, { cookie: '' })).statusCode, 401);
    const checked = (await request(read)).json;
    assert.equal(checked.kept, false);
    assert.match(checked.fileVersion, /^[a-f0-9]{64}$/);
    const body = { id: 'personal-original', expectedProfileId: 'adult', expectedFileVersion: checked.fileVersion, keep: true };
    assert.equal((await request('/api/library/keep', { method: 'POST', body: { ...body, expectedProfileId: 'other' } })).statusCode, 403);
    assert.equal((await request('/api/library/keep', { method: 'POST', body, origin: 'https://foreign.invalid' })).statusCode, 403);
    assert.equal((await request('/api/library/keep', { method: 'POST', body: { ...body, path: file } })).statusCode, 400);
    const kept = await request('/api/library/keep', { method: 'POST', body });
    assert.equal(kept.statusCode, 200);
    assert.equal(kept.json.persisted, true);
    assert.equal(kept.json.kept, true);
    assert.equal(kept.json.profileId, 'adult');
    assert.equal(kept.json.storage, 'local-original');
    assert.equal(kept.json.fileVersion, checked.fileVersion);
    assert.equal(kept.getHeader('cache-control'), 'no-store');
    assert.equal(kept.body.toString().includes(home.stateDir), false);
    assert.equal(fs.existsSync(path.join(home.stateDir, 'media-retention.json')), true);
    assert.equal((await request(read)).json.kept, true);
    const unkept = await request('/api/library/keep', { method: 'POST', body: { ...body, keep: false } });
    assert.equal(unkept.json.persisted, true);
    assert.equal(unkept.json.kept, false);
    assert.deepEqual(fs.readFileSync(file), original);
    assert.equal((await request('/api/library/keep', { method: 'POST', body: { ...body, expectedFileVersion: '0'.repeat(64) } })).statusCode, 409);
    assert.equal((await request('/api/library/keep', { method: 'POST', body: 'x'.repeat(65537) })).statusCode, 413);
    assert.equal((await request('/api/library/keep', { method: 'DELETE' })).statusCode, 405);
  } finally {
    if (previous.state === undefined) delete process.env.REELOS_STATE; else process.env.REELOS_STATE = previous.state;
    if (previous.profiles === undefined) delete process.env.REELOS_PROFILES_DIR; else process.env.REELOS_PROFILES_DIR = previous.profiles;
  }
});
