import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import {
  getCompanionDossier,
  getActivePlaybackSession,
  handleCompanionRoute,
  recordActiveSession,
  clearActiveSession,
  generateStorySoFar,
  atomicWriteJsonWithBackup,
  safeReadJsonWithBackup,
  queueRemoteCommand,
  popRemoteCommands,
} from './companion-service.mjs';

test('companion service: does not invent a dossier or spoiler guarantee for an unknown title', async () => {
  const dossier = await getCompanionDossier('Definitely Missing Companion Title', { season: 1, episode: 3, minute: 25 });
  assert.equal(dossier.ok, true);
  assert.equal(dossier.title, 'Definitely Missing Companion Title');
  assert.equal(dossier.available, false);
  assert.deepEqual(dossier.storySoFar, []);
  assert.deepEqual(dossier.whoIsWho, []);
  assert.equal(dossier.season, 1);
  assert.equal(dossier.episode, 3);
  assert.equal(dossier.currentMinute, 25);
  assert.equal(dossier.spoilerShield.active, false);
  assert.equal(dossier.spoilerShield.safeThroughSeason, 1);
  assert.equal(dossier.spoilerShield.safeThroughEpisode, 3);
  assert.equal(dossier.spoilerShield.futureLoreBlocked, false);
});

test('companion service: only returns a verified Story So Far recap', () => {
  const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
  const recap = generateStorySoFar('Severance', {
    season: 2,
    episode: 4,
    lastWatchedTimestamp: fifteenDaysAgo,
    verifiedRecap: ['Verified first beat.', 'Verified second beat.'],
  });
  assert.equal(recap.isHiatus, true);
  assert.equal(recap.available, true);
  assert.deepEqual(recap.storySoFar, ['Verified first beat.', 'Verified second beat.']);
});

test('companion service: active session tracking without port 8096 probes', async () => {
  recordActiveSession({
    sessionId: 'living-room-test',
    client: 'ExoPlayer',
    device: 'Sony Bravia 4K',
    titleId: 'dune-2',
    titleName: 'Dune: Part Two',
    seasonNumber: 1,
    episodeNumber: 1,
    positionTicks: 600000000,
  });

  const session = await getActivePlaybackSession();
  assert.equal(session.ok, true);
  assert.equal(session.active, true);
  assert.equal(session.titleName, 'Dune: Part Two');

  clearActiveSession('living-room-test');
});

test('companion service: atomic write and safe .bak recovery', () => {
  const tmpFile = path.join(process.cwd(), '.reelos-state', `test_${Date.now()}.json`);
  const initialData = { healthy: true, counter: 42 };

  // Write with backup
  atomicWriteJsonWithBackup(tmpFile, initialData);
  assert.ok(fs.existsSync(tmpFile));

  // Modify file to be corrupt JSON
  fs.writeFileSync(tmpFile, 'CORRUPTED JSON {{{', 'utf8');

  // Safe read should recover from .bak
  const recovered = safeReadJsonWithBackup(tmpFile, { fallback: true });
  assert.equal(recovered.healthy, true);
  assert.equal(recovered.counter, 42);

  // Clean up
  try { fs.unlinkSync(tmpFile); } catch {}
  try { fs.unlinkSync(`${tmpFile}.bak`); } catch {}
});

test('companion service: queues and pops remote commands for TV player', () => {
  const cmd = queueRemoteCommand({ sessionId: 'tv-one', action: 'play', payload: { rate: 1.0 } });
  assert.equal(cmd.action, 'play');

  queueRemoteCommand({ sessionId: 'tv-two', action: 'pause' });
  const popped = popRemoteCommands('tv-one');
  assert.equal(popped.length, 1);
  assert.equal(popped[0].action, 'play');

  assert.equal(popRemoteCommands('tv-one').length, 0);
  assert.equal(popRemoteCommands('tv-two').length, 1);
  assert.equal(queueRemoteCommand({ action: 'invent_story' }), null);
  assert.equal(queueRemoteCommand({ sessionId: 'tv-one', action: 'seek', payload: {} }), null);
});

test('companion service: handleCompanionRoute handles /api/companion/active and /api/companion/handoff', async () => {
  recordActiveSession({
    sessionId: 'session-tv-1',
    titleName: 'Interstellar',
    positionTicks: 1200000000,
  });

  let responseData = '';
  const reqActive = { url: '/api/companion/active' };
  const resActive = {
    setHeader: () => {},
    end: (str) => { responseData = str; },
  };
  await handleCompanionRoute(reqActive, resActive, { authorize: () => ({ authenticated: true }) });
  const parsedActive = JSON.parse(responseData);
  assert.equal(parsedActive.ok, true);
  assert.equal(parsedActive.active, true);
  assert.ok(parsedActive.dossier);

  responseData = '';
  const reqHandoff = { url: '/api/companion/handoff?target=phone' };
  const resHandoff = {
    setHeader: () => {},
    end: (str) => { responseData = str; },
  };
  await handleCompanionRoute(reqHandoff, resHandoff, { authorize: () => ({ authenticated: true }) });
  const parsedHandoff = JSON.parse(responseData);
  assert.equal(parsedHandoff.ok, true);
  assert.equal(parsedHandoff.target, 'phone');
  assert.equal(parsedHandoff.handoffTimestamp, 1200000000);

  clearActiveSession('session-tv-1');
});

