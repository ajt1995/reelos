import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clampSubtitleOffset,
  synchronizePlaybackSubtitles,
  type PlaybackSubtitleCue,
  type PlaybackSubtitleElement,
  type PlaybackSubtitleTrack,
  type PlaybackSubtitleVideo,
} from "./playback-subtitles.ts";

function fixture() {
  const first: PlaybackSubtitleTrack & { language: string; label: string } = {
    mode: "showing", language: "en", label: "English", cues: [{ startTime: 5, endTime: 7 }],
  };
  const second: PlaybackSubtitleTrack & { language: string; label: string } = {
    mode: "disabled", language: "en", label: "English", cues: [{ startTime: 10, endTime: 12 }],
  };
  const unlisted: PlaybackSubtitleTrack = { mode: "showing", cues: [{ startTime: 20, endTime: 22 }] };
  const elements: PlaybackSubtitleElement[] = [
    { track: first, getAttribute: (name: string) => name === "data-subtitle-index" ? "4" : null },
    { track: second, getAttribute: (name: string) => name === "data-subtitle-index" ? "9" : null },
  ];
  const video: PlaybackSubtitleVideo = {
    textTracks: [unlisted, second, first],
    querySelectorAll: () => elements,
  };
  return { video, first, second, unlisted, elements };
}

function cue(track: PlaybackSubtitleTrack): PlaybackSubtitleCue {
  return track.cues![0];
}

test("subtitles select exact metadata identity despite duplicate labels/languages and list order", () => {
  const f = fixture();
  const result = synchronizePlaybackSubtitles(f.video, 9, 500);
  assert.deepEqual(result, { available: true, appliedCueCount: 1, offsetMs: 500 });
  assert.equal(f.second.mode, "showing");
  assert.equal(f.first.mode, "disabled");
  assert.equal(f.unlisted.mode, "disabled");
  assert.deepEqual(cue(f.second), { startTime: 10.5, endTime: 12.5 });
  assert.deepEqual(cue(f.first), { startTime: 5, endTime: 7 });
});

test("repeated or changed offsets always use original cue times", () => {
  const f = fixture();
  synchronizePlaybackSubtitles(f.video, 9, 500);
  synchronizePlaybackSubtitles(f.video, 9, 500);
  assert.deepEqual(cue(f.second), { startTime: 10.5, endTime: 12.5 });
  synchronizePlaybackSubtitles(f.video, 9, -1_000);
  assert.deepEqual(cue(f.second), { startTime: 9, endTime: 11 });
  synchronizePlaybackSubtitles(f.video, 9, 0);
  assert.deepEqual(cue(f.second), { startTime: 10, endTime: 12 });
});

test("switching subtitles restores previous cues and applies current offset to chosen track", () => {
  const f = fixture();
  synchronizePlaybackSubtitles(f.video, 9, 500);
  synchronizePlaybackSubtitles(f.video, 4, -500);
  assert.deepEqual(cue(f.second), { startTime: 10, endTime: 12 });
  assert.deepEqual(cue(f.first), { startTime: 4.5, endTime: 6.5 });
  assert.equal(f.first.mode, "showing");
  assert.equal(f.second.mode, "disabled");
  synchronizePlaybackSubtitles(f.video, 9, 500);
  assert.deepEqual(cue(f.first), { startTime: 5, endTime: 7 });
  assert.deepEqual(cue(f.second), { startTime: 10.5, endTime: 12.5 });
});

test("a load refresh adjusts new cues without shifting previously adjusted cues again", () => {
  const f = fixture();
  const pending: PlaybackSubtitleCue[] = [];
  Object.defineProperty(f.second, "cues", { get: () => pending.length ? pending : null });
  assert.deepEqual(synchronizePlaybackSubtitles(f.video, 9, 750), {
    available: true, appliedCueCount: 0, offsetMs: 750,
  });
  pending.push({ startTime: 3, endTime: 4 });
  synchronizePlaybackSubtitles(f.video, 9, 750);
  pending.push({ startTime: 7, endTime: 8 });
  assert.equal(synchronizePlaybackSubtitles(f.video, 9, 750).appliedCueCount, 2);
  assert.deepEqual(pending, [{ startTime: 3.75, endTime: 4.75 }, { startTime: 7.75, endTime: 8.75 }]);
});

test("Off restores original timings and disables every track", () => {
  const f = fixture();
  synchronizePlaybackSubtitles(f.video, 4, 2_000);
  const result = synchronizePlaybackSubtitles(f.video, null, 2_000);
  assert.equal(result.available, false);
  assert.equal(result.appliedCueCount, 0);
  assert.deepEqual(cue(f.first), { startTime: 5, endTime: 7 });
  for (const track of Array.from(f.video.textTracks)) assert.equal(track.mode, "disabled");
});

test("invalid offsets reset to zero, finite values clamp, and cue bounds cannot become negative", () => {
  const f = fixture();
  for (const value of [NaN, Infinity, -Infinity]) assert.equal(clampSubtitleOffset(value), 0);
  assert.equal(clampSubtitleOffset(3_000), 2_000);
  assert.equal(clampSubtitleOffset(-3_000), -2_000);
  synchronizePlaybackSubtitles(f.video, 9, 3_000);
  assert.deepEqual(cue(f.second), { startTime: 12, endTime: 14 });
  synchronizePlaybackSubtitles(f.video, 9, NaN);
  assert.deepEqual(cue(f.second), { startTime: 10, endTime: 12 });
  const earlyCue = cue(f.first);
  earlyCue.startTime = 0.2;
  earlyCue.endTime = 0.8;
  synchronizePlaybackSubtitles(f.video, 4, -3_000);
  assert.deepEqual(earlyCue, { startTime: 0, endTime: 0 });
  synchronizePlaybackSubtitles(f.video, 4, 0);
  assert.deepEqual(earlyCue, { startTime: 0.2, endTime: 0.8 });
});

test("missing indices and detached track elements cannot select a same-language fallback", () => {
  const f = fixture();
  for (const index of [0, 1, -1, 9.1, NaN]) {
    assert.equal(synchronizePlaybackSubtitles(f.video, index).available, false);
    for (const track of Array.from(f.video.textTracks)) assert.equal(track.mode, "disabled");
  }
  const disconnectedTrack: PlaybackSubtitleTrack = { mode: "disabled", cues: [] };
  f.elements.push({ track: disconnectedTrack, getAttribute: () => "20" });
  assert.equal(synchronizePlaybackSubtitles(f.video, 20).available, false);
  assert.equal(disconnectedTrack.mode, "disabled");
});
