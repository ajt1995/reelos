export interface PlaybackSubtitleCue {
  startTime: number;
  endTime: number;
}

export interface PlaybackSubtitleTrack {
  mode: TextTrackMode;
  readonly cues: ArrayLike<PlaybackSubtitleCue> | null;
}

export interface PlaybackSubtitleElement {
  readonly track: PlaybackSubtitleTrack;
  getAttribute(name: string): string | null;
}

export interface PlaybackSubtitleVideo {
  readonly textTracks: ArrayLike<PlaybackSubtitleTrack>;
  querySelectorAll(selector: string): ArrayLike<PlaybackSubtitleElement>;
}

const originalCueTimes = new WeakMap<PlaybackSubtitleCue, { start: number; end: number }>();

export function clampSubtitleOffset(offsetMs: number): number {
  return Number.isFinite(offsetMs) ? Math.max(-2_000, Math.min(2_000, offsetMs)) : 0;
}

function restoreCues(track: PlaybackSubtitleTrack) {
  if (!track.cues) return;
  for (const cue of Array.from(track.cues)) {
    const original = originalCueTimes.get(cue);
    if (original) {
      cue.startTime = original.start;
      cue.endTime = original.end;
    }
  }
}

/**
 * Match the actual <track data-subtitle-index="…">, never a language or label.
 * Call again on track load so newly available cues receive the current offset.
 */
export function synchronizePlaybackSubtitles(
  video: PlaybackSubtitleVideo,
  selectedMetadataIndex: string | number | null,
  requestedOffsetMs = 0,
): { available: boolean; appliedCueCount: number; offsetMs: number } {
  const offsetMs = clampSubtitleOffset(requestedOffsetMs);
  const tracks = Array.from(video.textTracks);
  const selectedElement = selectedMetadataIndex !== null && String(selectedMetadataIndex).length > 0
    ? Array.from(video.querySelectorAll("track[data-subtitle-index]")).find(
      (element) => element.getAttribute("data-subtitle-index") === String(selectedMetadataIndex),
    )
    : undefined;
  const selectedTrack = selectedElement && tracks.includes(selectedElement.track) ? selectedElement.track : null;

  for (const track of tracks) {
    // Restore while cues are still accessible: disabled tracks can expose null cues.
    if (track !== selectedTrack) restoreCues(track);
    track.mode = track === selectedTrack ? "showing" : "disabled";
  }

  let appliedCueCount = 0;
  if (selectedTrack?.cues) {
    for (const cue of Array.from(selectedTrack.cues)) {
      let original = originalCueTimes.get(cue);
      if (!original) {
        original = { start: cue.startTime, end: cue.endTime };
        originalCueTimes.set(cue, original);
      }
      const start = Math.max(0, original.start + offsetMs / 1_000);
      cue.startTime = start;
      cue.endTime = Math.max(start, original.end + offsetMs / 1_000);
      appliedCueCount += 1;
    }
  }

  return { available: selectedTrack !== null, appliedCueCount, offsetMs };
}
