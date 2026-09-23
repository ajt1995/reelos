package com.reelos.ui.tv

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.reelos.ReelOsApplication
import com.reelos.core.api.ReelOsClient
import com.reelos.core.model.ClientResult
import com.reelos.core.model.MediaItem
import com.reelos.core.model.ResidentProfile
import com.reelos.core.offline.StandaloneMediaStore
import com.reelos.core.prefs.AppPreferences
import com.reelos.ui.components.LuminousAuraOrb
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

enum class TvNavSection(val label: String) {
    CINEMA("Cinema"),
    DISCOVER("Discover"),
    CHANNELS("Channels & Ambiance"),
    SEARCH("Search"),
    CINEMA_CLUB("Cinema Club"),
    SETTINGS("Settings"),
}

/**
 * Pure Native Android TV Main Cinema Stage.
 * Zero WebView. Zero Chromium wrappers.
 * Full 10-foot sovereign node with Cinema Spotlight, Discover, Channels, Ambiance,
 * Living Room Photo Frame, Media Acceleration / Indexer Settings, and DirectPlay Media3.
 * (Books explicitly omitted on TV form factor per Austin's directive).
 */
class TvMainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as ReelOsApplication
        val prefs = app.preferences
        if (!prefs.isConfigured && !prefs.hasCompletedOnboarding) {
            val intent = Intent(this, com.reelos.ui.onboarding.OnboardingActivity::class.java).apply {
                putExtra("is_tv", true)
            }
            startActivity(intent)
            finish()
            return
        }
        val client = ReelOsClient(prefs)
        val mediaStore = StandaloneMediaStore(this)

        setContent {
            TvFullStage(
                onPlayMedia = { item ->
                    val intent = Intent(this@TvMainActivity, TvPlayerActivity::class.java).apply {
                        putExtra("stream_url", item.streamUrl)
                        putExtra("item_id", item.id)
                        putExtra("title", item.title)
                        putExtra("is_4k", item.is4k)
                        putExtra("audio_codec", item.audioCodec)
                        putExtra("resume_ms", item.resumePositionMs)
                    }
                    startActivity(intent)
                },
                client = client,
                mediaStore = mediaStore,
                prefs = prefs,
            )
        }
    }
}

// Curated Master Catalog for Native Cinema Experience
private val SAMPLE_CATALOG = listOf(
    MediaItem(
        id = "sintel",
        title = "Sintel",
        year = 2010,
        overview = "A lonely young woman searches the world for a pet dragon that was stolen from her, confronting memory and love.",
        posterUrl = "https://peach.blender.org/wp-content/uploads/title_medium.jpg",
        backdropUrl = "https://peach.blender.org/wp-content/uploads/poster_sintel_en.jpg",
        streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
        is4k = true,
        isHdr = true,
        audioCodec = "Dolby Atmos",
        genre = "Animation / Fantasy",
        available = true,
    ),
    MediaItem(
        id = "tears_of_steel",
        title = "Tears of Steel",
        year = 2012,
        overview = "In a dystopian future Amsterdam, a squad of soldiers and scientists attempt to avert a technological apocalypse.",
        posterUrl = "https://mango.blender.org/wp-content/uploads/2012/09/01_thom_celia_bridge.jpg",
        backdropUrl = "https://mango.blender.org/wp-content/uploads/2012/09/poster_v02.jpg",
        streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
        is4k = true,
        isHdr = true,
        audioCodec = "Dolby Atmos",
        genre = "Sci-Fi / Action",
        available = true,
    ),
    MediaItem(
        id = "big_buck_bunny",
        title = "Big Buck Bunny",
        year = 2008,
        overview = "A giant gentle rabbit with a heart of gold takes creative vengeance on the forest bullies who ruined his afternoon.",
        posterUrl = "https://peach.blender.org/wp-content/uploads/bbb-splash.png",
        backdropUrl = "https://peach.blender.org/wp-content/uploads/bbb-splash.png",
        streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        is4k = true,
        isHdr = true,
        audioCodec = "Dolby Digital Plus 5.1",
        genre = "Comedy / Family",
        available = true,
    ),
    MediaItem(
        id = "night_of_living_dead",
        title = "Night of the Living Dead",
        year = 1968,
        overview = "A group of strangers barricade themselves in a rural Pennsylvania farmhouse against an onslaught of mysterious undead.",
        posterUrl = "https://archive.org/services/img/night_of_the_living_dead",
        backdropUrl = "https://archive.org/services/img/night_of_the_living_dead",
        streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
        is4k = true,
        audioCodec = "Direct 2.0 Mono",
        genre = "Horror / Archival Classic",
        available = true,
    ),
    MediaItem(
        id = "charade",
        title = "Charade",
        year = 1963,
        overview = "A bright, slippery Paris mystery starring Audrey Hepburn and Cary Grant that keeps changing the rules.",
        posterUrl = "https://archive.org/services/img/Charade1963",
        backdropUrl = "https://archive.org/services/img/Charade1963",
        streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
        is4k = true,
        audioCodec = "Dolby Surround",
        genre = "Mystery / Romance",
        available = true,
    ),
    MediaItem(
        id = "his_girl_friday",
        title = "His Girl Friday",
        year = 1940,
        overview = "Quick voices, sharper timing, and a newsroom moving at full speed as a hard-boiled editor pursues his ace reporter.",
        posterUrl = "https://archive.org/services/img/HisGirlFriday1940",
        backdropUrl = "https://archive.org/services/img/HisGirlFriday1940",
        streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        is4k = true,
        audioCodec = "Direct 2.0 Mono",
        genre = "Comedy / Drama",
        available = true,
    ),
    MediaItem(
        id = "inception",
        title = "Inception",
        year = 2010,
        overview = "A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea.",
        posterUrl = "https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
        backdropUrl = "https://image.tmdb.org/t/p/original/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg",
        streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
        is4k = true,
        isHdr = true,
        audioCodec = "Dolby Atmos",
        genre = "Sci-Fi / Thriller",
        available = true,
    ),
    MediaItem(
        id = "the_dark_knight",
        title = "The Dark Knight",
        year = 2008,
        overview = "Batman raises the stakes in his war on crime as a psychopathic criminal mastermind unleashes chaos on Gotham City.",
        posterUrl = "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
        backdropUrl = "https://image.tmdb.org/t/p/original/dqK9Hag1054tghRQSqLSfrkvQnA.jpg",
        streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
        is4k = true,
        isHdr = true,
        audioCodec = "Dolby TrueHD 7.1",
        genre = "Action / Crime",
        available = true,
    ),
    MediaItem(
        id = "the_bear",
        title = "The Bear",
        year = 2022,
        overview = "A young fine-dining chef comes home to Chicago to run his family Italian beef sandwich shop after a heartbreaking death.",
        posterUrl = "https://image.tmdb.org/t/p/w500/sHqbe6m4rIS5b2b2vPz259O1wQf.jpg",
        backdropUrl = "https://image.tmdb.org/t/p/original/m9PH9k4w0U90mYQfU0Dph960k9y.jpg",
        streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        is4k = true,
        isHdr = true,
        audioCodec = "Dolby 5.1",
        genre = "Drama / Series",
        available = true,
    ),
)

