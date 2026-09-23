package com.reelos.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import kotlin.math.roundToInt

private val WATERFALL_POSTERS_COL_1 = listOf(
    "https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg", // Inception
    "https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg", // Dune Part Two
    "https://image.tmdb.org/t/p/w500/3bhkrj58Vtu7enYsRolD1fZdja1.jpg", // The Godfather
    "https://image.tmdb.org/t/p/w500/7fn624j5lj3xTme2SgiLCeuedmO.jpg", // Whiplash
    "https://image.tmdb.org/t/p/w500/8OKm79bmOPLiuv80RI9elby0bhv.jpg", // Seven Samurai
    "https://image.tmdb.org/t/p/w500/ekstpH694Da0QBirlGhZezRinbu.jpg", // Taxi Driver
)

private val WATERFALL_POSTERS_COL_2 = listOf(
    "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg", // Interstellar
    "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg", // Dark Knight
    "https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg", // Parasite
    "https://image.tmdb.org/t/p/w500/xazWoLealQwEgqZ89MLZklLZD3k.jpg", // The Shining
    "https://image.tmdb.org/t/p/w500/gQB8Y5RCMkv2zwzFHbUJX3kAhvA.jpg", // Apocalypse Now
    "https://image.tmdb.org/t/p/w500/eWdyYQreja6JGCzqHWX99Xm0jAc.jpg", // Grand Budapest Hotel
)

private val WATERFALL_POSTERS_COL_3 = listOf(
    "https://image.tmdb.org/t/p/w500/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg", // Blade Runner 2049
    "https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg", // Pulp Fiction
    "https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg", // Spirited Away
    "https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg", // Fight Club
    "https://image.tmdb.org/t/p/w500/ve72VxNqjGM69Uky4WTo2bK6rfq.jpg", // 2001: Space Odyssey
    "https://image.tmdb.org/t/p/w500/vfrQk5IPloGg1v9Rzbh2Eg3VGyM.jpg", // Alien
)

/**
 * CoverArtWaterfall
 *
 * Cascades cinematic movie posters down behind the UI in a multi-column,
 * gently drifting parallax waterfall. Draped in dark velvet shading so the
 * glowing luminous aura and foreground interactive elements shine with depth.
 */
@Composable
fun CoverArtWaterfall(
    modifier: Modifier = Modifier,
    speedFactor: Float = 1.0f,
) {
    val transition = rememberInfiniteTransition(label = "waterfallDrift")

    val drift1 by transition.animateFloat(
        initialValue = 0f,
        targetValue = 600f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = (42000 / speedFactor).roundToInt(), easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "driftCol1",
    )

    val drift2 by transition.animateFloat(
        initialValue = -300f,
        targetValue = 300f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = (50000 / speedFactor).roundToInt(), easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "driftCol2",
    )

    val drift3 by transition.animateFloat(
        initialValue = -150f,
        targetValue = 450f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = (38000 / speedFactor).roundToInt(), easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "driftCol3",
    )

    Box(modifier = modifier.fillMaxSize()) {
        // Multi-column cascading poster stream
        Row(
            modifier = Modifier
                .fillMaxSize()
                .alpha(0.28f), // Soft, non-intrusive backdrop
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            WaterfallColumn(
                posters = WATERFALL_POSTERS_COL_1 + WATERFALL_POSTERS_COL_1,
                offsetY = drift1,
                modifier = Modifier.weight(1f),
            )
            WaterfallColumn(
                posters = WATERFALL_POSTERS_COL_2 + WATERFALL_POSTERS_COL_2,
                offsetY = drift2,
                modifier = Modifier.weight(1f),
            )
            WaterfallColumn(
                posters = WATERFALL_POSTERS_COL_3 + WATERFALL_POSTERS_COL_3,
                offsetY = drift3,
                modifier = Modifier.weight(1f),
            )
        }

        // Luxurious dark velvet vignette overlay
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        0.0f to Color(0xDD070709),
                        0.3f to Color(0x88070709),
                        0.7f to Color(0x99070709),
                        1.0f to Color(0xF2070709),
                    )
                )
        )

        // Radial dark corner vignette for cinema stage depth
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.radialGradient(
                        colors = listOf(Color.Transparent, Color(0xD0000000)),
                        radius = 1200f,
                    )
                )
        )
    }
}

@Composable
private fun WaterfallColumn(
    posters: List<String>,
    offsetY: Float,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .offset { IntOffset(x = 0, y = (offsetY % 1200 - 600).roundToInt()) },
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        posters.forEach { url ->
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(0.67f)
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color(0xFF15151D))
                    .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(14.dp)),
            ) {
                AsyncImage(
                    model = url,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
    }
}
