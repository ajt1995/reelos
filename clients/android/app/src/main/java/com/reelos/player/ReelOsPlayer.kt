package com.reelos.player

import android.content.Context
import android.media.audiofx.DynamicsProcessing
import android.net.Uri
import android.os.Build
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory

class ReelOsPlayer(context: Context, authenticatedHeaders: Map<String, String> = emptyMap()) {
    val exoPlayer: ExoPlayer
    private var volumeLevelingRequested = false
    private var dynamics: DynamicsProcessing? = null

    init {
        val http = DefaultHttpDataSource.Factory()
            .setAllowCrossProtocolRedirects(false)
            .setDefaultRequestProperties(authenticatedHeaders)
        val renderers = DefaultRenderersFactory(context).apply {
            setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_PREFER)
            setEnableDecoderFallback(true)
        }
        exoPlayer = ExoPlayer.Builder(context, renderers)
            .setMediaSourceFactory(DefaultMediaSourceFactory(context).setDataSourceFactory(DefaultDataSource.Factory(context, http)))
            .setSeekBackIncrementMs(10_000)
            .setSeekForwardIncrementMs(10_000)
            .build()
            .apply {
                videoScalingMode = C.VIDEO_SCALING_MODE_SCALE_TO_FIT
                addListener(object : Player.Listener {
                    override fun onAudioSessionIdChanged(audioSessionId: Int) {
                        if (volumeLevelingRequested) attachVolumeLeveling(audioSessionId)
                    }
                })
            }
    }

    fun playMedia(streamUrl: String, startPositionMs: Long = 0) {
        exoPlayer.setMediaItem(MediaItem.fromUri(Uri.parse(streamUrl)))
        exoPlayer.prepare()
        if (startPositionMs > 0) exoPlayer.seekTo(startPositionMs)
        exoPlayer.playWhenReady = true
    }

    fun setVolumeLeveling(enabled: Boolean): Boolean {
        volumeLevelingRequested = enabled
        if (!enabled) {
            dynamics?.release()
            dynamics = null
            return true
        }
        return attachVolumeLeveling(exoPlayer.audioSessionId)
    }

    fun setSubtitleEnabled(enabled: Boolean) {
        exoPlayer.trackSelectionParameters = exoPlayer.trackSelectionParameters
            .buildUpon()
            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, !enabled)
            .build()
    }

    private fun attachVolumeLeveling(sessionId: Int): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P || sessionId == C.AUDIO_SESSION_ID_UNSET) return false
        return try {
            dynamics?.release()
            val channelCount = 2
            val config = DynamicsProcessing.Config.Builder(
                DynamicsProcessing.VARIANT_FAVOR_TIME_RESOLUTION,
                channelCount,
                false, 0,
                true, 1,
                false, 0,
                true,
            ).build()
            for (channel in 0 until channelCount) {
                config.getMbcBandByChannelIndex(channel, 0).apply {
                    isEnabled = true
                    attackTime = 12f
                    releaseTime = 180f
                    ratio = 3f
                    threshold = -24f
                    kneeWidth = 8f
                    postGain = 3f
                }
            }
            dynamics = DynamicsProcessing(0, sessionId, config).apply { enabled = true }
            true
        } catch (_: Throwable) {
            dynamics = null
            false
        }
    }

    fun release() {
        dynamics?.release()
        dynamics = null
        exoPlayer.release()
    }
}