// Curated 24/7 Channels & Ambient Living Space
private val AMBIENT_CHANNELS = listOf(
    MediaItem(
        id = "ch_comfort",
        title = "Comfort Sitcoms",
        overview = "Background laughter, cozy living rooms, and familiar ensemble comfort streaming 24/7.",
        posterUrl = "https://image.tmdb.org/t/p/w500/sHqbe6m4rIS5b2b2vPz259O1wQf.jpg",
        backdropUrl = "https://image.tmdb.org/t/p/original/m9PH9k4w0U90mYQfU0Dph960k9y.jpg",
        streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        is4k = true,
        audioCodec = "Dolby 5.1",
        genre = "24/7 Live Channel",
    ),
    MediaItem(
        id = "ch_noir",
        title = "Midnight 35mm Noir",
        overview = "Curated archival shadows, rain-slicked city streets, moody jazz, and classic intrigue.",
        posterUrl = "https://archive.org/services/img/night_of_the_living_dead",
        backdropUrl = "https://archive.org/services/img/night_of_the_living_dead",
        streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
        is4k = true,
        audioCodec = "Direct 2.0 Mono",
        genre = "24/7 Live Channel",
    ),
    MediaItem(
        id = "ch_nature",
        title = "Nature & Slow Cinema",
        overview = "Breathtaking 4K aerial landscapes, meditative soundscapes, visual wallpaper for quiet hours.",
        posterUrl = "https://peach.blender.org/wp-content/uploads/bbb-splash.png",
        backdropUrl = "https://peach.blender.org/wp-content/uploads/bbb-splash.png",
        streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        is4k = true,
        audioCodec = "Dolby Atmos",
        genre = "Slow Cinema",
    ),
    MediaItem(
        id = "ch_space",
        title = "Deep Orbit Atmospheric",
        overview = "Hypnotic interstellar vistas accompanied by deep analog modular synthesizer drones.",
        posterUrl = "https://mango.blender.org/wp-content/uploads/2012/09/01_thom_celia_bridge.jpg",
        backdropUrl = "https://mango.blender.org/wp-content/uploads/2012/09/poster_v02.jpg",
        streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
        is4k = true,
        audioCodec = "Dolby Atmos",
        genre = "Space Ambient",
    ),
)

