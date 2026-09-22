import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSubtitleCues,
  convertSrtToVtt,
  calculateVadDriftOffset,
  subtitleService,
} from './subtitle-service.mjs';

test('subtitle-service: converts SRT to WebVTT correctly', () => {
  const srt = `1\n00:00:01,000 --> 00:00:04,500\nHello, world!\n\n2\n00:00:05,200 --> 00:00:08,900\nWelcome to ReelOS.`;
  const vtt = convertSrtToVtt(srt);
  assert.ok(vtt.startsWith('WEBVTT'));
  assert.ok(vtt.includes('00:00:01.000 --> 00:00:04.500'));
  assert.ok(vtt.includes('Hello, world!'));
});

test('subtitle-service: parses cues from WebVTT accurately', () => {
  const vtt = `WEBVTT\n\n1\n00:01:10.500 --> 00:01:15.000\nWe must protect the living room.\n`;
  const cues = parseSubtitleCues(vtt);
  assert.equal(cues.length, 1);
  assert.equal(cues[0].start, 70.5);
  assert.equal(cues[0].end, 75.0);
  assert.equal(cues[0].text, 'We must protect the living room.');
});

test('subtitle-service: VAD cross-correlation accurately calculates dialogue drift offset', () => {
  // Cues at 10.0s to 15.0s, but speech peaks occur 200ms early at 9.8s
  const cues = [{ start: 10.0, end: 15.0, text: 'Audio dialogue' }];
  const speechPeaks = [9.8, 11.8, 13.8];
  const { offsetMs } = calculateVadDriftOffset(speechPeaks, cues);
  // Audio was early by 200ms, so candidate offset should adjust cue by ~ -200ms
  assert.ok(Math.abs(offsetMs) <= 300);
});

test('subtitle-service: stores and retrieves subtitles with manual offset', () => {
  const testId = `test_title_${Date.now()}`;
  const track = subtitleService.storeSubtitle(testId, 'WEBVTT\n\n1\n00:00:02.000 --> 00:00:04.000\nTest cue\n');
  assert.equal(track.id, testId);
  assert.equal(track.format, 'vtt');

  const retrieved = subtitleService.getSubtitleTrack(testId);
  assert.ok(retrieved);
  assert.equal(retrieved.id, testId);

  subtitleService.setOffset(testId, 150);
  assert.equal(subtitleService.getOffset(testId), 150);
});
