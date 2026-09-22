import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  standbyService,
  handleStandbyRoute,
  CURATED_GALLERY_ARTWORKS,
} from './standby-service.mjs';

test('standby service: switches modes between campfire, gallery, and photowall', () => {
  assert.equal(standbyService.setMode('campfire'), true);
  assert.equal(standbyService.getMode(), 'campfire');

  assert.equal(standbyService.setMode('gallery'), true);
  assert.equal(standbyService.getMode(), 'gallery');

  assert.equal(standbyService.setMode('photowall'), true);
  assert.equal(standbyService.getMode(), 'photowall');

  assert.equal(standbyService.setMode('invalid_mode'), false);
  assert.equal(standbyService.getMode(), 'photowall');
});

test('standby service: stores and lists family photo wall uploads locally', () => {
  // 1x1 transparent PNG base64
  const testBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const saved = standbyService.savePhotoBase64('family_vacation.png', testBase64, 'Austin');
  assert.ok(saved.filename);
  assert.ok(saved.url.includes(saved.filename));

  const photos = standbyService.listPhotos();
  assert.ok(photos.some((p) => p.filename === saved.filename));

  // Clean up
  standbyService.deletePhoto(saved.filename);
});

test('standby service: handleStandbyRoute handles /api/standby/status', async () => {
  let responseData = '';
  const req = { url: '/api/standby/status' };
  const res = {
    setHeader: () => {},
    end: (str) => { responseData = str; },
  };

  await handleStandbyRoute(req, res);
  const parsed = JSON.parse(responseData);
  assert.equal(parsed.ok, true);
  assert.ok(['campfire', 'gallery', 'photowall'].includes(parsed.activeMode));
  assert.ok(Array.isArray(parsed.curatedArtworks));
  assert.equal(parsed.curatedArtworks.length, CURATED_GALLERY_ARTWORKS.length);
});