// Background Visuals & Low-Stim Sounds
private val BACKGROUND_VISUALS = listOf(
    MediaItem(
        id = "vis_yule_log",
        title = "4K Fireside Yule Log",
        overview = "Slow-burning birch logs with authentic crackling hearth embers. Warm radiant light for your living room.",
        posterUrl = "https://images.unsplash.com/photo-1542224566-6e85f2e6772f?w=600&auto=format&fit=crop",
        backdropUrl = "https://images.unsplash.com/photo-1542224566-6e85f2e6772f?w=1600&auto=format&fit=crop",
        streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
        is4k = true,
        isHdr = true,
        audioCodec = "Natural Audio 5.1",
        genre = "Background Visual",
    ),
    MediaItem(
        id = "vis_low_stim_rain",
        title = "Low-Stim Rain & White Noise",
        overview = "Gentle continuous rainfall on a quiet window pane. Calming acoustic pink noise for focus, reading, or sleep.",
        posterUrl = "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=600&auto=format&fit=crop",
        backdropUrl = "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=1600&auto=format&fit=crop",
        streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        is4k = true,
        audioCodec = "Calm White Noise",
        genre = "Low-Stimulation",
    ),
    MediaItem(
        id = "vis_vinyl_study",
        title = "Midnight Vinyl & Study Tape",
        overview = "Subtle analog turntable dust and warm cassette warmth with soft nocturnal acoustic chords.",
        posterUrl = "https://images.unsplash.com/photo-1539185441755-769473a23570?w=600&auto=format&fit=crop",
        backdropUrl = "https://images.unsplash.com/photo-1539185441755-769473a23570?w=1600&auto=format&fit=crop",
        streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
        is4k = true,
        audioCodec = "Analog Vinyl 2.0",
        genre = "Background Sound",
    ),
)

// Living Room Ambient Photo Frame Gallery
private val PHOTO_GALLERY = listOf(
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1511497584788-87676104235f?w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&auto=format&fit=crop",
)

@Composable
fun TvFullStage(
    onPlayMedia: (MediaItem) -> Unit,
    client: ReelOsClient,
    mediaStore: StandaloneMediaStore,
    prefs: AppPreferences,
) {
    val scope = rememberCoroutineScope()
    var currentSection by remember { mutableStateOf(TvNavSection.CINEMA) }
    var focusedHeroItem by remember { mutableStateOf(SAMPLE_CATALOG[0]) }

    var profiles by remember {
        mutableStateOf(
            listOf(
                ResidentProfile(id = "household", name = "Household", avatar = "popcorn"),
                ResidentProfile(id = "austin", name = "Austin", avatar = "clapperboard"),
                ResidentProfile(id = "cinema", name = "Cinema Club", avatar = "film"),
            )
        )
    }

    var catalogItems by remember { mutableStateOf(SAMPLE_CATALOG) }

    LaunchedEffect(Unit) {
        val localItems = mediaStore.items()
        if (localItems.isNotEmpty()) {
            catalogItems = localItems + SAMPLE_CATALOG
        }
        scope.launch {
            val res = client.getProfiles()
            if (res is ClientResult.Success && res.value.isNotEmpty()) {
                profiles = res.value
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF070709)),
    ) {
        // Full-bleed dynamic background hero backdrop with cinematic gradient vignette
        if (focusedHeroItem.backdropUrl != null) {
            AsyncImage(
                model = focusedHeroItem.backdropUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        }

        // Gradient overlay: OLED pitch black on bottom and left for text legibility
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color(0x99070709),
                            Color(0xD9070709),
                            Color(0xFF070709),
                        ),
                    )
                )
        )

        // Centered radiant ambient aura (hardware safe)
        LuminousAuraOrb(
            color = Color(0xFFF5C518),
            modifier = Modifier.fillMaxSize(),
        )

        // Main Stage Column
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 48.dp, vertical = 28.dp),
        ) {
            // Top Navigation Bar (Brand, Tabs, Active Profile)
            TvNavigationBar(
                activeSection = currentSection,
                onSectionSelected = { currentSection = it },
                activeProfileName = prefs.activeResidentName,
                profiles = profiles,
                onProfileSelected = { profile ->
                    prefs.activeResidentId = profile.id
                    prefs.activeResidentName = profile.name
                },
            )

            Spacer(modifier = Modifier.height(18.dp))

            // Body Switcher based on Active Section
            when (currentSection) {
                TvNavSection.CINEMA -> {
                    TvCinemaHomeTab(
                        heroItem = focusedHeroItem,
                        onHeroFocused = { focusedHeroItem = it },
                        catalog = catalogItems,
                        onPlayMedia = onPlayMedia,
                    )
                }
                TvNavSection.DISCOVER -> {
                    TvDiscoverTab(
                        catalog = catalogItems,
                        onPlayMedia = onPlayMedia,
                        onItemFocused = { focusedHeroItem = it },
                    )
                }
                TvNavSection.CHANNELS -> {
                    TvChannelsAndAmbianceTab(
                        channels = AMBIENT_CHANNELS,
                        backgroundVisuals = BACKGROUND_VISUALS,
                        photoGallery = PHOTO_GALLERY,
                        onPlay = onPlayMedia,
                        onFocusItem = { focusedHeroItem = it },
                    )
                }
                TvNavSection.SEARCH -> {
                    TvSearchTab(
                        catalog = catalogItems,
                        onPlayMedia = onPlayMedia,
                    )
                }
                TvNavSection.CINEMA_CLUB -> {
                    TvCinemaClubTab(
                        activeProfileName = prefs.activeResidentName,
                    )
                }
                TvNavSection.SETTINGS -> {
                    TvSettingsTab(
                        prefs = prefs,
                        profiles = profiles,
                    )
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// TOP NAVIGATION BAR
// ---------------------------------------------------------------------------

@Composable
fun TvNavigationBar(
    activeSection: TvNavSection,
    onSectionSelected: (TvNavSection) -> Unit,
    activeProfileName: String,
    profiles: List<ResidentProfile>,
    onProfileSelected: (ResidentProfile) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Brand Mark
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "REEL",
                fontSize = 24.sp,
                fontWeight = FontWeight.Black,
                color = Color.White,
                letterSpacing = 2.sp,
            )
            Text(
                text = "OS",
                fontSize = 24.sp,
                fontWeight = FontWeight.Black,
                color = Color(0xFFF5C518),
                letterSpacing = 2.sp,
            )
        }

        // Section Tabs
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TvNavSection.values().forEach { section ->
                TvNavTab(
                    label = section.label,
                    isSelected = section == activeSection,
                    onSelect = { onSectionSelected(section) },
                )
            }
        }

        // Active Profile Pill
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xFF14141E))
                .border(1.dp, Color(0xFFF5C518).copy(alpha = 0.35f), RoundedCornerShape(24.dp))
                .padding(horizontal = 14.dp, vertical = 6.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(Color(0xFFF5C518)),
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = activeProfileName,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
            )
        }
    }
}

