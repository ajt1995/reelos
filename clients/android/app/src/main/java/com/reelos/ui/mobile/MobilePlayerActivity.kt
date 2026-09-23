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
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
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
import androidx.window.layout.WindowInfoTracker
import com.reelos.player.ReelOsPlayer
import com.reelos.ReelOsApplication
import com.reelos.core.api.ReelOsClient
import com.reelos.core.model.MediaItem
import com.reelos.ui.foldable.FoldablePosture
import com.reelos.ui.foldable.FoldablePostureDetector
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * Mobile and Foldable Video Player Activity.
 * Supports folding postures:
 * - FOLDED_COMPACT: Compact one-handed remote/player when folded.
 * - EXPANSIVE_DUAL_PANE: Expansive dual-pane master console (curator compass/dossiers on left,
 *   active player or real-time TV companion on right) when unfolded.
 * - TABLETOP_FLEX: Tabletop/flex posture (video on top, controls/scrubber on bottom).
 * Includes Dialogue Focus toggle without interrupting playback.
 */
class MobilePlayerActivity : ComponentActivity() {
    private lateinit var player: ReelOsPlayer
    private lateinit var api: ReelOsClient
    private lateinit var media: MediaItem
    private val sessionId = UUID.randomUUID().toString()
    private val playbackReporter = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var progressJob: Job? = null
    private var currentPosture by mutableStateOf(FoldablePosture.FOLDED_COMPACT)

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
        player.setDialogueFocus(prefs.isDialogueFocusEnabled)
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

        // Track foldable posture
        lifecycleScope.launch {
            val tracker = WindowInfoTracker.getOrCreate(this@MobilePlayerActivity)
            tracker.windowLayoutInfo(this@MobilePlayerActivity).collect { layoutInfo ->
                val conf = resources.configuration
                currentPosture = FoldablePostureDetector.detect(layoutInfo, conf.screenWidthDp, conf.screenHeightDp)
            }
        }

