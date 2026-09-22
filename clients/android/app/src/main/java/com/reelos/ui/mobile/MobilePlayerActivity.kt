package com.reelos.ui.mobile

import android.app.PictureInPictureParams
import android.os.Build
import android.os.Bundle
import android.util.Rational
import android.view.View
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.lifecycleScope
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.reelos.player.ReelOsPlayer
import com.reelos.ReelOsApplication
import com.reelos.core.api.ReelOsClient
import com.reelos.core.model.MediaItem
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.UUID

class MobilePlayerActivity : ComponentActivity() {
    private lateinit var player: ReelOsPlayer
    private lateinit var api: ReelOsClient
    private lateinit var media: MediaItem
    private val sessionId = UUID.randomUUID().toString()
    private val playbackReporter = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var progressJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as ReelOsApplication
        val prefs = app.preferences
        api = ReelOsClient(prefs)
        player = ReelOsPlayer(this, api.authenticatedHeaders())

        val streamUrl = intent.getStringExtra("stream_url")
        if (streamUrl.isNullOrBlank()) { finish(); return }
        val itemId = intent.getStringExtra("item_id") ?: run { finish(); return }
        val title = intent.getStringExtra("title") ?: "Now Playing"
        val is4k = intent.getBooleanExtra("is_4k", true)
        val audioCodec = intent.getStringExtra("audio_codec") ?: "Dolby Atmos"
        val resumeMs = intent.getLongExtra("resume_ms", 0)
        media = MediaItem(id = itemId, title = title, streamUrl = streamUrl, is4k = is4k, audioCodec = audioCodec, available = true)

        player.setSubtitleEnabled(prefs.areSubtitlesEnabled)
        player.setVolumeLeveling(prefs.isVolumeLevelingEnabled)
        player.playMedia(streamUrl, resumeMs)
        playbackReporter.launch {
            api.reportPlayback("start", media, resumeMs, 0, sessionId, false)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            setPictureInPictureParams(
                PictureInPictureParams.Builder()
                    .setAspectRatio(Rational(16, 9))
                    .setAutoEnterEnabled(true)
                    .setSeamlessResizeEnabled(true)
                    .build()
            )
        }

        setContent {
            MobilePlayerScreen(
                exoPlayer = player.exoPlayer,
                title = title,
                is4k = is4k,
                audioCodec = audioCodec,
                subtitlesEnabledAtStart = prefs.areSubtitlesEnabled,
                levelingEnabledAtStart = prefs.isVolumeLevelingEnabled,
                onClose = { finish() },
                onToggleSubtitles = {
                    prefs.areSubtitlesEnabled = !prefs.areSubtitlesEnabled
                    player.setSubtitleEnabled(prefs.areSubtitlesEnabled)
                },
                onToggleLeveling = {
                    prefs.isVolumeLevelingEnabled = !prefs.isVolumeLevelingEnabled
                    player.setVolumeLeveling(prefs.isVolumeLevelingEnabled)
                },
            )
        }
    }

    override fun onStart() {
        super.onStart()
        if (!::player.isInitialized || progressJob?.isActive == true) return
        progressJob = lifecycleScope.launch {
            while (isActive) {
                delay(15_000)
                reportProgress("progress", playbackSnapshot())
            }
        }
    }

    override fun onStop() {
        progressJob?.cancel()
        progressJob = null
        if (::player.isInitialized) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N || !isInPictureInPictureMode) {
                player.exoPlayer.pause()
            }
            val snapshot = playbackSnapshot()
            playbackReporter.launch { reportProgress("progress", snapshot) }
        }
        super.onStop()
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (Build.VERSION.SDK_INT in Build.VERSION_CODES.O until Build.VERSION_CODES.S &&
            ::player.isInitialized && player.exoPlayer.isPlaying
        ) {
            val params = PictureInPictureParams.Builder()
                .setAspectRatio(Rational(16, 9))
                .build()
            enterPictureInPictureMode(params)
        }
    }

    override fun onDestroy() {
        progressJob?.cancel()
        if (isFinishing && ::media.isInitialized && ::api.isInitialized && ::player.isInitialized) {
            val position = player.exoPlayer.currentPosition
            val duration = player.exoPlayer.duration.coerceAtLeast(0)
            val paused = !player.exoPlayer.isPlaying
            playbackReporter.launch {
                api.reportPlayback("stop", media, position, duration, sessionId, paused)
            }
        }
        if (::player.isInitialized) player.release()
        super.onDestroy()
    }

    private fun playbackSnapshot(): PlaybackSnapshot = PlaybackSnapshot(
        positionMs = player.exoPlayer.currentPosition,
        durationMs = player.exoPlayer.duration.coerceAtLeast(0),
        paused = !player.exoPlayer.isPlaying,
    )

    private suspend fun reportProgress(action: String, snapshot: PlaybackSnapshot) {
        if (!::media.isInitialized || !::api.isInitialized) return
        api.reportPlayback(
            action,
            media,
            snapshot.positionMs,
            snapshot.durationMs,
            sessionId,
            snapshot.paused,
        )
    }

    private data class PlaybackSnapshot(val positionMs: Long, val durationMs: Long, val paused: Boolean)
}

@Composable
fun MobilePlayerScreen(
    exoPlayer: ExoPlayer,
    title: String,
    is4k: Boolean,
    audioCodec: String,
    subtitlesEnabledAtStart: Boolean,
    levelingEnabledAtStart: Boolean,
    onClose: () -> Unit,
    onToggleSubtitles: () -> Unit,
    onToggleLeveling: () -> Unit,
) {
    var controlsVisible by remember { mutableStateOf(true) }
    var subtitlesEnabled by remember { mutableStateOf(subtitlesEnabledAtStart) }
    var levelingEnabled by remember { mutableStateOf(levelingEnabledAtStart) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        AndroidView(
            factory = { context ->
                PlayerView(context).apply {
                    this.player = exoPlayer
                    useController = true
                    controllerAutoShow = true
                    controllerHideOnTouch = true
                    controllerShowTimeoutMs = 3_000
                    setShowSubtitleButton(true)
                    setControllerVisibilityListener(PlayerView.ControllerVisibilityListener { visibility ->
                        controlsVisible = visibility == View.VISIBLE
                    })
                    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                    keepScreenOn = true
                }
            },
            modifier = Modifier.fillMaxSize()
        )

        if (controlsVisible) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 24.dp, start = 16.dp, end = 16.dp)
                    .align(Alignment.TopStart),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = title,
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = listOfNotNull(if (is4k) "4K" else null, audioCodec.takeIf(String::isNotBlank)).joinToString("  ·  "),
                        color = Color(0xFFCBD5E1),
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                Button(
                    onClick = onClose,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0x9927272A),
                        contentColor = Color.White
                    )
                ) {
                    Text("Close")
                }
            }

            Row(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 80.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Button(onClick = {
                    subtitlesEnabled = !subtitlesEnabled
                    onToggleSubtitles()
                }) { Text(if (subtitlesEnabled) "Subtitles on" else "Subtitles off") }
                Button(onClick = {
                    levelingEnabled = !levelingEnabled
                    onToggleLeveling()
                }) { Text(if (levelingEnabled) "Leveling on" else "Leveling off") }
            }
        }
    }
}