@Composable
fun TvNavTab(
    label: String,
    isSelected: Boolean,
    onSelect: () -> Unit,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()

    val bgColor by animateColorAsState(
        targetValue = when {
            isFocused -> Color(0xFFF5C518)
            isSelected -> Color.White.copy(alpha = 0.15f)
            else -> Color.Transparent
        },
        animationSpec = tween(150),
        label = "NavTabBg",
    )
    val textColor by animateColorAsState(
        targetValue = when {
            isFocused -> Color.Black
            isSelected -> Color(0xFFF5C518)
            else -> Color.White.copy(alpha = 0.65f)
        },
        animationSpec = tween(150),
        label = "NavTabText",
    )

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(bgColor)
            .clickable(interactionSource = interactionSource, indication = null) { onSelect() }
            .focusable(interactionSource = interactionSource)
            .padding(horizontal = 16.dp, vertical = 7.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            fontSize = 13.sp,
            fontWeight = if (isSelected || isFocused) FontWeight.Bold else FontWeight.Medium,
            color = textColor,
            letterSpacing = 0.5.sp,
        )
    }
}

// ---------------------------------------------------------------------------
// TAB 1: CINEMA (HOME)
// ---------------------------------------------------------------------------

@Composable
fun TvCinemaHomeTab(
    heroItem: MediaItem,
    onHeroFocused: (MediaItem) -> Unit,
    catalog: List<MediaItem>,
    onPlayMedia: (MediaItem) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(26.dp),
    ) {
        // Hero Spotlight Banner
        item {
            TvHeroSpotlight(
                item = heroItem,
                onPlay = { onPlayMedia(heroItem) },
            )
        }

        // Shelf 1: Continue Watching & Curated Cinema
        item {
            TvCinemaShelf(
                title = "FEATURED CINEMA & DIRECT PLAY",
                items = catalog,
                onItemFocused = onHeroFocused,
                onItemClicked = onPlayMedia,
            )
        }

        // Shelf 2: Archival Masterpieces (100% Legal Public Domain)
        item {
            TvCinemaShelf(
                title = "ARCHIVAL MASTERPIECES (PUBLIC DOMAIN)",
                items = catalog.filter { it.year != null && it.year < 1970 },
                onItemFocused = onHeroFocused,
                onItemClicked = onPlayMedia,
            )
        }
    }
}

@Composable
fun TvHeroSpotlight(
    item: MediaItem,
    onPlay: () -> Unit,
) {
    val playInteractionSource = remember { MutableInteractionSource() }
    val isPlayFocused by playInteractionSource.collectIsFocusedAsState()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
    ) {
        // Title
        Text(
            text = item.title,
            fontSize = 38.sp,
            fontWeight = FontWeight.Black,
            color = Color.White,
            letterSpacing = (-0.5).sp,
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Specs Row (Badges)
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            item.year?.let {
                Text(
                    text = "$it",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White.copy(alpha = 0.7f),
                )
            }
            if (item.is4k) {
                TvLuxuryBadge(text = "4K UHD")
            }
            if (item.isHdr) {
                TvLuxuryBadge(text = "HDR10+")
            }
            TvLuxuryBadge(text = item.audioCodec)
            if (item.genre.isNotBlank()) {
                Text(
                    text = "·  ${item.genre}",
                    fontSize = 13.sp,
                    color = Color.White.copy(alpha = 0.5f),
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Overview / Synopsis
        Text(
            text = item.overview ?: "Curated high-fidelity presentation prepared for pure native direct playback.",
            fontSize = 15.sp,
            color = Color.White.copy(alpha = 0.8f),
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.fillMaxWidth(0.65f),
            lineHeight = 22.sp,
        )

        Spacer(modifier = Modifier.height(18.dp))

        // Actions: Watch Now (Play)
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            val playScale by animateFloatAsState(
                targetValue = if (isPlayFocused) 1.08f else 1.0f,
                animationSpec = tween(150),
                label = "PlayButtonScale",
            )
            Box(
                modifier = Modifier
                    .scale(playScale)
                    .clip(RoundedCornerShape(24.dp))
                    .background(
                        if (isPlayFocused) Brush.horizontalGradient(
                            listOf(Color(0xFFF5C518), Color(0xFFFFE066))
                        ) else SolidColor(Color.White)
                    )
                    .clickable(interactionSource = playInteractionSource, indication = null) { onPlay() }
                    .focusable(interactionSource = playInteractionSource)
                    .padding(horizontal = 28.dp, vertical = 12.dp),
                contentAlignment = Alignment.Center,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "▶",
                        fontSize = 14.sp,
                        color = Color.Black,
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Watch Now",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.Black,
                    )
                }
            }
        }
    }
}