        setContent {
            MobilePlayerScreen(
                exoPlayer = player.exoPlayer,
                title = title,
                is4k = is4k,
                audioCodec = audioCodec,
                posture = currentPosture,
                subtitlesEnabledAtStart = prefs.areSubtitlesEnabled,
                levelingEnabledAtStart = prefs.isVolumeLevelingEnabled,
                dialogueFocusEnabledAtStart = prefs.isDialogueFocusEnabled,
                onClose = { finish() },
                onToggleSubtitles = {
                    prefs.areSubtitlesEnabled = !prefs.areSubtitlesEnabled
                    player.setSubtitleEnabled(prefs.areSubtitlesEnabled)
                },
                onToggleLeveling = {
                    prefs.isVolumeLevelingEnabled = !prefs.isVolumeLevelingEnabled
                    player.setVolumeLeveling(prefs.isVolumeLevelingEnabled)
                },
                onToggleDialogueFocus = {
                    prefs.isDialogueFocusEnabled = !prefs.isDialogueFocusEnabled
                    player.setDialogueFocus(prefs.isDialogueFocusEnabled)
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
    posture: FoldablePosture,
    subtitlesEnabledAtStart: Boolean,
    levelingEnabledAtStart: Boolean,
    dialogueFocusEnabledAtStart: Boolean,
    onClose: () -> Unit,
    onToggleSubtitles: () -> Unit,
    onToggleLeveling: () -> Unit,
    onToggleDialogueFocus: () -> Unit,
) {
    var controlsVisible by remember { mutableStateOf(true) }
    var subtitlesEnabled by remember { mutableStateOf(subtitlesEnabledAtStart) }
    var levelingEnabled by remember { mutableStateOf(levelingEnabledAtStart) }
    var dialogueFocusEnabled by remember { mutableStateOf(dialogueFocusEnabledAtStart) }

    when (posture) {
        FoldablePosture.TABLETOP_FLEX -> {
            // Tabletop / flex posture: video on top pane, controls/scrubber on bottom pane
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black)
            ) {
                // Top Pane: Video
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .background(Color.Black)
                ) {
                    AndroidView(
                        factory = { context ->
                            PlayerView(context).apply {
                                this.player = exoPlayer
                                useController = false
                                resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                                keepScreenOn = true
                            }
                        },
                        modifier = Modifier.fillMaxSize()
                    )
                }

                // Bottom Pane: Controls and scrubber on tabletop base
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .background(Color(0xFF121214))
                        .padding(24.dp),
                    verticalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(text = title, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                            Text(
                                text = listOfNotNull(if (is4k) "4K" else null, audioCodec).joinToString(" · "),
                                color = Color(0xFFEAB308),
                                fontSize = 13.sp,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                        }
                        Button(
                            onClick = onClose,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF27272A), contentColor = Color.White)
                        ) {
                            Text("Close")
                        }
                    }

                    // Scrubber and playback actions
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(text = "Tabletop Console", color = Color(0xFFA1A1AA), fontSize = 12.sp)
                            Text(text = if (dialogueFocusEnabled) "Dialogue Focus: Active" else "Standard Audio", color = Color(0xFFFDE047), fontSize = 12.sp)
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Button(
                                onClick = { if (exoPlayer.isPlaying) exoPlayer.pause() else exoPlayer.play() },
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF27272A), contentColor = Color.White)
                            ) {
                                Text(if (exoPlayer.isPlaying) "Pause" else "Play")
                            }
                            Button(
                                onClick = { exoPlayer.seekBack() },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF27272A), contentColor = Color.White)
                            ) {
                                Text("-10s")
                            }
                            Button(
                                onClick = { exoPlayer.seekForward() },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF27272A), contentColor = Color.White)
                            ) {
                                Text("+10s")
                            }
                        }
                    }

                    // Audio & Subtitle toggles
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick = {
                                dialogueFocusEnabled = !dialogueFocusEnabled
                                onToggleDialogueFocus()
                            },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (dialogueFocusEnabled) Color(0xFFEAB308) else Color(0xFF27272A),
                                contentColor = if (dialogueFocusEnabled) Color.Black else Color.White
                            )
                        ) {
                            Text(if (dialogueFocusEnabled) "Dialogue Focus on" else "Dialogue Focus off", fontSize = 12.sp)
                        }

                        Button(
                            onClick = {
                                subtitlesEnabled = !subtitlesEnabled
                                onToggleSubtitles()
                            },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF27272A), contentColor = Color.White)
                        ) {
                            Text(if (subtitlesEnabled) "Subtitles on" else "Subtitles off", fontSize = 12.sp)
                        }

                        Button(
                            onClick = {
                                levelingEnabled = !levelingEnabled
                                onToggleLeveling()
                            },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF27272A), contentColor = Color.White)
                        ) {
                            Text(if (levelingEnabled) "Leveling on" else "Leveling off", fontSize = 12.sp)
                        }
                    }
                }
            }
        }

        FoldablePosture.EXPANSIVE_DUAL_PANE -> {
            // Expansive dual-pane master console: curator compass/dossiers on left, active player on right
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black)
            ) {
                // Left Pane: Curator compass, scene dossiers, companion info
                Column(
                    modifier = Modifier
                        .weight(0.42f)
                        .fillMaxHeight()
                        .background(Color(0xFF141416))
                        .padding(24.dp),
                    verticalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text(
                            text = "CURATOR COMPASS & DOSSIER",
                            color = Color(0xFFEAB308),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(text = title, color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Black)
                        Text(
                            text = listOfNotNull(if (is4k) "4K Ultra HD" else null, audioCodec).joinToString(" · "),
                            color = Color(0xFFCBD5E1),
                            fontSize = 14.sp,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Surface(
                            color = Color(0xFF1F1F23),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Text(
                                    text = "Scene Intelligence",
                                    color = Color.White,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Vocal clarity tuned for immersive acoustics. Dialogue Focus balances spoken word without speech masking.",
                                    color = Color(0xFFA1A1AA),
                                    fontSize = 12.sp,
                                    modifier = Modifier.padding(top = 6.dp)
                                )
                            }
                        }
                    }

                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Button(
                            onClick = {
                                dialogueFocusEnabled = !dialogueFocusEnabled
                                onToggleDialogueFocus()
                            },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (dialogueFocusEnabled) Color(0xFFEAB308) else Color(0xFF27272A),
                                contentColor = if (dialogueFocusEnabled) Color.Black else Color.White
                            )
                        ) {
                            Text(if (dialogueFocusEnabled) "Dialogue Focus on" else "Dialogue Focus off")
                        }
                        Button(
                            onClick = {
                                subtitlesEnabled = !subtitlesEnabled
                                onToggleSubtitles()
                            },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF27272A), contentColor = Color.White)
                        ) {
                            Text(if (subtitlesEnabled) "Subtitles on" else "Subtitles off")
                        }
                        Button(
                            onClick = {
                                levelingEnabled = !levelingEnabled
                                onToggleLeveling()
                            },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF27272A), contentColor = Color.White)
                        ) {
                            Text(if (levelingEnabled) "Leveling on" else "Leveling off")
                        }
                        Button(
                            onClick = onClose,
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF3F3F46), contentColor = Color.White)
                        ) {
                            Text("Close")
                        }
                    }
                }

                // Right Pane: Active Video Player
                Box(
                    modifier = Modifier
                        .weight(0.58f)
                        .fillMaxHeight()
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
                                resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                                keepScreenOn = true
                            }
                        },
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }
        }

        FoldablePosture.FOLDED_COMPACT -> {
            // Folded: compact one-handed remote/player
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
                            dialogueFocusEnabled = !dialogueFocusEnabled
                            onToggleDialogueFocus()
                        }) { Text(if (dialogueFocusEnabled) "Dialogue Focus on" else "Dialogue Focus off") }
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
    }
}
