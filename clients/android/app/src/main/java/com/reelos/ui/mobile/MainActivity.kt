package com.reelos.ui.mobile

import android.content.Intent
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import com.reelos.core.prefs.AppPreferences
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.lifecycleScope
import androidx.window.layout.WindowInfoTracker
import com.reelos.ReelOsApplication
import com.reelos.core.api.ReelOsClient
import com.reelos.core.model.ClientResult
import com.reelos.core.model.MediaItem
import com.reelos.core.model.ResidentProfile
import com.reelos.core.offline.StandaloneMediaStore
import com.reelos.ui.components.CoverArtWaterfall
import com.reelos.ui.components.LuminousAuraOrb
import com.reelos.ui.components.NativePinBox
import com.reelos.ui.components.TasteBubblesCanvas
import com.reelos.ui.foldable.FoldablePosture
import com.reelos.ui.foldable.FoldablePostureDetector
import coil.compose.AsyncImage
import androidx.compose.ui.layout.ContentScale
import kotlinx.coroutines.launch

/**
 * Pure Native Android Mobile & Foldable Entry Activity.
 * Zero WebView. Zero fake browser wrappers.
 * True sovereign node parity with Windows & Linux nodes.
 * Adapts to Galaxy Z Fold postures:
 * - FOLDED_COMPACT: Single-column thumb-friendly console.
 * - EXPANSIVE_DUAL_PANE: Left pane curator & taste compass, right pane cinema stage.
 * - TABLETOP_FLEX: Split top display and bottom tactile controls.
 */
class MainActivity : ComponentActivity() {

    private var currentPosture by mutableStateOf(FoldablePosture.FOLDED_COMPACT)

    override fun onCreate(savedInstanceState: Bundle?) {
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        super.onCreate(savedInstanceState)

        val app = application as ReelOsApplication
        val prefs = app.preferences
        if (!prefs.isConfigured && !prefs.hasCompletedOnboarding) {
            val intent = Intent(this, com.reelos.ui.onboarding.OnboardingActivity::class.java).apply {
                putExtra("is_tv", false)
            }
            startActivity(intent)
            finish()
            return
        }
        val client = ReelOsClient(prefs)
        val mediaStore = StandaloneMediaStore(this)

        lifecycleScope.launch {
            val tracker = WindowInfoTracker.getOrCreate(this@MainActivity)
            tracker.windowLayoutInfo(this@MainActivity).collect { layoutInfo ->
                val conf = resources.configuration
                currentPosture = FoldablePostureDetector.detect(layoutInfo, conf.screenWidthDp, conf.screenHeightDp)
            }
        }

        setContent {
            MobileCinemaScreen(
                posture = currentPosture,
                activeProfileName = prefs.activeResidentName,
                client = client,
                mediaStore = mediaStore,
                prefs = prefs,
                onPlayMedia = { item ->
                    val intent = Intent(this@MainActivity, MobilePlayerActivity::class.java).apply {
                        putExtra("stream_url", item.streamUrl)
                        putExtra("item_id", item.id)
                        putExtra("title", item.title)
                        putExtra("is_4k", item.is4k)
                        putExtra("audio_codec", item.audioCodec)
                        putExtra("resume_ms", item.resumePositionMs)
                    }
                    startActivity(intent)
                },
                onProfileSelect = { profile ->
                    prefs.activeResidentId = profile.id
                    prefs.activeResidentName = profile.name
                },
            )
        }
    }
}

