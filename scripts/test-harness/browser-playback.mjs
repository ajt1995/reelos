import assert from 'node:assert/strict';

export async function verifyPersonalPlayback(page, base, ownerId) {
  const titleId = 'personal-playback-test';
  const source = await page.request.get(`${base}/api/media/${titleId}/sources`);
  assert.equal(source.status(), 200);
  const details = await source.json();
  assert.equal(details.activeProfileId, ownerId);
  assert.equal(details.progressTitleId, titleId);
  const localSession = page.waitForResponse((response) => response.url().endsWith('/api/playback/start') && response.ok(), { timeout: 60000 });
  // Attach rejection handling immediately; the assertion below still fails it.
  void localSession.catch(() => {});
  const metadataPattern = `**/api/media/${titleId}/sources`;
  await page.route(metadataPattern, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false}' }));
  await page.goto(`${base}/play/${titleId}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('alert').filter({ hasText: 'could not verify your source' }).waitFor();
  assert.equal(await page.locator('video').count(), 0, 'No unverified metadata playback or silent loss of resume');
  await page.unroute(metadataPattern);
  await page.getByRole('button', { name: 'Retry source', exact: true }).click();
  await page.locator('video').waitFor({ timeout: 30000 });
  await page.getByRole('heading', { name: 'Personal playback test', exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 1);
  // Native controls may require a user gesture for audible autoplay.
  await page.locator('video').focus();
  if (await page.locator('video').evaluate((video) => video.paused)) await page.keyboard.press('Space');
  await page.waitForFunction(() => {
    const video = document.querySelector('video');
    return video && !video.paused && video.currentTime >= 1 && video.getVideoPlaybackQuality().totalVideoFrames > 0;
  });
  assert.equal((await (await localSession).json()).engine, 'local-file', 'A real local session must be acknowledged without Jellyfin');
  await page.locator('video').evaluate((video) => {
    window.__reelosTestPlaybackEvents = [];
    for (const name of ['seeking', 'seeked', 'loadedmetadata', 'emptied', 'pause', 'play', 'timeupdate']) video.addEventListener(name, () => {
      window.__reelosTestPlaybackEvents.push({ name, time: video.currentTime, paused: video.paused });
      window.__reelosTestPlaybackEvents = window.__reelosTestPlaybackEvents.slice(-20);
    });
  });
  // Exercise ReelOS shortcuts, not Chromium's platform-specific fast-seek control.
  await page.getByRole('main', { name: 'Playback' }).focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => {
    const video = document.querySelector('video');
    return video && !video.seeking && video.currentTime >= 9;
  });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelector('video')?.paused);
  await page.waitForFunction(async ({ base, ownerId, titleId }) => {
    const roster = await fetch(`${base}/api/profiles`).then((response) => response.json());
    return roster.profiles.find((profile) => profile.id === ownerId)?.progress?.[titleId] > 0.2;
  }, { base, ownerId, titleId });
  const pausedPosition = await page.locator('video').evaluate((video) => video.currentTime);
  assert(pausedPosition >= 9, `Keyboard seek must leave a meaningful resume position, got ${pausedPosition}: ${JSON.stringify(await page.evaluate(() => window.__reelosTestPlaybackEvents))}`);
  await page.waitForFunction(async ({ ownerId, titleId, position }) => {
    const roster = await fetch('/api/profiles').then((response) => response.json());
    const progress = roster.profiles.find((profile) => profile.id === ownerId)?.progress?.[titleId];
    const duration = document.querySelector('video')?.duration;
    return typeof progress === 'number' && Math.abs(progress * duration - position) < 0.5;
  }, { ownerId, titleId, position: pausedPosition });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction((position) => {
    const video = document.querySelector('video');
    return video?.readyState >= 1 && !video.seeking && video.currentTime >= position - 0.5 && video.currentTime < position + 4;
  }, pausedPosition);
  await page.evaluate(() => {
    const NativeAudioContext = window.AudioContext;
    window.__reelosTestAudioContexts = [];
    window.AudioContext = new Proxy(NativeAudioContext, {
      construct(target, args) {
        const context = new target(...args);
        window.__reelosTestAudioContexts.push(context);
        return context;
      },
    });
  });
  await page.mouse.move(100, 30);
  await page.getByRole('button', { name: 'Sound', exact: true }).click();
  const sound = page.getByRole('region', { name: 'Sound settings' });
  assert.equal(await page.getByRole('button', { name: 'Dub', exact: true }).count(), 0);
  await sound.getByText('This source uses its original audio.', { exact: false }).waitFor();
  const night = sound.getByRole('button', { name: 'Night listening', exact: true });
  await night.click();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((button) => button.textContent === 'Night listening' && button.getAttribute('aria-pressed') === 'true'));
  assert.equal(await page.evaluate(() => window.__reelosTestAudioContexts.length), 1);
  await page.evaluate(() => window.__reelosTestAudioContexts[0].suspend());
  await page.getByRole('alert').filter({ hasText: 'Audio processing is paused' }).waitFor();
  await night.click();
  await page.waitForFunction(() => window.__reelosTestAudioContexts[0].state === 'running');
  await sound.getByRole('button', { name: 'Original', exact: true }).click();
  assert.equal(await sound.getByRole('button', { name: 'Original', exact: true }).getAttribute('aria-pressed'), 'true');
  await sound.getByRole('button', { name: 'Close sound settings' }).click();
  await page.getByRole('button', { name: 'Rate this title' }).click();
  await page.route('**/api/profiles/reaction', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false}' }));
  await page.getByRole('button', { name: 'Love', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'reaction was not saved' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Love', exact: true }).getAttribute('aria-pressed'), 'false');
  await page.unroute('**/api/profiles/reaction');
  await page.getByRole('button', { name: 'Love', exact: true }).click();
  await page.waitForFunction(async ({ titleId, ownerId }) => {
    const roster = await fetch('/api/profiles').then((response) => response.json());
    return roster.profiles.find((profile) => profile.id === ownerId)?.reactions?.[titleId] === 'love';
  }, { titleId, ownerId });
  await page.getByRole('button', { name: 'Clear reaction', exact: true }).click();
  await page.waitForFunction(async ({ titleId, ownerId }) => {
    const roster = await fetch('/api/profiles').then((response) => response.json());
    return !roster.profiles.find((profile) => profile.id === ownerId)?.reactions?.[titleId];
  }, { titleId, ownerId });
  await page.getByRole('button', { name: 'Love', exact: true }).click();
  await page.waitForFunction(async ({ titleId }) => (await fetch(`/api/media/${titleId}/sources`).then((response) => response.json())).reaction === 'love', { titleId });
  await page.getByRole('button', { name: 'Close taste controls' }).click();
  await page.getByRole('button', { name: 'Library keeping', exact: true }).click();
  const keeping = page.getByRole('region', { name: 'Library keeping', exact: true });
  const keep = keeping.getByRole('button', { name: 'Keep in your library', exact: true });
  await keep.waitFor();
  await page.route('**/api/library/keep', async (route) => {
    if (route.request().method() === 'POST') await route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"error":"Test retention save failed"}' });
    else await route.continue();
  });
  await keep.click();
  await keeping.getByRole('alert').waitFor();
  assert.equal(await keeping.getByText('Kept in your library', { exact: true }).count(), 0, 'Failed save is not a kept acknowledgement');
  const retentionUrl = `${base}/api/library/keep?id=${encodeURIComponent(titleId)}&expectedProfileId=${encodeURIComponent(ownerId)}`;
  assert.equal((await page.request.get(retentionUrl).then((response) => response.json())).kept, false);
  await page.unroute('**/api/library/keep');
  await keep.click();
  await keeping.getByText('Kept in your library', { exact: true }).waitFor();
  assert.equal((await page.request.get(retentionUrl).then((response) => response.json())).kept, true);
  await keeping.getByRole('button', { name: 'Close library keeping', exact: true }).click();
  const afterControlsPosition = await page.locator('video').evaluate((video) => video.currentTime);
  assert(afterControlsPosition >= pausedPosition - 0.5, `Audio and taste controls must not reset playback (${pausedPosition} -> ${afterControlsPosition})`);
  await page.screenshot({ path: '.reelos-audit/setup/personal-playback.png' });
  await page.getByRole('link', { name: 'Details', exact: true }).click();
  await page.waitForFunction(() => window.__reelosTestAudioContexts.every((context) => context.state === 'closed'));
  // A new player instance must restore the actual retained state, not a painted
  // flag left in the previous component. Removing a pin never removes bytes.
  await page.goto(`${base}/play/${titleId}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Library keeping', exact: true }).click();
  const reloadedKeeping = page.getByRole('region', { name: 'Library keeping', exact: true });
  await reloadedKeeping.getByText('Kept in your library', { exact: true }).waitFor();
  // A server identity denial invalidates the old verified badge. This injected
  // failure exercises the UI; real file replacement is covered by service tests.
  await page.route('**/api/library/keep', async (route) => {
    if (route.request().method() === 'POST') await route.fulfill({ status: 409, contentType: 'application/json', body: '{"ok":false,"code":"retention_identity_changed","error":"File changed"}' });
    else await route.continue();
  });
  await reloadedKeeping.getByRole('button', { name: 'Stop keeping in your library', exact: true }).click();
  await reloadedKeeping.getByRole('alert').waitFor();
  assert.equal(await reloadedKeeping.getByText('Kept in your library', { exact: true }).count(), 0, 'Identity denial clears stale kept status');
  await page.unroute('**/api/library/keep');
  await reloadedKeeping.getByRole('button', { name: 'Retry library status', exact: true }).click();
  await reloadedKeeping.getByText('Kept in your library', { exact: true }).waitFor();
  await reloadedKeeping.getByRole('button', { name: 'Stop keeping in your library', exact: true }).click();
  await reloadedKeeping.getByRole('button', { name: 'Keep in your library', exact: true }).waitFor();
  assert.equal((await page.request.get(retentionUrl).then((response) => response.json())).kept, false);
  const stillPlayable = await page.request.get(`${base}/api/stream/item/${titleId}`, { headers: { Range: 'bytes=0-31' } });
  assert.equal(stillPlayable.status(), 206);
  assert.equal((await stillPlayable.body()).length, 32);
  await reloadedKeeping.getByRole('button', { name: 'Keep in your library', exact: true }).click();
  await reloadedKeeping.getByText('Kept in your library', { exact: true }).waitFor();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  return { titleId, fixture: 'local repository teaser, not commercial media', resumePositionSeconds: pausedPosition, afterControlsPositionSeconds: afterControlsPosition, checks: ['authorized local-file bytes', 'source metadata failure and real retry', 'decoded advancing playback', 'local session acknowledged', 'keyboard seek', 'profile-private progress', 'resume after reload', 'real night audio and interruption recovery', 'audio context released on exit', 'private reaction failure/retry/persistence/reset', 'local retention failure/retry/persistence', 'retention restored in a new player', 'identity denial clears kept badge and explicit retry restores verified state', 'unkeep preserves playable original bytes'] };
}

// Opt-in live public-domain check. No mocked media, player events, credentials,
// provider calls or pre-written progress. Run only against isolated local state.
export async function verifyBrowserPlayback(page, base, ownerId) {
  const titleId = 'night-of-the-living-dead-1968';
  const titleName = 'Night of the Living Dead';
  const bytePath = `/api/stream/public/${titleId}`;
  const replies = [];
  page.on('response', (response) => {
    if (new URL(response.url()).pathname === bytePath) replies.push({ status: response.status(), type: response.headers()['content-type'] });
  });
  const openTitle = async () => {
    await page.getByRole('button', { name: 'Find anything', exact: true }).click();
    await page.getByPlaceholder('A title, person, feeling, exclusion, or half-remembered scene').fill(titleName);
    await page.getByRole('button', { name: `Open ${titleName}`, exact: true }).last().click();
    return page.getByRole('dialog', { name: titleName, exact: true });
  };
  let detail = await openTitle();
  await detail.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForFunction(() => {
    const video = document.querySelector('video');
    if (video?.error) throw Error(`Actual media failed: ${video.error.code} ${video.error.message}`);
    return video?.readyState >= 1 && video.duration > 3600;
  }, null, { timeout: 90000 });
  const source = await page.locator('video').evaluate((video) => ({ source: new URL(video.currentSrc).pathname, duration: video.duration }));
  assert.equal(source.source, bytePath);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForFunction(() => {
    const video = document.querySelector('video');
    return video && !video.paused && video.currentTime >= 2 && video.getVideoPlaybackQuality().totalVideoFrames > 0;
  }, null, { timeout: 60000 });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const seek = page.getByRole('slider', { name: 'Seek playback' });
  await seek.fill('120');
  await page.waitForFunction(() => {
    const video = document.querySelector('video');
    return video && !video.seeking && Math.abs(video.currentTime - 120) < 1;
  }, null, { timeout: 60000 });
  await seek.focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('video')?.currentTime >= 121);
  // Verify server-side progress, not merely a painted browser progress bar.
  await page.waitForFunction(async ({ base, ownerId, titleId }) => {
    const roster = await fetch(`${base}/api/profiles`).then((response) => response.json());
    return (roster.profiles.find((profile) => profile.id === ownerId)?.progress?.[titleId] ?? 0) > 0.02;
  }, { base, ownerId, titleId });
  assert.equal(new URL(page.url()).searchParams.get('watch'), titleId);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const video = document.querySelector('video');
    return video?.readyState >= 1 && !video.seeking && video.currentTime >= 120 && video.currentTime < 125;
  }, null, { timeout: 90000 });
  await page.getByRole('button', { name: 'Back to browsing' }).click();
  detail = await openTitle();
  await detail.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.waitForFunction(() => {
    const video = document.querySelector('video');
    return video?.readyState >= 1 && !video.seeking && video.currentTime >= 120 && video.currentTime < 125;
  }, null, { timeout: 90000 });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForFunction(() => {
    const video = document.querySelector('video');
    return video && !video.paused && video.currentTime >= 123 && video.getVideoPlaybackQuality().totalVideoFrames > 0;
  }, null, { timeout: 60000 });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const rangedVideoReplies = replies.filter((reply) => reply.status === 206 && reply.type?.includes('video/'));
  assert(rangedVideoReplies.length > 0, 'Real ranged video response required');
  await page.screenshot({ path: '.reelos-audit/setup/public-playback.png' });
  await page.getByRole('button', { name: 'Back to browsing' }).click();
  // Inject failure only for the negative case; recovery must fetch real bytes.
  const routePattern = `**${bytePath}`;
  await page.route(routePattern, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Injected unavailable source"}' }));
  detail = await openTitle();
  await detail.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'could not be played' }).waitFor();
  assert.equal(await page.locator('video').evaluate((video) => video.paused), true);
  await page.unroute(routePattern);
  await page.getByRole('button', { name: 'Retry playback', exact: true }).click();
  await page.waitForFunction(() => {
    const video = document.querySelector('video');
    return video?.readyState >= 1 && !video.error && !video.seeking && video.currentTime >= 120;
  }, null, { timeout: 90000 });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForFunction(() => {
    const video = document.querySelector('video');
    return video && !video.paused && video.getVideoPlaybackQuality().totalVideoFrames > 0;
  }, null, { timeout: 60000 });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Back to browsing' }).click();
  detail = await openTitle();
  await detail.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 1, null, { timeout: 90000 });
  // Observe actual browser audio contexts; no audio API or success is mocked.
  await page.evaluate(() => {
    const NativeAudioContext = window.AudioContext;
    window.__reelosTestAudioContexts = [];
    window.AudioContext = new Proxy(NativeAudioContext, {
      construct(target, args) {
        const context = new target(...args);
        window.__reelosTestAudioContexts.push(context);
        return context;
      },
    });
  });
  await page.getByRole('button', { name: 'Sound & subtitles', exact: true }).click();
  const sound = page.getByRole('dialog', { name: 'Sound & subtitles' });
  await sound.getByRole('slider', { name: 'Volume' }).fill('0.35');
  assert.equal(await page.locator('video').evaluate((video) => video.volume), 0.35);
  await sound.getByRole('button', { name: 'Night listening', exact: true }).click();
  await page.getByRole('button', { name: 'Night listening on', exact: true }).waitFor();
  await page.evaluate(() => window.__reelosTestAudioContexts[0].suspend());
  await page.getByRole('alert').filter({ hasText: 'Audio processing is paused' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Night listening on', exact: true }).count(), 0);
  await sound.getByRole('button', { name: 'Night listening', exact: true }).click();
  await page.getByRole('button', { name: 'Night listening on', exact: true }).waitFor();
  await sound.getByRole('button', { name: 'Close Sound & subtitles' }).click();
  await page.getByRole('button', { name: 'Night listening on', exact: true }).click();
  await page.getByRole('button', { name: 'Night listening', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('video')?.paused);
  await page.clock.install();
  await page.getByRole('button', { name: 'Sleep · Off', exact: true }).click();
  await page.getByRole('button', { name: 'Sleep · 30 min', exact: true }).waitFor();
  await page.clock.fastForward(30 * 60 * 1000);
  assert.equal(await page.locator('video').evaluate((video) => video.paused), true, 'Sleep deadline pauses the actual media element');
  await page.getByRole('button', { name: 'Sleep · Off', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Back to browsing' }).click();
  await page.clock.runFor(100);
  await page.waitForFunction(() => window.__reelosTestAudioContexts.every((context) => context.state === 'closed'));
  return { titleId, duration: source.duration, actualRangeResponses: replies.filter((reply) => reply.status === 206 && reply.type?.includes('video/')).length, checks: ['real public source bytes', 'decoded advancing playback', 'slider seek', 'keyboard seek', 'server progress persisted', 'refresh inside player', 'resume after reload', 'injected source failure with real retry recovery', 'media volume', 'night audio activation and original bypass', 'audio suspension shown and retried', 'discarded player audio context closed', 'sleep pauses video with accelerated test clock'] };
}
