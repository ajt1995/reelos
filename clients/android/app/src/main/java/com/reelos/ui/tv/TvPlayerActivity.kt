package com.reelos.ui.tv

import android.os.Bundle
import android.view.KeyEvent
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.reelos.player.ReelOsPlayer
import com.reelos.ReelOsApplication
import com.reelos.core.api.ReelOsClient
import com.reelos.core.model.MediaItem
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.UUID

class TvPlayerActivity : ComponentActivity() {
    private lateinit var reelPlayer: ReelOsPlayer
    private lateinit var api: ReelOsClient
    private lateinit var media: MediaItem
    private val sessionId = UUID.randomUUID().toString()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as ReelOsApplication
        val prefs = app.preferences
        api = ReelOsClient(prefs)
        reelPlayer = ReelOsPlayer(this, api.authenticatedHeaders())
        val streamUrl = intent.getStringExtra("stream_url")
        if (streamUrl.isNullOrBlank()) { finish(); return }
        val itemId = intent.getStringExtra("item_id") ?: run { finish(); return }
        val title = intent.getStringExtra("title") ?: "Now Playing"
        val is4k = intent.getBooleanExtra("is_4k", true)
        val isHdr = intent.getBooleanExtra("is_hdr", true)
        val audioCodec = intent.getStringExtra("audio_codec") ?: "Dolby Atmos 7.1"

        val resumeMs = intent.getLongExtra("resume_ms", 0)
        media = MediaItem(id = itemId, title = title, streamUrl = streamUrl, is4k = is4k,
            isHdr = isHdr, audioCodec = audioCodec, available = true)
        reelPlayer.setSubtitleEnabled(prefs.areSubtitlesEnabled)
        reelPlayer.setVolumeLeveling(prefs.isVolumeLevelingEnabled)
        reelPlayer.playMedia(streamUrl, resumeMs)
        lifecycleScope.launch {
            api.reportPlayback("start", media, resumeMs, 0, sessionId, false)
            while (isActive) {
                delay(15_000)
                api.reportPlayback("progress", media, reelPlayer.exoPlayer.currentPosition,
                    reelPlayer.exoPlayer.duration.coerceAtLeast(0), sessionId, !reelPlayer.exoPlayer.isPlaying)
            }
        }
        val exo = reelPlayer.exoPlayer

        setContent {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black)
            ) {
                AndroidView(
                    factory = { ctx ->
                        PlayerView(ctx).apply {
                            this.player = exo
                            useController = false
                            resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                        }
                    },
                    modifier = Modifier.fillMaxSize()
                )

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 48.dp, start = 56.dp, end = 56.dp)
                        .align(Alignment.TopStart)
                ) {
                    Text(
                        text = title,
                        color = Color.White,
                        fontSize = 32.sp,
                        fontWeight = FontWeight.Black
                    )
                    Row(
                        modifier = Modifier.padding(top = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        if (is4k) {
                            Surface(
                                color = Color(0x33F5C518),
                                shape = RoundedCornerShape(4.dp)
                            ) {
                                Text(
                                    text = if (isHdr) "4K HDR" else "4K ULTRA HD",
                                    color = Color(0xFFF5C518),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                )
                            }
                        }
                        Surface(
                            color = Color(0x3338BDF8),
                            shape = RoundedCornerShape(4.dp)
                        ) {
                            Text(
                                text = audioCodec.uppercase(),
                                color = Color(0xFF38BDF8),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                        Surface(
                            color = Color(0x334ADE80),
                            shape = RoundedCornerShape(4.dp)
                        ) {
                            Text(
                                text = "ORIGINAL QUALITY",
                                color = Color(0xFF4ADE80),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 48.dp, start = 56.dp, end = 56.dp)
                        .align(Alignment.BottomStart),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "←/→ Seek 10s · OK Play/Pause · Captions Subtitles · Blue Volume leveling",
                        color = Color(0xFFA1A1AA),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = "Hardware Accelerated Playback",
                        color = Color(0xFF71717A),
                        fontSize = 13.sp
                    )
                }
            }
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        when (keyCode) {
            KeyEvent.KEYCODE_DPAD_LEFT -> {
                reelPlayer.exoPlayer.seekBack()
                return true
            }
            KeyEvent.KEYCODE_DPAD_RIGHT -> {
                reelPlayer.exoPlayer.seekForward()
                return true
            }
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_DPAD_CENTER -> {
                if (reelPlayer.exoPlayer.isPlaying) reelPlayer.exoPlayer.pause() else reelPlayer.exoPlayer.play()
                return true
            }
            KeyEvent.KEYCODE_CAPTIONS -> {
                val prefs = (application as ReelOsApplication).preferences
                prefs.areSubtitlesEnabled = !prefs.areSubtitlesEnabled
                reelPlayer.setSubtitleEnabled(prefs.areSubtitlesEnabled)
                return true
            }
            KeyEvent.KEYCODE_PROG_BLUE -> {
                val prefs = (application as ReelOsApplication).preferences
                prefs.isVolumeLevelingEnabled = !prefs.isVolumeLevelingEnabled
                reelPlayer.setVolumeLeveling(prefs.isVolumeLevelingEnabled)
                return true
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onDestroy() {
        if (::media.isInitialized && ::api.isInitialized && ::reelPlayer.isInitialized) {
            lifecycleScope.launch {
                api.reportPlayback("stop", media, reelPlayer.exoPlayer.currentPosition,
                    reelPlayer.exoPlayer.duration.coerceAtLeast(0), sessionId, !reelPlayer.exoPlayer.isPlaying)
            }
        }
        super.onDestroy()
        reelPlayer.release()
    }
}
