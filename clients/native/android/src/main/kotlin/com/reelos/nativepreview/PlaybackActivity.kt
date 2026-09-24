package com.reelos.nativepreview

import android.net.Uri
import android.os.Bundle
import android.widget.FrameLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.reelos.core.*
import java.util.ConcurrentModificationException

/** Local adapter only. No synthetic streams, exported intents, or claimed family enforcement. */
class PlaybackActivity : ComponentActivity() {
    private var player: ExoPlayer? = null
    private var mediaId: String? = null
    private var profileId: String? = null
    private var hasRenderedFrame = false
    private var session: LocalPlaybackSession? = null
    private var accessJob: Job? = null
    private val stateStore by lazy { FileCoreStore(filesDir.resolve("core.bin").toPath()) }
    private lateinit var playerView: PlayerView
    private lateinit var status: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val frame = FrameLayout(this)
        status = TextView(this).apply { setTextColor(android.graphics.Color.WHITE); setPadding(24, 24, 24, 24) }
        playerView = PlayerView(this)
        frame.addView(playerView, FrameLayout.LayoutParams(-1, -1))
        frame.addView(status)
        setContentView(frame)
        runCatching {
            val state = ReelCore(FileCoreStore(filesDir.resolve("core.bin").toPath()), DeviceKind.ANDROID_PHONE)
            val id = requireNotNull(intent.getStringExtra("mediaId"))
            val profile = requireNotNull(state.snapshot.activeProfile)
            check(state.canEnterHome(profile.id) && state.mediaAction(id) == MediaAction.PLAY)
            session = LocalPlaybackSession.open(state.snapshot, id)
            val uri = Uri.parse(requireNotNull(getSharedPreferences("local-media", MODE_PRIVATE).getString(id, null)))
            LocalVideo.verifyAccess(this, uri)
            mediaId = id; profileId = profile.id
            player = ExoPlayer.Builder(this).build().also { playback ->
                playerView.player = playback
                playback.addListener(object : Player.Listener {
                    override fun onRenderedFirstFrame() { hasRenderedFrame = true }
                    override fun onIsPlayingChanged(isPlaying: Boolean) { playerView.keepScreenOn = isPlaying }
                    override fun onPlaybackStateChanged(playbackState: Int) {
                        if (playbackState == Player.STATE_ENDED && hasRenderedFrame) {
                            runCatching { persistPosition(0L) }
                                .onFailure { status.text = "Your place could not be saved. Your previous saved position is unchanged." }
                        }
                    }
                    override fun onPlayerError(error: PlaybackException) {
                        playerView.keepScreenOn = false
                        status.text = "This video could not play. Go back to choose another file."
                    }
                })
                playback.setMediaItem(MediaItem.fromUri(uri))
                playback.seekTo(profile.playbackPositionsMs[id] ?: 0L)
                check(requireNotNull(session).isAllowed(stateStore.load())) { "Playback access changed" }
                playback.prepare()
                playback.playWhenReady = true
            }
        }.onFailure {
            playerView.player?.release()
            playerView.player = null
            player = null
            session = null
            status.text = "This file is no longer available. Nothing was changed. Go back to your library."
        }
    }

    override fun onStart() {
        super.onStart()
        val expected = session ?: return
        accessJob = lifecycleScope.launch {
            while (isActive && player != null) {
                val allowed = withContext(Dispatchers.IO) { runCatching { expected.isAllowed(stateStore.load()) }.getOrDefault(false) }
                if (!allowed) {
                    // Release rather than pause: the old controls cannot resume a revoked session.
                    playerView.player = null
                    player?.release()
                    player = null
                    session = null
                    playerView.keepScreenOn = false
                    status.text = "Playback stopped because your profile or source changed, or access could not be checked. Return to your library to try again."
                    break
                }
                delay(1_000)
            }
        }
    }

    override fun onStop() {
        accessJob?.cancel()
        accessJob = null
        playerView.keepScreenOn = false
        player?.let { playback ->
            val completed = playback.playbackState == Player.STATE_ENDED
            playback.pause()
            if (hasRenderedFrame) {
                val resumePosition = if (completed) 0L else playback.currentPosition.coerceAtLeast(0L)
                runCatching { persistPosition(resumePosition) }
                    .onFailure { status.text = "Your place could not be saved. Your previous saved position is unchanged." }
            }
        }
        super.onStop()
    }

    override fun onDestroy() { player?.release(); super.onDestroy() }

    private fun persistPosition(positionMs: Long) {
        val originalProfileId = requireNotNull(profileId)
        val originalMediaId = requireNotNull(mediaId)
        val store = FileCoreStore(filesDir.resolve("core.bin").toPath())
        var stale: ConcurrentModificationException? = null
        repeat(3) {
            val current = ReelCore(store, DeviceKind.ANDROID_PHONE)
            check(requireNotNull(session).isAllowed(current.snapshot)) { "Playback access changed" }
            check(originalProfileId in current.snapshot.profiles) { "Playback profile is no longer available" }
            val sourceId = current.snapshot.media[originalMediaId]?.sourceId
            check(sourceId != null && sourceId in current.snapshot.sources) { "Playback source is no longer available" }
            try {
                current.setPlaybackPosition(originalProfileId, originalMediaId, positionMs)
                return
            } catch (failure: ConcurrentModificationException) {
                stale = failure
            }
        }
        throw requireNotNull(stale)
    }
}
