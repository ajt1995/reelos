import assert from 'node:assert/strict';

/** Real isolated-service preparation journey; only failure responses are injected. */
export async function verifyBrowserPreparation(page, base, ownerId) {
  const titleId = 'personal-playback-test';
  const pattern = '**/api/preparation?*';
  const panel = page.getByRole('region', { name: 'Prepared media', exact: true });
  const checks = [];
  const observedStates = new Set();
  const screenshots = [];
  const listUrl = `${base}/api/preparation?expectedProfileId=${encodeURIComponent(ownerId)}`;
  let jobId;
  const openLibrary = async () => {
    await page.getByRole('button', { name: 'Library', exact: true }).first().click();
    await panel.waitFor();
  };
  const read = async () => {
    const response = await page.request.get(listUrl);
    assert.equal(response.status(), 200, 'Preparation status comes from the authenticated service');
    const body = await response.json();
    assert.equal(body.profileId, ownerId);
    assert.equal(body.ok, true);
    return body;
  };
  const acceptDeferred = async (job) => {
    assert.equal(job.canRetry, true, 'A deferred preparation is explicitly retryable');
    assert.equal(job.progress, null);
    await panel.getByRole('button', { name: 'Retry preparation', exact: true }).waitFor({ timeout: 10_000 });
    assert.equal(await panel.getByRole('button', { name: 'Play prepared copy', exact: true }).count(), 0,
      'Resource pressure never fabricates a playable prepared copy');
    checks.push('resource-pressure-persisted-as-retryable-deferred', 'deferred-copy-never-presented-as-ready');
    return { checks, jobId, titleId, recipe: 'compatible', observedStates: [...observedStates], screenshots,
      deferred: true, limitations: ['This host deferred real conversion to preserve its measured resource floor; retry requires more free capacity.',
        'Prepared range playback, decoded frames, and reload survival remain unverified on this constrained run.'] };
  };
  const observe = async (response) => {
    if (new URL(response.url()).pathname !== '/api/preparation' || !response.ok()) return;
    const body = await response.json().catch(() => null);
    for (const job of body?.jobs || (body?.job ? [body.job] : [])) {
      if (job.titleId === titleId) observedStates.add(job.status);
    }
  };
  page.on('response', observe);
  try {
    await page.route(pattern, (route) => route.fulfill({ status: 503, contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: 'Test preparation status temporarily unavailable' }) }));
    await openLibrary();
    const retry = panel.getByRole('button', { name: 'Retry loading preparation', exact: true });
    await retry.waitFor();
    assert.equal(await panel.getByRole('button', { name: 'Prepare media', exact: true }).count(), 0);
    assert.equal(await panel.getByRole('button', { name: 'Play prepared copy', exact: true }).count(), 0);
    await page.unroute(pattern);
    await retry.click();
    await panel.getByLabel('Original title', { exact: true }).selectOption(titleId);
    await panel.getByLabel('Prepared copy', { exact: true }).selectOption('compatible');
    assert.equal(await panel.getByLabel('Original title', { exact: true }).inputValue(), titleId);
    assert.equal(await retry.count(), 0);
    checks.push('failed-status-retry-without-invented-readiness', 'real-local-original-selectable');

    const baseline = await read();
    assert.equal(baseline.canManage, true);
    const forged = await page.request.post(`${base}/api/preparation`, { data: {
      expectedProfileId: ownerId, titleId, recipe: 'compatible', inputPath: '/untrusted-client-path.mp4',
    } });
    assert.equal(forged.status(), 400, 'Client source paths cannot select preparation input');
    assert.equal((await read()).jobs.length, baseline.jobs.length, 'Rejected source metadata creates no job');
    const wrongProfile = `${ownerId}-not-current`;
    const forgedProfile = await page.request.post(`${base}/api/preparation`, { data: {
      expectedProfileId: wrongProfile, titleId, recipe: 'compatible',
    } });
    assert.equal(forgedProfile.status(), 403);
    checks.push('client-source-path-rejected', 'forged-profile-preparation-rejected');

    const acknowledgement = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/preparation'
      && response.request().method() === 'POST', { timeout: 60_000 });
    void acknowledgement.catch(() => {});
    await panel.getByRole('button', { name: 'Prepare media', exact: true }).click();
    const accepted = await acknowledgement;
    assert.equal(accepted.status(), 202, `Real preparation was not accepted: ${await accepted.text()}`);
    const saved = await accepted.json();
    assert.equal(saved.ok, true);
    assert.equal(saved.persisted, true);
    assert.equal(saved.profileId, ownerId);
    assert.equal(saved.job.titleId, titleId);
    assert.equal(saved.job.recipe, 'compatible');
    assert.match(saved.job.id, /^[0-9a-f-]{36}$/);
    jobId = saved.job.id;
    observedStates.add(saved.job.status);
    if (saved.job.status === 'deferred') return acceptDeferred(saved.job);
    const fileUrl = `${base}/api/preparation/${jobId}/file?expectedProfileId=${encodeURIComponent(ownerId)}`;
    await page.waitForFunction(async ({ url, id }) => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Preparation status failed: ${response.status}`);
      const job = (await response.json()).jobs.find((item) => item.id === id);
      if (['failed', 'cancelled', 'interrupted'].includes(job?.status)) throw new Error(`Preparation ${job.status}: ${job.message}`);
      return ['ready', 'deferred'].includes(job?.status);
    }, { url: listUrl, id: jobId }, { timeout: 60_000, polling: 500 });
    const ready = (await read()).jobs.find((job) => job.id === jobId);
    observedStates.add(ready.status);
    if (ready.status === 'deferred') return acceptDeferred(ready);
    assert.equal(ready.status, 'ready');
    assert.equal(ready.progress, 1);
    await panel.getByRole('button', { name: 'Play prepared copy', exact: true }).first().waitFor({ timeout: 10_000 });
    checks.push('real-codec-persisted-acknowledgement', 'verified-ready-status');

    const head = await page.request.head(fileUrl);
    assert.equal(head.status(), 200);
    assert.match(head.headers()['content-type'], /^video\/mp4/);
    const sizeBytes = Number(head.headers()['content-length']);
    assert(Number.isSafeInteger(sizeBytes) && sizeBytes > 1024);
    const range = await page.request.get(fileUrl, { headers: { Range: 'bytes=0-1023' } });
    assert.equal(range.status(), 206);
    assert.equal(range.headers()['content-range'], `bytes 0-1023/${sizeBytes}`);
    assert.equal((await range.body()).length, 1024);
    const denied = await page.request.get(fileUrl.replace(encodeURIComponent(ownerId), encodeURIComponent(wrongProfile)), { headers: { Range: 'bytes=0-1023' } });
    assert.equal(denied.status(), 403);
    const sourceAssertion = await page.request.get(`${fileUrl}&titleId=another-original`, { headers: { Range: 'bytes=0-1023' } });
    assert.equal(sourceAssertion.status(), 400, 'Prepared output cannot be redirected by a title assertion');
    const anonymous = await page.context().browser().newContext();
    try {
      assert.equal((await anonymous.request.get(fileUrl, { headers: { Range: 'bytes=0-1023' } })).status(), 401);
    } finally { await anonymous.close(); }
    checks.push('guarded-mp4-head-and-exact-range', 'prepared-file-profile-and-source-assertion-rejected', 'anonymous-prepared-file-rejected');

    const viewingPattern = '**/api/preparation/*/viewing';
    await page.route(viewingPattern, async (route) => {
      if (route.request().postDataJSON()?.action === 'start') await route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false}' });
      else await route.continue();
    });
    await panel.getByRole('button', { name: 'Play prepared copy', exact: true }).first().click();
    await panel.getByRole('alert').filter({ hasText: 'could not be opened safely' }).waitFor();
    assert.equal(await panel.locator('video').count(), 0, 'No video before viewing protection is acknowledged');
    await page.unroute(viewingPattern);
    checks.push('failed-viewing-protection-keeps-video-closed');

    const mediaResponse = page.waitForResponse((response) => new URL(response.url()).pathname === `/api/preparation/${jobId}/file`
      && response.request().method() === 'GET', { timeout: 30_000 });
    void mediaResponse.catch(() => {});
    await panel.getByRole('button', { name: 'Play prepared copy', exact: true }).first().click();
    const video = panel.locator('video');
    await video.waitFor();
    assert.equal(await video.getAttribute('controls'), '');
    await video.evaluate(async (element) => { element.muted = true; await element.play(); });
    await page.waitForFunction(() => {
      const video = document.querySelector('[aria-label="Prepared media"] video');
      return video && !video.paused && video.currentTime >= 1 && video.getVideoPlaybackQuality().totalVideoFrames > 0;
    }, null, { timeout: 30_000 });
    const nativeResponse = await mediaResponse;
    assert([200, 206].includes(nativeResponse.status()), 'Native media consumes the guarded prepared endpoint');
    const playback = await video.evaluate((element) => ({ currentTime: element.currentTime, duration: element.duration,
      decodedFrames: element.getVideoPlaybackQuality().totalVideoFrames, width: element.videoWidth, height: element.videoHeight,
      source: element.currentSrc }));
    assert.equal(new URL(playback.source).pathname, `/api/preparation/${jobId}/file`);
    assert(playback.width > 0 && playback.height > 0 && Number.isFinite(playback.duration));
    await video.evaluate((element) => element.pause());
    checks.push('actual-native-prepared-video-decoded-frames');
    const blockedPreparation = await page.request.post(`${base}/api/preparation`, { data: { expectedProfileId: ownerId, titleId, recipe: 'portable720' } });
    assert.equal(blockedPreparation.status(), 202);
    const blockedJob = (await blockedPreparation.json()).job;
    assert.equal(blockedJob.status, 'deferred');
    assert.equal(blockedJob.canRetry, true);
    checks.push('paused-buffered-prepared-viewing-retains-playback-priority');

    for (const [name, width, height] of [['desktop', 1280, 900], ['phone', 390, 844], ['tv', 1920, 1080]]) {
      await page.setViewportSize({ width, height });
      await panel.scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${name} has no horizontal overflow`);
      for (const control of await panel.locator('button, select').all()) {
        const box = await control.boundingBox();
        assert(box && box.width >= 48 && box.height >= 48, `${name} preparation controls remain 48px targets`);
      }
      const refresh = panel.getByRole('button', { name: 'Refresh preparation', exact: true });
      await refresh.focus();
      assert.equal(await refresh.evaluate((element) => element === document.activeElement), true);
      const path = `.reelos-audit/setup/${name}-preparation.png`;
      await page.screenshot({ path });
      screenshots.push(path);
    }
    checks.push('desktop-phone-tv-no-overflow-48px-controls-and-keyboard-focus');
    const stoppedViewing = page.waitForResponse((response) => new URL(response.url()).pathname === `/api/preparation/${jobId}/viewing`
      && response.request().postDataJSON()?.action === 'stop');
    void stoppedViewing.catch(() => {});
    await panel.getByRole('button', { name: 'Close prepared playback', exact: true }).click();
    assert.equal((await stoppedViewing).status(), 200);
    await page.reload({ waitUntil: 'domcontentloaded' });
    if (!await panel.isVisible()) await openLibrary();
    await panel.getByRole('button', { name: 'Play prepared copy', exact: true }).first().waitFor();
    const reloaded = (await read()).jobs.find((job) => job.id === jobId);
    assert.equal(reloaded.status, 'ready');
    assert.equal(reloaded.progress, 1);
    assert.equal((await page.request.head(fileUrl)).status(), 200);
    checks.push('ready-copy-survives-browser-reload');
    return { checks, jobId, titleId, recipe: 'compatible', observedStates: [...observedStates], sizeBytes,
      playback: { ...playback, source: new URL(playback.source).pathname }, nativeFileStatus: nativeResponse.status(), rangeStatus: range.status(), screenshots,
      limitations: ['Original-file replacement is covered by service tests, not mutation of the shared browser fixture.',
        'This journey does not establish cross-process playback priority, worker restart recovery, or non-browser device compatibility.'] };
  } catch (error) {
    await page.screenshot({ path: '.reelos-audit/setup/preparation-failure.png' }).catch(() => {});
    error.message += `\nPreparation job: ${jobId || 'not acknowledged'}\n${(await page.locator('body').innerText()).slice(0, 2200)}`;
    throw error;
  } finally {
    page.off('response', observe);
    await page.unroute(pattern);
    await page.unroute('**/api/preparation/*/viewing');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('button', { name: 'Home', exact: true }).first().click();
  }
}
