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
    private var dialogueFocusRequested = false
    private var dynamics: DynamicsProcessing? = null

    val isDialogueFocusActive: Boolean
        get() = dialogueFocusRequested

    val isVolumeLevelingActive: Boolean
        get() = volumeLevelingRequested

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
                        if (volumeLevelingRequested || dialogueFocusRequested) {
                            attachAudioProcessing(audioSessionId)
                        }
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

    /**
     * Instant channel flipping for Background TV curator channels (<200ms).
     * Reuses the initialized player and hardware decoder pipeline without rebuilding ExoPlayer.
     */
    fun flipChannel(streamUrl: String) {
        exoPlayer.setMediaItem(MediaItem.fromUri(Uri.parse(streamUrl)))
        exoPlayer.prepare()
        exoPlayer.playWhenReady = true
    }

    /**
     * Toggles speech clarity / dialogue focus targeting human vocal frequencies (1 kHz - 4 kHz).
     * Updates the DSP DynamicsProcessing pipeline on the fly without interrupting playback.
     */
    fun setDialogueFocus(enabled: Boolean): Boolean {
        dialogueFocusRequested = enabled
        return updateAudioProcessing()
    }

    fun setVolumeLeveling(enabled: Boolean): Boolean {
        volumeLevelingRequested = enabled
        return updateAudioProcessing()
    }

    fun setSubtitleEnabled(enabled: Boolean) {
        exoPlayer.trackSelectionParameters = exoPlayer.trackSelectionParameters
            .buildUpon()
            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, !enabled)
            .build()
    }

    private fun updateAudioProcessing(): Boolean {
        if (!volumeLevelingRequested && !dialogueFocusRequested) {
            dynamics?.release()
            dynamics = null
            return true
        }
        return attachAudioProcessing(exoPlayer.audioSessionId)
    }

    fun attachVolumeLeveling(sessionId: Int): Boolean = attachAudioProcessing(sessionId)

    private fun attachAudioProcessing(sessionId: Int): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P || sessionId == C.AUDIO_SESSION_ID_UNSET) return false
        return try {
            dynamics?.release()
            val channelCount = 2
            val usePreEq = dialogueFocusRequested
            val preEqBands = if (usePreEq) 1 else 0
            val useMbc = volumeLevelingRequested || dialogueFocusRequested
            val mbcBands = if (useMbc) 1 else 0
            val config = DynamicsProcessing.Config.Builder(
                DynamicsProcessing.VARIANT_FAVOR_TIME_RESOLUTION,
                channelCount,
                usePreEq, preEqBands,
                useMbc, mbcBands,
                false, 0,
                true,
            ).build()

            for (channel in 0 until channelCount) {
                if (usePreEq) {
                    config.getPreEqBandByChannelIndex(channel, 0).apply {
                        isEnabled = true
                        cutoffFrequency = 2500f // Target speech formants & vocal presence
                        gain = 4.5f
                    }
                }
                if (useMbc) {
                    config.getMbcBandByChannelIndex(channel, 0).apply {
                        isEnabled = true
                        attackTime = 12f
                        releaseTime = 180f
                        ratio = if (volumeLevelingRequested) 3f else 2.2f
                        threshold = if (dialogueFocusRequested) -20f else -24f
                        kneeWidth = 8f
                        postGain = if (dialogueFocusRequested) 4.5f else 3f
                    }
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
