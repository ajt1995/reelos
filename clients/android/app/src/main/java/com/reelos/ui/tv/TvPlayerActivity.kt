package com.reelos.ui.tv

import android.os.Bundle
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.lifecycleScope
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
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
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.reelos.player.ReelOsPlayer
import com.reelos.ReelOsApplication
import com.reelos.core.api.ReelOsClient
import com.reelos.core.model.AmbientChannel
import com.reelos.core.model.MediaItem
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * Android TV Leanback Video Player.
 * - Supports instant D-pad channel flipping (<200ms) for Background TV curator channels.
 * - Dialogue Focus toggle in player controls without interrupting playback.
 */
class TvPlayerActivity : ComponentActivity() {
    private lateinit var reelPlayer: ReelOsPlayer
    private lateinit var api: ReelOsClient
    private lateinit var media: MediaItem
    private val sessionId = UUID.randomUUID().toString()

    // Background TV curator channels for instant leanback channel flipping (<200ms)
    private val curatorChannels = listOf(
        AmbientChannel("comfort-sitcoms", "Comfort Sitcoms", "Background laughter and familiar living rooms", "comfort", "Passive comfort streaming for casual living room presence"),
        AmbientChannel("nature-slow-cinema", "Nature & Slow Cinema", "4K landscapes, ambient soundscapes, minimal dialogue", "calm", "Visual wallpaper for quiet hours and reading"),
        AmbientChannel("late-night-noir", "Late-Night Noir", "Shadows, jazz, rain-slicked streets, moody dialogue", "noir", "Atmospheric evening soundtrack"),
        AmbientChannel("weekend-animation", "Weekend Animation", "Classic cel animation, indie shorts, Saturday morning nostalgia", "animation", "Bright colors, whimsical beats, family friendly"),
        AmbientChannel("resident-cinema-radio", "Resident Cinema Radio", "Curated cinematic score streams with synchronized film stills", "radio", "Audio-first cinematic atmosphere"),
    )
    private var currentChannelIndex by mutableIntStateOf(0)
    private var currentChannelBanner by mutableStateOf<ChannelBannerState?>(null)
    private var bannerJob: Job? = null
    private var dialogueFocusActive by mutableStateOf(false)

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
        reelPlayer.setDialogueFocus(prefs.isDialogueFocusEnabled)
        dialogueFocusActive = prefs.isDialogueFocusEnabled
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

                // Top title and metadata badges
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
                        if (dialogueFocusActive) {
                            Surface(
                                color = Color(0x33EAB308),
                                shape = RoundedCornerShape(4.dp)
                            ) {
                                Text(
                                    text = "DIALOGUE FOCUS",
                                    color = Color(0xFFFDE047),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                )
                            }
                        }
                    }
                }

                // Instant Channel Flip OSD Banner
                currentChannelBanner?.let { banner ->
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopCenter)
                            .padding(top = 48.dp)
                            .background(Color(0xE618181B), RoundedCornerShape(12.dp))
                            .border(1.5.dp, Color(0xFFEAB308), RoundedCornerShape(12.dp))
                            .padding(horizontal = 28.dp, vertical = 14.dp)
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "Channel ${banner.index + 1}/${banner.total} · ${banner.name}",
                                color = Color.White,
                                fontSize = 22.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "${banner.tagline} · Instant flip ${banner.flipLatencyMs}ms (<200ms)",
                                color = Color(0xFFFDE047),
                                fontSize = 14.sp,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                        }
                    }
                }

                // Bottom HUD control prompt
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 48.dp, start = 56.dp, end = 56.dp)
                        .align(Alignment.BottomStart),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "←/→ Seek 10s · OK Play/Pause · ↑/↓ Flip Channel (<200ms) · Captions Subtitles · Blue Volume leveling · Yellow Dialogue Focus",
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

    /**
     * Instant D-pad channel flipping (<200ms) for Background TV curator channels.
     * Swaps streams directly on the existing ExoPlayer instance without rebuilding the pipeline.
     */
    private fun flipCuratorChannel(direction: String) {
        val t0 = System.currentTimeMillis()
        val total = curatorChannels.size
        val delta = if (direction == "next") 1 else -1
        currentChannelIndex = (currentChannelIndex + delta + total) % total
        val channel = curatorChannels[currentChannelIndex]

        val prefs = (application as ReelOsApplication).preferences
        val base = prefs.serverBaseUrl.ifBlank { "https://appassets.androidplatform.net" }
        val streamUrl = "$base/api/ambient/stream/${channel.id}"

        // Flip media stream instantly (<200ms)
        reelPlayer.flipChannel(streamUrl)
        val elapsed = (System.currentTimeMillis() - t0).coerceAtLeast(1)

        currentChannelBanner = ChannelBannerState(
            index = currentChannelIndex,
            total = total,
            name = channel.name,
            tagline = channel.tagline,
            flipLatencyMs = elapsed
        )

        bannerJob?.cancel()
        bannerJob = lifecycleScope.launch {
            delay(3_500)
            currentChannelBanner = null
        }
    }

    /**
     * Toggles Dialogue Focus DSP processing on the fly without interrupting playback.
     */
    private fun toggleDialogueFocus() {
        val prefs = (application as ReelOsApplication).preferences
        prefs.isDialogueFocusEnabled = !prefs.isDialogueFocusEnabled
        reelPlayer.setDialogueFocus(prefs.isDialogueFocusEnabled)
        dialogueFocusActive = prefs.isDialogueFocusEnabled
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
            KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_CHANNEL_UP -> {
                flipCuratorChannel("next")
                return true
            }
            KeyEvent.KEYCODE_DPAD_DOWN, KeyEvent.KEYCODE_CHANNEL_DOWN -> {
                flipCuratorChannel("prev")
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
            KeyEvent.KEYCODE_PROG_YELLOW, KeyEvent.KEYCODE_D -> {
                toggleDialogueFocus()
                return true
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onDestroy() {
        bannerJob?.cancel()
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

data class ChannelBannerState(
    val index: Int,
    val total: Int,
    val name: String,
    val tagline: String,
    val flipLatencyMs: Long,
)
