import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { createPlaybackFixture } from './test-harness/playback-fixtures.mjs';
import { createMockRequest, createMockResponse } from './test-harness/harness-utils.mjs';

test('preparation is routed through bounded, private, source-resolved authority and the actual isolated library', async (t) => {
  const home = createPlaybackFixture({ profile: { id: 'adult', name: 'Adult', role: 'owner' } });
  const previous = { state: process.env.REELOS_STATE, profiles: process.env.REELOS_PROFILES_DIR };
  process.env.REELOS_STATE = home.stateDir;
  process.env.REELOS_PROFILES_DIR = home.profilesDir;
  try {
    // Cache paths and plugin memory are initialized at import time. Seed this
    // home before the first import, so another home's/default cache cannot make
    // this wiring regression pass accidentally.
    const original = path.join(home.stateDir, 'private-original.mp4');
    fs.writeFileSync(original, 'isolated original bytes');
    const title = { id: 'isolated-original', title: 'Current isolated home original', type: 'movie',
      sourceKind: 'personal_import', path: original, Path: original, OfficialRating: 'G' };
    const ordinary = { id: 'ordinary-catalog-entry', title: 'Unverified catalog fixture', type: 'movie',
      sourceKind: 'personal_import', sourceVerified: true };
    const cacheFile = path.join(home.stateDir, 'library-shelf.json');
    fs.writeFileSync(cacheFile, JSON.stringify({ at: Date.now(), complete: true, titles: [title, ordinary], continueWatching: [] }));
    const { LIBRARY_CACHE_FILE } = await import('./reelos-library.mjs');
    assert.equal(LIBRARY_CACHE_FILE, cacheFile);
    // Seed optional decoration facts through its test seam; no Jellyfin,
    // provider or other local service is required or contacted by this test.
    const { loadPresenceFacts, resetPresenceFactsCache } = await import('./reelos-request-status.mjs');
    resetPresenceFactsCache();
    await loadPresenceFacts({ libraryFile: cacheFile, fetchArr: async () => [] });
    let networkAttempts = 0;
    t.mock.method(globalThis, 'fetch', async () => { networkAttempts++; throw new Error('Network is forbidden in isolated library routing tests'); });
    const { dispatchReelOsApi } = await import('./reelos-lookup-plugin.mjs');
    const request = async (url, { method = 'GET', body, cookie = home.cookie, origin } = {}) => {
      const req = createMockRequest({ url, method, body, headers: { host: '127.0.0.1', ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}) } });
      const res = createMockResponse();
      assert.equal(await dispatchReelOsApi(req, res), true);
      await res.waitForEnd();
      return res;
    };
    const route = '/api/preparation?expectedProfileId=adult';
    const library = await request('/api/library');
    assert.equal(library.statusCode, 200);
    const available = library.json.titles.find((row) => row.id === title.id);
    assert.ok(available, 'The actual API must read the fresh seeded current-home library');
    assert.equal(available.title, title.title);
    assert.equal(available.sourceKind, 'personal_import');
    assert.equal(available.sourceVerified, true);
    assert.equal(Object.hasOwn(available, 'path'), false);
    assert.equal(Object.hasOwn(available, 'Path'), false);
    assert.equal(JSON.stringify(library.json).includes(original), false);
    const unverified = library.json.titles.find((row) => row.id === ordinary.id);
    assert.ok(unverified);
    assert.equal(Object.hasOwn(unverified, 'sourceKind'), false);
    assert.equal(Object.hasOwn(unverified, 'sourceVerified'), false, 'Cached claims cannot make ordinary catalog entries preparable');
    const anonymousLibrary = await request('/api/library', { cookie: '' });
    assert.equal(anonymousLibrary.statusCode, 401);
    assert.equal(Object.hasOwn(anonymousLibrary.json, 'titles'), false);
    assert.equal(JSON.stringify(anonymousLibrary.json).includes(original), false);
    assert.equal((await request(route, { cookie: '' })).statusCode, 401);
    const loaded = await request(route);
    assert.equal(loaded.statusCode, 200);
    assert.equal(loaded.json.profileId, 'adult');
    assert.equal(loaded.json.canManage, true);
    assert.deepEqual(loaded.json.jobs, []);
    assert.deepEqual(loaded.json.recipes.map(({ id }) => id), ['compatible', 'portable720', 'living1080']);
    assert.equal(loaded.getHeader('cache-control'), 'private, no-store');
    assert.equal((await request('/api/preparation?expectedProfileId=other')).statusCode, 403);
    const body = { expectedProfileId: 'adult', titleId: 'unknown-original', recipe: 'compatible' };
    assert.equal((await request('/api/preparation', { method: 'POST', body, origin: 'https://foreign.invalid' })).statusCode, 403);
    assert.equal((await request('/api/preparation', { method: 'POST', body: { ...body, path: 'injected.mp4' } })).statusCode, 400);
    assert.equal((await request('/api/preparation', { method: 'POST', body: 'x'.repeat(65537) })).statusCode, 413);
    const unavailable = await request('/api/preparation', { method: 'POST', body });
    assert.notEqual(unavailable.statusCode, 202);
    assert.equal(unavailable.json.ok, false);
    assert.equal((await request('/api/preparation', { method: 'DELETE' })).statusCode, 405);
    assert.equal((await request(route)).json.jobs.length, 0);
    assert.equal(networkAttempts, 0);
    assert.equal(fs.readFileSync(original, 'utf8'), 'isolated original bytes');
  } finally {
    if (previous.state === undefined) delete process.env.REELOS_STATE; else process.env.REELOS_STATE = previous.state;
    if (previous.profiles === undefined) delete process.env.REELOS_PROFILES_DIR; else process.env.REELOS_PROFILES_DIR = previous.profiles;
  }
});

test('a freshly imported library cache path follows the explicit home through the central state resolver', async () => {
  const first = createPlaybackFixture(), second = createPlaybackFixture();
  const previous = process.env.REELOS_STATE;
  try {
    process.env.REELOS_STATE = first.stateDir;
    const firstModule = await import(`./reelos-library.mjs?cache-path=${encodeURIComponent(first.stateDir)}`);
    process.env.REELOS_STATE = second.stateDir;
    const secondModule = await import(`./reelos-library.mjs?cache-path=${encodeURIComponent(second.stateDir)}`);
    assert.equal(firstModule.LIBRARY_CACHE_FILE, path.join(first.stateDir, 'library-shelf.json'));
    assert.equal(secondModule.LIBRARY_CACHE_FILE, path.join(second.stateDir, 'library-shelf.json'));
    assert.notEqual(firstModule.LIBRARY_CACHE_FILE, secondModule.LIBRARY_CACHE_FILE);
  } finally {
    if (previous === undefined) delete process.env.REELOS_STATE; else process.env.REELOS_STATE = previous;
  }
});