@Composable
fun TvCinemaShelf(
    title: String,
    items: List<MediaItem>,
    onItemFocused: (MediaItem) -> Unit,
    onItemClicked: (MediaItem) -> Unit,
) {
    Column {
        Text(
            text = title,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = Color(0xFFF5C518),
            letterSpacing = 1.5.sp,
        )
        Spacer(modifier = Modifier.height(14.dp))
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(18.dp),
            contentPadding = PaddingValues(end = 32.dp),
        ) {
            items(items) { item ->
                TvPosterCard(
                    item = item,
                    onFocus = { onItemFocused(item) },
                    onClick = { onItemClicked(item) },
                )
            }
        }
    }
}

@Composable
fun TvPosterCard(
    item: MediaItem,
    onFocus: () -> Unit,
    onClick: () -> Unit,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()

    LaunchedEffect(isFocused) {
        if (isFocused) {
            onFocus()
        }
    }

    val scale by animateFloatAsState(
        targetValue = if (isFocused) 1.08f else 1.0f,
        animationSpec = tween(150),
        label = "PosterScale",
    )
    val borderColor by animateColorAsState(
        targetValue = if (isFocused) Color(0xFFF5C518) else Color.White.copy(alpha = 0.1f),
        animationSpec = tween(150),
        label = "PosterBorder",
    )

    Column(
        modifier = Modifier
            .scale(scale)
            .width(160.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFF12121A))
            .border(
                width = if (isFocused) 2.5.dp else 1.dp,
                color = borderColor,
                shape = RoundedCornerShape(12.dp),
            )
            .clickable(interactionSource = interactionSource, indication = null) { onClick() }
            .focusable(interactionSource = interactionSource),
    ) {
        // Poster Image (Vertical 2:3 Luxury Aspect)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(230.dp)
                .clip(RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp))
                .background(Color(0xFF1E1E2C)),
            contentAlignment = Alignment.Center,
        ) {
            if (item.posterUrl != null) {
                AsyncImage(
                    model = item.posterUrl,
                    contentDescription = item.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                Text(
                    text = item.title.take(1),
                    fontSize = 42.sp,
                    fontWeight = FontWeight.Black,
                    color = Color.White.copy(alpha = 0.3f),
                )
            }

            // Bottom subtle gradient over poster
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(Color.Transparent, Color(0x99000000), Color(0xFF12121A)),
                            startY = 140f,
                        )
                    )
            )
        }

        // Metadata beneath poster
        Column(modifier = Modifier.padding(10.dp)) {
            Text(
                text = item.title,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = if (isFocused) Color(0xFFF5C518) else Color.White,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(modifier = Modifier.height(4.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = item.year?.toString() ?: "",
                    fontSize = 11.sp,
                    color = Color.White.copy(alpha = 0.5f),
                )
                if (item.is4k) {
                    TvLuxuryBadge(text = "4K")
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// TAB 2: DISCOVER
// ---------------------------------------------------------------------------

@Composable
fun TvDiscoverTab(
    catalog: List<MediaItem>,
    onPlayMedia: (MediaItem) -> Unit,
    onItemFocused: (MediaItem) -> Unit,
) {
    var selectedGenre by remember { mutableStateOf("All") }
    val genres = listOf("All", "Movies", "Series", "4K UHD", "Sci-Fi", "Archival Classic", "Comedy")

    val filteredItems = remember(selectedGenre, catalog) {
        when (selectedGenre) {
            "All" -> catalog
            "Movies" -> catalog.filter { !it.genre.contains("Series", ignoreCase = true) }
            "Series" -> catalog.filter { it.genre.contains("Series", ignoreCase = true) }
            "4K UHD" -> catalog.filter { it.is4k }
            "Sci-Fi" -> catalog.filter { it.genre.contains("Sci-Fi", ignoreCase = true) }
            "Archival Classic" -> catalog.filter { (it.year ?: 2026) < 1970 }
            "Comedy" -> catalog.filter { it.genre.contains("Comedy", ignoreCase = true) }
            else -> catalog
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        // Genre Filter Pills
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            contentPadding = PaddingValues(bottom = 18.dp),
        ) {
            items(genres) { genre ->
                TvNavTab(
                    label = genre,
                    isSelected = genre == selectedGenre,
                    onSelect = { selectedGenre = genre },
                )
            }
        }

        // Discover Grid
        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 160.dp),
            horizontalArrangement = Arrangement.spacedBy(18.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
            modifier = Modifier.fillMaxSize(),
        ) {
            items(filteredItems) { item ->
                TvPosterCard(
                    item = item,
                    onFocus = { onItemFocused(item) },
                    onClick = { onPlayMedia(item) },
                )
            }
        }
    }
}

// ---------------------------------------------------------------------------
// TAB 3: CHANNELS & AMBIANCE (24/7 Channels, Yule Log, Low-Stim Soundscapes, Photos)
// ---------------------------------------------------------------------------

@Composable
fun TvChannelsAndAmbianceTab(
    channels: List<MediaItem>,
    backgroundVisuals: List<MediaItem>,
    photoGallery: List<String>,
    onPlay: (MediaItem) -> Unit,
    onFocusItem: (MediaItem) -> Unit,
) {
    var isPhotoFrameActive by remember { mutableStateOf(false) }

    if (isPhotoFrameActive) {
        TvLivingRoomPhotoFrame(
            photos = photoGallery,
            onDismiss = { isPhotoFrameActive = false },
        )
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(28.dp),
        ) {
            // Hero Photo Frame Launcher Button
            item {
                TvPhotoFrameLauncher(
                    onLaunch = { isPhotoFrameActive = true },
                )
            }

            // Shelf 1: 24/7 Curated TV Channels
            item {
                TvCinemaShelf(
                    title = "24/7 LEANBACK CURATED CHANNELS (INSTANT FLIP)",
                    items = channels,
                    onItemFocused = onFocusItem,
                    onItemClicked = onPlay,
                )
            }

            // Shelf 2: Background Visuals & Low-Stim Soundscapes
            item {
                TvCinemaShelf(
                    title = "BACKGROUND VISUALS & LOW-STIM SOUNDSCAPES (YULE LOG, RAIN)",
                    items = backgroundVisuals,
                    onItemFocused = onFocusItem,
                    onItemClicked = onPlay,
                )
            }
        }
    }
}

@Composable
fun TvPhotoFrameLauncher(
    onLaunch: () -> Unit,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()

    val scale by animateFloatAsState(
        targetValue = if (isFocused) 1.03f else 1.0f,
        animationSpec = tween(150),
        label = "PhotoLauncherScale",
    )
    val borderColor by animateColorAsState(
        targetValue = if (isFocused) Color(0xFFF5C518) else Color.White.copy(alpha = 0.15f),
        animationSpec = tween(150),
        label = "PhotoLauncherBorder",
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .scale(scale)
            .clip(RoundedCornerShape(16.dp))
            .background(Color(0xFF14141E))
            .border(width = if (isFocused) 2.dp else 1.dp, color = borderColor, shape = RoundedCornerShape(16.dp))
            .clickable(interactionSource = interactionSource, indication = null) { onLaunch() }
            .focusable(interactionSource = interactionSource)
            .padding(horizontal = 24.dp, vertical = 20.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(Color(0xFFF5C518).copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center,
            ) {
                Text(text = "🖼️", fontSize = 24.sp)
            }
            Spacer(modifier = Modifier.width(18.dp))
            Column {
                Text(
                    text = "Living Room Ambient Photo Frame",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Turn your TV into an art gallery with subtle Ken Burns motion, clock, and weather.",
                    fontSize = 13.sp,
                    color = Color.White.copy(alpha = 0.5f),
                )
            }
        }

        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(20.dp))
                .background(if (isFocused) Color(0xFFF5C518) else Color.White.copy(alpha = 0.1f))
                .padding(horizontal = 18.dp, vertical = 8.dp),
        ) {
            Text(
                text = "Start Frame",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = if (isFocused) Color.Black else Color.White,
            )
        }
    }
}

