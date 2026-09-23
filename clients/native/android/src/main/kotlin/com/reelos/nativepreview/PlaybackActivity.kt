package com.reelos.nativepreview

import android.net.Uri
import android.os.Bundle
import android.widget.FrameLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.reelos.core.*

/** Local adapter only. No synthetic streams, exported intents, or claimed family enforcement. */
class PlaybackActivity : ComponentActivity() {
    private var player: ExoPlayer? = null
    private var core: ReelCore? = null
    private var mediaId: String? = null
    private var profileId: String? = null
    private var hasRenderedFrame = false
    private lateinit var status: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val frame = FrameLayout(this)
        status = TextView(this).apply { setTextColor(android.graphics.Color.WHITE); setPadding(24, 24, 24, 24) }
        val view = PlayerView(this)
        frame.addView(view, FrameLayout.LayoutParams(-1, -1))
        frame.addView(status)
        setContentView(frame)
        runCatching {
            val state = ReelCore(FileCoreStore(filesDir.resolve("core.bin").toPath()), DeviceKind.ANDROID_PHONE)
            val id = requireNotNull(intent.getStringExtra("mediaId"))
            val profile = requireNotNull(state.snapshot.activeProfile)
            check(state.canEnterHome(profile.id) && state.mediaAction(id) == MediaAction.PLAY)
            val uri = Uri.parse(requireNotNull(getSharedPreferences("local-media", MODE_PRIVATE).getString(id, null)))
            require(uri.scheme == "content")
            contentResolver.openAssetFileDescriptor(uri, "r")?.use { } ?: error("File permission unavailable")
            core = state; mediaId = id; profileId = profile.id
            player = ExoPlayer.Builder(this).build().also { playback ->
                view.player = playback
                playback.addListener(object : Player.Listener {
                    override fun onRenderedFirstFrame() { hasRenderedFrame = true }
                    override fun onPlayerError(error: PlaybackException) {
                        status.text = "This video could not play. Go back to choose another file."
                    }
                })
                playback.setMediaItem(MediaItem.fromUri(uri))
                playback.seekTo(profile.playbackPositionsMs[id] ?: 0L)
                playback.prepare()
                playback.playWhenReady = true
            }
        }.onFailure { status.text = "This file is no longer available. Nothing was changed. Go back to your library." }
    }

    override fun onStop() {
        player?.let { playback ->
            playback.pause()
            if (hasRenderedFrame) {
                runCatching { core?.setPlaybackPosition(requireNotNull(profileId), requireNotNull(mediaId), playback.currentPosition.coerceAtLeast(0L)) }
                    .onFailure { status.text = "Your place could not be saved. Your previous saved position is unchanged." }
            }
        }
        super.onStop()
    }

    override fun onDestroy() { player?.release(); super.onDestroy() }
}
