export class AdaptivePlayback {
  evaluatePlaybackPlan(clientSpec, networkSpec, mediaSpec) {
    if (networkSpec.hostThermalThrottlingRisk || networkSpec.hostCpuLoad > 0.85) {
      return { decision: 'Thermal Budget Transcode', scaleDown: true, transcodePreset: 'ultrafast' };
    }

    if (clientSpec.type === 'tv' && mediaSpec.is4k && networkSpec.onAcPower && networkSpec.fastLan) {
      return { decision: '4K DirectPlay Remux', untouched: true };
    }

    if (clientSpec.type === 'mobile' || clientSpec.type === 'tablet') {
      if (clientSpec.audioIncompatible) {
        return { decision: 'DirectStream Transmux', audioTranscode: 'AAC stereo', videoUntouched: true };
      }
    }

    if (clientSpec.type === 'potato' || clientSpec.cpu === 'Intel Pentium N3710') {
      if (networkSpec.bandwidthConstrained) {
        return { decision: 'Select 1080p high-efficiency release', videoTranscode: 'disabled' };
      }
      return { decision: 'DirectPlay', videoTranscode: 'disabled' };
    }

    if (clientSpec.type === 'desktop' && clientSpec.hasNvidia) {
      if (clientSpec.dropsFrames) {
        return { decision: 'dynamic GPU transcoding', hwaccel: 'NVENC' };
      }
    }

    // iPhone PWA & iPad (Home Screen Shortcut Install)
    if (clientSpec.platform === 'ios' || clientSpec.isIphonePwa) {
      if (networkSpec.fastLan) {
        if (clientSpec.audioIncompatible || mediaSpec.audioCodec === 'truehd' || mediaSpec.audioCodec === 'dts') {
          return { decision: 'DirectStream Transmux', audioTranscode: 'AAC stereo', videoUntouched: true, reason: 'iOS native 4K HEVC with zero-latency audio remux' };
        }
        return { decision: '4K DirectPlay Remux', untouched: true, reason: 'iOS native Dolby Vision/HEVC DirectPlay' };
      }
      return { decision: 'Select 1080p high-efficiency release', videoUntouched: true, reason: 'iOS cellular/remote optimization' };
    }

    // Android Phone & Foldable App (Galaxy Z Fold, Pixel)
    if (clientSpec.platform === 'android' || clientSpec.isAndroidApp) {
      if (networkSpec.fastLan) {
        return { decision: '4K DirectPlay Remux', untouched: true, reason: 'Android ExoPlayer native DirectPlay' };
      }
      return { decision: 'Select 1080p high-efficiency release', videoUntouched: true, reason: 'Android adaptive mobile bandwidth' };
    }

    if (clientSpec.platform === 'darwin-arm64' || clientSpec.hasAppleSilicon) {
      if (mediaSpec.codec === 'prores') {
        return { decision: 'ProRes hardware decoding', hwaccel: 'ProRes', untouched: true };
      }
      return { decision: 'VideoToolbox hardware transcoding', hwaccel: 'VideoToolbox', codecs: ['hevc_videotoolbox', 'h264_videotoolbox'] };
    }

    return { decision: 'DirectPlay Default', untouched: true };
  }
}

export const adaptivePlayback = new AdaptivePlayback();