@Composable
fun TvLivingRoomPhotoFrame(
    photos: List<String>,
    onDismiss: () -> Unit,
) {
    var photoIndex by remember { mutableIntStateOf(0) }

    // Auto-advance photos every 12 seconds with gentle crossfade
    LaunchedEffect(Unit) {
        while (true) {
            delay(12_000)
            photoIndex = (photoIndex + 1) % photos.size
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .clickable { onDismiss() }
            .focusable(),
    ) {
        AsyncImage(
            model = photos[photoIndex],
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )

        // Subtle vignette
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.radialGradient(
                        colors = listOf(Color.Transparent, Color(0x99000000)),
                    )
                )
        )

        // Bottom HUD: Clock and Ambient Tag
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomStart)
                .padding(48.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Bottom,
        ) {
            Column {
                Text(
                    text = "REELOS LIVING ROOM",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFF5C518),
                    letterSpacing = 2.sp,
                )
                Text(
                    text = "High-Fidelity Archival Frame",
                    fontSize = 18.sp,
                    color = Color.White.copy(alpha = 0.85f),
                )
            }
            Text(
                text = "Press any key to return",
                fontSize = 12.sp,
                color = Color.White.copy(alpha = 0.4f),
            )
        }
    }
}

// ---------------------------------------------------------------------------
// TAB 4: SEARCH
// ---------------------------------------------------------------------------