test('companion service: presence-filter is policy state, not a fabricated title dossier', async () => {
  let responseData = '';
  const post = Readable.from([
    JSON.stringify({
      sessionId: 'route-test-tv',
      kidsPresent: true,
      childProfileIds: ['kid-a'],
    }),
  ]);
  post.url = '/api/companion/presence-filter';
  post.method = 'POST';
  const response = {
    setHeader: () => {},
    end: (str) => { responseData = str; },
  };
  await handleCompanionRoute(post, response, { authorize: () => ({ authenticated: true }) });
  const saved = JSON.parse(responseData);
  assert.equal(saved.state.kidsPresent, true);
  assert.deepEqual(saved.state.childProfileIds, ['kid-a']);
  assert.equal('dossier' in saved, false);

  responseData = '';
  await handleCompanionRoute(
    { url: '/api/companion/presence-filter?sessionId=route-test-tv', method: 'GET' },
    response,
    { authorize: () => ({ authenticated: true }) },
  );
  const loaded = JSON.parse(responseData);
  assert.equal(loaded.state.kidsPresent, true);
  assert.equal('dossier' in loaded, false);
});

test('companion service: rejects unauthenticated reads and stale remote targets', async () => {
  let responseData = '';
  const response = {
    setHeader: () => {},
    end: (str) => { responseData = str; },
  };
  await handleCompanionRoute(
    { url: '/api/companion/active', method: 'GET' },
    response,
    { authorize: () => ({ authenticated: false }) },
  );
  assert.equal(response.statusCode, 401);
  assert.equal(JSON.parse(responseData).ok, false);

  recordActiveSession({ sessionId: 'current-tv', titleName: 'Current title' });
  responseData = '';
  const stale = Readable.from([JSON.stringify({ sessionId: 'old-tv', action: 'pause' })]);
  stale.url = '/api/companion/remote';
  stale.method = 'POST';
  stale.headers = {};
  await handleCompanionRoute(stale, response, { authorize: () => ({ authenticated: true }) });
  assert.equal(response.statusCode, 409);
  assert.equal(popRemoteCommands('old-tv').length, 0);

  responseData = '';
  const current = Readable.from([JSON.stringify({ sessionId: 'current-tv', action: 'seek', payload: { deltaTicks: -100000000 } })]);
  current.url = '/api/companion/remote';
  current.method = 'POST';
  current.headers = {};
  await handleCompanionRoute(current, response, { authorize: () => ({ authenticated: true }) });
  assert.equal(response.statusCode, 200);
  const queued = popRemoteCommands('current-tv');
  assert.equal(queued.length, 1);
  assert.equal(queued[0].sessionId, 'current-tv');
  assert.equal(queued[0].payload.deltaTicks, -100000000);
  clearActiveSession('current-tv');
});

test('companion service: registers verified web timing and scopes polling to that player', async () => {
  let responseData = '';
  const response = { setHeader: () => {}, end: (str) => { responseData = str; } };
  const call = async (url, method = 'GET', body = null) => {
    const req = body === null ? { url, method, headers: {} } : Readable.from([JSON.stringify(body)]);
    req.url = url; req.method = method; req.headers ||= {};
    responseData = ''; response.statusCode = 200;
    await handleCompanionRoute(req, response, { authorize: () => ({ authenticated: true }) });
    return { status: response.statusCode, body: JSON.parse(responseData) };
  };
  const session = { sessionId: 'web-player', titleId: 'film', titleName: 'Film', positionTicks: 10, durationTicks: 100, isPaused: false };
  assert.equal((await call('/api/companion/session', 'POST', session)).status, 200);
  assert.equal((await call('/api/companion/remote', 'POST', { sessionId: 'web-player', action: 'seek', payload: { deltaTicks: 10 } })).status, 200);
  assert.equal((await call('/api/companion/remote/poll?sessionId=other')).status, 409);
  const polled = await call('/api/companion/remote/poll?sessionId=web-player');
  assert.equal(polled.status, 200);
  assert.equal(polled.body.commands.length, 1);
  assert.equal((await call('/api/companion/remote/poll?sessionId=web-player')).body.commands.length, 0);
  assert.equal((await call('/api/companion/stop', 'POST', { sessionId: 'web-player' })).status, 200);
});
