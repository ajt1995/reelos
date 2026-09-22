import assert from 'node:assert/strict';

export async function verifyStorageSettings(page, base, ownerId) {
  const read = () => page.request.get(`${base}/api/strategy`).then((response) => response.json());
  const open = async () => {
    await page.getByRole('button', { name: 'Change profile', exact: true }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const libraryStorage = page.getByRole('button', { name: /Library & storage/ });
    await libraryStorage.waitFor();
    if ((await libraryStorage.getAttribute('aria-expanded')) !== 'true') await libraryStorage.click();
    await page.locator('[aria-label="Storage settings"]').waitFor();
  };
  const storage = page.locator('[aria-label="Storage settings"]');
  try {
    const baseline = await read();
    assert.equal(baseline.profileId, ownerId);
    assert.equal(baseline.storage.available, true, 'Real storage measurement is required');
    await page.route('**/api/strategy', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"error":"Test storage temporarily unavailable"}' }));
    await open();
    await storage.getByRole('button', { name: 'Retry storage settings', exact: true }).waitFor();
    assert.equal(await storage.getByRole('button', { name: 'Save storage settings', exact: true }).count(), 0, 'No editable invented capacity on failed GET');
    await page.unroute('**/api/strategy');
    await page.route('**/api/strategy', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...baseline,
      budget: { available: false, limitBytes: 0, protectedFreeBytes: 0, usedBytes: 0, reservedBytes: 0, remainingBytes: 0, reason: 'Test reservations unavailable' },
    }) }));
    await storage.getByRole('button', { name: 'Retry storage settings', exact: true }).click();
    await storage.getByText('Automatic allocation currently allows Unavailable.', { exact: false }).waitFor();
    assert.equal(await storage.getByRole('button', { name: 'Save storage settings', exact: true }).isDisabled(), true);
    await page.unroute('**/api/strategy');
    await storage.getByRole('button', { name: 'Retry storage settings', exact: true }).click();
    await storage.getByRole('button', { name: 'Fixed limit', exact: true }).click();
    const slider = storage.getByRole('slider', { name: 'Storage budget in GiB', exact: true });
    await slider.focus();
    await slider.press('Home');
    await slider.press('ArrowRight');
    assert.equal(await slider.inputValue(), '1');
    const save = storage.getByRole('button', { name: 'Save storage settings', exact: true });
    await page.route('**/api/strategy', async (route) => {
      if (route.request().method() === 'POST') await route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"error":"Test storage save failed"}' });
      else await route.continue();
    });
    await save.click();
    await storage.getByRole('alert').waitFor();
    assert.equal(await storage.getByText('Storage settings saved', { exact: true }).count(), 0);
    assert.equal((await read()).revision, baseline.revision);
    await page.unroute('**/api/strategy');
    await save.click();
    await storage.getByText('Storage settings saved', { exact: true }).waitFor();
    const saved = await read();
    assert.equal(saved.strategy.storageAllocation, 'fixed');
    assert.equal(saved.strategy.allocatedGb, 1);
    assert.equal(saved.budget.limitBytes, 1024 ** 3);
    assert.equal(saved.preparation.available, false, 'Preferences do not fabricate a preparation worker');
    await storage.getByRole('button', { name: 'Increase storage budget', exact: true }).click();
    await page.route('**/api/strategy', async (route) => {
      if (route.request().method() === 'POST') await route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"code":"storage_unavailable","error":"Test disk measurement failed"}' });
      else await route.continue();
    });
    await save.click();
    await storage.getByRole('alert').waitFor();
    assert.equal(await storage.getByRole('slider').count(), 0, 'Measurement failure invalidates previously editable capacity');
    await page.unroute('**/api/strategy');
    await storage.getByRole('button', { name: 'Retry storage settings', exact: true }).click();
    await storage.getByRole('slider').waitFor();
    assert.equal(await storage.getByRole('slider').inputValue(), '1');
    await page.reload();
    const libraryStorage = page.getByRole('button', { name: /Library & storage/ });
    await libraryStorage.waitFor();
    if ((await libraryStorage.getAttribute('aria-expanded')) !== 'true') await libraryStorage.click();
    await storage.waitFor();
    await storage.getByRole('slider').waitFor();
    assert.equal(await storage.getByRole('slider').inputValue(), '1');
    for (const [name, width, height] of [['phone', 390, 844], ['desktop', 1280, 900], ['tv', 1920, 1080]]) {
      await page.setViewportSize({ width, height });
      await storage.scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      const increase = storage.getByRole('button', { name: 'Increase storage budget', exact: true });
      const box = await increase.boundingBox();
      assert(box && box.width >= 48 && box.height >= 48, 'Touch and remote adjustment target');
      await increase.focus();
      assert.equal(await increase.evaluate((button) => button === document.activeElement), true);
      await page.screenshot({ path: `.reelos-audit/setup/${name}-storage.png` });
    }
  } catch (error) {
    await page.screenshot({ path: '.reelos-audit/setup/storage-failure.png' }).catch(() => {});
    error.message += `\nStorage screen: ${(await page.locator('body').innerText()).slice(0, 1800)}`;
    throw error;
  } finally {
    await page.unroute('**/api/strategy');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('button', { name: 'Home', exact: true }).first().click();
  }
}