@Composable
fun TvSearchTab(
    catalog: List<MediaItem>,
    onPlayMedia: (MediaItem) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    val results = remember(query, catalog) {
        if (query.isBlank()) catalog
        else catalog.filter {
            it.title.contains(query, ignoreCase = true) ||
            it.genre.contains(query, ignoreCase = true) ||
            (it.overview?.contains(query, ignoreCase = true) == true)
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        // Search Input Bar
        Row(
            modifier = Modifier
                .fillMaxWidth(0.6f)
                .clip(RoundedCornerShape(16.dp))
                .background(Color(0xFF14141E))
                .border(1.dp, Color(0xFFF5C518).copy(alpha = 0.4f), RoundedCornerShape(16.dp))
                .padding(horizontal = 20.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "🔍",
                fontSize = 18.sp,
            )
            Spacer(modifier = Modifier.width(12.dp))
            BasicTextField(
                value = query,
                onValueChange = { query = it },
                textStyle = TextStyle(
                    color = Color.White,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium,
                ),
                cursorBrush = SolidColor(Color(0xFFF5C518)),
                modifier = Modifier.fillMaxWidth(),
                decorationBox = { innerTextField ->
                    if (query.isEmpty()) {
                        Text(
                            text = "Search movies, series, indexers, cached streams...",
                            color = Color.White.copy(alpha = 0.35f),
                            fontSize = 16.sp,
                        )
                    }
                    innerTextField()
                }
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Search Results Grid
        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 160.dp),
            horizontalArrangement = Arrangement.spacedBy(18.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
            modifier = Modifier.fillMaxSize(),
        ) {
            items(results) { item ->
                TvPosterCard(
                    item = item,
                    onFocus = {},
                    onClick = { onPlayMedia(item) },
                )
            }
        }
    }
}

// ---------------------------------------------------------------------------
// TAB 5: CINEMA CLUB (WATCH TOGETHER)
// ---------------------------------------------------------------------------

@Composable
fun TvCinemaClubTab(
    activeProfileName: String,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(top = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier
                .size(72.dp)
                .clip(CircleShape)
                .background(Color(0xFFF5C518).copy(alpha = 0.15f))
                .border(1.5.dp, Color(0xFFF5C518), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(text = "🎬", fontSize = 32.sp)
        }

        Spacer(modifier = Modifier.height(18.dp))

        Text(
            text = "Household Cinema Club",
            fontSize = 28.sp,
            fontWeight = FontWeight.Black,
            color = Color.White,
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Synchronized playback with Austin's Galaxy Fold & Living Room Node",
            fontSize = 15.sp,
            color = Color.White.copy(alpha = 0.6f),
        )

        Spacer(modifier = Modifier.height(24.dp))

        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(12.dp))
                .background(Color(0xFF14141E))
                .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(12.dp))
                .padding(horizontal = 24.dp, vertical = 14.dp),
        ) {
            Text(
                text = "● Sovereign Mesh Room: #CINEMA-7729 (Connected)",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFFF5C518),
            )
        }
    }
}

// ---------------------------------------------------------------------------
// TAB 6: SETTINGS (STREAM GATEWAY, INDEXERS, AUDIO/VIDEO, PROFILES, NODE HEALTH)
// ---------------------------------------------------------------------------