@Composable
fun MobileCinemaScreen(
    posture: FoldablePosture,
    activeProfileName: String,
    client: ReelOsClient,
    mediaStore: StandaloneMediaStore,
    prefs: AppPreferences,
    onPlayMedia: (MediaItem) -> Unit,
    onProfileSelect: (ResidentProfile) -> Unit,
) {
    val scope = rememberCoroutineScope()
    var showTastePrimer by remember { mutableStateOf(true) }
    var pinValue by remember { mutableStateOf("") }
    var showPinDialog by remember { mutableStateOf(false) }

    var mediaList by remember {
        mutableStateOf(
            listOf(
                MediaItem(
                    id = "big_buck_bunny",
                    title = "Big Buck Bunny 4K",
                    year = 2008,
                    posterUrl = "https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
                    backdropUrl = "https://image.tmdb.org/t/p/original/bKxiLRPVWe2nZUC48HGKi6e8T9m.jpg",
                    streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                    is4k = true,
                    isHdr = true,
                    audioCodec = "Dolby Atmos",
                    available = true,
                ),
                MediaItem(
                    id = "sintel",
                    title = "Sintel (Archival Cinema)",
                    year = 2010,
                    posterUrl = "https://image.tmdb.org/t/p/w500/x26MYuA7HaeiW6L4PjB35L4cQ0w.jpg",
                    backdropUrl = "https://image.tmdb.org/t/p/original/4uBhyXvF6YnBjh6q1t5gR2T39Jm.jpg",
                    streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
                    is4k = true,
                    audioCodec = "Dolby Digital Plus",
                    available = true,
                ),
                MediaItem(
                    id = "tears_of_steel",
                    title = "Tears of Steel 4K HDR",
                    year = 2012,
                    posterUrl = "https://image.tmdb.org/t/p/w500/d5iZ1o793qI8m1Kz2i7Zl9F99xR.jpg",
                    backdropUrl = "https://image.tmdb.org/t/p/original/4HodYYKEIsGOdinkGi2Ucz6X9i0.jpg",
                    streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
                    is4k = true,
                    isHdr = true,
                    audioCodec = "Dolby Atmos",
                    available = true,
                ),
            )
        )
    }

    LaunchedEffect(Unit) {
        val localItems = mediaStore.items()
        if (localItems.isNotEmpty()) {
            mediaList = localItems + mediaList
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF070709)),
    ) {
        // Living Parallax Cinema Cover Art Waterfall streaming in background
        CoverArtWaterfall(
            modifier = Modifier.fillMaxSize(),
        )

        // Centered, fast, and glowey ambient aura (hardware radial gradient)
        LuminousAuraOrb(
            color = Color(0xFFF5C518),
            modifier = Modifier.fillMaxSize(),
        )

        when (posture) {
            FoldablePosture.EXPANSIVE_DUAL_PANE -> {
                // Galaxy Z Fold Unfolded Interior Screen: Dual-Pane Master Console
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                ) {
                    // Left Pane: Curator, Profile & Taste Compass
                    Column(
                        modifier = Modifier
                            .weight(1.1f)
                            .fillMaxHeight()
                            .clip(RoundedCornerShape(20.dp))
                            .background(Color(0xFF101017).copy(alpha = 0.85f))
                            .border(1.dp, Color.White.copy(alpha = 0.10f), RoundedCornerShape(20.dp))
                            .padding(20.dp),
                    ) {
                        BrandHeader(activeProfileName = activeProfileName)

                        Spacer(modifier = Modifier.height(20.dp))

                        TasteBubblesCanvas(
                            modifier = Modifier.weight(1f),
                            onAffinityChanged = { affinities ->
                                affinities.forEach { (itemKey, affinity) ->
                                    val mult = when (affinity) {
                                        com.reelos.ui.components.TasteAffinity.LOVE -> 2.5f
                                        com.reelos.ui.components.TasteAffinity.LIKE -> 1.0f
                                        com.reelos.ui.components.TasteAffinity.NEUTRAL -> 0.0f
                                    }
                                    if (mult > 0f) {
                                        val latent = com.reelos.neural.MobileNeuralEngine.projectQueryTo512D(itemKey)
                                        val updated = com.reelos.neural.MobileNeuralEngine.updateResidentCentroid(
                                            prefs.getResidentTasteVector(),
                                            latent,
                                            mult,
                                        )
                                        prefs.setResidentTasteVector(updated)
                                    }
                                }
                            },
                        )
                    }

                    Spacer(modifier = Modifier.width(20.dp))

                    // Right Pane: Active Cinema Stage & Media Library
                    Column(
                        modifier = Modifier
                            .weight(1.3f)
                            .fillMaxHeight(),
                    ) {
                        MediaListSection(
                            mediaList = mediaList,
                            onPlayMedia = onPlayMedia,
                        )
                    }
                }
            }

            else -> {
                // Folded Compact or Tabletop Flex: Fluid Single-Pane Console
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 20.dp, vertical = 24.dp),
                ) {
                    BrandHeader(activeProfileName = activeProfileName)

                    Spacer(modifier = Modifier.height(16.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (!showTastePrimer) Color(0xFFF5C518) else Color(0xFF181822))
                                .clickable { showTastePrimer = false }
                                .padding(vertical = 12.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = "Cinema Library",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (!showTastePrimer) Color.Black else Color.White,
                            )
                        }

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (showTastePrimer) Color(0xFFF5C518) else Color(0xFF181822))
                                .clickable { showTastePrimer = true }
                                .padding(vertical = 12.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = "Taste Bubbles",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (showTastePrimer) Color.Black else Color.White,
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    if (showTastePrimer) {
                        TasteBubblesCanvas(
                            modifier = Modifier.fillMaxSize(),
                        )
                    } else {
                        MediaListSection(
                            mediaList = mediaList,
                            onPlayMedia = onPlayMedia,
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun BrandHeader(activeProfileName: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "REEL",
                fontSize = 24.sp,
                fontWeight = FontWeight.Black,
                color = Color.White,
                letterSpacing = 1.5.sp,
            )
            Text(
                text = "OS",
                fontSize = 24.sp,
                fontWeight = FontWeight.Black,
                color = Color(0xFFF5C518),
                letterSpacing = 1.5.sp,
            )
        }

        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(20.dp))
                .background(Color(0xFF181822))
                .border(1.dp, Color(0xFFF5C518).copy(alpha = 0.4f), RoundedCornerShape(20.dp))
                .padding(horizontal = 14.dp, vertical = 6.dp),
        ) {
            Text(
                text = activeProfileName,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
            )
        }
    }
}

