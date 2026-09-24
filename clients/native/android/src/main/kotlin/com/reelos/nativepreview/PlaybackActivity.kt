package com.reelos.nativepreview

import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import android.view.Gravity
import android.view.View
import androidx.compose.ui.platform.ComposeView
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
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
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.PlayerView
import com.reelos.core.*
import java.util.ConcurrentModificationException

/** Native local/authorized-byte adapter. No remote URLs, exported intents, or claimed family enforcement. */
@androidx.media3.common.util.UnstableApi
class PlaybackActivity : ComponentActivity() {
    private var providerPlayback: com.reelos.presentation.PreparedProviderPlayback? = null
    private var player: ExoPlayer? = null
    private var mediaId: String? = null
    private var profileId: String? = null
    private var hasRenderedFrame = false
    private var session: LocalPlaybackSession? = null
    private var accessJob: Job? = null
    private var sleepJob: Job? = null
    private val sleepTimer = PlaybackSleepTimer { SystemClock.elapsedRealtime() }
    private var sleepLabel by mutableStateOf(sleepTimer.label())
    private lateinit var sleepControls: ComposeView
    private val stateStore by lazy { FileCoreStore(filesDir.resolve("core.bin").toPath()) }
    private lateinit var playerView: PlayerView
    private lateinit var status: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        savedInstanceState?.takeIf { it.containsKey("sleepStarted") }?.let {
            val end = it.getBoolean("sleepEnd")
            sleepTimer.restore(PlaybackSleepTimer.State(it.getLong("sleepStarted"), if (end) null else it.getLong("sleepDeadline"), end))
            sleepLabel = sleepTimer.label()
        }
        val frame = FrameLayout(this)
        status = TextView(this).apply { setTextColor(android.graphics.Color.WHITE); setPadding(24, 24, 24, 24) }
        playerView = PlayerView(this).apply {
            // Media3's native controls expose available audio tracks in Settings and captions here.
            // They derive options from the actual stream, including on TV with D-pad navigation.
            setShowSubtitleButton(true)
        }
        frame.addView(playerView, FrameLayout.LayoutParams(-1, -1))
        frame.addView(status)
        sleepControls = ComposeView(this).apply {
            setContent {
                MaterialTheme(colorScheme = darkColorScheme()) {
                    com.reelos.ui.SleepTimerControl(sleepLabel,
                        onMinutes = { sleepTimer.after(it * 60_000L); sleepLabel = sleepTimer.label() },
                        onEnd = { sleepTimer.atEnd(); sleepLabel = sleepTimer.label() },
                        onCancel = { sleepTimer.cancel(); sleepLabel = sleepTimer.label() },
                        onExpanded = { open ->
                            playerView.controllerShowTimeoutMs = if (open) 0 else 5_000
                            playerView.showController()
                        })
                }
            }
        }
        frame.addView(sleepControls, FrameLayout.LayoutParams(-2, -2, Gravity.TOP or Gravity.END).apply {
            topMargin = (16 * resources.displayMetrics.density).toInt()
            rightMargin = topMargin
        })
        playerView.setControllerVisibilityListener(PlayerView.ControllerVisibilityListener { visibility ->
            sleepControls.visibility = visibility
        })
        setContentView(frame)
        runCatching {
            val state = ReelCore(FileCoreStore(filesDir.resolve("core.bin").toPath()), DeviceKind.ANDROID_PHONE)
            val providerToken = intent.getStringExtra("providerPlayback")
            if (providerToken != null) providerPlayback = requireNotNull(PendingProviderPlayback.take(providerToken))
            val remote = providerPlayback
            val id = remote?.mediaId ?: requireNotNull(intent.getStringExtra("mediaId"))
            val profile = requireNotNull(state.snapshot.activeProfile)
            check(state.canEnterHome(profile.id) && state.mediaAction(id) == MediaAction.PLAY)
            session = remote?.guard ?: LocalPlaybackSession.open(state.snapshot, id)
            check(remote == null || remote.isAuthorized())
            val uri = if (remote != null) Uri.parse("reelos://authorized-media/$id")
                else Uri.parse(requireNotNull(getSharedPreferences("local-media", MODE_PRIVATE).getString(id, null)))
            if (remote == null) LocalVideo.verifyAccess(this, uri)
            mediaId = id; profileId = profile.id
            val builder = ExoPlayer.Builder(this)
            if (remote != null) builder.setMediaSourceFactory(DefaultMediaSourceFactory(this)
                .setDataSourceFactory { ProviderDataSource(remote.bytes) })
            player = builder.build().also { playback ->
                val preferences = profile.playbackPreferences
                playback.trackSelectionParameters = playback.trackSelectionParameters.buildUpon()
                    .setPreferredAudioLanguage(preferences.audioLanguage)
                    .setPreferredTextLanguage(preferences.subtitleLanguage.takeIf { preferences.subtitleMode == SubtitleMode.ON })
                    .setSelectUndeterminedTextLanguage(preferences.subtitleMode == SubtitleMode.ON)
                    .setTrackTypeDisabled(androidx.media3.common.C.TRACK_TYPE_TEXT, preferences.subtitleMode == SubtitleMode.OFF)
                    .build()
                playerView.player = playback
                playback.addListener(object : Player.Listener {
                    override fun onRenderedFirstFrame() { hasRenderedFrame = true }
                    override fun onIsPlayingChanged(isPlaying: Boolean) {
                        playerView.keepScreenOn = isPlaying
                        if (isPlaying && status.text.toString() == "Sleep timer paused playback.") status.text = ""
                    }
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
                playback.playWhenReady = !sleepTimer.shouldPause(false)
            }
        }.onFailure {
            providerPlayback?.close(); providerPlayback = null
            playerView.player?.release()
            playerView.player = null
            player = null
            session = null
            status.text = "This file is no longer available. Nothing was changed. Go back to your library."
            sleepControls.visibility = View.GONE
        }
    }

    override fun onStart() {
        super.onStart()
        val expected = session ?: return
        sleepJob = lifecycleScope.launch {
            while (isActive && player != null) {
                applySleepTimer()
                delay(250)
            }
        }
        accessJob = lifecycleScope.launch {
            while (isActive && player != null) {
                val allowed = withContext(Dispatchers.IO) { runCatching { expected.isAllowed(stateStore.load()) && providerPlayback?.isAuthorized() != false }.getOrDefault(false) }
                if (!allowed) {
                    providerPlayback?.close(); providerPlayback = null
                    // Release rather than pause: the old controls cannot resume a revoked session.
                    playerView.player = null
                    player?.release()
                    player = null
                    session = null
                    playerView.keepScreenOn = false
                    status.text = "Playback stopped because your profile or source changed, or access could not be checked. Return to your library to try again."
                    sleepControls.visibility = View.GONE
                    break
                }
                delay(1_000)
            }
        }
    }

    override fun onPause() {
        // Android resumes the underlying library before this activity's onStop. Publish the
        // resume point during onPause so MainActivity.onResume reads the current position.
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
        super.onPause()
    }

    override fun onStop() {
        sleepJob?.cancel()
        sleepJob = null
        accessJob?.cancel()
        accessJob = null
        playerView.keepScreenOn = false
        super.onStop()
    }

    override fun onDestroy() { providerPlayback?.close(); providerPlayback = null; player?.release(); super.onDestroy() }

    override fun onSaveInstanceState(outState: Bundle) {
        sleepTimer.state?.let {
            outState.putLong("sleepStarted", it.startedAtMs)
            outState.putBoolean("sleepEnd", it.endOfTitle)
            it.deadlineMs?.let { deadline -> outState.putLong("sleepDeadline", deadline) }
        }
        super.onSaveInstanceState(outState)
    }

    private fun applySleepTimer() {
        val playback = player ?: return
        if (sleepTimer.shouldPause(playback.playbackState == Player.STATE_ENDED)) {
            playback.pause()
            playerView.keepScreenOn = false
            playerView.showController()
            status.text = "Sleep timer paused playback."
            if (hasRenderedFrame) runCatching {
                persistPosition(if (playback.playbackState == Player.STATE_ENDED) 0 else playback.currentPosition.coerceAtLeast(0))
            }.onFailure { status.text = "Playback paused. Your place could not be saved." }
        }
        sleepLabel = sleepTimer.label()
    }

    private fun persistPosition(positionMs: Long) {
        val originalProfileId = requireNotNull(profileId)
        val originalMediaId = requireNotNull(mediaId)
        val store = FileCoreStore(filesDir.resolve("core.bin").toPath())
        var stale: ConcurrentModificationException? = null
        repeat(3) {
            val current = ReelCore(store, DeviceKind.ANDROID_PHONE)
            check(requireNotNull(session).isAllowed(current.snapshot)) { "Playback access changed" }
            check(providerPlayback?.isAuthorized() != false) { "Connection changed" }
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