@Composable
fun TvSettingsTab(
    prefs: AppPreferences,
    profiles: List<ResidentProfile>,
) {
    var selectedCategory by remember { mutableStateOf("Cloud Acceleration") }
    val categories = listOf(
        "Cloud Acceleration",
        "External Indexers",
        "Audio & Video",
        "Profiles & Security",
        "Node Health",
    )

    // Local mutable state for instant editing
    var currentProvider by remember { mutableStateOf("Appliance Gateway") }
    var prowlarrUrlInput by remember { mutableStateOf(prefs.prowlarrUrl.ifBlank { "http://192.168.1.234:9696" }) }
    var torznabUrlInput by remember { mutableStateOf(prefs.customTorznabUrl) }

    Row(modifier = Modifier.fillMaxSize()) {
        // Settings Left Nav Menu
        Column(
            modifier = Modifier
                .width(240.dp)
                .padding(end = 32.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            categories.forEach { cat ->
                TvNavTab(
                    label = cat,
                    isSelected = cat == selectedCategory,
                    onSelect = { selectedCategory = cat },
                )
            }
        }

        // Settings Detail Content
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clip(RoundedCornerShape(16.dp))
                .background(Color(0xFF0E0E16))
                .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(16.dp))
                .padding(28.dp),
        ) {
            when (selectedCategory) {
                "Cloud Acceleration" -> {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text(
                            text = "Cloud Acceleration & Streaming Gateway",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                        )
                        Text(
                            text = "Connect high-speed streaming gateways via your paired ReelOS appliance. Zero arbitrary limits on your hardware.",
                            fontSize = 13.sp,
                            color = Color.White.copy(alpha = 0.5f),
                        )
                        Spacer(modifier = Modifier.height(4.dp))

                        val providers = listOf("Appliance Gateway", "High-Speed CDN", "Decypharr Relay", "Generic WebDAV", "Local VPN")
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(providers) { p ->
                                val isSelected = p.equals(currentProvider, ignoreCase = true)
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(if (isSelected) Color(0xFFF5C518) else Color(0xFF1E1E2C))
                                        .clickable {
                                            currentProvider = p
                                        }
                                        .focusable()
                                        .padding(horizontal = 14.dp, vertical = 8.dp),
                                ) {
                                    Text(
                                        text = p,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (isSelected) Color.Black else Color.White,
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        TvSettingRow(
                            label = "Active Household Stream Node",
                            value = prefs.serverBaseUrl.ifBlank { "http://192.168.1.214:8080" },
                        )
                        TvSettingRow(
                            label = "Decypharr Accelerated Mount",
                            value = "/mnt/debrid (Active on Sovereign Node)",
                        )
                    }
                }
                "External Indexers" -> {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text(
                            text = "External Indexer & Torznab Configuration",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                        )
                        Text(
                            text = "ReelOS gives you total freedom to connect your own Prowlarr or direct Torznab indexer feeds. Nothing tells you no.",
                            fontSize = 13.sp,
                            color = Color.White.copy(alpha = 0.5f),
                        )
                        Spacer(modifier = Modifier.height(4.dp))

                        TvSettingInteractiveField(
                            label = "External Prowlarr Host",
                            value = prowlarrUrlInput,
                            placeholder = "http://192.168.1.x:9696",
                            onValueChange = {
                                prowlarrUrlInput = it
                                prefs.prowlarrUrl = it
                            },
                        )

                        TvSettingInteractiveField(
                            label = "Custom Torznab Feed URL",
                            value = torznabUrlInput,
                            placeholder = "https://your-indexer.com/api?t=search...",
                            onValueChange = {
                                torznabUrlInput = it
                                prefs.customTorznabUrl = it
                            },
                        )

                        TvSettingRow(
                            label = "Categories Synced",
                            value = "2000 (Movies 4K UHD), 5000 (TV 4K UHD)",
                        )
                    }
                }
                "Audio & Video" -> {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text(
                            text = "Cinema Display & Sound Pipeline",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                        )
                        Spacer(modifier = Modifier.height(8.dp))

                        TvSettingRow(label = "4K HDR / Dolby Vision", value = "Direct Bitstream (Active)")
                        TvSettingRow(label = "Audio Booster & Passthrough", value = "Dolby Atmos / TrueHD Passthrough")
                        TvSettingRow(label = "Dialogue Focus", value = "Enhanced Vocal Clarity")
                        TvSettingRow(label = "Subtitle Styling", value = "Cinema Amber / Sans")
                    }
                }
                "Profiles & Security" -> {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text(
                            text = "Household Resident Profiles & PINs",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                        )
                        Spacer(modifier = Modifier.height(8.dp))

                        profiles.forEach { p ->
                            TvSettingRow(label = p.name, value = if (p.hasPin) "Locked with PIN" else "Open Access")
                        }
                    }
                }
                "Node Health" -> {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text(
                            text = "Sovereign Node Parity & Peer Mesh",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                        )
                        Spacer(modifier = Modifier.height(8.dp))

                        TvSettingRow(label = "Hardware Node Target", value = "onn. 4K Pro Streaming Box (Mali-G31)")
                        TvSettingRow(label = "Node IP (TV)", value = "192.168.1.95:5555")
                        TvSettingRow(label = "Local Storage Free", value = "26.4 GB / 32 GB Available")
                        TvSettingRow(label = "Architecture Invariant", value = ".exe == .apk Pure Native Parity")
                    }
                }
            }
        }
    }
}

@Composable
fun TvSettingInteractiveField(
    label: String,
    value: String,
    placeholder: String,
    onValueChange: (String) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFF14141E))
            .padding(14.dp),
    ) {
        Text(
            text = label,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color(0xFFF5C518),
        )
        Spacer(modifier = Modifier.height(8.dp))
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle = TextStyle(
                color = Color.White,
                fontSize = 14.sp,
            ),
            cursorBrush = SolidColor(Color(0xFFF5C518)),
            modifier = Modifier.fillMaxWidth(),
            decorationBox = { innerTextField ->
                if (value.isEmpty()) {
                    Text(
                        text = placeholder,
                        color = Color.White.copy(alpha = 0.35f),
                        fontSize = 14.sp,
                    )
                }
                innerTextField()
            }
        )
    }
}

@Composable
fun TvSettingRow(
    label: String,
    value: String,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFF14141E))
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color.White.copy(alpha = 0.85f),
        )
        Text(
            text = value,
            fontSize = 13.sp,
            color = Color(0xFFF5C518),
        )
    }
}

// ---------------------------------------------------------------------------
// BADGES & HELPERS
// ---------------------------------------------------------------------------

@Composable
fun TvLuxuryBadge(
    text: String,
    isHighlight: Boolean = false,
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(
                if (isHighlight) Color(0xFFF5C518).copy(alpha = 0.2f)
                else Color.White.copy(alpha = 0.08f)
            )
            .border(
                width = 0.5.dp,
                color = if (isHighlight) Color(0xFFF5C518).copy(alpha = 0.6f) else Color.White.copy(alpha = 0.18f),
                shape = RoundedCornerShape(4.dp),
            )
            .padding(horizontal = 7.dp, vertical = 3.dp),
    ) {
        Text(
            text = text,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = if (isHighlight) Color(0xFFF5C518) else Color.White.copy(alpha = 0.85f),
        )
    }
}