@Composable
fun MediaListSection(
    mediaList: List<MediaItem>,
    onPlayMedia: (MediaItem) -> Unit,
) {
    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        items(mediaList) { item ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color(0xFF12121A).copy(alpha = 0.88f))
                    .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(16.dp))
                    .clickable { onPlayMedia(item) }
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Luxury Poster Thumbnail
                Box(
                    modifier = Modifier
                        .size(width = 68.dp, height = 98.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color(0xFF1E1E2A)),
                    contentAlignment = Alignment.Center,
                ) {
                    if (!item.posterUrl.isNullOrBlank()) {
                        AsyncImage(
                            model = item.posterUrl,
                            contentDescription = item.title,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize(),
                        )
                    }
                    // Glowing subtle Play overlay badge
                    Box(
                        modifier = Modifier
                            .size(34.dp)
                            .clip(CircleShape)
                            .background(Color.Black.copy(alpha = 0.65f))
                            .border(1.dp, Color(0xFFF5C518).copy(alpha = 0.8f), CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "▶",
                            fontSize = 13.sp,
                            color = Color(0xFFF5C518),
                        )
                    }
                }

                Spacer(modifier = Modifier.width(16.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = item.title,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    item.year?.let { y ->
                        Text(
                            text = y.toString(),
                            fontSize = 12.sp,
                            color = Color.White.copy(alpha = 0.5f),
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        if (item.is4k) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(Color(0xFFF5C518).copy(alpha = 0.15f))
                                    .border(1.dp, Color(0xFFF5C518).copy(alpha = 0.4f), RoundedCornerShape(4.dp))
                                    .padding(horizontal = 6.dp, vertical = 2.dp),
                            ) {
                                Text(
                                    text = "4K HDR",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFFF5C518),
                                )
                            }
                        }
                        Text(
                            text = item.audioCodec,
                            fontSize = 11.sp,
                            color = Color.White.copy(alpha = 0.6f),
                        )
                    }
                }
            }
        }
    }
}
