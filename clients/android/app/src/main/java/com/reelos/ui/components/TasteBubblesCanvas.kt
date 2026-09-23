package com.reelos.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

enum class TasteCategory(val label: String) {
    ALL("All"),
    FILMS("Films"),
    AUTEURS("Directors"),
    ACTORS("Actors"),
    VIBES("Genres & Vibes"),
}

enum class TasteAffinity(val scaleMultiplier: Float, val weight: Float) {
    NEUTRAL(1.0f, 0.0f),
    LIKE(1.26f, 1.0f),
    LOVE(1.58f, 2.5f);

    fun next(): TasteAffinity = when (this) {
        NEUTRAL -> LIKE
        LIKE -> LOVE
        LOVE -> NEUTRAL
    }
}

data class TasteBubble(
    val id: String,
    val title: String,
    val subtitle: String,
    val category: TasteCategory,
    val baseColor: Color,
    val initialSizeDp: Int = 104,
    val driftSpeed: Float = 1.0f,
    val phaseOffset: Float = 0.0f,
    val relatedIds: List<String> = emptyList(),
)

// Master catalog of iconic films, auteurs, actors, and movements
val CINEMA_CONSTELLATION_CATALOG = listOf(
    // Vibes / Genres
    TasteBubble("sci_fi_noir", "Sci-Fi Noir", "Dystopian & Neon", TasteCategory.VIBES, Color(0xFF38BDF8), 110, 1.1f, 0.2f, listOf("blade_runner_2049", "denis_villeneuve", "cyberpunk")),
    TasteBubble("35mm_slowburn", "35mm Grain", "Slow-Burn Drama", TasteCategory.VIBES, Color(0xFFF5C518), 105, 0.9f, 1.4f, listOf("there_will_be_blood", "pta", "cillian_murphy")),
    TasteBubble("a24_midnight", "A24 Midnight", "Surrealist Indie", TasteCategory.VIBES, Color(0xFFA855F7), 115, 1.2f, 2.1f, listOf("florence_pugh", "willem_dafoe", "hereditary")),
    TasteBubble("cyberpunk", "Cyberpunk", "High Tech Low Life", TasteCategory.VIBES, Color(0xFF06B6D4), 100, 1.0f, 3.0f, listOf("the_matrix", "blade_runner_2049")),
    TasteBubble("psych_thriller", "Psych Thriller", "Mind-Bending", TasteCategory.VIBES, Color(0xFFF43F5E), 108, 1.3f, 4.2f, listOf("david_fincher", "parasite", "taxi_driver")),
    TasteBubble("prestige_anime", "Auteur Anime", "Hand-Drawn Epic", TasteCategory.VIBES, Color(0xFFEC4899), 106, 0.85f, 5.0f, listOf("hayao_miyazaki", "spirited_away")),
    TasteBubble("golden_age", "Neo-Noir", "Crime & Shadows", TasteCategory.VIBES, Color(0xFFFB923C), 102, 1.15f, 0.8f, listOf("goodfellas", "martin_scorsese", "heat")),

    // Auteurs / Directors
    TasteBubble("denis_villeneuve", "Denis Villeneuve", "Scale & Atmosphere", TasteCategory.AUTEURS, Color(0xFF38BDF8), 118, 1.0f, 1.1f, listOf("blade_runner_2049", "dune", "arrival")),
    TasteBubble("christopher_nolan", "Christopher Nolan", "Time & Practical FX", TasteCategory.AUTEURS, Color(0xFF60A5FA), 120, 1.1f, 2.5f, listOf("interstellar", "inception", "cillian_murphy")),
    TasteBubble("hayao_miyazaki", "Hayao Miyazaki", "Studio Ghibli Myth", TasteCategory.AUTEURS, Color(0xFF34D399), 114, 0.95f, 3.8f, listOf("spirited_away", "prestige_anime")),
    TasteBubble("quentin_tarantino", "Quentin Tarantino", "Dialogue & Tension", TasteCategory.AUTEURS, Color(0xFFEF4444), 116, 1.25f, 4.9f, listOf("pulp_fiction", "kill_bill")),
    TasteBubble("martin_scorsese", "Martin Scorsese", "Kinetic Masterclass", TasteCategory.AUTEURS, Color(0xFFF59E0B), 116, 1.05f, 0.4f, listOf("goodfellas", "taxi_driver", "robert_de_niro")),
    TasteBubble("david_lynch", "David Lynch", "Subconscious Dream", TasteCategory.AUTEURS, Color(0xFF8B5CF6), 112, 0.8f, 1.9f, listOf("mulholland_drive", "a24_midnight")),
    TasteBubble("wes_anderson", "Wes Anderson", "Symmetry & Pastel", TasteCategory.AUTEURS, Color(0xFFFBBF24), 108, 1.1f, 3.3f, listOf("grand_budapest", "willem_dafoe")),
    TasteBubble("stanley_kubrick", "Stanley Kubrick", "Transcendent Precision", TasteCategory.AUTEURS, Color(0xFF94A3B8), 115, 0.9f, 4.7f, listOf("space_odyssey_2001", "the_shining")),
    TasteBubble("bong_joon_ho", "Bong Joon-ho", "Sharp Social Satire", TasteCategory.AUTEURS, Color(0xFF10B981), 112, 1.15f, 5.8f, listOf("parasite", "memories_of_murder")),
    TasteBubble("david_fincher", "David Fincher", "Obsessive Realism", TasteCategory.AUTEURS, Color(0xFF64748B), 114, 1.0f, 2.7f, listOf("zodiac", "fight_club")),

    // Actors
    TasteBubble("ryan_gosling", "Ryan Gosling", "Silent Radiance", TasteCategory.ACTORS, Color(0xFF38BDF8), 112, 1.05f, 0.7f, listOf("blade_runner_2049", "drive")),
    TasteBubble("florence_pugh", "Florence Pugh", "Ferocious Depth", TasteCategory.ACTORS, Color(0xFFA855F7), 110, 1.1f, 1.8f, listOf("a24_midnight", "oppenheimer")),
    TasteBubble("cillian_murphy", "Cillian Murphy", "Piercing Intensity", TasteCategory.ACTORS, Color(0xFF60A5FA), 114, 0.95f, 2.9f, listOf("oppenheimer", "peaky_blinders")),
    TasteBubble("willem_dafoe", "Willem Dafoe", "Unhinged Genius", TasteCategory.ACTORS, Color(0xFFF5C518), 112, 1.2f, 4.1f, listOf("the_lighthouse", "wes_anderson")),
    TasteBubble("tilda_swinton", "Tilda Swinton", "Chameleonic Icon", TasteCategory.ACTORS, Color(0xFFEC4899), 110, 0.85f, 5.2f, listOf("wes_anderson", "grand_budapest")),
    TasteBubble("daniel_day_lewis", "Daniel Day-Lewis", "Total Immersion", TasteCategory.ACTORS, Color(0xFFD97706), 116, 0.9f, 0.3f, listOf("there_will_be_blood", "35mm_slowburn")),
    TasteBubble("timothee_chalamet", "Timothée Chalamet", "Generational Grace", TasteCategory.ACTORS, Color(0xFF34D399), 108, 1.15f, 1.5f, listOf("dune", "denis_villeneuve")),
    TasteBubble("denzel_washington", "Denzel Washington", "Gravitas & Command", TasteCategory.ACTORS, Color(0xFFF59E0B), 115, 1.0f, 3.1f, listOf("training_day", "golden_age")),
    TasteBubble("ana_de_armas", "Ana de Armas", "Hypnotic Presence", TasteCategory.ACTORS, Color(0xFFF43F5E), 108, 1.25f, 4.4f, listOf("blade_runner_2049", "knives_out")),
    TasteBubble("mads_mikkelsen", "Mads Mikkelsen", "Chiseled Elegance", TasteCategory.ACTORS, Color(0xFF475569), 112, 0.95f, 5.6f, listOf("another_round", "hannibal")),

    // Iconic Films
    TasteBubble("blade_runner_2049", "Blade Runner 2049", "Deakins Masterpiece", TasteCategory.FILMS, Color(0xFFF5C518), 124, 1.0f, 0.5f, listOf("denis_villeneuve", "ryan_gosling", "sci_fi_noir")),
    TasteBubble("dune", "Dune", "Arrakis Monolith", TasteCategory.FILMS, Color(0xFFD97706), 120, 1.1f, 1.7f, listOf("denis_villeneuve", "timothee_chalamet")),
    TasteBubble("parasite", "Parasite", "Palme d'Or Miracle", TasteCategory.FILMS, Color(0xFF10B981), 118, 1.2f, 2.8f, listOf("bong_joon_ho", "psych_thriller")),
    TasteBubble("there_will_be_blood", "There Will Be Blood", "American Mythos", TasteCategory.FILMS, Color(0xFFB45309), 122, 0.9f, 3.9f, listOf("daniel_day_lewis", "35mm_slowburn")),
    TasteBubble("spirited_away", "Spirited Away", "Bathhouse Wonder", TasteCategory.FILMS, Color(0xFF34D399), 116, 0.85f, 5.1f, listOf("hayao_miyazaki", "prestige_anime")),
    TasteBubble("interstellar", "Interstellar", "Cosmic Yearning", TasteCategory.FILMS, Color(0xFF38BDF8), 122, 1.05f, 0.9f, listOf("christopher_nolan", "sci_fi_noir")),
    TasteBubble("goodfellas", "Goodfellas", "Cinema in Pure Motion", TasteCategory.FILMS, Color(0xFFEF4444), 118, 1.25f, 2.2f, listOf("martin_scorsese", "golden_age")),
    TasteBubble("mulholland_drive", "Mulholland Drive", "Los Angeles Enigma", TasteCategory.FILMS, Color(0xFF8B5CF6), 116, 0.8f, 3.4f, listOf("david_lynch", "a24_midnight")),
    TasteBubble("the_matrix", "The Matrix", "Bullet-Time Awakening", TasteCategory.FILMS, Color(0xFF22C55E), 120, 1.15f, 4.6f, listOf("cyberpunk", "sci_fi_noir")),
    TasteBubble("no_country", "No Country for Old Men", "Unforgiving West", TasteCategory.FILMS, Color(0xFF78716C), 118, 0.95f, 5.7f, listOf("35mm_slowburn", "golden_age")),
    TasteBubble("grand_budapest", "Grand Budapest Hotel", "Whimsical Melancholy", TasteCategory.FILMS, Color(0xFFFBBF24), 114, 1.1f, 1.2f, listOf("wes_anderson", "willem_dafoe")),
    TasteBubble("space_odyssey_2001", "2001: A Space Odyssey", "Dawn of Man", TasteCategory.FILMS, Color(0xFFE2E8F0), 122, 0.85f, 2.6f, listOf("stanley_kubrick", "sci_fi_noir")),
    TasteBubble("heat", "Heat (1995)", "Mann's High Precision", TasteCategory.FILMS, Color(0xFF0284C7), 116, 1.1f, 4.0f, listOf("golden_age", "martin_scorsese")),
    TasteBubble("pulp_fiction", "Pulp Fiction", "Gold Watch & Royale", TasteCategory.FILMS, Color(0xFFF97316), 118, 1.2f, 5.3f, listOf("quentin_tarantino", "golden_age")),
)

