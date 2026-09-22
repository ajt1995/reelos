import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { createPlaybackFixture } from './test-harness/playback-fixtures.mjs';
import { createMockRequest, createMockResponse } from './test-harness/harness-utils.mjs';
import { getProfile, saveProfile } from './services/profile-service.mjs';

test('legacy curator routes use private identity and never leak or change household-global taste', async () => {
  const home = createPlaybackFixture({ profile: { id: 'adult', name: 'Adult', reactions: { arrival: 'love' } } });
  saveProfile({ id: 'other', name: 'Private other', reactions: { alien: 'love' } }, home.profilesDir);
  const previous = { state: process.env.REELOS_STATE, profiles: process.env.REELOS_PROFILES_DIR };
  process.env.REELOS_STATE = home.stateDir;
  process.env.REELOS_PROFILES_DIR = home.profilesDir;
  const globalPath = path.join(home.stateDir, 'curator.json');
  const legacy = JSON.stringify({ liked: ['private-legacy-secret'], hidden: ['private-hidden-secret'] });
  fs.writeFileSync(globalPath, legacy);
  const mediaPath = path.join(home.stateDir, 'LOCAL_PRIVATE_FIXTURE.mp4');
  fs.writeFileSync(mediaPath, 'isolated catalog fixture bytes');
  home.writeLibrary([
    { id: 'private-film', title: 'Private local film', kind: 'movie', sourceKind: 'personal_import',
      year: 2020, rating: 8, genres: ['Drama'], overview: 'A personal movie.', path: mediaPath,
      Path: 'C:\\private\\WINDOWS_PRIVATE_FIXTURE.mp4', poster: mediaPath,
      backdrop: 'https://provider.invalid/art.jpg?api_key=ARTWORK_PRIVATE_SECRET',
      source: { token: 'NESTED_PRIVATE_SECRET', url: 'https://provider.invalid/PRIVATE_STREAM' },
      streamUrl: 'https://provider.invalid/PRIVATE_STREAM',
      collection: { id: 12, name: 'Personal collection', token: 'COLLECTION_PRIVATE_SECRET' } },
    { id: 'safe-art-film', title: 'Safe artwork film', kind: 'movie', sourceKind: 'personal_import', path: mediaPath,
      poster: '/api/jf/Items/safe-art-film/Images/Primary?maxWidth=240&quality=70',
      backdrop: 'https://image.tmdb.org/t/p/original/public_art.jpg', genres: ['Comedy'], rating: 7 },
    { id: 'disabled-provider', title: 'Disabled provider title', sourceKind: 'debrid',
      path: mediaPath, source: { provider: 'torbox', token: 'DISABLED_PROVIDER_SECRET' } },
  ]);
  const otherBefore = fs.readFileSync(path.join(home.profilesDir, 'other.json'), 'utf8');
  try {
    const { dispatchReelOsApi } = await import('./reelos-lookup-plugin.mjs');
    const request = async (url, { cookie = home.cookie, method = 'GET', body, origin } = {}) => {
      const req = createMockRequest({ url, method, body, headers: { host: '127.0.0.1', ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}) } });
      const res = createMockResponse();
      assert.equal(await dispatchReelOsApi(req, res), true);
      await res.waitForEnd();
      return res;
    };
    for (const route of ['/api/curator', '/api/curator/taste', '/api/curator/feed', '/api/curator/recommendations']) {
      assert.equal((await request(route, { cookie: '' })).statusCode, 401);
      assert.equal((await request(`${route}?profileId=other`)).statusCode, 403);
      const own = await request(route);
      assert.equal(own.statusCode, 200, route);
      assert.equal(own.json.profileId, 'adult');
      assert(!own.body.toString().includes('private-legacy-secret'));
      assert(!own.body.toString().includes('Private other'));
      assert.equal(own.getHeader('cache-control'), 'no-store');
    }
    for (const route of ['/api/curator/feed', '/api/curator/recommendations']) {
      const response = await request(route);
      assert.equal(response.statusCode, 200);
      const titles = response.json.feed.personalized;
      assert.equal(titles.length, 2, 'Authorized titles survive the public projection');
      const local = titles.find((item) => item.id === 'private-film');
      assert.equal(local.title, 'Private local film');
      assert.equal(local.year, 2020);
      assert.deepEqual(local.genres, ['Drama']);
      assert.equal(local.path, undefined);
      assert.equal(local.Path, undefined);
      assert.equal(local.source, undefined);
      assert.equal(local.poster, undefined);
      assert.equal(local.backdrop, undefined);
      assert.deepEqual(local.collection, { id: 12, name: 'Personal collection' });
      const safe = titles.find((item) => item.id === 'safe-art-film');
      assert.equal(safe.poster, '/api/jf/Items/safe-art-film/Images/Primary?maxWidth=240&quality=70');
      assert.equal(safe.backdrop, 'https://image.tmdb.org/t/p/original/public_art.jpg');
      assert.doesNotMatch(response.body.toString(), /PRIVATE_FIXTURE|PRIVATE_SECRET|PRIVATE_STREAM|PROVIDER_SECRET|provider\.invalid|"path"|"Path"|"source"|"streamUrl"/);
    }
    assert.deepEqual((await request('/api/curator')).json.liked, ['arrival']);
    const voted = await request('/api/curator', { method: 'POST', body: { id: 'moon', vote: 'comfort', expectedProfileId: 'adult' } });
    assert.equal(voted.statusCode, 200);
    assert.equal(voted.json.persisted, true);
    assert.equal(getProfile('adult', home.profilesDir).reactions.moon, 'cozy');
    assert.equal((await request('/api/curator/teach', { method: 'POST', body: { id: 'moon', rating: 'love', profileId: 'other' } })).statusCode, 403);
    assert.equal((await request('/api/curator/reset', { method: 'POST', body: {}, origin: 'https://foreign.invalid' })).statusCode, 403);
    assert.equal((await request('/api/curator/taste', { method: 'POST', body: { tasteVibe: 'comfort', isKids: false } })).statusCode, 400);
    assert.equal((await request('/api/curator/teach', { method: 'POST', body: { id: 'moon', action: 'dismiss' } })).statusCode, 200);
    assert.equal((await request('/api/curator')).json.hidden.includes('moon'), false, 'Neutral dismissal is not negative taste');
    assert.equal((await request('/api/curator/taste', { method: 'POST', body: 'x'.repeat(65537) })).statusCode, 413);
    assert.equal(fs.readFileSync(globalPath, 'utf8'), legacy);
    assert.equal(fs.readFileSync(path.join(home.profilesDir, 'other.json'), 'utf8'), otherBefore);
  } finally {
    if (previous.state === undefined) delete process.env.REELOS_STATE; else process.env.REELOS_STATE = previous.state;
    if (previous.profiles === undefined) delete process.env.REELOS_PROFILES_DIR; else process.env.REELOS_PROFILES_DIR = previous.profiles;
  }
});
