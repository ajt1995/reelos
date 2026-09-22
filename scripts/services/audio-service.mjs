import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Audio Booster & Subtitle Service for ReelOS.
 * Provides speech-optimized dynamic range compression curves for the in-app player
 * and automated subtitle detection across media symlinks.
 */

export const DIALOGUE_PRESETS = {
  off: {
    label: "Flat (Original Audio)",
    description: "Unprocessed direct stream audio.",
    compressor: null,
    dialogueBoostDb: 0,
  },
  dialogueBoost: {
    label: "Dialogue Clarity (Speech Boost)",
    description: "Compresses loud action sound effects and boosts speech frequencies (1kHz–3.5kHz).",
    compressor: {
      threshold: -24,
      knee: 10,
      ratio: 4.5,
      attack: 0.005,
      release: 0.25,
      makeupGainDb: 5.5,
    },
    dialogueBoostDb: 4.0,
  },
  nightMode: {
    label: "Late Night (Whisper & Boom Limiter)",
    description: "Aggressive dynamic range reduction to prevent sudden volume spikes while keeping whispers audible.",
    compressor: {
      threshold: -32,
      knee: 6,
      ratio: 8.0,
      attack: 0.002,
      release: 0.15,
      makeupGainDb: 8.0,
    },
    dialogueBoostDb: 6.0,
  },
};

export function getAudioProfile(preset = "dialogueBoost") {
  return DIALOGUE_PRESETS[preset] || DIALOGUE_PRESETS.dialogueBoost;
}

export function detectLocalSubtitles(mediaDir) {
  if (!mediaDir || !existsSync(mediaDir)) {
    return { ok: true, subtitles: [] };
  }

  try {
    const files = readdirSync(mediaDir);
    const srtFiles = files.filter((f) => f.endsWith(".srt") || f.endsWith(".vtt"));
    const subtitles = srtFiles.map((f) => {
      const isSdh = f.toLowerCase().includes("sdh") || f.toLowerCase().includes("cc");
      const isEnglish = f.toLowerCase().includes(".en.") || f.toLowerCase().includes(".eng.") || !f.includes(".");
      return {
        filename: f,
        label: isSdh ? "English [SDH]" : isEnglish ? "English" : f,
        language: "en",
        path: join(mediaDir, f),
      };
    });
    return { ok: true, subtitles };
  } catch (e) {
    return { ok: false, error: e.message, subtitles: [] };
  }
}