/**
 * Authentic Trent Reznor & Jimmy Iovine Beats Music / Apple Music Floating Taste Galaxy.
 * - Organic, buoyant sine-wave physics with drifting liquid dynamics.
 * - Single Tap: Like (inflates ~1.26x with golden rim halo).
 * - Double Tap: Love / Obsessed (surges ~1.58x with radiant double velvet ring and aura).
 * - Long Press: Pop & Burst (bubble explodes, vanishes, and spawns 2-3 related nodes into the orbit).
 * - Endless: Endless pool across Films, Auteurs, Actors, and Vibes.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TasteBubblesCanvas(
    modifier: Modifier = Modifier,
    onAffinityChanged: (Map<String, TasteAffinity>) -> Unit = {},
) {
    var selectedCategory by remember { mutableStateOf(TasteCategory.ALL) }
    val affinities = remember { mutableStateMapOf<String, TasteAffinity>() }

    // Active visible bubbles in the buoyant constellation
    val activeBubbles = remember {
        mutableStateListOf<TasteBubble>().apply {
            addAll(CINEMA_CONSTELLATION_CATALOG.take(16))
        }
    }

    // Set of popped IDs to avoid immediate re-spawning
    val poppedIds = remember { mutableStateListOf<String>() }

    val transition = rememberInfiniteTransition(label = "BeatsMusicFloatingPhysics")
    val time by transition.animateFloat(
        initialValue = 0f,
        targetValue = 6.28318f,
        animationSpec = infiniteRepeatable(
            animation = tween(4800, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "LiquidFloatTime",
    )

    // Pulse animation for Loved bubbles
    val lovePulse by transition.animateFloat(
        initialValue = 0.96f,
        targetValue = 1.04f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "LovePulse",
    )

    fun spawnRelatedOrRandom(poppedBubble: TasteBubble) {
        val remainingCatalog = CINEMA_CONSTELLATION_CATALOG.filter { candidate ->
            !activeBubbles.any { it.id == candidate.id } && !poppedIds.contains(candidate.id)
        }
        if (remainingCatalog.isEmpty()) return

        // Prefer related bubbles
        val relatedCandidates = remainingCatalog.filter { candidate ->
            poppedBubble.relatedIds.contains(candidate.id) || candidate.relatedIds.contains(poppedBubble.id)
        }

        val toAdd = if (relatedCandidates.isNotEmpty()) {
            relatedCandidates.shuffled().take(2)
        } else {
            remainingCatalog.shuffled().take(2)
        }

        toAdd.forEach { newBubble ->
            if (!activeBubbles.any { it.id == newBubble.id }) {
                activeBubbles.add(newBubble)
            }
        }
    }

    val filteredBubbles = remember(selectedCategory, activeBubbles.toList()) {
        if (selectedCategory == TasteCategory.ALL) {
            activeBubbles
        } else {
            activeBubbles.filter { it.category == selectedCategory }
        }
    }

    val lovedCount = affinities.count { it.value == TasteAffinity.LOVE }
    val likedCount = affinities.count { it.value == TasteAffinity.LIKE }

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Luxury Constellation Header
        Text(
            text = "Tell ReelOS What You Love",
            fontSize = 22.sp,
            fontWeight = FontWeight.Black,
            color = Color.White,
            letterSpacing = 0.5.sp,
            textAlign = TextAlign.Center,
        )

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = "Tap once to like. Tap twice to love. Hold to pop.",
            fontSize = 13.sp,
            color = Color.White.copy(alpha = 0.65f),
            textAlign = TextAlign.Center,
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Horizontal Category Filter Pills (Apple Music HIG style)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        ) {
            TasteCategory.values().forEach { category ->
                val isSelected = selectedCategory == category
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .background(
                            if (isSelected) Color(0xFFF5C518) else Color(0xFF14141E)
                        )
                        .border(
                            1.dp,
                            if (isSelected) Color(0xFFF5C518) else Color.White.copy(alpha = 0.12f),
                            RoundedCornerShape(20.dp),
                        )
                        .clickable { selectedCategory = category }
                        .padding(horizontal = 14.dp, vertical = 7.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = category.label,
                        fontSize = 12.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                        color = if (isSelected) Color.Black else Color.White.copy(alpha = 0.85f),
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Buoyant Magnetic Bubble Field
        FlowRow(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterHorizontally),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            maxItemsInEachRow = 3,
        ) {
            filteredBubbles.forEachIndexed { index, bubble ->
                val currentAffinity = affinities[bubble.id] ?: TasteAffinity.NEUTRAL
                val targetScale = when (currentAffinity) {
                    TasteAffinity.NEUTRAL -> 1.0f
                    TasteAffinity.LIKE -> bubble.initialSizeDp.toFloat() / 104f * TasteAffinity.LIKE.scaleMultiplier
                    TasteAffinity.LOVE -> (bubble.initialSizeDp.toFloat() / 104f * TasteAffinity.LOVE.scaleMultiplier) * lovePulse
                }

                val animatedScale by animateFloatAsState(
                    targetValue = targetScale,
                    animationSpec = spring(
                        dampingRatio = Spring.DampingRatioMediumBouncy,
                        stiffness = Spring.StiffnessLow,
                    ),
                    label = "TrentReznorElasticBubbleScale",
                )

                val targetBorderColor = when (currentAffinity) {
                    TasteAffinity.NEUTRAL -> Color.White.copy(alpha = 0.14f)
                    TasteAffinity.LIKE -> Color(0xFFF5C518).copy(alpha = 0.85f)
                    TasteAffinity.LOVE -> Color(0xFFF5C518)
                }

                val borderColor by animateColorAsState(
                    targetValue = targetBorderColor,
                    animationSpec = tween(240),
                    label = "BubbleBorderColor",
                )

                // Organic liquid floating offset: Multi-axis sine/cos drift
                val floatOffsetY = (sin((time * bubble.driftSpeed) + bubble.phaseOffset + index) * 7.5f).roundToInt()
                val floatOffsetX = (cos((time * bubble.driftSpeed * 0.7f) + bubble.phaseOffset) * 4.0f).roundToInt()

                Box(
                    modifier = Modifier
                        .offset { IntOffset(floatOffsetX, floatOffsetY) }
                        .scale(animatedScale)
                        .size(bubble.initialSizeDp.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.radialGradient(
                                colors = listOf(
                                    bubble.baseColor.copy(alpha = when (currentAffinity) {
                                        TasteAffinity.NEUTRAL -> 0.22f
                                        TasteAffinity.LIKE -> 0.45f
                                        TasteAffinity.LOVE -> 0.75f
                                    }),
                                    Color(0xFF101018).copy(alpha = 0.90f),
                                    Color(0xFF06060A),
                                ),
                            ),
                        )
                        .border(
                            width = when (currentAffinity) {
                                TasteAffinity.LOVE -> 3.5.dp
                                TasteAffinity.LIKE -> 2.dp
                                TasteAffinity.NEUTRAL -> 1.dp
                            },
                            color = borderColor,
                            shape = CircleShape,
                        )
                        .pointerInput(bubble.id) {
                            detectTapGestures(
                                onTap = {
                                    val next = currentAffinity.next()
                                    affinities[bubble.id] = next
                                    onAffinityChanged(affinities)
                                },
                                onDoubleTap = {
                                    // Instant double-tap -> Surge to LOVE!
                                    affinities[bubble.id] = TasteAffinity.LOVE
                                    onAffinityChanged(affinities)
                                    // Spawns related cinema nodes into orbit
                                    spawnRelatedOrRandom(bubble)
                                },
                                onLongPress = {
                                    // POP! Trent Reznor bubble burst
                                    poppedIds.add(bubble.id)
                                    affinities.remove(bubble.id)
                                    activeBubbles.remove(bubble)
                                    onAffinityChanged(affinities)
                                    spawnRelatedOrRandom(bubble)
                                },
                            )
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                    ) {
                        // Status Indicator
                        if (currentAffinity == TasteAffinity.LOVE) {
                            Text(
                                text = "★ OBSESSED",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Black,
                                color = Color(0xFFF5C518),
                                letterSpacing = 0.8.sp,
                            )
                        } else if (currentAffinity == TasteAffinity.LIKE) {
                            Text(
                                text = "✓ LIKED",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFFF5C518),
                            )
                        }

                        Text(
                            text = bubble.title,
                            fontSize = if (bubble.title.length > 14) 11.sp else 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            textAlign = TextAlign.Center,
                            lineHeight = 14.sp,
                            maxLines = 2,
                        )

                        Text(
                            text = bubble.subtitle,
                            fontSize = 9.sp,
                            color = Color.White.copy(alpha = 0.55f),
                            textAlign = TextAlign.Center,
                            maxLines = 1,
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(28.dp))

        // Floating "Drift More Cinema Into Orbit" Action Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(24.dp))
                    .background(Color(0xFF161622))
                    .border(1.dp, Color(0xFFF5C518).copy(alpha = 0.35f), RoundedCornerShape(24.dp))
                    .clickable {
                        // Drift next wave of cinema into orbit
                        val unspawned = CINEMA_CONSTELLATION_CATALOG.filter { c ->
                            !activeBubbles.any { it.id == c.id } && !poppedIds.contains(c.id)
                        }
                        if (unspawned.isNotEmpty()) {
                            activeBubbles.addAll(unspawned.shuffled().take(6))
                        }
                    }
                    .padding(horizontal = 20.dp, vertical = 10.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "✦ Drift More Cinema Into Orbit",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFF5C518),
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Live Calibration Status Pill
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(16.dp))
                .background(Color(0xFF0C0C12))
                .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(16.dp))
                .padding(horizontal = 16.dp, vertical = 8.dp),
        ) {
            Text(
                text = "${lovedCount} Loved • ${likedCount} Liked • Infinite Orbit",
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                color = Color.White.copy(alpha = 0.70f),
            )
        }

        Spacer(modifier = Modifier.height(36.dp))
    }
}
